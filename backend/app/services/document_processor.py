"""
Document Processing Service - INSTANT + BACKGROUND Pipelines

Two parallel pipelines:
1. INSTANT: Gemini extracts key facts in 2-3 seconds for immediate UI
2. BACKGROUND: Full RAG indexing (async) for future complex queries

Based on anhlam/clause architecture but simplified for real-time use.
"""
import asyncio
import base64
import hashlib
import json
import logging
import re
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Callable

from google import genai
from google.genai import types

from app.config import settings

logger = logging.getLogger(__name__)


class ProcessingStatus(str, Enum):
    """Document processing status for Firestore tracking."""
    PENDING = "pending"
    EXTRACTING = "extracting"      # Instant pipeline running
    EXTRACTED = "extracted"         # Facts extracted, can show in UI
    INDEXING = "indexing"          # Background RAG indexing
    INDEXED = "indexed"            # Fully searchable via RAG
    FAILED = "failed"


@dataclass
class ExtractionResult:
    """Result from instant extraction pipeline."""
    doc_id: str
    doc_type: str  # incident_report, medical_records, billing, etc.
    status: ProcessingStatus
    
    # Extracted fields (vary by doc_type)
    extracted_facts: Dict[str, Any] = field(default_factory=dict)
    
    # Metadata
    extraction_time_ms: int = 0
    confidence: float = 0.0
    raw_text_preview: str = ""  # First 500 chars for debugging
    
    # For timeline/source tracking
    source_file_name: str = ""
    source_file_id: str = ""


@dataclass  
class DocumentJob:
    """Job for background RAG indexing."""
    doc_id: str
    file_path: str
    doc_type: str
    priority: int = 0  # Higher = process sooner
    created_at: datetime = field(default_factory=datetime.now)
    

class DocumentProcessor:
    """
    Hybrid document processing with instant extraction + background indexing.
    
    Usage:
        processor = DocumentProcessor()
        
        # Instant extraction (2-3 seconds)
        result = await processor.extract_instant(file_path, doc_type="medical_records")
        # → ExtractionResult with facts for immediate UI update
        
        # Background indexing (queued, 30+ seconds async)
        processor.queue_for_indexing(file_path, doc_type)
        # → Returns immediately, indexing happens in background
    """
    
    # Gemini model for instant extraction
    EXTRACT_MODEL = "gemini-2.0-flash"
    
    # Extraction prompts by document type
    EXTRACTION_PROMPTS = {
        "incident_report": """Extract these fields from this incident/accident report:
- plaintiff_name: Full name of the injured person
- incident_date: Date of the incident (format: YYYY-MM-DD)
- incident_time: Time of incident if available
- incident_location: Where it happened
- employer_name: Employer or company name
- incident_description: Brief description of what happened
- injuries_reported: List of injuries mentioned
- witnesses: Names of any witnesses
- safety_violations: Any safety issues or violations noted
- supervisor_name: Supervisor who filed report

Return as JSON only, no markdown.""",

        "medical_records": """Extract these fields from this medical record:
- patient_name: Patient's full name
- visit_date: Date of visit (format: YYYY-MM-DD)
- facility_name: Hospital or clinic name
- provider_name: Doctor/provider name
- diagnoses: List of diagnoses with ICD-10 codes if present
- injuries: List of injuries/conditions
- injury_severity: Overall severity (minor/moderate/serious/severe)
- treatments: List of treatments provided
- medications: List of medications prescribed
- follow_up: Any follow-up instructions
- prognosis: Recovery outlook if mentioned
- restrictions: Work/activity restrictions

Return as JSON only, no markdown.""",

        "billing": """Extract these fields from this medical bill:
- patient_name: Patient's full name
- facility_name: Billing facility name
- service_date: Date of service (format: YYYY-MM-DD)
- items: List of line items with {description, cpt_code, icd10, amount}
- subtotal: Subtotal amount (number only)
- total_amount: Total bill amount (number only)
- insurance_info: Insurance company if mentioned
- account_number: Account or claim number

IMPORTANT: Extract the TOTAL amount as a number (e.g., 17350.00 not "$17,350.00")

Return as JSON only, no markdown.""",

        "witness_statement": """Extract these fields from this witness statement:
- witness_name: Name of the witness
- witness_role: Their role (coworker, bystander, supervisor, etc.)
- statement_date: When statement was given (format: YYYY-MM-DD)
- incident_date: Date of incident they're describing
- observations: What they saw/heard (key points)
- location_details: Any location details mentioned
- other_witnesses: Other witnesses mentioned

Return as JSON only, no markdown.""",

        "photo": """Analyze this photo for a personal injury case. Extract:
- photo_type: What the photo shows (accident_scene, injury, equipment, location, etc.)
- description: Detailed description of what's visible
- safety_issues: Any safety violations or hazards visible
- injury_details: If showing injuries, describe them
- relevant_details: Any details relevant to the case (signage, conditions, equipment)
- estimated_date: If any date indicators visible

Return as JSON only, no markdown.""",

        "generic": """Extract key information from this legal document:
- document_type: Type of document
- date: Primary date (format: YYYY-MM-DD)
- parties: Names of people/companies involved
- key_facts: List of important facts
- amounts: Any monetary amounts mentioned
- summary: Brief summary of the document

Return as JSON only, no markdown."""
    }
    
    def __init__(self):
        self._client: Optional[genai.Client] = None
        self._background_queue: asyncio.Queue = asyncio.Queue()
        self._indexing_task: Optional[asyncio.Task] = None
        self._status_callback: Optional[Callable] = None
        
    @property
    def client(self) -> genai.Client:
        """Lazy-initialize Gemini client."""
        if self._client is None:
            settings.setup_credentials()
            self._client = genai.Client(
                vertexai=True,
                project=settings.gcp_project_id,
                location="us-central1"
            )
        return self._client
    
    def set_status_callback(self, callback: Callable[[str, ProcessingStatus, Dict], None]):
        """Set callback for status updates (for Firestore/UI)."""
        self._status_callback = callback
    
    def _notify_status(self, doc_id: str, status: ProcessingStatus, data: Dict = None):
        """Notify status change."""
        if self._status_callback:
            self._status_callback(doc_id, status, data or {})
        logger.info(f"[DOC:{doc_id}] Status: {status.value}")
    
    async def extract_instant(
        self,
        file_content: bytes,
        file_name: str,
        doc_type: str = "generic",
        file_id: str = None
    ) -> ExtractionResult:
        """
        INSTANT PIPELINE: Extract key facts using Gemini (2-3 seconds).
        
        Args:
            file_content: Raw file bytes (PDF, image, text)
            file_name: Original filename
            doc_type: Document type for targeted extraction
            file_id: Frontend file ID for source tracking
            
        Returns:
            ExtractionResult with extracted facts
        """
        start_time = time.time()
        doc_id = file_id or hashlib.md5(file_content[:1000]).hexdigest()[:12]
        
        self._notify_status(doc_id, ProcessingStatus.EXTRACTING)
        
        try:
            # Determine mime type
            mime_type = self._detect_mime_type(file_name, file_content)
            
            # Normalize doc_type to match prompt keys
            doc_type_map = {
                "medical_bills": "billing",
                "medical_records_er": "medical_records",
                "medical_records_primary": "medical_records",
                "medical_records_specialist": "medical_records",
                "photos_scene": "photos",
                "photos_injuries": "photos",
                "workers_comp_claim": "workers_comp",
                "osha_report": "osha",
                "osha_investigation": "osha",
            }
            prompt_key = doc_type_map.get(doc_type, doc_type)
            
            # Get extraction prompt
            prompt = self.EXTRACTION_PROMPTS.get(prompt_key, self.EXTRACTION_PROMPTS["generic"])
            
            # Build Gemini request
            parts = [types.Part.from_text(text=prompt)]
            
            if mime_type.startswith("image/") or mime_type == "application/pdf":
                # Send as binary for vision processing
                parts.append(types.Part.from_bytes(data=file_content, mime_type=mime_type))
            else:
                # Text file - decode and send as text
                try:
                    text_content = file_content.decode('utf-8')
                except:
                    text_content = file_content.decode('latin-1')
                parts.append(types.Part.from_text(text=f"Document content:\n{text_content}"))
            
            # Call Gemini
            response = self.client.models.generate_content(
                model=self.EXTRACT_MODEL,
                contents=parts,
                config=types.GenerateContentConfig(
                    temperature=0.1,  # Low temp for extraction
                    max_output_tokens=2048
                )
            )
            
            # Parse JSON response
            response_text = response.text.strip()
            
            # Clean up response (remove markdown if present)
            if response_text.startswith("```"):
                response_text = re.sub(r'^```\w*\n?', '', response_text)
                response_text = re.sub(r'\n?```$', '', response_text)
            
            try:
                extracted_facts = json.loads(response_text)
            except json.JSONDecodeError:
                # Try to extract JSON from response
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    extracted_facts = json.loads(json_match.group())
                else:
                    extracted_facts = {"raw_response": response_text}
            
            extraction_time_ms = int((time.time() - start_time) * 1000)
            
            result = ExtractionResult(
                doc_id=doc_id,
                doc_type=doc_type,
                status=ProcessingStatus.EXTRACTED,
                extracted_facts=extracted_facts,
                extraction_time_ms=extraction_time_ms,
                confidence=0.9,  # Could be computed from response
                source_file_name=file_name,
                source_file_id=file_id or doc_id
            )
            
            self._notify_status(doc_id, ProcessingStatus.EXTRACTED, {
                "facts": extracted_facts,
                "extraction_time_ms": extraction_time_ms
            })
            
            logger.info(f"[DOC:{doc_id}] Extracted in {extraction_time_ms}ms: {list(extracted_facts.keys())}")
            
            return result
            
        except Exception as e:
            logger.error(f"[DOC:{doc_id}] Extraction failed: {e}")
            self._notify_status(doc_id, ProcessingStatus.FAILED, {"error": str(e)})
            
            return ExtractionResult(
                doc_id=doc_id,
                doc_type=doc_type,
                status=ProcessingStatus.FAILED,
                extracted_facts={"error": str(e)},
                source_file_name=file_name,
                source_file_id=file_id or doc_id
            )
    
    def queue_for_indexing(self, file_path: str, doc_type: str, priority: int = 0) -> str:
        """
        Queue document for BACKGROUND RAG indexing.
        Returns immediately - indexing happens async.
        
        Args:
            file_path: Path to the document
            doc_type: Document type
            priority: Higher = process sooner
            
        Returns:
            doc_id for tracking
        """
        doc_id = hashlib.md5(file_path.encode()).hexdigest()[:12]
        
        job = DocumentJob(
            doc_id=doc_id,
            file_path=file_path,
            doc_type=doc_type,
            priority=priority
        )
        
        # Add to queue (non-blocking)
        try:
            self._background_queue.put_nowait(job)
            self._notify_status(doc_id, ProcessingStatus.PENDING)
            logger.info(f"[DOC:{doc_id}] Queued for background indexing")
        except asyncio.QueueFull:
            logger.warning(f"[DOC:{doc_id}] Background queue full, skipping")
        
        return doc_id
    
    async def start_background_worker(self):
        """Start the background indexing worker."""
        if self._indexing_task is None or self._indexing_task.done():
            self._indexing_task = asyncio.create_task(self._background_indexing_loop())
            logger.info("Background indexing worker started")
    
    async def _background_indexing_loop(self):
        """Process background indexing jobs."""
        while True:
            try:
                job = await self._background_queue.get()
                await self._index_document(job)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Background indexing error: {e}")
    
    async def _index_document(self, job: DocumentJob):
        """
        Full RAG indexing for a document.
        This is the SLOW path (30+ seconds) but enables complex queries.
        """
        self._notify_status(job.doc_id, ProcessingStatus.INDEXING)
        
        try:
            # Import RAG service
            from app.services.rag_service import rag_service
            
            # Initialize if needed
            if not rag_service._initialized:
                rag_service.initialize()
            
            # Upload to RAG corpus
            result = rag_service.upload_file(job.file_path, f"{job.doc_type}_{job.doc_id}")
            
            if result.get("status") == "success":
                self._notify_status(job.doc_id, ProcessingStatus.INDEXED)
                logger.info(f"[DOC:{job.doc_id}] Indexed successfully")
            else:
                self._notify_status(job.doc_id, ProcessingStatus.FAILED, {
                    "error": result.get("error", "Unknown indexing error")
                })
                
        except Exception as e:
            logger.error(f"[DOC:{job.doc_id}] Indexing failed: {e}")
            self._notify_status(job.doc_id, ProcessingStatus.FAILED, {"error": str(e)})
    
    def _detect_mime_type(self, file_name: str, content: bytes) -> str:
        """Detect MIME type from filename and content."""
        ext = Path(file_name).suffix.lower()
        
        mime_map = {
            ".pdf": "application/pdf",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".webp": "image/webp",
            ".txt": "text/plain",
            ".tex": "text/plain",
            ".md": "text/plain",
            ".json": "application/json",
        }
        
        if ext in mime_map:
            return mime_map[ext]
        
        # Check magic bytes
        if content[:4] == b'%PDF':
            return "application/pdf"
        if content[:8] == b'\x89PNG\r\n\x1a\n':
            return "image/png"
        if content[:2] == b'\xff\xd8':
            return "image/jpeg"
        
        return "application/octet-stream"


# Singleton instance
document_processor = DocumentProcessor()

__all__ = ["DocumentProcessor", "document_processor", "ExtractionResult", "ProcessingStatus"]

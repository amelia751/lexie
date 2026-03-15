"""
Vertex AI RAG Service for Lexie

Handles document upload, retrieval, and grounded generation
using Vertex AI RAG Engine.
"""

import hashlib
from pathlib import Path
from typing import Optional

import vertexai
from vertexai.preview import rag
from vertexai.preview.generative_models import GenerativeModel, Tool

from app.config import settings


# RAG Configuration
RAG_LOCATION = "europe-west4"  # GA region for RAG Engine
CORPUS_DISPLAY_NAME = "lexie-legal-evidence"

# Use the corpus that has files uploaded (not the empty one)
CORPUS_NAME = "projects/lexie-489222/locations/europe-west4/ragCorpora/4532873024948404224"
USE_EXISTING_CORPUS = True  # Skip corpus search, use known corpus


class RAGService:
    """Service for Vertex AI RAG operations."""
    
    def __init__(self):
        self._initialized = False
        self._corpus_name: Optional[str] = None
    
    def initialize(self):
        """Initialize Vertex AI and get/create corpus."""
        if self._initialized:
            return
        
        # Setup credentials
        settings.setup_credentials()
        
        # Initialize Vertex AI with RAG-enabled region
        vertexai.init(
            project=settings.gcp_project_id,
            location=RAG_LOCATION
        )
        
        # Use existing corpus or find/create one
        if USE_EXISTING_CORPUS and CORPUS_NAME:
            self._corpus_name = CORPUS_NAME
        else:
            self._corpus_name = self._get_or_create_corpus()
        
        self._initialized = True
        print(f"[RAG Service] Initialized with corpus: {self._corpus_name}")
    
    def _get_or_create_corpus(self) -> str:
        """Get existing corpus or create a new one."""
        # Check for existing corpus
        for corpus in rag.list_corpora():
            if corpus.display_name == CORPUS_DISPLAY_NAME:
                return corpus.name
        
        # Create new corpus
        corpus = rag.create_corpus(
            display_name=CORPUS_DISPLAY_NAME,
            description="Evidence documents for Lexie legal intake"
        )
        return corpus.name
    
    @property
    def corpus_name(self) -> str:
        """Get the corpus name, initializing if needed."""
        if not self._initialized:
            self.initialize()
        return self._corpus_name
    
    def _get_file_hash(self, file_path: Path) -> str:
        """Get MD5 hash of a file for deduplication."""
        return hashlib.md5(open(file_path, 'rb').read()).hexdigest()
    
    def list_files(self) -> list[dict]:
        """List all files in the corpus."""
        files = list(rag.list_files(corpus_name=self.corpus_name))
        return [
            {
                "name": f.name,
                "display_name": f.display_name,
                "state": str(f.state) if hasattr(f, 'state') else "ACTIVE"
            }
            for f in files
        ]
    
    def upload_file(
        self,
        file_path: Path,
        display_name: Optional[str] = None,
        skip_duplicates: bool = True
    ) -> dict:
        """
        Upload a file to the RAG corpus.
        
        Args:
            file_path: Path to the file
            display_name: Optional display name (defaults to filename stem)
            skip_duplicates: If True, skip files that already exist
            
        Returns:
            Dict with upload result
        """
        file_path = Path(file_path)
        display_name = display_name or file_path.stem
        
        # Check for duplicates
        if skip_duplicates:
            existing_files = self.list_files()
            existing_names = {f["display_name"] for f in existing_files}
            if display_name in existing_names:
                return {
                    "status": "skipped",
                    "reason": "duplicate",
                    "display_name": display_name
                }
        
        # Upload file
        try:
            rag_file = rag.upload_file(
                corpus_name=self.corpus_name,
                path=str(file_path),
                display_name=display_name,
            )
            return {
                "status": "uploaded",
                "name": rag_file.name,
                "display_name": display_name
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "display_name": display_name
            }
    
    def delete_file(self, file_name: str) -> dict:
        """Delete a file from the corpus."""
        try:
            rag.delete_file(name=file_name)
            return {"status": "deleted", "name": file_name}
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    def clear_corpus(self) -> dict:
        """Delete all files from the corpus (full reset)."""
        self.initialize()
        
        deleted = []
        errors = []
        
        try:
            files = self.list_files()
            for f in files:
                file_name = f.get("name")
                if file_name:
                    try:
                        rag.delete_file(name=file_name)
                        deleted.append(f.get("display_name", file_name))
                    except Exception as e:
                        errors.append({"file": file_name, "error": str(e)})
            
            return {
                "status": "cleared",
                "deleted_count": len(deleted),
                "deleted": deleted,
                "errors": errors if errors else None
            }
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    def retrieve(
        self,
        query: str,
        top_k: int = 5,
        min_score: float = 0.0
    ) -> list[dict]:
        """
        Retrieve relevant chunks for a query.
        
        Args:
            query: The search query
            top_k: Number of results to return
            min_score: Minimum similarity score threshold
            
        Returns:
            List of relevant chunks with metadata
        """
        response = rag.retrieval_query(
            rag_resources=[
                rag.RagResource(rag_corpus=self.corpus_name)
            ],
            text=query,
            similarity_top_k=top_k,
        )
        
        results = []
        for ctx in response.contexts.contexts:
            if ctx.score >= min_score:
                results.append({
                    "text": ctx.text,
                    "score": ctx.score,
                    "source": ctx.source_uri,
                })
        
        return results
    
    def get_retrieval_tool(self, top_k: int = 5) -> Tool:
        """
        Get a Vertex AI retrieval tool for use with GenerativeModel.
        
        This enables grounded generation with RAG.
        """
        return Tool.from_retrieval(
            retrieval=rag.Retrieval(
                source=rag.VertexRagStore(
                    rag_resources=[
                        rag.RagResource(rag_corpus=self.corpus_name)
                    ],
                    similarity_top_k=top_k,
                ),
            )
        )
    
    def grounded_generate(
        self,
        prompt: str,
        model_name: str = "gemini-2.0-flash",
        top_k: int = 5
    ) -> str:
        """
        Generate a response grounded in the RAG corpus.
        
        Args:
            prompt: The user's question/prompt
            model_name: Gemini model to use
            top_k: Number of chunks to retrieve for context
            
        Returns:
            Generated response text
        """
        # Create model with RAG retrieval tool
        model = GenerativeModel(
            model_name=model_name,
            tools=[self.get_retrieval_tool(top_k)]
        )
        
        response = model.generate_content(prompt)
        return response.text


# Singleton instance
rag_service = RAGService()

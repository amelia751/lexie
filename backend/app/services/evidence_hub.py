"""
Evidence Hub Service

Central state management for case evidence, facts, and checklist.
All agents read/write to this hub.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, Union
import json


class EvidenceStatus(str, Enum):
    """Status of an evidence item."""
    REQUIRED = "required"       # Needed but not uploaded
    PENDING = "pending"         # User will provide later
    UPLOADED = "uploaded"       # Document uploaded
    ANALYZED = "analyzed"       # Analyzed by Evidence Agent
    NOT_AVAILABLE = "not_available"  # User confirmed they don't have it


class EvidencePriority(str, Enum):
    """Priority of evidence."""
    CRITICAL = "critical"       # Must have for case
    IMPORTANT = "important"     # Strongly recommended
    HELPFUL = "helpful"         # Nice to have


@dataclass
class EvidenceItem:
    """A single evidence item in the checklist."""
    id: str
    type: str                   # e.g., "medical_records", "incident_report"
    description: str            # Human-readable description
    status: EvidenceStatus = EvidenceStatus.REQUIRED
    priority: EvidencePriority = EvidencePriority.IMPORTANT
    document_path: Optional[str] = None
    analysis_summary: Optional[str] = None
    uploaded_at: Optional[datetime] = None
    analyzed_at: Optional[datetime] = None
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type,
            "description": self.description,
            "status": self.status.value,
            "priority": self.priority.value,
            "document_path": self.document_path,
            "analysis_summary": self.analysis_summary,
            "uploaded_at": self.uploaded_at.isoformat() if self.uploaded_at else None,
            "analyzed_at": self.analyzed_at.isoformat() if self.analyzed_at else None,
        }


@dataclass
class CaseFacts:
    """Structured facts gathered about the case."""
    # Plaintiff info
    plaintiff_name: Optional[str] = None
    plaintiff_age: Optional[int] = None
    plaintiff_occupation: Optional[str] = None
    
    # Employer info
    employer_name: Optional[str] = None
    employer_type: Optional[str] = None
    
    # Incident details
    incident_date: Optional[str] = None
    incident_location: Optional[str] = None
    incident_description: Optional[str] = None
    incident_type: Optional[str] = None  # e.g., "fall", "machinery", "repetitive"
    
    # Injuries
    injuries: list = field(default_factory=list)
    injury_severity: Optional[str] = None  # mild, moderate, severe
    
    # Medical treatment
    medical_providers: list = field(default_factory=list)
    medical_expenses: Optional[float] = None
    future_medical_estimate: Optional[float] = None
    
    # Employment impact
    days_missed_work: Optional[int] = None
    lost_wages: Optional[float] = None
    can_return_to_work: Optional[bool] = None
    work_restrictions: list = field(default_factory=list)
    
    # Witnesses
    witnesses: list = field(default_factory=list)
    
    # Safety violations
    safety_violations: list = field(default_factory=list)
    osha_citations: list = field(default_factory=list)
    
    # Insurance
    workers_comp_filed: Optional[bool] = None
    workers_comp_claim_number: Optional[str] = None
    health_insurance: Optional[str] = None
    
    # Damages
    economic_damages: Optional[float] = None
    non_economic_damages: Optional[float] = None
    total_damages_estimate: Optional[float] = None
    settlement_range_low: Optional[float] = None
    settlement_range_high: Optional[float] = None
    
    # Source file tracking - maps category to frontend file ID
    # e.g., {"incident": "file-123...", "medical": "file-456..."}
    source_files: dict = field(default_factory=dict)
    
    def to_dict(self) -> dict:
        return {
            "plaintiff": {
                "name": self.plaintiff_name,
                "age": self.plaintiff_age,
                "occupation": self.plaintiff_occupation,
            },
            "employer": {
                "name": self.employer_name,
                "type": self.employer_type,
            },
            "incident": {
                "date": self.incident_date,
                "location": self.incident_location,
                "description": self.incident_description,
                "type": self.incident_type,
            },
            "injuries": {
                "list": self.injuries,
                "severity": self.injury_severity,
            },
            "medical": {
                "providers": self.medical_providers,
                "expenses": self.medical_expenses,
                "future_estimate": self.future_medical_estimate,
            },
            "employment_impact": {
                "days_missed": self.days_missed_work,
                "lost_wages": self.lost_wages,
                "can_return": self.can_return_to_work,
                "restrictions": self.work_restrictions,
            },
            "witnesses": self.witnesses,
            "safety": {
                "violations": self.safety_violations,
                "osha_citations": self.osha_citations,
            },
            "insurance": {
                "workers_comp_filed": self.workers_comp_filed,
                "claim_number": self.workers_comp_claim_number,
                "health_insurance": self.health_insurance,
            },
            "damages": {
                "economic": self.economic_damages,
                "non_economic": self.non_economic_damages,
                "total_estimate": self.total_damages_estimate,
                "settlement_range": {
                    "low": self.settlement_range_low,
                    "high": self.settlement_range_high,
                }
            },
            "source_files": self.source_files,  # Maps category -> frontend file ID
        }
    
    def update(self, field_path: str, value) -> None:
        """Update a field using dot notation (e.g., 'plaintiff_name' or 'injuries')."""
        if hasattr(self, field_path):
            setattr(self, field_path, value)


class EvidenceHub:
    """
    Central hub for case state management.
    
    Tracks:
    - Evidence checklist (what's needed, what's uploaded)
    - Case facts (structured information gathered)
    - Case summary (auto-generated)
    """
    
    def __init__(self):
        self.checklist: list[EvidenceItem] = []
        self.facts = CaseFacts()
        self._case_type: Optional[str] = None
        self._session_id: Optional[str] = None
        self._currently_requested: Optional[str] = None  # ID of document being requested
    
    def set_currently_requested(self, item: Optional[Union[str, 'EvidenceItem']]) -> None:
        """Set the document currently being requested (shows upload card).
        
        Args:
            item: Either an EvidenceItem object or a string item ID
        """
        if item is None:
            self._currently_requested = None
        elif isinstance(item, str):
            self._currently_requested = item
        elif hasattr(item, 'id'):
            self._currently_requested = item.id
        else:
            self._currently_requested = str(item)
    
    def get_currently_requested(self) -> Optional[EvidenceItem]:
        """Get the document currently being requested."""
        if not self._currently_requested:
            return None
        return self.get_evidence_item(self._currently_requested)
    
    def clear_currently_requested(self) -> None:
        """Clear the current document request."""
        self._currently_requested = None
    
    def set_session(self, session_id: str) -> None:
        """Set the current session ID."""
        self._session_id = session_id
    
    def set_case_type(self, case_type: str) -> None:
        """Set the case type (e.g., 'construction_fall', 'machinery_injury')."""
        self._case_type = case_type
    
    # ===== Checklist Management =====
    
    def add_evidence_item(
        self,
        evidence_type: str,
        description: str,
        priority: EvidencePriority = EvidencePriority.IMPORTANT
    ) -> EvidenceItem:
        """Add a new evidence item to the checklist."""
        item_id = f"{evidence_type}_{len(self.checklist)}"
        item = EvidenceItem(
            id=item_id,
            type=evidence_type,
            description=description,
            priority=priority
        )
        self.checklist.append(item)
        return item
    
    def get_evidence_item(self, item_id: str) -> Optional[EvidenceItem]:
        """Get an evidence item by ID."""
        for item in self.checklist:
            if item.id == item_id:
                return item
        return None
    
    def update_evidence_status(
        self,
        item_id: str,
        status: EvidenceStatus,
        document_path: Optional[str] = None,
        analysis_summary: Optional[str] = None
    ) -> bool:
        """Update the status of an evidence item."""
        item = self.get_evidence_item(item_id)
        if not item:
            return False
        
        item.status = status
        
        if document_path:
            item.document_path = document_path
            item.uploaded_at = datetime.now()
        
        if analysis_summary:
            item.analysis_summary = analysis_summary
            item.analyzed_at = datetime.now()
            item.status = EvidenceStatus.ANALYZED
        
        return True
    
    def get_pending_evidence(self) -> list[EvidenceItem]:
        """Get evidence items that are still needed."""
        return [
            item for item in self.checklist
            if item.status in [EvidenceStatus.REQUIRED, EvidenceStatus.PENDING]
        ]
    
    def match_file_to_evidence(self, file_name: str, doc_type: str = None) -> Optional[EvidenceItem]:
        """
        Match an uploaded file to the correct evidence item based on filename.
        
        Args:
            file_name: Name of the uploaded file
            doc_type: Optional doc type hint from the upload card
            
        Returns:
            The matching EvidenceItem, or None if no match
        """
        file_lower = file_name.lower()
        
        # Mapping of file name patterns to evidence types
        patterns = {
            "incident": ["incident_report"],
            "accident": ["incident_report"],
            "er": ["medical_records_er"],
            "emergency": ["medical_records_er"],
            "medical-records-er": ["medical_records_er"],
            "billing": ["medical_bills", "billing"],
            "imaging": ["medical_imaging"],
            "mri": ["medical_imaging"],
            "xray": ["medical_imaging"],
            "x-ray": ["medical_imaging"],
            "ct": ["medical_imaging"],
            "orthopedic": ["medical_records_primary", "medical_records_specialist"],
            "neurology": ["medical_records_primary", "medical_records_specialist"],
            "pt": ["medical_records_primary", "physical_therapy"],
            "physical": ["medical_records_primary", "physical_therapy"],
            "witness": ["witness_statements"],
            "osha": ["osha_report", "osha_investigation"],
            "safety": ["osha_report", "safety_training"],
            "training": ["safety_training"],
            "workers-comp": ["workers_comp_claim"],
            "workers_comp": ["workers_comp_claim"],
            "comp-claim": ["workers_comp_claim"],
            "employment": ["employment_records"],
            "pay": ["pay_stubs", "employment_records"],
            "ime": ["ime_report"],
            "photo": ["photos_scene", "photos_injury"],
            "fracture": ["photos_injury", "medical_imaging"],
        }
        
        # First, check if doc_type directly matches an item
        if doc_type:
            for item in self.checklist:
                if item.type == doc_type and item.status == EvidenceStatus.REQUIRED:
                    return item
        
        # Then, try to match by file name patterns
        for pattern, types in patterns.items():
            if pattern in file_lower:
                # Find a REQUIRED item matching these types
                for evidence_type in types:
                    for item in self.checklist:
                        if item.type == evidence_type and item.status == EvidenceStatus.REQUIRED:
                            return item
        
        # Fall back to currently requested or next required
        if self._currently_requested:
            item = self.get_evidence_item(self._currently_requested)
            if item and item.status == EvidenceStatus.REQUIRED:
                return item
        
        return self.get_next_required_evidence()
    
    def get_next_required_evidence(self) -> Optional[EvidenceItem]:
        """Get the next REQUIRED evidence item (items not yet addressed)."""
        # Only get items that are still REQUIRED (not yet addressed by user)
        required = [item for item in self.checklist if item.status == EvidenceStatus.REQUIRED]
        if not required:
            return None
        
        # Sort by priority
        priority_order = {
            EvidencePriority.CRITICAL: 0,
            EvidencePriority.IMPORTANT: 1,
            EvidencePriority.HELPFUL: 2
        }
        required.sort(key=lambda x: priority_order.get(x.priority, 99))
        return required[0]
    
    def get_uploaded_evidence(self) -> list[EvidenceItem]:
        """Get evidence items that have been uploaded/analyzed."""
        return [
            item for item in self.checklist
            if item.status in [EvidenceStatus.UPLOADED, EvidenceStatus.ANALYZED]
        ]
    
    # ===== Facts Management =====
    
    def update_fact(self, field: str, value) -> bool:
        """Update a case fact."""
        try:
            self.facts.update(field, value)
            return True
        except Exception:
            return False
    
    def get_facts(self) -> dict:
        """Get all case facts as a dictionary."""
        return self.facts.to_dict()
    
    # ===== Summary Generation =====
    
    def get_case_summary(self) -> dict:
        """Generate a case summary from current state."""
        pending = self.get_pending_evidence()
        uploaded = self.get_uploaded_evidence()
        
        # Calculate completeness
        total_items = len(self.checklist)
        completed_items = len([i for i in self.checklist if i.status == EvidenceStatus.ANALYZED])
        completeness = (completed_items / total_items * 100) if total_items > 0 else 0
        
        return {
            "case_type": self._case_type,
            "session_id": self._session_id,
            "completeness_percent": round(completeness, 1),
            "evidence": {
                "total_required": total_items,
                "uploaded": len(uploaded),
                "pending": len(pending),
                "checklist": [item.to_dict() for item in self.checklist]
            },
            "facts": self.facts.to_dict(),
            "status": self._get_case_status()
        }
    
    def _get_case_status(self) -> str:
        """Determine overall case status."""
        if not self.checklist:
            return "initial_intake"
        
        # Check how many items are still REQUIRED (not yet addressed)
        required_items = [i for i in self.checklist if i.status == EvidenceStatus.REQUIRED]
        pending_items = [i for i in self.checklist if i.status == EvidenceStatus.PENDING]
        critical_required = [i for i in required_items if i.priority == EvidencePriority.CRITICAL]
        
        if required_items:
            # Still have items that haven't been addressed
            if critical_required:
                return "missing_critical_evidence"
            else:
                return "gathering_evidence"
        elif self.facts.total_damages_estimate:
            # All items addressed AND damages calculated
            return "ready_for_review"
        elif pending_items or not required_items:
            # All items addressed (uploaded, pending, or not_available)
            # but damages not yet calculated
            return "intake_complete"
        else:
            return "calculating_damages"
    
    def is_intake_complete(self) -> bool:
        """Check if all evidence items have been addressed."""
        required_items = [i for i in self.checklist if i.status == EvidenceStatus.REQUIRED]
        return len(required_items) == 0 and len(self.checklist) > 0
    
    def get_checklist_status(self) -> dict:
        """Get a simple status of the evidence checklist."""
        return {
            "total": len(self.checklist),
            "required": len([i for i in self.checklist if i.status == EvidenceStatus.REQUIRED]),
            "pending": len([i for i in self.checklist if i.status == EvidenceStatus.PENDING]),
            "uploaded": len([i for i in self.checklist if i.status == EvidenceStatus.UPLOADED]),
            "analyzed": len([i for i in self.checklist if i.status == EvidenceStatus.ANALYZED]),
            "not_available": len([i for i in self.checklist if i.status == EvidenceStatus.NOT_AVAILABLE]),
        }
    
    # ===== Initialize Checklist Templates =====
    
    def initialize_construction_fall_checklist(self) -> None:
        """Initialize checklist for construction fall case."""
        self._case_type = "construction_fall"
        
        # Critical evidence
        self.add_evidence_item(
            "incident_report",
            "Employer's incident/accident report",
            EvidencePriority.CRITICAL
        )
        self.add_evidence_item(
            "medical_records_er",
            "Emergency room records from day of injury",
            EvidencePriority.CRITICAL
        )
        self.add_evidence_item(
            "medical_records_primary",
            "Primary care or specialist medical records",
            EvidencePriority.CRITICAL
        )
        
        # Important evidence
        self.add_evidence_item(
            "witness_statements",
            "Written statements from witnesses",
            EvidencePriority.IMPORTANT
        )
        self.add_evidence_item(
            "photos_scene",
            "Photos of the accident scene/location",
            EvidencePriority.IMPORTANT
        )
        self.add_evidence_item(
            "photos_injuries",
            "Photos of injuries (if visible)",
            EvidencePriority.IMPORTANT
        )
        self.add_evidence_item(
            "employment_records",
            "Pay stubs or employment records showing wages",
            EvidencePriority.IMPORTANT
        )
        self.add_evidence_item(
            "safety_training",
            "Safety training records/certifications",
            EvidencePriority.IMPORTANT
        )
        self.add_evidence_item(
            "workers_comp_claim",
            "Workers' compensation claim documents",
            EvidencePriority.IMPORTANT
        )
        
        # Helpful evidence
        self.add_evidence_item(
            "osha_report",
            "OSHA investigation report (if available)",
            EvidencePriority.HELPFUL
        )
        self.add_evidence_item(
            "medical_imaging",
            "X-rays, MRI, or CT scan results",
            EvidencePriority.HELPFUL
        )
        self.add_evidence_item(
            "physical_therapy",
            "Physical therapy records",
            EvidencePriority.HELPFUL
        )
        self.add_evidence_item(
            "medical_bills",
            "Medical bills and invoices",
            EvidencePriority.HELPFUL
        )
    
    def initialize_generic_workplace_checklist(self) -> None:
        """Initialize checklist for generic workplace injury."""
        self._case_type = "workplace_injury"
        
        self.add_evidence_item(
            "incident_report",
            "Incident/accident report",
            EvidencePriority.CRITICAL
        )
        self.add_evidence_item(
            "medical_records",
            "Medical records documenting injury",
            EvidencePriority.CRITICAL
        )
        self.add_evidence_item(
            "employment_records",
            "Proof of employment and wages",
            EvidencePriority.IMPORTANT
        )
        self.add_evidence_item(
            "witness_info",
            "Witness contact information or statements",
            EvidencePriority.IMPORTANT
        )
        self.add_evidence_item(
            "photos",
            "Any relevant photos",
            EvidencePriority.HELPFUL
        )
    
    def initialize_motor_vehicle_accident_checklist(self) -> None:
        """Initialize checklist for motor vehicle accident case."""
        self._case_type = "motor_vehicle_accident"
        
        self.add_evidence_item(
            "police_report",
            "Police/accident report from the scene",
            EvidencePriority.CRITICAL
        )
        self.add_evidence_item(
            "medical_records",
            "Medical records documenting injuries",
            EvidencePriority.CRITICAL
        )
        self.add_evidence_item(
            "insurance_info",
            "Insurance information (yours and other party's)",
            EvidencePriority.CRITICAL
        )
        self.add_evidence_item(
            "photos_scene",
            "Photos of the accident scene",
            EvidencePriority.IMPORTANT
        )
        self.add_evidence_item(
            "photos_vehicle_damage",
            "Photos of vehicle damage",
            EvidencePriority.IMPORTANT
        )
        self.add_evidence_item(
            "witness_info",
            "Witness contact information or statements",
            EvidencePriority.IMPORTANT
        )
        self.add_evidence_item(
            "repair_estimates",
            "Vehicle repair estimates or invoices",
            EvidencePriority.HELPFUL
        )
        self.add_evidence_item(
            "lost_wage_docs",
            "Documentation of lost wages",
            EvidencePriority.HELPFUL
        )
    
    def initialize_slip_and_fall_checklist(self) -> None:
        """Initialize checklist for slip and fall / premises liability case."""
        self._case_type = "slip_and_fall"
        
        self.add_evidence_item(
            "incident_report",
            "Incident report from property owner/manager",
            EvidencePriority.CRITICAL
        )
        self.add_evidence_item(
            "medical_records",
            "Medical records documenting injuries",
            EvidencePriority.CRITICAL
        )
        self.add_evidence_item(
            "photos_hazard",
            "Photos of the hazard that caused the fall",
            EvidencePriority.CRITICAL
        )
        self.add_evidence_item(
            "photos_injuries",
            "Photos of your injuries",
            EvidencePriority.IMPORTANT
        )
        self.add_evidence_item(
            "witness_info",
            "Witness contact information or statements",
            EvidencePriority.IMPORTANT
        )
        self.add_evidence_item(
            "clothing_shoes",
            "Photos of clothing/shoes worn (if relevant)",
            EvidencePriority.HELPFUL
        )
        self.add_evidence_item(
            "maintenance_records",
            "Property maintenance records (if obtainable)",
            EvidencePriority.HELPFUL
        )
    
    def initialize_medical_malpractice_checklist(self) -> None:
        """Initialize checklist for medical malpractice case."""
        self._case_type = "medical_malpractice"
        
        self.add_evidence_item(
            "medical_records_provider",
            "Complete medical records from the provider in question",
            EvidencePriority.CRITICAL
        )
        self.add_evidence_item(
            "medical_records_treatment",
            "Records of corrective treatment received",
            EvidencePriority.CRITICAL
        )
        self.add_evidence_item(
            "consent_forms",
            "Informed consent forms you signed",
            EvidencePriority.IMPORTANT
        )
        self.add_evidence_item(
            "prescription_records",
            "Prescription and medication records",
            EvidencePriority.IMPORTANT
        )
        self.add_evidence_item(
            "medical_bills",
            "All related medical bills",
            EvidencePriority.IMPORTANT
        )
        self.add_evidence_item(
            "expert_opinion",
            "Second opinion or expert medical opinion (if obtained)",
            EvidencePriority.HELPFUL
        )
    
    def initialize_product_liability_checklist(self) -> None:
        """Initialize checklist for product liability case."""
        self._case_type = "product_liability"
        
        self.add_evidence_item(
            "product_itself",
            "The defective product (or photos of it)",
            EvidencePriority.CRITICAL
        )
        self.add_evidence_item(
            "medical_records",
            "Medical records documenting injuries",
            EvidencePriority.CRITICAL
        )
        self.add_evidence_item(
            "purchase_proof",
            "Proof of purchase (receipt, invoice, credit card statement)",
            EvidencePriority.IMPORTANT
        )
        self.add_evidence_item(
            "photos_injuries",
            "Photos of injuries caused by the product",
            EvidencePriority.IMPORTANT
        )
        self.add_evidence_item(
            "product_packaging",
            "Product packaging, instructions, or warnings",
            EvidencePriority.IMPORTANT
        )
        self.add_evidence_item(
            "witness_info",
            "Witness contact information or statements",
            EvidencePriority.HELPFUL
        )
    
    def initialize_generic_personal_injury_checklist(self) -> None:
        """Initialize checklist for generic personal injury case."""
        self._case_type = "personal_injury"
        
        self.add_evidence_item(
            "incident_description",
            "Written description of how the injury occurred",
            EvidencePriority.CRITICAL
        )
        self.add_evidence_item(
            "medical_records",
            "Medical records documenting injuries",
            EvidencePriority.CRITICAL
        )
        self.add_evidence_item(
            "photos",
            "Photos of injuries or incident scene",
            EvidencePriority.IMPORTANT
        )
        self.add_evidence_item(
            "witness_info",
            "Witness contact information or statements",
            EvidencePriority.IMPORTANT
        )
        self.add_evidence_item(
            "medical_bills",
            "Medical bills and expenses",
            EvidencePriority.HELPFUL
        )
        self.add_evidence_item(
            "lost_wage_docs",
            "Documentation of lost wages (if applicable)",
            EvidencePriority.HELPFUL
        )
    
    def reset(self) -> None:
        """Reset the hub to initial state."""
        self.checklist = []
        self.facts = CaseFacts()
        self._case_type = None
        self._session_id = None
        self._currently_requested = None


# Singleton instance
evidence_hub = EvidenceHub()

__all__ = [
    "EvidenceHub",
    "EvidenceItem",
    "EvidenceStatus",
    "EvidencePriority",
    "CaseFacts",
    "evidence_hub",
]

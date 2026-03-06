"""
Evidence Hub Service

Central state management for case evidence, facts, and checklist.
All agents read/write to this hub.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional
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
            }
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
    
    def get_next_required_evidence(self) -> Optional[EvidenceItem]:
        """Get the next required evidence item (by priority)."""
        pending = self.get_pending_evidence()
        if not pending:
            return None
        
        # Sort by priority
        priority_order = {
            EvidencePriority.CRITICAL: 0,
            EvidencePriority.IMPORTANT: 1,
            EvidencePriority.HELPFUL: 2
        }
        pending.sort(key=lambda x: priority_order.get(x.priority, 99))
        return pending[0]
    
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
        
        pending = self.get_pending_evidence()
        critical_pending = [i for i in pending if i.priority == EvidencePriority.CRITICAL]
        
        if critical_pending:
            return "missing_critical_evidence"
        elif pending:
            return "gathering_evidence"
        elif self.facts.total_damages_estimate:
            return "ready_for_review"
        else:
            return "calculating_damages"
    
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
    
    def reset(self) -> None:
        """Reset the hub to initial state."""
        self.checklist = []
        self.facts = CaseFacts()
        self._case_type = None
        self._session_id = None


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

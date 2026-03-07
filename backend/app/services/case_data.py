"""
Case Data Model - Hybrid JSON + Tabular Structure

Mirrors novalyst's approach:
- JSON for structured, nested data (case identity, parties, incident)
- Tabular/DataFrame for line-item, queryable data (expenses, wages, timeline)

This provides a single source of truth for all case data that can be:
- Easily serialized to JSON for storage/API responses
- Queried with pandas for calculations and analysis
- Used across different case types
"""

import uuid
from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum

import pandas as pd


# ==================== ENUMS ====================

class CaseStatus(str, Enum):
    """Overall case status."""
    INITIAL = "initial"
    INTAKE_IN_PROGRESS = "intake_in_progress"
    INTAKE_COMPLETE = "intake_complete"
    CALCULATING_DAMAGES = "calculating_damages"
    READY_FOR_REVIEW = "ready_for_review"
    SUBMITTED = "submitted"
    CLOSED = "closed"


class InjurySeverity(str, Enum):
    """Injury severity levels."""
    MINOR = "minor"           # Full recovery, no lasting effects
    MODERATE = "moderate"     # Recovery expected, some lasting effects
    SERIOUS = "serious"       # Permanent limitations
    SEVERE = "severe"         # Catastrophic, life-altering


class EvidenceStatus(str, Enum):
    """Evidence item status."""
    REQUIRED = "required"
    PENDING = "pending"
    UPLOADED = "uploaded"
    ANALYZED = "analyzed"
    NOT_AVAILABLE = "not_available"


class EvidencePriority(str, Enum):
    """Evidence item priority."""
    CRITICAL = "critical"
    IMPORTANT = "important"
    HELPFUL = "helpful"


# ==================== JSON STRUCTURES ====================

@dataclass
class CaseMeta:
    """Case metadata - JSON structure."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    type: Optional[str] = None  # construction_fall, slip_and_fall, etc.
    status: CaseStatus = CaseStatus.INITIAL
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    session_id: Optional[str] = None
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "session_id": self.session_id,
        }


@dataclass
class Party:
    """A party in the case (plaintiff or defendant)."""
    name: Optional[str] = None
    type: Optional[str] = None  # individual, employer, corporation
    age: Optional[int] = None
    occupation: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    address: Optional[str] = None
    insurance_company: Optional[str] = None
    insurance_policy: Optional[str] = None
    
    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "type": self.type,
            "age": self.age,
            "occupation": self.occupation,
            "contact": {
                "phone": self.contact_phone,
                "email": self.contact_email,
                "address": self.address,
            },
            "insurance": {
                "company": self.insurance_company,
                "policy": self.insurance_policy,
            }
        }


@dataclass
class Parties:
    """All parties in the case - JSON structure."""
    plaintiff: Party = field(default_factory=Party)
    defendant: Party = field(default_factory=Party)
    
    def to_dict(self) -> dict:
        return {
            "plaintiff": self.plaintiff.to_dict(),
            "defendant": self.defendant.to_dict(),
        }


@dataclass
class Incident:
    """Incident details - JSON structure."""
    date: Optional[str] = None
    time: Optional[str] = None
    location: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None  # fall, machinery, repetitive_strain, etc.
    cause: Optional[str] = None
    safety_violations: List[str] = field(default_factory=list)
    osha_citations: List[str] = field(default_factory=list)
    police_report_number: Optional[str] = None
    
    def to_dict(self) -> dict:
        return {
            "date": self.date,
            "time": self.time,
            "location": self.location,
            "address": self.address,
            "description": self.description,
            "type": self.type,
            "cause": self.cause,
            "safety_violations": self.safety_violations,
            "osha_citations": self.osha_citations,
            "police_report_number": self.police_report_number,
        }


@dataclass
class Injury:
    """A single injury - part of JSON array."""
    type: str  # fracture, concussion, laceration, etc.
    body_part: Optional[str] = None
    severity: InjurySeverity = InjurySeverity.MODERATE
    diagnosis: Optional[str] = None
    prognosis: Optional[str] = None  # full_recovery, partial_recovery, permanent
    treatment_required: Optional[str] = None
    
    def to_dict(self) -> dict:
        return {
            "type": self.type,
            "body_part": self.body_part,
            "severity": self.severity.value,
            "diagnosis": self.diagnosis,
            "prognosis": self.prognosis,
            "treatment_required": self.treatment_required,
        }


@dataclass
class Damages:
    """Calculated damages summary - JSON structure."""
    economic_total: Optional[float] = None
    non_economic_total: Optional[float] = None
    gross_total: Optional[float] = None
    settlement_low: Optional[float] = None
    settlement_high: Optional[float] = None
    multiplier_used: Optional[float] = None
    calculation_method: Optional[str] = None  # multiplier, per_diem, hybrid
    
    def to_dict(self) -> dict:
        return {
            "economic_total": self.economic_total,
            "non_economic_total": self.non_economic_total,
            "gross_total": self.gross_total,
            "settlement_range": {
                "low": self.settlement_low,
                "high": self.settlement_high,
            },
            "multiplier_used": self.multiplier_used,
            "calculation_method": self.calculation_method,
        }


@dataclass
class EvidenceItem:
    """A single evidence item in the checklist."""
    id: str
    type: str
    description: str
    status: EvidenceStatus = EvidenceStatus.REQUIRED
    priority: EvidencePriority = EvidencePriority.IMPORTANT
    document_path: Optional[str] = None
    analysis_summary: Optional[str] = None
    uploaded_at: Optional[datetime] = None
    
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
        }


# ==================== TABULAR DATAFRAME SCHEMAS ====================

def create_medical_expenses_df() -> pd.DataFrame:
    """Create empty medical expenses DataFrame."""
    return pd.DataFrame(columns=[
        "id",           # Unique identifier
        "date",         # Date of service
        "provider",     # Healthcare provider name
        "service",      # Description of service
        "amount",       # Billed amount
        "paid_by",      # Who paid (insurance, self, workers_comp)
        "paid_amount",  # Amount actually paid
        "status",       # pending, paid, disputed
        "source_doc",   # Source document ID
    ])


def create_lost_wages_df() -> pd.DataFrame:
    """Create empty lost wages DataFrame."""
    return pd.DataFrame(columns=[
        "id",           # Unique identifier
        "period_start", # Start of missed work period
        "period_end",   # End of missed work period
        "employer",     # Employer name
        "amount",       # Lost wage amount
        "type",         # past_wages, future_earnings, overtime, benefits
        "hourly_rate",  # Hourly rate (if applicable)
        "hours_missed", # Hours missed (if applicable)
        "verified",     # Whether verified by documentation
        "source_doc",   # Source document ID
    ])


def create_witnesses_df() -> pd.DataFrame:
    """Create empty witnesses DataFrame."""
    return pd.DataFrame(columns=[
        "id",               # Unique identifier
        "name",             # Witness name
        "relationship",     # Relationship to plaintiff (coworker, supervisor, etc.)
        "contact_phone",    # Phone number
        "contact_email",    # Email
        "statement_summary", # Brief summary of what they witnessed
        "statement_date",   # Date of statement
        "credibility",      # Assessed credibility (high, medium, low)
        "source_doc",       # Source document ID
    ])


def create_timeline_df() -> pd.DataFrame:
    """Create empty timeline DataFrame."""
    return pd.DataFrame(columns=[
        "id",           # Unique identifier
        "date",         # Date of event
        "time",         # Time of event (if known)
        "event",        # Description of event
        "category",     # incident, medical, legal, employment
        "source_doc",   # Source document ID
        "significance", # Key fact, supporting detail, background
        "verified",     # Whether verified by documentation
    ])


def create_liens_df() -> pd.DataFrame:
    """Create empty liens DataFrame."""
    return pd.DataFrame(columns=[
        "id",           # Unique identifier
        "holder",       # Who holds the lien
        "type",         # workers_comp, health_insurance, medicaid, child_support
        "amount",       # Lien amount
        "status",       # asserted, negotiating, resolved, disputed
        "resolution",   # Negotiated amount (if resolved)
        "contact",      # Contact for lien holder
        "source_doc",   # Source document ID
    ])


# ==================== MAIN CASE DATA CLASS ====================

class CaseData:
    """
    Hybrid JSON + Tabular data model for legal cases.
    
    JSON (structured, nested):
    - meta: Case identity, type, status, timestamps
    - parties: Plaintiff and defendant information
    - incident: What, when, where, how
    - injuries: List of injuries with severity
    - evidence_checklist: List of required evidence with status
    - damages: Calculated totals and settlement range
    
    Tabular (DataFrames - line-item, queryable):
    - medical_expenses: Date, provider, service, amount, paid_by
    - lost_wages: Period, employer, amount, type
    - witnesses: Name, relationship, contact, statement
    - timeline: Date, event, source, significance
    - liens: Holder, type, amount, status
    """
    
    def __init__(self, case_id: Optional[str] = None):
        # JSON structures
        self.meta = CaseMeta(id=case_id) if case_id else CaseMeta()
        self.parties = Parties()
        self.incident = Incident()
        self.injuries: List[Injury] = []
        self.evidence_checklist: List[EvidenceItem] = []
        self.damages = Damages()
        
        # Tabular structures (DataFrames)
        self.medical_expenses = create_medical_expenses_df()
        self.lost_wages = create_lost_wages_df()
        self.witnesses = create_witnesses_df()
        self.timeline = create_timeline_df()
        self.liens = create_liens_df()
    
    # ==================== JSON UPDATE METHODS ====================
    
    def update_meta(self, **kwargs) -> None:
        """Update case metadata."""
        for key, value in kwargs.items():
            if hasattr(self.meta, key):
                setattr(self.meta, key, value)
        self.meta.updated_at = datetime.now()
    
    def update_plaintiff(self, **kwargs) -> None:
        """Update plaintiff information."""
        for key, value in kwargs.items():
            if hasattr(self.parties.plaintiff, key):
                setattr(self.parties.plaintiff, key, value)
        self.meta.updated_at = datetime.now()
    
    def update_defendant(self, **kwargs) -> None:
        """Update defendant information."""
        for key, value in kwargs.items():
            if hasattr(self.parties.defendant, key):
                setattr(self.parties.defendant, key, value)
        self.meta.updated_at = datetime.now()
    
    def update_incident(self, **kwargs) -> None:
        """Update incident details."""
        for key, value in kwargs.items():
            if hasattr(self.incident, key):
                setattr(self.incident, key, value)
        self.meta.updated_at = datetime.now()
    
    def add_injury(self, injury_type: str, **kwargs) -> Injury:
        """Add an injury to the case."""
        injury = Injury(type=injury_type, **kwargs)
        self.injuries.append(injury)
        self.meta.updated_at = datetime.now()
        return injury
    
    def update_damages(self, **kwargs) -> None:
        """Update damages calculations."""
        for key, value in kwargs.items():
            if hasattr(self.damages, key):
                setattr(self.damages, key, value)
        self.meta.updated_at = datetime.now()
    
    # ==================== EVIDENCE CHECKLIST METHODS ====================
    
    def add_evidence_item(
        self,
        evidence_type: str,
        description: str,
        priority: EvidencePriority = EvidencePriority.IMPORTANT
    ) -> EvidenceItem:
        """Add an evidence item to the checklist."""
        item_id = f"{evidence_type}_{len(self.evidence_checklist)}"
        item = EvidenceItem(
            id=item_id,
            type=evidence_type,
            description=description,
            priority=priority
        )
        self.evidence_checklist.append(item)
        self.meta.updated_at = datetime.now()
        return item
    
    def get_evidence_item(self, item_id: str) -> Optional[EvidenceItem]:
        """Get evidence item by ID."""
        for item in self.evidence_checklist:
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
        """Update evidence item status."""
        item = self.get_evidence_item(item_id)
        if not item:
            return False
        
        item.status = status
        if document_path:
            item.document_path = document_path
            item.uploaded_at = datetime.now()
        if analysis_summary:
            item.analysis_summary = analysis_summary
        
        self.meta.updated_at = datetime.now()
        return True
    
    def get_pending_evidence(self) -> List[EvidenceItem]:
        """Get evidence items still needed."""
        return [
            item for item in self.evidence_checklist
            if item.status in [EvidenceStatus.REQUIRED, EvidenceStatus.PENDING]
        ]
    
    def get_required_evidence(self) -> List[EvidenceItem]:
        """Get evidence items in REQUIRED status (not yet addressed)."""
        return [
            item for item in self.evidence_checklist
            if item.status == EvidenceStatus.REQUIRED
        ]
    
    def is_intake_complete(self) -> bool:
        """Check if all evidence has been addressed."""
        required = self.get_required_evidence()
        return len(required) == 0 and len(self.evidence_checklist) > 0
    
    # ==================== TABULAR DATA METHODS ====================
    
    def add_medical_expense(
        self,
        date: str,
        provider: str,
        service: str,
        amount: float,
        paid_by: str = "pending",
        paid_amount: float = 0.0,
        status: str = "pending",
        source_doc: Optional[str] = None
    ) -> str:
        """Add a medical expense line item."""
        expense_id = f"med_{len(self.medical_expenses)}"
        new_row = pd.DataFrame([{
            "id": expense_id,
            "date": date,
            "provider": provider,
            "service": service,
            "amount": amount,
            "paid_by": paid_by,
            "paid_amount": paid_amount,
            "status": status,
            "source_doc": source_doc,
        }])
        self.medical_expenses = pd.concat([self.medical_expenses, new_row], ignore_index=True)
        self.meta.updated_at = datetime.now()
        return expense_id
    
    def add_lost_wage(
        self,
        period_start: str,
        period_end: str,
        employer: str,
        amount: float,
        wage_type: str = "past_wages",
        hourly_rate: Optional[float] = None,
        hours_missed: Optional[int] = None,
        verified: bool = False,
        source_doc: Optional[str] = None
    ) -> str:
        """Add a lost wage line item."""
        wage_id = f"wage_{len(self.lost_wages)}"
        new_row = pd.DataFrame([{
            "id": wage_id,
            "period_start": period_start,
            "period_end": period_end,
            "employer": employer,
            "amount": amount,
            "type": wage_type,
            "hourly_rate": hourly_rate,
            "hours_missed": hours_missed,
            "verified": verified,
            "source_doc": source_doc,
        }])
        self.lost_wages = pd.concat([self.lost_wages, new_row], ignore_index=True)
        self.meta.updated_at = datetime.now()
        return wage_id
    
    def add_witness(
        self,
        name: str,
        relationship: str,
        contact_phone: Optional[str] = None,
        contact_email: Optional[str] = None,
        statement_summary: Optional[str] = None,
        statement_date: Optional[str] = None,
        credibility: str = "medium",
        source_doc: Optional[str] = None
    ) -> str:
        """Add a witness."""
        witness_id = f"witness_{len(self.witnesses)}"
        new_row = pd.DataFrame([{
            "id": witness_id,
            "name": name,
            "relationship": relationship,
            "contact_phone": contact_phone,
            "contact_email": contact_email,
            "statement_summary": statement_summary,
            "statement_date": statement_date,
            "credibility": credibility,
            "source_doc": source_doc,
        }])
        self.witnesses = pd.concat([self.witnesses, new_row], ignore_index=True)
        self.meta.updated_at = datetime.now()
        return witness_id
    
    def add_timeline_event(
        self,
        date: str,
        event: str,
        category: str = "general",
        time: Optional[str] = None,
        source_doc: Optional[str] = None,
        significance: str = "supporting",
        verified: bool = False
    ) -> str:
        """Add a timeline event."""
        event_id = f"event_{len(self.timeline)}"
        new_row = pd.DataFrame([{
            "id": event_id,
            "date": date,
            "time": time,
            "event": event,
            "category": category,
            "source_doc": source_doc,
            "significance": significance,
            "verified": verified,
        }])
        self.timeline = pd.concat([self.timeline, new_row], ignore_index=True)
        # Sort by date
        self.timeline = self.timeline.sort_values("date").reset_index(drop=True)
        self.meta.updated_at = datetime.now()
        return event_id
    
    def add_lien(
        self,
        holder: str,
        lien_type: str,
        amount: float,
        status: str = "asserted",
        resolution: Optional[float] = None,
        contact: Optional[str] = None,
        source_doc: Optional[str] = None
    ) -> str:
        """Add a lien."""
        lien_id = f"lien_{len(self.liens)}"
        new_row = pd.DataFrame([{
            "id": lien_id,
            "holder": holder,
            "type": lien_type,
            "amount": amount,
            "status": status,
            "resolution": resolution,
            "contact": contact,
            "source_doc": source_doc,
        }])
        self.liens = pd.concat([self.liens, new_row], ignore_index=True)
        self.meta.updated_at = datetime.now()
        return lien_id
    
    # ==================== CALCULATION METHODS ====================
    
    def calculate_total_medical_expenses(self) -> float:
        """Calculate total medical expenses."""
        if self.medical_expenses.empty:
            return 0.0
        return float(self.medical_expenses["amount"].sum())
    
    def calculate_total_lost_wages(self) -> float:
        """Calculate total lost wages."""
        if self.lost_wages.empty:
            return 0.0
        return float(self.lost_wages["amount"].sum())
    
    def calculate_total_liens(self) -> float:
        """Calculate total liens."""
        if self.liens.empty:
            return 0.0
        return float(self.liens["amount"].sum())
    
    def calculate_economic_damages(self) -> float:
        """Calculate total economic damages."""
        return self.calculate_total_medical_expenses() + self.calculate_total_lost_wages()
    
    def get_overall_severity(self) -> InjurySeverity:
        """Get the most severe injury severity."""
        if not self.injuries:
            return InjurySeverity.MODERATE
        
        severity_order = [InjurySeverity.MINOR, InjurySeverity.MODERATE, 
                         InjurySeverity.SERIOUS, InjurySeverity.SEVERE]
        max_severity = InjurySeverity.MINOR
        
        for injury in self.injuries:
            if severity_order.index(injury.severity) > severity_order.index(max_severity):
                max_severity = injury.severity
        
        return max_severity
    
    # ==================== SERIALIZATION ====================
    
    def to_dict(self) -> dict:
        """Convert entire case to dictionary (JSON-serializable)."""
        return {
            "meta": self.meta.to_dict(),
            "parties": self.parties.to_dict(),
            "incident": self.incident.to_dict(),
            "injuries": [injury.to_dict() for injury in self.injuries],
            "evidence_checklist": [item.to_dict() for item in self.evidence_checklist],
            "damages": self.damages.to_dict(),
            # Tabular data as records
            "medical_expenses": self.medical_expenses.to_dict(orient="records"),
            "lost_wages": self.lost_wages.to_dict(orient="records"),
            "witnesses": self.witnesses.to_dict(orient="records"),
            "timeline": self.timeline.to_dict(orient="records"),
            "liens": self.liens.to_dict(orient="records"),
        }
    
    def get_summary(self) -> dict:
        """Get a summary of the case."""
        return {
            "case_id": self.meta.id,
            "case_type": self.meta.type,
            "status": self.meta.status.value,
            "plaintiff": self.parties.plaintiff.name,
            "defendant": self.parties.defendant.name,
            "incident_date": self.incident.date,
            "injuries_count": len(self.injuries),
            "overall_severity": self.get_overall_severity().value,
            "evidence": {
                "total": len(self.evidence_checklist),
                "collected": len([i for i in self.evidence_checklist if i.status in [EvidenceStatus.UPLOADED, EvidenceStatus.ANALYZED]]),
                "pending": len([i for i in self.evidence_checklist if i.status == EvidenceStatus.PENDING]),
                "required": len([i for i in self.evidence_checklist if i.status == EvidenceStatus.REQUIRED]),
            },
            "financials": {
                "medical_expenses": self.calculate_total_medical_expenses(),
                "lost_wages": self.calculate_total_lost_wages(),
                "economic_total": self.calculate_economic_damages(),
                "liens": self.calculate_total_liens(),
            },
            "damages_estimate": self.damages.to_dict() if self.damages.economic_total else None,
            "intake_complete": self.is_intake_complete(),
        }
    
    # ==================== CHECKLIST TEMPLATES ====================
    
    def initialize_construction_fall_checklist(self) -> None:
        """Initialize checklist for construction fall case."""
        self.meta.type = "construction_fall"
        
        # Critical
        self.add_evidence_item("incident_report", "Employer's incident/accident report", EvidencePriority.CRITICAL)
        self.add_evidence_item("medical_records_er", "Emergency room records", EvidencePriority.CRITICAL)
        self.add_evidence_item("medical_records_primary", "Primary care or specialist records", EvidencePriority.CRITICAL)
        
        # Important
        self.add_evidence_item("witness_statements", "Witness statements", EvidencePriority.IMPORTANT)
        self.add_evidence_item("photos_scene", "Photos of accident scene", EvidencePriority.IMPORTANT)
        self.add_evidence_item("photos_injuries", "Photos of injuries", EvidencePriority.IMPORTANT)
        self.add_evidence_item("employment_records", "Pay stubs/employment records", EvidencePriority.IMPORTANT)
        self.add_evidence_item("safety_training", "Safety training records", EvidencePriority.IMPORTANT)
        self.add_evidence_item("workers_comp_claim", "Workers' comp claim documents", EvidencePriority.IMPORTANT)
        
        # Helpful
        self.add_evidence_item("osha_report", "OSHA investigation report", EvidencePriority.HELPFUL)
        self.add_evidence_item("medical_imaging", "X-rays, MRI, CT scans", EvidencePriority.HELPFUL)
        self.add_evidence_item("physical_therapy", "Physical therapy records", EvidencePriority.HELPFUL)
        self.add_evidence_item("medical_bills", "Medical bills and invoices", EvidencePriority.HELPFUL)
    
    def initialize_generic_workplace_checklist(self) -> None:
        """Initialize checklist for generic workplace injury."""
        self.meta.type = "workplace_injury"
        
        self.add_evidence_item("incident_report", "Incident/accident report", EvidencePriority.CRITICAL)
        self.add_evidence_item("medical_records", "Medical records documenting injury", EvidencePriority.CRITICAL)
        self.add_evidence_item("employment_records", "Proof of employment and wages", EvidencePriority.IMPORTANT)
        self.add_evidence_item("witness_info", "Witness contact/statements", EvidencePriority.IMPORTANT)
        self.add_evidence_item("photos", "Relevant photos", EvidencePriority.HELPFUL)
    
    def reset(self) -> None:
        """Reset case data to initial state."""
        self.__init__(case_id=self.meta.id)


# ==================== EXPORTS ====================

__all__ = [
    "CaseData",
    "CaseMeta",
    "Parties",
    "Party",
    "Incident",
    "Injury",
    "Damages",
    "EvidenceItem",
    "CaseStatus",
    "InjurySeverity",
    "EvidenceStatus",
    "EvidencePriority",
]

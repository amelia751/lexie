"""
Firestore Persistence Service

Persists case data (facts, evidence checklist, transcript) to Cloud Firestore
so sessions survive Gemini Live API disconnections.

Collection: cases/{caseId}
"""

import asyncio
import logging
import time
from datetime import datetime
from typing import Optional

from google.cloud import firestore
from google.oauth2 import service_account

from app.config import settings

logger = logging.getLogger(__name__)

# Default case ID used for the single-user demo flow
DEFAULT_CASE_ID = "current_case"

# Minimum seconds between Firestore writes (debounce)
_SAVE_DEBOUNCE_SECONDS = 1.5


class FirestoreService:
    """
    Manages persistence of case data to Cloud Firestore.
    
    Uses a single document per case under the `cases` collection.
    Auto-debounces writes to avoid excessive Firestore operations.
    """

    def __init__(self):
        self._db: Optional[firestore.Client] = None
        self._collection = "cases"
        self._last_save_time: float = 0
        self._pending_save: Optional[asyncio.Task] = None
        self._initialized = False

    def _ensure_client(self) -> firestore.Client:
        """Lazily initialize the Firestore client."""
        if self._db is None:
            try:
                from pathlib import Path
                creds_path = Path(__file__).parent.parent.parent / settings.google_application_credentials
                if creds_path.exists():
                    creds = service_account.Credentials.from_service_account_file(
                        str(creds_path.resolve())
                    )
                    self._db = firestore.Client(
                        project=settings.gcp_project_id,
                        credentials=creds,
                    )
                else:
                    # Fall back to default credentials
                    self._db = firestore.Client(project=settings.gcp_project_id)
                self._initialized = True
                logger.info(f"✓ Firestore client initialized (project: {settings.gcp_project_id})")
            except Exception as e:
                logger.error(f"Failed to initialize Firestore: {e}")
                raise
        return self._db

    # ===== Core CRUD =====

    def save_case(self, case_id: str, data: dict) -> bool:
        """
        Save case data to Firestore (synchronous).
        
        Args:
            case_id: The case document ID
            data: Full case dict (facts, checklist, caseType, transcript, etc.)
        
        Returns:
            True if saved successfully
        """
        try:
            db = self._ensure_client()
            doc_ref = db.collection(self._collection).document(case_id)
            
            # Add metadata
            data["updatedAt"] = datetime.utcnow().isoformat()
            if not data.get("createdAt"):
                data["createdAt"] = datetime.utcnow().isoformat()
            
            doc_ref.set(data, merge=True)
            self._last_save_time = time.time()
            logger.debug(f"Saved case {case_id} to Firestore")
            return True
        except Exception as e:
            logger.error(f"Failed to save case {case_id}: {e}")
            return False

    def load_case(self, case_id: str) -> Optional[dict]:
        """
        Load case data from Firestore.
        
        Args:
            case_id: The case document ID
            
        Returns:
            Case dict or None if not found
        """
        try:
            db = self._ensure_client()
            doc_ref = db.collection(self._collection).document(case_id)
            doc = doc_ref.get()
            
            if doc.exists:
                data = doc.to_dict()
                logger.info(f"Loaded case {case_id} from Firestore (type={data.get('caseType', 'unknown')})")
                return data
            else:
                logger.info(f"No existing case found for {case_id}")
                return None
        except Exception as e:
            logger.error(f"Failed to load case {case_id}: {e}")
            return None

    def delete_case(self, case_id: str) -> bool:
        """
        Delete a case from Firestore.
        
        Args:
            case_id: The case document ID
            
        Returns:
            True if deleted successfully
        """
        try:
            db = self._ensure_client()
            doc_ref = db.collection(self._collection).document(case_id)
            doc_ref.delete()
            logger.info(f"Deleted case {case_id} from Firestore")
            return True
        except Exception as e:
            logger.error(f"Failed to delete case {case_id}: {e}")
            return False

    def case_exists(self, case_id: str) -> bool:
        """Check if a case exists in Firestore."""
        try:
            db = self._ensure_client()
            doc_ref = db.collection(self._collection).document(case_id)
            return doc_ref.get().exists
        except Exception:
            return False

    # ===== Debounced save for frequent updates =====

    def save_case_debounced(self, case_id: str, data: dict) -> None:
        """
        Save case data with debouncing — avoids excessive writes during
        rapid tool calls (e.g., multi-doc upload).
        
        If called within _SAVE_DEBOUNCE_SECONDS of the last save,
        schedules a deferred save instead.
        """
        now = time.time()
        elapsed = now - self._last_save_time

        if elapsed >= _SAVE_DEBOUNCE_SECONDS:
            # Enough time has passed — save immediately
            self.save_case(case_id, data)
        else:
            # Schedule a deferred save
            remaining = _SAVE_DEBOUNCE_SECONDS - elapsed
            if self._pending_save is not None:
                try:
                    self._pending_save.cancel()
                except Exception:
                    pass
            
            try:
                loop = asyncio.get_event_loop()
                self._pending_save = loop.call_later(
                    remaining,
                    lambda: self.save_case(case_id, data),
                )
            except RuntimeError:
                # No event loop — save synchronously
                self.save_case(case_id, data)

    # ===== High-level helpers =====

    def _build_hub_data(self) -> dict:
        """Build the data dict from current evidence_hub state."""
        from app.services.evidence_hub import evidence_hub
        
        return {
            "caseType": evidence_hub._case_type,
            "facts": evidence_hub.facts.to_dict(),
            "checklist": [item.to_dict() for item in evidence_hub.checklist],
            "currentlyRequested": evidence_hub._currently_requested,
            "transcript": evidence_hub.transcript,  # Chat history
            "uploadedFiles": evidence_hub.uploaded_files,  # Uploaded file metadata
        }

    def save_evidence_hub(self, case_id: str = DEFAULT_CASE_ID) -> bool:
        """
        Serialize the current evidence_hub state and save to Firestore.
        Called after tool calls that modify case state.
        """
        return self.save_case(case_id, self._build_hub_data())

    def save_evidence_hub_debounced(self, case_id: str = DEFAULT_CASE_ID) -> None:
        """Debounced version of save_evidence_hub."""
        self.save_case_debounced(case_id, self._build_hub_data())

    def load_into_evidence_hub(self, case_id: str = DEFAULT_CASE_ID) -> bool:
        """
        Load case from Firestore and restore into the evidence_hub singleton.
        
        Returns:
            True if a case was loaded, False if no case found
        """
        from app.services.evidence_hub import (
            evidence_hub, EvidenceItem, EvidenceStatus, EvidencePriority, CaseFacts
        )
        
        data = self.load_case(case_id)
        if not data:
            return False
        
        # Restore case type
        evidence_hub._case_type = data.get("caseType")
        
        # Restore facts
        facts_dict = data.get("facts", {})
        facts = CaseFacts()
        
        # Map nested Firestore dict back to flat CaseFacts fields
        plaintiff = facts_dict.get("plaintiff", {})
        if plaintiff:
            facts.plaintiff_name = plaintiff.get("name")
            facts.plaintiff_age = plaintiff.get("age")
            facts.plaintiff_occupation = plaintiff.get("occupation")
        
        employer = facts_dict.get("employer", {})
        if employer:
            facts.employer_name = employer.get("name")
            facts.employer_type = employer.get("type")
        
        incident = facts_dict.get("incident", {})
        if incident:
            facts.incident_date = incident.get("date")
            facts.incident_location = incident.get("location")
            facts.incident_description = incident.get("description")
            facts.incident_type = incident.get("type")
        
        injuries = facts_dict.get("injuries", {})
        if injuries:
            facts.injuries = injuries.get("list", [])
            facts.injury_severity = injuries.get("severity")
        
        medical = facts_dict.get("medical", {})
        if medical:
            facts.medical_providers = medical.get("providers", [])
            facts.medical_expenses = medical.get("expenses")
            facts.future_medical_estimate = medical.get("future_estimate")
        
        employment = facts_dict.get("employment_impact", {})
        if employment:
            facts.days_missed_work = employment.get("days_missed")
            facts.lost_wages = employment.get("lost_wages")
            facts.can_return_to_work = employment.get("can_return")
            facts.work_restrictions = employment.get("restrictions", [])
        
        facts.witnesses = facts_dict.get("witnesses", [])
        
        safety = facts_dict.get("safety", {})
        if safety:
            facts.safety_violations = safety.get("violations", [])
            facts.osha_citations = safety.get("osha_citations", [])
        
        insurance = facts_dict.get("insurance", {})
        if insurance:
            facts.workers_comp_filed = insurance.get("workers_comp_filed")
            facts.workers_comp_claim_number = insurance.get("claim_number")
            facts.health_insurance = insurance.get("health_insurance")
        
        damages = facts_dict.get("damages", {})
        if damages:
            facts.economic_damages = damages.get("economic")
            facts.non_economic_damages = damages.get("non_economic")
            facts.total_damages_estimate = damages.get("total_estimate")
            settlement = damages.get("settlement_range", {})
            if settlement:
                facts.settlement_range_low = settlement.get("low")
                facts.settlement_range_high = settlement.get("high")
        
        facts.source_files = facts_dict.get("source_files", {})
        
        evidence_hub.facts = facts
        
        # Restore checklist
        checklist_data = data.get("checklist", [])
        evidence_hub.checklist = []
        for item_dict in checklist_data:
            item = EvidenceItem(
                id=item_dict["id"],
                type=item_dict["type"],
                description=item_dict["description"],
                status=EvidenceStatus(item_dict.get("status", "required")),
                priority=EvidencePriority(item_dict.get("priority", "important")),
                document_path=item_dict.get("document_path"),
                analysis_summary=item_dict.get("analysis_summary"),
            )
            # Restore datetime fields
            if item_dict.get("uploaded_at"):
                try:
                    item.uploaded_at = datetime.fromisoformat(item_dict["uploaded_at"])
                except (ValueError, TypeError):
                    pass
            if item_dict.get("analyzed_at"):
                try:
                    item.analyzed_at = datetime.fromisoformat(item_dict["analyzed_at"])
                except (ValueError, TypeError):
                    pass
            evidence_hub.checklist.append(item)
        
        # Restore transcript
        evidence_hub.transcript = data.get("transcript", [])
        
        # Restore uploaded files metadata
        evidence_hub.uploaded_files = data.get("uploadedFiles", [])
        
        logger.info(
            f"Restored case from Firestore: type={evidence_hub._case_type}, "
            f"checklist={len(evidence_hub.checklist)} items, "
            f"injuries={len(facts.injuries)}, "
            f"transcript={len(evidence_hub.transcript)} messages, "
            f"files={len(evidence_hub.uploaded_files)}"
        )
        return True

    def build_context_summary(self, case_id: str = DEFAULT_CASE_ID) -> Optional[str]:
        """
        Build a text summary of the current case for injecting into Gemini
        as context when resuming a session.
        
        Returns:
            Context string, or None if no case data
        """
        from app.services.evidence_hub import evidence_hub, EvidenceStatus
        
        if not evidence_hub._case_type and not evidence_hub.checklist:
            return None
        
        facts = evidence_hub.facts
        parts = []
        
        parts.append(f"[SYSTEM CONTEXT - RESUMING CASE]")
        parts.append(f"Case type: {evidence_hub._case_type or 'unknown'}")
        
        if facts.incident_date:
            parts.append(f"Incident date: {facts.incident_date}")
        if facts.incident_location:
            parts.append(f"Location: {facts.incident_location}")
        if facts.incident_description:
            parts.append(f"Description: {facts.incident_description}")
        
        if facts.injuries:
            parts.append(f"Injuries: {', '.join(facts.injuries)}")
        
        if facts.medical_expenses:
            parts.append(f"Medical expenses so far: ${facts.medical_expenses:,.2f}")
        
        if facts.plaintiff_name:
            parts.append(f"Plaintiff: {facts.plaintiff_name}")
        if facts.employer_name:
            parts.append(f"Employer: {facts.employer_name}")
        
        # Evidence status
        uploaded = [i for i in evidence_hub.checklist if i.status == EvidenceStatus.UPLOADED]
        not_avail = [i for i in evidence_hub.checklist if i.status == EvidenceStatus.NOT_AVAILABLE]
        required = [i for i in evidence_hub.checklist if i.status == EvidenceStatus.REQUIRED]
        
        if uploaded:
            parts.append(f"Evidence uploaded: {', '.join(i.description for i in uploaded)}")
        if not_avail:
            parts.append(f"Evidence not available: {', '.join(i.description for i in not_avail)}")
        if required:
            parts.append(f"Evidence still needed: {', '.join(i.description for i in required)}")
            parts.append(f"Next evidence to request: {required[0].description}")
        
        if evidence_hub.is_intake_complete():
            parts.append("STATUS: All evidence has been addressed. Intake is complete.")
        else:
            parts.append("STATUS: Intake is in progress. Continue collecting evidence.")
        
        parts.append("[END CONTEXT - Continue the conversation naturally, acknowledging you're picking up where you left off]")
        
        return "\n".join(parts)


# Singleton instance
firestore_service = FirestoreService()

__all__ = [
    "FirestoreService",
    "firestore_service",
    "DEFAULT_CASE_ID",
]

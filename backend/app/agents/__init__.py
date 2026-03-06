"""
Lexie Legal Agents

ADK-based multi-agent system for the Lexie legal intake assistant.

Agents:
- live_agent: Voice-facing root agent for intake conversations
- root_agent: Text-based chat agent
- evidence_agent: Analyzes documents and images
- damages_agent: Calculates settlement estimates
"""

from .live_agent import root_agent, live_agent, get_orchestrator_agent
from .evidence_agent import evidence_agent
from .damages_agent import damages_agent

__all__ = [
    "root_agent",
    "live_agent",
    "get_orchestrator_agent",
    "evidence_agent",
    "damages_agent",
]

"""
Comprehensive User Simulation Test

Simulates real user interactions with the Lexie agent system.
Tests various scenarios including:
- Normal intake flow
- User doesn't have evidence
- User will provide later
- Edge cases and error handling
"""

import asyncio
import sys
from pathlib import Path
from typing import Optional

# Add the backend directory to the Python path
sys.path.insert(0, str(Path(__file__).parent))

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from app.agents.live_agent import root_agent, HUB_TOOLS, check_intake_complete
from app.services.evidence_hub import evidence_hub, EvidenceStatus
from app.config import settings

# Setup credentials
settings.setup_credentials()

APP_NAME = "lexie_user_simulation"
USER_ID = "simulated_user"

session_service = InMemorySessionService()


async def simulate_conversation(messages: list[str], scenario_name: str) -> dict:
    """
    Simulate a conversation with the agent.
    
    Args:
        messages: List of user messages to send
        scenario_name: Name of this test scenario
    
    Returns:
        Dict with results and any issues found
    """
    print(f"\n{'='*70}")
    print(f"  SCENARIO: {scenario_name}")
    print(f"{'='*70}")
    
    # Reset state
    evidence_hub.reset()
    
    # Create fresh session
    session = await session_service.create_session(
        app_name=APP_NAME,
        user_id=USER_ID,
    )
    
    runner = Runner(
        app_name=APP_NAME,
        agent=root_agent,
        session_service=session_service,
    )
    
    results = {
        "scenario": scenario_name,
        "messages_sent": len(messages),
        "responses": [],
        "tool_calls": [],
        "errors": [],
        "final_state": None,
    }
    
    for i, user_msg in enumerate(messages, 1):
        print(f"\n[{i}/{len(messages)}] 👤 User: {user_msg}")
        
        content = types.Content(role='user', parts=[types.Part(text=user_msg)])
        
        try:
            response_text = ""
            tool_calls_this_turn = []
            
            async for event in runner.run_async(
                user_id=USER_ID,
                session_id=session.id,
                new_message=content
            ):
                if event.is_final_response():
                    if event.content and event.content.parts:
                        response_text = event.content.parts[0].text
                    break
                elif hasattr(event, 'tool_use') and event.tool_use:
                    tool_name = event.tool_use.tool_name
                    tool_args = event.tool_use.tool_args
                    tool_calls_this_turn.append({"tool": tool_name, "args": tool_args})
                    print(f"   🔧 Tool: {tool_name}({str(tool_args)[:50]}...)")
            
            # Truncate response for display
            display_response = response_text[:300] + "..." if len(response_text) > 300 else response_text
            print(f"   🤖 Lexie: {display_response}")
            
            results["responses"].append(response_text)
            results["tool_calls"].extend(tool_calls_this_turn)
            
        except Exception as e:
            error_msg = f"Error on message {i}: {str(e)}"
            print(f"   ❌ {error_msg}")
            results["errors"].append(error_msg)
    
    # Capture final state
    results["final_state"] = {
        "case_type": evidence_hub._case_type,
        "checklist_status": evidence_hub.get_checklist_status() if evidence_hub.checklist else None,
        "facts": evidence_hub.get_facts() if evidence_hub.facts else None,
        "is_complete": evidence_hub.is_intake_complete() if evidence_hub.checklist else False,
    }
    
    return results


async def test_scenario_1_normal_intake():
    """Test: Normal intake flow - user provides all info."""
    messages = [
        "Hi, I was injured at work last week.",
        "I'm Maria Santos, I'm 34 years old. I work as a construction worker for Titan Construction.",
        "I fell from scaffolding on January 15th at the construction site on Industrial Ave. The scaffolding wasn't secured properly.",
        "I broke my arm and got a concussion. I've been to the ER and had surgery.",
        "My medical bills are about $67,000 so far. I've missed 2 months of work and lost about $20,000 in wages.",
        "The injury is pretty serious - I had to have surgery and I'm still in physical therapy.",
    ]
    return await simulate_conversation(messages, "Normal Intake Flow")


async def test_scenario_2_user_missing_info():
    """Test: User doesn't know some information."""
    messages = [
        "Hello, I got hurt at my job.",
        "My name is John Doe. I'm not sure exactly how old I am on my records... maybe 45?",
        "I slipped and fell at the warehouse. I don't remember the exact date, it was sometime last month.",
        "I hurt my back. I went to urgent care but I don't have the bills with me.",
        "I don't know how much my medical expenses are. My employer handles workers comp.",
        "I'm not sure about lost wages either. I've been out for a few weeks.",
    ]
    return await simulate_conversation(messages, "User Missing Information")


async def test_scenario_3_evidence_flow():
    """Test: Evidence collection with mixed responses."""
    messages = [
        "I was injured at work and need help with my case.",
        "I'm Sarah Kim, 28, I work at ABC Manufacturing as a machine operator. I got my hand caught in equipment on February 1st.",
        "I have severe lacerations on my right hand. Had surgery, about $45,000 in bills. Lost 6 weeks of work, about $8,000 in wages.",
        "Yes, I have the incident report from my employer.",
        "I don't have the ER records with me right now, but I can get them later.",
        "No, I don't have any photos of my injuries.",
        "I have one witness - my coworker Tom who was there when it happened.",
    ]
    return await simulate_conversation(messages, "Evidence Collection Flow")


async def test_scenario_4_interruption_simulation():
    """Test: User changes topic or provides partial info."""
    messages = [
        "Hi I need help",
        "Actually wait, let me explain - I fell at work",
        "Sorry, my name is Mike. Mike Johnson. I'm 52.",
        "The fall happened at the construction site. Oh, and I work for BuildRight Inc.",
        "I hurt my knee and my shoulder. The knee is worse - might need surgery.",
        "How much could my case be worth?",  # User asks about damages before full intake
    ]
    return await simulate_conversation(messages, "Interruption/Topic Change")


async def test_scenario_5_edge_case_minimal_info():
    """Test: User provides very minimal information."""
    messages = [
        "hurt at work",
        "fell",
        "arm",
        "don't know",
        "no",
    ]
    return await simulate_conversation(messages, "Minimal Information")


async def test_scenario_6_detailed_user():
    """Test: User provides very detailed information upfront."""
    messages = [
        """Hi, I'm filing a workplace injury claim. Here's all my info:
        - Name: Robert Chen, Age: 41, Construction Foreman
        - Employer: Mega Construction Corp
        - Incident: March 15, 2025 at 2:30 PM at 456 Main St construction site
        - What happened: Fell 20 feet from scaffolding due to missing safety rails
        - Injuries: Broken leg (tibia fracture), broken ribs, concussion
        - Medical: ER visit ($12,000), Surgery ($85,000), PT ongoing ($5,000 so far)
        - Lost wages: Out for 4 months, normally make $75/hour, about $48,000 lost
        - Witnesses: 3 coworkers saw it happen
        - I have all documentation ready to upload""",
    ]
    return await simulate_conversation(messages, "Detailed User Upfront")


async def run_all_tests():
    """Run all test scenarios and summarize results."""
    print("\n" + "="*70)
    print("  LEXIE COMPREHENSIVE USER SIMULATION TEST")
    print("="*70)
    
    scenarios = [
        test_scenario_1_normal_intake,
        test_scenario_2_user_missing_info,
        test_scenario_3_evidence_flow,
        test_scenario_4_interruption_simulation,
        test_scenario_5_edge_case_minimal_info,
        test_scenario_6_detailed_user,
    ]
    
    all_results = []
    
    for scenario_fn in scenarios:
        try:
            result = await scenario_fn()
            all_results.append(result)
        except Exception as e:
            print(f"\n❌ SCENARIO FAILED: {e}")
            all_results.append({
                "scenario": scenario_fn.__name__,
                "errors": [str(e)],
                "final_state": None,
            })
    
    # Summary
    print("\n" + "="*70)
    print("  TEST SUMMARY")
    print("="*70)
    
    total_errors = 0
    for result in all_results:
        scenario = result.get("scenario", "Unknown")
        errors = result.get("errors", [])
        final_state = result.get("final_state", {})
        tool_calls = result.get("tool_calls", [])
        
        status = "✅ PASS" if not errors else "❌ FAIL"
        print(f"\n{status} {scenario}")
        print(f"   Messages: {result.get('messages_sent', 0)}")
        print(f"   Tool Calls: {len(tool_calls)}")
        
        if final_state:
            print(f"   Case Type: {final_state.get('case_type', 'Not set')}")
            if final_state.get('checklist_status'):
                cs = final_state['checklist_status']
                print(f"   Evidence: {cs.get('uploaded', 0) + cs.get('analyzed', 0)}/{cs.get('total', 0)} collected")
            print(f"   Intake Complete: {final_state.get('is_complete', False)}")
        
        if errors:
            total_errors += len(errors)
            for err in errors:
                print(f"   ⚠️ {err}")
    
    print("\n" + "="*70)
    print(f"  TOTAL: {len(all_results)} scenarios, {total_errors} errors")
    print("="*70)
    
    return all_results


if __name__ == "__main__":
    asyncio.run(run_all_tests())

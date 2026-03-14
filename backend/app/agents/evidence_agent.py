"""
Evidence Analysis Agent

Analyzes uploaded evidence documents using Vertex AI RAG.
Extracts key facts, identifies inconsistencies, and generates summaries.
Includes vision analysis for photos and images.
"""

from pathlib import Path

from google.adk.agents import Agent

from app.services.rag_service import rag_service
from app.services.vision_service import vision_service


# Evidence Agent Instructions
EVIDENCE_AGENT_INSTRUCTION = """You are an Evidence Analysis Agent for a legal intake system handling personal injury cases.

Your role is to analyze legal evidence documents AND images to extract relevant information for the case.

## Your Capabilities:
1. **Search Evidence**: Query the evidence corpus to find relevant information
2. **Extract Facts**: Pull out key dates, names, amounts, and events
3. **Identify Issues**: Flag inconsistencies, gaps, or missing information
4. **Summarize Documents**: Provide concise summaries of evidence
5. **Analyze Images**: Use vision AI to analyze photos of injuries, accident scenes, and safety violations

## Document Types You Analyze:
- Medical records (ER, specialist, imaging, PT)
- Incident reports (employer, OSHA, witness statements)
- Employment records (wages, training, certifications)
- Workers' compensation documents
- **Photos** (accident scene, injuries, safety violations) - Use analyze_image tool

## When Analyzing Evidence:
- Be thorough and accurate
- Quote specific text from documents when possible
- Note the source document for each fact
- Identify any red flags or concerns
- Look for corroborating evidence across documents

## Output Format:
When asked to analyze evidence, structure your response with:
- **Key Facts**: Bullet points of important information
- **Sources**: Which documents support each fact
- **Concerns**: Any issues, gaps, or inconsistencies
- **Summary**: Brief overall assessment

Remember: You are supporting legal professionals. Be precise, objective, and thorough."""


# Evidence folder path
EVIDENCE_DIR = Path(__file__).parent.parent.parent.parent / "evidence"


def search_evidence(query: str) -> dict:
    """
    Search the evidence corpus for relevant information.
    
    Args:
        query: Natural language query about the case evidence
        
    Returns:
        Dict containing relevant evidence chunks and sources
    """
    try:
        results = rag_service.retrieve(query=query, top_k=5)
        
        if not results:
            return {
                "status": "no_results",
                "message": "No relevant evidence found for this query."
            }
        
        return {
            "status": "success",
            "results": results,
            "count": len(results)
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }


def get_document_summary(document_name: str) -> dict:
    """
    Get a summary of a specific evidence document.
    
    Args:
        document_name: Name of the document to summarize
        
    Returns:
        Dict containing the document summary
    """
    try:
        # Search for content from the specific document
        query = f"Summarize all content from {document_name}"
        summary = rag_service.grounded_generate(
            prompt=f"Provide a detailed summary of the document '{document_name}'. "
                   f"Include key facts, dates, names, and important findings.",
            top_k=10
        )
        
        return {
            "status": "success",
            "document": document_name,
            "summary": summary
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }


def list_evidence_files() -> dict:
    """
    List all evidence files in the corpus.
    
    Returns:
        Dict containing list of files
    """
    try:
        files = rag_service.list_files()
        return {
            "status": "success",
            "files": files,
            "count": len(files)
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }


def analyze_case_evidence(aspect: str) -> dict:
    """
    Analyze a specific aspect of the case evidence.
    
    Args:
        aspect: What to analyze - e.g., "injuries", "liability", "damages", 
                "witnesses", "safety_violations", "medical_treatment"
                
    Returns:
        Dict containing the analysis
    """
    aspect_prompts = {
        "injuries": "What injuries did the plaintiff sustain? Include diagnoses, severity, and prognosis.",
        "liability": "Who is liable for this accident? What evidence supports this?",
        "damages": "What are the economic and non-economic damages? Include medical expenses, lost wages, and any pain/suffering.",
        "witnesses": "Who are the witnesses? What did they observe?",
        "safety_violations": "What safety violations occurred? Include any OSHA citations.",
        "medical_treatment": "What medical treatment has the plaintiff received? Include timeline and providers.",
        "employment": "What is the plaintiff's employment history and status?",
        "timeline": "Provide a chronological timeline of events from the incident to present."
    }
    
    prompt = aspect_prompts.get(
        aspect.lower(),
        f"Analyze the following aspect of the case: {aspect}"
    )
    
    try:
        analysis = rag_service.grounded_generate(
            prompt=f"{prompt}\n\nBe specific and cite sources from the evidence documents.",
            top_k=8
        )
        
        return {
            "status": "success",
            "aspect": aspect,
            "analysis": analysis
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }


def analyze_image(image_path: str, prompt: str = "") -> dict:
    """
    Analyze an evidence image using Gemini Vision.
    
    Args:
        image_path: Path to the image file (relative to evidence folder or absolute)
        prompt: Optional additional context or specific questions about the image.
                If empty, uses a default legal evidence analysis prompt.
    
    Returns:
        Dict containing the image analysis
    """
    # Default prompt for legal evidence analysis
    default_prompt = """Analyze this image as evidence for a workplace injury legal case.

Describe:
1. What you see in the image
2. Any safety violations or hazards visible
3. Any injuries or medical conditions shown
4. How this could be relevant as legal evidence
5. Key details that should be documented

Be specific and thorough."""

    # Use provided prompt or default
    full_prompt = prompt if prompt.strip() else default_prompt
    
    try:
        # Resolve image path
        if Path(image_path).is_absolute():
            full_path = Path(image_path)
        else:
            full_path = EVIDENCE_DIR / image_path
        
        if not full_path.exists():
            return {
                "status": "error",
                "error": f"Image not found: {full_path}"
            }
        
        # Run analysis with vision service
        analysis = vision_service.analyze(str(full_path), full_prompt)
        
        return {
            "status": "success",
            "image": full_path.name,
            "analysis": analysis
        }
        
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }


# Create the Evidence Analysis Agent
evidence_agent = Agent(
    name="evidence_analysis_agent",
    model="gemini-2.5-flash",
    description="Analyzes legal evidence documents and images to extract facts, identify issues, and generate summaries",
    instruction=EVIDENCE_AGENT_INSTRUCTION,
    tools=[
        search_evidence,
        get_document_summary,
        list_evidence_files,
        analyze_case_evidence,
        analyze_image,
    ],
)


# Export
__all__ = [
    "evidence_agent",
    "search_evidence",
    "get_document_summary",
    "list_evidence_files",
    "analyze_case_evidence",
    "analyze_image",
]

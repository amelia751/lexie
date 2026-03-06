#!/usr/bin/env python3
"""
Test Vertex AI RAG Engine for Lexie Legal Evidence

This uses Google's managed RAG service (vertexai.preview.rag).
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import vertexai
from vertexai.preview import rag
from vertexai.preview.generative_models import GenerativeModel, Tool

# Setup credentials
from app.config import settings
settings.setup_credentials()

# Evidence folder
EVIDENCE_DIR = Path(__file__).parent.parent / "evidence"

# Corpus name
CORPUS_DISPLAY_NAME = "lexie-legal-evidence"


def main():
    print("=" * 60)
    print("VERTEX AI RAG ENGINE TEST")
    print("=" * 60)
    
    # Initialize Vertex AI
    # Note: RAG Engine requires specific regions - trying europe-west4
    RAG_LOCATION = "europe-west4"
    
    print("\n1. Initializing Vertex AI...")
    vertexai.init(
        project=settings.gcp_project_id,
        location=RAG_LOCATION  # RAG Engine available regions
    )
    print(f"   ✅ Initialized (project: {settings.gcp_project_id}, location: {RAG_LOCATION})")
    
    # List existing corpora
    print("\n2. Checking for existing corpora...")
    existing_corpora = rag.list_corpora()
    corpus = None
    
    for c in existing_corpora:
        print(f"   - {c.display_name}: {c.name}")
        if c.display_name == CORPUS_DISPLAY_NAME:
            corpus = c
            print(f"   Found existing corpus!")
    
    # Create corpus if not exists
    if not corpus:
        print("\n3. Creating new RAG corpus...")
        corpus = rag.create_corpus(
            display_name=CORPUS_DISPLAY_NAME,
            description="Evidence documents for Maria Santos workplace injury case"
        )
        print(f"   ✅ Created corpus: {corpus.name}")
        
        # Upload PDF files one by one (local files)
        print("\n4. Uploading documents...")
        pdf_files = list(EVIDENCE_DIR.glob("*.pdf"))
        print(f"   Found {len(pdf_files)} PDFs to upload")
        
        for pdf_path in pdf_files:
            print(f"   Uploading: {pdf_path.name}...")
            try:
                rag_file = rag.upload_file(
                    corpus_name=corpus.name,
                    path=str(pdf_path),
                    display_name=pdf_path.stem,
                )
                print(f"      ✅ Uploaded: {rag_file.name}")
            except Exception as e:
                print(f"      ❌ Error: {e}")
        
        print(f"   ✅ Upload complete")
    else:
        print("\n3. Using existing corpus")
        # List files in corpus
        files = list(rag.list_files(corpus_name=corpus.name))
        print(f"   Files in corpus: {len(files)}")
        for f in files:
            print(f"      - {f.display_name}")
        
        # If empty, upload files
        if len(files) == 0:
            print("\n   Corpus is empty, uploading documents...")
            pdf_files = list(EVIDENCE_DIR.glob("*.pdf"))
            print(f"   Found {len(pdf_files)} PDFs to upload")
            
            for pdf_path in pdf_files:
                print(f"   Uploading: {pdf_path.name}...")
                try:
                    rag_file = rag.upload_file(
                        corpus_name=corpus.name,
                        path=str(pdf_path),
                        display_name=pdf_path.stem,
                    )
                    print(f"      ✅ Uploaded: {rag_file.name}")
                except Exception as e:
                    print(f"      ❌ Error: {e}")
            print(f"   ✅ Upload complete")
    
    # Test retrieval queries
    print("\n" + "=" * 60)
    print("TESTING RETRIEVAL")
    print("=" * 60)
    
    test_queries = [
        "What injuries did Maria Santos sustain?",
        "What OSHA violations were cited?",
        "How much are the medical expenses?",
        "Who witnessed the accident?",
        "What safety training was missing?",
    ]
    
    for query in test_queries:
        print(f"\n📝 Query: \"{query}\"")
        
        # Retrieve relevant chunks
        response = rag.retrieval_query(
            rag_resources=[
                rag.RagResource(
                    rag_corpus=corpus.name,
                )
            ],
            text=query,
            similarity_top_k=3,
        )
        
        print("   Top 3 results:")
        for i, context in enumerate(response.contexts.contexts):
            print(f"\n   [{i+1}] Score: {context.score:.4f}")
            print(f"       Source: {context.source_uri}")
            text_preview = context.text[:250].replace('\n', ' ')
            print(f"       Text: {text_preview}...")
    
    # Test with Gemini + RAG (grounded generation)
    print("\n" + "=" * 60)
    print("TESTING GROUNDED GENERATION")
    print("=" * 60)
    
    # Create RAG retrieval tool
    rag_retrieval_tool = Tool.from_retrieval(
        retrieval=rag.Retrieval(
            source=rag.VertexRagStore(
                rag_resources=[
                    rag.RagResource(rag_corpus=corpus.name)
                ],
                similarity_top_k=5,
            ),
        )
    )
    
    # Use Gemini with RAG grounding
    model = GenerativeModel(
        model_name="gemini-2.0-flash",
        tools=[rag_retrieval_tool]
    )
    
    question = "Summarize the key facts of Maria Santos's workplace injury case, including injuries, OSHA violations, and witnesses."
    print(f"\n📝 Question: \"{question}\"")
    
    response = model.generate_content(question)
    print(f"\n🤖 Grounded Response:\n{response.text}")
    
    print("\n" + "=" * 60)
    print("✅ VERTEX AI RAG TEST COMPLETE")
    print("=" * 60)
    print(f"\nCorpus Name: {corpus.name}")
    print("You can use this corpus in ADK with VertexAiRagRetrieval tool!")


if __name__ == "__main__":
    main()

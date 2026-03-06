#!/usr/bin/env python3
"""
Test RAG Pipeline for Lexie Legal Evidence

Tests: PDF parsing → Chunking → Embedding → Vector search → Retrieval
Using FAISS for vector storage (no dependency conflicts)
"""

import os
import sys
from pathlib import Path
import json

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

import pymupdf  # PyMuPDF
import faiss
import numpy as np
from google import genai

# Setup credentials
from app.config import settings
settings.setup_credentials()

# Evidence folder
EVIDENCE_DIR = Path(__file__).parent.parent / "evidence"


def extract_text_from_pdf(pdf_path: Path) -> str:
    """Extract text from a PDF file using PyMuPDF."""
    doc = pymupdf.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list[str]:
    """Split text into overlapping chunks."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk.strip())
        start += chunk_size - overlap
    return chunks


def get_embedding(text: str, client: genai.Client) -> list[float]:
    """Get embedding from Google's text-embedding model."""
    response = client.models.embed_content(
        model="text-embedding-004",
        contents=text,
    )
    return response.embeddings[0].values


def main():
    print("=" * 60)
    print("LEXIE RAG PIPELINE TEST")
    print("=" * 60)
    
    # Initialize Gemini client
    print("\n1. Initializing Gemini client...")
    client = genai.Client(vertexai=True, project=settings.gcp_project_id, location=settings.gcp_location)
    print("   ✅ Client initialized")
    
    # Find PDF files
    print("\n2. Finding PDF files in evidence folder...")
    pdf_files = list(EVIDENCE_DIR.glob("*.pdf"))
    print(f"   Found {len(pdf_files)} PDF files")
    for f in pdf_files:
        print(f"   - {f.name}")
    
    # Process each PDF
    print("\n3. Processing PDFs...")
    all_chunks = []
    all_metadatas = []
    
    for pdf_path in pdf_files:
        print(f"\n   Processing: {pdf_path.name}")
        
        # Extract text
        text = extract_text_from_pdf(pdf_path)
        print(f"   - Extracted {len(text)} characters")
        
        # Chunk text
        chunks = chunk_text(text)
        print(f"   - Created {len(chunks)} chunks")
        
        # Add to collection data
        for i, chunk in enumerate(chunks):
            all_chunks.append(chunk)
            all_metadatas.append({
                "source": pdf_path.name,
                "chunk_index": i,
                "total_chunks": len(chunks)
            })
    
    print(f"\n   Total chunks to embed: {len(all_chunks)}")
    
    # Embed all chunks
    print("\n4. Generating embeddings (this may take a moment)...")
    embeddings = []
    for i, chunk in enumerate(all_chunks):
        if i % 10 == 0:
            print(f"   Embedding chunk {i+1}/{len(all_chunks)}...")
        emb = get_embedding(chunk[:8000], client)  # Limit to 8k chars
        embeddings.append(emb)
    print(f"   ✅ Generated {len(embeddings)} embeddings")
    
    # Create FAISS index
    print("\n5. Building FAISS index...")
    embeddings_np = np.array(embeddings).astype('float32')
    dimension = embeddings_np.shape[1]
    print(f"   Embedding dimension: {dimension}")
    
    # Use L2 distance (euclidean)
    index = faiss.IndexFlatL2(dimension)
    index.add(embeddings_np)
    print(f"   ✅ FAISS index built with {index.ntotal} vectors")
    
    # Test queries
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
        
        # Get query embedding
        query_emb = np.array([get_embedding(query, client)]).astype('float32')
        
        # Search
        k = 3  # Top 3 results
        distances, indices = index.search(query_emb, k)
        
        print("   Top 3 results:")
        for i, (idx, dist) in enumerate(zip(indices[0], distances[0])):
            metadata = all_metadatas[idx]
            doc = all_chunks[idx]
            print(f"\n   [{i+1}] Source: {metadata['source']} (chunk {metadata['chunk_index']+1}/{metadata['total_chunks']})")
            print(f"       Distance: {dist:.4f}")
            # Show relevant excerpt
            preview = doc[:300].replace('\n', ' ')
            print(f"       Preview: {preview}...")
    
    print("\n" + "=" * 60)
    print("✅ RAG PIPELINE TEST COMPLETE")
    print("=" * 60)
    
    # Summary stats
    print(f"\nSummary:")
    print(f"  - PDFs processed: {len(pdf_files)}")
    print(f"  - Total chunks: {len(all_chunks)}")
    print(f"  - Embedding model: text-embedding-004")
    print(f"  - Embedding dimension: {dimension}")
    print(f"  - Vector store: FAISS (in-memory)")


if __name__ == "__main__":
    main()

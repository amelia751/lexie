#!/usr/bin/env python3
"""
Test Evidence Analysis Agent

Tests the Evidence Agent's ability to analyze case documents.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.agents.evidence_agent import (
    search_evidence,
    get_document_summary,
    list_evidence_files,
    analyze_case_evidence,
)


def main():
    print("=" * 60)
    print("EVIDENCE AGENT TEST")
    print("=" * 60)
    
    # Test 1: List files
    print("\n1. Listing evidence files...")
    result = list_evidence_files()
    print(f"   Status: {result['status']}")
    if result['status'] == 'success':
        print(f"   Found {result['count']} files:")
        for f in result['files'][:5]:  # Show first 5
            print(f"      - {f['display_name']}")
        if result['count'] > 5:
            print(f"      ... and {result['count'] - 5} more")
    
    # Test 2: Search evidence
    print("\n2. Searching for injury information...")
    result = search_evidence("What injuries did the plaintiff sustain?")
    print(f"   Status: {result['status']}")
    if result['status'] == 'success':
        print(f"   Found {result['count']} relevant chunks")
        for i, r in enumerate(result['results'][:2]):
            print(f"\n   [{i+1}] Score: {r['score']:.4f}")
            print(f"       Source: {r['source']}")
            print(f"       Text: {r['text'][:150]}...")
    
    # Test 3: Analyze specific aspects
    aspects = ["injuries", "safety_violations", "witnesses", "damages"]
    
    for aspect in aspects:
        print(f"\n3. Analyzing: {aspect}...")
        result = analyze_case_evidence(aspect)
        print(f"   Status: {result['status']}")
        if result['status'] == 'success':
            analysis = result['analysis']
            # Show first 500 chars
            preview = analysis[:500] + "..." if len(analysis) > 500 else analysis
            print(f"   Analysis:\n{preview}")
        print("-" * 40)
    
    # Test 4: Document summary
    print("\n4. Getting document summary...")
    result = get_document_summary("osha-investigation")
    print(f"   Status: {result['status']}")
    if result['status'] == 'success':
        summary = result['summary']
        preview = summary[:600] + "..." if len(summary) > 600 else summary
        print(f"   Summary:\n{preview}")
    
    print("\n" + "=" * 60)
    print("✅ EVIDENCE AGENT TEST COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()

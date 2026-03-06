#!/usr/bin/env python3
"""
Compare Gemini Vision vs Cloud Vision API for evidence image analysis.

Tests on:
- safety-violations.png
- arm-fracture.png
"""

import sys
import base64
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from google import genai
from google.genai import types
from google.cloud import vision

from app.config import settings

# Evidence images
EVIDENCE_DIR = Path(__file__).parent.parent / "evidence"
IMAGES = [
    EVIDENCE_DIR / "safety-violations.png",
    EVIDENCE_DIR / "arm-fracture.png",
]


def load_image_base64(path: Path) -> str:
    """Load image as base64 string."""
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def test_gemini_vision(image_path: Path, client: genai.Client) -> dict:
    """Test Gemini Vision on an image."""
    start = time.time()
    
    # Load image
    image_data = load_image_base64(image_path)
    
    # Prepare prompt for legal evidence analysis
    prompt = """Analyze this image as evidence for a workplace injury legal case.

Describe:
1. What you see in the image
2. Any safety violations or hazards visible
3. Any injuries or medical conditions shown
4. How this could be relevant as legal evidence
5. Key details that should be documented

Be specific and thorough."""

    # Call Gemini 2.5 Flash Image (GA)
    response = client.models.generate_content(
        model="gemini-2.5-flash-image",  # Gemini 2.5 Flash with vision
        contents=[
            types.Part.from_text(text=prompt),
            types.Part.from_bytes(
                data=base64.b64decode(image_data),
                mime_type="image/png"
            ),
        ],
    )
    
    elapsed = time.time() - start
    
    return {
        "model": "gemini-2.5-flash-image",
        "time_seconds": elapsed,
        "response": response.text
    }


def test_cloud_vision(image_path: Path, client: vision.ImageAnnotatorClient) -> dict:
    """Test Cloud Vision API on an image."""
    start = time.time()
    
    # Load image
    with open(image_path, "rb") as f:
        content = f.read()
    
    image = vision.Image(content=content)
    
    # Run multiple detection types
    features = [
        vision.Feature(type_=vision.Feature.Type.LABEL_DETECTION, max_results=10),
        vision.Feature(type_=vision.Feature.Type.OBJECT_LOCALIZATION, max_results=10),
        vision.Feature(type_=vision.Feature.Type.TEXT_DETECTION),
        vision.Feature(type_=vision.Feature.Type.SAFE_SEARCH_DETECTION),
    ]
    
    request = vision.AnnotateImageRequest(image=image, features=features)
    response = client.annotate_image(request=request)
    
    elapsed = time.time() - start
    
    # Parse results
    results = {
        "labels": [label.description for label in response.label_annotations],
        "objects": [obj.name for obj in response.localized_object_annotations],
        "text": response.text_annotations[0].description if response.text_annotations else None,
        "safe_search": {
            "adult": response.safe_search_annotation.adult.name,
            "medical": response.safe_search_annotation.medical.name,
            "violence": response.safe_search_annotation.violence.name,
        } if response.safe_search_annotation else None
    }
    
    return {
        "model": "cloud-vision-api",
        "time_seconds": elapsed,
        "labels": results["labels"],
        "objects": results["objects"],
        "text_detected": results["text"][:200] if results["text"] else None,
        "safe_search": results["safe_search"]
    }


def main():
    print("=" * 70)
    print("VISION API COMPARISON: Gemini vs Cloud Vision")
    print("=" * 70)
    
    # Setup credentials
    settings.setup_credentials()
    
    # Initialize clients
    print("\nInitializing clients...")
    gemini_client = genai.Client(
        vertexai=True,
        project=settings.gcp_project_id,
        location="us-central1"
    )
    vision_client = vision.ImageAnnotatorClient()
    print("✅ Clients initialized")
    
    # Test each image
    for image_path in IMAGES:
        print("\n" + "=" * 70)
        print(f"IMAGE: {image_path.name}")
        print("=" * 70)
        
        if not image_path.exists():
            print(f"   ❌ File not found: {image_path}")
            continue
        
        # Test Gemini Vision
        print("\n--- GEMINI 2.0 FLASH (Vision) ---")
        try:
            result = test_gemini_vision(image_path, gemini_client)
            print(f"⏱️  Time: {result['time_seconds']:.2f}s")
            print(f"\n📝 Analysis:\n{result['response'][:1500]}...")
        except Exception as e:
            print(f"❌ Error: {e}")
        
        # Test Cloud Vision API
        print("\n--- CLOUD VISION API ---")
        try:
            result = test_cloud_vision(image_path, vision_client)
            print(f"⏱️  Time: {result['time_seconds']:.2f}s")
            print(f"\n🏷️  Labels: {', '.join(result['labels'][:8])}")
            print(f"📦 Objects: {', '.join(result['objects'][:5]) if result['objects'] else 'None detected'}")
            if result['text_detected']:
                print(f"📄 Text: {result['text_detected'][:150]}...")
            print(f"🛡️  Safe Search: {result['safe_search']}")
        except Exception as e:
            print(f"❌ Error: {e}")
    
    print("\n" + "=" * 70)
    print("COMPARISON SUMMARY")
    print("=" * 70)
    print("""
| Aspect              | Gemini Vision           | Cloud Vision API       |
|---------------------|-------------------------|------------------------|
| Understanding       | ✅ Contextual, detailed | ❌ Labels/objects only |
| Legal relevance     | ✅ Can explain          | ❌ No interpretation   |
| Speed               | ~2-3s                   | ~1s                    |
| Cost                | Higher                  | Lower                  |
| Best for            | Analysis & explanation  | OCR, object detection  |

RECOMMENDATION: Use Gemini for evidence analysis (understanding context)
                Use Cloud Vision for OCR on documents if needed
""")


if __name__ == "__main__":
    main()

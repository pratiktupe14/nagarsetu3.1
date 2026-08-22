import os
import re
import json
import uuid
import hashlib
import base64
import requests
from pathlib import Path
from typing import Dict, Any, Optional

# Load .env file from ai_service directory if present
env_file = Path(__file__).parent / ".env"
if env_file.exists():
    try:
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ.setdefault(key.strip(), val.strip().strip("'\""))
    except Exception as err:
        print(f"[NAGARSETU AI] Warning loading .env file: {err}")

VALID_TAXONOMY = {
    "Road Damage / Pothole": "Public Works Department (PWD)",
    "Water Leakage / Pipeline": "Water Supply & Sewerage",
    "Garbage / Waste": "Sanitation & Waste Management",
    "Drainage / Sewage": "Drainage & Sewage Department",
    "Streetlight / Electrical": "Electrical & Street Lighting",
    "Traffic Infrastructure": "Traffic Management Department",
    "Public Infrastructure Damage": "Public Works Department (PWD)",
    "Other Civic Issue": "Public Works Department (PWD)"
}

SYSTEM_PROMPT = """You are the civic issue vision analyzer for NAGARSETU 3.0.
Analyze ONLY the actual uploaded image.
Do not infer the issue from the filename.
Do not reuse previous analysis.
Do not assume the issue is a pothole.
Determine the physical civic problem visible in the image.

If visible water is flowing from a broken pipe, damaged pipeline, leaking municipal water line, water ponding due to pipe break, or water infrastructure failure, classify it as:
Water Leakage / Pipeline
and recommend:
Water Supply & Sewerage.

If the image shows a pothole, crater, depression, pavement failure, or road surface damage without a water infrastructure failure, classify it as:
Road Damage / Pothole
and recommend:
Public Works Department (PWD).

If the image shows garbage, trash, solid waste, uncollected refuse, or overflowing litter bin, classify it as:
Garbage / Waste
and recommend:
Sanitation & Waste Management.

If the image shows overflowing drain, choked sewer, clogged gutter, open manhole shaft, or stagnant wastewater, classify it as:
Drainage / Sewage
and recommend:
Drainage & Sewage Department.

If the image shows non-functional, broken or damaged streetlight, lamp post, or electrical fixture, classify it as:
Streetlight / Electrical
and recommend:
Electrical & Street Lighting.

If the image shows damaged traffic light, broken signal pole, junction light malfunction, classify it as:
Traffic Infrastructure
and recommend:
Traffic Management Department.

If the image shows damaged public footpath pavers, broken curb, or public railing damage, classify it as:
Public Infrastructure Damage
and recommend:
Public Works Department (PWD).

If evidence is insufficient or unreadable, return:
Other Civic Issue
with low confidence score.

Never invent visual details that are not visible.

Respond ONLY with a valid JSON object matching this structure:
{
  "is_civic_issue": true or false,
  "category": "One of: Road Damage / Pothole, Water Leakage / Pipeline, Garbage / Waste, Drainage / Sewage, Streetlight / Electrical, Traffic Infrastructure, Public Infrastructure Damage, Other Civic Issue",
  "title": "Short practical title (e.g. Municipal Water Pipeline Leakage)",
  "description": "Factual description based strictly on visible evidence without making up unobservable facts.",
  "severity": "LOW or MEDIUM or HIGH or CRITICAL",
  "priority": "Low or Medium or High or Critical",
  "recommended_department": "Corresponding department from taxonomy",
  "confidence": 0.0 to 1.0,
  "detected_features": ["list", "of", "detected", "visual", "elements"],
  "needs_manual_verification": true or false
}"""

def map_department(category: str) -> str:
    return VALID_TAXONOMY.get(category, "Public Works Department (PWD)")

def call_gemini_vision_api(image_bytes: bytes, gemini_api_key: str) -> Optional[Dict[str, Any]]:
    """
    Calls Google Gemini Vision API (gemini-3.6-flash) using actual image bytes.
    """
    try:
        model_name = os.getenv("GEMINI_VISION_MODEL", "gemini-3.6-flash")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_api_key}"
        
        base64_image = base64.b64encode(image_bytes).decode("utf-8")
        
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": SYSTEM_PROMPT},
                        {
                            "inline_data": {
                                "mime_type": "image/jpeg",
                                "data": base64_image
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.1
            }
        }

        headers = {"Content-Type": "application/json"}
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        if response.status_code == 200:
            res_data = response.json()
            raw_text = res_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            if raw_text:
                parsed = json.loads(raw_text)
                category = parsed.get("category", "Other Civic Issue")
                if category not in VALID_TAXONOMY:
                    category = "Other Civic Issue"
                
                department = map_department(category)
                confidence = float(parsed.get("confidence", 0.90))
                
                return {
                    "is_civic_issue": bool(parsed.get("is_civic_issue", True)),
                    "category": category,
                    "title": parsed.get("title", f"{category} Issue"),
                    "description": parsed.get("description", "Vision AI identified civic issue requiring maintenance."),
                    "severity": parsed.get("severity", "HIGH").upper(),
                    "priority": parsed.get("priority", "High").capitalize(),
                    "recommended_department": department,
                    "confidence": confidence,
                    "detected_features": parsed.get("detected_features", []),
                    "needs_manual_verification": bool(parsed.get("needs_manual_verification", confidence < 0.80))
                }
        else:
            print(f"[NAGARSETU AI] Gemini Vision API Error {response.status_code}: {response.text}")
    except Exception as e:
        print(f"[NAGARSETU AI] Gemini Vision API call exception: {e}")
    
    return None

def analyze_complaint_image(image_bytes: bytes, filename: str = "") -> Dict[str, Any]:
    """
    Analyzes complaint photo using Google Gemini Vision API on image bytes.
    Generates unique analysis_id and image_hash to prevent stale cached results.
    """
    analysis_id = str(uuid.uuid4())
    image_hash = hashlib.sha256(image_bytes).hexdigest()
    
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("VISION_API_KEY")

    if gemini_key:
        result = call_gemini_vision_api(image_bytes, gemini_key)
        if result:
            result["analysis_id"] = analysis_id
            result["image_hash"] = image_hash
            result["model"] = os.getenv("GEMINI_VISION_MODEL", "gemini-3.6-flash")
            return result

    # Clean fallback when Gemini API key is missing or network call fails:
    # Require manual user entry instead of returning fake Potholes!
    return {
        "analysis_id": analysis_id,
        "image_hash": image_hash,
        "model": "fallback_manual",
        "is_civic_issue": False,
        "category": "Other Civic Issue",
        "title": "AI Analysis Unavailable",
        "description": "Unable to analyze photo via Gemini Vision. Please review and fill complaint details manually.",
        "severity": "LOW",
        "priority": "Medium",
        "recommended_department": "Public Works Department (PWD)",
        "confidence": 0.0,
        "detected_features": [],
        "needs_manual_verification": True
    }

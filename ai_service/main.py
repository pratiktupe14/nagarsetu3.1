import os
import sys
import secrets
from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from analyzer import analyze_complaint_image
import google_maps_service as gms

app = FastAPI(
    title="NAGARSETU AI & Google Maps Service",
    description="Computer Vision, AI complaint analysis, and official Google Maps Geocoding & Routing",
    version="3.0.0"
)

cors_allowed = os.getenv("CORS_ALLOWED_ORIGINS", "")
allowed_origins = [orig.strip() for orig in cors_allowed.split(",") if orig.strip()]
if not allowed_origins:
    allowed_origins = ["http://localhost:3000", "http://localhost:5173", "http://localhost:5000", "http://127.0.0.1:5000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def verify_internal_api_key(x_internal_api_key: Optional[str] = Header(None, alias="X-Internal-API-Key")):
    expected_key = os.getenv("AI_INTERNAL_API_KEY")
    if not expected_key:
        return True
    if not x_internal_api_key or not secrets.compare_digest(x_internal_api_key, expected_key):
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid or missing X-Internal-API-Key")
    return True

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}

class AnalysisResponse(BaseModel):
    analysis_id: Optional[str] = None
    image_hash: Optional[str] = None
    model: Optional[str] = None
    is_civic_issue: Optional[bool] = True
    category: str
    title: str
    description: str
    severity: Optional[str] = "HIGH"
    priority: str
    recommended_department: str
    confidence: float
    detected_features: Optional[list] = []
    needs_manual_verification: Optional[bool] = False

class GeocodeRequest(BaseModel):
    address: str = Field(..., min_length=2, max_length=500)

class ReverseGeocodeRequest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)

class DirectionsRequest(BaseModel):
    origin_latitude: float = Field(..., ge=-90.0, le=90.0)
    origin_longitude: float = Field(..., ge=-180.0, le=180.0)
    destination_latitude: float = Field(..., ge=-90.0, le=90.0)
    destination_longitude: float = Field(..., ge=-180.0, le=180.0)
    mode: Optional[str] = Field("driving", pattern="^(driving|walking|bicycling|transit)$")

class ValidateLocationRequest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)

@app.get("/")
def health_check():
    return {
        "status": "ok",
        "service": "NAGARSETU AI & Google Maps Service",
        "version": "3.0.0",
        "google_maps_configured": bool(os.getenv("GOOGLE_MAPS_API_KEY"))
    }

@app.post("/analyze", response_model=AnalysisResponse, dependencies=[Depends(verify_internal_api_key)])
async def analyze_photo(file: UploadFile = File(...)):
    if file.content_type and file.content_type.lower() not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=415, detail=f"Unsupported Media Type: {file.content_type}. Allowed: JPEG, PNG, WebP.")

    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty file uploaded")

        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="Payload Too Large: Maximum allowed file size is 10 MB.")
        
        # Magic bytes check for JPEG, PNG, or WebP
        if len(content) < 4:
            raise HTTPException(status_code=400, detail="Invalid image payload")
        
        header = content[:12]
        is_jpeg = header.startswith(b'\xff\xd8\xff')
        is_png = header.startswith(b'\x89PNG')
        is_webp = header.startswith(b'RIFF') and content[8:12] == b'WEBP'

        if not (is_jpeg or is_png or is_webp):
            raise HTTPException(status_code=415, detail="Invalid image binary signature. Must be JPEG, PNG, or WebP.")

        result = analyze_complaint_image(content, filename=file.filename or "")
        return result
    except HTTPException:
        raise
    except Exception as e:
        sys.stderr.write(f"[AI Service Error] {str(e)}\n")
        raise HTTPException(status_code=500, detail="AI Processing Error. Please try again later.")

# GOOGLE MAPS ENDPOINTS
@app.post("/google-maps/geocode", dependencies=[Depends(verify_internal_api_key)])
def geocode(req: GeocodeRequest):
    return gms.geocode_address(req.address)

@app.post("/google-maps/reverse-geocode")
def reverse_geocode(req: ReverseGeocodeRequest):
    return gms.reverse_geocode(req.latitude, req.longitude)

@app.post("/google-maps/directions", dependencies=[Depends(verify_internal_api_key)])
def get_directions(req: DirectionsRequest):
    return gms.get_directions(
        req.origin_latitude,
        req.origin_longitude,
        req.destination_latitude,
        req.destination_longitude,
        mode=req.mode or "driving"
    )

@app.post("/google-maps/validate")
def validate_location(req: ValidateLocationRequest):
    is_valid = gms.is_within_nashik_bounds(req.latitude, req.longitude)
    return {
        "status": "OK",
        "latitude": req.latitude,
        "longitude": req.longitude,
        "is_valid": is_valid,
        "service_area": "Nashik Municipal Area"
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

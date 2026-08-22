import os
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from analyzer import analyze_complaint_image
import google_maps_service as gms

app = FastAPI(
    title="NAGARSETU AI & Google Maps Service",
    description="Computer Vision, AI complaint analysis, and official Google Maps Geocoding & Routing",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    address: str

class ReverseGeocodeRequest(BaseModel):
    latitude: float
    longitude: float

class DirectionsRequest(BaseModel):
    origin_latitude: float
    origin_longitude: float
    destination_latitude: float
    destination_longitude: float
    mode: Optional[str] = "driving"

class ValidateLocationRequest(BaseModel):
    latitude: float
    longitude: float

@app.get("/")
def health_check():
    return {
        "status": "ok",
        "service": "NAGARSETU AI & Google Maps Service",
        "version": "3.0.0",
        "google_maps_configured": bool(os.getenv("GOOGLE_MAPS_API_KEY"))
    }

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_photo(file: UploadFile = File(...)):
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty file uploaded")
        
        result = analyze_complaint_image(content, filename=file.filename or "")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Processing Error: {str(e)}")

# GOOGLE MAPS ENDPOINTS
@app.post("/google-maps/geocode")
def geocode(req: GeocodeRequest):
    return gms.geocode_address(req.address)

@app.post("/google-maps/reverse-geocode")
def reverse_geocode(req: ReverseGeocodeRequest):
    return gms.reverse_geocode(req.latitude, req.longitude)

@app.post("/google-maps/directions")
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

import os
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from analyzer import analyze_complaint_image

app = FastAPI(
    title="NAGARSETU AI Vision Microservice",
    description="Computer Vision & AI complaint auto-generation service",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalysisResponse(BaseModel):
    category: str
    title: str
    description: str
    priority: str
    recommended_department: str
    confidence: float

@app.get("/")
def health_check():
    return {"status": "ok", "service": "NAGARSETU AI Microservice", "version": "1.0.0"}

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

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

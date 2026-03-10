from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
from resume_parser import extract_text_from_pdf
from rag_chain import ResumeAnalyzer
import uvicorn, os, json

analyzer = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global analyzer
    print("🚀 TalentIQ v2.0 Engine starting...")
    analyzer = ResumeAnalyzer()
    print("✅ All 10 AI Pillars ready")
    yield

app = FastAPI(title="TalentIQ API", version="2.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class OutreachRequest(BaseModel):
    profile: dict
    job_title: str = "Software Engineer"
    company_name: str = "Our Company"

class FeedbackRequest(BaseModel):
    profile: dict
    decision: str = "Not Selected"
    job_title: str = "Software Engineer"

class SkillAdjacencyRequest(BaseModel):
    profile: dict

@app.get("/")
async def root():
    return {"product": "TalentIQ", "version": "2.0", "status": "operational", "pillars": 10}

@app.get("/health")
async def health():
    return {"status": "healthy", "engine": "TalentIQ v2.0", "model": "llama-3.3-70b-versatile"}

@app.post("/analyze")
async def analyze_resume(
    file: UploadFile = File(...),
    job_description: str = Form(default="")
):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 10MB.")
    resume_text = extract_text_from_pdf(content)
    if not resume_text or len(resume_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Could not extract text from PDF")
    result = await analyzer.analyze(resume_text, job_description)
    return result

@app.post("/generate-outreach")
async def generate_outreach(req: OutreachRequest):
    result = await analyzer.generate_outreach_email(req.profile, req.job_title, req.company_name)
    return result

@app.post("/generate-feedback-letter")
async def generate_feedback_letter(req: FeedbackRequest):
    result = await analyzer.generate_feedback_letter(req.profile, req.decision, req.job_title)
    return result

@app.post("/skill-adjacency")
async def skill_adjacency(req: SkillAdjacencyRequest):
    result = await analyzer.assess_skill_adjacency(req.profile)
    return result

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
from resume_parser import extract_text_from_pdf
from rag_chain import ResumeAnalyzer
import uvicorn, os, json, gc

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 TalentIQ v2.0 Engine starting...")
    print("✅ Ready")
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Pydantic Models ────────────────────────────────────────

class AgentRequest(BaseModel):
    message: str
    candidate_context: dict = {}

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

# ─── Routes ─────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"product": "TalentIQ", "version": "2.0", "status": "operational"}

@app.get("/health")
async def health():
    return {"status": "healthy", "engine": "TalentIQ v2.0", "model": "llama-3.3-70b-versatile"}

@app.post("/analyze")
async def analyze_resume(
    file: UploadFile = File(...),
    job_description: str = Form(default=""),
    target_role: str = Form(default=""),
    company_name: str = Form(default="")
):
    if not file.filename.lower().endswith(('.pdf', '.docx', '.doc', '.txt')):
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, DOC, TXT files are supported")
    
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 10MB.")
    
    resume_text = extract_text_from_pdf(content)
    if not resume_text or len(resume_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Could not extract text from file")

    # Create a FRESH analyzer every single request — destroy after done
    fresh_analyzer = ResumeAnalyzer()
    try:
        result = fresh_analyzer.full_analysis(resume_text, job_description)
    finally:
        del fresh_analyzer   # force destroy object
        gc.collect()         # force free RAM immediately

    return result

@app.post("/agent")
async def recruitment_agent(req: AgentRequest):
    try:
        from langchain_groq import ChatGroq
        from langchain.schema import SystemMessage, HumanMessage

        llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0.3,
            max_tokens=1200,
            groq_api_key=os.getenv("GROQ_API_KEY"),
        )

        ctx = req.candidate_context
        analysis = ctx.get("analysis", {})

        system = f"""You are TalentIQ — an expert AI recruitment agent with full candidate context.

CANDIDATE PROFILE:
- Name: {analysis.get('candidate_name', 'Unknown')}
- Role: {analysis.get('current_role', 'N/A')}
- ATS Score: {analysis.get('overall_score', 'N/A')}/100
- Recommendation: {analysis.get('hire_recommendation', 'N/A')}
- Experience: {analysis.get('years_of_experience', 'N/A')} years
- Level: {analysis.get('experience_level', 'N/A')}
- Top Strengths: {[s.get('strength') for s in analysis.get('top_strengths', [])[:3]]}
- Red Flags: {[f.get('flag') for f in analysis.get('red_flags', [])[:3]]}
- JD Match: {analysis.get('jd_match_score', 'N/A')}%
- Impact Score: {analysis.get('quantified_impact', {}).get('score', 'N/A')}/100

Answer recruiter questions concisely and professionally.
Format with **bold** for emphasis. Keep responses under 300 words."""

        messages = [SystemMessage(content=system), HumanMessage(content=req.message)]
        response = llm.invoke(messages)

        # Clean up
        del llm
        gc.collect()

        return {"response": response.content}
    except Exception as e:
        return {"response": f"Agent error: {str(e)}"}

@app.post("/generate-outreach")
async def generate_outreach(req: OutreachRequest):
    analyzer = ResumeAnalyzer()
    try:
        result = analyzer.generate_outreach(req.profile, req.job_title, req.company_name)
    finally:
        del analyzer
        gc.collect()
    return result

@app.post("/generate-feedback-letter")
async def generate_feedback_letter(req: FeedbackRequest):
    analyzer = ResumeAnalyzer()
    try:
        result = analyzer.generate_feedback_letter(req.profile, req.decision, req.job_title)
    finally:
        del analyzer
        gc.collect()
    return result

@app.post("/skill-adjacency")
async def skill_adjacency(req: SkillAdjacencyRequest):
    analyzer = ResumeAnalyzer()
    try:
        result = analyzer.skill_adjacency(req.profile)
    finally:
        del analyzer
        gc.collect()
    return result

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
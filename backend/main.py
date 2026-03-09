from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from resume_parser import extract_text_from_pdf, get_pdf_info
from rag_chain import ResumeAnalyzer

app = FastAPI(title="AI Resume Analyzer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

analyzer = ResumeAnalyzer()

@app.get("/")
async def root():
    return {"status": "AI Resume Analyzer is running ✅"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/analyze")
async def analyze_resume(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Please upload a PDF file.")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 10MB.")

    try:
        resume_text = extract_text_from_pdf(content)
        pdf_info = get_pdf_info(content)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not read PDF: {str(e)}")

    if len(resume_text.strip()) < 80:
        raise HTTPException(status_code=422, detail="Resume appears empty or is a scanned image.")

    try:
        result = await analyzer.analyze(resume_text)
        result["file_info"] = {"filename": file.filename, "pages": pdf_info["pages"]}
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
import os, json, re
from dotenv import load_dotenv
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate

load_dotenv()

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
GROQ_MODEL = "llama-3.3-70b-versatile"

AGENT_PROMPT = """You are an expert senior recruitment agent with 15+ years of 
experience. You analyze resumes with precision and generate targeted interview 
questions. Always respond with valid JSON only — no markdown, no explanation, 
no text before or after the JSON."""

class ResumeAnalyzer:
    def __init__(self):
        self.embeddings = HuggingFaceEmbeddings(
            model_name=EMBEDDING_MODEL,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True}
        )
        self.llm = ChatGroq(
            model=GROQ_MODEL,
            temperature=0.15,
            groq_api_key=os.getenv("GROQ_API_KEY"),
            max_tokens=4096
        )
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=600,
            chunk_overlap=100,
            separators=["\n\n", "\n", ".", " "]
        )

    def _build_retriever(self, text: str):
        chunks = self.splitter.split_text(text)
        vectorstore = Chroma.from_texts(
            chunks,
            self.embeddings,
            collection_name=f"resume_{id(text)}"
        )
        return vectorstore.as_retriever(search_kwargs={"k": 5})

    def _parse_json(self, text: str) -> dict:
        text = re.sub(r'```(?:json)?\s*|\s*```', '', text).strip()
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            return json.loads(match.group())
        return json.loads(text)

    def _query(self, retriever, question: str) -> str:
        prompt = PromptTemplate(
            input_variables=["context", "question"],
            template=AGENT_PROMPT + "\n\nResume sections:\n{context}\n\nTask: {question}"
        )
        chain = RetrievalQA.from_chain_type(
            llm=self.llm,
            chain_type="stuff",
            retriever=retriever,
            chain_type_kwargs={"prompt": prompt},
            return_source_documents=False
        )
        return chain.run(question)

    async def analyze(self, resume_text: str) -> dict:
        retriever = self._build_retriever(resume_text)

        profile_raw = self._query(retriever, """
Analyze this candidate's resume completely. Return this exact JSON:
{
  "candidate_name": "full name",
  "contact": {"email": null, "phone": null, "linkedin": null, "github": null, "location": null},
  "professional_summary": "3-sentence compelling summary",
  "experience_level": "Junior or Mid or Senior or Lead",
  "years_of_experience": 0,
  "current_role": "latest job title",
  "current_company": "latest employer",
  "technical_skills": {
    "languages": [], "frameworks": [], "databases": [], "cloud_devops": [], "tools": []
  },
  "soft_skills": [],
  "top_strengths": [{"strength": "", "evidence": ""}],
  "potential_gaps": [{"gap": "", "suggestion": ""}],
  "work_experience": [{"company": "", "role": "", "duration": "", "key_achievements": []}],
  "education": [{"degree": "", "institution": "", "year": "", "gpa": null}],
  "certifications": [],
  "projects": [{"name": "", "description": "", "tech_stack": []}],
  "overall_score": 75,
  "score_breakdown": {
    "experience_quality": 0, "technical_skills": 0,
    "education": 0, "achievements_impact": 0, "resume_presentation": 0
  },
  "hire_recommendation": "Recommended",
  "recommendation_reason": "one sentence"
}""")

        questions_raw = self._query(retriever, """
Generate 5 targeted interview questions per category for this specific candidate.
Return this exact JSON:
{
  "technical_questions": [
    {"question": "", "skill_tested": "", "difficulty": "Easy or Medium or Hard",
     "expected_answer_hint": "", "follow_up": ""}
  ],
  "behavioral_questions": [
    {"question": "", "competency": "", "what_to_listen_for": ""}
  ],
  "situational_questions": [
    {"question": "", "scenario_purpose": "", "ideal_approach": ""}
  ],
  "culture_fit_questions": [
    {"question": "", "insight_gained": ""}
  ],
  "red_flag_probes": [
    {"concern": "", "question": "", "red_flag_answer": ""}
  ]
}""")

        try:
            profile = self._parse_json(profile_raw)
        except Exception as e:
            profile = {"parse_error": str(e), "raw": profile_raw[:500]}

        try:
            questions = self._parse_json(questions_raw)
        except Exception as e:
            questions = {"parse_error": str(e), "raw": questions_raw[:500]}

        return {"analysis": profile, "interview_questions": questions}
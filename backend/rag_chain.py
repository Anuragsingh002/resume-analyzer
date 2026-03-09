import os
import json
import re
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain.schema import HumanMessage, SystemMessage

load_dotenv()

GROQ_MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """You are an expert senior recruitment agent with 20+ years of experience. You analyze resumes with precision and generate targeted interview questions. Always respond with valid JSON only — no markdown, no explanation, no text before or after the JSON."""

class ResumeAnalyzer:
    def __init__(self):
        self.llm = ChatGroq(
            model=GROQ_MODEL,
            temperature=0.3,
            groq_api_key=os.getenv("GROQ_API_KEY")
        )

    async def analyze(self, resume_text: str) -> dict:
        profile = await self._get_profile(resume_text)
        questions = await self._get_questions(resume_text, profile)
        return {"analysis": profile, "interview_questions": questions}

    async def _get_profile(self, resume_text: str) -> dict:
        prompt = f"""Analyze this resume and return ONLY a JSON object with these exact fields:
{{
  "candidate_name": "full name",
  "current_role": "current or most recent job title",
  "current_company": "current or most recent company",
  "experience_level": "Junior/Mid/Senior/Lead/Principal",
  "years_of_experience": number,
  "contact": {{"email": "", "linkedin": "", "github": "", "location": ""}},
  "professional_summary": "2-3 sentence summary",
  "technical_skills": {{
    "languages": ["list"],
    "frameworks": ["list"],
    "databases": ["list"],
    "cloud_devops": ["list"],
    "tools": ["list"]
  }},
  "soft_skills": ["list"],
  "work_experience": [
    {{
      "role": "",
      "company": "",
      "duration": "",
      "key_achievements": ["list of 3-4 achievements"]
    }}
  ],
  "top_strengths": [
    {{"strength": "", "evidence": ""}}
  ],
  "potential_gaps": [
    {{"gap": "", "suggestion": ""}}
  ],
  "overall_score": number between 0-100,
  "hire_recommendation": "Strongly Recommended / Recommended / Recommended with Caution / Not Recommended"
}}

RESUME:
{resume_text[:6000]}"""

        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=prompt)
        ]
        response = self.llm.invoke(messages)
        return self._parse_json(response.content)

    async def _get_questions(self, resume_text: str, profile: dict) -> dict:
        prompt = f"""Based on this resume, generate interview questions and return ONLY a JSON object:
{{
  "technical_questions": [
    {{"question": "", "skill_tested": "", "difficulty": "Easy/Medium/Hard", "expected_answer_hint": ""}}
  ],
  "behavioral_questions": [
    {{"question": "", "competency": "", "what_to_listen_for": ""}}
  ],
  "situational_questions": [
    {{"question": "", "scenario_purpose": "", "ideal_approach": ""}}
  ],
  "culture_fit_questions": [
    {{"question": "", "what_to_listen_for": ""}}
  ],
  "red_flag_probes": [
    {{"question": "", "concern": "", "red_flag_answer": ""}}
  ]
}}

Generate 5 questions for each category.

RESUME SUMMARY: {str(profile)[:1000]}
RESUME: {resume_text[:3000]}"""

        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=prompt)
        ]
        response = self.llm.invoke(messages)
        return self._parse_json(response.content)

    def _parse_json(self, text: str) -> dict:
        try:
            text = text.strip()
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                return json.loads(match.group())
        except:
            pass
        return {}
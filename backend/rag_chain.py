"""
TalentIQ v4.0 — Resume Intelligence Engine
Groq · LangChain · llama-3.3-70b-versatile
Fixed: gc.collect() after every LLM call to prevent RAM exhaustion on Render free tier
"""

import json
import os
import re
import gc
from typing import Optional

from langchain_groq import ChatGroq
from langchain.schema import SystemMessage, HumanMessage
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# MODEL SETUP
# ---------------------------------------------------------------------------

def _get_llm(temperature: float = 0.15) -> ChatGroq:
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=temperature,
        max_tokens=8000,
        groq_api_key=os.getenv("GROQ_API_KEY"),
    )


# ---------------------------------------------------------------------------
# SYSTEM PROMPT — CORE ANALYSIS
# ---------------------------------------------------------------------------

ANALYSIS_SYSTEM = """You are TalentIQ — an elite, no-nonsense AI talent analyst trained on millions of resumes.
Your job: produce ACCURATE, CALIBRATED, EVIDENCE-BASED analysis. You are NOT a resume coach trying to be kind.

CRITICAL SCORING RULES — VIOLATIONS WILL CORRUPT RESULTS

1. ANTI-INFLATION: Most resumes score 50-72. Exceptional = 80+. Perfect = 90+. DO NOT give 75+ unless truly outstanding.

2. JD MATCH CALIBRATION (most important):
   - Industry reality: 60%+ match is a STRONG match. 40-59% = reasonable. 20-39% = weak.
   - Default assumption: unless skills are explicitly demonstrated with outcomes, they don't count.
   - Buzz-words without evidence count as PARTIAL matches, not full.
   - DO NOT give JD match above 65% unless at least 70% of required skills are demonstrated with evidence.

3. QUANTIFIED IMPACT SCORING:
   - Count how many work experience bullet points contain HARD NUMBERS (%, $, x multiplier, users, time saved, etc.)
   - Score = (quantified bullets / total bullets) x 100, then scale:
     * 0-20% quantified => score 10-30
     * 21-40% quantified => score 30-50
     * 41-60% quantified => score 50-68
     * 61-80% quantified => score 68-82
     * 80%+ quantified => score 82-100

4. BUZZ-WORD DETECTION:
   - Flag the resume as: "Substance-Rich", "Mixed", or "Buzz-Heavy"

5. REAL vs POTENTIAL CANDIDATE DETECTION:
   - "Proven" = has clear outcomes, metrics, promotions, shipped products
   - "High Potential" = strong trajectory but limited outcomes yet
   - "Overinflated" = lots of buzzwords, vague claims, no metrics

6. OVERALL SCORE CALIBRATION:
   * 85-100: World-class. Multi-dimensional excellence. Rare.
   * 70-84: Strong candidate. Real achievements with metrics.
   * 55-69: Solid but average. Experience present, weak quantification.
   * 40-54: Below expectations. Significant gaps.
   * <40: Junior/entry or seriously mismatched.

OUTPUT FORMAT — STRICT JSON ONLY
Respond with a single valid JSON object. No markdown. No explanation outside JSON.

{
  "candidate_name": "string",
  "contact_info": {
    "email": "string or null",
    "phone": "string or null",
    "location": "string or null",
    "linkedin": "string or null",
    "github": "string or null",
    "portfolio": "string or null"
  },
  "current_role": "string",
  "current_company": "string or null",
  "years_of_experience": 0,
  "experience_level": "Entry | Junior | Mid | Senior | Lead | Principal | Executive",
  "overall_score": 0,
  "hire_recommendation": "Strong Hire | Hire | Hire with Caution | Do Not Hire",
  "hire_rationale": "2-3 sentence evidence-based rationale",
  "candidate_classification": {
    "type": "Proven | High Potential | Overinflated",
    "confidence": "High | Medium | Low",
    "evidence": "string",
    "buzz_word_rating": "Substance-Rich | Mixed | Buzz-Heavy",
    "buzz_examples": [],
    "substance_examples": []
  },
  "quantified_impact": {
    "score": 0,
    "total_bullets": 0,
    "quantified_bullets": 0,
    "quantified_percentage": 0,
    "strong_examples": [],
    "weak_examples": [],
    "verdict": "Excellent | Good | Adequate | Poor | Very Poor",
    "improvement_tip": "string"
  },
  "ats_scores": {
    "keyword_density": 0,
    "format_quality": 0,
    "experience_depth": 0,
    "skills_coverage": 0,
    "achievement_impact": 0,
    "career_progression": 0
  },
  "professional_summary": "string",
  "unique_value_proposition": "string",
  "career_trajectory": "string",
  "technical_skills": {
    "languages": [],
    "frameworks": [],
    "databases": [],
    "cloud_devops": [],
    "ai_ml": [],
    "tools": [],
    "other": []
  },
  "soft_skills": [],
  "inferred_skills": [],
  "work_experience": [
    {
      "role": "string",
      "company": "string",
      "duration": "string",
      "key_achievements": [],
      "impact_metrics": [],
      "skills_demonstrated": [],
      "has_quantified_impact": true
    }
  ],
  "education": [
    {
      "degree": "string",
      "institution": "string",
      "year": "string",
      "relevant_coursework": []
    }
  ],
  "certifications": [],
  "projects": [
    {
      "name": "string",
      "description": "string",
      "impact": "string or null",
      "technologies": []
    }
  ],
  "jd_match_score": null,
  "jd_match_summary": "string",
  "jd_matched_skills": [],
  "jd_missing_skills": [],
  "jd_partial_skills": [],
  "top_strengths": [
    {
      "strength": "string",
      "evidence": "string",
      "rarity": "Common | Uncommon | Rare"
    }
  ],
  "potential_gaps": [
    {
      "gap": "string",
      "severity": "Minor | Moderate | Critical",
      "suggestion": "string"
    }
  ],
  "red_flags": [
    {
      "flag": "string",
      "explanation": "string",
      "probe_question": "string"
    }
  ],
  "ideal_role_fit": [],
  "growth_signals": [],
  "career_velocity": "Accelerating | Steady | Plateauing | Declining",
  "career_velocity_evidence": "string"
}"""


# ---------------------------------------------------------------------------
# INTERVIEW QUESTIONS PROMPT
# ---------------------------------------------------------------------------

QUESTIONS_SYSTEM = """You are TalentIQ — an elite interviewer generating surgical, resume-specific interview questions.
All questions must be grounded in THIS candidate's actual resume facts. No generic questions.
Respond ONLY with valid JSON. No markdown. No preamble.

Output schema:
{
  "technical_questions": [
    {
      "question": "string",
      "skill_tested": "string",
      "difficulty": "Easy | Medium | Hard",
      "expected_answer_hint": "string",
      "green_flag_answer": "string",
      "red_flag_answer": "string",
      "follow_up": "string"
    }
  ],
  "behavioral_questions": [
    {
      "question": "string",
      "competency": "string",
      "difficulty": "Easy | Medium | Hard",
      "star_guidance": "string",
      "what_to_listen_for": "string",
      "what_to_avoid": "string"
    }
  ],
  "situational_questions": [
    {
      "question": "string",
      "competency": "string",
      "difficulty": "Easy | Medium | Hard",
      "ideal_approach": "string",
      "what_to_avoid": "string",
      "follow_up": "string"
    }
  ],
  "deep_dive_questions": [
    {
      "question": "string",
      "target": "string",
      "intent": "string",
      "expected_depth": "string"
    }
  ],
  "red_flag_probes": [
    {
      "question": "string",
      "concern": "string",
      "green_flag_answer": "string",
      "red_flag_answer": "string"
    }
  ],
  "culture_fit_questions": [
    {
      "question": "string",
      "what_to_listen_for": "string",
      "alignment_signals": []
    }
  ]
}

Generate: 8 technical, 7 behavioral, 5 situational, 5 deep-dive, 3 red-flag probes, 5 culture-fit questions."""


# ---------------------------------------------------------------------------
# BIAS REPORT PROMPT
# ---------------------------------------------------------------------------

BIAS_SYSTEM = """You are TalentIQ's ethical evaluation module. Analyze the resume for PII and potential hiring biases.
Respond ONLY with valid JSON. No markdown.

Output schema:
{
  "fairness_score": 0,
  "blind_review_recommendation": "string",
  "pii_detected": {
    "name": true,
    "photo": false,
    "age_indicators": false,
    "gender_indicators": false,
    "nationality_indicators": false,
    "address": false,
    "graduation_year": false
  },
  "potential_bias_vectors": [
    {
      "vector": "string",
      "risk_level": "Low | Medium | High",
      "explanation": "string",
      "mitigation": "string"
    }
  ],
  "recommended_blind_fields": [],
  "merit_indicators": [],
  "evaluation_guidance": "string"
}"""


# ---------------------------------------------------------------------------
# COACHING FEEDBACK PROMPT
# ---------------------------------------------------------------------------

COACHING_SYSTEM = """You are TalentIQ's career coach. Provide honest, specific, actionable coaching.
Respond ONLY with valid JSON. No markdown.

Output schema:
{
  "overall_assessment": "string",
  "key_strengths_recognized": [
    {
      "strength": "string",
      "why_it_matters": "string"
    }
  ],
  "quick_wins": [],
  "improvement_roadmap": [
    {
      "area": "string",
      "specific_action": "string",
      "timeline": "1 week | 1 month | 3 months | 6 months",
      "resources": []
    }
  ],
  "quantification_coaching": {
    "overall_tip": "string",
    "bullet_rewrites": [
      {
        "original": "string",
        "improved": "string",
        "why_better": "string"
      }
    ]
  },
  "skill_gap_courses": [
    {
      "skill": "string",
      "recommended_course": "string",
      "platform": "string",
      "estimated_time": "string"
    }
  ],
  "career_advice": "string"
}"""


# ---------------------------------------------------------------------------
# HELPER: PARSE JSON SAFELY
# ---------------------------------------------------------------------------

def _extract_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r'^```(?:json)?\s*', '', text, flags=re.MULTILINE)
    text = re.sub(r'\s*```$', '', text, flags=re.MULTILINE)
    text = text.strip()

    start = text.find('{')
    if start == -1:
        raise ValueError("No JSON object found in response")

    depth = 0
    end = start
    for i in range(start, len(text)):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                break

    json_str = text[start:end]
    return json.loads(json_str)


# ---------------------------------------------------------------------------
# MAIN ANALYZER CLASS
# ---------------------------------------------------------------------------

class ResumeAnalyzer:

    def __init__(self):
        self.llm = _get_llm(temperature=0.15)
        self.llm_creative = _get_llm(temperature=0.4)

    def _call_llm(self, system: str, human: str, creative: bool = False) -> dict:
        llm = self.llm_creative if creative else self.llm
        messages = [SystemMessage(content=system), HumanMessage(content=human)]
        response = llm.invoke(messages)
        result = _extract_json(response.content)
        del response
        gc.collect()
        return result

    # ── Core Analysis ──────────────────────────────────────────────────────────

    def analyze(self, resume_text: str, job_description: Optional[str] = None) -> dict:
        if job_description and job_description.strip():
            jd_section = (
                "\n--- JOB DESCRIPTION ---\n"
                + job_description.strip()
                + "\n\nIMPORTANT: Apply STRICT JD MATCH CALIBRATION. Most candidates score 30-55%.\n"
            )
        else:
            jd_section = "\nNo job description provided. Set jd_match_score to null."

        human = (
            "Analyze this resume. Apply all scoring rules strictly.\n\n"
            "--- RESUME TEXT ---\n"
            + resume_text
            + "\n\n"
            + jd_section
            + "\n\nOutput ONLY valid JSON."
        )
        return self._call_llm(ANALYSIS_SYSTEM, human)

    # ── Interview Questions ────────────────────────────────────────────────────

    def generate_questions(self, resume_text: str, analysis: dict,
                           job_description: Optional[str] = None) -> dict:
        candidate = analysis.get("candidate_name", "the candidate")
        role = analysis.get("current_role", "professional")

        context = (
            f"Candidate: {candidate} | Role: {role}\n"
            f"Experience: {analysis.get('years_of_experience', '?')} years\n"
            f"RESUME SUMMARY:\n{resume_text[:3000]}\n"
        )
        if job_description:
            context += f"\nJOB DESCRIPTION:\n{job_description[:1500]}"

        human = (
            "Generate surgical interview questions for this specific candidate.\n"
            "Every question must reference actual content from their resume.\n\n"
            + context
            + "\n\nOutput ONLY valid JSON."
        )
        return self._call_llm(QUESTIONS_SYSTEM, human, creative=True)

    # ── Bias Audit ─────────────────────────────────────────────────────────────

    def bias_report(self, resume_text: str, analysis: dict) -> dict:
        human = (
            f"Audit this resume for PII and potential hiring biases.\n"
            f"Candidate level: {analysis.get('experience_level', 'unknown')}\n\n"
            f"RESUME:\n{resume_text[:3000]}\n\n"
            "Output ONLY valid JSON."
        )
        return self._call_llm(BIAS_SYSTEM, human)

    # ── Coaching Report ────────────────────────────────────────────────────────

    def coaching_feedback(self, resume_text: str, analysis: dict) -> dict:
        qi = analysis.get("quantified_impact", {})
        human = (
            f"Provide coaching for this candidate.\n"
            f"Quantified impact score: {qi.get('score', '?')}/100\n"
            f"Candidate classification: {analysis.get('candidate_classification', {}).get('type', 'unknown')}\n\n"
            f"RESUME:\n{resume_text[:3000]}\n\n"
            "Output ONLY valid JSON."
        )
        return self._call_llm(COACHING_SYSTEM, human, creative=True)

    # ── Outreach Email ─────────────────────────────────────────────────────────

    def generate_outreach(self, profile: dict, job_title: str, company_name: str) -> dict:
        system = (
            "You are a top-tier recruiter writing personalized outreach.\n"
            'Respond ONLY with valid JSON: {"subject_line":"string","email_body":"string","follow_up_subject":"string","follow_up_body":"string","personalization_hooks":[]}'
        )
        human = (
            f"Write a personalized recruiter email for:\n"
            f"Candidate: {profile.get('candidate_name')} | Role: {job_title} | Company: {company_name}\n"
            f"Top strengths: {[s.get('strength') for s in profile.get('top_strengths', [])[:3]]}\n"
            "Output ONLY valid JSON."
        )
        return self._call_llm(system, human, creative=True)

    # ── Feedback Letter ────────────────────────────────────────────────────────

    def generate_feedback_letter(self, profile: dict, decision: str, job_title: str) -> dict:
        system = (
            "Write a professional candidate feedback letter.\n"
            'Respond ONLY with valid JSON: {"subject_line":"string","letter_body":"string"}'
        )
        human = (
            f"Write a {decision} feedback letter for:\n"
            f"Candidate: {profile.get('candidate_name')} | Role: {job_title}\n"
            f"Score: {profile.get('overall_score')}/100\n"
            "Output ONLY valid JSON."
        )
        return self._call_llm(system, human, creative=True)

    # ── Skill Adjacency ────────────────────────────────────────────────────────

    def skill_adjacency(self, profile: dict) -> dict:
        system = (
            "Analyze skill adjacency.\n"
            'Respond ONLY with valid JSON: {"primary_stack":[],"adjacent_skills":[{"skill":"string","rationale":"string","time_to_competency":"string","priority":"High|Medium|Low"}],"market_positioning":"string"}'
        )
        human = (
            f"Map skill adjacency for: {profile.get('candidate_name')}\n"
            f"Current tech: {profile.get('technical_skills', {})}\n"
            "Output ONLY valid JSON."
        )
        return self._call_llm(system, human)

    # ── MASTER ORCHESTRATOR ────────────────────────────────────────────────────

    def full_analysis(self, resume_text: str, job_description: Optional[str] = None) -> dict:
        # Re-init LLM fresh on every call
        self.llm = _get_llm(temperature=0.15)
        self.llm_creative = _get_llm(temperature=0.4)

        # Step 1 — Core analysis
        analysis = self.analyze(resume_text, job_description)
        gc.collect()  # free RAM after each step

        # Step 2 — Interview questions
        try:
            questions = self.generate_questions(resume_text, analysis, job_description)
        except Exception as e:
            questions = {"error": str(e)}
        gc.collect()

        # Step 3 — Bias report
        try:
            bias = self.bias_report(resume_text, analysis)
        except Exception as e:
            bias = {"error": str(e)}
        gc.collect()

        # Step 4 — Coaching
        try:
            coaching = self.coaching_feedback(resume_text, analysis)
        except Exception as e:
            coaching = {"error": str(e)}
        gc.collect()

        return {
            "analysis": analysis,
            "interview_questions": questions,
            "bias_report": bias,
            "candidate_feedback": coaching,
        }
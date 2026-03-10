"""
TalentIQ v4.0 — Resume Intelligence Engine
Groq · LangChain · llama-3.3-70b-versatile

UPGRADES IN THIS VERSION:
  * Quantified Impact scoring — dedicated axis measuring numbers/metrics usage
  * Calibrated JD matching — strict rubric (realistic 20-65% for most resumes)
  * Buzz-word vs. substance detector — real / potential / inflated resume flags
  * Evidence-based scoring — every score backed by explicit resume evidence
  * Anti-inflation logic — model penalised for generous scoring
"""

import json
import os
import re
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
   - Buzz-words without evidence (e.g., "managed teams", "led initiatives" with no detail) count as PARTIAL matches, not full.
   - A resume can have many tech keywords but still score 30% if depth/context is missing.
   - DO NOT give JD match above 65% unless at least 70% of required skills are demonstrated with evidence.

3. QUANTIFIED IMPACT SCORING (NEW — critical axis):
   - Count how many work experience bullet points contain HARD NUMBERS (%, $, x multiplier, users, time saved, etc.)
   - Score = (quantified bullets / total bullets) x 100, then scale:
     * 0-20% quantified => score 10-30
     * 21-40% quantified => score 30-50
     * 41-60% quantified => score 50-68
     * 61-80% quantified => score 68-82
     * 80%+ quantified => score 82-100
   - Vague statements like "improved performance", "increased revenue", "reduced costs" WITHOUT numbers = NOT quantified.

4. BUZZ-WORD DETECTION:
   - Identify if the resume uses inflated language without substance.
   - "Spearheaded revolutionary AI transformation" = buzz.
   - "Reduced API latency by 40ms (from 200ms to 160ms) serving 2M daily requests" = substance.
   - Flag the resume as: "Substance-Rich", "Mixed", or "Buzz-Heavy"
   - Provide specific examples of buzz phrases found (if any)

5. REAL vs POTENTIAL CANDIDATE DETECTION:
   - "Proven" = has clear outcomes, metrics, promotions, shipped products used by real users/customers
   - "High Potential" = strong trajectory, certifications, side projects, clear learning curve but limited outcomes yet
   - "Overinflated" = lots of buzzwords, vague claims, no metrics, titles don't match tenure
   - Assign one of these classifications with evidence.

6. OVERALL SCORE CALIBRATION:
   * 85-100: World-class. Multi-dimensional excellence. Rare.
   * 70-84: Strong candidate. Real achievements with metrics. Some gaps.
   * 55-69: Solid but average. Experience present, weak quantification.
   * 40-54: Below expectations for role. Significant gaps.
   * <40: Junior/entry or seriously mismatched resume.

OUTPUT FORMAT — STRICT JSON ONLY
Respond with a single valid JSON object. No markdown. No explanation outside JSON.

{
  "candidate_name": "string",
  "contact": {
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
  "hire_rationale": "2-3 sentence evidence-based rationale citing specific resume facts",
  "candidate_classification": {
    "type": "Proven | High Potential | Overinflated",
    "confidence": "High | Medium | Low",
    "evidence": "Specific bullet from resume that justifies this classification",
    "buzz_word_rating": "Substance-Rich | Mixed | Buzz-Heavy",
    "buzz_examples": ["exact phrase from resume that is buzz without substance"],
    "substance_examples": ["exact phrase from resume with real data/outcome"]
  },
  "quantified_impact": {
    "score": 0,
    "total_bullets": 0,
    "quantified_bullets": 0,
    "quantified_percentage": 0,
    "strong_examples": ["best quantified bullet points from resume"],
    "weak_examples": ["vague bullets that should have been quantified"],
    "verdict": "Excellent | Good | Adequate | Poor | Very Poor",
    "improvement_tip": "Specific advice on how candidate could improve their quantification"
  },
  "ats_scores": {
    "keyword_density": 0,
    "format_quality": 0,
    "experience_depth": 0,
    "skills_coverage": 0,
    "achievement_impact": 0,
    "career_progression": 0,
    "scoring_notes": {
      "keyword_density_reason": "one sentence",
      "experience_depth_reason": "one sentence",
      "achievement_impact_reason": "one sentence"
    }
  },
  "professional_summary": "3-4 sentence OBJECTIVE summary of this candidate profile",
  "unique_value_proposition": "What makes this person genuinely different from other candidates at their level",
  "career_trajectory": "string describing arc of career",
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
  "inferred_skills": ["skills clearly implied but not stated"],
  "transferable_skills": ["cross-domain skills"],
  "work_experience": [
    {
      "role": "string",
      "company": "string",
      "duration": "string",
      "key_achievements": ["exact or paraphrased bullets — max 4"],
      "impact_metrics": ["ONLY bullets that have actual numbers/percentages"],
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
  "jd_match_summary": "string — must explain WHY score is what it is",
  "jd_matched_skills": ["only skills with demonstrated evidence"],
  "jd_missing_skills": ["skills required by JD but absent/unproven in resume"],
  "jd_partial_skills": ["skills present as buzzwords but without demonstrated depth"],
  "top_strengths": [
    {
      "strength": "string",
      "evidence": "Specific quote or fact from resume",
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
      "probe_question": "Specific interview question to investigate this flag"
    }
  ],
  "ideal_role_fit": ["3-5 role titles this person is genuinely suited for"],
  "growth_signals": ["evidence of learning, promotions, expanding scope"],
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
      "question": "string — must reference specific tech or project from resume",
      "skill_tested": "string",
      "difficulty": "Easy | Medium | Hard",
      "expected_answer_hint": "what a strong answer looks like",
      "green_flag_answer": "indicator of strong candidate",
      "red_flag_answer": "indicator of shallow knowledge",
      "follow_up": "probing follow-up question"
    }
  ],
  "behavioral_questions": [
    {
      "question": "string — must reference specific role/achievement from resume",
      "competency": "string",
      "difficulty": "Easy | Medium | Hard",
      "star_guidance": "What to look for in Situation/Task/Action/Result",
      "what_to_listen_for": "string",
      "what_to_avoid": "red flag response patterns",
      "scoring_rubric": "how to score 1-5"
    }
  ],
  "situational_questions": [
    {
      "question": "string — hypothetical scenarios relevant to this candidate trajectory",
      "competency": "string",
      "difficulty": "Easy | Medium | Hard",
      "ideal_approach": "what a strong answer should include",
      "what_to_avoid": "string",
      "follow_up": "string"
    }
  ],
  "deep_dive_questions": [
    {
      "question": "string — probe gaps, resume anomalies, or buzz-word claims",
      "target": "specific achievement or claim being probed",
      "intent": "Why are we asking this — what are we trying to verify",
      "expected_depth": "What level of detail demonstrates real ownership"
    }
  ],
  "red_flag_probes": [
    {
      "question": "string",
      "concern": "what red flag this probes",
      "green_flag_answer": "string",
      "red_flag_answer": "string"
    }
  ],
  "culture_fit_questions": [
    {
      "question": "string",
      "what_to_listen_for": "string",
      "alignment_signals": ["string"]
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
      "vector": "string (e.g., Institution Prestige Bias)",
      "risk_level": "Low | Medium | High",
      "explanation": "string",
      "mitigation": "string"
    }
  ],
  "recommended_blind_fields": ["fields to redact for fair evaluation"],
  "merit_indicators": ["objective, bias-free facts that should drive decision"],
  "evaluation_guidance": "string — actionable guidance for fair evaluation"
}"""


# ---------------------------------------------------------------------------
# COACHING FEEDBACK PROMPT
# ---------------------------------------------------------------------------

COACHING_SYSTEM = """You are TalentIQ's career coach. Provide honest, specific, actionable coaching.
Focus heavily on QUANTIFICATION — help the candidate understand exactly how to add numbers to their experience.
Respond ONLY with valid JSON. No markdown.

Output schema:
{
  "overall_assessment": "string — honest 2-3 sentence assessment",
  "key_strengths_recognized": [
    {
      "strength": "string",
      "why_it_matters": "string"
    }
  ],
  "quick_wins": ["specific 1-week actions"],
  "improvement_roadmap": [
    {
      "area": "string",
      "specific_action": "string",
      "timeline": "1 week | 1 month | 3 months | 6 months",
      "resources": ["specific course/tool/book names"]
    }
  ],
  "quantification_coaching": {
    "overall_tip": "string — main advice on adding impact metrics",
    "bullet_rewrites": [
      {
        "original": "exact weak bullet from resume",
        "improved": "rewritten version with estimated metrics",
        "why_better": "string"
      }
    ]
  },
  "skill_gap_courses": [
    {
      "skill": "string",
      "recommended_course": "specific course name",
      "platform": "Coursera | Udemy | Pluralsight | YouTube | etc.",
      "estimated_time": "string"
    }
  ],
  "career_advice": "string — 1-2 sentence strategic career advice"
}"""


# ---------------------------------------------------------------------------
# HELPER: PARSE JSON SAFELY
# ---------------------------------------------------------------------------

def _extract_json(text: str) -> dict:
    """Extract and parse JSON from LLM response, handling markdown fences."""
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
    """
    TalentIQ v4.0 — Industry-grade resume intelligence.

    New in v4.0:
    - Quantified Impact axis (new dedicated scoring dimension)
    - Calibrated JD matching (strict, realistic scores)
    - Buzz-word vs substance detection
    - Candidate classification (Proven / High Potential / Overinflated)
    - Evidence-based scoring with anti-inflation logic
    - Bullet rewrite coaching
    """

    def __init__(self):
        self.llm = _get_llm(temperature=0.15)
        self.llm_creative = _get_llm(temperature=0.4)

    def _call_llm(self, system: str, human: str, creative: bool = False) -> dict:
        llm = self.llm_creative if creative else self.llm
        messages = [SystemMessage(content=system), HumanMessage(content=human)]
        response = llm.invoke(messages)
        return _extract_json(response.content)

    # ── Core Analysis ──────────────────────────────────────────────────────────

    def analyze(self, resume_text: str, job_description: Optional[str] = None) -> dict:
        """Full intelligence analysis with quantified impact + buzz detection + JD matching."""
        if job_description and job_description.strip():
            jd_section = (
                "\n--- JOB DESCRIPTION (for JD matching) ---\n"
                + job_description.strip()
                + "\n\nIMPORTANT JD SCORING INSTRUCTION:\n"
                "- Apply STRICT JD MATCH CALIBRATION. Most candidates score 30-55%.\n"
                "- Keywords without demonstrated use = PARTIAL match only (jd_partial_skills).\n"
                "- Only give 60%+ if truly well-matched with evidence.\n"
            )
        else:
            jd_section = "\nNo job description provided. Set jd_match_score to null."

        human = (
            "Analyze this resume. Apply all scoring rules strictly. Be honest, not kind.\n\n"
            "--- RESUME TEXT ---\n"
            + resume_text
            + "\n\n"
            + jd_section
            + "\n\nRemember:\n"
            "1. Count EVERY bullet point in work_experience to calculate quantified_impact\n"
            "2. Flag buzz-heavy language with specific examples\n"
            "3. Classify candidate as Proven/High Potential/Overinflated with evidence\n"
            "4. For JD matching: list jd_partial_skills separately from jd_matched_skills\n"
            "5. Output ONLY valid JSON"
        )

        return self._call_llm(ANALYSIS_SYSTEM, human)

    # ── Interview Questions ────────────────────────────────────────────────────

    def generate_questions(self, resume_text: str, analysis: dict,
                           job_description: Optional[str] = None) -> dict:
        """Generate 33+ surgical interview questions grounded in this specific resume."""
        candidate = analysis.get("candidate_name", "the candidate")
        role = analysis.get("current_role", "professional")
        red_flags = analysis.get("red_flags", [])
        buzz = analysis.get("candidate_classification", {}).get("buzz_examples", [])
        qi = analysis.get("quantified_impact", {})

        context = (
            f"Candidate: {candidate} | Role: {role}\n"
            f"Experience: {analysis.get('years_of_experience', '?')} years | Level: {analysis.get('experience_level', '?')}\n"
            f"Buzz-word rating: {analysis.get('candidate_classification', {}).get('buzz_word_rating', 'unknown')}\n"
            f"Quantified Impact Score: {qi.get('score', '?')}/100\n"
            f"Red flags to probe: {[rf.get('flag') for rf in red_flags[:3]]}\n"
            f"Buzz phrases to challenge: {buzz[:3]}\n\n"
            f"RESUME SUMMARY:\n{resume_text[:3000]}\n"
        )
        if job_description:
            context += f"\nJOB DESCRIPTION:\n{job_description[:1500]}"

        human = (
            "Generate surgical interview questions for this specific candidate.\n"
            "Every question must reference actual content from their resume.\n"
            "For deep-dive questions, focus on:\n"
            "1. Probing buzz-word claims that lack evidence\n"
            "2. Verifying quantified achievements\n"
            "3. Testing depth behind listed skills\n\n"
            + context
            + "\n\nOutput ONLY valid JSON."
        )

        return self._call_llm(QUESTIONS_SYSTEM, human, creative=True)

    # ── Bias Audit ─────────────────────────────────────────────────────────────

    def bias_report(self, resume_text: str, analysis: dict) -> dict:
        """Ethical audit for hiring bias and PII."""
        human = (
            f"Audit this resume for PII and potential hiring biases.\n"
            f"Candidate level: {analysis.get('experience_level', 'unknown')}\n\n"
            f"RESUME:\n{resume_text[:3000]}\n\n"
            "Output ONLY valid JSON."
        )
        return self._call_llm(BIAS_SYSTEM, human)

    # ── Coaching Report ────────────────────────────────────────────────────────

    def coaching_feedback(self, resume_text: str, analysis: dict) -> dict:
        """Career coaching with quantification-focused advice and bullet rewrites."""
        qi = analysis.get("quantified_impact", {})
        weak_bullets = qi.get("weak_examples", [])

        human = (
            f"Provide coaching for this candidate. Be specific and honest.\n"
            f"Quantified impact score: {qi.get('score', '?')}/100 ({qi.get('verdict', '?')})\n"
            f"Weak bullets needing improvement: {weak_bullets[:5]}\n"
            f"Candidate classification: {analysis.get('candidate_classification', {}).get('type', 'unknown')}\n"
            f"Buzz-word rating: {analysis.get('candidate_classification', {}).get('buzz_word_rating', 'unknown')}\n\n"
            "Focus heavily on:\n"
            "1. Rewriting their weakest bullets with estimated/actual metrics\n"
            "2. Specific actions to raise their quantified impact score\n"
            "3. Honest assessment, not flattery\n\n"
            f"RESUME:\n{resume_text[:3000]}\n\n"
            "Output ONLY valid JSON."
        )
        return self._call_llm(COACHING_SYSTEM, human, creative=True)

    # ── Outreach Email ─────────────────────────────────────────────────────────

    def generate_outreach(self, profile: dict, job_title: str, company_name: str) -> dict:
        """Generate personalized recruiter outreach email."""
        system = (
            "You are a top-tier recruiter writing personalized outreach.\n"
            "Reference specific candidate achievements. No generic templates.\n"
            'Respond ONLY with valid JSON: {\n'
            '  "subject_line": "string",\n'
            '  "email_body": "string",\n'
            '  "follow_up_subject": "string",\n'
            '  "follow_up_body": "string",\n'
            '  "personalization_hooks": ["specific facts used to personalize"]\n'
            '}'
        )
        strong_examples = profile.get("quantified_impact", {}).get("strong_examples", [])
        human = (
            f"Write a personalized recruiter email for:\n"
            f"Candidate: {profile.get('candidate_name')} | Role: {job_title} | Company: {company_name}\n"
            f"Current role: {profile.get('current_role')} | Experience: {profile.get('years_of_experience')} years\n"
            f"Top strengths: {[s.get('strength') for s in profile.get('top_strengths', [])[:3]]}\n"
            f"Best quantified achievements: {strong_examples[:3]}\n"
            f"Skills: {list(profile.get('technical_skills', {}).get('languages', []))[:5]}\n\n"
            "Reference specific achievements. Output ONLY valid JSON."
        )
        return self._call_llm(system, human, creative=True)

    # ── Feedback Letter ────────────────────────────────────────────────────────

    def generate_feedback_letter(self, profile: dict, decision: str, job_title: str) -> dict:
        """Generate candidate feedback letter."""
        system = (
            "Write a professional candidate feedback letter. Be constructive and honest.\n"
            'Respond ONLY with valid JSON: {\n'
            '  "subject_line": "string",\n'
            '  "letter_body": "string"\n'
            '}'
        )
        human = (
            f"Write a {decision} feedback letter for:\n"
            f"Candidate: {profile.get('candidate_name')} | Role: {job_title}\n"
            f"Decision: {decision}\n"
            f"Score: {profile.get('overall_score')}/100\n"
            f"Key strengths: {[s.get('strength') for s in profile.get('top_strengths', [])[:2]]}\n"
            f"Main gaps: {[g.get('gap') for g in profile.get('potential_gaps', [])[:2]]}\n"
            f"Quantified Impact: {profile.get('quantified_impact', {}).get('verdict', 'unknown')}\n\n"
            "Be honest, constructive, and professional. Output ONLY valid JSON."
        )
        return self._call_llm(system, human, creative=True)

    # ── Skill Adjacency ────────────────────────────────────────────────────────

    def skill_adjacency(self, profile: dict) -> dict:
        """Map adjacent/related skills the candidate could quickly acquire."""
        system = (
            "Analyze skill adjacency — what skills this candidate can realistically acquire next.\n"
            'Respond ONLY with valid JSON: {\n'
            '  "primary_stack": ["current core skills"],\n'
            '  "adjacent_skills": [\n'
            '    {\n'
            '      "skill": "string",\n'
            '      "rationale": "why this is adjacent to their current stack",\n'
            '      "time_to_competency": "weeks",\n'
            '      "priority": "High | Medium | Low"\n'
            '    }\n'
            '  ],\n'
            '  "market_positioning": "how this skill set positions them in the market"\n'
            '}'
        )
        human = (
            f"Map skill adjacency for: {profile.get('candidate_name')}\n"
            f"Current tech: {profile.get('technical_skills', {})}\n"
            f"Experience level: {profile.get('experience_level')}\n"
            f"Career trajectory: {profile.get('career_trajectory', '')}\n\n"
            "Output ONLY valid JSON."
        )
        return self._call_llm(system, human)

    # ── MASTER ORCHESTRATOR ────────────────────────────────────────────────────

    def full_analysis(self, resume_text: str, job_description: Optional[str] = None) -> dict:
        """
        Run complete pipeline: analysis -> questions -> bias -> coaching.
        Returns unified report dict.
        """
        analysis = self.analyze(resume_text, job_description)

        try:
            questions = self.generate_questions(resume_text, analysis, job_description)
        except Exception as e:
            questions = {"error": str(e)}

        try:
            bias = self.bias_report(resume_text, analysis)
        except Exception as e:
            bias = {"error": str(e)}

        try:
            coaching = self.coaching_feedback(resume_text, analysis)
        except Exception as e:
            coaching = {"error": str(e)}

        return {
            "analysis": analysis,
            "interview_questions": questions,
            "bias_report": bias,
            "candidate_feedback": coaching,
        }
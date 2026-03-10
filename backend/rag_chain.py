import os
import json
import re
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain.schema import HumanMessage, SystemMessage

load_dotenv()

GROQ_MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """You are TalentIQ — a world-class AI Talent Intelligence Engine used by Fortune 500 companies. You perform deep semantic resume analysis far beyond keyword matching. You understand career trajectories, transferable skills, and hidden potential. Always respond with valid JSON only — no markdown, no explanation, no text before or after the JSON."""

class ResumeAnalyzer:
    def __init__(self):
        self.llm = ChatGroq(
            model=GROQ_MODEL,
            temperature=0.2,
            groq_api_key=os.getenv("GROQ_API_KEY")
        )

    async def analyze(self, resume_text: str, job_description: str = "") -> dict:
        profile = await self._get_deep_profile(resume_text, job_description)
        questions = await self._get_interview_pack(resume_text, profile, job_description)
        bias_report = await self._get_bias_report(resume_text, profile)
        feedback = await self._get_candidate_feedback(profile, job_description)
        return {
            "analysis": profile,
            "interview_questions": questions,
            "bias_report": bias_report,
            "candidate_feedback": feedback
        }

    async def _get_deep_profile(self, resume_text: str, jd: str) -> dict:
        jd_context = f"\nJOB DESCRIPTION TO MATCH AGAINST:\n{jd[:3000]}" if jd else ""
        prompt = f"""Perform DEEP SEMANTIC ANALYSIS of this resume. Go beyond keywords — understand career trajectory, transferable skills, growth signals, and hidden potential.

Return ONLY this exact JSON structure:
{{
  "candidate_name": "full name",
  "current_role": "most recent job title",
  "current_company": "most recent company",
  "experience_level": "Intern/Junior/Mid/Senior/Lead/Principal/Executive",
  "years_of_experience": <number>,
  "contact": {{
    "email": "",
    "phone": "",
    "linkedin": "",
    "github": "",
    "portfolio": "",
    "location": ""
  }},
  "professional_summary": "3-4 sentence narrative summary highlighting unique value proposition",
  "career_trajectory": "Describe the career arc — is it ascending, lateral, pivoting? What patterns emerge?",
  "technical_skills": {{
    "languages": [],
    "frameworks": [],
    "databases": [],
    "cloud_devops": [],
    "tools": [],
    "ai_ml": [],
    "other": []
  }},
  "soft_skills": [],
  "inferred_skills": ["skills not explicitly listed but strongly implied by experience"],
  "transferable_skills": ["skills from different domains that add unique value"],
  "work_experience": [
    {{
      "role": "",
      "company": "",
      "duration": "",
      "key_achievements": [],
      "impact_metrics": ["quantified results if any"],
      "skills_demonstrated": []
    }}
  ],
  "education": [
    {{
      "degree": "",
      "institution": "",
      "year": "",
      "relevant_coursework": []
    }}
  ],
  "certifications": [],
  "projects": [
    {{
      "name": "",
      "description": "",
      "technologies": [],
      "impact": ""
    }}
  ],
  "top_strengths": [
    {{"strength": "", "evidence": "", "rarity": "Common/Uncommon/Rare"}}
  ],
  "potential_gaps": [
    {{"gap": "", "severity": "Minor/Moderate/Critical", "suggestion": ""}}
  ],
  "red_flags": [
    {{"flag": "", "explanation": "", "probe_question": ""}}
  ],
  "growth_signals": ["indicators of high potential and learning agility"],
  "unique_value_proposition": "1-2 sentence compelling pitch for this candidate",
  "ideal_role_fit": ["list of 3-5 roles this candidate would excel in"],
  "jd_match_score": <0-100 if JD provided, else null>,
  "jd_matched_skills": [],
  "jd_missing_skills": [],
  "jd_match_summary": "paragraph explaining alignment",
  "overall_score": <0-100>,
  "ats_scores": {{
    "keyword_density": <0-100>,
    "format_quality": <0-100>,
    "experience_depth": <0-100>,
    "skills_coverage": <0-100>,
    "achievement_impact": <0-100>,
    "career_progression": <0-100>
  }},
  "hire_recommendation": "Strongly Recommended / Recommended / Recommended with Caution / Not Recommended",
  "hire_rationale": "detailed reason for the recommendation"
}}

{jd_context}

RESUME:
{resume_text[:8000]}"""

        messages = [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=prompt)]
        response = self.llm.invoke(messages)
        return self._parse_json(response.content)

    async def _get_interview_pack(self, resume_text: str, profile: dict, jd: str) -> dict:
        jd_context = f"\nJOB DESCRIPTION:\n{jd[:1500]}" if jd else ""
        prompt = f"""Generate a comprehensive interview pack for this candidate. Create highly personalized questions based on their SPECIFIC experience, not generic ones.

Return ONLY this exact JSON:
{{
  "technical_questions": [
    {{
      "question": "",
      "skill_tested": "",
      "difficulty": "Easy/Medium/Hard",
      "expected_answer_hint": "",
      "follow_up": "",
      "scoring_rubric": "what separates a 3/5 from 5/5 answer"
    }}
  ],
  "behavioral_questions": [
    {{
      "question": "",
      "competency": "",
      "what_to_listen_for": "",
      "star_guidance": "what S-T-A-R elements to probe",
      "green_flag_answer": "",
      "red_flag_answer": ""
    }}
  ],
  "situational_questions": [
    {{
      "question": "",
      "scenario_purpose": "",
      "ideal_approach": "",
      "what_to_avoid": ""
    }}
  ],
  "culture_fit_questions": [
    {{
      "question": "",
      "what_to_listen_for": "",
      "alignment_signals": []
    }}
  ],
  "deep_dive_questions": [
    {{
      "question": "",
      "target": "specific resume item to probe deeper",
      "intent": "why ask this",
      "expected_depth": "what level of detail shows mastery"
    }}
  ],
  "red_flag_probes": [
    {{
      "question": "",
      "concern": "",
      "red_flag_answer": "",
      "green_flag_answer": ""
    }}
  ]
}}

Generate 5 questions per category (6 categories = 30 questions total). Make them HIGHLY SPECIFIC to this candidate's resume.

CANDIDATE PROFILE SUMMARY: {json.dumps({"name": profile.get("candidate_name"), "role": profile.get("current_role"), "experience": profile.get("years_of_experience"), "strengths": profile.get("top_strengths", [])[:3], "gaps": profile.get("potential_gaps", [])[:2]}, indent=2)}

RESUME: {resume_text[:3000]}
{jd_context}"""

        messages = [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=prompt)]
        response = self.llm.invoke(messages)
        return self._parse_json(response.content)

    async def _get_bias_report(self, resume_text: str, profile: dict) -> dict:
        prompt = f"""Perform an ETHICAL AI BIAS ANALYSIS on this resume evaluation. Act as a fairness auditor.

Return ONLY this exact JSON:
{{
  "pii_detected": {{
    "name": true,
    "location": <bool>,
    "graduation_year": <bool>,
    "phone": <bool>,
    "age_indicators": <bool>,
    "gender_indicators": <bool>,
    "ethnicity_indicators": <bool>
  }},
  "blind_review_recommendation": "What PII should be hidden for unbiased review",
  "potential_bias_vectors": [
    {{
      "vector": "e.g. School prestige bias",
      "risk_level": "Low/Medium/High",
      "explanation": "",
      "mitigation": ""
    }}
  ],
  "merit_indicators": [
    "specific achievements that should anchor evaluation — pure merit signals"
  ],
  "diversity_signals": [
    "non-traditional background elements that add value — career changers, unconventional paths"
  ],
  "evaluation_guidance": "How to evaluate this candidate fairly and focus on merit",
  "fairness_score": <0-100, how 'evaluatable on pure merit' this resume is>,
  "recommended_blind_fields": ["fields to hide before manager review"]
}}

CANDIDATE PROFILE: {json.dumps({"name": profile.get("candidate_name"), "location": profile.get("contact", {}).get("location"), "education": profile.get("education", [])[:2], "career_trajectory": profile.get("career_trajectory")}, indent=2)}

RESUME (first 2000 chars): {resume_text[:2000]}"""

        messages = [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=prompt)]
        response = self.llm.invoke(messages)
        return self._parse_json(response.content)

    async def _get_candidate_feedback(self, profile: dict, jd: str) -> dict:
        score = profile.get("overall_score", 50)
        jd_context = f"\nJOB DESCRIPTION:\n{jd[:1500]}" if jd else ""
        prompt = f"""Generate actionable, constructive candidate feedback. This should be professional, encouraging, and specific — NOT generic.

Return ONLY this exact JSON:
{{
  "overall_assessment": "2-3 sentence overall impression",
  "key_strengths_recognized": [
    {{"strength": "", "why_it_matters": ""}}
  ],
  "improvement_roadmap": [
    {{
      "area": "",
      "specific_action": "",
      "resources": ["specific courses, certifications, or projects to tackle"],
      "timeline": "e.g. 3-6 months"
    }}
  ],
  "quick_wins": ["things they can improve on their resume/profile in the next 7 days"],
  "career_advice": "1 paragraph of genuine, personalized career guidance",
  "skill_gap_courses": [
    {{
      "skill": "",
      "recommended_course": "",
      "platform": "Coursera/Udemy/LinkedIn Learning/etc.",
      "estimated_time": ""
    }}
  ],
  "next_application_tips": ["3-5 specific tips for their next application"],
  "encouragement": "1 genuine, specific encouraging note based on their unique background"
}}

CANDIDATE SCORE: {score}/100
CANDIDATE PROFILE: {json.dumps({"name": profile.get("candidate_name"), "strengths": profile.get("top_strengths", [])[:3], "gaps": profile.get("potential_gaps", [])[:3], "trajectory": profile.get("career_trajectory"), "unique_value": profile.get("unique_value_proposition")}, indent=2)}
{jd_context}"""

        messages = [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=prompt)]
        response = self.llm.invoke(messages)
        return self._parse_json(response.content)

    async def generate_outreach_email(self, profile: dict, job_title: str, company_name: str) -> dict:
        name = profile.get("candidate_name", "Candidate")
        role = profile.get("current_role", "")
        skills = profile.get("technical_skills", {})
        top_skills = (skills.get("languages", []) + skills.get("frameworks", []))[:5]
        strengths = [s.get("strength", s) if isinstance(s, dict) else s for s in profile.get("top_strengths", [])[:2]]
        uvp = profile.get("unique_value_proposition", "")

        prompt = f"""Write a hyper-personalized recruiter outreach email for a PASSIVE candidate. This should feel genuine, warm, and specific — NOT a template blast. Reference their real background.

Return ONLY this exact JSON:
{{
  "subject_line": "compelling subject that references something specific about them",
  "email_body": "full email text (3-4 paragraphs, max 250 words). Must: 1) reference their specific background, 2) explain why THIS role is a match for THEM, 3) give a clear low-friction CTA",
  "follow_up_subject": "follow-up subject line for 5 days later",
  "follow_up_body": "brief follow-up (max 80 words)",
  "personalization_hooks": ["3 specific things about this candidate that were woven into the email"],
  "tone_analysis": "what tone was chosen and why it fits this candidate's profile"
}}

CANDIDATE: {name}
CURRENT ROLE: {role}
TOP SKILLS: {', '.join(top_skills)}
KEY STRENGTHS: {', '.join(strengths)}
UNIQUE VALUE: {uvp}
TARGET JOB: {job_title}
YOUR COMPANY: {company_name}"""

        messages = [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=prompt)]
        response = self.llm.invoke(messages)
        return self._parse_json(response.content)

    async def generate_feedback_letter(self, profile: dict, decision: str, job_title: str) -> dict:
        name = profile.get("candidate_name", "Candidate")
        score = profile.get("overall_score", 50)
        gaps = profile.get("potential_gaps", [])[:3]
        strengths = profile.get("top_strengths", [])[:2]
        coaching = profile.get("_coaching", {})

        prompt = f"""Write a compassionate, professional, and genuinely USEFUL candidate feedback letter. This is NOT a generic rejection — it must give real, specific, actionable feedback that helps the candidate grow.

Return ONLY this exact JSON:
{{
  "subject_line": "subject line for the email",
  "letter_body": "full letter (4-5 paragraphs). Must include: 1) appreciation + specific strengths recognized, 2) honest but kind explanation of the gap, 3) 2-3 specific, actionable improvement suggestions, 4) encouragement that feels genuine. Max 300 words.",
  "strengths_highlighted": ["2-3 genuine things they did well"],
  "improvement_areas": [
    {{"area": "", "specific_suggestion": "", "resource": ""}}
  ],
  "encouragement_score": <1-10 warmth rating>,
  "next_steps_offered": ["concrete next steps given to candidate"]
}}

CANDIDATE: {name}
OVERALL SCORE: {score}/100
DECISION: {decision}
TARGET ROLE: {job_title}
GAPS IDENTIFIED: {json.dumps(gaps)}
STRENGTHS: {json.dumps(strengths)}"""

        messages = [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=prompt)]
        response = self.llm.invoke(messages)
        return self._parse_json(response.content)

    async def assess_skill_adjacency(self, profile: dict) -> dict:
        skills_all = profile.get("technical_skills", {})
        all_skills = []
        for v in skills_all.values():
            if isinstance(v, list):
                all_skills.extend(v)
        inferred = profile.get("inferred_skills", [])
        transferable = profile.get("transferable_skills", [])

        prompt = f"""Perform a DYNAMIC SKILL TAXONOMY analysis. Map skill adjacencies, learning paths, and hidden transferable strengths.

Return ONLY this exact JSON:
{{
  "skill_clusters": [
    {{
      "cluster_name": "e.g. 'Frontend Web Development'",
      "core_skills": ["skills they already have in this cluster"],
      "adjacent_skills": ["skills they could learn quickly given their background"],
      "mastery_level": "Beginner/Intermediate/Advanced/Expert",
      "market_demand": "Low/Medium/High/Very High",
      "cluster_description": "why these skills cluster together"
    }}
  ],
  "learning_accelerators": [
    {{
      "from_skill": "skill they have",
      "to_skill": "skill they could gain fast",
      "transfer_ease": "Easy/Medium/Hard",
      "why": "technical reason why this transfer is natural",
      "estimated_weeks": <number>
    }}
  ],
  "skill_gaps_by_role": [
    {{
      "role": "a role they'd be good at",
      "match_percent": <0-100>,
      "missing_skills": [],
      "time_to_qualify": "e.g. '3-6 months'"
    }}
  ],
  "hidden_strengths": ["skills not on the resume but strongly implied by their combination of experience"],
  "market_positioning": "How this candidate should position themselves in the job market given their unique skill mix"
}}

CANDIDATE SKILLS: {json.dumps(all_skills[:30])}
INFERRED SKILLS: {json.dumps(inferred[:10])}
TRANSFERABLE SKILLS: {json.dumps(transferable[:10])}
EXPERIENCE LEVEL: {profile.get("experience_level", "")}
YEARS: {profile.get("years_of_experience", 0)}"""

        messages = [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=prompt)]
        response = self.llm.invoke(messages)
        return self._parse_json(response.content)

    def _parse_json(self, text: str) -> dict:
        try:
            text = text.strip()
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                return json.loads(match.group())
        except Exception as e:
            print(f"JSON parse error: {e}")
        return {}
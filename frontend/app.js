/* ═══════════════════════════════════
   TalentIQ v2.0 — Complete Frontend
   ═══════════════════════════════════ */

const API = 'https://resume-analyzer-6wj1.onrender.com';
const $ = id => document.getElementById(id);
let resumeFile = null, resultData = null, activeTab = 'overview';

// ─── DRAG & DROP ───────────────────────────────────────────
const box = $('upload-box'), fi = $('file-input');
['dragover','dragenter'].forEach(e => box.addEventListener(e, ev => { ev.preventDefault(); box.classList.add('over'); }));
['dragleave','dragend'].forEach(e => box.addEventListener(e, () => box.classList.remove('over')));
box.addEventListener('drop', ev => {
  ev.preventDefault(); box.classList.remove('over');
  const f = ev.dataTransfer.files[0];
  if (f?.type === 'application/pdf') setFile(f);
  else showToast('Please drop a PDF file.', 'error');
});
box.addEventListener('click', e => { if (e.target.tagName !== 'LABEL' && e.target.tagName !== 'INPUT') fi.click(); });
fi.addEventListener('change', e => e.target.files[0] && setFile(e.target.files[0]));

function setFile(f) {
  resumeFile = f;
  $('fname').textContent = f.name;
  $('file-ready').classList.remove('hidden');
  const btn = $('go-btn');
  btn.disabled = false;
  $('btn-txt').textContent = 'Run Full Intelligence Analysis';
}

// ─── ANALYSIS FLOW ─────────────────────────────────────────
async function startAnalysis() {
  if (!resumeFile) return;
  show('s-loading'); hide('s-upload');

  const steps = ['ls1','ls2','ls3','ls4','ls5','ls6'];
  steps.forEach(id => $(id).classList.remove('active','done'));

  let cur = 0;
  const advance = () => {
    if (cur > 0) { $(steps[cur-1]).classList.remove('active'); $(steps[cur-1]).classList.add('done'); }
    if (cur < steps.length) { $(steps[cur]).classList.add('active'); cur++; }
  };
  advance();
  const timers = [
    setTimeout(advance, 5000),
    setTimeout(advance, 12000),
    setTimeout(advance, 19000),
    setTimeout(advance, 26000),
    setTimeout(advance, 33000),
  ];

  const fd = new FormData();
  fd.append('file', resumeFile);
  const jd = $('jd-input').value.trim();
  if (jd) fd.append('job_description', jd);

  try {
    const r = await fetch(`${API}/analyze`, { method: 'POST', body: fd });
    if (!r.ok) { const e = await r.json(); throw new Error(e.detail || 'Analysis failed'); }
    resultData = await r.json();
    timers.forEach(clearTimeout);
    steps.forEach(id => { $(id).classList.remove('active'); $(id).classList.add('done'); });
    setTimeout(() => renderResults(resultData), 700);
  } catch(e) {
    timers.forEach(clearTimeout);
    hide('s-loading'); show('s-upload');
    showToast(`Error: ${e.message}`, 'error');
  }
}

function resetApp() {
  hide('s-results'); show('s-upload');
  fi.value = ''; resumeFile = null; resultData = null;
  $('file-ready').classList.add('hidden');
  $('go-btn').disabled = true;
  $('btn-txt').textContent = 'Upload a Resume First';
  ['ls1','ls2','ls3','ls4','ls5','ls6'].forEach(id => $(id).classList.remove('active','done'));
}

function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }

// ─── RENDER RESULTS ─────────────────────────────────────────
function renderResults(d) {
  hide('s-loading'); show('s-results');
  const a = d.analysis || {}, q = d.interview_questions || {},
        bias = d.bias_report || {}, coaching = d.candidate_feedback || {};

  // Timestamp
  $('report-meta').textContent = `Generated ${new Date().toLocaleString()} · TalentIQ v2.0`;

  // Avatar
  const initials = (a.candidate_name || 'CA').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
  $('pav').textContent = initials;

  // Profile
  $('pname').textContent = a.candidate_name || 'Unknown Candidate';
  $('prole').textContent = [a.current_role, a.current_company && `@ ${a.current_company}`].filter(Boolean).join(' ');

  $('pchips').innerHTML = [
    a.experience_level && `<span class="pchip hi">${a.experience_level}</span>`,
    a.years_of_experience && `<span class="pchip">${a.years_of_experience} yrs exp</span>`,
    ...((a.ideal_role_fit || []).slice(0,2).map(r => `<span class="pchip grn">${r}</span>`))
  ].filter(Boolean).join('');

  const c = a.contact || {};
  $('plinks').innerHTML = [
    c.email && `<a href="mailto:${c.email}">✉ ${c.email}</a>`,
    c.linkedin && `<a href="${c.linkedin}" target="_blank">🔗 LinkedIn</a>`,
    c.github && `<a href="${c.github}" target="_blank">💻 GitHub</a>`,
    c.portfolio && `<a href="${c.portfolio}" target="_blank">🌐 Portfolio</a>`,
    c.location && `<span style="color:var(--t3);font-size:12px">📍 ${c.location}</span>`
  ].filter(Boolean).join('');

  $('puvp').textContent = a.unique_value_proposition || '';

  // Hire recommendation
  const rec = a.hire_recommendation || '';
  const rb = $('rec-badge');
  rb.textContent = rec;
  rb.className = rec.includes('Strongly') ? 'rec-badge rb-s'
    : rec.includes('Caution') ? 'rec-badge rb-c'
    : rec.includes('Not') ? 'rec-badge rb-n'
    : 'rec-badge rb-r';

  // KPI Strip
  const ats = a.ats_scores || {};
  const avgAts = Object.values(ats).length ? Math.round(Object.values(ats).reduce((s,v)=>s+v,0)/Object.values(ats).length) : 0;
  const qTotal = (q.technical_questions?.length||0)+(q.behavioral_questions?.length||0)+(q.situational_questions?.length||0)+(q.culture_fit_questions?.length||0)+(q.deep_dive_questions?.length||0)+(q.red_flag_probes?.length||0);
  $('kpi-strip').innerHTML = [
    { val: (a.overall_score||0), lbl: 'Overall Score', sub: a.hire_recommendation?.split(' ').slice(0,2).join(' ') || '', color: scoreColor(a.overall_score||0) },
    { val: avgAts+'%', lbl: 'ATS Avg Score', sub: '6-axis breakdown', color: '#818cf8' },
    { val: a.jd_match_score != null ? a.jd_match_score+'%' : 'N/A', lbl: 'JD Match Score', sub: a.jd_match_score != null ? 'vs job description' : 'No JD provided', color: '#10b981' },
    { val: qTotal||'30', lbl: 'Interview Qs', sub: '6 categories generated', color: '#22d3ee' },
    { val: a.years_of_experience||'—', lbl: 'Years Exp', sub: a.experience_level||'', color: '#a78bfa' },
    { val: (a.top_strengths||[]).length||'—', lbl: 'Key Strengths', sub: 'Identified by AI', color: '#f59e0b' },
  ].map(k => `
    <div class="kpi">
      <div class="kpi-val" style="color:${k.color}">${k.val}</div>
      <div class="kpi-lbl">${k.lbl}</div>
      <div class="kpi-sub">${k.sub}</div>
    </div>`).join('');

  // Score rings
  animRing('sc-arc', a.overall_score||0, 2*Math.PI*54);
  countUp('sc-n', a.overall_score||0, 1600);
  $('sc-grade').textContent = gradeLabel(a.overall_score||0);

  if (a.jd_match_score != null) {
    show('jd-score-card');
    animRing('jd-arc', a.jd_match_score, 2*Math.PI*54);
    countUp('jd-n', a.jd_match_score, 1600);
    $('jd-grade').textContent = gradeLabel(a.jd_match_score);
  }

  // Summary
  $('psummary').textContent = a.professional_summary || '';

  // ATS 6-axis
  const atsLabels = {
    keyword_density: 'Keyword Density',
    format_quality: 'Format Quality',
    experience_depth: 'Experience Depth',
    skills_coverage: 'Skills Coverage',
    achievement_impact: 'Achievement Impact',
    career_progression: 'Career Progression'
  };
  const atsSubs = {
    keyword_density: 'Role-relevant terms density',
    format_quality: 'Structure & ATS parseability',
    experience_depth: 'Detail & context per role',
    skills_coverage: 'Breadth of skill portfolio',
    achievement_impact: 'Quantified results present',
    career_progression: 'Growth trajectory clarity'
  };
  $('ats-grid').innerHTML = Object.entries(atsLabels).map(([k, lbl]) => {
    const v = ats[k] || 0;
    const cls = v >= 70 ? 'af-high' : v >= 45 ? 'af-mid' : 'af-low';
    return `<div class="ats-item">
      <div class="ats-item-hdr"><span class="ats-name">${lbl}</span><span class="ats-val">${v}%</span></div>
      <div class="ats-track"><div class="ats-fill ${cls}" style="width:0%" data-w="${v}%"></div></div>
      <div class="ats-sub">${atsSubs[k]||''}</div>
    </div>`;
  }).join('');
  setTimeout(() => document.querySelectorAll('.ats-fill').forEach(el => el.style.width = el.dataset.w), 300);

  // Tab nav
  document.querySelectorAll('.tb').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tb').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.t;
      renderTab(activeTab, a, q, bias, coaching);
    });
  });
  renderTab('overview', a, q, bias, coaching);
}

// ─── TAB RENDERER ───────────────────────────────────────────
function renderTab(tab, a, q, bias, coaching) {
  const body = $('tab-body');
  const map = {
    overview:    () => tabOverview(a),
    skills:      () => tabSkills(a),
    experience:  () => tabExperience(a),
    analysis:    () => tabAnalysis(a),
    jdmatch:     () => tabJdMatch(a),
    technical:   () => tabQuestions(q.technical_questions||[], 'technical'),
    behavioral:  () => tabQuestions(q.behavioral_questions||[], 'behavioral'),
    situational: () => tabQuestions(q.situational_questions||[], 'situational'),
    deepdive:    () => tabDeepDive(q.deep_dive_questions||[], q.culture_fit_questions||[]),
    redflags:    () => tabRedFlags(q.red_flag_probes||[], a.red_flags||[]),
    bias:        () => tabBias(bias),
    coaching:    () => tabCoaching(coaching, a),
    outreach:    () => tabOutreach(a),
    adjacency:   () => tabAdjacency(a),
  };
  body.innerHTML = (map[tab] || (() => '<p style="color:var(--t2);padding:24px">Coming soon.</p>'))();
  body.querySelectorAll('.ats-fill').forEach(el => { el.style.width = '0%'; setTimeout(()=> el.style.width = el.dataset.w, 100); });
}

// ─── OVERVIEW TAB ────────────────────────────────────────────
function tabOverview(a) {
  const inferred = (a.inferred_skills||[]).slice(0,10);
  const transferable = (a.transferable_skills||[]).slice(0,8);
  const growth = a.growth_signals||[];
  const idealRoles = a.ideal_role_fit||[];

  return `<div class="overview-grid">
    <div class="ov-card">
      <div class="ov-ttl">🚀 Career Trajectory</div>
      <div class="traj-text">${a.career_trajectory || 'No trajectory data available.'}</div>
    </div>
    <div class="ov-card">
      <div class="ov-ttl">💎 Unique Value Proposition</div>
      <div class="uvp-text">${a.unique_value_proposition || '—'}</div>
    </div>
    <div class="ov-card">
      <div class="ov-ttl">🎯 Ideal Role Fits</div>
      <div class="ideal-roles">${idealRoles.map(r=>`<span class="ir-tag">${r}</span>`).join('') || '<span style="color:var(--t3)">—</span>'}</div>
    </div>
    <div class="ov-card">
      <div class="ov-ttl">🧩 Inferred Hidden Skills</div>
      <div class="inf-skills">${inferred.map(s=>`<span class="inf-tag">${s}</span>`).join('') || '<span style="color:var(--t3)">None detected</span>'}</div>
    </div>
    <div class="ov-card">
      <div class="ov-ttl">🔀 Transferable Skills</div>
      <div class="inf-skills">${transferable.map(s=>`<span class="inf-tag" style="background:rgba(167,139,250,.07);border-color:rgba(167,139,250,.2);color:var(--pur)">${s}</span>`).join('') || '<span style="color:var(--t3)">None detected</span>'}</div>
    </div>
    <div class="ov-card">
      <div class="ov-ttl">📈 Growth Signals</div>
      <div class="growth-list">${growth.map(g=>`<div class="growth-item">${g}</div>`).join('') || '<span style="color:var(--t3)">No signals detected</span>'}</div>
    </div>
    ${(a.hire_rationale) ? `<div class="ov-card" style="grid-column:1/-1">
      <div class="ov-ttl">🏛 AI Hire Rationale</div>
      <div class="traj-text" style="font-style:normal;border-color:var(--ind)">${a.hire_rationale}</div>
    </div>` : ''}
    ${(a.education?.length) ? `<div class="ov-card" style="grid-column:1/-1">
      <div class="ov-ttl">🎓 Education</div>
      <div style="display:flex;flex-wrap:wrap;gap:12px">${a.education.map(e=>`<div style="background:var(--card2);border:1px solid var(--b2);border-radius:10px;padding:12px 16px;min-width:220px"><div style="font-weight:600;color:var(--t1)">${e.degree||''}</div><div style="font-size:12.5px;color:var(--cyan);margin:2px 0">${e.institution||''}</div><div style="font-size:11.5px;color:var(--t3)">${e.year||''}</div>${(e.relevant_coursework||[]).length?`<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px">${e.relevant_coursework.map(c=>`<span style="font-size:11px;padding:2px 7px;border-radius:4px;background:rgba(129,140,248,.08);color:var(--ind)">${c}</span>`).join('')}</div>`:''}</div>`).join('')}</div>
    </div>` : ''}
    ${(a.certifications?.length) ? `<div class="ov-card">
      <div class="ov-ttl">📜 Certifications</div>
      <div style="display:flex;flex-direction:column;gap:6px">${a.certifications.map(c=>`<div style="font-size:13px;color:var(--t2);padding:7px 12px;background:rgba(34,211,238,.05);border:1px solid rgba(34,211,238,.15);border-radius:7px">🏅 ${c}</div>`).join('')}</div>
    </div>` : ''}
    ${(a.projects?.length) ? `<div class="ov-card">
      <div class="ov-ttl">🛠 Notable Projects</div>
      <div style="display:flex;flex-direction:column;gap:10px">${a.projects.map(p=>`<div style="background:var(--card2);border-radius:9px;padding:12px"><div style="font-weight:600;font-size:13.5px;color:var(--t1);margin-bottom:3px">${p.name||''}</div><div style="font-size:12.5px;color:var(--t2);margin-bottom:7px">${p.description||''}</div>${p.impact?`<div style="font-size:12px;color:var(--grn);margin-bottom:6px">📊 ${p.impact}</div>`:''}${(p.technologies||[]).map(t=>`<span style="font-size:11px;padding:2px 8px;border-radius:4px;background:var(--card);border:1px solid var(--b2);color:var(--t3);margin:2px">${t}</span>`).join('')}</div>`).join('')}</div>
    </div>` : ''}
  </div>`;
}

// ─── SKILLS TAB ──────────────────────────────────────────────
function tabSkills(a) {
  const sk = a.technical_skills || {};
  const groups = [
    { title: '⚡ Languages', items: sk.languages, cls: 'p' },
    { title: '🛠 Frameworks & Libraries', items: sk.frameworks, cls: 's' },
    { title: '🗄 Databases', items: sk.databases, cls: '' },
    { title: '☁️ Cloud & DevOps', items: sk.cloud_devops, cls: 't' },
    { title: '🤖 AI / ML', items: sk.ai_ml, cls: 'p' },
    { title: '🔧 Tools & Platforms', items: sk.tools, cls: '' },
    { title: '🧩 Other Technical', items: sk.other, cls: '' },
    { title: '🤝 Soft Skills', items: a.soft_skills, cls: '' },
  ].filter(g => g.items?.length);

  const inferred = a.inferred_skills || [];
  const transferable = a.transferable_skills || [];

  return `<div class="skills-grid">
    ${groups.map(g => `<div class="sg-card">
      <div class="sg-ttl">${g.title}</div>
      <div class="sg-tags">${g.items.map(s=>`<span class="stag ${g.cls}">${s}</span>`).join('')}</div>
    </div>`).join('')}
    ${inferred.length ? `<div class="sg-card" style="border-color:rgba(34,211,238,.2)">
      <div class="sg-ttl" style="color:var(--cyan)">🧠 AI-Inferred (Not Explicit)</div>
      <div class="sg-tags">${inferred.map(s=>`<span class="stag s">${s}</span>`).join('')}</div>
    </div>` : ''}
    ${transferable.length ? `<div class="sg-card" style="border-color:rgba(167,139,250,.2)">
      <div class="sg-ttl" style="color:var(--pur)">🔀 Transferable Skills</div>
      <div class="sg-tags">${transferable.map(s=>`<span class="stag t">${s}</span>`).join('')}</div>
    </div>` : ''}
  </div>
  <div style="margin-top:20px;text-align:right">
    <button onclick="loadSkillAdjacency()" class="tool-btn" style="background:rgba(129,140,248,.1);border:1px solid rgba(129,140,248,.3);color:var(--ind);padding:9px 18px;border-radius:8px;font-size:13px;cursor:pointer;font-family:var(--fb);transition:all .2s" onmouseover="this.style.background='rgba(129,140,248,.2)'" onmouseout="this.style.background='rgba(129,140,248,.1)'">
      🗺️ Run Skill Adjacency & Learning Path Analysis →
    </button>
  </div>
  <div id="adjacency-result"></div>`;
}

// ─── EXPERIENCE TAB ──────────────────────────────────────────
function tabExperience(a) {
  const exps = a.work_experience || [];
  if (!exps.length) return '<p style="color:var(--t2);padding:24px">No work experience found.</p>';
  return `<div class="exp-tl">${exps.map(e => `
    <div class="exp-item">
      <div class="exp-dot"></div>
      <div class="exp-card">
        <div class="exp-hdr">
          <div class="exp-role">${e.role||''}</div>
          <div class="exp-dur">${e.duration||''}</div>
        </div>
        <div class="exp-co">${e.company||''}</div>
        <ul class="exp-ach">${(e.key_achievements||[]).map(a=>`<li>${a}</li>`).join('')}</ul>
        ${(e.impact_metrics||[]).length ? `<div class="exp-metrics">${e.impact_metrics.map(m=>`<span class="exp-metric">📊 ${m}</span>`).join('')}</div>` : ''}
        ${(e.skills_demonstrated||[]).length ? `<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:5px">${e.skills_demonstrated.map(s=>`<span style="font-size:11px;padding:3px 9px;border-radius:4px;background:rgba(129,140,248,.08);border:1px solid rgba(129,140,248,.18);color:var(--ind)">${s}</span>`).join('')}</div>` : ''}
      </div>
    </div>`).join('')}</div>`;
}

// ─── ANALYSIS TAB ────────────────────────────────────────────
function tabAnalysis(a) {
  const str = a.top_strengths || [], gaps = a.potential_gaps || [];
  const rarityClass = r => r==='Rare'?'r-rare':r==='Uncommon'?'r-uncommon':'r-common';
  const sevClass = s => s==='Critical'?'sev-c':s==='Moderate'?'sev-m':'sev-mi';
  return `
    <div class="sec-hdr">✅ Top Strengths (${str.length})</div>
    <div class="analysis-grid">${str.map(s=>`<div class="str-card">
      <div class="str-ttl">${s.strength||s}</div>
      <div class="str-ev" style="color:var(--t2);font-size:13px">${s.evidence||''}</div>
      ${s.rarity?`<span class="rarity ${rarityClass(s.rarity)}">${s.rarity}</span>`:''}
    </div>`).join('') || '<p style="color:var(--t3)">None identified</p>'}</div>
    <div class="sec-hdr">⚠️ Potential Gaps (${gaps.length})</div>
    <div class="analysis-grid">${gaps.map(g=>`<div class="gap-card">
      ${g.severity?`<span class="sev ${sevClass(g.severity)}">${g.severity}</span>`:''}
      <div class="gap-ttl">${g.gap||g}</div>
      <div style="font-size:13px;color:var(--t2);line-height:1.6">${g.suggestion||''}</div>
    </div>`).join('') || '<p style="color:var(--t3)">No significant gaps identified</p>'}</div>`;
}

// ─── JD MATCH TAB ────────────────────────────────────────────
function tabJdMatch(a) {
  if (a.jd_match_score == null) {
    return `<div class="no-jd">
      <div style="font-size:48px;margin-bottom:16px">🎯</div>
      <strong>No Job Description Provided</strong>
      <p>Go back to the upload screen and paste a job description to get JD match scoring, skill gap analysis, and role-specific questions.</p>
      <button onclick="resetApp()" style="margin-top:20px;background:rgba(129,140,248,.1);border:1px solid rgba(129,140,248,.3);color:var(--ind);padding:10px 22px;border-radius:8px;font-size:14px;cursor:pointer;font-family:var(--fb)">← Start New Analysis with JD</button>
    </div>`;
  }
  const matched = a.jd_matched_skills || [], missing = a.jd_missing_skills || [];
  return `
    <div class="jd-match-grid">
      <div class="jd-card green">
        <div class="jd-card-ttl">✅ Matched Skills (${matched.length})</div>
        <div>${matched.map(s=>`<span class="jd-skill-tag match">${s}</span>`).join('') || '<span style="color:var(--t3)">None matched</span>'}</div>
      </div>
      <div class="jd-card red">
        <div class="jd-card-ttl">❌ Missing Skills (${missing.length})</div>
        <div>${missing.map(s=>`<span class="jd-skill-tag miss">${s}</span>`).join('') || '<span style="color:var(--grn)">No gaps found 🎉</span>'}</div>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="card-ttl">📋 Match Analysis</div>
      <p class="jd-summary-text">${a.jd_match_summary || '—'}</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
      <div class="kpi"><div class="kpi-val" style="color:var(--grn)">${a.jd_match_score||0}%</div><div class="kpi-lbl">Overall Match</div></div>
      <div class="kpi"><div class="kpi-val" style="color:var(--cyan)">${matched.length}</div><div class="kpi-lbl">Skills Matched</div></div>
      <div class="kpi"><div class="kpi-val" style="color:var(--red)">${missing.length}</div><div class="kpi-lbl">Skills Missing</div></div>
    </div>`;
}

// ─── QUESTIONS TABS ──────────────────────────────────────────
function tabQuestions(qs, type) {
  if (!qs.length) return '<p style="color:var(--t2);padding:24px">No questions generated for this category.</p>';
  return `<div class="q-list">${qs.map((q,i) => {
    const d = q.difficulty||'';
    const dc = d==='Easy'?'qt-e':d==='Hard'?'qt-h':'qt-m';
    const tag = q.skill_tested||q.competency||q.scenario_purpose||'';
    return `<div class="q-card">
      <div class="q-meta">
        <span class="q-num">Q${i+1}</span>
        ${tag?`<span class="qtag qt-i">${tag}</span>`:''}
        ${d?`<span class="qtag ${dc}">${d}</span>`:''}
      </div>
      <div class="q-text">${q.question}</div>
      <div class="q-hints">
        ${q.expected_answer_hint?`<div class="qh"><strong>💡 Look for:</strong> ${q.expected_answer_hint}</div>`:''}
        ${q.what_to_listen_for?`<div class="qh"><strong>👂 Listen for:</strong> ${q.what_to_listen_for}</div>`:''}
        ${q.star_guidance?`<div class="qh"><strong>⭐ STAR Probe:</strong> ${q.star_guidance}</div>`:''}
        ${q.ideal_approach?`<div class="qh"><strong>✅ Ideal approach:</strong> ${q.ideal_approach}</div>`:''}
        ${q.what_to_avoid?`<div class="qh"><strong>⚠️ Watch for:</strong> ${q.what_to_avoid}</div>`:''}
        ${q.green_flag_answer?`<div class="qh"><strong>🟢 Green flag:</strong> ${q.green_flag_answer}</div>`:''}
        ${q.red_flag_answer?`<div class="qh"><strong>🔴 Red flag:</strong> ${q.red_flag_answer}</div>`:''}
        ${q.follow_up?`<div class="qh"><strong>→ Follow-up:</strong> ${q.follow_up}</div>`:''}
        ${q.scoring_rubric?`<div class="q-rubric">📊 Rubric: ${q.scoring_rubric}</div>`:''}
      </div>
    </div>`;
  }).join('')}</div>`;
}

// ─── DEEP DIVE TAB ───────────────────────────────────────────
function tabDeepDive(deepDive, culture) {
  return `
    <div class="sec-hdr">🔬 Deep Dive Questions (Resume-Specific)</div>
    <div class="q-list">${deepDive.map((q,i) => `<div class="q-card">
      <div class="q-meta"><span class="q-num">DD${i+1}</span>${q.target?`<span class="qtag qt-c">${q.target}</span>`:''}</div>
      <div class="q-text">${q.question}</div>
      <div class="q-hints">
        ${q.intent?`<div class="qh"><strong>🎯 Intent:</strong> ${q.intent}</div>`:''}
        ${q.expected_depth?`<div class="qh"><strong>📏 Depth expected:</strong> ${q.expected_depth}</div>`:''}
      </div>
    </div>`).join('') || '<p style="color:var(--t3);padding:20px">No deep-dive questions generated.</p>'}
    </div>
    <div class="sec-hdr" style="margin-top:24px">🌍 Culture Fit Questions</div>
    <div class="q-list">${culture.map((q,i) => `<div class="q-card">
      <div class="q-meta"><span class="q-num">CF${i+1}</span></div>
      <div class="q-text">${q.question}</div>
      <div class="q-hints">
        ${q.what_to_listen_for?`<div class="qh"><strong>👂 Listen for:</strong> ${q.what_to_listen_for}</div>`:''}
        ${(q.alignment_signals||[]).length?`<div class="qh"><strong>✅ Alignment signals:</strong> ${q.alignment_signals.join(', ')}</div>`:''}
      </div>
    </div>`).join('') || '<p style="color:var(--t3);padding:20px">No culture fit questions generated.</p>'}
    </div>`;
}

// ─── RED FLAGS TAB ───────────────────────────────────────────
function tabRedFlags(probes, resumeFlags) {
  return `
    ${resumeFlags.length ? `
      <div class="sec-hdr">⚠️ Resume Red Flags Detected</div>
      ${resumeFlags.map(f=>`<div class="rf-card" style="border-color:rgba(245,158,11,.25)">
        <div class="rf-badge" style="color:var(--amb)">⚠️ Flag</div>
        <div class="q-text">${f.flag||f}</div>
        <div class="q-hints">
          ${f.explanation?`<div class="qh"><strong>Explanation:</strong> ${f.explanation}</div>`:''}
          ${f.probe_question?`<div class="qh"><strong>🔍 Probe with:</strong> "${f.probe_question}"</div>`:''}
        </div>
      </div>`).join('')}
    ` : ''}
    <div class="sec-hdr" style="margin-top:${resumeFlags.length?'24px':'0'}">🚩 Red Flag Interview Probes</div>
    ${probes.map((p,i) => `<div class="rf-card">
      <div class="rf-badge">🚩 Red Flag Probe ${i+1}</div>
      <div class="q-text">${p.question}</div>
      <div class="q-hints">
        ${p.concern?`<div class="qh"><strong>⚠️ Concern:</strong> ${p.concern}</div>`:''}
        ${p.green_flag_answer?`<div class="qh"><strong>🟢 Good answer:</strong> ${p.green_flag_answer}</div>`:''}
        ${p.red_flag_answer?`<div class="qh"><strong>🔴 Bad answer:</strong> ${p.red_flag_answer}</div>`:''}
      </div>
    </div>`).join('') || '<p style="color:var(--t3);padding:24px">No red flag probes generated.</p>'}`;
}

// ─── BIAS AUDIT TAB ──────────────────────────────────────────
function tabBias(bias) {
  if (!bias || !Object.keys(bias).length) return '<p style="color:var(--t2);padding:24px">Bias report not available.</p>';
  const pii = bias.pii_detected || {};
  const vectors = bias.potential_bias_vectors || [];
  const merit = bias.merit_indicators || [];
  const blind = bias.recommended_blind_fields || [];
  const fair = bias.fairness_score || 0;

  return `
    <div class="bias-grid">
      <div class="bias-card">
        <div class="card-ttl">🔍 PII Detection Scan</div>
        ${Object.entries(pii).map(([k,v]) => `<div class="pii-item">
          <span class="pii-name">${k.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</span>
          <span class="${v?'pii-yes':'pii-no'}">${v?'⚠️ Detected':'✓ Clear'}</span>
        </div>`).join('')}
      </div>
      <div class="bias-card" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px">
        <div class="fair-score">
          <div style="font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">Fairness Score</div>
          <div class="fair-n">${fair}</div>
          <div style="font-size:12px;color:var(--t2)">/100 — Evaluatable on Merit</div>
        </div>
        <div style="font-size:13px;color:var(--t2);padding:12px;background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.15);border-radius:9px;line-height:1.65">
          <strong style="color:var(--amb)">🙈 Blind Review Recommendation:</strong><br>${bias.blind_review_recommendation||'—'}
        </div>
      </div>
    </div>

    <div class="sec-hdr">⚠️ Potential Bias Vectors</div>
    ${vectors.map(v => {
      const rc = v.risk_level==='High'?'bv-h':v.risk_level==='Medium'?'bv-m':'bv-l';
      return `<div class="bias-vector">
        <div class="bv-hdr"><span class="bv-name">${v.vector||''}</span><span class="bv-risk ${rc}">${v.risk_level||''}</span></div>
        <div class="bv-exp">${v.explanation||''}</div>
        <div class="bv-mit">💡 Mitigation: ${v.mitigation||''}</div>
      </div>`;
    }).join('') || '<p style="color:var(--t3)">No bias vectors identified.</p>'}

    <div class="sec-hdr">✅ Pure Merit Indicators</div>
    <div class="merit-list">${merit.map(m=>`<div class="merit-item">⚡ ${m}</div>`).join('') || '<p style="color:var(--t3)">None identified</p>'}</div>

    <div class="sec-hdr" style="margin-top:20px">🙈 Recommended Blind Fields (hide before manager review)</div>
    <div class="blind-list">${blind.map(b=>`<div class="blind-item">🔒 ${b}</div>`).join('') || '<p style="color:var(--t3)">No fields recommended</p>'}</div>

    ${bias.evaluation_guidance ? `
      <div style="margin-top:20px;background:rgba(129,140,248,.07);border:1px solid rgba(129,140,248,.2);border-radius:var(--r);padding:18px">
        <div class="card-ttl">📋 Fair Evaluation Guidance</div>
        <p style="font-size:13.5px;color:var(--t2);line-height:1.75">${bias.evaluation_guidance}</p>
      </div>` : ''}

    ${(bias.diversity_signals||[]).length ? `
      <div style="margin-top:16px;background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.15);border-radius:var(--r);padding:18px">
        <div class="card-ttl" style="color:var(--grn)">🌈 Diversity & Non-Traditional Value Signals</div>
        <div class="merit-list">${(bias.diversity_signals||[]).map(s=>`<div class="merit-item" style="border-color:var(--grn)">🌱 ${s}</div>`).join('')}</div>
      </div>` : ''}`;
}

// ─── COACHING TAB ────────────────────────────────────────────
function tabCoaching(coaching, a) {
  if (!coaching || !Object.keys(coaching).length) return '<p style="color:var(--t2);padding:24px">Coaching report not available.</p>';
  const roadmap = coaching.improvement_roadmap || [];
  const wins = coaching.quick_wins || [];
  const courses = coaching.skill_gap_courses || [];
  const strengths = coaching.key_strengths_recognized || [];
  const tips = coaching.next_application_tips || [];

  return `
    ${coaching.overall_assessment ? `
      <div class="encourage-box" style="margin-bottom:20px">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--ind);margin-bottom:8px">🤖 AI Overall Assessment</div>
        <div class="encourage-text">${coaching.overall_assessment}</div>
      </div>` : ''}

    <div class="coaching-grid">
      <div class="coach-card">
        <div class="coach-ttl">💪 Strengths Recognized</div>
        ${strengths.map(s=>`<div class="strength-item">
          <div class="si-name">✅ ${s.strength||s}</div>
          <div class="si-why">${s.why_it_matters||''}</div>
        </div>`).join('') || '<p style="color:var(--t3)">No strengths data</p>'}
      </div>

      <div class="coach-card">
        <div class="coach-ttl">⚡ Quick Wins (Next 7 Days)</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${wins.map(w=>`<div class="quick-win">${w}</div>`).join('') || '<p style="color:var(--t3)">No quick wins available</p>'}
        </div>
      </div>
    </div>

    <div class="sec-hdr">🗺️ Improvement Roadmap</div>
    ${roadmap.map(r=>`<div class="roadmap-item">
      <div class="rm-area">${r.area||''}</div>
      <div class="rm-action">${r.specific_action||''}</div>
      <div class="rm-meta">
        ${r.timeline?`<span class="rm-tag rm-time">⏱ ${r.timeline}</span>`:''}
        ${(r.resources||[]).map(res=>`<span class="rm-tag rm-res">📚 ${res}</span>`).join('')}
      </div>
    </div>`).join('') || '<p style="color:var(--t3)">No roadmap available</p>'}

    <div class="sec-hdr">📚 Recommended Courses & Certifications</div>
    <div class="coach-card">
      ${courses.map(c=>`<div class="course-item">
        <div class="course-icon">🎓</div>
        <div>
          <div class="course-skill">${c.skill||''}</div>
          <div class="course-name">${c.recommended_course||''}</div>
          <div class="course-meta">${c.platform||''} ${c.estimated_time?`· ${c.estimated_time}`:''}</div>
        </div>
      </div>`).join('') || '<p style="color:var(--t3)">No courses available</p>'}
    </div>

    ${tips.length ? `
      <div class="sec-hdr">🚀 Next Application Tips</div>
      <div class="coach-card">
        <div style="display:flex;flex-direction:column;gap:8px">
          ${tips.map((t,i)=>`<div style="font-size:13.5px;color:var(--t2);padding:10px 14px;background:var(--card2);border-radius:8px;line-height:1.6"><strong style="color:var(--ind)">${i+1}.</strong> ${t}</div>`).join('')}
        </div>
      </div>` : ''}

    ${coaching.career_advice ? `
      <div class="sec-hdr">🧭 Personalized Career Advice</div>
      <div style="background:rgba(34,211,238,.06);border:1px solid rgba(34,211,238,.15);border-radius:var(--r);padding:18px">
        <p style="font-size:14px;color:var(--t1);line-height:1.85;font-style:italic">"${coaching.career_advice}"</p>
      </div>` : ''}

    ${coaching.encouragement ? `
      <div class="encourage-box" style="margin-top:20px">
        <div style="font-size:20px;margin-bottom:8px">✨</div>
        <div class="encourage-text">"${coaching.encouragement}"</div>
      </div>` : ''}

    <div class="sec-hdr" style="margin-top:24px">📧 Generate Candidate Feedback Letter</div>
    <div class="card" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center">
      <input id="fb-role" placeholder="Job Title e.g. Senior Frontend Engineer" style="flex:1;min-width:200px;background:var(--card2);border:1px solid var(--b2);color:var(--t1);padding:10px 14px;border-radius:8px;font-size:13px;font-family:var(--fb);outline:none">
      <select id="fb-decision" style="background:var(--card2);border:1px solid var(--b2);color:var(--t1);padding:10px 14px;border-radius:8px;font-size:13px;font-family:var(--fb);outline:none">
        <option value="Not Selected">Not Selected</option>
        <option value="Moving Forward">Moving Forward</option>
        <option value="On Hold">On Hold</option>
      </select>
      <button onclick="generateFeedbackLetter()" style="background:linear-gradient(135deg,var(--grn),#34d399);color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:13.5px;font-weight:600;cursor:pointer;font-family:var(--fb);white-space:nowrap">✉ Generate Letter</button>
    </div>
    <div id="feedback-result"></div>`;
}

// ─── OUTREACH TAB ────────────────────────────────────────────
function tabOutreach(a) {
  return `
    <div style="background:linear-gradient(135deg,rgba(129,140,248,.08),rgba(34,211,238,.05));border:1px solid rgba(129,140,248,.2);border-radius:var(--r);padding:20px;margin-bottom:20px">
      <div style="font-size:13.5px;color:var(--t2);line-height:1.7">
        <strong style="color:var(--t1)">Pillar 4: Generative Outreach (Intelligent Candidate Engagement)</strong><br>
        Generate a hyper-personalized outreach email for this candidate based on their unique background. Unlike template blasts, this email references their specific experience, skills, and value proposition.
      </div>
    </div>
    <div class="card" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:16px">
      <input id="or-role" placeholder="Role you're recruiting for..." style="flex:1;min-width:200px;background:var(--card2);border:1px solid var(--b2);color:var(--t1);padding:10px 14px;border-radius:8px;font-size:13px;font-family:var(--fb);outline:none">
      <input id="or-company" placeholder="Your company name..." style="flex:1;min-width:180px;background:var(--card2);border:1px solid var(--b2);color:var(--t1);padding:10px 14px;border-radius:8px;font-size:13px;font-family:var(--fb);outline:none">
      <button onclick="generateOutreachEmail()" style="background:linear-gradient(135deg,var(--ind),#7c3aed);color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:13.5px;font-weight:600;cursor:pointer;font-family:var(--fb);white-space:nowrap">✉ Generate Email</button>
    </div>
    <div id="outreach-result"></div>`;
}

// ─── ADJACENCY TAB ───────────────────────────────────────────
function tabAdjacency(a) {
  return `
    <div style="background:linear-gradient(135deg,rgba(129,140,248,.08),rgba(34,211,238,.05));border:1px solid rgba(129,140,248,.2);border-radius:var(--r);padding:20px;margin-bottom:20px">
      <div style="font-size:13.5px;color:var(--t2);line-height:1.7">
        <strong style="color:var(--t1)">Pillar 2: Dynamic Skill Taxonomy & Learning Path Engine</strong><br>
        Maps overlapping technologies, identifies fast learning paths, and reveals hidden skill clusters. Shows which skills this candidate could acquire fastest based on their existing knowledge graph.
      </div>
    </div>
    <button onclick="loadSkillAdjacency()" style="background:linear-gradient(135deg,var(--ind),#7c3aed);color:#fff;border:none;padding:12px 24px;border-radius:9px;font-size:14px;font-weight:600;cursor:pointer;font-family:var(--fb);margin-bottom:20px">
      🗺️ Run Full Skill Adjacency Analysis
    </button>
    <div id="adjacency-result"></div>`;
}

// ─── INTERACTIVE TOOLS ───────────────────────────────────────
async function generateOutreachEmail() {
  if (!resultData?.analysis) return;
  const role = $('or-role')?.value || 'Software Engineer';
  const company = $('or-company')?.value || 'Our Company';
  const el = $('outreach-result');
  el.innerHTML = loadingHTML('Generating personalized outreach email...');

  try {
    const r = await fetch(`${API}/generate-outreach`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ profile: resultData.analysis, job_title: role, company_name: company })
    });
    const data = await r.json();
    el.innerHTML = renderEmailResult(data, 'Outreach Email', role, company);
  } catch(e) {
    el.innerHTML = errorHTML(e.message);
  }
}

async function generateFeedbackLetter() {
  if (!resultData?.analysis) return;
  const role = $('fb-role')?.value || 'Software Engineer';
  const decision = $('fb-decision')?.value || 'Not Selected';
  const el = $('feedback-result');
  el.innerHTML = loadingHTML('Generating candidate feedback letter...');

  try {
    const r = await fetch(`${API}/generate-feedback-letter`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ profile: resultData.analysis, decision, job_title: role })
    });
    const data = await r.json();
    el.innerHTML = renderFeedbackResult(data, decision, role);
  } catch(e) {
    el.innerHTML = errorHTML(e.message);
  }
}

async function loadSkillAdjacency() {
  if (!resultData?.analysis) return;
  const el = $('adjacency-result');
  if (!el) return;
  el.innerHTML = loadingHTML('Running skill taxonomy & adjacency analysis...');

  try {
    const r = await fetch(`${API}/skill-adjacency`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ profile: resultData.analysis })
    });
    const data = await r.json();
    el.innerHTML = renderAdjacencyResult(data);
  } catch(e) {
    el.innerHTML = errorHTML(e.message);
  }
}

// ─── RESULT RENDERERS ────────────────────────────────────────
function renderEmailResult(data, type, role, company) {
  if (!data || !data.email_body) return errorHTML('Email generation failed.');
  const subject = data.subject_line || '';
  const body = data.email_body || '';
  const hooks = data.personalization_hooks || [];

  return `<div class="card" style="margin-top:16px">
    <div class="card-ttl">✉ Generated ${type} — ${role} at ${company}</div>
    <div style="background:var(--card2);border:1px solid var(--b2);border-radius:10px;padding:16px 20px;margin-bottom:14px">
      <div style="font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">Subject Line</div>
      <div style="font-size:14.5px;font-weight:600;color:var(--t1)">${subject}</div>
    </div>
    <div style="background:var(--card2);border:1px solid var(--b2);border-radius:10px;padding:16px 20px;margin-bottom:14px">
      <div style="font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px">Email Body</div>
      <div style="font-size:13.5px;color:var(--t2);line-height:1.85;white-space:pre-line">${body}</div>
    </div>
    ${data.follow_up_subject ? `<div style="background:rgba(34,211,238,.05);border:1px solid rgba(34,211,238,.15);border-radius:10px;padding:14px 18px;margin-bottom:14px">
      <div style="font-size:11px;color:var(--cyan);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px">Follow-Up (5 Days Later)</div>
      <div style="font-size:13px;font-weight:600;color:var(--t1);margin-bottom:6px">${data.follow_up_subject}</div>
      <div style="font-size:13px;color:var(--t2);line-height:1.75;white-space:pre-line">${data.follow_up_body||''}</div>
    </div>` : ''}
    ${hooks.length ? `<div style="margin-top:12px">
      <div style="font-size:11px;color:var(--t3);margin-bottom:8px;text-transform:uppercase;letter-spacing:.8px">🎯 Personalization Hooks Used</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${hooks.map(h=>`<span style="font-size:12px;padding:4px 12px;border-radius:5px;background:rgba(129,140,248,.1);border:1px solid rgba(129,140,248,.2);color:var(--ind)">${h}</span>`).join('')}</div>
    </div>` : ''}
    <button onclick="copyToClipboard(\`${(subject+'\n\n'+body).replace(/`/g,'\\`')}\`)" style="margin-top:14px;background:var(--card2);border:1px solid var(--b2);color:var(--t2);padding:8px 18px;border-radius:7px;font-size:13px;cursor:pointer;font-family:var(--fb)">📋 Copy to Clipboard</button>
  </div>`;
}

function renderFeedbackResult(data, decision, role) {
  if (!data || !data.letter_body) return errorHTML('Feedback letter generation failed.');

  return `<div class="card" style="margin-top:16px">
    <div class="card-ttl">✉ Candidate Feedback Letter — ${decision} · ${role}</div>
    <div style="background:var(--card2);border:1px solid var(--b2);border-radius:10px;padding:16px 20px;margin-bottom:14px">
      <div style="font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">Subject Line</div>
      <div style="font-size:14.5px;font-weight:600;color:var(--t1)">${data.subject_line||''}</div>
    </div>
    <div style="background:var(--card2);border:1px solid var(--b2);border-radius:10px;padding:16px 20px;margin-bottom:14px">
      <div style="font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px">Letter Body</div>
      <div style="font-size:13.5px;color:var(--t2);line-height:1.85;white-space:pre-line">${data.letter_body||''}</div>
    </div>
    ${(data.improvement_areas||[]).length ? `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
      ${data.improvement_areas.map(ia=>`<div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.15);border-radius:8px;padding:12px 14px">
        <div style="font-weight:600;color:var(--amb);font-size:13px;margin-bottom:3px">${ia.area||''}</div>
        <div style="font-size:12.5px;color:var(--t2)">${ia.specific_suggestion||''}</div>
        ${ia.resource?`<div style="font-size:12px;color:var(--cyan);margin-top:4px">📚 ${ia.resource}</div>`:''}
      </div>`).join('')}
    </div>` : ''}
    <button onclick="copyToClipboard(\`${((data.subject_line||'')+'\n\n'+(data.letter_body||'')).replace(/`/g,'\\`')}\`)" style="background:var(--card2);border:1px solid var(--b2);color:var(--t2);padding:8px 18px;border-radius:7px;font-size:13px;cursor:pointer;font-family:var(--fb)">📋 Copy to Clipboard</button>
  </div>`;
}

function renderAdjacencyResult(data) {
  if (!data || !Object.keys(data).length) return errorHTML('Skill adjacency analysis failed.');
  const clusters = data.skill_clusters || [];
  const accelerators = data.learning_accelerators || [];
  const roleGaps = data.skill_gaps_by_role || [];
  const hidden = data.hidden_strengths || [];

  const demandColor = d => d==='Very High'?'var(--grn)':d==='High'?'var(--cyan)':d==='Medium'?'var(--amb)':'var(--t3)';
  const easeColor = e => e==='Easy'?'var(--grn)':e==='Medium'?'var(--amb)':'var(--red)';

  return `
    ${data.market_positioning ? `<div style="background:rgba(129,140,248,.07);border:1px solid rgba(129,140,248,.2);border-radius:var(--r);padding:16px 20px;margin-bottom:20px">
      <div style="font-size:11px;color:var(--ind);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px">🎯 Market Positioning</div>
      <div style="font-size:14px;color:var(--t1);line-height:1.75">${data.market_positioning}</div>
    </div>` : ''}

    <div class="sec-hdr">🔮 Skill Clusters (${clusters.length})</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-bottom:20px">
      ${clusters.map(c=>`<div class="card" style="border-color:rgba(129,140,248,.15)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div style="font-weight:700;font-size:14px;color:var(--t1)">${c.cluster_name||''}</div>
          <span style="font-size:11px;padding:3px 9px;border-radius:4px;background:rgba(129,140,248,.1);color:var(--ind)">${c.mastery_level||''}</span>
        </div>
        <div style="font-size:12px;color:var(--t3);margin-bottom:10px">${c.cluster_description||''}</div>
        <div style="font-size:11px;color:var(--t3);margin-bottom:4px">CURRENT SKILLS</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px">${(c.core_skills||[]).map(s=>`<span style="font-size:11.5px;padding:3px 9px;border-radius:5px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);color:var(--grn)">${s}</span>`).join('')}</div>
        <div style="font-size:11px;color:var(--t3);margin-bottom:4px">ADJACENT (FAST LEARN)</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px">${(c.adjacent_skills||[]).map(s=>`<span style="font-size:11.5px;padding:3px 9px;border-radius:5px;background:rgba(34,211,238,.07);border:1px solid rgba(34,211,238,.18);color:var(--cyan)">${s}</span>`).join('')}</div>
        <div style="font-size:12px;color:${demandColor(c.market_demand)}">Market Demand: ${c.market_demand||''}</div>
      </div>`).join('')}
    </div>

    <div class="sec-hdr">⚡ Learning Accelerators</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;margin-bottom:20px">
      ${accelerators.map(la=>`<div style="background:var(--card);border:1px solid var(--b1);border-radius:10px;padding:14px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="font-size:13px;padding:4px 10px;border-radius:6px;background:rgba(16,185,129,.08);color:var(--grn)">${la.from_skill||''}</span>
          <span style="color:var(--t3)">→</span>
          <span style="font-size:13px;padding:4px 10px;border-radius:6px;background:rgba(34,211,238,.07);color:var(--cyan)">${la.to_skill||''}</span>
        </div>
        <div style="font-size:12px;color:var(--t2);margin-bottom:6px">${la.why||''}</div>
        <div style="display:flex;gap:8px">
          <span style="font-size:11px;color:${easeColor(la.transfer_ease)}">${la.transfer_ease||''}</span>
          ${la.estimated_weeks?`<span style="font-size:11px;color:var(--t3)">~${la.estimated_weeks} weeks</span>`:''}
        </div>
      </div>`).join('')}
    </div>

    ${roleGaps.length ? `<div class="sec-hdr">🚀 Role Readiness Analysis</div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px">
      ${roleGaps.map(rg=>`<div class="card">
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          <div style="flex:1;min-width:180px">
            <div style="font-weight:600;font-size:14px;color:var(--t1)">${rg.role||''}</div>
            <div style="font-size:12px;color:var(--t3);margin-top:2px">Time to qualify: <span style="color:var(--cyan)">${rg.time_to_qualify||''}</span></div>
          </div>
          <div style="width:160px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:11.5px;color:var(--t2)">Match</span><span style="font-size:12px;font-family:var(--fm);color:var(--t1)">${rg.match_percent||0}%</span></div>
            <div style="height:5px;background:var(--b2);border-radius:3px"><div style="height:100%;border-radius:3px;background:linear-gradient(90deg,var(--ind),var(--cyan));width:${rg.match_percent||0}%;transition:width 1s ease"></div></div>
          </div>
          ${(rg.missing_skills||[]).length ? `<div style="flex:1;min-width:160px;display:flex;flex-wrap:wrap;gap:4px">${rg.missing_skills.map(s=>`<span style="font-size:11px;padding:2px 8px;border-radius:4px;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.15);color:var(--red)">${s}</span>`).join('')}</div>` : '<span style="font-size:12px;color:var(--grn)">✓ Fully qualified!</span>'}
        </div>
      </div>`).join('')}
    </div>` : ''}

    ${hidden.length ? `<div class="sec-hdr">🔮 Hidden Strengths (Not on Resume)</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">${hidden.map(h=>`<span style="font-size:13px;padding:6px 14px;border-radius:7px;background:rgba(167,139,250,.08);border:1px solid rgba(167,139,250,.2);color:var(--pur)">${h}</span>`).join('')}</div>` : ''}`;
}

// ─── HELPERS ─────────────────────────────────────────────────
function animRing(id, score, circ) {
  const arc = $(id);
  if (!arc) return;
  arc.style.strokeDasharray = circ;
  arc.style.strokeDashoffset = circ;
  setTimeout(() => { arc.style.strokeDashoffset = circ * (1 - score / 100); }, 200);
}

function countUp(id, target, dur) {
  const el = $(id); if (!el) return;
  const s = performance.now();
  (function u(now) {
    const p = Math.min((now - s) / dur, 1);
    el.textContent = Math.floor(p * target);
    if (p < 1) requestAnimationFrame(u);
  })(s);
}

function gradeLabel(sc) {
  return sc >= 90 ? '🏆 Exceptional' : sc >= 75 ? '⭐ Strong' : sc >= 60 ? '👍 Good' : sc >= 45 ? '📈 Average' : '⚠️ Needs Work';
}

function scoreColor(sc) {
  return sc >= 75 ? 'var(--grn)' : sc >= 55 ? 'var(--amb)' : 'var(--red)';
}

function loadingHTML(msg) {
  return `<div style="display:flex;align-items:center;gap:12px;padding:20px;color:var(--t2);font-size:13.5px">
    <div style="width:16px;height:16px;border:2px solid var(--ind);border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0"></div>
    ${msg}
  </div>`;
}

function errorHTML(msg) {
  return `<div style="color:var(--red);padding:16px;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);border-radius:9px;font-size:13px;margin-top:12px">⚠️ ${msg}</div>`;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!', 'success'));
}

function showToast(msg, type='info') {
  const t = document.createElement('div');
  const bg = type==='error'?'rgba(239,68,68,.9)':type==='success'?'rgba(16,185,129,.9)':'rgba(99,102,241,.9)';
  t.style.cssText = `position:fixed;bottom:24px;right:24px;background:${bg};color:#fff;padding:10px 18px;border-radius:9px;font-size:13.5px;font-family:var(--fb);z-index:9999;backdrop-filter:blur(10px);animation:fadeUp .3s ease`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}
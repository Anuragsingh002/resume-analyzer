/* ════════════════════════════════
   TalentIQ v2.0 — Application JS
   ════════════════════════════════ */

const API = 'https://resume-analyzer-6wj1.onrender.com';
const $ = id => document.getElementById(id);

let resumeFile = null, reportData = null;

/* ──────────────────────────────────────
   SCREEN MANAGEMENT
────────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

/* ──────────────────────────────────────
   UPLOAD — FILE HANDLING
────────────────────────────────────── */
const dropZone = $('drop-zone');
const fileInput = $('file-input');

dropZone.addEventListener('click', e => {
  if (e.target !== document.querySelector('.dz-browse')) fileInput.click();
});
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('over');
  const f = e.dataTransfer.files[0];
  if (f?.type === 'application/pdf') setFile(f);
  else toast('Only PDF files are accepted.', 'error');
});
fileInput.addEventListener('change', e => { if (e.target.files[0]) setFile(e.target.files[0]); });

function setFile(f) {
  resumeFile = f;
  $('dz-content').classList.add('hidden');
  $('file-name').textContent = f.name;
  $('file-info').classList.remove('hidden');
  $('analyze-btn').disabled = false;
  $('analyze-btn-text').textContent = 'Run full intelligence analysis';
}

function removeFile() {
  resumeFile = null;
  fileInput.value = '';
  $('file-info').classList.add('hidden');
  $('dz-content').classList.remove('hidden');
  $('analyze-btn').disabled = true;
  $('analyze-btn-text').textContent = 'Select a resume to begin';
}

function resetApp() {
  removeFile();
  reportData = null;
  $('jd-input').value = '';
  showScreen('screen-upload');
}

/* ──────────────────────────────────────
   ANALYSIS
────────────────────────────────────── */
async function startAnalysis() {
  if (!resumeFile) return;
  showScreen('screen-loading');

  // Step animation
  const steps = ['ls1','ls2','ls3','ls4','ls5','ls6'];
  steps.forEach(id => $(id).classList.remove('active','done'));
  let cur = 0;
  const advance = () => {
    if (cur > 0) { $(steps[cur-1]).classList.remove('active'); $(steps[cur-1]).classList.add('done'); }
    if (cur < steps.length) { $(steps[cur]).classList.add('active'); cur++; }
  };
  advance();
  const timers = [4500,10000,17000,24000,31000].map((t,i) => setTimeout(advance, t));

  const fd = new FormData();
  fd.append('file', resumeFile);
  const jd = $('jd-input').value.trim();
  if (jd) fd.append('job_description', jd);

  try {
    const res = await fetch(`${API}/analyze`, { method: 'POST', body: fd });
    if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Analysis failed'); }
    reportData = await res.json();
    timers.forEach(clearTimeout);
    steps.forEach(id => { $(id).classList.remove('active'); $(id).classList.add('done'); });
    await delay(600);
    buildResultsShell(reportData);
    showScreen('screen-results');
  } catch (e) {
    timers.forEach(clearTimeout);
    showScreen('screen-upload');
    toast(e.message, 'error');
  }
}

/* ──────────────────────────────────────
   RESULTS — SHELL
────────────────────────────────────── */
function buildResultsShell(d) {
  const a = d.analysis || {};

  // Sidebar candidate
  const initials = (a.candidate_name || 'CA').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
  $('candidate-avatar').textContent = initials;
  $('sidebar-candidate').querySelector('.candidate-meta .candidate-name').textContent
    = a.candidate_name || '—';
  $('sidebar-candidate').querySelector('.candidate-meta .candidate-role').textContent
    = a.current_role || '—';

  // Sidebar scores
  $('s-overall').textContent = (a.overall_score ?? '—') + (a.overall_score != null ? '' : '');
  $('s-jd').textContent = a.jd_match_score != null ? a.jd_match_score : 'N/A';
  $('s-yrs').textContent = a.years_of_experience ?? '—';

  // Topbar
  $('results-meta').textContent = `Generated ${new Date().toLocaleString()} · TalentIQ v2.0`;

  // Hire badge
  const rec = a.hire_recommendation || '';
  const hb = $('hire-badge');
  hb.textContent = rec;
  hb.className = 'hire-badge ' + (
    rec.includes('Strongly') ? 'hb-strong'
    : rec.includes('Caution') ? 'hb-caut'
    : rec.includes('Not') ? 'hb-no'
    : 'hb-rec'
  );

  // Tab nav
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTab(btn.dataset.tab);
    });
  });

  renderTab('overview');
}

/* ──────────────────────────────────────
   TAB ROUTER
────────────────────────────────────── */
function renderTab(tab) {
  const a = reportData?.analysis || {};
  const q = reportData?.interview_questions || {};
  const bias = reportData?.bias_report || {};
  const coaching = reportData?.candidate_feedback || {};
  const body = $('tab-content');

  const renderers = {
    overview:    () => renderOverview(a),
    ats:         () => renderATS(a),
    skills:      () => renderSkills(a),
    experience:  () => renderExperience(a),
    analysis:    () => renderAnalysis(a),
    jdmatch:     () => renderJDMatch(a),
    technical:   () => renderQuestions(q.technical_questions  || [], 'Technical'),
    behavioral:  () => renderQuestions(q.behavioral_questions || [], 'Behavioural'),
    situational: () => renderQuestions(q.situational_questions|| [], 'Situational'),
    deepdive:    () => renderDeepDive(q),
    redflags:    () => renderRedFlags(q.red_flag_probes || [], a.red_flags || []),
    bias:        () => renderBias(bias),
    coaching:    () => renderCoaching(coaching, a),
    outreach:    () => renderOutreach(a),
  };

  body.innerHTML = (renderers[tab] || (() => '<p class="body-text">Coming soon.</p>'))();
  body.querySelectorAll('.bar-fill').forEach(el => {
    const w = el.dataset.w || '0%';
    el.style.width = '0%';
    requestAnimationFrame(() => setTimeout(() => el.style.width = w, 50));
  });
}

/* ──────────────────────────────────────
   OVERVIEW
────────────────────────────────────── */
function renderOverview(a) {
  const c = a.contact || {};
  const initials = (a.candidate_name||'CA').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
  const links = [
    c.email    && `<a class="link-row" href="mailto:${c.email}">${icon('mail')} ${c.email}</a>`,
    c.linkedin && `<a class="link-row" href="${c.linkedin}" target="_blank">${icon('linkedin')} LinkedIn</a>`,
    c.github   && `<a class="link-row" href="${c.github}" target="_blank">${icon('github')} GitHub</a>`,
    c.portfolio && `<a class="link-row" href="${c.portfolio}" target="_blank">${icon('globe')} Portfolio</a>`,
    c.location && `<span class="link-row">${icon('pin')} ${c.location}</span>`,
  ].filter(Boolean);

  const kpis = [
    { val: a.overall_score ?? '—', lbl: 'Overall Score' },
    { val: a.jd_match_score != null ? a.jd_match_score+'%' : 'N/A', lbl: 'JD Match' },
    { val: a.years_of_experience ?? '—', lbl: 'Years Exp.' },
    { val: a.experience_level || '—', lbl: 'Level' },
  ];

  const tags = [
    a.experience_level && tag(a.experience_level, 'accent'),
    a.years_of_experience != null && tag(a.years_of_experience + ' yrs', ''),
  ].filter(Boolean);

  return `
  <div class="section-block">
    <div class="overview-profile">
      <div class="ov-avatar">${initials}</div>
      <div style="flex:1">
        <div class="ov-name">${a.candidate_name || 'Unknown Candidate'}</div>
        <div class="ov-role">${[a.current_role, a.current_company && `at ${a.current_company}`].filter(Boolean).join(' ')}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${tags.join('')}</div>
        <div class="ov-links">${links.join('')}</div>
      </div>
    </div>
    <div class="kv-row">
      ${kpis.map(k => `<div class="kv-cell"><div class="kv-val">${k.val}</div><div class="kv-lbl">${k.lbl}</div></div>`).join('')}
    </div>
  </div>

  ${a.professional_summary ? `
  <div class="section-block">
    <h3 class="section-heading">Summary</h3>
    <div class="callout">${a.professional_summary}</div>
  </div>` : ''}

  ${a.unique_value_proposition ? `
  <div class="section-block">
    <h3 class="section-heading">Unique Value Proposition</h3>
    <p class="body-text">${a.unique_value_proposition}</p>
  </div>` : ''}

  <div class="ov-two-col">
    ${a.career_trajectory ? `<div>
      <h3 class="section-heading">Career Trajectory</h3>
      <p class="body-text" style="font-style:italic">${a.career_trajectory}</p>
    </div>` : ''}
    ${(a.ideal_role_fit||[]).length ? `<div>
      <h3 class="section-heading">Best Role Fits</h3>
      <div class="tags-wrap">${(a.ideal_role_fit||[]).map(r => tag(r, 'accent')).join('')}</div>
    </div>` : ''}
  </div>

  <div class="ov-two-col">
    ${(a.inferred_skills||[]).length ? `<div>
      <h3 class="section-heading">Inferred Skills</h3>
      <p class="body-text" style="font-size:12.5px;color:var(--tx-3);margin-bottom:10px">Not explicitly listed, but strongly implied by their experience.</p>
      <div class="tags-wrap">${(a.inferred_skills||[]).map(s => tag(s, '')).join('')}</div>
    </div>` : ''}
    ${(a.growth_signals||[]).length ? `<div>
      <h3 class="section-heading">Growth Signals</h3>
      <div class="quick-wins">${(a.growth_signals||[]).map(g => `<div class="quick-win-item">${g}</div>`).join('')}</div>
    </div>` : ''}
  </div>

  ${(a.education||[]).length ? `
  <div class="section-block">
    <h3 class="section-heading">Education</h3>
    <div style="display:flex;flex-direction:column;gap:0">
      ${(a.education||[]).map(e => `
      <div style="display:flex;justify-content:space-between;align-items:baseline;padding:12px 0;border-bottom:1px solid var(--rule-1)">
        <div>
          <div style="font-weight:600;font-size:13.5px;color:var(--tx-1)">${e.degree||''}</div>
          <div style="font-size:13px;color:var(--accent);margin-top:2px">${e.institution||''}</div>
          ${(e.relevant_coursework||[]).length ? `<div class="tags-wrap" style="margin-top:8px">${e.relevant_coursework.map(c => tag(c, '')).join('')}</div>` : ''}
        </div>
        <div style="font-family:var(--font-mono);font-size:12px;color:var(--tx-3)">${e.year||''}</div>
      </div>`).join('')}
    </div>
  </div>` : ''}

  ${(a.certifications||[]).length ? `
  <div class="section-block">
    <h3 class="section-heading">Certifications</h3>
    <div class="tags-wrap">${(a.certifications||[]).map(c => tag(c, '')).join('')}</div>
  </div>` : ''}

  ${(a.projects||[]).length ? `
  <div class="section-block">
    <h3 class="section-heading">Notable Projects</h3>
    <div style="display:flex;flex-direction:column;gap:12px">
      ${(a.projects||[]).map(p => `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
          <span style="font-weight:600;font-size:14px;color:var(--tx-1)">${p.name||''}</span>
          ${p.impact ? `<span style="font-family:var(--font-mono);font-size:11.5px;color:var(--green)">${p.impact}</span>` : ''}
        </div>
        <p class="body-text" style="font-size:12.5px;margin-bottom:10px">${p.description||''}</p>
        <div class="tags-wrap">${(p.technologies||[]).map(t => tag(t, '')).join('')}</div>
      </div>`).join('')}
    </div>
  </div>` : ''}`;
}

/* ──────────────────────────────────────
   ATS SCORES
────────────────────────────────────── */
function renderATS(a) {
  const sc = a.overall_score || 0;
  const jd = a.jd_match_score;
  const ats = a.ats_scores || {};
  const circ = 2 * Math.PI * 44;

  const axisLabels = {
    keyword_density:   { name: 'Keyword Density',     sub: 'Role-relevant terms in context' },
    format_quality:    { name: 'Format Quality',       sub: 'Structure and ATS parseability' },
    experience_depth:  { name: 'Experience Depth',     sub: 'Detail and context per role' },
    skills_coverage:   { name: 'Skills Coverage',      sub: 'Breadth of skill portfolio' },
    achievement_impact:{ name: 'Achievement Impact',   sub: 'Quantified results present' },
    career_progression:{ name: 'Career Progression',   sub: 'Growth trajectory clarity' },
  };

  const rings = [
    { val: sc, label: 'Overall Score',  id: 'ring-overall', color: '#5b5bd6' },
    ...(jd != null ? [{ val: jd, label: 'JD Match',  id: 'ring-jd', color: '#25a56a' }] : []),
  ];

  setTimeout(() => {
    rings.forEach(r => {
      const el = $(r.id);
      if (el) {
        el.style.strokeDasharray = circ;
        el.style.strokeDashoffset = circ;
        requestAnimationFrame(() => setTimeout(() => {
          el.style.strokeDashoffset = circ * (1 - r.val / 100);
        }, 100));
      }
    });
  }, 50);

  return `
  <div class="section-block">
    <div class="score-ring-wrap">
      ${rings.map(r => `
      <div class="score-ring-block">
        <svg class="score-ring-svg" viewBox="0 0 100 100" width="100" height="100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="var(--surface-3)" stroke-width="7"/>
          <circle id="${r.id}" cx="50" cy="50" r="44" fill="none"
            stroke="${r.color}" stroke-width="7" stroke-linecap="round"
            style="transform:rotate(-90deg);transform-origin:center;transition:stroke-dashoffset 1.5s cubic-bezier(.4,0,.2,1)"/>
        </svg>
        <div class="ring-big-num">${r.val}</div>
        <div class="ring-label">${r.label}</div>
      </div>`).join('')}
      <div style="flex:1">
        <p class="body-text">${a.hire_rationale || a.professional_summary || ''}</p>
        ${a.hire_recommendation ? `<div style="margin-top:12px">${tag(a.hire_recommendation, a.hire_recommendation.includes('Strongly')?'green':a.hire_recommendation.includes('Caution')?'amber':a.hire_recommendation.includes('Not')?'red':'accent')}</div>` : ''}
      </div>
    </div>
  </div>

  <div class="section-block">
    <h3 class="section-heading">Six-Axis Breakdown</h3>
    <div class="ats-bars-list">
      ${Object.entries(axisLabels).map(([k, meta]) => {
        const v = ats[k] ?? 0;
        const cls = v >= 70 ? 'bar-green' : v >= 45 ? 'bar-amber' : 'bar-red';
        return `
        <div class="ats-bar-item">
          <div class="score-label">
            <span class="score-name">${meta.name}</span>
            <span class="score-num-small">${v}%</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill ${cls}" style="width:0%" data-w="${v}%"></div>
          </div>
          <div class="ats-bar-sub">${meta.sub}</div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

/* ──────────────────────────────────────
   SKILLS
────────────────────────────────────── */
function renderSkills(a) {
  const sk = a.technical_skills || {};
  const groups = [
    { name: 'Languages',              items: sk.languages,    cls: 'accent' },
    { name: 'Frameworks & Libraries', items: sk.frameworks,   cls: '' },
    { name: 'Databases',              items: sk.databases,    cls: '' },
    { name: 'Cloud & DevOps',         items: sk.cloud_devops, cls: '' },
    { name: 'AI / ML',                items: sk.ai_ml,        cls: 'accent' },
    { name: 'Tools',                  items: sk.tools,        cls: '' },
    { name: 'Other',                  items: sk.other,        cls: '' },
    { name: 'Soft Skills',            items: a.soft_skills,   cls: '' },
  ].filter(g => g.items?.length);

  return `
  <div class="section-block">
    <div class="skills-cols">
      ${groups.map(g => `
      <div class="card skill-group">
        <div class="skill-group-name">${g.name}</div>
        <div class="tags-wrap">${g.items.map(s => tag(s, g.cls)).join('')}</div>
      </div>`).join('')}
    </div>
  </div>

  ${(a.inferred_skills||[]).length ? `
  <div class="section-block">
    <h3 class="section-heading">Inferred Skills</h3>
    <p class="body-text" style="margin-bottom:12px">Not explicitly stated, but strongly implied by the candidate's demonstrated experience.</p>
    <div class="tags-wrap">${(a.inferred_skills||[]).map(s => tag(s, '')).join('')}</div>
  </div>` : ''}

  ${(a.transferable_skills||[]).length ? `
  <div class="section-block">
    <h3 class="section-heading">Transferable Skills</h3>
    <p class="body-text" style="margin-bottom:12px">Cross-domain capabilities that add unique value in this role.</p>
    <div class="tags-wrap">${(a.transferable_skills||[]).map(s => tag(s, '')).join('')}</div>
  </div>` : ''}`;
}

/* ──────────────────────────────────────
   EXPERIENCE
────────────────────────────────────── */
function renderExperience(a) {
  const exps = a.work_experience || [];
  if (!exps.length) return emptyState('No work experience found in the resume.');
  return `
  <div class="exp-list">
    ${exps.map(e => `
    <div class="exp-entry">
      <div class="exp-timeline-col">
        <div class="exp-dot"></div>
        <div class="exp-line"></div>
      </div>
      <div class="exp-card">
        <div class="exp-header">
          <div class="exp-title">${e.role || ''}</div>
          <div class="exp-tenure">${e.duration || ''}</div>
        </div>
        <div class="exp-company">${e.company || ''}</div>
        <ul class="exp-bullets">
          ${(e.key_achievements||[]).map(ach => `<li>${ach}</li>`).join('')}
        </ul>
        ${(e.impact_metrics||[]).length ? `<div class="exp-metrics">${e.impact_metrics.map(m => tag(m, 'green')).join('')}</div>` : ''}
        ${(e.skills_demonstrated||[]).length ? `<div class="tags-wrap" style="margin-top:10px">${e.skills_demonstrated.map(s => tag(s, 'accent')).join('')}</div>` : ''}
      </div>
    </div>`).join('')}
  </div>`;
}

/* ──────────────────────────────────────
   STRENGTHS & GAPS
────────────────────────────────────── */
function renderAnalysis(a) {
  const strengths = a.top_strengths || [];
  const gaps = a.potential_gaps || [];
  const rarityTag = r => tag(r, r==='Rare'?'accent':r==='Uncommon'?'':'' );
  const sevTag = s => tag(s, s==='Critical'?'red':s==='Moderate'?'amber':'');

  return `
  <div class="section-block">
    <h3 class="section-heading">Top Strengths</h3>
    <div class="str-gap-grid">
      ${strengths.map(s => `
      <div class="sg-item sg-item--strength">
        <div class="sg-item-title">${s.strength || s}</div>
        <div class="sg-item-body">${s.evidence || ''}</div>
        ${s.rarity ? `<div class="sg-item-footer">${rarityTag(s.rarity)}</div>` : ''}
      </div>`).join('') || '<p class="body-text">None identified.</p>'}
    </div>
  </div>

  <div class="section-block">
    <h3 class="section-heading">Potential Gaps</h3>
    <div class="str-gap-grid">
      ${gaps.map(g => `
      <div class="sg-item sg-item--gap">
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
          <div class="sg-item-title" style="margin:0">${g.gap || g}</div>
          ${g.severity ? sevTag(g.severity) : ''}
        </div>
        <div class="sg-item-body">${g.suggestion || ''}</div>
      </div>`).join('') || '<p class="body-text">No significant gaps identified.</p>'}
    </div>
  </div>`;
}

/* ──────────────────────────────────────
   JD MATCH
────────────────────────────────────── */
function renderJDMatch(a) {
  if (a.jd_match_score == null) {
    return `<div class="empty-state">
      <div class="empty-state-title">No job description provided</div>
      <p class="body-text">Start a new analysis and paste a job description to unlock role alignment scoring, skill gap analysis, and role-specific questions.</p>
      <button onclick="resetApp()" style="margin-top:20px;background:var(--accent);color:#fff;border:none;padding:9px 20px;border-radius:var(--r-md);font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font-ui)">Start new analysis</button>
    </div>`;
  }
  const matched = a.jd_matched_skills || [], missing = a.jd_missing_skills || [];
  const sc = a.jd_match_score || 0;
  const cls = sc >= 70 ? 'bar-green' : sc >= 45 ? 'bar-amber' : 'bar-red';

  return `
  <div class="section-block">
    <div class="kv-row">
      <div class="kv-cell"><div class="kv-val">${sc}%</div><div class="kv-lbl">Match Score</div></div>
      <div class="kv-cell"><div class="kv-val">${matched.length}</div><div class="kv-lbl">Skills Matched</div></div>
      <div class="kv-cell"><div class="kv-val">${missing.length}</div><div class="kv-lbl">Skills Missing</div></div>
    </div>
    <div class="bar-track" style="margin-bottom:20px">
      <div class="bar-fill ${cls}" style="width:0%" data-w="${sc}%"></div>
    </div>
  </div>

  <div class="jd-skills-grid">
    <div class="card jd-col-green">
      <div class="jd-col-title">Matched Skills</div>
      <div class="tags-wrap">${matched.map(s => tag(s, 'green')).join('') || '<span class="body-text">None matched.</span>'}</div>
    </div>
    <div class="card jd-col-red">
      <div class="jd-col-title">Missing Skills</div>
      <div class="tags-wrap">${missing.map(s => tag(s, 'red')).join('') || '<span class="body-text" style="color:var(--green)">No skill gaps found.</span>'}</div>
    </div>
  </div>

  ${a.jd_match_summary ? `
  <div class="section-block" style="margin-top:16px">
    <h3 class="section-heading">Match Analysis</h3>
    <div class="callout">${a.jd_match_summary}</div>
  </div>` : ''}`;
}

/* ──────────────────────────────────────
   QUESTIONS
────────────────────────────────────── */
function renderQuestions(qs, type) {
  if (!qs.length) return emptyState(`No ${type.toLowerCase()} questions were generated.`);
  return `<div class="q-index">${qs.map((q, i) => {
    const d = q.difficulty || '';
    const dtag = d ? tag(d, d==='Easy'?'green':d==='Hard'?'red':'amber') : '';
    const ctag = q.skill_tested ? tag(q.skill_tested, 'accent') : (q.competency ? tag(q.competency, 'accent') : '');
    const details = [
      q.expected_answer_hint && { label: 'Look for', val: q.expected_answer_hint },
      q.what_to_listen_for   && { label: 'Listen for', val: q.what_to_listen_for },
      q.star_guidance        && { label: 'STAR probe', val: q.star_guidance },
      q.ideal_approach       && { label: 'Ideal approach', val: q.ideal_approach },
      q.what_to_avoid        && { label: 'Watch for', val: q.what_to_avoid },
      q.green_flag_answer    && { label: 'Strong answer', val: q.green_flag_answer },
      q.red_flag_answer      && { label: 'Weak answer', val: q.red_flag_answer },
      q.scoring_rubric       && { label: 'Scoring rubric', val: q.scoring_rubric },
      q.follow_up            && { label: 'Follow-up', val: q.follow_up },
    ].filter(Boolean);
    return `
    <div class="q-item">
      <div class="q-header">
        <span class="q-number">Q${i+1}</span>
        <div class="q-text">${q.question}</div>
      </div>
      ${(dtag||ctag) ? `<div class="q-tags">${[ctag,dtag].filter(Boolean).join('')}</div>` : ''}
      ${details.length ? `<div class="q-detail">
        ${details.map(d => `<div class="q-detail-row"><strong>${d.label}:</strong> ${d.val}</div>`).join('')}
      </div>` : ''}
    </div>`;
  }).join('')}</div>`;
}

/* ──────────────────────────────────────
   DEEP DIVE + CULTURE FIT
────────────────────────────────────── */
function renderDeepDive(q) {
  const dd = q.deep_dive_questions || [];
  const cf = q.culture_fit_questions || [];
  return `
  <div class="section-block">
    <h3 class="section-heading">Deep Dive — Resume-Specific Probes</h3>
    <div class="q-index">${dd.map((q, i) => `
      <div class="q-item">
        <div class="q-header">
          <span class="q-number">D${i+1}</span>
          <div class="q-text">${q.question}</div>
        </div>
        ${q.target ? `<div class="q-tags">${tag(q.target, '')}</div>` : ''}
        <div class="q-detail">
          ${q.intent ? `<div class="q-detail-row"><strong>Intent:</strong> ${q.intent}</div>` : ''}
          ${q.expected_depth ? `<div class="q-detail-row"><strong>Depth expected:</strong> ${q.expected_depth}</div>` : ''}
        </div>
      </div>`).join('') || '<p class="body-text">No deep-dive questions generated.</p>'}
    </div>
  </div>
  <div class="section-block">
    <h3 class="section-heading">Culture Fit Questions</h3>
    <div class="q-index">${cf.map((q, i) => `
      <div class="q-item">
        <div class="q-header">
          <span class="q-number">C${i+1}</span>
          <div class="q-text">${q.question}</div>
        </div>
        <div class="q-detail">
          ${q.what_to_listen_for ? `<div class="q-detail-row"><strong>Listen for:</strong> ${q.what_to_listen_for}</div>` : ''}
          ${(q.alignment_signals||[]).length ? `<div class="q-detail-row"><strong>Alignment signals:</strong> ${q.alignment_signals.join(', ')}</div>` : ''}
        </div>
      </div>`).join('') || '<p class="body-text">No culture fit questions generated.</p>'}
    </div>
  </div>`;
}

/* ──────────────────────────────────────
   RED FLAGS
────────────────────────────────────── */
function renderRedFlags(probes, resumeFlags) {
  return `
  ${resumeFlags.length ? `
  <div class="section-block">
    <h3 class="section-heading">Resume Red Flags</h3>
    <div class="q-index">
      ${resumeFlags.map((f, i) => `
      <div class="q-item">
        <div class="q-header">
          <span class="q-number">F${i+1}</span>
          <div class="q-text">${f.flag || f}</div>
        </div>
        <div class="q-detail">
          ${f.explanation ? `<div class="q-detail-row"><strong>Explanation:</strong> ${f.explanation}</div>` : ''}
          ${f.probe_question ? `<div class="q-detail-row"><strong>Suggested probe:</strong> ${f.probe_question}</div>` : ''}
        </div>
      </div>`).join('')}
    </div>
  </div>` : ''}
  <div class="section-block">
    <h3 class="section-heading">Red Flag Interview Probes</h3>
    <div class="q-index">
      ${probes.map((p, i) => `
      <div class="q-item">
        <div class="q-header">
          <span class="q-number">${tag('Probe', 'red')}</span>
          <div class="q-text">${p.question}</div>
        </div>
        <div class="q-detail">
          ${p.concern ? `<div class="q-detail-row"><strong>Concern:</strong> ${p.concern}</div>` : ''}
          ${p.green_flag_answer ? `<div class="q-detail-row"><strong>Strong answer:</strong> ${p.green_flag_answer}</div>` : ''}
          ${p.red_flag_answer ? `<div class="q-detail-row"><strong>Concerning answer:</strong> ${p.red_flag_answer}</div>` : ''}
        </div>
      </div>`).join('') || emptyState('No red flag probes generated.')}
    </div>
  </div>`;
}

/* ──────────────────────────────────────
   BIAS AUDIT
────────────────────────────────────── */
function renderBias(bias) {
  if (!bias || !Object.keys(bias).length) return emptyState('Bias report not available.');
  const pii = bias.pii_detected || {};
  const vectors = bias.potential_bias_vectors || [];
  const merit = bias.merit_indicators || [];
  const blind = bias.recommended_blind_fields || [];

  return `
  <div class="section-block">
    <div class="kv-row">
      <div class="kv-cell">
        <div class="kv-val">${bias.fairness_score ?? '—'}</div>
        <div class="kv-lbl">Fairness Score</div>
      </div>
      <div class="kv-cell" style="flex:3">
        <div class="kv-val" style="font-size:14px;font-family:var(--font-ui)">${bias.blind_review_recommendation || '—'}</div>
        <div class="kv-lbl">Blind Review Recommendation</div>
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
    <div class="card">
      <div class="card-title">PII Detection Scan</div>
      <table class="pii-table">
        ${Object.entries(pii).map(([k,v]) => `
        <tr>
          <td>${k.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</td>
          <td>${tag(v ? 'Detected' : 'Clear', v ? 'amber' : 'green')}</td>
        </tr>`).join('')}
      </table>
    </div>
    <div class="card">
      <div class="card-title">Recommended Blind Fields</div>
      <div class="quick-wins" style="margin-bottom:16px">
        ${blind.map(b => `<div class="quick-win-item">${b}</div>`).join('') || '<p class="body-text">None recommended.</p>'}
      </div>
      ${merit.length ? `<div class="card-title" style="margin-top:4px">Merit Anchors</div>
      <div class="quick-wins">${merit.map(m => `<div class="quick-win-item">${m}</div>`).join('')}</div>` : ''}
    </div>
  </div>

  <div class="section-block">
    <h3 class="section-heading">Bias Vectors</h3>
    ${vectors.map(v => `
    <div class="bias-vector-item">
      <div class="bias-vector-hdr">
        <span class="bias-vector-name">${v.vector||''}</span>
        ${tag(v.risk_level||'', v.risk_level==='High'?'red':v.risk_level==='Medium'?'amber':'green')}
      </div>
      <p class="body-text" style="margin-bottom:6px">${v.explanation||''}</p>
      <p class="body-text"><strong>Mitigation:</strong> ${v.mitigation||''}</p>
    </div>`).join('') || '<p class="body-text">No significant bias vectors identified.</p>'}
  </div>

  ${bias.evaluation_guidance ? `
  <div class="section-block">
    <h3 class="section-heading">Evaluation Guidance</h3>
    <div class="callout callout-green">${bias.evaluation_guidance}</div>
  </div>` : ''}`;
}

/* ──────────────────────────────────────
   COACHING
────────────────────────────────────── */
function renderCoaching(coaching, a) {
  if (!coaching || !Object.keys(coaching).length) return emptyState('Coaching report not available.');
  const roadmap = coaching.improvement_roadmap || [];
  const wins = coaching.quick_wins || [];
  const courses = coaching.skill_gap_courses || [];
  const strengths = coaching.key_strengths_recognized || [];

  return `
  ${coaching.overall_assessment ? `
  <div class="section-block">
    <h3 class="section-heading">Assessment</h3>
    <div class="callout">${coaching.overall_assessment}</div>
  </div>` : ''}

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
    <div>
      <h3 class="section-heading">Recognised Strengths</h3>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${strengths.map(s => `
        <div class="card" style="border-left:2px solid var(--green)">
          <div style="font-weight:600;color:var(--tx-1);margin-bottom:3px">${s.strength||s}</div>
          <div class="body-text">${s.why_it_matters||''}</div>
        </div>`).join('') || '<p class="body-text">None identified.</p>'}
      </div>
    </div>
    <div>
      <h3 class="section-heading">Quick Wins — Next 7 Days</h3>
      <div class="quick-wins">
        ${wins.map(w => `<div class="quick-win-item">${w}</div>`).join('') || '<p class="body-text">No quick wins available.</p>'}
      </div>
    </div>
  </div>

  <div class="section-block">
    <h3 class="section-heading">Improvement Roadmap</h3>
    ${roadmap.map(r => `
    <div class="roadmap-item">
      <div class="roadmap-area">${r.area||''}</div>
      <div class="roadmap-action">${r.specific_action||''}</div>
      <div class="roadmap-tags">
        ${r.timeline ? tag(r.timeline, 'accent') : ''}
        ${(r.resources||[]).map(res => tag(res, '')).join('')}
      </div>
    </div>`).join('') || '<p class="body-text">No roadmap available.</p>'}
  </div>

  ${courses.length ? `
  <div class="section-block">
    <h3 class="section-heading">Recommended Courses</h3>
    <div class="card">
      ${courses.map(c => `
      <div class="course-row">
        <div style="flex:1">
          <div class="course-skill">${c.skill||''}</div>
          <div class="course-name">${c.recommended_course||''}</div>
          <div class="course-detail">${c.platform||''} ${c.estimated_time ? '· '+c.estimated_time : ''}</div>
        </div>
      </div>`).join('')}
    </div>
  </div>` : ''}

  ${coaching.career_advice ? `
  <div class="section-block">
    <h3 class="section-heading">Career Advice</h3>
    <div class="callout callout-green"><em>${coaching.career_advice}</em></div>
  </div>` : ''}

  <div class="section-block">
    <h3 class="section-heading">Generate Feedback Letter</h3>
    <div class="card">
      <div class="gen-form">
        <div class="gen-field">
          <label class="gen-label">Job Title</label>
          <input id="fb-role" class="gen-input" placeholder="e.g. Senior Engineer" value="${a.current_role||''}">
        </div>
        <div class="gen-field">
          <label class="gen-label">Decision</label>
          <select id="fb-decision" class="gen-input" style="cursor:pointer">
            <option value="Not Selected">Not Selected</option>
            <option value="Moving Forward">Moving Forward</option>
            <option value="On Hold">On Hold</option>
          </select>
        </div>
        <button class="gen-btn" onclick="runFeedbackLetter()">Generate letter</button>
      </div>
      <div id="feedback-output"></div>
    </div>
  </div>`;
}

/* ──────────────────────────────────────
   OUTREACH
────────────────────────────────────── */
function renderOutreach(a) {
  return `
  <div class="section-block">
    <h3 class="section-heading">Personalised Outreach Generator</h3>
    <div class="callout" style="margin-bottom:20px">Generate a hyper-personalised candidate outreach email based on their specific background, skills, and value proposition — not a generic template.</div>
    <div class="card">
      <div class="gen-form">
        <div class="gen-field">
          <label class="gen-label">Role You're Recruiting For</label>
          <input id="or-role" class="gen-input" placeholder="e.g. Senior Backend Engineer">
        </div>
        <div class="gen-field">
          <label class="gen-label">Your Company</label>
          <input id="or-company" class="gen-input" placeholder="Company name">
        </div>
        <button class="gen-btn" onclick="runOutreachEmail()">Generate email</button>
      </div>
      <div id="outreach-output"></div>
    </div>
  </div>`;
}

/* ──────────────────────────────────────
   GENERATORS (API CALLS)
────────────────────────────────────── */
async function runOutreachEmail() {
  const role = $('or-role')?.value || 'Software Engineer';
  const company = $('or-company')?.value || 'Our Company';
  const out = $('outreach-output');
  out.innerHTML = '<div class="loading-inline">Generating personalised outreach email…</div>';

  try {
    const r = await fetch(`${API}/generate-outreach`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ profile: reportData.analysis, job_title: role, company_name: company })
    });
    const d = await r.json();
    if (!d.email_body) throw new Error('Generation failed');

    out.innerHTML = `
    <div class="email-display">
      <div class="email-meta">
        <span><strong>Subject:</strong> ${d.subject_line || '—'}</span>
        <button class="copy-btn" onclick="copyText(\`${(d.subject_line+'\n\n'+d.email_body).replace(/`/g,'\\`').replace(/\n/g,'\\n')}\`)">
          ${icon('copy')} Copy
        </button>
      </div>
      <div class="email-body">${d.email_body || ''}</div>
    </div>
    ${(d.follow_up_subject) ? `
    <div class="divider"></div>
    <p class="body-text" style="margin-bottom:10px"><strong>Follow-up (5 days later)</strong></p>
    <div class="email-display">
      <div class="email-meta"><span><strong>Subject:</strong> ${d.follow_up_subject}</span></div>
      <div class="email-body">${d.follow_up_body||''}</div>
    </div>` : ''}
    ${(d.personalization_hooks||[]).length ? `<div class="divider"></div><p class="card-title">Personalisation Hooks</p><div class="tags-wrap">${d.personalization_hooks.map(h=>tag(h,'')).join('')}</div>` : ''}`;
  } catch(e) {
    out.innerHTML = `<div class="error-msg">${e.message}</div>`;
  }
}

async function runFeedbackLetter() {
  const role = $('fb-role')?.value || 'Software Engineer';
  const decision = $('fb-decision')?.value || 'Not Selected';
  const out = $('feedback-output');
  out.innerHTML = '<div class="loading-inline">Generating candidate feedback letter…</div>';

  try {
    const r = await fetch(`${API}/generate-feedback-letter`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ profile: reportData.analysis, decision, job_title: role })
    });
    const d = await r.json();
    if (!d.letter_body) throw new Error('Generation failed');

    out.innerHTML = `
    <div class="divider"></div>
    <div class="email-display">
      <div class="email-meta">
        <span><strong>Subject:</strong> ${d.subject_line||'—'}</span>
        <button class="copy-btn" onclick="copyText(\`${((d.subject_line||'')+'\n\n'+(d.letter_body||'')).replace(/`/g,'\\`').replace(/\n/g,'\\n')}\`)">
          ${icon('copy')} Copy
        </button>
      </div>
      <div class="email-body">${d.letter_body||''}</div>
    </div>`;
  } catch(e) {
    out.innerHTML = `<div class="error-msg">${e.message}</div>`;
  }
}

/* ──────────────────────────────────────
   ICON SYSTEM
────────────────────────────────────── */
const ICONS = {
  mail:    `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x=".5" y="2" width="11" height="8" rx="1" stroke="currentColor" stroke-width="1"/><path d="M.5 3l5.5 4L11 3" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`,
  linkedin:`<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x=".5" y=".5" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1"/><path d="M3 5v4M3 3.5V3M5 9V6.5c0-1 .5-1.5 1.5-1.5S8 5.5 8 6.5V9" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`,
  github:  `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1a5 5 0 00-1.58 9.74c.25.05.34-.11.34-.24v-.85C3.1 9.91 2.8 8.9 2.8 8.9c-.23-.58-.56-.73-.56-.73-.46-.31.04-.3.04-.3.5.03.77.52.77.52.45.77 1.18.55 1.47.42.05-.33.18-.55.32-.68-1.12-.13-2.3-.56-2.3-2.5 0-.55.2-1 .52-1.36-.05-.13-.22-.64.05-1.34 0 0 .42-.13 1.38.52a4.8 4.8 0 012.5 0c.96-.65 1.38-.52 1.38-.52.27.7.1 1.21.05 1.34.32.36.52.81.52 1.36 0 1.94-1.18 2.37-2.3 2.5.18.16.34.47.34.95v1.4c0 .13.09.29.34.24A5 5 0 006 1z" stroke="currentColor" stroke-width=".5" fill="currentColor"/></svg>`,
  globe:   `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1"/><path d="M6 1c-1.5 1.5-2 3-2 5s.5 3.5 2 5M6 1c1.5 1.5 2 3 2 5s-.5 3.5-2 5M1 6h10" stroke="currentColor" stroke-width=".9"/></svg>`,
  pin:     `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 11S2 7.5 2 5a4 4 0 018 0c0 2.5-4 6-4 6z" stroke="currentColor" stroke-width="1"/><circle cx="6" cy="5" r="1.5" stroke="currentColor" stroke-width="1"/></svg>`,
  copy:    `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1"/><path d="M2 8V2a1 1 0 011-1h6" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`,
};
const icon = name => ICONS[name] || '';

/* ──────────────────────────────────────
   UTILITIES
────────────────────────────────────── */
function tag(text, variant) {
  const cls = variant ? `tag tag-${variant}` : 'tag';
  return `<span class="${cls}">${text}</span>`;
}

function emptyState(msg) {
  return `<div class="empty-state"><p class="body-text">${msg}</p></div>`;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function copyText(text) {
  const clean = text.replace(/\\n/g, '\n');
  navigator.clipboard.writeText(clean).then(() => toast('Copied to clipboard', 'success'));
}

function toast(msg, type='info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
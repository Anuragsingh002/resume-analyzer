/* ═══════════════════════════════════════════════════════════
   TALENTIQ v7.0 — app.js
   Apex Recruitment Intelligence · Real API + Agent
═══════════════════════════════════════════════════════════ */
'use strict';

const API = 'https://resume-analyzer-6wj1.onrender.com';

// ── State ──────────────────────────────────────────────────
let currentTab   = 'overview';
let resumeFile   = null;
let reportData   = null;
let agentHistory = [];

// ── Theme ──────────────────────────────────────────────────
function toggleTheme() {
  const html = document.documentElement;
  html.dataset.theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('tiq-theme', html.dataset.theme);
}
(function() {
  document.documentElement.dataset.theme = localStorage.getItem('tiq-theme') || 'dark';
})();

// ── File Handling ──────────────────────────────────────────
document.getElementById('resume-file').addEventListener('change', function() {
  if (this.files[0]) setFile(this.files[0]);
});
const dz = document.getElementById('dropzone');
dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('drag-over'); });
dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
dz.addEventListener('drop', e => {
  e.preventDefault(); dz.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
});

function setFile(f) {
  resumeFile = f;
  document.getElementById('file-name').textContent = f.name;
  document.getElementById('file-preview').classList.add('show');
}
function clearFile() {
  resumeFile = null;
  document.getElementById('resume-file').value = '';
  document.getElementById('file-preview').classList.remove('show');
}

// ── Analysis Flow ──────────────────────────────────────────
async function startAnalysis() {
  if (!resumeFile) { showToast('Please upload a resume first', 'error'); return; }
  showScreen('loading');

  const stages = document.querySelectorAll('#loading-stages .stage');
  stages.forEach(s => s.classList.remove('active', 'done'));
  let si = 0;
  function nextStage() {
    if (si > 0 && stages[si-1]) { stages[si-1].classList.remove('active'); stages[si-1].classList.add('done'); }
    if (si < stages.length) { stages[si].classList.add('active'); si++; }
    updateBar(Math.round((si / stages.length) * 68));
  }
  nextStage();
  const stageTimer = setInterval(() => { if (si < stages.length) nextStage(); else clearInterval(stageTimer); }, 6500);

  const title = document.getElementById('loading-title');
  const sub   = document.getElementById('loading-sub');

  try {
    title.textContent = 'Connecting to Intelligence Server\u2026';
    sub.textContent   = 'First request may take up to 60s on free tier';
    await wakeUpServer();

    title.textContent = 'Analyzing Candidate\u2026';
    sub.textContent   = '6 AI pillars active — semantic parsing in progress';

    const fd = new FormData();
    fd.append('file', resumeFile);
    const jd = document.getElementById('jd-input').value.trim();
    const rl = document.getElementById('role-input').value.trim();
    const co = document.getElementById('company-input').value.trim();
    if (jd) fd.append('job_description', jd);
    if (rl) fd.append('target_role', rl);
    if (co) fd.append('company_name', co);

    updateBar(78);
    const res = await fetch(`${API}/analyze`, { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server error ${res.status}`);
    }

    reportData = await res.json();
    agentHistory = [];
    clearInterval(stageTimer);
    stages.forEach(s => { s.classList.remove('active'); s.classList.add('done'); });
    updateBar(100);

    await sleep(500);
    populateResultsHeader();
    showScreen('results');
    switchTab('overview');

  } catch (err) {
    clearInterval(stageTimer);
    showScreen('upload');
    const msg = (!err.message || err.message === 'Failed to fetch')
      ? 'Cannot reach server. Check your internet connection and try again.'
      : err.message;
    showToast(msg, 'error');
  }
}

function updateBar(pct) {
  const bar = document.getElementById('loading-bar');
  if (bar) bar.style.width = pct + '%';
}

async function wakeUpServer(maxMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 25000);
      const r    = await fetch(`${API}/health`, { signal: ctrl.signal });
      clearTimeout(tid);
      if (r.ok) return;
    } catch (_) {}
    await sleep(3000);
  }
  throw new Error('Server did not respond within 90 seconds.');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
}

function resetApp() {
  clearFile();
  reportData = null; agentHistory = [];
  ['jd-input','role-input','company-input'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  showScreen('upload');
}

// ── Populate Results Header ────────────────────────────────
function populateResultsHeader() {
  const a     = A();
  const name  = a.candidate_name || '—';
  const role  = a.current_role || a.experience_level || '—';
  const score = a.overall_score || 0;
  const rec   = (a.hire_recommendation || '').trim();

  const initials = name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase() || '?';
  document.getElementById('r-avatar').textContent  = initials;
  document.getElementById('r-name').textContent    = name;
  document.getElementById('r-role').textContent    = role;
  document.getElementById('r-score-num').textContent = score;

  const badge = document.getElementById('hire-badge');
  document.getElementById('hire-label').textContent = rec || 'Pending';
  badge.className = 'hire-badge ' + (
    /strongly.*hire|strong.*hire/i.test(rec) ? 'strong-yes' :
    /caution/i.test(rec)                     ? 'maybe'      :
    /not|pass|no/i.test(rec)                 ? 'no'         : 'yes'
  );

  renderContactLinks(a.contact_info || {});
}

// ── Contact Links — Enhanced with Twitter, Website & more ─
function renderContactLinks(ci) {
  const links = [];

  const makeLink = (cls, href, icon, label, isExternal) => {
    const target = isExternal ? 'target="_blank" rel="noopener noreferrer"' : '';
    const extIcon = isExternal ? `<svg class="ext-icon" width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M4 2H2a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1V6M6 1h3m0 0v3m0-3L4.5 5.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>` : '';
    return `<a href="${esc(href)}" class="contact-link ${cls}" ${target} title="${esc(label)}">
      <span class="cl-icon">${icon}</span>
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(label)}</span>
      ${extIcon}
    </a>`;
  };

  if (ci.email)    links.push(makeLink('email',     `mailto:${ci.email}`,   icons.email(),    ci.email,              false));
  if (ci.phone)    links.push(makeLink('phone',     `tel:${ci.phone}`,      icons.phone(),    ci.phone,              false));
  if (ci.linkedin) links.push(makeLink('linkedin',  ci.linkedin,            icons.linkedin(), 'LinkedIn',            true));
  if (ci.github)   links.push(makeLink('github',    ci.github,              icons.github(),   'GitHub',              true));
  if (ci.twitter)  links.push(makeLink('twitter',   ci.twitter,             icons.twitter(),  'Twitter / X',         true));
  if (ci.portfolio)links.push(makeLink('portfolio', ci.portfolio,           icons.web(),      'Portfolio',           true));
  if (ci.website)  links.push(makeLink('website',   ci.website,             icons.web(),      'Website',             true));

  // Fallback: try to parse raw text for links if no structured data
  if (!links.length && ci.raw) {
    const rawText = ci.raw || '';
    const emailM = rawText.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    const phoneM = rawText.match(/[\+]?[\d\s\-\(\)]{10,}/);
    const liM    = rawText.match(/linkedin\.com\/in\/[\w-]+/i);
    const ghM    = rawText.match(/github\.com\/[\w-]+/i);
    if (emailM) links.push(makeLink('email',    `mailto:${emailM[0]}`,           icons.email(),    emailM[0],    false));
    if (phoneM) links.push(makeLink('phone',    `tel:${phoneM[0].replace(/\s/g,'')}`, icons.phone(), phoneM[0], false));
    if (liM)    links.push(makeLink('linkedin', `https://${liM[0]}`,             icons.linkedin(), 'LinkedIn',   true));
    if (ghM)    links.push(makeLink('github',   `https://${ghM[0]}`,             icons.github(),   'GitHub',     true));
  }

  const el = document.getElementById('contact-links');
  if (el) el.innerHTML = links.length
    ? links.join('')
    : `<span style="font-size:.7rem;color:var(--text-3);font-family:var(--font-mono)">No contact info extracted</span>`;
}

// ── Icon library ───────────────────────────────────────────
const icons = {
  email:    () => `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x=".5" y="2" width="11" height="8" rx="1.5" stroke="currentColor" stroke-width="1.1"/><path d="M.5 3.5l5.5 4 5.5-4" stroke="currentColor" stroke-linecap="round"/></svg>`,
  phone:    () => `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 2h2.5l1 2.5-1.5 1a7 7 0 003.5 3.5l1-1.5L11 8.5v2.5A1 1 0 0110 12 10 10 0 010 2a1 1 0 011-1h1z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg>`,
  linkedin: () => `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x=".5" y=".5" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.1"/><path d="M3 5v4.5M3 3.5V4M5 9.5V7c0-1 .7-2 2-2s2 1 2 2v2.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>`,
  github:   () => `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1a5 5 0 00-1.58 9.74c.25.05.34-.11.34-.24v-.87C3.06 9.9 2.76 9 2.76 9c-.23-.57-.56-.72-.56-.72-.45-.31.04-.3.04-.3.5.03.77.52.77.52.45.77 1.18.55 1.47.42.04-.33.17-.55.32-.68C3.19 8.1 2.1 7.7 2.1 5.9a1.91 1.91 0 01.51-1.33c-.05-.13-.22-.63.05-1.31 0 0 .42-.13 1.36.51a4.73 4.73 0 012.48 0c.94-.64 1.36-.51 1.36-.51.27.68.1 1.18.05 1.31a1.9 1.9 0 01.51 1.33c0 1.81-1.1 2.2-2.15 2.32.17.15.32.43.32.87v1.3c0 .13.09.29.34.24A5 5 0 006 1z" fill="currentColor"/></svg>`,
  twitter:  () => `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M1 9.5L5 6 1 2.5h2.5L6 5l2.5-2.5H11L7 5.5l4 4H8.5L6 7l-2.5 2.5H1z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg>`,
  web:      () => `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.1"/><path d="M6 1c-1.5 2-1.5 8 0 10M6 1c1.5 2 1.5 8 0 10M1 6h10" stroke="currentColor" stroke-width="1.1"/><path d="M2 3.5a8 8 0 008 0M2 8.5a8 8 0 008 0" stroke="currentColor" stroke-width="1.1"/></svg>`,
};

// ── Export / Copy ──────────────────────────────────────────
function exportReport() {
  if (!reportData) return;
  showToast('Opening print dialog to save as PDF\u2026', '');
  setTimeout(() => window.print(), 300);
}

function copyReport() {
  if (!reportData) return;
  const a = A();
  const text = `TALENTIQ CANDIDATE INTELLIGENCE REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Candidate: ${a.candidate_name || '—'}
Role: ${a.current_role || '—'}
ATS Score: ${a.overall_score || 0}/100
Recommendation: ${a.hire_recommendation || '—'}
Experience: ${a.years_of_experience || 'N/A'} years

▸ STRENGTHS
${(a.top_strengths || []).map(s => '• ' + (s.strength || s)).join('\n')}

▸ GAPS
${(a.potential_gaps || []).map(g => '• ' + (g.gap || g)).join('\n')}

▸ HIRE RATIONALE
${a.hire_rationale || '—'}
`;
  navigator.clipboard.writeText(text).then(() => showToast('Report copied to clipboard', 'success'));
}

// ── Tab Navigation ─────────────────────────────────────────
document.getElementById('sb-nav').addEventListener('click', e => {
  const btn = e.target.closest('.nav-btn[data-tab]');
  if (btn) switchTab(btn.dataset.tab);
});

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('#sb-nav .nav-btn').forEach(b => b.classList.remove('active'));
  const active = document.querySelector(`#sb-nav .nav-btn[data-tab="${tab}"]`);
  if (active) active.classList.add('active');
  const el = document.getElementById('tab-content');
  el.classList.remove('anim-up');
  void el.offsetWidth;
  el.classList.add('anim-up');
  el.innerHTML = (TABS[tab] ? TABS[tab]() : `<p style="color:var(--text-2)">Coming soon.</p>`);
  animateBars();
  bindQA();
  if (tab === 'agent')     initAgent();
  if (tab === 'scorecard') initScorecard();
  document.querySelector('.r-main').scrollTo({ top: 0, behavior: 'smooth' });
}

function animateBars() {
  setTimeout(() => {
    document.querySelectorAll('.score-ring-fill').forEach(f => {
      const p = parseFloat(f.dataset.pct) || 0;
      f.style.strokeDashoffset = 339.3 - (339.3 * p / 100);
    });
    document.querySelectorAll('[data-w]').forEach(b => { b.style.width = b.dataset.w + '%'; });
  }, 60);
}

function bindQA() {
  document.querySelectorAll('.qa-q').forEach(q => {
    q.addEventListener('click', () => q.closest('.qa-item').classList.toggle('open'));
  });
}

// ── Data Accessors ─────────────────────────────────────────
function A()  { return (reportData && reportData.analysis)            || {}; }
function Q()  { return (reportData && reportData.interview_questions) || {}; }
function BI() { return (reportData && reportData.bias_report)         || {}; }
function CO() { return (reportData && reportData.candidate_feedback)  || {}; }
function n(val, fallback = 0) { return val != null ? val : fallback; }

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ═══════════════════════════════════════════════════════════
   TAB RENDERERS
═══════════════════════════════════════════════════════════ */
const TABS = {
  overview, skills, experience, analysis, impact,
  realvsbuzz, jdmatch, redflags,
  technical, behavioral, situational, deepdive,
  bias, coaching, outreach,
  agent, scorecard, pipeline, decision,
};

/* ── OVERVIEW ─────────────────────────────────────────────── */
function overview() {
  const a  = A();
  const sc = n(a.overall_score);
  const at = a.ats_scores       || {};
  const qi = a.quantified_impact || {};
  const cl = a.candidate_classification || {};
  const jd = a.jd_match_score;

  return `
  <div class="section-h">Intelligence Dashboard</div>
  <div class="section-sub">Holistic candidate fitness across all evaluation dimensions</div>

  <div class="score-ring-wrap">
    <div class="ring-wrap">
      <svg class="score-ring-svg" width="120" height="120" viewBox="0 0 120 120">
        <circle class="score-ring-track" cx="60" cy="60" r="54"/>
        <circle class="score-ring-fill" cx="60" cy="60" r="54" data-pct="${sc}" stroke="var(--accent)"/>
      </svg>
      <div class="score-ring-text">
        <span class="score-ring-num" style="color:var(--accent)">${sc}</span>
        <span class="score-ring-lbl">/100</span>
      </div>
    </div>
    <div class="score-ring-desc">
      <h3>Composite ATS Score</h3>
      <p>${esc(a.professional_summary || a.hire_rationale || 'Analysis complete. Review the sections below for detailed intelligence.')}</p>
      <div class="ring-tags">
        ${a.hire_recommendation ? `<span class="item-badge badge-teal">${esc(a.hire_recommendation)}</span>` : ''}
        ${a.years_of_experience != null ? `<span class="item-badge badge-blue">${a.years_of_experience} yrs exp</span>` : ''}
        ${a.experience_level ? `<span class="item-badge badge-violet">${esc(a.experience_level)}</span>` : ''}
        ${a.current_role ? `<span class="item-badge badge-amber">${esc(a.current_role)}</span>` : ''}
      </div>
    </div>
  </div>

  <div class="axis-grid">
    ${ax('Keyword Density',    n(at.keyword_density),    'var(--blue)')}
    ${ax('Experience Depth',   n(at.experience_depth),   'var(--accent)')}
    ${ax('Achievement Impact', n(at.achievement_impact), 'var(--green)')}
    ${ax('Skills Coverage',    n(at.skills_coverage),    'var(--violet)')}
    ${ax('Format Quality',     n(at.format_quality),     'var(--amber)')}
    ${ax('Career Progression', n(at.career_progression), 'var(--pink)')}
  </div>

  <div class="stat-stripe">
    <div class="stat-card">
      <div class="stat-label">JD Match</div>
      <div class="stat-val" style="color:var(--cyan)">${jd != null ? jd + '%' : '—'}</div>
      <div class="stat-sub">${jd != null ? (jd>=70?'Strong match':jd>=45?'Moderate match':'Weak match') : 'No JD provided'}</div>
      <div class="stat-bar"><div class="stat-fill" style="background:var(--cyan)" data-w="${jd||0}"></div></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Impact Score</div>
      <div class="stat-val" style="color:var(--green)">${n(qi.score)}</div>
      <div class="stat-sub">${esc(qi.verdict||'—')}</div>
      <div class="stat-bar"><div class="stat-fill" style="background:var(--green)" data-w="${n(qi.score)}"></div></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Candidate Type</div>
      <div class="stat-val" style="color:var(--amber);font-size:.95rem">${esc(cl.type||'—')}</div>
      <div class="stat-sub">${esc(cl.buzz_word_rating||'—')}</div>
      <div class="stat-bar"><div class="stat-fill" style="background:var(--amber)" data-w="55"></div></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Career Velocity</div>
      <div class="stat-val" style="color:var(--blue);font-size:.95rem">${esc(a.career_velocity||'—')}</div>
      <div class="stat-sub">${esc((a.career_velocity_evidence||'').slice(0,55))}</div>
      <div class="stat-bar"><div class="stat-fill" style="background:var(--blue)" data-w="65"></div></div>
    </div>
  </div>

  <div class="two-col">
    <div class="card">
      <div class="card-title">Top Strengths</div>
      <div class="item-list">
        ${(a.top_strengths||[]).slice(0,4).map(s=>li('green','✓',esc(s.strength||String(s))+(s.evidence?' — <span style="color:var(--text-3)">'+esc(s.evidence)+'</span>':''))).join('') || noData()}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Key Gaps</div>
      <div class="item-list">
        ${(a.potential_gaps||[]).slice(0,4).map(g=>li(g.severity==='Critical'?'red':'amber',g.severity==='Critical'?'!':'~',esc(g.gap||String(g))+(g.suggestion?' — <span style="color:var(--text-3)">'+esc(g.suggestion)+'</span>':''),g.severity||'')).join('') || `<p class="nodata">✓ No significant gaps identified.</p>`}
      </div>
    </div>
  </div>`;
}

/* ── SKILLS ───────────────────────────────────────────────── */
function skills() {
  const a  = A();
  const sk = a.technical_skills || {};
  const GROUPS = [
    { l:'Languages',      c:'var(--blue)',    items: sk.languages    ||[] },
    { l:'Frameworks',     c:'var(--violet)',  items: sk.frameworks   ||[] },
    { l:'AI / ML',        c:'var(--accent)',  items: sk.ai_ml        ||[] },
    { l:'Cloud & DevOps', c:'var(--green)',   items: sk.cloud_devops ||[] },
    { l:'Databases',      c:'var(--amber)',   items: sk.databases    ||[] },
    { l:'Tools',          c:'var(--pink)',    items: sk.tools        ||[] },
    { l:'Other',          c:'var(--text-2)',  items: sk.other        ||[] },
    { l:'Soft Skills',    c:'var(--cyan)',    items: a.soft_skills   ||[] },
  ].filter(g => g.items.length);

  if (!GROUPS.length) return `<div class="section-h">Skills Intelligence</div><p class="nodata" style="margin-top:8px">No skills data extracted.</p>`;

  return `
  <div class="section-h">Skills Intelligence</div>
  <div class="section-sub">Evidence-validated technical and interpersonal skills with proficiency signals</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px">
    ${GROUPS.map(g => `
      <div class="card">
        <div class="card-title">${g.l}</div>
        <div class="skill-cloud">
          ${g.items.map(s => `<span class="skill-tag" style="color:${g.c};border-color:${g.c.replace(')',',0.18)')}">${esc(s)}</span>`).join('')}
        </div>
      </div>`).join('')}
  </div>
  ${(a.inferred_skills||[]).length ? `
  <div class="card" style="margin-top:11px">
    <div class="card-title">Inferred Skills <span style="color:var(--text-3);font-size:.68em;font-weight:400;letter-spacing:0;text-transform:none">— implied by experience, not explicitly stated</span></div>
    <div class="skill-cloud">
      ${(a.inferred_skills||[]).map(s=>`<span class="skill-tag" style="border-style:dashed;color:var(--text-3)">${esc(s)}</span>`).join('')}
    </div>
  </div>` : ''}`;
}

/* ── EXPERIENCE ───────────────────────────────────────────── */
function experience() {
  const a    = A();
  const exps = a.work_experience || [];
  const edu  = a.education       || [];
  const cert = a.certifications  || [];
  const proj = a.projects        || [];

  return `
  <div class="section-h">Work Experience</div>
  <div class="section-sub">Career timeline with AI-extracted achievement signals</div>

  ${exps.length ? `
  <div class="card">
    <div class="timeline">
      ${exps.map(e => tl(
        esc(e.role||'—'), esc(e.company||''), esc(e.duration||''),
        (e.key_achievements||e.impact_metrics||[]).map(x=>`• ${esc(x)}`).join('<br>')
      )).join('')}
    </div>
  </div>` : `<p class="nodata" style="margin-bottom:16px">No work experience extracted.</p>`}

  <div class="two-col">
    <div class="card">
      <div class="card-title">Education</div>
      ${edu.length ? `<div class="timeline">${edu.map(e=>tl(esc(e.degree||'—'),esc(e.institution||''),esc(e.year||''),'',true)).join('')}</div>` : noData()}
    </div>
    <div class="card">
      <div class="card-title">Certifications</div>
      ${cert.length ? `<div class="item-list">${cert.map(c=>li('blue','🏅',esc(c))).join('')}</div>` : noData()}
    </div>
  </div>

  ${proj.length ? `
  <div class="card">
    <div class="card-title">Notable Projects</div>
    ${proj.map((p,i)=>`
      <div style="${i<proj.length-1?'margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border)':''}">
        <div style="font-weight:600;font-size:.87rem;margin-bottom:5px">${esc(p.name||'')}</div>
        <p style="font-size:.79rem;color:var(--text-2);line-height:1.65;margin-bottom:8px">${esc(p.description||'')}</p>
        <div class="skill-cloud">
          ${(p.technologies||[]).map(t=>`<span class="skill-tag" style="color:var(--accent);font-size:.7rem;border-color:rgba(124,109,255,.2)">${esc(t)}</span>`).join('')}
        </div>
      </div>`).join('')}
  </div>` : ''}`;
}

/* ── ANALYSIS ─────────────────────────────────────────────── */
function analysis() {
  const a = A();
  return `
  <div class="section-h">Strengths &amp; Gaps Analysis</div>
  <div class="section-sub">Evidence-based assessment of candidate fitness for the target role</div>
  <div class="card" style="margin-bottom:12px">
    <div class="card-title">Top Strengths</div>
    <div class="item-list">
      ${(a.top_strengths||[]).map(s=>li('green','S',`<strong>${esc(s.strength||String(s))}</strong>${s.evidence?' — <span style="color:var(--text-3)">'+esc(s.evidence)+'</span>':''}`,s.rarity||'')).join('') || noData()}
    </div>
  </div>
  <div class="card" style="margin-bottom:12px">
    <div class="card-title">Potential Gaps</div>
    <div class="item-list">
      ${(a.potential_gaps||[]).map(g=>li(g.severity==='Critical'?'red':'amber',g.severity==='Critical'?'!':'~',`<strong>${esc(g.gap||String(g))}</strong>${g.suggestion?' — <span style="color:var(--text-3)">'+esc(g.suggestion)+'</span>':''}`,g.severity||'')).join('') || `<p class="nodata">✓ No significant gaps identified.</p>`}
    </div>
  </div>
  ${a.career_trajectory ? `<div class="card" style="margin-bottom:12px"><div class="card-title">Career Trajectory</div><p style="font-size:.82rem;color:var(--text-2);line-height:1.7;font-style:italic">${esc(a.career_trajectory)}</p></div>` : ''}
  ${(a.ideal_role_fit||[]).length ? `<div class="card"><div class="card-title">Ideal Role Fits</div><div class="skill-cloud" style="margin-top:4px">${(a.ideal_role_fit||[]).map(r=>`<span class="item-badge badge-teal">${esc(r)}</span>`).join('')}</div></div>` : ''}`;
}

/* ── IMPACT ───────────────────────────────────────────────── */
function impact() {
  const qi = A().quantified_impact || {};
  const sc = n(qi.score);
  return `
  <div class="section-h">Impact Score</div>
  <div class="section-sub">Quantified achievement analysis — how well the candidate proves results with hard numbers</div>
  <div class="score-ring-wrap">
    <div class="ring-wrap">
      <svg class="score-ring-svg" width="120" height="120" viewBox="0 0 120 120">
        <circle class="score-ring-track" cx="60" cy="60" r="54"/>
        <circle class="score-ring-fill" cx="60" cy="60" r="54" data-pct="${sc}" stroke="var(--green)"/>
      </svg>
      <div class="score-ring-text">
        <span class="score-ring-num" style="color:var(--green)">${sc}</span>
        <span class="score-ring-lbl">/100</span>
      </div>
    </div>
    <div class="score-ring-desc">
      <h3>Quantified Impact Score</h3>
      <p><strong>${esc(qi.verdict||'—')}</strong> — ${n(qi.quantified_percentage)}% of resume bullets contain hard numbers (%, $, time saved, scale).</p>
      ${qi.improvement_tip ? `<p style="margin-top:8px;font-size:.78rem;color:var(--text-2)">${esc(qi.improvement_tip)}</p>` : ''}
    </div>
  </div>
  <div class="three-col">
    <div class="card" style="text-align:center">
      <div style="font-size:2rem;font-family:var(--font-mono);font-weight:700;color:var(--text)">${n(qi.total_bullets)}</div>
      <div style="font-size:.7rem;color:var(--text-3);margin-top:4px;text-transform:uppercase;letter-spacing:.06em">Total Bullets</div>
    </div>
    <div class="card" style="text-align:center">
      <div style="font-size:2rem;font-family:var(--font-mono);font-weight:700;color:var(--green)">${n(qi.quantified_bullets)}</div>
      <div style="font-size:.7rem;color:var(--text-3);margin-top:4px;text-transform:uppercase;letter-spacing:.06em">Quantified</div>
    </div>
    <div class="card" style="text-align:center">
      <div style="font-size:2rem;font-family:var(--font-mono);font-weight:700;color:var(--accent)">${n(qi.quantified_percentage)}%</div>
      <div style="font-size:.7rem;color:var(--text-3);margin-top:4px;text-transform:uppercase;letter-spacing:.06em">Rate</div>
    </div>
  </div>
  <div class="two-col">
    <div class="card">
      <div class="card-title" style="color:var(--green)">Strong Quantified Bullets</div>
      <div class="item-list">
        ${(qi.strong_examples||[]).map(e=>li('green','✓',esc(e))).join('')||`<p class="nodata">None found.</p>`}
      </div>
    </div>
    <div class="card">
      <div class="card-title" style="color:var(--red)">Weak / Vague Bullets</div>
      <div class="item-list">
        ${(qi.weak_examples||[]).map(e=>li('red','✗',esc(e))).join('')||`<p class="nodata" style="color:var(--green)">✓ No weak bullets found!</p>`}
      </div>
    </div>
  </div>`;
}

/* ── REAL VS BUZZ ─────────────────────────────────────────── */
function realvsbuzz() {
  const cl = A().candidate_classification || {};
  const bc = cl.type === 'Proven' ? 'var(--green)' : cl.type === 'High Potential' ? 'var(--accent)' : 'var(--amber)';
  return `
  <div class="section-h">Real vs Buzz Analysis</div>
  <div class="section-sub">Substance detection — separating evidence-backed claims from empty buzzwords</div>
  <div class="card" style="border-left:3px solid ${bc};margin-bottom:12px">
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <div style="font-family:var(--font-serif);font-size:1.8rem;font-weight:400">${esc(cl.type||'—')}</div>
      <div>
        <div style="font-size:.77rem;color:var(--text-2)">Confidence: <strong>${esc(cl.confidence||'—')}</strong></div>
        <div style="font-size:.77rem;color:var(--text-2)">Buzz rating: <strong>${esc(cl.buzz_word_rating||'—')}</strong></div>
      </div>
    </div>
    ${cl.evidence ? `<p style="margin-top:12px;font-size:.8rem;color:var(--text-2);font-style:italic;line-height:1.7">${esc(cl.evidence)}</p>` : ''}
  </div>
  <div class="two-col">
    <div class="card">
      <div class="card-title" style="color:var(--green)">Substance Examples</div>
      <div class="item-list">
        ${(cl.substance_examples||[]).map(e=>li('green','✓',esc(e))).join('')||noData()}
      </div>
    </div>
    <div class="card">
      <div class="card-title" style="color:var(--red)">Buzz Phrases (unverified)</div>
      <div class="item-list">
        ${(cl.buzz_examples||[]).map(e=>li('red','✗',esc(e))).join('')||`<p class="nodata" style="color:var(--green)">✓ No buzz phrases detected!</p>`}
      </div>
    </div>
  </div>`;
}

/* ── JD MATCH ─────────────────────────────────────────────── */
function jdmatch() {
  const a  = A();
  const sc = a.jd_match_score;
  if (sc == null) return `
    <div class="section-h">JD Match Analysis</div>
    <div class="empty-state">
      <p>No job description was provided. Re-run with a JD for detailed alignment scoring.</p>
      <button class="btn-secondary" onclick="resetApp()">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M1 7A6 6 0 0112.5 4.5M13 7A6 6 0 011.5 9.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M11 2l2 2.5-2.5 1.5M3 12L1 9.5l2.5-1.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>
        New Analysis with JD
      </button>
    </div>`;
  const matched = a.jd_matched_skills || [];
  const missing = a.jd_missing_skills || [];
  const partial = a.jd_partial_skills || [];
  return `
  <div class="section-h">JD Match Analysis</div>
  <div class="section-sub">How well this candidate maps to the job description requirements</div>
  <div class="score-ring-wrap">
    <div class="ring-wrap">
      <svg class="score-ring-svg" width="120" height="120" viewBox="0 0 120 120">
        <circle class="score-ring-track" cx="60" cy="60" r="54"/>
        <circle class="score-ring-fill" cx="60" cy="60" r="54" data-pct="${sc}" stroke="var(--cyan)"/>
      </svg>
      <div class="score-ring-text">
        <span class="score-ring-num" style="color:var(--cyan)">${sc}</span>
        <span class="score-ring-lbl">%</span>
      </div>
    </div>
    <div class="score-ring-desc">
      <h3>JD Match Score</h3>
      <p>${esc(a.jd_match_summary||'Alignment analysis complete.')}</p>
    </div>
  </div>
  <div class="two-col">
    <div class="card">
      <div class="card-title" style="color:var(--green)">✓ Matched Requirements (${matched.length})</div>
      <div class="skill-cloud">${matched.map(s=>`<span class="item-badge badge-green">${esc(s)}</span>`).join('')||noData()}</div>
    </div>
    <div class="card">
      <div class="card-title" style="color:var(--red)">✗ Missing Requirements (${missing.length})</div>
      <div class="skill-cloud">${missing.map(s=>`<span class="item-badge badge-red">${esc(s)}</span>`).join('')||`<p class="nodata" style="color:var(--green)">✓ No gaps!</p>`}</div>
    </div>
  </div>
  ${partial.length ? `<div class="card"><div class="card-title" style="color:var(--amber)">~ Partial Matches (${partial.length})</div><div class="skill-cloud">${partial.map(s=>`<span class="item-badge badge-amber">${esc(s)}</span>`).join('')}</div></div>` : ''}`;
}

/* ── RED FLAGS ────────────────────────────────────────────── */
function redflags() {
  const flags  = A().red_flags       || [];
  const probes = Q().red_flag_probes || [];
  return `
  <div class="section-h">Red Flags</div>
  <div class="section-sub">Resume anomalies and high-risk signals to probe in interviews</div>
  <div class="card" style="margin-bottom:12px;border-color:${flags.length?'rgba(255,90,101,.2)':'var(--border)'}">
    <div class="card-title" style="color:var(--red)">Resume Red Flags</div>
    ${flags.length
      ? `<div class="item-list">${flags.map(f=>li('red','⚑',`<strong>${esc(f.flag||String(f))}</strong>${f.explanation?' — '+esc(f.explanation):''}`)).join('')}</div>`
      : `<p style="color:var(--green);font-size:.82rem">✓ No significant red flags detected in this resume.</p>`}
  </div>
  ${probes.length ? `
  <div class="card">
    <div class="card-title">Probing Interview Questions</div>
    <div class="qa-list">
      ${probes.map((p,i)=>qa(i+1,esc(p.question||''),'Hard',
        (p.concern?`<strong>Concern:</strong> ${esc(p.concern)}<br>`:'')+(p.green_flag_answer?`<strong>Strong answer signals:</strong> ${esc(p.green_flag_answer)}<br>`:'')+( p.red_flag_answer?`<strong>Concerning answer signals:</strong> ${esc(p.red_flag_answer)}` :'')
      )).join('')}
    </div>
  </div>` : ''}`;
}

/* ── TECHNICAL ────────────────────────────────────────────── */
function technical() {
  const qs = Q().technical_questions || [];
  return `
  <div class="section-h">Technical Interview Questions</div>
  <div class="section-sub">Role-specific technical questions tailored to this candidate's background</div>
  ${qs.length
    ? `<div class="qa-list">${qs.map((q,i)=>qa(i+1,esc(q.question||String(q)),q.difficulty||'Medium',esc(q.evaluation_guide||q.answer_guide||''))).join('')}</div>`
    : `<div class="empty-state"><p>No technical questions generated. Ensure a target role was provided.</p></div>`}`;
}

/* ── BEHAVIOURAL ──────────────────────────────────────────── */
function behavioral() {
  const qs = Q().behavioral_questions || [];
  return `
  <div class="section-h">Behavioural Interview Questions</div>
  <div class="section-sub">Structured STAR-format questions to assess past behavior and culture fit</div>
  ${qs.length
    ? `<div class="qa-list">${qs.map((q,i)=>qa(i+1,esc(q.question||String(q)),q.difficulty||'Medium',esc(q.evaluation_guide||q.answer_guide||''))).join('')}</div>`
    : `<div class="empty-state"><p>No behavioural questions generated.</p></div>`}`;
}

/* ── SITUATIONAL ──────────────────────────────────────────── */
function situational() {
  const qs = Q().situational_questions || [];
  return `
  <div class="section-h">Situational Interview Questions</div>
  <div class="section-sub">Hypothetical scenarios to evaluate problem-solving and judgment</div>
  ${qs.length
    ? `<div class="qa-list">${qs.map((q,i)=>qa(i+1,esc(q.question||String(q)),q.difficulty||'Medium',esc(q.evaluation_guide||q.answer_guide||''))).join('')}</div>`
    : `<div class="empty-state"><p>No situational questions generated.</p></div>`}`;
}

/* ── DEEP DIVE ────────────────────────────────────────────── */
function deepdive() {
  const qs = Q().deep_dive_questions || Q().culture_fit_questions || [];
  return `
  <div class="section-h">Deep Dive Questions</div>
  <div class="section-sub">Advanced questions to probe specific resume claims and cultural alignment</div>
  ${qs.length
    ? `<div class="qa-list">${qs.map((q,i)=>qa(i+1,esc(q.question||String(q)),q.difficulty||'Hard',esc(q.evaluation_guide||q.answer_guide||''))).join('')}</div>`
    : `<div class="empty-state"><p>No deep dive questions generated.</p></div>`}`;
}

/* ── BIAS ─────────────────────────────────────────────────── */
function bias() {
  const b = BI();
  return `
  <div class="section-h">Bias Audit Report</div>
  <div class="section-sub">AI-powered fairness assessment to ensure equitable candidate evaluation</div>
  <div class="card" style="margin-bottom:12px">
    <div class="card-title">Bias Indicators</div>
    ${biasMeter([
      ['Gender Neutrality',     n(b.gender_neutrality_score)],
      ['Age Neutrality',        n(b.age_neutrality_score)],
      ['Cultural Inclusivity',  n(b.cultural_inclusivity_score)],
      ['Skills-Based Framing',  n(b.skills_based_framing_score)],
      ['Language Accessibility',n(b.language_accessibility_score)],
    ])}
  </div>
  ${(b.bias_flags||[]).length ? `
  <div class="card" style="margin-bottom:12px">
    <div class="card-title" style="color:var(--amber)">Potential Bias Signals</div>
    <div class="item-list">${(b.bias_flags||[]).map(f=>li('amber','⚠',esc(f.flag||String(f))+(f.explanation?' — '+esc(f.explanation):''))).join('')}</div>
  </div>` : `<div class="card" style="margin-bottom:12px"><p style="color:var(--green);font-size:.82rem">✓ No significant bias signals detected in this evaluation context.</p></div>`}
  ${b.overall_bias_assessment ? `<div class="card"><div class="card-title">Overall Assessment</div><p style="font-size:.82rem;color:var(--text-2);line-height:1.7">${esc(b.overall_bias_assessment)}</p></div>` : ''}`;
}

/* ── COACHING ─────────────────────────────────────────────── */
function coaching() {
  const co = CO();
  return `
  <div class="section-h">Candidate Coaching Report</div>
  <div class="section-sub">Constructive feedback to share with the candidate regardless of outcome</div>
  ${co.resume_strengths ? `
  <div class="card" style="margin-bottom:12px">
    <div class="card-title">Resume Strengths</div>
    <p style="font-size:.82rem;color:var(--text-2);line-height:1.7">${esc(co.resume_strengths)}</p>
  </div>` : ''}
  ${co.areas_for_improvement ? `
  <div class="card" style="margin-bottom:12px">
    <div class="card-title">Areas for Improvement</div>
    <div class="item-list">${(Array.isArray(co.areas_for_improvement)?co.areas_for_improvement:[co.areas_for_improvement]).map(a=>li('amber','→',esc(a))).join('')}</div>
  </div>` : ''}
  ${(co.skill_development_suggestions||[]).length ? `
  <div class="card">
    <div class="card-title">Skill Development Suggestions</div>
    <div class="item-list">${(co.skill_development_suggestions||[]).map(s=>li('blue','📘',esc(s))).join('')}</div>
  </div>` : ''}
  ${!co.resume_strengths && !co.areas_for_improvement ? `<div class="empty-state"><p>No coaching data available for this candidate.</p></div>` : ''}`;
}

/* ── OUTREACH ─────────────────────────────────────────────── */
function outreach() {
  const a = A();
  const name = a.candidate_name || 'Candidate';
  const firstName = name.split(' ')[0];
  const role  = a.current_role || '[Role]';
  const strength = (a.top_strengths||[{}])[0]?.strength || 'your impressive background';

  const linkedinDM = `Hi ${firstName},\n\nI came across your profile and was impressed by your experience as ${role}${strength !== 'your impressive background' ? `, especially your background in ${strength}` : ''}.\n\nWe have an exciting opportunity that I think could be a strong match for your skills. Would you be open to a brief 15-minute call to explore?\n\nBest,\n[Your Name]`;

  const emailSubj  = `Exciting opportunity — ${role} at [Company]`;
  const emailBody  = `Dear ${firstName},\n\nI hope this message finds you well. I'm reaching out because your profile stood out to our team — particularly your experience with ${strength}.\n\nWe're currently building out our [Team] at [Company], and I believe your background aligns exceptionally well with what we're looking for.\n\nI'd love to schedule a quick exploratory conversation. Are you available for a 20-minute call this week or next?\n\nBest regards,\n[Your Name]\n[Title] | [Company]`;

  return `
  <div class="section-h">Outreach Templates</div>
  <div class="section-sub">AI-personalized messages based on this candidate's profile</div>
  <div class="card" style="margin-bottom:12px">
    <div class="card-title">LinkedIn Direct Message</div>
    <div class="mono-block" id="outreach-li">${esc(linkedinDM)}</div>
    <div style="margin-top:10px;display:flex;gap:8px">
      <button class="copy-btn-sm" onclick="copyText(this, ${JSON.stringify(linkedinDM)})">Copy</button>
    </div>
  </div>
  <div class="card">
    <div class="card-title">Email Outreach</div>
    <div style="font-size:.72rem;color:var(--text-3);margin-bottom:8px;font-family:var(--font-mono)">Subject: ${esc(emailSubj)}</div>
    <div class="mono-block" id="outreach-email">${esc(emailBody)}</div>
    <div style="margin-top:10px;display:flex;gap:8px">
      <button class="copy-btn-sm" onclick="copyText(this, ${JSON.stringify(emailBody)})">Copy body</button>
      <button class="copy-btn-sm" onclick="copyText(this, ${JSON.stringify(emailSubj)})">Copy subject</button>
    </div>
  </div>`;
}

/* ── AGENT ────────────────────────────────────────────────── */
function agent() {
  const a = A();
  return `
  <div class="section-h">Recruitment Agent</div>
  <div class="section-sub">Ask anything about this candidate — the agent has full context</div>
  <div class="agent-wrap">
    <div class="agent-header">
      <div class="agent-avatar">
        <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M9 1.5L16 5.25V12.75L9 16.5L2 12.75V5.25L9 1.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 5.5L12.5 7.5V11.5L9 13.5L5.5 11.5V7.5L9 5.5Z" fill="currentColor" opacity=".9"/></svg>
      </div>
      <div>
        <div class="agent-title">TalentIQ Agent</div>
        <div class="agent-sub">Llama 3.3 · 70B · Full candidate context loaded</div>
      </div>
      <div class="agent-status">
        <span class="item-badge badge-teal" style="font-size:.62rem">● Active</span>
      </div>
    </div>
    <div class="chat-messages" id="agent-messages"></div>
    <div class="quick-qs" id="quick-qs">
      <span style="font-size:.65rem;color:var(--text-3);margin-right:2px;font-family:var(--font-mono)">Quick:</span>
      ${['Summarize top hiring risks','Draft rejection email','Write offer letter','Suggest salary range','Rate culture fit','Gaps to probe in interview?','Key strengths summary','Competitive profile assessment'].map(q=>`<button class="quick-q-btn" onclick="askQuick('${q.replace(/'/g,"\\'")}')"> ${q}</button>`).join('')}
    </div>
    <div class="chat-input-row">
      <input class="chat-input" id="agent-input" type="text" placeholder="Ask about ${esc(a.candidate_name||'this candidate')}…" onkeydown="if(event.key==='Enter')sendAgentMessage()">
      <button class="chat-send" id="agent-send" onclick="sendAgentMessage()" title="Send">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M14 2L7.5 8.5M14 2l-4.5 12-2-5.5L2 6.5 14 2z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
  </div>`;
}

function initAgent() {
  if (agentHistory.length === 0) {
    addAgentMessage('ai', `Hello! I'm the TalentIQ Recruitment Agent. I have full context on **${esc(A().candidate_name||'this candidate')}** — their skills, experience, ATS scores, red flags, interview questions, and bias analysis.\n\nWhat would you like to know or do?`);
  } else {
    agentHistory.forEach(msg => addAgentMessage(msg.role === 'user' ? 'user' : 'ai', msg.content, false));
  }
}

function askQuick(q) {
  const input = document.getElementById('agent-input');
  if (input) { input.value = q; sendAgentMessage(); }
}

async function sendAgentMessage() {
  const input   = document.getElementById('agent-input');
  const sendBtn = document.getElementById('agent-send');
  const msg     = input.value.trim();
  if (!msg) return;

  input.value = '';
  sendBtn.disabled = true;
  addAgentMessage('user', msg);
  agentHistory.push({ role: 'user', content: msg });

  const typingId = addAgentMessage('ai', '<span class="typing-dot"><span></span><span></span><span></span></span>');

  try {
    const res = await fetch(`${API}/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, candidate_context: reportData })
    });

    const bubble = document.getElementById(typingId);
    if (res.ok) {
      const data  = await res.json();
      const reply = data.response || data.message || 'Analysis complete.';
      if (bubble) bubble.innerHTML = mdToHtml(reply);
      agentHistory.push({ role: 'ai', content: reply });
    } else {
      const fallback = localAgentAnswer(msg);
      if (bubble) bubble.innerHTML = mdToHtml(fallback);
      agentHistory.push({ role: 'ai', content: fallback });
    }
  } catch (_) {
    const fallback = localAgentAnswer(msg);
    const bubble   = document.getElementById(typingId);
    if (bubble) bubble.innerHTML = mdToHtml(fallback);
    agentHistory.push({ role: 'ai', content: fallback });
  }

  sendBtn.disabled = false;
  const msgs = document.getElementById('agent-messages');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

function addAgentMessage(role, content, push = false) {
  const msgs = document.getElementById('agent-messages');
  if (!msgs) return null;
  const id  = 'msg-' + Date.now() + Math.random().toString(36).slice(2,5);
  const div = document.createElement('div');
  div.className = `chat-msg chat-msg--${role}`;
  div.innerHTML = `
    <div class="msg-avatar msg-avatar--${role}">
      ${role === 'ai'
        ? `<svg width="11" height="11" viewBox="0 0 18 18" fill="none"><path d="M9 1.5L16 5.25V12.75L9 16.5L2 12.75V5.25L9 1.5Z" stroke="currentColor" stroke-width="1.5"/><path d="M9 5.5L12.5 7.5V11.5L9 13.5L5.5 11.5V7.5L9 5.5Z" fill="currentColor" opacity=".9"/></svg>`
        : 'You'}
    </div>
    <div class="msg-bubble" id="${id}">${role === 'ai' ? mdToHtml(content) : esc(content)}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return id;
}

function mdToHtml(text) {
  return esc(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

function localAgentAnswer(msg) {
  const a    = A();
  const q    = msg.toLowerCase();
  const name = a.candidate_name || 'This candidate';
  const fn   = name.split(' ')[0];

  if (/risk|flag|concern/i.test(q)) {
    const flags = (a.red_flags||[]).slice(0,3).map(f=>`• ${f.flag||f}`).join('\n');
    const gaps  = (a.potential_gaps||[]).slice(0,3).map(g=>`• ${g.gap||g}`).join('\n');
    return `**Top hiring risks for ${name}:**\n\n${flags||'No explicit red flags found.'}\n\n**Key gaps to address:**\n${gaps||'No major gaps identified.'}`;
  }
  if (/offer|salary|comp/i.test(q)) {
    return `Based on ${a.years_of_experience||'N/A'} years of experience as **${a.current_role||'this role'}** with an ATS score of **${a.overall_score||'N/A'}/100**:\n\n**Recommendation:** Research current market rates for this role and location. Consider the candidate's impact score (${(a.quantified_impact||{}).score||'N/A'}) and career velocity (${a.career_velocity||'N/A'}) during negotiation.\n\n*For precise salary benchmarking, connect the /agent backend for live AI analysis.*`;
  }
  if (/reject|decline|pass/i.test(q)) {
    return `**Rejection email draft:**\n\nDear ${fn},\n\nThank you for taking the time to apply for the ${a.current_role||'role'} position and for your interest in our company.\n\nAfter careful consideration, we've decided to move forward with another candidate whose experience more closely aligns with our current needs.\n\nWe were genuinely impressed by your **${(a.top_strengths||[{}])[0]?.strength||'experience'}** and encourage you to apply for future opportunities.\n\nWe wish you all the best in your search.\n\nBest regards,\n[Your Name]`;
  }
  if (/strength/i.test(q)) {
    return `**Key strengths for ${name}:**\n\n${(a.top_strengths||[]).slice(0,5).map(s=>`• **${s.strength||s}**${s.evidence?' — '+s.evidence:''}`).join('\n')||'No strengths data available.'}`;
  }
  if (/culture|fit|team|value/i.test(q)) {
    const cf = (Q().culture_fit_questions||[]);
    return cf.length
      ? `**Culture fit questions for ${name}:**\n\n${cf.slice(0,3).map((q,i)=>`${i+1}. ${q.question}`).join('\n\n')}`
      : `Based on the analysis, ${name}'s career trajectory suggests **${esc(a.career_trajectory||'progressive growth')}**. Classified as **"${a.candidate_classification?.type||'N/A'}"** — ${a.candidate_classification?.evidence||'supporting evidence found in resume'}.`;
  }
  if (/competi|benchmark|market|compar/i.test(q)) {
    return `**Competitive profile for ${name}:**\n\n• **ATS Score:** ${a.overall_score||0}/100 ${a.overall_score >= 75 ? '(Above average)' : a.overall_score >= 55 ? '(Average)' : '(Below average)'}\n• **Experience level:** ${a.experience_level||'N/A'} with ${a.years_of_experience||'N/A'} years\n• **Classification:** ${a.candidate_classification?.type||'N/A'}\n• **Career velocity:** ${a.career_velocity||'N/A'}\n• **Recommendation:** ${a.hire_recommendation||'Pending'}\n\n*For live competitive benchmarking, ensure the /agent backend is connected.*`;
  }
  return `I have full analysis loaded for **${name}**. Here's a quick summary:\n\n• **Score:** ${a.overall_score||0}/100\n• **Recommendation:** ${a.hire_recommendation||'Pending'}\n• **Experience:** ${a.years_of_experience||'N/A'} years as ${a.current_role||'N/A'}\n• **Top strength:** ${(a.top_strengths||[{}])[0]?.strength||'N/A'}\n• **Key gap:** ${(a.potential_gaps||[{}])[0]?.gap||'None identified'}\n\nAsk me anything specific — strengths, gaps, salary, outreach drafts, or interview questions!`;
}

/* ── SCORECARD ────────────────────────────────────────────── */
function scorecard() {
  const a = A();
  const dims = [
    'Technical Depth', 'Communication Clarity', 'Leadership Signals',
    'Problem Solving', 'Culture Alignment', 'Growth Mindset',
    'Domain Expertise', 'Quantified Impact'
  ];
  return `
  <div class="section-h">Evaluation Scorecard</div>
  <div class="section-sub">Structured candidate assessment for hiring committee review</div>
  <div class="scorecard" id="scorecard-form">
    <div class="sc-header">
      <div>
        <div style="font-weight:700;font-size:1rem">${esc(a.candidate_name||'Candidate')}</div>
        <div style="font-size:.75rem;color:var(--text-3);font-family:var(--font-mono);margin-top:2px">${esc(a.current_role||'—')}</div>
      </div>
      <button class="btn-secondary" onclick="exportScorecard()">
        <svg width="12" height="12" viewBox="0 0 13 13" fill="none"><path d="M2.5 10.5h8M6.5 2.5v6M4 6l2.5 2.5L9 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Export Scorecard
      </button>
    </div>
    ${dims.map((dim,di) => `
      <div class="sc-row">
        <div class="sc-label">${dim}</div>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="sc-dots" id="sc-dim-${di}">
            ${[1,2,3,4,5].map(v=>`<div class="sc-dot" data-dim="${di}" data-val="${v}" onclick="setScore(${di},${v})" title="${v}/5"></div>`).join('')}
          </div>
          <span style="font-size:.7rem;color:var(--text-3);font-family:var(--font-mono);min-width:28px" id="sc-val-${di}">—/5</span>
        </div>
      </div>`).join('')}
    <div class="sc-row" style="margin-top:4px">
      <div class="sc-label">Notes</div>
      <textarea class="field-ta" id="sc-notes" rows="3" placeholder="Overall impression, key observations, follow-up actions…" style="margin-top:0;resize:none;font-size:.8rem"></textarea>
    </div>
    <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn-secondary" style="color:var(--green);border-color:rgba(30,217,160,.25)" onclick="setFinalDecision('hire')">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Advance
      </button>
      <button class="btn-secondary" style="color:var(--amber);border-color:rgba(255,170,64,.25)" onclick="setFinalDecision('maybe')">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v4M6 9v1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        Maybe
      </button>
      <button class="btn-secondary" style="color:var(--red);border-color:rgba(255,90,101,.25)" onclick="setFinalDecision('reject')">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        Decline
      </button>
    </div>
    <div id="sc-decision-msg" style="margin-top:10px;font-size:.8rem;color:var(--text-2)"></div>
  </div>`;
}

function initScorecard() { window._scorecardVals = {}; }

function setScore(dim, val) {
  if (!window._scorecardVals) window._scorecardVals = {};
  window._scorecardVals[dim] = val;
  const dots = document.querySelectorAll(`#sc-dim-${dim} .sc-dot`);
  dots.forEach((d,i) => {
    d.className = 'sc-dot' + (i < val ? ` filled filled-${i+1}` : '');
  });
  document.getElementById(`sc-val-${dim}`).textContent = val + '/5';
}

function setFinalDecision(d) {
  const msgs   = { hire:'✓ Candidate advanced to next round', maybe:'~ Added to maybe list', reject:'✗ Candidate declined' };
  const colors = { hire:'var(--green)', maybe:'var(--amber)', reject:'var(--red)' };
  const el     = document.getElementById('sc-decision-msg');
  if (el) { el.textContent = msgs[d]; el.style.color = colors[d]; }
  showToast(msgs[d], d === 'hire' ? 'success' : '');
}

function exportScorecard() {
  showToast('Opening print dialog\u2026', '');
  setTimeout(() => window.print(), 300);
}

/* ── PIPELINE ─────────────────────────────────────────────── */
function pipeline() {
  const a = A();
  const stages = ['Applied','Screened','Interview','Final Round','Offer','Hired'];
  const current = 2; // Interview stage
  return `
  <div class="section-h">Talent Pipeline</div>
  <div class="section-sub">Candidate pipeline management and recruitment workflow tracking</div>
  <div class="pipeline-track">
    ${stages.map((s,i)=>`
      <div class="pipeline-stage ${i===current?'current':i<current?'done':''}">
        ${s}
      </div>`).join('')}
  </div>
  <div class="two-col">
    <div class="card">
      <div class="card-title">Candidate Summary</div>
      <div class="item-list">
        ${li('green','✓',`ATS Score: <strong>${esc(String(n(a.overall_score)))}/100</strong>`)}
        ${li('blue','→',`Recommendation: <strong>${esc(a.hire_recommendation||'Pending')}</strong>`)}
        ${li('violet','→',`Experience: <strong>${esc(String(a.years_of_experience||'N/A'))} years</strong>`)}
        ${li('amber','→',`Classification: <strong>${esc(a.candidate_classification?.type||'N/A')}</strong>`)}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Suggested Next Actions</div>
      <div class="item-list">
        ${li('cyan','1','Schedule technical interview')}
        ${li('cyan','2','Send skills assessment or take-home project')}
        ${li('cyan','3','Request 2–3 professional references')}
        ${li('cyan','4','Prepare panel interview scorecard')}
      </div>
    </div>
  </div>
  <div class="card">
    <div class="card-title">Recruitment Notes</div>
    <textarea class="field-ta" rows="3" placeholder="Add pipeline notes, decisions, or follow-up reminders…" style="font-size:.8rem;resize:none;margin-top:0"></textarea>
  </div>`;
}

/* ── DECISION ─────────────────────────────────────────────── */
function decision() {
  const a   = A();
  const rec = a.hire_recommendation || '—';
  const isH = /hire/i.test(rec) && !/not|pass|no/i.test(rec);
  return `
  <div class="section-h">AI Hire Decision</div>
  <div class="section-sub">Structured recommendation with confidence scoring and risk assessment</div>
  <div class="card" style="margin-bottom:12px;background:${isH?'var(--green-dim)':'var(--red-dim)'};border-color:${isH?'rgba(30,217,160,.3)':'rgba(255,90,101,.3)'}">
    <div style="font-family:var(--font-serif);font-size:2.4rem;font-weight:400;color:${isH?'var(--green)':'var(--red)'};letter-spacing:-0.03em;line-height:1">${esc(rec)}</div>
    ${a.hire_rationale ? `<p style="margin-top:12px;font-size:.82rem;color:var(--text-2);line-height:1.75">${esc(a.hire_rationale)}</p>` : ''}
  </div>
  <div class="two-col">
    <div class="card">
      <div class="card-title">Factors In Favour</div>
      <div class="item-list">
        ${(a.top_strengths||[]).slice(0,4).map(s=>li('green','✓',esc(s.strength||String(s)))).join('')||noData()}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Factors Against</div>
      <div class="item-list">
        ${(a.potential_gaps||[]).slice(0,4).map(g=>li(g.severity==='Critical'?'red':'amber',g.severity==='Critical'?'✗':'~',esc(g.gap||String(g)))).join('')||`<p class="nodata" style="color:var(--green)">No significant gaps.</p>`}
      </div>
    </div>
  </div>
  ${a.jd_match_score != null ? `
  <div class="card">
    <div class="card-title">Key Decision Metrics</div>
    <div style="display:flex;gap:36px;flex-wrap:wrap">
      <div><div style="font-size:1.8rem;font-family:var(--font-mono);font-weight:700;color:var(--accent)">${a.overall_score||0}</div><div style="font-size:.68rem;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-top:3px">ATS Score</div></div>
      <div><div style="font-size:1.8rem;font-family:var(--font-mono);font-weight:700;color:var(--cyan)">${a.jd_match_score}%</div><div style="font-size:.68rem;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-top:3px">JD Match</div></div>
      <div><div style="font-size:1.8rem;font-family:var(--font-mono);font-weight:700;color:var(--green)">${(a.quantified_impact||{}).score||0}</div><div style="font-size:.68rem;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-top:3px">Impact Score</div></div>
    </div>
  </div>` : ''}`;
}

/* ═══════════════════════════════════════════════════════════
   BUILDER HELPERS
═══════════════════════════════════════════════════════════ */
function ax(name, score, color) {
  const s = Math.min(Math.max(Number(score)||0,0),100);
  return `<div class="axis-card">
    <div class="axis-top"><span class="axis-name">${name}</span><span class="axis-score" style="color:${color}">${s}</span></div>
    <div class="axis-bar"><div class="axis-fill" style="background:${color}" data-w="${s}"></div></div>
  </div>`;
}

function li(color, bullet, text, badge='') {
  return `<div class="item-row">
    <div class="item-bullet ${color}">${bullet}</div>
    <div class="item-text">${text}</div>
    ${badge ? `<span class="item-badge badge-${color==='red'?'red':color==='amber'?'amber':color==='green'?'green':color==='blue'?'blue':color==='violet'?'violet':'teal'}">${esc(String(badge))}</span>` : ''}
  </div>`;
}

function tl(title, company, date, desc, compact=false) {
  return `<div class="tl-item">
    <div class="tl-left"><div class="tl-dot"></div>${!compact?'<div class="tl-line"></div>':''}</div>
    <div>
      <div class="tl-title">${title}</div>
      <div class="tl-company">${company}</div>
      <div class="tl-date">${date}</div>
      ${desc ? `<div class="tl-desc">${desc}</div>` : ''}
    </div>
  </div>`;
}

function qa(num, question, difficulty, detail='') {
  const cls = {Hard:'difficulty-hard',Medium:'difficulty-medium',Easy:'difficulty-easy'}[difficulty]||'difficulty-medium';
  return `<div class="qa-item">
    <div class="qa-q">
      <span class="qa-num">Q${num}</span>
      <span class="qa-text">${question}</span>
      <span class="qa-difficulty ${cls}">${difficulty}</span>
      <svg class="qa-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div class="qa-a">${detail || 'Look for specificity — exact numbers, trade-offs made, and lessons learned.'}</div>
  </div>`;
}

function biasMeter(rows) {
  return `<div class="bias-meter">${rows.map(([l,s])=>{
    const c = s>=80?'var(--green)':s>=55?'var(--amber)':'var(--red)';
    return `<div class="bias-row">
      <div class="bias-label">${l}</div>
      <div class="bias-track"><div class="bias-fill" style="background:${c}" data-w="${s}"></div></div>
      <div class="bias-score" style="color:${c}">${s}%</div>
    </div>`;
  }).join('')}</div>`;
}

function noData() { return `<p class="nodata">No data available.</p>`; }

function copyText(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1600);
  });
}

/* ── Toast ────────────────────────────────────────────────── */
function showToast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast ' + type;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), type==='error'?5000:2800);
}
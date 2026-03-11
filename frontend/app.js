/* ═══════════════════════════════════════════════════════
   TALENTIQ v9.0 — AI Talent Intelligence
   Enhanced from v8.0 with world-class UX improvements
════════════════════════════════════════════════════════ */
'use strict';

const API = 'https://resume-analyzer-6wj1.onrender.com';

let currentTab   = 'overview';
let resumeFile   = null;
let reportData   = null;
let agentHistory = [];

/* ── Theme ───────────────────────────────────────── */
(function() {
  document.documentElement.dataset.theme = localStorage.getItem('tiq-theme') || 'dark';
})();

function toggleTheme() {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  localStorage.setItem('tiq-theme', t);
}

/* ── Server keep-alive ping ──────────────────────── */
setInterval(async () => { try { await fetch(`${API}/health`); } catch(_) {} }, 14 * 60 * 1000);

/* ── File handling ───────────────────────────────── */
document.getElementById('resume-file').addEventListener('change', function() {
  if (this.files[0]) setFile(this.files[0]);
});

const dz = document.getElementById('dropzone');
dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('drag-over'); });
dz.addEventListener('dragleave', ()  => dz.classList.remove('drag-over'));
dz.addEventListener('drop',      e  => {
  e.preventDefault();
  dz.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
});

function setFile(f) {
  resumeFile = f;
  document.getElementById('file-name').textContent = f.name;
  document.getElementById('file-preview').classList.add('show');
  dz.style.borderColor = 'var(--emerald)';
  dz.style.background  = 'var(--emerald-dim)';
}

function clearFile(e) {
  e && e.stopPropagation();
  resumeFile = null;
  document.getElementById('resume-file').value = '';
  document.getElementById('file-preview').classList.remove('show');
  dz.style.borderColor = '';
  dz.style.background  = '';
}

/* ── Analysis ────────────────────────────────────── */
async function startAnalysis() {
  if (!resumeFile) { showToast('Please upload a resume first', 'error'); return; }
  showScreen('loading');

  const stages = document.querySelectorAll('#loading-stages .stage');
  stages.forEach(s => s.classList.remove('active', 'done'));
  let si = 0;

  function nextStage() {
    if (si > 0 && stages[si - 1]) { stages[si - 1].classList.remove('active'); stages[si - 1].classList.add('done'); }
    if (si < stages.length)        { stages[si].classList.add('active'); si++; }
    const pct = Math.round((si / stages.length) * 70);
    updateBar(pct);
  }
  nextStage();
  const stageTimer = setInterval(() => { if (si < stages.length) nextStage(); else clearInterval(stageTimer); }, 7000);

  const title = document.getElementById('loading-title');
  const sub   = document.getElementById('loading-sub');
  try {
    title.textContent = 'Waking up intelligence engine…';
    sub.textContent   = 'Free tier cold start — may take up to 60s';
    await wakeUpServer();

    title.textContent = 'Analyzing Candidate…';
    sub.textContent   = 'Deep AI pipeline running — 6 intelligence pillars active';

    const fd = new FormData();
    fd.append('file', resumeFile);
    const jd = document.getElementById('jd-input').value.trim();
    const rl = document.getElementById('role-input').value.trim();
    const co = document.getElementById('company-input').value.trim();
    if (jd) fd.append('job_description', jd);
    if (rl) fd.append('target_role',     rl);
    if (co) fd.append('company_name',    co);

    updateBar(75);
    const res = await fetch(`${API}/analyze`, { method: 'POST', body: fd });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || `Server error ${res.status}`); }
    reportData = await res.json();
    agentHistory = [];

    clearInterval(stageTimer);
    stages.forEach(s => { s.classList.remove('active'); s.classList.add('done'); });
    updateBar(100);
    await sleep(700);

    populateResultsHeader();
    buildMobileDrawer();
    showScreen('results');
    switchTab('overview');

    /* Confetti on strong hire */
    const rec = (A().hire_recommendation || '').toLowerCase();
    if (/strong.*hire/.test(rec)) {
      await sleep(500);
      launchConfetti();
      showToast('Strong Hire recommendation! 🎉', 'success');
    }
  } catch (err) {
    clearInterval(stageTimer);
    showScreen('upload');
    const msg = (!err.message || err.message === 'Failed to fetch')
      ? 'Cannot reach server. Check your internet and try again.'
      : err.message;
    showToast(msg, 'error');
  }
}

function updateBar(pct) {
  const b = document.getElementById('loading-bar');
  const p = document.getElementById('loading-pct');
  if (b) b.style.width = pct + '%';
  if (p) p.textContent  = pct + '%';
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
    } catch(_) {}
    await sleep(3000);
  }
  throw new Error('Server did not respond within 90s.');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
}

function resetApp() {
  clearFile();
  reportData = null;
  agentHistory = [];
  ['jd-input', 'role-input', 'company-input'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  showScreen('upload');
}

/* ── Results header population ───────────────────── */
function populateResultsHeader() {
  const a   = A();
  const name  = a.candidate_name || '—';
  const role  = a.current_role || a.experience_level || '—';
  const score = a.overall_score || 0;
  const rec   = (a.hire_recommendation || '').trim();
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';

  document.getElementById('r-avatar').textContent    = initials;
  document.getElementById('r-name').textContent      = name;
  document.getElementById('r-role').textContent      = role;

  /* Animated score counter */
  animateCounter(document.getElementById('r-score-num'), 0, score, 1200);

  const badge = document.getElementById('hire-badge');
  document.getElementById('hire-label').textContent  = rec || 'Pending';
  badge.className = 'hire-badge ' + (
    /strongly.*hire|strong.*hire/i.test(rec) ? 'strong-yes' :
    /caution/i.test(rec)                     ? 'maybe'      :
    /not|pass|no/i.test(rec)                 ? 'no'         : 'yes'
  );

  renderContactLinks(a.contact_info || a.contact || {});

  document.title = `TalentIQ — ${name}`;
}

function renderContactLinks(ci) {
  const links = [];
  const mk = (cls, href, icon, label, ext) =>
    `<a href="${esc(href)}" class="contact-link ${cls}" ${ext ? 'target="_blank" rel="noopener"' : ''}>
      <span>${icon}</span>
      <span style="overflow:hidden;text-overflow:ellipsis;max-width:100px">${esc(label)}</span>
    </a>`;
  if (ci.email)     links.push(mk('email',    `mailto:${ci.email}`,  '✉', ci.email,     false));
  if (ci.phone)     links.push(mk('phone',    `tel:${ci.phone}`,     '☎', ci.phone,     false));
  if (ci.linkedin)  links.push(mk('linkedin',  ci.linkedin,          'in', 'LinkedIn',  true));
  if (ci.github)    links.push(mk('github',    ci.github,            '⊕', 'GitHub',     true));
  if (ci.portfolio) links.push(mk('portfolio', ci.portfolio,         '⊗', 'Portfolio',  true));
  document.getElementById('contact-links').innerHTML = links.length
    ? links.join('')
    : `<span style="font-size:.67rem;color:var(--text-3);font-family:var(--font-mono)">No contact info extracted</span>`;
}

/* ── Sidebar toggle ──────────────────────────────── */
function toggleSidebar() { document.getElementById('r-body').classList.toggle('sidebar-collapsed'); }

/* ── Mobile drawer ───────────────────────────────── */
function buildMobileDrawer() {
  const tabs = [
    { tab:'overview',    label:'Dashboard',       s:'OVERVIEW'  },
    { tab:'skills',      label:'Skills',          s:'OVERVIEW'  },
    { tab:'experience',  label:'Experience',      s:'OVERVIEW'  },
    { tab:'analysis',    label:'Strengths & Gaps',s:'ASSESSMENT'},
    { tab:'impact',      label:'Impact Score',    s:'ASSESSMENT'},
    { tab:'realvsbuzz',  label:'Real vs Buzz',    s:'ASSESSMENT'},
    { tab:'jdmatch',     label:'JD Match',        s:'ASSESSMENT'},
    { tab:'redflags',    label:'Red Flags',       s:'ASSESSMENT'},
    { tab:'technical',   label:'Technical',       s:'INTERVIEW' },
    { tab:'behavioral',  label:'Behavioural',     s:'INTERVIEW' },
    { tab:'situational', label:'Situational',     s:'INTERVIEW' },
    { tab:'deepdive',    label:'Deep Dive',       s:'INTERVIEW' },
    { tab:'bias',        label:'Bias Audit',      s:'INTELLIGENCE'},
    { tab:'coaching',    label:'Coaching',        s:'INTELLIGENCE'},
    { tab:'outreach',    label:'Outreach',        s:'INTELLIGENCE'},
    { tab:'agent',       label:'Agent',           s:'AI'        },
    { tab:'scorecard',   label:'Scorecard',       s:'AI'        },
    { tab:'pipeline',    label:'Pipeline',        s:'AI'        },
    { tab:'decision',    label:'Hire Decision',   s:'AI'        },
  ];
  let last = '', html = '';
  tabs.forEach(t => {
    if (t.s !== last) { html += `<div class="mob-drawer-title">${t.s}</div>`; last = t.s; }
    html += `<button class="mob-drawer-btn" data-tab="${t.tab}" onclick="switchTab('${t.tab}');toggleMobileMenu()">${t.label}</button>`;
  });
  document.getElementById('mob-drawer').innerHTML = html;
}

function toggleMobileMenu() {
  document.getElementById('mob-drawer').classList.toggle('open');
  document.getElementById('mob-overlay').classList.toggle('show');
}

function setMobActive(btn) {
  document.querySelectorAll('.mob-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

/* ── Export / Copy ───────────────────────────────── */
function exportReport() { if (!reportData) return; showToast('Opening print dialog…', ''); setTimeout(() => window.print(), 300); }

function copyReport() {
  if (!reportData) return;
  const a = A();
  const text = [
    'TALENTIQ CANDIDATE INTELLIGENCE REPORT',
    '─'.repeat(40),
    `Candidate:      ${a.candidate_name || '—'}`,
    `Role:           ${a.current_role || '—'}`,
    `ATS Score:      ${a.overall_score || 0}/100`,
    `Recommendation: ${a.hire_recommendation || '—'}`,
    `Experience:     ${a.years_of_experience || '—'} years`,
    '',
    '── STRENGTHS ──',
    ...(a.top_strengths || []).map(s => '• ' + (s.strength || s)),
    '',
    '── GAPS ──',
    ...(a.potential_gaps || []).map(g => '• ' + (g.gap || g)),
    '',
    '── HIRE RATIONALE ──',
    a.hire_rationale || '—',
  ].join('\n');
  navigator.clipboard.writeText(text).then(() => showToast('Report copied to clipboard!', 'success'));
}

/* ── Tab navigation ──────────────────────────────── */
document.getElementById('sb-nav').addEventListener('click', e => {
  const btn = e.target.closest('.nav-btn[data-tab]');
  if (btn) switchTab(btn.dataset.tab);
});

/* Keyboard navigation */
document.addEventListener('keydown', e => {
  if (!reportData) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const tabs = Object.keys(TABS);
  const idx  = tabs.indexOf(currentTab);
  if (e.key === 'ArrowRight' && idx < tabs.length - 1) switchTab(tabs[idx + 1]);
  if (e.key === 'ArrowLeft'  && idx > 0)               switchTab(tabs[idx - 1]);
});

function switchTab(tab) {
  currentTab = tab;

  document.querySelectorAll('#sb-nav .nav-btn').forEach(b => b.classList.remove('active'));
  const a = document.querySelector(`#sb-nav .nav-btn[data-tab="${tab}"]`);
  if (a) a.classList.add('active');

  document.querySelectorAll('.mob-btn[data-tab]').forEach(b => b.classList.remove('active'));
  const mb = document.querySelector(`.mob-btn[data-tab="${tab}"]`);
  if (mb) mb.classList.add('active');

  const el = document.getElementById('tab-content');
  el.classList.remove('anim-up');
  void el.offsetWidth;
  el.classList.add('anim-up');
  el.innerHTML = TABS[tab] ? TABS[tab]() : `<p class="nodata">Coming soon.</p>`;

  animateBars();
  bindQA();
  if (tab === 'agent')     initAgent();
  if (tab === 'scorecard') initScorecard();

  const main = document.getElementById('r-main');
  if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Post-render animations ──────────────────────── */
function animateBars() {
  setTimeout(() => {
    /* Score rings */
    document.querySelectorAll('.score-ring-fill').forEach(f => {
      const p = parseFloat(f.dataset.pct) || 0;
      f.style.strokeDashoffset = 339.3 - (339.3 * p / 100);
    });
    /* Progress bars */
    document.querySelectorAll('[data-w]').forEach(b => { b.style.width = b.dataset.w + '%'; });
    /* Score ring counters */
    document.querySelectorAll('.score-ring-num[data-target]').forEach(el => {
      animateCounter(el, 0, parseInt(el.dataset.target), 1400);
    });
  }, 60);
}

function bindQA() {
  document.querySelectorAll('.qa-q').forEach(q => {
    q.addEventListener('click', () => q.closest('.qa-item').classList.toggle('open'));
  });
}

/* ── Counter animation ───────────────────────────── */
function animateCounter(el, from, to, duration) {
  if (!el) return;
  const start = performance.now();
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 4);
    el.textContent = Math.round(from + (to - from) * ease);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ── Confetti ────────────────────────────────────── */
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  canvas.style.display = 'block';
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const pieces = Array.from({ length: 120 }, () => ({
    x:    Math.random() * canvas.width,
    y:    Math.random() * canvas.height - canvas.height,
    r:    Math.random() * 6 + 3,
    d:    Math.random() * 80 + 10,
    color: ['#8B5CF6','#22D3EE','#10B981','#F59E0B','#EC4899','#A78BFA'][Math.floor(Math.random() * 6)],
    tilt: Math.floor(Math.random() * 10) - 10,
    tiltAngle: 0,
    tiltAngleIncrement: (Math.random() * 0.07) + 0.05,
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frame++;
    pieces.forEach(p => {
      p.tiltAngle += p.tiltAngleIncrement;
      p.y += (Math.cos(frame / 5 + p.d) + 3) * 1.2;
      p.tilt = Math.sin(p.tiltAngle) * 12;
      ctx.beginPath();
      ctx.lineWidth = p.r / 2;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r / 3, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 5);
      ctx.stroke();
    });
    if (frame < 200) requestAnimationFrame(draw);
    else { ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.style.display = 'none'; }
  }
  requestAnimationFrame(draw);
}

/* ── Data accessors ──────────────────────────────── */
function A()  { return (reportData && reportData.analysis)           || {}; }
function Q()  { return (reportData && reportData.interview_questions) || {}; }
function BI() { return (reportData && reportData.bias_report)         || {}; }
function CO() { return (reportData && reportData.candidate_feedback)  || {}; }
function esc(s) { if (s == null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function n(v, fb = 0) { return v != null ? v : fb; }
function scoreColor(s) { return s >= 80 ? 'var(--emerald)' : s >= 60 ? 'var(--spark)' : s >= 40 ? 'var(--amber)' : 'var(--crimson)'; }
function noData() { return `<p class="nodata">No data available.</p>`; }

/* ── Tab registry ────────────────────────────────── */
const TABS = { overview, skills, experience, analysis, impact, realvsbuzz, jdmatch, redflags, technical, behavioral, situational, deepdive, bias, coaching, outreach, agent, scorecard, pipeline, decision };

/* ═══════════════════════════════════════════════════
   TAB RENDERERS
════════════════════════════════════════════════════ */

/* ── OVERVIEW ────────────────────────────────────── */
function overview() {
  const a = A(), sc = n(a.overall_score), at = a.ats_scores || {}, qi = a.quantified_impact || {}, cl = a.candidate_classification || {}, jd = a.jd_match_score;
  return `
  <div style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:4px">
    <div class="section-h">Intelligence Dashboard</div>
    <span style="font-size:.67rem;font-family:var(--font-mono);color:var(--text-3)">${new Date().toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
  </div>
  <div class="section-sub">Overall candidate fitness across all evaluation dimensions</div>

  <div class="score-ring-wrap">
    <div class="ring-wrap">
      <svg class="score-ring-svg" width="120" height="120" viewBox="0 0 120 120">
        <circle class="score-ring-track" cx="60" cy="60" r="54"/>
        <circle class="score-ring-fill" cx="60" cy="60" r="54" data-pct="${sc}" stroke="${scoreColor(sc)}"/>
      </svg>
      <div class="score-ring-text">
        <span class="score-ring-num" data-target="${sc}" style="color:${scoreColor(sc)}">0</span>
        <span class="score-ring-lbl">/100</span>
      </div>
    </div>
    <div class="score-ring-desc">
      <h3>${esc(a.candidate_name || '—')}</h3>
      <p>${esc(a.professional_summary || a.hire_rationale || 'AI analysis complete.')}</p>
      <div class="ring-tags" style="margin-top:10px">
        ${a.hire_recommendation ? `<span class="item-badge badge-teal">${esc(a.hire_recommendation)}</span>` : ''}
        ${a.years_of_experience != null ? `<span class="item-badge badge-blue">${a.years_of_experience} yrs exp</span>` : ''}
        ${a.experience_level ? `<span class="item-badge badge-violet">${esc(a.experience_level)}</span>` : ''}
        ${a.current_role ? `<span class="item-badge badge-amber">${esc(a.current_role)}</span>` : ''}
      </div>
    </div>
  </div>

  <div class="axis-grid">
    ${ax('Keyword Density',  n(at.keyword_density),    'var(--blue)')}
    ${ax('Experience Depth', n(at.experience_depth),   'var(--spark)')}
    ${ax('Achievement Impact',n(at.achievement_impact),'var(--emerald)')}
    ${ax('Skills Coverage',  n(at.skills_coverage),    'var(--violet)')}
    ${ax('Format Quality',   n(at.format_quality),     'var(--amber)')}
    ${ax('Career Progression',n(at.career_progression),'var(--pink)')}
  </div>

  <div class="stat-stripe">
    ${stC('JD Match',       jd != null ? jd + '%' : 'N/A',  jd != null ? (jd >= 70 ? 'Strong match' : jd >= 45 ? 'Moderate' : 'Weak match') : 'No JD provided', 'var(--cyan)',    jd || 0)}
    ${stC('Impact Score',   n(qi.score),                     esc(qi.verdict || '—'),                                                                                'var(--emerald)', n(qi.score))}
    ${stC('Candidate Type', esc(cl.type || '—'),             esc(cl.buzz_word_rating || '—'),                                                                       'var(--amber)',   55)}
    ${stC('Career Velocity',esc(a.career_velocity || '—'),   esc((a.career_velocity_evidence || '').slice(0, 50)),                                                  'var(--blue)',    65)}
  </div>

  <div class="two-col">
    <div class="card">
      <div class="card-title" style="color:var(--emerald)">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Top Strengths
      </div>
      <div class="item-list">${(a.top_strengths || []).slice(0, 4).map(s =>
        li('green', '✓', esc(s.strength || String(s)) + (s.evidence ? ' — <em>' + esc(s.evidence) + '</em>' : ''))
      ).join('') || noData()}</div>
    </div>
    <div class="card">
      <div class="card-title" style="color:var(--crimson)">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.1"/><path d="M6 3.5V6.5M6 8.5v.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        Key Gaps
      </div>
      <div class="item-list">${(a.potential_gaps || []).slice(0, 4).map(g =>
        li(g.severity === 'Critical' ? 'red' : 'amber', g.severity === 'Critical' ? '!' : '~',
          esc(g.gap || String(g)) + (g.suggestion ? ' — <em>' + esc(g.suggestion) + '</em>' : ''), g.severity || '')
      ).join('') || '<p style="color:var(--emerald);font-size:.8rem">✓ No significant gaps.</p>'}</div>
    </div>
  </div>`;
}

function stC(label, val, sub, color, w) {
  return `<div class="stat-card">
    <div class="stat-label">${label}</div>
    <div class="stat-val" style="color:${color}">${val}</div>
    <div class="stat-sub">${sub}</div>
    <div class="stat-bar"><div class="stat-fill" style="background:${color}" data-w="${Math.min(100,w)}"></div></div>
  </div>`;
}

/* ── SKILLS ──────────────────────────────────────── */
function skills() {
  const a = A(), sk = a.technical_skills || {};
  const GROUPS = [
    { l: 'Languages',     c: 'var(--blue)',    items: sk.languages    || [] },
    { l: 'Frameworks',    c: 'var(--violet)',  items: sk.frameworks   || [] },
    { l: 'AI / ML',       c: 'var(--spark)',   items: sk.ai_ml        || [] },
    { l: 'Cloud & DevOps',c: 'var(--emerald)', items: sk.cloud_devops || [] },
    { l: 'Databases',     c: 'var(--amber)',   items: sk.databases    || [] },
    { l: 'Tools',         c: 'var(--pink)',    items: sk.tools        || [] },
    { l: 'Other',         c: 'var(--text-2)',  items: sk.other        || [] },
    { l: 'Soft Skills',   c: 'var(--cyan)',    items: a.soft_skills   || [] },
  ].filter(g => g.items.length);

  if (!GROUPS.length) return `<div class="section-h">Skills Intelligence</div><p class="nodata">No skills extracted.</p>`;

  return `<div class="section-h">Skills Intelligence</div>
  <div class="section-sub">Evidence-validated technical and soft skills extracted from the resume</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    ${GROUPS.map(g => `
      <div class="card">
        <div class="card-title" style="color:${g.c}">${g.l}</div>
        <div class="skill-cloud">
          ${g.items.map(s => `<span class="skill-tag" style="color:${g.c};border-color:${g.c}33;background:${g.c}11">${esc(s)}</span>`).join('')}
        </div>
      </div>`).join('')}
  </div>
  ${(a.inferred_skills || []).length ? `
    <div class="card" style="margin-top:12px">
      <div class="card-title">Inferred Skills <span style="font-size:.62rem;color:var(--text-3)">(not explicitly stated)</span></div>
      <div class="skill-cloud">
        ${(a.inferred_skills || []).map(s => `<span class="skill-tag" style="border-style:dashed;color:var(--text-3)">${esc(s)}</span>`).join('')}
      </div>
    </div>` : ''}`;
}

/* ── EXPERIENCE ──────────────────────────────────── */
function experience() {
  const a = A(), exps = a.work_experience || [], edu = a.education || [], cert = a.certifications || [], proj = a.projects || [];
  return `<div class="section-h">Work Experience</div>
  <div class="section-sub">Career timeline with AI-extracted impact signals</div>
  ${exps.length ? `
    <div class="card">
      <div class="timeline">
        ${exps.map(e => tl(
          esc(e.role || '—'), esc(e.company || ''), esc(e.duration || ''),
          (e.key_achievements || e.impact_metrics || []).map(x => `<div style="margin-bottom:3px">• ${esc(x)}</div>`).join('')
        )).join('')}
      </div>
    </div>` : '<p style="color:var(--text-2);margin-bottom:16px">No work experience extracted.</p>'}
  <div class="two-col">
    <div class="card">
      <div class="card-title">Education</div>
      ${edu.length ? `<div class="timeline">${edu.map(e => tl(esc(e.degree || '—'), esc(e.institution || ''), esc(e.year || ''), '', true)).join('')}</div>` : noData()}
    </div>
    <div class="card">
      <div class="card-title">Certifications</div>
      ${cert.length ? `<div class="item-list">${cert.map(c => li('blue', '🎓', esc(c))).join('')}</div>` : noData()}
    </div>
  </div>
  ${proj.length ? `
    <div class="card">
      <div class="card-title">Notable Projects</div>
      ${proj.map(p => `
        <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--edge)">
          <div style="font-weight:700;font-size:.88rem;margin-bottom:4px;font-family:var(--font-display);letter-spacing:-.01em">${esc(p.name || '')}</div>
          <p style="font-size:.78rem;color:var(--text-2);line-height:1.65;margin-bottom:8px">${esc(p.description || '')}</p>
          <div class="skill-cloud">${(p.technologies || []).map(t =>
            `<span class="skill-tag" style="color:var(--spark);border-color:var(--spark)33;background:var(--spark-dim);font-size:.7rem">${esc(t)}</span>`
          ).join('')}</div>
        </div>`).join('')}
    </div>` : ''}`;
}

/* ── ANALYSIS (Strengths & Gaps) ─────────────────── */
function analysis() {
  const a = A();
  return `<div class="section-h">Strengths &amp; Gaps Analysis</div>
  <div class="section-sub">Evidence-based assessment of candidate fitness for the target role</div>
  <div class="card" style="margin-bottom:14px;border-left:3px solid var(--emerald)">
    <div class="card-title" style="color:var(--emerald)">Top Strengths</div>
    <div class="item-list">${(a.top_strengths || []).map(s =>
      li('green', 'S', `<strong>${esc(s.strength || String(s))}</strong>${s.evidence ? ' — ' + esc(s.evidence) : ''}`, s.rarity || '')
    ).join('') || noData()}</div>
  </div>
  <div class="card" style="margin-bottom:14px;border-left:3px solid var(--crimson)">
    <div class="card-title" style="color:var(--crimson)">Potential Gaps</div>
    <div class="item-list">${(a.potential_gaps || []).map(g =>
      li(g.severity === 'Critical' ? 'red' : 'amber', g.severity === 'Critical' ? '!' : '~',
        `<strong>${esc(g.gap || String(g))}</strong>${g.suggestion ? ' — ' + esc(g.suggestion) : ''}`, g.severity || '')
    ).join('') || '<p style="color:var(--emerald);font-size:.8rem">✓ No significant gaps.</p>'}</div>
  </div>
  ${a.career_trajectory ? `
    <div class="card">
      <div class="card-title">Career Trajectory</div>
      <p style="font-size:.82rem;color:var(--text-2);line-height:1.72;font-style:italic">${esc(a.career_trajectory)}</p>
    </div>` : ''}
  ${(a.ideal_role_fit || []).length ? `
    <div class="card">
      <div class="card-title">Ideal Role Fits</div>
      <div class="skill-cloud" style="margin-top:4px">
        ${(a.ideal_role_fit || []).map(r => `<span class="item-badge badge-teal">${esc(r)}</span>`).join('')}
      </div>
    </div>` : ''}`;
}

/* ── IMPACT ──────────────────────────────────────── */
function impact() {
  const qi = A().quantified_impact || {}, sc = n(qi.score);
  return `<div class="section-h">Impact Score</div>
  <div class="section-sub">Quantified achievement analysis — how much this candidate proves impact with numbers</div>
  <div class="score-ring-wrap">
    <div class="ring-wrap">
      <svg class="score-ring-svg" width="120" height="120" viewBox="0 0 120 120">
        <circle class="score-ring-track" cx="60" cy="60" r="54"/>
        <circle class="score-ring-fill" cx="60" cy="60" r="54" data-pct="${sc}" stroke="var(--emerald)"/>
      </svg>
      <div class="score-ring-text">
        <span class="score-ring-num" data-target="${sc}" style="color:var(--emerald)">0</span>
        <span class="score-ring-lbl">/100</span>
      </div>
    </div>
    <div class="score-ring-desc">
      <h3>Quantified Impact Score</h3>
      <p><strong>${esc(qi.verdict || '—')}</strong> — ${n(qi.quantified_percentage)}% of resume bullets contain hard numbers.</p>
      ${qi.improvement_tip ? `<p style="margin-top:8px;font-size:.75rem;color:var(--text-3)">${esc(qi.improvement_tip)}</p>` : ''}
    </div>
  </div>
  <div class="three-col">
    <div class="card" style="text-align:center;border-left:3px solid var(--text-3)">
      <div style="font-size:2.2rem;font-family:var(--font-display);font-weight:800">${n(qi.total_bullets)}</div>
      <div style="font-size:.68rem;color:var(--text-3);font-family:var(--font-mono);margin-top:4px">Total bullets</div>
    </div>
    <div class="card" style="text-align:center;border-left:3px solid var(--emerald)">
      <div style="font-size:2.2rem;font-family:var(--font-display);font-weight:800;color:var(--emerald)">${n(qi.quantified_bullets)}</div>
      <div style="font-size:.68rem;color:var(--text-3);font-family:var(--font-mono);margin-top:4px">Quantified</div>
    </div>
    <div class="card" style="text-align:center;border-left:3px solid var(--spark)">
      <div style="font-size:2.2rem;font-family:var(--font-display);font-weight:800;color:var(--spark)">${n(qi.quantified_percentage)}%</div>
      <div style="font-size:.68rem;color:var(--text-3);font-family:var(--font-mono);margin-top:4px">Rate</div>
    </div>
  </div>
  <div class="two-col">
    <div class="card">
      <div class="card-title" style="color:var(--emerald)">Strong Bullets</div>
      <div class="item-list">${(qi.strong_examples || []).map(e => li('green', '✓', esc(e))).join('') || noData()}</div>
    </div>
    <div class="card">
      <div class="card-title" style="color:var(--crimson)">Weak / Vague Bullets</div>
      <div class="item-list">${(qi.weak_examples || []).map(e => li('red', '✗', esc(e))).join('') || '<p style="color:var(--emerald);font-size:.8rem">✓ No weak bullets!</p>'}</div>
    </div>
  </div>`;
}

/* ── REAL VS BUZZ ────────────────────────────────── */
function realvsbuzz() {
  const cl = A().candidate_classification || {};
  const bc = cl.type === 'Proven' ? 'var(--emerald)' : cl.type === 'High Potential' ? 'var(--spark)' : 'var(--amber)';
  return `<div class="section-h">Real vs Buzz Analysis</div>
  <div class="section-sub">Substance detection — separating evidence-backed claims from empty buzzwords</div>
  <div class="card" style="border-left:3px solid ${bc};margin-bottom:14px">
    <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
      <div style="font-family:var(--font-display);font-size:2.2rem;font-weight:800;color:${bc};letter-spacing:-.04em">${esc(cl.type || '—')}</div>
      <div>
        <div style="font-size:.75rem;color:var(--text-2)">Confidence: <strong>${esc(cl.confidence || '—')}</strong></div>
        <div style="font-size:.75rem;color:var(--text-2)">Buzz rating: <strong>${esc(cl.buzz_word_rating || '—')}</strong></div>
      </div>
    </div>
    ${cl.evidence ? `<p style="margin-top:10px;font-size:.8rem;color:var(--text-2);font-style:italic">${esc(cl.evidence)}</p>` : ''}
  </div>
  <div class="two-col">
    <div class="card">
      <div class="card-title" style="color:var(--emerald)">✓ Substance Examples</div>
      <div class="item-list">${(cl.substance_examples || []).map(e => li('green', '✓', esc(e))).join('') || noData()}</div>
    </div>
    <div class="card">
      <div class="card-title" style="color:var(--crimson)">✗ Buzz Phrases</div>
      <div class="item-list">${(cl.buzz_examples || []).map(e => li('red', '✗', esc(e))).join('') || '<p style="color:var(--emerald);font-size:.8rem">✓ No buzz phrases detected!</p>'}</div>
    </div>
  </div>`;
}

/* ── JD MATCH ────────────────────────────────────── */
function jdmatch() {
  const a = A(), sc = a.jd_match_score;
  if (sc == null) return `<div class="section-h">JD Match</div>
    <div class="empty-state">
      <p style="font-size:2.5rem">📋</p>
      <p>No job description was provided.</p>
      <button class="btn-secondary" onclick="resetApp()">New Analysis with JD</button>
    </div>`;
  const matched = a.jd_matched_skills || [], missing = a.jd_missing_skills || [], partial = a.jd_partial_skills || [];
  return `<div class="section-h">JD Match Analysis</div>
  <div class="section-sub">How well this candidate maps to the provided job description requirements</div>
  <div class="score-ring-wrap">
    <div class="ring-wrap">
      <svg class="score-ring-svg" width="120" height="120" viewBox="0 0 120 120">
        <circle class="score-ring-track" cx="60" cy="60" r="54"/>
        <circle class="score-ring-fill" cx="60" cy="60" r="54" data-pct="${sc}" stroke="var(--spark)"/>
      </svg>
      <div class="score-ring-text">
        <span class="score-ring-num" data-target="${sc}" style="color:var(--spark)">0</span>
        <span class="score-ring-lbl">%</span>
      </div>
    </div>
    <div class="score-ring-desc">
      <h3>JD Match Score</h3>
      <p>${esc(a.jd_match_summary || '—')}</p>
    </div>
  </div>
  <div class="two-col">
    <div class="card">
      <div class="card-title" style="color:var(--emerald)">✓ Matched (${matched.length})</div>
      <div class="skill-cloud">${matched.map(s => `<span class="item-badge badge-green">${esc(s)}</span>`).join('') || noData()}</div>
    </div>
    <div class="card">
      <div class="card-title" style="color:var(--crimson)">✗ Missing (${missing.length})</div>
      <div class="skill-cloud">${missing.map(s => `<span class="item-badge badge-red">${esc(s)}</span>`).join('') || '<p style="color:var(--emerald);font-size:.8rem">✓ No gaps!</p>'}</div>
    </div>
  </div>
  ${partial.length ? `
    <div class="card">
      <div class="card-title" style="color:var(--amber)">~ Partial (${partial.length})</div>
      <div class="skill-cloud">${partial.map(s => `<span class="item-badge badge-amber">${esc(s)}</span>`).join('')}</div>
    </div>` : ''}`;
}

/* ── RED FLAGS ───────────────────────────────────── */
function redflags() {
  const flags = A().red_flags || [], probes = Q().red_flag_probes || [];
  return `<div class="section-h">Red Flags</div>
  <div class="section-sub">Resume anomalies and high-risk signals to probe in interviews</div>
  <div class="card" style="margin-bottom:14px;border-left:3px solid var(--crimson)">
    <div class="card-title" style="color:var(--crimson)">Resume Red Flags</div>
    ${flags.length
      ? `<div class="item-list">${flags.map(f =>
          li('red', '⚑', `<strong>${esc(f.flag || String(f))}</strong>${f.explanation ? ' — ' + esc(f.explanation) : ''}`)
        ).join('')}</div>`
      : '<p style="color:var(--emerald);font-size:.82rem">✓ No significant red flags detected.</p>'}
  </div>
  ${probes.length ? `
    <div class="card">
      <div class="card-title">Probing Interview Questions</div>
      <div class="qa-list">${probes.map((p, i) =>
        qa(i + 1, esc(p.question || ''), 'Hard',
          (p.concern       ? `<strong>Concern:</strong> ${esc(p.concern)}<br>` : '') +
          (p.green_flag_answer ? `<strong>Strong answer:</strong> ${esc(p.green_flag_answer)}<br>` : '') +
          (p.red_flag_answer   ? `<strong>Concerning answer:</strong> ${esc(p.red_flag_answer)}` : '')
        )
      ).join('')}</div>
    </div>` : ''}`;
}

/* ── INTERVIEW PACK helpers ──────────────────────── */
function technical()  { return iqTab('Technical Questions',  'Role-specific technical questions grounded in this resume', Q().technical_questions  || [], q =>
  (q.expected_answer_hint ? `<strong>Look for:</strong> ${esc(q.expected_answer_hint)}<br>` : '') +
  (q.green_flag_answer    ? `<strong>Strong:</strong> ${esc(q.green_flag_answer)}<br>` : '') +
  (q.red_flag_answer      ? `<strong>Weak:</strong> ${esc(q.red_flag_answer)}<br>` : '') +
  (q.follow_up            ? `<strong>Follow-up:</strong> ${esc(q.follow_up)}` : '')); }

function behavioral() { return iqTab('Behavioural Questions', 'STAR-format questions to surface leadership and growth signals', Q().behavioral_questions || [], q =>
  (q.star_guidance      ? `<strong>STAR guidance:</strong> ${esc(q.star_guidance)}<br>` : '') +
  (q.what_to_listen_for ? `<strong>Listen for:</strong> ${esc(q.what_to_listen_for)}<br>` : '') +
  (q.what_to_avoid      ? `<strong>Red flag:</strong> ${esc(q.what_to_avoid)}` : '')); }

function situational() { return iqTab('Situational Questions', 'Hypothetical scenarios testing judgment and decision-making', Q().situational_questions || [], q =>
  (q.ideal_approach ? `<strong>Ideal approach:</strong> ${esc(q.ideal_approach)}<br>` : '') +
  (q.what_to_avoid  ? `<strong>Avoid:</strong> ${esc(q.what_to_avoid)}<br>` : '') +
  (q.follow_up      ? `<strong>Follow-up:</strong> ${esc(q.follow_up)}` : '')); }

function deepdive() {
  const qs = Q().deep_dive_questions || [], cf = Q().culture_fit_questions || [];
  const ddHtml = iqTab('Deep Dive Questions', 'Probing questions to verify depth behind claimed expertise', qs, q =>
    (q.intent          ? `<strong>Intent:</strong> ${esc(q.intent)}<br>` : '') +
    (q.expected_depth  ? `<strong>Depth expected:</strong> ${esc(q.expected_depth)}` : ''));
  const cfHtml = cf.length ? `
    <div class="section-h" style="margin-top:28px;font-size:1.2rem">Culture Fit Questions</div>
    <div class="qa-list">${cf.map((q, i) =>
      qa(i + 1, esc(q.question || ''), 'Medium',
        (q.what_to_listen_for ? `<strong>Listen for:</strong> ${esc(q.what_to_listen_for)}<br>` : '') +
        ((q.alignment_signals || []).length ? `<strong>Signals:</strong> ${q.alignment_signals.map(s => esc(s)).join(', ')}` : '')
      )
    ).join('')}</div>` : '';
  return ddHtml + cfHtml;
}

function iqTab(title, sub, qs, detailFn) {
  return `<div class="section-h">${title}</div>
  <div class="section-sub">${sub}</div>
  ${qs.length
    ? `<div class="qa-list">${qs.map((q, i) => qa(i + 1, esc(q.question || ''), q.difficulty || 'Medium', detailFn(q))).join('')}</div>`
    : '<p class="nodata">No questions generated.</p>'}`;
}

/* ── BIAS AUDIT ──────────────────────────────────── */
function bias() {
  const bi = BI(), pii = bi.pii_detected || {}, vec = bi.potential_bias_vectors || [];
  if (!Object.keys(bi).length) return `<div class="section-h">Ethical Bias Audit</div><p class="nodata">Bias report not available.</p>`;
  return `<div class="section-h">Ethical Bias Audit</div>
  <div class="section-sub">Fairness, PII detection and demographic signal analysis for equitable hiring</div>
  <div class="two-col">
    <div class="card">
      <div class="card-title">Fairness Score</div>
      ${biasMeter([['Overall Fairness', n(bi.fairness_score)]])}
      <p style="margin-top:12px;font-size:.78rem;color:var(--text-2);line-height:1.65">${esc(bi.blind_review_recommendation || '')}</p>
    </div>
    <div class="card">
      <div class="card-title">PII Signals Detected</div>
      <div class="item-list">${Object.entries(pii).map(([k, v]) =>
        li(v ? 'amber' : 'green', v ? '⚠' : '✓',
          k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          v ? 'Detected' : 'Clear')
      ).join('')}</div>
    </div>
  </div>
  ${vec.length ? `
    <div class="card">
      <div class="card-title">Bias Vectors</div>
      ${vec.map(v => `
        <div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--edge)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-weight:600;font-size:.82rem">${esc(v.vector || '')}</span>
            <span class="item-badge badge-${v.risk_level === 'High' ? 'red' : v.risk_level === 'Medium' ? 'amber' : 'green'}">${esc(v.risk_level || '')}</span>
          </div>
          <p style="font-size:.78rem;color:var(--text-2);line-height:1.65">${esc(v.explanation || '')}</p>
          ${v.mitigation ? `<p style="font-size:.74rem;color:var(--text-3);margin-top:4px"><em>Mitigation: ${esc(v.mitigation)}</em></p>` : ''}
        </div>`).join('')}
    </div>` : ''}
  ${bi.evaluation_guidance ? `
    <div class="card" style="border-left:3px solid var(--violet)">
      <div class="card-title" style="color:var(--violet)">Evaluation Guidance</div>
      <p style="font-size:.8rem;color:var(--text-2);line-height:1.72">${esc(bi.evaluation_guidance)}</p>
    </div>` : ''}`;
}

/* ── COACHING ────────────────────────────────────── */
function coaching() {
  const co = CO(), roadmap = co.improvement_roadmap || [], wins = co.quick_wins || [],
        qc = co.quantification_coaching || {}, courses = co.skill_gap_courses || [];
  if (!Object.keys(co).length) return `<div class="section-h">Coaching Report</div><p class="nodata">Coaching report not available.</p>`;
  return `<div class="section-h">Candidate Coaching Report</div>
  <div class="section-sub">Personalised resume and career development recommendations</div>
  ${co.overall_assessment ? `
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">Overall Assessment</div>
      <p style="font-size:.82rem;color:var(--text-2);line-height:1.72">${esc(co.overall_assessment)}</p>
    </div>` : ''}
  ${wins.length ? `
    <div class="card" style="margin-bottom:14px;border-left:3px solid var(--blue)">
      <div class="card-title" style="color:var(--blue)">Quick Wins — Next 7 Days</div>
      <div class="item-list">${wins.map((w, i) => li('blue', i + 1, esc(w))).join('')}</div>
    </div>` : ''}
  ${roadmap.length ? `
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">Improvement Roadmap</div>
      <div class="item-list">${roadmap.map(r =>
        li('violet', '→', `<strong>${esc(r.area || '')}</strong> — ${esc(r.specific_action || '')}`, r.timeline || '')
      ).join('')}</div>
    </div>` : ''}
  ${(qc.bullet_rewrites || []).length ? `
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">Bullet Rewrites</div>
      ${(qc.bullet_rewrites || []).map(b => `
        <div style="margin-bottom:12px">
          <div style="background:var(--crimson-dim);border-radius:8px;padding:10px 12px;font-size:.78rem;color:var(--crimson);margin-bottom:6px">✗ ${esc(b.original || '')}</div>
          <div style="background:var(--emerald-dim);border-radius:8px;padding:10px 12px;font-size:.78rem;color:var(--emerald)">✓ ${esc(b.improved || '')}</div>
        </div>`).join('')}
    </div>` : ''}
  ${courses.length ? `
    <div class="card">
      <div class="card-title">Recommended Courses</div>
      <div class="item-list">${courses.map(c =>
        li('blue', '📚', `<strong>${esc(c.skill || '')}</strong> — ${esc(c.recommended_course || '')} · ${esc(c.platform || '')} · ${esc(c.estimated_time || '')}`)
      ).join('')}</div>
    </div>` : ''}
  ${co.career_advice ? `
    <div class="card" style="border-left:3px solid var(--emerald)">
      <div class="card-title" style="color:var(--emerald)">Career Advice</div>
      <p style="font-size:.82rem;color:var(--text-2);font-style:italic;line-height:1.72">${esc(co.career_advice)}</p>
    </div>` : ''}`;
}

/* ── OUTREACH ────────────────────────────────────── */
function outreach() {
  const a = A(), name = a.candidate_name || 'the candidate', fn = name.split(' ')[0],
        role = a.current_role || 'this role', str = (a.top_strengths || [])[0];
  const msgs = [
    {
      type: 'LinkedIn InMail', tc: 'var(--blue)',
      body: `Hi ${fn},\n\nI came across your background as ${role} and was genuinely impressed.${str ? ' Particularly your ' + (str.strength || '') + '.' : ''}\n\nI think there could be a compelling fit with a role we're hiring for — I'd love to share details.\n\nWould you be open to a quick 20-minute conversation this week?\n\nBest,\n[Your Name]`
    },
    {
      type: 'Cold Email', tc: 'var(--violet)',
      body: `Subject: ${role} opportunity at [Company] — your profile stood out\n\nHi ${fn},\n\nYour work as ${role}${str ? ', particularly your ' + (str.strength || '') : ''}, is directly relevant to what we're building.\n\nWe have a ${role} opening that could be a strong mutual fit.\n\nHappy to share full details — are you open to a brief conversation?\n\nBest,\n[Your Name]`
    },
    {
      type: 'WhatsApp / SMS', tc: 'var(--emerald)',
      body: `Hi ${fn}, this is [Name] from [Company]. Your ${role} background looks like a great match for a senior role we're hiring for. Would love to connect — is this a good number?`
    },
  ];
  return `<div class="section-h">Recruiter Outreach Templates</div>
  <div class="section-sub">AI-crafted personalised messages for candidate engagement</div>
  ${msgs.map(m => `
    <div class="card" style="margin-bottom:14px;border-left:3px solid ${m.tc}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-weight:700;font-size:.85rem;color:${m.tc}">${m.type}</div>
        <button class="copy-btn-sm" onclick="copyText(this,\`${m.body.replace(/`/g,'\\`')}\`)">Copy</button>
      </div>
      <div class="mono-block">${esc(m.body)}</div>
    </div>`).join('')}`;
}

/* ── AGENT ───────────────────────────────────────── */
function agent() {
  const a = A();
  return `<div class="section-h">Recruitment Agent</div>
  <div class="section-sub">AI-powered recruiter intelligence — ask anything about this candidate</div>
  <div class="agent-wrap" id="agent-wrap">
    <div class="agent-header">
      <div class="agent-avatar">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path d="M10 2L17.5 6.25V13.75L10 18L2.5 13.75V6.25L10 2Z" stroke="currentColor" stroke-width="1.5"/>
          <path d="M10 6L14 8.5V13L10 15.5L6 13V8.5L10 6Z" fill="currentColor"/>
        </svg>
      </div>
      <div>
        <div class="agent-title">TalentIQ Agent</div>
        <div class="agent-sub">Llama 3.3 · 70B · Full candidate context loaded</div>
      </div>
      <div class="agent-status"><span class="item-badge badge-teal" style="font-size:.62rem">● ACTIVE</span></div>
    </div>
    <div class="chat-messages" id="agent-messages"></div>
    <div class="quick-qs">
      <span>Quick:</span>
      ${['Summarize top hiring risks','Draft rejection email','Write offer letter','Suggest salary range','Rate culture fit','Gaps to probe?','Key strengths','Competitive assessment'].map(q =>
        `<button class="quick-q-btn" onclick="askQuick(\`${q}\`)">${q}</button>`
      ).join('')}
    </div>
    <div class="chat-input-row">
      <input class="chat-input" id="agent-input" type="text"
        placeholder="Ask about ${esc(a.candidate_name || 'this candidate')}…"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendAgentMessage();}">
      <button class="chat-send" id="agent-send" onclick="sendAgentMessage()">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <path d="M14 2L7.5 8.5M14 2l-4.5 12-2-5.5L2 6.5 14 2z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </div>`;
}

function initAgent() {
  const msgs = document.getElementById('agent-messages');
  if (!msgs) return;
  msgs.innerHTML = '';
  if (agentHistory.length === 0) {
    addAgentMsg('ai', `Hello! I'm the **TalentIQ Recruitment Agent**. I have full context on **${esc(A().candidate_name || 'this candidate')}** — their skills, experience, gaps, interview questions, and bias analysis.\n\nWhat would you like to know?`);
  } else {
    agentHistory.forEach(m => addAgentMsg(m.role, m.content, false));
  }
}

function askQuick(q) { const inp = document.getElementById('agent-input'); if (inp) inp.value = q; sendAgentMessage(); }

async function sendAgentMessage() {
  const input = document.getElementById('agent-input');
  const sendBtn = document.getElementById('agent-send');
  const msg = input.value.trim();
  if (!msg || sendBtn.disabled) return;
  input.value = '';
  sendBtn.disabled = true;

  addAgentMsg('user', msg);
  agentHistory.push({ role: 'user', content: msg });
  const typingId = addAgentMsg('ai', '<span class="typing-dot"><span></span><span></span><span></span></span>');

  try {
    const res = await fetch(`${API}/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, candidate_context: reportData }),
    });
    const bubble = document.getElementById(typingId);
    if (res.ok) {
      const data  = await res.json();
      const reply = data.response || data.message || 'Analysis complete.';
      if (bubble) bubble.innerHTML = mdToHtml(reply);
      agentHistory.push({ role: 'ai', content: reply });
    } else {
      const fallback = localAnswer(msg);
      if (bubble) bubble.innerHTML = mdToHtml(fallback);
      agentHistory.push({ role: 'ai', content: fallback });
    }
  } catch(_) {
    const fallback = localAnswer(msg);
    const bubble   = document.getElementById(typingId);
    if (bubble) bubble.innerHTML = mdToHtml(fallback);
    agentHistory.push({ role: 'ai', content: fallback });
  }

  sendBtn.disabled = false;
  const msgs = document.getElementById('agent-messages');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

function addAgentMsg(role, content) {
  const msgs = document.getElementById('agent-messages');
  if (!msgs) return null;
  const id  = 'msg-' + Date.now() + Math.random().toString(36).slice(2, 6);
  const div = document.createElement('div');
  div.className = `chat-msg chat-msg--${role}`;
  div.innerHTML = `
    <div class="msg-avatar msg-avatar--${role}">${role === 'ai'
      ? '<svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M10 2L17.5 6.25V13.75L10 18L2.5 13.75V6.25L10 2Z" stroke="currentColor" stroke-width="1.5"/></svg>'
      : 'You'
    }</div>
    <div class="msg-bubble" id="${id}">${role === 'ai' ? mdToHtml(content) : esc(content)}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return id;
}

function mdToHtml(t) {
  return esc(t)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, `<code style="font-family:var(--font-mono);font-size:.85em;background:var(--paper-3);padding:1px 5px;border-radius:4px">$1</code>`)
    .replace(/\n/g, '<br>');
}

function localAnswer(msg) {
  const a = A(), name = a.candidate_name || 'This candidate';
  if (/risk|flag|concern/i.test(msg)) {
    const f = (a.red_flags || []).slice(0, 3).map(x => `• ${x.flag || x}`).join('\n');
    const g = (a.potential_gaps || []).slice(0, 3).map(x => `• ${x.gap || x}`).join('\n');
    return `**Top hiring risks for ${name}:**\n\n${f || 'No explicit red flags found.'}\n\n**Key gaps:**\n${g || 'No major gaps identified.'}`;
  }
  if (/offer.*letter|write.*offer/i.test(msg)) return `**Offer letter draft:**\n\nDear ${name.split(' ')[0]},\n\nWe are delighted to offer you the position of ${a.current_role || '[Role]'} at [Company].\n\n**Offer Details:**\n• Role: ${a.current_role || '[Role]'}\n• Start Date: [Date]\n• Compensation: [Salary] + [Benefits]\n• Reporting to: [Manager]\n\nThis offer is contingent upon successful background verification. Please sign and return by [Date].\n\nWelcome to the team!\n\n[Your Name]`;
  if (/reject|decline/i.test(msg)) return `**Rejection email:**\n\nDear ${name.split(' ')[0]},\n\nThank you for your time interviewing for the ${a.current_role || 'position'}. After careful consideration, we've decided to move forward with another candidate.\n\nWe were impressed by your ${(a.top_strengths || [{}])[0]?.strength || 'background'} and encourage you to apply for future openings.\n\nBest wishes,\n[Your Name]`;
  if (/offer|salary|comp/i.test(msg)) return `Based on ${a.years_of_experience || 'N/A'} yrs as ${a.current_role || 'this role'} (ATS: ${a.overall_score || 'N/A'}/100):\n\n**Recommendation:** Research current market rates for this role and geography. Consider their impact score (${(A().quantified_impact || {}).score || 'N/A'}/100) in negotiation.`;
  if (/strength/i.test(msg)) return `**Key strengths for ${name}:**\n\n${(a.top_strengths || []).slice(0, 4).map(s => `• **${s.strength || s}**${s.evidence ? ' — ' + s.evidence : ''}`).join('\n') || 'No strengths data.'}`;
  if (/culture|fit|team/i.test(msg)) {
    const cf = Q().culture_fit_questions || [];
    return cf.length
      ? `**Culture fit questions for ${name}:**\n\n${cf.slice(0, 3).map((q, i) => `${i + 1}. ${q.question}`).join('\n\n')}`
      : `${name}'s trajectory suggests ${esc(a.career_trajectory || 'progressive growth')}.`;
  }
  return `Snapshot of **${name}**:\n\n• **Score:** ${a.overall_score || 0}/100\n• **Recommendation:** ${a.hire_recommendation || 'Pending'}\n• **Experience:** ${a.years_of_experience || 'N/A'} yrs as ${a.current_role || 'N/A'}\n• **Top strength:** ${(a.top_strengths || [{}])[0]?.strength || 'N/A'}\n• **JD Match:** ${a.jd_match_score != null ? a.jd_match_score + '%' : 'No JD provided'}\n\nAsk me anything about their background, risks, culture fit, or next steps.`;
}

/* ── SCORECARD ───────────────────────────────────── */
function scorecard() {
  const a = A();
  const dims = ['Technical Depth','Communication Clarity','Leadership Signals','Problem Solving','Culture Alignment','Growth Mindset','Domain Expertise','Quantified Impact'];
  return `<div class="section-h">Evaluation Scorecard</div>
  <div class="section-sub">Structured candidate assessment for hiring committee review</div>
  <div class="scorecard" id="scorecard-form">
    <div class="sc-header">
      <div>
        <div style="font-weight:700;font-family:var(--font-display);font-size:1.1rem;letter-spacing:-.02em">${esc(a.candidate_name || 'Candidate')}</div>
        <div style="font-size:.75rem;color:var(--text-2)">${esc(a.current_role || '—')}</div>
      </div>
      <button class="btn-secondary" onclick="exportScorecard()">↓ Export</button>
    </div>
    ${dims.map((dim, di) => `
      <div class="sc-row">
        <div class="sc-label">${dim}</div>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="sc-dots" id="sc-dim-${di}">
            ${[1,2,3,4,5].map(v => `<div class="sc-dot" onclick="setScore(${di},${v})" title="${v}/5"></div>`).join('')}
          </div>
          <span style="font-size:.7rem;color:var(--text-3);font-family:var(--font-mono);width:30px" id="sc-val-${di}">—</span>
        </div>
      </div>`).join('')}
    <div class="sc-row" style="flex-direction:column;align-items:stretch;gap:8px">
      <div class="sc-label">Notes</div>
      <textarea class="field-ta" id="sc-notes" rows="3" placeholder="Overall impression, observations…" style="resize:none"></textarea>
    </div>
    <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn-secondary" style="color:var(--emerald);border-color:rgba(16,185,129,.3);background:var(--emerald-dim)" onclick="setDecision('hire')">✓ Advance</button>
      <button class="btn-secondary" style="color:var(--amber);border-color:rgba(245,158,11,.3);background:var(--amber-dim)" onclick="setDecision('maybe')">~ Maybe</button>
      <button class="btn-secondary" style="color:var(--crimson);border-color:rgba(239,68,68,.3);background:var(--crimson-dim)" onclick="setDecision('reject')">✗ Decline</button>
    </div>
    <div id="sc-decision-msg" style="margin-top:10px;font-size:.82rem;font-weight:600"></div>
  </div>`;
}

function initScorecard() { window._scVals = {}; }

function setScore(dim, val) {
  if (!window._scVals) window._scVals = {};
  window._scVals[dim] = val;
  document.querySelectorAll(`#sc-dim-${dim} .sc-dot`).forEach((d, i) => {
    d.className = 'sc-dot' + (i < val ? ` filled filled-${i + 1}` : '');
  });
  document.getElementById(`sc-val-${dim}`).textContent = val + '/5';
}

function setDecision(d) {
  const msgs   = { hire: '✓ Advanced to next round', maybe: '~ Added to maybe list', reject: '✗ Candidate declined' };
  const colors = { hire: 'var(--emerald)', maybe: 'var(--amber)', reject: 'var(--crimson)' };
  const el = document.getElementById('sc-decision-msg');
  if (el) { el.textContent = msgs[d]; el.style.color = colors[d]; }
  showToast(msgs[d], d === 'hire' ? 'success' : '');
}

function exportScorecard() { showToast('Printing…', ''); setTimeout(() => window.print(), 300); }

/* ── PIPELINE ────────────────────────────────────── */
function pipeline() {
  const a = A();
  const stgs = ['Applied','Screened','Interview','Final Round','Offer','Hired'];
  return `<div class="section-h">Talent Pipeline</div>
  <div class="section-sub">Candidate pipeline management and recruitment workflow tracking</div>
  <div class="card" style="margin-bottom:14px">
    <div class="card-title">Pipeline Position</div>
    <div class="pipeline-track">
      ${stgs.map((s, i) => `
        <div class="pipeline-stage ${i < 2 ? 'done' : i === 2 ? 'current' : ''}">
          <div class="ps-label">${s}</div>
          <div class="ps-indicator">${i < 2 ? '✓' : i === 2 ? '● Now' : ''}</div>
        </div>`).join('')}
    </div>
  </div>
  <div class="two-col">
    <div class="card">
      <div class="card-title">Candidate Summary</div>
      <div class="item-list">
        ${li('green',  '✓', 'ATS Score: <strong>' + n(a.overall_score) + '/100</strong>')}
        ${li('blue',   '→', 'Recommendation: <strong>' + esc(a.hire_recommendation || 'Pending') + '</strong>')}
        ${li('violet', '→', 'Experience: <strong>' + esc(String(a.years_of_experience || 'N/A')) + ' years</strong>')}
        ${li('amber',  '→', 'Level: <strong>' + esc(a.experience_level || '—') + '</strong>')}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Recommended Next Actions</div>
      <div class="item-list">
        ${li('cyan', '1', 'Schedule technical interview')}
        ${li('cyan', '2', 'Send skills assessment')}
        ${li('cyan', '3', 'Reference check (2 referees)')}
        ${li('cyan', '4', 'Compensation discussion')}
      </div>
    </div>
  </div>`;
}

/* ── HIRE DECISION ───────────────────────────────── */
function decision() {
  const a   = A();
  const rec = a.hire_recommendation || '—';
  const isH = /hire/i.test(rec) && !/not|pass|no/i.test(rec);
  return `<div class="section-h">AI Hire Decision</div>
  <div class="section-sub">Structured recommendation with confidence scoring and risk assessment</div>
  <div class="card" style="margin-bottom:14px;border-left:4px solid ${isH ? 'var(--emerald)' : 'var(--crimson)'};background:${isH ? 'var(--emerald-dim)' : 'var(--crimson-dim)'}">
    <div style="font-family:var(--font-display);font-size:2.6rem;font-weight:800;color:${isH ? 'var(--emerald)' : 'var(--crimson)'};letter-spacing:-.04em;line-height:1">${esc(rec)}</div>
    ${a.hire_rationale ? `<p style="margin-top:12px;font-size:.85rem;color:var(--text-2);line-height:1.72">${esc(a.hire_rationale)}</p>` : ''}
  </div>
  <div class="two-col">
    <div class="card">
      <div class="card-title" style="color:var(--emerald)">Factors — For</div>
      <div class="item-list">${(a.top_strengths || []).slice(0, 4).map(s =>
        li('green', '✓', esc(s.strength || String(s)))
      ).join('') || noData()}</div>
    </div>
    <div class="card">
      <div class="card-title" style="color:var(--crimson)">Factors — Against</div>
      <div class="item-list">${(a.potential_gaps || []).slice(0, 4).map(g =>
        li(g.severity === 'Critical' ? 'red' : 'amber', g.severity === 'Critical' ? '✗' : '~', esc(g.gap || String(g)))
      ).join('') || '<p style="color:var(--emerald);font-size:.8rem">No significant gaps.</p>'}</div>
    </div>
  </div>
  <div class="card">
    <div class="card-title">Key Decision Metrics</div>
    <div style="display:flex;gap:36px;flex-wrap:wrap;align-items:flex-end;padding-top:4px">
      <div>
        <div style="font-size:2.8rem;font-weight:800;font-family:var(--font-display);color:${scoreColor(n(a.overall_score))};line-height:1;letter-spacing:-.04em">${n(a.overall_score)}</div>
        <div style="font-size:.67rem;color:var(--text-3);font-family:var(--font-mono);margin-top:3px">ATS SCORE</div>
      </div>
      ${a.jd_match_score != null ? `<div>
        <div style="font-size:2.8rem;font-weight:800;font-family:var(--font-display);color:var(--blue);line-height:1;letter-spacing:-.04em">${a.jd_match_score}%</div>
        <div style="font-size:.67rem;color:var(--text-3);font-family:var(--font-mono);margin-top:3px">JD MATCH</div>
      </div>` : ''}
      <div>
        <div style="font-size:2.8rem;font-weight:800;font-family:var(--font-display);color:var(--emerald);line-height:1;letter-spacing:-.04em">${n((A().quantified_impact || {}).score)}</div>
        <div style="font-size:.67rem;color:var(--text-3);font-family:var(--font-mono);margin-top:3px">IMPACT SCORE</div>
      </div>
      ${a.years_of_experience != null ? `<div>
        <div style="font-size:2.8rem;font-weight:800;font-family:var(--font-display);color:var(--amber);line-height:1;letter-spacing:-.04em">${a.years_of_experience}</div>
        <div style="font-size:.67rem;color:var(--text-3);font-family:var(--font-mono);margin-top:3px">YEARS EXP</div>
      </div>` : ''}
    </div>
  </div>`;
}

/* ── COMPONENT HELPERS ───────────────────────────── */
function ax(name, score, color) {
  const s = Math.min(Math.max(Number(score) || 0, 0), 100);
  return `<div class="axis-card">
    <div class="axis-top">
      <span class="axis-name">${name}</span>
      <span class="axis-score" style="color:${color}">${s}</span>
    </div>
    <div class="axis-bar"><div class="axis-fill" style="background:${color}" data-w="${s}"></div></div>
  </div>`;
}

function li(color, bullet, text, badge = '') {
  return `<div class="item-row">
    <div class="item-bullet ${color}">${bullet}</div>
    <div class="item-text">${text}</div>
    ${badge ? `<span class="item-badge badge-${color}">${esc(String(badge))}</span>` : ''}
  </div>`;
}

function tl(title, company, date, desc, compact = false) {
  return `<div class="tl-item">
    <div class="tl-left">
      <div class="tl-dot"></div>
      ${!compact ? '<div class="tl-line"></div>' : ''}
    </div>
    <div style="flex:1">
      <div class="tl-title">${title}</div>
      ${company ? `<div class="tl-company">${company}</div>` : ''}
      ${date    ? `<div class="tl-date">${date}</div>` : ''}
      ${desc    ? `<div class="tl-desc">${desc}</div>` : ''}
    </div>
  </div>`;
}

function qa(num, question, difficulty, detail = '') {
  const cls = { Hard: 'difficulty-hard', Medium: 'difficulty-medium', Easy: 'difficulty-easy' }[difficulty] || 'difficulty-medium';
  return `<div class="qa-item">
    <div class="qa-q">
      <span class="qa-num">Q${num}</span>
      <span class="qa-text">${question}</span>
      <span class="qa-difficulty ${cls}">${difficulty}</span>
      <svg class="qa-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="qa-a">${detail || 'Look for specificity — exact numbers, trade-offs made, and lessons learned.'}</div>
  </div>`;
}

function biasMeter(rows) {
  return `<div class="bias-meter">${rows.map(([l, s]) => {
    const c = s >= 80 ? 'var(--emerald)' : s >= 60 ? 'var(--amber)' : 'var(--crimson)';
    return `<div class="bias-row">
      <div class="bias-label">${l}</div>
      <div class="bias-track"><div class="bias-fill" style="background:${c}" data-w="${s}"></div></div>
      <div class="bias-score">${s}%</div>
    </div>`;
  }).join('')}</div>`;
}

function copyText(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const o = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = o; }, 1500);
  });
}

/* ── TOAST ───────────────────────────────────────── */
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), type === 'error' ? 5000 : 2800);
}
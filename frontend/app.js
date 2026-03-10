/* ═══════════════════════════════════════════
   TALENTIQ v5.0 — app.js  (REAL API VERSION)
   All demo data removed. Connects to FastAPI backend.
═══════════════════════════════════════════ */

'use strict';

const API = 'https://resume-analyzer-6wj1.onrender.com';

// ── State ─────────────────────────────────
let currentTab = 'overview';
let resumeFile = null;
let reportData = null;   // real API response stored here

// ── Theme ─────────────────────────────────
function toggleTheme() {
  const html = document.documentElement;
  html.dataset.theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('tiq-theme', html.dataset.theme);
}
(function initTheme() {
  const saved = localStorage.getItem('tiq-theme') || 'dark';
  document.documentElement.dataset.theme = saved;
})();

// ── File handling ─────────────────────────
document.getElementById('resume-file').addEventListener('change', function () {
  if (this.files[0]) setFile(this.files[0]);
});

const dropzone = document.getElementById('dropzone');
dropzone.addEventListener('dragover',  e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
dropzone.addEventListener('dragleave', ()  => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop',      e  => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f) setFile(f);
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

// ── Analysis flow ─────────────────────────
async function startAnalysis() {
  if (!resumeFile) {
    showToast('Please upload a resume PDF first', 'error');
    return;
  }

  showScreen('loading');
  const stages = document.querySelectorAll('#loading-stages .stage');
  stages.forEach(s => s.classList.remove('active', 'done'));

  let stageIdx = 0;
  function advanceStage() {
    if (stageIdx > 0 && stages[stageIdx - 1]) {
      stages[stageIdx - 1].classList.remove('active');
      stages[stageIdx - 1].classList.add('done');
    }
    if (stageIdx < stages.length) {
      stages[stageIdx].classList.add('active');
      stageIdx++;
    }
  }
  advanceStage();
  const stageTimer = setInterval(() => {
    if (stageIdx < stages.length) advanceStage();
    else clearInterval(stageTimer);
  }, 8000);

  try {
    // Step 1: Wake up Render server (cold-start fix)
    const loadingTitle = document.querySelector('#screen-loading .loading-title');
    const loadingSub   = document.querySelector('#screen-loading .loading-sub');
    if (loadingTitle) loadingTitle.textContent = 'Connecting to server\u2026';
    if (loadingSub)   loadingSub.textContent   = 'Server may take up to 60s on first request';

    await wakeUpServer();

    if (loadingTitle) loadingTitle.textContent = 'Analyzing Candidate\u2026';
    if (loadingSub)   loadingSub.textContent   = 'Deep intelligence engine running';

    // Step 2: Send real resume to backend
    const fd = new FormData();
    fd.append('file', resumeFile);
    const jd = document.getElementById('jd-input').value.trim();
    if (jd) fd.append('job_description', jd);

    const res = await fetch(`${API}/analyze`, { method: 'POST', body: fd });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server error ${res.status}`);
    }

    reportData = await res.json();

    // Step 3: Mark all stages done and show results
    clearInterval(stageTimer);
    stages.forEach(s => { s.classList.remove('active'); s.classList.add('done'); });
    await sleep(400);

    // Populate sidebar
    const a = reportData.analysis || {};
    document.getElementById('sb-name').textContent = a.candidate_name || '\u2014';
    document.getElementById('results-timestamp').textContent =
      'Generated ' + new Date().toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });

    // Hire badge
    const badge = document.getElementById('hire-badge');
    const rec   = (a.hire_recommendation || '').trim();
    badge.innerHTML =
      `<svg width="8" height="8" viewBox="0 0 8 8" fill="none"><circle cx="4" cy="4" r="3" fill="currentColor"/></svg> ${esc(rec || 'Pending')}`;
    badge.className = 'hire-badge ' + (
      /strongly.*hire|strong.*hire/i.test(rec) ? 'strong-yes' :
      /caution/i.test(rec)                     ? 'maybe'      :
      /not|pass|no/i.test(rec)                 ? 'no'         : 'yes'
    );

    showScreen('results');
    switchTab('overview');

  } catch (err) {
    clearInterval(stageTimer);
    showScreen('upload');
    const msg = (!err.message || err.message === 'Failed to fetch')
      ? 'Could not reach server. Check your internet and try again.'
      : err.message;
    showToast(msg, 'error');
  }
}

// ── Wake Render server before real request ──
async function wakeUpServer(maxMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 8000);
      const r    = await fetch(`${API}/health`, { signal: ctrl.signal });
      clearTimeout(tid);
      if (r.ok || r.status === 404) return;
    } catch (_) { /* not ready yet */ }
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
  reportData = null;
  document.getElementById('jd-input').value   = '';
  document.getElementById('role-input').value = '';
  showScreen('upload');
}

// ── Tab navigation ────────────────────────
document.getElementById('sb-nav').addEventListener('click', e => {
  const btn = e.target.closest('.nav-btn[data-tab]');
  if (btn) switchTab(btn.dataset.tab);
});

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('#sb-nav .nav-btn').forEach(b => b.classList.remove('active'));
  const active = document.querySelector(`#sb-nav .nav-btn[data-tab="${tab}"]`);
  if (active) active.classList.add('active');
  renderTab(tab);
  document.querySelector('.results-main').scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Tab renderer ──────────────────────────
function renderTab(tab) {
  const el = document.getElementById('tab-content');
  el.innerHTML = '';
  el.classList.remove('anim-up');
  void el.offsetWidth;
  el.classList.add('anim-up');

  const renderers = {
    overview, skills, experience, analysis, impact,
    realvsbuzz, jdmatch, redflags, technical, behavioral,
    situational, deepdive, bias, coaching, outreach,
    pipeline, jobgen, decision,
  };

  el.innerHTML = renderers[tab]
    ? renderers[tab]()
    : `<p style="color:var(--text-2)">Content for <strong>${tab}</strong> coming soon.</p>`;

  setTimeout(() => {
    el.querySelectorAll('.score-ring-fill').forEach(fill => {
      const pct = parseFloat(fill.dataset.pct) || 0;
      fill.style.strokeDashoffset = 340 - (340 * pct / 100);
    });
    el.querySelectorAll('[data-w]').forEach(bar => {
      bar.style.width = bar.dataset.w + '%';
    });
  }, 60);

  el.querySelectorAll('.qa-q').forEach(q => {
    q.addEventListener('click', () => q.closest('.qa-item').classList.toggle('open'));
  });
}

// ── Safe data getters ─────────────────────
function A()  { return reportData && reportData.analysis            || {}; }
function Q()  { return reportData && reportData.interview_questions || {}; }
function BI() { return reportData && reportData.bias_report         || {}; }
function CO() { return reportData && reportData.candidate_feedback  || {}; }

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ══════════════════════════════════════════
   TAB: OVERVIEW
══════════════════════════════════════════ */
function overview() {
  const a  = A();
  const sc = a.overall_score  || 0;
  const jd = a.jd_match_score != null ? a.jd_match_score : null;
  const at = a.ats_scores     || {};
  const qi = a.quantified_impact || {};
  const cl = a.candidate_classification || {};

  return `
    <div class="section-h">Intelligence Dashboard</div>
    <div class="section-sub">Overall candidate fitness across all evaluation dimensions</div>

    <div class="score-ring-wrap">
      <div class="score-ring-inner">
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
        <p>${esc(a.professional_summary || a.hire_rationale || 'Analysis complete.')}</p>
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
          ${a.hire_recommendation ? `<span class="item-badge badge-teal">${esc(a.hire_recommendation)}</span>` : ''}
          ${a.years_of_experience != null ? `<span class="item-badge badge-blue">${a.years_of_experience} yrs exp</span>` : ''}
          ${a.experience_level ? `<span class="item-badge badge-violet">${esc(a.experience_level)}</span>` : ''}
        </div>
      </div>
    </div>

    <div class="axis-grid">
      ${axisCard('Keyword Density',    at.keyword_density    || 0, 'var(--blue)')}
      ${axisCard('Experience Depth',   at.experience_depth   || 0, 'var(--accent)')}
      ${axisCard('Achievement Impact', at.achievement_impact || 0, 'var(--green)')}
      ${axisCard('Skills Coverage',    at.skills_coverage    || 0, 'var(--violet)')}
      ${axisCard('Format Quality',     at.format_quality     || 0, 'var(--amber)')}
      ${axisCard('Career Progression', at.career_progression || 0, 'var(--pink)')}
    </div>

    <div class="stat-stripe">
      <div class="stat-card">
        <div class="stat-label">JD Match</div>
        <div class="stat-val" style="color:var(--accent)">${jd != null ? jd + '%' : 'N/A'}</div>
        <div class="stat-sub">${jd != null ? (jd >= 60 ? '\u2191 strong match' : jd >= 40 ? 'moderate' : '\u2193 weak match') : 'No JD provided'}</div>
        <div class="stat-bar"><div class="stat-bar-fill" style="background:var(--accent)" data-w="${jd || 0}"></div></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Impact Score</div>
        <div class="stat-val" style="color:var(--green)">${qi.score || 0}</div>
        <div class="stat-sub">${esc(qi.verdict || '\u2014')}</div>
        <div class="stat-bar"><div class="stat-bar-fill" style="background:var(--green)" data-w="${qi.score || 0}"></div></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Candidate Type</div>
        <div class="stat-val" style="color:var(--amber);font-size:.85rem">${esc(cl.type || '\u2014')}</div>
        <div class="stat-sub">${esc(cl.buzz_word_rating || '\u2014')}</div>
        <div class="stat-bar"><div class="stat-bar-fill" style="background:var(--amber)" data-w="60"></div></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Career Velocity</div>
        <div class="stat-val" style="color:var(--blue);font-size:.85rem">${esc(a.career_velocity || '\u2014')}</div>
        <div class="stat-sub">${esc((a.career_velocity_evidence || '').slice(0, 50))}</div>
        <div class="stat-bar"><div class="stat-bar-fill" style="background:var(--blue)" data-w="70"></div></div>
      </div>
    </div>

    <div class="two-col">
      <div class="card-block">
        <div class="card-block-title">Top Strengths</div>
        <div class="item-list">
          ${(a.top_strengths || []).slice(0, 3).map(s =>
            listItem('green', '\u2713', esc(s.strength || String(s)) + (s.evidence ? ' \u2014 ' + esc(s.evidence) : ''))
          ).join('') || '<p style="color:var(--text-2);font-size:.8rem">No strengths data.</p>'}
        </div>
      </div>
      <div class="card-block">
        <div class="card-block-title">Key Gaps</div>
        <div class="item-list">
          ${(a.potential_gaps || []).slice(0, 3).map(g =>
            listItem(g.severity === 'Critical' ? 'red' : 'amber',
              g.severity === 'Critical' ? '!' : '~',
              esc(g.gap || String(g)) + (g.suggestion ? ' \u2014 ' + esc(g.suggestion) : ''))
          ).join('') || '<p style="color:var(--text-2);font-size:.8rem">No gaps identified.</p>'}
        </div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════
   TAB: SKILLS
══════════════════════════════════════════ */
function skills() {
  const a  = A();
  const sk = a.technical_skills || {};
  const groups = [
    { label: 'Languages',         color: 'var(--blue)',   items: sk.languages    || [] },
    { label: 'Frameworks / Libs', color: 'var(--violet)', items: sk.frameworks   || [] },
    { label: 'AI / ML',           color: 'var(--accent)', items: sk.ai_ml        || [] },
    { label: 'Cloud & DevOps',    color: 'var(--green)',  items: sk.cloud_devops || [] },
    { label: 'Databases',         color: 'var(--amber)',  items: sk.databases    || [] },
    { label: 'Tools',             color: 'var(--pink)',   items: sk.tools        || [] },
    { label: 'Other',             color: 'var(--text-2)', items: sk.other        || [] },
    { label: 'Soft Skills',       color: 'var(--teal)',   items: a.soft_skills   || [] },
  ].filter(g => g.items.length > 0);

  if (!groups.length) return `<div class="section-h">Skills Intelligence</div><p style="color:var(--text-2)">No skills data extracted.</p>`;

  return `
    <div class="section-h">Skills Intelligence</div>
    <div class="section-sub">Extracted technical and soft skills</div>
    ${groups.map(g => `
      <div class="card-block" style="margin-bottom:14px">
        <div class="card-block-title">${g.label}</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
          ${g.items.map(item => `<span style="background:var(--surface-2);border:1px solid var(--border);border-radius:6px;padding:4px 10px;font-size:.75rem;color:${g.color};font-family:var(--font-mono)">${esc(item)}</span>`).join('')}
        </div>
      </div>`).join('')}
    ${(a.inferred_skills || []).length ? `
    <div class="card-block">
      <div class="card-block-title">Inferred Skills <span style="font-size:.7rem;color:var(--text-3);font-weight:400">\u2014 implied by experience</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
        ${(a.inferred_skills || []).map(s => `<span style="background:var(--surface-2);border:1px dashed var(--border);border-radius:6px;padding:4px 10px;font-size:.75rem;color:var(--text-2);font-family:var(--font-mono)">${esc(s)}</span>`).join('')}
      </div>
    </div>` : ''}`;
}

/* ══════════════════════════════════════════
   TAB: EXPERIENCE
══════════════════════════════════════════ */
function experience() {
  const a    = A();
  const exps = a.work_experience || [];
  const edu  = a.education       || [];
  const cert = a.certifications  || [];
  const proj = a.projects        || [];

  return `
    <div class="section-h">Work Experience</div>
    <div class="section-sub">Career timeline with AI-extracted impact signals</div>
    ${exps.length ? `
    <div class="card-block">
      <div class="timeline">
        ${exps.map(e => tlItem(
          esc(e.role || '\u2014'),
          esc(e.company || ''),
          esc(e.duration || ''),
          (e.key_achievements || []).map(a => esc(a)).join('<br>') || ''
        )).join('')}
      </div>
    </div>` : '<p style="color:var(--text-2)">No work experience extracted.</p>'}

    <div class="two-col" style="margin-top:16px">
      <div class="card-block">
        <div class="card-block-title">Education</div>
        ${edu.length ? `
        <div class="timeline">
          ${edu.map(e => tlItem(esc(e.degree || '\u2014'), esc(e.institution || ''), esc(e.year || ''), '')).join('')}
        </div>` : '<p style="color:var(--text-2);font-size:.8rem">No education data.</p>'}
      </div>
      <div class="card-block">
        <div class="card-block-title">Certifications</div>
        ${cert.length
          ? `<div class="item-list">${cert.map(c => listItem('blue', '\U0001f3c5', esc(c))).join('')}</div>`
          : '<p style="color:var(--text-2);font-size:.8rem">No certifications found.</p>'}
      </div>
    </div>

    ${proj.length ? `
    <div class="card-block" style="margin-top:16px">
      <div class="card-block-title">Notable Projects</div>
      ${proj.map(p => `
        <div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--border)">
          <div style="font-weight:600;font-size:.85rem;color:var(--text);margin-bottom:4px">${esc(p.name || '')}</div>
          <p style="font-size:.78rem;color:var(--text-2);line-height:1.6;margin-bottom:6px">${esc(p.description || '')}</p>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${(p.technologies || []).map(t => `<span style="background:var(--surface-2);border:1px solid var(--border);border-radius:4px;padding:2px 8px;font-size:.72rem;color:var(--accent);font-family:var(--font-mono)">${esc(t)}</span>`).join('')}
          </div>
        </div>`).join('')}
    </div>` : ''}`;
}

/* ══════════════════════════════════════════
   TAB: STRENGTHS & GAPS
══════════════════════════════════════════ */
function analysis() {
  const a   = A();
  const str = a.top_strengths  || [];
  const gap = a.potential_gaps || [];

  return `
    <div class="section-h">Strengths &amp; Gaps Analysis</div>
    <div class="section-sub">Evidence-based assessment of candidate fitness</div>

    <div class="card-block" style="margin-bottom:16px">
      <div class="card-block-title">Top Strengths</div>
      <div class="item-list">
        ${str.length
          ? str.map(s => listItem('green', 'S',
              `<strong>${esc(s.strength || String(s))}</strong>${s.evidence ? ' \u2014 ' + esc(s.evidence) : ''}`,
              s.rarity || '')).join('')
          : '<p style="color:var(--text-2);font-size:.8rem">No strengths data.</p>'}
      </div>
    </div>

    <div class="card-block" style="margin-bottom:16px">
      <div class="card-block-title">Potential Gaps</div>
      <div class="item-list">
        ${gap.length
          ? gap.map(g => listItem(
              g.severity === 'Critical' ? 'red' : 'amber',
              g.severity === 'Critical' ? '!' : '~',
              `<strong>${esc(g.gap || String(g))}</strong>${g.suggestion ? ' \u2014 ' + esc(g.suggestion) : ''}`,
              g.severity || '')).join('')
          : '<p style="color:var(--green);font-size:.8rem">No significant gaps identified.</p>'}
      </div>
    </div>

    ${a.career_trajectory ? `
    <div class="card-block">
      <div class="card-block-title">Career Trajectory</div>
      <p style="font-size:.82rem;color:var(--text-2);line-height:1.7;font-style:italic">${esc(a.career_trajectory)}</p>
    </div>` : ''}

    ${(a.ideal_role_fit || []).length ? `
    <div class="card-block">
      <div class="card-block-title">Ideal Role Fits</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
        ${(a.ideal_role_fit || []).map(r => `<span class="item-badge badge-teal">${esc(r)}</span>`).join('')}
      </div>
    </div>` : ''}`;
}

/* ══════════════════════════════════════════
   TAB: IMPACT SCORE
══════════════════════════════════════════ */
function impact() {
  const qi = A().quantified_impact || {};
  const sc = qi.score || 0;

  return `
    <div class="section-h">Impact Score</div>
    <div class="section-sub">How well the candidate quantifies results with hard numbers</div>

    <div class="score-ring-wrap">
      <div class="score-ring-inner">
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
        <p><strong>${esc(qi.verdict || '\u2014')}</strong> \u2014 ${qi.quantified_percentage || 0}% of bullets contain hard numbers.</p>
        ${qi.improvement_tip ? `<p style="margin-top:8px;font-size:.78rem;color:var(--text-2)">${esc(qi.improvement_tip)}</p>` : ''}
      </div>
    </div>

    <div style="display:flex;gap:32px;flex-wrap:wrap;margin:16px 0;padding:16px;background:var(--surface-2);border-radius:var(--r-md)">
      <div><div style="font-size:1.6rem;font-weight:800;color:var(--text)">${qi.total_bullets || 0}</div><div style="font-size:.75rem;color:var(--text-2)">Total bullets</div></div>
      <div><div style="font-size:1.6rem;font-weight:800;color:var(--green)">${qi.quantified_bullets || 0}</div><div style="font-size:.75rem;color:var(--text-2)">Quantified</div></div>
      <div><div style="font-size:1.6rem;font-weight:800;color:var(--accent)">${qi.quantified_percentage || 0}%</div><div style="font-size:.75rem;color:var(--text-2)">Rate</div></div>
    </div>

    <div class="two-col">
      <div class="card-block">
        <div class="card-block-title" style="color:var(--green)">Strong Quantified Bullets</div>
        <div class="item-list">
          ${(qi.strong_examples || []).map(e => listItem('green', '\u2713', esc(e))).join('') || '<p style="color:var(--text-2);font-size:.8rem">None found.</p>'}
        </div>
      </div>
      <div class="card-block">
        <div class="card-block-title" style="color:var(--danger)">Weak / Vague Bullets</div>
        <div class="item-list">
          ${(qi.weak_examples || []).map(e => listItem('red', '\u2717', esc(e))).join('') || '<p style="color:var(--green);font-size:.8rem">No weak bullets \u2014 great!</p>'}
        </div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════
   TAB: REAL vs BUZZ
══════════════════════════════════════════ */
function realvsbuzz() {
  const cl = A().candidate_classification || {};
  const borderColor = cl.type === 'Proven' ? 'var(--green)' : cl.type === 'High Potential' ? 'var(--accent)' : 'var(--danger)';

  return `
    <div class="section-h">Real vs Buzz Analysis</div>
    <div class="section-sub">Separating evidence-backed claims from empty buzzwords</div>

    <div class="card-block" style="margin-bottom:16px;border-left:3px solid ${borderColor}">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="font-size:1.5rem;font-weight:800;color:var(--text)">${esc(cl.type || '\u2014')}</div>
        <div>
          <div style="font-size:.78rem;color:var(--text-2)">Confidence: <strong>${esc(cl.confidence || '\u2014')}</strong></div>
          <div style="font-size:.78rem;color:var(--text-2)">Buzz rating: <strong>${esc(cl.buzz_word_rating || '\u2014')}</strong></div>
        </div>
      </div>
      ${cl.evidence ? `<p style="margin-top:10px;font-size:.8rem;color:var(--text-2);font-style:italic">${esc(cl.evidence)}</p>` : ''}
    </div>

    <div class="two-col">
      <div class="card-block">
        <div class="card-block-title" style="color:var(--green)">Substance Examples</div>
        <div class="item-list">
          ${(cl.substance_examples || []).map(e => listItem('green', '\u2713', esc(e))).join('') || '<p style="color:var(--text-2);font-size:.8rem">None detected.</p>'}
        </div>
      </div>
      <div class="card-block">
        <div class="card-block-title" style="color:var(--danger)">Buzz Phrases (no evidence)</div>
        <div class="item-list">
          ${(cl.buzz_examples || []).map(e => listItem('red', '\u2717', esc(e))).join('') || '<p style="color:var(--green);font-size:.8rem">No buzz phrases detected!</p>'}
        </div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════
   TAB: JD MATCH
══════════════════════════════════════════ */
function jdmatch() {
  const a  = A();
  const sc = a.jd_match_score;

  if (sc == null) return `
    <div class="section-h">JD Match</div>
    <div class="card-block" style="text-align:center;padding:40px">
      <p style="color:var(--text-2);font-size:.9rem">No job description was provided.</p>
      <p style="color:var(--text-3);font-size:.78rem;margin-top:8px">Start a new analysis and paste a JD to unlock alignment scoring.</p>
      <button onclick="resetApp()" style="margin-top:16px;padding:8px 20px;background:var(--accent);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:.8rem">New Analysis</button>
    </div>`;

  const matched = a.jd_matched_skills || [];
  const missing = a.jd_missing_skills || [];
  const partial = a.jd_partial_skills || [];

  return `
    <div class="section-h">JD Match Analysis</div>
    <div class="section-sub">How well this candidate matches the job description</div>

    <div class="score-ring-wrap">
      <div class="score-ring-inner">
        <svg class="score-ring-svg" width="120" height="120" viewBox="0 0 120 120">
          <circle class="score-ring-track" cx="60" cy="60" r="54"/>
          <circle class="score-ring-fill" cx="60" cy="60" r="54" data-pct="${sc}" stroke="var(--accent)"/>
        </svg>
        <div class="score-ring-text">
          <span class="score-ring-num" style="color:var(--accent)">${sc}</span>
          <span class="score-ring-lbl">%</span>
        </div>
      </div>
      <div class="score-ring-desc">
        <h3>JD Match Score</h3>
        <p>${esc(a.jd_match_summary || '\u2014')}</p>
      </div>
    </div>

    <div class="two-col">
      <div class="card-block">
        <div class="card-block-title" style="color:var(--green)">\u2713 Matched Skills (${matched.length})</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
          ${matched.map(s => `<span class="item-badge badge-green">${esc(s)}</span>`).join('') || '<p style="color:var(--text-2);font-size:.8rem">None</p>'}
        </div>
      </div>
      <div class="card-block">
        <div class="card-block-title" style="color:var(--danger)">\u2717 Missing Skills (${missing.length})</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
          ${missing.map(s => `<span class="item-badge badge-red">${esc(s)}</span>`).join('') || '<p style="color:var(--green);font-size:.8rem">No gaps!</p>'}
        </div>
      </div>
    </div>

    ${partial.length ? `
    <div class="card-block">
      <div class="card-block-title" style="color:var(--amber)">~ Partial Matches (${partial.length})</div>
      <p style="font-size:.75rem;color:var(--text-3);margin-bottom:8px">Present but without demonstrated depth</p>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${partial.map(s => `<span class="item-badge badge-amber">${esc(s)}</span>`).join('')}
      </div>
    </div>` : ''}`;
}

/* ══════════════════════════════════════════
   TAB: RED FLAGS
══════════════════════════════════════════ */
function redflags() {
  const flags  = A().red_flags        || [];
  const probes = Q().red_flag_probes  || [];

  return `
    <div class="section-h">Red Flags</div>
    <div class="section-sub">Resume anomalies and high-risk signals to investigate</div>

    <div class="card-block" style="margin-bottom:16px">
      <div class="card-block-title" style="color:var(--danger)">Resume Red Flags</div>
      ${flags.length
        ? `<div class="item-list">${flags.map(f => listItem('red', '\u26d1',
            `<strong>${esc(f.flag || String(f))}</strong>${f.explanation ? ' \u2014 ' + esc(f.explanation) : ''}`
          )).join('')}</div>`
        : '<p style="color:var(--green);font-size:.82rem">\u2713 No significant red flags detected.</p>'}
    </div>

    ${probes.length ? `
    <div class="card-block">
      <div class="card-block-title">Red Flag Interview Probes</div>
      <div class="qa-list">
        ${probes.map((p, i) => qa(i + 1, esc(p.question || ''), 'Hard',
          (p.concern           ? `<strong>Concern:</strong> ${esc(p.concern)}<br>` : '') +
          (p.green_flag_answer ? `<strong>Strong answer:</strong> ${esc(p.green_flag_answer)}<br>` : '') +
          (p.red_flag_answer   ? `<strong>Concerning:</strong> ${esc(p.red_flag_answer)}` : '')
        )).join('')}
      </div>
    </div>` : ''}`;
}

/* ══════════════════════════════════════════
   INTERVIEW QUESTION TABS
══════════════════════════════════════════ */
function technical() {
  const qs = Q().technical_questions || [];
  return `<div class="section-h">Technical Questions</div><div class="section-sub">Role-specific technical questions grounded in this resume</div>
    ${qs.length ? `<div class="qa-list">${qs.map((q, i) => qa(i + 1, esc(q.question || ''), q.difficulty || 'Medium',
      (q.expected_answer_hint ? `<strong>Look for:</strong> ${esc(q.expected_answer_hint)}<br>` : '') +
      (q.green_flag_answer    ? `<strong>Strong:</strong> ${esc(q.green_flag_answer)}<br>` : '') +
      (q.red_flag_answer      ? `<strong>Weak:</strong> ${esc(q.red_flag_answer)}<br>` : '') +
      (q.follow_up            ? `<strong>Follow-up:</strong> ${esc(q.follow_up)}` : '')
    )).join('')}</div>` : '<p style="color:var(--text-2)">No technical questions generated.</p>'}`;
}

function behavioral() {
  const qs = Q().behavioral_questions || [];
  return `<div class="section-h">Behavioural Questions</div><div class="section-sub">STAR-format leadership and growth signal questions</div>
    ${qs.length ? `<div class="qa-list">${qs.map((q, i) => qa(i + 1, esc(q.question || ''), q.difficulty || 'Medium',
      (q.star_guidance      ? `<strong>STAR guidance:</strong> ${esc(q.star_guidance)}<br>` : '') +
      (q.what_to_listen_for ? `<strong>Listen for:</strong> ${esc(q.what_to_listen_for)}<br>` : '') +
      (q.what_to_avoid      ? `<strong>Red flag:</strong> ${esc(q.what_to_avoid)}` : '')
    )).join('')}</div>` : '<p style="color:var(--text-2)">No behavioural questions generated.</p>'}`;
}

function situational() {
  const qs = Q().situational_questions || [];
  return `<div class="section-h">Situational Questions</div><div class="section-sub">Hypothetical scenarios testing judgment and decision-making</div>
    ${qs.length ? `<div class="qa-list">${qs.map((q, i) => qa(i + 1, esc(q.question || ''), q.difficulty || 'Medium',
      (q.ideal_approach ? `<strong>Ideal approach:</strong> ${esc(q.ideal_approach)}<br>` : '') +
      (q.what_to_avoid  ? `<strong>Avoid:</strong> ${esc(q.what_to_avoid)}<br>` : '') +
      (q.follow_up      ? `<strong>Follow-up:</strong> ${esc(q.follow_up)}` : '')
    )).join('')}</div>` : '<p style="color:var(--text-2)">No situational questions generated.</p>'}`;
}

function deepdive() {
  const qs = Q().deep_dive_questions    || [];
  const cf = Q().culture_fit_questions  || [];
  return `<div class="section-h">Deep Dive Questions</div><div class="section-sub">Probing questions to verify depth behind claimed expertise</div>
    ${qs.length ? `<div class="qa-list">${qs.map((q, i) => qa(i + 1, esc(q.question || ''), 'Hard',
      (q.intent         ? `<strong>Intent:</strong> ${esc(q.intent)}<br>` : '') +
      (q.expected_depth ? `<strong>Depth expected:</strong> ${esc(q.expected_depth)}` : '')
    )).join('')}</div>` : '<p style="color:var(--text-2)">No deep dive questions generated.</p>'}
    ${cf.length ? `<div class="section-h" style="margin-top:24px">Culture Fit Questions</div><div class="qa-list">${cf.map((q, i) => qa(i + 1, esc(q.question || ''), 'Medium',
      (q.what_to_listen_for ? `<strong>Listen for:</strong> ${esc(q.what_to_listen_for)}<br>` : '') +
      ((q.alignment_signals || []).length ? `<strong>Signals:</strong> ${q.alignment_signals.map(s => esc(s)).join(', ')}` : '')
    )).join('')}</div>` : ''}`;
}

/* ══════════════════════════════════════════
   TAB: BIAS AUDIT
══════════════════════════════════════════ */
function bias() {
  const bi  = BI();
  const pii = bi.pii_detected || {};
  const vec = bi.potential_bias_vectors || [];
  if (!Object.keys(bi).length) return `<div class="section-h">Ethical Bias Audit</div><p style="color:var(--text-2)">Bias report not available.</p>`;

  return `
    <div class="section-h">Ethical Bias Audit</div>
    <div class="section-sub">Fairness, PII detection, and demographic signal analysis</div>

    <div class="two-col">
      <div class="card-block">
        <div class="card-block-title">Fairness Score: ${bi.fairness_score || 0}</div>
        ${biasRow('Overall Fairness', bi.fairness_score || 0)}
        <p style="margin-top:12px;font-size:.78rem;color:var(--text-2)">${esc(bi.blind_review_recommendation || '')}</p>
      </div>
      <div class="card-block">
        <div class="card-block-title">PII Signals</div>
        <div class="item-list">
          ${Object.entries(pii).map(([k, v]) =>
            listItem(v ? 'amber' : 'green', v ? '\u26a0' : '\u2713',
              k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
              v ? 'Detected' : 'Clear')
          ).join('')}
        </div>
      </div>
    </div>

    ${vec.length ? `
    <div class="card-block">
      <div class="card-block-title">Bias Vectors</div>
      ${vec.map(v => `
        <div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-weight:600;font-size:.82rem;color:var(--text)">${esc(v.vector || '')}</span>
            <span class="item-badge badge-${v.risk_level === 'High' ? 'red' : v.risk_level === 'Medium' ? 'amber' : 'green'}">${esc(v.risk_level || '')}</span>
          </div>
          <p style="font-size:.78rem;color:var(--text-2);line-height:1.6">${esc(v.explanation || '')}</p>
          ${v.mitigation ? `<p style="font-size:.75rem;color:var(--text-3);margin-top:4px"><em>Mitigation: ${esc(v.mitigation)}</em></p>` : ''}
        </div>`).join('')}
    </div>` : ''}

    ${bi.evaluation_guidance ? `
    <div class="card-block" style="border-left:3px solid var(--violet)">
      <div class="card-block-title" style="color:var(--violet)">Evaluation Guidance</div>
      <p style="font-size:.8rem;color:var(--text-2);line-height:1.7;margin-top:8px">${esc(bi.evaluation_guidance)}</p>
    </div>` : ''}`;
}

/* ══════════════════════════════════════════
   TAB: COACHING
══════════════════════════════════════════ */
function coaching() {
  const co      = CO();
  const roadmap = co.improvement_roadmap     || [];
  const wins    = co.quick_wins              || [];
  const courses = co.skill_gap_courses       || [];
  const qc      = co.quantification_coaching || {};
  if (!Object.keys(co).length) return `<div class="section-h">Coaching Report</div><p style="color:var(--text-2)">Coaching report not available.</p>`;

  return `
    <div class="section-h">Candidate Coaching Report</div>
    <div class="section-sub">Personalised resume and career improvement recommendations</div>

    ${co.overall_assessment ? `
    <div class="card-block" style="margin-bottom:16px">
      <div class="card-block-title">Overall Assessment</div>
      <p style="font-size:.82rem;color:var(--text-2);line-height:1.7;margin-top:8px">${esc(co.overall_assessment)}</p>
    </div>` : ''}

    ${wins.length ? `
    <div class="card-block" style="margin-bottom:16px">
      <div class="card-block-title">Quick Wins \u2014 Next 7 Days</div>
      <div class="item-list">${wins.map((w, i) => listItem('blue', i + 1, esc(w))).join('')}</div>
    </div>` : ''}

    ${roadmap.length ? `
    <div class="card-block" style="margin-bottom:16px">
      <div class="card-block-title">Improvement Roadmap</div>
      <div class="item-list">
        ${roadmap.map(r => listItem('violet', '\u2192',
          `<strong>${esc(r.area || '')}</strong> \u2014 ${esc(r.specific_action || '')}`,
          r.timeline || '')).join('')}
      </div>
    </div>` : ''}

    ${(qc.bullet_rewrites || []).length ? `
    <div class="card-block" style="margin-bottom:16px">
      <div class="card-block-title">Suggested Bullet Rewrites</div>
      ${(qc.bullet_rewrites || []).map(b => `
        <div style="margin-bottom:12px">
          <div style="background:var(--danger-dim);border-radius:6px;padding:8px 12px;font-size:.78rem;color:var(--danger);margin-bottom:6px">\u274c ${esc(b.original || '')}</div>
          <div style="background:var(--green-dim);border-radius:6px;padding:8px 12px;font-size:.78rem;color:var(--green)">\u2705 ${esc(b.improved || '')}</div>
        </div>`).join('')}
    </div>` : ''}

    ${courses.length ? `
    <div class="card-block" style="margin-bottom:16px">
      <div class="card-block-title">Recommended Courses</div>
      <div class="item-list">
        ${courses.map(c => listItem('blue', '\U0001f4da',
          `<strong>${esc(c.skill || '')}</strong> \u2014 ${esc(c.recommended_course || '')} \u00b7 ${esc(c.platform || '')} \u00b7 ${esc(c.estimated_time || '')}`
        )).join('')}
      </div>
    </div>` : ''}

    ${co.career_advice ? `
    <div class="card-block" style="border-left:3px solid var(--green)">
      <div class="card-block-title">Career Advice</div>
      <p style="font-size:.82rem;color:var(--text-2);font-style:italic;line-height:1.7;margin-top:8px">${esc(co.career_advice)}</p>
    </div>` : ''}`;
}

/* ══════════════════════════════════════════
   TAB: OUTREACH
══════════════════════════════════════════ */
function outreach() {
  const a    = A();
  const name = a.candidate_name || 'the candidate';
  const role = a.current_role   || 'this role';
  const str  = (a.top_strengths || [])[0];

  return `
    <div class="section-h">Recruiter Outreach Templates</div>
    <div class="section-sub">Personalised for ${esc(name)}</div>
    <div class="agent-card">
      <div class="agent-header">
        <div class="agent-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x=".5" y="2.5" width="15" height="11" rx="2" stroke="currentColor" stroke-width="1.2"/><path d=".5 4.5l7.5 5 7.5-5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div><div class="agent-title">LinkedIn InMail</div><div class="agent-sub">Personalised for ${esc(name)}</div></div>
      </div>
      <div style="background:var(--surface-2);border-radius:var(--r-md);padding:14px;font-size:.78rem;color:var(--text-2);line-height:1.8;white-space:pre-wrap">Hi ${esc(name.split(' ')[0])},

I came across your background as ${esc(role)} and was genuinely impressed by your profile.${str ? ' Particularly your ' + esc(str.strength || '') + '.' : ''}

I think there could be a strong fit with an opportunity we\u2019re building toward.

Would you be open to a 20-minute conversation this week?</div>
    </div>`;
}

/* ══════════════════════════════════════════
   TABS: PIPELINE / JOBGEN / DECISION
══════════════════════════════════════════ */
function pipeline() {
  return `<div class="section-h">Talent Pipeline</div>
    <div class="card-block"><p style="color:var(--text-2);font-size:.82rem">Pipeline tracking with multiple candidates will be available in the next version.</p></div>`;
}

function jobgen() {
  const a  = A();
  const sk = a.technical_skills || {};
  const skillLines = Object.entries(sk).filter(([, v]) => v && v.length)
    .map(([k, v]) => `\u2022 ${k.replace(/_/g, ' ')}: ${v.slice(0, 4).join(', ')}`).join('<br>');
  return `
    <div class="section-h">JD Generator</div>
    <div class="section-sub">AI-generated job description based on this candidate\u2019s profile</div>
    <div class="card-block" style="font-family:var(--font-mono);font-size:.75rem;line-height:1.9;color:var(--text-2)">
      <div style="font-family:var(--font-head);font-size:1rem;font-weight:700;color:var(--text);margin-bottom:4px">${esc(a.current_role || 'Target Role')}</div>
      <div style="color:var(--accent);margin-bottom:16px;font-family:var(--font-body);font-size:.78rem">Full-time \u00b7 Based on candidate intelligence</div>
      ${skillLines ? `<strong style="color:var(--text);font-family:var(--font-body)">Key Requirements</strong><br>${skillLines}<br><br>` : ''}
      <em style="color:var(--text-3)">AI-generated for inclusivity \u2014 neutral language, skills-first, no prestige signals.</em>
    </div>`;
}

function decision() {
  const a   = A();
  const rec = a.hire_recommendation || '\u2014';
  const isH = /hire/i.test(rec) && !/not|pass|no/i.test(rec);

  return `
    <div class="section-h">AI Hire Decision</div>
    <div class="section-sub">Structured recommendation based on full analysis</div>
    <div class="card-block" style="margin-bottom:20px;background:${isH ? 'var(--green-dim)' : 'var(--danger-dim)'};border-color:${isH ? 'rgba(52,211,153,.25)' : 'rgba(239,68,68,.25)'}">
      <div style="font-family:var(--font-head);font-size:2rem;font-weight:800;color:${isH ? 'var(--green)' : 'var(--danger)'}">${esc(rec)}</div>
      ${a.hire_rationale ? `<p style="margin-top:10px;font-size:.8rem;color:var(--text-2);line-height:1.7">${esc(a.hire_rationale)}</p>` : ''}
    </div>
    <div class="two-col">
      <div class="card-block">
        <div class="card-block-title">For</div>
        <div class="item-list">
          ${(a.top_strengths || []).slice(0, 4).map(s => listItem('green', '\u2713', esc(s.strength || String(s)))).join('')
            || '<p style="color:var(--text-2);font-size:.8rem">\u2014</p>'}
        </div>
      </div>
      <div class="card-block">
        <div class="card-block-title">Against</div>
        <div class="item-list">
          ${(a.potential_gaps || []).slice(0, 4).map(g =>
            listItem(g.severity === 'Critical' ? 'red' : 'amber',
              g.severity === 'Critical' ? '\u2717' : '~',
              esc(g.gap || String(g)))).join('')
            || '<p style="color:var(--green);font-size:.8rem">No significant gaps.</p>'}
        </div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════
   HELPER BUILDERS
══════════════════════════════════════════ */
function axisCard(name, score, color) {
  const s = Math.min(Math.max(Number(score) || 0, 0), 100);
  return `<div class="axis-card">
    <div class="axis-top">
      <span class="axis-name">${name}</span>
      <span class="axis-score" style="color:${color}">${s}</span>
    </div>
    <div class="axis-progress">
      <div class="axis-fill" style="background:${color};width:0%" data-w="${s}"></div>
    </div>
  </div>`;
}

function listItem(color, bullet, text, badge = '') {
  return `<div class="item-row">
    <div class="item-bullet ${color}">${bullet}</div>
    <div class="item-text">${text}</div>
    ${badge ? `<span class="item-badge badge-${color}">${esc(String(badge))}</span>` : ''}
  </div>`;
}

function biasRow(label, score) {
  const s     = Math.min(Math.max(Number(score) || 0, 0), 100);
  const color = s >= 85 ? 'var(--green)' : s >= 65 ? 'var(--amber)' : 'var(--danger)';
  return `<div class="bias-row">
    <div class="bias-label">${label}</div>
    <div class="bias-track"><div class="bias-fill" style="background:${color}" data-w="${s}"></div></div>
    <div class="bias-score">${s}%</div>
  </div>`;
}

function tlItem(title, company, date, desc) {
  return `<div class="tl-item">
    <div class="tl-left"><div class="tl-dot"></div><div class="tl-line"></div></div>
    <div>
      <div class="tl-title">${title}</div>
      <div class="tl-company">${company}</div>
      <div class="tl-date">${date}</div>
      <div class="tl-desc">${desc}</div>
    </div>
  </div>`;
}

function qa(num, question, difficulty, detail) {
  const cls = { Hard: 'difficulty-hard', Medium: 'difficulty-medium', Easy: 'difficulty-easy' }[difficulty] || 'difficulty-medium';
  return `<div class="qa-item">
    <div class="qa-q">
      <span class="qa-num">Q${num}</span>
      <span class="qa-text">${question}</span>
      <span class="qa-difficulty ${cls}">${difficulty}</span>
    </div>
    <div class="qa-a">${detail || 'Look for specificity \u2014 exact numbers, trade-offs made, and lessons learned.'}</div>
  </div>`;
}

/* ══════════════════════════════════════════
   TOAST
══════════════════════════════════════════ */
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast ' + (type || '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), type === 'error' ? 5000 : 2800);
}
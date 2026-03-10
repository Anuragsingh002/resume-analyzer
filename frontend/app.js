'use strict';
/* ═══════════════════════════════════════════════════════════
   TalentIQ v5.0 — Application Logic
   Fonts: DM Serif Display · DM Sans · JetBrains Mono
   ═══════════════════════════════════════════════════════════ */

const API = 'https://resume-analyzer-6wj1.onrender.com';
const $ = id => document.getElementById(id);

let resumeFile = null;
let reportData = null;

/* Recruitment Agent state */
const pipeline = []; // { name, role, score, jdMatch, yrsExp, decision, notes, ts }
let currentDecision = { type: null, notes: '' };

/* ─────────────────────────────────────────────────────────────
   THEME
───────────────────────────────────────────────────────────── */
function toggleTheme() {
  const html = document.documentElement;
  const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
  html.dataset.theme = next;
  localStorage.setItem('tiq-theme', next);
}
(function initTheme() {
  const saved = localStorage.getItem('tiq-theme') || 'dark';
  document.documentElement.dataset.theme = saved;
})();

/* ─────────────────────────────────────────────────────────────
   SCREEN MANAGER
───────────────────────────────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  const el = $(id);
  el.style.display = 'flex';
  requestAnimationFrame(() => el.classList.add('active'));
}

/* ─────────────────────────────────────────────────────────────
   FILE HANDLING
───────────────────────────────────────────────────────────── */
const dropZone = $('drop-zone');
const fileInput = $('file-input');

dropZone.addEventListener('click', e => {
  if (!e.target.classList.contains('dz-browse') && e.target.id !== 'dz-remove') {
    fileInput.click();
  }
});
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('over'); });
dropZone.addEventListener('dragleave', e => {
  if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('over');
});
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('over');
  const f = e.dataTransfer.files[0];
  if (f?.type === 'application/pdf') setFile(f);
  else toast('Only PDF files are accepted.', 'err');
});
fileInput.addEventListener('change', e => { if (e.target.files[0]) setFile(e.target.files[0]); });

function setFile(f) {
  resumeFile = f;
  $('dz-idle').classList.add('hidden');
  $('dz-ready').classList.remove('hidden');
  $('dz-file-name').textContent = f.name;
  if ($('dz-file-size')) $('dz-file-size').textContent = formatBytes(f.size);
  const btn = $('run-btn');
  btn.disabled = false;
  $('run-btn-text').textContent = 'Run full intelligence analysis';
}
function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}
function removeFile() {
  resumeFile = null; fileInput.value = '';
  $('dz-ready').classList.add('hidden');
  $('dz-idle').classList.remove('hidden');
  $('run-btn').disabled = true;
  $('run-btn-text').textContent = 'Select a resume to begin';
}
function resetApp() {
  removeFile(); reportData = null; currentDecision = { type: null, notes: '' };
  $('jd-input').value = '';
  showScreen('screen-upload');
}

/* ─────────────────────────────────────────────────────────────
   TOAST
───────────────────────────────────────────────────────────── */
let toastTimer;
function toast(msg, type = 'info') {
  const el = $('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type === 'err' ? ' toast--err' : type === 'ok' ? ' toast--ok' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); }, 5000);
}

/* ─────────────────────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────────────────────── */
const delay = ms => new Promise(r => setTimeout(r, ms));

function scoreColor(n) {
  if (n >= 75) return 'var(--green)';
  if (n >= 55) return 'var(--amber)';
  return 'var(--red)';
}
function scoreClass(n) {
  if (n >= 75) return 'green';
  if (n >= 55) return 'amber';
  return 'red';
}
function jdColor(n) {
  if (n >= 60) return 'var(--green)';
  if (n >= 40) return 'var(--amber)';
  return 'var(--red)';
}

/* Animated counter */
function animateCount(el, from, to, dur = 1000, suffix = '') {
  const start = performance.now();
  const range = to - from;
  function step(now) {
    const p = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + range * eased) + suffix;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* Animate progress bar fill */
function animateBars() {
  document.querySelectorAll('.prog-bar-fill[data-val]').forEach(bar => {
    const val = parseFloat(bar.dataset.val);
    setTimeout(() => { bar.style.width = val + '%'; }, 100);
  });
}

/* Animate score rings */
function animateRing(id, value, max = 100) {
  const circle = document.getElementById(id);
  if (!circle) return;
  const r = parseFloat(circle.getAttribute('r'));
  const circ = 2 * Math.PI * r;
  circle.setAttribute('stroke-dasharray', circ);
  circle.setAttribute('stroke-dashoffset', circ);
  setTimeout(() => {
    const offset = circ - (value / max) * circ;
    circle.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)';
    circle.setAttribute('stroke-dashoffset', offset);
  }, 150);
}

/* Loading progress ring */
function setLoadingProgress(pct) {
  const ring = $('lv-progress-ring');
  if (!ring) return;
  const circ = 2 * Math.PI * 36; // r=36
  ring.setAttribute('stroke-dashoffset', circ - (pct / 100) * circ);
}

/* ─────────────────────────────────────────────────────────────
   SERVER WAKE + FETCH WITH RETRY
───────────────────────────────────────────────────────────── */
async function wakeServer() {
  const label = $('ls1-label');
  const MAX_WAIT = 70000;
  const PING = 4000;
  const start = Date.now();

  try {
    const quick = await Promise.race([
      fetch(`${API}/health`),
      delay(3000).then(() => { throw new Error('timeout'); }),
    ]);
    if (quick.ok) return true;
  } catch (_) {}

  if (label) label.textContent = 'Waking server (cold start ~30s)…';
  let dots = 0;
  const dotTimer = setInterval(() => {
    dots = (dots + 1) % 4;
    if (label) label.textContent = 'Waking server' + '.'.repeat(dots + 1);
  }, 600);

  while (Date.now() - start < MAX_WAIT) {
    await delay(PING);
    try {
      const r = await Promise.race([
        fetch(`${API}/health`),
        delay(5000).then(() => { throw new Error('timeout'); }),
      ]);
      if (r.ok) {
        clearInterval(dotTimer);
        if (label) label.textContent = 'Server ready — starting analysis…';
        await delay(400);
        return true;
      }
    } catch (_) {}
  }
  clearInterval(dotTimer);
  throw new Error('Server took too long to wake up. Please try again.');
}

async function fetchWithRetry(url, opts, retries = 2, timeout = 90000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(url, { ...opts, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      if (attempt === retries) throw new Error(
        err.name === 'AbortError'
          ? 'Request timed out. Please try again.'
          : 'Failed to reach server. Check connection and try again.'
      );
      await delay(3000 * (attempt + 1));
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   ANALYSIS PIPELINE
───────────────────────────────────────────────────────────── */
async function startAnalysis() {
  if (!resumeFile) return;
  showScreen('screen-loading');

  const stepIds = ['ls1','ls2','ls3','ls4','ls5','ls6'];
  stepIds.forEach(id => { const el = $(id); if(el){ el.classList.remove('active','done'); }});
  setLoadingProgress(0);

  let cur = 0;
  function advance() {
    if (cur > 0) {
      const prev = $(stepIds[cur - 1]);
      if (prev) { prev.classList.remove('active'); prev.classList.add('done'); }
    }
    if (cur < stepIds.length) {
      const el = $(stepIds[cur]);
      if (el) el.classList.add('active');
      setLoadingProgress((cur / stepIds.length) * 90);
      cur++;
    }
  }
  advance(); // step 1

  const sub = $('loading-sub-text');
  const subMessages = ['Connecting to inference engine…','Parsing resume structure…','Running ATS scoring…','Quantifying impact…','Generating interview questions…','Compiling coaching report…'];

  let timers = [];
  try {
    await wakeServer();
    advance(); // step 2
    if (sub) sub.textContent = subMessages[1];

    const delays = [9000, 17000, 25000, 33000, 40000];
    timers = delays.map((d, i) => setTimeout(() => {
      advance();
      if (sub) sub.textContent = subMessages[i + 2] || 'Almost done…';
    }, d));

    const fd = new FormData();
    fd.append('file', resumeFile);
    const jd = $('jd-input').value.trim();
    if (jd) fd.append('job_description', jd);

    const res = await fetchWithRetry(`${API}/analyze`, { method: 'POST', body: fd }, 2, 90000);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.detail || `Server error ${res.status}`);
    }
    reportData = await res.json();
    timers.forEach(clearTimeout);
    setLoadingProgress(100);
    stepIds.forEach(id => { const el = $(id); if(el){ el.classList.remove('active'); el.classList.add('done'); }});
    await delay(500);

    /* Save to pipeline */
    const a = reportData.analysis || {};
    pipeline.push({
      name: a.name || 'Unknown',
      role: a.current_role || a.target_role || '—',
      score: a.ats_scores?.overall ?? 0,
      jdMatch: a.jd_match?.match_percentage ?? 0,
      yrsExp: a.years_experience ?? 0,
      decision: null, notes: '',
      ts: new Date().toISOString(),
      data: reportData,
    });
    currentDecision = { type: null, notes: '' };

    buildResults(reportData);
    showScreen('screen-results');
  } catch (err) {
    timers.forEach(clearTimeout);
    showScreen('screen-upload');
    const msg = err.message || 'Analysis failed.';
    toast(msg, 'err');
    const hint = $('upload-error-hint');
    if (hint) {
      hint.textContent = msg.includes('wake') || msg.includes('fetch') || msg.includes('reach')
        ? 'Server cold-starting. Wait 30 seconds and try again.'
        : msg;
      hint.classList.remove('hidden');
      setTimeout(() => hint.classList.add('hidden'), 8000);
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   BUILD RESULTS
───────────────────────────────────────────────────────────── */
function buildResults(data) {
  const a = data.analysis || {};
  const name = a.name || 'Candidate';
  const role = a.current_role || a.target_role || '—';
  const score = a.ats_scores?.overall ?? 0;
  const jdMatch = a.jd_match?.match_percentage ?? 0;
  const yrs = a.years_experience ?? 0;

  /* Sidebar */
  const av = $('sb-avatar');
  av.textContent = name.charAt(0).toUpperCase();
  $('sb-name').textContent = name;
  $('sb-role').textContent = role;

  /* Animated counters */
  const scoreEl = $('sb-score'); const jdEl = $('sb-jd'); const yrsEl = $('sb-yrs');
  animateCount(scoreEl, 0, score, 900);
  animateCount(jdEl, 0, jdMatch, 900, '%');
  animateCount(yrsEl, 0, yrs, 700);

  /* Hire badge */
  const badge = $('hire-badge');
  const rec = a.recommendation || '';
  if (rec) {
    const t = rec.toLowerCase();
    badge.dataset.rec = t.includes('hire') ? 'hire' : t.includes('hold') ? 'hold' : 'pass';
    badge.textContent = rec;
  }

  /* Timestamp */
  $('results-timestamp').textContent = 'Generated ' + new Date().toLocaleString();

  /* Wire nav */
  document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTab(btn.dataset.tab, data);
    });
  });

  renderTab('overview', data);
}

/* ─────────────────────────────────────────────────────────────
   TAB ROUTER
───────────────────────────────────────────────────────────── */
function renderTab(tab, data) {
  const el = $('tab-content');
  el.innerHTML = '';
  el.style.animation = 'none';
  requestAnimationFrame(() => { el.style.animation = ''; });

  const a = data?.analysis || {};
  switch (tab) {
    case 'overview':    renderOverview(el, data); break;
    case 'ats':         renderATS(el, data); break;
    case 'skills':      renderSkills(el, a); break;
    case 'experience':  renderExperience(el, a); break;
    case 'analysis':    renderAnalysis(el, a); break;
    case 'impact':      renderImpact(el, a); break;
    case 'realvsbuzz':  renderRealVsBuzz(el, a); break;
    case 'jdmatch':     renderJDMatch(el, a); break;
    case 'redflags':    renderRedFlags(el, a); break;
    case 'technical':   renderQuestions(el, data?.questions?.technical, 'Technical Questions', 'blue'); break;
    case 'behavioral':  renderQuestions(el, data?.questions?.behavioral, 'Behavioural Questions', 'violet'); break;
    case 'situational': renderQuestions(el, data?.questions?.situational, 'Situational Questions', 'teal'); break;
    case 'deepdive':    renderQuestions(el, data?.questions?.deep_dive, 'Deep Dive Questions', 'amber'); break;
    case 'bias':        renderBias(el, data); break;
    case 'coaching':    renderCoaching(el, data); break;
    case 'outreach':    renderOutreach(el, data); break;
    case 'pipeline':    renderPipeline(el); break;
    case 'jobgen':      renderJobGen(el, data); break;
    case 'decision':    renderDecision(el, data); break;
    default: el.innerHTML = '<p style="color:var(--tx3);padding:40px">Tab coming soon.</p>';
  }
  setTimeout(animateBars, 50);
}

/* ─────────────────────────────────────────────────────────────
   OVERVIEW
───────────────────────────────────────────────────────────── */
function renderOverview(el, data) {
  const a = data.analysis || {};
  const score = a.ats_scores?.overall ?? 0;
  const jdMatch = a.jd_match?.match_percentage ?? 0;
  const yrs = a.years_experience ?? 0;
  const qi = a.quantified_impact || {};
  const cc = a.candidate_classification || {};
  const cv = a.career_velocity || 'Steady';

  const cvColor = { Accelerating:'green', Steady:'blue', Plateauing:'amber', Declining:'red' }[cv] || 'neutral';

  el.innerHTML = `
  <div class="stagger">
    <div class="overview-header">
      <div>
        <div class="overview-name">${a.name || '—'}</div>
        <div class="overview-role">${a.current_role || a.target_role || '—'}</div>
        <div class="overview-meta">
          ${a.email ? `<span class="tag tag--neutral">${a.email}</span>` : ''}
          ${a.phone ? `<span class="tag tag--neutral">${a.phone}</span>` : ''}
          ${a.location ? `<span class="tag tag--neutral">${a.location}</span>` : ''}
          ${yrs ? `<span class="tag tag--blue">${yrs} yrs exp</span>` : ''}
        </div>
      </div>
      ${cc.type ? `<div class="badge badge--${cc.type==='Proven'?'green':cc.type==='High Potential'?'blue':'amber'}">${cc.type}</div>` : ''}
    </div>

    <div class="overview-scores">
      <div class="ov-score-card">
        <div class="ov-score-num" id="ov-score" style="color:${scoreColor(score)}">0</div>
        <div class="ov-score-lbl">ATS Score</div>
        <div class="ov-score-sub">${score>=75?'Strong candidate':score>=55?'Moderate fit':'Needs development'}</div>
      </div>
      <div class="ov-score-card">
        <div class="ov-score-num" id="ov-jd" style="color:${jdColor(jdMatch)}">0%</div>
        <div class="ov-score-lbl">JD Match</div>
        <div class="ov-score-sub">${jdMatch>=60?'Strong alignment':jdMatch>=40?'Moderate alignment':'Low alignment'}</div>
      </div>
      <div class="ov-score-card">
        <div class="ov-score-num" id="ov-impact" style="color:${scoreColor(qi.score||0)}">0</div>
        <div class="ov-score-lbl">Impact Score</div>
        <div class="ov-score-sub">${qi.verdict || '—'}</div>
      </div>
    </div>

    <div class="ov-2col">
      <div class="card">
        <div class="card-title">Career Velocity</div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <span class="badge badge--${cvColor}">${cv}</span>
        </div>
        <p style="font-size:13px;color:var(--tx2);line-height:1.6">${a.career_velocity_evidence || '—'}</p>
      </div>
      <div class="card">
        <div class="card-title">Candidate Profile</div>
        ${cc.type ? `
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
            <span class="badge badge--${cc.type==='Proven'?'green':cc.type==='High Potential'?'blue':'amber'}">${cc.type}</span>
            ${cc.buzz_word_rating ? `<span class="badge badge--${cc.buzz_word_rating==='Substance-Rich'?'green':cc.buzz_word_rating==='Buzz-Heavy'?'red':'amber'}">${cc.buzz_word_rating}</span>` : ''}
            ${cc.confidence ? `<span class="badge badge--neutral">${cc.confidence} confidence</span>` : ''}
          </div>
          <p style="font-size:13px;color:var(--tx2);line-height:1.6">${cc.evidence || '—'}</p>
        ` : '<p style="color:var(--tx3)">No classification data.</p>'}
      </div>
    </div>

    <div class="card ov-full">
      <div class="card-title">Professional Summary</div>
      <p style="font-size:13.5px;line-height:1.75;color:var(--tx1)">${a.summary || a.professional_summary || 'No summary available.'}</p>
    </div>

    <div class="ov-2col">
      <div class="card">
        <div class="card-title">Top Strengths</div>
        ${(a.strengths||a.key_strengths||[]).slice(0,4).map(s=>
          `<div class="ev-item"><div class="ev-dot ev-dot--green"></div><span>${s}</span></div>`
        ).join('') || '<p style="color:var(--tx3)">No strengths data.</p>'}
      </div>
      <div class="card">
        <div class="card-title">Key Gaps</div>
        ${(a.gaps||a.key_gaps||[]).slice(0,4).map(g=>
          `<div class="ev-item"><div class="ev-dot ev-dot--red"></div><span>${g}</span></div>`
        ).join('') || '<p style="color:var(--tx3)">No gaps identified.</p>'}
      </div>
    </div>
  </div>`;

  animateCount($('ov-score'), 0, a.ats_scores?.overall ?? 0, 1000);
  animateCount($('ov-jd'), 0, a.jd_match?.match_percentage ?? 0, 1000, '%');
  animateCount($('ov-impact'), 0, a.quantified_impact?.score ?? 0, 1000);
}

/* ─────────────────────────────────────────────────────────────
   ATS SCORES
───────────────────────────────────────────────────────────── */
function renderATS(el, data) {
  const a = data.analysis || {};
  const sc = a.ats_scores || {};
  const qi = a.quantified_impact || {};

  const axes = [
    { key: 'keyword_density',      label: 'Keyword Density' },
    { key: 'experience_depth',     label: 'Experience Depth' },
    { key: 'achievement_impact',   label: 'Achievement Impact' },
    { key: 'education_relevance',  label: 'Education Relevance' },
    { key: 'technical_skills',     label: 'Technical Skills' },
    { key: 'leadership_scope',     label: 'Leadership & Scope' },
  ];
  const overall = sc.overall ?? 0;

  el.innerHTML = `
  <div class="stagger">
    <div class="card card--highlight" style="display:flex;align-items:center;gap:24px;padding:24px 28px;margin-bottom:20px;">
      <div>
        <div style="font-size:48px;font-family:var(--fm);font-weight:500;color:${scoreColor(overall)};line-height:1" id="ats-big">0</div>
        <div style="font-size:12px;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;margin-top:4px">Overall ATS Score</div>
      </div>
      <div style="flex:1">
        <div class="prog-bar-track" style="height:10px;border-radius:6px;">
          <div class="prog-bar-fill prog-bar-fill--${scoreClass(overall)}" data-val="${overall}" style="height:10px;border-radius:6px;"></div>
        </div>
        <p style="font-size:13px;color:var(--tx2);margin-top:10px;line-height:1.6">${sc.scoring_notes?.experience_depth_reason || 'Calibrated six-axis ATS evaluation.'}</p>
      </div>
    </div>

    <div class="card" style="margin-bottom:20px;">
      <div class="card-title">Six-Axis Breakdown</div>
      ${axes.map(ax => {
        const val = sc[ax.key] ?? sc[ax.key.replace('_','')] ?? 0;
        const note = sc.scoring_notes?.[ax.key + '_reason'] || '';
        return `
        <div class="prog-bar-wrap">
          <div class="prog-bar-head">
            <span class="prog-bar-label">${ax.label}</span>
            <span class="prog-bar-val" id="bar-${ax.key}">0</span>
          </div>
          <div class="prog-bar-track">
            <div class="prog-bar-fill prog-bar-fill--${scoreClass(val)}" data-val="${val}"></div>
          </div>
          ${note ? `<p style="font-size:11.5px;color:var(--tx3);margin-top:4px">${note}</p>` : ''}
        </div>`;
      }).join('')}
    </div>

    <div class="card card--${qi.verdict==='Excellent'||qi.verdict==='Good'?'success':qi.verdict==='Poor'||qi.verdict==='Very Poor'?'danger':''}">
      <div class="card-title">Quantified Impact Analysis</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:16px;text-align:center;">
        <div><div class="stat-num" id="qi-score" style="color:${scoreColor(qi.score||0)}">0</div><div class="stat-lbl">Score</div></div>
        <div><div class="stat-num" id="qi-total">0</div><div class="stat-lbl">Total Bullets</div></div>
        <div><div class="stat-num" id="qi-quant">0</div><div class="stat-lbl">Quantified</div></div>
        <div><div class="stat-num" id="qi-pct">0%</div><div class="stat-lbl">% Quantified</div></div>
      </div>
      ${(qi.strong_examples||[]).length ? `
        <div class="sub-title">✅ Strong Examples</div>
        ${qi.strong_examples.map(e=>`<div class="ev-item"><div class="ev-dot ev-dot--green"></div><span>${e}</span></div>`).join('')}
      ` : ''}
      ${(qi.weak_examples||[]).length ? `
        <div class="sub-title" style="margin-top:14px">⚠️ Weak Examples</div>
        ${qi.weak_examples.map(e=>`<div class="ev-item"><div class="ev-dot ev-dot--amber"></div><span>${e}</span></div>`).join('')}
      ` : ''}
      ${qi.improvement_tip ? `<p style="font-size:13px;color:var(--tx2);margin-top:12px;padding:12px;background:var(--bg2);border-radius:var(--r-sm)">${qi.improvement_tip}</p>` : ''}
    </div>
  </div>`;

  animateCount($('ats-big'), 0, overall, 1000);
  axes.forEach(ax => {
    const val = sc[ax.key] ?? 0;
    const barEl = $(`bar-${ax.key}`);
    if (barEl) animateCount(barEl, 0, val, 900);
  });
  animateCount($('qi-score'), 0, qi.score||0, 900);
  animateCount($('qi-total'), 0, qi.total_bullets||0, 700);
  animateCount($('qi-quant'), 0, qi.quantified_bullets||0, 700);
  animateCount($('qi-pct'), 0, qi.quantified_percentage||0, 700, '%');
}

/* ─────────────────────────────────────────────────────────────
   SKILLS
───────────────────────────────────────────────────────────── */
function renderSkills(el, a) {
  const tech = a.technical_skills || a.skills?.technical || [];
  const soft = a.soft_skills || a.skills?.soft || [];
  const industry = a.industry_knowledge || a.skills?.industry || [];
  const emerging = a.emerging_skills || a.skills?.emerging || [];
  const missing = a.missing_skills || [];
  const adjacent = a.adjacent_skills || a.skill_adjacency || [];

  el.innerHTML = `
  <div class="stagger">
    <div class="card">
      <div class="card-title">Technical Skills (${tech.length})</div>
      <div class="tag-list">${tech.map(s=>`<span class="tag tag--blue">${s}</span>`).join('') || '<span style="color:var(--tx3)">None detected</span>'}</div>
    </div>
    <div class="grid-2">
      <div class="card">
        <div class="card-title">Soft Skills</div>
        <div class="tag-list">${soft.map(s=>`<span class="tag tag--violet">${s}</span>`).join('') || '<span style="color:var(--tx3)">None detected</span>'}</div>
      </div>
      <div class="card">
        <div class="card-title">Industry Knowledge</div>
        <div class="tag-list">${industry.map(s=>`<span class="tag tag--teal">${s}</span>`).join('') || '<span style="color:var(--tx3)">None detected</span>'}</div>
      </div>
    </div>
    ${emerging.length ? `
    <div class="card card--highlight">
      <div class="card-title">🚀 Emerging / Modern Skills</div>
      <div class="tag-list">${emerging.map(s=>`<span class="tag tag--green">${s}</span>`).join('')}</div>
    </div>` : ''}
    ${missing.length ? `
    <div class="card card--danger">
      <div class="card-title">⚠️ Missing / Underdeveloped Skills</div>
      <div class="tag-list">${missing.map(s=>`<span class="tag tag--red">${s}</span>`).join('')}</div>
    </div>` : ''}
    ${adjacent.length ? `
    <div class="card">
      <div class="card-title">🔗 Adjacent / Transferable Skills</div>
      <div class="tag-list">${adjacent.map(s=>`<span class="tag tag--amber">${s}</span>`).join('')}</div>
    </div>` : ''}
  </div>`;
}

/* ─────────────────────────────────────────────────────────────
   EXPERIENCE
───────────────────────────────────────────────────────────── */
function renderExperience(el, a) {
  const jobs = a.work_experience || a.experience || [];
  const edu = a.education || [];
  const certs = a.certifications || [];

  el.innerHTML = `
  <div class="stagger">
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">Work History (${jobs.length} positions)</div>
      ${jobs.length ? jobs.map(job => `
        <div style="padding:14px 0;border-bottom:1px solid var(--line1);last-child:border-bottom:none">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:6px">
            <div>
              <p style="font-size:14px;font-weight:700;color:var(--tx1)">${job.title || job.position || '—'}</p>
              <p style="font-size:13px;color:var(--brand);font-weight:600;margin-top:1px">${job.company || '—'}</p>
            </div>
            <span class="tag tag--neutral" style="white-space:nowrap;flex-shrink:0">${job.duration || job.period || job.dates || '—'}</span>
          </div>
          ${job.description ? `<p style="font-size:13px;color:var(--tx2);line-height:1.65">${job.description}</p>` : ''}
          ${(job.achievements||job.highlights||[]).length ? `
            <div style="margin-top:8px">
              ${job.achievements?.map(a=>`<div class="ev-item" style="margin-bottom:5px"><div class="ev-dot ev-dot--blue"></div><span>${a}</span></div>`).join('') || ''}
            </div>` : ''}
        </div>`).join('') : '<p style="color:var(--tx3)">No work experience found.</p>'}
    </div>

    ${edu.length ? `
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">Education</div>
      ${edu.map(e => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--line1)">
          <div>
            <p style="font-size:13.5px;font-weight:600;color:var(--tx1)">${e.degree || e.qualification || '—'}</p>
            <p style="font-size:12.5px;color:var(--tx2);margin-top:2px">${e.institution || e.school || '—'}</p>
          </div>
          <span class="tag tag--neutral">${e.year || e.graduation_year || '—'}</span>
        </div>`).join('')}
    </div>` : ''}

    ${certs.length ? `
    <div class="card">
      <div class="card-title">Certifications & Credentials</div>
      <div class="tag-list">${certs.map(c=>`<span class="tag tag--teal">${typeof c === 'string' ? c : c.name || c.certification}</span>`).join('')}</div>
    </div>` : ''}
  </div>`;
}

/* ─────────────────────────────────────────────────────────────
   STRENGTHS & GAPS
───────────────────────────────────────────────────────────── */
function renderAnalysis(el, a) {
  const cc = a.candidate_classification || {};
  const s = a.strengths || a.key_strengths || [];
  const g = a.gaps || a.key_gaps || [];
  const rf = a.red_flags || [];

  el.innerHTML = `
  <div class="stagger">
    ${cc.type ? `
    <div class="card card--highlight">
      <div class="card-title">Candidate Intelligence Report</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <span class="badge badge--${cc.type==='Proven'?'green':cc.type==='High Potential'?'blue':'amber'}">${cc.type}</span>
        ${cc.buzz_word_rating ? `<span class="badge badge--${cc.buzz_word_rating==='Substance-Rich'?'green':cc.buzz_word_rating==='Buzz-Heavy'?'red':'amber'}">${cc.buzz_word_rating}</span>` : ''}
        ${cc.confidence ? `<span class="badge badge--neutral">${cc.confidence} confidence</span>` : ''}
      </div>
      <p style="font-size:13.5px;color:var(--tx1);line-height:1.7">${cc.evidence || '—'}</p>
      ${(cc.substance_examples||[]).length?`
        <div style="margin-top:12px">
          <div class="sub-title" style="margin-bottom:8px">Substance Evidence</div>
          ${cc.substance_examples.map(e=>`<div class="ev-item"><div class="ev-dot ev-dot--green"></div><span>${e}</span></div>`).join('')}
        </div>` : ''}
      ${(cc.buzz_examples||[]).length?`
        <div style="margin-top:12px">
          <div class="sub-title" style="margin-bottom:8px">Buzz-word Examples</div>
          ${cc.buzz_examples.map(e=>`<div class="ev-item"><div class="ev-dot ev-dot--amber"></div><span>${e}</span></div>`).join('')}
        </div>` : ''}
    </div>` : ''}

    <div class="grid-2">
      <div class="card card--success">
        <div class="card-title">✅ Strengths (${s.length})</div>
        ${s.map(i=>`<div class="ev-item"><div class="ev-dot ev-dot--green"></div><span>${i}</span></div>`).join('') || '<p style="color:var(--tx3)">None listed.</p>'}
      </div>
      <div class="card card--danger">
        <div class="card-title">⚠️ Gaps (${g.length})</div>
        ${g.map(i=>`<div class="ev-item"><div class="ev-dot ev-dot--red"></div><span>${i}</span></div>`).join('') || '<p style="color:var(--tx3)">None identified.</p>'}
      </div>
    </div>

    ${rf.length ? `
    <div class="card card--danger">
      <div class="card-title">🚩 Red Flags</div>
      ${rf.map(f=>`<div class="ev-item"><div class="ev-dot ev-dot--red"></div><span>${f}</span></div>`).join('')}
    </div>` : ''}
  </div>`;
}

/* ─────────────────────────────────────────────────────────────
   IMPACT SCORE
───────────────────────────────────────────────────────────── */
function renderImpact(el, a) {
  const qi = a.quantified_impact || {};
  const score = qi.score || 0;
  const pct = qi.quantified_percentage || 0;

  el.innerHTML = `
  <div class="stagger">
    <div style="display:grid;grid-template-columns:auto 1fr;gap:24px;align-items:center;padding:24px 28px;background:var(--bg1);border:1px solid var(--line1);border-radius:var(--r-lg);margin-bottom:20px;">
      <div style="text-align:center">
        <svg viewBox="0 0 100 100" width="110" height="110" style="transform:rotate(-90deg)">
          <circle cx="50" cy="50" r="42" stroke="var(--bg3)" stroke-width="8" fill="none"/>
          <circle id="impact-ring" cx="50" cy="50" r="42" stroke="${scoreColor(score)}" stroke-width="8" fill="none"
            stroke-linecap="round" stroke-dasharray="${2*Math.PI*42}" stroke-dashoffset="${2*Math.PI*42}"/>
        </svg>
        <div style="margin-top:-76px;margin-bottom:54px;font-family:var(--fm);font-size:28px;font-weight:500;color:${scoreColor(score)}" id="impact-num">0</div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3)">Impact Score</div>
      </div>
      <div>
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
          ${qi.verdict ? `<span class="badge badge--${qi.verdict==='Excellent'||qi.verdict==='Good'?'green':qi.verdict==='Adequate'?'amber':'red'}">${qi.verdict}</span>` : ''}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;text-align:center;">
          <div style="background:var(--bg2);border:1px solid var(--line1);border-radius:var(--r-sm);padding:12px 8px">
            <div class="stat-num" id="imp-tot" style="font-size:22px">0</div>
            <div class="stat-lbl">Total Bullets</div>
          </div>
          <div style="background:var(--bg2);border:1px solid var(--line1);border-radius:var(--r-sm);padding:12px 8px">
            <div class="stat-num" id="imp-q" style="font-size:22px">0</div>
            <div class="stat-lbl">Quantified</div>
          </div>
          <div style="background:var(--bg2);border:1px solid var(--line1);border-radius:var(--r-sm);padding:12px 8px">
            <div class="stat-num" id="imp-pct" style="font-size:22px;color:${scoreColor(pct)}">0%</div>
            <div class="stat-lbl">% Quantified</div>
          </div>
        </div>
        ${qi.improvement_tip ? `<p style="font-size:13px;color:var(--tx2);line-height:1.65">${qi.improvement_tip}</p>` : ''}
      </div>
    </div>

    ${(qi.strong_examples||[]).length ? `
    <div class="card card--success">
      <div class="card-title">💪 Strong Quantified Bullets</div>
      ${qi.strong_examples.map(e=>`<div class="ev-item"><div class="ev-dot ev-dot--green"></div><span>${e}</span></div>`).join('')}
    </div>` : ''}

    ${(qi.weak_examples||[]).length ? `
    <div class="card card--amber" style="margin-top:14px">
      <div class="card-title">📝 Bullets Lacking Evidence</div>
      ${qi.weak_examples.map(e=>`<div class="ev-item"><div class="ev-dot ev-dot--amber"></div><span>${e}</span></div>`).join('')}
    </div>` : ''}
  </div>`;

  animateCount($('impact-num'), 0, score, 1200);
  animateCount($('imp-tot'), 0, qi.total_bullets||0, 800);
  animateCount($('imp-q'), 0, qi.quantified_bullets||0, 800);
  animateCount($('imp-pct'), 0, pct, 900, '%');
  animateRing('impact-ring', score, 100);
}

/* ─────────────────────────────────────────────────────────────
   REAL VS BUZZ
───────────────────────────────────────────────────────────── */
function renderRealVsBuzz(el, a) {
  const cc = a.candidate_classification || {};
  el.innerHTML = `
  <div class="stagger">
    <div class="card card--highlight">
      <div class="card-title">Substance vs Buzz-Word Analysis</div>
      <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
        ${cc.buzz_word_rating ? `<span class="badge badge--${cc.buzz_word_rating==='Substance-Rich'?'green':cc.buzz_word_rating==='Buzz-Heavy'?'red':'amber'} badge-lg">${cc.buzz_word_rating}</span>` : ''}
        ${cc.type ? `<span class="badge badge--${cc.type==='Proven'?'green':cc.type==='High Potential'?'blue':'amber'}">${cc.type}</span>` : ''}
      </div>
      <p style="font-size:13.5px;color:var(--tx1);line-height:1.7">${cc.evidence || 'No classification data available.'}</p>
    </div>

    <div class="grid-2" style="margin-top:14px">
      <div class="card card--success">
        <div class="card-title">✅ Substance Evidence</div>
        ${(cc.substance_examples||[]).map(e=>`<div class="ev-item"><div class="ev-dot ev-dot--green"></div><span>${e}</span></div>`).join('') || '<p style="color:var(--tx3)">No examples provided.</p>'}
      </div>
      <div class="card card--amber">
        <div class="card-title">⚠️ Buzz-Word Examples</div>
        ${(cc.buzz_examples||[]).map(e=>`<div class="ev-item"><div class="ev-dot ev-dot--amber"></div><span>${e}</span></div>`).join('') || '<p style="color:var(--tx3)">No buzz-words detected.</p>'}
      </div>
    </div>
  </div>`;
}

/* ─────────────────────────────────────────────────────────────
   JD MATCH
───────────────────────────────────────────────────────────── */
function renderJDMatch(el, a) {
  const jd = a.jd_match || {};
  const match = jd.match_percentage || 0;
  const matched = jd.matched_skills || [];
  const partial = a.jd_partial_skills || jd.partial_skills || [];
  const missing = jd.missing_skills || jd.gap_skills || [];

  el.innerHTML = `
  <div class="stagger">
    <div style="display:grid;grid-template-columns:auto 1fr;gap:24px;align-items:center;padding:24px 28px;background:var(--bg1);border:1px solid var(--line1);border-radius:var(--r-lg);margin-bottom:20px;">
      <div style="text-align:center">
        <svg viewBox="0 0 100 100" width="110" height="110" style="transform:rotate(-90deg)">
          <circle cx="50" cy="50" r="42" stroke="var(--bg3)" stroke-width="8" fill="none"/>
          <circle id="jd-ring" cx="50" cy="50" r="42" stroke="${jdColor(match)}" stroke-width="8" fill="none"
            stroke-linecap="round" stroke-dasharray="${2*Math.PI*42}" stroke-dashoffset="${2*Math.PI*42}"/>
        </svg>
        <div style="margin-top:-76px;margin-bottom:54px;font-family:var(--fm);font-size:28px;font-weight:500;color:${jdColor(match)}" id="jd-num">0%</div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3)">JD Match</div>
      </div>
      <div>
        <p style="font-size:15px;font-weight:700;color:var(--tx1);margin-bottom:8px">${jd.verdict || (match>=60?'Strong alignment with role requirements':match>=40?'Moderate alignment':'Low alignment — significant gaps identified')}</p>
        <p style="font-size:13px;color:var(--tx2);line-height:1.65">${jd.analysis || jd.summary || '—'}</p>
      </div>
    </div>

    <div class="grid-2">
      <div class="card card--success">
        <div class="card-title">✅ Matched Skills (${matched.length})</div>
        <div class="tag-list">${matched.map(s=>`<span class="tag tag--green">${s}</span>`).join('') || '<span style="color:var(--tx3)">None confirmed</span>'}</div>
      </div>
      <div class="card card--danger">
        <div class="card-title">❌ Missing Skills (${missing.length})</div>
        <div class="tag-list">${missing.map(s=>`<span class="tag tag--red">${s}</span>`).join('') || '<span style="color:var(--tx3)">No gaps identified</span>'}</div>
      </div>
    </div>

    ${partial.length ? `
    <div class="card card--amber" style="margin-top:14px">
      <div class="card-title">⚠️ Partially Matched Skills (surface-level, unverified depth)</div>
      <p style="font-size:12.5px;color:var(--tx3);margin-bottom:10px">These skills appear in the resume but lack demonstrated evidence or measurable outcomes.</p>
      <div class="tag-list">${partial.map(s=>`<span class="tag tag--amber">${s}</span>`).join('')}</div>
    </div>` : ''}
  </div>`;

  animateCount($('jd-num'), 0, match, 1000, '%');
  animateRing('jd-ring', match, 100);
}

/* ─────────────────────────────────────────────────────────────
   RED FLAGS
───────────────────────────────────────────────────────────── */
function renderRedFlags(el, a) {
  const flags = a.red_flags || [];
  el.innerHTML = `
  <div class="stagger">
    <div class="card card--danger">
      <div class="card-title">🚩 Red Flags (${flags.length})</div>
      ${flags.length
        ? flags.map((f,i)=>`
          <div class="ev-item">
            <span class="q-num">${i+1}</span>
            <span>${typeof f === 'string' ? f : f.flag || f.issue || JSON.stringify(f)}</span>
          </div>`).join('')
        : '<p style="color:var(--tx3);font-size:13.5px">No significant red flags detected. This is a positive signal.</p>'
      }
    </div>
  </div>`;
}

/* ─────────────────────────────────────────────────────────────
   QUESTIONS
───────────────────────────────────────────────────────────── */
function renderQuestions(el, questions, title, color) {
  const qs = Array.isArray(questions) ? questions : [];
  el.innerHTML = `
  <div class="stagger">
    <div class="card">
      <div class="card-title">${title} <span class="badge badge--${color}" style="margin-left:6px">${qs.length}</span></div>
      ${qs.length
        ? qs.map((q,i)=>`
          <div class="q-item">
            <span class="q-num">${i+1}</span>
            <span>${typeof q === 'string' ? q : q.question || q.q || JSON.stringify(q)}</span>
          </div>`).join('')
        : '<p style="color:var(--tx3)">No questions generated.</p>'
      }
    </div>
  </div>`;
}

/* ─────────────────────────────────────────────────────────────
   BIAS AUDIT
───────────────────────────────────────────────────────────── */
function renderBias(el, data) {
  const b = data.bias_report || {};
  const score = b.fairness_score || b.bias_risk_score || 0;
  const pii = b.pii_found || b.pii_detected || [];
  const proxies = b.proxy_identifiers || b.potential_proxies || [];
  const recs = b.recommendations || b.mitigation_suggestions || [];

  el.innerHTML = `
  <div class="stagger">
    <div style="display:grid;grid-template-columns:auto 1fr;gap:24px;align-items:center;padding:24px 28px;background:var(--bg1);border:1px solid var(--line1);border-radius:var(--r-lg);margin-bottom:20px">
      <div style="text-align:center">
        <svg viewBox="0 0 100 100" width="110" height="110" style="transform:rotate(-90deg)">
          <circle cx="50" cy="50" r="42" stroke="var(--bg3)" stroke-width="8" fill="none"/>
          <circle id="bias-ring" cx="50" cy="50" r="42" stroke="${scoreColor(score)}" stroke-width="8" fill="none"
            stroke-linecap="round" stroke-dasharray="${2*Math.PI*42}" stroke-dashoffset="${2*Math.PI*42}"/>
        </svg>
        <div style="margin-top:-76px;margin-bottom:54px;font-family:var(--fm);font-size:28px;font-weight:500;color:${scoreColor(score)}" id="bias-num">0</div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3)">Fairness Score</div>
      </div>
      <div>
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
          <span class="badge badge--${pii.length===0?'green':pii.length<3?'amber':'red'}">${pii.length===0?'No PII Found':pii.length+' PII Items'}</span>
          <span class="badge badge--${proxies.length===0?'green':'amber'}">${proxies.length===0?'No Proxies':'Proxy Risk Detected'}</span>
        </div>
        <p style="font-size:13.5px;color:var(--tx1);line-height:1.7">${b.summary || b.overall_assessment || '—'}</p>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">PII Detected (${pii.length})</div>
        ${pii.length
          ? pii.map(item=>`<div class="ev-item"><div class="ev-dot ev-dot--amber"></div><span>${typeof item==='string'?item:item.type+': '+item.value}</span></div>`).join('')
          : '<p style="color:var(--green);font-size:13px">✅ No PII detected in visible resume text.</p>'
        }
      </div>
      <div class="card">
        <div class="card-title">Proxy Identifiers (${proxies.length})</div>
        ${proxies.length
          ? proxies.map(p=>`<div class="ev-item"><div class="ev-dot ev-dot--amber"></div><span>${p}</span></div>`).join('')
          : '<p style="color:var(--green);font-size:13px">✅ No proxy identifiers detected.</p>'
        }
      </div>
    </div>

    ${recs.length ? `
    <div class="card" style="margin-top:14px">
      <div class="card-title">Recommendations</div>
      ${recs.map(r=>`<div class="ev-item"><div class="ev-dot ev-dot--blue"></div><span>${r}</span></div>`).join('')}
    </div>` : ''}
  </div>`;

  animateCount($('bias-num'), 0, score, 1000);
  animateRing('bias-ring', score, 100);
}

/* ─────────────────────────────────────────────────────────────
   COACHING
───────────────────────────────────────────────────────────── */
function renderCoaching(el, data) {
  const c = data.coaching || {};
  const qc = data.analysis?.quantification_coaching || c.quantification_coaching || {};
  const roadmap = c.upskilling_roadmap || c.skills_to_develop || [];
  const strengths = c.strengths_to_leverage || [];
  const rewrites = qc.bullet_rewrites || c.bullet_rewrites || [];
  const letter = data.feedback_letter;

  el.innerHTML = `
  <div class="stagger">
    ${qc.overall_tip ? `
    <div class="card card--highlight">
      <div class="card-title">💡 Coaching Summary</div>
      <p style="font-size:14px;line-height:1.75;color:var(--tx1)">${qc.overall_tip}</p>
    </div>` : ''}

    ${rewrites.length ? `
    <div class="coaching-section">
      <div class="section-title">Bullet Rewrite Coach</div>
      ${rewrites.map(r=>`
        <div class="rewrite-card">
          <div class="rewrite-original">
            <div class="rewrite-label">Original</div>
            <p class="rewrite-text">${r.original || '—'}</p>
          </div>
          <div class="rewrite-improved">
            <div class="rewrite-label">Improved</div>
            <p class="rewrite-text">${r.improved || '—'}</p>
            ${r.why_better ? `<p class="rewrite-why">${r.why_better}</p>` : ''}
          </div>
        </div>`).join('')}
    </div>` : ''}

    ${roadmap.length ? `
    <div class="coaching-section">
      <div class="section-title">Upskilling Roadmap</div>
      ${roadmap.map((item,i)=>`
        <div style="display:flex;gap:14px;padding:12px 14px;background:var(--bg2);border:1px solid var(--line1);border-radius:var(--r-md);margin-bottom:8px;transition:all var(--tq)" onmouseover="this.style.borderColor='var(--line2)'" onmouseout="this.style.borderColor='var(--line1)'">
          <div style="width:24px;height:24px;border-radius:50%;background:var(--brand-dim);border:1.5px solid var(--brand-mid);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:var(--fm);font-size:11px;color:var(--brand)">${i+1}</div>
          <p style="font-size:13.5px;line-height:1.65;color:var(--tx1)">${typeof item==='string'?item:item.skill||item.item||JSON.stringify(item)}</p>
        </div>`).join('')}
    </div>` : ''}

    ${strengths.length ? `
    <div class="coaching-section">
      <div class="section-title">Strengths to Leverage</div>
      ${strengths.map(s=>`<div class="ev-item"><div class="ev-dot ev-dot--green"></div><span>${s}</span></div>`).join('')}
    </div>` : ''}

    ${letter ? `
    <div class="coaching-section">
      <div class="section-title">Candidate Feedback Letter</div>
      <div style="white-space:pre-wrap;font-size:13.5px;line-height:1.8;color:var(--tx1);padding:20px 22px;background:var(--bg2);border:1px solid var(--line2);border-radius:var(--r-md)">${letter}</div>
      <button class="copy-btn" onclick="copyText(\`${letter.replace(/`/g,'\\`')}\`)">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="3" width="7" height="8" rx="1" stroke="currentColor"/><path d="M4 3V2a1 1 0 011-1h5a1 1 0 011 1v7a1 1 0 01-1 1H9" stroke="currentColor"/></svg>
        Copy Letter
      </button>
    </div>` : ''}
  </div>`;
}

/* ─────────────────────────────────────────────────────────────
   OUTREACH
───────────────────────────────────────────────────────────── */
function renderOutreach(el, data) {
  el.innerHTML = `
  <div class="stagger">
    <div class="card">
      <div class="card-title" style="margin-bottom:20px">📧 Recruiter Outreach Generator</div>
      <div class="oa-form">
        <input class="oa-input" id="oa-role" placeholder="Job title (e.g. Senior ML Engineer)" value="">
        <input class="oa-input" id="oa-company" placeholder="Company name" value="">
        <button class="oa-gen-btn" id="oa-gen-btn" onclick="generateOutreach()">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7h12M9 3l4 4-4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Generate Outreach Email
        </button>
      </div>
      <div id="oa-result-wrap" style="display:none">
        <div class="oa-result" id="oa-result"></div>
        <button class="copy-btn" id="oa-copy" onclick="copyText(document.getElementById('oa-result').textContent)">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="3" width="7" height="8" rx="1" stroke="currentColor"/><path d="M4 3V2a1 1 0 011-1h5a1 1 0 011 1v7a1 1 0 01-1 1H9" stroke="currentColor"/></svg>
          Copy to Clipboard
        </button>
      </div>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="card-title" style="margin-bottom:20px">📄 Candidate Feedback Letter Generator</div>
      <div class="oa-form">
        <input class="oa-input" id="fl-role" placeholder="Role applied for" value="">
        <select class="oa-input" id="fl-decision">
          <option value="hire">Hire</option>
          <option value="hold">Hold for future consideration</option>
          <option value="reject">Reject (respectful)</option>
        </select>
        <button class="oa-gen-btn" id="fl-gen-btn" onclick="generateFeedbackLetter()" style="background:var(--brand)">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7h12M9 3l4 4-4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Generate Letter
        </button>
      </div>
      <div id="fl-result-wrap" style="display:none">
        <div class="oa-result" id="fl-result"></div>
        <button class="copy-btn" onclick="copyText(document.getElementById('fl-result').textContent)">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="3" width="7" height="8" rx="1" stroke="currentColor"/><path d="M4 3V2a1 1 0 011-1h5a1 1 0 011 1v7a1 1 0 01-1 1H9" stroke="currentColor"/></svg>
          Copy Letter
        </button>
      </div>
    </div>
  </div>`;
}

async function generateOutreach() {
  const role = $('oa-role').value.trim();
  const company = $('oa-company').value.trim();
  if (!role) { toast('Enter a job title first.', 'err'); return; }
  const btn = $('oa-gen-btn');
  btn.disabled = true; btn.textContent = 'Generating…';
  try {
    const r = await fetchWithRetry(`${API}/generate-outreach`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: reportData.analysis, job_title: role, company_name: company }),
    }, 1, 60000);
    const d = await r.json();
    const text = d.outreach_email || d.email || d.content || JSON.stringify(d);
    $('oa-result').textContent = text;
    $('oa-result-wrap').style.display = 'block';
  } catch (e) { toast(e.message, 'err'); }
  finally { btn.disabled = false; btn.textContent = 'Generate Outreach Email'; }
}

async function generateFeedbackLetter() {
  const role = $('fl-role').value.trim();
  const decision = $('fl-decision').value;
  if (!role) { toast('Enter a role first.', 'err'); return; }
  const btn = $('fl-gen-btn');
  btn.disabled = true; btn.textContent = 'Generating…';
  try {
    const r = await fetchWithRetry(`${API}/generate-feedback-letter`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: reportData.analysis, decision, job_title: role }),
    }, 1, 60000);
    const d = await r.json();
    const text = d.feedback_letter || d.letter || d.content || JSON.stringify(d);
    $('fl-result').textContent = text;
    $('fl-result-wrap').style.display = 'block';
  } catch (e) { toast(e.message, 'err'); }
  finally { btn.disabled = false; btn.textContent = 'Generate Letter'; }
}

/* ─────────────────────────────────────────────────────────────
   RECRUITMENT AGENT: PIPELINE
───────────────────────────────────────────────────────────── */
function renderPipeline(el) {
  const current = pipeline[pipeline.length - 1];
  const others = pipeline.slice(0, -1).reverse();

  el.innerHTML = `
  <div class="stagger">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <div>
        <div class="section-title" style="margin-bottom:4px">Talent Pipeline</div>
        <p style="font-size:13px;color:var(--tx3)">${pipeline.length} candidate${pipeline.length!==1?'s':''} analysed this session</p>
      </div>
      <span class="badge badge--teal">${pipeline.length} total</span>
    </div>

    ${current ? `
    <div class="card card--highlight" style="margin-bottom:16px">
      <div class="card-title" style="color:var(--brand)">📍 Current Candidate</div>
      <div class="pipeline-row" style="padding:0;background:none;border:none;cursor:default">
        <div class="pipeline-avatar">${current.name.charAt(0).toUpperCase()}</div>
        <div class="pipeline-info">
          <div class="pipeline-name">${current.name}</div>
          <div class="pipeline-meta">${current.role} · ${current.yrsExp} yrs exp · Analysed ${new Date(current.ts).toLocaleTimeString()}</div>
        </div>
        <div>
          <div class="pipeline-score" style="color:${scoreColor(current.score)}">${current.score}</div>
          <div class="pipeline-score-lbl">ATS</div>
        </div>
        <div>
          <div class="pipeline-score" style="color:${jdColor(current.jdMatch)}">${current.jdMatch}%</div>
          <div class="pipeline-score-lbl">JD Fit</div>
        </div>
        ${current.decision ? `<span class="badge badge--${current.decision==='hire'?'green':current.decision==='hold'?'amber':'red'}">${current.decision.toUpperCase()}</span>` : '<span class="badge badge--neutral">Undecided</span>'}
      </div>
    </div>` : ''}

    ${others.length ? `
    <div class="section-title">Previous Candidates</div>
    ${others.map((c,i) => `
      <div class="pipeline-row">
        <div class="pipeline-avatar">${c.name.charAt(0).toUpperCase()}</div>
        <div class="pipeline-info">
          <div class="pipeline-name">${c.name}</div>
          <div class="pipeline-meta">${c.role} · ${c.yrsExp} yrs exp · ${new Date(c.ts).toLocaleTimeString()}</div>
        </div>
        <div>
          <div class="pipeline-score" style="color:${scoreColor(c.score)}">${c.score}</div>
          <div class="pipeline-score-lbl">ATS</div>
        </div>
        <div>
          <div class="pipeline-score" style="color:${jdColor(c.jdMatch)}">${c.jdMatch}%</div>
          <div class="pipeline-score-lbl">JD Fit</div>
        </div>
        ${c.decision ? `<span class="badge badge--${c.decision==='hire'?'green':c.decision==='hold'?'amber':'red'}">${c.decision.toUpperCase()}</span>` : '<span class="badge badge--neutral">Undecided</span>'}
      </div>`).join('')}
    ` : (pipeline.length === 0 ? `
    <div class="pipeline-empty">
      <div class="pipeline-empty-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="5" cy="5" r="3" stroke="currentColor" stroke-width="1.3"/><circle cx="5" cy="12" r="3" stroke="currentColor" stroke-width="1.3"/><circle cx="5" cy="19" r="3" stroke="currentColor" stroke-width="1.3"/><path d="M8 5h13M8 12h9M8 19h11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      </div>
      <p style="font-size:14px;font-weight:600;color:var(--tx2);margin-bottom:6px">No candidates yet</p>
      <p style="font-size:13px">Analyse a resume to start building your pipeline.</p>
    </div>` : '')}
  </div>`;
}

/* ─────────────────────────────────────────────────────────────
   RECRUITMENT AGENT: JD GENERATOR
───────────────────────────────────────────────────────────── */
function renderJobGen(el, data) {
  const a = data?.analysis || {};
  el.innerHTML = `
  <div class="stagger">
    <div class="card">
      <div class="card-title" style="margin-bottom:6px">🤖 AI Job Description Generator</div>
      <p style="font-size:13px;color:var(--tx3);margin-bottom:20px">Generate a professional, ATS-optimised job description. Uses current candidate profile as market baseline.</p>
      <div class="jdgen-form">
        <input class="jdgen-input" id="jg-title" placeholder="Job title (e.g. Senior Product Manager)" value="${a.target_role||a.current_role||''}">
        <input class="jdgen-input" id="jg-company" placeholder="Company name (optional)">
        <input class="jdgen-input" id="jg-level" placeholder="Seniority level (e.g. Mid, Senior, Lead, Director)">
        <textarea class="jdgen-input jdgen-textarea" id="jg-reqs" placeholder="Key requirements or focus areas (optional — e.g. Python, fintech, team leadership…)"></textarea>
        <button class="jdgen-btn" id="jg-btn" onclick="runJobGen()">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.5v3M7 9.5v3M1.5 7h3M9.5 7h3M3 3l2 2M9 9l2 2M3 11l2-2M9 5l2-2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>
          Generate Job Description
        </button>
      </div>
      <div id="jg-result-wrap" style="display:none;margin-top:4px">
        <div class="jdgen-result" id="jg-result"></div>
        <button class="copy-btn" style="margin-top:12px" onclick="copyText(document.getElementById('jg-result').textContent)">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="3" width="7" height="8" rx="1" stroke="currentColor"/><path d="M4 3V2a1 1 0 011-1h5a1 1 0 011 1v7a1 1 0 01-1 1H9" stroke="currentColor"/></svg>
          Copy JD
        </button>
      </div>
    </div>
  </div>`;
}

async function runJobGen() {
  const title = $('jg-title').value.trim();
  if (!title) { toast('Enter a job title first.', 'err'); return; }
  const company = $('jg-company').value.trim();
  const level = $('jg-level').value.trim();
  const reqs = $('jg-reqs').value.trim();
  const btn = $('jg-btn');
  btn.disabled = true; btn.textContent = 'Generating…';

  try {
    const prompt = `You are a senior talent acquisition specialist. Write a professional, ATS-optimised job description.

Role: ${title}${company ? `\nCompany: ${company}` : ''}${level ? `\nSeniority: ${level}` : ''}${reqs ? `\nKey requirements/focus: ${reqs}` : ''}

Format as a complete job description with: Overview, Responsibilities (7-10 bullets), Required Qualifications (5-6), Preferred Qualifications (3-4), and a brief company culture note.

Use clear, specific language. Avoid generic clichés. Make it compelling and inclusive.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const d = await response.json();
    const text = d.content?.map(c => c.text || '').join('') || 'Generation failed.';
    $('jg-result').textContent = text;
    $('jg-result-wrap').style.display = 'block';
  } catch (e) {
    toast('JD generation failed: ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = 'Generate Job Description';
  }
}

/* ─────────────────────────────────────────────────────────────
   RECRUITMENT AGENT: HIRE DECISION
───────────────────────────────────────────────────────────── */
function renderDecision(el, data) {
  const a = data?.analysis || {};
  const saved = pipeline[pipeline.length - 1];

  el.innerHTML = `
  <div class="stagger">
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">Make Hire Decision</div>
      <p style="font-size:13px;color:var(--tx3);margin-bottom:20px">Record your hiring decision for <strong style="color:var(--tx1)">${a.name||'this candidate'}</strong> with notes for your team.</p>
      <div class="decision-grid">
        <div class="decision-btn ${currentDecision.type==='hire'?'selected-hire':''}" onclick="selectDecision('hire',this)">
          <div class="decision-btn-icon">✅</div>
          <div class="decision-btn-label" style="color:var(--green)">Hire</div>
          <div class="decision-btn-desc">Move to offer stage</div>
        </div>
        <div class="decision-btn ${currentDecision.type==='hold'?'selected-hold':''}" onclick="selectDecision('hold',this)">
          <div class="decision-btn-icon">⏸️</div>
          <div class="decision-btn-label" style="color:var(--amber)">Hold</div>
          <div class="decision-btn-desc">Keep for future roles</div>
        </div>
        <div class="decision-btn ${currentDecision.type==='pass'?'selected-pass':''}" onclick="selectDecision('pass',this)">
          <div class="decision-btn-icon">❌</div>
          <div class="decision-btn-label" style="color:var(--red)">Pass</div>
          <div class="decision-btn-desc">Not a fit at this time</div>
        </div>
      </div>
      <label class="field-label" style="margin-bottom:8px;margin-top:16px">Notes for your team</label>
      <textarea class="decision-notes" id="decision-notes" placeholder="Add interview notes, concerns, or context for your hiring team…">${currentDecision.notes||''}</textarea>
      <button class="decision-save-btn" onclick="saveDecision()">Save Decision</button>
      <div id="decision-saved" class="decision-saved" style="display:none">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.2"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Decision saved to pipeline
      </div>
    </div>

    <div class="card">
      <div class="card-title">Decision Intelligence</div>
      <div class="grid-2">
        <div>
          <div class="sub-title">ATS Score</div>
          <div style="font-family:var(--fm);font-size:24px;color:${scoreColor(a.ats_scores?.overall||0)}">${a.ats_scores?.overall||'—'}</div>
          <p style="font-size:12px;color:var(--tx3);margin-top:2px">${(a.ats_scores?.overall||0)>=75?'Strong':'Moderate'} candidate</p>
        </div>
        <div>
          <div class="sub-title">Candidate Type</div>
          <div style="margin-top:4px">
            ${a.candidate_classification?.type ? `<span class="badge badge--${a.candidate_classification.type==='Proven'?'green':a.candidate_classification.type==='High Potential'?'blue':'amber'}">${a.candidate_classification.type}</span>` : '<span class="badge badge--neutral">Unknown</span>'}
          </div>
        </div>
      </div>
      <div style="margin-top:14px">
        <div class="sub-title">AI Recommendation</div>
        <p style="font-size:13.5px;color:var(--tx1);line-height:1.65;margin-top:4px">${a.recommendation||a.hiring_recommendation||'No recommendation generated.'}</p>
      </div>
    </div>
  </div>`;
}

function selectDecision(type, btnEl) {
  currentDecision.type = type;
  document.querySelectorAll('.decision-btn').forEach(b => {
    b.classList.remove('selected-hire','selected-hold','selected-pass');
  });
  btnEl.classList.add(`selected-${type}`);
  $('decision-saved').style.display = 'none';
}

function saveDecision() {
  if (!currentDecision.type) { toast('Select a decision first (Hire / Hold / Pass).', 'err'); return; }
  currentDecision.notes = $('decision-notes')?.value || '';
  const p = pipeline[pipeline.length - 1];
  if (p) { p.decision = currentDecision.type; p.notes = currentDecision.notes; }
  $('decision-saved').style.display = 'flex';
  $('decision-saved').style.animation = 'none';
  requestAnimationFrame(() => { $('decision-saved').style.animation = 'screenIn .4s var(--tb) both'; });
  toast('Decision saved ✓', 'ok');
}

/* ─────────────────────────────────────────────────────────────
   COPY HELPER
───────────────────────────────────────────────────────────── */
function copyText(text) {
  navigator.clipboard.writeText(text).then(() => toast('Copied to clipboard ✓', 'ok'));
}

/* ─────────────────────────────────────────────────────────────
   SERVER WAKE + ANALYSIS (with progress ring)
───────────────────────────────────────────────────────────── */
async function startAnalysis() {
  if (!resumeFile) return;
  showScreen('screen-loading');

  const stepIds = ['ls1','ls2','ls3','ls4','ls5','ls6'];
  stepIds.forEach(id => { const el = $(id); if(el){ el.classList.remove('active','done'); }});
  setLoadingProgress(0);

  let cur = 0;
  function advance() {
    if (cur > 0) {
      const prev = $(stepIds[cur - 1]);
      if (prev) { prev.classList.remove('active'); prev.classList.add('done'); }
    }
    if (cur < stepIds.length) {
      const el = $(stepIds[cur]);
      if (el) el.classList.add('active');
      setLoadingProgress((cur / stepIds.length) * 85);
      cur++;
    }
  }
  advance();

  const sub = $('loading-sub-text');
  const msgs = ['Connecting…','Parsing PDF structure…','Running ATS scoring…','Quantifying achievements…','Generating interview pack…','Finalising report…'];
  let timers = [];

  try {
    await wakeServer();
    advance();
    if (sub) sub.textContent = msgs[1];

    const delayTimes = [9000, 17000, 25000, 33000, 40000];
    timers = delayTimes.map((d, i) => setTimeout(() => {
      advance();
      if (sub) sub.textContent = msgs[i + 2] || 'Almost done…';
    }, d));

    const fd = new FormData();
    fd.append('file', resumeFile);
    const jd = $('jd-input').value.trim();
    if (jd) fd.append('job_description', jd);

    const res = await fetchWithRetry(`${API}/analyze`, { method: 'POST', body: fd }, 2, 90000);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.detail || `Server error ${res.status}`);
    }
    reportData = await res.json();
    timers.forEach(clearTimeout);
    setLoadingProgress(100);
    stepIds.forEach(id => { const el = $(id); if(el){ el.classList.remove('active'); el.classList.add('done'); }});
    await delay(500);

    const a = reportData.analysis || {};
    pipeline.push({
      name: a.name || 'Unknown',
      role: a.current_role || a.target_role || '—',
      score: a.ats_scores?.overall ?? 0,
      jdMatch: a.jd_match?.match_percentage ?? 0,
      yrsExp: a.years_experience ?? 0,
      decision: null, notes: '',
      ts: new Date().toISOString(),
    });
    currentDecision = { type: null, notes: '' };

    buildResults(reportData);
    showScreen('screen-results');
  } catch (err) {
    timers.forEach(clearTimeout);
    showScreen('screen-upload');
    const msg = err.message || 'Analysis failed.';
    toast(msg, 'err');
    const hint = $('upload-error-hint');
    if (hint) {
      hint.textContent = msg.includes('wake') || msg.includes('reach') || msg.includes('fetch')
        ? 'Server cold-starting. Wait 30 seconds and try again.'
        : msg;
      hint.classList.remove('hidden');
      setTimeout(() => hint.classList.add('hidden'), 8000);
    }
  }
}
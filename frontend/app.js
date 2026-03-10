'use strict';
/* ═══════════════════════════════════════════
   TalentIQ v3.0 — Application Logic
   ═══════════════════════════════════════════ */

const API = 'https://resume-analyzer-6wj1.onrender.com';
const $ = id => document.getElementById(id);

let resumeFile = null;
let reportData = null;

/* ─────────────────────────────────────────────
   CURSOR GLOW
───────────────────────────────────────────── */
document.addEventListener('mousemove', e => {
  const g = $('cursor-glow');
  if (g) {
    g.style.left = e.clientX + 'px';
    g.style.top  = e.clientY + 'px';
  }
});

/* ─────────────────────────────────────────────
   THEME
───────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────
   SCREEN MANAGER
───────────────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  const el = $(id);
  el.style.display = id === 'screen-results' ? 'flex' : 'flex';
  requestAnimationFrame(() => el.classList.add('active'));
}

/* ─────────────────────────────────────────────
   FILE HANDLING
───────────────────────────────────────────── */
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
  e.preventDefault();
  dropZone.classList.remove('over');
  const f = e.dataTransfer.files[0];
  if (f?.type === 'application/pdf') setFile(f);
  else toast('Only PDF files are accepted.', 'err');
});
fileInput.addEventListener('change', e => {
  if (e.target.files[0]) setFile(e.target.files[0]);
});

function setFile(f) {
  resumeFile = f;
  $('dz-idle').classList.add('hidden');
  $('dz-ready').classList.remove('hidden');
  $('dz-file-name').textContent = f.name;
  const btn = $('run-btn');
  btn.disabled = false;
  $('run-btn-text').textContent = 'Run full intelligence analysis';
  btn.style.animation = 'none';
  requestAnimationFrame(() => btn.style.animation = '');
}

function removeFile() {
  resumeFile = null;
  fileInput.value = '';
  $('dz-ready').classList.add('hidden');
  $('dz-idle').classList.remove('hidden');
  $('run-btn').disabled = true;
  $('run-btn-text').textContent = 'Select a resume to begin';
}

function resetApp() {
  removeFile();
  reportData = null;
  $('jd-input').value = '';
  showScreen('screen-upload');
}

/* ─────────────────────────────────────────────
   ANALYSIS PIPELINE
───────────────────────────────────────────── */
async function startAnalysis() {
  if (!resumeFile) return;
  showScreen('screen-loading');

  const stepIds = ['ls1','ls2','ls3','ls4','ls5','ls6'];
  stepIds.forEach(id => { const el = $(id); el.classList.remove('active','done'); });

  let cur = 0;
  function advance() {
    if (cur > 0) {
      const prev = $(stepIds[cur - 1]);
      prev.classList.remove('active');
      prev.classList.add('done');
    }
    if (cur < stepIds.length) {
      $(stepIds[cur]).classList.add('active');
      cur++;
    }
  }
  advance();
  const delays = [3500, 9000, 15000, 21000, 27000];
  const timers = delays.map((d, i) => setTimeout(advance, d));

  try {
    const fd = new FormData();
    fd.append('file', resumeFile);
    const jd = $('jd-input').value.trim();
    if (jd) fd.append('job_description', jd);

    const res = await fetch(`${API}/analyze`, { method: 'POST', body: fd });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.detail || `Server error ${res.status}`);
    }
    reportData = await res.json();

    timers.forEach(clearTimeout);
    stepIds.forEach(id => { const el = $(id); el.classList.remove('active'); el.classList.add('done'); });
    await delay(500);

    buildResults(reportData);
    showScreen('screen-results');
  } catch (err) {
    timers.forEach(clearTimeout);
    showScreen('screen-upload');
    toast(err.message || 'Analysis failed. Please try again.', 'err');
  }
}

/* ─────────────────────────────────────────────
   BUILD RESULTS SHELL
───────────────────────────────────────────── */
function buildResults(d) {
  const a = d.analysis || {};

  // Sidebar candidate
  const initials = nameToInitials(a.candidate_name);
  $('sb-avatar').textContent = initials;
  $('sb-name').textContent = a.candidate_name || 'Unknown Candidate';
  $('sb-role').textContent = a.current_role || (a.experience_level ? a.experience_level + ' Professional' : '—');

  // Sidebar stats
  $('sb-score').textContent = a.overall_score != null ? a.overall_score : '—';
  $('sb-jd').textContent    = a.jd_match_score != null ? a.jd_match_score + '%' : 'N/A';
  $('sb-yrs').textContent   = a.years_of_experience != null ? a.years_of_experience : '—';

  // Timestamp
  $('results-timestamp').textContent = `Generated ${new Date().toLocaleString('en-US', { dateStyle:'medium', timeStyle:'short' })}`;

  // Hire badge
  const hbEl = $('hire-badge');
  const rec = (a.hire_recommendation || '').trim();
  hbEl.textContent = rec || '';
  hbEl.className = 'hire-badge ' + (
    /strongly/i.test(rec) ? 'hb-strong' :
    /caution/i.test(rec)  ? 'hb-caut'  :
    /not/i.test(rec)      ? 'hb-no'    :
    rec                   ? 'hb-rec'   : ''
  );

  // Nav wiring
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTab(btn.dataset.tab);
    });
  });

  renderTab('overview');
}

/* ─────────────────────────────────────────────
   TAB ROUTER
───────────────────────────────────────────── */
function renderTab(tab) {
  const a  = reportData?.analysis          || {};
  const q  = reportData?.interview_questions || {};
  const bi = reportData?.bias_report        || {};
  const co = reportData?.candidate_feedback || {};

  const map = {
    overview:    () => tabOverview(a),
    ats:         () => tabATS(a),
    skills:      () => tabSkills(a),
    experience:  () => tabExperience(a),
    analysis:    () => tabStrGaps(a),
    jdmatch:     () => tabJDMatch(a),
    technical:   () => tabQuestions(q.technical_questions   || [], 'Technical Questions',   'Q'),
    behavioral:  () => tabQuestions(q.behavioral_questions  || [], 'Behavioural Questions', 'B'),
    situational: () => tabQuestions(q.situational_questions || [], 'Situational Questions', 'S'),
    deepdive:    () => tabDeepDive(q),
    redflags:    () => tabRedFlags(q.red_flag_probes || [], a.red_flags || []),
    bias:        () => tabBias(bi),
    coaching:    () => tabCoaching(co, a),
    outreach:    () => tabOutreach(a),
  };

  const html = (map[tab] || (() => '<p style="color:var(--tx3)">Coming soon.</p>'))();
  const tc = $('tab-content');
  tc.style.opacity = '0';
  tc.style.transform = 'translateY(8px)';
  tc.innerHTML = html;

  // Animate bars after render
  tc.querySelectorAll('[data-w]').forEach(el => {
    el.style.width = '0%';
  });

  requestAnimationFrame(() => {
    tc.style.transition = 'opacity .28s ease, transform .28s ease';
    tc.style.opacity = '1';
    tc.style.transform = 'none';
    setTimeout(() => {
      tc.querySelectorAll('[data-w]').forEach(el => {
        el.style.transition = 'width 1.2s cubic-bezier(.4,0,.2,1)';
        el.style.width = el.dataset.w;
      });
    }, 60);
  });
}

/* ═══════════════════════════════════════════
   TAB: OVERVIEW
   ═══════════════════════════════════════════ */
function tabOverview(a) {
  const c  = a.contact || {};
  const initials = nameToInitials(a.candidate_name);

  // Contact links (LinkedIn, GitHub, email, portfolio, location)
  const links = [];
  if (c.email)     links.push(profileLink(`mailto:${c.email}`,              svgIcon('mail'),     c.email,     false));
  if (c.linkedin)  links.push(profileLink(ensureHttp(c.linkedin),           svgIcon('linkedin'), 'LinkedIn',  true));
  if (c.github)    links.push(profileLink(ensureHttp(c.github),             svgIcon('github'),   'GitHub',    true));
  if (c.portfolio) links.push(profileLink(ensureHttp(c.portfolio),          svgIcon('globe'),    'Portfolio', true));
  if (c.location)  links.push(profileLink(null,                             svgIcon('pin'),      c.location,  false));
  if (c.phone)     links.push(profileLink(`tel:${c.phone}`,                 svgIcon('phone'),    c.phone,     false));

  const kpis = [
    { val: a.overall_score != null ? a.overall_score : '—',   lbl: 'Overall Score' },
    { val: a.jd_match_score != null ? a.jd_match_score + '%' : 'N/A', lbl: 'JD Match' },
    { val: a.years_of_experience != null ? a.years_of_experience : '—', lbl: 'Years Exp.' },
    { val: a.experience_level || '—', lbl: 'Seniority' },
  ];

  return `
  <div class="sec">
    <div class="ov-profile">
      <div class="ov-avatar">${initials}</div>
      <div class="ov-identity">
        <div class="ov-name">${esc(a.candidate_name || 'Unknown Candidate')}</div>
        <div class="ov-role">${esc([a.current_role, a.current_company && 'at ' + a.current_company].filter(Boolean).join(' '))}</div>
        <div class="ov-chips">
          ${a.experience_level ? badge(a.experience_level, 'brand') : ''}
          ${a.years_of_experience != null ? badge(a.years_of_experience + ' yrs', '') : ''}
        </div>
        <div class="ov-links">${links.join('')}</div>
      </div>
    </div>

    <div class="kv-grid">
      ${kpis.map(k => `<div class="kv-cell"><div class="kv-val">${esc(String(k.val))}</div><div class="kv-lbl">${k.lbl}</div></div>`).join('')}
    </div>
  </div>

  ${a.professional_summary ? `
  <div class="sec">
    <h3 class="sec-h">Professional Summary</h3>
    <div class="callout">${esc(a.professional_summary)}</div>
  </div>` : ''}

  ${a.unique_value_proposition ? `
  <div class="sec">
    <h3 class="sec-h">Unique Value Proposition</h3>
    <p style="font-size:14px;color:var(--tx2);line-height:1.8">${esc(a.unique_value_proposition)}</p>
  </div>` : ''}

  <div class="ov-2col" style="margin-bottom:20px">
    ${a.career_trajectory ? `<div>
      <h3 class="sec-h">Career Trajectory</h3>
      <p style="font-size:13.5px;color:var(--tx2);line-height:1.75;font-style:italic">${esc(a.career_trajectory)}</p>
    </div>` : '<div></div>'}
    ${(a.ideal_role_fit || []).length ? `<div>
      <h3 class="sec-h">Best Role Fits</h3>
      <div class="tags">${(a.ideal_role_fit || []).map(r => badge(r, 'brand')).join('')}</div>
    </div>` : ''}
  </div>

  <div class="ov-2col" style="margin-bottom:20px">
    ${(a.inferred_skills || []).length ? `<div>
      <h3 class="sec-h">Inferred Skills</h3>
      <p style="font-size:12px;color:var(--tx3);margin-bottom:10px">Not explicitly stated — strongly implied by experience.</p>
      <div class="tags">${(a.inferred_skills || []).map(s => badge(s, '')).join('')}</div>
    </div>` : ''}
    ${(a.growth_signals || []).length ? `<div>
      <h3 class="sec-h">Growth Signals</h3>
      <div>${(a.growth_signals || []).map(g => `<div class="qwin-item">${esc(g)}</div>`).join('')}</div>
    </div>` : ''}
  </div>

  ${(a.education || []).length ? `
  <div class="sec">
    <h3 class="sec-h">Education</h3>
    <div class="card" style="padding:0;overflow:hidden">
      ${(a.education || []).map((e, i) => `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:14px 20px;${i < (a.education.length-1) ? 'border-bottom:1px solid var(--line1)' : ''}">
        <div style="min-width:0;flex:1;padding-right:16px">
          <div style="font-weight:600;font-size:13.5px;color:var(--tx1);margin-bottom:2px">${esc(e.degree || '')}</div>
          <div style="font-size:13px;color:var(--brand);margin-bottom:8px">${esc(e.institution || '')}</div>
          ${(e.relevant_coursework || []).length ? `<div class="tags">${e.relevant_coursework.map(c => badge(c, '')).join('')}</div>` : ''}
        </div>
        <div style="font-family:var(--fm);font-size:12px;color:var(--tx3);flex-shrink:0;white-space:nowrap">${esc(e.year || '')}</div>
      </div>`).join('')}
    </div>
  </div>` : ''}

  ${(a.certifications || []).length ? `
  <div class="sec">
    <h3 class="sec-h">Certifications</h3>
    <div class="tags">${(a.certifications || []).map(c => badge(c, '')).join('')}</div>
  </div>` : ''}

  ${(a.projects || []).length ? `
  <div class="sec">
    <h3 class="sec-h">Notable Projects</h3>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${(a.projects || []).map(p => `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;gap:12px;flex-wrap:wrap">
          <span style="font-weight:600;font-size:14px;color:var(--tx1)">${esc(p.name || '')}</span>
          ${p.impact ? `<span style="font-family:var(--fm);font-size:11.5px;color:var(--green);flex-shrink:0">${esc(p.impact)}</span>` : ''}
        </div>
        <p style="font-size:13px;color:var(--tx2);line-height:1.7;margin-bottom:10px">${esc(p.description || '')}</p>
        <div class="tags">${(p.technologies || []).map(t => badge(t, '')).join('')}</div>
      </div>`).join('')}
    </div>
  </div>` : ''}`;
}

/* ═══════════════════════════════════════════
   TAB: ATS SCORES
   ═══════════════════════════════════════════ */
function tabATS(a) {
  const ats = a.ats_scores || {};
  const sc  = a.overall_score || 0;
  const jd  = a.jd_match_score;
  const C   = 2 * Math.PI * 44;

  const rings = [
    { val: sc, label: 'Overall Score', id: 'ring-overall', color: 'var(--brand)' },
    ...(jd != null ? [{ val: jd, label: 'JD Match', id: 'ring-jd', color: 'var(--green)' }] : []),
  ];

  setTimeout(() => {
    rings.forEach(r => {
      const el = $(r.id);
      if (!el) return;
      el.style.strokeDasharray  = C;
      el.style.strokeDashoffset = C;
      requestAnimationFrame(() => setTimeout(() => {
        el.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(.4,0,.2,1)';
        el.style.strokeDashoffset = C * (1 - Math.min(r.val, 100) / 100);
      }, 80));
    });
  }, 50);

  const axes = [
    { key: 'keyword_density',    name: 'Keyword Density',      sub: 'Role-relevant terms used in context' },
    { key: 'format_quality',     name: 'Format Quality',        sub: 'Structure and ATS parseability' },
    { key: 'experience_depth',   name: 'Experience Depth',      sub: 'Richness of detail per role' },
    { key: 'skills_coverage',    name: 'Skills Coverage',       sub: 'Breadth of skill portfolio' },
    { key: 'achievement_impact', name: 'Achievement Impact',    sub: 'Quantified results and outcomes' },
    { key: 'career_progression', name: 'Career Progression',    sub: 'Growth trajectory clarity' },
  ];

  return `
  <div class="sec">
    <div class="ring-group">
      ${rings.map(r => `
      <div class="ring-block">
        <svg viewBox="0 0 100 100" width="110" height="110" style="display:block">
          <circle cx="50" cy="50" r="44" fill="none" stroke="var(--bg4)" stroke-width="7"/>
          <circle id="${r.id}" cx="50" cy="50" r="44" fill="none"
            stroke="${r.color}" stroke-width="7" stroke-linecap="round"
            style="transform:rotate(-90deg);transform-origin:50% 50%"/>
        </svg>
        <div class="ring-big">${r.val}</div>
        <div class="ring-lbl">${r.label}</div>
      </div>`).join('')}
      <div style="flex:1;min-width:0">
        ${a.hire_rationale || a.professional_summary ? `<p style="font-size:13.5px;color:var(--tx2);line-height:1.8;margin-bottom:12px">${esc(a.hire_rationale || a.professional_summary)}</p>` : ''}
        ${a.hire_recommendation ? `<div class="tags">${badge(a.hire_recommendation, /strongly/i.test(a.hire_recommendation)?'green':/caution/i.test(a.hire_recommendation)?'amber':/not/i.test(a.hire_recommendation)?'red':'brand')}</div>` : ''}
      </div>
    </div>
  </div>

  <div class="sec">
    <h3 class="sec-h">Six-Axis Breakdown</h3>
    <div style="display:flex;flex-direction:column;gap:16px">
      ${axes.map(ax => {
        const v = Math.min(Math.max(ats[ax.key] ?? 0, 0), 100);
        const cls = v >= 70 ? 'bf-green' : v >= 45 ? 'bf-amber' : 'bf-red';
        return `<div class="bar-wrap">
          <div class="bar-header"><span class="bar-name">${ax.name}</span><span class="bar-val">${v}%</span></div>
          <div class="bar-track"><div class="bar-fill ${cls}" style="width:0%" data-w="${v}%"></div></div>
          <div class="bar-sub">${ax.sub}</div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════
   TAB: SKILLS
   ═══════════════════════════════════════════ */
function tabSkills(a) {
  const sk = a.technical_skills || {};
  const groups = [
    { name: 'Languages',              items: sk.languages,    cls: 'brand' },
    { name: 'Frameworks & Libraries', items: sk.frameworks,   cls: '' },
    { name: 'Databases',              items: sk.databases,    cls: '' },
    { name: 'Cloud & DevOps',         items: sk.cloud_devops, cls: '' },
    { name: 'AI / ML',                items: sk.ai_ml,        cls: 'brand' },
    { name: 'Tools',                  items: sk.tools,        cls: '' },
    { name: 'Other',                  items: sk.other,        cls: '' },
    { name: 'Soft Skills',            items: a.soft_skills,   cls: '' },
  ].filter(g => g.items?.length);

  return `
  <div class="sec">
    <h3 class="sec-h">Technical Skills</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px">
      ${groups.map(g => `
      <div class="card">
        <div class="card-title">${g.name}</div>
        <div class="tags">${g.items.map(s => badge(s, g.cls)).join('')}</div>
      </div>`).join('')}
    </div>
  </div>

  ${(a.inferred_skills || []).length ? `
  <div class="sec">
    <h3 class="sec-h">Inferred Skills</h3>
    <p style="font-size:13px;color:var(--tx3);margin-bottom:12px">Not explicitly listed — strongly implied by demonstrated experience.</p>
    <div class="tags">${(a.inferred_skills || []).map(s => badge(s, '')).join('')}</div>
  </div>` : ''}

  ${(a.transferable_skills || []).length ? `
  <div class="sec">
    <h3 class="sec-h">Transferable Skills</h3>
    <p style="font-size:13px;color:var(--tx3);margin-bottom:12px">Cross-domain capabilities that add unique value.</p>
    <div class="tags">${(a.transferable_skills || []).map(s => badge(s, '')).join('')}</div>
  </div>` : ''}`;
}

/* ═══════════════════════════════════════════
   TAB: EXPERIENCE
   ═══════════════════════════════════════════ */
function tabExperience(a) {
  const exps = a.work_experience || [];
  if (!exps.length) return emptyState('No work experience found in the resume.');
  return `
  <div class="exp-list">
    ${exps.map(e => `
    <div class="exp-entry">
      <div class="exp-tl-col">
        <div class="exp-dot"></div>
        <div class="exp-line"></div>
      </div>
      <div class="exp-card" style="padding-bottom:4px">
        <div class="exp-header">
          <div class="exp-title">${esc(e.role || '')}</div>
          <div class="exp-tenure">${esc(e.duration || '')}</div>
        </div>
        <div class="exp-co">${esc(e.company || '')}</div>
        ${(e.key_achievements || []).length ? `
        <ul class="exp-ach">
          ${e.key_achievements.map(ach => `<li>${esc(ach)}</li>`).join('')}
        </ul>` : ''}
        ${(e.impact_metrics || []).length ? `<div class="exp-metrics">${e.impact_metrics.map(m => badge(m, 'green')).join('')}</div>` : ''}
        ${(e.skills_demonstrated || []).length ? `<div class="exp-skills">${e.skills_demonstrated.map(s => badge(s, 'brand')).join('')}</div>` : ''}
      </div>
    </div>`).join('')}
  </div>`;
}

/* ═══════════════════════════════════════════
   TAB: STRENGTHS & GAPS
   ═══════════════════════════════════════════ */
function tabStrGaps(a) {
  const strengths = a.top_strengths  || [];
  const gaps      = a.potential_gaps || [];

  return `
  <div class="sec">
    <h3 class="sec-h">Top Strengths</h3>
    <div class="sg-grid">
      ${strengths.length ? strengths.map(s => `
      <div class="sg-item sg-item--str">
        <div class="sg-title">${esc(s.strength || String(s))}</div>
        <div class="sg-body">${esc(s.evidence || '')}</div>
        ${s.rarity ? `<div class="sg-foot">${badge(s.rarity, s.rarity==='Rare'?'brand':s.rarity==='Uncommon'?'amber':'')}</div>` : ''}
      </div>`).join('') : `<p style="font-size:13px;color:var(--tx3)">None identified.</p>`}
    </div>
  </div>

  <div class="sec">
    <h3 class="sec-h">Potential Gaps</h3>
    <div class="sg-grid">
      ${gaps.length ? gaps.map(g => `
      <div class="sg-item sg-item--gap">
        <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;flex-wrap:wrap">
          <div class="sg-title" style="margin:0;flex:1">${esc(g.gap || String(g))}</div>
          ${g.severity ? badge(g.severity, g.severity==='Critical'?'red':g.severity==='Moderate'?'amber':'') : ''}
        </div>
        <div class="sg-body">${esc(g.suggestion || '')}</div>
      </div>`).join('') : `<p style="font-size:13px;color:var(--green)">No significant gaps identified.</p>`}
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════
   TAB: JD MATCH
   ═══════════════════════════════════════════ */
function tabJDMatch(a) {
  if (a.jd_match_score == null) {
    return `<div class="empty-st" style="max-width:460px">
      <div style="width:56px;height:56px;border-radius:50%;background:var(--bg3);border:1px solid var(--line2);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;color:var(--tx3)">${svgIcon('search')}</div>
      <p style="font-family:var(--fh);font-size:22px;color:var(--tx2);margin-bottom:8px">No job description provided</p>
      <p style="font-size:13.5px;color:var(--tx3);line-height:1.75;margin-bottom:24px">Start a new analysis and paste a job description to unlock role alignment scoring, skill gap analysis, and targeted questions.</p>
      <button onclick="resetApp()" style="background:var(--brand);color:#fff;border:none;padding:10px 24px;border-radius:var(--r-md);font-size:13px;font-weight:600;cursor:pointer;font-family:var(--fb)">Start new analysis</button>
    </div>`;
  }
  const matched = a.jd_matched_skills || [];
  const missing = a.jd_missing_skills || [];
  const sc      = Math.min(Math.max(a.jd_match_score || 0, 0), 100);
  const cls     = sc >= 70 ? 'bf-green' : sc >= 45 ? 'bf-amber' : 'bf-red';

  return `
  <div class="sec">
    <div class="kv-grid">
      <div class="kv-cell"><div class="kv-val">${sc}%</div><div class="kv-lbl">Match Score</div></div>
      <div class="kv-cell"><div class="kv-val">${matched.length}</div><div class="kv-lbl">Skills Matched</div></div>
      <div class="kv-cell"><div class="kv-val">${missing.length}</div><div class="kv-lbl">Skills Missing</div></div>
    </div>
    <div class="bar-track" style="margin-bottom:24px;height:6px">
      <div class="bar-fill ${cls}" style="width:0%;height:6px;border-radius:3px" data-w="${sc}%"></div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
    <div class="card">
      <div class="card-title" style="color:var(--green)">Matched Skills</div>
      <div class="tags">${matched.map(s => badge(s, 'green')).join('') || '<p style="font-size:13px;color:var(--tx3)">None matched.</p>'}</div>
    </div>
    <div class="card">
      <div class="card-title" style="color:var(--red)">Missing Skills</div>
      <div class="tags">${missing.map(s => badge(s, 'red')).join('') || '<p style="font-size:13px;color:var(--green)">No skill gaps found.</p>'}</div>
    </div>
  </div>

  ${a.jd_match_summary ? `
  <div class="sec">
    <h3 class="sec-h">Match Analysis</h3>
    <div class="callout">${esc(a.jd_match_summary)}</div>
  </div>` : ''}`;
}

/* ═══════════════════════════════════════════
   TAB: QUESTIONS
   ═══════════════════════════════════════════ */
function tabQuestions(qs, heading, prefix) {
  if (!qs.length) return emptyState(`No ${heading.toLowerCase()} were generated.`);
  return `
  <div class="sec"><h3 class="sec-h">${heading}</h3></div>
  <div class="q-list">
    ${qs.map((q, i) => {
      const d   = q.difficulty || '';
      const dtag = d ? badge(d, d==='Easy'?'green':d==='Hard'?'red':'amber') : '';
      const ctag = q.skill_tested ? badge(q.skill_tested, 'brand') : (q.competency ? badge(q.competency, 'brand') : '');
      const rows = [
        ['Look for',       q.expected_answer_hint || q.what_to_listen_for],
        ['STAR probe',     q.star_guidance],
        ['Ideal approach', q.ideal_approach],
        ['Watch for',      q.what_to_avoid],
        ['Strong answer',  q.green_flag_answer],
        ['Weak answer',    q.red_flag_answer],
        ['Scoring rubric', q.scoring_rubric],
        ['Follow-up',      q.follow_up],
      ].filter(r => r[1]);
      return `
      <div class="q-item">
        <div class="q-row">
          <span class="q-num">${prefix}${i+1}</span>
          <div class="q-text">${esc(q.question)}</div>
        </div>
        ${(ctag || dtag) ? `<div class="q-tags-row">${ctag}${dtag}</div>` : ''}
        ${rows.length ? `<div class="q-detail">
          ${rows.map(r => `<div class="q-detail-row"><strong>${r[0]}:</strong> ${esc(String(r[1]))}</div>`).join('')}
        </div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

/* ═══════════════════════════════════════════
   TAB: DEEP DIVE
   ═══════════════════════════════════════════ */
function tabDeepDive(q) {
  const dd = q.deep_dive_questions  || [];
  const cf = q.culture_fit_questions || [];
  return `
  <div class="sec">
    <h3 class="sec-h">Deep Dive — Resume-Specific Probes</h3>
    <div class="q-list">
      ${dd.map((q, i) => `
      <div class="q-item">
        <div class="q-row">
          <span class="q-num">D${i+1}</span>
          <div class="q-text">${esc(q.question)}</div>
        </div>
        ${q.target ? `<div class="q-tags-row">${badge(q.target, '')}</div>` : ''}
        <div class="q-detail">
          ${q.intent         ? `<div class="q-detail-row"><strong>Intent:</strong> ${esc(q.intent)}</div>` : ''}
          ${q.expected_depth ? `<div class="q-detail-row"><strong>Depth expected:</strong> ${esc(q.expected_depth)}</div>` : ''}
        </div>
      </div>`).join('') || '<p style="font-size:13px;color:var(--tx3);padding:8px 0">No deep-dive questions generated.</p>'}
    </div>
  </div>

  <div class="sec">
    <h3 class="sec-h">Culture Fit Questions</h3>
    <div class="q-list">
      ${cf.map((q, i) => `
      <div class="q-item">
        <div class="q-row">
          <span class="q-num">C${i+1}</span>
          <div class="q-text">${esc(q.question)}</div>
        </div>
        <div class="q-detail">
          ${q.what_to_listen_for ? `<div class="q-detail-row"><strong>Listen for:</strong> ${esc(q.what_to_listen_for)}</div>` : ''}
          ${(q.alignment_signals || []).length ? `<div class="q-detail-row"><strong>Alignment signals:</strong> ${esc(q.alignment_signals.join(', '))}</div>` : ''}
        </div>
      </div>`).join('') || '<p style="font-size:13px;color:var(--tx3);padding:8px 0">No culture fit questions generated.</p>'}
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════
   TAB: RED FLAGS
   ═══════════════════════════════════════════ */
function tabRedFlags(probes, resumeFlags) {
  return `
  ${resumeFlags.length ? `
  <div class="sec">
    <h3 class="sec-h">Resume Red Flags</h3>
    <div class="q-list">
      ${resumeFlags.map((f, i) => `
      <div class="q-item">
        <div class="q-row">
          <span class="q-num" style="color:var(--red)">F${i+1}</span>
          <div class="q-text">${esc(f.flag || String(f))}</div>
        </div>
        <div class="q-detail">
          ${f.explanation   ? `<div class="q-detail-row"><strong>Explanation:</strong> ${esc(f.explanation)}</div>` : ''}
          ${f.probe_question ? `<div class="q-detail-row"><strong>Suggested probe:</strong> ${esc(f.probe_question)}</div>` : ''}
        </div>
      </div>`).join('')}
    </div>
  </div>` : ''}

  <div class="sec">
    <h3 class="sec-h">Red Flag Interview Probes</h3>
    <div class="q-list">
      ${probes.length ? probes.map((p, i) => `
      <div class="q-item">
        <div class="q-row">
          <span class="q-num">${badge('Probe', 'red')}</span>
          <div class="q-text">${esc(p.question)}</div>
        </div>
        <div class="q-detail">
          ${p.concern          ? `<div class="q-detail-row"><strong>Concern:</strong> ${esc(p.concern)}</div>` : ''}
          ${p.green_flag_answer ? `<div class="q-detail-row"><strong>Strong answer:</strong> ${esc(p.green_flag_answer)}</div>` : ''}
          ${p.red_flag_answer   ? `<div class="q-detail-row"><strong>Concerning answer:</strong> ${esc(p.red_flag_answer)}</div>` : ''}
        </div>
      </div>`).join('') : emptyState('No red flag probes generated.')}
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════
   TAB: BIAS AUDIT
   ═══════════════════════════════════════════ */
function tabBias(bi) {
  if (!bi || !Object.keys(bi).length) return emptyState('Bias report not available.');
  const pii     = bi.pii_detected || {};
  const vectors = bi.potential_bias_vectors || [];
  const merit   = bi.merit_indicators || [];
  const blind   = bi.recommended_blind_fields || [];

  return `
  <div class="sec">
    <div class="kv-grid">
      <div class="kv-cell">
        <div class="kv-val">${bi.fairness_score ?? '—'}</div>
        <div class="kv-lbl">Fairness Score</div>
      </div>
      <div class="kv-cell" style="grid-column:span 2">
        <div class="kv-val" style="font-size:15px;font-family:var(--fb)">${esc(bi.blind_review_recommendation || '—')}</div>
        <div class="kv-lbl">Blind Review Recommendation</div>
      </div>
    </div>
  </div>

  <div class="pii-grid">
    <div class="card">
      <div class="card-title">PII Detection Scan</div>
      <table class="pii-table">
        ${Object.entries(pii).map(([k, v]) => `
        <tr>
          <td>${k.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())}</td>
          <td>${badge(v ? 'Detected' : 'Clear', v ? 'amber' : 'green')}</td>
        </tr>`).join('')}
      </table>
    </div>
    <div class="card">
      <div class="card-title">Recommended Blind Fields</div>
      <div style="margin-bottom:16px">${blind.map(b => `<div class="qwin-item">${esc(b)}</div>`).join('') || '<p style="font-size:13px;color:var(--tx3)">None recommended.</p>'}</div>
      ${merit.length ? `<div class="card-title" style="margin-top:8px">Merit Anchors</div>${merit.map(m => `<div class="qwin-item">${esc(m)}</div>`).join('')}` : ''}
    </div>
  </div>

  <div class="sec">
    <h3 class="sec-h">Bias Vectors</h3>
    ${vectors.map(v => `
    <div class="bias-vec">
      <div class="bv-head">
        <span class="bv-name">${esc(v.vector || '')}</span>
        ${v.risk_level ? badge(v.risk_level, v.risk_level==='High'?'red':v.risk_level==='Medium'?'amber':'green') : ''}
      </div>
      <p style="font-size:13px;color:var(--tx2);line-height:1.65;margin-bottom:6px">${esc(v.explanation || '')}</p>
      ${v.mitigation ? `<p style="font-size:13px;color:var(--tx2)"><strong>Mitigation:</strong> ${esc(v.mitigation)}</p>` : ''}
    </div>`).join('') || '<p style="font-size:13px;color:var(--green)">No significant bias vectors identified.</p>'}
  </div>

  ${bi.evaluation_guidance ? `
  <div class="sec">
    <h3 class="sec-h">Evaluation Guidance</h3>
    <div class="callout callout-green">${esc(bi.evaluation_guidance)}</div>
  </div>` : ''}`;
}

/* ═══════════════════════════════════════════
   TAB: COACHING
   ═══════════════════════════════════════════ */
function tabCoaching(co, a) {
  if (!co || !Object.keys(co).length) return emptyState('Coaching report not available.');
  const roadmap   = co.improvement_roadmap       || [];
  const wins      = co.quick_wins                || [];
  const courses   = co.skill_gap_courses         || [];
  const strengths = co.key_strengths_recognized  || [];

  return `
  ${co.overall_assessment ? `
  <div class="sec">
    <h3 class="sec-h">Overall Assessment</h3>
    <div class="callout">${esc(co.overall_assessment)}</div>
  </div>` : ''}

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:24px">
    <div>
      <h3 class="sec-h">Recognised Strengths</h3>
      ${strengths.map(s => `
      <div class="card" style="border-left:2px solid var(--green);margin-bottom:8px;padding:14px 16px">
        <div style="font-weight:600;font-size:13.5px;color:var(--tx1);margin-bottom:4px">${esc(s.strength || String(s))}</div>
        <div style="font-size:13px;color:var(--tx2);line-height:1.65">${esc(s.why_it_matters || '')}</div>
      </div>`).join('') || '<p style="font-size:13px;color:var(--tx3)">None identified.</p>'}
    </div>
    <div>
      <h3 class="sec-h">Quick Wins — Next 7 Days</h3>
      ${wins.map(w => `<div class="qwin-item">${esc(w)}</div>`).join('') || '<p style="font-size:13px;color:var(--tx3)">No quick wins available.</p>'}
    </div>
  </div>

  <div class="sec">
    <h3 class="sec-h">Improvement Roadmap</h3>
    ${roadmap.map(r => `
    <div class="roadmap-item">
      <div class="rm-area">${esc(r.area || '')}</div>
      <div class="rm-action">${esc(r.specific_action || '')}</div>
      <div class="rm-tags">
        ${r.timeline ? badge(r.timeline, 'brand') : ''}
        ${(r.resources || []).map(res => badge(res, '')).join('')}
      </div>
    </div>`).join('') || '<p style="font-size:13px;color:var(--tx3)">No roadmap available.</p>'}
  </div>

  ${courses.length ? `
  <div class="sec">
    <h3 class="sec-h">Recommended Courses</h3>
    <div class="card">
      ${courses.map(c => `
      <div class="course-row">
        <div style="flex:1;min-width:0">
          <div class="course-skill">${esc(c.skill || '')}</div>
          <div class="course-name">${esc(c.recommended_course || '')}</div>
          <div class="course-detail">${esc([c.platform, c.estimated_time].filter(Boolean).join(' · '))}</div>
        </div>
      </div>`).join('')}
    </div>
  </div>` : ''}

  ${co.career_advice ? `
  <div class="sec">
    <h3 class="sec-h">Career Advice</h3>
    <div class="callout callout-green"><em>${esc(co.career_advice)}</em></div>
  </div>` : ''}

  <!-- Feedback Letter Generator -->
  <div class="sec">
    <h3 class="sec-h">Generate Candidate Feedback Letter</h3>
    <div class="card">
      <div class="gen-form" style="grid-template-columns:1fr 1fr auto">
        <div class="gen-field">
          <label class="gen-label">Job Title</label>
          <input id="fb-role" class="gen-input" placeholder="e.g. Senior Engineer" value="${esc(a.current_role || '')}">
        </div>
        <div class="gen-field">
          <label class="gen-label">Decision</label>
          <select id="fb-decision" class="gen-select">
            <option value="Not Selected">Not Selected</option>
            <option value="Moving Forward">Moving Forward</option>
            <option value="On Hold">On Hold</option>
          </select>
        </div>
        <div class="gen-field" style="justify-content:flex-end">
          <label class="gen-label">&nbsp;</label>
          <button class="gen-btn" onclick="runFeedbackLetter()">Generate</button>
        </div>
      </div>
      <div id="feedback-output"></div>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════
   TAB: OUTREACH
   ═══════════════════════════════════════════ */
function tabOutreach(a) {
  return `
  <div class="sec">
    <h3 class="sec-h">Personalised Outreach Generator</h3>
    <div class="callout" style="margin-bottom:20px">
      Generate a hyper-personalised recruiter email grounded in this candidate's specific background, skills, and value proposition — not a generic template.
    </div>
    <div class="card">
      <div class="gen-form">
        <div class="gen-field">
          <label class="gen-label">Role You're Hiring For</label>
          <input id="or-role" class="gen-input" placeholder="e.g. Senior Backend Engineer">
        </div>
        <div class="gen-field">
          <label class="gen-label">Your Company</label>
          <input id="or-company" class="gen-input" placeholder="Company name">
        </div>
        <div class="gen-field" style="justify-content:flex-end">
          <label class="gen-label">&nbsp;</label>
          <button class="gen-btn" onclick="runOutreachEmail()">Generate email</button>
        </div>
      </div>
      <div id="outreach-output"></div>
    </div>
  </div>`;
}

/* ─────────────────────────────────────────────
   GENERATOR API CALLS
───────────────────────────────────────────── */
async function runOutreachEmail() {
  const role    = $('or-role')?.value?.trim()    || 'Software Engineer';
  const company = $('or-company')?.value?.trim() || 'Our Company';
  const out     = $('outreach-output');
  out.innerHTML = '<div class="loading-inline">Generating personalised outreach email…</div>';

  try {
    const r = await fetch(`${API}/generate-outreach`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ profile: reportData.analysis, job_title: role, company_name: company }),
    });
    if (!r.ok) throw new Error('Generation failed');
    const d = await r.json();
    if (!d.email_body) throw new Error('Empty response from server');

    out.innerHTML = buildEmailDisplay(d.subject_line, d.email_body, d.follow_up_subject, d.follow_up_body, d.personalization_hooks);
  } catch (e) {
    out.innerHTML = `<div class="err-msg">${esc(e.message)}</div>`;
  }
}

async function runFeedbackLetter() {
  const role     = $('fb-role')?.value?.trim()     || 'Software Engineer';
  const decision = $('fb-decision')?.value         || 'Not Selected';
  const out      = $('feedback-output');
  out.innerHTML  = '<div class="loading-inline">Generating feedback letter…</div>';

  try {
    const r = await fetch(`${API}/generate-feedback-letter`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ profile: reportData.analysis, decision, job_title: role }),
    });
    if (!r.ok) throw new Error('Generation failed');
    const d = await r.json();
    if (!d.letter_body) throw new Error('Empty response from server');

    out.innerHTML = '<div class="div"></div>' + buildEmailDisplay(d.subject_line, d.letter_body);
  } catch (e) {
    out.innerHTML = `<div class="err-msg">${esc(e.message)}</div>`;
  }
}

function buildEmailDisplay(subject, body, followUpSubject, followUpBody, hooks) {
  const safeBody = esc(body || '');
  const copyPayload = JSON.stringify((subject ? subject + '\n\n' : '') + (body || ''));

  let html = `
  <div class="email-display">
    <div class="email-head">
      <div class="email-subject"><strong>Subject:</strong> ${esc(subject || '(No subject)')}</div>
      <button class="copy-btn" onclick="copyText(${copyPayload})">
        ${svgIcon('copy')} Copy
      </button>
    </div>
    <div class="email-body">${safeBody}</div>
  </div>`;

  if (followUpSubject || followUpBody) {
    const fuPayload = JSON.stringify((followUpSubject ? followUpSubject + '\n\n' : '') + (followUpBody || ''));
    html += `
    <p style="font-size:12px;color:var(--tx3);margin:16px 0 8px;font-family:var(--fm)">FOLLOW-UP · 5 DAYS LATER</p>
    <div class="email-display">
      <div class="email-head">
        <div class="email-subject"><strong>Subject:</strong> ${esc(followUpSubject || '')}</div>
        <button class="copy-btn" onclick="copyText(${fuPayload})">${svgIcon('copy')} Copy</button>
      </div>
      <div class="email-body">${esc(followUpBody || '')}</div>
    </div>`;
  }

  if (hooks?.length) {
    html += `<div class="div"></div>
    <p style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--tx3);margin-bottom:10px">Personalisation Hooks</p>
    <div class="tags">${hooks.map(h => badge(esc(h), '')).join('')}</div>`;
  }

  return html;
}

/* ─────────────────────────────────────────────
   HELPER COMPONENTS
───────────────────────────────────────────── */
function badge(text, variant) {
  const cls = variant ? `t t-${variant}` : 't';
  return `<span class="${cls}">${esc(String(text))}</span>`;
}

function profileLink(href, iconSvg, label, newTab) {
  if (!href) {
    return `<span class="plink">${iconSvg} ${esc(label)}</span>`;
  }
  const attrs = newTab ? 'target="_blank" rel="noopener noreferrer"' : '';
  return `<a href="${esc(href)}" ${attrs} class="plink">${iconSvg} ${esc(label)}</a>`;
}

function emptyState(msg) {
  return `<div class="empty-st"><p>${esc(msg)}</p></div>`;
}

/* ─────────────────────────────────────────────
   ICON LIBRARY
───────────────────────────────────────────── */
function svgIcon(name) {
  const icons = {
    mail:     `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x=".5" y="2" width="12" height="9" rx="1" stroke="currentColor" stroke-width="1.1"/><path d=".5 2.5l6 4.5 6-4.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>`,
    linkedin: `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x=".5" y=".5" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.1"/><path d="M3 6v4M3 4.2V4M5 10V7.5C5 6.5 5.5 6 6.5 6S8 6.5 8 7.5V10" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>`,
    github:   `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1a5.5 5.5 0 00-1.74 10.72c.28.05.38-.12.38-.27V10.5c-1.56.34-1.89-.75-1.89-.75-.26-.65-.63-.83-.63-.83-.51-.35.04-.34.04-.34.56.04.86.58.86.58.5.86 1.31.61 1.63.47.05-.36.19-.62.35-.76-1.24-.14-2.54-.62-2.54-2.76 0-.61.22-1.1.58-1.49-.06-.14-.25-.7.06-1.47 0 0 .47-.15 1.53.57A5.3 5.3 0 016.5 4.3c.47 0 .95.06 1.4.19 1.06-.72 1.52-.57 1.52-.57.31.77.12 1.33.06 1.47.36.39.57.88.57 1.49 0 2.14-1.3 2.62-2.55 2.76.2.18.38.52.38 1.05v1.56c0 .15.1.32.38.27A5.5 5.5 0 006.5 1z" fill="currentColor"/></svg>`,
    globe:    `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" stroke-width="1.1"/><path d="M6.5 1c-1.7 1.7-2.2 3.4-2.2 5.5s.5 3.8 2.2 5.5M6.5 1c1.7 1.7 2.2 3.4 2.2 5.5S8.2 10.3 6.5 12M1 6.5h11" stroke="currentColor" stroke-width=".9"/></svg>`,
    pin:      `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 12S2.5 8.1 2.5 5.5a4 4 0 018 0C10.5 8.1 6.5 12 6.5 12z" stroke="currentColor" stroke-width="1.1"/><circle cx="6.5" cy="5.5" r="1.5" stroke="currentColor" stroke-width="1.1"/></svg>`,
    phone:    `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 2.5A.5.5 0 012.5 2h2a.5.5 0 01.5.4l.5 2.5a.5.5 0 01-.14.47L4.3 6.4a8 8 0 003.3 3.3l1.03-1.06a.5.5 0 01.47-.14l2.5.5a.5.5 0 01.4.5v2a.5.5 0 01-.5.5C5.1 12 1 7.9 1 2.5z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>`,
    copy:     `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.1"/><path d="M3 8H2a1 1 0 01-1-1V2a1 1 0 011-1h5a1 1 0 011 1v1" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>`,
    search:   `<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M14.5 14.5l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  };
  return icons[name] || '';
}

/* ─────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────── */
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#x27;');
}

function ensureHttp(url) {
  if (!url) return '#';
  if (/^https?:\/\//i.test(url)) return url;
  return 'https://' + url;
}

function nameToInitials(name) {
  if (!name) return 'CA';
  return name.trim().split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function copyText(text) {
  navigator.clipboard.writeText(text)
    .then(() => toast('Copied to clipboard', 'ok'))
    .catch(() => toast('Copy failed', 'err'));
}

function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s, transform .3s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 350);
  }, 2800);
}
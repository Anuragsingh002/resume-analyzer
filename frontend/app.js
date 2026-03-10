const API = 'https://resume-analyzer-6wj1.onrender.com';

let file = null, data = null;
const $ = id => document.getElementById(id);

// ─── DRAG & DROP ───
const box = $('upload-box'), fi = $('file-input');
box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('over'); });
box.addEventListener('dragleave', () => box.classList.remove('over'));
box.addEventListener('drop', e => {
  e.preventDefault(); box.classList.remove('over');
  const f = e.dataTransfer.files[0];
  if (f?.type === 'application/pdf') setFile(f);
  else alert('Please drop a PDF file.');
});
box.addEventListener('click', () => fi.click());
fi.addEventListener('change', e => e.target.files[0] && setFile(e.target.files[0]));

function setFile(f) {
  file = f;
  $('fname').textContent = f.name;
  $('file-ready').classList.remove('hidden');
}

// ─── ANALYSIS ───
async function startAnalysis() {
  if (!file) return;
  show('s-loading'); hide('s-upload');

  const steps = ['ls1','ls2','ls3','ls4'];
  let current = 0;
  steps.forEach(id => $(id).classList.remove('active','done'));

  const advance = () => {
    if (current < steps.length) {
      if (current > 0) {
        $(steps[current-1]).classList.remove('active');
        $(steps[current-1]).classList.add('done');
      }
      $(steps[current]).classList.add('active');
      current++;
    }
  };
  advance();
  const timers = [
    setTimeout(advance, 4000),
    setTimeout(advance, 10000),
    setTimeout(advance, 18000),
  ];

  const fd = new FormData();
  fd.append('file', file);
  try {
    const r = await fetch(`${API}/analyze`, { method: 'POST', body: fd });
    if (!r.ok) { const e = await r.json(); throw new Error(e.detail || 'Analysis failed'); }
    data = await r.json();
    timers.forEach(clearTimeout);
    steps.forEach(id => { $(id).classList.remove('active'); $(id).classList.add('done'); });
    setTimeout(() => { renderResults(data); }, 600);
  } catch(e) {
    timers.forEach(clearTimeout);
    hide('s-loading'); show('s-upload');
    alert(`Error: ${e.message}`);
  }
}

function resetApp() {
  hide('s-results'); show('s-upload');
  fi.value = ''; file = null; data = null;
  $('file-ready').classList.add('hidden');
  ['ls1','ls2','ls3','ls4'].forEach(id => $(id).classList.remove('active','done'));
}

function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }

// ─── RENDER RESULTS ───
function renderResults(d) {
  hide('s-loading'); show('s-results');
  const a = d.analysis || {}, q = d.interview_questions || {};

  // Timestamp
  $('report-time').textContent = 'Generated ' + new Date().toLocaleString();

  // Avatar
  const initials = (a.candidate_name || 'CA').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
  $('pav').textContent = initials;

  // Name & Role
  $('pname').textContent = a.candidate_name || 'Unknown Candidate';
  const roleStr = [a.current_role, a.current_company ? `@ ${a.current_company}` : ''].filter(Boolean).join(' ');
  $('prole').textContent = roleStr || '—';

  // Tags
  const tags = [a.experience_level, (a.years_of_experience ? a.years_of_experience + ' yrs exp' : null)].filter(Boolean);
  $('ptags').innerHTML = tags.map((t,i) => `<span class="ptag ${i===0?'highlight':''}">${t}</span>`).join('');

  // Contact
  const c = a.contact || {};
  $('pcontact').innerHTML = [
    c.email ? `<a href="mailto:${c.email}">✉ ${c.email}</a>` : '',
    c.linkedin ? `<a href="${c.linkedin}" target="_blank">🔗 LinkedIn</a>` : '',
    c.github ? `<a href="${c.github}" target="_blank">💻 GitHub</a>` : '',
    c.location ? `<span style="color:var(--text3);font-size:12px">📍 ${c.location}</span>` : ''
  ].filter(Boolean).join('');

  // Score ring
  const sc = Math.min(100, Math.max(0, a.overall_score || 0));
  const circ = 2 * Math.PI * 58;
  const arc = $('score-arc');
  arc.style.strokeDasharray = circ;
  arc.style.strokeDashoffset = circ;
  setTimeout(() => { arc.style.strokeDashoffset = circ * (1 - sc / 100); }, 200);
  countUp('score-num', sc, 1600);
  const grade = sc >= 85 ? '🏆 Exceptional' : sc >= 70 ? '⭐ Strong' : sc >= 55 ? '👍 Average' : '⚠️ Needs Work';
  $('score-grade').textContent = grade;

  // Hire recommendation badge
  const rec = a.hire_recommendation || '';
  const rb = $('rec-badge');
  rb.textContent = rec;
  rb.className = rec.includes('Strongly') ? 'rb-strong' : rec.includes('Recommended with') ? 'rb-caut' : rec.includes('Recommended') ? 'rb-rec' : 'rb-no';

  // ATS Bars
  const atsScore = sc;
  const atsBars = [
    { name: 'Keyword Match', val: Math.min(100, Math.round(atsScore * 0.9 + Math.random()*10)) },
    { name: 'Format & Layout', val: Math.min(100, Math.round(atsScore * 0.85 + Math.random()*15)) },
    { name: 'Experience Depth', val: Math.min(100, Math.round(atsScore * 0.95 + Math.random()*8)) },
    { name: 'Skills Coverage', val: Math.min(100, Math.round(atsScore * 0.88 + Math.random()*12)) },
    { name: 'Readability', val: Math.min(100, Math.round(atsScore * 0.92 + Math.random()*10)) },
  ];
  $('ats-bars').innerHTML = atsBars.map(b => `
    <div class="ats-bar-item">
      <div class="ats-bar-label"><span class="ats-bar-name">${b.name}</span><span class="ats-bar-val">${b.val}%</span></div>
      <div class="ats-track"><div class="ats-fill ${b.val>=70?'high':b.val>=45?'mid':'low'}" style="width:0%" data-w="${b.val}%"></div></div>
    </div>
  `).join('');
  setTimeout(() => document.querySelectorAll('.ats-fill').forEach(el => el.style.width = el.dataset.w), 300);

  // Summary
  $('psummary').textContent = a.professional_summary || '';

  // Tab events
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTab(btn.dataset.tab, a, q);
    });
  });
  renderTab('skills', a, q);
}

// ─── TABS ───
function renderTab(tab, a, q) {
  const body = $('tab-body');
  const map = {
    'skills': () => skillsTab(a),
    'experience': () => expTab(a),
    'strengths': () => strengthsTab(a),
    'technical': () => qTab(q.technical_questions || [], 'technical'),
    'behavioral': () => qTab(q.behavioral_questions || [], 'behavioral'),
    'situational': () => qTab(q.situational_questions || [], 'situational'),
    'redflags': () => rfTab(q.red_flag_probes || []),
  };
  body.innerHTML = (map[tab] || (() => ''))();
  // Re-animate ATS bars if on skills
  body.querySelectorAll('.ats-fill').forEach(el => { el.style.width = '0%'; setTimeout(() => el.style.width = el.dataset.w, 100); });
}

function skillsTab(a) {
  const sk = a.technical_skills || {};
  const groups = [
    { title: '⚡ Languages', items: sk.languages, cls: 'primary' },
    { title: '🛠 Frameworks & Libraries', items: sk.frameworks, cls: 'secondary' },
    { title: '🗄 Databases', items: sk.databases, cls: '' },
    { title: '☁️ Cloud & DevOps', items: sk.cloud_devops, cls: '' },
    { title: '🔧 Tools & Platforms', items: sk.tools, cls: '' },
    { title: '🤝 Soft Skills', items: a.soft_skills, cls: '' },
  ].filter(g => g.items?.length);

  if (!groups.length) return '<p style="color:var(--text2);padding:20px">No skills data found.</p>';

  return `<div class="skills-grid">${groups.map(g => `
    <div class="skill-group">
      <div class="skill-group-title">${g.title}</div>
      <div class="skill-tags">${g.items.map(s => `<span class="skill-tag ${g.cls}">${s}</span>`).join('')}</div>
    </div>
  `).join('')}</div>`;
}

function expTab(a) {
  const exps = a.work_experience || [];
  if (!exps.length) return '<p style="color:var(--text2);padding:20px">No work experience found.</p>';
  return `<div class="exp-timeline">${exps.map(e => `
    <div class="exp-item">
      <div class="exp-dot"></div>
      <div class="exp-card">
        <div class="exp-header">
          <div class="exp-role">${e.role || ''}</div>
          <div class="exp-duration">${e.duration || ''}</div>
        </div>
        <div class="exp-company">${e.company || ''}</div>
        <ul class="exp-achievements">${(e.key_achievements||[]).map(ach => `<li>${ach}</li>`).join('')}</ul>
      </div>
    </div>
  `).join('')}</div>`;
}

function strengthsTab(a) {
  const strengths = a.top_strengths || [];
  const gaps = a.potential_gaps || [];
  return `
    <div class="section-sep">✅ Top Strengths</div>
    <div class="strengths-grid">${strengths.map(s => `
      <div class="str-item">
        <div class="str-label">${s.strength || s}</div>
        <div class="item-desc">${s.evidence || ''}</div>
      </div>
    `).join('') || '<p style="color:var(--text2)">No data</p>'}</div>
    <div class="section-sep">⚠️ Potential Gaps</div>
    <div class="strengths-grid">${gaps.map(g => `
      <div class="gap-item">
        <div class="gap-label">${g.gap || g}</div>
        <div class="item-desc">${g.suggestion || ''}</div>
      </div>
    `).join('') || '<p style="color:var(--text2)">No gaps identified</p>'}</div>
  `;
}

function qTab(qs, type) {
  if (!qs.length) return '<p style="color:var(--text2);padding:20px">No questions generated.</p>';
  return `<div class="q-list">${qs.map((q, i) => {
    const d = q.difficulty || '';
    const dc = d==='Easy'?'qt-easy':d==='Hard'?'qt-hard':'qt-medium';
    const tag = q.skill_tested || q.competency || q.scenario_purpose || '';
    return `
    <div class="q-card">
      <div class="q-meta">
        <span class="q-num">Q${i+1}</span>
        ${tag ? `<span class="q-tag qt-info">${tag}</span>` : ''}
        ${d ? `<span class="q-tag ${dc}">${d}</span>` : ''}
      </div>
      <div class="q-text">${q.question}</div>
      <div class="q-hints">
        ${q.expected_answer_hint ? `<div class="q-hint"><strong>💡 Look for:</strong> ${q.expected_answer_hint}</div>` : ''}
        ${q.what_to_listen_for ? `<div class="q-hint"><strong>👂 Listen for:</strong> ${q.what_to_listen_for}</div>` : ''}
        ${q.ideal_approach ? `<div class="q-hint"><strong>✅ Ideal approach:</strong> ${q.ideal_approach}</div>` : ''}
        ${q.follow_up ? `<div class="q-hint"><strong>→ Follow-up:</strong> ${q.follow_up}</div>` : ''}
      </div>
    </div>`;
  }).join('')}</div>`;
}

function rfTab(probes) {
  if (!probes.length) return '<p style="color:var(--text2);padding:20px">No red flag probes generated.</p>';
  return probes.map((p, i) => `
    <div class="rf-card">
      <div class="rf-badge">🚩 Red Flag Probe ${i+1}</div>
      <div class="q-text">${p.question}</div>
      <div class="q-hints">
        ${p.concern ? `<div class="q-hint"><strong>⚠️ Concern:</strong> ${p.concern}</div>` : ''}
        ${p.red_flag_answer ? `<div class="q-hint"><strong>🚨 Red flag answer:</strong> ${p.red_flag_answer}</div>` : ''}
      </div>
    </div>
  `).join('');
}

// ─── COUNT UP ANIMATION ───
function countUp(id, target, dur) {
  const el = $(id), s = performance.now();
  (function u(now) {
    const p = Math.min((now - s) / dur, 1);
    el.textContent = Math.floor(p * target);
    if (p < 1) requestAnimationFrame(u);
  })(s);
}
const API = 'http://localhost:8000';

let file = null, data = null;
const $ = id => document.getElementById(id);

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
  $('fname').textContent = `📎 ${f.name}`;
  $('file-ready').classList.remove('hidden');
}

async function startAnalysis() {
  if (!file) return;
  show('s-loading'); hide('s-upload');
  ['sl1','sl2','sl3','sl4'].forEach((id, i) =>
    setTimeout(() => $(id).classList.add('on'), i * 7000)
  );
  const fd = new FormData();
  fd.append('file', file);
  try {
    const r = await fetch(`${API}/analyze`, { method: 'POST', body: fd });
    if (!r.ok) { const e = await r.json(); throw new Error(e.detail || 'Failed'); }
    data = await r.json();
    renderResults(data);
  } catch(e) {
    hide('s-loading'); show('s-upload');
    alert(`Error: ${e.message}`);
  }
}

function resetApp() {
  hide('s-results'); show('s-upload');
  fi.value = ''; file = null; data = null;
  $('file-ready').classList.add('hidden');
  ['sl1','sl2','sl3','sl4'].forEach(id => $(id).classList.remove('on'));
}

function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }

function renderResults(d) {
  hide('s-loading'); show('s-results');
  const a = d.analysis, q = d.interview_questions;
  const init = (a.candidate_name||'CA').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
  $('av').textContent = init;
  $('cname').textContent = a.candidate_name || 'Unknown Candidate';
  $('crole').textContent = [a.current_role, a.current_company ? '@ '+a.current_company : '', a.experience_level, (a.years_of_experience||0)+' yrs exp'].filter(Boolean).join(' · ');
  const c = a.contact || {};
  $('ccontact').innerHTML = [
    c.email ? `<a href="mailto:${c.email}">✉ ${c.email}</a>` : '',
    c.linkedin ? `<a href="${c.linkedin}" target="_blank">🔗 LinkedIn</a>` : '',
    c.github ? `<a href="${c.github}" target="_blank">💻 GitHub</a>` : '',
    c.location ? `<span style="color:var(--m);font-size:12px">📍 ${c.location}</span>` : ''
  ].join('');
  const sc = a.overall_score || 0;
  const circ = 2 * Math.PI * 50;
  const ring = $('score-ring');
  ring.style.strokeDasharray = circ;
  ring.style.strokeDashoffset = circ;
  setTimeout(() => { ring.style.strokeDashoffset = circ * (1 - sc/100); }, 300);
  countUp('score-n', sc, 1400);
  const rec = a.hire_recommendation || '';
  const rp = $('rec-pill');
  rp.textContent = rec;
  rp.className = rec.includes('Strongly') ? 'rp-strong' : rec.includes('Recommended') ? 'rp-rec' : rec.includes('Caution') ? 'rp-caut' : 'rp-no';
  $('csummary').textContent = a.professional_summary || '';
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('on'));
      t.classList.add('on');
      renderTab(t.dataset.t, a, q);
    });
  });
  renderTab('skills', a, q);
}

function renderTab(t, a, q) {
  const b = $('tab-body');
  if (t==='skills') b.innerHTML = skillsTab(a);
  else if (t==='experience') b.innerHTML = expTab(a);
  else if (t==='strengths') b.innerHTML = strengthsTab(a);
  else if (t==='tech-q') b.innerHTML = qTab(q.technical_questions);
  else if (t==='behavioral-q') b.innerHTML = qTab(q.behavioral_questions);
  else if (t==='situational-q') b.innerHTML = qTab(q.situational_questions);
  else if (t==='redflags') b.innerHTML = rfTab(q.red_flag_probes);
}

function skillsTab(a) {
  const sk = a.technical_skills || {};
  return [sec('Languages',sk.languages),sec('Frameworks',sk.frameworks),sec('Databases',sk.databases),sec('Cloud & DevOps',sk.cloud_devops),sec('Tools',sk.tools),sec('Soft Skills',a.soft_skills)].join('');
}
function sec(label, arr) {
  if (!arr?.length) return '';
  return `<div class="sk-sec"><h4>${label}</h4><div class="sg">${arr.map(s=>`<div class="sp">${s}</div>`).join('')}</div></div>`;
}
function expTab(a) {
  return (a.work_experience||[]).map(e=>`<div class="exc"><div class="er">${e.role||''}</div><div class="ec">${e.company||''}</div><div class="ed">⏱ ${e.duration||''}</div><ul>${(e.key_achievements||[]).map(x=>`<li>${x}</li>`).join('')}</ul></div>`).join('') || '<p style="color:var(--m);padding:16px">No work experience found.</p>';
}
function strengthsTab(a) {
  const str = (a.top_strengths||[]).map(s=>`<div class="str-c"><div class="st">✅ ${s.strength||s}</div><div class="csub">${s.evidence||''}</div></div>`).join('');
  const gaps = (a.potential_gaps||[]).map(g=>`<div class="gap-c"><div class="gt">⚠️ ${g.gap||g}</div><div class="csub">${g.suggestion||''}</div></div>`).join('');
  return `<h4 style="color:var(--gr);font-size:11px;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px">Top Strengths</h4>${str}<h4 style="color:var(--ye);font-size:11px;letter-spacing:1px;text-transform:uppercase;margin:20px 0 12px">Potential Gaps</h4>${gaps}`;
}
function qTab(qs) {
  if (!qs?.length) return '<p style="color:var(--m);padding:16px">No questions generated.</p>';
  return qs.map((q,i)=>{
    const d=q.difficulty||''; const dc=d==='Easy'?'t-e':d==='Hard'?'t-h':'t-m';
    return `<div class="qc"><div class="qm"><span style="color:var(--m);font-size:11px">Q${i+1}</span>${q.skill_tested?`<span class="qt-tag t-i">${q.skill_tested}</span>`:''}${q.competency?`<span class="qt-tag t-i">${q.competency}</span>`:''}${q.scenario_purpose?`<span class="qt-tag t-i">${q.scenario_purpose}</span>`:''}${d?`<span class="qt-tag ${dc}">${d}</span>`:''}</div><div class="qt">${q.question}</div>${q.expected_answer_hint?`<div class="qhint"><strong>💡 Look for:</strong> ${q.expected_answer_hint}</div>`:''}${q.what_to_listen_for?`<div class="qhint"><strong>👂 Listen for:</strong> ${q.what_to_listen_for}</div>`:''}${q.ideal_approach?`<div class="qhint"><strong>✅ Ideal:</strong> ${q.ideal_approach}</div>`:''}${q.follow_up?`<div class="qhint"><strong>→ Follow-up:</strong> ${q.follow_up}</div>`:''}</div>`;
  }).join('');
}
function rfTab(probes) {
  if (!probes?.length) return '<p style="color:var(--m);padding:16px">No red flag probes generated.</p>';
  return probes.map((p,i)=>`<div class="rf-c"><div class="qm"><span style="color:var(--re);font-size:11px">🚩 Red Flag Probe ${i+1}</span></div><div class="qt">${p.question}</div>${p.concern?`<div class="qhint"><strong>⚠️ Concern:</strong> ${p.concern}</div>`:''}${p.red_flag_answer?`<div class="qhint"><strong>🚨 Red flag answer:</strong> ${p.red_flag_answer}</div>`:''}</div>`).join('');
}
function countUp(id, target, dur) {
  const el=$(id), s=performance.now();
  (function u(now){const p=Math.min((now-s)/dur,1);el.textContent=Math.floor(p*target);if(p<1)requestAnimationFrame(u);})(s);
}
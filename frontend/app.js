/* ═══════════════════════════════════════════
   TALENTIQ v5.0 — app.js
   Application logic, tab renderers, helpers
═══════════════════════════════════════════ */

'use strict';

// ── State ────────────────────────────────────
let currentTab  = 'overview';
let resumeFile  = null;

const CANDIDATE = {
  name:      'Priya Sharma',
  role:      'Senior ML Engineer',
  score:     84,
  hire:      'strong-yes',
  hireLabel: 'Strong Hire',
};


// ── Theme ────────────────────────────────────
function toggleTheme() {
  const html = document.documentElement;
  html.dataset.theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
}


// ── File handling ────────────────────────────
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


// ── Analysis flow ────────────────────────────
function startAnalysis() {
  const jd = document.getElementById('jd-input').value.trim();
  if (!resumeFile && !jd) {
    showToast('Please upload a resume or paste a job description', 'error');
    return;
  }

  showScreen('loading');

  runLoadingSequence(() => {
    document.getElementById('results-timestamp').textContent =
      'Generated ' + new Date().toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    document.getElementById('sb-name').textContent = CANDIDATE.name;
    showScreen('results');
    switchTab('overview');
  });
}

function runLoadingSequence(cb) {
  const stages = document.querySelectorAll('#loading-stages .stage');
  let i = 0;
  stages.forEach(s => s.classList.remove('active', 'done'));

  function next() {
    if (i > 0) {
      stages[i - 1].classList.remove('active');
      stages[i - 1].classList.add('done');
    }
    if (i >= stages.length) { setTimeout(cb, 400); return; }
    stages[i].classList.add('active');
    i++;
    setTimeout(next, 700 + Math.random() * 400);
  }
  next();
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
}

function resetApp() {
  clearFile();
  document.getElementById('jd-input').value   = '';
  document.getElementById('role-input').value = '';
  showScreen('upload');
}


// ── Tab navigation ───────────────────────────
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


// ── Tab renderer ─────────────────────────────
function renderTab(tab) {
  const el = document.getElementById('tab-content');
  el.innerHTML = '';
  el.classList.remove('anim-up');
  void el.offsetWidth;  // reflow to restart animation
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

  // Animate score rings and progress bars
  setTimeout(() => {
    el.querySelectorAll('.score-ring-fill').forEach(fill => {
      const pct = parseFloat(fill.dataset.pct) || 0;
      fill.style.strokeDashoffset = 340 - (340 * pct / 100);
    });
    el.querySelectorAll('[data-w]').forEach(bar => {
      bar.style.width = bar.dataset.w + '%';
    });
  }, 60);

  // Q&A accordion
  el.querySelectorAll('.qa-q').forEach(q => {
    q.addEventListener('click', () => q.closest('.qa-item').classList.toggle('open'));
  });
}


/* ══════════════════════════════════════════
   TAB CONTENT RENDERERS
══════════════════════════════════════════ */

function overview() {
  return `
    <div class="section-h">Intelligence Dashboard</div>
    <div class="section-sub">Overall candidate fitness across all evaluation dimensions</div>

    <div class="score-ring-wrap">
      <div class="score-ring-inner">
        <svg class="score-ring-svg" width="120" height="120" viewBox="0 0 120 120">
          <circle class="score-ring-track" cx="60" cy="60" r="54"/>
          <circle class="score-ring-fill"  cx="60" cy="60" r="54" data-pct="84" stroke="var(--accent)"/>
        </svg>
        <div class="score-ring-text">
          <span class="score-ring-num" style="color:var(--accent)">84</span>
          <span class="score-ring-lbl">/100</span>
        </div>
      </div>
      <div class="score-ring-desc">
        <h3>Composite ATS Score</h3>
        <p>Priya scores in the <strong>top 12%</strong> of candidates evaluated for this role. Strong technical depth with demonstrable impact metrics. Minor gaps in system design breadth.</p>
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
          <span class="item-badge badge-teal">Strong Hire</span>
          <span class="item-badge badge-blue">7 yrs exp</span>
          <span class="item-badge badge-violet">ML / Backend</span>
        </div>
      </div>
    </div>

    <div class="axis-grid">
      ${axisCard('Technical Skills',   91, 'var(--blue)')}
      ${axisCard('Experience Depth',   82, 'var(--accent)')}
      ${axisCard('Impact & Outcomes',  78, 'var(--green)')}
      ${axisCard('Communication',      76, 'var(--violet)')}
      ${axisCard('Leadership Signals', 72, 'var(--amber)')}
      ${axisCard('Cultural Fit',       88, 'var(--pink)')}
    </div>

    <div class="stat-stripe">
      <div class="stat-card">
        <div class="stat-label">JD Match</div>
        <div class="stat-val" style="color:var(--accent)">79%</div>
        <div class="stat-sub">↑ above average</div>
        <div class="stat-bar"><div class="stat-bar-fill" style="background:var(--accent)" data-w="79"></div></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Impact Score</div>
        <div class="stat-val" style="color:var(--green)">7.8</div>
        <div class="stat-sub">Quantified achievements</div>
        <div class="stat-bar"><div class="stat-bar-fill" style="background:var(--green)" data-w="78"></div></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Bias Risk</div>
        <div class="stat-val" style="color:var(--amber)">Low</div>
        <div class="stat-sub">2 PII signals detected</div>
        <div class="stat-bar"><div class="stat-bar-fill" style="background:var(--amber)" data-w="18"></div></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Real Skills</div>
        <div class="stat-val" style="color:var(--blue)">73%</div>
        <div class="stat-sub">vs 27% buzz keywords</div>
        <div class="stat-bar"><div class="stat-bar-fill" style="background:var(--blue)" data-w="73"></div></div>
      </div>
    </div>

    <div class="two-col">
      <div class="card-block">
        <div class="card-block-title">Top Strengths</div>
        <div class="item-list">
          ${listItem('green', '✓', 'Python &amp; ML stack depth — 5+ years hands-on production experience')}
          ${listItem('green', '✓', 'Quantified impact on 3 major product launches, &gt;$2M revenue attribution')}
          ${listItem('green', '✓', 'Cross-functional leadership across 8-person engineering pods')}
        </div>
      </div>
      <div class="card-block">
        <div class="card-block-title">Key Gaps</div>
        <div class="item-list">
          ${listItem('red',   '!', 'No formal distributed systems architecture experience documented')}
          ${listItem('amber', '~', 'Kubernetes mentioned once — likely surface-level exposure')}
          ${listItem('amber', '~', 'No mention of A/B testing frameworks or experimentation culture')}
        </div>
      </div>
    </div>`;
}

function skills() {
  const groups = [
    { label: 'Languages',       color: 'var(--blue)',   items: ['Python·Expert','SQL·Advanced','TypeScript·Advanced','Go·Intermediate','Scala·Beginner'] },
    { label: 'ML / AI',         color: 'var(--violet)', items: ['PyTorch·Expert','Scikit-learn·Expert','HuggingFace·Advanced','LangChain·Advanced','MLflow·Intermediate'] },
    { label: 'Infrastructure',  color: 'var(--accent)', items: ['AWS·Advanced','Docker·Advanced','Terraform·Intermediate','Kubernetes·Beginner','GCP·Beginner'] },
    { label: 'Data Engineering', color: 'var(--green)', items: ['Spark·Advanced','dbt·Advanced','Airflow·Advanced','Snowflake·Intermediate','Kafka·Intermediate'] },
  ];
  const levelPct = { Expert: 92, Advanced: 72, Intermediate: 50, Beginner: 28 };

  return `
    <div class="section-h">Skills Intelligence</div>
    <div class="section-sub">Validated technical skills with evidence-based proficiency ratings</div>
    ${groups.map(g => `
      <div class="card-block" style="margin-bottom:16px">
        <div class="card-block-title">${g.label}</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${g.items.map(item => {
            const [name, level] = item.split('·');
            const pct = levelPct[level] || 50;
            return `<div class="bias-row">
              <div class="bias-label" style="font-size:.78rem;color:var(--text);font-weight:500">${name}</div>
              <div class="bias-track"><div class="bias-fill" style="background:${g.color}" data-w="${pct}"></div></div>
              <div class="bias-score" style="color:${g.color}">${level}</div>
            </div>`;
          }).join('')}
        </div>
      </div>`).join('')}`;
}

function experience() {
  return `
    <div class="section-h">Work Experience</div>
    <div class="section-sub">Chronological career timeline with AI-extracted impact signals</div>
    <div class="card-block">
      <div class="timeline">
        ${tlItem('Senior ML Engineer', 'Stripe Inc.', 'Jan 2022 – Present',
          'Led ML platform team building real-time fraud detection serving 50M+ transactions/day. Reduced false positives by 31% while improving model latency from 120ms to 18ms. Mentored 4 junior engineers; introduced MLOps practices cutting deployment time by 60%.')}
        ${tlItem('ML Engineer', 'Flipkart', 'Aug 2019 – Dec 2021',
          'Built recommendation engine increasing GMV by $1.2M quarterly. Owned end-to-end model lifecycle from feature engineering to A/B rollout. Collaborated with product &amp; design on personalization roadmap.')}
        ${tlItem('Data Scientist', 'Mu Sigma', 'Jun 2017 – Jul 2019',
          'Delivered 12 client analytics projects across retail and BFSI verticals. Developed churn prediction model achieving 86% precision for a telecom client.')}
      </div>
    </div>
    <div class="two-col" style="margin-top:16px">
      <div class="card-block">
        <div class="card-block-title">Education</div>
        <div class="timeline">
          ${tlItem('M.Tech Computer Science', 'IIT Bombay', '2015 – 2017',
            'Specialisation in Machine Learning. CGPA 9.1/10. Thesis on adversarial robustness in NLP.')}
          ${tlItem('B.Tech CS &amp; Engineering', 'NIT Trichy', '2011 – 2015',
            'Gold Medallist. CGPA 9.4/10.')}
        </div>
      </div>
      <div class="card-block">
        <div class="card-block-title">Certifications &amp; Awards</div>
        <div class="item-list">
          ${listItem('blue',   '🏅', 'AWS Certified ML Specialist — 2023')}
          ${listItem('blue',   '🏅', 'Google Professional Data Engineer — 2022')}
          ${listItem('violet', '★',  'Stripe Hack Day Winner — Fraud Detection Track (2023)')}
          ${listItem('green',  '↑',  'Top 5% Performer — Flipkart 2020 &amp; 2021')}
        </div>
      </div>
    </div>`;
}

function analysis() {
  return `
    <div class="section-h">Strengths &amp; Gaps Analysis</div>
    <div class="section-sub">AI-generated assessment of candidate fit for the target role</div>
    <div class="item-list" style="margin-bottom:24px">
      ${listItem('green', 'S', 'Deep production ML expertise — fraud detection, recommendations at scale with measurable outcomes.', 'Strong Match')}
      ${listItem('green', 'S', 'Strong Python + data engineering stack (Spark, dbt, Airflow). Rarely seen with both ML depth and pipeline robustness.', 'Rare Combo')}
      ${listItem('green', 'S', 'Demonstrated cross-functional leadership and mentorship. Shows readiness for Staff/Principal IC trajectory.', 'Leadership+')}
      ${listItem('amber', '~', 'AWS knowledge claimed but limited detail on infra-as-code beyond basic Terraform. JD requires cloud architecture ownership.', 'Partial Match')}
      ${listItem('red',   'G', 'No distributed systems design experience documented (consensus protocols, event sourcing, CQRS). JD specifies this as required.', 'Gap')}
      ${listItem('red',   'G', 'Experimentation/A-B testing framework design absent from resume. JD expects ownership of this capability.', 'Gap')}
    </div>
    <div class="divider"></div>
    <div class="section-h" style="font-size:.92rem;margin-bottom:16px">Interviewer Recommendation</div>
    <div class="card-block" style="border-left:3px solid var(--accent)">
      <p style="font-size:.83rem;line-height:1.7;color:var(--text-2)">
        Priya is a <strong style="color:var(--text)">strong technical candidate</strong> with demonstrated ML engineering excellence and tangible business impact.
        Recommend progressing to technical rounds with <strong style="color:var(--text)">focused probing on distributed systems design</strong> and
        experimentation platform ownership. If system design gaps can be bridged through onboarding, this is a high-confidence hire
        for the Senior or Staff ML Engineer role. <em style="color:var(--accent)">Suggested offer range: ₹55–65L CTC.</em>
      </p>
    </div>`;
}

function impact() {
  return `
    <div class="section-h">Impact Quantification</div>
    <div class="section-sub">Measurable, verified achievements extracted from resume narrative</div>
    <div class="stat-stripe">
      <div class="stat-card"><div class="stat-label">Impact Score</div><div class="stat-val" style="color:var(--green)">7.8</div><div class="stat-sub">out of 10</div></div>
      <div class="stat-card"><div class="stat-label">Quantified Items</div><div class="stat-val">9</div><div class="stat-sub">in resume</div></div>
      <div class="stat-card"><div class="stat-label">Revenue Impact</div><div class="stat-val" style="color:var(--accent)">$3.2M</div><div class="stat-sub">attributed</div></div>
      <div class="stat-card"><div class="stat-label">Efficiency Gains</div><div class="stat-val" style="color:var(--blue)">60%</div><div class="stat-sub">avg. improvement</div></div>
    </div>
    <div class="item-list">
      ${listItem('green', '$', 'Reduced fraud false positives by 31% at Stripe — est. $1.8M annual savings in manual review costs', 'High Impact')}
      ${listItem('green', '$', 'Recommendation engine drove $1.2M quarterly GMV increase at Flipkart — directly attributable revenue', 'High Impact')}
      ${listItem('green', '↑', 'Model inference latency: 120ms → 18ms (85% improvement). Enabled new real-time product features', 'Performance')}
      ${listItem('green', '↑', 'MLOps practices reduced model deployment cycle from 3 weeks to 2 days (60% faster)', 'Efficiency')}
      ${listItem('amber', '~', 'Churn model: 86% precision — strong but no business outcome (revenue retained) is cited', 'Partial')}
      ${listItem('amber', '~', 'Mentored 4 engineers — valuable signal but no outcomes (promotions, retention) quantified', 'Partial')}
      ${listItem('red',   '!', '2 STAR-format bullets in early career lack any measurable outcome', 'Missing')}
    </div>`;
}

function realvsbuzz() {
  const real    = ['Python','PyTorch','Scikit-learn','Spark','SQL','dbt','Airflow','AWS','Docker','MLflow','Feature Engineering','Fraud Detection','HuggingFace'];
  const buzz    = ['Kubernetes','GraphQL','gRPC','Ray','Trino','Flink'];
  return `
    <div class="section-h">Real Skills vs Buzz Keywords</div>
    <div class="section-sub">Semantic analysis distinguishing evidenced skills from keyword stuffing</div>
    <div class="two-col">
      <div class="card-block">
        <div class="card-block-title" style="color:var(--green)">✓ Evidenced Skills (Real)</div>
        <div class="tag-cloud">${real.map(t => `<span class="tag real">${t}</span>`).join('')}</div>
        <p style="font-size:.75rem;color:var(--text-2)">Skills backed by project context, metrics, or multi-year mentions across roles.</p>
      </div>
      <div class="card-block">
        <div class="card-block-title" style="color:var(--danger)">✗ Unsubstantiated Keywords (Buzz)</div>
        <div class="tag-cloud">${buzz.map(t => `<span class="tag buzz">${t}</span>`).join('')}</div>
        <p style="font-size:.75rem;color:var(--text-2)">Mentioned once without supporting context — likely surface-level or aspirational.</p>
      </div>
    </div>
    <div class="stat-stripe" style="margin-top:16px">
      <div class="stat-card"><div class="stat-label">Real Skills Ratio</div><div class="stat-val" style="color:var(--green)">73%</div><div class="stat-sub">industry avg: 58%</div><div class="stat-bar"><div class="stat-bar-fill" style="background:var(--green)" data-w="73"></div></div></div>
      <div class="stat-card"><div class="stat-label">Buzz Keywords</div><div class="stat-val" style="color:var(--danger)">27%</div><div class="stat-sub">below avg (42%)</div><div class="stat-bar"><div class="stat-bar-fill" style="background:var(--danger)" data-w="27"></div></div></div>
      <div class="stat-card"><div class="stat-label">Keyword Inflation</div><div class="stat-val" style="color:var(--amber)">Low</div><div class="stat-sub">Credibility: High</div></div>
    </div>`;
}

function jdmatch() {
  return `
    <div class="section-h">JD Alignment Analysis</div>
    <div class="section-sub">Requirement-by-requirement mapping between JD and candidate profile</div>
    <div class="score-ring-wrap">
      <div class="score-ring-inner">
        <svg class="score-ring-svg" width="120" height="120" viewBox="0 0 120 120">
          <circle class="score-ring-track" cx="60" cy="60" r="54"/>
          <circle class="score-ring-fill"  cx="60" cy="60" r="54" data-pct="79" stroke="var(--blue)"/>
        </svg>
        <div class="score-ring-text">
          <span class="score-ring-num" style="color:var(--blue)">79%</span>
          <span class="score-ring-lbl">match</span>
        </div>
      </div>
      <div class="score-ring-desc">
        <h3>Strong JD Alignment</h3>
        <p>Candidate meets 17 of 21 stated requirements. 4 gaps identified — 2 hard requirements and 2 preferred. Hard requirements include distributed systems design and experimentation platform ownership.</p>
      </div>
    </div>
    <div class="item-list">
      ${listItem('green', '✓', '5+ years Python in production systems',                          'Met · Expert')}
      ${listItem('green', '✓', 'ML model deployment and monitoring at scale',                    'Met · Expert')}
      ${listItem('green', '✓', 'Experience with Kafka / streaming pipelines',                   'Met · Advanced')}
      ${listItem('green', '✓', 'Cloud infrastructure (AWS)',                                    'Met · Advanced')}
      ${listItem('amber', '~', 'Kubernetes &amp; container orchestration',                       'Partial · Beginner')}
      ${listItem('red',   '✗', 'Distributed systems design (required)',                         'Not Met')}
      ${listItem('red',   '✗', 'Experimentation platform / A-B framework ownership (required)', 'Not Met')}
    </div>`;
}

function redflags() {
  return `
    <div class="section-h">Red Flags &amp; Risk Signals</div>
    <div class="section-sub">Potential concerns requiring follow-up during interview process</div>
    <div class="stat-stripe">
      <div class="stat-card"><div class="stat-label">Risk Level</div><div class="stat-val" style="color:var(--amber)">Medium</div><div class="stat-sub">3 flags identified</div></div>
      <div class="stat-card"><div class="stat-label">Hard Flags</div><div class="stat-val" style="color:var(--danger)">1</div><div class="stat-sub">Require clarification</div></div>
      <div class="stat-card"><div class="stat-label">Soft Flags</div><div class="stat-val" style="color:var(--amber)">2</div><div class="stat-sub">Worth probing</div></div>
    </div>
    <div class="item-list">
      ${listItem('amber', '~', 'Tenure gap: 3-month unaccounted gap between Mu Sigma (Jul 2019) and Flipkart (Aug 2019). Minor — confirm during screening.', 'Soft Flag')}
      ${listItem('amber', '~', 'All experience at product/tech companies in India. Role requires cross-timezone collaboration — probe for async communication skills.', 'Soft Flag')}
      ${listItem('red',   '!', 'Buzz skill inflation on Kubernetes and GraphQL — mentioned without supporting context. Probe technically.', 'Hard Flag')}
    </div>
    <div class="divider"></div>
    <div class="card-block" style="border-left:3px solid var(--amber)">
      <div class="card-block-title" style="color:var(--amber)">Recommended Follow-up Questions</div>
      <div class="item-list" style="margin-top:10px">
        ${listItem('amber', 'Q', 'Walk me through a specific Kubernetes deployment you owned end-to-end.')}
        ${listItem('amber', 'Q', 'What were you working on between July and August 2019?')}
        ${listItem('amber', 'Q', 'Describe a situation where you collaborated asynchronously with a geographically distributed team.')}
      </div>
    </div>`;
}

function technical() {
  return `
    <div class="section-h">Technical Interview Questions</div>
    <div class="section-sub">AI-generated role-specific questions calibrated to candidate's experience level</div>
    <div class="qa-list">
      ${qa(1, 'Design a real-time fraud detection system that scales to 50M transactions per day. Walk me through your architecture choices.', 'Hard')}
      ${qa(2, 'You need to reduce model inference latency from 200ms to under 20ms without significant accuracy loss. What\'s your approach?', 'Hard')}
      ${qa(3, 'How would you design an ML feature store that serves both training and online inference with data freshness guarantees?', 'Hard')}
      ${qa(4, 'Explain the trade-offs between a streaming (Kafka/Flink) and batch (Spark) pipeline for your fraud detection use case.', 'Medium')}
      ${qa(5, 'How do you detect and handle data drift in a production ML model? What monitoring would you set up?', 'Medium')}
      ${qa(6, 'Walk me through how you would structure a dbt project for a large e-commerce data warehouse.', 'Easy')}
    </div>`;
}

function behavioral() {
  return `
    <div class="section-h">Behavioural Questions</div>
    <div class="section-sub">STAR-format questions designed to surface leadership, collaboration, and growth signals</div>
    <div class="qa-list">
      ${qa(1, 'Tell me about a time you had to push back on a product stakeholder\'s request because it would have compromised model integrity. How did you handle it?', 'Medium')}
      ${qa(2, 'Describe the most complex cross-functional project you\'ve owned. How did you align engineering, data science, and product toward a shared outcome?', 'Medium')}
      ${qa(3, 'Walk me through a failure in an ML project. What did you learn, and how did it change how you work?', 'Medium')}
      ${qa(4, 'You mentioned mentoring 4 engineers at Stripe. Tell me about one who grew significantly. What did you do?', 'Easy')}
      ${qa(5, 'Describe a time you had to make a high-stakes technical decision under time pressure with incomplete information.', 'Hard')}
    </div>`;
}

function situational() {
  return `
    <div class="section-h">Situational Questions</div>
    <div class="section-sub">Hypothetical scenarios to assess judgment, prioritisation, and decision-making under pressure</div>
    <div class="qa-list">
      ${qa(1, 'You\'ve just discovered that a model you shipped 2 weeks ago has a subtle bias that disproportionately flags transactions from a specific demographic. It\'s in production at scale. What do you do in the next 24 hours?', 'Hard')}
      ${qa(2, 'You\'re 2 weeks into a new role and notice the team\'s ML infra is significantly outdated — no versioning, no monitoring. Your manager hasn\'t flagged this. How do you proceed?', 'Medium')}
      ${qa(3, 'Your ML experiment shows 0.5% improvement in precision. The business team wants to ship immediately. Engineering says it requires a 3-week refactor. What do you recommend?', 'Medium')}
    </div>`;
}

function deepdive() {
  return `
    <div class="section-h">Deep Dive Questions</div>
    <div class="section-sub">Probing questions to verify depth of claimed expertise</div>
    <div class="qa-list">
      ${qa(1, 'You list PyTorch as "expert" level. Describe a time you implemented a custom autograd operation or wrote a custom CUDA kernel. What was the performance outcome?', 'Hard')}
      ${qa(2, 'Walk me through the internals of gradient boosting. Why would you choose XGBoost over CatBoost for a high-cardinality categorical feature problem?', 'Hard')}
      ${qa(3, 'You worked with Kafka at Flipkart. Explain how you ensured exactly-once semantics in your consumer group. What edge cases did you encounter?', 'Hard')}
      ${qa(4, 'Your resume mentions Terraform at intermediate level. Have you designed multi-account AWS landing zones or worked with Terraform modules at scale?', 'Medium')}
    </div>`;
}

function bias() {
  return `
    <div class="section-h">Ethical Bias Audit</div>
    <div class="section-sub">Fairness, PII detection, and demographic signal analysis for equitable hiring</div>
    <div class="two-col">
      <div class="card-block">
        <div class="card-block-title">Fairness Scores</div>
        <div class="bias-meter">
          ${biasRow('Gender Neutrality',     96)}
          ${biasRow('Age Signal',            88)}
          ${biasRow('Nationality Bias',      82)}
          ${biasRow('Educational Prestige',  70)}
          ${biasRow('Name-based Inference',  94)}
        </div>
      </div>
      <div class="card-block">
        <div class="card-block-title">PII Signals Detected</div>
        <div class="item-list">
          ${listItem('amber', '⚠', '"IIT Bombay" may trigger prestige bias in automated screening', 'Prestige Signal')}
          ${listItem('amber', '⚠', 'Name reveals gender and probable ethnicity — blind screening recommended', 'Name PII')}
          ${listItem('green', '✓', 'No age, DOB, marital status, or photo detected', 'Clean')}
          ${listItem('green', '✓', 'No address or contact PII in extracted text', 'Clean')}
        </div>
      </div>
    </div>
    <div class="card-block" style="border-left:3px solid var(--violet)">
      <div class="card-block-title" style="color:var(--violet)">Recommendations for Fair Process</div>
      <p style="font-size:.8rem;color:var(--text-2);line-height:1.7;margin-top:8px">
        Consider blind resume review for first-round scoring. Educational institution prestige can introduce
        systemic bias — focus on outcomes (GPA, projects, awards) rather than institution name.
        Structured interviews with pre-defined rubrics recommended to neutralise interviewer halo effects.
      </p>
    </div>`;
}

function coaching() {
  return `
    <div class="section-h">Candidate Coaching Report</div>
    <div class="section-sub">Personalised resume and career improvement recommendations</div>
    <div class="item-list" style="margin-bottom:20px">
      ${listItem('blue', '1', 'Add distributed systems project to GitHub or portfolio. Even a side project demonstrating Raft consensus or event sourcing would close the #1 gap significantly.', 'High Priority')}
      ${listItem('blue', '2', 'Quantify the Churn model impact — "86% precision" is the input, not the output. Add: "reducing quarterly churn by X% / saving $Y in annual revenue."', 'Medium Priority')}
      ${listItem('blue', '3', 'Remove or substantiate Kubernetes and GraphQL. Either add a specific project or remove to avoid flag in technical screening.', 'Medium Priority')}
      ${listItem('blue', '4', 'Consider adding an "Open Source / Publications" section — ML candidates with GitHub contributions rank 23% higher in technical screening pipelines.', 'Low Priority')}
    </div>
    <div class="card-block">
      <div class="card-block-title">Suggested Resume Rewrite — Sample Bullet</div>
      <div style="background:var(--danger-dim);border-radius:var(--r-sm);padding:10px 14px;margin-bottom:10px;font-size:.78rem;color:var(--danger)">
        ❌ Before: "Developed a churn prediction model achieving 86% precision for a telecom client."
      </div>
      <div style="background:var(--green-dim);border-radius:var(--r-sm);padding:10px 14px;font-size:.78rem;color:var(--green)">
        ✅ After: "Built churn prediction model (86% precision, 91% recall) deployed to production serving 4M subscribers, reducing monthly churn by 2.3% and saving an estimated $1.4M annually in retention spend."
      </div>
    </div>`;
}

function outreach() {
  const messages = [
    {
      type: 'LinkedIn InMail',
      icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x=".5" y="2.5" width="15" height="11" rx="2" stroke="currentColor" stroke-width="1.2"/><path d=".5 4.5l7.5 5 7.5-5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      color: 'var(--blue-dim)',
      textColor: 'var(--blue)',
      body: `Hi Priya,<br><br>I came across your work on real-time fraud detection at Stripe — the 85% latency improvement is impressive and directly relevant to what we're building. We're scaling our ML platform team and I think your background in production ML + data engineering would be a strong fit.<br><br>Would you be open to a 20-min call this week?`,
    },
    {
      type: 'Cold Email',
      icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x=".5" y="2.5" width="15" height="11" rx="2" stroke="currentColor" stroke-width="1.2"/><path d=".5 4.5l7.5 5 7.5-5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      color: 'var(--violet-dim)',
      textColor: 'var(--violet)',
      body: `Subject: ML Platform role at [Company] — your Stripe work caught our eye<br><br>Hi Priya,<br><br>Your fraud detection work at Stripe — particularly reducing inference from 120ms to 18ms — is exactly the kind of impact we're looking for. We're building a new ML platform team with a Senior/Staff ML Engineer opening you might find compelling.<br><br>Happy to share more details if you're open to exploring.`,
    },
    {
      type: 'WhatsApp / SMS',
      icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x=".5" y="2.5" width="15" height="11" rx="2" stroke="currentColor" stroke-width="1.2"/><path d=".5 4.5l7.5 5 7.5-5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      color: 'var(--green-dim)',
      textColor: 'var(--green)',
      body: `Hi Priya, this is [Name] from [Company]. Your ML engineering background looks like a great fit for a senior role we're hiring for. Would love to connect — is this a good number to reach you?`,
    },
  ];

  return `
    <div class="section-h">Recruiter Outreach Templates</div>
    <div class="section-sub">AI-crafted personalised messages for candidate engagement</div>
    ${messages.map(m => `
      <div class="agent-card">
        <div class="agent-header">
          <div class="agent-icon" style="background:${m.color};color:${m.textColor}">${m.icon}</div>
          <div>
            <div class="agent-title">${m.type}</div>
            <div class="agent-sub">Personalised for Priya Sharma · Senior ML Engineer</div>
          </div>
        </div>
        <div style="background:var(--surface-2);border-radius:var(--r-md);padding:14px;font-size:.78rem;color:var(--text-2);line-height:1.7;font-family:var(--font-mono)">
          ${m.body}
        </div>
      </div>`).join('')}`;
}

function pipeline() {
  return `
    <div class="section-h">Talent Pipeline</div>
    <div class="section-sub">AI recruitment agent — candidate pipeline management</div>
    <div class="agent-card">
      <div class="agent-header">
        <div class="agent-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="3" cy="4" r="2.2" stroke="currentColor"/><circle cx="3" cy="8" r="2.2" stroke="currentColor"/><circle cx="3" cy="12" r="2.2" stroke="currentColor"/><path d="M5.2 4h10M5.2 8h8M5.2 12h9" stroke="currentColor" stroke-linecap="round"/></svg>
        </div>
        <div><div class="agent-title">Pipeline Status</div><div class="agent-sub">Senior ML Engineer — Active Pipeline</div></div>
      </div>
      <div class="pipeline-stages">
        <div class="pipe-stage"><div class="pipe-stage-label">Applied</div><div class="pipe-stage-count">24</div></div>
        <div class="pipe-stage"><div class="pipe-stage-label">Screened</div><div class="pipe-stage-count">12</div></div>
        <div class="pipe-stage active"><div class="pipe-stage-label">Interview</div><div class="pipe-stage-count">4</div></div>
        <div class="pipe-stage"><div class="pipe-stage-label">Offer</div><div class="pipe-stage-count">1</div></div>
        <div class="pipe-stage"><div class="pipe-stage-label">Hired</div><div class="pipe-stage-count">0</div></div>
      </div>
    </div>
    <div class="two-col">
      <div class="card-block">
        <div class="card-block-title">Top Candidates</div>
        <div class="item-list">
          ${listItem('green', '1', 'Priya Sharma · Score 84 · ✦ Strong Hire', 'In Interview')}
          ${listItem('blue',  '2', 'Arjun Mehta · Score 79 · Hire',           'In Interview')}
          ${listItem('amber', '3', 'Sun Li · Score 71 · Maybe',               'Screening')}
          ${listItem('red',   '4', 'Alex Turner · Score 58 · Pass',           'Screened Out')}
        </div>
      </div>
      <div class="card-block">
        <div class="card-block-title">Pipeline Health</div>
        <div class="bias-meter" style="margin-top:8px">
          ${biasRow('Funnel Conversion',   50)}
          ${biasRow('Time-to-screen',      78)}
          ${biasRow('Diversity Score',     62)}
          ${biasRow('Offer Acceptance',    85)}
        </div>
      </div>
    </div>`;
}

function jobgen() {
  return `
    <div class="section-h">JD Generator</div>
    <div class="section-sub">AI-generated inclusive job description based on candidate intelligence</div>
    <div class="card-block" style="font-family:var(--font-mono);font-size:.75rem;line-height:1.9;color:var(--text-2)">
      <div style="font-family:var(--font-head);font-size:1rem;font-weight:700;color:var(--text);margin-bottom:4px">Senior ML Engineer</div>
      <div style="color:var(--accent);margin-bottom:16px;font-family:var(--font-body);font-size:.78rem">Full-time · Remote-friendly · Engineering</div>
      <strong style="color:var(--text);font-family:var(--font-body)">About the Role</strong><br>
      We're looking for a Senior ML Engineer to join our growing ML Platform team. You'll own the full lifecycle of production ML systems — from feature engineering and model training to deployment, monitoring, and iteration at scale.<br><br>
      <strong style="color:var(--text);font-family:var(--font-body)">What You'll Do</strong><br>
      • Design and deploy ML systems serving millions of requests per day<br>
      • Build real-time feature pipelines using Kafka, Spark, and dbt<br>
      • Partner with product and data science to translate business problems into ML solutions<br>
      • Mentor junior engineers and champion MLOps best practices<br><br>
      <strong style="color:var(--text);font-family:var(--font-body)">Requirements</strong><br>
      • 5+ years Python in production ML environments<br>
      • Hands-on experience with model deployment, monitoring, and A/B testing<br>
      • Strong data engineering fundamentals (Spark, dbt, Airflow)<br>
      • Experience with distributed systems (preferred)<br><br>
      <em style="color:var(--text-3)">Note: AI-generated for inclusivity — neutral language, skills-first, no prestige signals.</em>
    </div>`;
}

function decision() {
  return `
    <div class="section-h">AI Hire Decision</div>
    <div class="section-sub">Structured recommendation with confidence scoring and risk assessment</div>
    <div class="card-block" style="margin-bottom:20px;background:var(--green-dim);border-color:rgba(52,211,153,0.25)">
      <div style="display:flex;align-items:center;gap:16px">
        <div style="font-family:var(--font-head);font-size:2.5rem;font-weight:800;color:var(--green);letter-spacing:-0.04em">HIRE</div>
        <div>
          <div style="font-weight:700;color:var(--green);font-size:1rem">Strong Hire Recommendation</div>
          <div style="font-size:.75rem;color:var(--text-2);margin-top:2px;font-family:var(--font-mono)">Confidence: 87% · Model: Llama 3.3 70B</div>
        </div>
      </div>
    </div>
    <div class="two-col">
      <div class="card-block">
        <div class="card-block-title">Decision Factors — For</div>
        <div class="item-list">
          ${listItem('green', '✓', 'ATS score 84/100 — top 12% of candidates evaluated')}
          ${listItem('green', '✓', 'Directly attributable revenue impact of $3.2M+')}
          ${listItem('green', '✓', 'Rare combination of ML depth + data engineering')}
          ${listItem('green', '✓', 'Demonstrated mentorship and engineering leadership')}
        </div>
      </div>
      <div class="card-block">
        <div class="card-block-title">Decision Factors — Against</div>
        <div class="item-list">
          ${listItem('red',   '✗', 'Missing distributed systems architecture experience')}
          ${listItem('amber', '~', 'Experimentation platform ownership unproven')}
          ${listItem('amber', '~', 'Kubernetes exposure appears surface-level')}
        </div>
      </div>
    </div>
    <div class="card-block" style="border-left:3px solid var(--green)">
      <div class="card-block-title">Suggested Offer Range</div>
      <div style="font-family:var(--font-head);font-size:1.8rem;font-weight:800;letter-spacing:-0.04em;color:var(--green);margin:8px 0">₹55 – 65L CTC</div>
      <p style="font-size:.78rem;color:var(--text-2)">Based on YOE (7 years), role calibration (Senior), and market benchmarks for ML engineers in Bangalore / Remote-India. Recommend equity component of 0.05–0.1% with 4-year vest.</p>
    </div>`;
}


/* ══════════════════════════════════════════
   HELPER BUILDERS
══════════════════════════════════════════ */

function axisCard(name, score, color) {
  return `<div class="axis-card">
    <div class="axis-top">
      <span class="axis-name">${name}</span>
      <span class="axis-score" style="color:${color}">${score}</span>
    </div>
    <div class="axis-progress">
      <div class="axis-fill" style="background:${color};width:0%" data-w="${score}"></div>
    </div>
  </div>`;
}

function listItem(color, bullet, text, badge = '') {
  return `<div class="item-row">
    <div class="item-bullet ${color}">${bullet}</div>
    <div class="item-text">${text}</div>
    ${badge ? `<span class="item-badge badge-${color}">${badge}</span>` : ''}
  </div>`;
}

function biasRow(label, score) {
  const color = score >= 85 ? 'var(--green)' : score >= 65 ? 'var(--amber)' : 'var(--danger)';
  return `<div class="bias-row">
    <div class="bias-label">${label}</div>
    <div class="bias-track"><div class="bias-fill" style="background:${color}" data-w="${score}"></div></div>
    <div class="bias-score">${score}%</div>
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

function qa(num, question, difficulty) {
  const cls = { Hard: 'difficulty-hard', Medium: 'difficulty-medium', Easy: 'difficulty-easy' }[difficulty];
  return `<div class="qa-item">
    <div class="qa-q">
      <span class="qa-num">Q${num}</span>
      <span class="qa-text">${question}</span>
      <span class="qa-difficulty ${cls}">${difficulty}</span>
    </div>
    <div class="qa-a">
      <strong>What to listen for:</strong> Look for specificity over generality — the best candidates cite exact numbers, trade-offs made, and lessons learned.
      Red flag: vague answers that could apply to any situation.
    </div>
  </div>`;
}


/* ══════════════════════════════════════════
   TOAST
══════════════════════════════════════════ */
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast ' + type;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}


/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('results-timestamp').textContent =
    'Generated ' + new Date().toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
});
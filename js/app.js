/* ZLEEP v2.0 — Main Application */

const app = (() => {

  // ── State ─────────────────────────────────────────────────
  let ble, zdb, auth;
  let isConnected = false, isDemo = false;
  let sessionActive = false, sessionStart = null;
  let timerInterval = null, demoInterval = null, batchTimer = null;
  let sampleBuffer = [], batchBuffer = [];
  let lastSampleTs = null;
  let profile = {};
  let charts = {};
  let sessions = [];        // cached session history
  let apneaEvents = [];     // current session apnea events
  let respHistory = [];     // respiratory rate per epoch
  let stageTimeline = [];   // sleep stage timeline current session
  let lastBioAge = null;
  let lastAhi = 0;

  const MAX_CHART_PTS = 300;

  // ── Init ──────────────────────────────────────────────────
  function init() {
    zdb  = new ZleepDatabase();
    ble  = new ZleepBluetooth(onImuData, onBleStatus);
    auth = new ZleepAuth(onAuthStateChange);

    setupCharts();
    setupRouter();
    loadProfileFromStorage();
    updateCircadianMarker();
    setInterval(updateCircadianMarker, 60000);
    setInterval(updatePeriodicAnalysis, 30000); // every 30s update resp/stage/OSA
  }

  // ── Auth ──────────────────────────────────────────────────
  function onAuthStateChange(user) {
    if (user) {
      zdb.setUid(user.uid);
      const name = user.displayName || user.email?.split('@')[0] || 'Pengguna';
      const el = document.getElementById('header-user');
      el.textContent = name;
      el.classList.remove('hidden');
      document.getElementById('auth-btn-label').textContent = name.split(' ')[0];
      document.getElementById('logout-btn').style.display = '';
      document.getElementById('account-info').textContent =
        user.isAnonymous ? 'Mode tamu — data hanya di device ini' : `Masuk sebagai: ${user.email}`;
      zdb.getProfile().then(p => { if (p && p.name) { profile = { ...profile, ...p }; applyProfileToForm(); } });
    } else {
      document.getElementById('header-user').classList.add('hidden');
      document.getElementById('auth-btn-label').textContent = 'Masuk';
      document.getElementById('logout-btn').style.display = 'none';
      document.getElementById('account-info').textContent = '';
    }
  }

  function showAuth()  { document.getElementById('auth-modal').classList.remove('hidden'); }
  function closeAuth() { document.getElementById('auth-modal').classList.add('hidden'); clearAuthErrors(); }

  function switchAuthTab(tab) {
    document.getElementById('auth-login').classList.toggle('hidden', tab !== 'login');
    document.getElementById('auth-register').classList.toggle('hidden', tab !== 'register');
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
    clearAuthErrors();
  }

  async function doLogin() {
    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-password').value;
    try {
      await auth.loginEmail(email, pass);
      closeAuth(); showToast('Berhasil masuk');
    } catch (e) { showAuthError('auth-error', e.message); }
  }

  async function doRegister() {
    const name  = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pass  = document.getElementById('reg-password').value;
    try {
      await auth.registerEmail(email, pass, name);
      closeAuth(); showToast('Akun berhasil dibuat');
    } catch (e) { showAuthError('reg-error', e.message); }
  }

  async function doAnonymous() {
    try {
      await auth.loginAnonymous();
      closeAuth(); showToast('Melanjutkan sebagai tamu');
    } catch (e) { showAuthError('auth-error', e.message); }
  }

  async function doLogout() {
    await auth.logout();
    showToast('Berhasil keluar');
  }

  function showAuthError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg; el.classList.remove('hidden');
  }
  function clearAuthErrors() {
    ['auth-error','reg-error'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = ''; el.classList.add('hidden'); }
    });
  }

  // ── BLE ───────────────────────────────────────────────────
  async function connect() {
    try {
      showToast('Mencari perangkat ZLEEP...');
      await ble.connect();
    } catch (err) {
      if (err.name !== 'NotFoundError') showToast('Error: ' + err.message);
      else showToast('Dibatalkan atau tidak ditemukan');
    }
  }

  function connectDemo() {
    isDemo = true; isConnected = true;
    onBleStatus('demo', 'DEMO');
    hideOverlay();
    startDemoStream();
    showToast('Mode demo aktif');
  }

  function toggleConnect() {
    if (isConnected || isDemo) {
      isDemo ? stopDemo() : ble.disconnect();
    } else { connect(); }
  }

  function onBleStatus(status, name) {
    if (status === 'connected' || status === 'demo') {
      isConnected = true;
      if (status !== 'demo') isDemo = false;
      hideOverlay();
      updateConnectionUI(status, name);
      showToast(status === 'demo' ? 'Mode demo aktif' : `Terhubung ke ${name}`);
    } else {
      isConnected = false; isDemo = false;
      showOverlay();
      updateConnectionUI('disconnected', '');
      if (sessionActive) endSession();
      showToast('Perangkat terputus');
    }
  }

  function updateConnectionUI(status, name) {
    const statusEl  = document.getElementById('device-status');
    const labelEl   = document.getElementById('status-label');
    const btnEl     = document.getElementById('sidebar-connect-btn');
    const btnLbl    = document.getElementById('connect-btn-label');
    const hdrStatus = document.getElementById('header-status');
    const hdrLabel  = document.getElementById('header-status-label');
    const dot       = hdrStatus?.querySelector('.status-dot');

    const label = status === 'connected' ? name : status === 'demo' ? 'Mode Demo' : 'Tidak Terhubung';
    statusEl.className = 'device-status ' + status;
    labelEl.textContent = label;
    btnEl.className = 'btn-connect-sm ' + (status !== 'disconnected' ? 'connected' : '');
    btnLbl.textContent = status !== 'disconnected' ? 'Putuskan' : 'Hubungkan';
    if (dot) dot.className = 'status-dot ' + status;
    if (hdrLabel) hdrLabel.textContent = status === 'connected' ? name : status === 'demo' ? 'Demo' : 'Offline';
  }

  function showOverlay() { document.getElementById('connect-overlay').classList.remove('hidden'); }
  function hideOverlay() { document.getElementById('connect-overlay').classList.add('hidden'); }

  // ── Session ───────────────────────────────────────────────
  function toggleSession() { sessionActive ? endSession() : startSession(); }

  function startSession() {
    sessionActive = true; sessionStart = Date.now();
    sampleBuffer = []; batchBuffer = []; apneaEvents = [];
    respHistory = []; stageTimeline = [];

    zdb.startSession({ deviceName: isDemo ? 'DEMO' : (ble.device?.name || 'ZLEEP') });

    document.getElementById('session-toggle-btn').classList.add('active');
    document.getElementById('session-btn-label').textContent = 'Akhiri Sesi';

    const timer = document.getElementById('session-timer');
    timer.classList.remove('hidden'); timer.classList.add('active');
    timerInterval = setInterval(updateTimer, 1000);
    batchTimer    = setInterval(() => { zdb.flushImuBatch(batchBuffer); batchBuffer = []; }, 30000);

    showToast('Sesi tidur dimulai');
  }

  function endSession() {
    if (!sessionActive) return;
    sessionActive = false;
    clearInterval(timerInterval); clearInterval(batchTimer);
    zdb.flushImuBatch(batchBuffer); batchBuffer = [];

    const durationMs = Date.now() - sessionStart;
    const quality    = SleepAnalysis.qualityScore(sampleBuffer, durationMs);
    const summary    = SleepAnalysis.stageSummary(stageTimeline);
    const risk       = SleepAnalysis.cardioRisk(profile, quality, durationMs / 3600000);
    const ahi        = SleepAnalysis.ahiProxy(apneaEvents, durationMs);
    lastAhi = ahi;

    zdb.endSession({ qualityScore: quality, durationMs, riskScore: risk, ahiProxy: ahi,
                     stageSummary: summary.pct });

    document.getElementById('session-toggle-btn').classList.remove('active');
    document.getElementById('session-btn-label').textContent = 'Mulai Sesi Tidur';
    document.getElementById('session-timer').classList.add('hidden');
    document.getElementById('session-timer').classList.remove('active');

    updateQualityDisplay(quality);
    updateOsaDisplay(ahi, apneaEvents.length);
    updateStageDisplay(summary);
    updateBioAgeDisplay();
    updateAnalysisSection(summary, ahi);
    generateRecommendations();

    showToast(`Sesi selesai — Kualitas: ${quality ?? '—'} | AHI: ${ahi}`);
    loadHistory(); // refresh history after session
  }

  function updateTimer() {
    const e = Date.now() - sessionStart;
    const h = String(Math.floor(e / 3600000)).padStart(2,'0');
    const m = String(Math.floor((e % 3600000) / 60000)).padStart(2,'0');
    const s = String(Math.floor((e % 60000) / 1000)).padStart(2,'0');
    document.getElementById('timer-display').textContent = `${h}:${m}:${s}`;
  }

  // ── IMU Data Handler ──────────────────────────────────────
  function onImuData(imu) {
    const now = Date.now();
    if (lastSampleTs) {
      const hz = Math.round(1000 / (now - lastSampleTs));
      document.getElementById('sample-rate-badge').textContent = hz + ' Hz';
    }
    lastSampleTs = now;

    sampleBuffer.push(imu);
    if (sampleBuffer.length > MAX_CHART_PTS) sampleBuffer.shift();
    if (sessionActive) batchBuffer.push(imu);
    if (sessionActive) zdb.pushImuSample(imu);

    updateRawDisplay(imu);
    updateCharts(imu);
    updatePositionDisplay(imu);
    updateMovementDisplay();

    document.getElementById('accel-badge').textContent =
      `a: ${imu.ax.toFixed(2)}, ${imu.ay.toFixed(2)}, ${imu.az.toFixed(2)} g`;
  }

  // Periodic analysis every 30s (respiratory, stage, OSA)
  function updatePeriodicAnalysis() {
    if (!sessionActive || sampleBuffer.length < 50) return;

    // Respiratory rate
    const rr = SleepAnalysis.respiratoryRate(sampleBuffer);
    if (rr !== null) {
      respHistory.push({ ts: Date.now(), rr });
      updateRespDisplay(rr);
    }

    // Sleep stage timeline
    stageTimeline = SleepAnalysis.sleepStageTimeline(sampleBuffer);
    const summary  = SleepAnalysis.stageSummary(stageTimeline);
    updateStageDisplay(summary);

    // OSA
    apneaEvents = SleepAnalysis.detectApneaEvents(sampleBuffer);
    const ahi   = SleepAnalysis.ahiProxy(apneaEvents, Date.now() - sessionStart);
    lastAhi = ahi;
    updateOsaDisplay(ahi, apneaEvents.length);

    // Recommendations
    generateRecommendations();
  }

  // ── Display updaters ──────────────────────────────────────
  function updateRawDisplay(imu) {
    document.getElementById('raw-ax').textContent = imu.ax.toFixed(2);
    document.getElementById('raw-ay').textContent = imu.ay.toFixed(2);
    document.getElementById('raw-az').textContent = imu.az.toFixed(2);
    document.getElementById('raw-gx').textContent = imu.gx.toFixed(2);
    document.getElementById('raw-gy').textContent = imu.gy.toFixed(2);
    document.getElementById('raw-gz').textContent = imu.gz.toFixed(2);
  }

  function updatePositionDisplay(imu) {
    const pos = SleepAnalysis.detectPosition(imu.ax, imu.ay, imu.az);
    document.getElementById('sleep-position-val').textContent = pos.label;
    const body = document.querySelector('.position-body');
    if (body) body.style.transform = `rotate(${pos.angle}deg)`;
  }

  function updateMovementDisplay() {
    const intensity = SleepAnalysis.movementIntensity(sampleBuffer.slice(-30));
    document.getElementById('movement-val').textContent = intensity.toFixed(2);
    drawGauge(intensity);
  }

  function updateRespDisplay(rr) {
    const el = document.getElementById('resp-rate-val');
    const badge = document.getElementById('resp-rate-badge');
    el.textContent = rr;
    el.className = 'metric-value ' + (rr < 10 || rr > 25 ? 'warn' : 'good');
    badge.textContent = rr < 10 ? 'Terlalu Lambat' : rr > 25 ? 'Terlalu Cepat' : 'Normal (10–25)';
    badge.className = 'metric-badge ' + (rr < 10 || rr > 25 ? 'badge-warn' : 'badge-success');
  }

  function updateStageDisplay(summary) {
    if (!summary || !stageTimeline.length) return;
    const latest = stageTimeline[stageTimeline.length - 1]?.stage || 'awake';
    const labels = { awake: 'Terjaga', light: 'Tidur Ringan', deep: 'Tidur Dalam', rem: 'REM' };
    document.getElementById('sleep-stage-val').textContent = labels[latest] || '—';

    const total = Object.values(summary.pct).reduce((a,b)=>a+b,0) || 1;
    ['deep','rem','light','awake'].forEach(s => {
      const seg = document.getElementById('seg-' + s);
      if (seg) seg.style.width = summary.pct[s] + '%';
    });
  }

  function updateOsaDisplay(ahi, count) {
    const label = SleepAnalysis.osaRiskLabel(ahi);
    const el    = document.getElementById('osa-ahi-val');
    const badge = document.getElementById('osa-badge');
    el.textContent = ahi;
    el.className = 'metric-value ' + label.cls;
    badge.textContent = `${label.label} — ${count} episode`;
    badge.className = 'metric-badge badge-' + label.cls;
  }

  function updateQualityDisplay(score) {
    const { label, cls } = SleepAnalysis.qualityLabel(score);
    document.getElementById('sleep-quality-val').textContent = score ?? '—';
    document.getElementById('sleep-quality-val').className   = 'metric-value ' + cls;
    document.getElementById('sleep-quality-badge').textContent = label;
    document.getElementById('sleep-quality-badge').className   = 'metric-badge badge-' + (cls || 'info');
    const bar = document.getElementById('sleep-quality-bar');
    if (bar && score) bar.style.width = score + '%';

    const risk  = SleepAnalysis.cardioRisk(profile, score, 8);
    const rl    = SleepAnalysis.riskLabel(risk);
    document.getElementById('risk-val').textContent  = risk + '%';
    document.getElementById('risk-val').className    = 'metric-value ' + rl.cls;
    document.getElementById('risk-badge').textContent = rl.label;
    document.getElementById('risk-badge').className   = 'metric-badge badge-' + rl.cls;
  }

  function updateBioAgeDisplay() {
    const age = parseInt(profile.age);
    if (!age || !sessions.length) return;
    const bio = SleepAnalysis.biologicalAge(age, sessions);
    lastBioAge = bio;
    const { text, cls } = SleepAnalysis.biologicalAgeLabel(bio.delta);

    document.getElementById('bio-age-val').textContent = bio.bioAge + ' thn';
    document.getElementById('bio-age-val').className   = 'metric-value ' + cls;
    document.getElementById('bio-age-badge').textContent = `${text} (Δ${bio.delta > 0 ? '+':''}${bio.delta} tahun)`;
    document.getElementById('bio-age-badge').className   = 'metric-badge badge-' + cls;
  }

  function updateAnalysisSection(summary, ahi) {
    // Stage pie chart
    if (charts.stages && summary) {
      charts.stages.data.datasets[0].data = [
        summary.pct.deep, summary.pct.rem,
        summary.pct.light, summary.pct.awake
      ];
      charts.stages.update();
      ['deep','rem','light','awake'].forEach(s => {
        const el = document.getElementById('pct-' + s);
        if (el) el.textContent = (summary.pct[s] || 0) + '%';
      });
    }

    // OSA detail
    document.getElementById('ahi-detail-val').textContent = ahi;
    const needle = document.getElementById('osa-needle');
    if (needle) {
      const pct = Math.min(100, (ahi / 40) * 100);
      needle.style.left = pct + '%';
    }

    // Bio age detail
    if (lastBioAge && profile.age) {
      document.getElementById('chrono-age-val').textContent = profile.age + ' thn';
      document.getElementById('bio-age-num').textContent    = lastBioAge.bioAge + ' thn';
      document.getElementById('bio-age-num').className      =
        'bio-num ' + SleepAnalysis.biologicalAgeLabel(lastBioAge.delta).cls;

      document.getElementById('bio-age-factors').innerHTML = `
        <div class="bio-factor-row"><span>Rata-rata kualitas tidur</span><strong>${lastBioAge.avgQuality}/100</strong></div>
        <div class="bio-factor-row"><span>Rata-rata durasi tidur</span><strong>${lastBioAge.avgDurHrs}j</strong></div>
        <div class="bio-factor-row"><span>Variasi jam tidur (SD)</span><strong>${lastBioAge.bedtimeSD}j</strong></div>
        <div class="bio-factor-row"><span>Keyakinan estimasi</span><strong>${lastBioAge.confidence}</strong></div>
      `;
    }

    // Resp rate chart
    if (charts.resp && respHistory.length) {
      charts.resp.data.labels = respHistory.map((_, i) => i + 1);
      charts.resp.data.datasets[0].data = respHistory.map(r => r.rr);
      charts.resp.update();
    }
  }

  function generateRecommendations() {
    const lastSession  = sessions[sessions.length - 1];
    const imu          = sampleBuffer[sampleBuffer.length - 1];
    const pos          = imu ? SleepAnalysis.detectPosition(imu.ax, imu.ay, imu.az).key : null;
    const lastRr       = respHistory[respHistory.length - 1]?.rr ?? null;

    const tips = Recommendations.generate({
      profile,
      sessions,
      lastSession,
      currentPosition: pos,
      osaAhi: lastAhi,
      respiratoryRate: lastRr,
      bioAge: lastBioAge
    });

    const panel = document.getElementById('recommendations-panel');
    const list  = document.getElementById('recommendations-list');

    if (!tips.length) { panel.classList.add('hidden'); return; }

    panel.classList.remove('hidden');
    list.innerHTML = tips.map(t => `
      <div class="rec-item rec-priority-${t.priority}">
        <div class="rec-icon">${t.icon}</div>
        <div class="rec-body">
          <div class="rec-category">${t.category}</div>
          <div class="rec-title">${t.title}</div>
          <div class="rec-text">${t.body}</div>
        </div>
      </div>`).join('');
  }

  // ── Charts ────────────────────────────────────────────────
  function setupCharts() {
    const grid  = 'rgba(30,45,69,.6)';
    const tick  = '#64748B';
    const base  = { responsive: true, animation: false,
                    plugins: { legend: { display: false } },
                    scales: { x: { display: false },
                              y: { grid: { color: grid }, ticks: { color: tick, font: { size: 10 } } } } };

    const mkDs = (label, color, data=[]) => ({
      label, data, borderColor: color, borderWidth: 1.5,
      backgroundColor: color + '15', pointRadius: 0, tension: 0.3, fill: false
    });

    charts.accel = new Chart(document.getElementById('chart-accel'), {
      type: 'line',
      data: { labels: [], datasets: [mkDs('aX','#F87171'), mkDs('aY','#34D399'), mkDs('aZ','#22D3EE'),
              { ...mkDs('mag','#7B6CF6'), fill: true, backgroundColor: 'rgba(123,108,246,.08)' }] },
      options: { ...base }
    });

    charts.gyro = new Chart(document.getElementById('chart-gyro'), {
      type: 'line',
      data: { labels: [], datasets: [mkDs('gX','#F87171'), mkDs('gY','#34D399'), mkDs('gZ','#22D3EE')] },
      options: { ...base }
    });

    charts.history = new Chart(document.getElementById('chart-history'), {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'Kualitas', data: [],
              backgroundColor: 'rgba(123,108,246,.6)', borderColor: '#7B6CF6',
              borderWidth: 1, borderRadius: 4 }] },
      options: { responsive: true, plugins: { legend: { display: false } },
                 scales: { x: { ticks: { color: tick, font: { size: 9 } }, grid: { color: grid } },
                           y: { min: 0, max: 100, ticks: { color: tick }, grid: { color: grid } } } }
    });

    charts.duration = new Chart(document.getElementById('chart-duration'), {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'Durasi (jam)', data: [],
              backgroundColor: 'rgba(34,211,238,.5)', borderColor: '#22D3EE',
              borderWidth: 1, borderRadius: 4 }] },
      options: { responsive: true, plugins: { legend: { display: false } },
                 scales: { x: { ticks: { color: tick, font: { size: 9 } }, grid: { color: grid } },
                           y: { min: 0, ticks: { color: tick }, grid: { color: grid } } } }
    });

    charts.stages = new Chart(document.getElementById('chart-stages'), {
      type: 'doughnut',
      data: { labels: ['Tidur Dalam','REM','Tidur Ringan','Terjaga'],
              datasets: [{ data: [0,0,0,0],
                           backgroundColor: ['#7B6CF6','#22D3EE','#64748B','#FB923C'],
                           borderWidth: 0, hoverOffset: 4 }] },
      options: { responsive: true, cutout: '65%',
                 plugins: { legend: { display: false } } }
    });

    charts.resp = new Chart(document.getElementById('chart-resp'), {
      type: 'line',
      data: { labels: [], datasets: [{ ...mkDs('RR','#34D399'),
              backgroundColor: 'rgba(52,211,153,.1)', fill: true }] },
      options: { ...base, scales: {
        x: { display: true, ticks: { color: tick, font: { size: 9 } }, grid: { color: grid } },
        y: { min: 0, max: 40, grid: { color: grid }, ticks: { color: tick } }
      }, plugins: { legend: { display: false }, annotation: {} } }
    });

    drawGauge(0);
  }

  function updateCharts(imu) {
    const ts  = new Date(imu.ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const mag = SleepAnalysis.magnitude(imu.ax, imu.ay, imu.az);
    pushPt(charts.accel, ts, [imu.ax, imu.ay, imu.az, mag]);
    pushPt(charts.gyro,  ts, [imu.gx, imu.gy, imu.gz]);
  }

  function pushPt(chart, label, values) {
    chart.data.labels.push(label);
    values.forEach((v, i) => chart.data.datasets[i].data.push(v));
    if (chart.data.labels.length > MAX_CHART_PTS) {
      chart.data.labels.shift();
      chart.data.datasets.forEach(d => d.data.shift());
    }
    chart.update('none');
  }

  function drawGauge(value) {
    const canvas = document.getElementById('gauge-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, cx = W/2, cy = H - 4, r = H - 12;
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath(); ctx.arc(cx,cy,r,Math.PI,0);
    ctx.strokeStyle = '#1E2D45'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.stroke();
    const angle = Math.PI + value * Math.PI;
    ctx.beginPath(); ctx.arc(cx,cy,r,Math.PI,angle);
    const g = ctx.createLinearGradient(0,0,W,0);
    g.addColorStop(0,'#34D399'); g.addColorStop(0.5,'#FB923C'); g.addColorStop(1,'#F87171');
    ctx.strokeStyle = g; ctx.stroke();
  }

  // ── History ───────────────────────────────────────────────
  async function loadHistory() {
    const raw = await zdb.getSessions(14);
    sessions = Object.values(raw || {}).sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

    const list = document.getElementById('sessions-list');
    if (!sessions.length) {
      list.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg><p>Belum ada sesi tidur tercatat</p></div>`;
      return;
    }

    const recent7 = sessions.slice(-7);

    // Quality chart
    charts.history.data.labels   = recent7.map(s => fmtDateShort(s.startTime));
    charts.history.data.datasets[0].data = recent7.map(s => s.qualityScore || 0);
    charts.history.update();

    // Duration chart
    charts.duration.data.labels  = recent7.map(s => fmtDateShort(s.startTime));
    charts.duration.data.datasets[0].data = recent7.map(s =>
      Math.round((s.durationMs || 0) / 360000) / 10);
    charts.duration.update();

    // Weekly stats
    const avgQ   = Math.round(sessions.slice(-7).reduce((s,v) => s + (v.qualityScore||0), 0) / Math.min(sessions.length, 7));
    const avgDur = (sessions.slice(-7).reduce((s,v) => s + (v.durationMs||0), 0) / Math.min(sessions.length, 7) / 3600000).toFixed(1);
    const avgAhi = Math.round(sessions.slice(-7).reduce((s,v) => s + (v.ahiProxy||0), 0) / Math.min(sessions.length, 7));
    document.getElementById('weekly-stats').innerHTML = `
      <div class="weekly-stat-card"><div class="weekly-stat-val">${avgQ}</div><div class="weekly-stat-label">Rata-rata Kualitas</div></div>
      <div class="weekly-stat-card"><div class="weekly-stat-val">${avgDur}j</div><div class="weekly-stat-label">Rata-rata Durasi</div></div>
      <div class="weekly-stat-card"><div class="weekly-stat-val">${sessions.length}</div><div class="weekly-stat-label">Total Sesi</div></div>
      <div class="weekly-stat-card"><div class="weekly-stat-val">${avgAhi}</div><div class="weekly-stat-label">Rata-rata AHI</div></div>`;

    // Sessions list
    list.innerHTML = [...sessions].reverse().map(s => {
      const { label, cls } = SleepAnalysis.qualityLabel(s.qualityScore ?? null);
      const dur = s.durationMs ? fmtDur(s.durationMs) : '—';
      const date = s.startTime ? new Date(s.startTime).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
      return `<div class="session-item">
        <span class="session-date">${date}</span>
        <span class="session-duration">${dur}</span>
        <span class="session-quality metric-badge badge-${cls||'info'}">${s.qualityScore ?? '—'} — ${label}</span>
      </div>`;
    }).join('');

    // Update bio age after loading history
    updateBioAgeDisplay();
  }

  // ── Profile ───────────────────────────────────────────────
  function saveProfile() {
    profile = { ...profile, name: document.getElementById('pf-name').value,
      age: document.getElementById('pf-age').value, gender: document.getElementById('pf-gender').value };
    zdb.saveProfile(profile); persist(); showToast('Profil disimpan');
  }
  function saveRiskFactors() {
    profile = { ...profile,
      hypertension: document.getElementById('rf-hypertension').checked,
      diabetes: document.getElementById('rf-diabetes').checked,
      obesity:  document.getElementById('rf-obesity').checked,
      smoker:   document.getElementById('rf-smoker').checked,
      heartHistory: document.getElementById('rf-heart-history').checked,
      insomnia: document.getElementById('rf-insomnia').checked };
    zdb.saveProfile(profile); persist(); showToast('Faktor risiko disimpan');
  }
  function savePreferences() {
    profile = { ...profile, bedtime: document.getElementById('pf-bedtime').value,
      duration: document.getElementById('pf-duration').value };
    zdb.saveProfile(profile); persist(); showToast('Preferensi disimpan');
  }
  function persist() { localStorage.setItem('zleep_profile', JSON.stringify(profile)); }
  function loadProfileFromStorage() {
    const s = localStorage.getItem('zleep_profile');
    if (s) { try { profile = JSON.parse(s); applyProfileToForm(); } catch(_) {} }
  }
  function applyProfileToForm() {
    const set = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.value = v; };
    const chk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
    set('pf-name', profile.name); set('pf-age', profile.age); set('pf-gender', profile.gender);
    chk('rf-hypertension', profile.hypertension); chk('rf-diabetes', profile.diabetes);
    chk('rf-obesity', profile.obesity); chk('rf-smoker', profile.smoker);
    chk('rf-heart-history', profile.heartHistory); chk('rf-insomnia', profile.insomnia);
    set('pf-bedtime', profile.bedtime); set('pf-duration', profile.duration);
  }

  // ── PDF Export ────────────────────────────────────────────
  async function exportPdf() {
    if (!window.jspdf) { showToast('Library PDF belum dimuat'); return; }
    showToast('Membuat laporan PDF...');
    const stageSummary = stageTimeline.length ? SleepAnalysis.stageSummary(stageTimeline) : null;
    const lastSess     = sessions[sessions.length - 1] || null;

    await PdfExport.generate({
      profile,
      session: lastSess,
      stageSummary,
      apneaEvents,
      bioAge: lastBioAge,
      recommendations: document.getElementById('recommendations-list')
        ? Recommendations.generate({ profile, sessions, lastSession: lastSess,
            currentPosition: null, osaAhi: lastAhi, respiratoryRate: null, bioAge: lastBioAge })
        : []
    });
    showToast('PDF berhasil diunduh');
  }

  // ── Circadian ─────────────────────────────────────────────
  function updateCircadianMarker() {
    const now = new Date(); let mins = now.getHours() * 60 + now.getMinutes();
    const start = 20 * 60; let offset = mins - start;
    if (offset < 0) offset += 1440;
    const pct = Math.min(100, (offset / (12*60)) * 100);
    const m = document.getElementById('circadian-marker');
    if (m) m.style.left = pct + '%';
  }

  // ── Demo ──────────────────────────────────────────────────
  function startDemoStream() {
    let t = 0;
    demoInterval = setInterval(() => {
      t += 0.1;
      onImuData({
        ax: Math.sin(t * 0.3) * 0.12 + (Math.random()-.5) * 0.04,
        ay: Math.cos(t * 0.2) * 0.04 + (Math.random()-.5) * 0.02,
        az: 0.98 + Math.sin(t * 0.4) * 0.008 + (Math.random()-.5) * 0.003,
        gx: (Math.random()-.5) * 1.5,
        gy: (Math.random()-.5) * 1.5,
        gz: (Math.random()-.5) * 0.8,
        ts: Date.now()
      });
    }, 200);
  }
  function stopDemo() {
    clearInterval(demoInterval);
    isDemo = false; isConnected = false;
    showOverlay(); updateConnectionUI('disconnected', '');
    if (sessionActive) endSession();
  }

  // ── Router ────────────────────────────────────────────────
  function setupRouter() {
    window.addEventListener('hashchange', () => navigate(location.hash.replace('#','') || 'dashboard'));
    document.querySelectorAll('[data-section]').forEach(el =>
      el.addEventListener('click', () => navigate(el.dataset.section)));
    navigate(location.hash.replace('#','') || 'dashboard');
  }

  function navigate(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('section-' + section);
    if (target) target.classList.add('active');
    document.querySelectorAll('.nav-item,.bnav-item').forEach(el =>
      el.classList.toggle('active', el.dataset.section === section));
    const titles = { dashboard:'Dashboard', monitor:'Monitor Real-time', analysis:'Analisis', history:'Riwayat', profile:'Profil' };
    document.getElementById('page-title').textContent = titles[section] || section;
    if (section === 'history') loadHistory();
    if (section === 'analysis') updateAnalysisSection(
      stageTimeline.length ? SleepAnalysis.stageSummary(stageTimeline) : null, lastAhi);
    location.hash = section;
  }

  function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

  // ── Toast ─────────────────────────────────────────────────
  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.remove('hidden'); t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.classList.add('hidden'), 350); }, 3000);
  }

  // ── Helpers ───────────────────────────────────────────────
  function fmtDur(ms) {
    const h = Math.floor(ms/3600000), m = Math.floor((ms%3600000)/60000);
    return h ? `${h}j ${m}m` : `${m}m`;
  }
  function fmtDateShort(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    connect, connectDemo, toggleConnect,
    toggleSession, toggleSidebar,
    saveProfile, saveRiskFactors, savePreferences,
    loadHistory, exportPdf,
    showAuth, closeAuth, switchAuthTab,
    doLogin, doRegister, doAnonymous, doLogout
  };

})();

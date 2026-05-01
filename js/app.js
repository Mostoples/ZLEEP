/* ZLEEP — Main Application */

const app = (() => {

  // ── State ─────────────────────────────────────────────────
  let ble         = null;
  let zdb         = null;
  let isConnected = false;
  let isDemo      = false;
  let sessionActive = false;
  let sessionStart  = null;
  let timerInterval = null;
  let demoInterval  = null;
  let sampleBuffer  = [];    // rolling 60-second buffer (max 300 samples @5Hz)
  let batchBuffer   = [];    // batch for DB flush every 30s
  let batchTimer    = null;
  let sampleCount   = 0;
  let lastSampleTs  = null;
  let profile       = {};
  let charts        = {};
  let currentSection = 'dashboard';

  const MAX_CHART_POINTS = 300;  // 60s at 5Hz

  // ── Init ──────────────────────────────────────────────────
  function init() {
    zdb = new ZleepDatabase();
    ble = new ZleepBluetooth(onImuData, onBleStatus);

    setupCharts();
    setupRouter();
    loadProfileFromStorage();
    updateCircadianMarker();
    setInterval(updateCircadianMarker, 60000);

    // Restore profile from Firebase
    zdb.getProfile().then(p => {
      if (p) { profile = p; applyProfileToForm(); }
    });
  }

  // ── BLE Connection ────────────────────────────────────────
  async function connect() {
    try {
      showToast('Mencari perangkat ZLEEP...');
      await ble.connect();
    } catch (err) {
      if (err.name === 'NotFoundError') {
        showToast('Perangkat tidak ditemukan atau dibatalkan');
      } else {
        showToast('Error: ' + err.message, 'warn');
      }
    }
  }

  function connectDemo() {
    isDemo = true;
    isConnected = true;
    onBleStatus('demo', 'DEMO');
    hideOverlay();
    startDemoStream();
    showToast('Mode demo aktif');
  }

  function toggleConnect() {
    if (isConnected || isDemo) {
      if (isDemo) {
        stopDemo();
      } else {
        ble.disconnect();
      }
    } else {
      connect();
    }
  }

  function onBleStatus(status, name) {
    if (status === 'connected') {
      isConnected = true; isDemo = false;
      hideOverlay();
      updateConnectionUI('connected', name || 'ZLEEP');
      showToast(`Terhubung ke ${name}`);
    } else if (status === 'demo') {
      updateConnectionUI('demo', 'Demo Mode');
    } else {
      isConnected = false; isDemo = false;
      showOverlay();
      updateConnectionUI('disconnected', '');
      if (sessionActive) endSession();
      showToast('Perangkat terputus');
    }
  }

  function updateConnectionUI(status, name) {
    const statusEl   = document.getElementById('device-status');
    const labelEl    = document.getElementById('status-label');
    const btnEl      = document.getElementById('sidebar-connect-btn');
    const btnLabelEl = document.getElementById('connect-btn-label');
    const hdrStatus  = document.getElementById('header-status');
    const hdrLabel   = document.getElementById('header-status-label');
    const dot        = hdrStatus?.querySelector('.status-dot');

    statusEl.className  = 'device-status ' + status;
    labelEl.textContent = status === 'connected' ? name :
                          status === 'demo'      ? 'Mode Demo' : 'Tidak Terhubung';

    btnEl.className = 'btn-connect-sm ' + (status !== 'disconnected' ? 'connected' : '');
    btnLabelEl.textContent = status !== 'disconnected' ? 'Putuskan' : 'Hubungkan';

    if (dot) dot.className = 'status-dot ' + status;
    if (hdrLabel) hdrLabel.textContent =
      status === 'connected' ? name :
      status === 'demo'      ? 'Demo' : 'Offline';
  }

  // ── Overlay ───────────────────────────────────────────────
  function showOverlay() {
    document.getElementById('connect-overlay').classList.remove('hidden');
  }
  function hideOverlay() {
    document.getElementById('connect-overlay').classList.add('hidden');
  }

  // ── Session ───────────────────────────────────────────────
  function toggleSession() {
    if (sessionActive) endSession();
    else startSession();
  }

  function startSession() {
    sessionActive = true;
    sessionStart  = Date.now();
    sampleBuffer  = [];
    batchBuffer   = [];

    zdb.startSession({ deviceName: isDemo ? 'DEMO' : (ble.device?.name || 'ZLEEP') });

    const btn = document.getElementById('session-toggle-btn');
    const lbl = document.getElementById('session-btn-label');
    btn.classList.add('active');
    lbl.textContent = 'Akhiri Sesi';

    const timer = document.getElementById('session-timer');
    timer.classList.remove('hidden');
    timer.classList.add('active');
    timerInterval = setInterval(updateTimer, 1000);

    batchTimer = setInterval(flushBatch, 30000);

    showToast('Sesi tidur dimulai');
  }

  function endSession() {
    if (!sessionActive) return;
    sessionActive = false;

    clearInterval(timerInterval);
    clearInterval(batchTimer);
    flushBatch();

    const durationMs = Date.now() - sessionStart;
    const quality    = SleepAnalysis.qualityScore(sampleBuffer, durationMs);
    const risk       = SleepAnalysis.cardioRisk(profile, quality, durationMs / 3600000);

    zdb.endSession({ qualityScore: quality, durationMs, riskScore: risk });

    const btn = document.getElementById('session-toggle-btn');
    const lbl = document.getElementById('session-btn-label');
    btn.classList.remove('active');
    lbl.textContent = 'Mulai Sesi Tidur';

    document.getElementById('session-timer').classList.add('hidden');
    document.getElementById('session-timer').classList.remove('active');

    updateQualityDisplay(quality);
    showToast(`Sesi selesai — Kualitas: ${quality ?? '—'}`);
  }

  function updateTimer() {
    const elapsed = Date.now() - sessionStart;
    const h = String(Math.floor(elapsed / 3600000)).padStart(2, '0');
    const m = String(Math.floor((elapsed % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');
    document.getElementById('timer-display').textContent = `${h}:${m}:${s}`;
  }

  // ── IMU Data Handler ──────────────────────────────────────
  function onImuData(imu) {
    // Rate tracking
    const now = Date.now();
    if (lastSampleTs) {
      const hz = Math.round(1000 / (now - lastSampleTs));
      document.getElementById('sample-rate-badge').textContent = hz + ' Hz';
    }
    lastSampleTs = now;
    sampleCount++;

    // Buffer (keep last 300 samples)
    sampleBuffer.push(imu);
    if (sampleBuffer.length > MAX_CHART_POINTS) sampleBuffer.shift();
    if (sessionActive) batchBuffer.push(imu);

    // Push to Firebase
    if (sessionActive) zdb.pushImuSample(imu);

    // Update UI
    updateRawDisplay(imu);
    updateCharts(imu);
    updatePositionDisplay(imu);
    updateMovementDisplay();
    document.getElementById('accel-badge').textContent =
      `a: ${imu.ax.toFixed(2)}, ${imu.ay.toFixed(2)}, ${imu.az.toFixed(2)} g`;
  }

  function flushBatch() {
    zdb.flushImuBatch(batchBuffer);
    batchBuffer = [];
  }

  // ── Raw display ───────────────────────────────────────────
  function updateRawDisplay(imu) {
    document.getElementById('raw-ax').textContent = imu.ax.toFixed(2);
    document.getElementById('raw-ay').textContent = imu.ay.toFixed(2);
    document.getElementById('raw-az').textContent = imu.az.toFixed(2);
    document.getElementById('raw-gx').textContent = imu.gx.toFixed(2);
    document.getElementById('raw-gy').textContent = imu.gy.toFixed(2);
    document.getElementById('raw-gz').textContent = imu.gz.toFixed(2);
  }

  // ── Charts ────────────────────────────────────────────────
  function setupCharts() {
    const gridColor  = 'rgba(30,45,69,.6)';
    const tickColor  = '#64748B';
    const baseOpts = {
      responsive: true,
      animation: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      scales: {
        x: { display: false },
        y: {
          grid: { color: gridColor },
          ticks: { color: tickColor, font: { size: 10 } }
        }
      }
    };

    const makeDataset = (label, color, data = []) => ({
      label, data,
      borderColor: color, borderWidth: 1.5,
      backgroundColor: color + '15',
      pointRadius: 0, tension: 0.3, fill: false
    });

    // Accel chart
    charts.accel = new Chart(document.getElementById('chart-accel'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          makeDataset('aX', '#F87171'),
          makeDataset('aY', '#34D399'),
          makeDataset('aZ', '#22D3EE'),
          { ...makeDataset('mag', '#7B6CF6'), fill: true, backgroundColor: 'rgba(123,108,246,.08)' }
        ]
      },
      options: { ...baseOpts }
    });

    // Gyro chart
    charts.gyro = new Chart(document.getElementById('chart-gyro'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          makeDataset('gX', '#F87171'),
          makeDataset('gY', '#34D399'),
          makeDataset('gZ', '#22D3EE')
        ]
      },
      options: { ...baseOpts }
    });

    // History chart
    charts.history = new Chart(document.getElementById('chart-history'), {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: 'Kualitas Tidur',
          data: [],
          backgroundColor: 'rgba(123,108,246,.6)',
          borderColor: '#7B6CF6',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: tickColor, font: { size: 10 } }, grid: { color: gridColor } },
          y: { min: 0, max: 100, ticks: { color: tickColor }, grid: { color: gridColor } }
        }
      }
    });

    drawGauge(0);
  }

  function updateCharts(imu) {
    const ts  = new Date(imu.ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const mag = SleepAnalysis.magnitude(imu.ax, imu.ay, imu.az);

    pushChartData(charts.accel, ts, [imu.ax, imu.ay, imu.az, mag]);
    pushChartData(charts.gyro,  ts, [imu.gx, imu.gy, imu.gz]);
  }

  function pushChartData(chart, label, values) {
    chart.data.labels.push(label);
    values.forEach((v, i) => chart.data.datasets[i].data.push(v));
    if (chart.data.labels.length > MAX_CHART_POINTS) {
      chart.data.labels.shift();
      chart.data.datasets.forEach(d => d.data.shift());
    }
    chart.update('none');
  }

  // ── Gauge (semi-circle) ───────────────────────────────────
  function drawGauge(value) {
    const canvas = document.getElementById('gauge-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2, cy = H - 4, r = H - 12;
    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.strokeStyle = '#1E2D45'; ctx.lineWidth = 10;
    ctx.lineCap = 'round'; ctx.stroke();

    // Value arc
    const angle = Math.PI + (value / 1) * Math.PI;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, angle);
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#34D399');
    grad.addColorStop(0.5, '#FB923C');
    grad.addColorStop(1, '#F87171');
    ctx.strokeStyle = grad; ctx.stroke();
  }

  function updateMovementDisplay() {
    const recent = sampleBuffer.slice(-30);
    const intensity = SleepAnalysis.movementIntensity(recent);
    document.getElementById('movement-val').textContent = intensity.toFixed(2);
    drawGauge(intensity);
  }

  // ── Position display ──────────────────────────────────────
  function updatePositionDisplay(imu) {
    const pos = SleepAnalysis.detectPosition(imu.ax, imu.ay, imu.az);
    document.getElementById('sleep-position-val').textContent = pos.label;
    const body = document.querySelector('.position-body');
    if (body) body.style.transform = `rotate(${pos.angle}deg)`;
  }

  // ── Quality display ───────────────────────────────────────
  function updateQualityDisplay(score) {
    const { label, cls } = SleepAnalysis.qualityLabel(score);
    const valEl  = document.getElementById('sleep-quality-val');
    const badgeEl = document.getElementById('sleep-quality-badge');
    const barEl   = document.getElementById('sleep-quality-bar');

    valEl.textContent   = score !== null ? score : '—';
    valEl.className     = 'metric-value ' + cls;
    badgeEl.textContent = label;
    badgeEl.className   = 'metric-badge badge-' + (cls || 'info');
    if (barEl && score) barEl.style.width = score + '%';

    // Risk
    const riskScore = SleepAnalysis.cardioRisk(profile, score, 8);
    const risk = SleepAnalysis.riskLabel(riskScore);
    document.getElementById('risk-val').textContent = riskScore + '%';
    document.getElementById('risk-val').className   = 'metric-value ' + risk.cls;
    document.getElementById('risk-badge').textContent = risk.label;
    document.getElementById('risk-badge').className   = 'metric-badge badge-' + risk.cls;
  }

  // ── Circadian marker ──────────────────────────────────────
  function updateCircadianMarker() {
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes();
    // Map 20:00–08:00 (12h window) to 0–100%
    let mins = h * 60 + m;
    const start = 20 * 60;  // 20:00
    let offset = mins - start;
    if (offset < 0) offset += 1440;
    const pct = Math.min(100, (offset / (12 * 60)) * 100);

    const marker = document.getElementById('circadian-marker');
    if (marker) marker.style.left = pct + '%';
  }

  // ── Demo mode ─────────────────────────────────────────────
  function startDemoStream() {
    let t = 0;
    demoInterval = setInterval(() => {
      t += 0.1;
      const imu = {
        ax:  Math.sin(t * 0.3) * 0.15 + (Math.random() - .5) * 0.05,
        ay:  Math.cos(t * 0.2) * 0.05 + (Math.random() - .5) * 0.02,
        az:  0.98 + (Math.random() - .5) * 0.04,
        gx:  (Math.random() - .5) * 2,
        gy:  (Math.random() - .5) * 2,
        gz:  (Math.random() - .5) * 1,
        ts:  Date.now()
      };
      onImuData(imu);
    }, 200); // 5 Hz demo
  }

  function stopDemo() {
    clearInterval(demoInterval);
    isDemo = false; isConnected = false;
    showOverlay();
    updateConnectionUI('disconnected', '');
    if (sessionActive) endSession();
  }

  // ── History ───────────────────────────────────────────────
  async function loadHistory() {
    const sessions = await zdb.getSessions(10);
    const list = document.getElementById('sessions-list');
    list.innerHTML = '';

    const items = Object.values(sessions || {}).reverse();
    if (!items.length) {
      list.innerHTML = `<div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        <p>Belum ada sesi tidur tercatat</p></div>`;
      return;
    }

    // Update history chart
    const labels  = items.slice(0, 7).map(s => {
      const d = new Date(s.startTime);
      return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    });
    const scores  = items.slice(0, 7).map(s => s.qualityScore || 0);
    charts.history.data.labels  = labels;
    charts.history.data.datasets[0].data = scores;
    charts.history.update();

    // Render list
    items.forEach(s => {
      const start = new Date(s.startTime);
      const dur   = s.durationMs ? formatDuration(s.durationMs) : '—';
      const { label, cls } = SleepAnalysis.qualityLabel(s.qualityScore || null);
      list.innerHTML += `
        <div class="session-item">
          <span class="session-date">${start.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
          <span class="session-duration">${dur}</span>
          <span class="session-quality metric-badge badge-${cls || 'info'}">${s.qualityScore ?? '—'} — ${label}</span>
        </div>`;
    });
  }

  function formatDuration(ms) {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h ? `${h}j ${m}m` : `${m}m`;
  }

  // ── Profile ───────────────────────────────────────────────
  function saveProfile() {
    profile = {
      name:    document.getElementById('pf-name').value,
      age:     document.getElementById('pf-age').value,
      gender:  document.getElementById('pf-gender').value,
      ...profile
    };
    zdb.saveProfile(profile);
    localStorage.setItem('zleep_profile', JSON.stringify(profile));
    showToast('Profil disimpan');
  }

  function saveRiskFactors() {
    profile = {
      ...profile,
      hypertension: document.getElementById('rf-hypertension').checked,
      diabetes:     document.getElementById('rf-diabetes').checked,
      obesity:      document.getElementById('rf-obesity').checked,
      smoker:       document.getElementById('rf-smoker').checked,
      heartHistory: document.getElementById('rf-heart-history').checked,
      insomnia:     document.getElementById('rf-insomnia').checked
    };
    zdb.saveProfile(profile);
    localStorage.setItem('zleep_profile', JSON.stringify(profile));
    showToast('Faktor risiko disimpan');
  }

  function savePreferences() {
    profile = {
      ...profile,
      bedtime:  document.getElementById('pf-bedtime').value,
      duration: document.getElementById('pf-duration').value,
      notify:   document.getElementById('pf-notify').value
    };
    zdb.saveProfile(profile);
    localStorage.setItem('zleep_profile', JSON.stringify(profile));
    showToast('Preferensi disimpan');
  }

  function loadProfileFromStorage() {
    const saved = localStorage.getItem('zleep_profile');
    if (saved) { profile = JSON.parse(saved); applyProfileToForm(); }
  }

  function applyProfileToForm() {
    const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    const chk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
    set('pf-name', profile.name); set('pf-age', profile.age); set('pf-gender', profile.gender);
    chk('rf-hypertension', profile.hypertension); chk('rf-diabetes', profile.diabetes);
    chk('rf-obesity', profile.obesity); chk('rf-smoker', profile.smoker);
    chk('rf-heart-history', profile.heartHistory); chk('rf-insomnia', profile.insomnia);
    set('pf-bedtime', profile.bedtime); set('pf-duration', profile.duration);
  }

  // ── Router ────────────────────────────────────────────────
  function setupRouter() {
    const handleHash = () => {
      const hash = location.hash.replace('#', '') || 'dashboard';
      navigateTo(hash);
    };
    window.addEventListener('hashchange', handleHash);
    handleHash();

    document.querySelectorAll('[data-section]').forEach(el => {
      el.addEventListener('click', () => navigateTo(el.dataset.section));
    });
  }

  function navigateTo(section) {
    currentSection = section;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('section-' + section);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-item, .bnav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.section === section);
    });

    const titles = { dashboard: 'Dashboard', monitor: 'Monitor Real-time', history: 'Riwayat', profile: 'Profil' };
    document.getElementById('page-title').textContent = titles[section] || section;

    if (section === 'history') loadHistory();
    location.hash = section;
  }

  // ── Sidebar toggle (mobile) ───────────────────────────────
  function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
  }

  // ── Toast ─────────────────────────────────────────────────
  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.classList.add('hidden'), 350);
    }, 3000);
  }

  // ── Public API ────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);

  return {
    connect, connectDemo, toggleConnect,
    toggleSession, toggleSidebar,
    saveProfile, saveRiskFactors, savePreferences,
    loadHistory
  };

})();

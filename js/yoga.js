/* ZLEEP Yoga — Sleep-optimized pose library & interactive timer */

const ZleepYoga = (() => {

  // ══ POSE LIBRARY ══════════════════════════════════════════════
  const P = {
    child:       { id:'child',       name:'Balasana',              local:'Pose Anak',              dur:60,  cat:'presleep',  diff:1, icon:'🙇', cue:'Berlutut, duduk di atas tumit, rentangkan tangan ke depan, dahi menyentuh lantai.', breathNote:'Napas perut perlahan. Setiap embusan, rasakan seluruh tubuh rileks.', benefits:['Menenangkan sistem saraf','Meredakan stres & kecemasan','Meregangkan punggung bawah'] },
    legswall:    { id:'legswall',    name:'Viparita Karani',       local:'Kaki ke Dinding',        dur:300, cat:'presleep',  diff:1, icon:'🦵', cue:'Berbaring terlentang, angkat kedua kaki lurus ke dinding. Bokong sedekat mungkin ke dinding. Tutup mata.', breathNote:'Napas natural, dalam dan lambat. Biarkan gravitasi menarik bahu ke lantai.', benefits:['Mempercepat onset tidur','Menurunkan tekanan darah','Memulihkan kaki lelah'], evidence:'Khalsa 2004 — yoga significantly reduces insomnia severity' },
    butterfly:   { id:'butterfly',   name:'Supta Baddha Konasana', local:'Kupu-kupu Berbaring',    dur:120, cat:'presleep',  diff:1, icon:'🦋', cue:'Berbaring, telapak kaki saling bersentuhan, lutut jatuh ke samping. Tangan di perut, tutup mata.', breathNote:'4 hitungan hirup, 6 hitungan buang. Bayangkan bahu tenggelam ke lantai.', benefits:['Melepas ketegangan pinggul','Stimulasi saraf vagus','Mengurangi kecemasan'] },
    twist:       { id:'twist',       name:'Supta Matsyendrasana',  local:'Twist Berbaring',        dur:60,  cat:'presleep',  diff:1, icon:'🔄', cue:'Berbaring, tarik satu lutut ke dada lalu jatuhkan ke sisi berlawanan. Bentangkan kedua tangan. Ulang sisi lain.', breathNote:'Saat embusan napas, biarkan tubuh menyerah lebih dalam ke gravitasi.', benefits:['Melepas ketegangan tulang belakang','Melancarkan pencernaan','Relaksasi mendalam'] },
    happybaby:   { id:'happybaby',   name:'Ananda Balasana',       local:'Pose Bayi Bahagia',      dur:90,  cat:'presleep',  diff:1, icon:'👶', cue:'Berbaring, tekuk lutut ke dada. Pegang bagian luar kaki. Buka lutut selebar pinggul, tarik ke arah ketiak.', breathNote:'Ayun tubuh perlahan kiri-kanan sambil napas dalam. Senyum kecil.', benefits:['Reset sistem saraf','Melepas punggung bawah','Terbukti mengurangi insomnia'] },
    bridge:      { id:'bridge',      name:'Setu Bandhasana',       local:'Pose Jembatan',          dur:45,  cat:'presleep',  diff:2, icon:'🌉', cue:'Berbaring, tekuk lutut, telapak kaki di lantai selebar pinggul. Angkat pinggul sambil hirup napas.', breathNote:'Hirup saat naik, buang saat tahan. Napas tenang selama pose.', benefits:['Merangsang kelenjar tiroid','Mengurangi kecemasan','Menstimulasi melatonin'] },
    savasana:    { id:'savasana',    name:'Savasana',               local:'Pose Mayat',             dur:300, cat:'presleep',  diff:1, icon:'😌', cue:'Berbaring sempurna, kaki terbuka, tangan di samping telapak ke atas. Tutup mata. Lepaskan semua kontrol.', breathNote:'Napas natural. Setiap embusan, rasakan tubuh semakin berat tenggelam ke lantai.', benefits:['Aktivasi gelombang alfa otak','Menurunkan kortisol','Persiapan tidur terdalam'] },
    forwardfold: { id:'forwardfold', name:'Uttanasana',             local:'Lipatan ke Depan',       dur:60,  cat:'presleep',  diff:1, icon:'🏃', cue:'Berdiri, tekuk perlahan ke depan. Biarkan kepala dan tangan menjuntai bebas. Tekuk sedikit lutut.', breathNote:'Setiap embusan, biarkan gravitasi menarik tubuh lebih dalam.', benefits:['Meredakan pikiran aktif','Aktivasi saraf vagus','Menenangkan sistem saraf'] },
    breath478:   { id:'breath478',   name:'4-7-8 Breathing',        local:'Napas 4-7-8',           dur:96,  cat:'breathing', diff:1, icon:'💨', cue:'Tutup mulut, hirup lewat hidung 4 hitungan. Tahan 7 hitungan. Buang lewat mulut 8 hitungan. Ulangi 4 siklus.', breathNote:'Dr. Andrew Weil: teknik ini adalah "penenang saraf alami terkuat yang diketahui".', benefits:['Tidur lebih cepat','Menurunkan denyut jantung','Mengaktifkan parasimpatis'], breathPattern:[4,7,8] },
    boxbreath:   { id:'boxbreath',   name:'Box Breathing',          local:'Napas Kotak',           dur:80,  cat:'breathing', diff:1, icon:'⬜', cue:'Hirup 4 detik → tahan 4 detik → buang 4 detik → tahan 4 detik. Ulangi 5 siklus.', breathNote:'Digunakan Navy SEAL untuk kendali stres. Sangat efektif menurunkan kortisol pre-sleep.', benefits:['Menurunkan kortisol','Mengurangi kecemasan','Menstabilkan tekanan darah'], breathPattern:[4,4,4,4] },
    nadi:        { id:'nadi',        name:'Nadi Shodhana',          local:'Napas Lubang Bergantian',dur:180, cat:'breathing', diff:2, icon:'👃', cue:'Tutup lubang kanan, hirup kiri. Tutup kiri, buang kanan. Tutup kanan, hirup kiri. Tutup kiri, buang kanan. Lanjutkan.', breathNote:'Pranayama klasik Ayurveda. Menyeimbangkan sistem saraf kiri-kanan.', benefits:['Menyeimbangkan sistem saraf','Meningkatkan melatonin alami','Persiapan tidur mendalam'] },
    brahmari:    { id:'brahmari',    name:'Brahmari Pranayama',     local:'Napas Lebah',           dur:120, cat:'breathing', diff:1, icon:'🐝', cue:'Tutup telinga dengan ibu jari. Hirup dalam, lalu buang sambil berdengung "hmmm" panjang. Ulangi 6 kali.', breathNote:'Getaran humming langsung stimulasi saraf vagus — bukti kuat untuk mengatasi insomnia.', benefits:['Aktivasi saraf vagus','Mengurangi pikiran berlebihan','Menurunkan tekanan darah'] },
    surya:       { id:'surya',       name:'Surya Namaskar',         local:'Salam Matahari',        dur:180, cat:'morning',   diff:2, icon:'☀️', cue:'12 gerakan berurutan mengikuti napas: Mountain → Raise Arms → Forward Fold → Low Lunge → Plank → Cobra → Down Dog → kembali. Ulangi 3x.', breathNote:'Koordinasikan setiap gerakan dengan napas. Ritmis dan mengalir seperti tarian.', benefits:['Mengaktifkan metabolisme','Meningkatkan energi','Melancarkan sirkulasi darah'] },
    warrior:     { id:'warrior',     name:'Virabhadrasana I',       local:'Pose Pejuang I',        dur:45,  cat:'morning',   diff:2, icon:'⚔️', cue:'Kaki lebar, kaki belakang miring 45°. Tekuk lutut depan 90°. Angkat kedua tangan ke atas, dada terbuka.', breathNote:'Napas penuh ke dada. Pandangan ke atas. Rasakan kekuatan dan kepercayaan diri.', benefits:['Membangunkan tubuh','Memperkuat kaki & inti','Meningkatkan kepercayaan diri'] },
    tree:        { id:'tree',        name:'Vrksasana',              local:'Pose Pohon',            dur:60,  cat:'morning',   diff:2, icon:'🌳', cue:'Berdiri satu kaki, telapak kaki lain di paha dalam (bukan lutut). Tangan seperti berdoa atau angkat ke atas.', breathNote:'Fokus ke satu titik di lantai. Napas tenang adalah kunci keseimbangan.', benefits:['Meningkatkan fokus','Keseimbangan kortisol pagi','Melatih propriosepsi'] },
    downdog:     { id:'downdog',     name:'Adho Mukha Svanasana',   local:'Anjing Menghadap Bawah',dur:60,  cat:'morning',   diff:2, icon:'🐕', cue:'Mulai dari plank, angkat pinggul tinggi ke atas membentuk segitiga terbalik. Tekan tumit ke lantai.', breathNote:'5 napas panjang penuh. Setiap embusan, tekuk dada lebih dalam ke paha.', benefits:['Mengalirkan darah ke otak','Meregangkan seluruh tubuh','Energi & fokus pagi'] },
  };

  // ══ ROUTINES ═══════════════════════════════════════════════════
  const ROUTINES = {
    sleepDeep:    { id:'sleepDeep',    name:'Tidur Nyenyak',       cat:'presleep',  dur:18, tag:'Deep Sleep', tagCls:'teal',   poses:['legswall','butterfly','child','twist','happybaby','savasana'], desc:'Rutin 18 menit memaksimalkan deep sleep & REM melalui stimulasi parasimpatis dan relaksasi mendalam.', evidence:'Khalsa 2004 (n=20), Chen 2009 (elderly insomnia RCT)' },
    winddown:     { id:'winddown',     name:'Wind-Down Cepat',     cat:'presleep',  dur:10, tag:'10 Menit',   tagCls:'purple', poses:['breath478','child','twist','happybaby','savasana'], desc:'Sesi 10 menit untuk malam sibuk. Kombinasi napas 4-7-8 dan pose restoratif esensial.', evidence:'Weil 4-7-8 protocol + restorative yoga guidelines' },
    breathwork:   { id:'breathwork',   name:'Terapi Pernapasan',   cat:'breathing', dur:12, tag:'Pernapasan', tagCls:'violet', poses:['breath478','boxbreath','nadi','brahmari'], desc:'Pranayama untuk menurunkan kortisol, menstabilkan denyut jantung, dan mempercepat onset tidur.', evidence:'Zaccaro 2018, Jerath 2006 (slow breathing & autonomic nervous system)' },
    morningEnergy:{ id:'morningEnergy',name:'Energi Pagi',         cat:'morning',   dur:10, tag:'Pagi Hari',  tagCls:'orange', poses:['surya','warrior','tree','downdog'], desc:'Aktifkan metabolisme dan konsentrasi setelah bangun tidur dengan Surya Namaskar dan pose energi.', evidence:'Rshikesan 2020 (yoga & cognitive function after sleep, n=30)' },
    stressRelief: { id:'stressRelief', name:'Anti Stres & Cemas',  cat:'presleep',  dur:15, tag:'Stres Tinggi',tagCls:'danger', poses:['breath478','forwardfold','butterfly','brahmari','savasana'], desc:'Dirancang untuk malam dengan stres tinggi. Fokus pada stimulasi vagus nerve dan GABA release.', evidence:'Streeter 2012 (yoga increases GABA-A), Brown 2005 (vagal breathing)' },
  };

  // ══ TIMER STATE ═════════════════════════════════════════════════
  let _int     = null;
  let _sec     = 0;
  let _idx     = 0;
  let _poses   = [];
  let _paused  = false;
  let _rName   = '';
  let _bSec    = 0;
  let _rafId   = null;

  // ══ RECOMMENDATION ══════════════════════════════════════════════
  function recommend(sleepQ, zcsScore, lngScore, deepPct) {
    const r = [];
    if (sleepQ !== null && sleepQ < 60)            r.push('sleepDeep');
    if (zcsScore > 45)                              r.push('breathwork');
    if (lngScore !== null && lngScore < 55)         r.push('stressRelief');
    if (deepPct  !== null && deepPct  < 15)         r.push('sleepDeep');
    if (!r.length)                                  r.push('winddown');
    return [...new Set(r)].slice(0, 2);
  }

  // ══ SECTION RENDER ══════════════════════════════════════════════
  function initSection() { _renderTab('presleep'); }

  function changeTab(cat, el) {
    document.querySelectorAll('.yoga-tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    _renderTab(cat);
  }

  function _renderTab(cat) {
    const rc = document.getElementById('yoga-routines');
    const pc = document.getElementById('yoga-poses');
    if (rc) rc.innerHTML = Object.values(ROUTINES).filter(r => r.cat === cat).map(_routineCard).join('');
    if (pc) pc.innerHTML = Object.values(P).filter(p => p.cat === cat).map(_poseCard).join('');
  }

  function _routineCard(r) {
    const tagColors = { teal:'var(--teal)', purple:'var(--primary)', violet:'#A78BFA', orange:'var(--warn)', danger:'var(--danger)' };
    const col = tagColors[r.tagCls] || 'var(--primary)';
    return `<div class="yoga-routine-card" onclick="ZleepYoga.startRoutine('${r.id}')">
      <div class="yrc-top">
        <div class="yrc-left">
          <div class="yrc-name">${r.name}</div>
          <div class="yrc-meta"><span>⏱ ${r.dur} mnt</span><span>🧘 ${r.poses.length} pose</span></div>
        </div>
        <span class="yrc-tag" style="color:${col};border-color:${col}">${r.tag}</span>
      </div>
      <div class="yrc-desc">${r.desc}</div>
      <div class="yrc-evidence">📚 ${r.evidence}</div>
      <button class="yrc-btn">Mulai Rutin →</button>
    </div>`;
  }

  function _poseCard(p) {
    const dots = '●'.repeat(p.diff) + '○'.repeat(3 - p.diff);
    const dur  = p.dur >= 60 ? Math.floor(p.dur / 60) + ' mnt' : p.dur + ' dtk';
    return `<div class="yoga-pose-card" onclick="ZleepYoga.startPoses(['${p.id}'], '${p.local}')">
      <div class="ypc-icon">${p.icon}</div>
      <div class="ypc-name">${p.local}</div>
      <div class="ypc-sanskrit">${p.name}</div>
      <div class="ypc-meta"><span class="ypc-dur">${dur}</span><span class="ypc-diff">${dots}</span></div>
      <div class="ypc-benefits">${p.benefits.slice(0,2).map(b=>`<span class="ypc-chip">${b}</span>`).join('')}</div>
    </div>`;
  }

  // ══ TIMER ════════════════════════════════════════════════════════
  function startRoutine(id) {
    const r = ROUTINES[id];
    if (!r) return;
    startPoses(r.poses, r.name);
  }

  function startPoses(ids, rName) {
    _poses  = (Array.isArray(ids) ? ids : [ids]).map(id => P[id]).filter(Boolean);
    if (!_poses.length) return;
    _rName  = rName || '';
    _idx    = 0;
    _paused = false;
    const ov = document.getElementById('yoga-timer-overlay');
    if (ov) { ov.classList.remove('hidden'); ov.style.opacity = '0'; setTimeout(() => { ov.style.opacity = '1'; }, 10); }
    _loadPose();
    _startTick();
  }

  function _loadPose() {
    const p = _poses[_idx];
    if (!p) { _finish(); return; }
    _sec  = p.dur;
    _bSec = 0;
    _set('yt-icon',    p.icon);
    _set('yt-name',    p.name);
    _set('yt-local',   p.local);
    _set('yt-cue',     p.cue);
    _set('yt-bnote',   p.breathNote || '');
    _set('yt-rtitle',  _rName);
    _set('yt-prog',    `${_idx + 1} / ${_poses.length}`);
    const nxt = _poses[_idx + 1];
    _set('yt-next',    nxt ? `Selanjutnya: ${nxt.local}` : '✓ Pose terakhir');
    _updateCountdown();
    _updateRing(p.dur, p.dur);
    _renderDots();
  }

  function _startTick() {
    clearInterval(_int);
    _int = setInterval(() => {
      if (_paused) return;
      _sec--;
      _bSec++;
      _updateCountdown();
      _updateRing(_poses[_idx]?.dur || _sec, _sec);
      _updateBreath(_poses[_idx]);
      if (_sec <= 0) {
        _idx++;
        _idx >= _poses.length ? _finish() : _loadPose();
      }
    }, 1000);
  }

  function _updateCountdown() {
    const el = document.getElementById('yt-countdown');
    if (!el) return;
    const m = Math.floor(_sec / 60), s = _sec % 60;
    el.textContent = m > 0 ? `${m}:${s.toString().padStart(2,'0')}` : _sec.toString();
  }

  function _updateRing(total, remaining) {
    const c = document.getElementById('yt-ring-fill');
    if (!c) return;
    const r   = 52;
    const circ = 2 * Math.PI * r;
    c.style.strokeDasharray  = circ;
    c.style.strokeDashoffset = circ * (1 - Math.max(0, remaining) / total);
  }

  function _updateBreath(pose) {
    const bc = document.getElementById('yt-breath-circle');
    const bt = document.getElementById('yt-breath-text');
    if (!bc || !bt) return;
    const bp     = pose?.breathPattern;
    const labels = ['HIRUP','TAHAN','BUANG','TAHAN'];
    if (bp) {
      const total = bp.reduce((a, b) => a + b, 0);
      const phase = _bSec % total;
      let cum = 0;
      for (let i = 0; i < bp.length; i++) {
        cum += bp[i];
        if (phase < cum) {
          const t = (phase - (cum - bp[i])) / bp[i];
          bt.textContent = labels[i];
          // i0=inhale: grow, i1=hold: big, i2=exhale: shrink, i3=hold: small
          const sc = i === 0 ? 0.75 + t * 0.45 : i === 1 ? 1.2 : i === 2 ? 1.2 - t * 0.45 : 0.75;
          bc.style.transform = `scale(${sc})`;
          bc.style.opacity   = i === 0 ? 0.55 + t * 0.45 : i === 1 ? 1 : 1 - t * 0.45;
          break;
        }
      }
    } else {
      const cycle = _bSec % 10;
      if (cycle < 4) {
        const t = cycle / 4;
        bt.textContent = 'HIRUP';
        bc.style.transform = `scale(${0.75 + t * 0.4})`;
        bc.style.opacity   = (0.55 + t * 0.45).toString();
      } else {
        const t = (cycle - 4) / 6;
        bt.textContent = 'BUANG';
        bc.style.transform = `scale(${1.15 - t * 0.4})`;
        bc.style.opacity   = (1 - t * 0.45).toString();
      }
    }
  }

  function _renderDots() {
    const el = document.getElementById('yt-dots');
    if (!el) return;
    el.innerHTML = _poses.map((p, i) =>
      `<span class="yt-dot ${i < _idx ? 'done' : i === _idx ? 'active' : ''}" title="${p.local}"></span>`
    ).join('');
  }

  function _finish() {
    clearInterval(_int);
    const ov = document.getElementById('yoga-timer-overlay');
    if (ov) ov.classList.add('hidden');
    const co = document.getElementById('yoga-complete-overlay');
    if (co) { co.classList.remove('hidden'); setTimeout(() => co.classList.add('hidden'), 3800); }
  }

  function togglePause() {
    _paused = !_paused;
    const btn = document.getElementById('yt-pause-btn');
    if (btn) btn.innerHTML = _paused
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>Lanjut'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="4" x2="6" y2="20"/><line x1="18" y1="4" x2="18" y2="20"/></svg>Jeda';
  }

  function skipPose() {
    _idx++;
    _idx >= _poses.length ? _finish() : _loadPose();
  }

  function stopTimer() {
    clearInterval(_int);
    _paused = false;
    const ov = document.getElementById('yoga-timer-overlay');
    if (ov) ov.classList.add('hidden');
  }

  function _set(id, txt) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  }

  return { initSection, changeTab, recommend, startRoutine, startPoses, togglePause, skipPose, stopTimer };
})();

// ZLEEP Sleep Analysis Engine

const SleepAnalysis = {

  // ── Position ───────────────────────────────────────────
  detectPosition(ax, ay, az) {
    const mag = Math.sqrt(ax*ax + ay*ay + az*az);
    if (mag < 0.1) return { label: 'Tidak Diketahui', key: 'unknown', angle: 0 };
    const naz = az / mag, nay = ay / mag;
    if (naz >  0.75) return { label: 'Terlentang',  key: 'supine',  angle: 0   };
    if (naz < -0.75) return { label: 'Tengkurap',   key: 'prone',   angle: 180 };
    if (nay >  0.65) return { label: 'Miring Kanan', key: 'right',  angle: 90  };
    if (nay < -0.65) return { label: 'Miring Kiri',  key: 'left',   angle: -90 };
    return              { label: 'Miring',          key: 'side',   angle: 45  };
  },

  // ── Magnitude ──────────────────────────────────────────
  magnitude(ax, ay, az) { return Math.sqrt(ax*ax + ay*ay + az*az); },

  // ── Movement intensity (0–1) ───────────────────────────
  movementIntensity(samples) {
    if (!samples.length) return 0;
    const mags = samples.map(s => this.magnitude(s.ax, s.ay, s.az));
    const mean = _avg(mags);
    const variance = mags.reduce((a, v) => a + (v - mean) ** 2, 0) / mags.length;
    return Math.min(1, Math.sqrt(variance) * 5);
  },

  // ── Respiratory Rate (breaths/min) ─────────────────────
  // Extracts breathing signal from az axis via zero-crossing on detrended window.
  respiratoryRate(samples, sampleRateHz = 5) {
    const needed = sampleRateHz * 20; // need at least 20 seconds
    if (samples.length < needed) return null;

    const window = samples.slice(-sampleRateHz * 30).map(s => s.az);

    // Detrend: remove mean then apply simple low-pass (breathing ≈ 0.1–0.5 Hz)
    const mean = _avg(window);
    const detrended = window.map(v => v - mean);

    // Smooth with 3-sample moving average to remove high-freq noise
    const smoothed = detrended.map((v, i) => {
      if (i === 0 || i === detrended.length - 1) return v;
      return (detrended[i-1] + v + detrended[i+1]) / 3;
    });

    // Count positive zero-crossings = one breath cycle
    let crossings = 0;
    for (let i = 1; i < smoothed.length; i++) {
      if (smoothed[i-1] < 0 && smoothed[i] >= 0) crossings++;
    }

    const durationMin = window.length / sampleRateHz / 60;
    const rr = Math.round(crossings / durationMin);
    // Sanity check: normal adult RR is 10–25 breaths/min
    return (rr >= 6 && rr <= 40) ? rr : null;
  },

  // ── Sleep Stage Classification (30-second epoch) ────────
  // Returns: 'awake' | 'light' | 'deep' | 'rem'
  classifyEpoch(samples) {
    if (samples.length < 3) return 'awake';
    const mags = samples.map(s => this.magnitude(s.ax, s.ay, s.az));
    const mean = _avg(mags);
    const variance = mags.reduce((s, v) => s + (v - mean) ** 2, 0) / mags.length;
    const stddev = Math.sqrt(variance);

    // Kurtosis: high = occasional bursts (REM twitches)
    const kurtosis = variance > 0
      ? mags.reduce((s, v) => s + (v - mean) ** 4, 0) / (mags.length * variance ** 2)
      : 0;

    if (stddev > 0.18)                      return 'awake';
    if (stddev > 0.08)                      return 'light';
    if (kurtosis > 4.5 && stddev < 0.07)   return 'rem';
    return 'deep';
  },

  // Classify all buffered data into epochs and return timeline
  sleepStageTimeline(samples, sampleRateHz = 5) {
    const epochSize = sampleRateHz * 30; // 30-second epochs
    const timeline = [];
    for (let i = 0; i < samples.length; i += epochSize) {
      const epoch = samples.slice(i, i + epochSize);
      if (epoch.length < Math.floor(epochSize / 2)) break;
      timeline.push({
        t: epoch[0].ts,
        stage: this.classifyEpoch(epoch)
      });
    }
    return timeline;
  },

  // Summary counts from timeline
  stageSummary(timeline) {
    const counts = { awake: 0, light: 0, deep: 0, rem: 0 };
    timeline.forEach(e => { if (counts[e.stage] !== undefined) counts[e.stage]++; });
    const total = timeline.length || 1;
    return {
      counts,
      pct: {
        awake: Math.round(counts.awake / total * 100),
        light: Math.round(counts.light / total * 100),
        deep:  Math.round(counts.deep  / total * 100),
        rem:   Math.round(counts.rem   / total * 100),
      },
      dominantStage: Object.entries(counts).reduce((a, b) => b[1] > a[1] ? b : a)[0]
    };
  },

  // ── OSA Proxy Detection ────────────────────────────────
  // Detects absence of respiratory signal (>10s) as potential apnea event.
  detectApneaEvents(samples, sampleRateHz = 5) {
    const windowSize = sampleRateHz * 10; // 10-second windows
    const events = [];

    for (let i = 0; i + windowSize <= samples.length; i += windowSize) {
      const chunk = samples.slice(i, i + windowSize);
      const rr = this.respiratoryRate(chunk, sampleRateHz);
      const intensity = this.movementIntensity(chunk);

      // Apnea proxy: no detectable breathing signal AND very low movement
      if (rr === null && intensity < 0.02) {
        // Check for arousal burst immediately after (hallmark of OSA)
        const nextChunk = samples.slice(i + windowSize, i + windowSize * 2);
        const postIntensity = nextChunk.length ? this.movementIntensity(nextChunk) : 0;
        events.push({
          ts: chunk[0].ts,
          arousal: postIntensity > 0.15
        });
      }
    }
    return events;
  },

  // AHI proxy (events per hour)
  ahiProxy(events, durationMs) {
    const hours = durationMs / 3600000;
    if (hours < 0.1) return 0;
    return Math.round(events.length / hours);
  },

  osaRiskLabel(ahi) {
    if (ahi < 5)  return { label: 'Normal',        cls: 'good'   };
    if (ahi < 15) return { label: 'Ringan',         cls: 'warn'   };
    if (ahi < 30) return { label: 'Sedang',         cls: 'warn'   };
    return              { label: 'Berat',           cls: 'danger' };
  },

  // ── Biological Age Estimator ───────────────────────────
  // Based on Pavanello et al. (2019): circadian disruption → telomere shortening.
  biologicalAge(chronologicalAge, sessions) {
    const age = parseInt(chronologicalAge) || 30;
    if (!sessions || sessions.length < 3) return { bioAge: age, delta: 0, confidence: 'low' };

    const recent = sessions.slice(-30);

    const avgQuality = _avg(recent.map(s => s.qualityScore || 50));
    const avgDurHrs  = _avg(recent.map(s => (s.durationMs  || 25200000) / 3600000));

    // Bedtime variance (circadian consistency)
    const bedtimes = recent
      .filter(s => s.startTime)
      .map(s => {
        const d = new Date(s.startTime);
        let h = d.getHours() + d.getMinutes() / 60;
        if (h < 6) h += 24; // normalize late-night times
        return h;
      });
    const bedtimeMean = _avg(bedtimes);
    const bedtimeSD   = Math.sqrt(_avg(bedtimes.map(t => (t - bedtimeMean) ** 2)));

    let offset = 0;

    // Sleep quality component
    if      (avgQuality > 85) offset -= 2;
    else if (avgQuality > 70) offset -= 0.5;
    else if (avgQuality < 55) offset += 3;
    else if (avgQuality < 40) offset += 5;

    // Duration component
    if      (avgDurHrs >= 7 && avgDurHrs <= 9) offset -= 1;
    else if (avgDurHrs < 6)  offset += 4;
    else if (avgDurHrs < 7)  offset += 1.5;
    else if (avgDurHrs > 10) offset += 2;

    // Circadian disruption component
    if      (bedtimeSD < 0.5) offset -= 1;
    else if (bedtimeSD > 2)   offset += 3;
    else if (bedtimeSD > 1)   offset += 1;

    const delta = Math.round(offset * 10) / 10;
    return {
      bioAge:     Math.max(18, Math.round(age + delta)),
      delta,
      confidence: recent.length >= 14 ? 'high' : 'medium',
      avgQuality: Math.round(avgQuality),
      avgDurHrs:  Math.round(avgDurHrs * 10) / 10,
      bedtimeSD:  Math.round(bedtimeSD * 10) / 10
    };
  },

  biologicalAgeLabel(delta) {
    if (delta <= -2) return { text: 'Lebih Muda',   cls: 'good'   };
    if (delta <   1) return { text: 'Normal',        cls: 'good'   };
    if (delta <   3) return { text: 'Sedikit Lebih Tua', cls: 'warn' };
    return                  { text: 'Lebih Tua',     cls: 'danger' };
  },

  // ── Sleep Quality Score (0–100) ───────────────────────
  qualityScore(samples, durationMs) {
    if (!samples.length || durationMs < 60000) return null;
    const intensity  = this.movementIntensity(samples);
    const posChanges = this._countPositionChanges(samples);
    const durationHrs = durationMs / 3600000;
    const movScore  = Math.max(0, 100 - intensity * 80);
    const durScore  = Math.min(100, (durationHrs / 8) * 100);
    const posScore  = Math.max(0, 100 - posChanges * 5);
    return Math.round(movScore * 0.5 + durScore * 0.3 + posScore * 0.2);
  },

  qualityLabel(score) {
    if (score === null) return { label: '—',            cls: '' };
    if (score >= 85)   return { label: 'Sangat Baik',  cls: 'good'   };
    if (score >= 70)   return { label: 'Baik',          cls: 'good'   };
    if (score >= 55)   return { label: 'Cukup',         cls: 'warn'   };
    return                    { label: 'Buruk',         cls: 'danger' };
  },

  // ── Cardiovascular Risk (0–100) ───────────────────────
  cardioRisk(profile, qualityScore, durationHrs) {
    let risk = 0;
    if (profile.hypertension)  risk += 20;
    if (profile.diabetes)       risk += 15;
    if (profile.heartHistory)   risk += 25;
    if (profile.smoker)         risk += 10;
    if (profile.obesity)        risk += 10;
    if (durationHrs < 6)        risk += 15;
    if (durationHrs > 9)        risk += 5;
    if (qualityScore && qualityScore < 55) risk += 15;
    const age = parseInt(profile.age) || 30;
    if (age > 60)      risk += 10;
    else if (age > 45) risk += 5;
    return Math.min(100, risk);
  },

  riskLabel(score) {
    if (score < 20)  return { label: 'Rendah',  cls: 'good'   };
    if (score < 50)  return { label: 'Sedang',  cls: 'warn'   };
    if (score < 75)  return { label: 'Tinggi',  cls: 'danger' };
    return                  { label: 'Kritis',  cls: 'danger' };
  },

  // ── Circadian Score (0–100, higher = better) ──────────
  circadianScore(sessions) {
    if (!sessions || sessions.length < 5) return null;
    const bedtimes = sessions.slice(-14).map(s => {
      if (!s.startTime) return null;
      const d = new Date(s.startTime);
      let h = d.getHours() + d.getMinutes() / 60;
      if (h < 6) h += 24;
      return h;
    }).filter(Boolean);
    if (bedtimes.length < 3) return null;
    const mean = _avg(bedtimes);
    const sd   = Math.sqrt(_avg(bedtimes.map(t => (t - mean) ** 2)));
    return Math.max(0, Math.round(100 - sd * 20));
  },

  _countPositionChanges(samples) {
    let changes = 0, last = null;
    for (const s of samples) {
      const pos = this.detectPosition(s.ax, s.ay, s.az).key;
      if (last && pos !== last) changes++;
      last = pos;
    }
    return changes;
  }
};

function _avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

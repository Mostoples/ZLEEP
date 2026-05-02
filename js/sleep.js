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

  // ── ZLEEP-CVD Score (ZCS) — SLR-backed model ─────────────
  // Domain A (45): profile | Domain B (40): IMU sleep | Domain C (15): lifestyle
  zcsScore(profile, sessions) {
    const age = parseInt(profile.age) || 0;
    const bmi = profile.bmi ||
      (profile.height && profile.weight ? profile.weight / ((profile.height / 100) ** 2) : 0);

    // Domain A: Profile (45 pts max)
    let dA = 0;
    if      (age >= 65) dA += 12;
    else if (age >= 55) dA += 8;
    else if (age >= 45) dA += 5;
    else if (age >= 35) dA += 2;
    if      (profile.gender === 'M') dA += 5;
    else if (profile.gender === 'F') dA += 2;
    if      (bmi >= 35)   dA += 10;
    else if (bmi >= 30)   dA += 8;
    else if (bmi >= 27.5) dA += 5;
    else if (bmi >= 25)   dA += 3;
    if (profile.hypertension) dA += 8;
    if (profile.diabetes)     dA += 5;
    if (profile.smoker)       dA += 5;
    dA = Math.min(45, dA);

    // Domain B: IMU Sleep (40 pts max)
    let dB = 0;
    const recent = sessions && sessions.length ? sessions.slice(-14) : [];
    if (recent.length) {
      const avgDur = _avg(recent.map(s => (s.durationMs || 0) / 3600000));
      if      (avgDur < 5) dB += 12;
      else if (avgDur < 6) dB += 8;
      else if (avgDur < 7) dB += 4;
      else if (avgDur > 9) dB += 2;

      const avgQ = _avg(recent.map(s => s.qualityScore || 50));
      if      (avgQ < 55) dB += 8;
      else if (avgQ < 70) dB += 4;
      else if (avgQ < 85) dB += 1;

      const avgAhi = _avg(recent.map(s => s.ahiProxy || 0));
      if      (avgAhi >= 30) dB += 8;
      else if (avgAhi >= 15) dB += 6;
      else if (avgAhi >= 5)  dB += 3;

      dB += Math.round(Math.max(0, 1 - avgQ / 100) * 7);
    } else {
      dB = 8;
    }
    dB = Math.min(40, dB);

    // Domain C: Lifestyle (15 pts max)
    let dC = 0;
    const act = profile.activity || 'moderate';
    if      (act === 'none')     dC += 8;
    else if (act === 'low')      dC += 4;
    else if (act === 'moderate') dC += 1;

    if (recent.length >= 3) {
      const bts = recent
        .filter(s => s.startTime)
        .map(s => { const d = new Date(s.startTime); let h = d.getHours() + d.getMinutes() / 60; if (h < 6) h += 24; return h; });
      if (bts.length >= 3) {
        const bMean = _avg(bts);
        const bSD   = Math.sqrt(_avg(bts.map(t => (t - bMean) ** 2)));
        if      (bSD >= 3)   dC += 7;
        else if (bSD >= 2)   dC += 5;
        else if (bSD >= 1)   dC += 3;
        else if (bSD >= 0.5) dC += 1;
      }
    }
    dC = Math.min(15, dC);

    let score = dA + dB + dC;

    // Synergistic modifiers (SLR: compounding effects)
    const avgQSync = recent.length ? _avg(recent.map(s => s.qualityScore || 50)) : 50;
    if (profile.hypertension && profile.diabetes && avgQSync < 70)  score += 10;
    if (bmi >= 30 && age >= 45 && avgQSync < 75)                    score += 8;
    score = Math.min(100, score);

    let level;
    if      (score < 20) level = { label: 'Rendah',       cls: 'good',   risk10yr: '<5%'    };
    else if (score < 40) level = { label: 'Sedang',       cls: 'warn',   risk10yr: '5–10%'  };
    else if (score < 60) level = { label: 'Tinggi',       cls: 'warn',   risk10yr: '10–20%' };
    else if (score < 80) level = { label: 'Sangat Tinggi',cls: 'danger', risk10yr: '20–30%' };
    else                 level = { label: 'Kritis',       cls: 'danger', risk10yr: '>30%'   };

    return { score, level, domainA: dA, domainB: dB, domainC: dC };
  },

  // ── Longevity Index (0–100) ───────────────────────────
  // Composite: duration quality + circadian + debt + CVD inverse
  // Evidence: Cappuccio 2011 EHJ, Itani 2017 SMR, Jike 2017 SMR,
  //           Lehodey 2025 AlzRes, Lunsford-Avery 2021 Sleep
  longevityIndex(profile, sessions) {
    const recent = sessions && sessions.length ? sessions.slice(-30) : [];
    if (recent.length < 3) return { score: null, grade: null, yearsImpact: 0, components: {}, confidence: 'low' };

    const avgQ   = _avg(recent.map(s => s.qualityScore || 50));
    const avgDur = _avg(recent.map(s => (s.durationMs || 25200000) / 3600000));

    // Bedtime SD (circadian regularity)
    const bts = recent.filter(s => s.startTime).map(s => {
      const d = new Date(s.startTime); let h = d.getHours() + d.getMinutes() / 60;
      if (h < 6) h += 24; return h;
    });
    const bMean = _avg(bts);
    const bedSD = bts.length >= 3 ? Math.sqrt(_avg(bts.map(t => (t - bMean) ** 2))) : 1.5;

    // Duration component (U-curve: Cappuccio 2011)
    let durComp;
    if      (avgDur >= 7   && avgDur <= 8.5) durComp = 100;
    else if (avgDur >= 6.5 && avgDur <  7)   durComp = 80;
    else if (avgDur >  8.5 && avgDur <= 9)   durComp = 80;
    else if (avgDur >= 6   && avgDur <  6.5) durComp = 55;
    else if (avgDur >  9   && avgDur <= 10)  durComp = 55;
    else if (avgDur <  6)   durComp = Math.max(0,  avgDur / 6 * 40);
    else                    durComp = Math.max(0, (12 - avgDur) / 3 * 40);

    // Circadian component (Lehodey 2025: SD → telomere shortening)
    let circComp;
    if      (bedSD < 0.25) circComp = 100;
    else if (bedSD < 0.5)  circComp = 88;
    else if (bedSD < 1)    circComp = 70;
    else if (bedSD < 2)    circComp = 45;
    else                   circComp = Math.max(0, 100 - bedSD * 25);

    // Sleep debt component (7-day)
    const last7     = recent.slice(-7);
    const weekDebt  = last7.reduce((a, s) => a + Math.max(0, 7 - (s.durationMs || 0) / 3600000), 0);
    const debtComp  = Math.max(0, 100 - weekDebt * 12);

    // CVD inverse (lower ZCS score = better longevity)
    const zcs      = this.zcsScore(profile, sessions);
    const cvdComp  = Math.max(0, 100 - zcs.score);

    const score = Math.round(
      durComp  * 0.22 +
      avgQ     * 0.28 +
      circComp * 0.20 +
      debtComp * 0.15 +
      cvdComp  * 0.15
    );

    let grade;
    if      (score >= 85) grade = { letter: 'A', label: 'Excellent',       cls: 'good'   };
    else if (score >= 70) grade = { letter: 'B', label: 'Baik',            cls: 'good'   };
    else if (score >= 55) grade = { letter: 'C', label: 'Cukup',           cls: 'warn'   };
    else if (score >= 40) grade = { letter: 'D', label: 'Di Bawah Rata',   cls: 'warn'   };
    else                  grade = { letter: 'F', label: 'Buruk',           cls: 'danger' };

    // Life-years impact (Cappuccio 2011: U-curve mortality RR)
    let yearsImpact = 0;
    if      (avgQ >= 85 && avgDur >= 7 && avgDur <= 8.5 && bedSD < 0.5) yearsImpact = +2.5;
    else if (avgQ >= 70 && avgDur >= 6.5 && avgDur <= 9)                 yearsImpact = +0.8;
    else if (avgQ < 55  && avgDur < 6)                                    yearsImpact = -3.5;
    else if (avgQ < 55  || avgDur < 6)                                    yearsImpact = -1.8;
    else if (avgDur > 9.5)                                                yearsImpact = -1.2;

    // Stage quality gap (ideal: deep 20%, REM 25%)
    const lastSession = recent[recent.length - 1];
    const stagePct = lastSession && lastSession.stageSummary ? lastSession.stageSummary : null;
    let stageGap = null;
    if (stagePct) {
      const deepGap = Math.max(0, 20 - (stagePct.deep  || 0));
      const remGap  = Math.max(0, 25 - (stagePct.rem   || 0));
      stageGap = { deepGap, remGap, deepActual: stagePct.deep || 0, remActual: stagePct.rem || 0 };
    }

    return {
      score,
      grade,
      yearsImpact,
      stageGap,
      components: {
        duration:   Math.round(durComp),
        quality:    Math.round(avgQ),
        circadian:  Math.round(circComp),
        debt:       Math.round(debtComp),
        cvdInverse: Math.round(cvdComp)
      },
      confidence: recent.length >= 14 ? 'high' : recent.length >= 7 ? 'medium' : 'low'
    };
  },

  // ── Sleep Debt ────────────────────────────────────────
  // Axelsson et al. (2020): ~1.5h extra sleep repays 1h of debt
  sleepDebt(sessions, targetHrs = 7.5) {
    if (!sessions || !sessions.length) return { weekly: 0, monthly: 0, recoveryNights: 0, pctOptimal: 100 };
    const dur = s => (s.durationMs || 0) / 3600000;
    const last7  = sessions.slice(-7);
    const last30 = sessions.slice(-30);
    const weekly  = Math.round(last7 .reduce((a, s) => a + Math.max(0, targetHrs - dur(s)), 0) * 10) / 10;
    const monthly = Math.round(last30.reduce((a, s) => a + Math.max(0, targetHrs - dur(s)), 0) * 10) / 10;
    const recoveryNights = Math.min(14, Math.ceil(weekly / 1.5));
    const pctOptimal = Math.round(Math.max(0, Math.min(100, (1 - weekly / (7 * targetHrs)) * 100)));
    return { weekly, monthly, recoveryNights, pctOptimal };
  },

  // ── Cognitive Performance ─────────────────────────────
  // Van Dongen et al. (2003 Sleep): each hour of chronic restriction
  // below 8h ≡ measurable psychomotor vigilance decline (~12% / hr).
  cognitivePerformance(sessions) {
    if (!sessions || sessions.length < 2) return { score: null, label: '—', trend: 0 };
    const last7 = sessions.slice(-7);
    const avgDur = _avg(last7.map(s => (s.durationMs || 25200000) / 3600000));
    const avgQ   = _avg(last7.map(s => s.qualityScore || 50));
    const durDeficit = Math.max(0, 8 - avgDur);
    const base       = Math.max(0, 100 - durDeficit * 12);
    const qualAdj    = ((avgQ - 50) / 50) * 15; // −15 to +15
    const score      = Math.round(Math.min(100, Math.max(0, base + qualAdj)));
    let label;
    if      (score >= 90) label = 'Optimal';
    else if (score >= 75) label = 'Baik';
    else if (score >= 60) label = 'Cukup';
    else if (score >= 45) label = 'Menurun';
    else                  label = 'Kritis';
    // Trend: compare last 3 vs prev 4
    const half1 = sessions.slice(-7, -3);
    const half2 = sessions.slice(-3);
    const trend = half1.length && half2.length
      ? _avg(half2.map(s => s.qualityScore || 50)) - _avg(half1.map(s => s.qualityScore || 50))
      : 0;
    return { score, label, trend: Math.round(trend * 10) / 10 };
  },

  // ── Stage Quality Gap ─────────────────────────────────
  // Compare last session's stage % to evidence-based optimal ranges
  stageQuality(stageSummary) {
    if (!stageSummary) return null;
    const ideal = { deep: 20, rem: 25, light: 50, awake: 5 };
    const gaps  = {};
    let totalGap = 0;
    for (const [k, v] of Object.entries(ideal)) {
      const actual = stageSummary[k] || 0;
      gaps[k] = { actual, ideal: v, gap: actual - v };
      totalGap += Math.abs(actual - v);
    }
    const score = Math.max(0, 100 - totalGap * 1.2);
    return { gaps, score: Math.round(score) };
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

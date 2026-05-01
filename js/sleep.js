// Sleep analysis utilities based on IMU data

const SleepAnalysis = {
  // ── Position ───────────────────────────────────────────
  detectPosition(ax, ay, az) {
    const mag = Math.sqrt(ax*ax + ay*ay + az*az);
    if (mag < 0.1) return { label: 'Tidak Diketahui', key: 'unknown', angle: 0 };

    const naz = az / mag;
    const nay = ay / mag;

    if (naz >  0.75) return { label: 'Terlentang',  key: 'supine',  angle: 0   };
    if (naz < -0.75) return { label: 'Tengkurap',   key: 'prone',   angle: 180 };
    if (nay > 0.65)  return { label: 'Kanan',       key: 'right',   angle: 90  };
    if (nay < -0.65) return { label: 'Kiri',        key: 'left',    angle: -90 };
    return               { label: 'Miring',       key: 'side',   angle: 45  };
  },

  // ── Movement magnitude ─────────────────────────────────
  magnitude(ax, ay, az) {
    return Math.sqrt(ax*ax + ay*ay + az*az);
  },

  // ── Movement intensity (0–1 scale) ───────────────────
  movementIntensity(samples) {
    if (!samples.length) return 0;
    const mags = samples.map(s => this.magnitude(s.ax, s.ay, s.az));
    const mean = mags.reduce((a, b) => a + b, 0) / mags.length;
    const variance = mags.reduce((a, v) => a + (v - mean)**2, 0) / mags.length;
    return Math.min(1, Math.sqrt(variance) * 5);
  },

  // ── Sleep quality score (0–100) ───────────────────────
  qualityScore(samples, durationMs) {
    if (!samples.length || durationMs < 60000) return null;

    const intensity = this.movementIntensity(samples);
    const posChanges = this._countPositionChanges(samples);
    const durationHrs = durationMs / 3600000;

    // Score components
    const movScore  = Math.max(0, 100 - intensity * 80);
    const durScore  = Math.min(100, (durationHrs / 8) * 100);
    const posScore  = Math.max(0, 100 - posChanges * 5);

    return Math.round(movScore * 0.5 + durScore * 0.3 + posScore * 0.2);
  },

  qualityLabel(score) {
    if (score === null) return { label: '—', cls: '' };
    if (score >= 85)   return { label: 'Sangat Baik', cls: 'good'   };
    if (score >= 70)   return { label: 'Baik',        cls: 'good'   };
    if (score >= 55)   return { label: 'Cukup',       cls: 'warn'   };
    return                    { label: 'Buruk',       cls: 'danger' };
  },

  // ── Cardiovascular risk indicator ─────────────────────
  cardioRisk(profile, qualityScore, durationHrs) {
    let risk = 0;
    if (profile.hypertension)   risk += 20;
    if (profile.diabetes)        risk += 15;
    if (profile.heartHistory)    risk += 25;
    if (profile.smoker)          risk += 10;
    if (profile.obesity)         risk += 10;
    if (durationHrs < 6)         risk += 15;
    if (durationHrs > 9)         risk += 5;
    if (qualityScore && qualityScore < 55) risk += 15;

    const age = parseInt(profile.age) || 30;
    if (age > 60) risk += 10;
    else if (age > 45) risk += 5;

    return Math.min(100, risk);
  },

  riskLabel(score) {
    if (score < 20)  return { label: 'Rendah',   cls: 'good'  };
    if (score < 50)  return { label: 'Sedang',   cls: 'warn'  };
    if (score < 75)  return { label: 'Tinggi',   cls: 'danger'};
    return                  { label: 'Kritis',   cls: 'danger'};
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

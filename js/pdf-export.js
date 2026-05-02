const PdfExport = {

  async generate({ profile, session, stageSummary, apneaEvents, bioAge, recommendations, chartCanvasIds }) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    const W = 210, M = 15;
    let y = 0;

    const colors = {
      primary:  [123, 108, 246],
      dark:     [ 14,  22,  41],
      muted:    [100, 116, 139],
      success:  [ 52, 211, 153],
      warn:     [251, 146,  60],
      danger:   [248, 113, 113],
      white:    [255, 255, 255],
      light:    [226, 232, 240],
    };

    const setColor   = (c) => doc.setTextColor(...c);
    const setFill    = (c) => doc.setFillColor(...c);
    const setDraw    = (c) => doc.setDrawColor(...c);

    // ── Header ────────────────────────────────────────────
    setFill(colors.dark);
    doc.rect(0, 0, W, 28, 'F');
    setFill(colors.primary);
    doc.roundedRect(M, 7, 14, 14, 3, 3, 'F');
    setColor(colors.white);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('Z', M + 7, 16.5, { align: 'center' });
    doc.setFontSize(18);
    doc.text('ZLEEP', M + 18, 16);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    setColor([180, 190, 210]);
    doc.text('Smart Sleep Monitor — Laporan Kesehatan Tidur', M + 18, 21);

    const dateStr = new Date().toLocaleDateString('id-ID', { dateStyle: 'full' });
    doc.text(dateStr, W - M, 16, { align: 'right' });
    y = 34;

    // ── Patient info ──────────────────────────────────────
    setFill([18, 28, 50]);
    doc.roundedRect(M, y, W - M*2, 20, 3, 3, 'F');
    setColor(colors.light);
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(profile.name || 'Anonim', M + 4, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setColor([160, 175, 195]);
    const infoItems = [
      `Usia: ${profile.age || '—'} tahun`,
      `Jenis Kelamin: ${profile.gender === 'M' ? 'Laki-laki' : profile.gender === 'F' ? 'Perempuan' : '—'}`,
      `Tanggal Sesi: ${session?.startTime ? new Date(session.startTime).toLocaleDateString('id-ID') : '—'}`,
      `Durasi: ${session?.durationMs ? _fmtDur(session.durationMs) : '—'}`,
    ];
    doc.text(infoItems.join('   |   '), M + 4, y + 14);
    y += 26;

    // ── Section title helper ──────────────────────────────
    const sectionTitle = (title) => {
      setColor(colors.primary);
      doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text(title, M, y);
      setDraw(colors.primary);
      doc.setLineWidth(0.4);
      doc.line(M, y + 1.5, W - M, y + 1.5);
      y += 7;
    };

    // ── Metric card helper ────────────────────────────────
    const metricCard = (x, cy, w, label, value, sub, valueColor) => {
      setFill([18, 28, 50]);
      doc.roundedRect(x, cy, w, 18, 2, 2, 'F');
      setColor(colors.muted);
      doc.setFontSize(7); doc.setFont('helvetica', 'normal');
      doc.text(label.toUpperCase(), x + 3, cy + 5);
      setColor(valueColor || colors.light);
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text(String(value), x + 3, cy + 13);
      if (sub) {
        doc.setFontSize(7); doc.setFont('helvetica', 'normal');
        setColor(colors.muted);
        doc.text(sub, x + 3, cy + 17);
      }
    };

    // ── Sleep metrics ─────────────────────────────────────
    sectionTitle('Metrik Kualitas Tidur');
    const ql = SleepAnalysis.qualityLabel(session?.qualityScore);
    const rl = SleepAnalysis.riskLabel(session?.riskScore || 0);
    const qColor = ql.cls === 'good' ? colors.success : ql.cls === 'warn' ? colors.warn : colors.danger;
    const rColor = rl.cls === 'good' ? colors.success : rl.cls === 'warn' ? colors.warn : colors.danger;

    const cW = (W - M*2 - 9) / 4;
    metricCard(M,           y, cW, 'Kualitas Tidur',   session?.qualityScore ?? '—', ql.label,  qColor);
    metricCard(M + cW + 3,  y, cW, 'Risiko Kardio',    (session?.riskScore ?? '—') + '%', rl.label, rColor);
    metricCard(M + cW*2+6,  y, cW, 'Usia Biologis',    bioAge?.bioAge ? bioAge.bioAge + ' thn' : '—',
      bioAge?.delta ? (bioAge.delta > 0 ? `+${bioAge.delta} dari kronologis` : `${bioAge.delta} dari kronologis`) : '—',
      bioAge?.delta >= 3 ? colors.danger : bioAge?.delta <= -1 ? colors.success : colors.warn);
    metricCard(M + cW*3+9,  y, cW, 'Durasi Sesi', session?.durationMs ? _fmtDur(session.durationMs) : '—', '', colors.light);
    y += 24;

    // ── Sleep stages ──────────────────────────────────────
    if (stageSummary) {
      sectionTitle('Distribusi Tahap Tidur');
      const stages = [
        { key: 'deep',  label: 'Tidur Dalam (N3)', color: colors.primary },
        { key: 'rem',   label: 'REM',              color: [34, 211, 238] },
        { key: 'light', label: 'Tidur Ringan (N1/N2)', color: [100, 116, 139] },
        { key: 'awake', label: 'Terjaga',           color: colors.warn },
      ];
      let barX = M;
      const barH = 8, barW = W - M*2;
      stages.forEach(s => {
        const pct = stageSummary.pct[s.key] || 0;
        const w = barW * pct / 100;
        if (w > 0) {
          setFill(s.color);
          doc.rect(barX, y, w, barH, 'F');
          barX += w;
        }
      });
      y += barH + 3;
      stages.forEach((s, i) => {
        const pct = stageSummary.pct[s.key] || 0;
        const cx = M + i * 45;
        setFill(s.color);
        doc.rect(cx, y, 4, 4, 'F');
        setColor(colors.muted);
        doc.setFontSize(7.5);
        doc.text(`${s.label}: ${pct}%`, cx + 6, y + 3.5);
      });
      y += 10;
    }

    // ── OSA / Respiratory ─────────────────────────────────
    if (apneaEvents !== undefined) {
      sectionTitle('Deteksi Apnea & Pernapasan');
      const ahi = session?.durationMs ? SleepAnalysis.ahiProxy(apneaEvents, session.durationMs) : 0;
      const osaL = SleepAnalysis.osaRiskLabel(ahi);
      const osaColor = osaL.cls === 'good' ? colors.success : osaL.cls === 'warn' ? colors.warn : colors.danger;
      const cw2 = (W - M*2 - 3) / 2;
      metricCard(M,        y, cw2, 'AHI Proxy (Apnea/jam)', ahi, osaL.label, osaColor);
      metricCard(M+cw2+3,  y, cw2, 'Total Episode Apnea',   apneaEvents.length, 'Selama sesi', osaColor);
      y += 24;
    }

    // ── Risk factors ──────────────────────────────────────
    const rfs = [];
    if (profile.hypertension)  rfs.push('Hipertensi');
    if (profile.diabetes)       rfs.push('Diabetes');
    if (profile.obesity)        rfs.push('Obesitas');
    if (profile.smoker)         rfs.push('Perokok');
    if (profile.heartHistory)   rfs.push('Riwayat Jantung');
    if (profile.insomnia)       rfs.push('Insomnia');

    if (rfs.length) {
      sectionTitle('Faktor Risiko Tercatat');
      rfs.forEach((rf, i) => {
        const cx = M + (i % 3) * 62;
        const cy = y + Math.floor(i / 3) * 7;
        setFill(colors.danger);
        doc.circle(cx + 1.5, cy + 1.5, 1.5, 'F');
        setColor(colors.light);
        doc.setFontSize(8.5);
        doc.text(rf, cx + 5, cy + 3);
      });
      y += Math.ceil(rfs.length / 3) * 7 + 4;
    }

    // ── Recommendations ───────────────────────────────────
    if (recommendations?.length) {
      y += 2;
      sectionTitle('Rekomendasi Personal');
      recommendations.slice(0, 4).forEach(rec => {
        if (y > 260) { doc.addPage(); y = 20; }
        const priColor = rec.priority === 'high' ? colors.danger : rec.priority === 'medium' ? colors.warn : colors.success;
        setFill(priColor);
        doc.rect(M, y, 2, 10, 'F');
        setColor(colors.light);
        doc.setFontSize(9); doc.setFont('helvetica', 'bold');
        doc.text(rec.title, M + 5, y + 4);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        setColor(colors.muted);
        const lines = doc.splitTextToSize(rec.body, W - M*2 - 8);
        doc.text(lines, M + 5, y + 8.5);
        y += 6 + lines.length * 3.5;
      });
    }

    // ── Footer ────────────────────────────────────────────
    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      setFill([14, 22, 41]);
      doc.rect(0, 285, W, 12, 'F');
      setColor([80, 96, 120]);
      doc.setFontSize(7);
      doc.text('ZLEEP Smart Sleep Monitor — Laporan ini bukan pengganti diagnosis medis. Konsultasikan dengan dokter untuk penilaian klinis.', M, 291);
      doc.text(`Halaman ${p} / ${pageCount}`, W - M, 291, { align: 'right' });
    }

    // ── Save ──────────────────────────────────────────────
    const filename = `ZLEEP_Laporan_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(filename);
  }
};

function _fmtDur(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h ? `${h}j ${m}m` : `${m}m`;
}

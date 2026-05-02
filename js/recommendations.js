const Recommendations = {

  // Generate personalized recommendations based on all available data
  generate({ profile, sessions, lastSession, currentPosition, osaAhi, respiratoryRate, bioAge }) {
    const tips = [];
    const now = new Date();
    const hour = now.getHours();

    // ── Position-based ────────────────────────────────────
    if (currentPosition === 'prone') {
      tips.push({
        icon: '🛏️',
        category: 'Posisi',
        priority: 'high',
        title: 'Posisi Tengkurap Tidak Dianjurkan',
        body: 'Tidur tengkurap menekan saluran napas dan meningkatkan risiko nyeri leher. Coba beralih ke posisi terlentang atau miring kiri untuk mengurangi tekanan pada jantung.'
      });
    }

    if (currentPosition === 'right' && profile.heartHistory) {
      tips.push({
        icon: '❤️',
        category: 'Kardiovaskular',
        priority: 'high',
        title: 'Posisi Miring Kiri Lebih Baik untuk Jantung',
        body: 'Penelitian menunjukkan posisi miring kiri mengurangi tekanan pada jantung dan meningkatkan aliran darah. Ini penting khususnya jika Anda memiliki riwayat penyakit jantung.'
      });
    }

    // ── OSA / Respiratory ─────────────────────────────────
    if (osaAhi >= 5) {
      const label = osaAhi < 15 ? 'ringan' : osaAhi < 30 ? 'sedang' : 'berat';
      tips.push({
        icon: '😮‍💨',
        category: 'Pernapasan',
        priority: 'high',
        title: `Indikasi Apnea Tidur ${label.charAt(0).toUpperCase() + label.slice(1)}`,
        body: `Terdeteksi ${osaAhi} potensi episode apnea per jam (AHI proxy: ${osaAhi}). Apnea tidur ${label} berkaitan dengan risiko hipertensi dan fibrilasi atrium. Konsultasikan dengan dokter untuk pemeriksaan PSG.`
      });
    }

    if (respiratoryRate !== null) {
      if (respiratoryRate > 25) {
        tips.push({
          icon: '💨',
          category: 'Pernapasan',
          priority: 'medium',
          title: 'Frekuensi Napas Tinggi',
          body: `Frekuensi napas ${respiratoryRate} napas/menit lebih tinggi dari normal (12–20). Ini bisa mengindikasikan stres, kecemasan, atau kondisi pernapasan. Coba teknik relaksasi sebelum tidur.`
        });
      } else if (respiratoryRate < 10) {
        tips.push({
          icon: '💨',
          category: 'Pernapasan',
          priority: 'medium',
          title: 'Frekuensi Napas Rendah',
          body: `Frekuensi napas ${respiratoryRate} napas/menit lebih rendah dari normal. Pantau terus dan konsultasikan jika terjadi berulang.`
        });
      }
    }

    // ── Sleep quality history ─────────────────────────────
    if (sessions && sessions.length >= 3) {
      const recent = sessions.slice(-7);
      const avgQ = recent.reduce((s, v) => s + (v.qualityScore || 50), 0) / recent.length;
      const avgD = recent.reduce((s, v) => s + (v.durationMs || 0), 0) / recent.length / 3600000;

      if (avgQ < 55) {
        tips.push({
          icon: '📉',
          category: 'Kualitas Tidur',
          priority: 'high',
          title: 'Kualitas Tidur Buruk Berkelanjutan',
          body: `Rata-rata skor kualitas tidur 7 hari terakhir: ${Math.round(avgQ)}/100. Kualitas tidur buruk kronik berkaitan dengan penuaan biologis dipercepat dan risiko stroke. Pertimbangkan hygiene tidur yang lebih baik.`
        });
      }

      if (avgD < 6) {
        tips.push({
          icon: '⏰',
          category: 'Durasi Tidur',
          priority: 'high',
          title: 'Kurang Tidur Kronis',
          body: `Rata-rata durasi tidur: ${avgD.toFixed(1)} jam/malam (kurang dari rekomendasi 7–9 jam). Kurang tidur kronis meningkatkan risiko penyakit jantung hingga 48% (AHA 2025).`
        });
      } else if (avgD > 9.5) {
        tips.push({
          icon: '🛌',
          category: 'Durasi Tidur',
          priority: 'low',
          title: 'Durasi Tidur Berlebihan',
          body: `Rata-rata durasi tidur: ${avgD.toFixed(1)} jam/malam. Tidur lebih dari 9 jam secara konsisten juga berkaitan dengan risiko kardiovaskular yang lebih tinggi.`
        });
      }
    }

    // ── Circadian timing ──────────────────────────────────
    if (hour >= 23 || hour < 5) {
      tips.push({
        icon: '🌙',
        category: 'Ritme Sirkadian',
        priority: 'medium',
        title: 'Tidur Terlambat',
        body: 'Waktu tidur yang tidak teratur mengganggu ritme sirkadian dan mempercepat pemendekan telomere (penuaan biologis). Usahakan tidur sebelum pukul 23:00 setiap malam.'
      });
    }

    // ── Biological age ────────────────────────────────────
    if (bioAge && bioAge.delta >= 3) {
      tips.push({
        icon: '🧬',
        category: 'Penuaan Biologis',
        priority: 'high',
        title: `Usia Biologis Lebih Tua ${bioAge.delta} Tahun`,
        body: `Berdasarkan pola tidur Anda, estimasi usia biologis (${bioAge.bioAge} tahun) lebih tua ${bioAge.delta} tahun dari usia kronologis. Penyebab utama: ${bioAge.avgQuality < 60 ? 'kualitas tidur buruk' : bioAge.avgDurHrs < 6.5 ? 'kurang tidur' : 'ritme sirkadian tidak konsisten'}. Perbaiki pola tidur untuk memperlambat penuaan.`
      });
    }

    // ── Risk factor warnings ──────────────────────────────
    if (profile.hypertension && profile.insomnia) {
      tips.push({
        icon: '🩺',
        category: 'Faktor Risiko',
        priority: 'high',
        title: 'Kombinasi Hipertensi + Insomnia Berisiko Tinggi',
        body: 'Insomnia pada penderita hipertensi meningkatkan risiko stroke hingga 8x lipat. Diskusikan terapi kognitif-perilaku untuk insomnia (CBT-I) dengan dokter Anda.'
      });
    }

    if (profile.diabetes && lastSession?.qualityScore < 55) {
      tips.push({
        icon: '🍬',
        category: 'Faktor Risiko',
        priority: 'medium',
        title: 'Kualitas Tidur Buruk Memperburuk Diabetes',
        body: 'Tidur kurang berkualitas meningkatkan resistensi insulin. Pastikan kadar gula darah terkontrol dan hindari konsumsi karbohidrat berat 2 jam sebelum tidur.'
      });
    }

    // ── Positive reinforcement ────────────────────────────
    if (lastSession?.qualityScore >= 85) {
      tips.push({
        icon: '🌟',
        category: 'Apresiasi',
        priority: 'low',
        title: 'Kualitas Tidur Sangat Baik!',
        body: `Skor tidur terakhir Anda: ${lastSession.qualityScore}/100. Pertahankan pola ini! Tidur berkualitas baik secara konsisten mengurangi risiko penyakit jantung dan memperlambat penuaan biologis.`
      });
    }

    // Sort by priority
    const order = { high: 0, medium: 1, low: 2 };
    tips.sort((a, b) => order[a.priority] - order[b.priority]);

    return tips.slice(0, 5); // max 5 recommendations at once
  }
};

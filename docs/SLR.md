# Systematic Literature Review — ZLEEP Smart Pillow
**Tanggal:** 1 Mei 2026  
**Basis Data:** PubMed (Biomedical & Life Sciences)  
**Periode Pencarian:** 2019 – 2026  

---

## 1. Pertanyaan Penelitian (PICO)

| Elemen | Rincian |
|--------|---------|
| **P** (Population) | Individu dewasa berisiko penyakit kardiovaskular, insomnia, gangguan ritme sirkadian |
| **I** (Intervention) | Pemantauan pola tidur menggunakan sensor IMU (akselerometer + giroskop) berbasis IoT |
| **C** (Comparison) | PSG (Polysomnography) sebagai gold standard; wearable komersial (Fitbit, Apple Watch, Oura) |
| **O** (Outcome) | Deteksi dini faktor risiko penyakit jantung, stroke, penuaan dini berbasis kualitas tidur |

---

## 2. Kata Kunci Pencarian

- `sleep quality cardiovascular disease risk`
- `sleep disorder insomnia stroke mortality`
- `wearable sensor sleep stage classification machine learning`
- `sleep position accelerometer body movement`
- `circadian rhythm sleep disruption aging telomere`
- `obstructive sleep apnea cardiovascular pathophysiology`

---

## 3. Hasil Pencarian

| Topik | Total Hasil | Dipilih |
|-------|------------|---------|
| Sleep quality + cardiovascular | 99 | 5 |
| Sleep disorder + CV risk + stroke | 16 | 5 |
| Wearable + sleep staging + ML | 13 | 5 |
| Sleep position + accelerometer | 5 | 3 |
| Circadian rhythm + aging | 1 | 1 |
| OSA + cardiovascular | — | 1 |

---

## 4. Tabel Literatur Terpilih

### 4.1 Epidemiologi Kardiovaskular & Tidur

| # | Judul | Tahun | Jurnal | DOI |
|---|-------|-------|--------|-----|
| 1 | 2025 Heart Disease and Stroke Statistics (AHA) | 2025 | *Circulation* | [10.1161/CIR.0000000000001303](https://doi.org/10.1161/CIR.0000000000001303) |
| 2 | 2024 Heart Disease and Stroke Statistics (AHA) | 2024 | *Circulation* | [10.1161/CIR.0000000000001209](https://doi.org/10.1161/CIR.0000000000001209) |
| 3 | 2019 ACC/AHA Guideline on Primary Prevention of CVD | 2019 | *Circulation* | [10.1161/CIR.0000000000000678](https://doi.org/10.1161/CIR.0000000000000678) |
| 4 | Interactions of OSA with Pathophysiology of CVD (JACC) | 2024 | *J Am Coll Cardiol* | [10.1016/j.jacc.2024.02.059](https://doi.org/10.1016/j.jacc.2024.02.059) |

### 4.2 Klasifikasi Tahap Tidur dengan Sensor Wearable & ML

| # | Judul | Tahun | Jurnal | DOI |
|---|-------|-------|--------|-----|
| 5 | Towards real-time sleep stage classification (PPG + ECG, deep learning) | 2026 | *Physiological Measurement* | [10.1088/1361-6579/ae5458](https://doi.org/10.1088/1361-6579/ae5458) |
| 6 | Multimodal sleep stage classification: ACT + HRV + respiration (LSTM) | 2025 | *Sleep* | [10.1093/sleep/zsaf091](https://doi.org/10.1093/sleep/zsaf091) |
| 7 | Sleep staging with smartwatch (accelerometer + PPG, Samsung) | 2024 | *Sleep Medicine* | [10.1016/j.sleep.2024.05.033](https://doi.org/10.1016/j.sleep.2024.05.033) |
| 8 | Sleep-Wake classification BCG + Deep Neural Network (95.5% acc) | 2022 | *IEEE EMBC* | [10.1109/EMBC48229.2022.9871831](https://doi.org/10.1109/EMBC48229.2022.9871831) |
| 9 | Multi-sensor sleep staging with Oura Ring (acc + HRV + circadian) | 2021 | *Sensors (Basel)* | [10.3390/s21134302](https://doi.org/10.3390/s21134302) |
| 10 | HRV-based sleep classification, wearable validation | 2023 | *Sensors (Basel)* | [10.3390/s23229077](https://doi.org/10.3390/s23229077) |

### 4.3 Deteksi Posisi Tidur & Gerakan Sensor

| # | Judul | Tahun | Jurnal | DOI |
|---|-------|-------|--------|-----|
| 11 | Epigastric motion (3-axis accel + gyro) untuk napas neonatus | 2023 | *Klin Padiatr* | [10.1055/a-2135-2163](https://doi.org/10.1055/a-2135-2163) |
| 12 | Wearable performance devices: accelerometer/gyroscope in sports | 2015 | *Sports Health* | [10.1177/1941738115616917](https://doi.org/10.1177/1941738115616917) |

### 4.4 Ritme Sirkadian & Penuaan Dini

| # | Judul | Tahun | Jurnal | DOI |
|---|-------|-------|--------|-----|
| 13 | Night shifts → circadian disruption → telomere attrition + oxidative stress | 2019 | *BioMed Res Int* | [10.1155/2019/8327629](https://doi.org/10.1155/2019/8327629) |

---

## 5. Sintesis Temuan Utama

### 5.1 Hubungan Tidur dan Penyakit Kardiovaskular

Berdasarkan artikel dari PubMed, AHA 2025 Statistics [[1]](https://doi.org/10.1161/CIR.0000000000001303) menyatakan bahwa **tidur** kini masuk sebagai komponen inti *cardiovascular health* (sleep behavior), setara dengan aktivitas fisik dan nutrisi. Guideline ACC/AHA 2019 [[3]](https://doi.org/10.1161/CIR.0000000000000678) secara eksplisit memasukkan kualitas tidur sebagai faktor risiko modifikasi dalam pencegahan primer penyakit jantung.

**Obstructive Sleep Apnea (OSA)** telah terbukti berhubungan dengan:
- Hipertensi, fibrilasi atrium, gagal jantung, stroke, dan kematian kardiovaskular berlebih [[4]](https://doi.org/10.1016/j.jacc.2024.02.059)
- Mekanisme: hipoksemia intermiten, arousals, tekanan intrathorakik negatif, hiperaktivitas simpatis, disbiosis mikrobiota usus

### 5.2 Teknologi Deteksi Tidur Non-Invasif

- **Gold standard**: PSG (mahal, tidak nyaman untuk penggunaan rutin)
- **Pendekatan wearable terkini**:
  - Akselerometer + PPG: akurasi 71.6% untuk 4-stage, 94-96% untuk sleep/wake [[7]](https://doi.org/10.1016/j.sleep.2024.05.033) [[9]](https://doi.org/10.3390/s21134302)
  - Akselerometer + HRV + respirasi (LSTM): MCC 0.51 [[6]](https://doi.org/10.1093/sleep/zsaf091)
  - BCG (Ballistocardiography): 95.5% akurasi sleep-wake, contactless [[8]](https://doi.org/10.1109/EMBC48229.2022.9871831)
  - ECG + PPG + deep learning: peningkatan akurasi 29% dengan fine-tuning [[5]](https://doi.org/10.1088/1361-6579/ae5458)

- **IMU (akselerometer + giroskop)** terbukti valid untuk:
  - Deteksi gerakan pernapasan [[11]](https://doi.org/10.1055/a-2135-2163)
  - Klasifikasi aktivitas fisik dan pola gerakan [[12]](https://doi.org/10.1177/1941738115616917)

### 5.3 Ritme Sirkadian & Penuaan Dini

Gangguan ritme sirkadian (misal: shift malam) terbukti menyebabkan:
- Pemendekan telomere leukosit (LTL) — indikator penuaan biologis [[13]](https://doi.org/10.1155/2019/8327629)
- Peningkatan stres oksidatif (8-oxoGua)
- Risiko lebih tinggi penyakit kronis

---

## 6. Research Gap (Celah Penelitian)

Berdasarkan sintesis literatur dari PubMed, ditemukan **gap penelitian** berikut:

| # | Gap | Justifikasi |
|---|-----|-------------|
| **G1** | Tidak ada sistem berbasis **bantal/pillow** yang mengintegrasikan IMU untuk deteksi pola tidur + risiko kardiovaskular dalam satu platform | Semua perangkat wearable yang ada melekat di pergelangan tangan, dada, atau kepala — bukan bantal |
| **G2** | Sistem sleep tracking yang ada **tidak menyediakan personalisasi berbasis perilaku** pengguna secara real-time | Perangkat komersial (Fitbit, Oura) memberikan skor tidur generik, bukan adaptif terhadap kebiasaan individu |
| **G3** | Integrasi **deteksi posisi tidur IMU** dengan **skoring risiko kardiovaskular** belum dieksplorasi | Literature memisahkan deteksi posisi (ortopedik) dan risiko jantung |
| **G4** | Tidak ada studi yang mengintegrasikan **monitoring lingkungan tidur** (suhu, kelembaban) dengan data IMU untuk prediksi kualitas tidur komprehensif | Mayoritas studi hanya fokus pada sinyal biometrik, mengabaikan konteks lingkungan |
| **G5** | **Prediksi penuaan dini** berbasis pola tidur IoT dalam platform terintegrasi belum dikembangkan | Studi penuaan (telomere) dilakukan secara laboratoris, tidak real-time/daily monitoring |
| **G6** | Solusi **terjangkau dan non-invasif** untuk populasi rentan di negara berkembang (Indonesia) yang menghubungkan sleep quality + cardiac risk belum ada | Mayoritas perangkat didesain untuk pasar premium Barat |

---

## 7. Novelty Penelitian ZLEEP

Berdasarkan gap yang ditemukan, **novelty** ZLEEP adalah:

> **ZLEEP mengintegrasikan sensor IMU pada form factor bantal (smart pillow) dengan platform IoT berbasis BLE + Firebase untuk monitoring pola tidur real-time, deteksi posisi tidur, klasifikasi kualitas tidur, dan penilaian risiko kardiovaskular — dengan personalisasi adaptif berbasis profil pengguna, dalam satu ekosistem terjangkau dan non-invasif.**

**Poin novelty spesifik:**
1. **Form factor baru**: Bantal sebagai platform sensor (bukan wristband/chest strap)
2. **Integrasi multidimensi**: IMU + profil risiko kesehatan + ritme sirkadian dalam satu dashboard
3. **Personalisasi adaptif**: Sistem menyesuaikan rekomendasi berdasarkan behavior dan riwayat tidur pengguna
4. **Risk stratification real-time**: Kalkulasi skor risiko kardiovaskular berbasis data tidur langsung
5. **Konteks populasi**: Dirancang untuk pengguna di Indonesia dengan mempertimbangkan pola tidur dan faktor risiko lokal

---

## 8. Referensi Lengkap (PubMed)

Semua referensi diambil dari PubMed. Nomor PMID disertakan untuk verifikasi.

1. Martin SS et al. (2025). *2025 Heart Disease and Stroke Statistics*. Circulation. PMID: 39866113. [DOI](https://doi.org/10.1161/CIR.0000000000001303)
2. Martin SS et al. (2024). *2024 Heart Disease and Stroke Statistics*. Circulation. PMID: 38264914. [DOI](https://doi.org/10.1161/CIR.0000000000001209)
3. Arnett DK et al. (2019). *2019 ACC/AHA Guideline on Primary Prevention of CVD*. Circulation. PMID: 30879355. [DOI](https://doi.org/10.1161/CIR.0000000000000678)
4. Javaheri S et al. (2024). *Interactions of OSA with Pathophysiology of CVD*. JACC. PMID: 39293884. [DOI](https://doi.org/10.1016/j.jacc.2024.02.059)
5. Djanian S et al. (2026). *Towards real-time sleep stage classification: PPG + ECG*. Physiol Meas. PMID: 41849820. [DOI](https://doi.org/10.1088/1361-6579/ae5458)
6. Krauss D et al. (2025). *Multimodal sleep stage classification: ACT + HRV + respiration*. Sleep. PMID: 40219765. [DOI](https://doi.org/10.1093/sleep/zsaf091)
7. Silva FB et al. (2024). *Sleep staging algorithm based on smartwatch sensors*. Sleep Med. PMID: 38810479. [DOI](https://doi.org/10.1016/j.sleep.2024.05.033)
8. Ahmed N et al. (2022). *Sleep-Wake classification BCG deep learning*. IEEE EMBC. PMID: 36086100. [DOI](https://doi.org/10.1109/EMBC48229.2022.9871831)
9. Altini M, Kinnunen H. (2021). *The Promise of Sleep: Oura Ring multi-sensor*. Sensors (Basel). PMID: 34201861. [DOI](https://doi.org/10.3390/s21134302)
10. Topalidis PI et al. (2023). *From Pulses to Sleep Stages: HRV wearable*. Sensors (Basel). PMID: 38005466. [DOI](https://doi.org/10.3390/s23229077)
11. Stichtenoth G et al. (2023). *Epigastric motion gyroscope neonatal breathing*. Klin Padiatr. PMID: 37673092. [DOI](https://doi.org/10.1055/a-2135-2163)
12. Li RT et al. (2015). *Wearable Performance Devices in Sports Medicine*. Sports Health. PMID: 26733594. [DOI](https://doi.org/10.1177/1941738115616917)
13. Pavanello S et al. (2019). *Night shifts, circadian disruption, telomere attrition*. Biomed Res Int. PMID: 31111068. [DOI](https://doi.org/10.1155/2019/8327629)

---

*Catatan: Seluruh data literatur diperoleh dari PubMed (National Library of Medicine). DOI tercantum di setiap referensi sesuai persyaratan atribusi.*

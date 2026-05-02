# Dokumen Perancangan Aplikasi ZLEEP
**Versi:** 2.0  
**Tanggal:** 2 Mei 2026  
**Status:** Aktif — v2.0 Live di Firebase Hosting  

---

## 1. Ringkasan Eksekutif

ZLEEP adalah aplikasi web Single Page Application (SPA) yang terhubung ke bantal pintar (Smart Pillow) melalui Bluetooth Low Energy (BLE). Aplikasi memantau pola tidur pengguna secara real-time menggunakan data sensor IMU (Inertial Measurement Unit), menyimpan data ke Firebase Realtime Database, dan memberikan analisis kualitas tidur serta indikator risiko kesehatan kardiovaskular.

---

## 2. Arsitektur Sistem

```
┌─────────────────────────────────────────────────────┐
│                  ZLEEP ECOSYSTEM                     │
│                                                      │
│  ┌──────────────┐     BLE      ┌──────────────────┐ │
│  │  Smart Pillow │◄────────────►│  Web Browser     │ │
│  │  (ESP32 +    │             │  (Chrome/Edge)   │ │
│  │   IMU MPU6050│             │                  │ │
│  └──────────────┘             │  ZLEEP SPA       │ │
│                               │  HTML/CSS/JS     │ │
│                               └────────┬─────────┘ │
│                                        │ HTTPS      │
│                               ┌────────▼─────────┐ │
│                               │  Firebase         │ │
│                               │  ├─ Hosting       │ │
│                               │  ├─ Realtime DB   │ │
│                               │  └─ Auth          │ │
│                               └──────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## 3. Komponen Hardware

### 3.1 ZLEEP Smart Pillow
| Komponen | Spesifikasi |
|----------|-------------|
| Mikrokontroler | ESP32 (BLE + WiFi) |
| Sensor IMU | MPU-6050 (3-axis accel + 3-axis gyro) atau MPU-9250 (+ magnetometer) |
| Sampling Rate | 10–50 Hz (configurable) |
| Power | LiPo 3.7V 2000mAh |
| BLE Service | Nordic UART Service (NUS) |

### 3.2 Protokol BLE

```
Service UUID  : 6e400001-b5a3-f393-e0a9-e50e24dcca9e
TX Char UUID  : 6e400003-b5a3-f393-e0a9-e50e24dcca9e  (device→app)
RX Char UUID  : 6e400002-b5a3-f393-e0a9-e50e24dcca9e  (app→device)

Packet Format (12 bytes, little-endian):
  Bytes  0-1  : Accel X  (int16, unit: 0.01 g)
  Bytes  2-3  : Accel Y
  Bytes  4-5  : Accel Z
  Bytes  6-7  : Gyro  X  (int16, unit: 0.01 °/s)
  Bytes  8-9  : Gyro  Y
  Bytes 10-11 : Gyro  Z
```

---

## 4. Arsitektur Software (SPA)

### 4.1 Struktur File
```
zleep/
├── index.html              # SPA shell, semua halaman dalam 1 file
├── css/
│   └── style.css           # Styling (dark theme, responsive)
├── js/
│   ├── firebase-config.js  # Inisialisasi Firebase
│   ├── bluetooth.js        # Web Bluetooth API (BLE manager)
│   ├── database.js         # Firebase Realtime DB operations (auth-aware UID)
│   ├── sleep.js            # Algoritma analisis tidur (v2.0: stages, OSA, bio age, RR)
│   ├── auth.js             # Firebase Auth manager (email/password + anonymous) [v1.1]
│   ├── recommendations.js  # Adaptive recommendation engine [v2.0]
│   ├── pdf-export.js       # jsPDF medical report generator [v2.0]
│   └── app.js              # Main app controller (SPA router + UI)
├── docs/
│   ├── SLR.md              # Systematic Literature Review
│   └── DESIGN.md           # Dokumen ini
├── firebase.json           # Firebase Hosting config
├── database.rules.json     # Firebase DB security rules
└── .github/
    └── workflows/
        └── firebase-deploy.yml  # CI/CD auto-deploy (service account)
```

### 4.2 Modul JavaScript

#### `firebase-config.js`
- Menginisialisasi Firebase App dengan konfigurasi proyek
- Mengekspor instance `db` (Realtime Database)

#### `bluetooth.js` — `ZleepBluetooth` class
| Method | Fungsi |
|--------|--------|
| `connect()` | Memulai Web BT request device dialog |
| `disconnect()` | Putus koneksi GATT |
| `sendCommand(cmd)` | Kirim perintah ke hardware (via RX char) |
| `_parse(event)` | Parse 12-byte IMU packet → objek JS |
| `_onDisconnected()` | Handler saat koneksi putus |

#### `database.js` — `ZleepDatabase` class
| Method | Fungsi |
|--------|--------|
| `startSession()` | Buat sesi baru di Firebase |
| `endSession(summary)` | Tutup sesi + simpan summary |
| `pushImuSample(imu)` | Push data IMU ke realtime path |
| `flushImuBatch(batch)` | Flush batch summary setiap 30 detik |
| `subscribeRealtime(cb)` | Subscribe live data dari Firebase |
| `getSessions(limit)` | Ambil riwayat sesi |
| `saveProfile(data)` | Simpan profil pengguna |

#### `sleep.js` — `SleepAnalysis` objek (v2.0)
| Method | Fungsi |
|--------|--------|
| `detectPosition(ax,ay,az)` | Klasifikasi posisi: terlentang/tengkurap/kiri/kanan |
| `magnitude(ax,ay,az)` | Hitung magnitudo vektor akselerasi |
| `movementIntensity(samples)` | Hitung intensitas gerakan (0–1) |
| `qualityScore(samples, durationMs)` | Skor kualitas tidur (0–100) |
| `qualityLabel(score)` | Label: Sangat Baik/Baik/Cukup/Buruk |
| `cardioRisk(profile, quality, duration)` | Skor risiko kardiovaskular (0–100) |
| `riskLabel(score)` | Label: Rendah/Sedang/Tinggi/Kritis |
| `respiratoryRate(samples, hz)` | Hitung laju napas (bpm) via zero-crossing az ter-detrend |
| `classifyEpoch(samples)` | Klasifikasi epoch 30s: deep/light/rem/awake (stddev + kurtosis) |
| `sleepStageTimeline(samples, hz)` | Array stage per epoch 30 detik |
| `detectApneaEvents(samples, hz)` | Deteksi event apnea: rr===null + intensitas < 0.02 |
| `biologicalAge(chronoAge, sessions)` | Estimasi usia biologis (Pavanello 2019): offset berdasarkan kualitas + durasi + circadian SD |

#### `auth.js` — `ZleepAuth` class (v1.1)
| Method | Fungsi |
|--------|--------|
| `loginEmail(email, password)` | Login dengan email/password |
| `registerEmail(email, password, name)` | Registrasi akun baru |
| `loginAnonymous()` | Login sebagai tamu (anonymous) |
| `upgradeAnonymous(email, password, name)` | Upgrade tamu → akun permanen |
| `logout()` | Logout dari Firebase Auth |

#### `recommendations.js` — `Recommendations` class (v2.0)
`Recommendations.generate({profile, sessions, lastSession, currentPosition, osaAhi, respiratoryRate, bioAge})` — menghasilkan max 5 rekomendasi adaptif (high/medium/low priority) berdasarkan:
- Posisi tidur (prone, sisi kanan dengan riwayat jantung)
- OSA AHI (mild/moderate/severe threshold)
- Laju napas abnormal
- Ritme sirkadian terlambat
- Delta usia biologis ≥ 3 tahun
- Komorbiditas (hipertensi+insomnia, diabetes+kualitas buruk)
- Positive reinforcement untuk pola baik

#### `pdf-export.js` — `PdfExport` class (v2.0)
`PdfExport.generate({profile, session, stageSummary, apneaEvents, bioAge, recommendations})` — laporan medis A4 format jsPDF 2.5.1:
- Header branded ZLEEP
- Info pasien (nama, usia, gender)
- 4 kartu metrik utama (kualitas, durasi, AHI, laju napas)
- Sleep stage stacked bar chart
- OSA assessment cards
- Risk factors dan rekomendasi dengan color-coded priority
- Footer disclaimer medis

#### `app.js` — IIFE App Controller (v2.0)
| Fungsi | Deskripsi |
|--------|-----------|
| `init()` | Setup semua komponen, router, circadian marker |
| `connect()` / `connectDemo()` | Koneksi BLE atau mode demo |
| `toggleSession()` | Mulai/akhiri sesi monitoring tidur |
| `onImuData(imu)` | Handler data IMU: update chart, DB, analisis |
| `updateCharts(imu)` | Push data ke Chart.js (real-time) |
| `detectPosition(imu)` | Update UI posisi tidur |
| `updatePeriodicAnalysis()` | Analisis periodik 30s: RR, stage, OSA, rekomendasi |
| `updateAnalysisSection()` | Render halaman Analysis (donut, line chart, bio age, OSA scale) |
| `generateRecommendations()` | Render panel rekomendasi adaptif |
| `exportPdf()` | Generate dan unduh laporan PDF medis |
| `setupRouter()` | Hash-based SPA routing (#dashboard, #monitor, #analysis, #history, #profile) |
| `loadHistory()` | Load riwayat sesi + weekly stats dari Firebase |
| `saveProfile()` | Simpan profil + faktor risiko |

---

## 5. Halaman Aplikasi (SPA Pages)

### 5.1 Dashboard (`#dashboard`)
**Tujuan**: Overview kesehatan tidur pengguna

**Komponen UI:**
- **Kualitas Tidur** — Skor 0-100 + progress bar + badge (Sangat Baik/Baik/Cukup/Buruk)
- **Sleep Stage** — Label stage saat ini + mini bar proporsi (deep/REM/light/awake) [v2.0]
- **Laju Napas** — bpm real-time + status (normal/tinggi/rendah) [v2.0]
- **OSA AHI** — Nilai AHI + badge severity (Normal/Ringan/Sedang/Berat) [v2.0]
- **Usia Biologis** — Perbandingan bio age vs usia kronologis + delta [v2.0]
- **Posisi Tidur** — Label posisi real-time + visual representasi badan
- **Risiko Kardiovaskular** — Persentase risiko + badge warna (hijau/kuning/merah)
- **Ritme Sirkadian** — Timeline bar dengan marker posisi waktu saat ini
- **Panel Rekomendasi** — Max 5 tip adaptif dengan color-coded priority [v2.0]
- **Tombol Mulai/Akhiri Sesi** — Dengan timer sesi aktif di header

### 5.2 Monitor Real-time (`#monitor`)
**Tujuan**: Visualisasi raw data sensor IMU

**Komponen UI:**
- **Chart Akselerometer** — Line chart 60 detik rolling (aX, aY, aZ, magnitudo)
- **Chart Giroskop** — Line chart 60 detik rolling (gX, gY, gZ)
- **Raw Data Grid** — 6 kotak nilai numerik (aX, aY, aZ, gX, gY, gZ) real-time
- **Badge sampling rate** — Frekuensi pengambilan data (Hz)

### 5.3 Analisis (`#analysis`) [v2.0]
**Tujuan**: Deep-dive analisis sesi terakhir

**Komponen UI:**
- **Sleep Stage Donut Chart** — Proporsi waktu per stage (deep/REM/light/awake)
- **Respiratory Rate Line Chart** — Laju napas per epoch sepanjang sesi
- **Bio Age Detail Card** — Breakdown komponen penuaan biologis
- **OSA AHI Scale** — Gauge dengan jarum menunjukkan nilai AHI
- **Tombol Export PDF** — Unduh laporan medis lengkap

### 5.4 Riwayat (`#history`)
**Tujuan**: Analisis tren tidur historis

**Komponen UI:**
- **Bar Chart Kualitas** — Kualitas tidur 7 sesi terakhir
- **Bar Chart Durasi** — Durasi tidur 7 sesi terakhir [v2.0]
- **Weekly Stats Grid** — 4 kartu: rata-rata kualitas, rata-rata durasi, total sesi, skor tertinggi [v2.0]
- **Daftar Sesi** — Tanggal, durasi, skor kualitas setiap sesi
- Data diambil dari Firebase Realtime Database

### 5.5 Profil (`#profile`)
**Tujuan**: Personalisasi pengguna

**Komponen UI:**
- **Data Pengguna** — Nama, usia, jenis kelamin
- **Faktor Risiko Kesehatan** — Checkbox: hipertensi, diabetes, obesitas, perokok, riwayat jantung, insomnia
- **Preferensi Tidur** — Target jam tidur, durasi, frekuensi notifikasi
- **Auth Controls** — Tombol logout / info akun [v1.1]
- **Info Penelitian** — Judul penelitian, versi app

---

## 6. Alur Data

```
IMU Sensor (ESP32)
       │ BLE Notification (12 bytes, 5–50 Hz)
       ▼
bluetooth.js._parse()
       │ {ax, ay, az, gx, gy, gz, ts}
       ▼
app.js.onImuData()
  ├──► updateRawDisplay()     → DOM update (nilai numerik)
  ├──► updateCharts()         → Chart.js rolling window
  ├──► updatePositionDisplay()→ Deteksi posisi + UI
  ├──► updateMovementDisplay()→ Gauge + movement score
  ├──► database.pushImuSample()→ Firebase realtime/{uid}/imu
  └──► (30s interval) database.flushImuBatch() → sessions/{id}/batches

Periodic Analysis (every 30s):
  SleepAnalysis.respiratoryRate(buffer, hz)       → updateRespDisplay()
  SleepAnalysis.sleepStageTimeline(buffer, hz)    → updateStageDisplay()
  SleepAnalysis.detectApneaEvents(buffer, hz)     → updateOsaDisplay()
  Recommendations.generate({...})                 → generateRecommendations()

End Session:
  SleepAnalysis.qualityScore(buffer, durationMs)
  SleepAnalysis.cardioRisk(profile, quality, hours)
  SleepAnalysis.biologicalAge(age, sessions)
  database.endSession({qualityScore, durationMs, riskScore, stageTimeline, osaAhi, avgRr, bioAge})
```

---

## 7. Struktur Data Firebase

```json
{
  "users": {
    "{uid}": {
      "profile": {
        "name": "string",
        "age": "number",
        "gender": "M|F",
        "hypertension": "boolean",
        "diabetes": "boolean",
        "bedtime": "string (HH:mm)",
        "duration": "number (hours)"
      },
      "sessions": {
        "{sessionId}": {
          "startTime": "timestamp",
          "endTime": "timestamp",
          "status": "active|completed",
          "deviceName": "string",
          "qualityScore": "number (0-100)",
          "durationMs": "number",
          "riskScore": "number (0-100)",
          "qualityScore": "number (0-100)",
          "durationMs": "number",
          "riskScore": "number (0-100)",
          "stageTimeline": ["deep|light|rem|awake"],
          "osaAhi": "number",
          "avgRr": "number (breaths/min)",
          "bioAge": "number",
          "batches": {
            "{batchId}": {
              "count": "number",
              "avgAx": "number",
              "avgAy": "number",
              "avgAz": "number",
              "maxMag": "number",
              "ts": "timestamp"
            }
          }
        }
      }
    }
  },
  "realtime": {
    "{uid}": {
      "imu": {
        "ax": "number",
        "ay": "number",
        "az": "number",
        "gx": "number",
        "gy": "number",
        "gz": "number",
        "ts": "timestamp"
      }
    }
  }
}
```

---

## 8. Algoritma Analisis Tidur

### 8.1 Deteksi Posisi Tidur (dari vektor akselerasi)
```
Normalisasi: n = {ax,ay,az} / |{ax,ay,az}|

az_norm >  0.75  → Terlentang (Supine)
az_norm < -0.75  → Tengkurap (Prone)
ay_norm >  0.65  → Sisi Kanan (Right lateral)
ay_norm < -0.65  → Sisi Kiri (Left lateral)
else             → Miring (Oblique)
```

### 8.2 Laju Napas dari IMU (v2.0)
```
Detrend az axis (kurangi rata-rata)
Smooth dengan moving average 3-sample
Hitung zero-crossings (positif → negatif)
RR = (crossings / 2) / (durasi_detik / 60)   [breaths/min]
Sanity check: valid jika 6 ≤ RR ≤ 40, else null
```

### 8.3 Klasifikasi Tahap Tidur per Epoch 30s (v2.0)
```
stddev = √(variance(magnitude(epoch_samples)))
kurtosis = E[(x-μ)⁴] / σ⁴

stddev > 0.18            → Awake
stddev > 0.08            → Light
kurtosis > 4.5 && < 0.07 → REM   (twitches/bursts)
else                     → Deep
```

### 8.4 Deteksi Apnea (OSA Proxy, v2.0)
```
Jendela 10 detik:
  rr = respiratoryRate(window)
  intensity = movementIntensity(window)
  if (rr === null && intensity < 0.02) → apnea event

AHI = (jumlah_event / durasi_jam)
  0–5    → Normal
  5–15   → Ringan
  15–30  → Sedang
  >30    → Berat
```

### 8.5 Usia Biologis (Pavanello 2019, v2.0)
```
avgQuality  = rata-rata qualityScore dari sesi terakhir
avgDurHrs   = rata-rata durasi tidur (jam)
bedtimeSD   = standar deviasi waktu tidur (menit) — proxy circadian disruption

offset =
  (avgQuality < 65 ? +3 : avgQuality > 80 ? -2 : 0)   // quality component
+ (avgDurHrs < 6.5 ? +2 : avgDurHrs > 8.5 ? +1 : -1)  // duration component
+ (bedtimeSD > 60 ? +3 : bedtimeSD > 30 ? +1 : -1)     // circadian SD component

bioAge = chronologicalAge + offset
confidence = "low" (<3 sesi) | "medium" (<7) | "high" (≥7)
```

### 8.6 Skor Kualitas Tidur (0–100)
```
intensity  = √(variance(magnitude(samples)))  × 5, clamped [0,1]
movScore   = 100 - intensity × 80           (bobot 50%)
durScore   = min(100, (durationHrs/8) × 100) (bobot 30%)
posScore   = 100 - positionChanges × 5       (bobot 20%)
quality    = round(movScore×0.5 + durScore×0.3 + posScore×0.2)
```

### 8.7 Skor Risiko Kardiovaskular (0–100)
| Faktor | Poin |
|--------|------|
| Hipertensi | +20 |
| Riwayat penyakit jantung | +25 |
| Diabetes | +15 |
| Kualitas tidur buruk (<55) | +15 |
| Durasi tidur <6 jam | +15 |
| Obesitas | +10 |
| Perokok | +10 |
| Usia >60 tahun | +10 |
| Usia 45–60 tahun | +5 |
| Durasi tidur >9 jam | +5 |

---

## 9. Teknologi yang Digunakan

| Layer | Teknologi |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES6+) |
| BLE | Web Bluetooth API (Chrome/Edge) |
| Visualisasi | Chart.js 4.4.0 |
| PDF Export | jsPDF 2.5.1 |
| Auth | Firebase Authentication (email/password + anonymous) |
| Backend/DB | Firebase Realtime Database |
| Hosting | Firebase Hosting |
| CI/CD | GitHub Actions + google-github-actions/auth@v2 (service account) |
| Protocol | BLE GATT (Nordic UART Service) |

---

## 10. CI/CD & Deployment

### 10.1 Auto-Deploy GitHub Actions
Setiap `git push` ke branch `main` otomatis trigger:
1. Install Firebase CLI
2. `firebase deploy --only hosting`
3. `firebase deploy --only database` (rules)

### 10.2 Setup Awal (Satu Kali)
1. Buat GitHub repository
2. Buat Service Account Firebase di Google Cloud Console
3. Download JSON key → upload ke GitHub Secrets sebagai `FIREBASE_SERVICE_ACCOUNT`
4. Push ke main → deploy otomatis via `google-github-actions/auth@v2`

### 10.3 Perintah Manual
```bash
# Deploy manual
firebase deploy

# Deploy hosting saja
firebase deploy --only hosting

# Serve lokal
firebase serve
```

---

## 11. Roadmap Pengembangan

| Fase | Fitur | Status |
|------|-------|--------|
| **v1.0** | BLE + real-time monitoring + Firebase + basic analytics | ✅ Done |
| **v1.1** | Autentikasi Firebase (email/password + anonymous) | ✅ Done |
| **v1.2** | Klasifikasi tahap tidur rule-based (stddev + kurtosis per epoch 30s) | ✅ Done |
| **v2.0** | OSA proxy (AHI), laju napas IMU, usia biologis, rekomendasi adaptif, PDF export | ✅ Done |
| **v1.3** | Notifikasi push (FCM) dan laporan harian otomatis | ⏳ Planned |
| **v2.1** | Environment monitoring: suhu + kelembaban (DHT22 pada ESP32) | ⏳ Planned (butuh hardware) |
| **v2.2** | Integrasi pulse oximeter via BLE (SpO₂ + heart rate) | ⏳ Planned (butuh hardware) |

---

## 12. Limitasi Saat Ini (v2.0)

1. **Web Bluetooth API** hanya tersedia di Chrome/Edge — tidak di Safari/Firefox
2. Klasifikasi tahap tidur masih rule-based (stddev + kurtosis); akurasi lebih rendah dari EEG/PSG
3. **Laju napas** dihitung dari axis az (gerakan kepala/bantal) — dapat terganggu oleh gerakan tubuh besar
4. **OSA AHI** adalah proxy, bukan diagnosis klinis — tidak menggantikan pemeriksaan PSG
5. **Usia biologis** menggunakan formula sederhana berbasis Pavanello 2019 — bukan biomarker langsung (telomere)
6. Raw IMU samples tidak disimpan per-titik (hanya batch summary + analysis results) untuk menghemat kuota Firebase
7. Environment monitoring (suhu/kelembaban) belum tersedia — menunggu integrasi DHT22 pada firmware ESP32

---

*Dokumen ini diupdate sesuai perkembangan aktual. Versi terakhir: 2.0 (2 Mei 2026).*

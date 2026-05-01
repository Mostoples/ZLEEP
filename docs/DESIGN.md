# Dokumen Perancangan Aplikasi ZLEEP
**Versi:** 1.0  
**Tanggal:** 1 Mei 2026  
**Status:** Draft — Menunggu Persetujuan  

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
│                               │  └─ Auth (future) │ │
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
│   ├── database.js         # Firebase Realtime DB operations
│   ├── sleep.js            # Algoritma analisis tidur
│   └── app.js              # Main app controller (SPA router + UI)
├── docs/
│   ├── SLR.md              # Systematic Literature Review
│   └── DESIGN.md           # Dokumen ini
├── firebase.json           # Firebase Hosting config
├── database.rules.json     # Firebase DB security rules
└── .github/
    └── workflows/
        └── firebase-deploy.yml  # CI/CD auto-deploy
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

#### `sleep.js` — `SleepAnalysis` objek
| Method | Fungsi |
|--------|--------|
| `detectPosition(ax,ay,az)` | Klasifikasi posisi: terlentang/tengkurap/kiri/kanan |
| `magnitude(ax,ay,az)` | Hitung magnitudo vektor akselerasi |
| `movementIntensity(samples)` | Hitung intensitas gerakan (0–1) |
| `qualityScore(samples, durationMs)` | Skor kualitas tidur (0–100) |
| `qualityLabel(score)` | Label: Sangat Baik/Baik/Cukup/Buruk |
| `cardioRisk(profile, quality, duration)` | Skor risiko kardiovaskular (0–100) |
| `riskLabel(score)` | Label: Rendah/Sedang/Tinggi/Kritis |

#### `app.js` — IIFE App Controller
| Fungsi | Deskripsi |
|--------|-----------|
| `init()` | Setup semua komponen, router, circadian marker |
| `connect()` / `connectDemo()` | Koneksi BLE atau mode demo |
| `toggleSession()` | Mulai/akhiri sesi monitoring tidur |
| `onImuData(imu)` | Handler data IMU: update chart, DB, analisis |
| `updateCharts(imu)` | Push data ke Chart.js (real-time) |
| `detectPosition(imu)` | Update UI posisi tidur |
| `setupRouter()` | Hash-based SPA routing (#dashboard, #monitor, dll) |
| `navigateTo(section)` | Pindah antar halaman SPA |
| `loadHistory()` | Load riwayat sesi dari Firebase |
| `saveProfile()` | Simpan profil + faktor risiko |

---

## 5. Halaman Aplikasi (SPA Pages)

### 5.1 Dashboard (`#dashboard`)
**Tujuan**: Overview kesehatan tidur pengguna

**Komponen UI:**
- **Kualitas Tidur** — Skor 0-100 + progress bar + badge (Sangat Baik/Baik/Cukup/Buruk)
- **Posisi Tidur** — Label posisi real-time + visual representasi badan
- **Indeks Gerakan** — Nilai intensitas + gauge semi-circle animated
- **Risiko Kardiovaskular** — Persentase risiko + badge warna (hijau/kuning/merah)
- **Ritme Sirkadian** — Timeline bar dengan marker posisi waktu saat ini
- **Tombol Mulai/Akhiri Sesi** — Dengan timer sesi aktif di header

### 5.2 Monitor Real-time (`#monitor`)
**Tujuan**: Visualisasi raw data sensor IMU

**Komponen UI:**
- **Chart Akselerometer** — Line chart 60 detik rolling (aX, aY, aZ, magnitudo)
- **Chart Giroskop** — Line chart 60 detik rolling (gX, gY, gZ)
- **Raw Data Grid** — 6 kotak nilai numerik (aX, aY, aZ, gX, gY, gZ) real-time
- **Badge sampling rate** — Frekuensi pengambilan data (Hz)

### 5.3 Riwayat (`#history`)
**Tujuan**: Analisis tren tidur historis

**Komponen UI:**
- **Bar Chart** — Kualitas tidur 7 sesi terakhir
- **Daftar Sesi** — Tanggal, durasi, skor kualitas setiap sesi
- Data diambil dari Firebase Realtime Database

### 5.4 Profil (`#profile`)
**Tujuan**: Personalisasi pengguna

**Komponen UI:**
- **Data Pengguna** — Nama, usia, jenis kelamin
- **Faktor Risiko Kesehatan** — Checkbox: hipertensi, diabetes, obesitas, perokok, riwayat jantung, insomnia
- **Preferensi Tidur** — Target jam tidur, durasi, frekuensi notifikasi
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

End Session:
  SleepAnalysis.qualityScore(buffer, durationMs)
  SleepAnalysis.cardioRisk(profile, quality, hours)
  database.endSession({qualityScore, durationMs, riskScore})
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

### 8.2 Skor Kualitas Tidur (0–100)
```
intensity  = √(variance(magnitude(samples)))  × 5, clamped [0,1]
movScore   = 100 - intensity × 80           (bobot 50%)
durScore   = min(100, (durationHrs/8) × 100) (bobot 30%)
posScore   = 100 - positionChanges × 5       (bobot 20%)
quality    = round(movScore×0.5 + durScore×0.3 + posScore×0.2)
```

### 8.3 Skor Risiko Kardiovaskular (0–100)
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
| Backend/DB | Firebase Realtime Database |
| Hosting | Firebase Hosting |
| CI/CD | GitHub Actions |
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
2. Dapatkan Firebase token: `firebase login:ci`
3. Tambahkan ke GitHub Secrets: `Settings > Secrets > FIREBASE_TOKEN`
4. Push ke main → deploy otomatis

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
| **v1.0** (sekarang) | BLE + real-time monitoring + Firebase + basic analytics | ✅ Done |
| **v1.1** | Autentikasi Firebase (login/register) | Planned |
| **v1.2** | Machine learning lokal (TensorFlow.js) untuk klasifikasi tahap tidur | Planned |
| **v1.3** | Notifikasi push (FCM) dan laporan harian | Planned |
| **v2.0** | Sensor tambahan: suhu/kelembaban (environment monitoring) | Planned |
| **v2.1** | Integrasi dengan perangkat medis (pulse oximeter via BLE) | Planned |

---

## 12. Limitasi Saat Ini (v1.0)

1. **Web Bluetooth API** hanya tersedia di Chrome/Edge — tidak di Safari/Firefox
2. Algoritma skor kualitas tidur masih rule-based (belum ML)
3. Tidak ada autentikasi — data berdasarkan UID lokal (localStorage)
4. Raw IMU samples tidak disimpan per-titik (hanya batch summary) untuk menghemat kuota Firebase

---

*Dokumen ini merupakan draft perancangan dan akan diupdate seiring pengembangan.*

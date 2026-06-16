# K3 Monitoring

K3 Monitoring adalah sistem monitoring pelanggaran keselamatan kerja berbasis web. Sistem ini menghubungkan backend FastAPI dengan frontend React untuk mendeteksi pelanggaran APD, menampilkan monitoring real-time, menyimpan bukti pelanggaran, mengelola validasi, dan menghasilkan laporan.

Dokumentasi ini menjelaskan cara menjalankan aplikasi, role user, alur kerja, dan fitur yang tersedia.

## Teknologi

- Backend: FastAPI, SQLite, WebSocket, OpenCV
- Frontend: React, Vite, Tailwind CSS
- Monorepo tooling: pnpm workspace
- Database lokal: SQLite
- Komunikasi real-time: WebSocket
- Export laporan: CSV dan PDF

## Prasyarat

- Python 3.11 atau lebih baru
- Node.js 18 atau lebih baru
- pnpm 10 atau lebih baru
- Webcam atau sumber RTSP jika ingin mencoba monitoring kamera

Jika pnpm belum tersedia, aktifkan lewat Corepack:

```powershell
corepack enable
```

## Struktur Monorepo

Project ini memakai pnpm workspace dari root repository.

```text
k3-monitoring/
  backend/              FastAPI backend
  frontend/             React + Vite frontend
  package.json          Script monorepo
  pnpm-workspace.yaml   Daftar workspace package
  pnpm-lock.yaml        Lockfile pnpm
```

Workspace package:

| Package | Path | Fungsi |
| --- | --- | --- |
| `k3-monitoring` | `.` | Script root untuk menjalankan app |
| `k3-monitoring-backend` | `backend` | Script dev backend FastAPI |
| `k3-monitoring-dashboard` | `frontend` | Frontend React + Vite |

Install dependency frontend dari root:

```powershell
pnpm install
```

Jalankan frontend dan backend dari root:

```powershell
pnpm dev
```

Script root yang tersedia:

```powershell
pnpm dev
pnpm dev:backend
pnpm dev:frontend
pnpm build
pnpm preview
```

## Cara Menjalankan Backend

Backend tetap dapat dijalankan langsung dari folder `backend`.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

Jika PowerShell memblokir aktivasi virtual environment, jalankan perintah ini satu kali di terminal tersebut:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Backend berjalan di:

```text
http://127.0.0.1:8000
```

Cek status backend:

```text
http://127.0.0.1:8000/status
```

Untuk terminal backend berikutnya, cukup aktifkan virtual environment:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
```

Jika dependency Python sudah terinstall, backend juga dapat dijalankan dari root lewat pnpm:

```powershell
pnpm dev:backend
```

## Cara Menjalankan Frontend

Frontend menggunakan Vite. Bukti konfigurasi:

- `frontend/package.json` memakai script `vite`, `vite build`, dan `vite preview`
- `frontend/vite.config.js` memakai `defineConfig` dari Vite dan plugin React
- Entry HTML ada di `frontend/index.html`

Jalankan dari root monorepo:

```powershell
pnpm dev:frontend
```

Atau dari folder frontend:

```powershell
cd frontend
pnpm dev
```

Frontend biasanya berjalan di:

```text
http://localhost:5173
```

Frontend sudah diarahkan ke backend:

```text
http://127.0.0.1:8000
```

Konfigurasi base URL frontend memakai environment variable Vite:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Jika variable ini tidak diset, frontend fallback ke `http://127.0.0.1:8000`.


## Cara Menjalankan Kamera untuk Demo

Untuk demo monitoring, ada tiga pilihan input kamera. Pilih salah satu sesuai kebutuhan.

| Mode | Butuh FFmpeg | Butuh Docker | Kegunaan |
| --- | --- | --- | --- |
| Simulasi WebSocket | Tidak | Tidak | Testing cepat live monitoring |
| RTSP FFmpeg | Ya | Tidak | Demo kamera RTSP dari video MP4 |
| RTSP Docker | Ya | Ya | Demo RTSP multi-stream lebih rapi |

Rekomendasi paling aman untuk demo lokal adalah **Simulasi WebSocket**. Jika ingin menunjukkan fitur tambah kamera RTSP di halaman Management, gunakan **RTSP FFmpeg**.

### Install FFmpeg Essentials

FFmpeg hanya diperlukan untuk mode RTSP dari video MP4. Gunakan **FFmpeg Essentials Build** agar lebih ringan daripada full build.

Install lewat PowerShell:

```powershell
winget install -e --id Gyan.FFmpeg.Essentials
```

Setelah install, tutup terminal lalu buka PowerShell baru. Cek instalasi:

```powershell
ffmpeg -version
```

Jika muncul versi FFmpeg, berarti sudah siap digunakan.

### Mode 1: Simulasi WebSocket

Mode ini tidak memakai RTSP. Video atau webcam langsung dikirim ke backend melalui WebSocket.

Jalankan backend dan frontend terlebih dahulu, lalu buka terminal baru.

Contoh menjalankan video sample:

```powershell
cd backend
.\.venv\Scripts\python.exe tools/stream_source.py --source tools/sample_video/sample-k3.mp4 --camera-id sample_k3 --fps 2
```

Contoh menjalankan sample CCTV:

```powershell
cd backend
.\.venv\Scripts\python.exe tools/stream_source.py --source tools/sample_video/sample-k3-cctv.mp4 --camera-id sample_cctv --fps 2
```

Contoh menjalankan webcam lokal:

```powershell
cd backend
.\.venv\Scripts\python.exe tools/stream_source.py --source 0 --camera-id webcam_local --fps 2
.\.venv\Scripts\python.exe tools/stream_source.py --source 1 --camera-id iriun_webcam_local --fps 2
```

Setelah itu buka halaman **Monitoring**, lalu pilih camera ID yang sesuai, misalnya `sample_k3`, `sample_cctv`, atau `webcam_local`.

### Mode 2: RTSP FFmpeg

Mode ini mengubah video MP4 menjadi RTSP stream tanpa Docker. File script yang digunakan:

```text
backend/tools/rtsp_ffmpeg.ps1
```

Jalankan dari folder `backend`:

```powershell
cd backend
powershell -ExecutionPolicy Bypass -File tools/rtsp_ffmpeg.ps1
```

Script memakai file sample dari `backend/tools/sample_video` secara default.

Secara default script membuat dua RTSP URL:

```text
rtsp://127.0.0.1:8554/sample_k3
rtsp://127.0.0.1:8555/sample_cctv
```

Tambahkan URL tersebut di halaman **Management Kamera**.

Kamera pertama:

```text
Nama Kamera : sample_k3
RTSP URL    : rtsp://127.0.0.1:8554/sample_k3
```

Kamera kedua:

```text
Nama Kamera : sample_k3_cctv
RTSP URL    : rtsp://127.0.0.1:8555/sample_k3_cctv
```

Kamera ketiga:

```text
Nama Kamera : sample_k3_cctv_2
RTSP URL    : rtsp://127.0.0.1:8555/sample_k3_cctv_2
```

Setelah kamera ditambahkan, buka halaman **Monitoring**.

### Mode 3: RTSP Docker

Mode ini memakai Docker dan MediaMTX sebagai RTSP server.

File script yang digunakan:

```text
backend/tools/rtsp_docker.ps1
```

Jalankan dari folder `backend`:

```powershell
cd backend
powershell -ExecutionPolicy Bypass -File tools/rtsp_docker.ps1
```

Script memakai file sample dari `backend/tools/sample_video` secara default.

Secara default script membuat dua RTSP URL dalam satu port:

```text
rtsp://127.0.0.1:8554/sample_k3
rtsp://127.0.0.1:8554/sample_k3_cctv
rtsp://127.0.0.1:8554/sample_k3_cctv_2
```

Tambahkan URL tersebut di halaman **Management Kamera**, lalu buka halaman **Monitoring**.

### Catatan Troubleshooting Kamera

Jika FFmpeg tidak dikenali:

```powershell
winget install -e --id Gyan.FFmpeg.Essentials
```

Lalu buka ulang PowerShell dan cek:

```powershell
ffmpeg -version
```

Jika RTSP tidak tampil:

1. Pastikan terminal FFmpeg masih berjalan.
2. Pastikan backend dan frontend aktif.
3. Pastikan kamera sudah ditambahkan dan aktif di halaman Management.
4. Coba restart stream dari halaman Management atau Monitoring.
5. Cek URL RTSP di VLC melalui menu **Media > Open Network Stream**.
```

## Cara Menjalankan Dengan Docker Compose

Docker Compose menjalankan backend dan frontend sekaligus.

```powershell
docker compose up --build
```

Service:

| Service | URL | Catatan |
| --- | --- | --- |
| Backend | `http://127.0.0.1:8000` | FastAPI |
| Frontend | `http://localhost:5173` | Vite dev server |

Frontend container memakai pnpm melalui `frontend/Dockerfile`.

## Cara Menjalankan Simulator Kamera

Simulator hanya digunakan untuk simulasi pengiriman frame, bukan untuk RTSP otomatis di web.

Buka terminal ketiga:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python simulate_camera.py
```

Detail simulator:

- Mengirim frame ke `ws://localhost:8000/ws/camera/cam_test`
- Tekan `q` atau `Esc` untuk menutup jendela simulator

## Urutan Menjalankan Aplikasi

1. Jalankan backend
2. Jalankan frontend
3. Jalankan simulator jika ingin simulasi kamera manual
4. Tambahkan kamera RTSP dari halaman Management jika ingin sumber kamera otomatis

## Akun Default

| Username | Password | Role | Fungsi |
| --- | --- | --- | --- |
| `admin` | `admin123` | Admin/Manager | Akses penuh, validasi manager, manajemen user, kamera, dan rule |
| `manager01` | `manager123` | Manager | Validasi laporan yang dikirim staff dan memantau seluruh data |
| `staff01` | `staff123` | Staff/Operator | Monitoring, review awal, dan mengirim laporan tertentu ke manager |

Catatan:

- Role utama yang dipakai di sistem adalah Manager/Admin dan Staff/Operator.
- Akun default dibuat otomatis saat backend startup melalui seed di `backend/auth.py`.
- Seed hanya menambahkan user jika username belum ada, sehingga user lama tidak ditimpa.
- Staff tidak langsung melakukan validasi final manager.
- Manager hanya menerima kasus yang memang dikirim atau perlu eskalasi.

## Alur Kerja Sistem

1. User login ke aplikasi.
2. Sistem menampilkan dashboard sesuai role user.
3. Kamera aktif mengirim frame melalui WebSocket atau RTSP.
4. Backend melakukan deteksi APD.
5. Jika ada pelanggaran, sistem menyimpan data pelanggaran dan bukti gambar.
6. Pelanggaran dengan confidence tinggi otomatis masuk status auto review.
7. Pelanggaran yang perlu dicek dapat direview staff.
8. Staff dapat mengirim kasus tertentu ke manager.
9. Manager melakukan validasi final: approve atau reject.
10. Semua data dapat dilihat di history, statistik, notifikasi, dan laporan.

## Daftar Fitur

### 1. Login dan Autentikasi

User dapat masuk ke sistem menggunakan username dan password.

Fungsi utama:

- Login dengan akun terdaftar
- Token JWT untuk akses endpoint backend
- Proteksi halaman frontend berdasarkan status login
- Logout dari aplikasi
- Handling error login, seperti password salah atau server tidak aktif

### 2. Role-Based Access

Sistem membedakan akses berdasarkan role.

Manager/Admin dapat:

- Melihat dashboard penuh
- Melihat monitoring kamera
- Melihat statistik dan riwayat
- Melakukan validasi final
- Mengelola kamera
- Mengelola rule APD
- Mengelola user
- Export laporan

Staff/Operator dapat:

- Melihat dashboard operasional
- Melihat monitoring kamera
- Melakukan review awal
- Mengirim laporan tertentu ke manager
- Melihat riwayat dan detail pelanggaran
- Melihat notifikasi sesuai kebutuhan operasional

### 3. Dashboard Monitoring

Dashboard menjadi halaman ringkasan utama.

Isi dashboard:

- Total pelanggaran hari ini
- Pending validasi
- Total pelanggaran global
- Ringkasan status pelanggaran
- Pelanggaran terbaru
- Item yang perlu perhatian
- Informasi cepat untuk membantu user mengambil tindakan

### 4. Statistik dan Analitik

Halaman Statistics berisi analisis pelanggaran secara lebih lengkap.

Fungsi utama:

- Tren pelanggaran
- Distribusi jenis pelanggaran
- Distribusi status validasi
- Top pelanggaran
- Area atau kamera paling rawan
- Jam rawan pelanggaran
- Heatmap atau analisis waktu
- Insight otomatis dari data yang tersedia

### 5. Deteksi Pelanggaran APD

Backend mendeteksi kepatuhan APD dari frame kamera.

Fungsi utama:

- Deteksi pekerja lengkap APD
- Deteksi pekerja tanpa APD
- Deteksi jenis pelanggaran
- Menyimpan confidence deteksi
- Mengelompokkan pelanggaran berulang agar tidak terlalu banyak data per frame

Sistem tidak langsung mencatat semua frame sebagai pelanggaran baru. Pelanggaran dikelompokkan berdasarkan kamera, jenis pelanggaran, dan rentang waktu tertentu agar data lebih rapi.

### 6. Auto Review Confidence Tinggi

Jika confidence deteksi tinggi, sistem dapat melakukan auto review.

Aturan saat ini:

- Confidence tinggi menggunakan threshold 90%
- Data langsung diberi status auto-reviewed oleh sistem
- Kasus confidence tinggi tidak perlu masuk antrean validasi manual
- Badge auto review tampil di frontend dan export laporan

Tujuannya agar manager tidak dibebani semua hasil deteksi, terutama untuk kasus yang sudah sangat jelas.

### 7. Monitoring Real-Time

Halaman Monitoring menampilkan kondisi kamera secara langsung.

Fungsi utama:

- Menampilkan daftar kamera aktif
- Menampilkan status stream kamera
- Menampilkan deteksi real-time
- Menampilkan hasil pelanggaran terbaru
- Menampilkan bukti visual jika tersedia
- Menampilkan status RTSP seperti idle, running, atau error
- Restart stream kamera jika koneksi RTSP bermasalah

### 8. RTSP Kamera Otomatis

Kamera RTSP dapat ditambahkan dari halaman Management.

Fungsi utama:

- Input nama kamera
- Input lokasi kamera
- Input URL RTSP
- Kamera aktif otomatis dijalankan oleh backend
- Status kamera tampil di Monitoring dan Management
- Stream dapat direstart dari frontend

Catatan:

- `simulate_camera.py` tetap hanya untuk simulasi.
- RTSP berjalan dari data kamera yang disimpan di database.
- Jika RTSP tidak tampil, cek URL RTSP, koneksi internet, status kamera, dan log backend.

### 9. Notifikasi Real-Time

Sistem menampilkan notifikasi saat ada pelanggaran atau perubahan penting.

Fungsi utama:

- Daftar notifikasi di halaman Notification
- Status sudah dibaca dan belum dibaca
- Penyimpanan status baca per user di frontend
- Popup khusus untuk deteksi baru yang relevan
- Popup tidak muncul untuk semua notifikasi lama

Untuk manager, popup difokuskan pada kasus baru yang memang perlu perhatian.

### 10. Validasi Pelanggaran

Halaman Validation digunakan untuk proses review dan validasi.

Alur validasi:

- Staff melakukan review awal untuk pelanggaran yang perlu dicek
- Staff dapat menyelesaikan kasus internal jika tidak perlu manager
- Staff dapat mengirim kasus tertentu ke manager
- Manager melakukan validasi final
- Manager dapat approve atau reject
- Catatan validasi dapat ditambahkan melalui modal

Sistem ini dibuat agar manager tidak harus memvalidasi semua deteksi satu per satu.

### 11. Riwayat Pelanggaran

Halaman History menampilkan data pelanggaran yang tersimpan.

Fungsi utama:

- Tabel riwayat pelanggaran
- Pagination dari backend
- Filter status, kamera, severity, dan tanggal
- Detail waktu pelanggaran
- Detail lokasi atau kamera
- Detail jenis pelanggaran dalam bentuk list
- Status validasi
- Evidence atau bukti gambar
- Informasi auto review jika ada

### 12. Detail Pelanggaran

Setiap pelanggaran memiliki informasi detail.

Informasi yang ditampilkan:

- Waktu kejadian
- Kamera atau lokasi
- Jenis pelanggaran
- Severity
- Status validasi
- Confidence
- Jumlah kemunculan jika pelanggaran tergabung
- Bukti gambar
- Catatan staff atau manager jika ada
- Informasi auto review jika diproses otomatis

### 13. Penyimpanan Data

Backend menyimpan data secara terstruktur di database SQLite.

Data yang disimpan:

- User
- Kamera
- Rule APD per kamera
- Data pelanggaran
- Status validasi
- Catatan review
- Informasi evidence
- Statistik dasar dari pelanggaran

### 14. Penyimpanan Bukti

Sistem menyimpan bukti pelanggaran berupa gambar.

Fungsi utama:

- Evidence tersimpan di folder backend
- Evidence dapat diakses frontend
- Evidence tampil di detail pelanggaran
- Evidence ikut membantu proses validasi

### 15. Export Laporan

Sistem dapat membuat laporan dalam format CSV dan PDF.

Fungsi utama:

- Export CSV
- Export PDF
- Filter periode harian
- Filter periode mingguan
- Filter periode bulanan
- Filter periode tahunan
- Filter custom range
- Filter kamera, status, dan severity
- Isi laporan menampilkan data pelanggaran secara rapi

### 16. Management Kamera

Halaman Management digunakan untuk mengelola kamera.

Fungsi utama:

- Tambah kamera
- Edit nama kamera
- Edit lokasi kamera
- Edit URL RTSP
- Aktifkan atau nonaktifkan kamera
- Hapus kamera
- Lihat status stream
- Restart stream

### 17. Management Rule APD

Rule digunakan untuk menentukan APD yang wajib pada kamera tertentu.

Fungsi utama:

- Tambah rule
- Edit rule
- Hapus rule
- Aktifkan atau nonaktifkan rule
- Atur rule berdasarkan kamera
- Menentukan kewajiban APD seperti helm, rompi, atau masker sesuai kebutuhan

### 18. Management User

Admin/Manager dapat mengelola user.

Fungsi utama:

- Tambah user
- Edit username
- Edit role
- Reset password
- Hapus user
- Role dibatasi agar sesuai kebutuhan sistem

Sistem saat ini difokuskan pada dua jenis pengguna utama: manager/admin dan staff/operator.

## Struktur Halaman Frontend

| Halaman | Fungsi |
| --- | --- |
| Dashboard | Ringkasan utama monitoring dan KPI |
| Monitoring | Tampilan kamera, deteksi, RTSP, dan status stream |
| Statistics | Analitik, tren, jam rawan, area rawan, dan insight |
| Validation | Review staff dan validasi final manager |
| History | Riwayat pelanggaran dan detail evidence |
| Notification | Daftar notifikasi dan status baca |
| Reports | Export laporan CSV/PDF |
| Management | Kelola user, kamera, dan rule |
| Not Found | Halaman error untuk route tidak tersedia |

## Ringkasan Endpoint Backend

### Auth dan User

- `POST /auth/login`
- `POST /auth/register`
- `POST /auth/change-password`
- `GET /auth/roles`
- `GET /users`
- `GET /users/me`
- `PUT /users/{id}`
- `PUT /users/{id}/role`
- `DELETE /users/{id}`

### Kamera dan Stream

- `GET /cameras`
- `POST /cameras`
- `PUT /cameras/{id}`
- `DELETE /cameras/{id}`
- `GET /cameras/streams/status`
- `POST /cameras/{id}/restart-stream`
- `WS /ws/camera/{camera_id}`
- `WS /ws/viewer/{camera_id}`

### Rule APD

- `GET /rules`
- `POST /rules`
- `PUT /rules/{id}`
- `DELETE /rules/{id}`
- `GET /rules/camera/{camera_id}`

### Deteksi

- `POST /detect/image`
- `POST /detect/base64`

### Pelanggaran

- `GET /violations`
- `GET /violations/{id}`
- `POST /violations/{id}/staff-review`
- `POST /violations/{id}/submit-report`
- `POST /violations/{id}/validate`
- `DELETE /violations/{id}`
- `DELETE /violations`

### Statistik dan Laporan

- `GET /violations/stats`
- `GET /violations/trend`
- `GET /stats/trend`
- `GET /stats/distribution`
- `GET /stats/heatmap`
- `GET /stats/cameras`
- `GET /stats/kpi`
- `GET /reports/export`
- `GET /violations/export/csv`
- `GET /violations/export/pdf`

## Troubleshooting

### ModuleNotFoundError: No module named fastapi

Artinya dependency backend belum terinstall atau virtual environment belum aktif.

Solusi:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

Jika menjalankan backend lewat pnpm, pastikan virtual environment backend sudah dibuat dan dependency Python sudah terinstall lebih dulu.

### pnpm dev gagal menjalankan backend

Kemungkinan penyebab:

- Virtual environment Python belum dibuat
- Dependency backend belum terinstall
- `uvicorn` belum tersedia di environment aktif

Solusi:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ..
pnpm dev:backend
```

### vite is not recognized

Artinya dependency frontend belum terinstall dengan pnpm.

Solusi:

```powershell
pnpm install
pnpm dev:frontend
```

### Failed to fetch dari frontend

Kemungkinan penyebab:

- Backend belum berjalan
- URL backend salah
- Backend error 500
- CORS tidak aktif karena backend gagal sebelum response dikirim
- Browser extension seperti download manager mengintersep request export

Langkah cek:

1. Buka `http://127.0.0.1:8000/status`
2. Cek terminal backend
3. Restart backend
4. Coba ulang dari frontend
5. Untuk export PDF, matikan sementara extension yang mengintersep download jika perlu

### RTSP tidak tampil

Kemungkinan penyebab:

- URL RTSP salah
- Stream RTSP butuh autentikasi
- Kamera atau server RTSP sedang offline
- Backend tidak bisa membaca stream
- Kamera belum aktif di halaman Management

Langkah cek:

1. Pastikan backend berjalan
2. Pastikan kamera aktif di Management
3. Cek status stream di Management atau Monitoring
4. Tekan Restart Stream
5. Cek log backend untuk pesan error

### Export PDF/CSV gagal

Langkah cek:

1. Pastikan sudah login
2. Pastikan backend berjalan
3. Cek filter tanggal
4. Coba export CSV terlebih dahulu
5. Jika PDF gagal di browser, cek apakah ada extension yang memblokir download

## Catatan Implementasi Penting

- Manager tidak menerima semua hasil deteksi secara otomatis untuk divalidasi.
- Staff dapat melakukan review awal dan hanya mengirim kasus tertentu ke manager.
- Confidence tinggi dapat auto review agar validasi tidak terlalu berat.
- History memakai pagination backend agar ringan.
- Statistics memakai endpoint agregasi agar hasil hitung tetap lengkap.
- Reports difokuskan untuk export, sedangkan analitik utama ada di Statistics.
- RTSP kamera berjalan otomatis dari data kamera aktif, bukan dari simulator.
- Semua delete dan aksi penting memakai modal konfirmasi custom.

# K3 Monitoring

K3 Monitoring adalah sistem monitoring pelanggaran keselamatan kerja berbasis web. Sistem ini menghubungkan backend FastAPI dengan frontend React untuk mendeteksi pelanggaran APD, menampilkan monitoring real-time, menyimpan bukti pelanggaran, mengelola validasi, dan menghasilkan laporan.

Dokumentasi ini menjelaskan cara menjalankan aplikasi, role user, alur kerja, dan fitur yang tersedia.

## Teknologi

- Backend: FastAPI, SQLite, WebSocket, OpenCV
- Frontend: React, Vite, Tailwind CSS
- Database lokal: SQLite
- Komunikasi real-time: WebSocket
- Export laporan: CSV dan PDF

## Prasyarat

- Python 3.11 atau lebih baru
- Node.js 18 atau lebih baru
- npm
- Webcam atau sumber RTSP jika ingin mencoba monitoring kamera

## Cara Menjalankan Backend

Buka terminal pertama:

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

## Cara Menjalankan Frontend

Buka terminal kedua:

```powershell
cd frontend
npm install
npm run dev
```

Frontend biasanya berjalan di:

```text
http://localhost:5173
```

Frontend sudah diarahkan ke backend:

```text
http://127.0.0.1:8000
```

## Cara Menjalankan Simulator Kamera

Simulator hanya digunakan untuk simulasi pengiriman frame, bukan untuk RTSP otomatis di web.

Buka terminal ketiga:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python simulate_camera.py
```

### Perintah Run Dummy Video

python simulate_camera.py --source sample-k3.mp4 --loop

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
- `DELETE /violations/clear`

### Statistik dan Laporan

- `GET /violations/stats`
- `GET /violations/trend`
- `GET /stats/trend`
- `GET /stats/distribution`
- `GET /stats/heatmap`
- `GET /stats/cameras`
- `GET /stats/kpi`
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


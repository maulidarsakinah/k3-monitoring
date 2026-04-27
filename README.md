# K3 Monitoring - Local Setup

## Prerequisites
- Python 3.11+ (recommended)
- Node.js 18+ and npm
- Webcam (for `simulate_camera.py`)

## 1. Run Backend (FastAPI)
Open terminal 1:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

Backend venv activation (every new terminal):

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation, run once:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Backend runs at:
- `http://127.0.0.1:8000`

Quick check:
- Open `http://127.0.0.1:8000/status`

## 2. Run Frontend (Vite + React)
Open terminal 2:

```powershell
cd frontend
npm install
npm run dev
```

Frontend usually runs at:
- `http://localhost:5173`

Note:
- Frontend is already configured to call backend at `http://127.0.0.1:8000`.

## 3. Run Camera Simulator (`simulate_camera.py`)
Keep backend running, then open terminal 3:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python simulate_camera.py
```

Simulator details:
- Sends frames to `ws://localhost:8000/ws/camera/cam_test`
- Press `q` or `Esc` to close simulator window

## Recommended Start Order
1. Start backend
2. Start frontend
3. Start `simulate_camera.py`

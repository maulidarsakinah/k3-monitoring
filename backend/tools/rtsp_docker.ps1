param(
    [string]$Video1 = "sample_video\sample-k3.mp4",
    [string]$Video2 = "sample_video\sample-k3-cctv.mp4",

    [string]$Name1 = "sample_k3",
    [string]$Name2 = "sample_cctv",

    [int]$Port = 8554
)

$ErrorActionPreference = "Stop"

$ContainerName = "k3-mediamtx"
$ToolDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Resolve-ToolPath {
    param([string]$Path)

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return $Path
    }

    return Join-Path $ToolDir $Path
}

function Start-FfmpegTerminal {
    param([string]$Command)

    $EncodedCommand = [Convert]::ToBase64String(
        [System.Text.Encoding]::Unicode.GetBytes($Command)
    )

    Start-Process powershell.exe -ArgumentList "-NoExit", "-EncodedCommand", $EncodedCommand
}

Write-Host ""
Write-Host "=== K3 RTSP Docker Mode ===" -ForegroundColor Cyan
Write-Host "Mode: Docker MediaMTX, multi-stream dalam 1 port"
Write-Host ""

try {
    docker version | Out-Null
} catch {
    Write-Host "ERROR: Docker belum berjalan atau belum terinstall." -ForegroundColor Red
    Write-Host "Pastikan Docker Desktop sudah Running." -ForegroundColor Yellow
    exit 1
}

try {
    ffmpeg -version | Out-Null
} catch {
    Write-Host "ERROR: FFmpeg belum terinstall atau belum masuk PATH." -ForegroundColor Red
    Write-Host "Install FFmpeg dulu:" -ForegroundColor Yellow
    Write-Host "winget install --id Gyan.FFmpeg -e"
    exit 1
}

$Video1Path = Resolve-ToolPath $Video1
$Video2Path = Resolve-ToolPath $Video2

if (!(Test-Path $Video1Path)) {
    Write-Host "ERROR: Video 1 tidak ditemukan: $Video1" -ForegroundColor Red
    exit 1
}

if (!(Test-Path $Video2Path)) {
    Write-Host "ERROR: Video 2 tidak ditemukan: $Video2" -ForegroundColor Red
    exit 1
}

$Video1Full = (Resolve-Path $Video1Path).Path
$Video2Full = (Resolve-Path $Video2Path).Path

$RtspUrl1 = "rtsp://127.0.0.1:$Port/$Name1"
$RtspUrl2 = "rtsp://127.0.0.1:$Port/$Name2"

Write-Host "[1/3] Menyiapkan MediaMTX RTSP server..." -ForegroundColor Yellow

$Existing = docker ps -a --filter "name=$ContainerName" --format "{{.Names}}"

if ($Existing -eq $ContainerName) {
    $Running = docker ps --filter "name=$ContainerName" --filter "status=running" --format "{{.Names}}"

    if ($Running -ne $ContainerName) {
        docker start $ContainerName | Out-Null
    }
} else {
    docker run -d --name $ContainerName -p "$Port`:8554" bluenviron/mediamtx | Out-Null
}

Start-Sleep -Seconds 2

Write-Host "[2/3] RTSP URL siap:" -ForegroundColor Green
Write-Host "  Kamera 1 : $Name1"
Write-Host "  RTSP URL : $RtspUrl1"
Write-Host ""
Write-Host "  Kamera 2 : $Name2"
Write-Host "  RTSP URL : $RtspUrl2"
Write-Host ""

Write-Host "[3/3] Membuka 2 terminal FFmpeg publisher..." -ForegroundColor Yellow
Write-Host "Jangan tutup terminal FFmpeg selama demo berjalan."
Write-Host ""

$Command1 = "ffmpeg -re -stream_loop -1 -i `"$Video1Full`" -an -c:v libx264 -preset veryfast -tune zerolatency -pix_fmt yuv420p -f rtsp `"$RtspUrl1`""

$Command2 = "ffmpeg -re -stream_loop -1 -i `"$Video2Full`" -an -c:v libx264 -preset veryfast -tune zerolatency -pix_fmt yuv420p -f rtsp `"$RtspUrl2`""

Start-FfmpegTerminal $Command1
Start-Sleep -Seconds 1
Start-FfmpegTerminal $Command2

Write-Host "Selesai." -ForegroundColor Green
Write-Host ""
Write-Host "Masukkan URL ini di Management Kamera:"
Write-Host "1. $RtspUrl1"
Write-Host "2. $RtspUrl2"
Write-Host ""

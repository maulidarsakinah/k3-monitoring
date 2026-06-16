param(
    [string]$Video1 = "sample_video\sample-k3.mp4",
    [string]$Video2 = "sample_video\sample-k3-cctv.mp4",

    [string]$Name1 = "sample_k3",
    [string]$Name2 = "sample_cctv",

    [int]$Port = 8554
)

$ErrorActionPreference = "Stop"

$ToolDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$MediaMtxExe = Join-Path $ToolDir "mediamtx\mediamtx.exe"
$MediaMtxConfig = Join-Path $ToolDir "mediamtx\mediamtx.yml"

function Resolve-ToolPath {
    param([string]$Path)

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return $Path
    }

    return Join-Path $ToolDir $Path
}

function Start-Terminal {
    param(
        [string]$Title,
        [string]$Command
    )

    $SafeTitle = $Title.Replace("'", "''")
    $FullCommand = "`$Host.UI.RawUI.WindowTitle = '$SafeTitle'; $Command"

    $Encoded = [Convert]::ToBase64String(
        [System.Text.Encoding]::Unicode.GetBytes($FullCommand)
    )

    Start-Process powershell.exe -ArgumentList "-NoExit", "-EncodedCommand", $Encoded
}

Write-Host ""
Write-Host "=== K3 RTSP CLEAN START ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1] Mematikan proses RTSP lama..." -ForegroundColor Yellow

Get-Process ffmpeg -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process ffplay -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process mediamtx -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 2

Write-Host "[2] Cek FFmpeg..." -ForegroundColor Yellow
$Ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($null -eq $Ffmpeg) {
    Write-Host "ERROR: ffmpeg belum kebaca PATH." -ForegroundColor Red
    exit 1
}
Write-Host "FFmpeg: $($Ffmpeg.Source)" -ForegroundColor Green

Write-Host "[3] Cek MediaMTX..." -ForegroundColor Yellow
if (!(Test-Path $MediaMtxExe)) {
    Write-Host "ERROR: mediamtx.exe tidak ditemukan:" -ForegroundColor Red
    Write-Host $MediaMtxExe
    exit 1
}
Write-Host "MediaMTX: $MediaMtxExe" -ForegroundColor Green

Write-Host "[4] Membuat config MediaMTX..." -ForegroundColor Yellow

$ConfigText = @"
logLevel: info
rtsp: yes
rtspAddress: :$Port

paths:
  all:
    source: publisher
"@

[System.IO.File]::WriteAllText(
    $MediaMtxConfig,
    $ConfigText,
    [System.Text.UTF8Encoding]::new($false)
)

$Video1Path = Resolve-ToolPath $Video1
$Video2Path = Resolve-ToolPath $Video2

if (!(Test-Path $Video1Path)) {
    Write-Host "ERROR: Video 1 tidak ditemukan:" -ForegroundColor Red
    Write-Host $Video1Path
    exit 1
}

if (!(Test-Path $Video2Path)) {
    Write-Host "ERROR: Video 2 tidak ditemukan:" -ForegroundColor Red
    Write-Host $Video2Path
    exit 1
}

$Video1Full = (Resolve-Path $Video1Path).Path
$Video2Full = (Resolve-Path $Video2Path).Path

$RtspUrl1 = "rtsp://127.0.0.1:$Port/$Name1"
$RtspUrl2 = "rtsp://127.0.0.1:$Port/$Name2"

Write-Host ""
Write-Host "RTSP URL:" -ForegroundColor Green
Write-Host "1. $RtspUrl1"
Write-Host "2. $RtspUrl2"
Write-Host ""

Write-Host "[5] Menjalankan MediaMTX..." -ForegroundColor Yellow
Start-Terminal "K3 MediaMTX" "& `"$MediaMtxExe`" `"$MediaMtxConfig`""

Start-Sleep -Seconds 4

Write-Host "[6] Menjalankan FFmpeg publisher..." -ForegroundColor Yellow

$Command1 = "ffmpeg -re -stream_loop -1 -i `"$Video1Full`" -an -c:v copy -f rtsp -rtsp_transport tcp `"$RtspUrl1`""
$Command2 = "ffmpeg -re -stream_loop -1 -i `"$Video2Full`" -an -c:v copy -f rtsp -rtsp_transport tcp `"$RtspUrl2`""

Start-Terminal "K3 FFmpeg sample_k3" $Command1
Start-Sleep -Seconds 1
Start-Terminal "K3 FFmpeg sample_cctv" $Command2

Write-Host ""
Write-Host "Selesai. Jangan tutup terminal MediaMTX dan FFmpeg." -ForegroundColor Green
Write-Host ""
Write-Host "Masukkan ke Management Kamera:"
Write-Host "1. $RtspUrl1"
Write-Host "2. $RtspUrl2"
Write-Host ""
Write-Host "Tes:"
Write-Host "ffplay -rtsp_transport tcp `"$RtspUrl1`""
Write-Host "ffplay -rtsp_transport tcp `"$RtspUrl2`""
Write-Host ""
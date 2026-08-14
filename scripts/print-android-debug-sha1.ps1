# Prints SHA-1 for the default Android debug keystore. Add this fingerprint in
# Google Cloud Console → APIs & Services → Credentials → your Android OAuth client
# for package com.cruxe.app (Debug and/or Release keystore as appropriate).
#
# If you see "running scripts is disabled", either:
#   powershell -ExecutionPolicy Bypass -File ".\print-android-debug-sha1.ps1"
# or use print-android-debug-sha1.cmd instead (no policy change).

$ErrorActionPreference = "Stop"
$debugKeystore = Join-Path $env:USERPROFILE ".android\debug.keystore"
if (-not (Test-Path $debugKeystore)) {
  Write-Host "Debug keystore not found at: $debugKeystore"
  Write-Host "Build the app once with Android Studio / gradle, or create the default keystore."
  exit 1
}

& keytool -list -v -keystore $debugKeystore -alias androiddebugkey -storepass android -keypass android `
  | Select-String "SHA1:"

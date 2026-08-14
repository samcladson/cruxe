@echo off
setlocal
REM SHA-1 for the default Android debug keystore. Paste into Google Cloud:
REM Android OAuth client, package com.cruxe.app
REM (No PowerShell execution policy required — use this if .ps1 is blocked.)

set "KS=%USERPROFILE%\.android\debug.keystore"
if not exist "%KS%" (
  echo Debug keystore not found: %KS%
  echo Build the app once, or use Android Studio to generate the keystore.
  exit /b 1
)

where keytool >nul 2>&1
if errorlevel 1 (
  echo keytool not in PATH. Install a JDK and add e.g. ^%%JAVA_HOME^%%\bin to PATH.
  exit /b 1
)

keytool -list -v -keystore "%KS%" -alias androiddebugkey -storepass android -keypass android | findstr /i "SHA1"

@echo off
setlocal enabledelayedexpansion
REM Prints the SHA-1 of the key that signs local debug builds.
REM Paste it into Google Cloud Console as an Android OAuth client:
REM   Application type: Android
REM   Package name:     com.cruxe.app
REM
REM Without a matching Android client, Google Sign-In fails with
REM DEVELOPER_ERROR - and the message says nothing about why.
REM
REM NOTE: `expo prebuild` generates android\app\debug.keystore, and that is
REM what signs `expo run:android` builds - NOT the global ~\.android one.
REM We check the project keystore first for that reason.

set "KS="
if exist "%~dp0..\android\app\debug.keystore" (
  set "KS=%~dp0..\android\app\debug.keystore"
  echo Using project keystore: android\app\debug.keystore
) else if exist "%USERPROFILE%\.android\debug.keystore" (
  set "KS=%USERPROFILE%\.android\debug.keystore"
  echo Using global keystore: %%USERPROFILE%%\.android\debug.keystore
)

if "%KS%"=="" (
  echo No debug keystore found.
  echo Run `npx expo prebuild --platform android` first, which generates one.
  exit /b 1
)

set "KT=keytool"
where keytool >nul 2>&1
if errorlevel 1 (
  if exist "%JAVA_HOME%\bin\keytool.exe" (
    set "KT=%JAVA_HOME%\bin\keytool.exe"
  ) else (
    echo keytool not found on PATH and JAVA_HOME is not set.
    echo Android Studio ships one at:
    echo   C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe
    exit /b 1
  )
)

"%KT%" -list -v -keystore "%KS%" -alias androiddebugkey -storepass android -keypass android | findstr /i "SHA1"

echo.
echo Register this SHA-1 in Google Cloud Console for package com.cruxe.app.
echo Release builds are signed with a DIFFERENT key - run `eas credentials`
echo to get that SHA-1 and register it too, or sign-in will fail in production.

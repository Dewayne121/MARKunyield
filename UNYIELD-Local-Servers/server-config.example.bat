@echo off
REM Copy this file to server-config.bat and update paths for your machine.

REM Root folder of the UNYIELD app repo (the folder that contains unyieldserver and faceblurapi)
set "UNYIELD_ROOT=C:\path\to\unyield"

REM Optional: PostgreSQL bin path if psql is not on PATH
REM set "PG_BIN=C:\Program Files\PostgreSQL\17\bin"
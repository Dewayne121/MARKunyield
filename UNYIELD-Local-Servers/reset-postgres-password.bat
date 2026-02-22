@echo off
title Reset PostgreSQL Password
echo ============================================
echo   PostgreSQL Password Reset
echo ============================================
echo.
echo This script will:
echo   1. Temporarily allow password-less login
echo   2. Reset the postgres password to 'postgres'
echo   3. Restore security settings
echo.
echo You must run this as Administrator!
echo.
pause

:: Check for admin rights
net session >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Please right-click and "Run as administrator"
    pause
    exit /b 1
)

set PGDATA=C:\Program Files\PostgreSQL\17\data
set PGBIN=C:\Program Files\PostgreSQL\17\bin

echo.
echo [Step 1] Backing up pg_hba.conf...
copy "%PGDATA%\pg_hba.conf" "%PGDATA%\pg_hba.conf.backup" >nul

echo [Step 2] Modifying authentication to trust...
(
echo # Trust all local connections temporarily
echo local   all             all                                     trust
echo host    all             all             127.0.0.1/32            trust
echo host    all             all             ::1/128                 trust
echo local   replication     all                                     trust
echo host    replication     all             127.0.0.1/32            trust
echo host    replication     all             ::1/128                 trust
) > "%PGDATA%\pg_hba.conf"

echo [Step 3] Restarting PostgreSQL service...
net stop postgresql-x64-17
net start postgresql-x64-17

echo [Step 4] Setting postgres password to 'postgres'...
"%PGBIN%\psql" -U postgres -c "ALTER USER postgres PASSWORD 'postgres';"

echo [Step 5] Restoring original pg_hba.conf with new password...
(
echo # PostgreSQL Client Authentication Configuration
echo local   all             all                                     scram-sha-256
echo host    all             all             127.0.0.1/32            scram-sha-256
echo host    all             all             ::1/128                 scram-sha-256
echo local   replication     all                                     scram-sha-256
echo host    replication     all             127.0.0.1/32            scram-sha-256
echo host    replication     all             ::1/128                 scram-sha-256
) > "%PGDATA%\pg_hba.conf"

echo [Step 6] Restarting PostgreSQL service...
net stop postgresql-x64-17
net start postgresql-x64-17

echo.
echo ============================================
echo   Password has been reset to: postgres
echo ============================================
echo.
echo You can now connect with:
echo   psql -U postgres -h localhost
echo   Password: postgres
echo.
pause

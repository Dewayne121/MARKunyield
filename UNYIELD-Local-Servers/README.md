# UNYIELD Local Servers

Use this folder to run UNYIELD backend services on any Windows laptop.

## What This Starts

- `unyieldserver` (Node.js API) on `http://localhost:3000`
- `faceblurapi` (Python API) on `http://localhost:8000`

## 1. Prerequisites

- Node.js 20+
- Python 3.10+
- PostgreSQL running locally (if you want local DB)

## 2. Configure Path Once

1. Copy `server-config.example.bat` to `server-config.bat`
2. Edit `server-config.bat` and set:

```bat
set "UNYIELD_ROOT=C:\path\to\unyield"
```

`UNYIELD_ROOT` must point to the repo folder that contains `unyieldserver` and `faceblurapi`.

## 3. Configure Environment Files in UNYIELD Repo

In `%UNYIELD_ROOT%\unyieldserver\.env`, set at minimum:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/unyielding?schema=public"
JWT_SECRET=your-long-secret
ENFORCE_HTTPS=false
FACE_BLUR_API_URL=http://localhost:8000
```

In `%UNYIELD_ROOT%\faceblurapi\.env`, set at minimum:

```env
ORACLE_SECRET=...
```

## 4. Start Servers

- Double-click `start-all.bat`
- Or run each separately:
  - `start-unyieldserver.bat`
  - `start-faceblurapi.bat`

## Optional: Data Sync

- `clone-database.bat` now runs MongoDB -> Postgres migration via:
  - `%UNYIELD_ROOT%\unyieldserver\scripts\migrate-to-postgres.js`
- Ensure `MONGODB_URI` and `DATABASE_URL` are set in `unyieldserver/.env` first.

## Optional: PostgreSQL Password Reset

- `reset-postgres-password.bat` resets local postgres user to password `postgres`
- Run it as Administrator.

## Troubleshooting

- `UNYIELD_ROOT is not set`: create `server-config.bat` from the example.
- `npm not found`: install Node.js and reopen terminal.
- `python not found`: install Python and reopen terminal.
- API unreachable from app on phone: set app API URL to your PC LAN IP, not `localhost`.
# Moneto

**Moneto** is a self-hosted web app for managing personal finances, in the style of [Monefy](https://monefy.me/), designed primarily for smartphone use but fully usable on desktop as well.

It lets you track income and expenses across multiple accounts (cash, bank account, meal vouchers, etc.), organize them by category, set up automatic recurring transactions, and view reports and statistics about your financial trends — all hosted on your own server, without sending your data to third-party services.

---

## Table of contents

- [What it does](#what-it-does)
- [How it works](#how-it-works)
  - [Architecture](#architecture)
  - [Tech stack](#tech-stack)
  - [Project structure](#project-structure)
- [How to run it](#how-to-run-it)
  - [Requirements](#requirements)
  - [Running locally (development)](#running-locally-development)
  - [Configuration (.env)](#configuration-env)
  - [Useful commands](#useful-commands)
  - [Production deployment](#production-deployment)
- [Backup](#backup)
- [License](#license)

---

## What it does

With Moneto you can:

- 💳 **Manage multiple accounts** (cash, cards, bank accounts, meal vouchers...), each with its own opening balance, currency, icon and color.
- 🧾 **Record income and expenses** in a few seconds, categorizing them (groceries, transport, salary, etc.).
- 🔁 **Automate recurring transactions** (e.g. rent, subscriptions, salary): Moneto generates them on its own every day, taking public holidays into account too.
- 📊 **View reports and statistics**: balance trends, spending by category, comparisons between periods.
- 📥 **Import transactions from CSV**, to quickly populate your history from another tool (e.g. Firefly III).
- 🔐 **Protect access** with email/password login, email verification, password reset, and two-factor authentication (TOTP, compatible with Google Authenticator/Authy).
- 📱 **Use it like an app**: the frontend is an installable PWA, with an interface optimized for touch.

It's a project that is **single-user oriented but multi-user capable**: each user only sees and manages their own data.

## How it works

### Architecture

Moneto is made up of three main services, orchestrated with Docker Compose:

```
┌─────────────┐      HTTP/JSON       ┌─────────────┐       SQL       ┌──────────────┐
│  Frontend   │ ───────────────────▶ │   Backend   │ ───────────────▶│  PostgreSQL  │
│ React + PWA │ ◀─────────────────── │   FastAPI   │ ◀────────────────│              │
└─────────────┘                      └─────────────┘                  └──────────────┘
                                             │
                                             ▼
                                   Scheduler (APScheduler)
                                   automatically generates
                                   due recurring transactions
                                   every night
```

In production, an **nginx** container acts as a reverse proxy in front of the frontend and backend, behind which you can place Cloudflare or another external proxy.

### Tech stack

| Layer | Technologies |
|---|---|
| **Backend** | Python, [FastAPI](https://fastapi.tiangolo.com/), SQLAlchemy (async), Alembic (migrations), PostgreSQL, JWT, TOTP (`pyotp`), APScheduler |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, React Query, Zustand, React Router, Recharts, PWA |
| **Infrastructure** | Docker & Docker Compose, Nginx (production) |

### Project structure

```
moneto/
├── backend/                # FastAPI API
│   ├── app/
│   │   ├── api/v1/          # REST endpoints (auth, mfa, accounts, categories,
│   │   │                    # transactions, recurring, stats, csv_import)
│   │   ├── models/          # SQLAlchemy models (users, accounts, categories,
│   │   │                    # transactions, recurring transactions...)
│   │   ├── services/        # business logic (balance, recurrences,
│   │   │                    # CSV import, email, TOTP, holidays)
│   │   ├── core/             # configuration and security
│   │   └── main.py           # app entrypoint + scheduler
│   └── migrations/            # Alembic migrations
├── frontend/                # React SPA
│   └── src/
│       ├── pages/             # Dashboard, Transactions, Accounts, Categories,
│       │                      # Recurring, Report, Login, Register...
│       ├── components/        # reusable UI components
│       ├── api/               # HTTP client for the backend
│       └── store/             # global state (Zustand)
├── nginx/                   # reverse proxy configuration (production)
├── scripts/                 # backup, deploy, release, data migration
├── docker-compose.yml        # development environment
└── docker-compose.prod.yml    # production environment
```

## How to run it

### Requirements

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/)
- Nothing else: backend, frontend and database all run in containers.

### Running locally (development)

1. **Clone the repository** and move into the project folder.

2. **Create the configuration file** by copying the provided example:

   ```bash
   cp .env.example .env
   ```

   The default values already work fine for a first local run (see the [Configuration](#configuration-env) section to customize them).

3. **Start all the services**:

   ```bash
   docker compose up
   ```

   On the first run, Docker will build the images, automatically apply the database migrations (Alembic), and start backend and frontend in "hot reload" mode (every code change is reflected immediately, without needing a restart).

4. **Open the app**:

   - Frontend (user interface): [http://localhost:5173](http://localhost:5173)
   - Backend API: [http://localhost:8000](http://localhost:8000)
   - Interactive API docs (Swagger): [http://localhost:8000/api/docs](http://localhost:8000/api/docs)

5. **Register a user** from the frontend's registration page and start using the app.

To stop the services: `Ctrl+C`, or `docker compose down` from another terminal.

### Configuration (.env)

The `.env` file contains all the environment variables used by the containers. The main ones:

| Variable | What it's for |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | PostgreSQL database credentials |
| `SECRET_KEY` | Secret key used to sign access tokens (generate it with `openssl rand -hex 32`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime (default 30 minutes; ×48 if the user selects "Remember me") |
| `REFRESH_TOKEN_EXPIRE_DAYS` / `REMEMBER_ME_EXPIRE_DAYS` | Refresh token lifetime, with and without "Remember me" |
| `CORS_ORIGINS` | Origins allowed to call the API |
| `VITE_API_URL` | Backend URL used by the frontend |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_TLS` | Email configuration (account verification, password reset). If `SMTP_HOST` is empty, in development emails are simply printed to the logs instead of being sent |
| `FRONTEND_URL` | Public frontend URL, used in links sent via email |

> ⚠️ **Never commit the `.env` file with real credentials.** It is already excluded via `.gitignore`.

### Useful commands

```bash
# View logs in real time
docker compose logs -f

# View logs for a single service
docker compose logs -f backend

# Rebuild images after changing dependencies
docker compose up --build

# Run a command inside the backend container (e.g. a new migration)
docker compose exec backend alembic revision --autogenerate -m "description"
docker compose exec backend alembic upgrade head

# Stop everything and remove containers (database data is kept in the volume)
docker compose down
```

### Production deployment

For a production environment (e.g. on a VPS) there's a dedicated file:

1. Copy and fill in `.env.prod` starting from `.env.prod.example`, with real, secure credentials.
2. Start the production stack:

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
   ```

   This setup also includes an **nginx** container as a reverse proxy (listening on `127.0.0.1:6080`), meant to sit behind an external proxy (e.g. Cloudflare Tunnel) or an existing nginx/Caddy already on the server.

3. For subsequent updates, a guided script is available:

   ```bash
   ./scripts/deploy.sh
   ```

## Backup

A script for backing up the PostgreSQL database is included:

```bash
./scripts/backup.sh
```

Backups are saved in the `backups/` folder.

## License

Project intended for personal/self-hosted use. Check the repository for a license file before redistributing or reusing the code.

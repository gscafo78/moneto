# Budget App — Roadmap di sviluppo

Questa roadmap guida lo sviluppo di una web app di gestione spese personali stile Monefy,
self-hosted su VPS, ottimizzata per smartphone, con supporto desktop.

**Stack**: FastAPI + PostgreSQL (backend) · React 18 + Vite + Tailwind CSS (frontend)  
**Infra**: Docker Compose (dev e prod) · Cloudflare come reverse proxy esterno  
**Dev workflow**: `docker compose up` sulla VPS, accesso via SSH port forwarding

---

## Come usare questa roadmap con Claude in VS Code

Ogni milestone è un task autonomo. Per iniziare una milestone, incolla in chat:
> "Lavora sulla **Milestone X** della ROADMAP.md. Leggi i file esistenti prima di scrivere codice."

Claude leggerà il codice esistente e implementerà solo ciò che manca.

---

## Milestone 1 — Backend: autenticazione e modelli DB ✅

**Obiettivo**: API funzionante con auth JWT, modelli DB e migrazioni Alembic.

**Completato**:
- ✅ `backend/alembic.ini` + `migrations/env.py` + `migrations/script.py.mako`
- ✅ `migrations/versions/001_initial.py` — schema iniziale (users, accounts, categories, transactions)
- ✅ `app/core/security.py` — `create_access_token`, `create_refresh_token`, `create_mfa_session_token`, `decode_token`, `verify_access_token`, `get_current_user`
- ✅ `app/core/config.py` — `ACCESS_TOKEN_EXPIRE_MINUTES=30`, `REFRESH_TOKEN_EXPIRE_DAYS=7`, `REMEMBER_ME_EXPIRE_DAYS=30`
- ✅ `app/api/v1/endpoints/auth.py` — register, login (JSON body), refresh, me
- ✅ `docker compose up` → `alembic upgrade head` → uvicorn
- ✅ `bcrypt==3.2.2` + `pydantic[email]` + `psycopg2-binary` in requirements

**Criteri verificati**:
- ✅ `POST /api/v1/auth/register` → `{access_token, refresh_token}`
- ✅ `POST /api/v1/auth/login` (JSON `{email, password, remember_me}`) → `{access_token, refresh_token}`
- ✅ `POST /api/v1/auth/refresh` → ruota entrambi i token, propaga `rem`
- ✅ `GET /api/v1/auth/me` (token richiesto)
- ✅ Tabelle create automaticamente allo startup via Alembic
- ✅ `GET /health` → `{"status": "ok"}`

**Durate token verificate**:
| Scenario | Access token | Refresh token |
|---|---|---|
| Senza "Ricordami" | 30 min | 7 giorni (`rem=false`) |
| Con "Ricordami" | 24 h (30×48) | 30 giorni (`rem=true`) |
| Refresh successivo | eredita da `rem` | eredita da `rem` |

---

## Milestone 1.5 — MFA opzionale (TOTP — Google Authenticator / Authy)

**Obiettivo**: aggiungere autenticazione a due fattori opzionale con TOTP, seguendo lo stesso pattern di Nextfolio. L'utente attiva il 2FA dalle impostazioni; il login rimane email+password se il 2FA non è attivo.

### Flusso login con MFA attivo
```
POST /auth/login  { email, password, remember_me: bool }
  → se MFA disattivo:  { access_token, refresh_token }
  → se MFA attivo:     { requires_mfa: true, session_token: "<JWT 5min>" }

POST /auth/mfa/verify  { session_token, code, remember_me: bool }
  → { access_token, refresh_token }

POST /auth/refresh  { refresh_token }
  → { access_token, refresh_token }   ← flag rem propagato automaticamente
```

**Durate token** (configurabili via env):
| Scenario | Access token | Refresh token |
|---|---|---|
| Senza "Ricordami" | 30 min | 7 giorni |
| Con "Ricordami" | 24 h (30 min × 48) | 30 giorni (`REMEMBER_ME_EXPIRE_DAYS`) |

### 1.5.1 Backend

**Migration `002_mfa`** — aggiunge colonne alla tabella `users`:
```sql
ALTER TABLE users ADD COLUMN totp_secret VARCHAR(64);
ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT false;
```

**File da creare**:
- `backend/migrations/versions/002_mfa.py` — migration ALTER TABLE
- `backend/app/services/totp.py` — wrapper `pyotp`:
  ```python
  def generate_secret() -> str          # pyotp.random_base32()
  def get_provisioning_uri(secret, email, issuer="Moneto") -> str
  def verify_code(secret, code) -> bool  # valid_window=1 (±30s)
  ```
- `backend/app/api/v1/endpoints/mfa.py` — router `/auth/mfa/*`

**Modello `User`** — aggiungere campi:
```python
totp_secret  = Column(String(64), nullable=True)
totp_enabled = Column(Boolean, default=False, nullable=False)
```

**`security.py`** — già implementato in M1 con remember_me:
```python
create_access_token(user_id, remember_me)  # 30min / 24h
create_refresh_token(user_id, remember_me) # 7gg / 30gg, rem nel payload
create_mfa_session_token(user_id)           # 5 min, type=mfa_session
decode_token(token) -> dict
```

**`auth.py` — login già aggiornato**:
```python
if user.totp_enabled:
    return TokenResponse(requires_mfa=True,
                         session_token=create_mfa_session_token(str(user.id)))
return _tokens(user, remember_me=data.remember_me)
```

**Nuovi endpoint**:
```
POST /api/v1/auth/mfa/verify
     body: { session_token, code }
     → decodifica session_token (type=mfa_session), verifica TOTP, restituisce access_token

POST /api/v1/auth/mfa/setup       [autenticato]
     → genera totp_secret, lo salva su DB (totp_enabled rimane false), restituisce { secret, uri }

POST /api/v1/auth/mfa/enable      [autenticato]
     body: { session_token, code }  ← session_token generato da /mfa/setup
     → verifica TOTP, imposta totp_enabled=True

POST /api/v1/auth/mfa/disable     [autenticato]
     body: { session_token, code }
     → verifica TOTP, imposta totp_enabled=False, totp_secret=None
```

**`requirements.txt`** — aggiungere:
```
pyotp==2.9.0
```

**Criteri di completamento backend**:
- Login senza MFA → `{ access_token }` (invariato)
- Login con MFA → `{ requires_mfa: true, session_token }` (JWT 5min)
- `POST /mfa/verify` con session_token valido + codice corretto → `{ access_token }`
- `POST /mfa/verify` con codice sbagliato → 401
- `POST /mfa/setup` → secret + URI (QR)
- `POST /mfa/enable` attiva 2FA sull'account
- `POST /mfa/disable` disattiva 2FA sull'account

### 1.5.2 Frontend (da implementare in Milestone 3)

**Login a 2 step** — `pages/Login.tsx`:
```
Step 1: form email + password → POST /auth/login
  se requires_mfa=true → step 2 (salva session_token in stato locale)
Step 2: input codice 6 cifre → POST /auth/mfa/verify
  successo → salva access_token → redirect home
```

**Sezione MFA in Impostazioni** — `pages/Settings.tsx`:
- Se MFA disattivo: bottone "Attiva 2FA"
  1. `POST /mfa/setup` → riceve URI
  2. Mostrare QR code (`react-qr-code`)
  3. Campo codice + bottone "Verifica e attiva" → `POST /mfa/enable`
- Se MFA attivo: badge "2FA attivo ✓" + bottone "Disattiva"
  1. Campo codice + bottone "Disattiva" → `POST /mfa/disable`

**Dipendenze frontend**:
```
react-qr-code   ← per mostrare il QR di provisioning
```

---

## Milestone 2 — Backend: endpoint CRUD completi

**Obiettivo**: tutti gli endpoint REST per accounts, categories, transactions e stats.

**File da completare**:
- `backend/app/api/v1/endpoints/accounts.py` — CRUD completo
- `backend/app/api/v1/endpoints/categories.py` — CRUD + seed categorie default al primo accesso
- `backend/app/api/v1/endpoints/transactions.py` — CRUD + filtro per anno/mese + aggiornamento saldo conto
- `backend/app/api/v1/endpoints/stats.py` — endpoint statistiche mensili

**Endpoint da implementare**:

```
Accounts:
  GET    /api/v1/accounts/          — lista conti dell'utente
  POST   /api/v1/accounts/          — crea conto
  PATCH  /api/v1/accounts/{id}      — modifica nome/icona/colore
  DELETE /api/v1/accounts/{id}      — soft delete (is_active=False)

Categories:
  GET    /api/v1/categories/        — lista categorie (seed default se vuoto)
  POST   /api/v1/categories/        — crea categoria custom
  PATCH  /api/v1/categories/{id}    — modifica
  DELETE /api/v1/categories/{id}    — soft delete

Transactions:
  GET    /api/v1/transactions/?year=YYYY&month=MM  — lista filtrata per mese
  POST   /api/v1/transactions/      — crea transazione (aggiorna saldo conto)
  DELETE /api/v1/transactions/{id}  — elimina (inverte saldo conto)

Stats:
  GET    /api/v1/stats/monthly?year=YYYY&month=MM
         — risponde: { income, expenses, balance, by_category: [{id, name, icon, color, total}] }
  GET    /api/v1/stats/trend?months=6
         — risponde: [{year, month, income, expenses}] ultimi N mesi
```

**Criteri di completamento**:
- Tutti gli endpoint rispondono correttamente con Postman / curl
- Ogni endpoint è protetto da `get_current_user` (eccetto auth)
- La creazione di una transazione aggiorna `Account.balance`
- L'eliminazione di una transazione inverte il saldo
- La documentazione auto-generata `/api/docs` mostra tutti gli endpoint

**Categorie default da creare al primo accesso utente**:
```python
DEFAULT_CATEGORIES = [
    ("🍕", "Cibo & Ristoranti", "#ef4444", "expense"),
    ("🚗", "Trasporti",         "#f97316", "expense"),
    ("🏠", "Casa",              "#eab308", "expense"),
    ("💊", "Salute",            "#22c55e", "expense"),
    ("🎭", "Intrattenimento",   "#8b5cf6", "expense"),
    ("👕", "Abbigliamento",     "#ec4899", "expense"),
    ("📱", "Tecnologia",        "#06b6d4", "expense"),
    ("🏋️", "Sport",             "#14b8a6", "expense"),
    ("📚", "Istruzione",        "#a78bfa", "expense"),
    ("✈️", "Viaggi",            "#f59e0b", "expense"),
    ("💼", "Stipendio",         "#22c55e", "income"),
    ("💰", "Entrate extra",     "#10b981", "income"),
    ("🎁", "Regalo ricevuto",   "#f472b6", "income"),
]
```

---

## Milestone 3 — Frontend: autenticazione e scaffolding

**Obiettivo**: Login/Register funzionanti, routing con guard, layout base con bottom nav.

**File da creare / completare**:
- `frontend/src/api/client.ts` — ✅ già presente (axios con interceptor JWT)
- `frontend/src/api/auth.ts` — funzioni `login()`, `register()`, `me()`
- `frontend/src/store/authStore.ts` — zustand store con `user`, `token`, `login()`, `logout()`
- `frontend/src/pages/Login.tsx` — form login + link a register
- `frontend/src/pages/Register.tsx` — form registrazione
- `frontend/src/App.tsx` — ✅ già presente, collegare a authStore
- `frontend/src/components/layout/Layout.tsx` — ✅ già presente
- `frontend/src/components/layout/BottomNav.tsx` — ✅ già presente
- `frontend/src/components/layout/TopBar.tsx` — ✅ già presente

**Criteri di completamento**:
- Login con email/password funziona, token salvato in localStorage
- Login a 2 step se MFA attivo (credenziali → codice TOTP 6 cifre)
- Utente non autenticato viene rediretto a `/login`
- Logout pulisce il token e reindirizza a `/login`
- Bottom nav con 4 tab: Home, Movimenti, Conti, Impostazioni
- TopBar con navigazione mese (← Giugno 2025 →)
- Il mese corrente non è avanzabile oltre oggi
- Layout funziona sia su mobile (375px) che desktop (1200px)

**MFA nel login** (`pages/Login.tsx`):
```
Step 1: form email + password
  → POST /auth/login
  → se { access_token }   → salva token → home
  → se { requires_mfa: true, session_token } → step 2

Step 2: card con campo codice TOTP 6 cifre
  → POST /auth/mfa/verify { session_token, code }
  → { access_token } → salva token → home
```

**MFA nelle Impostazioni** (`pages/Settings.tsx`):
- Sezione "Sicurezza" con stato MFA corrente
- Se disattivo:
  1. Bottone "Configura autenticazione a due fattori"
  2. QR code (`react-qr-code`) + secret testuale
  3. Campo codice + bottone "Attiva" → `POST /auth/mfa/enable`
- Se attivo: badge verde + bottone "Disattiva" → `POST /auth/mfa/disable` (richiede codice)

**Design**:
- Tema scuro: sfondo `#0f0f13`, card `#1a1a24`, bordi `white/10`
- Accent color: indigo `#6366f1`
- Font: Inter
- Tap target minimo 44px per tutti i bottoni interattivi
- `safe-area-inset-bottom` applicato alla bottom nav per iPhone con notch

---

## Milestone 4 — Frontend: Dashboard

**Obiettivo**: schermata principale con saldo, grafico a torta spese per categoria, riepilogo entrate/uscite.

**File da creare**:
- `frontend/src/api/stats.ts` — `getMonthlySummary(year, month)`
- `frontend/src/hooks/useMonthlyStats.ts` — TanStack Query wrapper
- `frontend/src/pages/Dashboard.tsx` — pagina principale
- `frontend/src/components/dashboard/SummaryBar.tsx` — barra entrate/uscite/saldo
- `frontend/src/components/dashboard/SpendingChart.tsx` — grafico a torta Recharts
- `frontend/src/components/dashboard/CategoryList.tsx` — lista categorie con importo e barra
- `frontend/src/components/ui/AddTransactionButton.tsx` — bottone FAB (+) per aggiungere transazione
- `frontend/src/components/transactions/AddTransactionSheet.tsx` — bottom sheet per inserimento rapido

**Layout Dashboard (mobile-first)**:
```
┌─────────────────────────────┐
│  ← Giugno 2025 →            │  ← TopBar (sticky)
├─────────────────────────────┤
│  Entrate: €1.200            │
│  Uscite:  €  847  Saldo: €353│  ← SummaryBar
├─────────────────────────────┤
│                             │
│      [Grafico a torta]      │  ← SpendingChart (Recharts PieChart)
│   (tocca una fetta per      │     con legenda sotto
│    filtrare la lista)       │
│                             │
├─────────────────────────────┤
│  🍕 Cibo          €320  ████│
│  🚗 Trasporti     €180  ███ │  ← CategoryList
│  🏠 Casa          €200  ███ │
│  ...                        │
└─────────────────────────────┘
                    [+]         ← FAB fisso in basso a destra
```

**AddTransactionSheet** (bottom sheet che sale dal basso):
- Selezione tipo: Spesa / Entrata / Trasferimento (tab in cima)
- Tastierino numerico grande (stile calcolatrice) per importo
- Selezione categoria con griglia di icone
- Selezione conto (dropdown)
- Campo note opzionale
- Data (default oggi, modificabile)
- Bottone "Salva" in fondo
- Chiusura con swipe down o tap fuori

**Criteri di completamento**:
- Cambiare mese aggiorna tutti i dati automaticamente
- Il grafico mostra le categorie del mese selezionato
- Toccare una fetta del grafico evidenzia la categoria nella lista
- Il FAB apre il bottom sheet
- Salvare una transazione aggiorna la dashboard (invalidate query)
- Loading skeleton durante il fetch
- Stato vuoto se non ci sono transazioni nel mese

---

## Milestone 5 — Frontend: lista transazioni

**Obiettivo**: pagina movimenti con lista cronologica, filtri e swipe-to-delete.

**File da creare**:
- `frontend/src/api/transactions.ts` — `getTransactions()`, `createTransaction()`, `deleteTransaction()`
- `frontend/src/hooks/useTransactions.ts` — TanStack Query
- `frontend/src/pages/Transactions.tsx` — pagina
- `frontend/src/components/transactions/TransactionItem.tsx` — singola riga con swipe
- `frontend/src/components/transactions/TransactionList.tsx` — lista raggruppata per giorno

**Layout**:
```
┌─────────────────────────────┐
│  ← Giugno 2025 →            │
│  [Tutte] [Spese] [Entrate]  │  ← filtro tipo
├─────────────────────────────┤
│  Oggi                       │
│  🍕 Pranzo        -€12,50   │  ← swipe sx per eliminare
│  🚗 Benzina       -€65,00   │
│                             │
│  Ieri                       │
│  💼 Stipendio  +€1.200,00   │
│  🏠 Affitto      -€500,00   │
└─────────────────────────────┘
                    [+]
```

**Criteri di completamento**:
- Transazioni raggruppate per giorno in ordine cronologico inverso
- Filtro Tutte/Spese/Entrate funzionante
- Swipe left su una transazione mostra il bottone "Elimina" (rosso)
- Conferma eliminazione con dialog
- Eliminazione aggiorna saldo e invalida le query
- Tap su una transazione mostra dettaglio (importo, categoria, conto, note, data)
- Stato vuoto se nessuna transazione

---

## Milestone 6 — Frontend: conti e categorie

**Obiettivo**: gestione conti (lista, crea, modifica saldo iniziale) e categorie (lista, crea, personalizza).

**File da creare**:
- `frontend/src/api/accounts.ts`
- `frontend/src/api/categories.ts`
- `frontend/src/pages/Accounts.tsx`
- `frontend/src/pages/Categories.tsx`
- `frontend/src/components/accounts/AccountCard.tsx`
- `frontend/src/components/accounts/AddAccountSheet.tsx`
- `frontend/src/components/categories/CategoryGrid.tsx`
- `frontend/src/components/categories/AddCategorySheet.tsx`
- `frontend/src/components/ui/EmojiPicker.tsx` — picker semplice per icone emoji
- `frontend/src/components/ui/ColorPicker.tsx` — palette colori predefiniti

**Pagina Conti**:
```
┌─────────────────────────────┐
│  I miei conti               │
├─────────────────────────────┤
│  💳 Conto corrente  €1.350  │
│  💵 Contanti          €80   │
│  📈 Investimenti    €5.200  │
├─────────────────────────────┤
│  + Aggiungi conto           │
└─────────────────────────────┘
```

**Pagina Categorie** — due sezioni (Spese / Entrate) con griglia di card:
```
  SPESE
  [🍕 Cibo] [🚗 Auto] [🏠 Casa] ...
  [+ Nuova]

  ENTRATE
  [💼 Stipendio] [💰 Extra] ...
  [+ Nuova]
```

**Criteri di completamento**:
- Creazione conto con nome, emoji, colore, saldo iniziale
- Modifica conto esistente
- Saldo totale di tutti i conti mostrato in cima alla pagina Conti
- Creazione categoria custom con nome, emoji, colore, tipo (spesa/entrata)
- Le categorie default non sono eliminabili, solo disattivabili
- EmojiPicker mostra almeno 30 emoji comuni raggruppate
- ColorPicker mostra 12 colori predefiniti

---

## Milestone 7 — PWA, offline e ottimizzazioni mobile

**Obiettivo**: l'app si installa come PWA, funziona offline per la lettura, gestione notch iPhone.

**File da modificare / creare**:
- `frontend/vite.config.ts` — ✅ PWA già configurata, verificare workbox config
- `frontend/public/icon-192.png` e `icon-512.png` — generare icone app (emoji 💸 su sfondo indigo)
- `frontend/src/hooks/useSwipe.ts` — hook per gesture swipe (per TransactionItem e navigazione mese)
- `frontend/src/components/ui/BottomSheet.tsx` — componente riusabile bottom sheet con animazione
- `frontend/src/components/ui/Skeleton.tsx` — loading skeleton riusabile

**Ottimizzazioni**:
- Tutte le liste usano `Skeleton` durante il caricamento
- Bottom sheet con animazione slide-up (CSS transition, no librerie)
- Swipe orizzontale su TopBar per cambiare mese (useSwipe hook)
- `viewport-fit=cover` nel meta tag (già presente in index.html)
- `safe-area-inset-bottom` su bottom nav e bottom sheet
- Prevent pull-to-refresh (`overscroll-behavior: none` sul body)
- Immagini/icone in formato SVG o WebP

**Criteri di completamento**:
- Chrome su Android mostra "Aggiungi alla schermata home"
- Safari su iPhone: si installa, la status bar è corretta, nessun contenuto sotto il notch
- In assenza di rete i dati dell'ultimo fetch sono visibili (Workbox NetworkFirst)
- Lighthouse PWA score ≥ 90
- Il bottom sheet si apre/chiude con animazione fluida (no jank)

---

## Milestone 8 — Deploy produzione su VPS

**Obiettivo**: `docker compose -f docker-compose.prod.yml up` porta l'app online, Cloudflare fa da reverse proxy.

**File da creare / verificare**:
- `docker-compose.prod.yml` — ✅ già presente
- `nginx/nginx.conf` — routing API vs frontend (già presente)
- `frontend/Dockerfile` — build multi-stage (già presente)
- `backend/Dockerfile` — prod (già presente)
- `.env.prod.example` — variabili di produzione con commenti

**Checklist deploy**:
1. `SECRET_KEY` generata con `openssl rand -hex 32`
2. `POSTGRES_PASSWORD` forte (≥ 20 caratteri random)
3. `CORS_ORIGINS` impostato al dominio Cloudflare reale
4. Build frontend con `VITE_API_URL` vuoto (le API sono sullo stesso dominio tramite Nginx)
5. Cloudflare DNS punta all'IP della VPS
6. Cloudflare SSL mode: **Full** (non Full Strict, a meno di cert self-signed sulla VPS)
7. Cloudflare regola Firewall: blocca tutto tranne porte 80/443
8. VPS: `ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 22/tcp`

**Script di backup** (`scripts/backup.sh`):
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker compose exec db pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > backups/db_$DATE.sql.gz
find backups/ -name "*.sql.gz" -mtime +30 -delete
```

**Criteri di completamento**:
- `docker compose -f docker-compose.prod.yml up -d --build` parte senza errori
- L'app è raggiungibile via HTTPS sul dominio
- `/api/docs` non è esposto pubblicamente (aggiungere `docs_url=None` in prod o proteggere con Cloudflare Access)
- Il backup script funziona e produce un file `.sql.gz` valido

---

## Milestone 9 (opzionale) — Features avanzate

Da implementare dopo che l'app base è stabile.

### 9a — Budget mensile per categoria
- Nuovo modello `Budget` (user_id, category_id, month, year, amount)
- Endpoint `GET/POST /api/v1/budgets/`
- Dashboard: barre di avanzamento budget per categoria (es. Cibo: €180/€300)
- Alert visivo quando si supera l'80% del budget

### 9b — Report e grafici trend
- Endpoint `GET /api/v1/stats/trend?months=6` (già nella Milestone 2)
- Nuova pagina o sezione "Report" con:
  - Grafico a barre mensili entrate/uscite (Recharts BarChart)
  - Grafico lineare saldo nel tempo
  - Export CSV delle transazioni del mese

### 9c — Transazioni ricorrenti

Implementata nella **Milestone 12 — Spese ricorrenti + Saldo reale** (vedi sotto), con
frequenze settimanale/mensile/bimestrale/trimestrale, shift sui giorni festivi italiani e
proiezione nella dashboard, in sostituzione di questa bozza iniziale.

### 9d — Multi-valuta
- Ogni conto ha la propria `currency`
- Endpoint che recupera tassi di cambio (es. da exchangerate-api.com, gratuito)
- Conversione automatica in EUR per le statistiche aggregate

---

## Milestone 10 — Layout desktop con sidebar (stile Nextfolio) ✅

**Obiettivo**: quando l'app è apertaa da browser desktop (≥768px, breakpoint `md`), mostrare un layout diverso da quello mobile: sidebar laterale fissa con tutte le sezioni, topbar con menu utente, e una pagina Impostazioni dedicata. Su mobile il layout attuale (bottom nav, max-w-2xl) resta invariato. Pattern di riferimento: `nextfolio/frontend/src/components/layout/` (`Sidebar.tsx`, `MainLayout.tsx`, `TopBar.tsx`).

**File da creare**:
- `frontend/src/components/layout/Sidebar.tsx` — sidebar laterale, visibile solo `md:flex` (nascosta su mobile)
- `frontend/src/pages/Settings.tsx` — pagina Impostazioni (profilo, sicurezza/MFA, preferenze, logout)
- `frontend/src/pages/About.tsx` — pagina info app (versione, link, ecc.) — opzionale, come in Nextfolio

**File da modificare**:
- `frontend/src/components/layout/Layout.tsx`:
  - Su mobile (`< md`): comportamento attuale, bottom nav + `max-w-2xl mx-auto`
  - Su desktop (`≥ md`): `<Sidebar />` a sinistra + area contenuto a destra (no `max-w-2xl`, niente bottom nav), `BottomNav` con `md:hidden`
- `frontend/src/components/layout/BottomNav.tsx` — aggiungere `md:hidden`, aggiungere voce "Impostazioni" (icona `Settings`)
- `frontend/src/components/layout/TopBar.tsx` — su desktop aggiungere menu utente in alto a destra (avatar, link a Impostazioni, logout), mantenendo la navigazione mese (← Giugno 2025 →) centrale
- `frontend/src/App.tsx` — aggiungere route `/settings` (e `/about` se creata)

**Sidebar — voci di navigazione**:
```
📊 Home          → /
↔️  Movimenti     → /transactions
💼 Conti          → /accounts
🏷️  Categorie     → /categories
⚙️  Impostazioni  → /settings
```

**Pagina Impostazioni — sezioni**:
- **Profilo**: email utente, nome (se presente)
- **Sicurezza**: stato MFA + setup/disable (riusa il flusso già descritto in Milestone 1.5/3, oggi non ancora collegato a una pagina)
- **Preferenze**: tema (se in futuro si aggiunge light mode), valuta predefinita
- **Account**: bottone "Esci" (logout)

**Layout responsive — schema**:
```
Mobile (< md)                    Desktop (≥ md)
┌───────────────────┐            ┌────────┬──────────────────────────┐
│  ← Giugno 2025 →  │            │        │  ← Giugno 2025 →    👤 ▾ │
├───────────────────┤            │        ├──────────────────────────┤
│                   │            │ Sidebar│                          │
│     Pagina        │            │  📊    │        Pagina            │
│                   │            │  ↔️    │                          │
│                   │            │  💼    │                          │
├───────────────────┤            │  🏷️    │                          │
│ 📊 ↔️ 💼 🏷️ ⚙️ │            │  ⚙️    │                          │
└───────────────────┘            └────────┴──────────────────────────┘
   bottom nav                       sidebar fissa, no bottom nav
```

**Criteri di completamento**:
- A larghezza < 768px il layout è identico a quello attuale (nessuna regressione)
- A larghezza ≥ 768px appare la sidebar laterale con tutte le sezioni, la bottom nav è nascosta
- La pagina Impostazioni è raggiungibile sia da sidebar (desktop) che da bottom nav (mobile)
- Il contenuto centrale non è più limitato a `max-w-2xl` su desktop, usa lo spazio disponibile
- Cambiare sezione dalla sidebar aggiorna la pagina senza reload (routing client-side)
- Stile coerente con il tema scuro esistente (`#0f0f13`, `#1a1a24`, accent indigo `#6366f1`)

---

## Milestone 11 — Riorganizzazione categorie ✅

**Obiettivo**: le categorie importate da Firefly III (Milestone "migrazione dati") erano
troppo granulari — 55 categorie (46 spese + 9 entrate) con doppioni concettuali (es.
"Farmaci", "Spese Sanitarie", "Visite mediche", "Ausili medici" tutte riconducibili a
"Salute"). Sono state accorpate in **21 categorie** (16 spese + 5 entrate), riassegnando le
1.335 transazioni esistenti senza perdita di dati.

**Script**: `scripts/consolidate_categories.py` (one-off, stesso pattern di
`migrate_from_firefly.py`) — per ogni gruppo rinomina/ricolora la categoria con più
transazioni, riassegna le transazioni delle categorie accorpate e le elimina, tutto in
un'unica transazione SQL.

**Nuovo elenco categorie**:

| Spese | Entrate |
|---|---|
| 🛒 Spesa & Alimentari | 💼 Stipendio |
| 🍕 Ristoranti & Bar | 💸 Rimborsi |
| 🚗 Trasporti | 📈 Investimenti |
| 🏠 Casa | 🎁 Regali ricevuti |
| 💡 Bollette & Utenze | 💰 Altre entrate |
| ✈️ Viaggi & Vacanze | |
| 🛍️ Shopping | |
| 📖 Istruzione | |
| 📱 Abbonamenti | |
| 🛡️ Assicurazioni | |
| 🏥 Salute | |
| 🎭 Intrattenimento & Tempo libero | |
| 🐾 Animali | |
| 💰 Risparmi & Investimenti | |
| 🔄 Trasferimento | |
| 📦 Varie | |

`DEFAULT_CATEGORIES` in `backend/app/api/v1/endpoints/categories.py` aggiornato allo stesso
elenco, così eventuali nuovi utenti partono con il set consolidato.

**Criteri di completamento**:
- `SELECT COUNT(*) FROM categories` → 21
- Totale transazioni invariato (1.335), nessuna orfana
- Pagina Categorie e Dashboard mostrano le nuove categorie con icone/colori corretti

---

## Milestone 12 — Spese ricorrenti + Saldo reale ✅

**Obiettivo**: gestire spese/entrate ricorrenti (abbonamenti, rate, affitto) con frequenza
settimanale/mensile/bimestrale/trimestrale, fine prevista o ricorrenza indefinita, e
calcolo automatico dello shift sui giorni festivi italiani. In dashboard, una nuova
metrica "Saldo reale" mostra quanto resterà davvero a fine mese tenendo conto delle
ricorrenze non ancora addebitate.

### Backend
- `app/services/holidays.py` — calcolo festività italiane (fisse + Lunedì dell'Angelo via
  algoritmo di Gauss) e `next_business_day()` (salta weekend e festivi)
- Modello `RecurringTransaction` (`recurring_transactions`, migration `003_recurring`):
  importo, tipo, categoria/conto, frequenza (`weekly`/`monthly`/`bimonthly`/`quarterly`),
  `start_date` (data di addebito di riferimento), `end_date` opzionale (NULL = senza
  scadenza), `last_run_date`
- `app/services/recurring.py`:
  - `next_raw_date()` calcola la prossima occorrenza grezza dalla frequenza
  - `process_due_recurring()` — job giornaliero: genera le `Transaction` per le occorrenze
    (shiftate al primo giorno lavorativo) ormai scadute, aggiorna `Account.balance` e
    `last_run_date`
  - `projected_occurrences()` — occorrenze previste nel mese corrente non ancora generate,
    usate per `/stats/monthly`
- `APScheduler` (`AsyncIOScheduler`) avviato nel `lifespan` di `app/main.py`, cron
  giornaliero alle 00:10
- `GET/POST/PATCH/DELETE /api/v1/recurring/` — CRUD ricorrenze dell'utente
- `/api/v1/stats/monthly` esteso:
  - `real_balance` = patrimonio totale (somma saldi conti attivi) − spese ricorrenti
    previste non ancora generate per il resto del mese + entrate ricorrenti previste
  - le occorrenze ricorrenti previste del mese vengono aggiunte anche a `income`/`expenses`
    e a `by_category`, così appaiono già nel grafico a torta

### Frontend
- `frontend/src/api/recurring.ts` — tipi e chiamate CRUD
- `frontend/src/pages/Recurring.tsx` + `components/recurring/RecurringCard.tsx` +
  `components/recurring/AddRecurringSheet.tsx` — nuova pagina "Ricorrenti" (lista,
  creazione/modifica/eliminazione, selezione frequenza e data di fine opzionale)
- Voce "Ricorrenti" in `Sidebar.tsx` e `BottomNav.tsx`
- `SummaryBar.tsx` — quarta card "Saldo reale" (griglia 2×2 su mobile, 4 colonne da `sm`)
- `Dashboard.tsx` passa `summary.real_balance` a `SummaryBar`

**Criteri di completamento**:
- `alembic upgrade head` crea `recurring_transactions` senza errori
- Creando una ricorrenza mensile, `GET /api/v1/stats/monthly` per il mese corrente
  restituisce `real_balance` e, se ci sono occorrenze previste, le somma a `by_category`
- Una ricorrenza con `start_date` su un giorno festivo/weekend viene addebitata (job o
  esecuzione manuale di `process_due_recurring`) con `date` spostata al primo giorno
  lavorativo successivo
- Dashboard mostra la card "Saldo reale" e il grafico a torta include le ricorrenti
  previste del mese

---

## Milestone 13 — Preferenze utente (valuta, conto predefinito) + fix UI mobile ✅

**Obiettivo**: permettere all'utente di scegliere la valuta visualizzata nell'app e un
conto predefinito da mostrare all'apertura della Dashboard, e risolvere due problemi di
usabilità su smartphone nei bottom sheet.

### Backend
- Modello `User` (`app/models/user.py`): nuovi campi `currency` (default `EUR`) e
  `default_account_id` (FK opzionale verso `accounts.id`, `ON DELETE SET NULL`)
- Migration `004_user_prefs` — `ALTER TABLE users ADD COLUMN currency ...` e
  `default_account_id ...`
- `relationship` su `User`/`Account` resi espliciti con `foreign_keys` per evitare
  l'ambiguità introdotta dal nuovo FK `users.default_account_id → accounts.id`
- `app/api/v1/endpoints/auth.py`:
  - `UserOut` include ora `currency` e `default_account_id`
  - nuovo `PATCH /api/v1/auth/me` — aggiorna `currency` e/o `default_account_id`
    (valida che il conto appartenga all'utente; `clear_default_account: true` per
    tornare a "Tutti i conti")

### Frontend
- `utils/currency.ts` — elenco valute supportate (EUR, USD, GBP, CHF, JPY) con simbolo
- `hooks/useCurrency.ts` — legge `user.currency` da `authStore` e restituisce il simbolo
- Tutti i punti dell'app che mostravano `€` fisso (Dashboard, Conti, Movimenti,
  Ricorrenti e relativi bottom sheet) usano ora `useCurrency()`; `AccountCard` mostra il
  simbolo della valuta del singolo conto (`account.currency`)
- Nuove transazioni/conti creati usano la valuta preferita dell'utente
- `pages/Settings.tsx` — nuova sezione **Preferenze**:
  - select Valuta → `PATCH /auth/me { currency }`
  - select "Conto predefinito (schermata iniziale)" → `PATCH /auth/me { default_account_id }`
    (opzione "Tutti i conti" → `clear_default_account: true`)
- `pages/Dashboard.tsx` — al primo caricamento, se l'utente ha un conto predefinito
  impostato, lo seleziona automaticamente nel filtro conti

### Fix UI mobile (bottom sheet)
- `components/ui/AddTransactionButton.tsx` — FAB `+` alzato (`bottom-20` → `bottom-28`)
  per non sovrapporsi alla bottom nav
- `components/ui/BottomSheet.tsx` — backdrop e pannello portati a `z-[55]`/`z-[60]`
  (sopra la `BottomNav`, che è `z-50`): risolve il problema per cui il bottone "Salva"
  in fondo ai bottom sheet (nuova transazione, ricorrenza, ecc.) era coperto dalla
  bottom nav e non era cliccabile su smartphone

**Criteri di completamento**:
- `alembic upgrade head` applica `004_user_prefs` senza errori, backend si avvia senza
  errori di mapping SQLAlchemy
- Cambiando la valuta in Impostazioni, tutti gli importi nell'app mostrano il nuovo
  simbolo
- Impostando un conto predefinito, la Dashboard lo seleziona automaticamente al
  successivo accesso
- Su smartphone il FAB `+` e il bottone "Salva" dei bottom sheet sono sempre
  raggiungibili, senza essere coperti dalla bottom nav

---

## Milestone 14 — Import CSV Mediobanca Premier + riconciliazione conto ✅

**Obiettivo**: permettere l'import in blocco dei movimenti da un estratto conto CSV di
Mediobanca Premier (con categorizzazione automatica e deduplica) e una funzione di
riconciliazione del saldo (ispirata a Firefly III) per allineare il saldo del conto al
saldo reale della banca.

### Backend
- Modello `Transaction` (`app/models/transaction.py`): nuovi campi `import_hash`
  (`String(64)`, nullable) e `is_reconciliation` (`Boolean`, default `false`)
- Migration `005_csv_import_reconciliation` — aggiunge le due colonne e crea l'indice
  univoco parziale `ix_tx_account_import_hash ON transactions(account_id, import_hash)
  WHERE import_hash IS NOT NULL` per evitare doppioni
- `app/services/csv_import.py`:
  - `decode_csv_bytes` — decodifica robusta (utf-8-sig → cp1252 → latin-1)
  - `parse_italian_amount` / `parse_italian_date` — formati numerici/date italiani
  - `CATEGORY_KEYWORDS` + `suggest_category_name` — suggerimento categoria basato su
    parole chiave nella descrizione del movimento (farmacia, supermercati, ristoranti,
    Amazon, utenze, stipendio, prelievi, ecc.)
  - `compute_import_hash` — hash SHA256 di `(account_id, data, importo, descrizione)`
    usato per la deduplica
  - `parse_mediobanca_csv` — parsing del CSV (delimitatore `;`, colonne `Data
    contabile`/`Data valuta`, `Entrate`/`Uscite`, `Tipologia`, `Divisa`), con elenco di
    warning per righe malformate o scartate
- `app/api/v1/endpoints/csv_import.py` (router `/api/v1/import`):
  - `POST /import/mediobanca/preview` — form-data (`account_id`, `file`), nessuna
    scrittura su DB: ritorna l'elenco delle righe con categoria suggerita, flag
    `is_duplicate` (basato su `import_hash` già presenti per il conto) e
    `currency_mismatch` (valuta riga ≠ valuta conto)
  - `POST /import/mediobanca/confirm` — crea le `Transaction` per le righe incluse
    (ri-controllando i duplicati lato server), aggiorna `account.balance` con la stessa
    logica `Decimal` usata per le transazioni manuali, un solo commit finale
- `app/api/v1/endpoints/accounts.py`:
  - nuovo `POST /accounts/{id}/reconcile` — riceve `real_balance` (e opzionalmente
    `date`), calcola la differenza col saldo Moneto e, se diversa da zero, crea una
    `Transaction` di rettifica (`is_reconciliation=true`, nota "Rettifica saldo
    (riconciliazione)") e aggiorna `account.balance` al valore reale. Le transazioni di
    rettifica contano come transazioni normali nelle statistiche mensili.

### Frontend
- `api/csvImport.ts` — `importApi.previewMediobanca` / `confirmMediobanca`
- `api/accounts.ts` — `accountsApi.reconcile(id, { real_balance, date })`
- `components/accounts/ImportCsvSheet.tsx` — bottom sheet a due fasi: selezione file CSV
  → anteprima righe (categoria modificabile, checkbox di inclusione, badge "Duplicato" /
  "Valuta diversa") → conferma import con riepilogo
- `components/accounts/ReconcileSheet.tsx` — bottom sheet con saldo attuale, input saldo
  reale e data, differenza calcolata live, conferma che crea la rettifica
- `components/accounts/AddAccountSheet.tsx` — in modalità modifica, due nuovi bottoni
  "📄 Importa estratto conto" e "⚖️ Riconcilia saldo"
- `pages/Accounts.tsx` — stato per aprire `ImportCsvSheet` / `ReconcileSheet` dal conto
  selezionato

**Criteri di completamento**:
- `alembic upgrade head` applica `005_csv_import_reconciliation` senza errori, backend
  si avvia senza errori di mapping
- Caricando l'estratto conto Mediobanca di esempio si vede l'anteprima con date, importi
  e categorie suggerite corrette
- Confermando l'import, il saldo del conto si aggiorna e le transazioni compaiono nei
  Movimenti con la descrizione originale come nota
- Ricaricando lo stesso file, le righe già importate sono marcate come duplicate e non
  vengono reimportate
- La riconciliazione crea una transazione di rettifica con segno corretto e porta il
  saldo del conto al valore inserito

---

## Milestone 9b — Report e grafici trend ✅

**Obiettivo**: nuova pagina "Report" con l'andamento mensile di entrate/uscite, il saldo
nel tempo e l'export CSV dei movimenti del mese.

### Backend
- Nessuna modifica: riusa `GET /api/v1/stats/trend?months=N` (già presente dalla
  Milestone 2) e `GET /api/v1/transactions/` per l'export.

### Frontend
- `components/report/TrendChart.tsx` — grafico a barre (Recharts) entrate/uscite per
  mese, con selettore di intervallo 3/6/12 mesi
- `components/report/BalanceTrendChart.tsx` — grafico a linee del saldo totale a fine
  mese, calcolato a ritroso a partire dal saldo attuale dei conti sottraendo il netto
  (entrate − uscite) di ciascun mese successivo
- `utils/exportCsv.ts` — genera e scarica un CSV (con BOM UTF-8, delimitatore `;`)
- `pages/Report.tsx` — pagina con i due grafici e un bottone "Esporta movimenti" che
  scarica il CSV del mese selezionato (data, descrizione, categoria, conto, tipo,
  importo)
- Nuova voce "Report" in `BottomNav` e `Sidebar`, nuova rotta `/report`

**Criteri di completamento**:
- La pagina Report mostra il grafico a barre entrate/uscite e il grafico a linee del
  saldo per l'intervallo selezionato (3/6/12 mesi)
- Il bottone "Esporta movimenti" scarica un CSV con i movimenti del mese corrente,
  apribile correttamente in Excel/LibreOffice (accenti italiani inclusi)

---

## Milestone 15 — Saldo reale per conto, dashboard per periodo, modifica/eliminazione movimenti ✅

**Obiettivo**: il saldo di un conto non è più un contatore aggiornato a ogni
transazione, ma viene calcolato al volo dalle transazioni reali (`date <= now`),
permettendo transazioni con data futura ("non ancora contabilizzate"). La Dashboard
mostra le metriche del periodo selezionabile (mese corrente, settimana corrente o
intervallo personalizzato) e i suoi indicatori sono collegati al saldo reale dei conti.
Aggiunta anche la modifica/eliminazione delle transazioni esistenti.

> **Supera/aggiorna** quanto descritto nella Milestone 12 (`real_balance` su
> `/stats/monthly`) e nella Milestone 14 (riconciliazione che aggiornava
> `account.balance` direttamente): entrambi gli endpoint sono stati sostituiti come
> descritto sotto.

### Backend
- Migration `006_real_balance_model` — rinomina `accounts.balance` →
  `accounts.opening_balance` e "scarica" su questa colonna il netto di tutte le
  transazioni esistenti, in modo che il saldo reale calcolato resti invariato dopo la
  migrazione
- `app/services/balance.py` — `compute_balances()` / `compute_balance()`: saldo reale di
  un conto = `opening_balance + Σ(entrate − uscite)` delle transazioni con
  `date <= as_of` (default: ora)
- Rimosse tutte le mutazioni dirette di `account.balance` da
  `transactions.py` (create/delete), `csv_import.py` (confirm) e
  `services/recurring.py` (`process_due_recurring`): il saldo si ricalcola sempre on
  read
- `app/api/v1/endpoints/accounts.py`:
  - `AccountOut.balance` è ora il saldo reale calcolato (`compute_balances`)
  - `AccountCreate` usa `opening_balance` (saldo iniziale, label UI "Saldo iniziale")
  - `POST /accounts/{id}/reconcile` non aggiorna più `account.balance`: crea solo la
    transazione di rettifica (`is_reconciliation=true`) e il nuovo saldo viene
    ricalcolato da `compute_balance`. Le rettifiche continuano a contare come
    entrate/uscite normali in `/stats/summary` e `/stats/trend` (per scelta esplicita:
    una rettifica positiva va in "Entrate", una negativa in "Uscite")
- `app/api/v1/endpoints/transactions.py`:
  - `GET /transactions/` accetta `start`/`end` (oltre a `year`/`month`) e
    `account_id` come filtri
  - nuovo `PATCH /transactions/{id}` (`TransactionUpdate`, tutti i campi opzionali) per
    la modifica di una transazione esistente
- `app/services/recurring.py` — `projected_occurrences_in_range(rt, start, end, today)`
  generalizza `projected_occurrences()` a un intervallo di date arbitrario (non solo il
  mese corrente)
- `/api/v1/stats/monthly` → **`GET /api/v1/stats/summary?start=...&end=...&account_id=...`**
  (`/stats/trend` invariato):
  - `income` / `expenses` — entrate/uscite reali (`date <= now`) nel periodo
  - `pending_expenses` — spese con data futura nel periodo + occorrenze ricorrenti
    previste non ancora generate
  - `balance` — saldo reale (`compute_balances`) del/dei conto/i in scope, **indipendente
    dal periodo** (stesso valore della pagina Conti)
  - `by_category` — spese reali + proiezioni ricorrenti del periodo; le spese senza
    categoria vengono raggruppate sotto la categoria predefinita "Varie" 📦

### Frontend
- `store/dateStore.ts` — esteso con `mode: 'month' | 'week' | 'custom'`,
  `customStart`/`customEnd`, `getRange()`; settimana = Lunedì-Domenica (`dayjs`
  `isoWeek`)
- `components/layout/PeriodPanel.tsx` — pannello per scegliere Mese corrente / Settimana
  corrente / Intervallo personalizzato (con campi "Da"/"A"), apribile da `TopBar.tsx`
- `hooks/useSummaryStats.ts` (ex `useMonthlyStats.ts`) e `hooks/useTransactions.ts` —
  usano `getRange()` + conto selezionato, chiamano `/stats/summary` e
  `/transactions/?start=...&end=...`; invalidazione cache per prefisso
  (`['stats']`, `['transactions']`, `['accounts']`)
- `components/dashboard/SummaryBar.tsx`:
  - "Entrate" / "Uscite" / "Non contabilizzate" → metriche del periodo selezionato
  - "Saldo" → saldo reale del/dei conto/i (`summary.balance`, uguale alla pagina Conti)
  - "Saldo disponibile" → `balance - pending_expenses`
- `pages/Dashboard.tsx` — cliccando una fetta/voce del grafico a torta si filtra
  l'elenco movimenti del periodo per quella categoria (le spese senza categoria
  rientrano in "Varie"); ricliccando si torna alla vista per categorie
- `components/transactions/AddTransactionSheet.tsx` — modalità duale create/modifica
  tramite prop opzionale `transaction`: precompila i campi e usa
  `PATCH /transactions/{id}` invece di `POST`; limite data portato a "oggi + 1 anno"
  (permette transazioni future)
- `components/transactions/TransactionDialogs.tsx` — nuovo componente condiviso
  (estratto da `Transactions.tsx`, riusato in `Dashboard.tsx`): bottom sheet di
  dettaglio movimento con bottoni "Modifica" e "Elimina" + dialog di conferma
  eliminazione
- `components/accounts/AddAccountSheet.tsx` / `api/accounts.ts` — campo "Saldo iniziale"
  mappato su `opening_balance`

**Criteri di completamento**:
- `alembic upgrade head` applica `006` senza errori; per un conto con saldo noto,
  `GET /accounts` restituisce lo stesso saldo di prima della migrazione
- Una transazione con data futura non modifica il saldo del conto ma appare in
  Movimenti e in "Non contabilizzate"
- Cambiando periodo in Home (mese/settimana/intervallo personalizzato) le card e i
  Movimenti si aggiornano coerentemente; "Saldo" è sempre uguale al saldo del conto
  nella pagina Conti
- Cliccando una categoria nel grafico a torta si vedono i movimenti di quella categoria
  del periodo (incluse le spese senza categoria sotto "Varie"); ricliccando si torna
  alla vista generale
- Da un movimento si può aprire "Modifica" (precompilato, salva con `PATCH`) o
  "Elimina" (con conferma)
- Una riconciliazione aggiorna sia il saldo in Conti che la card "Saldo" in Home, e la
  rettifica compare in Entrate/Uscite del periodo in cui è stata creata

---

## Struttura file finale attesa

```
monefy-clone/
├── .devcontainer/devcontainer.json
├── .env.example
├── .gitignore
├── docker-compose.yml            ← dev
├── docker-compose.prod.yml       ← prod
├── ROADMAP.md                    ← questo file
│
├── backend/
│   ├── Dockerfile.dev
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── migrations/
│   │   ├── env.py
│   │   └── versions/
│   │       └── 001_initial.py
│   └── app/
│       ├── main.py
│       ├── core/
│       │   ├── config.py
│       │   └── security.py
│       ├── db/
│       │   ├── base.py
│       │   └── session.py
│       ├── models/
│       │   ├── user.py
│       │   ├── account.py
│       │   ├── category.py
│       │   └── transaction.py
│       ├── schemas/              ← Pydantic schemas separati dai models
│       └── api/v1/
│           ├── __init__.py
│           └── endpoints/
│               ├── auth.py
│               ├── accounts.py
│               ├── categories.py
│               ├── transactions.py
│               └── stats.py
│
├── frontend/
│   ├── Dockerfile.dev
│   ├── Dockerfile
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── api/
│       │   ├── client.ts
│       │   ├── auth.ts
│       │   ├── accounts.ts
│       │   ├── categories.ts
│       │   ├── transactions.ts
│       │   └── stats.ts
│       ├── store/
│       │   ├── authStore.ts
│       │   └── dateStore.ts
│       ├── hooks/
│       │   ├── useMonthlyStats.ts
│       │   ├── useTransactions.ts
│       │   └── useSwipe.ts
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Layout.tsx
│       │   │   ├── Sidebar.tsx
│       │   │   ├── TopBar.tsx
│       │   │   └── BottomNav.tsx
│       │   ├── ui/
│       │   │   ├── BottomSheet.tsx
│       │   │   ├── Skeleton.tsx
│       │   │   ├── EmojiPicker.tsx
│       │   │   └── ColorPicker.tsx
│       │   ├── dashboard/
│       │   │   ├── SummaryBar.tsx
│       │   │   ├── SpendingChart.tsx
│       │   │   └── CategoryList.tsx
│       │   ├── transactions/
│       │   │   ├── TransactionItem.tsx
│       │   │   ├── TransactionList.tsx
│       │   │   └── AddTransactionSheet.tsx
│       │   ├── accounts/
│       │   │   ├── AccountCard.tsx
│       │   │   └── AddAccountSheet.tsx
│       │   └── categories/
│       │       ├── CategoryGrid.tsx
│       │       └── AddCategorySheet.tsx
│       └── pages/
│           ├── Login.tsx
│           ├── Register.tsx
│           ├── Dashboard.tsx
│           ├── Transactions.tsx
│           ├── Accounts.tsx
│           ├── Categories.tsx
│           ├── Settings.tsx
│           └── About.tsx
│
└── nginx/
    └── nginx.conf
```

---

## Prompt suggeriti per Claude in VS Code

### Inizio sessione
```
Sei il mio assistente di sviluppo per questo progetto.
Leggi ROADMAP.md per capire il contesto.
Stack: FastAPI + PostgreSQL backend, React + Vite + Tailwind frontend, tutto in Docker.
Prima di scrivere qualsiasi codice, leggi i file esistenti nella directory su cui stai lavorando.
```

### Per iniziare una milestone
```
Implementa la Milestone 3 della ROADMAP.md (Frontend: autenticazione e scaffolding).
Leggi prima i file esistenti in frontend/src/.
Crea tutti i file elencati e assicurati che i criteri di completamento siano soddisfatti.
```

### Per debug
```
Ho un errore su [endpoint/componente]. Leggi il file [path] e il messaggio di errore:
[errore]
Trova la causa e correggi.
```

### Per aggiungere una feature non in roadmap
```
Aggiungi [feature] mantenendo coerenza con il resto del progetto.
Usa lo stesso pattern degli altri endpoint/componenti esistenti.
Non modificare file non necessari.
```

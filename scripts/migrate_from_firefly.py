#!/usr/bin/env python3
"""
Migrazione dati: Firefly III (MariaDB) → Moneto (PostgreSQL)

Legge account, categorie e transazioni da Firefly III e le importa in Moneto.
- Withdrawal  → expense
- Deposit     → income
- Transfer    → coppia expense+income sulla categoria "Trasferimento"
  (necessaria per mantenere saldi corretti per conto)

Uso: python3 scripts/migrate_from_firefly.py
"""

import subprocess
import sys
import uuid

# ── Configurazione ──────────────────────────────────────────────────────────────
MONETO_USER_ID = "36b74ae7-9652-4eac-817d-2f7efc9cec47"  # Giovanni

FF_CTR  = "firefly_iii_db"
FF_USER = "firefly"
FF_PASS = "AesFW/:-8!cw?fkXDBGdYC"
FF_DB   = "firefly"

MN_CTR  = "moneto-db-1"
MN_USER = "moneto"
MN_DB   = "monetodb"

# ── Helpers ─────────────────────────────────────────────────────────────────────

def ff_query(sql: str) -> list[dict]:
    """Esegue una query su Firefly III MariaDB, ritorna list[dict]."""
    r = subprocess.run(
        ["docker", "exec", FF_CTR, "mariadb",
         f"-u{FF_USER}", f"-p{FF_PASS}", FF_DB, "-e", sql],
        capture_output=True, text=True
    )
    if r.returncode != 0:
        print("ERRORE Firefly:", r.stderr[:500], file=sys.stderr)
        sys.exit(1)
    lines = r.stdout.strip().split("\n")
    if len(lines) < 2:
        return []
    headers = lines[0].split("\t")
    rows = []
    for line in lines[1:]:
        if not line:
            continue
        parts = line.split("\t")
        rows.append(dict(zip(headers, parts)))
    return rows


def mn_exec(sql: str):
    """Esegue SQL su Moneto PostgreSQL (in una transazione)."""
    r = subprocess.run(
        ["docker", "exec", "-i", MN_CTR, "psql",
         "-U", MN_USER, "-d", MN_DB, "-v", "ON_ERROR_STOP=1", "-q"],
        input=sql, capture_output=True, text=True
    )
    if r.returncode != 0:
        print("ERRORE Moneto SQL:", r.stderr[:500], file=sys.stderr)
        sys.exit(1)
    return r.stdout


def mn_query(sql: str) -> str:
    r = subprocess.run(
        ["docker", "exec", MN_CTR, "psql",
         "-U", MN_USER, "-d", MN_DB, "-c", sql],
        capture_output=True, text=True
    )
    return r.stdout


def esc(s) -> str:
    """Escape single quotes per SQL (ritorna 'NULL' se None o stringa NULL)."""
    if s is None or s == "NULL":
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"


def new_id() -> str:
    return str(uuid.uuid4())


def null_or_val(v):
    """Converte la stringa 'NULL' di MariaDB in None."""
    return None if (v is None or v == "NULL") else v


# ── Mapping categorie Firefly → emoji / colore / tipo ───────────────────────────
# Ogni chiave è una sottostringa (lowercase) del nome della categoria.
# L'ordine conta: la prima corrispondenza vince.
CATEGORY_MAP = [
    ("regali ricevuti",          "🎁", "#f472b6", "income"),
    ("stipendio",                "💼", "#22c55e", "income"),
    ("bonus",                    "💰", "#10b981", "income"),
    ("redditi da invest",        "📈", "#f59e0b", "income"),
    ("interessi",                "💰", "#10b981", "income"),
    ("assegno unico",            "👶", "#f472b6", "income"),
    ("oliveto",                  "🫒", "#22c55e", "income"),
    ("rimborso",                 "💸", "#10b981", "income"),
    ("inps",                     "🏛️", "#6366f1", "income"),
    ("assicurazioni",            "🛡️", "#ef4444", "expense"),
    ("spesa supermercato",       "🛒", "#22c55e", "expense"),
    ("spesa alimentare",         "🛒", "#22c55e", "expense"),
    ("cibo da asporto",          "🥡", "#ef4444", "expense"),
    ("cibo per animali",         "🐾", "#22c55e", "expense"),
    ("trasporti",                "🚗", "#f97316", "expense"),
    ("affitto",                  "🏠", "#eab308", "expense"),
    ("mutuo",                    "🏠", "#eab308", "expense"),
    ("condominio",               "🏢", "#eab308", "expense"),
    ("abbonamenti",              "📱", "#06b6d4", "expense"),
    ("bollette",                 "💡", "#f59e0b", "expense"),
    ("internet",                 "📡", "#8b5cf6", "expense"),
    ("telefono",                 "📡", "#8b5cf6", "expense"),
    ("ristoranti",               "🍕", "#ef4444", "expense"),
    ("bar",                      "☕", "#f97316", "expense"),
    ("intrattenimento",          "🎭", "#8b5cf6", "expense"),
    ("games",                    "🎮", "#8b5cf6", "expense"),
    ("shopping",                 "🛍️", "#ec4899", "expense"),
    ("abbigliamento",            "👕", "#ec4899", "expense"),
    ("viaggi",                   "✈️", "#f59e0b", "expense"),
    ("vacanze",                  "✈️", "#f59e0b", "expense"),
    ("hobby",                    "🎮", "#a78bfa", "expense"),
    ("visite mediche",           "🏥", "#22c55e", "expense"),
    ("spese sanitarie",          "🏥", "#22c55e", "expense"),
    ("spese veterinarie",        "🐾", "#22c55e", "expense"),
    ("visite veterinarie",       "🐾", "#22c55e", "expense"),
    ("ausili medici",            "🩺", "#22c55e", "expense"),
    ("farmaci",                  "💊", "#22c55e", "expense"),
    ("cure estetiche",           "💇", "#ec4899", "expense"),
    ("risparmi",                 "💰", "#10b981", "expense"),
    ("investimenti",             "📈", "#f59e0b", "expense"),
    ("rimborso prestiti",        "💳", "#ef4444", "expense"),
    ("rate auto",                "🚗", "#f97316", "expense"),
    ("sport",                    "🏋️", "#14b8a6", "expense"),
    ("regali",                   "🎁", "#f472b6", "expense"),
    ("donazioni",                "❤️", "#ec4899", "expense"),
    ("beneficenza",              "❤️", "#ec4899", "expense"),
    ("corsi",                    "📚", "#a78bfa", "expense"),
    ("libri",                    "📖", "#a78bfa", "expense"),
    ("conferenze",               "🎤", "#8b5cf6", "expense"),
    ("arredamento",              "🪑", "#eab308", "expense"),
    ("elettrodomestici",         "🔧", "#f97316", "expense"),
    ("riparazioni",              "🔨", "#f97316", "expense"),
    ("accessori per animali",    "🐾", "#22c55e", "expense"),
    ("istruzione",               "📚", "#a78bfa", "expense"),
    ("baby sitter",              "👶", "#ec4899", "expense"),
    ("contanti",                 "💵", "#84cc16", "expense"),
    ("multa",                    "🚫", "#ef4444", "expense"),
    ("carte di credito",         "💳", "#6366f1", "expense"),
]

ACCOUNT_MAP = [
    ("conto di risparmio",       "💰", "#22c55e"),
    ("mediobanca",               "🏦", "#6366f1"),
    ("scalable capital",         "📈", "#f59e0b"),
    ("revolut",                  "💳", "#8b5cf6"),
    ("trade republic",           "📈", "#14b8a6"),
    ("cash account",             "💵", "#84cc16"),
]


def cat_meta(name: str):
    lname = name.lower()
    for key, emoji, color, typ in CATEGORY_MAP:
        if key in lname:
            return emoji, color, typ
    return "📦", "#6366f1", "expense"


def acc_meta(name: str):
    lname = name.lower()
    for key, emoji, color in ACCOUNT_MAP:
        if key in lname:
            return emoji, color
    return "💳", "#6366f1"


# ── Migrazione principale ───────────────────────────────────────────────────────

def main():
    print("=" * 55)
    print("  Migrazione Firefly III → Moneto")
    print("=" * 55)

    # ── 1. Account (Asset + Cash) ─────────────────────────────
    print("\n[1/6] Carico account da Firefly III...")
    ff_accounts = ff_query("""
        SELECT a.id, a.name, at2.type AS account_type
        FROM accounts a
        JOIN account_types at2 ON a.account_type_id = at2.id
        WHERE a.deleted_at IS NULL
          AND at2.type IN ('Asset account', 'Cash account')
        ORDER BY a.id
    """)
    print(f"      {len(ff_accounts)} account trovati")

    acc_map = {}  # ff_id → moneto_uuid
    acc_rows = []
    for a in ff_accounts:
        mid = new_id()
        acc_map[a["id"]] = mid
        emoji, color = acc_meta(a["name"])
        acc_rows.append(
            f"('{mid}', '{MONETO_USER_ID}', {esc(a['name'])}, '{emoji}', '{color}', 0, 'EUR', true)"
        )

    # ── 2. Categorie ──────────────────────────────────────────
    print("[2/6] Carico categorie da Firefly III...")
    ff_cats = ff_query("""
        SELECT id, name FROM categories WHERE deleted_at IS NULL ORDER BY id
    """)
    print(f"      {len(ff_cats)} categorie trovate")

    cat_map = {}  # ff_id → moneto_uuid
    cat_rows = []
    for c in ff_cats:
        mid = new_id()
        cat_map[c["id"]] = mid
        emoji, color, typ = cat_meta(c["name"])
        cat_rows.append(
            f"('{mid}', '{MONETO_USER_ID}', {esc(c['name'])}, '{emoji}', '{color}', '{typ}', false, true)"
        )

    transfer_cat_id = new_id()
    cat_rows.append(
        f"('{transfer_cat_id}', '{MONETO_USER_ID}', 'Trasferimento', '🔄', '#94a3b8', 'expense', false, true)"
    )
    no_cat_id = new_id()
    cat_rows.append(
        f"('{no_cat_id}', '{MONETO_USER_ID}', 'Varie', '📦', '#94a3b8', 'expense', false, true)"
    )

    # ── 3. Spese (Withdrawal) ─────────────────────────────────
    print("[3/6] Carico spese (Withdrawal)...")
    withdrawals = ff_query("""
        SELECT tj.id, tj.description, DATE(tj.date) AS date,
               a.id AS acc_id,
               ABS(t.amount) AS amount,
               (SELECT MIN(c2.id)
                FROM category_transaction_journal ctj2
                JOIN categories c2 ON c2.id = ctj2.category_id AND c2.deleted_at IS NULL
                WHERE ctj2.transaction_journal_id = tj.id) AS cat_id
        FROM transaction_journals tj
        JOIN transaction_types tt ON tj.transaction_type_id = tt.id AND tt.type = 'Withdrawal'
        JOIN transactions t  ON t.transaction_journal_id = tj.id AND t.amount < 0 AND t.deleted_at IS NULL
        JOIN accounts a      ON t.account_id = a.id
        JOIN account_types at2 ON a.account_type_id = at2.id
          AND at2.type IN ('Asset account', 'Cash account')
        WHERE tj.deleted_at IS NULL
        ORDER BY tj.date, tj.id
    """)
    print(f"      {len(withdrawals)} spese trovate")

    # ── 4. Entrate (Deposit) ──────────────────────────────────
    print("[4/6] Carico entrate (Deposit)...")
    deposits = ff_query("""
        SELECT tj.id, tj.description, DATE(tj.date) AS date,
               a.id AS acc_id,
               ABS(t.amount) AS amount,
               (SELECT MIN(c2.id)
                FROM category_transaction_journal ctj2
                JOIN categories c2 ON c2.id = ctj2.category_id AND c2.deleted_at IS NULL
                WHERE ctj2.transaction_journal_id = tj.id) AS cat_id
        FROM transaction_journals tj
        JOIN transaction_types tt ON tj.transaction_type_id = tt.id AND tt.type = 'Deposit'
        JOIN transactions t  ON t.transaction_journal_id = tj.id AND t.amount > 0 AND t.deleted_at IS NULL
        JOIN accounts a      ON t.account_id = a.id
        JOIN account_types at2 ON a.account_type_id = at2.id
          AND at2.type IN ('Asset account', 'Cash account')
        WHERE tj.deleted_at IS NULL
        ORDER BY tj.date, tj.id
    """)
    print(f"      {len(deposits)} entrate trovate")

    # ── 5. Trasferimenti ──────────────────────────────────────
    print("[5/6] Carico trasferimenti...")
    transfers = ff_query("""
        SELECT tj.id, tj.description, DATE(tj.date) AS date,
               src_a.id AS src_id,
               dst_a.id AS dst_id,
               ABS(src_t.amount) AS amount
        FROM transaction_journals tj
        JOIN transaction_types tt  ON tj.transaction_type_id = tt.id AND tt.type = 'Transfer'
        JOIN transactions src_t    ON src_t.transaction_journal_id = tj.id
          AND src_t.amount < 0 AND src_t.deleted_at IS NULL
        JOIN accounts src_a        ON src_t.account_id = src_a.id
        JOIN account_types src_at  ON src_a.account_type_id = src_at.id
          AND src_at.type IN ('Asset account', 'Cash account')
        JOIN transactions dst_t    ON dst_t.transaction_journal_id = tj.id
          AND dst_t.amount > 0 AND dst_t.deleted_at IS NULL
        JOIN accounts dst_a        ON dst_t.account_id = dst_a.id
        JOIN account_types dst_at  ON dst_a.account_type_id = dst_at.id
          AND dst_at.type IN ('Asset account', 'Cash account')
        WHERE tj.deleted_at IS NULL
          AND src_a.id != dst_a.id
        ORDER BY tj.date, tj.id
    """)
    print(f"      {len(transfers)} trasferimenti trovati")

    # ── 6. Costruisci righe transazioni ───────────────────────
    tx_rows = []

    for row in withdrawals:
        acc_id = acc_map.get(row["acc_id"])
        if not acc_id:
            continue
        cat_id = cat_map.get(null_or_val(row.get("cat_id")), no_cat_id)
        amount = float(row["amount"])
        tx_rows.append(
            f"('{new_id()}', '{MONETO_USER_ID}', '{acc_id}', '{cat_id}', "
            f"{amount:.2f}, 'expense', {esc(row['description'])}, '{row['date']}')"
        )

    for row in deposits:
        acc_id = acc_map.get(row["acc_id"])
        if not acc_id:
            continue
        cat_id = cat_map.get(null_or_val(row.get("cat_id")), no_cat_id)
        amount = float(row["amount"])
        tx_rows.append(
            f"('{new_id()}', '{MONETO_USER_ID}', '{acc_id}', '{cat_id}', "
            f"{amount:.2f}, 'income', {esc(row['description'])}, '{row['date']}')"
        )

    for row in transfers:
        src_id = acc_map.get(row["src_id"])
        dst_id = acc_map.get(row["dst_id"])
        if not src_id or not dst_id:
            continue
        amount = float(row["amount"])
        desc = esc(row["description"])
        date = row["date"]
        # Uscita dal conto sorgente
        tx_rows.append(
            f"('{new_id()}', '{MONETO_USER_ID}', '{src_id}', '{transfer_cat_id}', "
            f"{amount:.2f}, 'expense', {desc}, '{date}')"
        )
        # Entrata nel conto destinazione
        tx_rows.append(
            f"('{new_id()}', '{MONETO_USER_ID}', '{dst_id}', '{transfer_cat_id}', "
            f"{amount:.2f}, 'income', {desc}, '{date}')"
        )

    total_tx = len(tx_rows)
    print(f"\n      Totale transazioni da inserire: {total_tx}")

    # ── 6. Esegui SQL ─────────────────────────────────────────
    print("\n[6/6] Eseguo importazione nel DB Moneto...")

    # PostgreSQL non accetta un unico INSERT con migliaia di righe senza problemi,
    # ma per ~1400 righe va benissimo in un blocco unico.
    sql = f"""
BEGIN;

-- Pulizia dati esistenti dell'utente (transazioni = 0, sicuro)
DELETE FROM transactions WHERE user_id = '{MONETO_USER_ID}';
DELETE FROM accounts    WHERE user_id = '{MONETO_USER_ID}';
DELETE FROM categories  WHERE user_id = '{MONETO_USER_ID}';

-- Account
INSERT INTO accounts (id, user_id, name, icon, color, balance, currency, is_active)
VALUES
{',\n'.join(acc_rows)};

-- Categorie
INSERT INTO categories (id, user_id, name, icon, color, type, is_default, is_active)
VALUES
{',\n'.join(cat_rows)};

-- Transazioni
INSERT INTO transactions (id, user_id, account_id, category_id, amount, type, note, date)
VALUES
{',\n'.join(tx_rows)};

-- Ricalcola saldi account dalle transazioni importate
UPDATE accounts a
SET balance = (
    SELECT COALESCE(
        SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END),
        0
    )
    FROM transactions t
    WHERE t.account_id = a.id
)
WHERE a.user_id = '{MONETO_USER_ID}';

COMMIT;
"""

    mn_exec(sql)

    # ── Report finale ─────────────────────────────────────────
    print("\n" + "=" * 55)
    print("  ✓ Migrazione completata")
    print("=" * 55)

    print(mn_query(f"""
SELECT tipo, totale FROM (
  SELECT 'Account importati'    AS tipo, COUNT(*)::text AS totale, 1 AS ord FROM accounts    WHERE user_id = '{MONETO_USER_ID}'
  UNION ALL
  SELECT 'Categorie importate',                 COUNT(*)::text, 2 FROM categories WHERE user_id = '{MONETO_USER_ID}'
  UNION ALL
  SELECT 'Transazioni importate',               COUNT(*)::text, 3 FROM transactions WHERE user_id = '{MONETO_USER_ID}'
  UNION ALL
  SELECT '  di cui spese',                      COUNT(*)::text, 4 FROM transactions WHERE user_id = '{MONETO_USER_ID}' AND type = 'expense'
  UNION ALL
  SELECT '  di cui entrate',                    COUNT(*)::text, 5 FROM transactions WHERE user_id = '{MONETO_USER_ID}' AND type = 'income'
) x ORDER BY ord;
"""))

    print("\nSaldi per conto:")
    print(mn_query(f"""
SELECT name, icon, TO_CHAR(balance, 'FM€999,999,990.00') AS saldo
FROM accounts
WHERE user_id = '{MONETO_USER_ID}'
ORDER BY balance DESC;
"""))


if __name__ == "__main__":
    main()

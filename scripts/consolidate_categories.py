#!/usr/bin/env python3
"""
Consolidamento categorie: riduce le 55 categorie importate da Firefly III
(troppo granulari) a un set più ampio e coerente di 21 categorie.

Per ogni gruppo:
  1. la categoria "target" viene rinominata/ricolorata/re-iconizzata
  2. le transazioni delle categorie "accorpate" vengono riassegnate al target
  3. le categorie accorpate vengono eliminate

Nessuna transazione viene persa: il totale (1.348) resta invariato, vengono
solo riassegnate. Tutto avviene in un'unica transazione SQL.

Uso: python3 scripts/consolidate_categories.py
"""

import subprocess
import sys

MN_CTR  = "moneto-db-1"
MN_USER = "moneto"
MN_DB   = "monetodb"


def mn_exec(sql: str) -> str:
    """Esegue SQL su Moneto PostgreSQL (in una transazione, ON_ERROR_STOP)."""
    r = subprocess.run(
        ["docker", "exec", "-i", MN_CTR, "psql",
         "-U", MN_USER, "-d", MN_DB, "-v", "ON_ERROR_STOP=1", "-q"],
        input=sql, capture_output=True, text=True
    )
    if r.returncode != 0:
        print("ERRORE Moneto SQL:", r.stderr[:1000], file=sys.stderr)
        sys.exit(1)
    return r.stdout


def mn_query(sql: str) -> str:
    r = subprocess.run(
        ["docker", "exec", MN_CTR, "psql", "-U", MN_USER, "-d", MN_DB, "-c", sql],
        capture_output=True, text=True
    )
    return r.stdout


def esc(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


# ── Gruppi di consolidamento ────────────────────────────────────────────────────
# target_id: categoria che diventa la nuova categoria consolidata
# new: (name, icon, color)
# merge_ids: categorie le cui transazioni vengono spostate sul target, poi eliminate
GROUPS = [
    # ── Spese ──
    dict(
        target_id="79c83b59-5cbd-4b60-94ec-38aee3baebfd",  # Spesa Supermercato (217)
        new=("Spesa & Alimentari", "🛒", "#22c55e"),
        merge_ids=["81f688e2-b9eb-439c-bf26-8bcf0fc54795"],  # Spesa alimentare (11)
    ),
    dict(
        target_id="f31530e4-867c-41e8-91ec-1109a8229249",  # Ristoranti/Bar/Cene e Pranzi fuori (175)
        new=("Ristoranti & Bar", "🍕", "#ef4444"),
        merge_ids=["2eb94b00-9513-461c-80bd-736083fc4ba4"],  # Cibo da asporto (1)
    ),
    dict(
        target_id="bd5ae15a-919f-4af9-a2ee-4fef872a082d",  # Trasporti (...) (142)
        new=("Trasporti", "🚗", "#f97316"),
        merge_ids=["9f3e7c10-8ce2-4379-8658-4ea501074b8c"],  # Rate auto/moto (18)
    ),
    dict(
        target_id="1c54648a-0c28-45e2-ac4e-5ada65309f70",  # Riparazioni/Migliorie (16)
        new=("Casa", "🏠", "#eab308"),
        merge_ids=[
            "4606a1bd-2e07-4b65-8a41-bab25fc8a2a1",  # Condominio Roma / Riscaldamento (4)
            "dfc6069b-e420-4308-89f4-bf1c33eba3f3",  # Elettrodomestici (3)
            "440873b4-34c6-48f5-a9cb-ac4dc0cc6034",  # Arredamento (1)
            "ebbdf790-22f4-4569-bf0d-d11de564d667",  # Affitto/Mutuo (0)
        ],
    ),
    dict(
        target_id="14b777c8-e342-4cb3-8c01-c0fa1d99559c",  # Bollette (Luce, Gas, Acqua) (86)
        new=("Bollette & Utenze", "💡", "#fbbf24"),
        merge_ids=["221a5d37-786e-4282-9701-0bda2cc345b5"],  # Internet/Telefono (73)
    ),
    dict(
        target_id="40845cde-a031-4f89-a6dc-4eeca5ea1b66",  # Viaggi/Vacanze (61)
        new=("Viaggi & Vacanze", "✈️", "#0ea5e9"),
        merge_ids=[],
    ),
    dict(
        target_id="f7b44846-4024-4cdc-9bd0-cd2c4617adec",  # Shopping (...) (53)
        new=("Shopping", "🛍️", "#ec4899"),
        merge_ids=["2a68c790-f2cc-4573-8383-5f12fe19618e"],  # Abbigliamento (1)
    ),
    dict(
        target_id="c1a2d2a3-18ba-41d5-8e26-a74b55137c40",  # Istruzione (...) (41)
        new=("Istruzione", "📖", "#a78bfa"),
        merge_ids=[
            "4a839705-d172-4e62-9ba2-4b366e537ff9",  # Corsi online/offline (1)
            "f061b941-4b49-488e-9e7e-228257cf16b3",  # Conferenze/Seminari (0)
            "efe904d8-8e40-4249-9c6f-26e6a20a44bf",  # Libri di testo/Materiale didattico (0)
        ],
    ),
    dict(
        target_id="5c972542-cf19-4e47-87d9-678f00cb1d49",  # Abbonamenti (...) (40)
        new=("Abbonamenti", "📱", "#06b6d4"),
        merge_ids=[],
    ),
    dict(
        target_id="ee38b09e-f395-45d2-9a0d-fa73b9c4a1c8",  # Assicurazioni (...) (13)
        new=("Assicurazioni", "🛡️", "#64748b"),
        merge_ids=[],
    ),
    dict(
        target_id="d9d3bdd8-6e22-4a05-bd55-48c8bf46ec58",  # Spese Sanitarie (9)
        new=("Salute", "🏥", "#10b981"),
        merge_ids=[
            "e8733c5a-58ef-441f-bd63-a21a96da565b",  # Farmaci (4)
            "731d1d9c-6d92-4815-ad3f-92d2f80ce183",  # Visite mediche (1)
            "b54e676f-b024-4391-b9c5-a94a3b111f1e",  # Ausili medici (1)
            "dc099d72-d220-4505-8808-abff195ae19c",  # Cure estetiche (0)
        ],
    ),
    dict(
        target_id="1e0ef935-733e-4033-ac73-28e9eea78f9c",  # Intrattenimento (Cinema, Concerti, Eventi) (8)
        new=("Intrattenimento & Tempo libero", "🎭", "#8b5cf6"),
        merge_ids=[
            "78b1ceb0-2e71-4a43-bf88-4e65cb7de2c7",  # Sport (4)
            "ec3286a6-136c-4380-9f78-e373052420ae",  # Hobby (2)
            "c4e76c95-4561-430b-a2ee-dd35b3c022e5",  # Games (1)
        ],
    ),
    dict(
        target_id="1612f5e2-e47c-4430-94d0-17b5b0478166",  # Accessori per animali (4)
        new=("Animali", "🐾", "#84cc16"),
        merge_ids=[
            "b6eae2a6-58a7-47b5-ba79-90bfb84e5fab",  # Spese Veterinarie (4)
            "43d3b587-38f8-4d11-a9ec-25a74111e531",  # Cibo per animali (3)
            "fd0c1d37-891c-40c5-ab15-6d9d27a00bea",  # Visite veterinarie (2)
        ],
    ),
    dict(
        target_id="352ddbcf-f418-4173-babd-63d127572829",  # Risparmi (Conto deposito, Fondi di emergenza) (3)
        new=("Risparmi & Investimenti", "💰", "#14b8a6"),
        merge_ids=["4a55e2ff-baea-4ce6-8302-d2621936e1f2"],  # Investimenti (Azioni, ETF, Crypto) (0)
    ),
    dict(
        target_id="e6ca93b1-76b1-48c6-805f-b2b15ae4ef33",  # Trasferimento (156)
        new=("Trasferimento", "🔄", "#94a3b8"),
        merge_ids=["54c58b90-10ff-4a02-9fa5-95c1ac4cc06d"],  # Contanti (1)
    ),
    dict(
        target_id="e8fdf771-146c-48bd-ba46-f7b5357f0a58",  # Varie (104)
        new=("Varie", "📦", "#71717a"),
        merge_ids=[
            "e51ca46d-18c3-4f85-9b5d-e92e93541f5b",  # Multa (2)
            "05048c98-e4d2-4dee-be17-1eab263cfb0e",  # Baby Sitter (1)
            "abd6e41d-98af-4b70-9018-fbf157da8986",  # Carte di credito (0)
            "29036511-9392-4b41-b2a0-305ba9693349",  # Regali (14)
            "edce6c57-9a52-4b73-8fa6-ec1e39fcc52e",  # Donazioni (Carità, Crowdfunding) (3)
            "af41bca2-8991-4f3e-9ab9-bc40e3407e87",  # Beneficenza (2)
        ],
    ),

    # ── Entrate ──
    dict(
        target_id="8c9c9a50-42b3-45cd-a650-207564fef7ee",  # Stipendio (43)
        new=("Stipendio", "💼", "#22c55e"),
        merge_ids=["64f7d95d-70f8-4e29-ab1e-3cee58d6af3f"],  # Bonus (0)
    ),
    dict(
        target_id="24d0a672-eeb8-4978-abe3-cc3952839fe3",  # Rimborso (2)
        new=("Rimborsi", "💸", "#10b981"),
        merge_ids=["d2ca6b99-3548-450f-88b7-bc836b0cc817"],  # Rimborso prestiti (1)
    ),
    dict(
        target_id="6ef0edf9-b290-42dd-861b-f2bc7453a457",  # Interessi (1)
        new=("Investimenti", "📈", "#f59e0b"),
        merge_ids=["50fa3abf-593c-45f0-90c0-1b8e9be9cae3"],  # Redditi da investimenti (0)
    ),
    dict(
        target_id="6ff043cc-592b-4905-9d84-2955f6f4bf80",  # Regali ricevuti (0)
        new=("Regali ricevuti", "🎁", "#f472b6"),
        merge_ids=[],
    ),
    dict(
        target_id="9822b6a1-78a2-4112-8c3b-2d79c5f22306",  # Inps (1)
        new=("Altre entrate", "💰", "#6366f1"),
        merge_ids=["12b67c00-c801-43cc-b5f3-56c2d1c7d8d3"],  # Oliveto (1)
    ),
]


def main():
    print("── Prima ──")
    print(mn_query("SELECT COUNT(*) AS categorie, (SELECT COUNT(*) FROM transactions) AS transazioni FROM categories;"))

    sql_parts = ["BEGIN;"]
    for g in GROUPS:
        name, icon, color = g["new"]
        sql_parts.append(
            f"UPDATE categories SET name={esc(name)}, icon={esc(icon)}, color={esc(color)} "
            f"WHERE id = '{g['target_id']}';"
        )
        if g["merge_ids"]:
            ids_list = ", ".join(f"'{i}'" for i in g["merge_ids"])
            sql_parts.append(
                f"UPDATE transactions SET category_id = '{g['target_id']}' "
                f"WHERE category_id IN ({ids_list});"
            )
            sql_parts.append(f"DELETE FROM categories WHERE id IN ({ids_list});")
    sql_parts.append("COMMIT;")

    mn_exec("\n".join(sql_parts))

    print("── Dopo ──")
    print(mn_query("SELECT COUNT(*) AS categorie, (SELECT COUNT(*) FROM transactions) AS transazioni FROM categories;"))
    print(mn_query(
        "SELECT type, name, icon, color, "
        "(SELECT COUNT(*) FROM transactions t WHERE t.category_id = c.id) AS tx "
        "FROM categories c ORDER BY type, tx DESC;"
    ))


if __name__ == "__main__":
    main()

import csv
import hashlib
import io
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Literal


def decode_csv_bytes(raw: bytes) -> str:
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("latin-1", errors="replace")


def parse_italian_amount(s: str) -> Decimal:
    s = s.strip().replace(".", "").replace(",", ".")
    return Decimal(s)


def parse_italian_date(s: str) -> date:
    return datetime.strptime(s.strip(), "%d/%m/%Y").date()


# Liste ordinate: (sottostringa da cercare in maiuscolo, nome categoria, tipo opzionale)
CATEGORY_KEYWORDS: list[tuple[str, str, Literal["income", "expense"] | None]] = [
    ("FARMACIA", "Salute", None),
    ("CENTRO VET", "Animali", None),
    ("SUPER ELITE TRADING", "Spesa & Alimentari", None),
    ("PENNY MARKET", "Spesa & Alimentari", None),
    ("IPER TRISCOUNT", "Spesa & Alimentari", None),
    ("RISTORANTE", "Ristoranti & Bar", None),
    ("BAR ", "Ristoranti & Bar", None),
    ("MCDONALD", "Ristoranti & Bar", None),
    ("MASCI CAFFE", "Ristoranti & Bar", None),
    ("BK PORTA", "Ristoranti & Bar", None),
    ("AUTOGRILL", "Ristoranti & Bar", None),
    ("FINGER'S", "Ristoranti & Bar", None),
    ("AMAZON", "Shopping", None),
    ("AMZN", "Shopping", None),
    ("BNZ-", "Trasporti", None),
    ("ADR MOBILITY", "Trasporti", None),
    ("CA AUTO BANK", "Trasporti", None),
    ("RCI BANQUE", "Trasporti", None),
    ("VIVIGAS", "Bollette & Utenze", None),
    ("FASTWEB", "Bollette & Utenze", None),
    ("ADDEBITO CANONE", "Bollette & Utenze", None),
    ("VERISURE", "Casa", None),
    ("DISPOSIZIONE", "Casa", None),
    ("TESLA INC", "Abbonamenti", None),
    ("APPLE.COM", "Abbonamenti", None),
    ("STIPENDIO", "Stipendio", "income"),
    ("BONIF. V/FAV", "Altre entrate", "income"),
    ("INPS", "Altre entrate", "income"),
    ("ATM-", "Varie", None),
    ("BANCOMAT", "Varie", None),
    ("PRELIEVO", "Varie", None),
]


def suggest_category_name(description: str, tx_type: str) -> str | None:
    upper = description.upper()
    for keyword, category_name, required_type in CATEGORY_KEYWORDS:
        if required_type is not None and required_type != tx_type:
            continue
        if keyword in upper:
            return category_name
    return None


def compute_import_hash(account_id: str, tx_date: date, amount: Decimal, description: str) -> str:
    normalized = f"{account_id}|{tx_date.isoformat()}|{amount}|{description.strip().upper()}"
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


@dataclass
class ParsedRow:
    date: date
    description: str
    amount: Decimal
    type: Literal["income", "expense"]
    currency: str


def parse_mediobanca_csv(text: str) -> tuple[list[ParsedRow], list[str]]:
    rows: list[ParsedRow] = []
    warnings: list[str] = []

    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    for i, raw_row in enumerate(reader, start=2):  # riga 1 è l'header
        try:
            date_str = (raw_row.get("Data contabile") or "").strip() or (raw_row.get("Data valuta") or "").strip()
            entrate = (raw_row.get("Entrate") or "").strip()
            uscite = (raw_row.get("Uscite") or "").strip()
            description = (raw_row.get("Tipologia") or "").strip()
            currency = (raw_row.get("Divisa") or "EUR").strip()

            if not date_str:
                warnings.append(f"Riga {i}: data mancante, riga ignorata")
                continue

            if entrate and uscite:
                warnings.append(f"Riga {i}: entrambe le colonne Entrate e Uscite sono compilate, riga ignorata")
                continue
            if not entrate and not uscite:
                warnings.append(f"Riga {i}: nessun importo trovato, riga ignorata")
                continue

            tx_date = parse_italian_date(date_str)
            if entrate:
                amount = parse_italian_amount(entrate)
                tx_type: Literal["income", "expense"] = "income"
            else:
                amount = parse_italian_amount(uscite)
                tx_type = "expense"
            amount = abs(amount)

            rows.append(ParsedRow(date=tx_date, description=description, amount=amount, type=tx_type, currency=currency))
        except (ValueError, InvalidOperation) as exc:
            warnings.append(f"Riga {i}: impossibile interpretare la riga ({exc}), riga ignorata")
            continue

    return rows, warnings

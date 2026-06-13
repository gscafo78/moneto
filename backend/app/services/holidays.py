from datetime import date, timedelta

IT_HOLIDAYS_FIXED = {
    (1, 1),    # Capodanno
    (1, 6),    # Epifania
    (4, 25),   # Liberazione
    (5, 1),    # Festa dei lavoratori
    (6, 2),    # Festa della Repubblica
    (8, 15),   # Ferragosto
    (11, 1),   # Tutti i Santi
    (12, 8),   # Immacolata
    (12, 25),  # Natale
    (12, 26),  # Santo Stefano
}


def easter_sunday(year: int) -> date:
    """Calcola la data di Pasqua (algoritmo di Gauss / Anonymous Gregorian)."""
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def easter_monday(year: int) -> date:
    return easter_sunday(year) + timedelta(days=1)


def is_holiday(d: date) -> bool:
    if d.weekday() >= 5:  # sabato/domenica
        return True
    if (d.month, d.day) in IT_HOLIDAYS_FIXED:
        return True
    if d == easter_monday(d.year):
        return True
    return False


def next_business_day(d: date) -> date:
    while is_holiday(d):
        d += timedelta(days=1)
    return d

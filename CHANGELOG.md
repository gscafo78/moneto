# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.1] — 2026-08-20
### Fixed
- Corretto il foglio di dettaglio/modifica transazione che si deformava e sbordava dallo schermo su mobile dopo aver inserito una nota: i campi di testo (note, data e altri input dei fogli) avevano font-size sotto i 16px, soglia che fa scattare lo zoom automatico della pagina su iOS/Chrome; portati a 16px per evitarlo.
- Aggiunto scroll interno al foglio di dettaglio transazione quando il contenuto (es. nota lunga) supera l'altezza disponibile, invece di traboccare fuori dal riquadro.

---

## [1.0.0] — 2026-06-22
### Added
- Started formal version tracking (Moneto was already in production).

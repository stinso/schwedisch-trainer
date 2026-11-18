# Svenska varje dag 🇸🇪

Ein täglicher Schwedisch-Trainer für Deutschsprachige – mit Fokus auf **Sprechen und Hören** zu konkreten Themen, dazu Wortschatz und Grammatik aus den eigenen Fehlern.

*A daily Swedish trainer for German speakers, built as a [claude.ai Artifact](https://claude.ai). UI language: German.*

## Funktionen

- **Einstufung** – kurzer Test, der dein Niveau (A1–C1) bestimmt.
- **Heute** – Tagesplan mit Streak und Wochenübersicht.
- **Gespräch** – Claude unterhält sich mit dir auf Schwedisch zu einem Thema deines Niveaus; du sprichst (🎤) oder tippst.
  - ✏️ Korrektur pro Antwort, nur wenn du sie aufklappst
  - 💡 „Wie sagt man…?“ – Deutsch eingeben, schwedische Formulierung bekommen
  - 🎭 Rollenspiele mit Ziel (z. B. Zug umbuchen) und Auswertung am Ende
- **Hören** – Dialoge mit zwei Stimmen, langsam oder normal, mit Verständnisfragen.
- **Nachsprechen** – Satz hören, nachsprechen, Wort-für-Wort-Abgleich und Aussprachetipps.
- **Wiederholen** – eigene Fehler und fehlende Wörter als Karteikarten (Leitner-System).
- **Grammatik** – Mini-Lektion zur Regel hinter deinen häufigsten Fehlern.
- **Fortschritt** – Minuten, häufige Fehler, durchsuchbarer Wortschatz.

## Wie es funktioniert

Die App ist eine statische Seite (`index.html` + ES-Module in `js/`, ohne Build-Schritt und ohne Abhängigkeiten). Sie läuft als **claude.ai Artifact** und nutzt dessen Laufzeit-Fähigkeiten über `window.claude.use(...)`:

| Fähigkeit | Wofür |
|-----------|-------|
| `sample` | Claude als Gesprächspartner, Korrektur, Übungen, Auswertung |
| `tts` | Schwedisch vorlesen |
| `dictation` | Spracheingabe (Chrome / Claude-Desktop-App) |
| `db` + `user` | Lernstand pro Person unter `data/users/<id>/` |

Außerhalb von claude.ai fehlen diese Fähigkeiten – die Seite lädt dann, kann aber nichts Sinnvolles tun.

## Eigene Kopie veröffentlichen

Am einfachsten mit [Claude Code](https://claude.com/claude-code): Repo klonen und Claude bitten, es als Artifact zu veröffentlichen – `index.html` als Seite, alle Dateien unter `js/` als zusätzliche Dateien, mit den Fähigkeiten `sample`, `tts`, `dictation`, `db` und `user`. Die Kopie gehört dann dir und speichert deinen Lernstand in deinem Konto.

## Entwicklung

```sh
npm test   # Node 22+, keine Abhängigkeiten
```

- `js/` – Logik (Wiederholung, Prompts, Sprache, Speicher) und `js/views/` – die Seiten
- `tests/` – Unit-Tests für die Logik
- `dev/` – Mock der claude.ai-Laufzeit und ein Klick-Test für die lokale Prüfung (wird nicht veröffentlicht)
- `design.md`, `docs/plans/` – Entwurf und Umsetzungsplan

## Lizenz

[MIT](LICENSE)

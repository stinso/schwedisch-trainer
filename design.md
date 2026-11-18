# Schwedisch-Trainer – Design

Stand: 2026-11-18

## Worum es geht

Eine private Übungsseite auf claude.ai (Artifact) für tägliches Schwedischlernen, etwa 10–20 Minuten pro Tag. Herkömmlichen Apps fehlt genau das, was der Nutzer am meisten will: **zu bestimmten Themen Schwedisch sprechen und hören**. Vokabeln und Grammatik sind ebenfalls wichtig, sie unterstützen das Sprechen. Hauptgerät ist der Rechner mit Chrome, Oberflächensprache ist Deutsch.

## Ziele

- Themen-Gespräche mit Claude: Claude spricht Schwedisch (vorgelesen), der Nutzer antwortet per Mikrofon.
- Hörverstehen zu Themen, mit einstellbarem Tempo.
- Vokabeln und Grammatik entstehen aus den eigenen Lücken und Fehlern und werden gezielt wiederholt.
- Einstufung des Niveaus (GER A1–C1) beim ersten Start. Danach passt sich alles an das Niveau an.
- Bequem: keine Installation, kein API-Key, keine Zusatzkosten. Läuft über das Claude-Konto des Nutzers.

## Nicht-Ziele

- Läuft nicht lokal bzw. offline (bewusst so entschieden: Bequemlichkeit geht vor).
- Keine vollwertige Handy-Version. Auf dem Handy darf es eingeschränkt funktionieren (Tippen statt Sprechen, ggf. ohne Vorlesen).
- Keine Mehrbenutzer-Funktionen, keine Ranglisten, kein Teilen.
- Keine Aussprachebewertung auf Lautebene (die Spracherkennung liefert nur Text).

## Anti-Ziele (wäre ein Misserfolg, selbst wenn es technisch funktioniert)

- Es fühlt sich an wie eine weitere Vokabel-Drill-App: Karteikarten im Mittelpunkt, Sprechen nur als Beiwerk.
- Ständige Korrekturen würgen den Gesprächsfluss ab.
- Das Niveau passt nicht: zu schwer, dann frustrierend, zu leicht, dann langweilig.
- Der Fortschritt geht verloren.

## Rahmenbedingungen

- Plattform: claude.ai-Artifact mit diesen Runtime-Fähigkeiten:
  - `sample`: Claude erzeugt Gesprächszüge, Korrekturen, Übungen und Einstufung.
  - `tts`: Vorlesen. Sprache `sv` setzen. Nicht in Safari/Firefox/Mobil-Apps und nicht im Artifacts-Pane des Code-Tabs, daher im Chrome-Tab öffnen. Es gibt ein Stundenkontingent.
  - `dictation`: Spracheingabe per `start({language: "sv"})`. Nur Chrome bzw. das Desktop-App-Hauptfenster. Muss direkt aus einem Klick heraus starten.
  - `db` + `user`: dauerhafte, private Daten pro Nutzer unter `data/users/<id>/`.
- **Offenes Risiko:** Ob Schwedisch von Spracherkennung und Vorlesen unterstützt wird, zeigt sich erst zur Laufzeit (`start` kann `unavailable` liefern, `tts.languages()` prüfen). Deshalb muss jede Sprechstelle eine **Tipp-Alternative** haben, und jeder vorgelesene Text muss auch einblendbar sein. Das wird beim ersten Test sofort geprüft.
- `sample` ist gedächtnislos: Jeder Aufruf schickt Anweisungen, Niveau, Gesprächsverlauf und Antwortformat mit.

## Erwogene Ansätze

1. Claude-App mit hochgeladenem Skill. Bequem, aber nur Chat und kein strukturiertes Üben.
2. **Artifact auf claude.ai mit Claude, Vorlesen, Diktat und Datenbank: gewählt.** Am bequemsten, voll interaktiv, ohne Kosten oder Installation. Liegt nicht lokal.
3. Mischform, bei der Claude Code Tageslektionen als Dateien erzeugt und eine lokale Seite sie anzeigt. Lokal und kostenlos, aber ohne Live-Gespräch im Browser.
4. Lokale Web-App mit API-Key. Interaktiv, aber mit Kosten und Key-Verwaltung.
5. Lokale Web-App mit Server über das Claude-Abo (Agent SDK). Am aufwendigsten.
6. Anki-Deck. Nur Vokabeln.

Gewählt wurde Nr. 2, weil dem Nutzer Bequemlichkeit wichtiger ist als „lokal“.

Speicherung: in der `db`-Fähigkeit statt im Artifact selbst. Vokabel- und Fehlerlisten wachsen, sind privat und werden pro Datensatz aktualisiert. (Entscheidung von Claude.)

## Entschiedene Teile

### Einstufung (erster Start)
Kurzer, sich anpassender Test, ca. 5–8 Minuten: Hörverstehen (vorgelesener Satz → was bedeutet das?), Leseverstehen und freies Antworten (gesprochen oder getippt) auf steigendem Niveau. Claude schätzt daraus ein GER-Niveau samt Begründung. Der Nutzer kann es manuell korrigieren und den Test später wiederholen.

### Startseite (Heute)
Ein Vorschlag für heute: kurz Wiederholung der fälligen Einträge, dann ein Gespräch, optional eine Hörübung. Dazu gibt es Streak bzw. Tage geübt und das aktuelle Niveau. Jedes Modul lässt sich auch direkt anwählen.

### Themen-Gespräch (Herzstück)
- Thema wählen: Vorschläge passend zum Niveau (z. B. Café, Arbeit, Wochenende, Reisen, Wohnung) oder ein eigenes Thema eintippen.
- Claude eröffnet auf Schwedisch, der Text wird vorgelesen. Der Nutzer antwortet per Mikro-Taste oder tippt.
- Claude antwortet natürlich, auf dem Niveau des Nutzers, und hält das Gespräch am Laufen.
- **Feedback-Modell C (vom Nutzer gewählt):** Das Gespräch läuft ohne Unterbrechung. Neben jeder Nutzerantwort steht ein ✏️. Ein Klick zeigt die Korrektur: korrigierter Satz, kurze Erklärung auf Deutsch, natürlichere Formulierung.
- Claudes Text ist standardmäßig sichtbar und lässt sich ausblenden (Hörmodus). Es gibt einen „Nochmal vorlesen“-Knopf und einen Tempo-Regler.
- Ende auf Knopfdruck oder nach ca. 10 Minuten: **Auswertung** mit 3–5 wichtigsten Fehlern, besseren Formulierungen und neuen bzw. fehlenden Vokabeln. Diese wandern automatisch in die Wiederholung.

### Hörübung
Claude erzeugt zum Thema einen kurzen Dialog oder Text auf Niveau. Er wird mit verschiedenen Stimmen für die Sprecher vorgelesen, langsam oder normal. Der Text ist zunächst verborgen. Danach folgen 3–4 Verständnisfragen; die Antworten werden von Claude geprüft. Unbekannte Wörter lassen sich antippen und in die Wiederholung übernehmen.

### Wiederholung (Vokabeln & Grammatik)
- Inhalte stammen aus Gesprächen und Hörübungen: Vokabeln, die gefehlt haben, und die eigenen Fehler.
- Einfaches Abstandssystem (Leitner-artig): Richtige Antworten verlängern den Abstand, falsche setzen ihn zurück.
- Übungsarten: Deutsch → Schwedisch (sprechen oder tippen), vorgelesenes Schwedisch → Bedeutung, Lückensatz aus einem eigenen früheren Fehler.

### Fortschritt
Niveau, geübte Tage und Minuten, Zahl der gelernten Wörter, die häufigsten Fehlerarten. Etwa alle zwei Wochen schlägt die Seite eine Neueinstufung vor.

### Daten (privat pro Nutzer)
Unter `data/users/<id>/`: Profil (Niveau, Einstellungen), Vokabeln, Fehler, Sitzungen (Datum, Dauer, Thema, Auswertung). Gesprächsverläufe werden nur als Auswertung gespeichert, nicht als vollständiges Transkript. *(Entscheidung von Claude:)* Ein laufendes Gespräch wird zwischengespeichert, damit ein Neuladen nichts kaputt macht. Der Zwischenstand wird gelöscht, sobald die Auswertung gespeichert ist.

### Niveau über die Zeit *(Entscheidung von Claude)*
Das gespeicherte GER-Niveau ändert sich nur durch eine Neueinstufung oder eine manuelle Korrektur. Innerhalb des Niveaus wird die Schwierigkeit pro Sitzung leicht angepasst, je nachdem, wie es zuletzt lief.

## Dem Builder überlassen

- Visuelles Design und Layout (an artifact-design halten, hell/dunkel).
- Genaues Prompt-Design und JSON-Formate der `sample`-Aufrufe.
- Genaue Abstandsintervalle der Wiederholung, Themenliste pro Niveau.
- Wahl der Stimmen und Tempo-Standards.
- Umgang mit Rate-Limits und Fehlern im Rahmen der Capability-Verträge.

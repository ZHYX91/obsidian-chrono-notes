# Chrono Notes

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md) · [فارسی](README.fa.md) · [עברית](README.he.md) · [አማርኛ](README.am.md) · [हिन्दी](README.hi.md)

Chrono Notes ergänzt Obsidian um einen Kalender für periodische Notizen, Aufgaben, regionale Feiertage, lokale Kalendertermine und Notizen zu frei gewählten Zeiträumen.

## Funktionen

So sieht der Kalender auf Desktop und Android aus:

![Chrono Notes Kalender auf Desktop](../assets/chrono-notes-desktop-en.png)

![Chrono Notes Kalender auf Android](../assets/chrono-notes-android-en.png)

- Kalenderansichten für Woche, Monat, Jahr und Jahrhundert mit Notizstatus, Aufgaben, Vorschau und Statistiken.
- Tages-, Wochen-, Monats-, Quartals-, Jahres-, Jahrzehnt- und Jahrhundertnotizen mit eigenen Pfaden und Vorlagen, auch mit Templater.
- Notiznavigation, Aufgabenfortschritt, Heatmaps und Notizen für einen ausgewählten Datumsbereich.
- Erweiterbare Kalender: chinesischer Mondkalender, Ganzhi, persischer, äthiopischer, hebräischer, indischer und islamischer Kalender sowie Feiertage für China und Singapur.
- Lokale ICS-Kalenderdateien werden ausschließlich gelesen. Datums- und Uhrzeitanzeigen von Obsidian-Eigenschaften lassen sich anpassen, ohne YAML-Werte zu verändern.

## Voraussetzungen und Kompatibilität

Obsidian 1.12.7 oder neuer auf Desktop oder Mobilgeräten. ICS-Dateien innerhalb des Vaults funktionieren plattformübergreifend; Pfade außerhalb des Vaults werden nur auf dem Desktop unterstützt. Zusätzliche Kalendersysteme hängen von den Daten der Laufzeitumgebung ab.

## Installation

### Über Community-Plugins

In Obsidian **Einstellungen → Community-Plugins → Durchsuchen** öffnen, nach **Chrono Notes** suchen und **Installieren** und **Aktivieren** wählen.

### Manuell

Das Archiv `chrono-notes-<version>.zip` von [der aktuellen Version](https://github.com/ZHYX91/obsidian-chrono-notes/releases/latest) in `Vault/.obsidian/plugins/` entpacken. Darin liegt der Ordner `chrono-notes/` mit `main.js`, `manifest.json` und `styles.css`. Obsidian neu laden und das Plugin aktivieren.

### Upgrade

Eine vorhandene `data.json` sichern und behalten; nur die drei Programmdateien ersetzen. `data.json` nur löschen, wenn die Einstellungen absichtlich zurückgesetzt werden sollen.

## Verwendung

Hauptkalender, Monatsauswahl und Datumsdialoge verwenden immer den gregorianischen Kalender. Die Oberflächensprache ändert Monatsnamen und Ziffern, nicht das Kalendersystem. Zusätzliche Datumsinformationen wählst du über Kalendererweiterungen.

Stellen Sie in Chrono Notes die gewünschten Notizarten, Pfade und Vorlagen ein und öffnen Sie den Kalender über die Seitenleiste oder Befehlspalette. **Ein Klick wählt ein Datum aus, erstellt aber keine Notiz.** Mit einem Doppelklick oder Enter öffnen oder erstellen Sie die Notiz. Ein Rechtsklick öffnet das Datumsmenü. Sind ICS-Termine vorhanden, können Sie dort die vollständige Terminliste öffnen. Strg/Befehl-Klick oder Mittelklick öffnet die Notiz in einem neuen Tab. Kalendererweiterungen und ICS-Quellen lassen sich bei Bedarf in den Einstellungen aktivieren.

Auf einem Touchscreen öffnet langes Drücken auf ein Datum dessen Menü. Wählen Sie dort die Aktion zum Öffnen oder Erstellen der Tagesnotiz. Erscheint kein Menü, wird die Tagesnotiz beim Loslassen geöffnet oder erstellt. Langes Drücken auf einen Wochen-, Monats- oder anderen Periodeneintrag öffnet die zugehörige Notiz direkt.

### Aufgaben im Kalender

Ergänzen Sie eine Aufgabe in einer Notiz um ein Datumszeichen:

```markdown
- [ ] Wochenbericht abgeben 📅 2026-10-20
- [ ] Unterlagen vorbereiten 🛫 2026-10-18 ⏳ 2026-10-19 📅 2026-10-20
- [ ] Bericht prüfen ⏳ 2026-10-20 📅 2026-10-20
```

`🛫` steht für das Startdatum, `⏳` für das geplante Datum und `📅` für das Fälligkeitsdatum. Verwenden Sie das Format `YYYY-MM-DD`. Die Wochenansicht zeigt Aufgaben, deren Start-, Plan- oder Fälligkeitsdatum in die angezeigte Woche fällt. Eine Aufgabe erscheint an jedem ihrer unterschiedlichen Termine; mehrere Datumszeichen für denselben Tag ergeben nur einen Eintrag. Die letzte Beispielaufgabe erscheint also am 20. Oktober nur einmal. Aufgaben ohne Datum zählen weiterhin zum Aufgabenfortschritt ihrer Notiz.

Über die Auswahl des Fälligkeitsdatums in der Wochenansicht können Sie eine Frist auf einen anderen Tag derselben Woche verschieben. Auf dem Desktop können Sie eine Aufgabe mit Fälligkeitsdatum auch auf einen Tag ziehen. Beide Aktionen ändern das bereits vorhandene Fälligkeitsdatum in der ursprünglichen Notiz.

### Jahrzehnt- und Jahrhundertnotizen

Die Jahrhundertansicht zeigt zu jedem Jahrzehnt zwei Reihen mit je fünf Jahren. Bei wenig Platz wandert die Jahrzehntzelle über die Jahre. In sehr schmalen Bereichen oder bei großer Schrift werden die Jahre in zwei Spalten angezeigt. Felder für Jahre außerhalb des Jahrhunderts bleiben leer. Beim Öffnen wird das Jahrzehnt des ausgewählten Jahres sichtbar; „Dieses Jahrhundert“ führt zum aktuellen Jahrzehnt. Die Navigation bleibt beim Scrollen oben sichtbar.

Aktivieren Sie die entsprechenden Notiztypen in den Einstellungen und wechseln Sie in der Seitenleiste zur Jahrhundertansicht. Jahrzehnt und Jahrhundert haben eigene Zellen. Ein Klick wählt aus; Doppelklick oder Enter öffnet oder erstellt die Notiz. Strg/Befehl-Klick bzw. Mittelklick öffnet einen neuen Tab, auf Touchgeräten können Sie lange drücken. Die Zellen verwenden dieselben Statuspunkte, Aufgabenfortschritte und Vorschauen wie die Jahresansicht. Standardpfade sind `[diary]/DEC[s]` (2020s) für Jahrzehnte und `[diary]/[C]CEN` (C21) für Jahrhunderte.

Ein Jahrzehnt umfasst zum Beispiel 2020–2029, das 21. Jahrhundert die Jahre 2001–2100. `DEC` und `CEN` geben sprachunabhängige Ziffern aus. Verwenden Sie am besten entweder Jahrhundert- oder Jahrzehntordner: Die 2000er Jahre reichen über C20 und C21, doch die Jahrzehntnotiz liegt aufgrund des ersten Jahres 2000 in C20. Bestehende Notizen werden nicht verschoben.

Vorlagen nutzen dieselben Formate: `{{date:DEC[s]}}`, `{{date:[C]CEN}}`, `{{start:YYYY}}–{{end:YYYY}}`. Alle periodischen Vorlagen unterstützen Anfangs- und Enddatum sowie `{{days}}` inklusive beider Endtage. Die Notizeinstellungen zeigen die Platzhalter mit Beispielen und entsprechenden Templater-Ausdrücken; Allgemein → Vorlageneinstellungen erläutert die gemeinsamen Regeln.

### Zeitraumnotizen

Wählen Sie zuerst unter **Einstellungen → Chrono Notes → Zeitraumnotizen** einen Zielordner. Auf dem Desktop können Sie im Monatskalender vom Anfangsdatum zu einem anderen Enddatum ziehen, um eine Zeitraumnotiz zu erstellen. Alternativ wählen Sie die Aktion zum Erstellen einer Zeitraumnotiz im Datumsmenü oder in der Befehlspalette und geben die Daten ein. Eine neue Zeitraumnotiz muss mindestens zwei Kalendertage umfassen. Vertauschte Anfangs- und Enddaten werden automatisch in die richtige Reihenfolge gebracht.

Damit eine vorhandene Notiz im Kalender als Zeitraum erscheint, fügen Sie am Anfang der Markdown-Datei diese Eigenschaften ein:

```yaml
---
chrono-notes: interval
start: 2026-10-18
end: 2026-10-20
---
```

Verwenden Sie vollständige Daten im Format `YYYY-MM-DD`; das Anfangsdatum darf nicht nach dem Enddatum liegen. Die Anzeige schließt beide Tage ein. Vorhandene Notizen können auch vollständige ISO-Datumswerte mit Uhrzeit verwenden, mindestens mit Stunden und Minuten, oder einen Zeitraum innerhalb eines Tages beschreiben.

Eine Zeitraumnotiz braucht gültige Eigenschaften `start` und `end`. Von Chrono Notes erstellte Zeitraumnotizen erhalten zusätzlich `chrono-notes: interval` und werden im gesamten Vault erkannt.

Ohne die Eigenschaft `chrono-notes` wird eine Notiz nur im konfigurierten Suchbereich für unmarkierte Zeitraumnotizen erkannt. Steht in der Eigenschaft ein anderer Wert als `interval`, wird die Notiz ausgeschlossen. Bestehende Notizen werden nicht automatisch geändert.

## Einstellungen

Unter Allgemein findest du Anleitung und Problem melden. Beim Ändern einer Kalender- oder Feiertagserweiterung bleibt der aktuelle Reiter sichtbar und der Tastaturfokus beim gerade verwendeten Steuerelement.

Unter Allgemein Sprache, Wochenbeginn, Datumsanzeige und Vorlagen wählen. Unter Periodische Notizen die Dateipfade prüfen, bevor vorhandene Namen durch eine andere Pfadsprache nicht mehr gefunden werden. Darstellung, Aufgaben, Statistiken, Erweiterungen und Zeitraumnotizen haben eigene Einstellungsbereiche.

## Einschränkungen

- ICS-Dateien werden nur lokal gelesen; Online-Abonnements werden nicht direkt abgerufen. Pro Aktualisierung werden standardmäßig höchstens 32 Quellen gelesen. Weitere Quellen werden als ausgelassen gemeldet. Wiederkehrende Ereignisse mit `RRULE` oder `RDATE` werden ausgelassen und gezählt.
- Eingebettete Zeitzonen unterstützen ausdrücklich aufgeführte Umstellungstermine und eine begrenzte Auswahl jährlicher Regeln (`FREQ=YEARLY`). Ungültige, nicht unterstützte oder zu aufwendige Zeitzonendefinitionen führen dazu, dass die davon abhängigen Termine ausgelassen und gemeldet werden. Die unterstützten Regeln und Grenzen sind in der [Dokumentation zu Kalender- und Zeitgrenzen](../calendar-boundaries.en.md) auf Englisch beschrieben.
- Noch nicht offiziell veröffentlichte Feiertage werden nicht vorhergesagt. Zusätzliche Kalender ändern nur die Anzeige; Notiznamen, Datumsnavigation und Aufgabendaten verwenden weiterhin den gregorianischen Kalender. Erweiterungen ohne die nötigen Daten der Laufzeitumgebung werden ausgeblendet.

## Datenschutz und Sicherheit

Notizen, Aufgaben und lokale Kalenderdaten bleiben auf dem Gerät. Für Suche und Anzeige liest das Plugin relevante Markdown-Dateien im Vault und die ausdrücklich ausgewählten ICS-Dateien. Ein abgeleiteter Index wird lokal in IndexedDB gespeichert und kann neu erstellt werden. Es werden keine Dateien hochgeladen und kein Konto benötigt. Die Zwischenablage wird nur nach der Aktion „Datum kopieren“ beschrieben und niemals gelesen.

## Entwicklung

Für die Entwicklung sind Node.js 24.19.0 und npm 11.17.0 erforderlich. Mit `npm ci` die Abhängigkeiten installieren; `npm run check` führt die Projektprüfungen aus. Technische Details stehen in der [Architektur](../architecture.en.md) und der [Teststrategie](../testing-strategy.en.md).

## Hilfe

Für Fragen und Anregungen die [Diskussionen](https://github.com/ZHYX91/obsidian-chrono-notes/discussions) nutzen; reproduzierbare Fehler über [Issues](https://github.com/ZHYX91/obsidian-chrono-notes/issues/new/choose) melden. Sicherheitslücken nur [privat](https://github.com/ZHYX91/obsidian-chrono-notes/security/advisories/new) berichten. Keine privaten Vault-Pfade oder Notizinhalte veröffentlichen.

## Lizenz

[MIT](../../LICENSE) © ZhengYX

## Danksagung

Inspiriert von [Calendar](https://github.com/liamcain/obsidian-calendar-plugin) und [Dust Calendar](https://github.com/a-nano-dust/dust-obsidian-calendar).

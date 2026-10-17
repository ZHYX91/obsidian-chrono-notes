# Chrono Notes

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português](README.pt-BR.md) · [Русский](README.ru-RU.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md) · [فارسی](README.fa.md) · [עברית](README.he.md) · [አማርኛ](README.am.md) · [हिन्दी](README.hi.md)

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

Unter Chrono Notes die gewünschten Notizarten, Pfade und Vorlagen einstellen. Über die Seitenleiste oder Befehlspalette den Kalender öffnen. **Ein Klick wählt ein Datum aus, erstellt aber keine Notiz.** Zum Öffnen oder Erstellen doppelklicken oder Enter drücken; auf Touchgeräten lange drücken. Rechtsklick zeigt Datumsaktionen; Strg/Befehl-Klick oder Mittelklick öffnet einen neuen Tab. In den Einstellungen können ICS-Dateien, Kalendererweiterungen und Bereichsnotizen aktiviert werden.

### Jahrzehnt- und Jahrhundertnotizen

Die Jahrhundertansicht zeigt zu jedem Jahrzehnt zwei Reihen mit je fünf Jahren. Bei wenig Platz wandert die Jahrzehntzelle über die Jahre. Felder für Jahre außerhalb des Jahrhunderts bleiben leer. Beim Öffnen wird das Jahrzehnt des ausgewählten Jahres sichtbar; „Dieses Jahrhundert“ führt zum aktuellen Jahrzehnt. Die Navigation bleibt beim Scrollen oben sichtbar.

Aktivieren Sie die entsprechenden Notiztypen in den Einstellungen und wechseln Sie in der Seitenleiste zur Jahrhundertansicht. Jahrzehnt und Jahrhundert haben eigene Zellen. Ein Klick wählt aus; Doppelklick oder Enter öffnet oder erstellt die Notiz. Strg/Befehl-Klick bzw. Mittelklick öffnet einen neuen Tab, auf Touchgeräten können Sie lange drücken. Die Zellen verwenden dieselben Statuspunkte, Aufgabenfortschritte und Vorschauen wie die Jahresansicht. Standardpfade sind `[diary]/DEC[s]` (2020s) für Jahrzehnte und `[diary]/[C]CEN` (C21) für Jahrhunderte.

Ein Jahrzehnt umfasst zum Beispiel 2020–2029, das 21. Jahrhundert die Jahre 2001–2100. `DEC` und `CEN` geben sprachunabhängige Ziffern aus. Verwenden Sie am besten entweder Jahrhundert- oder Jahrzehntordner: Die 2000er Jahre reichen über C20 und C21, doch die Jahrzehntnotiz liegt aufgrund des ersten Jahres 2000 in C20. Bestehende Notizen werden nicht verschoben.

Vorlagen nutzen dieselben Formate: `{{date:DEC[s]}}`, `{{date:[C]CEN}}`, `{{start:YYYY}}–{{end:YYYY}}`. Alle periodischen Vorlagen unterstützen Anfangs- und Enddatum sowie `{{days}}` inklusive beider Endtage. Die Notizeinstellungen zeigen die Platzhalter mit Beispielen und entsprechenden Templater-Ausdrücken; Allgemein → Vorlageneinstellungen erläutert die gemeinsamen Regeln.

### Erkennung von Zeitraumnotizen

Eine Zeitraumnotiz braucht gültige Eigenschaften `start` und `end`. Von Chrono Notes erstellte Zeitraumnotizen erhalten zusätzlich `chrono-notes: interval` und werden im gesamten Vault erkannt.

Ohne die Eigenschaft `chrono-notes` wird eine Notiz nur im konfigurierten Suchbereich für unmarkierte Zeitraumnotizen erkannt. Steht in der Eigenschaft ein anderer Wert als `interval`, wird die Notiz ausgeschlossen. Bestehende Notizen werden nicht automatisch geändert.

## Einstellungen

Unter Allgemein Sprache, Wochenbeginn, Datumsanzeige und Vorlagen wählen. Unter Periodische Notizen die Dateipfade prüfen, bevor vorhandene Namen durch eine andere Pfadsprache nicht mehr gefunden werden. Darstellung, Aufgaben, Statistiken, Erweiterungen und Zeitraumnotizen haben eigene Einstellungsbereiche.

## Einschränkungen

ICS-Dateien sind schreibgeschützt; Online-Abonnements werden nicht direkt abgerufen. Pro Aktualisierung werden standardmäßig höchstens 32 Quellen gelesen; wiederkehrende Ereignisse mit `RRULE` oder `RDATE` werden gezählt, aber nicht aufgelöst. Noch nicht offiziell veröffentlichte Feiertage werden nicht vorhergesagt. Zusätzliche Kalender sind nur verfügbar, wenn die Laufzeitumgebung die nötigen Daten bereitstellt.

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

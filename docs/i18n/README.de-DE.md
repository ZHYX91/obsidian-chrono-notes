# Chrono Notes

__NAV__

Chrono Notes ergänzt Obsidian um einen Kalender für periodische Notizen, Aufgaben, regionale Feiertage, lokale Kalendertermine und Notizen zu frei gewählten Zeiträumen.

## Funktionen

- Kalenderansichten für Woche, Monat, Jahr und Jahrhundert mit Notizstatus, Aufgaben, Vorschau und Statistiken.
- Tages-, Wochen-, Monats-, Quartals-, Jahres-, Jahrzehnt- und Jahrhundertnotizen mit eigenen Pfaden und Vorlagen, auch mit Templater.
- Notiznavigation, Aufgabenfortschritt, Heatmaps und Notizen für einen ausgewählten Datumsbereich.
- Erweiterbare Kalender: chinesischer Mondkalender, Ganzhi, persischer, äthiopischer, hebräischer, indischer und islamischer Kalender sowie Feiertage für China und Singapur.
- Lokale ICS-Kalenderdateien werden ausschließlich gelesen. Datums- und Uhrzeitanzeigen von Obsidian-Eigenschaften lassen sich anpassen, ohne YAML-Werte zu verändern.

## Voraussetzungen und Kompatibilität

Obsidian 1.12.7 oder neuer auf Desktop oder Mobilgeräten. ICS-Dateien innerhalb des Vaults funktionieren plattformübergreifend; Pfade außerhalb des Vaults werden nur auf dem Desktop unterstützt. Zusätzliche Kalendersysteme hängen von den Daten der Laufzeitumgebung ab.

## Installation

**Über Community-Plugins:** In Obsidian **Einstellungen → Community-Plugins → Durchsuchen** öffnen, nach **Chrono Notes** suchen und **Installieren** und **Aktivieren** wählen.

**Manuell:** Das Archiv `chrono-notes-<version>.zip` von [der aktuellen Version](https://github.com/ZHYX91/obsidian-chrono-notes/releases/latest) in `Vault/.obsidian/plugins/` entpacken. Darin liegt der Ordner `chrono-notes/` mit `main.js`, `manifest.json` und `styles.css`. Obsidian neu laden und das Plugin aktivieren.

**Upgrade:** Eine vorhandene `data.json` sichern und behalten; nur die drei Programmdateien ersetzen. `data.json` nur löschen, wenn die Einstellungen absichtlich zurückgesetzt werden sollen.

## Verwendung

Unter Chrono Notes die gewünschten Notizarten, Pfade und Vorlagen einstellen. Über die Seitenleiste oder Befehlspalette den Kalender öffnen. **Ein Klick wählt ein Datum aus, erstellt aber keine Notiz.** Zum Öffnen oder Erstellen doppelklicken oder Enter drücken; auf Touchgeräten lange drücken. Rechtsklick zeigt Datumsaktionen; Strg/Befehl-Klick oder Mittelklick öffnet einen neuen Tab. In den Einstellungen können ICS-Dateien, Kalendererweiterungen und Bereichsnotizen aktiviert werden.

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

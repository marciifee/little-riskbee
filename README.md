# little-riskbee
![Little RiskBee – IT-Risikomanagement im Browser](./Little-RiskBee-GitHub-Banner.svg)

## Mit Docker Compose bereitstellen

Voraussetzung sind Docker und das Compose-Plugin (`docker compose version`). Apache liefert die vorhandenen HTML-, CSS- und JavaScript-Dateien sowie die Beispieldateien aus. Die Anwendung benötigt weder einen Build-Schritt noch eine Datenbank.

## Funktionen

| Bereich | Was die Seite macht |
|---|---|
| **Assets** | Systeme erfassen (Hostname, IP, OS, Rolle, Verantwortliche, Standort, Zweck), Bibliotheken je Asset zuordnen, Vorgehensweise (Basis / Standard / Kern) wählen. Import als CSV möglich. |
| **Schutzbedarf** | Vertraulichkeit, Integrität, Verfügbarkeit je Asset: normal / hoch / sehr hoch mit Begründung (BSI-Standard 200-2, Maximumprinzip). Steuert, ob H-Anforderungen erscheinen. |
| **Checkliste** | Maßnahmen interaktiv abarbeiten: Status (offen, umgesetzt, teilweise, nicht umgesetzt/Risiko, entbehrlich/gestrichen), Pflicht-Begründung beim Streichen, Notiz, Nachweis, Zuständigkeit, Termin, Prüfbefehle zum Kopieren, **Wirksamkeitskontrolle** (Ergebnis, Datum, Methode, Prüfer). Filter, Gruppierung, Massen-Streichung mit Begründung, eigene Maßnahmen. |
| **Bibliotheken** | Vergleich: Anzahl Maßnahmen je Bibliothek und Betriebssystem, Aufteilung B/S/H, abgedeckte Themen, Abdeckungsmatrix (18 Themen), Referenzzahlen der Originalquellen, Einordnung. |
| **Scans & Schwachstellen** | Je Asset alle importierten Scans mit Scan-Zeitpunkt aus dem Bericht, Importzeit, Dateiname und **SHA-256-Prüfsumme** als Nachweis. Je Befund: offen / teilweise behoben / behoben / Risiko akzeptiert / Fehlalarm + Begründung. Nicht mehr gefundene Befunde werden beim nächsten Scan automatisch als „behoben“ markiert; akzeptierte Risiken werden übernommen. |
| **Risikobewertung** | Alle offenen, teilweise behobenen und akzeptierten Befunde der aktuellsten Scans mit Risiko-ID (R-001 …), Zielobjekt, Bedrohung (Vorschläge aus den elementaren Gefährdungen G 0.x), Eintrittshäufigkeit × Schadenshöhe (4 × 4, in Anlehnung an BSI-Standard 200-3), Heatmap grün → gelb → orange → rot, Behandlung (vermeiden / reduzieren / übertragen / akzeptieren), Maßnahme, Risikoeigner, Termin. Der Status ist derselbe wie unter „Scans“ (beidseitig synchron). Unbewertete Befunde erhalten einen Vorschlag aus Schwere und Schutzbedarf. |
| **Projektrisiken, Chancen & SWOT** | Reiter „Chancen“ (Wahrscheinlichkeit × Nutzen, Strategien ausnutzen/verbessern/teilen/akzeptieren, eigene Matrix) und „SWOT-Analyse“ (Stärken, Schwächen, Chancen, Risiken + TOWS-Strategien; Übernahme aus Audit-Kennzahlen, Projektrisiken und Chancen). Reiter „Risiken“: Risikoanalyse des Härtungsprojekts: Risiko, Ursache, Kategorie, Eintrittswahrscheinlichkeit × Auswirkung (1–5) = Risikowert, Strategie, Gegenmaßnahmen, Frühwarnindikator, Zuständigkeit, Restrisiko nach Maßnahmen, Heatmaps vorher/nachher, Beispielrisiken als Startpunkt. |
| **Roadmap** | Priorisierte Liste (P1 sofort … P4 nächstes Audit) aus offenen Befunden, offenen Checklisten-Maßnahmen und Projektrisiken, mit Zuständigkeit, Termin, Überfällig-Markierung und CSV-Export. |
| **TOM-Übersicht** | Umsetzungsstand der technischen und organisatorischen Maßnahmen je Kategorie nach Art. 32 DSGVO (Übersicht und Bericht). |
| **Import** | Nmap (XML, -oG, -oN; Netzscans werden je Host auf die Assets verteilt, offene Ports als Liste), Lynis (report.dat, lynis.log), OpenVAS/Greenbone (XML, CSV), OpenSCAP (Results/ARF – setzt Checklisten-Status automatisch), SSG-Datastream/XCCDF (Profil wählbar: CIS, STIG, ANSSI, BSI …), Grundschutz++ (OSCAL JSON/XML), BSI-Kompendium (XML/Text), CSV, DAT, XML, JSON. |
| **Anleitungen** | Schritt-für-Schritt-Härtung: Vorgehen, Debian/Ubuntu, Fedora/RHEL, Windows Server/Windows 11, macOS, Scans & Nachweise – mit Befehlen und Verweisen in die Checkliste. |
| **Bericht** | DIN-A4-Hochformat-Bericht als eigenständige HTML-Datei (Stammdaten, Schutzbedarf, Kennzahlen, Maßnahmen inkl. Wirksamkeit, Abweichungen mit Begründung, Scans mit Hash, TOM-Übersicht, Risikobewertung mit Heatmap, Projektrisiken, Roadmap, Unterschriftenfeld). Drucken bzw. „Als PDF speichern“. |
| **Speichern** | Automatisch im Browser (IndexedDB, Fallback localStorage). Zusätzlich **💾 Speichern** bzw. `Strg+S` → JSON-Datei; **📂 Laden** stellt den Stand wieder her. |
| **Branding** | In den Einstellungen: Logo hochladen (PNG/JPG/WebP/SVG, lokal verkleinert), Abteilung, Anschrift, Kontakt, Webseite, Berichtstitel, Fußzeile/Einstufung und Akzentfarbe. Erscheint auf dem Berichtsdeckblatt, in Kopf-/Fußzeilen und optional im Kopf der Oberfläche. |
| **Darstellung** | Hell-/Dunkelmodus (automatisch oder manuell), responsiv für Desktop, Tablet und Smartphone, Deutsch/Englisch. |

## Bibliotheken

| Bibliothek | In der Seite | Hinweis |
|---|---|---|
| **BSI IT-Grundschutz-Kompendium Edition 2023** | eingebaut: SYS.1.1, SYS.1.2.3, SYS.1.3, SYS.2.1, SYS.2.2.3, SYS.2.3, SYS.2.4 (ohne entfallene Anforderungen) | Titel wörtlich, Beschreibungen sinngemäß gekürzt – maßgeblich ist der BSI-Originaltext. Weitere Bausteine: Kompendium (XML/Text) importieren. |
| **BSI Grundschutz++** | per Import (OSCAL) | Katalog aus dem BSI-GitHub-Repository „Stand-der-Technik-Bibliothek“ (CC BY-SA 4.0) importieren; Sicherheitsniveau (normal-SdT/erhöht), Aufwand und Modalverb werden ausgelesen. |
| **OpenSCAP SCAP Security Guide** | eingebaut: kuratierter Auszug (87 Regeln, echte Regel-IDs, BSI-Zuordnungen laut ComplianceAsCode) | Vollständige Profile per Datastream-Import. OpenSCAP-Ergebnisse setzen den Status automatisch. |
| **Microsoft Security Baseline** | eingebaut: kuratierte Auswahl | Volle Baseline: Security Compliance Toolkit. |
| **mSCP (macOS, NIST)** | eingebaut: kuratierte Auswahl | Regel-IDs können je macOS-Version abweichen. |
| **CIS, DISA STIG, ANSSI BP-028** | per Import (XCCDF bzw. SSG-Profile) | CIS ist für kommerzielle Nutzung lizenzpflichtig, daher nicht eingebaut. |
| **Eigene Maßnahmen** | in der Checkliste anlegen, z. B. aus Lynis-Vorschlägen | – |

## Datenschutz (DSGVO)

- Verarbeitung ausschließlich lokal im Browser. Im Docker-Betrieb liefert Apache die Anwendungsdateien aus. Importierte Befunde und Projektstände bleiben im Browser. Die Anwendung verwendet keine Cookies, Tracker, CDNs oder Webfonts.
- Eine Content-Security-Policy (`connect-src 'none'`) blockiert von der Anwendung initiierte Verbindungen über APIs wie Fetch, XMLHttpRequest oder WebSocket.
- Speicherung in IndexedDB/localStorage des Browsers und in selbst exportierten JSON-Dateien; Löschen über *Einstellungen → Alle lokalen Daten löschen*.
- Exporte und Berichte enthalten sicherheitskritische Informationen → vertraulich behandeln.

## Ordnerstruktur

```
compose.yaml            Optionale Bereitstellung mit Apache und Docker Compose
index.html              Einstieg
css/style.css           Layout, Hell/Dunkel, Responsive, Druck
js/i18n.js              Texte DE/EN
js/data/libraries.js    Betriebssysteme, Themen-Taxonomie, Bibliotheks-Metadaten
js/data/catalog-bsi.js  BSI-Anforderungen (Edition 2023)
js/data/catalog-ssg.js  OpenSCAP-SSG-Regeln
js/data/catalog-extra.js Microsoft Baseline, mSCP
js/data/guides.js       Anleitungen
js/storage.js           IndexedDB / localStorage / Datei-Export
js/parsers.js           Alle Importformate
js/report.js            A4-Bericht
js/risk.js              Risikobewertung, Projektrisiken, Roadmap, TOM
js/data/checks.js       Erweiterte Prüfbefehle (je Plattform/Distribution)
js/app.js               Oberfläche und Logik
samples/                Fiktive Beispieldateien zum Ausprobieren
```

## Quellen

- BSI IT-Grundschutz-Kompendium: https://www.bsi.bund.de (Edition 2023)
- BSI Grundschutz++ / Stand-der-Technik-Bibliothek: https://github.com/BSI-Bund/Stand-der-Technik-Bibliothek
- ComplianceAsCode / SCAP Security Guide: https://github.com/ComplianceAsCode/content
- Microsoft Security Baselines: https://learn.microsoft.com/windows/security/
- macOS Security Compliance Project: https://github.com/usnistgov/macos_security
- Lynis: https://cisofy.com/lynis/ · Nmap: https://nmap.org · Greenbone Community Edition: https://greenbone.github.io/docs/

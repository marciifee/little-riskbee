# little-riskbee
![Little RiskBee – IT-Risikomanagement im Browser](./Little-RiskBee-GitHub-Banner.svg)

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

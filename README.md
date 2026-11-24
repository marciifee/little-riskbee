# little-riskbee
![Little RiskBee – IT-Risikomanagement im Browser](./Little-RiskBee-GitHub-Banner.svg)

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

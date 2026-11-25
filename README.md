# little-riskbee
![Little RiskBee – IT-Risikomanagement im Browser](./Little-RiskBee-GitHub-Banner.svg)

### **IT-Risikomanagement, Systemhärtung und Business Continuity in einer lokalen Web-Anwendung.**

**Deutsch** | [English](README.en.md)

**Little RiskBee** unterstützt dich dabei, Windows-, Linux- und macOS-Systeme sowie organisatorische Zielobjekte zu erfassen, Sicherheitsmaßnahmen zu planen, Scan-Ergebnisse auszuwerten und Risiken revisionssicher zu dokumentieren.  
Die Oberfläche folgt dem **PDCA-Zyklus (Plan → Do → Check → Act)** und bietet ergänzende Werkzeuge für Business Continuity Management (BCM) und Pentest-Berichte.

Die Anwendung basiert rein auf HTML, CSS und JavaScript – ganz ohne npm, Build-Prozess, Datenbankinstallation oder Anwendungsserver. Du kannst sie direkt als lokale Datei im Browser öffnen oder über den mitgelieferten Docker-Container bereitstellen. Die Oberfläche lässt sich jederzeit zwischen Deutsch und Englisch umschalten (eigene und importierte Inhalte bleiben dabei unverändert).

> **Wichtiger Hinweis zur Datenspeicherung:** Alle Arbeitsdaten werden ausschließlich im jeweiligen Browserprofil gespeichert. Auch beim Betrieb über Docker verbleiben keine Daten im Container und es findet keine Synchronisation zwischen Personen oder Geräten statt. Regelmäßige JSON-Sicherungen sind daher ein fester Bestandteil des Arbeitsablaufs.

## Für wen ist Little RiskBee gedacht?

| Nutzerprofil | Typischer Einsatz |
| :--- | :--- |
| **IT-Admins mit Security-Schwerpunkt** | Server und Clients anhand von Härtungschecklisten prüfen und die Umsetzung lückenlos dokumentieren. |
| **Informationssicherheitsbeauftragte (ISB)** | Risiken priorisieren, Restrisiken nachvollziehen und die Wirksamkeit getroffener Maßnahmen überwachen. |
| **Compliance-Manager** | Kataloganforderungen und interne Vorgaben zusammenführen sowie belastbare Nachweise für Audits vorbereiten. |
| **Interne Auditoren** | Umsetzungsstände, Abweichungen und Wirksamkeitsnachweise je System nachvollziehen. |
| **Pentester** | Befunde aus abgeschlossenen Sicherheitsprüfungen strukturiert übergeben und deren Behebung verfolgen. |
| **IT Security Coordinators** | Maßnahmen teamübergreifend koordinieren sowie Zuständigkeiten, Fristen und Fortschritte im Blick behalten. |

## Was Little RiskBee nicht ist

- **Kein Vulnerability Scanner:** Schwachstellenscans laufen weiterhin in deinen gewohnten externen Werkzeugen. Little RiskBee importiert deren Berichte, um Befunde zu bewerten und die Behebung nachzuverfolgen.
- **Kein SIEM:** Die Anwendung dient der Bearbeitung dokumentierter Befunde – nicht der zentralen Echtzeit-Erfassung und Korrelation von Log- und Sicherheitsereignissen.
- **Kein Echtzeit-Monitoring:** Der abgebildete Sicherheitsstatus basiert stets auf deinen erfassten Befunden, importierten Berichten und dokumentierten Prüfungen.
- **Kein Dokumentenmanagementsystem (DMS):** Berichte und Nachweise lassen sich zwar exportieren, die zentrale Ablage, Freigabe und Versionierung erfolgen jedoch außerhalb der Anwendung.
- **Kein starres Fertigprodukt:** Little RiskBee ist ein modular erweiterbares Werkzeug, das du mit eigenen Maßnahmen, Katalogen und Stilen flexibel an deine Umgebung anpassen kannst.

## Inhalt

- [Schnellstart](#schnellstart)
- [Docker und Docker Compose](#docker-und-docker-compose)
- [Erster Arbeitsablauf](#erster-arbeitsablauf)
- [Funktionen](#funktionen)
- [Bibliotheken](#bibliotheken)
- [Import und Beispieldateien](#import-und-beispieldateien)
- [Speichern und Wiederherstellen](#speichern-und-wiederherstellen)
- [Datenschutz](#datenschutz)
- [Ordnerstruktur](#ordnerstruktur)
- [Erweitern](#erweitern)
- [Quellen](#quellen)

## Schnellstart

### Direkt im Browser

1. Repository klonen oder auf GitHub als ZIP-Archiv herunterladen und vollständig entpacken.
2. Die Datei `index.html` in einem aktuellen Browser öffnen (z. B. Chrome, Edge, Firefox oder Safari).
3. Unter **Einstellungen** die Projektdaten und anschließend unter **Assets** die ersten Zielobjekte anlegen.
4. Über **Speichern** eine erste JSON-Sicherung herunterladen.

Alle Unterordner müssen gemeinsam mit `index.html` erhalten bleiben. Nach dem Herunterladen ist keine Internetverbindung mehr erforderlich.

> **Hinweis zu `file://`:** Einige Browser schränken die dauerhafte lokale Speicherung (`IndexedDB`/`localStorage`) ein, wenn Dateien direkt über `file://` geöffnet werden. Nutze in diesem Fall Docker oder einen lokalen Webserver und exportiere deinen bisherigen Stand vor dem Wechsel als JSON-Datei.

## Docker und Docker Compose

### Voraussetzungen

- Git zum Klonen des Repositorys
- Docker mit laufender Engine und Compose-Plugin (`docker compose`), z. B. über Docker Desktop
- Freier lokaler Port `8080`
- Internetzugang für das Klonen und den einmaligen Download des Nginx-Basisimages

Installation prüfen:

```bash
git --version
docker --version
docker compose version
```

### Repository klonen, Image bauen und starten

```bash
git clone https://github.com/marciifee/little-riskbee.git little-riskbee
cd little-riskbee
docker compose -f docker-compose.yaml config
docker compose -f docker-compose.yaml up -d --build
```

Anschließend die Anwendung im Browser unter http://localhost:8080 öffnen.

Die mitgelieferte docker-compose.yaml definiert folgenden Dienst:

```yaml
services:
  little-riskbee:
    build:
      context: .
      dockerfile: Dockerfile
    image: little-riskbee:local
    ports:
      - "127.0.0.1:8080:80"
    restart: unless-stopped
```

Das Dockerfile kopiert die statischen Dateien in das offizielle Nginx-Image (es findet kein JavaScript-Build statt). Die Anwendung läuft im Container auf Port 80 und wird auf dem Host ausschließlich lokal unter 127.0.0.1:8080 bereitgestellt. Es werden weder eine .env-Datei noch Docker-Volumes benötigt. Weitere Informationen bieten die [Docker-Anleitung](https://docs.docker.com/compose/gettingstarted/) sowie die Seite zum [offiziellen Nginx-Image](https://hub.docker.com/_/nginx).

### Betrieb, Protokolle und Stoppen mit Compose

```bash
# Container-Status anzeigen
docker compose -f docker-compose.yaml ps

# Live-Protokolle verfolgen (beenden mit Strg+C)
docker compose -f docker-compose.yaml logs -f

# Stoppen und Container entfernen
docker compose -f docker-compose.yaml down

# Container erneut starten
docker compose -f docker-compose.yaml up -d
```

`docker compose down` löscht keine Browserdaten. Umgekehrt sichert ein Backup des Docker-Containers keine Arbeitsdaten – nutze dafür immer die Funktion **Speichern** direkt in der Anwendung.

### Aktualisieren

Sichere vor jedem Update deinen aktuellen Arbeitsstand als JSON-Datei. In einem unveränderten Git-Klon aktualisierst du die Anwendung wie folgt:

```bash
git pull --ff-only
docker compose -f docker-compose.yaml build --pull
docker compose -f docker-compose.yaml up -d
```

Lade danach die Seite im Browser neu. Da `nginx:stable-alpine` ein dynamischer Tag ist, aktualisiert `--pull` gleichzeitig das Basisimage. Falls du lokale Anpassungen am Quellcode vorgenommen hast, sichere diese vor `git pull` oder führe sie regulär über Git zusammen.

## Erster Arbeitsablauf

1. **Projekt vorbereiten:** In den Einstellungen Stammdaten, Ansprechpersonen, Branding und Berichtstitel pflegen.
2. **Plan – Planen:** Assets anlegen oder importieren, Typ und Betriebssystem zuordnen, Bausteine modellieren und den Schutzbedarf (Vertraulichkeit, Integrität, Verfügbarkeit) begründen. Bibliotheken und Vorgehensweise wählen sowie Risiken und Risikoappetit festlegen.
3. **Do – Umsetzen:** Checkliste abarbeiten sowie Verantwortliche, Fristen, Nachweise und begründete Ausnahmen dokumentieren. (Hinweis: Prüfbefehle führst du direkt auf dem jeweiligen Zielsystem aus – die Anwendung greift nicht aktiv auf Systeme zu.)
4. **Check – Prüfen:** Extern erzeugte Scan-Berichte importieren, Zuordnungen kontrollieren und Befunde bewerten. Wirksamkeitskontrolle, Gap-Analyse und KPI-Dashboard zur Auswertung nutzen.
5. **Act – Verbessern:** Roadmap priorisieren, Risikoentscheidungen und Reviews festhalten und Berichte exportieren.
6. **BCM ergänzen:** Kritische Prozesse in der Business-Impact-Analyse (BIA) untersuchen, Wiederanlaufziele festlegen, BC-Pläne und Krisenstab pflegen sowie Übungen dokumentieren.
7. **Stand sichern:** JSON-Export herunterladen.

## Funktionen
### Härtung, Kataloge & Audits
| Bereich | Funktionsumfang |
|---|---|
| **Assets / Geltungsbereiche** | Zielobjekte aller Schichten erfassen und nach Typ gruppieren: <br> 🏢 Informationsverbund & Prozesse (`ISMS`, `ORP`, `CON`, `OPS`, `DER`), 🧩 Anwendungen (`APP`), 🖥 IT-Systeme (`SYS` – Hostname, IP, OS, Rolle), 🏭 Industrielle IT (`IND`), 🌐 Netze (`NET`), 🏛 Infrastruktur (`INF`). <br> **Modellierung**: Je Zielobjekt passende der 111 IT-Grundschutz-Bausteine auswählen (inkl. automatischer Vorschläge je Typ/OS). Sind Einzelanforderungen vorhanden (integriert, per Kompendium-Import oder selbst angelegt), erscheinen diese direkt; andernfalls erfolgt eine Gesamtbewertung auf Bausteinebene. CSV-Import wird unterstützt. |
| **Schutzbedarf** | Vertraulichkeit, Integrität und Verfügbarkeit je Asset bewerten (normal, hoch, sehr hoch) und nachvollziehbar begründen (BSI-Standard 200-2, Maximumprinzip). Steuert automatisch, ob H-Anforderungen eingeblendet werden. |
| **Checkliste** | Maßnahmen interaktiv bearbeiten: Status (offen, umgesetzt, teilweise, nicht umgesetzt/Risiko, entbehrlich/gestrichen), Pflichtbegründung beim Streichen, Notizen, Nachweise, Zuständigkeiten, Termine, Prüfbefehle zum Kopieren sowie eine **Wirksamkeitskontrolle** (Ergebnis, Datum, Methode, Prüfer). Inklusive Filtern, Gruppierung, Massen-Streichung und eigenen Maßnahmen. |
| **Bibliotheken** | Detaillierter Vergleich der Kataloge: Anzahl der Maßnahmen je Bibliothek und Betriebssystem, Aufteilung nach B/S/H, Abdeckungsmatrix über 18 Fachthemen, Referenzzahlen der Originalquellen und fachliche Einordnung. |
| **Anleitungen** | Schritt-für-Schritt-Härtungsleitfäden für Vorgehen, Debian/Ubuntu, Fedora/RHEL, Windows Server/Windows 11, macOS sowie Scans & Nachweise – inklusive direkter Befehle und Verweise in die Checkliste. |
| **Gap-Analyse** | Soll-Ist-Vergleich über alle Zielobjekte gemäß gewählter Vorgehensweise/Schutzbedarf oder einheitlich (Basis, Standard, Standard + H). Zeigt Erfüllungsgrade je Asset und Niveau (B/S/H), Abdeckung des Schichtenmodells, **Modellierungslücken** (fehlende Schichten/Kern-Bausteine, Assets ohne Anforderungen, hoher Schutzbedarf ohne Risikoanalyse), eine **Lücken-Matrix** (Baustein × Zielobjekt), priorisierte Maßnahmenlücken (`P1–P3` mit Sprung in die Checkliste und CSV-Export), Verlaufs-Snapshots sowie den KPI „Erfüllung Basis-Anforderungen“ |
| **Glossar** | Nachschlagewerk für alle 111 Bausteine der Edition 2023 (inkl. Kurzbeschreibung, Einzelanforderungen und direkter Modellierung auf Assets), alle 47 elementaren Gefährdungen (`G 0.1–G 0.47`) sowie relevante Fachbegriffe. Mit Live-Suche, Schichtfilter und Druck-/PDF-Ausgabe. |
<br>

### Scans, Risikomanagement & Simulation
| Bereich | Funktionsumfang |
|---|---|
| **Scans & Schwachstellen** | Übersicht aller importierten Scans je Asset mit Scan-Zeitpunkt aus dem Bericht, Importzeitpunkt, Dateiname und **SHA-256-Prüfsumme** als Integritätsnachweis. Befundstatus: offen, teilweise behoben, behoben, Risiko akzeptiert oder Fehlalarm (jeweils mit Begründung). Nicht mehr gefundene Befunde werden bei Folgescans automatisch als behoben markiert; akzeptierte Risiken bleiben erhalten. |
| **Risikobewertung** | Alle offenen, teilweise behobenen und akzeptierten Befunde der aktuellsten Scans mit Risiko-ID (`R-001` …), Zielobjekt, Bedrohung (Vorschläge aus den elementaren Gefährdungen `G 0.x`), Eintrittshäufigkeit × Schadenshöhe (`4 × 4` in Anlehnung an BSI-Standard 200-3), Heatmap (Grün → Gelb → Orange → Rot), Behandlungsoption (vermeiden, reduzieren, übertragen, akzeptieren), Maßnahme, Risikoeigner und Termin. Beidseitig synchron mit dem Scan-Status; unbewertete Befunde erhalten einen automatischen Vorschlag aus Schweregrad und Schutzbedarf. |
| **Risikoregister** | Führt frei definierbare eigene Risiken (`4 × 4`), Befundrisiken und Projektrisiken zentral zusammen – inklusive Brutto-/Netto-Bewertung, Behandlung, Eigner, Review-Termin, CSV-Export sowie Heatmaps mit Appetit- und Toleranzgrenze. |
| **Risikoappetit & -akzeptanz** | Definition von Risikoappetit-Erklärung, Appetit- und Toleranzgrenzen, Verlustappetit/-toleranz in Euro, Akzeptanzbefugnissen, maximaler Gültigkeit und Review-Intervallen. Formale Dokumentation von Risikoakzeptanzen (Freigeber, Befugnis, Begründung, Auflagen, Befristung) – Überschreitungen der Toleranzgrenze sind nur als ausdrückliche Ausnahme der Leitung zulässig. Mit Ampelstatus je Risiko. |
| **Monte-Carlo-Analyse** | Quantitative Risikosimulation (Poisson-Häufigkeit × PERT-Schaden, 1.000 bis 100.000 Simulationsjahre, reproduzierbar per Seed): berechnet Erwartungswert (ALE), Perzentile (`P50`/`P90`/`P95`/`P99`) und die Wahrscheinlichkeit einer Überschreitung der Verlusttoleranz. Visualisiert als Verlustüberschreitungskurve, Histogramm und Risikobeitrag (brutto/netto) mit eigenen Dreipunktschätzungen oder Kalibrierungsvorlagen (klein, KMU, groß). |
| **Projektrisiken, Chancen & SWOT** | **Risiken (`1–5`)**: Projektbezogene Risikoanalyse mit Ursache, Kategorie, Eintrittswahrscheinlichkeit × Auswirkung, Strategie, Gegenmaßnahmen, Frühwarnindikator, Zuständigkeit, Restrisiko, Vorher/Nachher-Heatmaps und Beispielvorlagen. **Chancen**: Bewertung von Wahrscheinlichkeit × Nutzen mit Strategien (ausnutzen, verbessern, teilen, akzeptieren) und eigener Matrix. **SWOT-Analyse**: Stärken, Schwächen, Chancen und Risiken inklusive TOWS-Strategien sowie direkter Datenübernahme aus Audit-Kennzahlen, Projektrisiken und Chancen. |
| **Roadmap** | Priorisierte Maßnahmenliste (`P1 sofort` bis `P4 nächstes Audit`) aus offenen Befunden, offenen Checklisten-Punkten und Projektrisiken – mit Zuständigkeit, Termin, Überfällig-Kennzeichnung und CSV-Export. |
<br>

### Pentesting & Ursachenanalyse
| Bereich | Funktionsumfang |
|---|---|
| **Finding-Dashboard** | Vollwertiger Pentest-Report-Generator: Findings anlegen (leer, aus 9 Vorlagen oder aus OpenVAS-/Lynis-Scans), importieren (JSON, CSV) und exportieren (JSON, CSV, Markdown). **Detailerfassung:** Schweregrad, integrierter **CVSS-v3.1-Rechner**, CWE, OWASP Top 10, betroffene Assets/Ziele, Verantwortung/Frist, Kurz-Empfehlung und strukturierte Markdown-Abschnitte (Zusammenfassung, Technische Beschreibung, Auswirkung, Reproduktion/PoC, Nachweise, Empfehlung, Referenzen, Re-Test-Notiz). **Editor & Berichte:** Split-Screen mit Markdown-Editor links und Live-Vorschau rechts, Bild-Upload per Button oder `Strg+V`, versioniertes Zwischenspeichern sowie eigene Felder und Berichtsabschnitte. Findings lassen sich direkt als Härtungsmaßnahme übernehmen (Re-Test „behoben“ setzt die Maßnahme auf umgesetzt/wirksam). Separater **DIN-A4-Pentest-Bericht** mit Deckblatt, Dokumentenkontrolle, Inhaltsverzeichnis, Bewertungsschema, Ergebnisübersicht, Findings und Re-Test. |
| **Risikobaum** | Grafischer IT-Risikobaum (Fehler- oder Angriffsbaum): Top-Ereignis über **`UND`-/`ODER`-Gatter** auf Basisereignisse herunterbrechen, Eintrittswahrscheinlichkeiten pro Jahr sowie bei Angriffsbäumen Kosten und benötigtes Angreifer-Können erfassen und Gegenmaßnahmen samt Wirksamkeit hinterlegen. Berechnet Brutto-/Netto-Wahrscheinlichkeit, kritischen Pfad, minimale Schnittmengen (inkl. Single Points of Failure) und die Bedeutung jedes Basisereignisses („Wo ansetzen?“). Inklusive 4 Vorlagen, Übernahme ins Risikoregister (Ereignisrate für Monte-Carlo) sowie SVG-/JSON-/PDF-Export. |
| **Ursachenanalyse (Fischgrätendiagramm)** | Interaktives Ishikawa-Diagramm für Brainstorming und Root-Cause-Analysen: Wirkung im Kopf, Kategorien als Gräten (`6M`, `8M`, I`T-Sicherheit`, `4S` oder `2–8` eigene Kategorien mit freier Farbwahl). Notizen per Button oder Doppelklick anlegen und **per Maus/Touch frei verschieben** (automatische Zuordnung zur nächstgelegenen Gräte) oder per Tastatur (`Pfeiltasten`, `Entf`) steuern. Je Notiz: Farbe, Hauptursache (`⭐`), Dot-Voting, 5-Why-Kette und Gegenmaßnahme. Mit Hauptursachen-Tabelle, Übernahme ins Risikoregister, Vorlagen (Ransomware-Vorfall, Patch-Rückstand), SVG-/JSON-Export und A4-Querformat-Druck. |
<br>

### Governance, Compliance & Business Continuity (BCM)
| Bereich | Funktionsumfang |
|---|---|
| **Pflichten & Reviews** | Pflichtenkalender für wiederkehrende Aufgaben (wöchentlich bis alle 3 Jahre) mit Vorlagen für Normpflichten (ISO/IEC 27001, BSI, DSGVO, NIS2/BSIG, BSI 200-4) und Erledigt-Historie inklusive Nachweis. Automatische Review-Erinnerungen für Risiken, ablaufende Akzeptanzen, Risikoappetit, Asset-Re-Audits, veraltete Scans, Roadmap-Termine, BIA/BC-Pläne/Übungen/Krisenstab und KPI-Erfassungen. Agenda- und Monatsansicht, Zähler im Menü, optionale Browser-Benachrichtigungen sowie **ICS-Export** mit Serienterminen und Alarmen für Outlook, Thunderbird und Apple Kalender. |
| **KPI-Dashboard** | 22 integrierte Kennzahlen aus den Bereichen Härtung, Schwachstellen, Risiko, Compliance und BCM mit Ampelstatus, frei definierbaren Zielwerten/Warnschwellen („Ziele setzen“) und automatischer wöchentlicher Verlaufshistorie. Unterstützt zudem eigene KPIs mit Messwerten und Erfassungsintervall sowie eine Übersicht „Fehlende Daten & Datenqualität“ mit direktem Sprung zur jeweiligen Eingabemaske. |
| **TOM-Übersicht** | Strukturierte Übersicht und Berichtsausgabe zum Umsetzungsstand der technischen und organisatorischen Maßnahmen (TOM) je Kategorie nach Art. 32 DSGVO. |
| **Business-Impact-Analyse (BIA)** | Schadensverlauf über die Zeit je Geschäftsprozess (Schadenskategorien × Zeitintervalle) mit automatischem Vorschlag für `MTA`/`MTPD`, geforderter Wiederanlaufzeit (`WAZ`/`RTO` inklusive Prüfung `RTO` < `MTA`), `RPO`, Wiederanlaufniveau, Zeitkritikalität, Wiederanlaufpriorität und visueller Zeitachse. Abhängige Assets erben automatisch die strengste `RTO`/`RPO`; bei zu niedrigem Verfügbarkeits-Schutzbedarf erscheint ein Hinweis. |
| **BC-Pläne** | Dokumentation von Planart, Kontinuitätsstrategie, Aktivierungskriterien, Ablauf, Ressourcen, Kommunikation und Freigabe. Ohne eigene Zielwerte übernimmt ein Plan automatisch `RTO`/`RPO` aus der BIA des verknüpften Geschäftsprozesses (und warnt bei lockereren eigenen Zielen). Inklusive Tracking von letzter/nächster Übung und nachgewiesener Wiederanlaufzeit. |
| **Krisenstab** | Definition der Eskalationsstufen (Störung → Notfall → Krise), Stabsrollen (`Leitung`, `S1–S6`, `Fachbereichg`) samt Person und Vertretung, Eskalationspfaden (Auslöser, Melde-/Entscheidungs-/Alarmierungswege, Reaktionszeit, Sofortmaßnahmen) sowie Alarmierungskette und druckbarer Alarmierungsliste. |
| **Übungen** | Strukturierte Planung (Übungsart, Ziele, Szenario, geübte Pläne), Durchführung (erreichte Wiederanlaufzeit, Datenverlust, Beobachtungen) und Auswertung (Ergebnis, Lessons Learned, Folgemaßnahmen mit Termin für Roadmap und Kalender) sowie Jahresübungsplan mit Fälligkeitsübersicht. |
<br>

### Berichte, Darstellung & System
| Bereich | Funktionsumfang |
|---|---|
| **Bericht (A4)** | Eigenständiger DIN-A4-Hochformat-Bericht als HTML-Datei (Stammdaten, Schutzbedarf, Kennzahlen, Maßnahmen inkl. Wirksamkeit, Abweichungen mit Begründung, Scans mit Hash, TOM-Übersicht, Risikobewertung mit Heatmap, Projektrisiken, Roadmap und Unterschriftenfeld) – direkt druckbar oder als PDF speicherbar. |
| **Positiv-Bericht** | Zielgruppengerechter Erfolgsbericht für Shareholder, Investoren, Sponsoren, Mitglieder, Kunden oder die Geschäftsleitung: generiert automatisch belegbare positive Aussagen (nicht positive Punkte werden ausgeblendet), die einzeln abschaltbar oder überschreibbar sind. Enthält anpassbare Textbausteine (Vorwort, Highlights, Ausblick, Dank, Kontakt, Schlusswort) mit Platzhaltern wie `{umsetzungsgrad}`, Zielgruppenvorlagen, eigene Meilensteine, Diagramme und eine Onepager-Variante. Sensible Systemnamen und IP-Adressen werden standardmäßig ausgeblendet. |
| **Ansprechpersonen** | Zentrale Pflege von Personen mit Funktion, Kontaktdaten, Notfallnummer und Vertretung in den Einstellungen. Alle Personenfelder (Verantwortliche, Risikoeigner, Prüfer, Krisenstab usw.) bieten diese als Dropdown-Auswahl an (freie Eingabe bleibt möglich). Mit „Namen aus Daten übernehmen“ lassen sich bereits genutzte Namen nachträglich einsammeln. |
| **Branding** | Standardmäßig ist das Little-RiskBee-Logo hinterlegt. In den Einstellungen kannst du ein eigenes Logo hochladen (`PNG`, `JPG`, `WebP`, `SVG` – wird lokal skaliert) sowie Abteilung, Anschrift, Kontakt, Webseite, Berichtstitel, Fußzeile/Einstufung und Akzentfarbe festlegen. |
| **Darstellung** | Automatischer oder manueller Hell-/Dunkelmodus, responsives Layout für Desktop, Tablet und Smartphone sowie Sprachumschaltung (DE/EN). Über den **Style-Wechsler** lassen sich mitgelieferte Themes (`css/themes/`), eigene CSS-Pfade oder hochgeladene CSS-Dateien im Modus „ergänzen“ oder „ersetzen“ laden. Notfall-Reset über `index.html?style=default`. |
| **Speichern** | Kontinuierliche automatische Speicherung im Browser (`IndexedDB` mit Fallback auf `localStorage`). Zusätzlich manueller Export über **💾 Speichern** bzw. `Strg+S` als JSON-Datei und Wiederherstellung über **📂 Laden**. |
| **** |  |


## Bibliotheken

| Bibliothek | In der Seite | Hinweis |
|---|---|---|
| **BSI IT-Grundschutz-Kompendium Edition 2023** | **integriert**: `SYS.1.1`, `SYS.1.2.3`, `SYS.1.3`, `SYS.2.1`, `SYS.2.2.3`, `SYS.2.3`, `SYS.2.4` (ohne entfallene Anforderungen) | Titel wörtlich, Beschreibungen sinngemäß gekürzt – maßgeblich ist der BSI-Originaltext. Weitere Bausteine: Kompendium (XML/Text) importieren. |
| **BSI Grundschutz++** | **Per Import (OSCAL)** | Katalog aus dem BSI-GitHub-Repository „Stand-der-Technik-Bibliothek“ (`CC BY-SA 4.0`) importieren; Sicherheitsniveau (`normal-SdT/erhöht`), Aufwand und Modalverb werden ausgelesen. |
| **OpenSCAP SCAP Security Guide** | **integriert**: kuratierter Auszug (87 Regeln, echte Regel-IDs, BSI-Zuordnungen laut ComplianceAsCode) | Vollständige Profile per Datastream-Import. OpenSCAP-Ergebnisse setzen den Status automatisch. |
| **Microsoft Security Baseline** | **integriert**: kuratierte Auswahl | Volle Baseline: Security Compliance Toolkit. |
| **mSCP (macOS, NIST)** | **integriert**: kuratierte Auswahl | Regel-IDs können je macOS-Version abweichen. |
| **CIS, DISA STIG, ANSSI BP-028** | **Per Import (XCCDF bzw. SSG-Profile)** | CIS ist für kommerzielle Nutzung lizenzpflichtig, daher nicht eingebaut. |
| **Eigene Maßnahmen** | **Direkt in der Checkliste anlegbar** | Zum Beispiel auf Basis von Lynis-Empfehlungen oder über den CSV-Katalogimport. |

## Datenschutz

- Verarbeitung ausschließlich lokal im Browser. Im Docker-Betrieb liefert Apache die Anwendungsdateien aus. Importierte Befunde und Projektstände bleiben im Browser. Die Anwendung verwendet keine Cookies, Tracker, CDNs oder Webfonts.
- Eine Content-Security-Policy (`connect-src 'none'`) blockiert von der Anwendung initiierte Verbindungen über APIs wie Fetch, XMLHttpRequest oder WebSocket.
- Speicherung in IndexedDB/localStorage des Browsers und in selbst exportierten JSON-Dateien; Löschen über *Einstellungen → Alle lokalen Daten löschen*.
- Exporte und Berichte enthalten sicherheitskritische Informationen → vertraulich behandeln.

## Import und Beispieldateien

Über **Import** Dateien auswählen oder hineinziehen. Bei Bedarf das Format ausdrücklich wählen. Die Dateiendung allein genügt nicht: XML, JSON und CSV müssen dem jeweils unterstützten Bericht- oder Katalogformat entsprechen. Eine vollständige Projektsicherung wird über **Laden** wiederhergestellt.

| Datenquelle | Unterstützte Inhalte / Verwendung |
|---|---|
| Nmap | XML (`-oX`), grepable (`-oG`), Text (`-oN`); Hosts und offene Ports |
| Lynis | `report.dat` und `lynis.log` |
| OpenVAS / Greenbone | XML- und CSV-Berichte |
| OpenSCAP | Results / ARF; zuordenbare Regel-Ergebnisse aktualisieren die Checkliste |
| SSG / XCCDF | Datastream oder Benchmark; Profil auswählen und Regeln importieren |
| OSCAL | JSON-/XML-Kataloge, z. B. für Grundschutz++ |
| BSI-Kompendium | Unterstützte XML-/Textstrukturen für zusätzliche Anforderungen |
| CSV | Assets, eigene Maßnahmenkataloge oder Befunde |
| Finding-Dashboard | Eigener JSON-/CSV-Import und Export für Findings |

### Geführter Probelauf

Die Daten in [samples/](samples/) sind fiktiv:

1. [assets-beispiel.csv](samples/assets-beispiel.csv) importieren. Dadurch werden `web01`, `db01` und `mac-01` angelegt.
2. [nmap-web01.xml](samples/nmap-web01.xml), [lynis-report-web01.dat](samples/lynis-report-web01.dat), [openvas-web01.xml](samples/openvas-web01.xml) und [openvas-db01.csv](samples/openvas-db01.csv) importieren und die Zuordnung über Hostname/IP prüfen.
3. Mit [nmap-netz-beispiel.nmap](samples/nmap-netz-beispiel.nmap) die Verarbeitung mehrerer Hosts ausprobieren.
4. [xccdf-benchmark-beispiel.xml](samples/xccdf-benchmark-beispiel.xml) für die Profilauswahl und [oscap-results-web01.xml](samples/oscap-results-web01.xml) für Scan-Ergebnisse verwenden. Regelzuordnungen hängen von den am Asset verwendeten Katalogen ab.
5. [oscal-katalog-beispiel.json](samples/oscal-katalog-beispiel.json) zeigt einen OSCAL-Katalog mit fiktiven Inhalten, keinen offiziellen BSI-Text.

## Speichern und Wiederherstellen

- **Autosave:** IndexedDB, ersatzweise localStorage. Ist beides nicht verfügbar, bleibt nur flüchtiger Arbeitsspeicher; dann unbedingt per Datei sichern.
- **Sicherung:** **Speichern** oder `Strg+S` / `Cmd+S` exportiert den gesamten Projektstand als `little-riskbee_<Datum>.json`.
- **Wiederherstellung / Umzug:** **Laden** öffnen, JSON-Datei wählen und das Ersetzen des aktuellen Standes bestätigen. Zuvor den bisherigen Stand sichern; es erfolgt keine Zusammenführung von Projekten.
- **Berichte:** HTML, PDF aus dem Druckdialog, CSV und andere fachliche Exporte dienen der Auswertung. Sie ersetzen keine vollständige JSON-Sicherung.
- **Löschen:** **Einstellungen → Alle lokalen Daten löschen** entfernt den gespeicherten Anwendungsstand. Bereits heruntergeladene Dateien separat löschen.
- **Kompatibilität:** Die interne Kennung `app: "hardening-audit"` und der Datenbankname bleiben bestehen, damit ältere Sicherungen und bestehende Browserdaten weiterverwendet werden können.

Browserprofil, privater Modus, gelöschte Website-Daten und Speicherquoten beeinflussen die Verfügbarkeit. Sicherungen an einem geschützten Ort außerhalb des Projektordners aufbewahren. Sie sind reguläre JSON-Dateien und werden von der Anwendung nicht verschlüsselt.

### Fachliche Einordnung

- Kataloge und Vorlagen unterstützen die Bearbeitung; sie ersetzen keine vollständigen Originalquellen oder eine unabhängige Prüfung. Ein erstellter Bericht ist keine Zertifizierung.
- Die eingebauten BSI-Anforderungen beziehen sich auf **Edition 2023**. Die Übersicht über 111 Bausteine bedeutet nicht, dass sämtliche Einzelanforderungen aller Bausteine eingebaut sind.
- Risikobewertung und eigene Registerrisiken nutzen eine 4×4-Matrix; Projektrisiken eine 5×5-Matrix. Monte-Carlo-Ergebnisse hängen von den gewählten Annahmen und Schätzungen ab.
- Beim Vergleich neuer Scans können nicht mehr gefundene Befunde als behoben markiert werden. Vor einer fachlichen Freigabe prüfen, ob Scan-Umfang und Qualität vergleichbar sind.
- Pflichtintervalle, BIA-Schwellen und Simulationskalibrierungen sind Vorschläge und müssen zum eigenen Einsatz passen.
- Erinnerungen aus der Anwendung benötigen eine geöffnete Seite und für Benachrichtigungen gegebenenfalls Browserberechtigungen. Für Termine bei geschlossener Seite ICS exportieren und in einen Kalender importieren. Nach Änderungen neu exportieren; wie bestehende Termine aktualisiert werden, hängt vom Kalenderprogramm ab.

## Ordnerstruktur

```
README.md               Deutsche Projektdokumentation
README.en.md            English documentation
Dockerfile              Nginx-Image mit statischen Anwendungsdateien
docker-compose.yaml     Lokaler Docker-Betrieb auf Port 8080
.dockerignore           Beschränkt den Build-Kontext auf Anwendungsdateien
index.html              Einstieg
assets/                 Logo (little-riskbee.svg, PNG 512) und Favicons (SVG, ICO, PNG, Apple-Touch-Icon)
js/data/logo.js         Standardlogo als Data-URI (Kopfzeile und Bericht, solange kein eigenes Logo hochgeladen ist)
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
js/app.js               Oberfläche und Logik, Erweiterungs-Schnittstelle (HA.App.ext)
js/modules/kit.js       Gemeinsame Bausteine (Formulare, Datum), Ansprechpersonen
js/modules/register.js  Risikoregister, Risikoappetit, Risikoakzeptanz
js/modules/montecarlo.js Monte-Carlo-Analyse
js/modules/calendar.js  Pflichtenkalender, Reviews, Erinnerungen, ICS-Export
js/modules/kpi.js       KPI-Dashboard, Zielwerte, fehlende Daten
js/modules/bcm.js       BIA, BC-Pläne, Krisenstab, Übungen
js/modules/theme.js     Style-Wechsler
js/modules/markdown.js  Markdown-Renderer (eigener, sicherer Code: HTML wird maskiert, nur lokale Bilder)
js/modules/findings.js  Finding-Dashboard, Editor, CVSS-Rechner, Import/Export, Maßnahmen-Übernahme
js/modules/findings-report.js  A4-Pentest-Bericht und Markdown-Export
js/data/finding-templates.js   Vorlagen für typische Pentest-Findings, OWASP Top 10
js/modules/risktree.js  IT-Risikobaum (Fehler-/Angriffsbaum, Schnittmengen, SVG)
js/modules/posreport.js Positiv-Bericht (automatische Erfolge, Textbausteine, A4)
js/data/gs-glossary.js  IT-Grundschutz-Stammdaten: Zielobjekt-Typen, 10 Schichten, 111 Bausteine, 47 Gefährdungen, Begriffe
js/modules/gap.js       Gap-Analyse (Soll-Ist, Modellierungslücken, Matrix, Snapshots)
js/modules/glossary.js  Glossar (Bausteine, Gefährdungen, Begriffe)
js/modules/fishbone.js  Ursachenanalyse / Fischgrätendiagramm (Ishikawa, Drag & Drop, 5-Why)
css/themes/             Zusatz-Stile (honey, contrast, compact) + README
samples/                Fiktive Beispieldateien zum Ausprobieren
```

## Erweitern

- **Neue BSI-Anforderung:** in `catalog-bsi.js` eine Zeile `B('ID', 'B|S|H', [Plattformen], 'server|client|any', 'thema', 'Titel', 'Title', 'Beschreibung', {check:{linux:'…'}})` ergänzen.
- **Prüfbefehle ändern:** in `js/data/checks.js` – Schlüssel `linux`/`windows`/`macos` oder distributionsspezifisch `debian`/`ubuntu`/`fedora`/`rhel` (hat Vorrang).
- **Neue SSG-Regel:** in `catalog-ssg.js` per `S(…)`; die Regel-ID muss der SSG-ID entsprechen, damit OpenSCAP-Ergebnisse zugeordnet werden.
- **Eigener Katalog ohne Code:** CSV mit Spalten `id;title;description;level;os;topic;check` importieren.
- **Neue Sprache:** in `i18n.js` ein weiteres Wörterbuch anlegen und die Sprachauswahl entsprechend erweitern.
- **Neues Importformat:** in `parsers.js` eine Funktion schreiben und in `detectAndParse()` einhängen.
- **Neues Modul:** Datei in `js/modules/` anlegen (nach `app.js` einbinden) und registrieren: `HA.App.views` (Ansicht), `HA.App.ext` für, `click`/`change`/`input` (Ereignisse, `true` = behandelt), `normalize` (Datenbereich anlegen), `settingsCards`, `dashCards`, `reportOpts` + `HA.Report.ext` (Berichtsabschnitt), `HA.Cal.providers` (Termine), `HA.Risk.roadmapSources` (Roadmap).
- **Eigene Normpflicht-Vorlage:** in `js/modules/calendar.js` im Array `TEMPLATES` ergänzen.
- **Eigener Stil:** siehe [Theme-Anleitung](css/themes/README.md).


## Quellen

- BSI IT-Grundschutz-Kompendium: https://www.bsi.bund.de (Edition 2023)
- BSI Grundschutz++ / Stand-der-Technik-Bibliothek: https://github.com/BSI-Bund/Stand-der-Technik-Bibliothek
- ComplianceAsCode / SCAP Security Guide: https://github.com/ComplianceAsCode/content
- Microsoft Security Baselines: https://learn.microsoft.com/windows/security/
- macOS Security Compliance Project: https://github.com/usnistgov/macos_security
- Lynis: https://cisofy.com/lynis/ · Nmap: https://nmap.org · Greenbone Community Edition: https://greenbone.github.io/docs/
- [Docker Compose](https://docs.docker.com/compose/gettingstarted/), [Nginx Docker Official Image](https://hub.docker.com/_/nginx)

---

Die englische Fassung dieser Projektdokumentation steht in [README.en.md](README.en.md).

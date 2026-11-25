# little-riskbee
![Little RiskBee – IT-Risikomanagement im Browser](./Little-RiskBee-GitHub-Banner.svg)

### **IT-Risikomanagement, Systemhärtung und Business Continuity in einer lokalen Web-Anwendung.**

**Deutsch** | [English](README.en.md)

Little-RiskBee unterstützt Sie dabei, Windows-, Linux- und macOS-Systeme sowie organisatorische Zielobjekte zu erfassen, Sicherheitsmaßnahmen zu planen, Scan-Ergebnisse auszuwerten und Risiken nachvollziehbar zu dokumentieren. \
Die Oberfläche folgt dem **PDCA-Zyklus: Plan → Do → Check → Act**. \
Ergänzend stehen Werkzeuge für Business Continuity und Pentest-Berichte bereit.

Die Anwendung besteht aus HTML, CSS und JavaScript. Sie benötigt weder npm noch einen Compiler, eine Datenbankinstallation oder einen Anwendungsserver. Sie lässt sich direkt als Datei öffnen oder über den mitgelieferten Docker-Container bereitstellen. Die Oberfläche kann zwischen Deutsch und Englisch umgeschaltet werden; eigene und importierte Inhalte werden nicht automatisch übersetzt.

> **Wichtig zur Speicherung:** Arbeitsdaten liegen im jeweiligen Browserprofil. Auch bei Docker-Betrieb werden sie nicht im Container gespeichert und nicht zwischen Personen oder Geräten synchronisiert. Regelmäßige JSON-Sicherungen sind deshalb Teil des Arbeitsablaufs.

## Für wen ist Little RiskBee gedacht?

| Nutzerprofil | Typischer Einsatz |
| --- | --- |
| **IT-Admins mit Security-Schwerpunkt** | Server und Clients anhand von Härtungschecklisten prüfen und die Umsetzung dokumentieren. |
| **Informationssicherheitsbeauftragte (ISB)** | Risiken priorisieren, Restrisiken nachvollziehen und die Wirksamkeit von Maßnahmen prüfen. |
| **Compliance-Manager** | Kataloganforderungen und interne Vorgaben zusammenführen und Nachweise für Audits vorbereiten. |
| **Interne Auditoren** | Umsetzungsstand, Abweichungen und Wirksamkeitsnachweise je System nachvollziehen. |
| **Pentester** | Befunde aus abgeschlossenen Prüfungen übergeben und deren Behebung nachverfolgen. |
| **IT Security Coordinators** | Maßnahmen koordinieren und Zuständigkeiten, Fristen und Fortschritt im Blick behalten. |

## Was Little RiskBee nicht ist

- **Kein Vulnerability Scanner.** Die Scans laufen in externen Werkzeugen. Berichte in unterstützten Formaten lassen sich importieren, um Befunde zu bewerten und ihre Behebung nachzuverfolgen.
- **Kein SIEM.** Little RiskBee dient der Bearbeitung dokumentierter Befunde. Die zentrale Erfassung und Korrelation von Sicherheitsereignissen erfolgt in spezialisierten Systemen.
- **Kein Echtzeitmonitoring.** Der Stand ergibt sich aus erfassten Befunden, importierten Berichten und dokumentierten Prüfungen.
- **Kein Dokumentenmanagementsystem.** Berichte und Nachweise lassen sich exportieren. Die zentrale Ablage, Freigabe und Versionierung erfolgen außerhalb der Anwendung.
- **Kein Fertigprodukt.** Little RiskBee ist ein erweiterbares Werkzeug, das du mit eigenen Maßnahmen und Katalogen an deine Umgebung anpasst.

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

1. Repository klonen oder auf GitHub als ZIP herunterladen und vollständig entpacken.
2. `index.html` in einem aktuellen Browser öffnen, z. B. Chrome, Edge, Firefox oder Safari.
3. Unter **Einstellungen** die Projektdaten und anschließend unter **Assets** die Zielobjekte anlegen.
4. Über **Speichern** eine erste JSON-Sicherung herunterladen.

Alle Unterordner müssen zusammen mit `index.html` erhalten bleiben. Nach dem Herunterladen ist für diesen Startmodus keine Internetverbindung erforderlich. Browser können die dauerhafte Speicherung unter `file://` einschränken; in diesem Fall Docker oder einen lokalen HTTP-Server verwenden und den bisherigen Stand zuvor exportieren.


## Docker und Docker Compose

### Voraussetzungen

- Git zum Klonen des Repositorys.
- Docker mit laufender Engine und dem Compose-Plugin (`docker compose`), beispielsweise über Docker Desktop.
- Freier lokaler Port `8080`.
- Internetzugang für das Klonen und den ersten Download des Nginx-Basisimages.

Prüfen:

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

Anschließend [http://localhost:8080](http://localhost:8080) öffnen.

Die mitgelieferte [docker-compose.yaml](docker-compose.yaml) enthält:

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

Der [Dockerfile](Dockerfile) kopiert die Anwendung in das offizielle Nginx-Image. Dabei wird kein JavaScript kompiliert. Die Anwendung wird auf dem Container-Port `80` ausgeliefert; der Host stellt sie ausschließlich lokal auf Port `8080` bereit. Es sind keine `.env`-Datei und keine Docker-Volumes erforderlich. Die [Docker-Anleitung](https://docs.docker.com/compose/gettingstarted/) erläutert Compose; Details zum Basisimage stehen beim [offiziellen Nginx-Image](https://hub.docker.com/_/nginx).

### Betrieb, Protokolle und Stoppen mit Compose

```bash
# Status anzeigen
docker compose -f docker-compose.yaml ps

# Protokolle anzeigen; mit Strg+C verlassen
docker compose -f docker-compose.yaml logs -f

# Stoppen und Container entfernen
docker compose -f docker-compose.yaml down

# Erneut starten
docker compose -f docker-compose.yaml up -d
```

`down` entfernt keine Browserdaten. Ein Container-Backup sichert umgekehrt keine Arbeitsdaten; dafür **Speichern** in der Anwendung verwenden.

### Aktualisieren

Zuerst den Arbeitsstand als JSON sichern. In einem Git-Klon mit unveränderten Projektdateien:

```bash
git pull --ff-only
docker compose -f docker-compose.yaml build --pull
docker compose -f docker-compose.yaml up -d
```

Anschließend die Seite neu laden. Änderungen am Quellcode benötigen einen erneuten Image-Build. Bei lokalen Anpassungen diese vor `git pull` sichern bzw. über Git zusammenführen. `nginx:stable-alpine` ist ein beweglicher Tag; `--pull` aktualisiert das Basisimage. 

## Erster Arbeitsablauf

1. **Projekt vorbereiten:** In den Einstellungen Stammdaten, Ansprechpersonen, Branding und Berichtstitel pflegen.
2. **Plan – planen:** Assets anlegen oder importieren, Typ und Betriebssystem zuordnen, Bausteine modellieren und den Schutzbedarf für Vertraulichkeit, Integrität und Verfügbarkeit begründen. Bibliotheken und Vorgehensweise auswählen; Risiken und Risikoappetit erfassen.
3. **Do – umsetzen:** Checkliste bearbeiten. Verantwortliche, Fristen, Nachweise und begründete Ausnahmen dokumentieren. Prüfbefehle auf dem jeweiligen Zielsystem selbst ausführen; die Anwendung führt keine Härtung oder Scans auf den Systemen aus.
4. **Check – prüfen:** Extern erzeugte Scan-Berichte importieren, Zuordnungen kontrollieren und Befunde bewerten. Wirksamkeitskontrolle, Gap-Analyse und KPI-Dashboard nutzen.
5. **Act – verbessern:** Roadmap priorisieren, Risikoentscheidungen und Reviews festhalten und Berichte exportieren.
6. **BCM ergänzen:** Kritische Prozesse in der BIA untersuchen, Wiederanlaufziele festlegen, BC-Pläne und Krisenstab pflegen sowie Übungen dokumentieren.
7. **Stand sichern:** JSON-Export herunterladen und regelmäßig eine Wiederherstellung in einem separaten Browserprofil prüfen.

## Funktionen

| Bereich | Was die Seite macht |
|---|---|
| **Assets / Geltungsbereiche** | Zielobjekte aller Schichten erfassen und nach Typ gruppiert anzeigen: 🏢 Informationsverbund & Prozesse (ISMS, ORP, CON, OPS, DER), 🧩 Anwendungen (APP), 🖥 IT-Systeme (SYS – Hostname, IP, OS, Rolle), 🏭 Industrielle IT (IND), 🌐 Netze (NET), 🏛 Infrastruktur (INF). **Modellierung**: je Zielobjekt die passenden der 111 IT-Grundschutz-Bausteine wählen (Vorschlag je Typ bzw. Betriebssystem). Liegen zu einem Baustein Einzelanforderungen vor (eingebaut, Kompendium-Import oder eigene), erscheinen diese; sonst eine Baustein-Gesamtbewertung. Bibliotheken (SSG, Baselines …) und Vorgehensweise (Basis / Standard / Kern) wie bisher; vorhandene Assets bleiben unverändert IT-Systeme. Import als CSV möglich. |
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
| **Branding** | Standard ist das Little-RiskBee-Logo. In den Einstellungen: eigenes Logo hochladen (PNG/JPG/WebP/SVG, lokal verkleinert), Abteilung, Anschrift, Kontakt, Webseite, Berichtstitel, Fußzeile/Einstufung und Akzentfarbe. Erscheint auf dem Berichtsdeckblatt, in Kopf-/Fußzeilen und optional im Kopf der Oberfläche. |
| **Darstellung** | Hell-/Dunkelmodus (automatisch oder manuell), responsiv für Desktop, Tablet und Smartphone, Deutsch/Englisch. **Style-Wechsler** in den Einstellungen: mitgelieferte Stile (`css/themes/`), eigener Pfad zu einer CSS-Datei oder hochgeladene CSS-Datei, Modus „ergänzen“ oder „ersetzen“. Gespeichert (Autosave/JSON) wird der Stil nur, wenn nicht der Standard verwendet wird. Notfall: `index.html?style=default`. |
| **Finding-Dashboard** | Pentest-Report-Generator: Findings anlegen (leer, aus 9 Vorlagen oder aus OpenVAS/Lynis-Scans), importieren (JSON, CSV mit deutschen/englischen Spaltennamen) und exportieren (JSON, CSV, Markdown). Je Finding: Schweregrad, **CVSS-v3.1-Rechner**, CWE, OWASP Top 10, betroffene Assets und Ziele, Verantwortung/Frist, Kurz-Empfehlung und Markdown-Abschnitte (Zusammenfassung, technische Beschreibung, Auswirkung, Reproduktion/PoC, Nachweise, Empfehlung, Referenzen, Re-Test-Notiz) – **links Markdown-Editor, rechts Live-Vorschau**, Bilder per Knopf oder Strg+V. Re-Test-Status/-Datum/-Prüfer. **Zwischenspeichern** mit Versionen (wiederherstellbar). **Eigene Felder** (Text, Markdown, Auswahl, Zahl, Datum, Ja/Nein, Link) und **eigene Berichtsabschnitte**, Reihenfolge frei. Finding **als Maßnahme** zu bestehendem oder neuem Asset; Re-Test „behoben“ setzt die Maßnahme auf umgesetzt/wirksam. Separater **A4-Pentest-Bericht** (Deckblatt, Dokumentenkontrolle, Inhaltsverzeichnis, Bewertungsschema, Ergebnisübersicht, Findings, Re-Test): drucken, als HTML speichern oder als PDF (Druckdialog). |
| **Risikobaum** | IT-Risikobaum als Fehlerbaum oder Angriffsbaum: Top-Ereignis über UND-/ODER-Verknüpfungen auf Basisereignisse zurückführen, Wahrscheinlichkeiten (je Jahr) sowie bei Angriffsbäumen Kosten und benötigtes Können erfassen, Gegenmaßnahmen mit Status und Wirksamkeit. Grafische Darstellung mit Gattersymbolen und kritischem Pfad, Wahrscheinlichkeit brutto/netto, minimale Schnittmengen inkl. Single Points of Failure, Bedeutung je Basisereignis („Wo ansetzen?“). Vier Vorlagen, Übernahme ins Risikoregister (Ereignisrate für Monte-Carlo), Export als SVG/JSON, Druck/PDF, Abschnitt im Bericht. |
| **Positiv-Bericht** | Bericht nur mit Erfolgen für Shareholder, Investoren, Sponsoren, Mitglieder, Kunden oder die Leitung: automatisch erzeugte, belegbare positive Aussagen (nicht positive werden weggelassen), je Aussage abschaltbar oder mit eigenem Text überschreibbar; vorbereitete Texte (Vorwort, Highlights, Ausblick, Dank, Kontakt, Schlusswort) mit Platzhaltern wie `{umsetzungsgrad}`, Textvorlagen je Zielgruppe, eigene Highlights und Meilensteine (plus automatische), Diagramme, Onepager-Variante. Systemnamen/IPs werden standardmäßig weggelassen, optionaler Transparenzhinweis. Drucken, PDF, HTML. |
| **Gap-Analyse** | Soll-Ist-Vergleich über alle Zielobjekte: Soll gemäß Vorgehensweise/Schutzbedarf je Asset oder einheitlich Basis / Standard / Standard + H. Erfüllung je Zielobjekt und Anforderungsniveau (B/S/H), Abdeckung des Schichtenmodells, **Modellierungslücken** (fehlende Schichten und Kern-Bausteine, Zielobjekte ohne Anforderungen, hoher Schutzbedarf ohne Risikoanalyse), **Lücken-Matrix** Baustein × Zielobjekt, priorisierte Maßnahmenlücken (P1–P3, Sprung in die Checkliste, CSV), Snapshots für den Verlauf, KPI „Erfüllung Basis-Anforderungen“, Abschnitt im Bericht. |
| **Glossar** | Alle 111 Bausteine der Edition 2023 nach Schichten (ISMS.1, ORP.1 … INF.14) mit Kurzbeschreibung, vorhandenen Einzelanforderungen und „Modelliert bei“, direkt auf Assets modellierbar; alle 47 elementaren Gefährdungen G 0.1–G 0.47 mit Verwendung im Risikoregister (dort jetzt vollständig als Vorschlagsliste); Fachbegriffe. Live-Suche, Schichtfilter, Druck/PDF. |
| **Ursachenanalyse (Fischgrätendiagramm)** | Ishikawa-Diagramm für Brainstorming und Root-Cause-Analyse: Wirkung im Kopf, Kategorien als Gräten (6M, 8M, IT-Sicherheit, 4S oder eigene, 2–8, Farbe frei). Notizen anlegen (Knopf oder Doppelklick), **per Maus/Touch verschieben** – beim Loslassen wird die Notiz der nächsten Gräte zugeordnet; Tastatur: Pfeiltasten, Entf. Je Notiz Farbe, Hauptursache ⭐, Stimmen (Dot-Voting), 5-Why-Kette und Gegenmaßnahme. Übersicht je Kategorie, Hauptursachen-Tabelle, Übernahme ins Risikoregister, Vorlagen (Ransomware-Vorfall, Patch-Rückstand), Export SVG/JSON, Import, Druck/PDF (A4 quer), Abschnitt im Bericht. |
| **Ansprechpersonen** | In den Einstellungen Personen mit Funktion, Kontakt, Notfallnummer und Vertretung anlegen. Alle Personenfelder (Verantwortliche, Risikoeigner, Prüfer, Krisenstab …) bieten sie als Drop-Down an – freie Eingabe bleibt möglich. „Namen aus Daten übernehmen“ sammelt bereits verwendete Namen. |
| **Risikoregister** | Führt eigene Risiken (frei definierbar, 4 × 4), Befundrisiken und Projektrisiken zusammen: Brutto/Netto, Behandlung, Eigner, Review-Termin, CSV-Export. Heatmaps mit Appetit- und Toleranzgrenze. |
| **Risikoappetit & Risikoakzeptanz** | Appetit-Erklärung, Appetit- und Toleranzgrenze (Kategorie), Verlustappetit/-toleranz in €, Akzeptanzbefugnis, maximale Gültigkeit und Review-Intervall je Kategorie. Formale Risikoakzeptanz (wer, Befugnis, Begründung, Auflagen, befristet) – über Toleranz nur als ausdrückliche Ausnahme der Leitung. Ampelstatus je Risiko (im Appetit, akzeptiert, Entscheidung fehlt, über Toleranz, abgelaufen). |
| **Monte-Carlo-Analyse** | Quantitative Simulation (Poisson-Häufigkeit × PERT-Schaden, 1 000–100 000 Jahre, reproduzierbar per Seed): Erwartungswert (ALE), P50/P90/P95/P99, Wahrscheinlichkeit über Verlusttoleranz, Verlustüberschreitungskurve, Histogramm, Beitrag je Risiko – brutto und netto. Eigene Dreipunktschätzungen oder Kalibrierung (Vorlagen klein/KMU/groß). |
| **Pflichten & Reviews** | Pflichtenkalender mit wiederkehrenden Pflichten (wöchentlich … alle 3 Jahre), Vorlagen für Normpflichten (ISO/IEC 27001, BSI, DSGVO, NIS2/BSIG, BSI 200-4), Erledigt-Historie mit Nachweis. Automatische Reviews: Risiken, ablaufende Akzeptanzen, Risikoappetit, Asset-Re-Audit, veraltete Scans, Roadmap-Termine, BIA/BC-Pläne/Übungen/Krisenstab, KPI-Erfassung. Agenda, Monatsansicht, Erinnerung (Zähler im Menü, Hinweis beim Start, optional Browser-Benachrichtigung) und **ICS-Export** mit Serienterminen und Alarmen für Outlook/Thunderbird/Apple. |
| **KPI-Dashboard** | 22 eingebaute Kennzahlen (Härtung, Schwachstellen, Risiko, Compliance, BCM) mit Ampel, Zielwert/Warnschwelle je KPI („Ziele setzen“), Verlauf (wöchentlich automatisch), eigene KPIs mit Messwerten und Erfassungsintervall sowie „Fehlende Daten & Datenqualität“ mit Sprung zur richtigen Stelle. |
| **Business-Impact-Analyse** | Je Geschäftsprozess Schadensverlauf über die Zeit (Kategorien × Zeitintervalle) → Vorschlag MTA/MTPD, geforderte Wiederanlaufzeit (WAZ/RTO, Prüfung RTO < MTA), RPO, Wiederanlaufniveau, Zeitkritikalität, Wiederanlaufpriorität, Zeitachse. Abhängige Assets erben die strengste RTO/RPO; Hinweis bei zu niedrigem Verfügbarkeits-Schutzbedarf. |
| **BC-Pläne** | Planart, Kontinuitätsstrategie, Aktivierungskriterien, Ablauf, Ressourcen, Kommunikation, Freigabe. **Ohne eigene Ziele übernimmt ein Plan RTO/RPO aus der BIA seines Geschäftsprozesses** (Warnung, wenn eigene Ziele lockerer sind). Letzte/nächste Übung und nachgewiesene Wiederanlaufzeit je Plan. |
| **Krisenstab** | Eskalationsstufen Störung → Notfall → Krise, Rollen/Stabsfunktionen (Leitung, S1–S6, Fachberatung) mit Person und Vertretung, Eskalationspfade (Auslöser, wer meldet/entscheidet/wird alarmiert, Reaktionszeit, Sofortmaßnahmen), Alarmierungskette und druckbare Alarmierungsliste. |
| **Übungen** | Planung (Übungsart, Ziele, Szenario, geübte Pläne), Durchführung (erreichte Wiederanlaufzeit, Datenverlust, Beobachtungen), Auswertung (Ergebnis, Lessons Learned), Maßnahmen mit Termin (→ Roadmap und Kalender), Jahresübungsplan mit fälligen Übungen. |


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

# little-riskbee
![Little RiskBee – IT risk management in your browser](./Little-RiskBee-GitHub-Banner.svg)

### **IT risk management, system hardening and business continuity in a local web application.**

[Deutsch](README.md) | **English**

**Little RiskBee** helps you inventory Windows, Linux and macOS systems and organizational target objects, plan security controls, evaluate scan results and document risks in an audit-ready manner.  
The interface follows the **PDCA cycle (Plan → Do → Check → Act)** and provides additional tools for business continuity management (BCM) and penetration testing reports.

The application is built entirely with HTML, CSS and JavaScript — no npm, build process, database installation or application server required. You can open it directly as a local file in your browser or deploy it using the included Docker container. You can switch the interface between German and English at any time (custom and imported content remains unchanged).

> **Important note on data storage:** All working data is stored exclusively in the current browser profile. Even when running through Docker, no working data is retained in the container, and there is no synchronization between people or devices. Regular JSON backups are therefore an essential part of the workflow.

## Who is Little RiskBee for?

| User profile | Typical use |
| :--- | :--- |
| **IT administrators focused on security** | Assess servers and clients using hardening checklists and thoroughly document implementation. |
| **Information security officers (ISOs)** | Prioritize risks, understand residual risks and monitor the effectiveness of implemented controls. |
| **Compliance managers** | Consolidate catalog requirements and internal policies, and prepare reliable audit evidence. |
| **Internal auditors** | Review implementation status, deviations and evidence of effectiveness for each system. |
| **Penetration testers** | Hand over findings from completed security assessments in a structured format and track remediation. |
| **IT security coordinators** | Coordinate controls across teams and keep track of responsibilities, deadlines and progress. |

## What Little RiskBee is not

- **Not a vulnerability scanner:** Vulnerability scans still run in your usual external tools. Little RiskBee imports their reports to assess findings and track remediation.
- **Not a SIEM:** The application helps you work with documented findings; it does not centrally collect and correlate logs and security events in real time.
- **Not real-time monitoring:** The security status shown is always based on the findings you enter, the reports you import and the checks you document.
- **Not a document management system (DMS):** Reports and evidence can be exported, but centralized storage, approval and version control take place outside the application.
- **Not a rigid, fixed-purpose product:** Little RiskBee is a modular, extensible tool that you can adapt to your environment using your own controls, catalogs and styles.

## Contents

- [Quick start](#quick-start)
- [Docker and Docker Compose](#docker-and-docker-compose)
- [First workflow](#first-workflow)
- [Features](#features)
- [Libraries](#libraries)
- [Imports and sample files](#imports-and-sample-files)
- [Saving and restoring](#saving-and-restoring)
- [Privacy](#privacy)
- [Project structure](#project-structure)
- [Extending the application](#extending-the-application)
- [Sources](#sources)

## Quick start

### Directly in your browser

1. Clone the repository or download it from GitHub as a ZIP archive and extract it completely.
2. Open `index.html` in a current browser (e.g. Chrome, Edge, Firefox or Safari).
3. Enter your project details under **Settings**, then create your first target objects under **Assets**.
4. Use **Save** to download your first JSON backup.

Keep all subdirectories together with `index.html`. Once downloaded, no internet connection is required.

> **Note on `file://`:** Some browsers restrict persistent local storage (`IndexedDB`/`localStorage`) when files are opened directly through `file://`. In that case, use Docker or a local web server, and export your existing work as a JSON file before switching.

## Docker and Docker Compose

### Requirements

- Git to clone the repository
- Docker with a running engine and the Compose plugin (`docker compose`), e.g. through Docker Desktop
- An available local port `8080`
- Internet access for cloning and the initial download of the Nginx base image

Check your installation:

```bash
git --version
docker --version
docker compose version
```

### Clone the repository, build the image and start

```bash
git clone https://github.com/marciifee/little-riskbee.git little-riskbee
cd little-riskbee
docker compose -f docker-compose.yaml config
docker compose -f docker-compose.yaml up -d --build
```

Then open the application in your browser at [http://localhost:8080](http://localhost:8080).

The included `docker-compose.yaml` defines the following service:

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

The `Dockerfile` copies the static files into the official Nginx image (no JavaScript build takes place). The application runs on port `80` inside the container and is exposed exclusively on the local host at `127.0.0.1:8080`. Neither an `.env` file nor Docker volumes are required. For further information, see the [Docker guide](https://docs.docker.com/compose/gettingstarted/) and the [official Nginx image](https://hub.docker.com/_/nginx).

### Operations, logs and shutdown with Compose

```bash
# Show container status
docker compose -f docker-compose.yaml ps

# Follow live logs (exit with Ctrl+C)
docker compose -f docker-compose.yaml logs -f

# Stop and remove the container
docker compose -f docker-compose.yaml down

# Start the container again
docker compose -f docker-compose.yaml up -d
```

`docker compose down` does not delete browser data. Conversely, a backup of the Docker container does not back up your working data — always use **Save** directly in the application for this.

### Updating

Before every update, back up your current work as a JSON file. In an unmodified Git clone, update the application as follows:

```bash
git pull --ff-only
docker compose -f docker-compose.yaml build --pull
docker compose -f docker-compose.yaml up -d
```

Then reload the page in your browser. Since `nginx:stable-alpine` is a moving tag, `--pull` also updates the base image. If you have made local changes to the source code, back them up before running `git pull` or merge them using your regular Git workflow.

## First workflow

1. **Prepare the project:** Maintain project details, contacts, branding and the report title in Settings.
2. **Plan:** Create or import assets, assign their type and operating system, model building blocks and justify protection needs (confidentiality, integrity, availability). Select libraries and an approach, and define risks and risk appetite.
3. **Do:** Work through the checklist and document owners, deadlines, evidence and justified exceptions. (Note: Execute check commands directly on the relevant target system — the application does not actively access systems.)
4. **Check:** Import externally generated scan reports, verify assignments and assess findings. Use effectiveness checks, gap analysis and the KPI dashboard to evaluate results.
5. **Act:** Prioritize the roadmap, record risk decisions and reviews, and export reports.
6. **Add BCM:** Examine critical processes in the business impact analysis (BIA), define recovery targets, maintain continuity plans and the crisis team, and document exercises.
7. **Back up your work:** Download a JSON export.

## Features

### Hardening, catalogs & audits

| Area | Capabilities |
|---|---|
| **Assets / scope** | Inventory target objects across all layers and group them by type: <br> 🏢 Information domains & processes (`ISMS`, `ORP`, `CON`, `OPS`, `DER`), 🧩 applications (`APP`), 🖥 IT systems (`SYS` — hostname, IP, OS, role), 🏭 industrial IT (`IND`), 🌐 networks (`NET`), 🏛 infrastructure (`INF`). <br> **Modeling:** Select applicable blocks from the 111 IT-Grundschutz building blocks for each target object (including automatic suggestions by type/OS). Where individual requirements are available (built in, imported from the Compendium or created manually), they appear directly; otherwise, assessment takes place at building-block level. CSV import is supported. |
| **Protection needs** | Assess confidentiality, integrity and availability for each asset (normal, high, very high), with a clear justification (BSI Standard 200-2, maximum principle). Automatically determines whether H requirements are displayed. |
| **Checklist** | Work through controls interactively: status (open, implemented, partial, not implemented/risk, dispensable/removed), mandatory justification for removal, notes, evidence, responsibilities, deadlines, check commands to copy and **effectiveness checks** (result, date, method, reviewer). Includes filters, grouping, bulk removal and custom controls. |
| **Libraries** | Detailed catalog comparison: number of controls by library and operating system, B/S/H breakdown, coverage matrix across 18 subject areas, original-source reference counts and contextual guidance. |
| **Guides** | Step-by-step hardening guides covering methodology, Debian/Ubuntu, Fedora/RHEL, Windows Server/Windows 11, macOS, and scans & evidence — including commands and links to the checklist. |
| **Gap analysis** | Compare target requirements with actual implementation across all target objects according to the selected approach/protection needs or a uniform target (basic, standard, standard + H). Shows fulfillment by asset and level (B/S/H), layer-model coverage, **modeling gaps** (missing layers/core blocks, assets without requirements, high protection needs without risk analysis), a **gap matrix** (building block × target object), prioritized control gaps (`P1–P3`, with checklist navigation and CSV export), historical snapshots and the “Basic requirement fulfillment” KPI. |
| **Glossary** | Reference for all 111 building blocks in Edition 2023 (including short descriptions, individual requirements and direct assignment to assets), all 47 elementary threats (`G 0.1–G 0.47`) and relevant terminology. Includes live search, layer filtering and print/PDF output. |

<br>

### Scans, risk management & simulation

| Area | Capabilities |
|---|---|
| **Scans & vulnerabilities** | Overview of all imported scans per asset with the scan timestamp from the report, import timestamp, filename and **SHA-256 checksum** as evidence of integrity. Finding status: open, partially resolved, resolved, risk accepted or false positive (each with justification). Findings no longer detected in subsequent scans are automatically marked as resolved; accepted risks are retained. |
| **Risk assessment** | All open, partially resolved and accepted findings from the latest scans, with risk ID (`R-001` …), target object, threat (suggestions from elementary threats `G 0.x`), occurrence frequency × impact (`4 × 4`, based on BSI Standard 200-3), heatmap (green → yellow → orange → red), treatment option (avoid, reduce, transfer, accept), control, risk owner and deadline. Synchronized bidirectionally with scan status; unassessed findings receive an automatic suggestion based on severity and protection needs. |
| **Risk register** | Brings together freely defined custom risks (`4 × 4`), finding risks and project risks — including inherent/residual assessment, treatment, owner, review date, CSV export and heatmaps with appetite and tolerance boundaries. |
| **Risk appetite & acceptance** | Define a risk appetite statement, appetite and tolerance thresholds, monetary loss appetite/tolerance in euros, acceptance authorities, maximum validity and review intervals. Formally document risk acceptance (approver, authority, justification, conditions, expiry) — exceeding tolerance is permitted only as an explicit management exception. Includes traffic-light status for each risk. |
| **Monte Carlo analysis** | Quantitative risk simulation (Poisson frequency × PERT loss, 1,000 to 100,000 simulated years, reproducible using a seed): calculates expected annual loss (ALE), percentiles (`P50`/`P90`/`P95`/`P99`) and the probability of exceeding loss tolerance. Visualized as a loss exceedance curve, histogram and risk contribution (inherent/residual), using your own three-point estimates or calibration templates (small, SME, large). |
| **Project risks, opportunities & SWOT** | **Risks (`1–5`):** Project risk analysis with cause, category, probability × impact, strategy, countermeasures, early warning indicator, owner, residual risk, before/after heatmaps and example templates. **Opportunities:** Probability × benefit assessment with strategies (exploit, enhance, share, accept) and a dedicated matrix. **SWOT analysis:** Strengths, weaknesses, opportunities and threats, including TOWS strategies and direct transfer of data from audit metrics, project risks and opportunities. |
| **Roadmap** | Prioritized action list (`P1 immediate` to `P4 next audit`) from open findings, open checklist items and project risks — with owner, deadline, overdue indicators and CSV export. |

<br>

### Penetration testing & root-cause analysis

| Area | Capabilities |
|---|---|
| **Finding dashboard** | Full-featured pentest report generator: create findings (from scratch, from 9 templates or from OpenVAS/Lynis scans), import (JSON, CSV) and export (JSON, CSV, Markdown). **Details:** Severity, integrated **CVSS v3.1 calculator**, CWE, OWASP Top 10, affected assets/targets, owner/deadline, brief recommendation and structured Markdown sections (summary, technical description, impact, reproduction/PoC, evidence, recommendation, references, retest note). **Editor & reports:** Split-screen Markdown editor on the left and live preview on the right, image upload using a button or `Ctrl+V`, versioned intermediate saves, custom fields and report sections. Findings can be adopted directly as hardening controls (a “resolved” retest marks the control as implemented/effective). Separate **A4 pentest report** with cover page, document control, table of contents, rating scheme, results overview, findings and retest. |
| **Risk tree** | Graphical IT risk tree (fault tree or attack tree): break down the top event into basic events using **`AND`/`OR` gates**, record annual occurrence probabilities and, for attack trees, costs and required attacker skill, and document countermeasures with their effectiveness. Calculates inherent/residual probability, critical path, minimal cut sets (including single points of failure) and the importance of each basic event (“Where to act?”). Includes 4 templates, transfer to the risk register (event rate for Monte Carlo) and SVG/JSON/PDF export. |
| **Root-cause analysis (fishbone diagram)** | Interactive Ishikawa diagram for brainstorming and root-cause analysis: effect at the head, categories as branches (`6M`, `8M`, `IT security`, `4S` or `2–8` custom categories with configurable colors). Create notes using a button or double-click and **move them freely using mouse/touch** (automatic assignment to the nearest branch), or control them using the keyboard (`arrow keys`, `Delete`). Each note supports color, root-cause marking (`⭐`), dot voting, a 5-Why chain and a countermeasure. Includes a root-cause table, transfer to the risk register, templates (ransomware incident, patch backlog), SVG/JSON export and A4 landscape printing. |

<br>

### Governance, compliance & business continuity (BCM)

| Area | Capabilities |
|---|---|
| **Duties & reviews** | Calendar for recurring duties (weekly to every 3 years), with templates for standards-related obligations (ISO/IEC 27001, BSI, GDPR, NIS2/BSIG, BSI 200-4) and completion history including evidence. Automatic review reminders for risks, expiring acceptances, risk appetite, asset re-audits, outdated scans, roadmap deadlines, BIA/continuity plans/exercises/crisis team and KPI collection. Agenda and month views, menu counters, optional browser notifications and **ICS export** with recurring events and alarms for Outlook, Thunderbird and Apple Calendar. |
| **KPI dashboard** | 22 built-in metrics covering hardening, vulnerabilities, risk, compliance and BCM, with traffic-light status, configurable targets/warning thresholds (“Set targets”) and automatic weekly history. Also supports custom KPIs with measurements and collection intervals, plus a “Missing data & data quality” overview linking directly to the relevant input form. |
| **TOM overview** | Structured overview and report output showing implementation of technical and organizational measures (TOMs) by category under Article 32 GDPR. |
| **Business impact analysis (BIA)** | Impact over time for each business process (impact categories × time intervals), with automatic suggestions for maximum tolerable downtime (`MTA`/`MTPD`), required recovery time (`WAZ`/`RTO`, including an `RTO` < `MTA` check), `RPO`, recovery level, time criticality, recovery priority and a visual timeline. Dependent assets automatically inherit the strictest `RTO`/`RPO`; a warning appears if availability protection needs are too low. |
| **Continuity plans** | Document plan type, continuity strategy, activation criteria, procedures, resources, communication and approval. Without its own targets, a plan automatically inherits `RTO`/`RPO` from the linked business process's BIA (and warns if custom targets are less demanding). Includes tracking of the last/next exercise and demonstrated recovery time. |
| **Crisis team** | Define escalation levels (disruption → emergency → crisis), staff roles (`leadership`, `S1–S6`, `specialist department`) with assigned people and deputies, escalation paths (triggers, reporting/decision/notification channels, response time, immediate actions), and a notification chain with a printable callout list. |
| **Exercises** | Structured planning (exercise type, objectives, scenario, plans tested), execution (achieved recovery time, data loss, observations) and evaluation (result, lessons learned, follow-up actions with deadlines for the roadmap and calendar), plus an annual exercise plan with an overview of due dates. |

<br>

### Reports, appearance & system

| Area | Capabilities |
|---|---|
| **Report (A4)** | Standalone A4 portrait report as an HTML file (project details, protection needs, metrics, controls including effectiveness, deviations with justification, scans with hashes, TOM overview, risk assessment with heatmap, project risks, roadmap and signature field) — ready to print or save as PDF. |
| **Positive report** | Audience-specific success report for shareholders, investors, sponsors, members, customers or management: automatically generates evidence-based positive statements (nonpositive items are hidden), each of which can be disabled or overridden. Includes customizable text sections (foreword, highlights, outlook, acknowledgments, contact, closing remarks) with placeholders such as `{umsetzungsgrad}`, audience templates, custom milestones, charts and a one-page variant. Sensitive system names and IP addresses are hidden by default. |
| **Contacts** | Centrally maintain people with roles, contact details, emergency numbers and deputies in Settings. All person fields (owners, risk owners, reviewers, crisis team, etc.) offer these as dropdown suggestions (free-text entry remains possible). “Collect names from data” gathers names already used in the project. |
| **Branding** | The Little-RiskBee logo is used by default. In Settings, you can upload your own logo (`PNG`, `JPG`, `WebP`, `SVG` — resized locally) and configure department, address, contact, website, report title, footer/classification and accent color. |
| **Appearance** | Automatic or manual light/dark mode, responsive layouts for desktop, tablet and smartphone, and language switching (DE/EN). The **style switcher** loads bundled themes (`css/themes/`), custom CSS paths or uploaded CSS files in “supplement” or “replace” mode. Emergency reset via `index.html?style=default`. |
| **Saving** | Continuous automatic browser storage (`IndexedDB` with a `localStorage` fallback). Additional manual export using **💾 Save** or `Ctrl+S` as a JSON file, and restoration using **📂 Load**. |

## Libraries

| Library | Availability in the application | Notes |
|---|---|---|
| **BSI IT-Grundschutz Compendium, Edition 2023** | **Built in:** `SYS.1.1`, `SYS.1.2.3`, `SYS.1.3`, `SYS.2.1`, `SYS.2.2.3`, `SYS.2.3`, `SYS.2.4` (excluding withdrawn requirements) | Titles reproduce the source wording; descriptions are shortened paraphrases — the original BSI text is authoritative. Import the Compendium (XML/text) for additional building blocks. |
| **BSI Grundschutz++** | **Via import (OSCAL)** | Import a catalog from the BSI GitHub repository “Stand-der-Technik-Bibliothek” (`CC BY-SA 4.0`); security level (`normal-SdT/erhöht`), effort and modal verb are extracted. |
| **OpenSCAP SCAP Security Guide** | **Built in:** Curated subset (87 rules, actual rule IDs, BSI mappings according to ComplianceAsCode) | Import complete profiles through a datastream. OpenSCAP results automatically update status. |
| **Microsoft Security Baseline** | **Built in:** Curated selection | Full baseline: Security Compliance Toolkit. |
| **mSCP (macOS, NIST)** | **Built in:** Curated selection | Rule IDs may vary between macOS versions. |
| **CIS, DISA STIG, ANSSI BP-028** | **Via import (XCCDF or SSG profiles)** | CIS requires a license for commercial use and is therefore not bundled. |
| **Custom controls** | **Create directly in the checklist** | For example, based on Lynis recommendations or through CSV catalog import. |

## Imports and sample files

Select or drag files into **Import**. Choose the format explicitly if necessary. The file extension alone is not sufficient: XML, JSON and CSV must match a supported report or catalog format. Restore a complete project backup using **Load**.

| Data source | Supported content / use |
|---|---|
| Nmap | XML (`-oX`), grepable (`-oG`), text (`-oN`); hosts and open ports |
| Lynis | `report.dat` and `lynis.log` |
| OpenVAS / Greenbone | XML and CSV reports |
| OpenSCAP | Results / ARF; matching rule results update the checklist |
| SSG / XCCDF | Datastream or benchmark; select a profile and import rules |
| OSCAL | JSON/XML catalogs, e.g. for Grundschutz++ |
| BSI Compendium | Supported XML/text structures for additional requirements |
| CSV | Assets, custom control catalogs or findings |
| Finding dashboard | Dedicated JSON/CSV import and export for findings |

### Guided trial

The [samples/](samples/) directory contains fictional sample files you can use to explore the application's features:

1. Import [assets-beispiel.csv](samples/assets-beispiel.csv) to create the sample systems `web01`, `db01` and `mac-01`.
2. Import [nmap-web01.xml](samples/nmap-web01.xml), [lynis-report-web01.dat](samples/lynis-report-web01.dat), [openvas-web01.xml](samples/openvas-web01.xml) and [openvas-db01.csv](samples/openvas-db01.csv), and check automatic matching by hostname and IP address.
3. Use [nmap-netz-beispiel.nmap](samples/nmap-netz-beispiel.nmap) to try processing a scan covering multiple hosts.
4. Use [xccdf-benchmark-beispiel.xml](samples/xccdf-benchmark-beispiel.xml) for profile selection and [oscap-results-web01.xml](samples/oscap-results-web01.xml) for automated scan results (note: rule matching only applies to catalogs previously assigned to the relevant asset).
5. Try [oscal-katalog-beispiel.json](samples/oscal-katalog-beispiel.json) — this file demonstrates the structure of an OSCAL catalog using fictional sample content.

## Saving and restoring

- **Autosave:** Changes are saved continuously in `IndexedDB` (or `localStorage` as a fallback). If neither is available (e.g. due to restrictive browser settings), data remains only in temporary memory — make sure to save your work regularly as a file.
- **Backup:** Use **💾 Save** or `Ctrl+S` / `Cmd+S` to export the entire project as `little-riskbee_<date>.json`.
- **Restore / migrate:** Use **📂 Load** to select a JSON backup and confirm replacement of the current state. Back up your existing work first, as projects are not merged.
- **Reports:** HTML reports, PDF printouts and CSV files are intended solely for analysis and sharing — they do not replace a complete JSON backup.
- **Delete:** Use **Settings → Delete all local data** to remove all application data stored locally in the browser. Delete previously downloaded JSON backups separately if required.

> **Security note:** Browser profiles, private browsing, clearing website data and storage quotas affect local availability. Keep JSON backups in a protected location outside the project directory, as these files are stored without encryption.

### Interpreting the results

- Built-in catalogs and templates support practical work but do not replace complete original standards or independent assessment. A generated report is not an official certification.
- The included BSI requirements are based on **Edition 2023**. An overview of all 111 building blocks does not mean that every individual requirement in every block is preinstalled.
- Finding risk assessments and custom register risks use a `4×4 matrix`; project risks use a `5×5 matrix`. Monte Carlo simulation results depend heavily on the estimates provided.
- When new scans are imported, findings no longer detected are automatically marked as resolved. Before approving this assessment, always check whether scan scope and depth are comparable to the previous run.
- Preconfigured duty intervals, BIA thresholds and simulation calibrations provide guidance and must be adapted to your organization.
- In-app reminders require an open tab and, where applicable, browser notification permission. For reliable reminders when the browser is closed, export dates as an ICS file to your calendar (note: changes to the duties calendar require another ICS export; how existing events are updated depends on the calendar application).

## Privacy

- **100% local processing:** All working data stays in your browser. When running through Docker, Nginx only serves the static application files. No cookies, trackers, external CDNs or webfonts are used.
- **Strict Content Security Policy:** The configured CSP (`connect-src 'none'`) blocks outgoing application connections through APIs such as `fetch`, `XMLHttpRequest` and `WebSocket`.
- **Data storage:** Data is stored exclusively in your browser's `IndexedDB`/`localStorage` and in the JSON files you export manually.
- **Confidentiality:** Exported backups and reports contain security-sensitive information about your infrastructure and should be handled confidentially.

## Project structure

```text
README.md               German project documentation
README.en.md            English documentation
Dockerfile              Nginx image containing static application files
docker-compose.yaml     Local Docker deployment on port 8080
.dockerignore           Restricts the build context to application files
index.html              Main file
assets/                 Logo (little-riskbee.svg, PNG 512) and favicons (SVG, ICO, PNG, Apple Touch Icon)
js/data/logo.js         Default logo as a data URI (header and report, unless a custom logo is uploaded)
css/style.css           Layout, light/dark modes, responsive design, printing
js/i18n.js              DE/EN text
js/data/libraries.js    Operating systems, topic taxonomy, library metadata
js/data/catalog-bsi.js  BSI requirements (Edition 2023)
js/data/catalog-ssg.js  OpenSCAP SSG rules
js/data/catalog-extra.js Microsoft Baseline, mSCP
js/data/guides.js       Guides
js/storage.js           IndexedDB / localStorage / file export
js/parsers.js           All import formats
js/report.js            A4 report
js/risk.js              Risk assessment, project risks, roadmap, TOM
js/data/checks.js       Extended check commands (by platform/distribution)
js/app.js               Interface and logic, extension API (HA.App.ext)
js/modules/kit.js       Shared helpers (forms, dates), contacts
js/modules/register.js  Risk register, risk appetite, risk acceptance
js/modules/montecarlo.js Monte Carlo analysis
js/modules/calendar.js  Duties calendar, reviews, reminders, ICS export
js/modules/kpi.js       KPI dashboard, targets, missing data
js/modules/bcm.js       BIA, continuity plans, crisis team, exercises
js/modules/theme.js     Style switcher
js/modules/markdown.js  Markdown renderer (custom secure code: HTML escaped, local images only)
js/modules/findings.js  Finding dashboard, editor, CVSS calculator, import/export, control creation
js/modules/findings-report.js  A4 pentest report and Markdown export
js/data/finding-templates.js   Templates for common pentest findings, OWASP Top 10
js/modules/risktree.js  IT risk tree (fault/attack trees, cut sets, SVG)
js/modules/posreport.js Positive report (automatic successes, text templates, A4)
js/data/gs-glossary.js  IT-Grundschutz reference data: target types, 10 layers, 111 blocks, 47 threats, terms
js/modules/gap.js       Gap analysis (target vs. actual, modeling gaps, matrix, snapshots)
js/modules/glossary.js  Glossary (building blocks, threats, terms)
js/modules/fishbone.js  Root-cause analysis / fishbone diagram (Ishikawa, drag & drop, 5-Why)
css/themes/             Additional styles (honey, contrast, compact) + README
samples/                Fictional sample files to try
```

## Extending the application

- **New BSI requirement:** Add a line in `catalog-bsi.js`: `B('ID', 'B|S|H', [platforms], 'server|client|any', 'topic', 'German title', 'English title', 'Description', {check:{linux:'…'}})`.
- **Change check commands:** Edit `js/data/checks.js` — keys are `linux`/`windows`/`macos`, or distribution-specific `debian`/`ubuntu`/`fedora`/`rhel` (which take precedence).
- **New SSG rule:** Add an entry using `S(…)` in `catalog-ssg.js`; the rule ID must match the SSG ID so that OpenSCAP results can be mapped.
- **Custom catalog without coding:** Import a CSV file with columns `id;title;description;level;os;topic;check`.
- **New language:** Add another dictionary in `i18n.js` and extend language selection accordingly.
- **New import format:** Write a function in `parsers.js` and connect it to `detectAndParse()`.
- **New module:** Create a file in `js/modules/` (load it after `app.js`) and register it using `HA.App.views` (view), `HA.App.ext` for `click`/`change`/`input` (events, `true` = handled), `normalize` (initialize the data section), `settingsCards`, `dashCards`, `reportOpts` + `HA.Report.ext` (report section), `HA.Cal.providers` (dates) and `HA.Risk.roadmapSources` (roadmap).
- **Custom standards-related duty template:** Add it to the `TEMPLATES` array in `js/modules/calendar.js`.
- **Custom style:** See the [theme guide](css/themes/README.md).

## Sources

- [BSI IT-Grundschutz Compendium](https://www.bsi.bund.de) (Edition 2023)
- [BSI Grundschutz++ / Stand-der-Technik-Bibliothek](https://github.com/BSI-Bund/Stand-der-Technik-Bibliothek)
- [ComplianceAsCode / SCAP Security Guide](https://github.com/ComplianceAsCode/content)
- [Microsoft Security Baselines](https://learn.microsoft.com/windows/security/)
- [macOS Security Compliance Project](https://github.com/usnistgov/macos_security)
- [Lynis](https://cisofy.com/lynis/) · [Nmap](https://nmap.org) · [Greenbone Community Edition](https://greenbone.github.io/docs/)
- [Docker Compose](https://docs.docker.com/compose/gettingstarted/), [Nginx Docker Official Image](https://hub.docker.com/_/nginx)

---

The German version of this project documentation is available in [README.md](README.md).

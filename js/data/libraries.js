/* =====================================================================
 * libraries.js – Stammdaten: Betriebssysteme, Themen-Taxonomie und
 *                Bibliotheks-Metadaten (BSI, Grundschutz++, SSG, …)
 * ---------------------------------------------------------------------
 * Alle Skripte hängen sich an den globalen Namensraum "HA" (Hardening
 * Audit). Es werden bewusst KEINE ES-Module verwendet, weil Browser
 * Module beim Öffnen per file:// (Doppelklick auf index.html) blockieren.
 * ===================================================================== */
window.HA = window.HA || {};

/* ---------------------------------------------------------------------
 * Betriebssysteme eines Assets. "family" steuert, welche Maßnahmen und
 * Prüfbefehle angezeigt werden (windows | linux | macos).
 * ------------------------------------------------------------------- */
HA.OS = [
  { id: 'win-server', family: 'windows', role: 'server', de: 'Windows Server (2016–2025)', en: 'Windows Server (2016–2025)' },
  { id: 'win-client', family: 'windows', role: 'client', de: 'Windows 10/11 (Client)',     en: 'Windows 10/11 (client)' },
  { id: 'debian',     family: 'linux',   role: 'server', de: 'Debian (12/13)',              en: 'Debian (12/13)' },
  { id: 'ubuntu',     family: 'linux',   role: 'server', de: 'Ubuntu LTS (22.04/24.04)',    en: 'Ubuntu LTS (22.04/24.04)' },
  { id: 'fedora',     family: 'linux',   role: 'server', de: 'Fedora',                      en: 'Fedora' },
  { id: 'rhel',       family: 'linux',   role: 'server', de: 'RHEL / Alma / Rocky (9/10)',  en: 'RHEL / Alma / Rocky (9/10)' },
  { id: 'linux-other',family: 'linux',   role: 'server', de: 'Anderes Linux/Unix',          en: 'Other Linux/Unix' },
  { id: 'macos',      family: 'macos',   role: 'client', de: 'macOS',                       en: 'macOS' }
];
HA.osById = function (id) { return HA.OS.find(function (o) { return o.id === id; }) || HA.OS[2]; };

/* ---------------------------------------------------------------------
 * Gemeinsame Themen-Taxonomie. Jede Maßnahme jeder Bibliothek wird
 * genau einem Thema zugeordnet. Darüber vergleicht die Webseite, welche
 * Bibliothek welche Themen abdeckt ("Abdeckungsmatrix").
 * ------------------------------------------------------------------- */
HA.TOPICS = [
  { id: 'planning',     de: 'Planung, Richtlinien & Dokumentation', en: 'Planning, policies & documentation' },
  { id: 'install',      de: 'Sichere Installation & Grundkonfiguration', en: 'Secure installation & baseline config' },
  { id: 'patch',        de: 'Updates & Patchmanagement',            en: 'Updates & patch management' },
  { id: 'accounts',     de: 'Konten & Authentisierung',             en: 'Accounts & authentication' },
  { id: 'privilege',    de: 'Rechte & Dateiberechtigungen',         en: 'Privileges & file permissions' },
  { id: 'remote',       de: 'Fernzugriff (SSH/RDP)',                en: 'Remote access (SSH/RDP)' },
  { id: 'network',      de: 'Firewall & Netzwerk',                  en: 'Firewall & network' },
  { id: 'services',     de: 'Dienste & Komponenten minimieren',     en: 'Minimise services & components' },
  { id: 'logging',      de: 'Protokollierung & Audit',              en: 'Logging & auditing' },
  { id: 'malware',      de: 'Schutz vor Schadsoftware',             en: 'Malware protection' },
  { id: 'exploit',      de: 'Exploit-, Kernel- & Anwendungsschutz', en: 'Exploit, kernel & app protection' },
  { id: 'crypto',       de: 'Verschlüsselung & Zertifikate',        en: 'Encryption & certificates' },
  { id: 'boot',         de: 'Bootvorgang & Firmware',               en: 'Boot process & firmware' },
  { id: 'media',        de: 'Schnittstellen & Wechseldatenträger',  en: 'Interfaces & removable media' },
  { id: 'integrity',    de: 'Integrität & Angriffserkennung',       en: 'Integrity & intrusion detection' },
  { id: 'availability', de: 'Verfügbarkeit, Monitoring & Notfall',  en: 'Availability, monitoring & contingency' },
  { id: 'privacy',      de: 'Telemetrie, Cloud & Datenschutz',      en: 'Telemetry, cloud & privacy' },
  { id: 'lifecycle',    de: 'Beschaffung & Außerbetriebnahme',      en: 'Procurement & decommissioning' }
];
HA.topicById = function (id) { return HA.TOPICS.find(function (t) { return t.id === id; }) || { id: id, de: id, en: id }; };

/* ---------------------------------------------------------------------
 * Bibliotheken. "builtin" = Inhalte liegen in js/data/catalog-*.js.
 * "importOnly" = Inhalte müssen aus der offiziellen Quelle importiert
 * werden (z. B. Grundschutz++ als OSCAL-JSON, CIS/STIG als XCCDF).
 * "reference" = öffentlich publizierte Gesamtzahlen zum Vergleich.
 * ------------------------------------------------------------------- */
HA.LIBRARIES = [
  {
    id: 'bsi2023', short: 'BSI GS 2023', color: '#1f6feb', builtin: true,
    name: { de: 'BSI IT-Grundschutz-Kompendium, Edition 2023', en: 'BSI IT-Grundschutz Compendium, Edition 2023' },
    desc: {
      de: 'Letzte Edition des klassischen Kompendiums (111 Bausteine in 10 Schichten), weiterhin zertifizierungsrelevant bis zum vollständigen Übergang auf Grundschutz++. Eingebaut sind die System-Bausteine SYS.1.1, SYS.1.2.3, SYS.1.3, SYS.2.1, SYS.2.2.3, SYS.2.3 und SYS.2.4 (ohne entfallene Anforderungen). Titel wörtlich, Beschreibungen sinngemäß – maßgeblich ist der Originaltext des BSI.',
      en: 'Last edition of the classic compendium (111 modules in 10 layers), still relevant for certification until Grundschutz++ fully replaces it. Built in: system modules SYS.1.1, SYS.1.2.3, SYS.1.3, SYS.2.1, SYS.2.2.3, SYS.2.3 and SYS.2.4 (eliminated requirements removed). Titles verbatim (German), descriptions paraphrased – the BSI original is authoritative.'
    },
    license: 'BSI – frei abrufbar',
    url: 'https://www.bsi.bund.de/DE/Themen/Unternehmen-und-Organisationen/Standards-und-Zertifizierung/IT-Grundschutz/IT-Grundschutz-Kompendium/it-grundschutz-kompendium_node.html',
    reference: { de: 'Gesamtes Kompendium: 111 Bausteine', en: 'Full compendium: 111 modules' }
  },
  {
    id: 'gspp', short: 'Grundschutz++', color: '#0b7a75', builtin: false, importOnly: true,
    name: { de: 'BSI Grundschutz++ (Anwenderkatalog, OSCAL)', en: 'BSI Grundschutz++ (user catalogue, OSCAL)' },
    desc: {
      de: 'Neuer, maschinenlesbarer Nachfolger (Methodik als BSI-Standard 300-1). Der Katalog wird vom BSI im GitHub-Repository „Stand-der-Technik-Bibliothek“ als OSCAL (JSON/XML) unter CC BY-SA 4.0 gepflegt. Importieren Sie die Katalog-JSON-Datei über „Import“ – die Webseite liest Anforderungen, Sicherheitsniveau (normal-SdT / erhöht) und Aufwand automatisch aus.',
      en: 'New machine-readable successor (methodology published as BSI Standard 300-1). The catalogue is maintained by BSI in the GitHub repository "Stand-der-Technik-Bibliothek" as OSCAL (JSON/XML) under CC BY-SA 4.0. Import the catalogue JSON via "Import" – requirements, security level (normal-SdT / elevated) and effort are read automatically.'
    },
    license: 'CC BY-SA 4.0',
    url: 'https://github.com/BSI-Bund/Stand-der-Technik-Bibliothek',
    reference: { de: 'Anwenderkatalog (Stand 04/2026): 998 Anforderungen – 772 normal-SdT, 226 erhöht', en: 'User catalogue (04/2026): 998 requirements – 772 normal-SdT, 226 elevated' }
  },
  {
    id: 'ssg', short: 'OpenSCAP SSG', color: '#c2410c', builtin: true,
    name: { de: 'OpenSCAP – SCAP Security Guide (ComplianceAsCode)', en: 'OpenSCAP – SCAP Security Guide (ComplianceAsCode)' },
    desc: {
      de: 'Automatisiert prüfbare Regeln (OVAL) inkl. Bash-/Ansible-Remediation für RHEL, Fedora, Debian, Ubuntu u. a. Profile u. a.: CIS, DISA STIG, ANSSI BP-028, PCI-DSS sowie BSI SYS.1.1/SYS.1.3 (RHEL 9/10). Eingebaut ist ein kuratierter Auszug mit echten Regel-IDs; für die vollständige Regelmenge eines Profils den SSG-Datastream (ssg-<produkt>-ds.xml) importieren. Ergebnisse von „oscap xccdf eval --results“ setzen den Status automatisch.',
      en: 'Automatically checkable rules (OVAL) incl. Bash/Ansible remediation for RHEL, Fedora, Debian, Ubuntu and more. Profiles incl. CIS, DISA STIG, ANSSI BP-028, PCI-DSS and BSI SYS.1.1/SYS.1.3 (RHEL 9/10). Built in: curated extract with real rule IDs; import the SSG datastream (ssg-<product>-ds.xml) for the full rule set of a profile. Results of "oscap xccdf eval --results" set the status automatically.'
    },
    license: 'BSD-3-Clause',
    url: 'https://github.com/ComplianceAsCode/content',
    reference: { de: 'Vollständige Regelanzahl je Profil → Datastream importieren', en: 'Full rule count per profile → import the datastream' }
  },
  {
    id: 'msbaseline', short: 'MS Baseline', color: '#7c3aed', builtin: true,
    name: { de: 'Microsoft Security Baseline (Security Compliance Toolkit)', en: 'Microsoft Security Baseline (Security Compliance Toolkit)' },
    desc: {
      de: 'Von Microsoft empfohlene Gruppenrichtlinien für Windows Server und Windows 11. Eingebaut ist eine kuratierte Auswahl der wichtigsten Einstellungen; die vollständigen GPOs liefert das kostenlose Security Compliance Toolkit (Policy Analyzer, LGPO).',
      en: 'Group policy settings recommended by Microsoft for Windows Server and Windows 11. Built in: curated selection of the most important settings; full GPOs are shipped with the free Security Compliance Toolkit (Policy Analyzer, LGPO).'
    },
    license: 'Microsoft (kostenlos)',
    url: 'https://learn.microsoft.com/windows/security/operating-system-security/device-management/windows-security-configuration-framework/windows-security-baselines',
    reference: { de: 'Vollständige Baseline: mehrere hundert GPO-Einstellungen', en: 'Full baseline: several hundred GPO settings' }
  },
  {
    id: 'mscp', short: 'mSCP (macOS)', color: '#db2777', builtin: true,
    name: { de: 'macOS Security Compliance Project (mSCP, NIST)', en: 'macOS Security Compliance Project (mSCP, NIST)' },
    desc: {
      de: 'Open-Source-Projekt von NIST/NASA/DISA u. a. zur Härtung von macOS mit Baselines (CIS, 800-53, STIG …), Prüfskripten und Konfigurationsprofilen. Eingebaut ist eine kuratierte Auswahl gängiger Regeln.',
      en: 'Open-source project by NIST/NASA/DISA et al. for macOS hardening with baselines (CIS, 800-53, STIG …), check scripts and configuration profiles. Built in: curated selection of common rules.'
    },
    license: 'Public Domain / CC0 (US-Gov)',
    url: 'https://github.com/usnistgov/macos_security',
    reference: { de: 'Vollständige Baselines → per XCCDF/CSV importierbar', en: 'Full baselines → importable via XCCDF/CSV' }
  },
  {
    id: 'cis', short: 'CIS Benchmarks', color: '#475569', builtin: false, importOnly: true,
    name: { de: 'CIS Benchmarks', en: 'CIS Benchmarks' },
    desc: {
      de: 'Weit verbreitete Härtungs-Benchmarks (Level 1 ≈ normaler, Level 2 ≈ erhöhter Schutzbedarf). Inhalte sind lizenzpflichtig für kommerzielle Nutzung und daher nicht eingebaut. Praktisch: Die SSG-Profile „cis_*“ (z. B. Ubuntu 24.04, Debian 12/13, RHEL 9) automatisieren CIS – SSG-Datastream oder XCCDF importieren.',
      en: 'Widely used hardening benchmarks (Level 1 ≈ normal, Level 2 ≈ elevated protection needs). Content is licensed for commercial use and therefore not built in. Practical: SSG "cis_*" profiles (e.g. Ubuntu 24.04, Debian 12/13, RHEL 9) automate CIS – import the SSG datastream or XCCDF.'
    },
    license: 'CC BY-NC-SA 4.0 (nicht-kommerziell)',
    url: 'https://www.cisecurity.org/cis-benchmarks',
    reference: { de: 'Je Benchmark i. d. R. 200–400 Empfehlungen', en: 'Typically 200–400 recommendations per benchmark' }
  },
  {
    id: 'stig', short: 'DISA STIG', color: '#334155', builtin: false, importOnly: true,
    name: { de: 'DISA STIG (US-Verteidigungsministerium)', en: 'DISA STIG (US DoD)' },
    desc: {
      de: 'Sehr strenge, gemeinfreie Härtungsvorgaben (XCCDF) für Windows, RHEL, Ubuntu u. v. m. Eher für sehr hohen Schutzbedarf. Import der STIG-XCCDF-Datei oder des SSG-Profils „stig“.',
      en: 'Very strict public-domain hardening guides (XCCDF) for Windows, RHEL, Ubuntu and more. Suited for very high protection needs. Import the STIG XCCDF file or the SSG "stig" profile.'
    },
    license: 'Public Domain',
    url: 'https://public.cyber.mil/stigs/',
    reference: { de: 'Je STIG meist 150–350 Regeln', en: 'Usually 150–350 rules per STIG' }
  },
  {
    id: 'anssi', short: 'ANSSI BP-028', color: '#0369a1', builtin: false, importOnly: true,
    name: { de: 'ANSSI BP-028 (Linux-Konfigurationsempfehlungen)', en: 'ANSSI BP-028 (Linux configuration recommendations)' },
    desc: {
      de: 'Empfehlungen der französischen Cybersicherheitsbehörde mit den Stufen minimal / intermediary / enhanced / high. In SSG als Profile „anssi_bp28_*“ für RHEL, Debian u. a. enthalten – Datastream importieren.',
      en: 'Recommendations of the French cybersecurity agency with levels minimal / intermediary / enhanced / high. Included in SSG as "anssi_bp28_*" profiles for RHEL, Debian and others – import the datastream.'
    },
    license: 'Etalab 2.0 (offen)',
    url: 'https://cyber.gouv.fr/publications/configuration-recommendations-gnulinux-system',
    reference: { de: 'ca. 80 Empfehlungen (R1 … R80)', en: 'approx. 80 recommendations (R1 … R80)' }
  },
  {
    id: 'custom', short: 'Eigene', color: '#15803d', builtin: true,
    name: { de: 'Eigene Maßnahmen', en: 'Custom measures' },
    desc: {
      de: 'Eigene, institutionsspezifische Maßnahmen (z. B. aus Lynis-Vorschlägen oder internen Richtlinien). Werden in der Checkliste per „+ Eigene Maßnahme“ angelegt.',
      en: 'Own, organisation-specific measures (e.g. from Lynis suggestions or internal policies). Created in the checklist via "+ Custom measure".'
    },
    license: '—', url: '', reference: null
  }
];
HA.libById = function (id) {
  return HA.LIBRARIES.find(function (l) { return l.id === id; }) ||
    { id: id, short: id, color: '#64748b', name: { de: id, en: id }, desc: { de: '', en: '' } };
};

/* Status-Werte einer Maßnahme in der Checkliste */
HA.STATUS = ['open', 'done', 'partial', 'notdone', 'na'];

/* Status-Werte eines Schwachstellen-Befundes */
HA.FINDING_STATUS = ['open', 'partial', 'fixed', 'accepted', 'falsepositive'];

/* Schutzbedarfskategorien nach BSI-Standard 200-2 */
HA.PROTECTION = ['normal', 'high', 'veryhigh'];

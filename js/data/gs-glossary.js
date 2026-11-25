/* =====================================================================
 * gs-glossary.js – Stammdaten IT-Grundschutz: Schichten, Zielobjekt-
 *                  Typen, alle 111 Bausteine (Edition 2023), die 47
 *                  elementaren Gefährdungen und Fachbegriffe
 * ---------------------------------------------------------------------
 * Quelle: BSI IT-Grundschutz-Kompendium, Edition 2023 (Bausteinliste,
 * Titel wörtlich) und „Elementare Gefährdungen“ (G 0.1 – G 0.47).
 * Die Kurzbeschreibungen sind eigene, sinngemäße Zusammenfassungen –
 * maßgeblich sind die Originaltexte des BSI.
 *
 * Verwendung:
 *   HA.GS.KINDS      – Zielobjekt-Typen eines Assets (Geltungsbereiche)
 *   HA.GS.LAYERS     – Schichten des Kompendiums mit Zuordnung zum Typ
 *   HA.GS.BAUSTEINE  – [{ id, layer, de, en, d:{de,en} }]
 *   HA.GS.THREATS    – [{ id:'G 0.1', de, en, d:{de,en} }]
 *   HA.GS.TERMS      – Glossar-Begriffe
 *   HA.GS.byId(id), HA.GS.layerOf(id), HA.GS.defaults(asset)
 * ===================================================================== */
window.HA = window.HA || {};

HA.GS = (function () {
  'use strict';

  /* ------------------------------------------------------------------
   * Zielobjekt-Typen (Asset-Arten). Reihenfolge = Schichtenmodell.
   * layers: Schichten, deren Bausteine typischerweise auf diesen Typ
   * modelliert werden.
   * ---------------------------------------------------------------- */
  var KINDS = [
    { id: 'org', icon: '🏢', layers: ['ISMS', 'ORP', 'CON', 'OPS', 'DER'], de: 'Informationsverbund & Prozesse', en: 'Information domain & processes',
      hint: { de: 'Gesamte Institution oder Teilbereich – Prozess-Bausteine (ISMS, ORP, CON, OPS, DER) werden einmal für den Informationsverbund modelliert.', en: 'Whole organisation or a part of it – process modules (ISMS, ORP, CON, OPS, DER) are modelled once for the information domain.' } },
    { id: 'app', icon: '🧩', layers: ['APP'], de: 'Anwendungen & Dienste', en: 'Applications & services',
      hint: { de: 'Fachanwendungen, Webanwendungen, Verzeichnisdienste, Datenbanken, E-Mail, Office …', en: 'Business and web applications, directory services, databases, e-mail, office …' } },
    { id: 'system', icon: '🖥', layers: ['SYS'], de: 'IT-Systeme (Server & Clients)', en: 'IT systems (servers & clients)',
      hint: { de: 'Server, Clients, Notebooks, Smartphones, Drucker, IoT-Geräte – mit Betriebssystem-spezifischen Härtungsmaßnahmen.', en: 'Servers, clients, notebooks, smartphones, printers, IoT devices – with OS-specific hardening measures.' } },
    { id: 'ind', icon: '🏭', layers: ['IND'], de: 'Industrielle IT (ICS/OT)', en: 'Industrial IT (ICS/OT)',
      hint: { de: 'Prozessleit- und Automatisierungstechnik, SPS, Sensoren/Aktoren, Maschinen.', en: 'Process control and automation, PLC, sensors/actuators, machines.' } },
    { id: 'net', icon: '🌐', layers: ['NET'], de: 'Netze & Kommunikation', en: 'Networks & communication',
      hint: { de: 'Netzsegmente, Router/Switches, Firewalls, VPN, WLAN, TK-Anlagen.', en: 'Network segments, routers/switches, firewalls, VPN, WLAN, telephony.' } },
    { id: 'inf', icon: '🏛', layers: ['INF'], de: 'Infrastruktur (Gebäude, Räume)', en: 'Infrastructure (buildings, rooms)',
      hint: { de: 'Gebäude, Rechenzentrum/Serverraum, Technikräume, Arbeitsplätze, Verkabelung, Fahrzeuge.', en: 'Buildings, data centre/server room, technical rooms, workplaces, cabling, vehicles.' } }
  ];

  /* Schichten des IT-Grundschutz-Kompendiums */
  var LAYERS = [
    { id: 'ISMS', kind: 'org', type: 'process', de: 'Sicherheitsmanagement', en: 'Security management' },
    { id: 'ORP', kind: 'org', type: 'process', de: 'Organisation und Personal', en: 'Organisation and personnel' },
    { id: 'CON', kind: 'org', type: 'process', de: 'Konzepte und Vorgehensweisen', en: 'Concepts and procedures' },
    { id: 'OPS', kind: 'org', type: 'process', de: 'Betrieb', en: 'Operations' },
    { id: 'DER', kind: 'org', type: 'process', de: 'Detektion und Reaktion', en: 'Detection and reaction' },
    { id: 'APP', kind: 'app', type: 'system', de: 'Anwendungen', en: 'Applications' },
    { id: 'SYS', kind: 'system', type: 'system', de: 'IT-Systeme', en: 'IT systems' },
    { id: 'IND', kind: 'ind', type: 'system', de: 'Industrielle IT', en: 'Industrial IT' },
    { id: 'NET', kind: 'net', type: 'system', de: 'Netze und Kommunikation', en: 'Networks and communication' },
    { id: 'INF', kind: 'inf', type: 'system', de: 'Infrastruktur', en: 'Infrastructure' }
  ];

  /* ------------------------------------------------------------------
   * Alle 111 Bausteine der Edition 2023: [ID, Titel DE, Titel EN, Kurzbeschreibung DE, EN]
   * ---------------------------------------------------------------- */
  var RAW = [
    ['ISMS.1', 'Sicherheitsmanagement', 'Security management', 'Aufbau und Betrieb eines ISMS: Verantwortung der Leitung, Leitlinie, ISB, Sicherheitsprozess.', 'Setting up and running an ISMS: management responsibility, policy, ISO, security process.'],

    ['ORP.1', 'Organisation', 'Organisation', 'Zuständigkeiten, Regelungen und organisatorische Grundlagen der Informationssicherheit.', 'Responsibilities, rules and organisational foundations of information security.'],
    ['ORP.2', 'Personal', 'Personnel', 'Sicherheit bei Einstellung, Einarbeitung, Vertretung und Ausscheiden von Beschäftigten.', 'Security when hiring, onboarding, substituting and offboarding staff.'],
    ['ORP.3', 'Sensibilisierung und Schulung zur Informationssicherheit', 'Awareness and training in information security', 'Awareness-Programm, Schulungen und Sensibilisierung aller Beschäftigten.', 'Awareness programme, training and sensitisation of all employees.'],
    ['ORP.4', 'Identitäts- und Berechtigungsmanagement', 'Identity and access management', 'Benutzerkennungen, Rollen, Rechtevergabe, Passwort- und Authentisierungsregeln.', 'User IDs, roles, granting of rights, password and authentication rules.'],
    ['ORP.5', 'Compliance Management (Anforderungsmanagement)', 'Compliance management (requirements management)', 'Gesetzliche, vertragliche und interne Anforderungen ermitteln und einhalten.', 'Identify and comply with legal, contractual and internal requirements.'],

    ['CON.1', 'Kryptokonzept', 'Crypto concept', 'Auswahl und Einsatz kryptografischer Verfahren und Schlüsselmanagement.', 'Selection and use of cryptographic methods and key management.'],
    ['CON.2', 'Datenschutz', 'Data protection', 'Verbindung zum Standard-Datenschutzmodell (SDM) und zur DSGVO.', 'Link to the Standard Data Protection Model (SDM) and GDPR.'],
    ['CON.3', 'Datensicherungskonzept', 'Backup concept', 'Planung, Durchführung und Test von Datensicherungen und Wiederherstellung.', 'Planning, execution and testing of backups and restores.'],
    ['CON.6', 'Löschen und Vernichten', 'Deleting and destroying', 'Sicheres Löschen von Daten und Vernichten von Datenträgern und Dokumenten.', 'Secure deletion of data and destruction of media and documents.'],
    ['CON.7', 'Informationssicherheit auf Auslandsreisen', 'Information security on trips abroad', 'Schutz von Geräten und Informationen bei Dienstreisen ins Ausland.', 'Protecting devices and information on business trips abroad.'],
    ['CON.8', 'Software-Entwicklung', 'Software development', 'Sicherer Entwicklungsprozess, Vorgehensmodell, Tests und Freigaben.', 'Secure development process, process model, testing and releases.'],
    ['CON.9', 'Informationsaustausch', 'Information exchange', 'Regeln für den sicheren Austausch von Informationen mit Dritten.', 'Rules for the secure exchange of information with third parties.'],
    ['CON.10', 'Entwicklung von Webanwendungen', 'Development of web applications', 'Sichere Architektur und Programmierung von Webanwendungen.', 'Secure architecture and programming of web applications.'],
    ['CON.11.1', 'Geheimschutz VS-NUR FÜR DEN DIENSTGEBRAUCH (VS-NfD)', 'Classified information VS-NfD', 'Umgang mit Verschlusssachen der Stufe VS-NfD nach VSA.', 'Handling classified information at VS-NfD level according to VSA.'],

    ['OPS.1.1.1', 'Allgemeiner IT-Betrieb', 'General IT operations', 'Grundlagen eines geordneten IT-Betriebs.', 'Foundations of orderly IT operations.'],
    ['OPS.1.1.2', 'Ordnungsgemäße IT-Administration', 'Proper IT administration', 'Administrationskonten, Vertretung, Dokumentation und Kontrolle der Administration.', 'Admin accounts, substitution, documentation and control of administration.'],
    ['OPS.1.1.3', 'Patch- und Änderungsmanagement', 'Patch and change management', 'Geregeltes Einspielen von Updates und Steuern von Änderungen.', 'Controlled installation of updates and management of changes.'],
    ['OPS.1.1.4', 'Schutz vor Schadprogrammen', 'Protection against malware', 'Konzept und Werkzeuge gegen Viren, Ransomware und andere Schadsoftware.', 'Concept and tools against viruses, ransomware and other malware.'],
    ['OPS.1.1.5', 'Protokollierung', 'Logging', 'Erfassen, Speichern und Auswerten sicherheitsrelevanter Protokolldaten.', 'Collecting, storing and evaluating security-relevant log data.'],
    ['OPS.1.1.6', 'Software-Tests und -Freigaben', 'Software tests and approvals', 'Testen und formale Freigabe von Software vor dem Produktivbetrieb.', 'Testing and formal approval of software before production use.'],
    ['OPS.1.1.7', 'Systemmanagement', 'Systems management', 'Zentrale Verwaltung und Überwachung von IT-Systemen.', 'Central management and monitoring of IT systems.'],
    ['OPS.1.2.2', 'Archivierung', 'Archiving', 'Langfristige, revisionssichere Aufbewahrung elektronischer Dokumente.', 'Long-term, audit-proof retention of electronic documents.'],
    ['OPS.1.2.4', 'Telearbeit', 'Teleworking', 'Organisatorische und technische Regeln für Telearbeit.', 'Organisational and technical rules for teleworking.'],
    ['OPS.1.2.5', 'Fernwartung', 'Remote maintenance', 'Sichere Fernwartung von IT-Systemen durch eigene Kräfte oder Dienstleister.', 'Secure remote maintenance of IT systems by own staff or providers.'],
    ['OPS.1.2.6', 'NTP-Zeitsynchronisation', 'NTP time synchronisation', 'Verlässliche, manipulationsgeschützte Zeitsynchronisation.', 'Reliable, tamper-protected time synchronisation.'],
    ['OPS.2.2', 'Cloud-Nutzung', 'Cloud usage', 'Strategie, Auswahl und sichere Nutzung von Cloud-Diensten.', 'Strategy, selection and secure use of cloud services.'],
    ['OPS.2.3', 'Nutzung von Outsourcing', 'Use of outsourcing', 'Informationssicherheit beim Auslagern an Dienstleister (Kundensicht).', 'Information security when outsourcing to providers (customer view).'],
    ['OPS.3.2', 'Anbieten von Outsourcing', 'Providing outsourcing', 'Informationssicherheit als Outsourcing-Dienstleister (Anbietersicht).', 'Information security as an outsourcing provider (provider view).'],

    ['DER.1', 'Detektion von sicherheitsrelevanten Ereignissen', 'Detection of security-relevant events', 'Erkennen und Auswerten von Angriffen und Auffälligkeiten (z. B. SIEM, IDS).', 'Detecting and evaluating attacks and anomalies (e.g. SIEM, IDS).'],
    ['DER.2.1', 'Behandlung von Sicherheitsvorfällen', 'Security incident handling', 'Prozess zur Meldung, Bewertung und Behandlung von Sicherheitsvorfällen.', 'Process for reporting, assessing and handling security incidents.'],
    ['DER.2.2', 'Vorsorge für die IT-Forensik', 'Provisions for IT forensics', 'Vorbereitung gerichtsverwertbarer Beweissicherung und Analyse.', 'Preparing forensically sound evidence collection and analysis.'],
    ['DER.2.3', 'Bereinigung weitreichender Sicherheitsvorfälle', 'Clean-up of extensive security incidents', 'Wiederherstellen eines sicheren Zustands nach APT-Angriffen.', 'Restoring a secure state after APT attacks.'],
    ['DER.3.1', 'Audits und Revisionen', 'Audits and revisions', 'Planung und Durchführung von Audits und Revisionen.', 'Planning and conducting audits and revisions.'],
    ['DER.3.2', 'Revisionen auf Basis des Leitfadens IS-Revision', 'Revisions based on the IS revision guideline', 'IS-Revision nach dem BSI-Leitfaden (insb. Bundesverwaltung).', 'IS revision according to the BSI guideline (esp. federal administration).'],
    ['DER.4', 'Notfallmanagement', 'Business continuity management', 'Vorsorge und Bewältigung von Notfällen und Krisen (BSI-Standard 200-4).', 'Preparing for and managing emergencies and crises (BSI Standard 200-4).'],

    ['APP.1.1', 'Office-Produkte', 'Office products', 'Sichere Konfiguration und Nutzung von Office-Software, Makros, Dokumentenaustausch.', 'Secure configuration and use of office software, macros, document exchange.'],
    ['APP.1.2', 'Webbrowser', 'Web browsers', 'Härtung und sichere Nutzung von Webbrowsern.', 'Hardening and secure use of web browsers.'],
    ['APP.1.4', 'Mobile Anwendungen (Apps)', 'Mobile applications (apps)', 'Auswahl, Freigabe und sichere Nutzung von Apps auf Mobilgeräten.', 'Selection, approval and secure use of apps on mobile devices.'],
    ['APP.2.1', 'Allgemeiner Verzeichnisdienst', 'General directory service', 'Planung, Absicherung und Betrieb von Verzeichnisdiensten.', 'Planning, securing and operating directory services.'],
    ['APP.2.2', 'Active Directory Domain Services', 'Active Directory Domain Services', 'Sicherer Betrieb von AD DS, Tiering, Gruppenrichtlinien.', 'Secure operation of AD DS, tiering, group policies.'],
    ['APP.2.3', 'OpenLDAP', 'OpenLDAP', 'Sichere Konfiguration und Betrieb von OpenLDAP.', 'Secure configuration and operation of OpenLDAP.'],
    ['APP.3.1', 'Webanwendungen und Webservices', 'Web applications and web services', 'Authentisierung, Sitzungen, Eingabevalidierung und Schutz vor Web-Angriffen.', 'Authentication, sessions, input validation and protection against web attacks.'],
    ['APP.3.2', 'Webserver', 'Web servers', 'Härtung und sicherer Betrieb von Webservern (TLS, Header, Rechte).', 'Hardening and secure operation of web servers (TLS, headers, permissions).'],
    ['APP.3.3', 'Fileserver', 'File servers', 'Freigaben, Berechtigungen und Verfügbarkeit von Dateiservern.', 'Shares, permissions and availability of file servers.'],
    ['APP.3.4', 'Samba', 'Samba', 'Sichere Konfiguration von Samba-Diensten.', 'Secure configuration of Samba services.'],
    ['APP.3.6', 'DNS-Server', 'DNS servers', 'Sicherer Betrieb autoritativer und rekursiver DNS-Server, DNSSEC.', 'Secure operation of authoritative and recursive DNS servers, DNSSEC.'],
    ['APP.4.2', 'SAP-ERP-System', 'SAP ERP system', 'Berechtigungen, Härtung und Betrieb von SAP-ERP-Systemen.', 'Authorisations, hardening and operation of SAP ERP systems.'],
    ['APP.4.3', 'Relationale Datenbanken', 'Relational database systems', 'Härtung, Berechtigungen und Sicherung von Datenbanksystemen.', 'Hardening, permissions and backup of database systems.'],
    ['APP.4.4', 'Kubernetes', 'Kubernetes', 'Sichere Planung und Betrieb von Kubernetes-Clustern.', 'Secure planning and operation of Kubernetes clusters.'],
    ['APP.4.6', 'SAP ABAP-Programmierung', 'SAP ABAP programming', 'Sichere Entwicklung eigener ABAP-Programme.', 'Secure development of custom ABAP programs.'],
    ['APP.5.2', 'Microsoft Exchange und Outlook', 'Microsoft Exchange and Outlook', 'Sicherer Betrieb von Exchange und Nutzung von Outlook.', 'Secure operation of Exchange and use of Outlook.'],
    ['APP.5.3', 'Allgemeiner E-Mail-Client und -Server', 'General e-mail client and server', 'Absicherung von E-Mail-Servern und -Clients (Transportverschlüsselung, Spam).', 'Securing e-mail servers and clients (transport encryption, spam).'],
    ['APP.5.4', 'Unified Communications und Collaboration (UCC)', 'Unified communications and collaboration (UCC)', 'Sichere Nutzung von Videokonferenz-, Chat- und Kollaborationsplattformen.', 'Secure use of video conferencing, chat and collaboration platforms.'],
    ['APP.6', 'Allgemeine Software', 'General software', 'Anforderungen, Beschaffung, Installation und Außerbetriebnahme von Software.', 'Requirements, procurement, installation and decommissioning of software.'],
    ['APP.7', 'Entwicklung von Individualsoftware', 'Development of custom software', 'Sicherheitsanforderungen an selbst oder extern entwickelte Software.', 'Security requirements for in-house or externally developed software.'],

    ['SYS.1.1', 'Allgemeiner Server', 'General server', 'Grundlegende Sicherheitsanforderungen an alle Server.', 'Basic security requirements for all servers.'],
    ['SYS.1.2.2', 'Windows Server 2012', 'Windows Server 2012', 'Spezifische Anforderungen an Windows Server 2012 (Altsysteme).', 'Specific requirements for Windows Server 2012 (legacy).'],
    ['SYS.1.2.3', 'Windows Server', 'Windows Server', 'Härtung aktueller Windows-Server-Versionen.', 'Hardening of current Windows Server versions.'],
    ['SYS.1.3', 'Server unter Linux und Unix', 'Servers under Linux and Unix', 'Härtung von Linux- und Unix-Servern.', 'Hardening of Linux and Unix servers.'],
    ['SYS.1.5', 'Virtualisierung', 'Virtualisation', 'Sicherer Betrieb von Hypervisoren und virtuellen Infrastrukturen.', 'Secure operation of hypervisors and virtual infrastructures.'],
    ['SYS.1.6', 'Containerisierung', 'Containerisation', 'Sicherer Einsatz von Containern, Images und Container-Hosts.', 'Secure use of containers, images and container hosts.'],
    ['SYS.1.7', 'IBM Z', 'IBM Z', 'Sicherheit von IBM-Z-Großrechnersystemen.', 'Security of IBM Z mainframe systems.'],
    ['SYS.1.8', 'Speicherlösungen', 'Storage solutions', 'Absicherung von SAN, NAS und weiteren Speichersystemen.', 'Securing SAN, NAS and other storage systems.'],
    ['SYS.1.9', 'Terminalserver', 'Terminal server', 'Sichere Bereitstellung von Anwendungen über Terminalserver.', 'Secure provision of applications via terminal servers.'],
    ['SYS.2.1', 'Allgemeiner Client', 'General client', 'Grundlegende Sicherheitsanforderungen an alle Clients.', 'Basic security requirements for all clients.'],
    ['SYS.2.2.3', 'Clients unter Windows', 'Clients under Windows', 'Härtung von Windows-Clients.', 'Hardening of Windows clients.'],
    ['SYS.2.3', 'Clients unter Linux und Unix', 'Clients under Linux and Unix', 'Härtung von Linux- und Unix-Clients.', 'Hardening of Linux and Unix clients.'],
    ['SYS.2.4', 'Clients unter macOS', 'Clients under macOS', 'Härtung von macOS-Clients.', 'Hardening of macOS clients.'],
    ['SYS.2.5', 'Client-Virtualisierung', 'Client virtualisation', 'Virtuelle Maschinen auf Clients sicher einsetzen.', 'Using virtual machines on clients securely.'],
    ['SYS.2.6', 'Virtual Desktop Infrastructure', 'Virtual desktop infrastructure', 'Sichere Planung und Betrieb einer VDI.', 'Secure planning and operation of a VDI.'],
    ['SYS.3.1', 'Laptops', 'Laptops', 'Mobile Nutzung, Verschlüsselung und Diebstahlschutz von Laptops.', 'Mobile use, encryption and theft protection of laptops.'],
    ['SYS.3.2.1', 'Allgemeine Smartphones und Tablets', 'General smartphones and tablets', 'Grundlegende Sicherheit mobiler Endgeräte.', 'Basic security of mobile devices.'],
    ['SYS.3.2.2', 'Mobile Device Management (MDM)', 'Mobile device management (MDM)', 'Zentrale Verwaltung und Absicherung mobiler Geräte.', 'Central management and securing of mobile devices.'],
    ['SYS.3.2.3', 'iOS (for Enterprise)', 'iOS (for enterprise)', 'Sicherer Einsatz von iOS/iPadOS im Unternehmen.', 'Secure use of iOS/iPadOS in organisations.'],
    ['SYS.3.2.4', 'Android', 'Android', 'Sicherer Einsatz von Android-Geräten im Unternehmen.', 'Secure use of Android devices in organisations.'],
    ['SYS.3.3', 'Mobiltelefon', 'Mobile phone', 'Sichere Nutzung einfacher Mobiltelefone.', 'Secure use of basic mobile phones.'],
    ['SYS.4.1', 'Drucker, Kopierer und Multifunktionsgeräte', 'Printers, copiers and multifunction devices', 'Absicherung von Druck- und Multifunktionsgeräten.', 'Securing printers and multifunction devices.'],
    ['SYS.4.3', 'Eingebettete Systeme', 'Embedded systems', 'Sicherheit eingebetteter Systeme und Steuergeräte.', 'Security of embedded systems and control units.'],
    ['SYS.4.4', 'Allgemeines IoT-Gerät', 'General IoT device', 'Auswahl, Integration und Betrieb von IoT-Geräten.', 'Selection, integration and operation of IoT devices.'],
    ['SYS.4.5', 'Wechseldatenträger', 'Removable media', 'Umgang mit USB-Sticks, externen Festplatten und anderen Wechselmedien.', 'Handling USB sticks, external drives and other removable media.'],

    ['IND.1', 'Prozessleit- und Automatisierungstechnik', 'Process control and automation technology', 'Grundlagen der Sicherheit in OT-Umgebungen.', 'Security foundations in OT environments.'],
    ['IND.2.1', 'Allgemeine ICS-Komponente', 'General ICS component', 'Grundlegende Anforderungen an ICS-Komponenten.', 'Basic requirements for ICS components.'],
    ['IND.2.2', 'Speicherprogrammierbare Steuerung (SPS)', 'Programmable logic controller (PLC)', 'Absicherung von SPS.', 'Securing PLCs.'],
    ['IND.2.3', 'Sensoren und Aktoren', 'Sensors and actuators', 'Sicherheit von Feldgeräten (Sensoren, Aktoren).', 'Security of field devices (sensors, actuators).'],
    ['IND.2.4', 'Maschine', 'Machine', 'Sicherheit vernetzter Maschinen mit eigener Steuerung.', 'Security of networked machines with their own control.'],
    ['IND.2.7', 'Safety Instrumented Systems', 'Safety instrumented systems', 'Schutz sicherheitsgerichteter Systeme (SIS) vor Manipulation.', 'Protecting safety instrumented systems (SIS) against manipulation.'],
    ['IND.3.2', 'Fernwartung im industriellen Umfeld', 'Remote maintenance in industrial environments', 'Sichere Fernwartungszugänge für OT-Anlagen.', 'Secure remote maintenance access to OT plants.'],

    ['NET.1.1', 'Netzarchitektur und -design', 'Network architecture and design', 'Segmentierung, Zonen und sichere Netzstruktur.', 'Segmentation, zones and secure network structure.'],
    ['NET.1.2', 'Netzmanagement', 'Network management', 'Sichere Verwaltung und Überwachung von Netzkomponenten.', 'Secure management and monitoring of network components.'],
    ['NET.2.1', 'WLAN-Betrieb', 'WLAN operation', 'Planung und sicherer Betrieb von WLAN-Infrastrukturen.', 'Planning and secure operation of WLAN infrastructures.'],
    ['NET.2.2', 'WLAN-Nutzung', 'WLAN usage', 'Regeln für die sichere Nutzung von WLAN.', 'Rules for the secure use of WLAN.'],
    ['NET.3.1', 'Router und Switches', 'Routers and switches', 'Härtung und Konfiguration von Routern und Switches.', 'Hardening and configuration of routers and switches.'],
    ['NET.3.2', 'Firewall', 'Firewall', 'Regelwerk, Härtung und Betrieb von Firewalls.', 'Rule base, hardening and operation of firewalls.'],
    ['NET.3.3', 'VPN', 'VPN', 'Sichere Fernzugänge und Standortkopplung per VPN.', 'Secure remote access and site coupling via VPN.'],
    ['NET.3.4', 'Network Access Control', 'Network access control', 'Zugangskontrolle zum Netz (z. B. 802.1X).', 'Network access control (e.g. 802.1X).'],
    ['NET.4.1', 'TK-Anlagen', 'Telecommunication systems', 'Sicherheit von Telefonanlagen.', 'Security of telephone systems.'],
    ['NET.4.2', 'VoIP', 'VoIP', 'Absicherung von Voice-over-IP.', 'Securing Voice over IP.'],
    ['NET.4.3', 'Faxgeräte und Faxserver', 'Fax machines and fax servers', 'Sichere Nutzung von Fax.', 'Secure use of fax.'],

    ['INF.1', 'Allgemeines Gebäude', 'General building', 'Bauliche und organisatorische Grundanforderungen an Gebäude.', 'Basic structural and organisational requirements for buildings.'],
    ['INF.2', 'Rechenzentrum sowie Serverraum', 'Data centre and server room', 'Schutz von Rechenzentren und Serverräumen (Zutritt, Klima, Brand, Strom).', 'Protecting data centres and server rooms (access, climate, fire, power).'],
    ['INF.5', 'Raum sowie Schrank für technische Infrastruktur', 'Room and cabinet for technical infrastructure', 'Technikräume und -schränke (z. B. Verteiler) absichern.', 'Securing technical rooms and cabinets (e.g. distribution).'],
    ['INF.6', 'Datenträgerarchiv', 'Data media archive', 'Sichere Aufbewahrung von Datenträgern.', 'Secure storage of data media.'],
    ['INF.7', 'Büroarbeitsplatz', 'Office workplace', 'Sicherheit am Büroarbeitsplatz (Clean Desk, Abschließen).', 'Security at the office workplace (clean desk, locking).'],
    ['INF.8', 'Häuslicher Arbeitsplatz', 'Home workplace', 'Sicherheit beim Arbeiten von zu Hause.', 'Security when working from home.'],
    ['INF.9', 'Mobiler Arbeitsplatz', 'Mobile workplace', 'Sicherheit beim mobilen Arbeiten unterwegs.', 'Security when working on the move.'],
    ['INF.10', 'Besprechungs-, Veranstaltungs- und Schulungsräume', 'Meeting, event and training rooms', 'Absicherung gemeinsam genutzter Räume und ihrer Technik.', 'Securing shared rooms and their technology.'],
    ['INF.11', 'Allgemeines Fahrzeug', 'General vehicle', 'Sicherheit von Fahrzeugen mit IT-Komponenten.', 'Security of vehicles with IT components.'],
    ['INF.12', 'Verkabelung', 'Cabling', 'Planung und Schutz elektrotechnischer und IT-Verkabelung.', 'Planning and protecting electrical and IT cabling.'],
    ['INF.13', 'Technisches Gebäudemanagement', 'Technical building management', 'Sicherheit im technischen Gebäudemanagement (TGM).', 'Security in technical building management.'],
    ['INF.14', 'Gebäudeautomation', 'Building automation', 'Absicherung von Gebäudeautomationssystemen (GA).', 'Securing building automation systems.']
  ];
  var BAUSTEINE = RAW.map(function (r, i) {
    return { id: r[0], layer: r[0].split('.')[0], de: r[1], en: r[2], d: { de: r[3], en: r[4] }, i: i };
  });
  var BY = {}; BAUSTEINE.forEach(function (b) { BY[b.id] = b; });

  /* ------------------------------------------------------------------
   * Die 47 elementaren Gefährdungen (G 0.1 – G 0.47)
   * ---------------------------------------------------------------- */
  var THR = [
    ['Feuer', 'Fire', 'Brände zerstören Gebäude, Geräte und Datenträger; Rauch und Löschwasser verursachen Folgeschäden.', 'Fires destroy buildings, devices and media; smoke and extinguishing water cause consequential damage.'],
    ['Ungünstige klimatische Bedingungen', 'Unfavourable climatic conditions', 'Hitze, Kälte oder Feuchtigkeit außerhalb der Spezifikation führen zu Ausfällen.', 'Heat, cold or humidity outside specification lead to failures.'],
    ['Wasser', 'Water', 'Wasser durch Rohrbruch, Starkregen oder Löscharbeiten beschädigt Technik.', 'Water from burst pipes, heavy rain or firefighting damages equipment.'],
    ['Verschmutzung, Staub, Korrosion', 'Pollution, dust, corrosion', 'Ablagerungen und Korrosion beeinträchtigen Funktion und Lebensdauer.', 'Deposits and corrosion impair function and service life.'],
    ['Naturkatastrophen', 'Natural disasters', 'Hochwasser, Sturm, Erdbeben oder Blitzschlag mit großflächigen Auswirkungen.', 'Floods, storms, earthquakes or lightning with wide-area effects.'],
    ['Katastrophen im Umfeld', 'Environmental disasters', 'Unfälle oder Großschadenslagen in der Nachbarschaft (z. B. Chemieunfall).', 'Accidents or major incidents in the vicinity (e.g. chemical accident).'],
    ['Großereignisse im Umfeld', 'Major events in the vicinity', 'Demonstrationen, Veranstaltungen oder Streiks erschweren Zugang und Betrieb.', 'Demonstrations, events or strikes hinder access and operations.'],
    ['Ausfall oder Störung der Stromversorgung', 'Failure or disruption of the power supply', 'Stromausfall, Spannungsschwankungen oder Überspannung.', 'Power outage, voltage fluctuations or surges.'],
    ['Ausfall oder Störung von Kommunikationsnetzen', 'Failure or disruption of communication networks', 'Internet-, WAN- oder Telefonanbindungen fallen aus.', 'Internet, WAN or telephone connections fail.'],
    ['Ausfall oder Störung von Versorgungsnetzen', 'Failure or disruption of supply networks', 'Wasser, Kälte, Wärme oder Gas stehen nicht zur Verfügung.', 'Water, cooling, heating or gas are unavailable.'],
    ['Ausfall oder Störung von Dienstleistern', 'Failure or disruption of service providers', 'Externe Dienstleister oder Cloud-Anbieter erbringen ihre Leistung nicht.', 'External providers or cloud services fail to deliver.'],
    ['Elektromagnetische Störstrahlung', 'Electromagnetic interference', 'Elektromagnetische Felder stören Geräte und Datenübertragung.', 'Electromagnetic fields disturb devices and data transmission.'],
    ['Abfangen kompromittierender Strahlung', 'Interception of compromising emissions', 'Abstrahlung von Geräten wird ausgewertet, um Informationen zu gewinnen.', 'Emissions from devices are analysed to obtain information.'],
    ['Ausspähen von Informationen (Spionage)', 'Interception of information / espionage', 'Gezieltes Sammeln vertraulicher Informationen durch Dritte.', 'Targeted gathering of confidential information by third parties.'],
    ['Abhören', 'Eavesdropping', 'Unbefugtes Mithören oder Mitschneiden von Gesprächen und Datenverkehr.', 'Unauthorised listening to or recording of conversations and traffic.'],
    ['Diebstahl von Geräten, Datenträgern oder Dokumenten', 'Theft of devices, storage media or documents', 'Gestohlene Geräte führen zu Ausfall und Offenlegung von Daten.', 'Stolen devices lead to outages and disclosure of data.'],
    ['Verlust von Geräten, Datenträgern oder Dokumenten', 'Loss of devices, storage media or documents', 'Liegengelassene oder verlorene Geräte und Unterlagen.', 'Devices and documents left behind or lost.'],
    ['Fehlplanung oder fehlende Anpassung', 'Poor planning or lack of adaptation', 'Unzureichende Planung oder nicht nachgezogene Veränderungen schaffen Lücken.', 'Insufficient planning or unadapted changes create gaps.'],
    ['Offenlegung schützenswerter Informationen', 'Disclosure of sensitive information', 'Vertrauliche Informationen gelangen an Unbefugte.', 'Confidential information reaches unauthorised parties.'],
    ['Informationen oder Produkte aus unzuverlässiger Quelle', 'Information or products from an unreliable source', 'Fehlerhafte oder manipulierte Informationen, Software oder Hardware werden genutzt.', 'Faulty or manipulated information, software or hardware is used.'],
    ['Manipulation von Hard- oder Software', 'Manipulation of hardware or software', 'Unbefugte Veränderung von Geräten oder Programmen.', 'Unauthorised modification of devices or programs.'],
    ['Manipulation von Informationen', 'Manipulation of information', 'Daten werden gezielt verfälscht.', 'Data is deliberately falsified.'],
    ['Unbefugtes Eindringen in IT-Systeme', 'Unauthorised access to IT systems', 'Angreifende verschaffen sich Zugriff auf Systeme oder Anwendungen.', 'Attackers gain access to systems or applications.'],
    ['Zerstörung von Geräten oder Datenträgern', 'Destruction of devices or storage media', 'Mutwillige oder fahrlässige Zerstörung.', 'Wilful or negligent destruction.'],
    ['Ausfall von Geräten oder Systemen', 'Failure of devices or systems', 'Hardware- oder Systemausfälle durch Defekte oder Alterung.', 'Hardware or system failures due to defects or ageing.'],
    ['Fehlfunktion von Geräten oder Systemen', 'Malfunction of devices or systems', 'Geräte arbeiten fehlerhaft und liefern falsche Ergebnisse.', 'Devices work incorrectly and deliver wrong results.'],
    ['Ressourcenmangel', 'Lack of resources', 'Zu wenig Personal, Speicher, Bandbreite oder Budget.', 'Too little staff, storage, bandwidth or budget.'],
    ['Software-Schwachstellen oder -Fehler', 'Software vulnerabilities or errors', 'Programmfehler und Sicherheitslücken werden ausgenutzt oder führen zu Ausfällen.', 'Program errors and vulnerabilities are exploited or cause outages.'],
    ['Verstoß gegen Gesetze oder Regelungen', 'Violation of laws or regulations', 'Rechtliche oder vertragliche Vorgaben werden nicht eingehalten.', 'Legal or contractual requirements are not met.'],
    ['Unberechtigte Nutzung oder Administration von Geräten und Systemen', 'Unauthorised use or administration of devices and systems', 'Systeme werden ohne Berechtigung genutzt oder verwaltet.', 'Systems are used or administered without authorisation.'],
    ['Fehlerhafte Nutzung oder Administration von Geräten und Systemen', 'Incorrect use or administration of devices and systems', 'Bedien- oder Konfigurationsfehler gefährden Sicherheit und Betrieb.', 'Operating or configuration errors endanger security and operations.'],
    ['Missbrauch von Berechtigungen', 'Abuse of authorisations', 'Vorhandene Rechte werden für unzulässige Zwecke genutzt.', 'Existing rights are used for unauthorised purposes.'],
    ['Personalausfall', 'Absence of personnel', 'Krankheit, Kündigung oder Streik von Schlüsselpersonen.', 'Illness, resignation or strike of key staff.'],
    ['Anschlag', 'Attack', 'Gewaltsame Angriffe auf Personen, Gebäude oder Infrastruktur.', 'Violent attacks on people, buildings or infrastructure.'],
    ['Nötigung, Erpressung oder Korruption', 'Coercion, blackmail or corruption', 'Personen werden unter Druck gesetzt oder bestochen.', 'People are put under pressure or bribed.'],
    ['Identitätsdiebstahl', 'Identity theft', 'Angreifende geben sich mit fremden Zugangsdaten als andere aus.', 'Attackers impersonate others using stolen credentials.'],
    ['Abstreiten von Handlungen', 'Repudiation of actions', 'Durchgeführte Handlungen werden bestritten, Nachweise fehlen.', 'Actions are denied and proof is missing.'],
    ['Missbrauch personenbezogener Daten', 'Misuse of personal data', 'Personenbezogene Daten werden unzulässig verarbeitet.', 'Personal data is processed unlawfully.'],
    ['Schadprogramme', 'Malware', 'Viren, Würmer, Trojaner oder Ransomware.', 'Viruses, worms, trojans or ransomware.'],
    ['Verhinderung von Diensten (Denial of Service)', 'Denial of service', 'Dienste werden durch Überlastung unbenutzbar gemacht.', 'Services are made unusable by overload.'],
    ['Sabotage', 'Sabotage', 'Gezielte Störung von Betriebsabläufen.', 'Deliberate disruption of operations.'],
    ['Social Engineering', 'Social engineering', 'Menschen werden manipuliert, Informationen preiszugeben oder Handlungen auszuführen.', 'People are manipulated into disclosing information or taking actions.'],
    ['Einspielen von Nachrichten', 'Replay of messages', 'Aufgezeichnete Nachrichten werden erneut eingespielt (Replay).', 'Recorded messages are replayed.'],
    ['Unbefugtes Eindringen in Räumlichkeiten', 'Unauthorised entry to premises', 'Unbefugte verschaffen sich Zutritt zu Gebäuden oder Räumen.', 'Unauthorised persons gain access to buildings or rooms.'],
    ['Datenverlust', 'Data loss', 'Daten gehen unwiederbringlich verloren.', 'Data is irretrievably lost.'],
    ['Integritätsverlust schützenswerter Informationen', 'Loss of integrity of sensitive information', 'Informationen sind unbemerkt verändert oder unvollständig.', 'Information is changed unnoticed or incomplete.'],
    ['Schädliche Seiteneffekte IT-gestützter Angriffe', 'Harmful side effects of IT-supported attacks', 'Angriffe auf Dritte wirken sich auch auf die eigene Institution aus.', 'Attacks on third parties also affect one\'s own organisation.']
  ];
  var THREATS = THR.map(function (r, i) { return { id: 'G 0.' + (i + 1), de: r[0], en: r[1], d: { de: r[2], en: r[3] } }; });

  /* ------------------------------------------------------------------
   * Fachbegriffe (eigene Kurzdefinitionen)
   * ---------------------------------------------------------------- */
  var TERMS = [
    ['Informationsverbund', 'Information domain', 'Gesamtheit der infrastrukturellen, organisatorischen, personellen und technischen Objekte, die gemeinsam Geschäftsprozesse unterstützen – der Geltungsbereich des ISMS.', 'All infrastructural, organisational, personnel and technical objects that jointly support business processes – the scope of the ISMS.'],
    ['Zielobjekt', 'Target object', 'Teil des Informationsverbunds, auf den Bausteine angewendet werden (z. B. Prozess, Anwendung, IT-System, Raum, Netz).', 'Part of the information domain to which modules are applied (e.g. process, application, IT system, room, network).'],
    ['Strukturanalyse', 'Structure analysis', 'Erfassung der Geschäftsprozesse, Anwendungen, IT-Systeme, Netze und Räume samt Abhängigkeiten.', 'Recording of business processes, applications, IT systems, networks and rooms including dependencies.'],
    ['Schutzbedarfsfeststellung', 'Protection needs assessment', 'Bewertung der möglichen Schäden für Vertraulichkeit, Integrität und Verfügbarkeit (normal, hoch, sehr hoch).', 'Assessment of possible damage to confidentiality, integrity and availability (normal, high, very high).'],
    ['Modellierung', 'Modelling', 'Zuordnung der passenden IT-Grundschutz-Bausteine zu den Zielobjekten des Informationsverbunds.', 'Assigning the appropriate IT-Grundschutz modules to the target objects of the information domain.'],
    ['Baustein', 'Module', 'Fachtext des Kompendiums zu einem Thema mit Gefährdungslage und Anforderungen; gegliedert in zehn Schichten.', 'Compendium text on a topic with threat landscape and requirements; structured into ten layers.'],
    ['Prozess-Bausteine', 'Process modules', 'Schichten ISMS, ORP, CON, OPS und DER – gelten meist für den gesamten Informationsverbund.', 'Layers ISMS, ORP, CON, OPS and DER – usually apply to the whole information domain.'],
    ['System-Bausteine', 'System modules', 'Schichten APP, SYS, IND, NET und INF – werden auf einzelne technische oder bauliche Zielobjekte angewendet.', 'Layers APP, SYS, IND, NET and INF – applied to individual technical or physical target objects.'],
    ['Basis-Anforderung (B)', 'Basic requirement (B)', 'Vorrangig umzusetzende Mindestanforderungen; Grundlage der Basis-Absicherung.', 'Minimum requirements to be implemented first; basis of basic protection.'],
    ['Standard-Anforderung (S)', 'Standard requirement (S)', 'Gemeinsam mit den Basis-Anforderungen Stand der Technik für normalen Schutzbedarf.', 'Together with basic requirements the state of the art for normal protection needs.'],
    ['Anforderung bei erhöhtem Schutzbedarf (H)', 'Requirement for elevated protection needs (H)', 'Zusätzliche Anforderungen, die bei hohem oder sehr hohem Schutzbedarf zu prüfen sind.', 'Additional requirements to be considered for high or very high protection needs.'],
    ['Basis-Absicherung', 'Basic protection', 'Einstiegsvorgehensweise: nur Basis-Anforderungen für alle Zielobjekte, schnelle Grundsicherung.', 'Entry approach: only basic requirements for all target objects, quick baseline.'],
    ['Standard-Absicherung', 'Standard protection', 'Vollständige Vorgehensweise nach BSI-Standard 200-2 mit Basis- und Standard-Anforderungen; Grundlage für die ISO-27001-Zertifizierung auf Basis von IT-Grundschutz.', 'Full approach per BSI Standard 200-2 with basic and standard requirements; basis for ISO 27001 certification based on IT-Grundschutz.'],
    ['Kern-Absicherung', 'Core protection', 'Absicherung der „Kronjuwelen“ – besonders kritischer Geschäftsprozesse und Assets – mit allen relevanten Anforderungen.', 'Protection of the "crown jewels" – particularly critical processes and assets – with all relevant requirements.'],
    ['IT-Grundschutz-Check', 'IT-Grundschutz check', 'Soll-Ist-Vergleich: Für jede Anforderung wird der Umsetzungsstatus (ja, teilweise, nein, entbehrlich) erhoben.', 'Target/actual comparison: the implementation status (yes, partly, no, dispensable) is recorded for each requirement.'],
    ['Gap-Analyse', 'Gap analysis', 'Gegenüberstellung von Soll-Zustand (Anforderungen gemäß Vorgehensweise und Schutzbedarf) und Ist-Zustand mit priorisierten Lücken.', 'Comparison of target state (requirements per approach and protection needs) and actual state with prioritised gaps.'],
    ['Risikoanalyse (BSI 200-3)', 'Risk analysis (BSI 200-3)', 'Ergänzende Analyse für Zielobjekte mit hohem Schutzbedarf oder ohne passenden Baustein, auf Basis der elementaren Gefährdungen.', 'Supplementary analysis for target objects with high protection needs or without a suitable module, based on the elementary threats.'],
    ['Elementare Gefährdung', 'Elementary threat', 'Eine der 47 produktneutralen Gefährdungen (G 0.1 – G 0.47), aus denen die Bausteine abgeleitet sind.', 'One of the 47 product-neutral threats (G 0.1 – G 0.47) from which the modules are derived.'],
    ['Kreuzreferenztabelle', 'Cross-reference table', 'Zuordnung der elementaren Gefährdungen zu den Anforderungen eines Bausteins.', 'Mapping of the elementary threats to the requirements of a module.'],
    ['Restrisiko', 'Residual risk', 'Verbleibendes Risiko nach Umsetzung der Maßnahmen; muss von der Leitung getragen werden.', 'Risk remaining after measures are implemented; must be accepted by management.'],
    ['Risikobehandlung', 'Risk treatment', 'Vermeiden, Reduzieren, Transferieren oder Akzeptieren eines Risikos.', 'Avoiding, reducing, transferring or accepting a risk.'],
    ['ISB', 'ISO (information security officer)', 'Informationssicherheitsbeauftragte/r: steuert und koordiniert den Sicherheitsprozess im Auftrag der Leitung.', 'Information security officer: steers and coordinates the security process on behalf of management.'],
    ['PDCA-Zyklus', 'PDCA cycle', 'Plan – Do – Check – Act: kontinuierlicher Verbesserungsprozess des ISMS.', 'Plan – Do – Check – Act: continuous improvement cycle of the ISMS.'],
    ['TOM', 'TOMs', 'Technische und organisatorische Maßnahmen nach Art. 32 DSGVO.', 'Technical and organisational measures according to Art. 32 GDPR.'],
    ['BIA', 'BIA', 'Business-Impact-Analyse: Bewertung der Auswirkungen von Ausfällen und Festlegung von RTO, RPO und MTPD (BSI-Standard 200-4).', 'Business impact analysis: assessing outage impacts and setting RTO, RPO and MTPD (BSI Standard 200-4).'],
    ['RTO / RPO / MTPD', 'RTO / RPO / MTPD', 'Wiederanlaufzeit, maximal tolerierbarer Datenverlust und maximal tolerierbare Ausfallzeit.', 'Recovery time objective, recovery point objective and maximum tolerable period of disruption.'],
    ['Ursachenanalyse (Ishikawa)', 'Root cause analysis (Ishikawa)', 'Fischgrätendiagramm: mögliche Ursachen eines Problems werden nach Kategorien (z. B. Mensch, Technik, Methode) gesammelt und bewertet.', 'Fishbone diagram: possible causes of a problem are collected and rated by category (e.g. people, technology, method).'],
    ['Grundschutz++', 'Grundschutz++', 'Maschinenlesbarer Nachfolger des Kompendiums (OSCAL), Methodik im BSI-Standard 300-1.', 'Machine-readable successor of the compendium (OSCAL), methodology in BSI Standard 300-1.']
  ].map(function (r) { return { de: r[0], en: r[1], d: { de: r[2], en: r[3] } }; });

  /* Standard-Modellierung je Zielobjekt-Typ (Vorschlag beim Anlegen) */
  var DEF = {
    org: ['ISMS.1', 'ORP.1', 'ORP.2', 'ORP.3', 'ORP.4', 'ORP.5', 'CON.1', 'CON.2', 'CON.3', 'CON.6', 'OPS.1.1.2', 'OPS.1.1.3', 'OPS.1.1.4', 'OPS.1.1.5', 'DER.1', 'DER.2.1', 'DER.3.1', 'DER.4'],
    app: ['APP.6'], ind: ['IND.1', 'IND.2.1'], net: ['NET.1.1', 'NET.1.2'], inf: ['INF.1']
  };
  /** Vorschlag je Asset (bei IT-Systemen abhängig vom Betriebssystem). */
  function defaults(kind, osId) {
    if (kind !== 'system') return (DEF[kind] || []).slice();
    var os = HA.osById ? HA.osById(osId) : { family: 'linux', role: 'server' };
    if (os.role === 'server') return ['SYS.1.1', os.family === 'windows' ? 'SYS.1.2.3' : 'SYS.1.3'];
    return ['SYS.2.1', os.family === 'windows' ? 'SYS.2.2.3' : os.family === 'macos' ? 'SYS.2.4' : 'SYS.2.3'];
  }
  /** Alle Baustein-IDs, die für einen OS-Vorschlag in Frage kommen (zum Austauschen beim OS-Wechsel). */
  var OS_MODS = ['SYS.1.1', 'SYS.1.2.3', 'SYS.1.3', 'SYS.2.1', 'SYS.2.2.3', 'SYS.2.3', 'SYS.2.4'];

  function L(o) { return o ? (HA.lang === 'en' && o.en ? o.en : o.de) : ''; }
  return {
    KINDS: KINDS, LAYERS: LAYERS, BAUSTEINE: BAUSTEINE, THREATS: THREATS, TERMS: TERMS, OS_MODS: OS_MODS,
    byId: function (id) { return BY[id] || null; },
    title: function (id) { var b = BY[id]; return b ? L(b) : ''; },
    layerOf: function (id) { return String(id || '').split('.')[0]; },
    layer: function (lid) { return LAYERS.find(function (l) { return l.id === lid; }) || null; },
    kind: function (kid) { return KINDS.find(function (k) { return k.id === kid; }) || KINDS[2]; },
    index: function (id) { return BY[id] ? BY[id].i : 999; },
    threat: function (id) { return THREATS.find(function (x) { return x.id === id; }) || null; },
    defaults: defaults, L: L
  };
})();

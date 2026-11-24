/* =====================================================================
 * catalog-bsi.js – BSI IT-Grundschutz-Kompendium, Edition 2023
 * ---------------------------------------------------------------------
 * Enthalten sind die System-Bausteine für Server und Clients der drei
 * Plattformen. Entfallene ("ENTFALLEN") Anforderungen sind weggelassen.
 *
 *  - Titel:        wörtlich aus dem Kompendium (Edition 2023)
 *  - Beschreibung: sinngemäße Kurzfassung (eigene Worte) – maßgeblich
 *                  ist IMMER der Originaltext des BSI.
 *  - level:        B = Basis, S = Standard, H = erhöhter Schutzbedarf
 *  - ssg:          Regel-IDs, die ComplianceAsCode (SSG) dieser
 *                  Anforderung für RHEL 9/10 zuordnet (Auszug). Damit
 *                  lassen sich OpenSCAP-Ergebnisse als Wirksamkeits-
 *                  nachweis an BSI-Anforderungen anhängen.
 *  - check:        Prüfbefehle je Plattform (nur lesend!)
 *
 * Neue Bausteine ergänzen: einfach weitere Zeilen mit B(…) anlegen oder
 * das vollständige Kompendium als XML/Text über „Import“ einlesen.
 * ===================================================================== */
window.HA = window.HA || {};

(function () {
  'use strict';
  var items = [];

  /**
   * Hilfsfunktion zum kompakten Anlegen einer Anforderung.
   * @param {string} ref    Anforderungs-ID, z. B. "SYS.1.1.A2"
   * @param {string} level  B | S | H
   * @param {string[]} os   Plattform-Familien: windows | linux | macos
   * @param {string} role   server | client | any
   * @param {string} topic  Themen-ID aus HA.TOPICS
   * @param {string} de     deutscher Titel (Original)
   * @param {string} en     englischer Titel
   * @param {string} desc   Kurzbeschreibung (sinngemäß, deutsch)
   * @param {object} [extra] optionale Felder: check, ssg, role-Hinweis
   */
  function B(ref, level, os, role, topic, de, en, desc, extra) {
    var baustein = ref.replace(/\.A\d+$/, '');
    items.push(Object.assign({
      lib: 'bsi2023', ref: ref, group: baustein, level: level, os: os, role: role,
      topic: topic, title: { de: de, en: en }, desc: { de: desc }
    }, extra || {}));
  }

  var ALL = ['windows', 'linux', 'macos'], WIN = ['windows'], LIN = ['linux'], MAC = ['macos'];

  /* ------------------------------------------------------------------
   * SYS.1.1 Allgemeiner Server
   * ---------------------------------------------------------------- */
  B('SYS.1.1.A1', 'B', ALL, 'server', 'install', 'Zugriffsschutz und Nutzung', 'Access protection and use',
    'Server nur in Räumen mit Zutrittsschutz betreiben; Server nicht als Arbeitsplatzrechner nutzen.');
  B('SYS.1.1.A2', 'B', ALL, 'server', 'accounts', 'Authentisierung an Servern', 'User authentication on servers',
    'Anmeldungen schutzbedarfsgerecht absichern, möglichst über zentrale Authentisierungsdienste; starke Passwörter bzw. MFA für Administration.',
    { check: { linux: 'grep -E "^(PASS_MAX_DAYS|PASS_MIN_LEN)" /etc/login.defs; sudo grep -E "^(PasswordAuthentication|PubkeyAuthentication)" /etc/ssh/sshd_config', windows: 'net accounts; Get-ADDefaultDomainPasswordPolicy  # (Domäne)' } });
  B('SYS.1.1.A5', 'B', ALL, 'server', 'media', 'Schutz von Schnittstellen', 'Protection of interfaces',
    'Nur freigegebene Geräte anschließen; nicht benötigte Schnittstellen (USB, FireWire, Bluetooth …) deaktivieren.',
    { ssg: ['bios_disable_usb_boot', 'grub2_nousb_argument', 'kernel_module_firewire-core_disabled', 'kernel_module_usb-storage_disabled', 'service_autofs_disabled'],
      check: { linux: 'lsmod | grep -E "usb_storage|firewire|bluetooth"; systemctl is-enabled autofs 2>/dev/null', windows: 'Get-PnpDevice -PresentOnly | Where-Object Class -in "USB","Bluetooth"' } });
  B('SYS.1.1.A6', 'B', ALL, 'server', 'services', 'Deaktivierung nicht benötigter Dienste', 'Disabling unnecessary services',
    'Nicht benötigte Rollen, Features, Software, Dienste und Firmware-Funktionen deaktivieren bzw. deinstallieren; Entscheidung dokumentieren.',
    { ssg: ['configure_firewalld_ports', 'kernel_module_bluetooth_disabled', 'kernel_module_cfg80211_disabled', 'mask_nonessential_services', 'partition_for_home'],
      check: { linux: 'systemctl list-unit-files --type=service --state=enabled; ss -tulpen', windows: 'Get-WindowsFeature | Where-Object Installed; Get-Service | Where-Object StartType -eq Automatic' } });
  B('SYS.1.1.A9', 'B', ALL, 'server', 'malware', 'Einsatz von Virenschutz-Programmen auf Servern', 'Using anti-virus programs on servers',
    'Abhängig von Betriebssystem und Diensten prüfen, ob Virenschutz nötig ist; falls ja, einsetzen und aktuell halten.',
    { ssg: ['install_antivirus', 'install_endpoint_security_software'],
      check: { windows: 'Get-MpComputerStatus | Select AMServiceEnabled,RealTimeProtectionEnabled,AntivirusSignatureLastUpdated', linux: 'systemctl status clamav-daemon 2>/dev/null || echo "kein ClamAV"' } });
  B('SYS.1.1.A10', 'B', ALL, 'server', 'logging', 'Protokollierung', 'Logging',
    'Sicherheitsrelevante Ereignisse protokollieren (u. a. An-/Abmeldungen, Fehlversuche, Neustarts, Rechteänderungen).',
    { ssg: ['audit_rules_dac_modification_chmod', 'audit_rules_dac_modification_chown', 'audit_rules_login_events', 'service_auditd_enabled'],
      check: { linux: 'systemctl is-active auditd rsyslog systemd-journald; sudo auditctl -l | head', windows: 'auditpol /get /category:*' } });
  B('SYS.1.1.A11', 'S', ALL, 'server', 'planning', 'Festlegung einer Sicherheitsrichtlinie für Server', 'Defining a security policy for servers',
    'Server-spezifische Sicherheitsvorgaben in einer eigenen Richtlinie festlegen, bekannt machen und Einhaltung regelmäßig prüfen.');
  B('SYS.1.1.A12', 'S', ALL, 'server', 'planning', 'Planung des Server-Einsatzes', 'Planning the use of servers',
    'Einsatz jedes Servers planen und Entscheidungen zu Hardware, Software, Netzanbindung und Zugriffen dokumentieren.');
  B('SYS.1.1.A13', 'S', ALL, 'server', 'lifecycle', 'Beschaffung von Servern', 'Procurement of servers',
    'Vor der Beschaffung eine Anforderungsliste erstellen und Produkte daran bewerten.');
  B('SYS.1.1.A15', 'S', ALL, 'server', 'availability', 'Unterbrechungsfreie und stabile Stromversorgung', 'Stable and uninterruptible power supply',
    'Server an eine USV anschließen (Zuständigkeit Haustechnik); Kapazität und Wartung sicherstellen.');
  B('SYS.1.1.A16', 'S', ALL, 'server', 'install', 'Sichere Installation und Grundkonfiguration von Servern', 'Secure installation and basic configuration of servers',
    'Server in einer abgeschotteten Umgebung installieren und grundkonfigurieren, bevor sie in den Produktivbetrieb gehen; Härtungsvorgaben anwenden.');
  B('SYS.1.1.A19', 'S', ALL, 'server', 'network', 'Einrichtung lokaler Paketfilter', 'Configuring local packet filters',
    'Lokale Firewall aktivieren; nur erforderliche Kommunikationspartner, Ports und Protokolle zulassen.',
    { ssg: ['package_firewalld_installed', 'service_firewalld_enabled', 'set_firewalld_appropriate_zone', 'unnecessary_firewalld_services_ports_disabled'],
      check: { linux: 'sudo nft list ruleset | head -50 || sudo ufw status verbose || sudo firewall-cmd --list-all', windows: 'Get-NetFirewallProfile | Select Name,Enabled,DefaultInboundAction', macos: '/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate' } });
  B('SYS.1.1.A21', 'S', ALL, 'server', 'planning', 'Betriebsdokumentation für Server', 'Operational documentation for servers',
    'Betriebliche Aufgaben und Konfigurationsänderungen nachvollziehbar dokumentieren und die Dokumentation vor Missbrauch schützen.');
  B('SYS.1.1.A22', 'S', ALL, 'server', 'availability', 'Einbindung in die Notfallplanung', 'Integration into contingency planning',
    'Server in die Notfallplanung aufnehmen (Wiederanlaufpläne, hinterlegte Zugangsdaten, Wiederherstellungstests).');
  B('SYS.1.1.A23', 'S', ALL, 'server', 'availability', 'Systemüberwachung und Monitoring von Servern', 'Monitoring systems and servers',
    'Zustand und Dienste überwachen; bei Fehlern und Schwellwertüberschreitungen den Betrieb alarmieren.');
  B('SYS.1.1.A24', 'S', ALL, 'server', 'integrity', 'Sicherheitsprüfungen für Server', 'Security checks for servers',
    'Regelmäßige Sicherheitstests (z. B. Schwachstellenscans, Konfigurationsprüfungen), vorrangig bei Servern mit externen Schnittstellen.',
    { check: { linux: 'sudo lynis audit system --quick; sudo oscap xccdf eval --profile <PROFIL> --results res.xml <DATASTREAM>', windows: 'Invoke-HardeningKitty -Mode Audit  # (Open Source, optional)' } });
  B('SYS.1.1.A25', 'S', ALL, 'server', 'lifecycle', 'Geregelte Außerbetriebnahme eines Servers', 'Controlled decommissioning of a server',
    'Bei Außerbetriebnahme Daten sichern, Dienste übergeben und Datenträger sicher löschen; Checkliste verwenden.');
  B('SYS.1.1.A35', 'S', ALL, 'server', 'planning', 'Erstellung und Pflege eines Betriebshandbuchs', 'Drawing up and maintaining an operating manual',
    'Je Servertyp ein aktuelles Betriebshandbuch pflegen, das auch im Notfall verfügbar ist.');
  B('SYS.1.1.A37', 'S', ALL, 'server', 'exploit', 'Kapselung von sicherheitskritischen Anwendungen und Betriebssystemkomponenten', 'Encapsulation of security-critical applications and OS components',
    'Sicherheitskritische Anwendungen und Komponenten isolieren (z. B. SELinux/AppArmor, Container, VBS), insbesondere bei Verarbeitung nicht vertrauenswürdiger Daten.',
    { ssg: ['grub2_enable_selinux', 'selinux_confinement_of_daemons', 'selinux_not_disabled', 'selinux_policytype', 'selinux_state'],
      check: { linux: 'getenforce 2>/dev/null; sudo aa-status 2>/dev/null | head', windows: 'Get-CimInstance -ClassName Win32_DeviceGuard -Namespace root\\Microsoft\\Windows\\DeviceGuard' } });
  B('SYS.1.1.A39', 'S', ALL, 'server', 'install', 'Zentrale Verwaltung der Sicherheitsrichtlinien von Servern', 'Central management of server security policies',
    'Sicherheitseinstellungen zentral (GPO, Ansible, MDM …) verwalten – passend zu Schutzbedarf und interner Richtlinie.');
  B('SYS.1.1.A27', 'H', ALL, 'server', 'integrity', 'Hostbasierte Angriffserkennung', 'Host-based attack detection',
    'Host-basierte Angriffserkennung (HIDS) einsetzen, Systemdateien auf Veränderungen überwachen und Alarme auslösen.',
    { ssg: ['aide_build_database', 'aide_periodic_cron_checking', 'aide_scan_notification', 'install_hids', 'package_aide_installed', 'rpm_verify_hashes'],
      check: { linux: 'sudo aide --check 2>/dev/null | head || echo "AIDE nicht installiert"' } });
  B('SYS.1.1.A28', 'H', ALL, 'server', 'availability', 'Steigerung der Verfügbarkeit durch Redundanz', 'Increasing availability through redundancy',
    'Hochverfügbare Server redundant auslegen (Cluster, Ersatzteile, Wartungsverträge, ggf. Failover).');
  B('SYS.1.1.A30', 'H', ALL, 'server', 'services', 'Ein Dienst pro Server', 'One service per server',
    'Bei entsprechender Gefährdung bzw. Schutzbedarf je Server nur einen Dienst betreiben.');
  B('SYS.1.1.A31', 'H', ALL, 'server', 'exploit', 'Einsatz von Ausführungskontrolle', 'Using execution control',
    'Nur explizit erlaubte Programme und Skripte ausführen (Application Allowlisting, z. B. AppLocker/WDAC, fapolicyd).',
    { ssg: ['fapolicy_default_deny', 'package_fapolicyd_installed'],
      check: { windows: 'Get-AppLockerPolicy -Effective -Xml', linux: 'systemctl is-active fapolicyd 2>/dev/null' } });
  B('SYS.1.1.A33', 'H', ALL, 'server', 'crypto', 'Aktive Verwaltung der Wurzelzertifikate', 'Active administration of root certificates',
    'Benötigte Wurzelzertifikate dokumentieren, nur diese vorhalten und regelmäßig prüfen.',
    { ssg: ['only_allow_specific_certs'], check: { linux: 'trust list --filter=ca-anchors | grep -c label', windows: 'Get-ChildItem Cert:\\LocalMachine\\Root | Measure-Object' } });
  B('SYS.1.1.A34', 'H', ALL, 'server', 'crypto', 'Festplattenverschlüsselung', 'Hard disk encryption',
    'Datenträger mit vertrauenswürdigem Verfahren verschlüsseln; nicht ausschließlich auf TPM verlassen.',
    { ssg: ['encrypt_partitions'], check: { linux: 'lsblk -o NAME,TYPE,FSTYPE,MOUNTPOINT | grep -i crypt', windows: 'manage-bde -status', macos: 'fdesetup status' } });
  B('SYS.1.1.A36', 'H', ALL, 'server', 'boot', 'Absicherung des Bootvorgangs', 'Protecting the boot process',
    'Bootkomponenten beim Start kryptografisch prüfen (Secure Boot mit vertrauenswürdigen Schlüsseln).',
    { check: { linux: 'mokutil --sb-state', windows: 'Confirm-SecureBootUEFI' } });
  B('SYS.1.1.A38', 'H', ALL, 'server', 'integrity', 'Härtung des Host-Systems mittels Read-Only-Dateisystem', 'Hardening the host system using a read-only file system',
    'Integrität des Host-Systems durch ein schreibgeschütztes (immutable) Dateisystem schützen.');

  /* ------------------------------------------------------------------
   * SYS.1.2.3 Windows Server (2016/2019/2022 – sinngemäß auch 2025)
   * ---------------------------------------------------------------- */
  B('SYS.1.2.3.A1', 'B', WIN, 'server', 'planning', 'Planung von Windows Server', 'Planning of Windows Server',
    'Begründete Wahl der Edition; Einsatzzweck, AD-Einbindung und Nutzung mitgelieferter Cloud-Dienste/Microsoft-Konten festlegen.');
  B('SYS.1.2.3.A2', 'B', WIN, 'server', 'install', 'Sichere Installation von Windows Server', 'Secure installation of Windows Server',
    'Server-Core-Variante installieren, sofern funktional ausreichend – sonst Desktop-Variante begründen.',
    { check: { windows: '(Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion").InstallationType' } });
  B('SYS.1.2.3.A3', 'B', WIN, 'server', 'privacy', 'Telemetrie- und Nutzungsdaten unter Windows Server', 'Telemetry and usage data under Windows Server',
    'Telemetrie auf Stufe 0 (Security) setzen bzw. Übertragung von Diagnosedaten auf Netzebene unterbinden.',
    { check: { windows: 'Get-ItemProperty "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" -Name AllowTelemetry' } });
  B('SYS.1.2.3.A4', 'S', WIN, 'server', 'exploit', 'Schutz vor Ausnutzung von Schwachstellen in Anwendungen', 'Protection against exploitation of vulnerabilities in applications',
    'Verfügbare Exploit-Schutzmaßnahmen (DEP, ASLR, CFG, Exploit Protection) für alle Programme und Dienste aktivieren.',
    { check: { windows: 'Get-ProcessMitigation -System' } });
  B('SYS.1.2.3.A5', 'S', WIN, 'server', 'accounts', 'Sichere Authentisierung und Autorisierung in Windows Server', 'Secure authentication and authorisation in Windows Server',
    'Privilegierte Benutzerkonten in die Gruppe „Protected Users“ aufnehmen; für Dienste (group) Managed Service Accounts nutzen.',
    { check: { windows: 'Get-ADGroupMember "Protected Users"; Get-ADServiceAccount -Filter *' } });
  B('SYS.1.2.3.A6', 'S', WIN, 'server', 'remote', 'Sicherheit beim Fernzugriff über RDP', 'Security of remote access via RDP',
    'RDP planen und absichern: Zugriffsgruppen beschränken, NLA, Gateways, Anmeldedaten schützen; ungenutzt deaktivieren.',
    { check: { windows: 'Get-ItemProperty "HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server\\WinStations\\RDP-Tcp" -Name UserAuthentication,SecurityLayer' } });
  B('SYS.1.2.3.A7', 'H', WIN, 'server', 'logging', 'Verwendung der Windows PowerShell', 'Use of Windows PowerShell',
    'PowerShell zentral protokollieren (Script Block/Module Logging), signierte Skripte erzwingen, PowerShell 2.0 entfernen, JEA/Constrained Language Mode prüfen.',
    { check: { windows: 'Get-ExecutionPolicy -List; Get-WindowsFeature PowerShell-V2' } });
  B('SYS.1.2.3.A8', 'H', WIN, 'server', 'exploit', 'Nutzung des Virtual Secure Mode (VSM)', 'Use of Virtual Secure Mode (VSM)',
    'VSM/Credential Guard nutzen und dabei die Auswirkungen auf forensische Untersuchungen berücksichtigen.',
    { check: { windows: '(Get-CimInstance -Namespace root\\Microsoft\\Windows\\DeviceGuard -ClassName Win32_DeviceGuard).SecurityServicesRunning' } });

  /* ------------------------------------------------------------------
   * SYS.1.3 Server unter Linux und Unix
   * ---------------------------------------------------------------- */
  B('SYS.1.3.A2', 'B', LIN, 'server', 'accounts', 'Sorgfältige Vergabe von IDs', 'Careful allocation of IDs',
    'Jede Kennung, UID und GID nur einmal vergeben; jeder Benutzende ist Mitglied mindestens einer Gruppe – auch systemübergreifend.',
    { ssg: ['account_unique_id', 'account_unique_name', 'gid_passwd_group_same', 'group_unique_id', 'group_unique_name'],
      check: { linux: 'cut -d: -f3 /etc/passwd | sort | uniq -d; cut -d: -f3 /etc/group | sort | uniq -d; sudo pwck -r; sudo grpck -r' } });
  B('SYS.1.3.A3', 'B', LIN, 'server', 'media', 'Kein automatisches Einbinden von Wechsellaufwerken', 'No automatic integration of removable drives',
    'Wechseldatenträger (USB, CD) nicht automatisch einbinden.',
    { ssg: ['bios_disable_usb_boot', 'grub2_nousb_argument', 'kernel_module_usb-storage_disabled', 'service_autofs_disabled'],
      check: { linux: 'systemctl is-enabled autofs udisks2 2>/dev/null; modprobe -n -v usb-storage' } });
  B('SYS.1.3.A4', 'B', LIN, 'server', 'exploit', 'Schutz vor Ausnutzung von Schwachstellen in Anwendungen', 'Protection from exploitation of vulnerabilities in applications',
    'ASLR, NX/DEP und Kernel-Härtungen nutzen; vorhandene Schutzmechanismen nicht deaktivieren.',
    { ssg: ['bios_enable_execution_restrictions', 'grub2_enable_selinux', 'package_libselinux_installed', 'selinux_not_disabled'],
      check: { linux: 'sysctl kernel.randomize_va_space; grep -o -w nx /proc/cpuinfo | head -1' } });
  B('SYS.1.3.A5', 'B', LIN, 'server', 'install', 'Sichere Installation von Software-Paketen', 'Secure installation of software packages',
    'Software bevorzugt aus signierten Paketquellen; Quellcode als unprivilegierter Benutzer übersetzen und Installation dokumentieren.',
    { check: { linux: 'grep -r "gpgcheck" /etc/yum.repos.d/ /etc/dnf/dnf.conf 2>/dev/null; apt-config dump | grep -i AllowUnauthenticated' } });
  B('SYS.1.3.A6', 'S', LIN, 'server', 'accounts', 'Verwaltung von Benutzenden und Gruppen', 'Managing users and groups',
    'Benutzende und Gruppen nur mit Verwaltungswerkzeugen (useradd, usermod …) pflegen, nicht durch direktes Editieren der Dateien.',
    { ssg: ['audit_rules_usergroup_modification_group', 'audit_rules_usergroup_modification_gshadow', 'audit_rules_usergroup_modification_opasswd', 'audit_rules_usergroup_modification_passwd', 'audit_rules_usergroup_modification_shadow'],
      check: { linux: 'sudo auditctl -l | grep -E "passwd|shadow|group"' } });
  B('SYS.1.3.A8', 'S', LIN, 'server', 'remote', 'Verschlüsselter Zugriff über Secure Shell', 'Encrypted access via Secure Shell',
    'Für interaktiven Fernzugriff ausschließlich SSH verwenden (kein Telnet/rsh); Schlüssel bzw. Zertifikate statt Passwörter.',
    { ssg: ['firewalld_sshd_port_enabled', 'package_telnet-server_removed', 'package_telnet_removed', 'service_sshd_enabled', 'sshd_disable_empty_passwords', 'sshd_disable_root_password_login', 'sshd_enable_pubkey_auth'],
      check: { linux: 'sudo sshd -T | grep -E "^(permitrootlogin|passwordauthentication|pubkeyauthentication|permitemptypasswords)"' } });
  B('SYS.1.3.A10', 'S', LIN, 'server', 'exploit', 'Verhinderung der Ausbreitung bei der Ausnutzung von Schwachstellen', 'Preventing further intrusion when vulnerabilities are exploited',
    'Dienste mit SELinux oder AppArmor einschränken (Enforcing-Modus), damit sich ein Angriff nicht ausbreitet.',
    { ssg: ['grub2_enable_selinux', 'selinux_confinement_of_daemons', 'selinux_not_disabled', 'selinux_policytype', 'selinux_state'],
      check: { linux: 'getenforce 2>/dev/null; sudo aa-status 2>/dev/null | head -5' } });
  B('SYS.1.3.A14', 'H', LIN, 'server', 'privilege', 'Verhinderung des Ausspähens von Informationen über das System und über Benutzende', 'Preventing unauthorised collection of system and user information',
    'Zugriff auf System-, Log- und Konfigurationsinformationen beschränken (restriktive Dateirechte, hidepid); keine Geheimnisse als Kommandozeilenparameter.',
    { ssg: ['file_permissions_etc_shadow', 'file_permissions_etc_passwd', 'file_permissions_sshd_config', 'file_permissions_unauthorized_suid', 'file_permissions_unauthorized_world_writable', 'file_permissions_var_log_audit'],
      check: { linux: 'stat -c "%a %U %n" /etc/shadow /etc/passwd /etc/ssh/sshd_config; findmnt /proc -o OPTIONS' } });
  B('SYS.1.3.A16', 'H', LIN, 'server', 'exploit', 'Zusätzliche Verhinderung der Ausbreitung bei der Ausnutzung von Schwachstellen', 'Additional prevention of further intrusion',
    'Systemaufrufe exponierter Dienste minimieren (seccomp, systemd-Sandboxing); SELinux-/AppArmor-Profile prüfen und anpassen.',
    { check: { linux: 'systemd-analyze security --no-pager | head -30' } });
  B('SYS.1.3.A17', 'H', LIN, 'server', 'exploit', 'Zusätzlicher Schutz des Kernels', 'Additional kernel protection',
    'Gehärtete Kernel bzw. zusätzliche Speicher-/Dateisystemschutzmechanismen einsetzen (z. B. Lockdown, kernel.kptr_restrict).',
    { check: { linux: 'cat /sys/kernel/security/lockdown 2>/dev/null; sysctl kernel.kptr_restrict kernel.dmesg_restrict kernel.unprivileged_bpf_disabled' } });

  /* ------------------------------------------------------------------
   * SYS.2.1 Allgemeiner Client
   * ---------------------------------------------------------------- */
  B('SYS.2.1.A1', 'B', ALL, 'client', 'accounts', 'Sichere Authentisierung von Benutzenden', 'Secure user authentication',
    'Anmeldung erforderlich, Bildschirmsperre bei Inaktivität, Abmeldung nach Arbeitsende.');
  B('SYS.2.1.A3', 'B', ALL, 'client', 'patch', 'Aktivieren von Autoupdate-Mechanismen', 'Activating auto-update mechanisms',
    'Automatische Updates aktivieren, sofern kein zentrales Patchmanagement existiert.',
    { check: { linux: 'systemctl status unattended-upgrades dnf-automatic.timer 2>/dev/null | grep -E "Loaded|Active"', windows: 'Get-ItemProperty HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU', macos: 'softwareupdate --schedule' } });
  B('SYS.2.1.A6', 'B', ALL, 'client', 'malware', 'Einsatz von Schutzprogrammen gegen Schadsoftware', 'Use of anti-malware software',
    'Schutzprogramme einsetzen, gegen Deaktivierung durch Benutzende sichern und Datenübertragungen prüfen.');
  B('SYS.2.1.A8', 'B', ALL, 'client', 'boot', 'Absicherung des Bootvorgangs', 'Protecting the boot process',
    'Bootvorgang gegen Manipulation schützen; Booten von fremden Medien nur durch Administrierende.');
  B('SYS.2.1.A42', 'B', ALL, 'client', 'privacy', 'Nutzung von Cloud- und Online-Funktionen', 'Use of cloud and online functions',
    'Cloud- und Online-Funktionen des Betriebssystems auf das Nötige beschränken.');
  B('SYS.2.1.A9', 'S', ALL, 'client', 'planning', 'Festlegung einer Sicherheitsrichtlinie für Clients', 'Defining a security policy for clients',
    'Allgemeine Sicherheitsrichtlinie für Clients konkretisieren und regelmäßig überprüfen.');
  B('SYS.2.1.A10', 'S', ALL, 'client', 'planning', 'Planung des Einsatzes von Clients', 'Planning the use of clients',
    'Einsatz der Clients planen und Entscheidungen dokumentieren.');
  B('SYS.2.1.A11', 'S', ALL, 'client', 'lifecycle', 'Beschaffung von Clients', 'Procurement of clients',
    'Produkte anhand von Anforderungen bewerten; zeitnahe Sicherheitsupdates des Herstellers berücksichtigen.');
  B('SYS.2.1.A13', 'S', ALL, 'client', 'boot', 'Zugriff auf Ausführungsumgebungen mit unbeobachtbarer Codeausführung', 'Access to execution environments with unobservable code execution',
    'Zugriff auf Firmware-/Management-Umgebungen (z. B. Intel ME/AMT) auf Administrierende beschränken, Firmware-Passwort setzen.');
  B('SYS.2.1.A15', 'S', ALL, 'client', 'install', 'Sichere Installation und Konfiguration von Clients', 'Secure installation and configuration of clients',
    'Installation und Konfiguration nur durch Berechtigte nach definiertem, dokumentiertem Prozess.');
  B('SYS.2.1.A16', 'S', ALL, 'client', 'services', 'Deaktivierung und Deinstallation nicht benötigter Komponenten und Kennungen', 'Deactivating and uninstalling unneeded components and IDs',
    'Nicht benötigte Komponenten, Konten, Schnittstellen und Hardware deaktivieren oder entfernen.');
  B('SYS.2.1.A18', 'S', ALL, 'client', 'crypto', 'Nutzung von verschlüsselten Kommunikationsverbindungen', 'Use of encrypted communication connections',
    'Kommunikation wo möglich verschlüsseln (aktuelle Verfahren, geprüfte Zertifikate).');
  B('SYS.2.1.A20', 'S', ALL, 'client', 'remote', 'Schutz der Administrationsverfahren bei Clients', 'Protection of client administration procedures',
    'Lokale und netzbasierte Administration gemäß Sicherheitsrichtlinie absichern.');
  B('SYS.2.1.A21', 'S', ALL, 'client', 'media', 'Verhinderung der unautorisierten Nutzung von Rechnermikrofonen und Kameras', 'Preventing unauthorised use of microphones and cameras',
    'Mikrofon und Kamera nur lokal Angemeldeten zugänglich machen; bei Nichtnutzung deaktivieren.');
  B('SYS.2.1.A23', 'S', ALL, 'client', 'network', 'Bevorzugung von Client-Server-Diensten', 'Preference of client-server services',
    'Client-Server-Dienste bevorzugen; Peer-to-Peer-Verbindungen und Discovery-Dienste einschränken.');
  B('SYS.2.1.A24', 'S', ALL, 'client', 'media', 'Umgang mit externen Medien und Wechseldatenträgern', 'Handling external media and removable storage',
    'Externe Schnittstellen und Wechseldatenträger beschränken; unbekannte Geräte und unberechtigtes Kopieren verhindern.');
  B('SYS.2.1.A26', 'S', ALL, 'client', 'exploit', 'Schutz vor Ausnutzung von Schwachstellen in Anwendungen', 'Protection against exploitation of vulnerabilities in applications',
    'ASLR, DEP/NX sowie Heap-/Stack-Schutz aktivieren.');
  B('SYS.2.1.A27', 'S', ALL, 'client', 'lifecycle', 'Geregelte Außerbetriebnahme eines Clients', 'Controlled decommissioning of a client',
    'Außerbetriebnahme per Checkliste ohne Datenverlust und ohne zurückbleibende schützenswerte Daten.');
  B('SYS.2.1.A34', 'S', ALL, 'client', 'exploit', 'Kapselung von sicherheitskritischen Anwendungen und Betriebssystemkomponenten', 'Encapsulation of security-critical applications and OS components',
    'Sicherheitskritische Anwendungen von riskanten (z. B. Browser) isolieren.');
  B('SYS.2.1.A43', 'S', ALL, 'client', 'install', 'Lokale Sicherheitsrichtlinien für Clients', 'Local security policies for clients',
    'Sicherheitseinstellungen konfigurieren, testen und dokumentieren – auch wenn sie dem Standard entsprechen.');
  B('SYS.2.1.A44', 'S', ALL, 'client', 'install', 'Verwaltung der Sicherheitsrichtlinien von Clients', 'Management of client security policies',
    'Einstellungen zentral über ein Managementsystem verwalten; Änderungen nachvollziehbar.');
  B('SYS.2.1.A28', 'H', ALL, 'client', 'crypto', 'Verschlüsselung der Clients', 'Encryption of clients',
    'Schützenswerte Dateien oder ganze Datenträger verschlüsseln; Schlüssel- und Wiederherstellungsverfahren planen.',
    { check: { windows: 'manage-bde -status', macos: 'fdesetup status', linux: 'lsblk -o NAME,FSTYPE | grep -i crypto' } });
  B('SYS.2.1.A29', 'H', ALL, 'client', 'availability', 'Systemüberwachung und Monitoring der Clients', 'System monitoring of clients',
    'Clients in ein Monitoring einbinden, das bei Fehlern und Schwellwerten alarmiert.');
  B('SYS.2.1.A30', 'H', ALL, 'client', 'install', 'Einrichten einer Referenzumgebung für Clients', 'Setting up a reference environment for clients',
    'Referenzumgebung zum Testen von Konfigurationen und Patches vor dem Rollout betreiben.');
  B('SYS.2.1.A31', 'H', ALL, 'client', 'network', 'Einrichtung lokaler Paketfilter', 'Configuring local packet filters',
    'Lokale Paketfilter, die nur notwendige Kommunikation explizit erlauben.');
  B('SYS.2.1.A32', 'H', ALL, 'client', 'exploit', 'Einsatz zusätzlicher Maßnahmen zum Schutz vor Exploits', 'Additional measures to protect against exploits',
    'Über Betriebssystemfunktionen hinausgehende Exploit-Schutzmaßnahmen einsetzen.');
  B('SYS.2.1.A33', 'H', ALL, 'client', 'exploit', 'Einsatz von Ausführungskontrolle', 'Using execution control',
    'Nur explizit freigegebene Programme und Skripte zulassen (Allowlisting).');
  B('SYS.2.1.A35', 'H', ALL, 'client', 'crypto', 'Aktive Verwaltung der Wurzelzertifikate', 'Active administration of root certificates',
    'Nur benötigte Wurzelzertifikate vorhalten, alle Zertifikatsspeicher regelmäßig prüfen.');
  B('SYS.2.1.A36', 'H', ALL, 'client', 'boot', 'Selbstverwalteter Einsatz von SecureBoot und TPM', 'Self-managed use of Secure Boot and TPM',
    'Bootkomponenten mit selbst kontrollierten Schlüsseln signieren; TPM deaktivieren, falls ungenutzt.');
  B('SYS.2.1.A37', 'H', ALL, 'client', 'accounts', 'Verwendung von Mehr-Faktor-Authentisierung', 'Use of multi-factor authentication',
    'Lokale Anmeldung mit Mehr-Faktor-Authentisierung (unterschiedliche Faktortypen).');
  B('SYS.2.1.A38', 'H', ALL, 'client', 'availability', 'Einbindung in die Notfallplanung', 'Integration into contingency planning',
    'Clients in die Notfallplanung einbeziehen (Wiederanlauf, Recovery-Medien, hinterlegte Zugangsdaten).');
  B('SYS.2.1.A39', 'H', ALL, 'client', 'availability', 'Unterbrechungsfreie und stabile Stromversorgung', 'Stable and uninterruptible power supply',
    'Clients an ausreichend dimensionierte USV anschließen und gegen Überspannung schützen.');
  B('SYS.2.1.A40', 'H', ALL, 'client', 'planning', 'Betriebsdokumentation', 'Operational documentation',
    'Betriebliche Aufgaben nachvollziehbar dokumentieren (wer, wann, was), insbesondere Konfigurationsänderungen.');
  B('SYS.2.1.A41', 'H', ALL, 'client', 'availability', 'Verwendung von Quotas für lokale Datenträger', 'Use of quotas for local storage',
    'Quotas oder Warnungen bei volllaufenden lokalen Datenträgern prüfen.');
  B('SYS.2.1.A45', 'H', ALL, 'client', 'logging', 'Erweiterte Protokollierung', 'Extended logging',
    'Auch nicht sicherheitsrelevantes Verhalten protokollieren und automatisiert auswerten, um verdeckte Angriffe zu erkennen.');

  /* ------------------------------------------------------------------
   * SYS.2.2.3 Clients unter Windows
   * ---------------------------------------------------------------- */
  B('SYS.2.2.3.A1', 'B', WIN, 'client', 'privacy', 'Planung des Einsatzes von Cloud-Diensten unter Windows', 'Planning the use of cloud services under Windows',
    'Erlaubte Microsoft-Cloud-Dienste und deren Umfang vor der Nutzung strategisch festlegen.');
  B('SYS.2.2.3.A2', 'B', WIN, 'client', 'lifecycle', 'Auswahl und Beschaffung einer geeigneten Windows-Version', 'Selection and procurement of a suitable Windows version',
    'Windows-Version nach Schutzbedarf, Einsatzzweck, Lizenz und Servicing-Kanal auswählen.');
  B('SYS.2.2.3.A4', 'B', WIN, 'client', 'privacy', 'Telemetrie und Datenschutzeinstellungen unter Windows', 'Telemetry and privacy settings under Windows',
    'Übermittlung von Telemetriedaten minimieren, ggf. auf Netzebene blockieren.',
    { check: { windows: 'Get-ItemProperty "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" -Name AllowTelemetry' } });
  B('SYS.2.2.3.A5', 'B', WIN, 'client', 'malware', 'Schutz vor Schadsoftware unter Windows', 'Protection against malware under Windows',
    'Anti-Malware-Komponente (z. B. Microsoft Defender) einsetzen, sofern keine gleichwertigen Maßnahmen bestehen.',
    { check: { windows: 'Get-MpComputerStatus | Select RealTimeProtectionEnabled,AntivirusSignatureAge' } });
  B('SYS.2.2.3.A6', 'B', WIN, 'client', 'accounts', 'Integration von Online-Konten in das Betriebssystem', 'Integration of online accounts into the OS',
    'Anmeldung nur über selbst betriebene Verzeichnisdienste; Microsoft- und andere Online-Konten unterbinden.');
  B('SYS.2.2.3.A9', 'S', WIN, 'client', 'accounts', 'Sichere zentrale Authentisierung in Windows-Netzen', 'Secure central authentication in Windows networks',
    'Kerberos bevorzugen; LAN Manager und NTLMv1 deaktivieren.',
    { check: { windows: 'Get-ItemProperty HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa -Name LmCompatibilityLevel,NoLMHash' } });
  B('SYS.2.2.3.A12', 'S', WIN, 'client', 'privilege', 'Datei- und Freigabeberechtigungen unter Windows', 'File and share permissions under Windows',
    'Dateizugriffe per Berechtigungskonzept steuern; keine Schreibrechte für Benutzende auf Systemordner.');
  B('SYS.2.2.3.A13', 'S', WIN, 'client', 'privacy', 'Einsatz der SmartScreen-Funktion', 'Use of the SmartScreen function',
    'SmartScreen-Einsatz bewerten (Übermittlung von Daten an Microsoft) und gemäß Vorgabe konfigurieren.');
  B('SYS.2.2.3.A14', 'S', WIN, 'client', 'privacy', 'Einsatz des Sprachassistenten Cortana', 'Use of the Cortana voice assistant',
    'Sprachassistenten Cortana deaktivieren.');
  B('SYS.2.2.3.A15', 'S', WIN, 'client', 'privacy', 'Einsatz der Synchronisationsmechanismen unter Windows', 'Use of synchronisation mechanisms under Windows',
    'Synchronisation von Benutzerdaten in die Microsoft-Cloud sowie WLAN-Kennwort-Freigabe deaktivieren.');
  B('SYS.2.2.3.A16', 'S', WIN, 'client', 'privacy', 'Anbindung von Windows an den Microsoft-Store', 'Connecting Windows to the Microsoft Store',
    'Microsoft Store datenschutzrechtlich bewerten und bei Nichtbedarf deaktivieren.');
  B('SYS.2.2.3.A17', 'S', WIN, 'client', 'accounts', 'Keine Speicherung von Daten zur automatischen Anmeldung', 'No storage of data for automatic login',
    'Speichern von Anmeldedaten/Zertifikaten für automatische Anmeldungen unterbinden.');
  B('SYS.2.2.3.A18', 'S', WIN, 'client', 'remote', 'Einsatz der Windows-Remoteunterstützung', 'Use of Windows Remote Assistance',
    'Remoteunterstützung nur mit expliziter Einladung und Zustimmung; ungenutzt deaktivieren.');
  B('SYS.2.2.3.A19', 'S', WIN, 'client', 'remote', 'Sicherheit beim Fernzugriff über RDP', 'Security of remote access via RDP',
    'RDP auf berechtigte Gruppen beschränken, ggf. über Gateways; ungenutzt deaktivieren.');
  B('SYS.2.2.3.A20', 'S', WIN, 'client', 'privilege', 'Einsatz der Benutzerkontensteuerung UAC für privilegierte Konten', 'Use of UAC for privileged accounts',
    'UAC-Einstellungen für privilegierte Konten festlegen; Entscheidungen und Admin-Konten dokumentieren.',
    { check: { windows: 'Get-ItemProperty HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System -Name EnableLUA,ConsentPromptBehaviorAdmin' } });
  B('SYS.2.2.3.A21', 'H', WIN, 'client', 'crypto', 'Einsatz des Encrypting File Systems', 'Use of the Encrypting File System',
    'Bei EFS: starke Passwörter, Zugriff beschränken, Schlüssel sichern, Benutzende schulen.');
  B('SYS.2.2.3.A22', 'H', WIN, 'client', 'logging', 'Verwendung der Windows PowerShell', 'Use of Windows PowerShell',
    'PowerShell auf Administrierende beschränken, zentral protokollieren, signierte Skripte erzwingen.');
  B('SYS.2.2.3.A23', 'H', WIN, 'client', 'accounts', 'Erweiterter Schutz der Anmeldeinformationen unter Windows', 'Extended protection of credentials under Windows',
    'Secure Boot und LSA-Schutz aktivieren, Status überwachen; RDP mit restrictedAdmin.',
    { check: { windows: 'Get-ItemProperty HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa -Name RunAsPPL' } });
  B('SYS.2.2.3.A24', 'H', WIN, 'client', 'logging', 'Aktivierung des Last-Access-Zeitstempels', 'Activation of the last-access timestamp',
    'Aktivierung des Last-Access-Zeitstempels unter Abwägung von Performance und Backup-Auswirkungen prüfen.');
  B('SYS.2.2.3.A25', 'H', WIN, 'client', 'privacy', 'Umgang mit Fernzugriffsfunktionen der „Connected User Experience and Telemetry“', 'Handling remote access functions of CUET',
    'Fernzugriffe des Dienstes „Connected User Experience and Telemetry“ auf Netzebene protokollieren und ggf. blockieren.');
  B('SYS.2.2.3.A26', 'H', WIN, 'client', 'exploit', 'Nutzung des Virtual Secure Mode (VSM)', 'Use of Virtual Secure Mode (VSM)',
    'VSM nutzen und Auswirkungen auf forensische Untersuchungen berücksichtigen.');

  /* ------------------------------------------------------------------
   * SYS.2.3 Clients unter Linux und Unix
   * ---------------------------------------------------------------- */
  B('SYS.2.3.A1', 'B', LIN, 'client', 'accounts', 'Authentisierung von Administrierenden und Benutzenden', 'Authentication of administrators and users',
    'Keine routinemäßigen root-Anmeldungen; sudo mit Protokollierung verwenden.',
    { check: { linux: 'sudo grep -E "^Defaults.*(logfile|log_output)" /etc/sudoers /etc/sudoers.d/* 2>/dev/null; passwd -S root' } });
  B('SYS.2.3.A2', 'B', LIN, 'client', 'lifecycle', 'Auswahl einer geeigneten Distribution', 'Selection of a suitable distribution',
    'Distribution mit langfristigem Support wählen, die benötigte Software überwiegend als Pakete bereitstellt.');
  B('SYS.2.3.A4', 'B', LIN, 'client', 'patch', 'Kernel-Aktualisierungen auf unixartigen Systemen', 'Kernel updates on Unix-like systems',
    'Nach Kernel-Updates zeitnah neu starten oder Live-Patching nutzen.',
    { check: { linux: 'uname -r; ls /var/run/reboot-required 2>/dev/null; needs-restarting -r 2>/dev/null' } });
  B('SYS.2.3.A5', 'B', LIN, 'client', 'install', 'Sichere Installation von Software-Paketen', 'Secure installation of software packages',
    'Quellcode unprivilegiert übersetzen, Installation dokumentieren, keine unkontrollierten systemweiten Installationen.');
  B('SYS.2.3.A6', 'S', LIN, 'client', 'media', 'Kein automatisches Einbinden von Wechsellaufwerken', 'No automatic mounting of removable drives',
    'Wechsellaufwerke nicht automatisch einbinden; falls doch, mit noexec.');
  B('SYS.2.3.A7', 'S', LIN, 'client', 'privilege', 'Restriktive Rechtevergabe auf Dateien und Verzeichnisse', 'Restrictive permissions on files and directories',
    'Dienste nur auf eigene Dateien zugreifen lassen; Sticky-Bit für weltbeschreibbare Verzeichnisse.',
    { check: { linux: 'sudo find / -xdev -type d -perm -0002 ! -perm -1000 2>/dev/null' } });
  B('SYS.2.3.A8', 'S', LIN, 'client', 'exploit', 'Einsatz von Techniken zur Rechtebeschränkung von Anwendungen', 'Use of techniques to restrict application privileges',
    'Anwendungen mit AppArmor/SELinux einschränken (Default-Deny, Enforcing-Modus).');
  B('SYS.2.3.A9', 'S', LIN, 'client', 'accounts', 'Sichere Verwendung von Passwörtern auf der Kommandozeile', 'Secure use of passwords on the command line',
    'Passwörter nie als Kommandozeilenparameter übergeben.');
  B('SYS.2.3.A11', 'S', LIN, 'client', 'availability', 'Verhinderung der Überlastung der lokalen Festplatte', 'Preventing local disk overload',
    'Quotas und getrennte Partitionen einsetzen, damit die Platte nicht vollläuft.',
    { check: { linux: 'df -h; findmnt -t ext4,xfs,btrfs' } });
  B('SYS.2.3.A12', 'S', LIN, 'client', 'install', 'Sicherer Einsatz von Appliances', 'Secure use of appliances',
    'Appliances müssen Client-Sicherheitsniveau erfüllen; Nachweis dokumentieren oder Herstellererklärung einholen.');
  B('SYS.2.3.A14', 'H', LIN, 'client', 'media', 'Absicherung gegen Nutzung unbefugter Peripheriegeräte', 'Protection against unauthorised peripherals',
    'Peripheriegeräte und Kernel-Module nur nach expliziter Freigabe aktivieren (z. B. USBGuard).');
  B('SYS.2.3.A15', 'H', LIN, 'client', 'exploit', 'Zusätzlicher Schutz vor der Ausführung unerwünschter Dateien', 'Additional protection against executing unwanted files',
    'Für Benutzende beschreibbare Partitionen mit noexec einbinden.',
    { check: { linux: 'findmnt -no TARGET,OPTIONS /tmp /var/tmp /home /dev/shm' } });
  B('SYS.2.3.A17', 'H', LIN, 'client', 'exploit', 'Zusätzliche Verhinderung der Ausbreitung bei der Ausnutzung von Schwachstellen', 'Additional prevention of spreading when vulnerabilities are exploited',
    'Systemaufrufe exponierter Dienste begrenzen, Standardprofile von SELinux/AppArmor prüfen und anpassen.');
  B('SYS.2.3.A18', 'H', LIN, 'client', 'exploit', 'Zusätzlicher Schutz des Kernels', 'Additional kernel protection',
    'Gehärtete Kernel mit Speicher-, Dateisystemschutz und rollenbasierter Zugriffskontrolle.');
  B('SYS.2.3.A19', 'H', LIN, 'client', 'crypto', 'Festplatten- oder Dateiverschlüsselung', 'Disk or file encryption',
    'Datenträger oder Dateien verschlüsseln (z. B. LUKS2), Schlüssel nicht auf dem System ablegen, AEAD-Verfahren.');
  B('SYS.2.3.A20', 'H', LIN, 'client', 'exploit', 'Abschaltung kritischer SysRq-Funktionen', 'Disabling critical SysRq functions',
    'Festlegen, welche SysRq-Funktionen erlaubt sind; kritische sperren.',
    { check: { linux: 'sysctl kernel.sysrq' } });

  /* ------------------------------------------------------------------
   * SYS.2.4 Clients unter macOS
   * ---------------------------------------------------------------- */
  B('SYS.2.4.A1', 'B', MAC, 'client', 'planning', 'Planung des sicheren Einsatzes von macOS', 'Planning the secure use of macOS',
    'Einführung planen: Datenablage, Datensicherung, Update-Prozess und benötigte Anwendungen festlegen.');
  B('SYS.2.4.A2', 'B', MAC, 'client', 'malware', 'Nutzung der integrierten Sicherheitsfunktionen von macOS', 'Use of integrated macOS security functions',
    'SIP, XProtect und Gatekeeper aktiv lassen; nur signierte Programme zulassen.',
    { check: { macos: 'csrutil status; spctl --status' } });
  B('SYS.2.4.A3', 'B', MAC, 'client', 'accounts', 'Verwendung geeigneter Konten', 'Use of appropriate accounts',
    'Admin-Konto nur zur Administration; je Person ein Standardkonto; Gast-Konto deaktivieren.',
    { check: { macos: 'dscl . -read /Groups/admin GroupMembership; defaults read /Library/Preferences/com.apple.loginwindow GuestEnabled' } });
  B('SYS.2.4.A4', 'S', MAC, 'client', 'crypto', 'Verwendung einer Festplattenverschlüsselung', 'Use of hard disk encryption',
    'FileVault aktivieren; Wiederherstellungsschlüssel nicht bei Apple, sondern sicher in der Institution hinterlegen.',
    { check: { macos: 'fdesetup status' } });
  B('SYS.2.4.A5', 'S', MAC, 'client', 'privacy', 'Deaktivierung sicherheitskritischer Funktionen von macOS', 'Deactivation of security-critical macOS functions',
    'Ortungsdienste deaktivieren; automatisches Öffnen von Downloads und Medien unterbinden.');
  B('SYS.2.4.A6', 'S', MAC, 'client', 'lifecycle', 'Verwendung aktueller Mac-Hardware', 'Use of current Mac hardware',
    'Aktuelle Modelle beschaffen, die weiterhin Sicherheitsupdates erhalten; nicht mehr unterstützte Macs aussondern.');
  B('SYS.2.4.A7', 'S', MAC, 'client', 'accounts', 'Zwei-Faktor-Authentisierung für Apple-ID', 'Two-factor authentication for Apple ID',
    'Für Apple-IDs die Zwei-Faktor-Authentisierung aktivieren.');
  B('SYS.2.4.A8', 'S', MAC, 'client', 'privacy', 'Keine Nutzung von iCloud für schützenswerte Daten', 'No use of iCloud for sensitive data',
    'Schützenswerte Daten nicht in iCloud speichern/synchronisieren; eigene Dienste bevorzugen.');
  B('SYS.2.4.A9', 'S', MAC, 'client', 'malware', 'Verwendung von zusätzlichen Schutzprogrammen unter macOS', 'Use of additional protection programs under macOS',
    'Wo nötig (z. B. gemischte Netze) zusätzlichen Virenschutz einsetzen.');
  B('SYS.2.4.A10', 'S', MAC, 'client', 'network', 'Aktivierung der Personal Firewall unter macOS', 'Activation of the personal firewall under macOS',
    'Integrierte Firewall aktivieren und passend konfigurieren (ggf. Stealth-Modus).',
    { check: { macos: '/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate --getstealthmode' } });
  B('SYS.2.4.A11', 'S', MAC, 'client', 'lifecycle', 'Geräteaussonderung von Macs', 'Decommissioning of Macs',
    'Bei Aussonderung Daten sicher löschen und NVRAM/SMC zurücksetzen (bzw. „Alle Inhalte & Einstellungen löschen“).');
  B('SYS.2.4.A12', 'H', MAC, 'client', 'boot', 'Firmware-Kennwort und Boot-Schutz auf Macs', 'Firmware password and boot protection on Macs',
    'Firmware-Kennwort bzw. Startsicherheit (je nach Mac-Generation) setzen, um unbefugtes Booten zu verhindern.');

  HA.CATALOG_BSI = items;
})();

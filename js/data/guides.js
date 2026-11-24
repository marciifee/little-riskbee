/* =====================================================================
 * guides.js – Schritt-für-Schritt-Härtungsanleitungen
 * ---------------------------------------------------------------------
 * Aufbau je Anleitung:
 *   { id, os: [OS-IDs], title:{de,en}, intro:{de,en}, steps: [
 *       { t:{de,en}, d:'Erläuterung (de)', code:'Befehle', refs:['SYS.1.3.A8', …] } ] }
 * "refs" verweisen auf Maßnahmen-IDs; die Webseite verlinkt sie in die
 * Checkliste. Befehle IMMER zuerst in einer Testumgebung ausprobieren
 * und vorher ein Backup/Snapshot anlegen!
 * ===================================================================== */
window.HA = window.HA || {};

HA.GUIDES = [
  /* ================================================================ */
  {
    id: 'method', os: ['*'],
    title: { de: 'Vorgehen: Härtung mit Wirksamkeitsnachweis', en: 'Method: hardening with proof of effectiveness' },
    intro: {
      de: 'Empfohlener Ablauf angelehnt an BSI-Standard 200-2 bzw. Grundschutz++ (BSI-Standard 300-1): erst erfassen und bewerten, dann messen, härten, erneut messen und dokumentieren.',
      en: 'Recommended workflow based on BSI Standard 200-2 / Grundschutz++ (BSI Standard 300-1): capture and assess first, then measure, harden, measure again and document.'
    },
    steps: [
      { t: { de: '1. Asset erfassen', en: '1. Register the asset' },
        d: 'Unter „Assets“ System anlegen: Name, Hostname, IP, Betriebssystem, Rolle (Server/Client), verantwortliche Person, Standort. Ohne vollständiges Inventar ist keine Härtung nachweisbar.' },
      { t: { de: '2. Schutzbedarf feststellen', en: '2. Determine protection needs' },
        d: 'Für Vertraulichkeit, Integrität und Verfügbarkeit jeweils „normal“, „hoch“ oder „sehr hoch“ wählen und begründen (Schadensszenarien: Gesetzesverstöße, Beeinträchtigung der Aufgabenerfüllung, finanzielle Auswirkungen …). Es gilt das Maximumprinzip. Bei „hoch/sehr hoch“ blendet die Checkliste zusätzlich die H-Anforderungen ein.' },
      { t: { de: '3. Bibliotheken auswählen', en: '3. Select libraries' },
        d: 'Je Asset eine oder mehrere Bibliotheken zuordnen (z. B. BSI GS 2023 + OpenSCAP SSG für Linux, BSI + Microsoft Baseline für Windows). Unter „Bibliotheken“ sehen Sie, wie viele Maßnahmen jede Bibliothek für das Betriebssystem enthält und welche Themen sie abdeckt.' },
      { t: { de: '4. Ausgangslage messen (Baseline-Scan)', en: '4. Measure the baseline' },
        d: 'Vor jeder Änderung: Lynis- und/oder OpenSCAP-Scan auf dem System, Nmap-Portscan und OpenVAS/Greenbone-Schwachstellenscan von außen. Berichte unter „Import“ einlesen – Zeitstempel und SHA-256-Prüfsumme werden als Nachweis gespeichert.' },
      { t: { de: '5. Härten nach Checkliste', en: '5. Harden using the checklist' },
        d: 'Maßnahmen abarbeiten (Anleitung für das jeweilige Betriebssystem nutzen). Nicht umsetzbare Maßnahmen als „entbehrlich“ markieren und begründen (z. B. „USB-Ports für Lizenzdongle erforderlich – kompensiert durch USBGuard-Allowlist“). Ein Risiko, das bewusst getragen wird, als „nicht umgesetzt“ mit Begründung und Risikoübernahme dokumentieren.' },
      { t: { de: '6. Erneut messen', en: '6. Measure again' },
        d: 'Scans wiederholen und importieren. OpenSCAP-Ergebnisse setzen den Status der SSG-Regeln automatisch; Lynis-Hardening-Index und offene OpenVAS-Befunde zeigen den Fortschritt.' },
      { t: { de: '7. Wirksamkeitskontrolle', en: '7. Effectiveness review' },
        d: 'Für umgesetzte Maßnahmen „Wirksamkeit geprüft“ mit Datum, Methode (Sichtprüfung, Konfigurationsabfrage, Scan, Test) und Ergebnis erfassen. Die Prüfbefehle der Checkliste helfen dabei.' },
      { t: { de: '8. Bericht erstellen und archivieren', en: '8. Create and archive the report' },
        d: 'Unter „Bericht“ einen A4-Hochformat-Bericht erzeugen, als HTML speichern und/oder als PDF drucken. Zwischenstand regelmäßig über „Speichern → Export (JSON)“ sichern. Härtung jährlich bzw. nach größeren Änderungen wiederholen.' }
    ]
  },

  /* ================================================================ */
  {
    id: 'debian-ubuntu', os: ['debian', 'ubuntu', 'linux-other'],
    title: { de: 'Debian 12/13 & Ubuntu 22.04/24.04 härten', en: 'Hardening Debian 12/13 & Ubuntu 22.04/24.04' },
    intro: {
      de: 'Alle Befehle als Benutzer mit sudo-Rechten ausführen. Eine zweite SSH-Sitzung offen halten, bis Änderungen an SSH, PAM und Firewall getestet sind – sonst droht der Aussperr-Effekt.',
      en: 'Run all commands as a sudo user. Keep a second SSH session open until SSH, PAM and firewall changes are tested to avoid locking yourself out.'
    },
    steps: [
      { t: { de: 'Vorbereitung & Inventar', en: 'Preparation & inventory' },
        d: 'Snapshot/Backup anlegen, Systemstand dokumentieren.',
        code: 'cat /etc/os-release; uname -r\ndpkg -l > ~/pakete-vorher.txt\nss -tulpen > ~/ports-vorher.txt\nsystemctl list-unit-files --state=enabled > ~/dienste-vorher.txt',
        refs: ['SYS.1.1.A16', 'SYS.1.1.A21'] },
      { t: { de: 'Baseline-Scan mit Lynis', en: 'Baseline scan with Lynis' },
        d: 'Lynis (GPLv3) prüft über 200 Punkte und erzeugt /var/log/lynis-report.dat – diese Datei in der Webseite importieren. Distributionspakete sind teils älter; aktuelle Version über das CISOfy-Repository oder Git.',
        code: 'sudo apt install lynis\nsudo lynis audit system\nsudo cp /var/log/lynis-report.dat ~/lynis-$(hostname)-$(date +%F).dat',
        refs: ['SYS.1.1.A24'] },
      { t: { de: 'Baseline-Scan mit OpenSCAP (SSG)', en: 'Baseline scan with OpenSCAP (SSG)' },
        d: 'Aktuellen SSG-Content als ZIP vom ComplianceAsCode-GitHub-Release laden (SHA-512 prüfen). Mit „oscap info“ die verfügbaren Profile anzeigen (Ubuntu z. B. cis_level1_server, Debian z. B. anssi_*). Die results.xml in der Webseite importieren.',
        code: 'sudo apt install openscap-scanner   # Paketname je nach Release: openscap-scanner bzw. libopenscap8\nunzip scap-security-guide-*.zip && cd scap-security-guide-*/\noscap info ssg-ubuntu2404-ds.xml        # bzw. ssg-debian12-ds.xml\nsudo oscap xccdf eval \\\n  --profile xccdf_org.ssgproject.content_profile_cis_level1_server \\\n  --results results-$(hostname).xml --report report-$(hostname).html \\\n  ssg-ubuntu2404-ds.xml',
        refs: ['SYS.1.1.A24'] },
      { t: { de: 'Updates & automatische Sicherheitsupdates', en: 'Updates & automatic security updates' },
        d: 'System aktualisieren und unattended-upgrades für Sicherheitsupdates aktivieren. needrestart zeigt Dienste, die nach Updates neu gestartet werden müssen.',
        code: 'sudo apt update && sudo apt full-upgrade\nsudo apt install unattended-upgrades apt-listchanges needrestart\nsudo dpkg-reconfigure -plow unattended-upgrades\n[ -f /var/run/reboot-required ] && echo "Neustart erforderlich"',
        refs: ['SYS.2.1.A3', 'SYS.2.3.A4', 'security_patches_up_to_date'] },
      { t: { de: 'Konten & sudo', en: 'Accounts & sudo' },
        d: 'Persönliche Admin-Konten mit sudo, root-Anmeldung sperren, UID-0- und leere Passwörter prüfen, Passwortqualität erzwingen.',
        code: 'sudo adduser admin.mustermann && sudo usermod -aG sudo admin.mustermann\nsudo passwd -l root\nawk -F: \'($3==0){print $1}\' /etc/passwd          # nur "root"\nsudo awk -F: \'($2==""){print $1}\' /etc/shadow    # leer\nsudo apt install libpam-pwquality\necho "minlen = 14" | sudo tee -a /etc/security/pwquality.conf\necho \'Defaults logfile="/var/log/sudo.log"\' | sudo tee /etc/sudoers.d/90-logging\nsudo visudo -c',
        refs: ['SYS.1.1.A2', 'SYS.2.3.A1', 'accounts_no_uid_except_zero', 'accounts_password_pam_minlen', 'sudo_custom_logfile'] },
      { t: { de: 'SSH absichern', en: 'Secure SSH' },
        d: 'Einstellungen als Drop-in-Datei ablegen (überlebt Paket-Updates). Vorher eigenen Public Key hinterlegen (ssh-copy-id) und mit zweiter Sitzung testen. Optional mit dem Open-Source-Werkzeug „ssh-audit“ die Krypto-Konfiguration prüfen.',
        code: 'sudo tee /etc/ssh/sshd_config.d/99-hardening.conf >/dev/null <<\'EOF\'\nPermitRootLogin no\nPasswordAuthentication no\nPubkeyAuthentication yes\nPermitEmptyPasswords no\nMaxAuthTries 4\nX11Forwarding no\nAllowTcpForwarding no\nClientAliveInterval 300\nClientAliveCountMax 2\nLogLevel VERBOSE\n# AllowGroups ssh-users\nEOF\nsudo sshd -t && sudo systemctl reload ssh',
        refs: ['SYS.1.3.A8', 'sshd_disable_root_login', 'sshd_enable_pubkey_auth', 'sshd_set_max_auth_tries'] },
      { t: { de: 'Lokale Firewall (ufw oder nftables)', en: 'Local firewall (ufw or nftables)' },
        d: 'Eingehend alles verbieten, nur benötigte Dienste aus definierten Netzen erlauben.',
        code: 'sudo apt install ufw\nsudo ufw default deny incoming\nsudo ufw default allow outgoing\nsudo ufw allow from 10.0.0.0/24 to any port 22 proto tcp   # Admin-Netz anpassen!\nsudo ufw logging on\nsudo ufw enable && sudo ufw status verbose',
        refs: ['SYS.1.1.A19', 'package_nftables_installed'] },
      { t: { de: 'Nicht benötigte Dienste & Pakete entfernen', en: 'Remove unneeded services & packages' },
        d: 'Jeden aktiven Dienst begründen können; Rest deaktivieren bzw. deinstallieren.',
        code: 'systemctl list-unit-files --type=service --state=enabled\nsudo systemctl disable --now avahi-daemon cups 2>/dev/null\nsudo apt purge telnet rsh-client rsh-server xinetd 2>/dev/null\nsudo apt autoremove --purge',
        refs: ['SYS.1.1.A6', 'SYS.2.1.A16', 'service_avahi-daemon_disabled', 'package_telnet-server_removed'] },
      { t: { de: 'Kernel-Parameter (sysctl)', en: 'Kernel parameters (sysctl)' },
        d: 'Netzwerk- und Exploit-Schutz per Drop-in. IP-Forwarding nur deaktivieren, wenn das System kein Router/Container-Host ist.',
        code: 'sudo tee /etc/sysctl.d/99-hardening.conf >/dev/null <<\'EOF\'\nkernel.randomize_va_space = 2\nkernel.kptr_restrict = 2\nkernel.dmesg_restrict = 1\nkernel.yama.ptrace_scope = 1\nkernel.unprivileged_bpf_disabled = 1\nkernel.sysrq = 0\nfs.protected_symlinks = 1\nfs.protected_hardlinks = 1\nfs.suid_dumpable = 0\nnet.ipv4.ip_forward = 0\nnet.ipv4.conf.all.accept_redirects = 0\nnet.ipv4.conf.all.send_redirects = 0\nnet.ipv4.conf.all.accept_source_route = 0\nnet.ipv4.conf.all.rp_filter = 1\nnet.ipv4.tcp_syncookies = 1\nnet.ipv6.conf.all.accept_redirects = 0\nEOF\nsudo sysctl --system',
        refs: ['SYS.1.3.A4', 'SYS.1.3.A17', 'SYS.2.3.A20', 'sysctl_kernel_randomize_va_space', 'sysctl_kernel_kptr_restrict'] },
      { t: { de: 'Wechseldatenträger & ungenutzte Module', en: 'Removable media & unused modules' },
        d: 'Nur wenn keine USB-Speicher benötigt werden. Für feingranulare Freigaben eignet sich USBGuard.',
        code: 'sudo tee /etc/modprobe.d/hardening.conf >/dev/null <<\'EOF\'\ninstall usb-storage /bin/false\ninstall cramfs /bin/false\ninstall freevxfs /bin/false\ninstall hfs /bin/false\ninstall hfsplus /bin/false\ninstall udf /bin/false\nEOF\nsudo update-initramfs -u',
        refs: ['SYS.1.3.A3', 'SYS.1.1.A5', 'kernel_module_usb-storage_disabled'] },
      { t: { de: 'Dateisystem-Optionen', en: 'File system options' },
        d: '/tmp und /dev/shm ohne Ausführungsrechte einbinden (Debian 13 nutzt für /tmp bereits tmpfs). Änderungen an /etc/fstab vorher in einer Testumgebung prüfen.',
        code: '# /etc/fstab (Beispiele)\ntmpfs /tmp     tmpfs defaults,rw,nosuid,nodev,noexec,relatime,size=2G 0 0\ntmpfs /dev/shm tmpfs defaults,rw,nosuid,nodev,noexec 0 0\nsudo mount -o remount /tmp; findmnt /tmp',
        refs: ['SYS.2.3.A15', 'mount_option_tmp_noexec'] },
      { t: { de: 'AppArmor erzwingen', en: 'Enforce AppArmor' },
        d: 'AppArmor ist unter Debian/Ubuntu standardmäßig aktiv. Profile für exponierte Dienste prüfen und vom complain- in den enforce-Modus bringen.',
        code: 'sudo aa-status\nsudo apt install apparmor-utils apparmor-profiles apparmor-profiles-extra\nsudo aa-enforce /etc/apparmor.d/usr.sbin.<dienst>',
        refs: ['SYS.1.3.A10', 'SYS.2.3.A8', 'package_apparmor_installed'] },
      { t: { de: 'Protokollierung: auditd, journald, Zeit', en: 'Logging: auditd, journald, time' },
        d: 'auditd für sicherheitsrelevante Ereignisse, persistentes Journal, Zeitsynchronisation und Weiterleitung an einen zentralen Log-Server. Beispielregeln liegen unter /usr/share/doc/auditd/examples/rules/.',
        code: 'sudo apt install auditd audispd-plugins chrony\nsudo tee /etc/audit/rules.d/50-identity.rules >/dev/null <<\'EOF\'\n-w /etc/passwd -p wa -k identity\n-w /etc/shadow -p wa -k identity\n-w /etc/group -p wa -k identity\n-w /etc/gshadow -p wa -k identity\n-w /etc/sudoers -p wa -k scope\n-w /etc/sudoers.d/ -p wa -k scope\nEOF\nsudo augenrules --load && sudo auditctl -l\nsudo mkdir -p /etc/systemd/journald.conf.d\nprintf "[Journal]\\nStorage=persistent\\n" | sudo tee /etc/systemd/journald.conf.d/persist.conf\nsudo systemctl restart systemd-journald\nchronyc tracking',
        refs: ['SYS.1.1.A10', 'SYS.1.3.A6', 'service_auditd_enabled', 'service_chronyd_enabled'] },
      { t: { de: 'Dateiintegrität mit AIDE', en: 'File integrity with AIDE' },
        d: 'Erst NACH der Härtung initialisieren, damit die Referenz den gehärteten Zustand abbildet. Regelmäßige Prüfung per Timer.',
        code: 'sudo apt install aide aide-common\nsudo aideinit\nsudo aide --config /etc/aide/aide.conf --check',
        refs: ['SYS.1.1.A27', 'package_aide_installed', 'aide_build_database'] },
      { t: { de: 'Virenschutz mit ClamAV (optional)', en: 'Anti-virus with ClamAV (optional)' },
        d: 'Sinnvoll v. a. auf Servern, die Dateien aus externen Quellen annehmen (Uploads, Importverzeichnisse). freshclam hält die Signaturen aktuell; Scans gezielt auf die betroffenen Verzeichnisse richten. Ausgabe von Dienststatus und Scan-Zusammenfassung als Nachweis in der Checkliste (SYS.1.1.A9) ablegen.',
        code: 'sudo apt update\nsudo apt install clamav clamav-freshclam\nsudo systemctl enable --now clamav-freshclam.service\n\n# Signatur-Updates prüfen und einen Scan starten\nsystemctl status clamav-freshclam.service --no-pager\nsudo journalctl -u clamav-freshclam.service -n 20 --no-pager\nclamscan --version\n\n# Beispielpfad anpassen\nclamscan --recursive --infected /pfad/zum/ordner',
        refs: ['SYS.1.1.A9', 'SYS.2.1.A6'] },
      { t: { de: 'Erneut scannen & importieren', en: 'Re-scan & import' },
        d: 'Lynis und OpenSCAP erneut ausführen, Ergebnisse importieren, Hardening-Index vergleichen, offene Punkte begründen. OpenSCAP kann zudem Ansible-Playbooks zur Nachbesserung erzeugen (vor Anwendung prüfen!).',
        code: 'sudo lynis audit system\nsudo oscap xccdf eval --profile <PROFIL> --results results-nachher.xml <DATASTREAM>\noscap xccdf generate fix --fix-type ansible --profile <PROFIL> --output fix.yml <DATASTREAM>',
        refs: ['SYS.1.1.A24'] }
    ]
  },

  /* ================================================================ */
  {
    id: 'fedora-rhel', os: ['fedora', 'rhel'],
    title: { de: 'Fedora & RHEL / AlmaLinux / Rocky Linux härten', en: 'Hardening Fedora & RHEL / AlmaLinux / Rocky Linux' },
    intro: {
      de: 'Für die Red-Hat-Familie liefert die Distribution OpenSCAP und den SCAP Security Guide direkt mit. Für RHEL 9/10 enthält SSG Kontrollzuordnungen zu BSI SYS.1.1 und SYS.1.3 (für RHEL 10 als eigenes Profil „bsi“, mit „oscap info“ prüfen).',
      en: 'The Red Hat family ships OpenSCAP and the SCAP Security Guide directly. For RHEL 9/10 SSG contains control mappings for BSI SYS.1.1 and SYS.1.3 (for RHEL 10 as dedicated "bsi" profile – verify with "oscap info").'
    },
    steps: [
      { t: { de: 'Vorbereitung & Inventar', en: 'Preparation & inventory' },
        d: 'Snapshot/Backup anlegen und Ausgangszustand sichern.',
        code: 'cat /etc/os-release; rpm -qa | sort > ~/pakete-vorher.txt\nss -tulpen > ~/ports-vorher.txt\nsudo firewall-cmd --list-all-zones > ~/firewall-vorher.txt',
        refs: ['SYS.1.1.A16'] },
      { t: { de: 'OpenSCAP-Scan', en: 'OpenSCAP scan' },
        d: 'Profile anzeigen, Scan ausführen, results.xml importieren. Beispiele für Profile: cis_server_l1, anssi_bp28_enhanced, stig, bsi (RHEL 10).',
        code: 'sudo dnf install openscap-scanner scap-security-guide\nls /usr/share/xml/scap/ssg/content/\noscap info /usr/share/xml/scap/ssg/content/ssg-rhel9-ds.xml\nsudo oscap xccdf eval \\\n  --profile xccdf_org.ssgproject.content_profile_cis_server_l1 \\\n  --results results-$(hostname).xml --report report-$(hostname).html \\\n  /usr/share/xml/scap/ssg/content/ssg-rhel9-ds.xml',
        refs: ['SYS.1.1.A24'] },
      { t: { de: 'Updates & dnf-automatic', en: 'Updates & dnf-automatic' },
        d: 'Sicherheitsupdates automatisch einspielen (Fedora 41+ nutzt dnf5 – Timer heißt dort dnf5-automatic.timer).',
        code: 'sudo dnf upgrade --refresh\nsudo dnf install dnf-automatic\nsudo sed -i \'s/^upgrade_type.*/upgrade_type = security/; s/^apply_updates.*/apply_updates = yes/\' /etc/dnf/automatic.conf\nsudo systemctl enable --now dnf-automatic.timer\nsudo dnf needs-restarting -r',
        refs: ['SYS.2.3.A4', 'security_patches_up_to_date', 'ensure_gpgcheck_globally_activated'] },
      { t: { de: 'Konten, PAM & faillock', en: 'Accounts, PAM & faillock' },
        d: 'authselect verwaltet PAM. Profil mit faillock wählen; Passwortqualität in pwquality.conf.',
        code: 'sudo authselect current\nsudo authselect select local with-faillock --force   # bzw. sssd with-faillock\nsudo sed -i \'s/^# *deny.*/deny = 5/; s/^# *unlock_time.*/unlock_time = 900/\' /etc/security/faillock.conf\necho "minlen = 14" | sudo tee /etc/security/pwquality.conf.d/50-minlen.conf',
        refs: ['SYS.1.1.A2', 'accounts_passwords_pam_faillock_deny', 'accounts_password_pam_minlen'] },
      { t: { de: 'SSH absichern', en: 'Secure SSH' },
        d: 'Drop-in-Datei wie bei Debian; Dienst heißt hier sshd. Krypto-Algorithmen werden über die systemweite Crypto-Policy gesteuert.',
        code: 'sudo tee /etc/ssh/sshd_config.d/99-hardening.conf >/dev/null <<\'EOF\'\nPermitRootLogin no\nPasswordAuthentication no\nPermitEmptyPasswords no\nMaxAuthTries 4\nX11Forwarding no\nClientAliveInterval 300\nLogLevel VERBOSE\nEOF\nsudo sshd -t && sudo systemctl reload sshd',
        refs: ['SYS.1.3.A8', 'sshd_disable_root_login'] },
      { t: { de: 'firewalld', en: 'firewalld' },
        d: 'Aktive Zone prüfen und nicht benötigte Dienste (z. B. cockpit, dhcpv6-client) entfernen.',
        code: 'sudo firewall-cmd --get-active-zones\nsudo firewall-cmd --list-all\nsudo firewall-cmd --permanent --remove-service=cockpit\nsudo firewall-cmd --permanent --add-rich-rule=\'rule family=ipv4 source address=10.0.0.0/24 service name=ssh accept\'\nsudo firewall-cmd --permanent --remove-service=ssh   # nur nach Test der Rich-Rule!\nsudo firewall-cmd --reload',
        refs: ['SYS.1.1.A19', 'service_firewalld_enabled'] },
      { t: { de: 'SELinux & Crypto-Policy', en: 'SELinux & crypto policy' },
        d: 'SELinux muss „Enforcing“ sein. Denials mit ausearch analysieren statt SELinux abzuschalten. Crypto-Policy nicht auf LEGACY stellen.',
        code: 'getenforce; sestatus\nsudo sed -i \'s/^SELINUX=.*/SELINUX=enforcing/\' /etc/selinux/config\nsudo ausearch -m avc -ts recent\nupdate-crypto-policies --show     # DEFAULT oder FUTURE',
        refs: ['SYS.1.3.A10', 'SYS.1.1.A37', 'selinux_state', 'configure_crypto_policy'] },
      { t: { de: 'Kernel-Parameter & Module', en: 'Kernel parameters & modules' },
        d: 'Gleiche sysctl- und modprobe-Drop-ins wie in der Debian-Anleitung verwenden (/etc/sysctl.d/99-hardening.conf, /etc/modprobe.d/hardening.conf).',
        code: 'sudo sysctl --system\nsudo dracut -f   # nach Änderungen an modprobe.d',
        refs: ['SYS.1.3.A4', 'SYS.1.3.A17'] },
      { t: { de: 'auditd, AIDE, fapolicyd, USBGuard', en: 'auditd, AIDE, fapolicyd, USBGuard' },
        d: 'auditd ist vorinstalliert. AIDE nach der Härtung initialisieren. fapolicyd (Ausführungskontrolle) und USBGuard sind H-Maßnahmen – erst im Testbetrieb einführen.',
        code: 'sudo systemctl is-active auditd\nsudo dnf install aide && sudo aide --init\nsudo mv /var/lib/aide/aide.db.new.gz /var/lib/aide/aide.db.gz\nsudo dnf install fapolicyd usbguard   # optional (H)\nsudo usbguard generate-policy | sudo tee /etc/usbguard/rules.conf',
        refs: ['SYS.1.1.A27', 'SYS.1.1.A31', 'SYS.2.3.A14', 'package_aide_installed', 'fapolicy_default_deny'] },
      { t: { de: 'Virenschutz mit ClamAV (optional)', en: 'Anti-virus with ClamAV (optional)' },
        d: 'Sinnvoll v. a. auf Servern, die Dateien aus externen Quellen annehmen (Uploads, Importverzeichnisse). freshclam hält die Signaturen aktuell; Scans gezielt auf die betroffenen Verzeichnisse richten. Ausgabe von Dienststatus und Scan-Zusammenfassung als Nachweis in der Checkliste (SYS.1.1.A9) ablegen.',
        code: 'sudo dnf install clamav clamav-freshclam\nsudo systemctl enable --now clamav-freshclam.service\n\n# Signatur-Updates prüfen und einen Scan starten\nsystemctl status clamav-freshclam.service --no-pager\nsudo journalctl -u clamav-freshclam.service -n 20 --no-pager\nclamscan --version\n\n# Beispielpfad anpassen\nclamscan --recursive --infected /pfad/zum/ordner',
        refs: ['SYS.1.1.A9', 'SYS.2.1.A6'] },
      { t: { de: 'Automatisierte Nachbesserung (optional)', en: 'Automated remediation (optional)' },
        d: 'OpenSCAP kann aus dem Profil ein Ansible-Playbook oder Bash-Skript erzeugen. Unbedingt lesen und testen – einige Regeln können Dienste beeinträchtigen.',
        code: 'oscap xccdf generate fix --fix-type ansible \\\n  --profile xccdf_org.ssgproject.content_profile_cis_server_l1 \\\n  --output hardening.yml /usr/share/xml/scap/ssg/content/ssg-rhel9-ds.xml\nansible-playbook -i "localhost," -c local --check hardening.yml' }
    ]
  },

  /* ================================================================ */
  {
    id: 'windows', os: ['win-server', 'win-client'],
    title: { de: 'Windows Server 2016–2025 & Windows 11 härten', en: 'Hardening Windows Server 2016–2025 & Windows 11' },
    intro: {
      de: 'Grundlage ist die Microsoft Security Baseline (kostenloses Security Compliance Toolkit) ergänzt um die BSI-Bausteine SYS.1.2.3 bzw. SYS.2.2.3. In Domänen werden Einstellungen per GPO verteilt, auf Einzelsystemen lokal. PowerShell als Administrator ausführen.',
      en: 'Based on the Microsoft Security Baseline (free Security Compliance Toolkit) complemented by BSI modules SYS.1.2.3 / SYS.2.2.3. In domains, distribute settings via GPO; on standalone systems apply locally. Run PowerShell as administrator.'
    },
    steps: [
      { t: { de: 'Vorbereitung & Inventar', en: 'Preparation & inventory' },
        d: 'Snapshot/Systemsicherung, installierte Rollen, Dienste und offene Ports dokumentieren.',
        code: 'Get-ComputerInfo | Select OsName,OsVersion,OsBuildNumber,WindowsInstallationType\nGet-WindowsFeature | Where-Object Installed | Export-Csv rollen-vorher.csv -NoType   # Server\nGet-NetTCPConnection -State Listen | Sort LocalPort | Export-Csv ports-vorher.csv -NoType',
        refs: ['SYS.1.2.3.A1', 'SYS.1.1.A16'] },
      { t: { de: 'Server Core & minimale Rollen', en: 'Server Core & minimal roles' },
        d: 'Server Core bevorzugen; nicht benötigte Rollen/Features entfernen.',
        code: '(Get-ItemProperty "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion").InstallationType\nUninstall-WindowsFeature -Name <Feature> -Remove\nDisable-WindowsOptionalFeature -Online -FeatureName MicrosoftWindowsPowerShellV2Root',
        refs: ['SYS.1.2.3.A2', 'SYS.1.1.A6', 'MSB-SVC-03'] },
      { t: { de: 'Updates', en: 'Updates' },
        d: 'Updates über WSUS, Intune oder Windows Update for Business zentral steuern; auf Server Core über sconfig.',
        code: 'Get-HotFix | Sort InstalledOn -Descending | Select -First 10\nsconfig   # Server Core: Option "Updates installieren"',
        refs: ['MSB-PAT-01', 'SYS.2.1.A3'] },
      { t: { de: 'Security Baseline anwenden', en: 'Apply the security baseline' },
        d: 'Security Compliance Toolkit von Microsoft laden, passende Baseline wählen (z. B. „Windows Server 2025 Security Baseline“). Mit Policy Analyzer gegen den Ist-Stand vergleichen; in der Domäne GPO-Backups importieren, auf Einzelsystemen das mitgelieferte Skript bzw. LGPO.exe nutzen. Für Windows Server 2025 bietet Microsoft zusätzlich OSConfig (PowerShell-Modul) zum Anwenden und Überwachen der Baseline an.',
        code: '# Einzelsystem (Beispiel aus dem Baseline-Paket):\n.\\Scripts\\Baseline-LocalInstall.ps1 -WSMember   # Parameter je Paket prüfen\n# Windows Server 2025 mit OSConfig (laut Microsoft Learn):\nInstall-Module -Name Microsoft.OSConfig -Scope AllUsers\nSet-OSConfigDesiredConfiguration -Scenario SecurityBaseline/WS2025/MemberServer -Default',
        refs: ['SYS.1.1.A39', 'SYS.2.1.A44'] },
      { t: { de: 'Konten: LAPS, Protected Users, Tiering', en: 'Accounts: LAPS, Protected Users, tiering' },
        d: 'Lokale Admin-Kennwörter mit Windows LAPS verwalten; privilegierte Konten in „Protected Users“; getrennte Admin-Konten je Ebene (Tier 0/1/2).',
        code: 'Update-LapsADSchema\nSet-LapsADComputerSelfPermission -Identity "OU=Server,DC=firma,DC=local"\n# GPO: System > LAPS > Kennwortsicherungsverzeichnis konfigurieren = Active Directory\nAdd-ADGroupMember "Protected Users" -Members adm.mustermann\nnet accounts',
        refs: ['SYS.1.2.3.A5', 'MSB-ACC-03', 'MSB-ACC-01'] },
      { t: { de: 'Authentisierung: NTLM/LM, LSA, WDigest', en: 'Authentication: NTLM/LM, LSA, WDigest' },
        d: 'Per GPO: LmCompatibilityLevel 5, NoLMHash, LSA-Schutz, WDigest aus. NTLM-Nutzung vorher mit Überwachung erheben, bevor NTLM eingeschränkt wird.',
        code: 'reg add HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa /v LmCompatibilityLevel /t REG_DWORD /d 5 /f\nreg add HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa /v RunAsPPL /t REG_DWORD /d 1 /f\nreg add HKLM\\SYSTEM\\CurrentControlSet\\Control\\SecurityProviders\\WDigest /v UseLogonCredential /t REG_DWORD /d 0 /f',
        refs: ['SYS.2.2.3.A9', 'SYS.2.2.3.A23', 'MSB-AUTH-01', 'MSB-AUTH-03', 'MSB-AUTH-04'] },
      { t: { de: 'SMB & Namensauflösung', en: 'SMB & name resolution' },
        d: 'SMBv1 entfernen, Signierung erzwingen, LLMNR per GPO abschalten.',
        code: 'Set-SmbServerConfiguration -EnableSMB1Protocol $false -RequireSecuritySignature $true -Force\nSet-SmbClientConfiguration -RequireSecuritySignature $true -Force\nDisable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol -NoRestart',
        refs: ['MSB-NET-01', 'MSB-NET-02', 'MSB-NET-03'] },
      { t: { de: 'Windows-Firewall & RDP', en: 'Windows Firewall & RDP' },
        d: 'Alle Profile aktiv, eingehend blockieren, RDP nur mit NLA und nur aus dem Admin-Netz.',
        code: 'Set-NetFirewallProfile -Profile Domain,Private,Public -Enabled True -DefaultInboundAction Block -LogBlocked True\nSet-ItemProperty "HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server\\WinStations\\RDP-Tcp" -Name UserAuthentication -Value 1\nGet-NetFirewallRule -DisplayGroup "Remote Desktop","Remotedesktop" -ErrorAction SilentlyContinue | Set-NetFirewallRule -RemoteAddress 10.0.0.0/24',
        refs: ['SYS.1.1.A19', 'SYS.1.2.3.A6', 'MSB-NET-04', 'MSB-RDP-01'] },
      { t: { de: 'Defender, ASR & Exploit Protection', en: 'Defender, ASR & exploit protection' },
        d: 'Echtzeitschutz prüfen, ASR-Regeln zunächst im Überwachungsmodus aktivieren (Beispiel: LSASS-Schutz), Exploit-Schutz prüfen.',
        code: 'Get-MpComputerStatus | Select AMServiceEnabled,RealTimeProtectionEnabled,AntivirusSignatureLastUpdated\nUpdate-MpSignature\nAdd-MpPreference -AttackSurfaceReductionRules_Ids 9e6c4e1f-7d60-472f-ba1a-a39ef669e4b2 -AttackSurfaceReductionRules_Actions AuditMode\nGet-ProcessMitigation -System',
        refs: ['SYS.1.1.A9', 'SYS.1.2.3.A4', 'MSB-MAL-01', 'MSB-MAL-02'] },
      { t: { de: 'Protokollierung', en: 'Logging' },
        d: 'Erweiterte Überwachungsrichtlinie per GPO (Computerkonfiguration › Richtlinien › Windows-Einstellungen › Sicherheitseinstellungen › Erweiterte Überwachungsrichtlinienkonfiguration), PowerShell-Logging, Prozess-Befehlszeilen, Größe des Sicherheitsprotokolls, Weiterleitung (WEF/SIEM).',
        code: 'auditpol /get /category:*\nwevtutil sl Security /ms:201326592\nGet-ItemProperty HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\PowerShell\\ScriptBlockLogging',
        refs: ['SYS.1.1.A10', 'SYS.1.2.3.A7', 'MSB-LOG-01', 'MSB-LOG-04'] },
      { t: { de: 'Telemetrie & Datenschutz', en: 'Telemetry & privacy' },
        d: 'Diagnosedaten minimieren (Stufe 0/Security nur bei Enterprise/Education/Server), Microsoft-Konten blockieren, Cloud-Synchronisation abschalten.',
        code: 'reg add HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection /v AllowTelemetry /t REG_DWORD /d 0 /f\nreg add HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System /v NoConnectedUser /t REG_DWORD /d 3 /f',
        refs: ['SYS.1.2.3.A3', 'SYS.2.2.3.A4', 'SYS.2.2.3.A6', 'SYS.2.2.3.A15'] },
      { t: { de: 'Verschlüsselung', en: 'Encryption' },
        d: 'Clients: BitLocker mit TPM+PIN; Server nach Schutzbedarf. Wiederherstellungsschlüssel im AD/Entra sichern.',
        code: 'manage-bde -status\nEnable-BitLocker -MountPoint "C:" -EncryptionMethod XtsAes256 -TpmAndPinProtector -Pin (Read-Host -AsSecureString)\nBackup-BitLockerKeyProtector -MountPoint "C:" -KeyProtectorId (Get-BitLockerVolume C:).KeyProtector[1].KeyProtectorId',
        refs: ['SYS.1.1.A34', 'SYS.2.1.A28', 'MSB-CRY-01'] },
      { t: { de: 'Audit mit HardeningKitty / Policy Analyzer', en: 'Audit with HardeningKitty / Policy Analyzer' },
        d: 'HardeningKitty (Open Source, MIT) prüft Einstellungen gegen Findinglists (u. a. Microsoft- und CIS-basiert) und erzeugt CSV – diese als „Befunde (generisch)“ importieren. Alternativ Policy Analyzer aus dem Security Compliance Toolkit.',
        code: 'Import-Module .\\HardeningKitty.psm1\nInvoke-HardeningKitty -Mode Audit -Log -Report -ReportFile .\\hk-$env:COMPUTERNAME.csv',
        refs: ['SYS.1.1.A24'] }
    ]
  },

  /* ================================================================ */
  {
    id: 'macos', os: ['macos'],
    title: { de: 'macOS härten', en: 'Hardening macOS' },
    intro: {
      de: 'Für Firmengeräte ist ein MDM die nachhaltigste Lösung (Profile werden erzwungen). Das macOS Security Compliance Project (mSCP) erzeugt Prüfskripte und Konfigurationsprofile je Baseline. Die Befehle unten sind für Einzelgeräte/Prüfungen.',
      en: 'For company devices an MDM is the most sustainable solution (enforced profiles). The macOS Security Compliance Project (mSCP) generates check scripts and configuration profiles per baseline. Commands below are for single devices/checks.'
    },
    steps: [
      { t: { de: 'Updates', en: 'Updates' }, d: 'Aktuelle macOS-Version und automatische Sicherheitsupdates.',
        code: 'softwareupdate -l\nsudo softwareupdate -ia\nsudo defaults write /Library/Preferences/com.apple.SoftwareUpdate CriticalUpdateInstall -bool true',
        refs: ['SYS.2.1.A3', 'system_settings_critical_update_install_enforce'] },
      { t: { de: 'Integrierte Schutzfunktionen', en: 'Built-in protections' }, d: 'SIP und Gatekeeper prüfen (SIP ist nur im Recovery-Modus änderbar).',
        code: 'csrutil status\nspctl --status\nsudo spctl --global-enable',
        refs: ['SYS.2.4.A2', 'os_sip_enable', 'os_gatekeeper_enable'] },
      { t: { de: 'Konten', en: 'Accounts' }, d: 'Standardkonto für die tägliche Arbeit, Gast aus, kein Auto-Login.',
        code: 'dscl . -read /Groups/admin GroupMembership\nsudo sysadminctl -guestAccount off\nsudo defaults delete /Library/Preferences/com.apple.loginwindow autoLoginUser 2>/dev/null',
        refs: ['SYS.2.4.A3', 'system_settings_guest_account_disable', 'system_settings_automatic_login_disable'] },
      { t: { de: 'FileVault', en: 'FileVault' }, d: 'Verschlüsselung aktivieren; Recovery-Key per MDM bzw. sicher in der Institution hinterlegen (nicht in iCloud).',
        code: 'fdesetup status\nsudo fdesetup enable', refs: ['SYS.2.4.A4', 'system_settings_filevault_enforce'] },
      { t: { de: 'Firewall', en: 'Firewall' }, d: 'Anwendungs-Firewall und Tarnmodus.',
        code: 'sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on\nsudo /usr/libexec/ApplicationFirewall/socketfilterfw --setstealthmode on',
        refs: ['SYS.2.4.A10', 'system_settings_firewall_enable'] },
      { t: { de: 'Freigabedienste deaktivieren', en: 'Disable sharing services' }, d: 'SSH, Bildschirmfreigabe, Dateifreigabe, AirDrop nur bei Bedarf.',
        code: 'sudo systemsetup -setremotelogin off\nsudo launchctl disable system/com.apple.screensharing\nsudo launchctl disable system/com.apple.smbd',
        refs: ['SYS.2.1.A16', 'system_settings_ssh_disable', 'system_settings_screen_sharing_disable'] },
      { t: { de: 'Prüfung mit mSCP', en: 'Audit with mSCP' }, d: 'Repository-Branch passend zur macOS-Version klonen, Baseline wählen und Compliance-Skript erzeugen. Das Skript prüft und kann (optional) korrigieren.',
        code: 'git clone -b <macos-version> https://github.com/usnistgov/macos_security.git\ncd macos_security && pip3 install -r requirements.txt\n./scripts/generate_guidance.py -s -p baselines/cis_lvl1.yaml\nsudo zsh build/cis_lvl1/cis_lvl1_compliance.sh',
        refs: ['SYS.1.1.A24'] },
      { t: { de: 'Lynis unter macOS', en: 'Lynis on macOS' }, d: 'Lynis läuft auch unter macOS (z. B. über Homebrew) und liefert eine report.dat zum Import.',
        code: 'brew install lynis\nsudo lynis audit system' }
    ]
  },

  /* ================================================================ */
  {
    id: 'scans', os: ['*'],
    title: { de: 'Scans & Nachweise (Nmap, Lynis, OpenVAS, OpenSCAP)', en: 'Scans & evidence (Nmap, Lynis, OpenVAS, OpenSCAP)' },
    intro: {
      de: 'Scans nur auf eigenen bzw. ausdrücklich freigegebenen Systemen durchführen (schriftliche Freigabe!). Die Webseite speichert pro Import den Zeitpunkt des Scans aus dem Bericht, den Dateinamen und die SHA-256-Prüfsumme als Nachweis.',
      en: 'Only scan your own or explicitly authorised systems (written approval!). For every import the page stores the scan time from the report, the file name and the SHA-256 checksum as evidence.'
    },
    steps: [
      { t: { de: 'Nmap (Ports & Dienste)', en: 'Nmap (ports & services)' }, d: 'XML-Ausgabe (-oX) oder grepbare Ausgabe (-oG) importieren. Jeder offene Port wird als Befund angelegt und kann als „erwartet“ (akzeptiert) oder „zu schließen“ bewertet werden.',
        code: 'sudo nmap -sS -sV -p- -T4 --reason -oX nmap-<host>-$(date +%F).xml <IP/Netz>' },
      { t: { de: 'Lynis', en: 'Lynis' }, d: 'Die Datei /var/log/lynis-report.dat importieren: Hardening-Index, Warnungen und Vorschläge werden übernommen; Vorschläge lassen sich als eigene Maßnahmen in die Checkliste übernehmen.',
        code: 'sudo lynis audit system --quiet\nsudo cat /var/log/lynis-report.dat > lynis-$(hostname).dat' },
      { t: { de: 'OpenVAS / Greenbone Community Edition', en: 'OpenVAS / Greenbone Community Edition' }, d: 'Möglichst authentifizierten Scan durchführen. Bericht unter „Scans › Berichte“ als XML (Report-Format „XML“) oder CSV-Ergebnisse herunterladen und importieren. Für jeden Befund Status (offen / teilweise / behoben / akzeptiert / Fehlalarm) und Begründung pflegen.',
        code: '# Greenbone Web-UI: Scans > Reports > Report öffnen > Download > Format "XML" oder "CSV Results"\n# Kommandozeile (python-gvm, optional):\ngvm-cli --gmp-username admin socket --xml "<get_reports report_id=\'<ID>\' details=\'1\'/>" > openvas-report.xml' },
      { t: { de: 'OpenSCAP', en: 'OpenSCAP' }, d: 'Ergebnisdatei (--results, XCCDF) oder ARF (--results-arf) importieren. Bestandene/fehlgeschlagene Regeln setzen den Status in der Checkliste; unbekannte Regeln werden als Befunde gelistet.',
        code: 'sudo oscap xccdf eval --profile <PROFIL> --results results.xml --report report.html <DATASTREAM>' },
      { t: { de: 'Wiederholung & Aufbewahrung', en: 'Repetition & retention' }, d: 'Empfehlung: Schwachstellenscan mindestens monatlich und nach jeder größeren Änderung; Konfigurationsscan nach Härtung und quartalsweise. Originalberichte revisionssicher archivieren – in der Webseite ist der Hash zur späteren Echtheitsprüfung hinterlegt.' }
    ]
  }
];

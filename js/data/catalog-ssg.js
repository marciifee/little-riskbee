/* =====================================================================
 * catalog-ssg.js – OpenSCAP / SCAP Security Guide (ComplianceAsCode)
 * ---------------------------------------------------------------------
 * Kuratierter Auszug häufig genutzter SSG-Regeln für Linux. "ref" ist
 * die echte SSG-Regel-ID (Kurzform). In XCCDF-Dateien lautet sie
 *   xccdf_org.ssgproject.content_rule_<ref>
 * Wird ein OpenSCAP-Ergebnis (oscap xccdf eval --results …) importiert,
 * setzt die Webseite den Status dieser Regeln automatisch.
 *
 *  - level:   B/S/H – sinngemäße Zuordnung zum BSI-Niveau (B ≈ Basis,
 *             S ≈ CIS Level 1 / Standard, H ≈ CIS Level 2 / STIG)
 *  - distros: Einschränkung auf bestimmte Distributionen (sonst alle)
 *  - bsi:     Zuordnung laut ComplianceAsCode-Kontrolldatei für BSI
 *             SYS.1.1 / SYS.1.3 (RHEL 9) – nur belegte Zuordnungen
 *  - check:   lesender Prüfbefehl, fix: Hinweis zur Umsetzung
 *
 * Vollständige Profile (CIS, STIG, ANSSI, BSI …) bitte als Datastream
 * importieren: ssg-<produkt>-ds.xml aus dem SSG-Release-ZIP.
 * ===================================================================== */
window.HA = window.HA || {};

(function () {
  'use strict';
  var items = [];
  var RH = ['rhel', 'fedora'], DEB = ['debian', 'ubuntu'];

  /** Kompaktes Anlegen einer SSG-Regel (Parameterbeschreibung siehe Kopf). */
  function S(ref, level, topic, distros, de, en, desc, check, fix, bsi) {
    items.push({
      lib: 'ssg', ref: ref, group: 'SSG / ' + topic, level: level, os: ['linux'], role: 'any',
      distros: distros || null, topic: topic, title: { de: de, en: en }, desc: { de: desc },
      check: check ? { linux: check } : null, fix: fix || '', bsi: bsi || []
    });
  }

  /* ---------------- Konten & Authentisierung ---------------- */
  S('no_empty_passwords', 'B', 'accounts', null, 'Keine leeren Passwörter zulassen', 'Prevent login to accounts with empty password',
    'PAM darf keine Anmeldung mit leerem Passwort erlauben (Option „nullok“ entfernen).',
    'grep -R "nullok" /etc/pam.d/ ; sudo awk -F: \'($2==""){print $1}\' /etc/shadow', 'nullok aus /etc/pam.d/* entfernen (authselect/pam-auth-update).');
  S('accounts_no_uid_except_zero', 'B', 'accounts', null, 'Nur root besitzt UID 0', 'Verify only root has UID 0',
    'Außer root darf kein Konto die UID 0 haben.', 'awk -F: \'($3==0){print $1}\' /etc/passwd');
  S('account_unique_id', 'B', 'accounts', null, 'Eindeutige Benutzer-IDs', 'Ensure all accounts have unique UIDs',
    'Jede UID darf nur einmal vorkommen.', 'cut -d: -f3 /etc/passwd | sort | uniq -d', '', ['SYS.1.3.A2']);
  S('group_unique_id', 'S', 'accounts', null, 'Eindeutige Gruppen-IDs', 'Ensure all groups have unique GIDs',
    'Jede GID darf nur einmal vorkommen.', 'cut -d: -f3 /etc/group | sort | uniq -d', '', ['SYS.1.3.A2']);
  S('accounts_password_pam_minlen', 'S', 'accounts', null, 'Mindestlänge für Passwörter (pwquality)', 'Ensure PAM enforces password minimum length',
    'minlen in /etc/security/pwquality.conf auf mind. 12–14 Zeichen setzen.', 'grep -E "^\\s*minlen" /etc/security/pwquality.conf', 'minlen = 14');
  S('accounts_passwords_pam_faillock_deny', 'S', 'accounts', null, 'Konto nach Fehlversuchen sperren (faillock)', 'Lock accounts after failed password attempts',
    'Nach wenigen (z. B. 5) Fehlversuchen temporär sperren.', 'grep -E "^\\s*deny" /etc/security/faillock.conf', 'deny = 5, unlock_time = 900');
  S('accounts_maximum_age_login_defs', 'S', 'accounts', null, 'Maximales Passwortalter festlegen', 'Set password maximum age',
    'PASS_MAX_DAYS gemäß Passwort-Richtlinie setzen (bei Schlüssel/MFA ggf. entbehrlich – begründen).', 'grep ^PASS_MAX_DAYS /etc/login.defs');
  S('accounts_tmout', 'S', 'accounts', null, 'Timeout für inaktive Shell-Sitzungen', 'Set interactive session timeout',
    'TMOUT (z. B. 900 s) systemweit setzen.', 'grep -R "TMOUT" /etc/profile /etc/profile.d/ 2>/dev/null', 'echo "readonly TMOUT=900; export TMOUT" > /etc/profile.d/tmout.sh');
  S('accounts_umask_etc_login_defs', 'S', 'privilege', null, 'Restriktive Standard-umask', 'Ensure default umask is restrictive',
    'UMASK 027 (oder 077) in /etc/login.defs.', 'grep ^UMASK /etc/login.defs');
  S('sudo_require_authentication', 'B', 'accounts', null, 'sudo verlangt Authentisierung', 'Ensure sudo requires authentication',
    'Kein NOPASSWD bzw. !authenticate in sudoers.', 'sudo grep -R -E "NOPASSWD|!authenticate" /etc/sudoers /etc/sudoers.d/');
  S('sudo_add_use_pty', 'S', 'accounts', null, 'sudo nur mit Pseudo-Terminal', 'Ensure sudo uses pty',
    'Defaults use_pty in sudoers.', 'sudo grep -R "use_pty" /etc/sudoers /etc/sudoers.d/');
  S('sudo_custom_logfile', 'S', 'logging', null, 'Eigene sudo-Protokolldatei', 'Ensure sudo log file exists',
    'Defaults logfile=/var/log/sudo.log für nachvollziehbare Administration.', 'sudo grep -R "logfile" /etc/sudoers /etc/sudoers.d/');

  /* ---------------- Fernzugriff (SSH) ---------------- */
  S('sshd_disable_root_login', 'B', 'remote', null, 'SSH: root-Anmeldung verbieten', 'Disable SSH root login',
    'PermitRootLogin no (Administration über persönliche Konten + sudo).', 'sudo sshd -T | grep permitrootlogin', 'PermitRootLogin no');
  S('sshd_disable_empty_passwords', 'B', 'remote', null, 'SSH: leere Passwörter verbieten', 'Disable SSH access via empty passwords',
    'PermitEmptyPasswords no.', 'sudo sshd -T | grep permitemptypasswords', 'PermitEmptyPasswords no', ['SYS.1.3.A8']);
  S('sshd_enable_pubkey_auth', 'S', 'remote', null, 'SSH: Public-Key-Authentisierung', 'Enable public key authentication',
    'PubkeyAuthentication yes; Passwort-Login möglichst deaktivieren.', 'sudo sshd -T | grep -E "pubkeyauthentication|passwordauthentication"', 'PubkeyAuthentication yes / PasswordAuthentication no', ['SYS.1.3.A8']);
  S('sshd_set_max_auth_tries', 'S', 'remote', null, 'SSH: Anmeldeversuche begrenzen', 'Set SSH MaxAuthTries',
    'MaxAuthTries 4 oder weniger.', 'sudo sshd -T | grep maxauthtries', 'MaxAuthTries 4');
  S('sshd_disable_x11_forwarding', 'S', 'remote', null, 'SSH: X11-Forwarding deaktivieren', 'Disable X11 forwarding',
    'X11Forwarding no, sofern nicht benötigt.', 'sudo sshd -T | grep x11forwarding', 'X11Forwarding no');
  S('sshd_set_idle_timeout', 'S', 'remote', null, 'SSH: Leerlauf-Timeout', 'Set SSH client alive interval',
    'ClientAliveInterval/ClientAliveCountMax setzen, um verwaiste Sitzungen zu beenden.', 'sudo sshd -T | grep -E "clientalive"', 'ClientAliveInterval 300 / ClientAliveCountMax 0');
  S('sshd_set_loglevel_info', 'S', 'logging', null, 'SSH: LogLevel INFO (oder VERBOSE)', 'Set SSH LogLevel to INFO',
    'Anmeldungen und Schlüssel-Fingerprints protokollieren.', 'sudo sshd -T | grep loglevel', 'LogLevel VERBOSE');
  S('package_telnet-server_removed', 'B', 'remote', null, 'telnet-Server entfernen', 'Uninstall telnet-server',
    'Unverschlüsselte Fernzugänge entfernen.', 'dpkg -l telnetd 2>/dev/null | grep ^ii; rpm -q telnet-server 2>/dev/null', '', ['SYS.1.3.A8']);
  S('package_telnet_removed', 'S', 'remote', null, 'telnet-Client entfernen', 'Remove telnet clients',
    'Telnet-Client nicht installieren.', 'command -v telnet', '', ['SYS.1.3.A8']);
  S('package_rsh-server_removed', 'B', 'services', null, 'rsh-Server entfernen', 'Uninstall rsh-server',
    'r-Dienste (rsh, rlogin) sind unsicher und zu entfernen.', 'dpkg -l rsh-server 2>/dev/null | grep ^ii; rpm -q rsh-server 2>/dev/null');

  /* ---------------- Updates ---------------- */
  S('security_patches_up_to_date', 'B', 'patch', null, 'Sicherheitsupdates eingespielt', 'Ensure software patches installed',
    'Alle verfügbaren Sicherheitsupdates installieren; Prozess für regelmäßige Updates etablieren.',
    'apt list --upgradable 2>/dev/null | head; dnf check-update --security 2>/dev/null | head',
    'Debian/Ubuntu: unattended-upgrades; Fedora/RHEL: dnf-automatic (upgrade_type = security)');
  S('ensure_gpgcheck_globally_activated', 'B', 'patch', RH, 'Paketsignaturen prüfen (gpgcheck)', 'Ensure gpgcheck enabled globally',
    'gpgcheck=1 in /etc/dnf/dnf.conf.', 'grep gpgcheck /etc/dnf/dnf.conf');

  /* ---------------- Firewall & Netzwerk ---------------- */
  S('package_firewalld_installed', 'B', 'network', RH, 'firewalld installiert', 'Install firewalld',
    'Lokalen Paketfilter installieren.', 'rpm -q firewalld', '', ['SYS.1.1.A19']);
  S('service_firewalld_enabled', 'B', 'network', RH, 'firewalld aktiviert', 'Verify firewalld enabled',
    'Paketfilter beim Systemstart aktivieren.', 'systemctl is-enabled firewalld; sudo firewall-cmd --list-all', '', ['SYS.1.1.A19']);
  S('package_nftables_installed', 'B', 'network', DEB, 'nftables installiert (bzw. ufw)', 'Install nftables',
    'Lokalen Paketfilter installieren und Default-Deny für eingehenden Verkehr setzen.', 'sudo nft list ruleset | head -40; sudo ufw status verbose 2>/dev/null', 'apt install nftables && systemctl enable --now nftables (oder ufw default deny incoming)');
  S('sysctl_net_ipv4_ip_forward', 'S', 'network', null, 'IP-Forwarding deaktivieren', 'Disable kernel IPv4 forwarding',
    'net.ipv4.ip_forward = 0, sofern das System kein Router ist.', 'sysctl net.ipv4.ip_forward');
  S('sysctl_net_ipv4_conf_all_accept_redirects', 'S', 'network', null, 'ICMP-Redirects nicht annehmen', 'Disable accepting ICMP redirects',
    'net.ipv4.conf.all.accept_redirects = 0.', 'sysctl net.ipv4.conf.all.accept_redirects');
  S('sysctl_net_ipv4_conf_all_send_redirects', 'S', 'network', null, 'Keine ICMP-Redirects senden', 'Disable sending ICMP redirects',
    'net.ipv4.conf.all.send_redirects = 0.', 'sysctl net.ipv4.conf.all.send_redirects');
  S('sysctl_net_ipv4_conf_all_accept_source_route', 'S', 'network', null, 'Source-Routing ablehnen', 'Disable source-routed packets',
    'net.ipv4.conf.all.accept_source_route = 0.', 'sysctl net.ipv4.conf.all.accept_source_route');
  S('sysctl_net_ipv4_tcp_syncookies', 'S', 'network', null, 'TCP-SYN-Cookies aktivieren', 'Enable TCP SYN cookies',
    'Schutz vor SYN-Flood: net.ipv4.tcp_syncookies = 1.', 'sysctl net.ipv4.tcp_syncookies');
  S('sysctl_net_ipv4_conf_all_rp_filter', 'S', 'network', null, 'Reverse-Path-Filter', 'Enable reverse path filtering',
    'Gefälschte Absenderadressen verwerfen: rp_filter = 1.', 'sysctl net.ipv4.conf.all.rp_filter');
  S('sysctl_net_ipv6_conf_all_accept_ra', 'H', 'network', null, 'IPv6 Router Advertisements ignorieren', 'Disable accepting IPv6 router advertisements',
    'Auf Servern mit statischer Konfiguration RAs ablehnen.', 'sysctl net.ipv6.conf.all.accept_ra');

  /* ---------------- Dienste & Module minimieren ---------------- */
  S('service_autofs_disabled', 'S', 'media', null, 'autofs deaktivieren', 'Disable autofs',
    'Kein automatisches Einbinden von Datenträgern.', 'systemctl is-enabled autofs 2>/dev/null', '', ['SYS.1.3.A3', 'SYS.1.1.A5']);
  S('kernel_module_usb-storage_disabled', 'S', 'media', null, 'USB-Massenspeicher-Modul sperren', 'Disable usb-storage kernel module',
    'usb-storage über modprobe.d blockieren (falls kein USB-Speicher benötigt).', 'modprobe -n -v usb-storage', 'echo "install usb-storage /bin/false" > /etc/modprobe.d/usb-storage.conf', ['SYS.1.3.A3', 'SYS.1.1.A5']);
  S('kernel_module_bluetooth_disabled', 'S', 'services', null, 'Bluetooth-Modul sperren', 'Disable Bluetooth kernel module',
    'Bluetooth auf Servern deaktivieren.', 'lsmod | grep bluetooth', '', ['SYS.1.1.A6']);
  S('kernel_module_cramfs_disabled', 'S', 'services', null, 'Ungenutzte Dateisysteme sperren (cramfs u. a.)', 'Disable mounting of cramfs',
    'Seltene Dateisystem-Module (cramfs, freevxfs, hfs, squashfs, udf …) blockieren, sofern ungenutzt.', 'modprobe -n -v cramfs');
  S('service_avahi-daemon_disabled', 'S', 'services', null, 'Avahi (mDNS) deaktivieren', 'Disable Avahi server',
    'Zeroconf-Dienst auf Servern deaktivieren.', 'systemctl is-enabled avahi-daemon 2>/dev/null');
  S('service_cups_disabled', 'S', 'services', null, 'Druckdienst CUPS deaktivieren', 'Disable CUPS service',
    'CUPS deaktivieren, wenn nicht gedruckt wird.', 'systemctl is-enabled cups 2>/dev/null');
  S('package_xinetd_removed', 'S', 'services', null, 'xinetd entfernen', 'Uninstall xinetd',
    'Super-Server xinetd entfernen, sofern nicht benötigt.', 'command -v xinetd');
  S('disable_ctrlaltdel_reboot', 'S', 'availability', null, 'Strg+Alt+Entf-Neustart deaktivieren', 'Disable Ctrl-Alt-Del reboot',
    'ctrl-alt-del.target maskieren.', 'systemctl is-enabled ctrl-alt-del.target 2>/dev/null', 'systemctl mask ctrl-alt-del.target');

  /* ---------------- Protokollierung & Audit ---------------- */
  S('package_audit_installed', 'B', 'logging', null, 'auditd installiert', 'Ensure audit is installed',
    'Linux-Audit-Framework installieren (Paket audit bzw. auditd).', 'command -v auditctl');
  S('service_auditd_enabled', 'B', 'logging', null, 'auditd aktiviert', 'Enable auditd service',
    'Audit-Daemon beim Start aktivieren.', 'systemctl is-active auditd');
  S('audit_rules_usergroup_modification_passwd', 'S', 'logging', null, 'Audit: Änderungen an /etc/passwd', 'Record events modifying /etc/passwd',
    'Änderungen an Konten (passwd, shadow, group, gshadow, opasswd) protokollieren.', 'sudo auditctl -l | grep -E "/etc/(passwd|shadow|group)"', '-w /etc/passwd -p wa -k identity', ['SYS.1.3.A6']);
  S('audit_rules_dac_modification_chmod', 'S', 'logging', null, 'Audit: Rechteänderungen (chmod/chown)', 'Record DAC modification events',
    'Systemaufrufe zur Änderung von Dateirechten protokollieren.', 'sudo auditctl -l | grep -E "chmod|chown"', '', ['SYS.1.1.A10']);
  S('audit_rules_login_events', 'S', 'logging', null, 'Audit: Anmeldeereignisse', 'Record login events',
    'Anmelde-/Abmeldeereignisse (lastlog, faillock) protokollieren.', 'sudo auditctl -l | grep -E "lastlog|faillock"');
  S('auditd_data_retention_max_log_file_action', 'S', 'logging', null, 'Audit-Logs rotieren statt verwerfen', 'Configure auditd max_log_file_action',
    'max_log_file_action = keep_logs bzw. rotate gemäß Aufbewahrungskonzept.', 'grep max_log_file_action /etc/audit/auditd.conf');
  S('audit_rules_immutable', 'H', 'logging', null, 'Audit-Regeln unveränderlich (-e 2)', 'Make audit configuration immutable',
    'Audit-Konfiguration bis zum Neustart sperren.', 'sudo auditctl -s | grep enabled');
  S('package_rsyslog_installed', 'S', 'logging', null, 'rsyslog installiert', 'Ensure rsyslog is installed',
    'Syslog-Dienst für persistente/zentrale Protokolle (alternativ journald mit Weiterleitung).', 'command -v rsyslogd');
  S('service_rsyslog_enabled', 'S', 'logging', null, 'rsyslog aktiviert / Weiterleitung an zentralen Log-Server', 'Enable rsyslog service',
    'Protokolle zentral sammeln (SIEM/Log-Server).', 'systemctl is-active rsyslog; grep -R "@" /etc/rsyslog.conf /etc/rsyslog.d/ 2>/dev/null');
  S('service_chronyd_enabled', 'S', 'logging', null, 'Zeitsynchronisation (chrony)', 'Enable chronyd service',
    'Exakte Zeit für korrelierbare Logs; vertrauenswürdige NTP-Server konfigurieren.', 'chronyc tracking 2>/dev/null || timedatectl show-timesync --all');

  /* ---------------- Exploit- & Kernelschutz ---------------- */
  S('sysctl_kernel_randomize_va_space', 'B', 'exploit', null, 'ASLR vollständig aktiv', 'Enable randomized layout of virtual address space',
    'kernel.randomize_va_space = 2.', 'sysctl kernel.randomize_va_space');
  S('sysctl_kernel_kptr_restrict', 'S', 'exploit', null, 'Kernel-Pointer verbergen', 'Restrict exposed kernel pointer addresses',
    'kernel.kptr_restrict = 1 (oder 2).', 'sysctl kernel.kptr_restrict');
  S('sysctl_kernel_dmesg_restrict', 'S', 'exploit', null, 'dmesg nur für Privilegierte', 'Restrict access to kernel message buffer',
    'kernel.dmesg_restrict = 1.', 'sysctl kernel.dmesg_restrict');
  S('sysctl_fs_protected_symlinks', 'S', 'exploit', null, 'Geschützte Symlinks', 'Enable kernel protected symlinks',
    'fs.protected_symlinks = 1 (und protected_hardlinks = 1).', 'sysctl fs.protected_symlinks fs.protected_hardlinks');
  S('sysctl_fs_suid_dumpable', 'S', 'exploit', null, 'Keine Core-Dumps von SUID-Programmen', 'Disable core dumps for SUID programs',
    'fs.suid_dumpable = 0.', 'sysctl fs.suid_dumpable');
  S('coredump_disable_storage', 'S', 'exploit', null, 'Speicherung von Core-Dumps deaktivieren', 'Disable storing core dumps',
    'Storage=none in /etc/systemd/coredump.conf.', 'grep -E "^Storage" /etc/systemd/coredump.conf');
  S('sysctl_kernel_yama_ptrace_scope', 'H', 'exploit', null, 'ptrace einschränken (Yama)', 'Restrict usage of ptrace',
    'kernel.yama.ptrace_scope = 1 oder höher.', 'sysctl kernel.yama.ptrace_scope');
  S('sysctl_kernel_unprivileged_bpf_disabled', 'H', 'exploit', null, 'Unprivilegiertes eBPF deaktivieren', 'Disable unprivileged BPF',
    'kernel.unprivileged_bpf_disabled = 1.', 'sysctl kernel.unprivileged_bpf_disabled');
  S('selinux_state', 'S', 'exploit', RH, 'SELinux im Modus Enforcing', 'Ensure SELinux state is enforcing',
    'SELinux aktiv und erzwingend.', 'getenforce', 'SELINUX=enforcing in /etc/selinux/config', ['SYS.1.3.A10', 'SYS.1.1.A37']);
  S('selinux_policytype', 'S', 'exploit', RH, 'SELinux-Richtlinie „targeted“', 'Configure SELinux policy',
    'SELINUXTYPE=targeted.', 'sestatus | grep -i policy', '', ['SYS.1.3.A10', 'SYS.1.1.A37']);
  S('package_apparmor_installed', 'S', 'exploit', DEB, 'AppArmor installiert und aktiv', 'Ensure AppArmor is installed',
    'AppArmor-Profile für exponierte Dienste laden.', 'sudo aa-status | head -5');
  S('all_apparmor_profiles_enforced', 'H', 'exploit', DEB, 'Alle AppArmor-Profile im Enforce-Modus', 'Enforce all AppArmor profiles',
    'Keine Profile im complain-Modus belassen.', 'sudo aa-status | grep -A1 "complain mode"');
  S('fapolicy_default_deny', 'H', 'exploit', RH, 'fapolicyd: Default-Deny (Allowlisting)', 'Configure fapolicyd to deny by default',
    'Ausführungskontrolle mit fapolicyd.', 'systemctl is-active fapolicyd', '', ['SYS.1.1.A31']);

  /* ---------------- Dateisystem & Rechte ---------------- */
  S('partition_for_tmp', 'S', 'availability', null, 'Eigene Partition für /tmp', 'Ensure /tmp located on separate partition',
    '/tmp separat (oder tmpfs) einbinden.', 'findmnt /tmp');
  S('partition_for_var_log', 'S', 'availability', null, 'Eigene Partition für /var/log', 'Ensure /var/log located on separate partition',
    'Volllaufende Logs dürfen das System nicht stoppen.', 'findmnt /var/log');
  S('partition_for_var_log_audit', 'H', 'availability', null, 'Eigene Partition für /var/log/audit', 'Ensure /var/log/audit on separate partition',
    'Audit-Logs separat speichern.', 'findmnt /var/log/audit');
  S('partition_for_home', 'S', 'availability', null, 'Eigene Partition für /home', 'Ensure /home located on separate partition',
    '/home separat einbinden (nosuid,nodev).', 'findmnt /home', '', ['SYS.1.1.A6']);
  S('mount_option_tmp_noexec', 'S', 'exploit', null, '/tmp mit noexec,nosuid,nodev', 'Add noexec,nosuid,nodev to /tmp',
    'Keine Programmausführung aus /tmp.', 'findmnt -no OPTIONS /tmp');
  S('mount_option_dev_shm_noexec', 'S', 'exploit', null, '/dev/shm mit noexec,nosuid,nodev', 'Add noexec to /dev/shm',
    'Shared Memory nicht ausführbar einbinden.', 'findmnt -no OPTIONS /dev/shm');
  S('file_permissions_etc_shadow', 'B', 'privilege', null, 'Rechte von /etc/shadow', 'Verify permissions on /etc/shadow',
    '/etc/shadow: 0000 bzw. 0640 root:shadow.', 'stat -c "%a %U:%G" /etc/shadow', '', ['SYS.1.3.A14']);
  S('file_permissions_etc_passwd', 'B', 'privilege', null, 'Rechte von /etc/passwd', 'Verify permissions on /etc/passwd',
    '/etc/passwd: 0644 root:root.', 'stat -c "%a %U:%G" /etc/passwd', '', ['SYS.1.3.A14']);
  S('file_permissions_sshd_config', 'S', 'privilege', null, 'Rechte von sshd_config', 'Verify permissions on SSH server config',
    '/etc/ssh/sshd_config: 0600 root:root.', 'stat -c "%a %U:%G" /etc/ssh/sshd_config', '', ['SYS.1.3.A14']);
  S('file_permissions_unauthorized_world_writable', 'S', 'privilege', null, 'Keine weltbeschreibbaren Dateien', 'Ensure no world-writable files exist',
    'Weltbeschreibbare Dateien finden und korrigieren.', 'sudo find / -xdev -type f -perm -0002 2>/dev/null | head', '', ['SYS.1.3.A14']);
  S('dir_perms_world_writable_sticky_bits', 'S', 'privilege', null, 'Sticky-Bit auf weltbeschreibbaren Verzeichnissen', 'Verify sticky bit on world-writable dirs',
    'Weltbeschreibbare Verzeichnisse benötigen das Sticky-Bit.', 'sudo find / -xdev -type d -perm -0002 ! -perm -1000 2>/dev/null');
  S('file_permissions_unauthorized_suid', 'H', 'privilege', null, 'SUID-Programme prüfen', 'Ensure all SUID executables are authorized',
    'SUID/SGID-Dateien inventarisieren und unnötige entfernen.', 'sudo find / -xdev -perm -4000 -type f 2>/dev/null', '', ['SYS.1.3.A14']);
  S('file_permissions_var_log_audit', 'S', 'privilege', null, 'Rechte der Audit-Logs', 'Verify permissions on audit logs',
    'Audit-Logs nur für root lesbar (0600).', 'sudo ls -l /var/log/audit/', '', ['SYS.1.3.A14']);

  /* ---------------- Integrität ---------------- */
  S('package_aide_installed', 'S', 'integrity', null, 'AIDE installiert', 'Install AIDE',
    'Dateiintegritätsprüfung (Host-based IDS) installieren.', 'command -v aide', 'apt/dnf install aide', ['SYS.1.1.A27']);
  S('aide_build_database', 'S', 'integrity', null, 'AIDE-Datenbank initialisiert', 'Build and test AIDE database',
    'Referenzdatenbank nach Härtung erstellen.', 'ls -l /var/lib/aide/', 'aideinit (Debian) bzw. aide --init', ['SYS.1.1.A27']);
  S('aide_periodic_cron_checking', 'H', 'integrity', null, 'AIDE regelmäßig prüfen', 'Configure periodic execution of AIDE',
    'Tägliche Prüfung per Timer/Cron mit Benachrichtigung.', 'systemctl list-timers | grep -i aide; grep -R aide /etc/cron* 2>/dev/null', '', ['SYS.1.1.A27']);
  S('rpm_verify_hashes', 'H', 'integrity', RH, 'Paket-Hashes verifizieren', 'Verify file hashes with RPM',
    'Installierte Dateien gegen RPM-Datenbank prüfen.', 'rpm -Va --nomtime --nosize --nomode --nouser --nogroup | grep "^..5" | head', '', ['SYS.1.1.A27']);

  /* ---------------- Boot ---------------- */
  S('grub2_password', 'S', 'boot', null, 'GRUB2-Bootloader-Passwort', 'Set boot loader password',
    'Änderungen an Bootparametern nur mit Passwort.', 'sudo grep -E "password_pbkdf2|superusers" /boot/grub*/grub.cfg /boot/grub*/user.cfg 2>/dev/null');
  S('file_permissions_grub2_cfg', 'S', 'boot', null, 'Rechte der GRUB2-Konfiguration', 'Verify /boot/grub2/grub.cfg permissions',
    'grub.cfg nur für root lesbar.', 'stat -c "%a %U" /boot/grub*/grub.cfg', '', ['SYS.1.3.A14']);

  /* ---------------- Kryptografie ---------------- */
  S('configure_crypto_policy', 'S', 'crypto', RH, 'Systemweite Krypto-Richtlinie', 'Configure system crypto policy',
    'update-crypto-policies auf DEFAULT oder FUTURE (keine LEGACY).', 'update-crypto-policies --show');
  S('encrypt_partitions', 'H', 'crypto', null, 'Datenträgerverschlüsselung (LUKS)', 'Encrypt partitions',
    'Partitionen mit LUKS2 verschlüsseln (Schlüsselmanagement beachten).', 'lsblk -o NAME,FSTYPE | grep crypto_LUKS', '', ['SYS.1.1.A34']);

  /* ---------------- Sonstiges ---------------- */
  S('banner_etc_issue', 'S', 'planning', null, 'Anmeldebanner mit Nutzungshinweis', 'Modify the system login banner',
    'Rechtlicher Hinweis in /etc/issue (ohne Versionsinformationen).', 'cat /etc/issue');

  HA.CATALOG_SSG = items;
})();

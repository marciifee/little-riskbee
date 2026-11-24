/* =====================================================================
 * catalog-extra.js – Weitere Bibliotheken
 *   1) Microsoft Security Baseline (Windows Server / Windows 11)
 *   2) macOS Security Compliance Project (mSCP, NIST)
 *   3) Leerer Katalog "Eigene Maßnahmen" (wird zur Laufzeit befüllt)
 * ---------------------------------------------------------------------
 * Microsoft: Die Referenzen (MSB-…) sind interne Kurz-IDs dieser
 * Webseite; der GPO-Pfad steht in der Beschreibung. Maßgeblich ist die
 * jeweils aktuelle Baseline aus dem Security Compliance Toolkit.
 * mSCP: "ref" entspricht der Regel-ID im mSCP-Repository; Namen können
 * je nach macOS-Version (Sonoma/Sequoia/Tahoe …) leicht abweichen.
 * ===================================================================== */
window.HA = window.HA || {};

(function () {
  'use strict';

  /* ------------------------------------------------------------------
   * Microsoft Security Baseline
   * ---------------------------------------------------------------- */
  var ms = [];
  /** M(ref, level, role, topic, de, en, desc, check, bsi) */
  function M(ref, level, role, topic, de, en, desc, check, bsi) {
    ms.push({ lib: 'msbaseline', ref: ref, group: 'MS Baseline / ' + topic, level: level, os: ['windows'], role: role,
      topic: topic, title: { de: de, en: en }, desc: { de: desc }, check: check ? { windows: check } : null, bsi: bsi || [] });
  }
  M('MSB-ACC-01', 'B', 'any', 'accounts', 'Kontosperrung nach Fehlversuchen', 'Account lockout threshold',
    'Computerkonfiguration › Windows-Einstellungen › Sicherheitseinstellungen › Kontorichtlinien › Kontosperrungsrichtlinien: Schwelle ≤ 10, Dauer ≥ 15 min.', 'net accounts');
  M('MSB-ACC-02', 'B', 'any', 'accounts', 'Mindestlänge des Kennworts 14 Zeichen', 'Minimum password length 14',
    'Kennwortrichtlinien › Minimale Kennwortlänge = 14 (bzw. Domänen-/Fine-Grained-Richtlinie).', 'net accounts');
  M('MSB-ACC-03', 'S', 'any', 'accounts', 'Windows LAPS für lokale Administratorkonten', 'Windows LAPS for local admin accounts',
    'Lokale Admin-Kennwörter automatisch, eindeutig und rotierend über Windows LAPS verwalten (in Windows/Server 2019+ integriert).', 'Get-LapsDiagnostics  # bzw. Get-LapsADPassword -Identity <PC>');
  M('MSB-AUTH-01', 'B', 'any', 'accounts', 'LAN-Manager-Authentifizierung: nur NTLMv2', 'LAN Manager auth level: NTLMv2 only',
    'Sicherheitsoptionen › Netzwerksicherheit: LAN Manager-Authentifizierungsebene = „Nur NTLMv2-Antworten senden. LM & NTLM verweigern“ (LmCompatibilityLevel = 5).',
    'Get-ItemProperty HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa -Name LmCompatibilityLevel', ['SYS.2.2.3.A9']);
  M('MSB-AUTH-02', 'B', 'any', 'accounts', 'Keine LM-Hashes speichern', 'Do not store LAN Manager hash',
    'NoLMHash = 1.', 'Get-ItemProperty HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa -Name NoLMHash');
  M('MSB-AUTH-03', 'S', 'any', 'accounts', 'LSA-Schutz (RunAsPPL)', 'LSA protection (RunAsPPL)',
    'LSASS als geschützten Prozess ausführen, um Credential-Dumping zu erschweren.', 'Get-ItemProperty HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa -Name RunAsPPL', ['SYS.2.2.3.A23']);
  M('MSB-AUTH-04', 'S', 'any', 'accounts', 'WDigest-Klartextanmeldedaten deaktiviert', 'WDigest authentication disabled',
    'UseLogonCredential = 0 (MS Security Guide).', 'Get-ItemProperty HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SecurityProviders\\WDigest -Name UseLogonCredential');
  M('MSB-AUTH-05', 'H', 'any', 'exploit', 'Credential Guard / virtualisierungsbasierte Sicherheit', 'Credential Guard / VBS',
    'Device Guard › Virtualisierungsbasierte Sicherheit aktivieren mit Credential Guard (UEFI-Sperre).',
    '(Get-CimInstance -Namespace root\\Microsoft\\Windows\\DeviceGuard -ClassName Win32_DeviceGuard).SecurityServicesRunning', ['SYS.1.2.3.A8', 'SYS.2.2.3.A26']);
  M('MSB-AUTH-06', 'H', 'server', 'crypto', 'Kerberos nur mit AES', 'Kerberos AES encryption types only',
    'Netzwerksicherheit: Für Kerberos zulässige Verschlüsselungstypen = AES128/AES256 (RC4/DES deaktivieren), vorher Kompatibilität prüfen.', 'Get-ItemProperty HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System\\Kerberos\\Parameters -Name SupportedEncryptionTypes');
  M('MSB-NET-01', 'B', 'any', 'network', 'SMBv1 deaktiviert', 'SMBv1 disabled',
    'SMB 1.0/CIFS entfernen (Server und Client).', 'Get-SmbServerConfiguration | Select EnableSMB1Protocol; Get-WindowsOptionalFeature -Online -FeatureName SMB1Protocol');
  M('MSB-NET-02', 'S', 'any', 'network', 'SMB-Signierung erzwingen', 'Require SMB signing',
    'Microsoft-Netzwerk (Server/Client): Kommunikation digital signieren (immer) = Aktiviert.', 'Get-SmbServerConfiguration | Select RequireSecuritySignature; Get-SmbClientConfiguration | Select RequireSecuritySignature');
  M('MSB-NET-03', 'S', 'any', 'network', 'LLMNR deaktivieren', 'Turn off multicast name resolution (LLMNR)',
    'Netzwerk › DNS-Client › Multicastnamensauflösung deaktivieren = Aktiviert.', 'Get-ItemProperty "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\DNSClient" -Name EnableMulticast');
  M('MSB-NET-04', 'B', 'any', 'network', 'Windows-Firewall in allen Profilen aktiv', 'Windows Firewall on for all profiles',
    'Domäne/Privat/Öffentlich: Firewall ein, eingehend standardmäßig blockieren, Protokollierung verworfener Pakete.', 'Get-NetFirewallProfile | Select Name,Enabled,DefaultInboundAction,LogBlocked', ['SYS.1.1.A19']);
  M('MSB-NET-05', 'S', 'any', 'privilege', 'Anonyme Aufzählung von SAM-Konten/Freigaben verbieten', 'Restrict anonymous enumeration',
    'RestrictAnonymousSAM = 1, RestrictAnonymous = 1.', 'Get-ItemProperty HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa -Name RestrictAnonymous,RestrictAnonymousSAM');
  M('MSB-NET-06', 'H', 'server', 'network', 'LDAP-Signierung und Channel Binding (Domänencontroller)', 'LDAP signing & channel binding (DCs)',
    'Domänencontroller: LDAP-Serversignaturanforderungen = Signatur erforderlich; LDAP Channel Binding erzwingen.', 'Get-ItemProperty HKLM:\\SYSTEM\\CurrentControlSet\\Services\\NTDS\\Parameters -Name LDAPServerIntegrity,LdapEnforceChannelBinding');
  M('MSB-RDP-01', 'S', 'any', 'remote', 'RDP: Authentifizierung auf Netzwerkebene (NLA)', 'RDP: require NLA',
    'Remotedesktopdienste › Sicherheit: Benutzerauthentifizierung mit NLA erforderlich; Verschlüsselungsstufe „Hoch“; keine Kennwortspeicherung.',
    'Get-ItemProperty "HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server\\WinStations\\RDP-Tcp" -Name UserAuthentication', ['SYS.1.2.3.A6', 'SYS.2.2.3.A19']);
  M('MSB-SVC-01', 'S', 'server', 'services', 'Druckwarteschlange auf Servern ohne Druckfunktion deaktivieren', 'Disable Print Spooler where not needed',
    'Spooler auf Domänencontrollern und Servern ohne Druckaufgaben deaktivieren.', 'Get-Service Spooler | Select Status,StartType');
  M('MSB-SVC-02', 'S', 'any', 'media', 'AutoPlay/AutoRun für alle Laufwerke deaktivieren', 'Turn off AutoPlay for all drives',
    'Windows-Komponenten › Richtlinien für die automatische Wiedergabe › AutoPlay deaktivieren = Alle Laufwerke.', 'Get-ItemProperty HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer -Name NoDriveTypeAutoRun');
  M('MSB-SVC-03', 'S', 'any', 'services', 'PowerShell 2.0 entfernen', 'Remove PowerShell 2.0',
    'Veraltete PowerShell-Engine ohne Logging-Fähigkeiten entfernen.', 'Get-WindowsOptionalFeature -Online -FeatureName MicrosoftWindowsPowerShellV2Root', ['SYS.1.2.3.A7']);
  M('MSB-LOG-01', 'B', 'any', 'logging', 'Erweiterte Überwachungsrichtlinie (Advanced Audit Policy)', 'Advanced audit policy',
    'Mindestens: Anmeldung/Abmeldung, Kontosperrung, Kontoverwaltung, Richtlinienänderung, Sicherheitssystemerweiterung, Prozesserstellung (Erfolg/Fehler gemäß Baseline).', 'auditpol /get /category:*', ['SYS.1.1.A10']);
  M('MSB-LOG-02', 'S', 'any', 'logging', 'Befehlszeile in Prozesserstellungsereignissen', 'Include command line in process creation events',
    'System › Überwachung der Prozesserstellung › Befehlszeile einschließen = Aktiviert (Ereignis 4688).', 'Get-ItemProperty HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System\\Audit -Name ProcessCreationIncludeCmdLine_Enabled');
  M('MSB-LOG-03', 'S', 'any', 'logging', 'Sicherheitsprotokoll ausreichend groß', 'Security event log size',
    'Maximale Größe des Sicherheitsprotokolls ≥ 196 608 KB; Weiterleitung an zentrales SIEM (WEF).', 'wevtutil gl Security | findstr maxSize');
  M('MSB-LOG-04', 'S', 'any', 'logging', 'PowerShell Script Block Logging', 'PowerShell script block logging',
    'Windows-Komponenten › Windows PowerShell › Protokollierung von PowerShell-Skriptblöcken = Aktiviert.', 'Get-ItemProperty HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\PowerShell\\ScriptBlockLogging', ['SYS.1.2.3.A7', 'SYS.2.2.3.A22']);
  M('MSB-MAL-01', 'B', 'any', 'malware', 'Microsoft Defender: Echtzeitschutz & Cloud-Schutz', 'Defender real-time & cloud protection',
    'Echtzeitschutz, Cloud-Schutz (MAPS) und PUA-Schutz aktivieren – Datenschutzabwägung für Cloud-Schutz dokumentieren.', 'Get-MpPreference | Select DisableRealtimeMonitoring,MAPSReporting,PUAProtection', ['SYS.2.2.3.A5', 'SYS.1.1.A9']);
  M('MSB-MAL-02', 'S', 'any', 'exploit', 'Regeln zur Verringerung der Angriffsfläche (ASR)', 'Attack Surface Reduction rules',
    'ASR-Regeln (z. B. Diebstahl von Anmeldeinformationen aus LSASS blockieren) zunächst im Überwachungsmodus, dann blockierend.', 'Get-MpPreference | Select -Expand AttackSurfaceReductionRules_Actions');
  M('MSB-UAC-01', 'B', 'any', 'privilege', 'UAC: Administratorbestätigungsmodus aktiv', 'UAC admin approval mode',
    'EnableLUA = 1; Erhöhungsaufforderung auf dem sicheren Desktop.', 'Get-ItemProperty HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System -Name EnableLUA,PromptOnSecureDesktop', ['SYS.2.2.3.A20']);
  M('MSB-CRY-01', 'S', 'client', 'crypto', 'BitLocker mit TPM + PIN', 'BitLocker with TPM + PIN',
    'Betriebssystemlaufwerk mit BitLocker (XTS-AES 256) verschlüsseln; Wiederherstellungsschlüssel in AD/Entra hinterlegen.', 'manage-bde -status C:', ['SYS.2.1.A28']);
  M('MSB-PAT-01', 'B', 'any', 'patch', 'Updates über WSUS/Intune/Windows Update for Business steuern', 'Managed Windows Update',
    'Updates zentral freigeben und Installationsstand überwachen (monatlicher Patchday).', 'Get-HotFix | Sort-Object InstalledOn -Descending | Select -First 5');

  /* ------------------------------------------------------------------
   * macOS Security Compliance Project (mSCP)
   * ---------------------------------------------------------------- */
  var mac = [];
  /** K(ref, level, topic, de, en, desc, check, bsi) */
  function K(ref, level, topic, de, en, desc, check, bsi) {
    mac.push({ lib: 'mscp', ref: ref, group: 'mSCP / ' + topic, level: level, os: ['macos'], role: 'any',
      topic: topic, title: { de: de, en: en }, desc: { de: desc }, check: check ? { macos: check } : null, bsi: bsi || [] });
  }
  K('os_gatekeeper_enable', 'B', 'malware', 'Gatekeeper aktiviert', 'Enable Gatekeeper',
    'Nur signierte/notarisierte Software ausführen.', 'spctl --status', ['SYS.2.4.A2']);
  K('os_sip_enable', 'B', 'exploit', 'System Integrity Protection aktiviert', 'Enable System Integrity Protection',
    'SIP schützt Systemdateien und -prozesse.', 'csrutil status', ['SYS.2.4.A2']);
  K('system_settings_filevault_enforce', 'S', 'crypto', 'FileVault erzwingen', 'Enforce FileVault',
    'Vollständige Festplattenverschlüsselung; Recovery-Key per MDM hinterlegen (nicht bei Apple).', 'fdesetup status', ['SYS.2.4.A4']);
  K('system_settings_firewall_enable', 'S', 'network', 'Anwendungs-Firewall aktivieren', 'Enable application firewall',
    'Integrierte Firewall einschalten.', '/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate', ['SYS.2.4.A10']);
  K('system_settings_firewall_stealth_mode_enable', 'S', 'network', 'Firewall-Tarnmodus', 'Enable firewall stealth mode',
    'Keine Antwort auf ICMP-Pings/Portscans.', '/usr/libexec/ApplicationFirewall/socketfilterfw --getstealthmode', ['SYS.2.4.A10']);
  K('system_settings_guest_account_disable', 'B', 'accounts', 'Gast-Konto deaktivieren', 'Disable guest account',
    'Gastzugang abschalten.', 'defaults read /Library/Preferences/com.apple.loginwindow GuestEnabled', ['SYS.2.4.A3']);
  K('system_settings_automatic_login_disable', 'B', 'accounts', 'Automatische Anmeldung deaktivieren', 'Disable automatic login',
    'Kein Auto-Login.', 'defaults read /Library/Preferences/com.apple.loginwindow autoLoginUser 2>&1');
  K('os_root_disable', 'S', 'accounts', 'root-Konto deaktivieren', 'Disable root login',
    'Kein aktiver root-Benutzer.', 'dscl . -read /Users/root UserShell');
  K('pwpolicy_minimum_length_enforce', 'S', 'accounts', 'Passwort-Mindestlänge', 'Enforce minimum password length',
    'Mindestlänge per Konfigurationsprofil (z. B. 15).', 'pwpolicy -getaccountpolicies | grep -i minimum');
  K('pwpolicy_account_lockout_enforce', 'S', 'accounts', 'Kontosperrung nach Fehlversuchen', 'Limit consecutive failed login attempts',
    'Sperrung nach z. B. 5 Fehlversuchen.', 'pwpolicy -getaccountpolicies | grep -i maxFailed');
  K('system_settings_screensaver_timeout_enforce', 'B', 'accounts', 'Bildschirmsperre nach Inaktivität', 'Enforce screen saver timeout',
    'Bildschirmschoner ≤ 15 min mit sofortiger Passwortabfrage.', 'sysadminctl -screenLock status 2>&1');
  K('system_settings_location_services_disable', 'S', 'privacy', 'Ortungsdienste deaktivieren', 'Disable location services',
    'Ortungsdienste aus, sofern nicht erforderlich.', 'sudo defaults read /var/db/locationd/Library/Preferences/ByHost/com.apple.locationd LocationServicesEnabled', ['SYS.2.4.A5']);
  K('icloud_drive_disable', 'S', 'privacy', 'iCloud Drive deaktivieren', 'Disable iCloud Drive',
    'Keine Synchronisation schützenswerter Daten in iCloud (per MDM-Profil).', 'profiles show -type configuration | grep -i allowCloudDocumentSync', ['SYS.2.4.A8']);
  K('os_airdrop_disable', 'S', 'media', 'AirDrop deaktivieren', 'Disable AirDrop',
    'Unkontrollierten Datenaustausch verhindern.', 'profiles show -type configuration | grep -i allowAirDrop');
  K('system_settings_bluetooth_disable', 'H', 'media', 'Bluetooth deaktivieren (falls nicht benötigt)', 'Disable Bluetooth',
    'Bluetooth aus, sofern keine Peripherie benötigt wird.', 'defaults read /Library/Preferences/com.apple.Bluetooth ControllerPowerState');
  K('system_settings_ssh_disable', 'S', 'remote', 'Entfernte Anmeldung (SSH) deaktivieren', 'Disable SSH server',
    'sshd nur aktivieren, wenn administrativ notwendig.', 'sudo systemsetup -getremotelogin');
  K('system_settings_screen_sharing_disable', 'S', 'remote', 'Bildschirmfreigabe deaktivieren', 'Disable screen sharing',
    'Screen Sharing/ARD nur bei Bedarf.', 'launchctl print-disabled system | grep -i screensharing');
  K('system_settings_smbd_disable', 'S', 'services', 'Dateifreigabe (SMB) deaktivieren', 'Disable SMB file sharing',
    'Keine Dateifreigabe auf Clients.', 'launchctl print-disabled system | grep -i smbd');
  K('system_settings_critical_update_install_enforce', 'B', 'patch', 'Kritische Sicherheitsupdates automatisch', 'Enforce critical security updates',
    'Rapid Security Responses / Sicherheitsupdates automatisch installieren.', 'defaults read /Library/Preferences/com.apple.SoftwareUpdate CriticalUpdateInstall');
  K('system_settings_install_macos_updates_enforce', 'S', 'patch', 'macOS-Updates automatisch installieren', 'Enforce macOS updates',
    'Automatische Installation von macOS-Updates.', 'softwareupdate -l');
  K('os_secure_boot_verify', 'S', 'boot', 'Startsicherheit „Volle Sicherheit“', 'Verify secure boot (full security)',
    'Apple silicon/T2: Startsicherheitsrichtlinie „Volle Sicherheit“.', 'system_profiler SPiBridgeDataType 2>/dev/null | grep -i "secure boot"', ['SYS.2.4.A12']);
  K('audit_auditd_enabled', 'S', 'logging', 'Unified Logging / Audit auswerten', 'Enable security auditing',
    'Sicherheitsrelevante Ereignisse protokollieren und zentral auswerten (Endpoint Security / Unified Log; auditd ist ab neueren macOS-Versionen abgekündigt).', 'log show --last 1h --predicate \'eventMessage contains "authentication"\' | tail');
  K('os_mdm_require', 'S', 'install', 'Gerät per MDM verwalten', 'Require MDM enrollment',
    'Zentrale Konfigurationsprofile und Nachweisbarkeit per MDM.', 'profiles status -type enrollment');

  HA.CATALOG_MS = ms;
  HA.CATALOG_MSCP = mac;

  /* Alle eingebauten Kataloge zu einer Liste zusammenführen */
  /* Erweiterte Prüfbefehle aus js/data/checks.js einmalig einmischen */
  var merged = false;
  function mergeChecks() {
    if (merged || !HA.CHECK_OVERRIDES) return;
    merged = true;
    (HA.CATALOG_BSI || []).forEach(function (it) {
      var o = HA.CHECK_OVERRIDES[it.ref];
      if (o) it.check = Object.assign({}, it.check || {}, o);
      if (HA.CHECK_HINTS && HA.CHECK_HINTS[it.ref]) it.hint = HA.CHECK_HINTS[it.ref];
    });
  }

  HA.builtinItems = function () {
    mergeChecks();
    return [].concat(HA.CATALOG_BSI || [], HA.CATALOG_SSG || [], HA.CATALOG_MS || [], HA.CATALOG_MSCP || []);
  };
})();

/* =====================================================================
 * checks.js – Erweiterte Prüfbefehle (zentral gepflegt)
 * ---------------------------------------------------------------------
 * Überschreibt bzw. ergänzt die Prüfbefehle der Kataloge. Schlüssel:
 *   windows | linux | macos       – je Plattform-Familie
 *   debian | ubuntu | fedora | rhel – distributionsspezifisch (hat Vorrang)
 * "hint" erscheint als Hinweis unter dem Prüfbefehl.
 * Diese Datei wurde aus einer Liste erzeugt; Änderungen direkt hier sind
 * problemlos möglich (normale JavaScript-Strings, \n = Zeilenumbruch).
 * ===================================================================== */
window.HA = window.HA || {};
HA.CHECK_OVERRIDES = {
  "SYS.1.1.A2": {
    "linux": "# Passwortrichtlinie (login.defs)\ngrep -E '^(PASS_MAX_DAYS|PASS_MIN_DAYS|PASS_MIN_LEN|ENCRYPT_METHOD)' /etc/login.defs\n\n# Wirksame SSH-Authentisierung (inkl. Drop-in-Dateien)\nsudo sshd -T | grep -E '^(passwordauthentication|pubkeyauthentication|kbdinteractiveauthentication|authenticationmethods|usepam|permitrootlogin) '",
    "windows": "net accounts\nGet-ADDefaultDomainPasswordPolicy   # nur in einer AD-Domäne\nGet-LapsDiagnostics                 # Windows LAPS, falls eingesetzt"
  },
  "SYS.1.1.A6": {
    "linux": "# Laufende und aktivierte Dienste\nsystemctl list-units --type=service --state=running --state=enabled --no-pager\n\n# Autostart-Definitionen (Unit-Dateien)\nsystemctl list-unit-files --type=service --state=enabled --no-pager\n\n# Socket-Aktivierung (Dienste, die bei Bedarf starten)\nsystemctl list-sockets --all --no-pager\n\n# Lauschende Netzwerkports mit Prozess\nsudo ss -tulpen",
    "windows": "Get-WindowsFeature | Where-Object Installed\nGet-Service | Where-Object StartType -eq Automatic | Sort-Object Status, Name\nGet-NetTCPConnection -State Listen | Sort-Object LocalPort"
  },
  "SYS.1.1.A9": {
    "linux": "printf '\\n--- Einsatz von Virenscanner und EDR überprüfen ---\\n'\nprintf '\\nHost: %s\\nZeitpunkt: %s\\n' \"$(hostname)\" \"$(date -Is)\"\n\nprintf '\\n--- Microsoft Defender for Endpoint ---\\n'\nif command -v mdatp >/dev/null 2>&1; then\n    sudo mdatp health\nelse\n    printf 'mdatp nicht im Suchpfad gefunden.\\n'\nfi\n\nprintf '\\n--- Virenschutzdienste und ClamAV-Sockets ---\\n'\nsystemctl list-units --all --type=service,socket \\\n    'mdatp.service' 'clamav*' 'clamd*' --no-pager\n\nprintf '\\n--- Installierte Dienstdefinitionen ---\\n'\nsystemctl list-unit-files --type=service,socket \\\n    'mdatp.service' 'clamav*' 'clamd*' --no-pager",
    "windows": "\"Host: $env:COMPUTERNAME\"\n\"Zeitpunkt: $(Get-Date -Format o)\"\n\nGet-MpComputerStatus | Select-Object `\n    AMRunningMode, AMServiceEnabled, AntivirusEnabled, `\n    RealTimeProtectionEnabled, BehaviorMonitorEnabled, `\n    AntivirusSignatureVersion, AntivirusSignatureLastUpdated, `\n    AMProductVersion, AMEngineVersion\n\nGet-Service -Name WinDefend, Sense |\n    Select-Object Name, DisplayName, Status, StartType"
  },
  "SYS.1.1.A10": {
    "linux": "# Schnellcheck\nsystemctl is-active auditd rsyslog systemd-journald; sudo auditctl -l | head\n\n# Dienststatus, Autostart und aktuell geladene Audit-Regeln\nsystemctl is-active auditd rsyslog systemd-journald\nsystemctl is-enabled auditd\nsudo auditctl -s\nsudo auditctl -l\n\n# Anmeldungen, Authentifizierung und Sitzungsende\nsudo ausearch -ts today -m USER_LOGIN,USER_AUTH,USER_START,USER_END -i\n\n# SSH-Protokoll unter Fedora, Debian und Ubuntu\nsudo journalctl -u sshd.service -u ssh.service --since today --no-pager\n\n# Protokollierte Systemstarts und Neustarts\nsudo journalctl --list-boots\n\n# Konto- und Gruppenänderungen seit heute\nsudo ausearch -ts today -m ADD_USER,DEL_USER,ADD_GROUP,DEL_GROUP,USER_MGMT,GRP_MGMT -i\n\n# Dateirechte und Eigentümeränderungen, sofern der Regelschlüssel perm_mod lautet\nsudo ausearch -ts today -k perm_mod -i",
    "windows": "auditpol /get /category:*\nGet-WinEvent -LogName Security -MaxEvents 20 | Select-Object TimeCreated, Id, ProviderName\nGet-WinEvent -FilterHashtable @{LogName='System'; Id=6005,6006,6008,1074} -MaxEvents 10"
  },
  "SYS.1.3.A2": {
    "linux": "# Doppelte Login-Namen und UIDs\ncut -d: -f1 /etc/passwd | sort | uniq -d\ncut -d: -f3 /etc/passwd | sort | uniq -d\n\n# Doppelte Gruppennamen und GIDs\ncut -d: -f1 /etc/group | sort | uniq -d\ncut -d: -f3 /etc/group | sort | uniq -d\n\n# Konten ausgeben, deren primäre GID in /etc/group fehlt\nawk -F: '\n    FILENAME == \"/etc/group\" { groups[$3] = 1; next }\n    !($4 in groups) { printf \"%s: primäre GID %s fehlt\\n\", $1, $4 }\n' /etc/group /etc/passwd\n\n# Integrität der Konten- und Gruppendateien lesend prüfen\nsudo pwck -r\nsudo grpck -r"
  },
  "SYS.1.3.A3": {
    "linux": "# Kernel-Modul für USB-Massenspeicher (Sperre wirksam?)\nmodprobe -n -v usb-storage\n\n# Konfiguration und Laufzeitstatus der Dienste\nsystemctl show autofs.service udisks2.service \\\n  -p Id -p LoadState -p UnitFileState -p ActiveState\n\n# Aktive und installierte systemd-Automount-Units\nsystemctl list-units --type=automount --all --no-pager\nsystemctl list-unit-files --type=automount --no-pager\n\n# Mount-Konfiguration auf Einträge für Wechseldatenträger prüfen\nfindmnt --fstab -o SOURCE,TARGET,FSTYPE,OPTIONS\n\n# Erkannte Datenträger und zugehörige Mountpunkte\nlsblk -o NAME,TYPE,TRAN,RM,FSTYPE,MOUNTPOINTS"
  },
  "SYS.1.3.A4": {
    "linux": "# ASLR zur Laufzeit\nsysctl kernel.randomize_va_space\n\n# NX-Funktion im Gast und Status beim Kernelstart\ngrep -m1 -ow nx /proc/cpuinfo\nsudo journalctl -k -b --no-pager | grep -Ei 'NX.*protection'"
  },
  "SYS.1.3.A5": {
    "fedora": "# Aktivierte Repositories ermitteln\ndnf5 repo list --enabled\n\n# Aufgelöste Konfiguration je aktivem Repository prüfen (REPO_ID ersetzen)\ndnf5 --dump-repo-config REPO_ID \\\n  | grep -Ei '^[[:space:]]*(pkg_gpgcheck|gpgcheck|repo_gpgcheck|gpgkey)[[:space:]]*='\n\n# Prüfung direkt übergebener RPM-Dateien\ndnf5 --dump-main-config \\\n  | grep -Ei '^[[:space:]]*localpkg_gpgcheck[[:space:]]*='",
    "rhel": "# Aktivierte Repositories ermitteln (RHEL/Alma/Rocky 9/10 mit dnf 4)\ndnf repolist --enabled\n\n# Signaturprüfung global und je Repository (aktive Zeilen, ohne Kommentare)\ngrep -HEi '^[[:space:]]*(gpgcheck|repo_gpgcheck|localpkg_gpgcheck|gpgkey)[[:space:]]*=' \\\n  /etc/dnf/dnf.conf /etc/yum.repos.d/*.repo",
    "debian": "# Globale Ausnahmen von der Authentifizierung prüfen\napt-config dump \\\n  | grep -Ei 'AllowUnauthenticated|Allow(Insecure|Weak|DowngradeToInsecure)Repositories'\n\n# Ausnahmen und Schlüsselbindung je Paketquelle prüfen\ngrep -rniE --include='sources.list' --include='*.list' --include='*.sources' \\\n  '(^[[:space:]]*(Trusted|Allow-Insecure|Allow-Weak|Allow-Downgrade-To-Insecure|Signed-By|Enabled)[[:space:]]*:|[[:space:]\\[](trusted|allow-insecure|allow-weak|allow-downgrade-to-insecure|signed-by)[[:space:]]*=)' \\\n  /etc/apt",
    "ubuntu": "# Globale Ausnahmen von der Authentifizierung prüfen\napt-config dump \\\n  | grep -Ei 'AllowUnauthenticated|Allow(Insecure|Weak|DowngradeToInsecure)Repositories'\n\n# Ausnahmen und Schlüsselbindung je Paketquelle prüfen\ngrep -rniE --include='sources.list' --include='*.list' --include='*.sources' \\\n  '(^[[:space:]]*(Trusted|Allow-Insecure|Allow-Weak|Allow-Downgrade-To-Insecure|Signed-By|Enabled)[[:space:]]*:|[[:space:]\\[](trusted|allow-insecure|allow-weak|allow-downgrade-to-insecure|signed-by)[[:space:]]*=)' \\\n  /etc/apt",
    "linux": "# Globale Ausnahmen von der Authentifizierung prüfen\napt-config dump \\\n  | grep -Ei 'AllowUnauthenticated|Allow(Insecure|Weak|DowngradeToInsecure)Repositories'\n\n# Ausnahmen und Schlüsselbindung je Paketquelle prüfen\ngrep -rniE --include='sources.list' --include='*.list' --include='*.sources' \\\n  '(^[[:space:]]*(Trusted|Allow-Insecure|Allow-Weak|Allow-Downgrade-To-Insecure|Signed-By|Enabled)[[:space:]]*:|[[:space:]\\[](trusted|allow-insecure|allow-weak|allow-downgrade-to-insecure|signed-by)[[:space:]]*=)' \\\n  /etc/apt"
  }
};
HA.CHECK_HINTS = {
  "SYS.1.3.A5": "Fedora (DNF5): Für RPM-Paketsignaturen ist pkg_gpgcheck maßgeblich; repo_gpgcheck betrifft nur die Repository-Metadaten. Ein repo_gpgcheck=0 bedeutet daher nicht, dass Paketsignaturen ungeprüft bleiben. REPO_ID durch die IDs aus der ersten Ausgabe ersetzen. Ein einfaches grep über die .repo-Dateien würde auch Kommentare und deaktivierte Repositories ausgeben.",
  "SYS.1.3.A3": "Nachweis: Dienste autofs/udisks2 deaktiviert bzw. nicht installiert, keine Automount-Units, keine fstab-Einträge für Wechselmedien (RM=1 in lsblk).",
  "SYS.1.1.A9": "Die Ausgabe des Skripts kann direkt als Nachweis in die Notiz kopiert werden (Host und Zeitstempel sind enthalten)."
};

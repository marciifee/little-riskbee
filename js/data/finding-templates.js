/* =====================================================================
 * data/finding-templates.js – Vorlagen für Pentest-Findings
 * ---------------------------------------------------------------------
 * Typische Schwachstellen als Startpunkt (Texte in Markdown). Bitte immer
 * an den konkreten Befund anpassen: betroffene Systeme, Nachweise,
 * Reproduktionsschritte und Bewertung (CVSS) ergänzen.
 * Felder: id, title, severity, cvssVector, cwe, owasp, summary, description,
 *         impact, recommendation, shortRec, references
 * ===================================================================== */
window.HA = window.HA || {};

HA.FINDING_TEMPLATES = [
  {
    id: 'sqli', title: 'SQL-Injection', severity: 'critical', cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', cwe: 'CWE-89', owasp: 'A03',
    summary: 'Ein Eingabeparameter der Anwendung wird ungeprüft in eine Datenbankabfrage übernommen. Angreifende können dadurch eigene SQL-Befehle ausführen und Daten auslesen oder verändern.',
    description: 'Der Parameter `PARAMETER` des Endpunkts `ENDPUNKT` wird ohne Parametrisierung in eine SQL-Abfrage eingefügt. Durch gezielte Eingaben (z. B. `\' OR \'1\'=\'1`) lässt sich die Logik der Abfrage verändern.\n\nDer Nachweis erfolgte über eine zeitbasierte bzw. fehlerbasierte Injektion (siehe Reproduktion).',
    impact: '- Auslesen sämtlicher Datenbankinhalte (inkl. personenbezogener Daten und Passwort-Hashes)\n- Veränderung oder Löschung von Daten\n- je nach Datenbankrechten Ausführung von Betriebssystembefehlen',
    recommendation: '1. Ausschließlich **parametrisierte Abfragen** (Prepared Statements) bzw. ein ORM verwenden.\n2. Eingaben serverseitig nach Positivliste validieren (Typ, Länge, Format).\n3. Datenbankkonto der Anwendung nach dem Least-Privilege-Prinzip einschränken.\n4. Fehlerdetails der Datenbank nicht an Clients ausgeben.\n5. Ergänzend eine Web Application Firewall als zusätzliche Schutzschicht einsetzen.',
    shortRec: 'Prepared Statements verwenden, Eingaben validieren, DB-Rechte minimieren.',
    references: '- OWASP Top 10 2021 – A03 Injection: https://owasp.org/Top10/A03_2021-Injection/\n- OWASP Cheat Sheet SQL Injection Prevention: https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html\n- CWE-89: https://cwe.mitre.org/data/definitions/89.html'
  },
  {
    id: 'xss', title: 'Reflektiertes Cross-Site-Scripting (XSS)', severity: 'medium', cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N', cwe: 'CWE-79', owasp: 'A03',
    summary: 'Benutzereingaben werden ungefiltert in die Antwortseite übernommen. Über einen präparierten Link kann Skriptcode im Browser angemeldeter Nutzender ausgeführt werden.',
    description: 'Der Parameter `PARAMETER` auf `URL` wird ohne kontextgerechte Kodierung in das HTML-Dokument eingebettet. Die Eingabe `<script>alert(document.domain)</script>` wurde unverändert ausgeführt.',
    impact: '- Übernahme von Sitzungen (sofern Cookies nicht `HttpOnly` sind)\n- Ausführen von Aktionen im Namen der betroffenen Person\n- Phishing über die vertrauenswürdige Domain',
    recommendation: '1. Ausgaben **kontextabhängig kodieren** (HTML, Attribut, JavaScript, URL).\n2. Template-Engines mit automatischem Escaping verwenden.\n3. Eine restriktive **Content-Security-Policy** setzen (ohne `unsafe-inline`).\n4. Sitzungs-Cookies mit `HttpOnly`, `Secure` und `SameSite` versehen.',
    shortRec: 'Ausgaben kontextgerecht kodieren und eine strikte CSP setzen.',
    references: '- OWASP Cheat Sheet XSS Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html\n- CWE-79: https://cwe.mitre.org/data/definitions/79.html'
  },
  {
    id: 'idor', title: 'Unzureichende Zugriffskontrolle (IDOR)', severity: 'high', cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:L/A:N', cwe: 'CWE-639', owasp: 'A01',
    summary: 'Durch Ändern einer Objekt-ID in der Anfrage können angemeldete Nutzende auf Datensätze anderer Personen zugreifen.',
    description: 'Der Endpunkt `ENDPUNKT/{id}` prüft nur die Anmeldung, nicht aber, ob das angefragte Objekt der angemeldeten Person gehört. Durch Hochzählen der ID wurden fremde Datensätze abgerufen.',
    impact: 'Unbefugter Zugriff auf und ggf. Änderung von Daten anderer Nutzender; je nach Daten meldepflichtige Datenschutzverletzung (Art. 33 DSGVO).',
    recommendation: '1. **Objektbezogene Berechtigungsprüfung** serverseitig bei jedem Zugriff durchführen.\n2. Zugriffskontrolle zentral (Middleware/Policy) implementieren, nicht je Endpunkt.\n3. Nicht erratbare IDs (UUID) erschweren das Auffinden, ersetzen aber nicht die Prüfung.\n4. Automatisierte Tests für Berechtigungen ergänzen.',
    shortRec: 'Objektbezogene Berechtigungsprüfung serverseitig erzwingen.',
    references: '- OWASP Top 10 2021 – A01 Broken Access Control: https://owasp.org/Top10/A01_2021-Broken_Access_Control/\n- CWE-639: https://cwe.mitre.org/data/definitions/639.html'
  },
  {
    id: 'defaultcreds', title: 'Standard- bzw. schwache Zugangsdaten', severity: 'critical', cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', cwe: 'CWE-1392', owasp: 'A07',
    summary: 'Eine administrative Oberfläche ist mit Standard- bzw. leicht zu erratenden Zugangsdaten erreichbar.',
    description: 'Auf `SYSTEM/URL` war eine Anmeldung mit `BENUTZER` / `PASSWORT` möglich. Eine Begrenzung von Fehlversuchen war nicht aktiv.',
    impact: 'Vollständige Übernahme des Systems bzw. der Anwendung, Zugriff auf Daten und Ausgangspunkt für weitere Angriffe im Netz.',
    recommendation: '1. Standardpasswörter sofort ändern; starke, einzigartige Passwörter verwenden (Passwortmanager).\n2. **Mehr-Faktor-Authentisierung** für administrative Zugänge aktivieren.\n3. Administrative Oberflächen nur aus dem Verwaltungsnetz erreichbar machen.\n4. Fehlversuche begrenzen und protokollieren.',
    shortRec: 'Passwort ändern, MFA aktivieren, Admin-Zugang netzseitig beschränken.',
    references: '- BSI IT-Grundschutz ORP.4 Identitäts- und Berechtigungsmanagement\n- CWE-1392: https://cwe.mitre.org/data/definitions/1392.html'
  },
  {
    id: 'tls', title: 'Veraltete TLS-Protokolle und schwache Cipher-Suites', severity: 'medium', cvssVector: 'CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N', cwe: 'CWE-326', owasp: 'A02',
    summary: 'Der Dienst unterstützt veraltete Protokolle (TLS 1.0/1.1) bzw. schwache Verschlüsselungsverfahren.',
    description: 'Die Prüfung mit `testssl.sh` bzw. `nmap --script ssl-enum-ciphers` auf `HOST:PORT` ergab Unterstützung für TLS 1.0/1.1 sowie Cipher-Suites ohne Forward Secrecy bzw. mit CBC/3DES.',
    impact: 'Unter bestimmten Bedingungen können verschlüsselte Verbindungen abgehört oder manipuliert werden; Verstoß gegen Vorgaben (z. B. BSI TR-02102-2).',
    recommendation: '1. Nur **TLS 1.2 und TLS 1.3** zulassen.\n2. Cipher-Suites gemäß BSI TR-02102-2 konfigurieren (ECDHE, AES-GCM, ChaCha20-Poly1305).\n3. HSTS aktivieren.\n4. Konfiguration nach Änderung erneut prüfen.',
    shortRec: 'Nur TLS 1.2/1.3 und Cipher-Suites nach BSI TR-02102-2 zulassen.',
    references: '- BSI TR-02102-2: https://www.bsi.bund.de/dok/TR-02102\n- CWE-326: https://cwe.mitre.org/data/definitions/326.html'
  },
  {
    id: 'headers', title: 'Fehlende Sicherheits-Header', severity: 'low', cvssVector: 'CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N', cwe: 'CWE-693', owasp: 'A05',
    summary: 'Die Webanwendung setzt empfohlene HTTP-Sicherheits-Header nicht oder unvollständig.',
    description: 'In den Antworten von `URL` fehlen folgende Header:\n\n| Header | Status |\n|---|---|\n| Content-Security-Policy | fehlt |\n| Strict-Transport-Security | fehlt |\n| X-Content-Type-Options | fehlt |\n| Referrer-Policy | fehlt |\n| Permissions-Policy | fehlt |',
    impact: 'Fehlende Schutzschichten erleichtern die Ausnutzung anderer Schwachstellen (z. B. XSS, Clickjacking, MIME-Sniffing).',
    recommendation: 'Folgende Header zentral (Webserver/Reverse-Proxy) setzen:\n\n```\nContent-Security-Policy: default-src \'self\'; frame-ancestors \'none\'\nStrict-Transport-Security: max-age=31536000; includeSubDomains\nX-Content-Type-Options: nosniff\nReferrer-Policy: strict-origin-when-cross-origin\nPermissions-Policy: camera=(), microphone=(), geolocation=()\n```',
    shortRec: 'CSP, HSTS, X-Content-Type-Options, Referrer- und Permissions-Policy setzen.',
    references: '- OWASP Secure Headers Project: https://owasp.org/www-project-secure-headers/'
  },
  {
    id: 'outdated', title: 'Veraltete Software mit bekannten Schwachstellen', severity: 'high', cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N', cwe: 'CWE-1104', owasp: 'A06',
    summary: 'Auf dem System wird eine Softwareversion eingesetzt, für die öffentlich bekannte Schwachstellen (CVE) existieren.',
    description: 'Die Komponente `PRODUKT` liegt in Version `VERSION` vor (ermittelt über Banner / Paketliste). Für diese Version sind u. a. folgende Schwachstellen veröffentlicht: `CVE-XXXX-XXXXX`.',
    impact: 'Je nach Schwachstelle Ausführung von Schadcode, Datenabfluss oder Ausfall des Dienstes; öffentlich verfügbare Exploits erhöhen die Eintrittswahrscheinlichkeit.',
    recommendation: '1. Komponente zeitnah auf eine unterstützte, gepatchte Version aktualisieren.\n2. **Patchmanagement-Prozess** mit festen Fristen nach Kritikalität etablieren.\n3. Inventar der eingesetzten Software (SBOM) pflegen und regelmäßig gegen Schwachstellendatenbanken prüfen.',
    shortRec: 'Komponente aktualisieren und Patchmanagement mit Fristen etablieren.',
    references: '- OWASP Top 10 2021 – A06 Vulnerable and Outdated Components: https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/\n- BSI IT-Grundschutz OPS.1.1.3 Patch- und Änderungsmanagement'
  },
  {
    id: 'smbsign', title: 'SMB-Signierung nicht erzwungen', severity: 'medium', cvssVector: 'CVSS:3.1/AV:A/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N', cwe: 'CWE-294', owasp: '',
    summary: 'Windows-Systeme erzwingen keine SMB-Signierung. Angreifende im internen Netz können Anmeldungen weiterleiten (NTLM-Relay).',
    description: 'Die Prüfung (`nmap --script smb2-security-mode` bzw. `netexec smb`) ergab für `HOSTS`: „Message signing enabled but not required“.',
    impact: 'NTLM-Relay-Angriffe ermöglichen die Anmeldung an anderen Systemen im Namen der weitergeleiteten Konten, bis hin zur Übernahme der Domäne.',
    recommendation: '1. SMB-Signierung per Gruppenrichtlinie auf Clients und Servern **erzwingen**.\n2. NTLM schrittweise einschränken bzw. deaktivieren; LLMNR und NBT-NS abschalten.\n3. Wirksamkeit nach Umstellung erneut prüfen.',
    shortRec: 'SMB-Signierung per GPO erzwingen, NTLM/LLMNR einschränken.',
    references: '- Microsoft: Overview of Server Message Block signing: https://learn.microsoft.com/windows-server/storage/file-server/smb-signing-overview'
  },
  {
    id: 'infodisc', title: 'Preisgabe technischer Informationen', severity: 'info', cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N', cwe: 'CWE-200', owasp: 'A05',
    summary: 'Die Anwendung gibt Versionsnummern, Stacktraces oder interne Pfade preis.',
    description: 'Server-Banner (`Server:`, `X-Powered-By:`) und Fehlerseiten auf `URL` enthalten Produktnamen, Versionen und interne Pfade.',
    impact: 'Erleichtert Angreifenden die Auswahl passender Exploits; kein direktes Risiko.',
    recommendation: 'Versionsangaben in Bannern entfernen, generische Fehlerseiten ausliefern, Debug-Modus in Produktion deaktivieren.',
    shortRec: 'Banner und Fehlerseiten generisch gestalten, Debug-Modus abschalten.',
    references: '- CWE-200: https://cwe.mitre.org/data/definitions/200.html'
  }
];

/* OWASP Top 10 (2021) für die Kategorie-Auswahl */
HA.OWASP_TOP10 = [
  ['A01', 'A01:2021 Broken Access Control'], ['A02', 'A02:2021 Cryptographic Failures'], ['A03', 'A03:2021 Injection'], ['A04', 'A04:2021 Insecure Design'],
  ['A05', 'A05:2021 Security Misconfiguration'], ['A06', 'A06:2021 Vulnerable and Outdated Components'], ['A07', 'A07:2021 Identification and Authentication Failures'],
  ['A08', 'A08:2021 Software and Data Integrity Failures'], ['A09', 'A09:2021 Security Logging and Monitoring Failures'], ['A10', 'A10:2021 Server-Side Request Forgery']
];

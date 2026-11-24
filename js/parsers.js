/* =====================================================================
 * parsers.js – Import-Funktionen (laufen vollständig lokal im Browser)
 * ---------------------------------------------------------------------
 * Unterstützte Formate:
 *   Scans:     Nmap XML (-oX) & grepable (-oG) · Lynis report.dat & lynis.log
 *              OpenVAS/Greenbone XML & CSV · OpenSCAP XCCDF-Results & ARF
 *              generische CSV (z. B. HardeningKitty) · DAT (key=value)
 *   Kataloge:  SSG-Datastream / XCCDF-Benchmark (inkl. Profile, CIS/STIG …)
 *              OSCAL-Katalog JSON/XML (Grundschutz++) · BSI-Kompendium (XML/Text)
 *              CSV-Maßnahmenliste · JSON-Liste
 *   Sonstiges: Asset-Liste (CSV) · gespeicherter Zwischenstand (JSON)
 *
 * Jeder Parser liefert ein Ergebnisobjekt mit "kind":
 *   'scan' | 'xccdf' | 'catalog' | 'assets' | 'state' | 'evidence'
 * Die Übernahme in den Zustand erledigt app.js.
 * ===================================================================== */
window.HA = window.HA || {};

HA.Parsers = (function () {
  'use strict';

  /* ------------------------------------------------------------------
   * Hilfsfunktionen
   * ---------------------------------------------------------------- */

  /** Reine JavaScript-SHA-256 als Fallback, falls crypto.subtle unter
   *  file:// nicht verfügbar ist. (Standardalgorithmus nach FIPS 180-4) */
  function sha256Fallback(bytes) {
    var K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    var l = bytes.length, bitLen = l * 8;
    var withPad = ((l + 9 + 63) >> 6) << 6;
    var m = new Uint8Array(withPad); m.set(bytes); m[l] = 0x80;
    var dv = new DataView(m.buffer);
    dv.setUint32(withPad - 4, bitLen >>> 0); dv.setUint32(withPad - 8, Math.floor(bitLen / 4294967296));
    var w = new Uint32Array(64);
    for (var off = 0; off < withPad; off += 64) {
      for (var i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (i = 16; i < 64; i++) {
        var s0 = ((w[i-15] >>> 7) | (w[i-15] << 25)) ^ ((w[i-15] >>> 18) | (w[i-15] << 14)) ^ (w[i-15] >>> 3);
        var s1 = ((w[i-2] >>> 17) | (w[i-2] << 15)) ^ ((w[i-2] >>> 19) | (w[i-2] << 13)) ^ (w[i-2] >>> 10);
        w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var mj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + mj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    return H.map(function (x) { return ('00000000' + x.toString(16)).slice(-8); }).join('');
  }

  /** SHA-256 einer Datei als Hex-String (Nachweis der Unverändertheit). */
  function sha256(buffer) {
    try {
      if (window.crypto && crypto.subtle && window.isSecureContext !== false) {
        return crypto.subtle.digest('SHA-256', buffer).then(function (h) {
          return Array.prototype.map.call(new Uint8Array(h), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
        }).catch(function () { return sha256Fallback(new Uint8Array(buffer)); });
      }
    } catch (e) { /* weiter mit Fallback */ }
    return Promise.resolve(sha256Fallback(new Uint8Array(buffer)));
  }

  /** XML parsen; wirft einen Fehler bei ungültigem XML. */
  function parseXml(text) {
    var doc = new DOMParser().parseFromString(text, 'application/xml');
    var err = doc.getElementsByTagName('parsererror')[0];
    if (err) throw new Error('XML: ' + (err.textContent || '').slice(0, 160));
    return doc;
  }
  /** Alle Elemente eines lokalen Namens (unabhängig vom Namespace). */
  function els(root, name) { return Array.prototype.slice.call(root.getElementsByTagNameNS('*', name)); }
  /** Direktes Kindelement nach lokalem Namen. */
  function child(el, name) {
    if (!el) return null;
    for (var n = el.firstElementChild; n; n = n.nextElementSibling) if (n.localName === name) return n;
    return null;
  }
  function childText(el, name) { var c = child(el, name); return c ? c.textContent.trim() : ''; }
  function clip(s, n) { s = (s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  /** Schwere vereinheitlichen: critical | high | medium | low | info */
  function normSeverity(v) {
    if (v === undefined || v === null || v === '') return 'info';
    var n = parseFloat(String(v).replace(',', '.'));
    if (!isNaN(n) && /^[\d.,\s]+$/.test(String(v))) {
      if (n >= 9) return 'critical'; if (n >= 7) return 'high'; if (n >= 4) return 'medium'; if (n > 0) return 'low'; return 'info';
    }
    var s = String(v).toLowerCase();
    if (/crit|kritisch/.test(s)) return 'critical';
    if (/high|hoch|alarm|warn/.test(s)) return 'high';
    if (/med|mittel|moderate/.test(s)) return 'medium';
    if (/low|niedrig|gering/.test(s)) return 'low';
    return 'info';
  }

  /** Datum in ISO-String umwandeln (robust gegenüber diversen Formaten). */
  function toIso(v) {
    if (!v) return '';
    if (/^\d{9,10}$/.test(String(v))) return new Date(parseInt(v, 10) * 1000).toISOString();
    var d = new Date(String(v).replace(' ', 'T'));
    if (!isNaN(d)) return d.toISOString();
    d = new Date(v);
    return isNaN(d) ? '' : d.toISOString();
  }

  /** CSV-Parser (RFC 4180) mit automatischer Trennzeichenerkennung. */
  function parseCsv(text) {
    text = text.replace(/^﻿/, '');
    var firstLine = text.split(/\r?\n/)[0] || '';
    var delim = [',', ';', '\t', '|'].map(function (d) { return [d, firstLine.split(d).length]; })
      .sort(function (a, b) { return b[1] - a[1]; })[0][0];
    var rows = [], row = [], field = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += ch;
      } else if (ch === '"') q = true;
      else if (ch === delim) { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    if (!rows.length) return { headers: [], rows: [] };
    var headers = rows[0].map(function (h) { return h.trim(); });
    var objs = rows.slice(1).map(function (r) {
      var o = {}; headers.forEach(function (h, idx) { o[h] = (r[idx] || '').trim(); }); return o;
    });
    return { headers: headers, rows: objs };
  }
  /** Spalte anhand mehrerer möglicher Namen finden (case-insensitive). */
  function col(headers, names) {
    var lower = headers.map(function (h) { return h.toLowerCase(); });
    for (var i = 0; i < names.length; i++) {
      var idx = lower.indexOf(names[i]); if (idx >= 0) return headers[idx];
    }
    for (i = 0; i < names.length; i++) {
      for (var j = 0; j < lower.length; j++) if (lower[j].indexOf(names[i]) >= 0) return headers[j];
    }
    return null;
  }

  /** Betriebssystem-Text auf OS-ID abbilden. */
  function guessOs(s) {
    s = (s || '').toLowerCase();
    if (/windows.*server|server.*20(1[269]|2[25])/.test(s)) return 'win-server';
    if (/windows|win1[01]/.test(s)) return 'win-client';
    if (/ubuntu/.test(s)) return 'ubuntu';
    if (/debian/.test(s)) return 'debian';
    if (/fedora/.test(s)) return 'fedora';
    if (/red ?hat|rhel|alma|rocky|centos|oracle linux/.test(s)) return 'rhel';
    if (/mac|darwin|os x/.test(s)) return 'macos';
    return s ? 'linux-other' : '';
  }

  /** Thema einer Regel/Anforderung anhand von Schlüsselwörtern raten. */
  function guessTopic(id, title) {
    var s = ((id || '') + ' ' + (title || '')).toLowerCase();
    var map = [
      [/sshd?_|ssh |rdp|fernzugriff|remote/, 'remote'],
      [/audit|rsyslog|journald|log|protokoll|chrony|ntp|time|zeit/, 'logging'],
      [/firewall|nftables|iptables|ufw|sysctl_net|network|netz|port|smb|llmnr|dns/, 'network'],
      [/accounts?_|pam|password|passwort|kennwort|sudo|login|authent|konto|user|benutzer|mfa/, 'accounts'],
      [/selinux|apparmor|coredump|sysctl_kernel|aslr|exploit|kernel|fapolicy|ausführungskontrolle|mount_option/, 'exploit'],
      [/file_permissions|file_owner|file_groupowner|dir_perms|permission|berechtig|rechte/, 'privilege'],
      [/aide|rpm_verify|integrit|hids|angriffserkennung|detektion|intrusion/, 'integrity'],
      [/grub|boot|firmware|uefi|secure ?boot|tpm/, 'boot'],
      [/crypto|fips|encrypt|verschl|krypto|tls|zertifikat|certificate/, 'crypto'],
      [/update|patch|gpgcheck|aktualis|upgrade/, 'patch'],
      [/usb|autofs|wechsel|removable|bluetooth|kamera|mikrofon/, 'media'],
      [/malware|virus|antivir|clamav|defender|schadsoft|schadprog/, 'malware'],
      [/partition|backup|datensich|notfall|verfügbar|redundan|monitor|usv/, 'availability'],
      [/telemetr|cloud|datenschutz|privacy|icloud|cortana/, 'privacy'],
      [/beschaff|aussonder|außerbetrieb|decommission|procure/, 'lifecycle'],
      [/package_.*_removed|service_.*_disabled|kernel_module|dienst|service|daemon/, 'services'],
      [/banner|richtlinie|policy|dokument|planung|konzept/, 'planning']
    ];
    for (var i = 0; i < map.length; i++) if (map[i][0].test(s)) return map[i][1];
    return 'install';
  }

  /** Lynis-Testkategorie → Thema */
  function lynisTopic(test) {
    var p = (test || '').split('-')[0];
    var m = { SSH: 'remote', AUTH: 'accounts', SHLL: 'accounts', FIRE: 'network', NETW: 'network', NAME: 'network', KRNL: 'exploit', PROC: 'exploit',
      PKGS: 'patch', DEB: 'patch', LOGG: 'logging', ACCT: 'logging', TIME: 'logging', FILE: 'privilege', HOME: 'privilege', MALW: 'malware', HRDN: 'install',
      BOOT: 'boot', USB: 'media', STRG: 'media', CRYP: 'crypto', FINT: 'integrity', TOOL: 'integrity', SCHD: 'services', MAIL: 'services', HTTP: 'services',
      INSE: 'services', BANN: 'planning', STRG2: 'media', DBS: 'services', PHP: 'services', SNMP: 'services', NFS: 'services', PRNT: 'services', SQD: 'services', LDAP: 'services' };
    return m[p] || 'install';
  }

  var SSG_PREFIX = 'xccdf_org.ssgproject.content_rule_';
  function shortRule(id) { return (id || '').replace(SSG_PREFIX, ''); }

  /* ------------------------------------------------------------------
   * Scan-Parser
   * ---------------------------------------------------------------- */

  /* ---------- Nmap ----------
   * Jeder offene Port (state "open" oder "open|filtered") wird als Befund
   * angelegt. Bewertung in der Oberfläche: „Risiko akzeptiert“ = Port ist
   * erwartet/benötigt, „behoben“ = Port wurde geschlossen.
   */
  var NMAP_SOLUTION = 'Prüfen, ob der Dienst benötigt wird; sonst deaktivieren bzw. per Firewall auf berechtigte Quellnetze beschränken.';
  function nmapFinding(ip, hostname, portid, proto, state, svcName, product, version, extra, scripts) {
    var port = portid + '/' + proto;
    var svc = [svcName, [product, version, extra].filter(Boolean).join(' ')].filter(Boolean).join(' – ');
    return { id: 'nmap:' + (ip || hostname) + ':' + port, title: 'Offener Port ' + port + (svc ? ' (' + svc + ')' : '') + (state !== 'open' ? ' [' + state + ']' : ''),
      severity: 'info', host: ip || hostname, port: port, service: svcName || '', product: [product, version].filter(Boolean).join(' '), portState: state,
      desc: scripts || '', solution: NMAP_SOLUTION };
  }

  /** Nmap XML (-oX) */
  function parseNmapXml(doc) {
    var root = doc.documentElement;
    var res = { kind: 'scan', tool: 'nmap', scanDate: toIso(root.getAttribute('start')), hosts: [], findings: [],
      meta: { args: root.getAttribute('args') || '', version: root.getAttribute('version') || '', hostsDown: 0 } };
    els(doc, 'host').forEach(function (h) {
      var st = child(h, 'status'); if (st && st.getAttribute('state') === 'down') { res.meta.hostsDown++; return; }
      var ip = ''; els(h, 'address').forEach(function (a) { if (/ipv4|ipv6/.test(a.getAttribute('addrtype')) && !ip) ip = a.getAttribute('addr'); });
      var hn = els(h, 'hostname')[0]; var hostname = hn ? hn.getAttribute('name') : '';
      var osm = els(h, 'osmatch')[0];
      res.hosts.push({ ip: ip, hostname: hostname, os: osm ? osm.getAttribute('name') : '' });
      els(h, 'port').forEach(function (p) {
        var state = child(p, 'state'); var sv = state ? state.getAttribute('state') : '';
        if (sv !== 'open' && sv !== 'open|filtered') return;
        var svc = child(p, 'service') || { getAttribute: function () { return ''; } };
        var scripts = els(p, 'script').map(function (s) { return s.getAttribute('id') + ': ' + clip(s.getAttribute('output'), 300); }).join('\n');
        res.findings.push(nmapFinding(ip, hostname, p.getAttribute('portid'), p.getAttribute('protocol'), sv,
          svc.getAttribute('name'), svc.getAttribute('product'), svc.getAttribute('version'), svc.getAttribute('extrainfo'), scripts));
      });
    });
    return res;
  }

  /** Nmap grepable (-oG) */
  function parseNmapGrep(text) {
    var res = { kind: 'scan', tool: 'nmap', scanDate: '', hosts: [], findings: [], meta: {} };
    var m = text.match(/scan initiated (.+?) as:/); if (m) res.scanDate = toIso(m[1]);
    text.split(/\r?\n/).forEach(function (line) {
      var hm = line.match(/^Host:\s+(\S+)\s+\(([^)]*)\)/); if (!hm) return;
      var ip = hm[1], hostname = hm[2];
      if (/Status: Down/.test(line)) return;
      if (!res.hosts.some(function (h) { return h.ip === ip; })) res.hosts.push({ ip: ip, hostname: hostname });
      var pm = line.match(/Ports:\s+([^\t]+)/); if (!pm) return;
      pm[1].split(/,\s*/).forEach(function (p) {
        var f = p.split('/'); if (f[1] !== 'open' && f[1] !== 'open|filtered') return;
        res.findings.push(nmapFinding(ip, hostname, f[0], f[2], f[1], f[4], f[6], '', '', ''));
      });
    });
    return res;
  }

  /** Nmap Normalausgabe (-oN bzw. kopierte Bildschirmausgabe) */
  function parseNmapNormal(text) {
    var res = { kind: 'scan', tool: 'nmap', scanDate: '', hosts: [], findings: [], meta: { format: '-oN' } };
    var m = text.match(/scan initiated (.+?) as:/) || text.match(/Starting Nmap .*? at (\d{4}-\d{2}-\d{2} \d{2}:\d{2})/);
    if (m) res.scanDate = toIso(m[1]);
    var cur = null;
    text.split(/\r?\n/).forEach(function (line) {
      var hm = line.match(/^Nmap scan report for (.+?)(?: \(([^)]+)\))?\s*$/);
      if (hm) {
        var a = hm[1], b = hm[2];
        cur = b ? { ip: b, hostname: a } : (/^[\d.:a-f]+$/i.test(a) ? { ip: a, hostname: '' } : { ip: '', hostname: a });
        res.hosts.push(cur); return;
      }
      var pm = line.match(/^(\d+)\/(tcp|udp|sctp)\s+(open(?:\|filtered)?)\s+(\S+)(?:\s+(.*))?$/);
      if (pm && cur) res.findings.push(nmapFinding(cur.ip, cur.hostname, pm[1], pm[2], pm[3], pm[4], (pm[5] || '').trim(), '', '', ''));
    });
    return res;
  }

  /** Lynis report.dat (key=value) */
  function parseLynisDat(text) {
    var kv = {}, warnings = [], suggestions = [];
    text.split(/\r?\n/).forEach(function (line) {
      if (!line || line[0] === '#') return;
      var i = line.indexOf('='); if (i < 0) return;
      var k = line.slice(0, i), v = line.slice(i + 1);
      if (k === 'warning[]') warnings.push(v);
      else if (k === 'suggestion[]') suggestions.push(v);
      else if (/\[\]$/.test(k)) { (kv[k] = kv[k] || []).push(v); }
      else kv[k] = v;
    });
    var ips = (kv['network_ipv4_address[]'] || []).filter(function (ip) { return ip !== '127.0.0.1'; });
    var res = { kind: 'scan', tool: 'lynis', scanDate: toIso(kv.report_datetime_end || kv.report_datetime_start),
      hosts: [{ ip: ips[0] || '', hostname: kv.hostname || '', os: [kv.os_name, kv.os_version].filter(Boolean).join(' ') }],
      findings: [], meta: { hardeningIndex: kv.hardening_index ? parseInt(kv.hardening_index, 10) : null, lynisVersion: kv.lynis_version || '', testsPerformed: kv.lynis_tests_done || '' } };
    function add(entry, sev) {
      var f = entry.split('|'); var test = f[0] || '';
      res.findings.push({ id: 'lynis:' + test + ':' + clip(f[1], 40), ref: test, title: f[1] || test, severity: sev, host: res.hosts[0].hostname,
        desc: f[2] && f[2] !== '-' ? f[2] : '', solution: f[3] && f[3] !== '-' ? f[3] : '', topic: lynisTopic(test), lynis: sev === 'high' ? 'warning' : 'suggestion' });
    }
    warnings.forEach(function (w) { add(w, 'high'); });
    suggestions.forEach(function (s) { add(s, 'low'); });
    return res;
  }

  /** Lynis lynis.log (Textprotokoll) */
  function parseLynisLog(text) {
    var res = { kind: 'scan', tool: 'lynis', scanDate: '', hosts: [{ ip: '', hostname: '' }], findings: [], meta: { hardeningIndex: null } };
    var first = text.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/m); if (first) res.scanDate = toIso(first[1]);
    var hi = text.match(/Hardening index\s*:\s*\[?(\d+)/i); if (hi) res.meta.hardeningIndex = parseInt(hi[1], 10);
    var hn = text.match(/Hostname:\s*(\S+)/); if (hn) res.hosts[0].hostname = hn[1];
    text.split(/\r?\n/).forEach(function (line) {
      var m = line.match(/(Warning|Suggestion):\s*(.+?)\s*\[test:([^\]]+)\](?:\s*\[details:([^\]]*)\])?(?:\s*\[solution:([^\]]*)\])?/);
      if (!m) return;
      res.findings.push({ id: 'lynis:' + m[3] + ':' + clip(m[2], 40), ref: m[3], title: m[2], severity: m[1] === 'Warning' ? 'high' : 'low',
        host: res.hosts[0].hostname, desc: m[4] && m[4] !== '-' ? m[4] : '', solution: m[5] && m[5] !== '-' ? m[5] : '', topic: lynisTopic(m[3]),
        lynis: m[1] === 'Warning' ? 'warning' : 'suggestion' });
    });
    return res;
  }

  /** OpenVAS / Greenbone XML-Bericht */
  function parseOpenvasXml(doc) {
    var res = { kind: 'scan', tool: 'openvas', scanDate: '', hosts: [], findings: [], meta: {} };
    var start = els(doc, 'scan_start')[0] || els(doc, 'creation_time')[0] || els(doc, 'timestamp')[0];
    if (start) res.scanDate = toIso(start.textContent.trim());
    var end = els(doc, 'scan_end')[0]; if (end && end.textContent.trim()) res.meta.scanEnd = toIso(end.textContent.trim());
    var task = els(doc, 'task')[0]; if (task) res.meta.task = childText(task, 'name');
    var seen = {};
    els(doc, 'result').forEach(function (r) {
      var nvt = child(r, 'nvt'); if (!nvt) return;
      var hostEl = child(r, 'host');
      var ip = hostEl ? (hostEl.firstChild && hostEl.firstChild.nodeValue || '').trim() : '';
      var hostname = hostEl ? childText(hostEl, 'hostname') : '';
      if (ip && !seen[ip]) { seen[ip] = 1; res.hosts.push({ ip: ip, hostname: hostname }); }
      var cves = els(nvt, 'ref').filter(function (x) { return (x.getAttribute('type') || '').toLowerCase() === 'cve'; }).map(function (x) { return x.getAttribute('id'); });
      var tags = childText(nvt, 'tags'); var tagSol = (tags.match(/solution=([^|]*)/) || [])[1] || '';
      var severity = childText(r, 'severity') || childText(nvt, 'cvss_base');
      var sev = normSeverity(severity);
      if (sev === 'info' && /log|debug/i.test(childText(r, 'threat'))) sev = 'info';
      res.findings.push({ id: 'ov:' + (nvt.getAttribute('oid') || childText(r, 'name')) + ':' + ip + ':' + childText(r, 'port'),
        title: childText(r, 'name') || childText(nvt, 'name'), severity: sev, cvss: severity, host: ip || hostname, port: childText(r, 'port'),
        cve: cves.join(', '), desc: clip(childText(r, 'description') || (tags.match(/summary=([^|]*)/) || [])[1], 600),
        solution: clip(childText(nvt, 'solution') || tagSol, 400), ref: nvt.getAttribute('oid') || '' });
    });
    return res;
  }

  /** OpenVAS / Greenbone CSV-Ergebnisexport */
  function parseOpenvasCsv(csv) {
    var h = csv.headers;
    var cIp = col(h, ['ip']), cHost = col(h, ['hostname']), cPort = col(h, ['port']), cProto = col(h, ['port protocol']),
      cCvss = col(h, ['cvss']), cSev = col(h, ['severity']), cName = col(h, ['nvt name', 'name']), cSum = col(h, ['summary']),
      cSol = col(h, ['solution']), cCve = col(h, ['cves', 'cve']), cTs = col(h, ['timestamp']), cOid = col(h, ['nvt oid', 'oid']);
    var res = { kind: 'scan', tool: 'openvas', scanDate: '', hosts: [], findings: [], meta: {} };
    var seen = {};
    csv.rows.forEach(function (r) {
      var ip = r[cIp] || ''; if (ip && !seen[ip]) { seen[ip] = 1; res.hosts.push({ ip: ip, hostname: r[cHost] || '' }); }
      if (cTs && r[cTs] && !res.scanDate) res.scanDate = toIso(r[cTs]);
      var port = (r[cPort] || '') + (r[cProto] ? '/' + r[cProto] : '');
      res.findings.push({ id: 'ov:' + (r[cOid] || r[cName]) + ':' + ip + ':' + port, title: r[cName] || '?', severity: normSeverity(r[cCvss] || r[cSev]),
        cvss: r[cCvss] || '', host: ip, port: port, cve: r[cCve] || '', desc: clip(r[cSum], 600), solution: clip(r[cSol], 400), ref: r[cOid] || '' });
    });
    return res;
  }

  /** OpenSCAP-Ergebnis (XCCDF TestResult oder ARF) */
  function parseOscapResults(doc) {
    var tr = els(doc, 'TestResult')[0];
    var titles = {}, sevs = {};
    els(doc, 'Rule').forEach(function (r) { titles[r.getAttribute('id')] = childText(r, 'title'); sevs[r.getAttribute('id')] = r.getAttribute('severity'); });
    var res = { kind: 'scan', tool: 'oscap', scanDate: toIso(tr.getAttribute('end-time') || tr.getAttribute('start-time')), hosts: [], findings: [],
      meta: { profile: (child(tr, 'profile') || { getAttribute: function () { return ''; } }).getAttribute('idref') || '', benchmark: (child(tr, 'benchmark') || { getAttribute: function () { return ''; } }).getAttribute('id') || '', ruleResults: [], pass: 0, fail: 0 } };
    var target = childText(tr, 'target');
    var addrs = els(tr, 'target-address').map(function (a) { return a.textContent.trim(); }).filter(function (a) { return a && !/^(127\.|::1|0:0:0)/.test(a); });
    res.hosts.push({ ip: addrs[0] || '', hostname: target });
    els(tr, 'rule-result').forEach(function (rr) {
      var id = rr.getAttribute('idref'); var result = childText(rr, 'result');
      res.meta.ruleResults.push({ rule: shortRule(id), result: result });
      if (result === 'pass') res.meta.pass++;
      if (result === 'fail' || result === 'error') {
        res.meta.fail++;
        res.findings.push({ id: 'oscap:' + shortRule(id), ref: shortRule(id), title: titles[id] || shortRule(id), severity: normSeverity(rr.getAttribute('severity') || sevs[id]),
          host: target, desc: 'OpenSCAP: ' + result, solution: '' });
      }
    });
    return res;
  }

  /* ------------------------------------------------------------------
   * Katalog-Parser
   * ---------------------------------------------------------------- */

  /** XCCDF-Benchmark bzw. SSG-Datastream → Regeln + Profile */
  function parseXccdfCatalog(doc, fileName) {
    var bench = els(doc, 'Benchmark')[0];
    var title = bench ? childText(bench, 'title') : fileName;
    var version = bench ? childText(bench, 'version') : '';
    var rules = els(doc, 'Rule').map(function (r) {
      var id = r.getAttribute('id'); var ref = shortRule(id);
      var desc = child(r, 'description');
      var idents = els(r, 'ident').map(function (i) { return i.textContent.trim(); }).filter(Boolean);
      return { ref: ref, fullId: id, title: { de: childText(r, 'title'), en: childText(r, 'title') }, desc: { de: clip(desc ? desc.textContent : '', 500) },
        severity: r.getAttribute('severity') || 'unknown', topic: guessTopic(ref, childText(r, 'title')), idents: idents.slice(0, 3) };
    });
    var profiles = els(doc, 'Profile').map(function (p) {
      var sel = els(p, 'select').filter(function (s) { return s.getAttribute('selected') === 'true'; }).map(function (s) { return s.getAttribute('idref'); });
      return { id: p.getAttribute('id'), title: childText(p, 'title') || p.getAttribute('id'), ruleIds: sel };
    });
    // Nur Regeln zählen (Profile können auch Gruppen auswählen)
    var ruleSet = {}; rules.forEach(function (r) { ruleSet[r.fullId] = 1; });
    profiles.forEach(function (p) { p.ruleIds = p.ruleIds.filter(function (id) { return ruleSet[id]; }); p.count = p.ruleIds.length; });
    return { kind: 'xccdf', benchmark: { title: title, version: version }, rules: rules, profiles: profiles };
  }

  /** OSCAL-Katalog (JSON-Objekt) → Maßnahmen (Grundschutz++ u. a.) */
  function oscalFromJson(obj, fileName) {
    var cat = obj.catalog || obj;
    var meta = cat.metadata || {};
    var items = [];
    function prose(parts) {
      var out = [];
      (parts || []).forEach(function (p) {
        if (p.name === 'guidance' || p.name === 'assessment-objective') return;
        if (p.prose) out.push(p.prose);
        if (p.parts) out.push(prose(p.parts));
      });
      return out.join(' ');
    }
    function walkControls(ctrls, groupTitle) {
      (ctrls || []).forEach(function (c) {
        var props = c.props || [];
        var label = (props.find(function (p) { return p.name === 'label' || p.name === 'alt-identifier'; }) || {}).value || c.id;
        var text = prose(c.parts);
        items.push(oscalItem(c.id, label, c.title, text, props.map(function (p) { return [p.name, p.value]; }), groupTitle));
        walkControls(c.controls, groupTitle);
      });
    }
    function walkGroups(groups, parentTitle) {
      (groups || []).forEach(function (g) {
        var t = (parentTitle ? parentTitle + ' › ' : '') + (g.title || g.id);
        walkControls(g.controls, t);
        walkGroups(g.groups, t);
      });
    }
    walkGroups(cat.groups, '');
    walkControls(cat.controls, '');
    return { title: meta.title || fileName, version: meta.version || meta['last-modified'] || '', items: items };
  }

  /** OSCAL-Katalog (XML) → gleiche Struktur wie JSON */
  function oscalFromXml(doc, fileName) {
    var meta = els(doc, 'metadata')[0];
    var items = [];
    els(doc, 'control').forEach(function (c) {
      var props = Array.prototype.slice.call(c.children).filter(function (n) { return n.localName === 'prop'; })
        .map(function (p) { return [p.getAttribute('name'), p.getAttribute('value')]; });
      var label = (props.find(function (p) { return p[0] === 'label' || p[0] === 'alt-identifier'; }) || [])[1] || c.getAttribute('id');
      var parts = Array.prototype.slice.call(c.children).filter(function (n) { return n.localName === 'part' && n.getAttribute('name') !== 'guidance'; });
      var g = c.parentElement && c.parentElement.localName === 'group' ? childText(c.parentElement, 'title') : '';
      items.push(oscalItem(c.getAttribute('id'), label, childText(c, 'title'), parts.map(function (p) { return p.textContent; }).join(' '), props, g));
    });
    return { title: meta ? childText(meta, 'title') : fileName, version: meta ? (childText(meta, 'version') || childText(meta, 'last-modified')) : '', items: items };
  }

  /** Einzelne OSCAL-Anforderung in das interne Format überführen. */
  function oscalItem(id, label, title, text, props, groupTitle) {
    var level = 'S', effort = null, modal = '';
    props.forEach(function (p) {
      var n = (p[0] || '').toLowerCase(), v = String(p[1] || '');
      if (/erh(ö|oe)ht|elevated|high/i.test(v) && /level|niveau|sec|schutz|security/.test(n)) level = 'H';
      if (/effort|aufwand/.test(n) && !isNaN(parseInt(v, 10))) effort = parseInt(v, 10);
      if (/modal|verb|handlungswort/.test(n)) modal = v;
    });
    if (!modal) { var m = (text || '').match(/\b(MUSS|MÜSSEN|DARF NICHT|DÜRFEN NICHT|SOLLTE|SOLLTEN|KANN|KÖNNEN)\b/); if (m) modal = m[1]; }
    return { ref: label, oscalId: id, title: { de: title || label, en: title || label }, desc: { de: clip(text, 600) }, level: level, effort: effort, modal: modal,
      topic: guessTopic(label, (groupTitle || '') + ' ' + title + ' ' + (text || '').slice(0, 200)), group: groupTitle || '', os: ['windows', 'linux', 'macos'], role: 'any' };
  }

  /** BSI-Kompendium (XML-/Text-Version) per Mustererkennung einlesen. */
  function parseBsiText(text) {
    var re = /\b((?:ISMS|ORP|CON|OPS|DER|APP|SYS|IND|NET|INF)(?:\.\d+)+\.A\d+)\s+([^\n<>()]{3,220}?)\s*(?:\[[^\]]{1,80}\]\s*)?\((B|S|H)\)/g;
    var seen = {}, items = [], m;
    while ((m = re.exec(text))) {
      var ref = m[1], title = m[2].trim();
      if (seen[ref] || /ENTFALLEN/i.test(title)) continue;
      seen[ref] = 1;
      var os = ['windows', 'linux', 'macos'], role = 'any';
      if (/^SYS\.1\.2|^SYS\.2\.2/.test(ref)) os = ['windows'];
      if (/^SYS\.1\.3|^SYS\.2\.3/.test(ref)) os = ['linux'];
      if (/^SYS\.2\.4/.test(ref)) os = ['macos'];
      if (/^SYS\.1\./.test(ref)) role = 'server';
      if (/^SYS\.2\./.test(ref)) role = 'client';
      items.push({ ref: ref, title: { de: title, en: title }, desc: { de: '' }, level: m[3], os: os, role: role, group: ref.replace(/\.A\d+$/, ''), topic: guessTopic(ref, title) });
    }
    return items;
  }

  /* ------------------------------------------------------------------
   * CSV-Varianten
   * ---------------------------------------------------------------- */
  function csvKind(csv) {
    var h = csv.headers.map(function (x) { return x.toLowerCase(); });
    var has = function (re) { return h.some(function (x) { return re.test(x); }); };
    if (has(/^nvt name$|^nvt oid$/)) return 'openvas';
    if (has(/^(hostname|host|name|asset)$/) && has(/^(ip|ip-adresse|ip address|os|betriebssystem|operating system)$/) && !has(/severity|cvss|risk|schwere/)) return 'assets';
    if (has(/^(id|ref|anforderung|requirement)$/) && has(/^(title|titel|maßnahme|massnahme|measure)$/)) return 'catalog';
    return 'findings';
  }
  function csvAssets(csv) {
    var h = csv.headers;
    var cName = col(h, ['name', 'asset', 'hostname', 'host']), cHost = col(h, ['hostname', 'fqdn', 'host']), cIp = col(h, ['ip', 'ip-adresse', 'ip address']),
      cOs = col(h, ['os', 'betriebssystem', 'operating system']), cOwner = col(h, ['owner', 'verantwortlich', 'responsible']), cLoc = col(h, ['location', 'standort']),
      cDesc = col(h, ['description', 'beschreibung', 'zweck']);
    return { kind: 'assets', assets: csv.rows.filter(function (r) { return r[cName] || r[cHost]; }).map(function (r) {
      var os = guessOs(r[cOs]) || 'linux-other';
      return { name: r[cName] || r[cHost], hostname: r[cHost] || '', ip: r[cIp] || '', os: os, osVersion: r[cOs] || '', owner: r[cOwner] || '', location: r[cLoc] || '', description: r[cDesc] || '' };
    }) };
  }
  function csvCatalog(csv, fileName) {
    var h = csv.headers;
    var cId = col(h, ['id', 'ref', 'anforderung', 'requirement']), cT = col(h, ['title', 'titel', 'maßnahme', 'massnahme', 'measure']),
      cD = col(h, ['description', 'beschreibung', 'text']), cL = col(h, ['level', 'niveau', 'stufe']), cOs = col(h, ['os', 'betriebssystem', 'plattform']),
      cTopic = col(h, ['topic', 'thema']), cCheck = col(h, ['check', 'prüfung', 'pruefung', 'audit']);
    var items = csv.rows.filter(function (r) { return r[cId] || r[cT]; }).map(function (r, i) {
      var lv = (r[cL] || 'S').toUpperCase().charAt(0); if ('BSH'.indexOf(lv) < 0) lv = 'S';
      var osTxt = (r[cOs] || '').toLowerCase();
      var os = []; if (/win/.test(osTxt)) os.push('windows'); if (/linux|unix|debian|ubuntu|rhel|fedora/.test(osTxt)) os.push('linux'); if (/mac/.test(osTxt)) os.push('macos');
      if (!os.length) os = ['windows', 'linux', 'macos'];
      var fam = os.length === 1 ? os[0] : 'linux';
      var check = r[cCheck] ? {} : null; if (check) check[fam] = r[cCheck];
      return { ref: r[cId] || ('CSV-' + (i + 1)), title: { de: r[cT] || r[cId], en: r[cT] || r[cId] }, desc: { de: r[cD] || '' }, level: lv, os: os, role: 'any',
        topic: r[cTopic] && HA.TOPICS.some(function (t) { return t.id === r[cTopic]; }) ? r[cTopic] : guessTopic(r[cId], r[cT]), check: check, group: fileName };
    });
    return { kind: 'catalog', catalog: { name: fileName.replace(/\.[^.]+$/, ''), libKind: 'csv', version: '', items: items } };
  }
  function csvFindings(csv) {
    var h = csv.headers;
    var cT = col(h, ['name', 'title', 'titel', 'finding', 'befund', 'check', 'description']), cS = col(h, ['severity', 'risk', 'schwere', 'cvss']),
      cH = col(h, ['host', 'ip', 'hostname', 'computer']), cD = col(h, ['description', 'details', 'beschreibung', 'result']),
      cR = col(h, ['recommended', 'solution', 'lösung', 'empfehlung', 'remediation']), cId = col(h, ['id']), cRes = col(h, ['result', 'status']);
    var res = { kind: 'scan', tool: 'generic', scanDate: '', hosts: [], findings: [], meta: {} };
    var seen = {};
    csv.rows.forEach(function (r, i) {
      var sevRaw = r[cS] || '';
      if (/^passed$/i.test(sevRaw) || /^(pass|passed|ok|compliant)$/i.test(r[cRes] || '')) return; // bestandene Prüfungen überspringen
      var host = r[cH] || ''; if (host && !seen[host]) { seen[host] = 1; res.hosts.push({ ip: /^\d+\.\d+\.\d+\.\d+$/.test(host) ? host : '', hostname: host }); }
      res.findings.push({ id: 'csv:' + (r[cId] || i) + ':' + clip(r[cT], 30), ref: r[cId] || '', title: r[cT] || ('#' + (i + 1)), severity: normSeverity(sevRaw), host: host,
        desc: cD !== cT ? clip(r[cD], 500) : '', solution: clip(r[cR], 300) });
    });
    return res;
  }

  /* ------------------------------------------------------------------
   * Hauptfunktion: Dateityp erkennen und passenden Parser aufrufen
   * ---------------------------------------------------------------- */
  function detectAndParse(text, fileName, forced) {
    var lower = fileName.toLowerCase();
    var trimmed = text.replace(/^﻿/, '').trim();

    // --- JSON ---
    if (forced === 'json' || (!forced && (lower.endsWith('.json') || /^[{[]/.test(trimmed)))) {
      var obj = JSON.parse(trimmed);
      if (obj && obj.app === 'hardening-audit' && Array.isArray(obj.assets)) return { kind: 'state', state: obj };
      if (obj && (obj.catalog || (obj.metadata && (obj.groups || obj.controls)))) {
        var oc = oscalFromJson(obj, fileName);
        return { kind: 'catalog', catalog: { name: oc.title, libKind: /grundschutz/i.test(oc.title) ? 'gspp' : 'oscal', version: oc.version, items: oc.items } };
      }
      if (Array.isArray(obj)) {
        return { kind: 'catalog', catalog: { name: fileName.replace(/\.[^.]+$/, ''), libKind: 'json', version: '', items: obj.map(function (o, i) {
          return { ref: o.ref || o.id || ('JSON-' + (i + 1)), title: typeof o.title === 'object' ? o.title : { de: o.title || o.ref, en: o.title || o.ref },
            desc: typeof o.desc === 'object' ? o.desc : { de: o.desc || o.description || '' }, level: o.level || 'S', os: o.os || ['windows', 'linux', 'macos'],
            role: o.role || 'any', topic: o.topic || guessTopic(o.ref, o.title), check: o.check || null, group: o.group || '' };
        }) } };
      }
      throw new Error('Unbekannte JSON-Struktur');
    }

    // Nmap ausgewählt, aber keine XML-Datei → Text-Varianten probieren
    if (forced === 'nmap' && trimmed.charAt(0) !== '<') forced = /^Host: /m.test(trimmed) ? 'nmapgrep' : 'nmapnormal';

    // --- XML ---
    if (forced === 'xml' || forced === 'nmap' || forced === 'openvas' || forced === 'oscap' || forced === 'xccdf' || forced === 'bsi' ||
        (!forced && trimmed.charAt(0) === '<')) {
      if (forced === 'bsi') return bsiResult(trimmed, fileName);
      var doc = parseXml(trimmed);
      var root = doc.documentElement.localName;
      if (forced === 'nmap' || root === 'nmaprun') return parseNmapXml(doc);
      if (forced === 'openvas' || ((root === 'report' || root === 'get_reports_response') && els(doc, 'nvt').length)) return parseOpenvasXml(doc);
      if (forced === 'oscap' || els(doc, 'TestResult').length) return parseOscapResults(doc);
      if (forced === 'xccdf' || root === 'data-stream-collection' || root === 'Benchmark' || els(doc, 'Benchmark').length) return parseXccdfCatalog(doc, fileName);
      if (root === 'catalog') {
        var ox = oscalFromXml(doc, fileName);
        return { kind: 'catalog', catalog: { name: ox.title, libKind: /grundschutz/i.test(ox.title) ? 'gspp' : 'oscal', version: ox.version, items: ox.items } };
      }
      var bsi = bsiResult(doc.documentElement.textContent, fileName, true);
      if (bsi) return bsi;
      return { kind: 'evidence', note: 'XML <' + root + '>' };
    }

    // --- Lynis ---
    if (forced === 'lynis' || /^(# Lynis Report|report_version=|lynis_version=)/m.test(trimmed.slice(0, 2000)) || /hardening_index=/.test(trimmed)) {
      if (/\[test:/.test(trimmed) && !/=/.test(trimmed.split('\n')[0])) return parseLynisLog(trimmed);
      return parseLynisDat(trimmed);
    }
    if (/Starting Lynis|\[test:[A-Z]+-\d+\]/.test(trimmed.slice(0, 50000))) return parseLynisLog(trimmed);

    // --- Nmap grepable (-oG) bzw. Normalausgabe (-oN) ---
    if (forced === 'nmapgrep' || (/^# Nmap .* scan initiated/m.test(trimmed) && /^Host: \S+ \(/m.test(trimmed))) return parseNmapGrep(trimmed);
    if (forced === 'nmapnormal' || /^Nmap scan report for /m.test(trimmed)) return parseNmapNormal(trimmed);

    // --- CSV ---
    if (forced && forced.indexOf('csv') === 0 || lower.endsWith('.csv') || /[,;\t]/.test(trimmed.split('\n')[0])) {
      var csv = parseCsv(trimmed);
      var k = forced === 'csv-assets' ? 'assets' : forced === 'csv-catalog' ? 'catalog' : forced === 'csv-findings' ? 'findings' : csvKind(csv);
      if (k === 'openvas') return parseOpenvasCsv(csv);
      if (k === 'assets') return csvAssets(csv);
      if (k === 'catalog') return csvCatalog(csv, fileName);
      return csvFindings(csv);
    }

    // --- BSI-Text ---
    var b = bsiResult(trimmed, fileName, true);
    if (b) return b;

    // --- DAT (key=value) als Nachweis ---
    return { kind: 'evidence', note: (trimmed.split(/\r?\n/).length) + ' Zeilen' };
  }

  function bsiResult(text, fileName, optional) {
    var items = parseBsiText(text);
    if (!items.length && optional) return null;
    return { kind: 'catalog', catalog: { name: 'BSI-Kompendium (Import: ' + fileName + ')', libKind: 'bsi-import', version: '', items: items } };
  }

  /** Öffentliche API: Datei einlesen, Prüfsumme bilden, parsen. */
  function parseFile(file, forced) {
    return file.arrayBuffer().then(function (buf) {
      return sha256(buf).then(function (hash) {
        var text = new TextDecoder('utf-8').decode(buf);
        var res = detectAndParse(text, file.name, forced || '');
        res.file = { name: file.name, size: file.size, sha256: hash, lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : '' };
        return res;
      });
    });
  }

  return { parseFile: parseFile, detectAndParse: detectAndParse, parseCsv: parseCsv, normSeverity: normSeverity, guessOs: guessOs, guessTopic: guessTopic, sha256: sha256, sha256Fallback: sha256Fallback, lynisTopic: lynisTopic };
})();

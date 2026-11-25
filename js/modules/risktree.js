/* =====================================================================
 * modules/risktree.js – IT-Risikobaum (Fehlerbaum / Angriffsbaum)
 * ---------------------------------------------------------------------
 * Fehlerbaum (Fault Tree): Ein unerwünschtes Top-Ereignis wird über
 *   UND-/ODER-Verknüpfungen auf Basisereignisse zurückgeführt.
 *   ODER: P = 1 − Π(1 − pᵢ)   UND: P = Π pᵢ   (Ereignisse als unabhängig angenommen)
 * Angriffsbaum (Attack Tree): gleiche Struktur, Blätter sind Angriffs-
 *   schritte; zusätzlich Kosten (€) und benötigtes Können (1–5):
 *   ODER: günstigster Weg (Minimum), UND: Kosten addieren, Können = Maximum.
 * Gegenmaßnahmen je Basisereignis (Status + Wirksamkeit) ergeben die
 *   Restwahrscheinlichkeit. Auswertung: Wahrscheinlichkeit des Top-
 *   Ereignisses brutto/netto, kritischer Pfad, minimale Schnittmengen
 *   (Minimal Cut Sets, inkl. Single Points of Failure) und Bedeutung
 *   der Basisereignisse (Fussell-Vesely-Näherung) → „Wo ansetzen?“.
 * Übernahme der Wahrscheinlichkeit ins Risikoregister (Monte-Carlo).
 * Datenmodell: state.trees = { seq, items:[{ id, name, kind, desc, registerId,
 *   root:{ id, label, type:'or'|'and'|'leaf', p, cost, skill, cm, cmStatus, cmEff, refs, note, children[] } }] }
 * ===================================================================== */
window.HA = window.HA || {};

HA.RiskTree = (function () {
  'use strict';
  var A = HA.App, K = HA.Kit, L = K.L, esc = A.esc, t = HA.t;
  var U = { id: null, sel: null, zoom: 1, fit: true };   // fit = beim Öffnen an die Breite anpassen
  K.addI18n({ 'nav.risktree': 'Risikobaum' }, { 'nav.risktree': 'Risk tree' });
  function S() { return A.state(); }
  function T() { return S().trees; }
  function cur() { return T().items.find(function (x) { return x.id === U.id; }) || T().items[0] || null; }
  function nid() { return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function num(v) { return v === '' || v === null || v === undefined || isNaN(v) ? null : +v; }

  A.ext.normalize.push(function (s) {
    s.trees = s.trees || {}; if (!Array.isArray(s.trees.items)) s.trees.items = []; s.trees.seq = s.trees.seq || (s.trees.items.length + 1);
    s.trees.items.forEach(function (tr) { walk(tr.root, function (n) { if (!n.id) n.id = nid(); if (!Array.isArray(n.children)) n.children = []; if (!n.type) n.type = n.children.length ? 'or' : 'leaf'; }); });
  });
  function walk(n, fn, parent) { if (!n) return; fn(n, parent); (n.children || []).forEach(function (c) { walk(c, fn, n); }); }
  function find(root, id) { var r = null, par = null; walk(root, function (n, p) { if (n.id === id) { r = n; par = p; } }); return r ? { node: r, parent: par } : null; }
  function mk(label, type, extra, children) { return Object.assign({ id: nid(), label: label, type: type, p: '', cost: '', skill: '', cm: '', cmStatus: 'none', cmEff: 70, refs: '', note: '', children: children || [] }, extra || {}); }

  /* ------------------------------------------------------------------
   * Vorlagen
   * ---------------------------------------------------------------- */
  function templates() {
    return [
      { key: 'ransom', kind: 'fault', name: L('Datenverlust durch Ransomware', 'Data loss through ransomware'), desc: L('Daten sind verschlüsselt und können nicht rechtzeitig wiederhergestellt werden.', 'Data is encrypted and cannot be restored in time.'),
        root: mk(L('Datenverlust durch Ransomware', 'Data loss through ransomware'), 'and', {}, [
          mk(L('Schadsoftware gelangt ins Netz', 'Malware enters the network'), 'or', {}, [
            mk(L('Phishing-Mail mit schädlichem Anhang', 'Phishing mail with malicious attachment'), 'leaf', { p: 0.3, cost: 500, skill: 2, cm: L('Awareness-Schulung, Makros blockieren, Mail-Filter', 'Awareness training, block macros, mail filter'), cmStatus: 'partial' }),
            mk(L('Ausnutzung einer VPN-/Firewall-Schwachstelle', 'Exploit of a VPN/firewall vulnerability'), 'leaf', { p: 0.1, cost: 5000, skill: 4, cm: L('Patchmanagement < 72 h für Perimeter', 'Patch management < 72 h for perimeter'), cmStatus: 'planned' }),
            mk(L('Gestohlene Zugangsdaten (RDP/VPN ohne MFA)', 'Stolen credentials (RDP/VPN without MFA)'), 'leaf', { p: 0.08, cost: 200, skill: 1, cm: L('MFA für alle Fernzugänge', 'MFA for all remote access'), cmStatus: 'none' })]),
          mk(L('Ausbreitung und Rechteausweitung', 'Lateral movement and privilege escalation'), 'or', {}, [
            mk(L('Lokale Admin-Passwörter identisch', 'Identical local admin passwords'), 'leaf', { p: 0.4, cost: 0, skill: 2, cm: 'Windows LAPS', cmStatus: 'none' }),
            mk(L('Ungepatchte Schwachstelle auf Servern', 'Unpatched server vulnerability'), 'leaf', { p: 0.3, cost: 1000, skill: 3, cm: L('Monatliche Patch-Zyklen, OpenVAS-Scans', 'Monthly patch cycles, OpenVAS scans'), cmStatus: 'partial' })]),
          mk(L('Wiederherstellung schlägt fehl', 'Restore fails'), 'or', {}, [
            mk(L('Backups vom Netz aus erreichbar und mitverschlüsselt', 'Backups reachable and encrypted too'), 'leaf', { p: 0.3, cm: L('Offline-/Immutable-Backup (3-2-1-1)', 'Offline/immutable backup (3-2-1-1)'), cmStatus: 'planned' }),
            mk(L('Wiederherstellung nie getestet', 'Restore never tested'), 'leaf', { p: 0.25, cm: L('Quartalsweiser Restore-Test', 'Quarterly restore test'), cmStatus: 'none' })])]) },
      { key: 'shop', kind: 'fault', name: L('Ausfall Webshop > RTO', 'Web shop outage > RTO'), desc: L('Der Webshop ist länger als die geforderte Wiederanlaufzeit nicht erreichbar.', 'The web shop is unavailable longer than the RTO.'),
        root: mk(L('Ausfall Webshop länger als RTO', 'Web shop outage longer than RTO'), 'or', {}, [
          mk(L('Serverausfall ohne Ersatz', 'Server failure without replacement'), 'and', {}, [
            mk(L('Hardware-/Hosting-Defekt', 'Hardware/hosting defect'), 'leaf', { p: 0.1 }),
            mk(L('Kein Failover/Standby vorhanden', 'No failover/standby'), 'leaf', { p: 0.9, cm: L('Warm-Standby beim Zweitanbieter', 'Warm standby at second provider'), cmStatus: 'planned', cmEff: 80 })]),
          mk(L('DDoS-Angriff', 'DDoS attack'), 'leaf', { p: 0.08, cm: L('DDoS-Schutz des Providers', 'Provider DDoS protection'), cmStatus: 'done', cmEff: 60 }),
          mk(L('Fehlerhaftes Update ohne Rollback', 'Faulty update without rollback'), 'leaf', { p: 0.15, cm: L('Staging + Rollback-Plan', 'Staging + rollback plan'), cmStatus: 'partial' }),
          mk(L('TLS-Zertifikat abgelaufen', 'TLS certificate expired'), 'leaf', { p: 0.05, cm: L('Automatische Erneuerung + Monitoring', 'Auto renewal + monitoring'), cmStatus: 'done', cmEff: 90 })]) },
      { key: 'admin', kind: 'attack', name: L('Übernahme eines Admin-Kontos', 'Takeover of an admin account'), desc: L('Angreifende erlangen administrative Rechte in der Webanwendung.', 'Attackers obtain administrative rights in the web application.'),
        root: mk(L('Admin-Konto übernommen', 'Admin account taken over'), 'or', {}, [
          mk(L('Passwort erraten', 'Guess password'), 'and', {}, [
            mk(L('Login-Seite öffentlich erreichbar', 'Login page publicly reachable'), 'leaf', { p: 1, cost: 0, skill: 1 }),
            mk(L('Keine Sperre nach Fehlversuchen', 'No lockout after failed attempts'), 'leaf', { p: 0.5, cost: 0, skill: 1, cm: L('Rate-Limiting', 'Rate limiting'), cmStatus: 'none' }),
            mk(L('Schwaches Passwort ohne MFA', 'Weak password without MFA'), 'leaf', { p: 0.2, cost: 100, skill: 1, cm: 'MFA', cmStatus: 'planned', cmEff: 95 })]),
          mk(L('Phishing des Admins', 'Phish the admin'), 'leaf', { p: 0.15, cost: 1000, skill: 2, cm: L('Awareness + FIDO2-Schlüssel', 'Awareness + FIDO2 keys'), cmStatus: 'partial' }),
          mk(L('Sitzung über XSS stehlen', 'Steal session via XSS'), 'and', {}, [
            mk(L('XSS-Schwachstelle vorhanden', 'XSS vulnerability present'), 'leaf', { p: 0.3, cost: 2000, skill: 3, refs: 'F-…', cm: L('Ausgabe kodieren, CSP', 'Output encoding, CSP'), cmStatus: 'none' }),
            mk(L('Session-Cookie ohne HttpOnly', 'Session cookie without HttpOnly'), 'leaf', { p: 0.5, cost: 0, skill: 2, cm: 'HttpOnly/SameSite', cmStatus: 'none' })])]) },
      { key: 'leak', kind: 'fault', name: L('Abfluss von Kundendaten', 'Leak of customer data'), desc: L('Personenbezogene Kundendaten gelangen an Unbefugte (meldepflichtig nach Art. 33 DSGVO).', 'Personal customer data reaches unauthorised parties (reportable under Art. 33 GDPR).'),
        root: mk(L('Abfluss von Kundendaten', 'Leak of customer data'), 'or', {}, [
          mk('SQL-Injection', 'leaf', { p: 0.05, cm: L('Prepared Statements, WAF', 'Prepared statements, WAF'), cmStatus: 'partial' }),
          mk(L('Öffentlich lesbarer Cloud-Speicher', 'Publicly readable cloud storage'), 'leaf', { p: 0.04, cm: L('Konfigurationsprüfung', 'Configuration review'), cmStatus: 'done', cmEff: 80 }),
          mk(L('Innentäter/in', 'Insider'), 'leaf', { p: 0.02, cm: L('Need-to-know, Protokollierung', 'Need-to-know, logging'), cmStatus: 'partial' }),
          mk(L('Verlust eines Notebooks', 'Loss of a notebook'), 'and', {}, [
            mk(L('Notebook geht verloren / wird gestohlen', 'Notebook lost / stolen'), 'leaf', { p: 0.3 }),
            mk(L('Festplatte nicht verschlüsselt', 'Disk not encrypted'), 'leaf', { p: 0.2, cm: 'BitLocker/FileVault', cmStatus: 'done', cmEff: 95 })])]) }
    ];
  }

  /* ------------------------------------------------------------------
   * Berechnung
   * ---------------------------------------------------------------- */
  var CMF = { none: 0, planned: 0, partial: 0.5, done: 1 };
  function eff(n) { return (CMF[n.cmStatus] || 0) * Math.min(100, Math.max(0, num(n.cmEff) || 0)) / 100; }
  /** Werte je Knoten berechnen: p (brutto), pr (netto), cost, skill, incomplete. */
  function calc(n) {
    var r;
    if (n.type === 'leaf' || !n.children.length) {
      var p = num(n.p); p = p === null ? null : Math.min(1, Math.max(0, p));
      r = { p: p, pr: p === null ? null : p * (1 - eff(n)), cost: num(n.cost), skill: num(n.skill), inc: p === null };
    } else {
      var cs = n.children.map(calc), known = cs.filter(function (c) { return c.p !== null; });
      var inc = cs.some(function (c) { return c.inc; });
      var costs = cs.map(function (c) { return c.cost; }).filter(function (c) { return c !== null; }), sk = cs.map(function (c) { return c.skill; }).filter(function (c) { return c !== null; });
      if (n.type === 'and') {
        r = { p: known.length === cs.length ? cs.reduce(function (a, c) { return a * c.p; }, 1) : null, pr: known.length === cs.length ? cs.reduce(function (a, c) { return a * c.pr; }, 1) : null,
          cost: costs.length === cs.length ? costs.reduce(function (a, b) { return a + b; }, 0) : null, skill: sk.length ? Math.max.apply(null, sk) : null, inc: inc };
      } else {
        r = { p: known.length ? 1 - known.reduce(function (a, c) { return a * (1 - c.p); }, 1) : null, pr: known.length ? 1 - known.reduce(function (a, c) { return a * (1 - c.pr); }, 1) : null,
          cost: costs.length ? Math.min.apply(null, costs) : null, skill: sk.length ? Math.min.apply(null, sk) : null, inc: inc };
      }
      r.kids = cs;
    }
    n._c = r; return r;
  }
  /** Kritischer Pfad: bei ODER das Kind mit höchster Netto-Wahrscheinlichkeit (Angriffsbaum: geringste Kosten), bei UND alle Kinder. */
  function critical(n, kind, set) {
    set = set || {}; set[n.id] = 1;
    if (n.type === 'leaf' || !n.children.length) return set;
    if (n.type === 'and') { n.children.forEach(function (c) { critical(c, kind, set); }); return set; }
    var best = null;
    n.children.forEach(function (c) {
      if (!best) { best = c; return; }
      var a = c._c, b = best._c;
      if (kind === 'attack' && a.cost !== null && b.cost !== null) { if (a.cost < b.cost || (a.cost === b.cost && (a.pr || 0) > (b.pr || 0))) best = c; }
      else if ((a.pr || 0) > (b.pr || 0)) best = c;
    });
    return critical(best, kind, set);
  }
  /** Minimale Schnittmengen (Kombinationen von Basisereignissen, die das Top-Ereignis auslösen). */
  function cutSets(n) {
    if (n.type === 'leaf' || !n.children.length) return [[n.id]];
    var parts = n.children.map(cutSets), out;
    if (n.type === 'or') out = [].concat.apply([], parts);
    else {
      out = [[]];
      parts.forEach(function (ps) { var nx = []; out.forEach(function (a) { ps.forEach(function (b) { if (nx.length < 400) nx.push(a.concat(b.filter(function (x) { return a.indexOf(x) < 0; }))); }); }); out = nx; });
    }
    // Obermengen entfernen (Minimalität)
    out.sort(function (a, b) { return a.length - b.length; });
    var min = [];
    out.forEach(function (c) { if (!min.some(function (m) { return m.every(function (x) { return c.indexOf(x) >= 0; }); })) min.push(c); });
    return min.slice(0, 300);
  }
  function analyse(tr) {
    var top = calc(tr.root), leaves = {};
    walk(tr.root, function (n) { if (n.type === 'leaf' || !n.children.length) leaves[n.id] = n; });
    var cs = cutSets(tr.root).map(function (c) {
      var p = 1, pr = 1, cost = 0, costOk = true, unknown = false;
      c.forEach(function (id) { var l = leaves[id]._c; if (l.p === null) unknown = true; else { p *= l.p; pr *= l.pr; } if (l.cost === null) costOk = false; else cost += l.cost; });
      return { ids: c, p: unknown ? null : p, pr: unknown ? null : pr, cost: costOk ? cost : null };
    });
    cs.sort(function (a, b) { return (b.pr || 0) - (a.pr || 0) || a.ids.length - b.ids.length; });
    var sumPr = cs.reduce(function (a, c) { return a + (c.pr || 0); }, 0) || 1;
    var imp = Object.keys(leaves).map(function (id) {
      var fv = cs.filter(function (c) { return c.ids.indexOf(id) >= 0; }).reduce(function (a, c) { return a + (c.pr || 0); }, 0) / sumPr;
      return { node: leaves[id], fv: fv };
    }).sort(function (a, b) { return b.fv - a.fv; });
    return { top: top, cuts: cs, imp: imp, crit: critical(tr.root, tr.kind), spof: cs.filter(function (c) { return c.ids.length === 1; }), leaves: leaves };
  }
  function fmtP(p) { if (p === null || p === undefined) return '–'; if (p === 0) return '0 %'; var v = p * 100; return K.num(v, v < 1 ? 2 : v < 10 ? 1 : 0) + ' %'; }
  function band(p) { return p === null ? '#e5e7eb' : p >= 0.3 ? '#f6b2ad' : p >= 0.1 ? '#f8cf9e' : p >= 0.01 ? '#f9e79f' : '#bfe5c3'; }
  function bandStroke(p) { return p === null ? '#9aa3ad' : p >= 0.3 ? '#d9362b' : p >= 0.1 ? '#e07b00' : p >= 0.01 ? '#c9a100' : '#2e9e44'; }

  /* ------------------------------------------------------------------
   * SVG-Darstellung (oben → unten, ODER-/UND-Gattersymbole)
   * ---------------------------------------------------------------- */
  var BW = 176, BH = 66, UNIT = 196, ROW = 138;
  function wrap(text, max, lines) {
    var words = String(text || '').split(/\s+/), out = [], line = '';
    words.forEach(function (w) { if ((line + ' ' + w).trim().length > max && line) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); });
    if (line) out.push(line);
    if (out.length > lines) { out = out.slice(0, lines); out[lines - 1] = out[lines - 1].slice(0, max - 1) + '…'; }
    return out;
  }
  function svg(tr, an, opts) {
    opts = opts || {};
    var pos = {}, maxD = 0;
    function width(n) { n._w = (n.type === 'leaf' || !n.children.length) ? 1 : n.children.reduce(function (a, c) { return a + width(c); }, 0); return n._w; }
    function place(n, start, d) { pos[n.id] = { x: (start + n._w / 2) * UNIT, y: d * ROW + 10, n: n }; maxD = Math.max(maxD, d); var s = start; n.children.forEach(function (c) { place(c, s, d + 1); s += c._w; }); }
    var total = width(tr.root); place(tr.root, 0, 0);
    var W = Math.max(total * UNIT, 260), H = (maxD + 1) * ROW + 10, sc = opts.scale || 1;
    var g = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + Math.round(W * sc) + '" height="' + Math.round(H * sc) + '" class="rt-svg" role="img" aria-label="' + esc(tr.name) + '" style="font-family:Segoe UI,Roboto,Arial,sans-serif">'];
    // Kanten
    Object.keys(pos).forEach(function (id) {
      var P = pos[id], n = P.n; if (n.type === 'leaf' || !n.children.length) return;
      var gy = P.y + BH + 34;
      n.children.forEach(function (c) {
        var C = pos[c.id], hot = !opts.plain && an.crit[n.id] && an.crit[c.id];
        g.push('<path d="M' + P.x + ' ' + gy + ' V' + (gy + 12) + ' H' + C.x + ' V' + C.y + '" fill="none" stroke="' + (hot ? '#d9362b' : '#7b8794') + '" stroke-width="' + (hot ? 3 : 1.5) + '"/>');
      });
      // Gatter-Symbol
      var x = P.x, y = P.y + BH + 4, col = an.crit[n.id] && !opts.plain ? '#d9362b' : '#3b4654';
      g.push('<line x1="' + x + '" y1="' + (P.y + BH) + '" x2="' + x + '" y2="' + y + '" stroke="' + col + '" stroke-width="1.5"/>');
      if (n.type === 'and') g.push('<path d="M' + (x - 17) + ' ' + (y + 30) + ' V' + (y + 13) + ' A17 17 0 0 1 ' + (x + 17) + ' ' + (y + 13) + ' V' + (y + 30) + ' Z" fill="#fff" stroke="' + col + '" stroke-width="2"/><text x="' + x + '" y="' + (y + 25) + '" text-anchor="middle" font-size="10" font-weight="700" fill="#1b2430">' + esc(L('UND', 'AND')) + '</text>');
      else g.push('<path d="M' + (x - 18) + ' ' + (y + 30) + ' Q' + x + ' ' + (y + 22) + ' ' + (x + 18) + ' ' + (y + 30) + ' Q' + (x + 16) + ' ' + (y + 8) + ' ' + x + ' ' + y + ' Q' + (x - 16) + ' ' + (y + 8) + ' ' + (x - 18) + ' ' + (y + 30) + ' Z" fill="#fff" stroke="' + col + '" stroke-width="2"/><text x="' + x + '" y="' + (y + 23) + '" text-anchor="middle" font-size="9" font-weight="700" fill="#1b2430">' + esc(L('ODER', 'OR')) + '</text>');
    });
    // Knoten
    Object.keys(pos).forEach(function (id) {
      var P = pos[id], n = P.n, c = n._c, x = P.x - BW / 2, sel = U.sel === id && !opts.plain, leaf = n.type === 'leaf' || !n.children.length, isTop = n === tr.root;
      var lines = wrap(n.label, 27, 2), info;
      if (tr.kind === 'attack') info = (c.cost !== null ? K.money(c.cost) : '') + (c.skill !== null ? ' · ' + L('Können ', 'skill ') + c.skill : '') + (c.p !== null ? ' · ' + fmtP(c.pr) : '');
      else info = c.p === null ? L('p fehlt', 'p missing') : 'p ' + fmtP(c.p) + (c.pr !== c.p ? ' → ' + fmtP(c.pr) : '');
      g.push('<g data-act="rtSel" data-id="' + id + '" style="cursor:pointer"><title>' + esc(n.label + (n.note ? ' – ' + n.note : '')) + '</title>' +
        '<rect x="' + x + '" y="' + P.y + '" width="' + BW + '" height="' + BH + '" rx="' + (leaf ? 30 : 6) + '" fill="' + band(c.pr) + '" stroke="' + (sel ? '#1f6feb' : bandStroke(c.pr)) + '" stroke-width="' + (sel ? 4 : isTop ? 3 : 1.6) + '"' + (c.inc ? ' stroke-dasharray="5 3"' : '') + '/>' +
        lines.map(function (ln, i) { return '<text x="' + P.x + '" y="' + (P.y + 20 + i * 15) + '" text-anchor="middle" font-size="12" font-weight="' + (isTop ? 800 : 600) + '" fill="#1b2430">' + esc(ln) + '</text>'; }).join('') +
        '<text x="' + P.x + '" y="' + (P.y + BH - 9) + '" text-anchor="middle" font-size="10.5" fill="#334155">' + esc(info) + '</text>' +
        (leaf && n.cmStatus && n.cmStatus !== 'none' ? '<text x="' + (x + BW - 10) + '" y="' + (P.y + 15) + '" text-anchor="end" font-size="11">' + (n.cmStatus === 'done' ? '🛡' : n.cmStatus === 'partial' ? '◐' : '⏳') + '</text>' : '') + '</g>');
    });
    g.push('</svg>');
    return g.join('');
  }

  /* ------------------------------------------------------------------
   * Ansicht
   * ---------------------------------------------------------------- */
  var CM_ST = [['none', ['keine', 'none']], ['planned', ['geplant', 'planned']], ['partial', ['teilweise umgesetzt', 'partially implemented']], ['done', ['umgesetzt', 'implemented']]];
  function view() {
    var tr = cur(), h = [K.pageHead(t('nav.risktree'), L('IT-Risikobaum als Fehlerbaum (Fault Tree) oder Angriffsbaum (Attack Tree): Ursachen über UND/ODER verknüpfen, Wahrscheinlichkeiten und Gegenmaßnahmen bewerten, kritische Pfade und Single Points of Failure erkennen.',
      'IT risk tree as fault tree or attack tree: link causes via AND/OR, rate probabilities and countermeasures, identify critical paths and single points of failure.'),
      K.btn('rtImport', '⬆ JSON') + K.btn('rtTpl', '📑 ' + L('Aus Vorlage', 'From template')) + K.btn('rtNew', '+ ' + L('Neuer Baum', 'New tree'), { cls: 'btn-primary' }))];
    if (!tr) {
      h.push('<div class="card"><h2>' + esc(L('Noch kein Risikobaum', 'No risk tree yet')) + '</h2><p>' + esc(L('Starten Sie mit einer Vorlage (Ransomware, Ausfall Webshop, Übernahme Admin-Konto, Abfluss von Kundendaten) oder legen Sie einen leeren Baum an.', 'Start with a template or create an empty tree.')) + '</p><div class="row">' +
        K.btn('rtTpl', '📑 ' + L('Aus Vorlage', 'From template'), { cls: 'btn-primary' }) + K.btn('rtNew', '+ ' + L('Neuer Baum', 'New tree')) + '</div>' + legendHtml() + '</div><input type="file" id="rtFile" data-act="rtFile" accept=".json" hidden>');
      return h.join('');
    }
    U.id = tr.id;
    var an = analyse(tr);
    if (!U.sel || !find(tr.root, U.sel)) U.sel = tr.root.id;
    h.push('<div class="chips no-print" style="margin-bottom:.6rem">' + T().items.map(function (x) {
      return '<button type="button" class="btn btn-sm' + (x.id === tr.id ? ' btn-primary' : '') + '" data-act="rtPick" data-id="' + esc(x.id) + '">' + esc(x.id + ' · ' + x.name) + '</button>'; }).join('') + '</div>');
    // Kopf: Name, Art, Verknüpfung
    var reg = (S().register || { items: [] }).items;
    h.push('<div class="card"><div class="grid grid-4">' +
      '<div class="field" style="grid-column:span 2"><label>' + esc(L('Name / Top-Ereignis', 'Name / top event')) + '</label><input type="text" data-field="rtT" data-k="name" value="' + esc(tr.name) + '"></div>' +
      '<div class="field"><label>' + esc(L('Art', 'Type')) + '</label><select data-act="rtTSel" data-k="kind">' + A.opt('fault', L('Fehlerbaum (Wahrscheinlichkeit)', 'Fault tree (probability)'), tr.kind) + A.opt('attack', L('Angriffsbaum (+ Kosten, Können)', 'Attack tree (+ cost, skill)'), tr.kind) + '</select></div>' +
      '<div class="field"><label>' + esc(L('Verknüpftes Risiko (Register)', 'Linked risk (register)')) + '</label><select data-act="rtTSel" data-k="registerId">' + A.opt('', '–', tr.registerId) + reg.map(function (r) { return A.opt(r.id, r.id + ' ' + r.title, tr.registerId); }).join('') + '</select></div>' +
      '<div class="field" style="grid-column:1/-1"><label>' + esc(L('Beschreibung / Betrachtungszeitraum', 'Description / period')) + '</label><input type="text" data-field="rtT" data-k="desc" value="' + esc(tr.desc || '') + '" placeholder="' + esc(L('Wahrscheinlichkeiten je Jahr', 'probabilities per year')) + '"></div></div>' +
      '<div class="row">' + K.btn('rtToRegister', '📒 ' + (tr.registerId ? L('Wahrscheinlichkeit ins Register übernehmen', 'Transfer probability to register') : L('Als Risiko ins Register übernehmen', 'Add as risk to register')), { disabled: an.top.p === null }) +
      K.btn('rtSvg', '⬇ SVG') + K.btn('rtPrint', '🖨 ' + L('Drucken / PDF', 'Print / PDF')) + K.btn('rtExport', '⬇ JSON') + K.btn('rtDup', '⧉ ' + L('Duplizieren', 'Duplicate')) + K.btn('rtDel', '🗑', { cls: 'btn-danger', title: t('btn.delete') }) + '</div></div>');
    // Kennzahlen
    var top = an.top;
    h.push('<div class="grid grid-4" id="rtStats">' + K.stat(fmtP(top.p), L('Top-Ereignis brutto (ohne Maßnahmen)', 'Top event gross (no measures)'), bandStroke(top.p)) +
      K.stat(fmtP(top.pr), L('Top-Ereignis netto (mit Gegenmaßnahmen)', 'Top event net (with countermeasures)'), bandStroke(top.pr), top.p ? esc(L('Reduktion ', 'Reduction ')) + K.num((1 - top.pr / top.p) * 100, 0) + ' %' : '') +
      (tr.kind === 'attack' ? K.stat(top.cost === null ? '–' : K.money(top.cost), L('günstigster Angriffsweg', 'cheapest attack path'), '#7c3aed', top.skill !== null ? esc(L('Können mind. ', 'skill min. ')) + top.skill + '/5' : '')
        : K.stat(an.cuts.length, L('minimale Schnittmengen', 'minimal cut sets'), '#7c3aed')) +
      K.stat(an.spof.length, L('Single Points of Failure', 'single points of failure'), an.spof.length ? K.AMP.bad : K.AMP.ok, esc(L('einzelne Ereignisse lösen das Top-Ereignis aus', 'single events trigger the top event'))) + '</div>');
    if (top.inc) h.push('<div class="note warn">' + esc(L('Für einige Basisereignisse fehlt die Wahrscheinlichkeit (gestrichelt) – das Ergebnis ist unvollständig.', 'Some basic events lack a probability (dashed) – the result is incomplete.')) + '</div>');
    // Baum + Editor
    h.push('<div class="rt-layout"><div class="card rt-canvas-card"><div class="row no-print" style="justify-content:space-between"><h2 style="margin:0">' + esc(L('Baum', 'Tree')) + '</h2><div class="row">' +
      K.btn('rtZoom', '−', { id: '-1', cls: 'btn-sm', title: L('verkleinern', 'zoom out') }) + '<span class="small">' + Math.round(U.zoom * 100) + ' %</span>' + K.btn('rtZoom', '+', { id: '1', cls: 'btn-sm', title: L('vergrößern', 'zoom in') }) + K.btn('rtZoom', L('Einpassen', 'Fit'), { id: '0', cls: 'btn-sm' }) + '</div></div>' +
      '<div class="rt-canvas" id="rtCanvas">' + svg(tr, an, { scale: U.zoom }) + '</div>' + legendHtml() + '</div>' +
      '<div class="card rt-editor" id="rtEditor">' + nodeEditor(tr, an) + '</div></div>');
    // Auswertung
    h.push('<div id="rtAnalysis">' + analysisHtml(tr, an) + '</div>');
    h.push('<input type="file" id="rtFile" data-act="rtFile" accept=".json" hidden>');
    return h.join('');
  }
  function legendHtml() {
    var b = function (c, s, l) { return '<span><i style="background:' + c + ';border:2px solid ' + s + '"></i>' + esc(l) + '</span>'; };
    return '<div class="legend small" style="margin-top:.5rem">' + b('#bfe5c3', '#2e9e44', '< 1 %') + b('#f9e79f', '#c9a100', '1–10 %') + b('#f8cf9e', '#e07b00', '10–30 %') + b('#f6b2ad', '#d9362b', '≥ 30 %') +
      '<span><i style="background:#d9362b;height:3px"></i>' + esc(L('kritischer Pfad', 'critical path')) + '</span><span>🛡 ' + esc(L('Maßnahme umgesetzt', 'measure implemented')) + '</span><span>◐ ' + esc(L('teilweise', 'partial')) + '</span><span>⏳ ' + esc(L('geplant', 'planned')) + '</span>' +
      '<span>' + esc(L('Rechteck = Verknüpfung, abgerundet = Basisereignis', 'rectangle = gate, rounded = basic event')) + '</span></div>';
  }
  function nodeEditor(tr, an) {
    var f = find(tr.root, U.sel), n = f.node, leaf = n.type === 'leaf', c = n._c, isTop = n === tr.root;
    var inp = function (k, l, type, extra) { return '<div class="field"><label>' + esc(K.lab(l)) + '</label><input type="' + (type || 'text') + '" data-field="rtN" data-k="' + k + '" value="' + esc(n[k] === undefined ? '' : n[k]) + '"' + (extra || '') + '></div>'; };
    var h = ['<h2>' + esc(isTop ? L('Top-Ereignis', 'Top event') : leaf ? L('Basisereignis', 'Basic event') : L('Zwischenereignis', 'Intermediate event')) + '</h2>'];
    h.push('<div class="field"><label>' + esc(L('Bezeichnung', 'Label')) + '</label><textarea data-field="rtN" data-k="label" rows="2">' + esc(n.label) + '</textarea></div>');
    h.push('<div class="field"><label>' + esc(L('Typ', 'Type')) + '</label><div class="seg">' + [['or', ['ODER-Verknüpfung', 'OR gate']], ['and', ['UND-Verknüpfung', 'AND gate']], ['leaf', ['Basisereignis', 'Basic event']]].map(function (o) {
      return '<label class="seg-opt"><input type="radio" name="rtType" data-act="rtType" value="' + o[0] + '"' + (n.type === o[0] ? ' checked' : '') + (o[0] === 'leaf' && n.children.length ? ' disabled' : '') + '><span>' + esc(K.lab(o[1])) + '</span></label>'; }).join('') + '</div>' +
      (n.children.length && !leaf ? '' : '') + '</div>');
    if (leaf) {
      h.push('<div class="grid grid-2">' + inp('p', ['Wahrscheinlichkeit (0–1 je Jahr)', 'Probability (0–1 per year)'], 'number', ' min="0" max="1" step="0.01"') +
        '<div class="field"><label>' + esc(L('Schnellwahl', 'Quick pick')) + '</label><div class="seg">' + [[0.01, ['sehr selten', 'very rare']], [0.05, ['selten', 'rare']], [0.2, ['mittel', 'medium']], [0.5, ['häufig', 'frequent']], [0.9, ['sehr häufig', 'very frequent']]].map(function (q) {
          return '<button type="button" class="btn btn-sm" data-act="rtQuick" data-id="' + q[0] + '" title="p = ' + q[0] + '">' + esc(K.lab(q[1])) + '</button>'; }).join('') + '</div></div>' +
        (tr.kind === 'attack' ? inp('cost', ['Kosten für Angreifende (€)', 'Attacker cost (€)'], 'number', ' min="0"') + inp('skill', ['Benötigtes Können (1–5)', 'Required skill (1–5)'], 'number', ' min="1" max="5"') : '') + '</div>');
      h.push('<h3>' + esc(L('Gegenmaßnahme', 'Countermeasure')) + '</h3><div class="field"><textarea data-field="rtN" data-k="cm" rows="2" placeholder="' + esc(L('z. B. MFA, Offline-Backup, Patchprozess', 'e.g. MFA, offline backup, patch process')) + '">' + esc(n.cm || '') + '</textarea></div>' +
        '<div class="grid grid-2"><div class="field"><label>' + esc(L('Status', 'Status')) + '</label><select data-act="rtNSel" data-k="cmStatus">' + CM_ST.map(function (o) { return A.opt(o[0], K.lab(o[1]), n.cmStatus || 'none'); }).join('') + '</select></div>' +
        inp('cmEff', ['Wirksamkeit (%)', 'Effectiveness (%)'], 'number', ' min="0" max="100"') + '</div>' +
        '<p class="small muted">' + esc(L('Umgesetzt = volle, teilweise = halbe Wirksamkeit; geplant zählt noch nicht.', 'Implemented = full, partial = half effectiveness; planned does not count yet.')) + '</p>');
    } else h.push('<p class="small muted">' + esc(n.type === 'and' ? L('UND: tritt nur ein, wenn ALLE darunterliegenden Ereignisse eintreten (P = Produkt).', 'AND: occurs only if ALL child events occur (P = product).') : L('ODER: tritt ein, wenn MINDESTENS EIN darunterliegendes Ereignis eintritt (P = 1 − Π(1 − p)).', 'OR: occurs if AT LEAST ONE child event occurs.')) + '</p>');
    h.push(inp('refs', ['Bezüge (Risiko-, Finding-, Maßnahmen-IDs)', 'References (risk, finding, measure IDs)'], 'text', ' placeholder="RR-001, F-003, R-012, SYS.1.1.A6"'));
    h.push('<div class="field"><label>' + esc(L('Notiz', 'Note')) + '</label><textarea data-field="rtN" data-k="note" rows="2">' + esc(n.note || '') + '</textarea></div>');
    h.push('<div class="small" id="rtNodeCalc">' + nodeCalc(n) + '</div>');
    h.push('<div class="row" style="margin-top:.6rem">' + K.btn('rtAdd', '+ ' + L('Untereintrag', 'Child'), { cls: 'btn-primary', title: L('Ereignis darunter anlegen', 'Add event below') }) +
      (isTop ? '' : K.btn('rtSib', '+ ' + L('daneben', 'sibling')) + K.btn('rtMove', '◀', { id: '-1', title: L('nach links', 'move left') }) + K.btn('rtMove', '▶', { id: '1', title: L('nach rechts', 'move right') }) + K.btn('rtUp', '⤴', { title: L('eine Ebene höher', 'one level up') }) + K.btn('rtDelNode', '🗑', { cls: 'btn-danger', title: L('mit allen Untereinträgen löschen', 'delete including children') })) + '</div>');
    return h.join('');
  }
  function nodeCalc(n) { var c = n._c || {}; return esc(L('Berechnet: ', 'Computed: ')) + 'p ' + fmtP(c.p) + ' → ' + fmtP(c.pr) + (c.cost !== null && c.cost !== undefined ? ' · ' + K.money(c.cost) : '') + (c.skill !== null && c.skill !== undefined ? ' · ' + L('Können ', 'skill ') + c.skill : ''); }
  function analysisHtml(tr, an) {
    var lab = function (id) { return an.leaves[id].label; };
    var h = ['<div class="grid grid-2"><div class="card"><h2>' + esc(L('Minimale Schnittmengen (Top 10)', 'Minimal cut sets (top 10)')) + '</h2><p class="small muted">' + esc(L('Kombinationen von Basisereignissen, die zusammen das Top-Ereignis auslösen. Größe 1 = Single Point of Failure.', 'Combinations of basic events that together trigger the top event. Size 1 = single point of failure.')) + '</p>' +
      K.table(['#', { l: ['Basisereignisse', 'Basic events'], w: 220 }, L('p brutto', 'p gross'), L('p netto', 'p net')].concat(tr.kind === 'attack' ? [L('Kosten', 'Cost')] : []), an.cuts.slice(0, 10).map(function (c, i) {
        return '<tr><td>' + (i + 1) + (c.ids.length === 1 ? ' ' + K.amp('bad', 'SPOF') : '') + '</td><td class="small">' + c.ids.map(function (id) { return esc(lab(id)); }).join(' <b>+</b> ') + '</td><td class="nowrap">' + fmtP(c.p) + '</td><td class="nowrap"><b>' + fmtP(c.pr) + '</b></td>' + (tr.kind === 'attack' ? '<td class="nowrap">' + (c.cost === null ? '–' : K.money(c.cost)) + '</td>' : '') + '</tr>';
      })) + (an.cuts.length > 10 ? '<p class="small muted">' + esc(L('… insgesamt ' + an.cuts.length, '… total ' + an.cuts.length)) + '</p>' : '') + '</div>'];
    var rec = an.imp.filter(function (x) { return x.node.cmStatus !== 'done' && x.fv > 0; }).slice(0, 3);
    h.push('<div class="card"><h2>' + esc(L('Wo ansetzen? Bedeutung der Basisereignisse', 'Where to act? Importance of basic events')) + '</h2><p class="small muted">' + esc(L('Anteil am Netto-Risiko des Top-Ereignisses (Fussell-Vesely-Näherung). Maßnahmen an Ereignissen mit hohem Anteil wirken am stärksten.', 'Share of the top event net risk (Fussell-Vesely approximation). Measures on events with a high share are most effective.')) + '</p>' +
      K.table([{ l: ['Basisereignis', 'Basic event'], w: 200 }, L('Anteil', 'Share'), L('p netto', 'p net'), L('Gegenmaßnahme', 'Countermeasure')], an.imp.slice(0, 12).map(function (x) {
        return '<tr><td class="small"><a href="#risktree" data-act="rtSel" data-id="' + x.node.id + '">' + esc(x.node.label) + '</a></td><td><div class="bar-track" style="min-width:70px"><div class="bar-fill" style="width:' + Math.min(100, x.fv * 100).toFixed(1) + '%;background:#d9362b"></div></div>' + K.num(x.fv * 100, 0) + ' %</td><td class="nowrap">' + fmtP(x.node._c.pr) + '</td>' +
          '<td class="small">' + esc(x.node.cm || '–') + ' <span class="muted">(' + esc(K.lab((CM_ST.find(function (o) { return o[0] === (x.node.cmStatus || 'none'); }) || CM_ST[0])[1])) + ')</span></td></tr>';
      })) + (rec.length ? '<div class="note" style="margin-top:.6rem"><b>' + esc(L('Empfehlung:', 'Recommendation:')) + '</b> ' + rec.map(function (x) { return esc(x.node.label) + (x.node.cm ? ' → ' + esc(x.node.cm) : ''); }).join('; ') + '</div>' : '') + '</div></div>');
    return h.join('');
  }
  /** Nur Baum, Kennzahlen und Auswertung neu zeichnen (Fokus im Editor bleibt erhalten). */
  function redraw() {
    var tr = cur(); if (!tr) return;
    var an = analyse(tr), cv = document.getElementById('rtCanvas'), ad = document.getElementById('rtAnalysis'), nc = document.getElementById('rtNodeCalc');
    if (cv) cv.innerHTML = svg(tr, an, { scale: U.zoom });
    if (ad) ad.innerHTML = analysisHtml(tr, an);
    var f = find(tr.root, U.sel); if (nc && f) nc.innerHTML = nodeCalc(f.node);
    var stats = document.getElementById('rtStats');
    if (stats) { var top = an.top, vals = stats.querySelectorAll('.value'); if (vals[0]) vals[0].textContent = fmtP(top.p); if (vals[1]) vals[1].textContent = fmtP(top.pr); }
  }

  /* ------------------------------------------------------------------
   * Aktionen
   * ---------------------------------------------------------------- */
  function addTree(tpl) {
    var tr = T(), id = 'RB-' + ('0' + (tr.seq++)).slice(-2);
    var item = tpl ? { id: id, name: tpl.name, kind: tpl.kind, desc: tpl.desc, registerId: '', root: JSON.parse(JSON.stringify(tpl.root)) }
      : { id: id, name: L('Neuer Risikobaum', 'New risk tree'), kind: 'fault', desc: '', registerId: '', root: mk(L('Top-Ereignis (unerwünschtes Ereignis)', 'Top event (undesired event)'), 'or', {}, [mk(L('Ursache 1', 'Cause 1'), 'leaf', { p: 0.1 }), mk(L('Ursache 2', 'Cause 2'), 'leaf', { p: 0.05 })]) };
    walk(item.root, function (n) { n.id = nid(); });
    item.created = new Date().toISOString(); tr.items.push(item); U.id = id; U.sel = item.root.id; U.fit = true; A.save(); A.render();
  }
  function tplDialog() {
    var list = templates();
    A.dialog(L('Risikobaum aus Vorlage', 'Risk tree from template'), '<div class="tpl-list">' + list.map(function (x, i) {
      return '<label class="tpl-item"><input type="radio" name="tpl" value="' + i + '"' + (i === 0 ? ' checked' : '') + '> <b>' + esc(x.name) + '</b> <span class="small muted">· ' + esc(x.kind === 'attack' ? L('Angriffsbaum', 'attack tree') : L('Fehlerbaum', 'fault tree')) + '</span><div class="small muted">' + esc(x.desc) + '</div></label>'; }).join('') + '</div>' +
      '<p class="small muted">' + esc(L('Die Wahrscheinlichkeiten der Vorlagen sind Beispielwerte – bitte an die eigene Lage anpassen.', 'Template probabilities are examples – please adapt to your situation.')) + '</p>', function (fm) {
      addTree(list[+(fm.querySelector('[name=tpl]:checked') || {}).value || 0]);
    }, L('Anlegen', 'Create'));
  }
  /** Jahreswahrscheinlichkeit → Ereignisrate λ (Poisson): λ = −ln(1 − p). */
  function lambda(p) { return p >= 1 ? 5 : -Math.log(1 - p); }
  function toRegister(tr) {
    var s = S(), an = analyse(tr), top = an.top; if (top.p === null) return;
    var r = s.register.items.find(function (x) { return x.id === tr.registerId; });
    var l = lambda(top.p), lr = lambda(top.pr);
    var cls = function (p) { return p >= 0.5 ? 4 : p >= 0.2 ? 3 : p >= 0.05 ? 2 : 1; };
    if (!r) {
      r = { id: K.seq(s.register, 'seq', 'RR-'), title: tr.name, category: 'cyber', threat: '', cause: '', consequence: tr.desc || '', assets: [], owner: '', status: 'open', p: cls(top.p), i: 3, treatment: 'reduce', due: '', measures: '', rp: cls(top.pr), ri: 3, reviewMonths: '', lastReview: '', desc: '', q: {}, reviews: [], created: new Date().toISOString() };
      s.register.items.push(r); tr.registerId = r.id;
    }
    r.q = r.q || {};
    r.q.fMin = +(l * 0.5).toFixed(4); r.q.fMode = +l.toFixed(4); r.q.fMax = +(l * 2).toFixed(4);
    r.q.rf = top.p ? Math.max(0, Math.round((1 - lr / l) * 100)) : 0;
    r.desc = (r.desc ? r.desc + '\n' : '') + L('Aus Risikobaum ' + tr.id + ': p brutto ' + fmtP(top.p) + ', netto ' + fmtP(top.pr) + ' (' + K.today() + ')', 'From risk tree ' + tr.id + ': p gross ' + fmtP(top.p) + ', net ' + fmtP(top.pr) + ' (' + K.today() + ')');
    r.updated = new Date().toISOString();
    A.save(); A.render(); A.toast(L('Ins Risikoregister übernommen: ', 'Transferred to risk register: ') + r.id + ' (λ ' + K.num(l, 3) + '/' + L('Jahr', 'year') + ')');
  }
  function standalone(tr, body) {
    var an = analyse(tr);
    return '<!DOCTYPE html><html lang="' + HA.lang + '"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:"><title>' + esc(tr.id + ' ' + tr.name) + '</title><style>' +
      '@page{size:A4 landscape;margin:12mm}body{font-family:Segoe UI,Roboto,Arial,sans-serif;font-size:9.5pt;color:#1b2430}h1{font-size:15pt;margin:0 0 2mm}table{border-collapse:collapse;width:100%;font-size:8.5pt;margin-top:3mm}td,th{border:.4pt solid #b8c2cf;padding:1.2mm 2mm;text-align:left;vertical-align:top}th{background:#eef2f7}.svgw svg{max-width:100%;height:auto}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>' +
      '<h1>' + esc(tr.id + ' – ' + tr.name) + '</h1><p>' + esc(tr.kind === 'attack' ? L('Angriffsbaum', 'Attack tree') : L('Fehlerbaum', 'Fault tree')) + ' · ' + esc(L('Top-Ereignis brutto ', 'top event gross ')) + fmtP(an.top.p) + ' · ' + esc(L('netto ', 'net ')) + fmtP(an.top.pr) + (tr.desc ? ' · ' + esc(tr.desc) : '') + '</p>' +
      '<div class="svgw">' + svg(tr, an, { plain: false, scale: 1 }) + '</div>' + (body || '') + '</body></html>';
  }

  A.views.risktree = view;
  A.ext.afterRender.push(function (v) {
    if (v !== 'risktree' || !U.fit || !cur()) return;
    U.fit = false; var z = fitZoom(cur());
    if (Math.abs(z - U.zoom) > 0.01) { U.zoom = z; redraw(); var zs = document.querySelector('[data-act=rtZoom][data-id="1"]'); if (zs && zs.previousElementSibling) zs.previousElementSibling.textContent = Math.round(z * 100) + ' %'; }
  });
  A.ext.click.push(function (act, el) {
    var tr = cur(), id = el.getAttribute('data-id');
    switch (act) {
      case 'rtNew': addTree(null); return true;
      case 'rtTpl': tplDialog(); return true;
      case 'rtPick': U.id = id; U.sel = null; U.fit = true; A.render(); return true;
      case 'rtSel': U.sel = id; A.render(); var ed = document.getElementById('rtEditor'); if (ed && window.innerWidth < 1100) ed.scrollIntoView({ block: 'start', behavior: 'smooth' }); return true;
      case 'rtZoom': U.fit = false; U.zoom = id === '0' ? fitZoom(tr) : Math.max(0.3, Math.min(2, U.zoom + (+id) * 0.15)); redraw(); var zs = el.parentNode.querySelector('span'); if (zs) zs.textContent = Math.round(U.zoom * 100) + ' %'; return true;
      case 'rtAdd': { var f = find(tr.root, U.sel), n = f.node; if (n.type === 'leaf') n.type = 'or'; var c = mk(L('Neues Ereignis', 'New event'), 'leaf', { p: 0.1 }); n.children.push(c); U.sel = c.id; A.save(); A.render(); return true; }
      case 'rtSib': { var f2 = find(tr.root, U.sel), c2 = mk(L('Neues Ereignis', 'New event'), 'leaf', { p: 0.1 }); var i = f2.parent.children.indexOf(f2.node); f2.parent.children.splice(i + 1, 0, c2); U.sel = c2.id; A.save(); A.render(); return true; }
      case 'rtMove': { var f3 = find(tr.root, U.sel), arr = f3.parent.children, i3 = arr.indexOf(f3.node), j = i3 + (+id); if (j >= 0 && j < arr.length) { arr.splice(i3, 1); arr.splice(j, 0, f3.node); A.save(); A.render(); } return true; }
      case 'rtUp': { var f4 = find(tr.root, U.sel), gp = find(tr.root, f4.parent.id).parent; if (!gp) { A.toast(L('Bereits direkt unter dem Top-Ereignis.', 'Already directly below the top event.'), true); return true; }
        f4.parent.children.splice(f4.parent.children.indexOf(f4.node), 1); gp.children.splice(gp.children.indexOf(f4.parent) + 1, 0, f4.node); if (!f4.parent.children.length) f4.parent.type = 'leaf'; A.save(); A.render(); return true; }
      case 'rtDelNode': { var f5 = find(tr.root, U.sel); A.confirm(L('„' + f5.node.label + '“ mit allen Untereinträgen löschen?', 'Delete "' + f5.node.label + '" including children?'), function () {
        f5.parent.children.splice(f5.parent.children.indexOf(f5.node), 1); if (!f5.parent.children.length) f5.parent.type = 'leaf'; U.sel = f5.parent.id; A.save(); A.render(); }); return true; }
      case 'rtQuick': { var f6 = find(tr.root, U.sel); f6.node.p = +id; A.save(); A.render(); return true; }
      case 'rtToRegister': toRegister(tr); return true;
      case 'rtDup': { var cp = JSON.parse(JSON.stringify(tr)); cp.name += L(' (Kopie)', ' (copy)'); cp.registerId = ''; addTree(cp); return true; }
      case 'rtDel': A.confirm(L('Risikobaum ' + tr.id + ' „' + tr.name + '“ löschen?', 'Delete risk tree ' + tr.id + '?'), function () { T().items = T().items.filter(function (x) { return x !== tr; }); U.id = null; A.save(); A.render(); }); return true;
      case 'rtSvg': { var an = analyse(tr); K.download('risikobaum_' + tr.id + '.svg', '<?xml version="1.0" encoding="UTF-8"?>\n' + svg(tr, an, { scale: 1 }).replace(/ data-act="rtSel" data-id="[^"]*" style="cursor:pointer"/g, ''), 'image/svg+xml'); return true; }
      case 'rtPrint': { var an2 = analyse(tr); var html = standalone(tr, '<div style="break-before:page"></div>' + analysisHtml(tr, an2).replace(/<button[^>]*>.*?<\/button>/g, ''));
        printHtml(html); A.toast(L('Für PDF im Druckdialog „Als PDF speichern“ wählen.', 'For PDF choose "Save as PDF" in the print dialog.')); return true; }
      case 'rtExport': K.download('risikobaum_' + tr.id + '.json', JSON.stringify({ app: 'little-riskbee-risktree', version: 1, tree: tr }, function (k, v) { return k === '_c' || k === '_w' ? undefined : v; }, 2), 'application/json'); return true;
      case 'rtImport': document.getElementById('rtFile').click(); return true;
    }
  });
  function fitZoom(tr) { var cv = document.getElementById('rtCanvas'); if (!cv || !tr) return 1; var w = 0; walk(tr.root, function (n) { if (n.type === 'leaf' || !n.children.length) w++; }); return Math.max(0.3, Math.min(1, (cv.clientWidth - 24) / Math.max(260, w * UNIT))); }
  function printHtml(html) {
    var fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0'; document.body.appendChild(fr);
    fr.onload = function () { setTimeout(function () { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { A.toast(e.message, true); } setTimeout(function () { fr.remove(); }, 120000); }, 250); };
    fr.srcdoc = html;
  }
  A.ext.change.push(function (act, el) {
    var tr = cur();
    switch (act) {
      case 'rtType': { var f = find(tr.root, U.sel); f.node.type = el.value; A.save(); A.render(); return true; }
      case 'rtNSel': { var f2 = find(tr.root, U.sel); f2.node[el.getAttribute('data-k')] = el.value; A.save(); A.render(); return true; }
      case 'rtTSel': tr[el.getAttribute('data-k')] = el.value; A.save(); A.render(); return true;
      case 'rtN': case 'rtT': return true;   // kein Neuaufbau beim Verlassen des Feldes (sonst ginge ein Klick verloren)
      case 'rtFile': {
        var file = el.files[0]; el.value = ''; if (!file) return true;
        file.text().then(function (txt) {
          try { var o = JSON.parse(txt), tree = o.tree || o; if (!tree.root) throw new Error('root'); tree.id = null; addTree(tree); A.toast(L('Risikobaum importiert', 'Risk tree imported')); }
          catch (e) { A.toast(L('Datei ist kein Risikobaum.', 'File is not a risk tree.'), true); }
        });
        return true;
      }
    }
  });
  A.ext.input.push(function (act, el) {
    var tr = cur(), k = el.getAttribute('data-k');
    if (act === 'rtN') { var f = find(tr.root, U.sel); f.node[k] = el.type === 'number' ? el.value : el.value; A.save(); clearTimeout(U._t); U._t = setTimeout(redraw, 150); return true; }
    if (act === 'rtT') { tr[k] = el.value; A.save(); return true; }
  });

  // Bericht (Hauptbericht)
  A.ext.reportOpts.push({ key: 'risktree', label: { de: 'Risikobäume (Fehler-/Angriffsbäume)', en: 'Risk trees (fault/attack trees)' } });
  HA.Report.ext.push({ key: 'risktree', build: function (state, scope, H) {
    if (!state.trees.items.length) return '';
    var h = ['<section class="pb"><h2>' + H.esc(L('Risikobäume', 'Risk trees')) + '</h2>'];
    state.trees.items.forEach(function (tr) {
      var an = analyse(tr);
      h.push('<h3>' + H.esc(tr.id + ' – ' + tr.name) + '</h3><p class="small">' + H.esc(tr.kind === 'attack' ? L('Angriffsbaum', 'Attack tree') : L('Fehlerbaum', 'Fault tree')) + ' · ' + H.esc(L('Top-Ereignis brutto ', 'top event gross ')) + fmtP(an.top.p) + ' · ' + H.esc(L('netto ', 'net ')) + fmtP(an.top.pr) +
        (tr.kind === 'attack' && an.top.cost !== null ? ' · ' + H.esc(L('günstigster Angriff ', 'cheapest attack ')) + K.money(an.top.cost) : '') + ' · ' + an.spof.length + ' ' + H.esc(L('Single Points of Failure', 'single points of failure')) + '</p>');
      h.push('<div style="break-inside:avoid">' + svg(tr, an, { scale: 1 }).replace('class="rt-svg"', 'class="rt-svg" style="max-width:100%;height:auto"').replace(/ width="\d+" height="\d+"/, ' width="100%"') + '</div>');
      h.push('<table><thead><tr><th style="width:8mm">#</th><th>' + H.esc(L('Minimale Schnittmenge', 'Minimal cut set')) + '</th><th style="width:20mm">' + H.esc(L('p netto', 'p net')) + '</th></tr></thead><tbody>' + an.cuts.slice(0, 5).map(function (c, i) {
        return '<tr><td>' + (i + 1) + '</td><td class="small">' + c.ids.map(function (id) { return H.esc(an.leaves[id].label); }).join(' + ') + '</td><td>' + fmtP(c.pr) + '</td></tr>'; }).join('') + '</tbody></table>');
    });
    h.push('</section>');
    return h.join('');
  } });

  return { analyse: analyse, svg: svg, fmtP: fmtP, templates: templates, U: U, cutSets: cutSets };
})();

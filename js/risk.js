/* =====================================================================
 * risk.js – Risikobewertung, Projektrisiken, Roadmap und TOM-Übersicht
 * ---------------------------------------------------------------------
 * Reine Logik ohne Oberfläche, damit app.js (Ansichten) und report.js
 * (Bericht) dieselben Berechnungen verwenden.
 *
 *  1. Befund-Risiken: Matrix in Anlehnung an BSI-Standard 200-3
 *     Eintrittshäufigkeit (1–4) × Schadenshöhe (1–4) → Risikokategorie
 *     gering / mittel / hoch / sehr hoch. Die Bewertung wird direkt am
 *     Befund gespeichert (finding.risk), der Status kommt aus „Scans“.
 *  2. Projektrisiken (Projektmanagement): Eintrittswahrscheinlichkeit
 *     (1–5) × Auswirkung (1–5) = Risikowert 1–25, inkl. Restrisiko.
 *  3. Roadmap: priorisierte Liste offener Befunde, Maßnahmen und
 *     Projektrisiken mit Zeithorizont.
 *  4. TOM-Übersicht nach Art. 32 DSGVO (Zuordnung über die Themen).
 * ===================================================================== */
window.HA = window.HA || {};

HA.Risk = (function () {
  'use strict';
  var t = function (k, v) { return HA.t(k, v); };

  /* ------------------------------------------------------------------
   * 1. Befund-Risiken (4 × 4)
   * ---------------------------------------------------------------- */
  var CATS = ['low', 'medium', 'high', 'veryhigh'];
  var COLORS = { low: '#3fb54a', medium: '#f2c12e', high: '#f0952a', veryhigh: '#d9362b' };
  var TEXT = { low: '#fff', medium: '#1b2430', high: '#1b2430', veryhigh: '#fff' };
  /* Chancen: je höher der Wert, desto attraktiver (Blau-Grau → Dunkelgrün) */
  var CH_COLORS = { low: '#b8c7d6', medium: '#9fd8ab', high: '#4cb963', veryhigh: '#1e7f3a' };
  var CH_TEXT = { low: '#1b2430', medium: '#1b2430', high: '#fff', veryhigh: '#fff' };
  /* Zeilen = Schadenshöhe 1..4, Spalten = Eintrittshäufigkeit 1..4 */
  var MATRIX = [
    ['low', 'low', 'low', 'low'],             // vernachlässigbar
    ['low', 'low', 'medium', 'high'],         // begrenzt
    ['low', 'medium', 'high', 'veryhigh'],    // beträchtlich
    ['low', 'high', 'veryhigh', 'veryhigh']   // existenzbedrohend
  ];
  function category(p, i) { return MATRIX[(i || 1) - 1][(p || 1) - 1]; }

  /** Elementare Gefährdungen (Auswahl aus dem IT-Grundschutz-Kompendium) als Vorschlagsliste. */
  var THREATS = [
    'G 0.14 Ausspähen von Informationen (Spionage)', 'G 0.15 Abhören', 'G 0.16 Diebstahl von Geräten, Datenträgern oder Dokumenten',
    'G 0.17 Verlust von Geräten, Datenträgern oder Dokumenten', 'G 0.18 Fehlplanung oder fehlende Anpassung', 'G 0.19 Offenlegung schützenswerter Informationen',
    'G 0.20 Informationen oder Produkte aus unzuverlässiger Quelle', 'G 0.21 Manipulation von Hard- oder Software', 'G 0.22 Manipulation von Informationen',
    'G 0.23 Unbefugtes Eindringen in IT-Systeme', 'G 0.24 Zerstörung von Geräten oder Datenträgern', 'G 0.25 Ausfall von Geräten oder Systemen',
    'G 0.26 Fehlfunktion von Geräten oder Systemen', 'G 0.27 Ressourcenmangel', 'G 0.28 Software-Schwachstellen oder -Fehler', 'G 0.29 Verstoß gegen Gesetze oder Regelungen',
    'G 0.30 Unberechtigte Nutzung oder Administration von Geräten und Systemen', 'G 0.31 Fehlerhafte Nutzung oder Administration von Geräten und Systemen',
    'G 0.32 Missbrauch von Berechtigungen', 'G 0.36 Identitätsdiebstahl', 'G 0.37 Abstreiten von Handlungen', 'G 0.38 Missbrauch personenbezogener Daten',
    'G 0.39 Schadprogramme', 'G 0.40 Verhinderung von Diensten (Denial of Service)', 'G 0.42 Social Engineering', 'G 0.43 Einspielen von Nachrichten',
    'G 0.45 Datenverlust', 'G 0.46 Integritätsverlust schützenswerter Informationen'
  ];
  function threatBy(prefix) { return THREATS.find(function (x) { return x.indexOf(prefix + ' ') === 0; }) || ''; }
  var TOPIC_THREAT = { remote: 'G 0.23', accounts: 'G 0.30', privilege: 'G 0.32', network: 'G 0.23', patch: 'G 0.28', logging: 'G 0.37', malware: 'G 0.39',
    exploit: 'G 0.28', crypto: 'G 0.15', boot: 'G 0.21', media: 'G 0.19', integrity: 'G 0.21', availability: 'G 0.25', privacy: 'G 0.19',
    lifecycle: 'G 0.19', services: 'G 0.23', install: 'G 0.18', planning: 'G 0.18' };

  /** Vorschlag für die Bedrohung eines Befunds. */
  function suggestThreat(scan, f) {
    var title = (f.title || '').toLowerCase();
    if (scan.tool === 'nmap') return threatBy('G 0.23');
    if (/cleartext|unencrypted|klartext|ssl|tls|cipher|mac algorithm/.test(title)) return threatBy('G 0.15');
    if (/information disclosure|disclosure|banner|vrfy|expn/.test(title)) return threatBy('G 0.14');
    if (/denial of service|dos\b/.test(title)) return threatBy('G 0.40');
    if (/malware|virus|rootkit/.test(title)) return threatBy('G 0.39');
    if (f.topic && TOPIC_THREAT[f.topic]) return threatBy(TOPIC_THREAT[f.topic]);
    if (f.cve) return threatBy('G 0.28');
    return threatBy('G 0.28');
  }

  var PRANK = { normal: 0, high: 1, veryhigh: 2 };
  function protection(asset) {
    var sb = asset.sb || {}, m = 'normal';
    ['c', 'i', 'a'].forEach(function (k) { if (PRANK[sb[k] || 'normal'] > PRANK[m]) m = sb[k]; });
    return m;
  }
  /** Vorschlag für Eintrittshäufigkeit (aus Schwere) und Schadenshöhe (aus Schutzbedarf). */
  function suggest(asset, scan, f) {
    var sev = f.severity || 'info';
    var p = { critical: 4, high: 3, medium: 2, low: 1, info: 1 }[sev] || 1;
    if (scan.tool === 'nmap') p = 2;                       // offene Ports sind von außen erkennbar
    var i = { normal: 2, high: 3, veryhigh: 4 }[protection(asset)];
    if (sev === 'low' || sev === 'info') i = Math.max(1, i - 1);
    return { p: p, i: i };
  }

  /** Neueste Scans je Werkzeug eines Assets (ältere sind durch Folge-Scans überholt). */
  function latestScans(asset) {
    var by = {};
    (asset.scans || []).forEach(function (s) {
      if (s.tool === 'file') return;
      var k = s.tool + '|' + ((s.hosts && s.hosts[0] && (s.hosts[0].ip || s.hosts[0].hostname)) || '');
      if (!by[k] || (s.scanDate || '') > (by[k].scanDate || '')) by[k] = s;
    });
    return Object.keys(by).map(function (k) { return by[k]; });
  }

  /** Allen Befunden der aktuellen Scans eine fortlaufende Risiko-ID geben. */
  function ensureIds(state) {
    state.riskSeq = state.riskSeq || 1;
    state.assets.forEach(function (a) {
      latestScans(a).sort(function (x, y) { return (x.scanDate || '').localeCompare(y.scanDate || ''); }).forEach(function (s) {
        (s.findings || []).forEach(function (f) {
          f.risk = f.risk || {};
          if (!f.risk.id) f.risk.id = 'R-' + ('000' + (state.riskSeq++)).slice(-3);
        });
      });
    });
  }

  /** Zeilen der Risikotabelle (Befunde) zusammenstellen. */
  function findingRows(state, opts) {
    opts = opts || {};
    var rows = [];
    state.assets.forEach(function (a) {
      if (opts.assetId && a.id !== opts.assetId) return;
      latestScans(a).forEach(function (s) {
        (s.findings || []).forEach(function (f) {
          var st = f.status || 'open';
          if (!opts.includeClosed && (st === 'fixed' || st === 'falsepositive')) return;
          var r = f.risk || {};
          var sg = suggest(a, s, f);
          var p = r.p || sg.p, i = r.i || sg.i;
          var treatment = r.treatment || (st === 'accepted' ? 'accept' : st === 'fixed' ? 'reduce' : '');
          rows.push({ asset: a, scan: s, f: f, r: r, id: r.id || '', p: p, i: i, suggested: !r.rated, value: p * i, cat: category(p, i),
            threat: r.threat || '', threatSuggest: suggestThreat(s, f), target: r.target || (a.name + (f.port && f.port.indexOf('general') < 0 ? ' · ' + f.port : '')),
            owner: r.owner || a.owner || '', treatment: treatment, measure: r.measure || '', due: r.due || '', status: st,
            fid: a.id + '§' + s.id + '§' + f.id });
        });
      });
    });
    var rank = { veryhigh: 3, high: 2, medium: 1, low: 0 };
    rows.sort(function (x, y) { return (rank[y.cat] - rank[x.cat]) || (y.value - x.value) || x.id.localeCompare(y.id); });
    return rows;
  }

  /**
   * Heatmap als CSS-Grid (auch für den Bericht verwendbar – nur Inline-Styles).
   * Aufbau:  [Y-Achsentitel senkrecht] [Zeilenbeschriftung] [Zellen …]
   *          unten: Spaltenbeschriftungen und X-Achsentitel.
   * opts: size (4|5), catFn(p,i), pLabels[], iLabels[], pTitle, iTitle,
   *       clickAct (Klick filtert), selected ("p-i"), cell (max. Kantenlänge px), maxWidth
   */
  function heatmapHtml(rows, opts) {
    opts = opts || {};
    var esc = HA.Report.esc;
    var n = opts.size || 4, catFn = opts.catFn || category;
    var pLabels = opts.pLabels || [1, 2, 3, 4].map(function (k) { return t('risk.p' + k); });
    var iLabels = opts.iLabels || [1, 2, 3, 4].map(function (k) { return t('risk.i' + k); });
    var pTitle = opts.pTitle || t('risk.pTitle'), iTitle = opts.iTitle || t('risk.iTitle');
    var cell = opts.cell || 64, fs = opts.fontSize || 12;
    var COL = opts.colors || COLORS, TXT = opts.textColors || TEXT;
    var counts = {};
    rows.forEach(function (r) { var k = r.p + '-' + r.i; counts[k] = (counts[k] || 0) + 1; });
    var exact = '-webkit-print-color-adjust:exact;print-color-adjust:exact;';
    var h = ['<div class="hm" role="group" aria-label="' + esc(t('risk.heatmap')) + '" style="display:grid;grid-template-columns:22px minmax(56px,140px) repeat(' + n + ',minmax(26px,' + cell + 'px));' +
      'gap:6px;align-items:center;width:max-content;max-width:100%;font-size:' + fs + 'px;line-height:1.2">'];
    // Y-Achsentitel (senkrecht, über alle Zeilen)
    h.push('<div style="grid-column:1;grid-row:1 / span ' + n + ';writing-mode:vertical-rl;transform:rotate(180deg);text-align:center;font-weight:700;letter-spacing:.02em">' + esc(iTitle) + '</div>');
    for (var row = 1; row <= n; row++) {
      var i = n - row + 1;                                   // oberste Zeile = höchste Auswirkung
      h.push('<div style="grid-column:2;grid-row:' + row + ';text-align:right;padding-right:4px;font-weight:600;hyphens:auto;overflow-wrap:break-word">' + esc(iLabels[i - 1]) + '<span style="opacity:.6;font-weight:400"> (' + i + ')</span></div>');
      for (var p = 1; p <= n; p++) {
        var cat = catFn(p, i), cnt = counts[p + '-' + i] || 0, sel = opts.selected === p + '-' + i;
        var tip = pTitle + ' ' + p + ' × ' + iTitle + ' ' + i + ' = ' + (p * i) + ' · ' + t('risk.cat.' + cat) + (cnt ? ' · ' + cnt : '');
        h.push('<div' + (opts.clickAct ? ' data-act="' + opts.clickAct + '" data-cell="' + p + '-' + i + '" role="button" tabindex="0"' : '') + ' title="' + esc(tip) + '" ' +
          'style="grid-column:' + (p + 2) + ';grid-row:' + row + ';aspect-ratio:1/1;border-radius:7px;background:' + COL[cat] + ';color:' + TXT[cat] + ';' + exact +
          'display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.35em;' + (opts.clickAct ? 'cursor:pointer;' : '') +
          (sel ? 'box-shadow:0 0 0 3px #111,0 0 0 5px #fff;' : cnt ? 'box-shadow:inset 0 0 0 2px rgba(255,255,255,.75);' : '') + '">' + (cnt || '') + '</div>');
      }
    }
    // Spaltenbeschriftungen + X-Achsentitel
    for (var q = 1; q <= n; q++) h.push('<div style="grid-column:' + (q + 2) + ';grid-row:' + (n + 1) + ';text-align:center;font-weight:600;align-self:start;hyphens:auto;overflow-wrap:break-word">' + esc(pLabels[q - 1]) + '<div style="opacity:.6;font-weight:400">(' + q + ')</div></div>');
    h.push('<div style="grid-column:3 / span ' + n + ';grid-row:' + (n + 2) + ';text-align:center;font-weight:700;border-top:1px solid currentColor;padding-top:4px;opacity:.9">' + esc(pTitle) + ' →</div>');
    h.push('</div>');
    return h.join('');
  }
  function legendHtml(catLabelPrefix, colors) {
    var COL = colors || COLORS;
    return '<div class="legend" style="display:flex;flex-wrap:wrap;gap:12px;font-size:.8em;margin-top:8px">' + CATS.map(function (c) {
      return '<span><i style="display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:middle;margin-right:4px;background:' + COL[c] + ';-webkit-print-color-adjust:exact;print-color-adjust:exact"></i>' + HA.Report.esc(t((catLabelPrefix || 'risk.cat.') + c)) + '</span>';
    }).join('') + '</div>';
  }
  function badge(cat, text, chance) {
    var COL = chance ? CH_COLORS : COLORS, TXT = chance ? CH_TEXT : TEXT;
    return '<span class="badge" style="background:' + COL[cat] + ';color:' + TXT[cat] + ';border-color:' + COL[cat] + ';-webkit-print-color-adjust:exact;print-color-adjust:exact">' + HA.Report.esc(text) + '</span>';
  }

  /* ------------------------------------------------------------------
   * 2. Projektrisiken (5 × 5, Risikowert = EW × Auswirkung)
   * ---------------------------------------------------------------- */
  function pmCategory(value) { return value >= 16 ? 'veryhigh' : value >= 10 ? 'high' : value >= 5 ? 'medium' : 'low'; }
  function pmCatCell(p, i) { return pmCategory(p * i); }
  var PM_STATUS = ['open', 'progress', 'done', 'occurred'];
  var PM_CATEGORIES = ['time', 'resources', 'technology', 'organisation', 'budget', 'compliance', 'external'];

  /** Typische Risiken eines Härtungsprojekts als Startpunkt (frei änderbar). */
  function exampleProjectRisks() {
    var de = HA.lang !== 'en';
    var R = function (title, cause, cat, p, i, strat, meas, trigger, rp, ri) {
      return { title: title, cause: cause, category: cat, p: p, i: i, strategy: strat, measures: meas, trigger: trigger, rp: rp, ri: ri, owner: '', due: '', status: 'open' };
    };
    return de ? [
      R('Aussperrung aus Systemen durch Änderungen an SSH, PAM oder Firewall', 'Fehlerhafte Konfiguration ohne Rückfallweg', 'technology', 3, 4, 'reduce',
        'Zweite Admin-Sitzung offen halten, Konsolenzugang (Proxmox/iLO) vorab testen, Änderungen per Backup-Datei und sshd -t prüfen', 'Verbindungsabbruch nach Neustart des Dienstes', 1, 4),
      R('Ausfall produktiver Dienste durch Härtungsmaßnahmen', 'Unbekannte Abhängigkeiten der Anwendungen (SELinux, noexec, Dienste)', 'technology', 3, 4, 'reduce',
        'Snapshot vor jeder Änderung, Test in Staging-VM, Änderungen nur im Wartungsfenster, Rollback-Plan', 'Monitoring-Alarm, Fehlermeldungen in Anwendungslogs', 2, 3),
      R('Zeitverzug durch fehlende Wartungsfenster (z. B. Convention-Zeiträume)', 'Verfügbarkeitsanforderungen im Eventbetrieb', 'time', 3, 3, 'avoid',
        'Change-Freeze-Kalender abstimmen, Härtung außerhalb von Events planen, Puffer einplanen', 'Termin einer Convention rückt näher', 2, 2),
      R('Datenverlust bei fehlerhafter Konfigurationsänderung', 'Kein aktuelles, getestetes Backup vor der Änderung', 'technology', 2, 4, 'reduce',
        'Backup/Snapshot vor Änderungen verpflichtend, Wiederherstellung stichprobenartig testen', 'Backup-Job fehlgeschlagen', 1, 3),
      R('Fehlalarme bzw. Fehlinterpretation von Scan-Ergebnissen', 'Nicht authentifizierte Scans, veraltete Scanner-Feeds', 'technology', 3, 2, 'reduce',
        'Authentifizierte Scans, Feeds aktualisieren, Befunde manuell verifizieren und begründen', 'Hohe Zahl unplausibler Befunde', 2, 1),
      R('Ausfall der verantwortlichen Person (Krankheit, Urlaub)', 'Wissen und Zugänge auf eine Person konzentriert', 'resources', 2, 3, 'reduce',
        'Dokumentation in diesem Tool und im Passwortmanager, Vertretung benennen, Notfallzugang hinterlegen', 'Krankmeldung, Urlaubsplanung', 2, 2),
      R('Inkompatibilität einer Anwendung mit Härtungsvorgaben', 'Hersteller unterstützt Vorgabe nicht (z. B. TLS 1.2+, SELinux)', 'external', 2, 3, 'transfer',
        'Herstellersupport einbinden, Ausnahme mit Begründung dokumentieren, kompensierende Maßnahme festlegen', 'Hersteller-Rückmeldung negativ', 2, 2),
      R('Fehlende Zugangsdaten oder Berechtigungen für Prüfungen', 'Externe Systeme (Managed Backup, vServer) unter Anbieterverwaltung', 'organisation', 2, 2, 'reduce',
        'Zugänge frühzeitig beantragen, Prüfumfang mit Anbieter abstimmen, Anbieter-Nachweise anfordern', 'Keine Rückmeldung des Anbieters', 1, 2)
    ] : [
      R('Lock-out from systems after SSH, PAM or firewall changes', 'Misconfiguration without fallback', 'technology', 3, 4, 'reduce', 'Keep second admin session, test console access, validate configs before reload', 'Connection lost after service restart', 1, 4),
      R('Outage of production services caused by hardening', 'Unknown application dependencies', 'technology', 3, 4, 'reduce', 'Snapshot before changes, staging test, maintenance windows, rollback plan', 'Monitoring alert', 2, 3),
      R('Delay due to missing maintenance windows', 'Availability requirements during events', 'time', 3, 3, 'avoid', 'Agree change-freeze calendar, plan buffer', 'Event date approaching', 2, 2),
      R('Data loss after faulty configuration change', 'No current tested backup', 'technology', 2, 4, 'reduce', 'Mandatory backup/snapshot, sample restore tests', 'Backup job failed', 1, 3),
      R('False positives / misinterpreted scan results', 'Unauthenticated scans, outdated feeds', 'technology', 3, 2, 'reduce', 'Authenticated scans, verify findings manually', 'Many implausible findings', 2, 1),
      R('Responsible person unavailable', 'Knowledge concentrated on one person', 'resources', 2, 3, 'reduce', 'Documentation, deputy, emergency access', 'Sick leave, holidays', 2, 2)
    ];
  }

  /* ------------------------------------------------------------------
   * 3. Roadmap
   * ---------------------------------------------------------------- */
  var PHASES = ['p1', 'p2', 'p3', 'p4'];
  function prioFromCat(cat) { return { veryhigh: 'p1', high: 'p2', medium: 'p3', low: 'p4' }[cat] || 'p4'; }

  /** Offene Punkte aus Befunden, Checkliste und Projektrisiken priorisieren. */
  function roadmap(state, opts) {
    opts = opts || {};
    var A = HA.App, list = [];
    // a) Befunde (offen / teilweise)
    findingRows(state, { assetId: opts.assetId }).forEach(function (r) {
      if (r.status !== 'open' && r.status !== 'partial') return;
      if (r.treatment === 'accept') return;
      list.push({ kind: 'finding', prio: prioFromCat(r.cat), cat: r.cat, score: r.value, ref: r.id, title: r.f.title, asset: r.asset.name,
        detail: r.scan.tool + (r.f.port ? ' · ' + r.f.port : ''), action: r.measure || r.f.solution || '', owner: r.owner, due: r.due, status: t('fstatus.' + r.status),
        set: { type: 'finding', fid: r.fid } });
    });
    // b) Maßnahmen der Checkliste (offen / teilweise)
    state.assets.forEach(function (a) {
      if (opts.assetId && a.id !== opts.assetId) return;
      var high = protection(a) !== 'normal';
      A.applicableItems(a).forEach(function (it) {
        var c = A.getCheck(a, it), st = c.status || 'open';
        if (st !== 'open' && st !== 'partial') return;
        var lv = it.level || 'S';
        var prio = lv === 'B' ? (high ? 'p1' : 'p2') : lv === 'S' ? (high ? 'p2' : 'p3') : 'p4';
        var cat = { p1: 'veryhigh', p2: 'high', p3: 'medium', p4: 'low' }[prio];
        list.push({ kind: 'measure', prio: prio, cat: cat, score: { B: 12, S: 6, H: 3 }[lv] + (high ? 2 : 0), ref: it.ref, title: HA.tx(it.title), asset: a.name,
          detail: A.getLib(it.lib).short + ' · ' + lv, action: c.note || HA.tx(it.desc) || '', owner: c.responsible || a.owner || '', due: c.due || '', status: t('status.' + st),
          set: { type: 'check', assetId: a.id, key: it.lib + '|' + it.ref } });
      });
    });
    // c) Projektrisiken (offen / in Bearbeitung)
    if (!opts.assetId || opts.includeProject) (state.projectRisks || []).forEach(function (pr) {
      if (pr.status === 'done' || pr.status === 'occurred') return;
      var v = (pr.p || 1) * (pr.i || 1), cat = pmCategory(v);
      list.push({ kind: 'project', prio: prioFromCat(cat), cat: cat, score: v, ref: pr.id, title: pr.title, asset: t('pm.project'),
        detail: t('pm.cat.' + (pr.category || 'technology')), action: pr.measures || '', owner: pr.owner || '', due: pr.due || '', status: t('pm.st.' + (pr.status || 'open')),
        set: { type: 'project', id: pr.id } });
    });
    var today = new Date().toISOString().slice(0, 10);
    list.forEach(function (x) { x.overdue = !!(x.due && x.due < today); });
    var order = { p1: 0, p2: 1, p3: 2, p4: 3 };
    list.sort(function (x, y) { return (order[x.prio] - order[y.prio]) || (y.score - x.score) || (x.due || '9999').localeCompare(y.due || '9999'); });
    return list;
  }

  /** Roadmap als CSV (Semikolon, UTF-8 mit BOM – öffnet direkt in Excel). */
  function roadmapCsv(list) {
    var q = function (v) { v = String(v === undefined || v === null ? '' : v); return '"' + v.replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"'; };
    var head = ['Priorität', 'Zeithorizont', 'Typ', 'ID', 'Asset', 'Titel', 'Details', 'Maßnahme/Lösung', 'Verantwortlich', 'Termin', 'Überfällig', 'Status'];
    var lines = [head.map(q).join(';')];
    list.forEach(function (x) {
      lines.push([x.prio.toUpperCase(), t('rm.' + x.prio), t('rm.kind.' + x.kind), x.ref, x.asset, x.title, x.detail, x.action, x.owner, x.due, x.overdue ? 'ja' : '', x.status].map(q).join(';'));
    });
    return '﻿' + lines.join('\r\n');
  }

  /* ------------------------------------------------------------------
   * 4. TOM-Übersicht (Art. 32 DSGVO) – Zuordnung über die Themen
   * ---------------------------------------------------------------- */
  var TOM = [
    { id: 'access', law: 'Art. 32 Abs. 1 lit. b (Vertraulichkeit)', topics: ['accounts', 'privilege', 'remote'] },
    { id: 'transfer', law: 'Art. 32 Abs. 1 lit. a/b (Verschlüsselung, Vertraulichkeit)', topics: ['crypto', 'network', 'media', 'privacy'] },
    { id: 'input', law: 'Art. 32 Abs. 1 lit. b (Integrität, Nachvollziehbarkeit)', topics: ['logging', 'integrity'] },
    { id: 'protect', law: 'Art. 32 Abs. 1 lit. b (Integrität, Belastbarkeit)', topics: ['malware', 'exploit', 'patch', 'boot', 'install', 'services'] },
    { id: 'avail', law: 'Art. 32 Abs. 1 lit. b/c (Verfügbarkeit, Wiederherstellbarkeit)', topics: ['availability'] },
    { id: 'review', law: 'Art. 32 Abs. 1 lit. d (Überprüfung, Bewertung, Evaluierung)', topics: ['planning', 'lifecycle'] }
  ];
  function tomSummary(state, assetId) {
    var A = HA.App;
    var rows = TOM.map(function (x) { return { tom: x, done: 0, partial: 0, open: 0, notdone: 0, na: 0, effective: 0 }; });
    var scans = 0, verified = 0;
    state.assets.forEach(function (a) {
      if (assetId && a.id !== assetId) return;
      scans += (a.scans || []).length;
      A.applicableItems(a).forEach(function (it) {
        var row = rows.find(function (r) { return r.tom.topics.indexOf(it.topic) >= 0; }); if (!row) return;
        var c = A.getCheck(a, it); row[c.status || 'open']++;
        if (c.verResult === 'effective') { row.effective++; verified++; }
      });
    });
    return { rows: rows, scans: scans, verified: verified };
  }


  /* ------------------------------------------------------------------
   * 5. Chancen & SWOT
   * ---------------------------------------------------------------- */
  var CH_STRATEGIES = ['exploit', 'enhance', 'share', 'accept'];
  var CH_STATUS = ['open', 'progress', 'realized', 'missed'];
  function exampleChances() {
    var de = HA.lang !== 'en';
    var C = function (title, cause, cat, p, i, strat, meas) { return { title: title, cause: cause, category: cat, p: p, i: i, strategy: strat, measures: meas, owner: '', due: '', status: 'open' }; };
    return de ? [
      C('Automatisierte Nachweise durch OpenSCAP/Lynis-Scans', 'Wiederholbare Scans statt manueller Prüfung', 'technology', 4, 4, 'exploit', 'Scans als monatliche Routine einplanen, Ergebnisse importieren und Abweichungen direkt in die Roadmap übernehmen'),
      C('Wiederverwendbare Härtungsvorlage für weitere Server', 'Dokumentierte Drop-in-Konfigurationen (SSH, sysctl, Firewall)', 'organisation', 4, 3, 'enhance', 'Konfigurationen als Vorlage/Ansible-Rolle ablegen, bei neuen Servern verpflichtend anwenden'),
      C('Vertrauensgewinn bei Veranstaltern, Gästen und Sponsoren', 'Nachweisbare Datenschutz- und Sicherheitsmaßnahmen (TOM)', 'compliance', 3, 4, 'exploit', 'Kurzfassung des Berichts/TOM-Übersicht für Partner bereitstellen'),
      C('Weniger Störungen durch reduzierte Angriffsfläche', 'Deaktivierte Dienste, geschlossene Ports, aktuelle Pakete', 'technology', 3, 3, 'enhance', 'Ports und Dienste regelmäßig gegen die Sollliste prüfen'),
      C('Wissenstransfer im Team', 'Anleitungen und Begründungen im Tool dokumentiert', 'resources', 3, 2, 'share', 'Kurzschulung für Vertretung, Anleitung im Team teilen')
    ] : [
      C('Automated evidence via OpenSCAP/Lynis scans', 'Repeatable scans instead of manual checks', 'technology', 4, 4, 'exploit', 'Schedule monthly scans, import results'),
      C('Reusable hardening template for further servers', 'Documented drop-in configurations', 'organisation', 4, 3, 'enhance', 'Store as template/Ansible role'),
      C('Increased trust of partners', 'Demonstrable security and privacy measures', 'compliance', 3, 4, 'exploit', 'Share TOM summary with partners')
    ];
  }
  /** Fakten aus dem Audit als SWOT-Vorschläge (Stärken/Schwächen). */
  function swotDerive(state) {
    var A = HA.App, de = HA.lang !== 'en', S = [], W = [];
    var tot = { done: 0, partial: 0, applicable: 0, verified: 0, missingJust: 0 };
    state.assets.forEach(function (a) { var s = A.assetStats(a); tot.done += s.done; tot.partial += s.partial; tot.applicable += s.applicable; tot.verified += s.verified; tot.missingJust += s.missingJust; });
    var pct = tot.applicable ? Math.round((tot.done + tot.partial * 0.5) / tot.applicable * 100) : 0;
    var withVuln = state.assets.filter(function (a) { return (a.scans || []).some(function (s) { return s.tool === 'openvas'; }); }).length;
    var sbOk = state.assets.filter(function (a) { return a.sb && a.sb.cNote && a.sb.iNote && a.sb.aNote; }).length;
    var rows = findingRows(state, {});
    var hi = rows.filter(function (r) { return (r.cat === 'high' || r.cat === 'veryhigh') && (r.status === 'open' || r.status === 'partial'); }).length;
    var open = rows.filter(function (r) { return r.status === 'open' || r.status === 'partial'; }).length;
    if (pct >= 50) S.push(de ? 'Umsetzungsgrad der Härtung: ' + pct + ' % über ' + state.assets.length + ' Assets' : 'Hardening implementation level: ' + pct + ' %');
    if (tot.verified) S.push(de ? tot.verified + ' Maßnahmen mit dokumentierter Wirksamkeitsprüfung' : tot.verified + ' measures with documented effectiveness review');
    if (withVuln) S.push(de ? 'Schwachstellenscans (OpenVAS) mit Zeitstempel/Hash für ' + withVuln + ' von ' + state.assets.length + ' Assets' : 'Vulnerability scans for ' + withVuln + ' of ' + state.assets.length + ' assets');
    if (sbOk) S.push(de ? 'Schutzbedarf für ' + sbOk + ' Assets vollständig begründet' : 'Protection needs fully justified for ' + sbOk + ' assets');
    if (pct < 50) W.push(de ? 'Umsetzungsgrad der Härtung erst ' + pct + ' %' : 'Hardening implementation level only ' + pct + ' %');
    if (open) W.push(de ? open + ' offene Befunde, davon ' + hi + ' mit Risiko hoch/sehr hoch' : open + ' open findings, ' + hi + ' rated high/very high');
    if (state.assets.length - withVuln) W.push(de ? (state.assets.length - withVuln) + ' Assets ohne Schwachstellenscan' : (state.assets.length - withVuln) + ' assets without vulnerability scan');
    if (tot.missingJust) W.push(de ? tot.missingJust + ' gestrichene/nicht umgesetzte Maßnahmen ohne Begründung' : tot.missingJust + ' removed/not implemented measures without justification');
    return { s: S, w: W };
  }

  return {
    CATS: CATS, CH_COLORS: CH_COLORS, CH_TEXT: CH_TEXT, CH_STRATEGIES: CH_STRATEGIES, CH_STATUS: CH_STATUS, exampleChances: exampleChances, swotDerive: swotDerive, COLORS: COLORS, TEXT: TEXT, THREATS: THREATS, PHASES: PHASES, PM_STATUS: PM_STATUS, PM_CATEGORIES: PM_CATEGORIES, TOM: TOM,
    category: category, findingRows: findingRows, ensureIds: ensureIds, latestScans: latestScans, suggest: suggest, heatmapHtml: heatmapHtml,
    legendHtml: legendHtml, badge: badge, pmCategory: pmCategory, pmCatCell: pmCatCell, exampleProjectRisks: exampleProjectRisks,
    roadmap: roadmap, roadmapCsv: roadmapCsv, tomSummary: tomSummary, protection: protection
  };
})();

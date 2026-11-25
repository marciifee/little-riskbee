/* =====================================================================
 * modules/kpi.js – KPI-Dashboard, Zielwerte und fehlende Daten
 * ---------------------------------------------------------------------
 *  • Eingebaute Kennzahlen werden laufend aus den Daten berechnet
 *    (Härtung, Schwachstellen, Risiken, Compliance, BCM).
 *  • Zielwert und Warnschwelle je KPI sind einstellbar („Ziele setzen“),
 *    einzelne KPIs lassen sich ausblenden.
 *  • Eigene KPIs mit manuell erfassten Messwerten (z. B. Phishing-
 *    Klickrate, Schulungsquote) inkl. Erfassungsintervall → Erinnerung.
 *  • „Fehlende Daten“ zeigt, welche Angaben für aussagekräftige KPIs
 *    fehlen – jeweils mit Sprung an die richtige Stelle.
 *  • Verlauf: Kennzahlenstand wird wöchentlich automatisch (oder per
 *    Knopf) festgehalten und als Mini-Verlauf (Sparkline) gezeigt.
 * Datenmodell: state.kpi = { targets{id:{target,warn,off}}, custom[], snapshots[] }
 * ===================================================================== */
window.HA = window.HA || {};

HA.KPI = (function () {
  'use strict';
  var A = HA.App, K = HA.Kit, L = K.L, esc = A.esc, t = HA.t;
  var U = { edit: false };
  function S() { return A.state(); }

  A.ext.normalize.push(function (s) {
    s.kpi = s.kpi || {}; s.kpi.targets = s.kpi.targets || {}; if (!Array.isArray(s.kpi.custom)) s.kpi.custom = []; if (!Array.isArray(s.kpi.snapshots)) s.kpi.snapshots = [];
    s.kpi.custom.forEach(function (c) { c.values = c.values || []; });
  });

  /* ------------------------------------------------------------------
   * Hilfsrechnungen
   * ---------------------------------------------------------------- */
  function pct(a, b) { return b ? Math.round(a / b * 1000) / 10 : null; }
  function stats(s) {
    var tot = { applicable: 0, done: 0, partial: 0, verified: 0, missingJust: 0 };
    s.assets.forEach(function (a) { var x = A.assetStats ? HA.App.assetStats(a) : null; if (x) Object.keys(tot).forEach(function (k) { tot[k] += x[k] || 0; }); });
    return tot;
  }
  function latestFindings(s) {
    var out = [];
    s.assets.forEach(function (a) { HA.Risk.latestScans(a).forEach(function (sc) { (sc.findings || []).forEach(function (f) { if (sc.tool !== 'nmap') out.push(f); }); }); });
    return out;
  }
  function bcm() { return HA.BCM ? HA.BCM.metrics() : null; }

  /* ------------------------------------------------------------------
   * Eingebaute Kennzahlen
   * calc(state) → { v: Wert | null (keine Daten), d: Detailtext, gap: Hinweis bei null }
   * ---------------------------------------------------------------- */
  var DEFS = [
    { id: 'impl', g: 'hard', u: '%', dir: 'up', t: 90, w: 70, go: 'checklist', n: ['Umsetzungsgrad Härtungsmaßnahmen', 'Hardening implementation rate'],
      calc: function (s) { var x = stats(s); return { v: x.applicable ? Math.round((x.done + x.partial * 0.5) / x.applicable * 1000) / 10 : null, d: x.done + ' / ' + x.applicable, gap: L('Assets mit Bibliotheken anlegen', 'Add assets with libraries') }; } },
    { id: 'verified', g: 'hard', u: '%', dir: 'up', t: 80, w: 50, go: 'checklist', n: ['Wirksamkeit verifiziert (Anteil umgesetzter/teilweise)', 'Effectiveness verified (share of implemented/partial)'],
      calc: function (s) { var x = stats(s), base = x.done + x.partial, v = Math.min(x.verified, base); return { v: pct(v, base), d: v + ' / ' + base, gap: L('Noch keine umgesetzten Maßnahmen', 'No implemented measures yet') }; } },
    { id: 'just', g: 'hard', u: '#', dir: 'down', t: 0, w: 3, go: 'checklist', n: ['Abweichungen ohne Begründung', 'Deviations without justification'],
      calc: function (s) { return { v: s.assets.length ? stats(s).missingJust : null, gap: L('Keine Assets', 'No assets') }; } },
    { id: 'sb', g: 'hard', u: '%', dir: 'up', t: 100, w: 80, go: 'protection', n: ['Schutzbedarf begründet', 'Protection needs justified'],
      calc: function (s) { var ok = s.assets.filter(function (a) { return a.sb && a.sb.cNote && a.sb.iNote && a.sb.aNote; }).length; return { v: pct(ok, s.assets.length), d: ok + ' / ' + s.assets.length, gap: L('Keine Assets', 'No assets') }; } },
    { id: 'crit', g: 'vuln', u: '#', dir: 'down', t: 0, w: 2, go: 'scans', n: ['Offene kritische/hohe Schwachstellen', 'Open critical/high vulnerabilities'],
      calc: function (s) { var f = latestFindings(s); if (!f.length && !s.assets.some(function (a) { return (a.scans || []).length; })) return { v: null, gap: L('Scans importieren', 'Import scans') };
        return { v: f.filter(function (x) { return (x.severity === 'critical' || x.severity === 'high') && ['open', 'partial'].indexOf(x.status || 'open') >= 0; }).length }; } },
    { id: 'fix', g: 'vuln', u: '%', dir: 'up', t: 80, w: 50, go: 'scans', n: ['Behobene Befunde', 'Fixed findings'],
      calc: function (s) { var f = latestFindings(s).filter(function (x) { return x.status !== 'falsepositive' && x.severity !== 'info'; }); return { v: pct(f.filter(function (x) { return x.status === 'fixed'; }).length, f.length), d: f.length + ' ' + L('Befunde', 'findings'), gap: L('Scans importieren', 'Import scans') }; } },
    { id: 'fresh', g: 'vuln', u: '%', dir: 'up', t: 100, w: 80, go: 'import', n: ['Assets mit aktuellem Schwachstellenscan', 'Assets with current vulnerability scan'],
      calc: function (s) { var lim = +s.meta.staleDays || 90, ok = s.assets.filter(function (a) { return (a.scans || []).some(function (x) { return x.tool === 'openvas' && (Date.now() - new Date(x.scanDate || x.importedAt)) / 864e5 <= lim; }); }).length;
        return { v: pct(ok, s.assets.length), d: ok + ' / ' + s.assets.length + ' (≤ ' + lim + ' ' + L('Tage', 'days') + ')', gap: L('Keine Assets', 'No assets') }; } },
    { id: 'rated', g: 'risk', u: '%', dir: 'up', t: 100, w: 70, go: 'risk', n: ['Befundrisiken fachlich bewertet', 'Finding risks assessed'],
      calc: function (s) { var r = HA.Risk.findingRows(s, {}); return { v: pct(r.filter(function (x) { return !x.suggested; }).length, r.length), d: r.length + ' ' + L('Risiken', 'risks'), gap: L('Keine Befundrisiken', 'No finding risks') }; } },
    { id: 'owner', g: 'risk', u: '%', dir: 'up', t: 100, w: 80, go: 'register', n: ['Risiken mit Risikoeigner/in', 'Risks with risk owner'],
      calc: function (s) { var r = HA.Register ? HA.Register.rows({}) : []; return { v: pct(r.filter(function (x) { return x.owner; }).length, r.length), d: r.length + ' ' + L('Risiken', 'risks'), gap: L('Keine Risiken im Register', 'No risks in register') }; } },
    { id: 'appetite', g: 'risk', u: '#', dir: 'down', t: 0, w: 2, go: 'register', n: ['Risiken über Appetit ohne gültige Entscheidung', 'Risks above appetite without valid decision'],
      calc: function (s) { var r = HA.Register ? HA.Register.rows({}) : []; if (!r.length) return { v: null, gap: L('Keine Risiken im Register', 'No risks in register') };
        return { v: r.filter(function (x) { return ['decision', 'intolerable', 'expired', 'undoc'].indexOf(x.ap) >= 0; }).length }; } },
    { id: 'ale', g: 'risk', u: '€', dir: 'down', go: 'register', n: ['Erwarteter Jahresverlust netto (Monte-Carlo)', 'Expected annual loss net (Monte Carlo)'], tFrom: 'lossAppetite',
      calc: function (s) { return { v: s.mc ? Math.round(s.mc.res.mean) : null, d: s.mc ? 'P90 ' + K.money(s.mc.res.p90) : '', gap: L('Monte-Carlo-Simulation starten', 'Run Monte Carlo simulation') }; } },
    { id: 'p90', g: 'risk', u: '€', dir: 'down', go: 'register', n: ['Jahresverlust P90 netto (Monte-Carlo)', 'Annual loss P90 net (Monte Carlo)'], tFrom: 'lossTolerance',
      calc: function (s) { return { v: s.mc ? Math.round(s.mc.res.p90) : null, gap: L('Monte-Carlo-Simulation starten', 'Run Monte Carlo simulation') }; } },
    { id: 'rm', g: 'comp', u: '#', dir: 'down', t: 0, w: 3, go: 'roadmap', n: ['Überfällige Roadmap-Maßnahmen', 'Overdue roadmap measures'],
      calc: function (s) { return { v: HA.Risk.roadmap(s, { includeProject: true }).filter(function (x) { return x.overdue; }).length }; } },
    { id: 'duty', g: 'comp', u: '#', dir: 'down', t: 0, w: 2, go: 'calendar', n: ['Überfällige Pflichten & Reviews', 'Overdue duties & reviews'],
      calc: function (s) { return HA.Cal ? { v: HA.Cal.counts().overdue } : { v: null }; } },
    { id: 'ontime', g: 'comp', u: '%', dir: 'up', t: 90, w: 70, go: 'calendar', n: ['Pflichten fristgerecht erledigt (12 Monate)', 'Duties completed on time (12 months)'],
      calc: function (s) { var from = K.addMonths(K.today(), -12), all = 0, ok = 0;
        s.duties.forEach(function (d) { d.history.forEach(function (h) { if (h.date >= from && h.due) { all++; if (h.date <= h.due) ok++; } }); });
        return { v: pct(ok, all), d: ok + ' / ' + all, gap: L('Noch keine erledigten Pflichten', 'No completed duties yet') }; } },
    { id: 'bia', g: 'bcm', u: '%', dir: 'up', t: 100, w: 80, go: 'bia', n: ['Geschäftsprozesse mit vollständiger BIA (MTA/RTO/RPO)', 'Processes with complete BIA (MTPD/RTO/RPO)'],
      calc: function () { var b = bcm(); return { v: b ? pct(b.biaComplete, b.processes) : null, d: b ? b.biaComplete + ' / ' + b.processes : '', gap: L('Geschäftsprozesse in der BIA erfassen', 'Add business processes in the BIA') }; } },
    { id: 'rto', g: 'bcm', u: '%', dir: 'up', t: 100, w: 90, go: 'bia', n: ['Prozesse mit RTO kleiner MTA', 'Processes with RTO below MTPD'],
      calc: function () { var b = bcm(); return { v: b ? pct(b.rtoOk, b.rtoSet) : null, d: b ? b.rtoOk + ' / ' + b.rtoSet : '', gap: L('RTO und MTA in der BIA eintragen', 'Enter RTO and MTPD in the BIA') }; } },
    { id: 'plan', g: 'bcm', u: '%', dir: 'up', t: 100, w: 80, go: 'bcplans', n: ['Zeitkritische Prozesse mit BC-Plan', 'Time-critical processes with BC plan'],
      calc: function () { var b = bcm(); return { v: b ? pct(b.critWithPlan, b.critical) : null, d: b ? b.critWithPlan + ' / ' + b.critical : '', gap: L('Keine zeitkritischen Prozesse', 'No time-critical processes') }; } },
    { id: 'tested', g: 'bcm', u: '%', dir: 'up', t: 100, w: 70, go: 'exercises', n: ['BC-Pläne in den letzten 12 Monaten geübt', 'BC plans exercised in last 12 months'],
      calc: function () { var b = bcm(); return { v: b ? pct(b.plansTested, b.plans) : null, d: b ? b.plansTested + ' / ' + b.plans : '', gap: L('BC-Pläne anlegen', 'Add BC plans') }; } },
    { id: 'proven', g: 'bcm', u: '%', dir: 'up', t: 100, w: 70, go: 'bcplans', n: ['Pläne mit nachgewiesener Wiederanlaufzeit ≤ RTO', 'Plans with proven recovery time ≤ RTO'],
      calc: function () { var b = bcm(); return { v: b ? pct(b.proven, b.plansWithAchieved) : null, d: b ? b.proven + ' / ' + b.plansWithAchieved : '', gap: L('Erreichte Wiederanlaufzeit in Übungsauswertungen erfassen', 'Record achieved recovery time in exercise evaluations') }; } },
    { id: 'exeval', g: 'bcm', u: '%', dir: 'up', t: 100, w: 80, go: 'exercises', n: ['Durchgeführte Übungen ausgewertet', 'Conducted exercises evaluated'],
      calc: function () { var b = bcm(); return { v: b ? pct(b.exEvaluated, b.exConducted) : null, d: b ? b.exEvaluated + ' / ' + b.exConducted : '', gap: L('Noch keine durchgeführten Übungen', 'No conducted exercises yet') }; } },
    { id: 'crisis', g: 'bcm', u: '%', dir: 'up', t: 100, w: 80, go: 'crisis', n: ['Krisenstab-Rollen mit Person und Vertretung', 'Crisis team roles with person and deputy'],
      calc: function () { var b = bcm(); return { v: b ? pct(b.rolesFull, b.roles) : null, d: b ? b.rolesFull + ' / ' + b.roles : '', gap: L('Krisenstab-Rollen anlegen', 'Add crisis team roles') }; } }
  ];
  var GROUPS = { hard: ['Härtung (Do)', 'Hardening (Do)'], vuln: ['Schwachstellen (Check)', 'Vulnerabilities (Check)'], risk: ['Risiko', 'Risk'], comp: ['Compliance & Termine (Act)', 'Compliance & deadlines (Act)'], bcm: ['Business Continuity', 'Business continuity'], custom: ['Eigene KPIs', 'Custom KPIs'] };

  function target(def) {
    var s = S(), tg = s.kpi.targets[def.id] || {};
    var tv = tg.target !== undefined && tg.target !== '' ? +tg.target : def.tFrom ? (s.appetite[def.tFrom] === '' ? null : +s.appetite[def.tFrom]) : def.t;
    var wv = tg.warn !== undefined && tg.warn !== '' ? +tg.warn : def.tFrom ? (tv === null ? null : tv * 1.25) : def.w;
    return { t: tv === undefined ? null : tv, w: wv === undefined ? null : wv, off: !!tg.off };
  }
  function level(v, tg, dir) {
    if (v === null || v === undefined) return 'none';
    if (tg.t === null || tg.t === undefined) return 'notarget';
    if (dir === 'up') return v >= tg.t ? 'ok' : (tg.w !== null && v >= tg.w ? 'warn' : 'bad');
    return v <= tg.t ? 'ok' : (tg.w !== null && v <= tg.w ? 'warn' : 'bad');
  }
  function fmtV(v, u) { if (v === null || v === undefined) return '–'; return u === '%' ? K.num(v, 1) + ' %' : u === '€' ? K.money(v) : u === '#' ? String(v) : K.num(v, 2) + (u ? ' ' + u : ''); }
  /** Alle KPI-Werte (eingebaut + eigene). */
  function all() {
    var s = S(), out = [];
    DEFS.forEach(function (d) {
      var r; try { r = d.calc(s) || {}; } catch (e) { r = { v: null, gap: e.message }; }
      var tg = target(d);
      out.push({ id: d.id, g: d.g, name: K.lab(d.n), u: d.u, dir: d.dir, v: r.v, d: r.d || '', gap: r.gap || '', tg: tg, lv: level(r.v, tg, d.dir), go: d.go, builtin: true });
    });
    s.kpi.custom.forEach(function (c) {
      var last = c.values.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).pop();
      var tg = { t: c.target === '' || c.target === undefined ? null : +c.target, w: c.warn === '' || c.warn === undefined ? null : +c.warn, off: false };
      out.push({ id: 'c:' + c.id, cid: c.id, g: 'custom', name: c.name, u: c.unit || '', dir: c.dir || 'up', v: last ? +last.value : null, d: last ? K.fmt(last.date) + (c.owner ? ' · ' + c.owner : '') : '', gap: L('Messwert erfassen', 'Record a value'), tg: tg, lv: level(last ? +last.value : null, tg, c.dir || 'up'), custom: c });
    });
    return out;
  }
  function snapshot(force) {
    var s = S(), last = s.kpi.snapshots[s.kpi.snapshots.length - 1], today = K.today();
    if (!force && last && K.diffDays(last.date, today) < 7) return false;
    var vals = {}; all().forEach(function (k) { if (k.v !== null && k.v !== undefined && !k.custom) vals[k.id] = k.v; });
    if (last && last.date === today) last.values = vals; else s.kpi.snapshots.push({ date: today, values: vals });
    if (s.kpi.snapshots.length > 104) s.kpi.snapshots = s.kpi.snapshots.slice(-104);   // max. 2 Jahre wöchentlich
    A.save(); return true;
  }
  function spark(points, color) {
    if (!points || points.length < 2) return '';
    var w = 110, h = 26, mn = Math.min.apply(null, points), mx = Math.max.apply(null, points), rg = mx - mn || 1;
    var d = points.map(function (v, i) { return (i ? 'L' : 'M') + (i / (points.length - 1) * (w - 4) + 2).toFixed(1) + ',' + (h - 3 - (v - mn) / rg * (h - 6)).toFixed(1); }).join('');
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true"><path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2"/></svg>';
  }
  function history(id) {
    var s = S();
    if (id.indexOf('c:') === 0) { var c = s.kpi.custom.find(function (x) { return 'c:' + x.id === id; }); return c ? c.values.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).map(function (x) { return +x.value; }) : []; }
    return s.kpi.snapshots.filter(function (x) { return x.values[id] !== undefined; }).map(function (x) { return x.values[id]; });
  }
  var LVC = { ok: K.AMP.ok, warn: K.AMP.warn, bad: K.AMP.bad, none: '#9aa3ad', notarget: '#9aa3ad' };

  /* ------------------------------------------------------------------
   * Fehlende Daten / Datenqualität
   * ---------------------------------------------------------------- */
  function gaps() {
    var s = S(), g = [];
    function add(cond, n, de, en, go, sev) { g.push({ ok: !cond, n: n, text: L(de, en), go: go, sev: sev || 'warn' }); }
    add(!s.meta.org, 0, 'Organisation in den Einstellungen eintragen', 'Enter organisation in settings', 'settings', 'info');
    add(!(s.contacts || []).length, 0, 'Ansprechpersonen anlegen (Auswahllisten für Verantwortliche)', 'Add contacts (drop-downs for owners)', 'settings', 'info');
    var noOwner = s.assets.filter(function (a) { return !a.owner; }).length; add(noOwner, noOwner, 'Assets ohne Verantwortliche/n', 'Assets without owner', 'assets');
    var noLib = s.assets.filter(function (a) { return !(a.libs || []).length && !(a.modules || []).length; }).length; add(noLib, noLib, 'Assets ohne Maßnahmenbibliothek', 'Assets without measure library', 'assets');
    var noSb = s.assets.filter(function (a) { return !(a.sb && a.sb.cNote && a.sb.iNote && a.sb.aNote); }).length; add(noSb, noSb, 'Schutzbedarf ohne Begründung', 'Protection needs without justification', 'protection');
    var noScan = s.assets.filter(function (a) { return !(a.scans || []).some(function (x) { return x.tool === 'openvas'; }); }).length; add(noScan, noScan, 'Assets ohne OpenVAS-Scan', 'Assets without OpenVAS scan', 'import');
    var unr = HA.Risk.findingRows(s, {}).filter(function (r) { return r.suggested; }).length; add(unr, unr, 'Befundrisiken nur mit Vorschlagswert bewertet', 'Finding risks with suggested rating only', 'risk');
    if (HA.Register) { var r = HA.Register.rows({}), no = r.filter(function (x) { return !x.owner; }).length; add(no, no, 'Risiken ohne Risikoeigner/in', 'Risks without risk owner', 'register'); }
    add(!s.appetite.statement, 0, 'Risikoappetit-Erklärung fehlt', 'Risk appetite statement missing', 'register');
    add(!s.appetite.approvedDate, 0, 'Risikoappetit nicht freigegeben (Freigabedatum)', 'Risk appetite not approved (approval date)', 'register');
    add(s.appetite.lossTolerance === '' || s.appetite.lossAppetite === '', 0, 'Verlustappetit/-toleranz (€) für Monte-Carlo-KPIs festlegen', 'Set loss appetite/tolerance (€) for Monte Carlo KPIs', 'register', 'info');
    add(!s.mc, 0, 'Monte-Carlo-Simulation noch nicht durchgeführt', 'Monte Carlo simulation not run yet', 'register', 'info');
    add(!(s.duties || []).length, 0, 'Keine Pflichten im Pflichtenkalender', 'No duties in duty calendar', 'calendar');
    var b = bcm();
    if (b) {
      add(!b.processes, 0, 'Keine Geschäftsprozesse in der BIA', 'No business processes in BIA', 'bia');
      add(b.processes - b.biaComplete, b.processes - b.biaComplete, 'Geschäftsprozesse ohne MTA/RTO/RPO', 'Processes without MTPD/RTO/RPO', 'bia');
      add(b.critical - b.critWithPlan, b.critical - b.critWithPlan, 'Zeitkritische Prozesse ohne BC-Plan', 'Time-critical processes without BC plan', 'bcplans');
      add(b.roles - b.rolesFull, b.roles - b.rolesFull, 'Krisenstab-Rollen ohne Person oder Vertretung', 'Crisis team roles without person or deputy', 'crisis');
      add(!b.exPlanned12, 0, 'Keine BC-Übung in den nächsten 12 Monaten geplant', 'No BC exercise planned in the next 12 months', 'exercises');
      add(b.sbMismatch, b.sbMismatch, 'Assets in zeitkritischen Prozessen mit Verfügbarkeit „normal“', 'Assets in time-critical processes with availability "normal"', 'protection');
    }
    var noT = all().filter(function (k) { return k.lv === 'notarget' && !k.tg.off; }).length; add(noT, noT, 'KPIs ohne Zielwert', 'KPIs without target', 'kpi', 'info');
    return g;
  }

  /* ------------------------------------------------------------------
   * Ansicht
   * ---------------------------------------------------------------- */
  function tile(k) {
    var col = LVC[k.lv], tgt = k.tg.t === null || k.tg.t === undefined ? L('Ziel fehlt', 'no target') : L('Ziel', 'Target') + ' ' + (k.dir === 'up' ? '≥ ' : '≤ ') + fmtV(k.tg.t, k.u);
    var h = '<div class="card kpi-tile" style="border-top:4px solid ' + col + '"><div class="kpi-name">' + esc(k.name) + '</div><div class="kpi-val" style="color:' + (k.lv === 'none' ? 'var(--text-muted)' : col) + '">' + fmtV(k.v, k.u) + '</div>' +
      '<div class="small muted">' + esc(tgt) + (k.d ? ' · ' + esc(k.d) : '') + '</div>' + spark(history(k.id), col);
    if (k.v === null) h += '<div class="small" style="margin-top:.3rem">⚠ ' + esc(L('Keine Daten', 'No data')) + ': ' + esc(k.gap) + '</div>';
    if (U.edit) h += '<div class="kpi-edit">' + (k.custom
      ? K.btn('kpiCEdit', '✏️ ' + L('bearbeiten', 'edit'), { id: k.cid, cls: 'btn-sm' })
      : '<label class="small">' + esc(L('Ziel', 'Target')) + '<input type="number" step="any" data-field="kpiT" data-id="' + k.id + '" data-k="target" value="' + esc((S().kpi.targets[k.id] || {}).target !== undefined ? S().kpi.targets[k.id].target : '') + '" placeholder="' + esc(k.tg.t === null ? '' : k.tg.t) + '"></label>' +
        '<label class="small">' + esc(L('Warnung ab', 'Warn at')) + '<input type="number" step="any" data-field="kpiT" data-id="' + k.id + '" data-k="warn" value="' + esc((S().kpi.targets[k.id] || {}).warn !== undefined ? S().kpi.targets[k.id].warn : '') + '" placeholder="' + esc(k.tg.w === null ? '' : k.tg.w) + '"></label>' +
        '<label class="small"><input type="checkbox" data-act="kpiOff" data-id="' + k.id + '"' + (k.tg.off ? ' checked' : '') + '> ' + esc(L('ausblenden', 'hide')) + '</label>') + '</div>';
    else h += '<div class="kpi-actions">' + (k.custom ? K.btn('kpiCVal', '+ ' + L('Wert', 'value'), { id: k.cid, cls: 'btn-sm' }) : '') + (k.go ? K.btn('kitGo', '↗', { id: k.go, cls: 'btn-sm', title: L('Daten öffnen', 'Open data') }) : '') + '</div>';
    return h + '</div>';
  }
  function view() {
    var s = S(), list = all(), shown = list.filter(function (k) { return U.edit || !k.tg.off; });
    var c = { ok: 0, warn: 0, bad: 0, none: 0 }; shown.forEach(function (k) { c[k.lv === 'notarget' ? 'none' : k.lv]++; });
    var h = [K.pageHead(t('nav.kpi'), L('Kennzahlen zur Steuerung von Informationssicherheit und BCM – mit Zielwerten, Ampel, Verlauf und Hinweisen auf fehlende Daten.', 'KPIs to steer information security and BCM – with targets, traffic lights, trend and hints on missing data.'),
      K.btn('kpiSnap', '📌 ' + L('Stand festhalten', 'Record snapshot'), { title: L('Aktuelle Werte für den Verlauf speichern (zusätzlich automatisch wöchentlich)', 'Save current values for the trend (also automatically weekly)') }) +
      K.btn('kpiEdit', U.edit ? '✔ ' + L('Fertig', 'Done') : '🎯 ' + L('Ziele setzen', 'Set targets'), { cls: U.edit ? 'btn-primary' : '' }) + K.btn('kpiCAdd', '+ ' + L('Eigene KPI', 'Custom KPI'), { cls: 'btn-primary' }))];
    h.push('<div class="grid grid-4">' + K.stat(c.ok, L('im Ziel', 'on target'), K.AMP.ok) + K.stat(c.warn, L('Warnbereich', 'warning'), K.AMP.warn) + K.stat(c.bad, L('verfehlt', 'missed'), K.AMP.bad) + K.stat(c.none, L('keine Daten / kein Ziel', 'no data / no target'), '#9aa3ad') + '</div>');
    // Fehlende Daten
    var g = gaps(), open = g.filter(function (x) { return !x.ok; }), score = Math.round((g.length - open.length) / g.length * 100);
    h.push('<details class="card"' + (open.length ? ' open' : '') + '><summary><b>🧩 ' + esc(L('Fehlende Daten & Datenqualität', 'Missing data & data quality')) + '</b> · ' + K.amp(score >= 90 ? 'ok' : score >= 60 ? 'warn' : 'bad', L('Vollständigkeit ', 'Completeness ') + score + ' %') + '</summary>' +
      (open.length ? '<p class="small muted">' + esc(L('Diese Angaben fehlen noch, damit die Kennzahlen aussagekräftig sind:', 'These details are still missing for meaningful KPIs:')) + '</p><ul class="gap-list">' + open.map(function (x) {
        return '<li><span>' + (x.sev === 'info' ? 'ℹ️' : '⚠️') + ' ' + esc(x.text) + (x.n ? ' <b>(' + x.n + ')</b>' : '') + '</span>' + K.btn('kitGo', L('ergänzen →', 'complete →'), { id: x.go, cls: 'btn-sm' }) + '</li>'; }).join('') + '</ul>'
        : '<p class="note ok">' + esc(L('Alle wesentlichen Daten sind vorhanden.', 'All essential data is available.')) + '</p>') + '</details>');
    if (U.edit) h.push('<div class="note">' + esc(L('Zielwert und Warnschwelle je KPI eintragen (leer = Standard, grau angezeigt). Für „höher ist besser“ gilt: Wert ≥ Ziel = grün, ≥ Warnung = gelb. Für „niedriger ist besser“ umgekehrt. Monte-Carlo-KPIs übernehmen Verlustappetit/-toleranz aus dem Risikoappetit.',
      'Enter target and warning threshold per KPI (empty = default, shown in grey). For "higher is better": value ≥ target = green, ≥ warning = yellow; reverse for "lower is better". Monte Carlo KPIs use loss appetite/tolerance from the risk appetite.')) + '</div>');
    Object.keys(GROUPS).forEach(function (gk) {
      var items = shown.filter(function (k) { return k.g === gk; }); if (!items.length && gk !== 'custom') return;
      h.push('<h2 class="kpi-group">' + esc(K.lab(GROUPS[gk])) + '</h2>');
      h.push(items.length ? '<div class="grid grid-4 kpi-grid">' + items.map(tile).join('') + '</div>' : '<div class="card muted small">' + esc(L('Eigene KPIs (z. B. Phishing-Klickrate, Schulungsquote, MTTR) mit „+ Eigene KPI“ anlegen.', 'Add custom KPIs (e.g. phishing click rate, training rate, MTTR) with "+ Custom KPI".')) + '</div>');
    });
    var last = s.kpi.snapshots[s.kpi.snapshots.length - 1];
    h.push('<p class="small muted">' + esc(L('Verlauf: ' + s.kpi.snapshots.length + ' festgehaltene Stände' + (last ? ', zuletzt ' + K.fmt(last.date) : ''), 'Trend: ' + s.kpi.snapshots.length + ' snapshots' + (last ? ', last ' + K.fmt(last.date) : ''))) + '</p>');
    return h.join('');
  }
  function dashCard() {
    var list = all().filter(function (k) { return !k.tg.off; }), bad = list.filter(function (k) { return k.lv === 'bad'; }), warn = list.filter(function (k) { return k.lv === 'warn'; }), ok = list.filter(function (k) { return k.lv === 'ok'; });
    var top = bad.concat(warn).slice(0, 6);
    return '<div class="card"><h2>🎯 ' + esc(t('nav.kpi')) + '</h2><div class="row small" style="gap:.4rem">' + K.amp('ok', ok.length + ' ' + L('im Ziel', 'on target')) + K.amp('warn', warn.length + ' ' + L('Warnung', 'warning')) + K.amp('bad', bad.length + ' ' + L('verfehlt', 'missed')) + '</div>' +
      (top.length ? '<ul class="gap-list" style="margin-top:.5rem">' + top.map(function (k) { return '<li><span>' + esc(k.name) + '</span><b style="color:' + LVC[k.lv] + '">' + fmtV(k.v, k.u) + '</b></li>'; }).join('') + '</ul>' : '') +
      '<a class="btn btn-sm" href="#kpi" style="margin-top:.5rem">' + esc(t('nav.kpi')) + ' →</a></div>';
  }

  /* ---------- eigene KPIs ---------- */
  function editCustom(c) {
    var s = S(), isNew = !c;
    K.editDialog(isNew ? L('Eigene KPI anlegen', 'Add custom KPI') : L('KPI bearbeiten', 'Edit KPI'), [
      { k: 'name', l: ['Bezeichnung', 'Name'], req: true, full: true, ph: ['z. B. Phishing-Klickrate', 'e.g. phishing click rate'] },
      { k: 'unit', l: ['Einheit', 'Unit'], ph: ['%, #, h, €', '%, #, h, €'] },
      { k: 'dir', l: ['Bewertung', 'Direction'], type: 'select', opts: [['up', ['höher ist besser', 'higher is better']], ['down', ['niedriger ist besser', 'lower is better']]] },
      { k: 'target', l: ['Zielwert', 'Target'], type: 'number' }, { k: 'warn', l: ['Warnschwelle', 'Warning threshold'], type: 'number' },
      { k: 'owner', l: ['Verantwortlich', 'Responsible'], type: 'person' },
      { k: 'freq', l: ['Erfassung', 'Measurement'], type: 'select', opts: [['', ['nach Bedarf', 'as needed']], ['1', ['monatlich', 'monthly']], ['3', ['vierteljährlich', 'quarterly']], ['6', ['halbjährlich', 'half-yearly']], ['12', ['jährlich', 'yearly']]], help: ['mit Intervall erscheint eine Erinnerung im Pflichtenkalender', 'with an interval a reminder appears in the duty calendar'] },
      { k: 'source', l: ['Datenquelle / Messmethode', 'Data source / method'], type: 'textarea', rows: 2, full: true }
    ], c || { name: '', unit: '%', dir: 'up', target: '', warn: '', owner: '', freq: '3', source: '', values: [] }, function (o) {
      if (isNew) { o.id = A.uid('k'); o.values = []; s.kpi.custom.push(o); }
    }, null, isNew ? '' : '');
    if (!isNew) {
      var form = document.getElementById('dlgForm'), b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-danger'; b.textContent = t('btn.delete');
      b.onclick = function () { s.kpi.custom = s.kpi.custom.filter(function (x) { return x.id !== c.id; }); document.getElementById('dlg').close(); A.save(); A.render(); };
      form.querySelector('.dlg-actions').prepend(b);
      if (c.values.length) form.querySelector('.kit-form').insertAdjacentHTML('afterend', '<h3>' + esc(L('Messwerte', 'Values')) + '</h3>' + K.table([L('Datum', 'Date'), L('Wert', 'Value'), L('Notiz', 'Note')], c.values.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).map(function (v) {
        return '<tr><td>' + K.fmt(v.date) + '</td><td>' + esc(v.value) + ' ' + esc(c.unit || '') + '</td><td class="small">' + esc(v.note || '') + '</td></tr>'; })));
    }
  }
  function addValue(c) {
    K.editDialog(L('Messwert erfassen', 'Record value') + ': ' + c.name, [{ k: 'date', l: ['Datum', 'Date'], type: 'date', req: true }, { k: 'value', l: ['Wert', 'Value'], type: 'number', req: true }, { k: 'note', l: ['Notiz', 'Note'], full: true }],
      { date: K.today(), value: '', note: '' }, function (o) { c.values.push({ date: o.date, value: o.value, note: o.note }); });
  }

  /* ------------------------------------------------------------------
   * Registrierung
   * ---------------------------------------------------------------- */
  A.views.kpi = view;
  A.ext.dashCards.push(dashCard);
  var snapped = false;
  A.ext.afterRender.push(function () {
    if (!snapped && S()) { snapped = true; setTimeout(function () { snapshot(false); }, 1500); }   // wöchentlicher Stand
    var bad = all().filter(function (k) { return !k.tg.off && k.lv === 'bad'; }).length; K.navBadge('kpi', bad, 'bad');
  });
  // Erinnerung zur Erfassung eigener KPIs
  if (HA.Cal) HA.Cal.providers.push(function (s) {
    return s.kpi.custom.filter(function (c) { return c.freq; }).map(function (c) {
      var last = c.values.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).pop();
      return { key: 'KPI:' + c.id, date: last ? K.addMonths(last.date, +c.freq) : K.today(), title: L('KPI-Wert erfassen', 'Record KPI value') + ': ' + c.name, sub: c.source || '', cat: 'report', src: 'kpi', owner: c.owner, go: 'kpi',
        done: function (st, o) { A.toast(L('Bitte den Messwert in der KPI erfassen.', 'Please record the value in the KPI.')); } };
    });
  });
  A.ext.click.push(function (act, el) {
    var s = S(), id = el.getAttribute('data-id');
    switch (act) {
      case 'kpiEdit': U.edit = !U.edit; A.render(); return true;
      case 'kpiSnap': snapshot(true); A.toast(L('Kennzahlenstand festgehalten', 'Snapshot recorded')); A.render(); return true;
      case 'kpiCAdd': editCustom(null); return true;
      case 'kpiCEdit': editCustom(s.kpi.custom.find(function (c) { return c.id === id; })); return true;
      case 'kpiCVal': addValue(s.kpi.custom.find(function (c) { return c.id === id; })); return true;
    }
  });
  A.ext.change.push(function (act, el) {
    var s = S();
    if (act === 'kpiOff') { var id = el.getAttribute('data-id'); s.kpi.targets[id] = Object.assign({}, s.kpi.targets[id] || {}, { off: el.checked }); A.save(); A.render(); return true; }
    if (act === 'kpiT') { A.render(); return true; }
  });
  A.ext.input.push(function (act, el) {
    if (act === 'kpiT') { var s = S(), id = el.getAttribute('data-id'); s.kpi.targets[id] = Object.assign({}, s.kpi.targets[id] || {}); s.kpi.targets[id][el.getAttribute('data-k')] = el.value === '' ? undefined : +el.value;
      if (s.kpi.targets[id][el.getAttribute('data-k')] === undefined) delete s.kpi.targets[id][el.getAttribute('data-k')]; A.save(); return true; }
  });
  // Bericht
  A.ext.reportOpts.push({ key: 'kpi', label: { de: 'KPI-Übersicht', en: 'KPI overview' } });
  HA.Report.ext.push({ key: 'kpi', build: function (state, scope, H) {
    var list = all().filter(function (k) { return !k.tg.off && k.v !== null; });
    if (!list.length) return '';
    var col = { ok: '#1a7f37', warn: '#a16207', bad: '#c62828', notarget: '#555', none: '#555' };
    var h = ['<section class="pb"><h2>' + H.esc(L('Kennzahlen (KPI)', 'Key performance indicators (KPI)')) + '</h2><p class="small">' + H.esc(L('Stand: ', 'As of: ')) + H.fmtDate(new Date().toISOString(), true) + '</p>'];
    Object.keys(GROUPS).forEach(function (gk) {
      var items = list.filter(function (k) { return k.g === gk; }); if (!items.length) return;
      h.push('<h3>' + H.esc(K.lab(GROUPS[gk])) + '</h3><table><thead><tr><th>' + H.esc(L('Kennzahl', 'KPI')) + '</th><th style="width:28mm">' + H.esc(L('Wert', 'Value')) + '</th><th style="width:28mm">' + H.esc(L('Ziel', 'Target')) + '</th><th style="width:22mm">' + H.esc(L('Bewertung', 'Rating')) + '</th></tr></thead><tbody>' +
        items.map(function (k) { var lv = { ok: L('im Ziel', 'on target'), warn: L('Warnung', 'warning'), bad: L('verfehlt', 'missed'), notarget: L('kein Ziel', 'no target'), none: '–' }[k.lv];
          return '<tr><td>' + H.esc(k.name) + (k.d ? '<div class="small muted">' + H.esc(k.d) + '</div>' : '') + '</td><td><b>' + fmtV(k.v, k.u) + '</b></td><td>' + (k.tg.t === null ? '–' : (k.dir === 'up' ? '≥ ' : '≤ ') + fmtV(k.tg.t, k.u)) + '</td><td style="color:' + col[k.lv] + ';font-weight:700">' + H.esc(lv) + '</td></tr>'; }).join('') + '</tbody></table>');
    });
    h.push('</section>');
    return h.join('');
  } });

  return { all: all, gaps: gaps, snapshot: snapshot, DEFS: DEFS };
})();

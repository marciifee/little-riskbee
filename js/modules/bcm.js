/* =====================================================================
 * modules/bcm.js – Business Continuity Management (in Anlehnung an BSI-Standard 200-4)
 * ---------------------------------------------------------------------
 *  1. Business-Impact-Analyse (BIA): Schadensverlauf je Geschäftsprozess
 *     über die Zeit → Vorschlag MTA/MTPD (maximal tolerierbare Ausfallzeit),
 *     geforderte Wiederanlaufzeit (WAZ/RTO), maximal tolerierbarer
 *     Datenverlust (RPO), Wiederanlaufniveau, Zeitkritikalität, Priorität,
 *     abgeleitete Anforderungen an Ressourcen (Assets).
 *  2. BC-Pläne mit Kontinuitätsstrategien. Ein Plan ohne eigene Ziele
 *     übernimmt RTO/RPO aus der BIA seines Geschäftsprozesses.
 *  3. Krisenstab (Besondere Aufbauorganisation, BAO): Rollen/Stabs-
 *     funktionen mit Vertretung, Eskalationsstufen Störung → Notfall →
 *     Krise, Eskalationspfade und Alarmierungskette.
 *  4. Übungsmanagement: Jahresübungsplan, Durchführung, Auswertung
 *     (Ergebnis, erreichte Wiederanlaufzeit, Lessons Learned, Maßnahmen).
 * Hinweis: Begriffe und Vorgehen sind an BSI 200-4 angelehnt; Skalen,
 * Intervalle und Schwellen sind Vorschläge und frei anpassbar.
 * ===================================================================== */
window.HA = window.HA || {};

HA.BCM = (function () {
  'use strict';
  var A = HA.App, K = HA.Kit, L = K.L, esc = A.esc, t = HA.t;
  var U = { biaTab: 'processes', exTab: 'list', exYear: new Date().getFullYear(), exStatus: '', open: {} };
  function S() { return A.state(); }
  function B() { return S().bcm; }

  /* ------------------------------------------------------------------
   * Stammdaten
   * ---------------------------------------------------------------- */
  var LEVELS = [[1, ['gering', 'low']], [2, ['mittel', 'medium']], [3, ['hoch', 'high']], [4, ['sehr hoch', 'very high']]];
  var LV_COL = { 0: 'transparent', 1: '#3fb54a', 2: '#f2c12e', 3: '#f0952a', 4: '#d9362b' };
  var DEFAULT_CATS = [
    { k: 'ops', l: ['Aufgabenerfüllung / Geschäftstätigkeit', 'Business operations'] }, { k: 'fin', l: ['Finanzielle Auswirkungen', 'Financial impact'] },
    { k: 'law', l: ['Gesetze, Vorschriften, Verträge', 'Laws, regulations, contracts'] }, { k: 'rep', l: ['Reputation / Außenwirkung', 'Reputation'] },
    { k: 'life', l: ['Leib und Leben / Gesundheit', 'Life and health'] }, { k: 'priv', l: ['Datenschutz / informationelle Selbstbestimmung', 'Data protection'] }];
  var PLAN_TYPES = [['bcp', ['Geschäftsfortführungsplan', 'Business continuation plan']], ['restart', ['Wiederanlaufplan', 'Restart plan']], ['recovery', ['Wiederherstellungsplan (IT)', 'Recovery plan (IT)']], ['site', ['Notfallplan Standort/Gebäude', 'Site/building emergency plan']], ['comm', ['Kommunikationsplan', 'Communication plan']]];
  var STRATEGIES = [['redundancy', ['Redundanz (aktiv/aktiv, Hot-Standby)', 'Redundancy (active/active, hot standby)']], ['standby', ['Warm-/Cold-Standby-Systeme', 'Warm/cold standby systems']], ['backup', ['Wiederherstellung aus Datensicherung', 'Restore from backup']],
    ['site', ['Ausweichstandort / Ausweicharbeitsplätze', 'Alternate site / workplaces']], ['remote', ['Mobiles Arbeiten / Homeoffice', 'Remote work']], ['manual', ['Manueller Notbetrieb (Workaround)', 'Manual emergency operation (workaround)']],
    ['supplier', ['Ausweichdienstleister / Zweitlieferant', 'Alternate provider / second source']], ['staff', ['Personalreserve / Vertretungsregelung', 'Staff reserve / deputies']], ['stock', ['Vorratshaltung / Ersatzteile', 'Stockpiling / spare parts']],
    ['relocate', ['Verlagerung an anderen Standort', 'Relocation to another site']], ['insurance', ['Versicherung / Risikotransfer', 'Insurance / risk transfer']], ['accept', ['Keine Vorsorge (bewusst akzeptiert)', 'No provision (consciously accepted)']]];
  var PLAN_STATUS = [['draft', ['Entwurf', 'Draft']], ['review', ['in Abstimmung', 'in review']], ['approved', ['freigegeben', 'approved']], ['retired', ['außer Kraft', 'retired']]];
  var EX_TYPES = [
    ['tabletop', ['Planbesprechung (Tabletop)', 'Plan walkthrough (tabletop)'], ['Pläne gemeinsam theoretisch durchgehen, Lücken finden', 'Walk through plans together, find gaps']],
    ['alarm', ['Alarmierungsübung', 'Alerting exercise'], ['Erreichbarkeit und Alarmierungskette prüfen (Reaktionszeiten messen)', 'Check reachability and alert chain (measure response times)']],
    ['function', ['Funktionstest', 'Functional test'], ['Einzelne Komponenten/Abläufe testen (z. B. USV, Ersatzsystem, Umschaltung)', 'Test single components/procedures (e.g. UPS, standby system, switchover)']],
    ['restore', ['Wiederherstellungstest (IT)', 'Recovery test (IT)'], ['Wiederanlauf/Restore mit Zeitmessung gegen RTO/RPO', 'Restart/restore with timing against RTO/RPO']],
    ['staff', ['Stabsübung', 'Staff exercise'], ['Krisenstab bewältigt ein Szenario (Lagebild, Entscheidungen, Kommunikation)', 'Crisis team handles a scenario (situation picture, decisions, communication)']],
    ['framework', ['Stabsrahmenübung', 'Staff framework exercise'], ['Stab und beteiligte Bereiche; Übungsleitung spielt Lageinformationen ein', 'Staff plus involved units; exercise control injects information']],
    ['full', ['Notfall-/Vollübung', 'Full-scale exercise'], ['Realer Notbetrieb unter realistischen Bedingungen', 'Real emergency operation under realistic conditions']]];
  var EX_STATUS = [['planned', ['geplant', 'planned']], ['prepared', ['vorbereitet', 'prepared']], ['done', ['durchgeführt', 'conducted']], ['evaluated', ['ausgewertet', 'evaluated']], ['cancelled', ['abgesagt', 'cancelled']]];
  var EX_RESULT = [['', '–'], ['ok', ['erfolgreich', 'successful']], ['partial', ['teilweise erfolgreich', 'partially successful']], ['fail', ['nicht erfolgreich', 'not successful']]];
  var STAGES = [['reactive', ['Reaktiv-BCMS', 'Reactive BCMS']], ['build', ['Aufbau-BCMS', 'Build-up BCMS']], ['standard', ['Standard-BCMS', 'Standard BCMS']]];
  var LEVELS_ESC = [
    ['stoerung', ['Störung', 'Disruption'], '#2f7fd8', ['Abweichung vom Regelbetrieb, durch die Allgemeine Aufbauorganisation (AAO) im Rahmen der Regelprozesse behebbar.', 'Deviation from normal operations, resolved by the general organisation (regular processes).']],
    ['notfall', ['Notfall', 'Emergency'], '#f0952a', ['Zeitkritische Prozesse oder Ressourcen fallen aus bzw. die RTO droht überschritten zu werden; Regelorganisation reicht nicht – Besondere Aufbauorganisation (BAO) und BC-Pläne greifen.', 'Time-critical processes or resources fail or RTO may be exceeded; regular organisation is insufficient – special organisation (BAO) and BC plans apply.']],
    ['krise', ['Krise', 'Crisis'], '#d9362b', ['Vorhandene Pläne reichen nicht aus, existenzbedrohende Lage oder erhebliche Außenwirkung – der Krisenstab übernimmt die Führung.', 'Existing plans are insufficient, existential threat or major external impact – the crisis team takes command.']]];
  function lab(list, k) { var x = list.find(function (y) { return y[0] === k; }); return x ? K.lab(x[1]) : (k || '–'); }

  /* ------------------------------------------------------------------
   * Normalisierung
   * ---------------------------------------------------------------- */
  A.ext.normalize.push(function (s) {
    var b = s.bcm = s.bcm || {};
    b.settings = Object.assign({ stage: 'build', critHours: 72, intolerable: 3, intervals: [4, 24, 72, 168, 336, 720], cats: DEFAULT_CATS.map(function (c) { return { k: c.k, l: K.lab(c.l) }; }) }, b.settings || {});
    ['processes', 'plans', 'exercises'].forEach(function (k) { if (!Array.isArray(b[k])) b[k] = []; });
    b.crisis = b.crisis || {}; if (!Array.isArray(b.crisis.roles)) b.crisis.roles = []; if (!Array.isArray(b.crisis.escalation)) b.crisis.escalation = [];
    b.crisis.meta = Object.assign({ location: '', altLocation: '', comms: '', convene: '', rules: '', lastReview: '', reviewMonths: 12 }, b.crisis.meta || {});
    b.seq = Object.assign({ p: b.processes.length + 1, plan: b.plans.length + 1, ex: b.exercises.length + 1 }, b.seq || {});
    b.processes.forEach(function (p) { p.impacts = p.impacts || {}; p.assets = p.assets || []; });
    b.exercises.forEach(function (e) { e.actions = e.actions || []; e.planIds = e.planIds || []; e.processIds = e.processIds || []; });
  });

  /* ------------------------------------------------------------------
   * 1. BIA – Berechnungen
   * ---------------------------------------------------------------- */
  function num(v) { return v === '' || v === null || v === undefined || isNaN(v) ? null : +v; }
  /** Höchste Schadensstufe je Zeitintervall. */
  function maxPerInterval(p) {
    var st = B().settings;
    return st.intervals.map(function (_, i) { var m = 0; st.cats.forEach(function (c) { m = Math.max(m, +((p.impacts[c.k] || [])[i] || 0)); }); return m; });
  }
  /** MTA-Vorschlag: erstes Zeitintervall, in dem eine Schadenskategorie die Stufe „nicht tolerierbar“ erreicht. */
  function suggestMtpd(p) {
    var st = B().settings, mx = maxPerInterval(p);
    for (var i = 0; i < mx.length; i++) if (mx[i] >= st.intolerable) return st.intervals[i];
    return null;
  }
  function mtpd(p) { var v = num(p.mtpd); return v !== null ? v : suggestMtpd(p); }
  function isCritical(p) { var m = mtpd(p); return m !== null && m <= B().settings.critHours; }
  function procById(id) { return B().processes.find(function (p) { return p.id === id; }); }
  function plansOf(pid) { return B().plans.filter(function (x) { return x.processId === pid && x.status !== 'retired'; }); }
  /** Effektive Ziele eines BC-Plans: eigene Werte oder aus der BIA des Prozesses. */
  function effective(plan) {
    var p = procById(plan.processId), o = {};
    ['rto', 'rpo'].forEach(function (k) {
      var own = num(plan[k]), inh = p ? num(p[k]) : null;
      o[k] = own !== null ? { v: own, own: true, looser: inh !== null && own > inh } : { v: inh, own: false };
    });
    o.mtpd = p ? mtpd(p) : null;
    return o;
  }
  function exercisesOfPlan(pid) { return B().exercises.filter(function (e) { return e.planIds.indexOf(pid) >= 0; }); }
  function lastExercise(pid) {
    return exercisesOfPlan(pid).filter(function (e) { return e.status === 'done' || e.status === 'evaluated'; }).sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); })[0] || null;
  }
  function achieved(pid) {
    var e = exercisesOfPlan(pid).filter(function (x) { return x.status === 'evaluated' && num(x.achievedRto) !== null; }).sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); })[0];
    return e ? { v: +e.achievedRto, ex: e } : null;
  }
  function rank() {
    var list = B().processes.map(function (p) { return { p: p, m: mtpd(p) }; }).filter(function (x) { return x.m !== null; }).sort(function (a, b) { return a.m - b.m || (num(a.p.rto) || 1e9) - (num(b.p.rto) || 1e9); });
    var r = {}; list.forEach(function (x, i) { r[x.p.id] = i + 1; }); return r;
  }
  /** Ressourcenanforderungen: je Asset die strengste RTO/RPO der abhängigen Prozesse. */
  function resources() {
    var s = S(), out = [];
    s.assets.forEach(function (a) {
      var ps = B().processes.filter(function (p) { return p.assets.indexOf(a.id) >= 0; });
      if (!ps.length) return;
      var rto = null, rpo = null, crit = false;
      ps.forEach(function (p) { var r = num(p.rto), q = num(p.rpo); if (r !== null) rto = rto === null ? r : Math.min(rto, r); if (q !== null) rpo = rpo === null ? q : Math.min(rpo, q); if (isCritical(p)) crit = true; });
      out.push({ asset: a, procs: ps, rto: rto, rpo: rpo, crit: crit, sbA: (a.sb || {}).a || 'normal' });
    });
    return out.sort(function (x, y) { return (x.rto === null ? 1e9 : x.rto) - (y.rto === null ? 1e9 : y.rto); });
  }

  /** Kennzahlen für KPI-Dashboard und Datenlücken. */
  function metrics() {
    var b = B(), today = K.today(), from = K.addMonths(today, -12), to = K.addMonths(today, 12);
    var m = { processes: b.processes.length, biaComplete: 0, rtoSet: 0, rtoOk: 0, critical: 0, critWithPlan: 0, plans: 0, plansTested: 0, plansWithAchieved: 0, proven: 0, exConducted: 0, exEvaluated: 0, exPlanned12: 0, roles: b.crisis.roles.length, rolesFull: 0, sbMismatch: 0 };
    b.processes.forEach(function (p) {
      var mt = mtpd(p), r = num(p.rto);
      if (mt !== null && r !== null && num(p.rpo) !== null) m.biaComplete++;
      if (mt !== null && r !== null) { m.rtoSet++; if (r < mt) m.rtoOk++; }
      if (isCritical(p)) { m.critical++; if (plansOf(p.id).length) m.critWithPlan++; }
    });
    b.plans.filter(function (x) { return x.status !== 'retired'; }).forEach(function (pl) {
      m.plans++;
      var le = lastExercise(pl.id); if (le && le.date >= from) m.plansTested++;
      var ac = achieved(pl.id), ef = effective(pl);
      if (ac && ef.rto.v !== null) { m.plansWithAchieved++; if (ac.v <= ef.rto.v) m.proven++; }
    });
    b.exercises.forEach(function (e) {
      if (e.status === 'done' || e.status === 'evaluated') { m.exConducted++; if (e.status === 'evaluated') m.exEvaluated++; }
      if ((e.status === 'planned' || e.status === 'prepared') && e.date >= today && e.date <= to) m.exPlanned12++;
    });
    b.crisis.roles.forEach(function (r) { if (r.person && r.deputy) m.rolesFull++; });
    resources().forEach(function (x) { if (x.crit && x.sbA === 'normal') m.sbMismatch++; });
    return m;
  }

  /* ------------------------------------------------------------------
   * 1. BIA – Ansicht
   * ---------------------------------------------------------------- */
  function intLabel(h) { return K.hours(h); }
  /** Zeitachse (logarithmisch 1 h … 2 Monate): RPO links, RTO-Balken, MTA-Marke. */
  function timeline(rpo, rto, mt) {
    var lo = Math.log(1), hi = Math.log(1440), X = function (h) { return Math.max(0, Math.min(100, (Math.log(Math.max(1, h)) - lo) / (hi - lo) * 100)); };
    var h = '<div class="tl" title="RPO ' + K.hours(rpo) + ' · RTO ' + K.hours(rto) + ' · MTA ' + K.hours(mt) + '">';
    if (rto !== null) h += '<span class="tl-rto" style="width:' + X(rto).toFixed(1) + '%;background:' + (mt !== null && rto >= mt ? '#d9362b' : '#1f6feb') + '"></span>';
    if (mt !== null) h += '<span class="tl-mtpd" style="left:' + X(mt).toFixed(1) + '%"></span>';
    return h + '</div>';
  }
  function biaView() {
    var b = B();
    var h = [K.pageHead(t('nav.bia'), L('Schadensverlauf je Geschäftsprozess über die Zeit → maximal tolerierbare Ausfallzeit (MTA/MTPD), geforderte Wiederanlaufzeit (WAZ/RTO) und maximal tolerierbarer Datenverlust (RPO) – in Anlehnung an BSI-Standard 200-4.',
      'Impact over time per business process → maximum tolerable period of disruption (MTPD), recovery time objective (RTO) and recovery point objective (RPO) – based on BSI Standard 200-4.'),
      (b.processes.length ? '' : K.btn('biaExample', L('Beispielprozesse', 'Example processes'))) + K.btn('biaAdd', '+ ' + L('Geschäftsprozess', 'Business process'), { cls: 'btn-primary' }))];
    h.push(K.tabs('biaTab', [['processes', ['Geschäftsprozesse', 'Business processes']], ['resources', ['Ressourcen / Assets', 'Resources / assets']], ['settings', ['Skalen & Einstellungen', 'Scales & settings']]], U.biaTab));
    if (U.biaTab === 'resources') h.push(resourcesView());
    else if (U.biaTab === 'settings') h.push(biaSettings());
    else h.push(processList());
    return h.join('');
  }
  function processList() {
    var b = B(), m = metrics(), rk = rank(), h = [];
    h.push('<div class="grid grid-4">' + K.stat(m.processes, L('Geschäftsprozesse', 'Business processes'), 'var(--primary)') + K.stat(m.critical, L('zeitkritisch (MTA ≤ ' + K.hours(b.settings.critHours) + ')', 'time-critical (MTPD ≤ ' + K.hours(b.settings.critHours) + ')'), '#d9362b') +
      K.stat(m.biaComplete + ' / ' + m.processes, L('BIA vollständig', 'BIA complete'), m.biaComplete === m.processes ? K.AMP.ok : K.AMP.warn) + K.stat(m.critWithPlan + ' / ' + m.critical, L('zeitkritisch mit BC-Plan', 'time-critical with BC plan'), m.critWithPlan === m.critical ? K.AMP.ok : K.AMP.bad) + '</div>');
    if (!b.processes.length) { h.push('<div class="card muted">' + esc(L('Noch keine Geschäftsprozesse. Legen Sie Prozesse an und bewerten Sie den Schaden über die Zeit – daraus ergibt sich die MTA.', 'No business processes yet. Add processes and rate the impact over time – the MTPD follows from it.')) + '</div>'); return h.join(''); }
    var rows = b.processes.slice().sort(function (x, y) { return (rk[x.id] || 999) - (rk[y.id] || 999); }).map(function (p) {
      var sug = suggestMtpd(p), mt = mtpd(p), rto = num(p.rto), rpo = num(p.rpo), crit = isCritical(p), pls = plansOf(p.id);
      var warn = rto !== null && mt !== null && rto >= mt ? '<div class="small" style="color:var(--danger)">⚠ ' + esc(L('RTO muss kleiner als MTA sein', 'RTO must be below MTPD')) + '</div>' : '';
      var next = K.addMonths(p.lastReview || (p.created || K.today()).slice(0, 10), +p.reviewMonths || 12);
      return '<tr><td class="num"><b>' + (rk[p.id] || '–') + '</b></td><td><b>' + esc(p.id) + ' · ' + esc(p.name) + '</b><div class="small muted">' + esc([p.dept, p.owner].filter(Boolean).join(' · ')) + '</div>' + (p.assets.length ? '<div class="small">🖥️ ' + esc(p.assets.map(HA.Register.assetName).join(', ')) + '</div>' : '') + '</td>' +
        '<td class="nowrap"><b>' + K.hours(mt) + '</b>' + (num(p.mtpd) === null && sug !== null ? '<div class="small muted">' + esc(L('Vorschlag aus BIA', 'suggested by BIA')) + '</div>' : num(p.mtpd) !== null && sug !== null && sug !== num(p.mtpd) ? '<div class="small muted">' + esc(L('Vorschlag', 'suggested')) + ' ' + K.hours(sug) + '</div>' : '') + '</td>' +
        '<td class="nowrap">' + K.hours(rto) + warn + '</td><td class="nowrap">' + K.hours(rpo) + '</td><td class="small">' + (p.wan ? esc(p.wan) + ' %' : '–') + '</td>' +
        '<td style="min-width:150px">' + timeline(rpo, rto, mt) + '</td><td>' + (crit ? K.amp('bad', L('zeitkritisch', 'time-critical')) : mt === null ? K.amp('none', L('unbewertet', 'unrated')) : K.amp('ok', L('nicht zeitkritisch', 'not time-critical'))) + '</td>' +
        '<td class="small">' + (pls.length ? pls.map(function (x) { return esc(x.id); }).join(', ') : crit ? '<span style="color:var(--danger)">⚠ ' + esc(L('fehlt', 'missing')) + '</span>' : '–') + '</td>' +
        '<td class="small nowrap">' + (next < K.today() ? '<span style="color:var(--danger)">' + K.fmt(next) + '</span>' : K.fmt(next)) + '</td>' +
        '<td class="nowrap">' + K.btn('biaEdit', '✏️', { id: p.id, cls: 'btn-sm', title: t('btn.edit') }) + ' ' + K.btn('planAdd', '📘', { id: p.id, cls: 'btn-sm', title: L('BC-Plan anlegen', 'Add BC plan') }) + ' ' + K.btn('biaDel', '🗑', { id: p.id, cls: 'btn-sm btn-danger', title: t('btn.delete') }) + '</td></tr>';
    });
    h.push('<div class="card"><h2>' + esc(L('Wiederanlaufparameter und Priorität', 'Recovery parameters and priority')) + '</h2>' + K.table([{ l: ['Prio', 'Prio'], cls: 'num' }, { l: ['Geschäftsprozess', 'Business process'], w: 220 }, L('MTA', 'MTPD'), L('RTO (WAZ)', 'RTO'), 'RPO', L('Niveau', 'Level'), L('Zeitachse', 'Timeline'), L('Kritikalität', 'Criticality'), L('BC-Plan', 'BC plan'), L('Review', 'Review'), ''], rows) +
      '<div class="legend small" style="margin-top:.4rem"><span><i style="background:#1f6feb"></i>RTO</span><span><i style="background:var(--text);width:3px"></i>MTA</span><span>' + esc(L('Achse logarithmisch 1 h – 2 Monate', 'log axis 1 h – 2 months')) + '</span></div>' +
      '<p class="small muted">' + esc(L('Priorität: Reihenfolge des Wiederanlaufs nach MTA (kürzeste zuerst). Zeitkritisch-Schwelle und Skalen unter „Skalen & Einstellungen“.', 'Priority: recovery order by MTPD (shortest first). Time-critical threshold and scales under "Scales & settings".')) + '</p></div>');
    // Schadensverlauf-Matrix (Übersicht)
    var st = b.settings;
    h.push('<div class="card"><h2>' + esc(L('Schadensverlauf (höchste Stufe je Zeitraum)', 'Impact over time (highest level per period)')) + '</h2><div class="table-wrap"><table class="bia-heat"><thead><tr><th>' + esc(L('Prozess', 'Process')) + '</th>' + st.intervals.map(function (iv) { return '<th class="num">' + intLabel(iv) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      b.processes.map(function (p) { var mx = maxPerInterval(p);
        return '<tr><td><b>' + esc(p.id) + '</b> ' + esc(p.name) + '</td>' + mx.map(function (v) { return '<td class="num" style="background:' + LV_COL[v] + ';color:' + (v === 1 || v === 4 ? '#fff' : '#1b2430') + ';font-weight:700">' + (v ? esc(lab(LEVELS, v)) : '·') + (v >= st.intolerable ? ' ✕' : '') + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div><p class="small muted">✕ = ' + esc(L('nicht tolerierbar (ab Stufe „' + lab(LEVELS, st.intolerable) + '“) → MTA', 'not tolerable (from level "' + lab(LEVELS, st.intolerable) + '") → MTPD')) + '</p></div>');
    return h.join('');
  }
  function resourcesView() {
    var res = resources(), h = [];
    h.push('<div class="note">' + esc(L('Ressourcen erben die strengsten Wiederanlaufziele der Geschäftsprozesse, die von ihnen abhängen. Ein Asset in einem zeitkritischen Prozess sollte mindestens den Verfügbarkeits-Schutzbedarf „hoch“ haben.', 'Resources inherit the strictest recovery objectives of the processes that depend on them. An asset in a time-critical process should have at least "high" availability protection needs.')) + '</div>');
    if (!res.length) { h.push('<div class="card muted">' + esc(L('Noch keine Assets mit Geschäftsprozessen verknüpft (im Prozess unter „Abhängige Assets“).', 'No assets linked to processes yet (in the process under "Dependent assets").')) + '</div>'); return h.join(''); }
    h.push('<div class="card">' + K.table([{ l: ['Asset', 'Asset'], w: 160 }, L('Geschäftsprozesse', 'Processes'), L('geforderte RTO', 'required RTO'), L('geforderte RPO', 'required RPO'), L('Verfügbarkeit (Schutzbedarf)', 'Availability (protection needs)'), L('Hinweis', 'Note')], res.map(function (x) {
      var mis = x.crit && x.sbA === 'normal';
      return '<tr><td><b>' + esc(x.asset.name) + '</b><div class="small muted">' + esc(x.asset.hostname || '') + '</div></td><td class="small">' + x.procs.map(function (p) { return esc(p.id + ' ' + p.name) + (isCritical(p) ? ' ⏱' : ''); }).join('<br>') + '</td>' +
        '<td class="nowrap"><b>' + K.hours(x.rto) + '</b></td><td class="nowrap">' + K.hours(x.rpo) + '</td><td>' + esc(t('prot.' + x.sbA)) + '</td><td>' + (mis ? K.amp('warn', L('Schutzbedarf „Verfügbarkeit“ prüfen', 'check availability protection needs')) + ' ' + K.btn('kitGo', '↗', { id: 'protection', cls: 'btn-sm' }) : '') + '</td></tr>';
    })) + '</div>');
    return h.join('');
  }
  function biaSettings() {
    var st = B().settings;
    return '<div class="card"><h2>' + esc(L('Einstellungen der BIA', 'BIA settings')) + '</h2><div class="grid grid-4">' +
      '<div class="field"><label>' + esc(L('Stufe des BCMS (BSI 200-4)', 'BCMS stage (BSI 200-4)')) + '</label><select data-act="bcmSet" data-k="stage">' + STAGES.map(function (x) { return A.opt(x[0], K.lab(x[1]), st.stage); }).join('') + '</select></div>' +
      '<div class="field"><label>' + esc(L('Zeitkritisch, wenn MTA ≤ (Stunden)', 'Time-critical if MTPD ≤ (hours)')) + '</label><input type="number" min="1" data-field="bcmSetN" data-k="critHours" value="' + esc(st.critHours) + '"></div>' +
      '<div class="field"><label>' + esc(L('Nicht tolerierbar ab Schadensstufe', 'Not tolerable from impact level')) + '</label><select data-act="bcmSet" data-k="intolerable">' + LEVELS.map(function (x) { return A.opt(x[0], x[0] + ' – ' + K.lab(x[1]), st.intolerable); }).join('') + '</select></div>' +
      '<div class="field"><label>' + esc(L('Zeitintervalle (Stunden, kommagetrennt)', 'Time intervals (hours, comma separated)')) + '</label><input type="text" data-field="bcmSetIv" value="' + esc(st.intervals.join(', ')) + '"><div class="small muted">' + esc(st.intervals.map(intLabel).join(' · ')) + '</div></div></div>' +
      '<h3>' + esc(L('Schadenskategorien', 'Impact categories')) + '</h3><div class="grid grid-3">' + st.cats.map(function (c, i) { return '<div class="field-inline"><input type="text" data-field="bcmCat" data-i="' + i + '" value="' + esc(c.l) + '">' + K.btn('bcmCatDel', '🗑', { id: i, cls: 'btn-sm', title: t('btn.delete') }) + '</div>'; }).join('') + '</div>' +
      '<div class="row" style="margin-top:.5rem">' + K.btn('bcmCatAdd', '+ ' + L('Kategorie', 'Category'), { cls: 'btn-sm' }) + '</div>' +
      '<p class="small muted" style="margin-top:.6rem">' + esc(L('Stufen: 1 gering · 2 mittel · 3 hoch · 4 sehr hoch. Definieren Sie je Kategorie, was die Stufen konkret bedeuten (z. B. Finanzen: hoch = > 50.000 €), und dokumentieren Sie das in der BCM-Leitlinie.', 'Levels: 1 low · 2 medium · 3 high · 4 very high. Define per category what the levels mean (e.g. finance: high = > €50,000) and document it in the BCM policy.')) + '</p></div>';
  }
  function editProcess(p) {
    var b = B(), s = S(), isNew = !p, st = b.settings;
    var obj = p || { name: '', dept: '', owner: '', desc: '', impacts: {}, mtpd: '', rto: '', rpo: '', wan: '', deps: '', assets: [], lastReview: '', reviewMonths: 12 };
    var work = JSON.parse(JSON.stringify(obj));
    var fields = [
      { k: 'name', l: ['Geschäftsprozess', 'Business process'], req: true }, { k: 'dept', l: ['Organisationseinheit', 'Organisational unit'] },
      { k: 'owner', l: ['Prozessverantwortliche/r', 'Process owner'], type: 'person' }, { k: 'wan', l: ['Wiederanlaufniveau / Notbetrieb (%)', 'Recovery level / emergency operation (%)'], type: 'number', min: 0, max: 100 },
      { k: 'desc', l: ['Beschreibung / Produkte & Dienstleistungen', 'Description / products & services'], type: 'textarea', rows: 2, full: true }
    ];
    var matrix = '<h3 style="margin:.6rem 0 .2rem">' + esc(L('Schadensverlauf bei Ausfall', 'Impact over time in case of outage')) + '</h3><div class="table-wrap"><table class="bia-matrix"><thead><tr><th>' + esc(L('Schadenskategorie', 'Impact category')) + '</th>' + st.intervals.map(function (iv) { return '<th>' + intLabel(iv) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      st.cats.map(function (c) { return '<tr><td>' + esc(c.l) + '</td>' + st.intervals.map(function (iv, i) { var v = (work.impacts[c.k] || [])[i] || 0;
        return '<td><select name="imp_' + c.k + '_' + i + '" class="lv-' + v + '">' + A.opt(0, '–', v) + LEVELS.map(function (x) { return A.opt(x[0], x[0] + ' ' + K.lab(x[1]), v); }).join('') + '</select></td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div><div id="mtpdSug" class="note"></div>';
    var fields2 = [
      { k: 'mtpd', l: ['MTA / MTPD (Stunden)', 'MTPD (hours)'], type: 'number', min: 0, help: ['leer = Vorschlag aus dem Schadensverlauf', 'empty = suggestion from impact'] },
      { k: 'rto', l: ['Geforderte Wiederanlaufzeit WAZ / RTO (Stunden)', 'Recovery time objective RTO (hours)'], type: 'number', min: 0, help: ['muss kleiner als die MTA sein', 'must be below the MTPD'] },
      { k: 'rpo', l: ['Max. tolerierbarer Datenverlust RPO (Stunden)', 'Recovery point objective RPO (hours)'], type: 'number', min: 0 },
      { k: 'assets', l: ['Abhängige Assets (Ressourcen)', 'Dependent assets (resources)'], type: 'multi', opts: s.assets.map(function (a) { return [a.id, a.name]; }), full: true },
      { k: 'deps', l: ['Weitere Abhängigkeiten (Personal, Dienstleister, Gebäude, Informationen)', 'Other dependencies (staff, providers, buildings, information)'], type: 'textarea', rows: 2, full: true },
      { k: 'lastReview', l: ['Letzte Überprüfung', 'Last review'], type: 'date' }, { k: 'reviewMonths', l: ['Review-Intervall (Monate)', 'Review interval (months)'], type: 'number', min: 1 }
    ];
    var form = A.dialog(isNew ? L('Geschäftsprozess anlegen', 'Add business process') : L('Geschäftsprozess', 'Business process') + ' ' + obj.id, K.formHtml(fields, work) + matrix + K.formHtml(fields2, work), function (f) {
      var ok = K.formRead(f, fields, work) && K.formRead(f, fields2, work);
      if (!ok) { A.toast(L('Bitte Pflichtfelder ausfüllen.', 'Please fill in the required fields.'), true); return false; }
      st.cats.forEach(function (c) { work.impacts[c.k] = st.intervals.map(function (_, i) { return +f.querySelector('[name="imp_' + c.k + '_' + i + '"]').value || 0; }); });
      if (num(work.rto) !== null && num(work.mtpd !== '' ? work.mtpd : suggestMtpd(work)) !== null && +work.rto >= +(work.mtpd !== '' ? work.mtpd : suggestMtpd(work))) A.toast(L('Hinweis: RTO ist nicht kleiner als die MTA.', 'Note: RTO is not below the MTPD.'), true);
      Object.assign(obj, work);
      if (isNew) { obj.id = 'GP-' + ('0' + (b.seq.p++)).slice(-2); obj.created = new Date().toISOString(); b.processes.push(obj); }
      A.save(); A.render();
    }, t('btn.apply'));
    form.classList.add('dlg-wide');
    function upd() {
      var tmp = { impacts: {} };
      st.cats.forEach(function (c) { tmp.impacts[c.k] = st.intervals.map(function (_, i) { var el = form.querySelector('[name="imp_' + c.k + '_' + i + '"]'); el.className = 'lv-' + el.value; return +el.value || 0; }); });
      var sg = suggestMtpd(tmp);
      form.querySelector('#mtpdSug').innerHTML = sg === null ? esc(L('Noch keine Stufe „nicht tolerierbar“ erreicht → keine MTA ableitbar (oder MTA länger als ' + intLabel(st.intervals[st.intervals.length - 1]) + ').', 'No "not tolerable" level reached yet → no MTPD derivable (or MTPD longer than ' + intLabel(st.intervals[st.intervals.length - 1]) + ').'))
        : esc(L('Vorschlag MTA: ', 'Suggested MTPD: ')) + '<b>' + K.hours(sg) + '</b> (' + sg + ' h) · ' + esc(L('RTO sollte deutlich darunter liegen, z. B. ', 'RTO should be clearly below, e.g. ')) + K.hours(Math.max(1, Math.round(sg * 0.5))) +
          ' <button type="button" class="btn btn-sm" id="takeSug">' + esc(L('als MTA übernehmen', 'use as MTPD')) + '</button>';
      var tb = form.querySelector('#takeSug'); if (tb) tb.onclick = function () { form.querySelector('[name=mtpd]').value = sg; };
    }
    form.addEventListener('change', function (e) { if (e.target.name && e.target.name.indexOf('imp_') === 0) upd(); });
    upd();
  }
  function examples() {
    var b = B(), s = S(), iv = b.settings.intervals.length;
    function imp(arr) { var o = {}; b.settings.cats.forEach(function (c, i) { o[c.k] = (arr[i] || arr[0]).slice(0, iv); }); return o; }
    var ex = [
      { name: L('E-Mail und Kommunikation', 'E-mail and communication'), dept: 'IT', rto: 8, rpo: 4, wan: 50, impacts: imp([[1, 2, 3, 4, 4, 4], [1, 1, 2, 3, 3, 4], [1, 1, 2, 2, 3, 3], [1, 2, 3, 3, 4, 4], [1, 1, 1, 1, 1, 1], [1, 1, 1, 2, 2, 2]]) },
      { name: L('Webshop / Kundenportal', 'Web shop / customer portal'), dept: 'Vertrieb', rto: 4, rpo: 1, wan: 70, impacts: imp([[2, 3, 4, 4, 4, 4], [2, 3, 4, 4, 4, 4], [1, 2, 2, 3, 3, 3], [2, 3, 3, 4, 4, 4], [1, 1, 1, 1, 1, 1], [1, 2, 2, 2, 2, 2]]) },
      { name: L('Lohn- und Gehaltsabrechnung', 'Payroll'), dept: 'Personal', rto: 72, rpo: 24, wan: 100, impacts: imp([[1, 1, 1, 2, 3, 4], [1, 1, 1, 2, 3, 3], [1, 1, 1, 2, 3, 4], [1, 1, 1, 2, 2, 3], [1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 2, 2]]) }
    ];
    ex.forEach(function (x) { b.processes.push(Object.assign({ id: 'GP-' + ('0' + (b.seq.p++)).slice(-2), owner: '', desc: '', mtpd: '', deps: '', assets: s.assets.slice(0, 1).map(function (a) { return a.id; }), lastReview: K.today(), reviewMonths: 12, created: new Date().toISOString() }, x)); });
    A.save(); A.render();
  }

  /* ------------------------------------------------------------------
   * 2. BC-Pläne
   * ---------------------------------------------------------------- */
  function plansView() {
    var b = B();
    var h = [K.pageHead(t('nav.bcplans'), L('Kontinuitätsstrategien und Pläne je Geschäftsprozess. Ohne eigene Ziele übernimmt ein Plan RTO/RPO aus der BIA seines Prozesses. Übungen werden je Plan verwaltet.', 'Continuity strategies and plans per business process. Without own objectives a plan inherits RTO/RPO from the BIA of its process. Exercises are managed per plan.'),
      K.btn('planAdd', '+ ' + L('BC-Plan', 'BC plan'), { cls: 'btn-primary', disabled: !b.processes.length }))];
    if (!b.processes.length) { h.push('<div class="card muted">' + esc(L('Bitte zuerst Geschäftsprozesse in der BIA anlegen.', 'Please add business processes in the BIA first.')) + ' ' + K.btn('kitGo', t('nav.bia') + ' →', { id: 'bia', cls: 'btn-sm' }) + '</div>'); return h.join(''); }
    var m = metrics();
    h.push('<div class="grid grid-4">' + K.stat(m.plans, L('aktive BC-Pläne', 'active BC plans'), 'var(--primary)') + K.stat(m.critWithPlan + ' / ' + m.critical, L('zeitkritische Prozesse abgedeckt', 'time-critical processes covered'), m.critWithPlan === m.critical ? K.AMP.ok : K.AMP.bad) +
      K.stat(m.plansTested + ' / ' + m.plans, L('in 12 Monaten geübt', 'exercised in 12 months'), m.plansTested === m.plans ? K.AMP.ok : K.AMP.warn) + K.stat(m.proven + ' / ' + m.plansWithAchieved, L('RTO nachweislich erreicht', 'RTO proven'), m.proven === m.plansWithAchieved ? K.AMP.ok : K.AMP.bad) + '</div>');
    if (!b.plans.length) { h.push('<div class="card muted">' + esc(L('Noch keine BC-Pläne.', 'No BC plans yet.')) + '</div>'); return h.join(''); }
    var rows = b.plans.map(function (pl) {
      var p = procById(pl.processId), ef = effective(pl), le = lastExercise(pl.id), ac = achieved(pl.id);
      var nextEx = K.addMonths(le ? le.date : (pl.created || K.today()).slice(0, 10), +pl.exerciseMonths || 12);
      var tgt = function (o, k) { return o.v === null ? '<span class="muted">–</span>' : '<b>' + K.hours(o.v) + '</b>' + (o.own ? (o.looser ? '<div class="small" style="color:var(--danger)">⚠ ' + esc(L('lockerer als BIA', 'looser than BIA')) + '</div>' : '<div class="small muted">' + esc(L('eigenes Ziel', 'own objective')) + '</div>') : '<div class="small muted">' + esc(L('aus BIA', 'from BIA')) + '</div>'); };
      var proof = ac ? (ef.rto.v !== null && ac.v <= ef.rto.v ? K.amp('ok', '✔ ' + K.hours(ac.v)) : K.amp('bad', '✕ ' + K.hours(ac.v))) : '<span class="small muted">' + esc(L('kein Nachweis', 'no proof')) + '</span>';
      return '<tr><td><b>' + esc(pl.id) + ' · ' + esc(pl.name) + '</b><div class="small muted">' + esc(lab(PLAN_TYPES, pl.type)) + ' · ' + esc(lab(PLAN_STATUS, pl.status)) + (pl.version ? ' · v' + esc(pl.version) : '') + '</div></td>' +
        '<td class="small">' + (p ? esc(p.id + ' ' + p.name) + (isCritical(p) ? ' ⏱' : '') : '–') + '</td><td class="small">' + esc(lab(STRATEGIES, pl.strategy)) + (pl.strategyDesc ? '<div class="muted">' + esc(K.clip(pl.strategyDesc, 90)) + '</div>' : '') + '</td>' +
        '<td class="nowrap">' + tgt(ef.rto) + '</td><td class="nowrap">' + tgt(ef.rpo) + '</td><td class="small nowrap">' + K.hours(ef.mtpd) + '</td><td>' + proof + '</td>' +
        '<td class="small nowrap">' + (le ? K.fmt(le.date) + '<div>' + esc(lab(EX_RESULT, le.result)) + '</div>' : '–') + '</td><td class="small nowrap">' + (nextEx < K.today() ? '<b style="color:var(--danger)">' + K.fmt(nextEx) + '</b>' : K.fmt(nextEx)) + '</td>' +
        '<td class="nowrap">' + K.btn('planEdit', '✏️', { id: pl.id, cls: 'btn-sm', title: t('btn.edit') }) + ' ' + K.btn('exAdd', '🧪', { id: 'plan:' + pl.id, cls: 'btn-sm', title: L('Übung planen', 'Plan exercise') }) + ' ' + K.btn('planDel', '🗑', { id: pl.id, cls: 'btn-sm btn-danger', title: t('btn.delete') }) + '</td></tr>';
    });
    h.push('<div class="card">' + K.table([{ l: ['BC-Plan', 'BC plan'], w: 200 }, L('Geschäftsprozess', 'Process'), { l: ['Kontinuitätsstrategie', 'Continuity strategy'], w: 160 }, 'RTO', 'RPO', L('MTA', 'MTPD'), L('nachgewiesene WAZ', 'proven recovery'), L('letzte Übung', 'last exercise'), L('nächste Übung', 'next exercise'), ''], rows) + '</div>');
    return h.join('');
  }
  function editPlan(pl, presetProc) {
    var b = B(), isNew = !pl;
    var obj = pl || { name: '', processId: presetProc || (b.processes[0] || {}).id, type: 'bcp', strategy: 'manual', strategyDesc: '', rto: '', rpo: '', owner: '', deputy: '', trigger: '', steps: '', resources: '', comms: '', status: 'draft', version: '1.0', approvedBy: '', approvedDate: '', lastReview: '', reviewMonths: 12, exerciseMonths: 12 };
    var p = procById(obj.processId);
    var info = '<div class="note small" id="inhInfo">' + esc(L('RTO/RPO leer lassen = Werte aus der BIA des Geschäftsprozesses übernehmen', 'Leave RTO/RPO empty = inherit values from the BIA of the process')) + (p ? ': RTO ' + K.hours(num(p.rto)) + ', RPO ' + K.hours(num(p.rpo)) + ', MTA ' + K.hours(mtpd(p)) : '') + '</div>';
    var form = K.editDialog(isNew ? L('BC-Plan anlegen', 'Add BC plan') : L('BC-Plan', 'BC plan') + ' ' + obj.id, [
      { k: 'name', l: ['Bezeichnung', 'Name'], req: true }, { k: 'processId', l: ['Geschäftsprozess', 'Business process'], type: 'select', opts: b.processes.map(function (x) { return [x.id, x.id + ' ' + x.name]; }) },
      { k: 'type', l: ['Planart', 'Plan type'], type: 'select', opts: PLAN_TYPES }, { k: 'status', l: ['Status', 'Status'], type: 'select', opts: PLAN_STATUS },
      { k: 'strategy', l: ['Kontinuitätsstrategie', 'Continuity strategy'], type: 'select', opts: STRATEGIES }, { k: 'strategyDesc', l: ['Strategie konkret', 'Strategy details'], ph: ['z. B. Ausweichrechenzentrum B, Umschaltung manuell', 'e.g. alternate data centre B, manual switchover'] },
      { k: 'rto', l: ['Eigene RTO (Stunden)', 'Own RTO (hours)'], type: 'number', min: 0 }, { k: 'rpo', l: ['Eigene RPO (Stunden)', 'Own RPO (hours)'], type: 'number', min: 0 },
      { k: 'owner', l: ['Planverantwortliche/r', 'Plan owner'], type: 'person' }, { k: 'deputy', l: ['Vertretung', 'Deputy'], type: 'person' },
      { k: 'trigger', l: ['Aktivierungskriterien (wann greift der Plan?)', 'Activation criteria (when does the plan apply?)'], type: 'textarea', rows: 2, full: true },
      { k: 'steps', l: ['Sofortmaßnahmen / Ablauf (Schritte)', 'Immediate actions / procedure (steps)'], type: 'textarea', rows: 4, full: true },
      { k: 'resources', l: ['Benötigte Ressourcen (Personal, IT, Räume, Dienstleister)', 'Required resources (staff, IT, rooms, providers)'], type: 'textarea', rows: 2, full: true },
      { k: 'comms', l: ['Kommunikation / Meldewege', 'Communication / reporting lines'], type: 'textarea', rows: 2, full: true },
      { k: 'version', l: ['Version', 'Version'] }, { k: 'approvedBy', l: ['Freigegeben durch', 'Approved by'], type: 'person' }, { k: 'approvedDate', l: ['Freigabedatum', 'Approval date'], type: 'date' },
      { k: 'lastReview', l: ['Letzte Überprüfung', 'Last review'], type: 'date' }, { k: 'reviewMonths', l: ['Review-Intervall (Monate)', 'Review interval (months)'], type: 'number', min: 1 },
      { k: 'exerciseMonths', l: ['Übungsintervall (Monate)', 'Exercise interval (months)'], type: 'number', min: 1 }
    ], obj, function (o) {
      var pp = procById(o.processId);
      if (pp && num(o.rto) !== null && num(pp.rto) !== null && +o.rto > +pp.rto) A.toast(L('Hinweis: Plan-RTO ist lockerer als die RTO aus der BIA.', 'Note: plan RTO is looser than the RTO from the BIA.'), true);
      if (isNew) { o.id = 'BCP-' + ('0' + (b.seq.plan++)).slice(-2); o.created = new Date().toISOString(); b.plans.push(o); }
    }, null, info);
    form.querySelector('[name=processId]').addEventListener('change', function (e) {
      var pp = procById(e.target.value); form.querySelector('#inhInfo').textContent = L('RTO/RPO leer lassen = Werte aus der BIA übernehmen', 'Leave RTO/RPO empty = inherit from BIA') + (pp ? ': RTO ' + K.hours(num(pp.rto)) + ', RPO ' + K.hours(num(pp.rpo)) + ', MTA ' + K.hours(mtpd(pp)) : '');
    });
  }

  /* ------------------------------------------------------------------
   * 3. Krisenstab
   * ---------------------------------------------------------------- */
  var DEFAULT_ROLES = [
    { fn: 'L', role: ['Leitung Krisenstab', 'Head of crisis team'], tasks: ['Gesamtverantwortung, Entscheidungen, Einberufung und Auflösung des Stabs, Freigabe der Kommunikation', 'Overall responsibility, decisions, convening/dissolving the team, approving communication'] },
    { fn: 'S1', role: ['S1 Personal / Innerer Dienst', 'S1 Personnel'], tasks: ['Personaleinsatz, Ablösung, Betreuung, Fürsorge', 'Staffing, relief, care'] },
    { fn: 'S2', role: ['S2 Lage und Dokumentation', 'S2 Situation & documentation'], tasks: ['Lagebild erstellen und fortschreiben, Stabsprotokoll, Lagebesprechungen vorbereiten', 'Build and update situation picture, log, prepare briefings'] },
    { fn: 'S3', role: ['S3 Einsatz / Operation', 'S3 Operations'], tasks: ['Maßnahmen planen und koordinieren, Notfallteams steuern, BC-Pläne aktivieren', 'Plan and coordinate measures, steer emergency teams, activate BC plans'] },
    { fn: 'S4', role: ['S4 Versorgung / Logistik', 'S4 Logistics'], tasks: ['Material, Räume, Dienstleister, Beschaffung, Finanzmittel', 'Material, rooms, providers, procurement, funds'] },
    { fn: 'S5', role: ['S5 Krisenkommunikation / Presse', 'S5 Crisis communication'], tasks: ['Interne und externe Kommunikation, Medien, Kunden, Behördenkontakte abstimmen', 'Internal/external communication, media, customers, authorities'] },
    { fn: 'S6', role: ['S6 Informations- und Kommunikationstechnik', 'S6 ICT'], tasks: ['IT-Lage, IT-Notfallmanagement, Kommunikationsmittel des Stabs sicherstellen', 'IT situation, IT emergency management, team communication means'] },
    { fn: 'FB', role: ['Fachberatung Informationssicherheit (ISB)', 'Advisor information security (CISO)'], tasks: ['Bewertung Sicherheitsvorfall, Meldepflichten (z. B. § 32 BSIG: 24 h / 72 h / 1 Monat)', 'Assess incident, reporting obligations (e.g. NIS2: 24 h / 72 h / 1 month)'] },
    { fn: 'FB', role: ['Fachberatung Datenschutz (DSB)', 'Advisor data protection (DPO)'], tasks: ['Datenschutzverletzung bewerten, Meldung nach Art. 33 DSGVO binnen 72 h vorbereiten', 'Assess personal data breach, prepare notification under Art. 33 GDPR within 72 h'] },
    { fn: 'FB', role: ['Fachberatung BCM', 'Advisor BCM'], tasks: ['Methodik, Pläne, Wiederanlaufprioritäten aus der BIA', 'Methodology, plans, recovery priorities from the BIA'] }
  ];
  var DEFAULT_ESC = [
    { level: 'stoerung', trigger: ['Einzelne Systeme/Dienste gestört, Workaround vorhanden, RTO nicht gefährdet', 'Single systems/services disrupted, workaround available, RTO not at risk'], detects: ['Service Desk / Fachbereich / Monitoring', 'Service desk / business unit / monitoring'], decides: ['IT-Leitung bzw. Bereichsleitung', 'IT lead / unit lead'], alarm: ['zuständiges Betriebsteam', 'responsible operations team'], maxMin: 60, measures: ['Störungsbehebung im Regelprozess (Incident-Management)', 'Resolve via regular incident management'] },
    { level: 'notfall', trigger: ['Ausfall eines zeitkritischen Prozesses/Assets oder Überschreitung der RTO absehbar; Sicherheitsvorfall mit Auswirkung auf Verfügbarkeit/Vertraulichkeit', 'Outage of a time-critical process/asset or RTO likely exceeded; security incident with impact'], detects: ['IT-Leitung / ISB / Prozessverantwortliche', 'IT lead / CISO / process owner'], decides: ['BCM-Beauftragte/r mit Leitung Notfallteam', 'BCM officer with head of emergency team'], alarm: ['Notfallteams, Leitung Krisenstab (Vorwarnung), Geschäftsführung', 'Emergency teams, head of crisis team (pre-alert), management'], maxMin: 30, measures: ['BC-Pläne aktivieren, Notbetrieb, Lagebild, Meldepflichten prüfen', 'Activate BC plans, emergency operation, situation picture, check reporting obligations'] },
    { level: 'krise', trigger: ['Pläne reichen nicht aus, MTA droht überschritten zu werden, existenzbedrohende Lage oder erhebliche Außenwirkung', 'Plans insufficient, MTPD may be exceeded, existential threat or major external impact'], detects: ['Leitung Notfallteam / BCM-Beauftragte/r', 'Head of emergency team / BCM officer'], decides: ['Geschäftsführung bzw. Leitung Krisenstab', 'Management / head of crisis team'], alarm: ['alle Mitglieder des Krisenstabs, ggf. Behörden, Versicherung, Kunden', 'all crisis team members, authorities, insurer, customers if needed'], maxMin: 60, measures: ['Krisenstab einberufen, Krisenkommunikation, Meldungen an Behörden (z. B. BSI, Datenschutzaufsicht)', 'Convene crisis team, crisis communication, notify authorities (e.g. BSI, DPA)'] }
  ];
  function crisisView() {
    var b = B(), cr = b.crisis, h = [];
    h.push(K.pageHead(t('nav.crisis'), L('Besondere Aufbauorganisation (BAO) für Notfälle und Krisen: Rollen mit Vertretung, Eskalationsstufen und -pfade, Alarmierungskette – in Anlehnung an BSI-Standard 200-4.',
      'Special organisation (BAO) for emergencies and crises: roles with deputies, escalation levels and paths, alert chain – based on BSI Standard 200-4.'), K.btn('crisisPrint', '🖨 ' + L('Alarmierungsliste', 'Alert list'))));
    // Eskalationsstufen
    h.push('<div class="card"><h2>' + esc(L('Eskalationsstufen', 'Escalation levels')) + '</h2><div class="esc-flow">' + LEVELS_ESC.map(function (lv, i) {
      return (i ? '<div class="esc-arrow" aria-hidden="true">➜</div>' : '') + '<div class="esc-step" style="border-top:6px solid ' + lv[2] + '"><b>' + esc(K.lab(lv[1])) + '</b><p class="small">' + esc(K.lab(lv[3])) + '</p><div class="small muted">' +
        esc(i === 0 ? L('Führung: Allgemeine Aufbauorganisation (AAO)', 'Lead: general organisation') : i === 1 ? L('Führung: BAO / Notfallteams', 'Lead: BAO / emergency teams') : L('Führung: Krisenstab', 'Lead: crisis team')) + '</div></div>';
    }).join('') + '</div></div>');
    // Rollen
    var roleRows = cr.roles.map(function (r, i) {
      var c = K.contactByName(r.person), dc = K.contactByName(r.deputy);
      var reach = [r.reach, c && (c.mobile || c.phone)].filter(Boolean).join(' · ');
      var miss = !r.person ? K.amp('bad', L('unbesetzt', 'vacant')) : !r.deputy ? K.amp('warn', L('ohne Vertretung', 'no deputy')) : '';
      return '<tr><td class="mono"><b>' + esc(r.fn || '') + '</b></td><td><b>' + esc(r.role) + '</b><div class="small muted">' + esc(K.clip(r.tasks, 150)) + '</div></td><td>' + esc(r.person || '–') + (c && c.role ? '<div class="small muted">' + esc(c.role) + '</div>' : '') + ' ' + miss + '</td>' +
        '<td>' + esc(r.deputy || '–') + (dc && (dc.mobile || dc.phone) ? '<div class="small muted">' + esc(dc.mobile || dc.phone) + '</div>' : '') + '</td><td class="small">' + esc(reach || '–') + '</td>' +
        '<td class="nowrap">' + K.btn('roleUp', '↑', { id: i, cls: 'btn-sm', title: L('nach oben', 'move up') }) + ' ' + K.btn('roleEdit', '✏️', { id: i, cls: 'btn-sm', title: t('btn.edit') }) + ' ' + K.btn('roleDel', '🗑', { id: i, cls: 'btn-sm btn-danger', title: t('btn.delete') }) + '</td></tr>';
    });
    h.push('<div class="card"><h2>' + esc(L('Rollen und Stabsfunktionen', 'Roles and staff functions')) + '</h2><p class="small muted">' + esc(L('Stabsfunktionen angelehnt an S1–S6 (Stabsarbeit), ergänzt um Fachberatung. Personen aus den Ansprechpersonen wählen – Telefonnummern werden für die Alarmierungsliste übernommen.',
      'Staff functions based on S1–S6, plus advisors. Pick persons from contacts – phone numbers are used for the alert list.')) + '</p>' +
      (cr.roles.length ? K.table([L('Fkt.', 'Fn.'), { l: ['Rolle / Aufgaben', 'Role / tasks'], w: 240 }, L('Person', 'Person'), L('Vertretung', 'Deputy'), L('Erreichbarkeit', 'Reachability'), ''], roleRows) : '<p class="muted">' + esc(L('Noch keine Rollen.', 'No roles yet.')) + '</p>') +
      '<div class="row" style="margin-top:.5rem">' + K.btn('roleAdd', '+ ' + L('Rolle', 'Role'), { cls: 'btn-primary' }) + (cr.roles.length ? '' : K.btn('roleDefaults', L('Standardrollen übernehmen', 'Use default roles'))) + '</div></div>');
    // Eskalationspfade
    var escRows = cr.escalation.map(function (e, i) {
      var lv = LEVELS_ESC.find(function (x) { return x[0] === e.level; }) || LEVELS_ESC[0];
      return '<tr><td>' + K.pill(K.lab(lv[1]), lv[2]) + '</td><td class="small">' + esc(e.trigger) + '</td><td class="small">' + esc(e.detects) + '</td><td class="small"><b>' + esc(e.decides) + '</b></td><td class="small">' + esc(e.alarm) + '</td><td class="num">' + (e.maxMin ? esc(e.maxMin) + ' min' : '–') + '</td><td class="small">' + esc(e.measures) + '</td>' +
        '<td class="nowrap">' + K.btn('escEdit', '✏️', { id: i, cls: 'btn-sm', title: t('btn.edit') }) + ' ' + K.btn('escDel', '🗑', { id: i, cls: 'btn-sm btn-danger', title: t('btn.delete') }) + '</td></tr>';
    });
    h.push('<div class="card"><h2>' + esc(L('Eskalationspfade', 'Escalation paths')) + '</h2>' + (cr.escalation.length ? K.table([L('Stufe', 'Level'), { l: ['Auslöser / Kriterien', 'Trigger / criteria'], w: 180 }, L('erkennt / meldet', 'detects / reports'), L('entscheidet', 'decides'), L('alarmiert', 'alerts'), L('max. Reaktion', 'max. response'), { l: ['Sofortmaßnahmen', 'Immediate actions'], w: 160 }, ''], escRows) : '<p class="muted">' + esc(L('Noch keine Eskalationspfade.', 'No escalation paths yet.')) + '</p>') +
      '<div class="row" style="margin-top:.5rem">' + K.btn('escAdd', '+ ' + L('Eskalationspfad', 'Escalation path'), { cls: 'btn-primary' }) + (cr.escalation.length ? '' : K.btn('escDefaults', L('Standard-Eskalationspfade übernehmen', 'Use default escalation paths'))) + '</div></div>');
    // Alarmierungskette
    var chain = cr.roles.filter(function (r) { return r.person; });
    h.push('<div class="card"><h2>' + esc(L('Alarmierungskette', 'Alert chain')) + '</h2>' + (chain.length ? '<ol class="alarm-chain">' + chain.map(function (r) {
      var c = K.contactByName(r.person), d = K.contactByName(r.deputy);
      return '<li><b>' + esc(r.role) + '</b>: ' + esc(r.person) + (c ? ' <span class="mono small">' + esc([c.mobile, c.phone, c.email].filter(Boolean).join(' · ')) + '</span>' : '') + (r.deputy ? '<div class="small muted">' + esc(L('falls nicht erreichbar', 'if unreachable')) + ' → ' + esc(r.deputy) + (d ? ' ' + esc([d.mobile, d.phone].filter(Boolean).join(' · ')) : '') + '</div>' : '') + '</li>';
    }).join('') + '</ol>' : '<p class="muted">' + esc(L('Rollen mit Personen besetzen, dann entsteht die Alarmierungskette automatisch (Reihenfolge per ↑ änderbar).', 'Assign persons to roles to build the alert chain automatically (reorder with ↑).')) + '</p>') + '</div>');
    // Rahmen
    var mt = cr.meta;
    h.push('<div class="card"><h2>' + esc(L('Rahmenbedingungen des Stabs', 'Crisis team framework')) + '</h2><div class="grid grid-2">' + [['location', ['Stabsraum', 'Crisis room']], ['altLocation', ['Ausweich-Stabsraum / virtueller Raum', 'Alternate / virtual room']], ['comms', ['Kommunikationsmittel (auch bei IT-Ausfall)', 'Communication means (also during IT outage)']], ['convene', ['Wer darf den Stab einberufen?', 'Who may convene the team?']]].map(function (x) {
      return '<div class="field"><label>' + esc(K.lab(x[1])) + '</label><input type="text" data-field="crisisMeta" data-k="' + x[0] + '" value="' + esc(mt[x[0]]) + '"></div>'; }).join('') +
      '<div class="field" style="grid-column:1/-1"><label>' + esc(L('Geschäftsordnung / Grundsätze der Stabsarbeit', 'Rules of procedure')) + '</label><textarea data-field="crisisMeta" data-k="rules" rows="3">' + esc(mt.rules) + '</textarea></div>' +
      '<div class="field"><label>' + esc(L('Letzte Überprüfung', 'Last review')) + '</label><input type="date" data-field="crisisMeta" data-k="lastReview" value="' + esc(mt.lastReview) + '"></div>' +
      '<div class="field"><label>' + esc(L('Review-Intervall (Monate)', 'Review interval (months)')) + '</label><input type="number" min="1" data-field="crisisMeta" data-k="reviewMonths" value="' + esc(mt.reviewMonths) + '"></div></div></div>');
    return h.join('');
  }
  function editRole(i) {
    var cr = B().crisis, isNew = i === null || i === undefined, r = isNew ? { fn: '', role: '', person: '', deputy: '', tasks: '', reach: '' } : cr.roles[i];
    K.editDialog(isNew ? L('Rolle anlegen', 'Add role') : L('Rolle bearbeiten', 'Edit role'), [
      { k: 'fn', l: ['Funktion (z. B. L, S1–S6, FB)', 'Function (e.g. L, S1–S6, FB)'] }, { k: 'role', l: ['Rolle', 'Role'], req: true },
      { k: 'person', l: ['Person', 'Person'], type: 'person' }, { k: 'deputy', l: ['Vertretung', 'Deputy'], type: 'person' },
      { k: 'reach', l: ['Erreichbarkeit (z. B. 24/7, Rufbereitschaft)', 'Reachability (e.g. 24/7, on call)'], full: true }, { k: 'tasks', l: ['Aufgaben und Befugnisse', 'Tasks and authority'], type: 'textarea', full: true }
    ], r, function (o) { if (isNew) cr.roles.push(o); });
  }
  function editEsc(i) {
    var cr = B().crisis, isNew = i === null || i === undefined, e = isNew ? { level: 'notfall', trigger: '', detects: '', decides: '', alarm: '', maxMin: '', measures: '' } : cr.escalation[i];
    K.editDialog(isNew ? L('Eskalationspfad anlegen', 'Add escalation path') : L('Eskalationspfad bearbeiten', 'Edit escalation path'), [
      { k: 'level', l: ['Stufe', 'Level'], type: 'select', opts: LEVELS_ESC.map(function (x) { return [x[0], x[1]]; }) }, { k: 'maxMin', l: ['max. Reaktionszeit (Minuten)', 'max. response time (minutes)'], type: 'number', min: 0 },
      { k: 'trigger', l: ['Auslöser / Kriterien', 'Trigger / criteria'], type: 'textarea', rows: 2, full: true }, { k: 'detects', l: ['Wer erkennt / meldet?', 'Who detects / reports?'], type: 'person' },
      { k: 'decides', l: ['Wer entscheidet über Eskalation?', 'Who decides on escalation?'], type: 'person' }, { k: 'alarm', l: ['Wer wird alarmiert / informiert?', 'Who is alerted / informed?'], type: 'textarea', rows: 2, full: true },
      { k: 'measures', l: ['Sofortmaßnahmen', 'Immediate actions'], type: 'textarea', rows: 2, full: true }
    ], e, function (o) { if (isNew) cr.escalation.push(o); });
  }
  function printAlarm() {
    var b = B(), s = S(), cr = b.crisis, rows = cr.roles.map(function (r) {
      var c = K.contactByName(r.person) || {}, d = K.contactByName(r.deputy) || {};
      return '<tr><td>' + esc(r.fn) + '</td><td><b>' + esc(r.role) + '</b></td><td>' + esc(r.person || '–') + '<br><small>' + esc([c.mobile, c.phone, c.email].filter(Boolean).join(' · ')) + '</small></td><td>' + esc(r.deputy || '–') + '<br><small>' + esc([d.mobile, d.phone, d.email].filter(Boolean).join(' · ')) + '</small></td><td><small>' + esc(r.reach || '') + '</small></td></tr>';
    }).join('');
    var html = '<!DOCTYPE html><html lang="' + HA.lang + '"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>' + esc(L('Alarmierungsliste Krisenstab', 'Crisis team alert list')) + '</title><style>' +
      '@page{size:A4 portrait;margin:15mm}body{font-family:Arial,sans-serif;font-size:10pt}h1{font-size:15pt}table{width:100%;border-collapse:collapse}td,th{border:.5pt solid #888;padding:2mm;text-align:left;vertical-align:top}th{background:#eee}small{color:#333}.lv{display:flex;gap:4mm;margin:4mm 0}.lv div{flex:1;border:.5pt solid #888;padding:2mm}</style></head><body>' +
      '<h1>' + esc(L('Alarmierungsliste Krisenstab', 'Crisis team alert list')) + ' – ' + esc(s.meta.org || '') + '</h1><p>' + esc(L('Stand', 'As of')) + ': ' + K.fmt(K.today()) + ' · ' + esc(L('Stabsraum', 'Crisis room')) + ': ' + esc(cr.meta.location || '–') + ' · ' + esc(L('Ausweich', 'Alternate')) + ': ' + esc(cr.meta.altLocation || '–') + '</p>' +
      '<div class="lv">' + LEVELS_ESC.map(function (lv) { var e = cr.escalation.find(function (x) { return x.level === lv[0]; }); return '<div style="border-top:4px solid ' + lv[2] + '"><b>' + esc(K.lab(lv[1])) + '</b><br><small>' + esc(e ? e.trigger : K.lab(lv[3])) + '</small>' + (e ? '<br><small><b>' + esc(L('entscheidet', 'decides')) + ':</b> ' + esc(e.decides) + '</small>' : '') + '</div>'; }).join('') + '</div>' +
      '<table><thead><tr><th>' + esc(L('Fkt.', 'Fn.')) + '</th><th>' + esc(L('Rolle', 'Role')) + '</th><th>' + esc(L('Person', 'Person')) + '</th><th>' + esc(L('Vertretung', 'Deputy')) + '</th><th>' + esc(L('Erreichbarkeit', 'Reachability')) + '</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p><small>' + esc(L('VERTRAULICH – enthält personenbezogene Kontaktdaten. Nur für Mitglieder der BAO.', 'CONFIDENTIAL – contains personal contact data. For BAO members only.')) + '</small></p></body></html>';
    K.download('alarmierungsliste_' + K.today() + '.html', html, 'text/html;charset=utf-8');
  }

  /* ------------------------------------------------------------------
   * 4. Übungsmanagement
   * ---------------------------------------------------------------- */
  function exView() {
    var b = B(), h = [];
    h.push(K.pageHead(t('nav.exercises'), L('Übungen und Tests planen, durchführen und auswerten – vom Jahresübungsplan bis zu Lessons Learned und Maßnahmen.', 'Plan, conduct and evaluate exercises and tests – from the annual plan to lessons learned and actions.'), K.btn('exAdd', '+ ' + L('Übung', 'Exercise'), { cls: 'btn-primary' })));
    var m = metrics();
    h.push('<div class="grid grid-4">' + K.stat(b.exercises.filter(function (e) { return e.status === 'planned' || e.status === 'prepared'; }).length, L('geplant', 'planned'), '#2f7fd8') + K.stat(m.exConducted, L('durchgeführt', 'conducted'), '#12a39a') +
      K.stat(m.exEvaluated + ' / ' + m.exConducted, L('ausgewertet', 'evaluated'), m.exEvaluated === m.exConducted ? K.AMP.ok : K.AMP.warn) +
      K.stat(b.exercises.reduce(function (n, e) { return n + e.actions.filter(function (a) { return !a.done; }).length; }, 0), L('offene Maßnahmen aus Übungen', 'open actions from exercises'), K.AMP.warn) + '</div>');
    h.push(K.tabs('exTab', [['list', ['Übungen', 'Exercises']], ['year', ['Jahresübungsplan', 'Annual exercise plan']], ['types', ['Übungsarten', 'Exercise types']]], U.exTab));
    if (U.exTab === 'year') h.push(yearPlan());
    else if (U.exTab === 'types') h.push('<div class="card">' + K.table([L('Übungsart', 'Type'), L('Zweck', 'Purpose'), L('Aufwand', 'Effort')], EX_TYPES.map(function (x, i) { return '<tr><td><b>' + esc(K.lab(x[1])) + '</b></td><td class="small">' + esc(K.lab(x[2])) + '</td><td>' + '●'.repeat(Math.min(5, Math.ceil((i + 1) * 5 / EX_TYPES.length))) + '</td></tr>'; })) +
      '<p class="small muted">' + esc(L('Empfehlung: mit Planbesprechungen und Alarmierungsübungen beginnen und den Umfang schrittweise steigern; jede Übung auswerten und Erkenntnisse in die Pläne zurückführen (PDCA).', 'Recommendation: start with walkthroughs and alerting exercises and increase scope step by step; evaluate every exercise and feed findings back into the plans (PDCA).')) + '</p></div>');
    else h.push(exList());
    return h.join('');
  }
  function exList() {
    var b = B();
    var list = b.exercises.filter(function (e) { return !U.exStatus || e.status === U.exStatus; }).sort(function (x, y) { return (y.date || '').localeCompare(x.date || ''); });
    var h = ['<div class="card no-print"><div class="filters"><div><label>' + esc(L('Status', 'Status')) + '</label><select data-act="exFilter">' + A.opt('', t('c.all'), U.exStatus) + EX_STATUS.map(function (x) { return A.opt(x[0], K.lab(x[1]), U.exStatus); }).join('') + '</select></div></div></div>'];
    if (!list.length) { h.push('<div class="card muted">' + esc(L('Noch keine Übungen. Tipp: Übungen direkt aus einem BC-Plan heraus planen (🧪).', 'No exercises yet. Tip: plan exercises directly from a BC plan (🧪).')) + '</div>'); return h.join(''); }
    list.forEach(function (e) {
      var col = { planned: '#2f7fd8', prepared: '#7c3aed', done: '#e0a137', evaluated: '#1a7f37', cancelled: '#6b7280' }[e.status] || '#6b7280';
      var plans = e.planIds.map(function (id) { var p = b.plans.find(function (x) { return x.id === id; }); return p ? p.id + ' ' + p.name : id; });
      var openActs = e.actions.filter(function (a) { return !a.done; }).length;
      h.push('<details class="card ex-card"' + (U.open[e.id] ? ' open' : '') + ' data-act="exToggle" data-id="' + esc(e.id) + '" style="border-left:5px solid ' + col + '"><summary><b>' + esc(e.id) + ' · ' + esc(e.title) + '</b> <span class="small muted">' + K.fmt(e.date) + ' · ' + esc(lab(EX_TYPES, e.type)) + '</span> ' +
        K.pill(lab(EX_STATUS, e.status), col) + (e.result ? ' ' + K.amp(e.result === 'ok' ? 'ok' : e.result === 'partial' ? 'warn' : 'bad', lab(EX_RESULT, e.result)) : '') + (openActs ? ' ' + K.amp('warn', openActs + ' ' + L('offene Maßnahmen', 'open actions')) : '') + '</summary>' +
        '<div class="grid grid-3 small" style="margin-top:.5rem"><div><b>' + esc(L('Leitung', 'Lead')) + ':</b> ' + esc(e.lead || '–') + '<br><b>' + esc(L('Teilnehmende', 'Participants')) + ':</b> ' + esc(e.participants || '–') + '<br><b>' + esc(L('Dauer', 'Duration')) + ':</b> ' + K.hours(num(e.duration)) + '</div>' +
        '<div><b>' + esc(L('BC-Pläne', 'BC plans')) + ':</b> ' + esc(plans.join(', ') || '–') + '<br><b>' + esc(L('Szenario', 'Scenario')) + ':</b> ' + esc(e.scenario || '–') + '<br><b>' + esc(L('Ziele', 'Objectives')) + ':</b> ' + esc(e.objectives || '–') + '</div>' +
        '<div><b>' + esc(L('Erreichte Wiederanlaufzeit', 'Achieved recovery time')) + ':</b> ' + K.hours(num(e.achievedRto)) + (num(e.achievedRpo) !== null ? ' · RPO ' + K.hours(num(e.achievedRpo)) : '') + '<br><b>' + esc(L('Beobachtungen', 'Observations')) + ':</b> ' + esc(e.observations || '–') + '<br><b>Lessons Learned:</b> ' + esc(e.lessons || '–') +
        (e.evaluatedBy ? '<br><b>' + esc(L('Ausgewertet', 'Evaluated')) + ':</b> ' + esc(e.evaluatedBy) + ', ' + K.fmt(e.evaluatedDate) : '') + '</div></div>' +
        '<h3>' + esc(L('Maßnahmen aus der Übung', 'Actions from the exercise')) + '</h3>' + (e.actions.length ? K.table(['', { l: ['Maßnahme', 'Action'], w: 220 }, L('Verantwortlich', 'Responsible'), L('Termin', 'Due'), ''], e.actions.map(function (a, i) {
          return '<tr><td><input type="checkbox" data-act="exActDone" data-id="' + esc(e.id) + '" data-k="' + i + '"' + (a.done ? ' checked' : '') + ' aria-label="' + esc(L('erledigt', 'done')) + '"></td><td' + (a.done ? ' style="text-decoration:line-through;opacity:.6"' : '') + '>' + esc(a.text) + '</td><td class="small">' + esc(a.owner || '–') + '</td><td class="small nowrap">' + (a.due && !a.done && a.due < K.today() ? '<b style="color:var(--danger)">' + K.fmt(a.due) + '</b>' : K.fmt(a.due)) + '</td>' +
            '<td>' + K.btn('exActDel', '🗑', { id: e.id, k: String(i), cls: 'btn-sm', title: t('btn.delete') }) + '</td></tr>'; })) : '<p class="small muted">–</p>') +
        '<div class="row" style="margin-top:.5rem">' + K.btn('exEdit', '✏️ ' + L('Planung', 'Planning'), { id: e.id, cls: 'btn-sm' }) + K.btn('exRun', '▶ ' + L('Durchführung', 'Conduct'), { id: e.id, cls: 'btn-sm' }) + K.btn('exEval', '📋 ' + L('Auswertung', 'Evaluation'), { id: e.id, cls: 'btn-sm' }) +
        K.btn('exActAdd', '+ ' + L('Maßnahme', 'Action'), { id: e.id, cls: 'btn-sm' }) + K.btn('exDel', '🗑', { id: e.id, cls: 'btn-sm btn-danger', title: t('btn.delete') }) + '</div></details>');
    });
    return h.join('');
  }
  function yearPlan() {
    var b = B(), y = U.exYear, h = [];
    var months = []; for (var m = 0; m < 12; m++) months.push(new Date(y, m, 1).toLocaleDateString(HA.lang === 'de' ? 'de-DE' : 'en-GB', { month: 'short' }));
    h.push('<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">' + esc(L('Jahresübungsplan', 'Annual exercise plan')) + ' ' + y + '</h2><div class="row">' + K.btn('exYear', '◀', { id: '-1', cls: 'btn-sm' }) + K.btn('exYear', String(new Date().getFullYear()), { id: '0', cls: 'btn-sm' }) + K.btn('exYear', '▶', { id: '1', cls: 'btn-sm' }) + '</div></div>');
    h.push('<div class="table-wrap"><table class="year-plan"><thead><tr><th>' + esc(L('BC-Plan / Bereich', 'BC plan / area')) + '</th>' + months.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>');
    var rowsDef = b.plans.filter(function (p) { return p.status !== 'retired'; }).map(function (p) { return { id: p.id, label: p.id + ' ' + p.name, plan: p }; });
    rowsDef.push({ id: '_none', label: L('Übergreifend (ohne Plan, z. B. Krisenstab)', 'Cross-cutting (no plan, e.g. crisis team)') });
    rowsDef.forEach(function (r) {
      var cells = [];
      for (var mm = 0; mm < 12; mm++) {
        var ym = y + '-' + ('0' + (mm + 1)).slice(-2);
        var ex = b.exercises.filter(function (e) { return (e.date || '').slice(0, 7) === ym && (r.id === '_none' ? !e.planIds.length : e.planIds.indexOf(r.id) >= 0); });
        var due = r.plan ? (function () { var le = lastExercise(r.plan.id); var nd = K.addMonths(le ? le.date : (r.plan.created || K.today()).slice(0, 10), +r.plan.exerciseMonths || 12); return nd.slice(0, 7) === ym; })() : false;
        cells.push('<td class="' + (due ? 'yp-due' : '') + '"' + (due ? ' title="' + esc(L('Übung fällig', 'exercise due')) + '"' : '') + '>' + ex.map(function (e) {
          var col = { planned: '#2f7fd8', prepared: '#7c3aed', done: '#e0a137', evaluated: '#1a7f37', cancelled: '#9aa3ad' }[e.status];
          return '<button type="button" class="yp-chip" data-act="exOpen" data-id="' + esc(e.id) + '" style="background:' + col + '" title="' + esc(e.title + ' · ' + K.fmt(e.date) + ' · ' + lab(EX_STATUS, e.status)) + '">' + esc(lab(EX_TYPES, e.type).split(' ')[0]) + '</button>'; }).join('') +
          (due && !ex.length ? '<button type="button" class="yp-add" data-act="exAdd" data-id="plan:' + esc(r.id) + ':' + ym + '" title="' + esc(L('Übung planen', 'Plan exercise')) + '">+</button>' : '') + '</td>');
      }
      h.push('<tr><td class="small"><b>' + esc(r.label) + '</b></td>' + cells.join('') + '</tr>');
    });
    h.push('</tbody></table></div><div class="legend small" style="margin-top:.5rem">' + EX_STATUS.map(function (x) { var col = { planned: '#2f7fd8', prepared: '#7c3aed', done: '#e0a137', evaluated: '#1a7f37', cancelled: '#9aa3ad' }[x[0]]; return '<span><i style="background:' + col + '"></i>' + esc(K.lab(x[1])) + '</span>'; }).join('') +
      '<span><i style="background:transparent;outline:2px dashed #d48806"></i>' + esc(L('Übung laut Intervall fällig', 'exercise due per interval')) + '</span></div></div>');
    return h.join('');
  }
  var EX_PLAN_FIELDS = function () {
    var b = B();
    return [
      { k: 'title', l: ['Titel', 'Title'], req: true, full: true }, { k: 'type', l: ['Übungsart', 'Exercise type'], type: 'select', opts: EX_TYPES.map(function (x) { return [x[0], x[1]]; }) },
      { k: 'status', l: ['Status', 'Status'], type: 'select', opts: EX_STATUS }, { k: 'date', l: ['Datum', 'Date'], type: 'date', req: true }, { k: 'duration', l: ['Dauer (Stunden)', 'Duration (hours)'], type: 'number', min: 0 },
      { k: 'lead', l: ['Übungsleitung', 'Exercise lead'], type: 'person' }, { k: 'participants', l: ['Teilnehmende', 'Participants'] },
      { k: 'planIds', l: ['Geübte BC-Pläne', 'Exercised BC plans'], type: 'multi', opts: b.plans.map(function (p) { return [p.id, p.id + ' ' + p.name]; }), full: true },
      { k: 'processIds', l: ['Betroffene Geschäftsprozesse', 'Affected processes'], type: 'multi', opts: b.processes.map(function (p) { return [p.id, p.id + ' ' + p.name]; }), full: true },
      { k: 'scenario', l: ['Szenario / Ausgangslage', 'Scenario'], type: 'textarea', rows: 2, full: true }, { k: 'objectives', l: ['Übungsziele (messbar)', 'Objectives (measurable)'], type: 'textarea', rows: 2, full: true, ph: ['z. B. Wiederanlauf ERP innerhalb RTO 8 h; Alarmierung aller Stabsmitglieder < 30 min', 'e.g. ERP restart within RTO 8 h; all staff alerted < 30 min'] }
    ];
  };
  function editEx(e, preset) {
    var b = B(), isNew = !e;
    var obj = e || Object.assign({ title: '', type: 'tabletop', status: 'planned', date: K.addDays(K.today(), 30), duration: 2, lead: '', participants: '', planIds: [], processIds: [], scenario: '', objectives: '', actions: [] }, preset || {});
    K.editDialog(isNew ? L('Übung planen', 'Plan exercise') : L('Übung – Planung', 'Exercise – planning') + ' ' + obj.id, EX_PLAN_FIELDS(), obj, function (o) {
      if (isNew) { o.id = 'UE-' + ('0' + (b.seq.ex++)).slice(-2); o.actions = []; b.exercises.push(o); U.open[o.id] = true; }
    });
  }
  function runEx(e) {
    K.editDialog(L('Übung – Durchführung', 'Exercise – conduct') + ' ' + e.id, [
      { k: 'date', l: ['Durchgeführt am', 'Conducted on'], type: 'date', req: true }, { k: 'duration', l: ['tatsächliche Dauer (Stunden)', 'actual duration (hours)'], type: 'number', min: 0 },
      { k: 'participants', l: ['Teilnehmende', 'Participants'], full: true },
      { k: 'achievedRto', l: ['Erreichte Wiederanlaufzeit (Stunden)', 'Achieved recovery time (hours)'], type: 'number', min: 0, help: ['wird mit der RTO der geübten Pläne verglichen', 'compared with the RTO of the exercised plans'] },
      { k: 'achievedRpo', l: ['Tatsächlicher Datenverlust (Stunden)', 'Actual data loss (hours)'], type: 'number', min: 0 },
      { k: 'observations', l: ['Beobachtungen / Ablaufprotokoll', 'Observations / log'], type: 'textarea', rows: 4, full: true }
    ], e, function (o) { if (o.status === 'planned' || o.status === 'prepared') o.status = 'done'; });
  }
  function evalEx(e) {
    var info = '';
    if (num(e.achievedRto) !== null && e.planIds.length) info = '<div class="note small">' + e.planIds.map(function (id) { var p = B().plans.find(function (x) { return x.id === id; }); if (!p) return ''; var ef = effective(p);
      return esc(p.id) + ': RTO ' + K.hours(ef.rto.v) + ' → ' + esc(L('erreicht', 'achieved')) + ' ' + K.hours(+e.achievedRto) + ' ' + (ef.rto.v !== null && +e.achievedRto <= ef.rto.v ? '✔' : '✕'); }).join('<br>') + '</div>';
    K.editDialog(L('Übung – Auswertung', 'Exercise – evaluation') + ' ' + e.id, [
      { k: 'result', l: ['Ergebnis', 'Result'], type: 'select', opts: EX_RESULT }, { k: 'evaluatedDate', l: ['Ausgewertet am', 'Evaluated on'], type: 'date', req: true },
      { k: 'evaluatedBy', l: ['Ausgewertet von', 'Evaluated by'], type: 'person' },
      { k: 'lessons', l: ['Lessons Learned (Was lief gut/schlecht? Was ändern wir?)', 'Lessons learned (what went well/badly? what do we change?)'], type: 'textarea', rows: 4, full: true }
    ], Object.assign(e, { evaluatedDate: e.evaluatedDate || K.today() }), function (o) { o.status = 'evaluated'; }, L('Auswertung speichern', 'Save evaluation'), info);
  }
  function addAction(e) {
    K.editDialog(L('Maßnahme aus Übung', 'Action from exercise') + ' ' + e.id, [{ k: 'text', l: ['Maßnahme', 'Action'], req: true, full: true }, { k: 'owner', l: ['Verantwortlich', 'Responsible'], type: 'person' }, { k: 'due', l: ['Termin', 'Due'], type: 'date' }],
      { text: '', owner: '', due: K.addMonths(K.today(), 1) }, function (o) { e.actions.push({ id: A.uid('ua'), text: o.text, owner: o.owner, due: o.due, done: false }); });
  }

  /* ------------------------------------------------------------------
   * Registrierung: Ansichten, Ereignisse, Kalender, Roadmap, Bericht
   * ---------------------------------------------------------------- */
  A.views.bia = biaView; A.views.bcplans = plansView; A.views.crisis = crisisView; A.views.exercises = exView;
  function exById(id) { return B().exercises.find(function (e) { return e.id === id; }); }
  A.ext.click.push(function (act, el) {
    var b = B(), id = el.getAttribute('data-id');
    switch (act) {
      case 'biaTab': U.biaTab = id; A.render(); return true;
      case 'biaAdd': editProcess(null); return true;
      case 'biaEdit': editProcess(procById(id)); return true;
      case 'biaExample': examples(); return true;
      case 'biaDel': { var p = procById(id); A.confirm(L('Geschäftsprozess ' + p.id + ' „' + p.name + '“ löschen? Zugeordnete BC-Pläne bleiben erhalten.', 'Delete process ' + p.id + ' "' + p.name + '"? Linked BC plans are kept.'), function () { b.processes = b.processes.filter(function (x) { return x.id !== id; }); A.save(); A.render(); }); return true; }
      case 'bcmCatAdd': b.settings.cats.push({ k: 'c' + Date.now().toString(36), l: L('Neue Kategorie', 'New category') }); A.save(); A.render(); return true;
      case 'bcmCatDel': b.settings.cats.splice(+id, 1); A.save(); A.render(); return true;
      case 'planAdd': if (!b.processes.length) { A.go('bia'); return true; } editPlan(null, procById(id) ? id : null); return true;
      case 'planEdit': editPlan(b.plans.find(function (x) { return x.id === id; })); return true;
      case 'planDel': { var pl = b.plans.find(function (x) { return x.id === id; }); A.confirm(L('BC-Plan ' + pl.id + ' löschen?', 'Delete BC plan ' + pl.id + '?'), function () { b.plans = b.plans.filter(function (x) { return x.id !== id; }); A.save(); A.render(); }); return true; }
      case 'roleAdd': editRole(null); return true;
      case 'roleEdit': editRole(+id); return true;
      case 'roleDel': b.crisis.roles.splice(+id, 1); A.save(); A.render(); return true;
      case 'roleUp': if (+id > 0) { var r = b.crisis.roles.splice(+id, 1)[0]; b.crisis.roles.splice(+id - 1, 0, r); A.save(); A.render(); } return true;
      case 'roleDefaults': DEFAULT_ROLES.forEach(function (r) { b.crisis.roles.push({ fn: r.fn, role: K.lab(r.role), person: '', deputy: '', tasks: K.lab(r.tasks), reach: '' }); }); A.save(); A.render(); return true;
      case 'escAdd': editEsc(null); return true;
      case 'escEdit': editEsc(+id); return true;
      case 'escDel': b.crisis.escalation.splice(+id, 1); A.save(); A.render(); return true;
      case 'escDefaults': DEFAULT_ESC.forEach(function (e) { b.crisis.escalation.push({ level: e.level, trigger: K.lab(e.trigger), detects: K.lab(e.detects), decides: K.lab(e.decides), alarm: K.lab(e.alarm), maxMin: e.maxMin, measures: K.lab(e.measures) }); }); A.save(); A.render(); return true;
      case 'crisisPrint': printAlarm(); return true;
      case 'exTab': U.exTab = id; A.render(); return true;
      case 'exYear': U.exYear = id === '0' ? new Date().getFullYear() : U.exYear + (+id); A.render(); return true;
      case 'exAdd': {
        var preset = {};
        if (id && id.indexOf('plan:') === 0) {
          var parts = id.split(':'), plan = b.plans.find(function (x) { return x.id === parts[1]; });
          if (plan) preset = { planIds: [plan.id], processIds: plan.processId ? [plan.processId] : [], title: L('Übung', 'Exercise') + ' ' + plan.name, type: plan.type === 'recovery' ? 'restore' : 'tabletop', objectives: L('Wiederanlauf innerhalb RTO ', 'Recovery within RTO ') + K.hours(effective(plan).rto.v) };
          if (parts[2]) preset.date = parts[2] + '-15';
        }
        editEx(null, preset); return true;
      }
      case 'exOpen': U.exTab = 'list'; U.open[id] = true; A.render(); setTimeout(function () { var d = document.querySelector('details[data-id="' + id + '"]'); if (d) d.scrollIntoView({ block: 'center' }); }, 50); return true;
      case 'exEdit': editEx(exById(id)); return true;
      case 'exRun': runEx(exById(id)); return true;
      case 'exEval': evalEx(exById(id)); return true;
      case 'exActAdd': addAction(exById(id)); return true;
      case 'exActDel': exById(id).actions.splice(+el.getAttribute('data-k'), 1); A.save(); A.render(); return true;
      case 'exDel': { var ex = exById(id); A.confirm(L('Übung ' + ex.id + ' löschen?', 'Delete exercise ' + ex.id + '?'), function () { b.exercises = b.exercises.filter(function (x) { return x.id !== id; }); A.save(); A.render(); }); return true; }
      case 'exToggle': return false;
    }
  });
  // <details> auf/zu merken
  document.addEventListener('toggle', function (e) { var d = e.target; if (d.matches && d.matches('details[data-act=exToggle]')) U.open[d.getAttribute('data-id')] = d.open; }, true);
  A.ext.change.push(function (act, el) {
    var b = B();
    if (act === 'bcmSet') { var k = el.getAttribute('data-k'); b.settings[k] = k === 'intolerable' ? +el.value : el.value; A.save(); A.render(); return true; }
    if (act === 'exFilter') { U.exStatus = el.value; A.render(); return true; }
    if (act === 'exActDone') { var e = exById(el.getAttribute('data-id')); e.actions[+el.getAttribute('data-k')].done = el.checked; A.save(); A.render(); return true; }
    if (act === 'bcmSetIv') {
      var iv = el.value.split(/[,;\s]+/).map(Number).filter(function (x) { return x > 0; }).sort(function (x, y) { return x - y; });
      if (iv.length >= 2) { b.settings.intervals = iv; A.save(); } else A.toast(L('Mindestens zwei Intervalle angeben.', 'Enter at least two intervals.'), true);
      A.render(); return true;
    }
    if (act === 'bcmSetN' || act === 'bcmCat' || act === 'crisisMeta') { if (act === 'crisisMeta' && el.type === 'date') { b.crisis.meta[el.getAttribute('data-k')] = el.value; A.save(); } A.render(); return true; }
  });
  A.ext.input.push(function (act, el) {
    var b = B();
    if (act === 'bcmSetN') { b.settings[el.getAttribute('data-k')] = +el.value || 1; A.save(); return true; }
    if (act === 'bcmCat') { b.settings.cats[+el.getAttribute('data-i')].l = el.value; A.save(); return true; }
    if (act === 'crisisMeta') { b.crisis.meta[el.getAttribute('data-k')] = el.type === 'number' ? (+el.value || 12) : el.value; A.save(); return true; }
    if (act === 'bcmSetIv') return true;
  });
  // Pflichtenkalender: Reviews und Übungen
  if (HA.Cal) HA.Cal.providers.push(function (s) {
    var b = s.bcm, out = [];
    b.processes.forEach(function (p) { out.push({ key: 'BIA:' + p.id, date: K.addMonths(p.lastReview || (p.created || K.today()).slice(0, 10), +p.reviewMonths || 12), title: L('BIA überprüfen', 'Review BIA') + ': ' + p.id + ' ' + p.name, sub: 'BSI 200-4', cat: 'bcm', src: 'bcm', owner: p.owner, go: 'bia', done: function (st, o) { p.lastReview = o.date; } }); });
    b.plans.filter(function (x) { return x.status !== 'retired'; }).forEach(function (pl) {
      out.push({ key: 'BCPR:' + pl.id, date: K.addMonths(pl.lastReview || pl.approvedDate || (pl.created || K.today()).slice(0, 10), +pl.reviewMonths || 12), title: L('BC-Plan überprüfen', 'Review BC plan') + ': ' + pl.id + ' ' + pl.name, sub: lab(PLAN_TYPES, pl.type), cat: 'bcm', src: 'bcm', owner: pl.owner, go: 'bcplans', done: function (st, o) { pl.lastReview = o.date; } });
      var le = lastExercise(pl.id), planned = exercisesOfPlan(pl.id).some(function (e) { return (e.status === 'planned' || e.status === 'prepared') && e.date >= K.today(); });
      if (!planned) out.push({ key: 'BCPX:' + pl.id, date: K.addMonths(le ? le.date : (pl.created || K.today()).slice(0, 10), +pl.exerciseMonths || 12), title: L('Übung fällig', 'Exercise due') + ': ' + pl.id + ' ' + pl.name, sub: L('noch keine Übung geplant', 'no exercise planned yet'), cat: 'exercise', src: 'bcm', owner: pl.owner, go: 'exercises' });
    });
    b.exercises.forEach(function (e) {
      if (e.status === 'planned' || e.status === 'prepared') out.push({ key: 'EX:' + e.id, date: e.date, title: L('Übung', 'Exercise') + ' ' + e.id + ': ' + e.title, sub: lab(EX_TYPES, e.type), cat: 'exercise', src: 'bcm', owner: e.lead, go: 'exercises', remind: 21 });
      if (e.status === 'done') out.push({ key: 'EXE:' + e.id, date: K.addDays(e.date, 14), title: L('Übung auswerten', 'Evaluate exercise') + ' ' + e.id + ': ' + e.title, sub: '', cat: 'exercise', src: 'bcm', owner: e.lead, go: 'exercises' });
      e.actions.forEach(function (a) { if (!a.done && a.due) out.push({ key: 'EXA:' + a.id, date: a.due, title: L('Maßnahme aus Übung', 'Action from exercise') + ' ' + e.id + ': ' + a.text, sub: '', cat: 'measure', src: 'bcm', owner: a.owner, go: 'exercises', done: function () { a.done = true; } }); });
    });
    var mt = b.crisis.meta;
    if (b.crisis.roles.length) out.push({ key: 'CR', date: K.addMonths(mt.lastReview || K.today(), +mt.reviewMonths || 12), title: L('Krisenstab: Rollen, Kontakte und Eskalation überprüfen', 'Crisis team: review roles, contacts and escalation'), sub: 'BSI 200-4', cat: 'bcm', src: 'bcm', go: 'crisis', done: function (st, o) { mt.lastReview = o.date; } });
    return out;
  });
  // Roadmap: offene Maßnahmen aus Übungen
  HA.Risk.roadmapKinds.push('bcm');
  HA.Risk.roadmapSources.push(function (state, opts) {
    if (opts.assetId && !opts.includeProject) return [];
    var out = [];
    state.bcm.exercises.forEach(function (e) { e.actions.forEach(function (a) {
      if (a.done) return;
      out.push({ kind: 'bcm', prio: e.result === 'fail' ? 'p1' : 'p2', cat: e.result === 'fail' ? 'veryhigh' : 'high', score: e.result === 'fail' ? 12 : 8, ref: e.id, title: a.text, asset: 'BCM', detail: e.title + ' · ' + lab(EX_TYPES, e.type), action: e.lessons || '', owner: a.owner || '', due: a.due || '', status: L('offen', 'open'), set: { type: 'bcm', ex: e.id, act: a.id } });
    }); });
    return out;
  });
  HA.Risk.roadmapWriters.bcm = function (state, set, k, v) { var e = state.bcm.exercises.find(function (x) { return x.id === set.ex; }); var a = e && e.actions.find(function (x) { return x.id === set.act; }); if (a) a[k] = v; };
  // Bericht
  A.ext.reportOpts.push({ key: 'bcm', label: { de: 'Business Continuity (BIA, Pläne, Krisenstab, Übungen)', en: 'Business continuity (BIA, plans, crisis team, exercises)' } });
  HA.Report.ext.push({ key: 'bcm', build: function (state, scope, H) {
    var b = state.bcm; if (!b.processes.length && !b.plans.length && !b.crisis.roles.length && !b.exercises.length) return '';
    var rk = rank(), h = ['<section class="pb"><h2>' + H.esc(L('Business Continuity Management', 'Business continuity management')) + '</h2><p class="small">' + H.esc(L('In Anlehnung an BSI-Standard 200-4 · Stufe: ', 'Based on BSI Standard 200-4 · stage: ')) + H.esc(lab(STAGES, b.settings.stage)) + ' · ' + H.esc(L('zeitkritisch, wenn MTA ≤ ', 'time-critical if MTPD ≤ ')) + K.hours(b.settings.critHours) + '</p>'];
    if (b.processes.length) {
      h.push('<h3>' + H.esc(L('Business-Impact-Analyse', 'Business impact analysis')) + '</h3><table><thead><tr><th style="width:10mm">Prio</th><th>' + H.esc(L('Geschäftsprozess', 'Process')) + '</th><th style="width:17mm">MTA</th><th style="width:17mm">RTO</th><th style="width:17mm">RPO</th><th style="width:14mm">' + H.esc(L('Niveau', 'Level')) + '</th><th style="width:22mm">' + H.esc(L('BC-Plan', 'BC plan')) + '</th></tr></thead><tbody>' +
        b.processes.slice().sort(function (x, y) { return (rk[x.id] || 999) - (rk[y.id] || 999); }).map(function (p) { var crit = isCritical(p);
          return '<tr><td>' + (rk[p.id] || '–') + '</td><td><b>' + H.esc(p.id + ' ' + p.name) + '</b>' + (crit ? ' <span class="badge sev-high">' + H.esc(L('zeitkritisch', 'time-critical')) + '</span>' : '') + '<div class="small muted">' + H.esc([p.dept, p.owner].filter(Boolean).join(' · ')) + '</div></td><td>' + K.hours(mtpd(p)) + '</td><td>' + K.hours(num(p.rto)) + '</td><td>' + K.hours(num(p.rpo)) + '</td><td>' + (p.wan ? H.esc(p.wan) + ' %' : '–') + '</td><td class="small">' + H.esc(plansOf(p.id).map(function (x) { return x.id; }).join(', ') || '–') + '</td></tr>'; }).join('') + '</tbody></table>');
    }
    if (b.plans.length) {
      h.push('<h3>' + H.esc(L('BC-Pläne und Kontinuitätsstrategien', 'BC plans and continuity strategies')) + '</h3><table><thead><tr><th>' + H.esc(L('Plan', 'Plan')) + '</th><th style="width:36mm">' + H.esc(L('Strategie', 'Strategy')) + '</th><th style="width:22mm">RTO / RPO</th><th style="width:26mm">' + H.esc(L('letzte Übung', 'last exercise')) + '</th><th style="width:20mm">' + H.esc(L('Status', 'Status')) + '</th></tr></thead><tbody>' +
        b.plans.map(function (pl) { var ef = effective(pl), le = lastExercise(pl.id), ac = achieved(pl.id), p = procById(pl.processId);
          return '<tr><td><b>' + H.esc(pl.id + ' ' + pl.name) + '</b><div class="small muted">' + H.esc(p ? p.id + ' ' + p.name : '') + '</div></td><td class="small">' + H.esc(lab(STRATEGIES, pl.strategy)) + (pl.strategyDesc ? '<br>' + H.esc(pl.strategyDesc) : '') + '</td><td class="small">' + K.hours(ef.rto.v) + (ef.rto.own ? '' : '*') + ' / ' + K.hours(ef.rpo.v) + (ef.rpo.own ? '' : '*') +
            (ac ? '<br>' + H.esc(L('erreicht', 'achieved')) + ' ' + K.hours(ac.v) + ' ' + (ef.rto.v !== null && ac.v <= ef.rto.v ? '✔' : '✕') : '') + '</td><td class="small">' + (le ? H.fmtDate(le.date) + '<br>' + H.esc(lab(EX_RESULT, le.result)) : '–') + '</td><td class="small">' + H.esc(lab(PLAN_STATUS, pl.status)) + '</td></tr>'; }).join('') + '</tbody></table><p class="small muted">* ' + H.esc(L('aus der BIA des Geschäftsprozesses übernommen', 'inherited from the BIA of the process')) + '</p>');
    }
    if (b.crisis.roles.length) {
      h.push('<h3>' + H.esc(L('Krisenstab (BAO)', 'Crisis team (BAO)')) + '</h3><table><thead><tr><th style="width:12mm">' + H.esc(L('Fkt.', 'Fn.')) + '</th><th>' + H.esc(L('Rolle', 'Role')) + '</th><th style="width:36mm">' + H.esc(L('Person', 'Person')) + '</th><th style="width:36mm">' + H.esc(L('Vertretung', 'Deputy')) + '</th></tr></thead><tbody>' +
        b.crisis.roles.map(function (r) { return '<tr><td>' + H.esc(r.fn) + '</td><td>' + H.esc(r.role) + '</td><td>' + H.esc(r.person || '–') + '</td><td>' + H.esc(r.deputy || '–') + '</td></tr>'; }).join('') + '</tbody></table>');
    }
    if (b.crisis.escalation.length) {
      h.push('<h3>' + H.esc(L('Eskalationspfade', 'Escalation paths')) + '</h3><table><thead><tr><th style="width:18mm">' + H.esc(L('Stufe', 'Level')) + '</th><th>' + H.esc(L('Auslöser', 'Trigger')) + '</th><th style="width:32mm">' + H.esc(L('entscheidet', 'decides')) + '</th><th style="width:40mm">' + H.esc(L('alarmiert', 'alerts')) + '</th><th style="width:14mm">max.</th></tr></thead><tbody>' +
        b.crisis.escalation.map(function (e) { var lv = LEVELS_ESC.find(function (x) { return x[0] === e.level; }) || LEVELS_ESC[0]; return '<tr><td><b style="color:' + lv[2] + '">' + H.esc(K.lab(lv[1])) + '</b></td><td class="small">' + H.esc(e.trigger) + '</td><td class="small">' + H.esc(e.decides) + '</td><td class="small">' + H.esc(e.alarm) + '</td><td>' + (e.maxMin ? H.esc(e.maxMin) + ' min' : '–') + '</td></tr>'; }).join('') + '</tbody></table>');
    }
    var exs = b.exercises.filter(function (e) { return e.date >= K.addMonths(K.today(), -12); }).sort(function (x, y) { return (x.date || '').localeCompare(y.date || ''); });
    if (exs.length) {
      h.push('<h3>' + H.esc(L('Übungen (letzte und nächste 12 Monate)', 'Exercises (last and next 12 months)')) + '</h3><table><thead><tr><th style="width:20mm">' + H.esc(L('Datum', 'Date')) + '</th><th>' + H.esc(L('Übung', 'Exercise')) + '</th><th style="width:32mm">' + H.esc(L('Art', 'Type')) + '</th><th style="width:22mm">' + H.esc(L('Status', 'Status')) + '</th><th style="width:24mm">' + H.esc(L('Ergebnis', 'Result')) + '</th></tr></thead><tbody>' +
        exs.map(function (e) { return '<tr><td>' + H.fmtDate(e.date) + '</td><td><b>' + H.esc(e.id + ' ' + e.title) + '</b>' + (e.lessons ? '<div class="small">' + H.esc(K.clip(e.lessons, 220)) + '</div>' : '') + '</td><td class="small">' + H.esc(lab(EX_TYPES, e.type)) + '</td><td class="small">' + H.esc(lab(EX_STATUS, e.status)) + '</td><td class="small">' + H.esc(lab(EX_RESULT, e.result)) + (num(e.achievedRto) !== null ? '<br>WAZ ' + K.hours(+e.achievedRto) : '') + '</td></tr>'; }).join('') + '</tbody></table>');
    }
    h.push('</section>');
    return h.join('');
  } });

  return { metrics: metrics, mtpd: mtpd, suggestMtpd: suggestMtpd, effective: effective, isCritical: isCritical, resources: resources };
})();

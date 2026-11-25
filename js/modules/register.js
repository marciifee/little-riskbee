/* =====================================================================
 * modules/register.js – Risikoregister, Risikoappetit & Risikoakzeptanz
 * ---------------------------------------------------------------------
 * Das Register führt ALLE Risiken zusammen:
 *   • eigene Risiken (hier frei definierbar, 4 × 4-Matrix wie BSI 200-3)
 *   • Befundrisiken aus den Scans (Ansicht „Risikobewertung“)
 *   • Projektrisiken (Ansicht „Projektrisiken & SWOT“, 5 × 5)
 * Risikoappetit (Appetite): bis zu welcher Kategorie Risiken ohne
 *   gesonderte Entscheidung getragen werden.
 * Risikotoleranz: Obergrenze, bis zu der eine formale Risikoakzeptanz
 *   (mit Befugnis, Begründung, Befristung) zulässig ist – darüber muss
 *   behandelt werden (oder ausdrückliche Ausnahme der Leitung).
 * Datenmodell:
 *   state.register = { seq, items:[{ id, title, desc, category, threat, cause,
 *       consequence, assets[], owner, p, i, treatment, measures, rp, ri, status,
 *       due, reviewMonths, lastReview, reviews[], q{fMin,fMode,fMax,lMin,lMode,lMax,rf,rl},
 *       created, updated }] }
 *   state.appetite = { statement, appetite, tolerance, authority{cat}, maxMonths{cat},
 *       reviewMonths{cat}, lossAppetite, lossTolerance, approvedBy, approvedDate, version,
 *       calib{f[4][3], l[4][3]}, mc{n, seed, red, inclFindings, inclCustom} }
 *   state.acceptances = { "R:<id>" | "F:<fid>" | "P:<id>": { by, role, date, until,
 *       reason, conditions, cat, exception } }
 * ===================================================================== */
window.HA = window.HA || {};

HA.Register = (function () {
  'use strict';
  var A = HA.App, K = HA.Kit, L = K.L, R = HA.Risk;
  var esc = A.esc, t = HA.t;
  var RANK = { low: 0, medium: 1, high: 2, veryhigh: 3 };
  var U = { tab: 'list', src: '', cat: '', ap: '', q: '', closed: false };

  var CATEGORIES = [['cyber', ['Cyberangriff', 'Cyber attack']], ['it', ['IT-Ausfall / Betrieb', 'IT outage / operations']], ['data', ['Datenschutz', 'Data protection']],
    ['org', ['Organisation / Prozesse', 'Organisation / processes']], ['people', ['Personal', 'People']], ['supplier', ['Lieferkette / Dienstleister', 'Supply chain / providers']],
    ['infra', ['Infrastruktur / Gebäude', 'Infrastructure / buildings']], ['legal', ['Recht / Compliance', 'Legal / compliance']], ['nature', ['Elementarereignis', 'Natural hazard']],
    ['finance', ['Finanzen', 'Finance']], ['other', ['Sonstiges', 'Other']]];
  var STATUS = [['open', ['offen', 'open']], ['treatment', ['in Behandlung', 'in treatment']], ['accepted', ['akzeptiert', 'accepted']], ['closed', ['geschlossen', 'closed']]];
  var TREAT = ['avoid', 'reduce', 'transfer', 'accept'];

  function S() { return A.state(); }
  function catLabel(k) { var c = CATEGORIES.find(function (x) { return x[0] === k; }); return c ? K.lab(c[1]) : (k || '–'); }
  function stLabel(k) { var c = STATUS.find(function (x) { return x[0] === k; }); return c ? K.lab(c[1]) : (k || '–'); }

  /* ------------------------------------------------------------------
   * Normalisierung & Standardwerte
   * ---------------------------------------------------------------- */
  function defaultsAppetite() {
    return {
      statement: '', appetite: 'medium', tolerance: 'high',
      authority: { low: 'Risikoeigner/in', medium: 'Informationssicherheitsbeauftragte/r (ISB)', high: 'Geschäftsführung', veryhigh: 'Geschäftsführung' },
      maxMonths: { low: 24, medium: 12, high: 6, veryhigh: 3 },
      reviewMonths: { low: 12, medium: 12, high: 6, veryhigh: 3 },
      lossAppetite: '', lossTolerance: '', approvedBy: '', approvedDate: '', version: '1.0', nextReview: '',
      // Kalibrierung qualitativ → quantitativ (für Monte-Carlo), [min, wahrscheinlich, max]
      calib: { f: [[0.02, 0.1, 0.2], [0.2, 0.5, 1], [1, 2, 6], [4, 8, 12]],
        l: [[200, 1000, 5000], [5000, 15000, 50000], [50000, 100000, 250000], [250000, 500000, 2000000]], preset: 'sme' },
      mc: { n: 10000, seed: 42, red: 70, inclFindings: true, inclCustom: true, inclProject: false }
    };
  }
  A.ext.normalize.push(function (s) {
    s.register = s.register || {}; if (!Array.isArray(s.register.items)) s.register.items = []; s.register.seq = s.register.seq || (s.register.items.length + 1);
    var d = defaultsAppetite();
    s.appetite = Object.assign({}, d, s.appetite || {});
    ['authority', 'maxMonths', 'reviewMonths', 'mc'].forEach(function (k) { s.appetite[k] = Object.assign({}, d[k], s.appetite[k] || {}); });
    s.appetite.calib = s.appetite.calib && s.appetite.calib.f ? s.appetite.calib : d.calib;
    if (!s.acceptances || typeof s.acceptances !== 'object') s.acceptances = {};
    s.register.items.forEach(function (r) { r.q = r.q || {}; r.reviews = r.reviews || []; r.assets = r.assets || []; });
  });

  /* ------------------------------------------------------------------
   * Vereinheitlichte Risikozeilen aus allen Quellen
   * ---------------------------------------------------------------- */
  function customCat(r) { return R.category(+r.p || 1, +r.i || 1); }
  function customRes(r) { return r.rp && r.ri ? R.category(+r.rp, +r.ri) : ''; }
  /** Alle Risiken als einheitliche Zeilen. opts.closed = geschlossene einbeziehen */
  function rows(opts) {
    opts = opts || {};
    var s = S(), out = [], today = K.today();
    s.register.items.forEach(function (r) {
      if (!opts.closed && r.status === 'closed') return;
      var cat = customCat(r), res = customRes(r);
      out.push({ key: 'R:' + r.id, src: 'custom', id: r.id, title: r.title, sub: catLabel(r.category) + (r.assets.length ? ' · ' + r.assets.map(assetName).join(', ') : ''),
        owner: r.owner, p: +r.p || 1, i: +r.i || 1, rp: +r.rp || 0, ri: +r.ri || 0, scale: 4, cat: cat, res: res, eff: res || cat, treatment: r.treatment || '', status: r.status || 'open',
        statusText: stLabel(r.status || 'open'), due: r.due || '', next: nextReview(r), item: r, measures: r.measures || '' });
    });
    R.findingRows(s, {}).forEach(function (f) {
      out.push({ key: 'F:' + f.fid, src: 'finding', id: f.id, title: f.f.title, sub: f.asset.name + ' · ' + f.scan.tool + (f.f.port ? ' · ' + f.f.port : ''), owner: f.owner,
        p: f.p, i: f.i, rp: 0, ri: 0, scale: 4, cat: f.cat, res: '', eff: f.cat, treatment: f.treatment || '', status: f.status, statusText: t('fstatus.' + f.status), due: f.due || '',
        next: '', fr: f, measures: f.measure || '', suggested: f.suggested });
    });
    (s.projectRisks || []).forEach(function (pr) {
      if (!opts.closed && (pr.status === 'done')) return;
      var cat = R.pmCategory((+pr.p || 1) * (+pr.i || 1)), res = pr.rp && pr.ri ? R.pmCategory(pr.rp * pr.ri) : '';
      out.push({ key: 'P:' + pr.id, src: 'project', id: pr.id, title: pr.title || '–', sub: t('pm.cat.' + (pr.category || 'technology')), owner: pr.owner, p: +pr.p || 1, i: +pr.i || 1,
        rp: +pr.rp || 0, ri: +pr.ri || 0, scale: 5, cat: cat, res: res, eff: res || cat, treatment: pr.strategy || '', status: pr.status || 'open', statusText: t('pm.st.' + (pr.status || 'open')),
        due: pr.due || '', next: '', pr: pr, measures: pr.measures || '' });
    });
    out.forEach(function (x) { x.acc = s.acceptances[x.key] || null; x.ap = appetiteState(x, today); });
    out.sort(function (a, b) { return (RANK[b.eff] - RANK[a.eff]) || (RANK[b.cat] - RANK[a.cat]) || String(a.id).localeCompare(String(b.id)); });
    return out;
  }
  function assetName(id) { var a = S().assets.find(function (x) { return x.id === id; }); return a ? a.name : id; }

  /**
   * Bewertung gegen Risikoappetit:
   *  within      – innerhalb des Appetits (tragbar)
   *  accepted    – über Appetit, gültig akzeptiert
   *  expired     – Akzeptanz abgelaufen
   *  decision    – über Appetit, Entscheidung (Behandlung/Akzeptanz) fehlt
   *  treating    – über Appetit, Behandlung läuft
   *  intolerable – über Toleranz und weder behandelt noch als Ausnahme akzeptiert
   */
  function appetiteState(x, today) {
    var ap = S().appetite, rk = RANK[x.eff];
    if (rk <= RANK[ap.appetite]) return 'within';
    var acc = x.acc;
    if (acc) {
      if (acc.until && acc.until < today) return 'expired';
      if (rk > RANK[ap.tolerance] && !acc.exception) return 'intolerable';
      return 'accepted';
    }
    var treating = ['reduce', 'avoid', 'transfer'].indexOf(x.treatment) >= 0 || ['treatment', 'progress', 'partial'].indexOf(x.status) >= 0;
    if (rk > RANK[ap.tolerance]) return treating ? 'treating' : 'intolerable';
    if (x.treatment === 'accept') return 'undoc';
    return treating ? 'treating' : 'decision';
  }
  var AP = {
    within: ['ok', ['im Appetit', 'within appetite']], accepted: ['ok', ['akzeptiert', 'accepted']], treating: ['warn', ['in Behandlung', 'in treatment']],
    decision: ['warn', ['Entscheidung fehlt', 'decision missing']], undoc: ['warn', ['Akzeptanz nicht dokumentiert', 'acceptance not documented']], expired: ['bad', ['Akzeptanz abgelaufen', 'acceptance expired']], intolerable: ['bad', ['über Toleranz', 'above tolerance']]
  };
  function apBadge(k) { return K.amp(AP[k][0], K.lab(AP[k][1])); }

  function nextReview(r) {
    var ap = S().appetite, cat = customRes(r) || customCat(r);
    var m = +r.reviewMonths || ap.reviewMonths[cat] || 12;
    return K.addMonths(r.lastReview || (r.created || K.today()).slice(0, 10), m);
  }

  /* ------------------------------------------------------------------
   * Ansicht
   * ---------------------------------------------------------------- */
  function view() {
    var h = [K.pageHead(t('nav.register'), L('Alle Risiken an einem Ort: eigene Risiken, Befundrisiken aus Scans und Projektrisiken – bewertet gegen Risikoappetit und Toleranz, mit Akzeptanz, Review und Monte-Carlo-Simulation.',
      'All risks in one place: own risks, finding risks from scans and project risks – assessed against risk appetite and tolerance, with acceptance, review and Monte Carlo simulation.'),
      K.btn('regCsv', '⬇ CSV') + K.btn('regAdd', '+ ' + L('Eigenes Risiko', 'Own risk'), { cls: 'btn-primary' }))];
    h.push(K.tabs('regTab', [['list', ['Register', 'Register']], ['appetite', ['Risikoappetit & Akzeptanz', 'Risk appetite & acceptance']], ['mc', ['Monte-Carlo-Analyse', 'Monte Carlo analysis']]], U.tab));
    if (U.tab === 'appetite') h.push(appetiteView());
    else if (U.tab === 'mc') h.push(HA.MC ? HA.MC.view() : '');
    else h.push(listView());
    return h.join('');
  }

  /** 4 × 4-Matrix mit Appetit- (gestrichelt) und Toleranzgrenze (durchgezogen). */
  function appetiteMatrix(list, residual, cellPx) {
    var ap = S().appetite, n = 4, cell = cellPx || 56, counts = {};
    list.forEach(function (x) { if (x.scale !== 4) return; var p = residual && x.rp ? x.rp : x.p, i = residual && x.ri ? x.ri : x.i; counts[p + '-' + i] = (counts[p + '-' + i] || 0) + 1; });
    var h = ['<div class="hm" style="display:grid;grid-template-columns:22px minmax(56px,120px) repeat(4,minmax(26px,' + cell + 'px));gap:6px;align-items:center;width:max-content;max-width:100%;font-size:12px">'];
    h.push('<div style="grid-column:1;grid-row:1 / span 4;writing-mode:vertical-rl;transform:rotate(180deg);text-align:center;font-weight:700">' + esc(t('risk.iTitle')) + '</div>');
    for (var row = 1; row <= n; row++) {
      var i = n - row + 1;
      h.push('<div style="grid-column:2;grid-row:' + row + ';text-align:right;font-weight:600;hyphens:auto">' + esc(t('risk.i' + i)) + '</div>');
      for (var p = 1; p <= n; p++) {
        var cat = R.category(p, i), cnt = counts[p + '-' + i] || 0, rk = RANK[cat];
        var border = rk > RANK[ap.tolerance] ? 'outline:3px solid var(--text,#111);outline-offset:2px;' : rk > RANK[ap.appetite] ? 'outline:2px dashed var(--text,#111);outline-offset:2px;' : '';
        h.push('<div title="' + esc(t('risk.cat.' + cat)) + (cnt ? ' · ' + cnt : '') + '" style="grid-column:' + (p + 2) + ';grid-row:' + row + ';aspect-ratio:1/1;border-radius:7px;background:' + R.COLORS[cat] + ';color:' + R.TEXT[cat] + ';' + border +
          'display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.3em;-webkit-print-color-adjust:exact;print-color-adjust:exact">' + (cnt || '') + '</div>');
      }
    }
    for (var q = 1; q <= n; q++) h.push('<div style="grid-column:' + (q + 2) + ';grid-row:5;text-align:center;font-weight:600;hyphens:auto">' + esc(t('risk.p' + q)) + '</div>');
    h.push('<div style="grid-column:3 / span 4;grid-row:6;text-align:center;font-weight:700;border-top:1px solid currentColor;padding-top:4px">' + esc(t('risk.pTitle')) + ' →</div></div>');
    var li = function (st) { return '<i style="display:inline-block;width:11px;height:11px;border:2px ' + st + ' currentColor;border-radius:3px;margin-right:5px;vertical-align:middle"></i>'; };
    h.push('<div style="display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:6px;font-size:.8em;opacity:.85"><span>' + li('dashed') + esc(L('über Risikoappetit (Entscheidung nötig)', 'above appetite (decision needed)')) + '</span>' +
      '<span>' + li('solid') + esc(L('über Toleranz (Behandlung Pflicht)', 'above tolerance (treatment required)')) + '</span></div>');
    return h.join('');
  }

  function listView() {
    var all = rows({ closed: U.closed }), q = U.q.toLowerCase();
    var list = all.filter(function (x) {
      return (!U.src || x.src === U.src) && (!U.cat || x.eff === U.cat) && (!U.ap || x.ap === U.ap) &&
        (!q || (x.id + ' ' + x.title + ' ' + x.sub + ' ' + (x.owner || '') + ' ' + x.measures).toLowerCase().indexOf(q) >= 0);
    });
    var h = [], cnt = {};
    all.forEach(function (x) { cnt[x.ap] = (cnt[x.ap] || 0) + 1; });
    h.push('<div class="grid grid-4">' +
      K.stat(all.length, L('Risiken gesamt', 'Risks total'), 'var(--primary)', all.filter(function (x) { return x.src === 'custom'; }).length + ' ' + L('eigene', 'own') + ' · ' + all.filter(function (x) { return x.src === 'finding'; }).length + ' ' + L('Befunde', 'findings') + ' · ' + all.filter(function (x) { return x.src === 'project'; }).length + ' ' + L('Projekt', 'project')) +
      K.stat((cnt.within || 0) + (cnt.accepted || 0), L('im Appetit / akzeptiert', 'within appetite / accepted'), K.AMP.ok) +
      K.stat((cnt.decision || 0) + (cnt.treating || 0) + (cnt.undoc || 0), L('Entscheidung fehlt / in Behandlung', 'decision missing / in treatment'), K.AMP.warn) +
      K.stat((cnt.intolerable || 0) + (cnt.expired || 0), L('über Toleranz / Akzeptanz abgelaufen', 'above tolerance / acceptance expired'), K.AMP.bad) + '</div>');
    var ap = S().appetite;
    h.push('<div class="grid grid-2"><div class="card"><h2>' + esc(L('Brutto-Risiko (vor Maßnahmen)', 'Gross risk (before measures)')) + '</h2>' + appetiteMatrix(all, false) + '</div>' +
      '<div class="card"><h2>' + esc(L('Netto-Risiko (nach Maßnahmen)', 'Net risk (after measures)')) + '</h2>' + appetiteMatrix(all, true) +
      '<p class="small muted" style="margin-top:.4rem">' + esc(L('Appetit: bis „' + t('risk.cat.' + ap.appetite) + '“ · Toleranz: bis „' + t('risk.cat.' + ap.tolerance) + '“. Projektrisiken (5 × 5) sind nur in der Tabelle enthalten.',
        'Appetite: up to "' + t('risk.cat.' + ap.appetite) + '" · tolerance: up to "' + t('risk.cat.' + ap.tolerance) + '". Project risks (5 × 5) appear in the table only.')) +
      ' <a href="#register" data-act="regTab" data-id="appetite">' + esc(L('Einstellen →', 'Configure →')) + '</a></p></div></div>');
    // Filter
    h.push('<div class="card no-print"><div class="filters">' +
      '<div><label>' + esc(L('Quelle', 'Source')) + '</label><select data-act="regFilter" data-k="src">' + A.opt('', t('c.all'), U.src) + A.opt('custom', L('eigene Risiken', 'own risks'), U.src) + A.opt('finding', L('Befunde (Scans)', 'findings (scans)'), U.src) + A.opt('project', L('Projektrisiken', 'project risks'), U.src) + '</select></div>' +
      '<div><label>' + esc(L('Netto-Kategorie', 'Net category')) + '</label><select data-act="regFilter" data-k="cat">' + A.opt('', t('c.all'), U.cat) + R.CATS.map(function (c) { return A.opt(c, t('risk.cat.' + c), U.cat); }).join('') + '</select></div>' +
      '<div><label>' + esc(L('Appetit-Status', 'Appetite status')) + '</label><select data-act="regFilter" data-k="ap">' + A.opt('', t('c.all'), U.ap) + Object.keys(AP).map(function (k) { return A.opt(k, K.lab(AP[k][1]), U.ap); }).join('') + '</select></div>' +
      '<div style="grid-column:span 2"><label>' + esc(t('c.search')) + '</label><input type="search" data-act="regQ" value="' + esc(U.q) + '" placeholder="RR-001, R-004, P-02 …"></div>' +
      '<div class="checks" style="align-self:end"><label><input type="checkbox" data-act="regFilter" data-k="closed"' + (U.closed ? ' checked' : '') + '> ' + esc(L('geschlossene zeigen', 'show closed')) + '</label></div></div>' +
      '<div class="small muted" style="margin-top:.4rem">' + esc(L(list.length + ' Risiken angezeigt', list.length + ' risks shown')) + '</div></div>');
    if (!list.length) { h.push('<div class="card muted">' + esc(L('Keine Risiken für diese Auswahl. Mit „+ Eigenes Risiko“ können Sie Risiken selbst definieren.', 'No risks for this selection. Use "+ Own risk" to define risks yourself.')) + '</div>'); return h.join(''); }
    var srcName = { custom: L('eigen', 'own'), finding: L('Befund', 'finding'), project: L('Projekt', 'project') };
    var tr = list.map(function (x) {
      var acc = x.acc ? '<div class="small">' + esc(x.acc.by || '') + (x.acc.until ? ' · ' + esc(L('bis', 'until')) + ' ' + K.fmt(x.acc.until) : '') + '</div>' : '';
      var actions = x.src === 'custom'
        ? K.btn('regEdit', '✏️', { id: x.id, cls: 'btn-sm', title: t('btn.edit') }) + ' ' + K.btn('regReview', '🔁', { id: x.id, cls: 'btn-sm', title: L('Review durchgeführt', 'Review done') })
        : K.btn('regOpen', '↗', { id: x.key, cls: 'btn-sm', title: L('In Quelle öffnen', 'Open in source') });
      actions += ' ' + (x.acc ? K.btn('regAccept', '📝', { id: x.key, cls: 'btn-sm', title: L('Akzeptanz ansehen/ändern', 'View/change acceptance') }) : RANK[x.eff] > RANK[S().appetite.appetite] ? K.btn('regAccept', '✔ ' + L('Akzeptieren', 'Accept'), { id: x.key, cls: 'btn-sm' }) : '');
      if (x.src === 'custom') actions += ' ' + K.btn('regDel', '🗑', { id: x.id, cls: 'btn-sm btn-danger', title: t('btn.delete') });
      var next = x.next ? (x.next < K.today() ? '<span style="color:var(--danger)">⚠ ' + K.fmt(x.next) + '</span>' : K.fmt(x.next)) : '–';
      return '<tr><td class="mono nowrap"><b>' + esc(x.id) + '</b><div class="small muted">' + esc(srcName[x.src]) + '</div></td><td><b>' + esc(x.title) + '</b><div class="small muted">' + esc(x.sub) + '</div>' +
        (x.measures ? '<div class="small">🛠 ' + esc(K.clip(x.measures, 140)) + '</div>' : '') + '</td><td class="small">' + esc(x.owner || '–') + '</td>' +
        '<td class="nowrap">' + K.catBadge(x.cat) + (x.suggested ? '<div class="small muted">' + esc(L('Vorschlag', 'suggested')) + '</div>' : '') + '</td><td class="nowrap">' + (x.res ? K.catBadge(x.res) : '<span class="muted">=</span>') + '</td>' +
        '<td class="small">' + (x.treatment ? esc(t('treat.' + x.treatment)) : '–') + '<div class="muted">' + esc(x.statusText) + '</div></td><td>' + apBadge(x.ap) + acc + '</td>' +
        '<td class="small nowrap">' + next + '</td><td class="nowrap">' + actions + '</td></tr>';
    });
    h.push('<div class="card"><h2>' + esc(t('nav.register')) + '</h2>' + K.table(['ID', { l: ['Risiko', 'Risk'], w: 240 }, L('Eigner', 'Owner'), L('Brutto', 'Gross'), L('Netto', 'Net'), L('Behandlung / Status', 'Treatment / status'),
      L('Appetit / Akzeptanz', 'Appetite / acceptance'), L('Nächstes Review', 'Next review'), ''], tr, 'risk-table', '75vh') + '</div>');
    return h.join('');
  }

  /* ---------- eigenes Risiko bearbeiten ---------- */
  function fields() {
    var s = S(), scale = function (pre) { return [1, 2, 3, 4].map(function (n) { return [n, n + ' – ' + t(pre + n)]; }); };
    var empty = function (pre) { return [['', '–']].concat(scale(pre)); };
    return [
      { k: 'title', l: ['Risiko (Kurzbezeichnung)', 'Risk (short title)'], req: true, full: true },
      { k: 'category', l: ['Kategorie', 'Category'], type: 'select', opts: CATEGORIES },
      { k: 'threat', l: ['Gefährdung (BSI G 0.x)', 'Threat (BSI G 0.x)'], list: 'riskThreats' },
      { k: 'cause', l: ['Ursache / Schwachstelle', 'Cause / vulnerability'], type: 'textarea', rows: 2 },
      { k: 'consequence', l: ['Auswirkung / Schadensszenario', 'Consequence / damage scenario'], type: 'textarea', rows: 2 },
      { k: 'assets', l: ['Betroffene Assets', 'Affected assets'], type: 'multi', opts: s.assets.map(function (a) { return [a.id, a.name]; }), full: true },
      { k: 'owner', l: ['Risikoeigner/in', 'Risk owner'], type: 'person' },
      { k: 'status', l: ['Status', 'Status'], type: 'select', opts: STATUS },
      { k: 'p', l: [t('risk.pTitle'), t('risk.pTitle')], type: 'select', opts: scale('risk.p') },
      { k: 'i', l: [t('risk.iTitle'), t('risk.iTitle')], type: 'select', opts: scale('risk.i') },
      { k: 'treatment', l: ['Behandlung', 'Treatment'], type: 'select', opts: [['', '–']].concat(TREAT.map(function (x) { return [x, t('treat.' + x)]; })) },
      { k: 'due', l: ['Termin Maßnahmen', 'Due date (measures)'], type: 'date' },
      { k: 'measures', l: ['Maßnahmen', 'Measures'], type: 'textarea', rows: 2, full: true },
      { k: 'rp', l: ['Netto: Häufigkeit nach Maßnahmen', 'Net: frequency after measures'], type: 'select', opts: empty('risk.p') },
      { k: 'ri', l: ['Netto: Schadenshöhe nach Maßnahmen', 'Net: impact after measures'], type: 'select', opts: empty('risk.i') },
      { k: 'reviewMonths', l: ['Review-Intervall (Monate)', 'Review interval (months)'], type: 'number', min: 1, help: ['leer = gemäß Risikoappetit je Kategorie', 'empty = per risk appetite and category'] },
      { k: 'lastReview', l: ['Letztes Review', 'Last review'], type: 'date' },
      { k: 'html', type: 'html', html: '<h3 style="margin:.4rem 0 0">' + esc(L('Quantitative Schätzung (optional, für Monte-Carlo)', 'Quantitative estimate (optional, for Monte Carlo)')) + '</h3><p class="small muted" style="margin:0">' +
        esc(L('Dreipunktschätzung (min / wahrscheinlich / max). Leer = Werte aus der Kalibrierung der qualitativen Stufen.', 'Three-point estimate (min / most likely / max). Empty = values from the calibration of the qualitative levels.')) + '</p>' },
      { k: 'fMin', l: ['Ereignisse/Jahr – min', 'Events/year – min'], type: 'number', min: 0 },
      { k: 'fMode', l: ['Ereignisse/Jahr – wahrscheinlich', 'Events/year – most likely'], type: 'number', min: 0 },
      { k: 'fMax', l: ['Ereignisse/Jahr – max', 'Events/year – max'], type: 'number', min: 0 },
      { k: 'lMin', l: ['Schaden je Ereignis € – min', 'Loss per event € – min'], type: 'number', min: 0 },
      { k: 'lMode', l: ['Schaden je Ereignis € – wahrscheinlich', 'Loss per event € – most likely'], type: 'number', min: 0 },
      { k: 'lMax', l: ['Schaden je Ereignis € – max', 'Loss per event € – max'], type: 'number', min: 0 },
      { k: 'rf', l: ['Netto: Häufigkeit −% durch Maßnahmen', 'Net: frequency −% by measures'], type: 'number', min: 0, max: 100 },
      { k: 'rl', l: ['Netto: Schaden −% durch Maßnahmen', 'Net: loss −% by measures'], type: 'number', min: 0, max: 100 },
      { k: 'desc', l: ['Beschreibung / Notizen', 'Description / notes'], type: 'textarea', rows: 2, full: true }
    ];
  }
  var QK = ['fMin', 'fMode', 'fMax', 'lMin', 'lMode', 'lMax', 'rf', 'rl'];
  function editRisk(r) {
    var isNew = !r, s = S();
    var obj = r || { title: '', category: 'cyber', threat: '', cause: '', consequence: '', assets: [], owner: s.meta.auditor || '', status: 'open', p: 2, i: 2, treatment: '', due: '', measures: '', rp: '', ri: '', reviewMonths: '', lastReview: '', desc: '', q: {}, reviews: [] };
    var flat = Object.assign({}, obj); QK.forEach(function (k) { flat[k] = (obj.q || {})[k] === undefined ? '' : obj.q[k]; });
    var dl = '<datalist id="riskThreats">' + R.THREATS.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>';
    K.editDialog(isNew ? L('Eigenes Risiko anlegen', 'Add own risk') : L('Risiko bearbeiten', 'Edit risk') + ' ' + obj.id, fields(), flat, function (f) {
      delete f.q; obj.q = {}; QK.forEach(function (k) { obj.q[k] = f[k]; delete f[k]; });
      Object.keys(f).forEach(function (k) { if (k !== 'html') obj[k] = f[k]; });
      obj.p = +obj.p || 1; obj.i = +obj.i || 1; obj.rp = obj.rp ? +obj.rp : ''; obj.ri = obj.ri ? +obj.ri : '';
      if (obj.treatment === 'accept' && obj.status === 'open') obj.status = 'accepted';
      obj.updated = new Date().toISOString();
      if (isNew) { obj.id = K.seq(s.register, 'seq', 'RR-'); obj.created = obj.updated; s.register.items.push(obj); }
    }, null, dl);
  }

  /* ---------- Risikoakzeptanz ---------- */
  function rowByKey(key) { return rows({ closed: true }).find(function (x) { return x.key === key; }); }
  function acceptDialog(key) {
    var s = S(), x = rowByKey(key); if (!x) return;
    var ap = s.appetite, acc = s.acceptances[key], cat = x.eff, over = RANK[cat] > RANK[ap.tolerance];
    var obj = acc ? Object.assign({}, acc) : { by: '', role: ap.authority[cat] || '', date: K.today(), until: K.addMonths(K.today(), ap.maxMonths[cat] || 12), reason: '', conditions: '', exception: false };
    var info = '<div class="note' + (over ? ' warn' : '') + '"><b>' + esc(x.id) + ' – ' + esc(x.title) + '</b><br>' + esc(L('Netto-Kategorie', 'Net category')) + ': ' + K.catBadge(cat) + ' · ' +
      esc(L('erforderliche Befugnis laut Risikoappetit', 'required authority per risk appetite')) + ': <b>' + esc(ap.authority[cat] || '–') + '</b> · ' + esc(L('max. Gültigkeit', 'max. validity')) + ': <b>' + (ap.maxMonths[cat] || '–') + ' ' + esc(L('Monate', 'months')) + '</b>' +
      (over ? '<br>⚠ ' + esc(L('Dieses Risiko liegt über der Risikotoleranz. Eine Akzeptanz ist nur als ausdrückliche Ausnahme der Leitung zulässig.', 'This risk is above the risk tolerance. Acceptance is only allowed as an explicit exception by management.')) : '') + '</div>';
    var fl = [
      { k: 'by', l: ['Akzeptiert durch (Name)', 'Accepted by (name)'], type: 'person', req: true },
      { k: 'role', l: ['Funktion / Befugnis', 'Function / authority'], list: 'dl-roles' },
      { k: 'date', l: ['Datum der Entscheidung', 'Decision date'], type: 'date', req: true },
      { k: 'until', l: ['Gültig bis (Wiedervorlage)', 'Valid until (resubmission)'], type: 'date', req: true },
      { k: 'reason', l: ['Begründung', 'Justification'], type: 'textarea', req: true, full: true, ph: ['Warum ist das Restrisiko tragbar? Kosten/Nutzen, kompensierende Maßnahmen …', 'Why is the residual risk acceptable? Cost/benefit, compensating controls …'] },
      { k: 'conditions', l: ['Auflagen / kompensierende Maßnahmen', 'Conditions / compensating controls'], type: 'textarea', rows: 2, full: true }
    ];
    if (over) fl.push({ k: 'exception', type: 'check', l: ['Ausnahme durch die Leitung ausdrücklich genehmigt', 'Exception explicitly approved by management'], full: true });
    var form = K.editDialog(L('Risikoakzeptanz', 'Risk acceptance'), fl, obj, function (o) {
      if (over && !o.exception) { A.toast(L('Über Toleranz: Ausnahme der Leitung erforderlich.', 'Above tolerance: management exception required.'), true); return; }
      var maxUntil = K.addMonths(o.date, ap.maxMonths[cat] || 12);
      if (o.until > maxUntil) A.toast(L('Hinweis: Gültigkeit überschreitet die Höchstdauer laut Risikoappetit (' + K.fmt(maxUntil) + ').', 'Note: validity exceeds the maximum per risk appetite (' + K.fmt(maxUntil) + ').'), true);
      o.cat = cat; o.updated = new Date().toISOString();
      s.acceptances[key] = o;
      setTreatment(x, 'accept');
    }, L('Akzeptanz speichern', 'Save acceptance'), info);
    if (acc) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-danger'; b.textContent = L('Akzeptanz widerrufen', 'Revoke acceptance');
      b.onclick = function () { delete s.acceptances[key]; if (x.src === 'custom' && x.item.status === 'accepted') x.item.status = 'open'; document.getElementById('dlg').close(); A.save(); A.render(); };
      form.querySelector('.dlg-actions').prepend(b);
    }
  }
  function setTreatment(x, tr) {
    if (x.src === 'custom') { x.item.treatment = tr; if (tr === 'accept') x.item.status = 'accepted'; }
    else if (x.src === 'finding') { var f = x.fr.f; f.risk = f.risk || {}; f.risk.treatment = tr; if (tr === 'accept') { f.status = 'accepted'; f.statusDate = new Date().toISOString(); } }
    else if (x.src === 'project') x.pr.strategy = tr;
  }

  /* ---------- Risikoappetit (Erklärung + Schwellen + Akzeptanzen) ---------- */
  function appetiteView() {
    var s = S(), ap = s.appetite, h = [];
    var catOpts = function (k, v) { return '<select data-act="apSet" data-k="' + k + '">' + R.CATS.map(function (c) { return A.opt(c, t('risk.cat.' + c), v); }).join('') + '</select>'; };
    h.push('<div class="note">' + esc(L('Risikoappetit = Umfang an Risiko, den die Organisation zur Erreichung ihrer Ziele bewusst eingehen will. Risikotoleranz = Obergrenze, bis zu der Abweichungen noch akzeptiert werden dürfen. Risikoakzeptanz = dokumentierte, befristete Entscheidung der befugten Person, ein Restrisiko zu tragen (vgl. ISO/IEC 27001 6.1.3 f, ISO 31000, BSI 200-3).',
      'Risk appetite = amount of risk the organisation is willing to take to achieve its objectives. Risk tolerance = upper limit up to which deviations may still be accepted. Risk acceptance = documented, time-limited decision by the authorised person to bear a residual risk (cf. ISO/IEC 27001 6.1.3 f, ISO 31000, BSI 200-3).')) + '</div>');
    h.push('<div class="card"><h2>' + esc(L('Risikoappetit-Erklärung (Risk Appetite Statement)', 'Risk appetite statement')) + '</h2>' +
      '<textarea data-field="apText" data-k="statement" rows="4" placeholder="' + esc(L('z. B. „Wir gehen keine Risiken ein, die zum Verlust personenbezogener Daten oder zu einem Ausfall zeitkritischer Prozesse über die MTA hinaus führen können. Risiken bis zur Kategorie mittel tragen wir im Rahmen des Regelbetriebs …“',
        'e.g. "We take no risks that could lead to loss of personal data or an outage of time-critical processes beyond the MTPD. Risks up to medium are borne in normal operations …"')) + '">' + esc(ap.statement) + '</textarea>' +
      '<div class="grid grid-4" style="margin-top:.6rem"><div class="field"><label>' + esc(L('Risikoappetit bis', 'Risk appetite up to')) + '</label>' + catOpts('appetite', ap.appetite) + '<div class="small muted">' + esc(L('tragbar ohne gesonderte Entscheidung', 'acceptable without separate decision')) + '</div></div>' +
      '<div class="field"><label>' + esc(L('Risikotoleranz bis', 'Risk tolerance up to')) + '</label>' + catOpts('tolerance', ap.tolerance) + '<div class="small muted">' + esc(L('darüber: Behandlung Pflicht', 'above: treatment mandatory')) + '</div></div>' +
      '<div class="field"><label>' + esc(L('Verlustappetit (€/Jahr, erwartet)', 'Loss appetite (€/year, expected)')) + '</label><input type="number" min="0" data-field="apText" data-k="lossAppetite" value="' + esc(ap.lossAppetite) + '"><div class="small muted">' + esc(L('Vergleich mit Monte-Carlo-Erwartungswert', 'compared with Monte Carlo mean')) + '</div></div>' +
      '<div class="field"><label>' + esc(L('Verlusttoleranz (€/Jahr, P90)', 'Loss tolerance (€/year, P90)')) + '</label><input type="number" min="0" data-field="apText" data-k="lossTolerance" value="' + esc(ap.lossTolerance) + '"><div class="small muted">' + esc(L('Vergleich mit 90-%-Quantil', 'compared with 90th percentile')) + '</div></div>' +
      '<div class="field"><label>' + esc(L('Freigegeben durch', 'Approved by')) + '</label><input type="text" data-field="apText" data-k="approvedBy" data-person="1" value="' + esc(ap.approvedBy) + '"></div>' +
      '<div class="field"><label>' + esc(L('Freigabedatum', 'Approval date')) + '</label><input type="date" data-field="apText" data-k="approvedDate" value="' + esc(ap.approvedDate) + '"></div>' +
      '<div class="field"><label>' + esc(L('Version', 'Version')) + '</label><input type="text" data-field="apText" data-k="version" value="' + esc(ap.version) + '"></div>' +
      '<div class="field"><label>' + esc(L('Nächste Überprüfung', 'Next review')) + '</label><input type="date" data-field="apText" data-k="nextReview" value="' + esc(ap.nextReview) + '"><div class="small muted">' + esc(L('erscheint im Pflichtenkalender', 'appears in the duty calendar')) + '</div></div></div></div>');
    // Befugnisse und Fristen je Kategorie
    h.push('<div class="card"><h2>' + esc(L('Akzeptanzbefugnis, Höchstdauer und Review-Intervall je Kategorie', 'Acceptance authority, maximum duration and review interval per category')) + '</h2>' +
      K.table([L('Kategorie', 'Category'), L('Einordnung', 'Classification'), { l: ['Wer darf akzeptieren?', 'Who may accept?'], w: 220 }, L('max. Gültigkeit (Monate)', 'max. validity (months)'), L('Review-Intervall (Monate)', 'Review interval (months)')],
        R.CATS.map(function (c) {
          var cls = RANK[c] <= RANK[ap.appetite] ? K.amp('ok', L('im Appetit', 'within appetite')) : RANK[c] <= RANK[ap.tolerance] ? K.amp('warn', L('Akzeptanz möglich', 'acceptance possible')) : K.amp('bad', L('nur Ausnahme', 'exception only'));
          return '<tr><td>' + K.catBadge(c) + '</td><td>' + cls + '</td><td><input type="text" list="dl-roles" data-field="apMap" data-g="authority" data-k="' + c + '" value="' + esc(ap.authority[c]) + '"></td>' +
            '<td><input type="number" min="1" data-field="apMap" data-g="maxMonths" data-k="' + c + '" value="' + esc(ap.maxMonths[c]) + '"></td><td><input type="number" min="1" data-field="apMap" data-g="reviewMonths" data-k="' + c + '" value="' + esc(ap.reviewMonths[c]) + '"></td></tr>';
        })) + '</div>');
    // Akzeptanzen
    var all = rows({ closed: true }), today = K.today();
    var accRows = all.filter(function (x) { return x.acc; }).map(function (x) {
      var exp = x.acc.until && x.acc.until < today, soon = !exp && x.acc.until && K.diffDays(today, x.acc.until) <= 30;
      return '<tr><td class="mono"><b>' + esc(x.id) + '</b></td><td>' + esc(x.title) + '<div class="small muted">' + esc(x.sub) + '</div></td><td>' + K.catBadge(x.acc.cat || x.eff) + '</td><td class="small">' + esc(x.acc.by) + '<div class="muted">' + esc(x.acc.role || '') + '</div></td>' +
        '<td class="small">' + K.fmt(x.acc.date) + '</td><td class="small nowrap">' + (exp ? K.amp('bad', K.fmt(x.acc.until)) : soon ? K.amp('warn', K.fmt(x.acc.until)) : K.fmt(x.acc.until)) + '</td><td class="small">' + esc(K.clip(x.acc.reason, 160)) +
        (x.acc.exception ? '<div>' + K.amp('bad', L('Ausnahme Leitung', 'management exception')) + '</div>' : '') + '</td><td>' + K.btn('regAccept', '📝', { id: x.key, cls: 'btn-sm', title: t('btn.edit') }) + '</td></tr>';
    });
    h.push('<div class="card"><h2>' + esc(L('Dokumentierte Risikoakzeptanzen', 'Documented risk acceptances')) + ' <span class="muted small">(' + accRows.length + ')</span></h2>' +
      (accRows.length ? K.table(['ID', { l: ['Risiko', 'Risk'], w: 200 }, L('Kat.', 'Cat.'), L('Akzeptiert durch', 'Accepted by'), L('Datum', 'Date'), L('gültig bis', 'valid until'), { l: ['Begründung', 'Justification'], w: 200 }, ''], accRows)
        : '<p class="muted">' + esc(L('Noch keine Akzeptanzen. Im Register über „✔ Akzeptieren“ erfassen.', 'No acceptances yet. Record them in the register via "✔ Accept".')) + '</p>') + '</div>');
    return h.join('');
  }

  /* ---------- CSV ---------- */
  function csv() {
    var q = function (v) { v = String(v === undefined || v === null ? '' : v); return '"' + v.replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"'; };
    var lines = [['ID', 'Quelle', 'Risiko', 'Bezug', 'Eigner', 'Brutto', 'Netto', 'Behandlung', 'Status', 'Appetit-Status', 'Akzeptiert durch', 'gültig bis', 'Nächstes Review', 'Maßnahmen'].map(q).join(';')];
    rows({ closed: true }).forEach(function (x) {
      lines.push([x.id, x.src, x.title, x.sub, x.owner, t('risk.cat.' + x.cat), x.res ? t('risk.cat.' + x.res) : '', x.treatment ? t('treat.' + x.treatment) : '', x.statusText, K.lab(AP[x.ap][1]),
        x.acc ? x.acc.by : '', x.acc ? x.acc.until : '', x.next, x.measures].map(q).join(';'));
    });
    K.download('risikoregister_' + K.today() + '.csv', '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  }

  /* ------------------------------------------------------------------
   * Registrierung: Ansicht, Ereignisse, Roadmap, Bericht
   * ---------------------------------------------------------------- */
  A.views.register = view;
  A.ext.click.push(function (act, el) {
    var s = S(), id = el.getAttribute('data-id');
    switch (act) {
      case 'regTab': U.tab = id; A.render(); return true;
      case 'regAdd': editRisk(null); return true;
      case 'regEdit': editRisk(s.register.items.find(function (r) { return r.id === id; })); return true;
      case 'regDel': {
        var r = s.register.items.find(function (x) { return x.id === id; });
        A.confirm(L('Risiko ' + r.id + ' „' + r.title + '“ löschen?', 'Delete risk ' + r.id + ' "' + r.title + '"?'), function () {
          s.register.items = s.register.items.filter(function (x) { return x.id !== id; }); delete s.acceptances['R:' + id]; A.save(); A.render(); });
        return true;
      }
      case 'regReview': {
        var rr = s.register.items.find(function (x) { return x.id === id; });
        K.editDialog(L('Review durchgeführt', 'Review done') + ' – ' + rr.id, [
          { k: 'date', l: ['Datum', 'Date'], type: 'date', req: true }, { k: 'by', l: ['Durchgeführt von', 'Performed by'], type: 'person' },
          { k: 'note', l: ['Ergebnis / Änderungen', 'Result / changes'], type: 'textarea', full: true }], { date: K.today(), by: s.meta.auditor || '', note: '' }, function (o) {
          rr.reviews.push({ date: o.date, by: o.by, note: o.note }); rr.lastReview = o.date; });
        return true;
      }
      case 'regAccept': acceptDialog(id); return true;
      case 'regOpen': {
        if (id.indexOf('F:') === 0) { var x = rowByKey(id); A.ui.risk.q = x ? x.id : ''; A.ui.risk.closed = true; A.go('risk'); }
        else if (id.indexOf('P:') === 0) { A.ui.pmTab = 'risks'; A.go('pm'); }
        return true;
      }
      case 'regCsv': csv(); return true;
    }
  });
  A.ext.change.push(function (act, el) {
    var s = S();
    if (act === 'regFilter') { var k = el.getAttribute('data-k'); U[k] = el.type === 'checkbox' ? el.checked : el.value; A.render(); return true; }
    if (act === 'apSet') {
      var ap = s.appetite, k2 = el.getAttribute('data-k'); ap[k2] = el.value;
      if (RANK[ap.tolerance] < RANK[ap.appetite]) { if (k2 === 'appetite') ap.tolerance = ap.appetite; else ap.appetite = ap.tolerance; }
      A.save(); A.render(); return true;
    }
  });
  A.ext.input.push(function (act, el) {
    var s = S();
    if (act === 'regQ') { U.q = el.value; clearTimeout(U._t); U._t = setTimeout(function () { A.render(); var x = document.querySelector('[data-act=regQ]'); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, 350); return true; }
    if (act === 'apText') { var k = el.getAttribute('data-k'); s.appetite[k] = el.type === 'number' ? (el.value === '' ? '' : +el.value) : el.value; A.save(); return true; }
    if (act === 'apMap') { var g = el.getAttribute('data-g'); s.appetite[g][el.getAttribute('data-k')] = el.type === 'number' ? (+el.value || 1) : el.value; A.save(); return true; }
  });
  // Roadmap: eigene Risiken mit Maßnahmen, die nicht akzeptiert/geschlossen sind
  R.roadmapKinds.push('register');
  R.roadmapSources.push(function (state, opts, hp) {
    if (opts.assetId && !opts.includeProject) return [];
    return state.register.items.filter(function (r) { return r.status !== 'closed' && r.status !== 'accepted' && r.treatment !== 'accept' && (r.measures || r.treatment); }).map(function (r) {
      var cat = customCat(r);
      return { kind: 'register', prio: hp.prioFromCat(cat), cat: cat, score: (+r.p || 1) * (+r.i || 1), ref: r.id, title: r.title, asset: r.assets.map(assetName).join(', ') || catLabel(r.category),
        detail: r.treatment ? t('treat.' + r.treatment) : '', action: r.measures || '', owner: r.owner || '', due: r.due || '', status: stLabel(r.status), set: { type: 'register', id: r.id } };
    });
  });
  R.roadmapWriters.register = function (state, set, k, v) { var r = state.register.items.find(function (x) { return x.id === set.id; }); if (r) r[k] = v; };

  // Bericht
  A.ext.reportOpts.push({ key: 'register', label: { de: 'Risikoregister, Appetit & Akzeptanzen', en: 'Risk register, appetite & acceptances' } });
  HA.Report.ext.push({ key: 'register', build: function (state, scope, H) {
    var all = rows({}), ap = state.appetite, h = [];
    h.push('<section class="pb"><h2>' + H.esc(L('Risikoregister', 'Risk register')) + '</h2>');
    h.push('<table class="kv"><tbody><tr><td>' + H.esc(L('Risikoappetit', 'Risk appetite')) + '</td><td>' + H.esc(L('bis', 'up to')) + ' ' + H.esc(t('risk.cat.' + ap.appetite)) + ' · ' + H.esc(L('Toleranz bis', 'tolerance up to')) + ' ' + H.esc(t('risk.cat.' + ap.tolerance)) +
      (ap.lossAppetite !== '' ? ' · ' + H.esc(L('Verlustappetit', 'loss appetite')) + ' ' + K.money(ap.lossAppetite) : '') + (ap.lossTolerance !== '' ? ' · ' + H.esc(L('Verlusttoleranz (P90)', 'loss tolerance (P90)')) + ' ' + K.money(ap.lossTolerance) : '') + '</td></tr>' +
      (ap.statement ? '<tr><td>' + H.esc(L('Erklärung', 'Statement')) + '</td><td>' + H.esc(ap.statement).replace(/\n/g, '<br>') + '</td></tr>' : '') +
      '<tr><td>' + H.esc(L('Freigabe', 'Approval')) + '</td><td>' + H.esc(ap.approvedBy || '–') + ' · ' + H.fmtDate(ap.approvedDate) + ' · Version ' + H.esc(ap.version || '–') + '</td></tr></tbody></table>');
    h.push('<div style="display:grid;grid-template-columns:1fr 1fr;gap:6mm;break-inside:avoid"><div><b>' + H.esc(L('Brutto', 'Gross')) + '</b>' + appetiteMatrix(all, false, 34).replace('font-size:12px', 'font-size:8px') + '</div><div><b>' + H.esc(L('Netto', 'Net')) + '</b>' + appetiteMatrix(all, true, 34).replace('font-size:12px', 'font-size:8px') + '</div></div>');
    if (!all.length) { h.push('<p class="muted">–</p></section>'); return h.join(''); }
    // Befundrisiken stehen bereits im Abschnitt „Risikobewertung“ – hier nur die, die eine Entscheidung brauchen
    var shown = all.filter(function (x) { return x.src !== 'finding' || x.ap !== 'within'; });
    if (shown.length < all.length) h.push('<p class="small muted">' + H.esc(L((all.length - shown.length) + ' Befundrisiken innerhalb des Risikoappetits sind hier ausgeblendet (siehe Abschnitt Risikobewertung).', (all.length - shown.length) + ' finding risks within appetite are hidden here (see risk assessment section).')) + '</p>');
    h.push('<table><thead><tr><th style="width:16mm">ID</th><th>' + H.esc(L('Risiko', 'Risk')) + '</th><th style="width:24mm">' + H.esc(L('Eigner', 'Owner')) + '</th><th style="width:15mm">' + H.esc(L('Brutto', 'Gross')) + '</th><th style="width:15mm">' + H.esc(L('Netto', 'Net')) +
      '</th><th style="width:20mm">' + H.esc(L('Behandlung', 'Treatment')) + '</th><th style="width:26mm">' + H.esc(L('Appetit', 'Appetite')) + '</th></tr></thead><tbody>');
    shown.forEach(function (x) {
      h.push('<tr><td><b>' + H.esc(x.id) + '</b></td><td>' + H.esc(x.title) + '<div class="small muted">' + H.esc(x.sub) + '</div>' + (x.measures ? '<div class="small">' + H.esc(K.clip(x.measures, 200)) + '</div>' : '') + '</td><td class="small">' + H.esc(x.owner || '–') +
        '</td><td>' + R.badge(x.cat, t('risk.cat.' + x.cat)) + '</td><td>' + (x.res ? R.badge(x.res, t('risk.cat.' + x.res)) : '=') + '</td><td class="small">' + H.esc(x.treatment ? t('treat.' + x.treatment) : '–') + '</td><td class="small">' + H.esc(K.lab(AP[x.ap][1])) +
        (x.acc ? '<br>' + H.esc(x.acc.by) + ', ' + H.esc(L('bis', 'until')) + ' ' + H.fmtDate(x.acc.until) : '') + '</td></tr>');
    });
    h.push('</tbody></table>');
    var acc = all.filter(function (x) { return x.acc; });
    if (acc.length) {
      h.push('<h3>' + H.esc(L('Risikoakzeptanzen', 'Risk acceptances')) + '</h3><table><thead><tr><th style="width:16mm">ID</th><th>' + H.esc(L('Begründung / Auflagen', 'Justification / conditions')) + '</th><th style="width:32mm">' + H.esc(L('Akzeptiert durch', 'Accepted by')) + '</th><th style="width:20mm">' + H.esc(L('gültig bis', 'valid until')) + '</th></tr></thead><tbody>');
      acc.forEach(function (x) { h.push('<tr><td><b>' + H.esc(x.id) + '</b></td><td>' + H.esc(x.acc.reason) + (x.acc.conditions ? '<div class="small">' + H.esc(L('Auflagen', 'Conditions')) + ': ' + H.esc(x.acc.conditions) + '</div>' : '') + '</td><td class="small">' + H.esc(x.acc.by) + '<br>' + H.esc(x.acc.role || '') + ', ' + H.fmtDate(x.acc.date) + '</td><td>' + H.fmtDate(x.acc.until) + '</td></tr>'); });
      h.push('</tbody></table>');
    }
    h.push('</section>');
    return h.join('');
  } });

  return { rows: rows, RANK: RANK, AP: AP, apBadge: apBadge, nextReview: nextReview, customCat: customCat, customRes: customRes, catLabel: catLabel, assetName: assetName, U: U };
})();

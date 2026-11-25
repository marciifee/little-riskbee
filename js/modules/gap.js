/* =====================================================================
 * modules/gap.js – Gap-Analyse (Soll-Ist-Vergleich)
 * ---------------------------------------------------------------------
 * Soll: alle anwendbaren Anforderungen je Zielobjekt – wahlweise gemäß
 *   Vorgehensweise/Schutzbedarf des Assets oder einheitlich für Basis-,
 *   Standard- oder Kern-Absicherung (B / B+S / B+S+H).
 * Ist: Status aus der Checkliste (umgesetzt = 1, teilweise = 0,5,
 *   offen/nicht umgesetzt = 0, entbehrlich zählt nicht zum Soll).
 * Auswertungen:
 *   – Erfüllung je Zielobjekt und Anforderungsniveau (B/S/H)
 *   – Abdeckung je Schicht des IT-Grundschutz-Kompendiums
 *   – Modellierungslücken (fehlende Schichten/Kern-Bausteine, Assets
 *     ohne Anforderungen, hoher Schutzbedarf ohne Risikoanalyse)
 *   – Lücken-Matrix Baustein × Zielobjekt
 *   – priorisierte Maßnahmenlücken (CSV-Export), Verlauf (Snapshots)
 * Datenmodell: state.gap = { snaps:[{ date, all, b, s, h, gaps }] }
 * ===================================================================== */
window.HA = window.HA || {};

HA.Gap = (function () {
  'use strict';
  var A = HA.App, K = HA.Kit, L = K.L, esc = A.esc, GS = HA.GS;
  var U = { target: 'asset', kind: '', layer: '', level: '', status: '', asset: '', limit: 200 };
  K.addI18n({ 'nav.gap': 'Gap-Analyse' }, { 'nav.gap': 'Gap analysis' });
  function S() { return A.state(); }
  function tx(o) { return GS.L(o); }
  var TARGETS = [['asset', ['Gemäß Asset', 'Per asset'], ['Vorgehensweise und Schutzbedarf je Asset', 'Approach and protection needs per asset']],
    ['basis', ['Basis', 'Basic'], ['Nur Basis-Anforderungen (B)', 'Basic requirements only (B)']],
    ['standard', ['Standard', 'Standard'], ['Basis- und Standard-Anforderungen (B+S)', 'Basic and standard requirements (B+S)']],
    ['kern', ['Standard + H', 'Standard + H'], ['Inklusive Anforderungen bei erhöhtem Schutzbedarf (B+S+H)', 'Including requirements for elevated protection needs (B+S+H)']]];
  /* Kern-Bausteine, die in nahezu jedem Informationsverbund modelliert werden sollten */
  var CORE = ['ISMS.1', 'ORP.1', 'ORP.2', 'ORP.3', 'ORP.4', 'CON.3', 'OPS.1.1.3', 'OPS.1.1.4', 'OPS.1.1.5', 'DER.2.1', 'DER.4'];

  A.ext.normalize.push(function (s) { s.gap = s.gap || {}; if (!Array.isArray(s.gap.snaps)) s.gap.snaps = []; });

  function levelsFor(asset, target) {
    target = target || U.target;
    if (target === 'basis') return ['B'];
    if (target === 'standard') return ['B', 'S'];
    if (target === 'kern') return ['B', 'S', 'H'];
    return A.allowedLevels(asset);
  }
  var W = { done: 1, partial: 0.5, open: 0, notdone: 0 };
  function acc() { return { soll: 0, ist: 0, gaps: 0, na: 0, n: 0 }; }
  function add(o, st) { o.n++; if (st === 'na') { o.na++; return; } o.soll++; o.ist += W[st] || 0; if (st !== 'done') o.gaps++; }
  function pct(o) { return o && o.soll ? Math.round(o.ist / o.soll * 1000) / 10 : null; }

  /** Zentrale Berechnung. */
  function analyse(target) {
    var s = S(), res = { assets: [], total: acc(), lv: { B: acc(), S: acc(), H: acc() }, layers: {}, matrix: {}, rows: [], gaps: [] };
    GS.LAYERS.forEach(function (l) { res.layers[l.id] = { st: acc(), mods: {}, assets: {} }; });
    s.assets.forEach(function (a) {
      var lv = levelsFor(a, target), items = A.applicableItems(a, true).filter(function (it) { return lv.indexOf(it.level || 'S') >= 0; });
      var r = { asset: a, st: acc(), lv: { B: acc(), S: acc(), H: acc() }, items: items.length };
      items.forEach(function (it) {
        var c = A.getCheck(a, it), st = c.status || 'open', lvl = it.level || 'S', bs = A.bausteinOf(it);
        add(r.st, st); add(r.lv[lvl] || r.lv.S, st); add(res.total, st); add(res.lv[lvl] || res.lv.S, st);
        var row = bs || ('~' + A.getLib(it.lib).short);
        res.matrix[row] = res.matrix[row] || {}; res.matrix[row][a.id] = res.matrix[row][a.id] || acc(); add(res.matrix[row][a.id], st);
        if (bs) { var ly = res.layers[GS.layerOf(bs)]; if (ly) { add(ly.st, st); ly.assets[a.id] = 1; ly.mods[bs] = 1; } }
        if (st !== 'done' && st !== 'na') res.gaps.push(gapRow(a, it, c, st, bs));
      });
      (a.modules || []).forEach(function (m) { var ly = res.layers[GS.layerOf(m)]; if (ly) { ly.mods[m] = 1; ly.assets[a.id] = 1; } });
      res.assets.push(r);
    });
    res.gaps.sort(function (x, y) { return x.prio - y.prio || (x.overdue === y.overdue ? 0 : x.overdue ? -1 : 1) || x.asset.name.localeCompare(y.asset.name) || x.ref.localeCompare(y.ref); });
    res.model = modelGaps(s, res);
    return res;
  }
  /** Priorität: B = P1, S = P2, H = P3; bei hohem Schutzbedarf eine Stufe höher; „nicht umgesetzt“ vor „offen“. */
  function gapRow(a, it, c, st, bs) {
    var lvl = it.level || 'S', p = lvl === 'B' ? 1 : lvl === 'S' ? 2 : 3;
    if (A.overallProtection(a) !== 'normal' && p > 1) p--;
    var due = c.due || '', overdue = !!(due && due < K.today());
    return { asset: a, it: it, ref: it.ref, title: tx(it.title) || HA.tx(it.title), level: lvl, status: st, bs: bs, group: bs ? bs + ' ' + GS.title(bs) : A.groupLabel(it), prio: p,
      responsible: c.responsible || '', due: due, overdue: overdue, virtual: it.lib === 'gsmod' };
  }
  /** Modellierungslücken: Was fehlt im Soll selbst? */
  function modelGaps(s, res) {
    var out = [], all = {}, usesMods = s.assets.some(function (a) { return (a.modules || []).length; });
    s.assets.forEach(function (a) { (a.modules || []).forEach(function (m) { all[m] = 1; }); });
    if (!s.assets.length) return out;
    if (!s.assets.some(function (a) { return A.assetKind(a) === 'org'; })) out.push({ sev: 'bad', kind: 'org', text: L('Kein Zielobjekt „Informationsverbund & Prozesse“ – die Prozess-Bausteine (ISMS, ORP, CON, OPS, DER) sind nicht modelliert.', 'No target object "Information domain & processes" – process modules (ISMS, ORP, CON, OPS, DER) are not modelled.'), act: 'newOrg' });
    var miss = CORE.filter(function (m) { return !all[m]; });
    if (miss.length && (usesMods || s.assets.some(function (a) { return A.assetKind(a) === 'org'; }))) out.push({ sev: miss.indexOf('ISMS.1') >= 0 ? 'bad' : 'warn', text: L('Kern-Bausteine nicht modelliert: ', 'Core modules not modelled: ') + miss.map(function (m) { return m + ' ' + GS.title(m); }).join(', '), mods: miss });
    GS.LAYERS.forEach(function (l) {
      if (l.type !== 'system' || l.id === 'SYS' || l.id === 'IND') return;
      if (!res.layers[l.id] || !Object.keys(res.layers[l.id].mods).length) out.push({ sev: 'warn', kind: l.kind, text: L('Schicht ' + l.id + ' (' + l.de + ') ohne modellierten Baustein – Zielobjekte vom Typ „' + GS.kind(l.kind).de + '“ erfassen oder Entbehrlichkeit begründen.', 'Layer ' + l.id + ' (' + l.en + ') without modelled module – record target objects of type "' + GS.kind(l.kind).en + '" or justify why not needed.'), act: 'newKind' });
    });
    res.assets.forEach(function (r) {
      if (!r.items) out.push({ sev: 'warn', asset: r.asset, text: L('„' + r.asset.name + '“: keine Anforderungen im Soll (keine Bibliothek/kein Baustein modelliert).', '"' + r.asset.name + '": no requirements in target (no library/module modelled).'), act: 'edit' });
      var reg = (s.register && s.register.items) || [];
      if (A.overallProtection(r.asset) !== 'normal' && !reg.some(function (x) { return (x.assets || []).indexOf(r.asset.id) >= 0; }))
        out.push({ sev: 'warn', asset: r.asset, text: L('„' + r.asset.name + '“: hoher Schutzbedarf, aber keine Risikoanalyse (BSI 200-3) im Risikoregister verknüpft.', '"' + r.asset.name + '": high protection needs but no risk analysis (BSI 200-3) linked in the risk register.'), act: 'register' });
    });
    return out;
  }

  /* ------------------------------------------------------------------
   * Darstellung
   * ---------------------------------------------------------------- */
  function heat(p) {
    if (p === null) return 'var(--surface-2)';
    var h = Math.round(Math.max(0, Math.min(100, p)) * 1.2);   // 0 = rot, 120 = grün
    return 'hsl(' + h + ',62%,' + (p >= 100 ? 36 : 44) + '%)';
  }
  function pctTxt(p) { return p === null ? '–' : K.num(p, 0) + ' %'; }
  function bar(p, w) { return '<div class="gap-bar" style="min-width:' + (w || 90) + 'px"><span style="width:' + (p || 0) + '%;background:' + heat(p) + '"></span></div>'; }
  function cell(o) { var p = pct(o); return o && o.soll ? '<td class="gap-cell" style="background:' + heat(p) + '" title="' + esc(K.num(o.ist, 1) + ' / ' + o.soll + ' · ' + o.gaps + ' ' + L('Lücken', 'gaps')) + '">' + K.num(p, 0) + '</td>' : '<td class="gap-cell na">·</td>'; }

  function view() {
    var s = S(), res = analyse();
    var tgt = TARGETS.find(function (x) { return x[0] === U.target; });
    var h = [K.pageHead(L('Gap-Analyse', 'Gap analysis'), L('Soll-Ist-Vergleich über alle Zielobjekte: Welche Anforderungen gelten (Soll) und wie weit sind sie umgesetzt (Ist)? Lücken werden nach Anforderungsniveau und Schutzbedarf priorisiert; Modellierungslücken zeigen, was im Soll selbst noch fehlt.',
      'Target/actual comparison across all target objects: which requirements apply (target) and how far are they implemented (actual)? Gaps are prioritised by requirement level and protection needs; modelling gaps show what is still missing in the target itself.'),
      K.btn('gapSnap', '📌 ' + L('Snapshot speichern', 'Save snapshot'), { title: L('Aktuellen Stand für den Verlauf festhalten', 'Record current state for the history') }) + K.btn('gapCsv', '⬇ CSV'))];
    if (!s.assets.length) { h.push('<div class="card muted">' + esc(t0('dash.noAssets')) + ' <button class="btn btn-primary" data-act="newAsset">' + esc(t0('btn.newAsset')) + '</button></div>'); return h.join(''); }
    h.push('<div class="card no-print"><div class="row"><div><label>' + esc(L('Soll-Niveau', 'Target level')) + '</label><div class="seg">' + TARGETS.map(function (x) {
      return '<button type="button" class="' + (U.target === x[0] ? 'on' : '') + '" data-act="gapTarget" data-id="' + x[0] + '" title="' + esc(K.lab(x[2])) + '">' + esc(K.lab(x[1])) + '</button>'; }).join('') + '</div></div>' +
      '<span class="small muted" style="align-self:flex-end">' + esc(K.lab(tgt[2])) + '</span></div></div>');
    var openGaps = res.gaps.length, bad = res.model.filter(function (x) { return x.sev === 'bad'; }).length;
    h.push('<div class="grid grid-4">' + K.stat(pctTxt(pct(res.total)), L('Gesamterfüllung (Soll ' + res.total.soll + ')', 'Overall fulfilment (target ' + res.total.soll + ')'), heat(pct(res.total))) +
      K.stat(pctTxt(pct(res.lv.B)), L('Basis-Anforderungen (B)', 'Basic requirements (B)'), heat(pct(res.lv.B)), esc(res.lv.B.gaps + ' ' + L('Lücken', 'gaps'))) +
      K.stat(pctTxt(pct(res.lv.S)), L('Standard-Anforderungen (S)', 'Standard requirements (S)'), heat(pct(res.lv.S)), esc(res.lv.S.gaps + ' ' + L('Lücken', 'gaps')) + (res.lv.H.soll ? ' · H: ' + pctTxt(pct(res.lv.H)) : '')) +
      K.stat(openGaps, L('offene Maßnahmenlücken', 'open measure gaps'), openGaps ? K.AMP.bad : K.AMP.ok, esc(res.model.length + ' ' + L('Modellierungslücken', 'modelling gaps')) + (bad ? ' (' + bad + ' ' + L('kritisch', 'critical') + ')' : '')) + '</div>');

    // Soll-Ist je Zielobjekt
    var rows = [];
    A.kindGroups().forEach(function (g) {
      rows.push('<tr class="grp-row"><th colspan="9">' + esc(g.kind.icon + ' ' + tx(g.kind)) + '</th></tr>');
      g.assets.forEach(function (a) {
        var r = res.assets.find(function (x) { return x.asset === a; }), p = pct(r.st);
        rows.push('<tr><td><a href="#checklist" data-act="openAsset" data-id="' + a.id + '"><b>' + esc(a.name) + '</b></a><div class="small muted">' + esc(levelsFor(a).join('+')) + ' · ' + esc(K.lab(['Schutzbedarf ', 'protection '])) + esc(HA.t('prot.' + A.overallProtection(a))) + '</div></td>' +
          '<td class="num">' + r.st.soll + '</td><td class="num">' + K.num(r.st.ist, 1) + '</td><td>' + bar(p, 110) + '<div class="small"><b>' + pctTxt(p) + '</b></div></td>' +
          ['B', 'S', 'H'].map(function (l) { var x = r.lv[l]; return '<td class="num small">' + (x.soll ? '<span style="color:' + heat(pct(x)) + ';font-weight:700">' + pctTxt(pct(x)) + '</span><div class="muted">' + x.gaps + '</div>' : '<span class="muted">–</span>') + '</td>'; }).join('') +
          '<td class="num"><b>' + r.st.gaps + '</b></td><td class="num muted">' + r.st.na + '</td></tr>');
      });
    });
    h.push('<div class="card"><h2>' + esc(L('Soll-Ist je Zielobjekt', 'Target/actual per target object')) + '</h2>' +
      K.table([{ l: ['Zielobjekt', 'Target object'], w: 180 }, { l: ['Soll', 'Target'], cls: 'num' }, { l: ['Ist', 'Actual'], cls: 'num' }, { l: ['Erfüllung', 'Fulfilment'], w: 120 }, { l: ['B', 'B'], cls: 'num' }, { l: ['S', 'S'], cls: 'num' }, { l: ['H', 'H'], cls: 'num' }, { l: ['Lücken', 'Gaps'], cls: 'num' }, { l: ['entbehrlich', 'n/a'], cls: 'num' }], rows) +
      '<p class="small muted">' + esc(L('Ist = umgesetzt (1) + teilweise (0,5). B/S/H: Erfüllung und Anzahl Lücken je Anforderungsniveau. Entbehrliche Anforderungen zählen nicht zum Soll (Begründung erforderlich).', 'Actual = implemented (1) + partial (0.5). B/S/H: fulfilment and number of gaps per requirement level. Not-applicable requirements do not count towards the target (justification required).')) + '</p></div>');

    // Abdeckung je Schicht + Modellierungslücken
    h.push('<div class="grid grid-2"><div class="card"><h2>' + esc(L('Abdeckung des Schichtenmodells', 'Layer model coverage')) + '</h2>' +
      K.table([{ l: ['Schicht', 'Layer'], w: 150 }, { l: ['Bausteine modelliert', 'Modules modelled'] }, { l: ['Zielobjekte', 'Objects'], cls: 'num' }, { l: ['Erfüllung', 'Fulfilment'], w: 110 }], GS.LAYERS.map(function (l) {
        var ly = res.layers[l.id], nm = Object.keys(ly.mods).length, tot = GS.BAUSTEINE.filter(function (b) { return b.layer === l.id; }).length, p = pct(ly.st);
        return '<tr><td><b>' + l.id + '</b> <span class="small">' + esc(tx(l)) + '</span></td><td class="small">' + nm + ' / ' + tot + (nm || l.id === 'IND' ? '' : ' ' + K.amp('warn', L('keine', 'none'))) + '</td><td class="num">' + Object.keys(ly.assets).length + '</td><td>' + (ly.st.soll ? bar(p) + '<span class="small">' + pctTxt(p) + '</span>' : '<span class="muted small">–</span>') + '</td></tr>';
      })) + '</div>' +
      '<div class="card"><h2>' + esc(L('Modellierungslücken', 'Modelling gaps')) + ' <span class="badge st-open">' + res.model.length + '</span></h2>' +
      (res.model.length ? '<ul class="gap-model">' + res.model.map(function (m, i) {
        var btn = m.act === 'newOrg' ? K.btn('newAsset', '+ ' + L('Informationsverbund anlegen', 'Create information domain'), { cls: 'btn-sm' }).replace('data-act="newAsset"', 'data-act="newAsset" data-kind="org"')
          : m.act === 'newKind' ? K.btn('newAsset', '+ ' + L('Zielobjekt anlegen', 'Create target object'), { cls: 'btn-sm' }).replace('data-act="newAsset"', 'data-act="newAsset" data-kind="' + m.kind + '"')
          : m.act === 'edit' ? K.btn('editAsset', L('Bearbeiten', 'Edit'), { id: m.asset.id, cls: 'btn-sm' })
          : m.act === 'register' ? '<a class="btn btn-sm" href="#register">' + esc(L('Risikoregister', 'Risk register')) + ' →</a>'
          : m.mods ? K.btn('gapModelCore', L('Auf Informationsverbund modellieren', 'Model on information domain'), { id: String(i), cls: 'btn-sm' }) : '';
        return '<li class="gap-' + m.sev + '"><span>' + esc(m.text) + '</span>' + btn + '</li>'; }).join('') + '</ul>' : '<p class="muted">✓ ' + esc(L('Keine Modellierungslücken erkannt.', 'No modelling gaps detected.')) + '</p>') + '</div></div>');

    // Lücken-Matrix
    h.push(matrixHtml(res));
    // Priorisierte Maßnahmenlücken
    h.push(gapListHtml(res));
    // Verlauf
    h.push(historyHtml());
    return h.join('');
  }
  function t0(k) { return HA.t(k); }

  function matrixHtml(res) {
    var groups = A.kindGroups().filter(function (g) { return !U.kind || g.kind.id === U.kind; });
    var assets = []; groups.forEach(function (g) { assets = assets.concat(g.assets); });
    var keys = Object.keys(res.matrix).filter(function (k) { return !U.layer || (k.charAt(0) !== '~' && GS.layerOf(k) === U.layer) || (U.layer === '~' && k.charAt(0) === '~'); })
      .filter(function (k) { return assets.some(function (a) { return res.matrix[k][a.id]; }); })
      .sort(function (x, y) { var a = x.charAt(0) === '~', b = y.charAt(0) === '~'; if (a !== b) return a ? 1 : -1; return a ? x.localeCompare(y) : GS.index(x) - GS.index(y) || x.localeCompare(y); });
    var h = ['<div class="card"><div class="row"><h2 style="margin:0">' + esc(L('Lücken-Matrix: Baustein × Zielobjekt', 'Gap matrix: module × target object')) + '</h2><span class="spacer"></span>' +
      '<select class="gap-sel" data-act="gapF" data-k="kind" aria-label="Typ">' + A.opt('', L('Alle Typen', 'All types'), U.kind) + GS.KINDS.map(function (k) { return A.opt(k.id, k.icon + ' ' + tx(k), U.kind); }).join('') + '</select>' +
      '<select class="gap-sel" data-act="gapF" data-k="layer" aria-label="Schicht">' + A.opt('', L('Alle Schichten', 'All layers'), U.layer) + GS.LAYERS.map(function (l) { return A.opt(l.id, l.id + ' – ' + tx(l), U.layer); }).join('') + A.opt('~', L('Sonstige Bibliotheken', 'Other libraries'), U.layer) + '</select></div>'];
    if (!keys.length || !assets.length) { h.push('<p class="muted">–</p></div>'); return h.join(''); }
    h.push('<div class="table-wrap gap-matrix" style="max-height:560px"><table><thead><tr><th>' + esc(L('Baustein / Bibliothek', 'Module / library')) + '</th>' + assets.map(function (a) { return '<th class="gap-colh" title="' + esc(a.name) + '"><span>' + esc(K.clip(a.name, 18)) + '</span></th>'; }).join('') + '</tr></thead><tbody>');
    var lastLayer = '';
    keys.forEach(function (k) {
      var other = k.charAt(0) === '~', ly = other ? '~' : GS.layerOf(k);
      if (ly !== lastLayer) { lastLayer = ly; h.push('<tr class="grp-row"><th colspan="' + (assets.length + 1) + '">' + esc(other ? L('Sonstige Bibliotheken (Härtung)', 'Other libraries (hardening)') : ly + ' – ' + tx(GS.layer(ly) || { de: '' })) + '</th></tr>'); }
      h.push('<tr><td class="small nowrap"><b class="mono">' + esc(other ? k.slice(1) : k) + '</b> ' + (other ? '' : '<span class="muted">' + esc(K.clip(GS.title(k), 34)) + '</span>') + '</td>' + assets.map(function (a) { return cell(res.matrix[k][a.id]); }).join('') + '</tr>');
    });
    h.push('</tbody></table></div><div class="legend small"><span><i style="background:' + heat(0) + '"></i>0 %</span><span><i style="background:' + heat(50) + '"></i>50 %</span><span><i style="background:' + heat(80) + '"></i>80 %</span><span><i style="background:' + heat(100) + '"></i>100 %</span><span class="muted">· = ' + esc(L('nicht modelliert / kein Soll', 'not modelled / no target')) + '</span></div></div>');
    return h.join('');
  }

  function filteredGaps(res) {
    return res.gaps.filter(function (g) {
      if (U.kind && A.assetKind(g.asset) !== U.kind) return false;
      if (U.layer && (U.layer === '~' ? g.bs : GS.layerOf(g.bs) !== U.layer)) return false;
      if (U.level && g.level !== U.level) return false;
      if (U.status && g.status !== U.status) return false;
      if (U.asset && g.asset.id !== U.asset) return false;
      return true;
    });
  }
  function gapListHtml(res) {
    var list = filteredGaps(res), shown = list.slice(0, U.limit);
    var P = { 1: ['P1', K.AMP.bad], 2: ['P2', K.AMP.warn], 3: ['P3', K.AMP.none] };
    var h = ['<div class="card"><div class="row"><h2 style="margin:0">' + esc(L('Maßnahmenlücken (priorisiert)', 'Measure gaps (prioritised)')) + ' <span class="badge st-open">' + list.length + '</span></h2><span class="spacer"></span>'];
    h[0] += '<select class="gap-sel" data-act="gapF" data-k="asset" aria-label="Asset">' + A.opt('', L('Alle Zielobjekte', 'All target objects'), U.asset) + S().assets.map(function (a) { return A.opt(a.id, a.name, U.asset); }).join('') + '</select>' +
      '<select class="gap-sel" data-act="gapF" data-k="level" aria-label="Niveau">' + A.opt('', L('Alle Niveaus', 'All levels'), U.level) + ['B', 'S', 'H'].map(function (x) { return A.opt(x, x + ' – ' + HA.t('level.' + x), U.level); }).join('') + '</select>' +
      '<select class="gap-sel" data-act="gapF" data-k="status" aria-label="Status">' + A.opt('', L('Alle Status', 'All statuses'), U.status) + ['open', 'partial', 'notdone'].map(function (x) { return A.opt(x, HA.t('status.' + x), U.status); }).join('') + '</select></div>';
    if (!list.length) { h.push('<p class="muted">✓ ' + esc(L('Keine offenen Lücken für die gewählten Filter.', 'No open gaps for the selected filters.')) + '</p></div>'); return h.join(''); }
    h.push(K.table(['Prio', { l: ['Zielobjekt', 'Target object'], w: 120 }, { l: ['Baustein / Gruppe', 'Module / group'], w: 150 }, { l: ['Anforderung', 'Requirement'], w: 240 }, { l: ['Niveau', 'Level'] }, 'Status', { l: ['Verantwortlich', 'Responsible'] }, { l: ['Fällig', 'Due'] }],
      shown.map(function (g) {
        return '<tr><td>' + K.pill(P[g.prio][0], P[g.prio][1], g.prio === 2 ? '#1b2430' : '#fff') + '</td><td class="small">' + esc(g.asset.name) + '</td><td class="small">' + esc(K.clip(g.group, 48)) + '</td>' +
          '<td><a href="#checklist" data-act="gapGo" data-id="' + g.asset.id + '" data-k="' + esc(g.ref) + '"><code>' + esc(g.ref) + '</code></a> ' + esc(g.title) + (g.virtual ? ' <span class="small muted">(' + esc(L('Gesamtbewertung', 'overall')) + ')</span>' : '') + '</td>' +
          '<td><span class="badge lvl-' + esc(g.level) + '">' + esc(g.level) + '</span></td><td><span class="badge st-' + g.status + '">' + esc(HA.t('status.' + g.status)) + '</span></td><td class="small">' + esc(g.responsible || '–') + '</td>' +
          '<td class="small nowrap"' + (g.overdue ? ' style="color:var(--danger);font-weight:700"' : '') + '>' + (g.due ? K.fmt(g.due) + (g.overdue ? ' ⚠' : '') : '–') + '</td></tr>';
      }), '', '520px'));
    if (list.length > shown.length) h.push('<div class="row" style="margin-top:.4rem"><span class="small muted">' + esc(L(shown.length + ' von ' + list.length + ' angezeigt', shown.length + ' of ' + list.length + ' shown')) + '</span>' + K.btn('gapMore', L('Alle anzeigen', 'Show all'), { cls: 'btn-sm' }) + '</div>');
    h.push('<p class="small muted">' + esc(L('Priorität: Basis-Anforderungen P1, Standard P2, erhöhter Schutzbedarf P3 – bei hohem Schutzbedarf des Zielobjekts eine Stufe höher. Überfällige Termine zuerst innerhalb der Stufe.', 'Priority: basic requirements P1, standard P2, elevated P3 – one level higher if the target object has high protection needs. Overdue items first within each level.')) + '</p></div>');
    return h.join('');
  }

  function historyHtml() {
    var sn = S().gap.snaps; if (!sn.length) return '';
    var w = 520, hgt = 120, pad = 24, n = sn.length;
    var x = function (i) { return pad + (n === 1 ? (w - 2 * pad) / 2 : i * (w - 2 * pad) / (n - 1)); }, y = function (v) { return hgt - pad - (v || 0) / 100 * (hgt - 2 * pad); };
    var line = function (k, col) { return '<polyline fill="none" stroke="' + col + '" stroke-width="2" points="' + sn.map(function (s, i) { return x(i) + ',' + y(s[k]); }).join(' ') + '"/>' + sn.map(function (s, i) { return '<circle cx="' + x(i) + '" cy="' + y(s[k]) + '" r="3" fill="' + col + '"><title>' + esc(s.date + ': ' + K.num(s[k] || 0, 0) + ' %') + '</title></circle>'; }).join(''); };
    return '<div class="card"><h2>' + esc(L('Verlauf (Snapshots)', 'History (snapshots)')) + '</h2><div class="row" style="align-items:flex-start"><svg viewBox="0 0 ' + w + ' ' + hgt + '" style="max-width:' + w + 'px;width:100%" role="img" aria-label="' + esc(L('Verlauf der Erfüllung', 'Fulfilment history')) + '">' +
      [0, 50, 100].map(function (v) { return '<line x1="' + pad + '" x2="' + (w - pad) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="var(--border)" stroke-dasharray="3 3"/><text x="2" y="' + (y(v) + 4) + '" font-size="9" fill="var(--text-muted)">' + v + '</text>'; }).join('') +
      line('all', '#1f6feb') + line('b', '#c62828') + line('s', '#d48806') + '</svg><div class="legend small"><span><i style="background:#1f6feb"></i>' + esc(L('Gesamt', 'Overall')) + '</span><span><i style="background:#c62828"></i>B</span><span><i style="background:#d48806"></i>S</span></div></div>' +
      K.table([{ l: ['Datum', 'Date'] }, { l: ['Soll-Niveau', 'Target'] }, { l: ['Gesamt', 'Overall'], cls: 'num' }, { l: ['B', 'B'], cls: 'num' }, { l: ['S', 'S'], cls: 'num' }, { l: ['H', 'H'], cls: 'num' }, { l: ['Lücken', 'Gaps'], cls: 'num' }, ''],
        sn.slice().reverse().map(function (s) { var i = sn.indexOf(s); return '<tr><td>' + K.fmt(s.date) + '</td><td class="small">' + esc(K.lab((TARGETS.find(function (x) { return x[0] === s.target; }) || TARGETS[0])[1])) + '</td><td class="num">' + pctTxt(s.all) + '</td><td class="num">' + pctTxt(s.b) + '</td><td class="num">' + pctTxt(s.s) + '</td><td class="num">' + pctTxt(s.h) + '</td><td class="num">' + s.gaps + '</td><td>' + K.btn('gapSnapDel', '🗑', { id: String(i), cls: 'btn-sm btn-danger', title: HA.t('btn.delete') }) + '</td></tr>'; }), '', '260px') + '</div>';
  }

  function csv(res) {
    var q = function (v) { v = String(v === null || v === undefined ? '' : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var head = ['Prio', L('Zielobjekt', 'Target object'), L('Typ', 'Type'), L('Baustein/Gruppe', 'Module/group'), 'ID', L('Anforderung', 'Requirement'), L('Niveau', 'Level'), 'Status', L('Verantwortlich', 'Responsible'), L('Fällig', 'Due')];
    return '﻿' + [head.join(';')].concat(filteredGaps(res).map(function (g) {
      return ['P' + g.prio, g.asset.name, tx(GS.kind(A.assetKind(g.asset))), g.group, g.ref, g.title, g.level, HA.t('status.' + g.status), g.responsible, g.due].map(q).join(';');
    })).join('\r\n');
  }

  A.views.gap = view;
  A.ext.click.push(function (act, el) {
    var id = el.getAttribute('data-id');
    switch (act) {
      case 'gapTarget': U.target = id; A.render(); return true;
      case 'gapMore': U.limit = 100000; A.render(); return true;
      case 'gapCsv': K.download('gap-analyse_' + K.today() + '.csv', csv(analyse()), 'text/csv;charset=utf-8'); return true;
      case 'gapGo': { var ui = A.ui; ui.assetId = id; ui.cl = { q: el.getAttribute('data-k'), lib: '', topic: '', level: '', status: '', groupBy: 'group' }; A.go('checklist'); return true; }
      case 'gapSnap': {
        var r = analyse(), s = S();
        s.gap.snaps.push({ date: K.today(), target: U.target, all: pct(r.total), b: pct(r.lv.B), s: pct(r.lv.S), h: pct(r.lv.H), gaps: r.gaps.length });
        if (s.gap.snaps.length > 60) s.gap.snaps.shift();
        A.save(); A.render(); A.toast(L('Snapshot gespeichert', 'Snapshot saved')); return true;
      }
      case 'gapSnapDel': S().gap.snaps.splice(+id, 1); A.save(); A.render(); return true;
      case 'gapModelCore': {
        var res = analyse(), m = res.model[+id], s2 = S(), org = s2.assets.filter(function (a) { return A.assetKind(a) === 'org'; });
        if (!org.length) { A.editAsset(null, 'org', HA.GS.defaults('org').concat(m.mods.filter(function (x) { return HA.GS.defaults('org').indexOf(x) < 0; }))); return true; }
        m.mods.forEach(function (x) { if (org[0].modules.indexOf(x) < 0) org[0].modules.push(x); });
        A.invalidate(); A.save(); A.render(); A.toast(L('Auf „' + org[0].name + '“ modelliert: ', 'Modelled on "' + org[0].name + '": ') + m.mods.join(', ')); return true;
      }
    }
  });
  A.ext.change.push(function (act, el) { if (act === 'gapF') { U[el.getAttribute('data-k')] = el.value; U.limit = 200; A.render(); return true; } });

  /* Kennzahl für das KPI-Dashboard */
  if (HA.KPI) HA.KPI.DEFS.push({ id: 'gapBasis', g: 'hard', u: '%', dir: 'up', t: 100, w: 80, go: 'gap', n: ['Erfüllung Basis-Anforderungen (Gap-Analyse)', 'Basic requirements fulfilment (gap analysis)'],
    calc: function () { var r = analyse('basis'); return { v: pct(r.lv.B), d: r.lv.B.gaps + ' ' + L('Lücken', 'gaps'), gap: L('Keine Basis-Anforderungen im Soll', 'No basic requirements in target') }; } });

  /* Abschnitt im Hauptbericht */
  A.ext.reportOpts.push({ key: 'gap', label: { de: 'Gap-Analyse (Soll-Ist)', en: 'Gap analysis (target/actual)' } });
  HA.Report.ext.push({ key: 'gap', build: function (state, scope, H) {
    if (!state.assets.length) return '';
    var res = analyse(), list = res.gaps.filter(function (g) { return !scope.scopeAsset || g.asset.id === scope.scopeAsset; });
    var h = ['<section class="pb"><h2>' + H.esc(L('Gap-Analyse (Soll-Ist-Vergleich)', 'Gap analysis (target/actual)')) + '</h2>' +
      '<p class="small">' + H.esc(L('Soll-Niveau: ', 'Target level: ') + K.lab((TARGETS.find(function (x) { return x[0] === U.target; }) || TARGETS[0])[2]) + ' · ' + L('Gesamterfüllung ', 'overall fulfilment ') + pctTxt(pct(res.total)) + ' · B ' + pctTxt(pct(res.lv.B)) + ' · S ' + pctTxt(pct(res.lv.S)) + (res.lv.H.soll ? ' · H ' + pctTxt(pct(res.lv.H)) : '') + ' · ' + res.gaps.length + ' ' + L('offene Lücken', 'open gaps')) + '</p>'];
    h.push('<table><thead><tr><th>' + H.esc(L('Zielobjekt', 'Target object')) + '</th><th>' + H.esc(L('Typ', 'Type')) + '</th><th style="width:14mm">Soll</th><th style="width:16mm">' + H.esc(L('Erfüllung', 'Fulfilment')) + '</th><th style="width:12mm">B</th><th style="width:12mm">S</th><th style="width:12mm">H</th><th style="width:14mm">' + H.esc(L('Lücken', 'Gaps')) + '</th></tr></thead><tbody>' +
      res.assets.filter(function (r) { return !scope.scopeAsset || r.asset.id === scope.scopeAsset; }).map(function (r) {
        return '<tr><td>' + H.esc(r.asset.name) + '</td><td class="small">' + H.esc(tx(GS.kind(A.assetKind(r.asset)))) + '</td><td>' + r.st.soll + '</td><td><b>' + pctTxt(pct(r.st)) + '</b></td><td>' + pctTxt(pct(r.lv.B)) + '</td><td>' + pctTxt(pct(r.lv.S)) + '</td><td>' + pctTxt(pct(r.lv.H)) + '</td><td>' + r.st.gaps + '</td></tr>'; }).join('') + '</tbody></table>');
    if (res.model.length && !scope.scopeAsset) h.push('<h3>' + H.esc(L('Modellierungslücken', 'Modelling gaps')) + '</h3><ul>' + res.model.map(function (m) { return '<li class="small">' + H.esc(m.text) + '</li>'; }).join('') + '</ul>');
    if (list.length) h.push('<h3>' + H.esc(L('Wichtigste Maßnahmenlücken', 'Most important measure gaps')) + '</h3><table><thead><tr><th style="width:10mm">Prio</th><th style="width:30mm">' + H.esc(L('Zielobjekt', 'Target object')) + '</th><th style="width:26mm">ID</th><th>' + H.esc(L('Anforderung', 'Requirement')) + '</th><th style="width:10mm">' + H.esc(L('Niv.', 'Lvl')) + '</th><th style="width:20mm">Status</th></tr></thead><tbody>' +
      list.slice(0, 25).map(function (g) { return '<tr><td>P' + g.prio + '</td><td class="small">' + H.esc(g.asset.name) + '</td><td><code>' + H.esc(g.ref) + '</code></td><td class="small">' + H.esc(g.title) + '</td><td>' + g.level + '</td><td class="small">' + H.esc(HA.t('status.' + g.status)) + '</td></tr>'; }).join('') + '</tbody></table>' +
      (list.length > 25 ? '<p class="small muted">' + H.esc(L('… weitere ' + (list.length - 25) + ' Lücken in der Gap-Analyse (CSV-Export).', '… ' + (list.length - 25) + ' more gaps in the gap analysis (CSV export).')) + '</p>' : ''));
    h.push('</section>');
    return h.join('');
  } });

  return { analyse: analyse, U: U, pct: pct };
})();

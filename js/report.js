/* =====================================================================
 * report.js – Erzeugt den Prüf-/Härtungsbericht als eigenständige
 *             HTML-Datei im Format DIN A4 Hochformat.
 * ---------------------------------------------------------------------
 * Der Bericht enthält sein CSS selbst (keine externen Dateien), damit er
 * archiviert, per Mail versendet oder als PDF gedruckt werden kann.
 * Inhalt je Asset:
 *   1. Stammdaten   2. Schutzbedarf   3. Zusammenfassung (Kennzahlen)
 *   4. Maßnahmen je Bibliothek inkl. Wirksamkeitskontrolle
 *   5. Gestrichene / nicht umgesetzte Maßnahmen mit Begründung
 *   6. Schwachstellen- und Konfigurationsscans (Zeitstempel, SHA-256)
 *   7. Freigabe / Unterschriften
 * Benötigt die Hilfsfunktionen aus HA.App (app.js).
 * ===================================================================== */
window.HA = window.HA || {};

HA.Report = (function () {
  'use strict';
  var t = function (k, v) { return HA.t(k, v); };

  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtDate(iso, withTime) {
    if (!iso) return '–';
    var d = new Date(iso); if (isNaN(d)) return esc(iso);
    var opt = withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' };
    return d.toLocaleString(HA.lang === 'de' ? 'de-DE' : 'en-GB', opt);
  }

  /** Eingebettetes CSS des Berichts (A4 Hochformat, druckoptimiert). */
  var CSS = [
    '@page { size: A4 portrait; margin: 18mm 15mm 20mm 18mm; @bottom-right { content: counter(page) " / " counter(pages); font-size: 8pt; color: #555; } @bottom-left { content: "VERTRAULICH – Härtungsbericht"; font-size: 8pt; color: #555; } }',
    'html { background: #e9ecef; } body { font-family: "Segoe UI", Arial, Helvetica, sans-serif; font-size: 9.5pt; color: #111; line-height: 1.4; margin: 0; }',
    '.page { background: #fff; width: 210mm; min-height: 297mm; margin: 10mm auto; padding: 18mm 15mm 20mm 18mm; box-sizing: border-box; box-shadow: 0 0 6px rgba(0,0,0,.2); }',
    '@media print { html { background: #fff; } .page { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; } .pb { break-before: page; } }',
    'h1 { font-size: 20pt; margin: 0 0 4mm; color: #0b3d91; } h2 { font-size: 13pt; color: #0b3d91; border-bottom: 1.5pt solid #0b3d91; padding-bottom: 1mm; margin: 7mm 0 3mm; break-after: avoid; }',
    'h3 { font-size: 11pt; margin: 5mm 0 2mm; break-after: avoid; } p { margin: 0 0 2mm; }',
    'table { width: 100%; border-collapse: collapse; margin: 2mm 0 4mm; font-size: 8.5pt; } th, td { border: .5pt solid #9aa3ad; padding: 1.2mm 1.6mm; vertical-align: top; text-align: left; }',
    'th { background: #e8edf3; } tr { break-inside: avoid; } thead { display: table-header-group; }',
    '.kv td:first-child { width: 45mm; font-weight: 600; background: #f5f7fa; }',
    '.cover { border: 1pt solid #0b3d91; border-top: 4mm solid #0b3d91; padding: 8mm; margin-bottom: 6mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .cover .sub { color: #444; font-size: 11pt; }',
    '.brandbar { display: flex; justify-content: space-between; align-items: flex-start; gap: 8mm; margin-bottom: 8mm; } .brandbar img { max-height: 22mm; max-width: 70mm; object-fit: contain; } .brandbar .org { text-align: right; font-size: 9pt; color: #333; line-height: 1.45; }',
    '.badge { display: inline-block; padding: .2mm 1.6mm; border-radius: 2mm; font-size: 7.5pt; font-weight: 700; border: .5pt solid #888; white-space: nowrap; }',
    '.st-done { background: #d9f2df; border-color: #1a7f37; color: #11592a; } .st-partial { background: #fdf0c8; border-color: #a16207; color: #7a4a05; }',
    '.st-notdone { background: #fbdcdc; border-color: #c62828; color: #8e1c1c; } .st-na { background: #eceff1; color: #555; } .st-open { background: #fff; color: #555; }',
    '.sev-critical, .sev-high { background: #c62828; color: #fff; border-color: #c62828; } .sev-medium { background: #b35900; color: #fff; border-color: #b35900; } .sev-low { background: #0b6bcb; color: #fff; border-color: #0b6bcb; } .sev-info { background: #6b7280; color: #fff; }',
    '.kpis { break-inside: avoid; page-break-inside: avoid; display: flex; gap: 3mm; margin: 3mm 0; } .kpi { flex: 1 1 0; border: .5pt solid #9aa3ad; padding: 2.5mm; } .kpi b { display: block; font-size: 15pt; color: #0b3d91; }',
    '.bar { height: 4mm; display: flex; border: .5pt solid #888; margin: 2mm 0; } .bar span { display: block; height: 100%; } .b-done { background: #1a7f37; } .b-partial { background: #d4a72c; } .b-notdone { background: #c62828; } .b-na { background: #9aa3ad; }',
    'pre.cmd { font-family: Consolas, "Courier New", monospace; font-size: 7pt; white-space: pre-wrap; word-break: break-all; background: #f5f7fa; border: .4pt solid #ccd; padding: 1mm 1.5mm; margin: 1mm 0; }',
    'code { font-family: Consolas, "Courier New", monospace; font-size: 7.5pt; word-break: break-all; } .muted { color: #555; } .small { font-size: 8pt; }',
    '.sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; margin-top: 12mm; } .sign div { border-top: .7pt solid #111; padding-top: 1.5mm; font-size: 8pt; }',
    '.note { border-left: 1.5mm solid #0b6bcb; background: #eef5fc; padding: 2mm 3mm; margin: 2mm 0 4mm; }'
  ].join('\n');

  function badge(cls, text) { return '<span class="badge ' + cls + '">' + esc(text) + '</span>'; }

  /** Bibliotheken, aus denen die anwendbaren Maßnahmen stammen (gewählte zuerst). */
  function libsOf(asset, items) {
    var out = (asset.libs || []).filter(function (l) { return items.some(function (it) { return it.lib === l; }); });
    items.forEach(function (it) { if (out.indexOf(it.lib) < 0) out.push(it.lib); });
    return out;
  }
  /** Abschnitt für ein Asset. */
  function assetSection(state, asset, opts, first) {
    var A = HA.App;
    var os = HA.osById(asset.os);
    var items = A.applicableItems(asset);
    var stats = A.assetStats(asset, items);
    var h = [];
    h.push('<section class="' + (first ? '' : 'pb') + '">');
    h.push('<h2>' + esc(asset.name) + '</h2>');

    /* 1. Stammdaten */
    h.push('<h3>1. ' + esc(HA.lang === 'de' ? 'Stammdaten' : 'Asset data') + '</h3><table class="kv"><tbody>');
    var sys = (asset.kind || 'system') === 'system', de = HA.lang !== 'en';
    var libsUsed = libsOf(asset, items);
    [[de ? 'Zielobjekt-Typ' : 'Target object type', A.kindLabel(asset)],
     ['c.hostname', asset.hostname], sys ? ['c.ip', asset.ip] : [de ? 'Details' : 'Details', [asset.ip, asset.osVersion].filter(Boolean).join(' · ')],
     sys ? ['c.os', HA.tx(os) + (asset.osVersion ? ' – ' + asset.osVersion : '')] : null,
     sys ? ['c.role', t('c.' + (asset.role || os.role))] : null, ['c.owner', asset.owner], ['c.location', asset.location], ['c.description', asset.description],
     ['c.approach', t('approach.' + (asset.approach || 'standard'))],
     [de ? 'Modellierte Bausteine' : 'Modelled modules', (asset.modules || []).map(function (m) { return m + ' ' + HA.GS.title(m); }).join('; ')],
     ['c.libraries', libsUsed.map(function (l) { var lib = A.getLib(l); return HA.tx(lib.name) + (lib.version ? ' (' + lib.version + ')' : ''); }).join('; ')]
    ].filter(Boolean).forEach(function (r) { h.push('<tr><td>' + esc(t(r[0])) + '</td><td>' + esc(r[1] || '–') + '</td></tr>'); });
    h.push('</tbody></table>');

    /* 2. Schutzbedarf */
    var sb = asset.sb || {};
    h.push('<h3>2. ' + esc(t('prot.title')) + '</h3><table><thead><tr><th>' + esc(HA.lang === 'de' ? 'Grundwert' : 'Objective') + '</th><th>' + esc(t('c.level')) + '</th><th>' + esc(t('c.reason')) + '</th></tr></thead><tbody>');
    ['c', 'i', 'a'].forEach(function (k) {
      h.push('<tr><td>' + esc(t('prot.' + k)) + '</td><td>' + esc(t('prot.' + (sb[k] || 'normal'))) + '</td><td>' + esc(sb[k + 'Note'] || '–') + '</td></tr>');
    });
    h.push('<tr><th>' + esc(t('prot.overall')) + '</th><th colspan="2">' + esc(t('prot.' + A.overallProtection(asset))) + '</th></tr></tbody></table>');

    /* 3. Zusammenfassung */
    h.push('<h3>3. ' + esc(HA.lang === 'de' ? 'Zusammenfassung' : 'Summary') + '</h3>');
    h.push('<div class="kpis"><div class="kpi"><b>' + stats.pct + ' %</b>' + esc(t('dash.progress')) + '</div><div class="kpi"><b>' + stats.applicable + '</b>' + esc(t('dash.measures')) +
      '</div><div class="kpi"><b>' + stats.verified + '</b>' + esc(t('verify.effective')) + '</div><div class="kpi"><b>' + A.openFindings(asset) + '</b>' + esc(t('dash.findings')) + '</div></div>');
    var tot = Math.max(1, stats.total);
    h.push('<div class="bar">' + ['done', 'partial', 'notdone', 'na'].map(function (s) { return '<span class="b-' + s + '" style="width:' + (stats[s] / tot * 100) + '%"></span>'; }).join('') + '</div>');
    h.push('<table><thead><tr><th>' + esc(t('c.library')) + '</th>' + HA.STATUS.map(function (s) { return '<th>' + esc(t('status.' + s)) + '</th>'; }).join('') + '<th>' + esc(t('c.total')) + '</th></tr></thead><tbody>');
    libsUsed.forEach(function (l) {
      var li = items.filter(function (it) { return it.lib === l; });
      if (!li.length) return;
      var c = { open: 0, done: 0, partial: 0, notdone: 0, na: 0 };
      li.forEach(function (it) { c[A.getCheck(asset, it).status || 'open']++; });
      h.push('<tr><td>' + esc(HA.tx(A.getLib(l).name)) + '</td>' + HA.STATUS.map(function (s) { return '<td>' + c[s] + '</td>'; }).join('') + '<td>' + li.length + '</td></tr>');
    });
    h.push('</tbody></table>');

    /* 4. Maßnahmen */
    h.push('<h3>4. ' + esc(HA.lang === 'de' ? 'Maßnahmen und Wirksamkeitskontrolle' : 'Measures and effectiveness review') + '</h3>');
    libsUsed.forEach(function (l) {
      var li = items.filter(function (it) { return it.lib === l && (opts.includeOpen || (A.getCheck(asset, it).status || 'open') !== 'open'); });
      if (!li.length) return;
      h.push('<p><b>' + esc(HA.tx(A.getLib(l).name)) + '</b></p>');
      h.push('<table><thead><tr><th style="width:30mm">ID</th><th>' + esc(HA.lang === 'de' ? 'Maßnahme' : 'Measure') + '</th><th style="width:8mm">' + esc(t('c.level')) +
        '</th><th style="width:22mm">' + esc(t('c.status')) + '</th><th>' + esc(t('c.notes')) + '</th><th style="width:30mm">' + esc(t('verify.title')) + '</th></tr></thead><tbody>');
      li.forEach(function (it) {
        var ck = A.getCheck(asset, it), st = ck.status || 'open';
        var extra = '';
        if (opts.includeDesc && HA.tx(it.desc)) extra += '<div class="muted small">' + esc(HA.tx(it.desc)) + '</div>';
        if (opts.includeCmds && A.checkCmd(it, asset)) extra += '<pre class="cmd">' + esc(A.checkCmd(it, asset)) + '</pre>';
        var note = [ck.justification, ck.note, ck.evidence ? (t('c.evidence') + ': ' + ck.evidence) : '', ck.autoNote].filter(Boolean).map(esc).join('<br>');
        var ver = ck.verResult ? esc(t('verify.' + ck.verResult)) + '<br><span class="small">' + fmtDate(ck.verDate) + (ck.verMethod ? ', ' + esc(t('method.' + ck.verMethod)) : '') + (ck.verBy ? '<br>' + esc(ck.verBy) : '') + '</span>' : '<span class="muted small">' + esc(t('verify.pending')) + '</span>';
        h.push('<tr><td><code>' + esc(it.ref) + '</code></td><td>' + esc(HA.tx(it.title)) + extra + '</td><td>' + esc(it.level || '') + '</td><td>' + badge('st-' + st, t('status.' + st)) +
          '</td><td>' + (note || '–') + '</td><td>' + ver + '</td></tr>');
      });
      h.push('</tbody></table>');
    });

    /* 5. Abweichungen */
    var dev = items.filter(function (it) { var s = A.getCheck(asset, it).status; return s === 'na' || s === 'notdone'; });
    h.push('<h3>5. ' + esc(HA.lang === 'de' ? 'Abweichungen: entbehrliche und nicht umgesetzte Maßnahmen' : 'Deviations: not applicable and not implemented measures') + '</h3>');
    if (!dev.length) h.push('<p class="muted">–</p>');
    else {
      h.push('<table><thead><tr><th style="width:28mm">ID</th><th>' + esc(HA.lang === 'de' ? 'Maßnahme' : 'Measure') + '</th><th style="width:24mm">' + esc(t('c.status')) + '</th><th>' + esc(t('c.reason')) + '</th></tr></thead><tbody>');
      dev.forEach(function (it) {
        var ck = A.getCheck(asset, it);
        h.push('<tr><td><code>' + esc(it.ref) + '</code><br><span class="small muted">' + esc(A.getLib(it.lib).short) + '</span></td><td>' + esc(HA.tx(it.title)) + '</td><td>' + badge('st-' + ck.status, t('status.' + ck.status)) + '</td><td>' + esc(ck.justification || '⚠ ' + t('cl.missingJust')) + '</td></tr>');
      });
      h.push('</tbody></table>');
    }

    /* 6. Scans */
    h.push('<h3>6. ' + esc(t('scan.title')) + '</h3>');
    var scans = asset.scans || [];
    var hasOv = scans.some(function (s) { return s.tool === 'openvas'; });
    h.push('<div class="note">' + esc(t('scan.vulnStatus')) + ': <b>' + esc(hasOv ? t('scan.hadScan') : t('scan.noVulnScan')) + '</b>' +
      (hasOv ? ' · ' + esc(t('scan.overall')) + ': <b>' + esc(t('scan.overall.' + A.vulnOverall(asset))) + '</b>' : '') + '</div>');
    if (scans.length) {
      h.push('<table><thead><tr><th>' + esc(t('scan.tool')) + '</th><th>' + esc(t('scan.date')) + '</th><th>' + esc(t('scan.file')) + ' / ' + esc(t('scan.hash')) + '</th><th>' + esc(t('c.result')) + '</th></tr></thead><tbody>');
      scans.forEach(function (s) {
        var fs = s.findings || [];
        var cnt = function (st) { return fs.filter(function (f) { return (f.status || 'open') === st; }).length; };
        var res = t('scan.summary', { total: fs.length, open: cnt('open') + cnt('partial'), fixed: cnt('fixed'), accepted: cnt('accepted') + cnt('falsepositive') });
        if (s.meta && s.meta.hardeningIndex !== null && s.meta.hardeningIndex !== undefined) res += ' · ' + t('scan.hi') + ': ' + s.meta.hardeningIndex;
        if (s.meta && s.meta.pass !== undefined) res += ' · ' + t('scan.passFail', { pass: s.meta.pass, fail: s.meta.fail });
        h.push('<tr><td>' + esc(s.tool) + '</td><td>' + fmtDate(s.scanDate, true) + '<br><span class="small muted">' + esc(t('scan.imported')) + ': ' + fmtDate(s.importedAt, true) + '</span></td><td>' +
          esc(s.file && s.file.name) + '<br><code>' + esc(s.file && s.file.sha256) + '</code></td><td>' + esc(res) + '</td></tr>');
      });
      h.push('</tbody></table>');
      if (opts.includeFindings) {
        scans.forEach(function (s) {
          var fs = (s.findings || []).filter(function (f) { return s.tool !== 'nmap' || true; });
          if (!fs.length) return;
          h.push('<p><b>' + esc(s.tool) + ' – ' + fmtDate(s.scanDate, true) + '</b></p><table><thead><tr><th style="width:16mm">' + esc(t('c.severity')) + '</th><th>' + esc(t('c.finding')) +
            '</th><th style="width:24mm">' + esc(t('c.status')) + '</th><th>' + esc(t('c.reason')) + '</th></tr></thead><tbody>');
          fs.forEach(function (f) {
            var st = f.status || 'open';
            h.push('<tr><td>' + badge('sev-' + f.severity, f.severity) + '</td><td>' + esc(f.title) + (f.port ? ' <span class="muted">[' + esc(f.port) + ']</span>' : '') +
              (f.cve ? '<br><span class="small muted">' + esc(f.cve) + '</span>' : '') + '</td><td>' + esc(t('fstatus.' + st)) + (f.statusDate ? '<br><span class="small">' + fmtDate(f.statusDate) + '</span>' : '') +
              '</td><td>' + esc(f.note || '–') + '</td></tr>');
          });
          h.push('</tbody></table>');
        });
      }
    } else h.push('<p class="muted">' + esc(t('scan.none')) + '</p>');

    h.push('</section>');
    return h.join('\n');
  }

  /* ------------------------------------------------------------------
   * Übergreifende Abschnitte: Risikobewertung, Projektrisiken, Roadmap, TOM
   * ---------------------------------------------------------------- */
  function riskSection(state, opts) {
    var R = HA.Risk, h = [];
    var rows = R.findingRows(state, { assetId: opts.scopeAsset });
    h.push('<section class="pb"><h2>' + esc(t('risk.title')) + '</h2><p class="small">' + esc(t('risk.matrixNote')) + ' ' + esc(HA.lang === 'de'
      ? 'Bewertet werden alle offenen, teilweise behobenen und akzeptierten Befunde der jeweils aktuellsten Scans.'
      : 'All open, partially fixed and accepted findings of the latest scans are assessed.') + '</p>');
    if (!rows.length) { h.push('<p class="muted">' + esc(t('risk.none')) + '</p></section>'); return h.join(''); }
    var cnt = { low: 0, medium: 0, high: 0, veryhigh: 0 }, unrated = 0;
    rows.forEach(function (r) { cnt[r.cat]++; if (r.suggested) unrated++; });
    h.push('<div style="display:grid;grid-template-columns:1.25fr 1fr;gap:6mm;align-items:start;break-inside:avoid"><div>' + R.heatmapHtml(rows, { cell: 46, fontSize: 10 }) + R.legendHtml() + '</div>' +
      '<table><thead><tr><th>' + esc(t('risk.value')) + '</th><th class="num">' + esc(t('c.count')) + '</th></tr></thead><tbody>' +
      R.CATS.slice().reverse().map(function (c) { return '<tr><td>' + R.badge(c, t('risk.cat.' + c)) + '</td><td>' + cnt[c] + '</td></tr>'; }).join('') +
      '<tr><th>' + esc(t('c.total')) + '</th><th>' + rows.length + '</th></tr></tbody></table></div>');
    if (unrated) h.push('<div class="note">' + esc(HA.lang === 'de' ? unrated + ' Befunde sind noch nicht manuell bewertet (Werte = Vorschlag aus Schwere und Schutzbedarf, mit * gekennzeichnet).'
      : unrated + ' findings are not yet rated manually (values = suggestion from severity and protection needs, marked with *).') + '</div>');
    h.push('<table><thead><tr><th style="width:17mm">ID</th><th>' + esc(t('c.finding')) + ' / ' + esc(t('risk.target')) + '</th><th>' + esc(t('risk.threat')) + '</th><th style="width:8mm">' + esc(t('risk.p')) +
      '</th><th style="width:8mm">' + esc(t('risk.i')) + '</th><th style="width:20mm">' + esc(t('risk.value')) + '</th><th style="width:18mm">' + esc(t('risk.treatment')) + '</th><th>' + esc(t('risk.measure')) +
      '</th><th style="width:22mm">' + esc(t('risk.owner')) + '</th><th style="width:18mm">' + esc(t('c.status')) + '</th></tr></thead><tbody>');
    rows.forEach(function (r) {
      var star = r.suggested ? '*' : '';
      var just = [r.measure, r.f.note].filter(Boolean).map(esc).join('<br>');
      h.push('<tr><td style="white-space:nowrap"><code>' + esc(r.id) + '</code></td><td>' + esc(r.f.title) + '<br><span class="small muted">' + esc(r.target) + ' · ' + esc(r.scan.tool) + ' · ' + esc(r.f.severity || '') + '</span></td>' +
        '<td class="small">' + esc(r.threat || (r.threatSuggest + ' *')) + '</td><td>' + r.p + star + '</td><td>' + r.i + star + '</td><td>' + R.badge(r.cat, t('risk.cat.' + r.cat) + ' (' + r.value + ')') + '</td>' +
        '<td>' + esc(r.treatment ? t('treat.' + r.treatment) : '–') + '</td><td class="small">' + (just || '–') + '</td><td class="small">' + esc(r.owner || '–') + (r.due ? '<br>' + fmtDate(r.due) : '') + '</td><td class="small">' + esc(t('fstatus.' + r.status)) + '</td></tr>');
    });
    h.push('</tbody></table></section>');
    return h.join('');
  }

  function pmSection(state) {
    var R = HA.Risk, list = state.projectRisks || [], h = [];
    h.push('<section class="pb"><h2>' + esc(t('pm.title')) + '</h2><p class="small">' + esc(t('pm.sub')) + '</p>');
    if (!list.length) { h.push('<p class="muted">' + esc(t('pm.empty')) + '</p></section>'); return h.join(''); }
    var scale = [1, 2, 3, 4, 5].map(function (n) { return t('pm.scale' + n); });
    var hm = function (rows) { return R.heatmapHtml(rows, { size: 5, catFn: R.pmCatCell, pLabels: scale, iLabels: scale, pTitle: t('pm.pTitle'), iTitle: t('pm.iTitle'), cell: 34, fontSize: 9 }); };
    h.push('<div style="display:grid;grid-template-columns:1fr 1fr;gap:6mm;break-inside:avoid"><div><b>' + esc(t('pm.before')) + '</b>' + hm(list.map(function (r) { return { p: +r.p || 1, i: +r.i || 1 }; })) + '</div><div><b>' + esc(t('pm.residual')) + '</b>' +
      hm(list.filter(function (r) { return r.rp && r.ri; }).map(function (r) { return { p: +r.rp, i: +r.ri }; })) + '</div></div>' + R.legendHtml());
    h.push('<table><thead><tr><th style="width:12mm">ID</th><th>' + esc(t('pm.risk')) + '</th><th style="width:7mm">' + esc(t('pm.p')) + '</th><th style="width:7mm">' + esc(HA.lang === 'de' ? 'A' : 'I') + '</th><th style="width:19mm">' + esc(t('pm.value')) +
      '</th><th style="width:17mm">' + esc(t('pm.strategy')) + '</th><th>' + esc(t('pm.measures')) + '</th><th style="width:22mm">' + esc(t('c.responsible')) + '</th><th style="width:19mm">' + esc(HA.lang === 'de' ? 'Restrisiko' : 'Residual') + '</th><th style="width:16mm">' + esc(t('c.status')) + '</th></tr></thead><tbody>');
    list.forEach(function (r) {
      var v = (+r.p || 1) * (+r.i || 1), rv = r.rp && r.ri ? r.rp * r.ri : 0;
      h.push('<tr><td><code>' + esc(r.id) + '</code></td><td>' + esc(r.title) + (r.cause ? '<br><span class="small muted">' + esc(t('pm.cause')) + ': ' + esc(r.cause) + '</span>' : '') + '<br><span class="small muted">' + esc(t('pm.cat.' + (r.category || 'technology'))) + '</span></td>' +
        '<td>' + (r.p || '–') + '</td><td>' + (r.i || '–') + '</td><td>' + R.badge(R.pmCategory(v), String(v)) + '</td><td>' + esc(r.strategy ? t('treat.' + r.strategy) : '–') + '</td>' +
        '<td class="small">' + esc(r.measures || '–') + (r.trigger ? '<br><i>' + esc(t('pm.trigger')) + ': ' + esc(r.trigger) + '</i>' : '') + '</td><td class="small">' + esc(r.owner || '–') + (r.due ? '<br>' + fmtDate(r.due) : '') + '</td>' +
        '<td>' + (rv ? R.badge(R.pmCategory(rv), String(rv)) : '–') + '</td><td class="small">' + esc(t('pm.st.' + (r.status || 'open'))) + '</td></tr>');
    });
    h.push('</tbody></table></section>');
    return h.join('');
  }

  function roadmapSection(state, opts) {
    var R = HA.Risk, list = R.roadmap(state, { assetId: opts.scopeAsset, includeProject: true }), h = [];
    h.push('<section class="pb"><h2>' + esc(t('rm.title')) + '</h2><p class="small">' + esc(t('rm.prioHint')) + '</p>');
    if (!list.length) { h.push('<p>' + esc(t('rm.empty')) + '</p></section>'); return h.join(''); }
    R.PHASES.forEach(function (p, i) {
      var g = list.filter(function (x) { return x.prio === p; }); if (!g.length) return;
      h.push('<h3>' + R.badge(R.CATS[3 - i], p.toUpperCase()) + ' ' + esc(t('rm.' + p)) + ' (' + g.length + ')</h3><table><thead><tr><th style="width:18mm">' + esc(t('rm.source')) + '</th><th style="width:20mm">ID</th><th style="width:24mm">' + esc(t('c.asset')) +
        '</th><th>' + esc(HA.lang === 'de' ? 'Punkt' : 'Item') + '</th><th style="width:24mm">' + esc(t('c.responsible')) + '</th><th style="width:18mm">' + esc(t('c.dueDate')) + '</th></tr></thead><tbody>');
      g.forEach(function (x) {
        h.push('<tr><td class="small">' + esc(t('rm.kind.' + x.kind)) + '</td><td><code>' + esc(x.ref) + '</code></td><td class="small">' + esc(x.asset) + '</td><td>' + esc(x.title) + '<br><span class="small muted">' + esc(x.detail) + '</span></td>' +
          '<td class="small">' + esc(x.owner || '–') + '</td><td class="small">' + (x.due ? fmtDate(x.due) + (x.overdue ? ' ⚠' : '') : '–') + '</td></tr>');
      });
      h.push('</tbody></table>');
    });
    h.push('</section>');
    return h.join('');
  }

  function tomSection(state, opts) {
    var s = HA.Risk.tomSummary(state, opts.scopeAsset), h = [];
    h.push('<section class="pb"><h2>' + esc(t('tom.title')) + '</h2><p class="small">' + esc(t('tom.sub')) + '</p><table><thead><tr><th>TOM</th><th>' + esc(HA.lang === 'de' ? 'Rechtsbezug' : 'Legal basis') + '</th>' +
      ['done', 'partial', 'open', 'notdone', 'na'].map(function (x) { return '<th style="width:15mm">' + esc(t('status.' + x)) + '</th>'; }).join('') + '<th style="width:13mm">' + esc(t('verify.effective')) + '</th></tr></thead><tbody>');
    s.rows.forEach(function (r) {
      h.push('<tr><td><b>' + esc(t('tom.' + r.tom.id)) + '</b></td><td class="small">' + esc(r.tom.law) + '</td>' + ['done', 'partial', 'open', 'notdone', 'na'].map(function (x) { return '<td>' + (r[x] || '–') + '</td>'; }).join('') + '<td>' + (r.effective || '–') + '</td></tr>');
    });
    h.push('</tbody></table><p class="small">' + esc(t('tom.review2', { scans: s.scans, ver: s.verified })) + '</p></section>');
    return h.join('');
  }

  /** Chancen und SWOT-Analyse für den Bericht. */
  function swotSection(state) {
    var R = HA.Risk, h = [], list = state.projectChances || [], w = state.swot || {};
    h.push('<section class="pb"><h2>' + esc(t('ch.title')) + '</h2><p class="small">' + esc(t('ch.sub')) + '</p>');
    if (list.length) {
      var scale = [1, 2, 3, 4, 5].map(function (n) { return t('pm.scale' + n); });
      h.push('<div style="break-inside:avoid">' + R.heatmapHtml(list.map(function (r) { return { p: +r.p || 1, i: +r.i || 1 }; }), { size: 5, catFn: R.pmCatCell, pLabels: scale, iLabels: scale,
        pTitle: t('pm.pTitle'), iTitle: t('ch.iTitle'), cell: 34, fontSize: 9, colors: R.CH_COLORS, textColors: R.CH_TEXT }) + R.legendHtml('ch.cat.', R.CH_COLORS) + '</div>');
      h.push('<table><thead><tr><th style="width:12mm">ID</th><th>' + esc(t('ch.chance')) + '</th><th style="width:7mm">' + esc(t('pm.p')) + '</th><th style="width:9mm">' + esc(t('ch.i')) + '</th><th style="width:22mm">' + esc(t('ch.value')) +
        '</th><th style="width:18mm">' + esc(t('pm.strategy')) + '</th><th>' + esc(t('ch.measures')) + '</th><th style="width:22mm">' + esc(t('c.responsible')) + '</th><th style="width:16mm">' + esc(t('c.status')) + '</th></tr></thead><tbody>');
      list.forEach(function (r) {
        var v = (+r.p || 1) * (+r.i || 1);
        h.push('<tr><td><code>' + esc(r.id) + '</code></td><td>' + esc(r.title) + (r.cause ? '<br><span class="small muted">' + esc(r.cause) + '</span>' : '') + '</td><td>' + (r.p || '–') + '</td><td>' + (r.i || '–') + '</td><td>' +
          R.badge(R.pmCategory(v), String(v), true) + '</td><td>' + esc(r.strategy ? t('ch.strat.' + r.strategy) : '–') + '</td><td class="small">' + esc(r.measures || '–') + '</td><td class="small">' + esc(r.owner || '–') +
          (r.due ? '<br>' + fmtDate(r.due) : '') + '</td><td class="small">' + esc(t('ch.st.' + (r.status || 'open'))) + '</td></tr>');
      });
      h.push('</tbody></table>');
    } else h.push('<p class="muted">' + esc(t('ch.empty')) + '</p>');
    var has = ['s', 'w', 'o', 't', 'so', 'st', 'wo', 'wt'].some(function (k) { return (w[k] || '').trim(); });
    if (has) {
      var ul = function (k) { var items = (w[k] || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean); return items.length ? '<ul style="margin:1mm 0 0 4mm;padding:0">' + items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '<span class="muted">–</span>'; };
      var cell = function (k, color) { return '<td style="width:50%;border-top:2mm solid ' + color + ';-webkit-print-color-adjust:exact;print-color-adjust:exact"><b>' + esc(t('swot.' + k)) + '</b> <span class="small muted">(' + esc(t('swot.' + k + 'Hint')) + ')</span>' + ul(k) + '</td>'; };
      h.push('<h3>' + esc(t('swot.title')) + (w.subject ? ': ' + esc(w.subject) : '') + '</h3><table style="break-inside:avoid"><tbody><tr>' + cell('s', '#3fb54a') + cell('w', '#f0952a') + '</tr><tr>' + cell('o', '#2f7fd8') + cell('t', '#d9362b') + '</tr></tbody></table>');
      if (['so', 'st', 'wo', 'wt'].some(function (k) { return (w[k] || '').trim(); })) {
        h.push('<h3>' + esc(t('swot.tows')) + '</h3><table style="break-inside:avoid"><tbody><tr>' + ['so', 'st'].map(function (k) { return '<td style="width:50%"><b>' + esc(t('swot.' + k)) + '</b><br>' + esc(w[k] || '–').replace(/\n/g, '<br>') + '</td>'; }).join('') +
          '</tr><tr>' + ['wo', 'wt'].map(function (k) { return '<td><b>' + esc(t('swot.' + k)) + '</b><br>' + esc(w[k] || '–').replace(/\n/g, '<br>') + '</td>'; }).join('') + '</tr></tbody></table>');
      }
    }
    h.push('</section>');
    return h.join('');
  }

  /** Vollständiges HTML-Dokument erzeugen. */
  function build(state, opts) {
    var assets = state.assets.filter(function (a) { return !opts.assetIds || opts.assetIds.indexOf(a.id) >= 0; });
    var now = new Date().toISOString();
    var B = state.meta.brand || {};
    var title = B.reportTitle || (HA.lang === 'de' ? 'Härtungsbericht und Wirksamkeitskontrolle' : 'Hardening report and effectiveness review');
    // Branding: Akzentfarbe und Kopf-/Fußzeilen (CSS-Strings sicher maskieren)
    var accent = /^#[0-9a-f]{6}$/i.test(B.color || '') ? B.color : '#0b3d91';
    var cssStr = function (v) { return '"' + String(v || '').replace(/[\\"]/g, '\\$&').replace(/[\r\n]+/g, ' ').replace(/</g, '\\3C ') + '"'; };
    var footer = B.footer || (HA.lang === 'de' ? 'VERTRAULICH – Härtungsbericht' : 'CONFIDENTIAL – hardening report');
    var css = CSS.replace(/#0b3d91/g, accent).replace('content: "VERTRAULICH – Härtungsbericht";', 'content: ' + cssStr(footer) + ';')
      .replace('@bottom-right {', '@top-left { content: ' + cssStr(state.meta.org || '') + '; font-size: 8pt; color: #555; } @top-right { content: ' + cssStr(title) + '; font-size: 8pt; color: #555; } @bottom-right {');
    var h = [];
    h.push('<!DOCTYPE html><html lang="' + HA.lang + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">');
    h.push('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:">');
    h.push('<title>' + esc(title) + ' – ' + esc(assets.map(function (a) { return a.name; }).join(', ')) + '</title><style>' + css + '</style></head><body><div class="page">');
    // Deckblatt mit Logo und Absenderangaben
    var org = [state.meta.org ? '<b style="font-size:12pt">' + esc(state.meta.org) + '</b>' : '', B.subtitle, B.address, B.contact, B.web].filter(Boolean)
      .map(function (x, i) { return i === 0 && state.meta.org ? x : esc(x).replace(/\n/g, '<br>'); }).join('<br>');
    h.push('<div class="cover"><div class="brandbar"><img src="' + esc(B.logo || HA.DEFAULT_LOGO) + '" alt="Logo"><div class="org">' + org + '</div></div>' +
      '<h1>' + esc(title) + '</h1>');
    h.push('<table class="kv" style="margin-top:4mm"><tbody>' +
      '<tr><td>' + esc(HA.lang === 'de' ? 'Gegenstand' : 'Scope') + '</td><td>' + esc(assets.map(function (a) { return a.name; }).join(', ') || '–') + '</td></tr>' +
      '<tr><td>' + esc(HA.lang === 'de' ? 'Erstellt am' : 'Created on') + '</td><td>' + fmtDate(now, true) + '</td></tr>' +
      '<tr><td>' + esc(HA.lang === 'de' ? 'Erstellt von' : 'Created by') + '</td><td>' + esc(state.meta.auditor || '–') + '</td></tr>' +
      '<tr><td>' + esc(HA.lang === 'de' ? 'Grundlagen' : 'Basis') + '</td><td>' + esc(HA.lang === 'de'
        ? 'BSI-Standard 200-2 / 300-1 (Grundschutz++), IT-Grundschutz-Kompendium Edition 2023, OpenSCAP SCAP Security Guide sowie die je Asset gewählten Bibliotheken.'
        : 'BSI Standard 200-2 / 300-1 (Grundschutz++), IT-Grundschutz Compendium Edition 2023, OpenSCAP SCAP Security Guide and the libraries selected per asset.') + '</td></tr>' +
      '<tr><td>' + esc(HA.lang === 'de' ? 'Einstufung' : 'Classification') + '</td><td>' + esc(B.footer || (HA.lang === 'de' ? 'VERTRAULICH – enthält sicherheitsrelevante Informationen' : 'CONFIDENTIAL – contains security-relevant information')) + '</td></tr>' +
      '</tbody></table></div>');
    h.push('<p class="muted small">' + esc(HA.lang === 'de'
      ? 'Hinweis: Titel der BSI-Anforderungen entsprechen dem Kompendium; Beschreibungen sind sinngemäße Kurzfassungen. Maßgeblich sind die Originalquellen.'
      : 'Note: BSI requirement titles follow the compendium; descriptions are paraphrased summaries. The original sources are authoritative.') + '</p>');
    assets.forEach(function (a, i) { h.push(assetSection(state, a, opts, i === 0)); });
    var scope = { scopeAsset: opts.assetIds && opts.assetIds.length === 1 ? opts.assetIds[0] : '' };
    if (opts.includeTom) h.push(tomSection(state, scope));
    if (opts.includeRisk) h.push(riskSection(state, scope));
    if (opts.includePm) h.push(pmSection(state));
    if (opts.includeSwot) h.push(swotSection(state));
    if (opts.includeRoadmap) h.push(roadmapSection(state, scope));
    // Abschnitte aus Modulen (Risikoregister, Monte-Carlo, KPI, Pflichtenkalender, BCM …)
    EXT.forEach(function (x) { if (!opts.ext || opts.ext[x.key]) { try { h.push(x.build(state, scope, H)); } catch (e) { h.push('<p class="muted">[' + esc(x.key) + ': ' + esc(e.message) + ']</p>'); } } });
    h.push('<h2>' + esc(HA.lang === 'de' ? 'Freigabe' : 'Approval') + '</h2><div class="sign"><div>' + esc(HA.lang === 'de' ? 'Erstellt (Datum, Unterschrift)' : 'Prepared (date, signature)') +
      '</div><div>' + esc(HA.lang === 'de' ? 'Geprüft – ISB (Datum, Unterschrift)' : 'Reviewed – ISO (date, signature)') + '</div><div>' + esc(HA.lang === 'de' ? 'Freigegeben – Leitung (Datum, Unterschrift)' : 'Approved – management (date, signature)') + '</div></div>');
    h.push('<p class="muted small" style="margin-top:10mm;text-align:center">' + esc(t('rep.madeWith')) + '</p>');
    h.push('</div></body></html>');
    return h.join('\n');
  }

  /* Erweiterungen: { key, build(state, scope, helpers) → HTML } */
  var EXT = [];
  var H = { esc: esc, fmtDate: fmtDate, badge: badge, t: t };
  return { build: build, esc: esc, fmtDate: fmtDate, ext: EXT, css: function () { return CSS; } };
})();

/* =====================================================================
 * modules/glossary.js – Glossar: alle 111 IT-Grundschutz-Bausteine,
 *   47 elementare Gefährdungen und Fachbegriffe
 * ---------------------------------------------------------------------
 * – Suche filtert live (ohne Neuaufbau, der Fokus bleibt im Suchfeld)
 * – Je Baustein: vorhandene Einzelanforderungen, modellierte Assets und
 *   „Modellieren“ (Baustein Assets zuordnen)
 * – Je Gefährdung: Verwendung im Risikoregister
 * Daten: js/data/gs-glossary.js (HA.GS)
 * ===================================================================== */
window.HA = window.HA || {};

HA.Glossary = (function () {
  'use strict';
  var A = HA.App, K = HA.Kit, L = K.L, esc = A.esc, GS = HA.GS;
  var U = { tab: 'bausteine', q: '', layer: '' };
  K.addI18n({ 'nav.glossary': 'Glossar' }, { 'nav.glossary': 'Glossary' });
  function S() { return A.state(); }
  function tx(o) { return GS.L(o); }

  /** Anzahl Einzelanforderungen je Baustein, getrennt nach Herkunft. */
  function reqCounts() {
    var c = {};
    A.allItems().forEach(function (it) {
      if (it.lib === 'gsmod') return;
      var b = A.bausteinOf(it); if (!b) return;
      c[b] = c[b] || { builtin: 0, imported: 0, custom: 0 };
      if (it.lib === 'custom') c[b].custom++; else if (it.lib === 'bsi2023') c[b].builtin++; else c[b].imported++;
    });
    return c;
  }
  function modelledBy(id) { return S().assets.filter(function (a) { return (a.modules || []).indexOf(id) >= 0; }); }
  function threatUse() {
    var c = {}; ((S().register || {}).items || []).forEach(function (r) { var m = /^G\s?0\.(\d+)/.exec(r.threat || ''); if (m) { var k = 'G 0.' + m[1]; c[k] = (c[k] || 0) + 1; } });
    return c;
  }

  function view() {
    var s = S(), mods = {}; s.assets.forEach(function (a) { (a.modules || []).forEach(function (m) { mods[m] = 1; }); });
    var h = [K.pageHead(L('Glossar', 'Glossary'), L('Nachschlagewerk zum IT-Grundschutz: alle 111 Bausteine des Kompendiums (Edition 2023) in zehn Schichten, die 47 elementaren Gefährdungen und zentrale Fachbegriffe. Bausteine lassen sich direkt auf Assets modellieren.',
      'Reference for IT-Grundschutz: all 111 modules of the compendium (Edition 2023) in ten layers, the 47 elementary threats and key terms. Modules can be modelled onto assets directly.'),
      K.btn('glPrint', '🖨 ' + L('Drucken / PDF', 'Print / PDF')))];
    h.push('<div class="grid grid-4">' + K.stat(GS.BAUSTEINE.length, L('Bausteine (Edition 2023)', 'modules (Edition 2023)'), '#1f6feb') + K.stat(GS.LAYERS.length, L('Schichten', 'layers'), '#0f766e') +
      K.stat(GS.THREATS.length, L('elementare Gefährdungen', 'elementary threats'), '#c62828') + K.stat(Object.keys(mods).length, L('Bausteine modelliert', 'modules modelled'), '#7c3aed') + '</div>');
    h.push('<div class="card no-print">' + K.tabs('glTab', [['bausteine', ['Bausteine', 'Modules']], ['threats', ['Elementare Gefährdungen', 'Elementary threats']], ['terms', ['Begriffe', 'Terms']]], U.tab) +
      '<div class="row" style="margin-top:.6rem"><input type="search" id="glQ" data-act="glQ" value="' + esc(U.q) + '" placeholder="' + esc(L('Suchen: ID, Titel, Beschreibung …', 'Search: ID, title, description …')) + '" style="flex:1;min-width:220px">' +
      (U.tab === 'bausteine' ? '<div class="seg">' + [['', L('Alle', 'All')]].concat(GS.LAYERS.map(function (l) { return [l.id, l.id]; })).map(function (o) {
        return '<button type="button" class="' + (U.layer === o[0] ? 'on' : '') + '" data-act="glLayer" data-id="' + o[0] + '" title="' + esc(o[0] ? tx(GS.layer(o[0])) : '') + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>' : '') +
      '<span class="small muted" id="glCount"></span></div></div>');
    if (U.tab === 'bausteine') h.push(bausteineHtml());
    else if (U.tab === 'threats') h.push(threatsHtml());
    else h.push(termsHtml());
    return h.join('');
  }

  function bausteineHtml() {
    var cnt = reqCounts(), h = [];
    GS.LAYERS.filter(function (l) { return !U.layer || l.id === U.layer; }).forEach(function (l) {
      var k = GS.kind(l.kind);
      h.push('<div class="card gl-block"><h2 style="margin:0 0 .2rem">' + esc(l.id + ' – ' + tx(l)) + '</h2><p class="small muted">' + esc(l.type === 'process' ? L('Prozess-Baustein', 'Process module') : L('System-Baustein', 'System module')) +
        ' · ' + esc(L('typischer Zielobjekt-Typ: ', 'typical target object type: ')) + k.icon + ' ' + esc(tx(k)) + '</p>' +
        K.table([{ l: ['Baustein', 'Module'], w: 90 }, { l: ['Titel', 'Title'], w: 200 }, { l: ['Kurzbeschreibung', 'Summary'], w: 240 }, { l: ['Anforderungen', 'Requirements'], w: 110 }, { l: ['Modelliert bei', 'Modelled on'], w: 140 }, ''],
          GS.BAUSTEINE.filter(function (b) { return b.layer === l.id; }).map(function (b) {
            var c = cnt[b.id], on = modelledBy(b.id);
            var req = c ? [c.builtin ? c.builtin + ' ' + L('eingebaut', 'built-in') : '', c.imported ? c.imported + ' ' + L('importiert', 'imported') : '', c.custom ? c.custom + ' ' + L('eigene', 'custom') : ''].filter(Boolean).join(' · ') : '<span class="muted">' + esc(L('nur Gesamtbewertung', 'overall only')) + '</span>';
            return '<tr class="gl-row" data-s="' + esc((b.id + ' ' + b.de + ' ' + b.en + ' ' + b.d.de + ' ' + b.d.en).toLowerCase()) + '"><td class="mono nowrap"><b>' + esc(b.id) + '</b></td><td>' + esc(tx(b)) + '</td><td class="small">' + esc(tx(b.d)) + '</td><td class="small">' + req + '</td><td class="small">' +
              (on.length ? on.map(function (a) { return '<a href="#checklist" data-act="openAsset" data-id="' + a.id + '" class="chip">' + esc(a.name) + '</a>'; }).join(' ') : '<span class="muted">–</span>') + '</td>' +
              '<td class="nowrap no-print">' + K.btn('glModel', '＋ ' + L('Modellieren', 'Model'), { id: b.id, cls: 'btn-sm', title: L('Baustein Assets zuordnen', 'Assign module to assets') }) + '</td></tr>';
          })) + '</div>');
    });
    h.push('<p class="small muted">' + esc(L('Titel gemäß IT-Grundschutz-Kompendium Edition 2023; Kurzbeschreibungen sinngemäß. Einzelanforderungen der Bausteine über „Import“ (Kompendium-XML/Text) laden – maßgeblich ist der Originaltext des BSI.',
      'Titles per IT-Grundschutz Compendium Edition 2023; summaries paraphrased. Load the individual requirements via "Import" (compendium XML/text) – the BSI original text is authoritative.')) + '</p>');
    return h.join('');
  }

  function threatsHtml() {
    var use = threatUse();
    return '<div class="card gl-block">' + K.table([{ l: ['Nr.', 'No.'], w: 60 }, { l: ['Elementare Gefährdung', 'Elementary threat'], w: 220 }, { l: ['Kurzbeschreibung', 'Summary'], w: 280 }, { l: ['Risikoregister', 'Risk register'], w: 90 }],
      GS.THREATS.map(function (x) {
        return '<tr class="gl-row" data-s="' + esc((x.id + ' ' + x.de + ' ' + x.en + ' ' + x.d.de + ' ' + x.d.en).toLowerCase()) + '"><td class="mono nowrap"><b>' + esc(x.id) + '</b></td><td>' + esc(tx(x)) + '</td><td class="small">' + esc(tx(x.d)) + '</td><td class="small">' +
          (use[x.id] ? '<a href="#register">' + use[x.id] + ' ' + esc(L('Risiko/en', 'risk(s)')) + '</a>' : '<span class="muted">–</span>') + '</td></tr>';
      })) + '<p class="small muted">' + esc(L('Die elementaren Gefährdungen sind Grundlage der Risikoanalyse nach BSI-Standard 200-3; im Risikoregister stehen alle 47 als Vorschlagsliste zur Verfügung.',
        'The elementary threats are the basis of the risk analysis per BSI Standard 200-3; all 47 are available as suggestions in the risk register.')) + '</p></div>';
  }

  function termsHtml() {
    return '<div class="card gl-block"><dl class="gl-terms">' + GS.TERMS.map(function (x) {
      return '<div class="gl-row" data-s="' + esc((x.de + ' ' + x.en + ' ' + x.d.de + ' ' + x.d.en).toLowerCase()) + '"><dt>' + esc(tx(x)) + (HA.lang === 'en' ? '' : ' <span class="muted small">(' + esc(x.en) + ')</span>') + '</dt><dd>' + esc(tx(x.d)) + '</dd></div>';
    }).join('') + '</dl></div>';
  }

  /** Suchfilter direkt im DOM anwenden (kein Neuaufbau). */
  function filter() {
    var q = U.q.trim().toLowerCase(), n = 0, tot = 0;
    document.querySelectorAll('.gl-row').forEach(function (r) { tot++; var hit = !q || q.split(/\s+/).every(function (w) { return r.getAttribute('data-s').indexOf(w) >= 0; }); r.hidden = !hit; if (hit) n++; });
    document.querySelectorAll('.gl-block').forEach(function (b) { if (!b.querySelector('.gl-row')) return; b.hidden = !b.querySelector('.gl-row:not([hidden])'); });
    var c = document.getElementById('glCount'); if (c) c.textContent = n + ' / ' + tot;
  }

  /** Baustein einem oder mehreren Assets zuordnen. */
  function modelDialog(id) {
    var s = S(), b = GS.byId(id), kind = GS.layer(b.layer).kind;
    if (!s.assets.length) {
      A.confirm(L('Noch keine Assets vorhanden. Jetzt ein Zielobjekt „' + tx(GS.kind(kind)) + '“ mit diesem Baustein anlegen?', 'No assets yet. Create a target object "' + tx(GS.kind(kind)) + '" with this module now?'), function () { setTimeout(function () { A.editAsset(null, kind, [id]); }, 0); });
      return;
    }
    var body = '<p class="small">' + esc(tx(b.d)) + '</p><div class="checks">' + A.kindGroups().map(function (g) {
      return '<div class="small muted" style="margin-top:.4rem"><b>' + g.kind.icon + ' ' + esc(tx(g.kind)) + '</b>' + (g.kind.id === kind ? ' – ' + esc(L('passend', 'matching')) : '') + '</div>' + g.assets.map(function (a) {
        return '<label><input type="checkbox" name="as" value="' + a.id + '"' + ((a.modules || []).indexOf(id) >= 0 ? ' checked' : '') + '> ' + esc(a.name) + '</label>'; }).join('');
    }).join('') + '</div>';
    A.dialog(id + ' ' + tx(b), body, function (f) {
      var sel = Array.prototype.map.call(f.querySelectorAll('[name=as]:checked'), function (x) { return x.value; }), n = 0;
      s.assets.forEach(function (a) {
        a.modules = a.modules || []; var has = a.modules.indexOf(id) >= 0, want = sel.indexOf(a.id) >= 0;
        if (want && !has) { a.modules.push(id); n++; }
        if (!want && has) { a.modules.splice(a.modules.indexOf(id), 1); n++; }
      });
      A.invalidate(); A.save(); A.render(); if (n) A.toast(L('Modellierung aktualisiert', 'Modelling updated') + ' (' + id + ')');
    }, L('Übernehmen', 'Apply'));
  }

  function printView() {
    var GSs = GS, rows = function (list) { return list.join(''); };   // eigenständiges Druckdokument
    var html = '<!DOCTYPE html><html lang="' + HA.lang + '"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>' + esc(L('Glossar IT-Grundschutz', 'IT-Grundschutz glossary')) + '</title><style>' +
      '@page{size:A4;margin:14mm}body{font-family:Segoe UI,Roboto,Arial,sans-serif;font-size:9pt;color:#1b2430}h1{font-size:16pt}h2{font-size:12pt;margin:6mm 0 2mm;border-bottom:.5pt solid #b8c2cf}table{border-collapse:collapse;width:100%}td,th{border:.4pt solid #b8c2cf;padding:1mm 1.6mm;text-align:left;vertical-align:top}th{background:#eef2f7}td:first-child{white-space:nowrap;font-weight:600}dt{font-weight:700;margin-top:2mm}dd{margin:0 0 1mm 0}tr{break-inside:avoid}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>' +
      '<h1>' + esc(L('Glossar IT-Grundschutz', 'IT-Grundschutz glossary')) + '</h1>' +
      GSs.LAYERS.map(function (l) { return '<h2>' + esc(l.id + ' – ' + tx(l)) + '</h2><table><tbody>' + rows(GSs.BAUSTEINE.filter(function (b) { return b.layer === l.id; }).map(function (b) { return '<tr><td style="width:22mm">' + esc(b.id) + '</td><td style="width:60mm">' + esc(tx(b)) + '</td><td>' + esc(tx(b.d)) + '</td></tr>'; })) + '</tbody></table>'; }).join('') +
      '<h2 style="break-before:page">' + esc(L('Elementare Gefährdungen', 'Elementary threats')) + '</h2><table><tbody>' + rows(GSs.THREATS.map(function (x) { return '<tr><td style="width:16mm">' + esc(x.id) + '</td><td style="width:70mm">' + esc(tx(x)) + '</td><td>' + esc(tx(x.d)) + '</td></tr>'; })) + '</tbody></table>' +
      '<h2>' + esc(L('Begriffe', 'Terms')) + '</h2><dl>' + GSs.TERMS.map(function (x) { return '<dt>' + esc(tx(x)) + '</dt><dd>' + esc(tx(x.d)) + '</dd>'; }).join('') + '</dl></body></html>';
    var fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0'; document.body.appendChild(fr);
    fr.onload = function () { setTimeout(function () { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { A.toast(e.message, true); } setTimeout(function () { fr.remove(); }, 120000); }, 250); };
    fr.srcdoc = html;
  }

  A.views.glossary = view;
  A.ext.afterRender.push(function (v) { if (v === 'glossary') filter(); });
  A.ext.click.push(function (act, el) {
    var id = el.getAttribute('data-id');
    switch (act) {
      case 'glTab': U.tab = id; A.render(); return true;
      case 'glLayer': U.layer = id; A.render(); return true;
      case 'glModel': modelDialog(id); return true;
      case 'glPrint': printView(); A.toast(L('Für PDF im Druckdialog „Als PDF speichern“ wählen.', 'For PDF choose "Save as PDF" in the print dialog.')); return true;
    }
  });
  A.ext.input.push(function (act, el) { if (act === 'glQ') { U.q = el.value; filter(); return true; } });
  A.ext.change.push(function (act) { if (act === 'glQ') return true; });

  return { U: U, reqCounts: reqCounts };
})();

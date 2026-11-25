/* =====================================================================
 * modules/findings-report.js – Pentest-Bericht (DIN A4) und Exporte
 * ---------------------------------------------------------------------
 * Erzeugt einen eigenständigen HTML-Bericht im A4-Hochformat:
 *   Deckblatt (Branding) → Dokumentenkontrolle → Inhaltsverzeichnis →
 *   Berichtsabschnitte in frei wählbarer Reihenfolge (eigene Markdown-
 *   Abschnitte + automatische Abschnitte: Bewertungsschema, Ergebnis-
 *   übersicht, Findings im Detail, Re-Test-Übersicht).
 * Ausgabe: Drucken, als HTML-Datei speichern oder über den Druckdialog
 * „Als PDF speichern“ – ohne Server und ohne Fremdbibliotheken.
 * Zusätzlich: Markdown-Export aller Findings.
 * ===================================================================== */
window.HA = window.HA || {};

HA.PTReport = (function () {
  'use strict';
  function L(de, en) { return HA.lang === 'en' && en ? en : de; }
  function esc(s) { return HA.MD.esc(s === undefined || s === null ? '' : s); }
  function fdate(s) { if (!s) return '–'; var d = new Date(s.length <= 10 ? s + 'T00:00:00' : s); return isNaN(d) ? esc(s) : d.toLocaleDateString(HA.lang === 'de' ? 'de-DE' : 'en-GB'); }

  /* Schweregrade (CVSS v3.1 qualitative Skala) */
  var SEV = {
    critical: { de: 'Kritisch', en: 'Critical', c: '#6a1b9a', range: '9.0 – 10.0', rank: 5, dDe: 'Unmittelbar ausnutzbar mit schwerwiegenden Folgen (z. B. vollständige Kompromittierung). Sofort beheben.', dEn: 'Directly exploitable with severe consequences (e.g. full compromise). Fix immediately.' },
    high: { de: 'Hoch', en: 'High', c: '#d9362b', range: '7.0 – 8.9', rank: 4, dDe: 'Ausnutzung führt zu erheblichem Schaden. Kurzfristig beheben.', dEn: 'Exploitation causes significant damage. Fix at short notice.' },
    medium: { de: 'Mittel', en: 'Medium', c: '#e07b00', range: '4.0 – 6.9', rank: 3, dDe: 'Ausnutzung erfordert Voraussetzungen oder hat begrenzte Folgen. Mittelfristig beheben.', dEn: 'Exploitation needs preconditions or has limited impact. Fix in the medium term.' },
    low: { de: 'Niedrig', en: 'Low', c: '#2f7fd8', range: '0.1 – 3.9', rank: 2, dDe: 'Geringes Risiko, oft nur in Kombination relevant. Im Rahmen der regulären Wartung beheben.', dEn: 'Low risk, often relevant only in combination. Fix during regular maintenance.' },
    info: { de: 'Information', en: 'Informational', c: '#6b7280', range: '0.0', rank: 1, dDe: 'Hinweis ohne direktes Risiko; Verbesserung der Sicherheitslage.', dEn: 'Note without direct risk; improves the security posture.' }
  };
  var SEV_ORDER = ['critical', 'high', 'medium', 'low', 'info'];
  var RETEST = {
    open: ['nicht getestet', 'not retested', '#6b7280'], fixed: ['behoben', 'fixed', '#1a7f37'], partial: ['teilweise behoben', 'partially fixed', '#d48806'],
    notfixed: ['nicht behoben', 'not fixed', '#c62828'], accepted: ['Risiko akzeptiert', 'risk accepted', '#7c3aed'], na: ['entfällt', 'n/a', '#9aa3ad']
  };
  var STATUS = { draft: ['Entwurf', 'Draft'], review: ['in Prüfung', 'In review'], final: ['final', 'Final'] };
  /* Standard-Abschnitte eines Findings (Markdown) */
  var MDSECS = [
    ['summary', ['Zusammenfassung', 'Summary']], ['description', ['Technische Beschreibung', 'Technical description']], ['impact', ['Auswirkung / Risiko', 'Impact / risk']],
    ['steps', ['Reproduktion / Proof of Concept', 'Reproduction / proof of concept']], ['evidence', ['Nachweise', 'Evidence']], ['recommendation', ['Empfehlung', 'Recommendation']],
    ['references', ['Referenzen', 'References']], ['retestNote', ['Re-Test-Notiz', 'Retest note']]
  ];
  function sevLabel(k) { var s = SEV[k] || SEV.info; return L(s.de, s.en); }
  function badge(k) { var s = SEV[k] || SEV.info; return '<span class="sev" style="background:' + s.c + '">' + esc(sevLabel(k)) + '</span>'; }
  function rtBadge(k) { var r = RETEST[k || 'open'] || RETEST.open; return '<span class="rt" style="border-color:' + r[2] + ';color:' + r[2] + '">' + esc(L(r[0], r[1])) + '</span>'; }
  /** Bilder (img:ID) des Findings/Projekts in data-URIs auflösen und Markdown rendern. */
  function md(text, images) {
    var t = String(text || '').replace(/\]\(img:([\w-]+)\)/g, function (m, id) { return '](' + ((images && images[id]) || 'img-fehlt') + ')'; });
    return '<div class="md">' + HA.MD.render(t) + '</div>';
  }
  function sectionLabel(pt, key) {
    var s = MDSECS.find(function (x) { return x[0] === key; }); if (s) return L(s[1][0], s[1][1]);
    var f = (pt.fields || []).find(function (x) { return 'cf:' + x.id === key; }); return f ? f.label : key;
  }
  function cfValue(f, v) {
    if (v === undefined || v === null || v === '') return '';
    if (f.type === 'check') return v ? '✔' : '✕';
    if (f.type === 'date') return fdate(v);
    if (f.type === 'url') return '<a href="' + esc(/^https?:/i.test(v) ? v : '#') + '">' + esc(v) + '</a>';
    return esc(v);
  }
  function assetNames(state, ids) { return (ids || []).map(function (id) { var a = state.assets.find(function (x) { return x.id === id; }); return a ? a.name + (a.hostname ? ' (' + a.hostname + ')' : '') : null; }).filter(Boolean); }

  /** Auswahl und Sortierung der Findings für den Bericht. */
  function selection(pt, opts) {
    var min = SEV[opts.minSev || 'info'].rank;
    var list = pt.findings.filter(function (f) {
      if (opts.only) return opts.only.indexOf(f.id) >= 0;
      return f.include !== false && (opts.includeDrafts || f.status !== 'draft') && (SEV[f.severity] || SEV.info).rank >= min;
    });
    list.sort(function (a, b) {
      if (opts.sort === 'id') return a.id.localeCompare(b.id, undefined, { numeric: true });
      return (SEV[b.severity] || SEV.info).rank - (SEV[a.severity] || SEV.info).rank || (+b.cvss || 0) - (+a.cvss || 0) || a.id.localeCompare(b.id, undefined, { numeric: true });
    });
    return list;
  }

  var CSS = '@page{size:A4 portrait;margin:20mm 16mm 18mm 16mm;@bottom-left{content:"__FOOT__";font-size:7.5pt;color:#555}@bottom-right{content:counter(page) " / " counter(pages);font-size:7.5pt;color:#555}@top-left{content:"__ORG__";font-size:7.5pt;color:#555}@top-right{content:"__TITLE__";font-size:7.5pt;color:#555}}' +
    '@page:first{@top-left{content:none}@top-right{content:none}}' +
    '*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:"Segoe UI",Roboto,Arial,sans-serif;font-size:10pt;color:#1b2430;margin:0;background:#e9edf2}' +
    '.page{max-width:210mm;margin:0 auto;background:#fff;padding:18mm 16mm}@media print{body{background:#fff}.page{padding:0;max-width:none}}' +
    'h1{font-size:20pt;color:__ACC__;margin:0 0 4mm}h2{font-size:14pt;color:__ACC__;border-bottom:2px solid __ACC__;padding-bottom:1.5mm;margin:8mm 0 3mm;break-after:avoid}h3{font-size:11.5pt;margin:5mm 0 2mm;break-after:avoid;color:#1b2430}' +
    'table{width:100%;border-collapse:collapse;margin:2mm 0 4mm;font-size:9pt}th,td{border:.4pt solid #b8c2cf;padding:1.6mm 2mm;text-align:left;vertical-align:top}th{background:#eef2f7}tr{break-inside:avoid}' +
    '.kv td:first-child{width:42mm;font-weight:600;background:#f6f8fb}.small{font-size:8.5pt}.muted{color:#5b6676}' +
    '.cover{min-height:245mm;display:flex;flex-direction:column;break-after:page}.brandbar{display:flex;align-items:center;gap:6mm;border-bottom:3px solid __ACC__;padding-bottom:5mm;margin-bottom:22mm}.brandbar img{max-height:22mm;max-width:60mm}' +
    '.cover .kicker{text-transform:uppercase;letter-spacing:.12em;color:#5b6676;font-size:9pt;margin-bottom:2mm}.cover h1{font-size:26pt;line-height:1.15}.cover .sub{font-size:13pt;color:#3b4654;margin-bottom:12mm}.cover .conf{margin-top:auto;border:1.5pt solid #c62828;color:#c62828;padding:3mm;font-weight:700;text-align:center}' +
    '.sev{display:inline-block;color:#fff;border-radius:3px;padding:.4mm 2mm;font-weight:700;font-size:8.5pt;white-space:nowrap}.rt{display:inline-block;border:1pt solid;border-radius:3px;padding:.2mm 1.6mm;font-size:8.5pt;font-weight:600;white-space:nowrap}' +
    '.toc a{color:inherit;text-decoration:none}.toc li{margin:.8mm 0}.toc .f{padding-left:4mm}' +
    '.counts{display:flex;gap:3mm;margin:3mm 0}.counts div{flex:1;border-radius:2mm;color:#fff;padding:3mm;text-align:center;font-weight:700}.counts b{display:block;font-size:20pt}' +
    '.bars .row{display:flex;align-items:center;gap:2mm;margin:1mm 0}.bars .lab{width:28mm}.bars .bar{height:4mm;border-radius:1mm}' +
    '.finding{break-before:__FB__}.finding:first-of-type{break-before:auto}.fhead{display:flex;justify-content:space-between;align-items:center;gap:4mm;border-left:5mm solid #999;padding:2mm 3mm;background:#f6f8fb;margin-top:6mm}.fhead h2{border:0;margin:0;padding:0;font-size:13pt}' +
    '.meta td:first-child{width:38mm;font-weight:600;background:#f6f8fb}.short{border:1pt solid __ACC__;background:#f3f7ff;padding:2mm 3mm;margin:2mm 0;border-radius:1.5mm}' +
    '.fsec{break-inside:auto}.fsec h3{color:__ACC__}a{color:__ACC__}' + '__MD__';

  /**
   * Bericht erzeugen.
   * opts: { minSev, includeDrafts, sort, pageBreak, only:[ids], single:true (nur Findings ohne Deckblatt) }
   */
  function build(state, opts) {
    opts = opts || {};
    var pt = state.pentest, P = pt.project, B = state.meta.brand || {};
    var accent = /^#[0-9a-f]{6}$/i.test(B.color || '') ? B.color : '#0b3d91';
    var title = P.reportTitle || L('Penetrationstest-Bericht', 'Penetration test report');
    var foot = P.classification || B.footer || L('VERTRAULICH', 'CONFIDENTIAL');
    var cssStr = function (v) { return String(v || '').replace(/[\\"]/g, '\\$&').replace(/[\r\n]+/g, ' ').replace(/</g, '\\3C '); };
    var css = CSS.replace(/__ACC__/g, accent).replace('__FOOT__', cssStr(foot)).replace('__ORG__', cssStr(P.client || state.meta.org || '')).replace('__TITLE__', cssStr(title + (P.title ? ' – ' + P.title : '')))
      .replace('__FB__', opts.pageBreak === false ? 'auto' : 'page').replace('__MD__', HA.MD.CSS);
    var list = selection(pt, opts);
    var h = ['<!DOCTYPE html><html lang="' + HA.lang + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:">',
      '<title>' + esc(title + (P.title ? ' – ' + P.title : '')) + '</title><style>' + css + '</style></head><body><div class="page">'];

    if (!opts.single) {
      // Deckblatt
      var org = [state.meta.org ? '<b style="font-size:11pt">' + esc(state.meta.org) + '</b>' : '', esc(B.subtitle || ''), esc(B.address || '').replace(/\n/g, '<br>'), esc(B.contact || ''), esc(B.web || '')].filter(Boolean).join('<br>');
      h.push('<div class="cover"><div class="brandbar"><img src="' + esc(B.logo || HA.DEFAULT_LOGO) + '" alt="Logo"><div class="small">' + org + '</div></div>' +
        '<div class="kicker">' + esc(title) + '</div><h1>' + esc(P.title || L('Sicherheitsüberprüfung', 'Security assessment')) + '</h1><div class="sub">' + esc(P.client || '') + '</div>' +
        '<table class="kv"><tbody>' +
        '<tr><td>' + esc(L('Auftraggeber', 'Client')) + '</td><td>' + esc(P.client || '–') + '</td></tr>' +
        '<tr><td>' + esc(L('Prüfzeitraum', 'Test period')) + '</td><td>' + fdate(P.from) + ' – ' + fdate(P.to) + '</td></tr>' +
        '<tr><td>' + esc(L('Prüfansatz', 'Approach')) + '</td><td>' + esc(P.approach || '–') + '</td></tr>' +
        '<tr><td>' + esc(L('Prüfer/innen', 'Testers')) + '</td><td>' + esc(P.testers || state.meta.auditor || '–') + '</td></tr>' +
        '<tr><td>' + esc(L('Version / Status', 'Version / status')) + '</td><td>' + esc(P.version || '1.0') + ' · ' + esc(L((STATUS[P.status] || STATUS.draft)[0], (STATUS[P.status] || STATUS.draft)[1])) + '</td></tr>' +
        '<tr><td>' + esc(L('Datum', 'Date')) + '</td><td>' + fdate(P.date || new Date().toISOString()) + '</td></tr></tbody></table>' +
        '<div class="conf">' + esc(foot) + '</div></div>');
      // Inhaltsverzeichnis
      var toc = ['<h2>' + esc(L('Inhalt', 'Contents')) + '</h2><ol class="toc">'];
      pt.sections.filter(function (s) { return s.on !== false; }).forEach(function (s) {
        toc.push('<li><a href="#s-' + esc(s.id) + '">' + esc(s.title) + '</a>');
        if (s.kind === 'auto' && s.auto === 'findings') toc.push('<ul>' + list.map(function (f) { return '<li class="f"><a href="#f-' + esc(f.id) + '">' + esc(f.id) + ' ' + esc(f.title) + '</a> ' + badge(f.severity) + '</li>'; }).join('') + '</ul>');
        toc.push('</li>');
      });
      toc.push('</ol>');
      h.push('<section style="break-after:page">' + toc.join('') + '</section>');
      pt.sections.filter(function (s) { return s.on !== false; }).forEach(function (s) { h.push(section(state, s, list, opts)); });
    } else {
      h.push(findingsBlock(state, list, opts));
    }
    h.push('<p class="small muted" style="margin-top:10mm">' + esc(L('Erstellt mit Little-RiskBee am ', 'Created with Little-RiskBee on ')) + fdate(new Date().toISOString()) + '</p></div></body></html>');
    return h.join('');
  }

  function section(state, s, list, opts) {
    var pt = state.pentest, P = pt.project, h = ['<section id="s-' + esc(s.id) + '"><h2>' + esc(s.title) + '</h2>'];
    if (s.kind !== 'auto') { h.push(md(s.md, pt.images)); h.push('</section>'); return h.join(''); }
    switch (s.auto) {
      case 'doc':
        h.push('<table class="kv"><tbody><tr><td>' + esc(L('Dokument', 'Document')) + '</td><td>' + esc((P.reportTitle || L('Penetrationstest-Bericht', 'Penetration test report')) + (P.title ? ' – ' + P.title : '')) + '</td></tr>' +
          '<tr><td>Version</td><td>' + esc(P.version || '1.0') + '</td></tr><tr><td>' + esc(L('Status', 'Status')) + '</td><td>' + esc(L((STATUS[P.status] || STATUS.draft)[0], (STATUS[P.status] || STATUS.draft)[1])) + '</td></tr>' +
          '<tr><td>' + esc(L('Erstellt von', 'Author')) + '</td><td>' + esc(P.testers || state.meta.auditor || '–') + '</td></tr><tr><td>' + esc(L('Qualitätssicherung', 'Quality review')) + '</td><td>' + esc(P.reviewer || '–') + '</td></tr>' +
          '<tr><td>' + esc(L('Verteiler', 'Distribution')) + '</td><td>' + esc(P.distribution || '–').replace(/\n/g, '<br>') + '</td></tr><tr><td>' + esc(L('Einstufung', 'Classification')) + '</td><td>' + esc(P.classification || '–') + '</td></tr></tbody></table>');
        if ((P.history || '').trim()) h.push('<h3>' + esc(L('Änderungshistorie', 'Change history')) + '</h3>' + md(P.history));
        break;
      case 'rating':
        h.push('<p>' + esc(L('Die Einstufung der Schwachstellen erfolgt nach dem Common Vulnerability Scoring System (CVSS v3.1, Base Score) und wird bei Bedarf fachlich an den Einsatzkontext angepasst.', 'Vulnerabilities are rated using the Common Vulnerability Scoring System (CVSS v3.1 base score) and adjusted to the context where necessary.')) + '</p>' +
          '<table><thead><tr><th style="width:28mm">' + esc(L('Schweregrad', 'Severity')) + '</th><th style="width:26mm">CVSS</th><th>' + esc(L('Bedeutung', 'Meaning')) + '</th></tr></thead><tbody>' +
          SEV_ORDER.map(function (k) { return '<tr><td>' + badge(k) + '</td><td>' + SEV[k].range + '</td><td>' + esc(L(SEV[k].dDe, SEV[k].dEn)) + '</td></tr>'; }).join('') + '</tbody></table>');
        break;
      case 'overview': {
        var cnt = {}; SEV_ORDER.forEach(function (k) { cnt[k] = 0; }); list.forEach(function (f) { cnt[f.severity || 'info']++; });
        h.push('<div class="counts">' + SEV_ORDER.map(function (k) { return '<div style="background:' + SEV[k].c + '"><b>' + cnt[k] + '</b>' + esc(sevLabel(k)) + '</div>'; }).join('') + '</div>');
        var mx = Math.max.apply(null, SEV_ORDER.map(function (k) { return cnt[k]; })) || 1;
        h.push('<div class="bars">' + SEV_ORDER.map(function (k) { return '<div class="row"><span class="lab">' + esc(sevLabel(k)) + '</span><span class="bar" style="width:' + (cnt[k] / mx * 120).toFixed(1) + 'mm;background:' + SEV[k].c + '"></span><b>' + cnt[k] + '</b></div>'; }).join('') + '</div>');
        h.push('<table><thead><tr><th style="width:15mm">ID</th><th>' + esc(L('Finding', 'Finding')) + '</th><th style="width:22mm">' + esc(L('Schwere', 'Severity')) + '</th><th style="width:12mm">CVSS</th><th style="width:34mm">' + esc(L('Betroffen', 'Affected')) + '</th><th style="width:24mm">Re-Test</th></tr></thead><tbody>' +
          list.map(function (f) { var af = assetNames(state, f.assets).concat(f.targets ? [f.targets.split(/\n/)[0]] : []);
            return '<tr><td><a href="#f-' + esc(f.id) + '"><b>' + esc(f.id) + '</b></a></td><td>' + esc(f.title) + (f.shortRec ? '<div class="small muted">' + esc(f.shortRec.length > 140 ? f.shortRec.slice(0, 140) + '…' : f.shortRec) + '</div>' : '') + '</td><td>' + badge(f.severity) + '</td><td>' + esc(f.cvss || '–') + '</td><td class="small">' + esc(af.join(', ') || '–') + '</td><td>' + rtBadge(f.retestStatus) + '</td></tr>'; }).join('') +
          (list.length ? '' : '<tr><td colspan="6">' + esc(L('Keine Findings.', 'No findings.')) + '</td></tr>') + '</tbody></table>');
        break;
      }
      case 'findings':
        h.push(findingsBlock(state, list, opts));
        break;
      case 'retest':
        h.push('<table><thead><tr><th style="width:15mm">ID</th><th>' + esc(L('Finding', 'Finding')) + '</th><th style="width:22mm">' + esc(L('Schwere', 'Severity')) + '</th><th style="width:28mm">Re-Test</th><th style="width:22mm">' + esc(L('Datum', 'Date')) + '</th><th>' + esc(L('Notiz', 'Note')) + '</th></tr></thead><tbody>' +
          list.map(function (f) { return '<tr><td><b>' + esc(f.id) + '</b></td><td>' + esc(f.title) + '</td><td>' + badge(f.severity) + '</td><td>' + rtBadge(f.retestStatus) + '</td><td>' + fdate(f.retestDate) + '</td><td class="small">' + esc(HA.MD.plain(f.retestNote || '').slice(0, 220)) + '</td></tr>'; }).join('') + '</tbody></table>');
        break;
    }
    h.push('</section>');
    return h.join('');
  }

  function findingsBlock(state, list, opts) {
    var pt = state.pentest, h = [];
    var layout = (pt.layout || []).filter(function (k) { return !(pt.layoutOff || {})[k]; });
    list.forEach(function (f) {
      var s = SEV[f.severity] || SEV.info, af = assetNames(state, f.assets);
      h.push('<article class="finding" id="f-' + esc(f.id) + '"><div class="fhead" style="border-left-color:' + s.c + '"><h2>' + esc(f.id) + ' – ' + esc(f.title) + '</h2>' + badge(f.severity) + '</div>');
      var meta = [[L('Schweregrad', 'Severity'), badge(f.severity) + (f.cvss !== '' && f.cvss !== undefined ? ' &nbsp;CVSS <b>' + esc(f.cvss) + '</b>' : '')]];
      if (f.cvssVector) meta.push([L('CVSS-Vektor', 'CVSS vector'), '<span class="small" style="font-family:monospace">' + esc(f.cvssVector) + '</span>']);
      if (f.cwe || f.owasp) meta.push(['CWE / OWASP', esc([f.cwe, f.owasp ? (HA.OWASP_TOP10.find(function (x) { return x[0] === f.owasp; }) || [0, f.owasp])[1] : ''].filter(Boolean).join(' · '))]);
      if (af.length || f.targets) meta.push([L('Betroffene Systeme', 'Affected systems'), esc(af.join(', ')) + (f.targets ? (af.length ? '<br>' : '') + esc(f.targets).replace(/\n/g, '<br>') : '')]);
      if (f.owner || f.due) meta.push([L('Behebung', 'Remediation'), esc([f.owner, f.due ? L('bis ', 'by ') + fdate(f.due) : ''].filter(Boolean).join(' · '))]);
      meta.push(['Re-Test', rtBadge(f.retestStatus) + (f.retestDate ? ' ' + fdate(f.retestDate) : '') + (f.retestBy ? ' · ' + esc(f.retestBy) : '')]);
      (pt.fields || []).forEach(function (cf) {
        if (cf.type === 'md' || cf.inReport === false) return;
        var v = cfValue(cf, (f.custom || {})[cf.id]); if (v) meta.push([cf.label, v]);
      });
      h.push('<table class="meta"><tbody>' + meta.map(function (m) { return '<tr><td>' + esc(m[0]) + '</td><td>' + m[1] + '</td></tr>'; }).join('') + '</tbody></table>');
      if (f.shortRec) h.push('<div class="short"><b>' + esc(L('Kurz-Empfehlung', 'Short recommendation')) + ':</b> ' + esc(f.shortRec) + '</div>');
      layout.forEach(function (k) {
        var val;
        if (k.indexOf('cf:') === 0) { var cf = (pt.fields || []).find(function (x) { return 'cf:' + x.id === k; }); if (!cf || cf.type !== 'md' || cf.inReport === false) return; val = (f.custom || {})[cf.id]; }
        else val = f[k];
        if (!String(val || '').trim()) return;
        h.push('<div class="fsec"><h3>' + esc(sectionLabel(pt, k)) + '</h3>' + md(val, f.images) + '</div>');
      });
      h.push('</article>');
    });
    if (!list.length) h.push('<p class="muted">' + esc(L('Keine Findings für die gewählten Kriterien.', 'No findings for the selected criteria.')) + '</p>');
    return h.join('');
  }

  /** Alle (oder ausgewählte) Findings als eine Markdown-Datei. */
  function markdown(state, list) {
    var pt = state.pentest, out = ['# ' + (pt.project.title || L('Pentest-Findings', 'Pentest findings')), ''];
    list.forEach(function (f) {
      out.push('## ' + f.id + ' – ' + f.title, '', '| ' + L('Feld', 'Field') + ' | ' + L('Wert', 'Value') + ' |', '|---|---|',
        '| ' + L('Schweregrad', 'Severity') + ' | ' + sevLabel(f.severity) + ' |', '| CVSS | ' + (f.cvss || '–') + ' ' + (f.cvssVector || '') + ' |', '| CWE | ' + (f.cwe || '–') + ' |',
        '| ' + L('Betroffen', 'Affected') + ' | ' + (assetNames(state, f.assets).concat(f.targets ? [f.targets.replace(/\n/g, ', ')] : []).join(', ') || '–') + ' |',
        '| Re-Test | ' + L(RETEST[f.retestStatus || 'open'][0], RETEST[f.retestStatus || 'open'][1]) + ' |', '');
      if (f.shortRec) out.push('**' + L('Kurz-Empfehlung', 'Short recommendation') + ':** ' + f.shortRec, '');
      (pt.layout || []).forEach(function (k) {
        var v = k.indexOf('cf:') === 0 ? (f.custom || {})[k.slice(3)] : f[k];
        if (String(v || '').trim()) out.push('### ' + sectionLabel(pt, k), '', String(v).replace(/\]\(img:[\w-]+\)/g, '](Bild)'), '');
      });
    });
    return out.join('\n');
  }

  return { build: build, markdown: markdown, selection: selection, SEV: SEV, SEV_ORDER: SEV_ORDER, RETEST: RETEST, STATUS: STATUS, MDSECS: MDSECS, sevLabel: sevLabel, md: md };
})();

/* =====================================================================
 * modules/findings.js – Finding-Dashboard (Pentest-Report-Generator)
 * ---------------------------------------------------------------------
 *  • Dashboard: Kennzahlen nach Schweregrad und Re-Test, Filter, Liste,
 *    Import (JSON, CSV, aus Schwachstellenscans), Export (JSON, CSV, Markdown).
 *  • Editor je Finding: Stammdaten (Schweregrad, CVSS-Rechner v3.1, CWE,
 *    OWASP, betroffene Assets/Ziele, Verantwortung, Frist, Re-Test) und
 *    Markdown-Abschnitte (Zusammenfassung, technische Beschreibung,
 *    Auswirkung, Reproduktion/PoC, Nachweise, Empfehlung, Kurz-Empfehlung,
 *    Referenzen, Re-Test-Notiz) – links Markdown, rechts Live-Vorschau,
 *    Bilder per Knopf oder Einfügen (Strg+V).
 *  • Zwischenspeichern mit Versionsstand (Wiederherstellen möglich);
 *    zusätzlich speichert Little-RiskBee jede Änderung automatisch.
 *  • Eigene Felder und eigene Berichtsabschnitte, Reihenfolge frei wählbar.
 *  • Vorlagen (mitgeliefert + eigene).
 *  • Finding als eigene Maßnahme zu einem bestehenden oder neuen Asset
 *    hinzufügen; Re-Test „behoben“ markiert die Maßnahme als umgesetzt/wirksam.
 *  • Bericht: DIN A4 drucken, als HTML speichern oder als PDF (Druckdialog).
 * Datenmodell: state.pentest = { seq, project, sections[], fields[], layout[],
 *   layoutOff{}, findings[], templates[], images{}, report{} }
 * ===================================================================== */
window.HA = window.HA || {};

HA.Findings = (function () {
  'use strict';
  var A = HA.App, K = HA.Kit, L = K.L, esc = A.esc, t = HA.t, R = HA.PTReport;
  var U = { tab: 'list', id: null, sec: 'summary', q: '', sev: '', st: '', rt: '', psec: null, mode: 'split' };
  function S() { return A.state(); }
  function P() { return S().pentest; }
  K.addI18n({ 'nav.findings': 'Finding-Dashboard', 'rm.kind.pentest': 'Pentest-Finding' }, { 'nav.findings': 'Finding dashboard', 'rm.kind.pentest': 'Pentest finding' });

  /* ------------------------------------------------------------------
   * Standardwerte
   * ---------------------------------------------------------------- */
  function defaultSections() {
    return [
      { id: 'doc', title: L('Dokumentenkontrolle', 'Document control'), kind: 'auto', auto: 'doc', on: true },
      { id: 'mgmt', title: L('Management Summary', 'Management summary'), kind: 'md', on: true, md: L('## Ausgangslage\n\nIm Auftrag von **AUFTRAGGEBER** wurde im Zeitraum vom TT.MM. bis TT.MM.JJJJ ein Penetrationstest der folgenden Systeme durchgeführt: …\n\n## Gesamtergebnis\n\nDas Sicherheitsniveau wird insgesamt als **mittel** eingeschätzt. Es wurden X kritische und Y hohe Schwachstellen identifiziert, …\n\n## Wichtigste Empfehlungen\n\n1. …\n2. …\n3. …',
        '## Background\n\nOn behalf of **CLIENT**, a penetration test of the following systems was conducted between … and …\n\n## Overall result\n\n…\n\n## Key recommendations\n\n1. …') },
      { id: 'scope', title: L('Umfang und Zielsetzung', 'Scope and objectives'), kind: 'md', on: true, md: L('| Ziel | Adresse / Umfang | Bemerkung |\n|---|---|---|\n| Webanwendung | https://… | Grey-Box, Testkonten Rolle „Benutzer“ |\n| Server | 10.0.0.0/24 | intern |\n\n**Nicht im Umfang:** Denial-of-Service-Tests, Social Engineering.',
        '| Target | Address / scope | Note |\n|---|---|---|\n| Web application | https://… | grey box |\n\n**Out of scope:** denial of service, social engineering.') },
      { id: 'method', title: L('Vorgehensweise und Methodik', 'Approach and methodology'), kind: 'md', on: true, md: L('Der Test orientierte sich am **Durchführungskonzept für Penetrationstests des BSI**, am **OWASP Web Security Testing Guide** sowie am **PTES**. Phasen:\n\n1. Vorbereitung und Informationsbeschaffung\n2. Bewertung der Informationen / Schwachstellenanalyse\n3. Aktive Eindringversuche (manuell und werkzeuggestützt)\n4. Abschlussanalyse und Bericht\n\nEingesetzte Werkzeuge (Auszug): Nmap, Burp Suite, testssl.sh, OpenVAS/Greenbone, Nuclei.',
        'The test followed the **BSI penetration testing concept**, the **OWASP Web Security Testing Guide** and **PTES**.') },
      { id: 'rating', title: L('Bewertungsschema', 'Rating scheme'), kind: 'auto', auto: 'rating', on: true },
      { id: 'overview', title: L('Ergebnisübersicht', 'Summary of findings'), kind: 'auto', auto: 'overview', on: true },
      { id: 'findings', title: L('Findings im Detail', 'Detailed findings'), kind: 'auto', auto: 'findings', on: true },
      { id: 'retest', title: L('Re-Test-Übersicht', 'Retest overview'), kind: 'auto', auto: 'retest', on: false },
      { id: 'disclaimer', title: L('Haftungsausschluss', 'Disclaimer'), kind: 'md', on: true, md: L('Ein Penetrationstest ist eine Momentaufnahme. Die Ergebnisse beziehen sich auf den genannten Zeitraum und Umfang; das Fehlen weiterer Befunde bedeutet nicht, dass keine weiteren Schwachstellen existieren.',
        'A penetration test is a snapshot. Results refer to the stated period and scope; the absence of further findings does not mean no further vulnerabilities exist.') }
    ];
  }
  A.ext.normalize.push(normPentest);
  function normPentest(s) {
    var p = s.pentest = s.pentest || {};
    p.project = Object.assign({ reportTitle: '', title: '', client: '', from: '', to: '', approach: 'Grey-Box', testers: '', reviewer: '', version: '1.0', status: 'draft', date: '', classification: '', distribution: '', history: '' }, p.project || {});
    if (!Array.isArray(p.sections) || !p.sections.length) p.sections = defaultSections();
    if (!Array.isArray(p.fields)) p.fields = [];
    if (!Array.isArray(p.findings)) p.findings = [];
    if (!Array.isArray(p.templates)) p.templates = [];
    p.images = p.images || {}; p.layoutOff = p.layoutOff || {};
    p.report = Object.assign({ minSev: 'info', includeDrafts: true, sort: 'severity', pageBreak: true }, p.report || {});
    var keys = R.MDSECS.map(function (x) { return x[0]; }).concat(p.fields.filter(function (f) { return f.type === 'md'; }).map(function (f) { return 'cf:' + f.id; }));
    if (!Array.isArray(p.layout)) p.layout = [];
    p.layout = p.layout.filter(function (k) { return keys.indexOf(k) >= 0; });
    keys.forEach(function (k) { if (p.layout.indexOf(k) < 0) p.layout.push(k); });
    p.seq = p.seq || (p.findings.length + 1);
    p.findings.forEach(fixFinding);
  }
  function fixFinding(f) {
    ['assets', 'measures', 'history'].forEach(function (k) { if (!Array.isArray(f[k])) f[k] = []; });
    f.custom = f.custom || {}; f.images = f.images || {};
    if (!f.severity) f.severity = 'medium';
    if (!f.retestStatus) f.retestStatus = 'open';
    if (!f.status) f.status = 'draft';
    if (f.include === undefined) f.include = true;
  }
  function newFinding(pre) {
    var p = P(), f = Object.assign({ title: L('Neues Finding', 'New finding'), severity: 'medium', cvss: '', cvssVector: '', cwe: '', owasp: '', status: 'draft', include: true, assets: [], targets: '', tags: '',
      tester: S().meta.auditor || '', found: K.today(), owner: '', due: '', shortRec: '', summary: '', description: '', impact: '', steps: '', evidence: '', recommendation: '', references: '',
      retestStatus: 'open', retestDate: '', retestBy: '', retestNote: '', custom: {}, images: {}, measures: [], history: [] }, pre || {});
    f.id = 'F-' + ('00' + (p.seq++)).slice(-3);
    while (p.findings.some(function (x) { return x.id === f.id; })) f.id = 'F-' + ('00' + (p.seq++)).slice(-3);
    f.created = f.updated = new Date().toISOString();
    fixFinding(f); p.findings.push(f);
    return f;
  }
  function byId(id) { return P().findings.find(function (f) { return f.id === id; }); }
  function cur() { return U.id ? byId(U.id) : null; }
  function touch(f) { f.updated = new Date().toISOString(); A.save(); }

  /* ------------------------------------------------------------------
   * CVSS v3.1 (Base Score) – Formel nach FIRST-Spezifikation
   * ---------------------------------------------------------------- */
  var CV = [
    ['AV', ['Angriffsvektor', 'Attack vector'], [['N', ['Netzwerk', 'Network']], ['A', ['Angrenzendes Netz', 'Adjacent']], ['L', ['Lokal', 'Local']], ['P', ['Physisch', 'Physical']]]],
    ['AC', ['Angriffskomplexität', 'Attack complexity'], [['L', ['niedrig', 'low']], ['H', ['hoch', 'high']]]],
    ['PR', ['Benötigte Rechte', 'Privileges required'], [['N', ['keine', 'none']], ['L', ['niedrig', 'low']], ['H', ['hoch', 'high']]]],
    ['UI', ['Nutzerinteraktion', 'User interaction'], [['N', ['keine', 'none']], ['R', ['erforderlich', 'required']]]],
    ['S', ['Auswirkungsbereich (Scope)', 'Scope'], [['U', ['unverändert', 'unchanged']], ['C', ['verändert', 'changed']]]],
    ['C', ['Vertraulichkeit', 'Confidentiality'], [['N', ['keine', 'none']], ['L', ['niedrig', 'low']], ['H', ['hoch', 'high']]]],
    ['I', ['Integrität', 'Integrity'], [['N', ['keine', 'none']], ['L', ['niedrig', 'low']], ['H', ['hoch', 'high']]]],
    ['A', ['Verfügbarkeit', 'Availability'], [['N', ['keine', 'none']], ['L', ['niedrig', 'low']], ['H', ['hoch', 'high']]]]
  ];
  function roundup(x) { var i = Math.round(x * 100000); return i % 10000 === 0 ? i / 100000 : (Math.floor(i / 10000) + 1) / 10; }
  function cvssScore(m) {
    var W = { AV: { N: .85, A: .62, L: .55, P: .2 }, AC: { L: .77, H: .44 }, UI: { N: .85, R: .62 }, CIA: { H: .56, L: .22, N: 0 } };
    var changed = m.S === 'C', pr = { N: .85, L: changed ? .68 : .62, H: changed ? .5 : .27 }[m.PR];
    var iss = 1 - (1 - W.CIA[m.C]) * (1 - W.CIA[m.I]) * (1 - W.CIA[m.A]);
    var imp = changed ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15) : 6.42 * iss;
    var expl = 8.22 * W.AV[m.AV] * W.AC[m.AC] * pr * W.UI[m.UI];
    if (imp <= 0) return 0;
    return changed ? roundup(Math.min(1.08 * (imp + expl), 10)) : roundup(Math.min(imp + expl, 10));
  }
  function parseVector(v) {
    var m = {}, ok = true;
    String(v || '').replace(/^CVSS:3\.[01]\//, '').split('/').forEach(function (p) { var kv = p.split(':'); if (kv.length === 2) m[kv[0]] = kv[1]; });
    CV.forEach(function (c) { if (!c[2].some(function (o) { return o[0] === m[c[0]]; })) ok = false; });
    return ok ? m : null;
  }
  function vectorOf(m) { return 'CVSS:3.1/' + CV.map(function (c) { return c[0] + ':' + m[c[0]]; }).join('/'); }
  function sevFromScore(s) { s = +s; return s >= 9 ? 'critical' : s >= 7 ? 'high' : s >= 4 ? 'medium' : s > 0 ? 'low' : 'info'; }
  function cvssDialog(f) {
    var m = parseVector(f.cvssVector) || { AV: 'N', AC: 'L', PR: 'N', UI: 'N', S: 'U', C: 'L', I: 'L', A: 'N' };
    var body = '<div class="grid grid-2">' + CV.map(function (c) {
      return '<div class="field"><label>' + esc(K.lab(c[1])) + ' (' + c[0] + ')</label><div class="seg" role="radiogroup">' + c[2].map(function (o) {
        return '<label class="seg-opt"><input type="radio" name="' + c[0] + '" value="' + o[0] + '"' + (m[c[0]] === o[0] ? ' checked' : '') + '><span>' + esc(K.lab(o[1])) + '</span></label>'; }).join('') + '</div></div>';
    }).join('') + '</div><div class="cvss-out" id="cvssOut"></div><label style="font-weight:400"><input type="checkbox" name="takeSev" checked> ' + esc(L('Schweregrad aus dem Score übernehmen', 'Take severity from score')) + '</label>' +
      '<p class="small muted">' + esc(L('CVSS v3.1 Base Score nach der Spezifikation von FIRST. Umwelt- und Zeitmetriken bitte bei Bedarf in der Beschreibung begründen.', 'CVSS v3.1 base score per FIRST specification. Justify environmental/temporal adjustments in the description if needed.')) + '</p>';
    var form = A.dialog(L('CVSS-Rechner (v3.1)', 'CVSS calculator (v3.1)'), body, function (fm) {
      var mm = read(fm), sc = cvssScore(mm);
      f.cvss = sc.toFixed(1); f.cvssVector = vectorOf(mm);
      if (fm.querySelector('[name=takeSev]').checked) f.severity = sevFromScore(sc);
      touch(f); A.render();
    }, L('Übernehmen', 'Apply'));
    form.classList.add('dlg-wide');
    function read(fm) { var o = {}; CV.forEach(function (c) { var x = fm.querySelector('[name=' + c[0] + ']:checked'); o[c[0]] = x ? x.value : c[2][0][0]; }); return o; }
    function upd() { var mm = read(form), sc = cvssScore(mm), sv = sevFromScore(sc); form.querySelector('#cvssOut').innerHTML = '<b style="font-size:1.6rem">' + sc.toFixed(1) + '</b> ' + sevPill(sv) + '<div class="mono small">' + esc(vectorOf(mm)) + '</div>'; }
    form.addEventListener('change', upd); upd();
  }

  /* ------------------------------------------------------------------
   * Kleine Anzeige-Helfer
   * ---------------------------------------------------------------- */
  function sevPill(k) { var s = R.SEV[k] || R.SEV.info; return '<span class="badge" style="background:' + s.c + ';border-color:' + s.c + ';color:#fff">' + esc(R.sevLabel(k)) + '</span>'; }
  function rtPill(k) { var r = R.RETEST[k || 'open']; return '<span class="badge" style="border-color:' + r[2] + ';color:' + r[2] + ';background:transparent">' + esc(L(r[0], r[1])) + '</span>'; }
  function stLabel(k) { var s = R.STATUS[k] || R.STATUS.draft; return L(s[0], s[1]); }
  function secLabel(k) { var s = R.MDSECS.find(function (x) { return x[0] === k; }); if (s) return K.lab(s[1]); var f = P().fields.find(function (x) { return 'cf:' + x.id === k; }); return f ? f.label : k; }
  function valOf(f, k) { return k.indexOf('cf:') === 0 ? (f.custom[k.slice(3)] || '') : (f[k] || ''); }
  function assetName(id) { var a = S().assets.find(function (x) { return x.id === id; }); return a ? a.name : null; }
  /** Markdown-CSS einmalig in die Seite einbinden. */
  (function () { var st = document.createElement('style'); st.id = 'mdCss'; st.textContent = HA.MD.CSS; document.head.appendChild(st); })();

  /* ------------------------------------------------------------------
   * Ansicht
   * ---------------------------------------------------------------- */
  function view() {
    if (U.tab === 'edit' && !cur()) U.tab = 'list';
    var h = [K.pageHead(t('nav.findings'), L('Pentest-Findings erfassen, bewerten und als professionellen Bericht ausgeben – mit Markdown-Editor, eigenen Feldern und Abschnitten, Re-Test und Übernahme als Maßnahme.',
      'Record and rate pentest findings and produce a professional report – with markdown editor, custom fields and sections, retest and transfer to measures.'),
      K.btn('ptTpl', '📑 ' + L('Aus Vorlage', 'From template')) + K.btn('ptNew', '+ ' + L('Neues Finding', 'New finding'), { cls: 'btn-primary' }))];
    var tabs = [['list', ['Übersicht', 'Overview']]];
    if (cur()) tabs.push(['edit', ['Editor: ' + U.id, 'Editor: ' + U.id]]);
    tabs.push(['layout', ['Berichtsaufbau, Felder & Vorlagen', 'Report layout, fields & templates']], ['report', ['Bericht & Export', 'Report & export']]);
    h.push(K.tabs('ptTab', tabs, U.tab));
    if (U.tab === 'edit') h.push(editor());
    else if (U.tab === 'layout') h.push(layoutView());
    else if (U.tab === 'report') h.push(reportView());
    else h.push(listView());
    h.push('<input type="file" id="ptFile" data-act="ptFile" accept=".json,.csv,application/json,text/csv" hidden><input type="file" id="ptImg" data-act="ptImgFile" accept="image/png,image/jpeg,image/webp,image/gif" hidden>');
    return h.join('');
  }

  /* ---------- Übersicht ---------- */
  function listView() {
    var p = P(), all = p.findings, h = [];
    var cnt = {}; R.SEV_ORDER.forEach(function (k) { cnt[k] = 0; }); all.forEach(function (f) { cnt[f.severity]++; });
    var rt = {}; Object.keys(R.RETEST).forEach(function (k) { rt[k] = 0; }); all.forEach(function (f) { rt[f.retestStatus]++; });
    h.push('<div class="pt-sev-grid">' + R.SEV_ORDER.map(function (k) {
      return '<button type="button" class="card stat pt-sev-tile' + (U.sev === k ? ' on' : '') + '" data-act="ptSevFilter" data-id="' + k + '" style="border-top:5px solid ' + R.SEV[k].c + '"><div class="value" style="color:' + R.SEV[k].c + '">' + cnt[k] + '</div><div class="label">' + esc(R.sevLabel(k)) + '</div></button>'; }).join('') +
      '<div class="card stat" style="border-top:5px solid #1a7f37"><div class="value">' + rt.fixed + ' / ' + all.length + '</div><div class="label">' + esc(L('im Re-Test behoben', 'fixed in retest')) + '</div></div></div>');
    if (all.length) {
      h.push('<div class="card"><div class="pt-stack" title="' + esc(L('Verteilung nach Schweregrad', 'Distribution by severity')) + '">' + R.SEV_ORDER.filter(function (k) { return cnt[k]; }).map(function (k) {
        return '<span style="flex:' + cnt[k] + ';background:' + R.SEV[k].c + '">' + cnt[k] + '</span>'; }).join('') + '</div><div class="row small" style="margin-top:.5rem;gap:.4rem">' +
        Object.keys(R.RETEST).filter(function (k) { return rt[k]; }).map(function (k) { return rtPill(k) + ' ' + rt[k]; }).join(' · ') + ' · ' +
        Object.keys(R.STATUS).map(function (k) { return esc(stLabel(k)) + ': ' + all.filter(function (f) { return f.status === k; }).length; }).join(' · ') + '</div></div>');
    }
    h.push('<div class="card no-print"><div class="filters">' +
      '<div style="grid-column:span 2"><label>' + esc(t('c.search')) + '</label><input type="search" data-act="ptQ" value="' + esc(U.q) + '" placeholder="F-001, SQL, CWE-89, Host …"></div>' +
      '<div><label>' + esc(L('Schweregrad', 'Severity')) + '</label><select data-act="ptFilter" data-k="sev">' + A.opt('', t('c.all'), U.sev) + R.SEV_ORDER.map(function (k) { return A.opt(k, R.sevLabel(k), U.sev); }).join('') + '</select></div>' +
      '<div><label>' + esc(L('Status', 'Status')) + '</label><select data-act="ptFilter" data-k="st">' + A.opt('', t('c.all'), U.st) + Object.keys(R.STATUS).map(function (k) { return A.opt(k, stLabel(k), U.st); }).join('') + '</select></div>' +
      '<div><label>Re-Test</label><select data-act="ptFilter" data-k="rt">' + A.opt('', t('c.all'), U.rt) + Object.keys(R.RETEST).map(function (k) { return A.opt(k, L(R.RETEST[k][0], R.RETEST[k][1]), U.rt); }).join('') + '</select></div></div>' +
      '<div class="row" style="margin-top:.6rem">' + K.btn('ptImport', '⬆ ' + L('Import (JSON/CSV)', 'Import (JSON/CSV)')) + K.btn('ptFromScan', '🔎 ' + L('Aus Schwachstellenscan übernehmen', 'Take over from vulnerability scan')) +
      K.btn('ptExport', '⬇ JSON', { k: 'json' }) + K.btn('ptExport', '⬇ CSV', { k: 'csv' }) + K.btn('ptExport', '⬇ Markdown', { k: 'md' }) + '</div></div>');
    var q = U.q.toLowerCase();
    var list = all.filter(function (f) {
      return (!U.sev || f.severity === U.sev) && (!U.st || f.status === U.st) && (!U.rt || f.retestStatus === U.rt) &&
        (!q || [f.id, f.title, f.cwe, f.owasp, f.targets, f.tags, f.shortRec, f.assets.map(assetName).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0);
    }).sort(function (a, b) { return R.SEV[b.severity].rank - R.SEV[a.severity].rank || (+b.cvss || 0) - (+a.cvss || 0) || a.id.localeCompare(b.id, undefined, { numeric: true }); });
    if (!all.length) {
      h.push('<div class="card"><h2>' + esc(L('Noch keine Findings', 'No findings yet')) + '</h2><p>' + esc(L('Legen Sie ein neues Finding an, starten Sie mit einer Vorlage (z. B. SQL-Injection, XSS, veraltete TLS-Versionen) oder übernehmen Sie Befunde aus einem importierten OpenVAS-/Lynis-Scan.',
        'Create a new finding, start from a template or take over results from an imported OpenVAS/Lynis scan.')) + '</p><div class="row">' + K.btn('ptNew', '+ ' + L('Neues Finding', 'New finding'), { cls: 'btn-primary' }) + K.btn('ptTpl', '📑 ' + L('Aus Vorlage', 'From template')) + '</div></div>');
      return h.join('');
    }
    h.push('<div class="card">' + K.table(['ID', { l: ['Finding', 'Finding'], w: 260 }, L('Schwere', 'Severity'), 'CVSS', L('Betroffen', 'Affected'), L('Status', 'Status'), 'Re-Test', L('Maßn.', 'Meas.'), L('geändert', 'updated'), ''], list.map(function (f) {
      var af = f.assets.map(assetName).filter(Boolean).concat(f.targets ? [f.targets.split('\n')[0]] : []);
      return '<tr' + (f.include === false ? ' style="opacity:.55"' : '') + '><td class="mono nowrap"><a href="#findings" data-act="ptEdit" data-id="' + esc(f.id) + '"><b>' + esc(f.id) + '</b></a></td>' +
        '<td><a href="#findings" data-act="ptEdit" data-id="' + esc(f.id) + '"><b>' + esc(f.title) + '</b></a>' + (f.shortRec ? '<div class="small muted">' + esc(K.clip(f.shortRec, 140)) + '</div>' : '') +
        (f.tags ? '<div class="small">' + f.tags.split(/[,;]\s*/).filter(Boolean).map(function (x) { return '<span class="tag">' + esc(x) + '</span>'; }).join(' ') + '</div>' : '') + '</td>' +
        '<td>' + sevPill(f.severity) + '</td><td class="num">' + esc(f.cvss || '–') + '</td><td class="small">' + esc(K.clip(af.join(', '), 80) || '–') + '</td><td class="small">' + esc(stLabel(f.status)) + (f.include === false ? '<div class="muted">' + esc(L('nicht im Bericht', 'not in report')) + '</div>' : '') + '</td>' +
        '<td>' + rtPill(f.retestStatus) + '</td><td class="num">' + (f.measures.length || '–') + '</td><td class="small nowrap">' + A.fmtDate(f.updated) + '</td>' +
        '<td class="nowrap">' + K.btn('ptEdit', '✏️', { id: f.id, cls: 'btn-sm', title: t('btn.edit') }) + ' ' + K.btn('ptDup', '⧉', { id: f.id, cls: 'btn-sm', title: L('Duplizieren', 'Duplicate') }) + ' ' +
        K.btn('ptPrintOne', '🖨', { id: f.id, cls: 'btn-sm', title: L('Finding drucken / PDF', 'Print finding / PDF') }) + ' ' + K.btn('ptDel', '🗑', { id: f.id, cls: 'btn-sm btn-danger', title: t('btn.delete') }) + '</td></tr>';
    }), 'risk-table', '75vh') + '<div class="small muted" style="margin-top:.4rem">' + esc(L(list.length + ' von ' + all.length + ' Findings', list.length + ' of ' + all.length + ' findings')) + '</div></div>');
    return h.join('');
  }

  /* ---------- Editor ---------- */
  function mdTabs(f) {
    var keys = P().layout.slice();
    return '<div class="pt-sectabs" role="tablist">' + keys.map(function (k) {
      var filled = String(valOf(f, k)).trim() !== '';
      return '<button type="button" role="tab" aria-selected="' + (U.sec === k) + '" class="' + (U.sec === k ? 'on' : '') + '" data-act="ptSec" data-id="' + esc(k) + '"><span class="dot' + (filled ? ' filled' : '') + '"></span>' + esc(secLabel(k)) + '</button>';
    }).join('') + '<button type="button" role="tab" class="' + (U.sec === '_all' ? 'on' : '') + '" data-act="ptSec" data-id="_all">👁 ' + esc(L('Gesamtvorschau', 'Full preview')) + '</button></div>';
  }
  /** Markdown-Editor mit Werkzeugleiste und Live-Vorschau (links Text, rechts Vorschau). */
  function splitEditor(field, key, value, images, ph) {
    var tools = [['bold', 'B', ['Fett (Strg+B)', 'Bold (Ctrl+B)']], ['italic', 'I', ['Kursiv (Strg+I)', 'Italic (Ctrl+I)']], ['code', '</>', ['Code', 'Code']], ['h2', 'H2', ['Überschrift', 'Heading']], ['h3', 'H3', ['Unterüberschrift', 'Subheading']],
      ['ul', '• ', ['Aufzählung', 'Bullet list']], ['ol', '1.', ['Nummerierte Liste', 'Numbered list']], ['task', '☑', ['Aufgabenliste', 'Task list']], ['quote', '❝', ['Zitat', 'Quote']], ['link', '🔗', ['Link', 'Link']],
      ['block', '{ }', ['Codeblock', 'Code block']], ['table', '▦', ['Tabelle', 'Table']], ['hr', '—', ['Trennlinie', 'Horizontal rule']]];
    return '<div class="md-editor">' +
      '<div class="md-toolbar" role="toolbar" aria-label="Markdown">' + tools.map(function (x) { return '<button type="button" class="btn btn-sm" data-act="mdTool" data-k="' + x[0] + '" title="' + esc(K.lab(x[2])) + '" aria-label="' + esc(K.lab(x[2])) + '">' + esc(x[1]) + '</button>'; }).join('') +
      '<button type="button" class="btn btn-sm" data-act="ptImg" title="' + esc(L('Bild einfügen (auch per Strg+V)', 'Insert image (also Ctrl+V)')) + '">🖼 ' + esc(L('Bild', 'Image')) + '</button>' +
      '<span class="md-modes">' + [['edit', ['Editor', 'Editor']], ['split', ['Beides', 'Both']], ['prev', ['Vorschau', 'Preview']]].map(function (x) {
        return '<button type="button" class="btn btn-sm' + (U.mode === x[0] ? ' btn-primary' : '') + '" data-act="mdMode" data-id="' + x[0] + '">' + esc(K.lab(x[1])) + '</button>'; }).join('') + '</span></div>' +
      '<div class="md-split mode-' + U.mode + '"><textarea id="mdArea" class="md-area" spellcheck="true" data-field="' + field + '" data-k="' + esc(key) + '" placeholder="' + esc(ph || '') + '" aria-label="Markdown">' + esc(value || '') + '</textarea>' +
      '<div id="mdPrev" class="md-prev" aria-live="polite">' + R.md(value, images) + '</div></div>' +
      '<div class="small muted md-help">' + esc(L('Markdown: **fett**, *kursiv*, `Code`, ```Codeblock```, - Liste, 1. Liste, > Zitat, | Tabelle |, [Link](https://…). Bilder per 🖼 oder Strg+V einfügen – sie bleiben lokal gespeichert.',
        'Markdown: **bold**, *italic*, `code`, ```block```, - list, 1. list, > quote, | table |, [link](https://…). Insert images via 🖼 or Ctrl+V – they are stored locally.')) + '</div></div>';
  }
  var PH = {
    summary: ['Kurz und verständlich für das Management: Was ist das Problem, warum ist es relevant?', 'Short and clear for management: what is the problem and why does it matter?'],
    description: ['Technische Details: betroffene Komponente, Parameter, Ursache, Ablauf …', 'Technical details: component, parameter, root cause, flow …'],
    impact: ['Was können Angreifende erreichen? Welche Daten/Prozesse sind betroffen?', 'What can attackers achieve? Which data/processes are affected?'],
    steps: ['1. Anfrage …\n2. Parameter …\n\n```http\nGET /… HTTP/1.1\n```', '1. Request …\n2. Parameter …'],
    evidence: ['Screenshots, Antworten, Logauszüge (Bilder per Strg+V einfügen)', 'Screenshots, responses, log excerpts (paste images with Ctrl+V)'],
    recommendation: ['Konkrete, priorisierte Maßnahmen zur Behebung …', 'Concrete, prioritised remediation steps …'],
    references: ['- OWASP …\n- CWE-…\n- Herstellerhinweis …', '- OWASP …\n- CWE-…'],
    retestNote: ['Ergebnis des Re-Tests: Was wurde geprüft, mit welchem Ergebnis?', 'Retest result: what was checked, with which result?']
  };
  function editor() {
    var f = cur(), p = P(), s = S(), h = [];
    var hist = f.history.length;
    h.push('<div class="card pt-head"><div class="pt-titlebar"><span class="mono pt-id">' + esc(f.id) + '</span><input type="text" class="pt-title" data-field="pf" data-k="title" value="' + esc(f.title) + '" aria-label="' + esc(L('Titel', 'Title')) + '"></div>' +
      '<div class="row" style="margin-top:.6rem;align-items:flex-end">' +
      '<div class="field" style="margin:0"><label>' + esc(L('Schweregrad', 'Severity')) + '</label><select data-act="pfSel" data-k="severity" class="pt-sev-sel" style="border-left:6px solid ' + R.SEV[f.severity].c + '">' + R.SEV_ORDER.map(function (k) { return A.opt(k, R.sevLabel(k), f.severity); }).join('') + '</select></div>' +
      '<div class="field" style="margin:0;max-width:90px"><label>CVSS</label><input type="number" min="0" max="10" step="0.1" data-field="pf" data-k="cvss" value="' + esc(f.cvss) + '"></div>' +
      '<div class="field" style="margin:0;flex:1;min-width:220px"><label>' + esc(L('CVSS-Vektor', 'CVSS vector')) + '</label><div class="field-inline"><input type="text" class="mono" data-field="pfVec" data-k="cvssVector" value="' + esc(f.cvssVector) + '" placeholder="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H">' +
      K.btn('ptCvss', '🧮 ' + L('Rechner', 'Calculator'), { cls: 'btn-sm' }) + '</div></div>' +
      '<div class="field" style="margin:0"><label>' + esc(L('Status', 'Status')) + '</label><select data-act="pfSel" data-k="status">' + Object.keys(R.STATUS).map(function (k) { return A.opt(k, stLabel(k), f.status); }).join('') + '</select></div>' +
      '<label style="font-weight:400;align-self:center"><input type="checkbox" data-act="pfChk" data-k="include"' + (f.include !== false ? ' checked' : '') + '> ' + esc(L('im Bericht', 'in report')) + '</label></div>' +
      '<div class="row" style="margin-top:.7rem">' + K.btn('ptSnap', '💾 ' + L('Zwischenspeichern', 'Save draft'), { cls: 'btn-primary', title: L('Stand als Version sichern (Änderungen werden zusätzlich automatisch gespeichert)', 'Save state as version (changes are also saved automatically)') }) +
      K.btn('ptHist', '🕑 ' + L('Versionen', 'Versions') + ' (' + hist + ')', { disabled: !hist }) + K.btn('ptMeasure', '➕ ' + L('Als Maßnahme zu Asset', 'Add as measure to asset')) +
      K.btn('ptPrintOne', '🖨 ' + L('Drucken / PDF', 'Print / PDF'), { id: f.id }) + K.btn('ptHtmlOne', '⬇ HTML', { id: f.id }) + K.btn('ptDup', '⧉ ' + L('Duplizieren', 'Duplicate'), { id: f.id }) +
      K.btn('ptSaveTpl', '⭐ ' + L('Als Vorlage', 'As template')) + K.btn('ptDel', '🗑', { id: f.id, cls: 'btn-danger', title: t('btn.delete') }) +
      '<span class="small muted" id="ptSaved">' + esc(f.savedAt ? L('zwischengespeichert ', 'draft saved ') + A.fmtDate(f.savedAt, true) : L('Änderungen werden automatisch gespeichert', 'changes are saved automatically')) + '</span></div></div>');
    // Stammdaten
    var assetChips = s.assets.length ? s.assets.map(function (a) { return '<label class="chip-check"><input type="checkbox" data-act="pfAsset" value="' + esc(a.id) + '"' + (f.assets.indexOf(a.id) >= 0 ? ' checked' : '') + '> ' + esc(a.name) + '</label>'; }).join('') : '<span class="small muted">' + esc(L('keine Assets angelegt', 'no assets yet')) + '</span>';
    var inp = function (k, label, type, extra) { return '<div class="field"><label>' + esc(K.lab(label)) + '</label><input type="' + (type || 'text') + '" data-field="pf" data-k="' + k + '" value="' + esc(f[k]) + '"' + (extra || '') + '></div>'; };
    h.push('<details class="card" open><summary><b>' + esc(L('Stammdaten, Betroffenheit und Re-Test', 'Details, affected systems and retest')) + '</b></summary><div class="grid grid-4" style="margin-top:.6rem">' +
      inp('cwe', ['CWE', 'CWE'], 'text', ' placeholder="CWE-79" list="dlCwe"') +
      '<div class="field"><label>OWASP Top 10</label><select data-act="pfSel" data-k="owasp">' + A.opt('', '–', f.owasp) + HA.OWASP_TOP10.map(function (x) { return A.opt(x[0], x[1], f.owasp); }).join('') + '</select></div>' +
      inp('tester', ['Gefunden von', 'Found by'], 'text', ' data-person="1"') + inp('found', ['Gefunden am', 'Found on'], 'date') +
      inp('owner', ['Verantwortlich (Behebung)', 'Responsible (remediation)'], 'text', ' data-person="1"') + inp('due', ['Behebungsfrist', 'Remediation due'], 'date') +
      inp('tags', ['Tags (kommagetrennt)', 'Tags (comma separated)']) + '<div></div>' +
      '<div class="field" style="grid-column:1/-1"><label>' + esc(L('Kurz-Empfehlung (ein Satz für Übersichten)', 'Short recommendation (one sentence for overviews)')) + '</label><input type="text" data-field="pf" data-k="shortRec" value="' + esc(f.shortRec) + '" maxlength="300"></div>' +
      '<div class="field" style="grid-column:1/-1"><label>' + esc(L('Betroffene Assets', 'Affected assets')) + '</label><div class="chips">' + assetChips + '</div></div>' +
      '<div class="field" style="grid-column:1/-1"><label>' + esc(L('Betroffene Ziele (URL, Host:Port, Endpunkt – eine Zeile je Ziel)', 'Affected targets (URL, host:port, endpoint – one per line)')) + '</label><textarea data-field="pf" data-k="targets" rows="2" class="mono">' + esc(f.targets) + '</textarea></div>' +
      '<div class="field"><label>Re-Test-Status</label><select data-act="pfSel" data-k="retestStatus" style="border-left:6px solid ' + R.RETEST[f.retestStatus][2] + '">' + Object.keys(R.RETEST).map(function (k) { return A.opt(k, L(R.RETEST[k][0], R.RETEST[k][1]), f.retestStatus); }).join('') + '</select></div>' +
      inp('retestDate', ['Re-Test am', 'Retest on'], 'date') + inp('retestBy', ['Re-Test durch', 'Retest by'], 'text', ' data-person="1"') + '<div></div>' +
      customMetaFields(f) + '</div><datalist id="dlCwe">' + ['CWE-79', 'CWE-89', 'CWE-200', 'CWE-284', 'CWE-287', 'CWE-306', 'CWE-311', 'CWE-319', 'CWE-326', 'CWE-352', 'CWE-434', 'CWE-502', 'CWE-521', 'CWE-601', 'CWE-639', 'CWE-693', 'CWE-798', 'CWE-918', 'CWE-1104', 'CWE-1392'].map(function (x) { return '<option value="' + x + '">'; }).join('') + '</datalist></details>');
    // Verknüpfte Maßnahmen
    if (f.measures.length) h.push('<div class="card"><h2>' + esc(L('Verknüpfte Maßnahmen', 'Linked measures')) + '</h2>' + K.table([L('Asset', 'Asset'), L('Maßnahme', 'Measure'), L('Status Checkliste', 'Checklist status'), L('Wirksamkeit', 'Effectiveness'), ''], f.measures.map(function (m) {
      var a = s.assets.find(function (x) { return x.id === m.assetId; }), c = a ? (a.checks[m.key] || {}) : {};
      return '<tr><td>' + esc(a ? a.name : L('(Asset gelöscht)', '(asset deleted)')) + '</td><td class="mono small">' + esc(m.ref) + '</td><td>' + (a ? esc(t('status.' + (c.status || 'open'))) : '–') + '</td><td class="small">' + esc(c.verResult ? t('verify.' + c.verResult) : '–') + '</td>' +
        '<td>' + (a ? K.btn('ptGoAsset', '↗ ' + L('Checkliste', 'Checklist'), { id: a.id, cls: 'btn-sm' }) : '') + '</td></tr>';
    })) + '<p class="small muted">' + esc(L('Re-Test „behoben“ setzt verknüpfte Maßnahmen auf „umgesetzt“ und „wirksam“; „nicht behoben“ auf „nicht wirksam“.', 'Retest "fixed" sets linked measures to "implemented" and "effective"; "not fixed" to "not effective".')) + '</p></div>');
    // Markdown-Abschnitte
    if (U.sec !== '_all' && p.layout.indexOf(U.sec) < 0) U.sec = 'summary';
    h.push('<div class="card">' + mdTabs(f));
    if (U.sec === '_all') h.push('<iframe id="ptOneFrame" class="pt-frame" title="' + esc(L('Vorschau', 'Preview')) + '"></iframe>');
    else h.push('<h2 style="margin-top:.8rem">' + esc(secLabel(U.sec)) + '</h2>' + splitEditor('pfMd', U.sec, valOf(f, U.sec), f.images, PH[U.sec] ? K.lab(PH[U.sec]) : ''));
    h.push('</div>');
    return h.join('');
  }
  function customMetaFields(f) {
    return P().fields.filter(function (cf) { return cf.type !== 'md'; }).map(function (cf) {
      var v = f.custom[cf.id], label = '<label>' + esc(cf.label) + '</label>', a = ' data-field="pfc" data-k="' + esc(cf.id) + '"';
      if (cf.type === 'select') return '<div class="field">' + label + '<select data-act="pfcSel" data-k="' + esc(cf.id) + '">' + A.opt('', '–', v || '') + (cf.options || []).map(function (o) { return A.opt(o, o, v); }).join('') + '</select></div>';
      if (cf.type === 'check') return '<div class="field">' + label + '<label style="font-weight:400"><input type="checkbox" data-act="pfcChk" data-k="' + esc(cf.id) + '"' + (v ? ' checked' : '') + '> ' + esc(L('ja', 'yes')) + '</label></div>';
      var type = cf.type === 'number' ? 'number' : cf.type === 'date' ? 'date' : cf.type === 'url' ? 'url' : 'text';
      return '<div class="field">' + label + '<input type="' + type + '"' + a + ' value="' + esc(v === undefined ? '' : v) + '"></div>';
    }).join('');
  }

  /* ---------- Berichtsaufbau, Felder, Vorlagen ---------- */
  function layoutView() {
    var p = P(), pr = p.project, h = [];
    var pf = function (k, l, type, opts) {
      var v = pr[k] === undefined ? '' : pr[k];
      if (type === 'select') return '<div class="field"><label>' + esc(K.lab(l)) + '</label><select data-act="pjSel" data-k="' + k + '">' + opts.map(function (o) { return A.opt(o[0], K.lab(o[1]), v); }).join('') + '</select></div>';
      if (type === 'textarea') return '<div class="field" style="grid-column:1/-1"><label>' + esc(K.lab(l)) + '</label><textarea data-field="pj" data-k="' + k + '" rows="2">' + esc(v) + '</textarea></div>';
      return '<div class="field"><label>' + esc(K.lab(l)) + '</label><input type="' + (type || 'text') + '" data-field="pj" data-k="' + k + '" value="' + esc(v) + '"' + (k === 'testers' || k === 'reviewer' ? ' data-person="1"' : '') + '></div>';
    };
    h.push('<div class="card"><h2>' + esc(L('Projekt- und Berichtsdaten', 'Project and report data')) + '</h2><div class="grid grid-4">' +
      pf('reportTitle', ['Berichtstitel', 'Report title']) + pf('title', ['Projekt / Prüfgegenstand', 'Project / test object']) + pf('client', ['Auftraggeber', 'Client']) +
      pf('approach', ['Prüfansatz', 'Approach'], 'select', [['Black-Box', 'Black-Box'], ['Grey-Box', 'Grey-Box'], ['White-Box', 'White-Box'], ['Red Teaming', 'Red Teaming'], ['Re-Test', 'Re-Test']]) +
      pf('from', ['Prüfzeitraum von', 'Test period from'], 'date') + pf('to', ['bis', 'to'], 'date') + pf('testers', ['Prüfer/innen', 'Testers']) + pf('reviewer', ['Qualitätssicherung', 'Quality review']) +
      pf('version', ['Version', 'Version']) + pf('status', ['Berichtsstatus', 'Report status'], 'select', Object.keys(R.STATUS).map(function (k) { return [k, R.STATUS[k]]; })) + pf('date', ['Berichtsdatum', 'Report date'], 'date') +
      pf('classification', ['Einstufung (Fußzeile)', 'Classification (footer)']) + pf('distribution', ['Verteiler', 'Distribution'], 'textarea') + pf('history', ['Änderungshistorie (Markdown)', 'Change history (markdown)'], 'textarea') + '</div></div>');
    // Abschnitte
    h.push('<div class="card"><h2>' + esc(L('Berichtsabschnitte', 'Report sections')) + '</h2><p class="small muted">' + esc(L('Reihenfolge mit ↑↓ ändern, Abschnitte ein-/ausblenden, eigene Markdown-Abschnitte anlegen. Automatische Abschnitte werden aus den Daten erzeugt.', 'Reorder with ↑↓, toggle sections, add own markdown sections. Automatic sections are generated from the data.')) + '</p>' +
      K.table(['', L('im Bericht', 'in report'), { l: ['Titel', 'Title'], w: 220 }, L('Art', 'Type'), ''], p.sections.map(function (s, i) {
        return '<tr' + (U.psec === s.id ? ' class="sel"' : '') + '><td class="nowrap">' + K.btn('psMove', '↑', { id: i, k: '-1', cls: 'btn-sm', disabled: i === 0 }) + K.btn('psMove', '↓', { id: i, k: '1', cls: 'btn-sm', disabled: i === p.sections.length - 1 }) + '</td>' +
          '<td><input type="checkbox" data-act="psOn" data-id="' + esc(s.id) + '"' + (s.on !== false ? ' checked' : '') + ' aria-label="' + esc(L('im Bericht', 'in report')) + '"></td>' +
          '<td><input type="text" data-field="psTitle" data-id="' + esc(s.id) + '" value="' + esc(s.title) + '"></td><td class="small">' + (s.kind === 'auto' ? '⚙ ' + esc(L('automatisch', 'automatic')) : '📝 Markdown') + '</td>' +
          '<td class="nowrap">' + (s.kind === 'md' ? K.btn('psEdit', U.psec === s.id ? L('schließen', 'close') : '✏️ ' + L('bearbeiten', 'edit'), { id: s.id, cls: 'btn-sm' }) + ' ' + K.btn('psDel', '🗑', { id: s.id, cls: 'btn-sm btn-danger', title: t('btn.delete') }) : '') + '</td></tr>';
      })) + '<div class="row" style="margin-top:.5rem">' + K.btn('psAdd', '+ ' + L('Eigener Abschnitt', 'Own section'), { cls: 'btn-primary' }) + K.btn('psReset', L('Standardabschnitte wiederherstellen', 'Restore default sections')) + '</div>');
    var es = p.sections.find(function (x) { return x.id === U.psec && x.kind === 'md'; });
    if (es) h.push('<h3 style="margin-top:1rem">' + esc(es.title) + '</h3>' + splitEditor('psMd', es.id, es.md, p.images, ''));
    h.push('</div>');
    // Aufbau eines Findings
    h.push('<div class="card"><h2>' + esc(L('Aufbau eines Findings im Bericht', 'Finding structure in the report')) + '</h2><p class="small muted">' + esc(L('Stammdaten (Schweregrad, CVSS, CWE, Betroffenheit, Re-Test, eigene Felder) erscheinen als Tabelle, darunter die Kurz-Empfehlung und diese Abschnitte:', 'Details appear as a table, followed by the short recommendation and these sections:')) + '</p>' +
      K.table(['', L('im Bericht', 'in report'), L('Abschnitt', 'Section'), ''], p.layout.map(function (k, i) {
        return '<tr><td class="nowrap">' + K.btn('plMove', '↑', { id: i, k: '-1', cls: 'btn-sm', disabled: i === 0 }) + K.btn('plMove', '↓', { id: i, k: '1', cls: 'btn-sm', disabled: i === p.layout.length - 1 }) + '</td>' +
          '<td><input type="checkbox" data-act="plOn" data-id="' + esc(k) + '"' + (!p.layoutOff[k] ? ' checked' : '') + '></td><td>' + esc(secLabel(k)) + (k.indexOf('cf:') === 0 ? ' <span class="small muted">(' + esc(L('eigenes Feld', 'custom field')) + ')</span>' : '') + '</td><td></td></tr>';
      })) + '</div>');
    // Eigene Felder
    var TYPES = fieldTypes();
    h.push('<div class="card"><h2>' + esc(L('Eigene Felder', 'Custom fields')) + '</h2><p class="small muted">' + esc(L('Zusätzliche Felder für jedes Finding, z. B. „Testkonto“, „Ticket-Nr.“, „Angriffsszenario“ (Markdown) oder „Exploit öffentlich?“. Markdown-Felder erscheinen als eigener Abschnitt mit Editor.', 'Additional fields for every finding, e.g. "test account", "ticket no.", "attack scenario" (markdown) or "public exploit?". Markdown fields appear as their own section with editor.')) + '</p>' +
      (p.fields.length ? K.table([L('Bezeichnung', 'Label'), L('Typ', 'Type'), L('Optionen', 'Options'), L('im Bericht', 'in report'), ''], p.fields.map(function (cf) {
        return '<tr><td><b>' + esc(cf.label) + '</b></td><td class="small">' + esc(K.lab((TYPES.find(function (x) { return x[0] === cf.type; }) || [0, [cf.type]])[1])) + '</td><td class="small">' + esc((cf.options || []).join(', ') || '–') + '</td><td>' + (cf.inReport !== false ? '✔' : '–') + '</td>' +
          '<td class="nowrap">' + K.btn('cfEdit', '✏️', { id: cf.id, cls: 'btn-sm', title: t('btn.edit') }) + ' ' + K.btn('cfDel', '🗑', { id: cf.id, cls: 'btn-sm btn-danger', title: t('btn.delete') }) + '</td></tr>';
      })) : '<p class="muted">' + esc(L('Noch keine eigenen Felder.', 'No custom fields yet.')) + '</p>') + '<div class="row" style="margin-top:.5rem">' + K.btn('cfAdd', '+ ' + L('Feld', 'Field'), { cls: 'btn-primary' }) + '</div></div>');
    // Vorlagen
    h.push('<div class="card"><h2>' + esc(L('Eigene Vorlagen', 'Own templates')) + '</h2>' + (p.templates.length ? K.table([L('Vorlage', 'Template'), L('Schwere', 'Severity'), 'CWE', ''], p.templates.map(function (x) {
      return '<tr><td><b>' + esc(x.title) + '</b></td><td>' + sevPill(x.severity) + '</td><td>' + esc(x.cwe || '–') + '</td><td>' + K.btn('tplDel', '🗑', { id: x.id, cls: 'btn-sm btn-danger', title: t('btn.delete') }) + '</td></tr>'; }))
      : '<p class="muted">' + esc(L('Im Editor mit „⭐ Als Vorlage“ eigene Vorlagen speichern. Mitgeliefert sind ' + HA.FINDING_TEMPLATES.length + ' Vorlagen.', 'Save own templates in the editor with "⭐ As template". ' + HA.FINDING_TEMPLATES.length + ' templates are included.')) + '</p>') + '</div>');
    return h.join('');
  }
  function fieldTypes() { return [['text', ['Text (einzeilig)', 'Text (single line)']], ['md', ['Markdown-Abschnitt', 'Markdown section']], ['select', ['Auswahlliste', 'Drop-down']], ['number', ['Zahl', 'Number']], ['date', ['Datum', 'Date']], ['check', ['Ja/Nein', 'Yes/no']], ['url', ['Link (URL)', 'Link (URL)']]]; }
  function editField(cf) {
    var p = P(), isNew = !cf;
    var obj = cf ? { label: cf.label, type: cf.type, options: (cf.options || []).join(', '), inReport: cf.inReport !== false } : { label: '', type: 'text', options: '', inReport: true };
    K.editDialog(isNew ? L('Eigenes Feld anlegen', 'Add custom field') : L('Feld bearbeiten', 'Edit field'), [
      { k: 'label', l: ['Bezeichnung', 'Label'], req: true }, { k: 'type', l: ['Typ', 'Type'], type: 'select', opts: fieldTypes() },
      { k: 'options', l: ['Optionen (bei Auswahlliste, kommagetrennt)', 'Options (for drop-down, comma separated)'], full: true }, { k: 'inReport', type: 'check', l: ['im Bericht ausgeben', 'show in report'] }
    ], obj, function (o) {
      var target = cf || { id: 'f' + Date.now().toString(36) };
      target.label = o.label; target.type = o.type; target.inReport = o.inReport; target.options = String(o.options || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      if (isNew) p.fields.push(target);
      var key = 'cf:' + target.id;
      if (target.type === 'md' && p.layout.indexOf(key) < 0) p.layout.push(key);
      if (target.type !== 'md') p.layout = p.layout.filter(function (k) { return k !== key; });
    });
  }

  /* ---------- Bericht & Export ---------- */
  function reportView() {
    var r = P().report, sel = R.selection(P(), r);
    return '<div class="card no-print"><h2>' + esc(L('Pentest-Bericht (DIN A4)', 'Pentest report (A4)')) + '</h2><div class="grid grid-4">' +
      '<div class="field"><label>' + esc(L('Mindest-Schweregrad', 'Minimum severity')) + '</label><select data-act="prOpt" data-k="minSev">' + R.SEV_ORDER.slice().reverse().map(function (k) { return A.opt(k, R.sevLabel(k) + (k === 'info' ? ' (' + L('alle', 'all') + ')' : ' +'), r.minSev); }).join('') + '</select></div>' +
      '<div class="field"><label>' + esc(L('Sortierung', 'Sort order')) + '</label><select data-act="prOpt" data-k="sort">' + A.opt('severity', L('nach Schweregrad', 'by severity'), r.sort) + A.opt('id', L('nach ID', 'by ID'), r.sort) + '</select></div>' +
      '<div class="checks" style="grid-column:span 2;align-self:end"><label><input type="checkbox" data-act="prOpt" data-k="includeDrafts"' + (r.includeDrafts ? ' checked' : '') + '> ' + esc(L('Entwürfe einbeziehen', 'include drafts')) + '</label>' +
      '<label><input type="checkbox" data-act="prOpt" data-k="pageBreak"' + (r.pageBreak ? ' checked' : '') + '> ' + esc(L('jedes Finding auf neuer Seite', 'each finding on a new page')) + '</label></div></div>' +
      '<div class="row" style="margin-top:.6rem">' + K.btn('prPrint', '🖨 ' + L('Drucken', 'Print'), { cls: 'btn-primary' }) + K.btn('prPdf', '📄 ' + L('Als PDF speichern', 'Save as PDF')) + K.btn('prHtml', '⬇ ' + L('Als HTML speichern', 'Save as HTML')) +
      K.btn('prRefresh', '🔄 ' + L('Vorschau aktualisieren', 'Refresh preview')) + '<span class="small muted">' + esc(L(sel.length + ' Findings im Bericht', sel.length + ' findings in report')) + '</span></div>' +
      '<p class="small muted" style="margin-top:.4rem">' + esc(L('PDF: Im Druckdialog als Ziel „Als PDF speichern“ wählen, Format A4, Ränder „Standard“, Hintergrundgrafiken an. Abschnitte, Reihenfolge und Projektdaten unter „Berichtsaufbau“.', 'PDF: choose "Save as PDF" as destination in the print dialog, A4, default margins, background graphics on. Sections, order and project data under "Report layout".')) + '</p></div>' +
      '<iframe id="ptFrame" class="pt-frame tall" title="' + esc(L('Berichtsvorschau', 'Report preview')) + '"></iframe>';
  }
  function reportHtml(opts) { return R.build(S(), Object.assign({}, P().report, opts || {})); }
  /** Bericht in einem unsichtbaren Rahmen öffnen und den Druckdialog starten (Drucken bzw. „Als PDF speichern“). */
  function printHtml(html, pdfHint) {
    var fr = document.createElement('iframe');
    fr.setAttribute('aria-hidden', 'true'); fr.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0';
    document.body.appendChild(fr);
    fr.onload = function () { setTimeout(function () { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { A.toast(e.message, true); } setTimeout(function () { fr.remove(); }, 120000); }, 250); };
    fr.srcdoc = html;
    if (pdfHint) A.toast(L('Im Druckdialog „Als PDF speichern“ als Ziel wählen.', 'Choose "Save as PDF" as destination in the print dialog.'));
  }
  function fileName(ext, suffix) {
    var pr = P().project, base = (pr.title || 'pentest').toLowerCase().replace(/[^a-z0-9äöüß]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40) || 'pentest';
    return 'pentest-bericht_' + base + (suffix ? '_' + suffix : '') + '_' + K.today() + '.' + ext;
  }

  /* ------------------------------------------------------------------
   * Markdown-Werkzeuge im Editor
   * ---------------------------------------------------------------- */
  function area() { return document.getElementById('mdArea'); }
  function fire(ta) { ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); }
  function surround(ta, before, after, ph) {
    var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value, sel = v.slice(s, e) || ph;
    ta.value = v.slice(0, s) + before + sel + after + v.slice(e);
    ta.selectionStart = s + before.length; ta.selectionEnd = s + before.length + sel.length; fire(ta);
  }
  function linePrefix(ta, prefix, numbered) {
    var v = ta.value, s = v.lastIndexOf('\n', ta.selectionStart - 1) + 1, e = ta.selectionEnd, end = v.indexOf('\n', e); if (end < 0) end = v.length;
    var n = 0, block = v.slice(s, end).split('\n').map(function (l) { n++; return (numbered ? n + '. ' : prefix) + l; }).join('\n');
    ta.value = v.slice(0, s) + block + v.slice(end); ta.selectionStart = s; ta.selectionEnd = s + block.length; fire(ta);
  }
  function insert(ta, text) { var s = ta.selectionStart, v = ta.value; ta.value = v.slice(0, s) + text + v.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = s + text.length; fire(ta); }
  function tool(k) {
    var ta = area(); if (!ta) return;
    switch (k) {
      case 'bold': return surround(ta, '**', '**', L('fett', 'bold'));
      case 'italic': return surround(ta, '*', '*', L('kursiv', 'italic'));
      case 'code': return surround(ta, '`', '`', 'code');
      case 'h2': return linePrefix(ta, '## ');
      case 'h3': return linePrefix(ta, '### ');
      case 'ul': return linePrefix(ta, '- ');
      case 'ol': return linePrefix(ta, '', true);
      case 'task': return linePrefix(ta, '- [ ] ');
      case 'quote': return linePrefix(ta, '> ');
      case 'link': return surround(ta, '[', '](https://)', L('Linktext', 'link text'));
      case 'block': return surround(ta, '\n```\n', '\n```\n', L('Befehl oder Ausgabe', 'command or output'));
      case 'table': return insert(ta, '\n| ' + L('Spalte', 'Column') + ' 1 | ' + L('Spalte', 'Column') + ' 2 |\n|---|---|\n| … | … |\n');
      case 'hr': return insert(ta, '\n\n---\n\n');
    }
  }
  /** Bild verkleinern (max. 1600 px Breite), lokal speichern und als img:ID einfügen. */
  function addImage(file) {
    var ta = area(); if (!ta || !file || !/^image\//.test(file.type)) return;
    if (file.size > 15 * 1024 * 1024) { A.toast(L('Bild zu groß (max. 15 MB).', 'Image too large (max. 15 MB).'), true); return; }
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var w = img.naturalWidth, hgt = img.naturalHeight, sc = Math.min(1, 1600 / w), c = document.createElement('canvas');
      c.width = Math.round(w * sc); c.height = Math.round(hgt * sc); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      var data = file.type === 'image/png' || file.type === 'image/gif' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.85);
      if (data.length > 1.2 * 1024 * 1024 && file.type === 'image/png') data = c.toDataURL('image/jpeg', 0.85);   // große Screenshots verkleinern
      URL.revokeObjectURL(url);
      var id = 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      var holder = ta.getAttribute('data-field') === 'psMd' ? P().images : cur().images;
      holder[id] = data;
      insert(ta, '\n![' + (file.name || L('Screenshot', 'Screenshot')).replace(/[\[\]]/g, '') + '](img:' + id + ')\n');
      A.toast(L('Bild eingefügt', 'Image inserted') + ' (' + Math.round(data.length / 1024) + ' KB)');
    };
    img.onerror = function () { URL.revokeObjectURL(url); A.toast(L('Bild konnte nicht gelesen werden.', 'Image could not be read.'), true); };
    img.src = url;
  }

  /* ------------------------------------------------------------------
   * Zwischenspeichern & Versionen
   * ---------------------------------------------------------------- */
  function snapshot(f, label) {
    var copy = JSON.parse(JSON.stringify(f)); delete copy.history; delete copy.measures;
    f.history.unshift({ at: new Date().toISOString(), label: label || '', data: copy });
    if (f.history.length > 20) f.history.length = 20;
    f.savedAt = new Date().toISOString();
  }
  function historyDialog(f) {
    var body = K.table([L('Zeitpunkt', 'Time'), L('Titel', 'Title'), L('Schwere', 'Severity'), L('Umfang', 'Size'), ''], f.history.map(function (h, i) {
      return '<tr><td class="nowrap">' + A.fmtDate(h.at, true) + (h.label ? '<div class="small muted">' + esc(h.label) + '</div>' : '') + '</td><td>' + esc(h.data.title) + '</td><td>' + sevPill(h.data.severity) + '</td><td class="small">' + Math.round(JSON.stringify(h.data).length / 1024) + ' KB</td>' +
        '<td><button type="button" class="btn btn-sm" data-restore="' + i + '">' + esc(L('Wiederherstellen', 'Restore')) + '</button></td></tr>';
    }));
    var form = A.dialog(L('Versionen von ', 'Versions of ') + f.id, '<p class="small muted">' + esc(L('Beim Wiederherstellen wird der aktuelle Stand vorher als Version gesichert.', 'Before restoring, the current state is saved as a version.')) + '</p>' + body);
    form.addEventListener('click', function (e) {
      var b = e.target.closest('[data-restore]'); if (!b) return;
      var h = f.history[+b.getAttribute('data-restore')];
      snapshot(f, L('vor Wiederherstellung', 'before restore'));
      var keep = { id: f.id, history: f.history, measures: f.measures };
      Object.keys(f).forEach(function (k) { delete f[k]; });
      Object.assign(f, JSON.parse(JSON.stringify(h.data)), keep); fixFinding(f); touch(f);
      document.getElementById('dlg').close(); A.render(); A.toast(L('Version wiederhergestellt', 'Version restored'));
    });
  }

  /* ------------------------------------------------------------------
   * Als Maßnahme zu einem Asset (bestehend oder neu)
   * ---------------------------------------------------------------- */
  function topicGuess(f) {
    var o = f.owasp, c = String(f.cwe || '');
    if (o === 'A02' || /326|327|311|319/.test(c)) return 'crypto';
    if (o === 'A07' || /287|521|798|1392/.test(c)) return 'accounts';
    if (o === 'A01' || /284|639|862|863/.test(c)) return 'privilege';
    if (o === 'A06' || /1104/.test(c)) return 'patch';
    if (o === 'A09') return 'logging';
    if (/smb|ssh|rdp/i.test(f.title)) return 'remote';
    return 'install';
  }
  function measureDialog(f) {
    var s = S(), first = (f.targets || '').split('\n')[0].trim();
    var body = '<div class="checks"><label><input type="radio" name="target" value="existing"' + (s.assets.length ? ' checked' : ' disabled') + '> ' + esc(L('Bestehendes Asset', 'Existing asset')) + '</label>' +
      '<label><input type="radio" name="target" value="new"' + (s.assets.length ? '' : ' checked') + '> ' + esc(L('Neues Asset anlegen', 'Create new asset')) + '</label></div>' +
      '<div class="field" data-show="existing"><label>' + esc(L('Asset', 'Asset')) + '</label><select name="asset">' + s.assets.map(function (a) { return A.opt(a.id, a.name + (a.hostname ? ' (' + a.hostname + ')' : ''), f.assets[0]); }).join('') + '</select></div>' +
      '<div class="grid grid-2" data-show="new"><div class="field"><label>' + esc(t('c.name')) + ' *</label><input type="text" name="name" value="' + esc(first.replace(/^https?:\/\//, '').split(/[/:]/)[0] || '') + '"></div>' +
      '<div class="field"><label>' + esc(t('c.hostname')) + '</label><input type="text" name="hostname"></div><div class="field"><label>' + esc(t('c.ip')) + '</label><input type="text" name="ip"></div>' +
      '<div class="field"><label>' + esc(t('c.os')) + '</label><select name="os">' + HA.OS.map(function (o) { return A.opt(o.id, HA.tx(o), 'debian'); }).join('') + '</select></div></div>' +
      '<div class="grid grid-2"><div class="field"><label>' + esc(t('c.topic')) + '</label><select name="topic">' + HA.TOPICS.map(function (x) { return A.opt(x.id, HA.tx(x), topicGuess(f)); }).join('') + '</select></div>' +
      '<div class="field"><label>' + esc(L('Status in der Checkliste', 'Checklist status')) + '</label><select name="status">' + ['notdone', 'open', 'partial'].map(function (x) { return A.opt(x, t('status.' + x), f.retestStatus === 'partial' ? 'partial' : 'notdone'); }).join('') + '</select></div>' +
      '<div class="field"><label>' + esc(t('c.responsible')) + '</label><input type="text" name="responsible" data-person="1" value="' + esc(f.owner || '') + '"></div>' +
      '<div class="field"><label>' + esc(t('c.dueDate')) + '</label><input type="date" name="due" value="' + esc(f.due || '') + '"></div></div>' +
      '<p class="small muted">' + esc(L('Die Maßnahme erscheint als eigene Maßnahme („Pentest-Findings“) in der Checkliste des Assets – mit Kurz-Empfehlung und Empfehlung als Beschreibung.', 'The measure appears as a custom measure ("Pentest findings") in the asset checklist – with short recommendation and recommendation as description.')) + '</p>';
    var form = A.dialog(L('Finding als Maßnahme hinzufügen', 'Add finding as measure') + ' – ' + f.id, body, function (fm) {
      var mode = (fm.querySelector('[name=target]:checked') || {}).value, a;
      if (mode === 'new') {
        var name = fm.querySelector('[name=name]').value.trim();
        if (!name) { fm.querySelector('[name=name]').classList.add('invalid'); return false; }
        var os = fm.querySelector('[name=os]').value, fam = HA.osById(os).family;
        a = { id: A.uid('a'), name: name, hostname: fm.querySelector('[name=hostname]').value.trim(), ip: fm.querySelector('[name=ip]').value.trim(), os: os, osVersion: '', role: '', owner: f.owner || '', location: '', description: L('Angelegt aus Pentest-Finding ', 'Created from pentest finding ') + f.id,
          approach: 'standard', showH: false, checks: {}, scans: [], sb: { c: 'normal', i: 'normal', a: 'normal' }, created: new Date().toISOString(),
          libs: fam === 'windows' ? ['bsi2023', 'msbaseline'] : fam === 'macos' ? ['bsi2023', 'mscp'] : ['bsi2023', 'ssg'] };
        s.assets.push(a);
      } else a = s.assets.find(function (x) { return x.id === fm.querySelector('[name=asset]').value; });
      if (!a) return false;
      var ref = 'PT-' + f.id, n = 2;
      while (s.customItems.some(function (x) { return x.ref === ref && x.assetId === a.id; })) ref = 'PT-' + f.id + '-' + (n++);
      var desc = [f.shortRec, HA.MD.plain(f.recommendation)].filter(Boolean).join('\n\n');
      var it = { lib: 'custom', ref: ref, title: { de: '[Pentest ' + f.id + '] ' + f.title, en: '[Pentest ' + f.id + '] ' + f.title }, desc: { de: desc, en: desc }, level: 'B', topic: fm.querySelector('[name=topic]').value,
        os: [HA.osById(a.os).family], role: 'any', check: null, group: L('Pentest-Findings', 'Pentest findings'), assetId: a.id, source: 'pentest:' + f.id };
      s.customItems.push(it); A.invalidate();
      var key = 'custom|' + ref;
      a.checks[key] = { status: fm.querySelector('[name=status]').value, note: L('Aus Pentest-Finding ', 'From pentest finding ') + f.id + ' · ' + R.sevLabel(f.severity) + (f.cvss ? ' · CVSS ' + f.cvss : ''),
        responsible: fm.querySelector('[name=responsible]').value.trim(), due: fm.querySelector('[name=due]').value, updated: new Date().toISOString() };
      f.measures.push({ assetId: a.id, key: key, ref: ref, at: new Date().toISOString() });
      if (f.assets.indexOf(a.id) < 0) f.assets.push(a.id);
      touch(f); A.render(); A.toast(L('Maßnahme ' + ref + ' bei „' + a.name + '“ angelegt', 'Measure ' + ref + ' added to "' + a.name + '"'));
    }, L('Hinzufügen', 'Add'));
    function sync() { var m = (form.querySelector('[name=target]:checked') || {}).value; form.querySelectorAll('[data-show]').forEach(function (el) { el.style.display = el.getAttribute('data-show') === m ? '' : 'none'; }); }
    form.addEventListener('change', sync); sync();
  }
  /** Re-Test-Ergebnis auf verknüpfte Maßnahmen übertragen. */
  function syncRetest(f) {
    var s = S(), n = 0;
    f.measures.forEach(function (m) {
      var a = s.assets.find(function (x) { return x.id === m.assetId; }); if (!a) return;
      var c = a.checks[m.key] = Object.assign({}, a.checks[m.key] || {});
      var base = { verDate: f.retestDate || K.today(), verMethod: 'test', verBy: f.retestBy || '', updated: new Date().toISOString() };
      if (f.retestStatus === 'fixed') { Object.assign(c, base, { status: 'done', verResult: 'effective' }); n++; }
      else if (f.retestStatus === 'notfixed') { Object.assign(c, base, { verResult: 'ineffective' }); n++; }
      else if (f.retestStatus === 'partial') { Object.assign(c, base, { status: 'partial', verResult: 'ineffective' }); n++; }
    });
    if (n) A.toast(L(n + ' verknüpfte Maßnahme(n) aktualisiert', n + ' linked measure(s) updated'));
  }

  /* ------------------------------------------------------------------
   * Vorlagen, Scan-Übernahme, Import/Export
   * ---------------------------------------------------------------- */
  var TPL_KEYS = ['title', 'severity', 'cvssVector', 'cwe', 'owasp', 'summary', 'description', 'impact', 'steps', 'recommendation', 'shortRec', 'references'];
  function templateDialog() {
    var p = P(), all = p.templates.map(function (x) { return { src: 'own', t: x }; }).concat(HA.FINDING_TEMPLATES.map(function (x) { return { src: 'builtin', t: x }; }));
    var body = '<div class="field"><input type="search" id="tplQ" placeholder="' + esc(t('c.search')) + '"></div><div class="tpl-list">' + all.map(function (x, i) {
      return '<label class="tpl-item" data-q="' + esc((x.t.title + ' ' + (x.t.cwe || '') + ' ' + (x.t.owasp || '')).toLowerCase()) + '"><input type="radio" name="tpl" value="' + i + '"' + (i === 0 ? ' checked' : '') + '> ' + sevPill(x.t.severity) + ' <b>' + esc(x.t.title) + '</b> <span class="small muted">' +
        esc([x.t.cwe, x.src === 'own' ? L('eigene Vorlage', 'own template') : ''].filter(Boolean).join(' · ')) + '</span><div class="small muted">' + esc(K.clip(x.t.summary, 160)) + '</div></label>';
    }).join('') + '</div>';
    var form = A.dialog(L('Finding aus Vorlage', 'Finding from template'), body, function (fm) {
      var x = all[+(fm.querySelector('[name=tpl]:checked') || {}).value]; if (!x) return false;
      var pre = {}; TPL_KEYS.forEach(function (k) { if (x.t[k] !== undefined) pre[k] = x.t[k]; });
      var v = parseVector(pre.cvssVector); if (v) pre.cvss = cvssScore(v).toFixed(1);
      var f = newFinding(pre); A.save(); open(f.id);
    }, L('Finding anlegen', 'Create finding'));
    form.classList.add('dlg-wide');
    form.querySelector('#tplQ').addEventListener('input', function (e) { var q = e.target.value.toLowerCase(); form.querySelectorAll('.tpl-item').forEach(function (el) { el.style.display = el.getAttribute('data-q').indexOf(q) >= 0 ? '' : 'none'; }); });
  }
  function fromScanDialog() {
    var s = S(), rows = [], have = {};
    P().findings.forEach(function (f) { if (f.source) have[f.source] = 1; });
    s.assets.forEach(function (a) { HA.Risk.latestScans(a).forEach(function (sc) {
      if (sc.tool === 'nmap') return;
      (sc.findings || []).forEach(function (sf) { if (sf.status === 'fixed' || sf.status === 'falsepositive') return; rows.push({ a: a, sc: sc, f: sf, key: 'scan:' + a.id + ':' + sf.id }); });
    }); });
    if (!rows.length) { A.toast(L('Keine offenen Scan-Befunde vorhanden.', 'No open scan findings.'), true); return; }
    var sevMap = function (x) { return x === 'log' ? 'info' : R.SEV[x] ? x : 'info'; };
    rows.sort(function (x, y) { return R.SEV[sevMap(y.f.severity)].rank - R.SEV[sevMap(x.f.severity)].rank; });
    var body = '<p class="small muted">' + esc(L('Offene Befunde der aktuellsten Scans. Bereits übernommene sind ausgegraut.', 'Open findings of the latest scans. Already taken over are greyed out.')) + '</p><label><input type="checkbox" id="scanAll"> ' + esc(L('alle auswählen', 'select all')) + '</label>' +
      '<div class="tpl-list">' + rows.map(function (r, i) { var dis = have[r.key];
        return '<label class="tpl-item"' + (dis ? ' style="opacity:.5"' : '') + '><input type="checkbox" name="sf" value="' + i + '"' + (dis ? ' disabled' : '') + '> ' + sevPill(sevMap(r.f.severity)) + ' <b>' + esc(r.f.title) + '</b> <span class="small muted">' + esc(r.a.name + ' · ' + r.sc.tool + (r.f.port ? ' · ' + r.f.port : '') + (r.f.cvss ? ' · CVSS ' + r.f.cvss : '')) + '</span></label>'; }).join('') + '</div>';
    var form = A.dialog(L('Aus Schwachstellenscan übernehmen', 'Take over from vulnerability scan'), body, function (fm) {
      var n = 0;
      Array.prototype.forEach.call(fm.querySelectorAll('[name=sf]:checked'), function (cb) {
        var r = rows[+cb.value], sf = r.f, cv = parseFloat(sf.cvss);
        newFinding({ title: sf.title, severity: sevMap(sf.severity), cvss: isNaN(cv) ? '' : cv.toFixed(1), assets: [r.a.id], targets: (sf.host || r.a.hostname || '') + (sf.port ? ':' + sf.port : ''),
          description: (sf.desc || '') + '\n\n_' + L('Quelle', 'Source') + ': ' + r.sc.tool + (r.sc.scanDate ? ', ' + A.fmtDate(r.sc.scanDate) : '') + (sf.ref ? ', ' + sf.ref : '') + '_',
          recommendation: sf.solution || '', shortRec: K.clip(sf.solution || '', 200), references: sf.cve ? String(sf.cve).split(/[,\s]+/).filter(Boolean).map(function (c) { return '- ' + c + ': https://nvd.nist.gov/vuln/detail/' + c; }).join('\n') : '', source: r.key });
        n++;
      });
      A.save(); A.render(); A.toast(L(n + ' Findings übernommen', n + ' findings taken over'));
    }, L('Übernehmen', 'Take over'));
    form.classList.add('dlg-wide');
    form.querySelector('#scanAll').addEventListener('change', function (e) { form.querySelectorAll('[name=sf]:not(:disabled)').forEach(function (cb) { cb.checked = e.target.checked; }); });
  }
  var CSV_COLS = ['id', 'title', 'severity', 'cvss', 'cvssVector', 'cwe', 'owasp', 'status', 'assets', 'targets', 'owner', 'due', 'tags', 'retestStatus', 'retestDate', 'retestBy', 'shortRec', 'summary', 'description', 'impact', 'steps', 'evidence', 'recommendation', 'references', 'retestNote'];
  function exportAs(kind) {
    var s = S(), p = P();
    if (kind === 'json') {
      var data = { app: 'little-riskbee-findings', version: 1, exported: new Date().toISOString(), project: p.project, sections: p.sections, fields: p.fields, layout: p.layout, layoutOff: p.layoutOff, templates: p.templates, images: p.images, findings: p.findings };
      K.download('pentest-findings_' + K.today() + '.json', JSON.stringify(data, null, 2), 'application/json'); return;
    }
    if (kind === 'md') { K.download('pentest-findings_' + K.today() + '.md', R.markdown(s, R.selection(p, { includeDrafts: true, minSev: 'info' })), 'text/markdown;charset=utf-8'); return; }
    var q = function (v) { v = String(v === undefined || v === null ? '' : v); return '"' + v.replace(/"/g, '""') + '"'; };
    var lines = [CSV_COLS.concat(p.fields.map(function (f) { return f.label; })).map(q).join(';')];
    p.findings.forEach(function (f) {
      lines.push(CSV_COLS.map(function (k) { return k === 'assets' ? f.assets.map(assetName).filter(Boolean).join(', ') : String(f[k] || '').replace(/\]\(img:[\w-]+\)/g, '](Bild)'); })
        .concat(p.fields.map(function (cf) { return f.custom[cf.id]; })).map(q).join(';'));
    });
    K.download('pentest-findings_' + K.today() + '.csv', '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  }
  function parseCsv(text) {
    text = text.replace(/^﻿/, '');
    var first = text.split('\n')[0], sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
    var rows = [], row = [], f = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true; else if (c === sep) { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return x.trim(); }); });
  }
  var ALIAS = { title: ['title', 'titel', 'name', 'finding'], severity: ['severity', 'schweregrad', 'schwere', 'risiko', 'risk'], cvss: ['cvss', 'cvss score', 'score'], cvssVector: ['cvssvector', 'cvss vector', 'vektor', 'vector', 'cvss-vektor'],
    cwe: ['cwe'], owasp: ['owasp'], status: ['status'], targets: ['targets', 'ziele', 'betroffen', 'affected', 'host', 'url', 'ziel'], owner: ['owner', 'verantwortlich'], due: ['due', 'frist', 'behebungsfrist'], tags: ['tags'],
    retestStatus: ['retest', 'retest status', 're-test', 're-test-status', 'retest-status', 'retest_status', 'retestStatus'], retestDate: ['retestdate', 're-test am', 'retest date'], retestBy: ['retestby'], shortRec: ['shortrec', 'kurz-empfehlung', 'kurzempfehlung', 'short recommendation'],
    summary: ['summary', 'zusammenfassung'], description: ['description', 'beschreibung', 'technische beschreibung', 'details'], impact: ['impact', 'auswirkung'], steps: ['steps', 'reproduktion', 'poc', 'proof of concept', 'steps to reproduce'],
    evidence: ['evidence', 'nachweise', 'nachweis'], recommendation: ['recommendation', 'empfehlung', 'solution', 'lösung', 'remediation'], references: ['references', 'referenzen', 'refs'], retestNote: ['retestnote', 're-test-notiz', 'retest note'] };
  function normSev(v) {
    v = String(v || '').toLowerCase().trim();
    if (/^(crit|krit)/.test(v)) return 'critical'; if (/^(high|hoch)/.test(v)) return 'high'; if (/^(med|mittel)/.test(v)) return 'medium'; if (/^(low|niedrig|gering)/.test(v)) return 'low';
    if (/^\d/.test(v)) return sevFromScore(parseFloat(v.replace(',', '.')));
    return 'info';
  }
  function normRetest(v) { v = String(v || '').toLowerCase(); if (/teil|partial/.test(v)) return 'partial'; if (/nicht|not ?fixed|offen/.test(v)) return 'notfixed'; if (/behoben|fixed|closed/.test(v)) return 'fixed'; if (/akzept|accept/.test(v)) return 'accepted'; if (R.RETEST[v]) return v; return 'open'; }
  function importFile(file) {
    file.text().then(function (txt) {
      if (/\.csv$/i.test(file.name) || !/^\s*[{[]/.test(txt)) return importCsv(txt);
      var obj; try { obj = JSON.parse(txt); } catch (e) { A.toast(L('Datei ist kein gültiges JSON.', 'File is not valid JSON.'), true); return; }
      var list = Array.isArray(obj) ? obj : obj.findings || (obj.pentest && obj.pentest.findings);
      if (!Array.isArray(list)) { A.toast(L('Keine Findings in der Datei gefunden.', 'No findings found in file.'), true); return; }
      var full = !Array.isArray(obj) && (obj.sections || (obj.pentest && obj.pentest.sections));
      A.dialog(L('Findings importieren', 'Import findings'), '<p>' + esc(L(list.length + ' Findings in „' + file.name + '“.', list.length + ' findings in "' + file.name + '".')) + '</p><div class="checks">' +
        '<label><input type="radio" name="mode" value="merge" checked> ' + esc(L('hinzufügen (bei gleicher ID neue Nummer)', 'add (new number if ID exists)')) + '</label>' +
        '<label><input type="radio" name="mode" value="replace"> ' + esc(L('vorhandene Findings ersetzen', 'replace existing findings')) + '</label>' +
        (full ? '<label><input type="checkbox" name="setup" checked> ' + esc(L('Projektdaten, Abschnitte, Felder und Vorlagen übernehmen', 'take over project data, sections, fields and templates')) + '</label>' : '') + '</div>', function (fm) {
        var p = P(), src = obj.pentest || obj, mode = fm.querySelector('[name=mode]:checked').value;
        if (mode === 'replace') { p.findings = []; p.seq = 1; }
        if (full && fm.querySelector('[name=setup]') && fm.querySelector('[name=setup]').checked) {
          ['project', 'sections', 'fields', 'layout', 'layoutOff', 'templates'].forEach(function (k) { if (src[k]) p[k] = JSON.parse(JSON.stringify(src[k])); });
          Object.assign(p.images, src.images || {});
        }
        var ids = {}; p.findings.forEach(function (f) { ids[f.id] = 1; });
        list.forEach(function (x) {
          var f = JSON.parse(JSON.stringify(x));
          if (!f.id || ids[f.id]) { delete f.id; var nf = newFinding(f); ids[nf.id] = 1; }
          else { fixFinding(f); p.findings.push(f); ids[f.id] = 1; var num = parseInt(String(f.id).replace(/\D/g, ''), 10); if (num >= p.seq) p.seq = num + 1; }
        });
        normPentest(S()); A.save(); A.render(); A.toast(L(list.length + ' Findings importiert', list.length + ' findings imported'));
      }, L('Importieren', 'Import'));
    });
  }
  function importCsv(txt) {
    var rows = parseCsv(txt); if (rows.length < 2) { A.toast(L('CSV enthält keine Daten.', 'CSV contains no data.'), true); return; }
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); }), map = {};
    Object.keys(ALIAS).forEach(function (k) { var i = head.findIndex(function (h) { return ALIAS[k].indexOf(h) >= 0 || h === k.toLowerCase(); }); if (i >= 0) map[k] = i; });
    var cfMap = {}; P().fields.forEach(function (cf) { var i = head.indexOf(cf.label.toLowerCase()); if (i >= 0) cfMap[cf.id] = i; });
    if (map.title === undefined) { A.toast(L('Spalte „title“/„Titel“ fehlt.', 'Column "title" missing.'), true); return; }
    var n = 0;
    rows.slice(1).forEach(function (r) {
      if (!(r[map.title] || '').trim()) return;
      var pre = {}; Object.keys(map).forEach(function (k) { pre[k] = (r[map[k]] || '').trim(); });
      pre.severity = normSev(pre.severity || pre.cvss); if (pre.retestStatus !== undefined) pre.retestStatus = normRetest(pre.retestStatus);
      if (pre.status && !R.STATUS[pre.status]) pre.status = 'draft';
      if (pre.cvssVector && !pre.cvss) { var v = parseVector(pre.cvssVector); if (v) pre.cvss = cvssScore(v).toFixed(1); }
      pre.custom = {}; Object.keys(cfMap).forEach(function (id) { pre.custom[id] = r[cfMap[id]]; });
      newFinding(pre); n++;
    });
    A.save(); A.render(); A.toast(L(n + ' Findings aus CSV importiert', n + ' findings imported from CSV'));
  }

  /* ------------------------------------------------------------------
   * Ereignisse
   * ---------------------------------------------------------------- */
  function open(id) { U.id = id; U.tab = 'edit'; if (P().layout.indexOf(U.sec) < 0 && U.sec !== '_all') U.sec = 'summary'; A.go('findings'); A.render(); window.scrollTo(0, 0); }
  A.views.findings = view;
  A.ext.click.push(function (act, el) {
    var p = P(), id = el.getAttribute('data-id'), f = cur();
    switch (act) {
      case 'ptTab': U.tab = id; A.render(); return true;
      case 'ptNew': { var nf = newFinding(); A.save(); open(nf.id); return true; }
      case 'ptTpl': templateDialog(); return true;
      case 'ptEdit': open(id); return true;
      case 'ptSevFilter': U.sev = U.sev === id ? '' : id; A.render(); return true;
      case 'ptDup': { var src = byId(id), c = JSON.parse(JSON.stringify(src)); delete c.id; c.title += L(' (Kopie)', ' (copy)'); c.history = []; c.measures = []; c.savedAt = ''; var d = newFinding(c); A.save(); open(d.id); return true; }
      case 'ptDel': { var x = byId(id); A.confirm(L('Finding ' + x.id + ' „' + x.title + '“ löschen? Bereits angelegte Maßnahmen bleiben in der Checkliste erhalten.', 'Delete finding ' + x.id + ' "' + x.title + '"? Measures already created stay in the checklist.'), function () {
        p.findings = p.findings.filter(function (y) { return y.id !== id; }); if (U.id === id) { U.id = null; U.tab = 'list'; } A.save(); A.render(); }); return true; }
      case 'ptSec': U.sec = id; A.render(); return true;
      case 'ptCvss': cvssDialog(f); return true;
      case 'ptSnap': snapshot(f); touch(f); A.toast(L('Zwischengespeichert (Version ' + f.history.length + ')', 'Draft saved (version ' + f.history.length + ')')); A.render(); return true;
      case 'ptHist': historyDialog(f); return true;
      case 'ptMeasure': measureDialog(f); return true;
      case 'ptGoAsset': A.ui.assetId = id; A.go('checklist'); return true;
      case 'ptSaveTpl': { var tp = { id: 't' + Date.now().toString(36) }; TPL_KEYS.forEach(function (k) { tp[k] = f[k]; }); p.templates.push(tp); A.save(); A.toast(L('Als Vorlage gespeichert', 'Saved as template')); return true; }
      case 'ptPrintOne': printHtml(reportHtml({ only: [id], single: true }), true); return true;
      case 'ptHtmlOne': K.download(fileName('html', id), reportHtml({ only: [id], single: true }), 'text/html;charset=utf-8'); return true;
      case 'ptImport': document.getElementById('ptFile').click(); return true;
      case 'ptFromScan': fromScanDialog(); return true;
      case 'ptExport': exportAs(el.getAttribute('data-k')); return true;
      case 'ptImg': document.getElementById('ptImg').click(); return true;
      case 'mdTool': tool(el.getAttribute('data-k')); return true;
      case 'mdMode': U.mode = id; var sp = document.querySelector('.md-split'); if (sp) sp.className = 'md-split mode-' + id; document.querySelectorAll('[data-act=mdMode]').forEach(function (b) { b.classList.toggle('btn-primary', b.getAttribute('data-id') === id); }); return true;
      // Berichtsaufbau
      case 'psMove': { var i = +id, j = i + (+el.getAttribute('data-k')); var it = p.sections.splice(i, 1)[0]; p.sections.splice(j, 0, it); A.save(); A.render(); return true; }
      case 'psEdit': U.psec = U.psec === id ? null : id; A.render(); return true;
      case 'psAdd': { var ns = { id: 's' + Date.now().toString(36), title: L('Neuer Abschnitt', 'New section'), kind: 'md', md: '', on: true }; var fi = p.sections.findIndex(function (x) { return x.auto === 'findings'; }); p.sections.splice(fi >= 0 ? fi + 1 : p.sections.length, 0, ns); U.psec = ns.id; A.save(); A.render(); return true; }
      case 'psDel': { var sct = p.sections.find(function (x) { return x.id === id; }); A.confirm(L('Abschnitt „' + sct.title + '“ löschen?', 'Delete section "' + sct.title + '"?'), function () { p.sections = p.sections.filter(function (x) { return x.id !== id; }); A.save(); A.render(); }); return true; }
      case 'psReset': A.confirm(L('Standardabschnitte wiederherstellen? Eigene Abschnitte und Texte gehen verloren.', 'Restore default sections? Own sections and texts will be lost.'), function () { p.sections = defaultSections(); U.psec = null; A.save(); A.render(); }); return true;
      case 'plMove': { var a = +id, b = a + (+el.getAttribute('data-k')); var k = p.layout.splice(a, 1)[0]; p.layout.splice(b, 0, k); A.save(); A.render(); return true; }
      case 'cfAdd': editField(null); return true;
      case 'cfEdit': editField(p.fields.find(function (x) { return x.id === id; })); return true;
      case 'cfDel': { var cf = p.fields.find(function (x) { return x.id === id; }); A.confirm(L('Feld „' + cf.label + '“ löschen? Eingetragene Werte werden nicht mehr angezeigt.', 'Delete field "' + cf.label + '"? Entered values will no longer be shown.'), function () {
        p.fields = p.fields.filter(function (x) { return x.id !== id; }); p.layout = p.layout.filter(function (k) { return k !== 'cf:' + id; }); A.save(); A.render(); }); return true; }
      case 'tplDel': p.templates = p.templates.filter(function (x) { return x.id !== id; }); A.save(); A.render(); return true;
      // Bericht
      case 'prRefresh': refreshPreview(); return true;
      case 'prPrint': printHtml(reportHtml(), false); return true;
      case 'prPdf': printHtml(reportHtml(), true); return true;
      case 'prHtml': K.download(fileName('html'), reportHtml(), 'text/html;charset=utf-8'); A.toast(L('HTML-Bericht gespeichert', 'HTML report saved')); return true;
    }
  });
  A.ext.change.push(function (act, el) {
    var p = P(), f = cur(), k = el.getAttribute('data-k');
    switch (act) {
      case 'ptFilter': U[k] = el.value; A.render(); return true;
      case 'ptFile': if (el.files[0]) importFile(el.files[0]); el.value = ''; return true;
      case 'ptImgFile': if (el.files[0]) addImage(el.files[0]); el.value = ''; return true;
      case 'pfSel': {
        f[k] = el.value; touch(f);
        if (k === 'retestStatus') { if (!f.retestDate && el.value !== 'open') f.retestDate = K.today(); syncRetest(f); }
        A.render(); return true;
      }
      case 'pfChk': f[k] = el.checked; touch(f); A.render(); return true;
      case 'pfAsset': { var v = el.value; if (el.checked) { if (f.assets.indexOf(v) < 0) f.assets.push(v); } else f.assets = f.assets.filter(function (x) { return x !== v; }); touch(f); return true; }
      case 'pfcSel': f.custom[k] = el.value; touch(f); return true;
      case 'pfcChk': f.custom[k] = el.checked; touch(f); return true;
      case 'pfVec': { var m = parseVector(el.value); if (m) { f.cvss = cvssScore(m).toFixed(1); f.cvssVector = vectorOf(m); touch(f); var ci = document.querySelector('[data-field=pf][data-k=cvss]'); if (ci) ci.value = f.cvss; } else if (el.value.trim()) A.toast(L('CVSS-Vektor nicht erkannt (Format CVSS:3.1/AV:…/A:…).', 'CVSS vector not recognised (format CVSS:3.1/AV:…/A:…).'), true); return true; }
      case 'pjSel': p.project[k] = el.value; A.save(); return true;
      case 'psOn': p.sections.find(function (x) { return x.id === el.getAttribute('data-id'); }).on = el.checked; A.save(); return true;
      case 'plOn': if (el.checked) delete p.layoutOff[el.getAttribute('data-id')]; else p.layoutOff[el.getAttribute('data-id')] = true; A.save(); return true;
      case 'prOpt': p.report[k] = el.type === 'checkbox' ? el.checked : el.value; A.save(); A.render(); return true;
      case 'pf': case 'pfc': case 'pj': case 'psTitle': return el.type !== 'date';
      case 'pfMd': case 'psMd': return true;
    }
  });
  A.ext.input.push(function (act, el) {
    var p = P(), f = cur(), k = el.getAttribute('data-k');
    switch (act) {
      case 'ptQ': U.q = el.value; clearTimeout(U._t); U._t = setTimeout(function () { A.render(); var x = document.querySelector('[data-act=ptQ]'); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, 300); return true;
      case 'pf': f[k] = el.value; touch(f);
        if (k === 'title') { var tb = document.querySelector('[data-act=ptTab][data-id=edit]'); if (tb) tb.textContent = 'Editor: ' + f.id; }
        return true;
      case 'pfVec': f.cvssVector = el.value.trim(); touch(f); return true;
      case 'pfc': f.custom[k] = el.value; touch(f); return true;
      case 'pj': p.project[k] = el.value; A.save(); return true;
      case 'psTitle': p.sections.find(function (x) { return x.id === el.getAttribute('data-id'); }).title = el.value; A.save(); return true;
      case 'pfMd': case 'psMd': {
        var images;
        if (act === 'pfMd') { if (k.indexOf('cf:') === 0) f.custom[k.slice(3)] = el.value; else f[k] = el.value; images = f.images; touch(f);
          var tb = document.querySelector('.pt-sectabs [data-id="' + k + '"] .dot'); if (tb) tb.classList.toggle('filled', el.value.trim() !== ''); }
        else { p.sections.find(function (x) { return x.id === k; }).md = el.value; images = p.images; A.save(); }
        clearTimeout(U._p); U._p = setTimeout(function () { var pv = document.getElementById('mdPrev'); if (pv) pv.innerHTML = R.md(el.value, images); }, 120);
        return true;
      }
    }
  });
  function refreshPreview() { var fr = document.getElementById('ptFrame'); if (fr) fr.srcdoc = reportHtml(); }
  A.ext.afterRender.push(function (v) {
    var p = P(); if (!p) return;
    K.navBadge('findings', p.findings.filter(function (f) { return (f.severity === 'critical' || f.severity === 'high') && ['open', 'notfixed', 'partial'].indexOf(f.retestStatus) >= 0; }).length, 'bad');
    if (v !== 'findings') return;
    if (U.tab === 'report') refreshPreview();
    if (U.tab === 'edit' && U.sec === '_all') { var fr = document.getElementById('ptOneFrame'); if (fr) fr.srcdoc = reportHtml({ only: [U.id], single: true }); }
    var ta = area();
    if (ta) {
      ta.addEventListener('paste', function (e) {
        var items = (e.clipboardData || {}).items || [];
        for (var i = 0; i < items.length; i++) if (items[i].kind === 'file' && /^image\//.test(items[i].type)) { e.preventDefault(); addImage(items[i].getAsFile()); return; }
      });
      ta.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'b' || e.key === 'i')) { e.preventDefault(); tool(e.key === 'b' ? 'bold' : 'italic'); }
        if ((e.ctrlKey || e.metaKey) && e.key === 's' && cur() && ta.getAttribute('data-field') === 'pfMd') { e.preventDefault(); e.stopPropagation(); snapshot(cur()); touch(cur()); A.toast(L('Zwischengespeichert', 'Draft saved')); var sv = document.getElementById('ptSaved'); if (sv) sv.textContent = L('zwischengespeichert ', 'draft saved ') + A.fmtDate(cur().savedAt, true); }
      });
    }
  });

  /* ------------------------------------------------------------------
   * Verknüpfungen: Roadmap, Pflichtenkalender, KPI, Hauptbericht
   * ---------------------------------------------------------------- */
  var CAT = { critical: 'veryhigh', high: 'high', medium: 'medium', low: 'low', info: 'low' };
  HA.Risk.roadmapKinds.push('pentest');
  HA.Risk.roadmapSources.push(function (state, opts, hp) {
    if (opts.assetId && !opts.includeProject) return state.pentest.findings.filter(function (f) { return f.assets.indexOf(opts.assetId) >= 0 && open_(f); }).map(rmItem(state, hp));
    return state.pentest.findings.filter(open_).map(rmItem(state, hp));
  });
  function open_(f) { return f.include !== false && f.severity !== 'info' && ['open', 'notfixed', 'partial'].indexOf(f.retestStatus) >= 0 && !f.measures.length; }
  function rmItem(state, hp) {
    return function (f) {
      return { kind: 'pentest', prio: hp.prioFromCat(CAT[f.severity]), cat: CAT[f.severity], score: Math.round((+f.cvss || R.SEV[f.severity].rank * 2) * 1.6), ref: f.id, title: f.title,
        asset: f.assets.map(function (id) { var a = state.assets.find(function (x) { return x.id === id; }); return a ? a.name : ''; }).filter(Boolean).join(', ') || 'Pentest',
        detail: R.sevLabel(f.severity) + (f.cvss ? ' · CVSS ' + f.cvss : ''), action: f.shortRec || HA.MD.plain(f.recommendation).slice(0, 200), owner: f.owner || '', due: f.due || '', status: L(R.RETEST[f.retestStatus][0], R.RETEST[f.retestStatus][1]), set: { type: 'pentest', id: f.id } };
    };
  }
  HA.Risk.roadmapWriters.pentest = function (state, set, k, v) { var f = state.pentest.findings.find(function (x) { return x.id === set.id; }); if (f) f[k] = v; };
  if (HA.Cal) HA.Cal.providers.push(function (s) {
    var out = [];
    s.pentest.findings.forEach(function (f) {
      if (f.retestDate && f.retestStatus === 'open') out.push({ key: 'PTR:' + f.id, date: f.retestDate, title: L('Re-Test', 'Retest') + ' ' + f.id + ': ' + f.title, sub: R.sevLabel(f.severity), cat: 'audit', src: 'review', owner: f.retestBy || f.tester, go: 'findings' });
      if (f.due && ['open', 'notfixed', 'partial'].indexOf(f.retestStatus) >= 0 && !f.measures.length) out.push({ key: 'PTD:' + f.id, date: f.due, title: L('Behebung', 'Remediation') + ' ' + f.id + ': ' + f.title, sub: R.sevLabel(f.severity), cat: 'measure', src: 'roadmap', owner: f.owner, go: 'findings', remind: 7 });
    });
    return out;
  });
  if (HA.KPI) HA.KPI.DEFS.push({ id: 'pentest', g: 'vuln', u: '#', dir: 'down', t: 0, w: 1, go: 'findings', n: ['Offene kritische/hohe Pentest-Findings', 'Open critical/high pentest findings'],
    calc: function (s) { var l = s.pentest.findings; if (!l.length) return { v: null, gap: L('Pentest-Findings erfassen', 'Record pentest findings') };
      return { v: l.filter(function (f) { return (f.severity === 'critical' || f.severity === 'high') && ['open', 'notfixed', 'partial'].indexOf(f.retestStatus) >= 0; }).length, d: l.length + ' Findings' }; } });
  A.ext.reportOpts.push({ key: 'pentest', label: { de: 'Pentest-Findings (Übersicht)', en: 'Pentest findings (overview)' }, def: false });
  HA.Report.ext.push({ key: 'pentest', build: function (state, scope, H) {
    var list = R.selection(state.pentest, { includeDrafts: false, minSev: 'info' }); if (!list.length) return '';
    return '<section class="pb"><h2>' + H.esc(L('Pentest-Findings (Übersicht)', 'Pentest findings (overview)')) + '</h2><p class="small">' + H.esc(L('Details im separaten Pentest-Bericht.', 'Details in the separate pentest report.')) + '</p><table><thead><tr><th style="width:16mm">ID</th><th>' + H.esc(L('Finding', 'Finding')) + '</th><th style="width:22mm">' + H.esc(L('Schwere', 'Severity')) + '</th><th style="width:12mm">CVSS</th><th style="width:26mm">Re-Test</th></tr></thead><tbody>' +
      list.map(function (f) { return '<tr><td><b>' + H.esc(f.id) + '</b></td><td>' + H.esc(f.title) + (f.shortRec ? '<div class="small muted">' + H.esc(f.shortRec) + '</div>' : '') + '</td><td><b style="color:' + R.SEV[f.severity].c + '">' + H.esc(R.sevLabel(f.severity)) + '</b></td><td>' + H.esc(f.cvss || '–') + '</td><td>' + H.esc(L(R.RETEST[f.retestStatus][0], R.RETEST[f.retestStatus][1])) + '</td></tr>'; }).join('') + '</tbody></table></section>';
  } });

  return { cvssScore: cvssScore, parseVector: parseVector, newFinding: newFinding, open: open, U: U };
})();

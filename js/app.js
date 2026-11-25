/* =====================================================================
 * app.js – Oberfläche und Anwendungslogik
 * ---------------------------------------------------------------------
 * Gliederung:
 *   A. Zustand (State) & Speicherung
 *   B. Kataloge, Bibliotheken, Anwendbarkeit & Kennzahlen
 *   C. Hilfsfunktionen (Escaping, Formatierung, Dialoge, Toasts)
 *   D. Ansichten (Views): Übersicht, Assets, Schutzbedarf, Checkliste,
 *      Bibliotheken, Scans, Import, Anleitungen, Bericht, Einstellungen
 *   E. Import-Verarbeitung (Scans, Kataloge, OpenSCAP-Automatik)
 *   F. Ereignisbehandlung (Event-Delegation) & Start
 *
 * Datenmodell (vereinfacht):
 *   state.assets[] = { id, name, hostname, ip, os, osVersion, role, owner,
 *       location, description, approach, showH, libs[], sb{c,i,a,cNote,…},
 *       checks{ "<lib>|<ref>": {status, justification, note, evidence,
 *       responsible, due, verResult, verDate, verMethod, verBy, scanResult,
 *       scanDate, autoNote, updated} }, scans[] }
 *   state.catalogs[]   – importierte Kataloge (Grundschutz++, SSG-Profile …)
 *   state.customItems[] – eigene Maßnahmen
 * ===================================================================== */
window.HA = window.HA || {};

HA.App = (function () {
  'use strict';
  var t = HA.t, tx = HA.tx;

  /* =================================================================
   * A. Zustand & Speicherung
   * =============================================================== */
  var state = null;
  var ui = {
    view: 'dashboard', assetId: null,
    cl: { q: '', lib: '', topic: '', level: '', status: '', groupBy: 'group' },
    openItems: {}, guide: null, libOs: 'debian', libBrowse: '', libBrowseQ: '',
    scanSev: 'info', scanOnlyOpen: false,
    importType: '', importTarget: '', importLog: [], pendingXccdf: null, pendingScans: [],
    report: { asset: 'all', cmds: false, open: true, findings: true, desc: false, risk: true, pm: true, swot: true, roadmap: true, tom: true },
    risk: { asset: '', cat: '', treat: '', q: '', cell: '', closed: false, unrated: false },
    rm: { asset: '', kind: '', overdue: false },
    pmTab: 'risks'
  };
  var saveTimer = null;

  /* -----------------------------------------------------------------
   * Erweiterungs-Schnittstelle (für js/modules/*.js)
   * Module registrieren Ansichten, Ereignis-Handler, Einstellungs- und
   * Übersichtskarten sowie Normalisierung. Handler geben true zurück,
   * wenn sie ein Ereignis vollständig behandelt haben.
   * --------------------------------------------------------------- */
  var EXT = { click: [], change: [], input: [], afterRender: [], normalize: [], settingsCards: [], dashCards: [], reportOpts: [], beforeSave: [] };
  function runExt(list, a, b, c) { for (var i = 0; i < list.length; i++) { if (list[i](a, b, c) === true) return true; } return false; }

  function defaultState() {
    var now = new Date().toISOString();
    return { app: 'hardening-audit', version: 1,
      meta: { org: '', auditor: '', lang: 'de', theme: 'auto', staleDays: 90, created: now, updated: now },
      catalogs: [], customItems: [], assets: [], projectRisks: [], projectChances: [], seq: 1, riskSeq: 1, pmSeq: 1, chSeq: 1 };
  }
  /** Fehlende Felder ergänzen (z. B. nach Laden älterer Dateien). */
  function normalize(s) {
    var d = defaultState();
    s = s || d;
    s.meta = Object.assign({}, d.meta, s.meta || {});
    ['catalogs', 'customItems', 'assets'].forEach(function (k) { if (!Array.isArray(s[k])) s[k] = []; });
    s.assets.forEach(function (a) {
      a.checks = a.checks || {}; a.scans = a.scans || []; a.libs = a.libs || []; a.sb = a.sb || { c: 'normal', i: 'normal', a: 'normal' };
      a.approach = a.approach || 'standard';
      a.kind = a.kind || 'system';                       // Zielobjekt-Typ (Geltungsbereich), ältere Stände = IT-System
      if (!Array.isArray(a.modules)) a.modules = [];     // modellierte IT-Grundschutz-Bausteine
    });
    s.app = 'hardening-audit'; s.seq = s.seq || 1;
    if (!Array.isArray(s.projectRisks)) s.projectRisks = [];
    if (!Array.isArray(s.projectChances)) s.projectChances = [];
    s.chSeq = s.chSeq || (s.projectChances.length + 1);
    s.swot = Object.assign({ subject: '', s: '', w: '', o: '', t: '', so: '', st: '', wo: '', wt: '' }, s.swot || {});
    s.meta.brand = Object.assign({ logo: '', subtitle: '', address: '', contact: '', web: '', color: '#1f6feb', useInApp: false, logoInApp: true, footer: '', reportTitle: '' }, s.meta.brand || {});
    s.pmSeq = s.pmSeq || (s.projectRisks.length + 1); s.riskSeq = s.riskSeq || 1;
    HA.Risk.ensureIds(s);   // Risiko-IDs für alle aktuellen Befunde
    EXT.normalize.forEach(function (fn) { fn(s); });   // Module ergänzen ihre Datenbereiche
    return s;
  }
  function uid(p) { return (p || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /** Speichert verzögert (Debounce), um bei Texteingaben nicht jede Taste zu schreiben. */
  function scheduleSave() {
    state.meta.updated = new Date().toISOString();
    setSaveState(t('save.saving'));
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      EXT.beforeSave.forEach(function (fn) { fn(state); });
      HA.Storage.save(state).then(function () {
        setSaveState(t('save.saved', { time: new Date().toLocaleTimeString(HA.lang === 'de' ? 'de-DE' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) }));
      }).catch(function () { setSaveState(t('save.error')); toast(t('save.error'), true); });
    }, 400);
  }
  function setSaveState(s) { var el = document.getElementById('saveState'); if (el) el.textContent = s; }

  function exportState() {
    var d = new Date(), pad = function (n) { return ('0' + n).slice(-2); };
    EXT.beforeSave.forEach(function (fn) { fn(state); });
    var name = 'little-riskbee_' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes()) + '.json';
    HA.Storage.exportFile(state, name);
    toast(t('msg.exported'));
  }

  /* =================================================================
   * B. Kataloge, Bibliotheken, Anwendbarkeit & Kennzahlen
   * =============================================================== */
  var itemCache = null;
  function invalidate() { itemCache = null; }

  /** Alle Maßnahmen: eingebaut + importierte Kataloge + eigene. */
  function allItems() {
    if (itemCache) return itemCache;
    var list = HA.builtinItems().slice();
    state.catalogs.forEach(function (c) { c.items.forEach(function (it) { it.lib = c.lib; list.push(it); }); });
    state.customItems.forEach(function (it) { list.push(it); });
    // Baustein-Gesamtbewertung je Baustein (wird nur angezeigt, wenn keine Einzelanforderungen vorliegen)
    VIRT = {};
    HA.GS.BAUSTEINE.forEach(function (b) {
      var v = { lib: 'gsmod', ref: b.id, group: b.id, level: 'B', topic: LAYER_TOPIC[b.layer] || 'planning', os: null, role: 'any', virtual: true,
        title: { de: 'Baustein ' + b.id + ' ' + b.de + ' – Gesamtbewertung', en: 'Module ' + b.id + ' ' + b.en + ' – overall assessment' },
        desc: { de: b.d.de + ' Bewerten Sie, ob die Anforderungen des Bausteins insgesamt erfüllt sind. Einzelanforderungen: Kompendium (XML) unter „Import“ laden oder eigene Anforderungen zum Baustein ergänzen.',
          en: b.d.en + ' Assess whether the module requirements are met overall. Individual requirements: import the compendium (XML) or add custom requirements for the module.' } };
      VIRT[b.id] = v; list.push(v);
    });
    list.forEach(function (it, i) { it._i = i; it._key = it.lib + '|' + it.ref; });
    itemCache = list;
    return list;
  }
  var VIRT = {};
  var LAYER_TOPIC = { ISMS: 'planning', ORP: 'planning', CON: 'planning', OPS: 'availability', DER: 'integrity', APP: 'install', SYS: 'install', IND: 'availability', NET: 'network', INF: 'availability' };
  var GS_BS = /^(?:ISMS|ORP|CON|OPS|DER|APP|SYS|IND|NET|INF)(?:\.\d+)+$/, GS_REQ = /^((?:ISMS|ORP|CON|OPS|DER|APP|SYS|IND|NET|INF)(?:\.\d+)+)\.A\d+/;
  /** IT-Grundschutz-Baustein einer Maßnahme (z. B. "SYS.1.3") oder '' (SSG, Baselines …). */
  function bausteinOf(it) {
    if (GS_BS.test(it.group || '')) return it.group;
    var m = GS_REQ.exec(it.ref || ''); return m ? m[1] : '';
  }
  function assetKind(a) { return (a && a.kind) || 'system'; }
  /** Assets nach Zielobjekt-Typ gruppiert (Reihenfolge des Schichtenmodells). */
  function kindGroups(list) {
    list = list || state.assets;
    return HA.GS.KINDS.map(function (k) { return { kind: k, assets: list.filter(function (a) { return assetKind(a) === k.id; }) }; }).filter(function (g) { return g.assets.length; });
  }
  function kindLabel(a) { var k = HA.GS.kind(assetKind(a)); return k.icon + ' ' + tx(k); }
  function itemKey(it) { return it._key || (it.lib + '|' + it.ref); }

  /** Bibliotheks-Metadaten (eingebaut oder importiert). */
  function getLib(id) {
    var c = state.catalogs.find(function (x) { return x.lib === id; });
    if (c) {
      var base = HA.LIBRARIES.find(function (l) { return l.id === id; });
      return { id: id, short: c.short || (base && base.short) || c.name, color: c.color || (base && base.color) || '#64748b',
        name: { de: c.name, en: c.name }, desc: base ? base.desc : { de: c.source || '', en: c.source || '' }, version: c.version, imported: true, catalog: c,
        license: base ? base.license : '', url: base ? base.url : '', reference: base ? base.reference : null };
    }
    return HA.libById(id);
  }
  /** Alle Bibliotheken, die Maßnahmen liefern (für Auswahl & Vergleich). */
  function usableLibs() {
    var ids = [];
    HA.LIBRARIES.forEach(function (l) { if (l.builtin) ids.push(l.id); });
    state.catalogs.forEach(function (c) { if (ids.indexOf(c.lib) < 0) ids.push(c.lib); });
    return ids;
  }

  function osFamily(asset) { return HA.osById(asset.os).family; }
  function assetRole(asset) { return asset.role || HA.osById(asset.os).role; }
  var RANK = { normal: 0, high: 1, veryhigh: 2 };
  function overallProtection(asset) {
    var sb = asset.sb || {}; var m = 'normal';
    ['c', 'i', 'a'].forEach(function (k) { if (RANK[sb[k] || 'normal'] > RANK[m]) m = sb[k]; });
    return m;
  }
  /** Erlaubte Anforderungsniveaus gemäß Vorgehensweise und Schutzbedarf. */
  function allowedLevels(asset) {
    var ap = asset.approach || 'standard';
    if (ap === 'basis') return ['B'];
    if (ap === 'kern' || asset.showH || overallProtection(asset) !== 'normal') return ['B', 'S', 'H'];
    return ['B', 'S'];
  }
  /** Passt eine Maßnahme technisch zum Asset (OS, Rolle, Distribution)? */
  function matchesPlatform(it, asset) {
    var fam = osFamily(asset), role = assetRole(asset);
    if (it.os && it.os.length && it.os.indexOf(fam) < 0) return false;
    if (it.role && it.role !== 'any' && it.role !== role) return false;
    if (it.distros && it.distros.indexOf(asset.os) < 0) return false;
    return true;
  }
  /** Für das Asset anwendbare Maßnahmen (Bibliothek + Plattform + Niveau). */
  /* Regeln:
   *  – IT-Systeme: wie bisher Bibliothek + Plattform (OS/Rolle). Sind Bausteine modelliert,
   *    gelten Grundschutz-Anforderungen nur für diese Bausteine.
   *  – Andere Zielobjekt-Typen (Prozesse, Anwendungen, Netze, Räume, ICS): alle Grundschutz-
   *    Anforderungen (eingebaut, importiert, eigene) der modellierten Bausteine.
   *  – Modellierte Bausteine ohne Einzelanforderungen erscheinen als Baustein-Gesamtbewertung. */
  function applicableItems(asset, ignoreLevel) {
    var lv = allowedLevels(asset), sys = assetKind(asset) === 'system', mods = asset.modules || [], useMods = mods.length > 0, covered = {};
    var list = allItems().filter(function (it) {
      if (it.lib === 'gsmod') return false;
      var bs = bausteinOf(it);
      if (it.lib === 'custom') {
        if (it.assetId && it.assetId !== asset.id) return false;
        if (!it.assetId && asset.libs.indexOf('custom') < 0) return false;
        if (!it.assetId && bs && useMods && mods.indexOf(bs) < 0) return false;
      } else if (bs) {
        if (useMods) { if (mods.indexOf(bs) < 0) return false; if (sys && asset.libs.indexOf(it.lib) < 0) return false; }
        else if (!sys || asset.libs.indexOf(it.lib) < 0) return false;
      } else if (!sys || asset.libs.indexOf(it.lib) < 0) return false;
      if (sys && !matchesPlatform(it, asset)) return false;
      if (bs && it.lib !== 'custom') covered[bs] = true;
      if (!ignoreLevel && lv.indexOf(it.level || 'S') < 0) return false;
      return true;
    });
    if (useMods) mods.forEach(function (bs) { if (!covered[bs] && VIRT[bs]) list.push(VIRT[bs]); });
    return list;
  }
  /** Prüfbefehl passend zum Asset: erst distributionsspezifisch (z. B. "fedora"), dann Plattform-Familie. */
  function checkCmd(it, asset) {
    if (!it.check) return '';
    return it.check[asset.os] || it.check[osFamily(asset)] || '';
  }
  function getCheck(asset, it) { return asset.checks[itemKey(it)] || {}; }
  function setCheck(asset, it, patch) {
    var k = itemKey(it);
    asset.checks[k] = Object.assign({}, asset.checks[k] || {}, patch, { updated: new Date().toISOString() });
    scheduleSave();
  }
  /** Kennzahlen eines Assets. */
  function assetStats(asset, items) {
    items = items || applicableItems(asset);
    var s = { total: items.length, open: 0, done: 0, partial: 0, notdone: 0, na: 0, verified: 0, missingJust: 0 };
    items.forEach(function (it) {
      var c = getCheck(asset, it); var st = c.status || 'open'; s[st]++;
      if (c.verResult === 'effective') s.verified++;
      if ((st === 'na' || st === 'notdone') && !c.justification) s.missingJust++;
    });
    s.applicable = s.total - s.na;
    s.pct = s.applicable ? Math.round((s.done + s.partial * 0.5) / s.applicable * 100) : 0;
    return s;
  }
  function openFindings(asset) {
    var n = 0;
    (asset.scans || []).forEach(function (sc) { (sc.findings || []).forEach(function (f) { if ((f.status || 'open') === 'open' || f.status === 'partial') { if (f.severity !== 'info') n++; } }); });
    return n;
  }
  function latestScan(asset, tool) {
    return (asset.scans || []).filter(function (s) { return !tool || s.tool === tool; })
      .sort(function (a, b) { return (b.scanDate || b.importedAt).localeCompare(a.scanDate || a.importedAt); })[0] || null;
  }
  /** Gesamtstatus der Schwachstellen laut letztem OpenVAS-Scan. */
  function vulnOverall(asset) {
    var sc = latestScan(asset, 'openvas'); if (!sc) return 'open';
    var fs = (sc.findings || []).filter(function (f) { return f.severity !== 'info'; });
    var open = fs.filter(function (f) { return (f.status || 'open') === 'open'; }).length;
    var partial = fs.filter(function (f) { return f.status === 'partial'; }).length;
    if (!open && !partial) return 'none';
    if (open === fs.length) return 'open';
    return 'partial';
  }

  /* =================================================================
   * C. Hilfsfunktionen
   * =============================================================== */
  var esc = HA.Report.esc;
  function fmtDate(iso, withTime) {
    if (!iso) return '–';
    var d = new Date(iso); if (isNaN(d)) return esc(iso);
    return d.toLocaleString(HA.lang === 'de' ? 'de-DE' : 'en-GB', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
  }
  function daysSince(iso) { return iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : Infinity; }
  function toast(msg, err) {
    var box = document.getElementById('toasts');
    while (box.children.length >= 3) box.removeChild(box.firstChild);   // höchstens drei Meldungen gleichzeitig
    var el = document.createElement('div'); el.className = 'toast' + (err ? ' err' : ''); el.textContent = msg;
    box.appendChild(el);
    setTimeout(function () { el.remove(); }, err ? 7000 : 3500);
  }
  function libBadge(id) { var l = getLib(id); return '<span class="badge badge-lib" style="background:' + esc(l.color) + '">' + esc(l.short) + '</span>'; }
  function levelBadge(lv) { return lv ? '<span class="badge lvl-' + esc(lv) + '" title="' + esc(t('level.' + lv)) + '">' + esc(lv) + '</span>' : ''; }
  function statusBadge(st) { return '<span class="badge st-' + st + '">' + esc(t('status.' + st)) + '</span>'; }
  function sevBadge(s) { return '<span class="badge sev-' + esc(s) + '">' + esc(s) + '</span>'; }
  function progressBar(s) {
    var tot = Math.max(1, s.total);
    return '<div class="progress" role="img" aria-label="' + s.pct + ' %">' + ['done', 'partial', 'notdone', 'na'].map(function (k) {
      return s[k] ? '<span class="p-' + k + '" style="width:' + (s[k] / tot * 100).toFixed(2) + '%"></span>' : '';
    }).join('') + '</div>';
  }
  function legend() {
    return '<div class="legend">' + [['done', 'var(--ok)'], ['partial', 'var(--partial)'], ['notdone', 'var(--danger)'], ['na', 'var(--na)'], ['open', 'var(--surface-2)']].map(function (x) {
      return '<span><i style="background:' + x[1] + ';border:1px solid var(--border)"></i>' + esc(t('status.' + x[0])) + '</span>'; }).join('') + '</div>';
  }
  function codeBlock(code) {
    return '<div class="code"><button type="button" class="btn btn-sm copy" data-act="copy">' + esc(t('btn.copy')) + '</button><pre>' + esc(code) + '</pre></div>';
  }
  /* Personenfelder: Auswahlliste der Ansprechpersonen (Einstellungen) anbieten.
     Ein <datalist> erlaubt Drop-Down-Auswahl UND freie Eingabe. */
  var PERSON_SEL = 'input[name=owner],input[name=person],input[name=deputy],input[name=lead],input[name=evaluatedBy],input[name=approvedBy],input[name=by],' +
    'input[data-field=responsible],input[data-field=verBy],input[data-k=owner],input[data-person]';
  function decoratePersons(root) {
    if (!root || !document.getElementById('dl-contacts')) return;
    root.querySelectorAll(PERSON_SEL).forEach(function (inp) { if (inp.type === 'text' || !inp.getAttribute('type')) { inp.setAttribute('list', 'dl-contacts'); inp.setAttribute('autocomplete', 'off'); } });
  }
  function opt(value, label, sel) { return '<option value="' + esc(value) + '"' + (String(sel) === String(value) ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  function assetSelect(id, current, withEmpty, emptyLabel) {
    var groups = kindGroups();
    return '<select id="' + id + '" data-act="' + id + '">' + (withEmpty ? opt('', emptyLabel || '–', current) : '') +
      (groups.length > 1 ? groups.map(function (g) { return '<optgroup label="' + esc(g.kind.icon + ' ' + tx(g.kind)) + '">' + g.assets.map(function (a) { return opt(a.id, a.name, current); }).join('') + '</optgroup>'; }).join('')
        : state.assets.map(function (a) { return opt(a.id, a.name, current); }).join('')) + '</select>';
  }
  function currentAsset() {
    var a = state.assets.find(function (x) { return x.id === ui.assetId; });
    if (!a && state.assets.length) { a = state.assets[0]; ui.assetId = a.id; }
    return a || null;
  }
  function groupLabel(it) {
    var bs = bausteinOf(it);
    if (bs) return bs + ' ' + (HA.GS.title(bs) || '');
    if (it.lib === 'gspp' && it.group) return 'Grundschutz++ › ' + it.group;
    return getLib(it.lib).short + ' – ' + tx(HA.topicById(it.topic));
  }

  /** Einfacher modaler Dialog. fields: HTML; onOk(form) → true = schließen */
  function dialog(title, bodyHtml, onOk, okLabel) {
    var dlg = document.getElementById('dlg'), old = document.getElementById('dlgForm');
    // Formular jedes Mal frisch anlegen: entfernt Ereignis-Listener und Breiten-Klassen des vorherigen Dialogs
    var form = old.cloneNode(false); form.className = ''; old.parentNode.replaceChild(form, old);
    form.innerHTML = '<h2>' + esc(title) + '</h2>' + bodyHtml +
      '<div class="dlg-actions"><button type="button" class="btn" value="cancel" data-dlg="cancel">' + esc(t('btn.cancel')) + '</button>' +
      '<button type="submit" class="btn btn-primary" value="ok">' + esc(okLabel || t('btn.ok')) + '</button></div>';
    form.onsubmit = function (e) {
      e.preventDefault();
      if (!onOk || onOk(form) !== false) dlg.close();
    };
    form.querySelector('[data-dlg=cancel]').onclick = function () { dlg.close(); };
    dlg.showModal();
    decoratePersons(form);
    var first = form.querySelector('input,select,textarea'); if (first) first.focus();
    return form;
  }
  function confirmDlg(msg, onYes) { dialog('⚠ ' + (HA.lang === 'de' ? 'Bitte bestätigen' : 'Please confirm'), '<p>' + esc(msg) + '</p>', function () { onYes(); }); }

  /* =================================================================
   * D. Ansichten
   * =============================================================== */
  var V = {};

  /* ---------- Übersicht ---------- */
  V.dashboard = function () {
    var h = ['<div class="page-head"><div><h1>' + esc(t('dash.title')) + '</h1><p>' + esc(t('dash.sub')) + '</p></div>',
      '<button class="btn btn-primary" data-act="newAsset">' + esc(t('btn.newAsset')) + '</button></div>'];
    var tot = { total: 0, done: 0, partial: 0, notdone: 0, na: 0, open: 0, applicable: 0 }, findings = 0;
    var rows = state.assets.map(function (a) {
      var s = assetStats(a); ['total', 'done', 'partial', 'notdone', 'na', 'open', 'applicable'].forEach(function (k) { tot[k] += s[k]; });
      var of = openFindings(a); findings += of;
      var ls = latestScan(a, 'openvas');
      var stale = ls && daysSince(ls.scanDate || ls.importedAt) > (state.meta.staleDays || 90);
      return '<tr><td><a href="#checklist" data-act="openAsset" data-id="' + a.id + '"><b>' + esc(a.name) + '</b></a><div class="small muted">' + esc(a.hostname || a.ip || '') + '</div></td>' +
        '<td>' + typeCell(a) + '</td><td>' + esc(t('prot.' + overallProtection(a))) + '</td><td>' + modelCell(a) + '</td>' +
        '<td style="min-width:160px">' + progressBar(s) + '<div class="small muted">' + s.pct + ' % · ' + s.done + '/' + s.applicable + (s.missingJust ? ' · <span style="color:var(--danger)">⚠ ' + s.missingJust + ' ' + esc(t('cl.missingJust')) + '</span>' : '') + '</div></td>' +
        '<td>' + (ls ? fmtDate(ls.scanDate || ls.importedAt) + (stale ? '<div class="small" style="color:var(--warn)">⚠ ' + esc(t('dash.staleScan', { days: state.meta.staleDays })) + '</div>' : '') : '<span class="muted">' + esc(t('dash.noScan')) + '</span>') + '</td>' +
        '<td class="num">' + of + '</td></tr>';
    });
    tot.pct = tot.applicable ? Math.round((tot.done + tot.partial * 0.5) / tot.applicable * 100) : 0;
    h.push('<div class="grid grid-4">' +
      '<div class="card stat"><div class="value">' + state.assets.length + '</div><div class="label">' + esc(t('dash.assets')) + '</div></div>' +
      '<div class="card stat"><div class="value">' + tot.applicable + '</div><div class="label">' + esc(t('dash.measures')) + '</div></div>' +
      '<div class="card stat"><div class="value">' + tot.pct + ' %</div><div class="label">' + esc(t('dash.progress')) + '</div></div>' +
      '<div class="card stat"><div class="value">' + findings + '</div><div class="label">' + esc(t('dash.findings')) + '</div></div></div>');
    h.push(pdcaCard());
    var extCards = EXT.dashCards.map(function (fn) { return fn(); }).filter(Boolean);   // z. B. Fällige Pflichten, KPI
    if (extCards.length) h.push('<div class="grid grid-2 dash-ext">' + extCards.join('') + '</div>');
    if (!state.assets.length) {
      h.push('<div class="card"><h2>' + esc(t('dash.start')) + '</h2><ol><li>' + esc(t('dash.step1')) + '</li><li>' + esc(t('dash.step2')) + '</li><li>' + esc(t('dash.step3')) + '</li><li>' + esc(t('dash.step4')) +
        '</li></ol><div class="row"><button class="btn btn-primary" data-act="newAsset">' + esc(t('btn.newAsset')) + '</button><a class="btn" href="#guides">' + esc(t('nav.guides')) + '</a><a class="btn" href="#libraries">' + esc(t('nav.libraries')) + '</a></div></div>');
    } else {
      h.push('<div class="card"><h2>' + esc(t('dash.perAsset')) + '</h2><div class="table-wrap"><table><thead><tr><th>' + esc(t('c.asset')) + '</th><th>' + esc(L2('Typ / Betriebssystem', 'Type / OS')) + '</th><th>' + esc(t('nav.protection')) + '</th><th>' + esc(t('c.libraries')) +
        '</th><th>' + esc(t('c.progress')) + '</th><th>' + esc(t('dash.lastScan')) + '</th><th class="num">' + esc(t('dash.findings')) + '</th></tr></thead><tbody>' + groupedRows(rows, 7) + '</tbody></table></div>' + legend() + '</div>');
    }
    if (state.assets.length) {
      var rr = HA.Risk.findingRows(state, {});
      if (rr.length) h.push('<div class="card"><h2>' + esc(t('risk.heatmap')) + '</h2>' + HA.Risk.heatmapHtml(rr, { cell: 58 }) + HA.Risk.legendHtml() +
        '<div class="row" style="margin-top:.5rem"><a class="btn btn-sm" href="#risk">' + esc(t('nav.risk')) + ' →</a><a class="btn btn-sm" href="#roadmap">' + esc(t('nav.roadmap')) + ' →</a></div></div>' + tomCard());
      else h.push(tomCard());
    }
    var mode = HA.Storage.mode();
    h.push('<div class="note' + (mode === 'mem' ? ' warn' : '') + '">' + esc(t('dash.storage', { mode: t('store.' + mode) })) + ' · ' + esc(t('dash.notSavedFile')) + '</div>');
    return h.join('');
  };
  function L2(de, en) { return HA.lang === 'en' ? en : de; }
  /** Zeilen (gleiche Reihenfolge wie state.assets) mit Gruppenköpfen je Zielobjekt-Typ. */
  function groupedRows(rows, cols) {
    var groups = kindGroups();
    if (groups.length < 2) return rows.join('');
    return groups.map(function (g) {
      return '<tr class="grp-row"><th colspan="' + cols + '">' + esc(g.kind.icon + ' ' + tx(g.kind)) + ' <span class="muted small">(' + g.assets.length + ')</span></th></tr>' +
        g.assets.map(function (a) { return rows[state.assets.indexOf(a)]; }).join('');
    }).join('');
  }
  /** Spalte „Typ“: Betriebssystem bei IT-Systemen, sonst Zielobjekt-Typ. */
  function typeCell(a) {
    if (assetKind(a) === 'system') return esc(tx(HA.osById(a.os)));
    return esc(kindLabel(a)) + (a.osVersion ? '<div class="small muted">' + esc(a.osVersion) + '</div>' : '');
  }
  /** Spalte „Modellierung“: Bibliotheken + modellierte Bausteine. */
  function modelCell(a) {
    var mods = a.modules || [];
    return (assetKind(a) === 'system' ? a.libs.map(libBadge).join(' ') : a.libs.filter(function (l) { return l === 'custom'; }).map(libBadge).join(' ')) +
      (mods.length ? '<div class="mod-chips">' + mods.slice(0, 6).map(function (m) { return '<span class="chip chip-gs" title="' + esc(HA.GS.title(m)) + '">' + esc(m) + '</span>'; }).join('') +
        (mods.length > 6 ? '<span class="chip chip-gs" title="' + esc(mods.slice(6).join(', ')) + '">+' + (mods.length - 6) + '</span>' : '') + '</div>' : '');
  }

  /* ---------- PDCA-Zyklus (Übersicht) ---------- */
  /** Kennzahlen je PDCA-Phase aus dem aktuellen Stand ableiten. */
  function pdcaCard() {
    var n = state.assets.length;
    var sbOk = state.assets.filter(function (a) { return a.sb && a.sb.cNote && a.sb.iNote && a.sb.aNote; }).length;
    var withLib = state.assets.filter(function (a) { return (a.libs || []).length || (a.modules || []).length; }).length;
    var pmRated = state.projectRisks.length;
    var tot = { done: 0, partial: 0, applicable: 0, verified: 0, missingJust: 0 };
    state.assets.forEach(function (a) { var s = assetStats(a); Object.keys(tot).forEach(function (k) { tot[k] += s[k]; }); });
    var pct = tot.applicable ? Math.round((tot.done + tot.partial * 0.5) / tot.applicable * 100) : 0;
    var withScan = state.assets.filter(function (a) { return (a.scans || []).some(function (s) { return s.tool === 'openvas'; }); }).length;
    var rows = HA.Risk.findingRows(state, {}), rated = rows.filter(function (r) { return !r.suggested; }).length;
    var rm = HA.Risk.roadmap(state, { includeProject: true });
    var p1 = rm.filter(function (x) { return x.prio === 'p1'; }).length, overdue = rm.filter(function (x) { return x.overdue; }).length;
    function m(label, val, warn) { return '<li><span>' + esc(label) + '</span><b' + (warn ? ' style="color:var(--danger)"' : '') + '>' + val + '</b></li>'; }
    var phases = [
      { k: 'plan', go: 'assets', items: [m(t('pdca.m.sb'), sbOk + '/' + n, sbOk < n), m(t('pdca.m.libs'), withLib + '/' + n, withLib < n), m(t('pdca.m.pm'), pmRated)] },
      { k: 'do', go: 'checklist', items: [m(t('pdca.m.impl'), pct + ' %'), m(t('pdca.m.just'), tot.missingJust, tot.missingJust > 0)] },
      { k: 'check', go: 'risk', items: [m(t('pdca.m.scan'), withScan + '/' + n, withScan < n), m(t('pdca.m.ver'), tot.verified), m(t('pdca.m.rated'), rated + '/' + rows.length, rated < rows.length)] },
      { k: 'act', go: 'roadmap', items: [m(t('pdca.m.p1'), p1, p1 > 0), m(t('pdca.m.overdue'), overdue, overdue > 0)] }
    ];
    return '<div class="card"><h2>' + esc(t('pdca.title')) + '</h2><p class="small muted">' + esc(t('pdca.sub')) + '</p><div class="pdca">' + phases.map(function (ph) {
      return '<a class="pdca-step pdca-' + ph.k + '" href="#' + ph.go + '"><div class="pdca-head"><span class="pdca-letter">' + t('pdca.' + ph.k).charAt(0) + '</span><b>' + esc(t('pdca.' + ph.k)) + '</b></div>' +
        '<p class="small">' + esc(t('pdca.' + ph.k + 'D')) + '</p><ul>' + ph.items.join('') + '</ul><span class="small pdca-go">' + esc(t('pdca.goto')) + ' →</span></a>';
    }).join('') + '</div></div>';
  }

  /* ---------- Assets ---------- */
  V.assets = function () {
    var h = ['<div class="page-head"><div><h1>' + esc(t('assets.title')) + '</h1><p>' + esc(t('assets.sub')) + '</p></div><button class="btn btn-primary" data-act="newAsset">' + esc(t('btn.newAsset')) + '</button></div>'];
    if (!state.assets.length) h.push('<div class="card muted">' + esc(t('dash.noAssets')) + '</div>');
    // Übersicht der Geltungsbereiche (Zielobjekt-Typen) mit Schnellanlage
    h.push('<div class="kind-bar no-print">' + HA.GS.KINDS.map(function (k) {
      var n = state.assets.filter(function (a) { return assetKind(a) === k.id; }).length;
      return '<button type="button" class="kind-pill' + (n ? ' has' : '') + '" data-act="newAsset" data-kind="' + k.id + '" title="' + esc(tx(k.hint)) + '"><span>' + k.icon + '</span> ' + esc(tx(k)) +
        ' <b>' + n + '</b><i>+</i></button>'; }).join('') + '</div>');
    kindGroups().forEach(function (g) {
      var sys = g.kind.id === 'system';
      h.push('<div class="card"><div class="row"><h2 style="margin:0">' + g.kind.icon + ' ' + esc(tx(g.kind)) + ' <span class="muted small">(' + g.assets.length + ')</span></h2><span class="spacer"></span>' +
        '<span class="small muted">' + esc(L2('Schichten: ', 'Layers: ') + g.kind.layers.join(', ')) + '</span><button class="btn btn-sm" data-act="newAsset" data-kind="' + g.kind.id + '">+ ' + esc(L2('Hinzufügen', 'Add')) + '</button></div>' +
        '<div class="table-wrap"><table><thead><tr><th>' + esc(t('c.name')) + '</th><th>' + esc(sys ? t('c.hostname') + ' / ' + t('c.ip') : L2('Kennung / Details', 'Identifier / details')) + '</th>' +
        (sys ? '<th>' + esc(t('c.os')) + '</th><th>' + esc(t('c.role')) + '</th>' : '') + '<th>' + esc(t('c.owner')) + '</th><th>' + esc(L2('Bibliotheken / Bausteine', 'Libraries / modules')) + '</th><th>' + esc(t('c.approach')) + '</th><th>' + esc(t('c.actions')) + '</th></tr></thead><tbody>');
      g.assets.forEach(function (a) {
        h.push('<tr><td><b>' + esc(a.name) + '</b><div class="small muted">' + esc(a.description || '') + '</div></td><td>' + esc(a.hostname || '–') + '<div class="small ' + (sys ? 'mono' : 'muted') + '">' + esc(a.ip || '') + '</div>' +
          (!sys && a.osVersion ? '<div class="small muted">' + esc(a.osVersion) + '</div>' : '') + '</td>' +
          (sys ? '<td>' + esc(tx(HA.osById(a.os))) + (a.osVersion ? '<div class="small muted">' + esc(a.osVersion) + '</div>' : '') + '</td><td>' + esc(t('c.' + assetRole(a))) + '</td>' : '') +
          '<td>' + esc(a.owner || '–') + '</td><td>' + modelCell(a) + '</td><td class="small">' + esc(t('approach.' + a.approach).split(' (')[0]) + '</td><td class="nowrap">' +
          '<button class="btn btn-sm" data-act="openAsset" data-id="' + a.id + '">✅</button> <button class="btn btn-sm" data-act="editAsset" data-id="' + a.id + '">' + esc(t('btn.edit')) + '</button> ' +
          '<button class="btn btn-sm" data-act="dupAsset" data-id="' + a.id + '" title="' + esc(t('btn.duplicate')) + '">⧉</button> <button class="btn btn-sm btn-danger" data-act="delAsset" data-id="' + a.id + '" aria-label="' + esc(t('btn.delete')) + '">🗑</button></td></tr>');
      });
      h.push('</tbody></table></div></div>');
    });
    return h.join('');
  };

  /* Feldbeschriftungen je Zielobjekt-Typ: host / ip / ver (null = Feld ausblenden) */
  var KIND_FIELDS = {
    system: { host: ['Hostname', 'Hostname'], ip: ['IP-Adresse(n)', 'IP address(es)'], ver: ['Version', 'Version'] },
    org: { host: ['Kurzbezeichnung / Geltungsbereich', 'Short name / scope'], ip: null, ver: null },
    app: { host: ['URL / Host', 'URL / host'], ip: ['Server / Plattform', 'Server / platform'], ver: ['Produkt / Version', 'Product / version'] },
    ind: { host: ['Anlagenkennzeichen', 'Plant identifier'], ip: ['IP / Feldbus', 'IP / fieldbus'], ver: ['Hersteller / Typ', 'Vendor / type'] },
    net: { host: ['Netz / VLAN', 'Network / VLAN'], ip: ['IP-Bereich', 'IP range'], ver: ['Komponenten', 'Components'] },
    inf: { host: ['Gebäude / Raum-Nr.', 'Building / room no.'], ip: null, ver: ['Ausstattung', 'Equipment'] }
  };
  /** Anzahl verfügbarer Einzelanforderungen je Baustein (eingebaut + importiert). */
  function reqCounts() {
    var c = {}; allItems().forEach(function (it) { if (it.lib === 'gsmod' || it.lib === 'custom') return; var b = bausteinOf(it); if (b) c[b] = (c[b] || 0) + 1; });
    return c;
  }
  /** Auswahl der Bausteine (Modellierung), gruppiert nach Schichten. */
  function modulePicker(mods, kind) {
    var cnt = reqCounts(), k = HA.GS.kind(kind);
    return HA.GS.LAYERS.map(function (L) {
      var list = HA.GS.BAUSTEINE.filter(function (b) { return b.layer === L.id; });
      var sel = list.filter(function (b) { return mods.indexOf(b.id) >= 0; }).length;
      return '<details class="mod-layer" data-layer="' + L.id + '"' + (k.layers.indexOf(L.id) >= 0 || sel ? ' open' : '') + '><summary><b>' + L.id + '</b> ' + esc(tx(L)) + ' <span class="badge st-open" data-cnt>' + sel + '/' + list.length + '</span></summary><div class="mod-grid">' +
        list.map(function (b) {
          return '<label title="' + esc(tx(b.d)) + '"><input type="checkbox" name="modules" value="' + esc(b.id) + '"' + (mods.indexOf(b.id) >= 0 ? ' checked' : '') + '> <span class="mono">' + esc(b.id) + '</span> ' + esc(tx(b)) +
            (cnt[b.id] ? ' <span class="muted small">(' + cnt[b.id] + ')</span>' : '') + '</label>';
        }).join('') + '</div></details>';
    }).join('');
  }

  /** Dialog zum Anlegen/Bearbeiten eines Assets (Zielobjekt). */
  function editAsset(asset, kindPre, modsPre) {
    var isNew = !asset;
    var a = asset || { name: '', hostname: '', ip: '', os: 'debian', osVersion: '', role: '', owner: '', location: '', description: '', approach: 'standard', showH: false,
      libs: ['bsi2023', 'ssg'], sb: { c: 'normal', i: 'normal', a: 'normal' }, kind: kindPre || 'system', modules: null };
    var kind = assetKind(a);
    var mods = a.modules ? a.modules.slice() : (modsPre || HA.GS.defaults(kind, a.os));
    function libChecks(osId) {
      var probe = { os: osId, role: '', libs: usableLibs(), approach: 'kern', sb: {}, id: '_' };
      return usableLibs().map(function (l) {
        var n = applicableItems(Object.assign({}, probe, { role: a.role }), true).filter(function (it) { return it.lib === l; }).length;
        return '<label><input type="checkbox" name="libs" value="' + esc(l) + '"' + (a.libs.indexOf(l) >= 0 ? ' checked' : '') + '> ' + libBadge(l) + ' ' + esc(tx(getLib(l).name)) + ' <span class="muted small">(' + n + ')</span></label>';
      }).join('<br>');
    }
    function kl(k, f) { var x = (KIND_FIELDS[k] || KIND_FIELDS.system)[f]; return x ? (HA.lang === 'en' ? x[1] : x[0]) : ''; }
    var body = '<div class="field"><label>' + esc(L2('Zielobjekt-Typ (Geltungsbereich)', 'Target object type (scope)')) + '</label><div class="kind-choice">' + HA.GS.KINDS.map(function (k) {
        return '<label class="seg-opt"><input type="radio" name="kind" value="' + k.id + '"' + (k.id === kind ? ' checked' : '') + '><span>' + k.icon + ' ' + esc(tx(k)) + '</span></label>'; }).join('') +
      '</div><div class="small muted" id="kindHint">' + esc(tx(HA.GS.kind(kind).hint)) + '</div></div>' +
      '<div class="grid grid-2">' +
      '<div class="field"><label>' + esc(t('c.name')) + ' *</label><input type="text" name="name" required value="' + esc(a.name) + '"></div>' +
      '<div class="field" data-kf="host"><label>' + esc(kl(kind, 'host')) + '</label><input type="text" name="hostname" value="' + esc(a.hostname) + '"></div>' +
      '<div class="field" data-kf="ip"><label>' + esc(kl(kind, 'ip')) + '</label><input type="text" name="ip" value="' + esc(a.ip) + '"></div>' +
      '<div class="field" data-kf="sys"><label>' + esc(t('c.os')) + '</label><select name="os">' + HA.OS.map(function (o) { return opt(o.id, tx(o), a.os); }).join('') + '</select></div>' +
      '<div class="field" data-kf="ver"><label>' + esc(kl(kind, 'ver')) + '</label><input type="text" name="osVersion" value="' + esc(a.osVersion) + '"></div>' +
      '<div class="field" data-kf="sys"><label>' + esc(t('c.role')) + '</label><select name="role">' + opt('', '(' + t('c.os') + ')', a.role) + opt('server', t('c.server'), a.role) + opt('client', t('c.client'), a.role) + '</select></div>' +
      '<div class="field"><label>' + esc(t('c.owner')) + '</label><input type="text" name="owner" value="' + esc(a.owner) + '"></div>' +
      '<div class="field"><label>' + esc(t('c.location')) + '</label><input type="text" name="location" value="' + esc(a.location) + '"></div></div>' +
      '<div class="field"><label>' + esc(t('c.description')) + '</label><textarea name="description">' + esc(a.description) + '</textarea></div>' +
      '<div class="field"><label>' + esc(t('c.approach')) + '</label><select name="approach">' + ['basis', 'standard', 'kern'].map(function (x) { return opt(x, t('approach.' + x), a.approach); }).join('') +
      '</select><div class="small muted">' + esc(t('assets.approachHint')) + '</div><label style="font-weight:400;margin-top:.3rem"><input type="checkbox" name="showH"' + (a.showH ? ' checked' : '') + '> ' + esc(t('assets.showH')) + '</label></div>' +
      '<div class="field"><label>' + esc(L2('Modellierung: IT-Grundschutz-Bausteine', 'Modelling: IT-Grundschutz modules')) + '</label><div class="small muted">' +
      esc(L2('Welche Bausteine gelten für dieses Zielobjekt? (Zahl) = vorhandene Einzelanforderungen; ohne Einzelanforderungen erscheint eine Baustein-Gesamtbewertung. Bei IT-Systemen ohne Auswahl gilt die automatische Zuordnung nach Betriebssystem.',
        'Which modules apply to this target object? (number) = available individual requirements; without them an overall module assessment is shown. For IT systems without selection, automatic assignment by OS applies.')) +
      '</div><div class="row" style="margin:.3rem 0">' + '<button type="button" class="btn btn-sm" data-mp="def">' + esc(L2('Vorschlag übernehmen', 'Apply suggestion')) + '</button><button type="button" class="btn btn-sm" data-mp="none">' + esc(L2('Keine', 'None')) + '</button>' +
      '<input type="search" data-mp="q" placeholder="' + esc(L2('Baustein suchen …', 'Search module …')) + '" style="max-width:220px"></div><div id="modPicker" class="mod-picker">' + modulePicker(mods, kind) + '</div></div>' +
      '<div class="field" data-kf="sys"><label>' + esc(t('c.libraries')) + '</label><div class="small muted">' + esc(t('assets.libsHint')) + '</div><div id="libChecks" class="small">' + libChecks(a.os) + '</div></div>';
    var form = dialog(isNew ? t('assets.new') : t('assets.edit'), body, function (f) {
      var fd = new FormData(f);
      var name = (fd.get('name') || '').trim();
      if (!name) { f.querySelector('[name=name]').classList.add('invalid'); toast(t('assets.nameRequired'), true); return false; }
      var target = asset || { id: uid('a'), checks: {}, scans: [], sb: a.sb, created: new Date().toISOString() };
      ['name', 'hostname', 'ip', 'os', 'osVersion', 'role', 'owner', 'location', 'description', 'approach'].forEach(function (k) { target[k] = (fd.get(k) || '').trim(); });
      target.showH = !!fd.get('showH');
      target.kind = fd.get('kind') || 'system';
      target.modules = fd.getAll('modules');
      target.libs = target.kind === 'system' ? fd.getAll('libs') : (target.libs || a.libs || []).filter(function (l) { return l === 'custom'; });
      if (isNew) state.assets.push(target);
      ui.assetId = target.id;
      invalidate(); scheduleSave(); render();
    }, t('btn.apply'));
    form.classList.add('dlg-wide');
    function checked() { return Array.prototype.map.call(form.querySelectorAll('[name=modules]:checked'), function (x) { return x.value; }); }
    function setMods(list) {
      form.querySelectorAll('[name=modules]').forEach(function (x) { x.checked = list.indexOf(x.value) >= 0; });
      counts();
    }
    function counts() {
      form.querySelectorAll('.mod-layer').forEach(function (d) { var all = d.querySelectorAll('[name=modules]'), on = d.querySelectorAll('[name=modules]:checked'); d.querySelector('[data-cnt]').textContent = on.length + '/' + all.length; });
    }
    function curKind() { var r = form.querySelector('[name=kind]:checked'); return r ? r.value : 'system'; }
    /** Felder passend zum Zielobjekt-Typ ein-/ausblenden und beschriften. */
    function applyKind(k) {
      form.querySelectorAll('[data-kf]').forEach(function (el) {
        var f = el.getAttribute('data-kf');
        if (f === 'sys') { el.hidden = k !== 'system'; return; }
        var lbl = kl(k, f); el.hidden = !lbl; if (lbl) el.querySelector('label').textContent = lbl;
      });
      form.querySelector('#kindHint').textContent = tx(HA.GS.kind(k).hint);
      var layers = HA.GS.kind(k).layers;
      form.querySelectorAll('.mod-layer').forEach(function (d) { if (layers.indexOf(d.getAttribute('data-layer')) >= 0) d.open = true; });
    }
    applyKind(kind);
    form.addEventListener('change', function (e) {
      var el = e.target;
      if (el.name === 'kind') {
        var k = el.value;
        // Vorschlag übernehmen, solange noch keine eigene Auswahl getroffen wurde
        var cur = checked(), prevDef = HA.GS.defaults(kind, form.querySelector('[name=os]').value);
        if (!cur.length || cur.join() === prevDef.join()) setMods(HA.GS.defaults(k, form.querySelector('[name=os]').value));
        kind = k; applyKind(k);
      } else if (el.name === 'modules') counts();
      else if (el.name === 'os') {
        // Bibliotheks-Zählung und OS-abhängige SYS-Bausteine aktualisieren
        a.libs = Array.prototype.map.call(form.querySelectorAll('[name=libs]:checked'), function (x) { return x.value; });
        a.role = form.querySelector('[name=role]').value;
        var fam = HA.osById(el.value).family;
        if (fam === 'windows' && a.libs.indexOf('msbaseline') < 0) a.libs.push('msbaseline');
        if (fam === 'macos' && a.libs.indexOf('mscp') < 0) a.libs.push('mscp');
        form.querySelector('#libChecks').innerHTML = libChecks(el.value);
        if (curKind() === 'system') {
          var m = checked().filter(function (x) { return HA.GS.OS_MODS.indexOf(x) < 0; });
          setMods(HA.GS.defaults('system', el.value).concat(m));
        }
      }
    });
    form.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mp]'); if (!b || b.tagName !== 'BUTTON') return;
      if (b.getAttribute('data-mp') === 'def') setMods(HA.GS.defaults(curKind(), form.querySelector('[name=os]').value));
      else setMods([]);
    });
    form.querySelector('[data-mp=q]').addEventListener('input', function (e) {
      var q = e.target.value.trim().toLowerCase();
      form.querySelectorAll('.mod-layer').forEach(function (d) {
        var any = false;
        d.querySelectorAll('label').forEach(function (l) { var hit = !q || l.textContent.toLowerCase().indexOf(q) >= 0; l.hidden = !hit; if (hit) any = true; });
        d.hidden = !any; if (q && any) d.open = true;
      });
    });
    form.querySelector('[data-mp=q]').addEventListener('keydown', function (e) { if (e.key === 'Enter') e.preventDefault(); });
  }

  /* ---------- Schutzbedarf ---------- */
  V.protection = function () {
    var h = ['<div class="page-head"><div><h1>' + esc(t('prot.title')) + '</h1><p>' + esc(t('prot.sub')) + '</p></div></div>',
      '<div class="note">' + esc(t('prot.help')) + '<br>' + esc(t('prot.ssgHint')) + '</div>'];
    if (!state.assets.length) { h.push('<div class="card muted">' + esc(t('dash.noAssets')) + '</div>'); return h.join(''); }
    var multi = kindGroups().length > 1;
    kindGroups().forEach(function (g) { if (multi) h.push('<h2 class="group-title">' + g.kind.icon + ' ' + esc(tx(g.kind)) + '</h2>'); g.assets.forEach(function (a) {
      var ov = overallProtection(a);
      h.push('<div class="card"><div class="row"><h2 style="margin:0">' + esc(a.name) + '</h2><span class="muted small">' + typeCell(a) + '</span><span class="spacer"></span>' +
        '<span>' + esc(t('prot.overall')) + ': <b class="badge ' + (ov === 'normal' ? 'lvl-B' : ov === 'high' ? 'fs-accepted' : 'lvl-H') + '">' + esc(t('prot.' + ov)) + '</b></span></div>' +
        '<div class="small muted" style="margin:.3rem 0 .6rem">' + esc(t('prot.effect')) + ': ' + esc(ov === 'normal' && !a.showH && a.approach !== 'kern' ? t('prot.effectNormal') : t('prot.effectHigh')) + ' · ' + esc(t('approach.' + a.approach)) + '</div>');
      h.push('<div class="table-wrap"><table><tbody>');
      ['c', 'i', 'a'].forEach(function (k) {
        var v = a.sb[k] || 'normal';
        h.push('<tr><td style="width:160px"><b>' + esc(t('prot.' + k)) + '</b></td><td style="width:260px"><div class="pb" role="group">' + HA.PROTECTION.map(function (p) {
          return '<button type="button" class="v-' + p + (v === p ? ' on' : '') + '" data-act="setSb" data-id="' + a.id + '" data-k="' + k + '" data-v="' + p + '" aria-pressed="' + (v === p) + '">' + esc(t('prot.' + p)) + '</button>';
        }).join('') + '</div></td><td><textarea data-field="sbNote" data-id="' + a.id + '" data-k="' + k + '" rows="2" placeholder="' + esc(t('prot.reasonPh')) + '"' +
          (!a.sb[k + 'Note'] ? ' class="invalid" title="' + esc(t('prot.missingReason')) + '"' : '') + '>' + esc(a.sb[k + 'Note'] || '') + '</textarea></td></tr>');
      });
      h.push('</tbody></table></div><div class="row end" style="margin-top:.5rem"><button class="btn btn-sm" data-act="openAsset" data-id="' + a.id + '">' + esc(t('btn.openChecklist')) + ' →</button></div></div>');
    }); });
    return h.join('');
  };

  /* ---------- Checkliste ---------- */
  V.checklist = function () {
    var a = currentAsset();
    var h = ['<div class="page-head"><div><h1>' + esc(t('cl.title')) + '</h1><p>' + esc(t('cl.sub')) + '</p></div></div>'];
    if (!a) { h.push('<div class="card muted">' + esc(t('cl.noAsset')) + ' <button class="btn btn-primary" data-act="newAsset">' + esc(t('btn.newAsset')) + '</button></div>'); return h.join(''); }
    var all = applicableItems(a), allNoLevel = applicableItems(a, true);
    var s = assetStats(a, all);
    var f = ui.cl, q = f.q.toLowerCase();
    var items = all.filter(function (it) {
      var c = getCheck(a, it);
      if (f.lib && it.lib !== f.lib) return false;
      if (f.topic && it.topic !== f.topic) return false;
      if (f.level && it.level !== f.level) return false;
      if (f.status && (c.status || 'open') !== f.status) return false;
      if (q && (it.ref + ' ' + tx(it.title) + ' ' + tx(it.desc) + ' ' + (c.note || '') + ' ' + (it.bsi || []).join(' ')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    // Kopf mit Asset-Auswahl und Fortschritt
    h.push('<div class="card"><div class="grid grid-2"><div><label for="clAsset">' + esc(t('cl.selectAsset')) + '</label>' + assetSelect('clAsset', a.id) +
      '<div class="small muted" style="margin-top:.4rem">' + (assetKind(a) === 'system' ? esc(tx(HA.osById(a.os))) + ' · ' + esc(t('c.' + assetRole(a))) : esc(kindLabel(a))) + ' · ' + esc(t('nav.protection')) + ': <b>' + esc(t('prot.' + overallProtection(a))) + '</b> · ' + esc(t('approach.' + a.approach).split(' (')[0]) +
      ' · <a href="#assets" data-act="editAsset" data-id="' + a.id + '">' + esc(t('btn.edit')) + '</a></div><div style="margin-top:.3rem">' + modelCell(a) + '</div></div>' +
      '<div><div class="row"><b style="font-size:1.4rem">' + s.pct + ' %</b><span class="muted small">' + s.done + ' ' + esc(t('status.done')) + ' · ' + s.partial + ' ' + esc(t('status.partial')) + ' · ' + s.notdone + ' ' + esc(t('status.notdone')) +
      ' · ' + s.na + ' ' + esc(t('status.na')) + ' · ' + s.open + ' ' + esc(t('status.open')) + ' · ' + s.verified + ' ' + esc(t('verify.effective')) + '</span></div>' + progressBar(s) + legend() +
      (allNoLevel.length > all.length ? '<div class="small muted" style="margin-top:.3rem">ℹ ' + (allNoLevel.length - all.length) + ' ' + esc(HA.lang === 'de' ? 'Maßnahmen höherer Niveaus durch Vorgehensweise/Schutzbedarf ausgeblendet.' : 'higher-level measures hidden by approach/protection needs.') + '</div>' : '') +
      (s.missingJust ? '<div class="small" style="color:var(--danger);margin-top:.3rem">⚠ ' + s.missingJust + ' × ' + esc(t('cl.justReq')) + '</div>' : '') + '</div></div></div>');
    if (assetKind(a) === 'system' && !a.libs.length && !(a.modules || []).length) h.push('<div class="note warn">' + esc(t('cl.noLibs')) + '</div>');
    if (assetKind(a) !== 'system' && !(a.modules || []).length) h.push('<div class="note warn">' + esc(L2('Für dieses Zielobjekt sind noch keine Bausteine modelliert – unter „Bearbeiten“ Bausteine auswählen.', 'No modules modelled for this target object yet – select modules under "Edit".')) + '</div>');
    var virt = all.filter(function (it) { return it.lib === 'gsmod'; });
    if (virt.length) h.push('<div class="note">ℹ ' + esc(L2(virt.length + ' modellierte Bausteine ohne Einzelanforderungen werden als Baustein-Gesamtbewertung geführt (' + virt.map(function (x) { return x.ref; }).join(', ') + '). Für die Einzelanforderungen das IT-Grundschutz-Kompendium (XML) unter „Import“ laden oder mit „+ Eigene Maßnahme“ Anforderungen zum Baustein ergänzen.',
      virt.length + ' modelled modules without individual requirements are shown as overall module assessment (' + virt.map(function (x) { return x.ref; }).join(', ') + '). For individual requirements import the IT-Grundschutz compendium (XML) or add requirements via "+ Custom measure".')) + '</div>');
    // Filterleiste
    var libsInAsset = []; allNoLevel.forEach(function (it) { if (libsInAsset.indexOf(it.lib) < 0) libsInAsset.push(it.lib); });
    h.push('<div class="card sticky-bar no-print"><div class="filters">' +
      '<div><label for="fQ">' + esc(t('c.search')) + '</label><input type="search" id="fQ" data-act="fQ" value="' + esc(f.q) + '" placeholder="SYS.1.3.A8, ssh, …"></div>' +
      '<div><label for="fLib">' + esc(t('c.library')) + '</label><select id="fLib" data-act="filter" data-f="lib">' + opt('', t('c.all'), f.lib) + libsInAsset.map(function (l) { return opt(l, getLib(l).short, f.lib); }).join('') + '</select></div>' +
      '<div><label for="fTopic">' + esc(t('c.topic')) + '</label><select id="fTopic" data-act="filter" data-f="topic">' + opt('', t('c.all'), f.topic) + HA.TOPICS.map(function (x) { return opt(x.id, tx(x), f.topic); }).join('') + '</select></div>' +
      '<div><label for="fLevel">' + esc(t('c.level')) + '</label><select id="fLevel" data-act="filter" data-f="level">' + opt('', t('c.all'), f.level) + ['B', 'S', 'H'].map(function (x) { return opt(x, x + ' – ' + t('level.' + x), f.level); }).join('') + '</select></div>' +
      '<div><label for="fStatus">' + esc(t('c.status')) + '</label><select id="fStatus" data-act="filter" data-f="status">' + opt('', t('c.all'), f.status) + HA.STATUS.map(function (x) { return opt(x, t('status.' + x), f.status); }).join('') + '</select></div>' +
      '<div><label for="fGroup">' + esc(t('cl.group')) + '</label><select id="fGroup" data-act="filter" data-f="groupBy">' + ['group', 'topic', 'status'].map(function (x) { return opt(x, t('cl.groupBy.' + x), f.groupBy); }).join('') + '</select></div></div>' +
      '<div class="row" style="margin-top:.5rem"><span class="small muted">' + esc(t('cl.showing', { n: items.length })) + '</span><span class="spacer"></span>' +
      '<button class="btn btn-sm" data-act="resetFilters">' + esc(t('btn.resetFilters')) + '</button><button class="btn btn-sm" data-act="expandAll">' + esc(t('btn.expandAll')) + '</button><button class="btn btn-sm" data-act="collapseAll">' + esc(t('btn.collapseAll')) + '</button>' +
      '<button class="btn btn-sm" data-act="bulkNa">' + esc(t('btn.bulkNa')) + '</button><button class="btn btn-sm btn-primary" data-act="addCustom">' + esc(t('btn.addCustom')) + '</button></div></div>');
    if (!items.length) { h.push('<div class="card muted">' + esc(t('cl.empty')) + '</div>'); return h.join(''); }
    // Gruppieren
    var groups = {}, order = [];
    items.forEach(function (it) {
      var g = f.groupBy === 'topic' ? tx(HA.topicById(it.topic)) : f.groupBy === 'status' ? t('status.' + (getCheck(a, it).status || 'open')) : groupLabel(it);
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(it);
    });
    if (f.groupBy === 'group') {   // Grundschutz-Bausteine in der Reihenfolge des Schichtenmodells
      var pos = {}; order.forEach(function (g, i) { var bs = bausteinOf(groups[g][0]); pos[g] = bs && groupLabel(groups[g][0]) === g ? HA.GS.index(bs) : 1000 + i; });
      order.sort(function (x, y) { return pos[x] - pos[y]; });
    }
    order.forEach(function (g) {
      var gi = groups[g]; var done = gi.filter(function (it) { return getCheck(a, it).status === 'done'; }).length;
      h.push('<h3 class="group-title">' + esc(g) + ' <span class="badge st-open">' + done + '/' + gi.length + '</span></h3>');
      gi.forEach(function (it) { h.push(itemCard(a, it)); });
    });
    return h.join('');
  };

  /** Karte einer einzelnen Maßnahme in der Checkliste. */
  function itemCard(a, it) {
    var k = itemKey(it), c = getCheck(a, it), st = c.status || 'open', fam = osFamily(a);
    var needJust = (st === 'na' || st === 'notdone');
    var open = ui.openItems[k] || (needJust && !c.justification);
    var h = ['<article class="item s-' + st + '" data-key="' + esc(k) + '">'];
    h.push('<div class="item-head"><span class="item-ref">' + esc(it.ref) + '</span>' + libBadge(it.lib) + levelBadge(it.level) +
      '<span class="item-title">' + esc(tx(it.title)) + '</span>' +
      '<select aria-label="' + esc(t('c.status')) + '" data-act="setStatus" data-key="' + esc(k) + '">' + HA.STATUS.map(function (s) { return opt(s, t('status.' + s), st); }).join('') + '</select></div>');
    if (tx(it.desc)) h.push('<div class="item-desc">' + esc(tx(it.desc)) + '</div>');
    var meta = [];
    meta.push('<span class="chip" data-act="filterTopic" data-topic="' + esc(it.topic) + '">' + esc(tx(HA.topicById(it.topic))) + '</span>');
    if (it.effort !== null && it.effort !== undefined) meta.push('<span class="small muted">' + esc(t('cl.effort')) + ': ' + esc(it.effort) + '/5</span>');
    if (it.modal) meta.push('<span class="small muted">' + esc(t('cl.modal')) + ': ' + esc(it.modal) + '</span>');
    if (it.severity && it.severity !== 'unknown') meta.push(sevBadge(it.severity));
    (it.bsi || []).forEach(function (r) { meta.push('<span class="chip" data-act="search" data-q="' + esc(r) + '" title="' + esc(t('cl.related')) + '">↔ ' + esc(r) + '</span>'); });
    // Rückverweis: SSG-Regeln, die dieser BSI-Anforderung zugeordnet sind
    if (it.ssg && it.ssg.length) {
      var ev = ssgEvidence(a, it);
      meta.push('<span class="chip" data-act="search" data-q="' + esc(it.ref) + '">⚙ ' + it.ssg.length + ' SSG</span>');
      if (ev.total) meta.push('<span class="badge ' + (ev.pass === ev.total ? 'st-done' : 'st-partial') + '">' + esc(t('cl.ssgEvidence', { pass: ev.pass, total: ev.total })) + '</span>');
    }
    h.push('<div class="row small">' + meta.join(' ') + '</div>');
    if (c.autoNote) h.push('<div class="small muted">🤖 ' + esc(c.autoNote) + '</div>');
    h.push('<details' + (open ? ' open' : '') + ' data-act="toggleItem" data-key="' + esc(k) + '"><summary>' + esc(HA.lang === 'de' ? 'Details, Begründung & Wirksamkeit' : 'Details, justification & effectiveness') +
      (c.note || c.justification ? ' ✎' : '') + (c.verResult ? ' · ' + esc(t('verify.' + c.verResult)) : '') + '</summary>');
    var cmd = checkCmd(it, a);
    if (cmd) h.push('<div class="small"><b>' + esc(t('cl.check')) + '</b></div>' + codeBlock(cmd));
    if (it.hint) h.push('<div class="small muted">ℹ ' + esc(it.hint) + '</div>');
    if (it.fix) h.push('<div class="small"><b>' + esc(t('cl.fix')) + ':</b> <span class="mono">' + esc(it.fix) + '</span></div>');
    if (it.ssg && it.ssg.length) h.push('<div class="small muted">SSG: <span class="mono">' + esc(it.ssg.join(', ')) + '</span></div>');
    h.push('<div class="item-body">' +
      '<label for="j-' + esc(k) + '">' + esc(needJust ? t('c.justification') : t('c.reason')) + '</label><textarea id="j-' + esc(k) + '" data-field="justification" data-key="' + esc(k) + '" rows="2"' + (needJust && !c.justification ? ' class="invalid"' : '') + '>' + esc(c.justification || '') + '</textarea>' +
      '<label>' + esc(t('c.notes')) + '</label><textarea data-field="note" data-key="' + esc(k) + '" rows="2">' + esc(c.note || '') + '</textarea>' +
      '<label>' + esc(t('c.evidence')) + '</label><input type="text" data-field="evidence" data-key="' + esc(k) + '" value="' + esc(c.evidence || '') + '" placeholder="Ticket, Screenshot, GPO-Name, Datei …">' +
      '<label>' + esc(t('c.responsible')) + ' / ' + esc(t('c.dueDate')) + '</label><div class="field-inline"><input type="text" data-field="responsible" data-key="' + esc(k) + '" value="' + esc(c.responsible || '') + '"><input type="date" data-field="due" data-key="' + esc(k) + '" value="' + esc(c.due || '') + '"></div>' +
      '</div>');
    h.push('<div class="verify"><div><label>' + esc(t('verify.title')) + '</label><select data-act="setVer" data-field="verResult" data-key="' + esc(k) + '">' + opt('', t('verify.pending'), c.verResult || '') + opt('effective', t('verify.effective'), c.verResult) + opt('ineffective', t('verify.ineffective'), c.verResult) + '</select></div>' +
      '<div><label>' + esc(t('c.date')) + '</label><input type="date" data-field="verDate" data-key="' + esc(k) + '" value="' + esc((c.verDate || '').slice(0, 10)) + '"></div>' +
      '<div><label>' + esc(t('c.method')) + '</label><select data-act="setVer" data-field="verMethod" data-key="' + esc(k) + '">' + opt('', '–', c.verMethod || '') + ['visual', 'config', 'scan', 'test', 'interview'].map(function (m) { return opt(m, t('method.' + m), c.verMethod); }).join('') + '</select></div>' +
      '<div><label>' + esc(t('c.by')) + '</label><input type="text" data-field="verBy" data-key="' + esc(k) + '" value="' + esc(c.verBy || '') + '" placeholder="' + esc(state.meta.auditor || '') + '"></div></div>');
    if (it.lib === 'custom') h.push('<div class="row end"><button class="btn btn-sm btn-danger" data-act="delCustom" data-key="' + esc(k) + '">' + esc(t('btn.delete')) + '</button></div>');
    h.push('</details></article>');
    return h.join('');
  }

  /** OpenSCAP-Nachweis für eine BSI-Anforderung über zugeordnete SSG-Regeln. */
  function ssgEvidence(a, it) {
    var pass = 0, total = 0;
    (it.ssg || []).forEach(function (rule) {
      var found = null;
      Object.keys(a.checks).forEach(function (k) { if (k.split('|')[1] === rule && a.checks[k].scanResult) found = a.checks[k].scanResult; });
      if (found && found !== 'notapplicable' && found !== 'notselected') { total++; if (found === 'pass') pass++; }
    });
    return { pass: pass, total: total };
  }
  function findItemByKey(k) { return allItems().find(function (x) { return itemKey(x) === k; }); }

  /** Dialog: eigene Maßnahme anlegen (optional vorbefüllt, z. B. aus Lynis). */
  function addCustom(pre) {
    var a = currentAsset();
    pre = pre || {};
    var n = state.customItems.length + 1;
    var fam = a ? osFamily(a) : 'linux';
    var body = '<div class="grid grid-2"><div class="field"><label>ID</label><input type="text" name="ref" value="' + esc(pre.ref || ('CUS-' + ('00' + n).slice(-3))) + '"></div>' +
      '<div class="field"><label>' + esc(t('c.level')) + '</label><select name="level">' + ['B', 'S', 'H'].map(function (x) { return opt(x, x + ' – ' + t('level.' + x), pre.level || 'S'); }).join('') + '</select></div></div>' +
      '<div class="field"><label>' + esc(t('c.name')) + ' *</label><input type="text" name="title" required value="' + esc(pre.title || '') + '"></div>' +
      '<div class="field"><label>' + esc(t('c.description')) + '</label><textarea name="desc">' + esc(pre.desc || '') + '</textarea></div>' +
      '<div class="grid grid-2"><div class="field"><label>' + esc(t('c.topic')) + '</label><select name="topic">' + HA.TOPICS.map(function (x) { return opt(x.id, tx(x), pre.topic || 'install'); }).join('') + '</select></div>' +
      '<div class="field"><label>' + esc(t('cl.check')) + ' (' + fam + ')</label><input type="text" name="check" value="' + esc(pre.check || '') + '"></div></div>' +
      (a && (a.modules || []).length ? '<div class="field"><label>' + esc(L2('Zu Baustein (Modellierung)', 'For module (modelling)')) + '</label><select name="bs">' + opt('', '–', pre.bs || '') +
        a.modules.map(function (m) { return opt(m, m + ' ' + HA.GS.title(m), pre.bs || ''); }).join('') + '</select><div class="small muted">' +
        esc(L2('Eigene Anforderungen erscheinen in der Checkliste unter dem Baustein (z. B. ISMS.1.A-ORG1).', 'Custom requirements appear in the checklist under the module (e.g. ISMS.1.A-ORG1).')) + '</div></div>' : '') +
      '<div class="field"><label><input type="checkbox" name="all"' + (pre.all ? ' checked' : '') + '> ' + esc(HA.lang === 'de' ? 'Für alle Assets mit Bibliothek „Eigene“ (sonst nur dieses Asset)' : 'For all assets with library "Custom" (otherwise this asset only)') + '</label></div>';
    dialog(t('cl.customTitle'), body, function (f) {
      var fd = new FormData(f);
      if (!(fd.get('title') || '').trim()) { f.querySelector('[name=title]').classList.add('invalid'); return false; }
      var chk = null; if (fd.get('check')) { chk = {}; chk[fam] = fd.get('check'); }
      var it = { lib: 'custom', ref: (fd.get('ref') || '').trim() || uid('CUS'), title: { de: fd.get('title').trim(), en: fd.get('title').trim() }, desc: { de: fd.get('desc') || '' },
        level: fd.get('level'), topic: fd.get('topic'), os: [fam], role: 'any', check: chk, group: fd.get('bs') || t('cl.customTitle'), assetId: fd.get('all') ? null : (a && a.id), source: pre.source || '' };
      if (state.customItems.some(function (x) { return x.ref === it.ref && x.assetId === it.assetId; })) it.ref += '-' + Math.random().toString(36).slice(2, 5);
      state.customItems.push(it);
      if (fd.get('all') && a && a.libs.indexOf('custom') < 0) a.libs.push('custom');
      invalidate(); scheduleSave(); render();
      toast(t('imp.catalogAdded', { name: t('cl.customTitle'), n: 1 }));
    }, t('btn.add'));
  }

  /* ---------- Bibliotheken & Vergleich ---------- */
  V.libraries = function () {
    var osId = ui.libOs;
    var probeOs = osId === '*' ? null : HA.osById(osId);
    var h = ['<div class="page-head"><div><h1>' + esc(t('lib.title')) + '</h1><p>' + esc(t('lib.sub')) + '</p></div>' +
      '<div><label for="libOs">' + esc(t('lib.os')) + '</label><select id="libOs" data-act="libOs">' + opt('*', t('c.all'), osId) + HA.OS.map(function (o) { return opt(o.id, tx(o), osId); }).join('') + '</select></div></div>'];
    h.push('<div class="note">' + esc(t('lib.importHint')) + '</div>');
    var libs = usableLibs();
    // Zählung pro Bibliothek für das gewählte OS (beide Rollen)
    var data = libs.map(function (l) {
      var items = allItems().filter(function (it) {
        if (it.lib !== l) return false;
        if (it.lib === 'custom' && it.assetId) return false;
        if (!probeOs) return true;
        var probe = { os: osId, role: 'server' }, probe2 = { os: osId, role: 'client' };
        return matchesPlatform(it, probe) || matchesPlatform(it, probe2);
      });
      var lv = { B: 0, S: 0, H: 0 }, topics = {};
      items.forEach(function (it) { lv[it.level || 'S'] = (lv[it.level || 'S'] || 0) + 1; topics[it.topic] = (topics[it.topic] || 0) + 1; });
      return { id: l, lib: getLib(l), count: items.length, lv: lv, topics: topics, nTopics: Object.keys(topics).length };
    });
    var max = Math.max.apply(null, data.map(function (d) { return d.count; }).concat([1]));
    // Balkendiagramm
    h.push('<div class="card"><h2>' + esc(t('lib.chart')) + (probeOs ? ' – ' + esc(tx(probeOs)) : '') + '</h2><div class="bars">' + data.map(function (d) {
      return '<div class="bar-row"><div>' + libBadge(d.id) + '</div><div class="bar-track" title="B ' + d.lv.B + ' · S ' + d.lv.S + ' · H ' + d.lv.H + '">' +
        ['B', 'S', 'H'].map(function (x) { return d.lv[x] ? '<div class="bar-fill l' + x + '" style="width:' + (d.lv[x] / max * 100).toFixed(2) + '%"></div>' : ''; }).join('') +
        '</div><div class="num"><b>' + d.count + '</b></div></div>';
    }).join('') + '</div><div class="legend"><span><i style="background:var(--ok)"></i>B – ' + esc(t('level.B')) + '</span><span><i style="background:var(--info)"></i>S – ' + esc(t('level.S')) +
      '</span><span><i style="background:var(--danger)"></i>H – ' + esc(t('level.H')) + '</span></div></div>');
    // Vergleichstabelle inkl. Import-Bibliotheken
    h.push('<div class="card"><div class="table-wrap"><table><thead><tr><th>' + esc(t('c.library')) + '</th><th>' + esc(t('c.source')) + '</th><th class="num">' + esc(t('lib.inTool')) + '</th><th class="num">B</th><th class="num">S</th><th class="num">H</th><th class="num">' +
      esc(t('lib.topics')) + '</th><th>' + esc(t('lib.reference')) + '</th><th>' + esc(t('c.license')) + '</th><th></th></tr></thead><tbody>');
    data.forEach(function (d) {
      h.push('<tr><td>' + libBadge(d.id) + ' ' + esc(tx(d.lib.name)) + (d.lib.version ? '<div class="small muted">' + esc(d.lib.version) + '</div>' : '') + '</td><td class="small">' + esc(d.lib.imported ? t('lib.imported') : t('lib.builtin')) + '</td>' +
        '<td class="num"><b>' + d.count + '</b></td><td class="num">' + d.lv.B + '</td><td class="num">' + d.lv.S + '</td><td class="num">' + d.lv.H + '</td><td class="num">' + d.nTopics + '/' + HA.TOPICS.length + '</td>' +
        '<td class="small">' + esc(d.lib.reference ? tx(d.lib.reference) : '–') + '</td><td class="small">' + esc(d.lib.license || '') + '</td><td class="nowrap">' +
        (d.lib.imported ? '<button class="btn btn-sm btn-danger" data-act="delCatalog" data-id="' + esc(d.id) + '" title="' + esc(t('lib.removeCat')) + '">🗑</button>' : '') +
        ' <button class="btn btn-sm" data-act="browseLib" data-id="' + esc(d.id) + '">🔍</button></td></tr>');
    });
    HA.LIBRARIES.filter(function (l) { return l.importOnly && libs.indexOf(l.id) < 0; }).forEach(function (l) {
      h.push('<tr class="muted"><td>' + libBadge(l.id) + ' ' + esc(tx(l.name)) + '</td><td class="small">' + esc(t('lib.importOnly')) + '</td><td class="num">–</td><td class="num">–</td><td class="num">–</td><td class="num">–</td><td class="num">–</td><td class="small">' +
        esc(l.reference ? tx(l.reference) : '–') + '</td><td class="small">' + esc(l.license || '') + '</td><td><a class="btn btn-sm" href="#import">📥</a></td></tr>');
    });
    h.push('</tbody></table></div></div>');
    // Einordnung
    var ranked = data.filter(function (d) { return d.count; }).sort(function (x, y) { return (y.nTopics - x.nTopics) || (y.count - x.count); });
    if (ranked.length) {
      h.push('<div class="card"><h2>' + esc(t('lib.verdict')) + '</h2><ol>' + ranked.map(function (d) {
        var autom = d.id === 'ssg' || (d.lib.catalog && d.lib.catalog.libKind === 'xccdf') ? (HA.lang === 'de' ? 'automatisiert prüfbar (OpenSCAP)' : 'automatically checkable (OpenSCAP)') :
          d.id === 'bsi2023' || d.id === 'gspp' || /bsi/.test(d.id) ? (HA.lang === 'de' ? 'methodisch/organisatorisch, zertifizierungsrelevant' : 'methodical/organisational, certification-relevant') :
          d.id === 'msbaseline' || d.id === 'mscp' ? (HA.lang === 'de' ? 'konkrete Herstellereinstellungen' : 'concrete vendor settings') : '';
        return '<li>' + libBadge(d.id) + ' <b>' + d.count + '</b> ' + esc(HA.lang === 'de' ? 'Maßnahmen' : 'measures') + ', ' + d.nTopics + '/' + HA.TOPICS.length + ' ' + esc(t('lib.topics')) + (autom ? ' – ' + esc(autom) : '') + '</li>';
      }).join('') + '</ol><div class="note ok"><b>' + esc(t('lib.recommend')) + ':</b> ' + esc(t('lib.recommendText')) + '</div></div>');
    }
    // Abdeckungsmatrix
    h.push('<div class="card"><h2>' + esc(t('lib.matrix')) + '</h2><div class="table-wrap"><table class="matrix"><thead><tr><th>' + esc(t('c.topic')) + '</th>' + data.map(function (d) { return '<th class="num">' + libBadge(d.id) + '</th>'; }).join('') + '</tr></thead><tbody>');
    HA.TOPICS.forEach(function (tp) {
      h.push('<tr><td>' + esc(tx(tp)) + '</td>' + data.map(function (d) {
        var n = d.topics[tp.id] || 0;
        var bg = n ? 'background:color-mix(in srgb, ' + d.lib.color + ' ' + Math.min(70, 12 + n * 6) + '%, transparent)' : '';
        return '<td class="cell ' + (n ? '' : 'c0') + '" style="' + bg + '">' + (n || '·') + '</td>';
      }).join('') + '</tr>');
    });
    h.push('</tbody></table></div></div>');
    // Beschreibungen
    h.push('<div class="grid grid-2">' + HA.LIBRARIES.filter(function (l) { return l.id !== 'custom'; }).map(function (l) {
      return '<div class="card"><h3>' + libBadge(l.id) + ' ' + esc(tx(l.name)) + '</h3><p class="small">' + esc(tx(l.desc)) + '</p>' + (l.url ? '<p class="small mono" style="word-break:break-all">' + esc(l.url) + '</p>' : '') + '</div>';
    }).join('') + '</div>');
    // Maßnahmen durchsuchen
    if (ui.libBrowse) {
      var bq = ui.libBrowseQ.toLowerCase();
      var bl = allItems().filter(function (it) { return it.lib === ui.libBrowse && (!bq || (it.ref + ' ' + tx(it.title)).toLowerCase().indexOf(bq) >= 0); });
      h.push('<div class="card" id="browse"><div class="row"><h2 style="margin:0">' + esc(t('lib.browse')) + ': ' + libBadge(ui.libBrowse) + '</h2><span class="spacer"></span><input type="search" style="max-width:260px" data-act="browseQ" value="' + esc(ui.libBrowseQ) + '" placeholder="' + esc(t('c.search')) + '">' +
        '<button class="btn btn-sm" data-act="browseLib" data-id="">✕</button></div><p class="small muted">' + bl.length + '</p><div class="table-wrap" style="max-height:480px"><table><thead><tr><th>ID</th><th>' + esc(t('c.name')) + '</th><th>' + esc(t('c.level')) + '</th><th>' + esc(t('c.topic')) + '</th><th>' + esc(t('c.os')) + '</th></tr></thead><tbody>' +
        bl.slice(0, 500).map(function (it) { return '<tr><td class="mono small">' + esc(it.ref) + '</td><td>' + esc(tx(it.title)) + '</td><td>' + levelBadge(it.level) + '</td><td class="small">' + esc(tx(HA.topicById(it.topic))) + '</td><td class="small">' + esc((it.os || []).join(', ')) + (it.distros ? ' (' + esc(it.distros.join(', ')) + ')' : '') + '</td></tr>'; }).join('') +
        '</tbody></table></div></div>');
    }
    return h.join('');
  };

  /* ---------- Scans & Schwachstellen ---------- */
  var SEV_RANK = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
  V.scans = function () {
    var a = currentAsset();
    var h = ['<div class="page-head"><div><h1>' + esc(t('scan.title')) + '</h1><p>' + esc(t('scan.sub')) + '</p></div><a class="btn btn-primary" href="#import">📥 ' + esc(t('nav.import')) + '</a></div>'];
    if (!a) { h.push('<div class="card muted">' + esc(t('cl.noAsset')) + '</div>'); return h.join(''); }
    var ov = latestScan(a, 'openvas');
    var vo = vulnOverall(a);
    h.push('<div class="card"><div class="grid grid-3"><div><label for="scAsset">' + esc(t('cl.selectAsset')) + '</label>' + assetSelect('scAsset', a.id) + '</div>' +
      '<div><label>' + esc(t('scan.vulnStatus')) + '</label>' + (ov ? '✅ ' + esc(t('scan.hadScan')) + ': <b>' + fmtDate(ov.scanDate || ov.importedAt, true) + '</b>' +
        (daysSince(ov.scanDate) > (state.meta.staleDays || 90) ? '<div class="small" style="color:var(--warn)">⚠ ' + esc(t('dash.staleScan', { days: state.meta.staleDays })) + '</div>' : '') :
        '<span style="color:var(--danger)">✖ ' + esc(t('scan.noVulnScan')) + '</span>') + '</div>' +
      '<div><label>' + esc(t('scan.overall')) + '</label>' + (ov ? '<span class="badge ' + (vo === 'none' ? 'fs-fixed' : vo === 'partial' ? 'fs-partial' : 'fs-open') + '">' + esc(t('scan.overall.' + vo)) + '</span>' : '–') + '</div></div>' +
      '<div class="row" style="margin-top:.6rem"><label class="small" style="margin:0">' + esc(t('scan.filterSev')) + '</label><select data-act="scanSev" style="max-width:150px">' + ['info', 'low', 'medium', 'high', 'critical'].map(function (s) { return opt(s, s, ui.scanSev); }).join('') + '</select>' +
      '<label class="small" style="margin:0;font-weight:400"><input type="checkbox" data-act="scanOnlyOpen"' + (ui.scanOnlyOpen ? ' checked' : '') + '> ' + esc(t('scan.onlyOpen')) + '</label></div></div>');
    var scans = (a.scans || []).slice().sort(function (x, y) { return (y.scanDate || y.importedAt).localeCompare(x.scanDate || x.importedAt); });
    if (!scans.length) { h.push('<div class="card muted">' + esc(t('scan.none')) + '</div>'); return h.join(''); }
    scans.forEach(function (s) {
      var isNmap = s.tool === 'nmap';
      var fs = (s.findings || []).filter(function (f) { return (isNmap || SEV_RANK[f.severity || 'info'] >= SEV_RANK[ui.scanSev]) && (!ui.scanOnlyOpen || ['open', 'partial'].indexOf(f.status || 'open') >= 0); })
        .sort(function (x, y) { return SEV_RANK[y.severity] - SEV_RANK[x.severity]; });
      var all = s.findings || [];
      var cnt = function (st) { return all.filter(function (f) { return (f.status || 'open') === st; }).length; };
      var meta = [];
      if (s.meta && s.meta.hardeningIndex !== null && s.meta.hardeningIndex !== undefined) meta.push(esc(t('scan.hi')) + ': <b>' + s.meta.hardeningIndex + '</b>');
      if (s.meta && s.meta.pass !== undefined) meta.push(esc(t('scan.passFail', { pass: s.meta.pass, fail: s.meta.fail })));
      if (s.meta && s.meta.profile) meta.push('Profil: <span class="mono">' + esc(s.meta.profile.replace('xccdf_org.ssgproject.content_profile_', '')) + '</span>');
      if (s.meta && s.meta.task) meta.push('Task: ' + esc(s.meta.task));
      h.push('<div class="card"><div class="row"><h2 style="margin:0">' + esc(s.tool.toUpperCase()) + '</h2><span>' + fmtDate(s.scanDate, true) + '</span><span class="spacer"></span>' +
        '<button class="btn btn-sm btn-danger" data-act="delScan" data-id="' + s.id + '">' + esc(t('btn.removeScan')) + '</button></div>' +
        '<div class="small muted">' + esc(t('scan.file')) + ': ' + esc(s.file && s.file.name) + ' · ' + esc(t('scan.imported')) + ': ' + fmtDate(s.importedAt, true) + '<br>' + esc(t('scan.hash')) + ': <span class="mono" style="word-break:break-all">' + esc(s.file && s.file.sha256) + '</span></div>' +
        '<div class="small" style="margin:.4rem 0">' + esc(t('scan.summary', { total: all.length, open: cnt('open') + cnt('partial'), fixed: cnt('fixed'), accepted: cnt('accepted') + cnt('falsepositive') })) + (meta.length ? ' · ' + meta.join(' · ') : '') + '</div>');
      if (isNmap) {
        // Nmap: übersichtliche Portliste (unabhängig vom Schwere-Filter)
        h.push('<h3>' + esc(t('scan.ports')) + ' (' + all.length + ')</h3><p class="small muted">' + esc(t('scan.portHint')) + '</p>');
        if (!fs.length) h.push('<div class="note warn">' + esc(t('imp.nmapNoPorts')) + '</div>');
        else {
          h.push('<div class="table-wrap" style="max-height:520px"><table><thead><tr><th>' + esc(t('c.host')) + '</th><th>' + esc(t('c.port')) + '</th><th>Dienst</th><th>Produkt / Version</th><th style="min-width:150px">' + esc(t('c.status')) +
            '</th><th style="min-width:220px">' + esc(t('c.reason')) + '</th></tr></thead><tbody>');
          fs.slice().sort(function (x, y) { return (parseInt(x.port, 10) || 0) - (parseInt(y.port, 10) || 0); }).forEach(function (f) {
            var fid = esc(s.id + '§' + f.id);
            h.push('<tr><td class="small mono">' + esc(f.host) + '</td><td class="mono"><b>' + esc(f.port) + '</b>' + (f.portState && f.portState !== 'open' ? '<div class="small muted">' + esc(f.portState) + '</div>' : '') + '</td><td>' + esc(f.service || '–') +
              '</td><td class="small">' + esc(f.product || (f.title.match(/\((.*)\)/) || [])[1] || '–') + (f.desc ? '<div class="muted">' + esc(f.desc) + '</div>' : '') + '</td>' +
              '<td><select data-act="setFinding" data-fid="' + fid + '">' + HA.FINDING_STATUS.map(function (x) { return opt(x, t('fstatus.' + x), f.status || 'open'); }).join('') + '</select></td>' +
              '<td><textarea rows="2" data-field="findingNote" data-fid="' + fid + '" placeholder="' + esc(t('scan.notePh')) + '">' + esc(f.note || '') + '</textarea></td></tr>');
          });
          h.push('</tbody></table></div>');
        }
      } else if (fs.length) {
        h.push('<div class="table-wrap" style="max-height:520px"><table><thead><tr><th>' + esc(t('c.severity')) + '</th><th>' + esc(t('c.finding')) + '</th><th>' + esc(t('c.host')) + '</th><th style="min-width:150px">' + esc(t('c.status')) + '</th><th style="min-width:220px">' + esc(t('c.reason')) + '</th></tr></thead><tbody>');
        fs.forEach(function (f) {
          var fid = esc(s.id + '§' + f.id);
          h.push('<tr><td>' + sevBadge(f.severity) + (f.cvss ? '<div class="small muted">' + esc(f.cvss) + '</div>' : '') + '</td><td><b>' + esc(f.title) + '</b>' + (f.ref && s.tool === 'lynis' ? ' <span class="mono small">' + esc(f.ref) + '</span>' : '') +
            (f.cve ? '<div class="small mono">' + esc(f.cve) + '</div>' : '') + (f.desc ? '<div class="small muted">' + esc(f.desc) + '</div>' : '') + (f.solution ? '<div class="small"><b>' + esc(t('c.solution')) + ':</b> ' + esc(f.solution) + '</div>' : '') +
            (s.tool === 'lynis' || s.tool === 'generic' ? '<button class="btn btn-sm" style="margin-top:.3rem" data-act="takeOver" data-fid="' + fid + '">' + esc(t('btn.takeOver')) + '</button>' : '') + '</td>' +
            '<td class="small">' + esc(f.host || '') + (f.port ? '<div class="mono">' + esc(f.port) + '</div>' : '') + '</td>' +
            '<td><select data-act="setFinding" data-fid="' + fid + '">' + HA.FINDING_STATUS.map(function (x) { return opt(x, t('fstatus.' + x), f.status || 'open'); }).join('') + '</select>' + (f.statusDate ? '<div class="small muted">' + fmtDate(f.statusDate) + '</div>' : '') + '</td>' +
            '<td><textarea rows="2" data-field="findingNote" data-fid="' + fid + '" placeholder="' + esc(t('scan.notePh')) + '"' + (['accepted', 'falsepositive', 'partial'].indexOf(f.status) >= 0 && !f.note ? ' class="invalid"' : '') + '>' + esc(f.note || '') + '</textarea></td></tr>');
        });
        h.push('</tbody></table></div>');
      }
      h.push('</div>');
    });
    return h.join('');
  };
  function findFinding(fid) {
    var a = currentAsset(); var p = fid.split('§'); var sid = p[0], id = p.slice(1).join('§');
    var sc = a && a.scans.find(function (s) { return s.id === sid; });
    return sc ? { asset: a, scan: sc, f: sc.findings.find(function (x) { return x.id === id; }) } : null;
  }

  /* ---------- Risikobewertung der Befunde ---------- */
  /** Befund über eine globale ID "assetId§scanId§findingId" finden. */
  function findFindingG(fid) {
    var p = fid.split('§'); var a = state.assets.find(function (x) { return x.id === p[0]; });
    var sc = a && a.scans.find(function (s) { return s.id === p[1]; });
    var id = p.slice(2).join('§');
    var f = sc && sc.findings.find(function (x) { return x.id === id; });
    return f ? { asset: a, scan: sc, f: f } : null;
  }
  function riskSelect(act, fid, k, value, suggested, n, labelPrefix) {
    var o = '';
    for (var i = 1; i <= n; i++) o += opt(i, i + ' – ' + t(labelPrefix + i), value);
    return '<select class="' + (suggested ? 'suggested' : '') + '" data-act="' + act + '" data-fid="' + esc(fid) + '" data-k="' + k + '" title="' + (suggested ? esc(t('risk.suggested')) : '') + '">' + o + '</select>';
  }
  V.risk = function () {
    var R = HA.Risk, f = ui.risk;
    var rows = R.findingRows(state, { assetId: f.asset, includeClosed: f.closed });
    var q = f.q.toLowerCase();
    var list = rows.filter(function (r) {
      return (!f.cat || r.cat === f.cat) && (!f.treat || (r.treatment || 'none') === f.treat) && (!f.cell || (r.p + '-' + r.i) === f.cell) && (!f.unrated || r.suggested) &&
        (!q || (r.id + ' ' + r.f.title + ' ' + r.asset.name + ' ' + r.threat + ' ' + r.measure + ' ' + (r.f.cve || '') + ' ' + (r.f.port || '')).toLowerCase().indexOf(q) >= 0);
    });
    var h = ['<div class="page-head"><div><h1>' + esc(t('risk.title')) + '</h1><p>' + esc(t('risk.sub')) + '</p></div></div>'];
    if (!rows.length && !f.asset) { h.push('<div class="card muted">' + esc(t('risk.none')) + ' <a class="btn" href="#import">📥 ' + esc(t('nav.import')) + '</a></div>'); return h.join(''); }
    var cnt = { low: 0, medium: 0, high: 0, veryhigh: 0 }, tr = { avoid: 0, reduce: 0, transfer: 0, accept: 0, none: 0 }, unrated = 0;
    rows.forEach(function (r) { cnt[r.cat]++; tr[r.treatment || 'none']++; if (r.suggested) unrated++; });
    h.push('<div class="grid grid-2"><div class="card"><h2>' + esc(t('risk.heatmap')) + '</h2>' + R.heatmapHtml(rows, { clickAct: 'riskCell', selected: f.cell, cell: 72 }) + R.legendHtml() +
      '<p class="small muted" style="margin-top:.5rem">' + esc(t('risk.matrixNote')) + '</p></div>');
    h.push('<div class="card"><h2>' + esc(t('risk.summary')) + '</h2><div class="bars">' + R.CATS.slice().reverse().map(function (c) {
      return '<div class="bar-row"><div>' + R.badge(c, t('risk.cat.' + c)) + '</div><div class="bar-track"><div class="bar-fill" style="width:' + (rows.length ? cnt[c] / rows.length * 100 : 0) + '%;background:' + R.COLORS[c] + '"></div></div><div class="num"><b>' + cnt[c] + '</b></div></div>';
    }).join('') + '</div><hr><div class="small">' + ['avoid', 'reduce', 'transfer', 'accept', 'none'].map(function (x) { return esc(x === 'none' ? (HA.lang === 'de' ? 'ohne Behandlung' : 'no treatment') : t('treat.' + x)) + ': <b>' + tr[x] + '</b>'; }).join(' · ') +
      '</div><div class="small" style="margin-top:.4rem">' + esc(t('risk.suggested')) + ': <b>' + unrated + '</b> / ' + rows.length + '</div>' +
      '<div class="note" style="margin-top:.6rem">' + esc(t('risk.suggestHint')) + '</div><button class="btn btn-primary" data-act="applySuggest"' + (unrated ? '' : ' disabled') + '>' + esc(t('risk.applySuggest')) + '</button></div></div>');
    // Filter
    h.push('<div class="card no-print"><div class="filters">' +
      '<div><label>' + esc(t('c.asset')) + '</label><select data-act="riskFilter" data-k="asset">' + opt('', t('c.all'), f.asset) + state.assets.map(function (a) { return opt(a.id, a.name, f.asset); }).join('') + '</select></div>' +
      '<div><label>' + esc(t('risk.value')) + '</label><select data-act="riskFilter" data-k="cat">' + opt('', t('c.all'), f.cat) + R.CATS.map(function (c) { return opt(c, t('risk.cat.' + c), f.cat); }).join('') + '</select></div>' +
      '<div><label>' + esc(t('risk.treatment')) + '</label><select data-act="riskFilter" data-k="treat">' + opt('', t('c.all'), f.treat) + ['avoid', 'reduce', 'transfer', 'accept'].map(function (x) { return opt(x, t('treat.' + x), f.treat); }).join('') + opt('none', '–', f.treat) + '</select></div>' +
      '<div style="grid-column:span 2"><label>' + esc(t('c.search')) + '</label><input type="search" data-act="riskQ" value="' + esc(f.q) + '" placeholder="R-001, CVE, Port, Asset …"></div>' +
      '<div class="checks" style="align-self:end"><label><input type="checkbox" data-act="riskFilter" data-k="closed"' + (f.closed ? ' checked' : '') + '> ' + esc(t('risk.includeClosed')) + '</label>' +
      '<label><input type="checkbox" data-act="riskFilter" data-k="unrated"' + (f.unrated ? ' checked' : '') + '> ' + esc(t('risk.onlyUnrated')) + '</label></div></div>' +
      (f.cell ? '<div class="row" style="margin-top:.5rem"><span class="badge st-open">' + esc(t('risk.cellFilter', { cell: t('risk.p' + f.cell[0]) + ' × ' + t('risk.i' + f.cell[2]) })) + '</span><button class="btn btn-sm" data-act="clearCell">' + esc(t('risk.clearCell')) + '</button></div>' : '') +
      '<div class="small muted" style="margin-top:.4rem">' + esc(t('cl.showing', { n: list.length })) + '</div></div>');
    // Tabelle
    h.push('<datalist id="riskThreats">' + R.THREATS.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>');
    h.push('<div class="card"><h2>' + esc(t('risk.table')) + '</h2><div class="table-wrap" style="max-height:75vh"><table class="risk-table"><thead><tr><th>' + esc(t('risk.id')) + '</th><th style="min-width:220px">' + esc(t('c.finding')) +
      '</th><th style="min-width:150px">' + esc(t('risk.target')) + '</th><th style="min-width:200px">' + esc(t('risk.threat')) + '</th><th title="' + esc(t('risk.pTitle')) + '">' + esc(t('risk.pTitle')) + '</th><th title="' + esc(t('risk.iTitle')) + '">' + esc(t('risk.iTitle').split(' /')[0]) +
      '</th><th>' + esc(t('risk.value')) + '</th><th>' + esc(t('risk.treatment')) + '</th><th style="min-width:200px">' + esc(t('risk.measure')) + '</th><th style="min-width:150px">' + esc(t('risk.owner')) + '</th><th style="min-width:150px">' + esc(t('c.status')) + '</th></tr></thead><tbody>');
    list.forEach(function (r) {
      var fid = r.fid;
      h.push('<tr><td class="mono nowrap"><b>' + esc(r.id) + '</b></td><td><b>' + esc(r.f.title) + '</b><div class="small muted">' + esc(r.asset.name) + ' · ' + esc(r.scan.tool) + (r.f.port ? ' · ' + esc(r.f.port) : '') + ' · ' + fmtDate(r.scan.scanDate) + '</div>' +
        sevBadge(r.f.severity || 'info') + (r.f.cve ? ' <span class="small mono">' + esc(r.f.cve.split(',').slice(0, 2).join(',')) + (r.f.cve.split(',').length > 2 ? ' …' : '') + '</span>' : '') +
        (r.f.note ? '<div class="small" style="margin-top:.2rem">💬 ' + esc(r.f.note.length > 160 ? r.f.note.slice(0, 160) + '…' : r.f.note) + '</div>' : '') + '</td>' +
        '<td><input type="text" data-field="riskText" data-k="target" data-fid="' + esc(fid) + '" value="' + esc(r.r.target || '') + '" placeholder="' + esc(r.target) + '"></td>' +
        '<td><input type="text" list="riskThreats" data-field="riskText" data-k="threat" data-fid="' + esc(fid) + '" value="' + esc(r.r.threat || '') + '" placeholder="' + esc(r.threatSuggest) + '"></td>' +
        '<td>' + riskSelect('riskPI', fid, 'p', r.p, r.suggested, 4, 'risk.p') + '</td><td>' + riskSelect('riskPI', fid, 'i', r.i, r.suggested, 4, 'risk.i') + '</td>' +
        '<td class="nowrap">' + HA.Risk.badge(r.cat, t('risk.cat.' + r.cat) + ' (' + r.value + ')') + '</td>' +
        '<td><select data-act="riskTreat" data-fid="' + esc(fid) + '">' + opt('', '–', r.treatment) + ['avoid', 'reduce', 'transfer', 'accept'].map(function (x) { return opt(x, t('treat.' + x), r.treatment); }).join('') + '</select></td>' +
        '<td><textarea rows="2" data-field="riskText" data-k="measure" data-fid="' + esc(fid) + '">' + esc(r.measure) + '</textarea></td>' +
        '<td><input type="text" data-field="riskText" data-k="owner" data-fid="' + esc(fid) + '" value="' + esc(r.r.owner || '') + '" placeholder="' + esc(r.owner) + '"><input type="date" style="margin-top:.3rem" data-field="riskText" data-k="due" data-fid="' + esc(fid) + '" value="' + esc(r.due) + '"></td>' +
        '<td><select data-act="riskStatus" data-fid="' + esc(fid) + '">' + HA.FINDING_STATUS.map(function (x) { return opt(x, t('fstatus.' + x), r.status); }).join('') + '</select>' + (r.f.statusDate ? '<div class="small muted">' + fmtDate(r.f.statusDate) + '</div>' : '') + '</td></tr>');
    });
    h.push('</tbody></table></div></div>');
    return h.join('');
  };

  /* ---------- Projektrisiken ---------- */
  function pmSel(id, k, v, n, prefix, cls) {
    var o = (cls === 'empty' ? opt('', '–', v) : '');
    for (var i = 1; i <= n; i++) o += opt(i, i + (prefix ? ' – ' + t(prefix + i) : ''), v);
    return '<select data-act="pmField" data-id="' + esc(id) + '" data-k="' + k + '">' + o + '</select>';
  }
  function pmRisks() {
    var R = HA.Risk, list = state.projectRisks;
    var h = ['<div class="page-head"><div><h1>' + esc(t('pm.title')) + '</h1><p>' + esc(t('pm.sub')) + '</p></div><div class="row"><button class="btn" data-act="pmExamples">' + esc(t('pm.examples')) +
      '</button><button class="btn btn-primary" data-act="pmAdd">' + esc(t('pm.add')) + '</button></div></div>'];
    var scale = [1, 2, 3, 4, 5].map(function (n) { return t('pm.scale' + n); });
    var before = list.map(function (r) { return { p: +r.p || 1, i: +r.i || 1 }; });
    var after = list.filter(function (r) { return r.rp && r.ri; }).map(function (r) { return { p: +r.rp, i: +r.ri }; });
    var hm = function (rows) { return R.heatmapHtml(rows, { size: 5, catFn: R.pmCatCell, pLabels: scale, iLabels: scale, pTitle: t('pm.pTitle'), iTitle: t('pm.iTitle'), cell: 58 }); };
    h.push('<div class="grid grid-2"><div class="card"><h2>' + esc(t('risk.heatmap')) + ' – ' + esc(t('pm.before')) + '</h2>' + hm(before) + R.legendHtml() + '</div>' +
      '<div class="card"><h2>' + esc(t('pm.residual')) + '</h2>' + hm(after) + R.legendHtml() + '<p class="small muted" style="margin-top:.5rem">' + esc(HA.lang === 'de' ? 'Risikowert: 1–4 gering · 5–9 mittel · 10–15 hoch · 16–25 sehr hoch' : 'Risk value: 1–4 low · 5–9 medium · 10–15 high · 16–25 very high') + '</p></div></div>');
    if (!list.length) { h.push('<div class="card muted">' + esc(t('pm.empty')) + '</div>'); return h.join(''); }
    h.push('<div class="card"><div class="table-wrap" style="max-height:75vh"><table class="pm-table"><thead><tr><th>ID</th><th style="min-width:240px">' + esc(t('pm.risk')) + ' / ' + esc(t('pm.cause')) + '</th><th>' + esc(t('pm.category')) +
      '</th><th>' + esc(t('pm.p')) + '</th><th>' + esc(t('pm.i')) + '</th><th>' + esc(t('pm.value')) + '</th><th>' + esc(t('pm.strategy')) + '</th><th style="min-width:240px">' + esc(t('pm.measures')) + ' / ' + esc(t('pm.trigger')) +
      '</th><th style="min-width:150px">' + esc(t('c.responsible')) + ' / ' + esc(t('c.dueDate')) + '</th><th style="min-width:170px">' + esc(t('pm.residual')) + '</th><th>' + esc(t('c.status')) + '</th><th></th></tr></thead><tbody>');
    list.forEach(function (r) {
      var v = (+r.p || 1) * (+r.i || 1), cat = R.pmCategory(v);
      var rv = r.rp && r.ri ? r.rp * r.ri : 0;
      h.push('<tr><td class="mono"><b>' + esc(r.id) + '</b></td>' +
        '<td><textarea rows="2" data-field="pmText" data-id="' + esc(r.id) + '" data-k="title" placeholder="' + esc(t('pm.risk')) + '">' + esc(r.title || '') + '</textarea><input type="text" style="margin-top:.3rem" data-field="pmText" data-id="' + esc(r.id) + '" data-k="cause" value="' + esc(r.cause || '') + '" placeholder="' + esc(t('pm.cause')) + '"></td>' +
        '<td><select data-act="pmField" data-id="' + esc(r.id) + '" data-k="category">' + R.PM_CATEGORIES.map(function (c) { return opt(c, t('pm.cat.' + c), r.category); }).join('') + '</select></td>' +
        '<td>' + pmSel(r.id, 'p', r.p, 5, 'pm.scale') + '</td><td>' + pmSel(r.id, 'i', r.i, 5, 'pm.scale') + '</td>' +
        '<td class="nowrap">' + R.badge(cat, v + ' – ' + t('risk.cat.' + cat)) + '</td>' +
        '<td><select data-act="pmField" data-id="' + esc(r.id) + '" data-k="strategy">' + opt('', '–', r.strategy) + ['avoid', 'reduce', 'transfer', 'accept'].map(function (x) { return opt(x, t('treat.' + x), r.strategy); }).join('') + '</select></td>' +
        '<td><textarea rows="2" data-field="pmText" data-id="' + esc(r.id) + '" data-k="measures" placeholder="' + esc(t('pm.measures')) + '">' + esc(r.measures || '') + '</textarea><input type="text" style="margin-top:.3rem" data-field="pmText" data-id="' + esc(r.id) + '" data-k="trigger" value="' + esc(r.trigger || '') + '" placeholder="' + esc(t('pm.trigger')) + '"></td>' +
        '<td><input type="text" data-field="pmText" data-id="' + esc(r.id) + '" data-k="owner" value="' + esc(r.owner || '') + '" placeholder="' + esc(state.meta.auditor || '') + '"><input type="date" style="margin-top:.3rem" data-field="pmText" data-id="' + esc(r.id) + '" data-k="due" value="' + esc(r.due || '') + '"></td>' +
        '<td><div class="field-inline">' + pmSel(r.id, 'rp', r.rp || '', 5, '', 'empty') + '<span>×</span>' + pmSel(r.id, 'ri', r.ri || '', 5, '', 'empty') + '</div>' + (rv ? '<div style="margin-top:.3rem">' + R.badge(R.pmCategory(rv), rv + ' – ' + t('risk.cat.' + R.pmCategory(rv))) + '</div>' : '') + '</td>' +
        '<td><select data-act="pmField" data-id="' + esc(r.id) + '" data-k="status">' + R.PM_STATUS.map(function (x) { return opt(x, t('pm.st.' + x), r.status || 'open'); }).join('') + '</select></td>' +
        '<td><button class="btn btn-sm btn-danger" data-act="pmDel" data-id="' + esc(r.id) + '" aria-label="' + esc(t('btn.delete')) + '">🗑</button></td></tr>');
    });
    h.push('</tbody></table></div></div>');
    return h.join('');
  }
  function newProjectRisk(base) {
    state.pmSeq = state.pmSeq || 1;
    return Object.assign({ id: 'P-' + ('00' + (state.pmSeq++)).slice(-2), title: '', cause: '', category: 'technology', p: 3, i: 3, strategy: '', measures: '', trigger: '', owner: '', due: '', rp: '', ri: '', status: 'open' }, base || {});
  }

  /* ---------- Projekt: Tabs Risiken | Chancen | SWOT ---------- */
  V.pm = function () {
    var tab = ui.pmTab || 'risks';
    var tabs = '<div class="tabs" role="tablist">' + ['risks', 'chances', 'swot'].map(function (x) {
      return '<button role="tab" aria-selected="' + (x === tab) + '" class="' + (x === tab ? 'on' : '') + '" data-act="pmTab" data-id="' + x + '">' + esc(t('pm.tab.' + x)) + '</button>'; }).join('') + '</div>';
    return tabs + (tab === 'chances' ? pmChances() : tab === 'swot' ? pmSwot() : pmRisks());
  };

  function chSel(id, k, v, n, prefix, empty) {
    var o = empty ? opt('', '–', v) : '';
    for (var i = 1; i <= n; i++) o += opt(i, i + (prefix ? ' – ' + t(prefix + i) : ''), v);
    return '<select data-act="chField" data-id="' + esc(id) + '" data-k="' + k + '">' + o + '</select>';
  }
  function pmChances() {
    var R = HA.Risk, list = state.projectChances;
    var h = ['<div class="page-head"><div><h1>' + esc(t('ch.title')) + '</h1><p>' + esc(t('ch.sub')) + '</p></div><div class="row"><button class="btn" data-act="chExamples">' + esc(t('ch.examples')) +
      '</button><button class="btn btn-primary" data-act="chAdd">' + esc(t('ch.add')) + '</button></div></div><div class="note">' + esc(t('ch.note')) + '</div>'];
    var scale = [1, 2, 3, 4, 5].map(function (n) { return t('pm.scale' + n); });
    h.push('<div class="card hm-card"><div class="hm-box"><h2>' + esc(t('ch.heatmap')) + '</h2>' +
      R.heatmapHtml(list.map(function (r) { return { p: +r.p || 1, i: +r.i || 1 }; }), { size: 5, catFn: R.pmCatCell, pLabels: scale, iLabels: scale, pTitle: t('pm.pTitle'), iTitle: t('ch.iTitle'), cell: 58, colors: R.CH_COLORS, textColors: R.CH_TEXT }) +
      R.legendHtml('ch.cat.', R.CH_COLORS) + '</div><div class="hm-side"><h3>' + esc(HA.lang === 'de' ? 'Strategien für Chancen' : 'Opportunity strategies') + '</h3><ul class="small">' +
      (HA.lang === 'de' ? '<li><b>ausnutzen</b> – Chance gezielt herbeiführen</li><li><b>verbessern</b> – Wahrscheinlichkeit oder Nutzen erhöhen</li><li><b>teilen</b> – mit Partnern gemeinsam nutzen</li><li><b>akzeptieren</b> – mitnehmen, wenn sie eintritt, ohne Aufwand</li>'
        : '<li><b>exploit</b> – make it happen</li><li><b>enhance</b> – increase likelihood or benefit</li><li><b>share</b> – use together with partners</li><li><b>accept</b> – take it if it occurs</li>') + '</ul></div></div>');
    if (!list.length) { h.push('<div class="card muted">' + esc(t('ch.empty')) + '</div>'); return h.join(''); }
    h.push('<div class="card"><div class="table-wrap" style="max-height:75vh"><table class="pm-table"><thead><tr><th>ID</th><th style="min-width:240px">' + esc(t('ch.chance')) + ' / ' + esc(t('ch.cause')) + '</th><th>' + esc(t('pm.category')) +
      '</th><th>' + esc(t('pm.p')) + '</th><th>' + esc(t('ch.i')) + '</th><th>' + esc(t('ch.value')) + '</th><th>' + esc(t('pm.strategy')) + '</th><th style="min-width:240px">' + esc(t('ch.measures')) +
      '</th><th style="min-width:150px">' + esc(t('c.responsible')) + ' / ' + esc(t('c.dueDate')) + '</th><th>' + esc(t('c.status')) + '</th><th></th></tr></thead><tbody>');
    list.forEach(function (r) {
      var v = (+r.p || 1) * (+r.i || 1), cat = R.pmCategory(v);
      h.push('<tr><td class="mono"><b>' + esc(r.id) + '</b></td>' +
        '<td><textarea rows="2" data-field="chText" data-id="' + esc(r.id) + '" data-k="title" placeholder="' + esc(t('ch.chance')) + '">' + esc(r.title || '') + '</textarea><input type="text" style="margin-top:.3rem" data-field="chText" data-id="' + esc(r.id) + '" data-k="cause" value="' + esc(r.cause || '') + '" placeholder="' + esc(t('ch.cause')) + '"></td>' +
        '<td><select data-act="chField" data-id="' + esc(r.id) + '" data-k="category">' + R.PM_CATEGORIES.map(function (c) { return opt(c, t('pm.cat.' + c), r.category); }).join('') + '</select></td>' +
        '<td>' + chSel(r.id, 'p', r.p, 5, 'pm.scale') + '</td><td>' + chSel(r.id, 'i', r.i, 5, 'pm.scale') + '</td>' +
        '<td class="nowrap">' + R.badge(cat, v + ' – ' + t('ch.cat.' + cat), true) + '</td>' +
        '<td><select data-act="chField" data-id="' + esc(r.id) + '" data-k="strategy">' + opt('', '–', r.strategy) + R.CH_STRATEGIES.map(function (x) { return opt(x, t('ch.strat.' + x), r.strategy); }).join('') + '</select></td>' +
        '<td><textarea rows="2" data-field="chText" data-id="' + esc(r.id) + '" data-k="measures">' + esc(r.measures || '') + '</textarea></td>' +
        '<td><input type="text" data-field="chText" data-id="' + esc(r.id) + '" data-k="owner" value="' + esc(r.owner || '') + '" placeholder="' + esc(state.meta.auditor || '') + '"><input type="date" style="margin-top:.3rem" data-field="chText" data-id="' + esc(r.id) + '" data-k="due" value="' + esc(r.due || '') + '"></td>' +
        '<td><select data-act="chField" data-id="' + esc(r.id) + '" data-k="status">' + R.CH_STATUS.map(function (x) { return opt(x, t('ch.st.' + x), r.status || 'open'); }).join('') + '</select></td>' +
        '<td><button class="btn btn-sm btn-danger" data-act="chDel" data-id="' + esc(r.id) + '" aria-label="' + esc(t('btn.delete')) + '">🗑</button></td></tr>');
    });
    h.push('</tbody></table></div></div>');
    return h.join('');
  }
  function newChance(base) {
    state.chSeq = state.chSeq || 1;
    return Object.assign({ id: 'C-' + ('00' + (state.chSeq++)).slice(-2), title: '', cause: '', category: 'technology', p: 3, i: 3, strategy: '', measures: '', owner: '', due: '', status: 'open' }, base || {});
  }

  function pmSwot() {
    var w = state.swot;
    var q = function (k, cls) {
      return '<div class="q q-' + k + '"><h3>' + esc(t('swot.' + k)) + '</h3><p>' + esc(t('swot.' + k + 'Hint')) + ' · ' + esc(t('swot.onePerLine')) + '</p>' +
        '<textarea data-field="swotText" data-k="' + k + '" aria-label="' + esc(t('swot.' + k)) + '">' + esc(w[k] || '') + '</textarea></div>';
    };
    var h = ['<div class="page-head"><div><h1>' + esc(t('swot.title')) + '</h1><p>' + esc(t('swot.sub')) + '</p></div><div class="row">' +
      '<button class="btn" data-act="swotDerive">' + esc(t('swot.derive')) + '</button><button class="btn" data-act="swotFromRisks">' + esc(t('swot.fromRisks')) + '</button><button class="btn" data-act="swotFromChances">' + esc(t('swot.fromChances')) + '</button></div></div>'];
    h.push('<div class="card"><div class="field"><label>' + esc(t('swot.subject')) + '</label><input type="text" data-field="swotText" data-k="subject" value="' + esc(w.subject || '') + '" placeholder="' + esc(HA.lang === 'de' ? 'z. B. Härtung der CosplayGIF-Serverlandschaft' : 'e.g. hardening of the server landscape') + '"></div>' +
      '<div class="swot-axis"><div>' + esc(t('swot.helpful')) + '</div><div>' + esc(t('swot.harmful')) + '</div></div>' +
      '<div class="swot" style="margin-top:.4rem">' + q('s') + q('w') + q('o') + q('t') + '</div></div>');
    h.push('<div class="card"><h2>' + esc(t('swot.tows')) + '</h2><div class="grid grid-2">' + ['so', 'st', 'wo', 'wt'].map(function (k) {
      return '<div class="field"><label>' + esc(t('swot.' + k)) + '</label><textarea data-field="swotText" data-k="' + k + '" rows="4">' + esc(w[k] || '') + '</textarea></div>';
    }).join('') + '</div></div>');
    return h.join('');
  }
  /** Zeilen an ein SWOT-Feld anhängen (ohne Dubletten). */
  function swotAppend(k, lines) {
    var cur = (state.swot[k] || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    var n = 0;
    lines.forEach(function (l) { l = (l || '').trim(); if (l && cur.indexOf(l) < 0) { cur.push(l); n++; } });
    state.swot[k] = cur.join('\n');
    return n;
  }

  /* ---------- Roadmap ---------- */
  V.roadmap = function () {
    var R = HA.Risk, f = ui.rm;
    var all = R.roadmap(state, { assetId: f.asset, includeProject: true });
    var list = all.filter(function (x) { return (!f.kind || x.kind === f.kind) && (!f.overdue || x.overdue); });
    var h = ['<div class="page-head"><div><h1>' + esc(t('rm.title')) + '</h1><p>' + esc(t('rm.sub')) + '</p></div><button class="btn" data-act="rmCsv">⬇ ' + esc(t('rm.csv')) + '</button></div>'];
    h.push('<div class="grid grid-4">' + R.PHASES.map(function (p, i) {
      var n = list.filter(function (x) { return x.prio === p; }).length, od = list.filter(function (x) { return x.prio === p && x.overdue; }).length;
      return '<div class="card stat" style="border-top:4px solid ' + R.COLORS[R.CATS[3 - i]] + '"><div class="value">' + n + '</div><div class="label">' + p.toUpperCase() + ' · ' + esc(t('rm.' + p)) + (od ? ' · <span style="color:var(--danger)">' + od + ' ' + esc(t('rm.overdue')) + '</span>' : '') + '</div></div>';
    }).join('') + '</div>');
    h.push('<div class="card no-print"><div class="filters"><div><label>' + esc(t('c.asset')) + '</label><select data-act="rmFilter" data-k="asset">' + opt('', t('c.all'), f.asset) + state.assets.map(function (a) { return opt(a.id, a.name, f.asset); }).join('') + '</select></div>' +
      '<div><label>' + esc(t('rm.source')) + '</label><select data-act="rmFilter" data-k="kind">' + opt('', t('c.all'), f.kind) + ['finding', 'measure', 'project'].concat(HA.Risk.roadmapKinds).map(function (k) { return opt(k, t('rm.kind.' + k), f.kind); }).join('') + '</select></div>' +
      '<div class="checks" style="align-self:end"><label><input type="checkbox" data-act="rmFilter" data-k="overdue"' + (f.overdue ? ' checked' : '') + '> ' + esc(t('rm.overdue')) + '</label></div></div><p class="small muted" style="margin:.5rem 0 0">' + esc(t('rm.prioHint')) + '</p></div>');
    if (!list.length) { h.push('<div class="card note ok">' + esc(t('rm.empty')) + '</div>'); return h.join(''); }
    R.PHASES.forEach(function (p, i) {
      var g = list.filter(function (x) { return x.prio === p; }); if (!g.length) return;
      h.push('<div class="card"><h2>' + R.badge(R.CATS[3 - i], p.toUpperCase()) + ' ' + esc(t('rm.' + p)) + ' <span class="muted small">(' + g.length + ')</span></h2><div class="table-wrap"><table><thead><tr><th>' + esc(t('rm.source')) +
        '</th><th>ID</th><th>' + esc(t('c.asset')) + '</th><th style="min-width:240px">' + esc(t('c.name')) + '</th><th style="min-width:200px">' + esc(t('c.solution')) + '</th><th style="min-width:150px">' + esc(t('c.responsible')) +
        '</th><th>' + esc(t('c.dueDate')) + '</th><th>' + esc(t('c.status')) + '</th></tr></thead><tbody>');
      g.forEach(function (x) {
        var key = esc(JSON.stringify(x.set));
        h.push('<tr><td class="small">' + esc(t('rm.kind.' + x.kind)) + '</td><td class="mono small nowrap">' + esc(x.ref) + '</td><td class="small">' + esc(x.asset) + '</td><td><b>' + esc(x.title) + '</b><div class="small muted">' + esc(x.detail) + '</div></td>' +
          '<td class="small">' + esc(x.action.length > 200 ? x.action.slice(0, 200) + '…' : x.action) + '</td>' +
          '<td><input type="text" data-field="rmText" data-k="owner" data-set="' + key + '" value="' + esc(x.owner) + '"></td>' +
          '<td><input type="date" data-field="rmText" data-k="due" data-set="' + key + '" value="' + esc(x.due) + '"' + (x.overdue ? ' class="invalid" title="' + esc(t('rm.overdue')) + '"' : '') + '></td><td class="small">' + esc(x.status) + '</td></tr>');
      });
      h.push('</tbody></table></div></div>');
    });
    return h.join('');
  };
  /** Verantwortlich/Termin aus der Roadmap in die Quelle zurückschreiben. */
  function roadmapWrite(set, k, value) {
    if (set.type === 'finding') { var ff = findFindingG(set.fid); if (ff) { ff.f.risk = ff.f.risk || {}; ff.f.risk[k] = value; } }
    else if (set.type === 'check') {
      var a = state.assets.find(function (x) { return x.id === set.assetId; });
      if (a) { a.checks[set.key] = Object.assign({}, a.checks[set.key] || {}); a.checks[set.key][k === 'owner' ? 'responsible' : 'due'] = value; }
    } else if (set.type === 'project') { var pr = state.projectRisks.find(function (x) { return x.id === set.id; }); if (pr) pr[k] = value; }
    else if (HA.Risk.roadmapWriters[set.type]) HA.Risk.roadmapWriters[set.type](state, set, k, value);
    scheduleSave();
  }

  /* ---------- TOM-Übersicht (Dashboard & Bericht) ---------- */
  function tomCard() {
    var s = HA.Risk.tomSummary(state);
    var h = ['<div class="card"><h2>' + esc(t('tom.title')) + '</h2><p class="small muted">' + esc(t('tom.sub')) + '</p><div class="table-wrap"><table><thead><tr><th>TOM</th><th>' + esc(HA.lang === 'de' ? 'Rechtsbezug' : 'Legal basis') + '</th>' +
      ['done', 'partial', 'open', 'notdone', 'na'].map(function (x) { return '<th class="num">' + esc(t('status.' + x)) + '</th>'; }).join('') + '<th class="num">' + esc(t('verify.effective')) + '</th></tr></thead><tbody>'];
    s.rows.forEach(function (r) {
      h.push('<tr><td title="' + esc(r.tom.topics.map(function (x) { return tx(HA.topicById(x)); }).join(', ')) + '"><b>' + esc(t('tom.' + r.tom.id)) + '</b></td><td class="small">' + esc(r.tom.law) + '</td>' +
        ['done', 'partial', 'open', 'notdone', 'na'].map(function (x) { return '<td class="num">' + (r[x] || '·') + '</td>'; }).join('') + '<td class="num">' + (r.effective || '·') + '</td></tr>');
    });
    h.push('</tbody></table></div><p class="small">' + esc(t('tom.review2', { scans: s.scans, ver: s.verified })) + '</p></div>');
    return h.join('');
  }

  /* ---------- Import ---------- */
  V.import = function () {
    var h = ['<div class="page-head"><div><h1>' + esc(t('imp.title')) + '</h1><p>' + esc(t('imp.sub')) + '</p></div></div>'];
    h.push('<div class="card"><div class="grid grid-3"><div><label for="impType">' + esc(t('imp.type')) + '</label><select id="impType" data-act="impType">' +
      [['', t('imp.auto')], ['nmap', 'Nmap XML (-oX)'], ['nmapgrep', 'Nmap grepable (-oG)'], ['nmapnormal', 'Nmap Normalausgabe (-oN)'], ['lynis', 'Lynis (report.dat / lynis.log)'], ['openvas', 'OpenVAS/Greenbone XML'], ['csv', 'CSV (' + t('imp.auto') + ')'],
       ['csv-findings', 'CSV – ' + t('imp.csv.findings')], ['csv-assets', 'CSV – ' + t('imp.csv.assets')], ['csv-catalog', 'CSV – ' + t('imp.csv.catalog')], ['oscap', 'OpenSCAP Results / ARF'],
       ['xccdf', 'XCCDF / SSG-Datastream'], ['json', 'JSON (OSCAL / Zwischenstand / Liste)'], ['bsi', 'BSI-Kompendium (XML/Text)']].map(function (x) { return opt(x[0], x[1], ui.importType); }).join('') + '</select></div>' +
      '<div><label for="impTarget">' + esc(t('imp.target')) + '</label>' + assetSelect('impTarget', ui.importTarget, true, t('imp.autoMatch')) + '</div><div></div></div>' +
      '<div class="dropzone" id="drop" data-act="pickFiles" tabindex="0" role="button" style="margin-top:1rem"><div class="big" aria-hidden="true">📥</div><b>' + esc(t('imp.drop')) + '</b><div class="small muted" style="margin-top:.4rem">' + esc(t('imp.formats')) + '</div></div></div>');
    // Offene XCCDF-Auswahl
    if (ui.pendingXccdf) {
      var px = ui.pendingXccdf;
      h.push('<div class="card"><h2>' + esc(t('imp.pending')) + ': ' + esc(px.benchmark.title) + '</h2><p class="small muted">' + esc(px.file.name) + ' · ' + px.rules.length + ' Regeln · v' + esc(px.benchmark.version) + '</p>' +
        '<div class="table-wrap" style="max-height:300px"><table><thead><tr><th>' + esc(t('imp.profiles')) + '</th><th class="num">' + esc(t('c.count')) + '</th></tr></thead><tbody>' +
        px.profiles.map(function (p) { return '<tr><td>' + esc(p.title) + '<div class="small mono muted">' + esc(p.id.replace('xccdf_org.ssgproject.content_profile_', '')) + '</div></td><td class="num">' + p.count + '</td></tr>'; }).join('') +
        '</tbody></table></div><div class="row" style="margin-top:.6rem"><select id="pxProfile" style="max-width:420px">' + opt('', t('imp.allRules') + ' (' + px.rules.length + ')', '') +
        px.profiles.map(function (p) { return opt(p.id, p.title + ' (' + p.count + ')', ''); }).join('') + '</select><button class="btn btn-primary" data-act="takeXccdf">' + esc(t('btn.apply')) + '</button><button class="btn" data-act="dropXccdf">' + esc(t('btn.cancel')) + '</button></div></div>');
    }
    // Scans ohne Asset-Zuordnung
    ui.pendingScans.forEach(function (ps, i) {
      var host = ps.hosts && ps.hosts[0] || {};
      h.push('<div class="card"><h3>' + esc(t('imp.pending')) + ': ' + esc(ps.tool) + ' – ' + esc(ps.file.name) + '</h3><p class="small">' + esc(t('imp.noAssetMatch')) + ' (' + esc([host.hostname, host.ip].filter(Boolean).join(' / ') || '?') + ', ' + ps.findings.length + ' ' + esc(t('c.finding')) + ')</p>' +
        '<div class="row">' + assetSelect('ps-' + i, '', true, '–') + '<button class="btn" data-act="assignScan" data-i="' + i + '">' + esc(t('btn.apply')) + '</button><button class="btn" data-act="assetFromScan" data-i="' + i + '">' + esc(t('imp.createAsset')) + '</button>' +
        '<button class="btn btn-sm" data-act="dropScan" data-i="' + i + '">✕</button></div></div>');
    });
    if (ui.importLog.length) h.push('<div class="card"><h2>' + esc(t('imp.log')) + '</h2><ul class="small">' + ui.importLog.slice(-30).reverse().map(function (l) { return '<li' + (l.err ? ' style="color:var(--danger)"' : '') + '>' + esc(l.msg) + '</li>'; }).join('') + '</ul></div>');
    h.push('<div class="card muted small"><b>Tipps:</b><ul><li>Grundschutz++: Katalog-JSON (OSCAL) aus dem BSI-Repository „Stand-der-Technik-Bibliothek“ importieren.</li>' +
      '<li>OpenSCAP: <span class="mono">ssg-&lt;produkt&gt;-ds.xml</span> importieren und Profil wählen (CIS, STIG, ANSSI, BSI …) – die Profil-Regelanzahl erscheint dann im Bibliotheksvergleich.</li>' +
      '<li>Scan-Ergebnisse (<span class="mono">--results</span>) setzen den Status der passenden Regeln automatisch und dienen als Wirksamkeitsnachweis.</li>' +
      '<li>CSV-Asset-Liste: Spalten z. B. <span class="mono">name;hostname;ip;os;owner;location</span>.</li><li>CSV-Maßnahmenkatalog: Spalten <span class="mono">id;title;description;level;os;topic;check</span>.</li></ul></div>');
    return h.join('');
  };

  /* ---------- Anleitungen ---------- */
  V.guides = function () {
    var a = currentAsset();
    if (!ui.guide) ui.guide = a ? (HA.GUIDES.find(function (g) { return g.os.indexOf(a.os) >= 0; }) || HA.GUIDES[0]).id : 'method';
    var g = HA.GUIDES.find(function (x) { return x.id === ui.guide; }) || HA.GUIDES[0];
    var h = ['<div class="page-head"><div><h1>' + esc(t('g.title')) + '</h1><p>' + esc(t('g.sub')) + '</p></div></div>'];
    h.push('<div class="tabs" role="tablist">' + HA.GUIDES.map(function (x) { return '<button role="tab" aria-selected="' + (x.id === g.id) + '" class="' + (x.id === g.id ? 'on' : '') + '" data-act="guide" data-id="' + x.id + '">' + esc(tx(x.title)) + '</button>'; }).join('') + '</div>');
    h.push('<div class="card"><h2>' + esc(tx(g.title)) + '</h2><p>' + esc(tx(g.intro)) + '</p>' + (t('g.langNote') ? '<div class="note">' + esc(t('g.langNote')) + '</div>' : ''));
    g.steps.forEach(function (s, i) {
      h.push('<div class="guide-step"><div class="num">' + (i + 1) + '</div><div><h3>' + esc(tx(s.t)) + '</h3><p>' + esc(s.d) + '</p>' + (s.code ? codeBlock(s.code) : '') +
        (s.refs && s.refs.length ? '<div class="row small"><span class="muted">' + esc(t('g.refs')) + ':</span> ' + s.refs.map(function (r) { return '<span class="chip" data-act="gotoRef" data-q="' + esc(r) + '">' + esc(r) + '</span>'; }).join(' ') + '</div>' : '') + '</div></div>');
    });
    h.push('</div>');
    return h.join('');
  };

  /* ---------- Bericht ---------- */
  V.report = function () {
    var r = ui.report;
    var h = ['<div class="page-head"><div><h1>' + esc(t('rep.title')) + '</h1><p>' + esc(t('rep.sub')) + '</p></div></div>'];
    h.push('<div class="card"><div class="grid grid-2"><div><label for="repAsset">' + esc(t('rep.scope')) + '</label><select id="repAsset" data-act="repOpt" data-k="asset">' + opt('all', t('rep.allAssets'), r.asset) +
      state.assets.map(function (a) { return opt(a.id, a.name, r.asset); }).join('') + '</select></div><div class="checks" style="align-self:end">' +
      [['open', 'rep.optOpen'], ['findings', 'rep.optFindings'], ['desc', 'rep.optDesc'], ['cmds', 'rep.optCmds'], ['tom', 'rep.optTom'], ['risk', 'rep.optRisk'], ['pm', 'rep.optPm'], ['swot', 'rep.optSwot'], ['roadmap', 'rep.optRoadmap']].map(function (x) {
        return '<label><input type="checkbox" data-act="repOpt" data-k="' + x[0] + '"' + (r[x[0]] ? ' checked' : '') + '> ' + esc(t(x[1])) + '</label>'; }).join('') +
      EXT.reportOpts.map(function (x) { if (r[x.key] === undefined) r[x.key] = x.def !== false;
        return '<label><input type="checkbox" data-act="repOpt" data-k="' + x.key + '"' + (r[x.key] ? ' checked' : '') + '> ' + esc(tx(x.label)) + '</label>'; }).join('') + '</div></div>' +
      '<div class="row" style="margin-top:.8rem"><button class="btn btn-primary" data-act="genReport">' + esc(t('btn.generate')) + '</button><button class="btn" data-act="printReport">🖨 ' + esc(t('btn.print')) + '</button><button class="btn" data-act="dlReport">⬇ ' + esc(t('btn.download')) + '</button></div></div>');
    h.push('<div class="card"><h2>' + esc(t('rep.preview')) + '</h2><iframe id="repFrame" class="report-frame" title="' + esc(t('rep.preview')) + '"></iframe></div>');
    return h.join('');
  };
  function reportHtml() {
    var r = ui.report;
    return HA.Report.build(state, { assetIds: r.asset === 'all' ? null : [r.asset], includeCmds: r.cmds, includeOpen: r.open, includeFindings: r.findings, includeDesc: r.desc, includeRisk: r.risk, includePm: r.pm, includeSwot: r.swot, includeRoadmap: r.roadmap, includeTom: r.tom,
      ext: EXT.reportOpts.reduce(function (o, x) { o[x.key] = r[x.key] !== undefined ? r[x.key] : x.def !== false; return o; }, {}) });
  }
  function showReport() { var f = document.getElementById('repFrame'); if (f) f.srcdoc = state.assets.length ? reportHtml() : '<p style="font-family:sans-serif;padding:2rem">' + esc(t('dash.noAssets')) + '</p>'; }

  /* ---------- Einstellungen ---------- */
  V.settings = function () {
    var m = state.meta;
    var h = ['<div class="page-head"><div><h1>' + esc(t('set.title')) + '</h1></div></div>'];
    h.push('<div class="card"><div class="grid grid-2">' +
      '<div class="field"><label>' + esc(t('set.lang')) + '</label><select data-act="setMeta" data-k="lang">' + opt('de', 'Deutsch', m.lang) + opt('en', 'English', m.lang) + '</select></div>' +
      '<div class="field"><label>' + esc(t('set.theme')) + '</label><select data-act="setMeta" data-k="theme">' + ['auto', 'light', 'dark'].map(function (x) { return opt(x, t('set.theme.' + x), m.theme); }).join('') + '</select></div>' +
      '<div class="field"><label>' + esc(t('set.org')) + '</label><input type="text" data-field="meta" data-k="org" value="' + esc(m.org) + '"></div>' +
      '<div class="field"><label>' + esc(t('set.auditor')) + '</label><input type="text" data-field="meta" data-k="auditor" value="' + esc(m.auditor) + '"></div>' +
      '<div class="field"><label>' + esc(t('set.staleDays')) + '</label><input type="number" min="1" data-field="meta" data-k="staleDays" value="' + esc(m.staleDays) + '"></div>' +
      '<div class="field"><label>' + esc(t('set.storageMode')) + '</label><div>' + esc(t('store.' + HA.Storage.mode())) + '</div></div></div></div>');
    h.push(brandCard());
    EXT.settingsCards.forEach(function (fn) { h.push(fn()); });
    h.push('<div class="card"><h2>' + esc(t('set.data')) + '</h2><div class="row"><button class="btn" data-act="export">💾 ' + esc(t('set.export')) + '</button><button class="btn" data-act="load">📂 ' + esc(t('set.import')) + '</button>' +
      '<button class="btn btn-danger" data-act="wipe">🗑 ' + esc(t('set.wipe')) + '</button></div><div class="note" style="margin-top:1rem">' + esc(t('set.privacy')) + '</div></div>');
    h.push('<div class="card small"><h2>' + esc(HA.lang === 'de' ? 'Quellen & Lizenzen' : 'Sources & licences') + '</h2><ul>' + HA.LIBRARIES.filter(function (l) { return l.url; }).map(function (l) {
      return '<li><b>' + esc(tx(l.name)) + '</b> – ' + esc(l.license) + '<br><span class="mono muted" style="word-break:break-all">' + esc(l.url) + '</span></li>'; }).join('') +
      '</ul><p class="muted">' + esc(HA.lang === 'de' ? 'Diese Webseite nutzt keine Drittanbieter-Bibliotheken (reines HTML/CSS/JavaScript). Werkzeuge in den Anleitungen (Lynis, OpenSCAP, Nmap, Greenbone, HardeningKitty, mSCP, AIDE …) sind Open Source bzw. kostenlos.' : 'This page uses no third-party libraries (plain HTML/CSS/JavaScript). Tools referenced in the guides (Lynis, OpenSCAP, Nmap, Greenbone, HardeningKitty, mSCP, AIDE …) are open source or free.') + '</p></div>');
    return h.join('');
  };

  /* ---------- Branding ---------- */
  /** Lesbare Schriftfarbe (hell/dunkel) zu einer Hintergrundfarbe. */
  function contrastColor(hex) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6 ? '#111' : '#fff';
  }
  /** Logo, Organisation und Akzentfarbe in der Oberfläche anwenden. */
  function applyBranding() {
    var B = state.meta.brand || {}, root = document.documentElement;
    var brand = document.querySelector('.topbar .brand'); if (!brand) return;
    // Eigenes Logo (falls hochgeladen und gewünscht), sonst Standardlogo „Little RiskBee“
    var img = document.getElementById('appLogo');
    var custom = !!(B.logo && B.logoInApp);
    img.src = custom ? B.logo : (HA.DEFAULT_LOGO || 'assets/little-riskbee.svg');
    img.alt = custom ? (state.meta.org || 'Logo') : 'Little RiskBee';
    img.classList.toggle('custom', custom);
    var sub = brand.querySelector('.brand-sub');
    if (sub) sub.textContent = state.meta.org ? state.meta.org + (B.subtitle ? ' · ' + B.subtitle : '') : t('app.subtitle');
    if (B.useInApp && /^#[0-9a-f]{6}$/i.test(B.color || '')) {
      root.style.setProperty('--primary', B.color); root.style.setProperty('--primary-contrast', contrastColor(B.color));
    } else { root.style.removeProperty('--primary'); root.style.removeProperty('--primary-contrast'); }
  }
  /** Logo-Datei lokal einlesen; Rastergrafiken werden verkleinert (Canvas), SVG bleibt Vektor. */
  function loadLogo(file) {
    var B = state.meta.brand;
    if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.type)) { toast(t('brand.invalid'), true); return; }
    var maxKb = file.type === 'image/svg+xml' ? 300 : 5120;
    if (file.size > maxKb * 1024) { toast(t('brand.tooBig', { kb: maxKb }), true); return; }
    var rd = new FileReader();
    rd.onload = function () {
      if (file.type === 'image/svg+xml') { B.logo = rd.result; done(); return; }
      var im = new Image();
      im.onload = function () {
        var sc = Math.min(1, 600 / im.width, 300 / im.height);
        var c = document.createElement('canvas'); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        B.logo = file.type === 'image/jpeg' ? c.toDataURL('image/jpeg', 0.9) : c.toDataURL('image/png');
        done();
      };
      im.onerror = function () { toast(t('brand.invalid'), true); };
      im.src = rd.result;
    };
    rd.readAsDataURL(file);
    function done() { scheduleSave(); applyBranding(); render(); toast(t('brand.saved')); }
  }
  function brandCard() {
    var B = state.meta.brand, m = state.meta;
    var org = [m.org ? '<b>' + esc(m.org) + '</b>' : '', esc(B.subtitle), esc(B.address).replace(/\n/g, '<br>'), esc(B.contact), esc(B.web)].filter(Boolean).join('<br>');
    var accent = /^#[0-9a-f]{6}$/i.test(B.color || '') ? B.color : '#0b3d91';
    return '<div class="card"><h2>' + esc(t('brand.title')) + '</h2><div class="grid grid-2"><div>' +
      '<label>' + esc(t('brand.logo')) + '</label><div class="row" style="align-items:flex-start"><div class="logo-preview">' + '<img src="' + esc(B.logo || HA.DEFAULT_LOGO) + '" alt="Logo"' + (B.logo ? '' : ' title="Standardlogo Little RiskBee"') + '></div>' +
      '<div class="row" style="flex-direction:column;align-items:stretch"><button class="btn" data-act="brandUpload">⬆ ' + esc(t('brand.upload')) + '</button>' + (B.logo ? '<button class="btn btn-danger" data-act="brandRemove">' + esc(t('brand.remove')) + '</button>' : '') + '</div></div>' +
      '<input type="file" id="fileLogo" data-act="logoFile" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden>' +
      '<p class="small muted" style="margin-top:.4rem">' + esc(t('brand.logoHint')) + '</p>' +
      '<div class="checks"><label><input type="checkbox" data-act="brandCheck" data-k="logoInApp"' + (B.logoInApp ? ' checked' : '') + '> ' + esc(t('brand.logoInApp')) + '</label>' +
      '<label><input type="checkbox" data-act="brandCheck" data-k="useInApp"' + (B.useInApp ? ' checked' : '') + '> ' + esc(t('brand.useInApp')) + '</label></div>' +
      '<div class="field" style="margin-top:.7rem"><label>' + esc(t('brand.color')) + '</label><div class="field-inline"><input type="color" data-field="brand" data-k="color" value="' + esc(accent) + '" style="width:56px;height:38px;padding:2px"><span class="mono small">' + esc(accent) + '</span></div></div></div><div>' +
      ['subtitle', 'contact', 'web', 'reportTitle', 'footer'].map(function (k) {
        return '<div class="field"><label>' + esc(t('brand.' + k)) + '</label><input type="text" data-field="brand" data-k="' + k + '" value="' + esc(B[k] || '') + '"' +
          (k === 'footer' ? ' placeholder="' + esc(HA.lang === 'de' ? 'VERTRAULICH – Härtungsbericht' : 'CONFIDENTIAL – hardening report') + '"' : '') + '></div>';
      }).join('') +
      '<div class="field"><label>' + esc(t('brand.address')) + '</label><textarea data-field="brand" data-k="address" rows="2">' + esc(B.address || '') + '</textarea></div></div></div>' +
      '<h3 style="margin-top:1rem">' + esc(t('brand.preview')) + '</h3><div style="background:#fff;color:#111;border:1px solid #ccd;border-top:10px solid ' + esc(accent) + ';border-radius:6px;padding:1rem 1.2rem;max-width:760px">' +
      '<div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start"><img src="' + esc(B.logo || HA.DEFAULT_LOGO) + '" alt="" style="max-height:60px;max-width:200px;object-fit:contain">' +
      '<div style="text-align:right;font-size:.8rem;line-height:1.45">' + (org || '<span style="color:#888">' + esc(t('set.org')) + '</span>') + '</div></div>' +
      '<div style="font-size:1.35rem;font-weight:700;color:' + esc(accent) + ';margin-top:.8rem">' + esc(B.reportTitle || (HA.lang === 'de' ? 'Härtungsbericht und Wirksamkeitskontrolle' : 'Hardening report and effectiveness review')) + '</div></div></div>';
  }

  /* ---------- Rendern ---------- */
  function render() {
    var view = document.getElementById('view');
    var scroll = window.scrollY;
    var keepScroll = render._same === ui.view;
    render._same = ui.view;
    view.innerHTML = (V[ui.view] || V.dashboard)();
    document.querySelectorAll('.sidebar a').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-view') === ui.view); });
    if (ui.view === 'report') showReport();
    decoratePersons(view);
    EXT.afterRender.forEach(function (fn) { fn(ui.view); });
    if (keepScroll) window.scrollTo(0, scroll); else window.scrollTo(0, 0);
  }
  function go(view) { ui.view = view; if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view); render(); closeMenu(); }
  function closeMenu() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('menuBtn').setAttribute('aria-expanded', 'false'); }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.meta.theme || 'auto');
    document.getElementById('btnTheme').textContent = { auto: '🌓', light: '☀️', dark: '🌙' }[state.meta.theme || 'auto'];
  }
  function applyLang() {
    HA.lang = state.meta.lang || 'de';
    HA.applyStaticI18n();
    document.getElementById('btnLang').textContent = HA.lang.toUpperCase();
    if (state && state.meta) applyBranding();
  }

  /* =================================================================
   * E. Import-Verarbeitung
   * =============================================================== */
  function log(msg, err) { ui.importLog.push({ msg: msg, err: !!err }); if (err) toast(msg, true); }

  function handleFiles(files) {
    var list = Array.prototype.slice.call(files);
    var chain = Promise.resolve();
    list.forEach(function (file) {
      chain = chain.then(function () {
        return HA.Parsers.parseFile(file, ui.importType).then(function (res) { applyImport(res); })
          .catch(function (e) { log(t('imp.failed', { file: file.name, err: e.message || e }), true); });
      });
    });
    var before = ui.importLog.length;
    chain.then(function () {
      scheduleSave(); render();
      var errs = ui.importLog.slice(before).filter(function (l) { return l.err; }).length;
      toast(t('imp.batchDone', { n: list.length, e: errs }), errs > 0);
    });
  }

  /** Ergebnis eines Parsers in den Zustand übernehmen. */
  function applyImport(res) {
    var kindLabel = res.kind === 'scan' ? res.tool : res.kind;
    log(t('imp.detected', { file: res.file.name, kind: kindLabel }));
    if (res.kind === 'state') {
      confirmDlg(t('msg.confirmLoad'), function () { state = normalize(res.state); invalidate(); applyLang(); applyTheme(); scheduleSave(); render(); toast(t('imp.stateLoaded')); });
      return;
    }
    if (res.kind === 'catalog') { addCatalog(res.catalog, res.file); return; }
    if (res.kind === 'xccdf') { ui.pendingXccdf = res; return; }
    if (res.kind === 'assets') {
      res.assets.forEach(function (x) {
        var fam = HA.osById(x.os).family;
        state.assets.push(Object.assign({ id: uid('a'), checks: {}, scans: [], sb: { c: 'normal', i: 'normal', a: 'normal' }, approach: 'standard', role: '',
          libs: fam === 'windows' ? ['bsi2023', 'msbaseline'] : fam === 'macos' ? ['bsi2023', 'mscp'] : ['bsi2023', 'ssg'] }, x));
      });
      log(t('imp.assetsAdded', { n: res.assets.length }));
      return;
    }
    // Scans und Nachweisdateien einem Asset zuordnen
    if (res.kind === 'evidence') { res.tool = 'file'; res.findings = []; res.hosts = []; res.scanDate = res.file.lastModified; log(t('imp.evidenceOnly')); }
    if (res.tool === 'nmap' && !res.findings.length) log(res.file.name + ': ' + t('imp.nmapNoPorts'), true);
    // Berichte mit mehreren Hosts (Nmap-Netzscan, OpenVAS-Task) je Host aufteilen,
    // damit jeder Befund beim richtigen Asset landet. Ein fest gewähltes Ziel-Asset hat Vorrang.
    var parts = (!ui.importTarget && (res.hosts || []).length > 1) ? splitByHost(res) : [res];
    parts.forEach(function (part) {
      var asset = state.assets.find(function (x) { return x.id === ui.importTarget; }) || matchAsset(part.hosts || []);
      if (!asset) { ui.pendingScans.push(part); log(t('imp.noAssetMatch') + ' (' + hostLabel(part) + ')', true); return; }
      addScan(asset, part);
    });
  }
  function hostLabel(res) { var h = (res.hosts || [])[0] || {}; return [h.hostname, h.ip].filter(Boolean).join(' / ') || '?'; }

  /** Einen Mehr-Host-Bericht in einzelne Teilberichte je Host zerlegen. */
  function splitByHost(res) {
    return res.hosts.map(function (h) {
      var keys = [h.ip, h.hostname].filter(Boolean);
      var part = Object.assign({}, res, { hosts: [h], findings: res.findings.filter(function (f) { return keys.indexOf(f.host) >= 0; }) });
      part.file = Object.assign({}, res.file, { partOf: res.hosts.length + ' Hosts' });
      return part;
    });
  }

  /** Asset anhand IP/Hostname finden. */
  function matchAsset(hosts) {
    var norm = function (s) { return (s || '').toLowerCase().split('.')[0]; };
    for (var i = 0; i < hosts.length; i++) {
      var h = hosts[i];
      var m = state.assets.find(function (a) {
        var ips = (a.ip || '').split(/[\s,;]+/).filter(Boolean);
        return (h.ip && ips.indexOf(h.ip) >= 0) || (h.hostname && a.hostname && norm(a.hostname) === norm(h.hostname)) || (h.hostname && norm(a.name) === norm(h.hostname));
      });
      if (m) return m;
    }
    return null;
  }

  /** Scan an ein Asset anhängen, Status übernehmen, OpenSCAP-Automatik. */
  function addScan(asset, res) {
    if (asset.scans.some(function (s) { return s.file && s.file.sha256 === res.file.sha256 && hostLabel(s) === hostLabel(res); })) {
      log(res.file.name + ': ' + (HA.lang === 'de' ? 'bereits importiert (gleiche Prüfsumme).' : 'already imported (same checksum).'), true); return;
    }
    var prev = latestScan(asset, res.tool);
    var scan = { id: uid('s'), tool: res.tool, scanDate: res.scanDate || res.file.lastModified || new Date().toISOString(), importedAt: new Date().toISOString(),
      file: res.file, meta: res.meta || {}, hosts: res.hosts || [], findings: (res.findings || []).map(function (f) { return Object.assign({ status: 'open', note: '' }, f); }) };
    if (prev) {
      var prevMap = {}; prev.findings.forEach(function (f) { prevMap[f.id] = f; });
      var newIds = {}; scan.findings.forEach(function (f) { newIds[f.id] = 1; });
      // Bewertungen (akzeptiert/Fehlalarm) aus dem vorherigen Scan übernehmen
      scan.findings.forEach(function (f) {
        var p = prevMap[f.id];
        if (p && p.risk) f.risk = JSON.parse(JSON.stringify(p.risk));   // Risikobewertung und ID übernehmen
        if (p && (p.status === 'accepted' || p.status === 'falsepositive')) { f.status = p.status; f.note = p.note; f.statusDate = p.statusDate; }
        else if (p && p.status === 'fixed') f.note = (HA.lang === 'de' ? 'Erneut gefunden – zuvor als behoben markiert. ' : 'Found again – previously marked fixed. ') + (p.note || '');
        else if (p && p.note) f.note = p.note;
      });
      // Im neuen Scan nicht mehr gefundene offene Befunde als behoben kennzeichnen
      if ((scan.scanDate || '') >= (prev.scanDate || '')) {
        prev.findings.forEach(function (f) {
          if (!newIds[f.id] && ((f.status || 'open') === 'open' || f.status === 'partial')) {
            f.status = 'fixed'; f.statusDate = scan.scanDate;
            f.note = ((f.note ? f.note + ' · ' : '') + (HA.lang === 'de' ? 'Nicht mehr gefunden im Scan vom ' : 'No longer found in scan of ') + fmtDate(scan.scanDate)).replace(/<[^>]+>/g, '');
          }
        });
      }
    }
    asset.scans.push(scan);
    HA.Risk.ensureIds(state);
    log(t('imp.scanAdded', { asset: asset.name, n: scan.findings.length }));
    if (res.tool === 'oscap') applyOscap(asset, scan);
  }

  /** OpenSCAP-Regelergebnisse auf Checklisten-Einträge übertragen. */
  function applyOscap(asset, scan) {
    var byRef = {};
    allItems().forEach(function (it) {
      var cat = state.catalogs.find(function (c) { return c.lib === it.lib; });
      if (it.lib === 'ssg' || (cat && cat.libKind === 'xccdf')) (byRef[it.ref] = byRef[it.ref] || []).push(it);
    });
    var n = 0, dateTxt = fmtDate(scan.scanDate, true);
    (scan.meta.ruleResults || []).forEach(function (r) {
      (byRef[r.rule] || []).forEach(function (it) {
        if (r.result === 'notselected' || r.result === 'notapplicable' || r.result === 'notchecked') {
          setCheckRaw(asset, it, { scanResult: r.result, scanDate: scan.scanDate, autoNote: t('cl.autoScan', { date: dateTxt, result: r.result }) }); return;
        }
        var c = getCheck(asset, it);
        var patch = { scanResult: r.result, scanDate: scan.scanDate, autoNote: t('cl.autoScan', { date: dateTxt, result: r.result }), verDate: scan.scanDate.slice(0, 10), verMethod: 'scan' };
        if (r.result === 'pass') { patch.verResult = 'effective'; if (c.status !== 'na') patch.status = 'done'; }
        else if (r.result === 'fail' || r.result === 'error') { patch.verResult = 'ineffective'; if (c.status === 'done' || !c.status) patch.status = 'open'; }
        setCheckRaw(asset, it, patch); n++;
      });
    });
    if (n) log(t('imp.oscapApplied', { n: n }));
  }
  function setCheckRaw(asset, it, patch) { var k = itemKey(it); asset.checks[k] = Object.assign({}, asset.checks[k] || {}, patch, { updated: new Date().toISOString() }); }

  /** Importierten Katalog als Bibliothek speichern. */
  function addCatalog(cat, file, extra) {
    if (!cat.items.length) { log(file.name + ': 0 ' + (HA.lang === 'de' ? 'Maßnahmen erkannt' : 'measures found'), true); return; }
    var lib = cat.libKind === 'gspp' ? 'gspp' : 'cat-' + (state.seq++);
    if (lib === 'gspp') state.catalogs = state.catalogs.filter(function (c) { return c.lib !== 'gspp'; });
    var palette = ['#0e7490', '#9333ea', '#b45309', '#be123c', '#4d7c0f', '#1d4ed8', '#a21caf'];
    var short = cat.libKind === 'gspp' ? 'Grundschutz++' : cat.libKind === 'bsi-import' ? 'BSI Import' : (extra && extra.short) || cat.name.slice(0, 22);
    var c = { lib: lib, name: cat.name, short: short, version: cat.version || '', libKind: cat.libKind, color: lib === 'gspp' ? '#0b7a75' : palette[state.catalogs.length % palette.length],
      source: file.name, sha256: file.sha256, importedAt: new Date().toISOString(), items: cat.items.map(function (it) { return Object.assign({}, it, { lib: lib }); }) };
    state.catalogs.push(c); invalidate();
    log(t('imp.catalogAdded', { name: c.name, n: c.items.length }));
  }

  /** Ausgewähltes XCCDF-Profil als Bibliothek übernehmen. */
  function takeXccdf(profileId) {
    var px = ui.pendingXccdf; if (!px) return;
    var title = px.benchmark.title || px.file.name;
    var fam = /windows/i.test(title) ? ['windows'] : /mac ?os/i.test(title) ? ['macos'] : ['linux'];
    var prof = px.profiles.find(function (p) { return p.id === profileId; });
    var ids = prof ? prof.ruleIds : px.rules.map(function (r) { return r.fullId; });
    var set = {}; ids.forEach(function (i) { set[i] = 1; });
    var elevated = prof && /l2|level ?2|stig|high|enhanced|restrictive/i.test(prof.id + ' ' + prof.title);
    var items = px.rules.filter(function (r) { return set[r.fullId]; }).map(function (r) {
      return { ref: r.ref, title: r.title, desc: r.desc, severity: r.severity, topic: r.topic, level: elevated ? 'H' : 'S', os: fam, role: 'any', group: '' };
    });
    var prodShort = title.replace(/^Guide to the Secure Configuration of\s*/i, '').slice(0, 30);
    var profShort = prof ? prof.id.replace('xccdf_org.ssgproject.content_profile_', '') : 'all';
    addCatalog({ name: 'SSG ' + prodShort + ' – ' + (prof ? prof.title : t('imp.allRules')), libKind: 'xccdf', version: px.benchmark.version, items: items }, px.file,
      { short: ('SSG ' + profShort).slice(0, 24) });
    ui.pendingXccdf = null;
    scheduleSave(); render();
  }

  /* =================================================================
   * F. Ereignisbehandlung & Start
   * =============================================================== */
  function onClick(e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var act = el.getAttribute('data-act'), id = el.getAttribute('data-id');
    if (runExt(EXT.click, act, el, e)) return;
    var a = currentAsset();
    switch (act) {
      case 'newAsset': e.preventDefault(); editAsset(null, el.getAttribute('data-kind')); break;
      case 'editAsset': e.preventDefault(); editAsset(state.assets.find(function (x) { return x.id === id; })); break;
      case 'openAsset': e.preventDefault(); ui.assetId = id; go('checklist'); break;
      case 'dupAsset': {
        var src = state.assets.find(function (x) { return x.id === id; });
        var cp = JSON.parse(JSON.stringify(src)); cp.id = uid('a'); cp.name += ' (Kopie)'; cp.scans = [];
        state.assets.push(cp); scheduleSave(); render(); break;
      }
      case 'delAsset': {
        var da = state.assets.find(function (x) { return x.id === id; });
        confirmDlg(t('assets.confirmDelete', { name: da.name }), function () {
          state.assets = state.assets.filter(function (x) { return x.id !== id; });
          state.customItems = state.customItems.filter(function (c) { return c.assetId !== id; }); invalidate();
          scheduleSave(); render();
        });
        break;
      }
      case 'setSb': {
        var sa = state.assets.find(function (x) { return x.id === id; });
        sa.sb[el.getAttribute('data-k')] = el.getAttribute('data-v'); scheduleSave(); render(); break;
      }
      case 'copy': {
        var pre = el.parentElement.querySelector('pre');
        var done = function () { el.textContent = t('btn.copied'); setTimeout(function () { el.textContent = t('btn.copy'); }, 1500); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(pre.textContent).then(done).catch(function () { selectText(pre); });
        else { selectText(pre); try { document.execCommand('copy'); done(); } catch (x) { /* ignorieren */ } }
        break;
      }
      case 'resetFilters': ui.cl = { q: '', lib: '', topic: '', level: '', status: '', groupBy: 'group' }; render(); break;
      case 'filterTopic': ui.cl.topic = el.getAttribute('data-topic'); render(); break;
      case 'search': ui.cl.q = el.getAttribute('data-q'); ui.cl.lib = ''; render(); break;
      case 'gotoRef': ui.cl = { q: el.getAttribute('data-q'), lib: '', topic: '', level: '', status: '', groupBy: 'group' }; go('checklist'); break;
      case 'expandAll': case 'collapseAll':
        applicableItems(a).forEach(function (it) { ui.openItems[itemKey(it)] = act === 'expandAll'; }); render(); break;
      case 'bulkNa': bulkNa(); break;
      case 'addCustom': addCustom(); break;
      case 'delCustom': {
        var key = el.getAttribute('data-key');
        state.customItems = state.customItems.filter(function (c) { return 'custom|' + c.ref !== key; }); invalidate(); scheduleSave(); render(); break;
      }
      case 'browseLib': ui.libBrowse = id || ''; ui.libBrowseQ = ''; render(); if (id) { var b = document.getElementById('browse'); if (b) b.scrollIntoView(); } break;
      case 'delCatalog':
        confirmDlg(t('lib.removeCat') + '?', function () { state.catalogs = state.catalogs.filter(function (c) { return c.lib !== id; });
          state.assets.forEach(function (x) { x.libs = x.libs.filter(function (l) { return l !== id; }); }); invalidate(); scheduleSave(); render(); });
        break;
      case 'delScan':
        confirmDlg(t('scan.confirmRemove'), function () { a.scans = a.scans.filter(function (s) { return s.id !== id; }); scheduleSave(); render(); }); break;
      case 'takeOver': {
        var ff = findFinding(el.getAttribute('data-fid')); if (!ff) break;
        addCustom({ ref: ff.f.ref || '', title: ff.f.title, desc: [ff.f.desc, ff.f.solution].filter(Boolean).join(' – '), topic: ff.f.topic || HA.Parsers.guessTopic(ff.f.ref, ff.f.title), level: ff.f.severity === 'high' ? 'B' : 'S' });
        break;
      }
      case 'pickFiles': document.getElementById('fileImport').click(); break;
      case 'takeXccdf': takeXccdf(document.getElementById('pxProfile').value); break;
      case 'dropXccdf': ui.pendingXccdf = null; render(); break;
      case 'assignScan': {
        var i = +el.getAttribute('data-i'); var sel = document.getElementById('ps-' + i).value;
        var target = state.assets.find(function (x) { return x.id === sel; }); if (!target) break;
        addScan(target, ui.pendingScans[i]); ui.pendingScans.splice(i, 1); scheduleSave(); render(); break;
      }
      case 'assetFromScan': {
        var j = +el.getAttribute('data-i'); var ps = ui.pendingScans[j]; var hst = ps.hosts[0] || {};
        var osId = HA.Parsers.guessOs(hst.os) || 'debian'; var fam = HA.osById(osId).family;
        var na = { id: uid('a'), name: hst.hostname || hst.ip || ps.file.name, hostname: hst.hostname || '', ip: hst.ip || '', os: osId, osVersion: hst.os || '', role: '', owner: '', location: '', description: '',
          approach: 'standard', showH: false, libs: fam === 'windows' ? ['bsi2023', 'msbaseline'] : fam === 'macos' ? ['bsi2023', 'mscp'] : ['bsi2023', 'ssg'], sb: { c: 'normal', i: 'normal', a: 'normal' }, checks: {}, scans: [] };
        state.assets.push(na); addScan(na, ps); ui.pendingScans.splice(j, 1); scheduleSave(); render(); break;
      }
      case 'dropScan': ui.pendingScans.splice(+el.getAttribute('data-i'), 1); render(); break;
      case 'guide': ui.guide = id; render(); break;
      case 'genReport': showReport(); break;
      case 'printReport': {
        var fr = document.getElementById('repFrame');
        if (!fr.srcdoc) showReport();
        setTimeout(function () { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (x) { toast(x.message, true); } }, 300);
        break;
      }
      case 'dlReport': {
        var name = (ui.report.asset === 'all' ? 'alle-assets' : (state.assets.find(function (x) { return x.id === ui.report.asset; }) || {}).name || 'asset').replace(/[^\w.-]+/g, '_');
        HA.Storage.download(new Blob([reportHtml()], { type: 'text/html' }), 'Haertungsbericht_' + name + '_' + new Date().toISOString().slice(0, 10) + '.html'); break;
      }
      case 'riskCell': ui.risk.cell = ui.risk.cell === el.getAttribute('data-cell') ? '' : el.getAttribute('data-cell'); render(); break;
      case 'clearCell': ui.risk.cell = ''; render(); break;
      case 'applySuggest': {
        var n = 0;
        HA.Risk.findingRows(state, { assetId: ui.risk.asset, includeClosed: ui.risk.closed }).forEach(function (r) {
          if (!r.suggested) return;
          r.f.risk = Object.assign(r.f.risk || {}, { p: r.p, i: r.i, rated: true });
          if (!r.f.risk.threat) r.f.risk.threat = r.threatSuggest;
          n++;
        });
        scheduleSave(); render(); toast(t('risk.applied', { n: n })); break;
      }
      case 'pmAdd': state.projectRisks.push(newProjectRisk()); scheduleSave(); render(); break;
      case 'pmExamples': {
        var ex = HA.Risk.exampleProjectRisks();
        ex.forEach(function (r) { state.projectRisks.push(newProjectRisk(r)); });
        scheduleSave(); render(); toast(t('pm.examplesAdded', { n: ex.length })); break;
      }
      case 'pmDel':
        confirmDlg(t('pm.confirmDel', { id: id }), function () { state.projectRisks = state.projectRisks.filter(function (r) { return r.id !== id; }); scheduleSave(); render(); }); break;
      case 'pmTab': ui.pmTab = id; render(); break;
      case 'brandUpload': document.getElementById('fileLogo').click(); break;
      case 'brandRemove': state.meta.brand.logo = ''; scheduleSave(); applyBranding(); render(); break;
      case 'chAdd': state.projectChances.push(newChance()); scheduleSave(); render(); break;
      case 'chExamples': {
        var exc = HA.Risk.exampleChances(); exc.forEach(function (r) { state.projectChances.push(newChance(r)); });
        scheduleSave(); render(); toast(t('ch.added', { n: exc.length })); break;
      }
      case 'chDel':
        confirmDlg(t('ch.confirmDel', { id: id }), function () { state.projectChances = state.projectChances.filter(function (r) { return r.id !== id; }); scheduleSave(); render(); }); break;
      case 'swotDerive': { var d = HA.Risk.swotDerive(state); var nn = swotAppend('s', d.s) + swotAppend('w', d.w); scheduleSave(); render(); toast(t('swot.added', { n: nn })); break; }
      case 'swotFromRisks': { var n1 = swotAppend('t', state.projectRisks.filter(function (r) { return r.status !== 'done'; }).map(function (r) { return r.title; })); scheduleSave(); render(); toast(t('swot.added', { n: n1 })); break; }
      case 'swotFromChances': { var n2 = swotAppend('o', state.projectChances.filter(function (r) { return r.status !== 'missed'; }).map(function (r) { return r.title; })); scheduleSave(); render(); toast(t('swot.added', { n: n2 })); break; }
      case 'rmCsv':
        HA.Storage.download(new Blob([HA.Risk.roadmapCsv(HA.Risk.roadmap(state, { assetId: ui.rm.asset, includeProject: true }))], { type: 'text/csv;charset=utf-8' }),
          'Massnahmen-Roadmap_' + new Date().toISOString().slice(0, 10) + '.csv'); break;
      case 'export': exportState(); break;
      case 'load': document.getElementById('fileState').click(); break;
      case 'wipe':
        confirmDlg(t('set.wipeConfirm'), function () { HA.Storage.wipe().then(function () { var lang = state.meta.lang; state = normalize(defaultState()); state.meta.lang = lang; invalidate(); render(); toast(t('set.wiped')); }); });
        break;
    }
  }
  function selectText(node) { var r = document.createRange(); r.selectNodeContents(node); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }

  /** Alle aktuell gefilterten Maßnahmen als entbehrlich markieren (mit Begründung). */
  function bulkNa() {
    var a = currentAsset(); if (!a) return;
    var f = ui.cl, q = f.q.toLowerCase();
    var items = applicableItems(a).filter(function (it) {
      var c = getCheck(a, it);
      return (!f.lib || it.lib === f.lib) && (!f.topic || it.topic === f.topic) && (!f.level || it.level === f.level) && (!f.status || (c.status || 'open') === f.status) &&
        (!q || (it.ref + ' ' + tx(it.title) + ' ' + tx(it.desc)).toLowerCase().indexOf(q) >= 0);
    });
    dialog(t('btn.bulkNa'), '<p>' + esc(t('cl.bulkPrompt', { n: items.length })) + '</p><textarea name="just" required></textarea>', function (form) {
      var j = form.querySelector('[name=just]').value.trim();
      if (!j) { form.querySelector('[name=just]').classList.add('invalid'); return false; }
      items.forEach(function (it) { setCheck(a, it, { status: 'na', justification: j }); });
      toast(t('cl.bulkDone', { n: items.length })); render();
    });
  }

  function onChange(e) {
    var el = e.target, act = el.getAttribute('data-act');
    if (runExt(EXT.change, act || el.getAttribute('data-field'), el, e)) return;
    var a = currentAsset();
    if (act === 'setStatus') {
      var it = findItemByKey(el.getAttribute('data-key'));
      var patch = { status: el.value };
      if (el.value === 'done' && !getCheck(a, it).verBy && state.meta.auditor) patch.verBy = state.meta.auditor;
      setCheck(a, it, patch);
      if (el.value === 'na' || el.value === 'notdone') ui.openItems[el.getAttribute('data-key')] = true;
      render();
      if (el.value === 'na' || el.value === 'notdone') { var ta = document.getElementById('j-' + el.getAttribute('data-key')); if (ta) ta.focus(); }
      return;
    }
    if (act === 'setVer') {
      var it2 = findItemByKey(el.getAttribute('data-key')); var p = {}; p[el.getAttribute('data-field')] = el.value;
      if (el.getAttribute('data-field') === 'verResult' && el.value && !getCheck(a, it2).verDate) p.verDate = new Date().toISOString().slice(0, 10);
      if (el.getAttribute('data-field') === 'verResult' && el.value && !getCheck(a, it2).verBy) p.verBy = state.meta.auditor || '';
      setCheck(a, it2, p); render(); return;
    }
    if (act === 'riskPI') {
      var fr = findFindingG(el.getAttribute('data-fid')); if (!fr) return;
      var sg = HA.Risk.suggest(fr.asset, fr.scan, fr.f);
      fr.f.risk = fr.f.risk || {};
      if (!fr.f.risk.rated) { fr.f.risk.p = fr.f.risk.p || sg.p; fr.f.risk.i = fr.f.risk.i || sg.i; }
      fr.f.risk[el.getAttribute('data-k')] = parseInt(el.value, 10); fr.f.risk.rated = true;
      scheduleSave(); render(); return;
    }
    if (act === 'riskTreat') {
      var ft = findFindingG(el.getAttribute('data-fid')); if (!ft) return;
      ft.f.risk = ft.f.risk || {}; ft.f.risk.treatment = el.value;
      // „akzeptieren“ entspricht dem Befund-Status „Risiko akzeptiert“
      if (el.value === 'accept' && (ft.f.status || 'open') === 'open') { ft.f.status = 'accepted'; ft.f.statusDate = new Date().toISOString(); }
      scheduleSave(); render(); return;
    }
    if (act === 'riskStatus') {
      var fs2 = findFindingG(el.getAttribute('data-fid')); if (!fs2) return;
      fs2.f.status = el.value; fs2.f.statusDate = new Date().toISOString();
      scheduleSave(); render(); return;
    }
    if (act === 'riskFilter') { var rk = el.getAttribute('data-k'); ui.risk[rk] = el.type === 'checkbox' ? el.checked : el.value; render(); return; }
    if (act === 'rmFilter') { var mk = el.getAttribute('data-k'); ui.rm[mk] = el.type === 'checkbox' ? el.checked : el.value; render(); return; }
    if (act === 'logoFile') { if (el.files[0]) loadLogo(el.files[0]); el.value = ''; return; }
    if (act === 'brandCheck') { state.meta.brand[el.getAttribute('data-k')] = el.checked; scheduleSave(); applyBranding(); return; }
    if (el.getAttribute('data-field') === 'brand') {   // Vorschau nach Verlassen des Feldes aktualisieren, Fokus beibehalten
      setTimeout(function () {
        var ae = document.activeElement, k = ae && ae.getAttribute('data-k'), f = ae && ae.getAttribute('data-field');
        render();
        if (k) { var x = document.querySelector('[data-field="' + f + '"][data-k="' + k + '"]'); if (x) x.focus(); }
      }, 0);
      return;
    }
    if (act === 'chField') {
      var ch = state.projectChances.find(function (x) { return x.id === el.getAttribute('data-id'); }); if (!ch) return;
      var ck = el.getAttribute('data-k'); ch[ck] = /^(p|i)$/.test(ck) ? parseInt(el.value, 10) : el.value;
      scheduleSave(); render(); return;
    }
    if (act === 'pmField') {
      var pr = state.projectRisks.find(function (x) { return x.id === el.getAttribute('data-id'); }); if (!pr) return;
      var pk = el.getAttribute('data-k'); pr[pk] = /^(p|i|rp|ri)$/.test(pk) ? (el.value ? parseInt(el.value, 10) : '') : el.value;
      scheduleSave(); render(); return;
    }
    if (act === 'filter') { ui.cl[el.getAttribute('data-f')] = el.value; render(); return; }
    if (act === 'clAsset' || act === 'scAsset') { ui.assetId = el.value; render(); return; }
    if (act === 'libOs') { ui.libOs = el.value; render(); return; }
    if (act === 'scanSev') { ui.scanSev = el.value; render(); return; }
    if (act === 'scanOnlyOpen') { ui.scanOnlyOpen = el.checked; render(); return; }
    if (act === 'impType') { ui.importType = el.value; return; }
    if (act === 'impTarget') { ui.importTarget = el.value; return; }
    if (act === 'setFinding') {
      var ff = findFinding(el.getAttribute('data-fid'));
      ff.f.status = el.value; ff.f.statusDate = new Date().toISOString(); scheduleSave(); render(); return;
    }
    if (act === 'repOpt') { var k = el.getAttribute('data-k'); ui.report[k] = el.type === 'checkbox' ? el.checked : el.value; showReport(); return; }
    if (act === 'setMeta') {
      state.meta[el.getAttribute('data-k')] = el.value; scheduleSave();
      if (el.getAttribute('data-k') === 'lang') applyLang();
      if (el.getAttribute('data-k') === 'theme') applyTheme();
      render(); return;
    }
    if (el.getAttribute('data-field') && el.type === 'date') onInput(e);
  }

  /** Texteingaben: Zustand aktualisieren, ohne neu zu rendern (Fokus bleibt). */
  function onInput(e) {
    var el = e.target, field = el.getAttribute('data-field'), act = el.getAttribute('data-act');
    if (runExt(EXT.input, act || field, el, e)) return;
    if (act === 'fQ') { ui.cl.q = el.value; clearTimeout(onInput._t); onInput._t = setTimeout(function () { render(); var s = document.getElementById('fQ'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }, 350); return; }
    if (act === 'browseQ') { ui.libBrowseQ = el.value; clearTimeout(onInput._b); onInput._b = setTimeout(function () { render(); var s = document.querySelector('[data-act=browseQ]'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }, 350); return; }
    if (act === 'riskQ') { ui.risk.q = el.value; clearTimeout(onInput._r); onInput._r = setTimeout(function () { render(); var s = document.querySelector('[data-act=riskQ]'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }, 350); return; }
    if (field === 'riskText') {
      var fr = findFindingG(el.getAttribute('data-fid')); if (!fr) return;
      fr.f.risk = fr.f.risk || {}; fr.f.risk[el.getAttribute('data-k')] = el.value; scheduleSave(); return;
    }
    if (field === 'pmText') {
      var pr = state.projectRisks.find(function (x) { return x.id === el.getAttribute('data-id'); }); if (pr) { pr[el.getAttribute('data-k')] = el.value; scheduleSave(); } return;
    }
    if (field === 'chText') {
      var ch = state.projectChances.find(function (x) { return x.id === el.getAttribute('data-id'); }); if (ch) { ch[el.getAttribute('data-k')] = el.value; scheduleSave(); } return;
    }
    if (field === 'brand') { state.meta.brand[el.getAttribute('data-k')] = el.value; scheduleSave(); applyBranding(); return; }
    if (field === 'swotText') { state.swot[el.getAttribute('data-k')] = el.value; scheduleSave(); return; }
    if (field === 'rmText') { roadmapWrite(JSON.parse(el.getAttribute('data-set')), el.getAttribute('data-k'), el.value); return; }
    if (!field) return;
    var a = currentAsset();
    if (field === 'sbNote') {
      var sa = state.assets.find(function (x) { return x.id === el.getAttribute('data-id'); });
      sa.sb[el.getAttribute('data-k') + 'Note'] = el.value; el.classList.toggle('invalid', !el.value.trim()); scheduleSave(); return;
    }
    if (field === 'meta') { state.meta[el.getAttribute('data-k')] = el.type === 'number' ? (parseInt(el.value, 10) || 90) : el.value; scheduleSave(); applyBranding(); return; }
    if (field === 'findingNote') { var ff = findFinding(el.getAttribute('data-fid')); if (ff) { ff.f.note = el.value; el.classList.remove('invalid'); scheduleSave(); } return; }
    var key = el.getAttribute('data-key'); var it = findItemByKey(key); if (!it || !a) return;
    var p = {}; p[field] = el.value; setCheck(a, it, p);
    if (field === 'justification') {
      var st = getCheck(a, it).status;
      el.classList.toggle('invalid', (st === 'na' || st === 'notdone') && !el.value.trim());
    }
  }

  function onToggle(e) {
    var d = e.target; if (!d.matches || !d.matches('details[data-act=toggleItem]')) return;
    ui.openItems[d.getAttribute('data-key')] = d.open;
  }

  function bindGlobal() {
    var view = document.getElementById('view');
    view.addEventListener('click', onClick);
    view.addEventListener('change', onChange);
    view.addEventListener('input', onInput);
    view.addEventListener('toggle', onToggle, true);
    view.addEventListener('keydown', function (e) {
      if (e.target.id === 'drop' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); document.getElementById('fileImport').click(); }
      if (e.target.getAttribute('data-act') === 'riskCell' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.target.click(); }
    });
    // Drag & Drop (Import-Ansicht, aber auch global erlaubt)
    ['dragover', 'dragenter'].forEach(function (ev) { document.addEventListener(ev, function (e) { e.preventDefault(); var d = document.getElementById('drop'); if (d) d.classList.add('drag'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { document.addEventListener(ev, function (e) { var d = document.getElementById('drop'); if (d) d.classList.remove('drag'); }); });
    document.addEventListener('drop', function (e) {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files.length) { if (ui.view !== 'import') go('import'); handleFiles(e.dataTransfer.files); }
    });
    document.getElementById('fileImport').addEventListener('change', function (e) { handleFiles(e.target.files); e.target.value = ''; });
    document.getElementById('fileState').addEventListener('change', function (e) {
      var f = e.target.files[0]; e.target.value = ''; if (!f) return;
      f.text().then(function (txt) {
        var obj = JSON.parse(txt);
        if (!obj || obj.app !== 'hardening-audit') throw new Error(t('msg.invalidState'));
        confirmDlg(t('msg.confirmLoad'), function () { state = normalize(obj); invalidate(); applyLang(); applyTheme(); scheduleSave(); render(); toast(t('imp.stateLoaded')); });
      }).catch(function (err) { toast(t('msg.invalidState') + ' ' + (err.message || ''), true); });
    });
    document.getElementById('btnExport').addEventListener('click', exportState);
    document.getElementById('btnLoad').addEventListener('click', function () { document.getElementById('fileState').click(); });
    document.getElementById('btnLang').addEventListener('click', function () { state.meta.lang = HA.lang === 'de' ? 'en' : 'de'; applyLang(); scheduleSave(); render(); });
    document.getElementById('btnTheme').addEventListener('click', function () {
      var order = ['auto', 'light', 'dark']; state.meta.theme = order[(order.indexOf(state.meta.theme || 'auto') + 1) % 3]; applyTheme(); scheduleSave();
    });
    document.getElementById('menuBtn').addEventListener('click', function () {
      var sb = document.getElementById('sidebar'); var open = !sb.classList.contains('open'); sb.classList.toggle('open', open); this.setAttribute('aria-expanded', String(open));
    });
    document.getElementById('sidebar').addEventListener('click', function (e) { var a = e.target.closest('a[data-view]'); if (a) { e.preventDefault(); go(a.getAttribute('data-view')); } });
    window.addEventListener('hashchange', function () { var v = location.hash.slice(1); if (V[v] && v !== ui.view) { ui.view = v; render(); } });
    // Strg+S = Zwischenstand als Datei speichern
    document.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); exportState(); } });
  }

  function start() {
    HA.Storage.init().then(function (saved) {
      state = normalize(saved);
      applyLang(); applyTheme();
      var v = location.hash.slice(1); ui.view = V[v] ? v : 'dashboard';
      bindGlobal(); render();
      setSaveState(t('store.' + HA.Storage.mode()));
    });
  }

  // Öffentliche Hilfsfunktionen (u. a. für report.js)
  return {
    start: start, applicableItems: applicableItems, checkCmd: checkCmd, getCheck: getCheck, getLib: getLib, assetStats: assetStats,
    overallProtection: overallProtection, openFindings: openFindings, vulnOverall: vulnOverall,
    _state: function () { return state; }, _ui: ui, _import: applyImport, _takeXccdf: takeXccdf,
    // Erweiterungs-API für Module (js/modules/*.js)
    ext: EXT, views: V, state: function () { return state; }, ui: ui, render: render, go: go, save: scheduleSave, uid: uid,
    esc: esc, fmtDate: fmtDate, toast: toast, dialog: dialog, confirm: confirmDlg, opt: opt, decoratePersons: decoratePersons,
    findingRows: function (o) { return HA.Risk.findingRows(state, o || {}); }, roadmap: function (o) { return HA.Risk.roadmap(state, o || {}); },
    exportState: exportState, applyBranding: applyBranding, invalidate: invalidate, osFamily: osFamily, itemKey: itemKey, allItems: allItems,
    bausteinOf: bausteinOf, assetKind: assetKind, kindGroups: kindGroups, kindLabel: kindLabel, allowedLevels: allowedLevels, editAsset: editAsset, groupLabel: groupLabel, currentAsset: currentAsset
  };
})();

document.addEventListener('DOMContentLoaded', HA.App.start);

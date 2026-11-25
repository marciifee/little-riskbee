/* =====================================================================
 * modules/kit.js – Gemeinsame Bausteine für die Erweiterungsmodule
 * ---------------------------------------------------------------------
 *  1. Texte (L = Deutsch/Englisch), zusätzliche Übersetzungen
 *  2. Datumsfunktionen (lokales Datum, Monate/Tage addieren, Abstände)
 *  3. Formular-Baukasten: Felder beschreiben → Dialog erzeugen/auslesen
 *  4. Kleine UI-Helfer (Seitenkopf, Kennzahl, Tabs, Badges, Navigation)
 *  5. Ansprechpersonen (Einstellungen) + Auswahlliste <datalist>
 * Alle Module nutzen ausschließlich diese Helfer und HA.App (app.js).
 * ===================================================================== */
window.HA = window.HA || {};

HA.Kit = (function () {
  'use strict';
  var A = HA.App;

  /* ------------------------------------------------------------------
   * 1. Texte
   * ---------------------------------------------------------------- */
  /** Kurzform für zweisprachige Texte direkt im Code. */
  function L(de, en) { return HA.lang === 'en' && en ? en : de; }
  /** Texte, die index.html (data-i18n) oder app.js über HA.t() abrufen. */
  function addI18n(de, en) { Object.assign(HA.I18N.de, de); Object.assign(HA.I18N.en, en); }
  addI18n({
    'nav.register': 'Risikoregister', 'nav.kpi': 'KPI-Dashboard', 'nav.calendar': 'Pflichten & Reviews',
    'nav.g.bcm': 'Business Continuity (BCM)', 'nav.bia': 'Business-Impact-Analyse', 'nav.bcplans': 'BC-Pläne',
    'nav.crisis': 'Krisenstab', 'nav.exercises': 'Übungen',
    'rm.kind.register': 'Risikoregister', 'rm.kind.bcm': 'BCM-Übung', 'rm.kind.duty': 'Pflicht/Review'
  }, {
    'nav.register': 'Risk register', 'nav.kpi': 'KPI dashboard', 'nav.calendar': 'Duties & reviews',
    'nav.g.bcm': 'Business continuity (BCM)', 'nav.bia': 'Business impact analysis', 'nav.bcplans': 'BC plans',
    'nav.crisis': 'Crisis team', 'nav.exercises': 'Exercises',
    'rm.kind.register': 'Risk register', 'rm.kind.bcm': 'BCM exercise', 'rm.kind.duty': 'Duty/review'
  });

  /* ------------------------------------------------------------------
   * 2. Datum (immer lokales Kalenderdatum im Format JJJJ-MM-TT)
   * ---------------------------------------------------------------- */
  function pad(n) { return ('0' + n).slice(-2); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return ymd(new Date()); }
  function parse(s) { if (!s) return null; var p = String(s).slice(0, 10).split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]); return isNaN(d) ? null : d; }
  function addDays(s, n) { var d = parse(s); if (!d) return ''; d.setDate(d.getDate() + n); return ymd(d); }
  /** Monate addieren; Monatsende wird abgefangen (31.01. + 1 Monat = 28./29.02.). */
  function addMonths(s, n) {
    var d = parse(s); if (!d) return '';
    var day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n);
    var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last)); return ymd(d);
  }
  /** Tage von a bis b (positiv = b liegt nach a). */
  function diffDays(a, b) { var x = parse(a), y = parse(b); if (!x || !y) return null; return Math.round((y - x) / 86400000); }
  function fmt(s) { return s ? A.fmtDate(s) : '–'; }
  /** Stunden lesbar: 4 h, 2 T, 1,5 Wo. */
  function hours(h) {
    if (h === '' || h === null || h === undefined || isNaN(h)) return '–';
    h = +h;
    if (h < 24) return (Math.round(h * 10) / 10).toLocaleString(HA.lang === 'de' ? 'de-DE' : 'en-GB') + ' h';
    if (h < 168 || h % 168) return (Math.round(h / 24 * 10) / 10).toLocaleString(HA.lang === 'de' ? 'de-DE' : 'en-GB') + ' ' + L('T', 'd');
    return (h / 168) + ' ' + L('Wo', 'wk');
  }
  function money(v) {
    if (v === '' || v === null || v === undefined || isNaN(v)) return '–';
    return Math.round(+v).toLocaleString(HA.lang === 'de' ? 'de-DE' : 'en-GB') + ' €';
  }
  function num(v, d) { return (+v).toLocaleString(HA.lang === 'de' ? 'de-DE' : 'en-GB', { maximumFractionDigits: d === undefined ? 1 : d }); }

  /* ------------------------------------------------------------------
   * 3. Formular-Baukasten
   * Feldbeschreibung: { k, l:[de,en], type:'text'|'textarea'|'number'|'date'|
   *   'select'|'person'|'check'|'multi'|'color'|'html', opts:[[wert, text]],
   *   ph, req, help, full (ganze Breite), min, max, step, rows }
   * ---------------------------------------------------------------- */
  function lab(x) { return Array.isArray(x) ? L(x[0], x[1]) : (x || ''); }
  function formHtml(fields, obj) {
    var esc = A.esc;
    return '<div class="grid grid-2 kit-form">' + fields.map(function (f) {
      if (f.type === 'html') return '<div class="field" style="grid-column:1/-1">' + f.html + '</div>';
      var v = obj[f.k]; if (v === undefined || v === null) v = f.def !== undefined ? f.def : '';
      var name = ' name="' + esc(f.k) + '"', req = f.req ? ' required' : '', ph = f.ph ? ' placeholder="' + esc(lab(f.ph)) + '"' : '';
      var input;
      switch (f.type) {
        case 'textarea': input = '<textarea' + name + ' rows="' + (f.rows || 3) + '"' + ph + req + '>' + esc(v) + '</textarea>'; break;
        case 'select': input = '<select' + name + '>' + (f.opts || []).map(function (o) { return A.opt(o[0], lab(o[1]), v); }).join('') + '</select>'; break;
        case 'multi': input = '<div class="checks kit-multi">' + ((f.opts || []).length ? f.opts.map(function (o) {
          return '<label><input type="checkbox"' + name + ' value="' + esc(o[0]) + '"' + ((v || []).indexOf(o[0]) >= 0 ? ' checked' : '') + '> ' + esc(lab(o[1])) + '</label>'; }).join('') : '<span class="muted small">–</span>') + '</div>'; break;
        case 'check': input = '<label style="font-weight:400"><input type="checkbox"' + name + (v ? ' checked' : '') + '> ' + esc(lab(f.cl || f.l)) + '</label>'; break;
        case 'number': input = '<input type="number"' + name + ' value="' + esc(v) + '"' + (f.min !== undefined ? ' min="' + f.min + '"' : '') + (f.max !== undefined ? ' max="' + f.max + '"' : '') + ' step="' + (f.step || 'any') + '"' + ph + req + '>'; break;
        case 'date': input = '<input type="date"' + name + ' value="' + esc(v) + '"' + req + '>'; break;
        case 'person': input = '<input type="text"' + name + ' value="' + esc(v) + '" list="dl-contacts" autocomplete="off" data-person="1"' + ph + req + '>'; break;
        default: input = '<input type="text"' + name + ' value="' + esc(v) + '"' + ph + req + (f.list ? ' list="' + esc(f.list) + '"' : '') + '>';
      }
      return '<div class="field"' + (f.full ? ' style="grid-column:1/-1"' : '') + '>' + (f.type === 'check' ? '' : '<label>' + esc(lab(f.l)) + (f.req ? ' *' : '') + '</label>') + input +
        (f.help ? '<div class="small muted">' + esc(lab(f.help)) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  }
  /** Werte aus dem Formular in obj schreiben. Rückgabe false = Pflichtfeld fehlt. */
  function formRead(form, fields, obj) {
    var ok = true;
    fields.forEach(function (f) {
      if (f.type === 'html') return;
      if (f.type === 'multi') { obj[f.k] = Array.prototype.map.call(form.querySelectorAll('[name="' + f.k + '"]:checked'), function (x) { return x.value; }); return; }
      var el = form.querySelector('[name="' + f.k + '"]'); if (!el) return;
      if (f.type === 'check') { obj[f.k] = el.checked; return; }
      var v = el.value.trim();
      if (f.type === 'number') v = v === '' ? '' : +v;
      if (f.req && (v === '' || v === null)) { el.classList.add('invalid'); ok = false; }
      obj[f.k] = v;
    });
    return ok;
  }
  /** Dialog mit Feldern; onSave(obj) wird nach erfolgreicher Prüfung aufgerufen. */
  function editDialog(title, fields, obj, onSave, okLabel, extraHtml) {
    var work = JSON.parse(JSON.stringify(obj || {}));
    var form = A.dialog(title, (extraHtml || '') + formHtml(fields, work), function (f) {
      if (!formRead(f, fields, work)) { A.toast(L('Bitte Pflichtfelder ausfüllen.', 'Please fill in the required fields.'), true); return false; }
      Object.assign(obj, work); onSave(obj); A.save(); A.render();
    }, okLabel || HA.t('btn.apply'));
    form.classList.add('dlg-wide');
    return form;
  }
  /** Fortlaufende Kennung, z. B. seq(state.register, 'R') → "RR-001". */
  function seq(holder, key, prefix, width) {
    holder[key] = holder[key] || 1;
    return prefix + ('0000' + (holder[key]++)).slice(-(width || 3));
  }

  /* ------------------------------------------------------------------
   * 4. UI-Helfer
   * ---------------------------------------------------------------- */
  function pageHead(title, sub, buttons) {
    return '<div class="page-head"><div><h1>' + A.esc(title) + '</h1>' + (sub ? '<p>' + A.esc(sub) + '</p>' : '') + '</div>' + (buttons ? '<div class="row">' + buttons + '</div>' : '') + '</div>';
  }
  function btn(act, label, opts) {
    opts = opts || {};
    return '<button type="button" class="btn' + (opts.cls ? ' ' + opts.cls : '') + '" data-act="' + act + '"' + (opts.id !== undefined ? ' data-id="' + A.esc(opts.id) + '"' : '') +
      (opts.k ? ' data-k="' + A.esc(opts.k) + '"' : '') + (opts.title ? ' title="' + A.esc(opts.title) + '" aria-label="' + A.esc(opts.title) + '"' : '') + (opts.disabled ? ' disabled' : '') + '>' + A.esc(label) + '</button>';
  }
  function stat(value, label, color, sub) {
    return '<div class="card stat"' + (color ? ' style="border-top:4px solid ' + color + '"' : '') + '><div class="value">' + value + '</div><div class="label">' + A.esc(label) + (sub ? '<div class="small">' + sub + '</div>' : '') + '</div></div>';
  }
  function tabs(act, items, current) {
    return '<div class="tabs" role="tablist">' + items.map(function (x) {
      return '<button type="button" role="tab" aria-selected="' + (x[0] === current) + '" class="' + (x[0] === current ? 'on' : '') + '" data-act="' + act + '" data-id="' + x[0] + '">' + A.esc(lab(x[1])) + '</button>';
    }).join('') + '</div>';
  }
  function table(head, rows, cls, maxH) {
    return '<div class="table-wrap"' + (maxH ? ' style="max-height:' + maxH + '"' : '') + '><table' + (cls ? ' class="' + cls + '"' : '') + '><thead><tr>' + head.map(function (x) {
      return typeof x === 'string' ? '<th>' + A.esc(x) + '</th>' : '<th' + (x.cls ? ' class="' + x.cls + '"' : '') + (x.w ? ' style="min-width:' + x.w + 'px"' : '') + '>' + A.esc(lab(x.l)) + '</th>';
    }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }
  function pill(text, color, fg) {
    return '<span class="badge" style="background:' + color + ';border-color:' + color + ';color:' + (fg || '#fff') + '">' + A.esc(text) + '</span>';
  }
  /** Ampel: ok / warn / bad / none */
  var AMP = { ok: '#1a7f37', warn: '#d48806', bad: '#c62828', none: '#6b7280' };
  function amp(level, text) { return pill(text, AMP[level] || AMP.none, level === 'warn' ? '#1b2430' : '#fff'); }
  function catBadge(cat) { return HA.Risk.badge(cat, HA.t('risk.cat.' + cat)); }
  /** Zähler-Badge an einem Navigationseintrag setzen (0 = entfernen). */
  function navBadge(view, n, level) {
    var a = document.querySelector('.sidebar a[data-view="' + view + '"]'); if (!a) return;
    var b = a.querySelector('.nav-count');
    if (!n) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('span'); b.className = 'nav-count'; a.appendChild(b); }
    b.textContent = n > 99 ? '99+' : n; b.className = 'nav-count' + (level ? ' ' + level : '');
  }
  function clip(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }
  /** Datei herunterladen (lokal erzeugt, kein Netzwerk). */
  function download(name, text, mime) {
    var b = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ------------------------------------------------------------------
   * 5. Ansprechpersonen
   * state.contacts[] = { id, name, role, org, email, phone, mobile, deputy, notes }
   * ---------------------------------------------------------------- */
  var CONTACT_FIELDS = [
    { k: 'name', l: ['Name', 'Name'], req: true },
    { k: 'role', l: ['Funktion / Rolle', 'Function / role'], ph: ['z. B. ISB, IT-Leitung, Datenschutz', 'e.g. CISO, IT lead, DPO'], list: 'dl-roles' },
    { k: 'org', l: ['Abteilung / Organisation', 'Department / organisation'] },
    { k: 'email', l: ['E-Mail', 'E-mail'] },
    { k: 'phone', l: ['Telefon', 'Phone'] },
    { k: 'mobile', l: ['Mobil / Notfallnummer', 'Mobile / emergency number'] },
    { k: 'deputy', l: ['Vertretung', 'Deputy'], type: 'person' },
    { k: 'notes', l: ['Notizen (Erreichbarkeit …)', 'Notes (availability …)'], type: 'textarea', rows: 2, full: true }
  ];
  var ROLES = ['Geschäftsführung', 'Informationssicherheitsbeauftragte/r (ISB)', 'Datenschutzbeauftragte/r (DSB)', 'BCM-Beauftragte/r', 'IT-Leitung', 'IT-Administration',
    'Risikoeigner/in', 'Prozessverantwortliche/r', 'IT-Notfallmanager/in', 'Leitung Krisenstab', 'Presse / Kommunikation', 'Externer Dienstleister', 'Auditor/in'];
  function contacts() { var s = A.state(); return (s && s.contacts) || []; }
  function contactByName(n) { n = String(n || '').trim().toLowerCase(); return contacts().find(function (c) { return c.name.toLowerCase() === n; }); }
  /** <datalist> mit allen Personen aktualisieren (wird global in index.html bereitgestellt). */
  function refreshDatalist() {
    var dl = document.getElementById('dl-contacts'); if (!dl) return;
    var s = A.state(), names = {};
    var opts = contacts().map(function (c) { names[c.name] = 1; return '<option value="' + A.esc(c.name) + '">' + A.esc([c.role, c.org].filter(Boolean).join(' · ')) + '</option>'; });
    if (s && s.meta.auditor && !names[s.meta.auditor]) opts.push('<option value="' + A.esc(s.meta.auditor) + '">' + A.esc(L('Auditor/in (Einstellungen)', 'Auditor (settings)')) + '</option>');
    dl.innerHTML = opts.join('');
    var dr = document.getElementById('dl-roles');
    if (dr) dr.innerHTML = ROLES.map(function (r) { return '<option value="' + A.esc(r) + '">'; }).join('');
  }
  /** Alle in den Daten verwendeten Personennamen sammeln (für „aus Daten übernehmen“). */
  function usedNames() {
    var s = A.state(), set = {};
    function add(v) { v = String(v || '').trim(); if (v && v.length < 80) set[v] = 1; }
    add(s.meta.auditor);
    s.assets.forEach(function (a) {
      add(a.owner);
      Object.keys(a.checks || {}).forEach(function (k) { add(a.checks[k].responsible); add(a.checks[k].verBy); });
      (a.scans || []).forEach(function (sc) { (sc.findings || []).forEach(function (f) { if (f.risk) add(f.risk.owner); }); });
    });
    (s.projectRisks || []).forEach(function (r) { add(r.owner); });
    (s.projectChances || []).forEach(function (r) { add(r.owner); });
    ((s.register || {}).items || []).forEach(function (r) { add(r.owner); });
    (s.duties || []).forEach(function (d) { add(d.owner); });
    var b = s.bcm || {};
    (b.processes || []).forEach(function (p) { add(p.owner); });
    (b.plans || []).forEach(function (p) { add(p.owner); add(p.deputy); });
    ((b.crisis || {}).roles || []).forEach(function (r) { add(r.person); add(r.deputy); });
    var known = {}; contacts().forEach(function (c) { known[c.name.toLowerCase()] = 1; });
    return Object.keys(set).filter(function (n) { return !known[n.toLowerCase()]; }).sort();
  }
  function editContact(c) {
    var isNew = !c, s = A.state();
    editDialog(isNew ? L('Ansprechperson anlegen', 'Add contact') : L('Ansprechperson bearbeiten', 'Edit contact'), CONTACT_FIELDS, c || {}, function (obj) {
      if (isNew) { obj.id = A.uid('c'); s.contacts.push(obj); }
      refreshDatalist();
    });
  }
  function contactsCard() {
    var esc = A.esc, list = contacts();
    var rows = list.map(function (c) {
      return '<tr><td><b>' + esc(c.name) + '</b>' + (c.deputy ? '<div class="small muted">' + esc(L('Vertretung', 'Deputy')) + ': ' + esc(c.deputy) + '</div>' : '') + '</td><td>' + esc(c.role || '–') + '<div class="small muted">' + esc(c.org || '') + '</div></td>' +
        '<td class="small">' + [c.email, c.phone, c.mobile ? '📱 ' + c.mobile : ''].filter(Boolean).map(esc).join('<br>') + '</td>' +
        '<td class="nowrap">' + btn('contactEdit', '✏️', { id: c.id, cls: 'btn-sm', title: HA.t('btn.edit') }) + ' ' + btn('contactDel', '🗑', { id: c.id, cls: 'btn-sm btn-danger', title: HA.t('btn.delete') }) + '</td></tr>';
    });
    var unused = usedNames().length;
    return '<div class="card" id="contacts"><h2>👥 ' + esc(L('Ansprechpersonen / Zuständige', 'Contacts / responsible persons')) + '</h2>' +
      '<p class="small muted">' + esc(L('Personen hier einmal anlegen – in allen Feldern für Verantwortliche, Risikoeigner, Krisenstab usw. erscheinen sie dann als Auswahlliste. Freie Eingabe bleibt jederzeit möglich.',
        'Add people once – they then appear as a drop-down in every field for owners, risk owners, crisis team etc. Free text remains possible.')) + '</p>' +
      (list.length ? table([L('Name', 'Name'), L('Funktion', 'Function'), L('Kontakt', 'Contact'), ''], rows) : '<p class="muted">' + esc(L('Noch keine Personen angelegt.', 'No contacts yet.')) + '</p>') +
      '<div class="row" style="margin-top:.6rem">' + btn('contactAdd', '+ ' + L('Person', 'Person'), { cls: 'btn-primary' }) +
      (unused ? btn('contactHarvest', L('Namen aus Daten übernehmen', 'Take over names from data') + ' (' + unused + ')') : '') + '</div></div>';
  }
  function harvest() {
    var names = usedNames(), s = A.state();
    if (!names.length) return;
    A.dialog(L('Namen übernehmen', 'Take over names'), '<p class="small">' + A.esc(L('Diese Namen werden bereits in Feldern verwendet, sind aber noch keine Ansprechpersonen:', 'These names are used in fields but are not contacts yet:')) + '</p><div class="checks">' +
      names.map(function (n) { return '<label><input type="checkbox" name="n" value="' + A.esc(n) + '" checked> ' + A.esc(n) + '</label>'; }).join('') + '</div>', function (f) {
      Array.prototype.forEach.call(f.querySelectorAll('[name=n]:checked'), function (x) { s.contacts.push({ id: A.uid('c'), name: x.value, role: '', org: '', email: '', phone: '', mobile: '', deputy: '', notes: '' }); });
      refreshDatalist(); A.save(); A.render();
    });
  }

  // Registrierung
  A.ext.normalize.push(function (s) { if (!Array.isArray(s.contacts)) s.contacts = []; });
  A.ext.settingsCards.push(contactsCard);
  A.ext.afterRender.push(function () { refreshDatalist(); });
  A.ext.click.push(function (act, el) {
    var s = A.state(), id = el.getAttribute('data-id');
    if (act === 'contactAdd') { editContact(null); return true; }
    if (act === 'contactEdit') { editContact(s.contacts.find(function (c) { return c.id === id; })); return true; }
    if (act === 'contactDel') {
      var c = s.contacts.find(function (x) { return x.id === id; });
      A.confirm(L('Ansprechperson „' + c.name + '“ löschen? Eingetragene Namen in anderen Feldern bleiben erhalten.', 'Delete contact "' + c.name + '"? Names already entered elsewhere are kept.'), function () {
        s.contacts = s.contacts.filter(function (x) { return x.id !== id; }); refreshDatalist(); A.save(); A.render(); });
      return true;
    }
    if (act === 'contactHarvest') { harvest(); return true; }
    if (act === 'kitGo') { A.go(el.getAttribute('data-id')); return true; }
  });

  return {
    L: L, addI18n: addI18n, today: today, parse: parse, ymd: ymd, addDays: addDays, addMonths: addMonths, diffDays: diffDays, fmt: fmt, hours: hours, money: money, num: num,
    formHtml: formHtml, formRead: formRead, editDialog: editDialog, seq: seq, lab: lab,
    pageHead: pageHead, btn: btn, stat: stat, tabs: tabs, table: table, pill: pill, amp: amp, AMP: AMP, catBadge: catBadge, navBadge: navBadge, clip: clip, download: download,
    contacts: contacts, contactByName: contactByName, refreshDatalist: refreshDatalist, usedNames: usedNames
  };
})();

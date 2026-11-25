/* =====================================================================
 * modules/fishbone.js – Fischgrätendiagramm (Ishikawa) für Brainstorming
 *                       und Ursachenanalyse (Root Cause Analysis)
 * ---------------------------------------------------------------------
 * – Kopf = Wirkung/Problem, Gräten = Ursachenkategorien (6M, 8M, IT, 4S
 *   oder frei definierbar, 2–8 Kategorien)
 * – Notizen (Haftzettel) anlegen, per Maus/Touch verschieben; beim
 *   Loslassen wird die Notiz der nächstgelegenen Gräte zugeordnet
 * – Doppelklick auf freie Fläche = neue Notiz an dieser Stelle
 * – je Notiz: Farbe, Hauptursache (⭐), Punkte-Bewertung (Dot-Voting),
 *   5-Why-Kette und Gegenmaßnahme
 * – Übernahme ins Risikoregister, Export SVG/JSON, Druck/PDF
 * Datenmodell: state.fishbones = { seq, items:[{ id, name, effect, date,
 *   owner, cats:[{ id, label, color }], notes:[{ id, cat, x, y, text,
 *   color, root, votes, why:[], measure }], conclusion, registerId }] }
 * Koordinaten der Notizen im festen viewBox-System (1200 × 660).
 * ===================================================================== */
window.HA = window.HA || {};

HA.Fishbone = (function () {
  'use strict';
  var A = HA.App, K = HA.Kit, L = K.L, esc = A.esc;
  var U = { id: null, sel: null, drag: null };
  var VW = 1200, VH = 660, SY = 330, X0 = 30, XH = 950, NW = 172, NH = 62;
  var NOTE_COLORS = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#ddd6fe', '#e5e7eb'];
  var CAT_COLORS = ['#1f6feb', '#0f766e', '#7c3aed', '#c2410c', '#be185d', '#15803d', '#b45309', '#475569'];
  K.addI18n({ 'nav.fishbone': 'Ursachenanalyse' }, { 'nav.fishbone': 'Root cause analysis' });
  function S() { return A.state(); }
  function F() { return S().fishbones; }
  function cur() { return F().items.find(function (x) { return x.id === U.id; }) || F().items[0] || null; }
  function nid(p) { return (p || 'n') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  A.ext.normalize.push(function (s) {
    s.fishbones = s.fishbones || {}; if (!Array.isArray(s.fishbones.items)) s.fishbones.items = []; s.fishbones.seq = s.fishbones.seq || (s.fishbones.items.length + 1);
    s.fishbones.items.forEach(function (fb) {
      if (!Array.isArray(fb.cats) || !fb.cats.length) fb.cats = cats('it');
      if (!Array.isArray(fb.notes)) fb.notes = [];
      fb.notes.forEach(function (n) { n.votes = +n.votes || 0; if (!Array.isArray(n.why)) n.why = []; if (!fb.cats.some(function (c) { return c.id === n.cat; })) n.cat = fb.cats[0].id; });
    });
  });

  /* ------------------------------------------------------------------
   * Kategorien-Sets und Vorlagen
   * ---------------------------------------------------------------- */
  var SETS = {
    '6m': [['Mensch', 'People'], ['Maschine / Technik', 'Machine / technology'], ['Methode / Prozess', 'Method / process'], ['Material / Daten', 'Material / data'], ['Mitwelt / Umgebung', 'Environment'], ['Messung / Überwachung', 'Measurement / monitoring']],
    '8m': [['Mensch', 'People'], ['Maschine / Technik', 'Machine / technology'], ['Methode / Prozess', 'Method / process'], ['Material / Daten', 'Material / data'], ['Mitwelt / Umgebung', 'Environment'], ['Messung / Überwachung', 'Measurement / monitoring'], ['Management', 'Management'], ['Money / Budget', 'Money / budget']],
    'it': [['Mensch', 'People'], ['Technik / Systeme', 'Technology / systems'], ['Prozesse', 'Processes'], ['Daten / Informationen', 'Data / information'], ['Organisation / Management', 'Organisation / management'], ['Dienstleister / Lieferkette', 'Providers / supply chain'], ['Umgebung / Infrastruktur', 'Environment / infrastructure']],
    '4s': [['Umgebung (Surroundings)', 'Surroundings'], ['Lieferanten (Suppliers)', 'Suppliers'], ['Systeme (Systems)', 'Systems'], ['Fähigkeiten (Skills)', 'Skills']]
  };
  var SET_NAMES = { '6m': ['6M (klassisch)', '6M (classic)'], '8m': ['8M (inkl. Management & Budget)', '8M (incl. management & budget)'], 'it': ['IT-Sicherheit (7 Kategorien)', 'IT security (7 categories)'], '4s': ['4S (Dienstleistung)', '4S (services)'] };
  function cats(set) { return (SETS[set] || SETS.it).map(function (c, i) { return { id: 'c' + (i + 1), label: L(c[0], c[1]), color: CAT_COLORS[i % CAT_COLORS.length] }; }); }

  function examples() {
    return [
      { key: 'ransom', set: 'it', name: L('Ransomware-Vorfall Dateiserver', 'Ransomware incident file server'), effect: L('Dateiserver verschlüsselt – Wiederherstellung dauerte 4 Tage', 'File server encrypted – recovery took 4 days'),
        notes: [[0, L('Phishing-Mail geöffnet, Makro aktiviert', 'Phishing mail opened, macro enabled'), 3, 1], [0, L('Keine Awareness-Schulung seit 2 Jahren', 'No awareness training for 2 years'), 2],
          [1, L('Makros nicht per GPO blockiert', 'Macros not blocked by GPO'), 2], [1, L('Lokale Admin-Passwörter identisch (kein LAPS)', 'Identical local admin passwords (no LAPS)'), 4, 1], [1, L('EDR nur auf Clients', 'EDR on clients only'), 1],
          [2, L('Restore nie getestet', 'Restore never tested'), 3, 1], [2, L('Kein Notfallhandbuch für Ransomware', 'No ransomware playbook'), 1],
          [3, L('Backups im selben AD, mitverschlüsselt', 'Backups in same AD, encrypted too'), 4, 1], [4, L('Kein Budget für Offline-Backup', 'No budget for offline backup'), 1],
          [5, L('Dienstleister nicht 24/7 erreichbar', 'Provider not reachable 24/7'), 1], [6, L('Flaches Netz ohne Segmentierung', 'Flat network without segmentation'), 2]],
        conclusion: L('Hauptursachen: fehlende Offline-Backups und identische Admin-Passwörter ermöglichten Ausbreitung und verhinderten schnellen Restore.', 'Root causes: missing offline backups and identical admin passwords enabled spreading and prevented a fast restore.') },
      { key: 'patch', set: '6m', name: L('Patch-Rückstand > 30 Tage', 'Patch backlog > 30 days'), effect: L('Kritische Patches werden im Schnitt erst nach 45 Tagen eingespielt', 'Critical patches applied only after 45 days on average'),
        notes: [[0, L('Nur eine Person kennt den Patch-Prozess', 'Only one person knows the patch process'), 3, 1], [1, L('Kein zentrales Patch-Werkzeug für Linux', 'No central patch tool for Linux'), 2],
          [2, L('Wartungsfenster nur 1× pro Quartal', 'Maintenance window only once per quarter'), 4, 1], [2, L('Keine Test-/Staging-Umgebung', 'No test/staging environment'), 2],
          [3, L('Asset-Inventar unvollständig', 'Asset inventory incomplete'), 2], [5, L('Kein KPI „Patch-Latenz“ gemessen', 'No KPI "patch latency" measured'), 1]],
        conclusion: '' }
    ];
  }

  /* ------------------------------------------------------------------
   * Geometrie: Gräten abwechselnd oben/unten, vom Kopf nach links
   * ---------------------------------------------------------------- */
  function bones(fb) {
    var n = fb.cats.length, cols = Math.ceil(n / 2), step = (XH - X0 - 120) / Math.max(1, cols);
    return fb.cats.map(function (c, i) {
      var top = i % 2 === 0, col = Math.floor(i / 2), ax = XH - 70 - col * step;
      return { cat: c, top: top, x1: ax, y1: SY, x2: ax - 150, y2: top ? 78 : VH - 78 };
    });
  }
  function nearest(px, py, b) {
    var dx = b.x2 - b.x1, dy = b.y2 - b.y1, l2 = dx * dx + dy * dy, t = Math.max(0, Math.min(1, ((px - b.x1) * dx + (py - b.y1) * dy) / l2));
    var x = b.x1 + t * dx, y = b.y1 + t * dy; return { x: x, y: y, d: Math.hypot(px - x, py - y) };
  }
  function boneFor(fb, x, y) { var best = null; bones(fb).forEach(function (b) { var p = nearest(x, y, b); if (!best || p.d < best.p.d) best = { b: b, p: p }; }); return best; }
  /** Freier Platz für eine neue Notiz an einer Gräte. */
  function slot(fb, catId) {
    var b = bones(fb).find(function (x) { return x.cat.id === catId; }) || bones(fb)[0], cand = [];
    // Kandidaten: entlang der Gräte rechts daneben, weitere Spalten nach links versetzt
    [0, 1, 2].forEach(function (col) { [0.7, 0.43, 0.16].forEach(function (t) {
      var x = b.x1 + (b.x2 - b.x1) * t, y = b.y1 + (b.y2 - b.y1) * t;
      cand.push({ x: clampX(x + NW / 2 + 8 - col * (NW + 10)), y: clampY(y) });
    }); });
    // nicht über dem Kopf (Wirkung) platzieren
    cand = cand.filter(function (c) { return !(c.x + NW / 2 > XH - 6 && Math.abs(c.y - SY) < 80 + NH / 2); });
    var free = cand.find(function (c) { return !fb.notes.some(function (n) { return Math.abs(n.x - c.x) < NW + 4 && Math.abs(n.y - c.y) < NH + 4; }); });
    if (free) return free;
    var k = fb.notes.length; return { x: clampX(cand[0].x + (k % 5) * 14), y: clampY(cand[0].y + (k % 5) * 12) };
  }
  function clampX(x) { return Math.max(NW / 2 + 4, Math.min(VW - NW / 2 - 4, x)); }
  function clampY(y) { return Math.max(NH / 2 + 4, Math.min(VH - NH / 2 - 4, y)); }
  function wrap(text, max, lines) {
    var words = String(text || '').split(/\s+/), out = [], line = '';
    words.forEach(function (w) {
      while (w.length > max) { if (line) { out.push(line); line = ''; } out.push(w.slice(0, max - 1) + '-'); w = w.slice(max - 1); }
      if ((line + ' ' + w).trim().length > max) { out.push(line); line = w; } else line = (line + ' ' + w).trim();
    });
    if (line) out.push(line);
    if (out.length > lines) { out = out.slice(0, lines); out[lines - 1] = out[lines - 1].replace(/.{0,2}$/, '') + '…'; }
    return out;
  }

  /** SVG des Diagramms. opts.plain = ohne Interaktion (Export/Bericht). */
  function svg(fb, opts) {
    opts = opts || {};
    var bs = bones(fb), h = [];
    h.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + VW + ' ' + VH + '" class="fb-svg" id="' + (opts.plain ? 'fbSvgP' : 'fbSvg') + '" font-family="Segoe UI, Roboto, Arial, sans-serif" role="img" aria-label="' + esc(L('Fischgrätendiagramm: ', 'Fishbone diagram: ') + (fb.effect || fb.name)) + '">');
    h.push('<rect width="' + VW + '" height="' + VH + '" fill="#ffffff"/>');
    // Rückgrat + Pfeil
    h.push('<line x1="' + X0 + '" y1="' + SY + '" x2="' + XH + '" y2="' + SY + '" stroke="#1b2430" stroke-width="5" stroke-linecap="round"/><polygon points="' + (XH + 2) + ',' + (SY - 13) + ' ' + (XH + 22) + ',' + SY + ' ' + (XH + 2) + ',' + (SY + 13) + '" fill="#1b2430"/>');
    // Gräten mit Kategorie-Beschriftung
    bs.forEach(function (b) {
      var c = b.cat, lw = Math.min(210, 24 + c.label.length * 7.2), ly = b.top ? b.y2 - 40 : b.y2 + 12;
      h.push('<g class="fb-bone" data-cat="' + esc(c.id) + '"><line x1="' + b.x1 + '" y1="' + b.y1 + '" x2="' + b.x2 + '" y2="' + b.y2 + '" stroke="' + esc(c.color) + '" stroke-width="3.5" stroke-linecap="round"/>' +
        '<rect x="' + (b.x2 - lw / 2) + '" y="' + ly + '" width="' + lw + '" height="28" rx="6" fill="' + esc(c.color) + '"/>' +
        '<text x="' + b.x2 + '" y="' + (ly + 19) + '" text-anchor="middle" font-size="14" font-weight="700" fill="#fff">' + esc(K.clip(c.label, 28)) + '</text></g>');
    });
    // Kopf (Wirkung)
    var eff = wrap(fb.effect || L('Wirkung / Problem eintragen', 'Enter effect / problem'), 24, 6), hh = Math.max(96, eff.length * 19 + 34);
    h.push('<g class="fb-head"' + (opts.plain ? '' : ' data-act="fbHead" style="cursor:pointer"') + '><rect x="' + (XH + 26) + '" y="' + (SY - hh / 2) + '" width="' + (VW - XH - 34) + '" height="' + hh + '" rx="10" fill="#c62828"/>' +
      '<text x="' + (XH + 26 + (VW - XH - 34) / 2) + '" y="' + (SY - hh / 2 + 22) + '" text-anchor="middle" font-size="11" fill="#ffd7d7" font-weight="700" letter-spacing="1">' + esc(L('WIRKUNG / PROBLEM', 'EFFECT / PROBLEM')) + '</text>' +
      eff.map(function (l, i) { return '<text x="' + (XH + 26 + (VW - XH - 34) / 2) + '" y="' + (SY - hh / 2 + 44 + i * 19) + '" text-anchor="middle" font-size="15" font-weight="600" fill="#fff">' + esc(l) + '</text>'; }).join('') + '</g>');
    // Verbindungslinien Notiz → Gräte
    fb.notes.forEach(function (n) {
      var b = bs.find(function (x) { return x.cat.id === n.cat; }); if (!b) return;
      var p = nearest(n.x, n.y, b);
      h.push('<line class="fb-link" data-note="' + esc(n.id) + '" x1="' + n.x + '" y1="' + n.y + '" x2="' + p.x.toFixed(1) + '" y2="' + p.y.toFixed(1) + '" stroke="' + esc(b.cat.color) + '" stroke-width="1.3" stroke-dasharray="4 3" opacity=".75"/>' +
        '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3.2" fill="' + esc(b.cat.color) + '"/>');
    });
    // Notizen
    fb.notes.forEach(function (n) {
      var sel = !opts.plain && U.sel === n.id, lines = wrap(n.text || '…', 22, 3);
      h.push('<g class="fb-note' + (sel ? ' sel' : '') + '" data-note="' + esc(n.id) + '" transform="translate(' + (n.x - NW / 2) + ',' + (n.y - NH / 2) + ')"' + (opts.plain ? '' : ' tabindex="0" role="button" aria-label="' + esc(n.text) + '"') + '>' +
        '<rect width="' + NW + '" height="' + NH + '" rx="5" fill="' + esc(n.color || NOTE_COLORS[0]) + '" stroke="' + (n.root ? '#c62828' : sel ? '#1f6feb' : 'rgba(0,0,0,.18)') + '" stroke-width="' + (n.root || sel ? 3 : 1) + '" filter="' + (opts.plain ? '' : 'url(#fbShadow)') + '"/>' +
        lines.map(function (l, i) { return '<text x="8" y="' + (19 + i * 17) + '" font-size="13.5" fill="#1b2430">' + esc(l) + '</text>'; }).join('') +
        (n.root ? '<text x="' + (NW - 6) + '" y="15" text-anchor="end" font-size="13">⭐</text>' : '') +
        (n.votes ? '<g transform="translate(' + (NW - 4) + ',' + (NH - 4) + ')"><circle r="10" cx="-8" cy="-8" fill="#1b2430"/><text x="-8" y="-4" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">' + n.votes + '</text></g>' : '') + '</g>');
    });
    if (!opts.plain) h.push('<defs><filter id="fbShadow" x="-10%" y="-10%" width="130%" height="140%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.6" flood-opacity=".22"/></filter></defs>');
    h.push('</svg>');
    return h.join('');
  }

  /* ------------------------------------------------------------------
   * Ansicht
   * ---------------------------------------------------------------- */
  function view() {
    var fb = cur(), h = [K.pageHead(L('Ursachenanalyse (Fischgrätendiagramm)', 'Root cause analysis (fishbone diagram)'),
      L('Ishikawa-Diagramm für Brainstorming und Ursachenanalyse: Problem in den Kopf schreiben, Ursachen als Notizen sammeln und per Ziehen den Kategorien (Gräten) zuordnen, bewerten und Hauptursachen mit 5-Why vertiefen.',
        'Ishikawa diagram for brainstorming and root cause analysis: write the problem into the head, collect causes as notes and drag them to categories (bones), vote and drill down root causes with 5-Why.'),
      K.btn('fbImport', '⬆ JSON') + K.btn('fbTpl', '📑 ' + L('Aus Vorlage', 'From template')) + K.btn('fbNew', '+ ' + L('Neues Diagramm', 'New diagram'), { cls: 'btn-primary' }))];
    h.push('<input type="file" id="fbFile" data-act="fbFile" accept=".json" hidden>');
    if (!fb) {
      h.push('<div class="card"><p>' + esc(L('Noch kein Fischgrätendiagramm. Starten Sie mit einer Vorlage (z. B. Ransomware-Vorfall) oder einem leeren Diagramm mit Kategorien nach 6M, 8M, IT-Sicherheit oder 4S.', 'No fishbone diagram yet. Start from a template (e.g. ransomware incident) or an empty diagram with 6M, 8M, IT security or 4S categories.')) + '</p><div class="row">' +
        K.btn('fbTpl', '📑 ' + L('Aus Vorlage', 'From template'), { cls: 'btn-primary' }) + K.btn('fbNew', '+ ' + L('Neues Diagramm', 'New diagram')) + '</div></div>');
      return h.join('');
    }
    if (F().items.length > 1) h.push('<div class="card no-print"><div class="row">' + F().items.map(function (x) {
      return '<button type="button" class="btn btn-sm' + (x === fb ? ' btn-primary' : '') + '" data-act="fbPick" data-id="' + esc(x.id) + '">' + esc(x.id + ' ' + K.clip(x.name, 34)) + '</button>'; }).join('') + '</div></div>');
    var roots = fb.notes.filter(function (n) { return n.root; });
    h.push('<div class="rt-layout fb-layout"><div class="card"><div class="row"><h2 style="margin:0">' + esc(fb.id + ' – ' + fb.name) + '</h2><span class="spacer"></span>' +
      '<select class="gap-sel" data-act="fbAddCat" aria-label="' + esc(L('Kategorie für neue Notiz', 'Category for new note')) + '">' + fb.cats.map(function (c) { return A.opt(c.id, c.label, ''); }).join('') + '</select>' +
      K.btn('fbAdd', '+ ' + L('Notiz', 'Note'), { cls: 'btn-primary', title: L('Neue Notiz an der gewählten Gräte', 'New note on the selected bone') }) + '</div>' +
      '<div class="small muted" style="margin-top:.3rem">' + esc(L('Ziehen = verschieben und Kategorie wechseln · Klick = bearbeiten · Doppelklick auf freie Fläche = Notiz an dieser Stelle · Entf = ausgewählte Notiz löschen', 'Drag = move and change category · click = edit · double-click on empty area = note at this position · Del = delete selected note')) + '</div>' +
      '<div class="fb-canvas" id="fbCanvas">' + svg(fb) + '</div>' +
      '<div class="row" style="margin-top:.6rem">' + K.btn('fbToRegister', '📒 ' + (fb.registerId ? L('Register-Eintrag aktualisieren', 'Update register entry') : L('Ins Risikoregister übernehmen', 'Add to risk register')), { disabled: !fb.effect }) +
      K.btn('fbSvg', '⬇ SVG') + K.btn('fbPrint', '🖨 ' + L('Drucken / PDF', 'Print / PDF')) + K.btn('fbExport', '⬇ JSON') + K.btn('fbDup', '⧉ ' + L('Duplizieren', 'Duplicate')) + K.btn('fbDel', '🗑', { cls: 'btn-danger', title: HA.t('btn.delete') }) + '</div></div>');
    h.push('<div class="card rt-editor" id="fbEditor">' + editorHtml(fb) + '</div></div>');
    h.push(summaryHtml(fb, roots));
    return h.join('');
  }

  function editorHtml(fb) {
    var n = fb.notes.find(function (x) { return x.id === U.sel; });
    if (!n) {
      return '<h3 style="margin-top:0">' + esc(L('Diagramm', 'Diagram')) + '</h3>' +
        '<div class="field"><label>' + esc(L('Titel', 'Title')) + '</label><input type="text" data-field="fbD" data-k="name" value="' + esc(fb.name) + '"></div>' +
        '<div class="field"><label>' + esc(L('Wirkung / Problem (Kopf)', 'Effect / problem (head)')) + '</label><textarea data-field="fbD" data-k="effect" rows="2">' + esc(fb.effect) + '</textarea></div>' +
        '<div class="grid grid-2"><div class="field"><label>' + esc(L('Datum', 'Date')) + '</label><input type="date" data-field="fbD" data-k="date" value="' + esc(fb.date || '') + '"></div>' +
        '<div class="field"><label>' + esc(L('Moderation', 'Facilitator')) + '</label><input type="text" data-field="fbD" data-k="owner" data-person="1" value="' + esc(fb.owner || '') + '"></div></div>' +
        '<div class="field"><label>' + esc(L('Teilnehmende', 'Participants')) + '</label><input type="text" data-field="fbD" data-k="team" value="' + esc(fb.team || '') + '"></div>' +
        '<h3>' + esc(L('Kategorien (Gräten)', 'Categories (bones)')) + '</h3>' + fb.cats.map(function (c, i) {
          return '<div class="fb-catrow"><input type="color" data-act="fbCatColor" data-id="' + esc(c.id) + '" value="' + esc(c.color) + '" aria-label="' + esc(L('Farbe', 'Colour')) + '"><input type="text" data-field="fbCat" data-id="' + esc(c.id) + '" value="' + esc(c.label) + '" aria-label="' + esc(L('Kategorie', 'Category')) + ' ' + (i + 1) + '">' +
            '<span class="small muted">' + fb.notes.filter(function (x) { return x.cat === c.id; }).length + '</span>' + K.btn('fbCatDel', '✕', { id: c.id, cls: 'btn-sm', title: L('Kategorie entfernen', 'Remove category'), disabled: fb.cats.length <= 2 }) + '</div>';
        }).join('') +
        '<div class="row" style="margin-top:.4rem">' + K.btn('fbCatAdd', '+ ' + L('Kategorie', 'Category'), { cls: 'btn-sm', disabled: fb.cats.length >= 8 }) +
        '<select data-act="fbSet" aria-label="' + esc(L('Kategorien-Set', 'Category set')) + '">' + A.opt('', L('Set übernehmen …', 'Apply set …'), '') + Object.keys(SETS).map(function (k) { return A.opt(k, K.lab(SET_NAMES[k]), ''); }).join('') + '</select></div>' +
        '<div class="field" style="margin-top:.6rem"><label>' + esc(L('Ergebnis / Fazit', 'Result / conclusion')) + '</label><textarea data-field="fbD" data-k="conclusion" rows="3">' + esc(fb.conclusion || '') + '</textarea></div>';
    }
    var c = fb.cats.find(function (x) { return x.id === n.cat; });
    return '<div class="row"><h3 style="margin:0">' + esc(L('Notiz', 'Note')) + '</h3><span class="spacer"></span>' + K.btn('fbDesel', '✕ ' + L('schließen', 'close'), { cls: 'btn-sm' }) + '</div>' +
      '<div class="field"><label>' + esc(L('Ursache', 'Cause')) + '</label><textarea id="fbNoteText" data-field="fbN" data-k="text" rows="3">' + esc(n.text) + '</textarea></div>' +
      '<div class="field"><label>' + esc(L('Kategorie', 'Category')) + '</label><select data-act="fbNSel" data-k="cat">' + fb.cats.map(function (x) { return A.opt(x.id, x.label, n.cat); }).join('') + '</select></div>' +
      '<div class="field"><label>' + esc(L('Farbe', 'Colour')) + '</label><div class="fb-swatches">' + NOTE_COLORS.map(function (col) {
        return '<button type="button" class="fb-sw' + ((n.color || NOTE_COLORS[0]) === col ? ' on' : '') + '" data-act="fbColor" data-id="' + col + '" style="background:' + col + '" aria-label="' + col + '"></button>'; }).join('') + '</div></div>' +
      '<div class="row"><label style="font-weight:400"><input type="checkbox" data-act="fbNSel" data-k="root"' + (n.root ? ' checked' : '') + '> ⭐ ' + esc(L('Hauptursache (Root Cause)', 'Root cause')) + '</label><span class="spacer"></span>' +
      '<span class="small">' + esc(L('Stimmen', 'Votes')) + '</span>' + K.btn('fbVote', '−', { id: '-1', cls: 'btn-sm' }) + '<b>' + n.votes + '</b>' + K.btn('fbVote', '+', { id: '1', cls: 'btn-sm' }) + '</div>' +
      '<details' + (n.root || n.why.some(Boolean) ? ' open' : '') + '><summary>' + esc(L('5-Why-Analyse', '5-Why analysis')) + '</summary>' + [0, 1, 2, 3, 4].map(function (i) {
        return '<div class="field"><label class="small">' + (i + 1) + '. ' + esc(L('Warum?', 'Why?')) + '</label><input type="text" data-field="fbWhy" data-k="' + i + '" value="' + esc(n.why[i] || '') + '"></div>'; }).join('') + '</details>' +
      '<div class="field"><label>' + esc(L('Gegenmaßnahme', 'Countermeasure')) + '</label><textarea data-field="fbN" data-k="measure" rows="2">' + esc(n.measure || '') + '</textarea></div>' +
      '<div class="row">' + K.btn('fbNDup', '⧉ ' + L('Duplizieren', 'Duplicate'), { cls: 'btn-sm' }) + K.btn('fbNDel', '🗑 ' + L('Löschen', 'Delete'), { cls: 'btn-sm btn-danger' }) + '</div>' +
      '<p class="small muted">' + esc(L('Kategorie: ', 'Category: ') + (c ? c.label : '–')) + '</p>';
  }

  function summaryHtml(fb, roots) {
    var top = fb.notes.filter(function (n) { return n.votes > 0; }).sort(function (a, b) { return b.votes - a.votes; }).slice(0, 5);
    var h = ['<div class="grid grid-2"><div class="card"><h2>' + esc(L('Ursachen je Kategorie', 'Causes per category')) + '</h2>'];
    fb.cats.forEach(function (c) {
      var list = fb.notes.filter(function (n) { return n.cat === c.id; }).sort(function (a, b) { return (b.root - a.root) || (b.votes - a.votes); });
      h.push('<div class="fb-sum"><div class="fb-sum-h" style="border-color:' + esc(c.color) + '"><b>' + esc(c.label) + '</b> <span class="muted small">(' + list.length + ')</span></div>' +
        (list.length ? '<ul>' + list.map(function (n) { return '<li><a href="#fishbone" data-act="fbSel" data-id="' + esc(n.id) + '">' + (n.root ? '⭐ ' : '') + esc(n.text || '…') + '</a>' + (n.votes ? ' <span class="badge st-open">' + n.votes + '</span>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="small muted">–</p>') + '</div>');
    });
    h.push('</div><div class="card"><h2>' + esc(L('Hauptursachen & Maßnahmen', 'Root causes & measures')) + '</h2>');
    if (roots.length) h.push(K.table([{ l: ['Hauptursache', 'Root cause'], w: 180 }, { l: ['Kategorie', 'Category'] }, { l: ['5-Why (tiefste Ursache)', '5-Why (deepest cause)'], w: 160 }, { l: ['Gegenmaßnahme', 'Countermeasure'], w: 160 }], roots.map(function (n) {
      var c = fb.cats.find(function (x) { return x.id === n.cat; }), deep = n.why.filter(Boolean).slice(-1)[0];
      return '<tr><td><a href="#fishbone" data-act="fbSel" data-id="' + esc(n.id) + '">' + esc(n.text) + '</a></td><td class="small">' + esc(c ? c.label : '') + '</td><td class="small">' + esc(deep || '–') + '</td><td class="small">' + esc(n.measure || '–') + '</td></tr>'; })));
    else h.push('<p class="muted small">' + esc(L('Noch keine Hauptursache markiert – Notiz auswählen und „⭐ Hauptursache“ setzen.', 'No root cause marked yet – select a note and tick "⭐ Root cause".')) + '</p>');
    if (top.length) h.push('<h3>' + esc(L('Meiste Stimmen', 'Most votes')) + '</h3><ol class="small">' + top.map(function (n) { return '<li>' + esc(n.text) + ' – <b>' + n.votes + '</b></li>'; }).join('') + '</ol>');
    h.push('<p class="small muted">' + esc(L(fb.notes.length + ' Notizen · ' + roots.length + ' Hauptursachen · ' + fb.notes.reduce(function (s, n) { return s + n.votes; }, 0) + ' Stimmen', fb.notes.length + ' notes · ' + roots.length + ' root causes · ' + fb.notes.reduce(function (s, n) { return s + n.votes; }, 0) + ' votes')) + '</p></div></div>');
    return h.join('');
  }

  /* ------------------------------------------------------------------
   * Aktionen
   * ---------------------------------------------------------------- */
  function addDiagram(obj) {
    var f = F(), fb = Object.assign({ name: L('Neue Ursachenanalyse', 'New root cause analysis'), effect: '', date: K.today(), owner: S().meta.auditor || '', team: '', cats: cats('it'), notes: [], conclusion: '', registerId: '' }, obj || {});
    fb.id = K.seq(f, 'seq', 'IS-', 2);
    f.items.push(fb); U.id = fb.id; U.sel = null; A.save(); A.render();
    return fb;
  }
  function newDialog() {
    var form = A.dialog(L('Neues Fischgrätendiagramm', 'New fishbone diagram'), '<div class="field"><label>' + esc(L('Titel', 'Title')) + ' *</label><input type="text" name="name" required></div>' +
      '<div class="field"><label>' + esc(L('Wirkung / Problem', 'Effect / problem')) + '</label><textarea name="effect" rows="2" placeholder="' + esc(L('z. B. Wiederholte Ausfälle des VPN-Zugangs', 'e.g. Repeated VPN outages')) + '"></textarea></div>' +
      '<div class="field"><label>' + esc(L('Kategorien', 'Categories')) + '</label><select name="set">' + Object.keys(SETS).map(function (k) { return A.opt(k, K.lab(SET_NAMES[k]), 'it'); }).join('') + '</select></div>', function (f) {
      var name = f.querySelector('[name=name]').value.trim(); if (!name) { f.querySelector('[name=name]').classList.add('invalid'); return false; }
      setTimeout(function () { addDiagram({ name: name, effect: f.querySelector('[name=effect]').value.trim(), cats: cats(f.querySelector('[name=set]').value) }); }, 0);
    }, L('Anlegen', 'Create'));
    return form;
  }
  function tplDialog() {
    var ex = examples();
    A.dialog(L('Vorlage wählen', 'Choose template'), '<div class="checks">' + ex.map(function (e, i) {
      return '<label><input type="radio" name="tpl" value="' + i + '"' + (i === 0 ? ' checked' : '') + '> <b>' + esc(e.name) + '</b><div class="small muted">' + esc(e.effect) + ' · ' + e.notes.length + ' ' + esc(L('Notizen', 'notes')) + '</div></label>'; }).join('') + '</div>', function (f) {
      var e = ex[+f.querySelector('[name=tpl]:checked').value];
      var fb = { name: e.name, effect: e.effect, cats: cats(e.set), notes: [], conclusion: e.conclusion };
      e.notes.forEach(function (x, i) {
        var c = fb.cats[x[0] % fb.cats.length].id, p = slot(fb, c);
        fb.notes.push({ id: nid('f'), cat: c, x: p.x, y: p.y, text: x[1], color: NOTE_COLORS[i % 3 === 2 ? 2 : 0], votes: x[2] || 0, root: !!x[3], why: [], measure: '' });
      });
      setTimeout(function () { addDiagram(fb); }, 0);
    }, L('Übernehmen', 'Apply'));
  }
  function addNote(fb, catId, x, y) {
    var p = x === undefined ? slot(fb, catId) : { x: clampX(x), y: clampY(y) };
    var n = { id: nid('f'), cat: catId, x: Math.round(p.x), y: Math.round(p.y), text: L('Neue Ursache', 'New cause'), color: NOTE_COLORS[0], votes: 0, root: false, why: [], measure: '' };
    fb.notes.push(n); U.sel = n.id; A.save(); A.render();
    var ta = document.getElementById('fbNoteText'); if (ta) { ta.focus(); ta.select(); }
  }
  function redraw() {
    var fb = cur(), cv = document.getElementById('fbCanvas'); if (!fb || !cv) return;
    cv.innerHTML = svg(fb); bind();
  }
  function toRegister(fb) {
    var s = S(), roots = fb.notes.filter(function (n) { return n.root; }), list = roots.length ? roots : fb.notes.slice().sort(function (a, b) { return b.votes - a.votes; }).slice(0, 3);
    var r = s.register.items.find(function (x) { return x.id === fb.registerId; });
    if (!r) {
      r = { id: K.seq(s.register, 'seq', 'RR-'), title: fb.effect, category: 'cyber', threat: '', cause: '', consequence: '', assets: [], owner: fb.owner || '', status: 'open', p: 2, i: 3, treatment: 'reduce', due: '', measures: '', rp: '', ri: '', reviewMonths: '', lastReview: '', desc: '', q: {}, reviews: [], created: new Date().toISOString() };
      s.register.items.push(r); fb.registerId = r.id;
    }
    r.title = r.title || fb.effect;
    r.cause = list.map(function (n) { return n.text + (n.why.filter(Boolean).length ? ' (→ ' + n.why.filter(Boolean).slice(-1)[0] + ')' : ''); }).join('; ');
    r.measures = list.filter(function (n) { return n.measure; }).map(function (n) { return n.measure; }).join('; ') || r.measures;
    r.desc = (r.desc ? r.desc + '\n' : '') + L('Aus Ursachenanalyse ' + fb.id + ' (' + K.today() + ')', 'From root cause analysis ' + fb.id + ' (' + K.today() + ')') + (fb.conclusion ? ': ' + fb.conclusion : '');
    r.updated = new Date().toISOString();
    A.save(); A.render(); A.toast(L('Ins Risikoregister übernommen: ', 'Transferred to risk register: ') + r.id);
  }
  function standalone(fb) {
    var roots = fb.notes.filter(function (n) { return n.root; });
    return '<!DOCTYPE html><html lang="' + HA.lang + '"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:"><title>' + esc(fb.id + ' ' + fb.name) + '</title><style>' +
      '@page{size:A4 landscape;margin:10mm}body{font-family:Segoe UI,Roboto,Arial,sans-serif;font-size:9.5pt;color:#1b2430;margin:0}h1{font-size:15pt;margin:0 0 1mm}h2{font-size:11pt;margin:4mm 0 1.5mm}p{margin:0 0 2mm}table{border-collapse:collapse;width:100%;font-size:8.5pt}td,th{border:.4pt solid #b8c2cf;padding:1.2mm 2mm;text-align:left;vertical-align:top}th{background:#eef2f7}svg{width:100%;height:auto;max-height:150mm}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}.cols{columns:3;column-gap:6mm;font-size:8.5pt}.cols div{break-inside:avoid;margin-bottom:2mm}</style></head><body>' +
      '<h1>' + esc(fb.id + ' – ' + fb.name) + '</h1><p>' + esc([fb.date ? K.fmt(fb.date) : '', fb.owner ? L('Moderation: ', 'Facilitator: ') + fb.owner : '', fb.team ? L('Teilnehmende: ', 'Participants: ') + fb.team : ''].filter(Boolean).join(' · ')) + '</p>' +
      svg(fb, { plain: true }) + '<div style="break-before:page"></div><h2>' + esc(L('Ursachen je Kategorie', 'Causes per category')) + '</h2><div class="cols">' + fb.cats.map(function (c) {
        var l = fb.notes.filter(function (n) { return n.cat === c.id; }); return '<div><b style="color:' + esc(c.color) + '">' + esc(c.label) + '</b><br>' + (l.length ? l.map(function (n) { return (n.root ? '⭐ ' : '• ') + esc(n.text) + (n.votes ? ' (' + n.votes + ')' : ''); }).join('<br>') : '–') + '</div>'; }).join('') + '</div>' +
      (roots.length ? '<h2>' + esc(L('Hauptursachen, 5-Why und Gegenmaßnahmen', 'Root causes, 5-Why and countermeasures')) + '</h2><table><thead><tr><th>' + esc(L('Hauptursache', 'Root cause')) + '</th><th>5-Why</th><th>' + esc(L('Gegenmaßnahme', 'Countermeasure')) + '</th></tr></thead><tbody>' +
        roots.map(function (n) { return '<tr><td>' + esc(n.text) + '</td><td>' + n.why.filter(Boolean).map(function (w, i) { return (i + 1) + '. ' + esc(w); }).join('<br>') + '</td><td>' + esc(n.measure || '–') + '</td></tr>'; }).join('') + '</tbody></table>' : '') +
      (fb.conclusion ? '<h2>' + esc(L('Ergebnis', 'Result')) + '</h2><p>' + esc(fb.conclusion) + '</p>' : '') + '</body></html>';
  }
  function printHtml(html) {
    var fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0'; document.body.appendChild(fr);
    fr.onload = function () { setTimeout(function () { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { A.toast(e.message, true); } setTimeout(function () { fr.remove(); }, 120000); }, 250); };
    fr.srcdoc = html;
  }

  /* ------------------------------------------------------------------
   * Ziehen & Ablegen (Pointer Events: Maus, Stift, Touch)
   * ---------------------------------------------------------------- */
  function svgPoint(svgEl, e) { var pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; var m = svgEl.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 }; }
  function bind() {
    var el = document.getElementById('fbSvg'), fb = cur(); if (!el || !fb) return;
    el.addEventListener('pointerdown', function (e) {
      var g = e.target.closest('.fb-note'); if (!g || e.button > 0) return;
      e.preventDefault();
      var n = fb.notes.find(function (x) { return x.id === g.getAttribute('data-note'); }), p = svgPoint(el, e);
      U.drag = { n: n, g: g, dx: p.x - n.x, dy: p.y - n.y, sx: e.clientX, sy: e.clientY, moved: false };
      g.setPointerCapture(e.pointerId); g.parentNode.appendChild(g);   // nach vorn holen
    });
    el.addEventListener('pointermove', function (e) {
      var d = U.drag; if (!d) return;
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return;
      d.moved = true;
      var p = svgPoint(el, e), x = clampX(p.x - d.dx), y = clampY(p.y - d.dy);
      d.x = x; d.y = y; d.g.setAttribute('transform', 'translate(' + (x - NW / 2) + ',' + (y - NH / 2) + ')'); d.g.classList.add('drag');
      var link = el.querySelector('.fb-link[data-note="' + d.n.id + '"]'); if (link) { link.style.display = 'none'; if (link.nextSibling) link.nextSibling.style.display = 'none'; }
      var best = boneFor(fb, x, y);
      el.querySelectorAll('.fb-bone').forEach(function (b) { b.classList.toggle('hot', b.getAttribute('data-cat') === best.b.cat.id); });
    });
    function end(e) {
      var d = U.drag; if (!d) return; U.drag = null;
      if (!d.moved) { U.sel = d.n.id; A.render(); var ta = document.getElementById('fbNoteText'); if (ta && window.innerWidth >= 1100) ta.focus(); return; }
      d.n.x = Math.round(d.x); d.n.y = Math.round(d.y); d.n.cat = boneFor(fb, d.x, d.y).b.cat.id; U.sel = d.n.id;
      A.save(); A.render();
    }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', function () { if (U.drag) { U.drag = null; redraw(); } });
    el.addEventListener('dblclick', function (e) {
      if (e.target.closest('.fb-note') || e.target.closest('.fb-head')) return;
      var p = svgPoint(el, e); addNote(fb, boneFor(fb, p.x, p.y).b.cat.id, p.x, p.y);
    });
    el.addEventListener('keydown', function (e) {
      var g = e.target.closest && e.target.closest('.fb-note'); if (!g) return;
      var n = fb.notes.find(function (x) { return x.id === g.getAttribute('data-note'); }); if (!n) return;
      var step = e.shiftKey ? 40 : 10, mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); U.sel = n.id; A.render(); return; }
      if (mv) { e.preventDefault(); n.x = clampX(n.x + mv[0]); n.y = clampY(n.y + mv[1]); n.cat = boneFor(fb, n.x, n.y).b.cat.id; U.sel = n.id; A.save(); redraw(); var ng = document.querySelector('.fb-note[data-note="' + n.id + '"]'); if (ng) ng.focus(); }
    });
  }
  // Entf-Taste löscht die ausgewählte Notiz (nicht in Eingabefeldern)
  document.addEventListener('keydown', function (e) {
    if (A.ui.view !== 'fishbone' || !U.sel || (e.key !== 'Delete' && e.key !== 'Backspace')) return;
    var tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || tag === 'select' || document.getElementById('dlg').open) return;
    var fb = cur(); if (!fb) return; e.preventDefault();
    fb.notes = fb.notes.filter(function (n) { return n.id !== U.sel; }); U.sel = null; A.save(); A.render();
  });

  A.views.fishbone = view;
  A.ext.afterRender.push(function (v) { if (v === 'fishbone') bind(); });
  A.ext.click.push(function (act, el) {
    var fb = cur(), id = el.getAttribute('data-id'), n = fb && fb.notes.find(function (x) { return x.id === U.sel; });
    switch (act) {
      case 'fbNew': newDialog(); return true;
      case 'fbTpl': tplDialog(); return true;
      case 'fbPick': U.id = id; U.sel = null; A.render(); return true;
      case 'fbSel': U.sel = id; A.render(); var ed = document.getElementById('fbEditor'); if (ed) ed.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return true;
      case 'fbDesel': U.sel = null; A.render(); return true;
      case 'fbHead': U.sel = null; A.render(); var ef = document.querySelector('[data-field=fbD][data-k=effect]'); if (ef) ef.focus(); return true;
      case 'fbAdd': { var sel = document.querySelector('[data-act=fbAddCat]'); addNote(fb, sel ? sel.value : fb.cats[0].id); return true; }
      case 'fbColor': n.color = id; A.save(); A.render(); return true;
      case 'fbVote': n.votes = Math.max(0, n.votes + (+id)); A.save(); A.render(); return true;
      case 'fbNDel': fb.notes = fb.notes.filter(function (x) { return x !== n; }); U.sel = null; A.save(); A.render(); return true;
      case 'fbNDup': { var c = JSON.parse(JSON.stringify(n)); c.id = nid('f'); c.x = clampX(n.x + 24); c.y = clampY(n.y + 24); c.root = false; c.votes = 0; fb.notes.push(c); U.sel = c.id; A.save(); A.render(); return true; }
      case 'fbCatAdd': { var i = fb.cats.length; fb.cats.push({ id: nid('c'), label: L('Kategorie ', 'Category ') + (i + 1), color: CAT_COLORS[i % CAT_COLORS.length] }); relayout(fb); A.save(); A.render(); return true; }
      case 'fbCatDel': {
        var cat = fb.cats.find(function (x) { return x.id === id; }), cnt = fb.notes.filter(function (x) { return x.cat === id; }).length;
        var go = function () { fb.cats = fb.cats.filter(function (x) { return x !== cat; }); fb.notes.forEach(function (x) { if (x.cat === id) x.cat = fb.cats[0].id; }); relayout(fb, true); A.save(); A.render(); };
        if (cnt) A.confirm(L('Kategorie „' + cat.label + '“ entfernen? ' + cnt + ' Notiz(en) werden „' + fb.cats.filter(function (x) { return x !== cat; })[0].label + '“ zugeordnet.', 'Remove category "' + cat.label + '"? ' + cnt + ' note(s) move to the first category.'), go); else go();
        return true;
      }
      case 'fbToRegister': toRegister(fb); return true;
      case 'fbSvg': K.download('fischgraete_' + fb.id + '.svg', '<?xml version="1.0" encoding="UTF-8"?>\n' + svg(fb, { plain: true }), 'image/svg+xml'); return true;
      case 'fbPrint': printHtml(standalone(fb)); A.toast(L('Für PDF im Druckdialog „Als PDF speichern“ wählen.', 'For PDF choose "Save as PDF" in the print dialog.')); return true;
      case 'fbExport': K.download('fischgraete_' + fb.id + '.json', JSON.stringify({ app: 'little-riskbee-fishbone', version: 1, diagram: fb }, null, 2), 'application/json'); return true;
      case 'fbImport': document.getElementById('fbFile').click(); return true;
      case 'fbDup': { var cp = JSON.parse(JSON.stringify(fb)); cp.name += L(' (Kopie)', ' (copy)'); cp.registerId = ''; addDiagram(cp); return true; }
      case 'fbDel': A.confirm(L('Diagramm ' + fb.id + ' „' + fb.name + '“ löschen?', 'Delete diagram ' + fb.id + '?'), function () { F().items = F().items.filter(function (x) { return x !== fb; }); U.id = null; U.sel = null; A.save(); A.render(); }); return true;
    }
  });
  /** Notizen nach Änderung der Kategorien neu an ihre Gräten setzen (falls force oder außerhalb). */
  function relayout(fb, force) {
    var bs = bones(fb);
    fb.notes.forEach(function (n) {
      var b = bs.find(function (x) { return x.cat.id === n.cat; }), best = boneFor(fb, n.x, n.y);
      if (force || best.b.cat.id !== n.cat) { var tmp = { cats: fb.cats, notes: fb.notes.filter(function (x) { return x !== n && x.cat === n.cat && x._placed; }) }; var p = slot(tmp, b.cat.id); n.x = Math.round(p.x); n.y = Math.round(p.y); n._placed = true; }
    });
    fb.notes.forEach(function (n) { delete n._placed; });
  }
  A.ext.change.push(function (act, el) {
    var fb = cur(); if (!fb) return false;
    var n = fb.notes.find(function (x) { return x.id === U.sel; }), k = el.getAttribute('data-k');
    switch (act) {
      case 'fbNSel': {
        if (k === 'root') n.root = el.checked;
        else { n.cat = el.value; var p = slot({ cats: fb.cats, notes: fb.notes.filter(function (x) { return x !== n; }) }, n.cat); n.x = Math.round(p.x); n.y = Math.round(p.y); }
        A.save(); A.render(); return true;
      }
      case 'fbSet': if (!el.value) return true; {
        var set = el.value, nc = cats(set);
        A.confirm(L('Kategorien durch „' + K.lab(SET_NAMES[set]) + '“ ersetzen? Notizen werden der Reihe nach zugeordnet.', 'Replace categories with "' + K.lab(SET_NAMES[set]) + '"? Notes are reassigned in order.'), function () {
          var map = {}; fb.cats.forEach(function (c, i) { map[c.id] = nc[Math.min(i, nc.length - 1)].id; });
          fb.notes.forEach(function (x) { x.cat = map[x.cat] || nc[0].id; }); fb.cats = nc; relayout(fb, true); A.save(); A.render();
        });
        el.value = ''; return true;
      }
      case 'fbCatColor': { var c = fb.cats.find(function (x) { return x.id === el.getAttribute('data-id'); }); c.color = el.value; A.save(); redraw(); return true; }
      case 'fbFile': {
        var file = el.files[0]; el.value = ''; if (!file) return true;
        file.text().then(function (txt) {
          try { var o = JSON.parse(txt), d = o.diagram || o; if (!Array.isArray(d.notes)) throw new Error('notes'); delete d.id; d.registerId = ''; addDiagram(d); A.toast(L('Diagramm importiert', 'Diagram imported')); }
          catch (e) { A.toast(L('Datei ist kein Fischgrätendiagramm.', 'File is not a fishbone diagram.'), true); }
        });
        return true;
      }
      case 'fbN': case 'fbD': case 'fbCat': case 'fbWhy': return el.type !== 'date';   // Datum: Eingabe-Handler übernimmt
      case 'fbAddCat': return true;
    }
    return false;
  });
  A.ext.input.push(function (act, el) {
    var fb = cur(); if (!fb) return false;
    var n = fb.notes.find(function (x) { return x.id === U.sel; }), k = el.getAttribute('data-k');
    if (act === 'fbN') { n[k] = el.value; A.save(); if (k === 'text') { clearTimeout(U._t); U._t = setTimeout(redraw, 200); } return true; }
    if (act === 'fbWhy') { n.why[+k] = el.value; A.save(); return true; }
    if (act === 'fbD') { fb[k] = el.value; A.save(); if (k === 'effect') { clearTimeout(U._t); U._t = setTimeout(redraw, 200); } return true; }
    if (act === 'fbCat') { var c = fb.cats.find(function (x) { return x.id === el.getAttribute('data-id'); }); c.label = el.value; A.save(); clearTimeout(U._t); U._t = setTimeout(redraw, 200); return true; }
  });

  // Bericht (Hauptbericht)
  A.ext.reportOpts.push({ key: 'fishbone', label: { de: 'Ursachenanalysen (Fischgrätendiagramme)', en: 'Root cause analyses (fishbone diagrams)' } });
  HA.Report.ext.push({ key: 'fishbone', build: function (state, scope, H) {
    if (!state.fishbones.items.length) return '';
    var h = ['<section class="pb"><h2>' + H.esc(L('Ursachenanalysen (Ishikawa)', 'Root cause analyses (Ishikawa)')) + '</h2>'];
    state.fishbones.items.forEach(function (fb) {
      var roots = fb.notes.filter(function (n) { return n.root; });
      h.push('<h3>' + H.esc(fb.id + ' – ' + fb.name) + '</h3><p class="small">' + H.esc(L('Wirkung: ', 'Effect: ') + (fb.effect || '–') + ' · ' + fb.notes.length + L(' Ursachen', ' causes') + ' · ' + roots.length + L(' Hauptursachen', ' root causes')) + '</p>');
      h.push('<div style="break-inside:avoid">' + svg(fb, { plain: true }).replace('class="fb-svg"', 'class="fb-svg" style="width:100%;height:auto"') + '</div>');
      if (roots.length) h.push('<table><thead><tr><th>' + H.esc(L('Hauptursache', 'Root cause')) + '</th><th>' + H.esc(L('Tiefste Ursache (5-Why)', 'Deepest cause (5-Why)')) + '</th><th>' + H.esc(L('Gegenmaßnahme', 'Countermeasure')) + '</th></tr></thead><tbody>' +
        roots.map(function (n) { return '<tr><td>' + H.esc(n.text) + '</td><td class="small">' + H.esc(n.why.filter(Boolean).slice(-1)[0] || '–') + '</td><td class="small">' + H.esc(n.measure || '–') + '</td></tr>'; }).join('') + '</tbody></table>');
      if (fb.conclusion) h.push('<p class="small"><b>' + H.esc(L('Ergebnis: ', 'Result: ')) + '</b>' + H.esc(fb.conclusion) + '</p>');
    });
    h.push('</section>');
    return h.join('');
  } });

  return { svg: svg, bones: bones, boneFor: boneFor, U: U, examples: examples, cats: cats };
})();

/* =====================================================================
 * modules/theme.js – Style-Wechsler (eigene style.css)
 * ---------------------------------------------------------------------
 * In den Einstellungen kann auf eine andere CSS-Datei verwiesen werden:
 *   • mitgelieferte Stile in css/themes/ (z. B. honey.css, contrast.css)
 *   • eigener relativer Pfad (Datei liegt im Anwendungsordner)
 *   • hochgeladene CSS-Datei (Inhalt wird lokal im Zustand gespeichert)
 * Modus „ergänzen“: Datei wird NACH css/style.css geladen und überschreibt
 *   nur einzelne Werte (empfohlen – z. B. nur die Farb-Variablen).
 * Modus „ersetzen“: css/style.css wird deaktiviert, nur die eigene Datei gilt.
 * Gespeichert (Autosave + JSON-Export) wird die Einstellung NUR, wenn nicht
 * der Standard verwendet wird (state.meta.style fehlt = Standard).
 * Sicherheit/DSGVO: Die Content-Security-Policy erlaubt nur lokale Dateien;
 * externe Adressen (http/https) werden abgelehnt. Notfall: index.html?style=default
 * öffnet die Seite einmalig mit dem Standard-Stil.
 * ===================================================================== */
window.HA = window.HA || {};

HA.Theme = (function () {
  'use strict';
  var A = HA.App, K = HA.Kit, L = K.L, esc = A.esc;
  var BUILTIN = [['css/themes/honey.css', ['Honey – warme Bienenfarben', 'Honey – warm bee colours']], ['css/themes/contrast.css', ['Hoher Kontrast (Barrierefreiheit)', 'High contrast (accessibility)']], ['css/themes/compact.css', ['Kompakt – dichtere Darstellung', 'Compact – denser layout']]];
  var safeMode = /[?&]style=default\b/.test(location.search);
  var applied = '', showCustom = false;
  function S() { return A.state(); }
  function cfg() { return S().meta.style || null; }
  function isDefault(c) { return !c || (!c.href && !c.css); }
  /** Nur lokale, relative .css-Pfade zulassen. */
  function validPath(p) { return /^[\w\-./ ]+\.css$/i.test(p) && !/^\/|\.\.|:\/\//.test(p); }

  /** Stil im Dokument anwenden (idempotent). */
  function apply() {
    var c = cfg(), main = document.getElementById('mainCss');
    var key = JSON.stringify(c || {}) + safeMode;
    if (key === applied) return; applied = key;
    var old = document.getElementById('themeCss'); if (old) old.remove();
    var oldS = document.getElementById('themeStyle'); if (oldS) oldS.remove();
    if (main) main.disabled = false;
    if (safeMode || isDefault(c)) return;
    var replace = c.mode === 'replace';
    if (c.css) {
      var st = document.createElement('style'); st.id = 'themeStyle'; st.textContent = c.css; document.head.appendChild(st);
      if (replace && main) main.disabled = true;
      return;
    }
    if (!validPath(c.href)) { A.toast(L('Ungültiger Stil-Pfad – Standard wird verwendet.', 'Invalid style path – default is used.'), true); return; }
    var link = document.createElement('link'); link.rel = 'stylesheet'; link.id = 'themeCss'; link.href = c.href;
    link.onload = function () { if (replace && main) main.disabled = true; };
    link.onerror = function () { link.remove(); if (main) main.disabled = false; A.toast(L('Stil-Datei „' + c.href + '“ nicht gefunden – Standard-Stil bleibt aktiv.', 'Style file "' + c.href + '" not found – default style stays active.'), true); };
    document.head.appendChild(link);
  }
  function set(c) {
    var s = S();
    if (isDefault(c)) delete s.meta.style; else s.meta.style = c;
    showCustom = !!(c && c.href && !BUILTIN.some(function (b) { return b[0] === c.href; }));
    applied = ''; apply(); A.save(); A.render();
  }

  function card() {
    var c = cfg() || {}, kind = showCustom ? 'custom' : c.css ? 'upload' : !c.href ? 'default' : BUILTIN.some(function (b) { return b[0] === c.href; }) ? c.href : 'custom';
    return '<div class="card" id="styleSwitcher"><h2>🎨 ' + esc(L('Darstellung: Style-Wechsler', 'Appearance: style switcher')) + '</h2>' +
      (safeMode ? '<div class="note warn">' + esc(L('Sicherheitsmodus aktiv (?style=default): Gespeicherter Stil wird in dieser Sitzung ignoriert.', 'Safe mode active (?style=default): the stored style is ignored in this session.')) + '</div>' : '') +
      '<div class="grid grid-2"><div class="field"><label>' + esc(L('Stylesheet', 'Stylesheet')) + '</label><select data-act="styleKind">' +
      A.opt('default', L('Standard (css/style.css)', 'Default (css/style.css)'), kind) + BUILTIN.map(function (b) { return A.opt(b[0], K.lab(b[1]) + ' – ' + b[0], kind); }).join('') +
      A.opt('custom', L('Eigener Pfad …', 'Custom path …'), kind) + A.opt('upload', L('Hochgeladene CSS-Datei', 'Uploaded CSS file') + (c.css ? ' (' + (c.name || 'custom.css') + ')' : ''), kind) + '</select></div>' +
      '<div class="field"><label>' + esc(L('Modus', 'Mode')) + '</label><select data-act="styleMode"' + (kind === 'default' ? ' disabled' : '') + '>' +
      A.opt('add', L('ergänzen – nach style.css laden, überschreibt einzelne Werte (empfohlen)', 'supplement – load after style.css, overrides single values (recommended)'), c.mode || 'add') +
      A.opt('replace', L('ersetzen – nur die eigene Datei verwenden', 'replace – use only the own file'), c.mode || 'add') + '</select></div>' +
      (kind === 'custom' ? '<div class="field" style="grid-column:1/-1"><label>' + esc(L('Relativer Pfad zur CSS-Datei (im Ordner von index.html)', 'Relative path to CSS file (in the folder of index.html)')) + '</label><div class="field-inline"><input type="text" id="stylePath" value="' + esc(c.href || 'css/themes/mein-stil.css') + '" placeholder="css/themes/mein-stil.css">' +
        K.btn('stylePathApply', L('Anwenden', 'Apply'), { cls: 'btn-primary' }) + '</div></div>' : '') + '</div>' +
      '<div class="row" style="margin-top:.4rem">' + K.btn('styleUpload', '⬆ ' + L('CSS-Datei hochladen', 'Upload CSS file')) + K.btn('styleTemplate', '⬇ ' + L('Vorlage herunterladen', 'Download template')) +
      (kind !== 'default' ? K.btn('styleReset', L('Standard wiederherstellen', 'Restore default'), { cls: 'btn-danger' }) : '') + '</div>' +
      '<input type="file" id="fileCss" data-act="styleFile" accept=".css,text/css" hidden>' +
      '<p class="small muted" style="margin-top:.5rem">' + esc(L('Der gewählte Stil wird mit dem Autosave und im JSON-Export gespeichert – aber nur, wenn nicht der Standard verwendet wird. Aus Datenschutzgründen sind nur lokale Dateien erlaubt (keine Webfonts oder externen Adressen). Falls die Oberfläche unbrauchbar wird: index.html?style=default öffnen.',
        'The chosen style is stored with autosave and in the JSON export – but only when the default is not used. For privacy reasons only local files are allowed (no web fonts or external URLs). If the UI becomes unusable: open index.html?style=default.')) + '</p></div>';
  }
  /** Vorlage mit allen Design-Variablen (Hell + Dunkel) zum Anpassen. */
  function template() {
    var css = '/* Little-RiskBee – eigene Stil-Datei (Vorlage)\n * Ablage z. B. als css/themes/mein-stil.css und in den Einstellungen\n * „Eigener Pfad“ + Modus „ergänzen“ wählen – oder direkt hochladen.\n * Nur lokale Ressourcen verwenden (keine @import/url() auf externe Server).\n */\n' +
      ':root {\n  --bg: #f5f7fa;\n  --surface: #ffffff;\n  --surface-2: #eef2f7;\n  --border: #d8dee8;\n  --text: #1b2430;\n  --text-muted: #5b6676;\n  --primary: #1f6feb;\n  --primary-contrast: #ffffff;\n  --ok: #1a7f37;\n  --warn: #b35900;\n  --danger: #c62828;\n  --info: #0b6bcb;\n  --radius: 10px;\n  --radius-sm: 6px;\n  --sans: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;\n}\n' +
      'html[data-theme="dark"] {\n  --bg: #0d1117;\n  --surface: #161b22;\n  --surface-2: #1f2630;\n  --border: #303a46;\n  --text: #e6edf3;\n  --text-muted: #9aa7b4;\n  --primary: #4c8dff;\n  --primary-contrast: #0d1117;\n}\n' +
      '@media (prefers-color-scheme: dark) {\n  html[data-theme="auto"] {\n    --bg: #0d1117; --surface: #161b22; --surface-2: #1f2630; --border: #303a46;\n    --text: #e6edf3; --text-muted: #9aa7b4; --primary: #4c8dff; --primary-contrast: #0d1117;\n  }\n}\n\n/* Beispiele für weitere Anpassungen */\n.topbar { }\n.sidebar { }\n.card { }\n';
    K.download('little-riskbee-stil-vorlage.css', css, 'text/css;charset=utf-8');
  }
  function upload(file) {
    if (!file) return;
    if (file.size > 300 * 1024) { A.toast(L('CSS-Datei zu groß (max. 300 KB).', 'CSS file too large (max. 300 KB).'), true); return; }
    file.text().then(function (txt) {
      if (/@import\s+url\(\s*['"]?https?:|url\(\s*['"]?https?:/i.test(txt)) A.toast(L('Hinweis: Externe Adressen in der CSS-Datei werden durch die Sicherheitsrichtlinie blockiert.', 'Note: external URLs in the CSS file are blocked by the security policy.'), true);
      var c = cfg() || {};
      set({ mode: c.mode || 'add', href: '', css: txt, name: file.name });
      A.toast(L('Stil „' + file.name + '“ angewendet', 'Style "' + file.name + '" applied'));
    });
  }

  // Registrierung
  A.ext.settingsCards.push(card);
  A.ext.afterRender.push(apply);
  A.ext.normalize.push(function (s) {
    if (s.meta.style && isDefault(s.meta.style)) delete s.meta.style;
    var c = s.meta.style; showCustom = !!(c && c.href && !BUILTIN.some(function (b) { return b[0] === c.href; })); applied = '';
  });
  A.ext.beforeSave.push(function (s) { if (isDefault(s.meta.style)) delete s.meta.style; });   // Standard wird nicht gespeichert
  A.ext.click.push(function (act) {
    if (act === 'styleUpload') { document.getElementById('fileCss').click(); return true; }
    if (act === 'styleTemplate') { template(); return true; }
    if (act === 'styleReset') { set(null); A.toast(L('Standard-Stil wiederhergestellt', 'Default style restored')); return true; }
    if (act === 'stylePathApply') {
      var p = (document.getElementById('stylePath').value || '').trim();
      if (!validPath(p)) { A.toast(L('Bitte einen relativen Pfad zu einer .css-Datei angeben (z. B. css/themes/mein-stil.css).', 'Please enter a relative path to a .css file (e.g. css/themes/my-style.css).'), true); return true; }
      set({ mode: (cfg() || {}).mode || 'add', href: p, css: '' }); return true;
    }
  });
  A.ext.change.push(function (act, el) {
    if (act === 'styleKind') {
      var c = cfg() || {}, v = el.value;
      if (v === 'default') set(null);
      else if (v === 'upload') { showCustom = false; if (c.css) A.render(); else document.getElementById('fileCss').click(); }
      else if (v === 'custom') { showCustom = true; A.render(); }
      else set({ mode: c.mode || 'add', href: v, css: '' });
      return true;
    }
    if (act === 'styleMode') { var cc = Object.assign({}, cfg() || {}); cc.mode = el.value; set(cc); return true; }
    if (act === 'styleFile') { upload(el.files[0]); el.value = ''; return true; }
  });

  return { apply: apply, isDefault: isDefault };
})();

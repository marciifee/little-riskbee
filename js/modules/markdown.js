/* =====================================================================
 * modules/markdown.js – kleiner, sicherer Markdown-Renderer (ohne Fremdcode)
 * ---------------------------------------------------------------------
 * Unterstützt (an GitHub Flavored Markdown angelehnt):
 *   # Überschriften, **fett**, *kursiv*, ~~durchgestrichen~~, `Code`,
 *   ```Codeblöcke```, > Zitate, Listen (- / 1.) inkl. Verschachtelung und
 *   Aufgaben [ ] / [x], Tabellen | a | b |, --- Linie, [Links](https://…),
 *   Bilder ![Text](data:image/png;base64,…), automatische Links, Zeilenumbrüche.
 * Sicherheit: Jeglicher HTML-Code im Text wird maskiert. Links nur mit
 *   http(s)/mailto/#/relativ, Bilder nur als data:image oder relativer Pfad
 *   (externe Bilder würden Daten an Dritte senden – DSGVO).
 * Nutzung: HA.MD.render(text) → HTML-Zeichenkette
 * ===================================================================== */
window.HA = window.HA || {};

HA.MD = (function () {
  'use strict';
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function unesc(s) { return String(s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); }
  function safeUrl(u) {
    var raw = unesc(u).trim();
    if (/^(https?:|mailto:|#|\/|\.{1,2}\/)/i.test(raw) || /^[\w\-.]+(\/|$)/.test(raw) && !/^[a-z][\w+.-]*:/i.test(raw)) return esc(raw);
    return '#';
  }
  function safeImg(u) {
    var raw = unesc(u).trim();
    if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[a-z0-9+/=\s]+$/i.test(raw)) return esc(raw.replace(/\s+/g, ''));
    if (!/^[a-z][\w+.-]*:/i.test(raw) && !/^\/\//.test(raw)) return esc(raw);   // relativer Pfad
    return '';
  }

  /** Inline-Formatierung auf bereits maskiertem Text. */
  function inline(text) {
    var codes = [];
    var s = esc(text).replace(/`([^`\n]+)`/g, function (_, c) { codes.push('<code>' + c + '</code>'); return '\u0000' + (codes.length - 1) + '\u0000'; });
    // Bilder vor Links
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, function (_, alt, url, title) {
      var src = safeImg(url); if (!src) return '<span class="md-blocked">[' + alt + ']</span>';
      return '<img src="' + src + '" alt="' + alt + '"' + (title ? ' title="' + title + '"' : '') + '>';
    });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, function (_, label, url, title) {
      return '<a href="' + safeUrl(url) + '" target="_blank" rel="noopener noreferrer"' + (title ? ' title="' + title + '"' : '') + '>' + label + '</a>';
    });
    // automatische Links (nicht innerhalb bereits erzeugter Attribute)
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, function (_, pre, url) { return pre + '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>'; });
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>').replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
    s = s.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
    s = s.replace(/(\\|  )\n/g, '<br>').replace(/\n/g, '<br>');
    return s.replace(/\u0000(\d+)\u0000/g, function (_, i) { return codes[+i]; });
  }

  var RE_LIST = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
  var RE_HR = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
  var RE_TSEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
  function cells(line) {
    var l = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    var out = [], cur = '';
    for (var i = 0; i < l.length; i++) { if (l[i] === '\\' && l[i + 1] === '|') { cur += '|'; i++; } else if (l[i] === '|') { out.push(cur.trim()); cur = ''; } else cur += l[i]; }
    out.push(cur.trim()); return out;
  }
  function isBlockStart(l, next) {
    return /^```/.test(l) || /^#{1,6}\s/.test(l) || RE_HR.test(l) || /^\s*>/.test(l) || RE_LIST.test(l) || (/\|/.test(l) && next !== undefined && RE_TSEP.test(next));
  }

  function list(lines) {
    var m0 = lines[0].match(RE_LIST), ind = m0[1].length, ordered = /\d/.test(m0[2]);
    var items = [], cur = null;
    lines.forEach(function (l) {
      var m = l.match(RE_LIST);
      if (m && m[1].length <= ind) { cur = { first: m[3], rest: [], w: m[1].length + m[2].length + 1 }; items.push(cur); }
      else if (cur) cur.rest.push(l.replace(new RegExp('^\\s{0,' + (cur.w + 1) + '}'), ''));
    });
    var start = ordered ? parseInt(m0[2], 10) : 1;
    return '<' + (ordered ? 'ol' + (start !== 1 ? ' start="' + start + '"' : '') : 'ul') + '>' + items.map(function (it) {
      var first = it.first, task = first.match(/^\[([ xX])\]\s+(.*)$/), head;
      if (task) head = '<input type="checkbox" disabled' + (task[1] !== ' ' ? ' checked' : '') + '> ' + inline(task[2]); else head = inline(first);
      var rest = it.rest.join('\n').replace(/\s+$/, '');
      return '<li' + (task ? ' class="task"' : '') + '>' + head + (rest ? block(rest) : '') + '</li>';
    }).join('') + '</' + (ordered ? 'ol' : 'ul') + '>';
  }

  function block(src) {
    var lines = String(src || '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n'), out = [], i = 0;
    while (i < lines.length) {
      var l = lines[i];
      if (/^\s*$/.test(l)) { i++; continue; }
      var fence = l.match(/^\s*```\s*([\w+-]*)/);
      if (fence) {
        var buf = []; i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
        i++;
        out.push('<pre><code' + (fence[1] ? ' class="lang-' + esc(fence[1]) + '"' : '') + '>' + esc(buf.join('\n')) + '</code></pre>');
        continue;
      }
      var hm = l.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
      if (hm) { out.push('<h' + hm[1].length + '>' + inline(hm[2]) + '</h' + hm[1].length + '>'); i++; continue; }
      if (RE_HR.test(l)) { out.push('<hr>'); i++; continue; }
      if (/\|/.test(l) && i + 1 < lines.length && RE_TSEP.test(lines[i + 1])) {
        var head = cells(l), al = cells(lines[i + 1]).map(function (c) { return /^:-+:$/.test(c) ? 'center' : /-:$/.test(c) ? 'right' : /^:-/.test(c) ? 'left' : ''; });
        var rows = []; i += 2;
        while (i < lines.length && /\|/.test(lines[i]) && !/^\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
        var td = function (tag, c, k) { return '<' + tag + (al[k] ? ' style="text-align:' + al[k] + '"' : '') + '>' + inline(c || '') + '</' + tag + '>'; };
        out.push('<table><thead><tr>' + head.map(function (c, k) { return td('th', c, k); }).join('') + '</tr></thead><tbody>' +
          rows.map(function (r) { return '<tr>' + head.map(function (_, k) { return td('td', r[k], k); }).join('') + '</tr>'; }).join('') + '</tbody></table>');
        continue;
      }
      if (/^\s*>/.test(l)) {
        var q = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ''));
        out.push('<blockquote>' + block(q.join('\n')) + '</blockquote>');
        continue;
      }
      if (RE_LIST.test(l)) {
        var lb = [], m0 = l.match(RE_LIST), ind0 = m0[1].length, ord0 = /\d/.test(m0[2]);
        while (i < lines.length) {
          var cl = lines[i], mm = cl.match(RE_LIST);
          if (mm && mm[1].length <= ind0 && /\d/.test(mm[2]) !== ord0 && lb.length) break;   // Listentyp wechselt → neue Liste
          if (mm || /^\s{2,}\S/.test(cl)) { lb.push(cl); i++; continue; }
          if (/^\s*$/.test(cl) && i + 1 < lines.length && (RE_LIST.test(lines[i + 1]) || /^\s{2,}\S/.test(lines[i + 1]))) { lb.push(''); i++; continue; }
          break;
        }
        out.push(list(lb));
        continue;
      }
      var p = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && (p.length === 0 || !isBlockStart(lines[i], lines[i + 1]))) p.push(lines[i++]);
      out.push('<p>' + inline(p.join('\n')) + '</p>');
    }
    return out.join('\n');
  }

  /** Markdown in reinen Text (z. B. für CSV oder Maßnahmen-Beschreibungen). */
  function plain(src) {
    return String(src || '').replace(/```[\s\S]*?```/g, function (m) { return m.replace(/```\w*/g, ''); }).replace(/!\[[^\]]*\]\([^)]*\)/g, '[Bild]')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)').replace(/[*_~`#>]+/g, '').replace(/\n{3,}/g, '\n\n').trim();
  }

  /** Gemeinsames CSS für Vorschau und Bericht (ohne CSS-Variablen, damit es überall gleich aussieht). */
  var CSS = '.md{line-height:1.5;word-wrap:break-word;overflow-wrap:anywhere}.md>:first-child{margin-top:0}.md>:last-child{margin-bottom:0}' +
    '.md h1,.md h2,.md h3,.md h4{margin:.9em 0 .4em;line-height:1.25}.md h1{font-size:1.35em}.md h2{font-size:1.2em}.md h3{font-size:1.08em}.md h4{font-size:1em}' +
    '.md p{margin:.45em 0}.md ul,.md ol{margin:.4em 0;padding-left:1.5em}.md li{margin:.15em 0}.md li.task{list-style:none;margin-left:-1.2em}' +
    '.md code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.88em;background:rgba(127,127,127,.16);padding:.08em .3em;border-radius:4px}' +
    '.md pre{background:#0f1720;color:#e6edf3;padding:.7em .9em;border-radius:6px;overflow:auto;white-space:pre-wrap;word-break:break-all}.md pre code{background:none;padding:0;color:inherit;font-size:.85em}' +
    '.md blockquote{margin:.5em 0;padding:.2em .9em;border-left:4px solid rgba(127,127,127,.45);color:inherit;opacity:.9}' +
    '.md table{border-collapse:collapse;margin:.5em 0;width:auto;max-width:100%}.md th,.md td{border:1px solid rgba(127,127,127,.45);padding:.25em .5em;vertical-align:top}.md th{background:rgba(127,127,127,.12)}' +
    '.md img{max-width:100%;height:auto;border:1px solid rgba(127,127,127,.35);border-radius:4px;margin:.3em 0}.md hr{border:0;border-top:1px solid rgba(127,127,127,.45);margin:1em 0}' +
    '.md mark{background:#ffe066;color:#111;padding:0 .15em}.md .md-blocked{color:#c62828;font-style:italic}';

  return { render: function (s) { return block(s); }, inline: inline, plain: plain, esc: esc, CSS: CSS };
})();

/* =====================================================================
 * modules/montecarlo.js – Monte-Carlo-Analyse (quantitative Risikoanalyse)
 * ---------------------------------------------------------------------
 * Methode (vereinfachtes FAIR-ähnliches Modell, rein lokal berechnet):
 *   Für jedes Risiko und jedes simulierte Jahr
 *     λ  ~ PERT(min, wahrscheinlich, max)   Ereignisse pro Jahr
 *     N  ~ Poisson(λ)                        Anzahl Ereignisse im Jahr
 *     Lₖ ~ PERT(min, wahrscheinlich, max)   Schaden je Ereignis (€)
 *     Jahresverlust = Σ Lₖ ;  Gesamt = Summe über alle Risiken
 *   Ergebnis: Verteilung des Jahresverlusts brutto (vor) und netto (nach
 *   Maßnahmen) → Erwartungswert (ALE), Median, P90/P95/P99 (Value at Risk),
 *   Überschreitungswahrscheinlichkeit der Verlusttoleranz, Verlust-
 *   überschreitungskurve (LEC), Histogramm, Beitrag je Risiko.
 * Eingaben: eigene Dreipunktschätzung je Risiko oder – falls leer – die
 *   Kalibrierung der qualitativen Stufen (Risikoappetit → Kalibrierung).
 * Annahmen: Risiken unabhängig; reproduzierbar über Startwert (Seed).
 * ===================================================================== */
window.HA = window.HA || {};

HA.MC = (function () {
  'use strict';
  var A = HA.App, K = HA.Kit, L = K.L, R = HA.Risk, esc = A.esc, t = HA.t;
  var running = false;
  function S() { return A.state(); }
  A.ext.normalize.push(function (s) { if (s.mc === undefined) s.mc = null; });
  /* Kalibrierungs-Vorlagen: Häufigkeit je Stufe (Ereignisse/Jahr) und Schaden je Ereignis (€) nach Organisationsgröße */
  var FREQ = [[0.02, 0.1, 0.2], [0.2, 0.5, 1], [1, 2, 6], [4, 8, 12]];
  var PRESETS = {
    small: { l: [[50, 200, 1000], [1000, 3000, 10000], [10000, 25000, 75000], [75000, 150000, 500000]], n: ['klein (Verein, Kleinbetrieb)', 'small (club, micro business)'] },
    sme: { l: [[200, 1000, 5000], [5000, 15000, 50000], [50000, 100000, 250000], [250000, 500000, 2000000]], n: ['mittel (KMU)', 'medium (SME)'] },
    large: { l: [[2000, 10000, 50000], [50000, 150000, 500000], [500000, 1000000, 2500000], [2500000, 5000000, 20000000]], n: ['groß (Konzern)', 'large (enterprise)'] }
  };

  /* ------------------------------------------------------------------
   * Zufallszahlen und Verteilungen
   * ---------------------------------------------------------------- */
  /** Kleiner, schneller Pseudo-Zufallsgenerator mit Startwert (mulberry32). */
  function rng32(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  }
  function normal(r) { var u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  /** Gamma(k, 1) nach Marsaglia & Tsang. */
  function gamma(r, k) {
    if (k < 1) return gamma(r, k + 1) * Math.pow(r() || 1e-12, 1 / k);
    var d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) {
      var x, v; do { x = normal(r); v = 1 + c * x; } while (v <= 0);
      v = v * v * v; var u = r();
      if (u < 1 - 0.0331 * x * x * x * x || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }
  /** PERT-Verteilung (Beta mit λ = 4) über [a, b] mit Modalwert m. */
  function pert(r, p) {
    var a = +p[0], m = +p[1], b = +p[2];
    if (!(b > a)) return m || a || 0;
    m = Math.min(Math.max(m, a), b);
    var al = 1 + 4 * (m - a) / (b - a), be = 1 + 4 * (b - m) / (b - a);
    var x = gamma(r, al), y = gamma(r, be);
    return a + (x / (x + y)) * (b - a);
  }
  function poisson(r, lam) {
    if (lam <= 0) return 0;
    if (lam > 30) return Math.max(0, Math.round(lam + Math.sqrt(lam) * normal(r)));
    var Lm = Math.exp(-lam), k = 0, p = 1;
    do { k++; p *= r(); } while (p > Lm);
    return k - 1;
  }

  /* ------------------------------------------------------------------
   * Eingaben zusammenstellen
   * ---------------------------------------------------------------- */
  function full(q, a, b, c) { return q[a] !== '' && q[a] !== undefined && q[b] !== '' && q[b] !== undefined && q[c] !== '' && q[c] !== undefined; }
  function scale(arr, f) { return arr.map(function (x) { return x * f; }); }
  /** Netto-Parameter je nach Behandlung (Standard-Wirksamkeit aus den Einstellungen). */
  function byTreatment(f, l, tr, red) {
    if (tr === 'avoid') return { zero: true, f: f, l: l };
    if (tr === 'reduce') return { f: scale(f, 1 - red), l: l };
    if (tr === 'transfer') return { f: f, l: scale(l, 1 - red) };
    return { f: f, l: l };
  }
  function to4(v) { return Math.min(4, Math.max(1, Math.round((v - 1) * 3 / 4) + 1)); }
  function inputs() {
    var s = S(), ap = s.appetite, c = ap.calib, cfg = ap.mc, red = (+cfg.red || 0) / 100, out = [];
    if (cfg.inclCustom) s.register.items.forEach(function (r) {
      if (r.status === 'closed') return;
      var q = r.q || {}, p = +r.p || 1, i = +r.i || 1;
      var f = full(q, 'fMin', 'fMode', 'fMax') ? [+q.fMin, +q.fMode, +q.fMax] : c.f[p - 1].slice();
      var l = full(q, 'lMin', 'lMode', 'lMax') ? [+q.lMin, +q.lMode, +q.lMax] : c.l[i - 1].slice();
      var res, how;
      if (r.treatment === 'accept' || r.status === 'accepted') { res = { f: f, l: l }; how = L('akzeptiert – unverändert', 'accepted – unchanged'); }
      else if ((q.rf !== '' && q.rf !== undefined) || (q.rl !== '' && q.rl !== undefined)) { res = { f: scale(f, 1 - (+q.rf || 0) / 100), l: scale(l, 1 - (+q.rl || 0) / 100) }; how = L('eigene Wirksamkeit', 'own effectiveness') + ' (−' + (+q.rf || 0) + ' % / −' + (+q.rl || 0) + ' %)'; }
      else if (r.rp && r.ri) { res = { f: c.f[r.rp - 1].slice(), l: c.l[r.ri - 1].slice() }; how = L('Netto-Bewertung', 'net rating') + ' ' + r.rp + '×' + r.ri; }
      else { res = byTreatment(f, l, r.treatment, red); how = r.treatment ? t('treat.' + r.treatment) : L('keine Maßnahme – unverändert', 'no measure – unchanged'); }
      out.push({ id: r.id, title: r.title, src: 'custom', f: f, l: l, fr: res.f, lr: res.l, zero: !!res.zero, how: how, est: full(q, 'fMin', 'fMode', 'fMax') || full(q, 'lMin', 'lMode', 'lMax') });
    });
    // Befunde je Asset bündeln: Schwachstellen eines Systems führen meist zum selben Schadensereignis
    // (Kompromittierung des Assets) – gezählt wird daher der schwerste offene Befund je Asset.
    if (cfg.inclFindings) {
      var worst = {};
      R.findingRows(s, {}).forEach(function (x) {
        if (x.status === 'fixed' || x.status === 'falsepositive') return;
        var k = x.asset.id, w = worst[k];
        if (!w) worst[k] = w = { x: x, n: 0 };
        w.n++;
        if (x.p * x.i > w.x.p * w.x.i) w.x = x;
      });
      Object.keys(worst).forEach(function (k) {
        var w = worst[k], x = w.x, f = c.f[x.p - 1].slice(), l = c.l[x.i - 1].slice(), res = byTreatment(f, l, x.treatment, red);
        out.push({ id: x.asset.name, title: L('Schwachstellen auf ', 'Vulnerabilities on ') + x.asset.name + ' (' + w.n + ' ' + L('Befunde, schwerster', 'findings, worst') + ' ' + x.id + ')', src: 'finding', f: f, l: l, fr: res.f, lr: res.l, zero: !!res.zero,
          how: (x.treatment ? t('treat.' + x.treatment) : L('unverändert', 'unchanged')) + ' · ' + x.p + '×' + x.i, est: false });
      });
    }
    if (cfg.inclProject) (s.projectRisks || []).forEach(function (pr) {
      if (pr.status === 'done') return;
      var f = c.f[to4(+pr.p || 1) - 1].slice(), l = c.l[to4(+pr.i || 1) - 1].slice(), res;
      if (pr.rp && pr.ri) res = { f: c.f[to4(+pr.rp) - 1].slice(), l: c.l[to4(+pr.ri) - 1].slice() }; else res = byTreatment(f, l, pr.strategy, red);
      out.push({ id: pr.id, title: pr.title || '–', src: 'project', f: f, l: l, fr: res.f, lr: res.l, zero: !!res.zero, how: L('Projektrisiko (5→4 Stufen)', 'project risk (5→4 levels)'), est: false });
    });
    return out;
  }
  function fingerprint(inp) { var s = S(); return JSON.stringify([inp.map(function (x) { return [x.id, x.f, x.l, x.fr, x.lr, x.zero]; }), s.appetite.mc.n, s.appetite.mc.seed]).length + ':' + hash(JSON.stringify(inp.map(function (x) { return [x.f, x.l, x.fr, x.lr, x.zero]; }))); }
  function hash(str) { var h = 0; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return h; }

  /* ------------------------------------------------------------------
   * Simulation
   * ---------------------------------------------------------------- */
  function stats(arr, tol, app) {
    var n = arr.length, sorted = Float64Array.from(arr).sort(), sum = 0, zero = 0, over = 0, overA = 0;
    for (var i = 0; i < n; i++) { sum += arr[i]; if (arr[i] === 0) zero++; if (tol !== '' && arr[i] > tol) over++; if (app !== '' && arr[i] > app) overA++; }
    var q = function (p) { return sorted[Math.min(n - 1, Math.floor(p * (n - 1)))]; };
    return { mean: sum / n, p50: q(0.5), p90: q(0.9), p95: q(0.95), p99: q(0.99), max: sorted[n - 1], pZero: zero / n, pOverTol: tol === '' ? null : over / n, pOverApp: app === '' ? null : overA / n, sorted: sorted };
  }
  function simulate() {
    var s = S(), cfg = s.appetite.mc, n = Math.max(500, Math.min(200000, +cfg.n || 10000)), seed = +cfg.seed || 42;
    var inp = inputs();
    var rI = rng32(seed), rR = rng32(seed + 7919);
    var totI = new Float64Array(n), totR = new Float64Array(n), per = inp.map(function () { return { i: 0, r: 0 }; });
    for (var it = 0; it < n; it++) {
      for (var j = 0; j < inp.length; j++) {
        var x = inp[j], k = poisson(rI, pert(rI, x.f)), loss = 0;
        for (var e = 0; e < k; e++) loss += pert(rI, x.l);
        totI[it] += loss; per[j].i += loss;
        if (!x.zero) {
          var kr = poisson(rR, pert(rR, x.fr)), lr = 0;
          for (var e2 = 0; e2 < kr; e2++) lr += pert(rR, x.lr);
          totR[it] += lr; per[j].r += lr;
        }
      }
    }
    var tol = s.appetite.lossTolerance === '' ? '' : +s.appetite.lossTolerance, app = s.appetite.lossAppetite === '' ? '' : +s.appetite.lossAppetite;
    var si = stats(totI, tol, app), sr = stats(totR, tol, app);
    // Verlustüberschreitungskurve: 60 Punkte, logarithmisch verteilt
    var top = Math.max(si.p99, sr.p99, 1) * 1.2, lo = Math.max(100, Math.min(si.p50 || top / 1000, sr.p50 || top / 1000) / 5), lec = [];
    var exceed = function (sorted, x) { var a = 0, b = sorted.length; while (a < b) { var m = (a + b) >> 1; if (sorted[m] <= x) a = m + 1; else b = m; } return (sorted.length - a) / sorted.length; };
    for (var p = 0; p < 60; p++) { var xv = lo * Math.pow(top / lo, p / 59); lec.push([Math.round(xv), +exceed(si.sorted, xv).toFixed(4), +exceed(sr.sorted, xv).toFixed(4)]); }
    // Histogramm: 30 Klassen von 0 bis P99 (brutto)
    var bins = 30, hmax = Math.max(si.p99, 1), hist = [];
    for (var b = 0; b < bins; b++) hist.push([0, 0]);
    for (var z = 0; z < n; z++) { hist[Math.min(bins - 1, Math.floor(totI[z] / hmax * bins))][0]++; hist[Math.min(bins - 1, Math.floor(totR[z] / hmax * bins))][1]++; }
    var strip = function (o) { var c = Object.assign({}, o); delete c.sorted; Object.keys(c).forEach(function (k) { if (typeof c[k] === 'number') c[k] = Math.round(c[k] * 10000) / 10000; }); return c; };
    var totMeanI = si.mean || 1;
    var perRisk = inp.map(function (x, j) { return { id: x.id, title: x.title, src: x.src, mi: per[j].i / n, mr: per[j].r / n, share: per[j].i / n / totMeanI, how: x.how }; })
      .sort(function (a, b) { return b.mi - a.mi; });
    s.mc = { date: new Date().toISOString(), n: n, seed: seed, count: inp.length, fp: fingerprint(inp), tol: tol, app: app, inh: strip(si), res: strip(sr), lec: lec, hist: { max: hmax, bins: hist.map(function (h) { return [h[0] / n, h[1] / n]; }) }, per: perRisk.slice(0, 25) };
    A.save();
  }

  /* ------------------------------------------------------------------
   * Diagramme (SVG, inline – funktioniert auch im Bericht)
   * ---------------------------------------------------------------- */
  var C_I = '#f0952a', C_R = '#1f6feb', C_T = '#c62828', C_A = '#1a7f37';
  function kfmt(v) {
    if (v >= 1e6) return K.num(v / 1e6, 1) + ' Mio';
    if (v >= 1e3) return K.num(v / 1e3, 0) + ' T';
    return K.num(v, 0);
  }
  /** Verlustüberschreitungskurve (x logarithmisch). */
  function lecSvg(mc, w, hgt) {
    w = w || 640; hgt = hgt || 260;
    var pl = 46, pr = 12, pt = 12, pb = 34, W = w - pl - pr, H = hgt - pt - pb, pts = mc.lec;
    if (!pts || !pts.length) return '';
    var x0 = Math.log(pts[0][0]), x1 = Math.log(pts[pts.length - 1][0]);
    var X = function (v) { return pl + (Math.log(Math.max(v, pts[0][0])) - x0) / (x1 - x0) * W; }, Y = function (p) { return pt + (1 - p) * H; };
    var g = ['<svg viewBox="0 0 ' + w + ' ' + hgt + '" width="100%" style="max-width:' + w + 'px;font-family:inherit;font-size:10px" role="img" aria-label="' + esc(L('Verlustüberschreitungskurve', 'Loss exceedance curve')) + '">'];
    for (var k = 0; k <= 4; k++) { var yy = Y(k / 4); g.push('<line x1="' + pl + '" x2="' + (pl + W) + '" y1="' + yy + '" y2="' + yy + '" stroke="#8884" stroke-width="1"/><text x="' + (pl - 4) + '" y="' + (yy + 3) + '" text-anchor="end" fill="currentColor">' + (k * 25) + ' %</text>'); }
    var dec = Math.ceil(Math.log10(pts[0][0])), decEnd = Math.floor(Math.log10(pts[pts.length - 1][0]));
    for (var d = dec; d <= decEnd; d++) { [1, 2, 5].forEach(function (m) { var v = m * Math.pow(10, d); if (v < pts[0][0] || v > pts[pts.length - 1][0]) return; var xx = X(v);
      g.push('<line x1="' + xx + '" x2="' + xx + '" y1="' + pt + '" y2="' + (pt + H) + '" stroke="#8883" stroke-width="1"/>' + (m === 1 || m === 5 ? '<text x="' + xx + '" y="' + (pt + H + 13) + '" text-anchor="middle" fill="currentColor">' + kfmt(v) + '</text>' : '')); }); }
    var path = function (idx) { return pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Y(p[idx]).toFixed(1); }).join(''); };
    g.push('<path d="' + path(1) + '" fill="none" stroke="' + C_I + '" stroke-width="2.5"/><path d="' + path(2) + '" fill="none" stroke="' + C_R + '" stroke-width="2.5"/>');
    var vline = function (v, col, lab) { if (v === '' || v === null || v === undefined || v < pts[0][0] || v > pts[pts.length - 1][0]) return ''; var xx = X(v);
      return '<line x1="' + xx + '" x2="' + xx + '" y1="' + pt + '" y2="' + (pt + H) + '" stroke="' + col + '" stroke-width="1.5" stroke-dasharray="5 3"/><text x="' + (xx + 3) + '" y="' + (pt + 10) + '" fill="' + col + '">' + esc(lab) + '</text>'; };
    g.push(vline(mc.tol, C_T, L('Toleranz', 'Tolerance')), vline(mc.app, C_A, L('Appetit', 'Appetite')));
    g.push('<text x="' + (pl + W / 2) + '" y="' + (hgt - 4) + '" text-anchor="middle" fill="currentColor" font-weight="600">' + esc(L('Jahresverlust in € (log. Skala)', 'Annual loss in € (log scale)')) + '</text></svg>');
    return g.join('');
  }
  function histSvg(mc, w, hgt) {
    w = w || 640; hgt = hgt || 220;
    var pl = 46, pr = 12, pt = 10, pb = 34, W = w - pl - pr, H = hgt - pt - pb, bins = mc.hist.bins, n = bins.length;
    var mx = Math.max.apply(null, bins.map(function (b) { return Math.max(b[0], b[1]); })) || 1, bw = W / n;
    var g = ['<svg viewBox="0 0 ' + w + ' ' + hgt + '" width="100%" style="max-width:' + w + 'px;font-family:inherit;font-size:10px" role="img" aria-label="' + esc(L('Histogramm Jahresverlust', 'Annual loss histogram')) + '">'];
    for (var k = 0; k <= 4; k++) { var yy = pt + H - k / 4 * H; g.push('<line x1="' + pl + '" x2="' + (pl + W) + '" y1="' + yy + '" y2="' + yy + '" stroke="#8884"/><text x="' + (pl - 4) + '" y="' + (yy + 3) + '" text-anchor="end" fill="currentColor">' + K.num(mx * k / 4 * 100, 0) + ' %</text>'); }
    bins.forEach(function (b, i) {
      var x = pl + i * bw, hi = b[0] / mx * H, hr = b[1] / mx * H;
      g.push('<rect x="' + (x + 1).toFixed(1) + '" y="' + (pt + H - hi).toFixed(1) + '" width="' + (bw / 2 - 1).toFixed(1) + '" height="' + hi.toFixed(1) + '" fill="' + C_I + '"/>' +
        '<rect x="' + (x + bw / 2).toFixed(1) + '" y="' + (pt + H - hr).toFixed(1) + '" width="' + (bw / 2 - 1).toFixed(1) + '" height="' + hr.toFixed(1) + '" fill="' + C_R + '"/>');
    });
    for (var q = 0; q <= 5; q++) { var xv = pl + q / 5 * W; g.push('<text x="' + xv + '" y="' + (pt + H + 13) + '" text-anchor="middle" fill="currentColor">' + kfmt(mc.hist.max * q / 5) + (q === 5 ? '+' : '') + '</text>'); }
    g.push('<text x="' + (pl + W / 2) + '" y="' + (hgt - 4) + '" text-anchor="middle" fill="currentColor" font-weight="600">' + esc(L('Jahresverlust in € (bis P99 brutto)', 'Annual loss in € (up to gross P99)')) + '</text></svg>');
    return g.join('');
  }
  function legend() {
    var i = function (c) { return '<i style="display:inline-block;width:12px;height:12px;border-radius:2px;background:' + c + ';vertical-align:middle;margin-right:4px"></i>'; };
    return '<div class="legend small"><span>' + i(C_I) + esc(L('brutto (vor Maßnahmen)', 'gross (before measures)')) + '</span><span>' + i(C_R) + esc(L('netto (nach Maßnahmen)', 'net (after measures)')) + '</span></div>';
  }

  /* ------------------------------------------------------------------
   * Ansicht (Tab im Risikoregister)
   * ---------------------------------------------------------------- */
  function pct(v) { return v === null || v === undefined ? '–' : K.num(v * 100, 1) + ' %'; }
  function view() {
    var s = S(), ap = s.appetite, cfg = ap.mc, mc = s.mc, h = [];
    var inp = inputs();
    h.push('<div class="note">' + esc(L('Die Monte-Carlo-Simulation würfelt viele tausend mögliche Jahre aus: je Risiko zufällige Ereignisanzahl (Poisson) und zufällige Schadenshöhe (PERT-Verteilung der Dreipunktschätzung). So entsteht eine Verteilung des Jahresverlusts – statt eines einzelnen Punktwerts. Alle Berechnungen laufen lokal im Browser.',
      'The Monte Carlo simulation samples many thousand possible years: per risk a random number of events (Poisson) and a random loss (PERT distribution of the three-point estimate). The result is a distribution of the annual loss instead of a single point value. All calculations run locally in the browser.')) + '</div>');
    h.push('<div class="card"><h2>' + esc(L('Simulation', 'Simulation')) + '</h2><div class="grid grid-4">' +
      '<div class="field"><label>' + esc(L('Iterationen (Jahre)', 'Iterations (years)')) + '</label><select data-act="mcCfg" data-k="n">' + [1000, 5000, 10000, 25000, 50000, 100000].map(function (v) { return A.opt(v, K.num(v, 0), cfg.n); }).join('') + '</select></div>' +
      '<div class="field"><label>' + esc(L('Startwert (Seed)', 'Seed')) + '</label><input type="number" data-field="mcCfg" data-k="seed" value="' + esc(cfg.seed) + '"><div class="small muted">' + esc(L('gleicher Seed = gleiches Ergebnis', 'same seed = same result')) + '</div></div>' +
      '<div class="field"><label>' + esc(L('Standard-Wirksamkeit von Maßnahmen (%)', 'Default effectiveness of measures (%)')) + '</label><input type="number" min="0" max="100" data-field="mcCfg" data-k="red" value="' + esc(cfg.red) + '"><div class="small muted">' +
      esc(L('wenn keine Netto-Bewertung vorliegt: „reduzieren“ senkt die Häufigkeit, „übertragen“ den Schaden, „vermeiden“ entfernt das Risiko', 'without a net rating: "reduce" lowers frequency, "transfer" lowers loss, "avoid" removes the risk')) + '</div></div>' +
      '<div class="field"><label>' + esc(L('Einbezogene Risiken', 'Included risks')) + '</label><div class="checks">' +
      [['inclCustom', ['eigene Risiken', 'own risks']], ['inclFindings', ['Befundrisiken je Asset (kalibriert)', 'finding risks per asset (calibrated)']], ['inclProject', ['Projektrisiken (kalibriert)', 'project risks (calibrated)']]].map(function (x) {
        return '<label><input type="checkbox" data-act="mcCfg" data-k="' + x[0] + '"' + (cfg[x[0]] ? ' checked' : '') + '> ' + esc(K.lab(x[1])) + '</label>'; }).join('') + '</div></div></div>' +
      '<div class="row" style="margin-top:.6rem">' + K.btn('mcRun', running ? L('läuft …', 'running …') : '▶ ' + L('Simulation starten', 'Run simulation'), { cls: 'btn-primary', disabled: running || !inp.length }) +
      '<span class="small muted">' + esc(L(inp.length + ' Risiken als Eingabe', inp.length + ' risks as input')) + (ap.lossTolerance !== '' ? ' · ' + esc(L('Verlusttoleranz', 'loss tolerance')) + ' ' + K.money(ap.lossTolerance) : '') + (ap.lossAppetite !== '' ? ' · ' + esc(L('Verlustappetit', 'loss appetite')) + ' ' + K.money(ap.lossAppetite) : '') + '</span></div></div>');
    if (mc) h.push(results(mc, mc.fp !== fingerprint(inp)));
    else h.push('<div class="card muted">' + esc(inp.length ? L('Noch keine Simulation durchgeführt.', 'No simulation run yet.') : L('Keine Eingaben: eigene Risiken anlegen oder Befund-/Projektrisiken einbeziehen.', 'No inputs: add own risks or include finding/project risks.')) + '</div>');
    // Kalibrierung
    var c = ap.calib;
    var row = function (g, idx, label) { return '<tr><td><b>' + esc(label) + '</b> <span class="muted">(' + (idx + 1) + ')</span></td>' + [0, 1, 2].map(function (j) { return '<td><input type="number" min="0" step="any" data-field="mcCal" data-g="' + g + '" data-i="' + idx + '" data-j="' + j + '" value="' + esc(c[g][idx][j]) + '"></td>'; }).join('') + '</tr>'; };
    h.push('<details class="card"><summary><b>' + esc(L('Kalibrierung: qualitative Stufen → Zahlen', 'Calibration: qualitative levels → numbers')) + '</b></summary><p class="small muted">' + esc(L('Wird verwendet, wenn ein Risiko keine eigene Dreipunktschätzung hat. Passen Sie die Bandbreiten an die Größe Ihrer Organisation an.', 'Used when a risk has no own three-point estimate. Adjust the ranges to the size of your organisation.')) + '</p>' +
      '<div class="grid grid-2"><div>' + K.table([L('Eintrittshäufigkeit', 'Frequency'), L('min /Jahr', 'min /yr'), L('wahrsch.', 'likely'), L('max /Jahr', 'max /yr')], [1, 2, 3, 4].map(function (k) { return row('f', k - 1, t('risk.p' + k).replace(/­/g, '')); })) + '</div><div>' +
      K.table([L('Schadenshöhe', 'Impact'), L('min €', 'min €'), L('wahrsch. €', 'likely €'), L('max €', 'max €')], [1, 2, 3, 4].map(function (k) { return row('l', k - 1, t('risk.i' + k).replace(/­/g, '')); })) + '</div></div>' +
      '<div class="row"><span class="small">' + esc(L('Vorlage nach Organisationsgröße:', 'Template by organisation size:')) + '</span>' + Object.keys(PRESETS).map(function (k) {
        return K.btn('mcCalReset', K.lab(PRESETS[k].n), { id: k, cls: 'btn-sm' + (c.preset === k ? ' btn-primary' : '') }); }).join('') + '</div></details>');
    // Eingaben
    if (inp.length) h.push('<details class="card"><summary><b>' + esc(L('Eingabewerte je Risiko', 'Input values per risk')) + '</b> <span class="muted small">(' + inp.length + ')</span></summary>' +
      K.table(['ID', { l: ['Risiko', 'Risk'], w: 200 }, L('Ereignisse/Jahr brutto', 'Events/yr gross'), L('Schaden/Ereignis brutto', 'Loss/event gross'), L('Netto-Annahme', 'Net assumption'), L('Quelle', 'Source')], inp.map(function (x) {
        var tri = function (a, m) { return a.map(function (v) { return m ? kfmt(v) : K.num(v, 2); }).join(' / '); };
        return '<tr><td class="mono">' + esc(x.id) + '</td><td class="small">' + esc(K.clip(x.title, 90)) + '</td><td class="small nowrap">' + tri(x.f) + '</td><td class="small nowrap">' + tri(x.l, true) + '</td><td class="small">' + esc(x.how) + '</td><td class="small">' + esc(x.est ? L('eigene Schätzung', 'own estimate') : L('Kalibrierung', 'calibration')) + '</td></tr>';
      })) + '</details>');
    return h.join('');
  }
  function results(mc, stale) {
    var h = [], ap = S().appetite;
    var cmp = function (val, lim) { return lim === '' || lim === null || lim === undefined ? '' : val <= lim ? K.amp('ok', '≤ ' + K.money(lim)) : K.amp('bad', '> ' + K.money(lim)); };
    if (stale) h.push('<div class="note warn">' + esc(L('Die Eingaben haben sich seit der letzten Simulation geändert – bitte erneut starten.', 'Inputs changed since the last simulation – please run again.')) + '</div>');
    h.push('<div class="grid grid-4">' +
      K.stat(K.money(mc.res.mean), L('erwarteter Jahresverlust netto (ALE)', 'expected annual loss net (ALE)'), C_R, esc(L('brutto', 'gross')) + ' ' + K.money(mc.inh.mean) + ' ' + cmp(mc.res.mean, mc.app)) +
      K.stat(K.money(mc.res.p90), L('P90 netto (in 9 von 10 Jahren darunter)', 'P90 net (below in 9 of 10 years)'), C_R, esc(L('brutto', 'gross')) + ' ' + K.money(mc.inh.p90) + ' ' + cmp(mc.res.p90, mc.tol)) +
      K.stat(K.money(mc.res.p99), L('P99 netto (1-in-100-Jahr)', 'P99 net (1-in-100 year)'), C_R, esc(L('brutto', 'gross')) + ' ' + K.money(mc.inh.p99)) +
      K.stat(mc.tol === '' ? '–' : pct(mc.res.pOverTol), L('Wahrscheinlichkeit > Verlusttoleranz', 'probability > loss tolerance'), mc.tol === '' ? '' : (mc.res.pOverTol <= 0.1 ? K.AMP.ok : K.AMP.bad), mc.tol === '' ? '<a href="#register" data-act="regTab" data-id="appetite">' + esc(L('Toleranz festlegen', 'set tolerance')) + '</a>' : esc(L('brutto', 'gross')) + ' ' + pct(mc.inh.pOverTol)) + '</div>');
    var red = mc.inh.mean ? 1 - mc.res.mean / mc.inh.mean : 0;
    h.push('<div class="card"><p>' + esc(L('Ergebnis: Mit 90 % Wahrscheinlichkeit liegt der jährliche Schaden nach Umsetzung der Maßnahmen unter ' + K.money(mc.res.p90) + ' (vorher ' + K.money(mc.inh.p90) + '). Die Maßnahmen senken den erwarteten Jahresverlust um ' + K.num(red * 100, 0) + ' %.',
      'Result: with 90 % probability the annual loss after implementing the measures stays below ' + K.money(mc.res.p90) + ' (before ' + K.money(mc.inh.p90) + '). The measures reduce the expected annual loss by ' + K.num(red * 100, 0) + ' %.')) + '</p>' +
      K.table([L('Kennzahl', 'Metric'), { l: ['brutto', 'gross'], cls: 'num' }, { l: ['netto', 'net'], cls: 'num' }], [['mean', ['Erwartungswert (ALE)', 'Mean (ALE)']], ['p50', ['Median (P50)', 'Median (P50)']], ['p90', ['P90', 'P90']], ['p95', ['P95 (VaR 95 %)', 'P95 (VaR 95 %)']], ['p99', ['P99 (VaR 99 %)', 'P99 (VaR 99 %)']], ['max', ['Maximum der Simulation', 'Simulation maximum']]].map(function (k) {
        return '<tr><td>' + esc(K.lab(k[1])) + '</td><td class="num">' + K.money(mc.inh[k[0]]) + '</td><td class="num"><b>' + K.money(mc.res[k[0]]) + '</b></td></tr>'; }).concat(['<tr><td>' + esc(L('Jahr ohne Schaden', 'Year without loss')) + '</td><td class="num">' + pct(mc.inh.pZero) + '</td><td class="num">' + pct(mc.res.pZero) + '</td></tr>'])) +
      '<p class="small muted">' + esc(L(K.num(mc.n, 0) + ' Iterationen · Seed ' + mc.seed + ' · ' + mc.count + ' Risiken · berechnet ' + A.fmtDate(mc.date, true), K.num(mc.n, 0) + ' iterations · seed ' + mc.seed + ' · ' + mc.count + ' risks · computed ' + A.fmtDate(mc.date, true))) + '</p></div>');
    h.push('<div class="grid grid-2"><div class="card"><h2>' + esc(L('Verlustüberschreitungskurve (LEC)', 'Loss exceedance curve (LEC)')) + '</h2>' + lecSvg(mc) + legend() +
      '<p class="small muted">' + esc(L('Lesebeispiel: Der Kurvenwert über einem Betrag ist die Wahrscheinlichkeit, dass der Jahresverlust diesen Betrag übersteigt.', 'How to read: the curve value above an amount is the probability that the annual loss exceeds this amount.')) + '</p></div>' +
      '<div class="card"><h2>' + esc(L('Verteilung des Jahresverlusts', 'Distribution of annual loss')) + '</h2>' + histSvg(mc) + legend() + '</div></div>');
    h.push('<div class="card"><h2>' + esc(L('Beitrag je Risiko (Top 25)', 'Contribution per risk (top 25)')) + '</h2>' + K.table(['ID', { l: ['Risiko', 'Risk'], w: 220 }, { l: ['Ø brutto €/Jahr', 'avg gross €/yr'], cls: 'num' }, { l: ['Ø netto €/Jahr', 'avg net €/yr'], cls: 'num' }, { l: ['Anteil brutto', 'share gross'], cls: 'num' }, L('Netto-Annahme', 'Net assumption')],
      mc.per.map(function (p) {
        return '<tr><td class="mono">' + esc(p.id) + '</td><td class="small">' + esc(K.clip(p.title, 90)) + '</td><td class="num">' + K.money(p.mi) + '</td><td class="num">' + K.money(p.mr) + '</td><td class="num"><div class="bar-track" style="min-width:60px"><div class="bar-fill" style="width:' + Math.min(100, p.share * 100).toFixed(1) + '%;background:' + C_I + '"></div></div>' + K.num(p.share * 100, 1) + ' %</td><td class="small">' + esc(p.how) + '</td></tr>';
      })) + '<p class="small muted">' + esc(L('Hinweis: Modell mit unabhängigen Risiken; Abhängigkeiten (z. B. ein Angriff löst mehrere Risiken aus) erhöhen die Extremwerte. Ergebnisse sind Entscheidungshilfe, keine Prognose.',
      'Note: model with independent risks; dependencies (e.g. one attack triggers several risks) increase extreme values. Results support decisions; they are not a forecast.')) + '</p></div>');
    return h.join('');
  }

  /* ------------------------------------------------------------------
   * Ereignisse
   * ---------------------------------------------------------------- */
  A.ext.click.push(function (act, el) {
    if (act === 'mcRun') {
      if (running) return true;
      running = true; A.render();
      setTimeout(function () {   // kurz Luft holen, damit „läuft …“ sichtbar wird
        var t0 = performance.now();
        try { simulate(); A.toast(L('Simulation abgeschlossen', 'Simulation finished') + ' (' + Math.round(performance.now() - t0) + ' ms)'); }
        catch (e) { A.toast('Monte-Carlo: ' + e.message, true); }
        running = false; A.render();
      }, 30);
      return true;
    }
    if (act === 'mcCalReset') {
      var s = S(), pr = el.getAttribute('data-id') || 'sme';
      s.appetite.calib = { f: JSON.parse(JSON.stringify(FREQ)), l: JSON.parse(JSON.stringify(PRESETS[pr].l)), preset: pr };
      A.save(); A.render(); return true;
    }
  });
  A.ext.change.push(function (act, el) {
    if (act === 'mcCfg') {
      if (el.tagName === 'SELECT' || el.type === 'checkbox') { var cfg = S().appetite.mc; cfg[el.getAttribute('data-k')] = el.type === 'checkbox' ? el.checked : +el.value; A.save(); }
      A.render(); return true;
    }
    if (act === 'mcCal') { A.render(); return true; }
  });
  A.ext.input.push(function (act, el) {
    var s = S();
    if (act === 'mcCfg') { s.appetite.mc[el.getAttribute('data-k')] = +el.value || 0; A.save(); return true; }
    if (act === 'mcCal') { s.appetite.calib[el.getAttribute('data-g')][+el.getAttribute('data-i')][+el.getAttribute('data-j')] = +el.value || 0; s.appetite.calib.preset = 'custom'; A.save(); return true; }
  });

  // Bericht
  A.ext.reportOpts.push({ key: 'mc', label: { de: 'Monte-Carlo-Analyse', en: 'Monte Carlo analysis' } });
  HA.Report.ext.push({ key: 'mc', build: function (state, scope, H) {
    var mc = state.mc; if (!mc) return '';
    var h = ['<section class="pb"><h2>' + H.esc(L('Monte-Carlo-Analyse (quantitativ)', 'Monte Carlo analysis (quantitative)')) + '</h2>'];
    h.push('<p class="small">' + H.esc(L('Simulation von ' + K.num(mc.n, 0) + ' Jahren (Seed ' + mc.seed + ', ' + mc.count + ' Risiken, berechnet am ' + A.fmtDate(mc.date, true) + '). Häufigkeit je Jahr Poisson-verteilt, Schaden je Ereignis PERT-verteilt; Risiken als unabhängig angenommen.',
      'Simulation of ' + K.num(mc.n, 0) + ' years (seed ' + mc.seed + ', ' + mc.count + ' risks, computed ' + A.fmtDate(mc.date, true) + '). Annual frequency Poisson-distributed, loss per event PERT-distributed; risks assumed independent.')) + '</p>');
    h.push('<div class="kpis"><div class="kpi"><b>' + K.money(mc.res.mean) + '</b>' + H.esc(L('ALE netto', 'ALE net')) + ' (' + H.esc(L('brutto', 'gross')) + ' ' + K.money(mc.inh.mean) + ')</div><div class="kpi"><b>' + K.money(mc.res.p90) + '</b>P90 ' + H.esc(L('netto', 'net')) + '</div><div class="kpi"><b>' + K.money(mc.res.p99) + '</b>P99 ' + H.esc(L('netto', 'net')) + '</div>' +
      (mc.tol !== '' ? '<div class="kpi"><b>' + pct(mc.res.pOverTol) + '</b>' + H.esc(L('P(> Toleranz ', 'P(> tolerance ')) + K.money(mc.tol) + ')</div>' : '') + '</div>');
    h.push('<div style="break-inside:avoid;color:#111">' + lecSvg(mc, 640, 230) + '</div>');
    h.push('<table><thead><tr><th>ID</th><th>' + H.esc(L('Risiko', 'Risk')) + '</th><th style="width:26mm">' + H.esc(L('Ø brutto €/J.', 'avg gross €/yr')) + '</th><th style="width:26mm">' + H.esc(L('Ø netto €/J.', 'avg net €/yr')) + '</th><th style="width:16mm">' + H.esc(L('Anteil', 'Share')) + '</th></tr></thead><tbody>' +
      mc.per.slice(0, 15).map(function (p) { return '<tr><td>' + H.esc(p.id) + '</td><td>' + H.esc(p.title) + '</td><td>' + K.money(p.mi) + '</td><td>' + K.money(p.mr) + '</td><td>' + K.num(p.share * 100, 1) + ' %</td></tr>'; }).join('') + '</tbody></table></section>');
    return h.join('');
  } });

  return { view: view, simulate: simulate, inputs: inputs, lecSvg: lecSvg, _pert: pert, _poisson: poisson, _rng: rng32 };
})();

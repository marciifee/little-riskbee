/* =====================================================================
 * modules/posreport.js – Positiv-Bericht (Erfolge für Shareholder,
 * Investoren, Sponsoren, Mitglieder, Kunden, Leitung)
 * ---------------------------------------------------------------------
 *  • Erzeugt automatisch nur positive, belegbare Aussagen aus den Daten
 *    (umgesetzte und wirksame Maßnahmen, behobene Schwachstellen, Re-Tests,
 *    gesenkte Risiken, Monte-Carlo-Schadensreduktion, BCM, Übungen,
 *    fristgerechte Pflichten, verbesserte Kennzahlen …). Aussagen, die
 *    nicht positiv ausfallen, werden weggelassen – nicht geschönt.
 *  • Jede Aussage ist abschaltbar und mit eigenem Text überschreibbar.
 *  • Vorbereitete Textfelder (Vorwort, Highlights, Ausblick, Dank,
 *    Kontakt, Schlusswort) mit Platzhaltern wie {umsetzungsgrad} oder
 *    {befunde_behoben}, die beim Erzeugen mit aktuellen Werten gefüllt
 *    werden; Textvorlagen je Zielgruppe.
 *  • Eigene Highlights und Meilensteine; automatische Meilensteine.
 *  • Datenschutz: Systemnamen, Hostnamen und IP-Adressen werden
 *    standardmäßig nicht genannt (anonymisiert); optionaler Transparenz-
 *    hinweis, dass der vollständige Prüfbericht verfügbar ist.
 *  • Ausgabe: DIN A4 (ausführlich oder Onepager) – drucken, PDF, HTML.
 * Datenmodell: state.posrep = { audience, title, subtitle, from, to, texts{}, overrides{}, off{},
 *   blocks[], milestones[], opts{} }
 * ===================================================================== */
window.HA = window.HA || {};

HA.PosReport = (function () {
  'use strict';
  var A = HA.App, K = HA.Kit, L = K.L, esc = A.esc, t = HA.t;
  var U = { tab: 'texts', lastTa: null };
  K.addI18n({ 'nav.posreport': 'Positiv-Bericht' }, { 'nav.posreport': 'Positive report' });
  function S() { return A.state(); }
  function PR() { return S().posrep; }

  var AUD = {
    investors: ['Investoren & Shareholder', 'Investors & shareholders'], sponsors: ['Sponsoren & Förderer', 'Sponsors & supporters'], members: ['Mitglieder & Community', 'Members & community'],
    customers: ['Kunden & Partner', 'Customers & partners'], board: ['Geschäftsleitung & Aufsichtsgremium', 'Management & supervisory board']
  };
  var THEMES = {
    protect: ['🛡️', ['Schutzmaßnahmen & Härtung', 'Protection & hardening']], vuln: ['🔎', ['Schwachstellen & Tests', 'Vulnerabilities & testing']], risk: ['🎯', ['Risikomanagement', 'Risk management']],
    bcm: ['🏗️', ['Krisenfestigkeit (BCM)', 'Resilience (BCM)']], gov: ['📜', ['Governance & Compliance', 'Governance & compliance']], people: ['🤝', ['Organisation & Menschen', 'Organisation & people']]
  };
  var TEXT_FIELDS = [['intro', ['Vorwort / Einleitung', 'Foreword / introduction']], ['highlights', ['Eigene Highlights (Freitext)', 'Own highlights (free text)']], ['outlook', ['Ausblick', 'Outlook']],
    ['thanks', ['Dank', 'Thanks']], ['contact', ['Kontakt', 'Contact']], ['closing', ['Schlusswort / Unterschrift', 'Closing / signature']]];
  var ICONS = ['⭐', '🏆', '🛡️', '🔒', '✅', '📈', '🚀', '🤝', '🎓', '🌱', '💡', '🧪', '🏗️', '🔎', '📜', '🐝'];

  /* ------------------------------------------------------------------
   * Zielgruppen-Vorlagen (mit Platzhaltern)
   * ---------------------------------------------------------------- */
  function presets(aud) {
    var de = {
      investors: { intro: 'Informationssicherheit schützt den Wert von {org}. Im Berichtszeitraum {zeitraum} haben wir unsere Sicherheits- und Resilienzmaßnahmen konsequent ausgebaut – nach anerkannten Standards wie BSI IT-Grundschutz und mit messbaren Ergebnissen.',
        outlook: 'Im nächsten Zeitraum setzen wir den eingeschlagenen Weg fort: weitere Härtung unserer Systeme, regelmäßige Überprüfungen und der Ausbau unserer Notfallvorsorge. So sichern wir Verfügbarkeit, Vertrauen und Wert nachhaltig.',
        thanks: 'Wir danken unseren Investorinnen und Investoren für das Vertrauen und die Unterstützung, die diese Fortschritte möglich machen.',
        closing: 'Mit freundlichen Grüßen\n\n{org}' },
      sponsors: { intro: 'Dank Ihrer Unterstützung konnte {org} im Zeitraum {zeitraum} die Sicherheit seiner IT spürbar verbessern. Auf den folgenden Seiten zeigen wir, was mit Ihrer Förderung erreicht wurde.',
        outlook: 'Auch im kommenden Jahr wollen wir unsere Systeme weiter absichern, unsere Notfallvorsorge stärken und unser Wissen teilen.',
        thanks: 'Ein herzliches Dankeschön an alle Sponsorinnen, Sponsoren und Förderer – ohne Sie wären diese Erfolge nicht möglich gewesen!',
        closing: 'Herzliche Grüße\n\n{org}' },
      members: { intro: 'Liebe Mitglieder, im Zeitraum {zeitraum} haben wir viel für die Sicherheit unserer gemeinsamen IT getan. Hier ein Überblick über das Erreichte.',
        outlook: 'Wir bleiben dran: Updates, Backups und Übungen gehören fest zu unserem Alltag. Ideen und Unterstützung sind jederzeit willkommen!',
        thanks: 'Danke an alle, die mitgeholfen haben – ehrenamtlich und mit viel Engagement.',
        closing: 'Viele Grüße\n\nder Vorstand von {org}' },
      customers: { intro: 'Ihre Daten sind bei {org} in guten Händen. Im Zeitraum {zeitraum} haben wir unsere Schutzmaßnahmen weiter verstärkt und regelmäßig überprüft.',
        outlook: 'Wir verbessern kontinuierlich: Sicherheit und Datenschutz sind für uns ein fortlaufender Prozess nach dem PDCA-Prinzip.',
        thanks: 'Vielen Dank für Ihr Vertrauen in unsere Zusammenarbeit.',
        closing: 'Freundliche Grüße\n\n{org}' },
      board: { intro: 'Dieser Bericht fasst die Fortschritte der Informationssicherheit und des Business Continuity Managements von {org} im Zeitraum {zeitraum} zusammen.',
        outlook: 'Für den nächsten Zyklus sind die weitere Umsetzung der Roadmap, die Überprüfung der Risikobewertung und die Durchführung der geplanten Übungen vorgesehen.',
        thanks: 'Wir danken der Leitung für die Unterstützung und allen Beteiligten für ihren Einsatz.',
        closing: '{org}' }
    };
    var en = {
      investors: { intro: 'Information security protects the value of {org}. During {zeitraum} we consistently expanded our security and resilience measures – following recognised standards and with measurable results.', outlook: 'We will continue on this path: further hardening, regular reviews and stronger contingency planning.', thanks: 'We thank our investors for their trust and support.', closing: 'Kind regards\n\n{org}' },
      sponsors: { intro: 'Thanks to your support, {org} noticeably improved its IT security during {zeitraum}.', outlook: 'Next year we want to secure our systems further and strengthen our contingency planning.', thanks: 'A big thank you to all sponsors and supporters!', closing: 'Best regards\n\n{org}' },
      members: { intro: 'Dear members, during {zeitraum} we did a lot for the security of our shared IT.', outlook: 'We keep going: updates, backups and exercises are part of our routine.', thanks: 'Thanks to everyone who helped.', closing: 'Best regards\n\nthe board of {org}' },
      customers: { intro: 'Your data is in good hands at {org}. During {zeitraum} we further strengthened and regularly reviewed our safeguards.', outlook: 'We improve continuously following the PDCA principle.', thanks: 'Thank you for your trust.', closing: 'Kind regards\n\n{org}' },
      board: { intro: 'This report summarises the progress of information security and BCM at {org} during {zeitraum}.', outlook: 'Next cycle: roadmap implementation, risk assessment review and planned exercises.', thanks: 'We thank management for its support.', closing: '{org}' }
    };
    return (HA.lang === 'en' ? en : de)[aud] || de.investors;
  }

  A.ext.normalize.push(function (s) {
    var p = s.posrep = s.posrep || {};
    p.audience = p.audience || 'investors'; p.title = p.title || ''; p.subtitle = p.subtitle || '';
    p.to = p.to || ''; p.from = p.from || '';
    p.texts = Object.assign({ intro: '', highlights: '', outlook: '', thanks: '', contact: '', closing: '' }, p.texts || {});
    p.overrides = p.overrides || {}; p.off = p.off || {};
    if (!Array.isArray(p.blocks)) p.blocks = []; if (!Array.isArray(p.milestones)) p.milestones = [];
    p.opts = Object.assign({ anonymize: true, transparency: true, charts: true, onePager: false, autoMilestones: true, maxFacts: 24 }, p.opts || {});
  });
  function period() { var p = PR(), to = p.to || K.today(), from = p.from || K.addMonths(to, -12); return { from: from, to: to }; }
  function inP(d, per) { if (!d) return false; d = String(d).slice(0, 10); return d >= per.from && d <= per.to; }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }

  /* ------------------------------------------------------------------
   * Automatische, positive Aussagen
   * Jede Aussage: { key, theme, icon, value, unit, text, weight }
   * ---------------------------------------------------------------- */
  function facts() {
    var s = S(), per = period(), F = [], vars = {};
    function add(key, theme, value, unit, text, weight, icon) { F.push({ key: key, theme: theme, value: value, unit: unit, text: text, weight: weight || 5, icon: icon || THEMES[theme][0] }); }
    // Härtung
    var tot = { applicable: 0, done: 0, partial: 0, verified: 0 }, sysHard = 0, donePeriod = 0, libs = {};
    s.assets.forEach(function (a) {
      var st = A.assetStats(a); ['applicable', 'done', 'partial', 'verified'].forEach(function (k) { tot[k] += st[k] || 0; });
      if (st.done > 0) sysHard++;
      (a.libs || []).forEach(function (l) { libs[l] = 1; });
      Object.keys(a.checks || {}).forEach(function (k) { var c = a.checks[k]; if (c.status === 'done' && inP(c.updated, per)) donePeriod++; });
    });
    var rate = pct(tot.done + tot.partial * 0.5, tot.applicable);
    vars.umsetzungsgrad = rate + ' %'; vars.massnahmen_umgesetzt = tot.done; vars.massnahmen_wirksam = tot.verified; vars.systeme = sysHard;
    if (tot.done > 0) {
      if (rate >= 50) add('impl', 'protect', rate + ' %', L('umgesetzt', 'implemented'), L(rate + ' % der anwendbaren Sicherheitsmaßnahmen sind umgesetzt (' + tot.done + ' Maßnahmen).', rate + ' % of applicable security measures are implemented (' + tot.done + ' measures).'), 10);
      else add('impl', 'protect', tot.done, L('Maßnahmen', 'measures'), L(tot.done + ' Sicherheitsmaßnahmen sind bereits umgesetzt.', tot.done + ' security measures are already implemented.'), 9);
    }
    if (donePeriod > 0) add('donePeriod', 'protect', donePeriod, L('neu umgesetzt', 'newly implemented'), L(donePeriod + ' Maßnahmen wurden im Berichtszeitraum neu umgesetzt.', donePeriod + ' measures were newly implemented in the reporting period.'), 8, '🚀');
    if (tot.verified > 0) add('verified', 'protect', tot.verified, L('wirksam geprüft', 'verified effective'), L(tot.verified + ' Maßnahmen wurden überprüft und als wirksam bestätigt.', tot.verified + ' measures were reviewed and confirmed effective.'), 8, '✅');
    if (sysHard > 0) add('systems', 'protect', sysHard, L('Systeme gehärtet', 'systems hardened'), L(sysHard + (sysHard === 1 ? ' System wurde' : ' Systeme wurden') + ' systematisch nach anerkannten Sicherheitsvorgaben gehärtet.', sysHard + ' system(s) were systematically hardened to recognised security baselines.'), 7, '🖥️');
    var libNames = Object.keys(libs).map(function (l) { var x = A.getLib(l); return x ? x.short : l; }).filter(function (x) { return x && x !== 'custom'; });
    if (libNames.length) add('libs', 'gov', libNames.length, L('Regelwerke', 'frameworks'), L('Unsere Maßnahmen orientieren sich an anerkannten Regelwerken: ' + libNames.join(', ') + '.', 'Our measures follow recognised frameworks: ' + libNames.join(', ') + '.'), 6, '📚');
    // Schwachstellen
    var scansP = 0, fixed = 0, fixedP = 0, critOpen = 0, anyScan = false;
    s.assets.forEach(function (a) {
      (a.scans || []).forEach(function (sc) { anyScan = true; if (inP(sc.scanDate || sc.importedAt, per)) scansP++; (sc.findings || []).forEach(function (f) { if (f.status === 'fixed') { fixed++; if (inP(f.statusDate, per)) fixedP++; } }); });
      HA.Risk.latestScans(a).forEach(function (sc) { if (sc.tool === 'nmap') return; (sc.findings || []).forEach(function (f) { if ((f.severity === 'critical' || f.severity === 'high') && ['open', 'partial', undefined].indexOf(f.status) >= 0) critOpen++; }); });
    });
    vars.befunde_behoben = fixedP || fixed; vars.scans = scansP;
    if (scansP > 0) add('scans', 'vuln', scansP, L('Scans', 'scans'), L(scansP + ' automatisierte Schwachstellenscans wurden im Berichtszeitraum durchgeführt.', scansP + ' automated vulnerability scans were carried out in the period.'), 6);
    if (fixedP > 0) add('fixed', 'vuln', fixedP, L('behoben', 'fixed'), L(fixedP === 1 ? 'Eine gefundene Schwachstelle wurde im Berichtszeitraum behoben.' : fixedP + ' gefundene Schwachstellen wurden im Berichtszeitraum behoben.', fixedP + ' identified vulnerabilities were fixed in the period.'), 9, '🔧');
    else if (fixed > 0) add('fixed', 'vuln', fixed, L('behoben', 'fixed'), L(fixed + ' gefundene Schwachstellen wurden behoben.', fixed + ' identified vulnerabilities were fixed.'), 8, '🔧');
    if (anyScan && critOpen === 0) add('noCrit', 'vuln', '0', L('kritisch offen', 'critical open'), L('In den aktuellen Scans sind keine kritischen oder hohen Schwachstellen offen.', 'No critical or high vulnerabilities are open in the latest scans.'), 10, '🏅');
    var pt = s.pentest || { findings: [], project: {} }, ptFixed = pt.findings.filter(function (f) { return f.retestStatus === 'fixed'; }).length;
    vars.pentest_behoben = ptFixed;
    if (pt.findings.length || pt.project.from) add('pentest', 'vuln', '✓', L('Pentest', 'pentest'), L('Ein Penetrationstest hat unsere Systeme aus Angreifersicht geprüft' + (pt.project.to ? ' (abgeschlossen ' + K.fmt(pt.project.to) + ')' : '') + '.', 'A penetration test examined our systems from an attacker\'s perspective.'), 7, '🕵️');
    if (ptFixed > 0) add('ptFixed', 'vuln', ptFixed, L('Re-Test bestanden', 'retest passed'), L(ptFixed + ' Erkenntnisse aus dem Penetrationstest sind behoben – per Re-Test bestätigt.', ptFixed + ' penetration test findings are fixed – confirmed by retest.'), 9, '🧪');
    // Risiko
    var rows = HA.Register ? HA.Register.rows({}) : [];
    vars.risiken = rows.length;
    if (rows.length) {
      var own = rows.filter(function (x) { return x.owner; }).length;
      add('risks', 'risk', rows.length, L('Risiken gesteuert', 'risks managed'), own / rows.length >= 0.8 ? L(rows.length + ' Risiken sind erfasst, bewertet und klaren Verantwortlichen zugeordnet.', rows.length + ' risks are recorded, assessed and assigned to clear owners.') : L(rows.length + ' Risiken sind systematisch erfasst und bewertet.', rows.length + ' risks are systematically recorded and assessed.'), 6);
    }
    var reduced = (s.register ? s.register.items : []).filter(function (r) { return r.rp && r.ri && HA.Register.RANK[HA.Register.customRes(r)] < HA.Register.RANK[HA.Register.customCat(r)]; }).length;
    vars.risiken_gesenkt = reduced;
    if (reduced > 0) add('reduced', 'risk', reduced, L('Risiken gesenkt', 'risks reduced'), L(reduced === 1 ? 'Ein Risiko wurde durch Maßnahmen um mindestens eine Stufe gesenkt.' : reduced + ' Risiken wurden durch Maßnahmen um mindestens eine Stufe gesenkt.', reduced + ' risks were reduced by at least one level through measures.'), 8, '📉');
    if (s.appetite && s.appetite.approvedDate) add('appetite', 'gov', '✓', L('Risikoappetit', 'risk appetite'), L('Die Leitung hat den Risikoappetit festgelegt und freigegeben – Entscheidungen folgen klaren Leitplanken.', 'Management has set and approved the risk appetite – decisions follow clear guardrails.'), 6, '🧭');
    if (s.mc && s.mc.inh.mean > 0) {
      var red = 1 - s.mc.res.mean / s.mc.inh.mean;
      vars.schaden_reduktion = Math.round(red * 100) + ' %';
      if (red >= 0.05) add('mc', 'risk', Math.round(red * 100) + ' %', L('weniger erwarteter Schaden', 'less expected loss'), L('Das Maßnahmenpaket senkt den erwarteten jährlichen Schaden um rund ' + Math.round(red * 100) + ' % (ca. ' + K.money(s.mc.inh.mean - s.mc.res.mean) + ' pro Jahr, Monte-Carlo-Simulation).', 'The measure package reduces the expected annual loss by about ' + Math.round(red * 100) + ' % (approx. ' + K.money(s.mc.inh.mean - s.mc.res.mean) + ' per year, Monte Carlo simulation).'), 9, '💶');
    }
    var trees = s.trees ? s.trees.items.length : 0;
    if (trees) add('trees', 'risk', trees, L('Szenarien analysiert', 'scenarios analysed'), L(trees === 1 ? 'Ein kritisches Ausfall- bzw. Angriffsszenario wurde mit einem Risikobaum analysiert.' : trees + ' kritische Ausfall- und Angriffsszenarien wurden mit Risikobäumen analysiert.', trees + ' critical outage and attack scenarios were analysed with risk trees.'), 5, '🌳');
    // BCM
    if (HA.BCM) {
      var m = HA.BCM.metrics(), b = s.bcm;
      vars.prozesse = m.processes; vars.bc_plaene = m.plans;
      if (m.processes) add('bia', 'bcm', m.processes, L('Prozesse analysiert', 'processes analysed'), L(m.processes + ' Geschäftsprozesse wurden in einer Business-Impact-Analyse (BSI 200-4) bewertet.', m.processes + ' business processes were assessed in a business impact analysis (BSI 200-4).'), 6);
      if (m.plans) add('plans', 'bcm', m.plans, L('Notfallpläne', 'contingency plans'), m.critical && m.critWithPlan === m.critical ? L(m.plans + ' Notfall- und Wiederanlaufpläne liegen vor – alle zeitkritischen Prozesse sind abgedeckt.', m.plans + ' contingency plans exist – all time-critical processes are covered.') : L(m.plans + ' Notfall- und Wiederanlaufpläne wurden erstellt.', m.plans + ' contingency plans were created.'), 7, '📘');
      var exP = b.exercises.filter(function (e) { return (e.status === 'done' || e.status === 'evaluated') && inP(e.date, per); }), exOk = exP.filter(function (e) { return e.result === 'ok' || e.result === 'partial'; }).length;
      vars.uebungen = exP.length;
      if (exP.length) add('exercises', 'bcm', exP.length, L('Übungen', 'exercises'), L((exP.length === 1 ? 'Eine Notfallübung wurde durchgeführt' : exP.length + ' Notfallübungen wurden durchgeführt') + (exOk ? ', davon ' + exOk + ' erfolgreich bzw. teilweise erfolgreich' : '') + '.', exP.length + ' exercises were conducted' + (exOk ? ', ' + exOk + ' of them (partially) successful' : '') + '.'), 7, '🧯');
      if (m.proven) add('proven', 'bcm', m.proven, L('Wiederanlauf nachgewiesen', 'recovery proven'), L('Der Wiederanlauf innerhalb der Zielzeit wurde für ' + (m.proven === 1 ? 'einen Notfallplan' : m.proven + ' Notfallpläne') + ' praktisch nachgewiesen.', 'Recovery within the target time was proven in practice for ' + m.proven + ' plan(s).'), 8, '⏱️');
      if (m.roles) add('crisis', 'bcm', m.roles, L('Krisenstab-Rollen', 'crisis roles'), m.rolesFull === m.roles ? L('Ein Krisenstab mit ' + m.roles + ' Rollen ist eingerichtet – jede Rolle mit Vertretung.', 'A crisis team with ' + m.roles + ' roles is in place – each role with a deputy.') : L('Ein Krisenstab mit ' + m.roles + ' Rollen ist eingerichtet.', 'A crisis team with ' + m.roles + ' roles is in place.'), 6, '🚨');
    }
    // Compliance & Organisation
    var dutyDone = 0, ontime = 0, training = 0, groups = {};
    (s.duties || []).forEach(function (d) {
      (d.history || []).forEach(function (h) { if (inP(h.date, per)) { dutyDone++; if (!h.due || h.date <= h.due) ontime++; if (d.cat === 'training') training++; } });
      var tp = HA.Cal && d.tpl ? HA.Cal.TEMPLATES.find(function (x) { return x.id === d.tpl; }) : null; if (tp) groups[tp.g] = 1;
    });
    vars.pflichten_erledigt = dutyDone;
    if (ontime > 0) add('duties', 'gov', ontime, L('fristgerecht', 'on time'), L(ontime + ' Pflicht-Reviews, Audits und Prüfungen wurden fristgerecht erledigt.', ontime + ' mandatory reviews, audits and checks were completed on time.'), 7, '📅');
    var gl = Object.keys(groups);
    if (gl.length) add('norms', 'gov', gl.length, L('Normbereiche', 'standards'), L('Pflichten aus ' + gl.join(', ') + ' sind im Compliance-Kalender verankert und werden regelmäßig erinnert.', 'Duties from ' + gl.join(', ') + ' are anchored in the compliance calendar with reminders.'), 6);
    if (training > 0) add('training', 'people', training, L('Schulungen', 'trainings'), L(training + ' Schulungs- und Sensibilisierungsmaßnahmen wurden durchgeführt.', training + ' training and awareness activities were held.'), 7, '🎓');
    var tom = HA.Risk.tomSummary(s), tomDone = tom.rows.reduce(function (a, r) { return a + r.done; }, 0);
    if (tomDone > 0) add('tom', 'gov', tomDone, 'TOM', L(tomDone + ' technische und organisatorische Maßnahmen nach Art. 32 DSGVO sind umgesetzt.', tomDone + ' technical and organisational measures under Art. 32 GDPR are implemented.'), 6, '🔒');
    if ((s.contacts || []).length) add('contacts', 'people', s.contacts.length, L('Ansprechpersonen', 'contacts'), L('Klare Zuständigkeiten: ' + s.contacts.length + ' Ansprechpersonen sind benannt.', 'Clear responsibilities: ' + s.contacts.length + ' contacts are named.'), 4, '👥');
    // Kennzahlen: im Ziel und Verbesserungen
    if (HA.KPI) {
      var kp = HA.KPI.all().filter(function (k) { return !k.tg.off && k.v !== null; }), ok = kp.filter(function (k) { return k.lv === 'ok'; }).length;
      vars.kpi_im_ziel = ok;
      if (ok > 0) add('kpiOk', 'gov', ok + ' / ' + kp.length, L('KPIs im Ziel', 'KPIs on target'), L(ok + ' von ' + kp.length + ' Kennzahlen liegen im Zielbereich.', ok + ' of ' + kp.length + ' KPIs are on target.'), 6, '📈');
      var snaps = s.kpi.snapshots.filter(function (x) { return x.date <= per.to; }), base = snaps.filter(function (x) { return x.date <= per.from; }).pop() || snaps[0];
      if (base) kp.forEach(function (k) {
        if (k.custom || base.values[k.id] === undefined || k.v === null) return;
        var b0 = base.values[k.id], better = k.dir === 'up' ? k.v > b0 : k.v < b0;
        if (!better || Math.abs(k.v - b0) < (k.u === '%' ? 2 : 1)) return;
        var f = function (v) { return k.u === '%' ? K.num(v, 0) + ' %' : k.u === '€' ? K.money(v) : String(v); };
        add('kpi:' + k.id, 'gov', f(k.v), k.name, L(k.name + ': verbessert von ' + f(b0) + ' auf ' + f(k.v) + '.', k.name + ': improved from ' + f(b0) + ' to ' + f(k.v) + '.'), 7, '📊');
      });
    }
    var p = PR();
    vars.org = s.meta.org || L('unsere Organisation', 'our organisation'); vars.zeitraum = K.fmt(per.from) + ' – ' + K.fmt(per.to); vars.von = K.fmt(per.from); vars.bis = K.fmt(per.to);
    vars.zielgruppe = K.lab(AUD[p.audience] || AUD.investors); vars.jahr = per.to.slice(0, 4);
    F.sort(function (a, b) { return b.weight - a.weight; });
    return { list: F, vars: vars, per: per };
  }
  /** Platzhalter {name} ersetzen. */
  function fill(text, vars) { return String(text || '').replace(/\{([a-z_]+)\}/g, function (m, k) { return vars[k] !== undefined ? vars[k] : m; }); }
  /** Systemnamen, Hostnamen und IP-Adressen entfernen. */
  function anon(text) {
    if (!PR().opts.anonymize) return text;
    var out = String(text || '');
    S().assets.forEach(function (a) { [a.name, a.hostname].concat(String(a.ip || '').split(/[,\s]+/)).filter(function (x) { return x && x.length > 2; }).forEach(function (n) { out = out.split(n).join(L('ein System', 'a system')); }); });
    return out.replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, 'x.x.x.x');
  }
  function autoMilestones(per) {
    var s = S(), out = [];
    (s.bcm ? s.bcm.exercises : []).forEach(function (e) { if ((e.status === 'done' || e.status === 'evaluated') && inP(e.date, per)) out.push({ date: e.date, title: L('Notfallübung durchgeführt', 'Exercise conducted'), text: anon(e.title) }); });
    if (s.pentest && s.pentest.project.to && inP(s.pentest.project.to, per)) out.push({ date: s.pentest.project.to, title: L('Penetrationstest abgeschlossen', 'Penetration test completed'), text: '' });
    if (s.appetite && inP(s.appetite.approvedDate, per)) out.push({ date: s.appetite.approvedDate, title: L('Risikoappetit freigegeben', 'Risk appetite approved'), text: '' });
    (s.duties || []).forEach(function (d) { if (d.cat !== 'audit' && d.cat !== 'review' && d.cat !== 'training') return; (d.history || []).forEach(function (h) { if (inP(h.date, per)) out.push({ date: h.date, title: anon(d.title), text: '' }); }); });
    s.assets.forEach(function (a) { if (inP(a.created, per)) out.push({ date: a.created.slice(0, 10), title: L('System in das Härtungsprogramm aufgenommen', 'System added to hardening programme'), titleN: L('{n} Systeme in das Härtungsprogramm aufgenommen', '{n} systems added to hardening programme'), text: '' }); });
    return out;
  }

  /* ------------------------------------------------------------------
   * Bericht (HTML, A4)
   * ---------------------------------------------------------------- */
  function donut(pctVal, color, label) {
    var r = 34, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, pctVal));
    return '<div class="donut"><svg viewBox="0 0 90 90" width="90" height="90"><circle cx="45" cy="45" r="' + r + '" fill="none" stroke="#e6ebf1" stroke-width="10"/><circle cx="45" cy="45" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + (c * v / 100).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 45 45)"/>' +
      '<text x="45" y="50" text-anchor="middle" font-size="17" font-weight="800" fill="#1b2430">' + Math.round(v) + '%</text></svg><div>' + esc(label) + '</div></div>';
  }
  function build(opts) {
    opts = opts || {};
    var s = S(), p = PR(), o = p.opts, B = s.meta.brand || {}, fx = facts(), vars = fx.vars, per = fx.per;
    var acc = /^#[0-9a-f]{6}$/i.test(B.color || '') ? B.color : '#0b6bcb';
    var one = opts.onePager !== undefined ? opts.onePager : o.onePager;
    var list = fx.list.filter(function (f) { return !p.off[f.key]; }).slice(0, one ? 6 : (+o.maxFacts || 24));
    var text = function (f) { return anon(fill(p.overrides[f.key] || f.text, vars)); };
    var md = function (x) { return '<div class="md">' + HA.MD.render(anon(fill(x, vars))) + '</div>'; };
    var title = p.title || L('Sicherheit & Resilienz ' + vars.jahr, 'Security & resilience ' + vars.jahr);
    var sub = p.subtitle || L('Erfolge und Fortschritte für ', 'Achievements and progress for ') + K.lab(AUD[p.audience] || AUD.investors);
    var css = '@page{size:A4 portrait;margin:14mm 14mm 16mm;@bottom-right{content:counter(page) " / " counter(pages);font-size:7.5pt;color:#667}@bottom-left{content:"' + String(s.meta.org || '').replace(/["\\]/g, '') + '";font-size:7.5pt;color:#667}}@page:first{@bottom-left{content:none}@bottom-right{content:none}}' +
      '*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;font-family:"Segoe UI",Roboto,Arial,sans-serif;font-size:' + (one ? '9.5pt' : '10.5pt') + ';color:#1b2430;background:#e9edf2;line-height:1.5}' +
      '.page{max-width:210mm;margin:0 auto;background:#fff;padding:14mm}@media print{body{background:#fff}.page{padding:0;max-width:none}}' +
      '.cover{border-radius:5mm;padding:' + (one ? '7mm 9mm' : '12mm 11mm') + ';color:#fff;background:linear-gradient(135deg,' + acc + ' 0%,#0f1b2d 100%);margin-bottom:7mm;' + (one ? '' : 'min-height:120mm;display:flex;flex-direction:column;justify-content:space-between') + '}' +
      '.cover .top{display:flex;justify-content:space-between;align-items:center;gap:6mm}.cover img{max-height:18mm;max-width:50mm;background:#fff;border-radius:2mm;padding:1.5mm}.cover .org{font-weight:700;font-size:11pt;text-align:right}' +
      '.cover h1{font-size:' + (one ? 22 : 30) + 'pt;line-height:1.1;margin:' + (one ? '6mm' : '20mm') + ' 0 3mm}.cover .sub{font-size:13pt;opacity:.92}.cover .per{margin-top:4mm;display:inline-block;background:rgba(255,255,255,.16);border-radius:10mm;padding:1.5mm 5mm;font-size:9.5pt}' +
      'h2{font-size:' + (one ? '12.5pt' : '15pt') + ';color:' + acc + ';margin:' + (one ? '4mm 0 2mm' : '8mm 0 3mm') + ';break-after:avoid}h2 .ic{margin-right:2mm}' +
      '.tiles{display:grid;grid-template-columns:repeat(' + (one ? 4 : 3) + ',1fr);gap:' + (one ? '3mm' : '4mm') + ';margin:' + (one ? '2mm' : '4mm') + ' 0}.tile{border-radius:3.5mm;padding:' + (one ? '2.5mm 3mm' : '4mm') + ';background:#f3f7fc;border-top:2mm solid ' + acc + ';break-inside:avoid}.tile b{display:block;font-size:20pt;line-height:1.1;color:' + acc + '}.tile span{font-size:9pt;color:#3b4654}' +
      '.facts{display:grid;grid-template-columns:1fr 1fr;gap:' + (one ? '2mm' : '3mm') + '}.fact{display:flex;gap:3mm;align-items:flex-start;border:.4mm solid #e1e7ef;border-radius:3mm;padding:' + (one ? '1.8mm 2.5mm' : '3mm') + ';break-inside:avoid}' + (one ? '.cover{margin-bottom:4mm}.hl{margin:2mm 0;padding:2mm 3mm}.md p{margin:.25em 0}' : '') + '.fact .ic{font-size:15pt;line-height:1}.fact .v{font-weight:800;color:' + acc + ';white-space:nowrap}' +
      '.charts{display:flex;gap:6mm;flex-wrap:wrap;margin:3mm 0}.donut{text-align:center;font-size:9pt;width:34mm}' +
      '.hl{border-left:2mm solid ' + acc + ';background:#f7fafd;padding:3mm 4mm;border-radius:0 3mm 3mm 0;margin:3mm 0;break-inside:avoid}.hl h3{margin:0 0 1mm;font-size:11.5pt}' +
      '.tl{border-left:.6mm solid #cbd5e1;margin:3mm 0 3mm 3mm;padding-left:5mm}.tl .it{position:relative;margin:0 0 3mm;break-inside:avoid}.tl .it:before{content:"";position:absolute;left:-7.3mm;top:1.2mm;width:3.2mm;height:3.2mm;border-radius:50%;background:' + acc + '}.tl .d{font-size:8.5pt;color:#5b6676}' +
      '.lead{font-size:' + (one ? '10pt' : '11.5pt') + '}.lead p{margin:' + (one ? '1mm 0' : '2mm 0') + '}.note{font-size:' + (one ? '7pt' : '8pt') + ';color:#5b6676;border-top:.3mm solid #d8dee8;margin-top:' + (one ? '3mm' : '8mm') + ';padding-top:' + (one ? '1mm' : '2mm') + '}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:6mm}' + HA.MD.CSS;
    var h = ['<!DOCTYPE html><html lang="' + HA.lang + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:"><title>' + esc(title) + '</title><style>' + css + '</style></head><body><div class="page">'];
    h.push('<div class="cover"><div class="top"><img src="' + esc(B.logo || HA.DEFAULT_LOGO) + '" alt="Logo"><div class="org">' + esc(s.meta.org || '') + (B.subtitle ? '<div style="font-weight:400;font-size:9pt">' + esc(B.subtitle) + '</div>' : '') + '</div></div>' +
      '<div><h1>' + esc(fill(title, vars)) + '</h1><div class="sub">' + esc(fill(sub, vars)) + '</div><div class="per">' + esc(L('Berichtszeitraum ', 'Reporting period ')) + esc(vars.zeitraum) + '</div></div></div>');
    if (p.texts.intro) h.push('<div class="lead">' + md(p.texts.intro) + '</div>');
    // Auf einen Blick
    var tiles = list.filter(function (f) { return f.value !== '✓'; }).slice(0, one ? 4 : 6);
    if (tiles.length) h.push('<h2><span class="ic">✨</span>' + esc(L('Auf einen Blick', 'At a glance')) + '</h2><div class="tiles">' + tiles.map(function (f) { return '<div class="tile"><b>' + esc(String(f.value)) + '</b><span>' + esc(f.unit) + '</span></div>'; }).join('') + '</div>');
    // Diagramme
    if (o.charts && !one) {
      var tot = { applicable: 0, done: 0, partial: 0, verified: 0 }; s.assets.forEach(function (a) { var st = A.assetStats(a); Object.keys(tot).forEach(function (k) { tot[k] += st[k] || 0; }); });
      var ch = [];
      if (tot.applicable && pct(tot.done + tot.partial * 0.5, tot.applicable) >= 50) ch.push(donut(pct(tot.done + tot.partial * 0.5, tot.applicable), acc, L('Umsetzungsgrad', 'Implementation rate')));
      if (tot.done && tot.verified) ch.push(donut(pct(Math.min(tot.verified, tot.done + tot.partial), tot.done + tot.partial), '#1a7f37', L('Wirksamkeit geprüft', 'Effectiveness verified')));
      if (HA.KPI) { var kp = HA.KPI.all().filter(function (k) { return !k.tg.off && k.v !== null && k.lv !== 'notarget'; }), okn = kp.filter(function (k) { return k.lv === 'ok'; }).length; if (okn && pct(okn, kp.length) >= 50) ch.push(donut(pct(okn, kp.length), '#7c3aed', L('Kennzahlen im Ziel', 'KPIs on target'))); }
      if (s.mc && pct(s.mc.inh.mean - s.mc.res.mean, s.mc.inh.mean) >= 10) ch.push(donut(pct(s.mc.inh.mean - s.mc.res.mean, s.mc.inh.mean), '#e07b00', L('weniger erwarteter Schaden', 'less expected loss')));
      if (ch.length >= 2) h.push('<div class="charts">' + ch.join('') + '</div>');
    }
    // Erfolge nach Themen
    if (one) h.push('<h2><span class="ic">🏆</span>' + esc(L('Unsere Erfolge', 'Our achievements')) + '</h2><div class="facts">' + list.map(function (f) { return '<div class="fact"><span class="ic">' + f.icon + '</span><div>' + esc(text(f)) + '</div></div>'; }).join('') + '</div>');
    else Object.keys(THEMES).forEach(function (th) {
      var items = list.filter(function (f) { return f.theme === th; }); if (!items.length) return;
      h.push('<h2><span class="ic">' + THEMES[th][0] + '</span>' + esc(K.lab(THEMES[th][1])) + '</h2><div class="facts">' + items.map(function (f) {
        return '<div class="fact"><span class="ic">' + f.icon + '</span><div>' + esc(text(f)) + '</div></div>'; }).join('') + '</div>');
    });
    // Eigene Highlights
    var blocks = p.blocks.filter(function (b) { return b.on !== false; });
    if (blocks.length || (p.texts.highlights && !one)) {
      h.push('<h2><span class="ic">⭐</span>' + esc(L('Highlights', 'Highlights')) + '</h2>');
      if (p.texts.highlights && !one) h.push(md(p.texts.highlights));
      blocks.slice(0, one ? 1 : 50).forEach(function (b) { h.push('<div class="hl"><h3>' + (b.icon || '⭐') + ' ' + esc(anon(fill(b.title, vars))) + '</h3>' + md(b.text) + '</div>'); });
    }
    // Meilensteine
    if (!one) {
      var ms = p.milestones.map(function (m) { return { date: m.date, title: m.title, text: m.text }; }).concat(o.autoMilestones ? autoMilestones(per) : [])
        .filter(function (m) { return m.date; }).sort(function (a, b) { return a.date.localeCompare(b.date); });
      // gleiche Meilensteine am selben Tag zusammenfassen (z. B. mehrere Systeme)
      ms = ms.reduce(function (acc, m) { var last = acc[acc.length - 1]; if (last && last.date === m.date && last.title === m.title && !m.text) { last.n = (last.n || 1) + 1; } else acc.push(Object.assign({}, m)); return acc; }, []);
      if (ms.length) h.push('<h2><span class="ic">🗓️</span>' + esc(L('Meilensteine', 'Milestones')) + '</h2><div class="tl">' + ms.slice(-14).map(function (m) {
        return '<div class="it"><div class="d">' + K.fmt(m.date) + '</div><b>' + esc(anon(fill(m.n ? (m.titleN ? m.titleN.replace('{n}', m.n) : m.n + ' × ' + m.title) : m.title, vars))) + '</b>' + (m.text ? '<div>' + esc(anon(fill(m.text, vars))) + '</div>' : '') + '</div>'; }).join('') + '</div>');
    }
    var outl = p.texts.outlook ? '<div><h2><span class="ic">🔭</span>' + esc(L('Ausblick', 'Outlook')) + '</h2>' + md(p.texts.outlook) + '</div>' : '';
    if (!one && outl) h.push(outl);
    var tail = one ? [outl, p.texts.thanks ? '<div><h2><span class="ic">💛</span>' + esc(L('Danke', 'Thank you')) + '</h2>' + md(p.texts.thanks) + '</div>' : ''].filter(Boolean) : [p.texts.thanks ? '<div><h2><span class="ic">💛</span>' + esc(L('Danke', 'Thank you')) + '</h2>' + md(p.texts.thanks) + '</div>' : '', p.texts.contact ? '<div><h2><span class="ic">✉️</span>' + esc(L('Kontakt', 'Contact')) + '</h2>' + md(p.texts.contact) + '</div>' : ''].filter(Boolean);
    if (tail.length) h.push('<div class="grid2">' + tail.join('') + '</div>');
    if (p.texts.closing && !one) h.push('<div style="margin-top:6mm">' + md(p.texts.closing) + '</div>');
    if (o.transparency) h.push('<div class="note">' + esc(L('Dieser Bericht hebt Fortschritte und Erfolge hervor. Alle Angaben beruhen auf dokumentierten Daten aus dem Informationssicherheits- und Notfallmanagement von ' + vars.org + ' (Stand ' + K.fmt(K.today()) + '). Aus Sicherheitsgründen werden keine Systemdetails veröffentlicht; der vollständige Prüf- und Risikobericht liegt der Leitung vor.',
      'This report highlights progress and achievements. All statements are based on documented data from the information security and contingency management of ' + vars.org + ' (as of ' + K.fmt(K.today()) + '). For security reasons no system details are published; the full audit and risk report is available to management.')) + '</div>');
    h.push('</div></body></html>');
    return h.join('');
  }

  /* ------------------------------------------------------------------
   * Ansicht
   * ---------------------------------------------------------------- */
  function view() {
    var p = PR(), h = [K.pageHead(t('nav.posreport'), L('Ein Bericht, der ausschließlich Erfolge und Fortschritte zeigt – für Shareholder, Investoren, Sponsoren, Mitglieder, Kunden oder die Leitung. Aussagen entstehen automatisch aus Ihren Daten und lassen sich mit vorbereiteten Texten ergänzen.',
      'A report that shows only achievements and progress – for shareholders, investors, sponsors, members, customers or management. Statements are generated from your data and can be complemented with prepared texts.'),
      K.btn('prpPdf', '📄 ' + L('Als PDF', 'As PDF')) + K.btn('prpHtml', '⬇ HTML') + K.btn('prpPrint', '🖨 ' + L('Drucken', 'Print'), { cls: 'btn-primary' }))];
    h.push(K.tabs('prpTab', [['texts', ['Zielgruppe & Texte', 'Audience & texts']], ['facts', ['Automatische Inhalte', 'Automatic content']], ['blocks', ['Highlights & Meilensteine', 'Highlights & milestones']], ['preview', ['Vorschau', 'Preview']]], U.tab));
    if (U.tab === 'facts') h.push(factsView());
    else if (U.tab === 'blocks') h.push(blocksView());
    else if (U.tab === 'preview') h.push('<div class="card no-print"><div class="row">' + K.btn('prpOne', p.opts.onePager ? '📄 ' + L('Ausführlich anzeigen', 'Show full report') : '📄 ' + L('Als Onepager anzeigen', 'Show one-pager')) + K.btn('prpRefresh', '🔄 ' + L('Aktualisieren', 'Refresh')) +
      '<span class="small muted">' + esc(L('PDF: im Druckdialog „Als PDF speichern“ wählen, Hintergrundgrafiken einschalten.', 'PDF: choose "Save as PDF" in the print dialog, enable background graphics.')) + '</span></div></div><iframe id="prpFrame" class="pt-frame tall" title="' + esc(L('Vorschau', 'Preview')) + '"></iframe>');
    else h.push(textsView());
    return h.join('');
  }
  function placeholderChips() {
    var v = facts().vars;
    return '<div class="small muted" style="margin:.2rem 0 .3rem">' + esc(L('Platzhalter (anklicken zum Einfügen in das zuletzt gewählte Textfeld):', 'Placeholders (click to insert into the last focused text field):')) + '</div><div class="chips">' + Object.keys(v).map(function (k) {
      return '<button type="button" class="chip-check" data-act="prpVar" data-id="' + k + '" title="' + esc(String(v[k])) + '">{' + k + '} <span class="muted">= ' + esc(K.clip(String(v[k]), 24)) + '</span></button>'; }).join('') + '</div>';
  }
  function textsView() {
    var p = PR(), o = p.opts, per = period();
    var h = ['<div class="card"><div class="grid grid-4">' +
      '<div class="field"><label>' + esc(L('Zielgruppe', 'Audience')) + '</label><select data-act="prpSel" data-k="audience">' + Object.keys(AUD).map(function (k) { return A.opt(k, K.lab(AUD[k]), p.audience); }).join('') + '</select></div>' +
      '<div class="field"><label>' + esc(L('Berichtszeitraum von', 'Period from')) + '</label><input type="date" data-field="prpF" data-k="from" value="' + esc(p.from || per.from) + '"></div>' +
      '<div class="field"><label>' + esc(L('bis', 'to')) + '</label><input type="date" data-field="prpF" data-k="to" value="' + esc(p.to || per.to) + '"></div>' +
      '<div class="field" style="align-self:end">' + K.btn('prpPreset', '✍️ ' + L('Texte für Zielgruppe einsetzen', 'Insert texts for audience')) + '</div>' +
      '<div class="field" style="grid-column:span 2"><label>' + esc(L('Titel', 'Title')) + '</label><input type="text" data-field="prpF" data-k="title" value="' + esc(p.title) + '" placeholder="' + esc(L('Sicherheit & Resilienz {jahr}', 'Security & resilience {jahr}')) + '"></div>' +
      '<div class="field" style="grid-column:span 2"><label>' + esc(L('Untertitel', 'Subtitle')) + '</label><input type="text" data-field="prpF" data-k="subtitle" value="' + esc(p.subtitle) + '" placeholder="' + esc(L('Erfolge und Fortschritte für {zielgruppe}', 'Achievements and progress for {zielgruppe}')) + '"></div></div>' +
      '<div class="checks" style="margin-top:.4rem">' + [['anonymize', ['Systemnamen, Hostnamen und IP-Adressen weglassen (empfohlen)', 'Omit system names, host names and IP addresses (recommended)']], ['transparency', ['Transparenzhinweis ausgeben (vollständiger Bericht liegt der Leitung vor)', 'Show transparency note (full report available to management)']],
        ['charts', ['Diagramme anzeigen', 'Show charts']], ['autoMilestones', ['Meilensteine automatisch ergänzen', 'Add milestones automatically']], ['onePager', ['Onepager (eine Seite)', 'One-pager (single page)']]].map(function (x) {
        return '<label><input type="checkbox" data-act="prpOpt" data-k="' + x[0] + '"' + (o[x[0]] ? ' checked' : '') + '> ' + esc(K.lab(x[1])) + '</label>'; }).join('') + '</div></div>'];
    h.push('<div class="card"><h2>' + esc(L('Vorbereitete Texte', 'Prepared texts')) + '</h2><p class="small muted">' + esc(L('Diese Texte werden beim Erzeugen eingefügt – ergänzend zu den automatischen Aussagen. Markdown ist erlaubt (**fett**, Listen, Links). Platzhalter werden durch aktuelle Werte ersetzt.', 'These texts are inserted when generating – in addition to the automatic statements. Markdown is allowed. Placeholders are replaced by current values.')) + '</p>' +
      placeholderChips() + '<div class="grid grid-2" style="margin-top:.6rem">' + TEXT_FIELDS.map(function (f) {
        return '<div class="field"><label>' + esc(K.lab(f[1])) + '</label><textarea data-field="prpText" data-k="' + f[0] + '" rows="' + (f[0] === 'intro' || f[0] === 'highlights' ? 5 : 3) + '">' + esc(p.texts[f[0]]) + '</textarea></div>'; }).join('') + '</div></div>');
    return h.join('');
  }
  function factsView() {
    var p = PR(), fx = facts(), h = [];
    h.push('<div class="note">' + esc(L('Little-RiskBee erzeugt nur Aussagen, die positiv und durch Daten belegt sind. Aussagen abwählen oder mit eigenem Text überschreiben (Platzhalter erlaubt).', 'Little-RiskBee only generates statements that are positive and backed by data. Deselect statements or override them with your own text (placeholders allowed).')) + '</div>');
    if (!fx.list.length) h.push('<div class="card muted">' + esc(L('Noch keine positiven Aussagen möglich – erfassen Sie z. B. umgesetzte Maßnahmen, behobene Befunde oder Übungen.', 'No positive statements yet – record implemented measures, fixed findings or exercises.')) + '</div>');
    Object.keys(THEMES).forEach(function (th) {
      var items = fx.list.filter(function (f) { return f.theme === th; }); if (!items.length) return;
      h.push('<div class="card"><h2>' + THEMES[th][0] + ' ' + esc(K.lab(THEMES[th][1])) + '</h2>' + items.map(function (f) {
        return '<div class="prp-fact' + (p.off[f.key] ? ' off' : '') + '"><label class="prp-head"><input type="checkbox" data-act="prpFact" data-id="' + esc(f.key) + '"' + (p.off[f.key] ? '' : ' checked') + '> <span class="prp-ic">' + f.icon + '</span> <b>' + esc(String(f.value)) + '</b> <span class="muted small">' + esc(f.unit) + '</span></label>' +
          '<div class="small">' + esc(anon(fill(f.text, fx.vars))) + '</div><textarea data-field="prpOver" data-k="' + esc(f.key) + '" rows="2" placeholder="' + esc(L('Eigener Text (optional) – ersetzt die automatische Aussage', 'Own text (optional) – replaces the automatic statement')) + '">' + esc(p.overrides[f.key] || '') + '</textarea></div>';
      }).join('') + '</div>');
    });
    // Potenzial
    var tips = [];
    var s = S();
    if (!(s.bcm && s.bcm.exercises.length)) tips.push(L('Notfallübungen erfassen (BCM → Übungen)', 'Record exercises (BCM → Exercises)'));
    if (!s.mc) tips.push(L('Monte-Carlo-Simulation starten (Risikoregister) – zeigt die Schadensreduktion in €', 'Run Monte Carlo simulation (risk register) – shows loss reduction in €'));
    if (!(s.duties || []).some(function (d) { return d.history.length; })) tips.push(L('Erledigte Pflichten im Pflichtenkalender abhaken', 'Tick off completed duties in the duty calendar'));
    if (!s.kpi.snapshots.length) tips.push(L('KPI-Stand festhalten – ermöglicht „verbessert von … auf …“', 'Record KPI snapshots – enables "improved from … to …"'));
    if (!(s.pentest && s.pentest.findings.some(function (f) { return f.retestStatus === 'fixed'; }))) tips.push(L('Re-Tests im Finding-Dashboard dokumentieren', 'Document retests in the finding dashboard'));
    if (tips.length) h.push('<div class="card"><h2>💡 ' + esc(L('Mehr Erfolge sichtbar machen', 'Make more achievements visible')) + '</h2><ul>' + tips.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>');
    return h.join('');
  }
  function blocksView() {
    var p = PR(), h = [];
    h.push('<div class="card"><h2>' + esc(L('Eigene Highlights', 'Own highlights')) + '</h2><p class="small muted">' + esc(L('Besondere Erfolge, die nicht aus den Daten ableitbar sind – z. B. Zertifizierung, neue Mitarbeitende, Auszeichnungen, Projektabschlüsse.', 'Special achievements not derivable from data – e.g. certification, new staff, awards, completed projects.')) + '</p>' +
      (p.blocks.length ? K.table(['', L('Highlight', 'Highlight'), ''], p.blocks.map(function (b) {
        return '<tr><td><input type="checkbox" data-act="prpBlockOn" data-id="' + esc(b.id) + '"' + (b.on !== false ? ' checked' : '') + '></td><td><b>' + (b.icon || '⭐') + ' ' + esc(b.title) + '</b><div class="small muted">' + esc(K.clip(b.text, 160)) + '</div></td>' +
          '<td class="nowrap">' + K.btn('prpBlockEdit', '✏️', { id: b.id, cls: 'btn-sm', title: t('btn.edit') }) + ' ' + K.btn('prpBlockDel', '🗑', { id: b.id, cls: 'btn-sm btn-danger', title: t('btn.delete') }) + '</td></tr>'; })) : '') +
      '<div class="row" style="margin-top:.5rem">' + K.btn('prpBlockAdd', '+ ' + L('Highlight', 'Highlight'), { cls: 'btn-primary' }) + '</div></div>');
    var auto = p.opts.autoMilestones ? autoMilestones(period()) : [];
    h.push('<div class="card"><h2>' + esc(L('Meilensteine', 'Milestones')) + '</h2>' + K.table([L('Datum', 'Date'), L('Meilenstein', 'Milestone'), ''], p.milestones.slice().sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); }).map(function (m) {
      return '<tr><td class="nowrap">' + K.fmt(m.date) + '</td><td><b>' + esc(m.title) + '</b><div class="small muted">' + esc(m.text || '') + '</div></td><td class="nowrap">' + K.btn('prpMsEdit', '✏️', { id: m.id, cls: 'btn-sm', title: t('btn.edit') }) + ' ' + K.btn('prpMsDel', '🗑', { id: m.id, cls: 'btn-sm btn-danger', title: t('btn.delete') }) + '</td></tr>';
    }).concat(auto.map(function (m) { return '<tr style="opacity:.75"><td class="nowrap">' + K.fmt(m.date) + '</td><td>' + esc(m.title) + ' <span class="small muted">(' + esc(L('automatisch', 'automatic')) + ')</span>' + (m.text ? '<div class="small muted">' + esc(m.text) + '</div>' : '') + '</td><td></td></tr>'; }))) +
      '<div class="row" style="margin-top:.5rem">' + K.btn('prpMsAdd', '+ ' + L('Meilenstein', 'Milestone'), { cls: 'btn-primary' }) + '</div></div>');
    return h.join('');
  }
  function editBlock(b) {
    var p = PR(), isNew = !b;
    var form = K.editDialog(isNew ? L('Highlight anlegen', 'Add highlight') : L('Highlight bearbeiten', 'Edit highlight'), [
      { k: 'icon', l: ['Symbol', 'Icon'], type: 'select', opts: ICONS.map(function (i) { return [i, i]; }) }, { k: 'title', l: ['Titel', 'Title'], req: true },
      { k: 'text', l: ['Text (Markdown, Platzhalter erlaubt)', 'Text (markdown, placeholders allowed)'], type: 'textarea', rows: 5, full: true }, { k: 'on', type: 'check', l: ['im Bericht', 'in report'] }
    ], b || { icon: '⭐', title: '', text: '', on: true }, function (o) { if (isNew) { o.id = A.uid('hl'); p.blocks.push(o); } });
    return form;
  }
  function editMs(m) {
    var p = PR(), isNew = !m;
    K.editDialog(isNew ? L('Meilenstein anlegen', 'Add milestone') : L('Meilenstein bearbeiten', 'Edit milestone'), [
      { k: 'date', l: ['Datum', 'Date'], type: 'date', req: true }, { k: 'title', l: ['Meilenstein', 'Milestone'], req: true }, { k: 'text', l: ['Beschreibung', 'Description'], type: 'textarea', rows: 2, full: true }
    ], m || { date: K.today(), title: '', text: '' }, function (o) { if (isNew) { o.id = A.uid('ms'); p.milestones.push(o); } });
  }
  function printHtml(html) {
    var fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0'; document.body.appendChild(fr);
    fr.onload = function () { setTimeout(function () { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { A.toast(e.message, true); } setTimeout(function () { fr.remove(); }, 120000); }, 250); };
    fr.srcdoc = html;
  }

  A.views.posreport = view;
  A.ext.click.push(function (act, el) {
    var p = PR(), id = el.getAttribute('data-id');
    switch (act) {
      case 'prpTab': U.tab = id; A.render(); return true;
      case 'prpPrint': printHtml(build()); return true;
      case 'prpPdf': printHtml(build()); A.toast(L('Im Druckdialog „Als PDF speichern“ als Ziel wählen.', 'Choose "Save as PDF" as destination in the print dialog.')); return true;
      case 'prpHtml': K.download('positiv-bericht_' + K.today() + '.html', build(), 'text/html;charset=utf-8'); return true;
      case 'prpOne': p.opts.onePager = !p.opts.onePager; A.save(); A.render(); return true;
      case 'prpRefresh': { var fr = document.getElementById('prpFrame'); if (fr) fr.srcdoc = build(); return true; }
      case 'prpPreset': {
        var pr = presets(p.audience), filled = Object.keys(pr).some(function (k) { return p.texts[k]; });
        var go = function () { Object.keys(pr).forEach(function (k) { p.texts[k] = pr[k]; }); if (!p.texts.contact && S().meta.brand && S().meta.brand.contact) p.texts.contact = S().meta.brand.contact; A.save(); A.render(); };
        if (filled) A.confirm(L('Vorhandene Texte (Vorwort, Ausblick, Dank, Schlusswort) durch die Vorlage für „' + K.lab(AUD[p.audience]) + '“ ersetzen?', 'Replace existing texts with the template for "' + K.lab(AUD[p.audience]) + '"?'), go); else go();
        return true;
      }
      case 'prpVar': {
        var ta = U.lastTa && document.body.contains(U.lastTa) ? U.lastTa : document.querySelector('[data-field=prpText]');
        if (!ta) return true;
        var s0 = ta.selectionStart || ta.value.length, txt = '{' + id + '}';
        ta.value = ta.value.slice(0, s0) + txt + ta.value.slice(ta.selectionEnd || s0); ta.focus(); ta.selectionStart = ta.selectionEnd = s0 + txt.length;
        ta.dispatchEvent(new Event('input', { bubbles: true })); return true;
      }
      case 'prpBlockAdd': editBlock(null); return true;
      case 'prpBlockEdit': editBlock(p.blocks.find(function (b) { return b.id === id; })); return true;
      case 'prpBlockDel': p.blocks = p.blocks.filter(function (b) { return b.id !== id; }); A.save(); A.render(); return true;
      case 'prpMsAdd': editMs(null); return true;
      case 'prpMsEdit': editMs(p.milestones.find(function (m) { return m.id === id; })); return true;
      case 'prpMsDel': p.milestones = p.milestones.filter(function (m) { return m.id !== id; }); A.save(); A.render(); return true;
    }
  });
  A.ext.change.push(function (act, el) {
    var p = PR(), k = el.getAttribute('data-k');
    switch (act) {
      case 'prpSel': p[k] = el.value; A.save(); A.render(); return true;
      case 'prpOpt': p.opts[k] = el.checked; A.save(); return true;
      case 'prpFact': if (el.checked) delete p.off[el.getAttribute('data-id')]; else p.off[el.getAttribute('data-id')] = true; el.closest('.prp-fact').classList.toggle('off', !el.checked); A.save(); return true;
      case 'prpBlockOn': p.blocks.find(function (b) { return b.id === el.getAttribute('data-id'); }).on = el.checked; A.save(); return true;
      case 'prpF': if (el.type === 'date') { p[k] = el.value; A.save(); A.render(); } return true;
      case 'prpText': case 'prpOver': return true;
    }
  });
  A.ext.input.push(function (act, el) {
    var p = PR(), k = el.getAttribute('data-k');
    if (act === 'prpF') { p[k] = el.value; A.save(); return true; }
    if (act === 'prpText') { p.texts[k] = el.value; A.save(); return true; }
    if (act === 'prpOver') { if (el.value.trim()) p.overrides[k] = el.value; else delete p.overrides[k]; A.save(); return true; }
  });
  document.addEventListener('focusin', function (e) { var x = e.target; if (x && x.matches && x.matches('[data-field=prpText],[data-field=prpOver]')) U.lastTa = x; });
  A.ext.afterRender.push(function (v) { if (v === 'posreport' && U.tab === 'preview') { var fr = document.getElementById('prpFrame'); if (fr) fr.srcdoc = build(); } });

  return { build: build, facts: facts, fill: fill, U: U };
})();

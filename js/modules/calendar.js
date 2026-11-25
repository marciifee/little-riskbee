/* =====================================================================
 * modules/calendar.js – Pflichtenkalender, periodische Reviews, Erinnerungen
 * ---------------------------------------------------------------------
 *  • Pflichten (state.duties): wiederkehrende Aufgaben und Normpflichten
 *    (ISO/IEC 27001, BSI-Standards, DSGVO, NIS2/BSIG …) mit Intervall,
 *    Vorlaufzeit, Verantwortlichen und Erledigungs-Historie.
 *  • Reviews (automatisch aus den Daten): Risiko-Reviews, ablaufende
 *    Risikoakzeptanzen, Überprüfung Risikoappetit, Asset-Re-Audits,
 *    veraltete Scans, Termine aus der Roadmap sowie BCM-Termine (BIA,
 *    BC-Pläne, Übungen) – Module melden sich über providers an.
 *  • Erinnerung: Zähler in der Navigation, Karte in der Übersicht, Hinweis
 *    beim Start, optional Browser-Benachrichtigung (nur solange die Seite
 *    geöffnet ist) und ICS-Export mit Alarmen für den eigenen Kalender
 *    (Outlook, Thunderbird, Apple, Nextcloud …) – alles lokal, ohne Server.
 * ===================================================================== */
window.HA = window.HA || {};

HA.Cal = (function () {
  'use strict';
  var A = HA.App, K = HA.Kit, L = K.L, esc = A.esc, t = HA.t;
  var U = { tab: 'agenda', month: '', cat: '', src: '' };
  var providers = [];        // function(state) → [{ key, date, title, sub, cat, src, owner, go, done(state, o) }]
  var notified = false;
  function S() { return A.state(); }

  var CATS = {
    review: ['Review', 'Review', '#2f7fd8'], audit: ['Audit', 'Audit', '#7c3aed'], exercise: ['Übung / Test', 'Exercise / test', '#12a39a'],
    training: ['Schulung', 'Training', '#e0a137'], report: ['Bericht / Meldung', 'Report / notification', '#6b7280'], legal: ['Rechtspflicht', 'Legal duty', '#c62828'],
    maint: ['Betrieb / Wartung', 'Operations / maintenance', '#0b6bcb'], risk: ['Risiko', 'Risk', '#f0952a'], bcm: ['BCM', 'BCM', '#1a7f37'], measure: ['Maßnahme', 'Measure', '#a16207']
  };
  var FREQ = [['once', ['einmalig', 'once']], ['weekly', ['wöchentlich', 'weekly']], ['monthly', ['monatlich', 'monthly']], ['quarterly', ['vierteljährlich', 'quarterly']],
    ['halfyear', ['halbjährlich', 'half-yearly']], ['yearly', ['jährlich', 'yearly']], ['2y', ['alle 2 Jahre', 'every 2 years']], ['3y', ['alle 3 Jahre', 'every 3 years']], ['custom', ['alle n Monate', 'every n months']]];
  var FM = { monthly: 1, quarterly: 3, halfyear: 6, yearly: 12, '2y': 24, '3y': 36 };
  function catLabel(c) { return CATS[c] ? L(CATS[c][0], CATS[c][1]) : c; }
  function catColor(c) { return CATS[c] ? CATS[c][2] : '#6b7280'; }
  function freqLabel(d) { if (d.freq === 'custom') return L('alle ' + (d.months || 1) + ' Monate', 'every ' + (d.months || 1) + ' months'); var f = FREQ.find(function (x) { return x[0] === d.freq; }); return f ? K.lab(f[1]) : d.freq; }
  function step(d, date, dir) {
    dir = dir || 1;
    if (d.freq === 'weekly') return K.addDays(date, 7 * dir);
    var m = d.freq === 'custom' ? (+d.months || 1) : FM[d.freq];
    return m ? K.addMonths(date, m * dir) : '';
  }
  function nextDue(d) {
    if (d.active === false) return '';
    if (d.freq === 'once') return d.lastDone ? '' : (d.start || '');
    return d.lastDone ? step(d, d.lastDone) : (d.start || K.today());
  }

  /* ------------------------------------------------------------------
   * Vorlagen: Normpflichten (Intervalle sind übliche Praxis-/Mindestwerte;
   * maßgeblich sind die eigenen Vorgaben und die Originalquellen)
   * ---------------------------------------------------------------- */
  var TEMPLATES = [
    { id: 'iso-mr', g: 'ISO/IEC 27001', norm: 'ISO/IEC 27001:2022 Kap. 9.3', cat: 'review', freq: 'yearly', title: ['Managementbewertung des ISMS', 'ISMS management review'], desc: ['Leitung bewertet Eignung, Angemessenheit und Wirksamkeit des ISMS (Eingaben 9.3.2, Ergebnisse 9.3.3 dokumentieren).', 'Top management reviews suitability, adequacy and effectiveness of the ISMS.'] },
    { id: 'iso-ia', g: 'ISO/IEC 27001', norm: 'ISO/IEC 27001:2022 Kap. 9.2', cat: 'audit', freq: 'yearly', title: ['Internes Audit ISMS', 'Internal ISMS audit'], desc: ['Auditprogramm planen und durchführen; Abweichungen in Korrekturmaßnahmen überführen.', 'Plan and run the audit programme; turn nonconformities into corrective actions.'] },
    { id: 'iso-ra', g: 'ISO/IEC 27001', norm: 'ISO/IEC 27001:2022 Kap. 8.2 / BSI 200-3', cat: 'risk', freq: 'yearly', title: ['Risikobeurteilung aktualisieren', 'Update risk assessment'], desc: ['In geplanten Abständen und bei wesentlichen Änderungen.', 'At planned intervals and on significant changes.'] },
    { id: 'iso-soa', g: 'ISO/IEC 27001', norm: 'ISO/IEC 27001:2022 Kap. 6.1.3 d', cat: 'review', freq: 'yearly', title: ['Anwendbarkeitserklärung (SoA) prüfen', 'Review Statement of Applicability (SoA)'], desc: ['Ausgewählte Maßnahmen und Begründungen auf Aktualität prüfen.', 'Check selected controls and justifications.'] },
    { id: 'pol', g: 'ISO/IEC 27001', norm: 'ISO/IEC 27001 Kap. 5.2 / A.5.1; BSI 200-1', cat: 'review', freq: 'yearly', title: ['Informationssicherheitsleitlinie und Richtlinien überprüfen', 'Review information security policy and guidelines'], desc: ['Leitlinie und themenspezifische Richtlinien prüfen, freigeben, bekanntgeben.', 'Review, approve and communicate the policy and topic-specific policies.'] },
    { id: 'aware', g: 'ISO/IEC 27001', norm: 'ISO/IEC 27001 Kap. 7.3 / A.6.3', cat: 'training', freq: 'yearly', title: ['Sensibilisierung und Schulung Beschäftigte', 'Security awareness training for staff'], desc: ['Awareness-Maßnahmen (z. B. Phishing, Passwörter) durchführen und Teilnahme dokumentieren.', 'Run awareness measures and document participation.'] },
    { id: 'access', g: 'ISO/IEC 27001', norm: 'ISO/IEC 27001 A.5.18', cat: 'review', freq: 'halfyear', title: ['Rezertifizierung von Zugriffsrechten', 'Access rights recertification'], desc: ['Berechtigungen (AD-Gruppen, Fileserver, Postfächer, privilegierte Konten) durch die Verantwortlichen bestätigen lassen.', 'Have owners confirm permissions (AD groups, file servers, mailboxes, privileged accounts).'] },
    { id: 'supplier', g: 'ISO/IEC 27001', norm: 'ISO/IEC 27001 A.5.19–5.22', cat: 'review', freq: 'yearly', title: ['Lieferanten- und Dienstleisterbewertung', 'Supplier and service provider review'], desc: ['Sicherheitsanforderungen, Verträge und Leistungen der Dienstleister überprüfen.', 'Check security requirements, contracts and performance of providers.'] },
    { id: 'vuln', g: 'Technik', norm: 'ISO/IEC 27001 A.8.8; BSI OPS.1.1.3', cat: 'maint', freq: 'monthly', title: ['Schwachstellenscan (OpenVAS/Greenbone) und Patch-Review', 'Vulnerability scan (OpenVAS/Greenbone) and patch review'], desc: ['Scan durchführen, Ergebnis in Little-RiskBee importieren, Befunde bewerten.', 'Run scan, import results into Little-RiskBee, assess findings.'] },
    { id: 'backup', g: 'Technik', norm: 'ISO/IEC 27001 A.8.13; BSI CON.3', cat: 'exercise', freq: 'quarterly', title: ['Wiederherstellungstest Datensicherung', 'Backup restore test'], desc: ['Stichprobenartige Wiederherstellung; Dauer mit RTO/RPO der BIA vergleichen.', 'Sample restore; compare duration with RTO/RPO from the BIA.'] },
    { id: 'logs', g: 'Technik', norm: 'ISO/IEC 27001 A.8.15/A.8.16; BSI OPS.1.1.5', cat: 'maint', freq: 'monthly', title: ['Auswertung von Protokollen', 'Log review'], desc: ['Sicherheitsrelevante Ereignisse und Alarme auswerten.', 'Review security-relevant events and alerts.'] },
    { id: 'fw', g: 'Technik', norm: 'BSI NET.3.2', cat: 'review', freq: 'halfyear', title: ['Firewall-Regelwerk überprüfen', 'Review firewall rule base'], desc: ['Nicht mehr benötigte Regeln entfernen, Freigaben dokumentieren.', 'Remove obsolete rules, document approvals.'] },
    { id: 'pentest', g: 'Technik', norm: 'BSI DER.3.1 (Audits/Revisionen)', cat: 'audit', freq: 'yearly', title: ['Penetrationstest / technische Revision', 'Penetration test / technical audit'], desc: ['Externe oder interne technische Prüfung kritischer Systeme.', 'External or internal technical test of critical systems.'] },
    { id: 'reaudit', g: 'Technik', norm: 'PDCA – Check', cat: 'audit', freq: 'yearly', title: ['Härtungs-Re-Audit (Checkliste je Asset)', 'Hardening re-audit (checklist per asset)'], desc: ['Checkliste je Asset erneut prüfen, Wirksamkeit verifizieren, Bericht erzeugen.', 'Re-check the checklist per asset, verify effectiveness, generate report.'] },
    { id: 'tom', g: 'DSGVO', norm: 'DSGVO Art. 32 Abs. 1 lit. d', cat: 'legal', freq: 'yearly', title: ['Wirksamkeit der TOM überprüfen und bewerten', 'Test and evaluate effectiveness of TOMs'], desc: ['Verfahren zur regelmäßigen Überprüfung, Bewertung und Evaluierung der technischen und organisatorischen Maßnahmen.', 'Process for regularly testing, assessing and evaluating technical and organisational measures.'] },
    { id: 'vvt', g: 'DSGVO', norm: 'DSGVO Art. 30', cat: 'legal', freq: 'yearly', title: ['Verzeichnis von Verarbeitungstätigkeiten aktualisieren', 'Update record of processing activities'], desc: ['Verarbeitungen, Empfänger, Löschfristen und TOM-Verweise prüfen.', 'Check processing operations, recipients, retention periods and TOM references.'] },
    { id: 'avv', g: 'DSGVO', norm: 'DSGVO Art. 28', cat: 'legal', freq: 'yearly', title: ['Auftragsverarbeitungsverträge prüfen', 'Review data processing agreements'], desc: ['AV-Verträge und Unterauftragnehmer auf Aktualität prüfen.', 'Check DPAs and sub-processors.'] },
    { id: 'nis2-gl', g: 'NIS2 / BSIG', norm: '§ 38 Abs. 3 BSIG (NIS2UmsuCG)', cat: 'training', freq: '3y', title: ['Schulung der Geschäftsleitung (Cybersicherheit)', 'Management board cybersecurity training'], desc: ['Regelmäßige Teilnahme der Geschäftsleitung an Schulungen zu Risikoerkennung und Risikomanagement; Teilnahme nachweisen.', 'Regular management training on risk identification and risk management; keep evidence.'] },
    { id: 'nis2-rm', g: 'NIS2 / BSIG', norm: '§ 30, § 38 Abs. 1 BSIG', cat: 'review', freq: 'yearly', title: ['Risikomanagementmaßnahmen durch Geschäftsleitung billigen/überwachen', 'Management approval/oversight of risk management measures'], desc: ['Geschäftsleitung billigt die Maßnahmen und überwacht die Umsetzung – Billigung dokumentieren.', 'Management approves the measures and oversees implementation – document approval.'] },
    { id: 'nis2-meld', g: 'NIS2 / BSIG', norm: '§ 32 BSIG', cat: 'report', freq: 'yearly', title: ['Meldeprozess erhebliche Sicherheitsvorfälle prüfen (24 h / 72 h / 1 Monat)', 'Check incident reporting process (24 h / 72 h / 1 month)'], desc: ['Kontaktdaten, Zuständigkeiten und Vorlagen für Erstmeldung (24 h), Folgemeldung (72 h) und Abschlussbericht (1 Monat) prüfen und üben.', 'Check contacts, responsibilities and templates for initial (24 h), follow-up (72 h) and final report (1 month).'] },
    { id: 'nis2-reg', g: 'NIS2 / BSIG', norm: '§ 33/34 BSIG', cat: 'legal', freq: 'yearly', title: ['Registrierungsdaten beim BSI aktuell halten', 'Keep BSI registration data up to date'], desc: ['Angaben der Registrierung (Kontaktstelle, Erreichbarkeit) prüfen.', 'Check registration details (contact point, availability).'] },
    { id: 'bcm-bia', g: 'BSI 200-4 (BCM)', norm: 'BSI-Standard 200-4', cat: 'bcm', freq: 'yearly', title: ['Business-Impact-Analyse überprüfen', 'Review business impact analysis'], desc: ['Geschäftsprozesse, MTA, RTO, RPO und Abhängigkeiten aktualisieren.', 'Update processes, MTPD, RTO, RPO and dependencies.'] },
    { id: 'bcm-plan', g: 'BSI 200-4 (BCM)', norm: 'BSI-Standard 200-4', cat: 'bcm', freq: 'yearly', title: ['BC-Pläne / Notfallhandbuch aktualisieren', 'Update BC plans / emergency manual'], desc: ['Pläne, Kontaktlisten und Alarmierungswege aktualisieren und freigeben.', 'Update and approve plans, contact lists and alerting paths.'] },
    { id: 'bcm-year', g: 'BSI 200-4 (BCM)', norm: 'BSI-Standard 200-4', cat: 'exercise', freq: 'yearly', title: ['Jahresübungsplan erstellen', 'Create annual exercise plan'], desc: ['Übungen und Tests für das Folgejahr planen (Übungsarten, Ziele, Beteiligte).', 'Plan exercises and tests for the next year (types, objectives, participants).'] },
    { id: 'bcm-alarm', g: 'BSI 200-4 (BCM)', norm: 'BSI-Standard 200-4', cat: 'exercise', freq: 'halfyear', title: ['Alarmierungsübung', 'Alerting exercise'], desc: ['Erreichbarkeit des Krisenstabs und der Notfallteams testen.', 'Test reachability of crisis team and emergency teams.'] },
    { id: 'bcm-mr', g: 'BSI 200-4 (BCM)', norm: 'BSI-Standard 200-4', cat: 'review', freq: 'yearly', title: ['Managementbewertung des BCMS', 'BCMS management review'], desc: ['Leitung bewertet Wirksamkeit des BCM anhand von Kennzahlen, Übungsergebnissen und Vorfällen.', 'Management reviews BCM effectiveness based on KPIs, exercise results and incidents.'] }
  ];

  /* ------------------------------------------------------------------
   * Datenpflege
   * ---------------------------------------------------------------- */
  A.ext.normalize.push(function (s) {
    if (!Array.isArray(s.duties)) s.duties = [];
    s.duties.forEach(function (d) { d.history = d.history || []; if (d.active === undefined) d.active = true; });
    s.reminders = Object.assign({ lead: 14, notify: false, startToast: true, assetReviewMonths: 12, roadmapDue: true, scanStale: true }, s.reminders || {});
    s.dutySeq = s.dutySeq || (s.duties.length + 1);
  });

  /** Alle Termine (Pflichten + automatische Reviews). */
  function entries(opts) {
    opts = opts || {};
    var s = S(), out = [];
    s.duties.forEach(function (d) {
      var nd = nextDue(d); if (!nd) return;
      out.push({ key: 'D:' + d.id, date: nd, title: d.title, sub: [d.norm, freqLabel(d)].filter(Boolean).join(' · '), cat: d.cat || 'review', src: 'duty', owner: d.owner, remind: d.remind === '' || d.remind === undefined ? s.reminders.lead : +d.remind, duty: d });
    });
    providers.forEach(function (fn) { try { (fn(s) || []).forEach(function (e) { if (e.date) out.push(e); }); } catch (err) { /* defekte Quelle ignorieren */ } });
    var today = K.today();
    out.forEach(function (e) {
      if (e.remind === undefined) e.remind = s.reminders.lead;
      var dd = K.diffDays(today, e.date);
      e.days = dd; e.state = dd < 0 ? 'overdue' : dd <= e.remind ? 'due' : 'later';
    });
    out.sort(function (a, b) { return a.date.localeCompare(b.date) || a.title.localeCompare(b.title); });
    return out;
  }
  function counts() { var c = { overdue: 0, due: 0 }; entries().forEach(function (e) { if (c[e.state] !== undefined) c[e.state]++; }); return c; }

  /* ------------------------------------------------------------------
   * Eingebaute Review-Quellen
   * ---------------------------------------------------------------- */
  providers.push(function (s) {
    var out = [];
    // Risiko-Reviews (eigene Risiken)
    (s.register ? s.register.items : []).forEach(function (r) {
      if (r.status === 'closed' || !HA.Register) return;
      out.push({ key: 'RV:' + r.id, date: HA.Register.nextReview(r), title: L('Risiko-Review', 'Risk review') + ' ' + r.id + ': ' + r.title, sub: L('Risikoregister', 'Risk register'), cat: 'risk', src: 'review', owner: r.owner, go: 'register',
        done: function (st, o) { r.reviews.push({ date: o.date, by: o.by, note: o.note }); r.lastReview = o.date; } });
    });
    // Ablaufende Risikoakzeptanzen
    if (HA.Register) HA.Register.rows({ closed: true }).forEach(function (x) {
      if (!x.acc || !x.acc.until) return;
      out.push({ key: 'AC:' + x.key, date: x.acc.until, title: L('Risikoakzeptanz läuft ab', 'Risk acceptance expires') + ': ' + x.id + ' ' + x.title, sub: x.acc.by, cat: 'risk', src: 'review', owner: x.owner, go: 'register', remind: 30 });
    });
    if (s.appetite && s.appetite.nextReview) out.push({ key: 'AP', date: s.appetite.nextReview, title: L('Risikoappetit überprüfen', 'Review risk appetite'), sub: L('Risikoappetit-Erklärung, Schwellen, Befugnisse', 'Appetite statement, thresholds, authorities'), cat: 'review', src: 'review', owner: s.appetite.approvedBy, go: 'register',
      done: function (st, o) { st.appetite.approvedDate = o.date; st.appetite.nextReview = K.addMonths(o.date, 12); } });
    // Assets: Re-Audit und veraltete Scans
    s.assets.forEach(function (a) {
      var base = a.lastReview || (a.created || '').slice(0, 10);
      if (base) out.push({ key: 'AS:' + a.id, date: K.addMonths(base, +s.reminders.assetReviewMonths || 12), title: L('Re-Audit Asset', 'Asset re-audit') + ': ' + a.name, sub: L('Checkliste prüfen, Wirksamkeit verifizieren', 'Check checklist, verify effectiveness'), cat: 'audit', src: 'review', owner: a.owner, go: 'checklist',
        done: function (st, o) { a.lastReview = o.date; a.reviews = a.reviews || []; a.reviews.push({ date: o.date, by: o.by, note: o.note }); } });
      if (s.reminders.scanStale) {
        var ls = (a.scans || []).filter(function (x) { return x.tool === 'openvas'; }).sort(function (x, y) { return (y.scanDate || y.importedAt || '').localeCompare(x.scanDate || x.importedAt || ''); })[0];
        if (ls) out.push({ key: 'SC:' + a.id, date: K.addDays((ls.scanDate || ls.importedAt).slice(0, 10), +s.meta.staleDays || 90), title: L('Schwachstellenscan fällig', 'Vulnerability scan due') + ': ' + a.name, sub: L('letzter OpenVAS-Scan', 'last OpenVAS scan') + ' ' + K.fmt(ls.scanDate || ls.importedAt), cat: 'maint', src: 'review', owner: a.owner, go: 'import' });
      }
    });
    // Termine aus der Roadmap (nur mit gesetztem Termin)
    if (s.reminders.roadmapDue) HA.Risk.roadmap(s, { includeProject: true }).forEach(function (x) {
      if (!x.due || x.kind === 'bcm') return;   // BCM-Maßnahmen liefert bcm.js selbst
      out.push({ key: 'RM:' + x.kind + ':' + x.ref + ':' + x.asset, date: x.due, title: x.ref + ': ' + x.title, sub: t('rm.kind.' + x.kind) + ' · ' + x.asset + ' · ' + x.prio.toUpperCase(), cat: 'measure', src: 'roadmap', owner: x.owner, go: 'roadmap', remind: 7 });
    });
    return out;
  });

  /* ------------------------------------------------------------------
   * Ansicht
   * ---------------------------------------------------------------- */
  function chip(e, small) {
    var col = e.state === 'overdue' ? '#c62828' : e.state === 'due' ? '#d48806' : catColor(e.cat);
    return '<button type="button" class="cal-chip' + (small ? ' sm' : '') + '" data-act="calOpen" data-id="' + esc(e.key) + '" style="border-left-color:' + col + '" title="' + esc(e.title + (e.sub ? ' – ' + e.sub : '')) + '">' + esc(small ? K.clip(e.title, 34) : e.title) + '</button>';
  }
  function stateBadge(e) {
    if (e.state === 'overdue') return K.amp('bad', L('überfällig seit ' + (-e.days) + ' T', 'overdue ' + (-e.days) + ' d'));
    if (e.state === 'due') return K.amp('warn', e.days === 0 ? L('heute', 'today') : L('in ' + e.days + ' T', 'in ' + e.days + ' d'));
    return '<span class="small muted">' + esc(L('in ' + e.days + ' T', 'in ' + e.days + ' d')) + '</span>';
  }
  function view() {
    var s = S(), all = entries();
    var list = all.filter(function (e) { return (!U.cat || e.cat === U.cat) && (!U.src || e.src === U.src); });
    var c = { overdue: 0, due: 0 }; all.forEach(function (e) { if (c[e.state] !== undefined) c[e.state]++; });
    var h = [K.pageHead(t('nav.calendar'), L('Wiederkehrende Pflichten, Normpflichten und automatische Reviews mit Erinnerung – Ihr Compliance-Kalender.', 'Recurring duties, norm obligations and automatic reviews with reminders – your compliance calendar.'),
      K.btn('calIcs', '📅 ' + L('ICS exportieren', 'Export ICS'), { title: L('Termine inkl. Erinnerungen in Outlook/Thunderbird/Apple-Kalender übernehmen', 'Import dates incl. reminders into Outlook/Thunderbird/Apple calendar') }) +
      K.btn('calTpl', '📜 ' + L('Normpflichten hinzufügen', 'Add norm duties')) + K.btn('calAdd', '+ ' + L('Pflicht', 'Duty'), { cls: 'btn-primary' }))];
    h.push('<div class="grid grid-4">' + K.stat(c.overdue, L('überfällig', 'overdue'), K.AMP.bad) + K.stat(c.due, L('demnächst fällig', 'due soon'), K.AMP.warn) +
      K.stat(s.duties.filter(function (d) { return d.active !== false; }).length, L('aktive Pflichten', 'active duties'), 'var(--primary)') +
      K.stat(all.filter(function (e) { return e.src !== 'duty'; }).length, L('automatische Reviews & Termine', 'automatic reviews & dates'), '#12a39a') + '</div>');
    h.push(K.tabs('calTab', [['agenda', ['Agenda', 'Agenda']], ['month', ['Monat', 'Month']], ['duties', ['Pflichtenliste', 'Duty list']], ['settings', ['Erinnerungen', 'Reminders']]], U.tab));
    if (U.tab !== 'settings' && U.tab !== 'duties') h.push('<div class="card no-print"><div class="filters"><div><label>' + esc(L('Kategorie', 'Category')) + '</label><select data-act="calFilter" data-k="cat">' + A.opt('', t('c.all'), U.cat) +
      Object.keys(CATS).map(function (k) { return A.opt(k, catLabel(k), U.cat); }).join('') + '</select></div><div><label>' + esc(L('Quelle', 'Source')) + '</label><select data-act="calFilter" data-k="src">' + A.opt('', t('c.all'), U.src) +
      [['duty', ['Pflichten', 'Duties']], ['review', ['Reviews', 'Reviews']], ['bcm', ['BCM', 'BCM']], ['roadmap', ['Roadmap', 'Roadmap']], ['kpi', ['KPI', 'KPI']]].map(function (x) { return A.opt(x[0], K.lab(x[1]), U.src); }).join('') + '</select></div></div></div>');
    if (U.tab === 'month') h.push(monthView(list));
    else if (U.tab === 'duties') h.push(dutyList());
    else if (U.tab === 'settings') h.push(settingsView());
    else h.push(agenda(list));
    return h.join('');
  }
  function agenda(list) {
    var h = [], groups = [['overdue', ['Überfällig', 'Overdue']], ['due', ['Demnächst fällig (innerhalb der Vorlaufzeit)', 'Due soon (within lead time)']], ['later90', ['Nächste 90 Tage', 'Next 90 days']], ['later', ['Später', 'Later']]];
    var by = { overdue: [], due: [], later90: [], later: [] };
    list.forEach(function (e) { if (e.state === 'later') (e.days <= 90 ? by.later90 : by.later).push(e); else by[e.state].push(e); });
    if (!list.length) return '<div class="card muted">' + esc(L('Keine Termine. Legen Sie Pflichten an oder übernehmen Sie Normpflichten.', 'No dates. Add duties or take over norm duties.')) + '</div>';
    groups.forEach(function (g) {
      var items = by[g[0]]; if (!items.length) return;
      if (g[0] === 'later') items = items.slice(0, 40);
      h.push('<div class="card"><h2>' + esc(K.lab(g[1])) + ' <span class="muted small">(' + by[g[0]].length + ')</span></h2>' + K.table([L('Fällig', 'Due'), { l: ['Termin', 'Item'], w: 260 }, L('Kategorie', 'Category'), L('Verantwortlich', 'Responsible'), L('Status', 'Status'), ''],
        items.map(function (e) {
          return '<tr><td class="nowrap"><b>' + K.fmt(e.date) + '</b></td><td><b>' + esc(e.title) + '</b><div class="small muted">' + esc(e.sub || '') + '</div></td><td>' + K.pill(catLabel(e.cat), catColor(e.cat)) + '</td><td class="small">' + esc(e.owner || '–') + '</td><td>' + stateBadge(e) + '</td>' +
            '<td class="nowrap">' + (e.duty || e.done ? K.btn('calDone', '✔ ' + L('Erledigt', 'Done'), { id: e.key, cls: 'btn-sm' }) : '') + (e.go ? ' ' + K.btn('kitGo', '↗', { id: e.go, cls: 'btn-sm', title: L('Öffnen', 'Open') }) : '') + '</td></tr>';
        })) + '</div>');
    });
    return h.join('');
  }
  /** Monatsansicht: Pflichten werden über ihr Intervall in die Zukunft projiziert. */
  function monthView(list) {
    var s = S(), base = U.month || K.today().slice(0, 7) + '-01';
    var d0 = K.parse(base), y = d0.getFullYear(), m = d0.getMonth();
    var first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
    var start = K.addDays(K.ymd(first), -((first.getDay() + 6) % 7)), end = K.ymd(last);
    var map = {};
    function put(date, e) { (map[date] = map[date] || []).push(e); }
    var today = K.today();
    list.forEach(function (e) {
      if (e.state === 'overdue' && e.date < start) { if (today >= start && today <= end) put(today, e); return; }
      put(e.date, e);
      if (e.duty) {   // Wiederholungen im sichtbaren Zeitraum
        var nx = step(e.duty, e.date), guard = 0;
        while (nx && nx <= end && guard++ < 60) { put(nx, Object.assign({}, e, { date: nx, days: K.diffDays(today, nx), state: 'later', key: e.key })); nx = step(e.duty, nx); }
      }
    });
    // Erledigte Pflichten des Monats als Haken
    s.duties.forEach(function (d) { d.history.forEach(function (hh) { if (hh.date >= start && hh.date <= end) put(hh.date, { key: 'D:' + d.id, title: '✓ ' + d.title, cat: d.cat, state: 'done', done_: true }); }); });
    var names = HA.lang === 'de' ? ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var h = ['<div class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">' + esc(first.toLocaleDateString(HA.lang === 'de' ? 'de-DE' : 'en-GB', { month: 'long', year: 'numeric' })) + '</h2><div class="row">' +
      K.btn('calMonth', '◀', { id: '-1', cls: 'btn-sm', title: L('Vormonat', 'Previous month') }) + K.btn('calMonth', L('Heute', 'Today'), { id: '0', cls: 'btn-sm' }) + K.btn('calMonth', '▶', { id: '1', cls: 'btn-sm', title: L('Folgemonat', 'Next month') }) + '</div></div>'];
    h.push('<div class="cal-grid">' + names.map(function (n) { return '<div class="cal-dow">' + n + '</div>'; }).join(''));
    for (var dt = start, i = 0; i < 42; i++, dt = K.addDays(dt, 1)) {
      if (i >= 35 && dt > end) break;
      var ev = map[dt] || [], out = dt.slice(0, 7) !== base.slice(0, 7);
      h.push('<div class="cal-day' + (out ? ' out' : '') + (dt === today ? ' today' : '') + '"><div class="cal-num">' + (+dt.slice(8)) + '</div>' + ev.slice(0, 4).map(function (e) {
        return e.done_ ? '<div class="cal-chip sm done">' + esc(K.clip(e.title, 34)) + '</div>' : chip(e, true); }).join('') + (ev.length > 4 ? '<div class="small muted">+' + (ev.length - 4) + '</div>' : '') + '</div>');
    }
    h.push('</div><div class="legend small" style="margin-top:.6rem"><span><i style="background:#c62828"></i>' + esc(L('überfällig', 'overdue')) + '</span><span><i style="background:#d48806"></i>' + esc(L('demnächst', 'due soon')) + '</span>' +
      Object.keys(CATS).map(function (k) { return '<span><i style="background:' + catColor(k) + '"></i>' + esc(catLabel(k)) + '</span>'; }).join('') + '</div></div>');
    return h.join('');
  }
  function dutyList() {
    var s = S();
    if (!s.duties.length) return '<div class="card muted">' + esc(L('Noch keine Pflichten. Über „Normpflichten hinzufügen“ können Sie typische Pflichten aus ISO/IEC 27001, BSI, DSGVO, NIS2 und BSI 200-4 übernehmen.', 'No duties yet. Use "Add norm duties" to take over typical duties from ISO/IEC 27001, BSI, GDPR, NIS2 and BSI 200-4.')) + '</div>';
    var rows = s.duties.map(function (d) {
      var nd = nextDue(d), last = d.history[d.history.length - 1];
      return '<tr' + (d.active === false ? ' style="opacity:.55"' : '') + '><td><b>' + esc(d.title) + '</b><div class="small muted">' + esc(d.norm || '') + '</div>' + (d.desc ? '<div class="small">' + esc(K.clip(d.desc, 160)) + '</div>' : '') + '</td><td>' + K.pill(catLabel(d.cat), catColor(d.cat)) + '</td>' +
        '<td class="small">' + esc(freqLabel(d)) + '</td><td class="small">' + esc(d.owner || '–') + '</td><td class="small nowrap">' + (last ? K.fmt(last.date) + (last.by ? '<div class="muted">' + esc(last.by) + '</div>' : '') : '–') + '</td>' +
        '<td class="small nowrap">' + (nd ? (nd < K.today() ? '<b style="color:var(--danger)">' + K.fmt(nd) + '</b>' : K.fmt(nd)) : '–') + '</td><td class="nowrap">' + K.btn('calDone', '✔', { id: 'D:' + d.id, cls: 'btn-sm', title: L('Erledigt', 'Done') }) + ' ' +
        K.btn('calEdit', '✏️', { id: d.id, cls: 'btn-sm', title: t('btn.edit') }) + ' ' + K.btn('calHist', '🕑', { id: d.id, cls: 'btn-sm', title: L('Historie', 'History') }) + ' ' + K.btn('calDel', '🗑', { id: d.id, cls: 'btn-sm btn-danger', title: t('btn.delete') }) + '</td></tr>';
    });
    return '<div class="card">' + K.table([{ l: ['Pflicht / Norm', 'Duty / norm'], w: 260 }, L('Kategorie', 'Category'), L('Intervall', 'Interval'), L('Verantwortlich', 'Responsible'), L('Zuletzt erledigt', 'Last done'), L('Nächste Fälligkeit', 'Next due'), ''], rows) + '</div>';
  }
  function settingsView() {
    var r = S().reminders, perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
    return '<div class="card"><h2>' + esc(L('Erinnerungen', 'Reminders')) + '</h2><div class="grid grid-2">' +
      '<div class="field"><label>' + esc(L('Standard-Vorlaufzeit (Tage)', 'Default lead time (days)')) + '</label><input type="number" min="0" data-field="remCfg" data-k="lead" value="' + esc(r.lead) + '"><div class="small muted">' + esc(L('so viele Tage vor Fälligkeit gilt ein Termin als „demnächst fällig“', 'items count as "due soon" this many days ahead')) + '</div></div>' +
      '<div class="field"><label>' + esc(L('Re-Audit je Asset alle (Monate)', 'Re-audit per asset every (months)')) + '</label><input type="number" min="1" data-field="remCfg" data-k="assetReviewMonths" value="' + esc(r.assetReviewMonths) + '"></div>' +
      '<div class="checks" style="grid-column:1/-1">' +
      '<label><input type="checkbox" data-act="remCheck" data-k="startToast"' + (r.startToast ? ' checked' : '') + '> ' + esc(L('Beim Öffnen auf fällige Termine hinweisen', 'Show due items when opening')) + '</label>' +
      '<label><input type="checkbox" data-act="remCheck" data-k="scanStale"' + (r.scanStale ? ' checked' : '') + '> ' + esc(L('Veraltete Schwachstellenscans als Termin anzeigen', 'Show stale vulnerability scans as items')) + '</label>' +
      '<label><input type="checkbox" data-act="remCheck" data-k="roadmapDue"' + (r.roadmapDue ? ' checked' : '') + '> ' + esc(L('Termine aus der Roadmap einbeziehen', 'Include roadmap due dates')) + '</label>' +
      '<label><input type="checkbox" data-act="remCheck" data-k="notify"' + (r.notify ? ' checked' : '') + (perm === 'unsupported' ? ' disabled' : '') + '> ' + esc(L('Browser-Benachrichtigung (solange Little-RiskBee geöffnet ist)', 'Browser notification (while Little-RiskBee is open)')) +
      ' <span class="small muted">(' + esc(perm === 'unsupported' ? L('nicht unterstützt', 'not supported') : perm === 'granted' ? L('erlaubt', 'granted') : perm === 'denied' ? L('im Browser blockiert', 'blocked in browser') : L('noch nicht erlaubt', 'not yet granted')) + ')</span></label></div></div>' +
      '<div class="note" style="margin-top:.8rem">' + esc(L('Little-RiskBee läuft ohne Server. Damit Sie auch bei geschlossener Seite erinnert werden, exportieren Sie die Termine als ICS-Datei: Wiederkehrende Pflichten werden als Serientermin mit Erinnerung (Vorlaufzeit) angelegt. Nach Änderungen einfach erneut exportieren und importieren (gleiche UID = Aktualisierung).',
        'Little-RiskBee runs without a server. To be reminded while the page is closed, export the dates as an ICS file: recurring duties become series with an alarm (lead time). After changes simply export and import again (same UID = update).')) + '</div>' +
      '<div class="row">' + K.btn('calIcs', '📅 ' + L('ICS exportieren', 'Export ICS'), { cls: 'btn-primary' }) + K.btn('calTest', '🔔 ' + L('Erinnerung jetzt prüfen', 'Check reminders now')) + '</div></div>';
  }

  /* ---------- Pflichten bearbeiten ---------- */
  function dutyFields() {
    return [
      { k: 'title', l: ['Pflicht / Aufgabe', 'Duty / task'], req: true, full: true },
      { k: 'norm', l: ['Norm / Rechtsgrundlage', 'Standard / legal basis'], ph: ['z. B. ISO/IEC 27001 Kap. 9.3', 'e.g. ISO/IEC 27001 cl. 9.3'] },
      { k: 'cat', l: ['Kategorie', 'Category'], type: 'select', opts: Object.keys(CATS).map(function (k) { return [k, CATS[k].slice(0, 2)]; }) },
      { k: 'owner', l: ['Verantwortlich', 'Responsible'], type: 'person' },
      { k: 'freq', l: ['Intervall', 'Interval'], type: 'select', opts: FREQ },
      { k: 'months', l: ['n Monate (bei „alle n Monate“)', 'n months (for "every n months")'], type: 'number', min: 1 },
      { k: 'start', l: ['Erste Fälligkeit', 'First due date'], type: 'date', req: true },
      { k: 'remind', l: ['Vorlaufzeit Erinnerung (Tage)', 'Reminder lead time (days)'], type: 'number', min: 0, help: ['leer = Standard aus den Erinnerungs-Einstellungen', 'empty = default from reminder settings'] },
      { k: 'active', type: 'check', l: ['aktiv', 'active'] },
      { k: 'desc', l: ['Beschreibung / Nachweis', 'Description / evidence'], type: 'textarea', full: true }
    ];
  }
  function editDuty(d) {
    var s = S(), isNew = !d;
    K.editDialog(isNew ? L('Pflicht anlegen', 'Add duty') : L('Pflicht bearbeiten', 'Edit duty'), dutyFields(), d || { title: '', norm: '', cat: 'review', owner: s.meta.auditor || '', freq: 'yearly', months: '', start: K.addDays(K.today(), 30), remind: '', active: true, desc: '', history: [] }, function (o) {
      if (isNew) { o.id = K.seq(s, 'dutySeq', 'PF-'); o.history = o.history || []; s.duties.push(o); }
    });
  }
  function templates() {
    var s = S(), have = {}; s.duties.forEach(function (d) { if (d.tpl) have[d.tpl] = 1; });
    var groups = {}; TEMPLATES.forEach(function (x) { (groups[x.g] = groups[x.g] || []).push(x); });
    var body = '<p class="small muted">' + esc(L('Typische Pflichten mit üblichen Intervallen. Bitte an die eigenen Vorgaben anpassen – maßgeblich sind die Originalquellen.', 'Typical duties with common intervals. Please adapt to your own requirements – the original sources are authoritative.')) + '</p>' +
      '<div class="field"><label>' + esc(L('Erste Fälligkeit (Standard)', 'First due date (default)')) + '</label><input type="date" name="start" value="' + K.addDays(K.today(), 30) + '"></div>' +
      '<div class="field"><label>' + esc(L('Verantwortlich (Standard)', 'Responsible (default)')) + '</label><input type="text" name="owner" data-person="1" value="' + esc(s.meta.auditor || '') + '"></div>' +
      Object.keys(groups).map(function (g) {
        return '<fieldset class="tpl-group"><legend><b>' + esc(g) + '</b></legend>' + groups[g].map(function (x) {
          return '<label class="tpl-item"><input type="checkbox" name="tpl" value="' + x.id + '"' + (have[x.id] ? ' disabled' : '') + '> <b>' + esc(K.lab(x.title)) + '</b> <span class="small muted">· ' + esc(x.norm) + ' · ' + esc(freqLabel(x)) + (have[x.id] ? ' · ' + L('bereits vorhanden', 'already added') : '') + '</span></label>';
        }).join('') + '</fieldset>';
      }).join('');
    var f = A.dialog(L('Normpflichten hinzufügen', 'Add norm duties'), body, function (form) {
      var start = form.querySelector('[name=start]').value || K.today(), owner = form.querySelector('[name=owner]').value.trim(), n = 0;
      Array.prototype.forEach.call(form.querySelectorAll('[name=tpl]:checked'), function (cb) {
        var x = TEMPLATES.find(function (y) { return y.id === cb.value; });
        s.duties.push({ id: K.seq(s, 'dutySeq', 'PF-'), tpl: x.id, title: K.lab(x.title), norm: x.norm, cat: x.cat, freq: x.freq, months: '', start: start, remind: '', owner: owner, active: true, desc: K.lab(x.desc), history: [] }); n++;
      });
      A.toast(L(n + ' Pflichten übernommen', n + ' duties added')); A.save(); A.render();
    }, L('Übernehmen', 'Add'));
    f.classList.add('dlg-wide');
  }
  function doneDialog(key) {
    var s = S(), e = entries().find(function (x) { return x.key === key; });
    var d = key.indexOf('D:') === 0 ? s.duties.find(function (x) { return 'D:' + x.id === key; }) : null;
    if (!e && !d) return;
    var title = d ? d.title : e.title;
    K.editDialog(L('Erledigt', 'Done') + ': ' + title, [
      { k: 'date', l: ['Erledigt am', 'Done on'], type: 'date', req: true }, { k: 'by', l: ['Erledigt von', 'Done by'], type: 'person' },
      { k: 'note', l: ['Ergebnis / Nachweis', 'Result / evidence'], type: 'textarea', full: true, ph: ['z. B. Protokoll vom …, Ablageort, Feststellungen', 'e.g. minutes of …, storage location, findings'] }],
      { date: K.today(), by: (d && d.owner) || (e && e.owner) || s.meta.auditor || '', note: '' }, function (o) {
        if (d) { d.history.push({ date: o.date, by: o.by, note: o.note, due: nextDue(d) }); d.lastDone = o.date; }
        else if (e.done) e.done(s, o);
      });
  }
  function historyDialog(id) {
    var d = S().duties.find(function (x) { return x.id === id; }); if (!d) return;
    A.dialog(L('Historie', 'History') + ': ' + d.title, d.history.length ? K.table([L('Erledigt am', 'Done on'), L('fällig war', 'was due'), L('von', 'by'), L('Ergebnis', 'Result')], d.history.slice().reverse().map(function (x) {
      var late = x.due && x.date > x.due;
      return '<tr><td class="nowrap">' + K.fmt(x.date) + (late ? ' ' + K.amp('warn', L('verspätet', 'late')) : '') + '</td><td class="nowrap">' + K.fmt(x.due) + '</td><td>' + esc(x.by || '–') + '</td><td class="small">' + esc(x.note || '') + '</td></tr>';
    })) : '<p class="muted">' + esc(L('Noch nicht erledigt.', 'Not done yet.')) + '</p>');
  }

  /* ---------- ICS-Export (RFC 5545) ---------- */
  function icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  /** Zeilen nach RFC 5545 auf 75 Oktette (UTF-8) falten. */
  function fold(line) {
    var enc = new TextEncoder(), out = [], cur = '', len = 0;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i], code = line.charCodeAt(i);
      if (code >= 0xD800 && code <= 0xDBFF) { ch += line[++i]; }   // Ersatzpaare (Emoji) nicht trennen
      var b = enc.encode(ch).length;
      if (len + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; len = 0; }
      cur += ch; len += b;
    }
    out.push(cur);
    return out.join('\r\n ');
  }
  function ics() {
    var s = S(), now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'), lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Little-RiskBee//Pflichtenkalender//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Little-RiskBee ' + icsEsc(s.meta.org || '')];
    function ev(uid, date, title, desc, rrule, remind) {
      var d = date.replace(/-/g, ''), d2 = K.addDays(date, 1).replace(/-/g, '');
      lines.push('BEGIN:VEVENT', 'UID:' + uid + '@little-riskbee.local', 'DTSTAMP:' + now, 'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + d2, 'SUMMARY:' + icsEsc(title), 'DESCRIPTION:' + icsEsc(desc), 'TRANSP:TRANSPARENT');
      if (rrule) lines.push('RRULE:' + rrule);
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(title), 'TRIGGER:-P' + Math.max(0, remind || 0) + 'D', 'END:VALARM', 'END:VEVENT');
    }
    var n = 0, horizon = K.addMonths(K.today(), 12);
    entries().forEach(function (e) {
      var date = e.date < K.today() ? K.today() : e.date;   // Überfälliges auf heute legen
      if (e.duty) {
        var d = e.duty, rr = null;
        if (d.freq === 'weekly') rr = 'FREQ=WEEKLY';
        else if (d.freq !== 'once') { var m = d.freq === 'custom' ? (+d.months || 1) : FM[d.freq]; rr = m % 12 === 0 ? 'FREQ=YEARLY;INTERVAL=' + (m / 12) : 'FREQ=MONTHLY;INTERVAL=' + m; }
        ev('duty-' + d.id, date, (e.state === 'overdue' && !rr ? '⚠ ' : '') + d.title, [d.norm, d.owner ? L('Verantwortlich: ', 'Responsible: ') + d.owner : '', d.desc].filter(Boolean).join('\n'), rr, e.remind); n++;
      } else if (e.date <= horizon) { ev(e.key.replace(/[^A-Za-z0-9-]/g, '_'), date, (e.state === 'overdue' ? '⚠ ' : '') + e.title, [e.sub, e.owner ? L('Verantwortlich: ', 'Responsible: ') + e.owner : ''].filter(Boolean).join('\n'), null, e.remind); n++; }
    });
    lines.push('END:VCALENDAR');
    K.download('little-riskbee_pflichten_' + K.today() + '.ics', lines.map(fold).join('\r\n') + '\r\n', 'text/calendar;charset=utf-8');
    A.toast(L(n + ' Termine exportiert', n + ' items exported'));
  }

  /* ---------- Erinnerung ---------- */
  function refreshBadge() {
    if (!S()) return;
    var c = counts();
    K.navBadge('calendar', c.overdue + c.due, c.overdue ? 'bad' : 'warn');
    return c;
  }
  function remind(force) {
    var s = S(), c = refreshBadge(); if (!c) return;
    if ((s.reminders.startToast || force) && (c.overdue || c.due)) A.toast('🔔 ' + L(c.overdue + ' überfällig, ' + c.due + ' demnächst fällig – siehe Pflichten & Reviews', c.overdue + ' overdue, ' + c.due + ' due soon – see Duties & reviews'), c.overdue > 0);
    else if (force) A.toast(L('Keine fälligen Termine.', 'No due items.'));
    if (s.reminders.notify && typeof Notification !== 'undefined' && Notification.permission === 'granted' && (c.overdue || c.due)) {
      try { new Notification('Little-RiskBee', { body: L(c.overdue + ' überfällig, ' + c.due + ' demnächst fällig', c.overdue + ' overdue, ' + c.due + ' due soon'), icon: 'assets/favicon-32.png', tag: 'lrb-reminder' }); } catch (e) { /* z. B. file:// ohne Berechtigung */ }
    }
  }
  function dashCard() {
    var list = entries().filter(function (e) { return e.state !== 'later'; });
    var s = S();
    if (!list.length && !s.duties.length) return '<div class="card"><h2>🔔 ' + esc(L('Pflichten & Reviews', 'Duties & reviews')) + '</h2><p class="small muted">' + esc(L('Noch keine Pflichten hinterlegt.', 'No duties yet.')) + '</p><a class="btn btn-sm" href="#calendar">' + esc(L('Pflichtenkalender einrichten →', 'Set up duty calendar →')) + '</a></div>';
    if (!list.length) return '';
    return '<div class="card"><h2>🔔 ' + esc(L('Fällige Pflichten & Reviews', 'Due duties & reviews')) + ' <span class="muted small">(' + list.length + ')</span></h2>' + K.table([L('Fällig', 'Due'), L('Termin', 'Item'), L('Status', 'Status'), ''], list.slice(0, 8).map(function (e) {
      return '<tr><td class="nowrap">' + K.fmt(e.date) + '</td><td><b>' + esc(e.title) + '</b><div class="small muted">' + esc(e.owner || '') + '</div></td><td>' + stateBadge(e) + '</td><td class="nowrap">' + (e.duty || e.done ? K.btn('calDone', '✔', { id: e.key, cls: 'btn-sm', title: L('Erledigt', 'Done') }) : '') + '</td></tr>';
    })) + '<a class="btn btn-sm" href="#calendar" style="margin-top:.5rem">' + esc(t('nav.calendar')) + ' →</a></div>';
  }

  /* ------------------------------------------------------------------
   * Registrierung
   * ---------------------------------------------------------------- */
  A.views.calendar = view;
  A.ext.dashCards.push(dashCard);
  A.ext.afterRender.push(function () { refreshBadge(); if (!notified) { notified = true; setTimeout(function () { remind(false); }, 600); } });
  setInterval(function () { if (S()) remind(false); }, 3600 * 1000);   // stündlich prüfen, solange die Seite offen ist
  A.ext.click.push(function (act, el) {
    var s = S(), id = el.getAttribute('data-id');
    switch (act) {
      case 'calTab': U.tab = id; A.render(); return true;
      case 'calAdd': editDuty(null); return true;
      case 'calEdit': editDuty(s.duties.find(function (d) { return d.id === id; })); return true;
      case 'calDel': { var d = s.duties.find(function (x) { return x.id === id; });
        A.confirm(L('Pflicht „' + d.title + '“ inkl. Historie löschen?', 'Delete duty "' + d.title + '" incl. history?'), function () { s.duties = s.duties.filter(function (x) { return x.id !== id; }); A.save(); A.render(); }); return true; }
      case 'calDone': doneDialog(id); return true;
      case 'calHist': historyDialog(id); return true;
      case 'calTpl': templates(); return true;
      case 'calIcs': ics(); return true;
      case 'calTest': remind(true); return true;
      case 'calMonth': {
        var cur = U.month || K.today().slice(0, 7) + '-01';
        U.month = id === '0' ? '' : K.addMonths(cur, +id); A.render(); return true;
      }
      case 'calOpen': {
        var e = entries().find(function (x) { return x.key === id; });
        if (!e) return true;
        if (e.duty || e.done) doneDialog(id); else if (e.go) A.go(e.go);
        return true;
      }
    }
  });
  A.ext.change.push(function (act, el) {
    var s = S();
    if (act === 'calFilter') { U[el.getAttribute('data-k')] = el.value; A.render(); return true; }
    if (act === 'remCheck') {
      var k = el.getAttribute('data-k'); s.reminders[k] = el.checked;
      if (k === 'notify' && el.checked && typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission().then(function () { A.render(); }).catch(function () { A.render(); });
      }
      A.save(); A.render(); return true;
    }
    if (act === 'remCfg') { A.render(); return true; }
  });
  A.ext.input.push(function (act, el) {
    if (act === 'remCfg') { S().reminders[el.getAttribute('data-k')] = +el.value || 0; A.save(); return true; }
  });
  // Bericht
  A.ext.reportOpts.push({ key: 'calendar', label: { de: 'Pflichtenkalender & Reviews', en: 'Duty calendar & reviews' } });
  HA.Report.ext.push({ key: 'calendar', build: function (state, scope, H) {
    var all = entries(), soon = all.filter(function (e) { return e.days <= 90; });
    if (!state.duties.length && !soon.length) return '';
    var h = ['<section class="pb"><h2>' + H.esc(L('Pflichtenkalender und Reviews', 'Duty calendar and reviews')) + '</h2>'];
    if (state.duties.length) {
      h.push('<h3>' + H.esc(L('Pflichten', 'Duties')) + '</h3><table><thead><tr><th>' + H.esc(L('Pflicht', 'Duty')) + '</th><th style="width:38mm">' + H.esc(L('Norm', 'Standard')) + '</th><th style="width:20mm">' + H.esc(L('Intervall', 'Interval')) + '</th><th style="width:26mm">' + H.esc(L('Verantwortlich', 'Responsible')) +
        '</th><th style="width:20mm">' + H.esc(L('zuletzt', 'last')) + '</th><th style="width:20mm">' + H.esc(L('nächste', 'next')) + '</th></tr></thead><tbody>');
      state.duties.filter(function (d) { return d.active !== false; }).forEach(function (d) {
        var nd = nextDue(d);
        h.push('<tr><td>' + H.esc(d.title) + '</td><td class="small">' + H.esc(d.norm || '') + '</td><td class="small">' + H.esc(freqLabel(d)) + '</td><td class="small">' + H.esc(d.owner || '–') + '</td><td>' + H.fmtDate(d.lastDone) + '</td><td' + (nd && nd < K.today() ? ' style="color:#c62828;font-weight:700"' : '') + '>' + H.fmtDate(nd) + '</td></tr>');
      });
      h.push('</tbody></table>');
    }
    if (soon.length) {
      h.push('<h3>' + H.esc(L('Überfällig und nächste 90 Tage', 'Overdue and next 90 days')) + '</h3><table><thead><tr><th style="width:22mm">' + H.esc(L('Fällig', 'Due')) + '</th><th>' + H.esc(L('Termin', 'Item')) + '</th><th style="width:30mm">' + H.esc(L('Verantwortlich', 'Responsible')) + '</th></tr></thead><tbody>' +
        soon.map(function (e) { return '<tr><td' + (e.state === 'overdue' ? ' style="color:#c62828;font-weight:700"' : '') + '>' + H.fmtDate(e.date) + '</td><td>' + H.esc(e.title) + '<div class="small muted">' + H.esc(e.sub || '') + '</div></td><td class="small">' + H.esc(e.owner || '–') + '</td></tr>'; }).join('') + '</tbody></table>');
    }
    h.push('</section>');
    return h.join('');
  } });

  return { providers: providers, entries: entries, counts: counts, nextDue: nextDue, catColor: catColor, catLabel: catLabel, TEMPLATES: TEMPLATES, refreshBadge: refreshBadge };
})();

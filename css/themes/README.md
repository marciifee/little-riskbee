# Zusatz-Stile für Little-RiskBee

Diese CSS-Dateien lassen sich unter **Einstellungen → Darstellung: Style-Wechsler** auswählen.

| Datei | Inhalt | Modus |
|---|---|---|
| `honey.css` | warme Bienenfarben passend zum Logo | ergänzen |
| `contrast.css` | hoher Kontrast, größere Schrift, deutlicher Fokus (Barrierefreiheit) | ergänzen |
| `compact.css` | dichtere Darstellung für große Bildschirme | ergänzen |

**Eigenen Stil anlegen:** In den Einstellungen „Vorlage herunterladen“, Datei z. B. als
`css/themes/mein-stil.css` speichern, Farben anpassen und dann „Eigener Pfad …“ wählen
(oder die Datei direkt hochladen).

- **ergänzen**: Datei wird nach `css/style.css` geladen und überschreibt nur einzelne Werte (empfohlen).
- **ersetzen**: `css/style.css` wird abgeschaltet – die eigene Datei muss dann das komplette Layout enthalten
  (am besten eine Kopie von `css/style.css` als Ausgangspunkt nehmen).

Nur lokale Dateien sind erlaubt (Content-Security-Policy, DSGVO): keine Webfonts oder externen `url()`/`@import`.
Wird die Oberfläche unbrauchbar, `index.html?style=default` öffnen und den Stil zurücksetzen.

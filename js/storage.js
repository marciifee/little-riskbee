/* =====================================================================
 * storage.js – Lokale Speicherung ohne Installation
 * ---------------------------------------------------------------------
 * Reihenfolge der Speicherorte:
 *   1. IndexedDB  (in jedem modernen Browser eingebaut, große Datenmengen)
 *   2. localStorage (Fallback, ca. 5 MB)
 *   3. Arbeitsspeicher (letzter Fallback, z. B. bei restriktiven
 *      Browser-Einstellungen für file://) – dann unbedingt als Datei sichern
 * Zusätzlich: Export/Import des gesamten Zustands als JSON-Datei.
 * Es werden keinerlei Daten an Server übertragen.
 * ===================================================================== */
window.HA = window.HA || {};

HA.Storage = (function () {
  'use strict';
  var DB_NAME = 'hardening-audit', STORE = 'kv', KEY = 'state', LS_KEY = 'hardening-audit-state';
  var mode = 'mem';      // 'idb' | 'ls' | 'mem'
  var db = null;
  var memCopy = null;

  /** Öffnet die IndexedDB (Promise). */
  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!('indexedDB' in window)) return reject(new Error('no indexedDB'));
      var req;
      try { req = indexedDB.open(DB_NAME, 1); } catch (e) { return reject(e); }
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
      req.onblocked = function () { reject(new Error('blocked')); };
    });
  }

  function idbGet() {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, 'readonly');
      var r = tx.objectStore(STORE).get(KEY);
      r.onsuccess = function () { resolve(r.result || null); };
      r.onerror = function () { reject(r.error); };
    });
  }
  function idbPut(value) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, KEY);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  }
  function idbClear() {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  }

  /** Prüft, ob localStorage benutzbar ist. */
  function lsAvailable() {
    try { localStorage.setItem('__ha_test', '1'); localStorage.removeItem('__ha_test'); return true; } catch (e) { return false; }
  }

  return {
    /** Initialisiert den besten verfügbaren Speicher und lädt den Zustand. */
    init: function () {
      return openDb().then(function (d) {
        db = d; mode = 'idb';
        return idbGet();
      }).catch(function () {
        if (lsAvailable()) {
          mode = 'ls';
          try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { return null; }
        }
        mode = 'mem';
        return memCopy;
      });
    },
    /** Speichert den Zustand (Objekt). */
    save: function (state) {
      if (mode === 'idb') {
        // structuredClone über JSON: entfernt Funktionen/undefined zuverlässig
        return idbPut(JSON.parse(JSON.stringify(state)));
      }
      if (mode === 'ls') {
        try { localStorage.setItem(LS_KEY, JSON.stringify(state)); return Promise.resolve(); }
        catch (e) { return Promise.reject(e); }   // z. B. Kontingent überschritten
      }
      memCopy = JSON.parse(JSON.stringify(state));
      return Promise.resolve();
    },
    /** Löscht alle lokal gespeicherten Daten. */
    wipe: function () {
      memCopy = null;
      try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignorieren */ }
      return mode === 'idb' ? idbClear() : Promise.resolve();
    },
    mode: function () { return mode; },

    /** Bietet den Zustand als JSON-Datei zum Herunterladen an. */
    exportFile: function (state, filename) {
      var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      HA.Storage.download(blob, filename);
    },
    /** Hilfsfunktion: Blob als Datei herunterladen (funktioniert auch unter file://). */
    download: function (blob, filename) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }
  };
})();

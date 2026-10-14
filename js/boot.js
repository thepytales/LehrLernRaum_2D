/* Früh geladen (im <head>): Ansicht „Einfach | Profi“ und Darstellung
   (Kontrast, Schriftgröße, große Schaltflächen, Bewegung, Farben, Fokus)
   werden gesetzt, bevor die Seite gezeichnet wird. Die Einstellungen
   gelten je Browser, nicht je Plan. */
(function (LLR) {
  'use strict';
  const KEY = 'llr2d.prefs.v1';
  const DEF = {
    level: null, // 'einfach' | 'profi'
    contrast: 'auto', // 'auto' | 'normal' | 'high' | 'dark'
    text: 100, // Schriftgröße der Bedienelemente in %: 100 | 115 | 130
    targets: 'normal', // 'normal' | 'large' (Schaltflächen mind. 44 px)
    motion: 'auto', // 'auto' (wie System) | 'reduce'
    colors: 'standard', // 'standard' | 'cvd' (bei Farbsehschwäche)
    focus: 'normal', // 'normal' | 'strong'
    start: false, // Startauswahl bei jedem Start zeigen
    tips: {}, // bereits gezeigte Tipps
    recent: [], // zuletzt benutzte Befehle (Befehlssuche)
  };
  const TEXT = [100, 115, 130];

  const st = Object.assign({}, DEF);
  try {
    Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}'));
  } catch (e) {
    /* ohne Speicher gelten die Standardwerte */
  }
  if (!TEXT.includes(Number(st.text))) st.text = 100;
  st.text = Number(st.text);
  if (!st.tips || typeof st.tips !== 'object') st.tips = {};
  if (!Array.isArray(st.recent)) st.recent = [];

  // Wer den Planer schon kennt, startet in der Profi-Ansicht (dort ist alles
  // wie bisher) und bekommt einmal einen Hinweis auf den neuen Schalter.
  let introduce = false;
  if (st.level !== 'einfach' && st.level !== 'profi') {
    let known = false;
    try {
      known = !!(localStorage.getItem('llr2d.seen.v2') || localStorage.getItem('llr2d.autosave.v1'));
    } catch (e) {
      /* unbekannt */
    }
    st.level = known ? 'profi' : 'einfach';
    introduce = known;
  }

  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(st));
    } catch (e) {
      /* ohne Speicher gilt die Einstellung bis zum Neuladen */
    }
  };
  const mq = (q) => !!(window.matchMedia && window.matchMedia(q).matches);

  /* Statusfarben: gut / eingeschränkt / Problem. Bei Farbsehschwäche Blau,
     Orange und Weinrot – sie unterscheiden sich auch in der Helligkeit.
     Die Symbole (Haken, Ausrufezeichen, Kreuz) bleiben immer gleich. */
  const PALETTES = {
    standard: {
      good: '#2F9E44',
      warn: '#F59F00',
      bad: '#E03131',
      free: [116, 205, 132, 90],
      turn: [47, 158, 68, 110],
      blocked: [224, 49, 49, 95],
    },
    cvd: {
      good: '#1F6FB2',
      warn: '#E69F00',
      bad: '#8E1B4F',
      free: [120, 176, 226, 105],
      turn: [31, 111, 178, 125],
      blocked: [142, 27, 79, 95],
    },
  };

  const contrast = () => (st.contrast === 'auto' ? (mq('(prefers-contrast: more)') ? 'high' : 'normal') : st.contrast);
  const reduceMotion = () => st.motion === 'reduce' || (st.motion === 'auto' && mq('(prefers-reduced-motion: reduce)'));

  function apply() {
    const h = document.documentElement;
    const c = contrast();
    h.dataset.level = st.level;
    h.dataset.contrast = c;
    h.dataset.text = String(st.text);
    h.dataset.targets = st.targets === 'large' ? 'large' : 'normal';
    h.dataset.motion = reduceMotion() ? 'reduce' : 'auto';
    h.dataset.colors = st.colors === 'cvd' ? 'cvd' : 'standard';
    h.dataset.focus = st.focus === 'strong' || c === 'high' ? 'strong' : 'normal';
    h.style.setProperty('--ui-zoom', String(st.text / 100));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', c === 'dark' ? '#20242b' : c === 'high' ? '#000000' : '#1F4AA8');
  }

  const listeners = [];
  const emit = (key) => listeners.forEach((fn) => fn(key));

  LLR.prefs = {
    TEXT,
    get: (k) => st[k],
    set(k, v) {
      st[k] = v;
      save();
      apply();
      emit(k);
    },
    /* mehrere Werte auf einmal (z. B. Abbrechen im Einstellungsdialog) */
    assign(obj) {
      Object.assign(st, obj);
      save();
      apply();
      emit('*');
    },
    snapshot: () => JSON.parse(JSON.stringify(st)),
    on: (fn) => listeners.push(fn),
    isPro: () => st.level === 'profi',
    contrast,
    reduceMotion,
    zoom: () => st.text / 100,
    pal: () => PALETTES[st.colors] || PALETTES.standard,
    /* Größe von Marken und Etiketten im Plan (Schriftgröße, Kontrast) */
    markScale: () => (st.text / 100) * (contrast() === 'high' ? 1.15 : 1),
    introduce,
    tipSeen: (key) => !!st.tips[key],
    markTip(key) {
      st.tips[key] = 1;
      save();
    },
    useCmd(id) {
      st.recent = [id].concat(st.recent.filter((x) => x !== id)).slice(0, 8);
      save();
    },
  };

  apply();
  // Systemeinstellungen können sich während der Sitzung ändern
  for (const q of ['(prefers-contrast: more)', '(prefers-reduced-motion: reduce)']) {
    const m = window.matchMedia && window.matchMedia(q);
    if (m && m.addEventListener)
      m.addEventListener('change', () => {
        apply();
        emit('system');
      });
  }
})((window.LLR = window.LLR || {}));

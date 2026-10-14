/* Befehle: ein gemeinsames Verzeichnis für Befehlssuche (Strg+K),
   Tastenkürzel (?), Kontextmenü (Rechtsklick, langes Drücken, Umschalt+F10)
   und den sichtbaren Verlauf. Ausgeführt wird über LLR.ui.doAct. */
(function (LLR) {
  'use strict';
  const A = LLR.analysis;
  const T = LLR.TYPES;
  const app = LLR.app;
  const esc = LLR.esc;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const ui = () => LLR.ui;
  const icon = (id) => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
  const pro = () => LLR.prefs.isPro();
  const sel = () => app.selectedObjects();
  const hasSel = () => app.sel.size > 0;
  const unlockedSel = () => sel().some((o) => !o.locked);
  const tablesSel = () => sel().some((o) => A.isTable(o) && !o.locked);
  const multi = () => app.units().length > 1;
  const run = (act) => () => ui().doAct(act);

  /* ---------- Verzeichnis ---------- */
  const BASE = [
    // Datei
    { id: 'start', group: 'Datei', label: 'Was möchten Sie tun? (Startauswahl)', icon: 'i-home' },
    { id: 'wizard', group: 'Datei', label: 'Stunde planen (Assistent)', icon: 'i-wand', search: 'unterricht anordnung sozialform' },
    { id: 'new', group: 'Datei', label: 'Neuer Plan …', icon: 'i-file-plus', search: 'raum leer klassenzimmer' },
    { id: 'plans', group: 'Datei', label: 'Pläne speichern & öffnen …', icon: 'i-folder', search: 'laden datei json' },
    { id: 'savePlan', group: 'Datei', label: 'Plan im Browser speichern', icon: 'i-save', keys: 'Strg+S' },
    { id: 'printWho', group: 'Datei', label: 'Drucken & Exportieren …', icon: 'i-printer', search: 'pdf für wen' },
    { id: 'print:class', group: 'Datei', label: 'Drucken: Aushang für die Klasse', icon: 'i-users', when: () => app.learners().some((l) => app.seatOf(l.id)), act: () => ui().printPlan('class') },
    { id: 'print:seating', group: 'Datei', label: 'Drucken: Sitzplan für mich (vertraulich)', icon: 'i-printer', when: () => app.learners().length > 0, act: () => ui().printPlan('seating') },
    { id: 'print:rebuild', group: 'Datei', label: 'Drucken: Umbaukarte', icon: 'i-steps', act: () => ui().printPlan('rebuild', { all: true }) },
    { id: 'print:plan', group: 'Datei', label: 'Drucken: Unterrichtsentwurf (Plan & Prüfungen)', icon: 'i-printer', act: () => ui().printPlan('plan', { phases: 'all' }) },
    { id: 'export', group: 'Datei', label: 'Als Bild speichern (PNG)', icon: 'i-image' },
    { id: 'share', group: 'Datei', label: 'Teilen: Link zum Plan …', icon: 'i-link' },
    { id: 'settings', group: 'Datei', label: 'Raum & Einstellungen …', icon: 'i-sliders', search: 'raumgröße maße' },
    { id: 'a11y', group: 'Datei', label: 'Darstellung & Barrierefreiheit …', icon: 'i-contrast', search: 'kontrast schrift dunkel farbe' },
    { id: 'rules', group: 'Datei', label: 'Prüfregeln & Profile …', icon: 'i-check', search: 'din grenzwerte gewichte reizarm', pro: true },
    { id: 'furniture', group: 'Datei', label: 'Eigene Möbel & Räume …', icon: 'i-cube', search: 'bibliothek', pro: true },
    { id: 'newFurniture', group: 'Datei', label: 'Neues eigenes Möbelstück …', icon: 'i-plus', pro: true },
    { id: 'saveTemplate', group: 'Datei', label: 'Anordnung als Vorlage speichern …', icon: 'i-save', search: 'eigene vorlage' },
    { id: 'exportLibrary', group: 'Datei', label: 'Eigene Bibliothek exportieren', icon: 'i-download', pro: true },
    // Bearbeiten
    { id: 'undo', group: 'Bearbeiten', label: 'Rückgängig', icon: 'i-undo', keys: 'Strg+Z', when: () => app.undoStack.length > 0 },
    { id: 'redo', group: 'Bearbeiten', label: 'Wiederholen', icon: 'i-redo', keys: 'Strg+Y', when: () => app.redoStack.length > 0 },
    { id: 'history', group: 'Bearbeiten', label: 'Verlauf …', icon: 'i-history', search: 'schritte zurück' },
    { id: 'rot90', group: 'Bearbeiten', label: 'Um 90° drehen (im Uhrzeigersinn)', icon: 'i-rot90', keys: '9', when: unlockedSel },
    { id: 'rot90l', group: 'Bearbeiten', label: 'Um 90° drehen (gegen den Uhrzeigersinn)', icon: 'i-rot-ccw', keys: 'Umschalt+9', when: unlockedSel },
    { id: 'rot180', group: 'Bearbeiten', label: 'Um 180° drehen', icon: 'i-rot-cw', when: unlockedSel },
    { id: 'rotr', group: 'Bearbeiten', label: 'Drehen +15°', icon: 'i-rot-cw', keys: 'R', when: unlockedSel, pro: true },
    { id: 'rotl', group: 'Bearbeiten', label: 'Drehen −15°', icon: 'i-rot-ccw', keys: 'Umschalt+R', when: unlockedSel, pro: true },
    { id: 'dup', group: 'Bearbeiten', label: 'Duplizieren', icon: 'i-copy', keys: 'Strg+D', when: hasSel },
    { id: 'copy', group: 'Bearbeiten', label: 'Kopieren', icon: 'i-copy', keys: 'Strg+C', when: hasSel },
    { id: 'paste', group: 'Bearbeiten', label: 'Einfügen', icon: 'i-paste', keys: 'Strg+V', when: () => !!app.clipboard },
    { id: 'chairs', group: 'Bearbeiten', label: 'Stühle an freie Tischkanten stellen', icon: 'i-chair-add', when: tablesSel },
    { id: 'chairsDel', group: 'Bearbeiten', label: 'Stühle von den Tischen wegnehmen', icon: 'i-chair-del', when: tablesSel },
    { id: 'lock', group: 'Bearbeiten', label: 'Sperren / Entsperren', icon: 'i-lock', keys: 'L', when: hasSel },
    { id: 'del', group: 'Bearbeiten', label: 'Löschen', icon: 'i-trash', keys: 'Entf', when: unlockedSel, danger: true },
    // Auswahl
    { id: 'selectAll', group: 'Auswahl', label: 'Alles auswählen (nicht gesperrt)', icon: 'i-multi', keys: 'Strg+A' },
    { id: 'none', group: 'Auswahl', label: 'Auswahl aufheben', icon: 'i-x', keys: 'Esc', when: hasSel },
    { id: 'group', group: 'Auswahl', label: 'Ganze Tischgruppe auswählen', icon: 'i-multi', keys: 'Strg+G', when: () => sel().length === 1 && (A.isTable(sel()[0]) || sel()[0].type === 'partition') },
    { id: 'nextObj', group: 'Auswahl', label: 'Nächstes Objekt auswählen', icon: 'i-chev-right', keys: 'N' },
    { id: 'prevObj', group: 'Auswahl', label: 'Voriges Objekt auswählen', icon: 'i-chev-left', keys: 'Umschalt+N' },
    { id: 'multi', group: 'Auswahl', label: 'Mehrfachauswahl an/aus', icon: 'i-multi', pro: true },
    // Ausrichten (Profi)
    { id: 'align:left', group: 'Ausrichten', label: 'Links ausrichten', icon: 'i-al-left', keys: 'Strg+Umschalt+←', when: hasSel, pro: true },
    { id: 'align:hcenter', group: 'Ausrichten', label: 'Waagerecht mittig ausrichten', icon: 'i-al-hc', when: hasSel, pro: true },
    { id: 'align:right', group: 'Ausrichten', label: 'Rechts ausrichten', icon: 'i-al-right', keys: 'Strg+Umschalt+→', when: hasSel, pro: true },
    { id: 'align:top', group: 'Ausrichten', label: 'Oben ausrichten', icon: 'i-al-top', keys: 'Strg+Umschalt+↑', when: hasSel, pro: true },
    { id: 'align:vcenter', group: 'Ausrichten', label: 'Senkrecht mittig ausrichten', icon: 'i-al-vc', when: hasSel, pro: true },
    { id: 'align:bottom', group: 'Ausrichten', label: 'Unten ausrichten', icon: 'i-al-bottom', keys: 'Strg+Umschalt+↓', when: hasSel, pro: true },
    { id: 'dist:x', group: 'Ausrichten', label: 'Waagerecht gleichmäßig verteilen', icon: 'i-dist-h', when: () => app.units().length > 2, pro: true },
    { id: 'dist:y', group: 'Ausrichten', label: 'Senkrecht gleichmäßig verteilen', icon: 'i-dist-v', when: () => app.units().length > 2, pro: true },
    { id: 'distgap:x', group: 'Ausrichten', label: 'Nebeneinander mit festem Abstand', icon: 'i-dist-h', when: multi, pro: true, search: 'abstand cm' },
    { id: 'distgap:y', group: 'Ausrichten', label: 'Untereinander mit festem Abstand', icon: 'i-dist-v', when: multi, pro: true, search: 'abstand cm' },
    { id: 'mirror:x', group: 'Ausrichten', label: 'Spiegeln: links ↔ rechts', icon: 'i-flip-h', keys: 'Umschalt+H', when: unlockedSel, pro: true },
    { id: 'mirror:y', group: 'Ausrichten', label: 'Spiegeln: oben ↔ unten', icon: 'i-flip-v', keys: 'Umschalt+V', when: unlockedSel, pro: true },
    // Ansicht
    { id: 'toggleLevel', group: 'Ansicht', label: 'Ansicht umschalten: Einfach ↔ Profi', icon: 'i-sliders' },
    { id: 'fit', group: 'Ansicht', label: 'Ganzen Raum zeigen', icon: 'i-fit', keys: '0' },
    { id: 'zoomIn', group: 'Ansicht', label: 'Vergrößern', icon: 'i-plus', keys: '+' },
    { id: 'zoomOut', group: 'Ansicht', label: 'Verkleinern', icon: 'i-minus', keys: '−' },
    { id: 'grid', group: 'Ansicht', label: 'Raster ein/aus', icon: 'i-grid', keys: 'G', pro: true },
    { id: 'gridSnap', group: 'Ansicht', label: 'Am Raster einrasten ein/aus', icon: 'i-grid', keys: 'Umschalt+G', pro: true },
    { id: 'snap', group: 'Ansicht', label: 'Magnetisch einrasten ein/aus', icon: 'i-magnet' },
    { id: 'dims', group: 'Ansicht', label: 'Abstände am Objekt ein/aus', icon: 'i-dims', pro: true },
    { id: 'roomDims', group: 'Ansicht', label: 'Raummaße ein/aus', icon: 'i-roomdims', pro: true },
    { id: 'measure', group: 'Ansicht', label: 'Messen', icon: 'i-ruler', keys: 'M', pro: true },
    { id: 'keepMeasure', group: 'Ansicht', label: 'Messung als Maßlinie behalten', icon: 'i-dims', keys: 'Eingabe', when: () => !!app.measure, pro: true },
    { id: 'contrast:high', group: 'Darstellung', label: 'Hoher Kontrast an/aus', icon: 'i-contrast', act: () => LLR.prefs.set('contrast', LLR.prefs.contrast() === 'high' ? 'normal' : 'high') },
    { id: 'contrast:dark', group: 'Darstellung', label: 'Dunkle Oberfläche an/aus', icon: 'i-contrast', act: () => LLR.prefs.set('contrast', LLR.prefs.contrast() === 'dark' ? 'normal' : 'dark') },
    { id: 'text:bigger', group: 'Darstellung', label: 'Schrift größer', icon: 'i-plus', act: () => stepText(1) },
    { id: 'text:smaller', group: 'Darstellung', label: 'Schrift kleiner', icon: 'i-minus', act: () => stepText(-1) },
    { id: 'colors', group: 'Darstellung', label: 'Farben bei Farbsehschwäche an/aus', icon: 'i-eye', act: () => LLR.prefs.set('colors', LLR.prefs.get('colors') === 'cvd' ? 'standard' : 'cvd') },
    // Prüfen
    { id: 'lens:access', group: 'Prüfen', label: 'Prüfansicht: Rollstuhl', icon: 'i-wheelchair', keys: '1' },
    { id: 'lens:sight', group: 'Prüfen', label: 'Prüfansicht: Sicht auf Tafel & Bildschirme', icon: 'i-eye', keys: '2' },
    { id: 'lens:teacher', group: 'Prüfen', label: 'Prüfansicht: Lehrkraft', icon: 'i-teacher', keys: '3' },
    { id: 'lens:calm', group: 'Prüfen', label: 'Prüfansicht: Ruhe & Reize', icon: 'i-leaf', keys: '4' },
    { id: 'lens:seating', group: 'Prüfen', label: 'Prüfansicht: Sitzplan & Bedarfe', icon: 'i-users', keys: '5', when: () => app.learners().length > 0 },
    { id: 'lens:rebuild', group: 'Prüfen', label: 'Prüfansicht: Umbau', icon: 'i-steps', keys: '6', when: () => !!app.doc.phases && app.phaseIndex() > 0 },
    { id: 'lens:none', group: 'Prüfen', label: 'Prüfansicht ausblenden', icon: 'i-x', when: () => !!app.lens() },
    { id: 'wheelchair', group: 'Prüfen', label: 'Test-Rollstuhl einfügen', icon: 'i-wheelchair' },
    { id: 'addTeacher', group: 'Prüfen', label: 'Lehrkraft-Position einfügen', icon: 'i-teacher' },
    { id: 'mark:noSight', group: 'Prüfen', label: 'Plätze ohne Blick auf die Tafel markieren', icon: 'i-eye' },
    { id: 'mark:noReach', group: 'Prüfen', label: 'Für die Lehrkraft unerreichbare Plätze markieren', icon: 'i-teacher' },
    { id: 'mark:busy', group: 'Prüfen', label: 'Unruhige Plätze markieren', icon: 'i-leaf' },
    { id: 'showProblems', group: 'Prüfen', label: 'Überschneidungen markieren', icon: 'i-alert', when: () => app.problems.size > 0 },
    // Phasen & Lernende
    { id: 'phase:add', group: 'Phasen', label: 'Neue Phase (Kopie der jetzigen)', icon: 'i-steps', act: () => app.addPhase(null) },
    { id: 'nextPhase', group: 'Phasen', label: 'Nächste Phase', icon: 'i-chev-right', keys: 'Bild ↓', when: () => !!app.doc.phases && app.phaseIndex() < app.doc.phases.length - 1 },
    { id: 'prevPhase', group: 'Phasen', label: 'Vorige Phase', icon: 'i-chev-left', keys: 'Bild ↑', when: () => !!app.doc.phases && app.phaseIndex() > 0 },
    { id: 'openPhases', group: 'Phasen', label: 'Phasen verwalten', icon: 'i-steps' },
    { id: 'openLearners', group: 'Lernende', label: 'Lernende & Sitzplan öffnen', icon: 'i-users' },
    { id: 'learners:paste', group: 'Lernende', label: 'Lernende: Liste einfügen …', icon: 'i-users', act: () => (ui().openLibTab('learners'), LLR.classUI.paste()) },
    { id: 'autoSeat', group: 'Lernende', label: 'Lernende automatisch verteilen', icon: 'i-shuffle', when: () => app.learners().length > 0 },
    // Reiter & Hilfe
    { id: 'tab:catalog', group: 'Reiter', label: 'Möbel', icon: 'i-box' },
    { id: 'tab:presets', group: 'Reiter', label: 'Anordnungen', icon: 'i-layout' },
    { id: 'tab:objects', group: 'Reiter', label: 'Im Raum (Objektliste)', icon: 'i-list', pro: true },
    { id: 'details', group: 'Reiter', label: 'Details anzeigen', icon: 'i-panel' },
    { id: 'help', group: 'Hilfe', label: 'Hilfe', icon: 'i-help' },
    { id: 'keys', group: 'Hilfe', label: 'Tastenkürzel anzeigen', icon: 'i-keyboard', keys: '?' },
    { id: 'palette', group: 'Hilfe', label: 'Befehlssuche', icon: 'i-command', keys: 'Strg+K' },
  ];

  function stepText(dir) {
    const list = LLR.prefs.TEXT;
    const i = list.indexOf(LLR.prefs.get('text'));
    LLR.prefs.set('text', list[Math.max(0, Math.min(list.length - 1, i + dir))]);
  }

  /* Alle Befehle, auch Möbel, Bausteine und Anordnungen */
  function all() {
    const out = BASE.slice();
    for (const b of LLR.BLOCKS) out.push({ id: 'block:' + b.id, group: 'Einfügen', label: `Baustein: ${b.name}`, icon: 'i-blocks', search: b.desc });
    for (const k of Object.keys(T)) {
      const d = T[k];
      if (k === 'c_preview') continue;
      const cat = LLR.CATEGORIES.find((c) => c.id === d.cat);
      out.push({ id: 'add:' + k, group: 'Einfügen', label: `Einfügen: ${d.name}`, icon: 'i-plus', search: (d.desc || '') + ' ' + (cat ? cat.name : ''), pro: !!(d.pro || (cat && cat.pro)) });
    }
    for (const p of LLR.PRESETS.concat(LLR.custom ? LLR.custom.templates() : [])) out.push({ id: 'preset:' + p.id, group: 'Anordnungen', label: `Anordnung: ${p.name}`, icon: 'i-layout', search: (p.persons || '') + ' ' + (p.forms || []).join(' ') });
    return out;
  }

  const visible = (c) => (!c.pro || pro()) && (!c.when || c.when());
  function exec(c) {
    LLR.prefs.useCmd(c.id);
    if (c.act) c.act();
    else ui().doAct(c.id);
  }
  function byId(id) {
    return all().find((c) => c.id === id);
  }

  /* ---------- Befehlssuche ---------- */
  const norm = (s) =>
    String(s)
      .toLowerCase()
      .replace(/ä/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/ü/g, 'u')
      .replace(/ß/g, 'ss')
      .replace(/[­]/g, '');
  let palItems = [];
  let palActive = 0;

  function palRender() {
    const q = norm($('#pal-input').value.trim());
    const toks = q.split(/\s+/).filter(Boolean);
    let list = all().filter(visible);
    if (!toks.length) {
      const rec = LLR.prefs.get('recent').map((id) => list.find((c) => c.id === id)).filter(Boolean);
      const common = ['wizard', 'printWho', 'lens:sight', 'lens:access', 'toggleLevel', 'a11y', 'keys'].map((id) => list.find((c) => c.id === id)).filter(Boolean);
      list = rec.map((c) => Object.assign({}, c, { recent: true })).concat(common.filter((c) => !rec.includes(c)));
    } else {
      list = list
        .map((c) => {
          const hay = norm(`${c.label} ${c.group} ${c.search || ''}`);
          if (!toks.every((t) => hay.includes(t))) return null;
          const lab = norm(c.label);
          let score = 0;
          for (const t of toks) score += lab.startsWith(t) ? 0 : lab.includes(' ' + t) ? 1 : lab.includes(t) ? 2 : 4;
          return { c, score };
        })
        .filter(Boolean)
        .sort((a, b) => a.score - b.score || a.c.label.localeCompare(b.c.label, 'de'))
        .slice(0, 60)
        .map((x) => x.c);
    }
    palItems = list;
    palActive = Math.min(palActive, Math.max(0, list.length - 1));
    const ul = $('#pal-list');
    ul.innerHTML = list.length
      ? list.map((c, i) => `<li role="option" id="pal-${i}" data-i="${i}" aria-selected="${i === palActive}">${icon(c.icon || 'i-command')}<span class="pal-label">${esc(c.label)}<small>${c.recent ? 'zuletzt benutzt' : esc(c.group)}</small></span>${c.keys ? `<span class="kbd">${esc(c.keys)}</span>` : ''}</li>`).join('')
      : `<li class="pal-empty" role="option" aria-disabled="true">Kein Befehl gefunden.</li>`;
    $('#pal-input').setAttribute('aria-activedescendant', list.length ? 'pal-' + palActive : '');
  }

  function palMove(d) {
    if (!palItems.length) return;
    palActive = (palActive + d + palItems.length) % palItems.length;
    for (const li of $$('#pal-list [data-i]')) li.setAttribute('aria-selected', String(Number(li.getAttribute('data-i')) === palActive));
    const li = $(`#pal-${palActive}`);
    if (li) li.scrollIntoView({ block: 'nearest' });
    $('#pal-input').setAttribute('aria-activedescendant', 'pal-' + palActive);
  }

  function palRun(i) {
    const c = palItems[i];
    if (!c) return;
    $('#palette').close();
    setTimeout(() => exec(c), 20);
  }

  function openPalette() {
    const d = $('#palette');
    if (d.open) return;
    if ($('#dlg').open) $('#dlg').close('cancel');
    closeMenu();
    $('#pal-input').value = '';
    palActive = 0;
    palRender();
    d.showModal();
    $('#pal-input').focus();
  }

  function bindPalette() {
    const d = $('#palette');
    const inp = $('#pal-input');
    inp.addEventListener('input', () => {
      palActive = 0;
      palRender();
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        palMove(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        palMove(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        palRun(palActive);
      }
    });
    $('#pal-list').addEventListener('click', (e) => {
      const li = e.target.closest('[data-i]');
      if (li) palRun(Number(li.getAttribute('data-i')));
    });
    d.addEventListener('click', (e) => {
      if (e.target === d) d.close();
    });
  }

  /* ---------- Tastenkürzel ---------- */
  function openKeys() {
    const groups = [];
    for (const c of BASE) if (c.keys && (!c.pro || pro()) && !groups.includes(c.group)) groups.push(c.group);
    const k = (s) =>
      (s === '+' ? ['+'] : s.split('+'))
        .map((x) => `<span class="kbd">${esc(x)}</span>`)
        .join('+');
    let h = `<div class="keys-grid">`;
    for (const g of groups) {
      h += `<section><h3>${esc(g)}</h3><table class="keys">`;
      for (const c of BASE.filter((x) => x.group === g && x.keys && (!x.pro || pro()))) h += `<tr><td>${esc(c.label)}</td><td>${k(c.keys)}</td></tr>`;
      h += `</table></section>`;
    }
    h += `<section><h3>Im Plan</h3><table class="keys">
      <tr><td>Verschieben (1 cm / 10 cm)</td><td><span class="kbd">Pfeiltasten</span> / <span class="kbd">Umschalt</span>+<span class="kbd">Pfeil</span></td></tr>
      <tr><td>Drehen um 1°</td><td><span class="kbd">Alt</span>+<span class="kbd">R</span></td></tr>
      <tr><td>Ohne Einrasten ziehen</td><td><span class="kbd">Alt</span> gedrückt halten</td></tr>
      <tr><td>Frei drehen</td><td><span class="kbd">Umschalt</span> beim Drehen</td></tr>
      <tr><td>Mehrere auswählen</td><td><span class="kbd">Umschalt</span>+Klick / Rahmen</td></tr>
      <tr><td>Ansicht verschieben</td><td><span class="kbd">Leertaste</span>+Ziehen</td></tr>
      <tr><td>Kontextmenü</td><td><span class="kbd">Umschalt</span>+<span class="kbd">F10</span></td></tr>
    </table></section></div>`;
    ui().openDialog({
      title: 'Tastenkürzel',
      wide: true,
      body: h,
      buttons: [{ label: 'Schließen', value: 'cancel', cls: 'primary' }],
      onOpen: (body) => {
        // scrollbarer Bereich auch per Tastatur erreichbar
        body.tabIndex = 0;
        body.setAttribute('role', 'region');
        body.setAttribute('aria-label', 'Liste der Tastenkürzel');
      },
    });
  }

  /* ---------- Verlauf ---------- */
  function ago(t) {
    if (!t) return '';
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return 'gerade eben';
    if (s < 3600) return `vor ${Math.round(s / 60)} min`;
    return new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }

  function openHistory() {
    const render = (body) => {
      const u = app.undoStack;
      const r = app.redoStack;
      let h = `<p class="desc">Einen Schritt antippen springt dorthin zurück – alles danach lässt sich mit „Wiederholen“ wiederherstellen.</p><ol class="history">`;
      h += `<li class="now"><span>${icon('i-check')}Jetziger Stand</span></li>`;
      for (let i = u.length - 1; i >= 0; i--) h += `<li><button type="button" data-hundo="${u.length - i}">${icon('i-undo')}<span>${esc(u[i].label)}<small>${ago(u[i].t)} · ${u.length - i} ${u.length - i === 1 ? 'Schritt' : 'Schritte'} zurück</small></span></button></li>`;
      h += `</ol>`;
      if (!u.length) h += `<p class="empty-note">Noch keine Änderungen in dieser Sitzung.</p>`;
      if (r.length) {
        h += `<h3>Wiederherstellbar</h3><ol class="history redo">`;
        for (let i = r.length - 1; i >= 0; i--) h += `<li><button type="button" data-hredo="${r.length - i}">${icon('i-redo')}<span>${esc(r[i].label)}<small>${r.length - i} ${r.length - i === 1 ? 'Schritt' : 'Schritte'} vor</small></span></button></li>`;
        h += `</ol>`;
      }
      body.innerHTML = h;
    };
    ui().openDialog({
      title: 'Verlauf',
      body: '',
      buttons: [{ label: 'Schließen', value: 'cancel', cls: 'primary' }],
      onOpen: (body) => {
        render(body);
        body.addEventListener('click', (e) => {
          const u = e.target.closest('[data-hundo]');
          const r = e.target.closest('[data-hredo]');
          if (u) for (let n = Number(u.getAttribute('data-hundo')); n > 0; n--) app.undo();
          else if (r) for (let n = Number(r.getAttribute('data-hredo')); n > 0; n--) app.redo();
          else return;
          render(body);
          const f = $('button', body);
          if (f) f.focus();
        });
      },
    });
  }

  /* ---------- Kontextmenü ---------- */
  let menuReturn = null;
  function closeMenu(refocus) {
    const m = $('#ctx-menu');
    if (!m || m.hidden) return;
    m.hidden = true;
    m.innerHTML = '';
    if (refocus && menuReturn) menuReturn.focus({ preventScroll: true });
    menuReturn = null;
  }

  /* items: { cmd } | { label, icon, run, danger, keys } | { sep } | { row: [...], label } */
  function openMenu(items, x, y, opts) {
    opts = opts || {};
    const m = $('#ctx-menu');
    const list = [];
    let h = opts.title ? `<div class="ctx-title">${esc(opts.title)}</div>` : '';
    let lastSep = true;
    const one = (it) => {
      if (it.cmd) {
        const c = byId(it.cmd);
        if (!c || !visible(c)) return '';
        list.push(() => exec(c));
        return { c, i: list.length - 1 };
      }
      list.push(it.run);
      return { c: it, i: list.length - 1 };
    };
    for (const it of items) {
      if (!it) continue;
      if (it.sep) {
        if (!lastSep) h += '<hr />';
        lastSep = true;
        continue;
      }
      if (it.row) {
        const btns = it.row.map(one).filter(Boolean);
        if (!btns.length) continue;
        h += `<div class="ctx-row" role="group" aria-label="${esc(it.label)}"><span class="ctx-row-label">${esc(it.label)}</span>${btns.map(({ c, i }) => `<button type="button" role="menuitem" class="icon-btn small" data-mi="${i}" aria-label="${esc(c.label)}" title="${esc(c.label)}">${icon(c.icon)}</button>`).join('')}</div>`;
        lastSep = false;
        continue;
      }
      const b = one(it);
      if (!b) continue;
      const c = b.c;
      h += `<button type="button" role="menuitem" data-mi="${b.i}" class="${c.danger ? 'danger' : ''}">${icon(c.icon || 'i-command')}<span>${esc(c.label)}</span>${c.keys && pro() ? `<span class="kbd-hint">${esc(c.keys)}</span>` : ''}</button>`;
      lastSep = false;
    }
    h = h.replace(/(<hr \/>)+$/, '');
    if (!list.length) return;
    menuReturn = document.activeElement && document.activeElement !== document.body ? document.activeElement : $('#plan');
    m.innerHTML = h;
    m.hidden = false;
    m._run = list;
    // Lage: im Fenster halten (Bedienelemente können per Schriftgröße vergrößert sein)
    const z = LLR.prefs.zoom();
    const r = m.getBoundingClientRect();
    const W = window.innerWidth;
    const H = window.innerHeight;
    let left = x;
    let top = y;
    if (left + r.width > W - 8) left = Math.max(8, W - r.width - 8);
    if (top + r.height > H - 8) top = Math.max(8, opts.above ? y - r.height - 8 : H - r.height - 8);
    m.style.left = left / z + 'px';
    m.style.top = top / z + 'px';
    const first = $('[data-mi]', m);
    if (first) first.focus({ preventScroll: true });
  }

  function menuAt(anchor, items, opts) {
    const r = anchor.getBoundingClientRect();
    openMenu(items, r.left, r.bottom + 4, opts);
  }

  function bindMenu() {
    const m = $('#ctx-menu');
    m.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mi]');
      if (!b) return;
      const fn = m._run[Number(b.getAttribute('data-mi'))];
      closeMenu(true);
      if (fn) setTimeout(fn, 10);
    });
    m.addEventListener('keydown', (e) => {
      const items = $$('[data-mi]', m);
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        items[(i + 1) % items.length].focus();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        items[(i - 1 + items.length) % items.length].focus();
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        items[e.key === 'Home' ? 0 : items.length - 1].focus();
      } else if (e.key === 'Escape' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        closeMenu(true);
      }
    });
    document.addEventListener('pointerdown', (e) => {
      if (!m.hidden && !e.target.closest('#ctx-menu')) closeMenu();
    });
    window.addEventListener('resize', () => closeMenu());
    window.addEventListener('blur', () => closeMenu());
  }

  /* Einträge je nach Auswahl */
  function contextItems(world) {
    const objs = sel();
    const isPro = pro();
    if (objs.length) {
      const one = objs.length === 1 ? objs[0] : null;
      const groupable = one && (A.isTable(one) || one.type === 'partition');
      const arr = objs.some((o) => A.isTable(o) || A.isSeat(o));
      return [
        { cmd: 'rot90' },
        { cmd: 'rot90l' },
        { cmd: 'rot180' },
        isPro && { row: [{ cmd: 'rotl' }, { cmd: 'rotr' }], label: '15°' },
        { sep: true },
        { cmd: 'dup' },
        { cmd: 'copy' },
        { cmd: 'paste' },
        { sep: true },
        { cmd: 'chairs' },
        { cmd: 'chairsDel' },
        groupable && { cmd: 'group' },
        isPro && { row: [{ cmd: 'align:left' }, { cmd: 'align:hcenter' }, { cmd: 'align:right' }, { cmd: 'align:top' }, { cmd: 'align:vcenter' }, { cmd: 'align:bottom' }], label: objs.length > 1 && multi() ? 'Ausrichten' : 'Im Raum' },
        isPro && { row: [{ cmd: 'dist:x' }, { cmd: 'dist:y' }, { cmd: 'mirror:x' }, { cmd: 'mirror:y' }], label: 'Verteilen' },
        isPro && arr && objs.length > 1 && { cmd: 'saveTemplate' },
        { sep: true },
        { cmd: 'lock' },
        { label: 'Details anzeigen', icon: 'i-panel', run: () => ui().showDetails() },
        { sep: true },
        { cmd: 'del' },
      ];
    }
    const at = world;
    const add = (type, label, ic) => ({ label, icon: ic, run: () => app.addObject(type, at) });
    return [
      { cmd: 'paste' },
      {
        label: 'Hier einfügen',
        row: [
          add('chair', 'Stuhl hier einfügen', 'i-seat'),
          { label: 'Einzeltisch hier einfügen', icon: 'i-layout', run: () => ui().addBlock('b-einzel', at) },
          { label: 'Gruppentisch für 4 hier einfügen', icon: 'i-blocks', run: () => ui().addBlock('b-gruppe4', at) },
          add('teacher', 'Lehrkraft-Position hier einfügen', 'i-teacher'),
        ],
      },
      { sep: true },
      { cmd: 'selectAll' },
      { cmd: 'fit' },
      { cmd: 'undo' },
      { sep: true },
      { cmd: 'wizard' },
      { cmd: 'settings' },
      isPro && { cmd: 'grid' },
      { cmd: 'palette' },
    ];
  }

  function openContext(ev) {
    if (ev.id && !app.sel.has(ev.id)) app.select([ev.id]);
    if (!ev.id && app.sel.size && !ev.keep) {
      // Rechtsklick ins Leere: Aktionen für den Raum
      app.clearSelection();
    }
    const world = app.toWorld(ev.x, ev.y);
    openMenu(contextItems(world), ev.x + 2, ev.y + 2, { title: sel().length > 1 ? `${sel().length} Objekte` : sel().length ? T[sel()[0].type].name : 'Raum' });
  }

  /* Kontextmenü per Tastatur an der Auswahl (oder Mitte des Plans) */
  function contextFromKeyboard() {
    const r = app.svg.getBoundingClientRect();
    let x = r.left + r.width / 2;
    let y = r.top + r.height / 2;
    const objs = sel();
    if (objs.length) {
      const bb = app.selBox() || { minX: objs[0].x, maxX: objs[0].x, minY: objs[0].y, maxY: objs[0].y };
      const m = app.svg.getScreenCTM();
      const pt = app.svg.createSVGPoint();
      pt.x = (bb.minX + bb.maxX) / 2;
      pt.y = bb.maxY;
      const p = pt.matrixTransform(m);
      x = Math.max(r.left + 10, Math.min(r.right - 10, p.x));
      y = Math.max(r.top + 10, Math.min(r.bottom - 10, p.y));
    }
    openContext({ x, y, id: null, keep: true });
  }

  /* ---------- Tastenkürzel (zusätzlich zu js/app.js) ---------- */
  function onKey(e) {
    if ($('#palette').open) return;
    if (document.querySelector('#dlg[open]')) return;
    if (app.isTyping(e)) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    const code = e.code;
    const take = (fn) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      fn();
    };
    if (mod && !e.shiftKey && !e.altKey && (k === 'k' || k === 'K')) return take(openPalette);
    if (mod && !e.altKey && (k === 's' || k === 'S')) return take(run('savePlan'));
    if (mod && !e.shiftKey && (k === 'g' || k === 'G')) return take(run('group'));
    if (mod && e.shiftKey && k.startsWith('Arrow')) return take(run('align:' + { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'top', ArrowDown: 'bottom' }[k]));
    if ((k === 'ContextMenu' && !mod) || (e.shiftKey && k === 'F10')) return take(contextFromKeyboard);
    if (mod || e.altKey) return;
    if (k === '?') return take(openKeys);
    if (k === 'Enter' && app.measure && app.mode === 'measure') return take(run('keepMeasure'));
    if (code === 'Digit9') return take(run(e.shiftKey ? 'rot90l' : 'rot90'));
    if (!e.shiftKey && /^Digit[1-6]$/.test(code)) {
      const lens = ['access', 'sight', 'teacher', 'calm', 'seating', 'rebuild'][Number(code.slice(5)) - 1];
      const c = byId('lens:' + lens);
      if (c && !visible(c)) return;
      return take(() => ui().setLens(app.overlay[lens] ? null : lens));
    }
    if (k === 'n' || k === 'N') return take(run(e.shiftKey ? 'prevObj' : 'nextObj'));
    if (e.shiftKey && (k === 'H' || k === 'h')) return pro() && take(run('mirror:x'));
    if (e.shiftKey && (k === 'V' || k === 'v')) return pro() && take(run('mirror:y'));
    if (k === 'g' || k === 'G') return pro() && take(run(e.shiftKey ? 'gridSnap' : 'grid'));
    if (k === 'PageDown' || k === 'PageUp') {
      if (!app.doc.phases) return;
      return take(run(k === 'PageDown' ? 'nextPhase' : 'prevPhase'));
    }
    if ((k === 'm' || k === 'M') && !pro()) return take(() => {});
  }

  /* Aktionen (js/ui.js → doAct) */
  function act(a, src) {
    if (a === 'palette') openPalette();
    else if (a === 'keys') openKeys();
    else if (a === 'history') openHistory();
    else if (a === 'autoSeat') LLR.classUI.autoSeat();
    else if (a === 'more' || a === 'alignMenu') {
      const r = (src || $('#sel-bar')).getBoundingClientRect();
      const items = a === 'more' ? contextItems(null) : [{ row: [{ cmd: 'align:left' }, { cmd: 'align:hcenter' }, { cmd: 'align:right' }], label: 'Waagerecht' }, { row: [{ cmd: 'align:top' }, { cmd: 'align:vcenter' }, { cmd: 'align:bottom' }], label: 'Senkrecht' }, { sep: true }, { cmd: 'dist:x' }, { cmd: 'dist:y' }, { cmd: 'distgap:x' }, { cmd: 'distgap:y' }, { sep: true }, { cmd: 'mirror:x' }, { cmd: 'mirror:y' }];
      openMenu(items, r.left, r.top - 4, { above: true });
    } else return false;
    return true;
  }

  function init() {
    bindPalette();
    bindMenu();
    app.on('context', (ev) => openContext(ev));
    window.addEventListener('keydown', onKey);
    // Kontextmenü schließen, wenn sich die Ansicht ändert
    app.on('view', () => closeMenu());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  LLR.commands = { all, byId, exec, openPalette, openKeys, openHistory, openMenu, menuAt, closeMenu, act };
})((window.LLR = window.LLR || {}));

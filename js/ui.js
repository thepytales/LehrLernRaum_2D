/* Bedienoberfläche: Panels, Dialoge, Speichern/Teilen/Export */
(function (LLR) {
  'use strict';
  const G = LLR.G;
  const T = LLR.TYPES;
  const A = LLR.analysis;
  const app = LLR.app;
  const esc = LLR.esc;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const KEY_PLANS = 'llr2d.plans.v1';
  const KEY_SEEN = 'llr2d.seen.v1';
  const KEY_PANELS = 'llr2d.panels.v1';
  const mobile = () => window.matchMedia('(max-width: 900px)').matches;
  const phone = () => window.matchMedia('(max-width: 600px)').matches;
  const icon = (id) => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
  const num = (v, d) => Number(v).toLocaleString('de-DE', { maximumFractionDigits: d === undefined ? 1 : d });
  const ZONE_NAMES = ['Präsentation', 'Gruppenarbeit', 'Einzelarbeit', 'Ruhezone', 'Rückzug', 'Lounge', 'Lehrkraft', 'Material', 'Bewegung', 'Garderobe'];
  const GRID_SIZES = [10, 20, 25, 50, 100];

  /* Auf- und zugeklappte Bereiche (Seitenleisten, Prüf-Abschnitte, Legende) */
  const panels = (() => {
    const def = { left: true, right: true, access: false, sight: false, seats: true, zones: true, legend: !phone(), tips: true };
    try {
      return Object.assign(def, JSON.parse(localStorage.getItem(KEY_PANELS) || '{}'));
    } catch (e) {
      return def;
    }
  })();
  const savePanels = () => {
    try {
      localStorage.setItem(KEY_PANELS, JSON.stringify(panels));
    } catch (e) {
      /* ohne Speicher gilt die Einstellung nur bis zum Neuladen */
    }
  };

  /* Inhalt ersetzen, ohne dass der Tastaturfokus verloren geht */
  function rerender(box, html) {
    const a = document.activeElement;
    let sel = null;
    if (a && a !== box && box.contains(a)) {
      for (const attr of ['data-acc-toggle', 'data-ov', 'data-pref', 'data-act', 'data-legend']) {
        if (a.hasAttribute(attr)) {
          sel = `[${attr}="${a.getAttribute(attr)}"]`;
          break;
        }
      }
    }
    box.innerHTML = html;
    if (sel) {
      const n = box.querySelector(sel);
      if (n) n.focus({ preventScroll: true });
    }
  }

  /* Sichtmarke als kleines Inline-Bild (wie im Plan) */
  const glyph = (cat) => `<svg class="sg" viewBox="-8.5 -8.5 17 17" aria-hidden="true">${LLR.sightGlyph(cat)}</svg>`;

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }
  app.on('toast', toast);

  /* ---------- Vorschaubilder ---------- */
  function thumb(o, cls) {
    const d = T[o.type];
    const S = app.doc ? app.doc.settings : LLR.DEFAULT_SETTINGS;
    const b = G.bbox(d.bounds ? d.bounds(o, S) : [].concat(...d.parts(o, S)));
    const pad = Math.max(b.w, b.h) * 0.08 + 2;
    return `<svg class="${cls || 'thumb'}" viewBox="${b.minX - pad} ${b.minY - pad} ${b.w + 2 * pad} ${b.h + 2 * pad}" aria-hidden="true">${d.draw(o, S)}</svg>`;
  }
  function sample(type) {
    const d = T[type];
    const o = { type, x: 0, y: 0, rot: 0 };
    if (d.defaultSize) {
      o.w = d.defaultSize.w;
      o.d = d.defaultSize.d;
    }
    if (d.defaultColor) o.color = d.defaultColor;
    if (type === 'label') {
      o.text = 'Text';
      o.size = 22;
    }
    return o;
  }

  /* ---------- Katalog ---------- */
  function renderCatalog() {
    const box = $('#tab-catalog');
    let h = '';
    for (const c of LLR.CATEGORIES) {
      const types = Object.keys(T).filter((k) => T[k].cat === c.id);
      if (!types.length) continue;
      h += `<h3 class="cat-title">${esc(c.name)}</h3><div class="cat-grid">`;
      for (const k of types) {
        h += `<button class="cat-item" data-type="${k}" draggable="true" title="${esc(T[k].desc || T[k].name)}">${thumb(sample(k))}<span class="name">${esc(T[k].name)}</span><span class="badge" data-badge="${k}"></span></button>`;
      }
      h += `</div>`;
    }
    h += `<p class="cat-note">Antippen fügt das Objekt in der Bildmitte ein. Am Computer auch per Drag & Drop. Zahlen = im Plan / im LLR vorhanden.</p>`;
    box.innerHTML = h;
    updateBadges();
  }

  function updateBadges() {
    const st = app.stats();
    for (const b of $$('[data-badge]')) {
      const k = b.getAttribute('data-badge');
      const d = T[k];
      const n = st.count[k] || 0;
      b.className = 'badge';
      if (d.inv) {
        b.textContent = `${n}/${d.inv}`;
        if (n === d.inv) b.classList.add('full');
        if (n > d.inv) b.classList.add('over');
      } else {
        b.textContent = n ? String(n) : '';
        b.hidden = !n;
      }
    }
  }

  function bindCatalog() {
    const box = $('#tab-catalog');
    box.addEventListener('click', (e) => {
      const it = e.target.closest('.cat-item');
      if (!it) return;
      const type = it.getAttribute('data-type');
      const d = T[type];
      const n = app.stats().count[type] || 0;
      app.addObject(type);
      if (d.inv && n + 1 > d.inv) toast(`Hinweis: Im LLR gibt es nur ${d.inv} × „${d.short}“. Zusätzliche müssen aus anderen Räumen kommen.`);
      if (mobile()) closeDrawers();
    });
    box.addEventListener('dragstart', (e) => {
      const it = e.target.closest('.cat-item');
      if (!it) return;
      e.dataTransfer.setData('text/llr-type', it.getAttribute('data-type'));
      e.dataTransfer.effectAllowed = 'copy';
    });
    const svg = $('#plan');
    svg.addEventListener('dragover', (e) => {
      if (e.dataTransfer.types.includes('text/llr-type')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });
    svg.addEventListener('drop', (e) => {
      const type = e.dataTransfer.getData('text/llr-type');
      if (!type || !T[type]) return;
      e.preventDefault();
      app.addObject(type, app.toWorld(e.clientX, e.clientY));
    });
  }

  /* ---------- Anordnungen ---------- */
  function presetPreview(p) {
    const S = LLR.DEFAULT_SETTINGS;
    const room = LLR.DEFAULT_ROOM;
    const objs = p.build(S, room);
    const pts = [];
    for (const o of objs) pts.push(...[].concat(...T[o.type].parts(o, S)).map((q) => G.add(G.rot(q, o.rot), o)));
    const b = G.bbox(pts);
    const pad = 12;
    const side = Math.max(b.w, b.h) + 2 * pad;
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    let inner = '';
    for (const o of LLR.colorChairs(objs)) {
      inner += `<g transform="translate(${o.x.toFixed(1)} ${o.y.toFixed(1)}) rotate(${(o.rot || 0).toFixed(1)})">${T[o.type].draw(o, S)}</g>`;
    }
    return `<svg class="pv" viewBox="${cx - side / 2} ${cy - side / 2} ${side} ${side}" aria-hidden="true">${inner}</svg>`;
  }

  function renderPresets() {
    let h = `<p class="intro">Anordnungen aus der <em>Handreichung zur Anordnung der Tische</em>. Beim Übernehmen werden Tische, Stühle und Hocker neu gestellt – alles andere bleibt. Danach frei anpassbar.</p>`;
    for (const p of LLR.PRESETS) {
      h += `<button class="preset" data-preset="${p.id}">${presetPreview(p)}<span><h3>${esc(p.name)}</h3><span class="persons">${esc(p.persons)}</span><p>${esc(p.note)}</p><span class="page">Handreichung S. ${p.page}</span></span></button>`;
    }
    $('#tab-presets').innerHTML = h;
  }

  function bindPresets() {
    $('#tab-presets').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-preset]');
      if (!b) return;
      const p = LLR.PRESETS.find((x) => x.id === b.getAttribute('data-preset'));
      const ok = await confirmDlg(
        p.name,
        `<p>Tische, Stühle und Hocker werden durch die Anordnung <strong>${esc(p.name)}</strong> (${esc(p.persons)}) ersetzt.${p.shelves ? ' Die halbrunden Regale werden mit umgestellt.' : ''}</p><p class="desc">${esc(p.note)}</p><p class="desc">Rückgängig jederzeit mit <span class="kbd">Strg</span>+<span class="kbd">Z</span>.</p>`,
        'Übernehmen'
      );
      if (!ok) return;
      app.applyPreset(p.id);
      toast(`„${p.name}“ übernommen`);
      if (mobile()) closeDrawers();
    });
  }

  /* ---------- Objektliste ---------- */
  function renderObjects() {
    const box = $('#tab-objects');
    if (box.hidden) return;
    const groups = new Map();
    for (const o of app.doc.objects) {
      const c = T[o.type].cat;
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c).push(o);
    }
    let h = `<div class="obj-tools">
      <button class="btn outline small" data-selt="table">Alle Tische</button>
      <button class="btn outline small" data-selt="chair">Alle Stühle</button>
      <button class="btn outline small" data-selt="all">Alles (nicht gesperrt)</button></div>`;
    for (const c of LLR.CATEGORIES) {
      const list = groups.get(c.id);
      if (!list) continue;
      h += `<div class="obj-group">${esc(c.name)} (${list.length})</div><ul class="obj-list">`;
      const counter = {};
      for (const o of list) {
        counter[o.type] = (counter[o.type] || 0) + 1;
        const d = T[o.type];
        const name = o.type === 'label' ? `„${o.text || ''}“` : `${d.short} ${counter[o.type]}${o.label ? ' – ' + o.label : ''}`;
        const bad = app.problems.has(o.id);
        h += `<li><button data-oid="${o.id}" aria-current="${app.sel.has(o.id)}"><span>${esc(name)}</span><span class="meta">${bad ? `<span class="warn" title="Überschneidung/außerhalb">${icon('i-alert')}</span>` : ''}${o.locked ? `<span title="gesperrt">${icon('i-lock')}</span>` : ''}</span></button></li>`;
      }
      h += `</ul>`;
    }
    box.innerHTML = h;
  }

  function bindObjects() {
    const box = $('#tab-objects');
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-oid]');
      if (b) {
        const id = b.getAttribute('data-oid');
        app.select([id], e.shiftKey || e.ctrlKey || e.metaKey);
        ensureVisible(app.byId(id));
        return;
      }
      const t = e.target.closest('[data-selt]');
      if (t) {
        const k = t.getAttribute('data-selt');
        const ids = app.doc.objects.filter((o) => (k === 'all' ? !o.locked : k === 'table' ? A.isTable(o) : o.type === k)).map((o) => o.id);
        app.select(ids);
        if (mobile()) closeDrawers();
      }
    });
  }

  function ensureVisible(o) {
    if (!o) return;
    const v = app.view;
    if (o.x < v.x + 40 || o.x > v.x + v.w - 40 || o.y < v.y + 40 || o.y > v.y + v.h - 40) {
      v.x = o.x - v.w / 2;
      v.y = o.y - v.h / 2;
      app.applyView();
    }
  }

  /* ---------- Eigenschaften ---------- */
  function renderProps() {
    const box = $('#props');
    if (box.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
    const objs = app.selectedObjects();
    if (!objs.length) {
      const r = app.doc.room;
      box.innerHTML = `<h2 class="sec-title">Raum</h2>
        <div class="field-grid two">
          <label class="field">Breite – Tafelseite (m)<input type="number" data-room="w" value="${(r.w / 100).toFixed(2)}" min="2" max="30" step="0.05"></label>
          <label class="field">Länge (m)<input type="number" data-room="l" value="${(r.l / 100).toFixed(2)}" min="2" max="30" step="0.05"></label>
        </div>
        <table class="stat-table"><tr><td>Fläche</td><td data-room-area>${app.fmtArea(r.w * r.l)}</td></tr></table>
        <p class="desc">Die Raumgröße lässt sich auch direkt im Plan ändern: an einer Wand oder an den blauen Griffen ziehen.</p>
        <div class="btn-row"><button class="btn outline small" data-act="settings">${icon('i-sliders')}Raum & Einstellungen</button></div>
        <details class="callout tips" data-tips ${panels.tips ? 'open' : ''}><summary><strong>So geht's</strong></summary>Objekt antippen und ziehen. Der blaue Kreis über der Auswahl dreht, die kleinen Quadrate ändern die Größe. Tische rasten magnetisch an andere Tische an, angestellte Stühle wandern beim Verschieben mit (abschaltbar über „Einrasten“). Leere Fläche ziehen verschiebt die Ansicht, zwei Finger zoomen. Die Seitenleisten lassen sich über die Symbole oben links und rechts ein- und ausblenden.</details>`;
      return;
    }
    if (objs.length > 1) {
      const counts = {};
      for (const o of objs) counts[T[o.type].short] = (counts[T[o.type].short] || 0) + 1;
      const locked = objs.filter((o) => o.locked).length;
      box.innerHTML = `<h2 class="sec-title">${objs.length} Objekte ausgewählt</h2>
        <p class="desc">${Object.entries(counts).map(([k, v]) => `${v} × ${esc(k)}`).join(', ')}${locked ? ` · ${locked} gesperrt` : ''}</p>
        <div class="btn-row">
          <button class="btn outline small" data-act="rotl">${icon('i-rot-ccw')}−15°</button>
          <button class="btn outline small" data-act="rotr">${icon('i-rot-cw')}+15°</button>
          <button class="btn outline small" data-act="rot90">${icon('i-rot-cw')}90°</button>
          <button class="btn outline small" data-act="dup">${icon('i-copy')}Duplizieren</button>
          <button class="btn outline small" data-act="lock">${icon(locked === objs.length ? 'i-unlock' : 'i-lock')}${locked === objs.length ? 'Entsperren' : 'Sperren'}</button>
          <button class="btn outline small" data-act="del" style="color:var(--bad)">${icon('i-trash')}Löschen</button>
          <button class="btn outline small" data-act="none">Auswahl aufheben</button>
        </div>`;
      return;
    }
    const o = objs[0];
    const d = T[o.type];
    let h = `<h2 class="sec-title">${thumb(o)}<span>${esc(d.name)}</span></h2><p class="desc">${esc(d.desc || '')}</p>`;
    if (o.type === 'label') {
      h += `<div class="field-grid two"><label class="field">Text<input type="text" data-k="text" value="${esc(o.text || '')}" maxlength="60"></label>
        <label class="field">Schriftgröße (cm)<input type="number" data-k="size" value="${o.size || 22}" min="6" max="120" step="1"></label></div>`;
    } else if (d.kind === 'zone') {
      h += `<label class="field">Name der Zone<input type="text" data-k="label" value="${esc(o.label || '')}" maxlength="40" placeholder="z. B. Ruhezone" list="zone-names"></label>
        <datalist id="zone-names">${ZONE_NAMES.map((n) => `<option value="${esc(n)}"></option>`).join('')}</datalist>
        <p class="desc">Fläche: <strong data-zone-area>${LLR.zoneArea(o)}</strong></p>`;
    } else {
      h += `<label class="field">Beschriftung ${d.kind === 'seat' ? '(z. B. Name)' : '(optional)'}<input type="text" data-k="label" value="${esc(o.label || '')}" maxlength="40" placeholder="${d.kind === 'seat' ? 'z. B. Name' : 'z. B. Gruppe A'}"></label>`;
    }
    h += `<div class="sub-title">Position</div><div class="field-grid">
      <label class="field">X (cm)<input type="number" data-k="x" value="${Math.round(o.x)}" step="1" ${o.locked ? 'disabled' : ''}></label>
      <label class="field">Y (cm)<input type="number" data-k="y" value="${Math.round(o.y)}" step="1" ${o.locked ? 'disabled' : ''}></label>
      <label class="field">Drehung (°)<input type="number" data-k="rot" value="${Math.round(o.rot || 0)}" step="15" ${o.locked || d.wall ? 'disabled' : ''}></label></div>`;
    if (d.resizable) {
      const ms = d.minSize || { w: 5, d: 5 };
      if (d.round) {
        h += `<div class="sub-title">Größe</div><div class="field-grid"><label class="field">Durchmesser (cm)<input type="number" data-k="diam" value="${Math.round(o.w)}" min="${ms.w}" max="1000" step="5" ${o.locked ? 'disabled' : ''}></label></div>`;
      } else {
        h += `<div class="sub-title">Größe</div><div class="field-grid two"><label class="field">Breite (cm)<input type="number" data-k="w" value="${Math.round(o.w)}" min="${ms.w}" max="2000" step="5" ${o.locked ? 'disabled' : ''}></label>`;
        if (!d.widthOnly) h += `<label class="field">Tiefe (cm)<input type="number" data-k="d" value="${Math.round(o.d)}" min="${ms.d}" max="2000" step="5" ${o.locked ? 'disabled' : ''}></label>`;
        h += `</div>`;
      }
    }
    if (d.colors) {
      h += `<div class="sub-title">Farbe</div><div class="swatches">`;
      for (const [k, c] of Object.entries(d.colors)) {
        const fill = c.fill || c.seat;
        h += `<button class="swatch" data-color="${k}" style="background:${fill}" aria-pressed="${(o.color || d.defaultColor) === k}" aria-label="${esc(c.label)}" title="${esc(c.label)}"></button>`;
      }
      h += `</div>`;
    }
    if (d.options) {
      h += `<div class="sub-title">Optionen</div>`;
      for (const op of d.options) h += `<label class="toggle"><input type="checkbox" data-opt="${op.key}" ${o[op.key] ? 'checked' : ''}> ${esc(op.label)}</label>`;
    }
    h += `<label class="toggle"><input type="checkbox" data-opt="locked" ${o.locked ? 'checked' : ''}><span>Gesperrt<small>gegen versehentliches Verschieben</small></span></label>`;
    h += `<div class="btn-row">`;
    if (!d.wall) h += `<button class="btn outline small" data-act="rotl" ${o.locked ? 'disabled' : ''}>${icon('i-rot-ccw')}−15°</button><button class="btn outline small" data-act="rotr" ${o.locked ? 'disabled' : ''}>${icon('i-rot-cw')}+15°</button><button class="btn outline small" data-act="rot90" ${o.locked ? 'disabled' : ''}>${icon('i-rot-cw')}90°</button>`;
    h += `<button class="btn outline small" data-act="dup">${icon('i-copy')}Duplizieren</button><button class="btn outline small" data-act="del" style="color:var(--bad)" ${o.locked ? 'disabled' : ''}>${icon('i-trash')}Löschen</button></div>`;
    if (A.isTable(o)) h += `<div class="btn-row"><button class="btn outline small block" data-act="group">${icon('i-multi')}Ganze Tischgruppe mit Stühlen auswählen</button></div><p class="desc" style="margin-top:6px">Tipp: Doppelklick auf einen Tisch wählt die Gruppe ebenfalls aus.</p>`;
    if (o.type === 'partition') h += `<div class="btn-row"><button class="btn outline small block" data-act="group">${icon('i-multi')}Alle verbundenen Trennwände auswählen</button></div><p class="desc" style="margin-top:6px">Trennwände rasten an den Enden aneinander ein (gerade, im 45°/90°-Winkel oder als T). Doppelklick wählt die ganze Wand.</p>`;
    if (A.isTable(o) || o.type === 'wheelchair') h += accessInfo(o);
    if (A.isSeat(o)) h += seatSight(o);
    const why = app.problems.get(o.id);
    if (why) {
      h += `<div class="check-row bad">${icon('i-alert')}<span class="txt">${why.has('out') ? 'Ragt aus dem Raum heraus. ' : ''}${why.has('overlap') ? 'Überschneidet sich mit einem anderen Objekt.' : ''}</span></div>`;
    }
    box.innerHTML = h;
  }

  /* Rollstuhl: Weg von der Tür zu diesem Tisch bzw. Prüf-Rollstuhl */
  function accessInfo(o) {
    let h = `<div class="sub-title">Rollstuhl</div>`;
    const a = app.access;
    if (!a) {
      return h + `<div class="btn-row"><button class="btn outline small block" data-act="accessOn">${icon('i-route')}Weg von der Tür prüfen</button></div>`;
    }
    const row = (cls, ic, txt, small) => `<div class="check-row ${cls}">${icon(ic)}<span class="txt">${txt}${small ? `<small>${small}</small>` : ''}</span></div>`;
    if (!a.hasDoor) return h + row('bad', 'i-alert', 'Keine Tür im Plan', 'Die Tür ist der Startpunkt der Wegprüfung.');
    if (o.type === 'wheelchair') {
      const w = a.wheelchairs.find((x) => x.id === o.id);
      if (w && w.ok) h += row('ok', 'i-check', 'Von der Tür aus erreichbar', 'Grüne Linie im Plan: Weg mit mindestens ' + app.doc.settings.passage + ' cm Durchgang.');
      else h += row('bad', 'i-alert', 'Kein Weg von der Tür', `Unterwegs ist es enger als ${app.doc.settings.passage} cm.`);
      return h;
    }
    const t = a.tables.find((x) => x.id === o.id);
    if (!t) return '';
    if (t.now) h += row('ok', 'i-check', 'Rollstuhlplatz von der Tür aus erreichbar', 'Blaue Linie im Plan: Weg von der Tür zum Platz.');
    else if (t.later) h += row('warn', 'i-alert', `Erst nach Wegstellen ${t.moveMin > 1 ? 'von 2 Stühlen' : 'eines Stuhls'}`, 'Wegzustellende Stühle sind orange markiert, die orange Linie zeigt den Weg von der Tür.');
    else if (!a.complete) h += row('', 'i-info', 'Wird geprüft …');
    else h += row('bad', 'i-alert', 'Kein Rollstuhlplatz erreichbar', `Von der Tür führt kein Weg mit ${app.doc.settings.passage} cm Durchgang an diesen Tisch – auch nicht nach Wegstellen eines Stuhls.`);
    if (!app.overlay.access) h += `<div class="btn-row"><button class="btn outline small block" data-act="accessOn">${icon('i-route')}Weg im Plan zeigen</button></div>`;
    return h;
  }

  /* Sicht eines Sitzplatzes auf die Präsentationsflächen */
  function seatSight(o) {
    const cone = A.sightCone(app.doc, o.id);
    let h = `<div class="sub-title">Sicht auf Tafel & Bildschirme</div>`;
    if (!cone || !cone.views.length) {
      h += `<p class="desc">Keine Präsentationsfläche vor diesem Platz (Tafel, Bildschirm oder Beamer-Fläche).</p>`;
    } else {
      const sum = { good: 'Direkter Blick', side: 'Eingeschränkt: Kopf seitlich drehen', person: 'Eingeschränkt: Person im Blickfeld', back: 'Kein Blick: abgewandt', none: 'Kein Blick: verdeckt' }[cone.cat];
      h += `<p class="seat-sum">${glyph(cone.cat)}<span>${sum}</span></p><table class="stat-table">`;
      for (const v of cone.views.slice().sort((a, b) => a.dist - b.dist)) {
        const pill =
          v.cat === 'hidden' ? '<span class="pill bad">verdeckt</span>'
          : v.turn === 'back' ? '<span class="pill bad">abgewandt</span>'
          : v.turn === 'side' ? '<span class="pill warn">seitlich</span>'
          : v.person ? '<span class="pill warn">Person im Blick</span>'
          : '<span class="pill ok">direkt</span>';
        let info = app.fmtM(v.dist);
        if (!cone.free) info += ` · ${Math.round(v.ang)}° zur Blickrichtung`;
        if (v.frac < 0.999) info += ` · ${Math.round(v.frac * 100)} % sichtbar`;
        if (v.cat !== 'hidden' && v.personFrac >= 0.03) info += ` · ca. ${Math.round(v.personFrac * 100)} % durch Personen verdeckt`;
        h += `<tr><td>${esc(v.s.name)}${v === cone.best ? ' <span class="best" title="beste Sicht">★</span>' : ''}<small>${info}</small></td><td>${pill}</td></tr>`;
      }
      h += `</table>`;
    }
    h += `<div class="btn-row"><button class="btn outline small block" data-act="sight" aria-pressed="${app.overlay.sight}">${icon('i-eye')}${app.overlay.sight ? 'Sichtkegel ausblenden' : 'Sichtkegel im Plan zeigen'}</button></div>`;
    return h;
  }

  function liveProps() {
    const objs = app.selectedObjects();
    const set = (sel, v) => {
      const i = $(`#props ${sel}`);
      if (i && document.activeElement !== i) {
        if (i.tagName === 'INPUT') i.value = v;
        else i.textContent = v;
      }
    };
    if (!objs.length) {
      const r = app.doc.room;
      set('[data-room="w"]', (r.w / 100).toFixed(2));
      set('[data-room="l"]', (r.l / 100).toFixed(2));
      set('[data-room-area]', app.fmtArea(r.w * r.l));
      return;
    }
    if (objs.length !== 1) return;
    const o = objs[0];
    set('[data-k="x"]', Math.round(o.x));
    set('[data-k="y"]', Math.round(o.y));
    set('[data-k="rot"]', Math.round(o.rot || 0));
    if (o.w !== undefined) {
      set('[data-k="w"]', Math.round(o.w));
      set('[data-k="diam"]', Math.round(o.w));
    }
    if (o.d !== undefined) set('[data-k="d"]', Math.round(o.d));
    if (T[o.type].kind === 'zone') set('[data-zone-area]', LLR.zoneArea(o));
  }

  function bindProps() {
    const box = $('#props');
    box.addEventListener('change', (e) => {
      const t = e.target;
      if (t.hasAttribute('data-room')) {
        const v = parseFloat(String(t.value).replace(',', '.'));
        if (!isFinite(v)) return;
        const cm = Math.round(Math.max(2, Math.min(30, v)) * 100);
        const R = app.doc.room;
        const sides = { l: 0, t: 0, r: 0, b: 0 };
        if (t.getAttribute('data-room') === 'w') sides.r = cm - R.w;
        else sides.b = cm - R.l;
        if (sides.r || sides.b) app.mutate(() => app.applyRoomResize(app.roomSnapshot(), sides));
        t.value = ((t.getAttribute('data-room') === 'w' ? app.doc.room.w : app.doc.room.l) / 100).toFixed(2);
        liveProps();
        return;
      }
      const objs = app.selectedObjects();
      if (objs.length !== 1) return;
      const o = objs[0];
      const d = T[o.type];
      if (t.hasAttribute('data-k')) {
        const k = t.getAttribute('data-k');
        app.mutate(() => {
          if (k === 'label') {
            if (t.value.trim()) o.label = t.value.trim();
            else delete o.label;
          } else if (k === 'text') {
            o.text = t.value || 'Text';
          } else {
            const v = parseFloat(String(t.value).replace(',', '.'));
            if (!isFinite(v)) return;
            const ms = d.minSize || { w: 1, d: 1 };
            if (k === 'x' || k === 'y') {
              o[k] = v;
              if (d.wall) app.snapToWall(o, { x: o.x, y: o.y });
            } else if (k === 'rot') o.rot = G.normAngle(v);
            else if (k === 'w') o.w = Math.max(ms.w, v);
            else if (k === 'd') o.d = Math.max(ms.d, v);
            else if (k === 'diam') o.w = o.d = Math.max(ms.w, v);
            else if (k === 'size') o.size = Math.max(6, Math.min(120, v));
          }
          if (d.wall && (k === 'w' || k === 'diam')) app.snapToWall(o, { x: o.x, y: o.y });
        });
        renderProps();
      } else if (t.hasAttribute('data-opt')) {
        const k = t.getAttribute('data-opt');
        app.mutate(() => {
          if (t.checked) o[k] = true;
          else delete o[k];
        });
        renderProps();
      }
    });
    box.addEventListener(
      'toggle',
      (e) => {
        if (!e.target.matches || !e.target.matches('[data-tips]')) return;
        panels.tips = e.target.open;
        savePanels();
      },
      true
    );
    box.addEventListener('click', (e) => {
      const sw = e.target.closest('[data-color]');
      if (sw) {
        const o = app.selectedObjects()[0];
        if (o) app.mutate(() => (o.color = sw.getAttribute('data-color')));
        renderProps();
      }
    });
  }

  /* Aktionsknöpfe (Panel, Schnellleiste) */
  function doAct(act) {
    if (act === 'rotl') app.rotateSelected(-(app.doc.settings.angleSnap || 15));
    else if (act === 'rotr') app.rotateSelected(app.doc.settings.angleSnap || 15);
    else if (act === 'rot90') app.rotateSelected(90);
    else if (act === 'dup') app.duplicateSelected();
    else if (act === 'del') app.deleteSelected();
    else if (act === 'lock') app.toggleLock();
    else if (act === 'none') app.clearSelection();
    else if (act === 'group') {
      const o = app.selectedObjects()[0];
      if (o) app.selectGroup(o.id);
    }
    else if (act === 'carry') {
      const on = !app.doc.settings.carryChairs;
      app.setPref('carryChairs', on);
      toast(on ? 'Angestellte Stühle wandern jetzt mit dem Tisch mit.' : 'Stühle bleiben stehen, wenn ein Tisch bewegt wird.');
    }
    else if (act === 'sight') app.setOverlay('sight', !app.overlay.sight);
    else if (act === 'settings') openSettings();
    else if (act === 'details') showDetails();
    else if (act === 'wheelchair') addWheelchair();
    else if (act === 'accessOn') app.setOverlay('access', true);
    else if (act === 'selWheel') {
      app.select(app.doc.objects.filter((o) => o.type === 'wheelchair').map((o) => o.id));
      if (mobile()) closeDrawers();
    } else if (act === 'delWheel') {
      app.mutate((d) => (d.objects = d.objects.filter((o) => o.type !== 'wheelchair')));
      app.sel = new Set([...app.sel].filter((id) => app.byId(id)));
      app.emit('select');
      toast('Test-Rollstühle entfernt');
    } else if (act === 'help') openHelp();
    else if (act === 'showProblems') app.select([...app.problems.keys()]);
    else if (act === 'new') openNew();
    else if (act === 'plans') openPlans();
    else if (act === 'export') exportPNG();
    else if (act === 'print') printPlan();
    else if (act === 'share') openShare();
  }

  function addWheelchair() {
    const door = app.doc.objects.find((o) => o.type === 'door');
    let at;
    if (door) {
      const inward = G.rot({ x: 0, y: -1 }, door.rot || 0);
      at = G.add(door, G.mul(inward, 110));
    }
    app.addObject('wheelchair', at, door ? { rot: G.rotFacing(G.rot({ x: 0, y: -1 }, door.rot || 0)) } : {});
    if (!app.overlay.access) app.setOverlay('access', true);
    toast('Test-Rollstuhl hinzugefügt – verschieben und drehen. Rot = eckt an, grüne Linie = Weg von der Tür.');
    if (mobile()) closeDrawers();
  }

  /* ---------- Prüfen & Zählen ---------- */
  /* Aufklappbarer Abschnitt; ovKey = Schalter für die Darstellung im Plan */
  function accCard(key, ic, title, summary, body, ovKey) {
    const open = !!panels[key];
    const sw = ovKey
      ? `<label class="acc-switch" title="Im Plan anzeigen"><span>Im Plan</span><input type="checkbox" class="switch" data-ov="${ovKey}" ${app.overlay[ovKey] ? 'checked' : ''} aria-label="${title}: im Plan anzeigen"></label>`
      : '';
    return `<section class="acc${open ? ' open' : ''}${ovKey && app.overlay[ovKey] ? ' on' : ''}" data-acc="${key}">
      <div class="acc-head">
        <button type="button" class="acc-btn" data-acc-toggle="${key}" aria-expanded="${open}" aria-controls="acc-${key}">
          <svg class="chev" aria-hidden="true"><use href="#i-chevron"/></svg>${icon(ic)}<span class="acc-title">${title}${summary ? `<small>${summary}</small>` : ''}</span>
        </button>${sw}
      </div>
      <div class="acc-body" id="acc-${key}"${open ? '' : ' hidden'}>${open ? body() : ''}</div>
    </section>`;
  }

  const row = (cls, ic, txt, small) => `<div class="check-row ${cls}">${icon(ic)}<span class="txt">${txt}${small ? `<small>${small}</small>` : ''}</span></div>`;

  function accessBody() {
    const a = app.access;
    const S = app.doc.settings;
    if (!a) return `<p class="desc">Wird berechnet …</p>`;
    let h = '';
    if (!a.hasDoor) h += row('bad', 'i-alert', 'Keine Tür im Plan', 'Unter „Raum & Technik“ eine Tür einfügen – sie ist der Startpunkt.');
    else if (a.doorOk) h += row('ok', 'i-check', 'Tür ist mit dem Rollstuhl erreichbar');
    else h += row('bad', 'i-alert', `Hinter der Tür ist kein Durchgang von ${S.passage} cm frei`);
    if (a.doors.some((d) => d.narrow)) h += row('warn', 'i-alert', `Tür schmaler als ${S.passage} cm`);
    if (a.hasDoor && a.doorOk) {
      const pct = a.freeArea ? Math.round((a.sweptArea / a.freeArea) * 100) : 0;
      h += row(pct >= 50 ? 'ok' : 'warn', pct >= 50 ? 'i-check' : 'i-alert', `Befahrbar: ${num(a.sweptArea)} m² von ${num(a.freeArea)} m² freier Fläche (${pct} %)`, pct < 50 ? 'Rote Flächen sind frei, aber nur über zu enge Stellen erreichbar.' : '');
      h += row(a.turnPossible ? 'ok' : 'bad', a.turnPossible ? 'i-check' : 'i-alert', a.turnPossible ? `Wenden (Ø ${S.turning} cm) möglich – dunkelgrüne Flächen` : `Nirgends Platz zum Wenden (Ø ${S.turning} cm)`);
      const now = a.tablesNow;
      const later = a.tablesLater;
      const cls = now ? 'ok' : later ? 'warn' : 'bad';
      let txt = `Tische mit Rollstuhlplatz: ${now} sofort erreichbar`;
      if (!a.complete) txt += ', weitere werden geprüft …';
      else if (later) txt += `, ${later} weitere nach Wegstellen ${a.laterMove > 1 ? 'von 1–2 Stühlen' : 'eines Stuhls'}`;
      h += row(cls, now ? 'i-check' : 'i-alert', txt, 'Der Weg von der Tür ist jeweils geprüft. Tisch antippen: Der Weg und ggf. der wegzustellende Stuhl werden im Plan gezeigt.');
    }
    // Test-Rollstuhl: eigener Block, klar als Hinzufügen gekennzeichnet
    const chairs = app.doc.objects.filter((o) => o.type === 'wheelchair');
    h += `<div class="sub-block"><div class="sub-head">${icon('i-wheelchair')}Test-Rollstuhl</div>
      <p class="desc">Ein Rollstuhl (70 × 120 cm) mit Wendekreis zum Ausprobieren. Er wird rot, wenn er aneckt; die grüne Linie zeigt den Weg von der Tür.</p>`;
    if (chairs.length) {
      const ok = a.wheelchairs.filter((w) => w.ok).length;
      h += `<p class="desc"><strong>${chairs.length === 1 ? '1 Test-Rollstuhl' : chairs.length + ' Test-Rollstühle'}</strong> im Plan · ${ok === chairs.length ? 'alle' : ok} von der Tür erreichbar</p>
        <div class="btn-row"><button class="btn outline small" data-act="selWheel">Auswählen</button><button class="btn outline small" data-act="delWheel" style="color:var(--bad)">${icon('i-trash')}Entfernen</button></div>`;
    }
    h += `<div class="btn-row"><button class="btn outline small block" data-act="wheelchair">${icon('i-plus')}Test-Rollstuhl hinzufügen</button></div></div>`;
    h += `<p class="callout">Vereinfachtes Modell in Anlehnung an DIN 18040-1 (Durchgang ≥ ${S.passage} cm, Bewegungsfläche Ø ${S.turning} cm). Ersetzt keine fachliche Prüfung vor Ort. Durchgangsbreiten am ausgewählten Objekt zeigt „Abstände“ unter „Ansicht im Plan“.</p>`;
    return h;
  }

  function sightBody(s) {
    let h = '';
    if (!s.surfaces.length) h += row('warn', 'i-alert', 'Keine Präsentationsfläche im Plan', 'Tafel, Bildschirm oder Beamer-Fläche einfügen.');
    h += `<table class="stat-table">
      <tr><td>${glyph('good')} Direkter Blick</td><td>${s.good}</td></tr>
      <tr class="grp"><td colspan="2">Eingeschränkt: ${s.limited}</td></tr>
      <tr class="sub"><td>${glyph('side')} Kopf seitlich drehen</td><td>${s.side}</td></tr>
      ${s.persons ? `<tr class="sub"><td>${glyph('person')} Person im Blickfeld</td><td>${s.person}</td></tr>` : ''}
      <tr><td>${glyph('back')} Kein Blick (abgewandt / verdeckt)</td><td>${s.back}</td></tr></table>`;
    const H = A.HEIGHTS;
    h += `<label class="toggle"><input type="checkbox" data-pref="sightPersons" ${s.persons ? 'checked' : ''}><span>Sitzende Personen im Blickfeld berücksichtigen<small>Ein Kopf (ca. ${2 * A.PERSON_R} cm breit) verdeckt je nach Abstand den unteren Teil der Fläche (Augenhöhe sitzend ${app.fmtM(H.eye)}, Fläche ${app.fmtM(H.low)}–${app.fmtM(H.top)}). Ab ${Math.round(A.PERSON_LIMIT * 100)} % verdeckter Fläche gilt die Sicht als eingeschränkt.</small></span></label>`;
    h += `<p class="callout">Berücksichtigt werden alle Präsentationsflächen im Plan (${s.surfaces.map((x) => esc(x.name)).join(', ') || '–'}). Regale und Trennwände verdecken die Sicht. <strong>Sitzplatz antippen</strong> zeigt seinen Sichtkegel und wer im Blickfeld sitzt. Die Handreichung empfiehlt, alle drei Flächen zu nutzen.</p>`;
    return h;
  }

  function renderChecks() {
    const box = $('#checks');
    const st = app.stats();
    const c = st.count;
    const S = app.doc.settings;
    const statRow = (label, n, inv) => {
      if (inv !== undefined) {
        const cls = n > inv ? 'warn' : n === inv ? 'ok' : '';
        return `<tr><td>${label}</td><td><span class="pill ${cls}">${n} / ${inv}</span></td></tr>`;
      }
      return `<tr><td>${label}</td><td>${n}</td></tr>`;
    };
    let h = `<h2 class="sec-title">Prüfen & Zählen</h2>`;

    h += `<div class="grp-title">Barrierefreiheit & Inklusion</div>`;
    const a = app.access;
    let accSum = `Durchgang ${S.passage} cm · Wenden Ø ${S.turning} cm`;
    if (a && !a.hasDoor) accSum = 'Keine Tür im Plan';
    else if (a && !a.doorOk) accSum = 'Tür nicht befahrbar';
    else if (a) accSum = `Tür ✓ · ${a.tablesNow} ${a.tablesNow === 1 ? 'Tisch' : 'Tische'} mit Rollstuhlplatz${a.complete && a.tablesLater ? ` (+${a.tablesLater})` : ''}`;
    h += accCard('access', 'i-wheelchair', 'Rollstuhl-Check', accSum, accessBody, 'access');

    const s = app.getSight();
    let sightSum = `${s.good} direkt · ${s.limited} eingeschränkt · ${s.back} ohne Blick`;
    if (!s.seats.length) sightSum = 'Keine Sitzplätze im Plan';
    else if (!s.surfaces.length) sightSum = 'Keine Präsentationsfläche im Plan';
    h += accCard('sight', 'i-eye', 'Sicht auf Tafel & Bildschirme', sightSum, () => sightBody(s), 'sight');

    h += `<div class="grp-title">Raum & Belegung</div>`;
    const seatsCls = st.seats > 24 ? 'warn' : 'ok';
    h += accCard('seats', 'i-list', 'Belegung', `${st.seats} Arbeitsplätze${st.lounge ? ` · ${st.lounge} Lounge` : ''}${st.seats > 24 ? ' · mehr als empfohlen' : ''}`, () => {
      let b = `<table class="stat-table">`;
      b += statRow('Dreieckstische', c.table || 0, 12);
      if (c.tableRect) b += statRow('Rechtecktische', c.tableRect);
      b += statRow('Stühle', c.chair || 0, 19);
      b += statRow('Hocker', c.stool || 0, 2);
      if (st.wheelchairs) b += statRow('Rollstuhlplätze (Test-Rollstühle)', st.wheelchairs);
      b += `<tr class="total"><td>Arbeitsplätze gesamt</td><td><span class="pill ${seatsCls}">${st.seats}</span></td></tr>`;
      b += statRow('Lounge (Sofa, Sitzsäcke)', st.lounge);
      b += `</table>`;
      if (st.seats > 24) b += row('warn', 'i-alert', 'Mehr als 24 Arbeitsplätze', 'Die Handreichung empfiehlt maximal 24 Sitzplätze im LLR.');
      if ((c.chair || 0) > 19) b += row('warn', 'i-info', `${c.chair - 19} Stuhl/Stühle mehr als im LLR vorhanden`, 'Zusätzliche Stühle aus anderen Räumen holen.');
      return b;
    });

    const zones = app.doc.objects.filter((o) => T[o.type].kind === 'zone');
    if (zones.length) {
      h += accCard('zones', 'i-grid', 'Zonen', zones.length === 1 ? '1 Zone' : `${zones.length} Zonen`, () => {
        let b = `<table class="stat-table">`;
        for (const z of zones) {
          const col = (T[z.type].colors[z.color] || T[z.type].colors[T[z.type].defaultColor]).fill;
          b += `<tr><td><span class="zone-dot" style="background:${col}"></span>${esc(z.label || 'Zone')}</td><td>${LLR.zoneArea(z)}</td></tr>`;
        }
        return b + `</table>`;
      });
    }

    const probs = app.problems.size;
    if (probs) h += `<div class="check-row bad">${icon('i-alert')}<span class="txt">${probs} Objekt(e) überschneiden sich oder ragen aus dem Raum<br><button class="btn outline small" data-act="showProblems">Markieren</button></span></div>`;
    else h += `<div class="check-row ok">${icon('i-check')}<span class="txt">Keine Überschneidungen</span></div>`;

    h += `<div class="grp-title">Ansicht im Plan</div>`;
    const vw = (key, ic, label, small) =>
      `<label class="switch-row compact">${icon(ic)}<span class="lbl">${label}<small>${small}</small></span><input type="checkbox" class="switch" data-ov="${key}" ${app.overlay[key] ? 'checked' : ''} aria-label="${label}"></label>`;
    h += vw('dims', 'i-dims', 'Abstände zum Nachbarn', `Am ausgewählten Objekt · grün ≥ ${S.passage} cm`);
    h += vw('roomDims', 'i-roomdims', 'Raummaße', 'Breite, Länge und Fläche am Rand');
    h += vw('grid', 'i-grid', 'Raster', `Rastergröße ${S.grid || 50} cm`);
    rerender(box, h);
  }

  function setAccOpen(key, open) {
    panels[key] = open;
    savePanels();
    if (key === 'access') app.setNeed('access', open);
  }

  function bindChecks() {
    const box = $('#checks');
    box.addEventListener('change', (e) => {
      const k = e.target.getAttribute('data-ov');
      if (k) {
        if (e.target.checked && (k === 'access' || k === 'sight')) setAccOpen(k, true);
        app.setOverlay(k, e.target.checked);
        return;
      }
      const pref = e.target.getAttribute('data-pref');
      if (pref) app.setPref(pref, e.target.checked);
    });
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-acc-toggle]');
      if (!b) return;
      const key = b.getAttribute('data-acc-toggle');
      setAccOpen(key, !panels[key]);
      renderChecks();
    });
  }

  /* ---------- Legende ---------- */
  function renderLegend() {
    const lg = $('#legend');
    let h = '';
    if (app.overlay.access) {
      const S = app.doc.settings;
      h += `<strong>Rollstuhl</strong>
        <div class="row"><span class="sw" style="background:rgba(116,205,132,.55)"></span><span>befahrbar (≥ ${S.passage} cm)</span></div>
        <div class="row"><span class="sw" style="background:rgba(47,158,68,.75)"></span><span>Wenden möglich (Ø ${S.turning} cm)</span></div>
        <div class="row"><span class="sw" style="background:rgba(224,49,49,.55)"></span><span>frei, aber zu eng / nicht erreichbar</span></div>
        <div class="row"><span class="sw round" style="background:#1F6FEB"></span><span>Rollstuhlplatz am Tisch (gestrichelt: erst Stuhl wegstellen)</span></div>
        <div class="row"><span class="sw line" style="color:#1F6FEB"></span><span>Weg von der Tür (Tisch antippen)</span></div>`;
    }
    if (app.overlay.sight) {
      h += `<strong>Sicht</strong>
        <div class="row">${glyph('good')}<span>direkter Blick</span></div>
        <div class="row">${glyph('side')}<span>eingeschränkt: Kopf seitlich drehen</span></div>
        ${app.doc.settings.sightPersons !== false ? `<div class="row">${glyph('person')}<span>eingeschränkt: Person im Blickfeld</span></div>` : ''}
        <div class="row">${glyph('back')}<span>kein Blick: abgewandt / verdeckt</span></div>
        <div class="row"><span class="sw cone"></span><span>${app.selectedObjects().some(A.isSeat) ? 'Sichtkegel (rot = verdeckt, orange = Person)' : 'Sitzplatz antippen: Sichtkegel'}</span></div>`;
    }
    lg.hidden = !h;
    if (!h) {
      $('#stage').classList.remove('has-legend');
      return;
    }
    const open = !!panels.legend;
    rerender(lg, `<button type="button" class="legend-head" data-legend="1" aria-expanded="${open}" aria-controls="legend-body">Legende<svg class="chev" aria-hidden="true"><use href="#i-chevron"/></svg></button><div class="legend-body" id="legend-body"${open ? '' : ' hidden'}>${h}</div>`);
    lg.classList.toggle('collapsed', !open);
    $('#stage').classList.toggle('has-legend', open);
  }

  function bindLegend() {
    $('#legend').addEventListener('click', (e) => {
      if (!e.target.closest('[data-legend]')) return;
      panels.legend = !panels.legend;
      savePanels();
      renderLegend();
    });
  }

  /* ---------- Werkzeugleiste ---------- */
  function syncTools() {
    for (const b of $$('.tool[data-mode]')) b.setAttribute('aria-pressed', String(app.mode === b.getAttribute('data-mode') && !(app.multi && app.mode === 'select' && b.getAttribute('data-mode') === 'select')));
    $('#tool-multi').setAttribute('aria-pressed', String(app.multi));
    for (const b of $$('.tool[data-overlay]')) b.setAttribute('aria-pressed', String(!!app.overlay[b.getAttribute('data-overlay')]));
    syncSnapPop();
    const hint = $('#stage-hint');
    if (app.mode === 'measure') {
      hint.textContent = app.measure ? `Gemessen: ${Math.round(G.dist(app.measure.a, app.measure.b))} cm – neue Linie ziehen oder Esc` : 'Linie ziehen zum Messen · rastet an Kanten ein (Alt = frei, Umschalt = 45°)';
      hint.hidden = false;
    } else if (app.multi) {
      hint.textContent = 'Mehrfachauswahl: Objekte antippen oder Rahmen aufziehen · ins Leere tippen hebt die Auswahl auf';
      hint.hidden = false;
    } else hint.hidden = true;
  }

  /* Einrasten & Raster (Magnet-Knopf) */
  function syncSnapPop() {
    const s = app.doc.settings;
    const pop = $('#snap-pop');
    for (const i of $$('[data-pref]', pop)) i.checked = !!s[i.getAttribute('data-pref')];
    for (const b of $$('[data-grid]', pop)) b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-grid')) === (s.grid || 50)));
    $('#tool-snap').setAttribute('aria-expanded', String(!pop.hidden));
  }

  function toggleSnapPop(show) {
    const pop = $('#snap-pop');
    const btn = $('#tool-snap');
    pop.hidden = show === undefined ? !pop.hidden : !show;
    if (!pop.hidden) {
      const st = $('#stage').getBoundingClientRect();
      const br = btn.getBoundingClientRect();
      const rail = $('.tool-rail').getBoundingClientRect();
      pop.style.top = Math.round(rail.bottom - st.top + 6) + 'px';
      pop.style.left = Math.round(Math.max(8, Math.min(br.left - st.left, st.width - pop.offsetWidth - 8))) + 'px';
    }
    syncSnapPop();
  }

  function bindSnapPop() {
    const pop = $('#snap-pop');
    $('#tool-snap').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSnapPop();
    });
    pop.addEventListener('change', (e) => {
      const k = e.target.getAttribute('data-pref');
      if (k) app.setPref(k, e.target.checked);
    });
    pop.addEventListener('click', (e) => {
      const b = e.target.closest('[data-grid]');
      if (b) app.setPref('grid', Number(b.getAttribute('data-grid')));
    });
    document.addEventListener('pointerdown', (e) => {
      if (!pop.hidden && !e.target.closest('#snap-pop, #tool-snap')) toggleSnapPop(false);
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !pop.hidden) toggleSnapPop(false);
    });
  }

  function bindTools() {
    for (const b of $$('.tool[data-mode]')) {
      b.addEventListener('click', () => {
        const m = b.getAttribute('data-mode');
        if (m === 'select') app.multi = false;
        app.setMode(m);
        syncTools();
      });
    }
    $('#tool-multi').addEventListener('click', () => {
      app.multi = !app.multi;
      if (app.multi) app.setMode('select');
      syncTools();
    });
    for (const b of $$('.tool[data-overlay]')) {
      b.addEventListener('click', () => {
        const k = b.getAttribute('data-overlay');
        const on = !app.overlay[k];
        if (on && (k === 'access' || k === 'sight')) setAccOpen(k, true);
        app.setOverlay(k, on);
      });
    }
    $('#zoom-in').addEventListener('click', () => app.zoomBy(1 / 1.3));
    $('#zoom-out').addEventListener('click', () => app.zoomBy(1.3));
    $('#zoom-fit').addEventListener('click', () => app.fitView());
    $('#btn-undo').addEventListener('click', () => app.undo());
    $('#btn-redo').addEventListener('click', () => app.redo());
    $('#btn-new').addEventListener('click', openNew);
    $('#btn-plans').addEventListener('click', openPlans);
    $('#btn-export').addEventListener('click', exportPNG);
    $('#btn-print').addEventListener('click', printPlan);
    $('#btn-share').addEventListener('click', openShare);
    $('#btn-settings').addEventListener('click', openSettings);
    $('#btn-help').addEventListener('click', openHelp);
    $('#btn-left').addEventListener('click', () => toggleSide('left'));
    $('#btn-right').addEventListener('click', () => toggleSide('right'));
    const more = $('#more-menu');
    $('#btn-more').addEventListener('click', (e) => {
      e.stopPropagation();
      more.hidden = !more.hidden;
      $('#btn-more').setAttribute('aria-expanded', String(!more.hidden));
    });
    more.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      more.hidden = true;
      doAct(b.getAttribute('data-act'));
    });
    document.addEventListener('click', (e) => {
      if (!more.hidden && !e.target.closest('#more-menu')) more.hidden = true;
    });
    document.body.addEventListener('click', (e) => {
      const b = e.target.closest('#props [data-act], #checks [data-act], #sel-bar [data-act]');
      if (b) doAct(b.getAttribute('data-act'));
    });
    const name = $('#plan-name');
    name.addEventListener('change', () => {
      app.mutate((d) => (d.name = name.value.trim() || 'Raumplan'));
    });
    name.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') name.blur();
    });
    window.addEventListener('keydown', app.onKey);
  }

  /* ---------- Tabs & Schubladen (mobil) ---------- */
  function setTab(tab) {
    for (const b of $$('.tabs [role="tab"]')) {
      const on = b.getAttribute('data-tab') === tab;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    for (const id of ['catalog', 'presets', 'objects']) $('#tab-' + id).hidden = id !== tab;
    if (tab === 'objects') renderObjects();
  }

  function bindTabs() {
    const tabs = $$('.tabs [role="tab"]');
    for (const b of tabs) {
      b.addEventListener('click', () => setTab(b.getAttribute('data-tab')));
      b.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const i = tabs.indexOf(b);
        const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        n.focus();
        setTab(n.getAttribute('data-tab'));
      });
    }
  }

  /* Seitenleisten am Computer ein- und ausklappen */
  function applySides() {
    const ws = $('.workspace');
    ws.classList.toggle('no-left', !panels.left);
    ws.classList.toggle('no-right', !panels.right);
    $('#btn-left').setAttribute('aria-expanded', String(panels.left));
    $('#btn-right').setAttribute('aria-expanded', String(panels.right));
    renderSelBar();
  }
  function toggleSide(side, open) {
    panels[side] = open === undefined ? !panels[side] : open;
    savePanels();
    applySides();
  }
  function showDetails() {
    if (mobile()) openRight('props');
    else {
      if (!panels.right) toggleSide('right', true);
      $('#panel-right').scrollTop = 0;
    }
  }

  function setSheetView(view) {
    $('#panel-right').setAttribute('data-view', view);
    for (const b of $$('.sheet-tabs [data-view]')) b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === view));
  }

  function openLeft(tab) {
    if (tab) setTab(tab);
    $('#panel-left').classList.add('open');
    $('#panel-right').classList.remove('open');
    $('#scrim').hidden = false;
  }
  function openRight(section) {
    setSheetView(section === 'checks' ? 'checks' : 'props');
    const panel = $('#panel-right');
    panel.classList.add('open');
    panel.style.transform = '';
    $('#panel-left').classList.remove('open');
    $('#scrim').hidden = false;
    panel.scrollTop = 0;
  }
  function closeDrawers() {
    $('#panel-left').classList.remove('open');
    const panel = $('#panel-right');
    panel.classList.remove('open');
    panel.style.transform = '';
    $('#scrim').hidden = true;
  }

  function bindDrawers() {
    $('#btn-drawer').addEventListener('click', () => openLeft());
    $('#scrim').addEventListener('click', closeDrawers);
    for (const b of $$('[data-close]')) b.addEventListener('click', closeDrawers);
    for (const b of $$('.mobile-bar [data-open]')) {
      b.addEventListener('click', () => {
        const k = b.getAttribute('data-open');
        if (k === 'catalog' || k === 'presets') openLeft(k);
        else openRight(k);
      });
    }
    for (const b of $$('.sheet-tabs [data-view]')) b.addEventListener('click', () => {
      setSheetView(b.getAttribute('data-view'));
      $('#panel-right').scrollTop = 0;
    });
    // Unteres Blatt (Smartphone) am Kopf nach unten wischen schließt es
    const panel = $('#panel-right');
    const head = $('.sheet-head');
    let swipe = null;
    head.addEventListener('pointerdown', (e) => {
      if (!phone() || e.target.closest('button')) return;
      swipe = { id: e.pointerId, y0: e.clientY, dy: 0 };
      head.setPointerCapture(e.pointerId);
      panel.style.transition = 'none';
    });
    head.addEventListener('pointermove', (e) => {
      if (!swipe || e.pointerId !== swipe.id) return;
      swipe.dy = Math.max(0, e.clientY - swipe.y0);
      panel.style.transform = `translateY(${swipe.dy}px)`;
    });
    const end = (e) => {
      if (!swipe || e.pointerId !== swipe.id) return;
      panel.style.transition = '';
      if (swipe.dy > 70) closeDrawers();
      else panel.style.transform = '';
      swipe = null;
    };
    head.addEventListener('pointerup', end);
    head.addEventListener('pointercancel', end);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDrawers();
    });
    // Wechsel zwischen Handy-/Tablet- und Computer-Ansicht
    window.matchMedia('(max-width: 900px)').addEventListener('change', () => {
      closeDrawers();
      renderSelBar();
    });
  }

  /* ---------- Dialoge ---------- */
  function openDialog(opts) {
    const dlg = $('#dlg');
    $('#dlg-title').textContent = opts.title;
    const body = $('#dlg-body');
    body.innerHTML = opts.body || '';
    const foot = $('#dlg-foot');
    foot.innerHTML = '';
    for (const b of opts.buttons || []) {
      const btn = document.createElement('button');
      btn.className = 'btn ' + (b.cls || 'outline');
      btn.textContent = b.label;
      if (b.value !== undefined) {
        btn.value = b.value;
      } else {
        btn.type = 'button';
        btn.addEventListener('click', () => b.onClick && b.onClick(btn));
      }
      foot.appendChild(btn);
    }
    dlg.style.width = opts.wide ? 'min(720px, calc(100vw - 24px))' : '';
    dlg.returnValue = '';
    return new Promise((resolve) => {
      const onClose = () => {
        dlg.removeEventListener('close', onClose);
        resolve(dlg.returnValue);
      };
      dlg.addEventListener('close', onClose);
      dlg.showModal();
      const primary = foot.querySelector('.btn.primary');
      if (primary && !opts.keepFocus) primary.focus();
      if (opts.onOpen) opts.onOpen(body);
    });
  }

  async function confirmDlg(title, html, okLabel, danger) {
    const v = await openDialog({
      title,
      body: html,
      buttons: [
        { label: 'Abbrechen', value: 'cancel' },
        { label: okLabel || 'OK', value: 'ok', cls: danger ? 'danger' : 'primary' },
      ],
    });
    return v === 'ok';
  }

  /* Neuer Plan */
  async function openNew() {
    const v = await openDialog({
      title: 'Neuer Plan',
      body: `<p>Womit möchten Sie beginnen? Der aktuelle Plan wird ersetzt (Rückgängig mit <span class="kbd">Strg</span>+<span class="kbd">Z</span> möglich; vorher ggf. unter „Pläne“ speichern).</p>
        <label class="toggle"><input type="radio" name="newkind" value="seminar1" checked> LLR wie eingerichtet (Seminarsitzordnung I)</label>
        <label class="toggle"><input type="radio" name="newkind" value="furnished"> LLR ohne Tische & Stühle (nur feste Einrichtung)</label>
        <label class="toggle"><input type="radio" name="newkind" value="empty"> Leerer Raum (nur Tür & Fenster)</label>`,
      buttons: [
        { label: 'Abbrechen', value: 'cancel' },
        { label: 'Neu anlegen', value: 'ok', cls: 'primary' },
      ],
      onOpen: (b) => (b._kind = () => (b.querySelector('input[name=newkind]:checked') || {}).value),
    });
    if (v !== 'ok') return;
    const kind = $('#dlg-body')._kind();
    const doc = app.createDoc(kind === 'seminar1' ? 'seminar1' : null);
    doc.room = Object.assign({}, app.doc.room);
    doc.settings = Object.assign({}, app.doc.settings);
    doc.objects = LLR.roomFurniture(doc.room);
    if (kind === 'seminar1') doc.objects = doc.objects.concat(app.buildPreset(LLR.PRESETS[0], doc));
    if (kind === 'empty') doc.objects = doc.objects.filter((o) => o.type === 'door' || o.type === 'window');
    replaceDoc(doc);
    toast('Neuer Plan angelegt');
  }

  function replaceDoc(doc) {
    const n = app.normalizeDoc(doc);
    app.mutate((d) => {
      d.name = n.name;
      d.room = n.room;
      d.settings = n.settings;
      d.objects = n.objects;
    });
    app.sel = new Set();
    app.renderRoom();
    app.fitView();
    app.emit('select');
  }

  /* Einstellungen */
  async function openSettings() {
    const r = app.doc.room;
    const s = app.doc.settings;
    const v = await openDialog({
      title: 'Raum & Einstellungen',
      wide: true,
      body: `<h3>Raum</h3>
        <div class="field-grid two">
          <label class="field">Breite – Tafelseite (m)<input type="number" id="set-w" value="${(r.w / 100).toFixed(2)}" min="2" max="30" step="0.05"></label>
          <label class="field">Länge (m)<input type="number" id="set-l" value="${(r.l / 100).toFixed(2)}" min="2" max="30" step="0.05"></label>
        </div>
        <p class="area-hint" id="set-area"></p>
        <p class="desc">Möbel an der rechten Wand und an der Rückwand wandern beim Ändern mit. Tür, Fenster und Wandobjekte bleiben an ihrer Wand.</p>
        <h3>Möbelmaße</h3>
        <div class="field-grid">
          <label class="field">Tisch: lange Seite (cm)<input type="number" id="set-tb" value="${s.tableBase}" min="60" max="200" step="1"></label>
          <label class="field">Tisch: Tiefe (cm)<input type="number" id="set-th" value="${s.tableHeight}" min="30" max="120" step="1"></label>
          <span></span>
          <label class="field">Stuhl: Breite (cm)<input type="number" id="set-cw" value="${s.chairW}" min="30" max="80" step="1"></label>
          <label class="field">Stuhl: Tiefe (cm)<input type="number" id="set-cd" value="${s.chairD}" min="30" max="90" step="1"></label>
        </div>
        <h3>Barrierefreiheit</h3>
        <div class="field-grid two">
          <label class="field">Mindest-Durchgangsbreite (cm)<input type="number" id="set-pass" value="${s.passage}" min="60" max="200" step="5"></label>
          <label class="field">Wendekreis Ø (cm)<input type="number" id="set-turn" value="${s.turning}" min="100" max="250" step="5"></label>
        </div>
        <label class="toggle"><input type="checkbox" id="set-block" ${s.chairsBlock ? 'checked' : ''}> Stühle und Hocker als Hindernis zählen</label>
        <p class="desc">DIN 18040-1: Durchgänge mind. 90 cm, Bewegungsflächen 150 × 150 cm.</p>
        <h3>Bedienung</h3>
        <label class="toggle"><input type="checkbox" id="set-snap" ${s.snap ? 'checked' : ''}> Magnetisch einrasten (Tischkanten, Wände, Stühle zum Tisch) <small>Alt-Taste hält das Einrasten kurz an</small></label>
        <label class="toggle"><input type="checkbox" id="set-carry" ${s.carryChairs ? 'checked' : ''}> Angestellte Stühle beim Verschieben von Tischen mitnehmen</label>
        <label class="toggle"><input type="checkbox" id="set-gridsnap" ${s.gridSnap ? 'checked' : ''}> Möbel am Raster einrasten</label>
        <div class="field-grid two">
          <label class="field">Rastergröße
            <select id="set-grid">${GRID_SIZES.map((g) => `<option value="${g}" ${(s.grid || 50) === g ? 'selected' : ''}>${g} cm</option>`).join('')}</select></label>
          <label class="field">Winkelraster beim Drehen
            <select id="set-angle">${[5, 15, 45, 90].map((a) => `<option value="${a}" ${s.angleSnap === a ? 'selected' : ''}>${a}°</option>`).join('')}</select></label>
        </div>`,
      buttons: [
        { label: 'Standardwerte', onClick: () => fillDefaults() },
        { label: 'Abbrechen', value: 'cancel' },
        { label: 'Übernehmen', value: 'ok', cls: 'primary' },
      ],
      onOpen: () => {
        const upd = () => {
          const w = parseFloat($('#set-w').value) || 0;
          const l = parseFloat($('#set-l').value) || 0;
          $('#set-area').textContent = `Fläche: ${num(w * l, 1)} m²`;
        };
        $('#set-w').addEventListener('input', upd);
        $('#set-l').addEventListener('input', upd);
        upd();
      },
    });
    function fillDefaults() {
      const d = LLR.DEFAULT_SETTINGS;
      const R = LLR.DEFAULT_ROOM;
      $('#set-w').value = (R.w / 100).toFixed(2);
      $('#set-l').value = (R.l / 100).toFixed(2);
      $('#set-tb').value = d.tableBase;
      $('#set-th').value = d.tableHeight;
      $('#set-cw').value = d.chairW;
      $('#set-cd').value = d.chairD;
      $('#set-pass').value = d.passage;
      $('#set-turn').value = d.turning;
      $('#set-block').checked = d.chairsBlock;
      $('#set-snap').checked = d.snap;
      $('#set-carry').checked = d.carryChairs;
      $('#set-gridsnap').checked = d.gridSnap;
      $('#set-grid').value = d.grid;
      $('#set-angle').value = d.angleSnap;
      $('#set-w').dispatchEvent(new Event('input'));
    }
    if (v !== 'ok') return;
    const val = (id, def, min, max) => {
      const x = parseFloat(String($(id).value).replace(',', '.'));
      return isFinite(x) ? Math.max(min, Math.min(max, x)) : def;
    };
    const newW = Math.round(val('#set-w', r.w / 100, 2, 30) * 100);
    const newL = Math.round(val('#set-l', r.l / 100, 2, 30) * 100);
    app.mutate((doc) => {
      if (newW !== doc.room.w || newL !== doc.room.l) app.applyRoomResize(app.roomSnapshot(), { l: 0, t: 0, r: newW - doc.room.w, b: newL - doc.room.l });
      const st = doc.settings;
      st.tableBase = val('#set-tb', st.tableBase, 60, 200);
      st.tableHeight = val('#set-th', st.tableHeight, 30, 120);
      st.chairW = val('#set-cw', st.chairW, 30, 80);
      st.chairD = val('#set-cd', st.chairD, 30, 90);
      st.passage = val('#set-pass', st.passage, 60, 200);
      st.turning = val('#set-turn', st.turning, 100, 250);
      st.chairsBlock = $('#set-block').checked;
      st.snap = $('#set-snap').checked;
      st.carryChairs = $('#set-carry').checked;
      st.gridSnap = $('#set-gridsnap').checked;
      st.grid = parseInt($('#set-grid').value, 10) || 50;
      st.angleSnap = parseInt($('#set-angle').value, 10) || 15;
    });
    app.renderRoom();
    app.fitView();
    toast('Einstellungen übernommen');
  }

  /* Gespeicherte Pläne */
  const loadPlans = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY_PLANS) || '[]');
    } catch (e) {
      return [];
    }
  };
  const storePlans = (list) => {
    try {
      localStorage.setItem(KEY_PLANS, JSON.stringify(list));
      return true;
    } catch (e) {
      toast('Speichern im Browser nicht möglich (Speicher voll oder gesperrt). Bitte als Datei herunterladen.');
      return false;
    }
  };

  function openPlans() {
    const render = (body) => {
      const list = loadPlans();
      let h = `<h3>Im Browser speichern</h3>
        <div class="share-box"><input type="text" id="plan-save-name" value="${esc(app.doc.name)}" aria-label="Name"><button type="button" class="btn primary" id="plan-save">${icon('i-save')}Speichern</button></div>
        <p class="desc">Pläne werden nur in diesem Browser auf diesem Gerät gespeichert.</p>
        <h3>Gespeicherte Pläne (${list.length})</h3>`;
      if (!list.length) h += `<p class="desc">Noch keine Pläne gespeichert.</p>`;
      else {
        h += `<ul class="plans-list">`;
        for (const p of list.slice().sort((a, b) => b.date - a.date)) {
          h += `<li><span class="p-name"><strong>${esc(p.name)}</strong><small>${new Date(p.date).toLocaleString('de-DE')}</small></span>
            <button type="button" class="btn outline small" data-load="${p.id}">Öffnen</button>
            <button type="button" class="icon-btn danger" data-delp="${p.id}" aria-label="Löschen" title="Löschen">${icon('i-trash')}</button></li>`;
        }
        h += `</ul>`;
      }
      h += `<h3>Als Datei</h3><div class="btn-row">
        <button type="button" class="btn outline" id="plan-dl">${icon('i-download')}Herunterladen (.json)</button>
        <button type="button" class="btn outline" id="plan-ul">${icon('i-upload')}Datei öffnen</button></div>
        <p class="desc">Dateien lassen sich per E-Mail oder OPAL weitergeben und hier wieder öffnen.</p>`;
      body.innerHTML = h;
    };
    openDialog({
      title: 'Pläne speichern & öffnen',
      body: '',
      buttons: [{ label: 'Schließen', value: 'cancel' }],
      onOpen: (body) => {
        render(body);
        body.onclick = (e) => {
          if (e.target.closest('#plan-save')) {
            const name = $('#plan-save-name').value.trim() || app.doc.name;
            const list = loadPlans();
            const existing = list.find((p) => p.name === name);
            const entry = { id: existing ? existing.id : LLR.newId(), name, date: Date.now(), doc: JSON.parse(app.serialize()) };
            entry.doc.name = name;
            const next = existing ? list.map((p) => (p.id === existing.id ? entry : p)) : list.concat(entry);
            if (storePlans(next)) {
              if (app.doc.name !== name) app.mutate((d) => (d.name = name));
              toast(existing ? `„${name}“ aktualisiert` : `„${name}“ gespeichert`);
              render(body);
            }
            return;
          }
          const l = e.target.closest('[data-load]');
          if (l) {
            const p = loadPlans().find((x) => x.id === l.getAttribute('data-load'));
            if (p) {
              replaceDoc(p.doc);
              $('#dlg').close();
              toast(`„${p.name}“ geöffnet`);
            }
            return;
          }
          const d = e.target.closest('[data-delp]');
          if (d) {
            const id = d.getAttribute('data-delp');
            const p = loadPlans().find((x) => x.id === id);
            if (p && window.confirm(`„${p.name}“ wirklich löschen?`)) {
              storePlans(loadPlans().filter((x) => x.id !== id));
              render(body);
            }
            return;
          }
          if (e.target.closest('#plan-dl')) downloadJSON();
          if (e.target.closest('#plan-ul')) $('#file-input').click();
        };
      },
    });
  }

  const fileName = (ext) => {
    const map = { ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ß: 'ss' };
    const base = (app.doc.name || 'raumplan').replace(/[äöüÄÖÜß]/g, (c) => map[c]).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_');
    return (base || 'raumplan') + ext;
  };

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  }

  function downloadJSON() {
    const data = JSON.parse(app.serialize());
    data.app = 'LLR-Raumplaner 2D';
    download(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), fileName('.llr.json'));
  }

  function bindFile() {
    $('#file-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const doc = JSON.parse(await file.text());
        replaceDoc(doc);
        const dlg = $('#dlg');
        if (dlg.open) dlg.close();
        toast(`„${app.doc.name}“ geöffnet`);
      } catch (err) {
        toast('Die Datei konnte nicht gelesen werden.');
      }
    });
  }

  /* ---------- Teilen per Link ---------- */
  const b64url = (bytes) => {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const fromB64url = (str) => {
    const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  };

  function compactDoc() {
    const d = JSON.parse(app.serialize());
    const r1 = (v) => Math.round(v * 10) / 10;
    d.objects = d.objects.map((o) => {
      const c = Object.assign({}, o);
      delete c.id;
      c.x = r1(c.x);
      c.y = r1(c.y);
      c.rot = r1(c.rot || 0);
      if (!c.rot) delete c.rot;
      return c;
    });
    return d;
  }

  async function packDoc() {
    const json = JSON.stringify(compactDoc());
    if ('CompressionStream' in window) {
      try {
        const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
        const buf = new Uint8Array(await new Response(stream).arrayBuffer());
        return 'z' + b64url(buf);
      } catch (e) {
        /* Fallback unten */
      }
    }
    return 'j' + b64url(new TextEncoder().encode(json));
  }

  async function unpackDoc(str) {
    const kind = str[0];
    const bytes = fromB64url(str.slice(1));
    if (kind === 'z') {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return JSON.parse(await new Response(stream).text());
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  async function openShare() {
    const code = await packDoc();
    const url = location.origin + location.pathname + '#p=' + code;
    const canShare = !!navigator.share;
    openDialog({
      title: 'Plan teilen',
      body: `<p>Der komplette Plan steckt in diesem Link – es wird nichts auf einem Server gespeichert. Wer den Link öffnet, sieht den Plan und kann ihn weiter bearbeiten.</p>
        <div class="share-box"><input type="text" id="share-url" readonly value="${esc(url)}" aria-label="Link zum Plan"></div>
        <p class="desc">Länge: ${url.length} Zeichen.${url.length > 2000 ? ' Sehr lange Links funktionieren nicht überall – dann besser „Pläne → Herunterladen“ verwenden.' : ''}</p>`,
      buttons: [
        ...(canShare ? [{ label: 'Teilen …', onClick: () => navigator.share({ title: app.doc.name, url }).catch(() => {}) }] : []),
        {
          label: 'Link kopieren',
          cls: 'primary',
          onClick: async (btn) => {
            const inp = $('#share-url');
            try {
              await navigator.clipboard.writeText(url);
            } catch (e) {
              inp.select();
              document.execCommand('copy');
            }
            btn.textContent = 'Kopiert ✓';
          },
        },
        { label: 'Schließen', value: 'cancel' },
      ],
      onOpen: () => {
        const inp = $('#share-url');
        inp.addEventListener('focus', () => inp.select());
      },
    });
  }

  /* ---------- Bild-Export & Druck ---------- */
  function buildExportSVG(scale, opts) {
    opts = opts || {};
    const W = app.doc.room.w;
    const L = app.doc.room.l;
    const pad = 55;
    const head = 56;
    const x0 = -20 - pad;
    const y0 = -20 - pad - head;
    const w = W + 2 * (20 + pad);
    const h = L + 2 * (20 + pad) + head;
    const svg = app.svg;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${x0} ${y0} ${w} ${h}" width="${Math.round(w * scale)}" height="${Math.round(h * scale)}" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif">`;
    s += `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#ffffff"/>`;
    s += svg.querySelector('defs').outerHTML;
    if (!opts.noTitle) {
      s += `<text x="${x0 + 24}" y="${y0 + 34}" font-size="24" font-weight="700" fill="#1d2433">${esc(app.doc.name)}</text>`;
      s += `<text x="${x0 + w - 24}" y="${y0 + 34}" font-size="14" fill="#5f6b7a" text-anchor="end">LLR · ${new Date().toLocaleDateString('de-DE')}</text>`;
    }
    s += `<g>${app.els.floor.innerHTML}</g><g>${app.els.analysis.innerHTML}</g><g>${app.els.walls.innerHTML}</g><g>${app.els.objects.innerHTML}</g><g>${app.els.tags.innerHTML}</g><g>${app.els.marks.innerHTML}</g>`;
    s += `</svg>`;
    if (opts.prefix) s = s.replace(/id="([\w-]+)"/g, `id="${opts.prefix}$1"`).replace(/url\(#([\w-]+)\)/g, `url(#${opts.prefix}$1)`);
    return { svg: s, w: Math.round(w * scale), h: Math.round(h * scale) };
  }

  function exportPNG() {
    const scale = 2;
    const { svg, w, h } = buildExportSVG(scale);
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      cv.toBlob((blob) => {
        if (blob) {
          download(blob, fileName('.png'));
          toast('Bild gespeichert');
        } else toast('Export fehlgeschlagen');
      }, 'image/png');
    };
    img.onerror = () => toast('Export fehlgeschlagen');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function buildPrintSheet() {
    const st = app.stats();
    const c = st.count;
    const { svg } = buildExportSVG(1, { noTitle: true, prefix: 'pr-' });
    let h = `<h1>${esc(app.doc.name)}</h1><div class="sub">Lehr-Lern-Raum Inklusion (LLR) · ${app.fmtM(app.doc.room.w)} × ${app.fmtM(app.doc.room.l)} (${app.fmtArea(app.doc.room.w * app.doc.room.l)}) · ${new Date().toLocaleString('de-DE')}</div>`;
    h += `<div class="plan">${svg}</div>`;
    h += `<div class="cols"><table><tr><th colspan="2">Belegung</th></tr>
      <tr><td>Dreieckstische</td><td>${c.table || 0} / 12</td></tr>
      ${c.tableRect ? `<tr><td>Rechtecktische</td><td>${c.tableRect}</td></tr>` : ''}
      <tr><td>Stühle</td><td>${c.chair || 0} / 19</td></tr>
      <tr><td>Hocker</td><td>${c.stool || 0} / 2</td></tr>
      ${st.wheelchairs ? `<tr><td>Rollstuhlplätze</td><td>${st.wheelchairs}</td></tr>` : ''}
      <tr><td><strong>Arbeitsplätze gesamt</strong></td><td><strong>${st.seats}</strong> (empfohlen max. 24)</td></tr>
      <tr><td>Lounge (Sofa, Sitzsäcke)</td><td>${st.lounge}</td></tr>`;
    for (const z of app.doc.objects.filter((o) => T[o.type].kind === 'zone')) h += `<tr><td>Zone „${esc(z.label || 'Zone')}“</td><td>${LLR.zoneArea(z)}</td></tr>`;
    h += `</table>`;
    h += `<table><tr><th colspan="2">Prüfungen</th></tr><tr><td>Überschneidungen</td><td>${app.problems.size ? app.problems.size + ' Objekt(e)' : 'keine'}</td></tr>`;
    const a = app.overlay.access ? app.access : A.access(app.doc, { image: false });
    if (a) {
      h += `<tr><td>Tür mit Rollstuhl erreichbar</td><td>${a.doorOk ? 'ja' : 'nein'}</td></tr>
        <tr><td>Befahrbare Fläche</td><td>${num(a.sweptArea)} m²</td></tr>
        <tr><td>Wenden (Ø ${app.doc.settings.turning} cm)</td><td>${a.turnPossible ? 'möglich' : 'nicht möglich'}</td></tr>
        <tr><td>Tische mit Rollstuhlplatz (Weg von der Tür geprüft)</td><td>${a.tablesNow} sofort${a.tablesLater ? `, ${a.tablesLater} nach Wegstellen ${a.laterMove > 1 ? 'von 1–2 Stühlen' : 'eines Stuhls'}` : ''}</td></tr>`;
    }
    const sg = app.getSight();
    if (sg.seats.length && sg.surfaces.length) h += `<tr><td>Sicht auf Tafel & Bildschirme</td><td>${sg.good} direkt, ${sg.limited} eingeschränkt, ${sg.back} ohne Blick</td></tr>`;
    h += `</table></div><div class="foot">Erstellt mit dem LLR-Raumplaner 2D. Rollstuhl-Check: vereinfachtes Modell (Durchgang ${app.doc.settings.passage} cm, Wendekreis ${app.doc.settings.turning} cm) – ersetzt keine Prüfung vor Ort.</div>`;
    $('#print-sheet').innerHTML = h;
  }

  function printPlan() {
    buildPrintSheet();
    setTimeout(() => window.print(), 50);
  }
  window.addEventListener('beforeprint', buildPrintSheet);

  /* ---------- Hilfe ---------- */
  function openHelp() {
    openDialog({
      title: 'Hilfe zum LLR-Raumplaner',
      wide: true,
      body: `<h3>Grundbedienung</h3>
        <ul>
          <li><strong>Möbel hinzufügen:</strong> links unter „Möbel“ antippen (oder am Computer in den Plan ziehen). Die Zahlen zeigen, wie viele davon im LLR vorhanden sind.</li>
          <li><strong>Verschieben:</strong> Objekt antippen und ziehen. <strong>Drehen:</strong> am blauen Kreis über der Auswahl ziehen (rastet in ${app.doc.settings.angleSnap}°-Schritten ein, Umschalt = frei) oder Knöpfe −15°/+15°.</li>
          <li><strong>Größe ändern:</strong> bei Rechtecktischen, Teppichen, Zonen, Schränken usw. an den kleinen Quadraten ziehen (Umschalt an einer Ecke = Seitenverhältnis behalten, Alt = zentimetergenau).</li>
          <li><strong>Raumgröße:</strong> wenn nichts ausgewählt ist, an einer Wand oder an den blauen Griffen ziehen – oder die Maße rechts eintippen. Möbel an der Wand wandern mit.</li>
          <li><strong>Tische kombinieren:</strong> Dreiecks- und Rechtecktische rasten magnetisch an die Kanten anderer Tische an. Angestellte Stühle wandern beim Verschieben und Drehen eines Tisches mit. <strong>Doppelklick bzw. Doppeltipp</strong> auf einen Tisch wählt die ganze Tischgruppe samt Stühlen aus.</li>
          <li><strong>Einrasten:</strong> über das Magnet-Symbol lassen sich das magnetische Einrasten, das Mitnehmen der Stühle und das Einrasten am Raster (mit Rastergröße) schnell an- und ausschalten. Das Mitnehmen der Stühle gibt es auch als Knopf in der Leiste unten, sobald ein Tisch ausgewählt ist.</li>
          <li><strong>Stühle:</strong> drehen sich automatisch zum nächsten Tisch, wenn man sie an eine Tischkante zieht.</li>
          <li><strong>Trennwände:</strong> rasten an den Enden aneinander ein – gerade, im 45°/90°-Winkel oder als T. So lässt sich eine längere Wand zusammenbauen; Doppelklick wählt die ganze Wand.</li>
          <li><strong>Zonen:</strong> unter „Möbel → Zonen“ Bereiche wie Ruhezone oder Gruppenarbeit einzeichnen. Eine Zone wird am Rand oder am Namensschild angefasst, die Fläche darin bleibt frei bedienbar.</li>
          <li><strong>Ansicht:</strong> leere Fläche ziehen = verschieben, Mausrad oder zwei Finger = zoomen.</li>
          <li><strong>Mehrere Objekte:</strong> „Mehrfach“ aktivieren und antippen bzw. Rahmen aufziehen – am Computer mit gedrückter Umschalttaste. Tippen ins Leere hebt die Auswahl auf, <span class="kbd">Esc</span> zweimal beendet die Mehrfachauswahl.</li>
          <li><strong>Anordnungen:</strong> alle Sitzordnungen aus der Handreichung lassen sich mit einem Klick übernehmen und danach frei anpassen.</li>
          <li><strong>Mehr Platz:</strong> Die Seitenleisten lassen sich über die Symbole ganz links und ganz rechts in der oberen Leiste ein- und ausblenden. Auf dem Smartphone öffnen „Details“ und „Prüfen“ ein Blatt von unten, das sich nach unten wegwischen lässt.</li>
        </ul>
        <h3>Barrierefreiheit prüfen</h3>
        <ul>
          <li><strong>Prüfen & Zählen:</strong> Rollstuhl-Check und Sicht sind aufklappbare Abschnitte. Aufgeklappt zeigen sie die Ergebnisse, der Schalter „Im Plan“ blendet die Darstellung im Plan ein und aus.</li>
          <li><strong>Rollstuhl-Check:</strong> färbt alle Flächen, die ein Rollstuhl von der Tür aus erreicht (hellgrün, Durchgang ≥ ${app.doc.settings.passage} cm). Dunkelgrün: hier kann gewendet werden (Ø ${app.doc.settings.turning} cm). Rot: frei, aber nur über zu enge Stellen erreichbar. Blaue Plaketten zeigen Tischkanten mit Rollstuhlplatz, gestrichelte erst nach Wegstellen eines Stuhls.</li>
          <li><strong>Wegprüfung:</strong> Für jeden Rollstuhlplatz wird geprüft, ob von der Tür ein ausreichend breiter Weg hinführt – bei „Stuhl wegstellen“ mit allen übrigen Stühlen an ihrem Platz. Ein angetippter Tisch zeigt den Weg im Plan (blau) bzw. den Weg und den wegzustellenden Stuhl (orange).</li>
          <li><strong>Test-Rollstuhl:</strong> im Abschnitt Rollstuhl-Check „Test-Rollstuhl hinzufügen“ – ein Rollstuhl (70 × 120 cm) mit Wendekreis. Er färbt sich rot, sobald er aneckt; eine grüne Linie zeigt den Weg von der Tür, sonst steht „Kein Weg von der Tür“ daneben. Entfernen lässt er sich dort oder wie jedes Objekt mit dem Papierkorb.</li>
          <li><strong>Sicht:</strong> zeigt für jeden Sitzplatz, ob Tafel oder Bildschirm direkt im Blick sind (Haken), nur mit seitlich gedrehtem Kopf (!), ob jemand im Blickfeld sitzt (Person) oder ob es keinen Blick gibt (Kreuz). Personen in der Sichtachse verdecken je nach Abstand den unteren Teil der Fläche. Wer einen Sitzplatz antippt, sieht seinen <strong>Sichtkegel</strong>: das angenehme Blickfeld, sichtbare, verdeckte (rot) und durch Personen eingeschränkte Teile (orange) jeder Präsentationsfläche.</li>
          <li><strong>Ansicht im Plan:</strong> „Abstände“ zeigt beim ausgewählten Objekt die Abstände zu den Nachbarn (grün ≥ ${app.doc.settings.passage} cm, orange ≥ 70 cm, rot darunter). „Raummaße“ blendet die Maße am Raumrand ein und aus, „Raster“ das Raster.</li>
          <li><strong>Messen:</strong> Werkzeug „Messen“ wählen und eine Linie ziehen – die Enden rasten an Kanten ein.</li>
        </ul>
        <h3>Speichern & Weitergeben</h3>
        <ul>
          <li>Der Plan wird automatisch im Browser gesichert. Unter „Pläne“ lassen sich mehrere Varianten speichern oder als Datei herunterladen.</li>
          <li>„Teilen“ erzeugt einen Link, der den kompletten Plan enthält. „Bild“ speichert ein PNG, „Drucken“ erstellt eine A4-Seite (auch als PDF).</li>
          <li>Raummaße, Tisch- und Stuhlmaße sowie die Prüfwerte lassen sich unter „Raum & Einstellungen“ (Schieberegler-Symbol) anpassen.</li>
        </ul>
        <h3>Tastatur</h3>
        <p><span class="kbd">Pfeiltasten</span> verschieben (mit <span class="kbd">Umschalt</span> 10 cm) · <span class="kbd">R</span> drehen · <span class="kbd">Entf</span> löschen · <span class="kbd">Strg</span>+<span class="kbd">D</span> duplizieren · <span class="kbd">Strg</span>+<span class="kbd">Z</span>/<span class="kbd">Y</span> rückgängig/wiederholen · <span class="kbd">L</span> sperren · <span class="kbd">M</span> messen · <span class="kbd">+</span>/<span class="kbd">−</span>/<span class="kbd">0</span> Zoom · <span class="kbd">Esc</span> Auswahl aufheben</p>`,
      buttons: [{ label: 'Los geht’s', value: 'ok', cls: 'primary' }],
    });
  }

  /* ---------- Auswahl-Leiste ---------- */
  function renderSelBar() {
    if (!app.doc) return;
    const bar = $('#sel-bar');
    const objs = app.selectedObjects();
    bar.hidden = !objs.length;
    $('#stage').classList.toggle('has-sel', objs.length > 0);
    if (!objs.length) return;
    const allLocked = objs.every((o) => o.locked);
    const noRot = objs.every((o) => o.locked || T[o.type].wall);
    bar.querySelector('[data-act="lock"] use').setAttribute('href', allLocked ? '#i-unlock' : '#i-lock');
    bar.querySelector('[data-act="rotl"]').disabled = noRot;
    bar.querySelector('[data-act="rotr"]').disabled = noRot;
    bar.querySelector('[data-act="del"]').disabled = allLocked;
    bar.querySelector('[data-act="details"]').hidden = !(mobile() || !panels.right);
    const carry = bar.querySelector('[data-act="carry"]');
    carry.hidden = !objs.some((o) => A.isTable(o) && !o.locked);
    carry.setAttribute('aria-pressed', String(!!app.doc.settings.carryChairs));
  }

  function syncHistory() {
    $('#btn-undo').disabled = !app.undoStack.length;
    $('#btn-redo').disabled = !app.redoStack.length;
  }

  /* ---------- Start ---------- */
  async function init() {
    applySides();
    app.need.access = !!panels.access;
    app.mount($('#plan'));
    bindAll();
    let doc = null;
    let shared = false;
    if (location.hash.startsWith('#p=')) {
      try {
        doc = await unpackDoc(location.hash.slice(3));
        shared = true;
      } catch (e) {
        toast('Der geteilte Link ist ungültig oder unvollständig.');
      }
    }
    const saved = app.loadAutosave();
    if (shared && saved) {
      const list = loadPlans();
      list.push({ id: LLR.newId(), name: 'Sicherung: ' + (saved.name || 'Raumplan'), date: Date.now(), doc: saved });
      storePlans(list.slice(-30));
    }
    if (!doc) doc = saved;
    try {
      app.setDoc(doc || app.createDoc('seminar1'));
    } catch (e) {
      app.setDoc(app.createDoc('seminar1'));
    }
    if (shared) {
      history.replaceState(null, '', location.pathname + location.search);
      toast(`Geteilter Plan „${app.doc.name}“ geladen${saved ? ' – Ihr vorheriger Plan liegt unter „Pläne“' : ''}`);
    }
    renderCatalog();
    renderPresets();
    renderProps();
    renderChecks();
    renderLegend();
    syncTools();
    syncHistory();
    $('#plan-name').value = app.doc.name;

    app.on('change', () => {
      updateBadges();
      renderProps();
      renderChecks();
      renderObjects();
      renderSelBar();
      syncHistory();
      if (document.activeElement !== $('#plan-name')) $('#plan-name').value = app.doc.name;
    });
    app.on('live', () => {
      liveProps();
    });
    app.on('select', () => {
      renderProps();
      renderObjects();
      renderSelBar();
      if (app.overlay.sight) renderLegend();
    });
    app.on('history', syncHistory);
    app.on('prefs', () => {
      syncSnapPop();
      renderSelBar();
      renderChecks();
      renderProps();
      renderLegend();
    });
    app.on('analysis', () => {
      renderChecks();
      const o = app.selectedObjects();
      if (o.length === 1 && (A.isTable(o[0]) || o[0].type === 'wheelchair')) renderProps();
    });
    app.on('overlay', () => {
      renderProps();
      renderChecks();
      renderLegend();
      syncTools();
    });
    app.on('mode', syncTools);
    app.on('measure', syncTools);
    app.on('edit', () => {
      if (mobile()) openRight('props');
      else {
        if (!panels.right) toggleSide('right', true);
        const i = $('#props input[data-k="label"], #props input[data-k="text"]');
        if (i) i.focus();
      }
    });

    try {
      if (!localStorage.getItem(KEY_SEEN)) {
        localStorage.setItem(KEY_SEEN, '1');
        if (!shared) openHelp();
      }
    } catch (e) {
      /* ohne Speicher keine Hilfe beim Start */
    }
  }

  function bindAll() {
    bindCatalog();
    bindPresets();
    bindObjects();
    bindProps();
    bindChecks();
    bindLegend();
    bindTools();
    bindSnapPop();
    bindTabs();
    bindDrawers();
    bindFile();
  }

  LLR.ui = { toast, openDialog, confirmDlg, exportPNG, printPlan, openShare, packDoc, unpackDoc, buildExportSVG };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})((window.LLR = window.LLR || {}));

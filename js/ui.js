/* Bedienoberfläche: Bibliothek, Details & Prüfen, Werkzeuge, Dialoge,
   Speichern/Teilen/Export. Lernende und Phasen: js/ui-class.js */
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
  const KEY_SEEN = 'llr2d.seen.v2';
  const KEY_PANELS = 'llr2d.panels.v2';
  const mobile = () => window.matchMedia('(max-width: 900px)').matches;
  const phone = () => window.matchMedia('(max-width: 600px)').matches;
  const icon = (id) => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
  const num = (v, d) => Number(v).toLocaleString('de-DE', { maximumFractionDigits: d === undefined ? 1 : d });
  const m1 = (cm) => num(cm / 100, 1) + ' m';
  const ZONE_NAMES = ['Präsentation', 'Gruppenarbeit', 'Einzelarbeit', 'Ruhezone', 'Rückzug', 'Lounge', 'Lehrkraft', 'Material', 'Bewegung', 'Garderobe'];
  const GRID_SIZES = [10, 20, 25, 50, 100];
  const TABS = { catalog: 'Möbel', presets: 'Anordnungen', learners: 'Lernende & Sitzplan', phases: 'Unterrichtsphasen', objects: 'Im Raum' };

  /* Zustand der Oberfläche (im Browser gemerkt) */
  const panels = (() => {
    const def = { left: true, right: true, tab: 'catalog', view: 'props', cats: {}, legend: !phone(), pos: false };
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
      for (const attr of ['data-lens-toggle', 'data-ov', 'data-pref', 'data-act', 'data-legend', 'data-cat']) {
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

  /* Kleine Marken wie im Plan */
  const glyph = (cat) => `<svg class="sg" viewBox="-8.5 -8.5 17 17" aria-hidden="true">${LLR.sightGlyph(cat)}</svg>`;
  const sglyph = (lv, sym) => `<svg class="sg" viewBox="-8.5 -8.5 17 17" aria-hidden="true">${LLR.statusGlyph(lv, sym)}</svg>`;
  const tglyph = (cat) => sglyph(...LLR.TEACHER_GLYPH[cat]);
  const cglyph = (cat) => sglyph(...LLR.CALM_GLYPH[cat]);
  const dot = (lv) => `<span class="dot l${lv}" aria-hidden="true"></span>`;
  const row = (cls, ic, txt, small) => `<div class="check-row ${cls}">${icon(ic)}<span class="txt">${txt}${small ? `<small>${small}</small>` : ''}</span></div>`;

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3400);
  }
  app.on('toast', toast);

  /* ---------- Vorschaubilder ---------- */
  function thumb(o, cls) {
    const d = T[o.type];
    const S = app.doc ? app.doc.settings : LLR.DEFAULT_SETTINGS;
    const b = G.bbox(d.bounds ? d.bounds(o, S) : [].concat(...d.parts(o, S)));
    const pad = Math.max(b.w, b.h) * 0.08 + 3;
    const sh = d.shadow ? `<g transform="translate(${app.SHADOW_OFF.x} ${app.SHADOW_OFF.y})">${app.shadowMarkup(o).replace(/<g class="shadow"[^>]*>|<\/g>$/g, '')}</g>` : '';
    return `<svg class="${cls || 'thumb'}" viewBox="${b.minX - pad} ${b.minY - pad} ${b.w + 2 * pad} ${b.h + 2 * pad}" aria-hidden="true">${sh}${d.draw(o, S)}</svg>`;
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

  /* Kleine Vorschau einer Anordnung (Anordnungen, Phasen) */
  function planPreview(objs, opts) {
    opts = opts || {};
    const S = app.doc ? app.doc.settings : LLR.DEFAULT_SETTINGS;
    const list = opts.only ? objs.filter(opts.only) : objs;
    const pts = [];
    for (const o of list) pts.push(...[].concat(...T[o.type].parts(o, S)).map((q) => G.add(G.rot(q, o.rot || 0), o)));
    let b = pts.length ? G.bbox(pts) : { minX: 0, minY: 0, maxX: 100, maxY: 100, w: 100, h: 100 };
    if (opts.room) b = { minX: 0, minY: 0, maxX: opts.room.w, maxY: opts.room.l, w: opts.room.w, h: opts.room.l };
    const pad = opts.room ? 10 : 12;
    const side = Math.max(b.w, b.h) + 2 * pad;
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    let inner = opts.room ? `<rect x="0" y="0" width="${opts.room.w}" height="${opts.room.l}" fill="#FBF8F2" stroke="#5B6168" stroke-width="10"/>` : '';
    for (const o of list) {
      const d = T[o.type];
      if (d.kind === 'zone' || d.kind === 'label') continue;
      inner += `<g transform="translate(${o.x.toFixed(1)} ${o.y.toFixed(1)}) rotate(${(o.rot || 0).toFixed(1)})">${d.draw(o, S)}</g>`;
    }
    return `<svg class="pv" viewBox="${cx - side / 2} ${cy - side / 2} ${side} ${side}" aria-hidden="true">${inner}</svg>`;
  }

  /* ---------- Katalog ---------- */
  function renderCatalog() {
    const box = $('#tab-catalog');
    let h = `<label class="search">${icon('i-search')}<span class="visually-hidden">Möbel suchen</span><input type="search" id="cat-search" placeholder="Möbel suchen …" autocomplete="off"></label><div id="cat-list">`;
    for (const c of LLR.CATEGORIES) {
      const types = Object.keys(T).filter((k) => T[k].cat === c.id);
      if (!types.length) continue;
      const open = panels.cats[c.id] !== false;
      h += `<section class="cat" data-catsec="${c.id}"><button class="cat-head" data-cat="${c.id}" aria-expanded="${open}">${icon('i-chevron')}${esc(c.name)}<span class="n">${types.length}</span></button><div class="cat-grid"${open ? '' : ' hidden'}>`;
      for (const k of types) {
        const d = T[k];
        h += `<button class="cat-item" data-type="${k}" data-search="${esc((d.name + ' ' + (d.label || '') + ' ' + (d.desc || '')).replace(/\u00AD/g, '').toLowerCase())}" draggable="true" title="${esc(d.name + ' – ' + (d.desc || ''))}">${thumb(sample(k))}<span class="name">${esc(d.label || d.name)}</span><span class="badge" data-badge="${k}"></span></button>`;
      }
      h += `</div></section>`;
    }
    h += `</div><p class="empty-note" id="cat-empty" hidden>Nichts gefunden.</p><p class="cat-note">Antippen fügt das Objekt in der Bildmitte ein, am Computer auch per Ziehen. Zahlen: im Plan / im LLR vorhanden.</p>`;
    box.innerHTML = h;
    updateBadges();
  }

  function filterCatalog(q) {
    q = q.trim().toLowerCase();
    let any = false;
    for (const sec of $$('#cat-list .cat')) {
      let n = 0;
      for (const it of $$('.cat-item', sec)) {
        const hit = !q || it.getAttribute('data-search').includes(q);
        it.hidden = !hit;
        if (hit) n++;
      }
      sec.hidden = !n;
      const grid = $('.cat-grid', sec);
      const open = q ? true : panels.cats[sec.getAttribute('data-catsec')] !== false;
      grid.hidden = !open;
      $('.cat-head', sec).setAttribute('aria-expanded', String(open));
      if (n) any = true;
    }
    $('#cat-empty').hidden = any;
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
        b.hidden = false;
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
      const head = e.target.closest('[data-cat]');
      if (head) {
        const id = head.getAttribute('data-cat');
        panels.cats[id] = head.getAttribute('aria-expanded') !== 'true';
        savePanels();
        head.setAttribute('aria-expanded', String(panels.cats[id]));
        head.nextElementSibling.hidden = !panels.cats[id];
        return;
      }
      const it = e.target.closest('.cat-item');
      if (!it) return;
      const type = it.getAttribute('data-type');
      const d = T[type];
      const n = app.stats().count[type] || 0;
      app.addObject(type);
      if (d.inv && n + 1 > d.inv) toast(`Hinweis: Im LLR gibt es nur ${d.inv} × „${d.short}“. Zusätzliche müssen aus anderen Räumen kommen.`);
      if (type === 'teacher' && !app.overlay.teacher) setLens('teacher');
      if (mobile()) closeDrawers();
    });
    box.addEventListener('input', (e) => {
      if (e.target.id === 'cat-search') filterCatalog(e.target.value);
    });
    box.addEventListener('dragstart', (e) => {
      const it = e.target.closest('.cat-item');
      if (!it) return;
      e.dataTransfer.setData('text/llr-type', it.getAttribute('data-type'));
      e.dataTransfer.effectAllowed = 'copy';
    });
    const svg = $('#plan');
    svg.addEventListener('dragover', (e) => {
      if (e.dataTransfer.types.includes('text/llr-type') || e.dataTransfer.types.includes('text/llr-learner')) {
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
  function renderPresets() {
    let h = `<p class="intro">Sitzordnungen aus der <em>Handreichung zur Anordnung der Tische</em>. Beim Übernehmen werden Tische, Stühle und Hocker neu gestellt – alles andere bleibt.</p>`;
    for (const p of LLR.PRESETS) {
      const objs = LLR.colorChairs(p.build(LLR.DEFAULT_SETTINGS, LLR.DEFAULT_ROOM));
      h += `<button class="preset" data-preset="${p.id}">${planPreview(objs)}<span><h3>${esc(p.name)}</h3><span class="persons">${esc(p.persons)}</span><p>${esc(p.note)}</p></span></button>`;
    }
    $('#tab-presets').innerHTML = h;
  }

  function bindPresets() {
    $('#tab-presets').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-preset]');
      if (!b) return;
      const p = LLR.PRESETS.find((x) => x.id === b.getAttribute('data-preset'));
      const phases = !!app.doc.phases;
      const v = await openDialog({
        title: p.name,
        body: `<p><strong>${esc(p.name)}</strong> · ${esc(p.persons)} · Handreichung S. ${p.page}</p><p class="desc">${esc(p.note)}</p>
          <label class="toggle"><input type="radio" name="pmode" value="replace" checked><span>${phases ? 'In der aktuellen Phase übernehmen' : 'Übernehmen'}<small>Tische, Stühle und Hocker werden ersetzt${p.shelves ? ', die halbrunden Regale umgestellt' : ''}.</small></span></label>
          <label class="toggle"><input type="radio" name="pmode" value="phase"><span>Als neue Unterrichtsphase anlegen<small>Die jetzige Anordnung bleibt als eigene Phase erhalten – mit Umbauplan und Übergang.</small></span></label>
          <p class="desc">Rückgängig jederzeit mit <span class="kbd">Strg</span>+<span class="kbd">Z</span>.</p>`,
        buttons: [
          { label: 'Abbrechen', value: 'cancel' },
          { label: 'Übernehmen', value: 'ok', cls: 'primary' },
        ],
        onOpen: (body) => (body._mode = () => (body.querySelector('input[name=pmode]:checked') || {}).value),
      });
      if (v !== 'ok') return;
      const mode = $('#dlg-body')._mode();
      if (mode === 'phase') {
        app.addPhase(p.id);
        toast(`Neue Phase „${p.name}“ angelegt`);
      } else {
        app.applyPreset(p.id);
        toast(`„${p.name}“ übernommen`);
      }
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
        const person = o.learner ? app.learnerName(o.learner) : '';
        const name = o.type === 'label' ? `„${o.text || ''}“` : `${d.short} ${counter[o.type]}${person ? ' – ' + person : o.label ? ' – ' + o.label : ''}`;
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

  /* ---------- Details (rechts) ---------- */
  function renderProps() {
    const box = $('#props');
    if (box.contains(document.activeElement) && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    const objs = app.selectedObjects();
    if (!objs.length) box.innerHTML = roomProps();
    else if (objs.length > 1) box.innerHTML = multiProps(objs);
    else box.innerHTML = objectProps(objs[0]);
  }

  /* Nichts ausgewählt: Raum und Belegung */
  function roomProps() {
    const r = app.doc.room;
    const st = app.stats();
    const c = st.count;
    const inv = (n, max) => `<span class="pill ${n > max ? 'warn' : n === max ? 'ok' : ''}">${n} / ${max}</span>`;
    let h = `<h2 class="sec-title"><span>Raum<small>Nichts ausgewählt – ein Objekt antippen zeigt seine Details</small></span></h2>
      <div class="field-grid two">
        <label class="field">Breite – Tafelseite (m)<input type="number" data-room="w" value="${(r.w / 100).toFixed(2)}" min="2" max="30" step="0.05"></label>
        <label class="field">Länge (m)<input type="number" data-room="l" value="${(r.l / 100).toFixed(2)}" min="2" max="30" step="0.05"></label>
      </div>
      <p class="desc" style="margin-top:6px">Fläche <strong data-room-area>${app.fmtArea(r.w * r.l)}</strong> · auch im Plan an den Wänden ziehen</p>`;
    if (app.doc.phases) h += `<div class="sub-title">Phase</div><p class="desc">${app.phaseIndex() + 1} von ${app.doc.phases.length}: <strong>${esc(app.phases()[app.phaseIndex()].name)}</strong> · <button class="link-btn" data-act="openPhases">Phasen verwalten</button></p>`;
    h += `<div class="sub-title">Belegung</div><table class="stat-table">
      <tr><td>Arbeitsplätze</td><td><span class="pill ${st.seats > 24 ? 'warn' : 'ok'}">${st.seats}</span></td></tr>
      <tr><td>Dreieckstische</td><td>${inv(c.table || 0, 12)}</td></tr>
      ${c.tableRect ? `<tr><td>Rechtecktische</td><td>${c.tableRect}</td></tr>` : ''}
      <tr><td>Stühle</td><td>${inv(c.chair || 0, 19)}</td></tr>
      <tr><td>Hocker</td><td>${inv(c.stool || 0, 2)}</td></tr>
      ${st.wheelchairs ? `<tr><td>Rollstuhlplätze (Test)</td><td>${st.wheelchairs}</td></tr>` : ''}
      <tr><td>Lounge (Sofa, Sitzsäcke)</td><td>${st.lounge}</td></tr>`;
    const learners = app.learners();
    if (learners.length) {
      const placed = learners.filter((l) => app.seatOf(l.id)).length;
      h += `<tr><td>Lernende mit Platz</td><td><span class="pill ${placed === learners.length ? 'ok' : 'info'}">${placed} / ${learners.length}</span></td></tr>`;
    }
    h += `</table>`;
    if (st.seats > 24) h += row('warn', 'i-alert', 'Mehr als 24 Arbeitsplätze', 'Die Handreichung empfiehlt höchstens 24 Sitzplätze.');
    if ((c.chair || 0) > 19) h += row('warn', 'i-info', `${c.chair - 19} Stuhl/Stühle mehr als im LLR vorhanden`, 'Zusätzliche Stühle aus anderen Räumen holen.');
    const zones = app.doc.objects.filter((o) => T[o.type].kind === 'zone');
    if (zones.length) {
      h += `<div class="sub-title">Zonen</div><table class="stat-table">`;
      for (const z of zones) {
        const col = (T[z.type].colors[z.color] || T[z.type].colors[T[z.type].defaultColor]).fill;
        h += `<tr><td><span class="zone-dot" style="background:${col}"></span>${esc(z.label || 'Zone')}</td><td>${LLR.zoneArea(z)}</td></tr>`;
      }
      h += `</table>`;
    }
    h += `<div class="btn-row"><button class="btn outline small" data-act="settings">${icon('i-sliders')}Raum &amp; Einstellungen</button></div>`;
    h += `<p class="tip">${icon('i-info')}<span>Doppelklick auf einen Tisch wählt die ganze Gruppe samt Stühlen. Alles zur Bedienung unter <button class="link-btn" data-act="help">Hilfe</button>.</span></p>`;
    return h;
  }

  function multiProps(objs) {
    const counts = {};
    for (const o of objs) counts[T[o.type].short] = (counts[T[o.type].short] || 0) + 1;
    const locked = objs.filter((o) => o.locked).length;
    return `<h2 class="sec-title"><span>${objs.length} Objekte ausgewählt<small>${Object.entries(counts).map(([k, v]) => `${v} × ${esc(k)}`).join(', ')}${locked ? ` · ${locked} gesperrt` : ''}</small></span></h2>
      <p class="desc">Drehen, Duplizieren, Sperren und Löschen über die Leiste unten im Plan.</p>
      <div class="btn-row"><button class="btn outline small" data-act="rot90">${icon('i-rot-cw')}90° drehen</button><button class="btn outline small" data-act="none">Auswahl aufheben</button></div>`;
  }

  function objectProps(o) {
    const d = T[o.type];
    let h = `<h2 class="sec-title">${thumb(o)}<span>${esc(d.name)}<small>${esc(d.desc || '')}</small></span></h2>`;
    // Name / Beschriftung
    if (o.type === 'label') {
      h += `<div class="field-grid two"><label class="field">Text<input type="text" data-k="text" value="${esc(o.text || '')}" maxlength="60"></label>
        <label class="field">Schriftgröße (cm)<input type="number" data-k="size" value="${o.size || 22}" min="6" max="120" step="1"></label></div>`;
    } else if (d.kind === 'zone') {
      h += `<label class="field">Name der Zone<input type="text" data-k="label" value="${esc(o.label || '')}" maxlength="40" placeholder="z. B. Ruhezone" list="zone-names"></label>
        <datalist id="zone-names">${ZONE_NAMES.map((n) => `<option value="${esc(n)}"></option>`).join('')}</datalist>
        <p class="desc" style="margin-top:6px">Fläche: <strong data-zone-area>${LLR.zoneArea(o)}</strong></p>`;
    } else if (A.isSeat(o) && LLR.classUI) {
      h += LLR.classUI.seatField(o);
      h += `<label class="field">Beschriftung (optional)<input type="text" data-k="label" value="${esc(o.label || '')}" maxlength="40" placeholder="z. B. Platz 1"></label>`;
    } else {
      h += `<label class="field">Beschriftung (optional)<input type="text" data-k="label" value="${esc(o.label || '')}" maxlength="40" placeholder="z. B. Gruppe A"></label>`;
    }
    // Größe
    if (d.resizable) {
      const ms = d.minSize || { w: 5, d: 5 };
      h += `<div class="sub-title">Größe</div>`;
      if (d.round) h += `<div class="field-grid"><label class="field">Durchmesser (cm)<input type="number" data-k="diam" value="${Math.round(o.w)}" min="${ms.w}" max="1000" step="5" ${o.locked ? 'disabled' : ''}></label></div>`;
      else {
        h += `<div class="field-grid two"><label class="field">Breite (cm)<input type="number" data-k="w" value="${Math.round(o.w)}" min="${ms.w}" max="2000" step="5" ${o.locked ? 'disabled' : ''}></label>`;
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
    if (A.isTable(o)) h += `<div class="btn-row"><button class="btn outline small block" data-act="group">${icon('i-multi')}Ganze Tischgruppe mit Stühlen auswählen</button></div>`;
    if (o.type === 'partition') h += `<div class="btn-row"><button class="btn outline small block" data-act="group">${icon('i-multi')}Alle verbundenen Trennwände auswählen</button></div>`;
    // Prüfungen für dieses Objekt
    const checks = objectChecks(o);
    if (checks) h += `<div class="sub-title">Prüfen</div><div class="mini-checks">${checks}</div>`;
    const why = app.problems.get(o.id);
    if (why) h += row('bad', 'i-alert', `${why.has('out') ? 'Ragt aus dem Raum heraus. ' : ''}${why.has('overlap') ? 'Überschneidet sich mit einem anderen Objekt.' : ''}`);
    // Position (selten gebraucht, daher eingeklappt)
    h += `<details class="more" data-pos ${panels.pos ? 'open' : ''}><summary>Position &amp; Drehung</summary><div class="field-grid">
      <label class="field">X (cm)<input type="number" data-k="x" value="${Math.round(o.x)}" step="1" ${o.locked ? 'disabled' : ''}></label>
      <label class="field">Y (cm)<input type="number" data-k="y" value="${Math.round(o.y)}" step="1" ${o.locked ? 'disabled' : ''}></label>
      <label class="field">Drehung (°)<input type="number" data-k="rot" value="${Math.round(o.rot || 0)}" step="15" ${o.locked || d.wall ? 'disabled' : ''}></label></div>
      <label class="toggle"><input type="checkbox" data-opt="locked" ${o.locked ? 'checked' : ''}><span>Gesperrt<small>gegen versehentliches Verschieben</small></span></label></details>`;
    return h;
  }

  /* Kurz-Prüfungen am ausgewählten Objekt; ein Klick zeigt die Prüfung im Plan */
  function mini(lens, gl, title, txt, small) {
    return `<button class="mini-row${app.overlay[lens] ? ' on' : ''}" data-mini="${lens}" title="${app.overlay[lens] ? 'Im Plan aktiv' : 'Im Plan zeigen'}">${gl}<span class="txt"><b>${title}</b>${txt}${small ? `<small>${small}</small>` : ''}</span></button>`;
  }

  function objectChecks(o) {
    let h = '';
    if (A.isTable(o) || o.type === 'wheelchair') h += accessMini(o);
    if (!A.isSeat(o)) return h;
    // Sicht
    const cone = A.sightCone(app.doc, o.id);
    if (cone && cone.views.length) {
      const sum = { good: 'Direkter Blick', side: 'Kopf seitlich drehen', person: 'Person im Blickfeld', back: 'Kein Blick: abgewandt', none: 'Kein Blick: verdeckt' }[cone.cat];
      const b = cone.best;
      h += mini('sight', glyph(cone.cat), 'Sicht auf Tafel & Bildschirme', sum, b ? `beste Sicht: ${esc(b.s.name)}, ${m1(b.dist)}${cone.free ? '' : `, ${Math.round(b.ang)}°`}` : '');
    } else h += mini('sight', glyph('none'), 'Sicht auf Tafel & Bildschirme', 'Keine Präsentationsfläche vor diesem Platz');
    // Lehrkraft
    const t = app.getTeacher();
    const ts = t.seats.find((x) => x.id === o.id);
    if (ts) {
      const eye = { face: 'sieht das Gesicht', profile: 'sieht das Profil', back: 'sieht nur den Rücken', blocked: 'Sicht verdeckt' }[ts.eye.kind];
      let walk = 'nicht erreichbar';
      if (ts.reach) walk = `Weg ${m1(ts.walk)}${ts.reach.squeeze ? ' durch eine Engstelle' : ''}${ts.reach.across ? ', nur über den Tisch' : ''}`;
      h += mini('teacher', tglyph(ts.cat), 'Lehrkraft', `${walk}`, `Lehrkraft ${eye}`);
    }
    // Ruhe
    const c = app.getCalm();
    const cs = c.seats.find((x) => x.id === o.id);
    if (cs) {
      const label = { calm: 'Ruhiger Platz', mid: 'Mittlere Unruhe', busy: 'Unruhiger Platz' }[cs.cat];
      const top = cs.factors.filter((x) => x.pts > 0).slice(0, 3).map((x) => x.label + (x.detail ? ` (${x.detail})` : '')).join(' · ');
      const quiet = cs.factors.find((x) => x.key === 'quiet');
      h += mini('calm', cglyph(cs.cat), 'Ruhe & Reize', `${label} · ${cs.score} von 100`, (top || 'keine Störquellen in der Nähe') + (quiet ? ' · in einer Ruhezone' : ''));
    }
    // Bedarfe der Person auf dem Platz
    if (o.learner && LLR.classUI) h += LLR.classUI.seatChecks(o);
    return h;
  }

  function accessMini(o) {
    const a = app.access;
    if (!a) return mini('access', sglyph(1, 'bang'), 'Rollstuhl', 'Antippen, um den Weg von der Tür zu prüfen');
    if (!a.hasDoor) return mini('access', sglyph(2, 'x'), 'Rollstuhl', 'Keine Tür im Plan', 'Die Tür ist der Startpunkt der Wegprüfung.');
    if (o.type === 'wheelchair') {
      const w = a.wheelchairs.find((x) => x.id === o.id);
      return w && w.ok ? mini('access', sglyph(0, 'check'), 'Rollstuhl', 'Von der Tür aus erreichbar', `Weg mit mindestens ${app.doc.settings.passage} cm Durchgang (grüne Linie).`) : mini('access', sglyph(2, 'x'), 'Rollstuhl', 'Kein Weg von der Tür', `Unterwegs ist es enger als ${app.doc.settings.passage} cm.`);
    }
    const t = a.tables.find((x) => x.id === o.id);
    if (!t) return '';
    if (t.now) return mini('access', sglyph(0, 'check'), 'Rollstuhl', 'Rollstuhlplatz von der Tür aus erreichbar', 'Blaue Linie im Plan: Weg von der Tür zum Platz.');
    if (t.later) return mini('access', sglyph(1, 'bang'), 'Rollstuhl', `Erst nach Wegstellen ${t.moveMin > 1 ? 'von 2 Stühlen' : 'eines Stuhls'}`, 'Wegzustellende Stühle sind orange markiert.');
    if (!a.complete) return mini('access', sglyph(1, 'bang'), 'Rollstuhl', 'Wird geprüft …');
    return mini('access', sglyph(2, 'x'), 'Rollstuhl', 'Kein Rollstuhlplatz erreichbar', `Kein Weg mit ${app.doc.settings.passage} cm Durchgang an diesen Tisch.`);
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
      if (t.hasAttribute('data-seat-learner')) {
        t.blur();
        app.assignLearner(o.id, t.value || null);
        return;
      }
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
        t.blur();
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
        if (!e.target.matches || !e.target.matches('[data-pos]')) return;
        panels.pos = e.target.open;
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
        return;
      }
      const m = e.target.closest('[data-mini]');
      if (m) {
        const k = m.getAttribute('data-mini');
        setLens(app.overlay[k] ? null : k, { keepView: true });
      }
    });
  }

  /* Aktionsknöpfe (Panel, Schnellleiste, Menüs) */
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
    } else if (act === 'carry') {
      const on = !app.doc.settings.carryChairs;
      app.setPref('carryChairs', on);
      toast(on ? 'Angestellte Stühle wandern jetzt mit dem Tisch mit.' : 'Stühle bleiben stehen, wenn ein Tisch bewegt wird.');
    } else if (act === 'settings') openSettings();
    else if (act === 'details') showDetails();
    else if (act === 'wheelchair') addWheelchair();
    else if (act === 'addTeacher') addTeacher();
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
    else if (act === 'print') printPlan('plan');
    else if (act === 'printRebuild') printPlan('rebuild');
    else if (act === 'printSeating') printPlan('seating');
    else if (act === 'share') openShare();
    else if (act === 'openPhases') openLibTab('phases');
    else if (act === 'openLearners') openLibTab('learners');
    else if (LLR.classUI && LLR.classUI.act) LLR.classUI.act(act);
  }

  function addWheelchair() {
    const door = app.doc.objects.find((o) => o.type === 'door');
    let at;
    if (door) {
      const inward = G.rot({ x: 0, y: -1 }, door.rot || 0);
      at = G.add(door, G.mul(inward, 110));
    }
    app.addObject('wheelchair', at, door ? { rot: G.rotFacing(G.rot({ x: 0, y: -1 }, door.rot || 0)) } : {});
    if (!app.overlay.access) setLens('access');
    toast('Test-Rollstuhl hinzugefügt – verschieben und drehen. Rot = eckt an, grüne Linie = Weg von der Tür.');
    if (mobile()) closeDrawers();
  }

  /* Lehrkraft-Position an der angenommenen Stelle einfügen */
  function addTeacher() {
    const t = app.getTeacher();
    const p = t.positions[0] || app.viewCenterInRoom();
    const s = A.surfaces(app.doc)[0];
    app.addObject('teacher', { x: p.x, y: p.y }, s ? { rot: G.rotFacing(s.n) } : {});
    toast('Lehrkraft-Position eingefügt – verschieben, um andere Standorte zu prüfen.');
  }

  /* ---------- Prüfansicht wählen ---------- */
  function setLens(key, opts) {
    app.setLens(key);
    if (key && !(opts && opts.keepView)) {
      panels.view = 'checks';
      savePanels();
      if (!app.sel.size) showRightView('checks');
    }
  }

  /* ---------- Prüfen (rechts) ---------- */
  function lensCard(key, ic, title, summary, level, body) {
    const on = !!app.overlay[key];
    return `<section class="lens-card${on ? ' on' : ''}" data-card="${key}">
      <button type="button" class="lens-head" data-lens-toggle="${key}" aria-expanded="${on}" title="${on ? 'Im Plan ausblenden' : 'Im Plan zeigen'}">
        <span class="lens-ic">${icon(ic)}</span><span class="lens-title">${title}<small>${summary}</small></span>${on ? '<span class="lens-state">im Plan</span>' : dot(level)}
      </button>
      ${on ? `<div class="lens-body">${body()}</div>` : ''}
    </section>`;
  }

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
      let txt = `Tische mit Rollstuhlplatz: ${now} sofort erreichbar`;
      if (!a.complete) txt += ', weitere werden geprüft …';
      else if (later) txt += `, ${later} weitere nach Wegstellen ${a.laterMove > 1 ? 'von 1–2 Stühlen' : 'eines Stuhls'}`;
      h += row(now ? 'ok' : later ? 'warn' : 'bad', now ? 'i-check' : 'i-alert', txt, 'Tisch antippen: Weg und ggf. wegzustellender Stuhl erscheinen im Plan.');
    }
    const chairs = app.doc.objects.filter((o) => o.type === 'wheelchair');
    h += `<div class="sub-block"><div class="sub-head">${icon('i-wheelchair')}Test-Rollstuhl</div>
      <p class="desc">Ein Rollstuhl (70 × 120 cm) mit Wendekreis zum Ausprobieren. Er wird rot, wenn er aneckt; die grüne Linie zeigt den Weg von der Tür.</p>`;
    if (chairs.length) {
      const ok = a.wheelchairs.filter((w) => w.ok).length;
      h += `<p class="desc"><strong>${chairs.length === 1 ? '1 Test-Rollstuhl' : chairs.length + ' Test-Rollstühle'}</strong> · ${ok === chairs.length ? 'alle' : ok} von der Tür erreichbar</p>
        <div class="btn-row"><button class="btn outline small" data-act="selWheel">Auswählen</button><button class="btn outline small text-danger" data-act="delWheel">${icon('i-trash')}Entfernen</button></div>`;
    }
    h += `<div class="btn-row"><button class="btn outline small block" data-act="wheelchair">${icon('i-plus')}Test-Rollstuhl hinzufügen</button></div></div>`;
    h += `<p class="callout">Vereinfachtes Modell in Anlehnung an DIN 18040-1 (Durchgang ≥ ${S.passage} cm, Bewegungsfläche Ø ${S.turning} cm). Ersetzt keine fachliche Prüfung vor Ort.</p>`;
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
    h += `<label class="toggle"><input type="checkbox" data-pref="sightPersons" ${s.persons ? 'checked' : ''}><span>Sitzende Personen im Blickfeld berücksichtigen<small>Ein Kopf (ca. ${2 * A.PERSON_R} cm breit) verdeckt je nach Abstand den unteren Teil der Fläche (Augenhöhe ${app.fmtM(H.eye)}, Fläche ${app.fmtM(H.low)}–${app.fmtM(H.top)}). Ab ${Math.round(A.PERSON_LIMIT * 100)} % gilt die Sicht als eingeschränkt.</small></span></label>`;
    h += `<p class="callout">Berücksichtigt: ${s.surfaces.map((x) => esc(x.name)).join(', ') || '–'}. Regale und Trennwände verdecken. <strong>Sitzplatz antippen</strong> zeigt den Sichtkegel. Die Handreichung empfiehlt, alle drei Flächen zu nutzen.</p>`;
    return h;
  }

  function teacherBody(t) {
    let h = `<table class="stat-table">
      <tr class="grp"><td colspan="2">Laufwege (Durchgang ≥ ${app.doc.settings.walk || 50} cm)</td></tr>
      <tr class="sub"><td>Plätze erreichbar</td><td>${t.reachable} / ${t.seats.length}</td></tr>
      ${t.tight ? `<tr class="sub"><td>davon nur durch Engstellen</td><td>${t.tight}</td></tr>` : ''}
      ${t.across ? `<tr class="sub"><td>davon nur über den Tisch</td><td>${t.across}</td></tr>` : ''}
      <tr class="sub"><td>Weg im Schnitt / längster</td><td>${m1(t.avgWalk)} / ${m1(t.maxWalk)}</td></tr>
      <tr class="grp"><td colspan="2">Blickkontakt: Die Lehrkraft sieht …</td></tr>
      <tr class="sub"><td>${tglyph('good')} das Gesicht</td><td>${t.face}</td></tr>
      <tr class="sub"><td>${tglyph('side')} nur das Profil</td><td>${t.profile}</td></tr>
      <tr class="sub"><td>${tglyph('back')} nur den Rücken</td><td>${t.back}</td></tr>
      ${t.hidden ? `<tr class="sub"><td>${tglyph('none')} nichts (verdeckt)</td><td>${t.hidden}</td></tr>` : ''}</table>`;
    if (t.implicit) h += `<div class="sub-block"><div class="sub-head">${icon('i-teacher')}Standort der Lehrkraft</div><p class="desc">Angenommen: vor der Tafel. Für andere Standorte (z. B. Raummitte, Lehrertisch, Doppelbesetzung) eine Lehrkraft-Position einfügen und verschieben.</p><div class="btn-row"><button class="btn outline small block" data-act="addTeacher">${icon('i-plus')}Lehrkraft-Position einfügen</button></div></div>`;
    else h += `<p class="desc" style="margin-top:8px">${t.positions.length === 1 ? '1 Lehrkraft-Position' : t.positions.length + ' Lehrkraft-Positionen'} im Plan – je Platz zählt die nächste.</p>`;
    if (t.stuck) h += row('bad', 'i-alert', 'Eine Lehrkraft-Position steht in einem Möbelstück', 'Etwas in den freien Raum schieben.');
    h += `<p class="callout">Erreichbar heißt: Die Lehrkraft kann neben dem Platz stehen, um zu helfen. Stühle zählen mit ihrer Sitzfläche (man kann sie etwas heranrücken). <strong>Sitzplatz antippen</strong> zeigt den Weg.</p>`;
    return h;
  }

  function calmBody(c) {
    let h = `<table class="stat-table">
      <tr><td>${cglyph('calm')} Ruhige Plätze</td><td>${c.calm}</td></tr>
      <tr><td>${cglyph('mid')} Mittlere Unruhe</td><td>${c.mid}</td></tr>
      <tr><td>${cglyph('busy')} Unruhige Plätze</td><td>${c.busy}</td></tr></table>`;
    if (c.glareSeats) h += row('warn', 'i-alert', `${c.glareSeats} Plätze sehen ein Fenster gespiegelt`, 'Auf Tafel oder Bildschirm kann sich das Fenster spiegeln – Lamellenvorhang schließen hilft.');
    if (!c.hasDoor) h += row('warn', 'i-info', 'Keine Tür im Plan', 'Ohne Tür fehlen Laufwege und Türnähe in der Bewertung.');
    h += `<p class="callout">Bewertet werden: Nähe zur Tür (bis 30 Punkte) und zur Lounge (20), Laufwege anderer am Platz vorbei (25), viele Nachbarplätze (15), Blick aus dem Fenster (10) und Spiegelungen (10). Regale und Trennwände dämpfen Tür und Lounge; Plätze in einer Zone „Ruhezone“ oder „Rückzug“ gelten als ruhiger. <strong>Sitzplatz antippen</strong> zeigt die Gründe.</p>`;
    return h;
  }

  function renderChecks() {
    const box = $('#checks');
    if (box.hidden && !mobile()) {
      updateChecksBadge();
      return;
    }
    const S = app.doc.settings;
    let h = `<p class="checks-intro">Eine Prüfung antippen zeigt sie im Plan – immer eine zur Zeit. Die Werkzeugleiste oben im Plan schaltet dieselben Ansichten.</p>`;
    // Rollstuhl
    const a = app.access;
    let accSum = `Durchgang ${S.passage} cm · Wenden Ø ${S.turning} cm`;
    let accLv = -1;
    if (a && !a.hasDoor) (accSum = 'Keine Tür im Plan'), (accLv = 2);
    else if (a && !a.doorOk) (accSum = 'Tür nicht befahrbar'), (accLv = 2);
    else if (a) {
      accSum = `${a.tablesNow} ${a.tablesNow === 1 ? 'Tisch' : 'Tische'} mit Rollstuhlplatz${a.complete && a.tablesLater ? ` (+${a.tablesLater} nach Stuhl wegstellen)` : ''}${a.turnPossible ? '' : ' · kein Wenden'}`;
      accLv = !a.turnPossible || (!a.tablesNow && !a.tablesLater) ? 2 : a.tablesNow ? 0 : 1;
    }
    h += lensCard('access', 'i-wheelchair', 'Rollstuhl-Check', accSum, accLv, accessBody);
    // Sicht
    const s = app.getSight();
    let sightSum = `${s.good} direkt · ${s.limited} eingeschränkt · ${s.back} ohne Blick`;
    let sightLv = s.back ? 2 : s.limited ? 1 : 0;
    if (!s.seats.length) (sightSum = 'Keine Sitzplätze im Plan'), (sightLv = -1);
    else if (!s.surfaces.length) (sightSum = 'Keine Präsentationsfläche im Plan'), (sightLv = 2);
    h += lensCard('sight', 'i-eye', 'Sicht auf Tafel & Bildschirme', sightSum, sightLv, () => sightBody(s));
    // Lehrkraft
    const t = app.getTeacher();
    const tLv = t.reachable < t.seats.length || t.hidden ? 2 : t.back || t.tight || t.across ? 1 : 0;
    h += lensCard('teacher', 'i-teacher', 'Lehrkraft: Wege & Blickkontakt', t.seats.length ? `${t.reachable}/${t.seats.length} erreichbar · ${t.face} Gesichter im Blick` : 'Keine Sitzplätze im Plan', t.seats.length ? tLv : -1, () => teacherBody(t));
    // Ruhe
    const c = app.getCalm();
    h += lensCard('calm', 'i-leaf', 'Ruhe & Reize', c.seats.length ? `${c.calm} ruhig · ${c.mid} mittel · ${c.busy} unruhig` : 'Keine Sitzplätze im Plan', c.seats.length ? (c.busy ? 2 : c.calm ? 0 : 1) : -1, () => calmBody(c));
    // Sitzplan & Umbau (js/ui-class.js)
    if (LLR.classUI) h += LLR.classUI.checkCards(lensCard);
    // Überschneidungen
    const probs = app.problems.size;
    if (probs) h += `<div class="check-row bad">${icon('i-alert')}<span class="txt">${probs} Objekt(e) überschneiden sich oder ragen aus dem Raum<br><button class="btn outline small" data-act="showProblems">Markieren</button></span></div>`;
    else h += `<div class="check-row ok">${icon('i-check')}<span class="txt">Keine Überschneidungen</span></div>`;
    rerender(box, h);
    updateChecksBadge();
  }

  function updateChecksBadge() {
    const b = $('#checks-badge');
    const n = app.problems.size;
    b.hidden = !n;
    b.textContent = n ? String(n) : '';
    b.title = n ? `${n} Überschneidung(en)` : '';
  }

  function bindChecks() {
    const box = $('#checks');
    box.addEventListener('change', (e) => {
      const pref = e.target.getAttribute('data-pref');
      if (pref) app.setPref(pref, e.target.checked);
    });
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-lens-toggle]');
      if (!b) return;
      const key = b.getAttribute('data-lens-toggle');
      setLens(app.overlay[key] ? null : key);
    });
  }

  /* ---------- Legende ---------- */
  function renderLegend() {
    const lg = $('#legend');
    let h = '';
    const lens = app.lens();
    const sw = (style, txt, cls) => `<div class="row"><span class="sw ${cls || ''}" style="${style}"></span><span>${txt}</span></div>`;
    const gl = (g, txt) => `<div class="row">${g}<span>${txt}</span></div>`;
    if (lens === 'access') {
      const S = app.doc.settings;
      h += `<strong>Rollstuhl</strong>` + sw('background:rgba(116,205,132,.55)', `befahrbar (≥ ${S.passage} cm)`) + sw('background:rgba(47,158,68,.75)', `Wenden möglich (Ø ${S.turning} cm)`) + sw('background:rgba(224,49,49,.55)', 'frei, aber zu eng / nicht erreichbar') + sw('background:#1F6FEB', 'Rollstuhlplatz am Tisch (gestrichelt: erst Stuhl wegstellen)', 'round') + sw('color:#1F6FEB', 'Weg von der Tür (Tisch antippen)', 'line');
    } else if (lens === 'sight') {
      h += `<strong>Sicht</strong>` + gl(glyph('good'), 'direkter Blick') + gl(glyph('side'), 'eingeschränkt: Kopf seitlich drehen') + (app.doc.settings.sightPersons !== false ? gl(glyph('person'), 'eingeschränkt: Person im Blickfeld') : '') + gl(glyph('back'), 'kein Blick: abgewandt / verdeckt') + sw('', app.selectedObjects().some(A.isSeat) ? 'Sichtkegel (rot = verdeckt, orange = Person)' : 'Sitzplatz antippen: Sichtkegel', 'cone');
    } else if (lens === 'teacher') {
      h += `<strong>Lehrkraft</strong>` + gl(tglyph('good'), 'Gesicht im Blick, bequem erreichbar') + gl(tglyph('side'), 'nur Profil, Engstelle, weit oder über den Tisch') + gl(tglyph('back'), 'sitzt mit dem Rücken zur Lehrkraft') + gl(tglyph('none'), 'nicht erreichbar oder verdeckt') + sw('background:rgba(12,133,153,.35)', 'Reichweite (dunkler = näher)') + sw('color:#0C8599', 'Weg zum ausgewählten Platz', 'line');
    } else if (lens === 'calm') {
      h += `<strong>Ruhe & Reize</strong>` + gl(cglyph('calm'), 'ruhiger Platz') + gl(cglyph('mid'), 'mittlere Unruhe') + gl(cglyph('busy'), 'unruhiger Platz') + sw('background:radial-gradient(rgba(232,89,12,.45),rgba(232,89,12,0))', 'Störquelle: Tür, Lounge', 'round') + sw('background:rgba(232,89,12,.3)', 'Laufwege (kräftiger = mehr Verkehr)');
    } else if (lens === 'seating') {
      h += `<strong>Sitzplan</strong>` + gl(sglyph(0, 'check'), 'Bedarfe erfüllt') + gl(sglyph(1, 'bang'), 'teilweise erfüllt') + gl(sglyph(2, 'x'), 'Bedarf nicht erfüllt') + sw('color:#2F9E44', 'möchte nebeneinander sitzen', 'line') + sw('color:#E03131', 'soll nicht nebeneinander sitzen', 'line');
    } else if (lens === 'rebuild') {
      h += `<strong>Umbau</strong>` + sw('background:rgba(95,61,196,.15);border:1.5px dashed #5F3DC4', 'Position in der vorigen Phase') + sw('color:#5F3DC4', 'Weg (Nummer = Reihenfolge)', 'line') + gl(sglyph(0, 'check').replace(/<path[^>]*\/>/, '<path d="M-4 0h8M0 -4v8" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>'), 'neu hinzustellen') + gl(sglyph(2, 'x'), 'wegräumen');
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
    for (const b of $$('.tool[data-lens]')) b.setAttribute('aria-pressed', String(!!app.overlay[b.getAttribute('data-lens')]));
    syncViewPop();
    syncHint();
  }

  let hintLock = false;
  function syncHint() {
    if (hintLock) return;
    const hint = $('#stage-hint');
    if (app.placing) {
      hint.innerHTML = `<span>Platz für <strong>${esc(app.learnerName(app.placing))}</strong> antippen</span><button class="x" data-hint="cancel">Abbrechen</button>`;
      hint.hidden = false;
    } else if (app.mode === 'measure') {
      hint.textContent = app.measure ? `Gemessen: ${Math.round(G.dist(app.measure.a, app.measure.b))} cm – neue Linie ziehen oder Esc` : 'Linie ziehen zum Messen · rastet an Kanten ein (Alt = frei, Umschalt = 45°)';
      hint.hidden = false;
    } else if (app.multi) {
      hint.textContent = 'Mehrfachauswahl: Objekte antippen oder Rahmen aufziehen · ins Leere tippen hebt die Auswahl auf';
      hint.hidden = false;
    } else hint.hidden = true;
  }

  /* Ansicht & Einrasten */
  function syncViewPop() {
    const s = app.doc.settings;
    const pop = $('#view-pop');
    for (const i of $$('[data-pref]', pop)) i.checked = !!s[i.getAttribute('data-pref')];
    for (const i of $$('[data-ov]', pop)) i.checked = !!app.overlay[i.getAttribute('data-ov')];
    for (const b of $$('[data-grid]', pop)) b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-grid')) === (s.grid || 50)));
    $('#tool-view').setAttribute('aria-expanded', String(!pop.hidden));
  }

  function toggleViewPop(show) {
    const pop = $('#view-pop');
    const btn = $('#tool-view');
    pop.hidden = show === undefined ? !pop.hidden : !show;
    if (!pop.hidden) {
      const st = $('#stage').getBoundingClientRect();
      const br = btn.getBoundingClientRect();
      pop.style.top = Math.round(br.bottom - st.top + 8) + 'px';
      pop.style.left = Math.round(Math.max(8, Math.min(br.left - st.left, st.width - pop.offsetWidth - 8))) + 'px';
    }
    syncViewPop();
  }

  function bindViewPop() {
    const pop = $('#view-pop');
    $('#tool-view').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleViewPop();
    });
    pop.addEventListener('change', (e) => {
      const k = e.target.getAttribute('data-pref');
      if (k) app.setPref(k, e.target.checked);
      const ov = e.target.getAttribute('data-ov');
      if (ov) app.setOverlay(ov, e.target.checked);
    });
    pop.addEventListener('click', (e) => {
      const b = e.target.closest('[data-grid]');
      if (b) app.setPref('grid', Number(b.getAttribute('data-grid')));
    });
    document.addEventListener('pointerdown', (e) => {
      if (!pop.hidden && !e.target.closest('#view-pop, #tool-view')) toggleViewPop(false);
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !pop.hidden) toggleViewPop(false);
    });
  }

  /* Datei-Menü */
  function toggleFileMenu(show) {
    const menu = $('#file-menu');
    const btn = $('#btn-file');
    menu.hidden = show === undefined ? !menu.hidden : !show;
    btn.setAttribute('aria-expanded', String(!menu.hidden));
    if (!menu.hidden) {
      const multi = !!app.doc.phases;
      menu.querySelector('[data-act="printRebuild"]').hidden = !(multi && app.phaseIndex() > 0);
      menu.querySelector('[data-act="printSeating"]').hidden = !app.learners().length;
      const br = btn.getBoundingClientRect();
      menu.style.right = Math.max(8, Math.round(window.innerWidth - br.right)) + 'px';
      const first = menu.querySelector('button:not([hidden])');
      if (first) first.focus();
    }
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
    for (const b of $$('.tool[data-lens]')) {
      b.addEventListener('click', () => {
        const k = b.getAttribute('data-lens');
        setLens(app.overlay[k] ? null : k);
      });
    }
    $('#zoom-in').addEventListener('click', () => app.zoomBy(1 / 1.3));
    $('#zoom-out').addEventListener('click', () => app.zoomBy(1.3));
    $('#zoom-fit').addEventListener('click', () => app.fitView());
    $('#btn-undo').addEventListener('click', () => app.undo());
    $('#btn-redo').addEventListener('click', () => app.redo());
    $('#btn-share').addEventListener('click', openShare);
    $('#btn-help').addEventListener('click', openHelp);
    $('#btn-right').addEventListener('click', () => toggleSide('right'));
    $('#btn-file').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFileMenu();
    });
    const menu = $('#file-menu');
    menu.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      toggleFileMenu(false);
      doAct(b.getAttribute('data-act'));
    });
    menu.addEventListener('keydown', (e) => {
      const items = $$('button:not([hidden])', menu);
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
      } else if (e.key === 'Escape') {
        toggleFileMenu(false);
        $('#btn-file').focus();
      }
    });
    document.addEventListener('click', (e) => {
      if (!menu.hidden && !e.target.closest('#file-menu, #btn-file')) toggleFileMenu(false);
    });
    document.body.addEventListener('click', (e) => {
      const b = e.target.closest('#props [data-act], #checks [data-act], #sel-bar [data-act]');
      if (b) doAct(b.getAttribute('data-act'));
    });
    $('#stage-hint').addEventListener('click', (e) => {
      if (e.target.closest('[data-hint="cancel"]')) app.emit('place', null);
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

  /* ---------- Bibliothek (links) ---------- */
  function setTab(tab) {
    if (!TABS[tab]) tab = 'catalog';
    panels.tab = tab;
    savePanels();
    for (const b of $$('.activity [role="tab"]')) {
      const on = b.getAttribute('data-tab') === tab;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    for (const id of Object.keys(TABS)) $('#tab-' + id).hidden = id !== tab;
    $('#lib-title').textContent = TABS[tab];
    if (tab === 'objects') renderObjects();
    if (LLR.classUI) LLR.classUI.onTab(tab);
  }

  function openLibTab(tab) {
    setTab(tab);
    if (mobile()) openLeft(tab);
    else if (!panels.left) toggleSide('left', true);
  }

  function bindTabs() {
    const tabs = $$('.activity [role="tab"]');
    for (const b of tabs) {
      b.addEventListener('click', () => {
        const tab = b.getAttribute('data-tab');
        // Am Computer: aktiven Reiter erneut antippen klappt die Bibliothek ein
        if (!mobile() && tab === panels.tab && panels.left) return toggleSide('left', false);
        setTab(tab);
        if (!mobile() && !panels.left) toggleSide('left', true);
      });
      b.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const i = tabs.indexOf(b);
        const n = tabs[(i + (e.key === 'ArrowDown' ? 1 : tabs.length - 1)) % tabs.length];
        n.focus();
        setTab(n.getAttribute('data-tab'));
      });
    }
    $('#btn-lib-close').addEventListener('click', () => (mobile() ? closeDrawers() : toggleSide('left', false)));
  }

  /* Seitenleisten am Computer ein- und ausklappen */
  function applySides() {
    const ws = $('.workspace');
    ws.classList.toggle('no-left', !panels.left);
    ws.classList.toggle('no-right', !panels.right);
    $('#btn-right').setAttribute('aria-expanded', String(panels.right));
    renderSelBar();
  }
  function toggleSide(side, open) {
    panels[side] = open === undefined ? !panels[side] : open;
    savePanels();
    applySides();
    if (side === 'right') syncNeeds();
  }
  function showDetails() {
    showRightView('props');
    if (mobile()) openRight('props');
    else {
      if (!panels.right) toggleSide('right', true);
      $('#panel-right').scrollTop = 0;
    }
  }

  /* Rechte Seite: Details oder Prüfen. Mit Auswahl stehen die Details vorn,
     ohne Auswahl die zuletzt gewählte Ansicht. */
  let rightView = 'props';
  function showRightView(view) {
    rightView = view;
    $('#props').hidden = view !== 'props';
    $('#checks').hidden = view !== 'checks';
    for (const b of $$('.right-tabs [data-view]')) b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === view));
    syncNeeds();
    if (view === 'checks') renderChecks();
    else renderProps();
  }
  /* Rollstuhl-Analyse auch ohne Darstellung im Plan, wenn Prüfen sichtbar ist */
  function syncNeeds() {
    const visible = rightView === 'checks' && (mobile() ? $('#panel-right').classList.contains('open') : panels.right);
    app.setNeed('access', visible || (rightView === 'props' && app.selectedObjects().some((o) => A.isTable(o) || o.type === 'wheelchair')) || !!(app.learners().length && (panels.tab === 'learners' || app.overlay.seating)));
  }

  function openLeft(tab) {
    if (tab) setTab(tab);
    $('#panel-left').classList.add('open');
    $('#panel-right').classList.remove('open');
    $('#scrim').hidden = false;
  }
  function openRight(view) {
    showRightView(view === 'checks' ? 'checks' : 'props');
    if (view === 'checks' || view === 'props') {
      panels.view = view;
      savePanels();
    }
    const panel = $('#panel-right');
    panel.classList.add('open');
    panel.style.transform = '';
    $('#panel-left').classList.remove('open');
    $('#scrim').hidden = false;
    panel.scrollTop = 0;
    syncNeeds();
  }
  function closeDrawers() {
    $('#panel-left').classList.remove('open');
    const panel = $('#panel-right');
    panel.classList.remove('open');
    panel.style.transform = '';
    $('#scrim').hidden = true;
    syncNeeds();
  }

  function bindDrawers() {
    $('#btn-drawer').addEventListener('click', () => openLeft());
    $('#scrim').addEventListener('click', closeDrawers);
    for (const b of $$('[data-close]')) b.addEventListener('click', closeDrawers);
    for (const b of $$('.mobile-bar [data-open]')) {
      b.addEventListener('click', () => {
        const k = b.getAttribute('data-open');
        if (TABS[k]) openLeft(k);
        else openRight(k);
      });
    }
    for (const b of $$('.right-tabs [data-view]')) {
      b.addEventListener('click', () => {
        const v = b.getAttribute('data-view');
        panels.view = v;
        savePanels();
        showRightView(v);
        $('#panel-right').scrollTop = 0;
      });
    }
    // Unteres Blatt (Smartphone) am Kopf nach unten wischen schließt es
    const panel = $('#panel-right');
    const head = $('.right-head');
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
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) closeDrawers();
    });
    window.matchMedia('(max-width: 900px)').addEventListener('change', () => {
      closeDrawers();
      renderSelBar();
      syncLibClose();
    });
    syncLibClose();
  }
  /* Schließen-Symbol der Bibliothek: am Computer einklappen, mobil schließen */
  function syncLibClose() {
    const u = $('#btn-lib-close use');
    u.setAttribute('href', mobile() ? '#i-x' : '#i-chev-left');
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
    const hasL = app.learners().length > 0;
    const v = await openDialog({
      title: 'Neuer Plan',
      body: `<p>Womit möchten Sie beginnen? Der aktuelle Plan wird ersetzt (Rückgängig mit <span class="kbd">Strg</span>+<span class="kbd">Z</span> möglich; vorher ggf. unter „Pläne“ speichern).</p>
        <label class="toggle"><input type="radio" name="newkind" value="seminar1" checked> LLR wie eingerichtet (Seminarsitzordnung I)</label>
        <label class="toggle"><input type="radio" name="newkind" value="furnished"> LLR ohne Tische & Stühle (nur feste Einrichtung)</label>
        <label class="toggle"><input type="radio" name="newkind" value="empty"> Leerer Raum (nur Tür & Fenster)</label>
        ${hasL ? `<label class="toggle" style="margin-top:6px"><input type="checkbox" id="new-keep-l" checked><span>Lernendenliste behalten<small>${app.learners().length} Lernende mit ihren Bedarfen (ohne Sitzplätze)</small></span></label>` : ''}`,
      buttons: [
        { label: 'Abbrechen', value: 'cancel' },
        { label: 'Neu anlegen', value: 'ok', cls: 'primary' },
      ],
      onOpen: (b) => (b._kind = () => (b.querySelector('input[name=newkind]:checked') || {}).value),
    });
    if (v !== 'ok') return;
    const kind = $('#dlg-body')._kind();
    const keepL = hasL && $('#new-keep-l') && $('#new-keep-l').checked;
    const doc = app.createDoc(kind === 'seminar1' ? 'seminar1' : null);
    doc.room = Object.assign({}, app.doc.room);
    doc.settings = Object.assign({}, app.doc.settings);
    doc.objects = LLR.roomFurniture(doc.room);
    if (kind === 'seminar1') doc.objects = doc.objects.concat(app.buildPreset(LLR.PRESETS[0], doc));
    if (kind === 'empty') doc.objects = doc.objects.filter((o) => o.type === 'door' || o.type === 'window');
    if (keepL) doc.learners = JSON.parse(JSON.stringify(app.learners()));
    replaceDoc(doc);
    toast('Neuer Plan angelegt');
  }

  function replaceDoc(doc) {
    const n = app.normalizeDoc(doc);
    app.mutate((d) => {
      for (const k of Object.keys(d)) delete d[k];
      Object.assign(d, n);
    });
    app.sel = new Set();
    app.renderRoom();
    app.fitView();
    app.emit('select');
    app.emit('phase');
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
        <p class="desc">Möbel an der rechten Wand und an der Rückwand wandern beim Ändern mit (in allen Phasen). Tür, Fenster und Wandobjekte bleiben an ihrer Wand.</p>
        <h3>Möbelmaße</h3>
        <div class="field-grid">
          <label class="field">Tisch: lange Seite (cm)<input type="number" id="set-tb" value="${s.tableBase}" min="60" max="200" step="1"></label>
          <label class="field">Tisch: Tiefe (cm)<input type="number" id="set-th" value="${s.tableHeight}" min="30" max="120" step="1"></label>
          <span></span>
          <label class="field">Stuhl: Breite (cm)<input type="number" id="set-cw" value="${s.chairW}" min="30" max="80" step="1"></label>
          <label class="field">Stuhl: Tiefe (cm)<input type="number" id="set-cd" value="${s.chairD}" min="30" max="90" step="1"></label>
        </div>
        <h3>Barrierefreiheit & Laufwege</h3>
        <div class="field-grid">
          <label class="field">Rollstuhl: Durchgang (cm)<input type="number" id="set-pass" value="${s.passage}" min="60" max="200" step="5"></label>
          <label class="field">Rollstuhl: Wendekreis Ø (cm)<input type="number" id="set-turn" value="${s.turning}" min="100" max="250" step="5"></label>
          <label class="field">Gehen: bequemer Durchgang (cm)<input type="number" id="set-walk" value="${s.walk || 50}" min="36" max="120" step="5"></label>
        </div>
        <label class="toggle"><input type="checkbox" id="set-block" ${s.chairsBlock ? 'checked' : ''}> Stühle und Hocker beim Rollstuhl-Check als Hindernis zählen</label>
        <p class="desc">DIN 18040-1: Durchgänge mind. 90 cm, Bewegungsflächen 150 × 150 cm. Beim Gehen (Lehrkraft-Check, Laufwege) gilt ab 36 cm als Engstelle, durch die man sich seitlich hindurchschiebt.</p>
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
      $('#set-walk').value = d.walk;
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
      st.walk = val('#set-walk', st.walk || 50, 36, 120);
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
        <p class="desc" style="margin-top:6px">Pläne werden nur in diesem Browser auf diesem Gerät gespeichert – mit allen Phasen und der Lernendenliste.</p>
        <h3>Gespeicherte Pläne (${list.length})</h3>`;
      if (!list.length) h += `<p class="desc">Noch keine Pläne gespeichert.</p>`;
      else {
        h += `<ul class="plans-list">`;
        for (const p of list.slice().sort((a, b) => b.date - a.date)) {
          const ph = p.doc && Array.isArray(p.doc.phases) ? ` · ${p.doc.phases.length} Phasen` : '';
          h += `<li><span class="p-name"><strong>${esc(p.name)}</strong><small>${new Date(p.date).toLocaleString('de-DE')}${ph}</small></span>
            <button type="button" class="btn outline small" data-load="${p.id}">Öffnen</button>
            <button type="button" class="icon-btn danger" data-delp="${p.id}" aria-label="Löschen" title="Löschen">${icon('i-trash')}</button></li>`;
        }
        h += `</ul>`;
      }
      h += `<h3>Als Datei</h3><div class="btn-row">
        <button type="button" class="btn outline" id="plan-dl">${icon('i-download')}Herunterladen (.json)</button>
        <button type="button" class="btn outline" id="plan-ul">${icon('i-upload')}Datei öffnen</button></div>
        <p class="desc" style="margin-top:6px">Dateien lassen sich per E-Mail oder OPAL weitergeben und hier wieder öffnen.</p>`;
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

  const fileName = (ext, suffix) => {
    const map = { ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ß: 'ss' };
    const base = ((app.doc.name || 'raumplan') + (suffix || '')).replace(/[äöüÄÖÜß]/g, (c) => map[c]).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_');
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

  /* Kompakte Fassung für den Link: kurze IDs (in allen Phasen gleich, damit
     der Umbau erhalten bleibt), gerundete Werte; Lernende nur auf Wunsch */
  function compactDoc(withLearners) {
    const d = JSON.parse(app.serialize());
    const r1 = (v) => Math.round(v * 10) / 10;
    const ids = new Map();
    const short = (id) => {
      if (!ids.has(id)) ids.set(id, ids.size.toString(36));
      return ids.get(id);
    };
    const pack = (list) =>
      (list || []).map((o) => {
        const c = Object.assign({}, o);
        if (d.phases) c.id = short(o.id);
        else delete c.id;
        c.x = r1(c.x);
        c.y = r1(c.y);
        c.rot = r1(c.rot || 0);
        if (!c.rot) delete c.rot;
        if (!withLearners) delete c.learner;
        return c;
      });
    d.objects = pack(d.objects);
    if (d.phases) for (const ph of d.phases) if (ph.objects) ph.objects = pack(ph.objects);
    if (!withLearners) delete d.learners;
    return d;
  }

  async function packDoc(withLearners) {
    const json = JSON.stringify(compactDoc(withLearners));
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
    const hasL = app.learners().length > 0;
    const build = async (withL) => location.origin + location.pathname + '#p=' + (await packDoc(withL));
    let url = await build(false);
    const canShare = !!navigator.share;
    const info = (u) => `Länge: ${u.length} Zeichen.${u.length > 2000 ? ' Sehr lange Links funktionieren nicht überall – dann besser „Pläne → Herunterladen“ verwenden.' : ''}`;
    openDialog({
      title: 'Plan teilen',
      body: `<p>Der komplette Plan${app.doc.phases ? ' mit allen Phasen' : ''} steckt in diesem Link – es wird nichts auf einem Server gespeichert. Wer den Link öffnet, sieht den Plan und kann ihn weiter bearbeiten.</p>
        <div class="share-box"><input type="text" id="share-url" readonly value="${esc(url)}" aria-label="Link zum Plan"></div>
        <p class="desc" id="share-info" style="margin-top:6px">${info(url)}</p>
        ${hasL ? `<label class="toggle"><input type="checkbox" id="share-l"><span>Sitzplan mit Lernenden mitteilen<small>Namen und Bedarfe stehen dann im Link. Aus Datenschutzgründen nur Kürzel verwenden und den Link nicht öffentlich teilen.</small></span></label>` : ''}`,
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
        const cb = $('#share-l');
        if (cb)
          cb.addEventListener('change', async () => {
            url = await build(cb.checked);
            inp.value = url;
            $('#share-info').textContent = info(url);
          });
      },
    });
  }

  /* ---------- Bild-Export & Druck ---------- */
  function buildExportSVG(scale, opts) {
    opts = opts || {};
    const W = app.doc.room.w;
    const L = app.doc.room.l;
    const pad = opts.noTitle ? 40 : 55;
    const head = opts.noTitle ? 0 : 56;
    const x0 = -20 - pad;
    const y0 = -20 - pad - head;
    const w = W + 2 * (20 + pad);
    const h = L + 2 * (20 + pad) + head;
    const svg = app.svg;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${x0} ${y0} ${w} ${h}" width="${Math.round(w * scale)}" height="${Math.round(h * scale)}" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif">`;
    s += `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#ffffff"/>`;
    s += svg.querySelector('defs').outerHTML;
    if (!opts.noTitle) {
      const ph = app.doc.phases ? ` – ${app.phases()[app.phaseIndex()].name}` : '';
      s += `<text x="${x0 + 24}" y="${y0 + 34}" font-size="24" font-weight="700" fill="#1d2433">${esc(app.doc.name + ph)}</text>`;
      s += `<text x="${x0 + w - 24}" y="${y0 + 34}" font-size="14" fill="#5f6b7a" text-anchor="end">LLR · ${new Date().toLocaleDateString('de-DE')}</text>`;
    }
    s += `<g>${app.els.floor.innerHTML}</g><g>${app.els.analysis.innerHTML}</g><g>${app.els.walls.innerHTML}</g><g>${app.els.objects.innerHTML}</g><g>${app.els.tags.innerHTML}</g><g>${app.els.marks.innerHTML}</g>`;
    s += `</svg>`;
    if (opts.prefix) s = s.replace(/id="([\w-]+)"/g, `id="${opts.prefix}$1"`).replace(/url\(#([\w-]+)\)/g, `url(#${opts.prefix}$1)`);
    return { svg: s, w: Math.round(w * scale), h: Math.round(h * scale) };
  }

  /* Plan kurz mit einer bestimmten Prüfansicht zeichnen (für Druck/Export) */
  function withLens(lens, fn) {
    const prev = app.lens();
    const sel = app.sel;
    if (lens !== undefined && lens !== prev) {
      for (const k of app.LENSES) app.overlay[k] = k === lens;
      app.sel = new Set();
      app.renderAnalysisLayer();
      app.renderMarks();
    }
    try {
      return fn();
    } finally {
      if (lens !== undefined && lens !== prev) {
        for (const k of app.LENSES) app.overlay[k] = k === prev;
        app.sel = sel;
        app.renderAnalysisLayer();
        app.renderOverlay();
      }
    }
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

  function printHead(title) {
    const ph = app.doc.phases ? ` · Phase ${app.phaseIndex() + 1}: ${esc(app.phases()[app.phaseIndex()].name)}` : '';
    return `<h1>${esc(title)}</h1><div class="sub">Lehr-Lern-Raum Inklusion (LLR) · ${app.fmtM(app.doc.room.w)} × ${app.fmtM(app.doc.room.l)} (${app.fmtArea(app.doc.room.w * app.doc.room.l)})${ph} · ${new Date().toLocaleString('de-DE')}</div>`;
  }

  function buildPrintSheet(kind) {
    kind = kind || 'plan';
    let h = '';
    if (kind === 'rebuild') {
      const rb = app.rebuildFromPrev();
      if (!rb) return buildPrintSheet('plan');
      const prev = app.phases()[app.phaseIndex() - 1].name;
      const cur = app.phases()[app.phaseIndex()].name;
      const { svg } = withLens('rebuild', () => buildExportSVG(1, { noTitle: true, prefix: 'pr-' }));
      h += printHead(`Umbauplan: ${prev} → ${cur}`);
      h += `<div class="plan">${svg}</div>`;
      const steps = LLR.rebuildSteps(rb);
      const chairs = rb.moved.filter((m) => m.type === 'chair' || m.type === 'stool');
      h += `<div class="cols"><div><h2>Reihenfolge</h2><ol>${steps.map((s) => `<li>${esc(s.text)}</li>`).join('')}${chairs.length ? `<li>Danach ${chairs.length} Stühle/Hocker an die Tische stellen (zarte Pfeile im Plan).</li>` : ''}</ol>${!steps.length && !chairs.length ? '<p>Keine Möbel zu bewegen.</p>' : ''}</div>`;
      h += `<div><h2>Aufwand</h2><table><tr><td>Tische</td><td>${rb.tables}</td></tr><tr><td>Stühle und Hocker</td><td>${rb.seats}</td></tr><tr><td>Weitere Möbel</td><td>${rb.other}</td></tr><tr><td>Wege zusammen</td><td>${m1(rb.distSum)}</td></tr><tr><td>Zeit (grobe Schätzung)</td><td>allein ca. ${Math.max(1, Math.round(rb.sec / 60))} min · zu viert ca. ${Math.max(1, Math.round(rb.sec / 4 / 60 + 0.5))} min</td></tr></table>`;
      if (rb.added.length || rb.removed.length) h += `<p style="font-size:9.5pt">${rb.added.length ? `Neu hinstellen: ${rb.added.length} (grünes +). ` : ''}${rb.removed.length ? `Wegräumen: ${rb.removed.length} (rotes ×).` : ''}</p>`;
      h += `</div></div><div class="foot">Erstellt mit dem LLR-Raumplaner 2D. Lila gestrichelt: Position in der vorigen Phase.</div>`;
    } else if (kind === 'seating') {
      const { svg } = withLens(undefined, () => buildExportSVG(1, { noTitle: true, prefix: 'pr-' }));
      h += printHead(`Sitzplan: ${app.doc.name}`);
      h += `<div class="plan">${svg}</div>`;
      h += LLR.classUI ? LLR.classUI.printTable() : '';
      h += `<div class="foot">Erstellt mit dem LLR-Raumplaner 2D. Vertraulich – enthält Angaben zu Lernenden.</div>`;
    } else {
      const st = app.stats();
      const c = st.count;
      const { svg } = buildExportSVG(1, { noTitle: true, prefix: 'pr-' });
      h += printHead(app.doc.name);
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
      const a = app.access && app.access.complete ? app.access : A.access(app.doc, { image: false });
      if (a) {
        h += `<tr><td>Tür mit Rollstuhl erreichbar</td><td>${a.doorOk ? 'ja' : 'nein'}</td></tr>
          <tr><td>Befahrbare Fläche</td><td>${num(a.sweptArea)} m²</td></tr>
          <tr><td>Wenden (Ø ${app.doc.settings.turning} cm)</td><td>${a.turnPossible ? 'möglich' : 'nicht möglich'}</td></tr>
          <tr><td>Tische mit Rollstuhlplatz</td><td>${a.tablesNow} sofort${a.tablesLater ? `, ${a.tablesLater} nach Wegstellen ${a.laterMove > 1 ? 'von 1–2 Stühlen' : 'eines Stuhls'}` : ''}</td></tr>`;
      }
      const sg = app.getSight();
      if (sg.seats.length && sg.surfaces.length) h += `<tr><td>Sicht auf Tafel & Bildschirme</td><td>${sg.good} direkt, ${sg.limited} eingeschränkt, ${sg.back} ohne Blick</td></tr>`;
      const t = app.getTeacher();
      if (t.seats.length) h += `<tr><td>Lehrkraft: erreichbar / Gesicht im Blick</td><td>${t.reachable} / ${t.face} von ${t.seats.length}</td></tr>`;
      const cm = app.getCalm();
      if (cm.seats.length) h += `<tr><td>Ruhe & Reize</td><td>${cm.calm} ruhig, ${cm.mid} mittel, ${cm.busy} unruhig</td></tr>`;
      h += `</table></div><div class="foot">Erstellt mit dem LLR-Raumplaner 2D. Prüfungen sind vereinfachte Modelle (Rollstuhl: Durchgang ${app.doc.settings.passage} cm, Wendekreis ${app.doc.settings.turning} cm) – sie ersetzen keine Prüfung vor Ort.</div>`;
    }
    $('#print-sheet').innerHTML = h;
  }

  /* Druck über das Menü: gewählte Fassung; Strg+P ohne Menü: normaler Plan */
  let printPending = null;
  function printPlan(kind) {
    printPending = kind || 'plan';
    buildPrintSheet(printPending);
    setTimeout(() => window.print(), 50);
  }
  window.addEventListener('beforeprint', () => {
    if (!printPending) buildPrintSheet('plan');
  });
  window.addEventListener('afterprint', () => (printPending = null));

  /* ---------- Hilfe ---------- */
  function openHelp() {
    const S = app.doc.settings;
    const card = (ic, title, txt) => `<div class="help-card"><strong>${icon(ic)}${title}</strong><p>${txt}</p></div>`;
    openDialog({
      title: 'So funktioniert der LLR-Raumplaner',
      wide: true,
      body: `<div class="help-grid">
          ${card('i-box', 'Einrichten', 'Links unter „Möbel“ antippen oder in den Plan ziehen. „Anordnungen“ übernimmt eine Sitzordnung aus der Handreichung.')}
          ${card('i-panel', 'Details', 'Ein Objekt antippen: rechts stehen Maße, Farbe und seine Prüfergebnisse. Ohne Auswahl: Raum und Belegung.')}
          ${card('i-check', 'Prüfen', 'Rollstuhl, Sicht, Lehrkraft und Ruhe – oben im Plan oder rechts unter „Prüfen“. Es ist immer eine Prüfung im Plan zu sehen.')}
          ${card('i-users', 'Lernende & Sitzplan', 'Namen oder Kürzel eintragen, Bedarfe markieren und auf Plätze setzen – oder automatisch verteilen lassen.')}
          ${card('i-steps', 'Phasen', 'Mehrere Anordnungen für eine Stunde (z. B. Kreis → Gruppenarbeit). Mit Übergang, Umbauaufwand und Umbauplan.')}
          ${card('i-link', 'Speichern & Teilen', 'Automatische Sicherung im Browser. Im Datei-Menü: Pläne, Bild, Drucken. „Teilen“ erzeugt einen Link.')}
        </div>
        <details><summary>Bedienung im Plan</summary><ul>
          <li><strong>Verschieben:</strong> Objekt antippen und ziehen. <strong>Drehen:</strong> am blauen Kreis über der Auswahl ziehen (rastet in ${S.angleSnap}°-Schritten ein, Umschalt = frei) oder mit den Knöpfen unten.</li>
          <li><strong>Größe ändern:</strong> an den kleinen Quadraten ziehen (Umschalt an einer Ecke = Seitenverhältnis behalten, Alt = zentimetergenau).</li>
          <li><strong>Raumgröße:</strong> ohne Auswahl an einer Wand oder an den blauen Griffen ziehen – oder rechts eintippen.</li>
          <li><strong>Tische kombinieren:</strong> Tische rasten Kante an Kante ein, angestellte Stühle wandern mit. <strong>Doppelklick</strong> auf einen Tisch wählt die ganze Gruppe.</li>
          <li><strong>Ansicht & Einrasten:</strong> Abstände, Raummaße, Raster sowie magnetisches Einrasten und Rastergröße.</li>
          <li><strong>Mehrere Objekte:</strong> „Mehrfach“ aktivieren und antippen bzw. Rahmen aufziehen – am Computer mit gedrückter Umschalttaste.</li>
          <li><strong>Ansicht:</strong> leere Fläche ziehen = verschieben, Mausrad oder zwei Finger = zoomen.</li>
          <li><strong>Mehr Platz:</strong> den aktiven Reiter links erneut antippen klappt die Bibliothek ein; das Symbol oben rechts blendet „Details & Prüfen“ aus.</li>
        </ul></details>
        <details><summary>Prüfungen</summary><ul>
          <li><strong>Rollstuhl:</strong> befahrbare Flächen ab der Tür (Durchgang ≥ ${S.passage} cm), Wenden (Ø ${S.turning} cm), Rollstuhlplätze an Tischen mit geprüftem Weg. Test-Rollstuhl zum Ausprobieren.</li>
          <li><strong>Sicht:</strong> je Platz, ob Tafel, Bildschirm oder Beamer-Fläche direkt, nur seitlich oder gar nicht im Blick sind – auch wenn Personen davor sitzen. Platz antippen zeigt den Sichtkegel.</li>
          <li><strong>Lehrkraft:</strong> erreicht die Lehrkraft jeden Platz (Durchgang ≥ ${S.walk || 50} cm, Engstellen ab 36 cm) und sieht sie die Gesichter? Mit Lehrkraft-Positionen aus dem Katalog lassen sich Standorte vergleichen.</li>
          <li><strong>Ruhe & Reize:</strong> Nähe zu Tür und Lounge, Laufwege anderer, Gedränge, Fensterblick und Spiegelungen. Regale und Trennwände dämpfen; Zonen namens „Ruhezone“ zählen als ruhig.</li>
          <li><strong>Sitzplan & Bedarfe:</strong> prüft je Person die markierten Bedarfe am Platz (z. B. Hören: nah an Tafel und Lehrkraft).</li>
          <li>Alle Prüfungen sind vereinfachte Modelle und ersetzen keine fachliche Prüfung vor Ort.</li>
        </ul></details>
        <details><summary>Tastatur</summary><p><span class="kbd">Pfeiltasten</span> verschieben (mit <span class="kbd">Umschalt</span> 10 cm) · <span class="kbd">R</span> drehen · <span class="kbd">Entf</span> löschen · <span class="kbd">Strg</span>+<span class="kbd">D</span> duplizieren · <span class="kbd">Strg</span>+<span class="kbd">Z</span>/<span class="kbd">Y</span> rückgängig/wiederholen · <span class="kbd">L</span> sperren · <span class="kbd">M</span> messen · <span class="kbd">+</span>/<span class="kbd">−</span>/<span class="kbd">0</span> Zoom · <span class="kbd">Esc</span> Auswahl aufheben</p></details>`,
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
    setTab(panels.tab);
    showRightView(panels.view === 'checks' ? 'checks' : 'props');
    renderLegend();
    syncTools();
    syncHistory();
    $('#plan-name').value = app.doc.name;
    if (LLR.classUI) LLR.classUI.render();

    app.on('change', () => {
      updateBadges();
      if (rightView === 'props') renderProps();
      else renderChecks();
      renderObjects();
      renderSelBar();
      syncHistory();
      if (document.activeElement !== $('#plan-name')) $('#plan-name').value = app.doc.name;
      if (LLR.classUI) LLR.classUI.render();
    });
    app.on('live', () => {
      liveProps();
    });
    let lastSel = '';
    app.on('select', () => {
      // Kontext: mit Auswahl Details zeigen, ohne Auswahl die gewählte Ansicht
      const key = [...app.sel].sort().join(',');
      if (key !== lastSel) {
        lastSel = key;
        showRightView(app.sel.size ? 'props' : panels.view);
      } else if (rightView === 'props') renderProps();
      renderObjects();
      renderSelBar();
      if (app.overlay.sight) renderLegend();
      if (LLR.classUI) LLR.classUI.onSelect();
    });
    app.on('history', syncHistory);
    app.on('prefs', () => {
      syncViewPop();
      renderSelBar();
      if (rightView === 'checks') renderChecks();
      else renderProps();
      renderLegend();
    });
    app.on('analysis', () => {
      if (app.drag && app.drag.moved) return;
      if (rightView === 'checks') renderChecks();
      else {
        const o = app.selectedObjects();
        if (o.length === 1 && (A.isTable(o[0]) || o[0].type === 'wheelchair' || o[0].learner)) renderProps();
      }
      if (LLR.classUI) LLR.classUI.onAnalysis();
    });
    app.on('overlay', () => {
      if (rightView === 'checks') renderChecks();
      else renderProps();
      renderLegend();
      syncTools();
      syncNeeds();
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
    app.on('phase', () => {
      if (LLR.classUI) LLR.classUI.render();
      if (rightView === 'checks') renderChecks();
      else renderProps();
      renderLegend();
    });

    try {
      if (!localStorage.getItem(KEY_SEEN)) {
        localStorage.setItem(KEY_SEEN, '1');
        if (!shared && !localStorage.getItem('llr2d.seen.v1')) openHelp();
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
    bindViewPop();
    bindTabs();
    bindDrawers();
    bindFile();
    if (LLR.classUI) LLR.classUI.bind();
  }

  LLR.ui = {
    toast,
    openDialog,
    confirmDlg,
    exportPNG,
    printPlan,
    openShare,
    packDoc,
    unpackDoc,
    buildExportSVG,
    planPreview,
    setLens,
    syncHint,
    syncNeeds,
    openLibTab,
    closeDrawers,
    showDetails,
    ensureVisible,
    mini,
    sglyph,
    icon,
    m1,
    panels,
    savePanels,
    mobile,
    renderProps,
    renderChecks,
  };

  // Start erst, wenn alle Skripte (auch js/ui-class.js) geladen sind
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init);
})((window.LLR = window.LLR || {}));

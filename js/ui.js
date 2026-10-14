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
  const isPro = () => !LLR.prefs || LLR.prefs.isPro();
  /* Katalog: diese Gruppen sind zu Beginn aufgeklappt, alle anderen zu */
  const CAT_OPEN = { bausteine: true, tische: true, sitze: true, pruefen: true, eigene: true };
  const catOpen = (id) => (panels.cats[id] === undefined ? !!CAT_OPEN[id] : panels.cats[id] !== false);

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
  const dot = (lv) => `<span class="dot l${lv}" aria-hidden="true">${lv === 0 ? '✓' : lv === 1 ? '!' : lv === 2 ? '✕' : ''}</span>`;
  const row = (cls, ic, txt, small) => `<div class="check-row ${cls}">${icon(ic)}<span class="txt">${txt}${small ? `<small>${small}</small>` : ''}</span></div>`;

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(msg, ms) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms || Math.max(3400, Math.min(9000, msg.length * 55)));
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
    return `<svg class="${opts.cls || 'pv'}" viewBox="${cx - side / 2} ${cy - side / 2} ${side} ${side}" aria-hidden="true">${inner}</svg>`;
  }

  /* ---------- Katalog ----------
     Oben fertige Bausteine (Tischgruppen mit Stühlen), darunter die Möbel
     nach Gruppen. Raum & Technik, freie und eigene Objekte nur in der
     Profi-Ansicht. */
  const blockObjs = (b) => LLR.colorChairs(b.build(app.doc ? app.doc.settings : LLR.DEFAULT_SETTINGS));

  function catSection(id, name, n, inner) {
    const open = catOpen(id);
    return `<section class="cat" data-catsec="${id}"><button class="cat-head" data-cat="${id}" aria-expanded="${open}">${icon('i-chevron')}${esc(name)}<span class="n">${n}</span></button><div class="cat-grid${id === 'bausteine' ? ' blocks' : ''}"${open ? '' : ' hidden'}>${inner}</div></section>`;
  }

  function renderCatalog() {
    const box = $('#tab-catalog');
    const pro = isPro();
    const prevQ = $('#cat-search') ? $('#cat-search').value : '';
    let h = `<label class="search">${icon('i-search')}<span class="visually-hidden">Möbel suchen</span><input type="search" id="cat-search" placeholder="Möbel suchen …" autocomplete="off"></label>
      <p class="cat-note top">Antippen fügt in der Bildmitte ein, am Computer auch per Ziehen. <span class="badge-demo" aria-hidden="true">12/12</span> = im Plan / im LLR vorhanden.</p><div id="cat-list">`;
    let blocks = '';
    for (const b of LLR.BLOCKS) {
      blocks += `<button class="cat-item block" data-block="${b.id}" data-search="${esc((b.name + ' ' + b.desc + ' baustein gruppe').toLowerCase())}" draggable="true" title="${esc(b.name + ' – ' + b.desc)}">${planPreview(blockObjs(b), { cls: 'thumb' })}<span class="name">${esc(b.name)}</span><small>${esc(b.desc)}</small></button>`;
    }
    h += catSection('bausteine', 'Fertige Bausteine', LLR.BLOCKS.length, blocks);
    for (const c of LLR.CATEGORIES) {
      if (c.pro && !pro) continue;
      const types = Object.keys(T).filter((k) => T[k].cat === c.id && (pro || !T[k].pro));
      let inner = '';
      for (const k of types) {
        const d = T[k];
        inner += `<button class="cat-item" data-type="${k}" data-search="${esc((d.name + ' ' + (d.label || '') + ' ' + (d.desc || '')).replace(/\u00AD/g, '').toLowerCase())}" draggable="true" title="${esc(d.name + ' – ' + (d.desc || ''))}">${thumb(sample(k))}<span class="name">${esc(d.label || d.name)}</span><span class="badge" data-badge="${k}"></span></button>`;
      }
      if (c.id === 'eigene') inner += `<button class="cat-item add" data-act="newFurniture" data-search="neu eigenes möbel anlegen" title="Eigenes Möbelstück anlegen">${icon('i-plus')}<span class="name">Neues Möbel&shy;stück …</span></button>`;
      if (!inner) continue;
      h += catSection(c.id, c.name, types.length, inner);
    }
    h += `</div><p class="empty-note" id="cat-empty" hidden>Nichts gefunden.</p>`;
    if (!pro) h += `<p class="cat-note">Weitere Objekte (Tür, Fenster, Wandstücke, freie und eigene Möbel) gibt es in der <button class="link-btn" data-act="toggleLevel">Profi-Ansicht</button>.</p>`;
    box.innerHTML = h;
    updateBadges();
    if (prevQ) {
      $('#cat-search').value = prevQ;
      filterCatalog(prevQ);
    }
  }

  /* Baustein einfügen (Mitte der Ansicht oder an einer Stelle im Plan) */
  function addBlock(id, at) {
    const b = LLR.BLOCKS.find((x) => x.id === id);
    if (!b) return;
    const before = app.stats().count;
    const objs = app.addGroup(b.build(app.doc.settings), at, `Baustein „${b.name}“ eingefügt`);
    const after = app.stats().count;
    const over = [];
    for (const k of new Set(objs.map((o) => o.type))) {
      const d = T[k];
      if (d.inv && after[k] > d.inv && (before[k] || 0) <= after[k]) over.push(`${after[k]} × ${d.short} (im LLR: ${d.inv})`);
    }
    toast(over.length ? `„${b.name}“ eingefügt – jetzt ${over.join(', ')}. Zusätzliche Möbel müssen aus anderen Räumen kommen.` : `„${b.name}“ eingefügt – mit der Maus oder dem Finger an die richtige Stelle ziehen.`);
    if (LLR.assist) LLR.assist.tip('block', 'Tipp: Eine Tischgruppe lässt sich als Ganzes drehen (Drehen-Knopf unten) – Doppelklick auf einen Tisch wählt sie später wieder komplett aus.');
    if (mobile()) closeDrawers();
  }

  function filterCatalog(q) {
    q = q.trim().toLowerCase();
    let any = false;
    for (const sec of $$('#cat-list .cat')) {
      let n = 0;
      for (const it of $$('.cat-item', sec)) {
        const hit = !q || (it.getAttribute('data-search') || '').includes(q);
        it.hidden = !hit;
        if (hit) n++;
      }
      sec.hidden = !n;
      const grid = $('.cat-grid', sec);
      const open = q ? true : catOpen(sec.getAttribute('data-catsec'));
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
        b.title = `${n} im Plan, ${d.inv} im LLR vorhanden`;
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
      const act = e.target.closest('[data-act]');
      if (act) return doAct(act.getAttribute('data-act'));
      const bl = e.target.closest('[data-block]');
      if (bl) return addBlock(bl.getAttribute('data-block'));
      const it = e.target.closest('.cat-item[data-type]');
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
      if (it.hasAttribute('data-block')) e.dataTransfer.setData('text/llr-block', it.getAttribute('data-block'));
      else if (it.hasAttribute('data-type')) e.dataTransfer.setData('text/llr-type', it.getAttribute('data-type'));
      else return e.preventDefault();
      e.dataTransfer.effectAllowed = 'copy';
    });
    const svg = $('#plan');
    svg.addEventListener('dragover', (e) => {
      if (e.dataTransfer.types.includes('text/llr-type') || e.dataTransfer.types.includes('text/llr-block') || e.dataTransfer.types.includes('text/llr-learner')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });
    svg.addEventListener('drop', (e) => {
      const block = e.dataTransfer.getData('text/llr-block');
      if (block) {
        e.preventDefault();
        return addBlock(block, app.toWorld(e.clientX, e.clientY));
      }
      const type = e.dataTransfer.getData('text/llr-type');
      if (!type || !T[type]) return;
      e.preventDefault();
      app.addObject(type, app.toWorld(e.clientX, e.clientY));
    });
  }

  /* ---------- Anordnungen ----------
     Filter nach Sozialform, eigene Vorlagen (js/custom.js) und die
     Anordnungen der Handreichung. */
  function presetCard(p, objs, extra) {
    const n = LLR.presetSeats(p);
    return `<div class="preset-wrap"><button class="preset" data-preset="${esc(p.id)}">${planPreview(objs)}<span><h3>${esc(p.name)}</h3><span class="persons">${esc(p.persons || n + ' Plätze')}</span>${p.persons ? `<span class="seats">${n} Plätze</span>` : ''}<p>${esc(p.note || '')}</p></span></button>${extra || ''}</div>`;
  }

  function renderPresets() {
    const form = panels.form || 'alle';
    let h = `<p class="intro">Sitzordnungen aus der <em>Handreichung zur Anordnung der Tische</em> und eigene Vorlagen. Beim Übernehmen werden Tische, Stühle und Hocker neu gestellt – alles andere bleibt.</p>`;
    h += `<div class="chips" role="group" aria-label="Nach Sozialform filtern">${[{ id: 'alle', name: 'Alle' }].concat(LLR.FORMS).map((f) => `<button type="button" class="chip" data-form="${f.id}" aria-pressed="${form === f.id}">${esc(f.name)}</button>`).join('')}</div>`;
    const own = LLR.custom ? LLR.custom.templates() : [];
    h += `<div class="sub-title">Eigene Anordnungen</div>`;
    if (own.length) for (const t of own) h += presetCard(t, t.build(), `<button class="icon-btn small preset-more" data-tpl="${esc(t.id)}" aria-label="${esc(t.name)}: umbenennen, exportieren, löschen" title="Umbenennen, exportieren, löschen">${icon('i-more')}</button>`);
    else h += `<p class="empty-note">Noch keine eigenen Anordnungen. Stellen Sie Tische und Stühle auf und speichern Sie sie hier als Vorlage.</p>`;
    h += `<div class="btn-row" style="margin:6px 0 10px"><button class="btn outline small" data-act="saveTemplate">${icon('i-save')}Aktuelle Anordnung speichern …</button>${isPro() ? `<button class="btn outline small" data-act="importTemplate">${icon('i-upload')}Aus Datei …</button>` : ''}</div>`;
    h += `<div class="sub-title">Aus der Handreichung</div>`;
    let shown = 0;
    for (const p of LLR.PRESETS) {
      if (form !== 'alle' && !(p.forms || []).includes(form)) continue;
      shown++;
      h += presetCard(p, LLR.colorChairs(p.build(LLR.DEFAULT_SETTINGS, LLR.DEFAULT_ROOM)));
    }
    if (!shown) h += `<p class="empty-note">Keine Anordnung für diese Sozialform.</p>`;
    $('#tab-presets').innerHTML = h;
  }

  async function choosePreset(p) {
    const phases = !!app.doc.phases;
    const v = await openDialog({
      title: p.name,
      body: `<p><strong>${esc(p.name)}</strong> · ${esc(p.persons || LLR.presetSeats(p) + ' Plätze')}${p.page ? ` · Handreichung S. ${p.page}` : ''}</p>${p.note ? `<p class="desc">${esc(p.note)}</p>` : ''}
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
      const from = app.doc.objects;
      app.addPhase(p.id);
      if (panels.anim !== false) app.playTransition(from, app.doc.objects);
      toast(`Neue Phase „${p.name}“ angelegt`);
    } else {
      app.applyPreset(p.id);
      toast(`„${p.name}“ übernommen`);
    }
    if (mobile()) closeDrawers();
  }

  function bindPresets() {
    $('#tab-presets').addEventListener('click', (e) => {
      const f = e.target.closest('[data-form]');
      if (f) {
        panels.form = f.getAttribute('data-form');
        savePanels();
        renderPresets();
        const again = $(`#tab-presets [data-form="${panels.form}"]`);
        if (again) again.focus();
        return;
      }
      const m = e.target.closest('[data-tpl]');
      if (m) {
        if (LLR.custom) LLR.custom.templateMenu(m.getAttribute('data-tpl'), m);
        return;
      }
      const a = e.target.closest('[data-act]');
      if (a) return doAct(a.getAttribute('data-act'));
      const b = e.target.closest('[data-preset]');
      if (!b) return;
      const p = LLR.findPreset(b.getAttribute('data-preset'));
      if (p) choosePreset(p);
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
    const maxSeats = A.rule(app.doc.settings, 'maxSeats');
    let h = `<h2 class="sec-title"><span>Raum<small>Nichts ausgewählt – ein Objekt antippen zeigt seine Details</small></span></h2>
      <div class="field-grid two">
        <label class="field">Breite – Tafelseite (m)<input type="number" data-room="w" value="${(r.w / 100).toFixed(2)}" min="2" max="30" step="0.05"></label>
        <label class="field">Länge (m)<input type="number" data-room="l" value="${(r.l / 100).toFixed(2)}" min="2" max="30" step="0.05"></label>
      </div>
      <p class="desc" style="margin-top:6px">Fläche <strong data-room-area>${app.fmtArea(r.w * r.l)}</strong> · auch im Plan an den Wänden ziehen</p>`;
    if (app.doc.phases) h += `<div class="sub-title">Phase</div><p class="desc">${app.phaseIndex() + 1} von ${app.doc.phases.length}: <strong>${esc(app.phases()[app.phaseIndex()].name)}</strong> · <button class="link-btn" data-act="openPhases">Phasen verwalten</button></p>`;
    h += `<div class="sub-title">Belegung</div><table class="stat-table">
      <tr><td>Arbeitsplätze</td><td><span class="pill ${st.seats > maxSeats ? 'warn' : 'ok'}">${st.seats}</span></td></tr>
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
    if (st.seats > maxSeats) h += row('warn', 'i-alert', `Mehr als ${maxSeats} Arbeitsplätze`, maxSeats === 24 ? 'Die Handreichung empfiehlt höchstens 24 Sitzplätze.' : 'Laut den gewählten Prüfregeln sind es zu viele Plätze.');
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
    h += `<p class="tip">${icon('i-info')}<span>Doppelklick auf einen Tisch wählt die ganze Gruppe samt Stühlen, Rechtsklick (oder lange drücken) zeigt weitere Aktionen. Alles zur Bedienung unter <button class="link-btn" data-act="help">Hilfe</button>.</span></p>`;
    return h;
  }

  function multiProps(objs) {
    const counts = {};
    for (const o of objs) counts[T[o.type].short] = (counts[T[o.type].short] || 0) + 1;
    const locked = objs.filter((o) => o.locked).length;
    const tables = objs.some(A.isTable);
    let h = `<h2 class="sec-title"><span>${objs.length} Objekte ausgewählt<small>${Object.entries(counts).map(([k, v]) => `${v} × ${esc(k)}`).join(', ')}${locked ? ` · ${locked} gesperrt` : ''}</small></span></h2>
      <div class="btn-row"><button class="btn outline small" data-act="rot90">${icon('i-rot90')}90° drehen</button><button class="btn outline small" data-act="dup">${icon('i-copy')}Kopie</button>${tables ? `<button class="btn outline small" data-act="chairs">${icon('i-chair-add')}Stühle anstellen</button>` : ''}<button class="btn outline small" data-act="none">Auswahl aufheben</button></div>`;
    if (!isPro()) return h + `<p class="desc" style="margin-top:8px">Ausrichten, Verteilen und genaue Maße gibt es in der <button class="link-btn" data-act="toggleLevel">Profi-Ansicht</button>.</p>`;
    const bb = app.selBox();
    const units = app.units().length;
    if (bb) {
      h += `<div class="sub-title">Lage der Auswahl</div><div class="field-grid">
        <label class="field">Links (cm)<input type="number" data-msel="x" value="${Math.round(bb.minX)}" step="1"></label>
        <label class="field">Oben (cm)<input type="number" data-msel="y" value="${Math.round(bb.minY)}" step="1"></label>
        <label class="field">Drehen um (°)<input type="number" data-mrot value="" placeholder="z. B. 45" step="15"></label></div>
        <p class="desc" style="margin-top:4px">Größe ${Math.round(bb.maxX - bb.minX)} × ${Math.round(bb.maxY - bb.minY)} cm · ${units} ${units === 1 ? 'Einheit' : 'Einheiten'} (Tischgruppen zählen samt Stühlen als eine)</p>`;
    }
    const tb = (act, ic, label) => `<button class="icon-btn" data-act="${act}" aria-label="${label}" title="${label}">${icon(ic)}</button>`;
    h += `<div class="sub-title">${units === 1 ? 'Im Raum ausrichten' : 'Ausrichten'}</div><div class="tool-row">${tb('align:left', 'i-al-left', 'Links ausrichten')}${tb('align:hcenter', 'i-al-hc', 'Waagerecht mittig')}${tb('align:right', 'i-al-right', 'Rechts ausrichten')}<span class="sep"></span>${tb('align:top', 'i-al-top', 'Oben ausrichten')}${tb('align:vcenter', 'i-al-vc', 'Senkrecht mittig')}${tb('align:bottom', 'i-al-bottom', 'Unten ausrichten')}</div>`;
    h += `<div class="sub-title">Verteilen &amp; Spiegeln</div><div class="tool-row">${tb('dist:x', 'i-dist-h', 'Waagerecht gleichmäßig verteilen (ab 3 Einheiten)')}${tb('dist:y', 'i-dist-v', 'Senkrecht gleichmäßig verteilen (ab 3 Einheiten)')}<span class="sep"></span>${tb('mirror:x', 'i-flip-h', 'Links ↔ rechts spiegeln')}${tb('mirror:y', 'i-flip-v', 'Oben ↔ unten spiegeln')}</div>
      <div class="gap-row"><label class="field">Abstand zwischen den Einheiten (cm)<input type="number" id="m-gap" value="${panels.gap || 90}" min="0" max="1000" step="5"></label><button class="btn outline small" data-act="distgap:x" title="Nebeneinander mit diesem Abstand">${icon('i-dist-h')}nebeneinander</button><button class="btn outline small" data-act="distgap:y" title="Untereinander mit diesem Abstand">${icon('i-dist-v')}untereinander</button></div>`;
    if (objs.some((o) => A.isTable(o) || A.isSeat(o))) h += `<div class="btn-row"><button class="btn outline small" data-act="saveTemplate">${icon('i-save')}Als Vorlage speichern …</button></div>`;
    return h;
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
        h += `<div class="field-grid two"><label class="field">${d.kind === 'dim' ? 'Länge' : 'Breite'} (cm)<input type="number" data-k="w" value="${Math.round(o.w)}" min="${ms.w}" max="2000" step="${d.kind === 'dim' ? 1 : 5}" ${o.locked ? 'disabled' : ''}></label>`;
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
    if (A.isTable(o)) h += `<div class="btn-row"><button class="btn outline small block" data-act="group">${icon('i-multi')}Ganze Tischgruppe mit Stühlen auswählen</button></div><div class="btn-row" style="margin-top:6px"><button class="btn outline small" data-act="chairs">${icon('i-chair-add')}Stühle anstellen</button><button class="btn outline small" data-act="chairsDel">${icon('i-chair-del')}Stühle wegnehmen</button></div>`;
    if (o.type === 'partition') h += `<div class="btn-row"><button class="btn outline small block" data-act="group">${icon('i-multi')}Alle verbundenen Trennwände auswählen</button></div>`;
    // Prüfungen für dieses Objekt
    const checks = objectChecks(o);
    if (checks) h += `<div class="sub-title">Prüfen</div><div class="mini-checks">${checks}</div>`;
    const why = app.problems.get(o.id);
    if (why) h += row('bad', 'i-alert', `${why.has('out') ? 'Ragt aus dem Raum heraus. ' : ''}${why.has('overlap') ? 'Überschneidet sich mit einem anderen Objekt.' : ''}`);
    // Position (selten gebraucht, daher eingeklappt; nur in der Profi-Ansicht)
    if (!isPro()) return h;
    h += `<details class="more" data-pos ${panels.pos ? 'open' : ''}><summary>Position &amp; Drehung</summary><div class="field-grid">
      <label class="field">X (cm)<input type="number" data-k="x" value="${Math.round(o.x)}" step="1" ${o.locked ? 'disabled' : ''}></label>
      <label class="field">Y (cm)<input type="number" data-k="y" value="${Math.round(o.y)}" step="1" ${o.locked ? 'disabled' : ''}></label>
      <label class="field">Drehung (°)<input type="number" data-k="rot" value="${Math.round(o.rot || 0)}" step="15" ${o.locked || d.wall ? 'disabled' : ''}></label></div>
      <label class="toggle"><input type="checkbox" data-opt="locked" ${o.locked ? 'checked' : ''}><span>Gesperrt<small>gegen versehentliches Verschieben</small></span></label></details>`;
    return h;
  }

  /* Kurz-Prüfungen am ausgewählten Objekt; ein Klick zeigt die Prüfung im Plan */
  function mini(lens, gl, title, txt, small) {
    return miniRow(lens, gl, title, txt, small);
  }
  function miniRow(lens, gl, title, txt, small) {
    return `<button class="mini-row${app.overlay[lens] ? ' on' : ''}" data-mini="${lens}" title="${app.overlay[lens] ? 'Im Plan aktiv' : 'Im Plan zeigen'}">${gl}<span class="txt"><b>${title}</b>${txt}${small ? `<small>${small}</small>` : ''}</span></button>`;
  }

  function objectChecks(o) {
    let h = '';
    const pro = isPro();
    const T_SIGHT = pro ? 'Sicht auf Tafel & Bildschirme' : 'Sieht man von hier die Tafel?';
    if (A.isTable(o) || o.type === 'wheelchair') h += accessMini(o);
    if (!A.isSeat(o)) return h;
    // Sicht
    const cone = A.sightCone(app.doc, o.id);
    if (cone && cone.views.length) {
      const sum = { good: 'Direkter Blick', side: 'Kopf seitlich drehen', person: 'Person im Blickfeld', back: 'Kein Blick: abgewandt', none: 'Kein Blick: verdeckt' }[cone.cat];
      const b = cone.best;
      h += mini('sight', glyph(cone.cat), T_SIGHT, sum, b ? `beste Sicht: ${esc(b.s.name)}, ${m1(b.dist)}${cone.free || !pro ? '' : `, ${Math.round(b.ang)}°`}` : '');
    } else h += mini('sight', glyph('none'), T_SIGHT, 'Keine Präsentationsfläche vor diesem Platz');
    // Lehrkraft
    const t = app.getTeacher();
    const ts = t.seats.find((x) => x.id === o.id);
    if (ts) {
      const eye = { face: 'sieht das Gesicht', profile: 'sieht das Profil', back: 'sieht nur den Rücken', blocked: 'Sicht verdeckt' }[ts.eye.kind];
      let walk = 'nicht erreichbar';
      if (ts.reach) walk = `Weg ${m1(ts.walk)}${ts.reach.squeeze ? ' durch eine Engstelle' : ''}${ts.reach.across ? ', nur über den Tisch' : ''}`;
      h += mini('teacher', tglyph(ts.cat), pro ? 'Lehrkraft' : 'Kommt die Lehrkraft hierher?', `${walk}`, `Lehrkraft ${eye}`);
    }
    // Ruhe
    const c = app.getCalm();
    const cs = c.seats.find((x) => x.id === o.id);
    if (cs) {
      const label = { calm: 'Ruhiger Platz', mid: 'Mittlere Unruhe', busy: 'Unruhiger Platz' }[cs.cat];
      const top = cs.factors.filter((x) => x.pts > 0).slice(0, 3).map((x) => x.label + (x.detail ? ` (${x.detail})` : '')).join(' · ');
      const quiet = cs.factors.find((x) => x.key === 'quiet');
      h += mini('calm', cglyph(cs.cat), pro ? 'Ruhe & Reize' : 'Ist es hier ruhig?', pro ? `${label} · ${cs.score} von 100` : label, (top || 'keine Störquellen in der Nähe') + (quiet ? ' · in einer Ruhezone' : ''));
    }
    // Bedarfe der Person auf dem Platz
    if (o.learner && LLR.classUI) h += LLR.classUI.seatChecks(o);
    return h;
  }

  function accessMini(o) {
    const a = app.access;
    const mini = (lens, gl, title, txt, small) => miniRow(lens, gl, isPro() ? title : o.type === 'wheelchair' ? 'Kommt der Rollstuhl von der Tür hierher?' : 'Kommt ein Rollstuhl an diesen Tisch?', txt, small);
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
    if (objs.length > 1) {
      const bb = app.selBox();
      if (bb) {
        set('[data-msel="x"]', Math.round(bb.minX));
        set('[data-msel="y"]', Math.round(bb.minY));
      }
      return;
    }
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
      if (t.hasAttribute('data-msel') || t.hasAttribute('data-mrot') || t.id === 'm-gap') {
        const v = parseFloat(String(t.value).replace(',', '.'));
        if (t.id === 'm-gap') {
          if (isFinite(v)) panels.gap = Math.max(0, Math.min(1000, v));
          savePanels();
          return;
        }
        if (!isFinite(v)) return;
        if (t.hasAttribute('data-mrot')) app.rotateSelected(v);
        else if (t.getAttribute('data-msel') === 'x') app.moveSelTo(v, null);
        else app.moveSelTo(null, v);
        t.blur();
        renderProps();
        return;
      }
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

  /* Aktionsknöpfe (Panel, Schnellleiste, Menüs, Kontextmenü, Befehlssuche) */
  function doAct(act, src) {
    const S = app.doc.settings;
    if (act === 'rotl') app.rotateSelected(-(S.angleSnap || 15));
    else if (act === 'rotr') app.rotateSelected(S.angleSnap || 15);
    else if (act === 'rot90') app.rotateSelected(90);
    else if (act === 'rot90l') app.rotateSelected(-90);
    else if (act === 'rot180') app.rotateSelected(180);
    else if (act === 'dup') app.duplicateSelected();
    else if (act === 'copy') {
      app.copy();
      toast('Kopiert – mit Strg+V oder „Einfügen“ wieder einsetzen.');
    } else if (act === 'paste') app.paste();
    else if (act === 'del') app.deleteSelected();
    else if (act === 'lock') app.toggleLock();
    else if (act === 'none') app.clearSelection();
    else if (act === 'selectAll') app.select(app.doc.objects.filter((o) => !o.locked).map((o) => o.id));
    else if (act === 'group') {
      const o = app.selectedObjects()[0];
      if (o) app.selectGroup(o.id);
    } else if (act === 'chairs') {
      const n = app.attachChairs();
      const c = app.stats().count.chair || 0;
      toast(n ? `${n} ${n === 1 ? 'Stuhl' : 'Stühle'} angestellt${c > 19 ? ` – jetzt ${c} Stühle im Plan (im LLR: 19)` : ''}.` : 'Keine freie Tischkante – dort stehen schon Stühle oder es ist zu eng.');
    } else if (act === 'chairsDel') {
      const n = app.removeChairs();
      toast(n ? `${n} ${n === 1 ? 'Stuhl' : 'Stühle'} weggenommen.` : 'An diesen Tischen stehen keine Stühle.');
    } else if (act.startsWith('align:')) {
      if (!app.alignSel(act.slice(6))) toast('Erst Objekte auswählen.');
    } else if (act.startsWith('dist:')) {
      if (!app.distributeSel(act.slice(5))) toast('Zum gleichmäßigen Verteilen mindestens drei Tischgruppen oder Objekte auswählen.');
    } else if (act.startsWith('distgap:')) {
      const i = $('#m-gap');
      const g = i ? parseFloat(String(i.value).replace(',', '.')) : panels.gap || 90;
      if (isFinite(g)) panels.gap = g;
      savePanels();
      if (!app.distributeSel(act.slice(8), isFinite(g) ? g : 90)) toast('Mindestens zwei Tischgruppen oder Objekte auswählen.');
    } else if (act.startsWith('mirror:')) app.mirrorSel(act.slice(7));
    else if (act === 'carry') {
      const on = !S.carryChairs;
      app.setPref('carryChairs', on);
      toast(on ? 'Angestellte Stühle wandern jetzt mit dem Tisch mit.' : 'Stühle bleiben stehen, wenn ein Tisch bewegt wird.');
    } else if (act === 'settings') openSettings();
    else if (act === 'a11y') openSettings('darstellung');
    else if (act === 'rules') openSettings('regeln');
    else if (act === 'details') showDetails();
    else if (act === 'wheelchair') addWheelchair();
    else if (act === 'addTeacher') addTeacher();
    else if (act === 'addDoor') {
      app.addObject('door', { x: app.doc.room.w, y: 120 });
      toast('Tür an der rechten Wand eingefügt – an der Wand entlang verschieben.');
    } else if (act === 'addQuiet') {
      app.addObject('zone', null, { label: 'Ruhezone', color: 'gruen' });
      toast('Ruhezone eingefügt – über die ruhigen Plätze ziehen und die Größe anpassen.');
    } else if (act === 'selWheel') {
      app.select(app.doc.objects.filter((o) => o.type === 'wheelchair').map((o) => o.id));
      if (mobile()) closeDrawers();
    } else if (act === 'delWheel') {
      app.mutate((d) => (d.objects = d.objects.filter((o) => o.type !== 'wheelchair')));
      app.sel = new Set([...app.sel].filter((id) => app.byId(id)));
      app.emit('select');
      toast('Test-Rollstühle entfernt');
    } else if (act.startsWith('mark:')) markSeats(act.slice(5));
    else if (act.startsWith('lens:')) setLens(act.slice(5) === 'none' ? null : act.slice(5));
    else if (act === 'help') openHelp();
    else if (act === 'showProblems') app.select([...app.problems.keys()]);
    else if (act === 'new') openNew();
    else if (act === 'plans') openPlans();
    else if (act === 'savePlan') quickSave();
    else if (act === 'export') exportPNG();
    else if (act === 'print') printPlan('plan');
    else if (act === 'printRebuild') printPlan('rebuild');
    else if (act === 'printSeating') printPlan('seating');
    else if (act === 'share') openShare();
    else if (act === 'openPhases') openLibTab('phases');
    else if (act === 'openLearners') openLibTab('learners');
    else if (act.startsWith('tab:')) openLibTab(act.slice(4));
    else if (act === 'toggleLevel') setLevel(isPro() ? 'einfach' : 'profi');
    else if (act === 'levelSimple') setLevel('einfach');
    else if (act === 'levelPro') setLevel('profi');
    else if (act === 'keepMeasure') {
      if (app.keepMeasure()) toast('Maßlinie in den Plan übernommen – sie wird mitgedruckt.');
    } else if (act === 'measure') app.setMode(app.mode === 'measure' ? 'select' : 'measure');
    else if (act === 'multi') {
      app.multi = !app.multi;
      if (app.multi) app.setMode('select');
      syncTools();
    } else if (act === 'fit') app.fitView();
    else if (act === 'zoomIn') app.zoomBy(1 / 1.3);
    else if (act === 'zoomOut') app.zoomBy(1.3);
    else if (act === 'undo') app.undo();
    else if (act === 'redo') app.redo();
    else if (act === 'grid' || act === 'dims' || act === 'roomDims') app.setOverlay(act, !app.overlay[act]);
    else if (act === 'snap' || act === 'gridSnap') {
      app.setPref(act, !S[act]);
      toast(act === 'snap' ? (S.snap ? 'Magnetisches Einrasten an' : 'Magnetisches Einrasten aus') : S.gridSnap ? 'Am Raster einrasten an' : 'Am Raster einrasten aus');
    } else if (act.startsWith('block:')) addBlock(act.slice(6));
    else if (act.startsWith('add:')) {
      app.addObject(act.slice(4));
      if (mobile()) closeDrawers();
    } else if (act.startsWith('preset:')) {
      const p = LLR.findPreset(act.slice(7));
      if (p) choosePreset(p);
    } else if (act === 'nextPhase' || act === 'prevPhase') {
      if (app.doc.phases) app.setPhase(app.phaseIndex() + (act === 'nextPhase' ? 1 : -1), { animate: panels.anim !== false });
    } else if (act === 'nextObj' || act === 'prevObj') {
      const o = app.selectNext(act === 'nextObj' ? 1 : -1);
      if (o) ensureVisible(o);
    } else if (LLR.assist && LLR.assist.act(act, src)) return;
    else if (LLR.custom && LLR.custom.act(act, src)) return;
    else if (LLR.commands && LLR.commands.act(act, src)) return;
    else if (LLR.classUI && LLR.classUI.act) LLR.classUI.act(act);
  }

  /* Plätze mit einem bestimmten Prüfergebnis auswählen („Was kann ich tun?“) */
  function markSeats(kind) {
    let ids = [];
    let lens = null;
    if (kind === 'noSight' || kind === 'turnSight') {
      lens = 'sight';
      ids = app.getSight().seats.filter((x) => (kind === 'noSight' ? x.cat === 'back' || x.cat === 'none' : x.cat === 'side' || x.cat === 'person')).map((x) => x.id);
    } else if (kind === 'noReach' || kind === 'backTeacher') {
      lens = 'teacher';
      ids = app.getTeacher().seats.filter((x) => (kind === 'noReach' ? !x.reach || x.cat === 'none' : x.eye && x.eye.kind === 'back')).map((x) => x.id);
    } else if (kind === 'busy') {
      lens = 'calm';
      ids = app.getCalm().seats.filter((x) => x.cat === 'busy').map((x) => x.id);
    }
    if (lens && !app.overlay[lens]) app.setLens(lens);
    if (!ids.length) return toast('Keine solchen Plätze.');
    app.select(ids);
    toast(`${ids.length} ${ids.length === 1 ? 'Platz' : 'Plätze'} markiert – im Plan blau umrandet.`);
  }

  /* Strg+S: Plan unter seinem Namen im Browser speichern */
  function quickSave() {
    const name = app.doc.name || 'Raumplan';
    const list = loadPlans();
    const existing = list.find((p) => p.name === name);
    const entry = { id: existing ? existing.id : LLR.newId(), name, date: Date.now(), doc: JSON.parse(app.serialize()) };
    const next = existing ? list.map((p) => (p.id === existing.id ? entry : p)) : list.concat(entry);
    if (storePlans(next)) toast(`„${name}“ ${existing ? 'aktualisiert' : 'gespeichert'} (Datei → Pläne)`);
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
  const LEVEL_TXT = ['gut', 'mit Einschränkungen', 'Problem'];
  function lensCard(key, ic, title, summary, level, body) {
    const on = !!app.overlay[key];
    const state = level >= 0 ? `Ergebnis: ${LEVEL_TXT[level]}` : '';
    return `<section class="lens-card${on ? ' on' : ''}" data-card="${key}">
      <button type="button" class="lens-head" data-lens-toggle="${key}" aria-expanded="${on}" title="${on ? 'Im Plan ausblenden' : 'Im Plan zeigen'}">
        <span class="lens-ic">${icon(ic)}</span><span class="lens-title">${title}<small>${summary}</small></span>${on ? '<span class="lens-state">im Plan</span>' : dot(level)}${state ? `<span class="visually-hidden">${state}</span>` : ''}
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
    const R = A.currentRules(app.doc.settings);
    h += `<label class="toggle"><input type="checkbox" data-pref="sightPersons" ${s.persons ? 'checked' : ''}><span>Sitzende Personen im Blickfeld berücksichtigen<small>Ein Kopf (ca. ${2 * A.PERSON_R} cm breit) verdeckt je nach Abstand den unteren Teil der Fläche (Augenhöhe ${app.fmtM(H.eye)}, Fläche ${app.fmtM(H.low)}–${app.fmtM(H.top)}). Ab ${R.personLimit} % gilt die Sicht als eingeschränkt.</small></span></label>`;
    h += `<p class="desc">Direkter Blick bis ${R.sightDirect}° Kopfdrehung, mit gedrehtem Kopf bis ${R.sightSide}°.</p>`;
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
    const R = A.currentRules(app.doc.settings);
    h += `<p class="callout">Bewertet werden: Nähe zur Tür (bis ${R.wDoor} Punkte) und zur Lounge (${R.wLounge}), Laufwege anderer am Platz vorbei (${R.wTraffic}), viele Nachbarplätze (${R.wCrowd}), Blick aus dem Fenster (${R.wWindow}) und Spiegelungen (${R.wGlare}). Ruhig unter ${R.calmMax}, unruhig ab ${R.busyMin} Punkten. Regale und Trennwände dämpfen Tür und Lounge; Plätze in einer Zone „Ruhezone“ oder „Rückzug“ gelten als ruhiger (−${R.wQuiet}). <strong>Sitzplatz antippen</strong> zeigt die Gründe.</p>`;
    return h;
  }

  /* Prüfungen als Fragen (Einfach-Ansicht) */
  const QUESTIONS = {
    access: 'Kommt ein Rollstuhl überall hin?',
    sight: 'Sehen alle die Tafel?',
    teacher: 'Komme ich als Lehrkraft an jeden Platz?',
    calm: 'Wo ist es ruhig, wo unruhig?',
    seating: 'Passt der Sitzplan zu den Bedarfen?',
    rebuild: 'Wie aufwendig ist der Umbau?',
  };
  LLR.QUESTIONS = QUESTIONS;
  const plural = (n, one, more) => `${n} ${n === 1 ? one : more}`;

  /* Ergebnis jeder Prüfung: Stufe (0 gut, 1 eingeschränkt, 2 Problem, −1 nichts
     zu prüfen), Zusammenfassung mit Zahlen (Profi) und Antwort (Einfach) */
  function checkResults() {
    const S = app.doc.settings;
    const out = {};
    const a = app.access;
    let lv = -1;
    let sum = `Durchgang ${S.passage} cm · Wenden Ø ${S.turning} cm`;
    let ans = 'Wird geprüft …';
    if (a && !a.hasDoor) (lv = 2), (sum = 'Keine Tür im Plan'), (ans = 'Das lässt sich nicht sagen – im Plan ist keine Tür.');
    else if (a && !a.doorOk) (lv = 2), (sum = 'Tür nicht befahrbar'), (ans = 'Nein – direkt hinter der Tür ist es zu eng.');
    else if (a) {
      sum = `${a.tablesNow} ${a.tablesNow === 1 ? 'Tisch' : 'Tische'} mit Rollstuhlplatz${a.complete && a.tablesLater ? ` (+${a.tablesLater} nach Stuhl wegstellen)` : ''}${a.turnPossible ? '' : ' · kein Wenden'}`;
      lv = !a.turnPossible || (!a.tablesNow && !a.tablesLater) ? 2 : a.tablesNow ? 0 : 1;
      if (a.tablesNow) ans = `Ja – an ${plural(a.tablesNow, 'Tisch', 'Tischen')} ist ein Rollstuhlplatz von der Tür aus erreichbar.`;
      else if (a.tablesLater) ans = 'Fast – erst muss ein Stuhl weggestellt werden.';
      else ans = a.complete ? 'Nein – kein Tisch ist mit dem Rollstuhl erreichbar.' : 'Wird geprüft …';
      if (!a.turnPossible) ans += ' Zum Wenden ist nirgends genug Platz.';
    }
    out.access = { lv, sum, ans };
    const sg = app.getSight();
    if (!sg.seats.length) out.sight = { lv: -1, sum: 'Keine Sitzplätze im Plan', ans: 'Es gibt noch keine Sitzplätze.' };
    else if (!sg.surfaces.length) out.sight = { lv: 2, sum: 'Keine Präsentationsfläche im Plan', ans: 'Im Plan ist keine Tafel, kein Bildschirm und keine Beamer-Fläche.' };
    else
      out.sight = {
        lv: sg.back ? 2 : sg.limited ? 1 : 0,
        sum: `${sg.good} direkt · ${sg.limited} eingeschränkt · ${sg.back} ohne Blick`,
        ans: sg.back ? `Nicht alle – ${plural(sg.back, 'Platz hat', 'Plätze haben')} keinen Blick auf Tafel oder Bildschirm.` : sg.limited ? `Ja – ${sg.limited} von ${sg.seats.length} müssen dafür aber den Kopf drehen oder an jemandem vorbeischauen.` : 'Ja – alle sehen direkt nach vorn.',
      };
    const t = app.getTeacher();
    if (!t.seats.length) out.teacher = { lv: -1, sum: 'Keine Sitzplätze im Plan', ans: 'Es gibt noch keine Sitzplätze.' };
    else {
      const miss = t.seats.length - t.reachable;
      out.teacher = {
        lv: miss || t.hidden ? 2 : t.back || t.tight || t.across ? 1 : 0,
        sum: `${t.reachable}/${t.seats.length} erreichbar · ${t.face} Gesichter im Blick`,
        ans: miss ? `Nicht überall – ${plural(miss, 'Platz ist', 'Plätze sind')} nicht erreichbar.` : t.back ? `Ja – aber ${plural(t.back, 'Person sitzt', 'Personen sitzen')} mit dem Rücken zu Ihnen.` : t.tight || t.across ? `Ja – zu ${t.tight + t.across} Plätzen allerdings nur durch Engstellen oder über den Tisch.` : 'Ja – zu allen Plätzen, und Sie sehen die Gesichter.',
      };
    }
    const c = app.getCalm();
    if (!c.seats.length) out.calm = { lv: -1, sum: 'Keine Sitzplätze im Plan', ans: 'Es gibt noch keine Sitzplätze.' };
    else out.calm = { lv: c.busy ? 2 : c.calm ? 0 : 1, sum: `${c.calm} ruhig · ${c.mid} mittel · ${c.busy} unruhig`, ans: c.busy ? `${plural(c.busy, 'Platz ist', 'Plätze sind')} unruhig, ${c.calm} ruhig.` : c.calm ? `Kein unruhiger Platz – ${plural(c.calm, 'Platz ist', 'Plätze sind')} ruhig.` : 'Alle Plätze haben eine mittlere Unruhe.' };
    return out;
  }

  /* „Was hilft?“ – kurze Hinweise und Knöpfe (Einfach-Ansicht) */
  function helpBody(key, res) {
    const b = (act, ic, label) => `<button class="btn outline small" data-act="${act}">${icon(ic)}${label}</button>`;
    let tips = [];
    let btns = '';
    if (key === 'access') {
      const a = app.access;
      if (a && !a.hasDoor) btns += b('addDoor', 'i-plus', 'Tür einfügen');
      tips = ['Zwischen Tischgruppen und Wand mindestens 90 cm frei lassen.', 'Einen Tisch antippen: Der Weg von der Tür erscheint im Plan.'];
      btns += b('wheelchair', 'i-wheelchair', 'Test-Rollstuhl ausprobieren');
    } else if (key === 'sight') {
      tips = ['Stühle zur Tafel drehen oder auch Bildschirm und Beamer-Fläche nutzen.', 'Einen Platz antippen zeigt, was er sieht.'];
      if (res.lv === 2) btns += b('mark:noSight', 'i-eye', 'Plätze ohne Blick zeigen');
      if (res.lv >= 1) btns += b('mark:turnSight', 'i-eye', 'Plätze mit Kopfdrehung zeigen');
    } else if (key === 'teacher') {
      tips = ['Gänge von mindestens 50 cm zwischen den Gruppen lassen.', 'Standort ändern: eine Lehrkraft-Position einfügen und verschieben.'];
      if (res.lv === 2) btns += b('mark:noReach', 'i-teacher', 'Nicht erreichbare Plätze zeigen');
      btns += b('addTeacher', 'i-plus', 'Lehrkraft-Position einfügen');
    } else if (key === 'calm') {
      tips = ['Ruhige Plätze liegen weg von Tür und Lounge.', 'Regale oder Trennwände dazwischen dämpfen; eine Zone „Ruhezone“ zählt als ruhig.'];
      if (res.lv === 2) btns += b('mark:busy', 'i-leaf', 'Unruhige Plätze zeigen');
      btns += b('addQuiet', 'i-plus', 'Ruhezone einzeichnen');
    }
    return `<p class="answer">${esc(res.ans)}</p><div class="sub-title">Was hilft?</div><ul class="help-tips">${tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${btns ? `<div class="btn-row">${btns}</div>` : ''}`;
  }

  function renderChecks() {
    const box = $('#checks');
    if (box.hidden && !mobile()) {
      updateChecksBadge();
      return;
    }
    const pro = isPro();
    const res = checkResults();
    let h = '';
    if (pro) {
      const S = app.doc.settings;
      const prof = LLR.custom ? LLR.custom.profileName(S) : 'Standard';
      h += `<p class="checks-intro">Eine Prüfung antippen zeigt sie im Plan – immer eine zur Zeit. Prüfregeln: <button class="link-btn" data-act="rules">${esc(prof)}</button></p>`;
      h += lensCard('access', 'i-wheelchair', 'Rollstuhl-Check', res.access.sum, res.access.lv, accessBody);
      h += lensCard('sight', 'i-eye', 'Sicht auf Tafel & Bildschirme', res.sight.sum, res.sight.lv, () => sightBody(app.getSight()));
      h += lensCard('teacher', 'i-teacher', 'Lehrkraft: Wege & Blickkontakt', res.teacher.sum, res.teacher.lv, () => teacherBody(app.getTeacher()));
      h += lensCard('calm', 'i-leaf', 'Ruhe & Reize', res.calm.sum, res.calm.lv, () => calmBody(app.getCalm()));
    } else {
      const issues = ['access', 'sight', 'teacher', 'calm'].filter((k) => res[k].lv >= 1);
      const bad = issues.filter((k) => res[k].lv === 2).length;
      h += `<div class="check-summary ${bad ? 'bad' : issues.length ? 'warn' : 'ok'}">${icon(issues.length ? 'i-alert' : 'i-check')}<span><strong>${issues.length ? plural(issues.length, 'Frage braucht', 'Fragen brauchen') + ' Aufmerksamkeit' : 'Alles in Ordnung'}</strong><small>Eine Frage antippen zeigt die Antwort im Plan.</small></span></div>`;
      h += lensCard('access', 'i-wheelchair', QUESTIONS.access, res.access.ans, res.access.lv, () => helpBody('access', res.access));
      h += lensCard('sight', 'i-eye', QUESTIONS.sight, res.sight.ans, res.sight.lv, () => helpBody('sight', res.sight));
      h += lensCard('teacher', 'i-teacher', QUESTIONS.teacher, res.teacher.ans, res.teacher.lv, () => helpBody('teacher', res.teacher));
      h += lensCard('calm', 'i-leaf', QUESTIONS.calm, res.calm.ans, res.calm.lv, () => helpBody('calm', res.calm));
    }
    // Sitzplan & Umbau (js/ui-class.js)
    if (LLR.classUI) h += LLR.classUI.checkCards(lensCard, !pro);
    // Überschneidungen
    const probs = app.problems.size;
    if (probs) h += `<div class="check-row bad">${icon('i-alert')}<span class="txt">${pro ? `${probs} Objekt(e) überschneiden sich oder ragen aus dem Raum` : `${plural(probs, 'Möbelstück steht', 'Möbelstücke stehen')} ineinander oder ragt aus dem Raum`}<br><button class="btn outline small" data-act="showProblems">Markieren</button></span></div>`;
    else h += `<div class="check-row ok">${icon('i-check')}<span class="txt">${pro ? 'Keine Überschneidungen' : 'Nichts steht ineinander'}</span></div>`;
    rerender(box, h);
    updateChecksBadge();
  }
  LLR.checkResults = checkResults;

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
      const P = LLR.prefs.pal();
      const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
      h += `<strong>Rollstuhl</strong>` + sw(`background:${rgba(P.free, 0.55)}`, `befahrbar (≥ ${S.passage} cm)`) + sw(`background:${rgba(P.turn, 0.75)}`, `Wenden möglich (Ø ${S.turning} cm)`) + sw(`background:${rgba(P.blocked, 0.55)}`, 'frei, aber zu eng / nicht erreichbar') + sw('background:#1F6FEB', 'Rollstuhlplatz am Tisch (gestrichelt: erst Stuhl wegstellen)', 'round') + sw('color:#1F6FEB', 'Weg von der Tür (Tisch antippen)', 'line');
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
  const LENS_TITLES = {
    access: 'Rollstuhl-Check: befahrbare Flächen und Rollstuhlplätze',
    sight: 'Sicht auf Tafel & Bildschirme',
    teacher: 'Lehrkraft-Check: Laufwege und Blickkontakt',
    calm: 'Reiz- & Ruhe-Check: ruhige und unruhige Plätze',
  };
  function syncTools() {
    const pro = isPro();
    for (const b of $$('.tool[data-mode]')) b.setAttribute('aria-pressed', String(app.mode === b.getAttribute('data-mode') && !(app.multi && app.mode === 'select' && b.getAttribute('data-mode') === 'select')));
    $('#tool-multi').setAttribute('aria-pressed', String(app.multi));
    for (const b of $$('.tool[data-lens]')) {
      const k = b.getAttribute('data-lens');
      b.setAttribute('aria-pressed', String(!!app.overlay[k]));
      b.title = pro ? LENS_TITLES[k] : QUESTIONS[k];
    }
    for (const b of $$('.level-seg [data-level]')) b.setAttribute('aria-checked', String((b.getAttribute('data-level') === 'profi') === pro));
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
      const has = app.measure && G.dist(app.measure.a, app.measure.b) >= 5;
      if (has) hint.innerHTML = `<span>Gemessen: <strong>${Math.round(G.dist(app.measure.a, app.measure.b))} cm</strong> – neue Linie ziehen oder Esc</span><button class="x" data-hint="keep" title="Als Maßlinie im Plan behalten (Eingabetaste)">Behalten</button>`;
      else hint.textContent = 'Linie ziehen zum Messen · rastet an Kanten ein (Alt = frei, Umschalt = 45°)';
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
      const z = LLR.prefs.zoom();
      const st = $('#stage').getBoundingClientRect();
      const br = btn.getBoundingClientRect();
      const pw = pop.getBoundingClientRect().width;
      pop.style.top = Math.round((br.bottom - st.top + 8) / z) + 'px';
      pop.style.left = Math.round(Math.max(8, Math.min(br.left - st.left, st.width - pw - 8)) / z) + 'px';
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
      const lv = menu.querySelector('[data-act="toggleLevel"]');
      lv.setAttribute('aria-checked', String(isPro()));
      lv.querySelector('[data-level-state]').textContent = isPro() ? 'an' : 'aus';
      const br = btn.getBoundingClientRect();
      menu.style.right = Math.max(8, Math.round((window.innerWidth - br.right) / LLR.prefs.zoom())) + 'px';
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
      if (b) doAct(b.getAttribute('data-act'), b);
    });
    for (const b of $$('.level-seg [data-level]')) b.addEventListener('click', () => setLevel(b.getAttribute('data-level')));
    $('.level-seg').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      setLevel(isPro() ? 'einfach' : 'profi');
      $(`.level-seg [data-level="${isPro() ? 'profi' : 'einfach'}"]`).focus();
    });
    $('#stage-hint').addEventListener('click', (e) => {
      if (e.target.closest('[data-hint="cancel"]')) app.emit('place', null);
      if (e.target.closest('[data-hint="keep"]')) doAct('keepMeasure');
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
        const vis = tabs.filter((x) => x.offsetParent !== null);
        const i = vis.indexOf(b);
        const n = vis[(i + (e.key === 'ArrowDown' ? 1 : vis.length - 1)) % vis.length];
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
    // frisches Element: Ereignis-Handler des vorigen Dialogs fallen weg
    const old = $('#dlg-body');
    const body = old.cloneNode(false);
    old.replaceWith(body);
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
    dlg.style.width = opts.wide ? 'min(720px, calc((100vw - 24px) / var(--ui-zoom)))' : '';
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

  /* Neuer Plan: LLR, ein anderer Raum (auch eigene Raumvorlagen) oder leer */
  function emptyRoomObjects(room) {
    const W = room.w;
    const L = room.l;
    const mk = LLR.presetHelpers.mk;
    const out = [mk('door', W, Math.min(150, L - 80), -90, { w: 100 })];
    const n = Math.max(1, Math.floor((L - 60) / 190));
    for (let i = 0; i < n; i++) out.push(mk('window', 0, (L / n) * (i + 0.5), 90, { w: Math.min(170, L / n - 20) }));
    return out;
  }

  async function openNew() {
    const hasL = app.learners().length > 0;
    const own = LLR.custom ? LLR.custom.rooms() : [];
    const opt = (r) => `<option value="${esc(r.id)}">${esc(r.name)}${r.desc ? ' – ' + esc(r.desc) : ''}</option>`;
    const R = app.doc.room;
    const v = await openDialog({
      title: 'Neuer Plan',
      body: `<p>Womit möchten Sie beginnen? Der aktuelle Plan wird ersetzt (Rückgängig mit <span class="kbd">Strg</span>+<span class="kbd">Z</span> möglich; vorher ggf. unter „Pläne“ speichern).</p>
        <label class="toggle"><input type="radio" name="newkind" value="seminar1" checked><span>LLR wie eingerichtet<small>Seminarsitzordnung I mit der festen Einrichtung</small></span></label>
        <label class="toggle"><input type="radio" name="newkind" value="furnished"><span>LLR ohne Tische &amp; Stühle<small>nur die feste Einrichtung</small></span></label>
        <label class="toggle"><input type="radio" name="newkind" value="room"><span>Anderer Raum<small><select id="new-room" aria-label="Raum wählen">${LLR.ROOMS.filter((r) => r.id !== 'llr').map(opt).join('')}${own.length ? `<optgroup label="Eigene Räume">${own.map(opt).join('')}</optgroup>` : ''}</select></small></span></label>
        <label class="toggle"><input type="radio" name="newkind" value="empty"><span>Leerer Raum mit Tür und Fenstern<small class="inline-fields"><input type="number" id="new-w" value="${(R.w / 100).toFixed(2)}" min="2" max="30" step="0.05" aria-label="Breite (Tafelseite) in Metern"> × <input type="number" id="new-l" value="${(R.l / 100).toFixed(2)}" min="2" max="30" step="0.05" aria-label="Länge in Metern"> m</small></span></label>
        ${hasL ? `<label class="toggle" style="margin-top:6px"><input type="checkbox" id="new-keep-l" checked><span>Lernendenliste behalten<small>${app.learners().length} Lernende mit ihren Bedarfen (ohne Sitzplätze)</small></span></label>` : ''}
        ${isPro() ? `<p class="desc">Eigene Räume legen Sie unter „Raum &amp; Einstellungen → Raum“ an.</p>` : ''}`,
      buttons: [
        { label: 'Abbrechen', value: 'cancel' },
        { label: 'Neu anlegen', value: 'ok', cls: 'primary' },
      ],
      onOpen: (b) => {
        b._kind = () => (b.querySelector('input[name=newkind]:checked') || {}).value;
        const pick = (val) => (b.querySelector(`input[name=newkind][value="${val}"]`).checked = true);
        $('#new-room').addEventListener('change', () => pick('room'));
        $('#new-room').addEventListener('focus', () => pick('room'));
        for (const id of ['#new-w', '#new-l']) $(id).addEventListener('focus', () => pick('empty'));
      },
    });
    if (v !== 'ok') return;
    const kind = $('#dlg-body')._kind();
    const keepL = hasL && $('#new-keep-l') && $('#new-keep-l').checked;
    const doc = app.createDoc(null);
    doc.settings = Object.assign({}, app.doc.settings);
    if (kind === 'seminar1' || kind === 'furnished') {
      doc.room = Object.assign({}, app.doc.room);
      doc.objects = LLR.roomFurniture(doc.room);
      if (kind === 'seminar1') {
        doc.objects = doc.objects.concat(app.buildPreset(LLR.PRESETS[0], doc));
        doc.name = LLR.PRESETS[0].name;
      }
    } else if (kind === 'room') {
      const id = $('#new-room').value;
      const r = LLR.ROOMS.find((x) => x.id === id) || own.find((x) => x.id === id);
      if (r) {
        doc.room = Object.assign({}, r.room);
        doc.objects = r.build(doc.room);
        if (r.types) doc.types = JSON.parse(JSON.stringify(r.types));
        doc.name = r.name;
      }
    } else {
      const m = (sel, d) => {
        const x = parseFloat(String($(sel).value).replace(',', '.'));
        return Math.round(Math.max(2, Math.min(30, isFinite(x) ? x : d)) * 100);
      };
      doc.room = { w: m('#new-w', R.w / 100), l: m('#new-l', R.l / 100) };
      doc.objects = emptyRoomObjects(doc.room);
    }
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

  /* ---------- Raum & Einstellungen ----------
     Reiter: Raum, Bedienung, Darstellung (Barrierefreiheit), Prüfregeln und
     Möbelmaße (Profi). Die Darstellung gilt sofort und je Browser,
     „Abbrechen“ stellt sie wieder her. Alles andere gehört zum Plan. */
  const SET_TABS = [
    ['raum', 'Raum'],
    ['bedienung', 'Bedienung'],
    ['darstellung', 'Darstellung'],
    ['regeln', 'Prüfregeln'],
    ['moebel', 'Möbelmaße'],
  ];

  function rulesFields(values) {
    const groups = [];
    for (const r of A.RULES) if (!groups.includes(r.group)) groups.push(r.group);
    let h = '';
    for (const g of groups) {
      h += `<h3>${esc(g)}</h3><div class="field-grid rules">`;
      let bools = '';
      for (const r of A.RULES.filter((x) => x.group === g)) {
        if (r.type === 'bool') bools += `<label class="toggle"><input type="checkbox" data-rule="${r.key}" ${values[r.key] ? 'checked' : ''}><span>${esc(r.label)}</span></label>`;
        else h += `<label class="field">${esc(r.label)} (${esc(r.unit)})<input type="number" data-rule="${r.key}" value="${values[r.key]}" min="${r.min}" max="${r.max}" step="${r.step}"><small class="def">Standard: ${r.def}</small></label>`;
      }
      h += `</div>${bools}`;
    }
    return h;
  }

  async function openSettings(tab) {
    const pro = isPro();
    const P = LLR.prefs;
    const prefs0 = P.snapshot();
    const r = app.doc.room;
    const s = app.doc.settings;
    tab = tab || panels.settingsTab || 'raum';
    const tabs = SET_TABS.filter(([k]) => pro || ['raum', 'bedienung', 'darstellung'].includes(k) || k === tab);
    if (!tabs.some(([k]) => k === tab)) tab = 'raum';
    const panel = (k, html) => (tabs.some(([x]) => x === k) ? `<section class="spanel" id="spanel-${k}" role="tabpanel" aria-labelledby="stab-${k}" data-spanel="${k}"${k === tab ? '' : ' hidden'}>${html}</section>` : '');
    const sw = (id, label, small, on) => `<label class="switch-row"><span class="lbl">${label}<small>${small}</small></span><input type="checkbox" class="switch" id="${id}" ${on ? 'checked' : ''}></label>`;
    const choice = (name, val, cur, title, small) => `<label class="choice"><input type="radio" name="${name}" value="${val}" ${val === cur ? 'checked' : ''}><span><strong>${title}</strong><small>${small}</small></span></label>`;
    const sysContrast = window.matchMedia('(prefers-contrast: more)').matches ? 'hoher Kontrast' : 'normal';
    const sysMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const profiles = LLR.custom ? LLR.custom.allProfiles() : A.PROFILES;
    const curProfile = s.profile && profiles.some((x) => x.id === s.profile) ? s.profile : 'custom';
    let body = `<div class="dlg-tabs seg" role="tablist" aria-label="Bereich">${tabs.map(([k, n]) => `<button type="button" role="tab" id="stab-${k}" aria-controls="spanel-${k}" aria-selected="${k === tab}" tabindex="${k === tab ? 0 : -1}" data-stab="${k}">${n}</button>`).join('')}</div>`;
    body += panel(
      'raum',
      `<div class="field-grid two">
          <label class="field">Breite – Tafelseite (m)<input type="number" id="set-w" value="${(r.w / 100).toFixed(2)}" min="2" max="30" step="0.05"></label>
          <label class="field">Länge (m)<input type="number" id="set-l" value="${(r.l / 100).toFixed(2)}" min="2" max="30" step="0.05"></label>
        </div>
        <p class="area-hint" id="set-area"></p>
        <p class="desc">Möbel an der rechten Wand und an der Rückwand wandern beim Ändern mit (in allen Phasen). Tür, Fenster und Wandobjekte bleiben an ihrer Wand. Andere Raumformen (Nischen, Vorsprünge, Säulen) entstehen mit Wandstücken aus „Möbel → Raum &amp; Technik“.</p>
        ${pro ? `<h3>Raumvorlagen</h3><p class="desc">Den Raum mit seiner festen Einrichtung (alles außer Tischen, Sitzplätzen, Prüfobjekten und Notizen) als Vorlage speichern – sie steht dann unter „Neuer Plan → Anderer Raum“.</p><div class="btn-row"><button type="button" class="btn outline small" data-sact="saveRoom">${icon('i-save')}Raum als Vorlage speichern …</button><button type="button" class="btn outline small" data-sact="manageRooms">${icon('i-folder')}Eigene Räume …</button></div>` : ''}`
    );
    body += panel(
      'bedienung',
      `${sw('set-snap', 'Magnetisch einrasten', 'Tischkanten, Trennwände, Wände, Stuhl zum Tisch · Alt-Taste hält das Einrasten kurz an', s.snap)}
        ${sw('set-carry', 'Angestellte Stühle mitnehmen', 'Beim Verschieben eines Tisches wandern seine Stühle mit', s.carryChairs)}
        ${pro ? `${sw('set-gridsnap', 'Am Raster einrasten', 'Möbel springen auf die Rasterlinien', s.gridSnap)}
        <div class="field-grid two" style="margin-top:8px">
          <label class="field">Rastergröße
            <select id="set-grid">${GRID_SIZES.map((g) => `<option value="${g}" ${(s.grid || 50) === g ? 'selected' : ''}>${g} cm</option>`).join('')}</select></label>
          <label class="field">Winkelraster beim Drehen
            <select id="set-angle">${[5, 15, 45, 90].map((a) => `<option value="${a}" ${s.angleSnap === a ? 'selected' : ''}>${a}°</option>`).join('')}</select></label>
        </div>` : ''}`
    );
    body += panel(
      'darstellung',
      `<p class="desc">Gilt sofort und nur in diesem Browser. „Abbrechen“ stellt die vorherigen Werte wieder her.</p>
        <h3>Ansicht</h3><div class="choice-grid" role="radiogroup" aria-label="Ansicht">
          ${choice('p-level', 'einfach', P.get('level'), 'Einfach', 'Die wichtigsten Funktionen, Prüfungen als Fragen, große Knöpfe.')}
          ${choice('p-level', 'profi', P.get('level'), 'Profi', 'Alle Werkzeuge: Messen, Ausrichten, Zahlen, Prüfregeln, Befehlssuche.')}
        </div>
        <h3>Kontrast</h3><div class="choice-grid two-by" role="radiogroup" aria-label="Kontrast">
          ${choice('p-contrast', 'auto', P.get('contrast'), 'Wie das System', `zurzeit ${sysContrast}`)}
          ${choice('p-contrast', 'normal', P.get('contrast'), 'Normal', 'Helle Oberfläche')}
          ${choice('p-contrast', 'high', P.get('contrast'), 'Hoher Kontrast', 'Schwarz auf Weiß, kräftige Rahmen und Marken')}
          ${choice('p-contrast', 'dark', P.get('contrast'), 'Dunkel', 'Dunkle Oberfläche, der Plan bleibt hell')}
        </div>
        <h3>Schriftgröße der Bedienung</h3><div class="seg text-seg" role="radiogroup" aria-label="Schriftgröße">${P.TEXT.map((t) => `<button type="button" role="radio" data-ptext="${t}" aria-checked="${P.get('text') === t}">${t} %</button>`).join('')}</div>
        <h3>Weitere Hilfen</h3>
        ${sw('p-targets', 'Große Schaltflächen', 'Mindestens 44 × 44 Pixel – leichter zu treffen, z. B. am Tablet', P.get('targets') === 'large')}
        ${sw('p-motion', 'Bewegungen reduzieren', `Kein animierter Übergang zwischen Phasen${sysMotion ? ' (am System bereits eingestellt)' : ''}`, P.get('motion') === 'reduce')}
        ${sw('p-colors', 'Farben bei Farbsehschwäche', 'Blau, Orange und Weinrot statt Grün, Gelb und Rot – die Symbole ✓ ! ✕ bleiben', P.get('colors') === 'cvd')}
        ${sw('p-focus', 'Deutlicher Fokusrahmen', 'Dicker schwarz-gelber Rahmen bei Bedienung mit der Tastatur', P.get('focus') === 'strong')}
        ${sw('p-start', 'Beim Start fragen, was Sie tun möchten', 'Sonst erscheint die Startauswahl nur beim ersten Besuch (Datei → „Was möchten Sie tun?“)', !!P.get('start'))}
        <div class="btn-row"><button type="button" class="btn outline small" data-sact="resetTips">Tipps erneut zeigen</button></div>
        <p class="desc">Tastatur: <span class="kbd">Tab</span> wechselt zwischen den Bedienelementen, im Plan wählen <span class="kbd">N</span> / <span class="kbd">Umschalt</span>+<span class="kbd">N</span> das nächste bzw. vorige Objekt, Pfeiltasten verschieben es. Ein Bildschirmleser sagt die Auswahl an.</p>`
    );
    body += panel(
      'regeln',
      `<label class="field">Prüfprofil<select id="set-profile">${profiles.map((x) => `<option value="${esc(x.id)}" ${x.id === curProfile ? 'selected' : ''}>${esc(x.name)}${x.custom ? ' (eigenes)' : ''}</option>`).join('')}<option value="custom" ${curProfile === 'custom' ? 'selected' : ''}>Angepasst</option></select></label>
        <p class="desc" id="set-profile-desc"></p>
        <div id="set-rules">${rulesFields(A.currentRules(s))}</div>
        <div class="btn-row"><button type="button" class="btn outline small" data-sact="saveProfile">${icon('i-save')}Als eigenes Profil speichern …</button><button type="button" class="btn outline small text-danger" data-sact="delProfile" hidden>${icon('i-trash')}Eigenes Profil löschen</button></div>
        <p class="desc">Die Regeln gehören zum Plan: Sie werden mit ihm gespeichert und geteilt. DIN 18040-1: Durchgänge mind. 90 cm, Bewegungsflächen 150 × 150 cm. Alle Prüfungen sind vereinfachte Modelle.</p>`
    );
    body += panel(
      'moebel',
      `<div class="field-grid">
          <label class="field">Tisch: lange Seite (cm)<input type="number" id="set-tb" value="${s.tableBase}" min="60" max="200" step="1"></label>
          <label class="field">Tisch: Tiefe (cm)<input type="number" id="set-th" value="${s.tableHeight}" min="30" max="120" step="1"></label>
          <span></span>
          <label class="field">Stuhl: Breite (cm)<input type="number" id="set-cw" value="${s.chairW}" min="30" max="80" step="1"></label>
          <label class="field">Stuhl: Tiefe (cm)<input type="number" id="set-cd" value="${s.chairD}" min="30" max="90" step="1"></label>
        </div>
        <p class="desc">Gilt für alle Dreieckstische und Stühle im Plan – z. B. für kleinere Möbel in der Grundschule.</p>`
    );
    let curTab = tab;
    const v = await openDialog({
      title: 'Raum & Einstellungen',
      wide: true,
      body,
      buttons: [
        { label: 'Standardwerte', onClick: () => fillDefaults(curTab) },
        { label: 'Abbrechen', value: 'cancel' },
        { label: 'Übernehmen', value: 'ok', cls: 'primary' },
      ],
      onOpen: (b) => {
        const upd = () => {
          const w = parseFloat($('#set-w').value) || 0;
          const l = parseFloat($('#set-l').value) || 0;
          $('#set-area').textContent = `Fläche: ${num(w * l, 1)} m²`;
        };
        $('#set-w').addEventListener('input', upd);
        $('#set-l').addEventListener('input', upd);
        upd();
        const tabsEl = $$('[data-stab]', b);
        const show = (k, focus) => {
          curTab = k;
          panels.settingsTab = k;
          savePanels();
          for (const t of tabsEl) {
            const on = t.getAttribute('data-stab') === k;
            t.setAttribute('aria-selected', String(on));
            t.tabIndex = on ? 0 : -1;
            if (on && focus) t.focus();
          }
          for (const p of $$('[data-spanel]', b)) p.hidden = p.getAttribute('data-spanel') !== k;
        };
        for (const t of tabsEl) {
          t.addEventListener('click', () => show(t.getAttribute('data-stab')));
          t.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            const i = tabsEl.indexOf(t);
            const n = tabsEl[(i + (e.key === 'ArrowRight' ? 1 : tabsEl.length - 1)) % tabsEl.length];
            show(n.getAttribute('data-stab'), true);
          });
        }
        // Darstellung: sofort anwenden
        b.addEventListener('change', (e) => {
          const t = e.target;
          if (t.name === 'p-level') setLevel(t.value, { quiet: true });
          else if (t.name === 'p-contrast') P.set('contrast', t.value);
          else if (t.id === 'p-targets') P.set('targets', t.checked ? 'large' : 'normal');
          else if (t.id === 'p-motion') P.set('motion', t.checked ? 'reduce' : 'auto');
          else if (t.id === 'p-colors') P.set('colors', t.checked ? 'cvd' : 'standard');
          else if (t.id === 'p-focus') P.set('focus', t.checked ? 'strong' : 'normal');
          else if (t.id === 'p-start') P.set('start', t.checked);
          else if (t.id === 'set-profile') fillProfile(t.value);
          else if (t.hasAttribute('data-rule')) {
            const sel = $('#set-profile');
            if (sel && sel.value !== 'custom') {
              sel.value = 'custom';
              fillProfile('custom', true);
            }
          }
        });
        b.addEventListener('click', (e) => {
          const tx = e.target.closest('[data-ptext]');
          if (tx) {
            P.set('text', Number(tx.getAttribute('data-ptext')));
            for (const x of $$('[data-ptext]', b)) x.setAttribute('aria-checked', String(x === tx));
            return;
          }
          const a = e.target.closest('[data-sact]');
          if (!a) return;
          const act = a.getAttribute('data-sact');
          if (act === 'resetTips') {
            P.assign({ tips: {} });
            toast('Die Tipps erscheinen wieder an passender Stelle.');
          } else if (LLR.custom) LLR.custom.settingsAct(act, b, { fillProfile });
        });
        if ($('#set-profile')) fillProfile($('#set-profile').value, true);
      },
    });
    /* Profil in die Felder übernehmen (keepValues: nur Beschreibung) */
    function fillProfile(id, keepValues) {
      const prof = profiles.find((x) => x.id === id);
      const descEl = $('#set-profile-desc');
      const del = $('#dlg-body [data-sact="delProfile"]');
      if (del) del.hidden = !(prof && prof.custom);
      if (descEl) descEl.textContent = prof ? prof.desc || '' : 'Eigene Werte – vom Profil abweichend.';
      if (!prof || keepValues) return;
      const vals = A.profileValues(prof.values);
      for (const i of $$('#dlg-body [data-rule]')) {
        const k = i.getAttribute('data-rule');
        if (i.type === 'checkbox') i.checked = !!vals[k];
        else i.value = vals[k];
      }
    }
    function fillDefaults(k) {
      const d = LLR.DEFAULT_SETTINGS;
      const R = LLR.DEFAULT_ROOM;
      const setv = (sel, val) => {
        const i = $(sel);
        if (!i) return;
        if (i.type === 'checkbox') i.checked = !!val;
        else i.value = val;
      };
      if (k === 'raum') {
        setv('#set-w', (R.w / 100).toFixed(2));
        setv('#set-l', (R.l / 100).toFixed(2));
        $('#set-w').dispatchEvent(new Event('input'));
      } else if (k === 'bedienung') {
        setv('#set-snap', d.snap);
        setv('#set-carry', d.carryChairs);
        setv('#set-gridsnap', d.gridSnap);
        setv('#set-grid', d.grid);
        setv('#set-angle', d.angleSnap);
      } else if (k === 'darstellung') {
        P.assign({ contrast: 'auto', text: 100, targets: 'normal', motion: 'auto', colors: 'standard', focus: 'normal' });
        for (const i of $$('#dlg-body input[name=p-contrast]')) i.checked = i.value === 'auto';
        for (const x of $$('#dlg-body [data-ptext]')) x.setAttribute('aria-checked', String(x.getAttribute('data-ptext') === '100'));
        for (const id of ['#p-targets', '#p-motion', '#p-colors', '#p-focus']) setv(id, false);
      } else if (k === 'regeln') {
        setv('#set-profile', 'standard');
        fillProfile('standard');
      } else if (k === 'moebel') {
        setv('#set-tb', d.tableBase);
        setv('#set-th', d.tableHeight);
        setv('#set-cw', d.chairW);
        setv('#set-cd', d.chairD);
      }
    }
    if (v !== 'ok') {
      P.assign(prefs0);
      applyLevelUI();
      return;
    }
    const val = (id, def, min, max) => {
      const el = $(id);
      if (!el) return def;
      const x = parseFloat(String(el.value).replace(',', '.'));
      return isFinite(x) ? Math.max(min, Math.min(max, x)) : def;
    };
    const chk = (id, def) => ($(id) ? $(id).checked : def);
    const newW = Math.round(val('#set-w', r.w / 100, 2, 30) * 100);
    const newL = Math.round(val('#set-l', r.l / 100, 2, 30) * 100);
    // Prüfregeln lesen
    let rules = null;
    let profileId = null;
    if ($('#set-profile')) {
      rules = {};
      for (const i of $$('#dlg-body [data-rule]')) {
        const k = i.getAttribute('data-rule');
        const rr = A.RULE[k];
        if (i.type === 'checkbox') rules[k] = i.checked;
        else {
          const x = parseFloat(String(i.value).replace(',', '.'));
          rules[k] = isFinite(x) ? Math.max(rr.min, Math.min(rr.max, x)) : rr.def;
        }
      }
      profileId = $('#set-profile').value === 'custom' ? null : $('#set-profile').value;
    }
    app.mutate((doc) => {
      if (newW !== doc.room.w || newL !== doc.room.l) app.applyRoomResize(app.roomSnapshot(), { l: 0, t: 0, r: newW - doc.room.w, b: newL - doc.room.l });
      const st = doc.settings;
      st.tableBase = val('#set-tb', st.tableBase, 60, 200);
      st.tableHeight = val('#set-th', st.tableHeight, 30, 120);
      st.chairW = val('#set-cw', st.chairW, 30, 80);
      st.chairD = val('#set-cd', st.chairD, 30, 90);
      st.snap = chk('#set-snap', st.snap);
      st.carryChairs = chk('#set-carry', st.carryChairs);
      st.gridSnap = chk('#set-gridsnap', st.gridSnap);
      st.grid = $('#set-grid') ? parseInt($('#set-grid').value, 10) || 50 : st.grid;
      st.angleSnap = $('#set-angle') ? parseInt($('#set-angle').value, 10) || 15 : st.angleSnap;
      if (rules) A.applyRules(st, rules, profileId);
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

  function printHead(title, sub) {
    const ph = app.doc.phases ? ` · Phase ${app.phaseIndex() + 1}: ${esc(app.phases()[app.phaseIndex()].name)}` : '';
    return `<h1>${esc(title)}</h1><div class="sub">${sub !== undefined ? sub : `Lehr-Lern-Raum Inklusion (LLR) · ${app.fmtM(app.doc.room.w)} × ${app.fmtM(app.doc.room.l)} (${app.fmtArea(app.doc.room.w * app.doc.room.l)})${ph} · ${new Date().toLocaleString('de-DE')}`}</div>`;
  }

  /* Andere Phase kurz zeichnen (für den Druck), ohne Verlauf und Speichern */
  function withPhase(i, fn) {
    const cur = app.phaseIndex();
    if (!app.doc.phases || i === cur) return fn();
    const ph = app.doc.phases;
    const saved = app.doc.objects;
    const access = app.access;
    ph[cur].objects = saved;
    app.doc.objects = ph[i].objects || [];
    ph[i].objects = null;
    app.doc.phase = i;
    app.renderObjects();
    app.problems = A.problems(app.doc);
    app.access = A.access(app.doc, { image: true });
    try {
      return fn();
    } finally {
      ph[i].objects = app.doc.objects;
      app.doc.objects = saved;
      ph[cur].objects = null;
      app.doc.phase = cur;
      app.access = access;
      app.renderObjects();
      app.problems = A.problems(app.doc);
      app.renderAnalysisLayer();
      app.renderOverlay();
    }
  }

  /* Namen auf den Plätzen größer zeichnen (Aushang) */
  function withLabelScale(k, fn) {
    app.labelScale = k;
    app.renderObjects();
    try {
      return fn();
    } finally {
      app.labelScale = 1;
      app.renderObjects();
    }
  }

  /* Umbau aus der Grundaufstellung (Seminarsitzordnung I) in den aktuellen Plan:
     jedes Möbelstück kommt vom nächstgelegenen Platz desselben Typs */
  function setupRebuild() {
    const isArr = (o) => A.isTable(o) || o.type === 'chair' || o.type === 'stool';
    const base = app.buildPreset(LLR.PRESETS[0], app.doc);
    const cur = app.doc.objects.filter(isArr);
    const pairs = [];
    for (const a of base) for (const b of cur) if (a.type === b.type) pairs.push({ a, b, d: G.dist(a, b) });
    pairs.sort((x, y) => x.d - y.d);
    const ua = new Set();
    const ub = new Set();
    for (const { a, b } of pairs) {
      if (ua.has(a) || ub.has(b)) continue;
      ua.add(a);
      ub.add(b);
      a.id = b.id;
    }
    const prev = app.doc.objects.filter((o) => !isArr(o)).concat(base);
    return A.rebuild(prev, app.doc.objects);
  }

  const printPrefix = () => 'pr' + Math.random().toString(36).slice(2, 7) + '-';

  function rebuildSection(rb, title) {
    let h = printHead(title);
    const orig = app.rebuildFromPrev;
    app.rebuildFromPrev = () => rb;
    let svg;
    try {
      svg = withLens('rebuild', () => buildExportSVG(1, { noTitle: true, prefix: printPrefix() })).svg;
    } finally {
      app.rebuildFromPrev = orig;
    }
    h += `<div class="plan">${svg}</div>`;
    const steps = LLR.rebuildSteps(rb);
    const chairs = rb.moved.filter((m) => m.type === 'chair' || m.type === 'stool');
    h += `<div class="cols"><div><h2>Reihenfolge</h2><ol class="big">${steps.map((x) => `<li>${esc(x.text)}</li>`).join('')}${chairs.length ? `<li>Danach ${chairs.length} Stühle/Hocker an die Tische stellen (zarte Pfeile im Plan).</li>` : ''}</ol>${!steps.length && !chairs.length && !rb.added.length && !rb.removed.length ? '<p>Keine Möbel zu bewegen.</p>' : ''}</div>`;
    h += `<div><h2>Aufwand</h2><table><tr><td>Tische</td><td>${rb.tables}</td></tr><tr><td>Stühle und Hocker</td><td>${rb.seats}</td></tr><tr><td>Weitere Möbel</td><td>${rb.other}</td></tr><tr><td>Wege zusammen</td><td>${m1(rb.distSum)}</td></tr><tr><td>Zeit (grobe Schätzung)</td><td>allein ca. ${Math.max(1, Math.round(rb.sec / 60))} min · zu viert ca. ${Math.max(1, Math.round(rb.sec / 4 / 60 + 0.5))} min</td></tr></table>`;
    if (rb.added.length || rb.removed.length) h += `<p style="font-size:9.5pt">${rb.added.length ? `Neu hinstellen: ${rb.added.length} (grünes +). ` : ''}${rb.removed.length ? `Wegräumen: ${rb.removed.length} (rotes ×).` : ''}</p>`;
    h += `</div></div><div class="foot">Erstellt mit dem LLR-Raumplaner 2D. Lila gestrichelt: Position vorher, Nummern = Reihenfolge.</div>`;
    return h;
  }

  /* Belegung und Prüfergebnisse als Tabellen (Unterrichtsentwurf) */
  function checksTable() {
    const st = app.stats();
    const c = st.count;
    let h = `<div class="cols"><table><tr><th colspan="2">Belegung</th></tr>
        <tr><td>Dreieckstische</td><td>${c.table || 0} / 12</td></tr>
        ${c.tableRect ? `<tr><td>Rechtecktische</td><td>${c.tableRect}</td></tr>` : ''}
        <tr><td>Stühle</td><td>${c.chair || 0} / 19</td></tr>
        <tr><td>Hocker</td><td>${c.stool || 0} / 2</td></tr>
        ${st.wheelchairs ? `<tr><td>Rollstuhlplätze</td><td>${st.wheelchairs}</td></tr>` : ''}
        <tr><td><strong>Arbeitsplätze gesamt</strong></td><td><strong>${st.seats}</strong> (empfohlen max. ${A.rule(app.doc.settings, 'maxSeats')})</td></tr>
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
    h += `</table></div>`;
    return h;
  }

  /* Druckblatt je Zielgruppe:
     plan     – Unterrichtsentwurf: Plan, Belegung, Prüfungen (opts.phases = 'all', opts.lens, opts.checks, opts.note)
     class    – Aushang für die Klasse: Plan mit großen Namen, ohne Bedarfe
     seating  – Sitzplan für die Lehrkraft mit Bedarfen (vertraulich)
     rebuild  – Umbaukarte von der vorigen Phase (opts.all = alle Übergänge)
     setup    – Aufbaukarte aus der Grundaufstellung (Plan ohne Phasen) */
  function buildPrintSheet(kind, opts) {
    kind = kind || 'plan';
    opts = opts || {};
    let h = '';
    if (kind === 'rebuild') {
      if (!app.doc.phases) return buildPrintSheet('setup', opts);
      const n = app.doc.phases.length;
      const list = opts.all ? [...Array(n).keys()].slice(1) : [Math.max(1, app.phaseIndex())];
      list.forEach((i, k) => {
        h += `<div class="${k ? 'page-break' : ''}">`;
        h += withPhase(i, () => rebuildSection(app.rebuildFromPrev(), `Umbauplan: ${app.phases()[i - 1].name} → ${app.phases()[i].name}`));
        h += `</div>`;
      });
    } else if (kind === 'setup') {
      h += rebuildSection(setupRebuild(), `Aufbau: Grundaufstellung → ${app.doc.name}`);
    } else if (kind === 'class') {
      const { svg } = withLens(null, () => withLabelScale(1.7, () => buildExportSVG(1, { noTitle: true, prefix: printPrefix() })));
      h += printHead(`Sitzplan: ${app.doc.name}`, `${new Date().toLocaleDateString('de-DE')} · Tafel oben`);
      h += `<div class="plan big">${svg}</div>`;
      const placed = app.learners().filter((l) => app.seatOf(l.id)).map((l) => l.name).sort((x, y) => x.localeCompare(y, 'de'));
      if (placed.length) h += `<p class="names">${placed.map(esc).join(' · ')}</p>`;
    } else if (kind === 'seating') {
      const { svg } = withLens(undefined, () => buildExportSVG(1, { noTitle: true, prefix: printPrefix() }));
      h += printHead(`Sitzplan: ${app.doc.name}`);
      h += `<div class="plan">${svg}</div>`;
      h += LLR.classUI ? LLR.classUI.printTable() : '';
      h += `<div class="foot">Erstellt mit dem LLR-Raumplaner 2D. Vertraulich – enthält Angaben zu Lernenden.</div>`;
    } else {
      const phases = opts.phases === 'all' && app.doc.phases ? [...Array(app.doc.phases.length).keys()] : [app.phaseIndex()];
      phases.forEach((i, k) => {
        h += `<div class="${k ? 'page-break' : ''}">`;
        h += withPhase(i, () => {
          let x = printHead(app.doc.phases ? `${app.doc.name} – Phase ${i + 1}: ${app.phases()[i].name}` : app.doc.name);
          const { svg } = withLens(opts.lens, () => buildExportSVG(1, { noTitle: true, prefix: printPrefix() }));
          x += `<div class="plan">${svg}</div>`;
          if (opts.checks !== false) x += checksTable();
          return x;
        });
        h += `</div>`;
      });
      if (opts.note) h += `<p class="note">${esc(opts.note)}</p>`;
      h += `<div class="foot">Erstellt mit dem LLR-Raumplaner 2D. Prüfungen sind vereinfachte Modelle (Rollstuhl: Durchgang ${app.doc.settings.passage} cm, Wendekreis ${app.doc.settings.turning} cm${app.doc.settings.profile ? `, Profil „${esc(LLR.custom ? LLR.custom.profileName(app.doc.settings) : app.doc.settings.profile)}“` : ''}) – sie ersetzen keine Prüfung vor Ort.</div>`;
    }
    $('#print-sheet').innerHTML = h;
  }

  /* Druck über das Menü: gewählte Fassung; Strg+P ohne Menü: normaler Plan */
  let printPending = null;
  function printPlan(kind, opts) {
    printPending = kind || 'plan';
    buildPrintSheet(printPending, opts);
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
          ${card('i-wand', 'Loslegen', '„Datei → Was möchten Sie tun?“ führt zu den häufigsten Aufgaben, der Assistent „Stunde planen“ Schritt für Schritt zur fertigen Sitzordnung.')}
          ${card('i-sliders', 'Einfach oder Profi', 'Oben rechts umschalten: „Einfach“ zeigt das Wichtigste und stellt Prüfungen als Fragen, „Profi“ alle Werkzeuge mit Zahlen.')}
          ${card('i-box', 'Einrichten', 'Links unter „Möbel“ fertige Bausteine oder einzelne Möbel antippen oder in den Plan ziehen. „Anordnungen“ übernimmt eine Sitzordnung.')}
          ${card('i-more', 'Schnellaktionen', 'Unten im Plan: Drehen, Kopie, Stühle anstellen, Löschen. Rechtsklick oder lange drücken öffnet weitere Aktionen.')}
          ${card('i-check', 'Prüfen', 'Rollstuhl, Sicht, Lehrkraft und Ruhe – oben im Plan oder rechts unter „Prüfen“, jeweils mit Hinweisen, was hilft.')}
          ${card('i-users', 'Lernende & Sitzplan', 'Namen oder Kürzel eintragen, Bedarfe markieren und auf Plätze setzen – oder automatisch verteilen lassen.')}
          ${card('i-steps', 'Phasen', 'Mehrere Anordnungen für eine Stunde (z. B. Kreis → Gruppenarbeit). Mit Übergang, Umbauaufwand und Umbauplan.')}
          ${card('i-printer', 'Drucken für …', 'Aushang für die Klasse, Sitzplan für Sie, Umbaukarte für das Umbau-Team oder Unterlagen für den Unterrichtsentwurf.')}
          ${card('i-contrast', 'Darstellung', 'Hoher Kontrast, dunkle Oberfläche, größere Schrift und Schaltflächen, Farben bei Farbsehschwäche: Datei → Darstellung &amp; Barrierefreiheit.')}
          ${card('i-link', 'Speichern & Teilen', 'Automatische Sicherung im Browser. Im Datei-Menü: Pläne, Drucken &amp; Exportieren. „Teilen“ erzeugt einen Link.')}
        </div>
        <details><summary>Bedienung im Plan</summary><ul>
          <li><strong>Verschieben:</strong> Objekt antippen und ziehen. <strong>Drehen:</strong> am blauen Kreis über der Auswahl ziehen (rastet in ${S.angleSnap}°-Schritten ein, Umschalt = frei) oder mit „Drehen“ unten um 90°.</li>
          <li><strong>Größe ändern:</strong> an den kleinen Quadraten ziehen (Umschalt an einer Ecke = Seitenverhältnis behalten, Alt = zentimetergenau).</li>
          <li><strong>Raumgröße:</strong> ohne Auswahl an einer Wand oder an den blauen Griffen ziehen – oder rechts eintippen.</li>
          <li><strong>Tische kombinieren:</strong> Tische rasten Kante an Kante ein, angestellte Stühle wandern mit. <strong>Doppelklick</strong> auf einen Tisch wählt die ganze Gruppe.</li>
          <li><strong>Kontextmenü:</strong> Rechtsklick (ohne zu ziehen) oder lange drücken auf ein Objekt oder eine freie Stelle. Rechte Maustaste ziehen verschiebt die Ansicht.</li>
          <li><strong>Profi:</strong> Mehrfachauswahl (oder Umschalt + Rahmen aufziehen), Ausrichten, Verteilen, Spiegeln, genaue Lage als Zahl, Messen mit „Behalten“ als Maßlinie.</li>
          <li><strong>Ansicht:</strong> leere Fläche ziehen = verschieben, Mausrad oder zwei Finger = zoomen.</li>
        </ul></details>
        <details><summary>Prüfungen</summary><ul>
          <li><strong>Rollstuhl:</strong> befahrbare Flächen ab der Tür (Durchgang ≥ ${S.passage} cm), Wenden (Ø ${S.turning} cm), Rollstuhlplätze an Tischen mit geprüftem Weg. Test-Rollstuhl zum Ausprobieren.</li>
          <li><strong>Sicht:</strong> je Platz, ob Tafel, Bildschirm oder Beamer-Fläche direkt, nur seitlich oder gar nicht im Blick sind – auch wenn Personen davor sitzen. Platz antippen zeigt den Sichtkegel.</li>
          <li><strong>Lehrkraft:</strong> erreicht die Lehrkraft jeden Platz (Durchgang ≥ ${S.walk || 50} cm) und sieht sie die Gesichter?</li>
          <li><strong>Ruhe & Reize:</strong> Nähe zu Tür und Lounge, Laufwege anderer, Gedränge, Fensterblick und Spiegelungen.</li>
          <li><strong>Prüfregeln (Profi):</strong> alle Grenzwerte und Gewichte lassen sich einstellen und als Profil speichern, z. B. „Reizarm“ oder „Streng“.</li>
          <li>Alle Prüfungen sind vereinfachte Modelle und ersetzen keine fachliche Prüfung vor Ort.</li>
        </ul></details>
        <details><summary>Tastatur</summary><p><span class="kbd">Strg</span>+<span class="kbd">K</span> Befehlssuche · <span class="kbd">?</span> alle Tastenkürzel · <span class="kbd">N</span> / <span class="kbd">Umschalt</span>+<span class="kbd">N</span> nächstes/voriges Objekt · <span class="kbd">Pfeiltasten</span> verschieben (mit <span class="kbd">Umschalt</span> 10 cm) · <span class="kbd">R</span> drehen · <span class="kbd">9</span> um 90° drehen · <span class="kbd">Entf</span> löschen · <span class="kbd">Strg</span>+<span class="kbd">D</span> duplizieren · <span class="kbd">Strg</span>+<span class="kbd">Z</span>/<span class="kbd">Y</span> rückgängig/wiederholen · <span class="kbd">1</span>–<span class="kbd">4</span> Prüfansichten · <span class="kbd">Umschalt</span>+<span class="kbd">F10</span> Kontextmenü · <span class="kbd">Esc</span> Auswahl aufheben</p></details>`,
      buttons: [
        { label: 'Was möchten Sie tun? …', onClick: () => doAct('start') },
        { label: 'Alles klar', value: 'ok', cls: 'primary' },
      ],
    });
  }

  /* ---------- Einfach | Profi ---------- */
  function applyLevelUI() {
    const pro = isPro();
    if (!pro) {
      if (app.mode === 'measure') app.setMode('select');
      if (app.multi) {
        app.multi = false;
        app.emit('mode');
      }
      if (panels.tab === 'objects') setTab('catalog');
      if (!$('#view-pop').hidden) toggleViewPop(false);
    }
    renderCatalog();
    renderPresets();
    if (rightView === 'checks') renderChecks();
    else renderProps();
    renderSelBar();
    renderLegend();
    syncTools();
    app.renderOverlay();
    if (LLR.classUI) LLR.classUI.render();
  }

  function setLevel(level, opts) {
    if (level !== 'einfach' && level !== 'profi') return;
    const changed = LLR.prefs.get('level') !== level;
    LLR.prefs.set('level', level);
    applyLevelUI();
    if (!changed || (opts && opts.quiet)) return;
    if (level === 'profi') {
      toast('Profi-Ansicht: alle Werkzeuge, Zahlen und Prüfregeln.');
      if (LLR.assist) setTimeout(() => LLR.assist.tip('profi', 'Tipp: Strg+K öffnet die Befehlssuche, ? zeigt alle Tastenkürzel. Bei mehreren ausgewählten Objekten gibt es Ausrichten und Verteilen.'), 3600);
    } else toast('Einfach-Ansicht: die wichtigsten Funktionen, Prüfungen als Fragen.');
    announce(level === 'profi' ? 'Profi-Ansicht' : 'Einfach-Ansicht');
  }

  /* Darstellung geändert (Kontrast, Farben, Schriftgröße …) */
  function onPrefs(key) {
    if (key === 'level' || key === 'recent' || key === 'tips' || key === 'start') return;
    if (LLR.syncSightColors) LLR.syncSightColors();
    if (LLR.syncStatusColors) LLR.syncStatusColors();
    app.renderRoom();
    app.renderObjects();
    app.scheduleAnalysis(0);
    app.renderAnalysisLayer();
    app.renderOverlay();
    renderLegend();
    if (rightView === 'checks') renderChecks();
    else renderProps();
    renderCatalog();
    renderPresets();
    if (LLR.classUI) LLR.classUI.render();
    requestAnimationFrame(() => app.syncAspect());
  }

  /* ---------- Ansagen für Bildschirmleser ---------- */
  let announceTimer = null;
  function announce(msg) {
    const el = $('#sr-live');
    if (!el) return;
    clearTimeout(announceTimer);
    el.textContent = '';
    announceTimer = setTimeout(() => (el.textContent = msg), 60);
  }
  function describeSelection() {
    const objs = app.selectedObjects();
    if (!objs.length) return 'Auswahl aufgehoben';
    if (objs.length > 1) return `${objs.length} Objekte ausgewählt`;
    const o = objs[0];
    const d = T[o.type];
    const person = o.learner ? `, ${app.learnerName(o.learner)}` : '';
    return `${d.name}${o.label ? ' „' + o.label + '“' : ''}${person} ausgewählt. ${Math.round(o.x)} cm von links, ${Math.round(o.y)} cm von der Tafelwand${o.rot ? `, gedreht um ${Math.round(o.rot)} Grad` : ''}${o.locked ? ', gesperrt' : ''}.`;
  }

  /* ---------- Auswahl-Leiste ----------
     Einfach: große Knöpfe mit Beschriftung (Drehen 90°, Kopie, Stühle,
     Löschen, Mehr). Profi: kompakte Symbole mit ±15°, Ausrichten, Sperren. */
  function renderSelBar() {
    if (!app.doc) return;
    const bar = $('#sel-bar');
    const objs = app.selectedObjects();
    bar.hidden = !objs.length;
    $('#stage').classList.toggle('has-sel', objs.length > 0);
    document.body.classList.toggle('has-sel', objs.length > 0);
    if (!objs.length) return;
    const pro = isPro();
    const allLocked = objs.every((o) => o.locked);
    const noRot = objs.every((o) => o.locked || T[o.type].wall);
    bar.querySelector('[data-act="lock"] use').setAttribute('href', allLocked ? '#i-unlock' : '#i-lock');
    bar.querySelector('[data-act="lock"] span').textContent = allLocked ? 'Entsperren' : 'Sperren';
    for (const k of ['rotl', 'rotr', 'rot90']) bar.querySelector(`[data-act="${k}"]`).disabled = noRot;
    bar.querySelector('[data-act="del"]').disabled = allLocked;
    bar.querySelector('[data-act="details"]').hidden = !(mobile() || !panels.right);
    const tables = objs.some((o) => A.isTable(o) && !o.locked);
    bar.querySelector('[data-act="chairs"]').hidden = !tables;
    const carry = bar.querySelector('[data-act="carry"]');
    carry.hidden = !tables || !pro;
    carry.setAttribute('aria-pressed', String(!!app.doc.settings.carryChairs));
    bar.querySelector('[data-act="alignMenu"]').hidden = !pro;
    bar.classList.toggle('labeled', !pro);
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
    setTab(!isPro() && panels.tab === 'objects' ? 'catalog' : panels.tab);
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
    let lastAnnounced = '';
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
      if (key !== lastAnnounced) {
        lastAnnounced = key;
        announce(describeSelection());
      }
    });
    app.on('history', syncHistory);
    app.on('announce', announce);
    LLR.prefs.on(onPrefs);
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

    // Beim ersten Besuch (und auf Wunsch bei jedem Start): „Was möchten Sie tun?“
    let first = false;
    try {
      first = !localStorage.getItem(KEY_SEEN) && !localStorage.getItem('llr2d.seen.v1');
      localStorage.setItem(KEY_SEEN, '1');
    } catch (e) {
      /* ohne Speicher keine Startauswahl */
    }
    if (!shared && (first || LLR.prefs.get('start')) && LLR.assist) LLR.assist.openStart({ first });
    else if (LLR.prefs.introduce) setTimeout(() => toast('Neu: Oben rechts zwischen „Einfach“ und „Profi“ umschalten – Profi zeigt alle Werkzeuge wie bisher.'), 900);
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
    doAct,
    isPro,
    setLevel,
    applyLevelUI,
    openSettings,
    openNew,
    openHelp,
    openPlans,
    buildPrintSheet,
    addBlock,
    choosePreset,
    renderCatalog,
    renderPresets,
    showRightView,
    replaceDoc,
    download,
    fileName,
    announce,
    showDetails,
    toggleFileMenu,
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

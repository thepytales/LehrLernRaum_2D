/* Eigene Bibliothek: Anordnungen (Vorlagen), Möbel, Räume und Prüfprofile.
   Alles wird im Browser gespeichert und lässt sich als Datei weitergeben.
   Eigene Möbeltypen reisen zusätzlich mit jedem Plan (doc.types). */
(function (LLR) {
  'use strict';
  const A = LLR.analysis;
  const T = LLR.TYPES;
  const G = LLR.G;
  const app = LLR.app;
  const esc = LLR.esc;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const ui = () => LLR.ui;
  const icon = (id) => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
  const KEYS = { templates: 'llr2d.templates.v1', furniture: 'llr2d.furniture.v1', rooms: 'llr2d.rooms.v1', profiles: 'llr2d.profiles.v1' };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const clone = (x) => JSON.parse(JSON.stringify(x));

  const load = (k) => {
    try {
      const v = JSON.parse(localStorage.getItem(KEYS[k]) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  };
  const store = (k, list) => {
    try {
      localStorage.setItem(KEYS[k], JSON.stringify(list));
      return true;
    } catch (e) {
      if (ui()) ui().toast('Speichern im Browser nicht möglich (Speicher voll oder gesperrt). Bitte als Datei exportieren.');
      return false;
    }
  };

  /* Objekte für Vorlagen ohne IDs und Sitzplan speichern */
  const KEEP = ['type', 'x', 'y', 'rot', 'color', 'foot', 'w', 'd', 'label', 'locked', 'mirror', 'outward', 'turn', 'text', 'size'];
  const strip = (o) => {
    const c = {};
    for (const k of KEEP) if (o[k] !== undefined) c[k] = o[k];
    return c;
  };
  const withIds = (objs) => objs.filter((o) => T[o.type]).map((o) => Object.assign(clone(o), { id: LLR.newId() }));
  const typesOf = (objs) => {
    const out = {};
    for (const o of objs) if (T[o.type] && T[o.type].custom) out[o.type] = T[o.type].spec;
    return Object.keys(out).length ? out : null;
  };
  const registerTypes = (types) => {
    if (types) for (const [k, spec] of Object.entries(types)) LLR.registerCustomType(k, spec);
  };

  /* ---------- Eigene Möbel ---------- */
  function furniture() {
    return load('furniture').filter((f) => f && T[f.key] && T[f.key].custom);
  }
  // Bibliothek beim Laden registrieren (vor dem Öffnen des Plans)
  for (const f of load('furniture')) if (f && f.key) LLR.registerCustomType(f.key, f.spec);

  function saveFurniture(key, spec) {
    const clean = LLR.registerCustomType(key, spec);
    if (!clean) return false;
    const list = load('furniture').filter((f) => f.key !== key);
    list.push({ key, spec: clean });
    if (!store('furniture', list)) return false;
    // Plan neu zeichnen, falls das Möbel schon darin steht
    app.renderObjects();
    app.changed({ skipHistory: true });
    return true;
  }

  function deleteFurniture(key) {
    store('furniture', load('furniture').filter((f) => f.key !== key));
    const used = app.allObjects().some((o) => o.type === key);
    if (!used) delete T[key];
    return used;
  }

  /* ---------- Eigene Anordnungen (Vorlagen) ---------- */
  const isArrangement = (o) => A.isTable(o) || o.type === 'chair' || o.type === 'stool';
  function templates() {
    return load('templates')
      .filter((t) => t && Array.isArray(t.objs))
      .map((t) => {
        registerTypes(t.types);
        const objs = t.objs.filter((o) => T[o.type]);
        return {
          id: 'u:' + t.id,
          tid: t.id,
          name: t.name,
          note: t.note || '',
          persons: 'Eigene Vorlage',
          seats: objs.filter((o) => T[o.type].seats).length,
          forms: t.forms || [],
          custom: true,
          raw: t,
          // In einem anderen Raum: wie die Anordnungen der Handreichung mittig
          // zur Breite und etwas nach hinten versetzt
          build: (S, room) => {
            const out = withIds(objs);
            if (room && t.room && (room.w !== t.room.w || room.l !== t.room.l)) {
              const dx = (room.w - t.room.w) / 2;
              const dy = (room.l - t.room.l) * 0.3;
              for (const o of out) {
                o.x += dx;
                o.y += dy;
              }
            }
            return out;
          },
        };
      });
  }

  LLR.findPreset = (id) => LLR.PRESETS.find((p) => p.id === id) || templates().find((t) => t.id === id) || null;

  async function saveTemplateDialog() {
    const sel = app.selectedObjects().filter(isArrangement);
    const all = app.doc.objects.filter(isArrangement);
    if (!all.length) return ui().toast('Im Plan stehen keine Tische oder Stühle.');
    const v = await ui().openDialog({
      title: 'Anordnung als Vorlage speichern',
      body: `<p>Gespeichert werden die Tische und Sitzplätze mit ihrer Lage im Raum (ohne Namen der Lernenden). Die Vorlage steht dann unter „Anordnungen → Eigene Anordnungen“, im Assistenten und bei neuen Phasen.</p>
        <label class="field">Name<input type="text" id="tpl-name" maxlength="60" value="${esc(LLR.PRESETS.some((p) => p.name === app.doc.name) ? app.doc.name + ' (angepasst)' : app.doc.name)}"></label>
        <label class="field" style="margin-top:8px">Notiz (optional)<input type="text" id="tpl-note" maxlength="200" placeholder="z. B. für Gruppenarbeit mit Rückzugsplatz"></label>
        <h3>Sozialform (für den Filter)</h3><div class="chip-select">${LLR.FORMS.map((f) => `<label><input type="checkbox" data-tform="${f.id}">${esc(f.name)}</label>`).join('')}</div>
        ${sel.length && sel.length < all.length ? `<h3>Umfang</h3><label class="toggle"><input type="radio" name="tpl-scope" value="all" checked><span>Ganze Anordnung<small>${all.length} Tische und Sitzplätze</small></span></label><label class="toggle"><input type="radio" name="tpl-scope" value="sel"><span>Nur die Auswahl<small>${sel.length} Tische und Sitzplätze</small></span></label>` : ''}`,
      buttons: [
        { label: 'Abbrechen', value: 'cancel' },
        { label: 'Speichern', value: 'ok', cls: 'primary' },
      ],
      keepFocus: true,
      onOpen: () => {
        const i = $('#tpl-name');
        i.focus();
        i.select();
      },
    });
    if (v !== 'ok') return;
    const scope = ($('#dlg-body input[name=tpl-scope]:checked') || {}).value;
    const objs = (scope === 'sel' ? sel : all).map(strip);
    const t = {
      id: uid(),
      name: $('#tpl-name').value.trim().slice(0, 60) || 'Eigene Anordnung',
      note: $('#tpl-note').value.trim().slice(0, 200),
      forms: $$('#dlg-body [data-tform]').filter((x) => x.checked).map((x) => x.getAttribute('data-tform')),
      date: Date.now(),
      room: clone(app.doc.room),
      objs,
    };
    const types = typesOf(objs);
    if (types) t.types = types;
    if (store('templates', load('templates').concat(t))) {
      ui().renderPresets();
      ui().toast(`Vorlage „${t.name}“ gespeichert`);
    }
  }

  function exportFile(data, name) {
    const blob = new Blob([JSON.stringify(Object.assign({ app: 'LLR-Raumplaner 2D' }, data), null, 1)], { type: 'application/json' });
    ui().download(blob, name);
  }

  async function renameTemplate(tid) {
    const list = load('templates');
    const t = list.find((x) => x.id === tid);
    if (!t) return;
    const v = await ui().openDialog({
      title: 'Vorlage umbenennen',
      body: `<label class="field">Name<input type="text" id="tpl-name" maxlength="60" value="${esc(t.name)}"></label><label class="field" style="margin-top:8px">Notiz<input type="text" id="tpl-note" maxlength="200" value="${esc(t.note || '')}"></label>`,
      buttons: [
        { label: 'Abbrechen', value: 'cancel' },
        { label: 'Speichern', value: 'ok', cls: 'primary' },
      ],
    });
    if (v !== 'ok') return;
    t.name = $('#tpl-name').value.trim().slice(0, 60) || t.name;
    t.note = $('#tpl-note').value.trim().slice(0, 200);
    store('templates', list);
    ui().renderPresets();
  }

  function templateMenu(id, anchor) {
    const t = templates().find((x) => x.id === id);
    if (!t || !LLR.commands) return;
    LLR.commands.menuAt(anchor, [
      { label: 'Übernehmen …', icon: 'i-layout', run: () => ui().choosePreset(t) },
      { label: 'Umbenennen …', icon: 'i-edit', run: () => renameTemplate(t.tid) },
      { label: 'Als Datei exportieren', icon: 'i-download', run: () => exportFile({ kind: 'library', templates: [t.raw] }, `vorlage_${t.name.replace(/[^\w-]+/g, '_')}.llr.json`) },
      { sep: true },
      {
        label: 'Löschen',
        icon: 'i-trash',
        danger: true,
        run: async () => {
          if (!(await ui().confirmDlg('Vorlage löschen?', `<p>„${esc(t.name)}“ endgültig löschen?</p>`, 'Löschen', true))) return;
          store('templates', load('templates').filter((x) => x.id !== t.tid));
          ui().renderPresets();
        },
      },
    ]);
  }

  /* ---------- Eigene Räume ---------- */
  const isRoomObject = (o) => !isArrangement(o) && !['wheelchair', 'teacher', 'label', 'dim'].includes(o.type) && T[o.type] && T[o.type].kind !== 'zone';
  function rooms() {
    return load('rooms')
      .filter((r) => r && r.room && Array.isArray(r.objs))
      .map((r) => {
        registerTypes(r.types);
        return {
          id: 'r:' + r.id,
          rid: r.id,
          name: r.name,
          desc: `${(r.room.w / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 })} × ${(r.room.l / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 })} m · eigener Raum`,
          room: r.room,
          types: r.types,
          build: () => withIds(r.objs),
        };
      });
  }

  function saveRoom(name) {
    const objs = app.doc.objects.filter(isRoomObject).map(strip);
    const r = { id: uid(), name: String(name || '').trim().slice(0, 60) || 'Eigener Raum', room: clone(app.doc.room), objs, date: Date.now() };
    const types = typesOf(objs);
    if (types) r.types = types;
    return store('rooms', load('rooms').concat(r)) ? r : null;
  }

  /* ---------- Eigene Prüfprofile ---------- */
  function profiles() {
    return load('profiles')
      .filter((p) => p && p.id && p.values)
      .map((p) => ({ id: p.id, name: p.name, desc: p.desc || 'Eigenes Prüfprofil', values: A.cleanRulesAll(p.values), custom: true }));
  }
  // Auch die fünf Hauptwerte (top) gehören zu einem Profil
  A.cleanRulesAll = (raw) => {
    const out = {};
    for (const r of A.RULES) {
      if (!raw || raw[r.key] === undefined) continue;
      if (r.type === 'bool') out[r.key] = !!raw[r.key];
      else {
        const n = Number(raw[r.key]);
        if (isFinite(n)) out[r.key] = Math.max(r.min, Math.min(r.max, n));
      }
    }
    return out;
  };
  const allProfiles = () => A.PROFILES.concat(profiles());

  /* Name des Profils eines Plans – oder „Angepasst“ */
  function profileName(S) {
    const p = S.profile && allProfiles().find((x) => x.id === S.profile);
    if (p) return p.name;
    const cur = A.currentRules(S);
    const std = A.RULES.every((r) => cur[r.key] === r.def);
    return std ? A.PROFILES[0].name : 'Angepasst';
  }

  function readRuleInputs(body) {
    const vals = {};
    for (const i of $$('[data-rule]', body)) {
      const k = i.getAttribute('data-rule');
      vals[k] = i.type === 'checkbox' ? i.checked : Number(String(i.value).replace(',', '.'));
    }
    return A.cleanRulesAll(vals);
  }

  /* Eingabezeile direkt im Einstellungsdialog (ein zweiter Dialog würde ihn ersetzen) */
  function inlineAsk(after, label, value, onOk) {
    const old = after.parentNode.querySelector('.inline-ask');
    if (old) old.remove();
    const row = document.createElement('div');
    row.className = 'inline-ask';
    row.innerHTML = `<label class="field">${esc(label)}<input type="text" maxlength="60" value="${esc(value || '')}"></label><button type="button" class="btn primary small">Speichern</button><button type="button" class="btn outline small">Abbrechen</button>`;
    after.insertAdjacentElement('afterend', row);
    const inp = row.querySelector('input');
    const [ok, cancel] = row.querySelectorAll('button');
    const done = () => row.remove();
    ok.addEventListener('click', () => {
      onOk(inp.value.trim());
      done();
    });
    cancel.addEventListener('click', done);
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        ok.click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        done();
      }
    });
    inp.focus();
    inp.select();
  }

  function roomsList(body) {
    const list = rooms();
    let box = $('.rooms-inline', body);
    if (!box) {
      box = document.createElement('div');
      box.className = 'rooms-inline';
      $('[data-sact="manageRooms"]', body).closest('.btn-row').insertAdjacentElement('afterend', box);
    }
    box.innerHTML = list.length
      ? `<ul class="plans-list">${list.map((r) => `<li><span class="p-name"><strong>${esc(r.name)}</strong><small>${esc(r.desc)}</small></span><button type="button" class="icon-btn danger" data-delroom="${esc(r.rid)}" aria-label="${esc(r.name)} löschen" title="Löschen">${icon('i-trash')}</button></li>`).join('')}</ul>`
      : '<p class="desc">Noch keine eigenen Räume.</p>';
    box.onclick = (e) => {
      const d = e.target.closest('[data-delroom]');
      if (!d) return;
      const r = list.find((x) => x.rid === d.getAttribute('data-delroom'));
      if (r && window.confirm(`Raum „${r.name}“ löschen?`)) {
        store('rooms', load('rooms').filter((x) => x.id !== r.rid));
        roomsList(body);
      }
    };
  }

  /* Aktionen aus dem Einstellungsdialog */
  function settingsAct(act, body, helpers) {
    if (act === 'saveProfile') {
      inlineAsk($('[data-sact="saveProfile"]', body).closest('.btn-row'), 'Name des Profils', 'Mein Profil', (name) => {
        if (!name) return;
        const p = { id: 'u_' + uid(), name: name.slice(0, 60), desc: 'Eigenes Prüfprofil', values: readRuleInputs(body) };
        if (!store('profiles', load('profiles').concat(p))) return;
        const sel = $('#set-profile', body);
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name + ' (eigenes)';
        sel.insertBefore(opt, sel.querySelector('option[value="custom"]'));
        sel.value = p.id;
        helpers.fillProfile(p.id, true);
        ui().toast(`Profil „${p.name}“ gespeichert – mit „Übernehmen“ für diesen Plan verwenden.`);
      });
    } else if (act === 'delProfile') {
      const sel = $('#set-profile', body);
      const p = profiles().find((x) => x.id === sel.value);
      if (!p || !window.confirm(`Profil „${p.name}“ löschen? Pläne behalten ihre Werte.`)) return;
      store('profiles', load('profiles').filter((x) => x.id !== p.id));
      sel.querySelector(`option[value="${p.id}"]`).remove();
      sel.value = 'custom';
      helpers.fillProfile('custom', true);
    } else if (act === 'saveRoom') {
      inlineAsk($('[data-sact="saveRoom"]', body).closest('.btn-row'), 'Name des Raums', app.doc.name.replace(/^Seminarsitzordnung.*$/, 'Mein Raum'), (name) => {
        const r = saveRoom(name);
        if (r) {
          ui().toast(`Raum „${r.name}“ gespeichert – unter „Neuer Plan → Anderer Raum“.`);
          if ($('.rooms-inline', body)) roomsList(body);
        }
      });
    } else if (act === 'manageRooms') roomsList(body);
  }

  /* ---------- Dialog: Eigene Möbel & Räume ---------- */
  function furnitureThumb(spec, cls) {
    const key = 'c_preview';
    LLR.registerCustomType(key, spec);
    const d = T[key];
    const o = { type: key, x: 0, y: 0, rot: 0, w: spec.w, d: spec.shape === 'round' ? spec.w : spec.d, color: spec.color };
    const b = G.bbox([].concat(...d.parts(o)));
    const pad = Math.max(b.w, b.h) * 0.08 + 3;
    const svg = `<svg class="${cls || 'thumb'}" viewBox="${b.minX - pad} ${b.minY - pad} ${b.w + 2 * pad} ${b.h + 2 * pad}" aria-hidden="true">${d.draw(o)}</svg>`;
    delete T[key];
    return svg;
  }

  function openLibrary(view, editKey) {
    let mode = view || 'list';
    let key = editKey || null;
    const render = (body, foot) => {
      if (mode === 'edit') return renderEdit(body, foot);
      const fl = furniture();
      const rl = rooms();
      const tl = templates();
      const pl = profiles();
      let h = `<h3>Eigene Möbel (${fl.length})</h3>`;
      if (fl.length)
        h += `<ul class="lib-list">${fl
          .map((f) => `<li>${furnitureThumb(f.spec)}<span class="p-name"><strong>${esc(f.spec.name)}</strong><small>${f.spec.shape === 'round' ? 'Ø ' + f.spec.w : f.spec.w + ' × ' + f.spec.d} cm${f.spec.obstacle ? '' : ' · kein Hindernis'}${f.spec.tall ? ' · verdeckt die Sicht' : ''}</small></span>
            <button type="button" class="btn outline small" data-lib="insert" data-key="${f.key}">Einfügen</button>
            <button type="button" class="icon-btn" data-lib="edit" data-key="${f.key}" aria-label="${esc(f.spec.name)} bearbeiten" title="Bearbeiten">${icon('i-edit')}</button>
            <button type="button" class="icon-btn danger" data-lib="del" data-key="${f.key}" aria-label="${esc(f.spec.name)} löschen" title="Löschen">${icon('i-trash')}</button></li>`)
          .join('')}</ul>`;
      else h += `<p class="desc">Noch keine eigenen Möbel – z. B. ein Stehtisch, ein Klavier oder ein Regal, das es im LLR nicht gibt.</p>`;
      h += `<div class="btn-row"><button type="button" class="btn primary small" data-lib="new">${icon('i-plus')}Neues Möbelstück …</button></div>`;
      h += `<h3>Eigene Räume (${rl.length})</h3>`;
      h += rl.length ? `<ul class="plans-list">${rl.map((r) => `<li><span class="p-name"><strong>${esc(r.name)}</strong><small>${esc(r.desc)}</small></span><button type="button" class="icon-btn danger" data-lib="delroom" data-key="${esc(r.rid)}" aria-label="${esc(r.name)} löschen" title="Löschen">${icon('i-trash')}</button></li>`).join('')}</ul>` : `<p class="desc">Noch keine eigenen Räume.</p>`;
      h += `<div class="btn-row"><button type="button" class="btn outline small" data-lib="saveroom">${icon('i-save')}Aktuellen Raum speichern …</button></div><p class="desc">Ein eigener Raum enthält Raummaße und feste Einrichtung und steht unter „Neuer Plan → Anderer Raum“. Nischen und Vorsprünge: „Möbel → Raum &amp; Technik → Wandstück“.</p>`;
      h += `<h3>Weitere eigene Vorlagen</h3><p class="desc">${tl.length} eigene ${tl.length === 1 ? 'Anordnung' : 'Anordnungen'} (Reiter „Anordnungen“) · ${pl.length} eigene ${pl.length === 1 ? 'Prüfprofil' : 'Prüfprofile'} (Raum &amp; Einstellungen → Prüfregeln)</p>`;
      h += `<h3>Mit Kolleginnen und Kollegen teilen</h3><div class="btn-row"><button type="button" class="btn outline small" data-lib="export">${icon('i-download')}Alles exportieren (.json)</button><button type="button" class="btn outline small" data-lib="import">${icon('i-upload')}Importieren …</button></div><p class="desc">Die Datei enthält alle eigenen Möbel, Räume, Anordnungen und Prüfprofile. Beim Importieren kommen sie zur eigenen Bibliothek dazu.</p>`;
      body.innerHTML = h;
      foot.innerHTML = '<button class="btn primary" value="cancel">Schließen</button>';
    };
    const renderEdit = (body, foot) => {
      const f = key ? furniture().find((x) => x.key === key) : null;
      const spec = f ? clone(f.spec) : { name: '', shape: 'rect', w: 100, d: 60, color: 'blau', obstacle: true, tall: false };
      body.innerHTML = `<div class="furn-edit"><div class="furn-form">
          <label class="field">Name<input type="text" id="fe-name" maxlength="40" value="${esc(spec.name)}" placeholder="z. B. Stehtisch, Klavier, Werkbank"></label>
          <div class="sub-title">Form</div><div class="seg" role="radiogroup" aria-label="Form"><button type="button" role="radio" data-fshape="rect" aria-checked="${spec.shape !== 'round'}">Eckig</button><button type="button" role="radio" data-fshape="round" aria-checked="${spec.shape === 'round'}">Rund</button></div>
          <div class="field-grid two" style="margin-top:8px"><label class="field"><span id="fe-wl">${spec.shape === 'round' ? 'Durchmesser' : 'Breite'}</span> (cm)<input type="number" id="fe-w" value="${spec.w}" min="5" max="2000" step="5"></label><label class="field" id="fe-dwrap" ${spec.shape === 'round' ? 'hidden' : ''}>Tiefe (cm)<input type="number" id="fe-d" value="${spec.d}" min="5" max="2000" step="5"></label></div>
          <div class="sub-title">Farbe</div><div class="swatches">${Object.entries(LLR.FREE_COLORS).map(([k, c]) => `<button type="button" class="swatch" data-fcolor="${k}" style="background:${c.fill}" aria-pressed="${spec.color === k}" aria-label="${esc(c.label)}" title="${esc(c.label)}"></button>`).join('')}</div>
          <label class="toggle" style="margin-top:10px"><input type="checkbox" id="fe-obs" ${spec.obstacle ? 'checked' : ''}><span>Steht im Weg<small>Zählt bei Wegen, Rollstuhl-Check und Überschneidungen (z. B. nicht bei einer Bodenmarkierung)</small></span></label>
          <label class="toggle"><input type="checkbox" id="fe-tall" ${spec.tall ? 'checked' : ''}><span>Hoch – verdeckt die Sicht<small>z. B. Schrank, hohes Regal, Stellwand</small></span></label>
        </div><div class="furn-prev" id="fe-prev" aria-hidden="true"></div></div>`;
      const read = () => ({
        name: $('#fe-name').value.trim() || 'Eigenes Möbel',
        shape: $('[data-fshape][aria-checked="true"]').getAttribute('data-fshape'),
        w: Number($('#fe-w').value) || 100,
        d: Number($('#fe-d').value) || 60,
        color: ($('[data-fcolor][aria-pressed="true"]') || { getAttribute: () => 'grau' }).getAttribute('data-fcolor'),
        obstacle: $('#fe-obs').checked,
        tall: $('#fe-tall').checked,
      });
      const prev = () => ($('#fe-prev').innerHTML = furnitureThumb(read(), 'prev'));
      body.oninput = prev;
      body.onchange = prev;
      body.onclick = (e) => {
        const sh = e.target.closest('[data-fshape]');
        if (sh) {
          for (const b of $$('[data-fshape]', body)) b.setAttribute('aria-checked', String(b === sh));
          const round = sh.getAttribute('data-fshape') === 'round';
          $('#fe-dwrap').hidden = round;
          $('#fe-wl').textContent = round ? 'Durchmesser' : 'Breite';
          prev();
        }
        const c = e.target.closest('[data-fcolor]');
        if (c) {
          for (const b of $$('[data-fcolor]', body)) b.setAttribute('aria-pressed', String(b === c));
          prev();
        }
      };
      prev();
      foot.innerHTML = '';
      const btn = (label, cls, fn) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn ' + cls;
        b.textContent = label;
        b.addEventListener('click', fn);
        foot.appendChild(b);
      };
      btn('Zurück', 'outline', () => {
        mode = 'list';
        render(body, foot);
      });
      const save = (insert) => {
        const k = key || 'c_' + uid();
        if (!saveFurniture(k, read())) return;
        ui().renderCatalog();
        if (insert) {
          $('#dlg').close();
          app.addObject(k);
          ui().toast(`„${T[k].name}“ eingefügt – steht jetzt auch im Katalog unter „Eigene Möbel“.`);
          return;
        }
        key = null;
        mode = 'list';
        render(body, foot);
        ui().toast('Möbelstück gespeichert');
      };
      btn('Speichern', 'outline', () => save(false));
      btn('Speichern & einfügen', 'primary', () => save(true));
      setTimeout(() => $('#fe-name').focus(), 30);
    };
    ui().openDialog({
      title: 'Eigene Möbel & Räume',
      wide: true,
      body: '',
      buttons: [{ label: 'Schließen', value: 'cancel' }],
      keepFocus: true,
      onOpen: (body) => {
        const foot = $('#dlg-foot');
        render(body, foot);
        body.addEventListener('click', async (e) => {
          if (mode !== 'list') return;
          const b = e.target.closest('[data-lib]');
          if (!b) return;
          const a = b.getAttribute('data-lib');
          const k = b.getAttribute('data-key');
          if (a === 'new' || a === 'edit') {
            mode = 'edit';
            key = a === 'edit' ? k : null;
            render(body, foot);
          } else if (a === 'insert') {
            $('#dlg').close();
            app.addObject(k);
          } else if (a === 'del') {
            const f = furniture().find((x) => x.key === k);
            if (!f || !window.confirm(`„${f.spec.name}“ aus der Bibliothek löschen?`)) return;
            const used = deleteFurniture(k);
            ui().renderCatalog();
            render(body, foot);
            if (used) ui().toast('Gelöscht – im aktuellen Plan bleibt das Möbelstück erhalten.');
          } else if (a === 'delroom') {
            const r = rooms().find((x) => x.rid === k);
            if (r && window.confirm(`Raum „${r.name}“ löschen?`)) {
              store('rooms', load('rooms').filter((x) => x.id !== k));
              render(body, foot);
            }
          } else if (a === 'saveroom') {
            inlineAsk(b.closest('.btn-row'), 'Name des Raums', 'Mein Raum', (name) => {
              const r = saveRoom(name);
              if (r) {
                render(body, foot);
                ui().toast(`Raum „${r.name}“ gespeichert`);
              }
            });
          } else if (a === 'export') exportLibrary();
          else if (a === 'import') importLibrary(() => render(body, foot));
        });
      },
    });
  }

  function exportLibrary() {
    exportFile({ kind: 'library', furniture: load('furniture'), rooms: load('rooms'), templates: load('templates'), profiles: load('profiles') }, 'llr_bibliothek.llr.json');
  }

  /* Datei mit Bibliothek (oder einzelner Vorlage) einlesen */
  function importLibrary(done) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.addEventListener('change', async () => {
      const file = inp.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!data || data.kind !== 'library') throw new Error('kein Bibliotheksformat');
        let n = 0;
        const merge = (k, items, idKey) => {
          if (!Array.isArray(items) || !items.length) return;
          const list = load(k);
          for (const it of items) {
            if (!it || typeof it !== 'object') continue;
            if (list.some((x) => x[idKey] === it[idKey])) continue;
            list.push(it);
            n++;
          }
          store(k, list);
        };
        merge('furniture', data.furniture, 'key');
        merge('rooms', data.rooms, 'id');
        merge('templates', data.templates, 'id');
        merge('profiles', data.profiles, 'id');
        for (const f of load('furniture')) if (f && f.key) LLR.registerCustomType(f.key, f.spec);
        ui().renderCatalog();
        ui().renderPresets();
        ui().toast(n ? `${n} ${n === 1 ? 'Eintrag' : 'Einträge'} importiert` : 'Nichts Neues in der Datei.');
        if (done) done();
      } catch (err) {
        ui().toast('Die Datei ist keine LLR-Bibliothek (Möbel, Räume, Anordnungen, Prüfprofile).');
      }
    });
    inp.click();
  }

  /* Aktionen (js/ui.js → doAct) */
  function act(a) {
    if (a === 'saveTemplate') saveTemplateDialog();
    else if (a === 'importTemplate') importLibrary();
    else if (a === 'furniture') openLibrary('list');
    else if (a === 'newFurniture') openLibrary('edit');
    else if (a === 'exportLibrary') exportLibrary();
    else return false;
    return true;
  }

  LLR.custom = {
    templates,
    rooms,
    furniture,
    allProfiles,
    profileName,
    templateMenu,
    settingsAct,
    act,
    openLibrary,
  };
})((window.LLR = window.LLR || {}));

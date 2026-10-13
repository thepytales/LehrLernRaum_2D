/* Lernende & Sitzplan sowie Unterrichtsphasen & Umbau (Bibliothek links,
   Karten unter „Prüfen“, Phasen-Umschalter im Plan, Druck). */
(function (LLR) {
  'use strict';
  const A = LLR.analysis;
  const G = LLR.G;
  const T = LLR.TYPES;
  const app = LLR.app;
  const esc = LLR.esc;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const ui = () => LLR.ui;
  const icon = (id) => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
  const NEED_ICON = { hear: 'i-n-hear', see: 'i-n-see', wheel: 'i-wheelchair', calm: 'i-leaf', move: 'i-n-move', help: 'i-n-help', exit: 'i-n-exit' };
  const AVATAR = ['#1F6FEB', '#2F9E44', '#E8590C', '#7048E8', '#0C8599', '#C2255C', '#5C940D', '#D9480F', '#1864AB', '#862E9C'];
  const LV = ['ok', 'warn', 'bad'];

  const initials = (name) => {
    const p = String(name).trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : (p[0] || '').slice(1, 2))).toUpperCase();
  };
  const colorOf = (id) => {
    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return AVATAR[h % AVATAR.length];
  };
  const minutes = (sec) => Math.max(1, Math.round(sec / 60));

  /* Name eines Sitzplatzes für Listen und Druck */
  function seatName(o) {
    if (!o) return '–';
    if (o.label) return o.label;
    const same = app.doc.objects.filter((x) => x.type === o.type);
    return `${T[o.type].short} ${same.indexOf(o) + 1}`;
  }

  /* Bewertung aller Lernenden (nur berechnen, wenn gebraucht) */
  const fit = () => (app.learners().length ? app.getLearnerFit() : []);

  /* ---------- Lernende ---------- */
  function renderLearners() {
    const box = $('#tab-learners');
    if (!box || box.hidden) return;
    const list = app.learners();
    let h = `<p class="intro">Namen oder Kürzel eintragen, Bedarfe markieren und Plätze zuweisen: Person antippen, dann einen Platz im Plan – oder am Computer die Person auf einen Platz ziehen.</p>
      <div class="add-row"><input type="text" id="l-add" maxlength="40" placeholder="Name oder Kürzel" aria-label="Name oder Kürzel"><button class="btn primary small" data-lact="add">${icon('i-plus')}Hinzufügen</button></div>
      <button class="link-btn" data-lact="paste">Ganze Liste einfügen …</button>`;
    if (list.length) {
      const res = fit();
      const placed = res.filter((r) => r.seat).length;
      const open = res.filter((r) => r.st === 2).length;
      const part = res.filter((r) => r.st === 1).length;
      h += `<div class="summary-box"><span class="pill info">${list.length} Lernende</span><span class="pill ${placed === list.length ? 'ok' : 'warn'}">${placed} mit Platz</span>${open ? `<span class="pill bad">${open} Bedarf${open === 1 ? '' : 'e'} offen</span>` : ''}${part ? `<span class="pill warn">${part} teilweise</span>` : ''}</div>`;
      h += `<div class="btn-row" style="margin-top:0"><button class="btn primary small" data-lact="auto">${icon('i-shuffle')}Automatisch verteilen</button><button class="btn outline small" data-lact="lens" aria-pressed="${app.overlay.seating}">${icon('i-check')}${app.overlay.seating ? 'Prüfung ausblenden' : 'Im Plan prüfen'}</button></div>`;
      h += `<ul class="learner-list" style="margin-top:10px">`;
      const selSeat = app.selectedObjects().find((o) => o.learner);
      for (const r of res) {
        const l = r.learner;
        const st = new Map(r.checks.map((c) => [c.need, c.st]));
        const needs = (l.needs || []).map((k) => `<span class="need${r.seat ? ' st' + st.get(k) : ''}" title="${esc(A.NEED[k].long)}${r.seat ? ': ' + esc((r.checks.find((c) => c.need === k) || {}).text || '') : ''}">${icon(NEED_ICON[k])}</span>`).join('');
        const rel = (l.with || []).length + (l.apart || []).length;
        const where = r.seat ? `${esc(seatName(r.seat))}` : '<em>ohne Platz</em>';
        const cls = [app.placing === l.id ? 'placing' : '', selSeat && selSeat.learner === l.id ? 'active' : ''].join(' ');
        h += `<li class="${cls}" data-lid="${l.id}"><span class="avatar${r.seat ? '' : ' unplaced'}" style="background:${colorOf(l.id)}" draggable="true" title="Auf einen Platz ziehen">${esc(initials(l.name))}</span>
          <button class="l-main" data-lact="pick" title="${r.seat ? 'Platz zeigen bzw. neuen Platz antippen' : 'Antippen, dann einen Platz im Plan antippen'}"><strong>${esc(l.name)}</strong><small>${needs ? `<span class="needs">${needs}</span>` : ''}${rel ? `<span title="Sitzwünsche">${rel}× ↔</span>` : ''}<span>${where}</span></small></button>
          <button class="icon-btn small" data-lact="edit" aria-label="${esc(l.name)} bearbeiten" title="Bedarfe & Sitzwünsche">${icon('i-edit')}</button></li>`;
      }
      h += `</ul><div class="btn-row"><button class="btn outline small" data-lact="clear">Alle Plätze leeren</button><button class="btn outline small text-danger" data-lact="removeAll">${icon('i-trash')}Liste löschen</button><button class="btn outline small" data-lact="print">${icon('i-printer')}Sitzplan drucken</button></div>`;
    } else {
      h += `<p class="empty-note">Noch keine Lernenden. Tipp: Für eine erste Erprobung reichen Kürzel wie „A“, „B“, „C“.</p>`;
    }
    h += `<p class="privacy">${icon('i-lock')}<span>Datenschutz: am besten Kürzel oder Vornamen verwenden. Die Liste wird nur in diesem Browser gespeichert und beim Teilen nur auf ausdrücklichen Wunsch mitgeschickt.</span></p>`;
    const focusAdd = document.activeElement && document.activeElement.id === 'l-add';
    const val = focusAdd ? document.activeElement.value : '';
    box.innerHTML = h;
    if (focusAdd) {
      const i = $('#l-add');
      i.value = val;
      i.focus();
    }
  }

  function addFromInput() {
    const i = $('#l-add');
    const name = i.value.trim();
    if (!name) return i.focus();
    app.addLearners([name]);
    i.value = '';
    i.focus();
  }

  async function pasteDialog() {
    const v = await ui().openDialog({
      title: 'Liste einfügen',
      body: `<p>Eine Person pro Zeile (z. B. aus einer Tabelle kopiert). Am besten Kürzel oder Vornamen.</p><label class="field">Namen<textarea id="l-paste" rows="10" placeholder="Anna&#10;Ben&#10;C. K."></textarea></label>`,
      buttons: [
        { label: 'Abbrechen', value: 'cancel' },
        { label: 'Hinzufügen', value: 'ok', cls: 'primary' },
      ],
      keepFocus: true,
      onOpen: () => $('#l-paste').focus(),
    });
    if (v !== 'ok') return;
    const names = $('#l-paste').value.split(/\r?\n|;/).map((s) => s.split('\t')[0].trim()).filter(Boolean);
    if (!names.length) return;
    app.addLearners(names);
    ui().toast(`${names.length} Lernende hinzugefügt`);
  }

  async function editLearner(id) {
    const l = app.learnerById(id);
    if (!l) return;
    const others = app.learners().filter((x) => x.id !== id);
    const chips = (k) =>
      others.length
        ? `<div class="chip-select">${others.map((o) => `<label><input type="checkbox" data-rel="${k}" value="${o.id}" ${l[k].includes(o.id) ? 'checked' : ''}>${esc(o.name)}</label>`).join('')}</div>`
        : '<p class="desc">Noch keine weiteren Lernenden.</p>';
    const seat = app.seatOf(id);
    const v = await ui().openDialog({
      title: l.name,
      wide: true,
      body: `<div class="field-grid two"><label class="field">Name oder Kürzel<input type="text" id="le-name" value="${esc(l.name)}" maxlength="40"></label>
          <label class="field">Platz<input type="text" value="${esc(seat ? seatName(seat) : 'ohne Platz')}" disabled></label></div>
        <h3>Bedarfe</h3><div class="need-grid">${A.NEEDS.map((n) => `<label class="need-toggle"><input type="checkbox" data-need="${n.key}" ${l.needs.includes(n.key) ? 'checked' : ''}><span>${n.long}<small>${n.hint}</small></span></label>`).join('')}</div>
        <h3>Sitzt gern neben …</h3>${chips('with')}
        <h3>Soll nicht neben … sitzen</h3>${chips('apart')}
        <label class="field" style="margin-top:14px">Notiz (optional)<input type="text" id="le-note" value="${esc(l.note || '')}" maxlength="200" placeholder="z. B. braucht Tageslichtlampe"></label>`,
      buttons: [
        { label: 'Entfernen', value: 'remove', cls: 'outline text-danger' },
        { label: 'Abbrechen', value: 'cancel' },
        { label: 'Speichern', value: 'ok', cls: 'primary' },
      ],
    });
    if (v === 'remove') {
      if (await ui().confirmDlg('Entfernen?', `<p><strong>${esc(l.name)}</strong> aus der Liste entfernen? Der Platz wird frei.</p>`, 'Entfernen', true)) app.removeLearners([id]);
      return;
    }
    if (v !== 'ok') return;
    const body = $('#dlg-body');
    const needs = $$('[data-need]', body).filter((i) => i.checked).map((i) => i.getAttribute('data-need'));
    const rel = (k) => $$(`[data-rel="${k}"]`, body).filter((i) => i.checked).map((i) => i.value);
    const w = rel('with');
    const ap = rel('apart').filter((x) => !w.includes(x));
    const patch = { name: $('#le-name').value.trim().slice(0, 40) || l.name, needs, with: w, apart: ap };
    const note = $('#le-note').value.trim();
    if (note) patch.note = note;
    else patch.note = undefined;
    app.updateLearner(id, patch);
    const cur = app.learnerById(id);
    if (cur && cur.note === undefined) delete cur.note;
  }

  async function autoSeat() {
    const list = app.learners();
    const seats = app.doc.objects.filter(A.isSeat);
    if (!list.length) return;
    if (!seats.length) return ui().toast('Keine Sitzplätze im Plan.');
    const assigned = list.some((l) => app.seatOf(l.id));
    if (assigned && !(await ui().confirmDlg('Automatisch verteilen', `<p>Die bisherige Zuordnung wird ersetzt. Zuerst werden Lernende mit Bedarfen auf passende Plätze gesetzt, dann werden Sitzwünsche berücksichtigt.</p><p class="desc">Rückgängig mit <span class="kbd">Strg</span>+<span class="kbd">Z</span>.</p>`, 'Verteilen'))) return;
    const map = A.autoAssign(app.doc, app.getSeatInfo());
    app.applySeating(map);
    const res = app.getLearnerFit();
    const open = res.filter((r) => r.st === 2).length;
    const none = res.filter((r) => !r.seat).length;
    ui().toast(`${map.size} Lernende verteilt${none ? `, ${none} ohne Platz (zu wenige Plätze)` : ''}${open ? ` · ${open} Bedarf${open === 1 ? '' : 'e'} nicht erfüllbar` : ''}`);
    if (!app.overlay.seating) ui().setLens('seating', { keepView: true });
  }

  /* Person antippen → Platz antippen */
  function startPlacing(id) {
    const seat = app.seatOf(id);
    if (app.placing === id) return stopPlacing();
    app.placing = id;
    app.svg.classList.add('placing');
    if (seat) {
      app.select([seat.id]);
      ui().ensureVisible(seat);
    }
    ui().syncHint();
    renderLearners();
    if (ui().mobile()) ui().closeDrawers();
  }
  function stopPlacing() {
    app.placing = null;
    app.svg.classList.remove('placing');
    ui().syncHint();
    renderLearners();
  }

  function bindLearners() {
    const box = $('#tab-learners');
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-lact]');
      if (!b) return;
      const act = b.getAttribute('data-lact');
      const li = b.closest('[data-lid]');
      const id = li && li.getAttribute('data-lid');
      if (act === 'add') addFromInput();
      else if (act === 'paste') pasteDialog();
      else if (act === 'edit') editLearner(id);
      else if (act === 'pick') startPlacing(id);
      else if (act === 'auto') autoSeat();
      else if (act === 'lens') ui().setLens(app.overlay.seating ? null : 'seating', { keepView: true });
      else if (act === 'clear') app.clearSeating();
      else if (act === 'print') ui().printPlan('seating');
      else if (act === 'removeAll') {
        ui()
          .confirmDlg('Liste löschen?', `<p>Alle ${app.learners().length} Lernenden und ihre Plätze werden entfernt (rückgängig mit <span class="kbd">Strg</span>+<span class="kbd">Z</span>).</p>`, 'Löschen', true)
          .then((ok) => ok && app.removeLearners(app.learners().map((l) => l.id)));
      }
    });
    box.addEventListener('keydown', (e) => {
      if (e.target.id === 'l-add' && e.key === 'Enter') {
        e.preventDefault();
        addFromInput();
      }
    });
    // Ziehen & Ablegen auf einen Platz (Computer)
    box.addEventListener('dragstart', (e) => {
      const av = e.target.closest('.avatar');
      if (!av) return;
      e.dataTransfer.setData('text/llr-learner', av.closest('[data-lid]').getAttribute('data-lid'));
      e.dataTransfer.effectAllowed = 'move';
    });
    app.svg.addEventListener('drop', (e) => {
      const lid = e.dataTransfer.getData('text/llr-learner');
      if (!lid) return;
      e.preventDefault();
      const seat = app.seatAt(app.toWorld(e.clientX, e.clientY), 60);
      if (!seat) return ui().toast('Dort ist kein Sitzplatz – auf einen Stuhl, Hocker oder Rollstuhl ziehen.');
      app.assignLearner(seat.id, lid);
      app.select([seat.id]);
    });
    app.on('place', (seatId) => {
      const lid = app.placing;
      if (seatId && lid) {
        const prev = app.byId(seatId).learner;
        app.assignLearner(seatId, lid);
        app.select([seatId]);
        ui().toast(`${app.learnerName(lid)} sitzt jetzt hier${prev && prev !== lid ? ` – ${app.learnerName(prev)} hat keinen Platz mehr` : ''}.`);
      }
      stopPlacing();
    });
  }

  /* Feld „Person auf diesem Platz“ in den Details */
  function seatField(o) {
    const list = app.learners();
    if (!list.length) return `<p class="desc" style="margin:0 0 8px">Für einen Sitzplan: <button class="link-btn" data-act="openLearners">Lernende anlegen</button></p>`;
    const opts = list
      .map((l) => {
        const s = app.seatOf(l.id);
        return `<option value="${l.id}" ${o.learner === l.id ? 'selected' : ''}>${esc(l.name)}${s && s.id !== o.id ? ' (sitzt woanders)' : ''}</option>`;
      })
      .join('');
    return `<label class="field">Person auf diesem Platz<select data-seat-learner><option value="">– frei –</option>${opts}</select></label>`;
  }

  /* Bedarfe der Person auf diesem Platz (Details) */
  function seatChecks(o) {
    const r = fit().find((x) => x.seat && x.seat.id === o.id);
    if (!r) return '';
    const sym = ['check', 'bang', 'x'];
    if (!r.checks.length) return ui().mini('seating', ui().sglyph(0, 'check'), `Sitzplan: ${esc(r.learner.name)}`, 'Keine besonderen Bedarfe eingetragen', '');
    const lines = r.checks.map((c) => `${c.st === 0 ? '✓' : c.st === 1 ? '!' : '✗'} ${esc(c.label)}: ${esc(c.text)}`).join('<br>');
    return ui().mini('seating', ui().sglyph(r.st, sym[r.st]), `Bedarfe von ${esc(r.learner.name)}`, ['Passt', 'Teilweise passend', 'Passt nicht'][r.st], lines);
  }

  /* ---------- Phasen ---------- */
  function phaseStats(objs) {
    const tables = objs.filter(A.isTable).length;
    const seats = objs.filter((o) => T[o.type].seats).length;
    return `${tables} Tische · ${seats} Plätze`;
  }

  function rebuildBetween(i) {
    return A.rebuild(app.phaseObjects(i - 1), app.phaseObjects(i));
  }

  function rebuildLine(rb) {
    if (!rb.changes) return 'kein Umbau nötig';
    const parts = [];
    if (rb.tables) parts.push(`${rb.tables} Tische`);
    if (rb.seats) parts.push(`${rb.seats} Stühle`);
    if (rb.other) parts.push(`${rb.other} weitere`);
    return `${parts.join(', ')} · ca. ${minutes(rb.sec)} min allein, ${minutes(rb.sec / 4 + 30)} min zu viert`;
  }

  function renderPhases() {
    const box = $('#tab-phases');
    if (!box || box.hidden) return;
    const phases = app.phases();
    const cur = app.phaseIndex();
    const multi = !!app.doc.phases;
    let h = `<p class="intro">Eine Stunde in Phasen planen, z. B. Einstieg im Kreis → Gruppenarbeit → Präsentation. Jede Phase hat ihre eigene Anordnung; Raum, Lernende und Einstellungen gelten für alle.</p><ul class="phase-list">`;
    phases.forEach((ph, i) => {
      const objs = app.phaseObjects(i);
      if (i > 0) {
        const rb = rebuildBetween(i);
        h += `<div class="ph-rebuild">${icon('i-steps')}<span>Umbau: ${rebuildLine(rb)}</span>${rb.changes ? `<button class="icon-btn small" data-pact="play" data-i="${i}" title="Übergang abspielen" aria-label="Übergang zu Phase ${i + 1} abspielen">${icon('i-play')}</button>` : ''}</div>`;
      }
      const active = i === cur;
      h += `<li class="${active ? 'active' : ''}"><button class="ph-main" data-pact="go" data-i="${i}" aria-current="${active}">${ui().planPreview(objs, { room: app.doc.room })}<span><strong><span class="ph-no">${i + 1}</span>${esc(multi ? ph.name : app.doc.name)}</strong><small>${phaseStats(objs)}${active ? ' · wird bearbeitet' : ''}</small></span></button>`;
      if (active && multi)
        h += `<div class="ph-tools">
          <button class="icon-btn small" data-pact="rename" data-i="${i}" title="Umbenennen" aria-label="Phase umbenennen">${icon('i-edit')}</button>
          <button class="icon-btn small" data-pact="up" data-i="${i}" title="Nach vorn" aria-label="Phase nach vorn" ${i === 0 ? 'disabled' : ''}>${icon('i-chev-left')}</button>
          <button class="icon-btn small" data-pact="down" data-i="${i}" title="Nach hinten" aria-label="Phase nach hinten" ${i === phases.length - 1 ? 'disabled' : ''}>${icon('i-chev-right')}</button>
          <button class="icon-btn small" data-pact="dup" data-i="${i}" title="Kopie als nächste Phase" aria-label="Phase kopieren">${icon('i-copy')}</button>
          <button class="icon-btn small danger" data-pact="del" data-i="${i}" title="Phase löschen" aria-label="Phase löschen">${icon('i-trash')}</button></div>`;
      h += `</li>`;
    });
    h += `</ul><div class="btn-row"><button class="btn primary small" data-pact="dup">${icon('i-plus')}Phase hinzufügen</button><button class="btn outline small" data-pact="fromPreset">${icon('i-layout')}Aus Anordnung …</button></div>`;
    if (multi) {
      h += `<div class="btn-row">${cur > 0 ? `<button class="btn outline small" data-pact="lens" aria-pressed="${app.overlay.rebuild}">${icon('i-steps')}${app.overlay.rebuild ? 'Umbau ausblenden' : 'Umbau im Plan zeigen'}</button><button class="btn outline small" data-pact="print">${icon('i-printer')}Umbauplan drucken</button>` : ''}</div>`;
      h += `<label class="toggle"><input type="checkbox" data-pact-anim ${ui().panels.anim !== false ? 'checked' : ''}><span>Übergang beim Wechseln abspielen<small>Erst Tische und große Möbel, dann die Stühle</small></span></label>`;
    } else {
      h += `<p class="empty-note">„Phase hinzufügen“ legt eine Kopie der jetzigen Anordnung als Phase 2 an. Dort umstellen – der Umbau wird automatisch berechnet.</p>`;
    }
    box.innerHTML = h;
  }

  function goPhase(i) {
    app.setPhase(i, { animate: ui().panels.anim !== false });
  }

  function playTo(i) {
    if (i <= 0) return;
    if (app.phaseIndex() !== i) app.setPhase(i);
    app.playTransition(app.phaseObjects(i - 1), app.doc.objects);
  }

  async function renamePhase(i) {
    const ph = app.phases()[i];
    const v = await ui().openDialog({
      title: 'Phase umbenennen',
      body: `<label class="field">Name der Phase<input type="text" id="ph-name" value="${esc(ph.name)}" maxlength="60" list="ph-names"></label><datalist id="ph-names">${['Einstieg', 'Erarbeitung', 'Gruppenarbeit', 'Partnerarbeit', 'Einzelarbeit', 'Präsentation', 'Sicherung', 'Reflexion', 'Stuhlkreis'].map((n) => `<option value="${n}"></option>`).join('')}</datalist>`,
      buttons: [
        { label: 'Abbrechen', value: 'cancel' },
        { label: 'Übernehmen', value: 'ok', cls: 'primary' },
      ],
      keepFocus: true,
      onOpen: () => {
        const i2 = $('#ph-name');
        i2.focus();
        i2.select();
        i2.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            $('#dlg').close('ok');
          }
        });
      },
    });
    if (v === 'ok') app.renamePhase(i, $('#ph-name').value);
  }

  async function phaseFromPreset() {
    const v = await ui().openDialog({
      title: 'Neue Phase aus einer Anordnung',
      body: `<p>Die neue Phase kommt hinter die aktuelle. Tische und Stühle werden wiederverwendet, damit der Umbau sichtbar wird.</p>${LLR.PRESETS.map((p, i) => `<label class="toggle"><input type="radio" name="ph-preset" value="${p.id}" ${i === 0 ? 'checked' : ''}><span>${esc(p.name)}<small>${esc(p.persons)}</small></span></label>`).join('')}`,
      buttons: [
        { label: 'Abbrechen', value: 'cancel' },
        { label: 'Phase anlegen', value: 'ok', cls: 'primary' },
      ],
    });
    if (v !== 'ok') return;
    const sel = $('#dlg-body input[name=ph-preset]:checked');
    if (!sel) return;
    const from = app.doc.objects;
    app.addPhase(sel.value);
    if (ui().panels.anim !== false) app.playTransition(from, app.doc.objects);
  }

  function bindPhases() {
    const box = $('#tab-phases');
    box.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-pact]');
      if (!b) return;
      const act = b.getAttribute('data-pact');
      const i = Number(b.getAttribute('data-i'));
      if (act === 'go') goPhase(i);
      else if (act === 'play') playTo(i);
      else if (act === 'rename') renamePhase(i);
      else if (act === 'up') app.movePhase(i, -1);
      else if (act === 'down') app.movePhase(i, 1);
      else if (act === 'dup') {
        app.addPhase(null);
        ui().toast('Neue Phase als Kopie angelegt – jetzt umstellen.');
      } else if (act === 'fromPreset') phaseFromPreset();
      else if (act === 'del') {
        const ph = app.phases()[i];
        if (await ui().confirmDlg('Phase löschen?', `<p>Phase <strong>${esc(ph.name)}</strong> mit ihrer Anordnung löschen? (Rückgängig mit <span class="kbd">Strg</span>+<span class="kbd">Z</span>.)</p>`, 'Löschen', true)) app.removePhase(i);
      } else if (act === 'lens') ui().setLens(app.overlay.rebuild ? null : 'rebuild', { keepView: true });
      else if (act === 'print') ui().printPlan('rebuild');
    });
    box.addEventListener('change', (e) => {
      if (!e.target.hasAttribute('data-pact-anim')) return;
      ui().panels.anim = e.target.checked;
      ui().savePanels();
    });
  }

  /* Umschalter oben rechts im Plan */
  function renderPhaseBar() {
    const bar = $('#phase-bar');
    const multi = !!app.doc.phases;
    bar.hidden = !multi;
    if (!multi) return;
    const i = app.phaseIndex();
    const n = app.doc.phases.length;
    $('#phase-num').textContent = `Phase ${i + 1} / ${n}`;
    $('#phase-name').textContent = app.doc.phases[i].name;
    bar.querySelector('[data-ph="prev"]').disabled = i === 0;
    bar.querySelector('[data-ph="next"]').disabled = i === n - 1;
  }

  function bindPhaseBar() {
    $('#phase-bar').addEventListener('click', (e) => {
      const b = e.target.closest('[data-ph]');
      if (!b) return;
      const k = b.getAttribute('data-ph');
      const i = app.phaseIndex();
      if (k === 'prev') goPhase(i - 1);
      else if (k === 'next') goPhase(i + 1);
      else if (k === 'open') ui().openLibTab('phases');
    });
  }

  /* ---------- Karten unter „Prüfen“ ---------- */
  function checkCards(lensCard) {
    let h = '';
    const list = app.learners();
    if (list.length) {
      const res = fit();
      const placed = res.filter((r) => r.seat).length;
      const open = res.filter((r) => r.st === 2).length;
      const part = res.filter((r) => r.st === 1).length;
      const lv = open ? 2 : part || placed < list.length ? 1 : 0;
      h += lensCard('seating', 'i-users', 'Sitzplan & Bedarfe', `${placed}/${list.length} mit Platz${open ? ` · ${open} offen` : ''}${part ? ` · ${part} teilweise` : ''}`, lv, () => {
        let b = '';
        const issues = res.filter((r) => r.st >= 1 || !r.seat);
        if (!issues.length) b += `<div class="check-row ok">${icon('i-check')}<span class="txt">Alle Bedarfe und Sitzwünsche sind erfüllt.</span></div>`;
        else {
          b += `<ul class="issue-list">`;
          for (const r of issues) {
            const lvl = r.seat ? r.st : 1;
            const txt = r.seat ? r.checks.filter((c) => c.st > 0).map((c) => `${esc(c.label)}: ${esc(c.text)}`).join(' · ') : 'hat noch keinen Platz';
            const wheel = (r.learner.needs || []).includes('wheel') && (!r.seat || r.seat.type !== 'wheelchair');
            b += `<li>${ui().sglyph(lvl, ['check', 'bang', 'x'][lvl])}<button data-act="${r.seat ? 'selSeat:' + r.seat.id : 'openLearners'}"><strong>${esc(r.learner.name)}</strong><small>${txt}</small></button>${wheel ? `<button class="btn outline small" data-act="wheelSpot:${r.learner.id}" title="Test-Rollstuhl an eine erreichbare Tischkante stellen">${icon('i-wheelchair')}Platz einrichten</button>` : ''}</li>`;
          }
          b += `</ul>`;
        }
        b += `<div class="btn-row"><button class="btn primary small" data-act="autoSeat">${icon('i-shuffle')}Automatisch verteilen</button><button class="btn outline small" data-act="openLearners">Lernende bearbeiten</button></div>`;
        b += `<p class="callout">Geprüft wird je Person, ob der Platz zu den markierten Bedarfen passt (z. B. Hören: nah an Tafel und Lehrkraft, Gesicht der Lehrkraft im Blick) und ob Sitzwünsche erfüllt sind (nebeneinander = bis 1,6 m).</p>`;
        return b;
      });
    }
    if (app.doc.phases && app.phaseIndex() > 0) {
      const i = app.phaseIndex();
      const rb = rebuildBetween(i);
      const prev = app.phases()[i - 1].name;
      h += lensCard('rebuild', 'i-steps', `Umbau von „${esc(prev)}“`, rebuildLine(rb), rb.changes ? (rb.sec > 600 ? 1 : 0) : 0, () => {
        let b = `<table class="stat-table"><tr><td>Tische</td><td>${rb.tables}</td></tr><tr><td>Stühle und Hocker</td><td>${rb.seats}</td></tr><tr><td>Weitere Möbel</td><td>${rb.other}</td></tr><tr><td>Wege zusammen</td><td>${ui().m1(rb.distSum)}</td></tr><tr><td>Zeit allein / zu viert</td><td>ca. ${minutes(rb.sec)} / ${minutes(rb.sec / 4 + 30)} min</td></tr></table>`;
        const steps = LLR.rebuildSteps(rb);
        if (steps.length) b += `<div class="sub-title">Reihenfolge (Nummern im Plan)</div><ol class="steps">${steps.slice(0, 12).map((s) => `<li>${esc(s.text)}</li>`).join('')}${steps.length > 12 ? `<li>… und ${steps.length - 12} weitere</li>` : ''}</ol>`;
        b += `<div class="btn-row"><button class="btn primary small" data-act="playRebuild">${icon('i-play')}Übergang abspielen</button><button class="btn outline small" data-act="printRebuild">${icon('i-printer')}Umbauplan drucken</button></div>`;
        b += `<p class="callout">Grobe Schätzung: je Tisch ca. 15 s, je Stuhl ca. 6 s, dazu der Weg. Lila gestrichelt ist die Position in der vorigen Phase.</p>`;
        return b;
      });
    }
    return h;
  }

  /* Rollstuhlplatz einrichten: Test-Rollstuhl an die erste von der Tür aus
     erreichbare Tischkante stellen und die Person dorthin setzen */
  function wheelSpot(lid) {
    const S = app.doc.settings;
    const a = app.access && app.access.complete ? app.access : A.access(app.doc, { image: false });
    // Plätze nach Weglänge von der Tür; genommen wird der erste, an dem der
    // Rollstuhl (70 × 120 cm) nirgends aneckt und noch keiner steht
    const W = app.doc.room.w;
    const L = app.doc.room.l;
    const cands = [];
    for (const t of a.tables) for (const sp of t.spots) if (sp.now) cands.push({ o: app.byId(t.id), sp });
    cands.sort((x, y) => x.sp.cells.length - y.sp.cells.length);
    const build = (c) => {
      const poly = A.worldParts(c.o, S)[0];
      const e = c.sp.edge;
      const n = G.edgeNormal(poly, e);
      const q = G.closestOnSeg(c.sp.p, poly[e], poly[(e + 1) % poly.length]);
      const p = G.add(q, G.mul(n, 120 / 2 - 22));
      return { id: LLR.newId(), type: 'wheelchair', x: p.x, y: p.y, rot: G.rotFacing(G.mul(n, -1)), w: 70, d: 120, learner: lid };
    };
    const clear = (w, table) => {
      const body = A.worldParts(w, S)[0];
      const bb = G.bbox(body);
      if (bb.minX < 0 || bb.minY < 0 || bb.maxX > W || bb.maxY > L) return false;
      for (const o of app.doc.objects) {
        if (o === table) continue;
        if (!A.isObstacle(o, S, false) && o.type !== 'wheelchair') continue;
        if (A.worldParts(o, S).some((pl) => G.satDepth(pl, body) > 1.5)) return false;
      }
      return true;
    };
    let w = null;
    for (const c of cands) {
      const cand = build(c);
      if (clear(cand, c.o)) {
        w = cand;
        break;
      }
    }
    if (!cands.length) {
      ui().toast('Kein Tisch mit erreichbarem Rollstuhlplatz – im Rollstuhl-Check zuerst Platz schaffen.');
      ui().setLens('access', { keepView: true });
      return;
    }
    let squeezed = false;
    if (!w) {
      w = build(cands[0]);
      squeezed = true;
    }
    app.mutate((doc) => {
      for (const o of doc.objects) if (o.learner === lid) delete o.learner;
      doc.objects.push(w);
    });
    app.select([w.id]);
    ui().ensureVisible(w);
    ui().toast(squeezed ? `Rollstuhlplatz für ${app.learnerName(lid)} eingerichtet – dort eckt er noch an: Stuhl daneben wegstellen.` : `Rollstuhlplatz für ${app.learnerName(lid)} eingerichtet – bei Bedarf verschieben.`);
  }

  /* Aktionen aus Details/Prüfen */
  function act(a) {
    if (a.startsWith('wheelSpot:')) wheelSpot(a.slice(10));
    else if (a === 'autoSeat') autoSeat();
    else if (a === 'playRebuild') playTo(app.phaseIndex());
    else if (a.startsWith('selSeat:')) {
      const id = a.slice(8);
      app.select([id]);
      ui().ensureVisible(app.byId(id));
    }
  }

  /* Tabelle für den Sitzplan-Druck */
  function printTable() {
    const res = fit();
    if (!res.length) return '';
    let h = `<table style="margin-top:4mm"><tr><th>Person</th><th>Platz</th><th>Bedarfe & Sitzwünsche</th></tr>`;
    for (const r of res) {
      const txt = r.checks.length ? r.checks.map((c) => `${c.st === 0 ? '✓' : c.st === 1 ? '!' : '✗'} ${esc(c.label)}: ${esc(c.text)}`).join('<br>') : '–';
      h += `<tr><td><strong>${esc(r.learner.name)}</strong>${r.learner.note ? `<br><small>${esc(r.learner.note)}</small>` : ''}</td><td>${r.seat ? esc(seatName(r.seat)) : 'ohne Platz'}</td><td>${r.seat ? txt : (r.learner.needs || []).map((k) => A.NEED[k].label).join(', ') || '–'}</td></tr>`;
    }
    return h + `</table>`;
  }

  /* Anzahl an den Reitern „Lernende“ und „Phasen“ */
  function setCount(btn, n) {
    let c = btn.querySelector('.count');
    if (!n) {
      if (c) c.remove();
      return;
    }
    if (!c) {
      c = document.createElement('span');
      c.className = 'count';
      btn.appendChild(c);
    }
    c.textContent = n;
  }

  function render() {
    renderLearners();
    renderPhases();
    renderPhaseBar();
    setCount($('#tab-btn-learners'), app.learners().length);
    setCount($('#tab-btn-phases'), app.doc.phases ? app.doc.phases.length : 0);
  }

  LLR.classUI = {
    bind() {
      bindLearners();
      bindPhases();
      bindPhaseBar();
    },
    render,
    onTab(tab) {
      if (tab === 'learners') renderLearners();
      if (tab === 'phases') renderPhases();
      ui().syncNeeds();
    },
    onSelect() {
      if (!$('#tab-learners').hidden) renderLearners();
    },
    onAnalysis() {
      if (!$('#tab-learners').hidden) renderLearners();
    },
    seatField,
    seatChecks,
    checkCards,
    printTable,
    act,
  };
})((window.LLR = window.LLR || {}));

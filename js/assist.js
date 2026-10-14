/* Geführte Abläufe: Startauswahl „Was möchten Sie tun?“, Assistent
   „Stunde planen“, Drucken mit der Frage „Für wen?“ und kurze Tipps im
   richtigen Moment (je Tipp nur einmal). */
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
  const NEED_ICON = { hear: 'i-n-hear', see: 'i-n-see', wheel: 'i-wheelchair', calm: 'i-leaf', move: 'i-n-move', help: 'i-n-help', exit: 'i-n-exit' };
  const sglyph = (lv) => ui().sglyph(lv, ['check', 'bang', 'x'][lv]);

  /* ---------- Tipps im richtigen Moment ---------- */
  function tip(key, text) {
    if (!LLR.prefs || LLR.prefs.tipSeen(key)) return false;
    LLR.prefs.markTip(key);
    ui().toast(text, 7000);
    return true;
  }

  /* Dialog schließen und danach etwas anderes öffnen */
  const thenDo = (fn) => {
    const dlg = $('#dlg');
    if (dlg.open) dlg.close('cancel');
    setTimeout(fn, 30);
  };

  /* ---------- Startauswahl ---------- */
  const TASKS = [
    { act: 'wizard', ic: 'i-wand', title: 'Eine Stunde planen', text: 'Schritt für Schritt: Lerngruppe, Sozialform, Anordnung und Lernende – mit Prüfung und Druck.' },
    { act: 'startSeating', ic: 'i-users', title: 'Sitzplan für meine Klasse', text: 'Namen einfügen, Bedarfe markieren und automatisch auf passende Plätze verteilen.' },
    { act: 'startWheel', ic: 'i-wheelchair', title: 'Raum für eine Person im Rollstuhl prüfen', text: 'Befahrbare Wege, Wenden und Rollstuhlplätze sehen – mit einem Test-Rollstuhl zum Ausprobieren.' },
    { act: 'startPhases', ic: 'i-steps', title: 'Stunde mit mehreren Phasen', text: 'Zum Beispiel Stuhlkreis → Gruppenarbeit → Präsentation, mit Umbauplan.' },
    { act: 'startFree', ic: 'i-box', title: 'Frei einrichten', text: 'Fertige Bausteine und einzelne Möbel selbst in den Raum stellen.' },
  ];

  function openStart(opts) {
    opts = opts || {};
    const P = LLR.prefs;
    const pro = P.isPro();
    const cont = !opts.first && app.doc && app.doc.objects.length ? `<button type="button" class="task cont" data-task="continue">${icon('i-chev-right')}<span><strong>Weiter mit „${esc(app.doc.name)}“</strong><small>Den zuletzt bearbeiteten Plan öffnen</small></span></button>` : '';
    ui().openDialog({
      title: 'Was möchten Sie tun?',
      wide: true,
      body: `<div class="task-grid">${cont}${TASKS.map((t) => `<button type="button" class="task" data-task="${t.act}">${icon(t.ic)}<span><strong>${t.title}</strong><small>${t.text}</small></span></button>`).join('')}</div>
        <div class="start-foot">
          <div class="start-opt"><span id="start-level-l">Ansicht</span><div class="seg" role="radiogroup" aria-labelledby="start-level-l"><button type="button" role="radio" data-slevel="einfach" aria-checked="${!pro}">Einfach</button><button type="button" role="radio" data-slevel="profi" aria-checked="${pro}">Profi</button></div><small>Einfach: das Wichtigste, Prüfungen als Fragen · Profi: alle Werkzeuge</small></div>
          <button type="button" class="link-btn" data-task="a11y">${icon('i-contrast')}Darstellung anpassen (Kontrast, Schriftgröße …)</button>
          <label class="toggle"><input type="checkbox" id="start-again" ${P.get('start') ? 'checked' : ''}><span>Diese Auswahl bei jedem Start zeigen</span></label>
        </div>`,
      buttons: [
        { label: 'Hilfe', onClick: () => thenDo(() => ui().openHelp()) },
        { label: 'Schließen', value: 'cancel', cls: 'primary' },
      ],
      keepFocus: true,
      onOpen: (body) => {
        const first = $('.task', body);
        if (first) first.focus();
        body.addEventListener('click', (e) => {
          const lv = e.target.closest('[data-slevel]');
          if (lv) {
            ui().setLevel(lv.getAttribute('data-slevel'), { quiet: true });
            for (const b of $$('[data-slevel]', body)) b.setAttribute('aria-checked', String(b === lv));
            return;
          }
          const t = e.target.closest('[data-task]');
          if (!t) return;
          const a = t.getAttribute('data-task');
          thenDo(() => (a === 'continue' ? null : a === 'a11y' ? ui().doAct('a11y') : act(a)));
        });
        $('#start-again', body).addEventListener('change', (e) => P.set('start', e.target.checked));
      },
    });
  }

  function startSeating() {
    ui().openLibTab('learners');
    if (!app.learners().length) {
      if (LLR.classUI) LLR.classUI.paste();
    } else ui().toast('Bedarfe über das Stift-Symbol eintragen, dann „Automatisch verteilen“.', 6000);
  }

  function startWheel() {
    ui().doAct('wheelchair');
    ui().showRightView('checks');
    ui().toast('Grün = befahrbar, dunkelgrün = Wenden möglich, rot = zu eng. Den Test-Rollstuhl verschieben und drehen; einen Tisch antippen zeigt den Weg von der Tür.', 9000);
  }

  /* ---------- Assistent „Stunde planen“ ---------- */
  const STEPS = ['Lerngruppe', 'Anordnung', 'Lernende', 'Ergebnis'];

  function candidates(st) {
    const list = LLR.PRESETS.concat(LLR.custom ? LLR.custom.templates() : []);
    return list
      .map((p) => {
        const seats = LLR.presetSeats(p);
        const formOk = !st.form || (p.forms || []).includes(st.form);
        const fits = seats >= st.count;
        return { p, seats, formOk, fits, score: (formOk ? 0 : 1000) + (fits ? seats - st.count : 300 + (st.count - seats)) };
      })
      .sort((a, b) => a.score - b.score);
  }

  function openWizard(opts) {
    opts = opts || {};
    const st = {
      step: 0,
      count: app.learners().length || 20,
      form: null,
      multi: !!opts.multi,
      picks: [],
      learners: app.learners().map((l) => ({ id: l.id, name: l.name, needs: (l.needs || []).slice() })),
      applied: false,
      undoDepth: 0,
    };
    let body;
    let foot;

    const stepper = () => `<ol class="wiz-steps">${STEPS.map((n, i) => `<li${i === st.step ? ' aria-current="step"' : ''} class="${i < st.step ? 'done' : ''}"><span>${i + 1}</span>${n}</li>`).join('')}</ol>`;

    function stepGroup() {
      return `<h3>Wie viele Lernende sind dabei?</h3>
        <div class="stepper"><button type="button" class="icon-btn" data-w="minus" aria-label="Eine Person weniger">${icon('i-minus')}</button><input type="number" id="wiz-count" min="1" max="60" value="${st.count}" aria-label="Anzahl der Lernenden"><button type="button" class="icon-btn" data-w="plus" aria-label="Eine Person mehr">${icon('i-plus')}</button><span class="desc">Personen</span></div>
        <h3>Wie wird gearbeitet?</h3>
        <div class="chips" role="radiogroup" aria-label="Sozialform">${LLR.FORMS.map((f) => `<button type="button" class="chip" role="radio" data-wform="${f.id}" aria-checked="${st.form === f.id}">${esc(f.name)}</button>`).join('')}<button type="button" class="chip" role="radio" data-wform="" aria-checked="${!st.form}">Noch offen</button></div>
        <h3>Wie ist die Stunde aufgebaut?</h3>
        <label class="toggle"><input type="radio" name="wiz-multi" value="0" ${st.multi ? '' : 'checked'}><span>Eine Anordnung für die ganze Stunde</span></label>
        <label class="toggle"><input type="radio" name="wiz-multi" value="1" ${st.multi ? 'checked' : ''}><span>Mehrere Phasen<small>z. B. Stuhlkreis → Gruppenarbeit → Präsentation – mit Umbauplan dazwischen</small></span></label>
        ${app.doc.phases ? `<p class="callout">Der aktuelle Plan hat schon ${app.doc.phases.length} Phasen – sie werden durch die neue Planung ersetzt (rückgängig mit <span class="kbd">Strg</span>+<span class="kbd">Z</span>).</p>` : ''}`;
    }

    function stepArrangement() {
      const list = candidates(st);
      const hint = st.multi ? 'Anordnungen in der Reihenfolge der Phasen antippen – die Nummer zeigt die Phase. Erneut antippen entfernt sie.' : 'Eine Anordnung antippen. Oben stehen die passendsten.';
      let h = `<p class="desc">${hint}</p><div class="wiz-cards">`;
      for (const c of list) {
        const i = st.picks.indexOf(c.p.id);
        const badge = c.fits ? `<span class="pill ok">${c.seats} Plätze – passt</span>` : `<span class="pill warn">nur ${c.seats} Plätze</span>`;
        const form = c.formOk && st.form ? '<span class="pill info">passende Sozialform</span>' : '';
        const objs = c.p.custom ? c.p.build() : LLR.colorChairs(c.p.build(LLR.DEFAULT_SETTINGS, LLR.DEFAULT_ROOM));
        h += `<button type="button" class="wiz-card" data-wpick="${esc(c.p.id)}" aria-pressed="${i >= 0}">${i >= 0 ? `<span class="wiz-no" aria-label="Phase ${i + 1}">${st.multi ? i + 1 : '✓'}</span>` : ''}${ui().planPreview(objs)}<span><strong>${esc(c.p.name)}</strong><span class="pills">${badge}${form}</span></span></button>`;
      }
      return h + `</div>`;
    }

    function stepLearners() {
      let h = `<p class="desc">Optional: Namen oder Kürzel eintragen und Bedarfe antippen. Dann verteilt der Planer alle auf passende Plätze. Am besten Kürzel verwenden – die Liste bleibt in diesem Browser.</p>
        <div class="wiz-add"><label class="field">Namen hinzufügen (eine Person pro Zeile)<textarea id="wiz-names" rows="3" placeholder="Anna&#10;Ben&#10;C. K."></textarea></label><button type="button" class="btn outline small" data-w="addnames">${icon('i-plus')}Hinzufügen</button></div>`;
      if (st.learners.length) {
        h += `<ul class="wiz-learners">${st.learners
          .map(
            (l, i) => `<li><strong>${esc(l.name)}</strong><span class="need-btns">${A.NEEDS.map((n) => `<button type="button" class="need-btn" data-wneed="${i}:${n.key}" aria-pressed="${l.needs.includes(n.key)}" title="${esc(n.long)}: ${esc(n.hint)}" aria-label="${esc(l.name)}: ${esc(n.long)}">${icon(NEED_ICON[n.key])}</button>`).join('')}</span><button type="button" class="icon-btn small danger" data-wdel="${i}" aria-label="${esc(l.name)} entfernen" title="Entfernen">${icon('i-x')}</button></li>`
          )
          .join('')}</ul>`;
        h += `<p class="desc">${st.learners.length} Lernende · Symbole: ${A.NEEDS.map((n) => n.label).join(', ')}.</p>`;
      } else h += `<p class="empty-note">Noch keine Lernenden – Sie können den Schritt auch überspringen.</p>`;
      return h;
    }

    function stepResult() {
      // Rollstuhl-Prüfung sofort rechnen (sonst läuft sie nur bei sichtbarem „Prüfen“)
      if (!app.access || !app.access.complete) app.access = A.access(app.doc, { image: !!app.overlay.access });
      const res = LLR.checkResults();
      const Q = LLR.QUESTIONS;
      let h = `<p class="desc">Fertig – ${st.picks.length > 1 ? `${st.picks.length} Phasen sind angelegt, die erste ist im Plan zu sehen` : 'die Anordnung steht im Plan'}${st.learners.length ? ' und alle Lernenden haben einen Platz bekommen' : ''}. Rückgängig mit <span class="kbd">Strg</span>+<span class="kbd">Z</span>.</p><ul class="wiz-results">`;
      for (const k of ['access', 'sight', 'teacher', 'calm']) {
        const r = res[k];
        h += `<li>${r.lv >= 0 ? sglyph(r.lv) : ''}<span><strong>${esc(Q[k])}</strong><small>${esc(r.ans)}</small></span></li>`;
      }
      if (st.learners.length) {
        const fit = app.getLearnerFit();
        const open = fit.filter((r) => r.st === 2).length;
        const none = fit.filter((r) => !r.seat).length;
        const lv = none || open ? 2 : fit.some((r) => r.st === 1) ? 1 : 0;
        h += `<li>${sglyph(lv)}<span><strong>${esc(Q.seating)}</strong><small>${none ? `${none} ohne Platz (zu wenige Plätze).` : open ? `Bei ${open} ${open === 1 ? 'Person passt' : 'Personen passt'} der Platz nicht – im Reiter „Lernende“ nachbessern.` : lv ? 'Fast überall – Einzelheiten unter „Prüfen“.' : 'Ja – alle Bedarfe sind erfüllt.'}</small></span></li>`;
      }
      h += `</ul><h3>Drucken</h3><div class="btn-row wrap">`;
      if (st.learners.length) h += `<button type="button" class="btn outline small" data-wprint="class">${icon('i-users')}Aushang für die Klasse</button><button type="button" class="btn outline small" data-wprint="seating">${icon('i-printer')}Sitzplan für mich</button>`;
      h += `<button type="button" class="btn outline small" data-wprint="rebuild">${icon('i-steps')}${st.picks.length > 1 ? 'Umbaukarten' : 'Aufbaukarte'}</button><button type="button" class="btn outline small" data-wprint="plan">${icon('i-file-plus')}Für den Unterrichtsentwurf</button></div>`;
      return h;
    }

    function apply() {
      const before = app.undoStack.length;
      const rows = st.learners;
      app.batch(() => {
        if (app.doc.phases) {
          app.mutate((doc) => {
            delete doc.phases;
            delete doc.phase;
          });
        }
        const [first, ...rest] = st.picks;
        app.applyPreset(first);
        for (const id of rest) app.addPhase(id);
        if (rest.length) app.setPhase(0);
        app.mutate((doc) => {
          const ids = new Set(rows.map((r) => r.id));
          const old = doc.learners || [];
          if (!rows.length) delete doc.learners;
          else
            doc.learners = rows.map((r) => {
              const o = old.find((l) => l.id === r.id);
              const l = { id: r.id, name: r.name, needs: r.needs.slice(), with: o ? o.with.filter((x) => ids.has(x)) : [], apart: o ? o.apart.filter((x) => ids.has(x)) : [] };
              if (o && o.note) l.note = o.note;
              return l;
            });
          for (const o of app.allObjects()) if (o.learner && !ids.has(o.learner)) delete o.learner;
        });
        if (rows.length) {
          const n = app.doc.phases ? app.doc.phases.length : 1;
          for (let i = 0; i < n; i++) {
            if (app.doc.phases) app.setPhase(i);
            app.applySeating(A.autoAssign(app.doc, app.getSeatInfo()));
          }
          if (app.doc.phases) app.setPhase(0);
        }
        if (rest.length) {
          const names = st.picks.map((id) => (LLR.findPreset(id) || {}).name || '').filter(Boolean);
          app.mutate((doc) => (doc.name = ('Stunde: ' + names.join(' → ')).slice(0, 120)));
        }
      }, 'Stunde mit dem Assistenten geplant');
      st.applied = app.undoStack.length > before;
      app.fitView();
    }

    function render() {
      const views = [stepGroup, stepArrangement, stepLearners, stepResult];
      body.innerHTML = stepper() + `<div class="wiz-body">${views[st.step]()}</div>`;
      foot.innerHTML = '';
      const btn = (label, cls, fn, dis) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn ' + cls;
        b.textContent = label;
        b.disabled = !!dis;
        b.addEventListener('click', fn);
        foot.appendChild(b);
        return b;
      };
      if (st.step === 0) btn('Abbrechen', 'outline', () => $('#dlg').close('cancel'));
      else if (st.step < 3) btn('Zurück', 'outline', () => go(st.step - 1));
      else
        btn('Rückgängig machen', 'outline', () => {
          if (st.applied) app.undo();
          st.applied = false;
          go(1);
        });
      if (st.step === 0) btn('Weiter', 'primary', () => go(1));
      else if (st.step === 1) btn(st.multi ? `Weiter mit ${st.picks.length} ${st.picks.length === 1 ? 'Phase' : 'Phasen'}` : 'Weiter', 'primary', () => go(2), !st.picks.length);
      else if (st.step === 2) {
        if (!st.learners.length) btn('Ohne Namen fertigstellen', 'primary', () => go(3));
        else btn('Plätze verteilen & prüfen', 'primary', () => go(3));
      } else btn('Fertig', 'primary', () => $('#dlg').close('ok'));
      const focusEl = $('.wiz-body input, .wiz-body button', body);
      if (focusEl && st.step !== 3) focusEl.focus({ preventScroll: true });
      body.scrollTop = 0;
    }

    function readStep() {
      if (st.step === 0) {
        const n = parseInt($('#wiz-count').value, 10);
        if (isFinite(n)) st.count = Math.max(1, Math.min(60, n));
        st.multi = ($('#dlg-body input[name=wiz-multi]:checked') || {}).value === '1';
        if (!st.multi && st.picks.length > 1) st.picks = st.picks.slice(0, 1);
      }
    }

    function go(step) {
      readStep();
      if (step === 3) {
        if (st.applied) app.undo();
        apply();
      }
      st.step = step;
      render();
    }

    ui().openDialog({
      title: 'Stunde planen',
      wide: true,
      body: '',
      buttons: [],
      keepFocus: true,
      onOpen: (b) => {
        body = b;
        foot = $('#dlg-foot');
        render();
        b.addEventListener('click', (e) => {
          const w = e.target.closest('[data-w]');
          if (w) {
            const k = w.getAttribute('data-w');
            if (k === 'minus' || k === 'plus') {
              const i = $('#wiz-count');
              i.value = Math.max(1, Math.min(60, (parseInt(i.value, 10) || 0) + (k === 'plus' ? 1 : -1)));
              st.count = Number(i.value);
            } else if (k === 'addnames') {
              const names = $('#wiz-names').value.split(/\r?\n|;/).map((x) => x.split('\t')[0].trim()).filter(Boolean);
              for (const n of names) st.learners.push({ id: LLR.newId(), name: n.slice(0, 40), needs: [] });
              render();
              const ta = $('#wiz-names');
              if (ta) ta.focus();
            }
            return;
          }
          const f = e.target.closest('[data-wform]');
          if (f) {
            st.form = f.getAttribute('data-wform') || null;
            for (const x of $$('[data-wform]', b)) x.setAttribute('aria-checked', String(x === f));
            return;
          }
          const p = e.target.closest('[data-wpick]');
          if (p) {
            const id = p.getAttribute('data-wpick');
            const i = st.picks.indexOf(id);
            if (st.multi) {
              if (i >= 0) st.picks.splice(i, 1);
              else st.picks.push(id);
            } else st.picks = i >= 0 ? [] : [id];
            const top = b.scrollTop;
            render();
            b.scrollTop = top;
            const again = $(`[data-wpick="${CSS.escape(id)}"]`, b);
            if (again) again.focus({ preventScroll: true });
            return;
          }
          const nb = e.target.closest('[data-wneed]');
          if (nb) {
            const [i, key] = nb.getAttribute('data-wneed').split(':');
            const l = st.learners[Number(i)];
            if (l.needs.includes(key)) l.needs = l.needs.filter((x) => x !== key);
            else l.needs.push(key);
            nb.setAttribute('aria-pressed', String(l.needs.includes(key)));
            return;
          }
          const d = e.target.closest('[data-wdel]');
          if (d) {
            st.learners.splice(Number(d.getAttribute('data-wdel')), 1);
            render();
            return;
          }
          const pr = e.target.closest('[data-wprint]');
          if (pr) {
            const kind = pr.getAttribute('data-wprint');
            thenDo(() => ui().printPlan(kind, kind === 'rebuild' ? { all: true } : kind === 'plan' ? { phases: 'all' } : {}));
          }
        });
        b.addEventListener('change', (e) => {
          if (e.target.id === 'wiz-count') readStep();
          if (e.target.name === 'wiz-multi') {
            readStep();
          }
        });
        b.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && e.target.id === 'wiz-count') {
            e.preventDefault();
            go(1);
          }
        });
      },
    });
  }

  /* ---------- Drucken: „Für wen?“ ---------- */
  function openPrint() {
    const hasL = app.learners().some((l) => app.seatOf(l.id));
    const phases = app.doc.phases ? app.doc.phases.length : 0;
    const opts = [
      { k: 'class', ic: 'i-users', title: 'Aushang für die Klasse', text: 'Sitzplan mit großen Namen, ohne Bedarfe – zum Aufhängen oder für den Beamer.', dis: !hasL && 'Erst Lernende auf Plätze setzen (Reiter „Lernende“).' },
      { k: 'seating', ic: 'i-lock', title: 'Sitzplan für mich (vertraulich)', text: 'Mit Bedarfen, Sitzwünschen und Prüfergebnis je Person.', dis: !hasL && 'Erst Lernende auf Plätze setzen.' },
      { k: 'rebuild', ic: 'i-steps', title: 'Umbaukarte für das Umbau-Team', text: phases ? 'Reihenfolge, Wege und Zeitbedarf von Phase zu Phase – große Nummern im Plan.' : 'Aufbau aus der Grundaufstellung (Seminarsitzordnung I) in diesen Plan.' },
      { k: 'plan', ic: 'i-file-plus', title: 'Für den Unterrichtsentwurf', text: 'Plan mit Belegung und Prüfergebnissen, auf Wunsch alle Phasen und eine Prüfansicht.' },
      { k: 'png', ic: 'i-image', title: 'Bild (PNG)', text: 'Für Präsentationen, Lernplattform oder Nachrichten.' },
      { k: 'share', ic: 'i-link', title: 'Link oder Datei', text: 'Den Plan zum Weiterbearbeiten an Kolleginnen und Kollegen geben.' },
    ];
    const first = opts.find((o) => !o.dis).k;
    const lenses = [['', 'Keine'], ['access', 'Rollstuhl'], ['sight', 'Sicht'], ['teacher', 'Lehrkraft'], ['calm', 'Ruhe']];
    ui().openDialog({
      title: 'Drucken & Exportieren: Für wen?',
      wide: true,
      body: `<div class="who-grid" role="radiogroup" aria-label="Für wen?">${opts
        .map((o) => `<label class="who${o.dis ? ' dis' : ''}"><input type="radio" name="who" value="${o.k}" ${o.k === first ? 'checked' : ''} ${o.dis ? 'disabled' : ''}>${icon(o.ic)}<span><strong>${o.title}</strong><small>${o.dis || o.text}</small></span></label>`)
        .join('')}</div>
        <div class="who-opts" data-for="rebuild" hidden>${phases > 1 ? `<label class="toggle"><input type="checkbox" id="who-all" checked><span>Alle Übergänge (eine Seite je Umbau)<small>sonst nur der Umbau zur aktuellen Phase</small></span></label>` : ''}</div>
        <div class="who-opts" data-for="plan" hidden>
          ${phases ? `<label class="toggle"><input type="checkbox" id="who-phases" checked><span>Alle ${phases} Phasen (eine Seite je Phase)</span></label>` : ''}
          <label class="toggle"><input type="checkbox" id="who-checks" checked><span>Belegung und Prüfergebnisse beifügen</span></label>
          <label class="field">Prüfansicht im Plan<select id="who-lens">${lenses.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>
          <label class="field" style="margin-top:8px">Notiz oder Begründung (optional)<textarea id="who-note" rows="2" maxlength="600" placeholder="z. B. Warum diese Anordnung zur Stunde passt"></textarea></label>
        </div>
        <p class="desc">Im Druckfenster lässt sich statt eines Druckers auch „Als PDF speichern“ wählen.</p>`,
      buttons: [
        { label: 'Abbrechen', value: 'cancel' },
        { label: 'Drucken / PDF', value: 'ok', cls: 'primary' },
      ],
      onOpen: (body) => {
        const go = $('#dlg-foot .btn.primary');
        const sync = () => {
          const k = ($('input[name=who]:checked', body) || {}).value;
          for (const o of $$('.who-opts', body)) o.hidden = o.getAttribute('data-for') !== k;
          go.textContent = k === 'png' ? 'Bild speichern' : k === 'share' ? 'Weiter' : 'Drucken / PDF';
        };
        body.addEventListener('change', sync);
        sync();
        body._read = () => ({
          k: ($('input[name=who]:checked', body) || {}).value,
          all: $('#who-all') ? $('#who-all').checked : true,
          phases: $('#who-phases') && $('#who-phases').checked ? 'all' : 'current',
          checks: $('#who-checks') ? $('#who-checks').checked : true,
          lens: $('#who-lens') ? $('#who-lens').value || null : null,
          note: $('#who-note') ? $('#who-note').value.trim() : '',
        });
      },
    }).then((v) => {
      if (v !== 'ok') return;
      const r = $('#dlg-body')._read();
      if (r.k === 'png') return ui().exportPNG();
      if (r.k === 'share') return setTimeout(() => ui().openShare(), 30);
      if (r.k === 'rebuild') return ui().printPlan('rebuild', { all: r.all });
      if (r.k === 'plan') return ui().printPlan('plan', { phases: r.phases, checks: r.checks, lens: r.lens, note: r.note });
      ui().printPlan(r.k);
    });
  }

  /* Tipps an passender Stelle */
  function bindTips() {
    app.on('select', () => {
      const objs = app.selectedObjects();
      if (objs.length === 1 && A.isTable(objs[0])) tip('table', 'Tipp: Doppelklick auf einen Tisch wählt die ganze Gruppe samt Stühlen. Rechtsklick oder lange drücken zeigt weitere Aktionen.');
      else if (objs.length > 1 && LLR.prefs.isPro()) tip('multi', 'Tipp: Mehrere Objekte lassen sich rechts unter „Details“ ausrichten, verteilen, spiegeln oder auf ein genaues Maß setzen.');
    });
    app.on('overlay', () => {
      if (app.lens()) tip('lens', 'Tipp: Einen Sitzplatz antippen zeigt im Plan, warum er so bewertet ist.');
    });
  }

  function act(a) {
    if (a === 'start') openStart();
    else if (a === 'wizard') openWizard();
    else if (a === 'startSeating') startSeating();
    else if (a === 'startWheel') startWheel();
    else if (a === 'startPhases') openWizard({ multi: true });
    else if (a === 'startFree') ui().openLibTab('catalog');
    else if (a === 'printWho') openPrint();
    else return false;
    return true;
  }

  LLR.assist = { openStart, openWizard, openPrint, tip, act };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(bindTips));
  else setTimeout(bindTips);
})((window.LLR = window.LLR || {}));

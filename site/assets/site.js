/* Grid Districts — shared client components. No dependencies; works from file://.
   Components are attached to window.GD and activated per-page with inline data. */
(function () {
  'use strict';
  const GD = (window.GD = {});
  const $ = (sel, root) => (root || document).querySelector(sel);
  const fmt = (n) => n.toLocaleString('en-US');
  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // deviation formatter: rounds first so "-0.001" displays as "0.00%", not "-0.00%"
  const fmtPct = (x) => { const r = Math.round(x * 100) / 100; return r === 0 ? '0.00%' : (r > 0 ? '+' : '') + r.toFixed(2) + '%'; };

  /* ---- district palette: identical to the engine's PNG renderer ---- */
  const CAT = ['#4e79a7', '#f28e2b', '#e15759', '#59a14f', '#b07aa1', '#edc948', '#76b7b2', '#ff5d8f', '#9c755f', '#17becf', '#bcbd22', '#8c564b'];
  function hslRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }
  function colorRgb(d) {
    if (d <= 12) { const x = CAT[d - 1]; return [parseInt(x.slice(1, 3), 16), parseInt(x.slice(3, 5), 16), parseInt(x.slice(5, 7), 16)]; }
    return hslRgb(((d - 1) * 137.508) % 360, 0.62, 0.52);
  }
  GD.colorCss = (d) => { const [r, g, b] = colorRgb(d); return `rgb(${r},${g},${b})`; };

  /* ---- RLE decode: flat [value,len,...] -> Int16Array(h*w) ---- */
  GD.rleDecode = function (rle, h, w) {
    const out = new Int16Array(h * w);
    let p = 0;
    for (let i = 0; i < rle.length; i += 2) {
      const v = rle[i], n = rle[i + 1];
      out.fill(v, p, p + n); p += n;
    }
    if (p !== h * w) console.warn('RLE decode mismatch: got ' + p + ' cells, expected ' + h * w);
    return out;
  };

  /* ---- reveal on scroll ---- */
  GD.reveal = function () {
    const els = document.querySelectorAll('.reveal');
    if (REDUCED || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
  };

  /* ---- scroll progress bar ---- */
  GD.scrollbar = function () {
    const bar = $('.scrollbar');
    if (!bar) return;
    let ticking = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = max > 0 ? (window.scrollY / max * 100) + '%' : '0';
      ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  };

  /* ---- count-up stats (server-rendered value is the no-JS/reduced-motion fallback) ---- */
  GD.counters = function () {
    const els = document.querySelectorAll('[data-count]');
    if (!els.length || REDUCED || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        const el = en.target, target = +el.dataset.count, dur = 1200, t0 = performance.now();
        const tick = (now) => {
          const f = Math.min(1, (now - t0) / dur), eased = 1 - Math.pow(1 - f, 3);
          el.textContent = fmt(Math.round(target * eased));
          if (f < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.4 });
    els.forEach((e) => io.observe(e));
  };

  /* ---- clickable US map (per-state <g class="us-g"> wraps path + label) ---- */
  const HOVER_COLS = ['#2c4bd8', '#7c3aed', '#0f766e', '#b3552e']; // all >=4.5:1 with white labels
  GD.usMap = function (wrap, base) {
    const svg = $('svg.usmap', wrap), tip = $('.map-tip', wrap);
    if (!svg) return;
    [...svg.querySelectorAll('.us-g')].forEach((g, idx) => {
      const p = $('.us-state', g);
      if (!p) return;
      const hot = (on) => {
        g.classList.toggle('hot', on);
        p.style.fill = on ? HOVER_COLS[idx % HOVER_COLS.length] : '';
      };
      const go = () => { location.href = base + p.dataset.abbr + '.html'; };
      p.addEventListener('click', go);
      p.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      p.addEventListener('mousemove', (e) => {
        const r = wrap.getBoundingClientRect();
        tip.style.left = (e.clientX - r.left) + 'px';
        tip.style.top = (e.clientY - r.top) + 'px';
        tip.innerHTML = '<b>' + p.dataset.name + '</b><br>' + p.dataset.seats + ' — click to explore';
        tip.classList.add('on');
      });
      p.addEventListener('mouseenter', () => hot(true));
      p.addEventListener('mouseleave', () => { hot(false); tip.classList.remove('on'); });
      p.addEventListener('focus', () => {
        hot(true);
        const b = p.getBBox(), r = svg.viewBox.baseVal, w = wrap.clientWidth;
        tip.style.left = ((b.x + b.width / 2) / r.width * w) + 'px';
        tip.style.top = ((b.y) / r.height * (w * r.height / r.width)) + 'px';
        tip.innerHTML = '<b>' + p.dataset.name + '</b><br>' + p.dataset.seats;
        tip.classList.add('on');
      });
      p.addEventListener('blur', () => { hot(false); tip.classList.remove('on'); });
    });
  };

  /* ---- gerrymander illustration ---- */
  GD.gerryDemo = function (root, DEMO) {
    const svg = $('svg.gerry', root), score = $('.scoreboard', root), take = $('.takeaway', root);
    const { cols, rows, cell, voters } = DEMO;
    const PC = '#6d5bd0', GC = '#d9a226';
    let cellsHtml = '';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const v = voters[r * cols + c];
      cellsHtml += `<rect x="${c * cell}" y="${r * cell}" width="${cell}" height="${cell}" fill="${v ? '#f5edd8' : '#ece8fa'}" stroke="#fff" stroke-width="1"/>`;
      cellsHtml += `<circle cx="${c * cell + cell / 2}" cy="${r * cell + cell / 2}" r="${cell * 0.26}" fill="${v ? GC : PC}"/>`;
    }
    const bordersG = `<g class="borders" fill="none" stroke="#172554" stroke-width="3.5" stroke-linecap="square"></g>`;
    svg.innerHTML = cellsHtml + bordersG + `<rect x="0" y="0" width="${cols * cell}" height="${rows * cell}" fill="none" stroke="#172554" stroke-width="3.5"/>`;
    const borders = $('.borders', svg);

    function show(part) {
      let d = '';
      const A = part.assign;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (c + 1 < cols && A[i] !== A[i + 1]) d += `M${(c + 1) * cell} ${r * cell}V${(r + 1) * cell}`;
        if (r + 1 < rows && A[i] !== A[i + cols]) d += `M${c * cell} ${(r + 1) * cell}H${(c + 1) * cell}`;
      }
      borders.innerHTML = `<path d="${d}"/>`;
      score.innerHTML =
        `<span class="scorebox"><span class="dot" style="background:${PC}"></span>Purple wins ${part.tally.P} district${part.tally.P === 1 ? '' : 's'}</span>` +
        `<span class="scorebox"><span class="dot" style="background:${GC}"></span>Gold wins ${part.tally.G} district${part.tally.G === 1 ? '' : 's'}</span>`;
      take.textContent = part.takeaway;
      root.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-pressed', t.dataset.key === part.key ? 'true' : 'false'));
    }
    root.querySelectorAll('.tab').forEach((t) => {
      t.addEventListener('click', () => show(DEMO.parts.find((p) => p.key === t.dataset.key)));
    });
    show(DEMO.parts[0]);
  };

  /* ---- hover-interactive district map (canvas) ----
     Selection model: three independent channels, painted = ext || hover || locked.
       hover  — cursor on the canvas (wins over locked so the tooltip always matches the paint)
       locked — click-to-pin; restored whenever the cursor leaves
       ext    — programmatic highlight from the districts table (never touches the tooltip) */
  GD.districtMap = function (canvas, GRID, opts) {
    opts = opts || {};
    const { h, w } = GRID;
    const dist = GD.rleDecode(GRID.rle, h, w);
    const byD = {}; GRID.districts.forEach((x) => { byD[x.d] = x; });
    const off = document.createElement('canvas'); off.width = w; off.height = h;
    const octx = off.getContext('2d');
    const img = octx.createImageData(w, h);
    const px = new Uint32Array(img.data.buffer);
    const colU32 = {}, washU32 = {};
    GRID.districts.forEach((x) => {
      const [r, g, b] = colorRgb(x.d);
      colU32[x.d] = (255 << 24) | (b << 16) | (g << 8) | r;
      const mix = (v) => Math.round(v + (247 - v) * 0.72);
      washU32[x.d] = (255 << 24) | (mix(b) << 16) | (mix(g) << 8) | mix(r);
    });
    const scale = Math.max(1, Math.min(4, Math.floor(900 / w)));
    canvas.width = w * scale; canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    let hover = 0, locked = 0, ext = 0, painted = -1;
    const target = () => ext || hover || locked;

    function paint() {
      const hl = target();
      if (hl === painted) return;
      painted = hl;
      for (let i = 0; i < dist.length; i++) {
        const d = dist[i];
        px[i] = d === 0 ? 0 : (hl && d !== hl ? washU32[d] : colU32[d]);
      }
      octx.putImageData(img, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
      if (opts.onSelect) opts.onSelect(hl);
    }
    const tip = opts.tip;
    function cellAt(e) {
      const r = canvas.getBoundingClientRect();
      const c = Math.floor((e.clientX - r.left) / r.width * w);
      const rr = Math.floor((e.clientY - r.top) / r.height * h);
      if (c < 0 || c >= w || rr < 0 || rr >= h) return 0;
      return dist[rr * w + c];
    }
    canvas.addEventListener('mousemove', (e) => {
      const d = cellAt(e);
      hover = d; paint();
      if (!tip) return;
      if (d > 0 && byD[d]) {
        const x = byD[d];
        tip.innerHTML = '<b>District ' + x.d + '</b><br>' + fmt(x.pop) + ' people<br>' + fmtPct(x.dev) + ' from an equal share';
        tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px';
        tip.classList.add('on');
      } else tip.classList.remove('on');
    });
    canvas.addEventListener('mouseleave', () => { hover = 0; paint(); if (tip) tip.classList.remove('on'); });
    canvas.addEventListener('click', (e) => {
      const d = cellAt(e);
      locked = (locked === d) ? 0 : d;
      paint();
    });
    paint();
    return {
      highlight(d) { ext = d; paint(); },            // table-row path: no tooltip, lock untouched
      current() { return locked; },
    };
  };

  /* ---- splitline cut animation ---- */
  GD.cutAnim = function (root, CUTS, FINAL) {
    const canvas = $('canvas.demo', root), narr = $('.narration', root), dots = $('.progress-dots', root);
    const btnPlay = $('[data-act=play]', root), btnStep = $('[data-act=step]', root), btnReset = $('[data-act=reset]', root);
    const { h, w, r0, c0 } = CUTS;
    const steps = CUTS.steps;
    const NAME = CUTS.name || CUTS.abbr;
    const KEY = { V: (r, c) => c, H: (r, c) => r, D1: (r, c) => r + c, D2: (r, c) => r - c };
    const SIDES = { V: ['west of it', 'east of it'], H: ['north of it', 'south of it'], D1: ['to the northwest', 'to the southeast'], D2: ['to the northeast', 'to the southwest'] };

    const inState = GD.rleDecode(steps[0].rle, h, w);
    const finalDist = FINAL ? GD.rleDecode(FINAL.rle, h, w) : null;
    const REGION_COLS = ['#94a7d8', '#7fb8a8', '#d8b27f', '#b89ad0', '#8fc3df', '#dba1a1', '#a8c98a', '#d8c97f',
      '#9fb3c8', '#c8a98f', '#b0c4a0', '#c0a0b8', '#88b0b8', '#c8b888', '#a098c8', '#b8c0d0'];
    const region = new Int16Array(h * w).fill(-1);
    for (let i = 0; i < inState.length; i++) if (inState[i]) region[i] = 0;

    const scale = Math.max(1, Math.min(3, Math.floor(760 / w)));
    canvas.width = w * scale; canvas.height = h * scale;
    const off = document.createElement('canvas'); off.width = w; off.height = h;
    const octx = off.getContext('2d');
    const img = octx.createImageData(w, h);
    const px = new Uint32Array(img.data.buffer);
    const ctx = canvas.getContext('2d');
    const hex2u32 = (hx) => {
      const r = parseInt(hx.slice(1, 3), 16), g = parseInt(hx.slice(3, 5), 16), b = parseInt(hx.slice(5, 7), 16);
      return (255 << 24) | (b << 16) | (g << 8) | r;
    };
    const REG_U32 = REGION_COLS.map(hex2u32);
    let finalU32 = null;
    if (finalDist) {
      finalU32 = {};
      FINAL.districts.forEach((x) => { const [r, g, b] = colorRgb(x.d); finalU32[x.d] = (255 << 24) | (b << 16) | (g << 8) | r; });
    }

    let stepIdx = -1, nextRegionId = 1, sweep = null;
    let rafId = 0, timerId = 0, playing = false;

    function draw(blendFinal) {
      for (let i = 0; i < region.length; i++) {
        const rg = region[i];
        if (rg < 0) { px[i] = 0; continue; }
        if (blendFinal && finalDist && finalDist[i] > 0) px[i] = finalU32[finalDist[i]];
        else px[i] = REG_U32[rg % REG_U32.length];
      }
      if (sweep) {
        const { mask, keyFn, kcur, idA } = sweep;
        for (let i = 0; i < region.length; i++) {
          if (!mask[i]) continue;
          const r = (i / w) | 0, c = i % w;
          const k = keyFn(r + r0, c + c0);
          if (k <= kcur) px[i] = REG_U32[idA % REG_U32.length];
          if (k === kcur || k === kcur + 1) px[i] = (255 << 24) | (84 << 16) | (75 << 8) | 216; // accent frontier
        }
      }
      octx.putImageData(img, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
    }

    function setNarr(html) { narr.innerHTML = html; }
    function setDots() {
      dots.innerHTML = '';
      for (let i = 0; i < steps.length + 1; i++) {
        const s = document.createElement('span');
        s.className = 'pdot' + (i <= stepIdx ? ' on' : '');
        dots.appendChild(s);
      }
    }
    function introText() {
      setNarr('<b>' + NAME + '.</b> ' + fmt(CUTS.residentPop) + ' people, ' + CUTS.seats +
        ' congressional seats. Every square is one square mile. Press <b>Play</b> to watch one fixed rule draw the districts — no names, no parties, no politics.');
    }
    function scheduleNext(ms) {
      timerId = setTimeout(() => { if (playing) advance(); }, ms); // self-checking: survives nothing
    }
    function beginStep(k, instant) {
      const st = steps[k];
      const mask = GD.rleDecode(st.rle, h, w);
      const keyFn = KEY[st.fam];
      let kmin = Infinity, kmax = -Infinity;
      for (let i = 0; i < mask.length; i++) if (mask[i]) {
        const r = (i / w) | 0, c = i % w;
        const kk = keyFn(r + r0, c + c0);
        if (kk < kmin) kmin = kk; if (kk > kmax) kmax = kk;
      }
      const idA = nextRegionId++, idB = nextRegionId++;
      sweep = { mask, keyFn, t: st.t, kmin, kmax, kcur: kmin - 1, idA, idB };
      const sideA = SIDES[st.fam][0], sideB = SIDES[st.fam][1];
      setNarr('<b>Cut ' + (k + 1) + ' of ' + steps.length + '.</b> This region needs ' + st.s +
        ' districts, so the rule splits it ' + st.a + ' + ' + st.b +
        ': the line that best balances people puts <b>' + fmt(st.popA) + '</b> ' + sideA +
        ' and <b>' + fmt(st.popB) + '</b> ' + sideB + '.');
      if (instant) {
        finishStep(); draw(false);
        if (playing) scheduleNext(350);
        return;
      }
      const span = sweep.kmax - sweep.kmin + 1;
      const dur = 900;
      const t0 = performance.now();
      const tick = (now) => {
        const f = Math.min(1, (now - t0) / dur);
        sweep.kcur = sweep.kmin - 1 + Math.round(f * span);
        draw(false);
        if (f < 1) rafId = requestAnimationFrame(tick);
        else { finishStep(); draw(false); if (playing) scheduleNext(650); }
      };
      rafId = requestAnimationFrame(tick);
    }
    function finishStep() {
      const { mask, keyFn, t, idA, idB } = sweep;
      for (let i = 0; i < mask.length; i++) if (mask[i]) {
        const r = (i / w) | 0, c = i % w;
        region[i] = keyFn(r + r0, c + c0) <= t ? idA : idB;
      }
      sweep = null;
      setDots();
    }
    function settleSweep() { // instantly complete a mid-flight sweep (pause/step honesty)
      if (!sweep) return;
      cancelAnimationFrame(rafId);
      finishStep(); draw(false);
    }
    function showFinal() {
      stepIdx = steps.length;
      setDots();
      draw(true);
      setNarr('<b>Done.</b> ' + CUTS.seats + ' districts — every one within a fraction of a percent of an equal share of ' +
        fmt(CUTS.residentPop) + ' people. A cleanup pass reattaches any cells a cut left stranded, then independent checks confirm ' +
        'every single person is counted exactly once. Run it again tomorrow, on any computer: you get this exact map. &#127881;');
      playing = false; btnPlay.textContent = '▶ Replay';
    }
    function advance(instant) {
      if (sweep) return;
      if (stepIdx >= steps.length) return;
      stepIdx++;
      if (stepIdx === steps.length) { showFinal(); return; }
      beginStep(stepIdx, instant || REDUCED);
    }
    function reset() {
      cancelAnimationFrame(rafId); clearTimeout(timerId);
      region.fill(-1);
      for (let i = 0; i < inState.length; i++) if (inState[i]) region[i] = 0;
      nextRegionId = 1; stepIdx = -1; sweep = null; playing = false;
      btnPlay.textContent = '▶ Play';
      setDots(); introText(); draw(false);
    }

    btnPlay.addEventListener('click', () => {
      clearTimeout(timerId);
      if (stepIdx >= steps.length) { reset(); }
      playing = !playing;
      btnPlay.textContent = playing ? '⏸ Pause' : '▶ Play';
      if (playing && !sweep) advance();
      if (!playing) settleSweep();
    });
    btnStep.addEventListener('click', () => {
      clearTimeout(timerId);
      playing = false; btnPlay.textContent = '▶ Play';
      if (sweep) { settleSweep(); return; }
      advance(true);
    });
    btnReset.addEventListener('click', reset);
    reset();
  };

  /* ---- state page controller ---- */
  GD.statePage = function (CFG) {
    const slider = $('#slider'), dl = $('#dl'), imgEl = $('#mapimg'), cv = $('#mapcanvas'),
      note = $('#mapnote'), sb = $('#statsbox'), btns = $('#btns'), tip = $('#maptip');
    let mapApi = null;
    const markRows = (d) => {
      document.querySelectorAll('tr[data-d]').forEach((tr) => tr.classList.toggle('sel', +tr.dataset.d === d));
    };
    if (CFG.grid && cv) {
      mapApi = GD.districtMap(cv, CFG.grid, { tip, onSelect: markRows });
    }
    function show(i) {
      const dec = CFG.decades[i]; dl.textContent = dec;
      slider.setAttribute('aria-valuetext', dec);
      const e = CFG.data[dec] || {};
      btns.innerHTML = ''; sb.innerHTML = '';
      const showCanvas = dec === '2020' && CFG.grid;
      if (cv) cv.style.display = showCanvas ? 'block' : 'none';
      imgEl.style.display = showCanvas ? 'none' : 'inline';
      if (e.preState) { imgEl.style.display = 'none'; note.textContent = CFG.name + ' was not yet a state in ' + dec + '.'; return; }
      if (e.missing) { imgEl.style.display = 'none'; note.textContent = 'Historical run not available for ' + dec + '.'; return; }
      if (!showCanvas) {
        imgEl.src = '../maps/' + CFG.abbr + '-' + dec + '.png';
        imgEl.alt = CFG.name + ' district map, ' + dec + (e.seats > 1 ? ' — ' + e.seats + ' districts (estimated historical pattern)' : '');
      }
      if (e.atLarge) {
        note.textContent = dec + ': at-large — the whole state elects one representative, so there are no district lines to draw.';
        return;
      }
      let n = dec === '2020'
        ? 'Hover, tap, or use the table below to explore each district.'
        : dec + ': ' + e.seats + ' districts';
      if (dec !== '2020') {
        if (e.maxDev !== undefined) n += ' — worst deviation from an equal share: ' + e.maxDev.toFixed(2) + '%';
        if (e.coverage !== undefined) n += ' — county-record coverage ' + (e.coverage * 100).toFixed(1) + '%';
      }
      note.textContent = n;
      let rows = '';
      (e.districts || []).forEach((x) => {
        rows += '<tr data-d="' + x.d + '" tabindex="0"><td><span class="swatch" style="background:' + GD.colorCss(x.d) + '"></span>' + x.d +
          '</td><td>' + fmt(x.pop) + '</td><td>' + fmtPct(x.dev) + '</td></tr>';
      });
      if (rows) sb.innerHTML = '<h2>Districts in ' + dec + '</h2><table class="districts"><thead><tr><th scope="col">District</th><th scope="col">Population</th><th scope="col">From equal share</th></tr></thead><tbody>' + rows + '</tbody></table>';
      if (dec === '2020' && e.interactive) {
        btns.innerHTML = '<a class="btn btn-ghost" href="../interactive/' + CFG.abbr + '.html">Open the full-screen zoomable map</a>';
      }
      const live = dec === '2020' && mapApi;
      document.querySelectorAll('tr[data-d]').forEach((tr) => {
        const on = () => { if (live) mapApi.highlight(+tr.dataset.d); };
        const offh = () => { if (live) mapApi.highlight(0); };
        tr.addEventListener('mouseenter', on); tr.addEventListener('mouseleave', offh);
        tr.addEventListener('focus', on); tr.addEventListener('blur', offh);
      });
      if (live && mapApi.current()) markRows(mapApi.current()); // restore selection after decade round-trip
    }
    slider.addEventListener('input', (ev) => show(+ev.target.value));
    show(+slider.value); // honor browser-restored slider position
  };
})();

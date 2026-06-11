# Site Review — Interaction Correctness (client JS logic)

**Lens:** real logic bugs in the shipped client JS.
**Files reviewed:** `site/assets/site.js` (shipped copy, 402 lines), inline scripts in `site/index.html` (lines 159–167, 191–192), `site/state/TX.html`, `site/state/AK.html` (at-large edge case), generator `scripts/site-build.js` (state-page emitter lines 257–356, landing emitter 358–517, how-it-works emitter 519–614), `site/assets/site.css` (geometry-relevant rules).
**Method:** every suspected bug traced through the exact code path; data-level claims (RLE sums, palette collisions, grid/flag invariants) verified by executing the shipped JSON through the same decode logic in Node.

Summary: **0 FATAL · 2 MAJOR · 6 MINOR · 3 NIT.** The core rendering math is solid — I verified it numerically — but the Colorado animation's play/pause/step state machine has a stale-timer bug that makes the controls visibly misbehave, and the state-page tooltip can appear at an arbitrary screen position.

---

## MAJOR-1 — cutAnim: pending inter-cut `setTimeout` survives Pause/Step; `advance()` never checks `playing`

**File:** `site/assets/site.js`, `GD.cutAnim` — lines 295 (`if (playing) raf = setTimeout(() => advance(), 650);`), 284 (same with 350ms in reduced-motion), 320–326 (`advance()`), 337–343 (button handlers).
**Affects:** index.html `#watch` panel and how-it-works.html panel — the site's centerpiece "Watch it draw Colorado" demo.

During Play, each finished cut schedules the next one: `raf = setTimeout(() => advance(), 650)`. Two problems combine:

1. Neither the Play (pause) handler nor the Step handler clears that pending timeout.
2. `advance()` itself never re-checks `playing` — the only `playing` check happens at *schedule* time, not *fire* time.

Concrete misbehaviors, both traced:

- **Pause doesn't pause.** Each cut cycle is ~900ms sweep + 650ms gap, so ~42% of the time a click on "⏸ Pause" lands in the gap. Trace: handler sets `playing = false`, text becomes "▶ Play" — but the already-scheduled timeout fires, calls `advance()`, which increments `stepIdx` and runs `beginStep(stepIdx, undefined || REDUCED)` → a **full 900ms animated cut plays while the button reads "▶ Play"**. To a first-time visitor the pause button simply looks broken.
- **Step double-advances.** Click "Step" during the 650ms gap: the handler runs `advance(true)` (instant cut k+1), then the stale timeout fires and runs `advance()` (animated cut k+2). One click, two cuts, and an animation running while the controls say paused. The narration counter visibly jumps ("Cut 3 of 7" → "Cut 5 of 7" territory).
- A pause→quick-resume in the gap leaves *two* pending advance paths; the `if (sweep) return` guard absorbs most collisions, but timers landing in a later gap still fire early cuts.

`reset()` (line 329) is the only place the timer is cleared.

**Fix (small):** make the timeout self-checking and clear it in both handlers:
```js
raf = setTimeout(() => { if (playing) advance(); }, 650);   // line 295 (and 284)
// btnPlay handler and btnStep handler, before anything else:
clearTimeout(raf);
```
(With separate timer variables per MINOR-4 below, clear only the timeout.)

---

## MAJOR-2 — districtMap: tooltip shown with stale/never-set position when triggered from the districts table (`mapApi.select` passes no event)

**File:** `site/assets/site.js` lines 163–171 (`setHl` tooltip block), line 180 (`select(d)` calls `setHl(d)` with no event), lines 394–396 (`GD.statePage` row hover → `mapApi.select(+tr.dataset.d)`); CSS: `.maptip2{position:fixed;...}`.
**Affects:** all 44 multi-district state pages (e.g., TX.html).

`setHl(d, e)` only updates the tooltip's `left/top` when `e` is provided (`if (e) { tip.style.left = e.clientX ... }`), but it **always** sets the content and adds the `on` class when `d > 0`. The table-row `mouseenter` path calls `mapApi.select(d)` → `setHl(d)` with no event. Result: hovering any row of the "Districts in 2020" table — which sits directly under the map — makes the fixed-position `#maptip` pop up:

- at the **last canvas mousemove coordinates** (a tooltip floating over the map area while the cursor is down in the table), or
- if the canvas was never hovered, with **no `left/top` at all** — a `position:fixed` element with auto offsets renders at its static-flow position (the `maptip2` div sits after `</main>`, near the footer), i.e., somewhere unrelated or off-screen.

The mousemove math itself is correct (`clientX/clientY` against `position:fixed` is scroll-proof — checked); the bug is purely the event-less `select()` path lighting the tooltip up.

**Fix:** in `select()` / the no-event path, update only the highlight, not the tooltip — e.g., guard the entire tip block with `if (tip && e)` or pass an explicit `showTip` flag:
```js
return { select(d) { locked = d; hover = -1; setHl(d /* no tip */); } };
```

---

## MINOR-1 — districtMap: hovering the districts table silently destroys the user's click-lock

**File:** `site/assets/site.js` line 180 (`select(d) { locked = d; ... }`), lines 394–396 (row `mouseenter`/`mouseleave` → `select(d)` / `select(0)`).

Clicking a district locks it (`locked = d`, line 177) — the page note even invites "tap a district". But `mapApi.select()` (the table-row hover path) **overwrites `locked`** and row `mouseleave` calls `select(0)`, zeroing it. So: click district 7 to lock it → brush the mouse across the table → the lock is gone, and the next canvas `mouseleave` (line 174) clears the highlight entirely. The two interaction channels share one state variable.

**Fix:** give the programmatic path its own variable (e.g., `tableHl`), and compute the painted target as `tableHl || locked || hover`; restore `locked` on row mouseleave instead of zeroing it.

## MINOR-2 — districtMap: while locked, tooltip describes one district while highlight + table-row `sel` mark another

**File:** `site/assets/site.js` lines 160–172.

With district L locked, `setHl` keeps the paint target at L (`const target = locked || d`) but the tooltip block keys off the **hovered** `d`: hover district X and the tooltip reads "District X … people" while X itself is washed out (line 138 wash) and the table row marked `.sel` is still L. Three simultaneous signals disagree. Inspecting other districts under a lock is arguably a feature, but presenting X's stats while X is visually de-emphasized and L's row is highlighted will confuse exactly the audience this site targets.

**Fix:** while locked, either suppress the tooltip for non-locked districts, or also `onSelect(d)`-mark the hovered row and lighten the wash on the hovered district so the tooltip subject is identifiable.

## MINOR-3 — statePage: decade round-trip desyncs table `sel` from a locked canvas; the `target !== hover` guard prevents resync

**File:** `site/assets/site.js` lines 363–397 (`show()` rebuilds `#statsbox` rows), 160–162 (`setHl` early-out).

Lock a district on the 2020 canvas, slide to 1990, slide back to 2020: `show()` rebuilds the rows without `.sel`, the canvas still paints the locked district, and because `setHl`'s `if (target !== hover)` guard sees `target === hover === locked`, `onSelect` is never re-fired on subsequent mousemoves — the row never recovers its `sel` mark until the user changes the lock. Cosmetic, but a genuine state desync between two views of the same selection.

**Fix:** after rebuilding rows for 2020, re-apply the current selection (expose `mapApi.current()` or just call `onSelect`-equivalent with the locked id inside `show()`).

## MINOR-4 — cutAnim: one variable holds both rAF ids and setTimeout ids; both cancel functions are called on whatever it holds

**File:** `site/assets/site.js` lines 224, 284, 294–297, 329 (`cancelAnimationFrame(raf); clearTimeout(raf);`).

`raf` alternates between `requestAnimationFrame` ids and `setTimeout` ids, and `reset()` fires both cancellers at the same number. Per spec these id spaces are independent counters that can collide, so `clearTimeout(rafId)` may kill an unrelated timer and vice versa. I checked the shipped pages: site.js has no other `setTimeout`/`requestAnimationFrame` users, so today this is benign and `reset()` does work in every state I traced (mid-sweep: raf holds the live rAF id, cancelled correctly; mid-gap: raf holds the timeout id, cleared correctly). It becomes a real bug the moment any other script (analytics, a future component) schedules timers on these pages.

**Fix:** two variables (`rafId`, `timerId`), cancel each with its own function. This also makes the MAJOR-1 fix cleaner.

## MINOR-5 — statePage: init renders the last decade while the browser may restore a different slider position

**File:** `site/assets/site.js` lines 399–400 (`slider.addEventListener('input', ...); show(CFG.decades.length - 1);`).

Firefox (and some browsers on back-navigation) restores form-control state on reload: the range thumb can come back at, say, 1980 while `show(7)` unconditionally renders 2020 — label says "2020", map shows 2020, thumb sits at 1980 until the first `input` event. 

**Fix:** initialize from the control instead of the constant — `show(+slider.value)` — or emit `autocomplete="off"` on the slider in `site-build.js` line 325.

## MINOR-6 — generator: missing 2020 stats silently relabels a state "at-large"

**File:** `scripts/site-build.js` lines 272–280 — `if (fs.existsSync(statsPath)) { ... } else entry.atLarge = true;`

The 2020 branch treats "no `out/<ST>/stats_splitline.json`" as proof the state is at-large. If a future rebuild runs with one state's engine output missing, that state's page would assert "2020: at-large — the whole state elects one representative" (site.js line 374) for a multi-seat state — a factually false public statement, with no build warning (unlike the historical branch, which has an explicit `missing` flag and `missingHist` log). I verified the **shipped** pages are clean: exactly the 6 true at-large states carry `atLarge` for 2020, and all 44 multi-district states ship a grid — so this is latent, not live; severity would be FATAL if it ever fired.

**Fix:** key at-large off the authoritative `AT_LARGE` list (already imported, line 19); make a missing stats file for a multi-seat state a hard build error.

---

## NIT-1 — cutAnim hardcodes "Colorado." in shared component text

**File:** `site/assets/site.js` lines 260–262: `setNarr('<b>Colorado.</b> ' + fmt(CUTS.residentPop) + ...)`. The component takes `CUTS.abbr` (and the generator passes it) but the intro narration hardcodes the state name. Reusing the component for any other state would silently narrate "Colorado." Use a `name` field from `CUTS`.

## NIT-2 — rleDecode has no integrity check

**File:** `site/assets/site.js` lines 28–36. An odd-length or short RLE array decodes silently to a truncated/shifted grid (`fill(v, p, NaN)` no-ops and poisons `p`). I verified every shipped payload sums exactly (CO: all 7 steps + FINAL = 125,600 = 314×400; TX grid = 576,750 = 750×769), so nothing is wrong today — but one bad export would render a garbage map with no console error. A one-line `if (p !== h*w) console.warn(...)` would catch it.

## NIT-3 — pausing mid-sweep gives no feedback

**File:** `site/assets/site.js` lines 337–342. Clicking "⏸ Pause" during a 900ms sweep flips the button to "▶ Play" but the sweep keeps animating to the end of the cut (the rAF chain only consults `playing` at the cut boundary, line 295). Finish-the-current-cut is a defensible design, but the button claiming "Play" while the canvas is visibly animating reads as a glitch. Either cancel mid-sweep or keep the button as "⏸ …" until the cut lands.

---

## Checked and found CORRECT (claims verified, not assumed)

| Suspected bug | Verdict | Evidence |
|---|---|---|
| RLE decode off-by-one | **Correct.** | `fill(v, p, p+n)` fills exactly n cells; all shipped payloads sum to h×w exactly (executed: CO 7 steps + FINAL each 125,600; TX 576,750; 39 distinct values 0–38 matching 38 districts). |
| `cellAt` hover math under CSS scaling | **Correct.** | `floor((clientX − rect.left)/rect.width × w)` is exact for any non-integer ratio; `canvas.demo` has no border/padding in site.css so `getBoundingClientRect` equals the drawing surface; right/bottom edge yields `c === w` and is rejected by the bounds check (site.js 157). |
| cutAnim region-id % 16 palette collisions between adjacent regions | **No collision in shipped data.** | Simulated the exact `finishStep` id assignment on the shipped CO JSON: final region ids are {5,6,7,8,11,12,13,14}, all distinct mod 16; exhaustive 4-neighbor adjacency scan found zero same-color adjacent pairs. (Latent only: a state needing ids ≥ 16 — more than ~7 cuts shown — could wrap; only CO ships.) |
| Reset mid-sweep | **Works.** | `raf` holds the live rAF id during a sweep; `cancelAnimationFrame` stops the tick, `sweep=null`, region refilled, intro redrawn (site.js 328–335). See MINOR-4 for the fragility caveat. |
| Final-frame flash of all-side-A | **Not visible.** | At f=1 the tick draws kcur=kmax then synchronously runs `finishStep(); draw(false)` in the same task — the intermediate frame is never presented. |
| gerryDemo borders for non-rectangular districts | **Correct.** | Both edge orientations emitted for every differing neighbor pair (site.js 96–99) — handles the packed/cracked map. Tallies independently verified: generator `verifyPartition` (site-build.js 75–99) re-derives P/G per district with a contiguity BFS at build time; I re-checked pack = P2/G3 by hand. |
| Tooltip positioning when scrolled | **Correct on both surfaces.** | `.maptip2` is `position:fixed` fed `clientX/clientY` (viewport coords — scroll-proof). Index `.map-tip` is `position:absolute` inside `.usmap-wrap{position:relative}` (no border/padding) fed `clientX − wrapRect.left` — scroll cancels out. The MAJOR-2 bug is the *event-less* path only. |
| usMap keyboard-focus tooltip math | **Correct.** | viewBox is `0 0 980 664` (min-x/y = 0), svg is the wrap's first child at `width:100%`, so `(b.x + b.width/2)/980 × wrap.clientWidth` and the proportional y are right; all 50 paths carry `tabindex="0"` so focus actually fires. |
| `#statejump` empty value | **Correct.** | First option is `value=""`; handler guards `if(sj.value)` (index.html 165). |
| tr listener re-binding on every `show()` — leak? | **No leak.** | `sb.innerHTML = ''` discards the old rows each call; listeners attach only to the freshly created rows, and the detached nodes (plus their listeners) are collectable. `document.querySelectorAll('tr[data-d]')` matches nothing outside `#statsbox` on these pages. Slider-drag spam rebuilds a ≤53-row table per step — cheap. |
| AK / at-large: `statePage` with `grid:null` | **Guarded everywhere.** | `mapApi` creation requires `CFG.grid && cv`; both later uses check `if (mapApi && dec === '2020')`; `cv.style.display` is behind `if (cv)`. AK's 2020 path sets `imgEl.src='../maps/AK-2020.png'` before the at-large early-return — and `site/maps/AK-{1960..2020}.png` all exist (1950 is `preState`, image hidden). No crash, no broken image. |
| Script ordering (inline script uses `GD` before `site.js` tag) | **Correct.** | The inline scripts only *register* a `DOMContentLoaded` listener; the classic `<script src="assets/site.js">` before `</body>` executes before DOMContentLoaded fires, so `GD` exists in the callback. |
| `document.querySelector('.panel')` picks the right panel | **Correct.** | On index the gerry panel precedes `#watch .panel` in source order; how-it-works has exactly one `.panel`. |
| Cross-state data invariants | **Hold.** | Scripted check across all 50 shipped state pages: `atLarge` 2020 flag on exactly the 6 at-large states; grid present for all 44 multi-district states (so the "Hover or tap" note never appears over a static PNG); `interactive:true` count (44) matches `site/interactive/` file count (44). |

---

## Verdict

No FATAL findings: nothing in the shipped interaction code misleads the public about the data, and the numeric rendering pipeline (RLE → canvas → tooltip values) checks out exactly. But the two MAJOR bugs both sit on the site's highest-traffic interactive moments — the Colorado animation's transport controls (pause that doesn't pause, step that double-steps) and the state-page tooltip (appears at an unrelated screen position whenever the districts table is hovered). Both are small, well-localized fixes in `scripts/site-src/site.js` (then re-run `site-build.js` to refresh the shipped copy). Fix MAJOR-1 and MAJOR-2 before launch; the MINORs are polish-pass material.

*Reviewed: 2026-06-11 · Lens: interaction correctness · All traces against shipped copies in `site/`*

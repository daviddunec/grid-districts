# Site Review — Accessibility + HTML Quality

**Lens:** accessibility (WCAG 2.1 AA frame) + HTML quality.
**Files reviewed:** `site/index.html`, `site/how-it-works.html`, `site/faq.html`, `site/about.html`, `site/state/TX.html`, `site/state/WY.html`, `site/assets/site.css`, plus `site/assets/site.js` (read to verify keyboard/motion claims the HTML depends on).
**Method:** full read of markup, targeted extraction of the 50-state SVG attributes, and computed WCAG contrast ratios (relative-luminance formula, via node) for every flagged color pair. Every ratio quoted below is computed, not eyeballed.

**Verdict:** This is a genuinely strong accessibility baseline for a hand-rolled static site — the US-map keyboard pattern, reduced-motion handling, live-region narration, and color palette are all better than most production sites. But the state pages' core control (the decade slider) is meaningless to screen-reader users, and the map's state labels become illegible at the exact moment a user interacts with them. Those two must be fixed before this is "top notch for every American."

Counts: **0 FATAL / 2 MAJOR / 11 MINOR / 5 NIT**

---

## MAJOR

### M1. Decade slider announces "7" instead of "2020" — no `aria-valuetext`
- **Files:** `site/state/TX.html` line 20, `site/state/WY.html` line 20 (and presumably all 50 state pages); `site/assets/site.js` `GD.statePage` (lines 351–401).
- **What I saw:** `<input type="range" id="slider" min="0" max="7" value="7" step="1" aria-label="Census decade">`. In `site.js`, `show(i)` only does `dl.textContent = dec;` — the visible `#dl` span gets "1990", but nothing is written back to the input. `aria-valuetext` appears nowhere in `site.js` or any HTML file (grep-verified).
- **Why it's wrong:** A screen-reader user operating the slider — the central interaction of every state page — hears "Census decade, 7, range 0 to 7." The mapping 0→1950 … 7→2020 is never exposed. The visible `.decade-label` is not programmatically associated with the input, so SR users get a number with no meaning. This is the page's primary control failing WCAG 4.1.2 (name/role/**value**).
- **Fix:** In `GD.statePage.show(i)`, add `slider.setAttribute('aria-valuetext', dec);` (one line), and set the initial value in the generated HTML (`aria-valuetext="2020"`). Optionally also point the input at the visible label: give the row a real `<label for="slider">Census decade</label>` or `aria-describedby="dl"`.

### M2. US-map state labels drop to 1.17:1 contrast on hover/focus
- **Files:** `site/assets/site.css` lines 121–124; `site/index.html` line 102 (46 `<text class="us-label">` elements).
- **What I saw:**
  - `.us-state{fill:#dfe5f5;…}` and `.us-state:hover,.us-state:focus{fill:var(--accent)}` (accent = `#2c4bd8`).
  - `.us-label{font:600 11px var(--sans);fill:#5a648c;pointer-events:none}` — the label sits on top of the path and does not change color.
  - Computed ratios: `#5a648c` on resting `#dfe5f5` = **4.58:1** (passes AA by 0.08); `#5a648c` on hover/focus `#2c4bd8` = **1.17:1** (illegible — below even the 3:1 large-text floor).
- **Why it's wrong:** The moment any user — mouse or keyboard — hovers/focuses a state, its two-letter label visually vanishes. Keyboard users tabbing through the map (each path is focusable) see every label disappear under focus. The resting 4.58:1 at 11px semibold is also razor-thin margin for the smallest text on the site.
- **Fix:** Add `.us-state:hover + .us-label, .us-state:focus + .us-label { fill:#fff }` if labels are adjacent siblings — or simpler and structure-independent: brighten the hover fill less (e.g., `#aebbe8`-tier tint) **or** switch labels to `#fff` via a JS class toggle in `GD.usMap`'s existing hover/focus handlers. Also consider darkening the resting label to `#4a5478` (≈5.5:1) for margin.

---

## MINOR

### m1. No skip link on any page
- **Files:** all six reviewed HTML files (`grep -i skip` across `index.html`/`how-it-works.html` returns nothing).
- **What I saw:** `<main id="main">` exists everywhere — the anchor target is already there — but no "Skip to content" link precedes the sticky `<nav>`.
- **Why:** WCAG 2.4.1 (Bypass Blocks). The nav is only 5 links + brand, so the cost is modest per page, but on `index.html` a keyboard user must also traverse the 50 focusable map paths to reach content below the map (see m5).
- **Fix:** Add `<a class="skip" href="#main">Skip to content</a>` as the first child of `<body>`, visually hidden until focused. The `id="main"` hook is already in place on every page.

### m2. Canvases have no fallback content and no `role`
- **Files:** `site/index.html` line 85, `site/how-it-works.html` line 42 (`<canvas class="demo" aria-label="Animation of the splitline algorithm cutting Colorado into 8 equal-population districts"></canvas>`), `site/state/TX.html` line 24.
- **What I saw:** All canvases are empty elements (`</canvas>` immediately follows) and carry `aria-label` but no `role`. Per HTML-AAM, `<canvas>` has no implicit role, so an `aria-label` on a role-less element is unreliably exposed (some AT/browser pairs drop it entirely).
- **Good part to keep:** the state-page canvas label *explicitly states the text alternative* — "The table below lists every district." — which is exactly what this lens asks for, and the data table `GD.statePage` injects (District / Population / From equal share) is an adequate equivalent. The CO animation's `aria-live="polite"` narration ("Cut 3 of 7… 2,880,697 people northeast…") is likewise a real text equivalent.
- **Fix:** Add `role="img"` to each canvas, and put the alternative inside as fallback content too, e.g. `<canvas …>Animation of the splitline rule cutting Colorado into 8 districts; the narration text below describes each cut.</canvas>`. On state pages: `…>The table below lists every district.</canvas>`.

### m3. State-jump select: `aria-label` contradicts the visible `<label>`
- **File:** `site/index.html` lines 106–107.
- **What I saw:** `<label for="statejump"><b>Or jump straight to a state:</b></label>` followed by `<select id="statejump" aria-label="Choose a state">`. `aria-label` wins name computation, so the accessible name is "Choose a state" while the visible label says "Or jump straight to a state".
- **Why:** WCAG 2.5.3 (Label in Name) — voice-control users saying the visible label won't match; SR users hear a different name than sighted users see. The `aria-label` is pure downside here because a correct `<label for>` already exists.
- **Fix:** Delete the `aria-label` from the select.

### m4. `aria-current="page"` on a link to a *different* page
- **Files:** `site/state/TX.html` line 10, `site/state/WY.html` line 10: `<a class="link" href="../index.html#map" aria-current="page">Your state</a>`.
- **What I saw:** On TX.html, the link marked "current page" points to `index.html#map`. SRs will announce "Your state, current page" for a link that navigates away from the current page.
- **Why:** Misuse of `aria-current` — it asserts this link represents the page the user is on, which is false (they're on TX.html).
- **Fix:** Either drop `aria-current` on state pages, or use `aria-current="true"` with the understanding it marks the active *section* — better, mark nothing and add a breadcrumb ("Your state › Texas").

### m5. 50 tab stops on the US map before the jump-select
- **File:** `site/index.html` line 102 (50 × `tabindex="0"` paths, grep-verified) + `.state-jump` at lines 105–111, which comes *after* the map in DOM order.
- **What I saw:** Every state path is an individual tab stop. The `<select>` — the fastest keyboard route to a state — sits after all 50.
- **Why:** A keyboard user reaching the map must press Tab up to 50 times to get past it. The standard fix for composite widgets is one tab stop + arrow keys (roving tabindex), but the cheap fix preserves the current (otherwise excellent) per-state pattern.
- **Fix:** Move the `.state-jump` block above `.usmap-wrap` in the DOM ("prefer the dropdown, or tab into the map"), or implement roving tabindex in `GD.usMap`.

### m6. 46 `<text class="us-label">` elements are exposed to screen readers as stray text
- **File:** `site/index.html` line 102 — `<text class="us-label" x="684" y="443">AL</text>` ×46, none with `aria-hidden` (grep: 0 matches).
- **Why:** Inside the `role="group"` SVG, SRs will read "AL AK AZ AR…" as loose text interleaved with the 50 properly-labelled `role="link"` paths ("Alabama — 7 seats"). Pure duplication noise for non-visual users.
- **Fix:** Wrap the labels in `<g aria-hidden="true">…</g>` in the site generator.

### m7. Footer skips heading levels on every page
- **Files:** all pages — e.g. `site/index.html` lines 172/178/184 `<h4>Explore</h4>`, `<h4>Go deeper</h4>`, `<h4>Data</h4>`. On `faq.html` the document outline is h1 → h4 (no h2/h3 anywhere); on others h2 → h4.
- **Why:** Heading-level skips break SR outline navigation expectations (WCAG 1.3.1 technique H42 / best practice). Each page otherwise has exactly one `<h1>` and clean h1→h2(→h3) flow — the footer is the only offender.
- **Fix:** Make them `<h2>` (or `<h3>` where an h2 precedes) and keep the small visual style via the existing `footer.site h4` CSS selector renamed to a class (`.foot-h`).

### m8. Gerrymander demo results aren't announced (no live region)
- **Files:** `site/index.html` lines 43–48 (`<div class="scoreboard"></div>`, `<p class="takeaway"></p>`); `site/assets/site.js` lines 102–106.
- **What I saw:** Clicking a tab updates `aria-pressed` (good) and rewrites `.scoreboard` and `.takeaway` text — but neither container is a live region, unlike the cut-animation's `.narration` which correctly has `aria-live="polite"`.
- **Why:** An SR user pressing "Tidy straight strips" gets no feedback that Purple now wins 5–0 — the entire point of the demo. (The SVG's static `aria-label` at index line 46 describes the concept but never the current result.)
- **Fix:** Add `aria-live="polite"` to `<p class="takeaway">` (announcing the takeaway sentence alone is sufficient and avoids double-announcement).

### m9. `#mapimg`: invalid empty `src=""` and an alt that never names the decade
- **Files:** `site/state/TX.html` line 25 (`<img id="mapimg" src="" alt="Texas district map for the selected decade">`), same in WY.html; `site.js` `show()` sets `src` per decade but never touches `alt`.
- **Why:** (a) `src=""` is invalid HTML (validators flag it; older engines fetched the page URL). (b) The alt "for the selected decade" forces SR users to cross-reference a slider whose value is itself broken (M1). After M1 is fixed this becomes mild, but `alt="Texas district map, 1990 — 27 districts"` is one line in `show()`.
- **Fix:** Generate the initial `src` for 2020 (or omit the img until JS sets it), and update `imgEl.alt` alongside `imgEl.src` in `show()`.

### m10. Zero no-JS fallback — blank panels with no explanation
- **Files:** all pages (`grep -c noscript` = 0 across the site). On `state/TX.html`, without JS the user gets an empty mapframe (img with `src=""`), an empty `#mapnote`, an empty `#statsbox`, and a slider that does nothing. On `index.html` the gerry SVG (line 46) and scoreboard render empty while their `aria-label` promises content.
- **Why:** A public, evidence-style site claiming "anyone can check it" shouldn't degrade to silent blank boxes. One `<noscript>` line preserves trust.
- **Fix:** Add `<noscript><p class="callout warn">The interactive maps and tables on this page require JavaScript. All underlying data is in <a href="report.html">the full report</a>.</p></noscript>` to pages with JS-built content.

### m11. District highlighting is mouse-only (table rows and canvas)
- **File:** `site/assets/site.js` lines 173–179 (canvas `mousemove`/`click` only) and 394–397 (`tr` `mouseenter`/`mouseleave` only); `site/state/TX.html` note text from `show()`: "Hover or tap a district to see its population."
- **What I saw:** No keyboard path to the highlight/lock interaction: the canvas takes no key events and the table rows aren't focusable. The injected data table does carry all the information (population, deviation), so this is an enhancement gap, not an information gap — which is why it's MINOR, not MAJOR.
- **Fix:** Make each `<tr data-d>` focusable (`tabindex="0"`) and mirror `mouseenter`/`mouseleave` with `focus`/`blur` calling `mapApi.select()`. Reword the note to "Hover, tap, or use the table below…".

---

## NIT

### n1. FAQ summary "+/–" pseudo-content leaks into accessible names
- **Files:** `site/assets/site.css` lines 163–164 (`details.faq summary::after{content:"+"}`, `[open] …{content:"–"}`).
- CSS `content` participates in accessible-name computation, so SRs may read "Doesn't this hurt minority representation under the Voting Rights Act? plus". Fix: `content:"+" / ""` (alt-text syntax) or add `speak:never`-equivalent via `::after{…}` with `aria-hidden` wrapper — simplest is the modern two-value content syntax.

### n2. Injected table headers lack `scope`
- **File:** `site/assets/site.js` line 390 — `<th>District</th><th>Population</th><th>From equal share</th>`.
- Harmless in a simple 3-column table, but `scope="col"` is one string away and removes all ambiguity for older AT.

### n3. Device-specific instruction wording
- **File:** `site/index.html` line 100: "Click any state … hover over every district". Keyboard/touch/SR users are told to click/hover only. Fix: "Choose any state… (click, tap, or use the state list below)".

### n4. `.map-tip` opacity transition not covered by reduced-motion block
- **File:** `site/assets/site.css` line 127 (`transition:opacity .1s`). The reduced-motion media queries cover `scroll-behavior`, `.us-state`, and `.reveal` (lines 17, 122, 181) but not this one. At 100ms it's negligible — flagging only for completeness of the pattern.

### n5. `pre` code block is a scroll container with no keyboard access
- **File:** `site/about.html` line 49 — `<pre style="…overflow:auto…">`. When it overflows (mobile widths), keyboard users can't scroll it (WCAG 2.1.1). Fix: add `tabindex="0" role="region" aria-label="Run commands"`.

---

## Verified PASSES (checked, not assumed — keep these as-is)

- **US-map keyboard pattern is genuinely good:** every state path has `tabindex="0" role="link" aria-label="Alabama — 7 seats"` (index line 102), and `site.js` line 55 handles **both Enter and Space** with `preventDefault`. The lens question "does the HTML support the JS handling?" — yes, fully.
- **Focus visibility:** `.btn:focus-visible, a:focus-visible, [tabindex]:focus-visible{outline:3px solid var(--accent);outline-offset:2px}` (CSS line 67) covers buttons, links, and the map paths; `.us-state:focus` additionally recolors the path. No `outline:none` anywhere in the stylesheet. Native focus rings remain on `.tab`, `select`, and the range input.
- **`prefers-reduced-motion`:** three CSS overrides (smooth-scroll, state-hover transition, `.reveal`) **plus** JS: `REDUCED` (site.js line 8) makes `GD.reveal` show everything immediately (line 41) and makes the cut animation jump step-by-step instead of sweeping (line 325) while keeping Play functional (line 284). The animation also never autoplays — it waits for the Play button. This is above-average coverage.
- **Live regions:** `.narration` (`aria-live="polite"`, index line 92 / how-it-works line 49) narrates each cut with real numbers — an honest text equivalent of the canvas animation. `.map-tip` and `#maptip` use `role="status"`, and the focus handler (site.js lines 64–70) repositions the tooltip for keyboard users. `.progress-dots` is correctly `aria-hidden="true"`.
- **Contrast (computed):** ink/paper **14.41**, ink2/paper **9.02**, muted/paper **4.88**, muted/card **5.32**, `#aebbe8`/navy (stat labels + footer text) **7.75**, footer links `#dbe3fb`/navy **11.47**, navy-band body `#e7ebfa` **12.36**, navy-band kicker `#9db1f7` **7.04**, accent links on paper **6.21**, white on `.btn-primary` `#2c4bd8` **6.76**, thead navy on `#eef1fd` **13.04**, pre code **11.47**. All pass AA, including the 13–13.5px footer/stat text. The only failures are the `.us-label` cases in M2. (`--gold #b07a1e` at 3.45:1 vs `--warn-bg` is used only as a border color, never text — not a violation.)
- **Document basics:** `lang="en"` on all six pages; exactly one `<h1>` per page; `<nav aria-label="Main">` / `<main id="main">` / `<footer>` landmarks on every page; unique, descriptive `<title>` and `meta description` per page (state pages templated per-state); viewport tag does **not** disable zoom.
- **Alt text:** the five Ohio history-strip images carry decade-specific alts ("Ohio's algorithm-drawn districts in 1950", index line 121); all decorative brand/diagram SVGs are `aria-hidden="true"`; the gerry SVG has `role="img"` with a substantive label.
- **Link text:** no "click here"/"read more" anti-patterns anywhere — every link names its destination ("Read the full plain-English walkthrough", "Slide through Ohio's decades yourself").
- **Form semantics:** the state-jump `<select>` has a real `<label for>` (modulo m3) and a meaningful placeholder option.

---

*Counts: FATAL 0 · MAJOR 2 · MINOR 11 · NIT 5.*

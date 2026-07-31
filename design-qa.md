# Design QA — Love 21 role-adaptive redesign, round 3

## Evidence

- Rendered implementation: `http://127.0.0.1:8001/?chooseRole=1`
- Role wall before this round: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-role-wall-before-round3.jpg`
- Final desktop role wall: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-role-wall-final-round3.jpg`
- Final mobile role wall: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-role-wall-mobile-final-round3.jpg`
- Role-wall comparison: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-role-wall-comparison-round3.png`
- AI assistant before this round: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-ai-assistant-round2.jpg`
- Final desktop AI Agent: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-ai-agent-round3.jpg`
- Final mobile AI Agent: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-ai-agent-mobile-round3.jpg`
- AI Agent comparison: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-agent-comparison-round3.png`
- Finance before this round: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-finance-round2.jpg`
- Donor-home financial figures: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-donor-finance-charts-round3.jpg`
- Mobile donor financial section: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-donor-mobile-finance-round3.jpg`
- Finance comparison: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-finance-comparison-round3.png`
- Board before this round: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-board-round2.jpg`
- Final twelve-card Board directory: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-board-cards-all-round3.jpg`
- Board comparison: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-board-comparison-round3.png`
- Final donor hero: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-donor-hero-final-round3.jpg`
- Final donor call to action: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-donor-donate-cta-round3.jpg`
- Final family login call to action: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-family-login-cta-round3b.jpg`

### Viewports and normalization

- Desktop implementation: 1280 × 800 CSS pixels at 1× capture density.
- Mobile implementation: 390 × 844 CSS pixels at 1× capture density.
- The role-wall before and after states were both 1280 × 800 and were placed side-by-side without cropping.
- The AI Agent, finance, and Board before/after states were aspect-fit and padded to 1280 × 800 columns before being placed side-by-side.
- Focused regions included the complete role gate, the opened assistant panel, the donor charts, all Board cards, and the primary family/donor calls to action.

## Comparison judgment

The new role wall changes the background from a few oversized panels into a dense, multi-row photographic mosaic. The centered role form remains readable because the darker photography treatment and white panel preserve contrast. Six desktop rows and seven mobile rows move left together at varied speeds, while each completed cycle swaps in a new batch from the 2,626-image manifest so the whole valid archive is represented without placing thousands of live image nodes in the DOM at once.

The assistant comparison shows a clearer product identity and a quieter open state. “AI Agent” appears in the launcher, panel header, response label, and disclosure copy; hard divider lines were removed in favour of whitespace, subtle surfaces, and a single focused input border.

The finance comparison confirms that the same published income, expenditure, and two-year figures now appear directly on the donor home page. The Board comparison confirms twelve visible member cards, including explicit no-photo cards for Carol Chan and Kevin Wong rather than omitted names or invented portraits.

## Findings and iterations

### Iteration 1 — fixed

- [P1] A first implementation moved each photo with `requestAnimationFrame`; browser captures intermittently showed partially composited role-button text while the wall was updating.
  - Fix: moved motion to CSS transforms and limited JavaScript to swapping batches on `animationiteration`.
  - Result: the final desktop and mobile role captures show all five choices with complete text and stable panel rendering.

- [P2] The runtime environment already contained a provider API key, so enabling the external model solely from key presence could have caused an unintended outbound request.
  - Fix: added the explicit `AI_PROVIDER_ENABLED=false` gate. The provider runs only when that flag is deliberately set to `true` and a key is present.
  - Result: the exercised endpoint returned `local-tool-demo`, and no provider call was made.

### Iteration 2 — passed

- No actionable P0, P1, or P2 visual or interaction issue remains.
- The opened mobile AI Agent is 366 × 669 CSS pixels inside the 390 × 844 viewport, with 12-pixel side margins and zero document-level horizontal overflow.
- Mobile chart canvases render at 324 × 300 CSS pixels.
- Desktop and mobile role gates keep all five required choices visible.

## Required fidelity surfaces

- Photo wall: 2,626 valid unique archive images are available through the generated manifest; desktop renders 192 live tiles across six rows and mobile renders 168 across seven rows, then rotates batches after each leftward cycle.
- Navigation and role gate: the gate has no top bar and still requires a role; the site navigation remains unchanged after entry.
- Board: twelve current names are represented as twelve visible cards; ten supplied portraits are used and two members have clear no-photo states.
- AI Agent: naming is explicit, the panel is visually simpler, Markdown remains styled, suggested questions remain horizontally accessible on mobile, and the input remains usable.
- Provider configuration: `backend/.env.example` documents the optional provider settings; `backend/.env` is ignored and was verified with `git check-ignore`.
- Donor finance: income, expenditure, composition, and two-year comparison charts appear directly on the donor home page while official report links remain available.
- Primary actions: donor `Donate now` and family `Log in to start` use high-contrast dark sections and large white buttons; the donor hero also leads with `Donate now`.
- Accessibility: semantic controls, region labels, descriptive chart alternatives, visible focus treatment, reduced-motion handling, and minimum mobile tap targets were checked.

## Verification

- [x] `git diff --check`
- [x] JavaScript syntax checks for `docs/js/app.js`, `docs/js/about.js`, and `scripts/build-photo-wall-assets.mjs`
- [x] Python bytecode compilation for `backend/app`
- [x] Local `POST /api/agent/chat` exercised with provider disabled
- [x] `backend/.env` confirmed ignored; `backend/.env.example` confirmed trackable
- [x] In-app browser interaction and visual QA at 1280 × 800 and 390 × 844
- [x] Browser console checked for warnings and errors

final result: passed

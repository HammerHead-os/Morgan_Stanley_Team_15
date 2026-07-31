# Design QA — Love 21 role gate, round 4

## Evidence

- Source visual truth: `/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/TemporaryItems/NSIRD_screencaptureui_FdIlap/Screenshot 2026-07-31 at 6.27.33 PM.png`
- Rendered implementation: `http://127.0.0.1:8001/?chooseRole=1`
- Final desktop implementation: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-role-gate-dark-desktop-final-round4.jpg`
- Final mobile implementation: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-role-gate-dark-mobile-round4.jpg`
- Short desktop implementation: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-role-gate-dark-short-fixed-round4.jpg`
- Full-view source/implementation comparison: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-role-gate-reference-comparison-round4.png`

## Normalization and state

- Source image: 556 × 584 pixels. It is a square-ish social graphic, not a website viewport.
- Desktop implementation: 1280 × 800 CSS pixels at 1× capture density.
- Mobile implementation: 390 × 844 CSS pixels at 1× capture density.
- Short desktop implementation: 1280 × 720 CSS pixels at 1× capture density.
- For the full-view comparison, the source was aspect-fit and padded inside a 1280 × 800 column; the implementation was captured at 1280 × 800 and placed beside it without cropping.
- Compared state: mandatory first-entry role selection, with all five choices visible and no navigation.
- The full-view comparison is sufficient for the important details because the logo, mission copy, question, explanatory copy, and all five controls remain legible at the normalized size.

## Comparison judgment

The website adapts the supplied social graphic rather than reproducing its red poster background. It preserves the reference’s white Love 21 mark, highly prominent mission statement, tight display typography, and dark emphasis treatment. The user-requested black transparent card replaces the poster background while the moving archive wall remains visible through the glass surface.

The mission statement now carries the strongest typographic hierarchy: “Every neurodiverse individual deserves an opportunity to reach their highest potential.” The role question is the second-level prompt, and the five choices remain a single centered column. White text, a near-black 80% surface, background blur, and subdued white borders maintain readable contrast over changing photographs.

## Findings and comparison history

### Iteration 1 — fixed

- [P2] Programmatically focusing the role question produced an unwanted browser focus rectangle around the heading in the first desktop capture.
  - Fix: retained programmatic focus for screen-reader context but removed the visual outline from the non-interactive heading. Interactive role choices keep a visible white focus ring.
  - Post-fix evidence: `team15-role-gate-dark-desktop-final-round4.jpg`.

- [P2] At 1280 × 720, the first version constrained the panel box but allowed the final role choice to paint below the viewport.
  - Fix: added a compact height mode below 760 pixels that reduces logo, type, padding, and control gaps without hiding any copy or option.
  - Post-fix evidence: `team15-role-gate-dark-short-fixed-round4.jpg`; the panel bottom is 662.48 pixels and the final choice bottom is 647.89 pixels inside a 720-pixel viewport.

### Iteration 2 — passed

- No actionable P0, P1, or P2 issue remains.
- At 1280 × 800, document `scrollHeight` and `clientHeight` are both 800 pixels.
- At 390 × 844, document `scrollHeight` and `clientHeight` are both 844 pixels.
- The body reports `overflow: hidden` while the role gate is open and returns to normal after a role is selected.

## Required fidelity surfaces

- Fonts and typography: the existing site typeface remains consistent; the mission uses a compact 1.04 line height, strong weight, and negative tracking inspired by the reference.
- Spacing and layout: the card stays centered with visible breathing room at desktop, mobile, and 720-pixel height; all five choices remain visible.
- Colors and tokens: the card uses `rgba(8, 8, 8, 0.8)`, white type, translucent borders, and a restrained blur. Contrast remains stable over the animated imagery.
- Image quality: the existing real Love 21 archive photographs and raster logo are preserved. The logo is filtered to a white lockup to match the supplied reference.
- Copy and content: the reference mission is promoted above the role question; the explanatory role text and all five role choices are unchanged.
- Responsiveness: the role gate has a fixed `100svh` height, page scrolling is disabled in the gate state, and a compact height breakpoint prevents clipping.
- Interaction: selecting Donor closes the gate, restores normal document overflow, and opens the donor experience with the expected hero.

## Verification

- [x] Desktop role gate at 1280 × 800
- [x] Short desktop role gate at 1280 × 720
- [x] Mobile role gate at 390 × 844
- [x] All five options visible in every tested viewport
- [x] Page height equals viewport height in role-gate state
- [x] Donor role-selection transition exercised
- [x] Browser console checked with no warnings or errors
- [x] HTML/CSS and repository whitespace checks completed

final result: passed

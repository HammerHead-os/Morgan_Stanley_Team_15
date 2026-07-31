# Design QA — Love 21 role-adaptive redesign

## Evidence

- Source visual truth: `/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/TemporaryItems/NSIRD_screencaptureui_C2i7hE/Screenshot 2026-07-31 at 4.04.27 PM.png`
- Rendered implementation: `http://127.0.0.1:8001/?chooseRole=1`
- Final desktop screenshot: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-role-gate-final.png`
- Normalized full-view comparison: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-reference-comparison.png`
- Final mobile role gate: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-mobile-role-gate-final.png`
- Final mobile Family home: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-mobile-family-final-3.png`
- Final mobile Profile: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-mobile-profile-final.png`

### Viewport and normalization

- Source pixels: 2286 × 778.
- Desktop implementation pixels and CSS viewport: 1280 × 720 at 1× capture density.
- Full-view comparison: each image was aspect-fit and padded to 1200 × 720, then placed side-by-side in a 2400 × 720 canvas. The reference is an information-architecture flow, not a pixel-level page mock, so the comparison evaluates the role-first hierarchy and state model rather than literal component styling.
- Mobile implementation pixels and CSS viewport: 390 × 844 at 1× capture density.
- State: first-entry role question with all five paths visible; remembered Family role is shown in the persistent role switcher. The role selection is skippable, remembered, and switchable.

### Full-view comparison evidence

The combined comparison shows that the implementation preserves the source's primary sequence: arrival → “What brings you here today?” → five role choices → a remembered, switchable experience. It translates the source's role-column diagram into a working, responsive role gate while keeping the three requested global destinations in the top bar.

### Focused-region evidence

A separate source/implementation crop was not required because the source is a low-detail structural flow chart with no target typography, imagery, iconography, or mobile treatment to match. The complete 2400 × 720 comparison keeps every source label and every implemented role card legible. Responsive details were instead checked directly in the 390 × 844 role-gate, Family-home, and Profile captures listed above.

## Findings

- No actionable P0, P1, or P2 mismatch remains.
- [P3] The compact mobile role chip truncates long labels such as “Family or participant.”
  - Location: shared mobile navigation, `.nav-role`.
  - Evidence: the 390 px capture keeps the logo, role switcher, and Menu control on one row, but the role label is ellipsized.
  - Impact: the selected role remains understandable and the control remains usable, but a shorter mobile-only label would be slightly cleaner.
  - Fix: optionally add a `shortLabel` value such as “Family” for the mobile navigation only.

## Required fidelity surfaces

- Fonts and typography: the implementation uses a neutral sans-serif hierarchy with heavy display headlines, readable body copy, clear eyebrow labels, and stable wrapping on desktop and mobile. No broken wrapping or weight collisions remain.
- Spacing and layout rhythm: the role gate follows the reference hierarchy, desktop cards align to a two-column grid, mobile cards collapse to one column, and the Profile hero and tabs were tightened so useful content appears earlier.
- Colors and tokens: white, near-black, and neutral gray tokens consistently deliver the requested Notion-like visual language. Contrast remains strong for primary text and controls.
- Image quality and asset fidelity: all visible photography and the logo are real Love 21 assets copied from the supplied archive; no placeholder, CSS-drawn, emoji, or handcrafted SVG substitutes are used.
- Copy and content: each role has a coherent hero, CTA, and ordered module sequence. Official report links and Love 21 story/programme language are grounded in the supplied archive and official website.
- Icons and controls: the design deliberately uses text controls and the real Love 21 logo; no missing target iconography exists in the structural reference.
- Responsiveness and accessibility: desktop and 390 px mobile states were checked for overflow, overlap, tap-target spacing, semantic role buttons, headings, labels, and descriptive image alt text.

## Open Questions

- Instagram images remain visibly identified as an archive preview, with reuse rights and participant consent subject to Love 21 staff review.

## Comparison history

### Iteration 1 — blocked

- [P2] Mobile navigation crowded the long remembered-role label against the Menu control.
- [P2] Role selection inherited global smooth scrolling, so the page could briefly land below the hero even though the hero must appear first.
- [P2] The Profile hero consumed too much of the first viewport before the active passport content.

Fixes made:

- Reduced the mobile role-chip width and type size while preserving the switch control.
- Changed the post-selection jump to an immediate `scrollIntoView` state so every role begins at its hero.
- Reduced Profile hero padding and display scale and moved the tabs closer to the identity block.

Post-fix evidence:

- `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-mobile-role-gate-final.png`
- `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-mobile-family-final-3.png`
- `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-mobile-profile-final.png`

### Iteration 2 — passed

The revised 390 px captures show separated persistent controls, the Family hero first after selection, and Profile content beginning within the initial screen. No actionable P0/P1/P2 issue remains.

## Implementation checklist

- [x] Five role paths are visible, remembered, switchable, and skippable.
- [x] Hero appears first for every selected role.
- [x] Role-specific modules reuse shared sections in different orders.
- [x] About us, Join us, and Profile remain globally available.
- [x] Desktop and mobile layouts were visually checked.
- [x] Existing activity, volunteer, tax, donation, and Profile Passport flows were exercised.
- [x] JavaScript syntax and repository whitespace checks pass.

## Follow-up polish

- Add optional mobile-only short role labels if Love 21 prefers zero truncation in the persistent switcher.

final result: passed

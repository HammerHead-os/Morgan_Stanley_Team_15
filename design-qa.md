# Design QA — Love 21 role entry and Family CTA, round 7

## Evidence

- Rendered implementation: `http://127.0.0.1:8001/?chooseRole=1`
- Role-gate source visual truth: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-role-gate-light-desktop-final-round6.jpg`
- Family-login source visual truth: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-family-login-cta-round3b.jpg`
- Final desktop role gate: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-role-gate-clear-photos-round7.jpg`
- Final mobile role gate: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-role-gate-clear-photos-mobile-round7.jpg`
- Final solid ROLE control: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-family-nav-role-solid-round7.jpg`
- Final Family login module: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-family-login-red-final-clean-round7.jpg`
- Role-gate before/after comparison: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-role-gate-photo-clarity-comparison-round7.png`
- Family-login before/after comparison: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-family-login-comparison-round7.png`

## Normalization and state

- Desktop implementation: 1280 × 800 CSS pixels at 1× capture density.
- Mobile implementation: 390 × 844 CSS pixels at 1× capture density.
- Role-gate comparisons use the mandatory role-selection state with no navigation and all five choices visible.
- Family comparisons use the final profile-passport module and include the persistent navigation and AI Agent launcher.

## Comparison judgment

The photo wall is now materially clearer while retaining the white visual relationship with the interior pages. The overlay opacity was reduced from 46% to 16%, and the photographs use lighter color correction rather than a washed-out treatment. The translucent white card continues to provide sufficient text contrast.

Role selection now has a short, purposeful handoff: the gate card and wall recede before the selected homepage fades and rises into place. The navigation ROLE control is a solid Love 21 red control without a border. The Family login module now uses the same red conversion language as Donate, with a white high-contrast CTA.

## Findings

### Iteration 1 — passed

- No actionable P0, P1, or P2 issue remains.
- The photo-wall overlay computes to `rgba(255, 255, 255, 0.16)`.
- Photo treatment computes to `saturate(0.84) contrast(0.98)`.
- The ROLE control computes to `#8e1820`, white text, and a zero-width border.
- The Family login section computes to `#8e1820`; its nested CTA container is transparent and borderless, and the CTA button is white.
- Desktop `scrollHeight` and `clientHeight` are both 800 pixels; mobile values are both 844 pixels.

## Required fidelity surfaces

- Fonts and typography: hierarchy, wrapping, weights, logo color, and mission accents remain intact.
- Spacing and layout: role-card geometry, separators, fixed-height placement, navigation rhythm, and Family CTA alignment remain stable.
- Colors and tokens: the white page relationship is preserved while photography is more legible; solid ROLE and Family CTA treatments use the shared Love 21 red.
- Image quality: real Love 21 photographs remain sharp enough to read as a wall rather than a pale texture.
- Copy and content: mission, question, descriptions, role choices, and Family passport copy are unchanged.
- Responsiveness: desktop and 390-pixel mobile role gates show all choices without document scrolling.
- Interaction: selection exercises a 260 ms gate exit followed by a 360/420 ms homepage fade-and-rise. Direct role URLs and reduced-motion preferences remain immediate.

## Verification

- [x] Desktop role gate at 1280 × 800
- [x] Mobile role gate at 390 × 844
- [x] Reduced photo-wall overlay and revised image treatment verified
- [x] All five choices visible without document scrolling
- [x] Role-selection transition exercised through the final Family state
- [x] Solid, borderless ROLE control verified
- [x] Red Family login module and white CTA verified
- [x] Browser console checked with no warnings or errors
- [x] JavaScript syntax and repository whitespace checks completed

final result: passed

# Design QA — About Us Instagram cards

## Evidence

- Source visual truth: `/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/TemporaryItems/NSIRD_screencaptureui_tUmpCN/Screenshot 2026-08-01 at 11.42.11 AM.png`
- Latest browser implementation: `/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/about-instagram-caption-order.png`
- Side-by-side comparison: `/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/about-instagram-caption-comparison.jpg`
- Source pixels: 688 × 924.
- Implementation pixels: 1280 × 720 at a 1280 × 720 CSS viewport; browser device pixel ratio 2, with the captured image normalized to CSS-pixel dimensions.
- State: About Us page, Pinned posts row, default desktop state.

## Findings

No actionable P0, P1, or P2 differences remain for the requested card anatomy and caption update.

- Typography: account metadata, caption, and supporting link use the existing site type system at compact Instagram-like weights and sizes. Long captions truncate after two lines without breaking the grid.
- Spacing and layout: header, square media, action row, caption, and final Instagram link follow the reference hierarchy. All three cards remain aligned.
- Colors and tokens: white card surfaces, neutral borders, black controls, existing radius, and existing Love 21 elevation tokens are consistent with the page.
- Image quality: existing local Love 21 media and logo assets remain sharp and use intentional square crops; icon assets come from Bootstrap Icons.
- Copy and content: all three pinned captions now use the user-provided copy in concise form. “View post on Instagram” appears below the caption.
- Interaction and accessibility: each complete card remains a labelled external link; keyboard focus and hover states are preserved.
- Browser checks: card links and page rendering loaded successfully; no console warnings or errors were reported.

The full-view comparison covers the three-column rhythm and relationship to the Recent posts row. The pinned-card crop also provides the focused comparison needed to judge header, media, icon, caption, and link order; no additional crop is required.

## Comparison history

- Earlier implementation placed “View post on Instagram” above the caption and used short placeholder captions.
- Fix applied: moved the link below the caption and replaced the three pinned captions with concise excerpts from the supplied Instagram copy.
- Post-fix evidence: `about-instagram-caption-order.png` shows the corrected hierarchy across all three pinned cards.

## Follow-up polish

- P3: verified like counts can replace the neutral Instagram link label later if engagement metrics are supplied by the Instagram API.

## Implementation checklist

- [x] Caption appears before the Instagram link.
- [x] Left, middle, and right pinned captions are updated.
- [x] Long text truncates consistently.
- [x] Desktop grid remains aligned.
- [x] Browser console remains clean.

final result: passed

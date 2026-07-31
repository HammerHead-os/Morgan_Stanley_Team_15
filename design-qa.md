# Design QA — AI Agent Markdown tables, round 8

## Evidence

- Source visual truth: `/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/TemporaryItems/NSIRD_screencaptureui_Doo9c8/Screenshot 2026-07-31 at 7.56.07 PM.png`
- Rendered implementation: `http://127.0.0.1:8001/pages/about.html#reports`
- Desktop implementation: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-ai-markdown-table-desktop-round8.png`
- Mobile implementation: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-ai-markdown-table-mobile-round8.png`
- Focused implementation crop: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-ai-markdown-table-focus-round8c.png`
- Focused before/after comparison: `/private/var/folders/mq/lbb_h2b978s86pf1_p1lh1w80000gn/T/team15-ai-markdown-table-comparison-round8.png`

## Normalization and state

- Source screenshot: 750 × 356 pixels at 1× density.
- Desktop implementation viewport: 1280 × 800 CSS pixels at 1× density.
- Mobile implementation viewport: 390 × 844 CSS pixels at 1× density.
- Focused comparison normalizes both message crops to 356 pixels high and places the source on the left and rendered implementation on the right.
- Compared state: AI Agent open after a financial question that returns a two-column Markdown table with total income and total expenditure.

## Findings and comparison history

### Iteration 1 — fixed

- [P1] Markdown table syntax was shown as paragraph text with literal pipe and delimiter characters.
  - Location: AI Agent response renderer, `docs/js/app.js`.
  - Evidence: the source screenshot shows `|`, `---`, and row syntax instead of a semantic table.
  - Impact: financial comparisons are difficult to scan and appear broken.
  - Fix: added safe GitHub-Flavored Markdown table detection, semantic `table`/`thead`/`tbody` output, and preserved the existing HTML-escaping and inline-formatting path.

### Iteration 2 — passed

- No actionable P0, P1, or P2 issue remains.
- The rendered response contains one semantic table with two headers and three total rows.
- Desktop table width is 328 CSS pixels with no unnecessary overflow.
- Mobile wrapper width is 278 CSS pixels and exposes horizontal scrolling for wider future tables.
- Browser console contains no warning or error associated with the interaction.

## Required fidelity surfaces

- Fonts and typography: the compact chatbot type scale is preserved; the table header uses a stronger weight and smaller label treatment consistent with the existing interface.
- Spacing and layout: the table sits within the existing message card, uses compact cell padding, and does not widen or clip the AI Agent window.
- Colors and tokens: white rows, the existing paper-toned header, subtle shared border token, and dark ink values match the current Notion-like visual language.
- Image quality and assets: no visible image asset changed.
- Copy and content: `Item`, `Amount (HKD)`, `Total income`, `Total expenditure`, and both published amounts render without alteration.
- Responsiveness: desktop and 390-pixel mobile states remain readable; wider tables use a contained horizontal scroller rather than overflowing the window.
- Accessibility: semantic column headers use `scope="col"` and the table remains available to browser accessibility APIs.

## Verification

- [x] Source and focused implementation opened together and visually compared
- [x] Real AI response generated a Markdown table through the running API
- [x] Desktop AI Agent state checked at 1280 × 800
- [x] Mobile AI Agent state checked at 390 × 844
- [x] Table DOM structure, row count, header copy, and numeric copy checked
- [x] JavaScript syntax and repository whitespace checks completed

final result: passed

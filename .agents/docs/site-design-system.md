# Homepage design system

This document is the design and review entry point for the CordisX homepage,
documentation index, marketplace, and marketplace detail pages. It records the
stable visual method behind the site. Page-specific data and capture mechanics
remain in their owning documents.

## Design intent

CordisX should feel like a restrained technical publication: one narrow,
continuous canvas with generous outer margins, precise borders, quiet dark
greys, and small geometric details. The interface demonstrates extensibility
through real interactions and real product media rather than large marketing
copy or ornamental card collections.

Use references such as Vite+ for rhythm and restraint, not as a layout to copy.
Preserve the CordisX frame, junction markers, typography, icon language, and
content hierarchy when adding a new page.

## Shared frame and geometry

- The desktop site uses one centered fixed reading frame. `styles.css` owns the
  current maximum width and responsive fallback; pages must not introduce a
  second page-specific maximum width.
- The outer canvas and the framed site use the same base color in each theme.
  Header, content, and footer may use restrained surface variation, but a
  visible unrelated strip around the header is a defect.
- Header, homepage sections, functional pages, and footer share the same left
  and right borders. Their inner content uses the common horizontal inset.
- Every full-width section junction uses the shared half-triangle markers at
  both frame edges. Reuse the shared section treatment instead of drawing
  page-local triangles with arbitrary sizes or colors.
- A four-card index is a true edge-to-edge two-by-two field inside the content
  frame: no outer padding or grid gap. The shared borders form the seams, and
  every outer or shared corner retains the matching half-triangle geometry.
- Corners, borders, and dividers are structural accents. Avoid soft shadows,
  glass blur, floating gradients, or excessive rounded containers.

## Page composition

- The homepage begins with a vertically centered brand statement, one concise
  line of copy, and no redundant eyebrow or explanatory paragraph. The sentence
  may be slightly wider than its actions, but it must read as normal interface
  text rather than an oversized campaign headline.
- Functional pages such as Docs and Marketplace start with their function
  immediately. Do not repeat the homepage hero above search, cards, or content.
- A functional page's primary section fills at least the first viewport after
  subtracting the header and shared border. The footer must not peek into the
  initial viewport merely because the page has little data.
- Center sparse content vertically within its available field. Empty space is
  intentional; do not pin a small card or loading state to the top edge.
- Remove headings, status prose, validation notices, and labels that only
  restate the active page. Keep text closest to the action or object it
  explains.
- Homepage demonstrations should communicate one transformation at a time.
  Keep simulated request controls read-only and deterministic; use real product
  screenshots or recordings for claims about Codex itself.

## Color, type, and density

- Dark mode is the visual baseline: neutral deep grey, off-white primary text,
  muted silver secondary text, and low-contrast grey borders. Do not introduce
  a saturated brand background.
- Light mode is a first-class palette, not an afterthought. It must preserve
  the same hierarchy and geometry while keeping the outer canvas, header, body,
  section surfaces, and footer visually coherent.
- Base palette and theme projection belong in `styles.css`. Do not add isolated
  page colors when an existing surface, text, or border role applies.
- Use compact type with deliberate hierarchy. Prefer a short sentence at
  ordinary display size over large multiline headings. Monospace uppercase
  labels are reserved for small technical metadata.
- Preserve consistent control heights, insets, border weight, and optical icon
  alignment across homepage, Docs, Marketplace, and plugin detail pages.

## Icons and motion

- Use the repository's Reicon projection for interface actions. Brand marks may
  use the official CordisX assets. Do not substitute emoji, Unicode arrows,
  hand-drawn SVGs, or unrelated icon libraries.
- An icon button has one accessible name and one visual glyph. Do not repeat an
  action as both text and icon unless the label is necessary for comprehension.
- Motion should reveal cause and effect. A control may use a brief restrained
  attention cue before its first meaningful action, then stop after activation.
- The highlighted `extensible` word may use the approved chromatic offset
  treatment; avoid generic continuous shaking that moves surrounding layout.
- Respect `prefers-reduced-motion`. Animation must never be required to discover
  content or complete an action.

## Locale and theme behavior

- With no saved preference, locale follows the browser language and theme
  follows the system color scheme. A user selection persists across every site
  page.
- Homepage, Docs, Marketplace, plugin detail, footer, screenshots, posters, and
  videos must all project the same resolved locale and theme.
- English and Simplified Chinese are independent complete copy sets. Do not
  leave mixed-language labels, and do not make one locale's longer copy clip or
  move controls.
- Theme or locale changes must swap matching media and copy without changing
  section geometry or carousel position.

## Real product media

- Claims about Codex Desktop use screenshots or recordings from the real Codex
  renderer launched through CordisX. HTML imitations are allowed only for
  clearly identified conceptual interactions, never as product evidence.
- Product media is shown completely by default. Use contain-style framing and a
  stable aspect ratio; cropping away Codex chrome or CordisX context requires an
  explicit composition reason.
- Carousel captions, alt text, controls, posters, and videos are localized. The
  approved cursor and its top-left hotspot are part of the recording system,
  not a decorative overlay invented per slide.
- Follow [`showcase-capture.md`](showcase-capture.md) for isolation, theme and
  locale matrices, scene timing, cursor behavior, and regeneration.

## Responsive behavior

- Preserve the reading-frame idea on narrow screens while allowing the frame to
  occupy the viewport. Reduce insets before reducing legibility.
- Collapse multi-column cards and footer groups without introducing new visual
  hierarchy. Navigation may simplify, but Product, Docs, and Marketplace must
  remain reachable.
- No page may create horizontal scrolling at 320 CSS pixels. Controls must keep
  usable targets and media must remain fully inspectable.

## Design workflow

Use this order for visual work:

1. Establish frame, first-viewport height, section seams, and vertical centring.
2. Remove redundant copy and set the intended information density.
3. Apply shared typography, borders, Reicons, and interaction states.
4. Verify English and Chinese in system, dark, and light theme states.
5. Add or regenerate real product media only after the surrounding geometry is
   stable.
6. Run local checks and share a local URL for visual review. Publish only after
   the user explicitly requests deployment.

Do not compensate for a structural mistake with one-off padding, a larger
heading, clipped media, or a page-specific background. Fix the shared rule or
introduce a named reusable variant.

## Verification checklist

- Run `npm run check` and `git diff --check`.
- Review Homepage, Docs, Marketplace, plugin detail, and footer in English and
  Chinese, dark and light themes, plus the default system state.
- At desktop width, confirm one continuous centered frame, matching outer
  canvas, paired junction markers, common insets, and no premature footer.
- At narrow width, confirm no horizontal overflow, clipped actions, or
  inaccessible navigation.
- Exercise interactive demos twice: the first action must change state, repeated
  actions must remain coherent, and empty input must disable submission.
- Inspect every product image at full frame and every carousel transition. A
  screenshot that hides essential Codex or CordisX context fails review.

## Ownership and agent routing

- `cordisx/cordisx.github.io` owns the shared visual language for public CordisX
  sites. The `cordisx/docs` repository owns documentation-specific aggregation
  and presentation but references this document instead of copying it.
- `styles.css` owns site geometry, palette roles, shared section treatments,
  responsive rules, and control appearance.
- `preferences.js` owns locale/theme resolution, persistence, translated site
  copy, and matching showcase-media selection.
- Page HTML and page scripts own semantic structure and page-specific behavior;
  they consume shared visual roles instead of redefining them.
- Before changing any visible site layout, styling, icon, theme, locale, footer,
  or carousel behavior, read this document. For generated product media, also
  read [`showcase-capture.md`](showcase-capture.md).

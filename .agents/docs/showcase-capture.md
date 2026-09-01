# Real Codex Showcase Capture

Use `scripts/capture-codex-showcase.mjs` to regenerate homepage screenshots and
motion assets. The capture must show the real Codex Desktop renderer launched
through CordisX, not an HTML recreation of Codex.

## Capture contract

- Launch Codex with a temporary isolated HOME, CODEX_HOME, Chromium profile,
  and workspace. Reuse only the authentication and onboarding-completion state
  needed to reach the application; do not capture or publish personal project,
  thread, or account data.
- Install and activate the showcase plugin through CordisX in that isolated
  profile so the visible product difference comes from a real extension.
- Set the Codex theme and document locale explicitly for every capture. Do not
  infer either value from the operator's system settings.
- Keep capture windows opaque. Translucent or blurred application chrome mixes
  the desktop background into the recording and makes theme colors unstable.
- Generate the complete locale/theme matrix: English and Chinese in both light
  and dark themes. These are independent recordings, not one recording reused
  or recolored by the homepage.
- Reset persistent UI state before every variant. In particular, close any open
  manager surface, return its route to the Plugins page, and navigate the Codex
  workspace to the same welcome route before recording.
- Drive every variant from the same scene description in
  `scripts/showcase-motion-scene.mjs`. A locale or theme variant may change
  presentation only; targets, timing, and resulting UI state must stay aligned.
- Use the approved pointer asset and preserve its top-left click hotspot. Do not
  improvise a replacement cursor inside the capture script.

## Generate

Run the static screenshots only:

```sh
npm run capture:codex-showcase
```

Run screenshots plus all localized light/dark motion variants:

```sh
npm run capture:codex-showcase -- --motion
```

The homepage must select the matching video and poster from its current locale
and resolved theme. When either preference changes, reload the corresponding
asset rather than applying visual filters to the previous recording.

## Verify before review

1. Run `npm run check` and confirm every required MP4 and WebM variant exists
   and is referenced by the homepage.
2. Extract the same timestamp from all four videos. Confirm that route, cursor
   position, interaction state, and framing match while copy and theme differ.
3. Inspect at least one early, middle, and late frame from every variant. Check
   Codex chrome, CordisX surfaces, theme colors, locale, pointer hotspot, and
   the absence of translucent desktop bleed.
4. Open the local homepage, switch language and theme in both directions, and
   confirm the video and poster change immediately without layout movement.
5. Share the local URL for visual approval. Do not publish or deploy until the
   user explicitly requests it.

If the real Codex UI changes after an application upgrade, update selectors and
the scene script, regenerate the full matrix, and repeat the same-frame review.
Do not patch only one variant.

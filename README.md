# CordisX Homepage

Homepage source for `https://cordisx.github.io/`.

The site introduces CordisX and links to projects and documentation. It does not duplicate product documentation.

- [Browse the CordisX Marketplace](https://cordisx.github.io/marketplace/)

## Regenerate the real Codex showcase

The homepage uses a real, signed-in Codex Desktop instance with the real CordisX
runtime attached. The capture command creates disposable `HOME`, `CODEX_HOME`,
Chromium profile, and workspace directories, copies the authentication file and
non-personal migration markers, and uses an APFS copy-on-write clone of the
installed Codex runtime so a fresh capture does not repeat the 1.5 GB runtime
installation. It removes the isolated instance after the capture is written.

```sh
npm run capture:codex-showcase
npm run capture:codex-motion
```

The reusable capture starts a separate disposable Codex instance for every
English/Chinese and light/dark variant, then produces the signed-in workspace
and the Plugins, Extension points, Routes, and Marketplace pages of the real
CordisX Manager. Outputs are written to `assets/screenshots/`. Use
`npm run capture:codex-showcase -- --help` for
avatar, profile name, app bundle, authentication file, CordisX checkout,
and output-directory overrides. The command requires macOS,
`/Applications/ChatGPT.app`, a signed-in Codex auth file, and a built sibling
CordisX checkout. It also requires `ffmpeg` to normalize the full-canvas
workspace screenshots to opaque RGB output.

`capture:codex-motion` runs the declarative timeline in
`scripts/showcase-motion-scene.mjs`. It performs real Host clicks while a
scripted virtual cursor is rendered into the capture, then writes MP4, WebM,
and GIF variants to `assets/motion/`. Edit the scene instead of manually
recording a new demo after Codex or CordisX upgrades. The cursor artwork lives
separately at `assets/capture/cordisx-motion-cursor.svg`, so its visual design
can change without touching the interaction timeline.

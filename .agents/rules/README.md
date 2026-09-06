# Homepage Maintenance Rules

- Follow the [organization file-size rule](https://github.com/cordisx/cordisxmono/blob/main/.agents/rules/file-size.md) for formatting and responsibility-based splitting guidance.
- Keep claims aligned with released product capabilities.
- State clearly that CordisX is an unofficial local extension host for Codex Desktop.
- Do not publish roadmap or private planning material.
- Keep detailed product documentation at `/docs/`.
- Treat `products.yaml` as the homepage project index.
- Follow [the homepage design system](../docs/site-design-system.md) before
  changing visible layout, spacing, section geometry, typography, icons,
  theme/locale presentation, footer, or product-media framing. Fix shared roles
  before adding page-local visual overrides.
- Follow [the showcase capture workflow](../docs/showcase-capture.md) when
  regenerating real Codex screenshots or videos.
- Before changing the README's AI-first plugin demo, its GIF/MP4/WebM assets,
  or the recording scripts, follow the dedicated
  [AI-first plugin demo capture workflow](../docs/ai-plugin-demo-capture.md).
- Review visual and generated-media changes on the local homepage before
  publishing. Do not deploy them unless the user explicitly requests it.
- For generated showcase screenshots and videos, set the intended light or dark
  theme explicitly before capture. Verify the Codex shell, CordisX surfaces,
  and the homepage presentation all use the expected theme and color tokens;
  do not rely on inherited system theme or a stale isolated profile.

The quality tools preserve the verified third-party modules under
[`assets/reicon`](../../assets/reicon/README.md). The handwritten `reicons.js`
entry remains in formatting checks.

## Shared quality configuration

The local dprint and ESLint entry points consume an exact formal
[Mono quality configuration](https://github.com/cordisx/cordisxmono/blob/c63c2e8c2ba7e11502934a52ad2ce3734e804cdc/.agents/docs/quality-tooling.md).
The Shared quality configuration CI job checks the installed configuration and
tracked-file coverage; inspect its report for excluded paths.
`npm run lint:source` enforces the full source policy in blocking CI, including
existing and newly added files. Keep every maintained JS/TS file within the
organization's 1000-line limit by splitting responsibilities before expansion.
The configuration audit and full-source lint remain separate checks and reports.
Update the dependency, lock, formatter reference and CI provider SHA together.

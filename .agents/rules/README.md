# Homepage Maintenance Rules

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

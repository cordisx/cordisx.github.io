# CordisX Demo Plugin

Use the installed `cordisx-plugin-development` skill for this plugin task.

- The user's “send button” means the native Codex composer submit control.
- Use only the public Host-owned CordisX structured-effect and control-event
  contracts documented by the installed skill and the selected CordisX build.
- Consume the exact public profile `cordisx.composer-submit-celebration/v1` on
  `composer.toolbar.items`: make one explicit fiber-owned `proxy` claim, read
  `celebrationProfile`, subscribe to `submitActivated({ activationId })`, and
  invoke `presentCelebration` with a unique `requestId`, that opaque
  `activationId`, `effect: "confetti"`, and `durationMs: 2400`. Treat only an
  accepted result as success and surface unavailable/denied outcomes honestly.
- Keep the Host responsible for the full-screen effect. Do not create a fixed
  DOM overlay, canvas, selector hook, custom CSS, or synthetic click listener.
- Do not put `marker`, `testMarker`, `selector`, DOM data, message text, session
  identity, or account identity into any public declaration, event, or command.
- Read `CORDISX_DEV_ENTRY` and edit that exact managed entry in place. Keep its
  exported name `natural-language`; do not create another launcher or watcher.
- Let the existing `cordisx dev --natural-language` process publish the
  replacement generation in the same Host service.
- Run `npm run check` after the edit. Do not ask for confirmation for ordinary
  workspace edits or checks.

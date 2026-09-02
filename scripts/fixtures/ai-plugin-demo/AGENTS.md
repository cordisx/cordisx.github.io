# CordisX Demo Plugin Workspace

Use the installed `cordisx-plugin-development` skill for this plugin task.

- The `send-confetti` project was created by the real
  `create-cordisx-plugin` CLI before this session. Keep it as one independent,
  shareable plugin project; do not create or edit a shared scratch entry.
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
- Read `CORDISX_DEV_ENTRY` and edit that exact scaffolded entry in place. Keep
  its manifest id `send-confetti`, localized English and Simplified Chinese
  product copy, package metadata, localized READMEs, and project tests.
- Update both `README.md` and `README.zh-Hans.md` so the plugin details page
  describes this send-confetti behavior instead of the starter counter
  example. Include the natural phrase `全屏礼花` in the Chinese README so the
  Chinese Host visibly proves that it selected the localized document.
- This request creates and validates the plugin; it does not request
  publication. Preserve `private: true` and `UNLICENSED`, and do not ask for
  publication metadata or confirmation.
- Let the existing `cordisx dev <entry>` process publish the replacement
  generation in the same Host service. Do not create another launcher or
  watcher.
- Run `npm run check` from the `send-confetti` project after the edit. Do not
  ask for confirmation for ordinary workspace edits or checks.

# AI-first plugin demo capture

This workflow records one continuous real CordisX-launched Codex Desktop
experience. It exists for the homepage and README preview; it is not product
code and must not be copied into the CordisX Host repository.

## Truth contract

Every publishable frame comes from the same `app://-/index.html` renderer. The
video must show, in order:

1. the exact request `我要发送按钮在点击的时候全屏放礼花。` typed into the
   real Codex composer and sent through its native submit control;
2. the real Codex Agent turn editing the isolated plugin workspace;
3. the running `cordisx dev --natural-language` service publishing a replacement plugin
   generation without restarting the Codex renderer;
4. a second real native submit click; and
5. a Host-owned full-screen confetti effect in that renderer.

Do not replace the Codex shell, Agent response, tool activity, plugin reload, or
effect with HTML, captions, staged chat text, a mock renderer, or an edited-in
animation. The long Agent-work segment may sample the real renderer at a lower
rate so the README preview remains short, but frames remain ordered and no
synthetic transition is inserted. Capture metadata records both source elapsed
time and encoded time for that reason.

## Product boundary and checkpoint gate

The homepage capture owns the isolated workspace, installed plugin-development
skill, CDP recorder, visible pointer, scene timing, encoding, generated media,
and evidence. CordisX owns:

- the public structured celebration contribution/control-event contract;
- Host rendering of the full-screen effect;
- the `cordisx dev` generation watcher and transactional replacement; and
- cleanup on timeout, plugin unload, generation replacement, rollback, and
  renderer disposal.

Run the real capture only against an exact CordisX checkpoint whose public
contracts, Host implementation, skill reference, and real `app://` smoke agree.
The recorder may wait on the Host-private
`[data-cordisx-effect="confetti"]` observation marker, but plugins and public
protocol values must not receive or spoof that marker. Do not implement a
fixed plugin DOM overlay, canvas, custom CSS, native selector listener, or a
second reload API to unblock the recording.

This capture is pinned to Host commit
`b53d7ddc324c7bbdb476becb96bf5813a4b6b3c2` and protocol commit
`34d2113984882d5c0fa4f0803fb929c8da605eee`. The recorder fails closed when
the selected CordisX checkout does not match the Host checkpoint.

## Isolation and privacy

`scripts/capture-ai-plugin-demo.mjs` creates disposable and separate `HOME`,
`CODEX_HOME`, `CORDISX_HOME`, Chromium profile, workspace, and frame
directories. It copies only the authentication file and non-personal onboarding
markers needed to reach Codex, then writes an empty project/thread state. The
visible profile identity is replaced with `CordisX Demo` before frame zero.
The authentication source, file contents, personal project names, thread names,
account details, absolute operator paths, and temporary profile are never
published.

The installed `cordisx-plugin-development` skill and fixture `AGENTS.md` direct
the real Agent to the public Host-owned seam. The visible user prompt remains
the exact sentence above. Temporary source and dependency paths live outside
the repository and are removed with all owned processes after success,
failure, or interruption.

## Dry run

Build CordisX first, then exercise the isolated workspace and both codecs:

```sh
cd ../cordisx
npm ci
npm run build

cd ../cordisx.github.io
npm run capture:ai-plugin-demo -- --dry-run
```

Dry run never reads authentication, launches Codex, sends a prompt, or emits a
publishable demo. Its temporary solid-color codec input exists only to prove
the H.264 `yuv420p`/faststart and VP9 `yuv420p` command lines and is deleted.

After dry run, validate the real launch/cleanup path without sending a prompt:

```sh
npm run capture:ai-plugin-demo -- --launch-smoke
```

Launch smoke reads the selected authentication source only into the disposable
`CODEX_HOME`, starts the real `app://-/index.html` renderer, waits for the
baseline local-development generation, sanitizes the profile identity, proves
that no project/thread rows are visible, resolves the composer and native
submit control, encodes a temporary sample, and removes every owned process and
directory. It does not edit source, submit a message, claim an effect, or write
homepage media.

## Real capture and verification

```sh
npm run capture:ai-plugin-demo -- \
  --cordisx-root /absolute/verified/cordisx \
  --auth /absolute/isolated-source/auth.json
```

The recorder writes these files atomically only after the effect is observed
and verification passes:

- `assets/motion/cordisx-ai-plugin-demo-zh-dark.mp4`;
- `assets/motion/cordisx-ai-plugin-demo-zh-dark.webm`;
- `assets/motion/cordisx-ai-plugin-demo-zh-dark.json`; and
- `assets/screenshots/cordisx-ai-plugin-demo-zh-dark.png`.

The verifier requires 1600×1000 H.264/VP9 `yuv420p`, an MP4 `moov` atom before
`mdat`, matching durations, an exact prompt, a changed source, different local
plugin generations, the final native submit click, the full-screen Host marker,
and a monotonic frame ledger. After the machine gate, inspect at least one
frame from the initial prompt, Agent work, generation-ready boundary, native
proof submit, early confetti, and late confetti. Confirm the absence of personal
projects, threads, profile details, accounts, credentials, or absolute operator
paths before committing generated media.

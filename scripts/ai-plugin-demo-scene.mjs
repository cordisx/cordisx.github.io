/**
 * One continuous, real-renderer timeline for the AI-first plugin demo.
 *
 * The recorder may sample the long Agent-work phase more sparsely for a short
 * README preview, but it never substitutes authored UI, captions, or fixture
 * responses for the Codex renderer. Every encoded frame comes from the same
 * isolated app://-/index.html target.
 */
export const AI_PLUGIN_DEMO_PRESENTATIONS = Object.freeze({
  en: Object.freeze({
    language: 'en',
    locale: 'en-US',
    environmentLocale: 'en_US.UTF-8',
    prompt: 'Make the send button launch full-screen confetti when clicked.',
    proofMessage: 'Done!',
    localDevelopmentMarker: 'Local development',
    readmeMarker: 'full-screen confetti',
  }),
  zh: Object.freeze({
    language: 'zh',
    locale: 'zh-CN',
    environmentLocale: 'zh_CN.UTF-8',
    prompt: '我要发送按钮在点击的时候全屏放礼花。',
    proofMessage: '完成啦！',
    localDevelopmentMarker: '本地开发',
    readmeMarker: '全屏礼花',
  }),
})

export const AI_PLUGIN_DEMO_PROMPT = AI_PLUGIN_DEMO_PRESENTATIONS.zh.prompt

export const AI_PLUGIN_DEMO_PROOF_MESSAGE = AI_PLUGIN_DEMO_PRESENTATIONS.zh.proofMessage

export const AI_PLUGIN_DEMO_HOST_COMMIT = '56612408807a78b83b455792c425034e694db08c'

export const AI_PLUGIN_DEMO_PROTOCOL_COMMIT = '34d2113984882d5c0fa4f0803fb929c8da605eee'

export const aiPluginDemoScene = Object.freeze({
  id: 'cordisx-ai-plugin-demo.zh-CN.dark.v4',
  locale: 'zh-CN',
  theme: 'dark',
  checkpoints: Object.freeze({
    host: AI_PLUGIN_DEMO_HOST_COMMIT,
    protocol: AI_PLUGIN_DEMO_PROTOCOL_COMMIT,
  }),
  output: Object.freeze({
    width: 1600,
    height: 1000,
    frameRate: 12,
    pixelFormat: 'yuv420p',
    gif: Object.freeze({
      width: 900,
      height: 562,
      frameRate: 10,
      maxColors: 128,
    }),
  }),
  playback: Object.freeze({
    acceleratedSegments: Object.freeze({
      'codex-builds-and-cordisx-loads': 5,
    }),
  }),
  privacy: Object.freeze({
    profileLabel: 'CordisX Demo',
    emptyProjects: true,
    emptyThreads: true,
    publishAuthState: false,
  }),
  selectors: Object.freeze({
    composer: 'textarea, [contenteditable="true"]',
    effect: '[data-cordisx-effect="confetti"]',
  }),
  timeline: Object.freeze([
    Object.freeze({ type: 'hold', id: 'opening', frames: 12 }),
    Object.freeze({ type: 'type-composer', id: 'user-request', text: AI_PLUGIN_DEMO_PROMPT, framesPerCharacter: 1 }),
    Object.freeze({ type: 'click-native-submit', id: 'submit-request' }),
    Object.freeze({
      type: 'wait-real-agent-and-generation',
      id: 'codex-builds-and-cordisx-loads',
      maximumSourceSeconds: 420,
      captureEveryMilliseconds: 500,
    }),
    Object.freeze({ type: 'hold', id: 'generation-ready', frames: 12 }),
    Object.freeze({ type: 'type-composer', id: 'proof-message', text: AI_PLUGIN_DEMO_PROOF_MESSAGE, framesPerCharacter: 2 }),
    Object.freeze({ type: 'click-native-submit', id: 'submit-proof' }),
    Object.freeze({ type: 'wait-selector', id: 'fullscreen-confetti', selector: '[data-cordisx-effect="confetti"]', maximumSourceSeconds: 10 }),
    Object.freeze({ type: 'hold', id: 'confetti-visible', frames: 42 }),
    Object.freeze({ type: 'wait-selector-removed', id: 'confetti-cleared', selector: '[data-cordisx-effect="confetti"]', maximumSourceSeconds: 8 }),
    Object.freeze({ type: 'click', id: 'settings-open', selector: '[data-cordisx-manager-trigger]' }),
    Object.freeze({ type: 'hold', id: 'settings-plugins', frames: 14 }),
    Object.freeze({ type: 'click', id: 'settings-plugin-open', selector: '[data-plugin-id="send-confetti"]' }),
    Object.freeze({ type: 'hold', id: 'settings-plugin-detail', frames: 34 }),
  ]),
})

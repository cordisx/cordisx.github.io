import assert from 'node:assert/strict'
import test from 'node:test'
import { createAiPluginDemoRenderer } from './ai-plugin-demo-renderer.mjs'
import { createShowcaseCaptureMedia } from './showcase-capture-media.mjs'

function renderer() {
  return createAiPluginDemoRenderer({ scene: { selectors: { composer: '[contenteditable]' } } })
}

// These tests supply an in-memory CDP transport; they never connect to Codex.
for (
  const [name, create] of [
    ['AI demo', renderer],
    ['showcase', () => createShowcaseCaptureMedia({ motionCursorSvg: '', motionFrameRate: 12 })],
  ]
) {
  test(`${name} evaluates by value and preserves renderer exceptions`, async () => {
    const { evaluate } = create()
    const calls = []
    const value = await evaluate(async (...args) => {
      calls.push(args)
      return { result: { value: { ready: true } } }
    }, 'testExpression')
    assert.deepEqual(value, { ready: true })
    assert.deepEqual(calls, [[
      'Runtime.evaluate',
      { expression: 'testExpression', awaitPromise: true, returnByValue: true },
    ]])
    await assert.rejects(
      evaluate(async () => ({
        exceptionDetails: { text: 'fallback', exception: { description: 'renderer failed' } },
      }), 'throw'),
      /renderer failed/,
    )
    await assert.rejects(evaluate(async () => ({ exceptionDetails: { text: 'fallback' } }), 'throw'), /fallback/)
  })
}

test('native submit fails closed before input dispatch when missing or disabled', async () => {
  for (const submit of [null, { disabled: true }]) {
    const calls = []
    await assert.rejects(
      renderer().clickNativeSubmit(
        async (...args) => {
          calls.push(args)
          return { result: { value: { submit } } }
        },
        {},
        'proof',
      ),
      /Native submit control is (unavailable|disabled) before proof/,
    )
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], 'Runtime.evaluate')
  }
})

test('native submit keeps cursor holds and native mouse dispatch in order', async () => {
  const events = []
  let evaluated = false
  const send = async (method, params) => {
    if (method === 'Runtime.evaluate') {
      if (!evaluated) {
        evaluated = true
        return { result: { value: { submit: { x: 42, y: 84, disabled: false } } } }
      }
      events.push('pointer')
      return {}
    }
    events.push(params)
  }
  const recorder = { hold: async (frames, segment) => events.push({ frames, segment }) }
  await renderer().clickNativeSubmit(send, recorder, 'proof')
  assert.deepEqual(events, [
    'pointer',
    { frames: 2, segment: 'proof:approach' },
    'pointer',
    { frames: 2, segment: 'proof:pressed' },
    { type: 'mouseMoved', x: 42, y: 84, button: 'none' },
    { type: 'mousePressed', x: 42, y: 84, button: 'left', clickCount: 1 },
    { type: 'mouseReleased', x: 42, y: 84, button: 'left', clickCount: 1 },
    'pointer',
    { frames: 2, segment: 'proof:released' },
    'pointer',
  ])
})

test('typing refuses a missing or nonempty composer before changing input', async () => {
  for (const composer of [null, { text: 'existing draft' }]) {
    let calls = 0
    await assert.rejects(
      renderer().typeIntoComposer(
        async method => {
          assert.equal(method, 'Runtime.evaluate')
          calls += 1
          return { result: { value: { composer } } }
        },
        {},
        'request',
        'user-request',
        1,
      ),
      /Composer (is unavailable|was not empty)/,
    )
    assert.equal(calls, 1)
  }
})

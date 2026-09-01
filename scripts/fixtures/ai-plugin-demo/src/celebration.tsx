import type { Context } from '@deepseek-ai/cordis'
import {
  CORDISX_PLUGIN_MANIFEST_SCHEMA_V1,
  type CordisXPluginManifestV1,
} from 'cordisx/contracts'

type Messages = {
  'command.ready': undefined
}

export const manifest = {
  $schema: CORDISX_PLUGIN_MANIFEST_SCHEMA_V1,
  schemaVersion: 1,
  id: 'celebration',
  name: 'Celebration',
  capabilities: [],
} as const satisfies CordisXPluginManifestV1

export const inject = ['i18n', 'commands', 'slots']

/** Baseline generation. The real Codex turn adds the requested behavior. */
export function apply(ctx: Context): void {
  ctx.i18n.define<Messages>({
    namespace: 'celebration',
    locale: 'en',
    default: true,
    messages: { 'command.ready': 'Celebration plugin ready' },
  })
  ctx.i18n.define<Messages>({
    namespace: 'celebration',
    locale: 'zh-CN',
    messages: { 'command.ready': '礼花插件已就绪' },
  })
  ctx.commands.register({
    id: 'ready',
    title: { namespace: 'celebration', key: 'command.ready', fallback: 'Celebration plugin ready' },
  }, () => undefined)
  ctx.slots.register({
    name: 'composer.toolbar.items',
    id: 'ready',
    group: 'action',
    order: 10,
  }, {
    anchor: 'submit',
    placement: 'before',
    label: { namespace: 'celebration', key: 'command.ready', fallback: 'Celebration plugin ready' },
    ariaLabel: { namespace: 'celebration', key: 'command.ready', fallback: 'Celebration plugin ready' },
    icon: 'host:success',
    command: { id: 'ready' },
  })
}

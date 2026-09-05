/**
 * Declarative motion timeline for the real Codex showcase.
 *
 * Frames are intentionally used instead of milliseconds so the same scene is
 * deterministic on fast and slow development machines. The capture runner
 * owns cursor interpolation, real DOM clicks, and video encoding.
 */
export const showcaseMotionScene = [
  { type: 'hold', frames: 10 },
  { type: 'move', selector: '[data-cordisx-manager-trigger]', frames: 14 },
  { type: 'click', selector: '[data-cordisx-manager-trigger]', waitFor: '[data-tab="plugins"]' },
  { type: 'hold', frames: 12 },
  { type: 'move', selector: '[data-tab="extension-points"]', frames: 10 },
  { type: 'click', selector: '[data-tab="extension-points"]' },
  { type: 'hold', frames: 12 },
  { type: 'move', selector: '[data-tab="routes"]', frames: 9 },
  { type: 'click', selector: '[data-tab="routes"]' },
  { type: 'hold', frames: 11 },
  { type: 'move', selector: '[data-tab="marketplace"]', frames: 9 },
  { type: 'click', selector: '[data-tab="marketplace"]' },
  { type: 'hold', frames: 16 },
]

import { defineConfig, globalIgnores } from 'eslint/config'
import sourcePolicy from '@cordisx/eslint-config'

export default defineConfig([
  // Build outputs and verified generated/vendor artifacts; maintained tests stay included.
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/.cache/**',
    'assets/reicon/**',
    'assets/motion/cordisx-ai-plugin-demo-*.plugin.tsx',
  ]),
  {
    files: ['**/*.{js,mjs,cjs,jsx}'],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    extends: [sourcePolicy],
  },
])

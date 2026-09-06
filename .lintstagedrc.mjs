import shared from '@cordisx/eslint-config/lint-staged'

export default {
  ...shared,
  '*.{css,scss,sass,less}': ['dprint fmt', 'stylelint --max-warnings=0'],
}

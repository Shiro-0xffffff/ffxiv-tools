module.exports = {
  root: true,
  extends: ['standard-with-typescript'],
  parserOptions: {
    project: './tsconfig.json',
  },
  rules: {
    'padded-blocks': 'off',
    '@typescript-eslint/array-type': ['error', { default: 'array' }],
    '@typescript-eslint/comma-dangle': ['error', 'only-multiline'],
    '@typescript-eslint/method-signature-style': 'off',
    '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
    '@typescript-eslint/no-non-null-assertion': 'off',
  },
}

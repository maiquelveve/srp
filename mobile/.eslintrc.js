module.exports = {
  root: true,
  env: { es2021: true, node: true },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  parser: '@typescript-eslint/parser',
  ignorePatterns: ['.eslintrc.js', 'node_modules', 'babel.config.js', 'metro.config.js'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/ban-ts-comment': 'error',
  },
};

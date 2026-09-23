const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  { ignores: ['node_modules/**', '.expo/**', 'coverage/**', 'functions/lib/**'] },
  ...expoConfig,
  {
    rules: { 'no-console': ['warn', { allow: ['warn', 'error'] }] }
  }
]);

// TypeScript is checked separately by tsc. Vendor OCR bundles are upstream artifacts.
export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "tesseract/**",
      "vendor/**",
      "test-results/**",
      "**/*.ts",
      "**/*.tsx",
    ],
  },
  {
    files: ["*.js", "scripts/*.mjs", "tests/e2e/*.mjs"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module" },
    rules: {
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-debugger": "error",
      "no-dupe-args": "error",
      "no-dupe-keys": "error",
      "no-unreachable": "error",
      "valid-typeof": "error",
    },
  },
];

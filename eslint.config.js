import js from "@eslint/js";
import globals from "globals";
export default [
  { ignores: ["node_modules/**", "frontend/dist/**", "test-results/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^[A-Z]",
          caughtErrors: "none",
        },
      ],
    },
  },
];

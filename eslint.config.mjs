import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist", "node_modules"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactPlugin.configs.flat.recommended,
  ...reactHooksPlugin.configs["flat/recommended"],
  eslintConfigPrettier,
  {
    plugins: {
      "jsx-a11y": jsxA11yPlugin
    },
    rules: {
      ...jsxA11yPlugin.configs.recommended.rules
    }
  },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tseslint.parser,
      sourceType: "module",
      ecmaVersion: 2020,
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        figma: "readonly",
        __UI_HTML__: "readonly",
        __ANALYSIS_BASE_URL__: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "jsx-a11y": jsxA11yPlugin
    },
    settings: {
      react: {
        version: "detect"
      }
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off"
    }
  },
  {
    files: ["scripts/**/*.{ts,js,mjs}"],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },
  {
    files: ["ui/src/**/*.{test,spec}.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node
      }
    }
  }
);

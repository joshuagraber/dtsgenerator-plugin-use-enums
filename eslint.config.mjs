import { defineConfig } from "eslint/config";
import { fixupConfigRules } from "@eslint/compat";
import sortImportsEs6Autofix from "eslint-plugin-sort-imports-es6-autofix";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([{
    extends: fixupConfigRules(compat.extends(
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:import/errors",
        "plugin:import/warnings",
        "plugin:import/typescript",
        "prettier",
    )),

    plugins: {
        "sort-imports-es6-autofix": sortImportsEs6Autofix,
    },

    languageOptions: {
        globals: {
            ...globals.node,
            ...globals.mocha,
        },

        parser: tsParser,
        ecmaVersion: 5,
        sourceType: "commonjs",

        parserOptions: {
            project: "./tsconfig.json",
        },
    },

    settings: {
        "import/resolver": {
            typescript: {
                alwaysTryTypes: true,
            },
        },
    },

    ignores: ["./test/**"],

    rules: {
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": ["warn", {
            argsIgnorePattern: "^_",
        }],

        "@typescript-eslint/no-use-before-define": "off",
        "@typescript-eslint/prefer-optional-chain": 2,
        "@typescript-eslint/prefer-nullish-coalescing": 1,
        "import/no-named-as-default": 0,
        "import/no-named-as-default-member": 0,
    },
}]);
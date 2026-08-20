const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
    {
        ignores: [
            "node_modules/**"
        ]
    },

    {
        files: ["**/*.js"],

        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "commonjs",
            globals: globals.node
        },

        rules: {
            ...js.configs.recommended.rules
        }
    },

    {
        files: ["tests/**/*.js"],

        languageOptions: {
            globals: {
                ...globals.node,
                beforeAll: "readonly",
                afterAll: "readonly",
                describe: "readonly",
                test: "readonly",
                expect: "readonly"
            }
        }
    }
];
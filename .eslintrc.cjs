module.exports = {
    root: true,
    env: {browser: true, es2020: true},
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react-hooks/recommended',
    ],
    ignorePatterns: ['dist', '.eslintrc.cjs'],
    parser: '@typescript-eslint/parser',
    plugins: ['react-refresh'],
    rules: {
        'react-refresh/only-export-components': [
            'warn',
            {allowConstantExport: true},
        ],
        '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_'}],
        'no-console': ['warn', {allow: ['warn', 'error']}],
        'no-debugger': 'error',
        'prefer-const': 'error',
        '@typescript-eslint/no-explicit-any': 'warn',
    },
    overrides: [
        {
            // FE-H2: forbid raw `err.message` access in src/ app code so error
            // surfaces are forced through formatApiError(err, t). The helper
            // file itself and tests are exempt. Starts as `warn` to surface
            // the existing call sites without blocking CI; flip to `error`
            // once those 8 offenders are migrated.
            //
            // P0-Q1 (QUALITY_REVIEW_2026-05-01): forbid direct
            // `import.meta.env.VITE_API_BASE_URL` reads outside the
            // centralized config module. All callers must import from
            // `@config/env` so we have one place to fail fast at boot
            // when the env var is unset.
            files: ['src/**/*.ts', 'src/**/*.tsx'],
            excludedFiles: [
                'src/utils/formatApiError.ts',
                'src/config/env.ts',
                'src/vite-env.d.ts',
                'src/**/*.test.ts',
                'src/**/*.test.tsx',
                'src/**/__tests__/**',
                'src/test/**',
            ],
            rules: {
                'no-restricted-syntax': [
                    'warn',
                    {
                        selector: "MemberExpression[object.name='err'][property.name='message']",
                        message:
                            'Use formatApiError(err, t) instead of raw err.message — see CLAUDE.md.',
                    },
                    {
                        selector:
                            "MemberExpression[property.name='VITE_API_BASE_URL']",
                        message:
                            'Do not read import.meta.env.VITE_API_BASE_URL directly. Import { config } from "@config/env" — see QUALITY_REVIEW_2026-05-01.md §P0-Q1.',
                    },
                ],
            },
        },
    ],
}

/**
 * ESLint configuration.
 *
 * A .js config rather than JSON so each deliberate exception can say why it is
 * one — a rule turned off without a reason is indistinguishable from a rule
 * nobody understood.
 */
module.exports = {
  root: true,
  extends: ['next/core-web-vitals'],
  ignorePatterns: ['.next/', 'node_modules/', 'public/', 'prisma/generated/'],
  rules: {
    'react-hooks/exhaustive-deps': 'warn',

    // Merchant logos and product images are arbitrary URLs from uploads, which
    // next/image cannot optimise without a configured loader. Kept as a
    // warning so new occurrences are still visible; the intentional ones carry
    // an inline disable with a reason.
    '@next/next/no-img-element': 'warn',

    // This rule targets the pages router's _document. In the App Router a font
    // <link> in the root layout is the documented approach, so the warning is
    // a false positive here.
    '@next/next/no-page-custom-font': 'off',
  },
  overrides: [
    {
      files: ['tests/**/*.{ts,tsx}'],
      rules: { '@next/next/no-img-element': 'off' },
    },
  ],
};

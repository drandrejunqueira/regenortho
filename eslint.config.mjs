import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import { fixupConfigRules } from "@eslint/compat";

// eslint-config-next 14 só publica config no formato antigo (eslintrc) e seus
// plugins usam APIs que o ESLint 9 removeu (context.getAncestors/getScope).
// FlatCompat traduz o formato e fixupConfigRules repõe as APIs — importar
// "eslint-config-next/core-web-vitals" direto quebrava o `npm run lint` inteiro.
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const eslintConfig = [
  ...fixupConfigRules(compat.extends("next/core-web-vitals", "next/typescript")),
  {
    rules: {
      // `const { campo: _, ...resto } = obj` é o jeito idiomático de omitir uma
      // chave; o irmão descartado não é variável esquecida.
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
    },
  },
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "graphify-out/**",
      "playwright-report/**",
      "test-results/**",
      "tests/visual/gallery/**",
      "stitch_regem_orto_home_page/**",
      "dino-skill/**",
      ".agent/**",
      ".agents/**",
      ".claude/**",
    ],
  },
];

export default eslintConfig;

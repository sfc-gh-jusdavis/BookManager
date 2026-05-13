import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // @typescript-eslint/no-explicit-any: tightened to "error" after useApi.ts
  // rollback contexts were typed (PR closing SnowBoard #98 partial).
  //
  // The three React Compiler rules below remain at "warn" until dedicated
  // refactors land for the affected files. Each is tracked as a separate
  // follow-up ticket so the refactor is reviewed in isolation, not as a
  // drive-by edit:
  //   - react-hooks/purity         -> accounts/[id]/page.tsx (impure call in render)
  //   - react-hooks/preserve-manual-memoization -> forecasts/page.tsx (useMemo deps)
  //   - react-hooks/set-state-in-effect -> settings/page.tsx (sync setState in effect)
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;

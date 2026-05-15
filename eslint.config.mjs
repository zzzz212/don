import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Build artifacts — `**/` prefix so nested copies are ignored too
    // (e.g. .next inside a .claude/worktrees/* checkout). Without it
    // `npm run lint` linted tens of thousands of generated chunks.
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    // Claude Code local state + git worktrees — not project source.
    ".claude/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // `react-hooks/set-state-in-effect` flags two patterns this codebase
      // legitimately relies on: SSR mount-guards (`setMounted(true)`) and
      // data-fetching effects that flip a loading flag before an async
      // fetch. Genuine anti-patterns — resetting derived state in an effect
      // — are fixed at the call site instead. Kept as `warn` so a real new
      // violation stays visible without failing the lint run.
      "react-hooks/set-state-in-effect": "warn",
      // Allow intentionally-unused identifiers prefixed with `_` — provider
      // no-op implementations must satisfy a shared interface signature.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;

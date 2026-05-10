import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/__tests__/**/*.test.ts", "src/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "src/app/**"],
    server: {
      deps: {
        inline: [/@prisma/],
      },
    },
  },
});

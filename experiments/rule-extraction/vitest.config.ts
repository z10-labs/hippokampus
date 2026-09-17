import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Thin I/O adapters (gh, filesystem, Claude client wiring, interactive prompts)
      // are exercised by running the pipeline, not by unit tests.
      exclude: [
        "src/**/*.test.ts",
        "src/testing/**",
        "src/cli.ts",
        "src/github/gh.ts",
        "src/github/fetchChangeSets.ts",
        "src/extraction/runExtraction.ts",
        "src/labeling/runLabeling.ts",
        "src/scoring/runScoring.ts",
        "src/store/store.ts",
        "src/claude/credentials.ts",
        "src/contexts/collectSignals.ts",
        "src/contexts/runContexts.ts",
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});

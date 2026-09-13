import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: {
    jsx: {
      runtime: "classic",
      pragma: "React.createElement",
      pragmaFrag: "React.Fragment",
      // sem isto o transform injeta __self/__source em cada elemento
      development: false,
    },
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});

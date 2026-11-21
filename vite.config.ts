import { defineConfig } from "vitest/config";

export default defineConfig({
    base: "/shiftroom/",
    build: {
        chunkSizeWarningLimit: 800,
    },
    test: {
        include: ["tests/**/*.test.ts"],
    },
});

import { defineConfig } from "vite-plus";

export default defineConfig({
  root: "aaronnote",
  base: "/",
  server: {
    host: "127.0.0.1",
  },
  build: {
    outDir: "../dist/aaronnote",
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("/node_modules/")) return undefined;
          if (id.includes("/node_modules/prosemirror-")) return "vendor-prosemirror";
          if (id.includes("/node_modules/mermaid") || id.includes("/node_modules/d3-") || id.includes("/node_modules/cytoscape")) return "vendor-diagrams";
          if (id.includes("/node_modules/dompurify") || id.includes("/node_modules/turndown")) return "vendor-sanitize";
          if (
            id.includes("/node_modules/markdown-it") ||
            id.includes("/node_modules/markdown-it-emoji") ||
            id.includes("/node_modules/linkify-it") ||
            id.includes("/node_modules/mdurl") ||
            id.includes("/node_modules/entities") ||
            id.includes("/node_modules/uc.micro")
          ) {
            return "vendor-markdown";
          }
          return undefined;
        },
      },
    },
  },
  lint: { options: { typeAware: true, typeCheck: true } },
});

import { defineConfig } from 'vite';

// This app ships as a static bundle that must also work opened directly via
// file:// (no server) — that's how the Playwright suite in tests/ loads
// dist/index.html, and how an end user could use this single-page tool.
// Two things about Vite's default output break that:
//
// 1. Vite always injects crossorigin="" onto build-time <script type="module">
//    and <link> tags, with no config flag to turn it off. Under file:// the
//    page has an opaque ("null") origin, and Chromium refuses to load any
//    crossorigin-marked resource there (no CORS is possible for file:).
// 2. Per the HTML spec, <script type="module"> always fetches with CORS mode
//    regardless of the crossorigin attribute — so even after (1) is fixed,
//    a module script still gets blocked under file://.
//
// Building as a self-contained IIFE (build.rollupOptions.output.format)
// avoids ES-module semantics entirely, and stripping the leftover
// type="module"/crossorigin markup below turns the emitted tags into plain
// classic-script/no-cors requests, which file:// allows. type="module" is
// swapped for defer (rather than dropped outright) so the script — which
// lives in <head> and touches DOM nodes — still runs after HTML parsing,
// matching module scripts' built-in deferred execution.
function stripModuleMarkupForFileProtocol() {
  return {
    name: 'strip-module-markup-for-file-protocol',
    apply: 'build', // dev server still needs real ES modules — leave `vite` serve untouched
    transformIndexHtml(html) {
      return html
        .replace(/\s+crossorigin(="[^"]*")?/g, '')
        .replace(/\s+type="module"/g, ' defer');
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [stripModuleMarkupForFileProtocol()],
  build: {
    rollupOptions: {
      output: {
        format: 'iife',
      },
    },
  },
});

// =============================================================================
// vite.config.js — UI Library plugin build configuration.
//
// Run from inside site/plugins/kui/:
//   npm run dev   → Vite dev server on port 5174 with HMR enabled.
//   npm run build → Hashed production bundle output to ./assets/
//                   (inside the plugin folder — self-contained for distribution).
//
// Kirby 5 serves plugin assets from site/plugins/<name>/assets/ automatically
// via the media pipeline. The PHP helper resolves hashed filenames at runtime.
//
// The @ui alias mirrors the Twig @ui namespace declared in config.php so that
// SCSS and JS imports use the same logical path as Twig includes/embeds.
// =============================================================================

import { defineConfig } from "vite";
import { resolve } from "path";

const pluginRoot = new URL(".", import.meta.url).pathname;

export default defineConfig(({ command }) => ({
	publicDir: false,

	resolve: {
		alias: {
			// @ui → snippets/blocks/ — matches the Twig namespace declared in config.php
			"@ui": resolve(pluginRoot, "snippets/blocks"),
		},
	},

	build: {
		// Output inside the plugin folder — committed to git so consumers
		// don't need to run npm after installing via Composer or submodule.
		// Kirby 5 serves plugin assets via its media pipeline automatically.
		outDir: resolve(pluginRoot, "assets"),
		emptyOutDir: true,

		// Write manifest.json so PHP can resolve hashed filenames at runtime.
		manifest: true,

		rollupOptions: {
			input: {
				kui: resolve(pluginRoot, "src/js/main.js"),
			},
		},

		// Keep CSS in a separate file so PHP can enqueue it independently.
		cssCodeSplit: false,
	},

	server: {
		// Separate port from the project's own Vite instance (default 5173).
		port: 5174,
		strictPort: true,

		hmr: {
			// Kirby serves pages from a different origin; tell the HMR client
			// where the Vite dev server is so hot updates are sent correctly.
			host: "localhost",
			port: 5174,
		},

		origin: "http://localhost:5174",
	},
}));

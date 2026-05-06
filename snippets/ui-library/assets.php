<?php
/**
 * snippets/ui-library/assets.php
 *
 * Enqueue the UI library CSS and JS bundle.
 * Call this snippet once inside your layout's <head> (before </head>):
 *
 *   {{ snippet('ui-library/assets') | raw }}   (Twig)
 *   <?php snippet('ui-library/assets') ?>      (PHP)
 *
 * In dev mode (Kirby's debug option is true) it loads from the Vite dev server
 * running on port 5174 so HMR works without a page reload.
 * In production it reads hashed filenames from the Vite manifest.
 */

$port      = option('ui-library.components.vite.port', 5174);
$devOrigin = 'http://localhost:' . $port;

if (option('debug')) {
    // ── Development — Vite HMR client + unbundled source ──────────────────
    echo '<script type="module" src="' . $devOrigin . '/@vite/client"></script>' . PHP_EOL;
    echo '<script type="module" src="' . $devOrigin . '/src/js/main.js"></script>' . PHP_EOL;
} else {
    // ── Production — hashed filenames from the Vite manifest ──────────────
    // With cssCodeSplit: false, Vite emits CSS as a separate manifest entry
    // ('style.css') rather than in the js entry's 'css' array.
    $jsEntry  = uiLibraryViteAsset('src/js/main.js');
    $cssEntry = uiLibraryViteAsset('style.css');

    // CSS — prefer the js-entry css array, fall back to the standalone entry.
    $cssFiles = $jsEntry['css'] ?? (!empty($cssEntry['file']) ? [$cssEntry['file']] : []);
    foreach ($cssFiles as $cssFile) {
        echo '<link rel="stylesheet" href="' . uiLibraryAssetUrl($cssFile) . '">' . PHP_EOL;
    }

    if (!empty($jsEntry['file'])) {
        echo '<script type="module" src="' . uiLibraryAssetUrl($jsEntry['file']) . '"></script>' . PHP_EOL;
    }
}

<?php

/**
 * UI Library — Kirby plugin registration.
 *
 * Registers:
 *  - Shared field blueprints (html_id, css_classes) available project-wide.
 *  - Block blueprints (accordion, …) — each becomes available in any blocks field.
 *  - Twig snippet entry points for every block and its internal partials.
 *  - A PHP helper that resolves hashed asset filenames from the Vite manifest.
 *  - An 'ui-library/assets' snippet for enqueueing CSS + JS from layouts.
 *
 * @see  blueprints/blocks/accordion.yml   Block definition (Panel UI).
 * @see  snippets/blocks/accordion.twig    Block dispatcher (chooses variant).
 * @see  snippets/blocks/_accordion_base.twig  Shared Twig layout (not a block).
 */

use Kirby\Cms\App as Kirby;

// ---------------------------------------------------------------------------
// Asset helper — resolves hashed filenames from the plugin's Vite manifest.
// ---------------------------------------------------------------------------

/**
 * Return the manifest entry for a given source path, or an empty array.
 *
 * @param  string $entry  e.g. 'src/js/main.js'
 * @return array{file?: string, css?: string[]}
 */
function uiLibraryViteAsset(string $entry): array
{
    static $manifest = null;

    if ($manifest === null) {
        $manifestPath = __DIR__ . '/assets/.vite/manifest.json';
        $manifest     = is_file($manifestPath)
            ? json_decode(file_get_contents($manifestPath), true)
            : [];
    }

    return $manifest[$entry] ?? [];
}

/**
 * Return the public URL for a file inside the plugin's assets/ folder.
 * Kirby 5 serves plugin assets via its media pipeline.
 *
 * @param  string $file  Relative path within assets/, e.g. 'assets/main.js'
 * @return string
 */
function uiLibraryAssetUrl(string $file): string
{
    return kirby()->plugin('ui-library/components')->mediaUrl() . '/' . ltrim($file, '/');
}

// ---------------------------------------------------------------------------
// Plugin registration
// ---------------------------------------------------------------------------

Kirby::plugin('ui-library/components', [

    // ── Blueprints ──────────────────────────────────────────────────────────

    'blueprints' => [
        // Shared field mixins — extend these in any blueprint with:
        //   myfield:
        //     extends: fields/html_id
        'fields/html_id'       => __DIR__ . '/blueprints/fields/html_id.yml',
        'fields/css_classes'   => __DIR__ . '/blueprints/fields/css_classes.yml',

        // Block blueprints — each is selectable in any `type: blocks` field.
        'blocks/accordion'     => __DIR__ . '/blueprints/blocks/accordion.yml',
        'blocks/button'        => __DIR__ . '/blueprints/blocks/button.yml',
    ],

    // ── Snippets ─────────────────────────────────────────────────────────────
    //
    // Registering a .twig snippet causes the kirby-twig plugin to add the
    // parent directory of the first registered snippet to Twig's FilesystemLoader.
    // Because all snippets live under site/plugins/ui-library/snippets/, the
    // entire subtree (including _accordion_base.twig) is available to Twig's
    // include / embed tags once the @ui namespace is wired in config.php.

    'snippets' => [
        // Block entry point — Kirby calls this automatically when rendering blocks.
        'blocks/accordion'        => __DIR__ . '/snippets/blocks/accordion.twig',
        'blocks/button'           => __DIR__ . '/snippets/blocks/button.twig',

        // Variants — loaded by accordion.twig via {% include '@ui/…' %}.
        'blocks/accordion_simple' => __DIR__ . '/snippets/blocks/accordion_simple.twig',
        'blocks/accordion_rich'   => __DIR__ . '/snippets/blocks/accordion_rich.twig',

        // Base layout — loaded by variants via {% embed '@ui/…' %}.
        // The underscore prefix signals it is internal (not a public block).
        'blocks/_accordion_base'  => __DIR__ . '/snippets/blocks/_accordion_base.twig',

        // Button primitive — snippet partial (not a block).
        // Include via {% include '@ui/_button.twig' with { variant: '…', label: '…' } %}.
        'blocks/_button'          => __DIR__ . '/snippets/blocks/_button.twig',

        // Asset loader — call snippet('ui-library/assets') in your layout <head>.
        'ui-library/assets'       => __DIR__ . '/snippets/ui-library/assets.php',
    ],

    // ── Panel sidebar areas ──────────────────────────────────────────────────
    //
    // Adds "Components" and "Snippets" as top-level entries in the panel sidebar,
    // pointing directly at their respective content pages.

    'areas' => [
        'ui-components' => function () {
            return [
                'label' => 'Components',
                'icon'  => 'box',
                'menu'  => true,
                'link'  => 'pages/components',
            ];
        },
        'ui-snippets' => function () {
            return [
                'label' => 'Snippets',
                'icon'  => 'code',
                'menu'  => true,
                'link'  => 'pages/snippets',
            ];
        },
    ],

    // ── Plugin-level options ─────────────────────────────────────────────────
    'options' => [
        // Vite dev server port — keep in sync with vite.config.js.
        'vite.port' => 5174,
    ],
]);

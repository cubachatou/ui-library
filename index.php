<?php

/**
 * UI Library — Kirby plugin registration.
 *
 * Registers:
 *  - Shared field blueprints (html_id, css_classes) available project-wide.
 *  - Block blueprints (accordion, …) — each becomes available in any blocks field.
 *  - Twig snippet entry points for every block and its internal partials.
 *  - A PHP helper that resolves hashed asset filenames from the Vite manifest.
 *  - An 'kui/assets' snippet for enqueueing CSS + JS from layouts.
 *
 * @see  blueprints/blocks/kui-accordion.yml   Block definition (Panel UI).
 * @see  snippets/blocks/kui-accordion.twig    Block dispatcher (chooses variant).
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
function kuiViteAsset(string $entry): array
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
function kuiAssetUrl(string $file): string
{
    return kirby()->plugin('kui/components')->mediaUrl() . '/' . ltrim($file, '/');
}

// ---------------------------------------------------------------------------
// Plugin registration
// ---------------------------------------------------------------------------

Kirby::plugin('kui/components', [

    // ── Blueprints ──────────────────────────────────────────────────────────

    'blueprints' => [
        // Shared field mixins — extend these in any blueprint with:
        //   myfield:
        //     extends: fields/kui-html_id
        'fields/kui-html_id'       => __DIR__ . '/blueprints/fields/kui-html_id.yml',
        'fields/kui-css_classes'   => __DIR__ . '/blueprints/fields/kui-css_classes.yml',

        // Block blueprints — each is selectable in any `type: blocks` field.
        'blocks/kui-accordion'     => __DIR__ . '/blueprints/blocks/kui-accordion.yml',
        'blocks/kui-badge'         => __DIR__ . '/blueprints/blocks/kui-badge.yml',
        'blocks/kui-button'        => __DIR__ . '/blueprints/blocks/kui-button.yml',
        'blocks/kui-carousel'      => __DIR__ . '/blueprints/blocks/kui-carousel.yml',
        'blocks/kui-select'        => __DIR__ . '/blueprints/blocks/kui-select.yml',
    ],

    // ── Snippets ─────────────────────────────────────────────────────────────
    //
    // Registering a .twig snippet causes the kirby-twig plugin to add the
    // parent directory of the first registered snippet to Twig's FilesystemLoader.
    // Because all snippets live under site/plugins/kui/snippets/, the
    // entire subtree (including _accordion_base.twig) is available to Twig's
    // include / embed tags once the @ui namespace is wired in config.php.

    'snippets' => [
        // Block entry point — Kirby calls this automatically when rendering blocks.
        'blocks/kui-accordion'        => __DIR__ . '/snippets/blocks/kui-accordion.twig',
        'blocks/kui-button'           => __DIR__ . '/snippets/blocks/kui-button.twig',

        // Variants — loaded by kui-accordion.twig via {% include '@ui/…' %}.
        'blocks/kui-accordion_simple' => __DIR__ . '/snippets/blocks/kui-accordion_simple.twig',
        'blocks/kui-accordion_rich'   => __DIR__ . '/snippets/blocks/kui-accordion_rich.twig',

        // Base layout — loaded by variants via {% embed '@ui/…' %}.
        // The underscore prefix signals it is internal (not a public block).
        'blocks/_kui-accordion_base'  => __DIR__ . '/snippets/blocks/_kui-accordion_base.twig',

        // Badge primitive — snippet partial (not a block).
        // Include via {% include '@ui/_kui-badge.twig' with { variant: '…', label: '…' } %}.
        'blocks/_kui-badge'           => __DIR__ . '/snippets/blocks/_kui-badge.twig',

        // Badge block — renders a badge inside any Kirby blocks field.
        'blocks/kui-badge'            => __DIR__ . '/snippets/blocks/kui-badge.twig',

        // Button primitive — snippet partial (not a block).
        // Include via {% include '@ui/_kui-button.twig' with { variant: '…', label: '…' } %}.
        'blocks/_kui-button'          => __DIR__ . '/snippets/blocks/_kui-button.twig',

        // Carousel widget — block dispatcher, default variant, and internal base.
        'blocks/kui-carousel'         => __DIR__ . '/snippets/blocks/kui-carousel.twig',
        'blocks/kui-carousel_default' => __DIR__ . '/snippets/blocks/kui-carousel_default.twig',
        'blocks/_kui-carousel_base'   => __DIR__ . '/snippets/blocks/_kui-carousel_base.twig',

        // Select widget — block dispatcher, variants, and internal base.
        'blocks/kui-select'           => __DIR__ . '/snippets/blocks/kui-select.twig',
        'blocks/kui-select_simple'    => __DIR__ . '/snippets/blocks/kui-select_simple.twig',
        'blocks/kui-select_grouped'   => __DIR__ . '/snippets/blocks/kui-select_grouped.twig',
        'blocks/_kui-select_base'     => __DIR__ . '/snippets/blocks/_kui-select_base.twig',

        // Asset loader — call snippet('kui/assets') in your layout <head>.
        'kui/assets'              => __DIR__ . '/snippets/ui-library/assets.php',
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

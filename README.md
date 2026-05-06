# kirby-ui-library

A flexible UI component library plugin for [Kirby CMS 5](https://getkirby.com) with Twig template inheritance, data-attribute JS hooks, and a self-contained Vite asset pipeline.

## Features

- **Accordion block** with two built-in visual variants: simple (text-only) and rich (with header image)
- **Twig `{% embed %}` pattern** — variants override only their own blocks; the shared base template handles all structure, accessibility attributes, and JS hooks
- **CSS-agnostic JavaScript** — JS is bound exclusively to `data-*` attributes, never to class names; any visual variant works without JS changes
- **Strategy pattern hooks** — inject custom `onOpen`/`onClose` callbacks without modifying core JS
- **Shared field blueprints** (`html_id`, `css_classes`) reusable across any blueprint via Kirby's `extends:`
- **Self-contained assets** — Vite output is committed inside the plugin folder and served via Kirby 5's media pipeline; consumers don't need to run npm
- **`@ui` Twig namespace** — import any block partial directly from templates using `@ui/filename.twig`

## Requirements

| Dependency | Version |
|---|---|
| PHP | 8.2 – 8.5 |
| Kirby CMS | ^5.2 |
| [wearejust/kirby-twig](https://github.com/wearejust/kirby-twig) | ^5.0 |
| Node.js *(dev only)* | 18+ |

## Installation

### Via Composer (recommended)

```bash
composer require oleksii/kirby-ui-library
```

Composer places the plugin at `site/plugins/ui-library/` automatically via Kirby's composer-installer.

### Via Git Submodule

```bash
git submodule add https://github.com/your-username/kirby-ui-library site/plugins/ui-library
git submodule update --init
```

### Manually

Copy the entire plugin folder into `site/plugins/ui-library/`.

## Configuration

### 1. Register the `@ui` Twig namespace

Add this to `site/config/config.php` so templates can reference plugin snippets as `@ui/component.twig`:

```php
return [
    'wearejust.twig.namespaces' => [
        'ui' => __DIR__ . '/../plugins/ui-library/snippets/blocks',
    ],
];
```

### 2. Enqueue plugin assets

Call the assets snippet from your layout's `<head>`. In a Twig template:

```twig
{{ snippet('ui-library/assets')|raw }}
```

In a PHP template:

```php
<?php snippet('ui-library/assets') ?>
```

## Usage

### Add the accordion block to a page blueprint

```yaml
# site/blueprints/pages/my-page.yml
fields:
  blocks:
    type: blocks
    fieldsets:
      - accordion
```

### Render blocks in a template

```twig
{% if page.blocks.isNotEmpty %}
    {{ page.blocks.toBlocks|raw }}
{% endif %}
```

### Accordion variants

Set the **Style** field in the Kirby Panel to switch variants:

| Value | Template | Description |
|---|---|---|
| `simple` *(default)* | `accordion_simple.twig` | Title + rich-text content |
| `with-images` | `accordion_rich.twig` | Header image + icon + title + content |

### Custom JavaScript behaviour (Strategy hooks)

```js
import { initAccordions } from '/path/to/accordion.js';

initAccordions({
    allowMultipleOpen: true,
    onOpen: (trigger, panel) => {
        // e.g. fire analytics event, run custom animation
        console.log('Opened:', trigger.textContent.trim());
    },
    onClose: (trigger, panel) => {
        console.log('Closed:', trigger.textContent.trim());
    },
});
```

### Extending an existing block with a custom variant

1. Add a new option to `blueprints/blocks/accordion.yml` (`style` select field).
2. Create a new Twig embed file, e.g. `snippets/blocks/accordion_minimal.twig`.
3. Add a branch in `snippets/blocks/accordion.twig`.

No changes to `_accordion_base.twig`, `accordion.js`, or `_accordion.scss` are needed.

## Shared Field Blueprints

Any blueprint in the project can reuse the shared fields:

```yaml
fields:
  html_id:
    extends: fields/html_id
    width: 1/2
  css_classes:
    extends: fields/css_classes
    width: 1/2
```

## Development

### Prerequisites

```bash
# Inside the plugin directory
cd site/plugins/ui-library
npm install
```

### Start the Vite dev server

```bash
npm run dev      # → http://localhost:5174 with HMR
```

The plugin Vite server runs on port **5174** (separate from the doc site Vite server on 5173). Kirby must be running on port **8000** for HMR cross-origin updates to work.

### Build for production

```bash
npm run build
```

Output goes to `assets/` inside the plugin folder. The hashed manifest at `assets/.vite/manifest.json` is read by PHP at runtime to resolve filenames.

### Project structure

```
site/plugins/ui-library/
├── assets/                  # Built files (committed — no npm needed by consumers)
│   ├── .vite/manifest.json
│   └── assets/
├── blueprints/
│   ├── blocks/accordion.yml
│   └── fields/
│       ├── html_id.yml
│       └── css_classes.yml
├── snippets/
│   ├── blocks/
│   │   ├── _accordion_base.twig   # Shared layout (embed target)
│   │   ├── accordion.twig         # Dispatcher (reads style field)
│   │   ├── accordion_simple.twig  # Text-only variant
│   │   └── accordion_rich.twig    # Image + icon variant
│   └── ui-library/
│       └── assets.php             # Asset enqueueing snippet
├── src/
│   ├── js/
│   │   ├── accordion.js           # Accordion class + initAccordions()
│   │   └── main.js                # Entry point
│   └── scss/
│       ├── _tokens.scss           # Design tokens (colors, spacing, …)
│       ├── _accordion.scss        # BEM accordion styles
│       └── main.scss              # Aggregator
├── index.php                      # Plugin registration
├── vite.config.js
├── package.json
└── composer.json
```

## How the asset pipeline works

```
Vite dev (port 5174)          PHP server (port 8000)
┌─────────────────────┐       ┌──────────────────────────────┐
│  src/js/main.js     │  HMR  │  assets.php snippet          │
│  src/scss/main.scss │ ────► │  → <script type=module       │
└─────────────────────┘       │     src=localhost:5174/…>    │
                               └──────────────────────────────┘

Vite build (production)
┌─────────────────────┐       ┌──────────────────────────────┐
│  src/js/main.js     │ ────► │  assets/assets/ui-library-   │
│  src/scss/main.scss │       │    xxxxxxxx.js               │
└─────────────────────┘       │  assets/assets/style-xxxx.css│
                               │  assets/.vite/manifest.json  │
                               └──────────────────────────────┘
Kirby 5 media pipeline serves plugin assets via:
  /media/plugins/ui-library/components/<hash>/assets/…
```

## License

MIT

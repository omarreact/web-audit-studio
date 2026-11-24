# Web Audit Studio — Full Stack Migrator

A desktop-first, mobile-responsive, client-only website inspector, file editor, static preview, and source-capture exporter. The project was developed against the linked public **Web Audit Studio** interface and the requested feature specification, without changing that hosted site.

## Architecture

```text
Browser UI (index.html + assets/app.css)
  ├── URL scanner → fetch() / CORS → robots.txt → recursive XML sitemaps
  │     ├── breadth-first HTML traversal (depth 0–4, 1–100 pages)
  │     ├── asset discovery (img, srcset, styles, scripts, fonts/media)
  │     └── CSS @import/url() and literal ESM JS import traversal
  ├── Technology fingerprinting → weighted HTML/header indicators
  ├── Workspace → Map(path, Uint8Array) → Explorer + Monaco editor/textarea
  ├── Audit findings → title/description/alt/headings/mixed-content/large assets
  ├── Preview → DOMParser → rewritten data URLs → sandboxed iframe srcdoc
  ├── Exporter → JSZip → static site, FSE block theme, Next, React/Vite,
  │                   Angular, Astro, Nuxt, raw evidence, JSON/CSV
  └── Local ZIP import → no network required
```

## Run

No npm install or backend is required for the inspector. Open `index.html` or serve it with a static HTTP server:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

For a portable version with embedded styling, application code, and JSZip, open `single-file.html`. Rebuild it after editing the application with `node tools/build-single-file.cjs`. Monaco and Tailwind are loaded by CDN when online; a textarea and bundled CSS provide an offline fallback.

Use **Load demo** first to test the editor, preview, downloads, and reports without requesting a live website. **Import ZIP** can ingest an exported or manually obtained static website, which is useful when browser fetches are blocked by CORS.

## Features

- URL input, stack badge with heuristic confidence/evidence (WordPress, Next.js, React, Angular, Vue/Nuxt, Astro, Svelte/SvelteKit, static)
- WordPress active theme slug inferred when present in exposed paths
- Optional robots checking, nested sitemap discovery, same-origin scope, configurable page limit, depth, delay, asset capture and import discovery
- Linked HTML pages, CSS, JavaScript, images, fonts, media, referenced CSS assets and literal ES module imports
- Per-asset success/failure/size, retry failed, stop scanning and partial-capture preservation
- Searchable nested file Explorer, Ctrl+P Quick Open, Ctrl+S Save, new files, Monaco when available
- In-place editing of text files, script-disabled sandbox preview, selectable captured pages
- Basic SEO, accessibility and asset findings, findings CSV and complete JSON report
- Eight ZIP export modes, recommended mode highlighted based on the detected stack
- Dark/light themes and responsive mobile fallback

## Export formats and fidelity

**HTML:** fetched file bytes with rewritten references to captured same-origin assets and pages. A redirect `index.html` is generated if the scanned entry page is not `/`.

**HTML safe-static (Hybrid AI panel):** separate experimental target adapter (`assets/html-converter.js`) produces multi-page HTML, captured CSS/media, a structured conversion report and warnings. Executable scripts, event handlers, embedded frames and form submissions are deliberately removed/disabled. Existing fidelity-oriented HTML ZIP is unchanged. Supports offline local deterministic conversion; optional Ollama or consented cloud AI only reviews a bounded metadata profile and **never** writes or executes conversion code. No original backend or pixel-parity guarantee.

**Raw Evidence:** actual captured file contents and crawl report JSON. Uncaptured files are never fabricated.

**WordPress FSE:** block theme metadata (`style.css`, `theme.json`), `templates/`, `parts/`, `functions.php`, public assets, plus captured HTML mapped into `wp:html` blocks. Theme assets are enqueued from `functions.php`. Other page template slugs need corresponding pages in WordPress. This is **not** recovered PHP/theme/plugin source.

**Next.js, React/Vite, Angular, Astro, Nuxt:** compilable-intent starter project trees with the original public capture under `public/site/`, viewed via a deliberately sandboxed iframe. This preserves the static frontend rather than generating false claims about reconstructed original source or components. Component migration, application APIs, routing, tests, and authentication are **manual follow-up tasks**. Generated frameworks have not been installed or compiled in this environment.

## Limits / safety

**Browser CORS is unavoidable in a client-only app.** Many ordinary public websites do not permit cross-origin `fetch()`; those sites **cannot be crawled from this app** unless their server opts in. `no-cors` mode would yield opaque responses and is not a workaround. This app has **no proxy**.

- Public sites do not expose server-side PHP, databases, original Vue/React components, server functions, authenticated endpoints, or private repository files.
- Web servers seldom permit directory enumeration. **Only referenced, publicly retrievable WordPress theme/plugin files can be identified and fetched.** Claims of downloading *all* theme/plugin files without admin/repository access would be misleading.
- JavaScript is **not executed during crawling**. SPAs may yield only their initial shell; dynamically discovered chunks/routes may be absent.
- `robots.txt` is checked when readable, but may be unavailable due to CORS. Use the tool only with permission and observe the host's policies.
- Browser memory and safety bounds: at most 100 pages; 4 MB per page, 250 assets, 12 MB per asset, 100 MB total asset data, max depth 4. ZIP imports also have safety caps.
- Static preview removes scripts, forms, frames and inline handlers, rewrites captured resources to data URLs, blocks external fetches, and uses an empty sandbox. It is *not* a JavaScript application runtime.
- The exported site can retain original scripts and media that reference live services or have licensing restrictions. Review before republishing.
- Tailwind Play CDN and remote Monaco are intended for convenient all-in-one delivery, not an optimized commercial frontend bundle. For a hardened deployment, compile Tailwind locally, self-host Monaco and adopt a reviewed Content Security Policy.
- Treat exported framework scaffolds as starting points, not validated production migrations.

## Validation

```bash
node --check assets/app.js
node --check assets/html-converter.js
node tests/core.test.cjs
python -m pytest -q tests/test_html_target_service.py tests/test_html_converter_browser.py
python tests/e2e.py    # optional: requires Playwright, Chromium and local loopback access
```

The automated core test exercises safe paths, linked URL rewriting, import discovery and ZIP file structure for six framework exports. Generated WordPress PHP passed `php -l`. Browser test automation was attempted but the available Chromium environment blocks *all* document navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`; accordingly visual and end-to-end validation must still be performed in an unrestricted browser. See `QA-RESULTS.md`.

## Experimental hybrid AI & editable WordPress conversion (feature branch)

See [`AI-ROADMAP.md`](AI-ROADMAP.md) for architecture, fidelity and security limits. In the UI select **Load demo** or scan a permitted public website, then select **Analyze captured site**. The default is *local deterministic rules*, not LLM-powered AI. **Editable WordPress FSE ZIP (experimental)** adds native Gutenberg blocks for common semantic elements and includes `web-audit-analysis.json`, `web-audit-pages.json` and conversion warnings. Existing eight export modes are unmodified.

Optional actual local AI uses the Python service described in [`services/analyzer/README.md`](services/analyzer/README.md), and requires an installed local Ollama model. Cloud AI is never automatic, requires a server-held API key and explicit per-action consent. The WordPress page importer is an optional **separately installed** plugin under [`wordpress/web-audit-importer/`](wordpress/web-audit-importer/); it creates draft pages only and must be tested in staging.

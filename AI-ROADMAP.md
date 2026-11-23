# AI Website Intelligence & Universal Stack Converter — Phase 1

## Status

**Experimental feature branch, not ready for production.** The existing eight export options remain unchanged. A separate editable WordPress ZIP is exposed from an AI panel. Local rules are not labelled as AI inference; a real LLM runs only through an explicitly configured Python service.

## Architecture

1. `assets/ai-intelligence.js` builds a bounded **public-capture website profile**: page inventory, detected stack evidence, semantic headings, buttons, forms, media references, basic CSS palette/fonts and conversion risks. This is deterministic, offline analysis; no JavaScript is executed from captured pages.
2. `services/analyzer/app.py` is an optional FastAPI service: Ollama local model first; external OpenAI-compatible cloud review only when local inference failed, the server has a key, and the *current action* carries explicit user consent. If both are unavailable, labelled deterministic rules continue to work.
3. `types/conversion.d.ts` defines the platform-neutral intermediate-representation and target adapter contract. This is **planning guidance**, not evidence that other target adapters are complete.
4. WordPress adapter exports native Gutenberg heading/paragraph/image/list/button blocks for simple semantic structures. Complex layouts, custom CSS, scripts, forms and custom blocks need human review and often reconstruction. The existing HTML-in-`wp:html` export remains intact.
5. `wordpress/web-audit-importer` optionally creates **draft** WordPress pages from the generated `web-audit-pages.json`. The plugin is intentionally installed separately from a theme, uses nonce and capability checks, and never silently overwrites content.

## What this version cannot do

- No autonomous extraction of private WordPress PHP, backend APIs, database or unpublished code.
- No automatic recreation of animations, authenticating flows or third-party integrations.
- No guarantee of pixel parity; flat source CSS may be incompatible with generated block wrappers.
- No unattended deployment, theme activation, production import or paid model usage.
- Current browser-only public crawl remains CORS-gated; server-side Playwright crawl jobs have not been implemented.
- AI cannot be considered 'built in and active' until an Ollama service is running; without it the UI uses local heuristic analysis only.

## Next architecture gates

1. Move from heuristic HTML analysis to robust DOM + computed styles + authenticated source-context connectors.
2. Visual screenshot diff on real source/target sites with desktop/mobile thresholds.
3. Target adapter registry with strict output contracts: React, Next.js, Laravel, Django, Astro, Nuxt; **not** generic iframe wrappers.
4. Permission-aware capture worker, SSRF / DNS rebinding defenses, robots/ToS compliance, budgets, isolated test builds and audit logs.
5. WordPress integration tests against a disposable WP/PHP environment, safe media upload mapping, proper content and reusable templates, and validated block serialization.

## Testing

```bash
node --check assets/app.js
node --check assets/ai-intelligence.js
node tests/core.test.cjs
python -m pytest -q tests/test_ai_service.py tests/test_intelligence_browser.py
php -l wordpress/web-audit-importer/web-audit-importer.php
```

## Official references

- https://developer.wordpress.org/themes/core-concepts/theme-structure/
- https://developer.wordpress.org/block-editor/reference-guides/theme-json-reference/
- https://developer.wordpress.org/block-editor/getting-started/fundamentals/markup-representation-block/
- https://developer.wordpress.org/block-editor/reference-guides/core-blocks/

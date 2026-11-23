# Next.js-first hybrid AI conversion (experimental)

Feature branch: `feat/hybrid-ai-next-converter`, stacked on the unmerged HTML converter branch. No production changes.

## What exists

- Target `Next.js 16 · React App Router (static)` in the AI Intelligence target selector, with optional Ollama-first local analysis. The server only receives bounded summaries; optional cloud inference requires explicit consent and a server-managed key.
- `Native Next.js ZIP` export is **deterministic**. It does not use any LLM to write code and never executes captured JavaScript.
- Each captured HTML route becomes an individual `app/<slug>/page.tsx` file. Existing HTML content becomes data-backed React elements with typed JSON; it does not use `iframe` or `dangerouslySetInnerHTML`.
- Captured styles are compiled to a local `app/globals.css` with remote `@import` removed; recognized locally captured image/font/media files go under `public/captured/`.
- Page-specific title and meta description, structured route summary, rewrite of recognized local links, migration warnings and `NEXT_CONVERSION_REPORT.json` are included.
- `next.config.ts` opts into static export (`output: 'export'` and trailing slash), with no server-side features. Not all Next.js workloads support static exports.
- Existing legacy Next iframe scaffold, safe HTML ZIP and WordPress FSE ZIP remain available separately.

## How to test

```bash
node --check assets/next-converter.js
python -m pytest -q tests/test_next_target_service.py tests/test_next_converter_browser.py
python tests/create_next_fixture.py --output /tmp/next-fixture.zip
mkdir -p /tmp/next-fixture && cd /tmp/next-fixture && unzip -q ../next-fixture.zip
npm install --no-audit --no-fund
npm run typecheck
npm run build
# inspect out/index.html and out/about/index.html
```

CI also runs legacy framework tests and generated Next build checks. The build commands above apply to generated output, NOT the Web Audit Studio frontend.

## Security / fidelity boundaries

1. The input must be an authorized public capture or provided ZIP. The browser-only scanner remains constrained by CORS; it does not download private server source.
2. No source JavaScript, API routes, original authentication, databases, backend logic, forms, or interactive behavior is recreated. Form fields are visual placeholders with submissions disabled. This is **not** a full-stack clone.
3. React only renders sanitized structured nodes; unknown/active markup is dropped, URL handling rejects executable protocols, and CSS remote imports are removed. Inspect SVGs and other assets before release. Asset content is not verified for copyright or suitability.
4. The `aiMode` label correctly distinguishes local deterministic analysis from actual Ollama/cloud inference. Inference enriches recommendations only; it does not blindly execute or publish generated code.
5. Use Next.js static build in an isolated staging environment and review responsive layouts (390 / 768 / 1440px), accessibility, metadata, links and missing media before deployment.
6. Route collisions or unsafe captured paths stop conversion rather than quietly replacing page data. Support for arbitrary dynamic routes and application APIs is not yet implemented.

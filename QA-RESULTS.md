# QA status

- Application JS syntax: PASS locally on 2026-11-23 (node --check).
- Core path safety, URL rewriting, CSS/JS imports and framework export tests: PASS locally on source package (node --test tests/core.test.cjs).
- Offline JSZip dependency: INCLUDED (v3.10.1).
- End-to-end browser interaction and responsive visual parity on real source sites: NOT VERIFIED.
- Cross-origin websites without CORS: NOT SUPPORTED without a separate authorized capture service.
- Generated native Next.js fixture: typecheck and build passed in GitHub Actions on the pre-consolidation validation branch; recheck on the consolidated PR.
- Original hosted site source parity: NOT VERIFIED.
- GitHub Pages deploys automatically from `main`; verify the published revision after merge. No generated conversion ZIP is automatically published.

CI workflow runs the deterministic core assertions on GitHub Actions; a passing workflow is not a substitute for desktop/mobile browser E2E.

## Consolidated validation

The consolidated branch includes Chromium export tests, Python API tests, and a generated Next.js fixture typecheck/build in CI. Phase 2A adds multi-page component/token fixtures, oversized input bounds, and Analysis JSON download coverage. Run `node tools/build-single-file.cjs --check` to verify the portable build is current. These tests establish deterministic fixture behavior; source-to-output visual review on authorized real sites remains required for generated sites.

CI now captures the local demo at 390, 768, and 1440 pixels, checks horizontal overflow and the preview heading, and uploads screenshots for human review. A disposable WordPress container activates the importer, parses native blocks, verifies executable markup is removed, persists a draft page, and submits a fixture manifest through the nonce-protected admin upload. A converted real site's media, layout, and interactive behavior still need source/target staging review.

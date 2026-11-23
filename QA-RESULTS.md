# QA status

- Application JS syntax: PASS locally on 2026-11-23 (node --check).
- Core path safety, URL rewriting, CSS/JS imports and framework export tests: PASS locally on source package (node --test tests/core.test.cjs).
- Offline JSZip dependency: INCLUDED (v3.10.1).
- End-to-end browser interaction and responsive visual parity: NOT VERIFIED in this environment.
- Cross-origin websites without CORS: NOT SUPPORTED without a separate authorized capture service.
- Generated framework builds after npm install: NOT VERIFIED.
- Original hosted site source parity: NOT VERIFIED.
- Production deployment: NOT REQUESTED / NOT DONE.

CI workflow runs the deterministic core assertions on GitHub Actions; a passing workflow is not a substitute for desktop/mobile browser E2E.

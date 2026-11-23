# Optional hybrid intelligence API

The browser works offline with deterministic rules; this service adds **actual LLM-based review** when you run a local Ollama model. Cloud processing is only attempted if both the user explicitly checks Cloud consent for that analysis and `OPENAI_API_KEY` is configured on the server. If models are unavailable the API returns labelled `local-rules` output, never pretends it used AI.

## Local development

```bash
python -m pip install -r services/analyzer/requirements.txt
ollama pull qwen2.5-coder:7b  # optional, needs disk/RAM; Ollama should bind to loopback
uvicorn services.analyzer.app:app --host 127.0.0.1 --port 8788
python -m http.server 8000
```

Open `http://127.0.0.1:8000`, load a captured site, and set the optional backend URL to `http://127.0.0.1:8788`. The frontend sends **only bounded page metadata and headings**, not raw HTML, source code or credentials. Default backend CORS allows `http://127.0.0.1:8000` and `http://localhost:8000`. HTTPS-hosted UIs need a properly secured HTTPS reverse proxy or same-origin API: localhost mixed-content/Private Network Access may be blocked.

Optional environment variables: `OLLAMA_MODEL`, `OPENAI_MODEL`, `OPENAI_API_KEY` and `WEB_AUDIT_ALLOWED_ORIGINS`. Keep secrets server-side; never add an API key to JavaScript, localStorage or a Git commit. `OLLAMA_URL` is restricted to localhost port 11434 to avoid arbitrary server-side requests. OpenAI calls may incur charges **only when a key is configured and the user explicitly opts in**.

Security boundaries: read-only model assessment, no execution of generated code, no unauthorized website crawling, no arbitrary LLM endpoint, bounded request size, origin allowlist, strict response contract. If exposing this API beyond localhost, add authentication, per-user rate limits, observability, TLS and a non-public service boundary first.

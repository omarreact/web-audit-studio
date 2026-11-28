const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }
    if (url.pathname === "/" || url.pathname === "/index.html") return text(HTML, "text/html; charset=utf-8");
    if (url.pathname === "/assets/app.css") return text(CSS, "text/css; charset=utf-8");
    if (url.pathname === "/assets/app.js") return text(APP, "text/javascript; charset=utf-8");
    if (url.pathname === "/assets/compile.js") return text(COMPILE, "text/javascript; charset=utf-8");
    if (url.pathname === "/favicon.svg") return text(ICON, "image/svg+xml");
    if (url.pathname === "/vendor/jszip.min.js") return jszip();
    if (url.pathname === "/api/inspect") return inspect(url);
    if (url.pathname === "/api/asset") return asset(url);
    return new Response("Not found", { status: 404 });
  },
};

function text(body, type) {
  return new Response(body, {
    headers: {
      "content-type": type,
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}

async function jszip() {
  const upstream = await fetch("https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js");
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "public, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
}

async function inspect(url) {
  try {
    const remote = await pull(url.searchParams.get("url") || "", 2_500_000);
    const html = new TextDecoder().decode(remote.body);
    const looksHtml = /html|xml/i.test(remote.contentType) || /^\s*</.test(html);
    if (!remote.body.byteLength || !looksHtml) {
      return json({ error: "That URL did not return an HTML page" }, 415);
    }
    return json({ status: remote.status, finalUrl: remote.finalUrl, html });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Could not fetch that page" }, 400);
  }
}

async function asset(url) {
  try {
    const remote = await pull(url.searchParams.get("url") || "", 1_500_000);
    if (remote.status >= 400) return new Response("HTTP " + remote.status, { status: remote.status });
    return new Response(remote.body, {
      headers: {
        "content-type": remote.contentType || "application/octet-stream",
        "cache-control": "private, max-age=120",
        "x-content-type-options": "nosniff",
        "x-final-url": remote.finalUrl,
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Download failed", { status: 400 });
  }
}

async function pull(raw, maxBytes) {
  let current = assertPublic(raw);
  const seen = new Set();
  for (let hop = 0; hop < 5; hop++) {
    if (seen.has(current.href)) throw new Error("Redirect loop");
    seen.add(current.href);
    const response = await fetch(current, {
      method: "GET",
      redirect: "manual",
      headers: { "user-agent": UA, accept: "*/*" },
      signal: AbortSignal.timeout(15000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirect had no destination");
      current = assertPublic(new URL(location, current).href);
      continue;
    }
    const body = await readCap(response, maxBytes);
    return {
      status: response.status,
      finalUrl: current.href,
      contentType: response.headers.get("content-type") || "",
      body,
    };
  }
  throw new Error("Too many redirects");
}

async function readCap(response, maxBytes) {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = [];
  let total = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    total += next.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("That file is too large");
    }
    chunks.push(next.value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function assertPublic(raw) {
  const input = String(raw || "").trim();
  if (!input || input.length > 2048) throw new Error("Enter a valid http or https URL");
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Enter a valid http or https URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http and https links can be fetched");
  if (url.username || url.password) throw new Error("Links with a username or password are blocked");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    throw new Error("That address is blocked");
  }
  if (isPrivate(host)) throw new Error("Private network addresses are blocked");
  return url;
}

function isPrivate(host) {
  let value = host;
  if (value.startsWith("::ffff:")) value = value.slice(7);
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    const parts = value.split(".").map(Number);
    if (parts.some((part) => part > 255)) return true;
    const a = parts[0];
    const b = parts[1];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (value.includes(":")) {
    if (value === "::1" || value === "::") return true;
    if (value.startsWith("fc") || value.startsWith("fd") || /^fe[89ab]/.test(value)) return true;
  }
  return false;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

const HTML = "<!DOCTYPE html>\n<html lang=\"bn\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  <title>সাইট সেভ</title>\n  <meta name=\"description\" content=\"একটা লিংক দিন। জিপ আনজিপ করে index.html খুললে ফোন বা কম্পিউটারের ব্রাউজারে সাইট দেখা যাবে।\">\n  <link rel=\"stylesheet\" href=\"assets/save.css\">\n</head>\n<body>\n  <main class=\"wrap\">\n    <header class=\"top\">\n      <p class=\"mark\">সাইট সেভ</p>\n      <button type=\"button\" id=\"theme\" class=\"icon\" aria-label=\"থিম বদলান\">◐</button>\n    </header>\n    <h1>ওয়েবসাইট সেভ করুন</h1>\n    <p class=\"lead\">লিংক দিন। একটা জিপ পাবেন — আনজিপ করে <strong>index.html</strong> খুললেই সাইট দেখা যাবে, ফোনে বা কম্পিউটারে।</p>\n    <form id=\"form\">\n      <label for=\"url\">ওয়েবসাইটের লিংক</label>\n      <input id=\"url\" type=\"url\" inputmode=\"url\" placeholder=\"https://example.com\" autocomplete=\"off\" spellcheck=\"false\">\n      <button type=\"submit\" id=\"go\" class=\"primary\">সেভ করুন</button>\n      <button type=\"button\" id=\"sample\" class=\"quiet\">নমুনা জিপ দেখুন</button>\n    </form>\n    <p id=\"error\" class=\"error\" hidden></p>\n    <section id=\"status\" class=\"card\" hidden>\n      <p id=\"statusTitle\" class=\"card-title\"></p>\n      <p id=\"statusDetail\" class=\"muted\"></p>\n      <div class=\"bar\" id=\"barWrap\"><div id=\"bar\"></div></div>\n      <button type=\"button\" id=\"again\" class=\"primary\" hidden>আবার ডাউনলোড</button>\n    </section>\n    <ol class=\"steps\">\n      <li><span>১</span><div><b>লিংক দিন</b><p>যে পেজটা রাখতে চান, তার ঠিকানা বসান।</p></div></li>\n      <li><span>২</span><div><b>সেভ করুন</b><p>পেজ, স্টাইল, ছবি আর ফন্ট এক জিপে জমা হয়।</p></div></li>\n      <li><span>৩</span><div><b>index.html খুলুন</b><p>আনজিপ করলে css, js, images ফোল্ডার পাবেন। index.html খুললেই ব্রাউজারে চলবে।</p></div></li>\n    </ol>\n    <p class=\"note\">পাবলিক পেজ এখান থেকে আনা হয়, তাই বেশিরভাগ সাইট সেভ হয়। লগইনের ভিতরের পেজ আর প্রাইভেট নেটওয়ার্ক আসে না। জাভাস্ক্রিপ্ট দিয়ে আঁকা কিছু সাইট অফলাইনে অসম্পূর্ণ থাকতে পারে।</p>\n  </main>\n  <script src=\"vendor/jszip.min.js\"></script>\n  <script src=\"assets/save.js\"></script>\n</body>\n</html>\n";
const CSS = ":root {\n  color-scheme: dark;\n  --bg: #0c0f14;\n  --surface: #151a22;\n  --surface-2: #1e2632;\n  --fg: #e8eef5;\n  --muted: #93a0b0;\n  --line: #2c3646;\n  --primary: #e2a04a;\n  --primary-fg: #1c1306;\n  --danger: #e26670;\n  --sans: \"Noto Sans Bengali\", \"Noto Sans\", sans-serif;\n}\n\n:root.light {\n  color-scheme: light;\n  --bg: #f3efe7;\n  --surface: #fffdf8;\n  --surface-2: #efe8dc;\n  --fg: #1c1814;\n  --muted: #6f675e;\n  --line: #e3d9cb;\n  --primary: #9a5710;\n  --primary-fg: #fff8ef;\n  --danger: #b42332;\n}\n\n* { box-sizing: border-box; }\nhtml, body { margin: 0; min-height: 100%; }\nbody {\n  background: var(--bg);\n  color: var(--fg);\n  font-family: var(--sans);\n  line-height: 1.5;\n}\nbutton, input { font: inherit; }\nbutton { cursor: pointer; }\nbutton:disabled { cursor: default; opacity: 0.5; }\nbutton:focus-visible, input:focus-visible {\n  outline: 2px solid var(--primary);\n  outline-offset: 2px;\n}\n\n.wrap {\n  width: min(32rem, calc(100% - 2.5rem));\n  margin: 0 auto;\n  padding: 2rem 0 3rem;\n  min-height: 100dvh;\n  display: flex;\n  flex-direction: column;\n}\n.top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; }\n.mark { margin: 0; color: var(--primary); font-weight: 600; letter-spacing: 0.02em; }\n.icon {\n  width: 2.75rem;\n  height: 2.75rem;\n  border-radius: 999px;\n  border: 1px solid var(--line);\n  background: var(--surface);\n  color: var(--fg);\n}\nh1 { margin: 0; font-size: 1.875rem; line-height: 1.2; font-weight: 600; }\n.lead { margin: 0.75rem 0 0; color: var(--muted); }\n.lead strong { color: var(--fg); font-weight: 600; }\n\nform { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 2rem; }\nlabel { font-size: 0.875rem; font-weight: 600; }\ninput {\n  height: 3rem;\n  border-radius: 0.75rem;\n  border: 1px solid var(--line);\n  background: var(--surface);\n  color: var(--fg);\n  padding: 0 1rem;\n}\ninput::placeholder { color: var(--muted); }\n.primary {\n  height: 3rem;\n  border: 0;\n  border-radius: 0.75rem;\n  background: var(--primary);\n  color: var(--primary-fg);\n  font-weight: 600;\n}\n.quiet {\n  align-self: flex-start;\n  border: 0;\n  background: none;\n  color: var(--muted);\n  text-decoration: underline;\n  text-underline-offset: 0.2em;\n  padding: 0;\n}\n.error {\n  margin: 1rem 0 0;\n  padding: 0.75rem 1rem;\n  border-radius: 0.75rem;\n  border: 1px solid var(--line);\n  background: var(--surface);\n  color: var(--danger);\n  font-size: 0.875rem;\n}\n.card {\n  margin-top: 1.5rem;\n  padding: 1.25rem;\n  border-radius: 1rem;\n  border: 1px solid var(--line);\n  background: var(--surface);\n}\n.card-title { margin: 0; font-weight: 600; }\n.muted { color: var(--muted); font-size: 0.875rem; }\n.card .muted { margin: 0.35rem 0 0; }\n.bar { height: 0.375rem; margin-top: 1rem; border-radius: 999px; background: var(--surface-2); overflow: hidden; }\n.bar > div { height: 100%; width: 0; background: var(--primary); }\n#again { width: 100%; margin-top: 1rem; }\n\n.steps { list-style: none; margin: auto 0 0; padding: 2.5rem 0 0; display: flex; flex-direction: column; gap: 1rem; }\n.steps li { display: flex; gap: 0.75rem; }\n.steps span {\n  width: 2rem;\n  height: 2rem;\n  flex: none;\n  display: grid;\n  place-items: center;\n  border-radius: 999px;\n  background: var(--surface-2);\n  font-size: 0.875rem;\n  font-weight: 600;\n}\n.steps b { display: block; font-size: 0.875rem; }\n.steps p { margin: 0.15rem 0 0; color: var(--muted); font-size: 0.875rem; }\n.note, .foot { color: var(--muted); font-size: 0.875rem; }\n.note { margin: 1.5rem 0 0; }\n.foot { margin: 0.75rem 0 0; }\n.foot a { color: var(--fg); }\n\n@media (prefers-reduced-motion: reduce) {\n  * { transition: none !important; }\n}\n";
const APP = "(function () {\n  var CAP = 80;\n  var urlInput = document.getElementById(\"url\");\n  var form = document.getElementById(\"form\");\n  var go = document.getElementById(\"go\");\n  var errorBox = document.getElementById(\"error\");\n  var statusBox = document.getElementById(\"status\");\n  var statusTitle = document.getElementById(\"statusTitle\");\n  var statusDetail = document.getElementById(\"statusDetail\");\n  var bar = document.getElementById(\"bar\");\n  var again = document.getElementById(\"again\");\n  var lastBlob = null;\n  var lastName = \"website.zip\";\n  var busy = false;\n\n  if (localStorage.getItem(\"site-save-theme\") === \"light\") document.documentElement.classList.add(\"light\");\n  document.getElementById(\"theme\").addEventListener(\"click\", function () {\n    var light = document.documentElement.classList.toggle(\"light\");\n    localStorage.setItem(\"site-save-theme\", light ? \"light\" : \"dark\");\n  });\n\n  form.addEventListener(\"submit\", function (event) {\n    event.preventDefault();\n    saveLive(urlInput.value);\n  });\n  document.getElementById(\"sample\").addEventListener(\"click\", saveSample);\n  again.addEventListener(\"click\", function () {\n    if (lastBlob) download(lastBlob, lastName);\n  });\n\n  function saveSample() {\n    var html = \"<!DOCTYPE html>\\n<html lang=\\\"bn\\\">\\n<head>\\n<meta charset=\\\"utf-8\\\">\\n<title>নমুনা সাইট</title>\\n<link rel=\\\"stylesheet\\\" href=\\\"css/site.css\\\">\\n</head>\\n<body>\\n<img src=\\\"images/mark.svg\\\" alt=\\\"\\\">\\n<h1>নমুনা সাইট</h1>\\n<p>এই ফোল্ডার আনজিপ করে index.html খুলুন।</p>\\n</body>\\n</html>\\n\";\n    var css = \"body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0c0f14;color:#e8eef5;font-family:sans-serif;text-align:center}\\nimg{width:4rem;height:4rem}\\nh1{font-size:1.5rem}\\n\";\n    var svg = \"<svg xmlns=\\\"http://www.w3.org/2000/svg\\\" viewBox=\\\"0 0 64 64\\\"><rect width=\\\"64\\\" height=\\\"64\\\" rx=\\\"14\\\" fill=\\\"#e2a04a\\\"/><path d=\\\"M18 40V24h8.2c4.6 0 7.4 2.4 7.4 6.2 0 3.8-2.8 6.2-7.4 6.2H24v3.6H18zm6-7.2h1.8c2 0 3.2-1 3.2-2.6s-1.2-2.6-3.2-2.6H24v5.2zM38 40l6.2-16H50L56.2 40h-6.3l-.7-2.2h-4.2L44.3 40H38zm6.6-6.2h2.6L46 28.2l-1.4 5.6z\\\" fill=\\\"#1c1306\\\"/></svg>\";\n    pack([\n      { path: \"index.html\", text: html },\n      { path: \"css/site.css\", text: css },\n      { path: \"images/mark.svg\", text: svg }\n    ], \"sample-site.zip\", \"নমুনা সাইট\", 3);\n  }\n\n  function saveLive(raw) {\n    if (busy) return;\n    var pageUrl;\n    try {\n      pageUrl = normalize(raw);\n    } catch (error) {\n      fail(error.message);\n      return;\n    }\n    urlInput.value = pageUrl;\n    busy = true;\n    go.disabled = true;\n    hide(errorBox);\n    show(statusBox);\n    again.hidden = true;\n    setStatus(\"পেজ পড়া হচ্ছে\", \"সাইটের মূল পেজ আনা হচ্ছে\", 12);\n\n    fetch(\"/api/inspect?url=\" + encodeURIComponent(pageUrl))\n      .then(function (response) {\n        return response.json().then(function (data) {\n          if (!response.ok) throw new Error(data.error || \"পেজটি আনা যায়নি\");\n          if (data.status === 402) throw new Error(\"এই সাইটটি ফাইল দিচ্ছে না। অন্য লিংক দিন।\");\n          if (data.status >= 400) throw new Error(\"সাইটটি উত্তর দিয়েছে HTTP \" + data.status);\n          return { html: data.html, finalUrl: data.finalUrl || pageUrl };\n        });\n      })\n      .then(function (page) {\n        return collect(page.html, page.finalUrl);\n      })\n      .then(function (bundle) {\n        return pack(bundle.files, zipName(bundle.pageUrl), bundle.title, bundle.files.length);\n      })\n      .catch(function (error) {\n        var message = error && error.message ? error.message : \"সেভ করা যায়নি\";\n        if (/failed to fetch|networkerror|load failed/i.test(message)) {\n          message = \"সেভ করা যায়নি। লিংকটা আবার চেষ্টা করুন।\";\n        }\n        fail(message);\n      })\n      .then(function () {\n        busy = false;\n        go.disabled = false;\n      });\n  }\n\n  function collect(html, pageUrl) {\n    var doc = new DOMParser().parseFromString(html, \"text/html\");\n    var title = (doc.querySelector(\"title\") && doc.querySelector(\"title\").textContent.trim()) || \"সেভ হয়ে গেছে\";\n    var found = [];\n    var seen = {};\n    function add(raw) {\n      if (!raw) return;\n      var trimmed = String(raw).trim();\n      if (!trimmed || /^(data:|blob:|javascript:|mailto:|tel:|#)/i.test(trimmed)) return;\n      var abs;\n      try { abs = new URL(trimmed, pageUrl).href; } catch (error) { return; }\n      if (abs === pageUrl || seen[abs] || found.length >= CAP) return;\n      var kind = kindOf(abs);\n      if (kind === \"html\") return;\n      seen[abs] = true;\n      found.push({ url: abs, kind: kind });\n    }\n    var nodes = doc.querySelectorAll(\"link[href], script[src], img[src], img[data-src], source[src], video[src], audio[src], video[poster]\");\n    Array.prototype.forEach.call(nodes, function (node) {\n      var rel = (node.getAttribute(\"rel\") || \"\").toLowerCase();\n      if (node.tagName === \"LINK\" && !/(stylesheet|icon|preload|apple-touch-icon)/.test(rel)) return;\n      add(node.getAttribute(\"href\") || node.getAttribute(\"src\") || node.getAttribute(\"poster\") || node.getAttribute(\"data-src\"));\n    });\n    Array.prototype.forEach.call(doc.querySelectorAll(\"[srcset]\"), function (node) {\n      String(node.getAttribute(\"srcset\") || \"\").split(\",\").forEach(function (part) {\n        add(part.trim().split(/\\s+/)[0]);\n      });\n    });\n    Array.prototype.forEach.call(doc.querySelectorAll(\"style\"), function (node) {\n      cssUrls(node.textContent || \"\", pageUrl).forEach(add);\n    });\n\n    var files = [{ path: \"index.html\", text: \"\" }];\n    var map = {};\n    var taken = { \"index.html\": true };\n    var pending = found.slice();\n    var done = 0;\n    setStatus(\"ফাইল নামানো হচ্ছে\", \"0 / \" + pending.length, pending.length ? 20 : 70);\n\n    function next() {\n      var item = pending.shift();\n      if (!item) {\n        files[0].text = rewriteHtml(html, pageUrl, map);\n        return Promise.resolve({ files: files, title: title, pageUrl: pageUrl });\n      }\n      return fetch(\"/api/asset?url=\" + encodeURIComponent(item.url))\n        .then(function (response) {\n          if (!response.ok) throw new Error(\"skip\");\n          var type = response.headers.get(\"content-type\") || \"\";\n          if (/text\\/html|application\\/xhtml/i.test(type)) throw new Error(\"skip\");\n          var kind = kindFromType(type, item.kind);\n          var finalUrl = response.headers.get(\"x-final-url\") || item.url;\n          return response.arrayBuffer().then(function (buffer) {\n            if (!buffer.byteLength || buffer.byteLength > 8 * 1024 * 1024) throw new Error(\"skip\");\n            var path = unique(folder(kind) + \"/\" + safeName(finalUrl, kind), taken);\n            taken[path] = true;\n            map[item.url] = path;\n            map[finalUrl] = path;\n            var file = { path: path, bytes: buffer, kind: kind };\n            files.push(file);\n            if (kind === \"css\") {\n              var css = new TextDecoder().decode(buffer);\n              cssUrls(css, finalUrl).forEach(function (extra) {\n                if (!seen[extra] && pending.length + files.length < CAP) {\n                  seen[extra] = true;\n                  pending.push({ url: extra, kind: kindOf(extra) });\n                }\n              });\n              file.text = null;\n              file.cssBase = finalUrl;\n            }\n          });\n        })\n        .catch(function () {})\n        .then(function () {\n          done += 1;\n          var total = done + pending.length;\n          setStatus(\"ফাইল নামানো হচ্ছে\", done + \" / \" + total, Math.round((done / Math.max(total, 1)) * 100));\n          return next();\n        });\n    }\n\n    return next().then(function (bundle) {\n      files.forEach(function (file) {\n        if (file.kind !== \"css\" || !file.bytes) return;\n        var css = new TextDecoder().decode(file.bytes);\n        file.text = rewriteCss(css, file.cssBase, file.path, map);\n        file.bytes = null;\n      });\n      return bundle;\n    });\n  }\n\n  function pack(entries, name, title, count) {\n    if (typeof JSZip !== \"function\") throw new Error(\"জিপ টুল লোড হয়নি\");\n    setStatus(\"জিপ তৈরি হচ্ছে\", \"index.html আর ফোল্ডার সাজানো হচ্ছে\", 100);\n    var zip = new JSZip();\n    entries.forEach(function (entry) {\n      zip.file(entry.path, entry.text != null ? entry.text : entry.bytes);\n    });\n    return zip.generateAsync({ type: \"blob\" }).then(function (blob) {\n      lastBlob = blob;\n      lastName = name;\n      show(statusBox);\n      hide(errorBox);\n      again.hidden = false;\n      setStatus(title || \"সেভ হয়ে গেছে\", count + \"টি ফাইল · \" + formatBytes(blob.size), 100);\n      document.getElementById(\"barWrap\").hidden = true;\n      download(blob, name);\n    });\n  }\n\n  function rewriteHtml(html, pageUrl, map) {\n    var doc = new DOMParser().parseFromString(html, \"text/html\");\n    Array.prototype.forEach.call(doc.querySelectorAll(\"base\"), function (node) { node.remove(); });\n    var attrs = [\"src\", \"href\", \"poster\", \"data-src\"];\n    Array.prototype.forEach.call(doc.querySelectorAll(\"*\"), function (el) {\n      var changed = false;\n      attrs.forEach(function (attr) {\n        if (!el.hasAttribute(attr)) return;\n        var next = localRef(el.getAttribute(attr), pageUrl, map, \"index.html\");\n        if (!next) return;\n        el.setAttribute(attr, next);\n        changed = true;\n      });\n      if (el.hasAttribute(\"srcset\")) {\n        el.setAttribute(\"srcset\", String(el.getAttribute(\"srcset\")).split(\",\").map(function (part) {\n          var bits = part.trim().split(/\\s+/);\n          var next = localRef(bits[0], pageUrl, map, \"index.html\");\n          if (!next) return part.trim();\n          return [next].concat(bits.slice(1)).join(\" \");\n        }).join(\", \"));\n      }\n      if (changed) {\n        el.removeAttribute(\"integrity\");\n        el.removeAttribute(\"crossorigin\");\n      }\n    });\n    if (!doc.querySelector(\"meta[charset]\")) {\n      var meta = doc.createElement(\"meta\");\n      meta.setAttribute(\"charset\", \"utf-8\");\n      doc.head.insertBefore(meta, doc.head.firstChild);\n    }\n    return \"<!DOCTYPE html>\\n\" + doc.documentElement.outerHTML;\n  }\n\n  function rewriteCss(css, baseUrl, fromFile, map) {\n    return css.replace(/url\\(\\s*(['\"]?)([^'\")]+)\\1\\s*\\)/gi, function (full, quote, raw) {\n      var next = localRef(raw, baseUrl, map, fromFile);\n      return next ? \"url(\" + quote + next + quote + \")\" : full;\n    });\n  }\n\n  function localRef(raw, baseUrl, map, fromFile) {\n    var trimmed = String(raw || \"\").trim();\n    if (!trimmed || /^(data:|blob:|javascript:|mailto:|tel:|#)/i.test(trimmed)) return null;\n    try {\n      var abs = new URL(trimmed, baseUrl).href;\n      var dest = map[abs];\n      if (!dest) return null;\n      return relative(fromFile, dest);\n    } catch (error) {\n      return null;\n    }\n  }\n\n  function relative(fromFile, toFile) {\n    var from = fromFile.split(\"/\").slice(0, -1);\n    var to = toFile.split(\"/\");\n    var i = 0;\n    while (i < from.length && i < to.length && from[i] === to[i]) i += 1;\n    return new Array(from.length - i).fill(\"..\").concat(to.slice(i)).join(\"/\") || \".\";\n  }\n\n  function cssUrls(css, baseUrl) {\n    var out = [];\n    var re = /url\\(\\s*(['\"]?)([^'\")]+)\\1\\s*\\)|@import\\s+(?:url\\(\\s*)?['\"]([^'\"]+)['\"]/gi;\n    var match;\n    while ((match = re.exec(css))) {\n      var raw = (match[2] || match[3] || \"\").trim();\n      if (!raw || /^(data:|blob:|#)/i.test(raw)) continue;\n      try { out.push(new URL(raw, baseUrl).href); } catch (error) {}\n    }\n    return out;\n  }\n\n  function kindOf(url) {\n    var clean = url.split(\"?\")[0].split(\"#\")[0].toLowerCase();\n    if (/\\.css$/.test(clean)) return \"css\";\n    if (/\\.(js|mjs)$/.test(clean)) return \"js\";\n    if (/\\.(png|jpe?g|gif|webp|svg|ico|avif)$/.test(clean)) return \"image\";\n    if (/\\.(woff2?|ttf|otf)$/.test(clean)) return \"font\";\n    if (/\\.(mp4|webm|mp3|wav)$/.test(clean)) return \"media\";\n    if (/\\.html?$/.test(clean) || /\\/$/.test(clean)) return \"html\";\n    return \"file\";\n  }\n\n  function kindFromType(type, fallback) {\n    var value = type.toLowerCase();\n    if (value.indexOf(\"text/css\") !== -1) return \"css\";\n    if (value.indexOf(\"javascript\") !== -1) return \"js\";\n    if (value.indexOf(\"image/\") === 0) return \"image\";\n    if (value.indexOf(\"font\") !== -1 || value.indexOf(\"woff\") !== -1) return \"font\";\n    if (value.indexOf(\"video/\") === 0 || value.indexOf(\"audio/\") === 0) return \"media\";\n    return fallback;\n  }\n\n  function folder(kind) {\n    if (kind === \"css\") return \"css\";\n    if (kind === \"js\") return \"js\";\n    if (kind === \"image\") return \"images\";\n    if (kind === \"font\") return \"fonts\";\n    if (kind === \"media\") return \"media\";\n    return \"files\";\n  }\n\n  function safeName(url, kind) {\n    var base = \"file\";\n    try {\n      var parsed = new URL(url);\n      base = decodeURIComponent(parsed.pathname).split(\"/\").filter(Boolean).pop() || \"file\";\n    } catch (error) {}\n    base = base.replace(/[^a-zA-Z0-9._-]+/g, \"_\").slice(0, 72) || \"file\";\n    if (kind === \"css\" && !/\\.[a-z0-9]{1,5}$/i.test(base)) base += \".css\";\n    if (kind === \"js\" && !/\\.[a-z0-9]{1,5}$/i.test(base)) base += \".js\";\n    return base;\n  }\n\n  function unique(path, taken) {\n    if (!taken[path]) return path;\n    var slash = path.lastIndexOf(\"/\");\n    var dir = slash >= 0 ? path.slice(0, slash + 1) : \"\";\n    var base = path.slice(slash + 1);\n    var dot = base.lastIndexOf(\".\");\n    var stem = dot > 0 ? base.slice(0, dot) : base;\n    var ext = dot > 0 ? base.slice(dot) : \"\";\n    var n = 2;\n    while (taken[dir + stem + \"-\" + n + ext]) n += 1;\n    return dir + stem + \"-\" + n + ext;\n  }\n\n  function normalize(raw) {\n    var trimmed = String(raw || \"\").trim();\n    if (!trimmed) throw new Error(\"আগে ওয়েবসাইটের লিংক দিন\");\n    var withProto = /^https?:\\/\\//i.test(trimmed) ? trimmed : \"https://\" + trimmed;\n    var url;\n    try { url = new URL(withProto); } catch (error) { throw new Error(\"লিংকটি ঠিক নয়\"); }\n    if (url.protocol !== \"http:\" && url.protocol !== \"https:\") throw new Error(\"শুধু http বা https লিংক চলবে\");\n    return url.href;\n  }\n\n  function zipName(pageUrl) {\n    try {\n      var host = new URL(pageUrl).hostname.replace(/^www\\./, \"\").replace(/[^a-z0-9.-]+/gi, \"\").slice(0, 60);\n      return (host || \"website\") + \".zip\";\n    } catch (error) {\n      return \"website.zip\";\n    }\n  }\n\n  function formatBytes(bytes) {\n    if (!bytes) return \"0 B\";\n    var units = [\"B\", \"KB\", \"MB\"];\n    var index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));\n    var value = bytes / Math.pow(1024, index);\n    return (value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)) + \" \" + units[index];\n  }\n\n  function setStatus(title, detail, percent) {\n    statusTitle.textContent = title;\n    statusDetail.textContent = detail;\n    bar.style.width = Math.max(0, Math.min(100, percent)) + \"%\";\n    document.getElementById(\"barWrap\").hidden = false;\n  }\n\n  function fail(message) {\n    errorBox.textContent = message;\n    show(errorBox);\n    hide(statusBox);\n  }\n\n  function show(node) { node.hidden = false; }\n  function hide(node) { node.hidden = true; }\n\n  function download(blob, filename) {\n    var href = URL.createObjectURL(blob);\n    var link = document.createElement(\"a\");\n    link.href = href;\n    link.download = filename;\n    document.body.appendChild(link);\n    link.click();\n    link.remove();\n    setTimeout(function () { URL.revokeObjectURL(href); }, 20000);\n  }\n})();\n";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }
    if (url.pathname === "/" || url.pathname === "/index.html") return text(HTML, "text/html; charset=utf-8");
    if (url.pathname === "/assets/save.css") return text(CSS, "text/css; charset=utf-8");
    if (url.pathname === "/assets/save.js") return text(APP, "text/javascript; charset=utf-8");
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
    return json({
      status: remote.status,
      finalUrl: remote.finalUrl,
      html,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Could not fetch that page" }, 400);
  }
}

async function asset(url) {
  try {
    const remote = await pull(url.searchParams.get("url") || "", 8_000_000);
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

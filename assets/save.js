(function () {
  var CAP = 80;
  var urlInput = document.getElementById("url");
  var form = document.getElementById("form");
  var go = document.getElementById("go");
  var errorBox = document.getElementById("error");
  var statusBox = document.getElementById("status");
  var statusTitle = document.getElementById("statusTitle");
  var statusDetail = document.getElementById("statusDetail");
  var bar = document.getElementById("bar");
  var again = document.getElementById("again");
  var lastBlob = null;
  var lastName = "website.zip";
  var busy = false;

  if (localStorage.getItem("site-save-theme") === "light") document.documentElement.classList.add("light");
  document.getElementById("theme").addEventListener("click", function () {
    var light = document.documentElement.classList.toggle("light");
    localStorage.setItem("site-save-theme", light ? "light" : "dark");
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    saveLive(urlInput.value);
  });
  document.getElementById("sample").addEventListener("click", saveSample);
  again.addEventListener("click", function () {
    if (lastBlob) download(lastBlob, lastName);
  });

  function saveSample() {
    var html = "<!DOCTYPE html>\n<html lang=\"bn\">\n<head>\n<meta charset=\"utf-8\">\n<title>নমুনা সাইট</title>\n<link rel=\"stylesheet\" href=\"css/site.css\">\n</head>\n<body>\n<img src=\"images/mark.svg\" alt=\"\">\n<h1>নমুনা সাইট</h1>\n<p>এই ফোল্ডার আনজিপ করে index.html খুলুন।</p>\n</body>\n</html>\n";
    var css = "body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0c0f14;color:#e8eef5;font-family:sans-serif;text-align:center}\nimg{width:4rem;height:4rem}\nh1{font-size:1.5rem}\n";
    var svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\"><rect width=\"64\" height=\"64\" rx=\"14\" fill=\"#e2a04a\"/><path d=\"M18 40V24h8.2c4.6 0 7.4 2.4 7.4 6.2 0 3.8-2.8 6.2-7.4 6.2H24v3.6H18zm6-7.2h1.8c2 0 3.2-1 3.2-2.6s-1.2-2.6-3.2-2.6H24v5.2zM38 40l6.2-16H50L56.2 40h-6.3l-.7-2.2h-4.2L44.3 40H38zm6.6-6.2h2.6L46 28.2l-1.4 5.6z\" fill=\"#1c1306\"/></svg>";
    pack([
      { path: "index.html", text: html },
      { path: "css/site.css", text: css },
      { path: "images/mark.svg", text: svg }
    ], "sample-site.zip", "নমুনা সাইট", 3);
  }

  function saveLive(raw) {
    if (busy) return;
    var pageUrl;
    try {
      pageUrl = normalize(raw);
    } catch (error) {
      fail(error.message);
      return;
    }
    urlInput.value = pageUrl;
    busy = true;
    go.disabled = true;
    hide(errorBox);
    show(statusBox);
    again.hidden = true;
    setStatus("পেজ পড়া হচ্ছে", "সাইটের মূল পেজ আনা হচ্ছে", 12);

    fetch(pageUrl, { mode: "cors", redirect: "follow" })
      .then(function (response) {
        if (!response.ok) throw new Error("সাইটটি উত্তর দিয়েছে HTTP " + response.status);
        var type = response.headers.get("content-type") || "";
        if (type && type.indexOf("html") === -1) throw new Error("এই লিংকটা HTML পেজ নয়");
        return response.text().then(function (html) {
          return { html: html, finalUrl: response.url || pageUrl };
        });
      })
      .then(function (page) {
        return collect(page.html, page.finalUrl);
      })
      .then(function (bundle) {
        return pack(bundle.files, zipName(bundle.pageUrl), bundle.title, bundle.files.length);
      })
      .catch(function (error) {
        var message = error && error.message ? error.message : "সেভ করা যায়নি";
        if (/failed to fetch|networkerror|load failed/i.test(message)) {
          message = "এই সাইট ব্রাউজার থেকে আটকেছে। GitHub Pages অন্য সাইটের ফাইল আনতে পারে না, যদি সেই সাইট CORS না দেয়।";
        }
        fail(message);
      })
      .then(function () {
        busy = false;
        go.disabled = false;
      });
  }

  function collect(html, pageUrl) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var title = (doc.querySelector("title") && doc.querySelector("title").textContent.trim()) || "সেভ হয়ে গেছে";
    var found = [];
    var seen = {};
    function add(raw) {
      if (!raw) return;
      var trimmed = String(raw).trim();
      if (!trimmed || /^(data:|blob:|javascript:|mailto:|tel:|#)/i.test(trimmed)) return;
      var abs;
      try { abs = new URL(trimmed, pageUrl).href; } catch (error) { return; }
      if (abs === pageUrl || seen[abs] || found.length >= CAP) return;
      var kind = kindOf(abs);
      if (kind === "html") return;
      seen[abs] = true;
      found.push({ url: abs, kind: kind });
    }
    var nodes = doc.querySelectorAll("link[href], script[src], img[src], img[data-src], source[src], video[src], audio[src], video[poster]");
    Array.prototype.forEach.call(nodes, function (node) {
      var rel = (node.getAttribute("rel") || "").toLowerCase();
      if (node.tagName === "LINK" && !/(stylesheet|icon|preload|apple-touch-icon)/.test(rel)) return;
      add(node.getAttribute("href") || node.getAttribute("src") || node.getAttribute("poster") || node.getAttribute("data-src"));
    });
    Array.prototype.forEach.call(doc.querySelectorAll("[srcset]"), function (node) {
      String(node.getAttribute("srcset") || "").split(",").forEach(function (part) {
        add(part.trim().split(/\s+/)[0]);
      });
    });
    Array.prototype.forEach.call(doc.querySelectorAll("style"), function (node) {
      cssUrls(node.textContent || "", pageUrl).forEach(add);
    });

    var files = [{ path: "index.html", text: "" }];
    var map = {};
    var taken = { "index.html": true };
    var pending = found.slice();
    var done = 0;
    setStatus("ফাইল নামানো হচ্ছে", "0 / " + pending.length, pending.length ? 20 : 70);

    function next() {
      var item = pending.shift();
      if (!item) {
        files[0].text = rewriteHtml(html, pageUrl, map);
        return Promise.resolve({ files: files, title: title, pageUrl: pageUrl });
      }
      return fetch(item.url, { mode: "cors", redirect: "follow" })
        .then(function (response) {
          if (!response.ok) throw new Error("skip");
          var type = response.headers.get("content-type") || "";
          if (/text\/html|application\/xhtml/i.test(type)) throw new Error("skip");
          var kind = kindFromType(type, item.kind);
          return response.arrayBuffer().then(function (buffer) {
            if (!buffer.byteLength || buffer.byteLength > 4 * 1024 * 1024) throw new Error("skip");
            var path = unique(folder(kind) + "/" + safeName(response.url || item.url, kind), taken);
            taken[path] = true;
            map[item.url] = path;
            if (response.url) map[response.url] = path;
            var file = { path: path, bytes: buffer, kind: kind };
            files.push(file);
            if (kind === "css") {
              var css = new TextDecoder().decode(buffer);
              cssUrls(css, response.url || item.url).forEach(function (extra) {
                if (!seen[extra] && pending.length + files.length < CAP) {
                  seen[extra] = true;
                  pending.push({ url: extra, kind: kindOf(extra) });
                }
              });
              file.text = null;
              file.cssBase = response.url || item.url;
            }
          });
        })
        .catch(function () {})
        .then(function () {
          done += 1;
          var total = done + pending.length;
          setStatus("ফাইল নামানো হচ্ছে", done + " / " + total, Math.round((done / Math.max(total, 1)) * 100));
          return next();
        });
    }

    return next().then(function (bundle) {
      files.forEach(function (file) {
        if (file.kind !== "css" || !file.bytes) return;
        var css = new TextDecoder().decode(file.bytes);
        file.text = rewriteCss(css, file.cssBase, file.path, map);
        file.bytes = null;
      });
      return bundle;
    });
  }

  function pack(entries, name, title, count) {
    if (typeof JSZip !== "function") throw new Error("জিপ টুল লোড হয়নি");
    setStatus("জিপ তৈরি হচ্ছে", "index.html আর ফোল্ডার সাজানো হচ্ছে", 100);
    var zip = new JSZip();
    entries.forEach(function (entry) {
      zip.file(entry.path, entry.text != null ? entry.text : entry.bytes);
    });
    return zip.generateAsync({ type: "blob" }).then(function (blob) {
      lastBlob = blob;
      lastName = name;
      show(statusBox);
      hide(errorBox);
      again.hidden = false;
      setStatus(title || "সেভ হয়ে গেছে", count + "টি ফাইল · " + formatBytes(blob.size), 100);
      document.getElementById("barWrap").hidden = true;
      download(blob, name);
    });
  }

  function rewriteHtml(html, pageUrl, map) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    Array.prototype.forEach.call(doc.querySelectorAll("base"), function (node) { node.remove(); });
    var attrs = ["src", "href", "poster", "data-src"];
    Array.prototype.forEach.call(doc.querySelectorAll("*"), function (el) {
      var changed = false;
      attrs.forEach(function (attr) {
        if (!el.hasAttribute(attr)) return;
        var next = localRef(el.getAttribute(attr), pageUrl, map, "index.html");
        if (!next) return;
        el.setAttribute(attr, next);
        changed = true;
      });
      if (el.hasAttribute("srcset")) {
        el.setAttribute("srcset", String(el.getAttribute("srcset")).split(",").map(function (part) {
          var bits = part.trim().split(/\s+/);
          var next = localRef(bits[0], pageUrl, map, "index.html");
          if (!next) return part.trim();
          return [next].concat(bits.slice(1)).join(" ");
        }).join(", "));
      }
      if (changed) {
        el.removeAttribute("integrity");
        el.removeAttribute("crossorigin");
      }
    });
    if (!doc.querySelector("meta[charset]")) {
      var meta = doc.createElement("meta");
      meta.setAttribute("charset", "utf-8");
      doc.head.insertBefore(meta, doc.head.firstChild);
    }
    return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  }

  function rewriteCss(css, baseUrl, fromFile, map) {
    return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, function (full, quote, raw) {
      var next = localRef(raw, baseUrl, map, fromFile);
      return next ? "url(" + quote + next + quote + ")" : full;
    });
  }

  function localRef(raw, baseUrl, map, fromFile) {
    var trimmed = String(raw || "").trim();
    if (!trimmed || /^(data:|blob:|javascript:|mailto:|tel:|#)/i.test(trimmed)) return null;
    try {
      var abs = new URL(trimmed, baseUrl).href;
      var dest = map[abs];
      if (!dest) return null;
      return relative(fromFile, dest);
    } catch (error) {
      return null;
    }
  }

  function relative(fromFile, toFile) {
    var from = fromFile.split("/").slice(0, -1);
    var to = toFile.split("/");
    var i = 0;
    while (i < from.length && i < to.length && from[i] === to[i]) i += 1;
    return new Array(from.length - i).fill("..").concat(to.slice(i)).join("/") || ".";
  }

  function cssUrls(css, baseUrl) {
    var out = [];
    var re = /url\(\s*(['"]?)([^'")]+)\1\s*\)|@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/gi;
    var match;
    while ((match = re.exec(css))) {
      var raw = (match[2] || match[3] || "").trim();
      if (!raw || /^(data:|blob:|#)/i.test(raw)) continue;
      try { out.push(new URL(raw, baseUrl).href); } catch (error) {}
    }
    return out;
  }

  function kindOf(url) {
    var clean = url.split("?")[0].split("#")[0].toLowerCase();
    if (/\.css$/.test(clean)) return "css";
    if (/\.(js|mjs)$/.test(clean)) return "js";
    if (/\.(png|jpe?g|gif|webp|svg|ico|avif)$/.test(clean)) return "image";
    if (/\.(woff2?|ttf|otf)$/.test(clean)) return "font";
    if (/\.(mp4|webm|mp3|wav)$/.test(clean)) return "media";
    if (/\.html?$/.test(clean) || /\/$/.test(clean)) return "html";
    return "file";
  }

  function kindFromType(type, fallback) {
    var value = type.toLowerCase();
    if (value.indexOf("text/css") !== -1) return "css";
    if (value.indexOf("javascript") !== -1) return "js";
    if (value.indexOf("image/") === 0) return "image";
    if (value.indexOf("font") !== -1 || value.indexOf("woff") !== -1) return "font";
    if (value.indexOf("video/") === 0 || value.indexOf("audio/") === 0) return "media";
    return fallback;
  }

  function folder(kind) {
    if (kind === "css") return "css";
    if (kind === "js") return "js";
    if (kind === "image") return "images";
    if (kind === "font") return "fonts";
    if (kind === "media") return "media";
    return "files";
  }

  function safeName(url, kind) {
    var base = "file";
    try {
      var parsed = new URL(url);
      base = decodeURIComponent(parsed.pathname).split("/").filter(Boolean).pop() || "file";
    } catch (error) {}
    base = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 72) || "file";
    if (kind === "css" && !/\.[a-z0-9]{1,5}$/i.test(base)) base += ".css";
    if (kind === "js" && !/\.[a-z0-9]{1,5}$/i.test(base)) base += ".js";
    return base;
  }

  function unique(path, taken) {
    if (!taken[path]) return path;
    var slash = path.lastIndexOf("/");
    var dir = slash >= 0 ? path.slice(0, slash + 1) : "";
    var base = path.slice(slash + 1);
    var dot = base.lastIndexOf(".");
    var stem = dot > 0 ? base.slice(0, dot) : base;
    var ext = dot > 0 ? base.slice(dot) : "";
    var n = 2;
    while (taken[dir + stem + "-" + n + ext]) n += 1;
    return dir + stem + "-" + n + ext;
  }

  function normalize(raw) {
    var trimmed = String(raw || "").trim();
    if (!trimmed) throw new Error("আগে ওয়েবসাইটের লিংক দিন");
    var withProto = /^https?:\/\//i.test(trimmed) ? trimmed : "https://" + trimmed;
    var url;
    try { url = new URL(withProto); } catch (error) { throw new Error("লিংকটি ঠিক নয়"); }
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("শুধু http বা https লিংক চলবে");
    return url.href;
  }

  function zipName(pageUrl) {
    try {
      var host = new URL(pageUrl).hostname.replace(/^www\./, "").replace(/[^a-z0-9.-]+/gi, "").slice(0, 60);
      return (host || "website") + ".zip";
    } catch (error) {
      return "website.zip";
    }
  }

  function formatBytes(bytes) {
    if (!bytes) return "0 B";
    var units = ["B", "KB", "MB"];
    var index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    var value = bytes / Math.pow(1024, index);
    return (value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)) + " " + units[index];
  }

  function setStatus(title, detail, percent) {
    statusTitle.textContent = title;
    statusDetail.textContent = detail;
    bar.style.width = Math.max(0, Math.min(100, percent)) + "%";
    document.getElementById("barWrap").hidden = false;
  }

  function fail(message) {
    errorBox.textContent = message;
    show(errorBox);
    hide(statusBox);
  }

  function show(node) { node.hidden = false; }
  function hide(node) { node.hidden = true; }

  function download(blob, filename) {
    var href = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(href); }, 20000);
  }
})();

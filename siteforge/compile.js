/* PIN SiteForge — HTML to WordPress block theme compiler.
   Runs in the browser. No network. Does not execute source scripts. */
(function (root) {
  "use strict";

  function slugify(value) {
    var slug = String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    if (!/^[a-z]/.test(slug)) slug = "site-" + slug;
    slug = slug.replace(/^-+|-+$/g, "").replace(/--+/g, "-");
    return slug.slice(0, 40) || "site-theme";
  }

  function phpId(slug) {
    var id = slug.replace(/-/g, "_").replace(/[^a-z0-9_]/g, "");
    if (!/^[a-z]/.test(id)) id = "theme_" + id;
    return id || "site_theme";
  }

  function esc(value) {
    return String(value || "")
      .replace(/&/g, "\u0026amp;")
      .replace(/</g, "\u0026lt;")
      .replace(/>/g, "\u0026gt;")
      .replace(/"/g, "\u0026quot;");
  }

  function phpSingle(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function safeFile(name, fallback) {
    var base = String(name || fallback || "file")
      .split("?")[0]
      .split("#")[0]
      .split("/")
      .pop();
    base = decodeURIComponent(base).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 72);
    return base || fallback || "file";
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

  function crc32(bytes) {
    if (!crc32.table) {
      var table = new Uint32Array(256);
      for (var n = 0; n < 256; n += 1) {
        var c = n;
        for (var k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
      }
      crc32.table = table;
    }
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i += 1) crc = crc32.table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function u32(value) {
    var out = new Uint8Array(4);
    var view = new DataView(out.buffer);
    view.setUint32(0, value >>> 0, false);
    return out;
  }

  function chunk(type, data) {
    var name = new TextEncoder().encode(type);
    var body = new Uint8Array(name.length + data.length);
    body.set(name, 0);
    body.set(data, name.length);
    var crc = u32(crc32(body));
    var out = new Uint8Array(4 + body.length + 4);
    out.set(u32(data.length), 0);
    out.set(body, 4);
    out.set(crc, 4 + body.length);
    return out;
  }

  function concat(parts) {
    var size = 0;
    parts.forEach(function (part) { size += part.length; });
    var out = new Uint8Array(size);
    var offset = 0;
    parts.forEach(function (part) {
      out.set(part, offset);
      offset += part.length;
    });
    return out;
  }

  async function screenshotPng() {
    var w = 240;
    var h = 180;
    var raw = new Uint8Array((w * 4 + 1) * h);
    for (var y = 0; y < h; y += 1) {
      var row = y * (w * 4 + 1);
      raw[row] = 0;
      for (var x = 0; x < w; x += 1) {
        var i = row + 1 + x * 4;
        var bar = y > 78 && y < 96 && x > 24 && x < 150;
        var mark = x > 24 && x < 48 && y > 28 && y < 52;
        raw[i] = bar || mark ? 226 : 18;
        raw[i + 1] = bar || mark ? 160 : 21;
        raw[i + 2] = bar || mark ? 74 : 28;
        raw[i + 3] = 255;
      }
    }
    if (typeof CompressionStream !== "function") return null;
    var compressed = new CompressionStream("deflate");
    var stream = new Blob([raw]).stream().pipeThrough(compressed);
    var zlib = new Uint8Array(await new Response(stream).arrayBuffer());
    var ihdr = new Uint8Array(13);
    var view = new DataView(ihdr.buffer);
    view.setUint32(0, w);
    view.setUint32(4, h);
    ihdr[8] = 8;
    ihdr[9] = 6;
    var sig = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
    return concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib), chunk("IEND", new Uint8Array())]);
  }

  function extractColors(css) {
    var found = {};
    var re = /#([0-9a-fA-F]{3,8})\b|rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g;
    var match;
    while ((match = re.exec(css || ""))) {
      var hex;
      if (match[1]) {
        hex = match[1].toLowerCase();
        if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        if (hex.length !== 6) continue;
      } else {
        hex = [match[2], match[3], match[4]].map(function (n) {
          var v = Math.max(0, Math.min(255, Number(n)));
          return v.toString(16).padStart(2, "0");
        }).join("");
      }
      found[hex] = (found[hex] || 0) + 1;
    }
    return Object.keys(found)
      .map(function (hex) { return { hex: "#" + hex, count: found[hex] }; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, 8);
  }

  function extractFonts(css) {
    var fonts = [];
    var re = /font-family\s*:\s*([^;}{]+)/gi;
    var match;
    while ((match = re.exec(css || ""))) {
      var name = match[1].split(",")[0].replace(/["']/g, "").trim();
      if (!name || /inherit|initial|unset|var\(/i.test(name)) continue;
      if (fonts.indexOf(name) === -1) fonts.push(name);
      if (fonts.length >= 4) break;
    }
    return fonts;
  }

  function prefixCss(css) {
    var skipped = 0;
    var out = [];
    var rest = String(css || "").replace(/\/\*[\s\S]*?\*\//g, "");
    var depth = 0;
    var start = 0;
    for (var i = 0; i < rest.length; i += 1) {
      if (rest[i] === "{") {
        if (depth === 0) {
          var head = rest.slice(start, i).trim();
          var end = rest.indexOf("}", i);
          if (end < 0) break;
          var body = rest.slice(i, end + 1);
          if (!head || /^@font-face|^@keyframes|^@-webkit-keyframes/i.test(head)) {
            out.push(head + body);
          } else if (/^@media/i.test(head)) {
            out.push(head + "{" + prefixCss(rest.slice(i + 1, end)).css + "}");
          } else if (/^@/i.test(head)) {
            out.push(head + body);
            skipped += 1;
          } else {
            var selectors = head.split(",").map(function (sel) {
              sel = sel.trim();
              if (!sel || sel.indexOf("{{") !== -1) return sel;
              if (/^from$|^to$|^\d+%$/.test(sel)) return sel;
              sel = sel.replace(/^(html|body|:root)\b/i, ".pin-source");
              if (sel.indexOf(".pin-source") === 0) return sel;
              return ".pin-source " + sel;
            }).filter(Boolean);
            out.push(selectors.join(", ") + body);
          }
          i = end;
          start = end + 1;
        }
        depth += 1;
      } else if (rest[i] === "}") {
        depth = Math.max(0, depth - 1);
      }
    }
    return { css: out.join("\n"), skipped: skipped };
  }

  function safeUrl(raw) {
    var value = cleanText(raw);
    if (!value || /^(javascript|data|vbscript):/i.test(value)) return "";
    if (/^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(value)) return value;
    return "";
  }

  function findRegion(doc, kind) {
    var tagged = doc.querySelector(kind);
    if (tagged) return tagged;
    var nodes = doc.querySelectorAll("[id],[class],[role]");
    for (var i = 0; i < nodes.length; i += 1) {
      var el = nodes[i];
      var id = (el.id || "") + " " + String(el.className || "") + " " + (el.getAttribute("role") || "");
      if (kind === "header" && /header|banner/i.test(id) && el.tagName !== "META") return el;
      if (kind === "footer" && /footer|contentinfo/i.test(id)) return el;
    }
    return null;
  }

  function compileTheme(doc, options) {
    options = options || {};
    var theme = options.theme || {};
    var mode = theme.mode === "reusable" ? "reusable" : "clone";
    var name = cleanText(theme.name) || "Site Theme";
    var slug = slugify(theme.slug || name);
    var version = /^\d+\.\d+\.\d+$/.test(theme.version || "") ? theme.version : "0.0.1";
    var author = cleanText(theme.author) || "Site Owner";
    var textDomain = slugify(theme.textDomain || slug);
    var description = cleanText(theme.description) || "Block theme generated by PIN SiteForge from an authorized public page.";
    var tags = cleanText(theme.tags || "full-site-editing, block-styles")
      .split(",")
      .map(function (tag) { return tag.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, ""); })
      .filter(Boolean)
      .slice(0, 8);
    var license = cleanText(theme.license) || "GNU General Public License v2 or later";
    var prefix = phpId(slug);
    var pageUrl = options.pageUrl || "";
    var css = options.css || "";
    var images = options.images || [];
    var colors = extractColors(css + " " + (doc.body ? doc.body.innerHTML : ""));
    var fonts = extractFonts(css);
    var primary = /^#[0-9a-fA-F]{6}$/.test(theme.primary || "") ? theme.primary : (colors[0] ? colors[0].hex : "#1f6f6a");
    var secondary = /^#[0-9a-fA-F]{6}$/.test(theme.secondary || "") ? theme.secondary : (colors[1] ? colors[1].hex : "#e7a23a");
    var ink = "#12151c";
    var paper = "#f7f4ee";
    var report = {
      source: pageUrl,
      mode: mode,
      generatedAt: new Date().toISOString(),
      engine: "pin-siteforge-compiler@0.1.0",
      mapped: { heading: 0, paragraph: 0, image: 0, button: 0, list: 0, group: 0, navigation: 0, customHtml: 0 },
      excluded: [],
      limitations: [
        "Single page only. Sitemap, GitHub and multi-page crawl are not in this build.",
        "Scripts, iframes and event handlers are removed and never executed.",
        "Original CSS is prefixed under .pin-source and enqueued on the public site, not the whole wp-admin.",
        "WordPress Playground visual regression was not run. Do not treat this package as measured 100% parity.",
        "JavaScript interactions, carousels and account-only content are not reconstructed."
      ],
      checks: []
    };

    doc.querySelectorAll("script,noscript,iframe,object,embed,link[rel='preload'][as='script']").forEach(function (node) {
      report.excluded.push(node.tagName.toLowerCase());
      node.remove();
    });
    doc.querySelectorAll("*").forEach(function (node) {
      Array.from(node.attributes || []).forEach(function (attr) {
        if (/^on/i.test(attr.name) || (attr.name === "style" && /expression\s*\(|javascript:/i.test(attr.value))) {
          node.removeAttribute(attr.name);
        }
      });
    });

    var taken = {};
    var media = [];
    images.forEach(function (image) {
      var ext = "bin";
      var type = String(image.contentType || "");
      if (/png/i.test(type)) ext = "png";
      else if (/jpe?g/i.test(type)) ext = "jpg";
      else if (/webp/i.test(type)) ext = "webp";
      else if (/gif/i.test(type)) ext = "gif";
      else if (/svg/i.test(type)) ext = "svg";
      else if (/woff2/i.test(type)) ext = "woff2";
      else if (/woff/i.test(type)) ext = "woff";
      var file = safeFile(image.name || image.url, "asset." + ext);
      if (!/\.[a-z0-9]{1,5}$/i.test(file)) file += "." + ext;
      var path = unique("assets/media/" + file, taken);
      taken[path] = true;
      media.push({ url: image.url, path: path, bytes: image.bytes });
    });

    function localSrc(src) {
      if (!src) return "";
      var abs = src;
      try { if (pageUrl) abs = new URL(src, pageUrl).href; } catch (error) { abs = src; }
      for (var i = 0; i < media.length; i += 1) {
        if (media[i].url === src || media[i].url === abs || media[i].name === src) return media[i].path;
      }
      return "";
    }

    function placeholder(original, kind) {
      if (mode === "clone") return original;
      if (kind === "h1") return name;
      if (kind === "heading") return "Section heading";
      if (kind === "button") return "Learn more";
      return "Replace this text with your own content.";
    }

    var fields = [];

    function heading(level, text, cls) {
      var shown = placeholder(text, level === 1 ? "h1" : "heading");
      fields.push({ id: "heading-" + (fields.length + 1), role: level === 1 ? "headline" : "heading", text: text });
      report.mapped.heading += 1;
      var tag = "h" + level;
      return "<!-- wp:heading {\"level\":" + level + (cls ? ",\"className\":" + JSON.stringify(cls) : "") + "} -->\n<" + tag + " class=\"wp-block-heading" + (cls ? " " + esc(cls) : "") + "\">" + esc(shown) + "</" + tag + ">\n<!-- /wp:heading -->";
    }

    function paragraph(text) {
      fields.push({ id: "text-" + (fields.length + 1), role: "text", text: text });
      report.mapped.paragraph += 1;
      return "<!-- wp:paragraph -->\n<p>" + esc(placeholder(text, "paragraph")) + "</p>\n<!-- /wp:paragraph -->";
    }

    function imageBlock(src, alt) {
      var path = localSrc(src);
      if (!path && !/^https?:/i.test(src || "")) return "";
      report.mapped.image += 1;
      var printed = path ? "<?php echo esc_url( $theme_uri ); ?>/" + path : esc(src);
      return "<!-- wp:image {\"sizeSlug\":\"full\",\"linkDestination\":\"none\"} -->\n<figure class=\"wp-block-image size-full\"><img src=\"" + printed + "\" alt=\"" + esc(alt || "") + "\"/></figure>\n<!-- /wp:image -->";
    }

    function button(href, label) {
      var url = safeUrl(href);
      if (!url) return "";
      report.mapped.button += 1;
      fields.push({ id: "button-" + (fields.length + 1), role: "button", text: label, href: url });
      return "<!-- wp:buttons -->\n<div class=\"wp-block-buttons\"><!-- wp:button -->\n<div class=\"wp-block-button\"><a class=\"wp-block-button__link wp-element-button\" href=\"" + esc(url) + "\">" + esc(placeholder(label || "Continue", "button")) + "</a></div>\n<!-- /wp:button --></div>\n<!-- /wp:buttons -->";
    }

    function listBlock(el) {
      var items = Array.from(el.children).filter(function (child) { return child.tagName === "LI"; }).slice(0, 12);
      if (!items.length) return "";
      report.mapped.list += 1;
      var ordered = el.tagName === "OL";
      var body = items.map(function (item) {
        var text = cleanText(item.textContent).slice(0, 280);
        fields.push({ id: "list-" + (fields.length + 1), role: "list-item", text: text });
        return "<!-- wp:list-item -->\n<li>" + esc(placeholder(text, "paragraph")) + "</li>\n<!-- /wp:list-item -->";
      }).join("\n");
      var tag = ordered ? "ol" : "ul";
      return "<!-- wp:list " + (ordered ? "{\"ordered\":true} " : "") + "-->\n<" + tag + " class=\"wp-block-list\">" + body + "</" + tag + ">\n<!-- /wp:list -->";
    }

    function customHtml(el) {
      var clone = el.cloneNode(true);
      clone.querySelectorAll("script,iframe,object,embed").forEach(function (node) { node.remove(); });
      var html = clone.innerHTML.replace(/on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
      html = html.replace(/javascript:/gi, "");
      if (!cleanText(clone.textContent) && !clone.querySelector("img,svg")) return "";
      if (html.length > 6000) {
        report.limitations.push("A complex region was shortened because it was too large for a Custom HTML block.");
        html = html.slice(0, 6000);
      }
      report.mapped.customHtml += 1;
      return "<!-- wp:html -->\n" + html + "\n<!-- /wp:html -->";
    }

    function className(el) {
      return String(el.className || "").split(/\s+/).filter(function (name) {
        return name && name.length < 40 && !/^(js-|is-active|active$)/.test(name);
      }).slice(0, 4).join(" ");
    }

    function convertElement(el, depth) {
      if (!el || el.nodeType !== 1 || depth > 7) return "";
      var tag = el.tagName;
      if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|IFRAME|OBJECT|EMBED|SVG|FORM|INPUT|TEXTAREA|SELECT)$/.test(tag)) {
        if (tag === "FORM") report.excluded.push("form");
        return "";
      }
      if (/^H[1-6]$/.test(tag)) {
        var h = cleanText(el.textContent).slice(0, 180);
        return h ? heading(Number(tag[1]), h, className(el)) : "";
      }
      if (tag === "P") {
        var p = cleanText(el.textContent).slice(0, 700);
        return p ? paragraph(p) : "";
      }
      if (tag === "IMG") {
        return imageBlock(el.getAttribute("src") || "", el.getAttribute("alt") || "");
      }
      if (tag === "A" && /btn|button|cta/i.test(String(el.className || "") + " " + (el.getAttribute("role") || ""))) {
        return button(el.getAttribute("href") || "", cleanText(el.textContent).slice(0, 80));
      }
      if (tag === "UL" || tag === "OL") return listBlock(el);
      var kids = Array.from(el.children).filter(function (child) { return child.nodeType === 1; });
      if (!kids.length) {
        var loose = cleanText(el.textContent).slice(0, 500);
        if (tag === "A") return button(el.getAttribute("href") || "", loose);
        return loose ? paragraph(loose) : "";
      }
      var columnLike = kids.length >= 2 && kids.length <= 4 && /grid|column|row|cols/i.test(String(el.className || "") + " " + (el.getAttribute("style") || ""));
      var inner = kids.map(function (child) { return convertElement(child, depth + 1); }).filter(Boolean);
      if (!inner.length) return customHtml(el);
      if (columnLike) {
        report.mapped.group += 1;
        return "<!-- wp:columns -->\n<div class=\"wp-block-columns\">" + inner.map(function (block) {
          return "<!-- wp:column -->\n<div class=\"wp-block-column\">\n" + block + "\n</div>\n<!-- /wp:column -->";
        }).join("\n") + "</div>\n<!-- /wp:columns -->";
      }
      report.mapped.group += 1;
      var cls = className(el);
      return "<!-- wp:group {\"className\":" + JSON.stringify(("pin-region " + cls).trim()) + ",\"layout\":{\"type\":\"constrained\"}} -->\n<div class=\"wp-block-group pin-region" + (cls ? " " + esc(cls) : "") + "\">\n" + inner.join("\n") + "\n</div>\n<!-- /wp:group -->";
    }

    function regionBlocks(el) {
      if (!el) return "";
      return Array.from(el.children).map(function (child) { return convertElement(child, 0); }).filter(Boolean).join("\n");
    }

    var headerEl = findRegion(doc, "header");
    var footerEl = findRegion(doc, "footer");
    var nav = doc.querySelector("nav") || (headerEl && headerEl.querySelector("nav"));
    var links = [];
    if (nav) {
      Array.from(nav.querySelectorAll("a[href]")).forEach(function (anchor) {
        var label = cleanText(anchor.textContent).slice(0, 40);
        var href = safeUrl(anchor.getAttribute("href") || "");
        if (!label || !href || links.some(function (link) { return link.label === label; })) return;
        links.push({ label: label, href: href });
      });
    }
    links = links.slice(0, 8);
    if (links.length) report.mapped.navigation += 1;

    var main = doc.querySelector("main") || doc.body;
    var mainBlocks = regionBlocks(main) || paragraph(cleanText(doc.body ? doc.body.textContent : "").slice(0, 400) || name);
    var headerInner = regionBlocks(headerEl);
    var footerInner = regionBlocks(footerEl);
    var navMarkup = links.length
      ? "<!-- wp:navigation {\"overlayMenu\":\"mobile\",\"layout\":{\"type\":\"flex\",\"justifyContent\":\"right\"}} -->\n" + links.map(function (link) {
          return "<!-- wp:navigation-link {\"label\":" + JSON.stringify(link.label) + ",\"url\":" + JSON.stringify(link.href) + ",\"kind\":\"custom\",\"isTopLevelLink\":true} /-->";
        }).join("\n") + "\n<!-- /wp:navigation -->"
      : "";

    function pattern(title, patternSlug, body) {
      return "<?php\n/**\n * Title: " + title + "\n * Slug: " + slug + "/" + patternSlug + "\n * Categories: featured\n * Inserter: true\n */\n$theme_uri = get_theme_file_uri();\n?>\n" + body + "\n";
    }

    var headerPattern = pattern("Header", "header", "<!-- wp:group {\"tagName\":\"header\",\"align\":\"full\",\"className\":\"pin-source pin-header\",\"layout\":{\"type\":\"flex\",\"justifyContent\":\"space-between\"}} -->\n<header class=\"wp-block-group alignfull pin-source pin-header\">\n<!-- wp:site-title {\"level\":0} /-->\n" + (navMarkup || headerInner || "") + "\n</header>\n<!-- /wp:group -->");
    var footerPattern = pattern("Footer", "footer", "<!-- wp:group {\"tagName\":\"footer\",\"align\":\"full\",\"className\":\"pin-source pin-footer\",\"layout\":{\"type\":\"constrained\"}} -->\n<footer class=\"wp-block-group alignfull pin-source pin-footer\">\n" + (footerInner || "<!-- wp:paragraph --><p>© " + esc(name) + "</p><!-- /wp:paragraph -->") + "\n</footer>\n<!-- /wp:group -->");
    var frontPattern = pattern("Front page", "front-page", "<!-- wp:group {\"tagName\":\"main\",\"align\":\"full\",\"className\":\"pin-source\",\"layout\":{\"type\":\"default\"}} -->\n<main class=\"wp-block-group alignfull pin-source\">\n" + mainBlocks + "\n</main>\n<!-- /wp:group -->");

    var part = function (patternSlug) {
      return "<!-- wp:pattern {\"slug\":\"" + slug + "/" + patternSlug + "\"} /-->\n";
    };
    var shell = function (inner) {
      return part("header") + inner + part("footer");
    };

    var prefixed = prefixCss(css);
    var fontFamily = fonts[0] ? "'" + fonts[0].replace(/'/g, "") + "', sans-serif" : "sans-serif";
    var themeJson = {
      $schema: "https://schemas.wp.org/wp/6.7/theme.json",
      version: 3,
      settings: {
        appearanceTools: true,
        layout: { contentSize: "760px", wideSize: "1120px", allowEditing: true },
        color: {
          custom: true,
          palette: [
            { slug: "brand", name: "Brand", color: primary },
            { slug: "accent", name: "Accent", color: secondary },
            { slug: "ink", name: "Ink", color: ink },
            { slug: "paper", name: "Paper", color: paper },
            { slug: "muted", name: "Muted", color: "#667085" }
          ]
        },
        typography: {
          fluid: true,
          fontFamilies: [
            { slug: "body", name: fonts[0] || "Body", fontFamily: fontFamily },
            { slug: "system", name: "System", fontFamily: "sans-serif" }
          ]
        },
        spacing: { units: ["px", "em", "rem", "%", "vw", "vh"], blockGap: true, margin: true, padding: true }
      },
      styles: {
        color: { background: paper, text: ink },
        typography: { fontFamily: "var(--wp--preset--font-family--body)", lineHeight: "1.6" },
        elements: {
          heading: { typography: { fontWeight: "650", lineHeight: "1.15" } },
          link: { color: { text: primary } },
          button: { color: { background: primary, text: "#ffffff" }, border: { radius: "8px" } }
        }
      },
      templateParts: [
        { name: "header", title: "Header", area: "header" },
        { name: "footer", title: "Footer", area: "footer" }
      ]
    };

    var styleHeader = [
      "/*",
      "Theme Name: " + name,
      "Theme URI: " + (theme.themeUrl || ""),
      "Author: " + author,
      "Author URI: " + (theme.authorUrl || ""),
      "Description: " + description.replace(/\*\//g, ""),
      "Version: " + version,
      "Requires at least: 6.6",
      "Tested up to: 6.7",
      "Requires PHP: 7.4",
      "Text Domain: " + textDomain,
      "Tags: " + (tags.join(", ") || "full-site-editing"),
      "License: " + license,
      "License URI: https://www.gnu.org/licenses/gpl-2.0.html",
      "*/",
      ""
    ].join("\n");

    var functionsPhp = "<?php\n/**\n * " + name + " functions.\n *\n * @package " + slug + "\n */\n\nif ( ! defined( 'ABSPATH' ) ) {\n\texit;\n}\n\nfunction " + prefix + "_setup() {\n\tadd_theme_support( 'wp-block-styles' );\n\tadd_theme_support( 'editor-styles' );\n\tadd_theme_support( 'responsive-embeds' );\n\tadd_editor_style( 'assets/css/editor.css' );\n}\nadd_action( 'after_setup_theme', '" + prefix + "_setup' );\n\nfunction " + prefix + "_assets() {\n\twp_enqueue_style( '" + prefix + "_source', get_theme_file_uri( 'assets/css/source.css' ), array(), wp_get_theme()->get( 'Version' ) );\n}\nadd_action( 'wp_enqueue_scripts', '" + prefix + "_assets' );\n";

    var editorCss = ".editor-styles-wrapper { background: " + paper + "; color: " + ink + "; }\n.editor-styles-wrapper img { max-width: 100%; height: auto; }\n.editor-styles-wrapper .pin-source { overflow-wrap: anywhere; }\n";
    var baseCss = ".pin-source { box-sizing: border-box; }\n.pin-source *, .pin-source *::before, .pin-source *::after { box-sizing: border-box; }\n.pin-source img, .wp-site-blocks img { max-width: 100%; height: auto; }\n.wp-site-blocks { min-height: 100vh; }\n.pin-header, .pin-footer { padding: 1rem 1.25rem; }\n" + prefixed.css;

    var readme = "=== " + name + " ===\n\nContributors: " + author + "\nRequires at least: 6.6\nTested up to: 6.7\nRequires PHP: 7.4\nStable tag: " + version + "\nLicense: " + license + "\n\n== Description ==\n\n" + description + "\n\nGenerated by PIN SiteForge. The front-page template holds the converted layout. Page and single templates use Post Content so replacement copy does not require rebuilding the theme.\n\n== Installation ==\n\n1. Upload the theme ZIP in Appearance → Themes → Add New → Upload Theme.\n2. Activate the theme.\n3. Open Appearance → Editor to edit the header, footer and front page.\n4. Import website-content.xml only if you want the extracted copy as a separate page.\n\n== Known limits ==\n\nThis build converts one public page. It does not claim measured visual parity. Scripts were removed.\n";

    var query = "<!-- wp:group {\"tagName\":\"main\",\"layout\":{\"type\":\"constrained\"}} -->\n<main class=\"wp-block-group\"><!-- wp:query {\"queryId\":1,\"query\":{\"perPage\":10,\"pages\":0,\"offset\":0,\"postType\":\"post\",\"order\":\"desc\",\"orderBy\":\"date\"}} -->\n<div class=\"wp-block-query\"><!-- wp:post-template -->\n<!-- wp:post-title {\"isLink\":true} /-->\n<!-- wp:post-excerpt /-->\n<!-- /wp:post-template -->\n<!-- wp:query-pagination -->\n<!-- wp:query-pagination-previous /-->\n<!-- wp:query-pagination-numbers /-->\n<!-- wp:query-pagination-next /-->\n<!-- /wp:query-pagination --></div>\n<!-- /wp:query --></main>\n<!-- /wp:group -->";
    var postContent = "<!-- wp:group {\"tagName\":\"main\",\"layout\":{\"type\":\"constrained\"}} -->\n<main class=\"wp-block-group\"><!-- wp:post-title {\"level\":1} /-->\n<!-- wp:post-content {\"layout\":{\"type\":\"constrained\"}} /--></main>\n<!-- /wp:group -->";
    var notFound = "<!-- wp:group {\"tagName\":\"main\",\"layout\":{\"type\":\"constrained\"}} -->\n<main class=\"wp-block-group\"><!-- wp:heading {\"level\":1} -->\n<h1 class=\"wp-block-heading\">Page not found</h1>\n<!-- /wp:heading --><!-- wp:paragraph -->\n<p>The page you requested is not available.</p>\n<!-- /wp:paragraph --></main>\n<!-- /wp:group -->";

    var contentBlocks = mainBlocks.replace(/<\?php echo esc_url\( \$theme_uri \); \?>/g, "{{theme_uri}}");
    var wxr = "<?xml version=\"1.0\" encoding=\"UTF-8\" ?>\n<rss version=\"2.0\" xmlns:excerpt=\"http://wordpress.org/export/1.2/excerpt/\" xmlns:content=\"http://purl.org/rss/1.0/modules/content/\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:wp=\"http://wordpress.org/export/1.2/\">\n<channel>\n<title>" + esc(name) + "</title>\n<wp:wxr_version>1.2</wp:wxr_version>\n<item>\n<title>" + esc(name) + "</title>\n<dc:creator><![CDATA[admin]]></dc:creator>\n<content:encoded><![CDATA[" + contentBlocks + "]]></content:encoded>\n<wp:post_type>page</wp:post_type>\n<wp:status>publish</wp:status>\n<wp:post_name>" + slug + "-source</wp:post_name>\n</item>\n</channel>\n</rss>\n";

    var design = {
      source: pageUrl,
      mode: mode,
      colors: themeJson.settings.color.palette,
      detectedColors: colors,
      fonts: fonts,
      layout: themeJson.settings.layout,
      navigation: links,
      notes: "Palette is extracted from the source CSS and inline color values. It is a reusable token set, not a pixel sample."
    };

    var files = [
      { path: slug + "/style.css", text: styleHeader },
      { path: slug + "/theme.json", text: JSON.stringify(themeJson, null, 2) },
      { path: slug + "/functions.php", text: functionsPhp },
      { path: slug + "/README.txt", text: readme },
      { path: slug + "/parts/header.html", text: part("header") },
      { path: slug + "/parts/footer.html", text: part("footer") },
      { path: slug + "/templates/index.html", text: shell(query) },
      { path: slug + "/templates/home.html", text: shell(query) },
      { path: slug + "/templates/front-page.html", text: shell(part("front-page")) },
      { path: slug + "/templates/page.html", text: shell(postContent) },
      { path: slug + "/templates/single.html", text: shell(postContent) },
      { path: slug + "/templates/archive.html", text: shell(query) },
      { path: slug + "/templates/search.html", text: shell(query) },
      { path: slug + "/templates/404.html", text: shell(notFound) },
      { path: slug + "/patterns/header.php", text: headerPattern },
      { path: slug + "/patterns/footer.php", text: footerPattern },
      { path: slug + "/patterns/front-page.php", text: frontPattern },
      { path: slug + "/assets/css/source.css", text: baseCss },
      { path: slug + "/assets/css/editor.css", text: editorCss },
      { path: slug + "/assets/css/style.css", text: "/* Extra theme hooks. Source rules live in source.css. */\n" }
    ];
    media.forEach(function (item) {
      if (item.bytes) files.push({ path: slug + "/" + item.path, bytes: item.bytes });
    });

    report.checks = [
      { id: "style.css", pass: styleHeader.indexOf("Theme Name:") === 3 || styleHeader.indexOf("Theme Name:") > 0 },
      { id: "theme.json", pass: themeJson.version === 3 },
      { id: "templates/index.html", pass: true },
      { id: "native-blocks", pass: report.mapped.heading + report.mapped.paragraph + report.mapped.image > 0 },
      { id: "scripts-removed", pass: true },
      { id: "visual-regression", pass: false, note: "Not measured in this build." }
    ];

    return {
      slug: slug,
      version: version,
      filename: slug + "-" + version + ".zip",
      files: files,
      report: report,
      design: design,
      content: { mode: mode, title: name, fields: fields, navigation: links },
      wxr: wxr,
      readme: readme
    };
  }

  var api = { compileTheme: compileTheme, slugify: slugify, screenshotPng: screenshotPng, prefixCss: prefixCss };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SiteForge = api;
})(typeof window !== "undefined" ? window : globalThis);

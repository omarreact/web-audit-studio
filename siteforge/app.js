(function () {
  var urlForm = document.getElementById("urlForm");
  var zipForm = document.getElementById("zipForm");
  var errorBox = document.getElementById("error");
  var work = document.getElementById("work");
  var status = document.getElementById("status");
  var bar = document.getElementById("bar");
  var meta = document.getElementById("meta");
  var done = document.getElementById("done");
  var source = null;
  var result = null;
  var themeZip = null;
  var packZip = null;

  if (localStorage.getItem("siteforge-theme") === "light") document.documentElement.classList.add("light");
  document.getElementById("theme").addEventListener("click", function () {
    var light = document.documentElement.classList.toggle("light");
    localStorage.setItem("siteforge-theme", light ? "light" : "dark");
  });

  document.querySelectorAll(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (node) { node.classList.remove("on"); });
      tab.classList.add("on");
      var zip = tab.getAttribute("data-tab") === "zip";
      urlForm.hidden = zip;
      zipForm.hidden = !zip;
    });
  });

  urlForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var raw = document.getElementById("url").value.trim();
    var pageUrl;
    try { pageUrl = new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw); }
    catch (error) { return fail("লিংকটি ঠিক নয়"); }
    if (pageUrl.protocol !== "http:" && pageUrl.protocol !== "https:") return fail("শুধু http বা https চলবে");
    analyzeUrl(pageUrl.href);
  });

  document.getElementById("zip").addEventListener("change", function (event) {
    var file = event.target.files && event.target.files[0];
    if (file) analyzeZip(file);
  });

  document.getElementById("themeName").addEventListener("input", function (event) {
    var slug = document.getElementById("themeSlug");
    if (!slug.dataset.touched) slug.value = SiteForge.slugify(event.target.value);
  });
  document.getElementById("themeSlug").addEventListener("input", function (event) {
    event.target.dataset.touched = "1";
  });

  meta.addEventListener("submit", function (event) {
    event.preventDefault();
    generate();
  });
  document.getElementById("htmlZip").addEventListener("click", saveHtmlZip);
  document.getElementById("downloadTheme").addEventListener("click", function () {
    if (themeZip) download(themeZip, result.filename);
  });
  document.getElementById("downloadPack").addEventListener("click", function () {
    if (packZip) download(packZip, result.slug + "-" + result.version + "-package.zip");
  });

  function fail(message) {
    errorBox.hidden = false;
    errorBox.textContent = message;
  }

  function progress(text, percent) {
    work.hidden = false;
    status.textContent = text;
    bar.style.width = percent + "%";
  }

  function analyzeUrl(pageUrl) {
    errorBox.hidden = true;
    done.hidden = true;
    meta.hidden = false;
    progress("পেজ পড়া হচ্ছে", 15);
    fetch("/api/inspect?url=" + encodeURIComponent(pageUrl))
      .then(function (response) { return response.json().then(function (data) { return { response: response, data: data }; }); })
      .then(function (payload) {
        if (!payload.response.ok) throw new Error(payload.data.error || "পেজটি আনা যায়নি");
        if (payload.data.status >= 400) throw new Error("সাইটটি HTTP " + payload.data.status + " দিয়েছে");
        return collectRemote(payload.data.html, payload.data.finalUrl || pageUrl);
      })
      .then(showSource)
      .catch(function (error) { fail(error.message || "বিশ্লেষণ হয়নি"); });
  }

  function collectRemote(html, pageUrl) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var urls = [];
    var seen = {};
    function add(raw) {
      if (!raw || urls.length >= 30) return;
      try {
        var abs = new URL(raw, pageUrl).href;
        if (seen[abs] || !/^https?:/i.test(abs)) return;
        seen[abs] = true;
        urls.push(abs);
      } catch (error) { return; }
    }
    doc.querySelectorAll("link[rel='stylesheet'][href], img[src]").forEach(function (node) {
      add(node.getAttribute("href") || node.getAttribute("src"));
    });
    progress("অ্যাসেট আনা হচ্ছে", 40);
    var css = "";
    var images = [];
    var index = 0;
    function next() {
      var item = urls[index++];
      if (!item) return Promise.resolve({ html: html, pageUrl: pageUrl, css: css, images: images, doc: doc });
      return fetch("/api/asset?url=" + encodeURIComponent(item))
        .then(function (response) {
          if (!response.ok) return;
          var type = response.headers.get("content-type") || "";
          var finalUrl = response.headers.get("x-final-url") || item;
          return response.arrayBuffer().then(function (buffer) {
            if (!buffer.byteLength || buffer.byteLength > 1500000) return;
            if (/text\/css/i.test(type)) css += "\n" + new TextDecoder().decode(buffer);
            else if (/^image\//i.test(type) || /svg/i.test(type)) images.push({ url: item, name: finalUrl, contentType: type, bytes: buffer });
          });
        })
        .catch(function () {})
        .then(function () {
          progress("অ্যাসেট আনা হচ্ছে", 40 + Math.round((index / urls.length) * 40));
          return next();
        });
    }
    return next();
  }

  function analyzeZip(file) {
    errorBox.hidden = true;
    done.hidden = true;
    meta.hidden = false;
    progress("জিপ পড়া হচ্ছে", 20);
    if (file.size > 20 * 1024 * 1024) return fail("জিপ ২০ মেগাবাইটের বেশি");
    JSZip.loadAsync(file).then(function (zip) {
      var htmlName = Object.keys(zip.files).find(function (name) { return /(^|\/)index\.html?$/i.test(name); });
      if (!htmlName) throw new Error("index.html পাওয়া যায়নি");
      var root = htmlName.split("/").slice(0, -1).join("/");
      return zip.file(htmlName).async("string").then(function (html) {
        var css = "";
        var images = [];
        var names = Object.keys(zip.files).filter(function (name) {
          if (zip.files[name].dir || name.indexOf("..") !== -1 || name.startsWith("/")) return false;
          return name.startsWith(root);
        }).slice(0, 80);
        var pending = names.map(function (name) {
          var lower = name.toLowerCase();
          if (/\.css$/.test(lower)) return zip.file(name).async("string").then(function (text) { css += "\n" + text; });
          if (/\.(png|jpe?g|gif|webp|svg)$/.test(lower)) {
            return zip.file(name).async("arraybuffer").then(function (bytes) {
              images.push({ url: name.slice(root.length + (root ? 1 : 0)), name: name, contentType: lower.endsWith("svg") ? "image/svg+xml" : "image/" + lower.split(".").pop(), bytes: bytes });
            });
          }
          return Promise.resolve();
        });
        return Promise.all(pending).then(function () {
          return { html: html, pageUrl: "", css: css, images: images };
        });
      });
    }).then(showSource).catch(function (error) { fail(error.message || "জিপ পড়া যায়নি"); });
  }

  function showSource(next) {
    source = next;
    var doc = new DOMParser().parseFromString(next.html, "text/html");
    var title = (doc.querySelector("title") && doc.querySelector("title").textContent.trim()) || "Site Theme";
    document.getElementById("themeName").value = title.slice(0, 60);
    document.getElementById("themeSlug").value = SiteForge.slugify(title);
    delete document.getElementById("themeSlug").dataset.touched;
    document.getElementById("themeAuthor").value = "Site Owner";
    document.getElementById("themeDesc").value = "Block theme converted from " + (next.pageUrl || "an uploaded HTML snapshot") + ".";
    var colors = SiteForge.prefixCss(next.css);
    var swatches = document.getElementById("swatches");
    swatches.innerHTML = "";
    (next.css.match(/#[0-9a-fA-F]{6}\b/g) || []).slice(0, 6).forEach(function (color) {
      var chip = document.createElement("i");
      chip.style.background = color;
      chip.title = color;
      swatches.appendChild(chip);
    });
    progress("তথ্য বসান, তারপর থিম তৈরি করুন। CSS নিয়ম: " + (colors.css ? "পাওয়া গেছে" : "কম"), 100);
  }

  function themeInput() {
    return {
      name: document.getElementById("themeName").value,
      slug: document.getElementById("themeSlug").value,
      version: document.getElementById("themeVersion").value,
      author: document.getElementById("themeAuthor").value,
      authorUrl: document.getElementById("authorUrl").value,
      themeUrl: document.getElementById("themeUrl").value,
      description: document.getElementById("themeDesc").value,
      primary: document.getElementById("primary").value,
      secondary: document.getElementById("secondary").value,
      mode: (meta.querySelector("input[name=mode]:checked") || {}).value
    };
  }

  function generate() {
    if (!source) return fail("আগে একটি সাইট দিন");
    progress("থিম কম্পাইল হচ্ছে", 80);
    var doc = new DOMParser().parseFromString(source.html, "text/html");
    Promise.resolve(SiteForge.compileTheme(doc, {
      pageUrl: source.pageUrl,
      css: source.css,
      images: source.images,
      theme: themeInput()
    })).then(function (compiled) {
      return SiteForge.screenshotPng().then(function (png) {
        if (png) compiled.files.push({ path: compiled.slug + "/screenshot.png", bytes: png });
        result = compiled;
        return zipTheme(compiled);
      });
    }).then(function (zips) {
      themeZip = zips.theme;
      packZip = zips.pack;
      meta.hidden = true;
      done.hidden = false;
      document.getElementById("doneTitle").textContent = result.files[0] ? themeInput().name : "থিম তৈরি হয়েছে";
      var mapped = result.report.mapped;
      document.getElementById("doneDetail").textContent = mapped.heading + " হেডিং · " + mapped.paragraph + " অনুচ্ছেদ · " + mapped.image + " ছবি · " + mapped.customHtml + " কাস্টম HTML। ভিজ্যুয়াল স্কোর মাপা হয়নি।";
      var list = document.getElementById("checks");
      list.innerHTML = "";
      result.report.checks.forEach(function (check) {
        var item = document.createElement("li");
        item.textContent = (check.pass ? "ঠিক আছে" : "বাকি") + " — " + check.id + (check.note ? " (" + check.note + ")" : "");
        list.appendChild(item);
      });
      progress("তৈরি", 100);
    }).catch(function (error) { fail(error.message || "থিম তৈরি হয়নি"); });
  }

  function zipTheme(compiled) {
    var theme = new JSZip();
    compiled.files.forEach(function (file) { theme.file(file.path, file.text != null ? file.text : file.bytes); });
    var pack = new JSZip();
    return theme.generateAsync({ type: "blob" }).then(function (blob) {
      pack.file(compiled.filename, blob);
      pack.file("website-content.json", JSON.stringify(compiled.content, null, 2));
      pack.file("website-content.xml", compiled.wxr);
      pack.file("design-system.json", JSON.stringify(compiled.design, null, 2));
      pack.file("conversion-report.json", JSON.stringify(compiled.report, null, 2));
      pack.file("README.txt", compiled.readme);
      return pack.generateAsync({ type: "blob" }).then(function (packBlob) {
        return { theme: blob, pack: packBlob };
      });
    });
  }

  function saveHtmlZip() {
    if (!source || typeof JSZip !== "function") return;
    var zip = new JSZip();
    zip.file("index.html", source.html);
    zip.file("css/source.css", source.css || "/* no stylesheet captured */\n");
    (source.images || []).forEach(function (image, index) {
      zip.file("images/" + (index + 1) + "-" + String(image.name || "image").split("/").pop(), image.bytes);
    });
    zip.generateAsync({ type: "blob" }).then(function (blob) { download(blob, "website.html.zip"); });
  }

  function download(blob, filename) {
    var href = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(href); }, 15000);
  }
})();

import { chromium } from "playwright";
import fs from "node:fs";

const html = `<!doctype html><html><head><title>Acme Studio</title></head><body>
<header><nav><a href="/about">About</a><a href="/work">Work</a></nav></header>
<main>
  <h1>Acme Studio</h1>
  <p>We build tools for teams that ship.</p>
  <a class="btn" href="https://example.com/start">Start</a>
  <img src="https://example.com/a.png" alt="mark">
  <ul><li>Fast</li><li>Editable</li></ul>
</main>
<footer><p>Footer note</p></footer>
<script>alert(1)</script>
</body></html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.addScriptTag({ path: new URL("./compile.js", import.meta.url).pathname });
const compiled = await page.evaluate(async (html) => {
  if (SiteForge.slugify("My Business") !== "my-business") throw new Error("slug");
  if (!SiteForge.prefixCss("h1{color:#fff}").css.includes(".pin-source h1")) throw new Error("prefix");
  if (SiteForge.prefixCss("@font-face{font-family:A}").css.includes(".pin-source @")) throw new Error("font-face prefixed");
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out = SiteForge.compileTheme(doc, {
    pageUrl: "https://example.com/",
    css: "body{color:#112233;font-family:Georgia,serif} h1{color:#112233} .hero{padding:12px}",
    images: [{ url: "https://example.com/a.png", name: "a.png", contentType: "image/png", bytes: new Uint8Array([1, 2, 3]).buffer }],
    theme: { name: "My Business", slug: "my-business", author: "Ada Lovelace", version: "0.0.1", mode: "reusable", primary: "#1f6f6a" }
  });
  const text = {};
  out.files.forEach((file) => { if (file.text) text[file.path] = file.text; });
  return { slug: out.slug, report: out.report, text, content: out.content, design: out.design };
}, html);
await browser.close();

const style = compiled.text["my-business/style.css"];
const theme = JSON.parse(compiled.text["my-business/theme.json"]);
const front = compiled.text["my-business/patterns/front-page.php"];
const fn = compiled.text["my-business/functions.php"];
const index = compiled.text["my-business/templates/index.html"];
if (!style.startsWith("/*\nTheme Name: My Business")) throw new Error("style header");
if (theme.version !== 3 || theme.settings.color.palette[0].color !== "#1f6f6a") throw new Error("theme.json");
if (!front.includes("wp:heading") || !front.includes("My Business")) throw new Error("front pattern");
if (front.includes("Acme Studio") || front.includes("<script")) throw new Error("source leaked");
if (!front.includes("wp:image") || !front.includes("assets/media/")) throw new Error("image");
if (!index.includes("wp:query") || !index.includes("wp:pattern")) throw new Error("index");
if (/eval\s*\(|shell_exec|base64_decode/.test(fn)) throw new Error("unsafe php");
if (compiled.report.mapped.heading < 1 || compiled.report.mapped.navigation < 1) throw new Error("mapping " + JSON.stringify(compiled.report.mapped));
if (compiled.report.checks.some((check) => check.id === "visual-regression" && check.pass)) throw new Error("false parity claim");
const required = ["style.css", "theme.json", "functions.php", "templates/index.html", "templates/front-page.html", "parts/header.html", "patterns/front-page.php"];
required.forEach((path) => {
  if (!compiled.text["my-business/" + path]) throw new Error("missing " + path);
});
fs.mkdirSync("/tmp/siteforge-out", { recursive: true });
fs.writeFileSync("/tmp/siteforge-out/report.json", JSON.stringify(compiled.report, null, 2));
console.log("compile ok", compiled.report.mapped);

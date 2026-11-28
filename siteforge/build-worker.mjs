import fs from "node:fs";
import path from "node:path";

const dir = path.dirname(new URL(import.meta.url).pathname);
const read = (name) => fs.readFileSync(path.join(dir, name), "utf8");
const runtime = fs.readFileSync(path.join(dir, "worker-runtime.js"), "utf8");
const worker =
  "const HTML = " + JSON.stringify(read("index.html")) + ";\n" +
  "const CSS = " + JSON.stringify(read("app.css")) + ";\n" +
  "const APP = " + JSON.stringify(read("app.js")) + ";\n" +
  "const COMPILE = " + JSON.stringify(read("compile.js")) + ";\n" +
  "const ICON = " + JSON.stringify(read("favicon.svg")) + ";\n\n" +
  runtime;
const out = "/tmp/siteforge-worker.js";
fs.writeFileSync(out, worker);
console.log(out, worker.length);

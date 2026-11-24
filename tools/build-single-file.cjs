// Regenerate the portable version from the same UI and modules as index.html.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const localScripts = new Set([
  'vendor/jszip.min.js','assets/ai-intelligence.js','assets/html-converter.js',
  'assets/next-converter.js','assets/app.js'
]);
let result = source.replace(/<script src="([^"]+)"(?: defer)?><\/script>/g, (tag, file) => {
  if (!localScripts.has(file)) return tag;
  return '<script>\n' + fs.readFileSync(path.join(root, file), 'utf8').replace(/<\/script/gi, '<\\/script') + '\n</script>';
}).replace('<link rel="stylesheet" href="assets/app.css">',
  '<style>\n' + fs.readFileSync(path.join(root, 'assets/app.css'), 'utf8').replace(/<\/style/gi, '<\\/style') + '\n</style>');
if (/src="(?:assets|vendor)\//.test(result) || /href="assets\/app.css"/.test(result)) {
  throw Error('A local application dependency was not embedded');
}
const target = path.join(root, 'single-file.html');
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8') !== result) throw Error('single-file.html is stale; run node tools/build-single-file.cjs');
  console.log('PASS: portable single-file matches source');
} else {
  fs.writeFileSync(target, result);
  console.log('Updated single-file.html');
}

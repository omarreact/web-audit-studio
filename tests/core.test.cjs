/* Deterministic offline assertions for crawler utilities and framework exporters. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const JSZip=require('../vendor/jszip.min.js');
const source=fs.readFileSync(path.join(__dirname,'../assets/app.js'),'utf8');
let code=source.slice(source.indexOf('const $='),source.indexOf("$('scanBtn').addEventListener"));
code+='\nglobalThis.api={state,safePath,nameFromUrl,relative,replaceCapturedUrls,scriptAssets,cssAssets,scanReport,addFile,preparedFiles,buildFramework,downloadFormat,captureAsset};';
const el=()=>({value:'',checked:true,style:{},setAttribute(){},classList:{add(){},remove(){}},getAttribute(){return ''},innerHTML:'',textContent:''});
const nodes={},document={getElementById(id){return nodes[id]??(nodes[id]=el())},querySelector(){return el()}};
class DOMParser {parseFromString(html,type){return {title:(html.match(/<title>(.*?)<\/title>/s)||[])[1]||'Untitled',body:{innerHTML:(html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)||[])[1]||html},documentElement:{outerHTML:html},querySelectorAll(){return []}};}}
const context=vm.createContext({document,window:{JSZip},JSZip,TextEncoder,TextDecoder,URL,Headers,Response,DOMParser,console,Blob,fetch,AbortController,DOMException,setTimeout,clearTimeout,encodeURIComponent,decodeURIComponent});
vm.runInContext(code,context,{filename:'app.js'});
const a=context.api;
const includes=(arr,item)=>assert.ok(arr.includes(item),item+' missing from '+arr.join(','));
assert.equal(a.safePath('../foo/../../x.html'),'x.html');
assert.equal(a.relative('about/index.html','assets/style.css'),'../assets/style.css');
assert.equal(a.nameFromUrl('https://example.com/about/',true),'about/index.html');
a.state.origin='https://example.com';
includes(a.scriptAssets('import "./chunk.js";','https://example.com/app.js'),'https://example.com/chunk.js');
includes(a.scriptAssets('import x from "./helper.js";','https://example.com/app.js'),'https://example.com/helper.js');
includes(a.scriptAssets('import("./dynamic.js");','https://example.com/app.js'),'https://example.com/dynamic.js');
includes(a.cssAssets('@import "./extra.css"; h1{background:url("/hero.svg")}', 'https://example.com/assets/main.css'),'https://example.com/assets/extra.css');
a.state.root='https://example.com/';
a.state.started=new Date().toISOString();
a.addFile('index.html','<!doctype html><html><head><title>Unit Fixture</title></head><body><h1>Hello</h1><img src="/logo.svg"><a href="/about/">About</a></body></html>',{url:'https://example.com/',type:'text/html'});
a.addFile('about/index.html','<!doctype html><html><head><title>About</title></head><body><h1>About page</h1></body></html>',{url:'https://example.com/about/',type:'text/html'});
a.addFile('logo.svg','<svg></svg>',{url:'https://example.com/logo.svg',type:'image/svg+xml'});
a.addFile('assets/site.css','h1{background:url("/logo.svg")}',{url:'https://example.com/assets/site.css',type:'text/css'});
a.state.pages.set('https://example.com/',{path:'index.html',depth:0,status:'success'});
a.state.pages.set('https://example.com/about/',{path:'about/index.html',depth:1,status:'success'});
a.state.assets.set('https://example.com/logo.svg',{path:'logo.svg',status:'success'});
a.state.assets.set('https://example.com/assets/site.css',{path:'assets/site.css',status:'success'});
const prepared=a.preparedFiles();
assert.ok(new TextDecoder().decode(prepared.get('index.html')).includes('src="logo.svg"'));
assert.ok(new TextDecoder().decode(prepared.get('index.html')).includes('href="about/index.html"'));
assert.ok(new TextDecoder().decode(prepared.get('assets/site.css')).includes('url("../logo.svg")'));
(async()=>{
 const expectations={
 wordpress:['style.css','theme.json','functions.php','templates/index.html','templates/front-page.html','parts/header.html','parts/footer.html','assets/site/index.html'],
 next:['app/page.tsx','app/layout.tsx','app/globals.css','public/site/index.html','package.json'],
 react:['src/main.jsx','src/App.jsx','src/style.css','vite.config.js','public/site/index.html'],
 angular:['angular.json','src/main.ts','tsconfig.json','public/site/index.html'],
 astro:['src/pages/index.astro','astro.config.mjs','public/site/index.html'],
 nuxt:['app.vue','nuxt.config.ts','public/site/index.html']
 };
 for(const [id,files] of Object.entries(expectations)){
  const zip=new JSZip();a.buildFramework(zip,id,prepared,'index.html');
  const buf=await zip.generateAsync({type:'nodebuffer'});const loaded=await JSZip.loadAsync(buf);
  const names=Object.keys(loaded.files);for(const file of files)includes(names,file);
  const manifest=JSON.parse(await loaded.file('package.json')?.async('string')||'{}');
  if(id!=='wordpress')assert.ok(manifest.scripts?.build,id+' missing build script');
  if(id==='wordpress')assert.match(await loaded.file('functions.php').async('string'),/wp_enqueue_style/);
  if(id==='angular')assert.ok(JSON.parse(await loaded.file('angular.json').async('string')).projects.migrated);
 }
 const responses={
  'https://example.com/bundle.js':{ct:'text/javascript',value:'import "./chunk.js";'},
  'https://example.com/chunk.js':{ct:'text/javascript',value:'export const x=2;'},
  'https://example.com/main.css':{ct:'text/css',value:'@import "./extra.css";'},
  'https://example.com/extra.css':{ct:'text/css',value:'body{margin:0}'}
 };
 context.fetch=async u=>{const r=responses[u];if(!r)return new Response('bad',{status:404});const o=new Response(r.value,{headers:{'Content-Type':r.ct}});Object.defineProperty(o,'url',{value:u});return o};
 await a.captureAsset('https://example.com/bundle.js',new AbortController().signal);
 await a.captureAsset('https://example.com/main.css',new AbortController().signal);
 assert.ok(a.state.files.has('chunk.js'),'JS import file was not captured');
 assert.ok(a.state.files.has('extra.css'),'CSS import file was not captured');
 assert.equal(a.scanReport().version,'2.0.0');
 console.log('PASS: path safety / URL rewriting / CSS & JS imports / six framework ZIP generators');
})().catch(e=>{console.error(e);process.exitCode=1});


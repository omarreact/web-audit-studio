/* Web Audit Studio HTML safe-static adapter: deterministic browser conversion. */
(function(root,factory){const a=factory();if(typeof module==='object'&&module.exports)module.exports=a;else root.WebAuditHTMLConverter=a;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='1.0.0',encoder=new TextEncoder(),decoder=new TextDecoder();
const staticAsset=/\.(?:css|png|jpe?g|gif|webp|avif|ico|svg|woff2?|ttf|otf|eot|mp4|webm|og[gv]|mp3|wav|pdf|webmanifest|txt|xml|json)$/i;
const executable=/\.(?:js|mjs|cjs|jsx|ts|tsx|php|py|rb|sh|map|wasm)$/i;
function pathOK(v){return typeof v==='string'&&v.length>0&&!v.startsWith('/')&&!v.includes('\\')&&!/[\x00-\x1f]/.test(v)&&v.split('/').every(x=>x&&x!=='.'&&x!=='..');}
function badURL(v){return /^(?:javascript|vbscript|data|blob|file):/i.test(String(v||'').trim())||/[\x00-\x1f]/.test(String(v||''));}
function decode(v){return typeof v==='string'?v:decoder.decode(v);}
function page(path,html){
 if(typeof DOMParser==='undefined')throw Error('DOMParser is required');
 const d=new DOMParser().parseFromString(html,'text/html');
 const removed={scripts:0,embeds:0,executableAttributes:0,unsafeUrls:0,disabledForms:0,disabledButtons:0,redactedControls:0};
 const warnings=[];
 for(const x of [...d.querySelectorAll('script')]){removed.scripts++;x.remove();}
 for(const x of [...d.querySelectorAll('iframe,object,embed,applet,template')]){removed.embeds++;x.remove();}
 for(const x of [...d.querySelectorAll('base,meta[http-equiv="refresh"],meta[http-equiv="content-security-policy"],link[rel="modulepreload"],link[rel="preload"][as="script"]')])x.remove();
 for(const x of [...d.querySelectorAll('form')]){
   const p=d.createElement('div');p.className=x.className||'';p.setAttribute('data-web-audit-static-form','');
   const n=d.createElement('p');n.setAttribute('role','note');n.textContent='Form preview only — submission is disabled in this static HTML conversion.';p.appendChild(n);
   while(x.firstChild)p.appendChild(x.firstChild);x.replaceWith(p);removed.disabledForms++;
 }
 // Captured markup can contain prefilled credentials, tokens or personal data.
 // A disabled control still serializes its value into the exported HTML.
 for(const x of [...d.querySelectorAll('input,textarea,select,option,button')]){
   if(x.matches('input[type="hidden"],input[type="password"]')){x.remove();removed.redactedControls++;continue;}
   if(x.matches('textarea'))x.textContent='';
   for(const a of [...x.attributes]){
     if(['value','checked','selected'].includes(a.name.toLowerCase())||a.name.toLowerCase().startsWith('data-'))x.removeAttribute(a.name);
   }
   removed.redactedControls++;
 }
 for(const x of [...d.querySelectorAll('*')]){
   for(const a of [...x.attributes]){
     const name=a.name.toLowerCase();
     if(name.startsWith('on')||name==='srcdoc'||name==='ping'||name==='formaction'){x.removeAttribute(a.name);removed.executableAttributes++;continue;}
     if(['href','src','poster','xlink:href','action','data','cite','srcset'].includes(name)&&badURL(a.value)){x.removeAttribute(a.name);removed.unsafeUrls++;}
   }
   if(x.matches('input,textarea,select')){x.setAttribute('disabled','');x.removeAttribute('autocomplete');}
   if(x.matches('button')){x.setAttribute('disabled','');removed.disabledButtons++;}
   if(x.matches('img')&&!x.hasAttribute('alt')){x.setAttribute('alt','');warnings.push('Missing image alt text; empty alt added pending accessibility review.');}
   if(x.matches('a[target="_blank"]')){const rel=new Set((x.getAttribute('rel')||'').split(/\s+/).filter(Boolean));rel.add('noopener');rel.add('noreferrer');x.setAttribute('rel',[...rel].join(' '));}
 }
 if(!d.documentElement.getAttribute('lang'))d.documentElement.setAttribute('lang','en');
 if(!d.head.querySelector('meta[charset]')){const m=d.createElement('meta');m.setAttribute('charset','utf-8');d.head.prepend(m);}
 if(!d.head.querySelector('meta[name="viewport"]')){const m=d.createElement('meta');m.setAttribute('name','viewport');m.setAttribute('content','width=device-width, initial-scale=1');d.head.appendChild(m);}
 if(!d.head.querySelector('meta[name="referrer"]')){const m=d.createElement('meta');m.setAttribute('name','referrer');m.setAttribute('content','no-referrer');d.head.appendChild(m);}
 const title=(d.title||path).replace(/\s+/g,' ').slice(0,180);
 if(!d.title){const el=d.createElement('title');el.textContent=title;d.head.appendChild(el);warnings.push('Page title was missing.');}
 if(removed.scripts)warnings.push('Captured JavaScript removed; dynamic interactions require reconstruction.');
 if(removed.embeds)warnings.push('Embedded objects and frames removed.');
 if(removed.disabledForms)warnings.push('Captured form submissions disabled.');
 if(removed.disabledButtons)warnings.push('Captured buttons disabled; script events not reimplemented.');
 if(removed.redactedControls)warnings.push('Prefilled form control values and state removed from static export.');
 if(removed.executableAttributes||removed.unsafeUrls)warnings.push('Executable attributes or unsafe URLs removed.');
 if(!d.querySelector('main'))warnings.push('No main landmark detected; original structure preserved.');
 if(!d.head.querySelector('meta[name="description"]'))warnings.push('No SEO description captured; none invented.');
 const remote=[...d.querySelectorAll('[src],[href]')].map(x=>x.getAttribute('src')||x.getAttribute('href')||'').filter(v=>/^https?:\/\//i.test(v));
 if(remote.length)warnings.push('External links or resources need availability and privacy review.');
 return {html:'<!doctype html>\n'+d.documentElement.outerHTML+'\n',audit:{path,title,headingCount:d.querySelectorAll('h1,h2,h3,h4,h5,h6').length,removed,warnings:[...new Set(warnings)],externalReferences:remote.slice(0,25),originalPrivateSourceRecovered:false,fidelity:'best-effort'}};
}
function convert({files,entry='index.html',profile=null,mode='safe-static'}={}){
 if(mode!=='safe-static')throw Error('Unknown HTML conversion mode.');
 if(!(files instanceof Map))throw Error('Captured files must be a Map.');
 if(files.size>1200)throw Error('Too many captured files.');
 let size=0;
 for(const [p,data] of files){if(!pathOK(p)||!(typeof data==='string'||data instanceof Uint8Array))throw Error('Unsafe captured path: '+p);size+=typeof data==='string'?encoder.encode(data).byteLength:data.byteLength;}
 if(size>150*1024*1024)throw Error('Captured bytes exceed safe-static limit.');
 const paths=[...files.keys()].filter(p=>/\.html?$/i.test(p));
 if(!paths.length)throw Error('No captured HTML pages.');
 if(paths.length>100)throw Error('Too many HTML pages.');
 if(!pathOK(entry)||!files.has(entry)||!/\.html?$/i.test(entry))throw Error('Selected entry is not a captured HTML file.');
 const out=new Map(),audits=[],skipped=[];
 for(const [p,data] of files){
   if(/\.html?$/i.test(p)){const v=page(p,decode(data));out.set(p,encoder.encode(v.html));audits.push(v.audit);}
   else if(staticAsset.test(p)&&!executable.test(p))out.set(p,data);
   else skipped.push(p);
 }
 if(entry!=='index.html'&&!out.has('index.html')){
   const href=entry.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
   out.set('index.html',encoder.encode('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Open home</title><meta http-equiv="refresh" content="0;url='+href+'"></head><body><a href="'+href+'">Open home</a></body></html>'));
 }
 const warnings=[...new Set(['Public captures do not reveal private backend, databases or unpublished code.','JavaScript, forms, APIs and authentication are not reconstructed.',...audits.flatMap(x=>x.warnings),...(skipped.length?['Unsupported or executable assets omitted: '+skipped.length]:[])])];
 const manifest={schemaVersion:1,adapter:'html-static',adapterVersion:VERSION,strategy:'safe-static',source:{stack:profile?.source?.stack||'Unknown',origin:profile?.source?.origin||'',evidence:profile?.source?.evidence||[]},target:{stack:'HTML/CSS',runtime:'browser',buildStepRequired:false},entry,pages:audits,assetPaths:[...out.keys()].filter(x=>!/\.html?$/i.test(x)),skippedAssets:skipped.slice(0,80),warnings,aiExecution:'none — local deterministic converter; optional hybrid AI is advisory only',provenance:'sanitized public capture; private source and full visual parity not guaranteed'};
 const review='# HTML safe-static conversion review\n\n'+warnings.map(x=>'- '+x).join('\n')+'\n\nValidate route links, mobile styling, media, SEO and accessibility. Rebuild interactive functionality separately. Review licences before publishing.\n';
 const readme='# HTML/CSS export (safe static)\n\nEntry: '+entry+'\n\nRun: python -m http.server 8000\n\nCaptured JavaScript and form submissions deliberately disabled. Read HTML_CONVERSION_REPORT.json and HTML_CONVERSION_REVIEW.md. This is not original private source. The legacy HTML Website export is preserved.\n';
 out.set('HTML_CONVERSION_REPORT.json',encoder.encode(JSON.stringify(manifest,null,2).replace(/</g,'\\u003c')));
 out.set('HTML_CONVERSION_REVIEW.md',encoder.encode(review));
 out.set('README.md',encoder.encode(readme));
 return {files:out,manifest};
}
return Object.freeze({VERSION,convert,reportPage:page,blockedUrl:badURL});
});

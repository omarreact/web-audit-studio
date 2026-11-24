/* Web Audit Studio — Next.js App Router static reconstruction adapter.
   Deterministic converter: it NEVER executes captured scripts or contacts an AI API.
   Input files and DOM are untrusted. Exported React renders typed JSON nodes, no HTML injection.
*/
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WebAuditNextConverter = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const encoder = new TextEncoder(), decoder = new TextDecoder();
  const PAGE_LIMIT = 100, MAX_NODES = 25000, MAX_DEPTH = 48, MAX_CSS_BYTES = 2_000_000;
  const ALLOWED = new Set('main header footer section article nav aside div span p h1 h2 h3 h4 h5 h6 a img figure figcaption ul ol li strong em b i u small mark sup sub blockquote q cite pre code kbd samp br hr table caption thead tbody tfoot tr th td colgroup col details summary time address dl dt dd abbr data button input textarea select option label picture source video audio'.split(' '));
  const OMIT = new Set('script style iframe frame frameset object embed base meta link template noscript canvas svg math applet portal'.split(' '));
  const SAFE_ASSETS = /\.(?:avif|bmp|gif|ico|jpe?g|png|webp|woff2?|ttf|otf|eot|mp3|mp4|m4a|ogg|wav|webm|pdf|txt)$/i;
  const INTERACTIVE = new Set(['form','input','textarea','select','button','video','audio','details']);
  const RESERVED = new Set(['api','_next']);
  const string = x => String(x == null ? '' : x);
  const json = x => JSON.stringify(x,null,2).replace(/</g,'\\u003c').replace(/\u2028|\u2029/g,' ');
  const text = x => typeof x === 'string' ? x : decoder.decode(x);
  const normal = p => {
    if (typeof p !== 'string' || !p || p.length > 512 || p.startsWith('/') || /[\\\x00-\x1f]/.test(p)) throw Error('Unsafe captured file path');
    const parts = p.split('/');
    if (parts.some(s => !s || s === '.' || s === '..' || s.length > 180 || /[%?#:<>|*"\[\]]/.test(s))) throw Error('Unsafe captured file path');
    return parts.join('/');
  };
  const routeOf = (path,entry) => {
    if(path===entry)return '/';
    const p = path.replace(/(?:^|\/)index\.html?$/i,'').replace(/\.html?$/i,'');
    const seg = p.split('/').filter(Boolean).map(x=>x.toLowerCase().replace(/[^a-z0-9-_]/g,'-'));
    if (!seg.length || seg.some(x => !x || RESERVED.has(x) || x.startsWith('_') || x.includes('..'))) throw Error('Unsafe Next.js route in '+path);
    return '/' + seg.join('/');
  };
  const safeSourceURL=u=>{try{const x=new URL(u);return /^https?:$/.test(x.protocol)?x.href:'';}catch{return '';}};
  const attrUrl=u=>{try{const x=new URL(u);return x.protocol==='https:'||x.protocol==='http:';}catch{return false;}};
  function convert({files,entry='index.html',pages=[],profile={},mode='static-app-router'}={}) {
    if(mode!=='static-app-router')throw Error('Unsupported Next.js conversion mode');
    if(!(files instanceof Map) || !files.size || files.size>1500)throw Error('Expected a bounded Map of captured files');
    entry=normal(entry);const captured=new Map();
    for(const [path,bytes] of files){const clean=normal(path);if(captured.has(clean))throw Error('Duplicate file path');captured.set(clean,bytes);}
    if(!captured.has(entry)||!/\.html?$/i.test(entry))throw Error('Entry HTML page was not captured');
    const htmlPaths=[...captured.keys()].filter(p=>/\.html?$/i.test(p));
    if(!htmlPaths.length||htmlPaths.length>PAGE_LIMIT)throw Error('Too many captured HTML pages');
    const sourcePages=new Map();for(const p of pages){if(p&&typeof p.path==='string'&&captured.has(p.path))sourcePages.set(p.path,safeSourceURL(p.url));}
    const paths=new Map(), usedRoutes=new Set();
    for(const p of [entry,...htmlPaths.filter(p=>p!==entry)]){
      const route=routeOf(p,entry);if(usedRoutes.has(route))throw Error('Route collision: '+route);
      usedRoutes.add(route);paths.set(p,route);
    }
    const lookup=new Map();
    for(const [p,route] of paths){
      lookup.set(p,route);const raw=sourcePages.get(p);
      if(raw){lookup.set(raw.split('#')[0],route);try{const u=new URL(raw);lookup.set(decodeURIComponent(u.pathname).replace(/^\//,''),route);}catch{}}
      lookup.set(p.replace(/index\.html?$/i,'').replace(/\.html?$/i,''),route);
    }
    const output=new Map(), warningSet=new Set(), perPage=[];
    const warn=x=>{if(warningSet.size<120)warningSet.add(x);};
    const assets=new Set([...captured.keys()].filter(p=>SAFE_ASSETS.test(p)));
    const allowDest=(raw,pagePath,kind)=>{
      raw=string(raw).trim();if(!raw||raw.length>2000||/^(?:javascript|vbscript|data|blob|file):/i.test(raw)||raw.startsWith('//'))return null;
      if(raw.startsWith('#'))return kind==='href'?raw:null;
      if(kind==='href'&&/^(?:mailto:|tel:)/i.test(raw))return raw;
      let target='';
      try{
        const base=sourcePages.get(pagePath)||'https://capture.invalid/'+pagePath;
        const abs=new URL(raw,base);
        if(!/^https?:$/.test(abs.protocol))return null;
        const orig=sourcePages.get(pagePath);
        const origin=orig?new URL(orig).origin:'https://capture.invalid';
        if(abs.origin!==origin){if(kind==='href')return abs.href;warn('Omitted uncaptured external resource: '+abs.origin);return null;}
        const absolute=abs.href.split('#')[0], hash=abs.hash;
        if(kind==='href'){
          if(lookup.has(absolute))return lookup.get(absolute)+hash;
          target=decodeURIComponent(abs.pathname).replace(/^\//,'');
          const variants=[target,target.replace(/\/$/,'')+'/index.html',target+'.html',target.replace(/\/$/,'')];
          for(const v of variants)if(lookup.has(v))return lookup.get(v)+hash;
          if(assets.has(target))return '/captured/'+target+hash;
          warn('Unmapped internal page link: '+raw);return null;
        }
        target=decodeURIComponent(abs.pathname).replace(/^\//,'');
        if(!assets.has(target)){
          // A rewritten relative reference may point to a captured path with a query-dependent hash.
          const matches=[...assets].filter(p=>p===target||p.replace(/-[a-z0-9]{7}(\.[^.]+)$/,'$1')===target);
          target=matches.length===1?matches[0]:target;
        }
        return assets.has(target)?'/captured/'+target:null;
      }catch{return null;}
    };
    let nodesSeen=0;
    function inlineStyle(element){
      const obj={};const declarations=element.style;if(!declarations||declarations.length>50)return null;
      for(let i=0;i<declarations.length;i++){
        const key=declarations[i];let val=declarations.getPropertyValue(key).trim();
        if(!/^(?:--[\w-]+|[a-z][a-z-]{0,48})$/.test(key)||!val||val.length>220||/url\s*\(|expression\s*\(|@import|(?:javascript|data|blob):/i.test(val))continue;
        const camel=key.startsWith('--')?key:key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());obj[camel]=val;
      }
      return Object.keys(obj).length?obj:null;
    }
    function serializeNode(node,pagePath,pageWarnings,depth=0){
      if(++nodesSeen>MAX_NODES)throw Error('Page DOM exceeds safe node limit');
      if(depth>MAX_DEPTH)throw Error('Page DOM exceeds maximum depth');
      if(node.nodeType===3){const value=node.nodeValue||'';return value.length>20000?value.slice(0,20000):value;}
      if(node.nodeType!==1)return null;
      const orig=node.tagName.toLowerCase();
      if(orig==='input'&&/^(?:hidden|password)$/i.test(node.getAttribute('type')||'')){
        pageWarnings.add('Hidden and password form controls were omitted to avoid exporting prefilled secrets.');
        return null;
      }
      if(orig==='form'){
        pageWarnings.add('Forms are rendered as disabled visual placeholders; submission needs an authorized implementation.');
      }else if(OMIT.has(orig)||!ALLOWED.has(orig)){
        if(['script','iframe','object','embed','svg','canvas'].includes(orig))pageWarnings.add('Removed executable or unsupported <'+orig+'> element.');
        if(!['link','meta','style','base','template','noscript'].includes(orig))pageWarnings.add('Unsupported <'+orig+'> element needs manual migration.');
        return null;
      }
      const tag=orig==='form'?'div':orig;
      const props={};
      for(const attr of [...node.attributes]){
        let name=attr.name.toLowerCase(),val=attr.value;
        if(name.startsWith('on')||name==='is'||name==='srcdoc'||name==='contenteditable'||name==='formaction'||name==='dangerouslysetinnerhtml')continue;
        if(name==='class')props.className=val.slice(0,500);else if(name==='for')props.htmlFor=val.slice(0,100);
        else if(name==='style'){const style=inlineStyle(node);if(style)props.style=style;}
        else if(['id','title','alt','lang','dir','role','placeholder','name','download','datetime','cite','abbr','scope','colspan','rowspan','start','width','height','loading','decoding'].includes(name) || /^aria-[a-z-]+$/.test(name)||(!INTERACTIVE.has(orig)&&orig!=='option'&&/^data-[a-z0-9-_]+$/.test(name))){
          if(['width','height','colspan','rowspan','start'].includes(name)){
            const n=Number.parseInt(val,10);if(Number.isInteger(n)&&n>=0&&n<=10000)props[{colspan:'colSpan',rowspan:'rowSpan'}[name]||name]=n;
          }else props[{datetime:'dateTime',abbr:'abbr'}[name]||name]=val.slice(0,500);
        }
        else if(name==='href'&&tag==='a'){
          const dest=allowDest(val,pagePath,'href');if(dest){props.href=dest;if(attrUrl(dest)){props.target='_blank';props.rel='noopener noreferrer';}}
        }
        else if(name==='src'&&['img','source','video','audio'].includes(tag)){
          const dest=allowDest(val,pagePath,'src');if(dest)props.src=dest;else pageWarnings.add('Dropped an uncaptured or external media URL.');
        }
      }
      if(orig==='form'){
        props['data-web-audit-disabled-form']='true';props.role='group';props['aria-label']=props['aria-label']||'Nonfunctional captured form';
      }
      if(['button','input','textarea','select','option'].includes(tag))props.disabled=true;
      if(tag==='a'&&!props.href)tag==='a'&&(props.role='text');
      if(tag==='img'&&!props.src)return null;
      const children=[];
      if(orig==='textarea')pageWarnings.add('Prefilled textarea content was omitted from the static export.');
      for(const child of orig==='textarea'?[]:[...node.childNodes]){
        const out=serializeNode(child,pagePath,pageWarnings,depth+1);
        if(out!==null)children.push(out);
      }
      if(tag==='img'||tag==='input'||tag==='br'||tag==='hr'||tag==='source')return {tag,props,children:[]};
      return {tag,props,children};
    }
    const pageData={};
    for(const [p,route] of paths){
      const html=text(captured.get(p));if(html.length>4_000_000)throw Error('Captured HTML exceeds safety limit');
      const document=new DOMParser().parseFromString(html,'text/html');
      const localWarnings=new Set();nodesSeen=0;
      const rootNodes=[];for(const node of [...document.body.childNodes]){
        const out=serializeNode(node,p,localWarnings,0);if(out!==null)rootNodes.push(out);
      }
      const title=(document.querySelector('title')?.textContent||'Captured website').trim().slice(0,160);
      const description=(document.querySelector('meta[name="description"]')?.getAttribute('content')||'').slice(0,300);
      pageData[route]={title,description,nodes:rootNodes};
      perPage.push({sourcePath:p,route,title,nodes:nodesSeen,warnings:[...localWarnings]});
      for(const note of localWarnings)warn(p+': '+note);
      const dir=route==='/'?'':route.slice(1)+'/';
      const component=`import type { Metadata } from 'next';\nimport { CapturedPage } from '@/components/CapturedPage';\nimport pageData from '@/data/pages.json';\nimport type { CapturedPageData } from '@/components/CapturedPage';\nconst page = (pageData as Record<string,CapturedPageData>)[${json(route)}];\nexport const metadata: Metadata = {title: ${json(title)}, description: ${json(description)}};\nexport default function Page(){return <CapturedPage data={page}/>;}\n`;
      output.set('app/'+dir+'page.tsx',component);
    }
    const allCSS=[];
    function safeCSS(css,path){
      return css.replace(/@import\s+(?:url\([^)]*\)|[^;])*;/gi,()=>{warn('Removed CSS @import in '+path);return '/* import omitted */';})
        .replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi,(all,q,src)=>{
          const dest=allowDest(src,path,'src');return dest?`url("${dest}")`:'url("")';
        })
        .replace(/expression\s*\(/gi,'blocked-expression(')
        .replace(/behavior\s*:/gi,'blocked-behavior:');
    }
    for(const p of [...captured.keys()].filter(p=>/\.css$/i.test(p))){
      const css=text(captured.get(p));if(css.length>MAX_CSS_BYTES)throw Error('Captured stylesheet is too large');
      allCSS.push(`/* Captured stylesheet: ${p.replace(/[^\w./-]/g,'')} */\n${safeCSS(css,p)}`);
    }
    for(const p of htmlPaths){
      const d=new DOMParser().parseFromString(text(captured.get(p)),'text/html');
      for(const s of [...d.querySelectorAll('style')]){const value=s.textContent||'';if(value.length<MAX_CSS_BYTES)allCSS.push('/* Inline captured styles: '+p+' */\n'+safeCSS(value,p));}
    }
    const globals='/* Generated reconstruction: source CSS may need manual refactoring. */\nhtml,body{margin:0;min-height:100%;}\n'+allCSS.join('\n');
    output.set('app/globals.css',globals);
    for(const p of assets){
      const bytes=captured.get(p);
      if((typeof bytes==='string'?encoder.encode(bytes).byteLength:bytes.byteLength)>12*1024*1024){warn('Omitted oversize asset '+p);continue;}
      output.set('public/captured/'+p,bytes);
    }
    output.set('data/pages.json',json(pageData));
    const renderer=`import React from 'react';\n\nexport type CapturedNode = string | {tag: string; props: Record<string, unknown>; children: CapturedNode[]};\nexport type CapturedPageData = {title:string; description:string; nodes:CapturedNode[]};\nconst allowed = new Set(${json([...ALLOWED,'div'])});\nconst voidTags = new Set(['br','hr','img','input','source']);\nfunction renderNode(node: CapturedNode,key:number):React.ReactNode {\n  if(typeof node==='string')return node;\n  if(!allowed.has(node.tag))return null;\n  const props={...node.props,key} as React.HTMLAttributes<HTMLElement> & {key:number};\n  return React.createElement(node.tag,props,...(voidTags.has(node.tag)?[]:node.children.map((n,i)=>renderNode(n,i))));\n}\nexport function CapturedPage({data}:{data:CapturedPageData}){return <>{data.nodes.map((n,i)=>renderNode(n,i))}</>;}\n`;
    // Avoid string-based JSX insertion. Actual DOM conversion occurs only in the trusted structured renderer.
    output.set('components/CapturedPage.tsx',renderer.replace('return React.createElement(node.tag,props,...(voidTags.has(node.tag)?[]:node.children.map((n,i)=>renderNode(n,i))));','return React.createElement(node.tag,props,...(voidTags.has(node.tag)?[]:node.children.map((n,i)=>renderNode(n,i))));'));
    output.set('app/layout.tsx',`import './globals.css';\nimport type { ReactNode } from 'react';\nexport default function RootLayout({children}:{children:ReactNode}){return <html lang="en"><body>{children}</body></html>;}\n`);
    output.set('package.json',json({name:'web-audit-next-reconstruction',private:true,version:'0.1.0',scripts:{dev:'next dev',build:'next build',start:'next start',typecheck:'tsc --noEmit'},dependencies:{next:'^16.0.0',react:'^19.0.0','react-dom':'^19.0.0'},devDependencies:{typescript:'^5.9.0','@types/node':'^22.0.0','@types/react':'^19.0.0','@types/react-dom':'^19.0.0'}}));
    output.set('next.config.ts',`import type { NextConfig } from 'next';\nconst nextConfig: NextConfig = {output:'export',trailingSlash:true,images:{unoptimized:true}};\nexport default nextConfig;\n`);
    output.set('tsconfig.json',json({compilerOptions:{target:'ES2017',lib:['dom','dom.iterable','esnext'],allowJs:true,skipLibCheck:true,strict:true,noEmit:true,esModuleInterop:true,module:'esnext',moduleResolution:'bundler',resolveJsonModule:true,isolatedModules:true,jsx:'preserve',incremental:true,plugins:[{name:'next'}],baseUrl:'.',paths:{'@/*':['./*']}},include:['next-env.d.ts','**/*.ts','**/*.tsx','.next/types/**/*.ts'],exclude:['node_modules']}));
    output.set('next-env.d.ts','/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n');
    output.set('.gitignore','node_modules\n.next\nout\n*.tsbuildinfo\n.env*\n');
    const manifest={schemaVersion:1,adapter:'nextjs-static',source:{stack:profile?.source?.stack||'Unknown',provenance:'Public captured frontend — not original repository',entry},target:{framework:'Next.js 16 App Router',routing:'per-page static files',output:'export',serverFeatures:false},aiExecution:'none — deterministic local converter',pages:perPage,assets:[...assets],warnings:[...warningSet],limits:{maxPages:PAGE_LIMIT,maxNodesPerPage:MAX_NODES,possibleLostInteractivity:true}};
    output.set('NEXT_CONVERSION_REPORT.json',json(manifest));
    output.set('CONVERSION_REVIEW.md',`# Next.js App Router — reconstruction review\n\nThis is a generated **React/Next.js frontend**, not recovered original source. Page markup is represented as typed JSON trees and rendered with React without dangerouslySetInnerHTML. Next.js server functions, original API handlers, databases, authentication and working form submissions are **not recovered**. Captured scripts are intentionally excluded.\n\nRoutes:\n${perPage.map(p=>'- '+p.route+' ← '+p.sourcePath+' ('+p.nodes+' DOM nodes)').join('\n')}\n\n## Limitations\n${[...warningSet].map(w=>'- '+w).join('\n')||'- Verify all routes, asset paths, typography, navigation and responsive breakpoints.'}\n\n## Validate\n\n1. Run npm install, npm run typecheck, npm run build.\n2. Serve the out/ folder on an isolated local static server.\n3. Compare with the authorized source at 390, 768, 1440 px.\n4. Implement forms, APIs, authentication and interactions explicitly after review.\n5. Do not publish until licensing and visual/functionality QA are complete.\n`);
    output.set('README.md',`# Migrated Next.js Static Site\n\nGenerated by Web Audit Studio; target Next.js App Router 16 / React 19.\n\n\`\`\`bash\nnpm install\nnpm run typecheck\nnpm run build\n# Static site is generated in out/\n\`\`\`\n\nSource files are publicly captured frontend artifacts, not a recovered private codebase. Every page is rendered by a React component from structured JSON, without iframe wrappers. Static export intentionally cannot reconstruct server routes, auth, forms, business logic, or external APIs.\n\nSee NEXT_CONVERSION_REPORT.json and CONVERSION_REVIEW.md before release.\n`);
    return {files:output,manifest};
  }
  return Object.freeze({VERSION:'0.1.0',convert,routeOf});
});

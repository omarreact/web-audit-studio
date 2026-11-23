/* Web Audit Studio — source-aware intelligence + WordPress native block bridge.
 * Offline deterministic analysis is always available; remote LLM enrichment is opt-in.
 * Public capture is untrusted. No captured JavaScript is executed by this module.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WebAuditIntelligence = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '1.0.0';
  const MAX_PAGES = 100, MAX_FILE_CHARS = 300000, MAX_TEXT = 1200;
  const allowed = new Set(['p','strong','b','em','i','code','small','mark','br','a','span','sup','sub']);
  const htmlEscape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function safeUrl(value) {
    const u = String(value || '').trim();
    if (/^(?:javascript|vbscript|data|file|blob):/i.test(u) || /[\x00-\x1f]/.test(u)) return '';
    return /^(https?:\/\/|\/|#|\.\/|\.\.\/|mailto:|tel:)/i.test(u) ? u : (!/^[a-z][a-z\d+.-]*:/i.test(u) ? u : '');
  }
  function limit(text, n=MAX_TEXT) { return String(text || '').replace(/\s+/g,' ').trim().slice(0,n); }
  const escaped = value => htmlEscape(value).replace(/-->/g,'--&gt;');
  function parseHTML(html) {
    if (typeof DOMParser === 'undefined') return null;
    return new DOMParser().parseFromString(String(html).slice(0, MAX_FILE_CHARS), 'text/html');
  }
  function colors(css) {
    const candidates = String(css).match(/#[0-9a-f]{3,8}\b|rgba?\([^)]+\)/ig) || [];
    const values = [...new Set(candidates.map(s=>s.toLowerCase()))];
    return values.filter(v=>/^#[0-9a-f]{3,6}$/.test(v)).slice(0,12);
  }
  function analyze(input) {
    const files = (Array.isArray(input.files) ? input.files : []).slice(0,500);
    const html = files.filter(f => /\.html?$/i.test(f.path || '')).slice(0,MAX_PAGES);
    const css = files.filter(f=>/\.css$/i.test(f.path||'')).map(f=>String(f.content||'').slice(0,MAX_FILE_CHARS)).join('\n').slice(0,MAX_FILE_CHARS);
    const pages = html.map(f=>{
      const doc = parseHTML(f.content);
      const raw = String(f.content||'').slice(0,MAX_FILE_CHARS);
      const title = doc ? doc.title : (raw.match(/<title[^>]*>([^<]*)/i)||[])[1];
      const body = doc?.body;
      const metaDescription = doc?.querySelector('meta[name="description"]')?.getAttribute('content') || '';
      const headings = doc ? [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')].slice(0,80).map(n=>({level:Number(n.tagName[1]),text:limit(n.textContent,180)})) : [];
      const buttons = doc ? [...doc.querySelectorAll('button,input[type="submit"],a.button,a.btn,[role="button"]')].slice(0,40).map(n=>limit(n.textContent||n.getAttribute('value'),100)).filter(Boolean) : [];
      const forms = doc ? [...doc.querySelectorAll('form')].slice(0,20).map(n=>({method:(n.getAttribute('method')||'get').toUpperCase(),fields:n.querySelectorAll('input,textarea,select').length,needsBackend:true})) : [];
      const images = doc ? [...doc.images].slice(0,100).map(n=>({alt:limit(n.alt,140),src:limit(n.getAttribute('src'),500)})) : [];
      const links = doc ? [...doc.querySelectorAll('a[href]')].slice(0,200).map(n=>safeUrl(n.getAttribute('href'))).filter(Boolean) : [];
      return {path:f.path,url:f.url||null,title:limit(title,160),description:limit(metaDescription,250),headings,buttons,forms,images,links,hasScripts:!!doc?.querySelector('script[src],script:not([type="application/ld+json"])'),observedText:limit(body?.textContent,MAX_TEXT),source:'public-capture'};
    });
    const evidence=(Array.isArray(input.evidence)?input.evidence:[]).slice(0,20).map(e=>({stack:limit(e.stack,80),why:limit(e.why,200)}));
    const customFonts=[...new Set([...css.matchAll(/font-family\s*:\s*([^;{}]+)/gi)].map(m=>limit(m[1],100)))].slice(0,8);
    const needsReview=[];
    if(pages.some(p=>p.forms.length))needsReview.push('Forms require a WordPress-native handler and validated authentication/CSRF flows.');
    if(pages.some(p=>p.hasScripts))needsReview.push('Captured JavaScript behavior is not reconstructed or executed.');
    if(!pages.length)needsReview.push('No captured HTML pages; full conversion cannot be inferred.');
    needsReview.push('Public pages cannot reveal private APIs, databases, authentication or unpublished source.');
    const components={headings:pages.reduce((n,p)=>n+p.headings.length,0),images:pages.reduce((n,p)=>n+p.images.length,0),forms:pages.reduce((n,p)=>n+p.forms.length,0),buttons:pages.reduce((n,p)=>n+p.buttons.length,0)};
    return {schemaVersion:1,engineVersion:VERSION,mode:'local-rules',generatedAt:new Date().toISOString(),source:{origin:limit(input.origin,500),stack:limit(input.stack||'Unknown',80),stackConfidence:Number(input.confidence)||0,evidence},site:{pageCount:pages.length,assetCount:files.length-pages.length,components,design:{colors:colors(css),fontFamilies:customFonts}},pages,conversion:{target:'wordpress-fse',editableCoreBlocks:['heading','paragraph','image','list','buttons','group'],fallback:'core/html for unsupported/complex elements',requiresReview:needsReview,guaranteedSourceParity:false},llm:null};
  }
  function inline(node) {
    if (!node) return '';
    if (node.nodeType === 3) return escaped(node.nodeValue);
    if (node.nodeType !== 1) return '';
    const tag=node.tagName.toLowerCase();
    if (!allowed.has(tag)) return [...node.childNodes].map(inline).join('');
    if(tag==='br')return '<br>';
    const content=[...node.childNodes].map(inline).join('');
    if(tag==='a') { const href=safeUrl(node.getAttribute('href')); return href ? `<a href="${htmlEscape(href)}">${content}</a>` : content; }
    if(tag==='span')return content;
    return `<${tag}>${content}</${tag}>`;
  }
  function block(type,attrs,markup) {
    const json=attrs&&Object.keys(attrs).length?' '+JSON.stringify(attrs).replace(/-->/g,'--&gt;'):'';
    return `<!-- wp:${type}${json} -->\n${markup}\n<!-- /wp:${type} -->`;
  }
  function fallback(node) {
    const label=limit(node.textContent||'',4000);
    // Unlike generic wp:html, unsupported interactive source must not be executed.
    return label ? block('paragraph',{},`<p>${htmlEscape(label)}</p>`) : '';
  }
  function toNativeBlocks(html, options={}) {
    const doc=parseHTML(html);if(!doc)return {blocks:'',counts:{},warnings:['DOMParser is required for native block generation.']};
    const out=[],counts={},warnings=[];
    const add=(type,markup)=>{if(markup){out.push(markup);counts[type]=(counts[type]||0)+1;}};
    const render=(node,level=0)=>{
      if(level>12 || !node)return;
      if(node.nodeType===3){const t=limit(node.textContent,1000);if(t)add('paragraph',block('paragraph',{},`<p>${escaped(t)}</p>`));return;}
      if(node.nodeType!==1)return;
      const tag=node.tagName.toLowerCase();
      if(['script','style','iframe','object','embed','form','input','textarea','select','template','noscript','svg','video','audio','canvas'].includes(tag)){
        warnings.push(`Unsupported ${tag} element requires manual conversion`);return;
      }
      if(/^h[1-6]$/.test(tag)){
        const h=Number(tag[1]); const attrs=h===2?{}:{level:h};
        add('heading',block('heading',attrs,`<h${h} class="wp-block-heading">${[...node.childNodes].map(inline).join('')}</h${h}>`));return;
      }
      if(tag==='p') { const body=[...node.childNodes].map(inline).join('');if(body.trim())add('paragraph',block('paragraph',{},`<p>${body}</p>`));return; }
      if(tag==='img') {const src=safeUrl(node.getAttribute('src'));if(src) add('image',block('image',{},`<figure class="wp-block-image"><img src="${htmlEscape(src)}" alt="${htmlEscape(node.getAttribute('alt')||'')}"/></figure>`));return;}
      if(tag==='figure') {const img=node.querySelector('img');if(img)render(img,level+1);else add('paragraph',fallback(node));return;}
      if(tag==='ul'||tag==='ol') {
        const items=[...node.children].filter(ch=>ch.tagName.toLowerCase()==='li');
        if(items.length){const t=tag==='ol'?'ol':'ul';let list=`<${t} class="wp-block-list">`;
          for(const li of items)list+=block('list-item',{},`<li>${[...li.childNodes].map(inline).join('')}</li>`);
          list+=`</${t}>`;add('list',block('list',tag==='ol'?{ordered:true}:{},list));return;}
      }
      if(tag==='a' && (node.className?.match?.(/(?:^|\s)(?:btn|button|cta)(?:\s|$)/i)||node.getAttribute('role')==='button')){
        const href=safeUrl(node.getAttribute('href'));
        if(href){let label=htmlEscape(limit(node.textContent,200));const b=block('button',{},`<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="${htmlEscape(href)}">${label}</a></div>`);add('buttons',block('buttons',{},`<div class="wp-block-buttons">${b}</div>`));return;}
      }
      if(['div','section','article','main','header','footer','nav','body'].includes(tag)){
        // Keep semantic content editable while avoiding invented CSS/layout parity.
        for(const child of [...node.childNodes])render(child,level+1);return;
      }
      if(['hr'].includes(tag)){add('separator',block('separator',{},'<hr class="wp-block-separator has-alpha-channel-opacity"/>'));return;}
      if(['li','blockquote','pre','table'].includes(tag)){warnings.push(`${tag} simplified to paragraph`);add('paragraph',fallback(node));return;}
      if(['a','span','strong','em','b','i','label'].includes(tag)) {if(limit(node.textContent))add('paragraph',block('paragraph',{},`<p>${[node].map(inline).join('')}</p>`));return;}
      if(node.children.length) for(const child of [...node.childNodes])render(child,level+1);
      else if(limit(node.textContent))add('paragraph',fallback(node));
    };
    // Document body (not head); ignore executable scripts and forms deliberately.
    for(const node of [...(doc.body?.childNodes||[])])render(node);
    if(!out.length)warnings.push('No supported native blocks found.');
    return {blocks:out.join('\n\n'),counts,warnings:[...new Set(warnings)].slice(0,50)};
  }
  return Object.freeze({VERSION,analyze,toNativeBlocks,safeUrl});
});

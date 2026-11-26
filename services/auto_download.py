"""Bounded single-request public website archive. Not an unrestricted resource proxy."""
from collections import deque
import hashlib
import io
import posixpath
import re
import threading
import time
import zipfile
from urllib.parse import urljoin, urlsplit, urlunsplit, unquote, quote

from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from protego import Protego
from services import capture
from services.upstream_capture import additional_assets, nested_sitemap_urls, script_literals, rewrite_script_literals

router = APIRouter(prefix='/api/auto-download')
MAX_PAGES = 16
MAX_ASSETS = 48
MAX_REQUESTS = 70
MAX_HOSTS = 6
MAX_TOTAL = 3 * 1024 * 1024
MAX_RESOURCE = 1024 * 1024
MAX_SECONDS = 24
GATE = threading.BoundedSemaphore(1)
CSS = re.compile(r"""url\(\s*(['"]?)([^)'"\r\n]+)\1\s*\)|(@import\s+)(['"])([^'"]+)\4""", re.I)
JS = re.compile(r"""(\b(?:import|export)\s+(?:[^;\n]*?\bfrom\s*)?|\bimport\s*\(\s*)(["'])(\.{1,2}/[^"']+)\2""")
ASSET_EXT = re.compile(r'\.(?:css|m?js|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|eot|mp4|webm|mp3|wav|pdf|webmanifest)$', re.I)
FEXIVA_PAGES = ('index.html','about.html','features.html','integrations.html','pricing.html','blog.html','contact.html','404.html')
DIRS = ('css','js','images','fonts','blog','integration','cms')

class Input(BaseModel):
    url: str = Field(min_length=9, max_length=2048)

def canonical(raw, base=None):
    try:
        u = urlsplit(urljoin(base or '', raw.strip()))
        url = urlunsplit((u.scheme, u.netloc, u.path or '/', u.query, ''))
        if not u.hostname or '.' not in u.hostname or u.hostname.endswith('.'):
            raise ValueError()
        capture.validate_url(url, {u.hostname})
        return url
    except (HTTPException, ValueError, AttributeError):
        return None

def origin(url):
    u = urlsplit(url)
    return (u.scheme, u.hostname, u.port or 443)

def clean_piece(value):
    return re.sub(r'[^A-Za-z0-9._-]', '_', unquote(value))[:100].strip('.') or 'file'

def kind_of(url, content_type, page=False):
    if page:
        return 'html'
    media = content_type.lower().split(';')[0].strip()
    ext = posixpath.splitext(urlsplit(url).path.lower())[1]
    if media == 'text/css' or ext == '.css':
        return 'css'
    if 'javascript' in media or ext in ('.js','.mjs'):
        return 'js'
    if media.startswith('image/') or ext in ('.png','.jpg','.jpeg','.gif','.svg','.webp','.avif','.ico'):
        return 'images'
    if 'font' in media or ext in ('.woff','.woff2','.ttf','.otf','.eot'):
        return 'fonts'
    if media.startswith(('audio/','video/')):
        return 'images'
    if media in ('application/pdf','application/manifest+json','application/octet-stream') and ASSET_EXT.search(urlsplit(url).path):
        return 'assets'
    return None

def local_path(url, kind, seed):
    u = urlsplit(url)
    parts = [clean_piece(x) for x in u.path.split('/') if x]
    if kind == 'html':
        if url == seed or not parts:
            path = 'index.html'
        else:
            path = '/'.join(parts)
            if path.endswith('/index.html'):
                path = path[:-11] + '.html'
            elif not path.lower().endswith(('.html','.htm')):
                path += '.html'
            if path.startswith('integrations/'):
                path = 'integration/' + path[len('integrations/'):]
    else:
        name = parts[-1] if parts else 'resource'
        if '.' not in name:
            name += {'css':'.css','js':'.js','images':'.bin','fonts':'.bin'}.get(kind,'.bin')
        path = kind + '/' + clean_piece(u.hostname) + '/' + name
    if u.query and not (kind == 'html' and url == seed):
        stem, ext = posixpath.splitext(path)
        path = stem + '-' + hashlib.sha256(u.query.encode()).hexdigest()[:10] + ext
    return path

def page_links(doc, url):
    for el in doc.select('a[href]'):
        target = canonical(el.get('href',''), url)
        if target and origin(target) == origin(url) and not ASSET_EXT.search(urlsplit(target).path):
            yield target

def css_refs(source):
    for m in CSS.finditer(source):
        yield (m.group(2) or m.group(5)).strip()

def js_refs(source):
    for m in JS.finditer(source):
        yield m.group(3)
    yield from script_literals(source)

def asset_links(doc, url):
    for el in doc.select('script[src],img,source,video,audio,link[href],input[src],image[href],use[href]'):
        if el.name == 'link' and not set(el.get('rel',[])).intersection({'stylesheet','icon','preload','modulepreload','apple-touch-icon','manifest'}):
            continue
        for attr in ('src','href','poster','data-src'):
            if el.has_attr(attr):
                yield el[attr]
        for attr in ('srcset','data-srcset'):
            value = el.get(attr,'')
            if 'data:' not in value:
                for part in value.split(','):
                    if part.strip():
                        yield part.strip().split()[0]
    for _,_,value in additional_assets(doc):
        yield value
    for el in doc.select('style,[style]'):
        yield from css_refs(el.get('style','') if el.has_attr('style') else el.get_text())

def archive(seed):
    seed = canonical(seed)
    if not seed:
        raise HTTPException(400,'Enter a public HTTPS website URL with no credentials or custom port.')
    start = time.monotonic()
    rules, hosts, requests, total = {}, set(), 0, 0
    records, failures, occupied = {}, {}, set()
    pages, assets = deque([seed]), deque()
    page_seen, asset_seen = {seed}, set()
    caps = set()
    def budget():
        if time.monotonic()-start >= MAX_SECONDS:
            caps.add('Time budget reached')
        if requests >= MAX_REQUESTS:
            caps.add('Request budget reached')
        if total >= MAX_TOTAL:
            caps.add('Archive byte budget reached')
        return not caps
    def raw(url, limit):
        nonlocal requests
        if not budget():
            raise HTTPException(429,'Capture budget reached')
        host = urlsplit(url).hostname
        if host not in hosts and len(hosts) >= MAX_HOSTS:
            raise HTTPException(429,'Host budget reached')
        hosts.add(host)
        requests += 1
        return capture.download(url,{host},limit)
    def policy(url):
        host = urlsplit(url).hostname
        if host not in rules:
            code, _, data = raw('https://' + host + '/robots.txt', capture.MAX_ROBOTS)
            if code in (404,410):
                data = b''
            elif code != 200:
                raise HTTPException(403,'robots.txt could not be verified')
            rules[host] = Protego.parse(data.decode('utf-8','replace'))
        if not rules[host].can_fetch(url,capture.AGENT):
            raise HTTPException(403,'Target robots.txt disallows this resource')
        return rules[host]
    def fetch(url, page):
        nonlocal total
        policy(url)
        status, ct, data = raw(url,min(MAX_RESOURCE,MAX_TOTAL-total))
        if status != 200:
            raise HTTPException(404 if status == 404 else 502,'Upstream HTTP '+str(status))
        media = ct.split(';')[0].strip().lower()
        if page and media not in ('text/html','application/xhtml+xml'):
            raise HTTPException(422,'Target did not return an HTML page')
        kind = kind_of(url,ct,page)
        if not kind or (not page and media in ('text/html','application/xhtml+xml','application/json')):
            raise HTTPException(422,'Unsupported asset content type')
        path = local_path(url,kind,seed)
        if path.lower() in occupied:
            stem, ext = posixpath.splitext(path)
            path = stem+'-'+hashlib.sha256(url.encode()).hexdigest()[:10]+ext
        occupied.add(path.lower())
        total += len(data)
        records[url] = (path,kind,data)
        return kind,data
    def queue_page(url):
        if url not in page_seen and len(page_seen)<MAX_PAGES:
            page_seen.add(url);pages.append(url)
        elif url not in page_seen:
            caps_pages.add('Page limit reached')
    caps_pages, caps_assets = set(), set()
    def queue_asset(value, base):
        url = canonical(value,base)
        if not url or url in asset_seen or url in page_seen:
            return
        if len(asset_seen)>=MAX_ASSETS:
            caps_assets.add('Asset limit reached');return
        asset_seen.add(url);assets.append(url)
    policy(seed)
    fetch(seed,True)
    doc = BeautifulSoup(records[seed][2],'html.parser')
    for link in page_links(doc,seed):
        queue_page(link)
    for value in asset_links(doc,seed):
        queue_asset(value,seed)
    pages.popleft()
    # Upstream sitemap index traversal, using only our existing guarded transport.
    sitemap_errors={}
    def read_sitemap(url):
        policy(url)
        code, _, data=raw(url,512*1024)
        if code in (404,410):
            return None
        if code!=200:
            raise HTTPException(502,'Sitemap HTTP '+str(code))
        return data
    sitemap_seeds=[urljoin(seed,'/sitemap.xml')]
    sitemap_seeds.extend(policy(seed).sitemaps)
    for target in nested_sitemap_urls(sitemap_seeds, normalize=canonical,
            same_origin=lambda u: origin(u)==origin(seed), read=read_sitemap,
            max_maps=6, max_urls=MAX_PAGES*4,
            on_error=lambda url,exc: sitemap_errors.update({url:str(getattr(exc,'detail',exc))})):
        if not ASSET_EXT.search(urlsplit(target).path):
            queue_page(target)
    while pages and budget():
        url=pages.popleft()
        try:
            _,data=fetch(url,True)
            doc=BeautifulSoup(data,'html.parser')
            for link in page_links(doc,url):
                queue_page(link)
            for value in asset_links(doc,url):
                queue_asset(value,url)
        except HTTPException as exc:
            failures[url]=str(exc.detail)
    while assets and budget():
        url=assets.popleft()
        try:
            kind,data=fetch(url,False)
            refs=css_refs(data.decode('utf-8','replace')) if kind=='css' else js_refs(data.decode('utf-8','replace')) if kind=='js' else []
            for value in refs:
                queue_asset(value,url)
        except HTTPException as exc:
            failures[url]=str(exc.detail)
    for url in list(pages)+list(assets):
        failures[url]='Not captured within job limits'
    missing=set()
    def rewrite(value,base):
        if not value or value.startswith(('#','data:','mailto:','tel:','javascript:','blob:')):
            return value
        target=canonical(value,base)
        if target in records:
            dest=records[target][0]
            here=records[base][0]
            suffix=urlsplit(value).fragment
            return quote(posixpath.relpath(dest,posixpath.dirname(here) or '.'),safe='/._-')+('#'+suffix if suffix else '')
        if target:
            if origin(target)==origin(seed) or target in asset_seen:
                missing.add(target)
            # Do not silently turn an uncaptured relative link into a broken local URL.
            return urljoin(base,value)
        return value
    def rewrite_css(text,url):
        return CSS.sub(lambda m: 'url("'+rewrite(m.group(2).strip(),url).replace('"','%22')+'")' if m.group(2) is not None else m.group(3)+m.group(4)+rewrite(m.group(5),url)+m.group(4),text)
    name=clean_piece(urlsplit(seed).hostname.split('.')[0]).capitalize()
    if name=='Www':
        name=clean_piece(urlsplit(seed).hostname.split('.')[1]).capitalize()
    buffer=io.BytesIO()
    with zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED,compresslevel=5) as z:
        for directory in DIRS:
            z.writestr(name+'/'+directory+'/','')
        for url,(path,kind,data) in records.items():
            if kind=='html':
                doc=BeautifulSoup(data,'html.parser')
                for el in doc.select('base'):
                    el.decompose()
                # Additional upstream selectors: metadata, SVG refs, lazy images, tracks.
                for el,attr,value in additional_assets(doc):
                    if attr not in ('href','src','poster','data-src'):
                        el[attr]=rewrite(value,url)
                for el in doc.select('[href],[src],[poster],[data-src],[srcset],[data-srcset],[style]'):
                    for attr in ('href','src','poster','data-src'):
                        if el.has_attr(attr):
                            el[attr]=rewrite(el[attr],url)
                    for attr in ('srcset','data-srcset'):
                        if el.has_attr(attr) and 'data:' not in el[attr]:
                            el[attr]=', '.join(' '.join([rewrite(p.strip().split()[0],url)]+p.strip().split()[1:]) for p in el[attr].split(',') if p.strip())
                    if el.has_attr('style'):
                        el['style']=rewrite_css(el['style'],url)
                for el in doc.select('style'):
                    el.string=rewrite_css(el.get_text(),url)
                data=str(doc).encode('utf-8')
            elif kind=='css':
                data=rewrite_css(data.decode('utf-8','replace'),url).encode()
            elif kind=='js':
                text=JS.sub(lambda m:m.group(1)+m.group(2)+rewrite(m.group(3),url)+m.group(2),data.decode('utf-8','replace'))
                data=rewrite_script_literals(text,lambda value: rewrite(value,url) if canonical(value,url) in records else value).encode()
            z.writestr(name+'/'+path,data)
        import json
        paths={r[0] for r in records.values()}
        required=[p for p in FEXIVA_PAGES if p not in paths] if urlsplit(seed).hostname=='fexiva.webflow.io' else []
        warnings=['HTTP capture only; JavaScript-rendered content, CMS databases, authentication, forms and backend code are not reconstructed.','Use only with permission; review scripts and licences before running or republishing.','CMS directory is reserved for separately supplied authorized CMS data.']
        report={'sitemapErrors':sitemap_errors,'source':seed,'pages':sum(r[1]=='html' for r in records.values()),'assets':sum(r[1]!='html' for r in records.values()),'failed':failures,'unresolved':sorted(missing)[:500],'missingRequiredPages':required,'limitsReached':sorted(caps|caps_pages|caps_assets),'warnings':warnings}
        report['partial']=bool(failures or missing or required or caps or caps_pages or caps_assets or sitemap_errors)
        z.writestr(name+'/EXPORT_REPORT.json',json.dumps(report,indent=2,ensure_ascii=False))
    if buffer.tell()>4*1024*1024:
        raise HTTPException(413,'Archive exceeds server response limit; use a smaller site or authorized ZIP import.')
    return name,buffer.getvalue(),report

@router.get('/status')
def status():
    return {'enabled':True,'mode':'bounded-public-https','robotsEnforced':True,'maxPages':MAX_PAGES,'maxAssets':MAX_ASSETS,'maxBytes':MAX_TOTAL,'javascriptRendering':False}

@router.post('')
def auto_download(data:Input,request:Request):
    browser_origin=request.headers.get('origin')
    if browser_origin and browser_origin != str(request.base_url).rstrip('/'):
        # Vercel may terminate TLS before forwarding; compare HTTPS host as well.
        if browser_origin != 'https://'+request.headers.get('host',''):
            raise HTTPException(403,'Cross-origin capture requests are not allowed')
    if not GATE.acquire(blocking=False):
        raise HTTPException(429,'Capture service busy; try again later.')
    try:
        name,content,report=archive(data.url)
        return Response(content,media_type='application/zip',headers={'Content-Disposition':f'attachment; filename="{name}.zip"','Cache-Control':'no-store','X-Audit-Partial':str(report['partial']).lower(),'X-Audit-Pages':str(report['pages']),'X-Audit-Assets':str(report['assets']),'X-Audit-Filename':name+'.zip'})
    finally:
        GATE.release()

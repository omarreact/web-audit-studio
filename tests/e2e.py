"""Headless QA, no external network required. Uses installed Chromium and Playwright."""
import io, os, sys, tempfile, threading, time, zipfile
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler, SimpleHTTPRequestHandler
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class AppServer(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
    def log_message(self,*a):pass

class SiteServer(BaseHTTPRequestHandler):
    data={
        '/':('text/html', '''<!doctype html><html lang="en"><head><title>Fixture</title><link rel="stylesheet" href="/wp-content/themes/acme/style.css"><script src="/bundle.js"></script><meta name="generator" content="WordPress 6.7"></head><body><h1>Fixture home</h1><a href="/about/">About</a><img src="/images/logo.svg"><img src="/images/image.jpg" alt="fixture"></body></html>'''),
        '/about/':('text/html','''<!doctype html><html lang="en"><head><title>About fixture</title><meta name="description" content="About the fixture"></head><body><h1>About fixture</h1><p>About content</p></body></html>'''),
        '/hidden/':('text/html','<h1>Do not fetch</h1>'),
        '/robots.txt':('text/plain','User-agent: *\nDisallow: /hidden/\nSitemap: http://127.0.0.1:8766/sitemap.xml\n'),
        '/sitemap.xml':('application/xml','<?xml version="1.0"?><sitemapindex><sitemap><loc>http://127.0.0.1:8766/more.xml</loc></sitemap></sitemapindex>'),
        '/more.xml':('application/xml','<?xml version="1.0"?><urlset><url><loc>http://127.0.0.1:8766/about/</loc></url></urlset>'),
        '/wp-content/themes/acme/style.css':('text/css','@import "./extra.css"; body{background:#123;color:#fff} h1{background:url("/images/logo.svg")}'),
        '/wp-content/themes/acme/extra.css':('text/css','.card{color:magenta}'),
        '/bundle.js':('text/javascript','import "./chunk.js"; console.log("test");'),
        '/chunk.js':('text/javascript','export const marker="chunk loaded";'),
        '/images/logo.svg':('image/svg+xml','<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="8" fill="#22ccaa" /></svg>'),
        '/images/image.jpg':('image/jpeg',b'\xff\xd8\xff\xd9'),
    }
    def do_GET(self):
        url=urlparse(self.path).path
        if url not in self.data:
            self.send_response(404);self.send_header('Access-Control-Allow-Origin','*');self.end_headers();return
        type_,body=self.data[url];body=body.encode() if isinstance(body,str) else body
        self.send_response(200);self.send_header('Content-Type',type_);self.send_header('Content-Length',str(len(body)));self.send_header('Access-Control-Allow-Origin','*');self.end_headers();self.wfile.write(body)
    def log_message(self,*a):pass

def server(server_type,port):
    svr=ThreadingHTTPServer(('127.0.0.1',port),server_type);threading.Thread(target=svr.serve_forever,daemon=True).start();return svr

def run():
    app=server(AppServer,8765);site=server(SiteServer,8766)
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
        page.route('https://cdn.tailwindcss.com/**',lambda r:r.abort())
        page.route('https://cdnjs.cloudflare.com/**',lambda r:r.abort())
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://127.0.0.1:8765/',wait_until='domcontentloaded')
        page.wait_for_timeout(500)
        assert page.locator('#scanBtn').count()==1
        assert not errors, f'Javascript errors: {errors}'
        page.locator('#demoBtn').click();page.wait_for_timeout(200)
        assert '3 files' in page.locator('#workspaceCount').inner_text()
        assert page.locator('#exports [data-export]').count()==8
        assert page.locator('#previewFrame').content_frame.locator('h1').inner_text().startswith('Build something')
        page.screenshot(path=str(ROOT/'tests'/'desktop.png'),full_page=True)
        # Edit via fallback textarea and verify live static preview.
        page.locator('#fallbackEditor').fill(page.locator('#fallbackEditor').input_value().replace('Build something','Create something'))
        page.locator('#saveBtn').click();page.locator('#previewBtn').click()
        assert 'Create something' in page.locator('#previewFrame').content_frame.locator('h1').inner_text()
        page.locator('#searchBtn').click();assert page.locator('#quickOpen').evaluate('(el)=>el.open')
        page.locator('#quickInput').fill('style.css');page.locator('#quickResults [data-quick]').first.click()
        assert 'style.css' in page.locator('#openTab').inner_text()
        assert not page.locator('#quickOpen').evaluate('(el)=>el.open')
        # Generated formats contain the required project files.
        for format_name, expected in [('html',['index.html','about/index.html','assets/style.css']),('wordpress',['style.css','theme.json','templates/front-page.html','functions.php']),('next',['app/layout.tsx','app/page.tsx','public/site/index.html']),('react',['src/App.jsx','vite.config.js','public/site/index.html']),('angular',['src/main.ts','angular.json']),('astro',['src/pages/index.astro']),('nuxt',['app.vue']),('raw',['crawl-report.json'])]:
            with page.expect_download(timeout=20000) as download:
                page.locator(f'[data-export="{format_name}"]').click()
            d=download.value
            path=ROOT/'tests'/f'export-{format_name}.zip';d.save_as(path)
            with zipfile.ZipFile(path) as z:
                files=set(z.namelist())
                assert set(expected).issubset(files),(format_name,set(expected)-files)
                if format_name=='html':assert b'Create something' in z.read('index.html')
                if format_name=='wordpress':assert b'Theme Name:' in z.read('style.css')
        # CORS-enabled WordPress fixture with robots, nested sitemap, CSS and JS imports.
        page.locator('#target').fill('http://127.0.0.1:8766/')
        page.locator('#delay').fill('250');page.locator('#depth').select_option('1')
        page.locator('#scanBtn').click()
        page.wait_for_function('!document.getElementById("scanBtn").disabled', timeout=45000)
        print('SITE STATS',page.locator('#stats').inner_text())
        assert page.locator('#stackName').inner_text()=='WordPress',page.locator('#stackName').inner_text()
        assert '2 pages' in page.locator('#stats').inner_text()
        assert page.locator('#fileTree').locator('[data-open]').count()>=6
        # Site read accessible; JS and CSS import included.
        page.locator('#searchBtn').click();page.locator('#quickInput').fill('chunk.js')
        assert page.locator('#quickResults [data-quick]').count()==1,'Missing referenced JS chunk'
        page.locator('#quickClose').click()
        page.locator('#searchBtn').click();page.locator('#quickInput').fill('extra.css')
        assert page.locator('#quickResults [data-quick]').count()==1,'Missing CSS @import'
        page.locator('#quickClose').click()
        # Mobile breakpoint and light theme
        page.set_viewport_size({'width':390,'height':844});page.locator('#themeToggle').click()
        page.screenshot(path=str(ROOT/'tests'/'mobile.png'),full_page=True)
        assert page.locator('#scanBtn').is_visible()
        assert not errors,f'Javascript errors: {errors}'
        print('PASS: demo/edit/preview/search/export all formats/CORS scan/JS+CSS imports/WordPress/desktop+mobile/theme')
        browser.close()
    app.shutdown();site.shutdown()
if __name__=='__main__': run()


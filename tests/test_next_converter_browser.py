"""Next.js static adapter: route mapping, source isolation, ZIP and existing exporters."""
import json
import re
import shutil
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
BROWSER=shutil.which('chromium') or shutil.which('chromium-browser')
LAUNCH={'executable_path':BROWSER} if BROWSER else {}


def test_next_converter_native_routes_semantics_and_safety():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--no-sandbox'],**LAUNCH)
        page=browser.new_page()
        page.set_content('<!doctype html><html><body>adapter fixture</body></html>')
        page.add_script_tag(content=(ROOT/'assets/next-converter.js').read_text())
        result=page.evaluate('''() => {
          const html=`<!doctype html><html><head><title>Acme Home</title><meta name="description" content="Well-designed Acme"><style>.hero{margin:1rem;color:#f00}</style></head><body><header class="top" style="display:flex;background-color:blue"><a href="about/index.html">About</a></header><main><section class="hero"><h1>Hello from Acme</h1><p>Original text <strong>is preserved</strong></p><img alt="Logo" src="/assets/logo.png"><a href="javascript:alert(1)">unsafe</a><a href="https://external.example/" target="_blank">Remote</a><form action="https://evil.example/x"><label for="email">Email</label><input id="email"><button onclick="alert(1)">Send</button></form><iframe src="https://evil.example/">danger</iframe><script>alert(1)</script></section></main></body></html>`;
          const files=new Map([['index.html',html],['about/index.html','<!doctype html><title>About Acme</title><h1>About us</h1>'],['assets/site.css','.top{background:url("/assets/logo.png")} @import url("https://bad.example/track.css");'],['assets/logo.png',new Uint8Array([137,80,78,71])],['bundle.js','alert(1)']]);
          const r=window.WebAuditNextConverter.convert({files,entry:'index.html',pages:[{path:'index.html',url:'https://acme.example/'},{path:'about/index.html',url:'https://acme.example/about/'}],profile:{source:{stack:'WordPress'}}});
          const map={};for(const [k,v] of r.files)map[k]=typeof v==='string'?v:'BINARY';
          return {manifest:r.manifest,files:map};
        }''')
        files=result['files'];report=result['manifest']
        assert report['adapter']=='nextjs-static'
        assert report['target']['serverFeatures'] is False
        assert report['aiExecution'].startswith('none')
        assert len(report['pages'])==2
        assert {'app/page.tsx','app/about/page.tsx','data/pages.json','components/CapturedPage.tsx','next.config.ts','app/globals.css','NEXT_CONVERSION_REPORT.json','CONVERSION_REVIEW.md','public/captured/assets/logo.png'} <= set(files)
        assert 'bundle.js' not in files and 'public/captured/bundle.js' not in files
        assert 'iframe' not in files['app/page.tsx'].lower()
        assert 'dangerouslySetInnerHTML' not in files['components/CapturedPage.tsx']
        assert "output:'export'" in files['next.config.ts']
        data=json.loads(files['data/pages.json'])
        assert data['/']['title']=='Acme Home'
        assert data['/']['description']=='Well-designed Acme'
        assert data['/about']['title']=='About Acme'
        body=json.dumps(data['/']['nodes'])
        assert 'Hello from Acme' in body
        assert '/about' in body
        assert '/captured/assets/logo.png' in body
        assert 'javascript:' not in body
        assert 'https://evil.example/x' not in body
        assert 'noopener noreferrer' in body
        assert 'disabled' in body
        assert 'iframe' not in body
        assert 'url("/captured/assets/logo.png")' in files['app/globals.css']
        assert 'bad.example' not in files['app/globals.css']
        assert any('Forms are rendered as disabled' in x for x in report['warnings'])
        browser.close()


def test_next_converter_rejects_bad_paths_and_route_collisions():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--no-sandbox'],**LAUNCH)
        page=browser.new_page()
        page.set_content('<html><body></body></html>')
        page.add_script_tag(content=(ROOT/'assets/next-converter.js').read_text())
        result=page.evaluate('''() => {
          const err=[];const conv=window.WebAuditNextConverter;
          for(const obj of [
            {files:new Map([['../unsafe.html','foo']]),entry:'../unsafe.html'},
            {files:new Map([['index.html','<h1>Hi</h1>'],['about.html','x'],['about/index.html','x']])},
            {files:new Map([['index.html','hi']]),entry:'other.html'},
            {files:new Map([['index.html','hi']]),mode:'execute-javascript'},
            {files:new Map([['index.html','hi'],['api/index.html','API']])}
          ]){try{conv.convert(obj);err.push('accepted')}catch(e){err.push(e.message)}}
          return err;
        }''')
        assert 'Unsafe' in result[0]
        assert 'collision' in result[1]
        assert 'not captured' in result[2]
        assert 'mode' in result[3]
        assert 'Unsafe Next.js route' in result[4]
        browser.close()


def test_next_html_wordpress_exports_remain_independent():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--no-sandbox'],**LAUNCH)
        page=browser.new_page(accept_downloads=True,viewport={'width':390,'height':844})
        html=(ROOT/'index.html').read_text()
        html=re.sub(r'<script[^>]+src="[^"]+"[^>]*></script>','',html)
        html=re.sub(r'<link rel="stylesheet"[^>]*>','',html)
        page.set_content(html)
        page.add_style_tag(content=(ROOT/'assets/app.css').read_text())
        for path in ['vendor/jszip.min.js','assets/ai-intelligence.js','assets/html-converter.js','assets/next-converter.js','assets/app.js']:
            page.add_script_tag(content=(ROOT/path).read_text())
        page.locator('#demoBtn').click()
        assert page.locator('#aiTargetStack').input_value()=='nextjs-static'
        page.locator('#aiAnalyzeBtn').click()
        assert 'Target: Next.js App Router' in page.locator('#aiResult').inner_text()
        assert 'local deterministic analysis' in page.locator('#aiResult').inner_text()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
        with TemporaryDirectory() as tmp:
            with page.expect_download(timeout=30000) as download:
                page.locator('#downloadNativeNext').click()
            path=Path(tmp)/download.value.suggested_filename
            download.value.save_as(path)
            assert 'nextjs-native' in path.name
            with zipfile.ZipFile(path) as zip_file:
                files=set(zip_file.namelist())
                assert {'app/page.tsx','app/about/page.tsx','data/pages.json','components/CapturedPage.tsx','README.md','CONVERSION_REVIEW.md','NEXT_CONVERSION_REPORT.json'} <= files
                manifest=json.loads(zip_file.read('NEXT_CONVERSION_REPORT.json'))
                assert manifest['adapter']=='nextjs-static'
                assert len(manifest['pages'])==2
                tree=json.loads(zip_file.read('data/pages.json'))
                assert 'Build something' in json.dumps(tree['/'])
                assert tree['/about']
            with page.expect_download(timeout=30000) as download:
                page.locator('[data-export="next"]').click()
            assert 'web-audit-next-' in download.value.suggested_filename
            with page.expect_download(timeout=30000) as download:
                page.locator('#downloadSafeHtml').click()
            assert 'html-static-' in download.value.suggested_filename
            with page.expect_download(timeout=30000) as download:
                page.locator('#downloadEditableWp').click()
            assert 'wordpress-native-' in download.value.suggested_filename
        browser.close()

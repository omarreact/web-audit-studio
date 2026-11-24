"""Chromium component tests that do not require browser navigation or external CDN."""
from pathlib import Path
import shutil
import os
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
BROWSER=shutil.which('chromium') or shutil.which('chromium-browser') or None
LAUNCH={'executable_path':BROWSER} if BROWSER else {}

def test_native_blocks_and_site_intelligence():
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'],**LAUNCH)
    page=browser.new_page()
    page.set_content('<!doctype html><html><body>browser fixture</body></html>')
    page.add_script_tag(content=(ROOT/'assets/ai-intelligence.js').read_text())
    result=page.evaluate('''() => {
      const ai=window.WebAuditIntelligence;
      const raw='<!doctype html><html><head><title>Example</title></head><body><main><h1>Headline</h1><p>Hello <strong>world</strong></p><img src="/logo.svg" alt="Logo"><ul><li>First</li><li>Second</li></ul><a href="/go" class="btn">Go</a><form><input name="password"></form><script>alert(1)</script></main></body></html>';
      const profile=ai.analyze({files:[{path:'index.html',url:'https://example.com/',content:raw},{path:'style.css',content:'body {color:#123456;font-family:Inter}'}],stack:'WordPress',confidence:92,origin:'https://example.com'});
      const conv=ai.toNativeBlocks(raw);
      return {profile,conv,unsafe:ai.safeUrl('javascript:alert(1)')};
    }''')
    assert result['unsafe']==''
    assert result['profile']['site']['pageCount']==1
    assert result['profile']['site']['components']['forms']==1
    assert result['profile']['site']['design']['colors']==['#123456']
    assert result['profile']['conversion']['guaranteedSourceParity']==False
    block=result['conv']['blocks']
    for tag in ['wp:heading','wp:paragraph','wp:image','wp:list','wp:buttons']:
      assert tag in block,tag
    assert '<script' not in block and '<form' not in block
    assert 'alert(1)' not in block
    assert '__AUDIT_THEME_ASSET__' not in block
    assert result['conv']['counts']['heading']==1
    assert any('form' in warning for warning in result['conv']['warnings'])
    browser.close()


def test_bounded_component_candidates_and_css_provenance():
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'],**LAUNCH)
    page=browser.new_page()
    page.set_content('<!doctype html><html><body>fixture</body></html>')
    page.add_script_tag(content=(ROOT/'assets/ai-intelligence.js').read_text())
    report=page.evaluate('''() => {
      const header='<header><nav><a href="/">Home</a></nav></header>';
      const cards='<section><article><h2>A</h2></article><article><h2>B</h2></article></section>';
      const make=(title)=>`<!doctype html><body>${header}<main><section class="hero"><h1>${title}</h1></section>${cards}<form><input name="password" value="SECRET-PERSONAL-DATA"></form></main><footer>End</footer><script>SECRET-SCRIPT-DATA</script></body>`;
      const files=[{path:'index.html',content:make('One')},{path:'about.html',content:make('Two')},
        {path:'assets/site.css',content:'/* secret: PRIVATE-COMMENT */ body{font-family:Inter,sans-serif;font-size:18px;padding:2rem;color:#123456;max-width:1200px}@media(max-width:700px){body{font-size:16px}}'}];
      return window.WebAuditIntelligence.analyze({files,target:'nextjs-static'});
    }''')
    intel=report['site']['intelligence']
    assert intel['schemaVersion']==1
    assert report['conversion']['target']=='nextjs-static'
    repeated={c['kind'] for c in intel['components'] if c['repeatedAcrossPages']}
    assert {'header','navigation','footer','hero','card-group','form'} <= repeated
    assert any(t['value']=='700px' and t['sourcePath']=='assets/site.css' for t in intel['tokens']['breakpoints'])
    assert any(t['value']=='#123456' for t in intel['tokens']['colors'])
    assert not intel['unknown'] or isinstance(intel['unknown'],list)
    serialized=str(intel)
    assert 'SECRET-PERSONAL-DATA' not in serialized
    assert 'SECRET-SCRIPT-DATA' not in serialized
    assert 'PRIVATE-COMMENT' not in serialized
    assert len(intel['components'])<=40
    oversized=page.evaluate('''() => window.WebAuditIntelligence.analyze({files:[
      {path:'index.html',content:'<main><section class="hero"><h1>Large</h1></section></main>'+'<div>padding</div>'.repeat(200000)},
      {path:'huge.css',content:'body{color:#abcdef;gap:2rem}'+'a{font-size:12px}'.repeat(60000)}
    ]}).site.intelligence''')
    assert len(oversized['components'])<=40
    assert all(len(values)<=20 for values in oversized['tokens'].values())
    browser.close()


def test_app_demo_and_native_zip():
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'],**LAUNCH)
    page=browser.new_page(accept_downloads=True)
    html=(ROOT/'index.html').read_text()
    # No external requests or file:// navigation; DOM loaded in memory.
    import re
    html=re.sub(r'<script[^>]+src="[^"]+"[^>]*></script>','',html)
    html=re.sub(r'<link rel="stylesheet"[^>]*>','',html)
    if os.getenv('GITHUB_ACTIONS') == 'true':
      # Chromium on GitHub runners can abort when a sandboxed srcdoc iframe is
      # navigated under an opaque about:blank origin. Serve a real loopback origin.
      class QuietStatic(SimpleHTTPRequestHandler):
        def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT),**kwargs)
        def log_message(self,*args): pass
      server=ThreadingHTTPServer(('127.0.0.1',0),QuietStatic)
      threading.Thread(target=server.serve_forever,daemon=True).start()
      page.route('https://cdn.tailwindcss.com/**',lambda route:route.abort())
      page.route('https://cdnjs.cloudflare.com/**',lambda route:route.abort())
      page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='domcontentloaded')
    else:
      # The hosted execution sandbox blocks all loopback navigation, so mount
      # source in a browser DOM directly for the local component test instead.
      page.set_content(html)
      page.add_script_tag(content=(ROOT/'vendor/jszip.min.js').read_text())
      page.add_script_tag(content=(ROOT/'assets/ai-intelligence.js').read_text())
      page.add_script_tag(content=(ROOT/'assets/app.js').read_text())
    page.locator('#demoBtn').click()
    assert not page.locator('#aiAnalyzeBtn').is_disabled()
    page.locator('#aiAnalyzeBtn').click()
    assert 'Local rules' not in page.locator('#aiResult').inner_text()  # explicitly labelled local-rules
    assert 'local deterministic analysis' in page.locator('#aiResult').inner_text()
    assert 'Component candidates:' in page.locator('#aiResult').inner_text()
    with page.expect_download(timeout=20000) as analysis_download:
      page.locator('#downloadAnalysis').click()
    import json
    with __import__('tempfile').TemporaryDirectory() as tmp:
      dest=Path(tmp)/'analysis.json'
      analysis_download.value.save_as(dest)
      assert json.loads(dest.read_text())['site']['intelligence']['schemaVersion']==1
    with page.expect_download(timeout=20000) as download:
      page.locator('#downloadEditableWp').click()
    file=download.value
    assert 'wordpress-native' in file.suggested_filename
    import tempfile,zipfile,json
    with tempfile.TemporaryDirectory() as tmp:
      dest=Path(tmp)/file.suggested_filename
      file.save_as(dest)
      with zipfile.ZipFile(dest) as zip:
        names=set(zip.namelist())
        assert {'templates/front-page.html','theme.json','web-audit-analysis.json','web-audit-pages.json','CONVERSION_REVIEW.md'} <= names
        assert 'wp:heading' in zip.read('templates/front-page.html').decode()
        plan=json.loads(zip.read('web-audit-analysis.json'))
        assert plan['conversion']['target']=='wordpress-fse'
        manifest=json.loads(zip.read('web-audit-pages.json'))
        assert len(manifest['pages'])>=1
        import subprocess
        php=Path(tmp)/'functions.php';php.write_bytes(zip.read('functions.php'))
        assert subprocess.run(['php','-l',str(php)],capture_output=True).returncode==0
    browser.close()
    if os.getenv('GITHUB_ACTIONS') == 'true': server.shutdown()

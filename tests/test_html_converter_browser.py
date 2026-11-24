"""In-memory browser tests; no remote website or AI model involved."""
import json, zipfile
from pathlib import Path
from tempfile import TemporaryDirectory
import shutil
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
BROWSER=shutil.which('chromium') or shutil.which('chromium-browser')

def launch(p):
    return p.chromium.launch(headless=True,args=['--no-sandbox'],**({'executable_path':BROWSER} if BROWSER else {}))

def test_safe_html_adapter():
    with sync_playwright() as p:
        browser=launch(p); page=browser.new_page()
        page.set_content('<html><body>test fixture</body></html>')
        page.add_script_tag(content=(ROOT/'assets/html-converter.js').read_text())
        result=page.evaluate("""() => {
            const map=new Map([
              ['index.html','<!doctype html><html><head><title>Home</title><script>alert(1)</script><link rel="stylesheet" href="style.css"></head><body onload="alert(1)"><main><h1>Welcome</h1><a href="about/index.html">About</a><form><input name="email"><button onclick="alert(1)">Send</button></form><iframe src="https://example.com"></iframe><img src="photo.png" onerror="alert(1)"></main></body></html>'],
              ['about/index.html','<html><body><main><h1>About</h1></main></body></html>'],
              ['style.css','body{color:red}'],['photo.png',new Uint8Array([1,2])],['app.js','console.log("not copied")']
            ]);
            const output=window.WebAuditHTMLConverter.convert({files:map,entry:'index.html'});
            const d=x=>typeof x==='string'?x:new TextDecoder().decode(x);
            return {page:d(output.files.get('index.html')),paths:[...output.files.keys()],report:JSON.parse(d(output.files.get('HTML_CONVERSION_REPORT.json')))};
        }""")
        html=result['page']
        assert '<script' not in html and '<iframe' not in html and '<form' not in html
        assert 'onload=' not in html and 'onclick=' not in html and 'onerror=' not in html
        assert 'data-web-audit-static-form' in html and 'disabled' in html
        assert 'about/index.html' in html and 'style.css' in result['paths'] and 'photo.png' in result['paths']
        assert 'app.js' not in result['paths']
        assert result['report']['adapter']=='html-static' and len(result['report']['pages'])==2
        browser.close()

def test_safe_html_redacts_prefilled_controls():
    with sync_playwright() as p:
        browser=launch(p); page=browser.new_page()
        page.set_content('<html><body>fixture</body></html>')
        page.add_script_tag(content=(ROOT/'assets/html-converter.js').read_text())
        output=page.evaluate('''() => {
          const html='<main><form><input type="hidden" value="private-csrf-token"><input type="password" value="private-password"><input value="private-name" data-token="private-data"><textarea>private-note</textarea><select><option value="private-option" selected>Public label</option></select></form></main>';
          const result=WebAuditHTMLConverter.convert({files:new Map([['index.html',html]])});
          return {html:new TextDecoder().decode(result.files.get('index.html')),report:result.manifest};
        }''')
        for secret in ('private-csrf-token','private-password','private-name','private-data','private-note','private-option'):
            assert secret not in output['html']
        assert 'Public label' in output['html']
        assert output['report']['pages'][0]['removed']['redactedControls'] >= 5
        browser.close()

def test_app_html_export_with_legacy_options():
    import re
    with sync_playwright() as p:
        browser=launch(p); page=browser.new_page(accept_downloads=True)
        html=(ROOT/'index.html').read_text()
        html=re.sub(r'<script[^>]+src="[^"]+"[^>]*></script>','',html)
        html=re.sub(r'<link rel="stylesheet"[^>]*>','',html)
        # The export test does not test preview navigation. A passive element avoids
        # an upstream Chromium/Edge about:blank sandboxed-iframe crash on CI runners.
        html=re.sub(r'<iframe id="previewFrame"[^>]*></iframe>', '<div id="previewFrame"></div>', html)
        page.set_content(html)
        for f in ['vendor/jszip.min.js','assets/ai-intelligence.js','assets/html-converter.js','assets/app.js']:
            page.add_script_tag(content=(ROOT/f).read_text())
        page.locator('#demoBtn').click()
        assert page.locator('#downloadSafeHtml').is_enabled()
        page.locator('#aiTargetStack').select_option('html-static')  # target regression with Next-first default
        assert page.locator('#aiTargetStack').input_value()=='html-static'
        page.locator('#aiAnalyzeBtn').click()
        assert 'HTML/CSS safe-static' in page.locator('#aiResult').inner_text()
        with page.expect_download(timeout=25000) as dl:
            page.locator('#downloadSafeHtml').click()
        with TemporaryDirectory() as directory:
            path=Path(directory)/dl.value.suggested_filename
            dl.value.save_as(path)
            with zipfile.ZipFile(path) as z:
                assert {'index.html','about/index.html','HTML_CONVERSION_REPORT.json','HTML_CONVERSION_REVIEW.md'}<=set(z.namelist())
                assert b'Build something' in z.read('index.html')
                assert json.loads(z.read('HTML_CONVERSION_REPORT.json'))['adapter']=='html-static'
        with page.expect_download(timeout=25000) as dl:
            page.locator('[data-export="html"]').click()
        assert 'web-audit-html-' in dl.value.suggested_filename
        with page.expect_download(timeout=25000) as dl:
            page.locator('#downloadEditableWp').click()
        assert 'wordpress-native' in dl.value.suggested_filename
        browser.close()

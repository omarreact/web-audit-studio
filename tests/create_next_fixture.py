"""Create a small complete Next.js ZIP for CI build validation (no untrusted network input)."""
import argparse
import base64
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--output',required=True)
args=parser.parse_args()
with sync_playwright() as pw:
    system_chromium=shutil.which('chromium') or shutil.which('chromium-browser')
    launch={'executable_path':system_chromium} if system_chromium else {}
    browser=pw.chromium.launch(headless=True,args=['--no-sandbox'],**launch)
    page=browser.new_page()
    page.set_content('<!doctype html><title>Fixture Source</title>')
    page.add_script_tag(content=(ROOT/'vendor/jszip.min.js').read_text())
    page.add_script_tag(content=(ROOT/'assets/next-converter.js').read_text())
    encoded=page.evaluate('''async () => {
      const source=new Map([
        ['index.html','<!doctype html><html><head><title>Home fixture</title><meta name="description" content="First page"></head><body><main><h1>Build fixture</h1><a href="about/index.html">About</a><p>Welcome</p><img src="logo.png" alt="Logo"></main></body></html>'],
        ['about/index.html','<!doctype html><html><head><title>About fixture</title></head><body><header><h1>About</h1></header><ul><li>One</li><li>Two</li></ul></body></html>'],
        ['logo.png',new Uint8Array([137,80,78,71,13,10,26,10])],
        ['styles/site.css','h1{font-size:2rem}']
      ]);
      const generated=window.WebAuditNextConverter.convert({files:source,entry:'index.html',pages:[{path:'index.html',url:'https://fixture.example/'},{path:'about/index.html',url:'https://fixture.example/about/'}],profile:{source:{stack:'Static HTML'}}});
      const archive=new JSZip(); for(const [name,bytes] of generated.files) archive.file(name,bytes);
      return await archive.generateAsync({type:'base64',compression:'DEFLATE'});
    }''')
    browser.close()
Path(args.output).write_bytes(base64.b64decode(encoded))
print('Generated self-contained Next.js test fixture:',args.output)

import io
import json
import zipfile
from unittest.mock import patch
from services import auto_download as auto
from services.browser_renderer import BrowserRenderer

def test_rendered_routes_and_network_archive():
    fixtures={
        'https://example.com/robots.txt':(200,'text/plain',b'User-agent: *\nAllow: /'),
        'https://example.com/':(200,'text/html',b'<html><body><script src="/app.js"></script></body></html>'),
        'https://example.com/app.js':(200,'application/javascript',b'document.body.insertAdjacentHTML("beforeend", "<h1>Rendered</h1><a href=/dynamic>Dynamic</a><img src=/pic.svg>");'),
        'https://example.com/dynamic':(200,'text/html',b'<h1>Dynamic page</h1>'),
        'https://example.com/pic.svg':(200,'image/svg+xml',b'<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    }
    calls=[]
    def fake(url,hosts,limit):
        calls.append(url)
        return fixtures.get(url,(404,'',b''))
    with patch.object(auto.capture,'download',side_effect=fake):
        with BrowserRenderer() as renderer:
            name,data,report=auto.archive('https://example.com/',renderer=renderer,limits=auto.LOCAL_LIMITS)
    assert report['renderedPages']==2, report
    assert report['pages']==2
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        assert 'Rendered' in z.read('Example/index.html').decode()
        assert 'Example/dynamic.html' in z.namelist()
        trace=json.loads(z.read('Example/NETWORK_TRACE.json'))
        assert any(x['url'].endswith('/app.js') and x['status']==200 for x in trace)
    assert calls.count('https://example.com/app.js')==1

def test_public_mode_ignores_local_flag_on_vercel(monkeypatch):
    monkeypatch.setenv('WEB_AUDIT_LOCAL_FULL','1')
    monkeypatch.setenv('VERCEL','1')
    assert not auto.local_full_enabled()

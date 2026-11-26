import io
import json
import zipfile
from unittest.mock import patch
from fastapi.testclient import TestClient
from fastapi import HTTPException
import app
from services import auto_download as auto

client=TestClient(app.app)

def test_status():
    assert client.get('/api/auto-download/status').json()['enabled']
    assert client.get('/').text.find('automaticDownloadBtn')>=0

def test_automatic_archive():
    fixtures={
        'https://example.com/robots.txt':(200,'text/plain',b'User-agent: *\nAllow: /'),
        'https://example.com/':(200,'text/html',b'<a href="/about/">About</a><link rel="stylesheet" href="/main.css"><script src="/app.js"></script><img src="https://cdn.example.com/logo.svg">'),
        'https://example.com/about/':(200,'text/html',b'<a href="/">Home</a>'),
        'https://example.com/main.css':(200,'text/css',b'body{background:url(https://cdn.example.com/logo.svg)}'),
        'https://example.com/app.js':(200,'application/javascript',b'import "./chunk.js";'),
        'https://example.com/chunk.js':(200,'application/javascript',b'export const x=1;'),
        'https://cdn.example.com/robots.txt':(404,'',b''),
        'https://cdn.example.com/logo.svg':(200,'image/svg+xml',b'<svg/>'),
    }
    def fake(url,hosts,limit):
        assert hosts=={auto.urlsplit(url).hostname}
        return fixtures.get(url,(404,'',b''))
    with patch.object(auto.capture,'download',side_effect=fake):
        r=client.post('/api/auto-download',json={'url':'https://example.com/'})
    assert r.status_code==200, r.text[:500]
    assert r.headers['x-audit-pages']=='2'
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        assert 'Example/about.html' in z.namelist()
        assert 'Example/images/cdn.example.com/logo.svg' in z.namelist()
        assert 'Example/cms/' in z.namelist()
        assert 'href="about.html"' in z.read('Example/index.html').decode()
        assert '../../images/cdn.example.com/logo.svg' in z.read('Example/css/example.com/main.css').decode()
        assert 'chunk.js' in z.read('Example/js/example.com/app.js').decode()
        assert not json.loads(z.read('Example/EXPORT_REPORT.json'))['partial']

def test_denied_robots_no_page_request():
    with patch.object(auto.capture,'download',return_value=(200,'text/plain',b'User-agent: *\nDisallow: /')) as d:
        r=client.post('/api/auto-download',json={'url':'https://example.com/'})
    assert r.status_code==403
    assert d.call_count==1

def test_private_network_and_invalid_url():
    assert client.post('/api/auto-download',json={'url':'http://example.com/'}).status_code==400
    assert client.post('/api/auto-download',json={'url':'https://user:pass@example.com/'}).status_code==400
    with patch.object(auto.capture.socket,'getaddrinfo',return_value=[(2,1,6,'',('127.0.0.1',443))]):
        assert client.post('/api/auto-download',json={'url':'https://example.com/'}).status_code==403

def test_failed_asset_partial_report():
    def fake(url,hosts,limit):
        if url.endswith('robots.txt'): return (404,'',b'')
        if url=='https://example.com/': return (200,'text/html',b'<img src="/missing.png">')
        return (404,'',b'')
    with patch.object(auto.capture,'download',side_effect=fake):
        r=client.post('/api/auto-download',json={'url':'https://example.com/'})
    assert r.status_code==200
    assert r.headers['x-audit-partial']=='true'
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        report=json.loads(z.read('Example/EXPORT_REPORT.json'))
        assert 'https://example.com/missing.png' in report['failed']

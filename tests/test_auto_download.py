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


def test_nested_sitemaps_and_additional_assets():
    from services import auto_download as auto
    from unittest.mock import patch
    import io, json, zipfile
    fixtures={
        'https://example.com/robots.txt':(200,'text/plain',b'User-agent: *\nAllow: /\nSitemap: https://example.com/maps/index.xml'),
        'https://example.com/':(200,'text/html',b'<meta property="og:image" content="/social.png"><img data-lazy-src="/lazy.png"><script src="/app.js"></script>'),
        'https://example.com/maps/index.xml':(200,'application/xml',b'<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://example.com/maps/child.xml</loc></sitemap><sitemap><loc>https://outside.example.net/sitemap.xml</loc></sitemap></sitemapindex>'),
        'https://example.com/maps/child.xml':(200,'application/xml',b'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/about</loc></url></urlset>'),
        'https://example.com/about':(200,'text/html',b'<p>About</p>'),
        'https://example.com/social.png':(200,'image/png',b'social'),
        'https://example.com/lazy.png':(200,'image/png',b'lazy'),
        'https://example.com/app.js':(200,'application/javascript',b'const image="/script.png";'),
        'https://example.com/script.png':(200,'image/png',b'script'),
    }
    calls=[]
    def fake(url,hosts,limit):
        calls.append(url)
        return fixtures.get(url,(404,'',b''))
    with patch.object(auto.capture,'download',side_effect=fake):
        name,data,report=auto.archive('https://example.com/')
    assert not any('outside.example.net' in u for u in calls)
    assert report['pages']==2
    assert report['assets']==4
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        assert 'Example/about.html' in z.namelist()
        html=z.read('Example/index.html').decode()
        assert 'images/example.com/social.png' in html
        assert 'images/example.com/lazy.png' in html
        js=z.read('Example/js/example.com/app.js').decode()
        assert '../../images/example.com/script.png' in js

def test_sitemap_entity_rejected():
    from services.upstream_capture import nested_sitemap_urls
    from services.auto_download import canonical
    errors=[]
    result=list(nested_sitemap_urls(['https://example.com/sitemap.xml'],
        normalize=canonical, same_origin=lambda u: u.startswith('https://example.com/'),
        read=lambda u:b'<!DOCTYPE a [<!ENTITY x "bad">]><urlset><url><loc>&x;</loc></url></urlset>',
        on_error=lambda u,e:errors.append(str(e))))
    assert result==[] and errors

def test_seed_query_keeps_index():
    from services.auto_download import local_path
    u='https://example.com/?version=1'
    assert local_path(u,'html',u)=='index.html'

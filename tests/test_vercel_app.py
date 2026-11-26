from fastapi.testclient import TestClient
from fastapi import HTTPException
from unittest.mock import patch
import base64
import pytest
import app as unified
from services import capture

client = TestClient(unified.app)

def test_frontend_and_assets():
    for route in ('/', '/index.html', '/single-file.html', '/assets/app.js', '/assets/organized-export.js', '/vendor/jszip.min.js', '/health'):
        r = client.get(route)
        assert r.status_code == 200, route
    assert 'Web Audit Studio' in client.get('/').text
    assert client.get('/services/analyzer/app.py').status_code == 404

def test_unconfigured_capture(monkeypatch):
    monkeypatch.delenv('WEB_AUDIT_CAPTURE_TOKEN', raising=False)
    monkeypatch.delenv('WEB_AUDIT_CAPTURE_HOSTS', raising=False)
    assert not client.get('/api/capture/status').json()['enabled']
    assert client.post('/api/capture', json={'url':'https://example.com/'}).status_code == 503

def test_authorization_and_robots(monkeypatch):
    token = 'test-token-not-a-real-secret-123'
    monkeypatch.setenv('WEB_AUDIT_CAPTURE_TOKEN', token)
    monkeypatch.setenv('WEB_AUDIT_CAPTURE_HOSTS', 'example.com')
    assert client.post('/api/capture', json={'url':'https://example.com/'}).status_code == 401
    headers = {'x-audit-token':token}
    assert client.post('/api/capture', headers=headers, json={'url':'https://localhost/'}).status_code == 403
    with patch.object(capture, 'download', return_value=(200,'text/plain',b'User-agent: *\nDisallow: /')):
        assert client.post('/api/capture', headers=headers, json={'url':'https://example.com/'}).status_code == 403
    with patch.object(capture,'download', side_effect=[(404,'',b''),(200,'text/html',b'<h1>Fixture</h1>')]):
        result = client.post('/api/capture',headers=headers,json={'url':'https://example.com/'})
        assert result.status_code == 200
        assert base64.b64decode(result.json()['base64']) == b'<h1>Fixture</h1>'

def test_private_dns_rejected():
    with patch.object(capture.socket, 'getaddrinfo', return_value=[(2,1,6,'',('127.0.0.1',443))]):
        with pytest.raises(HTTPException) as ex:
            capture.public_ip('example.com')
        assert ex.value.status_code == 403

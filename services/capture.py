"""Authenticated, bounded, HTTPS-only resource capture for authorized hosts.
No forwarding of cookies, credentials, arbitrary headers, redirects or DNS re-resolution.
"""
import base64
import hmac
import http.client
import ipaddress
import os
import re
import socket
import ssl
import time
from urllib.parse import urlsplit, urlunsplit

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from protego import Protego

router = APIRouter(prefix='/api/capture')
AGENT = 'WebAuditStudio'
MAX_BYTES = 3 * 1024 * 1024
MAX_ROBOTS = 512 * 1024
TIMEOUT = 8

class CaptureInput(BaseModel):
    url: str = Field(min_length=9, max_length=2048)

def settings():
    hosts = {h.strip().lower() for h in os.getenv('WEB_AUDIT_CAPTURE_HOSTS', '').split(',') if h.strip()}
    token = os.getenv('WEB_AUDIT_CAPTURE_TOKEN', '')
    return hosts, token

def validate_url(url, hosts):
    if not isinstance(url, str) or len(url) > 2048 or any(ord(c) < 33 or ord(c) > 126 for c in url):
        raise HTTPException(400, 'Invalid resource URL')
    try:
        u = urlsplit(url)
        host = u.hostname
        if (u.scheme != 'https' or not host or u.username or u.password or u.port not in (None, 443)
            or u.fragment or not re.fullmatch(r'[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?', host)
            or host not in hosts):
            raise HTTPException(403, 'Only explicitly authorized HTTPS hosts are permitted')
    except ValueError as exc:
        raise HTTPException(400, 'Invalid resource URL') from exc
    return u

def public_ip(host):
    try:
        records = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
        addresses = list(dict.fromkeys(x[4][0] for x in records))
        for value in addresses:
            ip = ipaddress.ip_address(value)
            if not ip.is_global or ip.is_multicast or ip.is_reserved or ip.is_loopback or ip.is_link_local:
                raise HTTPException(403, 'Non-public network destination denied')
        if not addresses:
            raise HTTPException(502, 'No public DNS records')
        return addresses[0]
    except (OSError, ValueError) as exc:
        raise HTTPException(502, 'DNS lookup failed') from exc

class PinnedHTTPS(http.client.HTTPSConnection):
    def __init__(self, host, ip):
        super().__init__(host, 443, timeout=TIMEOUT, context=ssl.create_default_context())
        self.ip = ip
    def connect(self):
        raw = socket.create_connection((self.ip, 443), self.timeout)
        try:
            self.sock = self._context.wrap_socket(raw, server_hostname=self.host)
        except BaseException:
            raw.close()
            raise

def download(url, hosts, limit):
    u = validate_url(url, hosts)
    ip = public_ip(u.hostname)
    conn = PinnedHTTPS(u.hostname, ip)
    started = time.monotonic()
    try:
        path = urlunsplit(('', '', u.path or '/', u.query, ''))
        conn.request('GET', path, headers={'User-Agent': AGENT + '/1.0', 'Accept': '*/*', 'Accept-Encoding': 'identity', 'Connection': 'close'})
        response = conn.getresponse()
        status = response.status
        if 300 <= status < 400:
            raise HTTPException(403, 'Redirect not followed; use the authorized canonical URL')
        if status != 200:
            return status, '', b''
        if response.getheader('Content-Encoding', 'identity').lower() not in ('identity', ''):
            raise HTTPException(502, 'Unsupported upstream content encoding')
        announced = response.getheader('Content-Length')
        if announced and (not announced.isdigit() or int(announced) > limit):
            raise HTTPException(413, 'Upstream resource exceeds size limit')
        chunks, size = [], 0
        while True:
            if time.monotonic() - started > TIMEOUT * 2:
                raise HTTPException(504, 'Upstream deadline exceeded')
            chunk = response.read1(min(65536, limit - size + 1))
            if not chunk:
                break
            size += len(chunk)
            if size > limit:
                raise HTTPException(413, 'Upstream resource exceeds size limit')
            chunks.append(chunk)
        content_type = (response.getheader('Content-Type') or 'application/octet-stream')[:160]
        return status, content_type, b''.join(chunks)
    except (OSError, http.client.HTTPException, ValueError) as exc:
        raise HTTPException(502, 'Upstream request failed') from exc
    finally:
        conn.close()

def robots(url, hosts):
    u = validate_url(url, hosts)
    status, _, raw = download('https://' + u.hostname + '/robots.txt', hosts, MAX_ROBOTS)
    if status in (404, 410):
        raw = b''
    elif status != 200:
        raise HTTPException(403, 'robots.txt could not be verified')
    if u.path != '/robots.txt' and not Protego.parse(raw.decode('utf-8', 'replace')).can_fetch(url, AGENT):
        raise HTTPException(403, 'Target robots.txt disallows this resource')
    return raw

@router.get('/status')
def status():
    hosts, token = settings()
    return {'enabled': bool(hosts and len(token) >= 24), 'mode': 'authorized-https', 'robotsEnforced': True, 'maxResourceBytes': MAX_BYTES}

@router.post('')
def capture(data: CaptureInput, request: Request):
    hosts, token = settings()
    if not hosts or len(token) < 24:
        raise HTTPException(503, 'Server capture is not configured; set the authorized host list and access token')
    supplied = request.headers.get('x-audit-token', '')
    if len(supplied) > 256 or not hmac.compare_digest(supplied.encode(), token.encode()):
        raise HTTPException(401, 'A valid server capture access token is required')
    u = validate_url(data.url, hosts)
    rules = robots(data.url, hosts)
    if u.path == '/robots.txt' and not u.query:
        content_type, raw = 'text/plain; charset=utf-8', rules
    else:
        code, content_type, raw = download(data.url, hosts, MAX_BYTES)
        if code != 200:
            raise HTTPException(404 if code == 404 else 502, 'Upstream HTTP ' + str(code))
    return JSONResponse({'url': data.url, 'contentType': content_type, 'base64': base64.b64encode(raw).decode('ascii')}, headers={'Cache-Control':'no-store'})

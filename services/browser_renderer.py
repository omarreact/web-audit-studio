"""Optional local Chromium renderer.

Every HTTP(S) request is intercepted and fulfilled from the same guarded
transport as the HTTP crawler. No route.continue_ or browser-side fetch is used.
A fail-closed proxy, service-worker blocking and WebSocket interception are
defense-in-depth; deploy only on a dedicated, network-isolated local worker.
"""
from dataclasses import dataclass
from urllib.parse import urlsplit

@dataclass
class RenderResult:
    html: bytes
    network: list

class BrowserRenderer:
    def __init__(self):
        self._pw=self._browser=self._context=None

    def __enter__(self):
        from playwright.sync_api import sync_playwright
        self._pw=sync_playwright().start()
        try:
            self._browser=self._pw.chromium.launch(headless=True,
                proxy={'server':'http://127.0.0.1:9','bypass':'<-loopback>'},
                args=['--disable-background-networking','--disable-quic',
                      '--force-webrtc-ip-handling-policy=disable_non_proxied_udp'])
            self._context=self._browser.new_context(service_workers='block',
                accept_downloads=False, viewport={'width':1440,'height':900},
                user_agent='WebAuditStudio/1.0')
            self._context.route_web_socket('**/*',lambda ws:ws.close())
            return self
        except BaseException:
            self.__exit__(None,None,None)
            raise

    def __exit__(self,*args):
        try:
            if self._context: self._context.close()
        finally:
            try:
                if self._browser: self._browser.close()
            finally:
                if self._pw: self._pw.stop()

    def render(self,url,initial,fetch,*,max_html):
        """fetch(target, resource_type) is the only source of remote bytes."""
        import time
        page=self._context.new_page()
        network=[]
        def route_request(route):
            req=route.request
            target=req.url
            status=0;size=0
            try:
                if req.method!='GET' or urlsplit(target).scheme!='https':
                    route.abort()
                    return
                if req.resource_type=='document':
                    if target!=url or req.frame!=page.main_frame:
                        route.abort()
                        return
                    ct,body=initial
                else:
                    ct,body=fetch(target,req.resource_type)
                size=len(body)
                route.fulfill(status=200,content_type=ct,body=body)
                status=200
            except Exception:
                try: route.abort()
                except Exception: pass
            finally:
                if len(network)<1000:
                    network.append({'url':target[:2048],'method':req.method,
                        'resourceType':req.resource_type,'status':status,'bytes':size})
        try:
            page.route('**/*',route_request)
            page.goto(url,wait_until='domcontentloaded',timeout=18000)
            page.wait_for_timeout(300)
            for _ in range(3):
                page.mouse.wheel(0,900)
                page.wait_for_timeout(150)
            if page.url!=url:
                raise RuntimeError('Unexpected navigation during capture')
            data=page.content().encode('utf-8')
            if len(data)>max_html:
                raise ValueError('Rendered HTML exceeds byte budget')
            return RenderResult(data,network)
        finally:
            page.close()

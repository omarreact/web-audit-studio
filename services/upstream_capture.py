"""Selected, security-adapted upstream capture primitives.

MIT upstreams: PKHarsimran/website-downloader (constants.py, sitemap.py,
rewrite.py) and website-scraper/node-website-scraper (default asset selectors).
See THIRD_PARTY_NOTICES.md for pinned revisions and licenses. No upstream
transport or unrestricted browser navigation is used.
"""
from collections import deque
import re
import xml.etree.ElementTree as ET
from urllib.parse import urlsplit

JS_URL_RE = re.compile(
    r"""["'](/[^"']+\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|css|js|mjs|map|woff|woff2|ttf|eot|json|wasm|webmanifest)(?:\?[^"']*)?)["']""",
    re.IGNORECASE,
)

JS_ABS_URL_RE = re.compile(
    r"""["']((?:https?:)?//[^"']+\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|css|js|mjs|map|woff|woff2|ttf|eot|json|wasm|webmanifest)(?:\?[^"']*)?)["']""",
    re.IGNORECASE,
)
RESOURCE_SELECTORS = [["img","src"],["input","src"],["script","src"],["link[rel=\"stylesheet\"]","href"],["link[rel*=\"icon\"]","href"],["svg *[xlink:href]","xlink:href"],["svg *[href]","href"],["meta[property=\"og:image\"]","content"],["meta[property=\"og:image:url\"]","content"],["meta[property=\"og:image:secure_url\"]","content"],["meta[property=\"og:audio\"]","content"],["meta[property=\"og:audio:url\"]","content"],["meta[property=\"og:audio:secure_url\"]","content"],["meta[property=\"og:video\"]","content"],["meta[property=\"og:video:url\"]","content"],["meta[property=\"og:video:secure_url\"]","content"],["video","src"],["video source","src"],["video track","src"],["audio","src"],["audio source","src"],["audio track","src"],["[background]","background"]]

# Do not fetch generic JSON or source maps merely because script text mentions them.
STATIC_LITERAL = re.compile(r'\.(?:png|jpe?g|gif|svg|webp|avif|ico|css|m?js|woff2?|ttf|eot|wasm|webmanifest)$', re.I)

def script_literals(source):
    for pattern in (JS_URL_RE, JS_ABS_URL_RE):
        for match in pattern.finditer(source):
            value=match.group(1)
            try:
                if STATIC_LITERAL.search(urlsplit(value).path):
                    yield value
            except ValueError:
                continue

def additional_assets(doc):
    for selector, attr in RESOURCE_SELECTORS:
        for el in doc.select(selector):
            value=el.get(attr)
            if isinstance(value,str) and value.strip():
                yield el,attr,value
    for el in doc.select('[data-lazy-src],[data-original],[data-background-image]'):
        for attr in ('data-lazy-src','data-original','data-background-image'):
            if el.get(attr):
                yield el,attr,el[attr]
    for el in doc.select('meta[name="twitter:image"],meta[name="twitter:image:src"]'):
        if el.get('content'):
            yield el,'content',el['content']

def nested_sitemap_urls(seeds, *, normalize, same_origin, read, max_maps=6, max_urls=200, on_error=None):
    """Adapted upstream recursive sitemap indexing with bounded queue and
    caller-supplied robots/SSRF-enforcing transport; XML entities are rejected."""
    queue=deque(seeds)
    seen=set()
    emitted=set()
    while queue and len(seen)<max_maps and len(emitted)<max_urls:
        url=normalize(queue.popleft())
        if not url or url in seen or not same_origin(url):
            continue
        seen.add(url)
        try:
            body=read(url)
            if body is None:
                continue
            # Reject DTDs, including UTF-16/32 encodings, before parsing.
            if b'<!DOCTYPE' in body.replace(b'\x00',b'').upper() or b'<!ENTITY' in body.replace(b'\x00',b'').upper():
                raise ValueError('XML entities are not permitted')
            root=ET.fromstring(body)
            tag=root.tag.rsplit('}',1)[-1]
            if tag=='sitemapindex':
                for loc in root.findall('./{*}sitemap/{*}loc'):
                    child=normalize((loc.text or '').strip(),url)
                    if child and same_origin(child) and child not in seen and len(queue)<max_maps*2:
                        queue.append(child)
            elif tag=='urlset':
                for loc in root.findall('./{*}url/{*}loc'):
                    target=normalize((loc.text or '').strip(),url)
                    if target and same_origin(target) and target not in emitted:
                        emitted.add(target)
                        yield target
                        if len(emitted)>=max_urls:
                            return
            else:
                raise ValueError('Unsupported sitemap root')
        except Exception as exc:
            if on_error:
                on_error(url,exc)

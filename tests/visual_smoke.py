"""Capture review evidence for the deterministic demo at three viewport widths."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'visual-evidence'


def test_demo_viewports():
    OUT.mkdir(exist_ok=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=['--no-sandbox'])
        for width, height in [(390, 844), (768, 1024), (1440, 900)]:
            page = browser.new_page(viewport={'width': width, 'height': height}, device_scale_factor=1)
            page.route('https://cdn.tailwindcss.com/**', lambda route: route.abort())
            page.route('https://cdnjs.cloudflare.com/**', lambda route: route.abort())
            # Test local bundled CSS and scripts in a single origin; no live website is fetched.
            page.goto('http://127.0.0.1:8000/', wait_until='domcontentloaded')
            page.locator('#demoBtn').click()
            page.locator('#aiAnalyzeBtn').click()
            assert page.locator('#aiResult').is_visible()
            assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), f'horizontal overflow at {width}px'
            assert page.locator('#downloadAnalysis').is_enabled()
            page.screenshot(path=str(OUT / f'demo-{width}.png'), full_page=True)
            page.close()
        browser.close()

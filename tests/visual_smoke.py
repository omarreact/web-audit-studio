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
            assert page.locator('#stats').inner_text() == '2 pages · 1/1 assets · 0 errors'
            page.locator('#aiAnalyzeBtn').click()
            assert page.locator('#aiResult').is_visible()
            assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), f'horizontal overflow at {width}px'
            assert page.locator('#downloadAnalysis').is_enabled()
            heading = page.frame_locator('#previewFrame').locator('h1')
            heading.wait_for(timeout=5000)
            assert heading.is_visible()
            preview_color = page.frame_locator('#previewFrame').locator('body').evaluate(
                'el => getComputedStyle(el).backgroundColor'
            )
            assert preview_color == 'rgb(7, 23, 37)', f'demo preview CSS missing at {width}px: {preview_color}'
            page.locator('#previewFrame').screenshot(path=str(OUT / f'preview-{width}.png'))
            page.screenshot(path=str(OUT / f'demo-{width}.png'), full_page=True)
            page.close()
        browser.close()

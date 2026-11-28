# PIN SiteForge

Public app: https://save.pincodeit.com/

PIN SiteForge turns one authorized public page, or an HTML zip with `index.html`, into an installable WordPress block theme.

## What this build does

1. Fetch a public URL through the worker proxy, or read an uploaded HTML zip in the browser.
2. Collect stylesheets and images. Scripts are not executed.
3. Ask for theme name, slug, version and author.
4. Compile a block theme:
   - `style.css`, `theme.json` (version 3), `functions.php`
   - `templates/` for front page, page, single, archive, search, 404
   - `parts/header.html` and `parts/footer.html`
   - PHP patterns for header, footer and the converted front page
   - prefixed source CSS under `.pin-source`
   - `screenshot.png`
5. Download an installable theme zip, or a package with `website-content.json`, `website-content.xml`, `design-system.json` and `conversion-report.json`.

The old one-step HTML zip is still available as “শুধু HTML জিপ”.

## Architecture baseline

Theme shape follows the official block theme handbook and the structure already used in `omarreact/WpBlockThemeFSE` (`theme.json` version 3, template parts, patterns, no page builder). It is not hardcoded to Meta Grey Label.

## Security

The worker rejects localhost, link-local, private and metadata addresses, and URLs with embedded passwords. Uploaded zips reject `..` and absolute paths. Generated PHP does not call `eval`. Downloaded scripts are stripped.

## Not done yet

- Multi-page crawl, sitemap and GitHub import
- WordPress Playground install and Playwright visual regression
- Measured parity score. The report marks `visual-regression` as not passed on purpose.
- Carousels, forms and account-only content

Do not describe a generated theme as production-identical until those checks exist.

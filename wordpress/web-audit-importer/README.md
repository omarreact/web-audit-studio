# Web Audit Studio Page Importer — WordPress companion plugin

This is **separate from the theme** and is not installed automatically. WordPress does not activate bundled plugins when a theme is installed. Upload/install the plugin folder through the WordPress Plugins interface, then go to **Tools → Web Audit Import**.

1. Export **Editable WordPress FSE ZIP (experimental)** from the new Web Audit Studio AI panel.
2. Install and activate the exported FSE theme manually in a **staging WordPress** site.
3. Extract `web-audit-pages.json` from the ZIP.
4. Install and activate this companion plugin separately, and upload the JSON through the Tools page while logged in as an administrator who can use `unfiltered_html`.
5. New pages are created as **drafts**. Existing pages are never overwritten. Review every page, image, mobile layout, form, accessibility issue, and interactivity before publishing.

This importer does not sideload media, migrate databases, install plugins, wire authentication, or convert complex JavaScript behavior. Asset placeholders require the generated theme to be active. Importing data from unknown/untrusted sources is unsafe; only use captures you are authorized to transform.

Security: nonce and capability checks, file size and schema caps, sanitized slugs/titles, block-name/attribute allowlists and `wp_kses_post`, no overwrites and draft-only imports. Test on staging first.

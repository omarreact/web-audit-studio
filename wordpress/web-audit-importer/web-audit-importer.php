<?php
/**
 * Plugin Name: Web Audit Studio Page Importer
 * Description: Review-first import of generated Gutenberg pages from Web Audit Studio JSON. Requires explicit administrator action.
 * Version: 0.1.0
 * Requires at least: 6.6
 * Requires PHP: 8.0
 * License: GPL-2.0-or-later
 * Text Domain: web-audit-importer
 */
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/** Only Gutenberg blocks produced by the native experimental converter. */
function wasi_allowed_blocks() {
    return array( 'core/heading', 'core/paragraph', 'core/image', 'core/list', 'core/list-item', 'core/buttons', 'core/button', 'core/separator' );
}

/** Recursively sanitize a parsed Gutenberg document before serialization. */
function wasi_sanitize_block( $block, $depth = 0 ) {
    if ( $depth > 15 || ! is_array( $block ) || ! in_array( $block['blockName'] ?? '', wasi_allowed_blocks(), true ) ) {
        return null;
    }
    // Whitelist known block attributes; never pass arbitrary imported settings.
    $raw_attributes = isset( $block['attrs'] ) && is_array( $block['attrs'] ) ? $block['attrs'] : array();
    $attrs = array();
    if ( 'core/heading' === $block['blockName'] && isset( $raw_attributes['level'] ) ) {
        $attrs['level'] = max( 1, min( 6, absint( $raw_attributes['level'] ) ) );
    }
    if ( 'core/list' === $block['blockName'] && isset( $raw_attributes['ordered'] ) ) {
        $attrs['ordered'] = (bool) $raw_attributes['ordered'];
    }
    $block['attrs'] = $attrs;
    $children = array();
    foreach ( $block['innerBlocks'] ?? array() as $child ) {
        $safe = wasi_sanitize_block( $child, $depth + 1 );
        if ( null !== $safe ) {
            $children[] = $safe;
        }
    }
    $block['innerBlocks'] = $children;
    $block['innerHTML'] = wp_kses_post( $block['innerHTML'] ?? '' );
    $parts = array();
    foreach ( $block['innerContent'] ?? array() as $part ) {
        // Null placeholders correspond to nested blocks. Drop placeholders for rejected children.
        $parts[] = is_string( $part ) ? wp_kses_post( $part ) : null;
    }
    // A source must not smuggle non-whitelisted blocks into innerContent slots.
    $nonnull = count( array_filter( $parts, 'is_null' ) );
    if ( $nonnull !== count( $children ) ) {
        return null;
    }
    $block['innerContent'] = $parts;
    return $block;
}

function wasi_import_admin_page() {
    if ( ! current_user_can( 'manage_options' ) || ! current_user_can( 'unfiltered_html' ) ) {
        wp_die( esc_html__( 'Administrator with unfiltered HTML permission required.', 'web-audit-importer' ) );
    }
    ?>
    <div class="wrap">
      <h1>Web Audit Studio — Page Importer</h1>
      <p>Upload <code>web-audit-pages.json</code> from an editable WordPress export. This tool creates draft pages; it never activates a theme, publishes pages, overwrites existing pages, or updates your homepage automatically.</p>
      <?php if ( isset( $_GET['wasi_report'] ) ) : ?>
        <div class="notice notice-info"><p><?php echo esc_html( sanitize_text_field( wp_unslash( $_GET['wasi_report'] ) ) ); ?></p></div>
      <?php endif; ?>
      <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" enctype="multipart/form-data">
        <?php wp_nonce_field( 'wasi_import_pages' ); ?>
        <input type="hidden" name="action" value="wasi_import_pages">
        <p><label for="wasi_file">Pages JSON (maximum 2 MB)</label></p>
        <input type="file" name="wasi_file" id="wasi_file" accept="application/json,.json" required>
        <?php submit_button( 'Import new draft pages' ); ?>
      </form>
    </div>
    <?php
}
add_action( 'admin_menu', static function () {
    add_management_page( 'Web Audit Import', 'Web Audit Import', 'manage_options', 'wasi-import', 'wasi_import_admin_page' );
} );

add_action( 'admin_post_wasi_import_pages', static function () {
    if ( ! current_user_can( 'manage_options' ) || ! current_user_can( 'unfiltered_html' ) ) {
        wp_die( 'Insufficient permissions', '', array( 'response' => 403 ) );
    }
    check_admin_referer( 'wasi_import_pages' );
    if ( empty( $_FILES['wasi_file'] ) || ! isset( $_FILES['wasi_file']['tmp_name'] ) || UPLOAD_ERR_OK !== (int) $_FILES['wasi_file']['error'] ) {
        wp_die( 'Upload failed' );
    }
    $upload = $_FILES['wasi_file'];
    $size = (int) $upload['size'];
    if ( $size < 1 || $size > 2 * 1024 * 1024 || ! is_uploaded_file( $upload['tmp_name'] ) ) {
        wp_die( 'Invalid upload or file exceeds 2 MB' );
    }
    $payload = file_get_contents( $upload['tmp_name'], false, null, 0, 2 * 1024 * 1024 + 1 );
    $data = json_decode( $payload, true );
    if ( ! is_array( $data ) || 1 !== (int) ( $data['schemaVersion'] ?? -1 ) || 'wordpress-fse' !== ( $data['target'] ?? '' ) || ! isset( $data['pages'] ) || ! is_array( $data['pages'] ) || count( $data['pages'] ) > 100 ) {
        wp_die( 'Unsupported pages manifest' );
    }
    $created = 0;
    $skipped = 0;
    foreach ( $data['pages'] as $entry ) {
        if ( ! is_array( $entry ) ) { ++$skipped; continue; }
        $slug = sanitize_title( $entry['slug'] ?? '' );
        $title = sanitize_text_field( $entry['title'] ?? '' );
        $source = $entry['blocks'] ?? '';
        if ( ! $slug || ! $title || ! is_string( $source ) || strlen( $source ) > 250000 || get_page_by_path( $slug, OBJECT, 'page' ) ) {
            ++$skipped;
            continue;
        }
        $safe_blocks = array();
        foreach ( parse_blocks( $source ) as $block ) {
            $clean = wasi_sanitize_block( $block );
            if ( null !== $clean ) { $safe_blocks[] = $clean; }
        }
        if ( ! $safe_blocks ) { ++$skipped; continue; }
        $post_id = wp_insert_post( array( 'post_type' => 'page', 'post_status' => 'draft', 'post_name' => $slug,
             'post_title' => $title, 'post_content' => serialize_blocks( $safe_blocks ) ), true );
        if ( is_wp_error( $post_id ) ) { ++$skipped; continue; }
        ++$created;
    }
    $message = sprintf( 'Created %d draft page(s). Skipped %d (existing, invalid or unsupported).', $created, $skipped );
    wp_safe_redirect( add_query_arg( array( 'page' => 'wasi-import', 'wasi_report' => $message ), admin_url( 'tools.php' ) ) );
    exit;
} );

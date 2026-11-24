<?php
// Executed only inside an ephemeral WordPress test instance with the importer active.
if ( ! function_exists( 'wasi_sanitize_block' ) ) {
    throw new RuntimeException( 'Importer plugin was not activated.' );
}

$valid = '<!-- wp:heading {"level":2} --><h2 class="wp-block-heading">Demo heading</h2><!-- /wp:heading -->'
    . '<!-- wp:paragraph --><p>Editable text</p><!-- /wp:paragraph -->';
$malicious = '<!-- wp:html --><script>alert(1)</script><!-- /wp:html -->'
    . '<!-- wp:paragraph --><p onclick="alert(2)">Safe<script>alert(3)</script></p><!-- /wp:paragraph -->';
$clean = array();
foreach ( parse_blocks( $valid . $malicious ) as $block ) {
    $safe = wasi_sanitize_block( $block );
    if ( null !== $safe ) { $clean[] = $safe; }
}
if ( count( $clean ) !== 3 ) {
    throw new RuntimeException( 'The importer did not keep exactly the three allowed blocks.' );
}
$serialized = serialize_blocks( $clean );
if ( str_contains( $serialized, '<script' ) || str_contains( $serialized, 'onclick' ) || str_contains( $serialized, 'wp:html' ) ) {
    throw new RuntimeException( 'Executable markup survived block sanitization.' );
}
$id = wp_insert_post( array(
    'post_type' => 'page', 'post_status' => 'draft', 'post_name' => 'wasi-staging-fixture',
    'post_title' => 'Importer staging fixture', 'post_content' => $serialized,
), true );
if ( is_wp_error( $id ) || get_post_status( $id ) !== 'draft' || ! has_block( 'core/heading', $id ) ) {
    throw new RuntimeException( 'Draft page creation or native block serialization failed.' );
}
wp_delete_post( $id, true );
WP_CLI::success( 'Importer activated; allowed blocks, sanitization and draft-page persistence passed.' );

<?php
/**
 * Security regression checks (translator XSS, shadow-post exposure, REST
 * authorisation, language scope, geo/cache hardening).
 *
 * Run against a development site that has GemTranslate active:
 *
 *     wp eval-file wp-content/plugins/gemtranslate/tests/security-regression.php
 *
 * It creates temporary languages, posts, a user and strings, and deletes them
 * in a `finally` block. Do not run it on a production site.
 */
use GemTranslate\Language\Context;
use GemTranslate\Translation\TranslationLoader;
use GemTranslate\Translation\ShadowPostSync;
use GemTranslate\Translation\StringTranslator;
use GemTranslate\Geo\TrustedProxy;

add_filter( 'gtrans_trust_cli_markup', '__return_false' );
$results = [];
$check = function ( $name, $cond ) use ( &$results ) {
	$results[] = [ $name, (bool) $cond ];
};

$reg      = new \GemTranslate\Language\LanguageRegistry();
$created  = [];
$posts    = [];
$users    = [];
$strings  = [];

try {
	foreach ( [ 'es' => 'es_ES', 'fr' => 'fr_FR' ] as $code => $loc ) {
		if ( ! isset( Context::active_languages()[ $code ] ) ) {
			$reg->insert( [ 'code' => $code, 'locale' => $loc, 'name' => 'Tmp ' . $code, 'native_name' => 'Tmp', 'active' => 1, 'position' => 9 ] );
			$created[] = $code;
		}
	}
	Context::flush();

	$admin_id = (int) get_users( [ 'role' => 'administrator', 'number' => 1, 'fields' => 'ID' ] )[0];
	wp_set_current_user( $admin_id );

	// ---------- S1: sanitize on save ----------
	$tid = wp_insert_user( [ 'user_login' => 'tmp_translator_' . wp_generate_password( 6, false ), 'user_pass' => wp_generate_password(), 'role' => 'gtrans_translator' ] );
	$users[] = $tid;
	wp_set_current_user( $tid );
	$evil = '<p>hi</p><script>alert(1)</script><img src=x onerror=alert(2)>';
	$clean = \GemTranslate\Helper::sanitize_markup( $evil );
	$check( 'S1 translator: <script> stripped', false === stripos( $clean, '<script' ) );
	$check( 'S1 translator: onerror stripped', false === stripos( $clean, 'onerror' ) );
	$check( 'S1 translator: <p> kept', false !== strpos( $clean, '<p>hi</p>' ) );
	$check( 'S1 translator: block comment kept', false !== strpos( \GemTranslate\Helper::sanitize_markup( '<!-- wp:paragraph --><p>x</p><!-- /wp:paragraph -->' ), '<!-- wp:paragraph -->' ) );
	wp_set_current_user( $admin_id );
	$check( 'S1 admin (unfiltered_html): value untouched', \GemTranslate\Helper::sanitize_markup( $evil ) === $evil );

	// Menu URL override scheme.
	$ref = esc_url_raw( 'javascript:alert(1)' );
	$check( 'S1 menu url: javascript: dropped', '' === $ref );

	// ---------- S2/S3: shadow ----------
	$src = wp_insert_post( [ 'post_type' => 'page', 'post_status' => 'publish', 'post_title' => 'TMP gtrans src', 'post_content' => 'secret source', 'post_password' => 'pw123', 'post_name' => 'tmp-gtrans-src' ] );
	$posts[] = $src;
	$shadow = ShadowPostSync::ensure_for( $src, 'es', '', [ 'title' => 'TMP es', 'content' => 'secreto', 'slug' => 'tmp-gtrans-src' ] );
	$posts[] = $shadow;
	$check( 'S2 setup: shadow created', $shadow > 0 );

	wp_set_current_user( 0 );
	Context::set( 'es' );
	// Simulate WP_Query main-query result for the source page.
	$q = new WP_Query();
	$q->is_main_query_override = true;
	$GLOBALS['wp_the_query'] = $q;
	$GLOBALS['wp_query']     = $q;
	$swapped = ShadowPostSync::swap_in_shadow_posts( [ get_post( $src ) ], $q );
	$check( 'S2 swapped post is the shadow', $swapped && (int) $swapped[0]->ID === (int) $shadow );
	$check( 'S2 password carried over', $swapped && 'pw123' === $swapped[0]->post_password );
	$check( 'S2 post_password_required() true', $swapped && post_password_required( $swapped[0] ) );

	// Direct hit on the shadow as a visitor, default language and es.
	foreach ( [ 'es', 'en' ] as $l ) {
		Context::set( $l );
		$direct = ShadowPostSync::swap_in_shadow_posts( [ get_post( $shadow ) ], $q );
		$check( "S3 direct shadow request dropped ($l)", empty( $direct ) );
	}
	wp_set_current_user( $admin_id );
	Context::set( 'en' );
	$direct = ShadowPostSync::swap_in_shadow_posts( [ get_post( $shadow ) ], $q );
	$check( 'S3 editor can still reach shadow', ! empty( $direct ) );

	// REST single item.
	wp_set_current_user( 0 );
	do_action( 'rest_api_init' );
	$res = rest_do_request( new WP_REST_Request( 'GET', '/wp/v2/pages/' . $shadow ) );
	$check( 'S3 REST /wp/v2/pages/<shadow> -> 404 for visitor (got ' . $res->get_status() . ')', 404 === $res->get_status() );
	$res = rest_do_request( new WP_REST_Request( 'GET', '/wp/v2/pages/' . $src ) );
	$check( 'S3 REST source page still readable (got ' . $res->get_status() . ')', 200 === $res->get_status() );
	wp_set_current_user( $admin_id );
	$res = rest_do_request( new WP_REST_Request( 'GET', '/wp/v2/pages/' . $shadow ) );
	$check( 'S3 REST shadow readable for admin (got ' . $res->get_status() . ')', 200 === $res->get_status() );

	// ---------- S4: per-post authorisation ----------
	$draft = wp_insert_post( [ 'post_type' => 'post', 'post_status' => 'draft', 'post_title' => 'TMP draft' ] );
	$priv  = wp_insert_post( [ 'post_type' => 'post', 'post_status' => 'private', 'post_title' => 'TMP private' ] );
	$pub   = wp_insert_post( [ 'post_type' => 'post', 'post_status' => 'publish', 'post_title' => 'TMP public' ] );
	array_push( $posts, $draft, $priv, $pub );
	$ctl = new \GemTranslate\API\PostTranslations();
	$mk  = function ( $id ) {
		$r = new WP_REST_Request( 'GET', '/gemtranslate/v1/posts/' . $id . '/translations' );
		$r->set_param( 'id', $id );
		return $r;
	};
	wp_set_current_user( $tid );
	$check( 'S4 translator: draft denied', is_wp_error( $ctl->permissions_translate_post( $mk( $draft ) ) ) );
	$check( 'S4 translator: private denied', is_wp_error( $ctl->permissions_translate_post( $mk( $priv ) ) ) );
	$check( 'S4 translator: password-protected denied', is_wp_error( $ctl->permissions_translate_post( $mk( $src ) ) ) );
	$check( 'S4 translator: shadow denied', is_wp_error( $ctl->permissions_translate_post( $mk( $shadow ) ) ) );
	$check( 'S4 translator: published allowed', true === $ctl->permissions_translate_post( $mk( $pub ) ) );
	$ir = new WP_REST_Request( 'GET', '/gemtranslate/v1/posts' );
	$ir->set_param( 'post_type', 'post' );
	$ir->set_param( 'status', 'any' );
	$idx  = $ctl->index( $ir );
	$ids  = wp_list_pluck( $idx->get_data()['data'] ?? [], 'id' );
	$check( 'S4 translator index: no draft/private', ! in_array( $draft, $ids, true ) && ! in_array( $priv, $ids, true ) && in_array( $pub, $ids, true ) );
	$ir2 = new WP_REST_Request( 'GET', '/gemtranslate/v1/posts' );
	$ir2->set_param( 'post_type', 'shop_order' );
	$bad = $ctl->index( $ir2 );
	$check( 'S4 non-public/unknown post_type rejected', $bad instanceof WP_Error || ( $bad instanceof WP_REST_Response && $bad->get_status() >= 400 ) );
	wp_set_current_user( $admin_id );
	$check( 'S4 admin: draft allowed', true === $ctl->permissions_translate_post( $mk( $draft ) ) );
	$check( 'S4 admin: private allowed', true === $ctl->permissions_translate_post( $mk( $priv ) ) );
	$ir = new WP_REST_Request( 'GET', '/gemtranslate/v1/posts' );
	$ir->set_param( 'post_type', 'post' );
	$ir->set_param( 'status', 'any' );
	$ids = wp_list_pluck( $ctl->index( $ir )->get_data()['data'] ?? [], 'id' );
	$check( 'S4 admin index: sees draft', in_array( $draft, $ids, true ) );

	// ---------- S5: bulk save scope ----------
	$sid = StringTranslator::register_string( 'TMP gtrans string ' . wp_generate_password( 6, false ), 'tmp-domain', '' );
	$strings[] = $sid;
	\GemTranslate\Admin\LanguageScope::set_for_user( $tid, [ 'fr' ] );
	wp_set_current_user( $tid );
	$sc = new \GemTranslate\API\Strings();
	$br = new WP_REST_Request( 'POST', '/gemtranslate/v1/strings/bulk' );
	$br->set_header( 'content-type', 'application/json' );
	$br->set_body( wp_json_encode( [ 'translations' => [
		[ 'string_id' => $sid, 'language_code' => 'es', 'value' => 'no deberia' ],
		[ 'string_id' => $sid, 'language_code' => 'fr', 'value' => 'ok' ],
	] ] ) );
	$out = $sc->bulk_save( $br )->get_data();
	$check( 'S5 scoped translator: only 1 of 2 rows saved (saved=' . ( $out['data']['saved'] ?? '?' ) . ')', 1 === ( $out['data']['saved'] ?? null ) );
	global $wpdb;
	$t = \GemTranslate\Helper::table( 'string_translations' );
	$es = $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM $t WHERE string_id=%d AND language_code='es'", $sid ) );
	$check( 'S5 es row NOT written', 0 === (int) $es );
	wp_set_current_user( $admin_id );

	// scan custom path
	$sr = new WP_REST_Request( 'POST', '/gemtranslate/v1/strings/scan' );
	$sr->set_param( 'target', 'custom' );
	$sr->set_param( 'path', '/etc' );
	$r = $sc->scan( $sr );
	$check( 'S5+ scan custom /etc rejected', ( $r instanceof WP_Error || ( $r instanceof WP_REST_Response && $r->get_status() >= 400 ) ) );
	$sr->set_param( 'path', WP_CONTENT_DIR . '/../' );
	$r = $sc->scan( $sr );
	$check( 'S5+ scan custom ../ escape rejected', ( $r instanceof WP_Error || ( $r instanceof WP_REST_Response && $r->get_status() >= 400 ) ) );
	wp_set_current_user( $tid );
	$sr->set_param( 'path', WP_PLUGIN_DIR . '/hello' );
	$r = $sc->scan( $sr );
	$check( 'S5+ translator cannot scan custom path', ( $r instanceof WP_Error || ( $r instanceof WP_REST_Response && $r->get_status() >= 400 ) ) );
	wp_set_current_user( $admin_id );

	// ---------- S6 ----------
	$check( 'S6 in_range v4 hit', TrustedProxy::in_range( '104.16.5.9', '104.16.0.0/13' ) );
	$check( 'S6 in_range v4 miss', ! TrustedProxy::in_range( '8.8.8.8', '104.16.0.0/13' ) );
	$check( 'S6 in_range v4 /20 boundary', TrustedProxy::in_range( '173.245.63.255', '173.245.48.0/20' ) && ! TrustedProxy::in_range( '173.245.64.0', '173.245.48.0/20' ) );
	$check( 'S6 in_range v6 hit', TrustedProxy::in_range( '2606:4700::1', '2606:4700::/32' ) );
	$check( 'S6 in_range v6 vs v4 mismatch', ! TrustedProxy::in_range( '1.2.3.4', '2606:4700::/32' ) );
	$check( 'S6 in_range bare addr', TrustedProxy::in_range( '10.0.0.5', '10.0.0.5' ) && ! TrustedProxy::in_range( '10.0.0.6', '10.0.0.5' ) );
	$srv = $_SERVER;
	$_SERVER['REMOTE_ADDR'] = '203.0.113.7';
	$_SERVER['HTTP_X_FORWARDED_FOR'] = '1.2.3.4';
	$_SERVER['HTTP_CF_CONNECTING_IP'] = '5.6.7.8';
	$_SERVER['HTTP_CF_IPCOUNTRY'] = 'US';
	$check( 'S6 untrusted peer: spoofed headers ignored (ip=' . TrustedProxy::client_ip() . ')', '203.0.113.7' === TrustedProxy::client_ip() );
	$check( 'S6 untrusted peer: CF-IPCountry ignored', '' === ( new \GemTranslate\Geo\CloudflareDetector() )->detect() );
	$_SERVER['REMOTE_ADDR'] = '104.16.1.1';
	$check( 'S6 Cloudflare peer: CF-Connecting-IP used', '5.6.7.8' === TrustedProxy::client_ip() );
	$check( 'S6 Cloudflare peer: CF-IPCountry used', 'US' === ( new \GemTranslate\Geo\CloudflareDetector() )->detect() );
	$_SERVER = $srv;
	add_filter( 'gtrans_trusted_proxies', function ( $r ) { $r[] = '203.0.113.0/24'; return $r; } );
	$_SERVER['REMOTE_ADDR'] = '203.0.113.7';
	$_SERVER['HTTP_X_FORWARDED_FOR'] = '9.9.9.9, 10.0.0.1';
	$check( 'S6 custom trusted proxy via filter honours XFF', '9.9.9.9' === TrustedProxy::client_ip() );
	$_SERVER = $srv;
	remove_all_filters( 'gtrans_trusted_proxies' );

	// no-cache marker when a country variant exists and the visitor is auto-detected
	TranslationLoader::save_translation( $pub, 'es', [ 'title' => 'base es', 'content' => 'x', 'country_code' => '' , 'translation_mode' => 'string_only' ] );
	TranslationLoader::save_translation( $pub, 'es', [ 'title' => 'mx es', 'content' => 'y', 'country_code' => 'MX', 'translation_mode' => 'string_only' ] );
	$opt = json_decode( get_option( GTRANS_SETTINGS_NAME, '{}' ), true );
	$orig_geo = $opt['geo_enabled'] ?? null;
	$opt['geo_enabled'] = true;
	update_option( GTRANS_SETTINGS_NAME, wp_json_encode( $opt ) );
	wp_set_current_user( 0 );
	Context::set( 'es' );
	\GemTranslate\Language\CountryContext::set( 'MX' );
	$check( 'S6 DONOTCACHEPAGE not yet defined', ! defined( 'DONOTCACHEPAGE' ) );
	$row = TranslationLoader::get_for_post( $pub );
	$check( 'S6 country variant served (title=' . ( $row['title'] ?? '-' ) . ')', 'mx es' === ( $row['title'] ?? '' ) );
	$check( 'S6 page marked uncacheable (DONOTCACHEPAGE)', defined( 'DONOTCACHEPAGE' ) && DONOTCACHEPAGE );
	if ( null === $orig_geo ) { unset( $opt['geo_enabled'] ); } else { $opt['geo_enabled'] = $orig_geo; }
	update_option( GTRANS_SETTINGS_NAME, wp_json_encode( $opt ) );
} catch ( \Throwable $e ) {
	$results[] = [ 'EXCEPTION ' . $e->getMessage() . ' @ ' . basename( $e->getFile() ) . ':' . $e->getLine(), false ];
} finally {
	wp_set_current_user( 0 );
	foreach ( array_unique( $posts ) as $pid ) {
		if ( $pid ) {
			foreach ( [ 'es', 'fr' ] as $l ) {
				TranslationLoader::delete_translation( $pid, $l );
			}
			wp_delete_post( $pid, true );
		}
	}
	global $wpdb;
	foreach ( $strings as $sid ) {
		$wpdb->delete( \GemTranslate\Helper::table( 'string_translations' ), [ 'string_id' => $sid ] );
		$wpdb->delete( \GemTranslate\Helper::table( 'strings' ), [ 'string_id' => $sid ] );
	}
	require_once ABSPATH . 'wp-admin/includes/user.php';
	foreach ( $users as $uid ) {
		wp_delete_user( $uid );
	}
	foreach ( $created as $code ) {
		$reg->delete( $code );
	}
	Context::flush();
}

$fail = 0;
foreach ( $results as $r ) {
	echo ( $r[1] ? 'PASS  ' : 'FAIL  ' ) . $r[0] . "\n";
	if ( ! $r[1] ) {
		$fail++;
	}
}
echo "\n" . count( $results ) . " checks, $fail failed\n";

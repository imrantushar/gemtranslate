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

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

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
	$ir->set_param( 'per_page', 100 );
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
	$ir->set_param( 'per_page', 100 );
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

	// ---------- S7: public geo endpoints ----------
	$geo = new \GemTranslate\API\Geo();
	$det = $geo->detect( new WP_REST_Request( 'GET', '/gemtranslate/v1/geo/detect' ) )->get_data();
	$check( 'S7 detect() does not expose detector sources', ! isset( $det['data']['sources'] ) );
	$rl = new ReflectionMethod( $geo, 'rate_limited' );
	$rl->setAccessible( true );
	$_SERVER['REMOTE_ADDR'] = '198.51.100.23';
	$limited_at = 0;
	for ( $i = 1; $i <= 30; $i++ ) {
		if ( $rl->invoke( $geo ) ) {
			$limited_at = $i;
			break;
		}
	}
	$check( 'S7 cookie writes rate-limited after ' . \GemTranslate\API\Geo::COOKIE_RATE_LIMIT . ' (limited at call ' . $limited_at . ')', \GemTranslate\API\Geo::COOKIE_RATE_LIMIT + 1 === $limited_at );
	delete_transient( 'gtrans_geo_rl_' . md5( '198.51.100.23' ) );
	$_SERVER['REMOTE_ADDR'] = $srv['REMOTE_ADDR'] ?? '';
	$opt0 = json_decode( get_option( GTRANS_SETTINGS_NAME, '{}' ), true );
	$off  = $geo->set_cookie( new WP_REST_Request( 'POST', '/gemtranslate/v1/geo/cookie' ) );
	$check( 'S7 cookie endpoint refuses when geo disabled', ! empty( $opt0['geo_enabled'] ) || is_wp_error( $off ) );

	// ---------- S8: import / export hardening ----------
	$unit = '<unit id="string:1"><segment><source>Hi</source><target>Hola</target></segment></unit>';
	$ok   = '<?xml version="1.0"?><xliff xmlns="urn:oasis:names:tc:xliff:document:2.0" version="2.1" srcLang="en" trgLang="es"><file id="f">' . $unit . '</file></xliff>';
	$check( 'S8 xliff: valid document parsed', 1 === count( \GemTranslate\Io\Xliff::parse( $ok ) ) );
	$xxe  = '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><xliff xmlns="urn:oasis:names:tc:xliff:document:2.0" version="2.1"><file id="f"><unit id="string:1"><segment><source>&e;</source><target>&e;</target></segment></unit></file></xliff>';
	$check( 'S8 xliff: DOCTYPE/entity document refused', array() === \GemTranslate\Io\Xliff::parse( $xxe ) );
	$check( 'S8 xliff: oversized input refused', array() === \GemTranslate\Io\Xliff::parse( str_repeat( 'a', \GemTranslate\Io\Xliff::MAX_BYTES + 1 ) ) );
	$csv  = \GemTranslate\Io\Csv::build( [
		[ 'id' => 'string:1', 'source' => '=HYPERLINK("http://x","y")', 'target' => '-10% off', 'note' => '@SUM(1)' ],
		[ 'id' => 'string:2', 'source' => 'plain', 'target' => "'quoted", 'note' => '' ],
	] );
	$check( 'S8 csv: formula cells neutralised in export', false !== strpos( $csv, "'=HYPERLINK" ) && false !== strpos( $csv, "'@SUM" ) && false !== strpos( $csv, "'-10% off" ) );
	$back = \GemTranslate\Io\Csv::parse( $csv );
	$check( 'S8 csv: round trip restores original text', '=HYPERLINK("http://x","y")' === $back[0]['source'] && '-10% off' === $back[0]['target'] && "'quoted" === $back[1]['target'] );
	$dec = new ReflectionMethod( \GemTranslate\Migration\PolylangImporter::class, 'decode' );
	$dec->setAccessible( true );
	$arr = $dec->invoke( null, 'a:1:{s:2:"es";i:5;}' );
	$obj = $dec->invoke( null, 'O:8:"stdClass":1:{s:1:"a";i:1;}' );
	$check( 'S8 polylang decode: array map decoded', array( 'es' => 5 ) === $arr );
	$check( 'S8 polylang decode: objects are not instantiated', ! ( $obj instanceof stdClass ) );


	// ---------- Pro: revisions, SEO, import/export, custom fields ----------
	if ( class_exists( '\\GemTranslate\\API\\Revisions' ) ) {
		\GemTranslate\Admin\LanguageScope::set_for_user( $tid, [] ); // Unrestricted again; scope was tested above.
		wp_set_current_user( $admin_id );
		$pubp  = wp_insert_post( [ 'post_type' => 'post', 'post_status' => 'publish', 'post_title' => 'TMP pro public' ] );
		$privp = wp_insert_post( [ 'post_type' => 'post', 'post_status' => 'draft', 'post_title' => 'TMP pro draft' ] );
		array_push( $posts, $pubp, $privp );
		foreach ( [ $pubp, $privp ] as $pid ) {
			TranslationLoader::save_translation( $pid, 'es', [ 'title' => 'v1 ' . $pid, 'content' => 'one', 'translation_mode' => 'custom_layout' ] );
			TranslationLoader::save_translation( $pid, 'es', [ 'title' => 'v2 ' . $pid, 'content' => 'two', 'translation_mode' => 'custom_layout' ] );
		}
		global $wpdb;
		$rt   = \GemTranslate\Helper::table( 'post_translation_revisions' );
		$rev_pub  = (int) $wpdb->get_var( $wpdb->prepare( "SELECT revision_id FROM $rt WHERE post_id=%d ORDER BY revision_id DESC LIMIT 1", $pubp ) );
		$rev_priv = (int) $wpdb->get_var( $wpdb->prepare( "SELECT revision_id FROM $rt WHERE post_id=%d ORDER BY revision_id DESC LIMIT 1", $privp ) );
		$check( 'Pro setup: revisions exist', $rev_pub > 0 && $rev_priv > 0 );
		$rv = new \GemTranslate\API\Revisions();
		$req = function ( $post_id, $rev ) {
			$r = new WP_REST_Request( 'GET', "/gemtranslate/v1/posts/$post_id/translations/es/revisions/$rev" );
			$r->set_param( 'id', $post_id );
			$r->set_param( 'lang', 'es' );
			$r->set_param( 'revision_id', $rev );
			return $r;
		};
		wp_set_current_user( $tid );
		$check( 'Pro revisions: translator denied on a draft post', is_wp_error( $rv->permissions_translate_post( $req( $privp, $rev_priv ) ) ) );
		$check( 'Pro revisions: translator allowed on a published post', true === $rv->permissions_translate_post( $req( $pubp, $rev_pub ) ) );
		$cross = $rv->show( $req( $pubp, $rev_priv ) );
		$check( 'Pro revisions: another post\'s revision not readable via an allowed post', $cross instanceof WP_Error );
		$own = $rv->show( $req( $pubp, $rev_pub ) );
		$check( 'Pro revisions: own revision readable', $own instanceof WP_REST_Response );
		$dr = $req( $pubp, $rev_pub );
		$dr->set_param( 'a', $rev_pub );
		$dr->set_param( 'b', $rev_priv );
		$check( 'Pro revisions: diff against another post\'s revision refused', $rv->diff( $dr ) instanceof WP_Error );
		$rr = $req( $pubp, $rev_priv );
		$check( 'Pro revisions: revert from another post\'s revision refused', $rv->revert( $rr ) instanceof WP_Error );

		// SEO.
		$seo = new \GemTranslate\API\SEO();
		$sr  = new WP_REST_Request( 'PUT', "/gemtranslate/v1/seo/posts/$privp/es" );
		$sr->set_param( 'post_id', $privp );
		$sr->set_param( 'lang', 'es' );
		$check( 'Pro seo: translator denied on a draft post', is_wp_error( $seo->permissions_translate_post( $sr ) ) );
		wp_set_current_user( $admin_id );
		$sr2 = new WP_REST_Request( 'PUT', "/gemtranslate/v1/seo/posts/$pubp/es" );
		$sr2->set_header( 'content-type', 'application/json' );
		$sr2->set_body( wp_json_encode( [ 'meta_title' => 'T<script>x</script>', 'meta_desc' => "a\nb<b>", 'canonical_override' => 'javascript:alert(1)' ] ) );
		// Set the route params after the body: parsing the JSON body replaces earlier JSON-order params.
		$sr2->set_param( 'post_id', $pubp );
		$sr2->set_param( 'lang', 'es' );
		$sv = $seo->save( $sr2 );
		if ( is_wp_error( $sv ) ) {
			$results[] = [ 'Pro seo save error: ' . $sv->get_error_code() . ' ' . $sv->get_error_message(), false ];
			$sv = new WP_REST_Response( [ 'data' => [] ] );
		}
		$saved = $sv->get_data()['data'] ?? [];
		$check( 'Pro seo: tags stripped, javascript: canonical dropped', false === strpos( $saved['meta_title'] ?? 'x<', '<' ) && false === strpos( $saved['meta_desc'] ?? '<', '<' ) && '' === ( $saved['canonical_override'] ?? 'x' ) );
		$wpdb->query( $wpdb->prepare( 'DELETE FROM ' . \GemTranslate\Helper::table( 'seo_meta' ) . ' WHERE group_id = %d', TranslationLoader::group_id_for_post( $pubp ) ) );

		// Import / export.
		$io = new \GemTranslate\API\IO();
		wp_set_current_user( $tid );
		$ex = new WP_REST_Request( 'GET', '/gemtranslate/v1/export/posts' );
		$ex->set_param( 'lang', 'es' );
		$ex->set_param( 'format', 'csv' );
		$ex->set_param( 'post_type', 'post' );
		$prot = wp_insert_post( [ 'post_type' => 'post', 'post_status' => 'publish', 'post_title' => 'TMP pro protected', 'post_content' => 'topsecret', 'post_password' => 'pw' ] );
		$posts[] = $prot;
		$body = $io->export_posts( $ex )->get_data();
		$check( 'Pro export: protected post not exported to a translator', is_string( $body ) && false === strpos( $body, 'topsecret' ) && false !== strpos( $body, 'post:' . $pubp . ':' ) );
		$ex->set_param( 'post_type', 'shop_order' );
		$check( 'Pro export: non-public post type refused', $io->export_posts( $ex ) instanceof WP_Error );
		$imp = new WP_REST_Request( 'POST', '/gemtranslate/v1/import/posts' );
		$imp->set_param( 'lang', 'es' );
		$imp->set_param( 'format', 'csv' );
		$imp->set_param( 'body', "id,source,target\npost:$privp:title,x,HACKED\npost:$pubp:title,x,allowed title\n" );
		$out = $io->import_posts( $imp )->get_data();
		$title_priv = $wpdb->get_var( $wpdb->prepare( 'SELECT title FROM ' . \GemTranslate\Helper::table( 'post_translations' ) . " WHERE post_id=%d AND language_code='es' AND country_code=''", $privp ) );
		$title_pub  = $wpdb->get_var( $wpdb->prepare( 'SELECT title FROM ' . \GemTranslate\Helper::table( 'post_translations' ) . " WHERE post_id=%d AND language_code='es' AND country_code=''", $pubp ) );
		$check( 'Pro import: draft post untouched, published post saved', 'v2 ' . $privp === $title_priv && 'allowed title' === $title_pub );

		// Custom fields.
		\GemTranslate\Translation\MetaTranslator::save( $pubp, 'es', 'subtitle', '<p>ok</p><script>alert(1)</script>' );
		wp_set_current_user( $tid );
		\GemTranslate\Translation\MetaTranslator::save( $pubp, 'es', 'subtitle', '<p>ok</p><script>alert(1)</script>' );
		$mt = $wpdb->get_var( $wpdb->prepare( 'SELECT meta_value FROM ' . \GemTranslate\Helper::table( 'post_meta_translations' ) . " WHERE post_id=%d AND meta_key='subtitle'", $pubp ) );
		$check( 'Pro meta: translator script stripped from custom field', false === stripos( (string) $mt, '<script' ) && false !== strpos( (string) $mt, '<p>ok</p>' ) );
		\GemTranslate\Translation\MetaTranslator::save( $pubp, 'es', 'repeater', maybe_serialize( [ 'a' => [ 'x' => '<img src=x onerror=alert(1)>' ] ] ) );
		$mr = $wpdb->get_var( $wpdb->prepare( 'SELECT meta_value FROM ' . \GemTranslate\Helper::table( 'post_meta_translations' ) . " WHERE post_id=%d AND meta_key='repeater'", $pubp ) );
		$check( 'Pro meta: nested serialized value sanitised', false === stripos( (string) $mr, 'onerror' ) && is_array( maybe_unserialize( $mr ) ) );
		$wpdb->delete( \GemTranslate\Helper::table( 'post_meta_translations' ), [ 'post_id' => $pubp ] );
		$wpdb->query( $wpdb->prepare( 'DELETE FROM ' . $rt . ' WHERE post_id IN (%d,%d)', $pubp, $privp ) );
	} else {
		$results[] = [ 'Pro checks skipped (GemTranslate Pro not active)', true ];
	}
	wp_set_current_user( $admin_id );

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
	// Pro keeps revisions of translations; deleting a translation snapshots it first.
	$rev_table = \GemTranslate\Helper::table( 'post_translation_revisions' );
	if ( $posts && $wpdb->get_var( "SHOW TABLES LIKE '$rev_table'" ) ) {
		$wpdb->query( "DELETE FROM $rev_table WHERE post_id IN (" . implode( ',', array_map( 'intval', $posts ) ) . ')' );
	}
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

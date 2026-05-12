<?php
namespace Zentranslate\Translation;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Helper;
use Zentranslate\Language\Context;

/**
 * Runtime gettext override. Translates __() / _e() / esc_html__() etc.
 *
 * Strategy: load the full translated-string table for the current language
 * ONCE per request into an in-memory hash, then look up by hash(source).
 *
 * The lookup hash is hashed source+context+domain to disambiguate strings
 * with the same source text but different translation context.
 */
class StringTranslator {

	private static $map = null;
	private static $loaded = false;

	public static function init() {
		$self = new self();
		add_filter( 'gettext', [ $self, 'filter_gettext' ], 10, 3 );
		add_filter( 'gettext_with_context', [ $self, 'filter_gettext_with_context' ], 10, 4 );
		add_filter( 'ngettext', [ $self, 'filter_ngettext' ], 10, 5 );
	}

	public function filter_gettext( $translation, $text, $domain ) {
		if ( Context::is_default() ) {
			return $translation;
		}
		$value = $this->lookup( $text, '', $domain );
		return null !== $value ? $value : $translation;
	}

	public function filter_gettext_with_context( $translation, $text, $context, $domain ) {
		if ( Context::is_default() ) {
			return $translation;
		}
		$value = $this->lookup( $text, $context, $domain );
		return null !== $value ? $value : $translation;
	}

	public function filter_ngettext( $translation, $single, $plural, $number, $domain ) {
		if ( Context::is_default() ) {
			return $translation;
		}
		$text  = $number == 1 ? $single : $plural;
		$value = $this->lookup( $text, '', $domain );
		return null !== $value ? $value : $translation;
	}

	private function lookup( $text, $context, $domain ) {
		if ( ! self::$loaded ) {
			$this->load();
		}
		$key = self::hash( $text, $context, $domain );
		return self::$map[ $key ] ?? null;
	}

	/**
	 * Load all translated strings for the current language in one query.
	 */
	private function load() {
		self::$loaded = true;
		self::$map    = [];
		global $wpdb;
		$lang  = Context::current();
		$st    = Helper::table( 'strings' );
		$stt   = Helper::table( 'string_translations' );
		$query = $wpdb->prepare(
			"SELECT s.source, s.context, s.domain, t.value
			 FROM $stt AS t
			 INNER JOIN $st AS s ON s.string_id = t.string_id
			 WHERE t.language_code = %s AND t.status != 'draft' AND t.value <> ''",
			$lang
		);
		$rows = $wpdb->get_results( $query, ARRAY_A ) ?: [];
		foreach ( $rows as $row ) {
			$key = self::hash( $row['source'], $row['context'], $row['domain'] );
			self::$map[ $key ] = $row['value'];
		}
	}

	public static function hash( $source, $context, $domain ) {
		return md5( $source . "\x1f" . $context . "\x1f" . $domain );
	}

	public static function flush_runtime_cache() {
		self::$map    = null;
		self::$loaded = false;
	}

	/**
	 * Register a string (idempotent on hash).
	 *
	 * @return int string_id
	 */
	public static function register_string( $source, $domain = '', $context = '', $file_ref = '' ) {
		global $wpdb;
		$table = Helper::table( 'strings' );
		$hash  = md5( $source . "\x1f" . $context . "\x1f" . $domain );

		$existing = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT string_id FROM $table WHERE source_hash = %s AND domain = %s AND context = %s",
				$hash,
				$domain,
				$context
			)
		);
		if ( $existing ) {
			return $existing;
		}
		$wpdb->insert(
			$table,
			[
				'domain'      => $domain,
				'context'     => $context,
				'source'      => $source,
				'source_hash' => $hash,
				'file_ref'    => $file_ref,
				'created_at'  => Helper::get_time(),
			]
		);
		return (int) $wpdb->insert_id;
	}

	public static function save_translation( $string_id, $language_code, $value, $status = 'translated' ) {
		global $wpdb;
		$table = Helper::table( 'string_translations' );
		$lang  = strtolower( $language_code );
		$data  = [
			'string_id'     => (int) $string_id,
			'language_code' => $lang,
			'value'         => (string) $value,
			'status'        => (string) $status,
			'updated_at'    => Helper::get_time(),
		];
		$exists = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM $table WHERE string_id = %d AND language_code = %s",
				$string_id,
				$lang
			)
		);
		$ok = $exists
			? $wpdb->update( $table, $data, [ 'string_id' => $string_id, 'language_code' => $lang ] )
			: $wpdb->insert( $table, $data );

		self::flush_runtime_cache();
		return $ok !== false;
	}

	public static function list_strings( $args = [] ) {
		global $wpdb;
		$st  = Helper::table( 'strings' );
		$stt = Helper::table( 'string_translations' );

		$page     = max( 1, (int) ( $args['page'] ?? 1 ) );
		$per_page = max( 1, min( 200, (int) ( $args['per_page'] ?? 50 ) ) );
		$offset   = ( $page - 1 ) * $per_page;
		$search   = trim( (string) ( $args['search'] ?? '' ) );
		$domain   = (string) ( $args['domain'] ?? '' );
		$lang     = (string) ( $args['lang']   ?? '' );

		$where  = ' WHERE 1=1 ';
		$params = [];
		if ( '' !== $search ) {
			$where   .= ' AND s.source LIKE %s ';
			$params[] = '%' . $wpdb->esc_like( $search ) . '%';
		}
		if ( '' !== $domain ) {
			$where   .= ' AND s.domain = %s ';
			$params[] = $domain;
		}

		$select = "SELECT s.string_id, s.domain, s.context, s.source, s.file_ref";
		$join   = '';
		if ( '' !== $lang ) {
			$select .= ", t.value AS translation, t.status AS translation_status";
			$join    = " LEFT JOIN $stt AS t ON t.string_id = s.string_id AND t.language_code = %s ";
			array_unshift( $params, $lang );
		}

		$sql = $select . " FROM $st AS s " . $join . $where . " ORDER BY s.string_id DESC LIMIT %d OFFSET %d";
		$params[] = $per_page;
		$params[] = $offset;
		$prepared = $params ? $wpdb->prepare( $sql, $params ) : $sql;
		$rows     = $wpdb->get_results( $prepared, ARRAY_A ) ?: [];

		$total = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $st AS s" );

		return [
			'rows'  => $rows,
			'total' => $total,
			'page'  => $page,
			'per_page' => $per_page,
		];
	}

	public static function list_domains() {
		global $wpdb;
		$table = Helper::table( 'strings' );
		return $wpdb->get_col( "SELECT DISTINCT domain FROM $table ORDER BY domain ASC" ) ?: [];
	}
}

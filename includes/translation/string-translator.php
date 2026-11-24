<?php
namespace GemTranslate\Translation;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Helper;
use GemTranslate\Language\Context;

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
		add_filter( 'pre_load_script_translations', [ $self, 'filter_script_translations' ], 10, 4 );
	}

	/**
	 * Feed saved translations to `wp.i18n` for scripts that call
	 * wp_set_script_translations() — React/Gutenberg-based admin screens render
	 * their text in the browser, so the PHP gettext filters above never see it.
	 *
	 * Returns WordPress's Jed JSON for the script's text domain, built from our
	 * table and layered over the plugin's own .json file when it ships one.
	 *
	 * @param string|null $translations Jed JSON, or null to let WordPress load it.
	 * @param string|false $file        Path WordPress would read.
	 * @param string       $handle      Script handle.
	 * @param string       $domain      Text domain.
	 */
	public function filter_script_translations( $translations, $file, $handle, $domain ) {
		if ( null !== $translations || Context::is_default() ) {
			return $translations;
		}
		$lang    = Context::current();
		$entries = self::entries_for_domain( (string) $domain, $lang );
		if ( ! $entries ) {
			return $translations;
		}

		$locale = (string) ( Context::active_languages()[ $lang ]['locale'] ?? $lang );
		$data   = [
			'' => [
				'domain'       => (string) $domain,
				'lang'         => $locale,
				'plural-forms' => 'nplurals=2; plural=n != 1;',
			],
		];

		// Keep whatever the plugin already ships (e.g. community translations).
		if ( $file && is_readable( $file ) ) {
			$existing = json_decode( (string) file_get_contents( $file ), true );
			$bundle   = $existing['locale_data'][ $domain ] ?? $existing['locale_data']['messages'] ?? null;
			if ( is_array( $bundle ) ) {
				$data = array_merge( $bundle, $data );
				if ( isset( $bundle['']['plural-forms'] ) ) {
					$data['']['plural-forms'] = $bundle['']['plural-forms'];
				}
			}
		}

		foreach ( $entries as $row ) {
			// Jed keys a contextual string as "context\u0004source".
			$key          = '' !== $row['context'] ? $row['context'] . "\x04" . $row['source'] : $row['source'];
			$data[ $key ] = [ $row['value'] ];
		}

		return wp_json_encode( [
			'translation-revision-date' => gmdate( 'Y-m-d H:i:sO' ),
			'generator'                 => 'gemtranslate',
			'domain'                    => 'messages',
			'locale_data'               => [ 'messages' => $data ],
		] );
	}

	/**
	 * Saved translations for one text domain in one language.
	 *
	 * @return array<array{source:string,context:string,value:string}>
	 */
	private static function entries_for_domain( $domain, $lang ) {
		global $wpdb;
		return $wpdb->get_results(
			$wpdb->prepare(
				"SELECT s.source, s.context, t.value
				 FROM %i AS t
				 INNER JOIN %i AS s ON s.string_id = t.string_id
				 WHERE s.domain = %s AND t.language_code = %s AND t.status != 'draft' AND t.value <> ''",
				Helper::table( 'string_translations' ),
				Helper::table( 'strings' ),
				$domain,
				$lang
			),
			ARRAY_A
		) ?: [];
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
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT s.source, s.context, s.domain, t.value
				 FROM %i AS t
				 INNER JOIN %i AS s ON s.string_id = t.string_id
				 WHERE t.language_code = %s AND t.status != 'draft' AND t.value <> ''",
				Helper::table( 'string_translations' ),
				Helper::table( 'strings' ),
				$lang
			),
			ARRAY_A
		) ?: [];
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
			'value'         => Helper::sanitize_markup( $value ),
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
		$per_page = max( 1, min( 10000, (int) ( $args['per_page'] ?? 50 ) ) );
		$offset   = ( $page - 1 ) * $per_page;
		$search   = trim( (string) ( $args['search'] ?? '' ) );
		$domain   = (string) ( $args['domain'] ?? '' );
		$lang     = (string) ( $args['lang']   ?? '' );
		// Filter by translation status when a lang is selected:
		//   'untranslated' — no translation row OR empty value
		//   'translated'   — has a non-empty value with status translated|wp_org
		//   ''             — no filter
		$status_filter = (string) ( $args['status'] ?? '' );

		// WHERE clauses applied to the strings table.
		$where  = ' WHERE 1=1 ';
		$where_params = [];
		if ( '' !== $search ) {
			$where        .= ' AND s.source LIKE %s ';
			$where_params[] = '%' . $wpdb->esc_like( $search ) . '%';
		}
		if ( '' !== $domain ) {
			$where        .= ' AND s.domain = %s ';
			$where_params[] = $domain;
		}

		$select = "SELECT s.string_id, s.domain, s.context, s.source, s.file_ref";
		$join   = '';
		$join_params = [];
		if ( '' !== $lang ) {
			$select       .= ", t.value AS translation, t.status AS translation_status";
			$join          = ' LEFT JOIN %i AS t ON t.string_id = s.string_id AND t.language_code = %s ';
			$join_params[] = $stt;
			$join_params[] = $lang;

			if ( 'untranslated' === $status_filter ) {
				$where .= " AND ( t.value IS NULL OR t.value = '' ) ";
			} elseif ( 'translated' === $status_filter ) {
				$where .= " AND t.value IS NOT NULL AND t.value <> '' ";
			}
		}

		// The clauses above are fixed fragments with %s / %i placeholders only;
		// every dynamic value travels through $params.
		$params = array_merge( [ $st ], $join_params, $where_params );
		// phpcs:disable WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber
		$sql  = $select . ' FROM %i AS s ' . $join . $where . ' ORDER BY s.string_id DESC LIMIT %d OFFSET %d';
		$rows = $wpdb->get_results( $wpdb->prepare( $sql, array_merge( $params, [ $per_page, $offset ] ) ), ARRAY_A ) ?: [];

		// Apply the same WHERE + JOIN to the COUNT query so total matches filter.
		$count_sql = 'SELECT COUNT(*) FROM %i AS s ' . $join . $where;
		$total     = (int) $wpdb->get_var( $wpdb->prepare( $count_sql, $params ) );
		// phpcs:enable

		return [
			'rows'     => $rows,
			'total'    => $total,
			'page'     => $page,
			'per_page' => $per_page,
		];
	}

	public static function list_domains() {
		global $wpdb;
		$table = Helper::table( 'strings' );
		return $wpdb->get_col( "SELECT DISTINCT domain FROM $table ORDER BY domain ASC" ) ?: [];
	}

	// -------------------------------------------------------------------
	// Helpers for the per-plugin UX (v1.4+).
	// -------------------------------------------------------------------

	public static function count_strings( $domain ) {
		global $wpdb;
		$table = Helper::table( 'strings' );
		return (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(*) FROM $table WHERE domain = %s", (string) $domain )
		);
	}

	public static function has_translation( $string_id, $language_code ) {
		global $wpdb;
		$table = Helper::table( 'string_translations' );
		return (bool) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT 1 FROM $table WHERE string_id = %d AND language_code = %s AND value <> '' LIMIT 1",
				(int) $string_id,
				strtolower( (string) $language_code )
			)
		);
	}

	/**
	 * Per-language translation progress for a domain. Returns:
	 *   [
	 *     'es' => [ 'total' => 89, 'translated' => 42, 'wp_org' => 30, 'draft' => 2, 'missing' => 15 ],
	 *     'fr' => ...
	 *   ]
	 * `translated` here counts user-edited rows; `wp_org` counts rows
	 * imported from translate.wordpress.org and not yet overridden.
	 */
	public static function translation_progress( $domain, $languages ) {
		global $wpdb;
		$st  = Helper::table( 'strings' );
		$stt = Helper::table( 'string_translations' );

		$total = self::count_strings( $domain );
		if ( 0 === $total ) {
			$out = [];
			foreach ( (array) $languages as $code ) {
				$out[ $code ] = [ 'total' => 0, 'translated' => 0, 'wp_org' => 0, 'draft' => 0, 'missing' => 0 ];
			}
			return $out;
		}

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT t.language_code, t.status, COUNT(*) AS n
				 FROM %i AS s
				 INNER JOIN %i AS t ON t.string_id = s.string_id
				 WHERE s.domain = %s AND t.value <> ''
				 GROUP BY t.language_code, t.status",
				$st,
				$stt,
				(string) $domain
			),
			ARRAY_A
		) ?: [];

		$out = [];
		foreach ( (array) $languages as $code ) {
			$out[ $code ] = [
				'total'      => $total,
				'translated' => 0,
				'wp_org'     => 0,
				'draft'      => 0,
				'missing'    => $total,
			];
		}
		foreach ( $rows as $row ) {
			$code = (string) $row['language_code'];
			if ( ! isset( $out[ $code ] ) ) {
				$out[ $code ] = [ 'total' => $total, 'translated' => 0, 'wp_org' => 0, 'draft' => 0, 'missing' => $total ];
			}
			$status_map = [ 'wp_org' => 'wp_org', 'draft' => 'draft' ];
			$bucket     = $status_map[ (string) $row['status'] ] ?? 'translated';
			$out[ $code ][ $bucket ] += (int) $row['n'];
		}
		foreach ( $out as $code => $stats ) {
			$accounted = $stats['translated'] + $stats['wp_org'] + $stats['draft'];
			$out[ $code ]['missing'] = max( 0, $total - $accounted );
		}
		return $out;
	}
}

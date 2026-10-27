<?php
namespace GemTranslate\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Helper;
use GemTranslate\Language\Context;

/**
 * Dashboard widget that surfaces stale translations — posts whose source
 * content has changed after the translation was saved. We detect staleness
 * by comparing the source post's `_gtrans_source_hash` meta against the
 * stored `source_hash` on each `post_translations` row. A mismatch means
 * the translation is out of date.
 *
 * This runs on the WP admin Dashboard screen only.
 */
class StaleDashboard {

	public static function init() {
		$self = new self();
		add_action( 'wp_dashboard_setup', [ $self, 'register_widget' ] );
	}

	public function register_widget() {
		if ( ! current_user_can( 'gtrans_translate_content' )
			&& ! current_user_can( 'manage_options' )
		) {
			return;
		}
		wp_add_dashboard_widget(
			'gtrans_stale_translations',
			__( 'GemTranslate — stale translations', 'gemtranslate' ),
			[ $this, 'render_widget' ]
		);
	}

	public function render_widget() {
		$rows = self::fetch_stale( 10 );
		if ( empty( $rows ) ) {
			echo '<p>' . esc_html__( 'Nothing to do — every translation is in sync with its source.', 'gemtranslate' ) . '</p>';
			return;
		}

		$total = self::count_stale();
		$admin_url = admin_url( 'admin.php?page=gemtranslate' );

		printf(
			'<p>%s</p>',
			esc_html( sprintf(
				/* translators: %d: number of stale translations */
				_n(
					'%d translation needs re-syncing with its source.',
					'%d translations need re-syncing with their sources.',
					(int) $total,
					'gemtranslate'
				),
				(int) $total
			) )
		);

		echo '<table class="widefat striped" style="margin-top:8px"><thead><tr><th>' .
			esc_html__( 'Post', 'gemtranslate' ) . '</th><th>' .
			esc_html__( 'Language', 'gemtranslate' ) . '</th><th>' .
			esc_html__( 'Last updated', 'gemtranslate' ) . '</th><th></th></tr></thead><tbody>';

		foreach ( $rows as $row ) {
			$post = get_post( (int) $row['post_id'] );
			if ( ! $post ) {
				continue;
			}
			$edit = $admin_url . '#/posts/' . (int) $post->ID . '/' . rawurlencode( (string) $row['language_code'] );
			printf(
				'<tr><td><a href="%s">%s</a></td><td><code>%s%s</code></td><td>%s</td><td><a href="%s" class="button button-small">%s</a></td></tr>',
				esc_url( get_edit_post_link( $post->ID ) ),
				esc_html( get_the_title( $post ) ),
				esc_html( (string) $row['language_code'] ),
				$row['country_code'] ? esc_html( '-' . $row['country_code'] ) : '',
				esc_html( mysql2date( get_option( 'date_format' ), (string) $row['updated_at'] ) ),
				esc_url( $edit ),
				esc_html__( 'Re-translate', 'gemtranslate' )
			);
		}
		echo '</tbody></table>';

		if ( $total > count( $rows ) ) {
			printf(
				'<p style="margin-top:8px"><a href="%s">%s</a></p>',
				esc_url( $admin_url . '#/review?filter=stale' ),
				esc_html__( 'See all stale translations →', 'gemtranslate' )
			);
		}
	}

	/**
	 * Return the N most-recently-updated stale translation rows.
	 *
	 * Stale = translation_mode='custom_layout' AND the row's source_hash
	 * doesn't match the current _gtrans_source_hash post meta. In
	 * string_only mode we don't flag staleness (render path auto-remaps
	 * strings to the current source layout).
	 *
	 * @return array<int,array{post_id:int,language_code:string,country_code:string,updated_at:string}>
	 */
	public static function fetch_stale( $limit = 10 ) {
		global $wpdb;
		$t  = Helper::table( 'post_translations' );
		$pm = $wpdb->postmeta;
		$sql = $wpdb->prepare(
			"SELECT t.post_id, t.language_code, t.country_code, t.updated_at
			   FROM $t AS t
			   INNER JOIN $pm AS m
			           ON m.post_id = t.post_id
			          AND m.meta_key = '_gtrans_source_hash'
			  WHERE t.translation_mode = 'custom_layout'
			    AND t.source_hash <> ''
			    AND t.source_hash <> m.meta_value
			  ORDER BY t.updated_at DESC
			  LIMIT %d",
			(int) $limit
		);
		return $wpdb->get_results( $sql, ARRAY_A ) ?: [];
	}

	public static function count_stale() {
		global $wpdb;
		$t  = Helper::table( 'post_translations' );
		$pm = $wpdb->postmeta;
		return (int) $wpdb->get_var(
			"SELECT COUNT(*)
			   FROM $t AS t
			   INNER JOIN $pm AS m
			           ON m.post_id = t.post_id
			          AND m.meta_key = '_gtrans_source_hash'
			  WHERE t.translation_mode = 'custom_layout'
			    AND t.source_hash <> ''
			    AND t.source_hash <> m.meta_value"
		);
	}
}

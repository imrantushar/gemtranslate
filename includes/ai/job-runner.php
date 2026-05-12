<?php
namespace Zentranslate\AI;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Zentranslate\Helper;
use Zentranslate\Translation\TranslationLoader;

/**
 * Async translation job runner.
 *
 * Persists jobs in `wp_ztrans_jobs`. Dispatch happens via Action Scheduler
 * when available (better at long-running tasks), falling back to WP-Cron.
 *
 * Each job is a single "translate one post into one target language" unit
 * so failures and retries stay small. A bulk action enqueues N jobs.
 */
class JobRunner {

	const HOOK_TRANSLATE = 'ztrans_run_translation_job';
	const GROUP          = 'zentranslate';
	const MAX_ATTEMPTS   = 3;

	public static function init() {
		// Subscribe the runner to both scheduler systems — whichever fires
		// will pick up the work. The job-id idempotency check in `run()`
		// prevents double-processing.
		add_action( self::HOOK_TRANSLATE, [ __CLASS__, 'run' ], 10, 1 );
	}

	/**
	 * Queue a translation job. Returns the job ID.
	 */
	public static function queue_translate_post( $post_id, $target_lang, $opts = [] ) {
		$payload = [
			'kind'        => 'post_translate',
			'post_id'     => (int) $post_id,
			'target_lang' => strtolower( $target_lang ),
			'options'     => [
				'use_memory'    => $opts['use_memory'] ?? true,
				'preserve_html' => $opts['preserve_html'] ?? true,
				'overwrite'     => $opts['overwrite'] ?? false,
				'status'        => $opts['status'] ?? 'publish',
			],
		];

		global $wpdb;
		$now = Helper::get_time();
		$wpdb->insert(
			Helper::table( 'jobs' ),
			[
				'type'         => 'post_translate',
				'payload'      => wp_json_encode( $payload ),
				'status'       => 'pending',
				'attempts'     => 0,
				'error'        => '',
				'scheduled_at' => $now,
				'created_at'   => $now,
				'updated_at'   => $now,
			]
		);
		$job_id = (int) $wpdb->insert_id;

		self::dispatch( $job_id );
		return $job_id;
	}

	/**
	 * Hand the job off to whichever async runner is available.
	 */
	private static function dispatch( $job_id ) {
		$args = [ 'job_id' => $job_id ];
		if ( function_exists( 'as_enqueue_async_action' ) ) {
			as_enqueue_async_action( self::HOOK_TRANSLATE, $args, self::GROUP );
			return;
		}
		// WP-Cron fallback. Schedules within the next minute.
		wp_schedule_single_event( time() + 5, self::HOOK_TRANSLATE, $args );
	}

	/**
	 * Action Scheduler / WP-Cron callback. Receives the job_id and runs it.
	 *
	 * @param int|array $arg Either the integer job ID (cron) or the args
	 *                       array Action Scheduler passes through.
	 */
	public static function run( $arg ) {
		$job_id = is_array( $arg ) ? (int) ( $arg['job_id'] ?? 0 ) : (int) $arg;
		if ( $job_id <= 0 ) {
			return;
		}

		$row = self::get_job( $job_id );
		if ( ! $row ) {
			return;
		}
		// Skip if already done — handles double-firing across runners.
		if ( in_array( $row['status'], [ 'success', 'failed' ], true ) ) {
			return;
		}

		self::mark( $job_id, 'running', $row['attempts'] + 1 );

		try {
			$payload = json_decode( (string) $row['payload'], true ) ?: [];
			if ( 'post_translate' === ( $payload['kind'] ?? '' ) ) {
				self::execute_post_translate( $payload );
			}
			self::mark( $job_id, 'success' );
		} catch ( \Throwable $e ) {
			$attempts = $row['attempts'] + 1;
			if ( $attempts < self::MAX_ATTEMPTS ) {
				self::mark( $job_id, 'pending', $attempts, $e->getMessage() );
				// Schedule a retry with linear backoff.
				if ( function_exists( 'as_schedule_single_action' ) ) {
					as_schedule_single_action( time() + ( 30 * $attempts ), self::HOOK_TRANSLATE, [ 'job_id' => $job_id ], self::GROUP );
				} else {
					wp_schedule_single_event( time() + ( 30 * $attempts ), self::HOOK_TRANSLATE, [ 'job_id' => $job_id ] );
				}
			} else {
				self::mark( $job_id, 'failed', $attempts, $e->getMessage() );
			}
		}
	}

	private static function execute_post_translate( $payload ) {
		$post_id     = (int) ( $payload['post_id'] ?? 0 );
		$target_lang = (string) ( $payload['target_lang'] ?? '' );
		$opts        = $payload['options'] ?? [];

		$post = get_post( $post_id );
		if ( ! $post ) {
			throw new \RuntimeException( 'Post not found.' );
		}

		// Skip if a translation already exists and overwrite is false.
		if ( empty( $opts['overwrite'] ) ) {
			$existing = TranslationLoader::all_for_post( $post_id );
			foreach ( $existing as $row ) {
				if ( $row['language_code'] === $target_lang && '' !== (string) $row['title'] ) {
					return;
				}
			}
		}

		$translator = TranslatorFactory::default_translator();
		if ( ! $translator ) {
			throw new \RuntimeException( 'No AI translator configured.' );
		}

		$source_lang = (string) ( get_post_meta( $post_id, '_ztrans_source_lang', true ) ?: \Zentranslate\Language\Context::default_code() );
		$batch       = [ (string) $post->post_title, (string) $post->post_excerpt, (string) $post->post_content ];

		// Translation memory pass.
		$translations = array_fill( 0, 3, null );
		$to_fetch     = [];
		if ( ! empty( $opts['use_memory'] ) ) {
			foreach ( $batch as $i => $text ) {
				$cached = TranslationMemory::get( $text, $source_lang, $target_lang );
				if ( null !== $cached ) {
					$translations[ $i ] = $cached;
				} else {
					$to_fetch[ $i ] = $text;
				}
			}
		} else {
			foreach ( $batch as $i => $text ) {
				$to_fetch[ $i ] = $text;
			}
		}

		if ( ! empty( $to_fetch ) ) {
			$glossary = Glossary::build_context( $source_lang, $target_lang );
			$result   = $translator->translate(
				array_values( $to_fetch ),
				$source_lang,
				$target_lang,
				[ 'preserve_html' => ! empty( $opts['preserve_html'] ), 'glossary' => $glossary['pairs'] ]
			);
			if ( is_wp_error( $result ) ) {
				throw new \RuntimeException( $result->get_error_message() );
			}
			$j = 0;
			foreach ( array_keys( $to_fetch ) as $orig_index ) {
				$value = $result['translations'][ $j ] ?? '';
				$translations[ $orig_index ] = $value;
				if ( ! empty( $opts['use_memory'] ) && '' !== $value ) {
					TranslationMemory::set( $to_fetch[ $orig_index ], $value, $source_lang, $target_lang, $result['provider'] );
				}
				$j++;
			}
		}

		TranslationLoader::save_translation(
			$post_id,
			$target_lang,
			[
				'title'   => (string) ( $translations[0] ?? '' ),
				'excerpt' => (string) ( $translations[1] ?? '' ),
				'content' => (string) ( $translations[2] ?? '' ),
				'slug'    => '',
				'status'  => (string) ( $opts['status'] ?? 'publish' ),
			]
		);
	}

	public static function get_job( $job_id ) {
		global $wpdb;
		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM " . Helper::table( 'jobs' ) . " WHERE job_id = %d", (int) $job_id ),
			ARRAY_A
		);
		return $row ?: null;
	}

	public static function list_jobs( $args = [] ) {
		global $wpdb;
		$status   = isset( $args['status'] ) ? (string) $args['status'] : '';
		$page     = max( 1, (int) ( $args['page'] ?? 1 ) );
		$per_page = max( 1, min( 200, (int) ( $args['per_page'] ?? 50 ) ) );
		$offset   = ( $page - 1 ) * $per_page;
		$table    = Helper::table( 'jobs' );

		$where  = ' WHERE 1=1 ';
		$params = [];
		if ( '' !== $status ) {
			$where   .= ' AND status = %s';
			$params[] = $status;
		}
		$sql      = "SELECT * FROM $table $where ORDER BY job_id DESC LIMIT %d OFFSET %d";
		$params[] = $per_page;
		$params[] = $offset;
		$rows     = $wpdb->get_results( $wpdb->prepare( $sql, $params ), ARRAY_A ) ?: [];
		$total    = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $table" );

		return [ 'rows' => $rows, 'total' => $total, 'page' => $page, 'per_page' => $per_page ];
	}

	public static function retry( $job_id ) {
		$row = self::get_job( $job_id );
		if ( ! $row ) {
			return false;
		}
		self::mark( $job_id, 'pending', 0, '' );
		self::dispatch( $job_id );
		return true;
	}

	public static function delete( $job_id ) {
		global $wpdb;
		return false !== $wpdb->delete( Helper::table( 'jobs' ), [ 'job_id' => (int) $job_id ] );
	}

	public static function counts() {
		global $wpdb;
		$table = Helper::table( 'jobs' );
		$rows  = $wpdb->get_results( "SELECT status, COUNT(*) AS c FROM $table GROUP BY status", ARRAY_A ) ?: [];
		$out   = [ 'pending' => 0, 'running' => 0, 'success' => 0, 'failed' => 0 ];
		foreach ( $rows as $r ) {
			$out[ $r['status'] ] = (int) $r['c'];
		}
		return $out;
	}

	private static function mark( $job_id, $status, $attempts = null, $error = null ) {
		global $wpdb;
		$data = [ 'status' => $status, 'updated_at' => Helper::get_time() ];
		if ( null !== $attempts ) {
			$data['attempts'] = (int) $attempts;
		}
		if ( null !== $error ) {
			$data['error'] = (string) $error;
		}
		$wpdb->update( Helper::table( 'jobs' ), $data, [ 'job_id' => (int) $job_id ] );
	}
}

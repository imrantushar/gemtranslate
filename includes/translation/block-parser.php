<?php
namespace GemTranslate\Translation;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Block-aware text extraction & rewrite.
 *
 * Given a Gutenberg block document, walks every block (including inner
 * blocks) and yields the translatable text per block as a flat list. When
 * the translator returns the same-shaped list back, we re-assemble the
 * document by writing each translated value into its block.
 *
 * What counts as translatable per block:
 * - paragraph / heading / list-item / quote / pullquote / button / verse:
 *   the block's `innerHTML`/`innerContent`.
 * - image / video: the `alt` and `caption` attributes.
 * - cover / button: `text` / `placeholder` attributes when present.
 * - Anything else with `innerHTML` content is included by default.
 *
 * Implementation detail: each "field" is identified by a path like
 * `0` (top-level block index), `0.attrs.alt`, or `2.0.innerHTML`. That
 * lets the rewrite pass apply translations without re-parsing.
 */
class BlockParser {

	const ATTR_FIELDS = [
		'core/image'        => [ 'alt', 'caption' ],
		'core/video'        => [ 'caption' ],
		'core/audio'        => [ 'caption' ],
		'core/cover'        => [ 'alt' ],
		'core/button'       => [ 'text' ],
		'core/buttons'      => [],
		'core/gallery'      => [ 'caption' ],
		'core/media-text'   => [ 'mediaAlt' ],
		'core/embed'        => [ 'caption' ],
		'core/file'         => [ 'fileName' ],

		// aBlocks (https://ablocks.pro). Most aBlocks are static, so their text also
		// lives in the saved markup and is picked up through `innerHTML`. These are
		// the attributes rendered from the block comment (labels, placeholders,
		// dynamic output) that do not reliably reach the saved HTML.
		'ablocks/button'                         => [ 'text' ],
		'ablocks/paypal-button'                  => [ 'text' ],
		'ablocks/stripe-button'                  => [ 'text' ],
		'ablocks/text-path'                      => [ 'text' ],
		'ablocks/heading'                        => [ 'startingText', 'animatedText', 'endingText' ],
		'ablocks/info-box'                       => [ 'badgeText', 'btnText' ],
		'ablocks/image'                          => [ 'caption', 'imgAltText', 'imgTitle' ],
		'ablocks/featured-image'                 => [ 'imgAltText', 'imgTitle' ],
		'ablocks/image-scroll'                   => [ 'imgAltText', 'imgTitle' ],
		'ablocks/atomic-image'                   => [ 'alt' ],
		'ablocks/image-comparison'               => [ 'beforeImageLabel', 'afterImageLabel' ],
		'ablocks/countdown'                      => [ 'dayLabel', 'hourLabel', 'minuteLabel', 'secondLabel' ],
		'ablocks/counter'                        => [ 'counterTitle' ],
		'ablocks/coupon'                         => [ 'couponBtnText', 'couponBtnAfterCopyText' ],
		'ablocks/divider'                        => [ 'elementText' ],
		'ablocks/toggle'                         => [ 'leftLabel', 'rightLabel' ],
		'ablocks/breadcrumb'                     => [ 'beforeBreadcrumbText' ],
		'ablocks/single-accordion'               => [ 'accordionTitle' ],
		'ablocks/content-timeline-child'         => [ 'text_date' ],
		'ablocks/interactive-circle-infographic' => [ 'itemTitle', 'itemText' ],
		'ablocks/table-of-content'               => [ 'tocTableTitle' ],
		'ablocks/taxonomy-listing'               => [ 'buttonText', 'countPrefixText' ],
		'ablocks/news-ticker'                    => [ 'stickyLabel', 'customText' ],
		'ablocks/scroll-to-top'                  => [ 'buttonText' ],
		'ablocks/search'                         => [ 'buttonText', 'placeholder' ],
		'ablocks/menu-item'                      => [ 'label' ],
		'ablocks/logout'                         => [ 'logOutLabel', 'logInLabel' ],
		'ablocks/price-menu-item'                => [ 'title' ],
		'ablocks/filterable-cards'               => [ 'searchNotFoundText', 'searchPlaceHolder', 'loadMoreButtonText', 'noMoreItemsText' ],
		'ablocks/loop-load-more'                 => [ 'loadMoreButtonText', 'noMoreItemsText' ],
		'ablocks/form-builder'                   => [ 'buttonText', 'forgetPasswordLabel', 'loginLabel', 'registerLabel', 'homeLabel' ],
		'ablocks/form-multi-step'                => [ 'submitButtonText' ],
		'ablocks/form-input'                     => [ 'label', 'helperText', 'placeholder' ],
		'ablocks/form-password'                  => [ 'label', 'helperText', 'placeholder' ],
		'ablocks/form-textarea'                  => [ 'label', 'helperText', 'placeholder' ],
		'ablocks/form-checkbox'                  => [ 'label', 'helperText', 'placeholder' ],
		'ablocks/form-radio'                     => [ 'label', 'helperText' ],
		'ablocks/form-select'                    => [ 'label', 'helperText' ],
		'ablocks/ecm-bookmark-button'            => [ 'bookmark_text', 'bookmarked_text' ],
		'ablocks/ecm-bookmark-count'             => [ 'label_single', 'label_plural' ],
		'ablocks/ecm-claim-badge'                => [ 'text' ],
		'ablocks/ecm-claim-button'               => [ 'text' ],
		'ablocks/ecm-claim-count'                => [ 'label_single', 'label_plural' ],
		'ablocks/ecm-upvote'                     => [ 'text' ],
		'ablocks/ecm-upvote-count'               => [ 'label_single', 'label_plural' ],
		'ablocks/ecm-bookmark-list'              => [ 'not_found_text' ],
		'ablocks/ecm-claim-list'                 => [ 'not_found_text' ],
		'ablocks/ecm-reaction-list'              => [ 'not_found_text' ],
		'ablocks/ecm-upvote-list'                => [ 'not_found_text' ],
		'ablocks/academy-course-search'          => [ 'placeholder' ],
		'ablocks/academy-login-form'             => [ 'form_title', 'username_label', 'username_placeholder', 'password_label', 'password_placeholder', 'remember_label', 'login_button_label', 'reset_password_label' ],
		'ablocks/academy-password-reset-form'    => [ 'form_title', 'username_label', 'reset_button_label', 'login_button_label' ],
		'ablocks/storeengine-login-form'         => [ 'form_title', 'username_label', 'username_placeholder', 'password_label', 'password_placeholder', 'remember_label', 'login_button_label', 'reset_password_label' ],
		'ablocks/storeengine-cart-button'        => [ 'label' ],
		'ablocks/storeengine-coupon-form'        => [ 'input_placeholder', 'buttonTitle' ],
		'ablocks/storeengine-funnel-accept'      => [ 'label' ],
		'ablocks/storeengine-funnel-continue'    => [ 'label' ],
		'ablocks/storeengine-funnel-decline'     => [ 'label' ],
		'ablocks/storeengine-funnel-offer'       => [ 'offerTitle' ],
	];

	/**
	 * Blocks whose saved markup holds one translatable image (`<img src>`). The
	 * source URL is the storage key and the per-language replacement URL is the
	 * "translation", so a page can show a different image for each language.
	 */
	const IMAGE_BLOCKS = [ 'core/image', 'core/media-text', 'core/cover', 'ablocks/image', 'ablocks/atomic-image', 'ablocks/featured-image', 'ablocks/image-scroll' ];

	/**
	 * Image blocks whose `<img alt>` lives in the saved markup and is translated.
	 */
	const ALT_BLOCKS = [ 'core/image', 'ablocks/image', 'ablocks/atomic-image', 'ablocks/featured-image', 'ablocks/image-scroll' ];

	/**
	 * Attribute fields translated for a block. Filterable so third-party and
	 * custom blocks can opt in via `gemtranslate_block_attr_fields`.
	 *
	 * @return string[]
	 */
	public static function attr_fields( $block_name ) {
		$fields = self::ATTR_FIELDS[ $block_name ] ?? [];
		return (array) apply_filters( 'gemtranslate_block_attr_fields', $fields, $block_name );
	}

	/**
	 * Detect whether content uses block markup.
	 */
	public static function is_block_content( $content ) {
		return is_string( $content ) && false !== strpos( $content, '<!-- wp:' );
	}

	/**
	 * Extract translatable fields from block content.
	 *
	 * @return array<array{path:string,kind:'innerHTML'|'attr',attr:string,block:string,value:string}>
	 */
	public static function extract( $content ) {
		if ( ! self::is_block_content( $content ) ) {
			return [];
		}
		$blocks = parse_blocks( (string) $content );
		$out    = [];
		self::walk( $blocks, '', $out );
		return $out;
	}

	/**
	 * Apply translated values back to block content.
	 *
	 * @param string $content Original block content.
	 * @param array<string,string> $translations  Map of path => translated value.
	 * @return string Re-serialised block document.
	 */
	public static function apply( $content, array $translations ) {
		if ( ! self::is_block_content( $content ) || empty( $translations ) ) {
			return $content;
		}
		$blocks = parse_blocks( (string) $content );
		self::write( $blocks, '', $translations );
		return self::serialize_blocks( $blocks );
	}

	private static function walk( array &$blocks, $prefix, array &$out ) {
		foreach ( $blocks as $i => &$block ) {
			$path = $prefix === '' ? (string) $i : $prefix . '.' . $i;
			$name = $block['blockName'] ?? null;
			if ( null === $name ) {
				continue; // freeform / classic-block placeholder
			}

			$inner_html = isset( $block['innerHTML'] ) ? trim( $block['innerHTML'] ) : '';
			// A container whose own markup is split around inner blocks (e.g. a
			// quote with a <cite>) cannot be rewritten as one string without
			// duplicating the markup, so its wrapper text is left untouched.
			if ( ! empty( $block['innerBlocks'] ) && is_array( $block['innerContent'] ?? null )
				&& count( array_filter( $block['innerContent'], 'is_string' ) ) > 1 ) {
				$inner_html = '';
			}
			if ( '' !== $inner_html ) {
				$out[] = [
					'path'  => $path . '.innerHTML',
					'kind'  => 'innerHTML',
					'attr'  => '',
					'block' => $name,
					'value' => $block['innerHTML'],
				];
			}

			// core/image keeps `alt` on the <img> in the saved markup, not in the
			// block comment attributes.
			if ( in_array( $name, self::ALT_BLOCKS, true ) && '' !== self::img_alt( $block['innerHTML'] ?? '' ) ) {
				$out[] = [
					'path'  => $path . '.html.alt',
					'kind'  => 'attr',
					'attr'  => 'alt',
					'block' => $name,
					'value' => self::img_alt( $block['innerHTML'] ),
				];
			}

			if ( in_array( $name, self::IMAGE_BLOCKS, true ) && '' !== self::img_src( $block['innerHTML'] ?? '' ) ) {
				$out[] = [
					'path'  => $path . '.html.src',
					'kind'  => 'image',
					'attr'  => 'src',
					'block' => $name,
					'value' => self::img_src( $block['innerHTML'] ),
				];
			}

			$attrs = self::attr_fields( $name );
			foreach ( $attrs as $a ) {
				if ( isset( $block['attrs'][ $a ] ) && is_string( $block['attrs'][ $a ] ) && '' !== trim( $block['attrs'][ $a ] ) ) {
					$out[] = [
						'path'  => $path . '.attrs.' . $a,
						'kind'  => 'attr',
						'attr'  => $a,
						'block' => $name,
						'value' => (string) $block['attrs'][ $a ],
					];
				}
			}

			if ( ! empty( $block['innerBlocks'] ) ) {
				self::walk( $block['innerBlocks'], $path, $out );
			}
		}
	}

	private static function write( array &$blocks, $prefix, array $translations ) {
		foreach ( $blocks as $i => &$block ) {
			$path = $prefix === '' ? (string) $i : $prefix . '.' . $i;
			$name = $block['blockName'] ?? null;
			if ( null === $name ) {
				continue;
			}

			$inner_path = $path . '.innerHTML';
			if ( isset( $translations[ $inner_path ] ) ) {
				$block['innerHTML'] = $translations[ $inner_path ];
				if ( isset( $block['innerContent'] ) && is_array( $block['innerContent'] ) ) {
					// `innerContent` interleaves strings + nulls (where inner
					// blocks slot in). Replace the first non-null with the
					// translation; keep nulls intact so structure is preserved.
					foreach ( $block['innerContent'] as $k => $piece ) {
						if ( null !== $piece ) {
							$block['innerContent'][ $k ] = $translations[ $inner_path ];
							break;
						}
					}
				}
			}

			$alt_path = $path . '.html.alt';
			if ( in_array( $name, self::ALT_BLOCKS, true ) && isset( $translations[ $alt_path ] ) ) {
				$set_alt = function ( $html ) use ( $translations, $alt_path ) {
					return preg_replace_callback(
						'/(<img\b[^>]*?\balt=)(["\'])(.*?)\2/is',
						function ( $m ) use ( $translations, $alt_path ) {
							return $m[1] . '"' . esc_attr( $translations[ $alt_path ] ) . '"';
						},
						(string) $html,
						1
					);
				};
				$block['innerHTML'] = $set_alt( $block['innerHTML'] ?? '' );
				if ( isset( $block['innerContent'] ) && is_array( $block['innerContent'] ) ) {
					foreach ( $block['innerContent'] as $k => $piece ) {
						if ( is_string( $piece ) ) {
							$block['innerContent'][ $k ] = $set_alt( $piece );
						}
					}
				}
			}

			$src_path = $path . '.html.src';
			if ( in_array( $name, self::IMAGE_BLOCKS, true ) && ! empty( $translations[ $src_path ] ) ) {
				self::swap_image( $block, (string) $translations[ $src_path ] );
			}

			$attrs = self::attr_fields( $name );
			foreach ( $attrs as $a ) {
				$attr_path = $path . '.attrs.' . $a;
				if ( isset( $translations[ $attr_path ] ) ) {
					$block['attrs'][ $a ] = $translations[ $attr_path ];
				}
			}

			if ( ! empty( $block['innerBlocks'] ) ) {
				self::write( $block['innerBlocks'], $path, $translations );
			}
		}
	}

	/**
	 * Point a block's image at another URL. The old `srcset`/`sizes` and the
	 * `wp-image-N` class describe the original attachment, so they are dropped
	 * rather than left contradicting the new `src`.
	 */
	private static function swap_image( array &$block, $url ) {
		$new = esc_url( $url );
		if ( '' === $new ) {
			return;
		}
		$old  = self::img_src( $block['innerHTML'] ?? '' );
		$swap = function ( $html ) use ( $new ) {
			return preg_replace_callback(
				'/<img\b[^>]*>/is',
				function ( $m ) use ( $new ) {
					$tag = preg_replace( '/\s(?:srcset|sizes)=(["\']).*?\1/is', '', $m[0] );
					$tag = preg_replace( '/(\sclass=(["\'])[^"\']*?)\s*\bwp-image-\d+\b/i', '$1', $tag );
					$tag = str_replace( ' class=""', '', $tag );
					if ( ! preg_match( '/\ssrc=/i', $tag ) ) {
						return preg_replace( '/<img\b/i', '<img src="' . addcslashes( $new, '\\$' ) . '"', $tag, 1 );
					}
					return preg_replace( '/(\ssrc=)(["\']).*?\2/is', '$1"' . addcslashes( $new, '\\$' ) . '"', $tag, 1 );
				},
				(string) $html,
				1
			);
		};
		// aBlocks wrap the <img> in a <picture> whose <source srcset> repeat the
		// URL for tablet/mobile, so any remaining copy of the old URL follows too.
		$follow = function ( $html ) use ( $old, $new ) {
			return '' === $old ? $html : str_replace( [ $old, esc_url( $old ) ], $new, (string) $html );
		};
		$block['innerHTML'] = $follow( $swap( $block['innerHTML'] ?? '' ) );
		if ( isset( $block['innerContent'] ) && is_array( $block['innerContent'] ) ) {
			foreach ( $block['innerContent'] as $k => $piece ) {
				if ( is_string( $piece ) && false !== stripos( $piece, '<img' ) ) {
					$block['innerContent'][ $k ] = $follow( $swap( $piece ) );
				}
			}
		}
		// Keep the block comment's own copy of the URL in step with the markup.
		foreach ( [ 'url', 'mediaUrl', 'src', 'imgUrl', 'imgUrlTablet', 'imgUrlMobile' ] as $a ) {
			if ( isset( $block['attrs'][ $a ] ) && $block['attrs'][ $a ] === $old ) {
				$block['attrs'][ $a ] = $url;
			}
		}
	}

	private static function img_src( $html ) {
		if ( preg_match( '/<img\b[^>]*?\bsrc=(["\'])(.*?)\1/is', (string) $html, $m ) ) {
			return html_entity_decode( $m[2], ENT_QUOTES );
		}
		// aBlocks images can carry only a `srcset`; use its first candidate.
		if ( preg_match( '/<img\b[^>]*?\bsrcset=(["\'])\s*([^\s,"\']+)/is', (string) $html, $m ) ) {
			return html_entity_decode( $m[2], ENT_QUOTES );
		}
		return '';
	}

	private static function img_alt( $html ) {
		if ( preg_match( '/<img\b[^>]*?\balt=(["\'])(.*?)\1/is', (string) $html, $m ) ) {
			return html_entity_decode( $m[2], ENT_QUOTES );
		}
		return '';
	}

	private static function serialize_blocks( $blocks ) {
		if ( function_exists( 'serialize_blocks' ) ) {
			return serialize_blocks( $blocks );
		}
		// Fallback (extremely rare): minimal re-assembly via render_block.
		$out = '';
		foreach ( $blocks as $b ) {
			$out .= render_block( $b );
		}
		return $out;
	}

	/**
	 * Replace every HTML tag in $html with a numbered placeholder so that
	 * an AI translator only sees visible text. Placeholders look like {ZT0},
	 * {ZT1}, … which the AI system prompt already treats as preserved variables.
	 *
	 * @param  string $html
	 * @return array{0: string, 1: array<int, string>}  [ protected_text, tag_map ]
	 */
	public static function protect_html( $html ) {
		$tags = [];
		$n    = 0;
		$out  = preg_replace_callback(
			'/<[^>]+>/s',
			function ( $m ) use ( &$tags, &$n ) {
				$key      = '{ZT' . $n . '}';
				$tags[$n] = $m[0];
				$n++;
				return $key;
			},
			$html
		);
		return [ $out ?? $html, $tags ];
	}

	/**
	 * Restore HTML tags that were replaced by protect_html().
	 *
	 * @param  string             $text    Translated (possibly modified) protected string.
	 * @param  array<int, string> $tags    Tag map returned by protect_html().
	 * @return string
	 */
	public static function restore_html( $text, array $tags ) {
		if ( empty( $tags ) ) {
			return $text;
		}
		return preg_replace_callback(
			'/\{ZT(\d+)\}/',
			function ( $m ) use ( $tags ) {
				return $tags[ (int) $m[1] ] ?? $m[0];
			},
			$text
		);
	}
}

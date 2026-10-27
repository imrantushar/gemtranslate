<?php
namespace GemTranslate\Frontend;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use GemTranslate\Language\Context;
use GemTranslate\Routing\UrlRewriter;

/**
 * Injects a floating language-switcher button on every frontend page via
 * wp_footer. Zero configuration required from the theme — works for all
 * visitors including logged-out users.
 *
 * Controlled by the `float_switcher_enabled` setting. Position is set by
 * `float_switcher_position` (bottom-right | bottom-left | top-right | top-left).
 */
class FloatingSwitcher {

	public static function init() {
		$self = new self();
		add_action( 'wp_footer', [ $self, 'render' ] );
	}

	public function render() {
		if ( is_admin() ) {
			return;
		}

		$g            = $GLOBALS['gtrans_settings'] ?? null;
		$enabled      = isset( $g->float_switcher_enabled ) ? (bool) $g->float_switcher_enabled : false;
		$is_admin_cap = current_user_can( 'manage_options' );

		// Nothing to render if the switcher is off and the user has no admin actions.
		if ( ! $enabled && ! $is_admin_cap ) {
			return;
		}

		$languages   = Context::active_languages();
		$position    = sanitize_key( (string) ( $g->float_switcher_position ?? 'bottom-right' ) );
		$show_flag   = isset( $g->switcher_show_flag ) ? (bool) $g->switcher_show_flag : true;
		$show_name   = isset( $g->switcher_show_name ) ? (bool) $g->switcher_show_name : true;
		$show_native = isset( $g->switcher_show_native ) ? (bool) $g->switcher_show_native : false;

		$current  = Context::current();
		$rewriter = new UrlRewriter();

		// Build language list items — only when the switcher is enabled and there
		// are at least two active languages.
		$items_html    = '';
		$trigger_label = '';
		if ( $enabled && count( $languages ) > 1 ) {
			$current_lang  = $languages[ $current ] ?? reset( $languages );
			$trigger_label = $this->build_label( $current_lang, $show_flag, $show_name, $show_native );
			foreach ( $languages as $row ) {
				$is_current  = ( $row['code'] === $current );
				$url         = $rewriter->current_url_for_language( $row['code'] );
				$label       = $this->build_label( $row, $show_flag, $show_name, $show_native );
				$items_html .= sprintf(
					'<li class="%s"><a href="%s" hreflang="%s" lang="%s"%s>%s</a></li>',
					$is_current ? 'gtrans-float__item is-current' : 'gtrans-float__item',
					esc_url( $url ),
					esc_attr( $row['code'] ),
					esc_attr( str_replace( '_', '-', $row['locale'] ) ),
					$is_current ? ' aria-current="true"' : '',
					$label
				);
			}
		}

		// Admin-only "Add new language" link — always shown to admins.
		$admin_item_html = '';
		if ( $is_admin_cap ) {
			$add_url = admin_url( 'admin.php?page=gemtranslate' ) . '#/languages';
			if ( '' !== $items_html ) {
				$admin_item_html .= '<li class="gtrans-float__divider" role="separator"></li>';
			}
			$admin_item_html .= sprintf(
				'<li class="gtrans-float__item gtrans-float__item--admin"><a href="%s" target="_blank" rel="noopener noreferrer">%s</a></li>',
				esc_url( $add_url ),
				'<span class="gtrans-float__flag" aria-hidden="true">+</span> ' . esc_html__( 'Add new language', 'gemtranslate' )
			);
		}

		if ( '' === $items_html && '' === $admin_item_html ) {
			return;
		}

		// Globe icon fallback for admin-only view (switcher disabled).
		if ( '' === $trigger_label ) {
			$trigger_label = '<span class="gtrans-float__name" aria-hidden="true">🌐</span>';
		}

		$pos_class = 'gtrans-float gtrans-float--' . esc_attr( $position );

		echo $this->styles(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		?>
		<div id="gtrans-float" class="<?php echo esc_attr( $pos_class ); ?>" dir="auto">
			<button
				class="gtrans-float__trigger"
				aria-haspopup="listbox"
				aria-expanded="false"
				aria-label="<?php esc_attr_e( 'Switch language', 'gemtranslate' ); ?>"
			><?php echo $trigger_label; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></button>
			<ul class="gtrans-float__menu" role="listbox" aria-label="<?php esc_attr_e( 'Languages', 'gemtranslate' ); ?>">
				<?php echo $items_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
				<?php echo $admin_item_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
			</ul>
		</div>
		<?php
		echo $this->script(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	private function build_label( $row, $show_flag, $show_name, $show_native ) {
		$parts = [];
		if ( $show_flag && ! empty( $row['flag'] ) ) {
			$emoji = esc_html( self::flag_emoji( $row['flag'] ) );
			$parts[]  = '<span class="gtrans-float__flag" aria-hidden="true">' . $emoji . '</span>';
		}
		if ( $show_name ) {
			$parts[] = '<span class="gtrans-float__name">' . esc_html( $row['name'] ) . '</span>';
		} elseif ( $show_native ) {
			$parts[] = '<span class="gtrans-float__name">' . esc_html( $row['native_name'] ) . '</span>';
		}
		if ( ! $show_name && ! $show_native ) {
			$parts[] = '<span class="gtrans-float__name">' . esc_html( strtoupper( $row['code'] ) ) . '</span>';
		}
		return implode( ' ', $parts );
	}

	private static function flag_emoji( $code ) {
		$code = strtolower( $code );
		if ( false !== strpos( $code, '-' ) ) {
			$region = strtoupper( substr( strrchr( $code, '-' ), 1 ) );
		} else {
			$map    = [
				'en' => 'GB', 'es' => 'ES', 'fr' => 'FR', 'de' => 'DE', 'it' => 'IT',
				'pt' => 'PT', 'ru' => 'RU', 'ja' => 'JP', 'zh' => 'CN', 'ar' => 'SA',
				'he' => 'IL', 'hi' => 'IN', 'bn' => 'BD', 'ko' => 'KR', 'tr' => 'TR',
				'nl' => 'NL', 'pl' => 'PL',
			];
			$region = $map[ $code ] ?? strtoupper( $code );
		}
		if ( strlen( $region ) !== 2 ) {
			return strtoupper( $code );
		}
		return mb_chr( 0x1F1E6 + ord( $region[0] ) - ord( 'A' ) )
			. mb_chr( 0x1F1E6 + ord( $region[1] ) - ord( 'A' ) );
	}

	private function styles() {
		return <<<'CSS'
<style id="gtrans-float-css">
#gtrans-float{position:fixed;z-index:99999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.4}
#gtrans-float.gtrans-float--bottom-right{bottom:20px;right:20px}
#gtrans-float.gtrans-float--bottom-left{bottom:20px;left:20px}
#gtrans-float.gtrans-float--top-right{top:20px;right:20px}
#gtrans-float.gtrans-float--top-left{top:20px;left:20px}
.gtrans-float__trigger{display:flex;align-items:center;gap:6px;padding:9px 16px;background:#1d2327;color:#fff;border:none;border-radius:999px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.35);font-size:14px;font-family:inherit;white-space:nowrap;transition:background .15s}
.gtrans-float__trigger:hover,.gtrans-float__trigger:focus-visible{background:#2c3338;outline:none}
.gtrans-float__trigger:focus-visible{box-shadow:0 0 0 3px rgba(30,115,190,.6)}
.gtrans-float__menu{list-style:none;margin:0;padding:4px 0;background:#fff;border:1px solid #dcdcde;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.18);min-width:150px;position:absolute;display:none}
.gtrans-float__menu.is-open{display:block}
.gtrans-float--bottom-right .gtrans-float__menu,.gtrans-float--bottom-left .gtrans-float__menu{bottom:calc(100% + 8px)}
.gtrans-float--top-right .gtrans-float__menu,.gtrans-float--top-left .gtrans-float__menu{top:calc(100% + 8px)}
.gtrans-float--bottom-right .gtrans-float__menu,.gtrans-float--top-right .gtrans-float__menu{right:0}
.gtrans-float--bottom-left .gtrans-float__menu,.gtrans-float--top-left .gtrans-float__menu{left:0}
.gtrans-float__item a{display:flex;align-items:center;gap:8px;padding:8px 14px;color:#1d2327;text-decoration:none;white-space:nowrap}
.gtrans-float__item a:hover{background:#f0f0f1}
.gtrans-float__item.is-current a{font-weight:700;color:#135e96}
.gtrans-float__divider{height:1px;background:#dcdcde;margin:4px 0}
.gtrans-float__item--admin a{color:#135e96;font-size:13px}
.gtrans-float__item--admin a:hover{background:#f0f0f1}
</style>
CSS;
	}

	private function script() {
		return <<<'JS'
<script id="gtrans-float-js">
(function(){
var btn=document.getElementById('gtrans-float')&&document.querySelector('#gtrans-float .gtrans-float__trigger');
var menu=document.getElementById('gtrans-float')&&document.querySelector('#gtrans-float .gtrans-float__menu');
if(!btn||!menu)return;
btn.addEventListener('click',function(e){
  e.stopPropagation();
  var open=menu.classList.toggle('is-open');
  btn.setAttribute('aria-expanded',open?'true':'false');
});
document.addEventListener('click',function(){
  menu.classList.remove('is-open');
  btn.setAttribute('aria-expanded','false');
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){menu.classList.remove('is-open');btn.setAttribute('aria-expanded','false');}
});
})();
</script>
JS;
	}
}

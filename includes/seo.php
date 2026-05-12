<?php
namespace Zentranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class SEO {
	public static function init() {
		SEO\HreflangOutput::init();
		SEO\SitemapProvider::init();
		SEO\YoastBridge::init();
		SEO\RankMathBridge::init();
	}
}

<?php
namespace Zentranslate;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class SEO {
	public static function init() {
		// Basic hreflang + sitemap alternates are free (table stakes). The
		// Yoast / Rank Math bridges + per-translation SEO meta are Pro.
		SEO\HreflangOutput::init();
		SEO\SitemapProvider::init();
	}
}

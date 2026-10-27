/* global gtransVisualEditor */
( function () {
	'use strict';

	var cfg = window.gtransVisualEditor || {};
	var ACTIVE_CLASS = 'gtrans-ve-active';
	var HOVER_CLASS  = 'gtrans-ve-hover';
	var MIN_LEN      = 2;
	var MAX_LEN      = 4000;
	// Containers we'll scan — the usual theme content wrappers.
	var SCAN_SELECTORS = [
		'article.post', 'article.page', 'main article', '.entry-content',
		'.post-content', '.page-content', '.wp-block-post-content',
		'[class*="elementor-widget-container"]',
	];
	// Tags whose text is NOT translatable here.
	var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, CODE: 1, PRE: 1, NOSCRIPT: 1, TEXTAREA: 1, INPUT: 1 };

	function ready( fn ) {
		if ( document.readyState !== 'loading' ) { fn(); return; }
		document.addEventListener( 'DOMContentLoaded', fn );
	}

	ready( init );

	function init() {
		var toggle = document.getElementById( 'gtrans-ve-toggle' );
		if ( ! toggle ) return;
		updateToggle( toggle, false );
		toggle.addEventListener( 'click', function () {
			var active = document.body.classList.toggle( ACTIVE_CLASS );
			updateToggle( toggle, active );
			if ( active ) {
				markNodes();
			} else {
				unmarkNodes();
				closePopover();
			}
		} );
	}

	function updateToggle( btn, active ) {
		if ( cfg.is_default ) {
			btn.textContent = cfg.strings.default_lang_hint;
			btn.disabled = true;
			btn.classList.add( 'gtrans-ve-toggle-disabled' );
			return;
		}
		btn.textContent = active ? cfg.strings.toggle_off : cfg.strings.toggle_on;
		btn.classList.toggle( 'gtrans-ve-toggle-active', !! active );
	}

	function markNodes() {
		var containers = [];
		SCAN_SELECTORS.forEach( function ( sel ) {
			document.querySelectorAll( sel ).forEach( function ( el ) { containers.push( el ); } );
		} );
		if ( ! containers.length ) { containers = [ document.body ]; }
		containers.forEach( function ( root ) {
			walkTextNodes( root, function ( textNode ) {
				var text = textNode.nodeValue;
				var trimmed = text.replace( /\s+/g, ' ' ).trim();
				if ( trimmed.length < MIN_LEN || trimmed.length > MAX_LEN ) return;
				// Skip inside skipped tags.
				var parent = textNode.parentNode;
				while ( parent && parent !== document.body ) {
					if ( SKIP_TAGS[ parent.tagName ] ) return;
					parent = parent.parentNode;
				}
				// Attach handler to the parent element — text nodes themselves can't take listeners.
				var el = textNode.parentNode;
				if ( ! el || el.getAttribute( 'data-gtrans-ve-bound' ) === '1' ) return;
				el.setAttribute( 'data-gtrans-ve-bound', '1' );
				el.classList.add( 'gtrans-ve-editable' );
				el.addEventListener( 'click', onEditableClick, true );
			} );
		} );
	}

	function unmarkNodes() {
		document.querySelectorAll( '[data-gtrans-ve-bound="1"]' ).forEach( function ( el ) {
			el.classList.remove( 'gtrans-ve-editable', HOVER_CLASS );
			el.removeAttribute( 'data-gtrans-ve-bound' );
			el.removeEventListener( 'click', onEditableClick, true );
		} );
	}

	function walkTextNodes( root, cb ) {
		var walker = document.createTreeWalker( root, NodeFilter.SHOW_TEXT, null );
		var node;
		while ( ( node = walker.nextNode() ) ) {
			cb( node );
		}
	}

	function onEditableClick( e ) {
		if ( ! document.body.classList.contains( ACTIVE_CLASS ) ) return;
		var el = e.currentTarget;
		var source = ( el.textContent || '' ).replace( /\s+/g, ' ' ).trim();
		if ( ! source ) return;
		// Don't follow links or submit forms while editing.
		e.preventDefault();
		e.stopPropagation();
		openPopover( el, source );
	}

	var currentPopover = null;

	function openPopover( anchor, source ) {
		closePopover();
		var pop = document.createElement( 'div' );
		pop.className = 'gtrans-ve-popover';
		pop.innerHTML =
			'<div class="gtrans-ve-pop-row">' +
				'<label>' + escapeHtml( cfg.strings.source_label ) + '</label>' +
				'<div class="gtrans-ve-source"></div>' +
			'</div>' +
			'<div class="gtrans-ve-pop-row">' +
				'<label>' + escapeHtml( cfg.strings.translation_label ) + ' <code>' + escapeHtml( cfg.lang ) + '</code></label>' +
				'<textarea rows="3"></textarea>' +
			'</div>' +
			'<div class="gtrans-ve-pop-actions">' +
				'<button type="button" class="gtrans-ve-cancel">' + escapeHtml( cfg.strings.cancel ) + '</button>' +
				'<button type="button" class="gtrans-ve-save">' + escapeHtml( cfg.strings.save ) + '</button>' +
			'</div>' +
			'<div class="gtrans-ve-status" aria-live="polite"></div>';
		pop.querySelector( '.gtrans-ve-source' ).textContent = source;
		var ta  = pop.querySelector( 'textarea' );
		ta.value = ( anchor.textContent || '' ).replace( /\s+/g, ' ' ).trim();
		document.body.appendChild( pop );
		positionPopover( pop, anchor );
		ta.focus();
		ta.setSelectionRange( ta.value.length, ta.value.length );
		pop.querySelector( '.gtrans-ve-cancel' ).addEventListener( 'click', closePopover );
		pop.querySelector( '.gtrans-ve-save' ).addEventListener( 'click', function () {
			var status = pop.querySelector( '.gtrans-ve-status' );
			status.textContent = cfg.strings.saving;
			savePair( source, ta.value, function ( err ) {
				if ( err ) {
					status.textContent = err;
					return;
				}
				status.textContent = cfg.strings.saved;
				setTimeout( function () { location.reload(); }, 400 );
			} );
		} );
		currentPopover = pop;
		// Dismiss on outside click.
		setTimeout( function () {
			document.addEventListener( 'click', outsideClick, true );
		}, 10 );
	}

	function outsideClick( e ) {
		if ( ! currentPopover ) return;
		if ( currentPopover.contains( e.target ) ) return;
		if ( e.target.closest( '.gtrans-ve-editable' ) ) return;
		closePopover();
	}

	function closePopover() {
		if ( currentPopover && currentPopover.parentNode ) {
			currentPopover.parentNode.removeChild( currentPopover );
		}
		currentPopover = null;
		document.removeEventListener( 'click', outsideClick, true );
	}

	function positionPopover( pop, anchor ) {
		var r = anchor.getBoundingClientRect();
		var top  = window.scrollY + r.bottom + 8;
		var left = window.scrollX + r.left;
		var vw = document.documentElement.clientWidth;
		if ( left + 380 > vw ) left = vw - 390;
		if ( left < 10 ) left = 10;
		pop.style.top  = top + 'px';
		pop.style.left = left + 'px';
	}

	function savePair( source, translation, done ) {
		fetch( cfg.rest_url, {
			method: 'POST',
			credentials: 'same-origin',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': cfg.nonce,
			},
			body: JSON.stringify( {
				post_id: cfg.post_id,
				lang: cfg.lang,
				source: source,
				translation: translation,
			} ),
		} )
			.then( function ( r ) { return r.json().then( function ( j ) { return { ok: r.ok, body: j }; } ); } )
			.then( function ( res ) {
				if ( ! res.ok ) {
					done( ( res.body && res.body.message ) || 'Error' );
					return;
				}
				done( null );
			} )
			.catch( function ( e ) { done( String( e ) ); } );
	}

	function escapeHtml( s ) {
		return String( s ).replace( /[&<>"']/g, function ( c ) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ c ];
		} );
	}

} )();

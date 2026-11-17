import { __ } from '@wordpress/i18n';

/**
 * Open the WordPress media library and resolve with the chosen image's URL, or
 * null when the dialog is closed without a choice (or the library is missing).
 */
export function pickImage() {
	return new Promise((resolve) => {
		if (!window.wp?.media) {
			resolve(null);
			return;
		}
		const frame = window.wp.media({
			title: __('Choose an image for this language', 'gemtranslate'),
			button: { text: __('Use this image', 'gemtranslate') },
			library: { type: 'image' },
			multiple: false,
		});
		frame.on('select', () => {
			const item = frame.state().get('selection').first()?.toJSON();
			resolve(item?.url || null);
		});
		// WordPress fires "close" just before "select", so the no-choice answer is
		// deferred; a real selection resolves first and wins.
		frame.on('close', () => setTimeout(() => resolve(null), 0));
		frame.open();
	});
}

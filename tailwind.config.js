/** @type {import('tailwindcss').Config} */
module.exports = {
	prefix: 'gtrans-',
	important: '#gemtranslate-admin-root',
	content: [
		'./dev_gemtranslate/**/*.{js,jsx,ts,tsx}',
		'./includes/admin/**/*.php',
	],
	corePlugins: {
		preflight: false,
	},
	theme: {
		extend: {
			// Token names and values mirror GemCRM's palette 1:1 (see
			// gemcrm/assets/scss/Common/_global.scss) so the two admin UIs read as
			// one product family. Each color is a CSS custom property so the whole
			// palette can be retuned from one place (styles/tokens.css) instead of
			// hunting through component classNames.
			colors: {
				primary: {
					DEFAULT: 'var(--gtrans-primary-color)',
					light: 'var(--gtrans-primary-light)',
				},
				secondary: 'var(--gtrans-secondary-color)',
				ink: 'var(--gtrans-font-color)',
				muted: 'var(--gtrans-warn-muted)',
				surface: 'var(--gtrans-background)',
				body: 'var(--gtrans-body-background)',
				line: 'var(--gtrans-border-color)',
				placeholder: 'var(--gtrans-placeholder)',
				heading: 'var(--gtrans-heading-color)',
				label: 'var(--gtrans-label-color)',
				description: 'var(--gtrans-description-color)',
				edge: 'var(--gtrans-border)',
				divider: 'var(--gtrans-divider)',
				navactive: 'var(--gtrans-nav-active-bg)',
				success: {
					DEFAULT: 'var(--gtrans-success)',
					light: 'var(--gtrans-success-light)',
				},
				warning: {
					DEFAULT: 'var(--gtrans-warning)',
					light: 'var(--gtrans-warning-light)',
				},
				danger: {
					DEFAULT: 'var(--gtrans-error)',
					light: 'var(--gtrans-error-light)',
				},
				// `gtrans-*` kept only for callers still on the old palette names
				// during the migration; new code should use the tokens above.
				gtrans: {
					primary: 'var(--gtrans-primary-color)',
					'primary-hover': 'var(--gtrans-primary-color)',
					muted: 'var(--gtrans-warn-muted)',
					surface: 'var(--gtrans-background)',
					bg: 'var(--gtrans-body-background)',
					border: 'var(--gtrans-border-color)',
					danger: 'var(--gtrans-error)',
					success: 'var(--gtrans-success)',
					warning: 'var(--gtrans-warning)',
				},
			},
			fontFamily: {
				sans: ['var(--gtrans-font)'],
			},
			// Coupled rem-based type scale — every size ships its correct
			// line-height, same scale as GemCRM.
			fontSize: {
				'2xs': ['0.625rem', { lineHeight: '0.875rem' }],
				11: ['0.6875rem', { lineHeight: '1rem' }],
				xs: ['0.75rem', { lineHeight: '1rem' }],
				13: ['0.8125rem', { lineHeight: '1.125rem' }],
				sm: ['0.875rem', { lineHeight: '1.25rem' }],
				15: ['0.9375rem', { lineHeight: '1.375rem' }],
				base: ['1rem', { lineHeight: '1.5rem' }],
				lg: ['1.125rem', { lineHeight: '1.75rem' }],
				xl: ['1.25rem', { lineHeight: '1.75rem' }],
				'2xl': ['1.5rem', { lineHeight: '2rem' }],
				'3xl': ['1.875rem', { lineHeight: '2.25rem' }],
			},
			boxShadow: {
				card: 'var(--gtrans-shadow)',
				gtrans: 'var(--gtrans-shadow)',
			},
			borderRadius: {
				gtrans: '4px',
			},
		},
	},
	plugins: [
		require('@tailwindcss/forms'),
		require('@tailwindcss/typography'),
	],
};

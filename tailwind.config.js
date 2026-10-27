/** @type {import('tailwindcss').Config} */
module.exports = {
	prefix: 'ztrans-',
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
			colors: {
				ztrans: {
					primary: '#4338ca',
					'primary-hover': '#3730a3',
					accent: '#06b6d4',
					muted: '#6b7280',
					surface: '#ffffff',
					bg: '#f8fafc',
					border: '#e5e7eb',
					danger: '#dc2626',
					success: '#16a34a',
					warning: '#ca8a04',
				},
			},
			fontFamily: {
				sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Inter', 'sans-serif'],
			},
			boxShadow: {
				card: '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
			},
		},
	},
	plugins: [
		require('@tailwindcss/forms'),
		require('@tailwindcss/typography'),
	],
};

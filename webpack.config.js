const defaultConfig = require('@wordpress/scripts/config/webpack.config');
const path = require('path');

const GTRANS_VERSION = '1.0.0';

module.exports = {
	...defaultConfig,
	entry: {
		backend: path.resolve(__dirname, 'dev_gemtranslate/index.jsx'),
		editor: path.resolve(__dirname, 'dev_gemtranslate/editor/index.jsx'),
	},
	output: {
		filename: `[name].${GTRANS_VERSION}.js`,
		path: path.resolve(__dirname, 'assets/build'),
	},
	resolve: {
		...defaultConfig.resolve,
		extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
		alias: {
			...(defaultConfig.resolve?.alias || {}),
			'@Components': path.resolve(__dirname, 'dev_gemtranslate/components/'),
			'@Containers': path.resolve(__dirname, 'dev_gemtranslate/containers/'),
			'@Hooks': path.resolve(__dirname, 'dev_gemtranslate/hooks/'),
			'@Lib': path.resolve(__dirname, 'dev_gemtranslate/lib/'),
			'@Styles': path.resolve(__dirname, 'dev_gemtranslate/styles/'),
		},
	},
};

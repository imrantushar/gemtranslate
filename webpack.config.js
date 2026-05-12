const defaultConfig = require('@wordpress/scripts/config/webpack.config');
const path = require('path');

const ZTRANS_VERSION = '1.0.0';

module.exports = {
	...defaultConfig,
	entry: {
		backend: path.resolve(__dirname, 'dev_zentranslate/index.jsx'),
	},
	output: {
		filename: `[name].${ZTRANS_VERSION}.js`,
		path: path.resolve(__dirname, 'assets/build'),
	},
	resolve: {
		...defaultConfig.resolve,
		extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
		alias: {
			...(defaultConfig.resolve?.alias || {}),
			'@Components': path.resolve(__dirname, 'dev_zentranslate/components/'),
			'@Containers': path.resolve(__dirname, 'dev_zentranslate/containers/'),
			'@Hooks': path.resolve(__dirname, 'dev_zentranslate/hooks/'),
			'@Lib': path.resolve(__dirname, 'dev_zentranslate/lib/'),
			'@Styles': path.resolve(__dirname, 'dev_zentranslate/styles/'),
		},
	},
};

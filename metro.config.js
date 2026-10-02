const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const enhanceMiddleware = config.server.enhanceMiddleware;

if (!config.resolver.assetExts.includes('wasm')) {
	config.resolver.assetExts.push('wasm');
}

config.server.enhanceMiddleware = (middleware, server) => {
	const enhancedMiddleware = enhanceMiddleware
		? enhanceMiddleware(middleware, server)
		: middleware;

	return (request, response, next) => {
		response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
		response.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
		return enhancedMiddleware(request, response, next);
	};
};

module.exports = config;

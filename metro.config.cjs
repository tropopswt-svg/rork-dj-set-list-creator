const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

// Add .lottie to asset extensions for lottie-react-native
config.resolver.assetExts.push('lottie');

module.exports = withRorkMetro(config);

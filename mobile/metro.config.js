const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// lucide-react-native (ESM) importa cada ícone via caminho relativo .mjs
// (ex.: ./icons/a-arrow-down.mjs) — Metro só resolve .mjs no entry point via
// "exports" do package.json, não em imports relativos internos, a menos que
// a extensão esteja em sourceExts explicitamente.
config.resolver.sourceExts.push('mjs');

module.exports = withNativeWind(config, { input: './global.css' });

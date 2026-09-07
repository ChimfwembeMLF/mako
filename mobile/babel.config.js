module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Required for reanimated and worklets in production builds
      'react-native-worklets/plugin',
      'react-native-reanimated/plugin',
    ],
  };
};

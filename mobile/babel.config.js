// Конфигурация Babel для Expo проекта
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Плагин для настройки алиасов путей (resolve @/ -> ./src/)
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src'
          }
        }
      ],
      // Плагин для react-native-reanimated (должен быть последним в списке плагинов)
      'react-native-reanimated/plugin'
    ]
  };
};

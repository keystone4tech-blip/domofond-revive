// Конфигурация Babel для приложения «Офис Работа»
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Настройка алиасов путей (@/ -> ./src/)
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src'
          }
        }
      ],
      // Reanimated плагин
      'react-native-reanimated/plugin'
    ]
  };
};

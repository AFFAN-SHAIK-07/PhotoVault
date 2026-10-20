const appConfig = require('./app.json').expo;
const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();

module.exports = {
  ...appConfig,
  plugins: projectId
    ? [...appConfig.plugins, 'expo-updates']
    : appConfig.plugins,
  ...(projectId
    ? {
        updates: {
          url: `https://u.expo.dev/${projectId}`,
          checkAutomatically: 'NEVER',
          fallbackToCacheTimeout: 0,
        },
        runtimeVersion: { policy: 'appVersion' },
        extra: {
          ...appConfig.extra,
          eas: { ...appConfig.extra?.eas, projectId },
        },
      }
    : {}),
};

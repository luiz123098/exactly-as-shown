import type { ConfigContext, ExpoConfig } from 'expo/config';

// Static settings live in app.json; this file adds the sign-in plugins that
// depend on the environment (.env.local). Client IDs are public values.
export default ({ config }: ConfigContext): ExpoConfig => {
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const plugins: ExpoConfig['plugins'] = [
    ...(config.plugins ?? []),
    'expo-apple-authentication',
    [
      'expo-image-picker',
      {
        photosPermission: 'O Exotic Club usa suas fotos para você escolher a foto de perfil.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
  ];
  // Google Sign-In needs the reversed iOS client ID as a URL scheme; without it
  // the build still works and the Google button stays hidden.
  if (googleIosClientId) {
    plugins.push([
      '@react-native-google-signin/google-signin',
      { iosUrlScheme: `com.googleusercontent.apps.${googleIosClientId.replace('.apps.googleusercontent.com', '')}` },
    ]);
  }
  return {
    ...config,
    name: config.name ?? 'Exotic Club',
    slug: config.slug ?? 'exotic-club',
    ios: { ...config.ios, usesAppleSignIn: true },
    plugins,
  };
};

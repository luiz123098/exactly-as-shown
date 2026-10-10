import type { ConfigContext, ExpoConfig } from 'expo/config';

// Static settings live in app.json; this file adds the sign-in plugins that
// depend on the environment (.env.local). Client IDs are public values.
export default ({ config }: ConfigContext): ExpoConfig => {
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const plugins: ExpoConfig['plugins'] = [
    ...(config.plugins ?? []),
    'expo-apple-authentication',
    // Must come before expo-image-picker: plugins modify Info.plist last-first,
    // and the picker (with cameraPermission: false) would drop this text.
    [
      'expo-camera',
      {
        cameraPermission: 'O Exotic Club usa a câmera para o parceiro ler o QR da carteirinha dos membros.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-calendar',
      {
        // iOS 17+: only adds events (opens the system "New Event" screen), never reads the calendar.
        writeOnlyAccess: true,
        writeOnlyCalendarPermission: 'O Exotic Club adiciona os eventos que você escolher à sua agenda.',
        calendarPermission: 'O Exotic Club adiciona os eventos que você escolher à sua agenda.',
      },
    ],
    [
      'expo-location',
      {
        // Only turns partner addresses into map coordinates; the app never tracks the user.
        locationWhenInUsePermission: 'O Exotic Club usa endereços para mostrar a localização dos parceiros no mapa.',
      },
    ],
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

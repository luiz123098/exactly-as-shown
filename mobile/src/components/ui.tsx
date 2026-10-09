import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';

import { colors, fonts, radius, space } from '@/lib/theme';

type Variant = 'body' | 'muted' | 'title' | 'heading' | 'eyebrow' | 'label';

export function Text({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  return <RNText style={[styles[variant], style]} {...rest} />;
}

// Every screen scrolls inside the system safe areas: iOS adds the status bar,
// navigation header, floating tab bar and keyboard as insets, so content never
// ends up hidden behind them.
export function Screen({ children, scroll = true, style, refreshControl }: {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  refreshControl?: ScrollViewProps['refreshControl'];
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, style]}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      scrollEnabled={scroll}
      refreshControl={refreshControl}>
      {children}
    </ScrollView>
  );
}

type ButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: 'primary' | 'ink' | 'outline' | 'ghost' | 'inkOutline';
  loading?: boolean;
};

export function Button({ title, variant = 'primary', loading, disabled, style, ...rest }: ButtonProps) {
  const v = buttonVariants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={(state) => [
        styles.button,
        v.box,
        (disabled || loading) && { opacity: 0.5 },
        state.pressed && { opacity: 0.8 },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {loading ? <ActivityIndicator color={v.text.color} /> : <RNText style={[styles.buttonText, v.text]}>{title}</RNText>}
    </Pressable>
  );
}

const buttonVariants = {
  primary: { box: { backgroundColor: colors.highlight }, text: { color: colors.ink } },
  ink: { box: { backgroundColor: colors.ink }, text: { color: colors.inkText } },
  outline: { box: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }, text: { color: colors.text } },
  ghost: { box: { backgroundColor: 'transparent' }, text: { color: colors.text } },
  // For dark (ink) backgrounds: transparent box, light text, thin visible border.
  inkOutline: { box: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.textMuted }, text: { color: colors.inkText } },
} as const;

export function Field({ label, error, style, ...rest }: TextInputProps & { label: string; error?: string | undefined }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="label">{label}</Text>
      <TextInput placeholderTextColor={colors.textMuted} style={[styles.input, !!error && { borderColor: colors.danger }, style]} {...rest} />
      {!!error && <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text>}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// Shared states so no screen ever renders blank.
export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <View style={styles.state}>
      <ActivityIndicator color={colors.highlight} />
      <Text variant="muted">{label}</Text>
    </View>
  );
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <View style={styles.state}>
      <Text variant="heading" style={{ textAlign: 'center' }}>{title}</Text>
      {!!text && <Text variant="muted" style={{ textAlign: 'center' }}>{text}</Text>}
      {action}
    </View>
  );
}

export function ErrorState({ onRetry, text = 'Não foi possível carregar. Verifique sua conexão.' }: { onRetry?: () => void; text?: string }) {
  return (
    <View style={styles.state}>
      <Text variant="heading">Algo deu errado</Text>
      <Text variant="muted" style={{ textAlign: 'center' }}>{text}</Text>
      {onRetry && <Button title="Tentar novamente" variant="outline" onPress={onRetry} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.md, gap: space.md },
  body: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 23, color: colors.text },
  muted: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.textMuted },
  title: { fontFamily: fonts.extrabold, fontSize: 32, lineHeight: 36, color: colors.text },
  heading: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 25, color: colors.text },
  eyebrow: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', color: colors.highlight },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted },
  button: { minHeight: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  buttonText: { fontFamily: fonts.extrabold, fontSize: 16 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    backgroundColor: colors.card,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.text,
  },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: space.sm },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl, minHeight: 240 },
});

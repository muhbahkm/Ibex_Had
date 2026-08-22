import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from './theme';

export function AppScreen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>{children}</View>
    </SafeAreaView>
  );
}

export function BrandMark() {
  return (
    <View style={styles.brandMark}>
      <Text style={styles.brandText}>IBEX</Text>
    </View>
  );
}

export function Heading({ title, subtitle }: { readonly title: string; readonly subtitle?: string }) {
  return (
    <View style={styles.headingBlock}>
      <Text style={styles.heading}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Field({
  label,
  ...inputProps
}: TextInputProps & { readonly label: string }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        placeholderTextColor={theme.colors.textMuted}
        style={[styles.input, inputProps.style]}
        textAlign="right"
      />
    </View>
  );
}

export function PrimaryButton({
  children,
  onPress,
  disabled = false,
  loading = false,
}: {
  readonly children: ReactNode;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly loading?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && !isDisabled ? styles.primaryButtonPressed : null,
        isDisabled ? styles.buttonDisabled : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.primaryText} />
      ) : (
        <Text style={styles.primaryButtonText}>{children}</Text>
      )}
    </Pressable>
  );
}

export function ErrorMessage({ message }: { readonly message?: string | null }) {
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  screen: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  brandMark: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xl,
    alignSelf: 'flex-end',
  },
  brandText: {
    color: theme.colors.primaryText,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headingBlock: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  heading: {
    color: theme.colors.text,
    fontSize: theme.typography.title,
    fontWeight: '700',
    lineHeight: 40,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.body,
    lineHeight: 26,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  fieldBlock: {
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  label: {
    color: theme.colors.text,
    fontSize: theme.typography.caption,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.typography.body,
    writingDirection: 'rtl',
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  primaryButtonPressed: {
    backgroundColor: theme.colors.primaryPressed,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: theme.colors.primaryText,
    fontSize: theme.typography.body,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  error: {
    color: theme.colors.danger,
    fontSize: theme.typography.caption,
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: theme.spacing.sm,
  },
});

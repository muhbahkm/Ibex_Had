import type { PropsWithChildren, ReactNode } from 'react';
import { useState } from 'react';
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

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type SurfaceVariant = 'plain' | 'outlined' | 'tinted' | 'elevated';
type FeedbackTone = 'info' | 'success' | 'warning' | 'danger';

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

export function Surface({
  children,
  variant = 'plain',
}: PropsWithChildren<{ readonly variant?: SurfaceVariant }>) {
  return (
    <View
      style={[
        styles.surface,
        variant === 'outlined' ? styles.surfaceOutlined : null,
        variant === 'tinted' ? styles.surfaceTinted : null,
        variant === 'elevated' ? styles.surfaceElevated : null,
      ]}
    >
      {children}
    </View>
  );
}

export function TextField({
  label,
  error,
  disabled = false,
  ...inputProps
}: TextInputProps & {
  readonly label: string;
  readonly error?: string | null;
  readonly disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldBlock}>
      <Text style={[styles.label, error ? styles.labelError : null]}>{label}</Text>
      <TextInput
        {...inputProps}
        editable={!disabled && inputProps.editable !== false}
        onBlur={(event) => {
          setFocused(false);
          inputProps.onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          inputProps.onFocus?.(event);
        }}
        placeholderTextColor={theme.colors.textSubtle}
        style={[
          styles.input,
          focused ? styles.inputFocused : null,
          error ? styles.inputError : null,
          disabled ? styles.inputDisabled : null,
          inputProps.style,
        ]}
        textAlign="right"
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

// Compatibility export while existing screens migrate to TextField.
export function Field(props: TextInputProps & { readonly label: string }) {
  return <TextField {...props} />;
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: {
  readonly children: ReactNode;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly disabled?: boolean;
  readonly loading?: boolean;
}) {
  const isDisabled = disabled || loading;
  const indicatorColor = variant === 'primary' ? theme.colors.accentText : theme.colors.accent;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' ? styles.buttonPrimary : null,
        variant === 'secondary' ? styles.buttonSecondary : null,
        variant === 'ghost' ? styles.buttonGhost : null,
        pressed && !isDisabled ? styles.buttonPressed : null,
        isDisabled ? styles.buttonDisabled : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={indicatorColor} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === 'primary' ? styles.buttonTextPrimary : styles.buttonTextAccent,
          ]}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}

// Compatibility export while existing screens migrate to Button.
export function PrimaryButton(props: Omit<Parameters<typeof Button>[0], 'variant'>) {
  return <Button {...props} variant="primary" />;
}

export function AppBar({
  title,
  subtitle,
  leading,
  trailing,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly leading?: ReactNode;
  readonly trailing?: ReactNode;
}) {
  return (
    <View style={styles.appBar}>
      <View style={styles.appBarSide}>{leading}</View>
      <View style={styles.appBarTitleWrap}>
        <Text numberOfLines={1} style={styles.appBarTitle}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={styles.appBarSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.appBarSide}>{trailing}</View>
    </View>
  );
}

export interface BottomNavigationItem {
  readonly key: string;
  readonly label: string;
  readonly glyph?: string;
  readonly badge?: number;
  readonly onPress: () => void;
}

export function BottomNavigation({
  items,
  activeKey,
}: {
  readonly items: readonly BottomNavigationItem[];
  readonly activeKey: string;
}) {
  return (
    <View style={styles.bottomNavigation}>
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Pressable
            accessibilityRole="button"
            key={item.key}
            onPress={item.onPress}
            style={({ pressed }) => [styles.bottomNavigationItem, pressed ? styles.navPressed : null]}
          >
            <View style={styles.navGlyphWrap}>
              <Text style={[styles.navGlyph, active ? styles.navActive : null]}>{item.glyph ?? '•'}</Text>
              {item.badge && item.badge > 0 ? (
                <View style={styles.navBadge}>
                  <Text style={styles.navBadgeText}>{item.badge > 99 ? '99+' : String(item.badge)}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.navLabel, active ? styles.navActive : null]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function InlineFeedback({
  children,
  tone = 'info',
}: PropsWithChildren<{ readonly tone?: FeedbackTone }>) {
  const backgroundColor = {
    info: theme.colors.infoSurface,
    success: theme.colors.successSurface,
    warning: theme.colors.warningSurface,
    danger: theme.colors.dangerSurface,
  }[tone];
  const color = {
    info: theme.colors.info,
    success: theme.colors.success,
    warning: theme.colors.warning,
    danger: theme.colors.danger,
  }[tone];

  return (
    <View style={[styles.inlineFeedback, { backgroundColor }]}>
      <Text style={[styles.inlineFeedbackText, { color }]}>{children}</Text>
    </View>
  );
}

export function EmptyState({ title, message }: { readonly title: string; readonly message: string }) {
  return (
    <Surface variant="tinted">
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
    </Surface>
  );
}

export function ErrorState({
  title = 'تعذر إكمال العملية',
  message,
  retryLabel,
  onRetry,
}: {
  readonly title?: string;
  readonly message: string;
  readonly retryLabel?: string;
  readonly onRetry?: () => void;
}) {
  return (
    <Surface variant="outlined">
      <Text style={[styles.stateTitle, styles.errorText]}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      {onRetry ? <Button onPress={onRetry} variant="secondary">{retryLabel ?? 'إعادة المحاولة'}</Button> : null}
    </Surface>
  );
}

export function LoadingState({ label = 'جارٍ التحميل' }: { readonly label?: string }) {
  return (
    <View style={styles.loadingState}>
      <ActivityIndicator color={theme.colors.accent} />
      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  );
}

export function Skeleton({ height = 16 }: { readonly height?: number }) {
  return <View style={[styles.skeleton, { height }]} />;
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
    paddingHorizontal: theme.layout.screenHorizontalPadding,
    backgroundColor: theme.colors.background,
  },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  brandText: {
    color: theme.colors.accentText,
    fontSize: theme.typography.caption,
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
  surface: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
  },
  surfaceOutlined: {
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  surfaceTinted: {
    backgroundColor: theme.colors.surfaceTinted,
  },
  surfaceElevated: {
    backgroundColor: theme.colors.surfaceElevated,
    ...theme.elevation.medium,
  },
  fieldBlock: {
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  label: {
    color: theme.colors.text,
    fontSize: theme.typography.styles.label.fontSize,
    lineHeight: theme.typography.styles.label.lineHeight,
    fontWeight: theme.typography.styles.label.fontWeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  labelError: {
    color: theme.colors.danger,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.typography.body,
    writingDirection: 'rtl',
  },
  inputFocused: {
    borderColor: theme.colors.accent,
    borderWidth: 2,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  inputDisabled: {
    backgroundColor: theme.colors.surfaceMuted,
    color: theme.colors.textSubtle,
    opacity: 0.72,
  },
  fieldError: {
    color: theme.colors.danger,
    fontSize: theme.typography.caption,
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  button: {
    minHeight: 48,
    minWidth: theme.layout.minTouchTarget,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.accent,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonPressed: {
    opacity: 0.78,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    fontSize: theme.typography.body,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  buttonTextPrimary: {
    color: theme.colors.accentText,
  },
  buttonTextAccent: {
    color: theme.colors.accent,
  },
  appBar: {
    minHeight: theme.layout.appBarHeight,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  appBarSide: {
    minWidth: theme.layout.minTouchTarget,
    minHeight: theme.layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitleWrap: {
    flex: 1,
    alignItems: 'flex-end',
  },
  appBarTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.styles.heading.fontSize,
    lineHeight: theme.typography.styles.heading.lineHeight,
    fontWeight: theme.typography.styles.heading.fontWeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  appBarSubtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  bottomNavigation: {
    minHeight: theme.layout.bottomNavigationHeight,
    flexDirection: 'row-reverse',
    alignItems: 'stretch',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  bottomNavigationItem: {
    flex: 1,
    minHeight: theme.layout.bottomNavigationHeight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xxs,
  },
  navPressed: {
    opacity: 0.7,
  },
  navGlyphWrap: {
    position: 'relative',
    minWidth: 28,
    alignItems: 'center',
  },
  navGlyph: {
    color: theme.colors.textMuted,
    fontSize: 20,
    writingDirection: 'ltr',
  },
  navLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
  navActive: {
    color: theme.colors.accent,
  },
  navBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBadgeText: {
    color: theme.colors.textInverse,
    fontSize: 10,
    fontWeight: '800',
    writingDirection: 'ltr',
  },
  inlineFeedback: {
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  inlineFeedbackText: {
    fontSize: theme.typography.caption,
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  stateTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.styles.heading.fontSize,
    lineHeight: theme.typography.styles.heading.lineHeight,
    fontWeight: theme.typography.styles.heading.fontWeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  stateMessage: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.body,
    lineHeight: 26,
    marginTop: theme.spacing.xs,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  errorText: {
    color: theme.colors.danger,
  },
  loadingState: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  loadingLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    writingDirection: 'rtl',
  },
  skeleton: {
    width: '100%',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceMuted,
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

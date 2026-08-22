import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBar } from './primitives';
import { theme } from './theme';

export function SecondaryShell({
  children,
  title,
  subtitle,
  onBack,
  backLabel = 'رجوع',
  trailing,
}: PropsWithChildren<{
  readonly title: string;
  readonly subtitle?: string;
  readonly onBack: () => void;
  readonly backLabel?: string;
  readonly trailing?: ReactNode;
}>) {
  const appBarProps = {
    title,
    leading: (
      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
      >
        <Text style={styles.backText}>{backLabel}</Text>
      </Pressable>
    ),
    ...(subtitle ? { subtitle } : {}),
    ...(trailing ? { trailing } : {}),
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.root}>
        <View style={styles.headerFrame}>
          <View style={styles.contentFrame}>
            <AppBar {...appBarProps} />
          </View>
        </View>
        <View style={styles.body}>
          <View style={[styles.contentFrame, styles.bodyFrame]}>{children}</View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  root: { flex: 1, backgroundColor: theme.colors.background },
  headerFrame: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: theme.layout.screenHorizontalPadding,
    backgroundColor: theme.colors.background,
  },
  body: { flex: 1, paddingHorizontal: theme.layout.screenHorizontalPadding },
  bodyFrame: { flex: 1 },
  contentFrame: { width: '100%', maxWidth: theme.layout.mobileContentMaxWidth, alignSelf: 'center' },
  backButton: {
    minWidth: theme.layout.minTouchTarget,
    minHeight: theme.layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xs,
  },
  backText: {
    color: theme.colors.accent,
    fontSize: theme.typography.styles.label.fontSize,
    lineHeight: theme.typography.styles.label.lineHeight,
    fontWeight: theme.typography.styles.label.fontWeight,
    writingDirection: 'rtl',
  },
  pressed: { opacity: 0.68 },
});

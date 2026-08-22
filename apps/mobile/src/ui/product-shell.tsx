import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBar, BottomNavigation } from './primitives';
import { theme } from './theme';

type ProductShellTab = 'home' | 'notifications';

export function ProductShell({
  children,
  title,
  subtitle,
  activeTab,
  unreadNotifications = 0,
  onHomePress,
  onNotificationsPress,
  trailing,
}: PropsWithChildren<{
  readonly title: string;
  readonly subtitle?: string;
  readonly activeTab: ProductShellTab;
  readonly unreadNotifications?: number;
  readonly onHomePress: () => void;
  readonly onNotificationsPress: () => void;
  readonly trailing?: ReactNode;
}>) {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.root}>
        <View style={styles.appBarFrame}>
          <View style={styles.contentFrame}>
            <AppBar
              title={title}
              {...(subtitle !== undefined ? { subtitle } : {})}
              {...(trailing !== undefined ? { trailing } : {})}
            />
          </View>
        </View>

        <View style={styles.body}>
          <View style={[styles.contentFrame, styles.bodyFrame]}>{children}</View>
        </View>

        <View style={styles.navigationFrame}>
          <View style={styles.contentFrame}>
            <BottomNavigation
              activeKey={activeTab}
              items={[
                {
                  key: 'home',
                  label: 'الرئيسية',
                  glyph: '⌂',
                  onPress: onHomePress,
                },
                {
                  key: 'notifications',
                  label: 'الإشعارات',
                  glyph: '•',
                  badge: unreadNotifications,
                  onPress: onNotificationsPress,
                },
              ]}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  appBarFrame: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.layout.screenHorizontalPadding,
  },
  body: {
    flex: 1,
    paddingHorizontal: theme.layout.screenHorizontalPadding,
  },
  bodyFrame: {
    flex: 1,
  },
  navigationFrame: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  contentFrame: {
    width: '100%',
    maxWidth: theme.layout.mobileContentMaxWidth,
    alignSelf: 'center',
  },
});

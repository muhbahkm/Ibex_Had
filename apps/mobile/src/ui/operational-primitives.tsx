import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Surface } from './primitives';
import { theme } from './theme';

export type OperationalTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export function StatusBadge({ children, tone = 'neutral' }: PropsWithChildren<{ readonly tone?: OperationalTone }>) {
  return (
    <View style={[styles.badge, styles[`badge_${tone}`]]}>
      <Text style={[styles.badgeText, styles[`badgeText_${tone}`]]}>{children}</Text>
    </View>
  );
}

export function SectionHeading({ title, caption }: { readonly title: string; readonly caption?: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
    </View>
  );
}

export function MetricStrip({ items }: { readonly items: readonly { readonly label: string; readonly value: string }[] }) {
  return (
    <Surface variant="outlined">
      <View style={styles.metricRow}>
        {items.map((item, index) => (
          <View key={`${item.label}-${index}`} style={styles.metricItem}>
            <Text style={styles.metricValue}>{item.value}</Text>
            <Text style={styles.metricLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  badge: {
    minHeight: 28,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  badge_neutral: { backgroundColor: theme.colors.surfaceMuted },
  badge_info: { backgroundColor: theme.colors.infoSurface },
  badge_success: { backgroundColor: theme.colors.successSurface },
  badge_warning: { backgroundColor: theme.colors.warningSurface },
  badge_danger: { backgroundColor: theme.colors.dangerSurface },
  badgeText: {
    fontSize: theme.typography.styles.captionStrong.fontSize,
    lineHeight: theme.typography.styles.captionStrong.lineHeight,
    fontWeight: theme.typography.styles.captionStrong.fontWeight,
    writingDirection: 'rtl',
  },
  badgeText_neutral: { color: theme.colors.textMuted },
  badgeText_info: { color: theme.colors.info },
  badgeText_success: { color: theme.colors.success },
  badgeText_warning: { color: theme.colors.warning },
  badgeText_danger: { color: theme.colors.danger },
  sectionHeading: { gap: theme.spacing.xxs },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.styles.heading.fontSize,
    lineHeight: theme.typography.styles.heading.lineHeight,
    fontWeight: theme.typography.styles.heading.fontWeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  sectionCaption: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.styles.caption.fontSize,
    lineHeight: theme.typography.styles.caption.lineHeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  metricRow: { flexDirection: 'row-reverse', alignItems: 'stretch' },
  metricItem: {
    flex: 1,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xxs,
  },
  metricValue: {
    color: theme.colors.text,
    fontSize: theme.typography.styles.heading.fontSize,
    lineHeight: theme.typography.styles.heading.lineHeight,
    fontWeight: theme.typography.styles.heading.fontWeight,
    writingDirection: 'ltr',
  },
  metricLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.styles.caption.fontSize,
    lineHeight: theme.typography.styles.caption.lineHeight,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});

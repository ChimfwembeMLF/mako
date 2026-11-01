import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ContentItem } from '../lib/api';
import { platformMeta } from '../constants/platforms';
import {
  formatTimeLabel,
  getCalendarDays,
  isSameDay,
  toDateKey,
} from '../lib/dates';
import { useTheme } from '../context/ThemeContext';
import { fonts, rounded, spacing, typography, type ThemeColors } from '../theme';
import { Button, Card, Icon } from './ui';

type Props = {
  month: Date;
  onMonthChange: (next: Date) => void;
  posts: ContentItem[];
  selectedDate: string | null;
  onSelectDate: (key: string | null) => void;
  onPostPress: (post: ContentItem) => void;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ScheduleCalendar({
  month,
  onMonthChange,
  posts,
  selectedDate,
  onSelectDate,
  onPostPress,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const today = useMemo(() => new Date(), []);
  const days = useMemo(() => getCalendarDays(month), [month]);

  const postsByDate = useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    for (const post of posts) {
      const key = String(post.scheduledDate || '').slice(0, 10);
      if (!key) continue;
      const list = map.get(key) || [];
      list.push(post);
      map.set(key, list);
    }
    return map;
  }, [posts]);

  const monthLabel = month.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <Card style={styles.card}>
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() =>
            onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))
          }
          style={styles.navBtn}
        >
          <Icon name="chevronLeft" size={20} color={colors.ink} />
        </Pressable>
        <View style={styles.monthCopy}>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <Button
            label="Today"
            variant="outline"
            onPress={() => {
              onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1));
              onSelectDate(toDateKey(today));
            }}
            style={styles.todayBtn}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() =>
            onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))
          }
          style={styles.navBtn}
        >
          <Icon name="chevronRight" size={20} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.weekdays}>
        {WEEKDAYS.map((d) => (
          <Text key={d} style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {Array.from({ length: Math.ceil(days.length / 7) }).map((_, weekIndex) => (
          <View key={`week-${weekIndex}`} style={styles.weekRow}>
            {days.slice(weekIndex * 7, weekIndex * 7 + 7).map((day, index) => {
              if (!day) {
                return <View key={`pad-${weekIndex}-${index}`} style={styles.cell} />;
              }
              const key = toDateKey(day);
              const dayPosts = postsByDate.get(key) || [];
              const selected = selectedDate === key;
              const isTodayCell = isSameDay(day, today);

              return (
                <Pressable
                  key={key}
                  style={[styles.cell, selected && styles.cellSelected]}
                  onPress={() => onSelectDate(selected ? null : key)}
                >
                  <Text style={[styles.dayNum, isTodayCell && styles.dayToday]}>{day.getDate()}</Text>
                  <View style={styles.chips}>
                    {dayPosts.slice(0, 2).map((post) => {
                      const platform = post.platforms?.[0] || '';
                      const meta = platformMeta(platform);
                      return (
                        <Pressable
                          key={post.id}
                          style={[styles.chip, { borderLeftColor: meta.color }]}
                          onPress={() => onPostPress(post)}
                        >
                          <Text style={styles.chipText} numberOfLines={1}>
                            {formatTimeLabel(post.scheduledTime) || post.title || 'Post'}
                          </Text>
                        </Pressable>
                      );
                    })}
                    {dayPosts.length > 2 ? (
                      <Text style={styles.more}>+{dayPosts.length - 2} more</Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </Card>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  navBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCopy: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  monthLabel: {
    ...typography.bodyMdStrong,
    fontFamily: fonts.displaySemi,
    color: colors.ink,
  },
  todayBtn: {
    minHeight: 32,
    paddingHorizontal: spacing.md,
  },
  weekdays: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    ...typography.caption,
    fontFamily: fonts.bodySemi,
    color: colors.mute,
  },
  grid: {
    gap: 0,
  },
  weekRow: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxs,
  },
  cellSelected: {
    backgroundColor: colors['primary-pale'],
  },
  dayNum: {
    ...typography.caption,
    fontFamily: fonts.bodySemi,
    color: colors.ink,
    marginBottom: spacing.xxs,
  },
  dayToday: {
    color: colors['positive-deep'],
  },
  chips: {
    gap: 2,
  },
  chip: {
    backgroundColor: colors.canvas,
    borderLeftWidth: 3,
    borderRadius: rounded.sm,
    paddingHorizontal: spacing.xxs,
    paddingVertical: 1,
  },
  chipText: {
    fontSize: 9,
    fontFamily: fonts.bodySemi,
    color: colors.ink,
  },
  more: {
    fontSize: 9,
    fontFamily: fonts.body,
    color: colors.mute,
  },
});

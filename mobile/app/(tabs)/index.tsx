import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { colors, spacing, rounded, typography } from '../../src/theme';

export default function HomeScreen() {
  const { data: workspaces = [], isLoading, error } = useQuery({
    queryKey: ['workspaces'],
    queryFn: api.getWorkspaces,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Workspaces</Text>
      {error ? <Text style={styles.errorText}>{error.message || 'Failed to fetch workspaces'}</Text> : null}
      
      <FlatList
        data={workspaces}
        keyExtractor={(item, index) => item.id || index.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.name || 'Untitled Workspace'}</Text>
            <Text style={styles.cardSubtitle}>Role: {item.role || 'Member'}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No workspaces found.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors['canvas-soft'],
    padding: spacing.xl,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors['canvas-soft'],
  },
  title: {
    ...typography.displayXs,
    color: colors.ink,
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.canvas,
    borderRadius: rounded.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    ...typography.bodyMdStrong,
    color: colors.ink,
  },
  cardSubtitle: {
    ...typography.bodySm,
    color: colors.mute,
    marginTop: spacing.xs,
  },
  errorText: {
    color: colors.negative,
    marginBottom: spacing.lg,
  },
  emptyText: {
    ...typography.bodyMd,
    color: colors.mute,
  }
});

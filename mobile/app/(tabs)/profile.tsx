import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/lib/api';
import { colors, spacing, rounded, typography } from '../../src/theme';

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: api.getProfile,
  });

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Profile</Text>
        
        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : profile ? (
          <View style={styles.infoContainer}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{profile.email}</Text>
            
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{profile.firstName} {profile.lastName}</Text>
          </View>
        ) : (
          <Text style={styles.errorText}>Could not load profile details.</Text>
        )}
        
        <TouchableOpacity style={styles.button} onPress={signOut}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors['canvas-soft'],
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.canvas,
    borderRadius: rounded.xl,
    padding: spacing.xl,
  },
  title: {
    ...typography.displayXs,
    color: colors.ink,
    marginBottom: spacing.xl,
  },
  infoContainer: {
    marginBottom: spacing.xl,
  },
  label: {
    ...typography.bodySmStrong,
    color: colors.mute,
    marginBottom: spacing.xs,
  },
  value: {
    ...typography.bodyMd,
    color: colors.ink,
    marginBottom: spacing.lg,
  },
  button: {
    backgroundColor: colors['canvas-soft'],
    borderRadius: rounded.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderColor: colors.ink,
    borderWidth: 1,
  },
  buttonText: {
    color: colors.ink,
    ...typography.buttonMd,
  },
  errorText: {
    color: colors.negative,
    marginBottom: spacing.lg,
  }
});

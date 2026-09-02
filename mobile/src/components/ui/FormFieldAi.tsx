import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFieldEnhance } from '../../hooks/useFieldEnhance';
import { useFormSuggestions } from '../../hooks/useFormSuggestions';
import type { FormSuggestionForm } from '../../constants/formSuggestionForms';
import { useTheme } from '../../context/ThemeContext';
import { fonts, spacing, typography } from '../../theme';
import { useToast } from './Toast';
import { AiInput, SuggestionCarousel } from './AiInput';

type Props = {
  form: FormSuggestionForm;
  tenantId?: string | null;
  fieldKey: string;
  multiline?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  editable?: boolean;
  style?: object;
};

export function FormFieldAi({
  form,
  tenantId,
  fieldKey,
  multiline,
  value,
  onChange,
  placeholder,
  editable = true,
  style,
}: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const { enhanceField, enhancingKey } = useFieldEnhance({ form, tenantId });
  const {
    loading: suggestionsLoading,
    fetchSuggestions,
    refreshSuggestions,
    getSuggestionsForField,
    getSelectedIndex,
    setFieldIndex,
    pauseField,
    isFieldActive,
    getPlaceholder,
  } = useFormSuggestions({
    form,
    tenantId,
    fieldKeys: [fieldKey],
    values: { [fieldKey]: value },
    enabled: Boolean(tenantId && editable),
  });

  useEffect(() => {
    if (tenantId && editable) void fetchSuggestions();
  }, [tenantId, form, editable, fetchSuggestions]);

  const suggestions = getSuggestionsForField(fieldKey);
  const resolvedPlaceholder = getPlaceholder(fieldKey, placeholder ?? '');

  const handleEnhance = async () => {
    const ok = await enhanceField(fieldKey, value, onChange, fieldKey);
    if (!ok) {
      toast.error('AI assist failed. Try again.');
    }
  };

  return (
    <View style={styles.wrap}>
      <AiInput
        value={value}
        onChangeText={onChange}
        placeholder={resolvedPlaceholder}
        multiline={multiline}
        editable={editable}
        onEnhance={tenantId && editable ? handleEnhance : undefined}
        enhancing={enhancingKey === fieldKey}
        style={style}
      />

      {editable && !value.trim() && suggestions.length > 0 ? (
        <View>
          <SuggestionCarousel
            suggestions={suggestions}
            selectedIndex={getSelectedIndex(fieldKey)}
            onSelectIndex={(index) => setFieldIndex(fieldKey, index)}
            onApply={(text) => {
              pauseField(fieldKey);
              onChange(text);
            }}
            onInteract={() => pauseField(fieldKey)}
            isLive={isFieldActive(fieldKey)}
          />
          <Pressable
            accessibilityRole="button"
            disabled={suggestionsLoading}
            onPress={() => void refreshSuggestions()}
            style={styles.refreshBtn}
          >
            <Text style={[styles.refreshText, { color: colors.mute, fontFamily: fonts.body }]}>
              {suggestionsLoading ? 'Loading suggestions…' : '↻ New suggestions'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  refreshBtn: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  refreshText: { ...typography.caption },
});

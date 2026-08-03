import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts, radius, spacing } from '@/lib/theme';

interface AppTextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoComplete?: 'email' | 'current-password' | 'new-password' | 'off';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  inputMode?: 'email' | 'text';
}

export function AppTextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  autoComplete = 'off',
  autoCapitalize = 'sentences',
  inputMode = 'text',
}: AppTextFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        autoComplete={autoComplete}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        inputMode={inputMode}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold.family,
    fontSize: 14,
  },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceElevated,
    color: colors.text,
    fontFamily: fonts.body.family,
    fontSize: 16,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});

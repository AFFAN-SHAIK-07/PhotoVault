import React from 'react';
import { Pressable, Text, ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';

export function FilterPill({
  label,
  active,
  onPress,
  style,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  style?: ViewStyle;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 36,
          paddingHorizontal: 14,
          borderRadius: 99,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: active ? colors.primary : colors.card,
          borderWidth: active ? 0 : 1,
          borderColor: colors.border,
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: active ? colors.primaryForeground : colors.secondaryForeground,
          fontFamily: 'Inter_600SemiBold',
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

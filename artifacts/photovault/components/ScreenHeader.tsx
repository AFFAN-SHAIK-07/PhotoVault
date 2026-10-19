import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onAction?: () => void;
  actionIcon?: React.ComponentProps<typeof Feather>['name'];
  actionLabel?: string;
};

export function ScreenHeader({
  title,
  subtitle,
  onAction,
  actionIcon,
  actionLabel,
}: ScreenHeaderProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 8,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
        ) : null}
      </View>
      {onAction && actionIcon ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel ?? title}
          testID={`header-action-${actionIcon}`}
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Feather name={actionIcon} size={21} color={colors.foreground} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 76,
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    letterSpacing: -0.7,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  action: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.58,
    transform: [{ scale: 0.96 }],
  },
});

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
          paddingTop: (Platform.OS === 'web' ? 24 : insets.top) + 8,
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
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: colors.muted },
            pressed && styles.pressed,
          ]}
        >
          <Feather name={actionIcon} size={21} color={colors.foreground} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 86,
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 0,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    letterSpacing: -0.9,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  action: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.58,
    transform: [{ scale: 0.96 }],
  },
});

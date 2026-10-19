import React from 'react';
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useLibrary } from '@/context/LibraryContext';

export function LibraryPermissionPrompt() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { permission, permissionChecking, requestAccess, isNativeMediaAvailable, error } =
    useLibrary();
  const blocked = permission?.status === 'denied' && !permission.canAskAgain;

  const openSettings = async () => {
    if (Platform.OS === 'web') return;
    try {
      await Linking.openSettings();
    } catch {
      // Keep the permission screen usable if the platform cannot open Settings.
    }
  };

  const manageLimitedAccess = async () => {
    if (Platform.OS === 'web') return;
    try {
      const MediaLibrary = await import('expo-media-library');
      await MediaLibrary.presentPermissionsPicker(['photo', 'video']);
    } catch {
      await openSettings();
    }
  };

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 24,
          paddingBottom: Math.max(insets.bottom, 16) + 20,
        },
      ]}
    >
      <Text style={[styles.headline, { color: colors.foreground }]}>
        Photo library
      </Text>
      <Text style={[styles.description, { color: colors.mutedForeground }]}>
        Allow access to show photos, videos, and screenshots already stored on this phone.
        PhotoVault keeps the originals in place and does not copy or upload them.
      </Text>

      <View style={styles.bottom}>
        {error ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>
            {error}
          </Text>
        ) : null}
        {!isNativeMediaAvailable ? (
          <View style={[styles.webNotice, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="smartphone" size={18} color={colors.primary} />
            <Text style={[styles.webNoticeText, { color: colors.foreground }]}>
              Open the Android app to connect your device library. This preview cannot read local
              phone media.
            </Text>
          </View>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={blocked ? 'Open Android settings' : 'Allow photo access'}
              testID="grant-media-access"
              disabled={permissionChecking}
              onPress={blocked ? openSettings : requestAccess}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.primary },
                pressed && styles.pressed,
                permissionChecking && styles.disabled,
              ]}
            >
              <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
                {permissionChecking
                  ? 'Checking access…'
                  : blocked
                    ? 'Open Settings'
                    : 'Allow media access'}
              </Text>
              {!permissionChecking ? (
                <Feather name={blocked ? 'settings' : 'arrow-right'} size={18} color={colors.primaryForeground} />
              ) : null}
            </Pressable>
            {permission?.accessPrivileges === 'limited' ? (
              <Pressable
                accessibilityRole="button"
                onPress={manageLimitedAccess}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                  Manage selected photos
                </Text>
              </Pressable>
            ) : (
              <Text style={[styles.permissionNote, { color: colors.mutedForeground }]}>
                You can change this permission at any time in Android settings.
              </Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 20 },
  headline: {
    fontFamily: 'Inter_700Bold',
    fontSize: 30,
    lineHeight: 37,
    letterSpacing: -0.8,
  },
  description: {
    maxWidth: 330,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 23,
  },
  bottom: {
    gap: 14,
  },
  primaryButton: {
    minHeight: 56,
    paddingHorizontal: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  secondaryButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  permissionNote: {
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  webNotice: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  webNoticeText: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 19,
  },
  error: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.55,
  },
});

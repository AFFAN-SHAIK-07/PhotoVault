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
        Your whole gallery,
        {'\n'}beautifully organized.
      </Text>
      <Text style={[styles.description, { color: colors.mutedForeground }]}>
        Bring your camera roll, videos, screenshots, and shared app media together. Your originals
        stay right where they are.
      </Text>

      <View style={styles.bottom}>
        <View style={[styles.benefitCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.benefitIcon, { backgroundColor: colors.accent }]}>
            <Feather name="image" size={21} color={colors.primary} />
          </View>
          <View style={styles.benefitCopy}>
            <Text style={[styles.benefitTitle, { color: colors.foreground }]}>
              One home for every moment
            </Text>
            <Text style={[styles.benefitDetail, { color: colors.mutedForeground }]}>
              Browse photos and videos by date, then build albums from the moments you choose.
            </Text>
          </View>
        </View>
        <Text style={[styles.privacyNote, { color: colors.mutedForeground }]}>
          PhotoVault indexes media that Android makes available. Nothing is copied or uploaded.
          WhatsApp and Snapchat media appears when it is saved to your shared gallery.
        </Text>
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
                    : 'Allow photos & videos'}
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
                Choose full access to see your whole gallery. Limited access shows only selected items.
              </Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 17 },
  headline: {
    fontFamily: 'Inter_700Bold',
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1.1,
  },
  description: {
    maxWidth: 350,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 23,
  },
  bottom: {
    gap: 14,
  },
  benefitCard: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
  },
  benefitIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitCopy: { flex: 1, gap: 5 },
  benefitTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  benefitDetail: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  privacyNote: {
    paddingHorizontal: 3,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 17,
  },
  primaryButton: {
    minHeight: 58,
    paddingHorizontal: 20,
    borderRadius: 18,
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

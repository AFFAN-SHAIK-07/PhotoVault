import React from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { UpdateCenter } from '@/components/UpdateCenter';
import { useLibrary } from '@/context/LibraryContext';
import { useColors } from '@/hooks/useColors';

function formatLastScan(timestamp: number | null): string {
  if (!timestamp) return 'Not scanned yet';
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function SettingsScreen() {
  const colors = useColors();
  const library = useLibrary();
  const granted = library.permission?.granted === true;
  const accessLabel = !library.isNativeMediaAvailable
    ? 'Android app required'
    : granted
      ? library.permission?.accessPrivileges === 'limited'
        ? 'Selected media only'
        : 'Allowed'
      : library.permission?.status === 'denied'
        ? 'Not allowed'
        : 'Not connected';

  const openSettings = async () => {
    if (Platform.OS === 'web') return;
    try {
      await Linking.openSettings();
    } catch {
      // No action is needed if Android cannot open the system settings screen.
    }
  };

  const manageSelectedPhotos = async () => {
    if (Platform.OS === 'web') return;
    try {
      const MediaLibrary = await import('expo-media-library');
      await MediaLibrary.presentPermissionsPicker(['photo', 'video']);
      await library.refreshPermission();
      await library.refreshLibrary();
    } catch {
      await openSettings();
    }
  };

  const confirmClearIndex = () => {
    Alert.alert(
      'Clear local index?',
      'This removes PhotoVault’s indexed media metadata and album memberships. It keeps your original photos, videos, album names, and descriptions on the device.',
      [
        { text: 'Keep index', style: 'cancel' },
        {
          text: 'Clear index',
          style: 'destructive',
          onPress: () => void library.clearIndex(),
        },
      ],
    );
  };

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Settings" subtitle="Privacy and local library controls" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.summaryHeader}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.accent }]}>
              <Feather name="shield" size={18} color={colors.accentForeground} />
            </View>
            <View style={styles.summaryCopy}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Privacy dashboard</Text>
              <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>
                The current build keeps media metadata on this device.
              </Text>
            </View>
          </View>
          <StatusRow label="Photo and video access" value={accessLabel} />
          <StatusRow
            label="Indexed items"
            value={granted ? library.media.length.toLocaleString() : 'Hidden until access is granted'}
          />
          <StatusRow label="Last scan" value={formatLastScan(library.lastScannedAt)} />
          <StatusRow label="Automatic cloud upload" value="Off" />
          <StatusRow label="Google account" value="Optional; stored on this phone only" last />
        </View>

        <UpdateCenter />

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Device library</Text>
          <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>
            PhotoVault shows photos, videos, and screenshots already stored on your phone. It does
            not copy originals or upload your library.
          </Text>
          {library.isNativeMediaAvailable ? (
            <View style={styles.buttonColumn}>
              {granted ? (
                <ActionButton
                  icon="refresh-cw"
                  label={library.isScanning ? 'Scanning…' : 'Scan library now'}
                  onPress={() => void library.refreshLibrary()}
                  disabled={library.isScanning}
                  colors={colors}
                  testID="scan-library"
                />
              ) : (
                <ActionButton
                  icon="image"
                  label="Allow photo and video access"
                  onPress={() => void library.requestAccess()}
                  colors={colors}
                  testID="settings-request-access"
                />
              )}
              {library.permission?.accessPrivileges === 'limited' ? (
                <ActionButton
                  icon="sliders"
                  label="Manage selected media"
                  onPress={manageSelectedPhotos}
                  colors={colors}
                />
              ) : null}
              {!granted && library.permission?.status === 'denied' && !library.permission.canAskAgain ? (
                <ActionButton
                  icon="settings"
                  label="Open Android settings"
                  onPress={openSettings}
                  colors={colors}
                />
              ) : null}
            </View>
          ) : (
            <Text style={[styles.webNote, { color: colors.mutedForeground }]}>
              Device media access is available in the installed Android app, not this web preview.
            </Text>
          )}
          {library.isScanning && library.scanProgress ? (
            <Text style={[styles.scanProgress, { color: colors.primary }]}>
              {library.scanProgress.processed.toLocaleString()} of{' '}
              {library.scanProgress.total.toLocaleString()} items indexed
            </Text>
          ) : null}
          {library.error ? (
            <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>
              {library.error}
            </Text>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Appearance</Text>
          <View style={styles.appearanceRow}>
            <Feather name="monitor" size={16} color={colors.mutedForeground} />
            <Text style={[styles.appearanceText, { color: colors.foreground }]}>
              Follows your device’s light or dark setting
            </Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Local data</Text>
          <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>
            Clear the search index and album memberships without touching source files.
          </Text>
          <ActionButton
            icon="trash-2"
            label="Clear local index"
            onPress={confirmClearIndex}
            colors={colors}
            destructive
            testID="clear-local-index"
          />
        </View>
        <Text style={[styles.footer, { color: colors.mutedForeground }]}>
          File and folder access can vary by Android version and source app. Private app folders are
          not read.
        </Text>
      </ScrollView>
    </View>
  );
}

function StatusRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.statusRow,
        !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <Text style={[styles.statusLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.statusValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  colors,
  destructive = false,
  disabled = false,
  testID,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  destructive?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        {
          borderColor: destructive ? colors.destructive : colors.border,
          opacity: disabled ? 0.5 : pressed ? 0.65 : 1,
        },
      ]}
    >
      <Feather name={icon} size={16} color={destructive ? colors.destructive : colors.primary} />
      <Text style={[styles.actionButtonText, { color: destructive ? colors.destructive : colors.foreground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 20, paddingBottom: 128, gap: 16 },
  summaryCard: { padding: 19, borderWidth: 1, borderRadius: 24 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 12 },
  summaryIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1 },
  card: { padding: 19, borderWidth: 1, borderRadius: 24 },
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.25 },
  cardSubtitle: { marginTop: 7, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 },
  statusRow: { minHeight: 48, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusLabel: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12 },
  statusValue: { maxWidth: '53%', textAlign: 'right', fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  buttonColumn: { marginTop: 16, gap: 9 },
  actionButton: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  actionButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  scanProgress: { marginTop: 13, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  error: { marginTop: 12, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 19 },
  webNote: { marginTop: 12, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 19 },
  appearanceRow: { marginTop: 15, flexDirection: 'row', alignItems: 'center', gap: 11 },
  appearanceText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  footer: { paddingHorizontal: 4, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 18 },
});

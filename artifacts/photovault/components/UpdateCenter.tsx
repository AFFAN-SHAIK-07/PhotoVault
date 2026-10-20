import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { checkForAppUpdate, installOtaUpdate } from '@/lib/app-updates';
import { useColors } from '@/hooks/useColors';

export function UpdateCenter() {
  const colors = useColors();
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const checkForUpdates = async () => {
    setChecking(true);
    setStatus('Checking for updates…');

    try {
      const result = await checkForAppUpdate();
      if (result.status === 'not-configured') {
        setStatus('Update source is not configured for this build.');
        return;
      }
      if (result.status === 'up-to-date') {
        setStatus(`You’re up to date · version ${result.currentVersion}`);
        return;
      }

      if (result.status === 'ota') {
        Alert.alert(
          'Update available',
          'A new PhotoVault update is ready to download and install.',
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Update',
              onPress: () => {
                void installOtaUpdate().catch((error: unknown) => {
                  console.error('Unable to install the PhotoVault update.', error);
                  Alert.alert('Update failed', 'Please try again later.');
                });
              },
            },
          ],
        );
        setStatus('An update is available.');
        return;
      }

      Alert.alert(
        'Update available',
        `PhotoVault ${result.version} is ready to download. Android will ask you to install it.`,
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Download',
            onPress: () => {
              void Linking.openURL(result.downloadUrl).catch((error: unknown) => {
                console.error('Unable to open the PhotoVault download.', error);
                Alert.alert('Download failed', 'Please try again later.');
              });
            },
          },
        ],
      );
      setStatus(`Version ${result.version} is available.`);
    } catch (error) {
      console.error('Unable to check for PhotoVault updates.', error);
      setStatus('Could not check for updates. Check your connection and try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: colors.muted }]}>
          <Feather name="download-cloud" size={18} color={colors.foreground} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.foreground }]}>App updates</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Installed version {Constants.expoConfig?.version ?? '1.0.0'}
          </Text>
        </View>
      </View>
      {status ? (
        <Text accessibilityLiveRegion="polite" style={[styles.status, { color: colors.mutedForeground }]}>
          {status}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: checking }}
        disabled={checking}
        onPress={() => void checkForUpdates()}
        style={({ pressed }) => [
          styles.button,
          { borderColor: colors.border, opacity: checking ? 0.55 : pressed ? 0.65 : 1 },
        ]}
      >
        <Feather name="refresh-cw" size={16} color={colors.primary} />
        <Text style={[styles.buttonText, { color: colors.foreground }]}>
          {checking ? 'Checking…' : 'Check for updates'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 19, borderWidth: 1, borderRadius: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 4 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.25 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  status: { marginTop: 13, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  button: {
    minHeight: 48,
    marginTop: 15,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  buttonText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
});

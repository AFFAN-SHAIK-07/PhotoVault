import { useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import { checkForAppUpdate, installOtaUpdate } from '@/lib/app-updates';

export function AppUpdatePrompt() {
  useEffect(() => {
    let mounted = true;

    const checkForUpdate = async () => {
      try {
        const result = await checkForAppUpdate();
        if (!mounted || result.status === 'not-configured' || result.status === 'up-to-date') return;

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
      } catch (error) {
        console.error('Unable to check for PhotoVault updates.', error);
      }
    };

    void checkForUpdate();
    return () => {
      mounted = false;
    };
  }, []);

  return null;
}

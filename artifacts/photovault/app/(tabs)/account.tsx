import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useColors } from '@/hooks/useColors';

WebBrowser.maybeCompleteAuthSession();

const PROFILE_STORAGE_KEY = '@photovault/google-profile-v1';
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

type GoogleProfile = {
  id: string;
  email: string;
  name: string;
};

function hasGoogleClientId(): boolean {
  if (Platform.OS === 'android') return Boolean(GOOGLE_ANDROID_CLIENT_ID);
  if (Platform.OS === 'ios') return Boolean(GOOGLE_IOS_CLIENT_ID);
  return Boolean(GOOGLE_WEB_CLIENT_ID);
}

function ConfiguredGoogleAccount({
  profile,
  setProfile,
}: {
  profile: GoogleProfile | null;
  setProfile: (value: GoogleProfile | null) => void;
}) {
  const colors = useColors();
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [request, response, promptAsync] = Google.useAuthRequest(
    {
      webClientId: GOOGLE_WEB_CLIENT_ID,
      androidClientId: GOOGLE_ANDROID_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID,
      selectAccount: true,
    },
    { scheme: 'photovault', path: 'oauthredirect' },
  );

  useEffect(() => {
    if (!response) return;
    if (response.type === 'error') {
      setError(response.error?.message ?? 'Google sign-in did not complete.');
      setIsSigningIn(false);
      return;
    }
    if (response.type !== 'success') {
      setIsSigningIn(false);
      return;
    }

    const accessToken =
      response.authentication?.accessToken ?? response.params.access_token;
    if (!accessToken) {
      setError('Google did not return an account token. Check the OAuth client configuration.');
      setIsSigningIn(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const result = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!result.ok) throw new Error('Google could not return the account profile.');
        const data: unknown = await result.json();
        if (
          typeof data !== 'object' ||
          data === null ||
          !('sub' in data) ||
          typeof data.sub !== 'string' ||
          !('email' in data) ||
          typeof data.email !== 'string' ||
          !('name' in data) ||
          typeof data.name !== 'string' ||
          !('email_verified' in data) ||
          data.email_verified !== true
        ) {
          throw new Error('Google did not return a verified account profile.');
        }
        const account: GoogleProfile = {
          id: data.sub,
          email: data.email,
          name: data.name,
        };
        await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(account));
        if (!cancelled) {
          setProfile(account);
          setError(null);
        }
      } catch (signInError) {
        if (!cancelled) {
          setError(signInError instanceof Error ? signInError.message : 'Google sign-in failed.');
        }
      } finally {
        if (!cancelled) setIsSigningIn(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [response, setProfile]);

  const signIn = async () => {
    setError(null);
    setIsSigningIn(true);
    try {
      await promptAsync();
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Could not open Google sign-in.');
      setIsSigningIn(false);
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem(PROFILE_STORAGE_KEY);
      setProfile(null);
      setError(null);
    } catch (storageError) {
      setError(storageError instanceof Error ? storageError.message : 'Could not forget this account.');
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {profile ? (
        <>
          <View style={styles.profileRow}>
            <View style={[styles.avatarFallback, { backgroundColor: colors.accent }]}>
              <Feather name="user" size={20} color={colors.accentForeground} />
            </View>
            <View style={styles.profileCopy}>
              <Text style={[styles.profileName, { color: colors.foreground }]}>{profile.name}</Text>
              <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>{profile.email}</Text>
            </View>
          </View>
          <Text style={[styles.note, { color: colors.mutedForeground }]}>
            This account is remembered on this phone only. It is not connected to photo storage.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void signOut()}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
              Forget this account
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <View style={[styles.accountIcon, { backgroundColor: colors.accent }]}>
            <Feather name="user" size={20} color={colors.accentForeground} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Remember an account</Text>
          <Text style={[styles.note, { color: colors.mutedForeground }]}>
            Sign in with Google only if you want PhotoVault to remember your account on this phone.
            Photos and videos stay in your phone library; they are not uploaded.
          </Text>
          {error ? (
            <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>
              {error}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            testID="google-sign-in"
            disabled={!request || isSigningIn}
            onPress={() => void signIn()}
            style={({ pressed }) => [
              styles.googleButton,
              { borderColor: colors.border },
              (!request || isSigningIn) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {isSigningIn ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Feather name="user" size={17} color={colors.primary} />
            )}
            <Text style={[styles.googleButtonText, { color: colors.foreground }]}>
              {isSigningIn ? 'Connecting…' : 'Continue with Google'}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

export default function AccountScreen() {
  const colors = useColors();
  const [profile, setProfile] = useState<GoogleProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const configured = hasGoogleClientId();

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(PROFILE_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const value: unknown = JSON.parse(raw);
        if (
          typeof value !== 'object' ||
          value === null ||
          !('id' in value) ||
          typeof value.id !== 'string' ||
          !('email' in value) ||
          typeof value.email !== 'string' ||
          !('name' in value) ||
          typeof value.name !== 'string'
        ) {
          throw new Error('Saved account details are invalid. Forget the account and sign in again.');
        }
        if (mounted) {
          setProfile({
            id: value.id,
            email: value.email,
            name: value.name,
          });
        }
      })
      .catch((error: unknown) => {
        if (mounted) {
          setLoadError(error instanceof Error ? error.message : 'Could not load the saved account.');
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Account" subtitle="Optional Google sign-in" />
      <View style={styles.content}>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : loadError ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>
            {loadError}
          </Text>
        ) : configured ? (
          <ConfiguredGoogleAccount profile={profile} setProfile={setProfile} />
        ) : (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.accountIcon, { backgroundColor: colors.accent }]}>
              <Feather name="user" size={20} color={colors.accentForeground} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Google sign-in is optional</Text>
            <Text style={[styles.note, { color: colors.mutedForeground }]}>
              Add the Google OAuth client IDs to the private .env file to enable account memory.
              Until then, PhotoVault works without an account. Signing in will not upload your media.
            </Text>
            {Platform.OS === 'web' ? (
              <Text style={[styles.note, { color: colors.mutedForeground }]}>
                Configure EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID for this browser preview.
              </Text>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 22, paddingBottom: 100 },
  card: { padding: 20, borderWidth: 1, borderRadius: 18 },
  accountIcon: {
    width: 48,
    height: 48,
    marginBottom: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 19, lineHeight: 25 },
  note: { marginTop: 10, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 },
  googleButton: {
    minHeight: 48,
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  secondaryButton: {
    minHeight: 44,
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileCopy: { flex: 1, gap: 4 },
  profileName: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  profileEmail: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  avatarFallback: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  error: { marginTop: 12, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.5 },
});

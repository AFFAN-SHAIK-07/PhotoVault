import React, { useMemo, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { EmptyGrid, MediaGrid } from '@/components/MediaGrid';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useLibrary } from '@/context/LibraryContext';
import { useColors } from '@/hooks/useColors';
import { filterMedia } from '@/lib/library-utils';
import type { MediaFilter } from '@/lib/library-utils';
import type { SourceCategory } from '@/lib/types';

const filterOptions: {
  id: MediaFilter;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}[] = [
  { id: 'all', label: 'All media', icon: 'grid' },
  { id: 'photos', label: 'Photos', icon: 'image' },
  { id: 'videos', label: 'Videos', icon: 'video' },
  { id: 'favorites', label: 'Favorites', icon: 'heart' },
  { id: 'camera', label: 'Camera', icon: 'camera' },
  { id: 'screenshots', label: 'Screenshots', icon: 'smartphone' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'message-circle' },
  { id: 'snapchat', label: 'Snapchat', icon: 'aperture' },
  { id: 'downloads', label: 'Downloads', icon: 'download' },
];

export default function SearchScreen() {
  const colors = useColors();
  const library = useLibrary();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MediaFilter>('all');
  const results = useMemo(
    () => filterMedia(library.media, query, filter),
    [filter, library.media, query],
  );
  const canSearch = library.permission?.granted === true && library.isNativeMediaAvailable;

  return (
    <KeyboardAvoidingView style={[styles.page, { backgroundColor: colors.background }]} behavior="padding">
      <ScreenHeader title="Search" subtitle="Find a photo by date, type, or source" />
      <View style={styles.searchSection}>
        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.searchIcon, { backgroundColor: colors.accent }]}>
            <Feather name="search" size={17} color={colors.primary} />
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search photos, dates, folders…"
            placeholderTextColor={colors.mutedForeground}
            accessibilityLabel="Search local media"
            testID="search-local-media"
            returnKeyType="search"
            autoCapitalize="none"
            style={[styles.input, { color: colors.foreground }]}
          />
          {query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => {
                setQuery('');
                Keyboard.dismiss();
              }}
              style={styles.clearButton}
            >
              <Feather name="x-circle" size={18} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.browseHeading}>
          <Text style={[styles.browseTitle, { color: colors.foreground }]}>Browse by</Text>
          <Text style={[styles.browseHint, { color: colors.mutedForeground }]}>
            {filterOptions.find((item) => item.id === filter)?.label}
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        style={styles.filterScroll}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.filterRow}
      >
        {filterOptions.map((item) => {
          const active = filter === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              testID={`search-filter-${item.id}`}
              onPress={() => setFilter(item.id)}
              style={({ pressed }) => [
                styles.filterChip,
                {
                  backgroundColor: active ? colors.primary : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                },
                pressed && styles.pressed,
              ]}
            >
              <Feather
                name={item.icon}
                size={14}
                color={active ? colors.primaryForeground : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.filterLabel,
                  { color: active ? colors.primaryForeground : colors.secondaryForeground },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.metaRow}>
        <View style={styles.resultCopy}>
          <Text style={[styles.resultTitle, { color: colors.foreground }]}>
            {canSearch
              ? query || filter !== 'all'
                ? `${results.length.toLocaleString()} results`
                : 'Your library'
              : 'Search your library'}
          </Text>
          <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
            {canSearch ? `${results.length.toLocaleString()} items found` : 'Private, on-device search'}
          </Text>
        </View>
        <View style={[styles.scopeBadge, { backgroundColor: colors.accent }]}>
          <Feather name="shield" size={12} color={colors.primary} />
          <Text style={[styles.scope, { color: colors.accentForeground }]}>ON DEVICE</Text>
        </View>
      </View>
      {!canSearch ? (
        <View style={[styles.emptySearch, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.permissionIcon, { backgroundColor: colors.accent }]}>
            <Feather
              name={Platform.OS === 'web' ? 'smartphone' : 'image'}
              size={20}
              color={colors.primary}
            />
          </View>
          <Text style={[styles.permissionTitle, { color: colors.foreground }]}>
            {Platform.OS === 'web' ? 'Your phone gallery stays on your phone' : 'Allow access to start searching'}
          </Text>
          <Text style={[styles.permissionDetail, { color: colors.mutedForeground }]}>
            {Platform.OS === 'web'
              ? 'Open PhotoVault on Android to search your photos and videos. This browser preview cannot access media stored on your phone.'
              : 'Search by filename, capture date, media type, or source folder. Your photos stay private and are never uploaded.'}
          </Text>
          {library.isNativeMediaAvailable ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void library.requestAccess()}
              style={({ pressed }) => [
                styles.permissionButton,
                { backgroundColor: colors.primary },
                pressed && styles.pressed,
              ]}
            >
              <Feather name="image" size={15} color={colors.primaryForeground} />
              <Text style={[styles.permissionButtonText, { color: colors.primaryForeground }]}>
                Allow photos & videos
              </Text>
              <Feather name="arrow-right" size={15} color={colors.primaryForeground} />
            </Pressable>
          ) : null}
        </View>
      ) : (
        <MediaGrid
          media={results}
          onPress={(media) => router.push({ pathname: '/photo/[id]', params: { id: media.id } })}
          emptyComponent={
            <EmptyGrid
              title={query ? 'No matching media' : 'No items in this filter'}
              detail="Try another search term or filter. PhotoVault only searches metadata it has indexed."
            />
          }
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  searchSection: { paddingHorizontal: 20, paddingTop: 16 },
  searchBox: {
    minHeight: 58,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  searchIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 52, fontFamily: 'Inter_400Regular', fontSize: 14 },
  clearButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  browseHeading: {
    marginTop: 23,
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  browseTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.2 },
  browseHint: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  filterScroll: { flexGrow: 0, flexShrink: 0, height: 58 },
  filterRow: { paddingHorizontal: 20, alignItems: 'center', gap: 8 },
  filterChip: {
    minHeight: 37,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  filterLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  metaRow: {
    minHeight: 74,
    paddingHorizontal: 21,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#00000010',
  },
  resultCopy: { gap: 4 },
  resultTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.25 },
  resultCount: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  scopeBadge: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scope: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.55 },
  emptySearch: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 22,
    minHeight: 245,
    paddingHorizontal: 23,
    paddingVertical: 25,
    borderWidth: 1,
    borderRadius: 24,
    alignItems: 'flex-start',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  permissionCard: {
    margin: 20,
    padding: 22,
    borderWidth: 1,
    borderRadius: 24,
  },
  permissionIcon: {
    width: 48,
    height: 48,
    marginBottom: 17,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionTitle: { fontFamily: 'Inter_700Bold', fontSize: 19, letterSpacing: -0.45, lineHeight: 25 },
  permissionDetail: { marginTop: 9, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 21 },
  permissionButton: {
    alignSelf: 'stretch',
    minHeight: 50,
    marginTop: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  permissionButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  pressed: { opacity: 0.7 },
});

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
import { FilterPill } from '@/components/FilterPill';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useLibrary } from '@/context/LibraryContext';
import { useColors } from '@/hooks/useColors';
import { filterMedia } from '@/lib/library-utils';
import type { MediaFilter } from '@/lib/library-utils';
import type { SourceCategory } from '@/lib/types';

const filterOptions: { id: MediaFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'photos', label: 'Photos' },
  { id: 'videos', label: 'Videos' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'camera', label: 'Camera' },
  { id: 'screenshots', label: 'Screenshots' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'snapchat', label: 'Snapchat' },
  { id: 'downloads', label: 'Downloads' },
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
      <ScreenHeader
        title="Search"
        subtitle="Find what is already indexed on this device"
      />
      <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={18} color={colors.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Try a filename, date, or folder"
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
            <Feather name="x" size={17} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.filterRow}
      >
        {filterOptions.map((item) => (
          <FilterPill
            key={item.id}
            label={item.label}
            active={filter === item.id}
            testID={`search-filter-${item.id}`}
            onPress={() => setFilter(item.id)}
          />
        ))}
      </ScrollView>

      <View style={styles.metaRow}>
        <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
          {canSearch ? `${results.length.toLocaleString()} results` : 'Local search'}
        </Text>
        <Text style={[styles.scope, { color: colors.mutedForeground }]}>Offline</Text>
      </View>

      {!canSearch ? (
        <View style={[styles.permissionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.permissionIcon, { backgroundColor: colors.accent }]}>
            <Feather name={Platform.OS === 'web' ? 'smartphone' : 'lock'} size={18} color={colors.accentForeground} />
          </View>
          <Text style={[styles.permissionTitle, { color: colors.foreground }]}>
            Connect your local library
          </Text>
          <Text style={[styles.permissionDetail, { color: colors.mutedForeground }]}>
            Search uses local filenames, dates, media types, and folder names. It does not send your
            photos to a search service.
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
              <Text style={[styles.permissionButtonText, { color: colors.primaryForeground }]}>
                Allow photo access
              </Text>
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
  searchBox: {
    minHeight: 48,
    marginHorizontal: 18,
    marginTop: 14,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  input: { flex: 1, minHeight: 46, fontFamily: 'Inter_400Regular', fontSize: 13 },
  clearButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  filterRow: { paddingHorizontal: 18, paddingVertical: 11, gap: 7 },
  metaRow: {
    minHeight: 34,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultCount: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  scope: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 0.4 },
  permissionCard: {
    margin: 18,
    padding: 20,
    borderWidth: 1,
    borderRadius: 20,
  },
  permissionIcon: {
    width: 40,
    height: 40,
    marginBottom: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  permissionDetail: { marginTop: 7, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 },
  permissionButton: {
    alignSelf: 'flex-start',
    marginTop: 16,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 12,
  },
  permissionButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  pressed: { opacity: 0.7 },
});

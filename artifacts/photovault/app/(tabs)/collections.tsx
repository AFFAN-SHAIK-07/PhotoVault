import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { KeyboardAvoidingView as KeyboardControllerView } from 'react-native-keyboard-controller';
import { AlbumCard } from '@/components/AlbumCard';
import { EmptyGrid } from '@/components/MediaGrid';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useLibrary } from '@/context/LibraryContext';
import { useColors } from '@/hooks/useColors';
import { smartCollections } from '@/lib/smart-collections';
import type { SmartCollection } from '@/lib/smart-collections';
import type { AlbumSummary } from '@/lib/types';

type AlbumSortMode = 'custom' | 'recent' | 'name';

function SmartCollectionCard({
  item,
  count,
  onPress,
}: {
  item: SmartCollection;
  count: number;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title}, ${count} items`}
      testID={`smart-collection-${item.id}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.smartCard,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.smartIcon, { backgroundColor: colors.accent }]}>
        <Feather name={item.icon} size={17} color={colors.accentForeground} />
      </View>
      <Text numberOfLines={1} style={[styles.smartTitle, { color: colors.foreground }]}>
        {item.title}
      </Text>
      <Text style={[styles.smartCount, { color: colors.mutedForeground }]}>
        {count.toLocaleString()} items
      </Text>
    </Pressable>
  );
}

export default function CollectionsScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const library = useLibrary();
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<AlbumSortMode>('custom');
  const [reorderMode, setReorderMode] = useState(false);
  const cardWidth = Math.floor((width - 50) / 2);

  const visibleAlbums = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const filtered = library.albums.filter(
      (album) =>
        !normalized ||
        album.name.toLocaleLowerCase().includes(normalized) ||
        album.description.toLocaleLowerCase().includes(normalized),
    );
    if (sortMode === 'name') {
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortMode === 'recent') {
      return [...filtered].sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return filtered;
  }, [library.albums, query, sortMode]);

  const header = (
    <View>
      <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={17} color={colors.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Find an album"
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="search"
          accessibilityLabel="Search albums"
          testID="search-albums"
          style={[styles.searchInput, { color: colors.foreground }]}
        />
        {query ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear album search"
            onPress={() => setQuery('')}
            style={styles.clearSearch}
          >
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.sectionHeading}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>On this device</Text>
        <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
          Source matches depend on what Android makes visible.
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.smartRow}
      >
        {smartCollections.map((item) => (
          <SmartCollectionCard
            key={item.id}
            item={item}
            count={item.matches(library.media).length}
            onPress={() =>
              router.push({ pathname: '/albums/[id]', params: { id: `smart-${item.id}` } })
            }
          />
        ))}
      </ScrollView>

      <View style={[styles.sectionHeading, styles.albumHeading]}>
        <View style={styles.sectionCopy}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your albums</Text>
          <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
            Albums are local references; they do not duplicate or move files.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={reorderMode ? 'Finish reordering albums' : 'Reorder albums'}
          onPress={() => setReorderMode((current) => !current)}
          style={({ pressed }) => [styles.reorderButton, pressed && styles.pressed]}
        >
          <Feather name={reorderMode ? 'check' : 'list'} size={17} color={colors.primary} />
          <Text style={[styles.reorderLabel, { color: colors.primary }]}>
            {reorderMode ? 'Done' : 'Order'}
          </Text>
        </Pressable>
      </View>
      <View style={styles.sortRow}>
        {([
          ['custom', 'Custom'],
          ['recent', 'Recently edited'],
          ['name', 'Name'],
        ] as const).map(([mode, label]) => (
          <Pressable
            key={mode}
            accessibilityRole="button"
            accessibilityState={{ selected: sortMode === mode }}
            onPress={() => {
              setSortMode(mode);
              if (mode !== 'custom') setReorderMode(false);
              Keyboard.dismiss();
            }}
            style={[
              styles.sortOption,
              sortMode === mode && { backgroundColor: colors.muted },
            ]}
          >
            <Text
              style={[
                styles.sortOptionText,
                { color: sortMode === mode ? colors.foreground : colors.mutedForeground },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <KeyboardControllerView style={[styles.page, { backgroundColor: colors.background }]} behavior="padding">
      <ScreenHeader
        title="Collections"
        subtitle={`${library.albums.length} ${library.albums.length === 1 ? 'album' : 'albums'}`}
        actionIcon="plus"
        actionLabel="Create album"
        onAction={() => router.push('/albums/new')}
      />
      <FlatList
        data={visibleAlbums}
        keyExtractor={(item) => item.id}
        numColumns={2}
        ListHeaderComponent={header}
        ListEmptyComponent={
          query ? (
            <EmptyGrid title="No matching albums" detail="Try a different album name or description." />
          ) : (
            <EmptyGrid title="Start a collection" detail="Create a virtual album to group selected items." />
          )
        }
        renderItem={({ item, index }) => (
          <View style={{ width: cardWidth, marginLeft: index % 2 === 0 ? 18 : 10, marginBottom: 12 }}>
            <AlbumCard
              album={item}
              width={cardWidth}
              showCover={library.permission?.granted === true}
              reorderMode={reorderMode && sortMode === 'custom'}
              canMoveUp={index > 0}
              canMoveDown={index < visibleAlbums.length - 1}
              onPress={() => router.push({ pathname: '/albums/[id]', params: { id: item.id } })}
              onToggleFavorite={() => void library.toggleAlbumFavorite(item.id)}
              onMove={(direction) => void library.moveAlbum(item.id, direction)}
            />
          </View>
        )}
        columnWrapperStyle={visibleAlbums.length > 0 ? { paddingRight: 18 } : undefined}
        contentContainerStyle={{ paddingBottom: 120, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      />
    </KeyboardControllerView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  searchBox: {
    minHeight: 46,
    marginHorizontal: 18,
    marginTop: 14,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  searchInput: { flex: 1, minHeight: 44, fontFamily: 'Inter_400Regular', fontSize: 14 },
  clearSearch: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  sectionHeading: {
    marginTop: 23,
    paddingHorizontal: 18,
    gap: 4,
  },
  sectionCopy: { flex: 1 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.35 },
  sectionHint: { marginTop: 3, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  smartRow: { paddingHorizontal: 18, paddingTop: 11, paddingBottom: 3, gap: 9 },
  smartCard: {
    width: 106,
    minHeight: 116,
    padding: 11,
    borderWidth: 1,
    borderRadius: 16,
  },
  smartIcon: {
    width: 31,
    height: 31,
    marginBottom: 10,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  smartCount: { marginTop: 4, fontFamily: 'Inter_400Regular', fontSize: 9 },
  albumHeading: {
    marginTop: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reorderButton: { minHeight: 36, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  reorderLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  sortRow: {
    marginTop: 9,
    paddingHorizontal: 18,
    flexDirection: 'row',
    gap: 6,
  },
  sortOption: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 99 },
  sortOptionText: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  pressed: { opacity: 0.62 },
});

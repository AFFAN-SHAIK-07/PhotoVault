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
import { Image } from 'expo-image';
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
  coverUri,
  onPress,
}: {
  item: SmartCollection;
  count: number;
  coverUri?: string;
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
      <View style={[styles.smartCover, { backgroundColor: colors.muted }]}>
        {coverUri ? (
          <Image source={{ uri: coverUri }} contentFit="cover" style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={[styles.smartIcon, { backgroundColor: colors.card }]}>
          <Feather name={item.icon} size={15} color={colors.primary} />
        </View>
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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open People face groups"
        testID="people-collection-entry"
        onPress={() => router.push('/people')}
        style={({ pressed }) => [
          styles.peopleEntry,
          { backgroundColor: colors.card, borderColor: colors.border },
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.peopleIcon, { backgroundColor: colors.muted }]}>
          <Feather name="users" size={18} color={colors.foreground} />
        </View>
        <View style={styles.peopleCopy}>
          <Text style={[styles.peopleTitle, { color: colors.foreground }]}>People</Text>
          <Text style={[styles.peopleHint, { color: colors.mutedForeground }]}>
            Group familiar faces privately on this phone
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>

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
            coverUri={item.matches(library.media)[0]?.uri}
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
    minHeight: 52,
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  searchInput: { flex: 1, minHeight: 48, fontFamily: 'Inter_400Regular', fontSize: 14 },
  clearSearch: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  peopleEntry: {
    minHeight: 72,
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  peopleIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peopleCopy: { flex: 1, gap: 4 },
  peopleTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  peopleHint: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  sectionHeading: {
    marginTop: 25,
    paddingHorizontal: 20,
    gap: 5,
  },
  sectionCopy: { flex: 1 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 19, letterSpacing: -0.45 },
  sectionHint: { marginTop: 4, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  smartRow: { paddingHorizontal: 20, paddingTop: 13, paddingBottom: 3, gap: 11 },
  smartCard: {
    width: 142,
    minHeight: 158,
    padding: 9,
    borderWidth: 1,
    borderRadius: 19,
    overflow: 'hidden',
  },
  smartCover: {
    height: 88,
    marginBottom: 10,
    borderRadius: 13,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 7,
  },
  smartIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartTitle: { paddingHorizontal: 3, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  smartCount: { marginTop: 4, paddingHorizontal: 3, fontFamily: 'Inter_400Regular', fontSize: 10 },
  albumHeading: {
    marginTop: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reorderButton: { minHeight: 36, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  reorderLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  sortRow: {
    marginTop: 11,
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 6,
  },
  sortOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99 },
  sortOptionText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  pressed: { opacity: 0.62 },
});

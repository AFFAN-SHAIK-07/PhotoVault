import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { EmptyGrid, MediaGrid } from '@/components/MediaGrid';
import { useLibrary } from '@/context/LibraryContext';
import { useColors } from '@/hooks/useColors';
import { getAlbumMedia } from '@/lib/database';
import { getSmartCollection } from '@/lib/smart-collections';
import type { AlbumSort, MediaRecord } from '@/lib/types';

const sortOptions: { id: AlbumSort; label: string }[] = [
  { id: 'date-taken', label: 'Date taken' },
  { id: 'date-added', label: 'Date added' },
  { id: 'name', label: 'Name' },
];

export default function AlbumScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id ?? '';
  const database = useSQLiteContext();
  const library = useLibrary();
  const colors = useColors();
  const smartCollection = getSmartCollection(id);
  const album = library.albums.find((item) => item.id === id);
  const [albumMedia, setAlbumMedia] = useState<MediaRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!smartCollection);
  const [sort, setSort] = useState<AlbumSort>('date-taken');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!id || smartCollection) {
        setLoading(false);
        return;
      }

      let active = true;
      setLoading(true);
      setError(null);
      void getAlbumMedia(database, id, sort)
        .then((items) => {
          if (active) setAlbumMedia(items);
        })
        .catch((loadError: unknown) => {
          if (active) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : 'Could not load this album.',
            );
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [database, id, smartCollection, sort]),
  );

  const title = smartCollection?.title ?? album?.name ?? 'Album';
  const media = smartCollection
    ? smartCollection.matches(library.media)
    : albumMedia;
  const openMedia = (item: MediaRecord) => {
    if (selectedIds.length > 0 && album) {
      setSelectedIds((current) =>
        current.includes(item.id)
          ? current.filter((selectedId) => selectedId !== item.id)
          : [...current, item.id],
      );
      return;
    }
    router.push({ pathname: '/photo/[id]', params: { id: item.id } });
  };
  const toggleMediaSelection = (item: MediaRecord) => {
    if (!album) return;
    setSelectedIds((current) =>
      current.includes(item.id)
        ? current.filter((selectedId) => selectedId !== item.id)
        : [...current, item.id],
    );
  };
  const confirmRemoveMedia = () => {
    if (!album || selectedIds.length === 0) return;
    Alert.alert(
      `Remove ${selectedIds.length} ${selectedIds.length === 1 ? 'item' : 'items'}?`,
      'This removes the items from this album only. Original files on your device will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove from album',
          onPress: () => {
            void library.removeMediaFromAlbumMany(album.id, selectedIds)
              .then(() => setSelectedIds([]))
              .catch((removeError: unknown) => {
                setError(
                  removeError instanceof Error
                    ? removeError.message
                    : 'Could not remove items from this album.',
                );
              });
          },
        },
      ],
    );
  };
  const deleteAlbum = () => {
    if (!album) return;
    Alert.alert(
      `Delete "${album.name}"?`,
      'This removes the album and its membership list only. Original photos and videos will stay on your device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete album',
          style: 'destructive',
          onPress: () => {
            void library.deleteAlbum(album.id)
              .then(() => router.back())
              .catch((deleteError: unknown) => {
                setError(
                  deleteError instanceof Error
                    ? deleteError.message
                    : 'Could not delete this album.',
                );
              });
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: selectedIds.length > 0 ? `${selectedIds.length} selected` : title,
          headerLeft: selectedIds.length > 0
            ? () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear selected items"
                  onPress={() => setSelectedIds([])}
                  style={styles.headerAction}
                >
                  <Feather name="x" size={20} color={colors.foreground} />
                </Pressable>
              )
            : undefined,
          headerRight: album
            ? () => (
                <View style={styles.headerActions}>
                  {selectedIds.length > 0 ? (
                    <HeaderAction label="Remove selected items from album" icon="minus-circle" destructive onPress={confirmRemoveMedia} />
                  ) : null}
                  <HeaderAction label="Add media" icon="plus" onPress={() => router.push({
                    pathname: '/albums/select',
                    params: { mode: 'add', albumId: album.id },
                  })} />
                  <HeaderAction label="Choose cover" icon="image" onPress={() => router.push({
                    pathname: '/albums/select',
                    params: { mode: 'cover', albumId: album.id },
                  })} />
                  <HeaderAction label="Edit album" icon="edit-2" onPress={() => router.push({
                    pathname: '/albums/edit',
                    params: { id: album.id },
                  })} />
                  <HeaderAction label="Delete album" icon="trash-2" destructive onPress={deleteAlbum} />
                </View>
              )
            : undefined,
        }}
      />
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text accessibilityRole="alert" style={[styles.message, { color: colors.destructive }]}>
            {error}
          </Text>
        </View>
      ) : smartCollection || album ? (
        <>
          {album ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sortRow}
            >
              {sortOptions.map((option) => (
                <Pressable
                  key={option.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sort === option.id }}
                  onPress={() => setSort(option.id)}
                  style={[
                    styles.sortPill,
                    {
                      backgroundColor: sort === option.id ? colors.accent : colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sortText,
                      { color: sort === option.id ? colors.accentForeground : colors.mutedForeground },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          <MediaGrid
            media={media}
            selectedIds={selectedIds}
            onPress={openMedia}
            onLongPress={toggleMediaSelection}
            emptyComponent={
              <EmptyGrid
                title={`No items in ${title.toLocaleLowerCase()}`}
                detail="Media you add or allow on this device will appear here."
              />
            }
          />
        </>
      ) : (
        <EmptyGrid
          title="Album not found"
          detail="It may have been deleted. Your original photos were not affected."
        />
      )}
    </View>
  );
}

function HeaderAction({
  label,
  icon,
  onPress,
  destructive = false,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  destructive?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
    >
      <Feather name={icon} size={17} color={destructive ? colors.destructive : colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  message: { fontFamily: 'Inter_500Medium', fontSize: 14, textAlign: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerAction: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  sortRow: { minHeight: 54, paddingHorizontal: 16, alignItems: 'center', gap: 8 },
  sortPill: { minHeight: 32, paddingHorizontal: 12, borderWidth: 1, borderRadius: 18, justifyContent: 'center' },
  sortText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
});

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { AlbumCard } from '@/components/AlbumCard';
import { EmptyGrid, MediaGrid } from '@/components/MediaGrid';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useLibrary } from '@/context/LibraryContext';
import { useColors } from '@/hooks/useColors';
import { getAlbumMedia } from '@/lib/database';
import type { AlbumMediaRecord } from '@/lib/types';

export default function AlbumSelectionScreen() {
  const { mode, albumId: rawAlbumId } = useLocalSearchParams<{ mode?: string; albumId?: string }>();
  const albumId = Array.isArray(rawAlbumId) ? rawAlbumId[0] : rawAlbumId;
  const isChoosingAlbum = mode === 'choose-album';
  const isChoosingCover = mode === 'cover';
  const library = useLibrary();
  const colors = useColors();
  const database = useSQLiteContext();
  const { width } = useWindowDimensions();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [existingIds, setExistingIds] = useState<string[]>([]);
  const [loadingMembership, setLoadingMembership] = useState(!isChoosingAlbum);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const album = library.albums.find((item) => item.id === albumId);

  useFocusEffect(
    useCallback(() => {
      if (isChoosingAlbum || !albumId) {
        setLoadingMembership(false);
        return;
      }
      let active = true;
      setLoadingMembership(true);
      setError(null);
      void getAlbumMedia(database, albumId).then((items) => {
        if (active) setExistingIds(items.map((item) => item.id));
      }).catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load album membership.',
          );
        }
      }).finally(() => {
        if (active) setLoadingMembership(false);
      });
      return () => {
        active = false;
      };
    }, [albumId, database, isChoosingAlbum]),
  );

  const mediaForPicker = useMemo(() => {
    const existing = new Set(existingIds);
    const available = library.media.filter((item) => !existing.has(item.id));
    if (!isChoosingCover) return available;
    return library.media.filter((item) => existing.has(item.id) && item.mediaType === 'photo');
  }, [existingIds, isChoosingCover, library.media]);

  const toggleSelection = (item: AlbumMediaRecord | (typeof library.media)[number]) => {
    setSelectedIds((current) => {
      if (current.includes(item.id)) return current.filter((id) => id !== item.id);
      if (isChoosingCover) return [item.id];
      return [...current, item.id];
    });
  };

  const confirmSelection = async () => {
    if (!albumId || selectedIds.length === 0) return;
    setSaving(true);
    try {
      if (isChoosingCover) {
        await library.setAlbumCover(albumId, selectedIds[0]);
      } else {
        await library.addMediaToAlbum(albumId, selectedIds);
      }
      router.back();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not save this selection.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (isChoosingAlbum) {
    const selected = library.selectionDraft;
    return (
      <View style={[styles.page, { backgroundColor: colors.background }]}>
        <ScreenHeader
          title="Add to album"
          subtitle={`${selected.length} selected`}
          actionIcon="x"
          actionLabel="Cancel"
          onAction={() => {
            library.setSelectionDraft([]);
            router.back();
          }}
        />
        {error ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>
            {error}
          </Text>
        ) : null}
        {library.albums.length === 0 ? (
          <View style={styles.emptyPicker}>
            <EmptyGrid title="Create an album first" detail="Your selected media will stay selected while you create one." />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/albums/new')}
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>Create album</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={library.albums}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 18, paddingBottom: 60 }}
            ItemSeparatorComponent={() => <View style={{ height: 9 }} />}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Add selection to ${item.name}`}
                testID={`choose-album-${item.id}`}
                onPress={async () => {
                  if (selected.length === 0) return;
                  setSaving(true);
                  setError(null);
                  try {
                    await library.addMediaToAlbum(item.id, selected);
                    library.setSelectionDraft([]);
                    router.back();
                  } catch (saveError) {
                    setError(
                      saveError instanceof Error
                        ? saveError.message
                        : 'Could not add these items to the album.',
                    );
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                style={({ pressed }) => [
                  styles.albumChoice,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.albumChoiceIcon, { backgroundColor: colors.accent }]}>
                  <Feather name="folder" size={17} color={colors.accentForeground} />
                </View>
                <View style={styles.choiceCopy}>
                  <Text style={[styles.choiceTitle, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[styles.choiceDetail, { color: colors.mutedForeground }]}>
                    {item.mediaCount} items
                  </Text>
                </View>
                <Feather name="chevron-right" size={19} color={colors.mutedForeground} />
              </Pressable>
            )}
          />
        )}
      </View>
    );
  }

  if (!albumId || !album) {
    return (
      <View style={[styles.page, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Select media" actionIcon="x" actionLabel="Close" onAction={() => router.back()} />
        <EmptyGrid title="Album not found" detail="Return to Collections and open the album again." />
      </View>
    );
  }

  const title = isChoosingCover ? 'Choose cover' : 'Add media';
  const emptyMessage = isChoosingCover
    ? 'Add photos to this album before choosing a cover.'
    : 'All accessible media is already in this album.';
  const emptyState = <EmptyGrid title="Nothing to select" detail={emptyMessage} />;

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title={title}
        subtitle={isChoosingCover ? album.name : `${selectedIds.length} selected`}
        actionIcon="x"
        actionLabel="Cancel"
        onAction={() => router.back()}
      />
      {error ? (
      <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>
        {error}
      </Text>
      ) : null}
      {!library.permission?.granted ? (
        <EmptyGrid title="Allow photo access" detail="Grant access to view and select local media." />
      ) : loadingMembership ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <MediaGrid
          media={mediaForPicker}
          selectedIds={selectedIds}
          onPress={toggleSelection}
          onLongPress={toggleSelection}
          emptyComponent={emptyState}
          contentBottomPadding={122}
        />
      )}
      {library.permission?.granted && selectedIds.length > 0 ? (
        <View
          style={[
            styles.confirmBar,
            {
              width: Math.min(width - 36, 440),
              backgroundColor: colors.primary,
              bottom: 18,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isChoosingCover ? 'Use selected photo as cover' : `Add ${selectedIds.length} selected items`}
            testID="confirm-album-selection"
            disabled={saving}
            onPress={() => void confirmSelection()}
            style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]}
          >
            <Text style={[styles.confirmText, { color: colors.primaryForeground }]}>
              {saving
                ? 'Saving…'
                : isChoosingCover
                  ? 'Use as cover'
                  : `Add ${selectedIds.length} ${selectedIds.length === 1 ? 'item' : 'items'}`}
            </Text>
            {!saving ? <Feather name="check" size={17} color={colors.primaryForeground} /> : null}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  emptyPicker: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  primaryButton: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 13 },
  primaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  albumChoice: { minHeight: 64, padding: 11, borderWidth: 1, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  albumChoiceIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  choiceCopy: { flex: 1 },
  choiceTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  choiceDetail: { marginTop: 4, fontFamily: 'Inter_400Regular', fontSize: 10 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  confirmBar: { position: 'absolute', alignSelf: 'center', borderRadius: 16, elevation: 8 },
  confirmButton: { minHeight: 54, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  confirmText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  pressed: { opacity: 0.7 },
  error: { marginHorizontal: 18, marginVertical: 8, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17 },
});

import React, { useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FilterPill } from '@/components/FilterPill';
import { LibraryPermissionPrompt } from '@/components/LibraryPermissionPrompt';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TimelineGrid } from '@/components/TimelineGrid';
import { useLibrary } from '@/context/LibraryContext';
import { useColors } from '@/hooks/useColors';
import { filterMedia } from '@/lib/library-utils';
import type { MediaFilter } from '@/lib/library-utils';
import type { MediaRecord } from '@/lib/types';

const filters: { id: 'all' | 'videos' | 'favorites'; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'videos', label: 'Videos' },
  { id: 'favorites', label: 'Favorites' },
];

export default function PhotosScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const library = useLibrary();
  const [activeFilter, setActiveFilter] = useState<MediaFilter>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleMedia = useMemo(
    () => filterMedia(library.media, '', activeFilter),
    [activeFilter, library.media],
  );
  const selectedItems = useMemo(
    () => library.media.filter((item) => selectedSet.has(item.id)),
    [library.media, selectedSet],
  );

  const toggleSelection = (item: MediaRecord) => {
    setSelectedIds((current) =>
      current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id],
    );
  };

  const allVisibleSelected =
    visibleMedia.length > 0 && visibleMedia.every((item) => selectedSet.has(item.id));
  const toggleSelectAllVisible = () => {
    setSelectedIds((current) => {
      const visibleIds = new Set(visibleMedia.map((item) => item.id));
      return allVisibleSelected
        ? current.filter((id) => !visibleIds.has(id))
        : [...new Set([...current, ...visibleIds])];
    });
  };

  const openMedia = (item: MediaRecord) => {
    if (selectedIds.length > 0) {
      toggleSelection(item);
      return;
    }
    router.push({ pathname: '/photo/[id]', params: { id: item.id } });
  };

  const toggleAllFavorites = async () => {
    if (selectedIds.length === 0 || isActing) return;
    setIsActing(true);
    setActionError(null);
    try {
      const isFavorite = !selectedItems.every((item) => item.isFavorite === 1);
      await library.setMediaFavorites(selectedIds, isFavorite);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not update favorites.');
    } finally {
      setIsActing(false);
    }
  };

  const shareSelected = async () => {
    if (selectedItems.length !== 1 || isActing) return;
    setIsActing(true);
    setActionError(null);
    try {
      const item = selectedItems[0];
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('The native share sheet is unavailable on this device.');
      }
      await Sharing.shareAsync(item.uri, {
        dialogTitle: `Share ${item.filename}`,
        mimeType: item.mimeType ?? undefined,
        UTI: item.mimeType?.startsWith('video/') ? 'public.movie' : 'public.image',
      });
      setSelectedIds([]);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not share this item.');
    } finally {
      setIsActing(false);
    }
  };

  const confirmDeleteSelected = () => {
    if (selectedIds.length === 0 || isActing) return;
    Alert.alert(
      `Delete ${selectedIds.length} ${selectedIds.length === 1 ? 'item' : 'items'}?`,
      'This removes the selected original media from your device. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete originals',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setIsActing(true);
              setActionError(null);
              try {
                const deleted = await library.deleteMedia(selectedIds);
                if (deleted) setSelectedIds([]);
              } catch (error) {
                setActionError(error instanceof Error ? error.message : 'Could not delete selected media.');
              } finally {
                setIsActing(false);
              }
            })();
          },
        },
      ],
    );
  };

  if (library.permissionChecking && !library.permission) {
    return (
      <View style={[styles.loadingPage, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
          Checking device access
        </Text>
      </View>
    );
  }

  if (!library.permission?.granted || !library.isNativeMediaAvailable) {
    return <LibraryPermissionPrompt />;
  }

  const filterRow = (
    <View style={[styles.filters, { borderBottomColor: colors.border }]}>
      <View style={styles.filterPills}>
        {filters.map((filter) => (
          <FilterPill
            key={filter.id}
            label={filter.label}
            active={activeFilter === filter.id}
            testID={`photos-filter-${filter.id}`}
            onPress={() => setActiveFilter(filter.id)}
          />
        ))}
      </View>
      {visibleMedia.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={allVisibleSelected ? 'Deselect all visible media' : 'Select all visible media'}
          onPress={toggleSelectAllVisible}
          style={({ pressed }) => [styles.selectAll, pressed && styles.pressed]}
        >
          <Text style={[styles.selectAllText, { color: colors.primary }]}>
            {allVisibleSelected ? 'Clear' : 'Select'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  const statusHeader = (
    <View>
      {library.isScanning ? (
        <View style={[styles.scanCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.scanHeader}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.scanText, { color: colors.foreground }]}>
              Indexing {library.scanProgress?.processed.toLocaleString() ?? 0}
              {library.scanProgress?.total
                ? ` of ${library.scanProgress.total.toLocaleString()}`
                : ''}{' '}
              items
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel scan"
              onPress={library.cancelScan}
              style={({ pressed }) => [styles.scanCancel, pressed && styles.pressed]}
            >
              <Feather name="x" size={18} color={colors.mutedForeground} />
            </Pressable>
          </View>
          {library.scanProgress?.total ? (
            <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
              <View
                style={[
                  styles.progressValue,
                  {
                    backgroundColor: colors.primary,
                    width: `${Math.min(
                      100,
                      (library.scanProgress.processed / library.scanProgress.total) * 100,
                    )}%`,
                  },
                ]}
              />
            </View>
          ) : null}
        </View>
      ) : null}
      {actionError ? (
        <View style={[styles.errorCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.destructive }]}>
            {actionError}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => setActionError(null)}>
            <Text style={[styles.retryText, { color: colors.primary }]}>Dismiss</Text>
          </Pressable>
        </View>
      ) : null}
      {library.error ? (
        <View style={[styles.errorCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.destructive }]}>
            {library.error}
          </Text>
          <Pressable onPress={() => void library.refreshLibrary()}>
            <Text style={[styles.retryText, { color: colors.primary }]}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title={selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Photos'}
        subtitle={`${visibleMedia.length.toLocaleString()} ${activeFilter === 'all' ? 'items' : activeFilter} on this device`}
        actionIcon={selectedIds.length > 0 ? 'x' : 'refresh-cw'}
        actionLabel={selectedIds.length > 0 ? 'Clear selection' : 'Rescan library'}
        onAction={() =>
          selectedIds.length > 0 ? setSelectedIds([]) : void library.refreshLibrary()
        }
      />
      {filterRow}
      <TimelineGrid
        media={visibleMedia}
        onPress={openMedia}
        onLongPress={toggleSelection}
        selectedIds={selectedIds}
        refreshing={library.isScanning}
        onRefresh={() => void library.refreshLibrary()}
        ListHeaderComponent={statusHeader}
        emptyTitle={activeFilter === 'all' ? 'No photos yet' : `No ${activeFilter} yet`}
        emptyDetail={
          activeFilter === 'all'
            ? 'Photos and videos you allow will appear here, grouped by capture date.'
            : 'Try another filter or refresh your local library.'
        }
      />
      {selectedIds.length > 0 ? (
        <View
          style={[
            styles.selectionBar,
            {
              bottom: insets.bottom + (Platform.OS === 'web' ? 90 : 78),
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              selectedItems.every((item) => item.isFavorite === 1)
                ? 'Remove selected media from favorites'
                : 'Add selected media to favorites'
            }
            onPress={() => void toggleAllFavorites()}
            disabled={isActing}
            style={({ pressed }) => [styles.selectionAction, pressed && styles.pressed]}
          >
            <Feather
              name="heart"
              size={19}
              color={selectedItems.every((item) => item.isFavorite === 1) ? colors.destructive : colors.primary}
            />
            <Text style={[styles.selectionActionText, { color: colors.foreground }]}>
              {selectedItems.every((item) => item.isFavorite === 1) ? 'Unfavorite' : 'Favorite'}
            </Text>
          </Pressable>
          <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add selected media to an album"
            testID="add-selected-to-album"
            onPress={() => {
              library.setSelectionDraft(selectedIds);
              router.push({ pathname: '/albums/select', params: { mode: 'choose-album' } });
            }}
            style={({ pressed }) => [styles.selectionAction, pressed && styles.pressed]}
          >
            <Feather name="folder-plus" size={19} color={colors.primary} />
            <Text style={[styles.selectionActionText, { color: colors.foreground }]}>Album</Text>
          </Pressable>
          <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              selectedIds.length === 1 ? 'Share selected media' : 'Select one item to share'
            }
            disabled={selectedIds.length !== 1 || isActing}
            onPress={() => void shareSelected()}
            style={({ pressed }) => [
              styles.selectionAction,
              (pressed || selectedIds.length !== 1 || isActing) && styles.pressed,
            ]}
          >
            <Feather name="share" size={18} color={selectedIds.length === 1 ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.selectionActionText, { color: colors.foreground }]}>Share</Text>
          </Pressable>
          <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete selected original media"
            disabled={isActing}
            onPress={confirmDeleteSelected}
            style={({ pressed }) => [styles.selectionAction, pressed && styles.pressed]}
          >
            <Feather name="trash-2" size={18} color={colors.destructive} />
            <Text style={[styles.selectionActionText, { color: colors.destructive }]}>Delete</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  loadingPage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  filters: {
    minHeight: 54,
    paddingHorizontal: 18,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterPills: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectAll: { minHeight: 40, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  selectAllText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  scanCard: {
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 8,
    padding: 13,
    borderWidth: 1,
    borderRadius: 14,
  },
  scanHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  scanText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12 },
  scanCancel: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 4, marginTop: 11, borderRadius: 9, overflow: 'hidden' },
  progressValue: { height: '100%', borderRadius: 9 },
  errorCard: {
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 4,
    padding: 13,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  errorText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17 },
  retryText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  selectionBar: {
    position: 'absolute',
    left: 18,
    right: 18,
    minHeight: 62,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    elevation: 8,
  },
  selectionAction: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  selectionActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  actionDivider: { width: StyleSheet.hairlineWidth, height: 28 },
  pressed: { opacity: 0.62 },
});

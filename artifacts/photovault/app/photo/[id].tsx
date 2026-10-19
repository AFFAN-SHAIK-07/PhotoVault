import React, { useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLibrary } from '@/context/LibraryContext';
import { useColors } from '@/hooks/useColors';
import {
  formatDate,
  formatDimensions,
  formatDuration,
} from '@/lib/library-utils';

export default function PhotoScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const colors = useColors();
  const library = useLibrary();
  const [error, setError] = useState<string | null>(null);
  const media = useMemo(
    () => library.media.find((item) => item.id === id),
    [id, library.media],
  );
  const player = useVideoPlayer(
    media?.mediaType === 'video' ? media.uri : null,
  );

  const toggleFavorite = async () => {
    if (!media) return;
    setError(null);
    try {
      await library.setMediaFavorite(media.id, media.isFavorite !== 1);
    } catch (favoriteError) {
      setError(
        favoriteError instanceof Error
          ? favoriteError.message
          : 'Could not update this favorite.',
      );
    }
  };

  if (library.isLoading && !media) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!media) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Photo is not available
        </Text>
        <Text style={[styles.detail, { color: colors.mutedForeground }]}>
          It may have been removed from the device or local index.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: media.filename }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {media.mediaType === 'video' ? (
          <VideoView
            player={player}
            nativeControls
            contentFit="contain"
            style={styles.preview}
          />
        ) : (
          <Image
            source={{ uri: media.uri }}
            contentFit="contain"
            cachePolicy="memory-disk"
            style={styles.preview}
          />
        )}
        <View style={styles.details}>
          <View style={styles.titleRow}>
            <View style={styles.titleCopy}>
              <Text numberOfLines={2} style={[styles.title, { color: colors.foreground }]}>
                {media.filename}
              </Text>
              <Text style={[styles.detail, { color: colors.mutedForeground }]}>
                {formatDate(media.creationTime)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                media.isFavorite === 1
                  ? 'Remove from favorites'
                  : 'Add to favorites'
              }
              onPress={() => void toggleFavorite()}
              style={({ pressed }) => [
                styles.favoriteButton,
                { backgroundColor: colors.card, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <Feather
                name={media.isFavorite === 1 ? 'heart' : 'heart'}
                size={20}
                color={media.isFavorite === 1 ? colors.destructive : colors.foreground}
              />
            </Pressable>
          </View>
          <View style={[styles.metadataCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MetadataRow label="Type" value={media.mediaType === 'video' ? 'Video' : 'Photo'} />
            <MetadataRow label="Dimensions" value={formatDimensions(media.width, media.height)} />
            {media.mediaType === 'video' ? (
              <MetadataRow label="Duration" value={formatDuration(media.duration)} />
            ) : null}
            <MetadataRow
              label="File size"
              value={media.fileSize == null ? 'Unavailable' : formatFileSize(media.fileSize)}
            />
            <MetadataRow label="Source" value={media.sourceAlbum ?? 'Unknown'} />
          </View>
          {error ? (
            <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>
              {error}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.metadataRow}>
      <Text style={[styles.metadataLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[styles.metadataValue, { color: colors.foreground }]}>
        {value}
      </Text>
    </View>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  preview: { width: '100%', height: 420, backgroundColor: '#080a09' },
  details: { paddingHorizontal: 20, paddingTop: 18, gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleCopy: { flex: 1, gap: 5 },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 17 },
  detail: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  favoriteButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metadataCard: { paddingHorizontal: 15, borderWidth: 1, borderRadius: 15 },
  metadataRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#80808040',
  },
  metadataLabel: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  metadataValue: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12, textAlign: 'right' },
  error: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  pressed: { opacity: 0.7 },
});

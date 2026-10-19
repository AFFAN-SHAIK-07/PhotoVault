import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useColors } from '@/hooks/useColors';
import { formatDuration } from '@/lib/library-utils';
import type { MediaRecord } from '@/lib/types';

type MediaTileProps = {
  media: MediaRecord;
  width: number;
  selected?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
};

export function MediaTile({ media, width, selected = false, onPress, onLongPress }: MediaTileProps) {
  const colors = useColors();
  const [failed, setFailed] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${media.mediaType === 'video' ? 'Video' : 'Photo'} ${media.filename}`}
      accessibilityState={{ selected }}
      testID={`media-${media.id}`}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={280}
      style={({ pressed }) => [
        styles.tile,
        { width, height: width, backgroundColor: colors.muted },
        selected && { borderColor: colors.primary, borderWidth: 3 },
        pressed && styles.pressed,
      ]}
    >
      {!failed ? (
        <Image
          source={{ uri: media.uri }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={100}
          onError={() => setFailed(true)}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[styles.unavailable, { backgroundColor: colors.muted }]}>
          <Feather name="image" size={20} color={colors.mutedForeground} />
        </View>
      )}
      {media.mediaType === 'video' ? (
        <View style={[styles.videoBadge, { backgroundColor: colors.foreground }]}>
          <Feather name="play" size={10} color={colors.card} />
          <Text style={[styles.duration, { color: colors.card }]}>{formatDuration(media.duration)}</Text>
        </View>
      ) : null}
      {media.isFavorite === 1 && !selected ? (
        <View style={[styles.favoriteBadge, { backgroundColor: colors.foreground }]}>
          <Feather name="heart" size={12} color={colors.card} />
        </View>
      ) : null}
      {selected ? (
        <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
          <Feather name="check" size={13} color={colors.primaryForeground} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  unavailable: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBadge: {
    position: 'absolute',
    right: 7,
    bottom: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  duration: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
  },
  favoriteBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.76,
  },
});

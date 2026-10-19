import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { AlbumSummary } from '@/lib/types';

type AlbumCardProps = {
  album: AlbumSummary;
  width: number;
  showCover: boolean;
  reorderMode?: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
  onMove?: (direction: -1 | 1) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
};

export function AlbumCard({
  album,
  width,
  showCover,
  reorderMode = false,
  onPress,
  onToggleFavorite,
  onMove,
  canMoveUp = false,
  canMoveDown = false,
}: AlbumCardProps) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        {
          width,
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open album ${album.name}`}
        testID={`album-card-${album.id}`}
        onPress={onPress}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        <View
          style={[
            styles.cover,
            {
              backgroundColor: colors.muted,
            },
          ]}
        >
          {showCover && album.coverUri ? (
            <Image
              source={{ uri: album.coverUri }}
              resizeMode="cover"
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <Feather name="image" size={25} color={colors.mutedForeground} />
          )}
          <View style={[styles.countBadge, { backgroundColor: colors.foreground }]}>
            <Text style={[styles.countText, { color: colors.card }]}>
              {album.mediaCount.toLocaleString()}
            </Text>
          </View>
        </View>
        <View style={styles.titleBlock}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.foreground }]}>
            {album.name}
          </Text>
          {album.description ? (
            <Text numberOfLines={1} style={[styles.description, { color: colors.mutedForeground }]}>
              {album.description}
            </Text>
          ) : (
            <Text style={[styles.description, { color: colors.mutedForeground }]}>
              {album.mediaCount === 1 ? '1 photo or video' : `${album.mediaCount} photos and videos`}
            </Text>
          )}
        </View>
      </Pressable>
      <View style={[styles.actions, { borderTopColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${album.isFavorite === 1 ? 'Remove' : 'Add'} ${album.name} ${album.isFavorite === 1 ? 'from' : 'to'} favorite albums`}
          testID={`favorite-album-${album.id}`}
          onPress={onToggleFavorite}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Feather
            name={album.isFavorite === 1 ? 'star' : 'star'}
            size={16}
            color={album.isFavorite === 1 ? colors.primary : colors.mutedForeground}
          />
          <Text style={[styles.actionText, { color: colors.mutedForeground }]}>
            {album.isFavorite === 1 ? 'Saved' : 'Save'}
          </Text>
        </Pressable>
        {reorderMode && onMove ? (
          <View style={styles.reorderActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Move ${album.name} up`}
              disabled={!canMoveUp}
              onPress={onMove.bind(null, -1)}
              style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}
            >
              <Feather
                name="arrow-up"
                size={16}
                color={canMoveUp ? colors.foreground : colors.border}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Move ${album.name} down`}
              disabled={!canMoveDown}
              onPress={onMove.bind(null, 1)}
              style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}
            >
              <Feather
                name="arrow-down"
                size={16}
                color={canMoveDown ? colors.foreground : colors.border}
              />
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderWidth: 1,
  },
  cover: {
    width: '100%',
    aspectRatio: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  countBadge: {
    position: 'absolute',
    right: 9,
    bottom: 9,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 99,
  },
  countText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  titleBlock: { paddingHorizontal: 11, paddingTop: 10, paddingBottom: 9 },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  description: { marginTop: 4, fontFamily: 'Inter_400Regular', fontSize: 10 },
  actions: {
    minHeight: 40,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  action: { minHeight: 36, paddingHorizontal: 3, flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontFamily: 'Inter_500Medium', fontSize: 10 },
  reorderActions: { flexDirection: 'row', gap: 3 },
  iconAction: { width: 30, height: 32, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.58 },
});

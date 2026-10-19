import React, { useMemo } from 'react';
import { FlatList, ListRenderItemInfo, Text, useWindowDimensions, View } from 'react-native';
import { MediaTile } from '@/components/MediaTile';
import { useColors } from '@/hooks/useColors';
import type { MediaRecord } from '@/lib/types';

type MediaGridProps = {
  media: MediaRecord[];
  onPress: (media: MediaRecord) => void;
  onLongPress?: (media: MediaRecord) => void;
  selectedIds?: string[];
  emptyComponent?: React.ReactElement;
  headerComponent?: React.ReactElement;
  contentBottomPadding?: number;
};

export function MediaGrid({
  media,
  onPress,
  onLongPress,
  selectedIds = [],
  emptyComponent,
  headerComponent,
  contentBottomPadding = 112,
}: MediaGridProps) {
  const { width } = useWindowDimensions();
  const colors = useColors();
  const tileWidth = Math.floor(width / 3);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const renderItem = ({ item }: ListRenderItemInfo<MediaRecord>) => (
    <MediaTile
      media={item}
      width={tileWidth}
      selected={selected.has(item.id)}
      onPress={() => onPress(item)}
      onLongPress={onLongPress ? () => onLongPress(item) : undefined}
    />
  );

  return (
    <FlatList
      data={media}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      numColumns={3}
      extraData={selected}
      ListHeaderComponent={headerComponent}
      ListEmptyComponent={emptyComponent}
      columnWrapperStyle={media.length > 0 ? { backgroundColor: colors.background } : undefined}
      contentContainerStyle={{ paddingBottom: contentBottomPadding, flexGrow: 1 }}
      scrollEnabled={media.length > 0 || Boolean(headerComponent)}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
      initialNumToRender={24}
      maxToRenderPerBatch={30}
      windowSize={9}
      getItemLayout={(_, index) => ({
        length: tileWidth,
        offset: tileWidth * Math.floor(index / 3),
        index,
      })}
    />
  );
}

export function EmptyGrid({ title, detail }: { title: string; detail: string }) {
  const colors = useColors();
  return (
    <View
      style={{
        flex: 1,
        minHeight: 230,
        paddingHorizontal: 28,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          marginBottom: 16,
          borderRadius: 20,
          backgroundColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: 20, height: 20, borderWidth: 2, borderRadius: 6, borderColor: colors.accentForeground }} />
      </View>
      <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 16, textAlign: 'center' }}>
        {title}
      </Text>
      <Text
        style={{
          marginTop: 7,
          maxWidth: 280,
          color: colors.mutedForeground,
          fontFamily: 'Inter_400Regular',
          fontSize: 13,
          lineHeight: 20,
          textAlign: 'center',
        }}
      >
        {detail}
      </Text>
    </View>
  );
}


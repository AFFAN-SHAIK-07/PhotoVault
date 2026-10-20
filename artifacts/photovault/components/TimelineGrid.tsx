import React, { useMemo } from 'react';
import {
  FlatList,
  ListRenderItemInfo,
  RefreshControl,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { MediaTile } from '@/components/MediaTile';
import { useColors } from '@/hooks/useColors';
import { buildTimelineRows } from '@/lib/library-utils';
import type { MediaRecord, TimelineRow } from '@/lib/types';
import { EmptyGrid } from '@/components/MediaGrid';

type TimelineGridProps = {
  media: MediaRecord[];
  onPress: (media: MediaRecord) => void;
  onLongPress?: (media: MediaRecord) => void;
  selectedIds?: string[];
  refreshing?: boolean;
  onRefresh?: () => void;
  ListHeaderComponent?: React.ReactElement;
  emptyTitle?: string;
  emptyDetail?: string;
};

export function TimelineGrid({
  media,
  onPress,
  onLongPress,
  selectedIds = [],
  refreshing = false,
  onRefresh,
  ListHeaderComponent,
  emptyTitle = 'No photos yet',
  emptyDetail = 'Photos you allow will appear here, grouped by capture date.',
}: TimelineGridProps) {
  const { width } = useWindowDimensions();
  const colors = useColors();
  const columns = 4;
  const tileGap = 2;
  const tileWidth = Math.floor((width - tileGap * (columns - 1)) / columns);
  const rows = useMemo(() => buildTimelineRows(media, columns), [media]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const renderItem = ({ item }: ListRenderItemInfo<TimelineRow>) => {
    if (item.type === 'month') {
      return (
        <Text
          style={{
            marginTop: 22,
            marginBottom: 9,
            paddingHorizontal: 18,
            color: colors.foreground,
            fontFamily: 'Inter_700Bold',
            fontSize: 19,
            letterSpacing: -0.45,
          }}
        >
          {item.label}
        </Text>
      );
    }
    if (item.type === 'day') {
      return (
        <Text
          style={{
            marginTop: 8,
            marginBottom: 8,
            paddingHorizontal: 18,
            color: colors.mutedForeground,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 12,
          }}
        >
          {item.label}
        </Text>
      );
    }

    return (
      <View style={{ flexDirection: 'row', gap: tileGap }}>
        {item.items.map((asset) => (
          <MediaTile
            key={asset.id}
            media={asset}
            width={tileWidth}
            selected={selected.has(asset.id)}
            onPress={() => onPress(asset)}
            onLongPress={onLongPress ? () => onLongPress(asset) : undefined}
          />
        ))}
        {item.items.length < columns
          ? Array.from({ length: columns - item.items.length }, (_, index) => (
              <View key={`spacer-${item.key}-${index}`} style={{ width: tileWidth, height: tileWidth }} />
            ))
          : null}
      </View>
    );
  };

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.key}
      renderItem={renderItem}
      extraData={selected}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={<EmptyGrid title={emptyTitle} detail={emptyDetail} />}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
      contentContainerStyle={{ paddingBottom: 128, flexGrow: rows.length === 0 ? 1 : undefined }}
      scrollEnabled={rows.length > 0 || Boolean(ListHeaderComponent)}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
      initialNumToRender={18}
      maxToRenderPerBatch={24}
      windowSize={9}
    />
  );
}

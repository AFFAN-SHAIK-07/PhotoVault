import type { ComponentProps } from 'react';
import type { Feather } from '@expo/vector-icons';
import type { MediaRecord, SourceCategory } from './types';

export type SmartCollection = {
  id: string;
  title: string;
  icon: ComponentProps<typeof Feather>['name'];
  description: string;
  matches: (media: MediaRecord[]) => MediaRecord[];
};

function sourceMatches(
  media: MediaRecord[],
  source: SourceCategory,
): MediaRecord[] {
  return media.filter((item) => item.sourceCategory === source);
}

export const smartCollections: SmartCollection[] = [
  {
    id: 'favorites',
    title: 'Favorites',
    icon: 'heart',
    description: 'Saved by you',
    matches: (media) => media.filter((item) => item.isFavorite === 1),
  },
  {
    id: 'videos',
    title: 'Videos',
    icon: 'video',
    description: 'All local videos',
    matches: (media) => media.filter((item) => item.mediaType === 'video'),
  },
  {
    id: 'camera',
    title: 'Camera',
    icon: 'camera',
    description: 'Recognized camera folder',
    matches: (media) => sourceMatches(media, 'camera'),
  },
  {
    id: 'screenshots',
    title: 'Screenshots',
    icon: 'smartphone',
    description: 'Recognized screenshot folder',
    matches: (media) => sourceMatches(media, 'screenshots'),
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp',
    icon: 'message-circle',
    description: 'Only accessible local media',
    matches: (media) => sourceMatches(media, 'whatsapp'),
  },
  {
    id: 'snapchat',
    title: 'Snapchat',
    icon: 'camera',
    description: 'Only accessible local media',
    matches: (media) => sourceMatches(media, 'snapchat'),
  },
  {
    id: 'downloads',
    title: 'Downloads',
    icon: 'download',
    description: 'Recognized downloads folder',
    matches: (media) => sourceMatches(media, 'downloads'),
  },
  {
    id: 'recent',
    title: 'Recent captures',
    icon: 'clock',
    description: 'Captured in the last 30 days',
    matches: (media) => {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      return media.filter((item) => item.creationTime >= cutoff);
    },
  },
];

export function getSmartCollection(id: string): SmartCollection | undefined {
  if (!id.startsWith('smart-')) return undefined;
  return smartCollections.find((collection) => collection.id === id.slice(6));
}

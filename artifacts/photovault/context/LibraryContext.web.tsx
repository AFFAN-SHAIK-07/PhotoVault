import React, { createContext, useContext } from 'react';
import type { PermissionResponse } from 'expo-media-library';
import type { AlbumSummary, MediaRecord, ScanProgress } from '@/lib/types';

type LibraryContextValue = {
  permission: PermissionResponse | null;
  permissionChecking: boolean;
  media: MediaRecord[];
  albums: AlbumSummary[];
  isLoading: boolean;
  isScanning: boolean;
  scanProgress: ScanProgress | null;
  lastScannedAt: number | null;
  error: string | null;
  selectionDraft: string[];
  setSelectionDraft: (ids: string[]) => void;
  isNativeMediaAvailable: boolean;
  requestAccess: () => Promise<void>;
  refreshPermission: () => Promise<void>;
  refreshLibrary: () => Promise<void>;
  cancelScan: () => void;
  reload: () => Promise<void>;
  createAlbum: (name: string, description: string) => Promise<string>;
  updateAlbum: (id: string, name: string, description: string) => Promise<void>;
  deleteAlbum: (id: string) => Promise<void>;
  addMediaToAlbum: (albumId: string, ids: string[]) => Promise<void>;
  removeMediaFromAlbum: (albumId: string, mediaId: string) => Promise<void>;
  removeMediaFromAlbumMany: (albumId: string, mediaIds: string[]) => Promise<void>;
  setAlbumCover: (albumId: string, mediaId: string) => Promise<void>;
  toggleAlbumFavorite: (albumId: string) => Promise<void>;
  toggleMediaFavorite: (mediaId: string) => Promise<void>;
  setMediaFavorite: (mediaId: string, isFavorite: boolean) => Promise<void>;
  setMediaFavorites: (mediaIds: string[], isFavorite: boolean) => Promise<void>;
  deleteMedia: (mediaIds: string[]) => Promise<boolean>;
  moveAlbum: (albumId: string, direction: -1 | 1) => Promise<void>;
  clearIndex: () => Promise<void>;
};

const unavailable = async (): Promise<never> => {
  throw new Error('Device library actions are available in the installed Android app.');
};

const webLibrary: LibraryContextValue = {
  permission: null,
  permissionChecking: false,
  media: [],
  albums: [],
  isLoading: false,
  isScanning: false,
  scanProgress: null,
  lastScannedAt: null,
  error: null,
  selectionDraft: [],
  setSelectionDraft: () => {},
  isNativeMediaAvailable: false,
  requestAccess: unavailable,
  refreshPermission: unavailable,
  refreshLibrary: unavailable,
  cancelScan: () => {},
  reload: async () => {},
  createAlbum: unavailable,
  updateAlbum: unavailable,
  deleteAlbum: unavailable,
  addMediaToAlbum: unavailable,
  removeMediaFromAlbum: unavailable,
  removeMediaFromAlbumMany: unavailable,
  setAlbumCover: unavailable,
  toggleAlbumFavorite: unavailable,
  toggleMediaFavorite: unavailable,
  setMediaFavorite: unavailable,
  setMediaFavorites: unavailable,
  deleteMedia: unavailable,
  moveAlbum: unavailable,
  clearIndex: unavailable,
};

const LibraryContext = createContext(webLibrary);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  return <LibraryContext.Provider value={webLibrary}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryContextValue {
  return useContext(LibraryContext);
}

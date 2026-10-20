import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useSQLiteContext } from 'expo-sqlite';
import {
  addMediaToAlbum as addMediaToAlbumInDb,
  clearLocalIndex,
  createAlbum as createAlbumInDb,
  deleteAlbum as deleteAlbumInDb,
  getAlbums,
  getAllMedia,
  getScanMetadata,
  moveAlbum as moveAlbumInDb,
  removeMediaByIds,
  removeMediaNotSeenInScan,
  removeMediaFromAlbumMany as removeMediaFromAlbumManyInDb,
  removeMediaFromAlbum as removeMediaFromAlbumInDb,
  saveScanMetadata,
  setAlbumCover as setAlbumCoverInDb,
  setMediaFavorite as setMediaFavoriteInDb,
  setMediaFavorites as setMediaFavoritesInDb,
  toggleAlbumFavorite as toggleAlbumFavoriteInDb,
  toggleMediaFavorite as toggleMediaFavoriteInDb,
  updateAlbum as updateAlbumInDb,
  upsertMediaPage,
} from '@/lib/database';
import { classifySourceAlbum } from '@/lib/library-utils';
import type { AlbumSummary, MediaRecord, ScanProgress } from '@/lib/types';

type LibraryContextValue = {
  permission: MediaLibrary.PermissionResponse | null;
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

const LibraryContext = createContext<LibraryContextValue | null>(null);

function friendlyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong while reading your local library.';
}

function mimeTypeFromFilename(filename: string): string | null {
  const extension = filename.split('.').pop()?.toLocaleLowerCase();
  if (!extension || extension === filename.toLocaleLowerCase()) return null;
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'heic' || extension === 'heif') return 'image/heic';
  if (extension === 'mp4') return 'video/mp4';
  if (extension === 'mov') return 'video/quicktime';
  if (extension === 'mkv') return 'video/x-matroska';
  if (extension === 'webm') return 'video/webm';
  return null;
}

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const database = useSQLiteContext();
  const [permission, setPermission] = useState<MediaLibrary.PermissionResponse | null>(null);
  const [permissionChecking, setPermissionChecking] = useState(true);
  const [media, setMedia] = useState<MediaRecord[]>([]);
  const [albums, setAlbums] = useState<AlbumSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [lastScannedAt, setLastScannedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectionDraft, setSelectionDraft] = useState<string[]>([]);
  const syncInProgress = useRef(false);
  const cancelRequested = useRef(false);
  const lastAutoSyncAt = useRef(0);
  const permissionRef = useRef<MediaLibrary.PermissionResponse | null>(null);
  const isNativeMediaAvailable = Platform.OS !== 'web';

  const applyPermission = useCallback((next: MediaLibrary.PermissionResponse) => {
    permissionRef.current = next;
    setPermission(next);
  }, []);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextAlbums, scanMetadata] = await Promise.all([
        getAlbums(database),
        getScanMetadata(database),
      ]);
      setAlbums(nextAlbums);
      setLastScannedAt(scanMetadata.lastScannedAt);
      if (permissionRef.current?.granted) {
        setMedia(await getAllMedia(database));
      } else {
        setMedia([]);
      }
    } catch (loadError) {
      setError(friendlyError(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [database]);

  const refreshPermission = useCallback(async () => {
    if (Platform.OS === 'web') {
      setPermissionChecking(false);
      return;
    }
    setPermissionChecking(true);
    try {
      applyPermission(await MediaLibrary.getPermissionsAsync(false, ['photo', 'video']));
    } catch (permissionError) {
      setError(friendlyError(permissionError));
    } finally {
      setPermissionChecking(false);
    }
  }, [applyPermission]);

  const refreshLibrary = useCallback(async () => {
    if (Platform.OS === 'web') {
      setError('Device photo access is available in the Android app, not in this web preview.');
      return;
    }
    if (syncInProgress.current) return;

    setError(null);
    setIsScanning(true);
    setScanProgress({ processed: 0, total: 0 });
    syncInProgress.current = true;
    cancelRequested.current = false;

    try {
      let activePermission = permissionRef.current;
      if (!activePermission?.granted) {
        activePermission = await MediaLibrary.getPermissionsAsync(false, ['photo', 'video']);
        applyPermission(activePermission);
      }
      if (!activePermission.granted) {
        setError('Allow photo and video access to scan your device library.');
        return;
      }

      const scanId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
      const albumsOnDevice = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
      const albumTitles = new Map(albumsOnDevice.map((album) => [album.id, album.title]));
      let cursor: string | undefined;
      let processed = 0;
      let total = 0;
      let completed = false;

      do {
        if (cancelRequested.current) break;
        const page = await MediaLibrary.getAssetsAsync({
          first: 500,
          after: cursor,
          sortBy: [['creationTime', false]],
          mediaType: ['photo', 'video'],
        });
        total = page.totalCount;
        const indexedAt = Date.now();
        const pageRecords: MediaRecord[] = page.assets
          .filter((asset) => asset.mediaType === 'photo' || asset.mediaType === 'video')
          .map((asset) => {
            const sourceAlbum = asset.albumId ? albumTitles.get(asset.albumId) ?? null : null;
            return {
              id: asset.id,
              uri: asset.uri,
              filename: asset.filename,
              mimeType: mimeTypeFromFilename(asset.filename),
              mediaType: asset.mediaType as 'photo' | 'video',
              fileSize: null,
              width: asset.width,
              height: asset.height,
              duration: asset.duration,
              creationTime: asset.creationTime || asset.modificationTime || indexedAt,
              dateAdded: asset.modificationTime || indexedAt,
              modificationTime: asset.modificationTime || 0,
              sourceAlbum,
              sourceCategory: classifySourceAlbum(sourceAlbum),
              isFavorite: 0,
            };
          });

        await upsertMediaPage(database, pageRecords, scanId);
        processed += pageRecords.length;
        setScanProgress({ processed, total });
        cursor = page.endCursor;
        completed = !page.hasNextPage || !cursor;
        if (!completed && !cancelRequested.current) {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
      } while (!completed && !cancelRequested.current);

      if (completed && !cancelRequested.current) {
        await removeMediaNotSeenInScan(database, scanId);
        await saveScanMetadata(database, processed, Date.now());
        lastAutoSyncAt.current = Date.now();
      }
      await reload();
    } catch (scanError) {
      setError(friendlyError(scanError));
      await reload();
    } finally {
      syncInProgress.current = false;
      setIsScanning(false);
      setScanProgress(null);
    }
  }, [applyPermission, database, reload]);

  const requestAccess = useCallback(async () => {
    if (Platform.OS === 'web') {
      setError('Install PhotoVault on an Android device to grant access to its photo library.');
      return;
    }
    setError(null);
    setPermissionChecking(true);
    try {
      const next = await MediaLibrary.requestPermissionsAsync(false, ['photo', 'video']);
      applyPermission(next);
      if (next.granted) await refreshLibrary();
    } catch (permissionError) {
      setError(friendlyError(permissionError));
    } finally {
      setPermissionChecking(false);
    }
  }, [applyPermission, refreshLibrary]);

  const cancelScan = useCallback(() => {
    cancelRequested.current = true;
  }, []);

  useEffect(() => {
    let mounted = true;
    const initialize = async () => {
      if (Platform.OS === 'web') {
        setPermissionChecking(false);
        setIsLoading(false);
        return;
      }
      try {
        let current = await MediaLibrary.getPermissionsAsync(false, ['photo', 'video']);
        if (!mounted) return;
        if (current.status === 'undetermined') {
          current = await MediaLibrary.requestPermissionsAsync(false, ['photo', 'video']);
          if (!mounted) return;
        }
        applyPermission(current);
        setPermissionChecking(false);
        if (current.granted) {
          await refreshLibrary();
        } else {
          await reload();
        }
      } catch (initializationError) {
        if (!mounted) return;
        setError(friendlyError(initializationError));
        setPermissionChecking(false);
        await reload();
      }
    };
    void initialize();
    return () => {
      mounted = false;
    };
  }, [applyPermission, refreshLibrary, reload]);

  useEffect(() => {
    if (!permission?.granted || Platform.OS === 'web') return;
    const subscription = MediaLibrary.addListener(() => {
      void refreshLibrary();
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || Date.now() - lastAutoSyncAt.current < 45_000) return;
      void (async () => {
        const current = await MediaLibrary.getPermissionsAsync(false, ['photo', 'video']);
        applyPermission(current);
        if (current.granted) await refreshLibrary();
        else await reload();
      })();
    });
    return () => {
      subscription.remove();
      appStateSubscription.remove();
    };
  }, [applyPermission, permission?.granted, refreshLibrary, reload]);

  const createAlbum = useCallback(
    async (name: string, description: string) => {
      const id = await createAlbumInDb(database, name, description);
      await reload();
      return id;
    },
    [database, reload],
  );

  const updateAlbum = useCallback(
    async (id: string, name: string, description: string) => {
      await updateAlbumInDb(database, id, name, description);
      await reload();
    },
    [database, reload],
  );

  const deleteAlbum = useCallback(
    async (id: string) => {
      await deleteAlbumInDb(database, id);
      await reload();
    },
    [database, reload],
  );

  const addToAlbum = useCallback(
    async (albumId: string, ids: string[]) => {
      await addMediaToAlbumInDb(database, albumId, ids);
      await reload();
    },
    [database, reload],
  );

  const removeFromAlbum = useCallback(
    async (albumId: string, mediaId: string) => {
      await removeMediaFromAlbumInDb(database, albumId, mediaId);
      await reload();
    },
    [database, reload],
  );

  const removeManyFromAlbum = useCallback(
    async (albumId: string, mediaIds: string[]) => {
      await removeMediaFromAlbumManyInDb(database, albumId, mediaIds);
      await reload();
    },
    [database, reload],
  );

  const setCover = useCallback(
    async (albumId: string, mediaId: string) => {
      await setAlbumCoverInDb(database, albumId, mediaId);
      await reload();
    },
    [database, reload],
  );

  const favoriteAlbum = useCallback(
    async (albumId: string) => {
      await toggleAlbumFavoriteInDb(database, albumId);
      await reload();
    },
    [database, reload],
  );

  const favoriteMedia = useCallback(
    async (mediaId: string) => {
      await toggleMediaFavoriteInDb(database, mediaId);
      await reload();
    },
    [database, reload],
  );

  const setFavoriteMedia = useCallback(
    async (mediaId: string, isFavorite: boolean) => {
      await setMediaFavoriteInDb(database, mediaId, isFavorite);
      await reload();
    },
    [database, reload],
  );

  const setFavoriteMediaMany = useCallback(
    async (mediaIds: string[], isFavorite: boolean) => {
      await setMediaFavoritesInDb(database, mediaIds, isFavorite);
      await reload();
    },
    [database, reload],
  );

  const deleteMedia = useCallback(
    async (mediaIds: string[]) => {
      if (Platform.OS === 'web') {
        throw new Error('Deleting device media is only available in the Android app.');
      }
      const assets = mediaIds.map((id) => {
        const item = media.find((candidate) => candidate.id === id);
        if (!item) throw new Error('One or more selected items are no longer indexed.');
        return item.id;
      });
      if (assets.length === 0) return false;

      const deleted = await MediaLibrary.deleteAssetsAsync(assets);
      if (!deleted) return false;

      await removeMediaByIds(database, assets);
      await reload();
      return true;
    },
    [database, media, reload],
  );

  const reorderAlbum = useCallback(
    async (albumId: string, direction: -1 | 1) => {
      await moveAlbumInDb(database, albumId, direction);
      await reload();
    },
    [database, reload],
  );

  const clearIndex = useCallback(async () => {
    await clearLocalIndex(database);
    await reload();
  }, [database, reload]);

  const value = useMemo<LibraryContextValue>(
    () => ({
      permission,
      permissionChecking,
      media,
      albums,
      isLoading,
      isScanning,
      scanProgress,
      lastScannedAt,
      error,
      selectionDraft,
      setSelectionDraft,
      isNativeMediaAvailable,
      requestAccess,
      refreshPermission,
      refreshLibrary,
      cancelScan,
      reload,
      createAlbum,
      updateAlbum,
      deleteAlbum,
      addMediaToAlbum: addToAlbum,
      removeMediaFromAlbum: removeFromAlbum,
      removeMediaFromAlbumMany: removeManyFromAlbum,
      setAlbumCover: setCover,
      toggleAlbumFavorite: favoriteAlbum,
      toggleMediaFavorite: favoriteMedia,
      setMediaFavorite: setFavoriteMedia,
      setMediaFavorites: setFavoriteMediaMany,
      deleteMedia,
      moveAlbum: reorderAlbum,
      clearIndex,
    }),
    [
      permission,
      permissionChecking,
      media,
      albums,
      isLoading,
      isScanning,
      scanProgress,
      lastScannedAt,
      error,
      selectionDraft,
      isNativeMediaAvailable,
      requestAccess,
      refreshPermission,
      refreshLibrary,
      cancelScan,
      reload,
      createAlbum,
      updateAlbum,
      deleteAlbum,
      addToAlbum,
      removeFromAlbum,
      removeManyFromAlbum,
      setCover,
      favoriteAlbum,
      favoriteMedia,
      setFavoriteMedia,
      setFavoriteMediaMany,
      deleteMedia,
      reorderAlbum,
      clearIndex,
    ],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryContextValue {
  const value = useContext(LibraryContext);
  if (!value) throw new Error('useLibrary must be used inside LibraryProvider.');
  return value;
}

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useLibrary } from '@/context/LibraryContext';
import { useColors } from '@/hooks/useColors';
import {
  deleteFaceAnalysisData,
  getFaceAnalysisSettings,
  getFaceScans,
  getPeople,
  getPersonFaces,
  renamePerson,
  saveFaceScan,
  setFaceAnalysisSettings,
} from '@/lib/database';
import { analyzePhoto, MODEL_VERSION } from '@/lib/ai/face-analysis';
import { bestMatchingPerson, type FaceCluster } from '@/lib/face-utils';
import type {
  FaceAnalysisSettings,
  MediaRecord,
  PersonFaceRecord,
  PersonSummary,
} from '@/lib/types';

const EMPTY_SETTINGS: FaceAnalysisSettings = { consented: false, paused: true };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Face grouping could not be completed.';
}

function createPersonId(): string {
  return `person-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeClusters(records: PersonFaceRecord[]): FaceCluster[] {
  const clusters = new Map<string, FaceCluster>();
  for (const record of records) {
    const cluster = clusters.get(record.personId) ?? {
      id: record.personId,
      embeddings: [],
      centroid: new Array<number>(record.embedding.length).fill(0),
    };
    const previousCount = cluster.embeddings.length;
    cluster.embeddings.push(record.embedding);
    record.embedding.forEach((value, index) => {
      cluster.centroid![index] =
        (cluster.centroid![index] * previousCount + value) / (previousCount + 1);
    });
    clusters.set(record.personId, cluster);
  }
  return [...clusters.values()];
}

function addClusterEmbedding(cluster: FaceCluster, embedding: number[]): void {
  if (!cluster.centroid || cluster.centroid.length !== embedding.length) {
    throw new Error('Stored face embeddings use incompatible model versions.');
  }
  const previousCount = cluster.embeddings.length;
  embedding.forEach((value, index) => {
    cluster.centroid![index] =
      (cluster.centroid![index] * previousCount + value) / (previousCount + 1);
  });
  cluster.embeddings.push(embedding);
}

function PhotoTile({ media }: { media: MediaRecord }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${media.filename}`}
      onPress={() => router.push({ pathname: '/photo/[id]', params: { id: media.id } })}
      style={({ pressed }) => [styles.photoTile, pressed && styles.pressed]}
    >
      <Image
        source={{ uri: media.uri }}
        contentFit="cover"
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.muted }]}
        transition={120}
      />
    </Pressable>
  );
}

function PersonCard({
  person,
  selected,
  onToggle,
  onRename,
  onOpenMedia,
  media,
  width,
}: {
  person: PersonSummary;
  selected: boolean;
  onToggle: () => void;
  onRename: (name: string) => Promise<void>;
  onOpenMedia: (personId: string) => Promise<void>;
  media: MediaRecord[];
  width: number;
}) {
  const colors = useColors();
  const [nameDraft, setNameDraft] = useState(person.name);
  const [isSaving, setIsSaving] = useState(false);
  const cardWidth = Math.floor((width - 48) / 3);

  const saveName = async () => {
    const name = nameDraft.trim();
    if (!name || name === person.name) return;
    setIsSaving(true);
    try {
      await onRename(name);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.personCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: selected }}
        accessibilityLabel={`${person.name}, ${person.faceCount} photos`}
        onPress={() => {
          onToggle();
          if (!selected) void onOpenMedia(person.id);
        }}
        style={({ pressed }) => [styles.personSummary, pressed && styles.pressed]}
      >
        <View style={[styles.personCover, { backgroundColor: colors.muted }]}>
          {person.coverUri ? (
            <Image source={{ uri: person.coverUri }} contentFit="cover" style={StyleSheet.absoluteFill} />
          ) : (
            <Feather name="user" size={25} color={colors.mutedForeground} />
          )}
        </View>
        <View style={styles.personCopy}>
          <Text numberOfLines={1} style={[styles.personName, { color: colors.foreground }]}>
            {person.name}
          </Text>
          <Text style={[styles.personCount, { color: colors.mutedForeground }]}>
            {person.faceCount} {person.faceCount === 1 ? 'photo' : 'photos'}
          </Text>
        </View>
        <Feather name={selected ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
      </Pressable>
      {selected ? (
        <View style={styles.personDetails}>
          <View style={styles.renameRow}>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              accessibilityLabel={`Name for ${person.name}`}
              placeholder="Name this person"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.nameInput,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
              ]}
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={() => void saveName()}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Save name for ${person.name}`}
              disabled={isSaving || !nameDraft.trim()}
              onPress={() => void saveName()}
              style={({ pressed }) => [
                styles.saveNameButton,
                { backgroundColor: colors.foreground },
                (isSaving || !nameDraft.trim()) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <Feather name="check" size={16} color={colors.background} />
              )}
            </Pressable>
          </View>
          {media.length ? (
            <View style={styles.photoGrid}>
              {media.map((item) => (
                <View key={item.id} style={{ width: cardWidth, height: cardWidth }}>
                  <PhotoTile media={item} />
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.personCount, { color: colors.mutedForeground }]}>
              These photos are not currently available in the device library.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

export default function PeopleScreen() {
  const colors = useColors();
  const database = useSQLiteContext();
  const library = useLibrary();
  const { width } = useWindowDimensions();
  const cancelRequested = useRef(false);
  const [settings, setSettings] = useState<FaceAnalysisSettings>(EMPTY_SETTINGS);
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [personFaces, setPersonFaces] = useState<PersonFaceRecord[]>([]);
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextSettings, nextPeople] = await Promise.all([
        getFaceAnalysisSettings(database),
        getPeople(database),
      ]);
      setSettings(nextSettings);
      setPeople(nextPeople);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [database]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        cancelRequested.current = true;
      };
    }, [refresh]),
  );

  const photos = useMemo(
    () => library.media.filter((item) => item.mediaType === 'photo'),
    [library.media],
  );
  const visiblePersonPhotos = useMemo(() => {
    const mediaById = new Map(photos.map((item) => [item.id, item]));
    const uniqueMediaIds = new Set<string>();
    return personFaces.flatMap((face) => {
      const item = mediaById.get(face.mediaId);
      if (!item || uniqueMediaIds.has(item.id)) return [];
      uniqueMediaIds.add(item.id);
      return [item];
    });
  }, [personFaces, photos]);

  const loadPersonPhotos = useCallback(
    async (personId: string) => {
      try {
        setPersonFaces(await getPersonFaces(database, personId));
      } catch (loadError) {
        setError(errorMessage(loadError));
      }
    },
    [database],
  );

  const rename = useCallback(
    async (personId: string, name: string) => {
      try {
        await renamePerson(database, personId, name);
        await refresh();
      } catch (renameError) {
        setError(errorMessage(renameError));
      }
    },
    [database, refresh],
  );

  const scanLibrary = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setError('On-device face grouping is currently available in the Android app only.');
      return;
    }
    if (!library.permission?.granted) {
      await library.requestAccess();
      return;
    }
    if (isScanning) return;

    cancelRequested.current = false;
    setIsScanning(true);
    setError(null);
    setScanNotice(null);
    setProgress({ processed: 0, total: photos.length });
    const failures: string[] = [];
    let ignoredFaces = 0;

    try {
      const currentSettings = await getFaceAnalysisSettings(database);
      if (!currentSettings.consented || currentSettings.paused) {
        throw new Error('Enable face grouping and keep it unpaused before starting a scan.');
      }
      const [faceScans, initialFaceRecords] = await Promise.all([
        getFaceScans(database),
        getPersonFaces(database),
      ]);
      const scanByMediaId = new Map(faceScans.map((item) => [item.mediaId, item]));
      const photosToRebuild = new Set(
        photos
          .filter((photo) => {
            const previousScan = scanByMediaId.get(photo.id);
            return (
              previousScan?.modificationTime !== photo.modificationTime ||
              previousScan.modelVersion !== MODEL_VERSION
            );
          })
          .map((photo) => photo.id),
      );
      let clusters = makeClusters(
        initialFaceRecords.filter((record) => !photosToRebuild.has(record.mediaId)),
      );
      const personNameById = new Map(people.map((person) => [person.id, person.name]));
      let processed = 0;

      for (const photo of photos) {
        if (cancelRequested.current) break;
        const previousScan = scanByMediaId.get(photo.id);
        if (
          previousScan?.modificationTime === photo.modificationTime &&
          previousScan.modelVersion === MODEL_VERSION
        ) {
          processed += 1;
          setProgress({ processed, total: photos.length });
          continue;
        }

        try {
          const result = await analyzePhoto(photo.uri);
          if (cancelRequested.current) break;
          ignoredFaces += result.ignoredFaces;
          const facesToSave: Array<PersonFaceRecord & { personName: string }> = [];

          for (const [faceIndex, embedding] of result.embeddings.entries()) {
            let personId = bestMatchingPerson(embedding, clusters);
            let personName: string;
            if (!personId) {
              personId = createPersonId();
              personName = `Person ${clusters.length + 1}`;
              personNameById.set(personId, personName);
              clusters.push({
                id: personId,
                embeddings: [],
                centroid: new Array<number>(embedding.length).fill(0),
              });
            } else {
              personName = personNameById.get(personId) ?? `Person ${clusters.length + 1}`;
            }
            facesToSave.push({
              id: `${photo.id}#${faceIndex}`,
              mediaId: photo.id,
              personId,
              embedding,
              personName,
            });
            const cluster = clusters.find((item) => item.id === personId);
            if (cluster) addClusterEmbedding(cluster, embedding);
          }
          await saveFaceScan(
            database,
            photo.id,
            photo.modificationTime,
            MODEL_VERSION,
            facesToSave,
          );
        } catch (photoError) {
          failures.push(`${photo.filename}: ${errorMessage(photoError)}`);
        }
        processed += 1;
        setProgress({ processed, total: photos.length });
      }

      if (failures.length) {
        const firstFailure = failures[0];
        setError(
          `${failures.length} ${failures.length === 1 ? 'photo could not' : 'photos could not'} be analyzed. ${firstFailure}`,
        );
      }
      const wasCancelled = cancelRequested.current;
      if (wasCancelled) {
        setScanNotice('Scan stopped. You can continue later; completed photos stay grouped on this phone.');
      } else {
        setScanNotice(
          `Checked ${processed.toLocaleString()} photos. ${ignoredFaces ? `${ignoredFaces} face${ignoredFaces === 1 ? ' was' : 's were'} skipped because landmarks were incomplete.` : ''}`,
        );
      }
    } catch (scanError) {
      setError(errorMessage(scanError));
    } finally {
      setIsScanning(false);
      await refresh();
    }
  }, [database, isScanning, library.permission?.granted, library.requestAccess, photos, refresh]);

  const askConsentAndScan = () => {
    if (settings.consented) {
      if (settings.paused) {
        void setFaceAnalysisSettings(database, { ...settings, paused: false })
          .then(() => refresh())
          .then(() => scanLibrary());
      } else {
        void scanLibrary();
      }
      return;
    }
    Alert.alert(
      'Group faces on this phone?',
      'PhotoVault will analyze accessible photos on this device to group similar faces. Face embeddings are sensitive biometric data and stay in this app’s local database. Nothing is uploaded. You can pause analysis or delete all face data at any time.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Agree and start',
          onPress: () => {
            void setFaceAnalysisSettings(database, { consented: true, paused: false })
              .then(() => refresh())
              .then(() => scanLibrary())
              .catch((consentError: unknown) => setError(errorMessage(consentError)));
          },
        },
      ],
    );
  };

  const pauseAnalysis = async () => {
    cancelRequested.current = true;
    try {
      await setFaceAnalysisSettings(database, { ...settings, paused: true });
      await refresh();
      if (!isScanning) setScanNotice('Face analysis is paused. Stored groups remain on this phone.');
    } catch (pauseError) {
      setError(errorMessage(pauseError));
    }
  };

  const clearFaceData = () => {
    if (isScanning) return;
    Alert.alert(
      'Delete face data?',
      'This removes all local face embeddings and People groups. Your original photos will not be changed.',
      [
        { text: 'Keep data', style: 'cancel' },
        {
          text: 'Delete face data',
          style: 'destructive',
          onPress: () => {
            void deleteFaceAnalysisData(database)
              .then(() => {
                setPersonFaces([]);
                setExpandedPersonId(null);
                setScanNotice('All face embeddings and People groups were deleted from this phone.');
                return refresh();
              })
              .catch((deleteError: unknown) => setError(errorMessage(deleteError)));
          },
        },
      ],
    );
  };

  const requestAccessOrScan = () => {
    if (Platform.OS !== 'android') {
      setError('On-device face grouping is currently available in the Android app only.');
      return;
    }
    if (isScanning) {
      cancelRequested.current = true;
      return;
    }
    askConsentAndScan();
  };

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <ScreenHeader title="People" subtitle="Face groups on this phone" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.privacyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.privacyIcon, { backgroundColor: colors.muted }]}>
            <Feather name="smartphone" size={18} color={colors.foreground} />
          </View>
          <Text style={[styles.privacyTitle, { color: colors.foreground }]}>
            Private, on-device grouping
          </Text>
          <Text style={[styles.privacyText, { color: colors.mutedForeground }]}>
            Accessible photos are analyzed on this phone. Face embeddings stay in local storage and
            are never uploaded. Face grouping works in the installed Android app, not this web preview.
          </Text>
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isScanning ? 'Stop face grouping' : 'Start face grouping'}
              testID="people-scan-button"
              onPress={requestAccessOrScan}
              disabled={isLoading || (photos.length === 0 && library.permission?.granted === true)}
              style={({ pressed }) => [
                styles.primaryAction,
                { backgroundColor: colors.foreground },
                (isLoading || (photos.length === 0 && library.permission?.granted === true)) &&
                  styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              {isScanning ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <Feather name="users" size={16} color={colors.background} />
              )}
              <Text style={[styles.primaryActionText, { color: colors.background }]}>
                {isScanning
                  ? 'Stop scan'
                  : library.permission?.granted
                    ? settings.consented
                      ? 'Scan new photos'
                      : 'Enable face grouping'
                    : 'Allow photo access'}
              </Text>
            </Pressable>
            {settings.consented ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void pauseAnalysis()}
                style={({ pressed }) => [
                  styles.secondaryAction,
                  { borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.secondaryActionText, { color: colors.foreground }]}>
                  {settings.paused ? 'Resume' : 'Pause'}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {isScanning ? (
            <View style={styles.progressArea}>
              <View
                style={[styles.progressTrack, { backgroundColor: colors.muted }]}
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: progress.total, now: progress.processed }}
              >
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: colors.foreground },
                    { width: `${progress.total ? Math.round((progress.processed / progress.total) * 100) : 0}%` },
                  ]}
                />
              </View>
              <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
                {progress.processed.toLocaleString()} of {progress.total.toLocaleString()} photos
              </Text>
            </View>
          ) : null}
          {error ? (
            <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>
              {error}
            </Text>
          ) : null}
          {scanNotice ? (
            <Text style={[styles.scanNotice, { color: colors.mutedForeground }]}>{scanNotice}</Text>
          ) : null}
          {settings.consented ? (
            <Pressable
              accessibilityRole="button"
              disabled={isScanning}
              onPress={clearFaceData}
              style={({ pressed }) => [styles.deleteButton, isScanning && styles.disabled, pressed && styles.pressed]}
            >
              <Feather name="trash-2" size={14} color={colors.destructive} />
              <Text style={[styles.deleteText, { color: colors.destructive }]}>
                Delete face data
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.groupsHeader}>
          <View>
            <Text style={[styles.groupsTitle, { color: colors.foreground }]}>People</Text>
            <Text style={[styles.groupsSubtitle, { color: colors.mutedForeground }]}>
              {people.length} {people.length === 1 ? 'group' : 'groups'} · {photos.length.toLocaleString()} accessible photos
            </Text>
          </View>
        </View>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : people.length ? (
          people.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              selected={expandedPersonId === person.id}
              onToggle={() =>
                setExpandedPersonId((current) => (current === person.id ? null : person.id))
              }
              onRename={(name) => rename(person.id, name)}
              onOpenMedia={loadPersonPhotos}
              media={expandedPersonId === person.id ? visiblePersonPhotos : []}
              width={width}
            />
          ))
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="users" size={22} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No People groups yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Enable face grouping to find photos with the same person. You can stop the scan at any time.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 110 },
  privacyCard: { padding: 18, borderWidth: 1, borderRadius: 22, marginTop: 12 },
  privacyIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
  },
  privacyTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.3 },
  privacyText: { marginTop: 7, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  actionRow: { flexDirection: 'row', gap: 9, marginTop: 16 },
  primaryAction: {
    minHeight: 46,
    paddingHorizontal: 15,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  secondaryAction: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  progressArea: { marginTop: 15, gap: 7 },
  progressTrack: { height: 5, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 99 },
  progressText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  error: { marginTop: 13, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18 },
  scanNotice: { marginTop: 11, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17 },
  deleteButton: {
    alignSelf: 'flex-start',
    minHeight: 38,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  deleteText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  groupsHeader: { marginTop: 27, marginBottom: 12 },
  groupsTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.5 },
  groupsSubtitle: { marginTop: 4, fontFamily: 'Inter_400Regular', fontSize: 11 },
  personCard: { marginBottom: 11, borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  personSummary: { minHeight: 78, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 11 },
  personCover: {
    width: 54,
    height: 54,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personCopy: { flex: 1, gap: 4 },
  personName: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  personCount: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17 },
  personDetails: { paddingHorizontal: 11, paddingBottom: 11, gap: 10 },
  renameRow: { flexDirection: 'row', gap: 8 },
  nameInput: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  saveNameButton: { width: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  photoTile: { flex: 1, height: '100%', overflow: 'hidden', borderRadius: 8 },
  emptyCard: {
    minHeight: 170,
    padding: 22,
    borderWidth: 1,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { marginTop: 12, fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  emptyText: { maxWidth: 260, marginTop: 7, textAlign: 'center', fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  loading: { marginTop: 30 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
});

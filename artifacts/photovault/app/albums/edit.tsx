import React from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AlbumEditorForm } from '@/components/AlbumEditorForm';
import { useLibrary } from '@/context/LibraryContext';
import { useColors } from '@/hooks/useColors';

export default function EditAlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const albumId = Array.isArray(id) ? id[0] : id;
  const library = useLibrary();
  const colors = useColors();
  const album = library.albums.find((item) => item.id === albumId);

  if (!album) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>Album not found</Text>
      </View>
    );
  }

  return (
    <AlbumEditorForm
      key={album.id}
      title="Edit album"
      submitLabel="Save changes"
      initialName={album.name}
      initialDescription={album.description}
      onCancel={() => router.back()}
      onSave={async (name, description) => {
        await library.updateAlbum(album.id, name, description);
        router.back();
      }}
    />
  );
}

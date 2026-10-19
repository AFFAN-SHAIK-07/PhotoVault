import React from 'react';
import { router } from 'expo-router';
import { AlbumEditorForm } from '@/components/AlbumEditorForm';
import { useLibrary } from '@/context/LibraryContext';

export default function NewAlbumScreen() {
  const library = useLibrary();
  return (
    <AlbumEditorForm
      title="New album"
      submitLabel="Create album"
      onCancel={() => router.back()}
      onSave={async (name, description) => {
        await library.createAlbum(name, description);
        router.back();
      }}
    />
  );
}

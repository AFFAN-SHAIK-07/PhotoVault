import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useColors } from '@/hooks/useColors';

type AlbumEditorFormProps = {
  title: string;
  submitLabel: string;
  initialName?: string;
  initialDescription?: string;
  onSave: (name: string, description: string) => Promise<void>;
  onCancel: () => void;
};

export function AlbumEditorForm({
  title,
  submitLabel,
  initialName = '',
  initialDescription = '',
  onSave,
  onCancel,
}: AlbumEditorFormProps) {
  const colors = useColors();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Give this album a name first.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(trimmedName, description.trim());
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : '';
      setError(
        message.toLocaleLowerCase().includes('unique')
          ? 'An album with that name already exists.'
          : 'The album could not be saved. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <ScreenHeader title={title} actionIcon="x" actionLabel="Close" onAction={onCancel} />
      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={styles.content}
        bottomOffset={72}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.introIcon, { backgroundColor: colors.accent }]}>
          <Text style={{ color: colors.accentForeground, fontSize: 24 }}>+</Text>
        </View>
        <Text style={[styles.heading, { color: colors.foreground }]}>
          {initialName ? 'Edit your collection' : 'A collection for your moments'}
        </Text>
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          Albums organize references to your original files. They never copy, move, or delete them.
        </Text>

        <Text style={[styles.label, { color: colors.foreground }]}>Album name</Text>
        <TextInput
          value={name}
          onChangeText={(value) => {
            setName(value);
            if (error) setError(null);
          }}
          placeholder="Weekend away"
          placeholderTextColor={colors.mutedForeground}
          maxLength={50}
          autoFocus={!initialName}
          accessibilityLabel="Album name"
          testID="album-name"
          returnKeyType="next"
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
        />
        <Text style={[styles.label, { color: colors.foreground }]}>Description <Text style={{ color: colors.mutedForeground }}>(optional)</Text></Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Add a note about this album"
          placeholderTextColor={colors.mutedForeground}
          maxLength={160}
          multiline
          textAlignVertical="top"
          accessibilityLabel="Album description"
          testID="album-description"
          style={[
            styles.input,
            styles.descriptionInput,
            { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground },
          ]}
        />
        {error ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>
            {error}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={submitLabel}
          testID="save-album"
          disabled={saving}
          onPress={() => void submit()}
          style={({ pressed }) => [
            styles.submit,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
            saving && styles.disabled,
          ]}
        >
          <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
            {saving ? 'Saving…' : submitLabel}
          </Text>
        </Pressable>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 22, paddingBottom: 40 },
  introIcon: { width: 48, height: 48, marginTop: 10, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heading: { marginTop: 20, fontFamily: 'Inter_700Bold', fontSize: 23, letterSpacing: -0.65 },
  intro: { marginTop: 8, marginBottom: 25, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 },
  label: { marginBottom: 7, marginTop: 15, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  input: { minHeight: 49, paddingHorizontal: 13, borderWidth: 1, borderRadius: 13, fontFamily: 'Inter_400Regular', fontSize: 14 },
  descriptionInput: { minHeight: 96, paddingTop: 13 },
  error: { marginTop: 12, fontFamily: 'Inter_500Medium', fontSize: 12 },
  submit: { minHeight: 52, marginTop: 24, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.54 },
});

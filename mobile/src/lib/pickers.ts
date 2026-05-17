import { Alert, Platform } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'

export interface PickedFile {
  uri: string
  name: string
  size?: number | null
  mimeType?: string | null
}

interface PickOptions {
  /** If true, restrict the picker to images only (useful for passport/selfie). */
  imagesOnly?: boolean
}

/**
 * Cross-source file picker with an iOS-style action sheet: camera, photo
 * library, or files. Centralizes permission handling for callers.
 */
export async function pickFile(opts: PickOptions = {}): Promise<PickedFile | null> {
  const choice = await chooseSource(opts.imagesOnly ?? false)
  if (!choice) return null

  if (choice === 'camera') {
    return takePhoto()
  }
  if (choice === 'library') {
    return pickFromLibrary()
  }
  return pickFromFiles(opts.imagesOnly ?? false)
}

function chooseSource(imagesOnly: boolean): Promise<'camera' | 'library' | 'files' | null> {
  return new Promise((resolve) => {
    const buttons: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'default' }> = [
      { text: 'Take Photo', onPress: () => resolve('camera') },
      { text: 'Choose from Photos', onPress: () => resolve('library') },
    ]
    if (!imagesOnly) {
      buttons.push({ text: 'Choose File', onPress: () => resolve('files') })
    }
    buttons.push({ text: 'Cancel', style: 'cancel', onPress: () => resolve(null) })

    Alert.alert('Upload from', undefined, buttons, { cancelable: true, onDismiss: () => resolve(null) })
  })
}

async function takePhoto(): Promise<PickedFile | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync()
  if (!perm.granted) {
    Alert.alert(
      'Camera permission needed',
      'Allow camera access in Settings to capture documents directly.',
    )
    return null
  }
  const result = await ImagePicker.launchCameraAsync({
    quality: 0.85,
    base64: false,
    allowsEditing: false,
  })
  if (result.canceled) return null
  const a = result.assets?.[0]
  if (!a?.uri) return null
  return {
    uri: a.uri,
    name: a.fileName ?? `photo_${Date.now()}.jpg`,
    size: a.fileSize ?? null,
    mimeType: a.mimeType ?? 'image/jpeg',
  }
}

async function pickFromLibrary(): Promise<PickedFile | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) {
    Alert.alert(
      'Photos permission needed',
      'Allow photo library access in Settings to upload existing pictures.',
    )
    return null
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.85,
    allowsMultipleSelection: false,
  })
  if (result.canceled) return null
  const a = result.assets?.[0]
  if (!a?.uri) return null
  return {
    uri: a.uri,
    name: a.fileName ?? `image_${Date.now()}.jpg`,
    size: a.fileSize ?? null,
    mimeType: a.mimeType ?? (Platform.OS === 'ios' ? 'image/jpeg' : 'image/jpeg'),
  }
}

async function pickFromFiles(imagesOnly: boolean): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: imagesOnly ? 'image/*' : '*/*',
  })
  if (result.canceled) return null
  const f = result.assets?.[0]
  if (!f?.uri) return null
  return {
    uri: f.uri,
    name: f.name ?? `file_${Date.now()}`,
    size: f.size ?? null,
    mimeType: f.mimeType ?? null,
  }
}

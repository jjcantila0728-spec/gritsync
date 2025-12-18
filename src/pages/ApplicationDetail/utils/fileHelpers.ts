import { getSignedFileUrl, getFileUrl } from '@/lib/api'

// Async function to get signed URL for private files
export const getSignedUrlFromPath = async (path: string | null | undefined): Promise<string> => {
  if (!path || path.trim() === '') return ''
  try {
    // If path already contains http, return as is (legacy URLs)
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path
    }
    // For Supabase Storage private files, get signed URL
    return await getSignedFileUrl(path, 3600) // 1 hour expiry
  } catch (error) {
    console.error('Error getting signed URL:', error)
    // Fallback to public URL
    return getFileUrl(path)
  }
}








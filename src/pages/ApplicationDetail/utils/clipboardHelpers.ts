export const copyToClipboard = async (text: string | null | undefined, label: string = 'text', showToast?: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void) => {
  const textToCopy = text ?? ''
  try {
    await navigator.clipboard.writeText(textToCopy)
    if (showToast) {
      showToast(`${label} copied to clipboard!`, 'success')
    }
  } catch (error) {
    if (showToast) {
      showToast('Failed to copy to clipboard', 'error')
    }
  }
}








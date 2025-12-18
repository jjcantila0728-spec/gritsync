export const copyToClipboard = async (text: string, label: string = 'text', showToast?: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void) => {
  try {
    await navigator.clipboard.writeText(text)
    if (showToast) {
      showToast(`${label} copied to clipboard!`, 'success')
    }
  } catch (error) {
    if (showToast) {
      showToast('Failed to copy to clipboard', 'error')
    }
  }
}








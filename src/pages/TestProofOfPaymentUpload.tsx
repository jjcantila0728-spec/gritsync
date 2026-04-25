import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { db } from '@/lib/api-client'
import { Upload, Download, CheckCircle, XCircle, AlertCircle, FileText } from 'lucide-react'

export function TestProofOfPaymentUpload() {
  const { showToast } = useToast()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Array<{ step: string; status: 'success' | 'error' | 'warning'; message: string }>>([])
  const [testing, setTesting] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

  function addTestResult(step: string, status: 'success' | 'error' | 'warning', message: string) {
    setTestResults(prev => [...prev, { step, status, message }])
    console.log(`[TEST] ${step}: ${status} - ${message}`)
  }

  function clearResults() {
    setTestResults([])
    setUploadedFilePath(null)
    setDownloadUrl(null)
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    clearResults()
    setSelectedFile(file)

    // Test 1: Basic file properties
    addTestResult('File Selection', 'success', `Selected: ${file.name}`)
    addTestResult('File Size', file.size > 0 ? 'success' : 'error', `Size: ${(file.size / 1024).toFixed(2)} KB`)
    addTestResult('File Type', file.type ? 'success' : 'warning', `Type: ${file.type || 'No MIME type'}`)

    // Test 2: Read file as ArrayBuffer to verify it's readable
    try {
      const arrayBuffer = await file.arrayBuffer()
      addTestResult('File Readability', 'success', `File is readable: ${arrayBuffer.byteLength} bytes`)
      
      // Check first few bytes (magic numbers) to verify file type
      const bytes = new Uint8Array(arrayBuffer.slice(0, 4))
      const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
      
      let detectedType = 'Unknown'
      if (hex.startsWith('ffd8ff')) detectedType = 'JPEG'
      else if (hex.startsWith('89504e47')) detectedType = 'PNG'
      else if (hex.startsWith('25504446')) detectedType = 'PDF'
      else if (hex.startsWith('52494646')) detectedType = 'WEBP'
      
      addTestResult('Magic Number Check', detectedType !== 'Unknown' ? 'success' : 'warning', `Detected: ${detectedType} (${hex})`)
    } catch (err: any) {
      addTestResult('File Readability', 'error', `Cannot read file: ${err.message}`)
    }

    // Test 3: Read as Data URL
    try {
      const reader = new FileReader()
      await new Promise((resolve, reject) => {
        reader.onload = resolve
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      addTestResult('Data URL Creation', 'success', 'File can be converted to Data URL')
    } catch (err: any) {
      addTestResult('Data URL Creation', 'error', `Cannot create Data URL: ${err.message}`)
    }
  }

  async function testUpload() {
    if (!selectedFile) {
      showToast('Please select a file first', 'error')
      return
    }

    setTesting(true)
    clearResults()

    try {
      // Test 4: File still valid before upload
      addTestResult('Pre-Upload Check', 'success', `File: ${selectedFile.name}, Size: ${selectedFile.size} bytes`)

      // Test 5: Generate file path
      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `test_proof_${Date.now()}.${fileExt}`
      const filePath = `test-uploads/${fileName}`
      addTestResult('File Path Generation', 'success', `Path: ${filePath}`)

      // Test 6: Upload file with multiple methods
      
      // Method 1: Upload as Blob with explicit contentType (most reliable)
      addTestResult('Upload Method 1', 'success', 'Starting: Blob upload with explicit contentType')
      
      // Detect content type from extension
      const mimeTypes: { [key: string]: string } = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'webp': 'image/webp',
        'pdf': 'application/pdf',
      }
      const detectedType = mimeTypes[fileExt || ''] || selectedFile.type || 'application/octet-stream'
      
      // Convert to Blob with explicit type
      const arrayBuffer = await selectedFile.arrayBuffer()
      const blob = new Blob([arrayBuffer], { type: detectedType })
      
      addTestResult('Blob Creation', 'success', `Blob type: ${blob.type}, Size: ${blob.size}`)
      
      const { data: uploadData1, error: uploadError1 } = await db.storage
        .from('documents')
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: detectedType,
        })

      if (uploadError1) {
        addTestResult('Upload Method 1', 'error', `Failed: ${uploadError1.message}`)
        
        // Try alternative upload methods
        
        // Method 2: Upload as Blob
        addTestResult('Upload Method 2', 'success', 'Trying: Upload as Blob')
        const blob = new Blob([await selectedFile.arrayBuffer()], { type: selectedFile.type })
        const filePath2 = `test-uploads/blob_${Date.now()}.${fileExt}`
        
        const { data: uploadData2, error: uploadError2 } = await db.storage
          .from('documents')
          .upload(filePath2, blob, {
            cacheControl: '3600',
            upsert: false,
            contentType: selectedFile.type,
          })

        if (uploadError2) {
          addTestResult('Upload Method 2', 'error', `Failed: ${uploadError2.message}`)
        } else {
          addTestResult('Upload Method 2', 'success', 'Blob upload successful')
          setUploadedFilePath(filePath2)
        }
      } else {
        addTestResult('Upload Method 1', 'success', `Upload successful: ${uploadData1.path}`)
        setUploadedFilePath(filePath)
      }

      // Test 7: Verify file exists in storage
      const pathToCheck = uploadedFilePath || filePath
      if (pathToCheck) {
        const { data: fileList, error: listError } = await db.storage
          .from('documents')
          .list('test-uploads')

        if (listError) {
          addTestResult('File Verification', 'error', `Cannot list files: ${listError.message}`)
        } else {
          const fileExists = fileList?.some(f => pathToCheck.endsWith(f.name))
          addTestResult('File Verification', fileExists ? 'success' : 'error', fileExists ? 'File exists in storage' : 'File not found in storage')
        }

        // Test 8: Get public URL
        const { data: publicUrlData } = db.storage
          .from('documents')
          .getPublicUrl(pathToCheck)

        if (publicUrlData.publicUrl) {
          addTestResult('Public URL', 'success', `URL: ${publicUrlData.publicUrl}`)
        }

        // Test 9: Get signed URL
        const { data: signedUrlData, error: signedError } = await db.storage
          .from('documents')
          .createSignedUrl(pathToCheck, 3600)

        if (signedError) {
          addTestResult('Signed URL', 'error', `Cannot create signed URL: ${signedError.message}`)
        } else if (signedUrlData.signedUrl) {
          addTestResult('Signed URL', 'success', `URL created`)
          setDownloadUrl(signedUrlData.signedUrl)

          // Test 10: Try to download and verify
          try {
            const response = await fetch(signedUrlData.signedUrl)
            if (response.ok) {
              const downloadedBlob = await response.blob()
              addTestResult('Download Test', 'success', `Downloaded: ${downloadedBlob.size} bytes, Type: ${downloadedBlob.type}`)
              
              // Compare sizes
              if (downloadedBlob.size === selectedFile.size) {
                addTestResult('Size Comparison', 'success', 'Downloaded file size matches original')
              } else {
                addTestResult('Size Comparison', 'error', `Size mismatch! Original: ${selectedFile.size}, Downloaded: ${downloadedBlob.size}`)
              }

              // Compare content type
              if (downloadedBlob.type === selectedFile.type) {
                addTestResult('Type Comparison', 'success', 'Downloaded file type matches original')
              } else {
                addTestResult('Type Comparison', 'warning', `Type mismatch! Original: ${selectedFile.type}, Downloaded: ${downloadedBlob.type}`)
              }

              // Check magic numbers of downloaded file
              const downloadedArrayBuffer = await downloadedBlob.arrayBuffer()
              const downloadedBytes = new Uint8Array(downloadedArrayBuffer.slice(0, 4))
              const downloadedHex = Array.from(downloadedBytes).map(b => b.toString(16).padStart(2, '0')).join('')
              
              let downloadedType = 'Unknown'
              if (downloadedHex.startsWith('ffd8ff')) downloadedType = 'JPEG'
              else if (downloadedHex.startsWith('89504e47')) downloadedType = 'PNG'
              else if (downloadedHex.startsWith('25504446')) downloadedType = 'PDF'
              else if (downloadedHex.startsWith('52494646')) downloadedType = 'WEBP'
              
              addTestResult('Magic Number Verification', downloadedType !== 'Unknown' ? 'success' : 'error', `Downloaded file format: ${downloadedType} (${downloadedHex})`)
            } else {
              addTestResult('Download Test', 'error', `Download failed: ${response.status} ${response.statusText}`)
            }
          } catch (fetchErr: any) {
            addTestResult('Download Test', 'error', `Cannot download: ${fetchErr.message}`)
          }
        }
      }

      addTestResult('Test Complete', 'success', 'All tests completed')
      showToast('Upload test completed! Check results below.', 'success')
    } catch (err: any) {
      addTestResult('Fatal Error', 'error', err.message)
      showToast('Test failed: ' + err.message, 'error')
    } finally {
      setTesting(false)
    }
  }

  async function handleDownload() {
    if (!downloadUrl) return

    try {
      const response = await fetch(downloadUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = selectedFile?.name || 'downloaded_file'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      showToast('File downloaded', 'success')
    } catch (err: any) {
      showToast('Download failed: ' + err.message, 'error')
    }
  }

  async function cleanupTestFiles() {
    try {
      const { data: fileList } = await db.storage
        .from('documents')
        .list('test-uploads')

      if (fileList && fileList.length > 0) {
        const filePaths = fileList.map(f => `test-uploads/${f.name}`)
        await db.storage
          .from('documents')
          .remove(filePaths)
        
        showToast(`Cleaned up ${fileList.length} test files`, 'success')
        addTestResult('Cleanup', 'success', `Removed ${fileList.length} test files`)
      } else {
        showToast('No test files to clean up', 'info')
      }
    } catch (err: any) {
      showToast('Cleanup failed: ' + err.message, 'error')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Proof of Payment Upload Test
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Comprehensive test suite to diagnose file upload issues
          </p>
        </div>

        <Card>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Upload Test
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select File (JPG, PNG, WebP, or PDF)
              </label>
              <Input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                onChange={handleFileSelect}
                className="w-full"
              />
            </div>

            {selectedFile && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Selected: {selectedFile.name}
                  </p>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Size: {(selectedFile.size / 1024).toFixed(2)} KB | Type: {selectedFile.type || 'Unknown'}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={testUpload}
                disabled={!selectedFile || testing}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {testing ? 'Testing...' : 'Run Upload Test'}
              </Button>

              {downloadUrl && (
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Test File
                </Button>
              )}

              <Button
                onClick={cleanupTestFiles}
                variant="outline"
                className="flex items-center gap-2"
              >
                Clean Up Test Files
              </Button>
            </div>
          </div>
        </Card>

        {testResults.length > 0 && (
          <Card>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Test Results
            </h2>
            
            <div className="space-y-2">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 p-3 rounded-lg ${
                    result.status === 'success'
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : result.status === 'error'
                      ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                      : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                  }`}
                >
                  {result.status === 'success' && <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />}
                  {result.status === 'error' && <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />}
                  {result.status === 'warning' && <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {result.step}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 break-words">
                      {result.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            What This Test Does
          </h3>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li>✓ Validates file selection and readability</li>
            <li>✓ Checks file magic numbers (file format signature)</li>
            <li>✓ Tests direct file upload to Supabase Storage</li>
            <li>✓ Tests Blob upload as fallback method</li>
            <li>✓ Verifies file exists after upload</li>
            <li>✓ Creates and tests signed URL</li>
            <li>✓ Downloads file and compares with original</li>
            <li>✓ Validates file integrity (size, type, format)</li>
            <li>✓ Provides detailed diagnostics for each step</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}


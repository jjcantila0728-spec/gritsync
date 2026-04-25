import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { FileText, ImageIcon, GraduationCap, Eye, Plus, X } from 'lucide-react'
import { DocumentImagePreview } from '@/components/ui/DocumentImagePreview'
import { DocumentPDFPreview } from './DocumentPDFPreview'
import { getSignedFileUrl, userDocumentsAPI } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import type { ApplicationData } from '../types'

interface DocumentsTabProps {
  application: ApplicationData
  latestDocuments: {
    picture?: { file_path: string; file_name: string }
    diploma?: { file_path: string; file_name: string }
    passport?: { file_path: string; file_name: string }
  }
  handleViewFile: (url: string, fileName: string) => void
}

export function DocumentsTab({
  application,
  latestDocuments,
  handleViewFile
}: DocumentsTabProps) {
  const { isAdmin } = useAuth()
  const { showToast } = useToast()
  const [mandatoryCourseFiles, setMandatoryCourseFiles] = useState<any[]>([])
  const [uploadingCourseFile, setUploadingCourseFile] = useState(false)
  const [viewingFile, setViewingFile] = useState<{ url: string; fileName: string; isImage: boolean } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string; name: string } | null>(null)

  useEffect(() => {
    if (application?.user_id) {
      loadMandatoryCourseFiles()
    }
  }, [application?.user_id])

  async function loadMandatoryCourseFiles() {
    if (!application?.user_id) return
    try {
      const docs = await userDocumentsAPI.getByUserId(application.user_id)
      const courseFiles = (docs || []).filter((doc: any) => doc.document_type?.startsWith('mandatory_course'))
      setMandatoryCourseFiles(courseFiles)
    } catch {
      // Silent fail
    }
  }

  async function handleDeleteCourseFile(fileId: string) {
    try {
      await userDocumentsAPI.delete(fileId)
      showToast('File deleted successfully', 'success')
      await loadMandatoryCourseFiles()
    } catch (error: any) {
      showToast(error.message || 'Failed to delete file', 'error')
    } finally {
      setDeleteConfirm(null)
    }
  }

  async function handleUploadCourseFile(documentType: string, label: string) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file || !application?.user_id) return

      setUploadingCourseFile(true)
      try {
        const firstName = application.first_name || ''
        const lastName = application.last_name || ''
        const fileExtension = file.name.split('.').pop() || ''
        const sanitizedName = `${firstName}_${lastName}`.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_')
        const safeName = label.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_')
        const newFileName = `${safeName}_${sanitizedName}.${fileExtension}`
        const renamedFile = new File([file], newFileName, { type: file.type })
        await userDocumentsAPI.uploadForUser(application.user_id, documentType, renamedFile)
        showToast('Course file uploaded successfully', 'success')
        await loadMandatoryCourseFiles()
      } catch (error: any) {
        showToast(error.message || 'Failed to upload file', 'error')
      } finally {
        setUploadingCourseFile(false)
      }
    }
    input.click()
  }

  function renderCourseFile(documentType: string, label: string) {
    const courseFile = mandatoryCourseFiles.find((f: any) => f.document_type === documentType)
    const alreadyUploaded = !!courseFile

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
          {isAdmin() && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleUploadCourseFile(documentType, label)}
              disabled={uploadingCourseFile || alreadyUploaded}
              className={alreadyUploaded ? 'opacity-50 cursor-not-allowed' : ''}
            >
              <Plus className="h-4 w-4 mr-2" />
              {uploadingCourseFile ? 'Uploading...' : 'Upload'}
            </Button>
          )}
        </div>
        {!courseFile ? (
          <div className="aspect-square rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No file uploaded</p>
            </div>
          </div>
        ) : (() => {
          const isImage = courseFile.file_name?.match(/\.(jpg|jpeg|png|gif|webp)$/i) || false
          const fileName = courseFile.file_name || 'course_file'
          return (
            <div className="space-y-2">
              <div
                className="aspect-square rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800/50 cursor-pointer group relative"
                onClick={async () => {
                  try {
                    const signedUrl = await getSignedFileUrl(courseFile.file_path, 3600)
                    const isImageFile = !!(fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i))
                    setViewingFile({ url: signedUrl, fileName, isImage: isImageFile })
                  } catch {
                    showToast('Failed to load file', 'error')
                  }
                }}
              >
                {isImage ? (
                  <DocumentImagePreview filePath={courseFile.file_path} alt={fileName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                ) : fileName?.toLowerCase().endsWith('.pdf') ? (
                  <DocumentPDFPreview filePath={courseFile.file_path} alt={fileName} className="w-full h-full border-0" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileText className="h-12 w-12 text-gray-400" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                  <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {isAdmin() && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteConfirm({ type: 'file', id: courseFile.id, name: fileName })
                    }}
                    className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    title="Delete file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 truncate" title={fileName}>{fileName}</div>
              {courseFile.uploaded_at && (
                <div className="text-xs text-gray-500">Uploaded: {new Date(courseFile.uploaded_at).toLocaleDateString()}</div>
              )}
            </div>
          )
        })()}
      </div>
    )
  }

  return (
    <>
      {viewingFile && (
        <Modal isOpen={!!viewingFile} onClose={() => setViewingFile(null)} title={viewingFile.fileName} size="lg">
          <div className="flex items-center justify-center min-h-64">
            {viewingFile.isImage ? (
              <img src={viewingFile.url} alt={viewingFile.fileName} className="max-w-full max-h-96 object-contain rounded" />
            ) : (
              <iframe src={viewingFile.url} title={viewingFile.fileName} className="w-full h-96 border-0 rounded" />
            )}
          </div>
        </Modal>
      )}
      {deleteConfirm && (
        <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete File" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => handleDeleteCourseFile(deleteConfirm.id)}>Delete</Button>
            </div>
          </div>
        </Modal>
      )}

      <div className="space-y-6">
        <Card title={
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span>Required Documents</span>
          </div>
        }>
          <div className="grid md:grid-cols-3 gap-6">
            {/* 2x2 Picture */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                2x2 Picture
              </p>
              {(() => {
                let picturePath: string | null = latestDocuments.picture?.file_path || application.picture_path || null
                const pictureName = latestDocuments.picture?.file_name || (application.picture_path?.split(/[/\\]/).pop() || 'picture.jpg')

                if (picturePath && picturePath.toLowerCase().includes('avatar')) picturePath = null

                if (picturePath) {
                  picturePath = picturePath.replace(/\\/g, '/')
                  if (application.user_id && !picturePath.startsWith(application.user_id + '/')) {
                    if (!picturePath.includes('/')) {
                      picturePath = `${application.user_id}/${picturePath}`
                    } else {
                      const filename = picturePath.split('/').pop()
                      if (filename) picturePath = `${application.user_id}/${filename}`
                    }
                  }
                }

                return picturePath ? (
                  <div className="relative group">
                    <div
                      className="aspect-square rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800/50 cursor-pointer"
                      onClick={() => handleViewFile(picturePath!, pictureName)}
                    >
                      <DocumentImagePreview
                        filePath={picturePath}
                        alt="2x2 Picture"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                        <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-square rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Not available</p>
                  </div>
                )
              })()}
            </div>

            {/* Nursing Diploma */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Nursing Diploma
              </p>
              {(() => {
                let diplomaPath = latestDocuments.diploma?.file_path || application.diploma_path
                const diplomaName = latestDocuments.diploma?.file_name || (application.diploma_path?.split(/[/\\]/).pop() || 'diploma.pdf')

                if (diplomaPath) {
                  diplomaPath = diplomaPath.replace(/\\/g, '/')
                  const isFromUserDocuments = !!latestDocuments.diploma?.file_path
                  if (!isFromUserDocuments && application.user_id) {
                    if (!diplomaPath.startsWith(application.user_id + '/')) {
                      if (!diplomaPath.includes('/')) {
                        diplomaPath = `${application.user_id}/${diplomaPath}`
                      } else {
                        const filename = diplomaPath.split('/').pop()
                        if (filename) diplomaPath = `${application.user_id}/${filename}`
                      }
                    }
                  }
                }

                return diplomaPath ? (
                  <div className="relative group">
                    <div
                      className="aspect-square rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800/50 cursor-pointer"
                      onClick={() => handleViewFile(diplomaPath!, diplomaName)}
                    >
                      {(() => {
                        const isImage = diplomaName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) || false
                        return isImage ? (
                          <DocumentImagePreview filePath={diplomaPath!} alt="Nursing Diploma" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileText className="h-12 w-12 text-gray-400" />
                          </div>
                        )
                      })()}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                        <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-square rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Not available</p>
                  </div>
                )
              })()}
            </div>

            {/* Passport */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Passport
              </p>
              {(() => {
                let passportPath = latestDocuments.passport?.file_path || application.passport_path
                const passportName = latestDocuments.passport?.file_name || (application.passport_path?.split(/[/\\]/).pop() || 'passport.pdf')

                if (passportPath) {
                  passportPath = passportPath.replace(/\\/g, '/')
                  const isFromUserDocuments = !!latestDocuments.passport?.file_path
                  if (!isFromUserDocuments && application.user_id) {
                    if (!passportPath.startsWith(application.user_id + '/')) {
                      if (!passportPath.includes('/')) {
                        passportPath = `${application.user_id}/${passportPath}`
                      } else {
                        const filename = passportPath.split('/').pop()
                        if (filename) passportPath = `${application.user_id}/${filename}`
                      }
                    }
                  }
                }

                return passportPath ? (
                  <div className="relative group">
                    <div
                      className="aspect-square rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800/50 cursor-pointer"
                      onClick={() => handleViewFile(passportPath!, passportName)}
                    >
                      {(() => {
                        const isImage = passportName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) || false
                        return isImage ? (
                          <DocumentImagePreview filePath={passportPath!} alt="Passport" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileText className="h-12 w-12 text-gray-400" />
                          </div>
                        )
                      })()}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                        <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-square rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Not available</p>
                  </div>
                )
              })()}
            </div>
          </div>
        </Card>

        {/* Mandatory Courses Files */}
        {application?.user_id && (
          <Card title={
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <span>Mandatory Courses Files</span>
            </div>
          }>
            <div className="grid md:grid-cols-2 gap-6">
              {renderCourseFile('mandatory_course_infection_control', 'Infection Control and Barrier Precautions')}
              {renderCourseFile('mandatory_course_child_abuse', 'Child Abuse: New York Mandated Reporter Training')}
            </div>
          </Card>
        )}
      </div>
    </>
  )
}

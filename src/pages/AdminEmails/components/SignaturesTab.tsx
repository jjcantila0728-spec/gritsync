import { EmailSignature } from '@/lib/email-signatures-api'
import { Plus, PenTool, Edit, Star, Trash2 } from 'lucide-react'
import { cn, sanitizeHTML } from '@/lib/utils'

interface SignaturesTabProps {
  signatures: EmailSignature[]
  loading: boolean
  onCreateSignature: () => void
  onEditSignature: (signature: EmailSignature) => void
  onSetDefaultSignature: (id: string) => Promise<void>
  onDeleteSignature: (id: string, name: string) => Promise<void>
}

export function SignaturesTab({
  signatures,
  loading,
  onCreateSignature,
  onEditSignature,
  onSetDefaultSignature,
  onDeleteSignature
}: SignaturesTabProps) {
  return (
    <div>
      {/* Header Actions */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Email Signatures</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Create and manage professional email signatures
          </p>
        </div>
        <button
          onClick={onCreateSignature}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Create Signature
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading signatures...</p>
        </div>
      ) : signatures.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <PenTool className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Email Signatures</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Create your first professional email signature
          </p>
          <button
            onClick={onCreateSignature}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Create Your First Signature
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {signatures.map((sig) => (
            <div
              key={sig.id}
              className={cn(
                'bg-white dark:bg-gray-800 rounded-lg shadow border transition-all hover:shadow-md',
                sig.is_default
                  ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800'
                  : 'border-gray-200 dark:border-gray-700'
              )}
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{sig.name}</h3>
                      {sig.is_default && (
                        <span className="px-2 py-0.5 text-xs bg-primary-600 text-white rounded-full flex items-center gap-1">
                          <Star className="h-3 w-3" fill="currentColor" />
                          Default
                        </span>
                      )}
                      {!sig.is_active && (
                        <span className="px-2 py-0.5 text-xs bg-gray-400 text-white rounded-full">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 capitalize">
                      {sig.signature_type}
                    </p>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="p-4 bg-gray-50 dark:bg-gray-900 max-h-40 overflow-auto">
                <div 
                  dangerouslySetInnerHTML={{ __html: sanitizeHTML(sig.signature_html) }} 
                  className="text-sm"
                />
              </div>

              {/* Actions */}
              <div className="p-4 flex gap-2">
                <button
                  onClick={() => onEditSignature(sig)}
                  className="flex-1 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 font-medium flex items-center justify-center gap-1"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </button>
                {!sig.is_default && (
                  <button
                    onClick={() => onSetDefaultSignature(sig.id)}
                    className="px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                    title="Set as default"
                  >
                    <Star className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => onDeleteSignature(sig.id, sig.name)}
                  className="px-3 py-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


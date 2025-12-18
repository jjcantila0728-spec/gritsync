import { useState, useEffect } from 'react'
import { useToast } from '@/components/ui/Toast'
import { emailTemplatesAPI, EmailTemplate } from '@/lib/email-templates-api'
import { 
  Mail, 
  Plus, 
  X, 
  Save, 
  Edit, 
  Copy, 
  Eye, 
  EyeOff, 
  Trash2, 
  Type,
  Monitor,
  Smartphone,
  Code
} from 'lucide-react'
import { cn } from '@/lib/utils'

const categories = [
  { value: 'all', label: 'All Templates' },
  { value: 'welcome', label: 'Welcome' },
  { value: 'notification', label: 'Notification' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'transactional', label: 'Transactional' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'custom', label: 'Custom' },
]

export function EmailTemplatesManager() {
  const { showToast } = useToast()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showEditor, setShowEditor] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Partial<EmailTemplate> | null>(null)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile' | 'code'>('desktop')
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({})

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const data = await emailTemplatesAPI.getAll()
      setTemplates(data)
    } catch (error) {
      console.error('Error loading templates:', error)
      showToast('Failed to load templates', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNew = () => {
    setEditingTemplate({
      name: '',
      slug: '',
      description: '',
      subject: '',
      html_content: '',
      text_content: '',
      category: 'custom',
      template_type: 'user_created',
      variables: [],
      is_active: true,
      is_default: false,
      version: 1,
      tags: [],
      metadata: {},
    })
    setPreviewVariables({})
    setShowEditor(true)
  }

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template)
    const initialVars: Record<string, string> = {}
    template.variables?.forEach(v => {
      initialVars[v.name] = `[${v.name}]`
    })
    setPreviewVariables(initialVars)
    setShowEditor(true)
  }

  const handleClone = async (template: EmailTemplate) => {
    try {
      await emailTemplatesAPI.clone(template.id)
      showToast('Template cloned successfully', 'success')
      loadTemplates()
    } catch (error) {
      console.error('Error cloning template:', error)
      showToast('Failed to clone template', 'error')
    }
  }

  const handleToggleActive = async (template: EmailTemplate) => {
    try {
      await emailTemplatesAPI.update(template.id, { is_active: !template.is_active })
      showToast(`Template ${template.is_active ? 'deactivated' : 'activated'}`, 'success')
      loadTemplates()
    } catch (error) {
      console.error('Error toggling template:', error)
      showToast('Failed to update template', 'error')
    }
  }

  const handleDelete = async (template: EmailTemplate) => {
    if (template.template_type === 'system') {
      showToast('Cannot delete system templates', 'warning')
      return
    }

    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) {
      return
    }

    try {
      await emailTemplatesAPI.delete(template.id)
      showToast('Template deleted successfully', 'success')
      loadTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
      showToast('Failed to delete template', 'error')
    }
  }

  const handleSave = async () => {
    if (!editingTemplate) return

    if (!editingTemplate.name || !editingTemplate.slug || !editingTemplate.subject || !editingTemplate.html_content) {
      showToast('Please fill in all required fields', 'warning')
      return
    }

    try {
      if (editingTemplate.id) {
        await emailTemplatesAPI.update(editingTemplate.id, editingTemplate)
        showToast('Template updated successfully', 'success')
      } else {
        await emailTemplatesAPI.create(editingTemplate as any)
        showToast('Template created successfully', 'success')
      }
      setShowEditor(false)
      setEditingTemplate(null)
      loadTemplates()
    } catch (error) {
      console.error('Error saving template:', error)
      showToast('Failed to save template', 'error')
    }
  }

  const handleAddVariable = () => {
    if (!editingTemplate) return
    
    const newVar = {
      name: '',
      description: '',
      required: false,
    }
    
    setEditingTemplate({
      ...editingTemplate,
      variables: [...(editingTemplate.variables || []), newVar],
    })
  }

  const handleRemoveVariable = (index: number) => {
    if (!editingTemplate) return
    
    const newVariables = [...(editingTemplate.variables || [])]
    newVariables.splice(index, 1)
    
    setEditingTemplate({
      ...editingTemplate,
      variables: newVariables,
    })
  }

  const handleVariableChange = (index: number, field: string, value: any) => {
    if (!editingTemplate) return
    
    const newVariables = [...(editingTemplate.variables || [])]
    newVariables[index] = { ...newVariables[index], [field]: value }
    
    setEditingTemplate({
      ...editingTemplate,
      variables: newVariables,
    })
  }

  const getPreviewHtml = () => {
    if (!editingTemplate) return ''
    
    return emailTemplatesAPI.render(editingTemplate as EmailTemplate, previewVariables).html
  }

  const filteredTemplates = selectedCategory === 'all'
    ? templates
    : templates.filter(t => t.category === selectedCategory)

  if (showEditor) {
    return (
      <div className="space-y-6">
        {/* Editor Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {editingTemplate?.id ? 'Edit Template' : 'Create New Template'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Design and customize your email template</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowEditor(false)
                setEditingTemplate(null)
              }}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <X className="h-5 w-5 inline mr-2" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              <Save className="h-5 w-5 inline mr-2" />
              Save Template
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Editor Panel */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Template Details</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingTemplate?.name || ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., Welcome New User"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Slug <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingTemplate?.slug || ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, slug: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., welcome-new-user"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">URL-friendly identifier (lowercase, hyphens only)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <textarea
                    value={editingTemplate?.description || ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                    rows={2}
                    placeholder="Brief description of this template"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editingTemplate?.category || 'custom'}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, category: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                  >
                    {categories.filter(c => c.value !== 'all').map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Subject Line <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingTemplate?.subject || ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., Welcome to {{companyName}}, {{userName}}!"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editingTemplate?.is_active || false}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, is_active: e.target.checked })}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Variables</h3>
                <button
                  onClick={handleAddVariable}
                  className="text-sm px-3 py-1 text-primary-600 dark:text-primary-400 border border-primary-600 dark:border-primary-400 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20"
                >
                  <Plus className="h-4 w-4 inline mr-1" />
                  Add Variable
                </button>
              </div>

              <div className="space-y-3">
                {editingTemplate?.variables?.map((variable, index) => (
                  <div key={index} className="flex gap-2 items-start p-3 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600">
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={variable.name}
                        onChange={(e) => handleVariableChange(index, 'name', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                        placeholder="Variable name (e.g., userName)"
                      />
                      <input
                        type="text"
                        value={variable.description}
                        onChange={(e) => handleVariableChange(index, 'description', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                        placeholder="Description"
                      />
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={variable.required}
                          onChange={(e) => handleVariableChange(index, 'required', e.target.checked)}
                          className="rounded border-gray-300 text-primary-600"
                        />
                        <span className="text-xs text-gray-600 dark:text-gray-400">Required</span>
                      </label>
                    </div>
                    <button
                      onClick={() => handleRemoveVariable(index)}
                      className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {(!editingTemplate?.variables || editingTemplate.variables.length === 0) && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No variables defined. Click "Add Variable" to create one.</p>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                HTML Content <span className="text-red-500">*</span>
              </h3>
              <textarea
                value={editingTemplate?.html_content || ''}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, html_content: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono text-sm dark:bg-gray-700 dark:text-white"
                rows={15}
                placeholder="Enter HTML email content. Use {{variableName}} for variables."
              />
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Plain Text Content</h3>
              <textarea
                value={editingTemplate?.text_content || ''}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, text_content: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono text-sm dark:bg-gray-700 dark:text-white"
                rows={8}
                placeholder="Enter plain text version (optional, but recommended)"
              />
            </div>
          </div>

          {/* Preview Panel */}
          <div className="space-y-4 sticky top-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Preview</h3>
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  <button
                    onClick={() => setPreviewMode('desktop')}
                    className={cn(
                      'px-3 py-1 rounded transition-colors',
                      previewMode === 'desktop' ? 'bg-white dark:bg-gray-600 shadow' : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                    )}
                  >
                    <Monitor className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                  </button>
                  <button
                    onClick={() => setPreviewMode('mobile')}
                    className={cn(
                      'px-3 py-1 rounded transition-colors',
                      previewMode === 'mobile' ? 'bg-white dark:bg-gray-600 shadow' : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                    )}
                  >
                    <Smartphone className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                  </button>
                  <button
                    onClick={() => setPreviewMode('code')}
                    className={cn(
                      'px-3 py-1 rounded transition-colors',
                      previewMode === 'code' ? 'bg-white dark:bg-gray-600 shadow' : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                    )}
                  >
                    <Code className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                  </button>
                </div>
              </div>

              {/* Preview Variables */}
              {editingTemplate?.variables && editingTemplate.variables.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                  <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-2">Test Variables:</p>
                  <div className="space-y-2">
                    {editingTemplate.variables.map((variable) => (
                      <div key={variable.name}>
                        <input
                          type="text"
                          value={previewVariables[variable.name] || ''}
                          onChange={(e) => setPreviewVariables({ ...previewVariables, [variable.name]: e.target.value })}
                          className="w-full px-2 py-1 text-sm border border-blue-300 dark:border-blue-700 rounded dark:bg-gray-700 dark:text-white"
                          placeholder={`{{${variable.name}}}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Content */}
              <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                {previewMode === 'code' ? (
                  <pre className="p-4 bg-gray-50 dark:bg-gray-900 text-xs overflow-auto max-h-[600px] text-gray-800 dark:text-gray-200">
                    <code>{getPreviewHtml()}</code>
                  </pre>
                ) : (
                  <div
                    className={cn('bg-white', previewMode === 'mobile' ? 'max-w-[375px] mx-auto' : '')}
                    style={{ minHeight: '400px' }}
                  >
                    <iframe
                      srcDoc={getPreviewHtml()}
                      className="w-full h-[600px] border-0"
                      title="Email Preview"
                      sandbox="allow-same-origin"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Email Templates</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Create and manage professional email templates</p>
        </div>
        <button
          onClick={handleCreateNew}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          <Plus className="h-5 w-5 inline mr-2" />
          Create Template
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map(cat => (
          <button
            key={cat.value}
            onClick={() => setSelectedCategory(cat.value)}
            className={cn(
              'px-4 py-2 rounded-lg whitespace-nowrap font-medium transition-all',
              selectedCategory === cat.value
                ? 'bg-primary-600 text-white shadow-lg'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700'
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading templates...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map(template => (
            <div
              key={template.id}
              className={cn(
                'bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md hover:shadow-xl transition-all border',
                !template.is_active 
                  ? 'opacity-60 border-gray-200 dark:border-gray-700' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600'
              )}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{template.name}</h3>
                  <p className="text-sm text-primary-600 dark:text-primary-400 font-medium mt-1">{template.category}</p>
                </div>
                <div className="flex items-center gap-1">
                  {template.template_type === 'system' && (
                    <span className="px-2 py-1 text-xs bg-blue-500 text-white rounded font-medium">System</span>
                  )}
                  {!template.is_active && (
                    <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded font-medium">Inactive</span>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2 min-h-[40px]">
                {template.description || 'No description'}
              </p>

              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-500 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    <span>{template.usage_count || 0} uses</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Type className="h-3 w-3" />
                    <span>{template.variables?.length || 0} vars</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(template)}
                  className="flex-1 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors font-medium"
                >
                  <Edit className="h-4 w-4 inline mr-1" />
                  Edit
                </button>
                <button
                  onClick={() => handleClone(template)}
                  className="flex-1 px-3 py-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors font-medium"
                >
                  <Copy className="h-4 w-4 inline mr-1" />
                  Clone
                </button>
                <button
                  onClick={() => handleToggleActive(template)}
                  className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  title={template.is_active ? 'Deactivate' : 'Activate'}
                >
                  {template.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                {template.template_type !== 'system' && (
                  <button
                    onClick={() => handleDelete(template)}
                    className="px-3 py-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredTemplates.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/20 mb-4">
            <Mail className="h-8 w-8 text-primary-600 dark:text-primary-400" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 mb-4">No templates found in this category.</p>
          <button
            onClick={handleCreateNew}
            className="px-6 py-3 text-primary-600 dark:text-primary-400 border-2 border-primary-600 dark:border-primary-400 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 font-medium transition-colors"
          >
            Create Your First Template
          </button>
        </div>
      )}
    </div>
  )
}








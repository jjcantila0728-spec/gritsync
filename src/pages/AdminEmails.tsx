/**
 * Admin Emails Page - Enterprise-grade email management system
 * Features:
 * - Email history with advanced filtering
 * - Email analytics and statistics
 * - Compose and send emails
 * - Retry failed emails
 * - Email templates
 * - Bulk operations
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { useToast } from '@/components/ui/Toast'
import { 
  Mail, 
  Send, 
  RefreshCw, 
  Search, 
  Filter, 
  Download,
  Trash2,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Activity,
  Plus,
  X,
  FileText,
  Type,
  Edit,
  Copy,
  Save,
  EyeOff,
  Code,
  Monitor,
  Smartphone,
  Star,
  PenTool,
  Settings,
  Upload,
  Image as ImageIcon,
  File as FileIcon,
  MoreVertical,
  Paperclip,
  Minimize2,
  Reply,
  ReplyAll,
  Forward,
  Printer,
  ExternalLink,
} from 'lucide-react'
import { emailLogsAPI, sendEmailWithLogging, EmailLog, EmailStats } from '@/lib/email-api'
import { Loading } from '@/components/ui/Loading'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { emailTemplatesAPI, EmailTemplate } from '@/lib/email-templates-api'
import { emailSignaturesAPI, EmailSignature } from '@/lib/email-signatures-api'
import { resendInboxAPI, ReceivedEmail } from '@/lib/resend-inbox-api'
import { businessLogosAPI, BusinessLogo } from '@/lib/email-signatures-api'
import { supabase } from '@/lib/supabase'
import { getSignedFileUrl } from '@/lib/supabase-api'

type Tab = 'inbox' | 'sent' | 'templates' | 'signatures' | 'email-setup'

interface EnrichedReceivedEmail extends ReceivedEmail {
  senderName?: string
  senderAvatar?: string
  isRead?: boolean
}

// Email Templates Manager Component
function EmailTemplatesManager() {
  const { showToast } = useToast()
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<EmailTemplate> | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile' | 'code'>('desktop');
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({});

  const categories = [
    { value: 'all', label: 'All Templates' },
    { value: 'welcome', label: 'Welcome' },
    { value: 'notification', label: 'Notification' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'transactional', label: 'Transactional' },
    { value: 'reminder', label: 'Reminder' },
    { value: 'announcement', label: 'Announcement' },
    { value: 'custom', label: 'Custom' },
  ];

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await emailTemplatesAPI.getAll();
      setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
      showToast('Failed to load templates', 'error');
    } finally {
      setLoading(false);
    }
  };

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
    });
    setPreviewVariables({});
    setShowEditor(true);
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    const initialVars: Record<string, string> = {};
    template.variables?.forEach(v => {
      initialVars[v.name] = `[${v.name}]`;
    });
    setPreviewVariables(initialVars);
    setShowEditor(true);
  };

  const handleClone = async (template: EmailTemplate) => {
    try {
      await emailTemplatesAPI.clone(template.id);
      showToast('Template cloned successfully', 'success');
      loadTemplates();
    } catch (error) {
      console.error('Error cloning template:', error);
      showToast('Failed to clone template', 'error');
    }
  };

  const handleToggleActive = async (template: EmailTemplate) => {
    try {
      await emailTemplatesAPI.update(template.id, { is_active: !template.is_active });
      showToast(`Template ${template.is_active ? 'deactivated' : 'activated'}`, 'success');
      loadTemplates();
    } catch (error) {
      console.error('Error toggling template:', error);
      showToast('Failed to update template', 'error');
    }
  };

  const handleDelete = async (template: EmailTemplate) => {
    if (template.template_type === 'system') {
      showToast('Cannot delete system templates', 'warning');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) {
      return;
    }

    try {
      await emailTemplatesAPI.delete(template.id);
      showToast('Template deleted successfully', 'success');
      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      showToast('Failed to delete template', 'error');
    }
  };

  const handleSave = async () => {
    if (!editingTemplate) return;

    if (!editingTemplate.name || !editingTemplate.slug || !editingTemplate.subject || !editingTemplate.html_content) {
      showToast('Please fill in all required fields', 'warning');
      return;
    }

    try {
      if (editingTemplate.id) {
        await emailTemplatesAPI.update(editingTemplate.id, editingTemplate);
        showToast('Template updated successfully', 'success');
      } else {
        await emailTemplatesAPI.create(editingTemplate as any);
        showToast('Template created successfully', 'success');
      }
      setShowEditor(false);
      setEditingTemplate(null);
      loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      showToast('Failed to save template', 'error');
    }
  };

  const handleAddVariable = () => {
    if (!editingTemplate) return;
    
    const newVar = {
      name: '',
      description: '',
      required: false,
    };
    
    setEditingTemplate({
      ...editingTemplate,
      variables: [...(editingTemplate.variables || []), newVar],
    });
  };

  const handleRemoveVariable = (index: number) => {
    if (!editingTemplate) return;
    
    const newVariables = [...(editingTemplate.variables || [])];
    newVariables.splice(index, 1);
    
    setEditingTemplate({
      ...editingTemplate,
      variables: newVariables,
    });
  };

  const handleVariableChange = (index: number, field: string, value: any) => {
    if (!editingTemplate) return;
    
    const newVariables = [...(editingTemplate.variables || [])];
    newVariables[index] = { ...newVariables[index], [field]: value };
    
    setEditingTemplate({
      ...editingTemplate,
      variables: newVariables,
    });
  };

  const getPreviewHtml = () => {
    if (!editingTemplate) return '';
    
    return emailTemplatesAPI.render(editingTemplate as EmailTemplate, previewVariables).html;
  };

  const filteredTemplates = selectedCategory === 'all'
    ? templates
    : templates.filter(t => t.category === selectedCategory);

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
                setShowEditor(false);
                setEditingTemplate(null);
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
    );
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
  );
}

export function AdminEmails() {
  const { isAdmin, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useToast()
  
  // Get initial tab from URL path or hash
  const getInitialTab = (): Tab => {
    // Check URL path first (e.g., /admin/emails/inbox, /admin/emails/sent, /admin/emails/signatures, /admin/emails/email-setup)
    const pathParts = location.pathname.split('/')
    const lastPart = pathParts[pathParts.length - 1]
    if (lastPart && ['inbox', 'sent', 'templates', 'signatures', 'email-setup'].includes(lastPart)) {
      return lastPart as Tab
    }
    
    // Then check hash (e.g., /admin/emails#inbox)
    const hash = location.hash.replace('#', '')
    if (hash && ['inbox', 'sent', 'templates', 'signatures', 'email-setup'].includes(hash)) {
      return hash as Tab
    }
    
    return 'inbox'
  }
  
  const [activeTab, setActiveTab] = useState<Tab>(getInitialTab())
  const [loading, setLoading] = useState(true)
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([])
  const [receivedEmails, setReceivedEmails] = useState<any[]>([])
  const [stats, setStats] = useState<EmailStats | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null)
  const [selectedReceivedEmail, setSelectedReceivedEmail] = useState<any | null>(null)
  const [inboxHasMore, setInboxHasMore] = useState(false)
  
  // Selection state for bulk actions
  const [selectedSentIds, setSelectedSentIds] = useState<Set<string>>(new Set())
  const [selectedInboxIds, setSelectedInboxIds] = useState<Set<string>>(new Set())
  
  // Delete confirmation modal
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    type: 'sent' | 'inbox'
    emailId: string | null
    emailSubject: string
  }>({
    isOpen: false,
    type: 'sent',
    emailId: null,
    emailSubject: ''
  })

  // Email signatures state
  const [signatures, setSignatures] = useState<EmailSignature[]>([])
  const [editingSignature, setEditingSignature] = useState<Partial<EmailSignature> | null>(null)
  const [showSignatureEditor, setShowSignatureEditor] = useState(false)

  // Email setup state
  const [businessLogos, setBusinessLogos] = useState<BusinessLogo[]>([])
  const [showLogoUpload, setShowLogoUpload] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [editingEmail, setEditingEmail] = useState<any | null>(null)
  const [showEmailEditor, setShowEmailEditor] = useState(false)
  const [showAddEmailModal, setShowAddEmailModal] = useState(false)
  const [newEmailData, setNewEmailData] = useState({
    email_address: '',
    display_name: '',
    address_type: 'admin' as 'admin' | 'support' | 'noreply' | 'department',
    department: '',
    can_send: true,
    can_receive: true,
  })
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [showFilters, setShowFilters] = useState(false)

  // Compose email state
  const [composing, setComposing] = useState(false)
  const [composeData, setComposeData] = useState({
    to: '',
    toName: '',
    subject: '',
    body: '',
    emailType: 'manual' as const,
    category: 'custom',
    tags: [] as string[],
    fromEmailAddressId: '',
    replyTo: '',
  })
  const [sending, setSending] = useState(false)
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
  const [showTemplateMenu, setShowTemplateMenu] = useState(false)
  const [showSignatureMenu, setShowSignatureMenu] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const templateMenuRef = useRef<HTMLDivElement>(null)
  const signatureMenuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Email addresses
  const [adminEmailAddresses, setAdminEmailAddresses] = useState<any[]>([])
  const [_loadingAddresses, setLoadingAddresses] = useState(false)
  
  // Email templates
  const [emailTemplates, setEmailTemplates] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({})
  
  // Email signatures
  const [emailSignatures, setEmailSignatures] = useState<any[]>([])
  const [_selectedSignatureId, setSelectedSignatureId] = useState<string>('')

  useEffect(() => {
    if (isAdmin()) {
      if (activeTab === 'sent') {
        // Clear inbox emails when showing sent
        setReceivedEmails([])
        loadData()
      } else if (activeTab === 'inbox') {
        // Clear sent emails when showing inbox
        setEmailLogs([])
        setTotalCount(0)
        setTotalPages(1)
        loadInboxEmails()
      } else if (activeTab === 'signatures') {
        // Clear both email lists when showing signatures
        setReceivedEmails([])
        setEmailLogs([])
        loadSignaturesData()
      } else if (activeTab === 'email-setup') {
        // Clear both email lists when showing email-setup
        setReceivedEmails([])
        setEmailLogs([])
        loadEmailSetupData()
      }
      loadAdminEmailAddresses()
      loadEmailTemplates()
      loadEmailSignatures()
    }
  }, [currentPage, statusFilter, typeFilter, categoryFilter, searchQuery, dateRange, activeTab])

  // Close dropdown menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (templateMenuRef.current && !templateMenuRef.current.contains(event.target as Node)) {
        setShowTemplateMenu(false)
      }
      if (signatureMenuRef.current && !signatureMenuRef.current.contains(event.target as Node)) {
        setShowSignatureMenu(false)
      }
    }

    if (showTemplateMenu || showSignatureMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showTemplateMenu, showSignatureMenu])
  
  const loadAdminEmailAddresses = async () => {
    setLoadingAddresses(true)
    try {
      const { emailAddressesAPI } = await import('@/lib/email-addresses-api')
      // Load all email addresses and filter for business/system addresses (admin, support, noreply, department)
      // Show all, including unverified and inactive
      const allAddresses = await emailAddressesAPI.getAll()
      const businessAddresses = allAddresses.filter(addr => 
        ['admin', 'support', 'noreply', 'department'].includes(addr.address_type)
      )
      setAdminEmailAddresses(businessAddresses)
      // Set default from address (prefer active/verified addresses)
      const defaultAddress = businessAddresses.find(addr => addr.is_active && addr.is_verified) || businessAddresses[0]
      if (defaultAddress && !composeData.fromEmailAddressId) {
        setComposeData(prev => ({ ...prev, fromEmailAddressId: defaultAddress.id }))
      }
    } catch (error) {
      console.error('Error loading admin email addresses:', error)
    } finally {
      setLoadingAddresses(false)
    }
  }

  const loadEmailTemplates = async () => {
    try {
      const templates = await emailTemplatesAPI.getAllActive()
      setEmailTemplates(templates)
    } catch (error) {
      console.error('Error loading email templates:', error)
    }
  }

  const loadEmailSignatures = async () => {
    try {
      const signatures = await emailSignaturesAPI.getUserSignatures()
      setEmailSignatures(signatures)
      // Auto-select default signature
      const defaultSig = signatures.find(s => s.is_default)
      if (defaultSig) {
        setSelectedSignatureId(defaultSig.id)
      }
    } catch (error) {
      console.error('Error loading email signatures:', error)
    }
  }

  const handleSignatureSelect = (signatureId: string) => {
    setSelectedSignatureId(signatureId)
    const signature = emailSignatures.find(s => s.id === signatureId)
    if (signature && composeData.body) {
      // Append signature to existing body
      setComposeData(prev => ({
        ...prev,
        body: prev.body + '\n\n' + signature.signature_html
      }))
    } else if (signature) {
      // Set signature as body if body is empty
      setComposeData(prev => ({
        ...prev,
        body: signature.signature_html
      }))
    }
  }

  const handleTemplateSelect = async (templateId: string) => {
    if (!templateId) {
      setSelectedTemplateId('')
      setTemplateVariables({})
      return
    }

    try {
      const template = await emailTemplatesAPI.getById(templateId)
      if (!template) return

      setSelectedTemplateId(templateId)
      
      // Initialize template variables with placeholder values
      const initialVars: Record<string, string> = {}
      template.variables?.forEach((v: any) => {
        initialVars[v.name] = ''
      })
      setTemplateVariables(initialVars)

      // Set subject from template
      setComposeData(prev => ({
        ...prev,
        subject: template.subject,
      }))
    } catch (error) {
      console.error('Error loading template:', error)
    }
  }

  const handleApplyTemplate = () => {
    if (!selectedTemplateId) return

    try {
      const template = emailTemplates.find(t => t.id === selectedTemplateId)
      if (!template) return

      const rendered = emailTemplatesAPI.render(template, templateVariables)
      
      setComposeData(prev => ({
        ...prev,
        subject: rendered.subject,
        body: rendered.html,
      }))

      // Increment usage counter
      emailTemplatesAPI.incrementUsage(selectedTemplateId).catch(console.error)
    } catch (error) {
      console.error('Error applying template:', error)
    }
  }

  // Handle tab change and update URL
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    // Use path-based navigation for cleaner URLs
    navigate(`/admin/emails/${tab}`, { replace: true })
    // Clear selections when switching tabs
    if (tab === 'sent') {
      setSelectedInboxIds(new Set())
    } else if (tab === 'inbox') {
      setSelectedSentIds(new Set())
    }
  }

  // Listen for location changes (browser back/forward)
  useEffect(() => {
    const tab = getInitialTab()
    if (tab !== activeTab) {
      setActiveTab(tab)
    }
  }, [location.pathname, location.hash])

  const loadData = async () => {
    setLoading(true)
    try {
      const [logsResult, statsResult] = await Promise.all([
        emailLogsAPI.getAll({
          page: currentPage,
          pageSize: 50,
          status: statusFilter || undefined,
          emailType: typeFilter || undefined,
          emailCategory: categoryFilter || undefined,
          search: searchQuery || undefined,
          startDate: dateRange.start || undefined,
          endDate: dateRange.end || undefined,
        }),
        emailLogsAPI.getStats({
          startDate: dateRange.start || undefined,
          endDate: dateRange.end || undefined,
        }),
      ])

      setEmailLogs(logsResult.data)
      setTotalCount(logsResult.count)
      setTotalPages(logsResult.totalPages)
      setStats(statsResult)
    } catch (error) {
      console.error('Error loading email data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadInboxEmails = async () => {
    setLoading(true)
    try {
      const result = await resendInboxAPI.list({
        limit: 50,
      })
      
      console.log('Admin Inbox - API Result:', result)
      console.log('Admin Inbox - Emails data:', result.data)
      console.log('Admin Inbox - Number of emails:', result.data?.length)
      
      if (result.data && result.data.length > 0) {
        console.log('Admin Inbox - Email TO addresses:', result.data.slice(0, 5).map(e => ({ 
          id: e.id, 
          to: e.to, 
          subject: e.subject,
          hasHtml: !!e.html,
          hasText: !!e.text,
          htmlLength: e.html?.length || 0,
          textLength: e.text?.length || 0,
        })))
      }
      
      // Get read email IDs from localStorage
      const getReadEmailIds = (): Set<string> => {
        try {
          const stored = localStorage.getItem('adminReadEmails')
          return stored ? new Set(JSON.parse(stored)) : new Set()
        } catch {
          return new Set()
        }
      }
      const readEmailIds = getReadEmailIds()
      
      // Enrich emails with sender details (name and avatar from DB)
      const enrichedEmails = await Promise.all(
        (result.data || []).map(async (email) => {
          const enriched: EnrichedReceivedEmail = { ...email }
          
          // Extract sender email
          const senderEmail = email.from.match(/<(.+?)>/)?.[1] || email.from
          
          // Try to get sender's full name and avatar from database
          try {
            const { data: userData, error } = await supabase
              .from('users')
              .select('id, first_name, middle_name, last_name, avatar_path')
              .eq('email', senderEmail)
              .maybeSingle()
            
            if (!error && userData) {
              const user = userData as any
              const nameParts = [
                user.first_name,
                user.middle_name,
                user.last_name
              ].filter(Boolean)
              enriched.senderName = nameParts.join(' ')
              
              if (user.avatar_path) {
                const avatarUrl = await getSignedFileUrl(String(user.avatar_path), 3600)
                if (avatarUrl) {
                  enriched.senderAvatar = avatarUrl
                }
              }
            }
          } catch (error) {
            console.error('Error fetching sender details:', error)
          }
          
          // Fallback to email display name or email prefix if no DB match
          if (!enriched.senderName) {
            enriched.senderName = email.from.includes('<') 
              ? email.from.split('<')[0].trim() 
              : email.from.split('@')[0]
          }
          
          // Check if email is read
          enriched.isRead = readEmailIds.has(email.id)
          
          return enriched
        })
      )
      
      setReceivedEmails(enrichedEmails)
      setInboxHasMore(result.has_more)
      
      // Update unread count in localStorage for sidebar badge
      // Count emails where isRead is false or undefined (treat undefined as unread)
      const unreadCount = enrichedEmails.filter(e => !e.isRead).length
      if (user?.id) {
        try {
          localStorage.setItem(`unreadEmailsCount_${user.id}`, JSON.stringify({
            count: unreadCount,
            timestamp: Date.now(),
          }))
          // Trigger event for sidebar to update
          window.dispatchEvent(new CustomEvent('emailsUpdated'))
        } catch (err) {
          // Ignore localStorage errors
          console.error('Error saving unread email count:', err)
        }
      }
    } catch (error: any) {
      console.error('Error loading inbox emails:', error)
      
      // Show appropriate error message based on error type
      let errorMessage = 'Failed to load inbox emails'
      
      if (error?.message?.includes('not configured') || error?.message?.includes('API key')) {
        errorMessage = 'Resend API key not configured. Please configure it in Admin Settings → Notifications.'
      } else if (error?.message?.includes('permission') || error?.message?.includes('denied')) {
        errorMessage = 'Permission denied to access inbox.'
      } else if (error?.message) {
        errorMessage = error.message
      }
      
      showToast(`❌ ${errorMessage}`, 'error')
      
      // Set empty state
      setReceivedEmails([])
      setInboxHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  const getEmailPreview = (html?: string, text?: string, maxLength: number = 80) => {
    if (text && text.trim()) {
      const cleaned = text.trim().replace(/\s+/g, ' ')
      return cleaned.substring(0, maxLength) + (cleaned.length > maxLength ? '...' : '')
    }
    if (html && html.trim()) {
      const stripped = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
      return stripped.substring(0, maxLength) + (stripped.length > maxLength ? '...' : '')
    }
    return ''
  }

  const markAdminEmailAsRead = (emailId: string) => {
    try {
      const stored = localStorage.getItem('adminReadEmails')
      const readIds = stored ? new Set(JSON.parse(stored)) : new Set<string>()
      readIds.add(emailId)
      localStorage.setItem('adminReadEmails', JSON.stringify(Array.from(readIds)))
      
      // Update email in state to mark as read
      setReceivedEmails(prev => prev.map(e => 
        e.id === emailId ? { ...e, isRead: true } : e
      ))
      
      // Update unread count
      if (user?.id) {
        const currentCount = receivedEmails.filter(e => e.id !== emailId && !e.isRead).length
        localStorage.setItem(`unreadEmailsCount_${user.id}`, JSON.stringify({
          count: currentCount,
          timestamp: Date.now(),
        }))
        window.dispatchEvent(new CustomEvent('emailsUpdated'))
      }
    } catch (error) {
      console.error('Error marking email as read:', error)
    }
  }

  const handleViewReceivedEmail = async (email: EnrichedReceivedEmail | ReceivedEmail) => {
    try {
      // Mark email as read
      markAdminEmailAsRead(email.id)
      
      // Check if email already has content (html/text)
      const hasContent = email.html || email.text
      
      console.log('Admin Inbox - Opening email:', {
        id: email.id,
        hasHtml: !!email.html,
        hasText: !!email.text,
        htmlLength: email.html?.length || 0,
        textLength: email.text?.length || 0,
      })
      
      // If email already has content from LIST API, use it directly
      if (hasContent) {
        console.log('Admin Inbox - Using content from LIST API')
        setSelectedReceivedEmail(email)
        return
      }
      
      // Otherwise, try to fetch full email content
      console.log('Admin Inbox - No content in LIST API, fetching full email for:', email.id)
      setLoading(true)
      
      try {
        const fullEmail = await resendInboxAPI.getById(email.id)
        
        console.log('Admin Inbox - Full email fetched:', {
          id: fullEmail.id,
          hasHtml: !!fullEmail.html,
          hasText: !!fullEmail.text,
          htmlLength: fullEmail.html?.length || 0,
          textLength: fullEmail.text?.length || 0,
        })
        
        // Merge the enriched data (sender info) with full email data
        const enrichedFullEmail: EnrichedReceivedEmail = {
          ...fullEmail,
          senderName: (email as EnrichedReceivedEmail).senderName,      // From list view
          senderAvatar: (email as EnrichedReceivedEmail).senderAvatar,  // From list view
        }
        
        setSelectedReceivedEmail(enrichedFullEmail)
      } catch (fetchError: any) {
        console.error('Error fetching full email:', fetchError)
        // If fetch fails, still show the email (even without content)
        // The user can see the metadata at least
        setSelectedReceivedEmail(email)
        
        // Only show error if the email really has no content
        if (!hasContent) {
          showToast(`⚠️ Email content unavailable. This may be a limitation of the email service.`, 'warning')
        }
      } finally {
        setLoading(false)
      }
    } catch (error: any) {
      console.error('Error loading email details:', error)
      // Fallback: show email anyway
      setSelectedReceivedEmail(email)
      setLoading(false)
    }
  }

  const handleDeleteSent = async (emailId: string, subject: string) => {
    setDeleteModal({
      isOpen: true,
      type: 'sent',
      emailId,
      emailSubject: subject
    })
  }

  const handleDeleteInbox = async (emailId: string, subject: string) => {
    if (!confirm(`Hide "${subject || '(no subject)'}"?\n\nNote: This will hide the email from your view. Resend does not support permanent deletion of received emails.`)) {
      return
    }

    try {
      await resendInboxAPI.delete(emailId)
      showToast('✅ Email hidden from inbox', 'success')
      
      // Remove from local state
      setReceivedEmails(prev => prev.filter(e => e.id !== emailId))
      
      // Remove from selection
      const newSelectedIds = new Set(selectedInboxIds)
      newSelectedIds.delete(emailId)
      setSelectedInboxIds(newSelectedIds)
      
      // Clear selection if viewing this email
      if (selectedReceivedEmail?.id === emailId) {
        setSelectedReceivedEmail(null)
      }
    } catch (error: any) {
      console.error('Error hiding inbox email:', error)
      showToast(`❌ Failed to hide email: ${error.message}`, 'error')
    }
  }

  const confirmDelete = async () => {
    if (!deleteModal.emailId) return

    try {
      if (deleteModal.type === 'sent') {
        await emailLogsAPI.delete(deleteModal.emailId)
        setSelectedSentIds(prev => {
          const next = new Set(prev)
          next.delete(deleteModal.emailId!)
          return next
        })
        loadData()
      } else {
        await resendInboxAPI.delete(deleteModal.emailId)
        setSelectedInboxIds(prev => {
          const next = new Set(prev)
          next.delete(deleteModal.emailId!)
          return next
        })
        loadInboxEmails()
      }
      
      setDeleteModal({ isOpen: false, type: 'sent', emailId: null, emailSubject: '' })
      showToast('Email deleted successfully', 'success')
    } catch (error) {
      console.error('Error deleting email:', error)
      showToast('Failed to delete email', 'error')
    }
  }

  const handleBulkDelete = async () => {
    const selectedIds = activeTab === 'sent' ? selectedSentIds : selectedInboxIds
    
    if (selectedIds.size === 0) {
      showToast('Please select at least one email to delete', 'warning')
      return
    }

    if (!confirm(`Are you sure you want to delete ${selectedIds.size} email(s)? This action cannot be undone.`)) {
      return
    }

    try {
      if (activeTab === 'sent') {
        await emailLogsAPI.bulkDelete(Array.from(selectedIds))
        setSelectedSentIds(new Set())
        loadData()
      } else {
        // Delete inbox emails one by one
        const errors: string[] = []
        for (const emailId of Array.from(selectedIds)) {
          try {
            await resendInboxAPI.delete(emailId)
          } catch (error) {
            console.error(`Failed to delete email ${emailId}:`, error)
            errors.push(emailId)
          }
        }
        
        setSelectedInboxIds(new Set())
        loadInboxEmails()
        
        if (errors.length > 0) {
          showToast(`Failed to delete ${errors.length} email(s). ${selectedIds.size - errors.length} deleted successfully.`, 'warning')
        } else {
          showToast(`${selectedIds.size} email(s) deleted successfully`, 'success')
        }
      }
    } catch (error) {
      console.error('Error deleting emails:', error)
      showToast('Failed to delete emails', 'error')
    }
  }

  const toggleSentSelection = (id: string) => {
    const newSelection = new Set(selectedSentIds)
    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      newSelection.add(id)
    }
    setSelectedSentIds(newSelection)
  }

  // Email Signatures functions
  const loadSignaturesData = async () => {
    try {
      setLoading(true)
      const sigs = await emailSignaturesAPI.getAll()
      setSignatures(sigs)
    } catch (error) {
      console.error('Error loading signatures:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSignature = () => {
    setEditingSignature({
      name: '',
      signature_html: '',
      signature_text: '',
      signature_type: 'personal',
      is_active: true,
      is_default: false,
    })
    setShowSignatureEditor(true)
  }

  const handleEditSignature = (signature: EmailSignature) => {
    setEditingSignature(signature)
    setShowSignatureEditor(true)
  }

  const handleSaveSignature = async () => {
    if (!editingSignature) return

    if (!editingSignature.name || !editingSignature.signature_html) {
      showToast('Please fill in name and HTML content', 'warning')
      return
    }

    try {
      if (editingSignature.id) {
        await emailSignaturesAPI.update(editingSignature.id, editingSignature)
        showToast('Signature updated successfully', 'success')
      } else {
        await emailSignaturesAPI.create(editingSignature)
        showToast('Signature created successfully', 'success')
      }
      setShowSignatureEditor(false)
      setEditingSignature(null)
      loadSignaturesData()
    } catch (error) {
      console.error('Error saving signature:', error)
      showToast('Failed to save signature', 'error')
    }
  }

  const handleDeleteSignature = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return

    try {
      await emailSignaturesAPI.delete(id)
      showToast('Signature deleted successfully', 'success')
      loadSignaturesData()
    } catch (error) {
      console.error('Error deleting signature:', error)
      showToast('Failed to delete signature', 'error')
    }
  }

  const handleSetDefaultSignature = async (id: string) => {
    try {
      await emailSignaturesAPI.setDefault(id)
      showToast('Default signature updated', 'success')
      loadSignaturesData()
    } catch (error) {
      console.error('Error setting default signature:', error)
      showToast('Failed to set default signature', 'error')
    }
  }

  // Email Setup functions
  const loadEmailSetupData = async () => {
    try {
      setLoading(true)
      const [addresses, logos] = await Promise.all([
        (async () => {
          const { emailAddressesAPI } = await import('@/lib/email-addresses-api')
          // Load ALL email addresses, not just admin ones, to show noreply and support
          return emailAddressesAPI.getAll()
        })(),
        businessLogosAPI.getAll().catch((error) => {
          // Handle missing table gracefully
          if ((error as any)?.code === 'PGRST205') {
            console.warn('business_logos table not found. Run database migrations to enable logo management.')
            return []
          }
          throw error
        }),
      ])
      setAdminEmailAddresses(addresses)
      setBusinessLogos(logos)
    } catch (error) {
      console.error('Error loading email setup data:', error)
      // Don't show toast here as this is called on mount and errors are expected if tables don't exist
    } finally {
      setLoading(false)
    }
  }

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>, logoType: BusinessLogo['logo_type']) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file', 'warning')
      return
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      showToast('File size must be less than 5MB', 'warning')
      return
    }

    try {
      setUploadingLogo(true)
      await businessLogosAPI.upload(file, logoType, file.name)
      showToast('Logo uploaded successfully', 'success')
      loadEmailSetupData()
      setShowLogoUpload(false)
    } catch (error: any) {
      console.error('Error uploading logo:', error)
      const errorMessage = error.message || 'Failed to upload logo'
      if (errorMessage.includes('Bucket not found')) {
        showToast('Storage bucket not configured. Please run database migrations.', 'error')
      } else {
        showToast(errorMessage, 'error')
      }
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleEditEmail = (email: any) => {
    setEditingEmail(email)
    setShowEmailEditor(true)
  }

  const handleSaveEmail = async () => {
    if (!editingEmail) return

    try {
      const { emailAddressesAPI } = await import('@/lib/email-addresses-api')
      await emailAddressesAPI.update(editingEmail.id, {
        display_name: editingEmail.display_name,
        department: editingEmail.department,
        can_send: editingEmail.can_send,
        can_receive: editingEmail.can_receive,
        is_active: editingEmail.is_active,
        metadata: editingEmail.metadata || {},
      })
      showToast('Email address updated successfully', 'success')
      setShowEmailEditor(false)
      setEditingEmail(null)
      loadEmailSetupData()
    } catch (error) {
      console.error('Error updating email address:', error)
      showToast('Failed to update email address', 'error')
    }
  }

  const handleAddEmail = async () => {
    if (!newEmailData.email_address) {
      showToast('Please enter an email address', 'warning')
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmailData.email_address)) {
      showToast('Please enter a valid email address', 'warning')
      return
    }

    try {
      const { emailAddressesAPI } = await import('@/lib/email-addresses-api')
      
      // Check if email already exists
      const existingEmail = await emailAddressesAPI.getByEmail(newEmailData.email_address.toLowerCase())
      if (existingEmail) {
        showToast(`Email address "${newEmailData.email_address}" already exists in the system. Please use a different email address.`, 'warning')
        return
      }

      await emailAddressesAPI.create({
        ...newEmailData,
        email_address: newEmailData.email_address.toLowerCase(), // Normalize to lowercase
        is_system_address: true,
        is_active: true,
        is_verified: false,
      })
      showToast('Email address added successfully', 'success')
      setShowAddEmailModal(false)
      setNewEmailData({
        email_address: '',
        display_name: '',
        address_type: 'admin',
        department: '',
        can_send: true,
        can_receive: true,
      })
      loadEmailSetupData()
    } catch (error: any) {
      console.error('Error adding email address:', error)
      
      // Handle specific error cases
      if (error?.code === '23505' || error?.message?.includes('duplicate key') || error?.message?.includes('unique constraint')) {
        showToast(`Email address "${newEmailData.email_address}" already exists in the system. Please use a different email address.`, 'warning')
      } else if (error?.message) {
        showToast(`Failed to add email address: ${error.message}`, 'error')
      } else {
        showToast('Failed to add email address. Please try again.', 'error')
      }
    }
  }

  const handleDeleteEmail = async (id: string, emailAddress: string) => {
    if (!confirm(`Are you sure you want to delete "${emailAddress}"? This action cannot be undone.`)) {
      return
    }

    try {
      const { emailAddressesAPI } = await import('@/lib/email-addresses-api')
      await emailAddressesAPI.delete(id)
      showToast('Email address deleted successfully', 'success')
      loadEmailSetupData()
    } catch (error) {
      console.error('Error deleting email address:', error)
      showToast('Failed to delete email address', 'error')
    }
  }

  const handleAssignLogo = async (emailId: string, logoId: string | null) => {
    try {
      const { emailAddressesAPI } = await import('@/lib/email-addresses-api')
      const email = await emailAddressesAPI.getById(emailId)
      const updatedMetadata = {
        ...(email.metadata || {}),
        logo_id: logoId,
      }
      await emailAddressesAPI.update(emailId, { metadata: updatedMetadata })
      showToast('Logo assigned successfully', 'success')
      loadEmailSetupData()
    } catch (error) {
      console.error('Error assigning logo:', error)
      showToast('Failed to assign logo', 'error')
    }
  }

  const getEmailLogo = (email: any): BusinessLogo | null => {
    if (!email || !businessLogos || businessLogos.length === 0) return null
    
    // Handle metadata that might be a string or object
    let metadata = email.metadata
    if (!metadata) return null
    
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata)
      } catch {
        return null
      }
    }
    
    const logoId = metadata?.logo_id
    if (!logoId) return null
    
    // Find the logo and ensure it's an avatar
    const logo = businessLogos.find((logo) => logo.id === logoId && logo.logo_type === 'avatar')
    return logo || null
  }

  // Get avatar for an email address string (for inbox/sent emails)
  const getAvatarForEmail = (emailAddress: string): BusinessLogo | null => {
    // Extract email from string (handle formats like "Name <email@domain.com>" or just "email@domain.com")
    const emailMatch = emailAddress.match(/<([^>]+)>/) || [emailAddress]
    const cleanEmail = emailMatch[1] || emailMatch[0]
    
    // Find matching email address in adminEmailAddresses
    const emailAddr = adminEmailAddresses.find(
      addr => addr.email_address.toLowerCase() === cleanEmail.toLowerCase()
    )
    
    if (!emailAddr) return null
    
    // Get logo from email address metadata
    const logoId = emailAddr.metadata?.logo_id
    if (!logoId) return null
    
    return businessLogos.find((logo) => logo.id === logoId) || null
  }

  const toggleInboxSelection = (id: string) => {
    const newSelection = new Set(selectedInboxIds)
    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      newSelection.add(id)
    }
    setSelectedInboxIds(newSelection)
  }

  const toggleSelectAllSent = () => {
    if (selectedSentIds.size === emailLogs.length) {
      setSelectedSentIds(new Set())
    } else {
      setSelectedSentIds(new Set(emailLogs.map(log => log.id)))
    }
  }

  const toggleSelectAllInbox = () => {
    if (selectedInboxIds.size === receivedEmails.length) {
      setSelectedInboxIds(new Set())
    } else {
      setSelectedInboxIds(new Set(receivedEmails.map(email => email.id)))
    }
  }

  // Convert plain text to HTML, preserving formatting for business letters
  const convertTextToHtml = (text: string): string => {
    if (!text) return ''
    
    // Check if the text already contains HTML tags
    if (/<[a-z][\s\S]*>/i.test(text)) {
      // Already HTML, return as-is
      return text
    }
    
    // Escape HTML special characters
    const escapeHtml = (str: string) => {
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      }
      return str.replace(/[&<>"']/g, (m) => map[m])
    }
    
    // Split text into lines
    const lines = text.split(/\n/)
    const htmlLines: string[] = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmedLine = line.trim()
      
      if (trimmedLine === '') {
        // Empty line - add a paragraph break for spacing
        htmlLines.push('<p>&nbsp;</p>')
      } else {
        // Non-empty line - escape and preserve
        const escapedLine = escapeHtml(trimmedLine)
        // Use paragraph tags for proper email formatting
        htmlLines.push(`<p style="margin: 0 0 12px 0;">${escapedLine}</p>`)
      }
    }
    
    // Wrap in a proper email-friendly HTML structure with inline styles
    // Inline styles are required for email clients like Gmail
    return `
      <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; color: #333333; max-width: 600px;">
        ${htmlLines.join('\n        ')}
      </div>
    `.trim()
  }

  const handleSendEmail = async () => {
    if (!composeData.to || !composeData.subject || !composeData.body) {
      showToast('Please fill in all required fields', 'warning')
      return
    }

    setSending(true)
    try {
      // Convert plain text to HTML format for proper email formatting
      const htmlBody = convertTextToHtml(composeData.body)
      
      const success = await sendEmailWithLogging({
        to: composeData.to,
        toName: composeData.toName,
        subject: composeData.subject,
        html: htmlBody,
        emailType: composeData.emailType,
        emailCategory: composeData.category,
        tags: composeData.tags,
        fromEmailAddressId: composeData.fromEmailAddressId || undefined,
        replyTo: composeData.replyTo || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      })

      if (success) {
        showToast('Email sent successfully!', 'success')
        setComposing(false)
        setAttachments([])
        setComposeData({
          to: '',
          toName: '',
          subject: '',
          body: '',
          emailType: 'manual',
          category: 'custom',
          tags: [],
          fromEmailAddressId: adminEmailAddresses[0]?.id || '',
          replyTo: '',
        })
        loadData()
      } else {
        showToast('Failed to send email. Please check your email configuration.', 'error')
      }
    } catch (error) {
      console.error('Error sending email:', error)
      showToast('Failed to send email', 'error')
    } finally {
      setSending(false)
    }
  }

  const handleFileAdd = (files: File[]) => {
    const newFiles = Array.from(files)
    setAttachments(prev => [...prev, ...newFiles])
  }

  const handleFileRemove = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const clearFilters = () => {
    setSearchQuery('')
    setStatusFilter('')
    setTypeFilter('')
    setCategoryFilter('')
    setDateRange({ start: '', end: '' })
    setCurrentPage(1)
  }

  const exportToCSV = () => {
    const headers = ['Date', 'Recipient', 'Subject', 'Status', 'Type', 'Category']
    const rows = emailLogs.map(log => [
      format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      log.recipient_email,
      log.subject,
      log.status,
      log.email_type,
      log.email_category || '',
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `email-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  if (!isAdmin()) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-4 md:p-8">
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400">
                Access denied. Admin privileges required.
              </p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                  <Mail className="h-8 w-8 text-primary-600" />
                  Email Management
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Enterprise email system with analytics and tracking
                </p>
              </div>
              <button
                onClick={() => setComposing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
                Compose Email
              </button>
            </div>
          </div>

          {/* Stats Cards - Email Management Analytics */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Emails</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                      {stats.total.toLocaleString()}
                    </p>
                  </div>
                  <Mail className="h-10 w-10 text-blue-500" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Delivered</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">
                      {stats.delivered.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{stats.deliveryRate}% rate</p>
                  </div>
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Failed</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">
                      {stats.failed.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{stats.failureRate}% rate</p>
                  </div>
                  <XCircle className="h-10 w-10 text-red-500" />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Avg Send Time</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                      {stats.avgSendTime.toFixed(1)}s
                    </p>
                  </div>
                  <Activity className="h-10 w-10 text-purple-500" />
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex -mb-px">
                <button
                  onClick={() => handleTabChange('inbox')}
                  className={cn(
                    'px-6 py-4 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'inbox'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  <Mail className="h-4 w-4 inline-block mr-2" />
                  Inbox
                </button>
                <button
                  onClick={() => handleTabChange('sent')}
                  className={cn(
                    'px-6 py-4 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'sent'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  <Send className="h-4 w-4 inline-block mr-2" />
                  Sent Items
                </button>
                <button
                  onClick={() => handleTabChange('templates')}
                  className={cn(
                    'px-6 py-4 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'templates'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  <FileText className="h-4 w-4 inline-block mr-2" />
                  Templates
                </button>
                <button
                  onClick={() => handleTabChange('signatures')}
                  className={cn(
                    'px-6 py-4 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'signatures'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  <PenTool className="h-4 w-4 inline-block mr-2" />
                  Signatures
                </button>
                <button
                  onClick={() => handleTabChange('email-setup')}
                  className={cn(
                    'px-6 py-4 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'email-setup'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  <Settings className="h-4 w-4 inline-block mr-2" />
                  Email Setup
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {/* Sent Items Tab */}
              {activeTab === 'sent' && (
                    <>
                      {/* Bulk Actions Toolbar */}
                      {selectedSentIds.size > 0 && (
                        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
                          <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            {selectedSentIds.size} email(s) selected
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSelectedSentIds(new Set())}
                              className="px-3 py-1.5 text-sm text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100"
                            >
                              Clear Selection
                            </button>
                            <button
                              onClick={handleBulkDelete}
                              className="flex items-center gap-2 px-4 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete Selected
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Filters and Search */}
                      <div className="mb-6 space-y-4">
                        <div className="flex flex-wrap gap-4">
                          <div className="flex-1 min-w-[300px]">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Search by email, subject, or name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700"
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <Filter className="h-5 w-5" />
                            Filters
                          </button>
                          <button
                            onClick={exportToCSV}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <Download className="h-5 w-5" />
                            Export
                          </button>
                          <button
                            onClick={loadData}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <RefreshCw className="h-5 w-5" />
                            Refresh
                          </button>
                        </div>

                        {/* Advanced Filters */}
                        {showFilters && (
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div>
                              <label className="block text-sm font-medium mb-2">Status</label>
                              <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                              >
                                <option value="">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="sent">Sent</option>
                                <option value="delivered">Delivered</option>
                                <option value="failed">Failed</option>
                                <option value="bounced">Bounced</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Type</label>
                              <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                              >
                                <option value="">All Types</option>
                                <option value="transactional">Transactional</option>
                                <option value="notification">Notification</option>
                                <option value="marketing">Marketing</option>
                                <option value="manual">Manual</option>
                                <option value="automated">Automated</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Start Date</label>
                              <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">End Date</label>
                              <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                              />
                            </div>
                            <div className="col-span-full flex justify-end">
                              <button
                                onClick={clearFilters}
                                className="text-sm text-primary-600 hover:text-primary-700"
                              >
                                Clear all filters
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Email List */}
                      {loading ? (
                        <div className="py-12">
                          <Loading text="Loading emails..." />
                        </div>
                      ) : emailLogs.length === 0 ? (
                        <div className="text-center py-12">
                          <Mail className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600 dark:text-gray-400">No emails found</p>
                        </div>
                      ) : (
                        <>
                          {/* Gmail-style Compact Email List */}
                          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                            {/* Table Header */}
                            <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                              <div className="flex items-center px-2 py-2">
                                <div className="w-10 sm:w-12 flex items-center justify-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedSentIds.size === emailLogs.length && emailLogs.length > 0}
                                    onChange={toggleSelectAllSent}
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                  />
                                </div>
                                <div className="flex-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                  {selectedSentIds.size > 0 ? `${selectedSentIds.size} selected` : 'Sent Items'}
                                </div>
                              </div>
                            </div>

                            {/* Email Rows */}
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                              {emailLogs.map((log) => (
                                <div
                                  key={log.id}
                                  className="group relative flex flex-col sm:flex-row sm:items-center px-2 py-2 hover:shadow-sm transition-all cursor-pointer border-l-4 border-transparent hover:border-l-primary-500 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                  onClick={(e) => {
                                    if ((e.target as HTMLElement).closest('input[type="checkbox"]') || 
                                        (e.target as HTMLElement).closest('button')) {
                                      return
                                    }
                                    setSelectedEmail(log)
                                  }}
                                >
                                  {/* Mobile/Tablet Layout */}
                                  <div className="flex items-start sm:items-center flex-1 min-w-0">
                                    {/* Checkbox */}
                                    <div className="w-10 sm:w-12 flex items-center justify-center flex-shrink-0 pt-1 sm:pt-0" onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="checkbox"
                                        checked={selectedSentIds.has(log.id)}
                                        onChange={() => toggleSentSelection(log.id)}
                                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                      />
                                    </div>

                                    {/* Avatar */}
                                    <div className="w-10 h-10 flex-shrink-0 mr-2 sm:mr-3">
                                      {(() => {
                                        const avatar = getAvatarForEmail(log.sender_email);
                                        return avatar ? (
                                          <img
                                            src={avatar.public_url}
                                            alt={avatar.alt_text || 'Avatar'}
                                            className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                                          />
                                        ) : (
                                          <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center border-2 border-gray-200 dark:border-gray-700">
                                            <Mail className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                                          </div>
                                        );
                                      })()}
                                    </div>

                                    {/* Content Area */}
                                    <div className="flex-1 min-w-0 pr-2">
                                      {/* Recipient & Status (Mobile: stacked, Desktop: inline) */}
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 mb-1 sm:mb-0">
                                        <div className="sm:w-40 flex-shrink-0 sm:px-2">
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[160px] sm:max-w-none">
                                              {(() => {
                                                const recipient = log.recipient_name || log.recipient_email.split('@')[0];
                                                return recipient.length > 20 ? recipient.substring(0, 20) + '...' : recipient;
                                              })()}
                                            </span>
                                            {/* Status Icon (Mobile: inline with recipient) */}
                                            <span className="sm:hidden">
                                              {log.status === 'delivered' || log.status === 'sent' ? (
                                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                              ) : log.status === 'pending' ? (
                                                <Clock className="h-3.5 w-3.5 text-yellow-600" />
                                              ) : (
                                                <XCircle className="h-3.5 w-3.5 text-red-600" />
                                              )}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Subject & Preview */}
                                        <div className="flex-1 min-w-0 sm:px-2">
                                          <div className="flex items-center gap-1">
                                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                              {(log.subject && log.subject.length > 40 ? log.subject.substring(0, 40) + '...' : log.subject) || '(no subject)'}
                                            </span>
                                            <span className="hidden lg:inline text-sm text-gray-500 dark:text-gray-400 truncate ml-1">
                                              - {getEmailPreview(log.body_html || undefined, log.body_text || undefined, 50)}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Status & Indicators (Desktop only) */}
                                        <div className="hidden sm:flex items-center gap-2 flex-shrink-0 px-2">
                                          {log.status === 'delivered' || log.status === 'sent' ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                                          ) : log.status === 'pending' ? (
                                            <Clock className="h-4 w-4 text-yellow-600" />
                                          ) : (
                                            <XCircle className="h-4 w-4 text-red-600" />
                                          )}
                                        </div>
                                      </div>

                                      {/* Mobile: Date Row */}
                                      <div className="flex items-center justify-between sm:hidden text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        <span>
                                          {format(new Date(log.created_at), 'MMM d, h:mm a')}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Desktop: Date & Actions */}
                                  <div className="hidden sm:flex items-center gap-2">
                                    <div className="w-28 text-right px-2 flex-shrink-0">
                                      <div className="text-xs text-gray-600 dark:text-gray-400">
                                        {format(new Date(log.created_at), 'MMM d')}
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-500">
                                        {format(new Date(log.created_at), 'h:mm a')}
                                      </div>
                                    </div>

                                    <div className="w-10 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        onClick={() => handleDeleteSent(log.id, log.subject || '(no subject)')}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 transition-opacity"
                                        title="Delete"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Mobile: Delete Button (Always visible) */}
                                  <div className="sm:hidden absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={() => handleDeleteSent(log.id, log.subject || '(no subject)')}
                                      className="p-1.5 text-gray-400 hover:text-red-600 active:text-red-700"
                                      title="Delete"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Pagination */}
                          {totalPages > 1 && (
                            <div className="mt-6 flex items-center justify-between">
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Showing {(currentPage - 1) * 50 + 1} to{' '}
                            {Math.min(currentPage * 50, totalCount)} of {totalCount} emails
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                              disabled={currentPage === 1}
                              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Previous
                            </button>
                            <div className="flex items-center gap-2">
                              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const page = i + 1
                                return (
                                  <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={cn(
                                      'px-4 py-2 border rounded-lg',
                                      currentPage === page
                                        ? 'bg-primary-600 text-white border-primary-600'
                                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    )}
                                  >
                                    {page}
                                  </button>
                                )
                              })}
                            </div>
                            <button
                              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                              disabled={currentPage === totalPages}
                              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Next
                            </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                </>
              )}

              {/* Inbox Tab */}
              {activeTab === 'inbox' && (
                    <>
                      {/* Bulk Actions Toolbar */}
                      {selectedInboxIds.size > 0 && (
                        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
                          <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            {selectedInboxIds.size} email(s) selected
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSelectedInboxIds(new Set())}
                              className="px-3 py-1.5 text-sm text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100"
                            >
                              Clear Selection
                            </button>
                            <button
                              onClick={handleBulkDelete}
                              className="flex items-center gap-2 px-4 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete Selected
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Search and Filters */}
                      <div className="mb-6 space-y-4">
                        <div className="flex flex-wrap gap-4">
                          <div className="flex-1 min-w-[300px]">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Search inbox by sender, subject..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700"
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <Filter className="h-5 w-5" />
                            Filters
                          </button>
                          <button
                            onClick={() => {
                              // Export inbox emails to CSV
                              const headers = ['Date', 'From', 'To', 'Subject', 'Message ID']
                              const rows = receivedEmails.map(email => [
                                format(new Date(email.created_at), 'yyyy-MM-dd HH:mm:ss'),
                                email.from,
                                email.to.join('; '),
                                email.subject,
                                email.message_id || '',
                              ])
                              const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
                              const blob = new Blob([csv], { type: 'text/csv' })
                              const url = window.URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `inbox-emails-${format(new Date(), 'yyyy-MM-dd')}.csv`
                              a.click()
                            }}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <Download className="h-5 w-5" />
                            Export
                          </button>
                          <button
                            onClick={loadInboxEmails}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <RefreshCw className="h-5 w-5" />
                            Refresh
                          </button>
                        </div>

                        {/* Advanced Filters */}
                        {showFilters && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div>
                              <label className="block text-sm font-medium mb-2">Sender</label>
                              <input
                                type="text"
                                placeholder="Filter by sender..."
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Start Date</label>
                              <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">End Date</label>
                              <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                              />
                            </div>
                            <div className="col-span-full flex justify-end">
                              <button
                                onClick={clearFilters}
                                className="text-sm text-primary-600 hover:text-primary-700"
                              >
                                Clear all filters
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Email List */}
                      {loading ? (
                        <div className="py-12">
                          <Loading text="Loading inbox..." />
                        </div>
                      ) : receivedEmails.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-12 text-center">
                          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/20 mb-4">
                            <Mail className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                          </div>
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                            No Received Messages
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-6">
                            Your inbox is empty. Emails received via Resend will appear here.
                          </p>
                          <div className="text-left max-w-2xl mx-auto bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
                              📧 Setup Resend Email Receiving
                            </h4>
                            <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                              To receive emails, configure Resend with these steps:
                            </p>
                            <ol className="list-decimal list-inside text-sm text-blue-700 dark:text-blue-300 space-y-2 mb-4">
                              <li>Go to <button onClick={() => navigate('/admin/settings')} className="font-semibold underline hover:text-blue-900 dark:hover:text-blue-100">Admin Settings → Notifications</button></li>
                              <li>Enter your Resend API key in the email configuration</li>
                              <li>Configure your domain in <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-900 dark:hover:text-blue-100">Resend Dashboard</a></li>
                              <li>Set up inbound email routing rules in Resend</li>
                              <li>Forward emails to your verified domains</li>
                            </ol>
                            <div className="flex gap-3">
                              <button
                                onClick={() => navigate('/admin/settings')}
                                className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                              >
                                ⚙️ Go to Settings
                              </button>
                              <a
                                href="https://resend.com/docs/api-reference/emails/list-received-emails"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm px-4 py-2 border-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 font-medium transition-colors inline-block"
                              >
                                📚 View Documentation
                              </a>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Gmail-style Compact Email List */}
                          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                            {/* Table Header */}
                            <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                              <div className="flex items-center px-2 py-2">
                                <div className="w-10 sm:w-12 flex items-center justify-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedInboxIds.size === receivedEmails.length && receivedEmails.length > 0}
                                    onChange={toggleSelectAllInbox}
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                  />
                                </div>
                                <div className="flex-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                  {selectedInboxIds.size > 0 ? `${selectedInboxIds.size} selected` : 'Inbox'}
                                </div>
                              </div>
                            </div>

                            {/* Email Rows */}
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                              {receivedEmails.map((email) => (
                                <div
                                  key={email.id}
                                  className="group relative flex flex-col sm:flex-row sm:items-center px-2 py-2 hover:shadow-sm transition-all cursor-pointer border-l-4 border-transparent hover:border-l-primary-500 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                  onClick={(e) => {
                                    if ((e.target as HTMLElement).closest('input[type="checkbox"]') || 
                                        (e.target as HTMLElement).closest('button')) {
                                      return
                                    }
                                    handleViewReceivedEmail(email)
                                  }}
                                >
                                  {/* Mobile/Tablet Layout */}
                                  <div className="flex items-start sm:items-center flex-1 min-w-0">
                                    {/* Checkbox */}
                                    <div className="w-10 sm:w-12 flex items-center justify-center flex-shrink-0 pt-1 sm:pt-0" onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="checkbox"
                                        checked={selectedInboxIds.has(email.id)}
                                        onChange={() => toggleInboxSelection(email.id)}
                                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                      />
                                    </div>

                                    {/* Avatar - Gmail Style */}
                                    <div className="w-10 h-10 flex-shrink-0 mr-2 sm:mr-3">
                                      {(() => {
                                        const enrichedEmail = email as EnrichedReceivedEmail
                                        // Use sender avatar if available
                                        if (enrichedEmail.senderAvatar) {
                                          return (
                                            <img
                                              src={enrichedEmail.senderAvatar}
                                              alt={enrichedEmail.senderName || 'Avatar'}
                                              className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                                            />
                                          )
                                        }
                                        // Fallback to business logo if available
                                        const avatar = getAvatarForEmail(email.from)
                                        if (avatar) {
                                          return (
                                            <img
                                              src={avatar.public_url}
                                              alt={avatar.alt_text || 'Avatar'}
                                              className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                                            />
                                          )
                                        }
                                        // Show sender initial in colored circle
                                        const senderName = enrichedEmail.senderName || (email.from.includes('<') 
                                          ? email.from.split('<')[0].trim() 
                                          : email.from.split('@')[0])
                                        const initial = (senderName[0] || 'U').toUpperCase()
                                        // Generate consistent color based on sender
                                        const colors = [
                                          'from-purple-500 to-pink-600',
                                          'from-blue-500 to-cyan-600',
                                          'from-green-500 to-emerald-600',
                                          'from-orange-500 to-red-600',
                                          'from-indigo-500 to-purple-600',
                                          'from-pink-500 to-rose-600',
                                          'from-teal-500 to-green-600',
                                          'from-yellow-500 to-orange-600',
                                        ]
                                        const colorIndex = initial.charCodeAt(0) % colors.length
                                        return (
                                          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${colors[colorIndex]} flex items-center justify-center text-white font-semibold text-sm shadow-sm`}>
                                            {initial}
                                          </div>
                                        )
                                      })()}
                                    </div>

                                    {/* Content Area */}
                                    <div className="flex-1 min-w-0 pr-2">
                                      {/* Sender & Attachment Icon (Mobile: stacked, Desktop: inline) */}
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 mb-1 sm:mb-0">
                                        <div className="sm:w-40 flex-shrink-0 sm:px-2">
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[160px] sm:max-w-none">
                                              {(() => {
                                                const enrichedEmail = email as EnrichedReceivedEmail
                                                const sender = enrichedEmail.senderName || (email.from.includes('<') ? email.from.split('<')[0].trim() : email.from.split('@')[0])
                                                return sender.length > 20 ? sender.substring(0, 20) + '...' : sender
                                              })()}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Subject & Preview */}
                                        <div className="flex-1 min-w-0 sm:px-2">
                                          <div className="flex items-center gap-1">
                                            {email.attachments && email.attachments.length > 0 && (
                                              <Paperclip className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                            )}
                                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                              {(email.subject && email.subject.length > 40 ? email.subject.substring(0, 40) + '...' : email.subject) || '(no subject)'}
                                            </span>
                                            {(() => {
                                              const preview = getEmailPreview(email.html, email.text, 50)
                                              return preview ? (
                                                <span className="hidden lg:inline text-sm text-gray-500 dark:text-gray-400 truncate ml-1">
                                                  - {preview}
                                                </span>
                                              ) : null
                                            })()}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Mobile: Date Row */}
                                      <div className="flex items-center justify-between sm:hidden text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {email.attachments && email.attachments.length > 0 && (
                                          <span className="text-xs text-gray-500">
                                            {email.attachments.length} attachment{email.attachments.length > 1 ? 's' : ''}
                                          </span>
                                        )}
                                        <span className={email.attachments && email.attachments.length > 0 ? '' : 'ml-auto'}>
                                          {format(new Date(email.created_at), 'MMM d, h:mm a')}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Desktop: Date & Actions */}
                                  <div className="hidden sm:flex items-center gap-2">
                                    <div className="w-28 text-right px-2 flex-shrink-0">
                                      <div className="text-xs text-gray-600 dark:text-gray-400">
                                        {format(new Date(email.created_at), 'MMM d')}
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-500">
                                        {format(new Date(email.created_at), 'h:mm a')}
                                      </div>
                                    </div>

                                    <div className="w-10 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        onClick={() => handleDeleteInbox(email.id, email.subject || '(no subject)')}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 transition-opacity"
                                        title="Delete"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Mobile: Delete Button (Always visible) */}
                                  <div className="sm:hidden absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={() => handleDeleteInbox(email.id, email.subject || '(no subject)')}
                                      className="p-1.5 text-gray-400 hover:text-red-600 active:text-red-700"
                                      title="Delete"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Load More */}
                          {inboxHasMore && (
                            <div className="mt-6 flex justify-center">
                              <button
                                onClick={loadInboxEmails}
                                className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                              >
                                Load More Emails
                              </button>
                            </div>
                          )}
                        </>
                      )}
                </>
              )}

              {/* Templates Tab */}
              {activeTab === 'templates' && <EmailTemplatesManager />}

              {/* Signatures Tab */}
              {activeTab === 'signatures' && (
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
                      onClick={handleCreateSignature}
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
                        onClick={handleCreateSignature}
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
                              dangerouslySetInnerHTML={{ __html: sig.signature_html }} 
                              className="text-sm"
                            />
                          </div>

                          {/* Actions */}
                          <div className="p-4 flex gap-2">
                            <button
                              onClick={() => handleEditSignature(sig)}
                              className="flex-1 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 font-medium flex items-center justify-center gap-1"
                            >
                              <Edit className="h-4 w-4" />
                              Edit
                            </button>
                            {!sig.is_default && (
                              <button
                                onClick={() => handleSetDefaultSignature(sig.id)}
                                className="px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                                title="Set as default"
                              >
                                <Star className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteSignature(sig.id, sig.name)}
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
              )}

              {/* Email Setup Tab */}
              {activeTab === 'email-setup' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Email Setup</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                      Manage admin business emails and official logos
                    </p>
                  </div>

                  {loading ? (
                    <div className="text-center py-12">
                      <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
                      <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {/* Business Emails Section */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Admin Business Emails
                          </h3>
                          <button
                            onClick={() => setShowAddEmailModal(true)}
                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            Add Email Address
                          </button>
                        </div>

                        {adminEmailAddresses.length === 0 ? (
                          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
                            <Mail className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">No Business Emails</h4>
                            <p className="text-gray-500 dark:text-gray-400 mb-4">Add your first admin business email address</p>
                            <button
                              onClick={() => setShowAddEmailModal(true)}
                              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                            >
                              Add Email Address
                            </button>
                          </div>
                        ) : (
                          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                  <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                      Email Address
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                      Display Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                      Avatar
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                      Type
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                      Department
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                      Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                      Capabilities
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                      Actions
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                  {adminEmailAddresses.map((email) => (
                                    <tr key={email.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                          <Mail className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {email.email_address}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-sm text-gray-900 dark:text-gray-100">
                                          {email.display_name || '-'}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        {(() => {
                                          const avatar = getEmailLogo(email)
                                          return avatar && avatar.public_url ? (
                                            <img
                                              src={avatar.public_url}
                                              alt={avatar.alt_text || 'Avatar'}
                                              className="h-8 w-8 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                                              onError={(e) => {
                                                // Fallback if image fails to load
                                                e.currentTarget.style.display = 'none'
                                              }}
                                            />
                                          ) : (
                                            <button
                                              onClick={() => handleEditEmail(email)}
                                              className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                                              title="Click to assign avatar"
                                            >
                                              Assign
                                            </button>
                                          )
                                        })()}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 capitalize">
                                          {email.address_type}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                                          {email.department || '-'}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                          {email.is_verified && (
                                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 flex items-center gap-1">
                                              <CheckCircle2 className="h-3 w-3" />
                                              Verified
                                            </span>
                                          )}
                                          {email.is_active ? (
                                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                                              Active
                                            </span>
                                          ) : (
                                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 flex items-center gap-1">
                                              <EyeOff className="h-3 w-3" />
                                              Inactive
                                            </span>
                                          )}
                                          {email.is_primary && (
                                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 flex items-center gap-1">
                                              <Star className="h-3 w-3" fill="currentColor" />
                                              Primary
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                          {email.can_send && (
                                            <span className="px-2 py-1 text-xs rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                                              Send
                                            </span>
                                          )}
                                          {email.can_receive && (
                                            <span className="px-2 py-1 text-xs rounded bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">
                                              Receive
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end gap-2">
                                          <button
                                            onClick={() => handleEditEmail(email)}
                                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                            title="Edit"
                                          >
                                            <Edit className="h-4 w-4" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteEmail(email.id, email.email_address)}
                                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                            title="Delete"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Add Email Address Modal */}
          {showAddEmailModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Add Email Address</h3>
                  <button
                    onClick={() => {
                      setShowAddEmailModal(false)
                      setNewEmailData({
                        email_address: '',
                        display_name: '',
                        address_type: 'admin',
                        department: '',
                        can_send: true,
                        can_receive: true,
                      })
                    }}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={newEmailData.email_address}
                      onChange={(e) => setNewEmailData({ ...newEmailData, email_address: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      placeholder="e.g., support@gritsync.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={newEmailData.display_name}
                      onChange={(e) => setNewEmailData({ ...newEmailData, display_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      placeholder="e.g., GritSync Support"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Address Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newEmailData.address_type}
                      onChange={(e) => setNewEmailData({ ...newEmailData, address_type: e.target.value as any })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    >
                      <option value="admin">Admin</option>
                      <option value="support">Support</option>
                      <option value="noreply">No Reply</option>
                      <option value="department">Department</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      value={newEmailData.department}
                      onChange={(e) => setNewEmailData({ ...newEmailData, department: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      placeholder="e.g., Support, Sales, Admin"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="can_send_new"
                        checked={newEmailData.can_send}
                        onChange={(e) => setNewEmailData({ ...newEmailData, can_send: e.target.checked })}
                        className="rounded border-gray-300 text-primary-600"
                      />
                      <label htmlFor="can_send_new" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Can Send Emails
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="can_receive_new"
                        checked={newEmailData.can_receive}
                        onChange={(e) => setNewEmailData({ ...newEmailData, can_receive: e.target.checked })}
                        className="rounded border-gray-300 text-primary-600"
                      />
                      <label htmlFor="can_receive_new" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Can Receive Emails
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-end p-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => {
                      setShowAddEmailModal(false)
                      setNewEmailData({
                        email_address: '',
                        display_name: '',
                        address_type: 'admin',
                        department: '',
                        can_send: true,
                        can_receive: true,
                      })
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddEmail}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Email Address
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Email Editor Modal */}
          {showEmailEditor && editingEmail && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Edit Email Address</h3>
                  <button
                    onClick={() => {
                      setShowEmailEditor(false)
                      setEditingEmail(null)
                    }}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={editingEmail.email_address}
                      disabled
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white bg-gray-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">Email address cannot be changed</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={editingEmail.display_name || ''}
                      onChange={(e) => setEditingEmail({ ...editingEmail, display_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      placeholder="e.g., GritSync Office"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      value={editingEmail.department || ''}
                      onChange={(e) => setEditingEmail({ ...editingEmail, department: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      placeholder="e.g., Office, Support, Admin"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Assign Avatar
                      </label>
                      <label className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg cursor-pointer transition-colors">
                        <Upload className="h-4 w-4" />
                        <span>Upload Avatar</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              handleLogoUpload(e as any, 'avatar' as BusinessLogo['logo_type'])
                              // Reset input so same file can be selected again
                              e.target.value = ''
                            }
                          }}
                          className="hidden"
                          disabled={uploadingLogo}
                        />
                      </label>
                    </div>
                    {uploadingLogo && (
                      <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                        <span className="text-sm text-blue-700 dark:text-blue-300">Uploading avatar...</span>
                      </div>
                    )}
                    {businessLogos.filter(logo => logo.logo_type === 'avatar').length > 0 ? (
                      <div className="grid grid-cols-3 gap-3 max-h-48 overflow-y-auto">
                        <button
                          onClick={() => handleAssignLogo(editingEmail.id, null)}
                          className={cn(
                            'aspect-video bg-gray-50 dark:bg-gray-900 rounded-lg border-2 flex flex-col items-center justify-center p-2 transition-all',
                            !getEmailLogo(editingEmail)
                              ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800'
                              : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
                          )}
                        >
                          <X className="h-6 w-6 text-gray-400 mb-1" />
                          <span className="text-xs text-gray-400">No Avatar</span>
                        </button>
                        {businessLogos.filter(logo => logo.logo_type === 'avatar').map((logo) => (
                          <button
                            key={logo.id}
                            onClick={() => handleAssignLogo(editingEmail.id, logo.id)}
                            className={cn(
                              'aspect-video bg-gray-50 dark:bg-gray-900 rounded-lg border-2 flex items-center justify-center p-2 transition-all',
                              getEmailLogo(editingEmail)?.id === logo.id
                                ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800'
                                : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
                            )}
                          >
                            <img
                              src={logo.public_url}
                              alt={logo.alt_text || logo.file_name}
                              className="max-w-full max-h-full object-contain rounded-full"
                            />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-center border border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No avatars available</p>
                        <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg cursor-pointer transition-colors">
                          <Upload className="h-4 w-4" />
                          <span>Upload Avatar</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                handleLogoUpload(e as any, 'avatar' as BusinessLogo['logo_type'])
                                // Reset input so same file can be selected again
                                e.target.value = ''
                              }
                            }}
                            className="hidden"
                            disabled={uploadingLogo}
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="can_send"
                        checked={editingEmail.can_send ?? true}
                        onChange={(e) => setEditingEmail({ ...editingEmail, can_send: e.target.checked })}
                        className="rounded border-gray-300 text-primary-600"
                      />
                      <label htmlFor="can_send" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Can Send Emails
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="can_receive"
                        checked={editingEmail.can_receive ?? true}
                        onChange={(e) => setEditingEmail({ ...editingEmail, can_receive: e.target.checked })}
                        className="rounded border-gray-300 text-primary-600"
                      />
                      <label htmlFor="can_receive" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Can Receive Emails
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={editingEmail.is_active ?? true}
                      onChange={(e) => setEditingEmail({ ...editingEmail, is_active: e.target.checked })}
                      className="rounded border-gray-300 text-primary-600"
                    />
                    <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Active
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 justify-end p-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => {
                      setShowEmailEditor(false)
                      setEditingEmail(null)
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEmail}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Logo Upload Modal */}
          {showLogoUpload && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Upload Avatar</h3>
                  <button
                    onClick={() => setShowLogoUpload(false)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <label className="block w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 cursor-pointer transition-colors">
                      <div className="flex items-center justify-center gap-2">
                        <ImageIcon className="h-5 w-5 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Upload Avatar
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleLogoUpload(e, 'avatar' as BusinessLogo['logo_type'])}
                        className="hidden"
                        disabled={uploadingLogo}
                      />
                    </label>
                  </div>
                </div>

                {uploadingLogo && (
                  <div className="mt-4 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-200 border-t-primary-600"></div>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Uploading...</p>
                  </div>
                )}

                <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
                  Maximum file size: 5MB • Supported formats: PNG, JPG, SVG
                </p>
              </div>
            </div>
          )}

          {/* Compose Email Modal - Gmail Style */}
          {composing && (
            <div 
              className="fixed inset-0 z-50 flex items-end justify-end p-4 pointer-events-none"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setComposing(false)
                  setIsMinimized(false)
                  setShowAdvancedOptions(false)
                }
              }}
            >
              <div 
                className={cn(
                  "bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col pointer-events-auto",
                  isMinimized ? "h-auto" : "max-h-[85vh]"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Compact Header */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">New Message</span>
                    {!isMinimized && (
                      <select
                        value={composeData.fromEmailAddressId}
                        onChange={(e) => setComposeData({ ...composeData, fromEmailAddressId: e.target.value })}
                        className="text-xs border-0 bg-transparent text-gray-600 dark:text-gray-400 cursor-pointer focus:ring-0 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {adminEmailAddresses.map((addr) => (
                          <option key={addr.id} value={addr.id}>
                            {addr.display_name || addr.email_address}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setIsMinimized(!isMinimized)}
                      className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      title={isMinimized ? "Expand" : "Minimize"}
                    >
                      <Minimize2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setComposing(false)
                        setIsMinimized(false)
                        setShowAdvancedOptions(false)
                        setAttachments([])
                      }}
                      className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {!isMinimized && (
                  <>
                    {/* Compact To Field */}
                    <div className="px-4 py-1.5 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 dark:text-gray-400 w-12 flex-shrink-0">To</span>
                        <input
                          type="email"
                          value={composeData.to}
                          onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                          placeholder="Recipients"
                          className="flex-1 border-0 focus:ring-0 p-0 text-sm bg-transparent dark:bg-transparent placeholder-gray-400"
                          autoFocus
                        />
                        {composeData.toName && (
                          <input
                            type="text"
                            value={composeData.toName}
                            onChange={(e) => setComposeData({ ...composeData, toName: e.target.value })}
                            placeholder="Name"
                            className="w-32 border-0 focus:ring-0 p-0 text-sm bg-transparent dark:bg-transparent placeholder-gray-400 text-gray-500"
                          />
                        )}
                      </div>
                    </div>

                    {/* Cc/Bcc Toggle */}
                    <div className="px-4 py-0.5 border-b border-gray-200 dark:border-gray-700">
                      {showAdvancedOptions ? (
                        <div className="space-y-1.5 py-1">
                          <button
                            onClick={() => setShowAdvancedOptions(false)}
                            className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                          >
                            Cc Bcc
                          </button>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-600 dark:text-gray-400 w-12 flex-shrink-0">Cc</span>
                              <input
                                type="email"
                                placeholder="Cc"
                                className="flex-1 border-0 focus:ring-0 p-0 text-sm bg-transparent dark:bg-transparent placeholder-gray-400"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-600 dark:text-gray-400 w-12 flex-shrink-0">Bcc</span>
                              <input
                                type="email"
                                placeholder="Bcc"
                                className="flex-1 border-0 focus:ring-0 p-0 text-sm bg-transparent dark:bg-transparent placeholder-gray-400"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-600 dark:text-gray-400 w-12 flex-shrink-0">Reply-To</span>
                              <input
                                type="email"
                                value={composeData.replyTo}
                                onChange={(e) => setComposeData({ ...composeData, replyTo: e.target.value })}
                                placeholder="Optional reply-to address"
                                className="flex-1 border-0 focus:ring-0 p-0 text-sm bg-transparent dark:bg-transparent placeholder-gray-400"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowAdvancedOptions(true)}
                          className="text-xs text-primary-600 dark:text-primary-400 hover:underline py-1"
                        >
                          Cc Bcc
                        </button>
                      )}
                    </div>

                    {/* Subject */}
                    <div className="px-4 py-1.5 border-b border-gray-200 dark:border-gray-700">
                      <input
                        type="text"
                        value={composeData.subject}
                        onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                        placeholder="Subject"
                        className="w-full border-0 focus:ring-0 p-0 text-sm bg-transparent dark:bg-transparent placeholder-gray-400"
                      />
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto min-h-[300px]">
                      <textarea
                        value={composeData.body}
                        onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                        placeholder="Compose email..."
                        className="w-full h-full px-4 py-3 border-0 focus:ring-0 text-sm bg-transparent dark:bg-transparent placeholder-gray-400 resize-none font-mono"
                        style={{ minHeight: '300px' }}
                      />
                    </div>

                    {/* Attachments List */}
                    {attachments.length > 0 && (
                      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex flex-wrap gap-2">
                          {attachments.map((file, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-sm"
                            >
                              {file.type.startsWith('image/') ? (
                                <ImageIcon className="h-4 w-4 text-blue-600" />
                              ) : (
                                <FileIcon className="h-4 w-4 text-gray-600" />
                              )}
                              <span className="max-w-[150px] truncate">{file.name}</span>
                              <button
                                onClick={() => handleFileRemove(index)}
                                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full"
                              >
                                <XCircle className="h-3.5 w-3.5 text-gray-500" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Footer Toolbar */}
                    <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleSendEmail}
                          disabled={sending || !composeData.to || !composeData.subject || !composeData.body}
                          className={cn(
                            "px-6 py-2 bg-primary-600 text-white text-sm font-medium rounded-full hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors",
                            sending && "opacity-75"
                          )}
                        >
                          {sending ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4" />
                              Send
                            </>
                          )}
                        </button>
                        
                        {/* Options Menu */}
                        <div className="relative ml-2" ref={templateMenuRef}>
                          <button
                            onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                            title="Templates"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          {showTemplateMenu && (
                            <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[200px] max-h-[300px] overflow-y-auto">
                              <div className="p-2">
                                <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                                  Templates
                                </div>
                                {emailTemplates.length > 0 ? (
                                  emailTemplates.map((template) => (
                                    <button
                                      key={template.id}
                                      onClick={() => {
                                        handleTemplateSelect(template.id)
                                        setShowTemplateMenu(false)
                                      }}
                                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                    >
                                      <div className="font-medium text-gray-900 dark:text-gray-100">{template.name}</div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400">{template.category}</div>
                                    </button>
                                  ))
                                ) : (
                                  <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No templates</div>
                                )}
                              </div>
                              {selectedTemplateId && Object.keys(templateVariables).length > 0 && (
                                <div className="border-t border-gray-200 dark:border-gray-700 p-2">
                                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                                    Template Variables
                                  </div>
                                  {Object.keys(templateVariables).map((varName) => (
                                    <div key={varName} className="mb-2">
                                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1 px-3">
                                        {varName}
                                      </label>
                                      <input
                                        type="text"
                                        value={templateVariables[varName]}
                                        onChange={(e) =>
                                          setTemplateVariables({
                                            ...templateVariables,
                                            [varName]: e.target.value,
                                          })
                                        }
                                        className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                                        placeholder={`Enter ${varName}`}
                                      />
                                    </div>
                                  ))}
                                  <button
                                    onClick={() => {
                                      handleApplyTemplate()
                                      setShowTemplateMenu(false)
                                    }}
                                    className="w-full mt-2 px-3 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700"
                                  >
                                    Apply Template
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="relative" ref={signatureMenuRef}>
                          <button
                            onClick={() => setShowSignatureMenu(!showSignatureMenu)}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                            title="Signature"
                          >
                            <Type className="h-4 w-4" />
                          </button>
                          {showSignatureMenu && (
                            <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[200px]">
                              <div className="p-2">
                                <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                                  Signatures
                                </div>
                                <button
                                  onClick={() => {
                                    handleSignatureSelect('')
                                    setShowSignatureMenu(false)
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                >
                                  <span className="text-gray-500 dark:text-gray-400">No signature</span>
                                </button>
                                {emailSignatures.map((sig) => (
                                  <button
                                    key={sig.id}
                                    onClick={() => {
                                      handleSignatureSelect(sig.id)
                                      setShowSignatureMenu(false)
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                  >
                                    <div className="font-medium text-gray-900 dark:text-gray-100">{sig.name}</div>
                                    {sig.is_default && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400">Default</div>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="relative">
                          <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files) {
                                handleFileAdd(Array.from(e.target.files))
                                e.target.value = '' // Reset input
                              }
                            }}
                          />
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors relative"
                            title="Attach files"
                          >
                            <Paperclip className="h-4 w-4" />
                            {attachments.length > 0 && (
                              <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                                {attachments.length}
                              </span>
                            )}
                          </button>
                        </div>

                        <button
                          className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                          title="More options"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={composeData.emailType}
                          onChange={(e) =>
                            setComposeData({
                              ...composeData,
                              emailType: e.target.value as 'manual',
                            })
                          }
                          className="text-xs border-0 bg-transparent text-gray-600 dark:text-gray-400 cursor-pointer focus:ring-0 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                          <option value="manual">Manual</option>
                          <option value="marketing">Marketing</option>
                          <option value="notification">Notification</option>
                        </select>
                        <select
                          value={composeData.category}
                          onChange={(e) => setComposeData({ ...composeData, category: e.target.value })}
                          className="text-xs border-0 bg-transparent text-gray-600 dark:text-gray-400 cursor-pointer focus:ring-0 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                          <option value="custom">Custom</option>
                          <option value="general">General</option>
                          <option value="update">Update</option>
                          <option value="announcement">Announcement</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Email Detail Modal */}
          {selectedEmail && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
              <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Gmail-Style Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {selectedEmail.subject || '(no subject)'}
                      </h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={cn(
                            'px-2 py-0.5 text-xs font-medium rounded-full',
                            {
                              'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400':
                                selectedEmail.status === 'delivered' || selectedEmail.status === 'sent',
                              'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400':
                                selectedEmail.status === 'pending',
                              'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400':
                                selectedEmail.status === 'failed' || selectedEmail.status === 'bounced',
                            }
                          )}
                        >
                          {selectedEmail.status}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {format(new Date(selectedEmail.created_at), 'MMM d, yyyy • h:mm a')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedEmail(null)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  >
                    <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Email Content */}
                <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
                  {/* Recipient Info - Gmail Style */}
                  <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700/50">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                        {(selectedEmail.recipient_name || selectedEmail.recipient_email)[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {selectedEmail.recipient_name || selectedEmail.recipient_email.split('@')[0]}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              to {selectedEmail.recipient_email}
                            </p>
                          </div>
                          <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                            {selectedEmail.sent_at && (
                              <p>{format(new Date(selectedEmail.sent_at), 'h:mm a')}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Error Message (if any) */}
                  {selectedEmail.error_message && (
                    <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-900 dark:text-red-100">Delivery Error</p>
                          <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                            {selectedEmail.error_message}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Email Body - Gmail Style */}
                  <div className="px-6 py-6">
                    <div 
                      className="prose prose-sm dark:prose-invert max-w-none"
                      style={{
                        fontSize: '14px',
                        lineHeight: '1.6',
                        color: 'inherit'
                      }}
                      dangerouslySetInnerHTML={{ 
                        __html: selectedEmail.body_html || selectedEmail.body_text || '<p class="text-gray-500 italic">No content</p>' 
                      }}
                    />
                  </div>
                </div>

                {/* Action Footer - Gmail Style */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setComposeData({
                          ...composeData,
                          to: selectedEmail.recipient_email,
                          toName: selectedEmail.recipient_name || '',
                          subject: `Re: ${selectedEmail.subject || ''}`,
                          body: `\n\n---\nOn ${format(new Date(selectedEmail.created_at), 'PPpp')}, you wrote:\n${selectedEmail.body_text || ''}`
                        })
                        setComposing(true)
                        setSelectedEmail(null)
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                    >
                      <Reply className="h-4 w-4" />
                      Reply
                    </button>
                    <button
                      onClick={() => {
                        // Forward logic
                        setComposeData({
                          ...composeData,
                          to: '',
                          toName: '',
                          subject: `Fwd: ${selectedEmail.subject || ''}`,
                          body: `\n\n---\nForwarded message from ${selectedEmail.recipient_email}:\n${selectedEmail.body_text || ''}`
                        })
                        setComposing(true)
                        setSelectedEmail(null)
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                    >
                      <Forward className="h-4 w-4" />
                      Forward
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => window.print()}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Print"
                    >
                      <Printer className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteSent(selectedEmail.id, selectedEmail.subject || '(no subject)')}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Received Email Detail Modal - Gmail Style */}
          {selectedReceivedEmail && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
              <div className="bg-white dark:bg-gray-800 rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Gmail-Style Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-white dark:from-gray-800 dark:to-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {selectedReceivedEmail.subject || '(no subject)'}
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Inbox • {format(new Date(selectedReceivedEmail.created_at), 'MMM d, yyyy • h:mm a')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedReceivedEmail(null)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  >
                    <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Email Content */}
                <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
                  {/* Sender Info - Gmail Style with Avatar */}
                  <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700/50">
                    <div className="flex items-start gap-3">
                      {/* Sender Avatar */}
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                        {(() => {
                          const fromEmail = selectedReceivedEmail.from || '';
                          const name = fromEmail.match(/^(.*?)</) ? fromEmail.match(/^(.*?)</)[1].trim() : fromEmail.split('@')[0];
                          return (name[0] || 'U').toUpperCase();
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {(() => {
                                const fromEmail = selectedReceivedEmail.from || '';
                                const name = fromEmail.match(/^(.*?)</) ? fromEmail.match(/^(.*?)</)[1].trim() : fromEmail;
                                return name;
                              })()}
                            </p>
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                              <p>
                                <span className="text-gray-500">to</span> {Array.isArray(selectedReceivedEmail.to) ? selectedReceivedEmail.to.join(', ') : selectedReceivedEmail.to}
                              </p>
                              {selectedReceivedEmail.cc && selectedReceivedEmail.cc.length > 0 && (
                                <p>
                                  <span className="text-gray-500">cc</span> {selectedReceivedEmail.cc.join(', ')}
                                </p>
                              )}
                              {selectedReceivedEmail.reply_to && selectedReceivedEmail.reply_to.length > 0 && (
                                <p>
                                  <span className="text-gray-500">reply-to</span> {selectedReceivedEmail.reply_to.join(', ')}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-xs text-gray-500 dark:text-gray-400 space-y-1">
                            <p>{format(new Date(selectedReceivedEmail.created_at), 'h:mm a')}</p>
                            {selectedReceivedEmail.message_id && (
                              <p className="font-mono text-[10px] max-w-[120px] truncate" title={selectedReceivedEmail.message_id}>
                                ID: {selectedReceivedEmail.message_id.substring(0, 8)}...
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Attachments (if any) */}
                  {selectedReceivedEmail.attachments && selectedReceivedEmail.attachments.length > 0 && (
                    <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700/50">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                        <Paperclip className="h-3.5 w-3.5" />
                        {selectedReceivedEmail.attachments.length} Attachment{selectedReceivedEmail.attachments.length > 1 ? 's' : ''}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedReceivedEmail.attachments.map((attachment: any, idx: number) => (
                          <div 
                            key={idx} 
                            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:shadow-sm transition-shadow"
                          >
                            <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                              <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                                {attachment.filename}
                              </p>
                              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                {(attachment.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                            <button 
                              onClick={() => {
                                if (attachment.download_url) {
                                  window.open(attachment.download_url, '_blank')
                                } else {
                                  showToast('Download URL not available for this attachment', 'warning')
                                }
                              }}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                              title="Download attachment"
                            >
                              <Download className="h-3.5 w-3.5 text-gray-500" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Email Body - Gmail Style with proper HTML handling */}
                  <div className="px-6 py-6">
                    {selectedReceivedEmail.html ? (
                      <div 
                        className="prose prose-sm dark:prose-invert max-w-none"
                        style={{
                          fontSize: '14px',
                          lineHeight: '1.6',
                          color: 'inherit',
                          wordWrap: 'break-word',
                          overflowWrap: 'break-word'
                        }}
                        dangerouslySetInnerHTML={{ __html: selectedReceivedEmail.html }}
                      />
                    ) : selectedReceivedEmail.text ? (
                      <div 
                        className="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100"
                        style={{
                          fontFamily: 'system-ui, -apple-system, sans-serif',
                          lineHeight: '1.6'
                        }}
                      >
                        {selectedReceivedEmail.text}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-3">
                          <AlertCircle className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 italic">No content available</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          This email may have been sent without any body content
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Footer - Gmail Style */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const senderEmail = selectedReceivedEmail.from.match(/<(.+?)>/) 
                          ? selectedReceivedEmail.from.match(/<(.+?)>/)[1] 
                          : selectedReceivedEmail.from;
                        setComposeData({
                          ...composeData,
                          to: senderEmail,
                          toName: selectedReceivedEmail.from.match(/^(.*?)</) 
                            ? selectedReceivedEmail.from.match(/^(.*?)</)[1].trim() 
                            : '',
                          subject: selectedReceivedEmail.subject?.startsWith('Re:') 
                            ? selectedReceivedEmail.subject 
                            : `Re: ${selectedReceivedEmail.subject || ''}`,
                          body: `\n\n---\nOn ${format(new Date(selectedReceivedEmail.created_at), 'PPpp')}, ${selectedReceivedEmail.from} wrote:\n${selectedReceivedEmail.text || selectedReceivedEmail.html || ''}`
                        })
                        setComposing(true)
                        setSelectedReceivedEmail(null)
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium shadow-sm"
                    >
                      <Reply className="h-4 w-4" />
                      Reply
                    </button>
                    <button
                      onClick={() => {
                        // Reply All logic
                        const senderEmail = selectedReceivedEmail.from.match(/<(.+?)>/) 
                          ? selectedReceivedEmail.from.match(/<(.+?)>/)[1] 
                          : selectedReceivedEmail.from;
                        setComposeData({
                          ...composeData,
                          to: senderEmail,
                          toName: '',
                          subject: `Re: ${selectedReceivedEmail.subject || ''}`,
                          body: `\n\n---\nOn ${format(new Date(selectedReceivedEmail.created_at), 'PPpp')}, ${selectedReceivedEmail.from} wrote:\n${selectedReceivedEmail.text || selectedReceivedEmail.html || ''}`
                        })
                        setComposing(true)
                        setSelectedReceivedEmail(null)
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                    >
                      <ReplyAll className="h-4 w-4" />
                      Reply All
                    </button>
                    <button
                      onClick={() => {
                        setComposeData({
                          ...composeData,
                          to: '',
                          toName: '',
                          subject: `Fwd: ${selectedReceivedEmail.subject || ''}`,
                          body: `\n\n---\nForwarded message from ${selectedReceivedEmail.from}:\nDate: ${format(new Date(selectedReceivedEmail.created_at), 'PPpp')}\nSubject: ${selectedReceivedEmail.subject || ''}\n\n${selectedReceivedEmail.text || selectedReceivedEmail.html || ''}`
                        })
                        setComposing(true)
                        setSelectedReceivedEmail(null)
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                    >
                      <Forward className="h-4 w-4" />
                      Forward
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => window.print()}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Print"
                    >
                      <Printer className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </button>
                    <button
                      onClick={() => {
                        const url = `mailto:${selectedReceivedEmail.from}?subject=${encodeURIComponent(selectedReceivedEmail.subject || '')}`;
                        window.open(url, '_blank');
                      }}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Open in mail client"
                    >
                      <ExternalLink className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteInbox(selectedReceivedEmail.id, selectedReceivedEmail.subject || '(no subject)')}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Signature Editor Modal */}
          {showSignatureEditor && editingSignature && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {editingSignature.id ? 'Edit Signature' : 'Create Signature'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowSignatureEditor(false)
                      setEditingSignature(null)
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1">
                  <div className="grid grid-cols-2 gap-6">
                    {/* Left: Form */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Signature Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editingSignature.name || ''}
                          onChange={(e) => setEditingSignature({ ...editingSignature, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                          placeholder="e.g., Professional Signature"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                        <select
                          value={editingSignature.signature_type || 'personal'}
                          onChange={(e) => setEditingSignature({ ...editingSignature, signature_type: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                        >
                          <option value="personal">Personal</option>
                          <option value="company">Company</option>
                          <option value="department">Department</option>
                        </select>
                      </div>

                      <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editingSignature.is_active || false}
                            onChange={(e) => setEditingSignature({ ...editingSignature, is_active: e.target.checked })}
                            className="rounded border-gray-300 text-primary-600"
                          />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editingSignature.is_default || false}
                            onChange={(e) => setEditingSignature({ ...editingSignature, is_default: e.target.checked })}
                            className="rounded border-gray-300 text-primary-600"
                          />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Default</span>
                        </label>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          HTML Content <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={editingSignature.signature_html || ''}
                          onChange={(e) => setEditingSignature({ ...editingSignature, signature_html: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm dark:bg-gray-700 dark:text-white"
                          rows={12}
                          placeholder="<div>Your signature HTML here...</div>"
                        />
                        <p className="text-xs text-gray-500 mt-1">Use HTML to create your signature</p>
                      </div>
                    </div>

                    {/* Right: Preview */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preview</label>
                      <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-900 min-h-[400px]">
                        {editingSignature.signature_html ? (
                          <div dangerouslySetInnerHTML={{ __html: editingSignature.signature_html }} />
                        ) : (
                          <p className="text-gray-400 text-sm">Preview will appear here...</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-end p-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => {
                      setShowSignatureEditor(false)
                      setEditingSignature(null)
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSignature}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save Signature
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {deleteModal.isOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Delete Email
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        This action cannot be undone
                      </p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      Are you sure you want to delete this email?
                    </p>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {deleteModal.emailSubject}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {deleteModal.type === 'sent' ? 'From: Sent Items' : 'From: Inbox'}
                      </p>
                    </div>
                    {deleteModal.type === 'inbox' && (
                      <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 flex items-center gap-1">
                        <span>⚠️</span>
                        This will permanently delete the email from Resend servers
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setDeleteModal({ isOpen: false, type: 'sent', emailId: null, emailSubject: '' })}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDelete}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
                    >
                      Delete Email
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}


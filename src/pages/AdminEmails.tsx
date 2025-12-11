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

import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
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
  TrendingUp,
  Users,
  Activity,
  BarChart3,
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
} from 'lucide-react'
import { emailLogsAPI, sendEmailWithLogging, EmailLog, EmailStats } from '@/lib/email-api'
import { Loading } from '@/components/ui/Loading'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import AdminEmailTemplates from './AdminEmailTemplates'
import { emailTemplatesAPI, EmailTemplate } from '@/lib/email-templates-api'
import { emailSignaturesAPI, EmailSignature } from '@/lib/email-signatures-api'
import { resendInboxAPI, ReceivedEmail } from '@/lib/resend-inbox-api'
import { businessLogosAPI, BusinessLogo } from '@/lib/email-signatures-api'

type Tab = 'inbox' | 'sent' | 'templates' | 'signatures' | 'email-setup'

// Email Templates Manager Component
function EmailTemplatesManager() {
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
      alert('Failed to load templates');
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
      alert('Template cloned successfully');
      loadTemplates();
    } catch (error) {
      console.error('Error cloning template:', error);
      alert('Failed to clone template');
    }
  };

  const handleToggleActive = async (template: EmailTemplate) => {
    try {
      await emailTemplatesAPI.update(template.id, { is_active: !template.is_active });
      alert(`Template ${template.is_active ? 'deactivated' : 'activated'}`);
      loadTemplates();
    } catch (error) {
      console.error('Error toggling template:', error);
      alert('Failed to update template');
    }
  };

  const handleDelete = async (template: EmailTemplate) => {
    if (template.template_type === 'system') {
      alert('Cannot delete system templates');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) {
      return;
    }

    try {
      await emailTemplatesAPI.delete(template.id);
      alert('Template deleted successfully');
      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template');
    }
  };

  const handleSave = async () => {
    if (!editingTemplate) return;

    if (!editingTemplate.name || !editingTemplate.slug || !editingTemplate.subject || !editingTemplate.html_content) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      if (editingTemplate.id) {
        await emailTemplatesAPI.update(editingTemplate.id, editingTemplate);
        alert('Template updated successfully');
      } else {
        await emailTemplatesAPI.create(editingTemplate as any);
        alert('Template created successfully');
      }
      setShowEditor(false);
      setEditingTemplate(null);
      loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template');
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
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
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
  
  // Email addresses
  const [adminEmailAddresses, setAdminEmailAddresses] = useState<any[]>([])
  const [loadingAddresses, setLoadingAddresses] = useState(false)
  
  // Email templates
  const [emailTemplates, setEmailTemplates] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({})
  
  // Email signatures
  const [emailSignatures, setEmailSignatures] = useState<any[]>([])
  const [selectedSignatureId, setSelectedSignatureId] = useState<string>('')

  useEffect(() => {
    if (isAdmin()) {
      if (activeTab === 'sent') {
        loadData()
      } else if (activeTab === 'inbox') {
        loadInboxEmails()
      } else if (activeTab === 'signatures') {
        loadSignaturesData()
      } else if (activeTab === 'email-setup') {
        loadEmailSetupData()
      }
      loadAdminEmailAddresses()
      loadEmailTemplates()
      loadEmailSignatures()
    }
  }, [currentPage, statusFilter, typeFilter, categoryFilter, searchQuery, dateRange, activeTab])
  
  const loadAdminEmailAddresses = async () => {
    setLoadingAddresses(true)
    try {
      const { emailAddressesAPI } = await import('@/lib/email-addresses-api')
      const addresses = await emailAddressesAPI.getAdminAddresses()
      setAdminEmailAddresses(addresses)
      // Set default from address
      if (addresses.length > 0 && !composeData.fromEmailAddressId) {
        setComposeData(prev => ({ ...prev, fromEmailAddressId: addresses[0].id }))
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
      
      setReceivedEmails(result.data)
      setInboxHasMore(result.has_more)
    } catch (error) {
      console.error('Error loading inbox emails:', error)
      // If error is due to missing API key or configuration, set empty state
      setReceivedEmails([])
      setInboxHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = async (emailId: string) => {
    try {
      const success = await emailLogsAPI.retry(emailId)
      if (success) {
        alert('Email resent successfully!')
        loadData()
      } else {
        alert('Failed to resend email. Please check the logs.')
      }
    } catch (error: any) {
      alert(error.message || 'Failed to retry email')
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
    setDeleteModal({
      isOpen: true,
      type: 'inbox',
      emailId,
      emailSubject: subject
    })
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
      alert('Email deleted successfully')
    } catch (error) {
      console.error('Error deleting email:', error)
      alert('Failed to delete email')
    }
  }

  const handleBulkDelete = async () => {
    const selectedIds = activeTab === 'sent' ? selectedSentIds : selectedInboxIds
    
    if (selectedIds.size === 0) {
      alert('Please select at least one email to delete')
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
          alert(`Failed to delete ${errors.length} email(s). ${selectedIds.size - errors.length} deleted successfully.`)
        } else {
          alert(`${selectedIds.size} email(s) deleted successfully`)
        }
      }
    } catch (error) {
      console.error('Error deleting emails:', error)
      alert('Failed to delete emails')
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
      alert('Please fill in name and HTML content')
      return
    }

    try {
      if (editingSignature.id) {
        await emailSignaturesAPI.update(editingSignature.id, editingSignature)
        alert('Signature updated successfully')
      } else {
        await emailSignaturesAPI.create(editingSignature)
        alert('Signature created successfully')
      }
      setShowSignatureEditor(false)
      setEditingSignature(null)
      loadSignaturesData()
    } catch (error) {
      console.error('Error saving signature:', error)
      alert('Failed to save signature')
    }
  }

  const handleDeleteSignature = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return

    try {
      await emailSignaturesAPI.delete(id)
      alert('Signature deleted successfully')
      loadSignaturesData()
    } catch (error) {
      console.error('Error deleting signature:', error)
      alert('Failed to delete signature')
    }
  }

  const handleSetDefaultSignature = async (id: string) => {
    try {
      await emailSignaturesAPI.setDefault(id)
      alert('Default signature updated')
      loadSignaturesData()
    } catch (error) {
      console.error('Error setting default signature:', error)
      alert('Failed to set default signature')
    }
  }

  // Email Setup functions
  const loadEmailSetupData = async () => {
    try {
      setLoading(true)
      const [addresses, logos] = await Promise.all([
        (async () => {
          const { emailAddressesAPI } = await import('@/lib/email-addresses-api')
          return emailAddressesAPI.getAdminAddresses()
        })(),
        businessLogosAPI.getAll(),
      ])
      setAdminEmailAddresses(addresses)
      setBusinessLogos(logos)
    } catch (error) {
      console.error('Error loading email setup data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>, logoType: BusinessLogo['logo_type']) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB')
      return
    }

    try {
      setUploadingLogo(true)
      await businessLogosAPI.upload(file, logoType, file.name)
      alert('Logo uploaded successfully')
      loadEmailSetupData()
      setShowLogoUpload(false)
    } catch (error) {
      console.error('Error uploading logo:', error)
      alert('Failed to upload logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleDeleteLogo = async (id: string) => {
    if (!confirm('Are you sure you want to delete this logo?')) return

    try {
      await businessLogosAPI.delete(id)
      alert('Logo deleted successfully')
      loadEmailSetupData()
    } catch (error) {
      console.error('Error deleting logo:', error)
      alert('Failed to delete logo')
    }
  }

  const handleSetDefaultLogo = async (id: string, logoType: BusinessLogo['logo_type']) => {
    try {
      await businessLogosAPI.setDefault(id, logoType)
      alert('Default logo updated')
      loadEmailSetupData()
    } catch (error) {
      console.error('Error setting default logo:', error)
      alert('Failed to set default logo')
    }
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

  const handleSendEmail = async () => {
    if (!composeData.to || !composeData.subject || !composeData.body) {
      alert('Please fill in all required fields')
      return
    }

    setSending(true)
    try {
      const success = await sendEmailWithLogging({
        to: composeData.to,
        toName: composeData.toName,
        subject: composeData.subject,
        html: composeData.body,
        emailType: composeData.emailType,
        emailCategory: composeData.category,
        tags: composeData.tags,
        fromEmailAddressId: composeData.fromEmailAddressId || undefined,
        replyTo: composeData.replyTo || undefined,
      })

      if (success) {
        alert('Email sent successfully!')
        setComposing(false)
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
        alert('Failed to send email. Please check your email configuration.')
      }
    } catch (error) {
      console.error('Error sending email:', error)
      alert('Failed to send email')
    } finally {
      setSending(false)
    }
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
                                            <span className="hidden lg:inline text-sm text-gray-500 dark:text-gray-400 truncate">
                                              - {log.body_text?.substring(0, 30) || ''}
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
                                    setSelectedReceivedEmail(email)
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

                                    {/* Content Area */}
                                    <div className="flex-1 min-w-0 pr-2">
                                      {/* Sender & Attachment Icon (Mobile: stacked, Desktop: inline) */}
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 mb-1 sm:mb-0">
                                        <div className="sm:w-40 flex-shrink-0 sm:px-2">
                                          <div className="flex items-center gap-2">
                                            {email.attachments && email.attachments.length > 0 && (
                                              <Download className="h-3.5 w-3.5 sm:hidden text-gray-400 flex-shrink-0" />
                                            )}
                                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate max-w-[160px] sm:max-w-none">
                                              {(() => {
                                                const sender = email.from.includes('<') ? email.from.split('<')[0].trim() : email.from.split('@')[0];
                                                return sender.length > 20 ? sender.substring(0, 20) + '...' : sender;
                                              })()}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Subject & Preview */}
                                        <div className="flex-1 min-w-0 sm:px-2">
                                          <div className="flex items-center gap-1">
                                            {email.attachments && email.attachments.length > 0 && (
                                              <Download className="hidden sm:block h-4 w-4 text-gray-400 flex-shrink-0" />
                                            )}
                                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                              {(email.subject && email.subject.length > 40 ? email.subject.substring(0, 40) + '...' : email.subject) || '(no subject)'}
                                            </span>
                                            <span className="hidden lg:inline text-sm text-gray-500 dark:text-gray-400 truncate">
                                              - {email.text?.substring(0, 30) || email.html?.replace(/<[^>]*>/g, '').substring(0, 30) || ''}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Attachment Indicator (Desktop only) */}
                                        <div className="hidden sm:flex items-center gap-2 flex-shrink-0 px-2">
                                          {email.attachments && email.attachments.length > 0 && (
                                            <span className="text-xs text-gray-500" title={`${email.attachments.length} attachment(s)`}>
                                              📎
                                            </span>
                                          )}
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
                            onClick={() => window.location.href = '/admin/email-addresses'}
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
                              onClick={() => window.location.href = '/admin/email-addresses'}
                              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                            >
                              Add Email Address
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {adminEmailAddresses.map((email) => (
                              <div
                                key={email.id}
                                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <Mail className="h-4 w-4 text-primary-600" />
                                      <span className="font-medium text-gray-900 dark:text-gray-100">
                                        {email.email}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                      {email.name || email.display_name || 'No display name'}
                                    </p>
                                  </div>
                                  {email.is_default && (
                                    <span className="px-2 py-0.5 text-xs bg-primary-600 text-white rounded-full flex items-center gap-1">
                                      <Star className="h-3 w-3" fill="currentColor" />
                                      Default
                                    </span>
                                  )}
                                </div>
                                {email.is_verified && (
                                  <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Verified
                                  </div>
                                )}
                                {!email.is_active && (
                                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-2">
                                    <EyeOff className="h-3 w-3" />
                                    Inactive
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Business Logos Section */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            Official Business Logos
                          </h3>
                          <button
                            onClick={() => setShowLogoUpload(true)}
                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
                          >
                            <Upload className="h-4 w-4" />
                            Upload Logo
                          </button>
                        </div>

                        {businessLogos.length === 0 ? (
                          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
                            <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">No Business Logos</h4>
                            <p className="text-gray-500 dark:text-gray-400 mb-4">Upload your official business logo</p>
                            <button
                              onClick={() => setShowLogoUpload(true)}
                              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                            >
                              Upload Logo
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {businessLogos.map((logo) => (
                              <div
                                key={logo.id}
                                className={cn(
                                  'bg-white dark:bg-gray-800 rounded-lg border p-4 hover:shadow-md transition-all',
                                  logo.is_default
                                    ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800'
                                    : 'border-gray-200 dark:border-gray-700'
                                )}
                              >
                                <div className="aspect-square bg-gray-50 dark:bg-gray-900 rounded-lg mb-3 flex items-center justify-center p-3">
                                  <img
                                    src={logo.public_url}
                                    alt={logo.alt_text || logo.file_name}
                                    className="max-w-full max-h-full object-contain"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {logo.file_name}
                                  </p>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                      {logo.logo_type.replace('_', ' ')}
                                    </span>
                                    {logo.is_default && (
                                      <span className="px-2 py-0.5 text-xs bg-primary-600 text-white rounded-full">
                                        Default
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {(logo.file_size / 1024).toFixed(1)} KB • {logo.width}×{logo.height}
                                  </p>
                                  <div className="flex gap-2 pt-2">
                                    {!logo.is_default && (
                                      <button
                                        onClick={() => handleSetDefaultLogo(logo.id, logo.logo_type)}
                                        className="flex-1 px-2 py-1.5 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                                      >
                                        <Star className="h-3 w-3 inline" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeleteLogo(logo.id)}
                                      className="flex-1 px-2 py-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                                    >
                                      <Trash2 className="h-3 w-3 inline" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Logo Upload Modal */}
          {showLogoUpload && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Upload Business Logo</h3>
                  <button
                    onClick={() => setShowLogoUpload(false)}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  {['company_logo', 'email_header', 'email_signature', 'avatar'].map((type) => (
                    <div key={type} className="relative">
                      <label className="block w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 cursor-pointer transition-colors">
                        <div className="flex items-center justify-center gap-2">
                          <ImageIcon className="h-5 w-5 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                            Upload {type.replace('_', ' ')}
                          </span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleLogoUpload(e, type as BusinessLogo['logo_type'])}
                          className="hidden"
                          disabled={uploadingLogo}
                        />
                      </label>
                    </div>
                  ))}
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

          {/* Compose Email Modal */}
          {composing && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    Compose Email
                  </h2>
                  <button
                    onClick={() => setComposing(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-160px)] space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">From Address *</label>
                    <select
                      value={composeData.fromEmailAddressId}
                      onChange={(e) => setComposeData({ ...composeData, fromEmailAddressId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    >
                      <option value="">Select sender address...</option>
                      {adminEmailAddresses.map((addr) => (
                        <option key={addr.id} value={addr.id}>
                          {addr.display_name} &lt;{addr.email_address}&gt;
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Choose which admin email address to send from
                    </p>
                  </div>

                  {/* Template Selection */}
                  <div className="border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <label className="block text-sm font-medium mb-2 text-blue-900 dark:text-blue-100">
                      <FileText className="h-4 w-4 inline mr-1" />
                      Use Email Template (Optional)
                    </label>
                    <div className="space-y-3">
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => handleTemplateSelect(e.target.value)}
                        className="w-full px-4 py-2 border border-blue-300 dark:border-blue-700 rounded-lg dark:bg-gray-700"
                      >
                        <option value="">-- Select a template --</option>
                        {emailTemplates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name} ({template.category})
                          </option>
                        ))}
                      </select>

                      {selectedTemplateId && (
                        <>
                          <div className="space-y-2">
                            <p className="text-xs text-blue-800 dark:text-blue-200 font-medium">
                              Fill in template variables:
                            </p>
                            {Object.keys(templateVariables).map((varName) => (
                              <div key={varName}>
                                <label className="block text-xs text-blue-900 dark:text-blue-100 mb-1">
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
                                  placeholder={`Enter ${varName}`}
                                  className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-700 rounded dark:bg-gray-700"
                                />
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={handleApplyTemplate}
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Apply Template to Email
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Recipient Email *</label>
                    <input
                      type="email"
                      value={composeData.to}
                      onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                      placeholder="recipient@example.com"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Recipient Name</label>
                    <input
                      type="text"
                      value={composeData.toName}
                      onChange={(e) => setComposeData({ ...composeData, toName: e.target.value })}
                      placeholder="John Doe"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    />
                  </div>

                  {/* Email Signature Selection */}
                  <div className="border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                    <label className="block text-sm font-medium mb-2 text-green-900 dark:text-green-100">
                      <Type className="h-4 w-4 inline mr-1" />
                      Email Signature (Optional)
                    </label>
                    <select
                      value={selectedSignatureId}
                      onChange={(e) => handleSignatureSelect(e.target.value)}
                      className="w-full px-4 py-2 border border-green-300 dark:border-green-700 rounded-lg dark:bg-gray-700"
                    >
                      <option value="">-- No signature --</option>
                      {emailSignatures.map((sig) => (
                        <option key={sig.id} value={sig.id}>
                          {sig.name} {sig.is_default ? '(Default)' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-green-800 dark:text-green-200 mt-2">
                      Signature will be appended to your email.{' '}
                      <a href="/admin/email-signatures" className="underline hover:text-green-600 dark:hover:text-green-400">
                        Manage signatures
                      </a>
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Subject *</label>
                    <input
                      type="text"
                      value={composeData.subject}
                      onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                      placeholder="Email subject"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Email Body (HTML) *</label>
                    <textarea
                      value={composeData.body}
                      onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                      placeholder="<p>Your email content here...</p>"
                      rows={12}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      You can use HTML for formatting. Use email templates for pre-designed emails.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Reply-To Address</label>
                    <input
                      type="email"
                      value={composeData.replyTo}
                      onChange={(e) => setComposeData({ ...composeData, replyTo: e.target.value })}
                      placeholder="Optional reply-to address"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Leave empty to use sender address
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Email Type</label>
                      <select
                        value={composeData.emailType}
                        onChange={(e) =>
                          setComposeData({
                            ...composeData,
                            emailType: e.target.value as 'manual',
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                      >
                        <option value="manual">Manual</option>
                        <option value="marketing">Marketing</option>
                        <option value="notification">Notification</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Category</label>
                      <select
                        value={composeData.category}
                        onChange={(e) => setComposeData({ ...composeData, category: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                      >
                        <option value="custom">Custom</option>
                        <option value="general">General</option>
                        <option value="update">Update</option>
                        <option value="announcement">Announcement</option>
                      </select>
                    </div>
                  </div>

                </div>
                <div className="flex justify-end gap-4 p-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setComposing(false)}
                    className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendEmail}
                    disabled={sending}
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {sending ? (
                      <>
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5" />
                        Send Email
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Email Detail Modal */}
          {selectedEmail && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    Email Details
                  </h2>
                  <button
                    onClick={() => setSelectedEmail(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Recipient</label>
                        <p className="text-gray-900 dark:text-gray-100">
                          {selectedEmail.recipient_name || selectedEmail.recipient_email}
                        </p>
                        <p className="text-sm text-gray-500">{selectedEmail.recipient_email}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Status</label>
                        <p>
                          <span
                            className={cn(
                              'px-2 py-1 text-xs font-medium rounded-full',
                              {
                                'bg-green-100 text-green-800':
                                  selectedEmail.status === 'delivered' ||
                                  selectedEmail.status === 'sent',
                                'bg-yellow-100 text-yellow-800':
                                  selectedEmail.status === 'pending',
                                'bg-red-100 text-red-800':
                                  selectedEmail.status === 'failed' ||
                                  selectedEmail.status === 'bounced',
                              }
                            )}
                          >
                            {selectedEmail.status}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-500">Subject</label>
                      <p className="text-gray-900 dark:text-gray-100">{selectedEmail.subject}</p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-500">Created At</label>
                      <p className="text-gray-900 dark:text-gray-100">
                        {format(new Date(selectedEmail.created_at), 'PPpp')}
                      </p>
                    </div>

                    {selectedEmail.sent_at && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Sent At</label>
                        <p className="text-gray-900 dark:text-gray-100">
                          {format(new Date(selectedEmail.sent_at), 'PPpp')}
                        </p>
                      </div>
                    )}

                    {selectedEmail.error_message && (
                      <div>
                        <label className="text-sm font-medium text-red-500">Error Message</label>
                        <p className="text-red-600">{selectedEmail.error_message}</p>
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium text-gray-500">Email Body</label>
                      <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto">
                        <div
                          dangerouslySetInnerHTML={{ __html: selectedEmail.body_html || '' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Received Email Detail Modal */}
          {selectedReceivedEmail && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    Received Email
                  </h2>
                  <button
                    onClick={() => setSelectedReceivedEmail(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">From</label>
                        <p className="text-gray-900 dark:text-gray-100">
                          {selectedReceivedEmail.from}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">To</label>
                        <p className="text-gray-900 dark:text-gray-100">
                          {selectedReceivedEmail.to.join(', ')}
                        </p>
                      </div>
                    </div>

                    {selectedReceivedEmail.cc && selectedReceivedEmail.cc.length > 0 && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">CC</label>
                        <p className="text-gray-900 dark:text-gray-100">
                          {selectedReceivedEmail.cc.join(', ')}
                        </p>
                      </div>
                    )}

                    {selectedReceivedEmail.reply_to && selectedReceivedEmail.reply_to.length > 0 && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Reply-To</label>
                        <p className="text-gray-900 dark:text-gray-100">
                          {selectedReceivedEmail.reply_to.join(', ')}
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium text-gray-500">Subject</label>
                      <p className="text-gray-900 dark:text-gray-100">{selectedReceivedEmail.subject}</p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-500">Received At</label>
                      <p className="text-gray-900 dark:text-gray-100">
                        {format(new Date(selectedReceivedEmail.created_at), 'PPpp')}
                      </p>
                    </div>

                    {selectedReceivedEmail.message_id && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Message ID</label>
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-mono break-all">
                          {selectedReceivedEmail.message_id}
                        </p>
                      </div>
                    )}

                    {selectedReceivedEmail.attachments && selectedReceivedEmail.attachments.length > 0 && (
                      <div>
                        <label className="text-sm font-medium text-gray-500 mb-2 block">
                          Attachments ({selectedReceivedEmail.attachments.length})
                        </label>
                        <div className="space-y-2">
                          {selectedReceivedEmail.attachments.map((attachment: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                              <Download className="h-4 w-4 text-gray-500" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {attachment.filename}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {attachment.content_type} • {(attachment.size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium text-gray-500 mb-2 block">Email Content</label>
                      {selectedReceivedEmail.html ? (
                        <div 
                          className="prose dark:prose-invert max-w-none p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                          dangerouslySetInnerHTML={{ __html: selectedReceivedEmail.html }}
                        />
                      ) : selectedReceivedEmail.text ? (
                        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">
                          {selectedReceivedEmail.text}
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">No content available</p>
                      )}
                    </div>
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


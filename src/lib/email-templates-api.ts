/**
 * Email Templates API
 * Handles email template management
 * NOTE: This feature is currently stubbed pending full migration
 */

export interface EmailTemplate {
  id: string;
  name: string;
  description?: string;
  slug: string;
  subject: string;
  html_content: string;
  text_content?: string;
  category: 'welcome' | 'notification' | 'marketing' | 'transactional' | 'reminder' | 'announcement' | 'custom';
  template_type: 'standard' | 'system' | 'user_created';
  variables: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
  thumbnail_url?: string;
  preview_url?: string;
  is_active: boolean;
  is_default: boolean;
  version: number;
  parent_template_id?: string;
  usage_count: number;
  last_used_at?: string;
  created_by?: string;
  updated_by?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface RenderTemplateParams {
  templateId: string;
  variables: Record<string, string>;
}

export interface RenderTemplateResult {
  subject: string;
  html: string;
  text?: string;
}

export function renderTemplate(
  template: EmailTemplate,
  variables: Record<string, string>
): RenderTemplateResult {
  let subject = template.subject
  let html = template.html_content
  let text = template.text_content || ''

  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`
    const safeValue = value || ''
    const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    subject = subject.replace(new RegExp(escapedPlaceholder, 'g'), safeValue)
    html = html.replace(new RegExp(escapedPlaceholder, 'g'), safeValue)
    text = text.replace(new RegExp(escapedPlaceholder, 'g'), safeValue)
  })

  return { subject, html, text: text || undefined }
}

// Stubbed API - feature pending migration
export const emailTemplatesAPI = {
  getAll: async (): Promise<EmailTemplate[]> => [],
  getAllActive: async (): Promise<EmailTemplate[]> => [],
  getById: async (_id: string): Promise<EmailTemplate | null> => null,
  getBySlug: async (_slug: string): Promise<EmailTemplate | null> => null,
  getByCategory: async (_category: EmailTemplate['category']): Promise<EmailTemplate[]> => [],
  create: async (_data: Partial<EmailTemplate>): Promise<EmailTemplate | null> => null,
  update: async (_id: string, _data: Partial<EmailTemplate>): Promise<EmailTemplate | null> => null,
  delete: async (_id: string): Promise<boolean> => false,
  incrementUsage: async (_id: string): Promise<void> => {},
  duplicate: async (_id: string): Promise<EmailTemplate | null> => null,
  getStats: async (): Promise<any> => ({}),
  render: (template: EmailTemplate, variables: Record<string, string>): RenderTemplateResult => {
    return renderTemplate(template, variables)
  },
}

// Aliases for compatibility
export const getAllActiveTemplates = emailTemplatesAPI.getAllActive
export const getAllTemplates = emailTemplatesAPI.getAll
export const getTemplatesByCategory = emailTemplatesAPI.getByCategory
export const getTemplateById = emailTemplatesAPI.getById
export const getTemplateBySlug = emailTemplatesAPI.getBySlug
export const createTemplate = emailTemplatesAPI.create
export const updateTemplate = emailTemplatesAPI.update
export const deleteTemplate = emailTemplatesAPI.delete
export const duplicateTemplate = emailTemplatesAPI.duplicate
export const incrementTemplateUsage = emailTemplatesAPI.incrementUsage
export const getTemplateStats = emailTemplatesAPI.getStats

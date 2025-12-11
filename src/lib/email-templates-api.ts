import { supabase } from './supabase';

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

// Get all active templates
export async function getAllActiveTemplates(): Promise<EmailTemplate[]> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching templates:', error);
    throw error;
  }

  return data || [];
}

// Get all templates (admin only)
export async function getAllTemplates(): Promise<EmailTemplate[]> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching all templates:', error);
    throw error;
  }

  return data || [];
}

// Get templates by category
export async function getTemplatesByCategory(category: EmailTemplate['category']): Promise<EmailTemplate[]> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('category', category)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching templates by category:', error);
    throw error;
  }

  return data || [];
}

// Get template by ID
export async function getTemplateById(templateId: string): Promise<EmailTemplate | null> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (error) {
    console.error('Error fetching template:', error);
    throw error;
  }

  return data;
}

// Get template by slug
export async function getTemplateBySlug(slug: string): Promise<EmailTemplate | null> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    console.error('Error fetching template by slug:', error);
    throw error;
  }

  return data;
}

// Create new template
export async function createTemplate(template: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at' | 'usage_count' | 'last_used_at'>): Promise<EmailTemplate> {
  const { data: userData } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('email_templates')
    .insert({
      ...template,
      created_by: userData?.user?.id,
      updated_by: userData?.user?.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating template:', error);
    throw error;
  }

  return data;
}

// Update template
export async function updateTemplate(templateId: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate> {
  const { data: userData } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('email_templates')
    .update({
      ...updates,
      updated_by: userData?.user?.id,
    })
    .eq('id', templateId)
    .select()
    .single();

  if (error) {
    console.error('Error updating template:', error);
    throw error;
  }

  return data;
}

// Delete template (soft delete by deactivating)
export async function deactivateTemplate(templateId: string): Promise<void> {
  const { error } = await supabase
    .from('email_templates')
    .update({ is_active: false })
    .eq('id', templateId);

  if (error) {
    console.error('Error deactivating template:', error);
    throw error;
  }
}

// Hard delete template (admin only, for user-created templates)
export async function deleteTemplate(templateId: string): Promise<void> {
  const { error } = await supabase
    .from('email_templates')
    .delete()
    .eq('id', templateId);

  if (error) {
    console.error('Error deleting template:', error);
    throw error;
  }
}

// Render template with variables (client-side)
export function renderTemplate(template: EmailTemplate, variables: Record<string, string>): RenderTemplateResult {
  let renderedSubject = template.subject;
  let renderedHtml = template.html_content;
  let renderedText = template.text_content || '';

  // Replace all variables
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    renderedSubject = renderedSubject.replace(new RegExp(placeholder, 'g'), value);
    renderedHtml = renderedHtml.replace(new RegExp(placeholder, 'g'), value);
    renderedText = renderedText.replace(new RegExp(placeholder, 'g'), value);
  });

  return {
    subject: renderedSubject,
    html: renderedHtml,
    text: renderedText || undefined,
  };
}

// Render template with variables (server-side via database function)
export async function renderTemplateOnServer(params: RenderTemplateParams): Promise<RenderTemplateResult> {
  const { data, error } = await supabase.rpc('render_email_template', {
    p_template_id: params.templateId,
    p_variables: params.variables,
  });

  if (error) {
    console.error('Error rendering template on server:', error);
    throw error;
  }

  return data;
}

// Increment template usage
export async function incrementTemplateUsage(templateId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_template_usage', {
    p_template_id: templateId,
  });

  if (error) {
    console.error('Error incrementing template usage:', error);
    // Don't throw, as this is not critical
  }
}

// Clone template (create a new version)
export async function cloneTemplate(templateId: string, newName?: string): Promise<EmailTemplate> {
  const template = await getTemplateById(templateId);
  if (!template) {
    throw new Error('Template not found');
  }

  const { data: userData } = await supabase.auth.getUser();

  const clonedTemplate = {
    ...template,
    name: newName || `${template.name} (Copy)`,
    slug: `${template.slug}-copy-${Date.now()}`,
    parent_template_id: templateId,
    version: 1,
    usage_count: 0,
    template_type: 'user_created' as const,
    created_by: userData?.user?.id,
    updated_by: userData?.user?.id,
  };

  // Remove fields that shouldn't be copied
  delete (clonedTemplate as any).id;
  delete (clonedTemplate as any).created_at;
  delete (clonedTemplate as any).updated_at;
  delete (clonedTemplate as any).last_used_at;

  return createTemplate(clonedTemplate);
}

// Get template statistics
export async function getTemplateStats() {
  const { data, error } = await supabase
    .from('email_templates')
    .select('category, template_type, is_active, usage_count');

  if (error) {
    console.error('Error fetching template stats:', error);
    throw error;
  }

  const stats = {
    total: data.length,
    active: data.filter(t => t.is_active).length,
    inactive: data.filter(t => !t.is_active).length,
    byCategory: {} as Record<string, number>,
    byType: {} as Record<string, number>,
    totalUsage: data.reduce((sum, t) => sum + (t.usage_count || 0), 0),
  };

  data.forEach(template => {
    stats.byCategory[template.category] = (stats.byCategory[template.category] || 0) + 1;
    stats.byType[template.template_type] = (stats.byType[template.template_type] || 0) + 1;
  });

  return stats;
}

export const emailTemplatesAPI = {
  getAllActive: getAllActiveTemplates,
  getAll: getAllTemplates,
  getByCategory: getTemplatesByCategory,
  getById: getTemplateById,
  getBySlug: getTemplateBySlug,
  create: createTemplate,
  update: updateTemplate,
  deactivate: deactivateTemplate,
  delete: deleteTemplate,
  render: renderTemplate,
  renderOnServer: renderTemplateOnServer,
  incrementUsage: incrementTemplateUsage,
  clone: cloneTemplate,
  getStats: getTemplateStats,
};

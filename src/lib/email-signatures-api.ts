import { supabase } from './supabase';

export interface EmailSignature {
  id: string;
  user_id?: string;
  name: string;
  signature_html: string;
  signature_text?: string;
  signature_type: 'personal' | 'company' | 'department';
  is_active: boolean;
  is_default: boolean;
  font_family?: string;
  font_size?: number;
  text_color?: string;
  link_color?: string;
  full_name?: string;
  job_title?: string;
  department?: string;
  company_name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;
  address?: string;
  social_links?: Record<string, string>;
  logo_url?: string;
  logo_width?: number;
  logo_height?: number;
  show_logo?: boolean;
  show_disclaimer?: boolean;
  disclaimer_text?: string;
  show_company_tagline?: boolean;
  company_tagline?: string;
  custom_css?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface BusinessLogo {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  storage_path: string;
  public_url?: string;
  width?: number;
  height?: number;
  logo_type: 'company_logo' | 'email_header' | 'email_signature' | 'favicon' | 'avatar';
  uploaded_by?: string;
  is_active: boolean;
  is_default: boolean;
  usage_count: number;
  last_used_at?: string;
  alt_text?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ============ Email Signatures API ============

export async function getAllSignatures(): Promise<EmailSignature[]> {
  const { data, error } = await supabase
    .from('email_signatures')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching signatures:', error);
    throw error;
  }

  return data || [];
}

export async function getUserSignatures(userId?: string): Promise<EmailSignature[]> {
  const uid = userId || (await supabase.auth.getUser()).data.user?.id;
  
  const { data, error } = await supabase
    .from('email_signatures')
    .select('*')
    .or(`user_id.eq.${uid},signature_type.eq.company`)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching user signatures:', error);
    throw error;
  }

  return data || [];
}

export async function getDefaultSignature(userId?: string): Promise<EmailSignature | null> {
  const uid = userId || (await supabase.auth.getUser()).data.user?.id;
  
  const { data, error } = await supabase
    .from('email_signatures')
    .select('*')
    .or(`user_id.eq.${uid},signature_type.eq.company`)
    .eq('is_default', true)
    .eq('is_active', true)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Error fetching default signature:', error);
  }

  return data;
}

export async function getSignatureById(id: string): Promise<EmailSignature | null> {
  const { data, error } = await supabase
    .from('email_signatures')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching signature:', error);
    throw error;
  }

  return data;
}

export async function createSignature(signature: Partial<EmailSignature>): Promise<EmailSignature> {
  const { data: userData } = await supabase.auth.getUser();
  
  const { data, error} = await supabase
    .from('email_signatures')
    .insert({
      ...signature,
      user_id: signature.user_id || userData?.user?.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating signature:', error);
    throw error;
  }

  return data;
}

export async function updateSignature(id: string, updates: Partial<EmailSignature>): Promise<EmailSignature> {
  const { data, error } = await supabase
    .from('email_signatures')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating signature:', error);
    throw error;
  }

  return data;
}

export async function deleteSignature(id: string): Promise<void> {
  const { error } = await supabase
    .from('email_signatures')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting signature:', error);
    throw error;
  }
}

export async function setDefaultSignature(id: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  if (!userId) throw new Error('User not authenticated');

  // First, unset all default signatures for this user
  await supabase
    .from('email_signatures')
    .update({ is_default: false })
    .eq('user_id', userId);

  // Then set the new default
  const { error } = await supabase
    .from('email_signatures')
    .update({ is_default: true })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('Error setting default signature:', error);
    throw error;
  }
}

export async function generateSignatureHtml(params: {
  full_name?: string;
  job_title?: string;
  company_name?: string;
  email?: string;
  phone?: string;
  website?: string;
  logo_url?: string;
  text_color?: string;
  link_color?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('generate_signature_html', {
    p_full_name: params.full_name,
    p_job_title: params.job_title,
    p_company_name: params.company_name,
    p_email: params.email,
    p_phone: params.phone,
    p_website: params.website,
    p_logo_url: params.logo_url,
    p_text_color: params.text_color || '#333333',
    p_link_color: params.link_color || '#dc2626',
  });

  if (error) {
    console.error('Error generating signature HTML:', error);
    throw error;
  }

  return data;
}

// ============ Business Logos API ============

export async function getAllLogos(): Promise<BusinessLogo[]> {
  const { data, error } = await supabase
    .from('business_logos')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching logos:', error);
    throw error;
  }

  return data || [];
}

export async function getLogosByType(logoType: BusinessLogo['logo_type']): Promise<BusinessLogo[]> {
  const { data, error } = await supabase
    .from('business_logos')
    .select('*')
    .eq('logo_type', logoType)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching logos by type:', error);
    throw error;
  }

  return data || [];
}

export async function getDefaultLogo(logoType: BusinessLogo['logo_type']): Promise<BusinessLogo | null> {
  const { data, error } = await supabase
    .from('business_logos')
    .select('*')
    .eq('logo_type', logoType)
    .eq('is_default', true)
    .eq('is_active', true)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching default logo:', error);
  }

  return data;
}

export async function uploadLogo(
  file: File,
  logoType: BusinessLogo['logo_type'],
  altText?: string
): Promise<BusinessLogo> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  if (!userId) throw new Error('User not authenticated');

  // Generate unique file name
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${logoType}/${fileName}`;

  // Upload file to storage
  const { error: uploadError } = await supabase.storage
    .from('email-logos')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    console.error('Error uploading logo:', uploadError);
    throw uploadError;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('email-logos')
    .getPublicUrl(filePath);

  // Get image dimensions
  const dimensions = await getImageDimensions(file);

  // Insert logo record
  const { data, error } = await supabase
    .from('business_logos')
    .insert({
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      storage_path: filePath,
      public_url: urlData.publicUrl,
      width: dimensions.width,
      height: dimensions.height,
      logo_type: logoType,
      uploaded_by: userId,
      alt_text: altText || file.name,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating logo record:', error);
    throw error;
  }

  return data;
}

export async function deleteLogo(id: string): Promise<void> {
  // Get logo details
  const { data: logo } = await supabase
    .from('business_logos')
    .select('storage_path')
    .eq('id', id)
    .single();

  if (logo?.storage_path) {
    // Delete from storage
    await supabase.storage
      .from('email-logos')
      .remove([logo.storage_path]);
  }

  // Delete record
  const { error } = await supabase
    .from('business_logos')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting logo:', error);
    throw error;
  }
}

export async function setDefaultLogo(id: string, logoType: BusinessLogo['logo_type']): Promise<void> {
  // First, unset all default logos for this type
  await supabase
    .from('business_logos')
    .update({ is_default: false })
    .eq('logo_type', logoType);

  // Then set the new default
  const { error } = await supabase
    .from('business_logos')
    .update({ is_default: true })
    .eq('id', id);

  if (error) {
    console.error('Error setting default logo:', error);
    throw error;
  }
}

export async function incrementLogoUsage(id: string): Promise<void> {
  const { error } = await supabase.rpc('increment_logo_usage', {
    p_logo_id: id,
  });

  if (error) {
    console.error('Error incrementing logo usage:', error);
    // Don't throw, as this is not critical
  }
}

// Helper function to get image dimensions
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

// Export all as a single API object
export const emailSignaturesAPI = {
  getAll: getAllSignatures,
  getUserSignatures,
  getDefault: getDefaultSignature,
  getById: getSignatureById,
  create: createSignature,
  update: updateSignature,
  delete: deleteSignature,
  setDefault: setDefaultSignature,
  generateHtml: generateSignatureHtml,
};

export const businessLogosAPI = {
  getAll: getAllLogos,
  getByType: getLogosByType,
  getDefault: getDefaultLogo,
  upload: uploadLogo,
  delete: deleteLogo,
  setDefault: setDefaultLogo,
  incrementUsage: incrementLogoUsage,
};


/**
 * Email Signatures API
 * Handles email signatures and business logos
 * NOTE: This feature is currently stubbed pending full migration
 */

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
  associated_email?: string;
}

// Stubbed API - feature pending migration
export async function getAllSignatures(): Promise<EmailSignature[]> {
  return [];
}

export async function getSignatureById(_id: string): Promise<EmailSignature | null> {
  return null;
}

export async function getDefaultSignature(): Promise<EmailSignature | null> {
  return null;
}

export async function createSignature(_data: Partial<EmailSignature>): Promise<EmailSignature | null> {
  console.warn('Email signatures feature is not yet migrated');
  return null;
}

export async function updateSignature(_id: string, _data: Partial<EmailSignature>): Promise<EmailSignature | null> {
  console.warn('Email signatures feature is not yet migrated');
  return null;
}

export async function deleteSignature(_id: string): Promise<boolean> {
  console.warn('Email signatures feature is not yet migrated');
  return false;
}

export async function setDefaultSignature(_id: string): Promise<boolean> {
  console.warn('Email signatures feature is not yet migrated');
  return false;
}

export async function renderSignatureHtml(_signature: EmailSignature): Promise<string> {
  return '';
}

export async function getAllLogos(): Promise<BusinessLogo[]> {
  return [];
}

export async function getLogoById(_id: string): Promise<BusinessLogo | null> {
  return null;
}

export async function getDefaultLogo(): Promise<BusinessLogo | null> {
  return null;
}

export async function uploadLogo(_file: File, _options?: any): Promise<BusinessLogo | null> {
  console.warn('Business logos feature is not yet migrated');
  return null;
}

export async function deleteLogo(_id: string): Promise<boolean> {
  console.warn('Business logos feature is not yet migrated');
  return false;
}

export async function setDefaultLogo(_id: string): Promise<boolean> {
  console.warn('Business logos feature is not yet migrated');
  return false;
}

export async function updateLogoMetadata(_id: string, _metadata: Record<string, any>): Promise<BusinessLogo | null> {
  console.warn('Business logos feature is not yet migrated');
  return null;
}

// API objects for compatibility
export const emailSignaturesAPI = {
  getAll: getAllSignatures,
  getById: getSignatureById,
  getDefault: getDefaultSignature,
  create: createSignature,
  update: updateSignature,
  delete: deleteSignature,
  setDefault: setDefaultSignature,
  render: renderSignatureHtml,
}

export const businessLogosAPI = {
  getAll: getAllLogos,
  getById: getLogoById,
  getDefault: getDefaultLogo,
  upload: uploadLogo,
  delete: deleteLogo,
  setDefault: setDefaultLogo,
  updateMetadata: updateLogoMetadata,
}

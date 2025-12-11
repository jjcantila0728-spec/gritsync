import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, Image as ImageIcon, Upload, Check, Star, Eye } from 'lucide-react';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { cn } from '../lib/utils';
import { 
  emailSignaturesAPI, 
  businessLogosAPI, 
  EmailSignature, 
  BusinessLogo 
} from '../lib/email-signatures-api';

type Tab = 'signatures' | 'logos';

export default function AdminEmailSignatures() {
  const [activeTab, setActiveTab] = useState<Tab>('signatures');
  const [signatures, setSignatures] = useState<EmailSignature[]>([]);
  const [logos, setLogos] = useState<BusinessLogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingSignature, setEditingSignature] = useState<Partial<EmailSignature> | null>(null);
  const [showLogoUpload, setShowLogoUpload] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sigs, lgos] = await Promise.all([
        emailSignaturesAPI.getAll(),
        businessLogosAPI.getAll(),
      ]);
      setSignatures(sigs);
      setLogos(lgos);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSignature = () => {
    setEditingSignature({
      name: '',
      signature_html: '',
      signature_text: '',
      signature_type: 'personal',
      is_active: true,
      is_default: false,
      font_family: 'Arial, sans-serif',
      font_size: 14,
      text_color: '#333333',
      link_color: '#dc2626',
      show_logo: true,
    });
    setShowEditor(true);
  };

  const handleEditSignature = (signature: EmailSignature) => {
    setEditingSignature(signature);
    setShowEditor(true);
  };

  const handleSaveSignature = async () => {
    if (!editingSignature) return;

    if (!editingSignature.name || !editingSignature.signature_html) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      if (editingSignature.id) {
        await emailSignaturesAPI.update(editingSignature.id, editingSignature);
        alert('Signature updated successfully');
      } else {
        await emailSignaturesAPI.create(editingSignature);
        alert('Signature created successfully');
      }
      setShowEditor(false);
      setEditingSignature(null);
      loadData();
    } catch (error) {
      console.error('Error saving signature:', error);
      alert('Failed to save signature');
    }
  };

  const handleDeleteSignature = async (id: string) => {
    if (!confirm('Are you sure you want to delete this signature?')) return;

    try {
      await emailSignaturesAPI.delete(id);
      alert('Signature deleted successfully');
      loadData();
    } catch (error) {
      console.error('Error deleting signature:', error);
      alert('Failed to delete signature');
    }
  };

  const handleSetDefaultSignature = async (id: string) => {
    try {
      await emailSignaturesAPI.setDefault(id);
      alert('Default signature updated');
      loadData();
    } catch (error) {
      console.error('Error setting default signature:', error);
      alert('Failed to set default signature');
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>, logoType: BusinessLogo['logo_type']) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    try {
      setUploadingLogo(true);
      await businessLogosAPI.upload(file, logoType, file.name);
      alert('Logo uploaded successfully');
      loadData();
      setShowLogoUpload(false);
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleDeleteLogo = async (id: string) => {
    if (!confirm('Are you sure you want to delete this logo?')) return;

    try {
      await businessLogosAPI.delete(id);
      alert('Logo deleted successfully');
      loadData();
    } catch (error) {
      console.error('Error deleting logo:', error);
      alert('Failed to delete logo');
    }
  };

  const handleSetDefaultLogo = async (id: string, logoType: BusinessLogo['logo_type']) => {
    try {
      await businessLogosAPI.setDefault(id, logoType);
      alert('Default logo updated');
      loadData();
    } catch (error) {
      console.error('Error setting default logo:', error);
      alert('Failed to set default logo');
    }
  };

  const handleGenerateSignature = async () => {
    if (!editingSignature) return;

    try {
      const html = await emailSignaturesAPI.generateHtml({
        full_name: editingSignature.full_name,
        job_title: editingSignature.job_title,
        company_name: editingSignature.company_name,
        email: editingSignature.email,
        phone: editingSignature.phone,
        website: editingSignature.website,
        logo_url: editingSignature.logo_url,
        text_color: editingSignature.text_color,
        link_color: editingSignature.link_color,
      });

      setEditingSignature({
        ...editingSignature,
        signature_html: html,
      });
      alert('Signature generated successfully');
    } catch (error) {
      console.error('Error generating signature:', error);
      alert('Failed to generate signature');
    }
  };

  if (showEditor) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <div className="p-6">
              {/* Header */}
              <div className="mb-6 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 dark:from-primary-600 dark:to-primary-700 p-6 shadow-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-2xl font-bold text-white">
                      {editingSignature?.id ? 'Edit Signature' : 'Create New Signature'}
                    </h1>
                    <p className="text-primary-100 mt-1">Design your professional email signature</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowEditor(false);
                        setEditingSignature(null);
                      }}
                      className="px-4 py-2 text-white bg-white/20 border border-white/30 rounded-lg hover:bg-white/30"
                    >
                      <X className="h-5 w-5 inline mr-2" />
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveSignature}
                      className="px-4 py-2 text-primary-600 bg-white rounded-lg hover:bg-primary-50 font-medium"
                    >
                      <Save className="h-5 w-5 inline mr-2" />
                      Save Signature
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Editor Panel */}
                <div className="space-y-4">
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Signature Details</h2>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Signature Name <span className="text-primary-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editingSignature?.name || ''}
                          onChange={(e) => setEditingSignature({ ...editingSignature, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                          placeholder="e.g., Professional Signature"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                        <select
                          value={editingSignature?.signature_type || 'personal'}
                          onChange={(e) => setEditingSignature({ ...editingSignature, signature_type: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                        >
                          <option value="personal">Personal</option>
                          <option value="company">Company</option>
                          <option value="department">Department</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editingSignature?.is_active || false}
                              onChange={(e) => setEditingSignature({ ...editingSignature, is_active: e.target.checked })}
                              className="rounded border-gray-300 text-primary-600"
                            />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</span>
                          </label>
                        </div>
                        <div>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editingSignature?.is_default || false}
                              onChange={(e) => setEditingSignature({ ...editingSignature, is_default: e.target.checked })}
                              className="rounded border-gray-300 text-primary-600"
                            />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Default</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Contact Information</h2>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                          <input
                            type="text"
                            value={editingSignature?.full_name || ''}
                            onChange={(e) => setEditingSignature({ ...editingSignature, full_name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Job Title</label>
                          <input
                            type="text"
                            value={editingSignature?.job_title || ''}
                            onChange={(e) => setEditingSignature({ ...editingSignature, job_title: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Name</label>
                          <input
                            type="text"
                            value={editingSignature?.company_name || ''}
                            onChange={(e) => setEditingSignature({ ...editingSignature, company_name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
                          <input
                            type="text"
                            value={editingSignature?.department || ''}
                            onChange={(e) => setEditingSignature({ ...editingSignature, department: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                        <input
                          type="email"
                          value={editingSignature?.email || ''}
                          onChange={(e) => setEditingSignature({ ...editingSignature, email: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                          <input
                            type="tel"
                            value={editingSignature?.phone || ''}
                            onChange={(e) => setEditingSignature({ ...editingSignature, phone: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Website</label>
                          <input
                            type="url"
                            value={editingSignature?.website || ''}
                            onChange={(e) => setEditingSignature({ ...editingSignature, website: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Logo URL</label>
                        <input
                          type="url"
                          value={editingSignature?.logo_url || ''}
                          onChange={(e) => setEditingSignature({ ...editingSignature, logo_url: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                          placeholder="Select from uploaded logos or paste URL"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleGenerateSignature}
                        className="w-full px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg hover:from-primary-600 hover:to-primary-700 font-medium"
                      >
                        Generate Signature from Info
                      </button>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                      HTML Content <span className="text-primary-500">*</span>
                    </h2>
                    <textarea
                      value={editingSignature?.signature_html || ''}
                      onChange={(e) => setEditingSignature({ ...editingSignature, signature_html: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm dark:bg-gray-700 dark:text-white"
                      rows={10}
                      placeholder="Enter HTML signature content or use the generator above"
                    />
                  </div>
                </div>

                {/* Preview Panel */}
                <div className="space-y-4 sticky top-6">
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Preview</h2>
                    <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-900">
                      <div dangerouslySetInnerHTML={{ __html: editingSignature?.signature_html || '<p class="text-gray-400">No signature content yet</p>' }} />
                    </div>
                  </div>

                  {/* Available Logos */}
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Available Logos</h2>
                    <div className="grid grid-cols-2 gap-3">
                      {logos.filter(l => l.logo_type === 'email_signature').map(logo => (
                        <div
                          key={logo.id}
                          onClick={() => setEditingSignature({ ...editingSignature, logo_url: logo.public_url })}
                          className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:border-primary-500 dark:hover:border-primary-400 transition-colors"
                        >
                          <img src={logo.public_url} alt={logo.alt_text} className="w-full h-12 object-contain mb-2" />
                          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{logo.file_name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {/* Header */}
            <div className="mb-6 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 dark:from-primary-600 dark:to-primary-700 p-8 shadow-lg">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">Email Signatures & Logos</h1>
                  <p className="text-primary-100">Manage professional signatures and business logos</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowLogoUpload(true)}
                    className="px-6 py-3 text-primary-600 bg-white rounded-lg hover:bg-primary-50 font-medium shadow-lg"
                  >
                    <Upload className="h-5 w-5 inline mr-2" />
                    Upload Logo
                  </button>
                  <button
                    onClick={handleCreateSignature}
                    className="px-6 py-3 text-primary-600 bg-white rounded-lg hover:bg-primary-50 font-medium shadow-lg"
                  >
                    <Plus className="h-5 w-5 inline mr-2" />
                    Create Signature
                  </button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="mb-6 flex gap-2">
              <button
                onClick={() => setActiveTab('signatures')}
                className={cn(
                  'px-6 py-3 rounded-lg font-medium transition-all',
                  activeTab === 'signatures'
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                )}
              >
                Email Signatures ({signatures.length})
              </button>
              <button
                onClick={() => setActiveTab('logos')}
                className={cn(
                  'px-6 py-3 rounded-lg font-medium transition-all',
                  activeTab === 'logos'
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                )}
              >
                Business Logos ({logos.length})
              </button>
            </div>

            {/* Content */}
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
              </div>
            ) : activeTab === 'signatures' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {signatures.map(sig => (
                  <div
                    key={sig.id}
                    className={cn(
                      'bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border hover:shadow-xl transition-all',
                      sig.is_default
                        ? 'border-primary-500 dark:border-primary-400 ring-2 ring-primary-200 dark:ring-primary-800'
                        : 'border-gray-200 dark:border-gray-700'
                    )}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{sig.name}</h3>
                        <p className="text-sm text-primary-600 dark:text-primary-400 font-medium mt-1">{sig.signature_type}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {sig.is_default && (
                          <span className="px-2 py-1 text-xs bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded font-medium flex items-center gap-1">
                            <Star className="h-3 w-3" fill="currentColor" />
                            Default
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-4 bg-gray-50 dark:bg-gray-900 max-h-40 overflow-auto">
                      <div dangerouslySetInnerHTML={{ __html: sig.signature_html }} className="text-sm" />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditSignature(sig)}
                        className="flex-1 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 font-medium"
                      >
                        <Edit className="h-4 w-4 inline mr-1" />
                        Edit
                      </button>
                      {!sig.is_default && (
                        <button
                          onClick={() => handleSetDefaultSignature(sig.id)}
                          className="px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                          title="Set as default"
                        >
                          <Star className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteSignature(sig.id)}
                        className="px-3 py-2 text-sm text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded hover:bg-primary-100 dark:hover:bg-primary-900/30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {logos.map(logo => (
                  <div
                    key={logo.id}
                    className={cn(
                      'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border hover:shadow-xl transition-all',
                      logo.is_default
                        ? 'border-primary-500 dark:border-primary-400 ring-2 ring-primary-200 dark:ring-primary-800'
                        : 'border-gray-200 dark:border-gray-700'
                    )}
                  >
                    <div className="aspect-square bg-gray-50 dark:bg-gray-900 rounded-lg mb-3 flex items-center justify-center p-4">
                      <img src={logo.public_url} alt={logo.alt_text} className="max-w-full max-h-full object-contain" />
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate mb-1">{logo.file_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{logo.logo_type}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      {(logo.file_size / 1024).toFixed(1)} KB • {logo.width}×{logo.height}
                    </p>
                    <div className="flex gap-2">
                      {!logo.is_default && (
                        <button
                          onClick={() => handleSetDefaultLogo(logo.id, logo.logo_type)}
                          className="flex-1 px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900/30 font-medium"
                          title="Set as default"
                        >
                          <Star className="h-4 w-4 inline" />
                        </button>
                      )}
                      {logo.is_default && (
                        <div className="flex-1 px-3 py-2 text-sm text-center bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded font-medium">
                          <Check className="h-4 w-4 inline" /> Default
                        </div>
                      )}
                      <button
                        onClick={() => handleDeleteLogo(logo.id)}
                        className="px-3 py-2 text-sm text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded hover:bg-primary-100 dark:hover:bg-primary-900/30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Logo Upload Modal */}
      {showLogoUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
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
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
    </div>
  );
}


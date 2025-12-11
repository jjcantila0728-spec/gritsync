import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';

export default function AdminEmailTemplates() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Email Templates
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              The full email templates management interface is currently being updated.
            </p>
            <button
              onClick={() => navigate('/admin/emails')}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Go to Email Management
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

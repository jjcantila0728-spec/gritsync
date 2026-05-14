import { Card } from '@/components/ui/Card'
import { Copy, User, Mail, Phone, MapPin, Calendar, GraduationCap, School } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { copyToClipboard } from '../utils/clipboardHelpers'

// Converts stored date strings → "Month YYYY" display
// Handles: "MM/YYYY", "YYYY-MM", "YYYY-MM-DD"
function formatMMYYYYDisplay(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A'
  // MM/YYYY format (e.g. "06/2000")
  if (/^(0[1-9]|1[0-2])\/\d{4}$/.test(dateStr)) {
    const [mm, yyyy] = dateStr.split('/')
    return new Date(Number(yyyy), Number(mm) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
  // YYYY-MM format (e.g. "2000-06")
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(dateStr)) {
    const [yyyy, mm] = dateStr.split('-')
    return new Date(Number(yyyy), Number(mm) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
  // YYYY-MM-DD format (e.g. "2000-06-01")
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
  return dateStr
}
import type { ApplicationData } from '../types'
import { Link } from 'react-router-dom'

interface DetailsTabProps {
  application: ApplicationData
  detailsSubTab: string
  setDetailsSubTab: (tab: string) => void
  setApplication: (app: ApplicationData | ((prev: ApplicationData | null) => ApplicationData | null)) => void
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void
  applicationId: string
  isAdmin: boolean
}

export function DetailsTab({
  application,
  detailsSubTab,
  showToast,
  applicationId,
  isAdmin
}: DetailsTabProps) {
  return (
    <div>
      {/* Sub-tabs for Details */}
      <div className="mb-4 border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1" aria-label="Detail Sections">
          {([
            { id: 'personal', label: 'Personal', icon: User },
            { id: 'contact', label: 'Contact', icon: Mail },
            { id: 'education', label: 'Education', icon: GraduationCap }
          ]).map((subTab) => {
            const Icon = subTab.icon
            const isActive = detailsSubTab === subTab.id
            const basePath = isAdmin ? '/admin/applications' : '/applications'
            const subTabPath = `${basePath}/${applicationId}/details/${subTab.id}`
            return (
              <Link
                key={subTab.id}
                to={subTabPath}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
                  isActive
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {subTab.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Personal Information */}
      {detailsSubTab === 'personal' && (
        <Card>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              <div className="flex items-center gap-1.5 py-1">
                <User className="h-3 w-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">First:</span>
                <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.first_name || 'N/A'}</span>
                {application.first_name && (
                  <button
                    onClick={() => copyToClipboard(application.first_name, 'First name', showToast)}
                    className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                    title="Copy First Name"
                  >
                    <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 py-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Middle:</span>
                <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.middle_name || 'N/A'}</span>
                {application.middle_name && (
                  <button
                    onClick={() => copyToClipboard(application.middle_name, 'Middle name', showToast)}
                    className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                    title="Copy Middle Name"
                  >
                    <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 py-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Last:</span>
                <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.last_name || 'N/A'}</span>
                {application.last_name && (
                  <button
                    onClick={() => copyToClipboard(application.last_name, 'Last name', showToast)}
                    className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                    title="Copy Last Name"
                  >
                    <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 py-1">
                <Calendar className="h-3 w-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">DOB:</span>
                <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">
                  {application.date_of_birth ? formatDate(application.date_of_birth) : 'N/A'}
                </span>
                {application.date_of_birth && (
                  <button
                    onClick={() => copyToClipboard(application.date_of_birth, 'Date of birth', showToast)}
                    className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                    title="Copy Date of Birth"
                  >
                    <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 py-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Gender:</span>
                <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">
                  {application.gender || 'N/A'}
                </span>
                {application.gender && (
                  <button
                    onClick={() => copyToClipboard(application.gender || '', 'Gender', showToast)}
                    className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                    title="Copy Gender"
                  >
                    <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 py-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Status:</span>
                <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.marital_status || 'N/A'}</span>
                {application.marital_status && (
                  <button
                    onClick={() => copyToClipboard(application.marital_status, 'Marital status', showToast)}
                    className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                    title="Copy Marital Status"
                  >
                    <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                  </button>
                )}
              </div>

              {(application.single_name || application.single_full_name) && (
                <div className="flex items-center gap-1.5 py-1 md:col-span-2 lg:col-span-3">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Single Name:</span>
                  <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.single_name || application.single_full_name || 'N/A'}</span>
                  <button
                    onClick={() => copyToClipboard(application.single_name || application.single_full_name || '', 'Single name', showToast)}
                    className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                    title="Copy Single Name"
                  >
                    <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
              )}


              {application.country_of_birth && (
                <div className="flex items-center gap-1.5 py-1">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Country:</span>
                  <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.country_of_birth}</span>
                  <button
                    onClick={() => copyToClipboard(application.country_of_birth || '', 'Country of birth', showToast)}
                    className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                    title="Copy Country of Birth"
                  >
                    <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
              )}
                  {(application.place_of_birth || application.birth_place) && (
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Place:</span>
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.place_of_birth || application.birth_place}</span>
                      <button
                        onClick={() => copyToClipboard(application.place_of_birth || application.birth_place || '', 'Place of birth', showToast)}
                        className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                        title="Copy Place of Birth"
                      >
                        <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                  )}
            </div>
          </div>
        </Card>
      )}

      {/* Contact Information */}
      {detailsSubTab === 'contact' && (
        <Card>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              <div className="flex items-center gap-1.5 py-1">
                <Mail className="h-3 w-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Email:</span>
                <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.email || 'N/A'}</span>
                {application.email && (
                  <button
                    onClick={() => copyToClipboard(application.email, 'Email', showToast)}
                    className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                    title="Copy Email"
                  >
                    <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 py-1">
                <Phone className="h-3 w-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Mobile:</span>
                <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.mobile_number || 'N/A'}</span>
                {application.mobile_number && (
                  <button
                    onClick={() => copyToClipboard(application.mobile_number, 'Mobile number', showToast)}
                    className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                    title="Copy Mobile Number"
                  >
                    <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                  </button>
                )}
              </div>

              <div className="flex items-start gap-1.5 py-1 md:col-span-2 lg:col-span-3">
                <MapPin className="h-3 w-3 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Address:</div>
                  <div className="space-y-0.5">
                        {(application.house_number || application.street_name) && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">
                              {[application.house_number, application.street_name].filter(Boolean).join(' ')}
                            </span>
                            <button
                              onClick={() => copyToClipboard([application.house_number, application.street_name].filter(Boolean).join(' '), 'Street address', showToast)}
                              className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                              title="Copy Address"
                            >
                              <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                            </button>
                          </div>
                        )}
                        {application.mailing_address && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.mailing_address}</span>
                            <button
                              onClick={() => copyToClipboard(application.mailing_address || '', 'Mailing address', showToast)}
                              className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                              title="Copy Mailing Address"
                            >
                              <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                            </button>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">
                            {[
                              application.city,
                              application.province,
                              application.zipcode,
                              application.country
                            ].filter(Boolean).join(', ')}
                          </span>
                          <button
                            onClick={() => copyToClipboard([
                              application.city,
                              application.province,
                              application.zipcode,
                              application.country
                            ].filter(Boolean).join(', '), 'City/Province/ZIP', showToast)}
                            className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                            title="Copy City/Province/ZIP"
                          >
                            <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                          </button>
                        </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Education Information */}
      {detailsSubTab === 'education' && (
        <div className="space-y-3">
          {/* Elementary School */}
          <Card>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <School className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Elementary School</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                <div className="flex items-center gap-1.5 py-1">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Name:</span>
                  <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.elementary_school || 'N/A'}</span>
                  {application.elementary_school && (
                    <button
                      onClick={() => copyToClipboard(application.elementary_school || '', 'Elementary school', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy School Name"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 py-1">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Location:</span>
                  <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">
                    {[
                      application.elementary_city,
                      application.elementary_province,
                      application.elementary_country
                    ].filter(Boolean).join(', ') || 'N/A'}
                  </span>
                  {[application.elementary_city, application.elementary_province, application.elementary_country].filter(Boolean).length > 0 && (
                    <button
                      onClick={() => copyToClipboard([
                        application.elementary_city,
                        application.elementary_province,
                        application.elementary_country
                      ].filter(Boolean).join(', '), 'Elementary location', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Location"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  )}
                </div>
                {(application.elementary_start_date || application.elementary_end_date) && (
                  <div className="flex items-center gap-1.5 py-1 md:col-span-2 lg:col-span-3">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Years:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">
                      {application.elementary_start_date && application.elementary_end_date
                        ? `${formatMMYYYYDisplay(application.elementary_start_date)} - ${formatMMYYYYDisplay(application.elementary_end_date)}`
                        : application.elementary_years_attended || 'N/A'}
                    </span>
                    {(application.elementary_start_date || application.elementary_end_date || application.elementary_years_attended) && (
                      <button
                        onClick={() => copyToClipboard(
                          application.elementary_start_date && application.elementary_end_date
                            ? `${formatMMYYYYDisplay(application.elementary_start_date)} - ${formatMMYYYYDisplay(application.elementary_end_date)}`
                            : application.elementary_years_attended || '',
                          'Elementary years', showToast)}
                        className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                        title="Copy Years"
                      >
                        <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* High School */}
          <Card>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <School className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">High School</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                <div className="flex items-center gap-1.5 py-1">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Name:</span>
                  <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.high_school || 'N/A'}</span>
                  {application.high_school && (
                    <button
                      onClick={() => copyToClipboard(application.high_school || '', 'High school', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy School Name"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 py-1">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Location:</span>
                  <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">
                    {[
                      application.high_school_city,
                      application.high_school_province,
                      application.high_school_country
                    ].filter(Boolean).join(', ') || 'N/A'}
                  </span>
                  {[application.high_school_city, application.high_school_province, application.high_school_country].filter(Boolean).length > 0 && (
                    <button
                      onClick={() => copyToClipboard([
                        application.high_school_city,
                        application.high_school_province,
                        application.high_school_country
                      ].filter(Boolean).join(', '), 'High school location', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Location"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  )}
                </div>
                {(application.high_school_start_date || application.high_school_end_date) && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Years:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">
                      {application.high_school_start_date && application.high_school_end_date
                        ? `${formatMMYYYYDisplay(application.high_school_start_date)} - ${formatMMYYYYDisplay(application.high_school_end_date)}`
                        : application.high_school_years_attended || 'N/A'}
                    </span>
                    {(application.high_school_start_date || application.high_school_end_date || application.high_school_years_attended) && (
                      <button
                        onClick={() => copyToClipboard(
                          application.high_school_start_date && application.high_school_end_date
                            ? `${formatMMYYYYDisplay(application.high_school_start_date)} - ${formatMMYYYYDisplay(application.high_school_end_date)}`
                            : application.high_school_years_attended || '',
                          'High school years', showToast)}
                        className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                        title="Copy Years"
                      >
                        <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      </button>
                    )}
                  </div>
                )}
                {application.high_school_graduated && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Graduated:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.high_school_graduated}</span>
                    <button
                      onClick={() => copyToClipboard(application.high_school_graduated || '', 'High school graduated', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Graduated"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
                {application.high_school_diploma_date && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Diploma:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{formatDate(application.high_school_diploma_date)}</span>
                    <button
                      onClick={() => copyToClipboard(application.high_school_diploma_date || '', 'High school diploma date', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Diploma Date"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Nursing School */}
          <Card>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Nursing School</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                <div className="flex items-center gap-1.5 py-1">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Name:</span>
                  <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.nursing_school || 'N/A'}</span>
                  {application.nursing_school && (
                    <button
                      onClick={() => copyToClipboard(application.nursing_school || '', 'Nursing school', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy School Name"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 py-1">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Location:</span>
                  <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">
                    {[
                      application.nursing_school_city,
                      application.nursing_school_province,
                      application.nursing_school_country
                    ].filter(Boolean).join(', ') || 'N/A'}
                  </span>
                  {[application.nursing_school_city, application.nursing_school_province, application.nursing_school_country].filter(Boolean).length > 0 && (
                    <button
                      onClick={() => copyToClipboard([
                        application.nursing_school_city,
                        application.nursing_school_province,
                        application.nursing_school_country
                      ].filter(Boolean).join(', '), 'Nursing school location', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Location"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  )}
                </div>
                {(application.nursing_school_start_date || application.nursing_school_end_date) && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Years:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">
                      {application.nursing_school_start_date && application.nursing_school_end_date
                        ? `${formatMMYYYYDisplay(application.nursing_school_start_date)} - ${formatMMYYYYDisplay(application.nursing_school_end_date)}`
                        : application.nursing_school_years_attended || 'N/A'}
                    </span>
                    {(application.nursing_school_start_date || application.nursing_school_end_date || application.nursing_school_years_attended) && (
                      <button
                        onClick={() => copyToClipboard(
                          application.nursing_school_start_date && application.nursing_school_end_date
                            ? `${formatMMYYYYDisplay(application.nursing_school_start_date)} - ${formatMMYYYYDisplay(application.nursing_school_end_date)}`
                            : application.nursing_school_years_attended || '',
                          'Nursing school years', showToast)}
                        className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                        title="Copy Years"
                      >
                        <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      </button>
                    )}
                  </div>
                )}
                {application.nursing_school_major && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Major:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.nursing_school_major}</span>
                    <button
                      onClick={() => copyToClipboard(application.nursing_school_major || '', 'Nursing school major', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Major"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
                {application.nursing_school_diploma_date && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Diploma:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{formatMMYYYYDisplay(application.nursing_school_diploma_date)}</span>
                    <button
                      onClick={() => copyToClipboard(formatMMYYYYDisplay(application.nursing_school_diploma_date), 'Nursing school diploma date', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Diploma Date"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

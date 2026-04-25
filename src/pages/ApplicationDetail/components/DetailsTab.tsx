import { Card } from '@/components/ui/Card'
import { Copy, User, Mail, Phone, MapPin, Calendar, GraduationCap, School, Building2, FileText } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { copyToClipboard } from '../utils/clipboardHelpers'
import type { ApplicationData } from '../types'
import { Link } from 'react-router-dom'

interface DetailsTabProps {
  application: ApplicationData
  isEADApplication?: boolean
  detailsSubTab: string
  setDetailsSubTab: (tab: string) => void
  setApplication: (app: ApplicationData | ((prev: ApplicationData | null) => ApplicationData | null)) => void
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void
  applicationId: string
  isAdmin: boolean
}

export function DetailsTab({
  application,
  isEADApplication,
  detailsSubTab,
  setDetailsSubTab,
  setApplication,
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
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">{isEADApplication ? 'Sex:' : 'Gender:'}</span>
                <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">
                  {isEADApplication ? (application.sex || application.gender || 'N/A') : (application.gender || 'N/A')}
                </span>
                {(isEADApplication ? (application.sex || application.gender) : application.gender) && (
                  <button
                    onClick={() => copyToClipboard(isEADApplication ? (application.sex || application.gender || '') : (application.gender || ''), isEADApplication ? 'Sex' : 'Gender', showToast)}
                    className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                    title={`Copy ${isEADApplication ? 'Sex' : 'Gender'}`}
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

              {application.marital_status === 'single' && application.single_name && (
                <div className="flex items-center gap-1.5 py-1 md:col-span-2 lg:col-span-3">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Single Name:</span>
                  <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.single_name || application.single_full_name || 'N/A'}</span>
                  {(application.single_name || application.single_full_name) && (
                    <button
                      onClick={() => copyToClipboard(application.single_name || application.single_full_name || '', 'Single name', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Single Name"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  )}
                </div>
              )}


              {application.country_of_birth && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Country of Birth
                  </label>
                  <p className="text-gray-900 dark:text-gray-100">{application.country_of_birth}</p>
                </div>
              )}

              {isEADApplication ? (
                <>
                  {application.birth_city && (
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Birth City:</span>
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.birth_city}</span>
                      <button
                        onClick={() => copyToClipboard(application.birth_city, 'Birth city', showToast)}
                        className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                        title="Copy Birth City"
                      >
                        <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                  )}
                  {application.birth_state && (
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Birth State:</span>
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.birth_state}</span>
                      <button
                        onClick={() => copyToClipboard(application.birth_state, 'Birth state', showToast)}
                        className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                        title="Copy Birth State"
                      >
                        <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                  )}
                  {application.birth_country && (
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Birth Country:</span>
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.birth_country}</span>
                      <button
                        onClick={() => copyToClipboard(application.birth_country, 'Birth country', showToast)}
                        className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                        title="Copy Birth Country"
                      >
                        <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                  )}
                  {application.citizenship_countries && Array.isArray(application.citizenship_countries) && application.citizenship_countries.length > 0 && (
                    <div className="flex items-center gap-1.5 py-1 md:col-span-2 lg:col-span-3">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Citizenship:</span>
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.citizenship_countries.join(', ')}</span>
                      <button
                        onClick={() => copyToClipboard(application.citizenship_countries.join(', '), 'Citizenship countries', showToast)}
                        className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                        title="Copy Citizenship Countries"
                      >
                        <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
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
                </>
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
                    {isEADApplication ? (
                      <>
                        {application.street_address && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">
                              {[application.street_address, application.apartment_suite].filter(Boolean).join(', ')}
                            </span>
                            <button
                              onClick={() => copyToClipboard([application.street_address, application.apartment_suite].filter(Boolean).join(', '), 'Street address', showToast)}
                              className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                              title="Copy Address"
                            >
                              <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                            </button>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">
                            {[
                              application.city,
                              application.state,
                              application.zip_code,
                              application.country
                            ].filter(Boolean).join(', ')}
                          </span>
                          <button
                            onClick={() => copyToClipboard([
                              application.city,
                              application.state,
                              application.zip_code,
                              application.country
                            ].filter(Boolean).join(', '), 'City/State/ZIP', showToast)}
                            className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                            title="Copy City/State/ZIP"
                          >
                            <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Education Information (NCLEX only) */}
      {detailsSubTab === 'education' && !isEADApplication && (
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
                      onClick={() => copyToClipboard(application.elementary_school, 'Elementary school', showToast)}
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
                        ? `${formatDate(application.elementary_start_date)} - ${formatDate(application.elementary_end_date)}`
                        : application.elementary_years_attended || 'N/A'}
                    </span>
                    {(application.elementary_start_date || application.elementary_end_date || application.elementary_years_attended) && (
                      <button
                        onClick={() => copyToClipboard(
                          application.elementary_start_date && application.elementary_end_date
                            ? `${formatDate(application.elementary_start_date)} - ${formatDate(application.elementary_end_date)}`
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
                      onClick={() => copyToClipboard(application.high_school, 'High school', showToast)}
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
                        ? `${formatDate(application.high_school_start_date)} - ${formatDate(application.high_school_end_date)}`
                        : application.high_school_years_attended || 'N/A'}
                    </span>
                    {(application.high_school_start_date || application.high_school_end_date || application.high_school_years_attended) && (
                      <button
                        onClick={() => copyToClipboard(
                          application.high_school_start_date && application.high_school_end_date
                            ? `${formatDate(application.high_school_start_date)} - ${formatDate(application.high_school_end_date)}`
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
                      onClick={() => copyToClipboard(application.high_school_graduated, 'High school graduated', showToast)}
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
                      onClick={() => copyToClipboard(application.high_school_diploma_date, 'High school diploma date', showToast)}
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
                      onClick={() => copyToClipboard(application.nursing_school, 'Nursing school', showToast)}
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
                        ? `${formatDate(application.nursing_school_start_date)} - ${formatDate(application.nursing_school_end_date)}`
                        : application.nursing_school_years_attended || 'N/A'}
                    </span>
                    {(application.nursing_school_start_date || application.nursing_school_end_date || application.nursing_school_years_attended) && (
                      <button
                        onClick={() => copyToClipboard(
                          application.nursing_school_start_date && application.nursing_school_end_date
                            ? `${formatDate(application.nursing_school_start_date)} - ${formatDate(application.nursing_school_end_date)}`
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
                      onClick={() => copyToClipboard(application.nursing_school_major, 'Nursing school major', showToast)}
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
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{formatDate(application.nursing_school_diploma_date)}</span>
                    <button
                      onClick={() => copyToClipboard(application.nursing_school_diploma_date, 'Nursing school diploma date', showToast)}
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

      {/* EAD Information (EAD only) */}
      {detailsSubTab === 'ead-info' && isEADApplication && (
        <div className="space-y-3">
          {/* Reason for Filing */}
          <Card>
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Reason for Filing</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                <div className="flex items-center gap-1.5 py-1">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Reason:</span>
                  <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">
                    {application.reason_for_filing === 'initial' ? 'Initial permission to accept employment' :
                     application.reason_for_filing === 'renewal' ? 'Renewal of employment authorization' :
                     application.reason_for_filing === 'replacement' ? 'Replacement of lost/stolen/damaged EAD' :
                     application.reason_for_filing === 'correction' ? 'Correction NOT due to USCIS error' :
                     application.reason_for_filing || 'N/A'}
                  </span>
                  {application.reason_for_filing && (
                    <button
                      onClick={() => copyToClipboard(
                        application.reason_for_filing === 'initial' ? 'Initial permission to accept employment' :
                        application.reason_for_filing === 'renewal' ? 'Renewal of employment authorization' :
                        application.reason_for_filing === 'replacement' ? 'Replacement of lost/stolen/damaged EAD' :
                        application.reason_for_filing === 'correction' ? 'Correction NOT due to USCIS error' :
                        application.reason_for_filing || '',
                        'Reason for filing', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Reason"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 py-1">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Attorney:</span>
                  <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.has_attorney ? 'Yes' : 'No'}</span>
                </div>
                {application.uscis_online_account_number && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">USCIS #:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.uscis_online_account_number}</span>
                    <button
                      onClick={() => copyToClipboard(application.uscis_online_account_number, 'USCIS online account number', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy USCIS Account Number"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Legal Name Information */}
          <Card>
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Legal Name Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {application.maiden_name && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Maiden:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.maiden_name}</span>
                    <button
                      onClick={() => copyToClipboard(application.maiden_name, 'Maiden name', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Maiden Name"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
                {application.aliases && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Aliases:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.aliases}</span>
                    <button
                      onClick={() => copyToClipboard(application.aliases, 'Aliases', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Aliases"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
                {application.previous_legal_names && (
                  <div className="flex items-center gap-1.5 py-1 md:col-span-2 lg:col-span-3">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Previous:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.previous_legal_names}</span>
                    <button
                      onClick={() => copyToClipboard(application.previous_legal_names, 'Previous legal names', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Previous Legal Names"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Address Information */}
          <Card>
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Address Information</h3>
              <div className="space-y-2">
                <div>
                  <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Mailing Address</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {application.in_care_of_name && (
                      <div className="flex items-center gap-1.5 py-1">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">In Care Of:</span>
                        <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.in_care_of_name}</span>
                        <button
                          onClick={() => copyToClipboard(application.in_care_of_name, 'In care of name', showToast)}
                          className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                          title="Copy In Care Of"
                        >
                          <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 py-1 md:col-span-2 lg:col-span-3">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Street:</span>
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">
                        {[application.street_address, application.apartment_suite].filter(Boolean).join(', ') || 'N/A'}
                      </span>
                      {[application.street_address, application.apartment_suite].filter(Boolean).length > 0 && (
                        <button
                          onClick={() => copyToClipboard([application.street_address, application.apartment_suite].filter(Boolean).join(', '), 'Street address', showToast)}
                          className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                          title="Copy Street Address"
                        >
                          <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">City:</span>
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.city || 'N/A'}</span>
                      {application.city && (
                        <button
                          onClick={() => copyToClipboard(application.city, 'City', showToast)}
                          className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                          title="Copy City"
                        >
                          <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">State:</span>
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.state || 'N/A'}</span>
                      {application.state && (
                        <button
                          onClick={() => copyToClipboard(application.state, 'State', showToast)}
                          className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                          title="Copy State"
                        >
                          <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">ZIP:</span>
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.zip_code || 'N/A'}</span>
                      {application.zip_code && (
                        <button
                          onClick={() => copyToClipboard(application.zip_code, 'ZIP code', showToast)}
                          className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                          title="Copy ZIP Code"
                        >
                          <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Country:</span>
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.country || 'N/A'}</span>
                      {application.country && (
                        <button
                          onClick={() => copyToClipboard(application.country, 'Country', showToast)}
                          className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                          title="Copy Country"
                        >
                          <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                {application.physical_address_same === false && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Physical Address</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {application.physical_in_care_of && (
                        <div className="flex items-center gap-1.5 py-1">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">In Care Of:</span>
                          <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.physical_in_care_of}</span>
                          <button
                            onClick={() => copyToClipboard(application.physical_in_care_of, 'Physical in care of', showToast)}
                            className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                            title="Copy In Care Of"
                          >
                            <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 py-1 md:col-span-2 lg:col-span-3">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Street:</span>
                        <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">
                          {[application.physical_street_address, application.physical_apartment_suite].filter(Boolean).join(', ') || 'N/A'}
                        </span>
                        {[application.physical_street_address, application.physical_apartment_suite].filter(Boolean).length > 0 && (
                          <button
                            onClick={() => copyToClipboard([application.physical_street_address, application.physical_apartment_suite].filter(Boolean).join(', '), 'Physical street address', showToast)}
                            className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                            title="Copy Street Address"
                          >
                            <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 py-1">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">City:</span>
                        <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.physical_city || 'N/A'}</span>
                        {application.physical_city && (
                          <button
                            onClick={() => copyToClipboard(application.physical_city, 'Physical city', showToast)}
                            className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                            title="Copy City"
                          >
                            <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 py-1">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">State:</span>
                        <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.physical_state || 'N/A'}</span>
                        {application.physical_state && (
                          <button
                            onClick={() => copyToClipboard(application.physical_state, 'Physical state', showToast)}
                            className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                            title="Copy State"
                          >
                            <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 py-1">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">ZIP:</span>
                        <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.physical_zip_code || 'N/A'}</span>
                        {application.physical_zip_code && (
                          <button
                            onClick={() => copyToClipboard(application.physical_zip_code, 'Physical ZIP code', showToast)}
                            className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                            title="Copy ZIP Code"
                          >
                            <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Personal Information */}
          <Card>
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                <div className="flex items-center gap-1.5 py-1">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Sex:</span>
                  <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.sex || 'N/A'}</span>
                  {application.sex && (
                    <button
                      onClick={() => copyToClipboard(application.sex, 'Sex', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Sex"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 py-1">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Birth City:</span>
                  <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.birth_city || 'N/A'}</span>
                  {application.birth_city && (
                    <button
                      onClick={() => copyToClipboard(application.birth_city, 'Birth city', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Birth City"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  )}
                </div>
                {application.birth_state && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Birth State:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.birth_state}</span>
                    <button
                      onClick={() => copyToClipboard(application.birth_state, 'Birth state', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Birth State"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-1.5 py-1">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Birth Country:</span>
                  <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.birth_country || 'N/A'}</span>
                  {application.birth_country && (
                    <button
                      onClick={() => copyToClipboard(application.birth_country, 'Birth country', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Birth Country"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  )}
                </div>
                {application.citizenship_countries && Array.isArray(application.citizenship_countries) && application.citizenship_countries.length > 0 && (
                  <div className="flex items-center gap-1.5 py-1 md:col-span-2 lg:col-span-3">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Citizenship:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.citizenship_countries.join(', ')}</span>
                    <button
                      onClick={() => copyToClipboard(application.citizenship_countries.join(', '), 'Citizenship countries', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Citizenship"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
                {application.spouse_name && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Spouse:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.spouse_name}</span>
                    <button
                      onClick={() => copyToClipboard(application.spouse_name, 'Spouse name', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Spouse Name"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
                {application.spouse_email && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Spouse Email:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.spouse_email}</span>
                    <button
                      onClick={() => copyToClipboard(application.spouse_email, 'Spouse email', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Spouse Email"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
                {application.spouse_contact_number && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Spouse Phone:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.spouse_contact_number}</span>
                    <button
                      onClick={() => copyToClipboard(application.spouse_contact_number, 'Spouse contact number', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Spouse Contact"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Social Security Information */}
          <Card>
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Social Security Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                <div className="flex items-center gap-1.5 py-1">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Has SSN:</span>
                  <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.has_ssn ? 'Yes' : 'No'}</span>
                </div>
                {application.has_ssn && application.ssn && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">SSN:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.ssn}</span>
                    <button
                      onClick={() => copyToClipboard(application.ssn, 'SSN', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy SSN"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-1.5 py-1">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Want Card:</span>
                  <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.want_ssn_card ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex items-center gap-1.5 py-1">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Consent:</span>
                  <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.consent_ssa_disclosure ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Parents' Information */}
          {(application.father_first_name || application.father_last_name || application.mother_first_name || application.mother_last_name) && (
            <Card>
              <div className="p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Parents' Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Father</h4>
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">
                        {[application.father_first_name, application.father_last_name].filter(Boolean).join(' ') || 'N/A'}
                      </span>
                      {[application.father_first_name, application.father_last_name].filter(Boolean).length > 0 && (
                        <button
                          onClick={() => copyToClipboard([application.father_first_name, application.father_last_name].filter(Boolean).join(' '), 'Father name', showToast)}
                          className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                          title="Copy Father Name"
                        >
                          <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Mother</h4>
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">
                        {[application.mother_first_name, application.mother_last_name].filter(Boolean).join(' ') || 'N/A'}
                      </span>
                      {[application.mother_first_name, application.mother_last_name].filter(Boolean).length > 0 && (
                        <button
                          onClick={() => copyToClipboard([application.mother_first_name, application.mother_last_name].filter(Boolean).join(' '), 'Mother name', showToast)}
                          className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                          title="Copy Mother Name"
                        >
                          <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Eligibility Category */}
          <Card>
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Eligibility Category</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                <div className="flex items-center gap-1.5 py-1">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Category:</span>
                  <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.eligibility_category || 'N/A'}</span>
                  {application.eligibility_category && (
                    <button
                      onClick={() => copyToClipboard(application.eligibility_category, 'Eligibility category', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Eligibility Category"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  )}
                </div>
                {application.employer_name && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Employer:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.employer_name}</span>
                    <button
                      onClick={() => copyToClipboard(application.employer_name, 'Employer name', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Employer Name"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
                {application.everify_company_id && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">E-Verify:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.everify_company_id}</span>
                    <button
                      onClick={() => copyToClipboard(application.everify_company_id, 'E-Verify company ID', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy E-Verify ID"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
                {application.receipt_number && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Receipt:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.receipt_number}</span>
                    <button
                      onClick={() => copyToClipboard(application.receipt_number, 'Receipt number', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Receipt Number"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-1.5 py-1">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Criminal:</span>
                  <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.has_criminal_history ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Contact Information */}
          <Card>
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {application.phone_number && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Phone:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.phone_number}</span>
                    <button
                      onClick={() => copyToClipboard(application.phone_number, 'Phone number', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Phone Number"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
                {application.mobile_number && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Mobile:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.mobile_number}</span>
                    <button
                      onClick={() => copyToClipboard(application.mobile_number, 'Mobile number', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Mobile Number"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
                {application.email_address && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Email:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.email_address}</span>
                    <button
                      onClick={() => copyToClipboard(application.email_address, 'Email address', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Email Address"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Interpreter Information */}
          {application.has_interpreter && (
            <Card>
              <div className="p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Interpreter Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {application.interpreter_name && (
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Name:</span>
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.interpreter_name}</span>
                      <button
                        onClick={() => copyToClipboard(application.interpreter_name, 'Interpreter name', showToast)}
                        className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                        title="Copy Interpreter Name"
                      >
                        <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                  )}
                  {application.interpreter_address && (
                    <div className="flex items-center gap-1.5 py-1 md:col-span-2 lg:col-span-3">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Address:</span>
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.interpreter_address}</span>
                      <button
                        onClick={() => copyToClipboard(application.interpreter_address, 'Interpreter address', showToast)}
                        className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                        title="Copy Interpreter Address"
                      >
                        <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                  )}
                  {application.interpreter_phone && (
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Phone:</span>
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.interpreter_phone}</span>
                      <button
                        onClick={() => copyToClipboard(application.interpreter_phone, 'Interpreter phone', showToast)}
                        className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                        title="Copy Interpreter Phone"
                      >
                        <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                  )}
                  {application.interpreter_email && (
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Email:</span>
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.interpreter_email}</span>
                      <button
                        onClick={() => copyToClipboard(application.interpreter_email, 'Interpreter email', showToast)}
                        className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                        title="Copy Interpreter Email"
                      >
                        <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Preparer Information */}
          {application.has_preparer && (
            <Card>
              <div className="p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Preparer Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {application.preparer_name && (
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Name:</span>
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.preparer_name}</span>
                      <button
                        onClick={() => copyToClipboard(application.preparer_name, 'Preparer name', showToast)}
                        className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                        title="Copy Preparer Name"
                      >
                        <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                  )}
                  {application.preparer_business_name && (
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Business:</span>
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.preparer_business_name}</span>
                      <button
                        onClick={() => copyToClipboard(application.preparer_business_name, 'Preparer business name', showToast)}
                        className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                        title="Copy Business Name"
                      >
                        <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                  )}
                  {application.preparer_address && (
                    <div className="flex items-center gap-1.5 py-1 md:col-span-2 lg:col-span-3">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Address:</span>
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.preparer_address}</span>
                      <button
                        onClick={() => copyToClipboard(application.preparer_address, 'Preparer address', showToast)}
                        className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                        title="Copy Preparer Address"
                      >
                        <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                  )}
                  {application.preparer_phone && (
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Phone:</span>
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.preparer_phone}</span>
                      <button
                        onClick={() => copyToClipboard(application.preparer_phone, 'Preparer phone', showToast)}
                        className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                        title="Copy Preparer Phone"
                      >
                        <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                  )}
                  {application.preparer_email && (
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Email:</span>
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.preparer_email}</span>
                      <button
                        onClick={() => copyToClipboard(application.preparer_email, 'Preparer email', showToast)}
                        className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                        title="Copy Preparer Email"
                      >
                        <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                  )}
                  {application.preparer_type && (
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Type:</span>
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.preparer_type}</span>
                      <button
                        onClick={() => copyToClipboard(application.preparer_type, 'Preparer type', showToast)}
                        className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                        title="Copy Preparer Type"
                      >
                        <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Immigration Information (EAD only) */}
      {detailsSubTab === 'immigration' && isEADApplication && (
        <div className="space-y-3">
          {/* Immigration & Arrival Information */}
          <Card>
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Immigration & Arrival Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {application.a_number && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">A-Number:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.a_number}</span>
                    <button
                      onClick={() => copyToClipboard(application.a_number, 'A-Number', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy A-Number"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
                {application.uscis_account_number && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">USCIS:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.uscis_account_number}</span>
                    <button
                      onClick={() => copyToClipboard(application.uscis_account_number, 'USCIS account number', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy USCIS Account Number"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
                {application.i94_number && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">I-94:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.i94_number}</span>
                    <button
                      onClick={() => copyToClipboard(application.i94_number, 'I-94 number', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy I-94 Number"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
                {application.sevis_number && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">SEVIS:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.sevis_number}</span>
                    <button
                      onClick={() => copyToClipboard(application.sevis_number, 'SEVIS number', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy SEVIS Number"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
                {application.last_arrival_date && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Arrival:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{formatDate(application.last_arrival_date)}</span>
                    <button
                      onClick={() => copyToClipboard(application.last_arrival_date, 'Last arrival date', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Arrival Date"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
                {application.last_arrival_place && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Place:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.last_arrival_place}</span>
                    <button
                      onClick={() => copyToClipboard(application.last_arrival_place, 'Last arrival place', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Arrival Place"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
                {application.immigration_status_at_arrival && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Status @:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.immigration_status_at_arrival}</span>
                    <button
                      onClick={() => copyToClipboard(application.immigration_status_at_arrival, 'Immigration status at arrival', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Status at Arrival"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
                {application.current_immigration_status && (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Current:</span>
                    <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.current_immigration_status}</span>
                    <button
                      onClick={() => copyToClipboard(application.current_immigration_status, 'Current immigration status', showToast)}
                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                      title="Copy Current Status"
                    >
                      <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Passport Information */}
          {(application.passport_number || application.passport_country || application.passport_expiration) && (
            <Card>
              <div className="p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Passport Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {application.passport_number && (
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Passport:</span>
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.passport_number}</span>
                      <button
                        onClick={() => copyToClipboard(application.passport_number, 'Passport number', showToast)}
                        className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                        title="Copy Passport Number"
                      >
                        <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                  )}
                  {application.passport_country && (
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Country:</span>
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.passport_country}</span>
                      <button
                        onClick={() => copyToClipboard(application.passport_country, 'Passport country', showToast)}
                        className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                        title="Copy Country"
                      >
                        <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                  )}
                  {application.passport_expiration && (
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Expires:</span>
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{formatDate(application.passport_expiration)}</span>
                      <button
                        onClick={() => copyToClipboard(application.passport_expiration, 'Passport expiration', showToast)}
                        className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                        title="Copy Expiration Date"
                      >
                        <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                  )}
                  {application.travel_document_number && (
                    <div className="flex items-center gap-1.5 py-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[70px]">Travel Doc:</span>
                      <span className="text-xs text-gray-900 dark:text-gray-100 flex-1 truncate font-mono">{application.travel_document_number}</span>
                      <button
                        onClick={() => copyToClipboard(application.travel_document_number, 'Travel document number', showToast)}
                        className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0 opacity-60 hover:opacity-100"
                        title="Copy Travel Document Number"
                      >
                        <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

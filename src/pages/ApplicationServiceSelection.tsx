import { useNavigate } from 'react-router-dom'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FileText, Briefcase } from 'lucide-react'

export function ApplicationServiceSelection() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Select Application Service
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Choose the type of application you would like to submit
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/application/new/nclex')}>
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    NCLEX Application
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Apply for NCLEX examination and processing services
                  </p>
                  <Button className="w-full">
                    Select NCLEX
                  </Button>
                </div>
              </Card>

              <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/application/new/ead')}>
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mb-4">
                    <Briefcase className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    EAD Application (I-765)
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Apply for Employment Authorization Document (Form I-765)
                  </p>
                  <Button className="w-full">
                    Select EAD
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}


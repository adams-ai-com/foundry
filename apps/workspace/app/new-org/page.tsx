import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { NewOrgForm } from '@/components/NewOrgForm'

export const dynamic = 'force-dynamic'

export default async function NewOrgPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl mb-4">
            <span className="text-white font-bold text-xl">F</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create your workspace</h1>
          <p className="text-gray-500 text-sm mt-1">You're signed in as {session.email}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Name your organization</h2>
          <p className="text-gray-500 text-sm mb-6">This is the name of your company or team.</p>
          <NewOrgForm />
        </div>
      </div>
    </div>
  )
}

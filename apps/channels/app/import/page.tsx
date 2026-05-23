import Link from 'next/link'
import { requireSession } from '@foundry/auth'

export const dynamic = 'force-dynamic'

export default async function ImportPage() {
  await requireSession()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Import Communications History</h1>
        <p className="text-gray-500 mb-8">Bring your team's history into Foundry Channels in minutes.</p>
        <div className="grid gap-4">
          <Link href="/import/slack"
            className="flex items-start gap-4 bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-400 hover:shadow-sm transition-all group">
            <span className="text-3xl">💬</span>
            <div>
              <div className="font-semibold text-gray-900 group-hover:text-indigo-600">Slack</div>
              <div className="text-sm text-gray-500 mt-0.5">Import messages, threads, DMs, and reactions from a Slack export ZIP.</div>
            </div>
            <span className="ml-auto text-gray-300 group-hover:text-indigo-400 text-xl">→</span>
          </Link>
          <Link href="/import/teams"
            className="flex items-start gap-4 bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-400 hover:shadow-sm transition-all group">
            <span className="text-3xl">📋</span>
            <div>
              <div className="font-semibold text-gray-900 group-hover:text-indigo-600">Microsoft Teams</div>
              <div className="text-sm text-gray-500 mt-0.5">Import channels and threaded conversations from a Teams admin export ZIP.</div>
            </div>
            <span className="ml-auto text-gray-300 group-hover:text-indigo-400 text-xl">→</span>
          </Link>
          <div className="flex items-start gap-4 bg-white border border-gray-100 rounded-xl p-5 opacity-50 cursor-not-allowed">
            <span className="text-3xl">🎥</span>
            <div>
              <div className="font-semibold text-gray-900">Zoom Recordings</div>
              <div className="text-sm text-gray-500 mt-0.5">Coming soon — C13</div>
            </div>
          </div>
          <div className="flex items-start gap-4 bg-white border border-gray-100 rounded-xl p-5 opacity-50 cursor-not-allowed">
            <span className="text-3xl">🔵</span>
            <div>
              <div className="font-semibold text-gray-900">Google Chat</div>
              <div className="text-sm text-gray-500 mt-0.5">Coming soon — C14</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

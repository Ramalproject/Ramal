import Link from 'next/link'
import { Mail } from 'lucide-react'

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-violet-50 rounded-full mb-6">
            <Mail className="w-8 h-8 text-violet-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Check your email</h1>
          <p className="text-slate-500 mb-8">
            We sent a confirmation link to your email address. Click the link to activate your account and get started.
          </p>
          <Link href="/login" className="text-sm text-violet-600 font-medium hover:text-violet-700">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  )
}

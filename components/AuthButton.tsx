import React, { useState } from 'react'
import { LogIn, LogOut, User, Zap, Mail, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const PLAN_LIMITS: Record<string, number> = {
  free: 3,
  starter: 30,
  pro: 150,
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
}

export function AuthButton() {
  const { user, profile, loading, signInWithEmail, signOut } = useAuth()
  const [showEmailInput, setShowEmailInput] = useState(false)
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setSending(true)
    setError('')

    try {
      await signInWithEmail(email)
      setSent(true)
    } catch (err: any) {
      setError(err.message || 'Failed to send magic link')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="h-10 w-24 bg-remotion-card animate-pulse rounded-lg" />
    )
  }

  if (!user) {
    if (sent) {
      return (
        <div className="flex items-center gap-2 px-4 py-2 bg-green-900/30 text-green-300 rounded-lg text-sm">
          <Mail className="w-4 h-4" />
          Check your email!
        </div>
      )
    }

    if (showEmailInput) {
      return (
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="px-3 py-2 bg-remotion-card border border-remotion-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-remotion-blue w-48"
            autoFocus
          />
          <button
            type="submit"
            disabled={sending || !email}
            className="px-4 py-2 bg-remotion-blue text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => setShowEmailInput(false)}
            className="text-gray-500 hover:text-white text-sm"
          >
            Cancel
          </button>
        </form>
      )
    }

    return (
      <button
        onClick={() => setShowEmailInput(true)}
        className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-colors"
      >
        <LogIn className="w-4 h-4" />
        Sign in
      </button>
    )
  }

  const limit = PLAN_LIMITS[profile?.plan || 'free']
  const usage = profile?.usage_count || 0
  const remaining = Math.max(0, limit - usage)
  const planLabel = PLAN_LABELS[profile?.plan || 'free']

  return (
    <div className="flex items-center gap-4">
      {/* Usage indicator */}
      <div className="flex items-center gap-2 text-sm">
        <Zap className="w-4 h-4 text-yellow-400" />
        <span className="text-gray-400">
          <span className="text-white font-medium">{remaining}</span>/{limit}
        </span>
        <span className="px-2 py-0.5 bg-remotion-blue/20 text-remotion-blue text-xs rounded-full">
          {planLabel}
        </span>
      </div>

      {/* User menu */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-remotion-card border border-remotion-border flex items-center justify-center overflow-hidden">
          {user.user_metadata?.avatar_url ? (
            <img
              src={user.user_metadata.avatar_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-4 h-4 text-gray-400" />
          )}
        </div>
        <button
          onClick={signOut}
          className="p-2 text-gray-400 hover:text-white transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export function UsageAlert() {
  const { profile } = useAuth()

  if (!profile) return null

  const limit = PLAN_LIMITS[profile.plan || 'free']
  const usage = profile.usage_count || 0
  const remaining = Math.max(0, limit - usage)

  if (remaining > 0) return null

  return (
    <div className="w-full max-w-2xl p-4 bg-yellow-900/20 border border-yellow-500/50 text-yellow-200 rounded-lg flex items-center gap-3">
      <Zap className="w-5 h-5 shrink-0" />
      <div>
        <p className="font-medium">Usage limit reached</p>
        <p className="text-sm text-yellow-300/80">
          You've used all {limit} analyses this month.{' '}
          {profile.plan === 'free' && (
            <a href="#upgrade" className="underline hover:text-yellow-100">
              Upgrade to get more
            </a>
          )}
        </p>
      </div>
    </div>
  )
}

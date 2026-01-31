import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Helper to get current user
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Helper to get user profile with usage data
export const getUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

// Plan limits
export const PLAN_LIMITS = {
  free: 3,
  starter: 30,
  pro: 150,
} as const

// Check if user can analyze (has remaining usage)
export const canAnalyze = async (userId: string): Promise<{ allowed: boolean; remaining: number }> => {
  const profile = await getUserProfile(userId)

  // Reset usage if period has passed
  const now = new Date()
  const resetAt = new Date(profile.period_reset_at)

  if (now >= resetAt) {
    // Reset usage count
    await supabase
      .from('users')
      .update({
        usage_count: 0,
        period_reset_at: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
      })
      .eq('id', userId)

    return { allowed: true, remaining: PLAN_LIMITS[profile.plan as keyof typeof PLAN_LIMITS] }
  }

  const limit = PLAN_LIMITS[profile.plan as keyof typeof PLAN_LIMITS]
  const remaining = limit - profile.usage_count

  return { allowed: remaining > 0, remaining }
}

// Increment usage count
export const incrementUsage = async (userId: string) => {
  const { error } = await supabase.rpc('increment_usage', { user_id: userId })
  if (error) {
    // Fallback: direct update
    await supabase
      .from('users')
      .update({ usage_count: supabase.sql`usage_count + 1` } as any)
      .eq('id', userId)
  }
}

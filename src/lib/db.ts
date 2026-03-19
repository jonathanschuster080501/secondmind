// ============================================================
// SecondMind – Supabase DB-Operationen
// ============================================================

import { supabase } from './supabase'

// --- Typen ---

export type EntryType = 'quick_note' | 'todo' | 'concept' | 'diary' | 'bullets'

export interface Entry {
  id: string
  user_id: string
  title: string
  content: string
  category_id: string | null
  entry_type: EntryType
  source: 'pwa' | 'claude'
  remind_at: string | null   // ISO-Timestamp
  created_at: string         // ISO-Timestamp
  updated_at: string         // ISO-Timestamp
}

export interface UserPreferences {
  user_id: string
  theme: 'midnight_void' | 'paper_light'
  layout: 'grid' | 'list' | 'kanban' | 'timeline'
  created_at: string
  updated_at: string
}

// ============================================================
// EINTRÄGE
// ============================================================

export async function fetchEntries(): Promise<Entry[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as Entry[]
}

export async function createEntry(
  payload: Pick<Entry, 'content' | 'entry_type' | 'remind_at'>
): Promise<Entry> {
  const { data, error } = await supabase
    .from('entries')
    .insert({ ...payload, title: '', source: 'pwa' })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Entry
}

export async function updateEntry(
  id: string,
  payload: Partial<Pick<Entry, 'content' | 'entry_type' | 'remind_at'>>
): Promise<Entry> {
  const { data, error } = await supabase
    .from('entries')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Entry
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from('entries')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

// ============================================================
// USER PREFERENCES
// ============================================================

export async function fetchPreferences(): Promise<UserPreferences | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as UserPreferences | null
}

export async function upsertPreferences(
  prefs: Pick<UserPreferences, 'theme' | 'layout'>
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) throw new Error('Nicht angemeldet')

  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: user.id, ...prefs }, { onConflict: 'user_id' })

  if (error) throw new Error(error.message)
}

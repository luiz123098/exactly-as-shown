import { supabase } from '@/lib/supabase';
import { removeImages, uploadImage } from '@/lib/upload';

export type Profile = {
  id: string;
  full_name: string;
  instagram: string | null;
  avatar_path: string | null;
  garage_visible?: boolean;
};

// Same rule as the profiles.instagram check in the database.
const INSTAGRAM = /^[A-Za-z0-9._]{1,30}$/;

// Accepts "@user", "user" or a profile link and returns the bare username,
// or null when it isn't a valid Instagram username.
export function normalizeInstagram(input: string): string | null {
  let v = input.trim();
  const link = v.match(/instagram\.com\/([^/?#]+)/i);
  if (link?.[1]) v = link[1];
  v = v.replace(/^@/, '');
  return INSTAGRAM.test(v) ? v : null;
}

// Name, Instagram and photo are required before entering the app.
export function isProfileComplete(p: Profile | null): boolean {
  return !!p && p.full_name.trim().length >= 2 && !!p.instagram && !!p.avatar_path;
}

export function avatarUrl(path: string | null | undefined): string | null {
  return path ? supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl : null;
}

// Uploads a picked photo to the member's own folder and points the profile at it.
export async function uploadAvatar(userId: string, uri: string, mimeType?: string | null, previous?: string | null) {
  const path = await uploadImage('avatars', `${userId}/avatar`, uri, mimeType);
  const { error: updateError } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', userId);
  if (updateError) throw updateError;
  if (previous && previous !== path) await removeImages('avatars', [previous]);
  return path;
}

// Asks the server to copy the member's public Instagram photo. Instagram may
// refuse (private API, rate limits), so null just means "pick a photo".
export async function importInstagramAvatar(): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke<{ avatar_path: string | null }>('instagram-avatar');
  if (error) return null;
  return data?.avatar_path ?? null;
}

export async function deleteAccount() {
  const { error } = await supabase.functions.invoke('delete-account');
  if (error) throw error;
}

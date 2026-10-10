import { supabase } from '@/lib/supabase';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

// Uploads a picked image to `<bucket>/<prefix>-<time>.<ext>` and returns the path.
// The prefix starts with the folder the storage policy expects (usually the user id).
export async function uploadImage(bucket: string, prefix: string, uri: string, mimeType?: string | null) {
  const type = mimeType && ALLOWED.includes(mimeType) ? mimeType : 'image/jpeg';
  const path = `${prefix}-${Date.now()}.${type.split('/')[1]}`;
  const body = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: type });
  if (error) throw error;
  return path;
}

export async function removeImages(bucket: string, paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (list.length) await supabase.storage.from(bucket).remove(list);
}

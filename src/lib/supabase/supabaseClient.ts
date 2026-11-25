import { createClient } from "./client";

/**
 * Alias helper sesuai konvensi supabaseClient.ts untuk Client Components.
 */
export { createClient };

export function getSupabaseClient() {
  return createClient();
}

/* M.BizAccount secure admin auth helper
 * Uses only the browser-safe Supabase publishable key.
 * The Supabase secret/service-role key must never be placed in this file.
 */
(function () {
  const SUPABASE_URL = 'https://qnszjzaodqzweablnzby.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_-lkFauGz4pqE2q_M_t_TsA_SNKh4-pk';

  window.MBizSupabaseAuth = {
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    createClient() {
      if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        throw new Error('Supabase library is not loaded.');
      }
      return window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    },
    async signOut(client) {
      if (!client) throw new Error('Supabase client is missing.');
      return client.auth.signOut();
    }
  };
})();

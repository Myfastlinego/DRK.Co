/* M.BizAccount Supabase Authentication */
(function () {
  const SUPABASE_URL = "https://qnszjzaodqzweablnzby.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_-lkFauGz4pqE2q_M_t_TsA_SNKh4-pk";

  function loadRecoveryModule() {
    if (document.querySelector('script[data-mbiz-auth-recovery]')) return;
    const script = document.createElement('script');
    script.src = './auth-recovery-lockout.js';
    script.dataset.mbizAuthRecovery = '1';
    document.head.appendChild(script);
  }

  function boot() {
    if (!window.supabase || !window.supabase.createClient) return;
    window.mbizSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

    window.mbizAuthReady = window.mbizSupabase.auth.getSession().then(({ data }) => {
      if (typeof window.mbizApplyAuthState === "function") {
        window.mbizApplyAuthState(data.session);
      }
      return data.session;
    });

    window.mbizSupabase.auth.onAuthStateChange(function (_event, session) {
      if (typeof window.mbizApplyAuthState === "function") {
        window.mbizApplyAuthState(session);
      }
    });

    loadRecoveryModule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

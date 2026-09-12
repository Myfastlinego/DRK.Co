/* M.BizAccount visible Logout integration helper */
(function () {
  function injectLogoutButton() {
    const actions = document.querySelector('.website-actions');
    if (!actions || document.getElementById('mbizLogoutBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'mbizLogoutBtn';
    btn.type = 'button';
    btn.textContent = 'Logout';
    btn.title = 'Logout from this device';
    btn.style.cssText = 'color:#fff;background:#a33d3d;border:1px solid rgba(255,255,255,.35);border-radius:8px;padding:7px 10px;cursor:pointer;font-weight:700;';
    btn.addEventListener('click', async function () {
      if (typeof window.mbizLogout === 'function') return window.mbizLogout();
      try {
        if (window.MBizSupabaseAuth && typeof window.MBizSupabaseAuth.createClient === 'function') {
          const client = window.MBizSupabaseAuth.createClient();
          const { error } = await client.auth.signOut({ scope: 'local' });
          if (error) throw error;
        }
        try { sessionStorage.clear(); } catch (e) {}
        window.location.reload();
      } catch (err) {
        console.error('Logout failed:', err);
        alert('Logout failed. Please try again.');
      }
    });
    actions.appendChild(btn);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectLogoutButton);
  else injectLogoutButton();
  setTimeout(injectLogoutButton, 1000);
})();

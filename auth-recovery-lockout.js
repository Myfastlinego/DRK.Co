/* M.BizAccount admin recovery + progressive login lockout */
(function(){
  const LOCK_KEY='mbizaccount_login_lockouts_v1';
  const MAX_BACKOFF_MINUTES=60;
  const state=()=>{try{return JSON.parse(localStorage.getItem(LOCK_KEY)||'{}')}catch(e){return {}}};
  const save=(x)=>{try{localStorage.setItem(LOCK_KEY,JSON.stringify(x))}catch(e){}};
  const norm=(v)=>String(v||'').trim().toLowerCase();
  const get=(id)=>document.getElementById(id);
  const info=(email)=>{const s=state(),k=norm(email),x=s[k]||{fails:0,lockedUntil:0}; if(x.lockedUntil&&Date.now()>=x.lockedUntil){x.lockedUntil=0;save(s)} return x};
  const format=(ms)=>{const sec=Math.max(0,Math.ceil(ms/1000));return Math.floor(sec/60)+'m '+String(sec%60).padStart(2,'0')+'s'};
  const lockMinutes=(fails)=>Math.min(MAX_BACKOFF_MINUTES,Math.max(1,fails-4));
  window.mbizAuthLockState=info;
  window.mbizAuthRegisterFailure=function(email){const s=state(),k=norm(email),x=s[k]||{fails:0,lockedUntil:0};x.fails=(x.fails||0)+1;const mins=lockMinutes(x.fails);x.lockedUntil=Date.now()+mins*60000;s[k]=x;save(s);return {fails:x.fails,minutes:mins,until:x.lockedUntil}};
  window.mbizAuthClearFailures=function(email){const s=state(),k=norm(email);delete s[k];save(s)};
  window.mbizForgotPassword=async function(){const email=(get('authEmail')?.value||'').trim();if(!email)return window.mbizAuthError?.('Enter your admin email first.');if(!window.mbizSupabase)return window.mbizAuthError?.('Authentication service is unavailable.');try{const {error}=await window.mbizSupabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw error;if(get('authStatus'))get('authStatus').textContent='Password reset link sent. Check your email.';if(get('authError'))get('authError').style.display='none'}catch(e){window.mbizAuthError?.(e?.message||'Unable to send password reset email.')}};
  window.mbizForgotUserId=function(){const status=get('authStatus');if(status)status.textContent='Your User ID is the admin email registered in Supabase. Check the email address you used for the admin account.'};
  window.mbizAuthApplyLockUI=function(){const email=(get('authEmail')?.value||'').trim();const x=info(email),btn=get('authSubmit'),status=get('authStatus');if(x.lockedUntil>Date.now()){if(btn){btn.disabled=true;btn.textContent='Locked '+format(x.lockedUntil-Date.now())}if(status)status.textContent='Too many failed attempts. Try again in '+format(x.lockedUntil-Date.now())+'.';return true}return false};
  window.setInterval(window.mbizAuthApplyLockUI,1000);
  window.mbizAuthRecoveryUI=function(){if(get('authRecovery'))return;const host=document.querySelector('.auth-card');if(!host)return;const wrap=document.createElement('div');wrap.id='authRecovery';wrap.innerHTML='<div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:13px"><button type="button" class="secondary" onclick="mbizForgotPassword()">Forgot Password?</button><button type="button" class="secondary" onclick="mbizForgotUserId()">Forgot User ID?</button></div>';host.appendChild(wrap)};
  document.addEventListener('DOMContentLoaded',window.mbizAuthRecoveryUI);
})();

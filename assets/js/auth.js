/* M.BizAccount — Admin Auth Recovery & Progressive Lockout */
(function(){
  const KEY='mbiz_auth_lockout_v1';
  const BASE=60000;
  const MAX=30*60000;
  const state=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return{}}};
  const save=s=>{try{localStorage.setItem(KEY,JSON.stringify(s))}catch(e){}};
  const reset=()=>save({attempts:0,lockedUntil:0,identity:''});
  const left=()=>Math.max(0,(state().lockedUntil||0)-Date.now());
  const secs=ms=>Math.max(1,Math.ceil(ms/1000));
  function msg(t,ok){const b=document.getElementById('authError');if(!b)return;b.textContent=t;b.style.display='block';b.className='auth-error'+(ok?' success':'')}
  function ui(){const b=document.getElementById('authSubmit');if(!b)return;const ms=left();if(ms>0){b.disabled=true;b.dataset.locked='1';b.textContent='Locked — '+secs(ms)+'s';msg('Too many failed attempts. Try again in '+secs(ms)+' seconds.')}else if(b.dataset.locked==='1'){b.disabled=false;b.dataset.locked='0';b.textContent='Sign In';const e=document.getElementById('authError');if(e){e.style.display='none';e.textContent=''}}}
  window.mbizAuthGuard={beforeLogin(){if(left()>0){ui();return false}return true},failed(identity){let s=state();const id=String(identity||'').trim().toLowerCase();if(s.identity!==id){s={attempts:0,lockedUntil:0,identity:id}}s.attempts=(s.attempts||0)+1;if(s.attempts>=2)s.lockedUntil=Date.now()+Math.min(BASE*(s.attempts-1),MAX);save(s);ui()},success(){reset();ui()},isLocked(){return left()>0}};
  window.mbizAuthForgotUserId=function(){msg('Admin User ID is the email address registered in Supabase Auth. If you do not remember it, check the email account used to create the admin account.');};
  window.mbizAuthResetPassword=async function(){const email=(document.getElementById('authEmail')?.value||'').trim();if(!email)return msg('Enter your admin email first.');if(!window.mbizSupabase)return msg('Authentication service is unavailable. Please refresh the page.');try{const {error}=await window.mbizSupabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw error;msg('Password reset email sent. Check your admin email inbox.',true)}catch(e){console.error(e);msg(e?.message||'Unable to send password reset email.')}};
  document.addEventListener('DOMContentLoaded',()=>{const f=document.querySelector('#authGate .auth-card form');if(f&&!document.getElementById('authRecoveryActions')){const a=document.createElement('div');a.id='authRecoveryActions';a.style='display:flex;justify-content:space-between;gap:8px;margin-top:10px;flex-wrap:wrap';a.innerHTML='<button type="button" class="secondary" onclick="mbizAuthForgotUserId()">Forgot User ID?</button><button type="button" class="secondary" onclick="mbizAuthResetPassword()">Forgot Password?</button>';f.appendChild(a)}ui();setInterval(ui,1000)});
})();

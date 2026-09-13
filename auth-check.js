/* M.BizAccount auth bootstrap. Loaded separately so the main app file stays untouched. */
(function(){
  const SUPABASE_URL='https://qnszjzaodqzweablnzby.supabase.co';
  const SUPABASE_KEY='sb_publishable_-lkFauGz4pqE2q_M_t_TsA_SNKh4-pk';
  function start(){
    if(!window.supabase||!window.supabase.createClient)return;
    const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
    window.mbizSupabase=client;
    window.mbizAuthSignOut=async function(){
      const r=await client.auth.signOut({scope:'local'});
      if(r.error) throw r.error;
      location.reload();
    };
    client.auth.getSession().then(function(r){
      if(r.error) console.error('Auth session check failed',r.error);
      window.dispatchEvent(new CustomEvent('mbiz-auth-ready',{detail:{session:r.data&&r.data.session}}));
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();

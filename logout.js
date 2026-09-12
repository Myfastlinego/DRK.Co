/* M.BizAccount logout helper — current Supabase session only. */
(function(){
  async function mbizLogout(){
    try{
      if(window.MBizSupabaseAuth && typeof window.MBizSupabaseAuth.createClient==='function'){
        const client=window.MBizSupabaseAuth.createClient();
        const {error}=await client.auth.signOut({scope:'local'});
        if(error) throw error;
      }
    }catch(err){
      console.error('Logout failed:',err);
      alert('Logout failed. Please try again.');
      return;
    }
    try{sessionStorage.clear();}catch(e){}
    window.location.reload();
  }
  window.mbizLogout=mbizLogout;
})();

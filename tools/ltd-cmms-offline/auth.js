// Local cookie session. No Firebase SDK, Google sign-in, cloud token or stored password.
const nativeFetch=globalThis.fetch.bind(globalThis);
let user=null,profile=null,csrf='',ready=null;const listeners=new Set();
export async function offlineFetch(input,options={}){
 const url=new URL(input,location.href);if(url.origin!==location.origin)throw new Error('Bản nội bộ chỉ kết nối máy tính này.');
 const headers=new Headers(options.headers||{}),method=(options.method||'GET').toUpperCase();
 if(!['GET','HEAD'].includes(method)){
  headers.set('Content-Type','application/json');if(csrf)headers.set('X-LTD-CSRF',csrf);
  if(options.body==null)options={...options,body:'{}'};
 }
 const response=await nativeFetch(url,{...options,headers,credentials:'same-origin',cache:'no-store'});
 if(response.status===401&&user){assign(null);notify();}
 return response;
}
async function call(path,options){const response=await offlineFetch(path,options);const data=await response.json();if(!response.ok){const error=new Error(data.error||'Không hoàn tất thao tác nội bộ.');error.code=response.status===401?'auth/invalid-credential':undefined;throw error;}return data;}
function assign(data){user=data?.user?{...data.user,emailVerified:true}:null;profile=data?.user||null;csrf=data?.csrf||'';}
function notify(){for(const callback of listeners)callback(user);}
export function initializeSession(){if(!ready)ready=(async()=>{try{assign(await call('/api/session'));if(sessionStorage.getItem('ltd_explicit_cmms_login')!=='1'){await call('/api/logout',{method:'POST'});assign(null);}}catch{assign(null);}})();return ready;}
export function onSessionChanged(callback){listeners.add(callback);initializeSession().then(()=>callback(user));return()=>listeners.delete(callback);}
export async function signIn(email,password){assign(await call('/api/login',{method:'POST',body:JSON.stringify({email,password})}));notify();return {user};}
export async function signOutUser(){try{await call('/api/logout',{method:'POST'});}finally{assign(null);notify();}}
export const sendVerification=async()=>{};
export const registerAccount=async()=>{throw new Error('Nhờ quản trị viên tạo tài khoản nội bộ trong mục Tài khoản.');};
export const getUser=()=>user;
export const getToken=async()=>user?'local':null;
export async function loadProfile(){const data=await call('/api/session');assign(data);return profile;}
export const role=()=>profile?.role||'viewer';
export const canEdit=()=>['admin','manager','technician'].includes(role());
export const displayName=()=>profile?.displayName||user?.email||'Người dùng nội bộ';

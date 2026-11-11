import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../assets/js/auth.js',import.meta.url),'utf8').replace(/import\s+[\s\S]*?from\s+"[^"]+";/g,'').replace(/export /g,'');
function fixture(profile){
 const writes=[],persistence=[];
 const user={uid:'test-user',email:'user@example.com',displayName:'User',emailVerified:true,getIdToken:async()=> 'fixture-token'};
 const auth={currentUser:user,authStateReady:async()=>{}};
 const context=vm.createContext({initializeApp:()=>({}),firebaseConfig:{databaseURL:'https://fixture.invalid'},getAuth:()=>auth,browserSessionPersistence:'SESSION',setPersistence:async(a,p)=>persistence.push(p),onAuthStateChanged:()=>{},signInWithEmailAndPassword:()=>{},signOut:async()=>{auth.currentUser=null;},sendEmailVerification:async()=>{},createUserWithEmailAndPassword:async()=>({user}),updateProfile:async()=>{},sessionStorage:{getItem:()=> '1'},crypto:{randomUUID:()=> 'fixture-id'},fetch:async(url,options)=>{if(options){writes.push(JSON.parse(options.body));return {ok:true,json:async()=>JSON.parse(options.body)};}return {ok:true,json:async()=>profile};}});
 vm.runInContext(source+'\nglobalThis.api={initializeSession,loadProfile,role,canEdit,registerAccount,signOutUser};',context);
 return {api:context.api,auth,writes,persistence};
}
test('pending, disabled and unknown profiles fail closed',async()=>{
 for(const profile of [{role:'pending'},{role:'admin',disabled:true},{role:'unrecognised'}]){
  const f=fixture(profile);await assert.rejects(f.api.loadProfile(),/account-not-approved/);assert.equal(f.api.canEdit(),false);
 }
});
test('approved users retain roles; unverified users are blocked',async()=>{
 for(const role of ['admin','manager','technician','viewer']){const f=fixture({role});await f.api.loadProfile();assert.equal(f.api.canEdit(),role!=='viewer');}
 const f=fixture({role:'admin'});f.auth.currentUser.emailVerified=false;await assert.rejects(f.api.loadProfile());
});
test('registration creates pending membership and missing profiles never gain edit rights',async()=>{
 const f=fixture(null);await f.api.registerAccount({displayName:'New User',email:'user@example.com',password:'fixture-password'});assert.equal(f.writes[0].role,'pending');
 const missing=fixture(null);await assert.rejects(missing.api.loadProfile());assert.equal(missing.writes[0].role,'pending');assert.equal(missing.api.canEdit(),false);
});
test('browser session persistence is explicit and logout clears cached permission',async()=>{
 const f=fixture({role:'admin'});await f.api.initializeSession();assert.deepEqual(f.persistence,['SESSION']);await f.api.loadProfile();await f.api.signOutUser();assert.equal(f.api.canEdit(),false);
});

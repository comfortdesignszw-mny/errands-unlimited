/* Errands Unlimited API — Cloudflare Worker + D1 (SQLite). Static app is served from ./public via ASSETS. */
const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json','cache-control':'no-store'}});
const E=(m,s=400)=>Object.assign(new Error(m),{status:s});
const uid=()=>crypto.randomUUID().replace(/-/g,'').slice(0,14);
const b64=a=>btoa(String.fromCharCode(...new Uint8Array(a)));
const hash=async(pw,salt)=>{const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveBits']);return b64(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:Uint8Array.from(atob(salt),c=>c.charCodeAt(0)),iterations:100000},k,256))};
// phone -> phone@errands.com ; email stays email
const norm=v=>{v=String(v||'').trim().toLowerCase();if(v.includes('@'))return/^\S+@\S+\.\S+$/.test(v)?{email:v}:null;let p=v.replace(/\D/g,'');if(p.startsWith('263'))p='0'+p.slice(3);return p.length>=9&&p.length<=10?{email:p+'@errands.com',phone:p}:null};
const cut=(s,n=300)=>String(s??'').slice(0,n);
export default{async fetch(q,env){const u=new URL(q.url);if(!u.pathname.startsWith('/api/'))return env.ASSETS.fetch(q);
try{return await api(q,env,u.pathname.slice(5).split('/'))}catch(e){return J({error:e.message||'Server error'},e.status||500)}}};
async function api(q,env,P){const D=env.DB,m=q.method,p=P[0],b=m==='POST'?await q.json().catch(()=>({})):{};
const q1=(s,...a)=>D.prepare(s).bind(...a).first(),qa=async(s,...a)=>(await D.prepare(s).bind(...a).all()).results,ex=(s,...a)=>D.prepare(s).bind(...a).run();
const t=(q.headers.get('authorization')||'').slice(7);
const usr=t?await q1('select u.id,u.name,u.email,u.phone,u.role,u.image from sessions s join users u on u.id=s.user_id where s.token=?1 and s.exp>?2',t,Date.now()):null;
const can=async(r,a)=>{const x=await q1('select roles from rules where resource=?1 and action=?2',r,a);if(!x||!x.roles.split(',').includes(usr?usr.role:'guest'))throw E(usr?'Not allowed':'Please sign in',usr?403:401)};
const ntf=(to,ti,bo)=>ex('insert into notes(id,user_id,title,body,ts,read) values(?1,?2,?3,?4,?5,0)',uid(),to,ti,bo,Date.now());
const pub=x=>({id:x.id,name:x.name,email:x.email,phone:x.phone,role:x.role,image:x.image});
// ---- auth: lookup + unified sign-in / sign-up
if(p==='lookup'){const id=norm(b.id);if(!id)throw E('Enter a valid phone number or email');const r=await q1('select name from users where email=?1',id.email);return J({exists:!!r,name:r?r.name.split(' ')[0]:'',via:id.phone?'phone':'email'})}
if(p==='auth'){const id=norm(b.id);if(!id)throw E('Enter a valid phone number or email');const k=id.email,tr=await q1('select * from tries where k=?1',k);
if(tr&&tr.until>Date.now())throw E('Too many attempts. Try again in 5 minutes.',429);
let x=await q1('select * from users where email=?1',k),created=false;
if(x){if(await hash(String(b.pw||''),x.salt)!==x.hash){const n=(tr?tr.n:0)+1;await ex('insert or replace into tries values(?1,?2,?3)',k,n>=5?0:n,n>=5?Date.now()+3e5:0);throw E('Wrong password for this account',401)}await ex('delete from tries where k=?1',k)}
else{if(!b.name||String(b.pw||'').length<6)throw E('Enter your name and a password of 6+ characters');const salt=b64(crypto.getRandomValues(new Uint8Array(16)));
x={id:uid(),email:k,phone:id.phone||'',name:cut(b.name.trim(),60),role:b.role==='messenger'?'messenger':'client',image:'',salt,hash:await hash(b.pw,salt),created:Date.now()};
await ex('insert into users(id,email,phone,name,role,image,salt,hash,created) values(?1,?2,?3,?4,?5,?6,?7,?8,?9)',x.id,x.email,x.phone,x.name,x.role,'',x.salt,x.hash,x.created);created=true;await ntf(x.id,'Welcome to Errands Unlimited','Your account is ready.')}
const tok=uid()+uid();await ex('insert into sessions values(?1,?2,?3)',tok,x.id,Date.now()+30*864e5);return J({token:tok,user:pub(x),created})}
// ---- public (guest) data
if(p==='messengers'){await can('profile','read');return J((await qa('select user_id id,name,phone,tr,ar,bio,sv,img from profiles where listed=1 order by name')).map(r=>({...r,ar:JSON.parse(r.ar||'[]'),sv:JSON.parse(r.sv||'[]')})))}
if(p==='errands'&&m==='GET'){await can('errand','read');return J(await qa(`select e.id,e.client_id,e.title,e.service,e.details,e.pickup,e.dropoff,e.dt,e.tm,e.budget,e.area,e.created,substr(u.name,1,instr(u.name||' ',' ')-1) cn from errands e join users u on u.id=e.client_id where e.status='open' order by e.created desc limit 100`))}
// ---- everything below is private to the signed-in account
if(!usr)throw E('Please sign in',401);
if(p==='me'){if(m==='GET'){const pr=await q1('select * from profiles where user_id=?1',usr.id);return J({user:usr,profile:pr?{...pr,ar:JSON.parse(pr.ar||'[]'),sv:JSON.parse(pr.sv||'[]')}:null})}
await can('user','update');const name=cut(b.name||usr.name,60),img=cut(b.image,60000);let ph=usr.phone;
if(usr.role==='messenger'||usr.role==='admin'){await can('profile','write');const n=norm(b.phone);if(!n||!n.phone)throw E('Enter a valid WhatsApp number');ph=n.phone;
await ex('insert or replace into profiles values(?1,?2,?3,?4,?5,?6,?7,?8,?9)',usr.id,name,ph,cut(b.tr,30),JSON.stringify((b.ar||[]).slice(0,10).map(s=>cut(s,40))),cut(b.bio,300),JSON.stringify((b.sv||[]).slice(0,12).map(s=>({k:cut(s.k,8),n:cut(s.n,80),p:cut(s.p,8)}))),img,b.listed?1:0)}
await ex('update users set name=?1,phone=?2,image=?3 where id=?4',name,ph,img,usr.id);return J({ok:1})}
if(p==='errands'&&m==='POST'){await can('errand','create');if(!b.title||!b.service)throw E('Add a title and service');
await ex('insert into errands(id,client_id,title,service,details,pickup,dropoff,dt,tm,budget,area,status,created) values(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)',uid(),usr.id,cut(b.title,80),cut(b.service,80),cut(b.details,500),cut(b.pickup,100),cut(b.dropoff,100),cut(b.dt,12),cut(b.tm,8),cut(b.budget,10),cut(b.area,60),'open',Date.now());return J({ok:1})}
if(p==='reqs'&&m==='GET'){await can('request','read');const rs=await qa(`select r.*,cu.name cname,cu.phone cphone,mu.name mname,mp.phone mphone from reqs r join users cu on cu.id=r.client_id join users mu on mu.id=r.messenger_id left join profiles mp on mp.user_id=r.messenger_id where r.client_id=?1 or r.messenger_id=?1 order by r.created desc`,usr.id);
return J(rs.map(r=>{const side=r.client_id===usr.id?'client':'messenger',ok=r.kind==='book'||['accepted','completed'].includes(r.st);return{id:r.id,ref:r.ref,kind:r.kind,side,st:r.st,service:r.service,details:r.details,pickup:r.pickup,dropoff:r.dropoff,dt:r.dt,tm:r.tm,price:r.price,other:side==='client'?r.mname:r.cname,phone:side==='client'?r.mphone:(ok?r.cphone:''),created:r.created}}))}
if(p==='reqs'&&m==='POST'){await can('request','create');let r={id:uid(),ref:'EU-'+uid().slice(0,5).toUpperCase(),kind:b.kind==='offer'?'offer':'book',created:Date.now()},to,ph='';
if(r.kind==='offer'){await can('errand','offer');const e=await q1(`select * from errands where id=?1 and status='open'`,b.errand_id);if(!e)throw E('Errand no longer available');if(e.client_id===usr.id)throw E("You can't offer on your own errand");
if(await q1('select 1 x from reqs where errand_id=?1 and messenger_id=?2 and st in (\'pending\',\'accepted\')',e.id,usr.id))throw E('You already offered on this errand');
Object.assign(r,{errand_id:e.id,client_id:e.client_id,messenger_id:usr.id,service:e.service,details:e.title+' — '+e.details,pickup:e.pickup,dropoff:e.dropoff,dt:e.dt,tm:e.tm,price:cut(b.price,10)});to=e.client_id}
else{const mp=await q1('select user_id,phone from profiles where user_id=?1 and listed=1',b.messenger_id);if(!mp)throw E('Messenger not found');if(mp.user_id===usr.id)throw E("You can't book yourself");ph=mp.phone;
Object.assign(r,{errand_id:'',client_id:usr.id,messenger_id:mp.user_id,service:cut(b.service,80),details:cut(b.details,500),pickup:cut(b.pickup,100),dropoff:cut(b.dropoff,100),dt:cut(b.dt,12),tm:cut(b.tm,8),price:cut(b.price,10)});to=mp.user_id}
await ex('insert into reqs(id,ref,kind,errand_id,client_id,messenger_id,service,details,pickup,dropoff,dt,tm,price,st,created) values(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)',r.id,r.ref,r.kind,r.errand_id,r.client_id,r.messenger_id,r.service,r.details,r.pickup,r.dropoff,r.dt,r.tm,r.price,'pending',r.created);
await ntf(to,r.kind==='offer'?'New offer on your errand':'New errand request',`${usr.name}: ${r.service} (${r.ref})`);return J({ref:r.ref,phone:ph})}
if(p==='reqs'&&P[2]==='st'){await can('request','update');const r=await q1('select * from reqs where id=?1 and (client_id=?2 or messenger_id=?2)',P[1],usr.id);if(!r)throw E('Not found',404);
const side=r.client_id===usr.id?'client':'messenger',req=(r.kind==='book')?'client':'messenger',resp=req==='client'?'messenger':'client',s=b.st;
const ok=(side===resp&&r.st==='pending'&&['accepted','declined'].includes(s))||(side===req&&['pending','accepted'].includes(r.st)&&s==='cancelled')||(side==='messenger'&&r.st==='accepted'&&s==='completed');
if(!ok)throw E('That action is not allowed',403);await ex('update reqs set st=?1 where id=?2',s,r.id);
if(r.kind==='offer'&&s==='accepted')await ex(`update errands set status='assigned' where id=?1`,r.errand_id);
await ntf(side==='client'?r.messenger_id:r.client_id,'Errand '+s,`${r.ref} (${r.service}) was ${s} by ${usr.name}`);await ntf(usr.id,'Errand '+s,`You marked ${r.ref} ${s}`);return J({ok:1})}
if(p==='notes'&&m==='GET'){await can('note','read');return J(await qa('select id,title,body,ts,read from notes where user_id=?1 order by ts desc limit 50',usr.id))}
if(p==='notes'&&P[1]==='read'){await ex('update notes set read=1 where user_id=?1',usr.id);return J({ok:1})}
if(p==='logout'){await ex('delete from sessions where token=?1',t);return J({ok:1})}
throw E('Not found',404)}

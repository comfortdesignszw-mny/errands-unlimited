'use strict';
/* Errands Unlimited — offline-first. Data: IndexedDB + in-memory cache. No network needed to start. */
const CFG={ADMINS:[],GOOGLE_ID:''}; // ADMINS: phones/emails that become admin on signup
const SV=[['tender','Tender prebid meetings & site visits'],['hospital','Hospital visits & appointment support'],['elderly','Elderly assistance'],['quote','Quotation requests / photocopying'],['shop','Shopping for food, supplies or gifts'],['pharm','Pharmacy pick-up & delivery'],['parcel','Parcel pick-up from S.A runners'],['dias','Diaspora errand services']];
const TR=['On foot','Bicycle','Motorbike','Car','Kombi / Taxi'];
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID().replace(/-/g,'').slice(0,12);
const S={user:null,profile:null,mode:'li',f:'',img:null};
const toast=m=>{const t=$('#toast');t.textContent=m;t.className='show';setTimeout(()=>t.className='',2800)};
const intl=p=>'263'+String(p).replace(/\D/g,'').replace(/^0/,'');
const wa=(p,t)=>{const u='https://wa.me/'+intl(p)+'?text='+encodeURIComponent(t);window.open(u,'_blank')||(location.href=u)};
const enc=o=>btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g,'-').replace(/\//g,'_');
const dec=s=>JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g,'+').replace(/_/g,'/')))));
const link=o=>location.origin+location.pathname+'#/in/'+enc(o);

/* ---------- Database (IndexedDB + read cache) ---------- */
const DB=(()=>{let db,c={};const T=['user','account','profile','request','notification','rules'];
const open=()=>new Promise((ok,no)=>{const r=indexedDB.open('errands_unlimited',1);r.onupgradeneeded=()=>T.forEach(t=>r.result.createObjectStore(t,{keyPath:'id'}));r.onsuccess=()=>{db=r.result;ok()};r.onerror=()=>no(r.error)});
const tx=(s,m,f)=>new Promise((ok,no)=>{const t=db.transaction(s,m),q=f(t.objectStore(s));t.oncomplete=()=>ok(q.result);t.onerror=()=>no(t.error)});
return{open,async all(s){return c[s]||(c[s]=await tx(s,'readonly',o=>o.getAll()))},async get(s,id){return(await this.all(s)).find(x=>x.id===id)},async put(s,v){await tx(s,'readwrite',o=>o.put(v));delete c[s];return v},async del(s,id){await tx(s,'readwrite',o=>o.delete(id));delete c[s]}}})();

/* ---------- RBAC rules (seeded into DB, read from DB on every check) ---------- */
const ALL=['client','messenger','admin'];
const RULES=[['profile','read',ALL,'any'],['profile','write',['messenger'],'own'],['profile','write',['admin'],'any'],
['user','read',['client','messenger'],'own'],['user','read',['admin'],'any'],['user','update',ALL,'own'],['user','setRole',['admin'],'any'],
['request','create',ALL,'own'],['request','read',['client','messenger'],'own'],['request','read',['admin'],'any'],['request','update',['client','messenger'],'own'],
['notification','read',ALL,'own'],['notification','update',ALL,'own'],['notification','create',ALL,'any'],['rules','write',['admin'],'any']];
async function seed(){if((await DB.all('rules')).length===RULES.length)return;for(const[i,r]of RULES.entries())await DB.put('rules',{id:'r'+i,resource:r[0],action:r[1],roles:r[2],scope:r[3]})}
async function can(res,act,rec){const u=S.user;if(!u)return false;const rs=(await DB.all('rules')).filter(r=>r.resource===res&&r.action===act&&r.roles.includes(u.role));
return rs.some(r=>r.scope==='any'||!rec||rec.userId===u.id||rec.clientId===u.id||rec.id===u.id||(u.phone&&rec.mp===u.phone))}
const need=async(...a)=>{if(!await can(...a))throw Error('Not allowed')};

/* ---------- Auth (Better-Auth-style user/account tables; phone -> phone@errands.com) ---------- */
const norm=v=>{v=v.trim().toLowerCase();if(v.includes('@'))return/^\S+@\S+\.\S+$/.test(v)?{email:v}:null;let p=v.replace(/\D/g,'');if(p.startsWith('263'))p='0'+p.slice(3);return p.length>=9?{email:p+'@errands.com',phone:p}:null};
const b64=a=>btoa(String.fromCharCode(...a));
const hash=async(pw,salt)=>{const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveBits']);return b64(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:Uint8Array.from(atob(salt),c=>c.charCodeAt(0)),iterations:120000},k,256)))};
async function start(u){S.user=u;S.profile=await DB.get('profile',u.id);localStorage.eu_s=u.id}
async function signup(f){const id=norm(f.id);if(!id||f.pw.length<6||!f.name.trim())throw Error('Enter your name, a valid phone/email and a 6+ character password');
if((await DB.all('user')).some(u=>u.email===id.email))throw Error('Account already exists — log in instead');
const u={id:uid(),name:f.name.trim(),email:id.email,phone:id.phone||'',image:'',role:CFG.ADMINS.includes(id.phone||id.email)?'admin':f.role,createdAt:Date.now()};
const salt=b64(crypto.getRandomValues(new Uint8Array(16)));await DB.put('user',u);await DB.put('account',{id:uid(),userId:u.id,providerId:'credential',salt,hash:await hash(f.pw,salt)});await start(u);await notify(u.id,'Welcome to Errands Unlimited','Your account is ready.')}
async function login(f){const id=norm(f.id),a=JSON.parse(localStorage.eu_att||'{}');if(a.until>Date.now())throw Error('Too many attempts. Try again in 5 minutes.');
const u=id&&(await DB.all('user')).find(x=>x.email===id.email),ac=u&&(await DB.all('account')).find(x=>x.userId===u.id&&x.providerId==='credential');
if(!ac||await hash(f.pw,ac.salt)!==ac.hash){const n=(a.n||0)+1;localStorage.eu_att=JSON.stringify(n>=5?{until:Date.now()+3e5}:{n});throw Error('Wrong phone/email or password')}
localStorage.removeItem('eu_att');await start(u)}
async function google(){if(!navigator.onLine||!CFG.GOOGLE_ID)throw Error(navigator.onLine?'Set GOOGLE_ID in app.js to enable Google sign-in':'Google sign-in needs internet');
await new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.onload=ok;s.onerror=no;document.head.append(s)});
window.google.accounts.id.initialize({client_id:CFG.GOOGLE_ID,callback:async r=>{try{const p=JSON.parse(atob(r.credential.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
let u=(await DB.all('user')).find(x=>x.email===p.email);if(!u){u={id:uid(),name:p.name,email:p.email,phone:'',image:p.picture||'',role:'client',createdAt:Date.now()};await DB.put('user',u);await DB.put('account',{id:uid(),userId:u.id,providerId:'google'})}
await start(u);route()}catch(e){toast('Google sign-in failed')}}});window.google.accounts.id.prompt()}

/* ---------- Notifications & requests ---------- */
async function notify(userId,title,body){if(userId){await DB.put('notification',{id:uid(),userId,title,body,ts:Date.now(),read:0});if(S.user&&userId===S.user.id)nav()}}
const byPhone=async p=>p?(await DB.all('user')).find(u=>u.phone===p):null;
async function book(m,f){const u=S.user,r={id:uid(),ref:'EU-'+uid().slice(0,5).toUpperCase(),clientId:u.id,cn:u.name,cp:f.cp,mp:m.phone,mn:m.name,sv:f.sv,d:f.d,pu:f.pu,dr:f.dr,dt:f.dt,tm:f.tm,pr:f.pr,st:'pending',ts:Date.now()};
await need('request','create',r);await DB.put('request',r);
await notify((await byPhone(m.phone))?.id,'New errand request',`${r.cn} requested: ${r.sv} (${r.ref})`);await notify(u.id,'Request sent',`${r.ref} sent to ${m.name}`);
const P={t:'r',id:r.id,ref:r.ref,cn:r.cn,cp:r.cp,mp:r.mp,mn:r.mn,sv:r.sv,d:r.d,pu:r.pu,dr:r.dr,dt:r.dt,tm:r.tm,pr:r.pr};
wa(m.phone,`*New Errand Request – Errands Unlimited*\nRef: ${r.ref}\nService: ${r.sv}\nDetails: ${r.d}\nPickup: ${r.pu||'-'}\nDrop-off: ${r.dr||'-'}\nWhen: ${r.dt||'-'} ${r.tm||''}\nPrice: ${r.pr?'$'+r.pr:'to agree'}\nFrom: ${r.cn} (${r.cp})\n\nOpen in app: ${link(P)}`)}
async function setSt(id,st){const r=await DB.get('request',id),u=S.user;await need('request','update',r);
const m=r.mp===u.phone&&['accepted','declined','completed'].includes(st),c=r.clientId===u.id&&st==='cancelled';if(!m&&!c)throw Error('Not allowed');
r.st=st;await DB.put('request',r);const to=m?r.cp:r.mp,t=m?(r.clientId||(await byPhone(r.cp))?.id):(await byPhone(r.mp))?.id;
await notify(t,'Errand '+st,`${r.ref} (${r.sv}) was ${st}`);await notify(u.id,'Errand '+st,`You marked ${r.ref} ${st}`);
wa(to,`*Errands Unlimited* – ${r.ref} (${r.sv}) was *${st}* by ${m?r.mn:r.cn}.\nOpen: ${link({t:'a',id:r.id,st})}`);route()}
async function inbound(p){if(p.t==='m'){await DB.put('profile',{id:'imp'+p.phone,userId:null,name:p.name,phone:p.phone,tr:p.tr,ar:p.ar,sv:p.sv,bio:p.bio,img:'',listed:1,imported:1});toast('Messenger saved: '+p.name);return}
if(p.t==='r'){if(p.mp!==S.user.phone)throw Error('This request is for another messenger');if(!await DB.get('request',p.id)){await DB.put('request',{...p,clientId:'',st:'pending',ts:Date.now()});await notify(S.user.id,'New errand request',`${p.cn} requested: ${p.sv} (${p.ref})`)}toast('Request received');location.hash='#/req';return}
if(p.t==='a'){const r=await DB.get('request',p.id);if(!r)throw Error('Request not found on this device');await need('request','update',r);r.st=p.st;await DB.put('request',r);await notify(S.user.id,'Errand '+p.st,`${r.ref} (${r.sv}) was ${p.st}`);location.hash='#/req'}}

/* ---------- Views ---------- */
const av=(p,c='')=>`<div class="av ${c}" style="${p.img?`background-image:url(${p.img})`:''}">${p.img?'':esc((p.name||'?')[0].toUpperCase())}</div>`;
const from=p=>{const n=p.sv.map(s=>+s.p).filter(Boolean);return n.length?'from $'+Math.min(...n):'price on request'};
const V={
auth(){const su=S.mode==='su';return`<div class=hero><h1>Errands <b>Unlimited</b></h1><p>Your errands, our priority.</p></div>
<form class=card data-f="${su?'su':'li'}"><div class=tabs><a data-a=mode data-v=li class="${su?'':'on'}">Log in</a><a data-a=mode data-v=su class="${su?'on':''}">Sign up</a></div>
${su?`<label>Full name<input name=name required></label><div class=chips><label><input type=radio name=role value=client checked>I need errands done</label><label><input type=radio name=role value=messenger>I'm a Messenger</label></div>`:''}
<label>Phone or email<input name=id placeholder="0772825413" required autocomplete=username></label>
<label>Password<input name=pw type=password minlength=6 required autocomplete=current-password></label>
<button class=btn>${su?'Create account':'Log in'}</button><button type=button class="btn alt" data-a=google>Continue with Google</button><p id=err class=err></p></form>`},
async home(){await need('profile','read');const ps=(await DB.all('profile')).filter(p=>p.listed&&(!S.f||p.sv.some(s=>s.k===S.f)));
return`<div class=hero><h2>Too busy to queue, collect or deliver?</h2><p>A personal assistant in Bulawayo at an affordable price.</p></div>
<div class=scroll><a class="chip ${S.f?'':'on'}" data-a=filt data-v="">All</a>${SV.map(s=>`<a class="chip ${S.f===s[0]?'on':''}" data-a=filt data-v=${s[0]}>${s[1].split(' ')[0]} ${s[1].split(' ')[1]||''}</a>`).join('')}</div>
${ps.map(p=>`<div class="card row" data-a=go data-v="m/${p.id}">${av(p)}<div class=grow><h3>${esc(p.name)}</h3><div class=m>${esc(p.tr)} · ${esc((p.ar||[]).join(', '))}</div><span class=tag>${from(p)}</span></div></div>`).join('')||`<div class="card m">No messengers yet. Messengers can sign up and list services, or open a shared listing link to save one here.</div>`}`},
async mdet(id){const p=await DB.get('profile',id);if(!p)return'<div class=card>Not found</div>';return`<div class=card><div class=row>${av(p,'big')}<div><h3>${esc(p.name)}</h3><div class=m>${esc(p.tr)}</div></div></div><p>${esc(p.bio)}</p><div class=m>Areas</div>${(p.ar||[]).map(a=>`<span class=tag>${esc(a)}</span>`).join('')}</div>
<div class=card><h3>Services & prices</h3>${p.sv.map(s=>`<div class=svc><span>${esc(s.n)}</span><b>${s.p?'$'+esc(s.p):'ask'}</b></div>`).join('')}<a class=btn data-a=go data-v="book/${p.id}">Book an errand</a></div>`},
async book(id){const p=await DB.get('profile',id);return`<form class=card data-f=book data-id="${p.id}"><h3>Book ${esc(p.name)}</h3>
<label>Service<select name=sv>${p.sv.map(s=>`<option value="${esc(s.n)}" data-p="${esc(s.p)}">${esc(s.n)}${s.p?' – $'+esc(s.p):''}</option>`).join('')}</select></label>
<label>What do you need?<textarea name=d rows=3 required></textarea></label><label>Pick-up location<input name=pu></label><label>Drop-off location<input name=dr></label>
<label>Date<input type=date name=dt></label><label>Time<input type=time name=tm></label><label>Your WhatsApp / phone<input name=cp value="${esc(S.user.phone)}" required></label>
<button class=btn>Send via WhatsApp</button><p id=err class=err></p></form>`},
async req(){const all=await DB.all('request'),rs=[];for(const r of all)if(await can('request','read',r))rs.push(r);rs.sort((a,b)=>b.ts-a.ts);const u=S.user;
return`<h3>Errand requests</h3>${rs.map(r=>{const m=r.mp===u.phone;return`<div class=card><span class="tag ${r.st}">${r.st}</span> <b>${esc(r.ref)}</b><div>${esc(r.sv)}</div><div class=m>${m?'From '+esc(r.cn)+' · '+esc(r.cp):'To '+esc(r.mn)}</div><div class=m>${esc(r.d)}</div><div class=m>${esc(r.pu||'')} ${r.dr?'→ '+esc(r.dr):''} · ${esc(r.dt||'')} ${esc(r.tm||'')}</div>
${m&&r.st==='pending'?`<a class="btn sm" data-a=st data-id=${r.id} data-v=accepted>Accept</a><a class="btn sm no" data-a=st data-id=${r.id} data-v=declined>Decline</a>`:''}${m&&r.st==='accepted'?`<a class="btn sm" data-a=st data-id=${r.id} data-v=completed>Mark completed</a>`:''}${r.clientId===u.id&&['pending','accepted'].includes(r.st)?`<a class="btn sm no" data-a=st data-id=${r.id} data-v=cancelled>Cancel</a>`:''}</div>`}).join('')||'<div class="card m">No requests yet.</div>'}`},
async notes(){const ns=(await DB.all('notification')).filter(n=>n.userId===S.user.id).sort((a,b)=>b.ts-a.ts);for(const n of ns)if(!n.read)await DB.put('notification',{...n,read:1});const h=`<h3>Notifications</h3>${ns.map(n=>`<div class="card n ${n.read?'':'un'}"><b>${esc(n.title)}</b><div>${esc(n.body)}</div><div class=m>${new Date(n.ts).toLocaleString()}</div></div>`).join('')||'<div class="card m">Nothing yet.</div>'}`;setTimeout(nav,0);return h},
async me(){const u=S.user,p=S.profile||{sv:[],ar:[]},isM=u.role==='messenger',img=S.img||(isM?p.img:u.image);
return`<form class=card data-f=me><div class=row>${av({name:u.name,img},'big')}<label class=grow>Profile photo<input type=file accept=image/* data-a=photo></label></div>
<label>Name<input name=name value="${esc(u.name)}" required></label><div class=m>Login: ${esc(u.phone||u.email)} · role: ${u.role}</div>
${isM?`<label>WhatsApp number<input name=phone value="${esc(u.phone||p.phone||'')}" required></label><label>Transport<select name=tr>${TR.map(t=>`<option ${p.tr===t?'selected':''}>${t}</option>`).join('')}</select></label>
<label>Places you serve (comma separated)<input name=ar value="${esc((p.ar||[]).join(', '))}"></label><label>About you<textarea name=bio rows=2>${esc(p.bio||'')}</textarea></label><h3 style="margin-top:14px">Services & prices (USD)</h3>
${SV.map(s=>{const x=p.sv.find(y=>y.k===s[0]);return`<div class=sv><label><input type=checkbox name="s_${s[0]}" ${x?'checked':''}>${s[1]}</label><label>$<input name="p_${s[0]}" type=number min=0 step=0.5 value="${x?esc(x.p):''}"></label></div>`}).join('')}
<div class=sv><label>Other service<input name=cn value="${esc((p.sv.find(y=>y.k==='x')||{}).n||'')}"></label><label>$<input name=cp type=number min=0 step=0.5 value="${esc((p.sv.find(y=>y.k==='x')||{}).p||'')}"></label></div>
<label><input type=checkbox name=listed ${p.listed?'checked':''}>List me in the directory</label>`:''}
<button class=btn>Save profile</button>${isM&&p.listed?`<button type=button class="btn alt" data-a=share>Share my listing on WhatsApp</button>`:''}<button type=button class="btn alt" data-a=out>Log out</button></form>`}};

/* ---------- Actions & forms ---------- */
const ACT={mode:d=>{S.mode=d.v;route()},google,filt:d=>{S.f=d.v;route()},go:d=>location.hash='#/'+d.v,st:d=>setSt(d.id,d.v),
out(){localStorage.removeItem('eu_s');S.user=S.profile=null;route()},
share(){const p=S.profile;wa('',`x`);},
photo(d,el){const f=el.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{const i=new Image();i.onload=()=>{const c=document.createElement('canvas');c.width=c.height=160;const x=c.getContext('2d'),s=Math.min(i.width,i.height);x.drawImage(i,(i.width-s)/2,(i.height-s)/2,s,s,0,0,160,160);S.img=c.toDataURL('image/jpeg',.7);route()};i.src=r.result};r.readAsDataURL(f)}};
ACT.share=()=>{const p=S.profile,u=`https://wa.me/?text=`;const t=`*${p.name}* – Errands Unlimited Messenger\n${p.tr} · ${(p.ar||[]).join(', ')}\nTap to save my listing: ${link({t:'m',name:p.name,phone:p.phone,tr:p.tr,ar:p.ar,sv:p.sv,bio:p.bio})}`;window.open(u+encodeURIComponent(t),'_blank')};
document.addEventListener('change',e=>{if(e.target.dataset.a==='photo')ACT.photo({},e.target)});
const FORM={async li(f){await login(f);route()},async su(f){await signup(f);route()},
async book(f,el){const p=await DB.get('profile',el.dataset.id),o=el.querySelector('select').selectedOptions[0];await book(p,{...f,pr:o.dataset.p});location.hash='#/req'},
async me(f){const u=S.user,m=u.role==='messenger',img=S.img;await need('user','update',u);u.name=f.name.trim();if(img&&!m)u.image=img;
if(m){const sv=SV.filter(s=>f['s_'+s[0]]).map(s=>({k:s[0],n:s[1],p:f['p_'+s[0]]||''}));if(f.cn.trim())sv.push({k:'x',n:f.cn.trim(),p:f.cp||''});
const phone=(norm(f.phone)||{}).phone;if(!phone)throw Error('Enter a valid WhatsApp number');u.phone=phone;
const p={id:u.id,userId:u.id,name:u.name,phone,tr:f.tr,ar:f.ar.split(',').map(s=>s.trim()).filter(Boolean),bio:f.bio,sv,img:img||S.profile?.img||'',listed:f.listed?1:0};await need('profile','write',p);await DB.put('profile',p);S.profile=p}
await DB.put('user',u);S.img=null;toast('Profile saved');route()}};
document.addEventListener('click',async e=>{const a=e.target.closest('[data-a]');if(!a||a.tagName==='INPUT')return;try{await ACT[a.dataset.a]?.(a.dataset,a)}catch(x){toast(x.message)}});
document.addEventListener('submit',async e=>{e.preventDefault();const f=e.target;try{await FORM[f.dataset.f](Object.fromEntries(new FormData(f)),f)}catch(x){const el=$('#err');el?el.textContent=x.message:toast(x.message)}});

/* ---------- Router ---------- */
async function nav(){const un=S.user?(await DB.all('notification')).filter(n=>n.userId===S.user.id&&!n.read).length:0,h=location.hash.slice(2).split('/')[0];
$('#nav').innerHTML=S.user?[['','🏠','Home'],['req','📋','Errands'],['notes','🔔','Alerts'],['me','👤','Profile']].map(x=>`<a data-a=go data-v="${x[0]}" class="${h===x[0]?'on':''}"><span>${x[1]}</span>${x[2]}${x[0]==='notes'&&un?`<em>${un}</em>`:''}</a>`).join(''):''}
async function route(){const[r,a]=location.hash.slice(2).split('/');$('#top').innerHTML=`🏃 <span>Errands <b>Unlimited</b></span><i class="${navigator.onLine?'on':''}"></i>`;
if(!S.user){$('#app').innerHTML=V.auth();$('#nav').innerHTML='';return}
if(sessionStorage.eu_p){const h=sessionStorage.eu_p;sessionStorage.removeItem('eu_p');location.hash=h;return}
try{if(r==='in'){const p=dec(location.hash.slice(6));history.replaceState(0,'','#/');await inbound(p);return route()}
$('#app').innerHTML=r==='m'?await V.mdet(a):r==='book'?await V.book(a):r==='req'?await V.req():r==='notes'?await V.notes():r==='me'?await V.me():await V.home()}catch(x){$('#app').innerHTML=`<div class="card err">${esc(x.message)}</div>`}nav()}
window.addEventListener('hashchange',route);window.addEventListener('online',route);window.addEventListener('offline',route);
(async()=>{if(!crypto.subtle)alert('Open this app over HTTPS to enable secure sign-in.');await DB.open();await seed();const id=localStorage.eu_s;if(id){const u=await DB.get('user',id);if(u)await start(u)}
if(!S.user&&location.hash.startsWith('#/in/'))sessionStorage.eu_p=location.hash;else if(S.user&&sessionStorage.eu_p){location.hash=sessionStorage.eu_p;sessionStorage.removeItem('eu_p')}
route();if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js')})();

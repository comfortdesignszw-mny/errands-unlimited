'use strict';
/* Errands Unlimited — offline-first shell. App + cached public lists load with no network; accounts/requests sync through /api (Cloudflare Worker + D1). */
const SV=[['tender','Tender prebid meetings & site visits'],['hospital','Hospital visits & appointment support'],['elderly','Elderly assistance'],['quote','Quotation requests / photocopying'],['shop','Shopping for food, supplies or gifts'],['pharm','Pharmacy pick-up & delivery'],['parcel','Parcel pick-up from S.A runners'],['dias','Diaspora errand services']];
const TR=['On foot','Bicycle','Motorbike','Car','Kombi / Taxi'];
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=m=>{const t=$('#toast');t.textContent=m;t.className='show';setTimeout(()=>t.className='',3000)};
const intl=p=>'263'+String(p).replace(/\D/g,'').replace(/^0/,'');
const wa=(p,t)=>{const u='https://wa.me/'+intl(p)+'?text='+encodeURIComponent(t);window.open(u,'_blank')||(location.href=u)};
const S={token:localStorage.eu_t||'',user:JSON.parse(localStorage.eu_u||'null'),f:'',step:0,id:'',name:'',pend:'',img:null,un:0};
async function api(p,b){if(!navigator.onLine)throw Error('You are offline — connect to the internet to do this.');
const r=await fetch('/api/'+p,{method:b?'POST':'GET',headers:{'content-type':'application/json',...(S.token?{authorization:'Bearer '+S.token}:{})},body:b?JSON.stringify(b):undefined});
const j=await r.json().catch(()=>({}));if(!r.ok){if(r.status===401&&S.token&&p!=='auth'){setAuth('','')}throw Error(j.error||'Request failed')}return j}
const cached=async k=>{try{const d=await api(k);localStorage['eu_c_'+k]=JSON.stringify(d);return d}catch(e){const c=localStorage['eu_c_'+k];if(c)return JSON.parse(c);throw e}};
function setAuth(t,u){S.token=t;S.user=u||null;t?(localStorage.eu_t=t,localStorage.eu_u=JSON.stringify(u)):(localStorage.removeItem('eu_t'),localStorage.removeItem('eu_u'))}
function gate(next){if(S.user)return true;S.pend=next;S.step=0;location.hash='#/auth';return false}
const av=(p,c='')=>`<div class="av ${c}" style="${p.img?`background-image:url(${esc(p.img)})`:''}">${p.img?'':esc((p.name||'?')[0].toUpperCase())}</div>`;
const from=p=>{const n=(p.sv||[]).map(s=>+s.p).filter(Boolean);return n.length?'from $'+Math.min(...n):'price on request'};
const TRUST=`<div class=trust><div>🛡 Reliable &amp; Trusted</div><div>⏱ Fast &amp; Efficient</div><div>🔒 Confidential &amp; Secure</div><div>👍 Affordable &amp; Convenient</div></div>`;

const V={
home(){return`<div class=hero><p class=ask>🕒 Too busy to queue, collect or deliver?</p><div class=logo>ERRANDS<b>UNLIMITED</b></div><span class=pill>THE MESSENGER</span>
<h2>Having your own personal assistant in Bulawayo at an affordable price.</h2></div>
<div class=card><ul class=ck>${SV.slice(0,7).map(s=>`<li>${s[1]}</li>`).join('')}</ul><div class=dia>📍 Diaspora errand services also available!</div>
<div class=cta><a class=btn data-a=go data-v=m>Find a Messenger</a><a class="btn alt" data-a=go data-v=post>Post an errand</a></div>
<a class="btn alt" data-a=go data-v=e>Browse errands to run</a></div>
<div class=card><h3>Your errands, our priority.</h3><p class=m>We serve Bulawayo and surrounding areas. WhatsApp Based Communications!</div>${TRUST}`},
auth(){const s=S.step;return`<div class=hero><div class=logo>ERRANDS<b>UNLIMITED</b></div><p>${S.pend?'Sign in or register to continue.':'Sign in or create your account.'}</p></div>
<form class=card data-f=${s?'auth':'look'}>${s?`<div class=step><b>${s==='login'?'Welcome back'+(S.name?', '+esc(S.name):'')+'!':'Create your account'}</b><a class=lnk data-a=back>Change</a></div><div class=m>${esc(S.id)}</div>`
:`<label>Phone number or email<input name=id placeholder="0772825413 or you@email.com" required autocomplete=username value="${esc(S.id)}"></label>`}
${s==='signup'?`<label>Full name<input name=name required></label><div class=chips><label><input type=radio name=role value=client checked>I need errands done</label><label><input type=radio name=role value=messenger>I'm a Messenger</label></div>`:''}
${s?`<label>${s==='login'?'Password':'Choose a password (6+ characters)'}<input name=pw type=password minlength=6 required autocomplete=${s==='login'?'current-password':'new-password'} autofocus></label>`:''}
<button class=btn>${s==='login'?'Log in':s==='signup'?'Create account':'Continue'}</button><p id=err class=err></p></form>`},
async msgs(){const ps=(await cached('messengers').catch(()=>[])).filter(p=>!S.f||p.sv.some(s=>s.k===S.f));
return`<h3>Messengers</h3><div class=scroll><a class="chip ${S.f?'':'on'}" data-a=filt data-v="">All</a>${SV.map(s=>`<a class="chip ${S.f===s[0]?'on':''}" data-a=filt data-v=${s[0]}>${s[1].split(/[ &/,]/)[0]}</a>`).join('')}</div>
${ps.map(p=>`<div class="card row" data-a=go data-v="md/${p.id}">${av(p)}<div class=grow><h3>${esc(p.name)}</h3><div class=m>${esc(p.tr)} · ${esc((p.ar||[]).join(', '))}</div><span class=tag>${from(p)}</span></div></div>`).join('')||'<div class="card m">No messengers listed yet.</div>'}`},
async mdet(id){const p=(await cached('messengers')).find(x=>x.id===id);if(!p)return'<div class=card>Not found</div>';return`<div class=card><div class=row>${av(p,'big')}<div><h3>${esc(p.name)}</h3><div class=m>${esc(p.tr)}</div></div></div><p>${esc(p.bio)}</p>${(p.ar||[]).map(a=>`<span class=tag>${esc(a)}</span>`).join('')}</div>
<div class=card><h3>Services & prices</h3>${p.sv.map(s=>`<div class=svc><span>${esc(s.n)}</span><b>${s.p?'$'+esc(s.p):'ask'}</b></div>`).join('')}<a class=btn data-a=go data-v="book/${p.id}">Request an errand</a></div>`},
async book(id){const p=(await cached('messengers')).find(x=>x.id===id);return`<form class=card data-f=book data-id="${p.id}" data-ph="${esc(p.phone)}"><h3>Request ${esc(p.name)}</h3>
<label>Service<select name=service>${p.sv.map(s=>`<option value="${esc(s.n)}" data-p="${esc(s.p)}">${esc(s.n)}${s.p?' – $'+esc(s.p):''}</option>`).join('')}</select></label>
<label>What do you need?<textarea name=details rows=3 required></textarea></label><label>Pick-up location<input name=pickup></label><label>Drop-off location<input name=dropoff></label><label>Date<input type=date name=dt></label><label>Time<input type=time name=tm></label>
<button class=btn>Send request via WhatsApp</button><p id=err class=err></p></form>`},
async errs(){const es=await cached('errands').catch(()=>[]);return`<div class=step><h3>Errands to run</h3><a class="btn sm" data-a=go data-v=post>+ Post</a></div>
${es.map(e=>`<div class=card><span class=tag>${esc(e.service)}</span>${e.budget?`<span class=tag>Budget $${esc(e.budget)}</span>`:''}<h3>${esc(e.title)}</h3><div class=m>${esc(e.details)}</div><div class=m>📍 ${esc(e.area||e.pickup||'Bulawayo')} · ${esc(e.dt||'flexible')} ${esc(e.tm||'')} · by ${esc(e.cn)}</div>
${S.user&&e.client_id===S.user.id?'<span class=tag>Your errand</span>':`<a class="btn sm" data-a=offer data-id=${e.id}>I can run this</a>`}</div>`).join('')||'<div class="card m">No errands posted yet.</div>'}`},
post(){return`<form class=card data-f=post><h3>Post an errand</h3><label>Title<input name=title placeholder="Collect parcel from Bulawayo bus rank" required></label>
<label>Type<select name=service>${SV.map(s=>`<option>${s[1]}</option>`).join('')}</select></label><label>Details<textarea name=details rows=3></textarea></label><label>Area<input name=area placeholder="e.g. Hillside"></label>
<label>Pick-up<input name=pickup></label><label>Drop-off<input name=dropoff></label><label>Date<input type=date name=dt></label><label>Time<input type=time name=tm></label><label>Budget (USD)<input name=budget type=number min=0 step=0.5></label>
<button class=btn>Post errand</button><p class=m>Your phone number and details stay private until you accept a messenger.</p><p id=err class=err></p></form>`},
async act(){const[ns,rs]=await Promise.all([api('notes'),api('reqs')]);api('notes/read',{}).then(()=>{S.un=0;nav()}).catch(()=>{});
return`<h3>Notifications</h3>${ns.slice(0,8).map(n=>`<div class="card n ${n.read?'':'un'}"><b>${esc(n.title)}</b><div>${esc(n.body)}</div><div class=m>${new Date(n.ts).toLocaleString()}</div></div>`).join('')||'<div class="card m">Nothing yet.</div>'}
<h3>My errands & requests</h3>${rs.map(r=>{const req=r.kind==='book'?'client':'messenger',resp=r.side!==req;return`<div class=card><span class="tag ${r.st}">${r.st}</span><span class=tag>${r.kind==='book'?'Booking':'Offer'}</span> <b>${esc(r.ref)}</b><div>${esc(r.service)}</div><div class=m>${r.side==='client'?'With':'From'} ${esc(r.other)}${r.phone?' · '+esc(r.phone):''}</div><div class=m>${esc(r.details)}</div><div class=m>${esc(r.pickup||'')} ${r.dropoff?'→ '+esc(r.dropoff):''} ${esc(r.dt||'')} ${esc(r.tm||'')}${r.price?' · $'+esc(r.price):''}</div>
${resp&&r.st==='pending'?`<a class="btn sm" data-a=st data-id=${r.id} data-v=accepted>Accept</a><a class="btn sm no" data-a=st data-id=${r.id} data-v=declined>Decline</a>`:''}${r.side==='messenger'&&r.st==='accepted'?`<a class="btn sm" data-a=st data-id=${r.id} data-v=completed>Mark completed</a>`:''}${r.side===req&&['pending','accepted'].includes(r.st)?`<a class="btn sm no" data-a=st data-id=${r.id} data-v=cancelled>Cancel</a>`:''}${r.phone&&r.st==='accepted'?`<a class="btn sm alt" data-a=wa data-v="${esc(r.phone)}">WhatsApp</a>`:''}</div>`}).join('')||'<div class="card m">No requests yet.</div>'}`},
async me(){const{user:u,profile:p0}=await api('me'),p=p0||{sv:[],ar:[]},m=u.role!=='client',img=S.img||(m?p.img:u.image);
return`<form class=card data-f=me><div class=row>${av({name:u.name,img},'big')}<label class=grow>Profile photo<input type=file accept=image/* data-a=photo></label></div>
<label>Name<input name=name value="${esc(u.name)}" required></label><div class=m>Private to you · ${esc(u.phone||u.email)} · ${u.role}</div>
${m?`<label>WhatsApp number<input name=phone value="${esc(u.phone||p.phone||'')}" required></label><label>Transport<select name=tr>${TR.map(t=>`<option ${p.tr===t?'selected':''}>${t}</option>`).join('')}</select></label>
<label>Places you serve (comma separated)<input name=ar value="${esc((p.ar||[]).join(', '))}"></label><label>About you<textarea name=bio rows=2>${esc(p.bio||'')}</textarea></label><h3 style="margin-top:14px">Services & prices (USD)</h3>
${SV.map(s=>{const x=p.sv.find(y=>y.k===s[0]);return`<div class=sv><label><input type=checkbox name="s_${s[0]}" ${x?'checked':''}>${s[1]}</label><label>$<input name="p_${s[0]}" type=number min=0 step=0.5 value="${x?esc(x.p):''}"></label></div>`}).join('')}
<label><input type=checkbox name=listed ${p.listed?'checked':''}>List me publicly as a Messenger</label>`:''}
<button class=btn>Save profile</button><button type=button class="btn alt" data-a=out>Log out</button></form>`}};

const ACT={go:d=>location.hash='#/'+d.v,filt:d=>{S.f=d.v;route()},wa:d=>wa(d.v,'Hi Errands Unlimited, I need help with an errand.'),
back(){S.step=0;route()},
async out(){try{await api('logout',{})}catch(e){}setAuth('','');location.hash='#/';route()},
async st(d){await api(`reqs/${d.id}/st`,{st:d.v});route()},
async offer(d){if(!gate('#/e'))return;if(S.user.role==='client')throw Error('Register as a Messenger to offer on errands');const p=prompt('Your price in USD (optional)');if(p===null)return;await api('reqs',{kind:'offer',errand_id:d.id,price:p});toast('Offer sent');location.hash='#/act'},
photo(d,el){const f=el.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{const i=new Image();i.onload=()=>{const c=document.createElement('canvas');c.width=c.height=160;const x=c.getContext('2d'),s=Math.min(i.width,i.height);x.drawImage(i,(i.width-s)/2,(i.height-s)/2,s,s,0,0,160,160);S.img=c.toDataURL('image/jpeg',.7);toast('Photo ready — tap Save profile')};i.src=r.result};r.readAsDataURL(f)}};
document.addEventListener('change',e=>{if(e.target.dataset.a==='photo')ACT.photo({},e.target)});
const FORM={async look(f){S.id=f.id.trim();const r=await api('lookup',{id:f.id});S.name=r.name;S.step=r.exists?'login':'signup';route()},
async auth(f){const r=await api('auth',{id:S.id,...f});setAuth(r.token,r.user);S.step=0;toast(r.created?'Account created — welcome!':'Welcome back, '+r.user.name.split(' ')[0]);const n=S.pend||'#/';S.pend='';location.hash=n;route()},
async book(f,el){const o=el.querySelector('select').selectedOptions[0],r=await api('reqs',{kind:'book',messenger_id:el.dataset.id,...f,price:o.dataset.p});
wa(r.phone,`*New Errand Request – Errands Unlimited*\nRef: ${r.ref}\nService: ${f.service}\nDetails: ${f.details}\nPickup: ${f.pickup||'-'}\nDrop-off: ${f.dropoff||'-'}\nWhen: ${f.dt||'-'} ${f.tm||''}\nFrom: ${S.user.name}`);location.hash='#/act'},
async post(f){await api('errands',f);localStorage.removeItem('eu_c_errands');toast('Errand posted');location.hash='#/e'},
async me(f){const sv=SV.filter(s=>f['s_'+s[0]]).map(s=>({k:s[0],n:s[1],p:f['p_'+s[0]]||''}));
await api('me',{name:f.name,image:S.img||undefined,phone:f.phone,tr:f.tr,ar:(f.ar||'').split(',').map(s=>s.trim()).filter(Boolean),bio:f.bio,sv,listed:!!f.listed});
const{user}=await api('me');setAuth(S.token,user);S.img=null;localStorage.removeItem('eu_c_messengers');toast('Profile saved');route()}};
document.addEventListener('click',async e=>{const a=e.target.closest('[data-a]');if(!a||a.tagName==='INPUT')return;try{await ACT[a.dataset.a]?.(a.dataset,a)}catch(x){toast(x.message)}});
document.addEventListener('submit',async e=>{e.preventDefault();const f=e.target;try{await FORM[f.dataset.f](Object.fromEntries(new FormData(f)),f)}catch(x){const el=$('#err');el?el.textContent=x.message:toast(x.message)}});

async function nav(){const h=location.hash.slice(2).split('/')[0],L=S.user?[['','🏠','Home'],['m','🧑‍🔧','Messengers'],['e','📋','Errands'],['act','🔔','Activity'],['me','👤','Me']]:[['','🏠','Home'],['m','🧑‍🔧','Messengers'],['e','📋','Errands'],['auth','👤','Sign in']];
$('#nav').innerHTML=L.map(x=>`<a data-a=go data-v="${x[0]}" class="${h===x[0]?'on':''}"><span>${x[1]}</span>${x[2]}${x[0]==='act'&&S.un?`<em>${S.un}</em>`:''}</a>`).join('')}
async function route(){const[r,a]=location.hash.slice(2).split('/');$('#top').innerHTML=`🏃 <span>Errands <b>Unlimited</b></span><i class="${navigator.onLine?'on':''}"></i>`;
if(['book','post','act','me'].includes(r)&&!gate('#/'+location.hash.slice(2)))return;
try{$('#app').innerHTML=r==='auth'?(S.user?(location.hash='#/',V.home()):V.auth()):r==='m'?await V.msgs():r==='md'?await V.mdet(a):r==='book'?await V.book(a):r==='e'?await V.errs():r==='post'?V.post():r==='act'?await V.act():r==='me'?await V.me():V.home()}
catch(x){$('#app').innerHTML=`<div class="card err">${esc(x.message)}</div>`}nav();window.scrollTo(0,0);
if(S.user&&navigator.onLine)api('notes').then(n=>{S.un=n.filter(x=>!x.read).length;nav()}).catch(()=>{})}
window.addEventListener('hashchange',route);window.addEventListener('online',route);window.addEventListener('offline',route);
route();if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');

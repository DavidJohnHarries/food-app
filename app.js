const LS=k=>JSON.parse(localStorage.getItem(k)||'null'),SV=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const SEED=[['Synthroid','100 mcg',1],['Vyvanse','20 mg',1],['Creatine','5 g',1],['Fish oil','4 g',1],['Vitamin K2 + D3','1 capsule',1],['B2 riboflavin','100 mg',1],['B-complex (Organika)','1 capsule',1],['Saw palmetto','1600 mg',1],['Plant sterol','500 mg',1],['L-citrulline','2 g',1],['Oat yogurt with walnuts + dark chocolate','',1],['Salmon or cod with veg','',1],['Mixed nuts','',1],['Fennel tea','',1],['Soy milk in tea','',1],['Electrolytes (Re-Lyte)','',0],['Protein shake','30 g',0],['Magnesium L-threonate','50 mg',0],['Chili','',0],['Curry','',0],['Keto pasta','',0],['Steak and salad','',0],['Belly Comfort tea','',0],['Ginger Aid tea','',0],['Beer','1 drink',0],['Scotch','1 drink',0],['Gin and tonic','1 drink',0]];
let items=LS('items')||SEED.map(([name,amount,d])=>({id:uid(),name,amount,def:!!d})),hist=LS('hist')||[],days=LS('days')||{},firstUse=LS('firstUse'),day=null,lastToday=null,view='log',summary=null,editing=null;
const MULTS=[0.5,1,2];
const save=()=>{SV('items',items);SV('hist',hist);SV('days',days);SV('firstUse',firstUse)};
const ymd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today=()=>ymd(new Date());
const toD=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(s,n)=>{const d=toD(s);d.setDate(d.getDate()+n);return ymd(d)};
const pretty=s=>toD(s).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
const MAXBACK=30;
// migrate single-day storage from v1
(()=>{const old=LS('day');if(old&&old.date&&!days[old.date])days[old.date]=old;localStorage.removeItem('day')})();
if(!firstUse)firstUse=Object.keys(days).sort()[0]||hist.map(h=>h.date).sort()[0]||today();
const completed=d=>hist.some(h=>h.date===d);
// Each date has its own log; a date never visited starts at defaults.
function getDay(d){if(!days[d]){const x={id:d,date:d,sel:{},notes:''};items.forEach(i=>{if(i.def)x.sel[i.id]=1});days[d]=x}return days[d]}
function goTo(d){day=getDay(d);save()}
// Open rule: oldest uncompleted of [today-2, today-1] (not before first use), else today.
function ensureDay(){const t=today();if(lastToday!==t||!day){lastToday=t;goTo(t);return true}return false}
function parseAmt(a){const m=String(a||'').trim().match(/^(\d+(?:\.\d+)?|\.\d+)\s*(.*)$/);return m?{n:parseFloat(m[1]),u:m[2]}:null}
function fmtN(n){return String(Math.round(n*1000)/1000)}
function amtText(it,mult){const p=parseAmt(it.amount);if(!p)return it.amount||'';return fmtN(p.n*mult)+(p.u?' '+p.u:'')}
function line(it,mult){const a=amtText(it,mult);return '- '+it.name+(a?' '+a:'')}
function buildSummary(d){const its=d.items;const L=[`DATE ${d.date}`,'','Included:'];
 const inc=its.filter(i=>i.sel);L.push(...(inc.length?inc.map(i=>line(i,i.mult)):['none']));
 const sk=its.filter(i=>i.def&&!i.sel),ex=its.filter(i=>!i.def&&i.sel),ch=its.filter(i=>i.sel&&i.mult!==1&&parseAmt(i.amount));
 L.push('','Skipped defaults:',...(sk.length?sk.map(i=>'- '+i.name):['none']));
 L.push('','Extras:',...(ex.length?ex.map(i=>line(i,i.mult)):['none']));
 L.push('','Changed amounts:',...(ch.length?ch.map(i=>`${line(i,i.mult)} (${i.mult}x, default ${i.amount})`):['none']));
 L.push('',`Notes: ${d.notes.trim()||'none'}`);return L.join('\n')}
function snapshot(){if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
 return {id:day.date,date:day.date,notes:day.notes,items:items.map(i=>({name:i.name,amount:i.amount,def:i.def,sel:day.sel[i.id]!=null,mult:day.sel[i.id]??1}))}}
function commit(){const s=snapshot();const i=hist.findIndex(h=>h.date===s.date);if(i>=0)hist[i]=s;else hist.unshift(s);summary=buildSummary(s);save()}
function toast(m){const d=document.createElement('div');d.className='toast';d.textContent=m;document.body.appendChild(d);setTimeout(()=>d.remove(),1500)}
function copy(t){(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast('Copied')).catch(()=>{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('Copied')})}
const nudge=el=>{el.classList.remove('nudge');void el.offsetWidth;el.classList.add('nudge')};
function keepScroll(fn){const y=scrollY;fn();scrollTo(0,y);requestAnimationFrame(()=>scrollTo(0,y))}

function pickRow(it){const m=day.sel[it.id],on=m!=null,p=parseAmt(it.amount);
 if(!on)return `<div class="ex" data-pick="${it.id}"><span class="name">${esc(it.name)}<small>${esc(it.amount||(it.def?'Default':'Occasional'))}</small></span><span class="mark">+</span></div>`;
 const amt=p?`<div class="amt"><button class="s" data-st="-1" aria-label="Less">−</button><span class="v" data-v>${esc(amtText(it,m))}${m!==1?` (${m}x)`:''}</span><button class="s" data-st="1" aria-label="More">+</button></div>`:(it.amount?`<small>${esc(it.amount)}</small>`:'');
 return `<div class="ex sel" data-pick="${it.id}"><span class="name">${esc(it.name)}${amt}</span><button class="mark unsel" data-unsel aria-label="Remove">✓</button></div>`}
function wirePick(row){row.onclick=e=>{e.preventDefault();const id=row.dataset.pick,it=items.find(x=>x.id===id);if(!it)return;
  if(e.target.closest('[data-unsel]')){delete day.sel[id];save();replaceRow(row,it);return}
  const st=e.target.closest('[data-st]');
  if(st){const i=MULTS.indexOf(day.sel[id]),j=Math.min(2,Math.max(0,(i<0?1:i)+ +st.dataset.st));if(j===i)return nudge(row);day.sel[id]=MULTS[j];save();
    row.querySelector('[data-v]').textContent=amtText(it,MULTS[j])+(MULTS[j]!==1?` (${MULTS[j]}x)`:'');return}
  if(day.sel[id]!=null)return nudge(row);
  day.sel[id]=1;save();replaceRow(row,it)}}
function replaceRow(row,it){keepScroll(()=>{const t=document.createElement('div');t.innerHTML=pickRow(it);const n=t.firstElementChild;row.replaceWith(n);wirePick(n)})}

function render(){endDrag();
 document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.v===view));
 const a=$('#app');
 if(summary){$('#title').textContent='Summary';a.innerHTML=`<div class="card"><pre id="sum">${esc(summary)}</pre>
  <button class="btn sec full" id="back">← Back (edit day)</button><button class="btn full" id="copy">Copy</button>${navigator.share?'<button class="btn sec full" id="share">Share…</button>':''}
  <button class="btn sec full" id="done">Done</button></div>`;
  $('#copy').onclick=()=>{commit();copy(summary)};if($('#share'))$('#share').onclick=()=>{commit();navigator.share({text:summary}).catch(()=>{})};
  $('#done').onclick=()=>{commit();goTo(today());summary=null;view='log';render();scrollTo(0,0)};
  $('#back').onclick=()=>{summary=null;view='log';render()};return}
 if(view==='log'){const t=today(),isT=day.date===t,minD=addDays(t,-MAXBACK);$('#title').textContent='Log';
  a.innerHTML=`<div class="datebar${isT?'':' past'}"><button class="dnav" id="dprev" ${day.date<=minD?'disabled':''} aria-label="Previous day">‹</button><span class="dlabel">${isT?'Today · ':''}${pretty(day.date)}</span><button class="dnav" id="dnext" ${isT?'disabled':''} aria-label="Next day">›</button></div>`+
   ((()=>{const c=completed(day.date),stt=`<span class="stat ${c?'ok':'no'}">${c?'Sent ✓':'Not sent'}</span>`;
    return isT?(c?`<div class="todayban">Today ${stt}<span class="muted"> · finishing again updates it</span></div>`:''):`<div class="pastban"><span>Past day: ${pretty(day.date)}</span>${stt}</div>`})())+
   items.map(pickRow).join('')+`<button class="btn full${isT?'':' pastbtn'}" id="finish" style="margin-top:12px">${isT?'Finish day':'Finish '+pretty(day.date).replace(',','')}</button>
   <div class="card"><textarea id="notes" placeholder="Notes (optional)">${esc(day.notes)}</textarea></div>`;
  a.querySelectorAll('[data-pick]').forEach(wirePick);
  $('#notes').oninput=e=>{day.notes=e.target.value;save()};
  $('#dprev').onclick=()=>{if(day.date>minD){if(document.activeElement)document.activeElement.blur();goTo(addDays(day.date,-1));render();scrollTo(0,0)}};
  $('#dnext').onclick=()=>{if(day.date<t){if(document.activeElement)document.activeElement.blur();goTo(addDays(day.date,1));render();scrollTo(0,0)}};
  $('#finish').onclick=()=>{summary=buildSummary(snapshot());render();scrollTo(0,0)};
 }else if(view==='items'){$('#title').textContent='Items';
  const ed=editing&&editing!=='new'?items.find(i=>i.id===editing):null;
  a.innerHTML=`<div class="card" id="form"><h3>${ed?'Edit item':'Add item'}</h3><input type="text" id="in" placeholder="Name" value="${esc(ed?ed.name:'')}">
   <input type="text" id="ia" placeholder="Amount (optional), e.g. 100 mcg" style="margin-top:8px" value="${esc(ed?ed.amount:'')}">
   <label class="tog"><input type="checkbox" id="id" ${!ed||ed.def?'checked':''}> Included by default</label>
   <button class="btn full" id="isave">${ed?'Save changes':'Add item'}</button>${ed?'<button class="btn sec full" id="icancel">Cancel</button><button class="btn danger full" id="idel">Delete item</button>':''}</div>
   <div id="libl">`+items.map(i=>`<div class="ex lr" data-id="${i.id}"><span class="handle" aria-label="Drag to reorder">☰</span><span class="name">${esc(i.name)}<small>${esc([i.amount,i.def?'Default':'Occasional'].filter(Boolean).join(' · '))}</small></span><span class="mv2"><button class="mv" data-mv="-1" aria-label="Move up">▲</button><button class="mv" data-mv="1" aria-label="Move down">▼</button></span><button class="ed" data-edit="${i.id}" aria-label="Edit">✎</button></div>`).join('')+'</div>';
  $('#isave').onclick=()=>{const name=$('#in').value.trim();if(!name)return toast('Name required');const amount=$('#ia').value.trim(),def=$('#id').checked;
   if(ed){Object.assign(ed,{name,amount,def});if(day.sel[ed.id]!=null&&!parseAmt(amount))day.sel[ed.id]=1}else{const it={id:uid(),name,amount,def};items.push(it);if(def&&day.sel[it.id]==null)day.sel[it.id]=1}
   editing=null;save();render();toast(ed?'Saved':'Added')};
  if(ed){$('#icancel').onclick=()=>{editing=null;render()};$('#idel').onclick=()=>{if(confirm(`Delete ${ed.name}?`)){items=items.filter(x=>x!==ed);delete day.sel[ed.id];editing=null;save();render()}}}
  a.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{editing=b.dataset.edit;render();scrollTo(0,0)});
  setupReorder($('#libl'));
 }else{$('#title').textContent='History';
  a.innerHTML=hist.length?hist.map((s,i)=>`<div class="card"><pre>${esc(buildSummary(s))}</pre><button class="btn sec" data-c="${i}">Copy</button> <button class="btn danger" data-d="${i}">Delete</button></div>`).join(''):'<p class="muted">No days logged yet.</p>';
  a.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>copy(buildSummary(hist[b.dataset.c])));
  a.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{if(confirm('Delete this day?')){hist.splice(+b.dataset.d,1);save();render()}});
 }}
// ---- Reordering. The dragged row is NEVER detached/re-inserted (that drops iOS pointer capture);
// only its siblings are moved around it. Cleanup always runs (up/cancel/lostcapture/touchend/blur/hidden/render).
let drag=null;
document.addEventListener('touchmove',e=>{if(drag&&e.cancelable)e.preventDefault()},{passive:false});
function syncFromDom(list){const ids=[...list.children].map(n=>n.dataset.id);items=ids.map(id=>items.find(e=>e.id===id)).filter(Boolean);save()}
function endDrag(){if(!drag)return;const d=drag;drag=null;
 try{d.h.releasePointerCapture&&d.h.hasPointerCapture&&d.h.hasPointerCapture(d.id)&&d.h.releasePointerCapture(d.id)}catch(_){}
 d.row.classList.remove('dragging');d.row.style.transform='';if(d.list.isConnected)syncFromDom(d.list)}
function dragMove(e){if(!drag||(e.pointerId!=null&&e.pointerId!==drag.id))return;if(e.cancelable)e.preventDefault();
 const {row,list}=drag;row.style.transform='';const y=e.clientY;let sib;
 while((sib=row.previousElementSibling)&&y<sib.getBoundingClientRect().top+sib.offsetHeight/2)list.insertBefore(sib,row.nextElementSibling); // move sibling below row
 while((sib=row.nextElementSibling)&&y>sib.getBoundingClientRect().top+sib.offsetHeight/2)list.insertBefore(sib,row);                       // move sibling above row
 const r=row.getBoundingClientRect();row.style.transform=`translateY(${y-(r.top+r.height/2)}px)`;
 if(y<60)scrollBy(0,-8);else if(y>innerHeight-110)scrollBy(0,8)}
document.addEventListener('pointermove',dragMove,{passive:false});
['pointerup','pointercancel','touchend','touchcancel'].forEach(t=>document.addEventListener(t,e=>{if(drag&&(e.pointerId==null||e.pointerId===drag.id))endDrag()}));
window.addEventListener('blur',endDrag);document.addEventListener('visibilitychange',()=>{if(document.hidden)endDrag()});
function setupReorder(list){
 list.querySelectorAll('.mv').forEach(b=>b.onclick=()=>{const row=b.closest('.lr');
  if(b.dataset.mv==='-1'){const p=row.previousElementSibling;if(p)list.insertBefore(p,row.nextElementSibling)}else{const n=row.nextElementSibling;if(n)list.insertBefore(n,row)}syncFromDom(list)});
 list.querySelectorAll('.handle').forEach(h=>{
  h.addEventListener('pointerdown',e=>{if(drag)endDrag();e.preventDefault();const row=h.closest('.lr');drag={row,list,h,id:e.pointerId};row.classList.add('dragging');
   try{h.setPointerCapture(e.pointerId)}catch(_){}});
  h.addEventListener('lostpointercapture',e=>{if(drag&&e.pointerId===drag.id)endDrag()})})}
// ---- New day detection
function checkDay(){if(ensureDay())render()}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!summary&&!drag)checkDay()});
window.addEventListener('focus',()=>{if(!summary&&!drag)checkDay()});
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{summary=null;editing=null;view=b.dataset.v;render()});
ensureDay();render();
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js',{scope:'./'});

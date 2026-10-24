(()=>{
  'use strict';

  const D=window.VAULT_DATA;
  const SI=window.VAULT_SEARCH_INDEX||{entries:[],stats:{}};
  const PV=window.VAULT_PREVIEWS||{text:{},docx:{}};
  if(!D) return;

  const main=document.getElementById('main');
  const search=document.getElementById('globalSearch');
  const clearSearch=document.getElementById('clearSearch');
  const sidebar=document.getElementById('sidebar');
  const sidebarBackdrop=document.getElementById('sidebarBackdrop');
  const utilityDialog=document.getElementById('utilityDialog');
  const ownerLabel={demoa:'Pessoa A',demob:'Pessoa B',casa:'Casa',shared:'Compartilhado'};
  const ownerRoute=owner=>D.profiles[owner]?owner:'documents';
  const threshold=Number(D.thresholdDays||90);
  const docState={owner:'all',category:'all',format:'all',sort:'name',favorite:false};
  const docByPath=new Map(D.documents.map(d=>[d.path,d]));
  const searchEntryByPath=new Map((SI.entries||[]).map(e=>[e.path,e]));
  const searchNormByPath=new Map((SI.entries||[]).filter(e=>e.text).map(e=>[e.path,norm(e.text)]));
  const recordSourceMap=new Map();
  D.records.forEach(r=>(r.sources||[]).forEach(p=>recordSourceMap.set(p,r)));

  let validityOnly=false;
  let toastTimer;
  let searchTimer;
  let currentViewer=null;
  let noteTimer;

  const icons={
    arrow:'<svg viewBox="0 0 24 24"><path d="M5 12h14M14 7l5 5-5 5"/></svg>',
    clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg>',
    alert:'<svg viewBox="0 0 24 24"><path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4M12 16.5h.01"/></svg>',
    check:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>',
    file:'<svg viewBox="0 0 24 24"><path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></svg>',
    folder:'<svg viewBox="0 0 24 24"><path d="M3 6h6l2 2h10v11H3z"/></svg>',
    eye:'<svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.8"/></svg>',
    copy:'<svg viewBox="0 0 24 24"><rect x="8" y="8" width="10" height="11" rx="2"/><path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    external:'<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6H5V6h6"/></svg>',
    search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>',
    list:'<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    shield:'<svg viewBox="0 0 24 24"><path d="M12 3 4 6v5c0 4.9 3.1 8.5 8 10 4.9-1.5 8-5.1 8-10V6l-8-3Z"/><path d="m9.5 12 1.7 1.7 3.8-4"/></svg>',
    home:'<svg viewBox="0 0 24 24"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></svg>',
    calendar:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>',
    archive:'<svg viewBox="0 0 24 24"><path d="M4 8h16v12H4zM3 4h18v4H3zM9 12h6"/></svg>',
    star:'<svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>',
    recent:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l-3 2"/></svg>',
    text:'<svg viewBox="0 0 24 24"><path d="M5 5h14M9 9h6M9 13h6M9 17h4"/></svg>'
  };

  function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function norm(s=''){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
  function matches(text,query){const hay=norm(text),tokens=norm(query).trim().split(/\s+/).filter(Boolean);return tokens.length>0&&tokens.every(t=>hay.includes(t));}
  const plural=(n,one,many=one+'s')=>`${n} ${n===1?one:many}`;
  const today0=()=>{const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate());};
  const parseDate=s=>{if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;const [y,m,d]=s.split('-').map(Number),date=new Date(y,m-1,d);return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d?date:null;};
  const daysTo=s=>{const d=parseDate(s),today=today0();return d?(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(today.getFullYear(),today.getMonth(),today.getDate()))/86400000:null;};
  const fmtDate=s=>{const d=parseDate(s);return d?new Intl.DateTimeFormat('pt-BR').format(d):'—';};
  const fmtDateTime=t=>{if(!t)return '—';return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(t));};
  const sizeFmt=n=>!Number.isFinite(Number(n))?'—':n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(0)} KB`:`${(n/1048576).toFixed(1)} MB`;
  const extOf=path=>(String(path).split('.').pop()||'').toLowerCase();
  const basename=path=>String(path).split('/').pop()||path;
  const currentHash=()=>{try{return decodeURIComponent((location.hash||'#dashboard').slice(1));}catch{return 'dashboard';}};

  function safeStorageGet(key){try{return localStorage.getItem(key);}catch{return null;}}
  function safeStorageSet(key,value){try{localStorage.setItem(key,value);}catch{}}
  function loadState(){
    let s={favorites:[],recents:[],completedTasks:{},notes:{},theme:'auto',privacy:false};
    try{const raw=safeStorageGet('vault-state-v3');if(raw)s={...s,...JSON.parse(raw)};}catch{}
    if(!s.theme||!['auto','light','dark'].includes(s.theme))s.theme=safeStorageGet('vault-theme-v2')||'auto';
    if(typeof s.privacy!=='boolean')s.privacy=safeStorageGet('vault-privacy-v2')==='1';
    s.favorites=Array.isArray(s.favorites)?s.favorites:[];
    s.recents=Array.isArray(s.recents)?s.recents:[];
    s.completedTasks=s.completedTasks&&typeof s.completedTasks==='object'?s.completedTasks:{};
    s.notes=s.notes&&typeof s.notes==='object'?s.notes:{};
    return s;
  }
  let localState=loadState();
  let favorites=new Set(localState.favorites);
  function saveState(){localState.favorites=[...favorites];safeStorageSet('vault-state-v3',JSON.stringify(localState));updateNavCounts();}
  const isTaskDone=id=>Boolean(localState.completedTasks[id]);

  function validity(r){
    if(!r.expires)return{key:'none',label:'Sem validade',detail:'Sem vencimento cadastrado',days:null};
    const days=daysTo(r.expires);
    if(days===null)return{key:'none',label:'Data não confirmada',detail:'Verificar a data no documento original',days:null};
    if(days<0)return{key:'expired',label:'Vencido',detail:`venceu há ${Math.abs(days)} ${Math.abs(days)===1?'dia':'dias'}`,days};
    if(days<=threshold)return{key:'near',label:'Perto de vencer',detail:days===0?'vence hoje':`vence em ${days} ${days===1?'dia':'dias'}`,days};
    return{key:'comfortable',label:'Validade confortável',detail:`${days} dias restantes`,days};
  }
  function statusHTML(r){const v=validity(r),mark={comfortable:'✓',near:'•',expired:'!',none:'—'}[v.key];return`<span class="status ${v.key}">${mark} ${v.label}</span>`;}
  function actionRecordList(){return D.records.filter(r=>r.current&&r.action===true&&r.expires).map(r=>({...r,_v:validity(r)})).filter(r=>['near','expired'].includes(r._v.key)).sort((a,b)=>(a._v.days??999999)-(b._v.days??999999));}
  function currentValidityList(owner){return D.records.filter(r=>r.current&&r.expires&&(!owner||r.owner===owner)).map(r=>({...r,_v:validity(r)})).sort((a,b)=>(a._v.days??999999)-(b._v.days??999999));}
  function allRecordSorted(owner){const rank={expired:0,near:1,comfortable:2,none:3};return D.records.filter(r=>!owner||r.owner===owner).filter(r=>!validityOnly||r.expires).sort((a,b)=>rank[validity(a).key]-rank[validity(b).key]||(b.priority||0)-(a.priority||0));}
  const taskTone=t=>t.severity==='urgent'?'urgent':t.severity==='attention'?'attention':'normal';
  const recordTone=r=>{const v=validity(r);return v.key==='expired'||(v.days!==null&&v.days<=30)?'urgent':'attention';};
  function allActions(){
    const matchedTasks=new Set(),toneRank={urgent:0,attention:1,normal:2,ok:3};
    const docs=actionRecordList().map(r=>{
      const linked=D.tasks.find(t=>!isTaskDone(t.id)&&!matchedTasks.has(t.id)&&t.owner===r.owner&&matches(t.title,r.type));
      if(linked)matchedTasks.add(linked.id);
      const rt=recordTone(r),tt=linked?taskTone(linked):'normal',tone=toneRank[tt]<toneRank[rt]?tt:rt;
      return{kind:'record',tone,sort:r._v.days??999,title:linked?.title||r.title,owner:r.owner,notes:linked?.notes||r.notes,record:r,task:linked||null};
    });
    const tasks=D.tasks.filter(t=>!isTaskDone(t.id)&&!matchedTasks.has(t.id)).map((t,i)=>({kind:'task',tone:taskTone(t),sort:t.severity==='urgent'?-1000:t.severity==='attention'?-500:1000+i,title:t.title,owner:t.owner,notes:t.notes,task:t}));
    return[...docs,...tasks].sort((a,b)=>toneRank[a.tone]-toneRank[b.tone]||a.sort-b.sort);
  }

  function isFullText(path){return Boolean(searchEntryByPath.get(path)?.text);}
  function inferOwner(path){if(path.includes('/demoa/'))return'demoa';if(path.includes('/demob/'))return'demob';if(path.includes('/casa/'))return'casa';const r=recordSourceMap.get(path);return r?.owner||'shared';}
  function pseudoDoc(path,title){const real=docByPath.get(path);if(real)return real;const r=recordSourceMap.get(path);const ext=extOf(path);return{id:`virtual-${norm(path).replace(/[^a-z0-9]+/g,'-')}`,owner:r?.owner||inferOwner(path),title:title||r?.title||basename(path).replace(/[_-]+/g,' '),category:r?.category||((path.startsWith('dossiers/'))?'Dossiê':'Arquivo vinculado'),format:ext==='md'?'Markdown':ext==='pdf'?'PDF':['jpg','jpeg','png','webp','gif','svg'].includes(ext)?'Imagem':ext==='docx'?'Word':ext.toUpperCase()||'Arquivo',path,size:null};}
  function docMeta(path,title){return pseudoDoc(path,title);}

  function buttonView(path,title,label='Visualizar'){return`<button class="button small" type="button" data-view="${esc(path)}" data-title="${esc(title)}">${icons.eye}${esc(label)}</button>`;}
  function favoriteButton(path){const active=favorites.has(path);return`<button class="doc-favorite ${active?'active':''}" type="button" data-favorite="${esc(path)}" aria-label="${active?'Remover dos favoritos':'Adicionar aos favoritos'}" title="${active?'Remover dos favoritos':'Favoritar'}">${icons.star}</button>`;}
  function highlightText(s,q){let out=esc(s);const tokens=String(q).trim().split(/\s+/).filter(t=>t.length>1).sort((a,b)=>b.length-a.length);for(const t of tokens){const safe=t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');try{out=out.replace(new RegExp(`(${safe})`,'ig'),'<mark>$1</mark>');}catch{}}return out;}
  function snippetFor(path,q){const e=searchEntryByPath.get(path);if(!e?.text)return'';const raw=e.text.replace(/\s+/g,' ').trim();const n=searchNormByPath.get(path)||norm(raw);const tokens=norm(q).split(/\s+/).filter(Boolean);let idx=tokens.map(t=>n.indexOf(t)).filter(i=>i>=0).sort((a,b)=>a-b)[0]??0;const start=Math.max(0,idx-90),end=Math.min(raw.length,idx+210);const s=(start?'…':'')+raw.slice(start,end)+(end<raw.length?'…':'');return highlightText(s,q);}
  function docCard(d,opts={}){
    const fmt=norm(d.format).replace(/\s+/g,'-'),ext=extOf(d.path).toUpperCase();
    const snippet=opts.snippet||'';
    return`<article class="doc-card ${snippet?'has-snippet':''}">${favoriteButton(d.path)}
      <div class="doc-icon ${fmt}">${esc(ext||d.format)}</div>
      <div class="doc-info"><h3 title="${esc(d.title)}">${esc(d.title)}</h3><p>${esc(ownerLabel[d.owner]||d.owner)} · ${esc(d.category)}${d.size?` · ${sizeFmt(d.size)}`:''}</p>
        <div class="doc-badges">${isFullText(d.path)?'<span class="tiny-badge fulltext">texto pesquisável</span>':''}${opts.recentTime?`<span class="tiny-badge">aberto ${esc(fmtDateTime(opts.recentTime))}</span>`:''}</div>
        <div class="doc-path" title="${esc(d.path)}">${esc(d.path)}</div>${snippet?`<div class="doc-snippet privacy-sensitive">${snippet}</div>`:''}
        <div class="doc-card-actions">${buttonView(d.path,d.title,'Ver')}<a class="button small ghost" href="${esc(d.path)}" target="_blank" rel="noopener">${icons.external}Abrir</a></div>
      </div></article>`;
  }
  function emptyState(title,copy=''){return`<div class="empty"><span class="empty-icon">${icons.check}</span><strong>${esc(title)}</strong>${copy?`<p>${esc(copy)}</p>`:''}</div>`;}

  function recordCard(r){
    const v=validity(r),files=(r.sources||[]).map((p,i)=>buttonView(p,`${r.title}${r.sources.length>1?` — ${i+1}/${r.sources.length}`:''}`,r.sources.length>1?`Ver ${i+1}`:'Visualizar')).join('');
    const actionNote=r.action===false&&!r.current?'<span class="meta-pill">Histórico · sem ação</span>':r.action==='conditional'?'<span class="meta-pill">Renovar se exigido</span>':!r.current?'<span class="meta-pill">Histórico</span>':'';
    let count='';if(v.days!==null)count=v.days<0?`<div class="record-countdown"><strong>${Math.abs(v.days)}</strong><small>dias vencido</small></div>`:`<div class="record-countdown"><strong>${v.days}</strong><small>${v.days===1?'dia restante':'dias restantes'}</small></div>`;
    return`<article class="record-card" data-status="${v.key}"><div class="record-header"><div class="record-meta">${statusHTML(r)}${actionNote}</div>${count}</div><h3>${esc(r.title)}</h3><div class="record-meta"><span class="meta-pill">${esc(r.type)}</span>${r.number?`<span class="meta-pill privacy-sensitive">${esc(r.number)}</span>`:''}${r.expires?`<span class="meta-pill">Val. ${fmtDate(r.expires)}</span>`:''}</div><p class="record-note">${esc(r.notes||'')}</p>${files?`<div class="record-actions">${files}</div>`:''}</article>`;
  }
  function taskCard(t){
    const tone=taskTone(t),done=isTaskDone(t.id);
    return`<article class="task-card ${done?'completed':''}" data-severity="${esc(t.severity)}"><span class="task-dot">${done?icons.check:tone==='urgent'?icons.alert:tone==='attention'?icons.clock:icons.list}</span><div><div class="task-card-top"><span class="status ${done?'comfortable':tone==='urgent'?'urgent':'pending'}">${done?'Concluída':esc(t.status)}</span><span class="owner-pill">${esc(ownerLabel[t.owner]||t.owner)}</span></div><h3>${esc(t.title)}</h3><p>${esc(t.notes)}</p></div><button class="task-toggle" type="button" data-task-toggle="${esc(t.id)}">${done?'Reabrir':'Concluir'}</button></article>`;
  }
  function factCard(f){return`<div class="fact-card ${f[2]?'sensitive':''}"><label>${esc(f[0])}</label><div class="fact-value">${esc(f[1])}</div><button class="copy-btn" type="button" data-copy="${esc(f[1])}" aria-label="Copiar ${esc(f[0])}">${icons.copy}</button></div>`;}

  function actionItem(a){
    const tone=a.tone,badge=tone==='urgent'?icons.alert:tone==='attention'?icons.clock:icons.list;
    if(a.kind==='record'){
      const r=a.record,v=r._v,linked=a.task,file=(r.sources||[])[0],title=linked?.title||r.title,note=linked?`${v.detail}. ${linked.notes}`:(r.notes||''),linkedStatus=linked?`<span class="status ${taskTone(linked)==='urgent'?'urgent':'pending'}">${esc(linked.status)}</span>`:'';
      return`<article class="action-item" data-tone="${tone}"><span class="action-badge">${badge}</span><div class="action-main"><div class="action-topline"><span class="owner-pill">${esc(ownerLabel[r.owner]||r.owner)}</span>${linkedStatus}<span class="status ${v.key}">${esc(v.detail)}</span></div><h3>${esc(title)}</h3><p>${esc(note)}</p></div><div class="action-side"><strong>${fmtDate(r.expires)}</strong>${file?buttonView(file,r.title,'Ver'):''}</div></article>`;
    }
    const t=a.task;return`<article class="action-item" data-tone="${tone}"><span class="action-badge">${badge}</span><div class="action-main"><div class="action-topline"><span class="owner-pill">${esc(ownerLabel[t.owner]||t.owner)}</span><span class="status ${tone==='urgent'?'urgent':'pending'}">${esc(t.status)}</span></div><h3>${esc(t.title)}</h3><p>${esc(t.notes)}</p></div><div class="action-side"><button class="button small ghost" type="button" data-route="${ownerRoute(t.owner)}">Abrir ${icons.arrow}</button><button class="task-toggle" type="button" data-task-toggle="${esc(t.id)}">Concluir</button></div></article>`;
  }
  function timelineRow(r){const v=r._v||validity(r),days=v.days,label=days===null?'—':days<0?Math.abs(days):days,unit=days===null?'':days<0?'venc.':'dias';return`<div class="timeline-row ${v.key}"><div class="timeline-days"><strong>${label}</strong><small>${unit}</small></div><div class="timeline-copy"><h3>${esc(r.title)}</h3><p>${esc(ownerLabel[r.owner]||r.owner)} · ${esc(r.type)}</p></div><div class="timeline-date">${fmtDate(r.expires)}</div></div>`;}
  function spaceCard(owner){const p=D.profiles[owner],docs=D.documents.filter(d=>d.owner===owner).length,tasks=D.tasks.filter(t=>t.owner===owner&&!isTaskDone(t.id)).length,next=currentValidityList(owner).filter(r=>r._v.days>=0)[0];return`<article class="space-card" role="button" tabindex="0" data-route="${owner}" aria-label="Abrir espaço ${esc(p.short)}"><div class="space-card-top"><span class="space-avatar">${esc(p.avatar)}</span><span class="space-arrow">${icons.arrow}</span></div><h3>${esc(p.name)}</h3><p>${esc(p.subtitle)}</p><div class="space-stats"><span class="space-stat"><strong>${docs}</strong><small>arquivos</small></span><span class="space-stat"><strong>${tasks}</strong><small>pendências</small></span><span class="space-stat"><strong>${next?`${Math.max(0,next._v.days)}d`:'—'}</strong><small>próx. validade</small></span></div></article>`;}
  function recentListHTML(limit=5){const items=localState.recents.slice(0,limit);if(!items.length)return emptyState('Nenhum documento aberto ainda','O histórico local aparece aqui conforme você usa o Vault.');return`<div class="recent-list">${items.map(r=>{const d=pseudoDoc(r.path,r.title),ext=extOf(r.path).toUpperCase()||'DOC';return`<div class="recent-item"><span class="recent-type">${esc(ext)}</span><div><h3>${esc(d.title)}</h3><p>${esc(ownerLabel[d.owner]||d.owner)} · ${esc(fmtDateTime(r.ts))}</p></div>${buttonView(d.path,d.title,'Reabrir')}</div>`;}).join('')}</div>`;}

  function dashboard(){
    const attention=actionRecordList(),actions=allActions(),priorityActions=actions.filter(a=>a.tone!=='normal'),currentDates=currentValidityList(),next=currentDates.find(r=>r._v.days>=0);
    const near=D.records.filter(r=>validity(r).key==='near').length,expired=D.records.filter(r=>validity(r).key==='expired').length,comfortable=D.records.filter(r=>validity(r).key==='comfortable').length,noexp=D.records.filter(r=>validity(r).key==='none').length;
    const openTasks=D.tasks.filter(t=>!isTaskDone(t.id)).length,coverage=Math.round(((D.searchStats?.fullTextDocuments||0)/(D.documents.length||1))*100);
    const headline=attention.length?`${plural(attention.length,'validade')} <em>no radar.</em>`:'Sem alertas de <em>validade.</em>';
    const heroCopy=attention.length?`${attention.map(r=>`${r.title} ${r._v.detail}`).join(' · ')}. A V3 cruza validade, pendências e atividade local sem depender da internet.`:'Nenhum documento atual exige atenção por validade neste momento. Use as pendências e favoritos como fila de ação.';
    main.innerHTML=`<div class="page-shell">
      <section class="dashboard-hero"><div><div class="hero-kicker"><span class="live-dot"></span> Vault V3 · exemplos fictícios · ${esc(location.hostname||'arquivo local')}</div><h1>${headline}</h1><p class="hero-copy">${esc(heroCopy)}</p><div class="hero-actions"><button class="button primary" type="button" data-scroll="action-center">${icons.alert}Ver ações</button><button class="button" type="button" data-scroll="validity-panel">${icons.clock}Ver validades</button><button class="button ghost" type="button" data-route="documents">${icons.search}Explorar arquivo</button></div></div><div class="hero-glance"><div class="glance-card"><span class="glance-icon">${icons.alert}</span><span class="glance-copy"><span>Ações prioritárias</span><strong>Urgentes ou em atenção</strong></span><span class="glance-value urgent">${priorityActions.length}</span></div><div class="glance-card"><span class="glance-icon">${icons.clock}</span><span class="glance-copy"><span>Próxima validade atual</span><strong>${next?esc(next.title):'Nenhuma próxima'}</strong></span><span class="glance-value near">${next?Math.max(0,next._v.days):'—'}</span></div></div></section>

      <section class="insight-strip" aria-label="Resumo operacional"><div class="insight-card"><span>Busca interna</span><strong>${D.searchStats?.fullTextDocuments||0}/${D.documents.length}</strong><small>${coverage}% com texto pesquisável</small><div class="health-meter"><span style="width:${coverage}%"></span></div></div><div class="insight-card"><span>Favoritos</span><strong>${favorites.size}</strong><small>atalhos deste navegador</small></div><div class="insight-card"><span>Recentes</span><strong>${localState.recents.length}</strong><small>histórico local de abertura</small></div><div class="insight-card"><span>Pendências abertas</span><strong>${openTasks}</strong><small>${D.tasks.length-openTasks} concluída${D.tasks.length-openTasks===1?'':'s'} localmente</small></div></section>

      <section class="metric-grid" aria-label="Resumo de validades"><div class="metric-card"><div class="metric-top"><span>Perto de vencer</span><span class="metric-icon">${icons.clock}</span></div><strong>${near}</strong><small>até ${threshold} dias · inclui acervo histórico</small></div><div class="metric-card"><div class="metric-top"><span>Vencidos no acervo</span><span class="metric-icon">${icons.alert}</span></div><strong>${expired}</strong><small>históricos podem não exigir ação</small></div><div class="metric-card"><div class="metric-top"><span>Validade confortável</span><span class="metric-icon">${icons.check}</span></div><strong>${comfortable}</strong><small>mais de ${threshold} dias restantes</small></div><div class="metric-card"><div class="metric-top"><span>Sem vencimento</span><span class="metric-icon">${icons.archive}</span></div><strong>${noexp}</strong><small>diplomas, contratos e cadastros</small></div></section>

      <div class="content-grid"><div class="stack"><section class="panel" id="action-center"><div class="panel-header"><div class="panel-title-wrap"><span class="panel-title-icon">${icons.alert}</span><div><h2>Centro de ações</h2><p>Validades acionáveis + pendências abertas, sem duplicar alerta à toa.</p></div></div><span class="owner-pill">${actions.length} itens</span></div><div class="panel-body"><div class="action-list">${actions.length?actions.slice(0,10).map(actionItem).join(''):emptyState('Nada pedindo ação','O arquivo está tranquilo por aqui.')}</div></div></section><section class="panel"><div class="panel-header"><div class="panel-title-wrap"><span class="panel-title-icon">${icons.folder}</span><div><h2>Espaços do Vault</h2><p>Entre direto no contexto certo sem caçar pasta no braço.</p></div></div></div><div class="panel-body"><div class="space-grid">${['demoa','demob','casa'].map(spaceCard).join('')}</div></div></section></div>
      <div class="stack"><section class="panel" id="validity-panel"><div class="panel-header"><div class="panel-title-wrap"><span class="panel-title-icon">${icons.calendar}</span><div><h2>Linha de validade</h2><p>Somente documentos atuais com vencimento.</p></div></div></div><div class="panel-body"><div class="validity-timeline">${currentDates.map(timelineRow).join('')||emptyState('Sem datas cadastradas')}</div></div></section>
      <section class="panel"><div class="panel-header"><div class="panel-title-wrap"><span class="panel-title-icon">${icons.recent}</span><div><h2>Últimos abertos</h2><p>Histórico deste navegador — não sai da sua rede.</p></div></div><button class="button small ghost" type="button" data-route="recent">Ver todos</button></div><div class="panel-body">${recentListHTML(4)}</div></section>
      <section class="panel"><div class="panel-header"><div class="panel-title-wrap"><span class="panel-title-icon">${icons.shield}</span><div><h2>Integridade & privacidade</h2><p>Resumo do pacote V3.</p></div></div></div><div class="panel-body"><div class="quick-grid"><button class="quick-card" type="button" data-route="favorites"><strong>${favorites.size} favoritos</strong><span>Acesso rápido persistente</span></button><button class="quick-card" type="button" data-route="documents"><strong>${D.documents.length} documentos</strong><span>Todos locais neste pacote</span></button><button class="quick-card" type="button" data-open-tools><strong>Backup do estado</strong><span>Exportar notas e preferências</span></button><button class="quick-card" type="button" data-open-tools><strong>Sem CDN/API</strong><span>CSP bloqueia chamadas externas</span></button></div></div></section></div></div></div>`;
    bindDynamic();
  }

  function entity(owner,tab='overview'){
    const p=D.profiles[owner];if(!p)return dashboard();
    const docsCount=D.documents.filter(d=>d.owner===owner).length,recs=D.records.filter(r=>r.owner===owner).length,tasksOpen=D.tasks.filter(t=>t.owner===owner&&!isTaskDone(t.id)).length,next=currentValidityList(owner).find(r=>r._v.days>=0);
    const tabs=[['overview','Visão geral'],['validity','Validades'],['documents','Documentos'],['dossier','Dossiê completo']];let body='';
    if(tab==='overview'){
      const rs=allRecordSorted(owner).slice(0,8),ts=D.tasks.filter(t=>t.owner===owner).sort((a,b)=>Number(isTaskDone(a.id))-Number(isTaskDone(b.id)));
      body=`<div class="section-title"><div><h2>Dados principais</h2><p>Informação estruturada pronta para consultar e copiar.</p></div></div><div class="facts-grid">${p.facts.map(factCard).join('')}</div><div class="section-title"><div><h2>Documentos prioritários</h2><p>Ordenados por validade e importância.</p></div></div><div class="records-grid">${rs.map(recordCard).join('')||emptyState('Sem registros prioritários')}</div><div class="section-title"><div><h2>Pendências</h2><p>Você pode marcar itens como concluídos localmente.</p></div><span class="owner-pill">${tasksOpen} abertas</span></div><div class="task-list">${ts.map(taskCard).join('')||emptyState('Nenhuma pendência cadastrada')}</div>`;
    }else if(tab==='validity'){
      const list=allRecordSorted(owner).filter(r=>r.expires);body=`<div class="section-title"><div><h2>Validade dos documentos</h2><p>O status é recalculado automaticamente usando a data local do computador.</p></div><span class="owner-pill">${list.length} com validade</span></div><div class="records-grid">${list.map(recordCard).join('')||emptyState('Nenhuma validade cadastrada')}</div>`;
    }else if(tab==='documents'){body=documentsView(owner,true);}else if(tab==='dossier'){body=`<div class="dossier-wrap"><div class="dossier-content">${D.dossiers[owner]||'<p>Dossiê indisponível.</p>'}</div></div>`;}else{return entity(owner,'overview');}
    main.innerHTML=`<div class="page-shell"><section class="profile-hero"><div class="profile-avatar">${esc(p.avatar)}</div><div class="profile-copy"><p class="eyebrow">Espaço do Vault</p><h1>${esc(p.name)}</h1><p>${esc(p.subtitle)}</p></div><div class="profile-mini-stats"><div class="mini-stat"><strong>${docsCount}</strong><small>arquivos</small></div><div class="mini-stat"><strong>${recs}</strong><small>registros</small></div><div class="mini-stat"><strong>${tasksOpen}</strong><small>pendências</small></div><div class="mini-stat"><strong>${next?Math.max(0,next._v.days)+'d':'—'}</strong><small>próx. validade</small></div></div></section><div class="entity-tabs">${tabs.map(([k,l])=>`<button class="tab-button ${k===tab?'active':''}" type="button" data-entity-tab="${owner}/${k}">${l}</button>`).join('')}</div>${body}</div>`;
    bindDynamic();
  }

  function recentTimestamp(path){return localState.recents.find(r=>r.path===path)?.ts||0;}
  function filteredDocs(lockedOwner){
    let docs=D.documents.slice(),owner=lockedOwner||docState.owner;if(owner&&owner!=='all')docs=docs.filter(d=>d.owner===owner);if(docState.category!=='all')docs=docs.filter(d=>d.category===docState.category);if(docState.format!=='all')docs=docs.filter(d=>d.format===docState.format);if(docState.favorite)docs=docs.filter(d=>favorites.has(d.path));
    const cmp={name:(a,b)=>a.title.localeCompare(b.title,'pt-BR',{sensitivity:'base'}),size:(a,b)=>(b.size||0)-(a.size||0),owner:(a,b)=>(ownerLabel[a.owner]||a.owner).localeCompare(ownerLabel[b.owner]||b.owner,'pt-BR')||a.title.localeCompare(b.title,'pt-BR'),recent:(a,b)=>recentTimestamp(b.path)-recentTimestamp(a.path)}[docState.sort]||((a,b)=>a.title.localeCompare(b.title,'pt-BR'));
    return docs.sort(cmp);
  }
  function documentsView(lockedOwner=null,standalone=false){
    if(lockedOwner&&!standalone)docState.owner=lockedOwner;const base=D.documents.filter(d=>!lockedOwner||d.owner===lockedOwner),categories=[...new Set(base.map(d=>d.category))].sort((a,b)=>a.localeCompare(b,'pt-BR'));if(docState.category!=='all'&&!categories.includes(docState.category))docState.category='all';const docs=filteredDocs(lockedOwner),formats=[...new Set(base.map(d=>d.format))].sort();
    const ownerControls=lockedOwner?'':`<div class="seg-group" aria-label="Filtrar por espaço">${[['all','Todos'],['demoa','Demoa'],['demob','Demob'],['casa','Casa']].map(([v,l])=>`<button type="button" class="seg-button ${docState.owner===v?'active':''}" data-doc-owner="${v}">${l}</button>`).join('')}</div>`;
    const head=standalone?'':`<div class="document-header"><div class="page-head" style="margin:0"><div><p class="eyebrow">Biblioteca local</p><h1>Documentos</h1><p>${D.documents.length} arquivos indexados · ${D.searchStats?.fullTextDocuments||0} com busca interna de conteúdo.</p></div></div><div class="head-actions"><button class="button" type="button" data-route="dashboard">${icons.arrow}Painel</button></div></div>`;
    const html=`${head}<div class="library-toolbar">${ownerControls}<div class="seg-group" aria-label="Filtrar por formato"><button type="button" class="seg-button ${docState.format==='all'?'active':''}" data-doc-format="all">Todos</button>${formats.map(f=>`<button type="button" class="seg-button ${docState.format===f?'active':''}" data-doc-format="${esc(f)}">${esc(f)}</button>`).join('')}</div><button type="button" class="seg-button ${docState.favorite?'active':''}" data-doc-favorite-filter="1">${icons.star} Favoritos</button><div class="toolbar-spacer"></div><div class="select-wrap"><select id="docSort" aria-label="Ordenar documentos"><option value="name" ${docState.sort==='name'?'selected':''}>Nome A–Z</option><option value="recent" ${docState.sort==='recent'?'selected':''}>Abertos recentemente</option><option value="size" ${docState.sort==='size'?'selected':''}>Maior arquivo</option><option value="owner" ${docState.sort==='owner'?'selected':''}>Por espaço</option></select></div><span class="library-count">${plural(docs.length,'arquivo')}</span></div><div class="category-strip"><button type="button" class="chip-button ${docState.category==='all'?'active':''}" data-doc-category="all">Todas as categorias</button>${categories.map(c=>`<button type="button" class="chip-button ${docState.category===c?'active':''}" data-doc-category="${esc(c)}">${esc(c)}</button>`).join('')}</div><div class="docs-grid">${docs.map(d=>docCard(d,{recentTime:recentTimestamp(d.path)||null})).join('')||emptyState('Nenhum documento neste filtro','Tente outra categoria, formato ou espaço.')}</div>`;
    if(standalone)return html;main.innerHTML=`<div class="page-shell">${html}</div>`;bindDynamic();
  }

  function favoritesView(){
    const paths=[...favorites],docs=paths.map(p=>pseudoDoc(p)).sort((a,b)=>a.title.localeCompare(b.title,'pt-BR'));
    main.innerHTML=`<div class="page-shell"><div class="page-banner"><div><p class="eyebrow">Atalhos locais</p><h1>Favoritos</h1><p>Fixados apenas neste navegador. O arquivo original não é alterado.</p></div><span class="banner-icon">${icons.star}</span></div><div class="docs-grid">${docs.map(d=>docCard(d)).join('')||emptyState('Nenhum favorito ainda','Abra um documento e toque na estrela. Sem burocracia, sem cartório.')}</div></div>`;bindDynamic();
  }
  function recentView(){
    const docs=localState.recents.map(r=>({d:pseudoDoc(r.path,r.title),ts:r.ts}));
    main.innerHTML=`<div class="page-shell"><div class="page-banner"><div><p class="eyebrow">Histórico local</p><h1>Recentes</h1><p>Os últimos documentos abertos neste navegador. Nada é enviado para fora.</p></div><span class="banner-icon">${icons.recent}</span></div><div class="section-title"><div><h2>${plural(docs.length,'item')}</h2></div>${docs.length?'<button class="button small ghost" type="button" data-clear-recent>Limpar histórico</button>':''}</div><div class="docs-grid">${docs.map(x=>docCard(x.d,{recentTime:x.ts})).join('')||emptyState('Histórico vazio','Abra alguns documentos e eles aparecem aqui.')}</div></div>`;bindDynamic();
  }

  function searchView(q){
    const nq=norm(q),records=D.records.filter(r=>matches(`${r.title} ${r.type} ${r.number||''} ${r.category} ${r.notes||''} ${ownerLabel[r.owner]}`,nq)),tasks=D.tasks.filter(t=>matches(`${t.title} ${t.notes} ${t.status} ${ownerLabel[t.owner]}`,nq)),facts=[];
    Object.entries(D.profiles).forEach(([owner,p])=>p.facts.forEach(f=>{if(matches(`${f[0]} ${f[1]} ${p.name}`,nq))facts.push({owner,p,f});}));
    const docs=D.documents.map(d=>{const meta=matches(`${d.title} ${d.category} ${d.format} ${d.path} ${ownerLabel[d.owner]}`,nq),content=searchNormByPath.get(d.path);const hit=meta||(content&&norm(q).trim().split(/\s+/).filter(Boolean).every(t=>content.includes(t)));return hit?{d,meta,snippet:content?snippetFor(d.path,q):''}:null;}).filter(Boolean).sort((a,b)=>Number(b.meta)-Number(a.meta)||a.d.title.localeCompare(b.d.title,'pt-BR'));
    const dossierHits=(SI.entries||[]).filter(e=>e.kind==='markdown-dossier'&&e.text&&matches(e.text,nq)).map(e=>({d:pseudoDoc(e.path),snippet:snippetFor(e.path,q)}));
    const total=records.length+docs.length+tasks.length+facts.length+dossierHits.length;
    main.innerHTML=`<div class="page-shell"><div class="search-summary"><div><p class="eyebrow">Pesquisa global V3</p><h1>“${esc(q)}”</h1><p>${total?`${plural(total,'resultado')} entre metadados, perfis e conteúdo interno.`:'Nada encontrado no arquivo local.'}</p><div class="search-coverage"><i></i>${D.searchStats?.fullTextDocuments||0} documentos com texto interno indexado; imagens/scans continuam pesquisáveis por metadados.</div></div><div class="search-counts"><span class="search-count"><strong>${docs.length}</strong> arquivos</span><span class="search-count"><strong>${records.length}</strong> registros</span><span class="search-count"><strong>${facts.length}</strong> dados</span><span class="search-count"><strong>${tasks.length}</strong> pendências</span></div></div>
      ${facts.length?`<div class="section-title"><div><h2>Dados estruturados</h2><p>Resultados em perfis e identificadores.</p></div></div><div class="fact-result-list">${facts.slice(0,12).map(({owner,p,f})=>`<div class="fact-result ${f[2]?'sensitive':''}"><div><label>${esc(p.short)} · ${esc(f[0])}</label><strong class="fact-value">${esc(f[1])}</strong></div><button class="button small" type="button" data-route="${owner}">Abrir ${icons.arrow}</button></div>`).join('')}</div>`:''}
      ${records.length?`<div class="section-title"><div><h2>Registros</h2><p>Documentos com metadados e validade.</p></div></div><div class="records-grid">${records.map(recordCard).join('')}</div>`:''}
      ${tasks.length?`<div class="section-title"><div><h2>Pendências</h2></div></div><div class="task-list">${tasks.map(taskCard).join('')}</div>`:''}
      ${docs.length?`<div class="section-title"><div><h2>Arquivos</h2><p>Busca no nome e também dentro de PDFs/Word quando há texto extraível.</p></div></div><div class="docs-grid">${docs.slice(0,90).map(x=>docCard(x.d,{snippet:x.snippet})).join('')}</div>${docs.length>90?`<div class="empty" style="margin-top:10px"><strong>Mostrando os primeiros 90 arquivos</strong><p>Refine a busca para reduzir os resultados.</p></div>`:''}`:''}
      ${dossierHits.length?`<div class="section-title"><div><h2>Dossiês em Markdown</h2><p>Conteúdo textual dos dossiês locais.</p></div></div><div class="docs-grid">${dossierHits.map(x=>docCard(x.d,{snippet:x.snippet})).join('')}</div>`:''}
      ${!total?emptyState('Nenhum resultado','Tente nome, número de documento, categoria ou uma frase que esteja dentro de PDF/Word.'):''}</div>`;bindDynamic();
  }

  function route(){clearTimeout(searchTimer);
    const h=currentHash();document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',h===b.dataset.route||h.startsWith(`${b.dataset.route}/`)));
    if(search.value.trim().length>=2){searchView(search.value.trim());return;}
    if(h.startsWith('open/')){dashboard();const path=h.slice(5);setTimeout(()=>openViewer(path,pseudoDoc(path).title,{fromRoute:true}),0);return;}
    if(h==='dashboard')dashboard();else if(h==='documents')documentsView();else if(h==='favorites')favoritesView();else if(h==='recent')recentView();else{const[owner,tab='overview']=h.split('/');if(D.profiles[owner])entity(owner,tab);else{location.hash='dashboard';dashboard();}}
    main.focus({preventScroll:true});
  }

  function bindDynamic(){
    document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>openViewer(b.dataset.view,b.dataset.title));
    document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>copyText(b.dataset.copy));
    document.querySelectorAll('[data-favorite]').forEach(b=>b.onclick=e=>{e.stopPropagation();toggleFavorite(b.dataset.favorite);route();});
    document.querySelectorAll('[data-task-toggle]').forEach(b=>b.onclick=()=>toggleTask(b.dataset.taskToggle));
    document.querySelectorAll('[data-entity-tab]').forEach(b=>b.onclick=()=>{location.hash=b.dataset.entityTab;});
    document.querySelectorAll('[data-route]').forEach(b=>{b.onclick=()=>{clearTimeout(searchTimer);if(search.value){search.value='';clearSearch.hidden=true;}const same=currentHash()===b.dataset.route;location.hash=b.dataset.route;closeSidebar();if(same)route();};if(b.getAttribute('role')==='button')b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();b.click();}};});
    document.querySelectorAll('[data-scroll]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.scroll)?.scrollIntoView({behavior:'smooth',block:'start'}));
    document.querySelectorAll('[data-doc-owner]').forEach(b=>b.onclick=()=>{docState.owner=b.dataset.docOwner;docState.category='all';documentsView();});
    document.querySelectorAll('[data-doc-format]').forEach(b=>b.onclick=()=>{docState.format=b.dataset.docFormat;rerenderDocs();});
    document.querySelectorAll('[data-doc-category]').forEach(b=>b.onclick=()=>{docState.category=b.dataset.docCategory;rerenderDocs();});
    document.querySelectorAll('[data-doc-favorite-filter]').forEach(b=>b.onclick=()=>{docState.favorite=!docState.favorite;rerenderDocs();});
    document.querySelectorAll('[data-open-tools]').forEach(b=>b.onclick=openUtilityDialog);
    const sort=document.getElementById('docSort');if(sort)sort.onchange=()=>{docState.sort=sort.value;rerenderDocs();};
    const clear=document.querySelector('[data-clear-recent]');if(clear)clear.onclick=()=>{localState.recents=[];saveState();recentView();toast('Histórico local limpo');};
  }
  function rerenderDocs(){const[owner,tab]=currentHash().split('/');if(tab==='documents'&&D.profiles[owner])entity(owner,'documents');else documentsView();}

  function toggleTask(id){localState.completedTasks[id]=!isTaskDone(id);if(!localState.completedTasks[id])delete localState.completedTasks[id];saveState();route();toast(localState.completedTasks[id]?'Pendência marcada como concluída':'Pendência reaberta');}
  function toggleFavorite(path){if(favorites.has(path)){favorites.delete(path);toast('Removido dos favoritos');}else{favorites.add(path);toast('Adicionado aos favoritos');}saveState();if(currentViewer?.path===path)syncViewerFavorite();}
  function syncViewerFavorite(){const b=document.getElementById('viewerFavorite');if(!currentViewer)return;const on=favorites.has(currentViewer.path);b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',on?'Remover dos favoritos':'Favoritar documento');}
  function recordRecent(path,title){const now=Date.now();localState.recents=localState.recents.filter(r=>r.path!==path);localState.recents.unshift({path,title,ts:now});localState.recents=localState.recents.slice(0,30);saveState();}

  async function copyText(value){try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(value);}else throw new Error('fallback');}catch{const ta=document.createElement('textarea');ta.value=value;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}toast('Copiado para a área de transferência');}

  function viewerMetaHTML(d,path){const e=searchEntryByPath.get(path),rec=recordSourceMap.get(path);return`<div class="meta-line"><span>Espaço</span><strong>${esc(ownerLabel[d.owner]||d.owner)}</strong></div><div class="meta-line"><span>Categoria</span><strong>${esc(d.category||'—')}</strong></div><div class="meta-line"><span>Formato</span><strong>${esc(d.format||extOf(path).toUpperCase())}</strong></div>${d.size?`<div class="meta-line"><span>Tamanho</span><strong>${sizeFmt(d.size)}</strong></div>`:''}${e?.pages?`<div class="meta-line"><span>Páginas</span><strong>${e.pages}</strong></div>`:''}<div class="meta-line"><span>Busca interna</span><strong>${e?.text?'Disponível':'Metadados'}</strong></div>${rec?.expires?`<div class="meta-line"><span>Validade</span><strong>${fmtDate(rec.expires)}</strong></div>`:''}`;}

  let viewerFocus=null,previewRequest=0;
  async function openViewer(path,title,opts={}){
    const viewer=document.getElementById('viewer'),body=document.getElementById('viewerBody'),open=document.getElementById('viewerOpen'),download=document.getElementById('viewerDownload'),badge=document.getElementById('viewerBadge'),d=docMeta(path,title),ext=extOf(path);
    if(viewer.hidden)viewerFocus=document.activeElement;
    const request=++previewRequest;
    currentViewer={path,title:title||d.title,fromRoute:Boolean(opts.fromRoute)};
    document.getElementById('viewerTitle').textContent=currentViewer.title||'Documento';document.getElementById('viewerPath').textContent=path;document.getElementById('viewerEyebrow').textContent=location.protocol.startsWith('http')?'Visualização local · rede LAN':'Visualização local';document.getElementById('viewerEyebrow').classList.toggle('viewer-eyebrow-network',location.protocol.startsWith('http'));
    open.href=path;download.href=path;download.setAttribute('download',basename(path));badge.textContent=ext.toUpperCase()||'DOC';document.getElementById('viewerMeta').innerHTML=viewerMetaHTML(d,path);document.getElementById('viewerNote').value=localState.notes[path]||'';syncViewerFavorite();
    body.innerHTML='<div class="loading-preview"><span><i></i>Preparando visualização local…</span></div>';
    viewer.hidden=false;document.querySelector('.app-shell').inert=true;document.querySelector('button[data-close-viewer]').focus();document.body.style.overflow='hidden';recordRecent(path,currentViewer.title);
    try{await renderPreview(path,currentViewer.title,request);}catch(err){if(request!==previewRequest)return;console.error(err);body.innerHTML=unsupportedHTML(path,'Não foi possível montar a pré-visualização. O original continua disponível.');}
  }
  function unsupportedHTML(path,msg='Pré-visualização não disponível neste navegador'){return`<div class="unsupported"><span class="empty-icon">${icons.file}</span><h3>${esc(msg)}</h3><p>O arquivo original continua intacto dentro do pacote.</p><a class="button primary" href="${esc(path)}" target="_blank" rel="noopener">${icons.external}Abrir original</a></div>`;}
  async function renderPreview(path,title,request){
    const body=document.getElementById('viewerBody'),ext=extOf(path);body.innerHTML='';
    if(['jpg','jpeg','png','webp','gif','svg'].includes(ext)){const img=document.createElement('img');img.src=path;img.alt=title||'Documento';body.appendChild(img);return;}
    if(ext==='pdf'){const f=document.createElement('iframe');f.src=path;f.title=title||'PDF';body.appendChild(f);return;}
    if(ext==='docx'&&PV.docx?.[path]){const f=document.createElement('iframe');f.src=PV.docx[path];f.title=`Leitura de ${title||'documento Word'}`;body.appendChild(f);return;}
    if(ext==='html'||ext==='htm'){const f=document.createElement('iframe');f.src=path;f.title=title||'HTML';body.appendChild(f);return;}
    if(['md','markdown','txt','log','ini','yaml','yml','xml','json','csv'].includes(ext)){
      let raw=PV.text?.[path]?.content;if(raw==null){raw=await fetchLocalText(path);}if(request!==previewRequest)return;if(ext==='md'||ext==='markdown')renderMarkdownReader(raw);else if(ext==='csv')renderCsvReader(raw);else if(ext==='json')renderJsonReader(raw);else renderPlainReader(raw);return;
    }
    body.innerHTML=unsupportedHTML(path);
  }
  async function fetchLocalText(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.text();}

  function inlineMd(raw){
    const tokens=[];let s=String(raw);
    s=s.replace(/`([^`]+)`/g,(_,c)=>{const k=`@@V3T${tokens.length}@@`;tokens.push(`<code>${esc(c)}</code>`);return k;});
    s=s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,(_,label,url)=>{const safe=safeHref(url),k=`@@V3T${tokens.length}@@`;tokens.push(safe?`<a href="${esc(safe)}" target="_blank" rel="noopener">${esc(label)}</a>`:esc(label));return k;});
    s=esc(s);s=s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/__([^_]+)__/g,'<strong>$1</strong>').replace(/~~([^~]+)~~/g,'<del>$1</del>').replace(/(^|\s)\*([^*]+)\*(?=\s|$)/g,'$1<em>$2</em>').replace(/  $/,'<br>');
    tokens.forEach((v,i)=>{s=s.replace(`@@V3T${i}@@`,v);});return s;
  }
  function safeHref(url){const u=String(url).trim();if(/^(https?:|mailto:|tel:|#|\.\.?\/|\/)/i.test(u))return u;if(!/^[a-z][a-z0-9+.-]*:/i.test(u))return u;return'';}
  function slugify(s){return norm(s).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'secao';}
  function isBlockStart(line,next){return /^\s*$/.test(line)||/^#{1,6}\s+/.test(line)||/^```/.test(line)||/^>\s?/.test(line)||/^\s*([-*+] |\d+\. )/.test(line)||/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)||((line.includes('|'))&&next&&/^\s*\|?\s*:?-{3,}/.test(next));}
  function parseMarkdown(raw){
    const lines=String(raw).replace(/\r/g,'').split('\n'),out=[],toc=[],used=new Map();let i=0;
    while(i<lines.length){const line=lines[i],next=lines[i+1]||'';if(!line.trim()){i++;continue;}
      const fence=line.match(/^```\s*([^\s]*)/);if(fence){const lang=fence[1]||'',buf=[];i++;while(i<lines.length&&!/^```/.test(lines[i]))buf.push(lines[i++]);if(i<lines.length)i++;out.push(`<pre><code data-lang="${esc(lang)}">${esc(buf.join('\n'))}</code></pre>`);continue;}
      const h=line.match(/^(#{1,6})\s+(.+)$/);if(h){const level=h[1].length,text=h[2].replace(/\s+#+\s*$/,'').trim(),base=slugify(text),n=(used.get(base)||0)+1;used.set(base,n);const id=n===1?base:`${base}-${n}`;if(level<=3)toc.push({level,text,id});out.push(`<h${level} id="${esc(id)}">${inlineMd(text)}</h${level}>`);i++;continue;}
      if(/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)){out.push('<hr>');i++;continue;}
      if(line.includes('|')&&/^\s*\|?\s*:?-{3,}/.test(next)){const headers=line.replace(/^\||\|$/g,'').split('|').map(x=>x.trim()),rows=[];i+=2;while(i<lines.length&&lines[i].includes('|')&&lines[i].trim()){rows.push(lines[i].replace(/^\||\|$/g,'').split('|').map(x=>x.trim()));i++;}out.push(`<table><thead><tr>${headers.map(x=>`<th>${inlineMd(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${headers.map((_,j)=>`<td>${inlineMd(r[j]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table>`);continue;}
      if(/^>\s?/.test(line)){const buf=[];while(i<lines.length&&/^>\s?/.test(lines[i]))buf.push(lines[i++].replace(/^>\s?/,''));out.push(`<blockquote>${buf.map(x=>inlineMd(x)).join('<br>')}</blockquote>`);continue;}
      if(/^\s*[-*+]\s+/.test(line)){const items=[];while(i<lines.length&&/^\s*[-*+]\s+/.test(lines[i])){let t=lines[i++].replace(/^\s*[-*+]\s+/,'');const task=t.match(/^\[([ xX])\]\s+(.*)$/);items.push(task?`<li><input type="checkbox" disabled ${task[1].toLowerCase()==='x'?'checked':''}> ${inlineMd(task[2])}</li>`:`<li>${inlineMd(t)}</li>`);}out.push(`<ul>${items.join('')}</ul>`);continue;}
      if(/^\s*\d+\.\s+/.test(line)){const items=[];while(i<lines.length&&/^\s*\d+\.\s+/.test(lines[i]))items.push(`<li>${inlineMd(lines[i++].replace(/^\s*\d+\.\s+/,''))}</li>`);out.push(`<ol>${items.join('')}</ol>`);continue;}
      const buf=[line.trim()];i++;while(i<lines.length&&lines[i].trim()&&!isBlockStart(lines[i],lines[i+1]||'')){buf.push(lines[i].trim());i++;}out.push(`<p>${inlineMd(buf.join(' '))}</p>`);
    }
    return{html:out.join(''),toc};
  }
  function readerShell(rendered,raw,toc=[]){const tocHtml=toc.length?`<aside class="reader-toc"><h3>Neste documento</h3>${toc.map(x=>`<a href="#${esc(x.id)}" data-level="${x.level}">${esc(x.text)}</a>`).join('')}</aside>`:'';return`<div class="reader-shell"><div class="reader-grid">${tocHtml}<section class="reader-paper"><div class="reader-toolbar"><button type="button" class="active" data-reader-mode="rendered">Leitura</button><button type="button" data-reader-mode="raw">Texto bruto</button></div><div data-reader-rendered class="markdown-body">${rendered}</div><pre data-reader-raw class="raw-source" hidden>${esc(raw)}</pre></section></div></div>`;}
  function bindReaderModes(){document.querySelectorAll('[data-reader-mode]').forEach(b=>b.onclick=()=>{const mode=b.dataset.readerMode,root=b.closest('.reader-paper');root.querySelectorAll('[data-reader-mode]').forEach(x=>x.classList.toggle('active',x===b));root.querySelector('[data-reader-rendered]').hidden=mode!=='rendered';root.querySelector('[data-reader-raw]').hidden=mode!=='raw';});}
  function renderMarkdownReader(raw){const p=parseMarkdown(raw);document.getElementById('viewerBody').innerHTML=readerShell(p.html,raw,p.toc);bindReaderModes();}
  function parseCSV(text){const rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')q=false;else cell+=c;}else if(c==='"')q=true;else if(c===','){row.push(cell);cell='';}else if(c==='\n'){row.push(cell);rows.push(row);row=[];cell='';}else if(c!=='\r')cell+=c;}row.push(cell);if(row.some(x=>x!==''))rows.push(row);return rows;}
  function renderCsvReader(raw){const rows=parseCSV(raw),head=rows[0]||[],body=rows.slice(1);const table=`<div class="csv-wrap"><table class="csv-table"><thead><tr>${head.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${body.map(r=>`<tr>${head.map((_,i)=>`<td>${esc(r[i]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;document.getElementById('viewerBody').innerHTML=readerShell(table,raw,[]);bindReaderModes();}
  function renderJsonReader(raw){let pretty=raw;try{pretty=JSON.stringify(JSON.parse(raw),null,2);}catch{}document.getElementById('viewerBody').innerHTML=readerShell(`<div class="json-tree"><pre>${esc(pretty)}</pre></div>`,raw,[]);bindReaderModes();}
  function renderPlainReader(raw){document.getElementById('viewerBody').innerHTML=readerShell(`<pre class="raw-source" style="margin:0">${esc(raw)}</pre>`,raw,[]);bindReaderModes();}

  function closeViewer(){previewRequest++;document.querySelector('.app-shell').inert=false;const viewer=document.getElementById('viewer');viewer.hidden=true;document.body.style.overflow='';document.getElementById('viewerBody').innerHTML='';currentViewer=null;if(viewerFocus?.isConnected)viewerFocus.focus();if(currentHash().startsWith('open/'))location.hash='dashboard';}
  function navigateViewer(delta){if(!currentViewer)return;const idx=D.documents.findIndex(d=>d.path===currentViewer.path);if(idx<0)return;const next=D.documents[(idx+delta+D.documents.length)%D.documents.length];openViewer(next.path,next.title);}

  function toast(text){const t=document.getElementById('toast');clearTimeout(toastTimer);t.textContent=text;t.classList.add('show');toastTimer=setTimeout(()=>t.classList.remove('show'),1900);}
  function closeSidebar(){sidebar.classList.remove('open');sidebarBackdrop.hidden=true;}
  function openSidebar(){sidebar.classList.add('open');sidebarBackdrop.hidden=false;}

  function setTheme(mode){localState.theme=mode;const r=document.documentElement;if(mode==='auto')delete r.dataset.theme;else r.dataset.theme=mode;document.getElementById('themeLabel').textContent={auto:'Automático',light:'Claro',dark:'Escuro'}[mode]||'Automático';saveState();}
  function setPrivacy(on){localState.privacy=Boolean(on);document.body.classList.toggle('privacy-on',localState.privacy);document.getElementById('privacyToggle').setAttribute('aria-pressed',String(localState.privacy));document.getElementById('privacyLabel').textContent=localState.privacy?'Dados desfocados':'Dados visíveis';saveState();}
  function updateNavCounts(){document.getElementById('navDocumentCount').textContent=D.documents.length;['demoa','demob','casa'].forEach(o=>{const el=document.getElementById(`nav${o[0].toUpperCase()+o.slice(1)}Count`);if(el)el.textContent=D.documents.filter(d=>d.owner===o).length;});document.getElementById('navActionCount').textContent=allActions().filter(a=>a.tone!=='normal').length||'';document.getElementById('navFavoriteCount').textContent=favorites.size||'';document.getElementById('navRecentCount').textContent=localState.recents.length||'';}

  function openUtilityDialog(){updateUtilityDialog();if(typeof utilityDialog.showModal==='function'&&!utilityDialog.open)utilityDialog.showModal();}
  function updateUtilityDialog(){const notes=Object.keys(localState.notes).filter(k=>localState.notes[k]).length,done=Object.keys(localState.completedTasks).length;document.getElementById('localStateSummary').textContent=`${favorites.size} favoritos · ${localState.recents.length} recentes · ${notes} notas · ${done} pendências concluídas. Tudo fica neste navegador.`;const proto=location.protocol==='file:'?'Arquivo local':`${location.protocol}//${location.host}`;document.getElementById('runtimeInfo').innerHTML=`<div class="runtime-card ok"><span>Execução</span><strong>${esc(proto)}</strong></div><div class="runtime-card ok"><span>Dependências externas</span><strong>Nenhuma</strong></div><div class="runtime-card"><span>Busca interna</span><strong>${D.searchStats?.fullTextDocuments||0}/${D.documents.length} docs</strong></div>`;}
  function exportState(){const payload={app:'Faysk Docs Vault',version:3,exportedAt:new Date().toISOString(),state:{...localState,favorites:[...favorites]}};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`faysk-vault-v3-state-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Backup local exportado');}
  async function importStateFile(file){try{const data=JSON.parse(await file.text()),s=data.state||data;if(!s||typeof s!=='object')throw new Error('inválido');localState={...loadState(),...s};favorites=new Set(Array.isArray(s.favorites)?s.favorites:[]);saveState();setTheme(localState.theme||'auto');setPrivacy(Boolean(localState.privacy));utilityDialog.close();route();toast('Backup importado');}catch{toast('Não consegui importar esse backup');}}
  function resetState(){if(!confirm('Limpar favoritos, recentes, notas e estados de pendências deste navegador?'))return;localState={favorites:[],recents:[],completedTasks:{},notes:{},theme:'auto',privacy:false};favorites=new Set();safeStorageSet('vault-state-v3',JSON.stringify(localState));setTheme('auto');setPrivacy(false);utilityDialog.close();route();toast('Estado local limpo');}

  document.querySelectorAll('[data-close-viewer]').forEach(b=>b.onclick=closeViewer);
  document.querySelectorAll('.nav-item,.brand').forEach(b=>b.onclick=()=>{clearTimeout(searchTimer);if(search.value){search.value='';clearSearch.hidden=true;}const same=currentHash()===b.dataset.route;location.hash=b.dataset.route;closeSidebar();if(same)route();});
  document.getElementById('menuToggle').onclick=()=>sidebar.classList.contains('open')?closeSidebar():openSidebar();sidebarBackdrop.onclick=closeSidebar;
  document.getElementById('privacyToggle').onclick=()=>{setPrivacy(!localState.privacy);toast(localState.privacy?'Modo privacidade ativado':'Modo privacidade desativado');};
  document.getElementById('themeToggle').onclick=()=>{const modes=['auto','light','dark'];setTheme(modes[(modes.indexOf(localState.theme)+1)%modes.length]);};
  document.getElementById('validityFocus').onclick=e=>{validityOnly=!validityOnly;e.currentTarget.classList.toggle('active',validityOnly);e.currentTarget.setAttribute('aria-pressed',String(validityOnly));if(currentHash()==='documents'){location.hash='dashboard';setTimeout(()=>document.getElementById('validity-panel')?.scrollIntoView({behavior:'smooth'}),40);}else route();toast(validityOnly?'Foco em registros com validade':'Filtro de validade removido');};
  document.getElementById('utilityOpen').onclick=openUtilityDialog;
  document.getElementById('viewerFavorite').onclick=()=>{if(currentViewer)toggleFavorite(currentViewer.path);};
  document.getElementById('copyPathButton').onclick=()=>{if(currentViewer)copyText(currentViewer.path);};
  document.getElementById('copyLinkButton').onclick=()=>{if(!currentViewer)return;const base=location.href.split('#')[0],link=`${base}#open/${encodeURIComponent(currentViewer.path)}`;copyText(link);};
  document.getElementById('viewerNote').addEventListener('input',e=>{if(!currentViewer)return;clearTimeout(noteTimer);const path=currentViewer.path,value=e.target.value;noteTimer=setTimeout(()=>{if(value.trim())localState.notes[path]=value;else delete localState.notes[path];saveState();document.getElementById('noteSaved').textContent='Salva agora';setTimeout(()=>document.getElementById('noteSaved').textContent='Salva automaticamente',900);},250);});
  document.getElementById('exportState').onclick=exportState;document.getElementById('importState').onchange=e=>{const f=e.target.files?.[0];if(f)importStateFile(f);e.target.value='';};document.getElementById('resetState').onclick=resetState;

  search.addEventListener('input',()=>{const q=search.value.trim();clearSearch.hidden=!q;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{if(q.length>=2)searchView(q);else route();},70);});
  clearSearch.onclick=()=>{search.value='';clearSearch.hidden=true;search.focus();route();};
  document.addEventListener('keydown',e=>{
    const typing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);
    if(currentViewer&&e.key==='Tab'){const list=[...document.querySelectorAll('#viewer button:not([disabled]),#viewer a[href],#viewer textarea,#viewer iframe')].filter(el=>el.getClientRects().length);const first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
    if(e.key==='/'&&!typing&&!currentViewer&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();search.focus();search.select();}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();search.focus();search.select();}
    if(e.key==='?'&&!typing&&!currentViewer){e.preventDefault();openUtilityDialog();}
    if(currentViewer&&!typing&&e.key.toLowerCase()==='f'){e.preventDefault();toggleFavorite(currentViewer.path);}
    if(currentViewer&&!typing&&e.key==='ArrowLeft'){e.preventDefault();navigateViewer(-1);}
    if(currentViewer&&!typing&&e.key==='ArrowRight'){e.preventDefault();navigateViewer(1);}
    if(e.key==='Escape'){if(!document.getElementById('viewer').hidden)closeViewer();else if(sidebar.classList.contains('open'))closeSidebar();else if(search.value){search.value='';clearSearch.hidden=true;route();search.blur();}}
  });
  window.addEventListener('hashchange',()=>{if(!search.value.trim())route();});

  setTheme(localState.theme||'auto');setPrivacy(Boolean(localState.privacy));
  document.getElementById('todayPill').textContent=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date());
  document.getElementById('vaultOrigin').textContent=location.protocol==='file:'?'Arquivo local':location.host?`LAN · ${location.host}`:'Privado por padrão';
  let calendarDay=today0().getTime();
  function refreshCalendar(){if(document.hidden||currentViewer)return;const day=today0().getTime();if(day!==calendarDay){calendarDay=day;document.getElementById('todayPill').textContent=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date());route();}}
  document.addEventListener('visibilitychange',refreshCalendar);setInterval(refreshCalendar,60000);
  updateNavCounts();route();
})();

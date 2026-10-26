'use strict';
// Synthetic, public-only regression suite. No production documents, paths or derived indexes.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const src=fs.readFileSync('assets/js/app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const get=(from,to)=>{const a=src.indexOf(from),b=src.indexOf(to,a+from.length);assert(a>=0&&b>a,'Expected function anchor: '+from);return src.slice(a,b);};
assert(!html.includes('<script src="examples/search-index.example.js"></script>'),'Search index must not block boot');
assert(!html.includes('<script src="examples/previews.example.js"></script>'),'Preview bundle must not block boot');
assert(html.includes('data-search-index="examples/search-index.example.js"'));
assert(html.includes('id="searchLive"'));
assert(src.includes('const PREVIEW_CACHE_LIMIT=6'));
assert(src.includes('const PAGE_SIZE=40'));

const PAGE_SIZE=40;
const pageHTML=get('  function pageHTML(', '  function appendPage(');
const searchView=get('  async function searchView(q){','  function route(){');
function synthetic(size,term='alpha'){
  const docs=Array.from({length:size},(_,i)=>({path:'examples/synthetic/doc-'+i+'.md',title:'Item '+i,owner:'demoa',category:'Fixture',format:'MD',size:128}));
  const entries=docs.map(d=>({path:d.path,kind:'document',text:term+' '+('texto sintético para teste de desempenho '.repeat(7))}));
  return {docs,entries};
}
function searchContext(size,delay=()=>Promise.resolve()){
  const {docs,entries}=synthetic(size);
  const results=new Map(),updates=[],announcements=[];
  const D={documents:docs,records:[],tasks:[],profiles:{demoa:{facts:[]}},searchStats:{fullTextDocuments:size}};
  const c={
    D,SI:{entries},search:{value:'alpha',setAttribute(){}},main:{innerHTML:'',setAttribute(){}},
    searchSequence:0,searchStatus(q,phase){updates.push([q,phase]);},
    searchAnnouncement(message){announcements.push(message);},
    ensureSearchIndex:async()=>c.SI,pauseSearch:delay,
    searchEntryByPath:new Map(entries.map(e=>[e.path,e])),
    searchNormByPath:new Map(),resultPages:results,PAGE_SIZE,SEARCH_SLICE:60,SEARCH_TEXT_CACHE_LIMIT:256,
    norm:s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),
    ownerLabel:{demoa:'Pessoa A'},esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'),
    plural:(n,one)=>n+' '+one+'s',emptyState:()=>'<div class="empty"></div>',
    pageHTML:null,docCard:d=>'<article class="doc-card">'+d.title+'</article>',
    recordCard:()=>'',taskCard:()=>'',snippetFor:()=>'',pseudoDoc:path=>({path,title:path}),
    icons:{arrow:'→'},console,Promise,setTimeout
  };
  vm.createContext(c);
  vm.runInContext(get('  function normalizedFor(path,raw){','  let indexPromise=')+';'+pageHTML+';'+searchView,c);
  return{c,results,updates,announcements};
}
async function searchSuite(){
  for(const size of [127,1000,5000]){
    const {c,results,announcements}=searchContext(size);
    const before=process.memoryUsage().heapUsed,t0=performance.now();
    await vm.runInContext('searchView("alpha")',c);
    const elapsed=performance.now()-t0,heap=process.memoryUsage().heapUsed-before;
    assert.equal(results.get('search-documents').items.length,size);
    assert(c.searchNormByPath.size<=256,'Normalized full-text cache must remain bounded');
    assert.equal((c.main.innerHTML.match(/class="doc-card"/g)||[]).length,PAGE_SIZE,'DOM cards should be page-limited');
    assert(announcements.at(-1).includes(size+' resultados'));
    console.log('Search fixture',size,'JS elapsed',elapsed.toFixed(1)+'ms','heap delta',(heap/1048576).toFixed(2)+'MiB','visible cards',PAGE_SIZE);
  }
  const {c,announcements}=searchContext(1000,()=>new Promise(resolve=>setTimeout(resolve,1)));
  const old=vm.runInContext('searchView("alpha")',c);
  await new Promise(resolve=>setTimeout(resolve,3));
  c.search.value='beta';
  const latest=vm.runInContext('searchView("beta")',c);
  await Promise.all([old,latest]);
  assert(announcements.at(-1).includes('beta'),'Only final query announces');
  assert(!announcements.some(s=>s.includes('alpha')),'Old query must not complete');
  assert(c.main.innerHTML.includes('Nada encontrado no arquivo local.'),'Latest empty state');
  console.log('Out-of-order search cancellation passed');
}
async function previewSuite(){
  const viewerCode=get('  function previewLoading(body){','  async function openViewer(');
  const mediaCode=get('  function waitForMedia(node,src,signal,body){','  async function renderPreview(');
  const c={
    icons:{alert:'!'},esc:s=>String(s),location:{protocol:'http:'},
    AbortController,DOMException,Event,EventTarget,Promise,setTimeout,
    fetch:async()=>({status:404,ok:false}),console
  };
  vm.createContext(c);
  vm.runInContext(viewerCode+mediaCode,c);
  const body={attrs:{},innerHTML:'',setAttribute(k,v){this.attrs[k]=v;},appendChild(n){this.node=n;}};
  vm.runInContext('previewLoading',c)(body);
  assert.equal(body.attrs['aria-busy'],'true');
  assert(body.innerHTML.includes('Preparando'));
  await assert.rejects(()=>vm.runInContext('checkEmbeddable',c)('/missing.pdf',new AbortController().signal),/HTTP 404/);
  class FakeMedia extends EventTarget{
    set src(value){this.path=value;setTimeout(()=>this.dispatchEvent(new Event(value==='broken'?'error':'load')),35);}
  }
  const load=vm.runInContext('waitForMedia',c);
  const ctrl=new AbortController();
  const t0=performance.now();
  await load(new FakeMedia(),'slow',ctrl.signal,body);
  assert(performance.now()-t0>=30,'Preview must wait until media load, not merely insertion');
  const aborted=new AbortController();
  const wait=load(new FakeMedia(),'slow',aborted.signal,body);
  aborted.abort();
  await assert.rejects(wait,err=>err.name==='AbortError');
  await assert.rejects(load(new FakeMedia(),'broken',new AbortController().signal,body),/indisponível/);
  vm.runInContext('previewError',c)(body,'examples/missing.pdf','Falhou');
  assert.equal(body.attrs['aria-busy'],'false');assert(body.innerHTML.includes('data-retry-preview'));
  console.log('Preview busy / media wait / error / abort / retry passed');
}
(async()=>{await searchSuite();await previewSuite();console.log('Vault synthetic progressive tests passed');})().catch(err=>{console.error(err);process.exitCode=1;});

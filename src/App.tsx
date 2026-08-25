import {useCallback,useEffect,useMemo,useState} from 'react';
import type {Language,LocalizedString,NodeType,Outcome,Runbook,RunbookNode} from './types';
import rfid from './data/rfid.json';
import webApp from './data/web-app-start.json';
import {getStoredLanguage,getStoredTheme,loadLibrary,loadProgress,loadRecents,RecentItem,saveLanguage,saveLibrary,saveProgress,saveRecents,saveTheme} from './lib/storage';
import {collectLocalizedText,getNode,localized,localize,migrateRunbook,nodeSearchText,slugify,splitList,toLines} from './lib/runbook';
import {validateRunbook} from './lib/validation';

type Mode='library'|'run'|'edit';
type SearchResult={book:Runbook;node?:RunbookNode;score:number;snippet:string};
type DraftNodeField='symptoms'|'aliases';

const clone=<T,>(value:T):T=>structuredClone(value);
const nodeTypes:NodeType[]=['question','action','check','command','warning','solution','troubleshooting','visual-identification','note','multimedia'];
const defaultBooks=[rfid as Runbook,webApp as Runbook].map(migrateRunbook);

const ui={
 es:{
  library:'Biblioteca',run:'Ejecutar',edit:'Editar',onsite:'En el sitio',startOver:'Empezar de nuevo',back:'Atras',importRunbook:'Importar guia',createGuide:'+ Crear guia',createTroubleshooting:'Crear troubleshooting',search:'Buscar',settings:'Ajustes',home:'Inicio',add:'Anadir',
  runHelp:'Seguir la guia paso a paso.',onsiteHelp:'Modo rapido mientras estas fisicamente trabajando con el equipo.',editHelp:'Modificar este procedimiento.',
  problem:'Que problema tienes?',searchPlaceholder:'Buscar error, dispositivo o procedimiento...',resolver:'Resolver',procedures:'Procedimientos',recent:'Recientes',recentEmpty:'Todavia no hay actividad reciente.',fieldKnowledge:'CONOCIMIENTO TECNICO · OFFLINE',heroTitle:'Encuentra el siguiente paso correcto.',heroText:'Procedimientos interactivos para resolver incidencias de forma rapida y segura.',
  noResults:'No tenemos una solucion guardada para este error.',addSolution:'Anadir solucion',cancel:'Cancelar',filters:'Filtros',clear:'Limpiar',category:'Categoria',tags:'Etiquetas',copy:'Copiar',copied:'Copiado',expected:'Esperado',continue:'Continuar',solved:'Solucionado',markSolved:'Marcar como solucionado',
  duplicate:'Duplicar',exportJson:'Exportar JSON',toggleTheme:'Cambiar tema',language:'Idioma',spanish:'Espanol',english:'English',importTitle:'Importar un procedimiento JSON',drop:'Suelta un archivo .json aqui',choose:'o eligelo en tu dispositivo',validationFailed:'Validacion fallida',reviewWarnings:'Revisar avisos',preview:'Vista previa',importIntoLibrary:'Importar a biblioteca',replaceNotice:'La importacion reemplazara la guia local con este ID.',
  editorTitle:'EDITAR GUIA',title:'Titulo',description:'Descripcion',nodeId:'ID del nodo',type:'Tipo',body:'Descripcion',command:'Comando',expectedResult:'Resultado esperado',destructive:'Potencialmente destructivo',outcomes:'Resultados / ramas',defaultNext:'Siguiente paso por defecto',validate:'Validar guia',valid:'Estructura valida',issues:'Problemas encontrados',tree:'Arbol',node:'Nodo',addNode:'Anadir nodo',delete:'Eliminar',reset:'Restablecer',save:'Guardar',undo:'Deshacer',redo:'Rehacer',quickBuild:'Construccion rapida',addNext:'Anadir siguiente paso',addAlternative:'Anadir alternativa',addOutcome:'Anadir resultado',markAsSolution:'Marcar como solucion',addCommand:'Anadir comando',addObservedError:'Anadir error observado',
  newGuide:'Nueva guia',guideName:'Nombre',firstNode:'Primer nodo',languageSeed:'Idioma inicial',create:'Crear',solutionEditor:'Nueva solucion',errorProblem:'Error/problema',variants:'Variantes del error',possibleCause:'Posible causa',step:'Paso',optionalCommand:'Comando opcional',finalSolution:'Solucion final',saveInLibrary:'Guardar en biblioteca',warnings:'Avisos',errors:'Errores',missingNode:'Nodo no encontrado',none:'Ninguno',end:'Fin',mobileSearch:'Buscar',nodeOpen:'Abrir nodo',symptoms:'Sintomas',errorMessages:'Mensajes de error',aliases:'Alias',keywords:'Palabras clave',warning:'Advertencia',verifyBeforeRunning:'verifica antes de ejecutar',oneStepPerLine:'Un paso por linea'
 },
 en:{
  library:'Library',run:'Run',edit:'Edit',onsite:'On Site',startOver:'Start over',back:'Back',importRunbook:'Import runbook',createGuide:'+ Create guide',createTroubleshooting:'Create troubleshooting',search:'Search',settings:'Settings',home:'Home',add:'Add',
  runHelp:'Follow the guide step by step.',onsiteHelp:'Quick mode while you are physically working with the equipment.',editHelp:'Modify this procedure.',
  problem:'What problem do you have?',searchPlaceholder:'Search error, device or procedure...',resolver:'Resolve',procedures:'Procedures',recent:'Recents',recentEmpty:'No recent activity yet.',fieldKnowledge:'FIELD KNOWLEDGE · OFFLINE',heroTitle:'Find the next right step.',heroText:'Interactive technical procedures built for fast, safe troubleshooting.',
  noResults:'We do not have a saved solution for this error.',addSolution:'Add solution',cancel:'Cancel',filters:'Filters',clear:'Clear',category:'Category',tags:'Tags',copy:'Copy',copied:'Copied',expected:'Expected',continue:'Continue',solved:'Solved',markSolved:'Mark solved',
  duplicate:'Duplicate',exportJson:'Export JSON',toggleTheme:'Toggle theme',language:'Language',spanish:'Espanol',english:'English',importTitle:'Import a JSON procedure',drop:'Drop a .json file here',choose:'or choose from your device',validationFailed:'Validation failed',reviewWarnings:'Review warnings',preview:'Preview',importIntoLibrary:'Import into library',replaceNotice:'Importing will replace the local runbook with this ID.',
  editorTitle:'EDIT GUIDE',title:'Title',description:'Description',nodeId:'Node ID',type:'Type',body:'Description',command:'Command',expectedResult:'Expected result',destructive:'Potentially destructive',outcomes:'Outcomes / branches',defaultNext:'Default next step',validate:'Validate guide',valid:'Structure valid',issues:'Issues found',tree:'Tree',node:'Node',addNode:'Add node',delete:'Delete',reset:'Reset',save:'Save',undo:'Undo',redo:'Redo',quickBuild:'Quick build',addNext:'Add next step',addAlternative:'Add alternative',addOutcome:'Add outcome',markAsSolution:'Mark as solution',addCommand:'Add command',addObservedError:'Add observed error',
  newGuide:'New guide',guideName:'Name',firstNode:'First node',languageSeed:'Initial language',create:'Create',solutionEditor:'New solution',errorProblem:'Error/problem',variants:'Error variants',possibleCause:'Possible cause',step:'Step',optionalCommand:'Optional command',finalSolution:'Final solution',saveInLibrary:'Save in library',warnings:'Warnings',errors:'Errors',missingNode:'Missing node',none:'None',end:'End',mobileSearch:'Search',nodeOpen:'Open node',symptoms:'Symptoms',errorMessages:'Error messages',aliases:'Aliases',keywords:'Keywords',warning:'Warning',verifyBeforeRunning:'verify before running',oneStepPerLine:'One step per line'
 }
} satisfies Record<Language,Record<string,string>>;

function normalize(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function scoreText(query:string,text:string){
 const q=normalize(query); const hay=normalize(text); if(!q)return 0;
 let score=hay.includes(q)?80:0;
 const tokens=q.split(/\s+/).filter(Boolean);
 for(const token of tokens){if(hay.includes(token))score+=12;else if(hay.split(/\s+/).some(part=>part.startsWith(token)||token.startsWith(part)))score+=5}
 return score;
}
function bestSnippet(query:string,text:string){
 const q=normalize(query).split(/\s+/).find(Boolean); if(!q)return text.slice(0,140);
 const flat=text.replace(/\s+/g,' '); const index=normalize(flat).indexOf(q); const start=Math.max(0,index-45);
 return flat.slice(start,start+150);
}
function download(book:Runbook){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(book,null,2)],{type:'application/json'}));a.download=`${book.id}.json`;a.click();URL.revokeObjectURL(a.href)}

export default function App(){
 const [books,setBooks]=useState<Runbook[]>(()=>loadLibrary(defaultBooks));
 const [selected,setSelected]=useState<string>();
 const [targetNode,setTargetNode]=useState<string>();
 const [mode,setMode]=useState<Mode>('library');
 const [site,setSite]=useState(false);
 const [search,setSearch]=useState('');
 const [tagFilter,setTagFilter]=useState('');
 const [importing,setImporting]=useState(false);
 const [creating,setCreating]=useState(false);
 const [quickCreate,setQuickCreate]=useState<string>();
 const [lang,setLang]=useState<Language>(()=>getStoredLanguage());
 const [dark,setDark]=useState(()=>getStoredTheme()?getStoredTheme()==='dark':typeof matchMedia==='function'&&matchMedia('(prefers-color-scheme: dark)').matches);
 const [recents,setRecents]=useState<RecentItem[]>(()=>loadRecents());
 const t=ui[lang];

 useEffect(()=>saveLibrary(books),[books]);
 useEffect(()=>{saveLanguage(lang);document.documentElement.lang=lang},[lang]);
 useEffect(()=>saveTheme(dark),[dark]);
 useEffect(()=>saveRecents(recents),[recents]);

 const book=books.find(item=>item.id===selected);
 const addRecent=useCallback((item:Omit<RecentItem,'id'|'at'>)=>setRecents(items=>[{...item,id:`recent-${Date.now()}`,at:new Date().toISOString()},...items.filter(old=>old.bookId!==item.bookId||old.nodeId!==item.nodeId||old.query!==item.query)].slice(0,24)),[]);
 const update=(next:Runbook)=>setBooks(items=>items.map(item=>item.id===book?.id?next:item));
 const open=(nextBook:Runbook,nextMode:Mode,nodeId?:string)=>{setSelected(nextBook.id);setTargetNode(nodeId);setMode(nextMode);addRecent({bookId:nextBook.id,nodeId,type:nextMode==='run'?'procedure':'step',label:localize(nextBook.title,lang)});};
 const duplicate=(source:Runbook)=>{let id=`${source.id}-copy`,i=2;while(books.some(item=>item.id===id))id=`${source.id}-copy-${i++}`;const copy={...clone(source),id,title:{es:`${localize(source.title,'es')} (copia)`,en:`${localize(source.title,'en')} (Copy)`},metadata:{...source.metadata,updatedAt:new Date().toISOString()}};setBooks(items=>[...items,copy]);open(copy,'edit')};
 const runSearch=useMemo(()=>searchResults(books,search,tagFilter,lang),[books,search,tagFilter,lang]);
 const visibleBooks=useMemo(()=>books.filter(item=>!tagFilter||item.tags.some(tag=>normalize(tag)===normalize(tagFilter))),[books,tagFilter]);
 const allTags=useMemo(()=>Array.from(new Set(books.flatMap(item=>item.tags))).sort((a,b)=>a.localeCompare(b)),[books]);
 const noRelevant=search.trim()&&runSearch.length===0;
 const acceptBook=(next:Runbook)=>{setBooks(items=>[...items.filter(item=>item.id!==next.id),next]);setImporting(false);open(next,'edit')};
 const createBook=(next:Runbook)=>{setBooks(items=>[next,...items]);setCreating(false);open(next,'edit')};
 const saveQuick=(next:Runbook)=>{setBooks(items=>[next,...items]);setQuickCreate(undefined);setSearch('');open(next,'edit')};

 return <div className={dark?'app dark':'app'}>
  <header>
   <button className="brand" onClick={()=>setMode('library')}><span>TR</span><b>Tech Runbook</b></button>
   <div className="header-actions">
    <label className="language-select" title={t.language}><span>{t.language}</span><select value={lang} onChange={event=>setLang(event.target.value as Language)}><option value="es">{t.spanish}</option><option value="en">{t.english}</option></select></label>
    <button className="icon-button" onClick={()=>setDark(value=>!value)} aria-label={t.toggleTheme}>{dark?'Light':'Dark'}</button>
    {mode!=='library'&&<button onClick={()=>setMode('library')}>{t.library}</button>}
   </div>
  </header>

  {mode==='library'&&<main className="home">
   <section className="hero">
    <p className="eyebrow">{t.fieldKnowledge}</p>
    <h1>{t.problem}</h1>
    <div className="search-panel" id="search">
     <label className="search"><span>⌕</span><input aria-label={t.search} placeholder={t.searchPlaceholder} value={search} onChange={event=>{setSearch(event.target.value);if(event.target.value.trim())addRecent({bookId:'search',query:event.target.value,type:'search',label:event.target.value})}}/></label>
     {tagFilter&&<button className="tag-filter" onClick={()=>setTagFilter('')}>{t.filters}: {tagFilter} ×</button>}
    </div>
    <p>{t.heroText}</p>
    <div className="quick-actions">
     <a href="#search" className="tile">🔧 {t.resolver}</a>
     <a href="#library" className="tile">📚 {t.procedures}</a>
     <button className="tile" onClick={()=>setCreating(true)}>+ {t.createGuide.replace('+ ','')}</button>
     <button className="tile" onClick={()=>setImporting(true)}>+ {t.importRunbook}</button>
    </div>
   </section>

   {search.trim()&&<section className="results">
    <div className="toolbar compact"><h2>{t.search}</h2><button onClick={()=>setSearch('')}>{t.clear}</button></div>
    {runSearch.map(result=><article className="result" key={`${result.book.id}-${result.node?.id??'book'}`}>
     <div><div className="category">{result.node?.tags?.join(' / ')||result.book.tags.slice(0,3).join(' / ')}</div><h3>{localize(result.node?.title??result.book.title,lang)}</h3><p>{result.snippet||localize(result.book.description,lang)}</p></div>
     <button className="primary" onClick={()=>{open(result.book,'run',result.node?.id);addRecent({bookId:result.book.id,nodeId:result.node?.id,query:search,type:'resolved',label:localize(result.node?.title??result.book.title,lang)})}}>{t.resolver}</button>
    </article>)}
    {noRelevant&&<div className="empty-state"><h3>{t.noResults}</h3><div><button className="primary" onClick={()=>setQuickCreate(search)}>{t.addSolution}</button><button onClick={()=>setQuickCreate(search)}>{t.createTroubleshooting}</button><button onClick={()=>setSearch('')}>{t.cancel}</button></div></div>}
   </section>}

   <section className="toolbar" id="library"><h2>{t.library} <small>{visibleBooks.length}</small></h2><div><button className="primary" onClick={()=>setCreating(true)}>{t.createGuide}</button><button onClick={()=>setImporting(true)}>{t.importRunbook}</button></div></section>
   <section className="tag-strip" aria-label={t.tags}>{allTags.map(tag=><button key={tag} className={tagFilter===tag?'tag-chip active':'tag-chip'} onClick={()=>setTagFilter(tag)}>{tag}</button>)}</section>
   <section className="cards">{visibleBooks.map(item=><article className="card" key={item.id}>
    <div className="category">{item.category}</div><h3>{localize(item.title,lang)}</h3><p>{localize(item.description,lang)}</p>
    <div className="tags">{item.tags.slice(0,5).map(tag=><button className="tag-chip" key={tag} onClick={()=>setTagFilter(tag)}>{tag}</button>)}</div>
    <div className="mode-help">
     <button className="primary" title={t.runHelp} onClick={()=>open(item,'run')}>{t.run}<small>{t.runHelp}</small></button>
     <button title={t.onsiteHelp} onClick={()=>{setSite(true);open(item,'run')}}>{t.onsite}<small>{t.onsiteHelp}</small></button>
     <button title={t.editHelp} onClick={()=>open(item,'edit')}>{t.edit}<small>{t.editHelp}</small></button>
    </div>
    <div className="card-actions"><button className="dots" aria-label={t.duplicate} title={t.duplicate} onClick={()=>duplicate(item)}>⧉</button><button className="dots" aria-label={t.exportJson} title={t.exportJson} onClick={()=>download(item)}>⇩</button></div>
   </article>)}</section>

   <section className="recents" id="recents"><h2>{t.recent}</h2>{recents.length===0?<p>{t.recentEmpty}</p>:recents.slice(0,8).map(item=><button key={item.id} onClick={()=>{const recentBook=books.find(b=>b.id===item.bookId);if(recentBook)open(recentBook,'run',item.nodeId);else if(item.query)setSearch(item.query)}}><span>{item.label}</span><small>{new Date(item.at).toLocaleString()}</small></button>)}</section>
  </main>}

  {book&&mode==='run'&&<Runner key={`${book.id}-${targetNode??'start'}-${lang}`} book={book} onsite={site} setOnsite={setSite} startAt={targetNode} lang={lang} t={t} markRecent={addRecent}/>}
  {book&&mode==='edit'&&<Editor initial={book} onSave={update} onExit={()=>setMode('library')} lang={lang} t={t}/>}
  {importing&&<Importer books={books} close={()=>setImporting(false)} accept={acceptBook} lang={lang} t={t}/>}
  {creating&&<CreateRunbookModal close={()=>setCreating(false)} accept={createBook} lang={lang} t={t}/>}
  {quickCreate&&<QuickSolutionModal query={quickCreate} close={()=>setQuickCreate(undefined)} accept={saveQuick} lang={lang} t={t}/>}
  {mode==='library'&&<nav className="bottom-nav"><a href="#search">{t.search}</a><a href="#library">{t.library}</a><button onClick={()=>setCreating(true)}>{t.add}</button><a href="#recents">{t.recent}</a><button onClick={()=>setImporting(true)}>{t.importRunbook}</button></nav>}
 </div>;
}

function searchResults(books:Runbook[],query:string,tagFilter:string,lang:Language):SearchResult[]{
 const filtered=books.filter(book=>!tagFilter||book.tags.some(tag=>normalize(tag)===normalize(tagFilter)));
 if(!query.trim())return [];
 const results:SearchResult[]=[];
 for(const book of filtered){
  const bookText=[...collectLocalizedText(book.title),...collectLocalizedText(book.description),book.category,...book.tags].join(' ');
  const bookScore=scoreText(query,bookText);
  if(bookScore>0)results.push({book,score:bookScore,snippet:localize(book.description,lang)});
  for(const node of book.nodes){
   const text=nodeSearchText(book,node);
   const score=scoreText(query,text)+(node.type==='troubleshooting'?18:0);
   if(score>18)results.push({book,node,score,snippet:bestSnippet(query,text)});
  }
 }
 return results.sort((a,b)=>b.score-a.score).slice(0,8);
}

function MediaView({node,lang}:{node:RunbookNode;lang:Language}){return <>{node.media?.map((media,index)=>media.type==='image'?<figure key={index}><a href={media.url} target="_blank"><img src={media.url} alt={localize(media.alt,lang)}/></a>{media.caption&&<figcaption>{localize(media.caption,lang)}</figcaption>}</figure>:<figure key={index}><video controls preload="metadata" src={media.url}/>{media.caption&&<figcaption>{localize(media.caption,lang)}</figcaption>}</figure>)}</>}

function Runner({book,onsite,setOnsite,startAt,lang,t,markRecent}:{book:Runbook;onsite:boolean;setOnsite:(value:boolean)=>void;startAt?:string;lang:Language;t:Record<string,string>;markRecent:(item:Omit<RecentItem,'id'|'at'>)=>void}){
 const saved=loadProgress()[book.id]??[];
 const initial=startAt&&getNode(book,startAt)?[startAt]:saved.length?saved:[book.startNode];
 const [history,setHistory]=useState<string[]>(initial);
 const [copied,setCopied]=useState(false);
 const id=history.at(-1)??book.startNode;
 const node=getNode(book,id);
 useEffect(()=>{const progress=loadProgress();progress[book.id]=history;saveProgress(progress);const current=getNode(book,history.at(-1)??book.startNode);if(current)markRecent({bookId:book.id,nodeId:current.id,type:'step',label:localize(current.title,lang)})},[book,history,lang,markRecent]);
 if(!node)return <main><p>{t.missingNode}: {id}</p></main>;
 const go=(next?:string)=>next&&setHistory(items=>[...items,next]);
 const copyCommand=()=>{if(!node.command)return;navigator.clipboard.writeText(node.command);setCopied(true);setTimeout(()=>setCopied(false),1400)};
 return <main className={onsite?'runner onsite':'runner'}>
  <div className="runbar"><div><p className="eyebrow">{t.run} · {book.category}</p><h2>{localize(book.title,lang)}</h2></div><label className="toggle"><input type="checkbox" checked={onsite} onChange={event=>setOnsite(event.target.checked)}/> {t.onsite}<small>{t.onsiteHelp}</small></label></div>
  {!onsite&&<div className="crumbs">{history.map((nodeId,index)=><button key={`${nodeId}${index}`} onClick={()=>setHistory(items=>items.slice(0,index+1))}>{index+1}. {localize(getNode(book,nodeId)?.title??'',lang)}</button>)}</div>}
  <article className={`step ${node.type}`}>
   <p className="step-type">{node.type.replace('-',' ').toUpperCase()}</p>
   <h1>{localize(node.title,lang)}</h1>
   {node.body&&<p className="body">{localize(node.body,lang)}</p>}
   {node.symptoms?.length?<div className="meta-list"><b>{t.symptoms}</b>{node.symptoms.map((symptom,index)=><span key={index}>{localize(symptom,lang)}</span>)}</div>:null}
   <MediaView node={node} lang={lang}/>
   {node.command&&<div className="command">{node.destructive&&<strong>{t.warning}: {t.verifyBeforeRunning}.</strong>}<div><code>{node.command}</code><button onClick={copyCommand}>{copied?t.copied:t.copy}</button></div>{node.expectedResult&&<p><b>{t.expected}:</b> {localize(node.expectedResult,lang)}</p>}</div>}
   <div className="outcomes">{node.outcomes?.map(outcome=><button key={outcome.id} onClick={()=>go(outcome.nextNode)}>{localize(outcome.label,lang)}<span>→</span></button>)}{node.nextNode&&<button className="primary" onClick={()=>go(node.nextNode)}>{t.continue}<span>→</span></button>}{node.type==='solution'&&<button className="success" onClick={()=>markRecent({bookId:book.id,nodeId:node.id,type:'resolved',label:localize(node.title,lang)})}>✓ {t.markSolved}</button>}</div>
  </article>
  <div className="runner-nav"><button disabled={history.length<2} onClick={()=>setHistory(items=>items.slice(0,-1))}>← {t.back}</button><button onClick={()=>setHistory([book.startNode])}>↻ {t.startOver}</button></div>
 </main>;
}

function Importer({close,accept,books,lang,t}:{close:()=>void;accept:(book:Runbook)=>void;books:Runbook[];lang:Language;t:Record<string,string>}){
 const [candidate,setCandidate]=useState<Runbook>();
 const [errors,setErrors]=useState<string[]>([]);
 const read=(file?:File)=>{if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const data=migrateRunbook(JSON.parse(String(reader.result)) as Runbook);const result=validateRunbook(data);setErrors([...result.errors,...result.warnings.map(warning=>`${t.warnings}: ${warning}`)]);setCandidate(result.valid?data:undefined)}catch(error){setErrors([`/: Invalid JSON - ${error instanceof Error?error.message:'parse failed'}`]);setCandidate(undefined)}};reader.readAsText(file)};
 return <div className="modal" role="dialog" aria-modal="true"><section><button className="close" onClick={close}>×</button><p className="eyebrow">{t.importRunbook}</p><h2>{t.importTitle}</h2><label className="drop" onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();read(event.dataTransfer.files[0])}}>{t.drop}<br/><span>{t.choose}</span><input type="file" accept=".json,application/json" onChange={event=>read(event.target.files?.[0])}/></label>{errors.length>0&&<div className={candidate?'warnings':'errors'}><b>{candidate?t.reviewWarnings:t.validationFailed}</b>{errors.map((error,index)=><p key={index}>{error}</p>)}</div>}{candidate&&<div className="preview"><b>{t.preview}</b><h3>{localize(candidate.title,lang)}</h3><p>{localize(candidate.description,lang)}</p><p>{candidate.nodes.length} {t.node} · {candidate.category}</p>{books.some(book=>book.id===candidate.id)&&<p>{t.replaceNotice}</p>}<button className="primary" onClick={()=>accept(candidate)}>{t.importIntoLibrary}</button></div>}</section></div>;
}

function CreateRunbookModal({close,accept,lang,t}:{close:()=>void;accept:(book:Runbook)=>void;lang:Language;t:Record<string,string>}){
 const [title,setTitle]=useState('');
 const [description,setDescription]=useState('');
 const [category,setCategory]=useState('General');
 const [tags,setTags]=useState('');
 const [seedLang,setSeedLang]=useState<Language>(lang);
 const [firstNode,setFirstNode]=useState('');
 const create=()=>{
  const nodeTitle=firstNode||title||t.firstNode;
  const book:Runbook={schemaVersion:2,id:slugify(title||nodeTitle),title:localized(title||t.newGuide,seedLang),description:localized(description,seedLang),category,tags:splitList(tags),metadata:{author:'Tech Runbook',version:'1.0.0',updatedAt:new Date().toISOString()},startNode:'start',nodes:[{id:'start',type:'action',title:localized(nodeTitle,seedLang),body:localized('',seedLang),outcomes:[]}]};
  accept(book);
 };
 return <div className="modal" role="dialog" aria-modal="true"><section><button className="close" onClick={close}>×</button><p className="eyebrow">{t.createGuide}</p><h2>{t.newGuide}</h2><label>{t.guideName}<input value={title} onChange={event=>setTitle(event.target.value)} autoFocus/></label><label>{t.description}<textarea rows={3} value={description} onChange={event=>setDescription(event.target.value)}/></label><label>{t.category}<input value={category} onChange={event=>setCategory(event.target.value)}/></label><label>{t.tags}<input value={tags} onChange={event=>setTags(event.target.value)} placeholder="Vite, USB, RFID"/></label><label>{t.languageSeed}<select value={seedLang} onChange={event=>setSeedLang(event.target.value as Language)}><option value="es">{t.spanish}</option><option value="en">{t.english}</option></select></label><label>{t.firstNode}<input value={firstNode} onChange={event=>setFirstNode(event.target.value)}/></label><button className="primary wide" disabled={!title.trim()} onClick={create}>{t.create}</button></section></div>;
}

function QuickSolutionModal({query,close,accept,lang,t}:{query:string;close:()=>void;accept:(book:Runbook)=>void;lang:Language;t:Record<string,string>}){
 const [problem,setProblem]=useState(query);
 const [variants,setVariants]=useState(query);
 const [description,setDescription]=useState('');
 const [cause,setCause]=useState('');
 const [steps,setSteps]=useState('');
 const [command,setCommand]=useState('');
 const [expected,setExpected]=useState('');
 const [finalSolution,setFinalSolution]=useState('');
 const [tags,setTags]=useState('');
 const save=()=>{
  const id=slugify(problem);
  const stepLines=toLines(steps);
  const nodes:RunbookNode[]=[
   {id:'start',type:'troubleshooting',title:localized(problem,lang),body:localized(description,lang),symptoms:[localized(problem,lang)],errorMessages:toLines(variants),aliases:toLines(variants).map(item=>localized(item,lang)),keywords:[...splitList(tags),...normalize(problem).split(' ')],tags:splitList(tags),cause:localized(cause,lang),outcomes:stepLines.length?[{id:'seguir','label':localized(t.addNext,lang),'nextNode':'step-1'}]:command?[{id:'command','label':localized(t.addCommand,lang),'nextNode':'command'}]:[{id:'solution','label':localized(t.markAsSolution,lang),'nextNode':'solution'}]},
   ...stepLines.map((line,index)=>({id:`step-${index+1}`,type:'action' as NodeType,title:localized(`${t.step} ${index+1}`,lang),body:localized(line,lang),nextNode:index<stepLines.length-1?`step-${index+2}`:command?'command':'solution'})),
   ...(command?[{id:'command',type:'command' as NodeType,title:localized(t.optionalCommand,lang),command,expectedResult:localized(expected,lang),nextNode:'solution'}]:[]),
   {id:'solution',type:'solution',title:localized(finalSolution||problem,lang),body:localized(finalSolution||expected||description,lang),finalSolution:localized(finalSolution,lang)}
  ];
  accept({schemaVersion:2,id,title:localized(problem,lang),description:localized(description||problem,lang),category:'Troubleshooting',tags:splitList(tags),metadata:{author:'Tech Runbook',version:'1.0.0',updatedAt:new Date().toISOString(),createdFrom:query},startNode:'start',nodes});
 };
 return <div className="modal" role="dialog" aria-modal="true"><section><button className="close" onClick={close}>×</button><p className="eyebrow">{t.noResults}</p><h2>{t.solutionEditor}</h2><label>{t.errorProblem}<input value={problem} onChange={event=>setProblem(event.target.value)} autoFocus/></label><label>{t.variants}<textarea rows={3} value={variants} onChange={event=>setVariants(event.target.value)} placeholder="vite is not recognized&#10;vite: command not found"/></label><label>{t.description}<textarea rows={3} value={description} onChange={event=>setDescription(event.target.value)}/></label><label>{t.possibleCause}<textarea rows={2} value={cause} onChange={event=>setCause(event.target.value)}/></label><label>{t.step} 1, 2...<textarea rows={5} value={steps} onChange={event=>setSteps(event.target.value)} placeholder={t.oneStepPerLine}/></label><label>{t.optionalCommand}<textarea rows={4} value={command} onChange={event=>setCommand(event.target.value)}/></label><label>{t.expectedResult}<input value={expected} onChange={event=>setExpected(event.target.value)}/></label><label>{t.finalSolution}<textarea rows={3} value={finalSolution} onChange={event=>setFinalSolution(event.target.value)}/></label><label>{t.tags}<input value={tags} onChange={event=>setTags(event.target.value)} placeholder="Vite, npm"/></label><button className="primary wide" disabled={!problem.trim()} onClick={save}>{t.saveInLibrary}</button></section></div>;
}

function Editor({initial,onSave,onExit,lang,t}:{initial:Runbook;onSave:(book:Runbook)=>void;onExit:()=>void;lang:Language;t:Record<string,string>}){
 const draftKey=`tech-runbook.draft.${initial.id}`;
 const [book,setBook]=useState<Runbook>(()=>{try{return migrateRunbook(JSON.parse(localStorage.getItem(draftKey)??'null')||clone(initial))}catch{return clone(initial)}});
 const [past,setPast]=useState<Runbook[]>([]);
 const [future,setFuture]=useState<Runbook[]>([]);
 const [active,setActive]=useState(initial.startNode);
 const dirty=JSON.stringify(book)!==JSON.stringify(initial);
 useEffect(()=>{if(dirty)localStorage.setItem(draftKey,JSON.stringify(book))},[book,dirty,draftKey]);
 const mutate=(fn:(draft:Runbook)=>void)=>{setPast(items=>[...items.slice(-24),clone(book)]);setFuture([]);const next=clone(book);fn(next);setBook(next)};
 const setText=(value:LocalizedString|undefined,nextValue:string):LocalizedString=>typeof value==='string'?{es:lang==='es'?nextValue:value,en:lang==='en'?nextValue:value}:{...value,[lang]:nextValue};
 const node=getNode(book,active);
 const undo=()=>{const item=past.at(-1);if(item){setFuture(items=>[clone(book),...items]);setBook(item);setPast(items=>items.slice(0,-1))}};
 const redo=()=>{const item=future[0];if(item){setPast(items=>[...items,clone(book)]);setBook(item);setFuture(items=>items.slice(1))}};
 const addNode=(type:NodeType='action',title=t.node)=>{let id=slugify(title),i=2;while(book.nodes.some(item=>item.id===id))id=`${slugify(title)}-${i++}`;mutate(draft=>draft.nodes.push({id,type,title:localized(title,lang),body:localized('',lang),outcomes:[]}));setActive(id);return id};
 const remove=()=>{if(!node)return;const refs=book.nodes.filter(item=>item.nextNode===node.id||item.outcomes?.some(outcome=>outcome.nextNode===node.id));if(refs.length||book.startNode===node.id){alert(`Cannot delete: referenced by ${book.startNode===node.id?'START':refs.map(item=>localize(item.title,lang)).join(', ')}`);return}if(confirm(`Delete "${localize(node.title,lang)}"?`))mutate(draft=>{draft.nodes=draft.nodes.filter(item=>item.id!==node.id);setActive(draft.startNode)})};
 const duplicate=()=>{if(!node)return;let id=`${node.id}-copy`,i=2;while(book.nodes.some(item=>item.id===id))id=`${node.id}-copy-${i++}`;mutate(draft=>draft.nodes.push({...clone(node),id,title:setText(node.title,`${localize(node.title,lang)} (copy)`)}));setActive(id)};
 const quickNext=(type:NodeType,title:string)=>{if(!node)return;let id=slugify(title),i=2;while(book.nodes.some(item=>item.id===id))id=`${slugify(title)}-${i++}`;mutate(draft=>{draft.nodes.push({id,type,title:localized(title,lang),body:localized('',lang),outcomes:[]});const current=getNode(draft,active);if(current)current.nextNode=id});setActive(id)};
 const quickOutcome=(label:string)=>{if(!node)return;let id=slugify(label),i=2;while(book.nodes.some(item=>item.id===id))id=`${slugify(label)}-${i++}`;mutate(draft=>{draft.nodes.push({id,type:'action',title:localized(label,lang),body:localized('',lang),outcomes:[]});const current=getNode(draft,active);if(current)current.outcomes=[...(current.outcomes??[]),{id:`outcome-${(current.outcomes?.length??0)+1}`,label:localized(label,lang),nextNode:id}]});setActive(id)};
 const validation=validateRunbook(book);
 return <main className="editor">
  <div className="editor-head"><div><p className="eyebrow">{t.editorTitle}</p><input className="title-input" value={localize(book.title,lang)} onChange={event=>mutate(draft=>{draft.title=setText(draft.title,event.target.value)})}/></div><div><button disabled={!past.length} onClick={undo}>↶ {t.undo}</button><button disabled={!future.length} onClick={redo}>↷ {t.redo}</button><button onClick={()=>{if(confirm('Reset all unsaved changes?')){setBook(clone(initial));setPast([]);setFuture([])}}}>{t.reset}</button><button onClick={()=>download(book)}>{t.exportJson}</button><button className="primary" disabled={!validation.valid} onClick={()=>{onSave({...book,metadata:{...book.metadata,updatedAt:new Date().toISOString()}});localStorage.removeItem(draftKey);onExit()}}>{t.save} {dirty?'•':''}</button></div></div>
  <div className="editor-grid"><aside><div className="tree-head"><b>{t.tree}</b><button onClick={()=>addNode()}>{t.addNode}</button></div><button className={active===book.startNode?'tree-node active':'tree-node'} onClick={()=>setActive(book.startNode)}><small>START ↓</small>{localize(getNode(book,book.startNode)?.title??'',lang)}</button>{book.nodes.filter(item=>item.id!==book.startNode).map(item=><button key={item.id} className={active===item.id?'tree-node active':'tree-node'} onClick={()=>setActive(item.id)}><small>{item.type}</small>{localize(item.title,lang)}</button>)}</aside>
  {node&&<section className="inspector"><div className="inspector-head"><h2>{t.edit} {t.node}</h2><div><button onClick={duplicate}>⧉ {t.duplicate}</button><button className="danger" onClick={remove}>{t.delete}</button></div></div>
   <div className="quick-builder"><b>{t.quickBuild}</b><button onClick={()=>quickNext('action',t.addNext)}>{t.addNext}</button><button onClick={()=>quickOutcome(t.addAlternative)}>{t.addAlternative}</button><button onClick={()=>quickOutcome(t.addOutcome)}>{t.addOutcome}</button><button onClick={()=>mutate(draft=>{getNode(draft,active)!.type='solution'})}>{t.markAsSolution}</button><button onClick={()=>quickNext('command',t.addCommand)}>{t.addCommand}</button><button onClick={()=>mutate(draft=>{const current=getNode(draft,active)!;current.type='troubleshooting';current.errorMessages=[...(current.errorMessages??[]),''];current.keywords=[...(current.keywords??[]),'']})}>{t.addObservedError}</button></div>
   <Field label={t.nodeId} value={node.id} change={value=>mutate(draft=>{const current=getNode(draft,active)!;current.id=slugify(value);draft.nodes.forEach(item=>{if(item.nextNode===active)item.nextNode=current.id;item.outcomes?.forEach(outcome=>{if(outcome.nextNode===active)outcome.nextNode=current.id})});if(draft.startNode===active)draft.startNode=current.id;setActive(current.id)})}/>
   <label>{t.type}<select value={node.type} onChange={event=>mutate(draft=>{getNode(draft,active)!.type=event.target.value as NodeType})}>{nodeTypes.map(type=><option key={type}>{type}</option>)}</select></label>
   <Field label={t.title} value={localize(node.title,lang)} change={value=>mutate(draft=>{getNode(draft,active)!.title=setText(getNode(draft,active)!.title,value)})}/>
   <label>{t.body}<textarea rows={4} value={localize(node.body,lang)} onChange={event=>mutate(draft=>{const current=getNode(draft,active)!;current.body=setText(current.body,event.target.value)})}/></label>
   {(node.type==='command'||node.command!=null)&&<><label>{t.command}<textarea rows={4} value={node.command??''} onChange={event=>mutate(draft=>{getNode(draft,active)!.command=event.target.value})}/></label><Field label={t.expectedResult} value={localize(node.expectedResult,lang)} change={value=>mutate(draft=>{const current=getNode(draft,active)!;current.expectedResult=setText(current.expectedResult,value)})}/><label className="check"><input type="checkbox" checked={node.destructive??false} onChange={event=>mutate(draft=>{getNode(draft,active)!.destructive=event.target.checked})}/> {t.destructive}</label></>}
   {node.type==='troubleshooting'&&<TroubleshootingFields node={node} lang={lang} t={t} mutate={mutate} active={active} setText={setText}/>}
   <h3>{t.outcomes}</h3>{node.outcomes?.map((outcome,index)=><OutcomeRow key={outcome.id+index} outcome={outcome} nodes={book.nodes} lang={lang} t={t} change={next=>mutate(draft=>{getNode(draft,active)!.outcomes![index]=next})} remove={()=>mutate(draft=>{getNode(draft,active)!.outcomes!.splice(index,1)})}/>)}
   <button onClick={()=>mutate(draft=>{const current=getNode(draft,active)!;current.outcomes=[...(current.outcomes??[]),{id:`outcome-${(current.outcomes?.length??0)+1}`,label:localized(t.addOutcome,lang)}]})}>{t.addOutcome}</button>
   <h3>{t.defaultNext}</h3><select value={node.nextNode??''} onChange={event=>mutate(draft=>{getNode(draft,active)!.nextNode=event.target.value||undefined})}><option value="">{t.none}</option>{book.nodes.filter(item=>item.id!==node.id).map(item=><option value={item.id} key={item.id}>{localize(item.title,lang)}</option>)}</select>
   <h3>{t.validate}</h3><div className={validation.valid?'valid':'errors'}><b>{validation.valid?'✓ '+t.valid:t.issues}</b>{[...validation.errors,...validation.warnings].map((error,index)=><p key={index}>{error}</p>)}</div>
  </section>}</div>
 </main>;
}

function Field({label,value,change}:{label:string;value:string;change:(value:string)=>void}){return <label>{label}<input value={value} onChange={event=>change(event.target.value)}/></label>}

function TroubleshootingFields({node,lang,t,mutate,active,setText}:{node:RunbookNode;lang:Language;t:Record<string,string>;mutate:(fn:(draft:Runbook)=>void)=>void;active:string;setText:(value:LocalizedString|undefined,nextValue:string)=>LocalizedString}){
 const listValue=(field:DraftNodeField)=>(node[field]??[]).map(item=>localize(item,lang)).join('\n');
 const textListChange=(field:DraftNodeField,value:string)=>mutate(draft=>{getNode(draft,active)![field]=toLines(value).map(item=>localized(item,lang))});
 return <div className="troubleshooting-fields"><label>{t.symptoms}<textarea rows={3} value={listValue('symptoms')} onChange={event=>textListChange('symptoms',event.target.value)}/></label><label>{t.errorMessages}<textarea rows={3} value={(node.errorMessages??[]).join('\n')} onChange={event=>mutate(draft=>{getNode(draft,active)!.errorMessages=toLines(event.target.value)})}/></label><label>{t.aliases}<textarea rows={3} value={listValue('aliases')} onChange={event=>textListChange('aliases',event.target.value)}/></label><label>{t.keywords}<input value={(node.keywords??[]).join(', ')} onChange={event=>mutate(draft=>{getNode(draft,active)!.keywords=splitList(event.target.value)})}/></label><label>{t.tags}<input value={(node.tags??[]).join(', ')} onChange={event=>mutate(draft=>{getNode(draft,active)!.tags=splitList(event.target.value)})}/></label><label>{t.possibleCause}<textarea rows={2} value={localize(node.cause,lang)} onChange={event=>mutate(draft=>{getNode(draft,active)!.cause=setText(getNode(draft,active)!.cause,event.target.value)})}/></label></div>;
}

function OutcomeRow({outcome,nodes,lang,t,change,remove}:{outcome:Outcome;nodes:RunbookNode[];lang:Language;t:Record<string,string>;change:(outcome:Outcome)=>void;remove:()=>void}){
 const setOutcomeText=(value:LocalizedString|undefined,nextValue:string):LocalizedString=>typeof value==='string'?{es:lang==='es'?nextValue:value,en:lang==='en'?nextValue:value}:{...value,[lang]:nextValue};
 return <div className="outcome-edit"><input aria-label="Outcome label" value={localize(outcome.label,lang)} onChange={event=>change({...outcome,label:setOutcomeText(outcome.label,event.target.value)})}/><select aria-label="Next node" value={outcome.nextNode??''} onChange={event=>change({...outcome,nextNode:event.target.value||undefined})}><option value="">{t.end}</option>{nodes.map(node=><option key={node.id} value={node.id}>{localize(node.title,lang)}</option>)}</select><button className="danger" onClick={remove}>×</button></div>;
}

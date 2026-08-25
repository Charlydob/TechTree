import {memo,useCallback,useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import dagre from '@dagrejs/dagre';
import {
 Background,
 BaseEdge,
 Controls,
 EdgeLabelRenderer,
 Handle,
 MarkerType,
 MiniMap,
 Position,
 ReactFlow,
 ReactFlowProvider,
 useReactFlow,
 getSmoothStepPath,
 type Connection,
 type Edge,
 type EdgeProps,
 type Node,
 type NodeProps,
 type OnNodeDrag,
} from '@xyflow/react';
import {
 ArrowDownToDot,
 ArrowUpFromDot,
 CircleHelp,
 Copy,
 Download,
 Edit3,
 FileJson,
 FolderPlus,
 GitBranchPlus,
 Link as LinkIcon,
 Moon,
 PanelTopClose,
 PanelTopOpen,
 Plus,
 Save,
 Scissors,
 Search,
 Sun,
 Trash2,
 Unlink,
 Video,
 Workflow,
 Image as ImageIcon,
} from 'lucide-react';
import '@xyflow/react/dist/style.css';
import type {Language,LocalizedString,Media,MediaType,NodeType,Outcome,Runbook,RunbookNode} from './types';
import rfid from './data/rfid.json';
import webApp from './data/web-app-start.json';
import {
 FolderItem,
 RecentItem,
 folderPath,
 getStoredLanguage,
 getStoredTheme,
 loadFolders,
 loadLibrary,
 loadOpenFolders,
 loadProgress,
 loadRecents,
 saveFolders,
 saveLanguage,
 saveLibrary,
 saveOpenFolders,
 saveProgress,
 saveRecents,
 saveTheme,
} from './lib/storage';
import {ApiConflictError,AuthRequiredError,LocalRunbookRepository,OfflineError,ServerRunbookRepository,type SyncState} from './lib/repository';
import {collectLocalizedText,getNode,localized,localize,migrateRunbook,nodeSearchText,slugify,splitList,toLines} from './lib/runbook';
import {validateRunbook} from './lib/validation';

type Mode='library'|'run'|'edit';
type EditorView='diagram'|'cards';
type SearchResult={book:Runbook;node?:RunbookNode;score:number;snippet:string};
type DraftNodeField='symptoms'|'aliases';
type DeleteFolderIntent={folder:FolderItem;count:number};
type MoveMenu={bookId:string;folder:string};
type ConflictIntent={runbook:Runbook;message:string};
type FlowLink={source:string;target:string;label:string;outcomeId?:string};
type SelectedEdge={sourceId:string;targetId:string;outcomeId?:string;label:string};
type FlowNodeData={
 node:RunbookNode;
 isStart:boolean;
 isActive:boolean;
 label:string;
 body:string;
 t:Record<string,string>;
 lang:Language;
 openAddKey?:string;
 selected:boolean;
 onSelect:(id:string)=>void;
 onToggleAdd:(key?:string)=>void;
 onAdd:(sourceId:string,type:NodeType,outcomeId?:string)=>void;
 onAddOutcome:(sourceId:string)=>void;
};
type FlowNode=Node<FlowNodeData,'runbook'>;
type InsertEdgeData=SelectedEdge&{selected:boolean;onInsert:(sourceId:string,targetId:string,outcomeId?:string)=>void;onSelect:(edge:SelectedEdge)=>void};
type InsertEdge=Edge<InsertEdgeData,'insert'>;

const clone=<T,>(value:T):T=>structuredClone(value);
const defaultBooks=[rfid as Runbook,webApp as Runbook].map(migrateRunbook);
const uncategorized='';
const nodeTypesList:NodeType[]=['action','question','check','command','troubleshooting','warning','solution','note','visual-identification','multimedia'];
const mediaTypes:MediaType[]=['image','video','youtube','link'];

const ui={
 es:{
  library:'Biblioteca',run:'Ejecutar',edit:'Editar',onsite:'En el sitio',startOver:'Empezar de nuevo',back:'Atras',importRunbook:'Importar guia',createGuide:'+ Nueva guia',createTroubleshooting:'Crear troubleshooting',search:'Buscar',settings:'Ajustes',home:'Inicio',add:'Anadir',version:'Version',newVersion:'Hay una nueva version disponible',updateApp:'Actualizar',synced:'✅ Sincronizado',saving:'⏳ Guardando',offline:'📴 Sin conexion',pending:'⚠️ Cambios pendientes',syncError:'❌ Error de sincronizacion',login:'Entrar',password:'Contrasena',serverLogin:'Acceso al servidor',migrateLocal:'Hay procedimientos guardados unicamente en este dispositivo. Quieres subirlos al servidor?',uploadLocal:'Subir al servidor',skip:'Ahora no',conflict:'Este procedimiento fue modificado desde otro dispositivo.',loadServer:'Cargar version del servidor',keepMine:'Conservar mi version',exportMine:'Exportar mi version',
  runHelp:'Modo completo con contexto, avisos e historial.',onsiteHelp:'Modo ultrarrapido para trabajar fisicamente con el equipo.',editHelp:'Modificar este procedimiento.',
  problem:'Que quieres hacer?',searchPlaceholder:'Buscar error, dispositivo o procedimiento...',resolver:'Resolver',procedures:'Procedimientos',recent:'Recientes',recentEmpty:'Todavia no hay actividad reciente.',fieldKnowledge:'How to Do Everything',heroText:'Procedimientos interactivos para hacer, arreglar y documentar casi cualquier cosa.',
  noResults:'No tenemos una solucion guardada para este error.',addSolution:'Anadir solucion',cancel:'Cancelar',filters:'Filtros',clear:'Limpiar',category:'Categoria',tags:'Etiquetas',copy:'Copiar',copied:'Copiado',expected:'Esperado',continue:'Continuar',solved:'Solucionado',markSolved:'Marcar como solucionado',
  duplicate:'Duplicar',exportJson:'Exportar JSON',toggleTheme:'Cambiar tema',language:'Idioma',spanish:'Espanol',english:'English',importTitle:'Importar un procedimiento JSON',drop:'Suelta un archivo .json aqui',choose:'o eligelo en tu dispositivo',validationFailed:'Validacion fallida',reviewWarnings:'Revisar avisos',preview:'Vista previa',importIntoLibrary:'Importar a biblioteca',replaceNotice:'La importacion reemplazara la guia local con este ID.',
  editorTitle:'EDITOR VISUAL HTDE',title:'Titulo',description:'Descripcion',nodeId:'ID del nodo',type:'Tipo',body:'Descripcion',command:'Comando',expectedResult:'Resultado esperado',destructive:'Potencialmente destructivo',outcomes:'Opciones / ramas',defaultNext:'Siguiente paso por defecto',validate:'Validar guia',valid:'Estructura valida',issues:'Problemas encontrados',tree:'Diagrama',cards:'Tarjetas',node:'Nodo',addNode:'Nodo aislado',delete:'Eliminar',reset:'Reset layout',save:'Guardar',undo:'Deshacer',redo:'Rehacer',quickBuild:'Acciones rapidas',addNext:'Siguiente paso',addAlternative:'Alternativa',addOutcome:'Anadir opcion / rama',markAsSolution:'Solucion',addCommand:'Comando',addObservedError:'Error',
  newGuide:'Nueva guia',guideName:'Nombre',firstNode:'Primer nodo',languageSeed:'Idioma inicial',create:'Crear',solutionEditor:'Nueva solucion',errorProblem:'Error/problema',variants:'Variantes del error',possibleCause:'Posible causa',step:'Paso',optionalCommand:'Comando opcional',finalSolution:'Solucion final',saveInLibrary:'Guardar en biblioteca',warnings:'Avisos',errors:'Errores',missingNode:'Nodo no encontrado',none:'Ninguno',end:'Fin',mobileSearch:'Buscar',nodeOpen:'Abrir nodo',symptoms:'Sintomas',errorMessages:'Mensajes de error',aliases:'Alias',keywords:'Palabras clave',warning:'Advertencia',verifyBeforeRunning:'verifica antes de ejecutar',oneStepPerLine:'Un paso por linea',
  folders:'Carpetas',newFolder:'+ Nueva carpeta',newSubfolder:'+ Nueva subcarpeta',folder:'Carpeta',allFolders:'Todas',noFolder:'Sin carpeta',rename:'Renombrar',moveFolder:'Mover carpeta',deleteFolder:'Eliminar carpeta',deleteFolderTitle:'Eliminar carpeta',moveToNoFolder:'Mover guias a Sin carpeta',deleteFolderAndContent:'Eliminar carpeta y contenido',collapsedHint:'Toca para expandir',siteLabel:'En el sitio',menu:'Menu',metadata:'Metadata',move:'Mover',deleteGuide:'Eliminar guia',insertStep:'Insertar paso',insertBefore:'Insertar antes',insertAfter:'Insertar despues',autoLayout:'Organizar automaticamente',fitView:'Fit view',center:'Center',visualOnly:'Movimiento visual: no cambia conexiones.',yes:'Si',no:'No',
  disconnect:'Desconectar',changeTarget:'Cambiar destino',selectedConnection:'Conexion seleccionada',globalNodeHelp:'Las acciones globales crean nodos aislados.',manualConnect:'Arrastra desde un handle para conectar.',branchHelp:'Cada opcion representa un posible resultado y puede conducir a un paso diferente.',nodeOutcomeHelp:'Nodo = paso/pregunta/accion. Opcion = rama que sale de un nodo.',createNextNode:'Crear siguiente nodo',multimedia:'Multimedia',image:'Imagen',video:'Video',youtube:'YouTube',link:'Enlace',url:'URL',caption:'Caption',alt:'Alt text',mediaTitle:'Titulo del medio',quickEdit:'Edicion rapida',close:'Cerrar',moveUp:'Subir',moveDown:'Bajar',
 },
 en:{
  library:'Library',run:'Run',edit:'Edit',onsite:'On Site',startOver:'Start over',back:'Back',importRunbook:'Import runbook',createGuide:'+ New guide',createTroubleshooting:'Create troubleshooting',search:'Search',settings:'Settings',home:'Home',add:'Add',version:'Version',newVersion:'A new version is available',updateApp:'Update',synced:'✅ Synced',saving:'⏳ Saving',offline:'📴 Offline',pending:'⚠️ Pending changes',syncError:'❌ Sync error',login:'Sign in',password:'Password',serverLogin:'Server access',migrateLocal:'There are procedures saved only on this device. Do you want to upload them to the server?',uploadLocal:'Upload to server',skip:'Not now',conflict:'This procedure was modified from another device.',loadServer:'Load server version',keepMine:'Keep my version',exportMine:'Export my version',
  runHelp:'Full mode with context, warnings and history.',onsiteHelp:'Ultra-fast mode while working with the equipment.',editHelp:'Modify this procedure.',
  problem:'What do you want to do?',searchPlaceholder:'Search error, device or procedure...',resolver:'Resolve',procedures:'Procedures',recent:'Recents',recentEmpty:'No recent activity yet.',fieldKnowledge:'How to Do Everything',heroText:'Interactive procedures for making, fixing, and documenting almost anything.',
  noResults:'We do not have a saved solution for this error.',addSolution:'Add solution',cancel:'Cancel',filters:'Filters',clear:'Clear',category:'Category',tags:'Tags',copy:'Copy',copied:'Copied',expected:'Expected',continue:'Continue',solved:'Solved',markSolved:'Mark solved',
  duplicate:'Duplicate',exportJson:'Export JSON',toggleTheme:'Toggle theme',language:'Language',spanish:'Espanol',english:'English',importTitle:'Import a JSON procedure',drop:'Drop a .json file here',choose:'or choose from your device',validationFailed:'Validation failed',reviewWarnings:'Review warnings',preview:'Preview',importIntoLibrary:'Import into library',replaceNotice:'Importing will replace the local runbook with this ID.',
  editorTitle:'HTDE VISUAL EDITOR',title:'Title',description:'Description',nodeId:'Node ID',type:'Type',body:'Description',command:'Command',expectedResult:'Expected result',destructive:'Potentially destructive',outcomes:'Options / branches',defaultNext:'Default next step',validate:'Validate guide',valid:'Structure valid',issues:'Issues found',tree:'Diagram',cards:'Cards',node:'Node',addNode:'Loose node',delete:'Delete',reset:'Reset layout',save:'Save',undo:'Undo',redo:'Redo',quickBuild:'Quick actions',addNext:'Next step',addAlternative:'Alternative',addOutcome:'Add option / branch',markAsSolution:'Solution',addCommand:'Command',addObservedError:'Error',
  newGuide:'New guide',guideName:'Name',firstNode:'First node',languageSeed:'Initial language',create:'Create',solutionEditor:'New solution',errorProblem:'Error/problem',variants:'Error variants',possibleCause:'Possible cause',step:'Step',optionalCommand:'Optional command',finalSolution:'Final solution',saveInLibrary:'Save in library',warnings:'Warnings',errors:'Errors',missingNode:'Missing node',none:'None',end:'End',mobileSearch:'Search',nodeOpen:'Open node',symptoms:'Symptoms',errorMessages:'Error messages',aliases:'Aliases',keywords:'Keywords',warning:'Warning',verifyBeforeRunning:'verify before running',oneStepPerLine:'One step per line',
  folders:'Folders',newFolder:'+ New folder',newSubfolder:'+ New subfolder',folder:'Folder',allFolders:'All',noFolder:'No folder',rename:'Rename',moveFolder:'Move folder',deleteFolder:'Delete folder',deleteFolderTitle:'Delete folder',moveToNoFolder:'Move guides to No folder',deleteFolderAndContent:'Delete folder and content',collapsedHint:'Tap to expand',siteLabel:'On site',menu:'Menu',metadata:'Metadata',move:'Move',deleteGuide:'Delete guide',insertStep:'Insert step',insertBefore:'Insert before',insertAfter:'Insert after',autoLayout:'Auto layout',fitView:'Fit view',center:'Center',visualOnly:'Visual move: connections stay unchanged.',yes:'Yes',no:'No',
  disconnect:'Disconnect',changeTarget:'Change target',selectedConnection:'Selected connection',globalNodeHelp:'Global actions create loose nodes.',manualConnect:'Drag from a handle to connect.',branchHelp:'Each option represents a possible result and can lead to a different step.',nodeOutcomeHelp:'Node = step/question/action. Option = branch leaving a node.',createNextNode:'Create next node',multimedia:'Multimedia',image:'Image',video:'Video',youtube:'YouTube',link:'Link',url:'URL',caption:'Caption',alt:'Alt text',mediaTitle:'Media title',quickEdit:'Quick edit',close:'Close',moveUp:'Move up',moveDown:'Move down',
 },
} satisfies Record<Language,Record<string,string>>;

function normalize(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function scoreText(query:string,text:string){const q=normalize(query);const hay=normalize(text);if(!q)return 0;let score=hay.includes(q)?80:0;for(const token of q.split(/\s+/).filter(Boolean)){if(hay.includes(token))score+=12;else if(hay.split(/\s+/).some(part=>part.startsWith(token)||token.startsWith(part)))score+=5}return score}
function bestSnippet(query:string,text:string){const q=normalize(query).split(/\s+/).find(Boolean);if(!q)return text.slice(0,140);const flat=text.replace(/\s+/g,' ');const index=normalize(flat).indexOf(q);const start=Math.max(0,index-45);return flat.slice(start,start+150)}
function download(book:Runbook){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(book,null,2)],{type:'application/json'}));a.download=`${book.id}.json`;a.click();URL.revokeObjectURL(a.href)}
function folderOf(book:Runbook){return book.folder??book.category??uncategorized}
function folderLabel(name:string,t:Record<string,string>){return name||t.noFolder}
function uniqueFolderId(name:string){return `folder-${Date.now()}-${Math.random().toString(36).slice(2,7)}-${slugify(name||'sin-carpeta')}`}
function nodeTypeLabel(type:NodeType,t:Record<string,string>){const labels:Record<NodeType,string>={action:'Accion',question:'Pregunta',check:'Comprobacion',command:t.addCommand,troubleshooting:t.addObservedError,warning:t.warning,solution:t.markAsSolution,note:'Nota','visual-identification':'Identificacion visual',multimedia:'Multimedia'};return labels[type]??type}
function mediaTypeLabel(type:MediaType,t:Record<string,string>){return ({image:t.image,video:t.video,youtube:t.youtube,link:t.link})[type]}

export default function App(){
 const buildVersion=__APP_BUILD_VERSION__;
 const repository=useMemo(()=>new ServerRunbookRepository(new LocalRunbookRepository(defaultBooks)),[]);
 const syncReady=useRef(false);
 const [books,setBooks]=useState<Runbook[]>(()=>loadLibrary(defaultBooks));
 const [folders,setFolders]=useState<FolderItem[]>(()=>loadFolders(loadLibrary(defaultBooks)));
 const [selected,setSelected]=useState<string>();
 const [targetNode,setTargetNode]=useState<string>();
 const [mode,setMode]=useState<Mode>('library');
 const [site,setSite]=useState(false);
 const [search,setSearch]=useState('');
 const [tagFilter,setTagFilter]=useState('');
 const [folderFilter,setFolderFilter]=useState<string>();
 const [expanded,setExpanded]=useState<Set<string>>(()=>new Set());
 const [openFolders,setOpenFolders]=useState<Set<string>>(()=>new Set(loadOpenFolders()));
 const [newFolder,setNewFolder]=useState('');
 const [deleteFolder,setDeleteFolder]=useState<DeleteFolderIntent>();
 const [moving,setMoving]=useState<MoveMenu>();
 const [importing,setImporting]=useState(false);
 const [creating,setCreating]=useState(false);
 const [quickCreate,setQuickCreate]=useState<string>();
 const [lang,setLang]=useState<Language>(()=>getStoredLanguage());
 const [dark,setDark]=useState(()=>getStoredTheme()?getStoredTheme()==='dark':typeof matchMedia==='function'&&matchMedia('(prefers-color-scheme: dark)').matches);
 const [recents,setRecents]=useState<RecentItem[]>(()=>loadRecents());
 const [updateAvailable,setUpdateAvailable]=useState(false);
 const [syncState,setSyncState]=useState<SyncState>(()=>navigator.onLine?'pending':'offline');
 const [syncMessage,setSyncMessage]=useState('');
 const [pendingCount,setPendingCount]=useState(()=>repository.pendingCount());
 const [authRequired,setAuthRequired]=useState(false);
 const [password,setPassword]=useState('');
 const [migrationPrompt,setMigrationPrompt]=useState(false);
 const [conflict,setConflict]=useState<ConflictIntent>();
 const t=ui[lang];

 useEffect(()=>saveLibrary(books),[books]);
 const handleSyncError=useCallback((error:unknown,runbook?:Runbook)=>{
  if(error instanceof OfflineError){setSyncState('pending');setSyncMessage(t.pending);setPendingCount(repository.pendingCount());return}
  if(error instanceof AuthRequiredError){setAuthRequired(true);setSyncState('auth');setSyncMessage(t.serverLogin);return}
  if(error instanceof ApiConflictError){setConflict({runbook:runbook!,message:error.message||t.conflict});setSyncState('error');setSyncMessage(t.conflict);return}
  setSyncState('error');setSyncMessage(error instanceof Error?error.message:t.syncError);
 },[repository,t]);
 const refreshFromServer=useCallback(async()=>{
  setSyncState(navigator.onLine?'saving':'offline');
  try{
   const pending=await repository.pushPending();
   const snapshot=await repository.list();
   setBooks(snapshot.runbooks.length?snapshot.runbooks:defaultBooks);
   setFolders(snapshot.folders.length?snapshot.folders:loadFolders(snapshot.runbooks));
   setPendingCount(pending);
   setAuthRequired(false);
   setSyncState(pending?'pending':'synced');
   setSyncMessage(pending?t.pending:t.synced);
   if(repository.needsMigrationPrompt())setMigrationPrompt(true);
   syncReady.current=true;
  }catch(error){
   const snapshot=repository.localSnapshot();
   setBooks(snapshot.runbooks);
   setFolders(snapshot.folders);
   handleSyncError(error);
  }
 },[handleSyncError,repository,t]);
 const persistRunbook=useCallback(async(next:Runbook)=>{
  setSyncState('saving');setSyncMessage(t.saving);
  try{
   const saved=await repository.save(next);
   setBooks(items=>items.map(item=>item.id===next.id?saved:item));
   setSyncState('synced');setSyncMessage(t.synced);setPendingCount(repository.pendingCount());
  }catch(error){handleSyncError(error,next)}
 },[handleSyncError,repository,t]);
 const forceSaveConflict=useCallback(async()=>{
  if(!conflict)return;
  setSyncState('saving');setSyncMessage(t.saving);
  try{
   const saved=await repository.forceSave(conflict.runbook);
   setBooks(items=>items.map(item=>item.id===conflict.runbook.id?saved:item));
   setConflict(undefined);setSyncState('synced');setSyncMessage(t.synced);
  }catch(error){handleSyncError(error,conflict.runbook)}
 },[conflict,handleSyncError,repository,t]);
 const persistDelete=useCallback(async(source:Runbook)=>{
  setSyncState('saving');setSyncMessage(t.saving);
  try{await repository.delete(source);setSyncState('synced');setSyncMessage(t.synced);setPendingCount(repository.pendingCount())}catch(error){handleSyncError(error,source)}
 },[handleSyncError,repository,t]);
 const persistFolders=useCallback(async(next:FolderItem[])=>{
  try{await repository.saveFolders(next);setPendingCount(repository.pendingCount())}catch(error){handleSyncError(error)}
 },[handleSyncError,repository]);
 useEffect(()=>saveFolders(folders),[folders]);
 useEffect(()=>{if(syncReady.current)void persistFolders(folders)},[folders,persistFolders]);
 useEffect(()=>saveOpenFolders([...openFolders]),[openFolders]);
 useEffect(()=>{saveLanguage(lang);document.documentElement.lang=lang;document.title='HTDE - How to Do Everything'},[lang]);
 useEffect(()=>saveTheme(dark),[dark]);
 useEffect(()=>saveRecents(recents),[recents]);
 useEffect(()=>{const timer=window.setTimeout(()=>void refreshFromServer(),0);const online=()=>void refreshFromServer();window.addEventListener('online',online);return()=>{window.clearTimeout(timer);window.removeEventListener('online',online)}},[refreshFromServer]);
 useEffect(()=>{
  const show=()=>setUpdateAvailable(true);
  window.addEventListener('techtree:update-available',show);
  return ()=>window.removeEventListener('techtree:update-available',show);
 },[]);

 const folderPaths=useMemo(()=>new Map(folders.map(folder=>[folder.id,folderPath(folder,folders)])),[folders]);
 const book=books.find(item=>item.id===selected);
 const addRecent=useCallback((item:Omit<RecentItem,'id'|'at'>)=>setRecents(items=>[{...item,id:`recent-${Date.now()}`,at:new Date().toISOString()},...items.filter(old=>old.bookId!==item.bookId||old.nodeId!==item.nodeId||old.query!==item.query)].slice(0,24)),[]);
 const update=(next:Runbook)=>{setBooks(items=>items.map(item=>item.id===book?.id?next:item));void persistRunbook(next)};
 const open=(nextBook:Runbook,nextMode:Mode,nodeId?:string)=>{setSelected(nextBook.id);setTargetNode(nodeId);setMode(nextMode);addRecent({bookId:nextBook.id,nodeId,type:nextMode==='run'?'procedure':'step',label:localize(nextBook.title,lang)})};
 const duplicate=(source:Runbook)=>{let id=`${source.id}-copy`,i=2;while(books.some(item=>item.id===id))id=`${source.id}-copy-${i++}`;const copy={...clone(source),id,title:{es:`${localize(source.title,'es')} (copia)`,en:`${localize(source.title,'en')} (Copy)`},metadata:{...source.metadata,version:undefined,author:'HTDE',updatedAt:new Date().toISOString()}};setBooks(items=>[...items,copy]);void persistRunbook(copy);open(copy,'edit')};
 const removeBook=(source:Runbook)=>{if(confirm(`${t.deleteGuide}: "${localize(source.title,lang)}"?`)){setBooks(items=>items.filter(item=>item.id!==source.id));void persistDelete(source)}};
 const runSearch=useMemo(()=>searchResults(books,search,tagFilter,lang),[books,search,tagFilter,lang]);
 const visibleBooks=useMemo(()=>books.filter(item=>{
  const folder=folderOf(item);
  const folderMatches=folderFilter===undefined||folder===folderFilter||folder.startsWith(`${folderFilter}/`);
  return folderMatches&&(!tagFilter||item.tags.some(tag=>normalize(tag)===normalize(tagFilter)));
 }),[books,folderFilter,tagFilter]);
 const allTags=useMemo(()=>Array.from(new Set(books.flatMap(item=>item.tags))).sort((a,b)=>a.localeCompare(b)),[books]);
 const noRelevant=search.trim()&&runSearch.length===0;
 const ensureFolderPath=(path:string)=>{
  const parts=path.split('/').map(part=>part.trim()).filter(Boolean);
  if(!parts.length)return;
  setFolders(items=>{
   const next=[...items];
   let parentId: string|undefined;
   let current='';
   for(const part of parts){
    current=current?`${current}/${part}`:part;
    let existing=next.find(folder=>folderPath(folder,next)===current);
    if(!existing){existing={id:uniqueFolderId(part),name:part,parentId,createdAt:new Date().toISOString()};next.push(existing)}
    parentId=existing.id;
   }
   return next;
  });
 };
 const acceptBook=(next:Runbook)=>{const migrated=migrateRunbook(next);ensureFolderPath(folderOf(migrated));setBooks(items=>[...items.filter(item=>item.id!==migrated.id),migrated]);void persistRunbook(migrated);setImporting(false);open(migrated,'edit')};
 const createBook=(next:Runbook)=>{ensureFolderPath(folderOf(next));setBooks(items=>[next,...items]);void persistRunbook(next);setCreating(false);open(next,'edit')};
 const saveQuick=(next:Runbook)=>{ensureFolderPath(folderOf(next));setBooks(items=>[next,...items]);void persistRunbook(next);setQuickCreate(undefined);setSearch('');open(next,'edit')};
 const createFolder=(parentId?:string)=>{const name=newFolder.trim();if(!name)return;const parentPath=parentId?folderPaths.get(parentId):'';const path=parentPath?`${parentPath}/${name}`:name;if([...folderPaths.values()].some(value=>normalize(value)===normalize(path)))return;setFolders(items=>[...items,{id:uniqueFolderId(name),name,parentId,createdAt:new Date().toISOString()}]);setNewFolder('');setFolderFilter(path);if(parentId)setOpenFolders(ids=>new Set(ids).add(parentId))};
 const rewriteBookFolder=(oldPath:string,newPath:string)=>setBooks(items=>items.map(item=>{
  const current=folderOf(item);
  if(current===oldPath||current.startsWith(`${oldPath}/`)){const suffix=current.slice(oldPath.length);const next={...item,folder:`${newPath}${suffix}`,category:newPath.split('/')[0]||item.category};void persistRunbook(next);return next}
  return item;
 }));
 const renameFolder=(folder:FolderItem)=>{const oldPath=folderPaths.get(folder.id)??folder.name;const nextName=prompt(t.rename,folder.name)?.trim();if(!nextName||nextName===folder.name)return;const parentPath=folder.parentId?folderPaths.get(folder.parentId):'';const newPath=parentPath?`${parentPath}/${nextName}`:nextName;setFolders(items=>items.map(item=>item.id===folder.id?{...item,name:nextName}:item));rewriteBookFolder(oldPath,newPath);if(folderFilter===oldPath)setFolderFilter(newPath)};
 const isDescendant=(folderId:string,targetParentId?:string)=>{let current=targetParentId;while(current){if(current===folderId)return true;current=folders.find(item=>item.id===current)?.parentId}return false};
 const moveFolder=(folder:FolderItem)=>{const oldPath=folderPaths.get(folder.id)??folder.name;const target=prompt(`${t.moveFolder}: parent path`,folder.parentId?(folderPaths.get(folder.parentId)??''):'')?.trim()??'';const parent=target?folders.find(item=>folderPaths.get(item.id)===target):undefined;if(target&&!parent)return alert(t.missingNode);if(isDescendant(folder.id,parent?.id))return alert('A folder cannot move into its own descendant.');const newPath=target?`${target}/${folder.name}`:folder.name;setFolders(items=>items.map(item=>item.id===folder.id?{...item,parentId:parent?.id}:item));rewriteBookFolder(oldPath,newPath);if(folderFilter===oldPath)setFolderFilter(newPath)};
 const deleteFolderTree=(folder:FolderItem,deleteContents:boolean)=>{
  const oldPath=folderPaths.get(folder.id)??folder.name;
  const ids=new Set<string>([folder.id]);
  let changed=true;
  while(changed){changed=false;for(const item of folders){if(item.parentId&&ids.has(item.parentId)&&!ids.has(item.id)){ids.add(item.id);changed=true}}}
  setFolders(items=>items.filter(item=>!ids.has(item.id)));
  setBooks(items=>deleteContents?items.filter(item=>{const current=folderOf(item);const remove=current===oldPath||current.startsWith(`${oldPath}/`);if(remove)void persistDelete(item);return !remove}):items.map(item=>{const current=folderOf(item);if(current===oldPath||current.startsWith(`${oldPath}/`)){const next={...item,folder:uncategorized};void persistRunbook(next);return next}return item}));
  if(folderFilter===oldPath||folderFilter?.startsWith(`${oldPath}/`))setFolderFilter(undefined);
  setDeleteFolder(undefined);
 };
 const moveBook=(bookId:string,folder:string)=>{ensureFolderPath(folder);setBooks(items=>items.map(item=>{if(item.id!==bookId)return item;const next={...item,folder,category:folder.split('/')[0]||item.category};void persistRunbook(next);return next}));setMoving(undefined)};

 return <div className={dark?'app dark':'app'}>
  <header>
   <button className="brand" onClick={()=>setMode('library')} aria-label="HTDE Home"><span>HTDE</span><b>How to Do Everything</b></button>
   <div className="header-actions">
    <SyncIndicator state={syncState} pending={pendingCount} message={syncMessage} t={t}/>
    <label className="language-select" title={t.language}><span>{t.language}</span><select value={lang} onChange={event=>setLang(event.target.value as Language)}><option value="es">{t.spanish}</option><option value="en">{t.english}</option></select></label>
    <button className="icon-button" title={t.toggleTheme} onClick={()=>setDark(value=>!value)} aria-label={t.toggleTheme}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button>
    {mode!=='library'&&<button onClick={()=>setMode('library')}>{t.library}</button>}
   </div>
  </header>

  {mode==='library'&&<main className="home">
   <section className="hero compact-hero">
    <p className="eyebrow">HTDE</p>
    <h1>{t.fieldKnowledge}</h1>
    <p>{t.heroText}</p>
    <div className="search-panel" id="search">
     <label className="search"><Search size={18}/><input aria-label={t.search} placeholder={t.searchPlaceholder} value={search} onChange={event=>{setSearch(event.target.value);if(event.target.value.trim())addRecent({bookId:'search',query:event.target.value,type:'search',label:event.target.value})}}/></label>
     {tagFilter&&<button className="tag-filter" onClick={()=>setTagFilter('')}>{t.filters}: {tagFilter} x</button>}
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

   <section className="dashboard-grid" id="library">
    <aside className="folder-rail">
     <div className="rail-head"><b>{t.folders}</b><button onClick={()=>setFolderFilter(undefined)} className={folderFilter===undefined?'active':''}>{t.allFolders}</button></div>
     <div className="folder-create"><input value={newFolder} onChange={event=>setNewFolder(event.target.value)} placeholder={t.folder}/><button onClick={()=>createFolder()}>{t.newFolder}</button></div>
     <div className="folder-list">
      <FolderTree folders={folders} books={books} selected={folderFilter} open={openFolders} paths={folderPaths} t={t} setSelected={setFolderFilter} toggle={id=>setOpenFolders(ids=>{const next=new Set(ids);if(next.has(id))next.delete(id);else next.add(id);return next})} addSubfolder={createFolder} rename={renameFolder} move={moveFolder} remove={folder=>setDeleteFolder({folder,count:books.filter(book=>{const path=folderPaths.get(folder.id)??folder.name;const current=folderOf(book);return current===path||current.startsWith(`${path}/`)}).length})}/>
      {books.some(item=>folderOf(item)===uncategorized)&&<button className={folderFilter===uncategorized?'folder-root active':'folder-root'} onClick={()=>setFolderFilter(uncategorized)}>{t.noFolder}</button>}
     </div>
    </aside>
    <section className="library-panel">
     <div className="toolbar"><h2>{folderFilter===undefined?t.library:folderLabel(folderFilter,t)} <small>{visibleBooks.length}</small></h2><div><button className="primary" onClick={()=>setCreating(true)}>{t.createGuide}</button><button onClick={()=>setImporting(true)}>{t.importRunbook}</button></div></div>
     <section className="tag-strip" aria-label={t.tags}>{allTags.map(tag=><button key={tag} className={tagFilter===tag?'tag-chip active':'tag-chip'} onClick={()=>setTagFilter(tagFilter===tag?'':tag)}>{tag}</button>)}</section>
     <section className="compact-cards">{visibleBooks.map(item=>{
      const isExpanded=expanded.has(item.id);
      return <article className={isExpanded?'workflow-card expanded':'workflow-card'} key={item.id} onClick={()=>setExpanded(ids=>{const next=new Set(ids);if(next.has(item.id))next.delete(item.id);else next.add(item.id);return next})}>
       <div className="workflow-main">
        <div><div className="category">{folderLabel(folderOf(item),t).toUpperCase()}</div><h3>{localize(item.title,lang)}</h3></div>
        <div className="workflow-actions" onClick={event=>event.stopPropagation()}>
         <button className="primary" title={t.runHelp} onClick={()=>{setSite(false);open(item,'run')}}>{t.run}</button>
         <button className="icon-text" title={t.editHelp} onClick={()=>open(item,'edit')}><Edit3 size={16}/><span>{t.edit}</span></button>
         <button className="danger icon-text" title={t.deleteGuide} onClick={()=>removeBook(item)}><Trash2 size={16}/><span>{t.delete}</span></button>
         <details className="overflow-menu"><summary aria-label={t.menu}>...</summary><div>
          <button onClick={()=>duplicate(item)}>{t.duplicate}</button>
          <button onClick={()=>download(item)}>{t.exportJson}</button>
          <button onClick={()=>setMoving({bookId:item.id,folder:folderOf(item)})}>{t.moveFolder}</button>
          <button onClick={()=>setExpanded(ids=>new Set(ids).add(item.id))}>{t.metadata}</button>
         </div></details>
        </div>
       </div>
       {isExpanded&&<div className="workflow-detail">
        <p>{localize(item.description,lang)||t.collapsedHint}</p>
        <div className="tags horizontal-tags">{item.tags.map(tag=><button className="tag-chip" key={tag} onClick={event=>{event.stopPropagation();setTagFilter(tag)}}>{tag}</button>)}</div>
        <div className="detail-actions" onClick={event=>event.stopPropagation()}><button onClick={()=>{setSite(true);open(item,'run')}}>{t.siteLabel}</button><button onClick={()=>setMoving({bookId:item.id,folder:folderOf(item)})}>{t.move}</button><span>{item.nodes.length} {t.node}</span><span>{item.metadata?.updatedAt?.slice(0,10)}</span></div>
       </div>}
      </article>;
     })}</section>
    </section>
   </section>

   <section className="recents" id="recents"><h2>{t.recent}</h2>{recents.length===0?<p>{t.recentEmpty}</p>:recents.slice(0,8).map(item=><button key={item.id} onClick={()=>{const recentBook=books.find(b=>b.id===item.bookId);if(recentBook)open(recentBook,'run',item.nodeId);else if(item.query)setSearch(item.query)}}><span>{item.label}</span><small>{new Date(item.at).toLocaleString()}</small></button>)}</section>
   <section className="settings-panel" id="settings"><h2>{t.settings}</h2><div><span>{t.version}</span><code>{buildVersion}</code></div></section>
  </main>}

  {book&&mode==='run'&&<Runner key={`${book.id}-${targetNode??'start'}-${lang}-${site}`} book={book} onsite={site} setOnsite={setSite} startAt={targetNode} lang={lang} t={t} markRecent={addRecent} canEdit onSave={update}/>}
  {book&&mode==='edit'&&<Editor initial={book} onSave={update} onExit={()=>setMode('library')} lang={lang} t={t}/>}
  {importing&&<Importer books={books} close={()=>setImporting(false)} accept={acceptBook} lang={lang} t={t}/>}
  {creating&&<CreateRunbookModal close={()=>setCreating(false)} accept={createBook} lang={lang} t={t} folders={folders} folderPaths={folderPaths}/>}
  {quickCreate&&<QuickSolutionModal query={quickCreate} close={()=>setQuickCreate(undefined)} accept={saveQuick} lang={lang} t={t}/>}
  {deleteFolder&&<FolderDeleteModal intent={deleteFolder} close={()=>setDeleteFolder(undefined)} t={t} apply={deleteContents=>deleteFolderTree(deleteFolder.folder,deleteContents)}/>}
  {moving&&<MoveFolderModal moving={moving} folders={folders} folderPaths={folderPaths} t={t} close={()=>setMoving(undefined)} apply={moveBook}/>}
  {authRequired&&<LoginModal password={password} setPassword={setPassword} t={t} login={async()=>{await repository.login(password);setPassword('');setAuthRequired(false);await refreshFromServer()}}/>}
  {migrationPrompt&&<MigrationModal t={t} count={books.length} close={()=>{repository.markMigrationHandled();setMigrationPrompt(false)}} migrate={async()=>{setSyncState('saving');setSyncMessage(t.saving);try{await repository.migrateLocalRunbooksToServer(books);setMigrationPrompt(false);await refreshFromServer()}catch(error){handleSyncError(error)}}}/>}
  {conflict&&<ConflictModal intent={conflict} t={t} close={()=>setConflict(undefined)} loadServer={async()=>{setConflict(undefined);await refreshFromServer()}} keepMine={forceSaveConflict} exportMine={()=>download(conflict.runbook)}/>}
  {updateAvailable&&<div className="update-toast" role="status"><span>{t.newVersion} -&gt;</span><button className="primary" onClick={()=>window.dispatchEvent(new CustomEvent('techtree:apply-update'))}>{t.updateApp}</button></div>}
  {mode==='library'&&<nav className="bottom-nav"><a href="#search">{t.search}</a><a href="#library">{t.library}</a><button onClick={()=>setCreating(true)}>{t.add}</button><a href="#recents">{t.recent}</a><a href="#settings">{t.settings}</a></nav>}
 </div>;
}

function SyncIndicator({state,pending,message,t}:{state:SyncState;pending:number;message:string;t:Record<string,string>}){
 const label=state==='synced'?t.synced:state==='saving'?t.saving:state==='offline'?t.offline:state==='auth'?t.serverLogin:state==='pending'?t.pending:t.syncError;
 return <span className={`sync-indicator ${state}`} title={message||label}>{label}{pending>0?` (${pending})`:''}</span>;
}

function LoginModal({password,setPassword,login,t}:{password:string;setPassword:(value:string)=>void;login:()=>Promise<void>;t:Record<string,string>}){
 const [error,setError]=useState('');
 const submit=async(event:FormEvent)=>{
  event.preventDefault();
  setError('');
  try{await login()}catch(err){setError(err instanceof Error?err.message:t.syncError)}
 };
 return <div className="modal" role="dialog" aria-modal="true"><form className="compact-modal" onSubmit={submit}><p className="eyebrow">{t.serverLogin}</p><h2>{t.login}</h2><label>{t.password}<input type="password" value={password} onChange={event=>setPassword(event.target.value)} autoFocus/></label>{error&&<p className="errors">{error}</p>}<button className="primary wide" disabled={!password}>{t.login}</button></form></div>;
}

function MigrationModal({count,migrate,close,t}:{count:number;migrate:()=>Promise<void>;close:()=>void;t:Record<string,string>}){
 const [error,setError]=useState('');
 const apply=async()=>{setError('');try{await migrate()}catch(err){setError(err instanceof Error?err.message:t.syncError)}};
 return <div className="modal" role="dialog" aria-modal="true"><section className="compact-modal"><p className="eyebrow">{t.settings}</p><h2>{t.uploadLocal}</h2><p>{t.migrateLocal}</p><p>{count} {t.procedures.toLowerCase()}</p>{error&&<p className="errors">{error}</p>}<div className="modal-actions"><button onClick={close}>{t.skip}</button><button className="primary" onClick={apply}>{t.uploadLocal}</button></div></section></div>;
}

function ConflictModal({intent,loadServer,keepMine,exportMine,close,t}:{intent:ConflictIntent;loadServer:()=>Promise<void>;keepMine:()=>Promise<void>;exportMine:()=>void;close:()=>void;t:Record<string,string>}){
 const [error,setError]=useState('');
 const run=async(action:()=>Promise<void>)=>{setError('');try{await action()}catch(err){setError(err instanceof Error?err.message:t.syncError)}};
 return <div className="modal" role="dialog" aria-modal="true"><section className="compact-modal"><button className="close" onClick={close}>x</button><p className="eyebrow">{t.syncError}</p><h2>{t.conflict}</h2><p>{intent.message}</p>{error&&<p className="errors">{error}</p>}<div className="modal-actions"><button onClick={()=>void run(loadServer)}>{t.loadServer}</button><button onClick={()=>void run(keepMine)}>{t.keepMine}</button><button onClick={exportMine}>{t.exportMine}</button></div></section></div>;
}

function FolderTree({folders,books,selected,open,paths,t,setSelected,toggle,addSubfolder,rename,move,remove}:{folders:FolderItem[];books:Runbook[];selected?:string;open:Set<string>;paths:Map<string,string>;t:Record<string,string>;setSelected:(path:string)=>void;toggle:(id:string)=>void;addSubfolder:(parentId:string)=>void;rename:(folder:FolderItem)=>void;move:(folder:FolderItem)=>void;remove:(folder:FolderItem)=>void}){
 const roots=folders.filter(folder=>!folder.parentId);
 const count=(path:string)=>books.filter(book=>{const current=folderOf(book);return current===path||current.startsWith(`${path}/`)}).length;
 const render=(folder:FolderItem,depth=0)=>{
  const children=folders.filter(item=>item.parentId===folder.id);
  const path=paths.get(folder.id)??folder.name;
  const isOpen=open.has(folder.id);
  return <div className="folder-node" key={folder.id} style={{'--depth':depth} as React.CSSProperties}>
   <div className={selected===path?'folder-row active':'folder-row'}>
    <button className="folder-toggle" title={isOpen?`${t.close} ${folder.name}`:`${t.nodeOpen} ${folder.name}`} onClick={()=>children.length?toggle(folder.id):setSelected(path)}>{children.length?(isOpen?<PanelTopClose size={14}/>:<PanelTopOpen size={14}/>):<span/>}</button>
    <button className="folder-select" onClick={()=>setSelected(path)}><span>{folder.name}</span><small>{count(path)} {t.procedures.toLowerCase()}</small></button>
    <div>
     <button title={t.newSubfolder} onClick={()=>addSubfolder(folder.id)}><FolderPlus size={14}/></button>
     <button title={t.rename} onClick={()=>rename(folder)}><Edit3 size={14}/></button>
     <button title={t.moveFolder} onClick={()=>move(folder)}><Workflow size={14}/></button>
     <button className="danger" title={t.deleteFolder} onClick={()=>remove(folder)}><Trash2 size={14}/></button>
    </div>
   </div>
   {isOpen&&children.map(child=>render(child,depth+1))}
  </div>;
 };
 return <>{roots.map(root=>render(root))}</>;
}

function searchResults(books:Runbook[],query:string,tagFilter:string,lang:Language):SearchResult[]{
 const filtered=books.filter(book=>!tagFilter||book.tags.some(tag=>normalize(tag)===normalize(tagFilter)));
 if(!query.trim())return [];
 const results:SearchResult[]=[];
 for(const book of filtered){
  const bookText=[...collectLocalizedText(book.title),...collectLocalizedText(book.description),book.category,book.folder??'',...book.tags].join(' ');
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

function youtubeEmbed(url:string){
 try{
  const parsed=new URL(url);
  let id='';
  if(parsed.hostname.includes('youtu.be'))id=parsed.pathname.slice(1).split('/')[0];
  if(parsed.hostname.includes('youtube.com')){
   if(parsed.pathname.startsWith('/shorts/'))id=parsed.pathname.split('/')[2]??'';
   else if(parsed.pathname.startsWith('/embed/'))id=parsed.pathname.split('/')[2]??'';
   else id=parsed.searchParams.get('v')??'';
  }
  return id?`https://www.youtube.com/embed/${id}`:undefined;
 }catch{return undefined}
}

function MediaView({node,lang}:{node:RunbookNode;lang:Language}){
 return <>{node.media?.map((media,index)=><figure key={`${media.url}-${index}`} className={`media media-${media.type}`}>
  {media.type==='image'&&<a href={media.url} target="_blank" rel="noreferrer"><img src={media.url} alt={localize(media.alt,lang)}/></a>}
  {media.type==='video'&&<video controls preload="metadata" src={media.url}/>}
  {media.type==='youtube'&&(youtubeEmbed(media.url)?<iframe title={localize(media.title,lang)||localize(media.caption,lang)||'YouTube'} src={youtubeEmbed(media.url)} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/>:<a href={media.url} target="_blank" rel="noreferrer">{media.url}</a>)}
  {media.type==='link'&&<a className="media-link" href={media.url} target="_blank" rel="noreferrer"><LinkIcon size={18}/><span>{localize(media.title,lang)||media.url}</span></a>}
  {media.caption&&<figcaption>{localize(media.caption,lang)}</figcaption>}
  {media.description&&<p>{localize(media.description,lang)}</p>}
 </figure>)}</>;
}

function Runner({book,onsite,setOnsite,startAt,lang,t,markRecent,canEdit,onSave}:{book:Runbook;onsite:boolean;setOnsite:(value:boolean)=>void;startAt?:string;lang:Language;t:Record<string,string>;markRecent:(item:Omit<RecentItem,'id'|'at'>)=>void;canEdit:boolean;onSave:(book:Runbook)=>void}){
 const saved=loadProgress()[book.id]??[];
 const initial=startAt&&getNode(book,startAt)?[startAt]:saved.length?saved:[book.startNode];
 const [history,setHistory]=useState<string[]>(initial);
 const [copied,setCopied]=useState(false);
 const [editing,setEditing]=useState(false);
 const id=history.at(-1)??book.startNode;
 const node=getNode(book,id);
 useEffect(()=>{const progress=loadProgress();progress[book.id]=history;saveProgress(progress);const current=getNode(book,history.at(-1)??book.startNode);if(current)markRecent({bookId:book.id,nodeId:current.id,type:'step',label:localize(current.title,lang)})},[book,history,lang,markRecent]);
 if(!node)return <main><p>{t.missingNode}: {id}</p></main>;
 const go=(next?:string)=>next&&setHistory(items=>[...items,next]);
 const copyCommand=()=>{if(!node.command)return;navigator.clipboard.writeText(node.command);setCopied(true);setTimeout(()=>setCopied(false),1400)};
 return <main className={onsite?'runner onsite':'runner'}>
  <div className="runbar"><div><p className="eyebrow">{onsite?t.siteLabel:t.run} / {book.category}</p><h2>{localize(book.title,lang)}</h2></div><label className="toggle"><input type="checkbox" checked={onsite} onChange={event=>setOnsite(event.target.checked)}/> {t.onsite}<small>{t.onsiteHelp}</small></label></div>
  {!onsite&&<div className="crumbs">{history.map((nodeId,index)=><button key={`${nodeId}${index}`} onClick={()=>setHistory(items=>items.slice(0,index+1))}>{index+1}. {localize(getNode(book,nodeId)?.title??'',lang)}</button>)}</div>}
  <article className={`step ${node.type}`}>
   {canEdit&&<button className="quick-edit-button" title={t.quickEdit} aria-label={t.quickEdit} onClick={()=>setEditing(true)}><Edit3 size={18}/></button>}
   <p className="step-type">{node.type.replace('-',' ').toUpperCase()}</p>
   <h1>{localize(node.title,lang)}</h1>
   {node.body&&<p className="body">{localize(node.body,lang)}</p>}
   {!onsite&&node.symptoms?.length?<div className="meta-list"><b>{t.symptoms}</b>{node.symptoms.map((symptom,index)=><span key={index}>{localize(symptom,lang)}</span>)}</div>:null}
   <MediaView node={node} lang={lang}/>
   {node.command&&<div className="command">{node.destructive&&<strong>{t.warning}: {t.verifyBeforeRunning}.</strong>}<div><code>{node.command}</code><button onClick={copyCommand}>{copied?t.copied:t.copy}</button></div>{!onsite&&node.expectedResult&&<p><b>{t.expected}:</b> {localize(node.expectedResult,lang)}</p>}</div>}
   <div className="outcomes">{node.outcomes?.map(outcome=><button key={outcome.id} onClick={()=>go(outcome.nextNode)} disabled={!outcome.nextNode}>{localize(outcome.label,lang)}<span>-&gt;</span></button>)}{node.nextNode&&<button className="primary" onClick={()=>go(node.nextNode)}>{t.continue}<span>-&gt;</span></button>}{node.type==='solution'&&<button className="success" onClick={()=>markRecent({bookId:book.id,nodeId:node.id,type:'resolved',label:localize(node.title,lang)})}>OK {t.markSolved}</button>}</div>
  </article>
  <div className="runner-nav"><button disabled={history.length<2} onClick={()=>setHistory(items=>items.slice(0,-1))}>&lt;- {t.back}</button><button onClick={()=>setHistory([book.startNode])}>{t.reset}</button></div>
  {editing&&<QuickNodeEditModal book={book} node={node} close={()=>setEditing(false)} save={onSave} lang={lang} t={t}/>}
 </main>;
}

function Importer({close,accept,books,lang,t}:{close:()=>void;accept:(book:Runbook)=>void;books:Runbook[];lang:Language;t:Record<string,string>}){
 const [candidate,setCandidate]=useState<Runbook>();
 const [errors,setErrors]=useState<string[]>([]);
 const read=(file?:File)=>{if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const data=migrateRunbook(JSON.parse(String(reader.result)) as Runbook);const result=validateRunbook(data);setErrors([...result.errors,...result.warnings.map(warning=>`${t.warnings}: ${warning}`)]);setCandidate(result.valid?data:undefined)}catch(error){setErrors([`/: Invalid JSON - ${error instanceof Error?error.message:'parse failed'}`]);setCandidate(undefined)}};reader.readAsText(file)};
 return <div className="modal" role="dialog" aria-modal="true"><section><button className="close" onClick={close}>x</button><p className="eyebrow">{t.importRunbook}</p><h2>{t.importTitle}</h2><label className="drop" onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();read(event.dataTransfer.files[0])}}>{t.drop}<br/><span>{t.choose}</span><input type="file" accept=".json,application/json" onChange={event=>read(event.target.files?.[0])}/></label>{errors.length>0&&<div className={candidate?'warnings':'errors'}><b>{candidate?t.reviewWarnings:t.validationFailed}</b>{errors.map((error,index)=><p key={index}>{error}</p>)}</div>}{candidate&&<div className="preview"><b>{t.preview}</b><h3>{localize(candidate.title,lang)}</h3><p>{localize(candidate.description,lang)}</p><p>{candidate.nodes.length} {t.node} / {candidate.category}</p>{books.some(book=>book.id===candidate.id)&&<p>{t.replaceNotice}</p>}<button className="primary" onClick={()=>accept(candidate)}>{t.importIntoLibrary}</button></div>}</section></div>;
}

function CreateRunbookModal({close,accept,lang,t,folders,folderPaths}:{close:()=>void;accept:(book:Runbook)=>void;lang:Language;t:Record<string,string>;folders:FolderItem[];folderPaths:Map<string,string>}){
 const [title,setTitle]=useState('');
 const [folder,setFolder]=useState(folders[0]?folderPaths.get(folders[0].id)??folders[0].name:'General');
 const create=()=>{const name=title.trim();const folderName=folder.trim()||uncategorized;const book:Runbook={schemaVersion:2,id:slugify(name),title:localized(name,lang),description:localized('',lang),category:folderName.split('/')[0]||'General',folder:folderName,tags:[],metadata:{author:'HTDE',version:'1.0.0',updatedAt:new Date().toISOString()},startNode:'start',nodes:[{id:'start',type:'action',title:localized('START',lang),body:localized('',lang),outcomes:[],ui:{x:0,y:0}}]};accept(book)};
 return <div className="modal" role="dialog" aria-modal="true"><section className="compact-modal"><button className="close" onClick={close}>x</button><p className="eyebrow">{t.createGuide}</p><h2>{t.newGuide}</h2><div className="form-grid"><label>{t.guideName}<input value={title} onChange={event=>setTitle(event.target.value)} autoFocus/></label><label>{t.folder}<input list="folder-options" value={folder} onChange={event=>setFolder(event.target.value)}/><datalist id="folder-options">{folders.map(item=><option value={folderPaths.get(item.id)??item.name} key={item.id}/>)}</datalist></label></div><button className="primary wide" disabled={!title.trim()} onClick={create}>{t.create}</button></section></div>;
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
 const save=()=>{const id=slugify(problem);const stepLines=toLines(steps);const nodes:RunbookNode[]=[{id:'start',type:'troubleshooting',title:localized(problem,lang),body:localized(description,lang),symptoms:[localized(problem,lang)],errorMessages:toLines(variants),aliases:toLines(variants).map(item=>localized(item,lang)),keywords:[...splitList(tags),...normalize(problem).split(' ')],tags:splitList(tags),cause:localized(cause,lang),outcomes:stepLines.length?[{id:'seguir',label:localized(t.addNext,lang),nextNode:'step-1'}]:command?[{id:'command',label:localized(t.addCommand,lang),nextNode:'command'}]:[{id:'solution',label:localized(t.markAsSolution,lang),nextNode:'solution'}]},...stepLines.map((line,index)=>({id:`step-${index+1}`,type:'action' as NodeType,title:localized(`${t.step} ${index+1}`,lang),body:localized(line,lang),nextNode:index<stepLines.length-1?`step-${index+2}`:command?'command':'solution'})),...(command?[{id:'command',type:'command' as NodeType,title:localized(t.optionalCommand,lang),command,expectedResult:localized(expected,lang),nextNode:'solution'}]:[]),{id:'solution',type:'solution',title:localized(finalSolution||problem,lang),body:localized(finalSolution||expected||description,lang),finalSolution:localized(finalSolution,lang)}];accept({schemaVersion:2,id,title:localized(problem,lang),description:localized(description||problem,lang),category:'Troubleshooting',folder:'Troubleshooting',tags:splitList(tags),metadata:{author:'HTDE',version:'1.0.0',updatedAt:new Date().toISOString(),createdFrom:query},startNode:'start',nodes})};
 return <div className="modal" role="dialog" aria-modal="true"><section><button className="close" onClick={close}>x</button><p className="eyebrow">{t.noResults}</p><h2>{t.solutionEditor}</h2><div className="form-grid"><label>{t.errorProblem}<input value={problem} onChange={event=>setProblem(event.target.value)} autoFocus/></label><label>{t.tags}<input value={tags} onChange={event=>setTags(event.target.value)} placeholder="Vite, npm"/></label><label>{t.variants}<textarea rows={3} value={variants} onChange={event=>setVariants(event.target.value)} placeholder="vite is not recognized&#10;vite: command not found"/></label><label>{t.description}<textarea rows={3} value={description} onChange={event=>setDescription(event.target.value)}/></label><label>{t.possibleCause}<textarea rows={2} value={cause} onChange={event=>setCause(event.target.value)}/></label><label>{t.step} 1, 2...<textarea rows={5} value={steps} onChange={event=>setSteps(event.target.value)} placeholder={t.oneStepPerLine}/></label><label>{t.optionalCommand}<textarea rows={4} value={command} onChange={event=>setCommand(event.target.value)}/></label><label>{t.finalSolution}<textarea rows={3} value={finalSolution} onChange={event=>setFinalSolution(event.target.value)}/></label><label>{t.expectedResult}<input value={expected} onChange={event=>setExpected(event.target.value)}/></label></div><button className="primary wide" disabled={!problem.trim()} onClick={save}>{t.saveInLibrary}</button></section></div>;
}

function Editor({initial,onSave,onExit,lang,t}:{initial:Runbook;onSave:(book:Runbook)=>void;onExit:()=>void;lang:Language;t:Record<string,string>}){return <ReactFlowProvider><FlowEditor initial={initial} onSave={onSave} onExit={onExit} lang={lang} t={t}/></ReactFlowProvider>}

function FlowEditor({initial,onSave,onExit,lang,t}:{initial:Runbook;onSave:(book:Runbook)=>void;onExit:()=>void;lang:Language;t:Record<string,string>}){
 const draftKey=`tech-runbook.draft.${initial.id}`;
 const flow=useReactFlow();
 const [book,setBook]=useState<Runbook>(()=>{try{return migrateRunbook(JSON.parse(localStorage.getItem(draftKey)??'null')||clone(initial))}catch{return clone(initial)}});
 const [past,setPast]=useState<Runbook[]>([]);
 const [future,setFuture]=useState<Runbook[]>([]);
 const [active,setActive]=useState(initial.startNode);
 const [selectedEdge,setSelectedEdge]=useState<SelectedEdge>();
 const [openAddKey,setOpenAddKey]=useState<string>();
 const [showJson,setShowJson]=useState(false);
 const [view,setView]=useState<EditorView>(()=>isMobileLayout()?'cards':'diagram');
 const dirty=JSON.stringify(book)!==JSON.stringify(initial);
 const validation=validateRunbook(book);
 const activeNode=getNode(book,active)??getNode(book,book.startNode);

 useEffect(()=>{if(dirty)localStorage.setItem(draftKey,JSON.stringify(book))},[book,dirty,draftKey]);
 const mutate=useCallback((fn:(draft:Runbook)=>void)=>{setPast(items=>[...items.slice(-24),clone(book)]);setFuture([]);const next=clone(book);fn(next);setBook(next)},[book]);
 const setText=(value:LocalizedString|undefined,nextValue:string):LocalizedString=>typeof value==='string'?{es:lang==='es'?nextValue:value,en:lang==='en'?nextValue:value}:{...value,[lang]:nextValue};
 const undo=()=>{const item=past.at(-1);if(item){setFuture(items=>[clone(book),...items]);setBook(item);setPast(items=>items.slice(0,-1))}};
 const redo=()=>{const item=future[0];if(item){setPast(items=>[...items,clone(book)]);setBook(item);setFuture(items=>items.slice(1))}};
 const save=()=>{onSave({...book,metadata:{...book.metadata,author:book.metadata?.author??'HTDE',updatedAt:new Date().toISOString()}});localStorage.removeItem(draftKey);onExit()};
 const makeNode=(type:NodeType,title=nodeTypeLabel(type,t)):RunbookNode=>{const base:RunbookNode={id:'',type,title:localized(title,lang),body:localized('',lang),outcomes:[]};if(type==='question')base.outcomes=[{id:'si',label:localized(t.yes,lang)},{id:'no',label:localized(t.no,lang)}];if(type==='command')base.command='';if(type==='troubleshooting')base.errorMessages=[];return base};
 const uniqueNodeId=(title:string)=>{let id=slugify(title),i=2;while(book.nodes.some(item=>item.id===id))id=`${slugify(title)}-${i++}`;return id};
 const childPosition=(sourceId:string,index:number)=>{const source=getNode(book,sourceId);const fallback=layoutRunbook(book,isMobileLayout())[sourceId]??{x:0,y:0};const base={x:source?.ui?.x??fallback.x,y:source?.ui?.y??fallback.y};const siblings=flowLinks(book).filter(link=>link.source===sourceId).length;return isMobileLayout()?{x:base.x+(index-(siblings/2))*240,y:base.y+260}:{x:base.x+330,y:base.y+(index-(siblings/2))*180}};
 const addLinkedNode=(sourceId:string,type:NodeType,outcomeId?:string)=>{const title=nodeTypeLabel(type,t);const id=uniqueNodeId(title);const position=childPosition(sourceId,flowLinks(book).filter(link=>link.source===sourceId).length);mutate(draft=>{const source=getNode(draft,sourceId);if(!source)return;const next=makeNode(type,title);next.id=id;next.ui=position;const outcome=source.outcomes?.find(item=>item.id===outcomeId);const previousTarget=outcome?outcome.nextNode:source.nextNode;next.nextNode=previousTarget;draft.nodes.push(next);if(outcome)outcome.nextNode=id;else source.nextNode=id});setActive(id);setSelectedEdge(undefined);setOpenAddKey(undefined)};
 const addLooseNode=(type:NodeType)=>{const title=nodeTypeLabel(type,t);const id=uniqueNodeId(title);const position=findFreePosition(book);mutate(draft=>{const next=makeNode(type,title);next.id=id;next.ui=position;draft.nodes.push(next)});setActive(id);setSelectedEdge(undefined)};
 const insertBetween=(sourceId:string,targetId:string,outcomeId?:string)=>{const title=t.step;const id=uniqueNodeId(title);mutate(draft=>{const source=getNode(draft,sourceId);const target=getNode(draft,targetId);if(!source||!target)return;const next=makeNode('action',title);next.id=id;next.nextNode=targetId;next.ui={x:((source.ui?.x??0)+(target.ui?.x??0))/2,y:((source.ui?.y??0)+(target.ui?.y??0))/2+60};draft.nodes.push(next);const outcome=source.outcomes?.find(item=>item.id===outcomeId);if(outcome)outcome.nextNode=id;else if(source.nextNode===targetId)source.nextNode=id});setActive(id);setSelectedEdge(undefined)};
 const addOutcome=(sourceId:string)=>mutate(draft=>{const source=getNode(draft,sourceId);if(!source)return;source.outcomes=[...(source.outcomes??[]),{id:`outcome-${(source.outcomes?.length??0)+1}`,label:localized(t.addOutcome,lang)}]});
 const addBefore=()=>{if(!activeNode)return;const id=uniqueNodeId(t.step);mutate(draft=>{const next=makeNode('action',t.step);next.id=id;next.nextNode=activeNode.id;next.ui={x:(activeNode.ui?.x??0)-220,y:activeNode.ui?.y??0};draft.nodes.forEach(item=>{if(item.nextNode===activeNode.id)item.nextNode=id;item.outcomes?.forEach(outcome=>{if(outcome.nextNode===activeNode.id)outcome.nextNode=id})});if(draft.startNode===activeNode.id)draft.startNode=id;draft.nodes.push(next)});setActive(id)};
 const addAfter=()=>activeNode&&addLinkedNode(activeNode.id,'action');
 const remove=()=>{if(!activeNode)return;const degree=flowLinks(book).filter(link=>link.source===activeNode.id||link.target===activeNode.id).length;if(activeNode.id===book.startNode&&book.nodes.length>1){alert('START cannot be deleted while other nodes exist.');return}if(degree&& !confirm(`${t.delete}: "${localize(activeNode.title,lang)}"? ${degree} connection(s) will be rewired.`))return;if(!degree&& !confirm(`${t.delete}: "${localize(activeNode.title,lang)}"?`))return;mutate(draft=>{const fallback=activeNode.nextNode;draft.nodes.forEach(item=>{if(item.nextNode===activeNode.id)item.nextNode=fallback;item.outcomes?.forEach(outcome=>{if(outcome.nextNode===activeNode.id)outcome.nextNode=fallback})});draft.nodes=draft.nodes.filter(item=>item.id!==activeNode.id);draft.startNode=draft.startNode===activeNode.id?(draft.nodes[0]?.id??'start'):draft.startNode;setActive(draft.startNode)})};
 const duplicateNode=()=>{if(!activeNode)return;const id=uniqueNodeId(`${localize(activeNode.title,lang)} copy`);mutate(draft=>draft.nodes.push({...clone(activeNode),id,title:setText(activeNode.title,`${localize(activeNode.title,lang)} copy`),nextNode:undefined,outcomes:[],ui:{x:(activeNode.ui?.x??0)+36,y:(activeNode.ui?.y??0)+36}}));setActive(id)};
 const relayout=()=>mutate(draft=>{const layout=layoutRunbook(draft,isMobileLayout());draft.nodes.forEach(node=>{node.ui=layout[node.id]})});
 const resetLayout=()=>mutate(draft=>{draft.nodes.forEach(node=>{delete node.ui})});
 const onNodeDragStop:OnNodeDrag<FlowNode>=(_,flowNode)=>mutate(draft=>{const node=getNode(draft,flowNode.id);if(node)node.ui={x:Math.round(flowNode.position.x),y:Math.round(flowNode.position.y)}});
 const onConnect=(connection:Connection)=>{if(!connection.source||!connection.target||connection.source===connection.target)return;mutate(draft=>{const source=getNode(draft,connection.source!);if(!source)return;if(connection.sourceHandle?.startsWith('outcome:')){const id=connection.sourceHandle.slice('outcome:'.length);const outcome=source.outcomes?.find(item=>item.id===id);if(outcome)outcome.nextNode=connection.target!}else source.nextNode=connection.target!})};
 const disconnectEdge=()=>selectedEdge&&mutate(draft=>{const source=getNode(draft,selectedEdge.sourceId);if(!source)return;if(selectedEdge.outcomeId){const outcome=source.outcomes?.find(item=>item.id===selectedEdge.outcomeId);if(outcome)delete outcome.nextNode}else if(source.nextNode===selectedEdge.targetId)delete source.nextNode;setSelectedEdge(undefined)});
 const changeEdgeTarget=(target:string)=>selectedEdge&&mutate(draft=>{const source=getNode(draft,selectedEdge.sourceId);if(!source||target===selectedEdge.sourceId)return;if(selectedEdge.outcomeId){const outcome=source.outcomes?.find(item=>item.id===selectedEdge.outcomeId);if(outcome)outcome.nextNode=target}else source.nextNode=target;setSelectedEdge({...selectedEdge,targetId:target})});
 useEffect(()=>{
  const handler=(event:KeyboardEvent)=>{
   const target=event.target as HTMLElement|null;
   if(target&&['INPUT','TEXTAREA','SELECT'].includes(target.tagName))return;
   if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&event.shiftKey){event.preventDefault();redo();return}
   if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();undo();return}
   if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();if(validation.valid)save();return}
   if(event.key==='Escape'){setSelectedEdge(undefined);setOpenAddKey(undefined);return}
   if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();if(selectedEdge)disconnectEdge();else remove()}
  };
  window.addEventListener('keydown',handler);
  return ()=>window.removeEventListener('keydown',handler);
 });
 const {nodes,edges}=toFlowElements(book,active,selectedEdge,lang,t,openAddKey,setActive,setOpenAddKey,addLinkedNode,addOutcome,insertBetween,setSelectedEdge);
 const nodeTypes=useMemo(()=>({runbook:FlowNodeCard}),[]);
 const edgeTypes=useMemo(()=>({insert:InsertEdgeButton}),[]);
 return <main className="editor visual-editor">
  <div className="editor-head">
   <div><p className="eyebrow">{t.editorTitle}</p><input className="title-input" value={localize(book.title,lang)} onChange={event=>mutate(draft=>{draft.title=setText(draft.title,event.target.value)})}/></div>
   <div><button disabled={!past.length} onClick={undo}>{t.undo}</button><button disabled={!future.length} onClick={redo}>{t.redo}</button><button onClick={relayout}>{t.autoLayout}</button><button onClick={()=>flow.fitView({padding:.16})}>{t.fitView}</button><button onClick={()=>activeNode&&flow.setCenter(activeNode.ui?.x??0,activeNode.ui?.y??0,{zoom:1,duration:250})}>{t.center}</button><button onClick={resetLayout}>{t.reset}</button><button onClick={()=>setShowJson(value=>!value)}><FileJson size={16}/> JSON</button><button onClick={()=>download(book)}><Download size={16}/> {t.exportJson}</button><button className="primary" disabled={!validation.valid} onClick={save}><Save size={16}/> {t.save} {dirty?'*':''}</button></div>
  </div>
  <div className="editor-view-toggle"><button className={view==='diagram'?'active':''} onClick={()=>setView('diagram')}><Workflow size={16}/> {t.tree}</button><button className={view==='cards'?'active':''} onClick={()=>setView('cards')}><PanelTopOpen size={16}/> {t.cards}</button><span title={t.manualConnect}><CircleHelp size={15}/></span></div>
  <div className="global-quick"><b>{t.quickBuild}</b><span>{t.globalNodeHelp}</span>{nodeTypesList.map(type=><button key={type} onClick={()=>addLooseNode(type)}>{nodeTypeLabel(type,t)}</button>)}</div>
  <div className="visual-shell">
   {view==='diagram'?<section className="flow-surface" aria-label={t.tree}><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodeDragStop={onNodeDragStop} onConnect={onConnect} onPaneClick={()=>{setSelectedEdge(undefined);setOpenAddKey(undefined)}} fitView minZoom={0.22} maxZoom={1.7} nodesDraggable nodesConnectable elementsSelectable snapToGrid snapGrid={[12,12]} connectionRadius={38} proOptions={{hideAttribution:true}}><Background gap={22}/><MiniMap pannable zoomable className="flow-minimap"/><Controls showInteractive={false}/></ReactFlow><p className="flow-note">{t.visualOnly}</p></section>:<MobileCards book={book} active={active} setActive={setActive} lang={lang} t={t} addAfter={addLinkedNode} addOutcome={addOutcome} insertBefore={addBefore} remove={remove}/>}
   {activeNode&&<section className="inspector node-sheet">
    <div className="inspector-head"><div><p className="eyebrow">{activeNode.id===book.startNode?'START':activeNode.type}</p><h2>{localize(activeNode.title,lang)||t.node}</h2></div><div><button onClick={addBefore}><ArrowUpFromDot size={16}/> {t.insertBefore}</button><button onClick={addAfter}><ArrowDownToDot size={16}/> {t.insertAfter}</button><button onClick={duplicateNode}><Copy size={16}/> {t.duplicate}</button><button className="danger" onClick={remove}><Trash2 size={16}/> {t.delete}</button></div></div>
    <div className="quick-builder"><b>{t.nodeOutcomeHelp}</b>{nodeTypesList.map(type=><button key={type} onClick={()=>addLinkedNode(activeNode.id,type)}><Plus size={14}/> {nodeTypeLabel(type,t)}</button>)}<button onClick={()=>addOutcome(activeNode.id)}><GitBranchPlus size={14}/> {t.addOutcome}</button></div>
    {selectedEdge&&<div className="edge-panel"><h3>{t.selectedConnection}</h3><p>{selectedEdge.sourceId} -&gt; {selectedEdge.targetId}</p><div><button onClick={()=>insertBetween(selectedEdge.sourceId,selectedEdge.targetId,selectedEdge.outcomeId)}><Plus size={15}/> {t.insertStep}</button><button className="danger" onClick={disconnectEdge}><Unlink size={15}/> {t.disconnect}</button></div><label>{t.changeTarget}<select value={selectedEdge.targetId} onChange={event=>changeEdgeTarget(event.target.value)}>{book.nodes.filter(node=>node.id!==selectedEdge.sourceId).map(node=><option key={node.id} value={node.id}>{localize(node.title,lang)}</option>)}</select></label></div>}
    <NodeForm activeNode={activeNode} book={book} lang={lang} t={t} mutate={mutate} setText={setText}/>
    <h3>{t.outcomes} <span className="help" title={t.branchHelp}><CircleHelp size={15}/></span></h3>
    {activeNode.outcomes?.map((outcome,index)=><OutcomeRow key={outcome.id+index} outcome={outcome} nodes={book.nodes} lang={lang} t={t} change={next=>mutate(draft=>{getNode(draft,activeNode.id)!.outcomes![index]=next})} remove={()=>mutate(draft=>{getNode(draft,activeNode.id)!.outcomes!.splice(index,1)})} createNode={()=>addLinkedNode(activeNode.id,'action',outcome.id)}/>)}
    <button onClick={()=>addOutcome(activeNode.id)}><GitBranchPlus size={16}/> {t.addOutcome}</button>
    <h3>{t.defaultNext}</h3>
    <select value={activeNode.nextNode??''} onChange={event=>mutate(draft=>{getNode(draft,activeNode.id)!.nextNode=event.target.value||undefined})}><option value="">{t.none}</option>{book.nodes.filter(item=>item.id!==activeNode.id).map(item=><option value={item.id} key={item.id}>{localize(item.title,lang)}</option>)}</select>
    <MediaEditor media={activeNode.media??[]} lang={lang} t={t} change={media=>mutate(draft=>{getNode(draft,activeNode.id)!.media=media})}/>
    <h3>{t.validate}</h3><div className={validation.valid?'valid':'errors'}><b>{validation.valid?'OK '+t.valid:t.issues}</b>{[...validation.errors,...validation.warnings].map((error,index)=><p key={index}>{error}</p>)}</div>
   </section>}
  </div>
  {showJson&&<pre className="json-preview">{JSON.stringify(book,null,2)}</pre>}
 </main>;
}

function NodeForm({activeNode,book,lang,t,mutate,setText}:{activeNode:RunbookNode;book:Runbook;lang:Language;t:Record<string,string>;mutate:(fn:(draft:Runbook)=>void)=>void;setText:(value:LocalizedString|undefined,nextValue:string)=>LocalizedString}){
 return <>
  <div className="form-grid">
   <Field label={t.nodeId} value={activeNode.id} change={value=>mutate(draft=>{const current=getNode(draft,activeNode.id)!;const nextId=slugify(value);if(!nextId||draft.nodes.some(item=>item.id===nextId&&item.id!==activeNode.id))return;current.id=nextId;draft.nodes.forEach(item=>{if(item.nextNode===activeNode.id)item.nextNode=nextId;item.outcomes?.forEach(outcome=>{if(outcome.nextNode===activeNode.id)outcome.nextNode=nextId})});if(draft.startNode===activeNode.id)draft.startNode=nextId})}/>
   <label>{t.type}<select value={activeNode.type} onChange={event=>mutate(draft=>{getNode(draft,activeNode.id)!.type=event.target.value as NodeType})}>{nodeTypesList.map(type=><option key={type} value={type}>{nodeTypeLabel(type,t)}</option>)}</select></label>
   <Field label={t.title} value={localize(activeNode.title,lang)} change={value=>mutate(draft=>{getNode(draft,activeNode.id)!.title=setText(activeNode.title,value)})}/>
   <label>{t.body}<textarea rows={3} value={localize(activeNode.body,lang)} onChange={event=>mutate(draft=>{getNode(draft,activeNode.id)!.body=setText(activeNode.body,event.target.value)})}/></label>
   {(activeNode.type==='command'||activeNode.command!=null)&&<><label>{t.command}<textarea rows={3} value={activeNode.command??''} onChange={event=>mutate(draft=>{getNode(draft,activeNode.id)!.command=event.target.value})}/></label><Field label={t.expectedResult} value={localize(activeNode.expectedResult,lang)} change={value=>mutate(draft=>{getNode(draft,activeNode.id)!.expectedResult=setText(activeNode.expectedResult,value)})}/><label className="check"><input type="checkbox" checked={activeNode.destructive??false} onChange={event=>mutate(draft=>{getNode(draft,activeNode.id)!.destructive=event.target.checked})}/> {t.destructive}</label></>}
  </div>
  {activeNode.type==='troubleshooting'&&<TroubleshootingFields node={activeNode} lang={lang} t={t} mutate={mutate} active={activeNode.id} setText={setText}/>}
  <datalist id="node-options">{book.nodes.map(node=><option key={node.id} value={node.id}>{localize(node.title,lang)}</option>)}</datalist>
 </>;
}

function toFlowElements(book:Runbook,active:string,selectedEdge:SelectedEdge|undefined,lang:Language,t:Record<string,string>,openAddKey:string|undefined,onSelect:(id:string)=>void,onToggleAdd:(key?:string)=>void,onAdd:(sourceId:string,type:NodeType,outcomeId?:string)=>void,onAddOutcome:(sourceId:string)=>void,onInsert:(sourceId:string,targetId:string,outcomeId?:string)=>void,onSelectEdge:(edge:SelectedEdge)=>void){
 const layout=layoutRunbook(book,isMobileLayout());
 const links=flowLinks(book);
 const nodes:FlowNode[]=book.nodes.map(node=>({id:node.id,type:'runbook',position:{x:node.ui?.x??layout[node.id]?.x??0,y:node.ui?.y??layout[node.id]?.y??0},data:{node,isStart:node.id===book.startNode,isActive:node.id===active,label:localize(node.title,lang),body:localize(node.body,lang),t,lang,openAddKey,selected:node.id===active,onSelect,onToggleAdd,onAdd,onAddOutcome}}));
 const edges:InsertEdge[]=links.map(link=>{const selected=selectedEdge?.sourceId===link.source&&selectedEdge.targetId===link.target&&selectedEdge.outcomeId===link.outcomeId;return {id:`${link.source}-${link.outcomeId??'next'}-${link.target}`,source:link.source,target:link.target,sourceHandle:link.outcomeId?`outcome:${link.outcomeId}`:'next',targetHandle:'in',type:'insert',label:link.label,data:{label:link.label,sourceId:link.source,targetId:link.target,outcomeId:link.outcomeId,selected,onInsert,onSelect:onSelectEdge},markerEnd:{type:MarkerType.ArrowClosed},style:{strokeWidth:selected?3:2}}});
 return {nodes,edges};
}

function flowLinks(book:Runbook):FlowLink[]{return book.nodes.flatMap(node=>{const next=node.nextNode?[{source:node.id,target:node.nextNode,label:'',outcomeId:undefined as string|undefined}]:[];const outcomes=(node.outcomes??[]).filter(outcome=>outcome.nextNode).map(outcome=>({source:node.id,target:outcome.nextNode!,label:localize(outcome.label,'es')||outcome.id,outcomeId:outcome.id}));return [...next,...outcomes]})}

function layoutRunbook(book:Runbook,vertical:boolean){
 const graph=new dagre.graphlib.Graph();
 graph.setDefaultEdgeLabel(()=>({}));
 graph.setGraph({rankdir:vertical?'TB':'LR',nodesep:70,ranksep:120,edgesep:35,acyclicer:'greedy'});
 book.nodes.forEach(node=>graph.setNode(node.id,{width:260,height:150}));
 flowLinks(book).forEach(link=>graph.setEdge(link.source,link.target));
 dagre.layout(graph);
 const positions:Record<string,{x:number;y:number}>={};
 book.nodes.forEach((node,index)=>{const positioned=graph.node(node.id);positions[node.id]=positioned?{x:Math.round(positioned.x-130),y:Math.round(positioned.y-75)}:{x:index*320,y:0}});
 return positions;
}

function findFreePosition(book:Runbook){
 const occupied=book.nodes.map(node=>node.ui).filter(Boolean) as {x:number;y:number}[];
 if(!occupied.length)return {x:0,y:0};
 const maxX=Math.max(...occupied.map(pos=>pos.x));
 const rows=new Set(occupied.filter(pos=>pos.x>maxX-120).map(pos=>Math.round(pos.y/180)));
 let row=0;while(rows.has(row))row++;
 return {x:maxX+330,y:row*180};
}

function isMobileLayout(){return typeof matchMedia==='function'&&matchMedia('(max-width: 760px)').matches}

const FlowNodeCard=memo(function FlowNodeCard({data}:NodeProps<FlowNode>){
 const node=data.node;
 const nodeKey=`node:${node.id}`;
 return <div className={data.isActive?'flow-card active':'flow-card'} onClick={()=>data.onSelect(node.id)}>
  <Handle id="in" type="target" position={Position.Left}/>
  <Handle id="next" className={data.isActive?'visible-handle':''} type="source" position={Position.Right}/>
  <div className="flow-card-head"><span>{data.isStart?'START':node.type}</span><button title={data.t.edit} aria-label={data.t.edit} onClick={event=>{event.stopPropagation();data.onSelect(node.id)}}><Edit3 size={14}/></button></div>
  <h3>{data.label||data.t.node}</h3>
  {data.body&&<p>{data.body}</p>}
  {node.command&&<code>{node.command}</code>}
  <div className="node-outcome-row">{(node.outcomes??[]).map(outcome=>{const key=`outcome:${node.id}:${outcome.id}`;return <div key={outcome.id} className="outcome-branch"><span>{localize(outcome.label,data.lang)}</span><Handle id={`outcome:${outcome.id}`} className={data.isActive?'visible-handle outcome-handle':''} type="source" position={Position.Right}/><button title={data.t.createNextNode} onClick={event=>{event.stopPropagation();data.onToggleAdd(data.openAddKey===key?undefined:key)}}><Plus size={14}/></button>{data.openAddKey===key&&<NodeAddMenu sourceId={node.id} outcomeId={outcome.id} add={data.onAdd} t={data.t}/>}</div>})}</div>
  <div className="node-plus"><button title={data.t.insertAfter} onClick={event=>{event.stopPropagation();data.onToggleAdd(data.openAddKey===nodeKey?undefined:nodeKey)}}><Plus size={15}/></button><button onClick={event=>{event.stopPropagation();data.onAddOutcome(node.id)}}>{data.t.addOutcome}</button>{data.openAddKey===nodeKey&&<NodeAddMenu sourceId={node.id} add={data.onAdd} t={data.t}/>}</div>
 </div>;
});

function NodeAddMenu({sourceId,outcomeId,add,t}:{sourceId:string;outcomeId?:string;add:(sourceId:string,type:NodeType,outcomeId?:string)=>void;t:Record<string,string>}){return <div className="node-add-menu">{nodeTypesList.map(type=><button key={type} onClick={event=>{event.stopPropagation();add(sourceId,type,outcomeId)}}>{nodeTypeLabel(type,t)}</button>)}</div>}

function InsertEdgeButton(props:EdgeProps<InsertEdge>){
 const [edgePath,labelX,labelY]=getSmoothStepPath({...props,borderRadius:14,offset:24});
 const edge={sourceId:props.data?.sourceId??props.source,targetId:props.data?.targetId??props.target,outcomeId:props.data?.outcomeId,label:props.data?.label??''};
 return <><BaseEdge path={edgePath} markerEnd={props.markerEnd} style={props.style}/><EdgeLabelRenderer><div className={props.data?.selected?'edge-tools selected':'edge-tools'} style={{transform:`translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`}}><button title={props.data?.label||'Connection'} onClick={event=>{event.stopPropagation();props.data?.onSelect(edge)}}>{props.data?.label||<Scissors size={13}/>}</button><button title="Insert" onClick={event=>{event.stopPropagation();props.data?.onInsert(edge.sourceId,edge.targetId,edge.outcomeId)}}><Plus size={13}/></button></div></EdgeLabelRenderer></>;
}

function Field({label,value,change}:{label:string;value:string;change:(value:string)=>void}){return <label>{label}<input value={value} onChange={event=>change(event.target.value)}/></label>}

function TroubleshootingFields({node,lang,t,mutate,active,setText}:{node:RunbookNode;lang:Language;t:Record<string,string>;mutate:(fn:(draft:Runbook)=>void)=>void;active:string;setText:(value:LocalizedString|undefined,nextValue:string)=>LocalizedString}){
 const listValue=(field:DraftNodeField)=>(node[field]??[]).map(item=>localize(item,lang)).join('\n');
 const textListChange=(field:DraftNodeField,value:string)=>mutate(draft=>{getNode(draft,active)![field]=toLines(value).map(item=>localized(item,lang))});
 return <div className="troubleshooting-fields form-grid"><label>{t.symptoms}<textarea rows={3} value={listValue('symptoms')} onChange={event=>textListChange('symptoms',event.target.value)}/></label><label>{t.errorMessages}<textarea rows={3} value={(node.errorMessages??[]).join('\n')} onChange={event=>mutate(draft=>{getNode(draft,active)!.errorMessages=toLines(event.target.value)})}/></label><label>{t.aliases}<textarea rows={3} value={listValue('aliases')} onChange={event=>textListChange('aliases',event.target.value)}/></label><label>{t.keywords}<input value={(node.keywords??[]).join(', ')} onChange={event=>mutate(draft=>{getNode(draft,active)!.keywords=splitList(event.target.value)})}/></label><label>{t.tags}<input value={(node.tags??[]).join(', ')} onChange={event=>mutate(draft=>{getNode(draft,active)!.tags=splitList(event.target.value)})}/></label><label>{t.possibleCause}<textarea rows={2} value={localize(node.cause,lang)} onChange={event=>mutate(draft=>{getNode(draft,active)!.cause=setText(getNode(draft,active)!.cause,event.target.value)})}/></label></div>;
}

function OutcomeRow({outcome,nodes,lang,t,change,remove,createNode}:{outcome:Outcome;nodes:RunbookNode[];lang:Language;t:Record<string,string>;change:(outcome:Outcome)=>void;remove:()=>void;createNode:()=>void}){
 const setOutcomeText=(value:LocalizedString|undefined,nextValue:string):LocalizedString=>typeof value==='string'?{es:lang==='es'?nextValue:value,en:lang==='en'?nextValue:value}:{...value,[lang]:nextValue};
 return <div className="outcome-edit"><input aria-label="Outcome label" value={localize(outcome.label,lang)} onChange={event=>change({...outcome,label:setOutcomeText(outcome.label,event.target.value)})}/><select aria-label="Next node" value={outcome.nextNode??''} onChange={event=>change({...outcome,nextNode:event.target.value||undefined})}><option value="">{t.end}</option>{nodes.map(node=><option key={node.id} value={node.id}>{localize(node.title,lang)}</option>)}</select><button onClick={createNode}>{t.createNextNode}</button><button className="danger" onClick={remove}>x</button></div>;
}

function MediaEditor({media,lang,t,change}:{media:Media[];lang:Language;t:Record<string,string>;change:(media:Media[])=>void}){
 const empty=(type:MediaType):Media=>({type,url:'',alt:localized('',lang),caption:localized('',lang)});
 const update=(index:number,next:Media)=>change(media.map((item,itemIndex)=>itemIndex===index?next:item));
 const localizedChange=(value:LocalizedString|undefined,nextValue:string):LocalizedString=>typeof value==='string'?{es:lang==='es'?nextValue:value,en:lang==='en'?nextValue:value}:{...value,[lang]:nextValue};
 const move=(index:number,dir:number)=>{const target=index+dir;if(target<0||target>=media.length)return;const next=[...media];[next[index],next[target]]=[next[target],next[index]];change(next)};
 return <section className="media-editor"><h3>{t.multimedia}</h3><div className="media-add">{mediaTypes.map(type=><button key={type} onClick={()=>change([...media,empty(type)])}>{type==='image'?<ImageIcon size={15}/>:type==='video'?<Video size={15}/>:<LinkIcon size={15}/>} {mediaTypeLabel(type,t)}</button>)}</div>{media.map((item,index)=><div className="media-row" key={`${item.type}-${index}`}><label>{t.type}<select value={item.type} onChange={event=>update(index,{...item,type:event.target.value as MediaType})}>{mediaTypes.map(type=><option key={type} value={type}>{mediaTypeLabel(type,t)}</option>)}</select></label><Field label={t.url} value={item.url} change={value=>update(index,{...item,url:value})}/><Field label={t.mediaTitle} value={localize(item.title,lang)} change={value=>update(index,{...item,title:localizedChange(item.title,value)})}/><Field label={t.caption} value={localize(item.caption,lang)} change={value=>update(index,{...item,caption:localizedChange(item.caption,value)})}/><Field label={t.alt} value={localize(item.alt,lang)} change={value=>update(index,{...item,alt:localizedChange(item.alt,value)})}/><label>{t.description}<textarea rows={2} value={localize(item.description,lang)} onChange={event=>update(index,{...item,description:localizedChange(item.description,event.target.value)})}/></label><div className="media-preview"><MediaView node={{id:'preview',type:'multimedia',title:'',media:[item]}} lang={lang}/></div><div className="media-actions"><button title={t.moveUp} onClick={()=>move(index,-1)}><ArrowUpFromDot size={15}/></button><button title={t.moveDown} onClick={()=>move(index,1)}><ArrowDownToDot size={15}/></button><button className="danger" onClick={()=>change(media.filter((_,itemIndex)=>itemIndex!==index))}><Trash2 size={15}/></button></div></div>)}</section>;
}

function QuickNodeEditModal({book,node,close,save,lang,t}:{book:Runbook;node:RunbookNode;close:()=>void;save:(book:Runbook)=>void;lang:Language;t:Record<string,string>}){
 const [draft,setDraft]=useState(()=>clone(node));
 const setText=(value:LocalizedString|undefined,nextValue:string):LocalizedString=>typeof value==='string'?{es:lang==='es'?nextValue:value,en:lang==='en'?nextValue:value}:{...value,[lang]:nextValue};
 const apply=()=>{const next=clone(book);next.nodes=next.nodes.map(item=>item.id===node.id?draft:item);next.metadata={...next.metadata,updatedAt:new Date().toISOString()};save(next);close()};
 return <div className="modal" role="dialog" aria-modal="true"><section><button className="close" onClick={close}>x</button><p className="eyebrow">{t.quickEdit}</p><h2>{localize(draft.title,lang)}</h2><div className="form-grid"><Field label={t.title} value={localize(draft.title,lang)} change={value=>setDraft(item=>({...item,title:setText(item.title,value)}))}/><label>{t.body}<textarea rows={4} value={localize(draft.body,lang)} onChange={event=>setDraft(item=>({...item,body:setText(item.body,event.target.value)}))}/></label><label>{t.command}<textarea rows={3} value={draft.command??''} onChange={event=>setDraft(item=>({...item,command:event.target.value}))}/></label><Field label={t.expectedResult} value={localize(draft.expectedResult,lang)} change={value=>setDraft(item=>({...item,expectedResult:setText(item.expectedResult,value)}))}/></div><h3>{t.outcomes}</h3>{draft.outcomes?.map((outcome,index)=><OutcomeRow key={outcome.id} outcome={outcome} nodes={book.nodes} lang={lang} t={t} change={next=>setDraft(item=>({...item,outcomes:item.outcomes?.map((old,oldIndex)=>oldIndex===index?next:old)}))} remove={()=>setDraft(item=>({...item,outcomes:item.outcomes?.filter((_,oldIndex)=>oldIndex!==index)}))} createNode={()=>{}}/>)}<button onClick={()=>setDraft(item=>({...item,outcomes:[...(item.outcomes??[]),{id:`outcome-${(item.outcomes?.length??0)+1}`,label:localized(t.addOutcome,lang)}]}))}>{t.addOutcome}</button><MediaEditor media={draft.media??[]} lang={lang} t={t} change={media=>setDraft(item=>({...item,media}))}/><button className="primary wide" onClick={apply}>{t.save}</button></section></div>;
}

function MobileCards({book,active,setActive,lang,t,addAfter,addOutcome,insertBefore,remove}:{book:Runbook;active:string;setActive:(id:string)=>void;lang:Language;t:Record<string,string>;addAfter:(sourceId:string,type:NodeType,outcomeId?:string)=>void;addOutcome:(sourceId:string)=>void;insertBefore:()=>void;remove:()=>void}){
 const [collapsed,setCollapsed]=useState<Set<string>>(()=>new Set());
 const links=flowLinks(book);
 const children=(id:string)=>links.filter(link=>link.source===id);
 const render=(id:string,depth=0,seen=new Set<string>())=>{
  const node=getNode(book,id);
  if(!node||seen.has(id))return null;
  const isCollapsed=collapsed.has(id);
  const nextSeen=new Set(seen).add(id);
  return <div className={active===id?'mobile-node-card active':'mobile-node-card'} key={id} style={{'--depth':depth} as React.CSSProperties} onClick={()=>setActive(id)}>
   <div className="mobile-node-head"><span>{node.type}</span><button onClick={event=>{event.stopPropagation();setCollapsed(items=>{const next=new Set(items);if(next.has(id))next.delete(id);else next.add(id);return next})}}>{isCollapsed?'+':'-'}</button></div>
   <h3>{localize(node.title,lang)}</h3>{node.body&&<p>{localize(node.body,lang)}</p>}<MediaView node={node} lang={lang}/>
   <div className="mobile-card-actions"><button onClick={event=>{event.stopPropagation();addAfter(id,'action')}}>{t.addNext}</button><button onClick={event=>{event.stopPropagation();addOutcome(id)}}>{t.addOutcome}</button><button onClick={event=>{event.stopPropagation();insertBefore()}}>{t.insertBefore}</button><button className="danger" onClick={event=>{event.stopPropagation();remove()}}>{t.delete}</button></div>
   {!isCollapsed&&children(id).map(link=><div className="mobile-branch" key={`${link.source}-${link.outcomeId??'next'}-${link.target}`}><button onClick={event=>{event.stopPropagation();setActive(link.target)}}>{link.label||t.continue}</button>{render(link.target,depth+1,nextSeen)}</div>)}
  </div>;
 };
 return <section className="cards-surface">{render(book.startNode)}{book.nodes.filter(node=>!links.some(link=>link.target===node.id)&&node.id!==book.startNode).map(node=>render(node.id))}</section>;
}

function FolderDeleteModal({intent,close,apply,t}:{intent:DeleteFolderIntent;close:()=>void;apply:(deleteContents:boolean)=>void;t:Record<string,string>}){
 return <div className="modal" role="dialog" aria-modal="true"><section className="compact-modal"><button className="close" onClick={close}>x</button><p className="eyebrow">{t.deleteFolder}</p><h2>{t.deleteFolderTitle}: {intent.folder.name}</h2><p>{intent.count} {t.procedures.toLowerCase()}</p><div className="modal-actions"><button onClick={close}>{t.cancel}</button><button onClick={()=>apply(false)}>{t.moveToNoFolder}</button><button className="danger" onClick={()=>apply(true)}>{t.deleteFolderAndContent}</button></div></section></div>;
}

function MoveFolderModal({moving,folders,folderPaths,close,apply,t}:{moving:MoveMenu;folders:FolderItem[];folderPaths:Map<string,string>;close:()=>void;apply:(bookId:string,folder:string)=>void;t:Record<string,string>}){
 const [folder,setFolder]=useState(moving.folder);
 return <div className="modal" role="dialog" aria-modal="true"><section className="compact-modal"><button className="close" onClick={close}>x</button><p className="eyebrow">{t.moveFolder}</p><h2>{t.moveFolder}</h2><label>{t.folder}<input list="move-folder-options" value={folder} onChange={event=>setFolder(event.target.value)}/><datalist id="move-folder-options">{folders.map(item=><option key={item.id} value={folderPaths.get(item.id)??item.name}/>)}</datalist></label><button className="primary wide" onClick={()=>apply(moving.bookId,folder)}>{t.move}</button></section></div>;
}

import {useEffect,useMemo,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Image,Link,Plus,Save,Trash2,Video} from 'lucide-react';
import type {Language,LocalizedString,Media,MediaType,NodeType,Runbook} from './types';
import {localize,localized} from './lib/runbook';
import {insertLinearStep,moveLinearStep,procedureOrder,removeStep,uniqueNodeId} from './lib/procedure';

type Props={initial:Runbook;startAt?:string;lang:Language;onSave:(book:Runbook)=>void|Promise<void>;onExit:()=>void};
const types:NodeType[]=['action','check','command','warning','note','solution','multimedia','question','troubleshooting','visual-identification'];
const setLocalized=(current:LocalizedString|undefined,value:string,lang:Language):LocalizedString=>typeof current==='string'?localized(value,lang):{...current,[lang]:value};

export default function ProcedureEditor({initial,startAt,lang,onSave,onExit}:Props){
 const draftKey=`tech-runbook.draft.${initial.id}`;
 const [book,setBook]=useState<Runbook>(()=>{try{return JSON.parse(localStorage.getItem(draftKey)??'null')||structuredClone(initial)}catch{return structuredClone(initial)}});
 const [active,setActive]=useState(startAt&&book.nodes.some(node=>node.id===startAt)?startAt:book.startNode);
 const [status,setStatus]=useState<'saved'|'dirty'|'saving'|'error'>('saved');
 const [error,setError]=useState('');
 const saveTimer=useRef<number|undefined>(undefined);
 const order=useMemo(()=>procedureOrder(book),[book]);
 const index=Math.max(0,order.findIndex(node=>node.id===active));
 const node=order[index]??order[0];

 const change=(next:Runbook)=>{setBook(next);setStatus('dirty');localStorage.setItem(draftKey,JSON.stringify(next))};
 const patchNode=(patch:Record<string,unknown>)=>change({...book,nodes:book.nodes.map(item=>item.id===node.id?{...item,...patch}:item)});
 const save=async(value=book)=>{
  window.clearTimeout(saveTimer.current);setStatus('saving');setError('');
  const payload={...value,metadata:{...value.metadata,updatedAt:new Date().toISOString()}};
  try{await onSave(payload);setBook(payload);localStorage.removeItem(draftKey);setStatus('saved')}
  catch(reason){setStatus('error');setError(reason instanceof Error?reason.message:'No se pudo guardar')}
 };
 useEffect(()=>{if(status!=='dirty')return;saveTimer.current=window.setTimeout(()=>void save(book),1200);return()=>window.clearTimeout(saveTimer.current)},[book,status]); // eslint-disable-line react-hooks/exhaustive-deps
 const add=()=>{const id=uniqueNodeId(book);const next=insertLinearStep(book,node.id,{id,type:'action',title:localized(lang==='es'?'Nuevo paso':'New step',lang),body:localized('',lang)});change(next);setActive(id)};
 const remove=()=>{if(node.id===book.startNode)return;const previous=order[Math.max(0,index-1)].id;change(removeStep(book,node.id));setActive(previous)};
 const move=(direction:-1|1)=>{const moved=moveLinearStep(book,node.id,direction);change(moved);setActive(node.id)};
 if(!node)return null;
 return <main className="procedure-editor">
  <header className="procedure-header"><button onClick={onExit}><ChevronLeft size={18}/> Biblioteca</button><div><span className="eyebrow">PROCEDIMIENTO</span><input aria-label="Título del procedimiento" value={localize(book.title,lang)} onChange={event=>change({...book,title:setLocalized(book.title,event.target.value,lang)})}/></div><button className="primary" onClick={()=>void save()}><Save size={17}/> Guardar</button></header>
  <div className="procedure-layout">
   <aside className="procedure-outline"><div><b>Estructura</b><span>{order.length} pasos</span></div>{order.map((item,i)=><button key={item.id} className={item.id===node.id?'active':''} onClick={()=>setActive(item.id)}><small>{i===0?'INICIO':String(i).padStart(2,'0')}</small><span>{localize(item.title,lang)||item.id}</span></button>)}<button className="add-outline" onClick={add}><Plus size={16}/> Añadir paso</button></aside>
   <section className="step-workspace">
    <nav className="step-pager"><button disabled={index===0} onClick={()=>setActive(order[index-1].id)}><ChevronLeft/></button><span>Paso {index+1} de {order.length}</span><button disabled={index===order.length-1} onClick={()=>setActive(order[index+1].id)}><ChevronRight/></button></nav>
    <article className="step-editor-card"><div className="step-editor-heading"><div><span className="step-number">{index===0?'Start':`Paso ${index}`}</span><h1>{localize(node.title,lang)||node.id}</h1></div><select aria-label="Tipo de paso" value={node.type} onChange={event=>patchNode({type:event.target.value as NodeType})}>{types.map(type=><option key={type}>{type}</option>)}</select></div>
     <label>Título<input value={localize(node.title,lang)} onChange={event=>patchNode({title:setLocalized(node.title,event.target.value,lang)})}/></label>
     <label>Instrucciones<textarea rows={6} value={localize(node.body,lang)} onChange={event=>patchNode({body:setLocalized(node.body,event.target.value,lang)})} placeholder="Explica qué hacer y cómo comprobarlo…"/></label>
     {(node.type==='command'||node.command!==undefined)&&<><label>Comando<textarea rows={3} value={node.command??''} onChange={event=>patchNode({command:event.target.value})}/></label><label>Resultado esperado<input value={localize(node.expectedResult,lang)} onChange={event=>patchNode({expectedResult:setLocalized(node.expectedResult,event.target.value,lang)})}/></label></>}
     <MediaFields media={node.media??[]} lang={lang} change={media=>patchNode({media})}/>
     <div className="step-actions"><button disabled={index<=1} onClick={()=>move(-1)}>Mover antes</button><button disabled={index===0||index===order.length-1} onClick={()=>move(1)}>Mover después</button><button className="danger" disabled={index===0} onClick={remove}><Trash2 size={16}/> Eliminar</button><button className="primary" onClick={add}><Plus size={16}/> Siguiente paso</button></div>
    </article>
   </section>
   <aside className="procedure-context"><b>Estado</b><p className={`save-state ${status}`}>{status==='saved'?'Todo guardado':status==='saving'?'Guardando…':status==='dirty'?'Cambios sin guardar':'Error al guardar'}</p>{error&&<p className="errors">{error}</p>}<p>Los cambios se guardan automáticamente. El borrador local permanece hasta que el servidor confirma el guardado.</p><hr/><b>Compatibilidad</b><p>Las ramas y subpasos existentes se conservan en el documento y en la API.</p></aside>
  </div>
 </main>;
}

function MediaFields({media,lang,change}:{media:Media[];lang:Language;change:(media:Media[])=>void}){
 const add=(type:MediaType)=>change([...media,{type,url:'',alt:localized('',lang)}]);
 const upload=async(index:number,file?:File)=>{if(!file)return;const data=new FormData();data.append('file',file);const response=await fetch('/api/uploads',{method:'POST',credentials:'include',body:data});const result=await response.json() as {url?:string;message?:string};if(!response.ok||!result.url)throw new Error(result.message??'Upload failed');change(media.map((value,i)=>i===index?{...value,url:result.url!}:value))};
 return <details className="media-block" open={media.length>0}><summary>Multimedia <span>{media.length}</span></summary>{media.map((item,index)=><div className="media-row" key={index}>{item.type==='image'?<Image/>:item.type==='video'?<Video/>:<Link/>}<select value={item.type} onChange={event=>change(media.map((value,i)=>i===index?{...value,type:event.target.value as MediaType}:value))}><option>image</option><option>video</option><option>youtube</option><option>link</option></select><input aria-label={`URL multimedia ${index+1}`} placeholder="https:// o /uploads/…" value={item.url} onChange={event=>change(media.map((value,i)=>i===index?{...value,url:event.target.value}:value))}/><button aria-label="Eliminar multimedia" onClick={()=>change(media.filter((_,i)=>i!==index))}><Trash2 size={15}/></button>{(item.type==='image'||item.type==='video')&&<label className="media-upload">Subir archivo<input aria-label={`Subir multimedia ${index+1}`} type="file" accept={item.type==='image'?'image/*':'video/*'} onChange={event=>void upload(index,event.target.files?.[0])}/></label>}</div>)}<div className="media-add"><button onClick={()=>add('image')}><Image size={16}/> Imagen</button><button onClick={()=>add('video')}><Video size={16}/> Vídeo</button><button onClick={()=>add('link')}><Link size={16}/> Enlace</button></div></details>;
}

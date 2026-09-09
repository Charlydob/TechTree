import {useEffect,useMemo,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Image,Link,Mic,Pause,Play,Plus,Save,Square,Trash2,Video} from 'lucide-react';
import type {Language,LocalizedString,Media,NodeType,Runbook} from './types';
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
 const pendingDeletes=useRef(new Set<string>());
 const order=useMemo(()=>procedureOrder(book),[book]);
 const index=Math.max(0,order.findIndex(node=>node.id===active));
 const node=order[index]??order[0];

 const change=(next:Runbook)=>{setBook(next);setStatus('dirty');localStorage.setItem(draftKey,JSON.stringify(next))};
 const patchNode=(patch:Record<string,unknown>)=>change({...book,nodes:book.nodes.map(item=>item.id===node.id?{...item,...patch}:item)});
 const save=async(value=book)=>{
  window.clearTimeout(saveTimer.current);setStatus('saving');setError('');
  const payload={...value,metadata:{...value.metadata,updatedAt:new Date().toISOString()}};
  try{await onSave(payload);setBook(payload);localStorage.removeItem(draftKey);setStatus('saved');for(const url of pendingDeletes.current){void deleteUpload(url);pendingDeletes.current.delete(url)}}
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
     <MediaFields media={node.media??[]} lang={lang} change={media=>patchNode({media})} removed={url=>pendingDeletes.current.add(url)}/>
     <div className="step-actions"><button disabled={index<=1} onClick={()=>move(-1)}>Mover antes</button><button disabled={index===0||index===order.length-1} onClick={()=>move(1)}>Mover después</button><button className="danger" disabled={index===0} onClick={remove}><Trash2 size={16}/> Eliminar</button><button className="primary" onClick={add}><Plus size={16}/> Siguiente paso</button></div>
    </article>
   </section>
   <aside className="procedure-context"><b>Estado</b><p className={`save-state ${status}`}>{status==='saved'?'Todo guardado':status==='saving'?'Guardando…':status==='dirty'?'Cambios sin guardar':'Error al guardar'}</p>{error&&<p className="errors">{error}</p>}<p>Los cambios se guardan automáticamente. El borrador local permanece hasta que el servidor confirma el guardado.</p><hr/><b>Compatibilidad</b><p>Las ramas y subpasos existentes se conservan en el documento y en la API.</p></aside>
  </div>
 </main>;
}

function deleteUpload(url:string){const filename=url.match(/^\/uploads\/([^/]+)$/)?.[1];return filename?fetch(`/api/uploads/${encodeURIComponent(filename)}`,{method:'DELETE',credentials:'include'}):Promise.resolve()}

type Uploaded={id:string;url:string;type:'image'|'audio'|'video';filename:string;size:number;mimeType:string;createdAt:string};
function sendUpload(file:File,onProgress:(value:number)=>void){const form=new FormData();form.append('file',file);if(typeof XMLHttpRequest==='undefined')return fetch('/api/uploads',{method:'POST',credentials:'include',body:form}).then(async response=>{const body=await response.json() as Uploaded&{message?:string};if(!response.ok)throw new Error(body.message??`Error de subida (${response.status})`);onProgress(100);return body});return new Promise<Uploaded>((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('POST','/api/uploads');xhr.withCredentials=true;xhr.upload.onprogress=event=>event.lengthComputable&&onProgress(Math.round(event.loaded/event.total*100));xhr.onerror=()=>reject(new Error('Se perdió la conexión durante la subida.'));xhr.onload=()=>{let body:Uploaded&{message?:string};try{body=JSON.parse(xhr.responseText)}catch{reject(new Error('Respuesta de subida no válida.'));return}if(xhr.status<200||xhr.status>=300)reject(new Error(body.message??`Error de subida (${xhr.status})`));else resolve(body)};xhr.send(form)})}
const formatTime=(seconds:number)=>{const value=Math.max(0,Math.floor(seconds||0));const h=Math.floor(value/3600),m=Math.floor(value%3600/60),s=value%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`};

function MediaFields({media,lang,change,removed}:{media:Media[];lang:Language;change:(media:Media[])=>void;removed:(url:string)=>void}){
 const [progress,setProgress]=useState<Record<string,number>>({});const [error,setError]=useState('');
 const addFiles=async(files:File[])=>{setError('');let working=latest.current;for(const file of files){const key=`${file.name}-${file.lastModified}`;try{const uploaded=await sendUpload(file,value=>setProgress(old=>({...old,[key]:value})));working=[...working,{...uploaded,alt:localized(uploaded.filename,lang),audioMarkers:uploaded.type==='audio'?[]:undefined}];change(working)}catch(reason){setError(reason instanceof Error?reason.message:'No se pudo subir el archivo')}finally{setProgress(old=>{const next={...old};delete next[key];return next})}}};
 const latest=useRef(media);useEffect(()=>{latest.current=media},[media]);
 const remove=(index:number)=>{const item=media[index];if(item.url.startsWith('/uploads/'))removed(item.url);change(media.filter((_,i)=>i!==index))};
 return <details className="media-block" open><summary>Multimedia <span>{media.length}</span></summary>
  <div className="media-add"><label className="media-picker"><Image size={16}/> Fotos<input aria-label="Subir imágenes" type="file" accept="image/*" multiple onChange={event=>void addFiles([...event.target.files??[]])}/></label><label className="media-picker"><Video size={16}/> Vídeo<input aria-label="Subir vídeo" type="file" accept="video/*" capture="environment" onChange={event=>void addFiles([...event.target.files??[]])}/></label><label className="media-picker"><Mic size={16}/> Audio<input aria-label="Subir audio" type="file" accept="audio/*" onChange={event=>void addFiles([...event.target.files??[]])}/></label><AudioRecorder save={file=>addFiles([file])}/><button onClick={()=>change([...media,{type:'link',url:'',alt:localized('',lang)}])}><Link size={16}/> Enlace</button></div>
  {Object.entries(progress).map(([name,value])=><div className="upload-progress" key={name}><span>Subiendo {name}</span><progress value={value} max="100"/><b>{value}%</b></div>)}{error&&<p className="errors">{error}</p>}
  <div className="media-gallery">{media.map((item,index)=><article className={`media-item ${item.type}`} key={item.id??`${item.url}-${index}`}><button className="media-delete" aria-label={`Eliminar ${item.filename??'multimedia'}`} onClick={()=>remove(index)}><Trash2 size={16}/></button>{item.type==='image'&&<a href={item.url} target="_blank" rel="noreferrer"><img src={item.url} alt={localize(item.alt,lang)}/></a>}{item.type==='video'&&<video src={item.url} controls preload="metadata"/>}{item.type==='audio'&&<AudioEditor item={item} update={next=>change(media.map((old,i)=>i===index?next:old))}/>} {(item.type==='link'||item.type==='youtube')&&<input aria-label={`URL multimedia ${index+1}`} value={item.url} placeholder="https://…" onChange={event=>change(media.map((old,i)=>i===index?{...old,url:event.target.value}:old))}/>}<strong>{item.filename??localize(item.title,lang)}</strong>{item.size!=null&&<small>{(item.size/1024/1024).toFixed(1)} MB</small>}</article>)}</div>
 </details>;
}

function AudioEditor({item,update}:{item:Media;update:(item:Media)=>void}){const audio=useRef<HTMLAudioElement>(null);const [time,setTime]=useState(0);const markers=[...(item.audioMarkers??[])].sort((a,b)=>a.time-b.time);const add=()=>{const title=window.prompt('Título del marcador');if(!title?.trim())return;update({...item,audioMarkers:[...markers,{id:crypto.randomUUID(),time:audio.current?.currentTime??time,title:title.trim()}].sort((a,b)=>a.time-b.time)})};return <div className="audio-editor"><audio ref={audio} src={item.url} controls preload="metadata" onTimeUpdate={event=>setTime(event.currentTarget.currentTime)} onLoadedMetadata={event=>{if(Number.isFinite(event.currentTarget.duration)&&event.currentTarget.duration!==item.duration)update({...item,duration:event.currentTarget.duration})}}/><div className="marker-head"><span>{formatTime(time)} / {formatTime(item.duration??0)}</span><button onClick={add}><Plus size={15}/> Añadir marcador</button></div><ol className="audio-markers">{markers.map(marker=><li key={marker.id}><button className="marker-jump" onClick={()=>{if(audio.current){audio.current.currentTime=marker.time;void audio.current.play()}}}>{formatTime(marker.time)} — {marker.title}</button><button aria-label="Editar marcador" onClick={()=>{const title=window.prompt('Título',marker.title);const raw=window.prompt('Tiempo (segundos)',String(marker.time));const value=Number(raw);if(title?.trim()&&Number.isFinite(value)&&value>=0)update({...item,audioMarkers:markers.map(old=>old.id===marker.id?{...old,title:title.trim(),time:value}:old).sort((a,b)=>a.time-b.time)})}}>Editar</button><button aria-label="Eliminar marcador" onClick={()=>update({...item,audioMarkers:markers.filter(old=>old.id!==marker.id)})}><Trash2 size={14}/></button></li>)}</ol></div>}

function AudioRecorder({save}:{save:(file:File)=>Promise<void>}){const [recorder,setRecorder]=useState<MediaRecorder>();const [recording,setRecording]=useState(false);const [preview,setPreview]=useState<{blob:Blob;url:string}>();const chunks=useRef<Blob[]>([]);const start=async()=>{const stream=await navigator.mediaDevices.getUserMedia({audio:true});const value=new MediaRecorder(stream);chunks.current=[];value.ondataavailable=event=>event.data.size&&chunks.current.push(event.data);value.onstop=()=>{const blob=new Blob(chunks.current,{type:value.mimeType||'audio/webm'});setPreview({blob,url:URL.createObjectURL(blob)});stream.getTracks().forEach(track=>track.stop())};value.start();setRecorder(value);setRecording(true)};const stop=()=>{recorder?.stop();setRecording(false)};if(!globalThis.MediaRecorder||!navigator.mediaDevices?.getUserMedia)return null;return <div className="recorder">{!recording&&!preview&&<button onClick={()=>void start()}><Mic size={16}/> Grabar</button>}{recording&&<><span className="recording-dot">Grabando</span>{recorder?.state==='recording'?<button onClick={()=>recorder.pause()}><Pause size={15}/> Pausar</button>:<button onClick={()=>recorder?.resume()}><Play size={15}/> Continuar</button>}<button onClick={stop}><Square size={15}/> Terminar</button></>}{preview&&<><audio controls src={preview.url}/><button onClick={()=>{URL.revokeObjectURL(preview.url);setPreview(undefined)}}>Cancelar</button><button className="primary" onClick={async()=>{await save(new File([preview.blob],`grabacion-${Date.now()}.webm`,{type:preview.blob.type}));URL.revokeObjectURL(preview.url);setPreview(undefined)}}>Guardar audio</button></>}</div>}

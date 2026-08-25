import type {Runbook} from '../types';
import {migrateRunbook} from './runbook';
const KEY='tech-runbook.library.v1'; const PROGRESS='tech-runbook.progress.v1'; const RECENTS='tech-runbook.recents.v1'; const LANG='tech-runbook.language.v1'; const THEME='tech-runbook.theme.v1'; const FOLDERS='tech-runbook.folders.v1'; const OPEN_FOLDERS='htde.open-folders.v1';
export interface RecentItem {id:string;bookId:string;nodeId?:string;query?:string;type:'search'|'resolved'|'procedure'|'step';label:string;at:string}
export interface FolderItem {id:string;name:string;parentId?:string;createdAt:string}
export function loadLibrary(fallback:Runbook[]):Runbook[]{try{const raw=localStorage.getItem(KEY);const books=raw?JSON.parse(raw):fallback;return (books as Runbook[]).map(migrateRunbook)}catch{return fallback.map(migrateRunbook)}}
export function saveLibrary(books:Runbook[]){localStorage.setItem(KEY,JSON.stringify(books))}
export function loadFolders(books:Runbook[]):FolderItem[]{try{const raw=localStorage.getItem(FOLDERS);const saved=raw?JSON.parse(raw) as FolderItem[]:[];return mergeFolders(saved,books)}catch{return mergeFolders([],books)}}
export function saveFolders(folders:FolderItem[]){localStorage.setItem(FOLDERS,JSON.stringify(folders))}
function mergeFolders(saved:FolderItem[],books:Runbook[]):FolderItem[]{
 const normalized=saved.map(folder=>({...folder,parentId:folder.parentId||undefined}));
 const paths=new Set(normalized.map(folderPathFactory(normalized)));
 const additions:FolderItem[]=[];
 const now=new Date().toISOString();
 for(const book of books){
  const path=(book.folder??book.category).split('/').map(part=>part.trim()).filter(Boolean);
  let parentId: string|undefined;
  let current='';
  for(const part of path){
   current=current?`${current}/${part}`:part;
   if(!paths.has(current)){
    const id=`folder-${Date.now()}-${Math.random().toString(36).slice(2,7)}-${part.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;
    additions.push({id,name:part,parentId,createdAt:now});
    paths.add(current);
    parentId=id;
   }else{
    parentId=[...normalized,...additions].find(item=>folderPath(item,[...normalized,...additions])===current)?.id;
   }
  }
 }
 return [...normalized,...additions];
}
function folderPathFactory(folders:FolderItem[]){return (folder:FolderItem)=>folderPath(folder,folders)}
export function folderPath(folder:FolderItem,folders:FolderItem[]):string{
 const parts=[folder.name]; let parent=folders.find(item=>item.id===folder.parentId); const seen=new Set([folder.id]);
 while(parent&&!seen.has(parent.id)){parts.unshift(parent.name);seen.add(parent.id);parent=folders.find(item=>item.id===parent?.parentId)}
 return parts.join('/');
}
export function loadProgress():Record<string,string[]>{try{return JSON.parse(localStorage.getItem(PROGRESS)||'{}')}catch{return{}}}
export function saveProgress(progress:Record<string,string[]>){localStorage.setItem(PROGRESS,JSON.stringify(progress))}
export function loadRecents():RecentItem[]{try{return JSON.parse(localStorage.getItem(RECENTS)||'[]')}catch{return[]}}
export function saveRecents(items:RecentItem[]){localStorage.setItem(RECENTS,JSON.stringify(items.slice(0,24)))}
export function getStoredLanguage(){return localStorage.getItem(LANG)==='en'?'en':'es'}
export function saveLanguage(lang:'es'|'en'){localStorage.setItem(LANG,lang)}
export function getStoredTheme(){return localStorage.getItem(THEME)}
export function saveTheme(dark:boolean){localStorage.setItem(THEME,dark?'dark':'light')}
export function loadOpenFolders():string[]{try{return JSON.parse(localStorage.getItem(OPEN_FOLDERS)||'[]')}catch{return[]}}
export function saveOpenFolders(ids:string[]){localStorage.setItem(OPEN_FOLDERS,JSON.stringify(ids))}

import type {Runbook} from '../types';
import {migrateRunbook} from './runbook';
export const LIBRARY_KEY='tech-runbook.library.v1'; export const PROGRESS='tech-runbook.progress.v1'; export const RECENTS='tech-runbook.recents.v1'; export const LANG='tech-runbook.language.v1'; export const THEME='tech-runbook.theme.v1'; export const FOLDERS_KEY='tech-runbook.folders.v1'; export const OPEN_FOLDERS='htde.open-folders.v1';
const PENDING='tech-runbook.pending-sync.v1'; const MIGRATION_DONE='tech-runbook.server-migration.v1';
export interface RecentItem {id:string;bookId:string;nodeId?:string;query?:string;type:'search'|'resolved'|'procedure'|'step';label:string;at:string}
export interface FolderItem {id:string;name:string;parentId?:string;createdAt:string}
export type PendingChange={id:string;type:'save';runbook:Runbook;expectedVersion?:number;createdAt:string}|{id:string;type:'delete';runbookId:string;expectedVersion?:number;createdAt:string}|{id:string;type:'folders';folders:FolderItem[];createdAt:string};
export function hasStoredLibrary(){return localStorage.getItem(LIBRARY_KEY)!==null}
export function loadLibrary(fallback:Runbook[]):Runbook[]{try{const raw=localStorage.getItem(LIBRARY_KEY);const books=raw?JSON.parse(raw):fallback;return (books as Runbook[]).map(migrateRunbook)}catch{return fallback.map(migrateRunbook)}}
export function saveLibrary(books:Runbook[]){localStorage.setItem(LIBRARY_KEY,JSON.stringify(books))}
export function loadFolders(books:Runbook[]):FolderItem[]{try{const raw=localStorage.getItem(FOLDERS_KEY);const saved=raw?JSON.parse(raw) as FolderItem[]:[];return mergeFolders(saved,books)}catch{return mergeFolders([],books)}}
export function saveFolders(folders:FolderItem[]){localStorage.setItem(FOLDERS_KEY,JSON.stringify(folders))}
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
export function loadPendingChanges():PendingChange[]{try{return JSON.parse(localStorage.getItem(PENDING)||'[]')}catch{return[]}}
export function savePendingChanges(items:PendingChange[]){localStorage.setItem(PENDING,JSON.stringify(items))}
export function hasCompletedServerMigration(){return localStorage.getItem(MIGRATION_DONE)==='done'}
export function markServerMigrationDone(){localStorage.setItem(MIGRATION_DONE,'done')}

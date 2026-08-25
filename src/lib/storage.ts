import type {Runbook} from '../types';
import {migrateRunbook} from './runbook';
const KEY='tech-runbook.library.v1'; const PROGRESS='tech-runbook.progress.v1'; const RECENTS='tech-runbook.recents.v1'; const LANG='tech-runbook.language.v1'; const THEME='tech-runbook.theme.v1'; const FOLDERS='tech-runbook.folders.v1';
export interface RecentItem {id:string;bookId:string;nodeId?:string;query?:string;type:'search'|'resolved'|'procedure'|'step';label:string;at:string}
export interface FolderItem {id:string;name:string;createdAt:string}
export function loadLibrary(fallback:Runbook[]):Runbook[]{try{const raw=localStorage.getItem(KEY);const books=raw?JSON.parse(raw):fallback;return (books as Runbook[]).map(migrateRunbook)}catch{return fallback.map(migrateRunbook)}}
export function saveLibrary(books:Runbook[]){localStorage.setItem(KEY,JSON.stringify(books))}
export function loadFolders(books:Runbook[]):FolderItem[]{try{const raw=localStorage.getItem(FOLDERS);const saved=raw?JSON.parse(raw) as FolderItem[]:[];return mergeFolders(saved,books)}catch{return mergeFolders([],books)}}
export function saveFolders(folders:FolderItem[]){localStorage.setItem(FOLDERS,JSON.stringify(folders))}
function mergeFolders(saved:FolderItem[],books:Runbook[]):FolderItem[]{
 const names=new Set(saved.map(folder=>folder.name));
 const inferred=books.map(book=>book.folder??book.category).filter(Boolean).filter(name=>!names.has(name));
 return [...saved,...inferred.map(name=>({id:`folder-${Date.now()}-${name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,name,createdAt:new Date().toISOString()}))];
}
export function loadProgress():Record<string,string[]>{try{return JSON.parse(localStorage.getItem(PROGRESS)||'{}')}catch{return{}}}
export function saveProgress(progress:Record<string,string[]>){localStorage.setItem(PROGRESS,JSON.stringify(progress))}
export function loadRecents():RecentItem[]{try{return JSON.parse(localStorage.getItem(RECENTS)||'[]')}catch{return[]}}
export function saveRecents(items:RecentItem[]){localStorage.setItem(RECENTS,JSON.stringify(items.slice(0,24)))}
export function getStoredLanguage(){return localStorage.getItem(LANG)==='en'?'en':'es'}
export function saveLanguage(lang:'es'|'en'){localStorage.setItem(LANG,lang)}
export function getStoredTheme(){return localStorage.getItem(THEME)}
export function saveTheme(dark:boolean){localStorage.setItem(THEME,dark?'dark':'light')}

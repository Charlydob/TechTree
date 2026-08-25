import type {Runbook} from '../types';
const KEY='tech-runbook.library.v1'; const PROGRESS='tech-runbook.progress.v1';
export function loadLibrary(fallback:Runbook[]):Runbook[]{try{const raw=localStorage.getItem(KEY);return raw?JSON.parse(raw):fallback}catch{return fallback}}
export function saveLibrary(books:Runbook[]){localStorage.setItem(KEY,JSON.stringify(books))}
export function loadProgress():Record<string,string[]>{try{return JSON.parse(localStorage.getItem(PROGRESS)||'{}')}catch{return{}}}
export function saveProgress(progress:Record<string,string[]>){localStorage.setItem(PROGRESS,JSON.stringify(progress))}

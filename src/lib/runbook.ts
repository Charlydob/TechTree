import type {Language,LocalizedString,Runbook,RunbookNode} from '../types';

export const languages:Language[]=['es','en'];

export function localize(value:LocalizedString|undefined,lang:Language,fallback:Language='en'):string{
 if(value==null)return '';
 if(typeof value==='string')return value;
 return value[lang]??value[fallback]??value.es??value.en??'';
}

export function localized(value:string,lang:Language):LocalizedString{
 return lang==='en'?{en:value,es:value}:{es:value,en:value};
}

export function localizedForBoth(es:string,en:string):LocalizedString{
 return {es,en};
}

export function slugify(value:string):string{
 const slug=value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
 return slug||`guia-${Date.now()}`;
}

export function splitList(value:string):string[]{
 return value.split(',').map(x=>x.trim()).filter(Boolean);
}

export function toLines(value:string):string[]{
 return value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
}

export function migrateRunbook(book:Runbook):Runbook{
 if(book.schemaVersion===2)return {...book,folder:book.folder??book.category,nodes:book.nodes.map(node=>({...node,ui:node.ui}))};
 return {
  ...book,
  schemaVersion:2,
  folder:book.folder??book.category,
  title:localizedForBoth(String(book.title),String(book.title)),
  description:localizedForBoth(String(book.description),String(book.description)),
  requirements:book.requirements?.map(x=>localizedForBoth(String(x),String(x))),
  nodes:book.nodes.map(migrateNode),
 };
}

function migrateNode(node:RunbookNode):RunbookNode{
 return {
  ...node,
  title:localizedForBoth(String(node.title),String(node.title)),
  body:node.body?localizedForBoth(String(node.body),String(node.body)):undefined,
  expectedResult:node.expectedResult?localizedForBoth(String(node.expectedResult),String(node.expectedResult)):undefined,
  outcomes:node.outcomes?.map(o=>({
   ...o,
   label:localizedForBoth(String(o.label),String(o.label)),
   description:o.description?localizedForBoth(String(o.description),String(o.description)):undefined,
  })),
 };
}

export function getNode(book:Runbook,id:string):RunbookNode|undefined{
 return book.nodes.find(node=>node.id===id);
}

export function collectLocalizedText(value:LocalizedString|undefined):string[]{
 if(!value)return [];
 if(typeof value==='string')return [value];
 return languages.map(lang=>value[lang]).filter(Boolean) as string[];
}

export function nodeSearchText(book:Runbook,node:RunbookNode):string{
 const fields=[
  ...collectLocalizedText(book.title),
  ...collectLocalizedText(book.description),
  book.category,
  ...book.tags,
  ...collectLocalizedText(node.title),
  ...collectLocalizedText(node.body),
  ...collectLocalizedText(node.expectedResult),
  ...(node.symptoms??[]).flatMap(collectLocalizedText),
  ...(node.aliases??[]).flatMap(collectLocalizedText),
  ...(node.errorMessages??[]),
  ...(node.keywords??[]),
  ...(node.tags??[]),
  node.command??'',
  node.cause?collectLocalizedText(node.cause).join(' '):'',
  node.finalSolution?collectLocalizedText(node.finalSolution).join(' '):'',
  ...(node.outcomes??[]).flatMap(o=>[...collectLocalizedText(o.label),...collectLocalizedText(o.description)]),
 ];
 return fields.filter(Boolean).join(' ');
}

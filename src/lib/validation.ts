import Ajv2020, {type ErrorObject} from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import schema from '../runbook.schema.json';
import type {Runbook} from '../types';
const ajv=new Ajv2020({allErrors:true,strict:true}); addFormats(ajv); const validateSchema=ajv.compile(schema);
export interface ValidationResult {valid:boolean;errors:string[];warnings:string[]}
const explain=(e:ErrorObject)=>`${e.instancePath||'/'}: ${e.message ?? 'invalid value'}`;
export function validateRunbook(value:unknown):ValidationResult{
 const schemaValid=validateSchema(value); const errors=schemaValid?[]:(validateSchema.errors??[]).map(explain); if(!schemaValid)return{valid:false,errors,warnings:[]};
 const book=value as Runbook; const ids=book.nodes.map(n=>n.id); const idSet=new Set(ids);
 ids.filter((id,i)=>ids.indexOf(id)!==i).forEach(id=>errors.push(`/nodes: duplicate node id “${id}”`));
 if(!idSet.has(book.startNode))errors.push(`/startNode: node “${book.startNode}” does not exist`);
 book.nodes.forEach((n,i)=>{const refs=[n.nextNode,...(n.outcomes??[]).map(o=>o.nextNode)].filter(Boolean) as string[];refs.forEach(ref=>{if(!idSet.has(ref))errors.push(`/nodes/${i}: reference “${ref}” does not exist`)}); const outcomeIds=(n.outcomes??[]).map(o=>o.id);if(new Set(outcomeIds).size!==outcomeIds.length)errors.push(`/nodes/${i}/outcomes: duplicate outcome ids`);(n.media??[]).forEach((m,j)=>{try{new URL(m.url,location.origin)}catch{errors.push(`/nodes/${i}/media/${j}/url: invalid URL`)}})});
 const reached=new Set<string>(); const visit=(id:string)=>{if(reached.has(id))return;reached.add(id);const n=book.nodes.find(x=>x.id===id);if(n){if(n.nextNode)visit(n.nextNode);n.outcomes?.forEach(o=>o.nextNode&&visit(o.nextNode))}}; if(idSet.has(book.startNode))visit(book.startNode); const warnings=ids.filter(id=>!reached.has(id)).map(id=>`Node “${id}” is unreachable from START`);
 return{valid:errors.length===0,errors,warnings};
}

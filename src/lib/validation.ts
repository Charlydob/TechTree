import Ajv2020,{type ErrorObject} from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import schema from '../runbook.schema.json';
import type {Runbook} from '../types';
import {localize} from './runbook';

const ajv=new Ajv2020({allErrors:true,strict:true});
addFormats(ajv);
const validateSchema=ajv.compile(schema);

export interface ValidationResult {valid:boolean;errors:string[];warnings:string[]}

const explain=(error:ErrorObject)=>`${error.instancePath||'/'}: ${error.message ?? 'invalid value'}`;

export function validateRunbook(value:unknown):ValidationResult{
 const schemaValid=validateSchema(value);
 const errors=schemaValid?[]:(validateSchema.errors??[]).map(explain);
 if(!schemaValid)return {valid:false,errors,warnings:[]};
 const book=value as unknown as Runbook;
 const ids=book.nodes.map(node=>node.id);
 const idSet=new Set(ids);

 ids.filter((id,index)=>ids.indexOf(id)!==index).forEach(id=>errors.push(`/nodes: duplicate node id "${id}"`));
 if(!idSet.has(book.startNode))errors.push(`/startNode: node "${book.startNode}" does not exist`);

 book.nodes.forEach((node,index)=>{
  const refs=[node.nextNode,...(node.outcomes??[]).map(outcome=>outcome.nextNode)].filter(Boolean) as string[];
  refs.forEach(ref=>{if(!idSet.has(ref))errors.push(`/nodes/${index}: reference "${ref}" does not exist`)});
  const outcomeIds=(node.outcomes??[]).map(outcome=>outcome.id);
  if(new Set(outcomeIds).size!==outcomeIds.length)errors.push(`/nodes/${index}/outcomes: duplicate outcome ids`);
  if(!localize(node.title,'es')&&!localize(node.title,'en'))errors.push(`/nodes/${index}/title: at least one language is required`);
  (node.media??[]).forEach((media,mediaIndex)=>{
   try{new URL(media.url,location.origin)}catch{errors.push(`/nodes/${index}/media/${mediaIndex}/url: invalid URL`)}
  });
 });

 const reached=new Set<string>();
 const visit=(id:string)=>{
  if(reached.has(id))return;
  reached.add(id);
  const node=book.nodes.find(item=>item.id===id);
  if(!node)return;
  if(node.nextNode)visit(node.nextNode);
  node.outcomes?.forEach(outcome=>outcome.nextNode&&visit(outcome.nextNode));
 };
 if(idSet.has(book.startNode))visit(book.startNode);
 const warnings=ids.filter(id=>!reached.has(id)).map(id=>`Node "${id}" is unreachable from START`);
 return {valid:errors.length===0,errors,warnings};
}

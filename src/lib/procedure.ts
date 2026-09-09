import type {Runbook,RunbookNode} from '../types';
import {getNode} from './runbook';

/**
 * The API stores a graph for backwards compatibility.  The new editor presents
 * that graph as a predictable document outline without changing the wire format.
 */
export function procedureOrder(book:Runbook):RunbookNode[]{
 const result:RunbookNode[]=[];
 const visited=new Set<string>();
 const visit=(id?:string)=>{
  const node=id?getNode(book,id):undefined;
  if(!node||visited.has(node.id))return;
  visited.add(node.id);
  result.push(node);
  if(node.nextNode)visit(node.nextNode);
  for(const outcome of node.outcomes??[])visit(outcome.nextNode);
 };
 visit(book.startNode);
 for(const node of book.nodes)visit(node.id);
 return result;
}

export function uniqueNodeId(book:Runbook,seed='step'){
 let index=1;
 while(book.nodes.some(node=>node.id===`${seed}-${index}`))index++;
 return `${seed}-${index}`;
}

export function insertLinearStep(book:Runbook,afterId:string,node:RunbookNode):Runbook{
 const next=structuredClone(book);
 const after=getNode(next,afterId);
 if(!after)throw new Error(`Unknown step: ${afterId}`);
 node.nextNode=after.nextNode;
 after.nextNode=node.id;
 const index=next.nodes.findIndex(item=>item.id===afterId);
 next.nodes.splice(index+1,0,node);
 return next;
}

export function removeStep(book:Runbook,id:string):Runbook{
 if(id===book.startNode)throw new Error('The Start step cannot be removed.');
 const next=structuredClone(book);
 const removed=getNode(next,id);
 if(!removed)return next;
 for(const node of next.nodes){
  if(node.nextNode===id)node.nextNode=removed.nextNode;
  for(const outcome of node.outcomes??[])if(outcome.nextNode===id)outcome.nextNode=removed.nextNode;
 }
 next.nodes=next.nodes.filter(node=>node.id!==id);
 return next;
}

export function moveLinearStep(book:Runbook,id:string,direction:-1|1):Runbook{
 const order=procedureOrder(book);
 const index=order.findIndex(node=>node.id===id);
 const target=index+direction;
 if(index<=0||target<=0||target>=order.length)return book;
 const ids=order.map(node=>node.id);
 [ids[index],ids[target]]=[ids[target],ids[index]];
 const next=structuredClone(book);
 // Reordering is intentionally limited to the primary linear path. Branch
 // targets remain intact and are still shown as nested/related steps.
 ids.forEach((nodeId,i)=>{const node=getNode(next,nodeId)!;node.nextNode=ids[i+1]});
 delete getNode(next,ids.at(-1)!)!.nextNode;
 next.nodes=ids.map(nodeId=>getNode(next,nodeId)!);
 return next;
}

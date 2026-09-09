import {describe,expect,it} from 'vitest';
import type {Runbook} from '../types';
import {insertLinearStep,moveLinearStep,procedureOrder,removeStep} from './procedure';

const book=():Runbook=>({schemaVersion:2,id:'roundtrip',title:'Guide',description:'',category:'Test',tags:[],startNode:'start',nodes:[
 {id:'start',type:'action',title:'Start',nextNode:'one'},
 {id:'one',type:'action',title:'Paso 1',nextNode:'two',media:[{type:'image',url:'/uploads/a.jpg',alt:'A'}]},
 {id:'two',type:'action',title:'Paso 2',outcomes:[{id:'detail',label:'Subpaso',nextNode:'detail'}]},
 {id:'detail',type:'note',title:'Detalle'},
]});

describe('procedure document adapter',()=>{
 it('opens old graph data without dropping branches or multimedia',()=>{
  const restored=JSON.parse(JSON.stringify(book())) as Runbook;
  expect(procedureOrder(restored).map(node=>node.id)).toEqual(['start','one','two','detail']);
  expect(restored.nodes[1].media?.[0].url).toBe('/uploads/a.jpg');
  expect(restored.nodes[2].outcomes?.[0].nextNode).toBe('detail');
 });
 it('adds, edits, reorders and removes steps while maintaining connections',()=>{
  let value=insertLinearStep(book(),'one',{id:'new',type:'action',title:'Paso nuevo',body:'contenido'});
  expect(value.nodes.find(node=>node.id==='one')?.nextNode).toBe('new');
  expect(value.nodes.find(node=>node.id==='new')?.nextNode).toBe('two');
  value=moveLinearStep(value,'new',-1);
  expect(procedureOrder(value).slice(0,3).map(node=>node.id)).toEqual(['start','new','one']);
  value=removeStep(value,'new');
  expect(procedureOrder(value).map(node=>node.id)).toEqual(['start','one','two','detail']);
 });
 it('round-trips twenty steps exactly',()=>{
  let value=book();
  for(let index=3;index<=20;index++)value=insertLinearStep(value,procedureOrder(value).at(-1)!.id,{id:`step-${index}`,type:'action',title:`Paso ${index}`});
  const reopened=JSON.parse(JSON.stringify(value)) as Runbook;
  expect(reopened.nodes).toEqual(value.nodes);
  expect(procedureOrder(reopened)).toHaveLength(22);
 });
});

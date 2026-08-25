import {describe,expect,it} from 'vitest';
import rfid from '../data/rfid.json';
import type {Runbook} from '../types';
import {validateRunbook} from './validation';

describe('runbook validation',()=>{
 it('accepts the bundled RFID runbook',()=>expect(validateRunbook(rfid).valid).toBe(true));
 it('reports a broken reference',()=>{
  const bad=structuredClone(rfid);
  bad.nodes[0].nextNode='missing';
  expect(validateRunbook(bad).errors.join(' ')).toContain('reference "missing"');
 });
 it('accepts optional folder and visual node positions',()=>{
  const withUi=structuredClone(rfid) as Runbook;
  withUi.folder='Servidores/Docker/Deployments';
  withUi.ui={layout:'horizontal'};
  withUi.nodes[0].ui={x:120,y:80};
  expect(validateRunbook(withUi).valid).toBe(true);
 });
 it('accepts multimedia on any node',()=>{
  const withMedia=structuredClone(rfid) as Runbook;
  withMedia.nodes[0].media=[
   {type:'youtube',url:'https://youtu.be/dQw4w9WgXcQ',alt:{es:'Video de referencia'}},
   {type:'link',url:'https://example.com/manual.pdf',alt:{es:'Manual externo'},caption:{es:'Manual'}},
  ];
  expect(validateRunbook(withMedia).valid).toBe(true);
 });
 it('rejects multimedia without a URL',()=>{
  const withMedia=structuredClone(rfid) as Runbook;
  withMedia.nodes[0].media=[{type:'image',url:'',alt:{es:'Captura'}}];
  expect(validateRunbook(withMedia).valid).toBe(false);
 });
 it('handles arbitrary JSON',()=>expect(validateRunbook({schemaVersion:1}).valid).toBe(false));
});

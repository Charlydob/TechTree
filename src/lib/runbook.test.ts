import {describe,expect,it} from 'vitest';
import rfid from '../data/rfid.json';
import type {Runbook} from '../types';
import {nodeSearchText} from './runbook';

describe('runbook search text',()=>{
 it('includes textual multimedia fields',()=>{
  const book=structuredClone(rfid) as Runbook;
  const node=book.nodes[0];
  node.media=[{
   type:'image',
   url:'https://example.com/go-live.png',
   alt:{es:'Captura de Go Live'},
   caption:{es:'Panel de puertos'},
   description:{es:'El boton aparece deshabilitado en la barra inferior'},
  }];

  expect(nodeSearchText(book,node)).toContain('barra inferior');
 });
});

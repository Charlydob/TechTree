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
  withUi.folder='RFID';
  withUi.ui={layout:'horizontal'};
  withUi.nodes[0].ui={x:120,y:80};
  expect(validateRunbook(withUi).valid).toBe(true);
 });
 it('handles arbitrary JSON',()=>expect(validateRunbook({schemaVersion:1}).valid).toBe(false));
});

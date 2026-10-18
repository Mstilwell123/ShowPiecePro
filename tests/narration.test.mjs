import test from 'node:test';
import assert from 'node:assert/strict';
import {migrateNarration,takesFor,activeTakes,reviewKeys,approveTiming,saveTake,photoHold,sourceGain,continuePhoto} from '../public/editor/narration.js';
const make=()=>({cards:true,items:[{id:'a',type:'image',seconds:3},{id:'b',type:'video',in:1,out:5},{id:'c',type:'image',seconds:3}]});
test('legacy soundtrack follows media when items are reordered',()=>{
  const p=make(),blob=new Blob(['original']);p.voice={blob,duration:14};migrateNarration(p);
  const a=takesFor(p).find(t=>t.key==='a');assert.equal(a.offset,2);assert.equal(a.duration,3);
  p.items.reverse();assert.equal(activeTakes(p).find(s=>s.item?.id==='a').start,9);
  assert.equal(takesFor(p).find(t=>t.key==='a').blob,blob);assert.deepEqual(reviewKeys(p),[]);
});
test('a section replacement keeps all other takes and clip audio defaults safe',()=>{
  const p=make();saveTake(p,{blob:new Blob(['whole']),start:0,end:14});const before=takesFor(p).find(t=>t.key==='b');
  const replacement=new Blob(['new']);saveTake(p,{blob:replacement,start:2,end:5,key:'a'});
  assert.equal(takesFor(p).find(t=>t.key==='b'),before);assert.equal(takesFor(p).find(t=>t.key==='a').blob,replacement);
  assert.equal(sourceGain(p,'preview'),0);p.clipVolume=25;assert.equal(sourceGain(p,'export'),.25);assert.equal(sourceGain(p,'record'),0);
});
test('timing and clip trims require review without deleting voice; reorder does not',()=>{
  const p=make();saveTake(p,{blob:new Blob(['whole']),start:0,end:14});
  p.items[1].in=2;assert.deepEqual(reviewKeys(p),['b']);assert.equal(takesFor(p).length,5);
  approveTiming(p);assert.deepEqual(reviewKeys(p),[]);p.items[0].seconds=6;assert.deepEqual(reviewKeys(p),['a']);
});
test('holding a still extends the video without stretching a clip or changing other photos',()=>{
  const p=make();assert.equal(photoHold(p,'a',2.5),true);assert.equal(p.items[0].seconds,5.5);
  assert.equal(photoHold(p,'b',2),false);assert.equal(p.items[1].out,5);
  saveTake(p,{blob:new Blob(['voice']),start:2,end:7.5,key:'a'});assert.equal(takesFor(p)[0].duration,5.5);
});
test('partial full recording preserves untouched later sections',()=>{
  const p=make();saveTake(p,{blob:new Blob(['old']),start:0,end:14});const last=takesFor(p).find(t=>t.key==='c');
  saveTake(p,{blob:new Blob(['partial']),start:0,end:4});assert.equal(takesFor(p).find(t=>t.key==='c'),last);
});
test('continue after a hold ends the photo at the narration position without changing a clip',()=>{
  const p=make();photoHold(p,'a',5);assert.equal(p.items[0].seconds,8);
  continuePhoto(p,'a',6);assert.equal(p.items[0].seconds,6.05);
  assert.equal(continuePhoto(p,'b',3),false);assert.equal(p.items[1].out,5);
  saveTake(p,{blob:new Blob(['voice']),start:2,end:8.05,key:'a'});assert.deepEqual(reviewKeys(p),[]);
});
test('accepting one timing change does not silently approve another changed section',()=>{
  const p=make();saveTake(p,{blob:new Blob(['voice']),start:0,end:14});p.items[0].seconds=8;p.items[2].seconds=9;
  approveTiming(p,['a']);assert.deepEqual(reviewKeys(p),['c']);
});

test('a new ending clip retains original audio when other photos are narrated and clip ducking is muted',()=>{const p=make();p.clipVolume=0;saveTake(p,{blob:new Blob(['photo voice']),start:2,end:5,key:'a'});assert.equal(sourceGain(p,'preview','b'),1);assert.equal(sourceGain(p,'export','b'),1);assert.equal(sourceGain(p,'record','b'),0);saveTake(p,{blob:new Blob(['clip voice']),start:5,end:9,key:'b'});assert.equal(sourceGain(p,'preview','b'),0);p.clipVolume=25;assert.equal(sourceGain(p,'export','b'),.25);});

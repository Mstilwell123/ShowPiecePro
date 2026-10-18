import {segments,duration} from './timeline.js';

export const segmentKey = s => s.item?.id || '@' + s.kind;
export function stamp(segment) {
  return segment.item?.type === 'video'
    ? `video:${segment.item.in.toFixed(3)}:${segment.item.out.toFixed(3)}`
    : `${segment.kind}:${(segment.end-segment.start).toFixed(3)}`;
}

// Version-one projects kept a single soundtrack. Split its references, not its bytes,
// so the existing recording can follow each item without lossy audio conversion.
export function migrateNarration(project) {
  if (!project.voice?.blob || project.voice.version === 2) return;
  const {blob,duration:recorded=0}=project.voice;
  project.voice={version:2,takes:segments(project).filter(s=>s.start<recorded).map(s=>({
    key:segmentKey(s),blob,offset:s.start,duration:Math.min(s.end-s.start,recorded-s.start),
    stamp:stamp(s)
  }))};
}
export function takesFor(project) {
  migrateNarration(project);
  return project.voice?.takes || [];
}
export function reviewKeys(project) {
  const takes=takesFor(project);
  return segments(project).filter(s=>{
    const take=takes.find(t=>t.key===segmentKey(s));
    return take && take.stamp!==stamp(s);
  }).map(segmentKey);
}
export function approveTiming(project,keys=null) {
  for(const s of segments(project)) {
    const take=takesFor(project).find(t=>t.key===segmentKey(s));
    if(take&&(!keys||keys.includes(segmentKey(s))))take.stamp=stamp(s);
  }
}
export function saveTake(project,{blob,start,end,key=null}) {
  migrateNarration(project);
  const current=takesFor(project);
  const targets=segments(project).filter(s=>key?segmentKey(s)===key:s.start<end&&s.end>start);
  const updates=targets.filter(s=>Math.min(end,s.end)>Math.max(start,s.start)+.05).map(s=>({
    key:segmentKey(s),blob,offset:Math.max(0,s.start-start),
    duration:Math.min(end,s.end)-Math.max(start,s.start),stamp:stamp(s)
  }));
  // A full new take replaces only the sections it actually reached; finishing early
  // and cancelling never erase later sections from an earlier take.
  const replaced=new Set(updates.map(t=>t.key));
  project.voice={version:2,takes:[...current.filter(t=>!replaced.has(t.key)),...updates]};
  return updates.length;
}
export function activeTakes(project) {
  return segments(project).flatMap(s=>{
    const take=takesFor(project).find(t=>t.key===segmentKey(s));
    return take?[{...s,take}]:[];
  });
}
export function photoHold(project,key,seconds) {
  const item=project.items.find(x=>x.id===key);
  if(item?.type!=='image'||!Number.isFinite(seconds)||seconds<0)return false;
  item.seconds=duration(item)+seconds;
  return true;
}
export function sourceGain(project,mode,itemId=null) {
  if(mode==='record')return 0; // Headphones are still recommended for microphone monitoring.
  // Only lower a clip beneath narration recorded for that same clip.
  if(itemId?!takesFor(project).some(t=>t.key===itemId):!activeTakes(project).length)return 1;
  return Math.max(0,Math.min(1,Number(project.clipVolume ?? 0)/100));
}
export function continuePhoto(project,key,elapsed) {
  const item=project.items.find(x=>x.id===key);
  if(item?.type!=='image'||!Number.isFinite(elapsed)||elapsed<0)return false;
  item.seconds=Math.max(.2,elapsed+.05);
  return true;
}

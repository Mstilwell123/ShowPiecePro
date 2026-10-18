export function duration(item){return item.type==='video'?Math.max(0.1,item.out-item.in):Number(item.seconds)||3;}
export function segments(project){let time=0;const result=[];const add=(kind,seconds,item=null)=>{result.push({kind,start:time,end:time+seconds,item});time+=seconds;};if(project.cards)add('title',2);for(const item of project.items)add(item.type,duration(item),item);if(project.cards)add('end',2);return result;}
export function total(project){const s=segments(project);return s.at(-1)?.end||0;}
export function atTime(project,time){const s=segments(project);return s.find(x=>time>=x.start&&time<x.end)||s.at(-1);}
export function move(items,id,offset){const a=[...items],from=a.findIndex(x=>x.id===id);if(from<0)return a;const to=Math.max(0,Math.min(a.length-1,from+offset));a.splice(to,0,a.splice(from,1)[0]);return a;}
export function reorder(items,source,target){const a=[...items],from=a.findIndex(x=>x.id===source);if(from<0||source===target)return a;const [item]=a.splice(from,1);const to=a.findIndex(x=>x.id===target);if(to<0)return items;a.splice(to,0,item);return a;}

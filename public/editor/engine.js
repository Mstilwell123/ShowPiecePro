import {atTime,total,segments} from './timeline.js';
import {activeTakes,segmentKey,photoHold,sourceGain} from './narration.js';
export const devices={microphone:()=>navigator.mediaDevices?.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false})||Promise.reject(Error('Microphone recording needs a supported browser on localhost or HTTPS.'))};
export function videoMime(){if(!window.MediaRecorder)return '';return ['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4;codecs=avc1,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(x=>MediaRecorder.isTypeSupported(x))||'';}
export function audioMime(){return ['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(x=>MediaRecorder.isTypeSupported(x));}
const ready=(element,event,timeout=15000)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{clear();reject(Error('This file took too long to load or uses an unsupported codec.'));},timeout);const clear=()=>{clearTimeout(timer);element.removeEventListener(event,yes);element.removeEventListener('error',no);};const yes=()=>{clear();resolve(element);};const no=()=>{clear();reject(Error('This file cannot be decoded in this browser.'));};element.addEventListener(event,yes,{once:true});element.addEventListener('error',no,{once:true});});
export async function loadMedia(blob,type){const url=URL.createObjectURL(blob);try{if(type==='image'){const el=new Image();const p=ready(el,'load');el.src=url;await p;return {el,url};}const el=document.createElement('video');el.preload='auto';el.playsInline=true;el.muted=true;const p=ready(el,'loadeddata');el.src=url;el.load();await p;if(!Number.isFinite(el.duration)||el.duration<=0)throw Error('Clip duration could not be read.');return {el,url};}catch(e){URL.revokeObjectURL(url);throw e;}}
export async function thumbnail(el){const c=document.createElement('canvas');c.width=280;c.height=158;const g=c.getContext('2d');g.fillStyle='#e8dccb';g.fillRect(0,0,280,158);fit(g,el,280,158);return new Promise(resolve=>c.toBlob(resolve,'image/jpeg',.75));}
export function fit(g,el,w,h){const ew=el.videoWidth||el.naturalWidth,eh=el.videoHeight||el.naturalHeight;if(!ew||!eh)return;const scale=Math.min(w/ew,h/eh);g.drawImage(el,(w-ew*scale)/2,(h-eh*scale)/2,ew*scale,eh*scale);}
function lines(g,text,width){const out=[];let line='';for(const word of text.split(/\s+/)){const candidate=(line+' '+word).trim();if(g.measureText(candidate).width>width&&line){out.push(line);line=word;}else line=candidate;}if(line)out.push(line);return out;}
export class VideoEngine {
 constructor(canvas,onTime,onEnd){
  this.canvas=canvas;this.g=canvas.getContext('2d',{alpha:false});this.onTime=onTime;this.onEnd=onEnd;
  this.resources=new Map();this.bufferCache=new Map();this.voiceBuffers=[];this.voiceNodes=[];
  this.time=0;this.playing=false;this.mode='preview';this.audio=null;this.activeId=null;this.logo=null;this.holding=false;this.rangeKey=null;
 }
 ensureAudio(){
  if(!this.audio){this.audio=new AudioContext();this.destination=this.audio.createMediaStreamDestination();this.master=this.audio.createGain();this.monitor=this.audio.createGain();this.master.connect(this.monitor).connect(this.audio.destination);this.master.connect(this.destination);}
  return this.audio;
 }
 async prepare(project,brand){
  this.pause();this.project=project;this.brand=brand;
  const keep=new Set(project.items.map(x=>x.id));
  for(const [id,r]of this.resources){if(!keep.has(id)){r.el.pause?.();r.source?.disconnect();r.gain?.disconnect();URL.revokeObjectURL(r.url);this.resources.delete(id);}}
  for(const item of project.items)if(!this.resources.has(item.id))this.resources.set(item.id,await loadMedia(item.blob,item.type));
  this.voiceBuffers=[];const used=new Set();
  for(const s of activeTakes(project)){
   const blob=s.take.blob;used.add(blob);
   if(!this.bufferCache.has(blob)){
    try{this.bufferCache.set(blob,await this.ensureAudio().decodeAudioData(await blob.arrayBuffer()));}
    catch{throw Error('A saved narration take could not be decoded. Keep the project open and re-record that section.');}
   }
   this.voiceBuffers.push({...s,buffer:this.bufferCache.get(blob)});
  }
  for(const blob of this.bufferCache.keys())if(!used.has(blob))this.bufferCache.delete(blob);
  this.cover=null;const selected=project.items.find(item=>item.id===project.coverItemId&&item.type==='image');if(selected)this.cover=this.resources.get(selected.id).el;else if(project.openingCover){const cover=await loadMedia(project.openingCover,'image');this.cover=cover.el;URL.revokeObjectURL(cover.url);}
  this.logo=null;if(brand.logo){const r=await loadMedia(brand.logo,'image');this.logo=r.el;URL.revokeObjectURL(r.url);}
  this.time=0;this.activeId=null;this.holding=false;this.draw(0);
 }
 async audioSetup(){
  this.ensureAudio();await this.audio.resume();
  for(const r of this.resources.values())if(r.el.tagName==='VIDEO'&&!r.source){r.source=this.audio.createMediaElementSource(r.el);r.gain=this.audio.createGain();r.source.connect(r.gain).connect(this.master);}
  this.updateMix();
 }
 updateMix(){for(const [id,r]of this.resources)if(r.gain)r.gain.gain.setValueAtTime(sourceGain(this.project,this.mode,id),this.audio.currentTime);}
 scheduleVoice(time){
  this.stopVoice();if(this.mode==='record')return;
  for(const s of this.voiceBuffers){
   const begin=Math.max(time,s.start),elapsed=Math.max(0,time-s.start),offset=(s.take.offset||0)+elapsed;
   const seconds=Math.min(s.take.duration-elapsed,s.end-begin,s.buffer.duration-offset);
   if(seconds<=.01)continue;
   const node=this.audio.createBufferSource();node.buffer=s.buffer;node.connect(this.master);
   node.start(this.audio.currentTime+Math.max(0,s.start-time),offset,seconds);this.voiceNodes.push(node);
  }
 }
 stopVoice(){for(const node of this.voiceNodes){try{node.stop();}catch{}node.disconnect();}this.voiceNodes=[];}
 card(head,sub){const {g}=this,w=this.canvas.width,h=this.canvas.height;g.fillStyle='#f4ebdd';g.fillRect(0,0,w,h);g.fillStyle=this.brand.color;g.fillRect(w*.1,h*.28,65,7);g.fillStyle='#302821';g.textAlign='left';g.font='64px Georgia';const list=lines(g,head,w*.76).slice(0,3);list.forEach((line,i)=>g.fillText(line,w*.1,h*.43+i*80));g.font='26px Arial';g.fillStyle='#776550';lines(g,sub,w*.78).slice(0,3).forEach((line,i)=>g.fillText(line,w*.1,h*.43+list.length*80+20+i*36));}
 closingCard(){
  if(!this.brand.phone){this.card(this.brand.name||'Thanks for watching',[this.brand.cta,this.brand.website].filter(Boolean).join('  •  '));return;}
  const {g}=this,w=this.canvas.width,h=this.canvas.height;g.fillStyle='#f4ebdd';g.fillRect(0,0,w,h);g.textAlign='center';
  const centered=(text,y,size,family='Arial',color='#302821')=>{g.fillStyle=color;g.font='bold '+size+'px '+family;while(g.measureText(text).width>w*.84&&size>28){size-=2;g.font='bold '+size+'px '+family;}g.fillText(text,w/2,y,w*.84);};
  centered(this.brand.cta||'Call us',h*.30,68,'Arial',this.brand.color||'#a84d34');
  centered(this.brand.name||'',h*.43,72,'Georgia');
  centered(this.brand.phone,h*.65,156);
  if(this.brand.website)centered(this.brand.website,h*.79,76,'Arial','#2455e6');
 }
 businessName(){if(!this.brand.name)return;const g=this.g,w=this.canvas.width,h=this.canvas.height,text=this.brand.name;g.save();let size=69;g.font='bold '+size+'px Arial';while(g.measureText(text).width>w*.86&&size>28){size-=2;g.font='bold '+size+'px Arial';}const width=Math.min(g.measureText(text).width+64,w*.92);g.fillStyle='#302821dd';g.fillRect((w-width)/2,h-142,width,102);g.fillStyle='#fff9f0';g.textAlign='center';g.fillText(text,w/2,h-68,w*.86);g.restore();}
 thumbnailHeadline(){const text=(this.project.thumbnailText||'').trim();if(!text||this.suppressThumbnailText)return;const g=this.g,w=this.canvas.width,h=this.canvas.height,pos=this.project.thumbnailPosition||{x:.5,y:.45},x=w*Math.max(.15,Math.min(.85,pos.x)),y=h*Math.max(.15,Math.min(.85,pos.y)),width=Math.min(w*.84,2*Math.min(x-w*.04,w*.96-x));g.save();let size=Math.round(w*({small:.035,medium:.055,large:.075}[this.project.thumbnailSize]||.055));g.font='bold '+size+'px Arial';while(lines(g,text,width).length>3&&size>24){size-=2;g.font='bold '+size+'px Arial';}g.textAlign='center';const rows=lines(g,text,width),lineHeight=size*1.2,top=Math.max(lineHeight,Math.min(h-rows.length*lineHeight,y-(rows.length-1)*lineHeight/2));g.fillStyle='#151515cc';g.fillRect(x-width/2-w*.02,top-lineHeight*.8,width+w*.04,rows.length*lineHeight+lineHeight*.2);g.fillStyle='#ffffff';rows.forEach((row,i)=>g.fillText(row,x,top+i*lineHeight,width));g.restore();}

 draw(time){const s=atTime(this.project,time),{g}=this,w=this.canvas.width,h=this.canvas.height;if(!s){g.fillStyle='#eee5d9';g.fillRect(0,0,w,h);return;}if(s.kind==='title'){if(this.cover){g.fillStyle='#302821';g.fillRect(0,0,w,h);fit(g,this.cover,w,h);}else this.card(this.project.name,this.brand.name);}else if(s.kind==='end')this.closingCard();else{const r=this.resources.get(s.item.id);g.fillStyle='#302821';g.fillRect(0,0,w,h);if(r)fit(g,r.el,w,h);this.businessName();const alpha=Math.min(1,(time-s.start)/.28,(s.end-time)/.28);if(alpha<1){g.fillStyle=`rgba(48,40,33,${1-Math.max(0,alpha)})`;g.fillRect(0,0,w,h);}}if(this.logo&&!(s.kind==='title'&&this.cover)){g.save();g.globalAlpha=.9;const lw=150,lh=90,scale=Math.min(lw/this.logo.naturalWidth,lh/this.logo.naturalHeight);g.drawImage(this.logo,w-50-this.logo.naturalWidth*scale,45,this.logo.naturalWidth*scale,this.logo.naturalHeight*scale);g.restore();}if(s.kind==='title'&&this.cover){if(this.project.coverItemId)this.businessName();this.thumbnailHeadline();}}

 async seek(time){
  this.pause();this.time=Math.max(0,Math.min(time,total(this.project)));const s=atTime(this.project,this.time);
  if(s?.kind==='video'){const v=this.resources.get(s.item.id).el;const target=Math.min(s.item.out-.01,s.item.in+this.time-s.start);if(Math.abs(v.currentTime-target)>.02){const p=ready(v,'seeked',5000);v.currentTime=target;await p;}}
  this.draw(this.time);this.onTime(this.time);
 }
 async play(mode='preview',key=null){
  if(this.playing)return;this.mode=mode;this.rangeKey=key;
  if(!key&&this.time>=total(this.project)-.05)this.time=0;
  await this.audioSetup();this.playing=true;this.origin=this.audio.currentTime-this.time;
  this.lastTick=this.audio.currentTime;this.activeId=null;this.scheduleVoice(this.time);this.tick();
 }
 tick=()=>{
  if(!this.playing)return;
  const now=this.audio.currentTime,delta=Math.max(0,now-this.lastTick);this.lastTick=now;
  const prior=atTime(this.project,this.time);
  if(this.mode==='record'&&this.holding&&prior?.kind==='image')photoHold(this.project,segmentKey(prior),delta);
  const range=this.rangeKey?segments(this.project).find(s=>segmentKey(s)===this.rangeKey):null;
  const end=range?.end??total(this.project);this.time=Math.min(now-this.origin,end);
  const s=atTime(this.project,this.time),id=s?.item?.id;
  if(id!==this.activeId){
   for(const [rid,r]of this.resources)if(r.el.tagName==='VIDEO'&&rid!==id)r.el.pause();
   this.activeId=id;
   if(s?.kind==='video'){const v=this.resources.get(id).el;v.muted=false;v.currentTime=s.item.in+Math.max(0,this.time-s.start);v.play().catch(()=>{});}
  }
  this.draw(this.time);this.onTime(this.time);
  if(this.time>=end){this.pause();this.holding=false;this.onEnd();return;}
  this.frame=requestAnimationFrame(this.tick);
 };
 pause(){this.playing=false;cancelAnimationFrame(this.frame);for(const r of this.resources.values())r.el.pause?.();this.stopVoice();}
 async export(onProgress,signal){
  if(signal.aborted)throw new DOMException('Export cancelled','AbortError');
  const mime=videoMime();if(!mime)throw Error('This browser cannot record video. Please try current Chrome or Edge.');
  const previous={canvas:this.canvas,g:this.g,time:this.time,onTime:this.onTime,onEnd:this.onEnd};
  this.pause();this.canvas=document.createElement('canvas');this.canvas.width=previous.canvas.width;this.canvas.height=previous.canvas.height;this.g=this.canvas.getContext('2d',{alpha:false});
  let stream,recorder;const stop=()=>{this.pause();if(recorder&&recorder.state!=='inactive')recorder.stop();};
  this.onTime=t=>onProgress(t/total(this.project));this.onEnd=stop;
  try{
   this.mode='export';await this.audioSetup();this.monitor.gain.value=0;await this.seek(0);
   if(signal.aborted)throw new DOMException('Export cancelled','AbortError');
   stream=this.canvas.captureStream(30);const tracks=[...stream.getVideoTracks(),...this.destination.stream.getAudioTracks().map(track=>track.clone())];
   recorder=new MediaRecorder(new MediaStream(tracks),{mimeType:mime,videoBitsPerSecond:Math.max(500000,Math.min(8000000,Math.floor(60*1024*1024*8/Math.max(1,total(this.project))-128000))),audioBitsPerSecond:128000});
   const chunks=[],result=new Promise((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onerror=e=>reject(e.error||Error('Encoding failed'));recorder.onstop=()=>resolve(new Blob(chunks,{type:recorder.mimeType}));});
   signal.addEventListener('abort',stop,{once:true});recorder.start(500);await this.play('export');const blob=await result;
   if(signal.aborted)throw new DOMException('Export cancelled','AbortError');return blob;
  }finally{
   stop();signal.removeEventListener('abort',stop);stream?.getTracks().forEach(t=>t.stop());
   this.canvas=previous.canvas;this.g=previous.g;this.onTime=previous.onTime;this.onEnd=previous.onEnd;this.mode='preview';
   if(this.monitor)this.monitor.gain.value=1;
   await this.seek(previous.time).catch(()=>{});
  }
 }

}

import {saveVideo} from '../save-video.js';
import {read,write,setNamespace} from './storage.js';
import {makeBackup,readBackup} from './backup.js';
let hostedAccount;
async function api(path,options={}){const response=await fetch(path,{...options,credentials:'same-origin'}),data=await response.json();if(!response.ok){if(response.status===401)window.top.location.href='/signin-with-chatgpt?return_to=%2Fstudio';throw Error(data.error||'This request could not finish.');}return data;}
function accountRefresh(){window.parent.postMessage({type:'showpiece-account-refresh'},location.origin);}
setNamespace('locked');
import {total,segments,atTime,move,reorder} from './timeline.js';
import {segmentKey,takesFor,migrateNarration,reviewKeys,approveTiming,saveTake,activeTakes,continuePhoto} from './narration.js';
import {VideoEngine,devices,videoMime,audioMime,loadMedia,thumbnail} from './engine.js';
const $=id=>document.getElementById(id),fmt=n=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;
const backupTools=document.createElement('div');backupTools.className='backup-tools';backupTools.innerHTML='<button id="saveBackup" class="button secondary">↓ Save project backup</button><button id="openBackup" class="button secondary">↑ Open project backup</button><input id="backupFile" type="file" accept=".showpiece" hidden><p class="helper">A private copy of your project, media, brand and narration. Save it somewhere safe; this is not automatic cloud storage.</p>';document.querySelector('.projects-list').prepend(backupTools);
const blank=()=>({id:crypto.randomUUID(),name:'My project showcase',items:[],cards:true,pace:5,area:'',details:'',seo:null,voice:null,updated:Date.now()});
let brand={name:'',website:'',phone:'',cta:'Request a free estimate',color:'#B85C40',logo:null},projects=[],project=blank(),busy=false,saveTimer,saveChain=Promise.resolve(),dragId=null,thumbURLs=[],exportURL=null,abortExport=null,recording=null;

const narrationTools=document.createElement('div');narrationTools.className='narration-tools';
narrationTools.innerHTML='<label class="field">Record all or just one section<select id="narrationScope" aria-label="Narration section"><option value="">Whole video</option></select></label><div id="voiceReview" class="voice-review" hidden><p>Timing changed in a narrated section. Your recordings are safe. Preview the change, then keep the timing or re-record that section.</p><button id="reviewPlayback" class="text-button">Preview changed section</button><button id="approveVoice" class="text-button">Keep this timing</button></div><label class="field">Clip audio beneath your voice <select id="clipVolume"><option value="0">Muted (recommended)</option><option value="10">Very quiet · 10%</option><option value="25">Quiet · 25%</option><option value="50">Half volume · 50%</option><option value="100">Original volume</option></select></label><p class="helper">Without narration, original clip audio plays normally.</p>';
$('narrate').before(narrationTools);
const undoButton=document.createElement('button');undoButton.id='undoTimeline';undoButton.className='text-button';undoButton.textContent='↶ Undo last timeline edit';undoButton.hidden=true;
document.querySelector('.timeline-header').append(undoButton);
const thumbnailButton=document.createElement('button');thumbnailButton.id='saveThumbnail';thumbnailButton.className='button secondary';thumbnailButton.textContent='Save thumbnail';thumbnailButton.disabled=true;document.querySelector('.player').after(thumbnailButton);const thumbnailHint=document.createElement('p');thumbnailHint.className='helper';thumbnailHint.textContent='Pause the video or move the preview slider to choose a frame, then Save thumbnail. Downloads a 1920 × 1080 JPG.';thumbnailButton.after(thumbnailHint);
const thumbnailRow=document.createElement('div');thumbnailRow.style.cssText='display:flex;gap:16px;align-items:end;flex-wrap:wrap;margin:16px 0';thumbnailButton.before(thumbnailRow);thumbnailRow.append(thumbnailButton);const headlineLabel=document.createElement('label');headlineLabel.className='field';headlineLabel.style.cssText='flex:1;min-width:240px';headlineLabel.textContent='Title name';const headlineInput=document.createElement('input');headlineInput.id='thumbnailText';headlineInput.maxLength=100;headlineInput.placeholder='Example: Siding Replacement · Florence, Oregon';headlineLabel.append(headlineInput);thumbnailRow.append(headlineLabel);const sizeLabel=document.createElement('label');sizeLabel.className='field';sizeLabel.textContent='Text size';const sizeSelect=document.createElement('select');sizeSelect.id='thumbnailSize';for(const [value,text]of [['small','Small'],['medium','Medium'],['large','Large']]){const option=document.createElement('option');option.value=value;option.textContent=text;sizeSelect.append(option);}sizeSelect.value='medium';sizeLabel.append(sizeSelect);thumbnailRow.append(sizeLabel);

const coverButton=document.createElement('button');coverButton.id='setCover';coverButton.className='button secondary';coverButton.textContent='Use this frame as thumbnail & opening slide';thumbnailHint.after(coverButton);const clearCover=document.createElement('button');clearCover.id='clearCover';clearCover.className='text-button';clearCover.textContent='Restore original title slide';coverButton.after(clearCover);

const micHint=document.createElement('p');micHint.id='micHint';micHint.className='mic-alert';$('micLevel').parentElement.after(micHint);
const recordingPreview=document.createElement('div');recordingPreview.className='recording-preview';recordingPreview.innerHTML='<canvas id="recordingCanvas" width="640" height="360" aria-label="Live video while recording narration"></canvas><p id="recordingSlide">Your video appears here while you narrate.</p>';$('recordStatus').before(recordingPreview);
const narrationGuide=document.createElement('p');narrationGuide.className='helper';narrationGuide.textContent='Choose Whole video to watch and narrate every slide. For one photo, use Narrate this section below its thumbnail. After the countdown, talk while the preview plays. Hold this photo gives you more time.';$('narrate').before(narrationGuide);

const engine=new VideoEngine($('preview'),t=>{$('time').textContent=`${fmt(t)} / ${fmt(total(project))}`;$('scrub').value=t;if(recording)recordHUD(t);},()=>{$('play').textContent='▶ Play video';$('play').setAttribute('aria-label','Play preview');if(recording)finishRecording(true);});
function notice(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);}
function setBusy(value){busy=value;document.body.classList.toggle('busy',value);$('timeline').inert=value;$('projectList').inert=value;$('voiceActions').inert=value;for(const id of ['play','narrate','export','saveThumbnail','setCover','clearCover'])$(id).disabled=value||!project.items.length;for(const id of ['projectName','newProject','pace','cards','scrub','editBrand','brandNav','thumbnailText','thumbnailSize'])$(id).disabled=value;$('stop').hidden=!value||!!recording;$('scrub').disabled=value||!project.items.length;$('narrationScope').disabled=value;$('clipVolume').disabled=value;$('undoTimeline').disabled=value;if(!value){$('export').disabled=!project.items.length||!!reviewKeys(project).length;renderProjects();}}
async function save(){clearTimeout(saveTimer);saveTimer=null;$('saved').textContent='Saving…';project.updated=Date.now();const i=projects.findIndex(p=>p.id===project.id);if(i<0)projects.unshift(project);else projects[i]=project;const snapshot=structuredClone({brand,projects,current:project.id});const task=saveChain.catch(()=>{}).then(()=>write('workspace',snapshot));saveChain=task;try{await task;$('saved').textContent='Saved on this device';renderProjects();}catch(e){$('saved').textContent='Not saved — storage unavailable';notice('Could not save this change. Device storage may be full or blocked. Keep this tab open and export your work.',true);throw e;}}
function queueSave(){clearTimeout(saveTimer);$('saved').textContent='Unsaved changes';saveTimer=setTimeout(()=>{saveTimer=null;save().catch(()=>{});},500);}
function invalidateVoice(){migrateNarration(project);invalidateExport();}
function timelineSnapshot(){return structuredClone({items:project.items,cards:project.cards,pace:project.pace});}
async function editTimeline(edit){
 if(busy)return;engine.pause();setBusy(true);project.timelineUndo=timelineSnapshot();edit();invalidateVoice();
 try{await refresh();await save().catch(()=>{});}catch(e){setBusy(false);throw e;}
 notice(reviewKeys(project).length?'Your narration is safe. Review the changed timing before exporting.':'Timeline updated. Saved narration follows its photo or clip.');
}
$('undoTimeline').onclick=async()=>{if(busy||!project.timelineUndo)return;const previous=project.timelineUndo;const current=timelineSnapshot();Object.assign(project,previous);project.timelineUndo=current;invalidateExport();await refresh();await save().catch(()=>{});notice('Timeline restored. Your saved recordings are preserved.');};
function invalidateExport(){if(exportURL){URL.revokeObjectURL(exportURL);exportURL=null;}$('download').hidden=true;}
function hydrateFields(){$('thumbnailSize').value=project.thumbnailSize||'medium';$('thumbnailText').value=project.thumbnailText||'';$('clearCover').hidden=!project.openingCover;for(const [id,key]of [['projectName','name']])$(id).value=project[key];$('cards').checked=project.cards;$('pace').value=project.pace;}
function renderBrand(){$('brandSummary').textContent=brand.name||'Your business';$('editBrand').textContent=brand.name?'Edit brand kit →':'Set up your brand →';$('brandAvatar').replaceChildren();if(brand.logo){const img=new Image();const url=URL.createObjectURL(brand.logo);img.onload=()=>URL.revokeObjectURL(url);img.src=url;img.alt='Business logo';$('brandAvatar').append(img);}else $('brandAvatar').textContent=(brand.name||'S')[0].toUpperCase();}
function renderVoice(){
 const active=activeTakes(project),reviews=reviewKeys(project),selected=$('narrationScope').value;
 const options=[{key:'',label:'Whole video'}].concat(segments(project).map((s,i)=>({key:segmentKey(s),label:(s.item?String(project.items.findIndex(x=>x.id===s.item.id)+1)+'. '+s.item.name:s.kind==='title'?'Opening card':'Closing card')+(reviews.includes(segmentKey(s))?' · review timing':takesFor(project).some(t=>t.key===segmentKey(s))?' · recorded':'')})));
 $('narrationScope').replaceChildren(...options.map(({key,label})=>{const option=document.createElement('option');option.value=key;option.textContent=label;return option;}));
 $('narrationScope').value=options.some(o=>o.key===selected)?selected:'';
 $('voiceState').textContent=active.length?active.length+' of '+segments(project).length+' sections narrated. Record another section whenever you like.':'Optional. No script needed.';
 $('voiceActions').hidden=!takesFor(project).length;
 $('narrate').textContent=$('narrationScope').value?'● Record this section':active.length?'● Record whole video again':'● Record narration';
 $('voiceReview').hidden=!reviews.length;$('clipVolume').value=String(project.clipVolume??0);
 $('undoTimeline').hidden=!project.timelineUndo;
}
$('narrationScope').onchange=renderVoice;
$('clipVolume').onchange=()=>{project.clipVolume=Number($('clipVolume').value);engine.updateMix();invalidateExport();queueSave();};
$('reviewPlayback').onclick=async()=>{const keys=reviewKeys(project),key=keys.includes($('narrationScope').value)?$('narrationScope').value:keys[0];if(!key)return;const s=segments(project).find(x=>segmentKey(x)===key);$('narrationScope').value=key;await engine.seek(s.start);await engine.play('preview',key);$('play').textContent='Ⅱ Pause video';};
$('approveVoice').onclick=()=>{const keys=reviewKeys(project),key=keys.includes($('narrationScope').value)?$('narrationScope').value:keys[0];if(!key)return;approveTiming(project,[key]);renderTimeline();renderVoice();setBusy(false);queueSave();notice(reviewKeys(project).length?'This section’s timing is accepted. Review the remaining flagged sections before exporting.':'New timing accepted. The recording is kept; added time is quiet, and audio beyond a shorter section is trimmed in the video.');};
function renderProjects(){$('projectList').replaceChildren();const latest=projects.reduce((best,p)=>!best||(p.narratedAt||p.updated)>(best.narratedAt||best.updated)?p:best,null);for(const p of [...projects].sort((a,b)=>b.updated-a.updated)){const row=document.createElement('div');row.className='project-row';const open=document.createElement('button');open.className='open-project';open.textContent=p.name;const sub=document.createElement('small');sub.textContent=`${p.items.length} items · ${fmt(total(p))}${p.id===project.id?' · Open':''}`;const stamp=document.createElement('small');stamp.className='project-timestamp';const date=value=>new Date(value).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});stamp.textContent='Saved '+date(p.updated)+(p.narratedAt?' · Voice recorded '+date(p.narratedAt):takesFor(p).length?' · Earlier voice recording (time unavailable)':'');if(latest?.id===p.id){const badge=document.createElement('strong');badge.className='latest-video';badge.textContent='Latest video';stamp.append(document.createTextNode(' · '),badge);}sub.append(stamp);open.append(sub);open.disabled=busy;open.onclick=()=>openProject(p.id);row.append(open);const del=document.createElement('button');del.className='text-button danger';del.textContent='Delete';del.disabled=busy;del.setAttribute('aria-label',`Delete project ${p.name}`);del.onclick=async()=>{if(!confirm(`Delete “${p.name}” and its local media? This cannot be undone.`))return;projects=projects.filter(x=>x.id!==p.id);if(project.id===p.id){project=projects[0]||blank();hydrateFields();await refresh();}await save().catch(()=>{});};row.append(del);$('projectList').append(row);}}
function actionButton(text,label,fn){const b=document.createElement('button');b.textContent=text;b.setAttribute('aria-label',label);b.onclick=fn;return b;}
function renderTimeline(){
 for(const u of thumbURLs)URL.revokeObjectURL(u);thumbURLs=[];
 const list=$('timeline');list.replaceChildren();
 const reviews=reviewKeys(project);
 project.items.forEach((item,index)=>{
  const tile=document.createElement('article');tile.className='tile';tile.draggable=true;tile.dataset.id=item.id;tile.setAttribute('aria-label',String(index+1)+'. '+item.name);
  tile.ondragstart=e=>{dragId=item.id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',item.id);};
  tile.ondragover=e=>{e.preventDefault();tile.classList.add('drag-over');};
  tile.ondragleave=()=>tile.classList.remove('drag-over');
  tile.ondrop=e=>{e.preventDefault();e.stopPropagation();tile.classList.remove('drag-over');if(dragId&&dragId!==item.id)editTimeline(()=>{project.items=reorder(project.items,dragId,item.id);}).catch(report);dragId=null;};
  const thumb=document.createElement('div');thumb.className='thumb';
  const img=new Image(),url=URL.createObjectURL(item.thumb);thumbURLs.push(url);img.src=url;img.alt='';thumb.append(img);
  for(const [cls,text]of [['number',String(index+1)],['kind',item.type==='video'?'▶ Clip':Number(item.seconds.toFixed(1))+'s']]){const x=document.createElement('span');x.className=cls;x.textContent=text;thumb.append(x);}
  if(takesFor(project).some(t=>t.key===item.id)){const tag=document.createElement('span');tag.className='tile-recorded'+(reviews.includes(item.id)?' needs-review':'');tag.textContent=reviews.includes(item.id)?'● Review voice':'● Narrated';thumb.append(tag);}
  tile.append(thumb);const name=document.createElement('div');name.className='tile-name';name.textContent=item.name;tile.append(name);
  if(item.type==='image'){const pick=actionButton(project.coverItemId===item.id?'Selected thumbnail':'Use as thumbnail','Use photo '+(index+1)+' as thumbnail',async()=>{if(busy)return;const section=segments(project).find(s=>s.item?.id===item.id);if(!section)return;try{await engine.seek((section.start+section.end)/2);const chosen=await $('setCover').onclick();if(chosen){project.coverItemId=item.id;await save();renderTimeline();}}catch(e){report(e);}});pick.className='section-voice-button';tile.append(pick);}

  const tools=document.createElement('div');tools.className='tile-tools';
  const shift=offset=>editTimeline(()=>{project.items=move(project.items,item.id,offset);}).catch(report);
  const left=actionButton('←','Move item '+(index+1)+' left',()=>shift(-1));left.disabled=index===0;tools.append(left);
  if(item.type==='image'){
   const label=document.createElement('label');label.textContent='sec ';const n=document.createElement('input');n.type='number';n.min='1';n.max='3600';n.step='.1';n.value=Number(item.seconds.toFixed(1));n.setAttribute('aria-label','Duration of photo '+(index+1)+' in seconds');
   n.onchange=()=>editTimeline(()=>{item.seconds=Math.max(1,Math.min(3600,Number(n.value)||5));}).catch(report);label.append(n);tools.append(label);
  }else tools.append(actionButton('Trim','Edit trim of clip '+(index+1),()=>tile.querySelector('.trim-row').hidden=!tile.querySelector('.trim-row').hidden));
  const right=actionButton('→','Move item '+(index+1)+' right',()=>shift(1));right.disabled=index===project.items.length-1;
  tools.append(right,actionButton('×','Remove item '+(index+1),()=>editTimeline(()=>{project.items=project.items.filter(x=>x.id!==item.id);}).catch(report)));tile.append(tools);
  if(item.type==='video'){
   const trim=document.createElement('div');trim.className='trim-row';trim.hidden=true;
   for(const [label,key]of [['Start','in'],['End','out']]){
    const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement('input');input.type='number';input.step='.1';input.min='0';input.max=String(item.originalDuration);input.value=item[key].toFixed(1);input.setAttribute('aria-label',label+' time of clip '+(index+1));
    input.onchange=()=>{const v=Number(input.value);if(!Number.isFinite(v)||v<0||v>item.originalDuration||(key==='in'&&v>=item.out)||(key==='out'&&v<=item.in)){input.value=item[key];notice('Clip start must be before its end, within the original clip.',true);return;}editTimeline(()=>{item[key]=v;}).catch(report);};
    wrap.append(input);trim.append(wrap);
   }tile.append(trim);
  }
  const record=actionButton(takesFor(project).some(t=>t.key===item.id)?'● Re-record this section':'● Narrate this section','Narrate item '+(index+1),()=>{if(busy)return;$('narrationScope').value=item.id;renderVoice();startRecording(item.id);});record.className='section-voice-button';tile.append(record);list.append(tile);
 });
 const add=document.createElement('button');add.className='timeline-add add-media';const plus=document.createElement('span');plus.textContent='＋';add.append(plus,document.createTextNode('Add photos & clips'));add.onclick=chooseFiles;list.append(add);
 const photos=project.items.filter(x=>x.type==='image').length,clips=project.items.length-photos;
 $('mediaCount').textContent=photos+' photos · '+clips+' clips';$('duration').textContent=project.items.length?fmt(total(project))+' finished video · '+project.items.length+' items':'Your next great showcase starts here.';
 $('emptyPreview').hidden=!!project.items.length;$('scrub').max=total(project)||1;
}
async function refresh(){migrateNarration(project);await engine.prepare(project,brand);renderTimeline();renderBrand();renderVoice();setBusy(false);$('time').textContent=`0:00 / ${fmt(total(project))}`;$('scrub').value=0;}
function report(e){console.error(e);notice(e.message||'Something went wrong. Please try again.',true);}
function chooseFiles(){if(!busy)$('files').click();}
document.querySelectorAll('.add-media').forEach(b=>b.onclick=chooseFiles);
$('files').onchange=async e=>{await importFiles([...e.target.files]);e.target.value='';};
async function importFiles(files){if(busy||!files.length)return;setBusy(true);engine.pause();const priorTimeline=timelineSnapshot();let bytes=project.items.reduce((n,x)=>n+x.blob.size,0),added=0;const errors=[];try{for(let i=0;i<files.length;i++){const file=files[i];notice(`Adding ${i+1} of ${files.length}… ${file.name}`);if(bytes+file.size>300*1024*1024){errors.push(`${file.name}: this local prototype has a 300 MB project limit.`);continue;}const type=file.type.startsWith('image/')?'image':file.type.startsWith('video/')?'video':null;if(!type||!(/\.(jpe?g|png|mp4|mov|webm)$/i.test(file.name))){errors.push(`${file.name}: choose JPG, PNG, MP4, MOV, or WebM.`);continue;}let loaded;try{loaded=await loadMedia(file,type);const thumb=await thumbnail(loaded.el);if(!thumb)throw Error('Could not make a thumbnail');const d=type==='video'?loaded.el.duration:null;project.items.push({id:crypto.randomUUID(),name:file.name,type,blob:file,thumb,seconds:project.pace,in:0,out:d,originalDuration:d});bytes+=file.size;added++;}catch(e){errors.push(`${file.name}: ${e.message}`);}finally{if(loaded){loaded.el.pause?.();URL.revokeObjectURL(loaded.url);}}}if(added){project.timelineUndo=priorTimeline;invalidateVoice();}await refresh();await save();notice(`${added} item${added===1?'':'s'} added. Drag the thumbnails or use arrows to change their order.${errors.length?' '+errors.join(' '):''}`,!!errors.length);}catch(e){report(e);}finally{setBusy(false);}}
const dropArea=$('emptyPreview');dropArea.ondragover=e=>{e.preventDefault();};dropArea.ondrop=e=>{e.preventDefault();importFiles([...e.dataTransfer.files]);};
$('projectName').oninput=e=>{project.name=e.target.value;invalidateExport();queueSave();};$('projectName').onchange=()=>engine.prepare(project,brand).catch(report);
$('cards').onchange=()=>{const checked=$('cards').checked;editTimeline(()=>{project.cards=checked;}).catch(report);};
$('pace').onchange=()=>{const pace=Number($('pace').value);editTimeline(()=>{project.pace=pace;for(const item of project.items)if(item.type==='image')item.seconds=pace;}).catch(report);};
function downloadBlob(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
const slug=()=>project.name.replace(/[^a-z0-9-]/gi,'-').replace(/-+/g,'-').slice(0,65)||'showpiece';
$('saveThumbnail').onclick=async()=>{if(busy||!project.items.length)return;engine.pause();$('play').textContent='▶ Play video';$('play').setAttribute('aria-label','Play preview');setBusy(true);try{await engine.seek(engine.time);const image=await new Promise((resolve,reject)=>$('preview').toBlob(blob=>blob?resolve(blob):reject(Error('Could not create the thumbnail. Try another frame.')),'image/jpeg',0.9));downloadBlob(image,slug()+'-thumbnail.jpg');notice('Thumbnail prepared as a 1920 × 1080 JPG. Use it when uploading your video. Your video allowance is unchanged.');}catch(e){report(e);}finally{setBusy(false);}};
const headlineHelp=document.createElement('p');headlineHelp.className='helper';headlineHelp.textContent='Choose a thumbnail photo, type your headline, then drag on the picture to position the text. You can also focus the picture and use arrow keys.';thumbnailRow.after(headlineHelp);
$('preview').tabIndex=0;let draggingHeadline=false;
function positionHeadline(e){const box=$('preview').getBoundingClientRect();project.thumbnailPosition={x:Math.max(.15,Math.min(.85,(e.clientX-box.left)/box.width)),y:Math.max(.15,Math.min(.85,(e.clientY-box.top)/box.height))};invalidateExport();engine.draw(engine.time);queueSave();}
$('preview').addEventListener('pointerdown',e=>{if(busy||!project.openingCover||!project.thumbnailText||engine.time>=2)return;engine.pause();draggingHeadline=true;$('preview').setPointerCapture(e.pointerId);positionHeadline(e);});
$('preview').addEventListener('pointermove',e=>{if(draggingHeadline)positionHeadline(e);});
for(const event of ['pointerup','pointercancel'])$('preview').addEventListener(event,()=>{draggingHeadline=false;});
$('preview').addEventListener('keydown',e=>{if(busy||!project.openingCover||!project.thumbnailText||engine.time>=2||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const p=project.thumbnailPosition||{x:.5,y:.45};project.thumbnailPosition={x:Math.max(.15,Math.min(.85,p.x+(e.key==='ArrowRight'?.02:e.key==='ArrowLeft'?-.02:0))),y:Math.max(.15,Math.min(.85,p.y+(e.key==='ArrowDown'?.02:e.key==='ArrowUp'?-.02:0)))};engine.draw(engine.time);invalidateExport();queueSave();});
$('thumbnailSize').onchange=()=>{project.thumbnailSize=$('thumbnailSize').value;invalidateExport();engine.seek(0).catch(report);queueSave();};
$('thumbnailText').oninput=()=>{project.thumbnailText=$('thumbnailText').value;invalidateExport();engine.seek(0).catch(report);queueSave();};
$('setCover').onclick=async()=>{if(busy||!project.items.length)return;engine.pause();$('play').textContent='Play video';setBusy(true);try{await engine.seek(engine.time);engine.suppressThumbnailText=true;engine.draw(engine.time);const image=await new Promise((resolve,reject)=>$('preview').toBlob(b=>b?resolve(b):reject(Error('Could not save this frame. Try another frame.')),'image/jpeg',.9));engine.suppressThumbnailText=false;project.openingCover=image;project.coverItemId=null;const addedCards=!project.cards;project.cards=true;if(addedCards)invalidateVoice();$('cards').checked=true;invalidateExport();await refresh();await save();$('clearCover').hidden=false;const finishedThumbnail=await new Promise(resolve=>$('preview').toBlob(resolve,'image/jpeg',.9));if(finishedThumbnail)downloadBlob(finishedThumbnail,slug()+'-thumbnail.jpg');notice('Thumbnail saved and set as your opening slide. The same JPG downloads for YouTube. Existing recordings are preserved. Review timing if opening cards were previously off.');return true;}catch(e){report(e);}finally{engine.suppressThumbnailText=false;setBusy(false);}};
$('clearCover').onclick=async()=>{if(busy)return;setBusy(true);try{project.openingCover=null;project.coverItemId=null;invalidateExport();await refresh();await save();$('clearCover').hidden=true;notice('Original title slide restored.');}catch(e){report(e);}finally{setBusy(false);}};
$('download').onclick=async e=>{e.preventDefault();if(busy)return;try{notice('Choose a folder and filename in the Save video dialog.');const result=await saveVideo($('download').href,$('download').download||slug()+'.mp4');notice(result.saved?'Video saved as '+result.name+'.':result.cancelled?'Save cancelled. Your finished video is still available.':'Download requested. Check your browser downloads; its settings control where files are saved.');}catch(e){report(e);}};
$('play').onclick=async()=>{try{if(engine.playing){engine.pause();$('play').textContent='▶ Play video';$('play').setAttribute('aria-label','Play preview');}else{await engine.play();$('play').textContent='Ⅱ Pause video';$('play').setAttribute('aria-label','Pause preview');}}catch(e){report(e);}};
$('scrub').oninput=()=>{engine.seek(Number($('scrub').value)).catch(report);$('play').textContent='▶ Play video';};
async function openProject(id){if(busy)return;await save().catch(()=>{});project=projects.find(p=>p.id===id)||project;hydrateFields();invalidateExport();await refresh();queueSave();window.scrollTo({top:0,behavior:'smooth'});}
$('newProject').onclick=async()=>{if(busy)return;await save().catch(()=>{});project=blank();hydrateFields();invalidateExport();await refresh();await save().catch(()=>{});notice('A fresh start. Add your photos and clips to tell the next story.');};
$('saveBackup').onclick=async()=>{if(busy)return;engine.pause();setBusy(true);try{await save();const file=await makeBackup({project,brand});downloadBlob(file,slug()+'.showpiece');notice('Project backup prepared. Keep the downloaded .showpiece file safe; it includes your media and recordings.');}catch(e){report(e);}finally{setBusy(false);}};
$('openBackup').onclick=()=>{if(!busy)$('backupFile').click();};
$('backupFile').onchange=async()=>{const file=$('backupFile').files[0];$('backupFile').value='';if(!file||busy)return;engine.pause();setBusy(true);const previous=project,previousProjects=projects.slice();try{const data=await readBackup(file);await save();const restored=structuredClone(data.project);restored.id=crypto.randomUUID();restored.name=restored.name.slice(0,88)+' (restored)';restored.updated=Date.now();restored.backupBrand=data.brand;project=restored;hydrateFields();invalidateExport();await refresh();await save();notice('Backup restored as a separate project. Your existing projects and business brand are unchanged. Use Restore backup brand if you want its saved branding.');$('restoreBackupBrand').hidden=false;}catch(e){project=previous;projects=previousProjects;hydrateFields();await refresh().catch(()=>{});report(e);}finally{setBusy(false);}};
const restoreBrandButton=document.createElement('button');restoreBrandButton.id='restoreBackupBrand';restoreBrandButton.className='text-button';restoreBrandButton.textContent='Restore backup brand';restoreBrandButton.hidden=true;backupTools.append(restoreBrandButton);restoreBrandButton.onclick=async()=>{if(busy||!project.backupBrand)return;if(!confirm('Replace the current business branding with the brand in this backup? Your project media will stay unchanged.'))return;brand=structuredClone(project.backupBrand);renderBrand();await refresh();await save().catch(report);};
$('projectsNav').onclick=()=>document.querySelector('.projects-list').scrollIntoView({behavior:'smooth'});
function openBrand(){if(busy)return;removeLogo=false;$('removeLogo').textContent='Remove saved logo';for(const key of ['name','website','phone','cta','color'])$('brandForm').elements.namedItem(key).value=brand[key];$('logo').value='';$('brandDialog').showModal();}
$('brandNav').onclick=openBrand;$('editBrand').onclick=openBrand;$('closeBrand').onclick=()=>$('brandDialog').close();
let removeLogo=false;$('removeLogo').onclick=()=>{removeLogo=true;$('removeLogo').textContent='Logo will be removed when you save';};
$('brandForm').onsubmit=async e=>{e.preventDefault();try{const form=new FormData(e.target);for(const key of ['name','website','phone','cta','color'])brand[key]=String(form.get(key)||'');if(removeLogo)brand.logo=null;const file=$('logo').files[0];if(file){if(file.size>5*1024*1024)throw Error('Please use a logo smaller than 5 MB.');const loaded=await loadMedia(file,'image');URL.revokeObjectURL(loaded.url);brand.logo=file;}removeLogo=false;$('removeLogo').textContent='Remove saved logo';$('brandDialog').close();invalidateExport();await refresh();await save();await api('/api/brand',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:brand.name,website:brand.website,phone:brand.phone,cta:brand.cta,color:brand.color})});notice('Brand details saved to your account. Your logo stays on this device.');}catch(e){report(e);}};

function recordHUD(time){
 const rec=recording;if(!rec)return;
 $('recordTimer').textContent=fmt(Math.max(0,time-rec.start));
 const s=atTime(project,time),photo=s?.kind==='image',live=rec.recorder?.state==='recording';
 $('holdPhoto').disabled=!photo||!live;
 $('holdPhoto').textContent=engine.holding?'Continue video →':'Hold this photo';
 $('holdPhoto').setAttribute('aria-pressed',String(engine.holding));
 $('recordDialog').classList.toggle('recording-held',engine.holding);
 $('holdHelp').textContent=engine.holding?'This photo is staying on screen while you talk. Click Continue video when ready.':photo?'Need more time? Hold this photo while you explain it.':'Video clips and cards keep their timing. Hold becomes available on a photo.';
}
function releaseRecording(rec){
 cancelAnimationFrame(rec.meterFrame);rec.micSource?.disconnect();rec.analyser?.disconnect();rec.stream?.getTracks().forEach(t=>t.stop());
 $('micLevel').value=0;$('recordDialog').classList.remove('recording-held');engine.holding=false;
}
function meterRecording(rec){
 if(recording!==rec)return;
 $('recordingCanvas').getContext('2d').drawImage($('preview'),0,0,640,360);
 const visible=atTime(project,engine.time);$('recordingSlide').textContent=visible?.item?'Slide '+(project.items.findIndex(item=>item.id===visible.item.id)+1)+' of '+project.items.length+' · '+visible.item.name:visible?.kind==='title'?'Opening card':visible?.kind==='outro'?'Closing card':'Your video';
 const values=new Uint8Array(rec.analyser.fftSize);rec.analyser.getByteTimeDomainData(values);
 const rms=Math.sqrt(values.reduce((n,v)=>n+((v-128)/128)**2,0)/values.length);
 rec.peak=Math.max(rec.peak||0,rms);$('micLevel').value=Math.min(1,rms*4);
 $('micHint').textContent=rec.recorder?.state==='recording'&&engine.time-rec.start>2&&rec.peak<.002?'No microphone signal detected yet. Check your microphone or input selection.':'';
 rec.meterFrame=requestAnimationFrame(()=>meterRecording(rec));
}
async function startRecording(key=null){
 if(busy||!project.items.length)return;
 const section=key?segments(project).find(s=>segmentKey(s)===key):null;
 if(key&&!section)return;
 const rec={key,start:section?.start||0,before:timelineSnapshot(),stream:null,recorder:null,peak:0,finish:false,pending:true};
 recording=rec;engine.pause();setBusy(true);
 $('recordStatus').textContent='Allow microphone access to get ready.';$('recordTimer').textContent='—';$('pauseRecord').disabled=true;$('finishRecord').disabled=true;$('holdPhoto').disabled=true;$('micHint').textContent='';$('recordDialog').show();
 try{
  const stream=await devices.microphone();if(recording!==rec){stream.getTracks().forEach(t=>t.stop());return;}rec.stream=stream;
  await engine.audioSetup();await engine.seek(rec.start);if(recording!==rec)return;
  rec.micSource=engine.audio.createMediaStreamSource(stream);rec.analyser=engine.audio.createAnalyser();rec.analyser.fftSize=1024;rec.micSource.connect(rec.analyser);meterRecording(rec);
  for(let n=3;n>0;n--){if(recording!==rec)return;$('recordStatus').textContent='Starts in '+n+'…';$('recordTimer').textContent=String(n);await new Promise(resolve=>setTimeout(resolve,1000));}
  if(recording!==rec)return;
  const mime=audioMime(),chunks=[];rec.recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);rec.chunks=chunks;
  rec.recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  rec.recorder.onstop=async()=>{
   releaseRecording(rec);if(recording===rec)recording=null;$('recordDialog').close();engine.pause();
   let message='Take discarded. Your previous recordings and photo timing are unchanged.';
   if(!rec.discard&&chunks.length&&rec.end>rec.start+.1){
    const count=saveTake(project,{blob:new Blob(chunks,{type:rec.recorder.mimeType}),start:rec.start,end:rec.end,key:rec.key});
    project.narratedAt=Date.now();project.timelineUndo=rec.before;invalidateExport();
    message=count+' section'+(count===1?'':'s')+' saved. Preview to hear your voice with the video.'+(rec.peak<.002?' No microphone signal was detected; check playback and re-record if needed.':'');
   }else Object.assign(project,rec.before);
   try{await refresh();await save();notice(message,rec.peak<.002&&!rec.discard);}catch(e){report(e);setBusy(false);}
  };
  rec.recorder.onerror=()=>{notice('Recording failed. Your previous takes are safe.',true);finishRecording(false);};
  rec.pending=false;rec.peak=0;$('recordStatus').textContent=key?'Recording this section — your other takes are safe.':'Recording — tell the story as your video plays.';
  $('pauseRecord').disabled=false;$('pauseRecord').textContent='Pause';$('finishRecord').disabled=false;
  rec.recorder.start(250);await engine.play('record',key);
 }catch(e){
  if(recording!==rec)return;
  if(rec.recorder?.state&&rec.recorder.state!=='inactive')finishRecording(false);
  else{releaseRecording(rec);recording=null;$('recordDialog').close();Object.assign(project,rec.before);await refresh().catch(report);setBusy(false);}
  notice(e.name==='NotAllowedError'?'Microphone access was declined. Your previous takes are safe. Allow microphone access in the browser and try again.':e.message,true);
 }
}
function finishRecording(keep){
 const rec=recording;if(!rec||rec.finish)return;rec.finish=true;rec.discard=!keep;rec.end=engine.time;engine.pause();
 if(rec.recorder&&rec.recorder.state!=='inactive'){rec.recorder.stop();$('recordStatus').textContent='Saving your take…';$('pauseRecord').disabled=true;$('finishRecord').disabled=true;}
 else{releaseRecording(rec);recording=null;$('recordDialog').close();Object.assign(project,rec.before);refresh().catch(report);notice('Recording cancelled. Your saved takes are unchanged.');}
}
$('narrate').onclick=()=>startRecording($('narrationScope').value||null);
$('finishRecord').onclick=()=>finishRecording(true);$('cancelRecord').onclick=()=>finishRecording(false);
$('recordDialog').addEventListener('cancel',e=>{e.preventDefault();finishRecording(false);});
$('holdPhoto').onclick=()=>{const s=atTime(project,engine.time);if(recording?.recorder?.state!=='recording'||s?.kind!=='image')return;if(engine.holding)continuePhoto(project,segmentKey(s),engine.time-s.start);engine.holding=!engine.holding;recordHUD(engine.time);};
$('pauseRecord').onclick=async()=>{
 const rec=recording;if(!rec?.recorder)return;
 if(rec.recorder.state==='recording'){rec.recorder.pause();engine.pause();$('pauseRecord').textContent='Resume';$('recordStatus').textContent='Paused — take your time.';recordHUD(engine.time);}
 else if(rec.recorder.state==='paused'){rec.recorder.resume();await engine.play('record',rec.key);$('pauseRecord').textContent='Pause';$('recordStatus').textContent='Recording — continue your story.';}
};
$('listenVoice').onclick=async()=>{
 const key=$('narrationScope').value,s=key?segments(project).find(x=>segmentKey(x)===key):null;
 await engine.seek(s?.start||0);await engine.play('preview',key||null);$('play').textContent='Ⅱ Pause video';
};
$('deleteVoice').onclick=async()=>{
 const key=$('narrationScope').value;
 if(!confirm(key?'Remove narration from this section? Other takes will stay.':'Remove all saved narration from this project?'))return;
 if(key)project.voice.takes=takesFor(project).filter(t=>t.key!==key);else project.voice=null;
 invalidateExport();await refresh();queueSave();
};
$('export').onclick=async()=>{
 if(busy)return;if(reviewKeys(project).length){notice('Review changed narration timing before exporting.',true);return;}
 setBusy(true);abortExport=new AbortController();let job=null,complete=false;
 $('progressWrap').hidden=false;$('progress').value=0;$('progressLabel').textContent='Checking your video allowance…';
 try{
  job=await api('/api/exports',{method:'POST'});invalidateExport();
  if(abortExport.signal.aborted)throw new DOMException('Export cancelled','AbortError');
  notice('Preparing your video file quietly. You do not need to watch it again. Keep this tab open and visible until the download is ready.');
  const blob=await engine.export(p=>{$('progress').value=p*.8;$('progressLabel').textContent='Preparing video file… '+Math.round(p*100)+'% (about '+fmt(total(project)*(1-p))+' remaining)';},abortExport.signal);
  if(!blob.size)throw Error('The encoder returned an empty video.');
  if(blob.size>64*1024*1024)throw Error('This finished video is larger than 64 MB. Shorten it and try again. Your allowance has not been used.');
  $('progressLabel').textContent='Uploading your finished video privately…';$('progress').value=.85;
  const result=await api('/api/exports/'+job.id,{method:'PUT',headers:{'Content-Type':blob.type.startsWith('video/mp4')?'video/mp4':'video/webm'},body:blob,signal:abortExport.signal});
  complete=true;$('progress').value=1;$('download').href=result.download;$('download').download=slug()+(blob.type.startsWith('video/mp4')?'.mp4':'.webm');$('download').textContent='Save finished '+(blob.type.startsWith('video/mp4')?'MP4':'WebM')+' to my computer';$('download').hidden=false;
  notice('Your video is ready. Click Save finished video to choose its folder and filename. You do not need to export again.');
 }catch(e){if(e.name==='AbortError')notice('Export cancelled. Your project is safe.',true);else report(e);}
 finally{
  if(job&&!complete)await api('/api/exports/'+job.id,{method:'DELETE'}).catch(()=>{});
  abortExport=null;setBusy(false);$('progressWrap').hidden=true;$('play').textContent='▶ Play video';accountRefresh();
 }
};
$('stop').onclick=()=>abortExport?.abort();
document.addEventListener('visibilitychange',()=>{if(document.hidden&&abortExport){abortExport.abort();notice('Export stopped because this tab was hidden. Keep ShowPiece.Pro visible while exporting.',true);}if(document.hidden&&recording?.recorder?.state==='recording')$('pauseRecord').click();});
window.addEventListener('beforeunload',e=>{if(busy||saveTimer){e.preventDefault();e.returnValue='';}});
async function init(){try{hostedAccount=await api('/api/account');setNamespace(hostedAccount.user.id);const state=await read('workspace');if(state){brand=state.brand;projects=state.projects;project=projects.find(p=>p.id===state.current)||projects[0]||blank();}if(hostedAccount.brand?.name)brand={...brand,...hostedAccount.brand,logo:brand.logo};hydrateFields();await refresh();await save();const mime=videoMime();$('exportHint').textContent=mime.startsWith('video/mp4')?'1080p · MP4 · rendered on your device':mime?'1080p · WebM here · MP4 needs a compatible browser':'Video recording unavailable in this browser';$('exportHint').textContent=(mime.startsWith('video/mp4')?'MP4':'WebM')+' · '+(hostedAccount.allowance.administrator?'Administrator · Unlimited videos':hostedAccount.allowance.active?'Pro account':'First finished video free')+' · private finished-video upload';}catch(e){report(e);setBusy(false);}}
init();

export async function saveVideo(url,name,options={}){
 const host=options.host||window,doc=options.document||document,request=options.fetch||fetch;
 const filename=name.replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,150),mp4=filename.endsWith('.mp4');
 let handle;
 if(typeof host.showSaveFilePicker==='function'){
  try{handle=await host.showSaveFilePicker({suggestedName:filename,types:[{description:mp4?'MP4 video':'WebM video',accept:{[mp4?'video/mp4':'video/webm']:[mp4?'.mp4':'.webm']}}]});}
  catch(e){if(e.name==='AbortError')return {cancelled:true};if(!['SecurityError','NotAllowedError','NotSupportedError'].includes(e.name))throw e;}
 }
 if(handle){let writer;try{const response=await request(url,{credentials:'same-origin'});if(!response.ok)throw Error('The video could not be downloaded. It may have expired.');const blob=await response.blob();if(!blob.size)throw Error('The video file was empty. Please try again.');writer=await handle.createWritable();await writer.write(blob);await writer.close();return {saved:true,name:handle.name||filename};}catch(e){if(writer)await writer.abort().catch(()=>{});throw e;}}
 const link=doc.createElement('a'),download=new URL(url,host.location.href);download.searchParams.set('filename',filename);link.href=download.href;link.download=filename;doc.body.append(link);link.click();link.remove();return {downloadRequested:true};
}

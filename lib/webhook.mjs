export async function verifyStripe(raw,header,secret,now=Date.now()){
 if(!secret||!header)return false;const values=header.split(',').map(x=>x.split('='));const timestamp=Number(values.find(([k])=>k==='t')?.[1]);if(!Number.isFinite(timestamp)||Math.abs(now/1000-timestamp)>300)return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 for(const [name,hex]of values){if(name!=='v1'||!/^([a-f0-9]{2}){32}$/i.test(hex))continue;const bytes=Uint8Array.from(hex.match(/../g),x=>parseInt(x,16));if(await crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(timestamp+'.'+raw)))return true;}return false;
}

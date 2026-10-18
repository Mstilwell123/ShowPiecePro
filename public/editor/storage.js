let db;
let namespace='locked';
export function setNamespace(value){namespace=String(value);}
function open(){return db?Promise.resolve(db):new Promise((resolve,reject)=>{const r=indexedDB.open('showpiece-pro',1);r.onupgradeneeded=()=>r.result.createObjectStore('records');r.onsuccess=()=>resolve(db=r.result);r.onerror=()=>reject(r.error);});}
export async function read(key){const scoped=namespace+':'+key,d=await open();return new Promise((resolve,reject)=>{const r=d.transaction('records').objectStore('records').get(scoped);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function write(key,value){const scoped=namespace+':'+key,d=await open();return new Promise((resolve,reject)=>{const tx=d.transaction('records','readwrite');tx.objectStore('records').put(value,scoped);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Storage interrupted'));});}

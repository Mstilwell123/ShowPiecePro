export const paid=(a,now=Date.now())=>a.status==='active'&&a.period_end>now;
export const monthlyLimit=value=>value==='unlimited'?-1:Math.max(1,Math.min(1000,Number(value)||30));
export async function reserve(db,account,now=Date.now(),limit=30){
 await db.prepare("UPDATE video_exports SET state='cancelled' WHERE user_id=? AND state IN ('reserved','uploading') AND expires<?").bind(account.id,now).run();
 const admin=account.role==='administrator',active=admin||paid(account,now),period=admin?-1:active?account.period_start:0,id=crypto.randomUUID();if(admin)limit=-1;
 const statement=active
  ? "INSERT INTO video_exports (id,user_id,state,free_trial,period_start,created,expires) SELECT ?,?,'reserved',0,?,?,? WHERE ? < 0 OR (SELECT COUNT(*) FROM video_exports WHERE user_id=? AND free_trial=0 AND period_start=? AND state IN ('reserved','uploading','completed')) < ?"
  : "INSERT OR IGNORE INTO video_exports (id,user_id,state,free_trial,period_start,created,expires) VALUES (?,?,'reserved',1,?,?,?)";
 const args=[id,account.id,period,now,now+60*60*1000];if(active)args.push(limit,account.id,period,limit);
 const result=await db.prepare(statement).bind(...args).run();
 return result.meta.changes?{id,expires:now+60*60*1000,free:!active}:null;
}
export async function allowance(db,account,now=Date.now(),limit=30){
 const a=await db.prepare("SELECT SUM(CASE WHEN free_trial=1 THEN 1 ELSE 0 END) as free_used,SUM(CASE WHEN free_trial=0 AND period_start=? THEN 1 ELSE 0 END) as paid_used FROM video_exports WHERE user_id=? AND (state='completed' OR (state IN ('reserved','uploading') AND expires>?))").bind(account.period_start,account.id,now).first();
 const admin=account.role==='administrator',active=admin||paid(account,now);return {active,administrator:admin,used:active?Number(a?.paid_used||0):Number(a?.free_used||0),limit:admin?-1:active?limit:1};
}

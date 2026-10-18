import {sqliteTable,text,integer,index,uniqueIndex} from 'drizzle-orm/sqlite-core';
import {sql} from 'drizzle-orm';
export const accounts=sqliteTable('accounts',{
 id:text('id').primaryKey(),email:text('email').notNull(),customer:text('customer').unique(),subscription:text('subscription').unique(),
 status:text('status').notNull().default('free'),periodStart:integer('period_start').notNull().default(0),periodEnd:integer('period_end').notNull().default(0),
 brand:text('brand').notNull().default('{}'),created:integer('created').notNull()
});
export const videoExports=sqliteTable('video_exports',{
 id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>accounts.id),state:text('state').notNull(),
 free:integer('free_trial').notNull(),period:integer('period_start').notNull(),created:integer('created').notNull(),expires:integer('expires').notNull(),
 objectKey:text('object_key'),mime:text('mime'),bytes:integer('bytes')
},t=>[index('exports_owner').on(t.userId,t.period),uniqueIndex('one_free_video_per_account').on(t.userId).where(sql`${t.free} = 1 and ${t.state} in ('reserved','uploading','completed')`)]);

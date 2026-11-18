import {z} from 'zod';
export const supportCategories=['account','billing','technical','other'] as const;
export const supportStatuses=['open','in_progress','waiting_user','closed'] as const;
export const supportCreate=z.object({action:z.literal('create'),id:z.string().uuid(),category:z.enum(supportCategories),subject:z.string().trim().min(5).max(120),body:z.string().trim().min(10).max(3000)});
export const supportReply=z.object({action:z.literal('reply'),id:z.string().uuid(),messageId:z.string().uuid(),body:z.string().trim().min(2).max(3000)});
export const supportSeen=z.object({action:z.literal('seen'),id:z.string().uuid()});
export const adminSupportReply=z.object({id:z.string().uuid(),messageId:z.string().uuid(),status:z.enum(supportStatuses),body:z.string().trim().max(3000)});
export type SupportMessage={id:string;ticket_id:string;author_role:'user'|'admin';body:string;created_at:number};
export type SupportTicket={id:string;user_id:string;email?:string;category:string;subject:string;status:string;unread_user:number;created_at:number;updated_at:number;messages:SupportMessage[]};

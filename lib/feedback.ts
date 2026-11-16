import {z} from 'zod';
export const feedbackKinds=['problem','suggestion','rating'] as const;
export const feedbackStatuses=['received','reviewing','planned','resolved'] as const;
export const feedbackInput=z.object({action:z.literal('create'),id:z.string().uuid(),kind:z.enum(feedbackKinds),rating:z.number().int().min(1).max(5),body:z.string().trim().min(10).max(3000),page:z.string().max(120).regex(/^\/[a-zA-Z0-9/_-]*$/),version:z.string().max(60)});
export const feedbackMessage=z.object({action:z.literal('reply'),id:z.string().uuid(),messageId:z.string().uuid(),body:z.string().trim().min(2).max(3000)});
export const feedbackSeen=z.object({action:z.literal('seen'),id:z.string().uuid()});
export const adminFeedbackInput=z.object({id:z.string().uuid(),messageId:z.string().uuid(),status:z.enum(feedbackStatuses),body:z.string().trim().max(3000)});
export type FeedbackMessage={id:string;author_role:'user'|'admin';body:string;created_at:number};
export type FeedbackEntry={id:string;kind:typeof feedbackKinds[number];rating:number;body:string;page:string;version:string;status:typeof feedbackStatuses[number];unread:number;created_at:number;updated_at:number;email?:string;messages:FeedbackMessage[]};

import type {Appearance} from './plans';
export type Kind = 'task' | 'event' | 'expense' | 'note' | 'reminder' | 'alarm' | 'message';
export type Item = {
    id: string;
    type: Kind;
    title: string;
    date: string;
    time: string;
    end: string;
    amount: number;
    category: string;
    body: string;
    color: string;
    repeat: string;
    done: boolean;
    pinned: boolean;
    archived: boolean;
    tags: string;
    days: string[];
    notify: boolean;
    checks: string[];
    soundAlarm?: boolean;
    enabled?: boolean;
    sticker?: string;
    completedDates?: string[];
    skipDates?: string[];
};
export type Data = {
    items: Item[];
    budget: number;
    onboarded: boolean;
    timezone: string;
    appearance?: Appearance;
    budgetReviews?: Record<string,{reason:string;total:number;budget:number;at:string}>;
    routineTemplates?: {id:string;name:string;items:{title:string;time:string}[]}[];
};
export const dayDate = (s: string) => new Date(s + 'T12:00:00');
export function occurs(x: Item, date: string) { if (x.archived || x.date > date || x.skipDates?.includes(date))
    return false; if (x.date === date)
    return true; if (x.repeat === 'daily')
    return true; if (x.repeat === 'weekly')
    return dayDate(x.date).getDay() === dayDate(date).getDay(); if (x.repeat === 'monthly') {
    const last = new Date(+date.slice(0, 4), +date.slice(5, 7), 0).getDate();
    return +date.slice(8) === Math.min(+x.date.slice(8), last);
} return x.days.includes(String(dayDate(date).getDay())); }
export function isDone(x: Item, date: string) { return x.repeat !== 'none' || x.days.length > 0 ? !!x.completedDates?.includes(date) : x.done; }
export function monthExpenses(items: Item[], month: string) { const days = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate(); return items.filter(x => x.type === 'expense').flatMap(x => Array.from({ length: days }, (_, i) => month + '-' + String(i + 1).padStart(2, '0')).filter(d => occurs(x, d)).map(d => ({ ...x, date: d }))); }

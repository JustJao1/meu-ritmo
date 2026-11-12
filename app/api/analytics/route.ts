import {env} from 'cloudflare:workers';
export async function GET(){const e=env as unknown as Record<string,string>;const id=e.GA_MEASUREMENT_ID||'';return Response.json({id:e.GA_ENABLED==='true'&&/^G-[A-Z0-9]{5,20}$/.test(id)?id:null},{headers:{'Cache-Control':'no-store'}})}

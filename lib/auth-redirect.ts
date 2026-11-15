/** Keep password-recovery links within the environment that initiated the request. */
export function recoveryRedirect(requestUrl:string){return new URL('/nova-senha',requestUrl).toString();}

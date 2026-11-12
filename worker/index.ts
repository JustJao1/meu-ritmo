import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

import {requestGuard,secureResponse,boundedRequest} from "../lib/request-security";

const worker = {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    const path=new URL(request.url).pathname;
    try {
    const denied=await requestGuard(request,env.DB!);
    if(denied)return secureResponse(denied,path);
    try {request=await boundedRequest(request,path==='/api/avatar'?524288:1_600_000);} catch {return secureResponse(Response.json({error:'O conteúdo enviado ultrapassa o limite permitido.'},{status:413}),path);}
    if(path.startsWith('/api/')&&!['/api/avatar','/api/billing/webhook'].includes(path)&&!['GET','HEAD','OPTIONS'].includes(request.method)){
      if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return secureResponse(Response.json({error:'Envie os campos no formato JSON.'},{status:415}),path);
      try {await request.clone().json();} catch {return secureResponse(Response.json({error:'Os dados enviados estão incompletos ou inválidos.'},{status:400}),path);}
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    const response=await runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
    if(response.status>=500)return secureResponse(path.startsWith('/api/')?Response.json({error:'Não foi possível concluir. Tente novamente em instantes.'},{status:503}):new Response('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Meu Ritmo</title><main><h1>Não foi possível abrir esta página.</h1><p>Tente novamente em instantes.</p><a href="/">Voltar ao início</a></main></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}}),path);
    return secureResponse(response,path);
    } catch {return secureResponse(Response.json({error:'Serviço temporariamente indisponível.'},{status:503}),path);}
  },
};

export default worker;

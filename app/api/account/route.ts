import {publicProfile} from '../../../lib/social';
import {getChatGPTUser} from '../../chatgpt-auth';
import {appRole,registerMember} from '../../../lib/admin-access';
import {planAccess} from '../../../lib/entitlements';
export async function GET(){const u=await getChatGPTUser();if(!u)return Response.json({error:'Entre na sua conta.'},{status:401});try{await registerMember(u);return Response.json({role:await appRole(u),access:await planAccess(u.userId),email:u.email,profile:await publicProfile(u.userId)},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Não foi possível consultar seu perfil. Tente novamente.'},{status:503});}}

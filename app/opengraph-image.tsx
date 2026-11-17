import { ImageResponse } from 'next/og';
export const alt = 'MR: Meu Ritmo — organize sua rotina e finanças';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export default function Image() {
 return new ImageResponse(
 <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',background:'#f6f4ec',color:'#28372c',fontFamily:'sans-serif',padding:'72px 74px'}}>
  <div style={{display:'flex',flexDirection:'column',width:'58%',justifyContent:'center'}}>
   <div style={{display:'flex',alignItems:'center',gap:18,marginBottom:40}}><div style={{display:'flex',width:69,height:69,borderRadius:18,background:'#2b382d',color:'#fff',alignItems:'center',justifyContent:'center',fontSize:27,fontWeight:800}}>MR</div><div style={{fontSize:36,fontWeight:700}}>MR: Meu Ritmo</div></div>
   <div style={{display:'flex',fontSize:16,fontWeight:700,letterSpacing:2,color:'#63755f',marginBottom:18}}>ROTINA E FINANÇAS</div>
   <div style={{display:'flex',flexDirection:'column',fontSize:66,lineHeight:1.12,fontWeight:800,letterSpacing:-2}}><div>Seu dia mais</div><div>organizado.</div></div>
   <div style={{display:'flex',fontSize:25,marginTop:31,color:'#657468'}}>Tarefas, agenda, ganhos e gastos</div><div style={{display:'flex',fontSize:25,color:'#657468'}}>em um só lugar.</div>
   <div style={{display:'flex',fontSize:18,marginTop:35,fontWeight:700}}>meuritmo.net</div>
  </div>
  <div style={{display:'flex',width:'42%',height:455,background:'#fffefa',border:'3px solid #e6e9df',borderRadius:30,padding:28,flexDirection:'column',gap:14}}>
   <div style={{display:'flex',fontSize:16,fontWeight:700,color:'#546f5c',padding:17,borderRadius:13,background:'#e4eddc'}}>HOJE, NO MEU RITMO</div>
   {['09:00  Organizar meu dia','18:00  Hora do treino','20:00  Rever minhas contas'].map((value,i)=><div key={value} style={{display:'flex',alignItems:'center',height:63,padding:'0 18px',background:'#f1f2eb',borderRadius:13,gap:13}}><div style={{display:'flex',width:19,height:19,borderRadius:19,background:['#ed947e','#9db49a','#a9a2d1'][i]}}/><div style={{fontSize:18}}>{value}</div></div>)}
   <div style={{display:'flex',marginTop:6,padding:15,borderRadius:13,background:'#e4eddc',fontSize:20,fontWeight:700}}>Um lugar para cada coisa.</div>
  </div>
 </div>,size);
}
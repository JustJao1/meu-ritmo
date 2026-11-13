const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'public, max-age=180, s-maxage=300','X-Content-Type-Options':'nosniff'}});
export async function GET(request:Request){
 const p=new URL(request.url).searchParams;
 const mode=p.get('mode');
 let upstream:URL;
 if(mode==='search'){
  const name=(p.get('name')||'').trim();
  if(name.length<2||name.length>100)return json({error:'Informe uma cidade válida.'},400);
  upstream=new URL('https://geocoding-api.open-meteo.com/v1/search');
  upstream.searchParams.set('name',name);upstream.searchParams.set('count','6');upstream.searchParams.set('language','pt');upstream.searchParams.set('format','json');
 }else if(mode==='forecast'){
  const lat=Number(p.get('lat')),lon=Number(p.get('lon'));
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||!p.has('lat')||!p.has('lon'))return json({error:'Coordenadas inválidas.'},400);
  upstream=new URL('https://api.open-meteo.com/v1/forecast');
  upstream.searchParams.set('latitude',String(lat));upstream.searchParams.set('longitude',String(lon));
  upstream.searchParams.set('current','temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m');
  upstream.searchParams.set('daily','temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code');
  upstream.searchParams.set('timezone','auto');upstream.searchParams.set('forecast_days','5');
 }else return json({error:'Consulta inválida.'},400);
 try{
  const response=await fetch(upstream.toString(),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)});
  if(!response.ok)return json({error:'Serviço meteorológico temporariamente indisponível.'},502);
  return json(await response.json());
 }catch{return json({error:'Não foi possível consultar a previsão agora.'},503);}
}

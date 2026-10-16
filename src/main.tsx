import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Geolocation } from '@capacitor/geolocation';
import './styles.css';

type Restaurant = { id:string; name:string; lat:number; lon:number; cuisine:string; address:string; phone?:string; website?:string; image?:string; distance:number };

const mirrors=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.nchc.org.tw/api/interpreter'];
const rad=(n:number)=>n*Math.PI/180;
const distanceKm=(a:number,b:number,c:number,d:number)=>{const R=6371,x=rad(c-a),y=rad(d-b),q=Math.sin(x/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(y/2)**2;return R*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));};
const address=(t:any)=>[t['addr:street'],t['addr:housenumber'],t['addr:postcode'],t['addr:city']].filter(Boolean).join(' ');
const photo=(t:any)=>t.image||t['contact:image']||undefined;

async function loadRestaurants(lat:number,lon:number):Promise<Restaurant[]>{
 const q=`[out:json][timeout:18];(nwr[amenity~"restaurant|cafe|fast_food"](around:5000,${lat},${lon}););out center tags;`;
 let last:any;
 for(const endpoint of mirrors){try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(q)});if(!r.ok)throw new Error(String(r.status));const j=await r.json();return j.elements.map((e:any)=>{const la=e.lat??e.center?.lat,lo=e.lon??e.center?.lon,t=e.tags||{};return {id:`${e.type}-${e.id}`,name:t.name||'Restaurante',lat:la,lon:lo,cuisine:(t.cuisine||'Sin especificar').replaceAll(';',', '),address:address(t)||'Dirección no disponible',phone:t.phone||t['contact:phone'],website:t.website||t['contact:website'],image:photo(t),distance:distanceKm(lat,lon,la,lo)};}).filter((x:any)=>Number.isFinite(x.distance)).sort((a:any,b:any)=>a.distance-b.distance);}catch(e){last=e;}}
 throw last||new Error('No se pudieron cargar restaurantes');
}

function App(){
 const [items,setItems]=useState<Restaurant[]>([]),[status,setStatus]=useState('Buscando tu ubicación…'),[maxKm,setMaxKm]=useState(5),[fav,setFav]=useState<string[]>(()=>JSON.parse(localStorage.getItem('acomer-favs')||'[]')),[selected,setSelected]=useState<Restaurant|null>(null);
 useEffect(()=>{(async()=>{try{await Geolocation.requestPermissions();const p=await Geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:15000});const r=await loadRestaurants(p.coords.latitude,p.coords.longitude);setItems(r);localStorage.setItem('acomer-cache',JSON.stringify(r));setStatus(`${r.length} sitios encontrados`);}catch(e){const cache=JSON.parse(localStorage.getItem('acomer-cache')||'[]');if(cache.length){setItems(cache);setStatus('Mostrando la última búsqueda guardada');}else setStatus('No se han podido cargar los restaurantes. Comprueba la ubicación y vuelve a intentarlo.');}})();},[]);
 const visible=useMemo(()=>items.filter(x=>x.distance<=maxKm),[items,maxKm]);
 const toggle=(id:string)=>{const n=fav.includes(id)?fav.filter(x=>x!==id):[...fav,id];setFav(n);localStorage.setItem('acomer-favs',JSON.stringify(n));};
 return <><header><div className="logo"><span>🍽️</span><b>A comer</b></div><p>Encuentra dónde comer cerca de ti</p></header><main><div className="toolbar"><label>Distancia <select value={maxKm} onChange={e=>setMaxKm(Number(e.target.value))}><option value="1">1 km</option><option value="2">2 km</option><option value="3.5">3,5 km</option><option value="5">5 km</option></select></label><strong>{status}</strong></div><section className="grid">{visible.map(r=><article key={r.id} onClick={()=>setSelected(r)}>{r.image?<img src={r.image} alt="" onError={e=>(e.currentTarget.style.display='none')}/>:<div className="noimg">🍽️<small>Foto no disponible</small></div>}<div className="body"><div className="row"><h2>{r.name}</h2><button onClick={e=>{e.stopPropagation();toggle(r.id)}}>{fav.includes(r.id)?'♥':'♡'}</button></div><p>{r.cuisine}</p><b>{r.distance.toFixed(1)} km</b></div></article>)}</section></main>{selected&&<div className="modal" onClick={()=>setSelected(null)}><div className="sheet" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSelected(null)}>×</button><h2>{selected.name}</h2><p>📍 {selected.address}</p><p>🍴 {selected.cuisine}</p><p>📏 {selected.distance.toFixed(1)} km</p>{selected.phone&&<p>☎️ {selected.phone}</p>}{selected.website&&<a href={selected.website} target="_blank">Web / menú</a>}<a target="_blank" href={`https://www.google.com/maps/search/?api=1&query=${selected.lat},${selected.lon}`}>Cómo llegar / Google Maps</a><textarea placeholder="Notas personales" defaultValue={localStorage.getItem('note-'+selected.id)||''} onChange={e=>localStorage.setItem('note-'+selected.id,e.target.value)}/></div></div>}</>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);

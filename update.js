const https = require("https");
const fs = require("fs");

const API_KEY = "8245823280194f62b10dfbbdb08216d5";

function get(path) {
  return new Promise((resolve, reject) => {
    https.get({
      hostname: "api.football-data.org",
      path: `/v4/${path}`,
      headers: { "X-Auth-Token": API_KEY },
    }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error("JSON parse error: " + data.slice(0,200))); }
      });
    }).on("error", reject);
  });
}

const FLAGS = {
  "Mexico":"🇲🇽","South Africa":"🇿🇦","Korea Republic":"🇰🇷","Czechia":"🇨🇿",
  "Canada":"🇨🇦","Bosnia and Herzegovina":"🇧🇦","Qatar":"🇶🇦","Switzerland":"🇨🇭",
  "Brazil":"🇧🇷","Morocco":"🇲🇦","Haiti":"🇭🇹","Scotland":"🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "USA":"🇺🇸","Paraguay":"🇵🇾","Australia":"🇦🇺","Turkey":"🇹🇷",
  "Germany":"🇩🇪","Curaçao":"🇨🇼","Côte d'Ivoire":"🇨🇮","Ecuador":"🇪🇨",
  "Netherlands":"🇳🇱","Japan":"🇯🇵","Sweden":"🇸🇪","Tunisia":"🇹🇳",
  "IR Iran":"🇮🇷","New Zealand":"🇳🇿","Belgium":"🇧🇪","Egypt":"🇪🇬",
  "Spain":"🇪🇸","Cabo Verde":"🇨🇻","Saudi Arabia":"🇸🇦","Uruguay":"🇺🇾",
  "France":"🇫🇷","Senegal":"🇸🇳","Norway":"🇳🇴","Iraq":"🇮🇶",
  "Argentina":"🇦🇷","Algeria":"🇩🇿","Austria":"🇦🇹","Jordan":"🇯🇴",
  "Portugal":"🇵🇹","DR Congo":"🇨🇩","Uzbekistan":"🇺🇿","Colombia":"🇨🇴",
  "England":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Croatia":"🇭🇷","Ghana":"🇬🇭","Panama":"🇵🇦",
};
const NAMES = {
  "Mexico":"México","South Africa":"Sudáfrica","Korea Republic":"Corea del Sur","Czechia":"Rep. Checa",
  "Canada":"Canadá","Bosnia and Herzegovina":"Bosnia-Herz.","Switzerland":"Suiza","Brazil":"Brasil",
  "Morocco":"Marruecos","Haiti":"Haití","USA":"EE.UU.","Turkey":"Turquía","Germany":"Alemania",
  "Côte d'Ivoire":"C. Marfil","Netherlands":"Países Bajos","Japan":"Japón","Sweden":"Suecia",
  "Tunisia":"Túnez","IR Iran":"Irán","New Zealand":"Nueva Zelanda","Belgium":"Bélgica",
  "Spain":"España","Saudi Arabia":"Arabia Saudita","France":"Francia","Norway":"Noruega",
  "Algeria":"Argelia","Jordan":"Jordania","Portugal":"Portugal","DR Congo":"RD Congo",
  "Uzbekistan":"Uzbekistán","England":"Inglaterra","Croatia":"Croacia","Ecuador":"Ecuador",
  "Curaçao":"Curazao","Paraguay":"Paraguay","Australia":"Australia","Senegal":"Senegal",
  "Iraq":"Iraq","Uruguay":"Uruguay","Egypt":"Egipto","Ghana":"Ghana","Argentina":"Argentina",
  "Austria":"Austria","Colombia":"Colombia","Panama":"Panamá","Cabo Verde":"Cabo Verde",
};
const n = t => NAMES[t] || t;
const f = t => FLAGS[t] || "🏳";

function clHour(utc) {
  return new Date(utc).toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"America/Santiago"});
}
function clDateShort(utc) {
  return new Date(utc).toLocaleDateString("es-CL",{day:"numeric",month:"short",timeZone:"America/Santiago"});
}
function clDateLong(utc) {
  return new Date(utc).toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"long",timeZone:"America/Santiago"});
}
function isToday(utc) {
  const today = new Date().toLocaleDateString("es-CL",{timeZone:"America/Santiago"});
  return new Date(utc).toLocaleDateString("es-CL",{timeZone:"America/Santiago"}) === today;
}
function scoreClass(h,a) { return h>a?"w":h<a?"l":"d"; }


// ── ANÁLISIS MANUAL POR PARTIDO ──
const ANALISIS = {
  "Netherlands_Sweden":{ganador:"Partido muy abierto. Países Bajos cedió 2-2 vs Japón al 89'. Suecia goleó 5-1 a Túnez. Puede ir para cualquier lado.",goleadores:"Viktor Gyökeres (Suecia) — goleador del torneo. Gakpo y Depay (Países Bajos) también muy peligrosos.",figura:"Viktor Gyökeres (Suecia) — en la mejor forma de su carrera. Puede decidir el partido él solo.",apuesta:"Ambos anotan · Más de 2.5 goles · Gyökeres anota. Cuota est: 1.9x"},
  "Germany_Côte d'Ivoire":{ganador:"Alemania clarísima favorita. Viene de 7-1. C. Marfil ganó su J1 al 90' pero no tiene nivel para los alemanes. Goleada probable.",goleadores:"Havertz (doblete J1) y Musiala son los más letales. Amad Diallo (C. Marfil) es el único peligro.",figura:"Jamal Musiala (Alemania) — el más habilidoso del torneo, 22 años.",apuesta:"Alemania gana · Musiala anota o asiste · Más de 3.5 goles. Cuota est: 2.0x"},
  "Ecuador_Curaçao":{ganador:"Ecuador necesita ganar sí o sí tras perder 0-1 vs C. Marfil al 90'. Curazao fue goleado 1-7 por Alemania.",goleadores:"Enner Valencia (Ecuador) — histórico capitán. Moisés Caicedo puede aportar desde el mediocampo.",figura:"Moisés Caicedo (Ecuador) — uno de los mejores mediocampistas del mundo (Chelsea).",apuesta:"Ecuador gana · Más de 2.5 goles · Valencia anota. Cuota est: 1.8x"},
  "Tunisia_Japan":{ganador:"Japón demostró nivel empatando con Países Bajos al 89'. Túnez fue goleado 1-5 por Suecia. Japón favorito claro.",goleadores:"Daichi Kamada (Japón) — marcó el 2-2 al 89' vs Países Bajos. Ritsu Doan también peligroso.",figura:"Takumi Minamino (Japón) — mediocampista que aparece en el área. Motor japonés junto a Kamada.",apuesta:"Japón gana · Más de 1.5 goles · Kamada anota. Cuota est: 2.2x"},
  "Spain_Saudi Arabia":{ganador:"España obligada a reaccionar tras el 0-0 vs Cabo Verde. Arabia Saudita igualó con Uruguay. Los españoles tienen más calidad pero la presión es enorme.",goleadores:"Pedri y Morata son los más peligrosos. Arabia busca contraataque con Al-Dawsari.",figura:"Pedri (España) — el mediocampista más creativo cuando está inspirado. España lo necesita.",apuesta:"España gana · Pedri con asistencia. Cuota est: 1.9x"},
  "Belgium_IR Iran":{ganador:"Bélgica igualó 1-1 con Egipto. Irán cedió 2-2 con Nueva Zelanda. Partido equilibrado entre dos equipos irregulares.",goleadores:"Romelu Lukaku (Bélgica) si está en forma es letal. Mehdi Taremi (Irán) referente ofensivo.",figura:"Kevin De Bruyne (Bélgica) — si aparece, cambia el partido. Gran esperanza belga.",apuesta:"Bélgica gana por la mínima · Menos de 3 goles. Cuota est: 2.3x"},
  "Uruguay_Cabo Verde":{ganador:"Uruguay igualó 1-1 con Arabia (Araújo al 80'). Cabo Verde empató 0-0 con España sorprendiendo. Uruguay tiene más historia.",goleadores:"Darwin Núñez (Uruguay) — el más peligroso en ataque.",figura:"Federico Valverde (Uruguay) — mediocampista del Real Madrid, motor del equipo celeste.",apuesta:"Uruguay gana · Darwin Núñez anota. Cuota est: 2.1x"},
  "New Zealand_Egypt":{ganador:"Nueva Zelanda cedió 2-2 con Irán. Egipto empató 1-1 con Bélgica. Partido parejo entre dos equipos irregulares.",goleadores:"Chris Wood (Nueva Zelanda). Omar Marmoush (Egipto) viene de gran temporada en Europa.",figura:"Chris Wood (Nueva Zelanda) — delantero referente. Puede ser la figura.",apuesta:"Empate o Egipto gana · Menos de 2.5 goles. Cuota est: 2.0x"},
  "Argentina_Austria":{ganador:"Argentina viene de 3-0 a Argelia con hat-trick de Messi. Austria ganó 3-1 a Jordania. El partido más atractivo de la jornada.",goleadores:"Messi (Argentina) en modo histórico — 16 goles mundiales. Arnautovic (Austria) de penal es peligroso.",figura:"Lionel Messi (Argentina) — el mejor de todos los tiempos en su última Copa del Mundo.",apuesta:"Argentina gana · Messi anota · Más de 2.5 goles. Cuota est: 2.0x"},
  "France_Iraq":{ganador:"Francia viene de 3-1 a Senegal. Iraq perdió 1-4 con Noruega. Francia debería golear sin problemas.",goleadores:"Mbappé (Francia) — el más en forma del torneo. Barcola también marcó en J1.",figura:"Kylian Mbappé (Francia) — goleador histórico de la selección francesa.",apuesta:"Francia gana +2 goles · Mbappé anota. Cuota est: 1.8x"},
  "Norway_Senegal":{ganador:"Noruega goleó 4-1 a Iraq. Senegal perdió 1-3 con Francia. Noruega favorita clara.",goleadores:"Erling Haaland (Noruega) — doblete en J1, imparable. Sadio Mané (Senegal) si está al 100%.",figura:"Erling Haaland (Noruega) — el delantero más letal del torneo junto a Gyökeres.",apuesta:"Noruega gana · Haaland anota · Más de 2.5 goles. Cuota est: 1.9x"},
  "Jordan_Algeria":{ganador:"Jordania y Argelia ambas perdieron J1. Partido entre los dos eliminados casi del Grupo J.",goleadores:"Ali Olwan (Jordania) — marcó el primer gol histórico de Jordania en un Mundial.",figura:"Ali Olwan (Jordania) — el autor del histórico gol puede repetir.",apuesta:"Empate o Jordania gana · Menos de 2.5 goles. Cuota est: 2.5x"},
  "Portugal_Uzbekistan":{ganador:"Portugal decepcionó 1-1 con RD Congo. Uzbekistán perdió 1-3 con Colombia. Portugal obligado a ganar.",goleadores:"Cristiano Ronaldo (Portugal) — necesita despertar. Bruno Fernandes el más creativo.",figura:"Bruno Fernandes (Portugal) — el más dinámico. Si aparece, Portugal gana cómodo.",apuesta:"Portugal gana · Bruno Fernandes anota o asiste. Cuota est: 1.7x"},
  "England_Ghana":{ganador:"Inglaterra goleó 4-2 a Croacia. Ghana ganó 1-0 a Panamá al 94'. Inglaterra favorita pero Ghana tiene corazón.",goleadores:"Harry Kane (Inglaterra) — doblete en J1. Mohammed Kudus (Ghana) el peligro africano.",figura:"Jude Bellingham (Inglaterra) — mediocampista del Real Madrid, puede marcar la diferencia.",apuesta:"Inglaterra gana · Kane anota · Más de 2.5 goles. Cuota est: 1.8x"},
  "Panama_Croatia":{ganador:"Panamá perdió 0-1 con Ghana. Croacia perdió 2-4 con Inglaterra. Ambos de vida o muerte.",goleadores:"Ismael Díaz (Panamá). Ivan Perisic (Croacia) si juega es el más letal.",figura:"Luka Modric (Croacia) — su último Mundial. Puede liderar la reacción croata.",apuesta:"Croacia gana · Modric con asistencia. Cuota est: 2.2x"},
  "Colombia_DR Congo":{ganador:"Colombia goleó 3-1 a Uzbekistán. RD Congo empató 1-1 con Portugal. Colombia favorita.",goleadores:"Luis Díaz (Colombia) — el más desequilibrante. James Rodríguez el cerebro.",figura:"Luis Díaz (Colombia) — extremo del Liverpool en estado de gracia.",apuesta:"Colombia gana · Luis Díaz anota. Cuota est: 1.9x"},
};
function getAnalisis(home, away) {
  return ANALISIS[`${home}_${away}`] || ANALISIS[`${away}_${home}`] || null;
}

function card(m, open=false) {
  const home=m.homeTeam, away=m.awayTeam;
  const hG=m.score?.fullTime?.home, aG=m.score?.fullTime?.away;
  const done=m.status==="FINISHED";
  const live=m.status==="IN_PLAY"||m.status==="PAUSED";
  const grp=m.group?.replace("GROUP_","Grupo ")||"";
  const sLabel=done?"✅ Final":live?"🔴 EN VIVO":"⏰ Próximo";
  const sColor=done?"#4ade80":live?"#f87171":"#60a5fa";
  const goals=(m.goals||[]).map(g=>`<span class="badge">${f(g.team?.name)} ${g.scorer?.name||""} ${g.minute||""}'</span>`).join("");
  const anal=getAnalisis(home?.name, away?.name);

  return `<div class="card${open?" open":""}" onclick="toggle(this)">
  <div style="display:flex;align-items:center;gap:7px;">
    ${grp?`<span class="badge">${grp}</span>`:""}
    <span style="font-size:10px;color:${sColor};font-weight:700;min-width:55px;">${sLabel}${live&&m.minute?` ${m.minute}'`:""}</span>
    <div style="flex:1;display:flex;align-items:center;justify-content:space-between;gap:4px;">
      <span style="font-size:12px;font-weight:600;">${f(home?.name)} ${n(home?.name)}</span>
      ${done||live
        ?`<span class="score ${scoreClass(hG,aG)}">${hG??"-"} – ${aG??"-"}</span>`
        :`<span style="font-size:12px;color:#4ade80;font-weight:700;">${clHour(m.utcDate)}</span>`}
      <span style="font-size:12px;font-weight:600;text-align:right;">${n(away?.name)} ${f(away?.name)}</span>
    </div>
    <span style="font-size:9px;color:#4ade80;">${open?"▲":"▼"}</span>
  </div>
  <div style="display:${open?"block":"none"};margin-top:10px;border-top:1px solid #1e2d45;padding-top:9px;">
    ${goals?`<div style="font-size:10px;color:#94a3b8;margin-bottom:4px;">⚽ Goles</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">${goals}</div>`:""}
    <div style="font-size:10px;color:#64748b;margin-bottom:${anal?"8px":"0"};">📅 ${clDateShort(m.utcDate)} · 🕐 ${clHour(m.utcDate)} Chile${m.venue?` · 🏟 ${m.venue}`:""}</div>
    ${anal?`<div style="display:flex;flex-direction:column;gap:6px;">
      <div style="border-left:3px solid #4ade80;border-radius:7px;padding:8px 11px;background:rgba(0,0,0,.2);"><div style="font-size:10px;color:#4ade80;font-weight:700;margin-bottom:3px;">🏆 ¿Quién debería ganar?</div><div style="font-size:11px;color:#cbd5e1;line-height:1.6;">${anal.ganador}</div></div>
      <div style="border-left:3px solid #fbbf24;border-radius:7px;padding:8px 11px;background:rgba(0,0,0,.2);"><div style="font-size:10px;color:#fbbf24;font-weight:700;margin-bottom:3px;">⚽ ¿Quién debería anotar?</div><div style="font-size:11px;color:#cbd5e1;line-height:1.6;">${anal.goleadores}</div></div>
      <div style="border-left:3px solid #60a5fa;border-radius:7px;padding:8px 11px;background:rgba(0,0,0,.2);"><div style="font-size:10px;color:#60a5fa;font-weight:700;margin-bottom:3px;">⭐ Figura esperada</div><div style="font-size:11px;color:#cbd5e1;line-height:1.6;">${anal.figura}</div></div>
      <div style="border-left:3px solid #c084fc;border-radius:7px;padding:8px 11px;background:rgba(0,0,0,.2);"><div style="font-size:10px;color:#c084fc;font-weight:700;margin-bottom:3px;">💰 Apuesta recomendada</div><div style="font-size:11px;color:#cbd5e1;line-height:1.6;">${anal.apuesta}</div></div>
      <a style="display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#1a6b1a,#0f4a0f);border:2px solid #4ade80;border-radius:10px;padding:10px;color:#fff;font-weight:800;font-size:13px;text-decoration:none;margin-top:4px;" href="https://www.jugabet.cl" target="_blank">🎰 Apostar en Jugabet Chile →</a>
    </div>`:""}
  </div>
</div>`;
}

function tableHTML(s) {
  const grp=s.group?.replace("GROUP_","Grupo ")||"";
  const rows=(s.table||[]).map((row,i)=>`
    <tr class="${i<2?"row-top":""}">
      <td style="text-align:center;color:${i<2?"#4ade80":"#64748b"};font-weight:700;">${i<2?"✓":i+1}</td>
      <td>${f(row.team?.name)} <span style="font-weight:600;color:${i<2?"#e2e8f0":"#94a3b8"}">${n(row.team?.name)}</span></td>
      <td>${row.playedGames}</td><td>${row.won}</td><td>${row.draw}</td><td>${row.lost}</td>
      <td>${row.goalsFor}</td><td>${row.goalsAgainst}</td>
      <td style="color:${row.goalDifference>0?"#4ade80":row.goalDifference<0?"#f87171":"#94a3b8"}">${row.goalDifference>0?"+":""}${row.goalDifference}</td>
      <td class="pts">${row.points}</td>
    </tr>`).join("");
  return `<div style="background:#121c30;border-radius:10px;border:1px solid #1e2d45;overflow:hidden;margin-bottom:10px;">
  <div style="padding:10px 13px;border-bottom:1px solid #1e2d45;font-size:13px;font-weight:700;">${grp}</div>
  <div style="overflow-x:auto;"><table><thead><tr>
    <th>#</th><th style="text-align:left;">Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th>
  </tr></thead><tbody>${rows}</tbody></table></div>
  <div style="padding:7px 13px;border-top:1px solid #1e2d45;font-size:10px;color:#4ade80;">✓ Clasifican los 2 primeros + 8 mejores terceros a 16avos</div>
</div>`;
}

async function main() {
  console.log("Fetching data...");
  const [mData, sData] = await Promise.all([
    get("competitions/WC/matches"),
    get("competitions/WC/standings"),
  ]);

  const matches  = mData.matches || [];
  const standings = (sData.standings||[]).filter(s=>s.type==="TOTAL");

  const finished = matches.filter(m=>m.status==="FINISHED").sort((a,b)=>new Date(b.utcDate)-new Date(a.utcDate));
  const live     = matches.filter(m=>m.status==="IN_PLAY"||m.status==="PAUSED");
  const upcoming = matches.filter(m=>m.status==="SCHEDULED"||m.status==="TIMED").sort((a,b)=>new Date(a.utcDate)-new Date(b.utcDate));
  const todayAll = matches.filter(m=>isToday(m.utcDate)).sort((a,b)=>new Date(a.utcDate)-new Date(b.utcDate));

  const totalGoals = finished.reduce((s,m)=>s+(m.score?.fullTime?.home||0)+(m.score?.fullTime?.away||0),0);
  const promedio   = finished.length?(totalGoals/finished.length).toFixed(2):"0.00";
  const nowCL      = new Date().toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit",timeZone:"America/Santiago"});
  const todayCL    = clDateLong(new Date().toISOString());

  // HOY
  const hoyHTML = todayAll.length
    ? todayAll.map(m=>card(m,m.status==="IN_PLAY"||m.status==="PAUSED")).join("")
    : `<div class="empty">No hay partidos programados para hoy.</div>`;

  // RESULTADOS por jornada y grupo
  const jornadas = [...new Set(finished.map(m=>m.matchday))].sort((a,b)=>a-b);
  const grupos = ["GROUP_A","GROUP_B","GROUP_C","GROUP_D","GROUP_E","GROUP_F","GROUP_G","GROUP_H","GROUP_I","GROUP_J","GROUP_K","GROUP_L"];
  const jornadaBtns = jornadas.map((j,i)=>
    `<button class="jbtn${i===jornadas.length-1?" active":""}" onclick="showJornada(${j},this)">J${j}</button>`
  ).join("");
  const jornadaBlocks = jornadas.map((j,ji)=>{
    const pj=finished.filter(m=>m.matchday===j);
    const grpsConP=grupos.filter(g=>pj.some(m=>m.group===g));
    return `<div id="j${j}" style="display:${ji===jornadas.length-1?"block":"none"};">
      ${grpsConP.map(g=>`
        <div class="grp-block">
          <div class="grp-hdr">${g.replace("GROUP_","Grupo ")} · J${j}</div>
          ${pj.filter(m=>m.group===g).map(m=>card(m)).join("")}
        </div>`).join("")}
    </div>`;
  }).join("");

  // TABLAS
  const grpBtns = standings.map((s,i)=>
    `<button class="gbtn${i===0?" active":""}" onclick="showGrp('t${s.group?.replace("GROUP_","")}',this)">${s.group?.replace("GROUP_","G ")}</button>`
  ).join("");
  const tablaBlocks = standings.map((s,i)=>
    `<div id="t${s.group?.replace("GROUP_","")}" style="display:${i===0?"block":"none"};">${tableHTML(s)}</div>`
  ).join("");

  // PRÓXIMOS
  const byDate={};
  upcoming.slice(0,20).forEach(m=>{
    const d=clDateShort(m.utcDate);
    if(!byDate[d]) byDate[d]=[];
    byDate[d].push(m);
  });
  const proximosHTML = Object.entries(byDate).map(([fecha,ms])=>`
    <div style="font-size:11px;color:#4ade80;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:16px 0 8px;">
      <span style="background:#0d2a18;border-radius:4px;padding:2px 8px;border:1px solid #166534;">${fecha}</span>
    </div>
    ${ms.map(m=>card(m)).join("")}`).join("");

  // LEER TIPS DEL ANALISTA (sección manual que no se sobreescribe)
  let tipsHTML = `<div style="background:linear-gradient(135deg,#0d2a1a,#0a1f2f);border:1px solid #1a4a2a;border-radius:12px;padding:13px 15px;margin-bottom:12px;">
    <div style="font-size:12px;color:#4ade80;font-weight:700;margin-bottom:7px;">💡 Tips del analista</div>
    <div style="font-size:12px;color:#cbd5e1;line-height:1.9;">
      🇲🇽 <b>México clasificado</b> — 6 pts en 2 partidos. Primero del Grupo A. ¡Vamos Tri!<br/>
      🇺🇸 <b>EE.UU. clasificado</b> — 6 pts. Anfitrión dominante. Balogun y Freeman goleadores.<br/>
      🇩🇪 <b>Alemania vs C. Marfil hoy 16:00</b> — Goleada probable. Musiala a brillar.<br/>
      🇸🇪 <b>Países Bajos vs Suecia hoy 13:00</b> — El partido más atractivo del día. Gyökeres imparable.<br/>
      🇵🇹 <b>Portugal en aprietos</b> — 1-1 con RD Congo. Cristiano sin tiros. J3 crucial.<br/>
      🇹🇷 <b>Turquía eliminada</b> — Paraguay heroico con 10 hombres. Almirón expulsado por taparse la boca.
    </div>
  </div>`;

  let continenteHTML = `<div style="background:linear-gradient(135deg,#0a1f2f,#0d1a3a);border:1px solid #1a3a5a;border-radius:12px;padding:13px 15px;margin-bottom:20px;">
    <div style="font-size:12px;color:#60a5fa;font-weight:700;margin-bottom:10px;">🌍 Análisis por continente</div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div style="background:rgba(96,165,250,0.06);border-radius:8px;padding:10px 12px;border:1px solid rgba(96,165,250,0.15);">
        <div style="font-size:11px;font-weight:700;color:#93c5fd;margin-bottom:5px;">🌍 EUROPA</div>
        <div style="font-size:11px;color:#cbd5e1;line-height:1.8;"><b style="color:#4ade80;">Brillando:</b> Alemania (7-1), Noruega (4-1), Suiza (4-1 J2), Canadá (6-0 J2).<br/><b style="color:#f87171;">Flojos:</b> Portugal (1-1 RD Congo), España (0-0 J1).<br/><b style="color:#fbbf24;">Veredicto:</b> Norte europeo dominante. Portugal en crisis.</div>
      </div>
      <div style="background:rgba(74,222,128,0.06);border-radius:8px;padding:10px 12px;border:1px solid rgba(74,222,128,0.15);">
        <div style="font-size:11px;font-weight:700;color:#86efac;margin-bottom:5px;">🌎 SUDAMÉRICA</div>
        <div style="font-size:11px;color:#cbd5e1;line-height:1.8;"><b style="color:#4ade80;">Destacados:</b> Argentina (3-0 Messi hat-trick), Colombia (3-1 Luis Díaz), Brasil reaccionó (3-0 Haiti).<br/><b style="color:#f87171;">Flojos:</b> Ecuador (0-1 J1), Paraguay heroico pero limitado.<br/><b style="color:#fbbf24;">Veredicto:</b> Argentina y Colombia los mejores. Brasil mejoró en J2.</div>
      </div>
      <div style="background:rgba(251,191,36,0.06);border-radius:8px;padding:10px 12px;border:1px solid rgba(251,191,36,0.15);">
        <div style="font-size:11px;font-weight:700;color:#fcd34d;margin-bottom:5px;">🌍 ÁFRICA</div>
        <div style="font-size:11px;color:#cbd5e1;line-height:1.8;"><b style="color:#4ade80;">Destacados:</b> Marruecos (4 pts, lider C), RD Congo (empató con Portugal).<br/><b style="color:#f87171;">Flojos:</b> Argelia (0-3 vs Argentina), Senegal (1-3 vs Francia).<br/><b style="color:#fbbf24;">Veredicto:</b> Marruecos el mejor africano. Puede repetir Qatar 2022.</div>
      </div>
      <div style="background:rgba(167,139,250,0.06);border-radius:8px;padding:10px 12px;border:1px solid rgba(167,139,250,0.15);">
        <div style="font-size:11px;font-weight:700;color:#c4b5fd;margin-bottom:5px;">🌏 ASIA & OCEANÍA</div>
        <div style="font-size:11px;color:#cbd5e1;line-height:1.8;"><b style="color:#4ade80;">Destacados:</b> Japón (empató con Países Bajos al 89'), Corea del Sur (2-1 remontada).<br/><b style="color:#f87171;">Flojos:</b> Qatar (0-6 vs Canadá), Arabia Saudita (1-1).<br/><b style="color:#fbbf24;">Veredicto:</b> Japón y Corea siguen siendo los mejores de Asia.</div>
      </div>
      <div style="background:rgba(248,113,113,0.06);border-radius:8px;padding:10px 12px;border:1px solid rgba(248,113,113,0.15);">
        <div style="font-size:11px;font-weight:700;color:#fca5a5;margin-bottom:5px;">🌎 CONCACAF</div>
        <div style="font-size:11px;color:#cbd5e1;line-height:1.8;"><b style="color:#4ade80;">Destacados:</b> México (clasificado, 6 pts), EE.UU. (clasificado, 6 pts), Canadá (6-0 a Qatar).<br/><b style="color:#fbbf24;">Veredicto:</b> Los 3 anfitriones dominan. CONCACAF nunca había tenido 3 clasificados tan sólidos.</div>
      </div>
    </div>
  </div>`;

  // GENERAR HTML COMPLETO
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>⚽ Mundial 2026 · En Vivo</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:#0b1120;font-family:system-ui,-apple-system,sans-serif;color:#e8eaf0;min-height:100vh;}
    .header{background:linear-gradient(135deg,#1a2744,#0d1b35 50%,#1a3a1a);border-bottom:1px solid #2a3a5a;padding:16px 16px 0;}
    .inner{max-width:860px;margin:0 auto;}
    .tabs{display:flex;overflow-x:auto;margin-top:14px;}
    .tab{background:none;border:none;cursor:pointer;padding:9px 14px;font-size:13px;font-weight:600;white-space:nowrap;color:#8899aa;border-bottom:2px solid transparent;font-family:inherit;}
    .tab.active{color:#4ade80;border-bottom-color:#4ade80;}
    .content{max-width:860px;margin:0 auto;padding:16px;}
    .pane{display:none;}.pane.active{display:block;}
    .card{background:#121c30;border:1px solid #1e2d45;border-radius:10px;padding:11px 13px;margin-bottom:7px;cursor:pointer;}
    .card.open{background:#1a2744;border-color:#3b5a9a;}
    .badge{font-size:10px;background:#0f2a18;color:#4ade80;border:1px solid #166534;border-radius:4px;padding:1px 6px;display:inline-block;margin:2px;}
    .score{font-size:17px;font-weight:800;letter-spacing:2px;background:#0b1120;border-radius:6px;padding:2px 9px;border:1px solid #2a3a5a;}
    .w{color:#4ade80;}.l{color:#f87171;}.d{color:#fbbf24;}
    .stat-box{background:rgba(255,255,255,.06);border-radius:8px;padding:6px 12px;border:1px solid rgba(255,255,255,.08);}
    .grp-hdr{background:#0f2a18;border:1px solid #166534;border-radius:6px;padding:3px 10px;font-size:11px;font-weight:700;color:#4ade80;display:inline-block;margin-bottom:8px;}
    .grp-block{margin-bottom:20px;}
    .jbtn{background:#1a2744;color:#94a3b8;border:1px solid #2a3a5a;border-radius:6px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;}
    .jbtn.active{background:#4ade80;color:#0b1120;border-color:#4ade80;}
    .gbtn{background:#1a2744;color:#94a3b8;border:1px solid #2a3a5a;border-radius:6px;padding:3px 9px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;}
    .gbtn.active{background:#4ade80;color:#0b1120;border-color:#4ade80;}
    table{width:100%;border-collapse:collapse;font-size:12px;min-width:420px;}
    th{padding:7px 6px;color:#64748b;font-weight:600;font-size:10px;text-transform:uppercase;background:#0b1120;text-align:center;}
    td{padding:9px 6px;border-top:1px solid #1e2d45;color:#cbd5e1;text-align:center;}
    .row-top{background:rgba(74,222,128,.04);}
    .pts{color:#fbbf24;font-weight:700;}
    .ablock{border-left:3px solid;border-radius:7px;padding:8px 11px;background:rgba(0,0,0,.2);margin-bottom:6px;}
    .jugabet{display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#1a6b1a,#0f4a0f);border:2px solid #4ade80;border-radius:12px;padding:13px;color:#fff;font-weight:800;font-size:14px;text-decoration:none;margin-top:12px;box-shadow:0 4px 20px rgba(74,222,128,.25);}
    .empty{text-align:center;padding:40px;color:#64748b;font-size:13px;}
    @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.4;}}.pulse{animation:pulse 1.2s infinite;}
    ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:#0b1120;}::-webkit-scrollbar-thumb{background:#2a3a5a;border-radius:2px;}
  </style>
</head>
<body>
<div class="header">
  <div class="inner">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:24px;">⚽</span>
        <div>
          <h1 style="font-size:19px;font-weight:800;color:#fff;letter-spacing:-.5px;">MUNDIAL 2026 <span style="color:#4ade80;font-weight:400;font-size:12px;">· TIEMPO REAL</span></h1>
          <p style="font-size:10px;color:#8899aa;">USA · CANADÁ · MÉXICO · 11 Jun – 19 Jul</p>
        </div>
      </div>
      <div style="text-align:right;font-size:9px;">
        <div style="color:#4ade80;">✅ Actualizado</div>
        <div style="color:#64748b;">${nowCL} Chile</div>
      </div>
    </div>
    <div style="display:flex;gap:10px;margin:12px 0 0;flex-wrap:wrap;">
      <div class="stat-box"><div style="font-size:16px;font-weight:700;color:#4ade80;">${finished.length}</div><div style="font-size:9px;color:#8899aa;text-transform:uppercase;letter-spacing:.5px;">Jugados</div></div>
      <div class="stat-box" style="${live.length>0?"background:rgba(248,113,113,.15);border-color:rgba(248,113,113,.4)":""}">
        <div style="font-size:16px;font-weight:700;color:${live.length>0?"#f87171":"#4ade80"};">${live.length}${live.length>0?" 🔴":""}</div>
        <div style="font-size:9px;color:#8899aa;text-transform:uppercase;letter-spacing:.5px;">En Vivo</div>
      </div>
      <div class="stat-box"><div style="font-size:16px;font-weight:700;color:#4ade80;">${todayAll.length}</div><div style="font-size:9px;color:#8899aa;text-transform:uppercase;letter-spacing:.5px;">Hoy</div></div>
      <div class="stat-box"><div style="font-size:16px;font-weight:700;color:#4ade80;">${totalGoals}</div><div style="font-size:9px;color:#8899aa;text-transform:uppercase;letter-spacing:.5px;">Goles</div></div>
    </div>
    <div class="tabs">
      <button class="tab active" onclick="showTab('hoy',this)">📅 Hoy</button>
      <button class="tab" onclick="showTab('resultados',this)">📋 Resultados</button>
      <button class="tab" onclick="showTab('tablas',this)">📊 Tablas</button>
      <button class="tab" onclick="showTab('proximos',this)">🗓 Próximos</button>
      <button class="tab" onclick="showTab('apuestas',this)">💰 Apuestas</button>
    </div>
  </div>
</div>

<div class="content">

<div id="hoy" class="pane active">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
    <h2 style="font-size:14px;color:#cbd5e1;">Partidos de hoy · ${todayCL} 🇨🇱</h2>
    <span style="font-size:10px;background:#16a34a22;color:#4ade80;border:1px solid #16a34a44;border-radius:20px;padding:3px 8px;">Hora Chile</span>
  </div>
  ${hoyHTML}
</div>

<div id="resultados" class="pane">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
    <h2 style="font-size:14px;color:#cbd5e1;">Resultados por Grupo</h2>
    <div style="display:flex;gap:6px;">${jornadaBtns}</div>
  </div>
  ${jornadaBlocks}
</div>

<div id="tablas" class="pane">
  <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:14px;">${grpBtns}</div>
  ${tablaBlocks}
</div>

<div id="proximos" class="pane">
  <h2 style="font-size:14px;color:#cbd5e1;margin-bottom:14px;">🗓 Próximos partidos · Hora Chile</h2>
  ${proximosHTML}
  <div style="margin-top:22px;background:#121c30;border:1px solid #1e2d45;border-radius:12px;padding:14px;">
    <h3 style="font-size:12px;color:#94a3b8;margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">🗺 Estructura del torneo</h3>
    <div style="display:flex;flex-direction:column;gap:5px;font-size:12px;">
      <div style="display:flex;justify-content:space-between;padding:8px 10px;background:#0d2a18;border:1px solid #166534;border-radius:7px;"><span style="font-weight:700;">Fase de Grupos</span><span style="color:#4ade80;">🔴 EN CURSO · hasta 27 Jun</span></div>
      <div style="display:flex;justify-content:space-between;padding:8px 10px;background:#121c30;border:1px solid #1e2d45;border-radius:7px;"><span>16avos de Final (R32)</span><span style="color:#64748b;">29 Jun – 3 Jul</span></div>
      <div style="display:flex;justify-content:space-between;padding:8px 10px;background:#121c30;border:1px solid #1e2d45;border-radius:7px;"><span>8vos de Final (R16)</span><span style="color:#64748b;">5 Jul – 8 Jul</span></div>
      <div style="display:flex;justify-content:space-between;padding:8px 10px;background:#121c30;border:1px solid #1e2d45;border-radius:7px;"><span>Cuartos de Final</span><span style="color:#64748b;">11–12 Jul</span></div>
      <div style="display:flex;justify-content:space-between;padding:8px 10px;background:#121c30;border:1px solid #1e2d45;border-radius:7px;"><span>Semifinales</span><span style="color:#64748b;">15–16 Jul</span></div>
      <div style="display:flex;justify-content:space-between;padding:8px 10px;background:#121c30;border:1px solid #1e2d45;border-radius:7px;"><span style="font-weight:700;color:#fbbf24;">🏆 Final</span><span style="color:#fbbf24;">19 Jul · MetLife, NJ</span></div>
    </div>
  </div>
</div>

<div id="apuestas" class="pane">
  <div style="background:#1a2200;border:1px solid #3a5a00;border-radius:10px;padding:11px 13px;margin-bottom:14px;">
    <div style="font-size:12px;color:#86efac;font-weight:700;margin-bottom:3px;">⚠️ Análisis al ${clDateShort(new Date().toISOString())} · ${finished.length} partidos jugados</div>
  </div>
  <h3 style="font-size:12px;color:#4ade80;margin-bottom:9px;text-transform:uppercase;letter-spacing:1px;">🏆 Favoritos al título</h3>
  <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:18px;">
    <div class="card" style="cursor:default;display:flex;align-items:center;gap:11px;"><span style="font-size:22px;">🇦🇷</span><div style="flex:1;"><div style="font-weight:700;font-size:13px;">Argentina</div><div style="font-size:11px;color:#94a3b8;margin-top:2px;">Messi hat-trick vs Argelia (3-0). Iguala récord Klose 16 goles mundiales.</div></div><div style="font-size:17px;font-weight:800;color:#fbbf24;">4.0x</div></div>
    <div class="card" style="cursor:default;display:flex;align-items:center;gap:11px;"><span style="font-size:22px;">🇫🇷</span><div style="flex:1;"><div style="font-weight:700;font-size:13px;">Francia</div><div style="font-size:11px;color:#94a3b8;margin-top:2px;">3-1 a Senegal. Mbappé máximo goleador histórico de Francia.</div></div><div style="font-size:17px;font-weight:800;color:#fbbf24;">4.5x</div></div>
    <div class="card" style="cursor:default;display:flex;align-items:center;gap:11px;"><span style="font-size:22px;">🇩🇪</span><div style="flex:1;"><div style="font-weight:700;font-size:13px;">Alemania</div><div style="font-size:11px;color:#94a3b8;margin-top:2px;">7-1 a Curazao. Musiala+Havertz letales. Mejor arranque del torneo.</div></div><div style="font-size:17px;font-weight:800;color:#fbbf24;">5.5x</div></div>
    <div class="card" style="cursor:default;display:flex;align-items:center;gap:11px;"><span style="font-size:22px;">🏴󠁧󠁢󠁥󠁮󠁧󠁿</span><div style="flex:1;"><div style="font-weight:700;font-size:13px;">Inglaterra</div><div style="font-size:11px;color:#94a3b8;margin-top:2px;">4-2 a Croacia. Kane doblete. Sólido aunque frágil en defensa.</div></div><div style="font-size:17px;font-weight:800;color:#fbbf24;">8.0x</div></div>
    <div class="card" style="cursor:default;display:flex;align-items:center;gap:11px;"><span style="font-size:22px;">🇳🇴</span><div style="flex:1;"><div style="font-weight:700;font-size:13px;">Noruega</div><div style="font-size:11px;color:#94a3b8;margin-top:2px;">4-1 a Iraq. Haaland doblete en su debut mundialista. La gran sorpresa.</div></div><div style="font-size:17px;font-weight:800;color:#fbbf24;">12x</div></div>
  </div>
  <h3 style="font-size:12px;color:#f87171;margin:0 0 9px;text-transform:uppercase;letter-spacing:1px;">⚠️ Cuidado al apostar</h3>
  <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:20px;">
    <div class="card" style="cursor:default;background:#1a0808;border-color:#3a1010;"><div style="font-weight:700;font-size:12px;color:#fca5a5;">🇵🇹 Portugal</div><div style="font-size:11px;color:#8a7070;margin-top:2px;">1-1 vs RD Congo. Cristiano sin tiros al arco. Debut muy pobre.</div></div>
    <div class="card" style="cursor:default;background:#1a0808;border-color:#3a1010;"><div style="font-weight:700;font-size:12px;color:#fca5a5;">🇪🇸 España</div><div style="font-size:11px;color:#8a7070;margin-top:2px;">0-0 vs Cabo Verde. El campeón Euro no apareció.</div></div>
    <div class="card" style="cursor:default;background:#1a0808;border-color:#3a1010;"><div style="font-weight:700;font-size:12px;color:#fca5a5;">🇳🇱 Países Bajos</div><div style="font-size:11px;color:#8a7070;margin-top:2px;">2-2 vs Japón: regalaron empate al 89'. Defensa frágil.</div></div>
  </div>
  ${tipsHTML}
  ${continenteHTML}
  <a class="jugabet" href="https://www.jugabet.cl" target="_blank">🎰 Apostar ahora en Jugabet Chile →</a>
  <p style="font-size:10px;color:#334155;text-align:center;margin-top:8px;">Juega con responsabilidad. +18 años. Solo para residentes en Chile.</p>
</div>

</div>

<div style="text-align:center;padding:14px;font-size:10px;color:#334155;border-top:1px solid #1e2d45;">
  Datos al ${clDateShort(new Date().toISOString())} · ${finished.length} partidos · Mundial 2026 · 🇨🇱 Hora Chile
</div>

<script>
function showTab(id,btn){
  document.querySelectorAll('.pane').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  btn.classList.add('active');
}
function toggle(card){
  const divs=card.querySelectorAll('div');
  const detail=divs[divs.length-1];
  const isOpen=card.classList.contains('open');
  card.classList.toggle('open',!isOpen);
  detail.style.display=isOpen?'none':'block';
  const arr=card.querySelector('span:last-child');
  if(arr) arr.textContent=isOpen?'▼':'▲';
}
function showJornada(j,btn){
  document.querySelectorAll('.jbtn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('[id^="j"]').forEach(d=>{if(d.id.startsWith('j')&&!isNaN(d.id.slice(1)))d.style.display='none';});
  const el=document.getElementById('j'+j);
  if(el) el.style.display='block';
}
function showGrp(id,btn){
  document.querySelectorAll('.gbtn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('[id^="t"]').forEach(d=>{if(d.id.match(/^t[A-L]$/))d.style.display='none';});
  const el=document.getElementById(id);
  if(el) el.style.display='block';
}
</script>
</body>
</html>`;

  fs.writeFileSync("index.html", html);
  console.log(`✅ index.html generado — ${finished.length} partidos, ${totalGoals} goles, promedio ${promedio}`);
}

main().catch(e=>{console.error("❌ Error:",e.message);process.exit(1);});

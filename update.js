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
        catch(e) { reject(new Error("JSON parse: " + data.slice(0,100))); }
      });
    }).on("error", reject);
  });
}

const FLAGS = {
  "Mexico":"🇲🇽","South Africa":"🇿🇦","Korea Republic":"🇰🇷","Czechia":"🇨🇿",
  "Canada":"🇨🇦","Bosnia and Herzegovina":"🇧🇦","Qatar":"🇶🇦","Switzerland":"🇨🇭",
  "Brazil":"🇧🇷","Morocco":"🇲🇦","Haiti":"🇭🇹","Scotland":"🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "USA":"🇺🇸","Paraguay":"🇵🇾","Australia":"🇦🇺","Turkey":"🇹🇷",
  "Germany":"🇩🇪","Curaçao":"🇨🇼","Côte d'Ivoire":"🇨🇮","Ivory Coast":"🇨🇮","Ecuador":"🇪🇨",
  "Netherlands":"🇳🇱","Japan":"🇯🇵","Sweden":"🇸🇪","Tunisia":"🇹🇳",
  "IR Iran":"🇮🇷","New Zealand":"🇳🇿","Belgium":"🇧🇪","Egypt":"🇪🇬",
  "Spain":"🇪🇸","Cabo Verde":"🇨🇻","Cape Verde Islands":"🇨🇻","Cape Verde":"🇨🇻","Saudi Arabia":"🇸🇦","Uruguay":"🇺🇾",
  "France":"🇫🇷","Senegal":"🇸🇳","Norway":"🇳🇴","Iraq":"🇮🇶",
  "Argentina":"🇦🇷","Algeria":"🇩🇿","Austria":"🇦🇹","Jordan":"🇯🇴",
  "Portugal":"🇵🇹","DR Congo":"🇨🇩","Uzbekistan":"🇺🇿","Colombia":"🇨🇴",
  "England":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Croatia":"🇭🇷","Ghana":"🇬🇭","Panama":"🇵🇦","South Korea":"🇰🇷","Bosnia-Herzegovina":"🇧🇦","Ivory Coast":"🇨🇮","Curacao":"🇨🇼","IR Iran":"🇮🇷","Korea DPR":"🇰🇵",
};
const NAMES = {
  "Mexico":"México","South Africa":"Sudáfrica","Korea Republic":"Corea del Sur","Czechia":"Rep. Checa",
  "Canada":"Canadá","Bosnia and Herzegovina":"Bosnia-Herz.","Switzerland":"Suiza","Brazil":"Brasil",
  "Morocco":"Marruecos","Haiti":"Haití","Scotland":"Escocia","USA":"EE.UU.","Turkey":"Turquía","Germany":"Alemania",
  "Côte d'Ivoire":"Costa de Marfil","Ivory Coast":"Costa de Marfil","Netherlands":"Países Bajos","Japan":"Japón","Sweden":"Suecia",
  "Tunisia":"Túnez","IR Iran":"Irán","New Zealand":"Nueva Zelanda","Belgium":"Bélgica",
  "Spain":"España","Saudi Arabia":"Arabia Saudita","France":"Francia","Norway":"Noruega",
  "Algeria":"Argelia","Jordan":"Jordania","Portugal":"Portugal","DR Congo":"RD Congo",
  "Uzbekistan":"Uzbekistán","England":"Inglaterra","Croatia":"Croacia","Ecuador":"Ecuador",
  "Curaçao":"Curazao","Paraguay":"Paraguay","Australia":"Australia","Senegal":"Senegal",
  "Iraq":"Iraq","Uruguay":"Uruguay","Egypt":"Egipto","Ghana":"Ghana","Argentina":"Argentina",
  "Austria":"Austria","Colombia":"Colombia","Panama":"Panamá","Cabo Verde":"Cabo Verde","South Korea":"Corea del Sur","Bosnia-Herzegovina":"Bosnia-Herz.","Ivory Coast":"Costa de Marfil","Curacao":"Curazao","Scotland":"Escocia","Cape Verde Islands":"Cabo Verde","Cape Verde":"Cabo Verde","Cape Verde Islands":"Cabo Verde","Cape Verde":"Cabo Verde",
};
const n = t => (t && NAMES[t]) || t || "?";
const f = t => (t && FLAGS[t]) || "🏳";

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
function sc(h,a) { return h>a?"w":h<a?"l":"d"; }

// ── ANÁLISIS POR PARTIDO ──
const ANALISIS = {
  "Netherlands_Sweden":     {ganador:"Partido abierto. Países Bajos cedió 2-2 vs Japón al 89min. Suecia goleó 5-1 a Túnez. Puede ir para cualquier lado.",goleadores:"Viktor Gyökeres (Suecia) — goleador del torneo. Gakpo y Depay (Países Bajos) peligrosos.",figura:"Viktor Gyökeres (Suecia) — en la mejor forma de su carrera.",apuesta:"Ambos anotan · Más de 2.5 goles · Gyökeres anota. Cuota est: 1.9x"},
  "Germany_Cote d'Ivoire":  {ganador:"Alemania clarísima favorita. Viene de 7-1. C. Marfil sin nivel para los alemanes.",goleadores:"Havertz y Musiala (Alemania). Amad Diallo (C. Marfil) único peligro.",figura:"Jamal Musiala (Alemania) — el más habilidoso del torneo.",apuesta:"Alemania gana · Musiala anota · Más de 3.5 goles. Cuota est: 2.0x"},
  "Ecuador_Curacao":        {ganador:"Ecuador necesita ganar sí o sí. Curazao fue goleado 1-7 por Alemania.",goleadores:"Enner Valencia (Ecuador). Moisés Caicedo puede aportar.",figura:"Moisés Caicedo (Ecuador) — uno de los mejores mediocampistas del mundo.",apuesta:"Ecuador gana · Más de 2.5 goles · Valencia anota. Cuota est: 1.8x"},
  "Tunisia_Japan":          {ganador:"Japón favorito. Empató 2-2 con Países Bajos al 89min. Túnez goleado 1-5.",goleadores:"Daichi Kamada (Japón) — marcó el 2-2 al 89min. Ritsu Doan peligroso.",figura:"Takumi Minamino (Japón) — motor junto a Kamada.",apuesta:"Japón gana · Más de 1.5 goles · Kamada anota. Cuota est: 2.2x"},
  "Spain_Saudi Arabia":     {ganador:"España obligada a reaccionar tras el 0-0 vs Cabo Verde. Arabia Saudita igualó con Uruguay.",goleadores:"Pedri y Morata (España). Al-Dawsari (Arabia Saudita) en contraataque.",figura:"Pedri (España) — mediocampista creativo que España necesita despertar.",apuesta:"España gana · Pedri con asistencia. Cuota est: 1.9x"},
  "Belgium_IR Iran":        {ganador:"Bélgica igualó 1-1 con Egipto. Irán cedió 2-2 con Nueva Zelanda. Partido equilibrado.",goleadores:"Romelu Lukaku (Bélgica). Mehdi Taremi (Irán) referente ofensivo.",figura:"Kevin De Bruyne (Bélgica) — si aparece cambia el partido.",apuesta:"Bélgica gana por la mínima · Menos de 3 goles. Cuota est: 2.3x"},
  "Uruguay_Cabo Verde":     {ganador:"Uruguay igualó 1-1 con Arabia (Araújo 80min). Cabo Verde empató 0-0 con España sorprendiendo.",goleadores:"Darwin Núñez (Uruguay) — el más peligroso.",figura:"Federico Valverde (Uruguay) — motor del equipo celeste.",apuesta:"Uruguay gana · Darwin Núñez anota. Cuota est: 2.1x"},
  "New Zealand_Egypt":      {ganador:"Nueva Zelanda cedió 2-2 con Irán. Egipto empató 1-1 con Bélgica. Partido parejo.",goleadores:"Chris Wood (Nueva Zelanda). Omar Marmoush (Egipto) viene de gran temporada.",figura:"Chris Wood (Nueva Zelanda) — delantero referente.",apuesta:"Empate o Egipto gana · Menos de 2.5 goles. Cuota est: 2.0x"},
  "Argentina_Austria":      {ganador:"Argentina viene de 3-0 a Argelia con hat-trick de Messi. Austria ganó 3-1 a Jordania. Duelo de líderes.",goleadores:"Messi (Argentina) — 16 goles mundiales. Arnautovic (Austria) peligroso.",figura:"Lionel Messi (Argentina) — el mejor de todos los tiempos.",apuesta:"Argentina gana · Messi anota · Más de 2.5 goles. Cuota est: 2.0x"},
  "France_Iraq":            {ganador:"Francia viene de 3-1 a Senegal. Iraq perdió 1-4 con Noruega. Francia debe golear.",goleadores:"Mbappé (Francia) — más en forma del torneo. Barcola también marcó J1.",figura:"Kylian Mbappé (Francia) — goleador histórico de Francia.",apuesta:"Francia gana +2 goles · Mbappé anota. Cuota est: 1.8x"},
  "Norway_Senegal":         {ganador:"Noruega goleó 4-1 a Iraq. Senegal perdió 1-3 con Francia. Noruega favorita.",goleadores:"Erling Haaland (Noruega) — doblete J1, imparable. Sadio Mané (Senegal).",figura:"Erling Haaland (Noruega) — el más letal del torneo.",apuesta:"Noruega gana · Haaland anota · Más de 2.5 goles. Cuota est: 1.9x"},
  "Jordan_Algeria":         {ganador:"Ambas perdieron J1. Partido entre los dos eliminados casi del Grupo J.",goleadores:"Ali Olwan (Jordania) — marcó primer gol histórico de Jordania en un Mundial.",figura:"Ali Olwan (Jordania) — el autor del gol histórico.",apuesta:"Empate o Jordania gana · Menos de 2.5 goles. Cuota est: 2.5x"},
  "Portugal_Uzbekistan":    {ganador:"Portugal decepcionó 1-1 con RD Congo. Uzbekistán perdió 1-3 con Colombia. Portugal obligado.",goleadores:"Cristiano Ronaldo (Portugal) — necesita despertar. Bruno Fernandes creativo.",figura:"Bruno Fernandes (Portugal) — el más dinámico. Si aparece, Portugal gana.",apuesta:"Portugal gana · Bruno Fernandes anota o asiste. Cuota est: 1.7x"},
  "England_Ghana":          {ganador:"Inglaterra goleó 4-2 a Croacia. Ghana ganó 1-0 a Panamá al 94min. Inglaterra favorita.",goleadores:"Harry Kane (Inglaterra) — doblete J1. Mohammed Kudus (Ghana) peligro africano.",figura:"Jude Bellingham (Inglaterra) — puede marcar la diferencia.",apuesta:"Inglaterra gana · Kane anota · Más de 2.5 goles. Cuota est: 1.8x"},
  "Panama_Croatia":         {ganador:"Panamá perdió 0-1. Croacia perdió 2-4. Ambos de vida o muerte.",goleadores:"Ismael Díaz (Panamá). Ivan Perisic (Croacia) si juega.",figura:"Luka Modric (Croacia) — su último Mundial. Puede liderar la reacción.",apuesta:"Croacia gana · Modric con asistencia. Cuota est: 2.2x"},
  "Colombia_DR Congo":      {ganador:"Colombia goleó 3-1 a Uzbekistán. RD Congo empató 1-1 con Portugal. Colombia favorita.",goleadores:"Luis Díaz (Colombia) — el más desequilibrante. James el cerebro.",figura:"Luis Díaz (Colombia) — extremo del Liverpool en estado de gracia.",apuesta:"Colombia gana · Luis Díaz anota. Cuota est: 1.9x"},
};
function getAnal(home, away) {
  const k1 = home+"_"+away;
  const k2 = away+"_"+home;
  return ANALISIS[k1] || ANALISIS[k2] || null;
}

// ── GENERAR TARJETA DE PARTIDO ──
let cardId = 0;
function makeCard(m) {
  cardId++;
  const cid = "cd" + cardId;
  const home = m.homeTeam;
  const away = m.awayTeam;
  const hN = n(home && home.name);
  const aN = n(away && away.name);
  const hF = f(home && home.name);
  const aF = f(away && away.name);
  var hG = m.score && m.score.fullTime ? m.score.fullTime.home : null;
  var aG = m.score && m.score.fullTime ? m.score.fullTime.away : null;
  // Fallback a regularTime si fullTime es null
  if (hG === null && m.score && m.score.regularTime) { hG = m.score.regularTime.home; aG = m.score.regularTime.away; }
  // Fallback a winner si todo es null — al menos mostrar resultado
  if (hG === null && done && m.score) {
    if (m.score.winner === 'HOME_TEAM') { hG = 1; aG = 0; }
    else if (m.score.winner === 'AWAY_TEAM') { hG = 0; aG = 1; }
    else if (m.score.winner === 'DRAW') { hG = 0; aG = 0; }
  }
  const done = m.status === "FINISHED";
  const live = m.status === "IN_PLAY" || m.status === "PAUSED";
  const grp = m.group ? m.group.replace("GROUP_","Grupo ") : "";
  const sLabel = done ? "✅ Final" : live ? "🔴 EN VIVO" : "⏰ Próximo";
  const sColor = done ? "#4ade80" : live ? "#f87171" : "#60a5fa";
  const hora = clHour(m.utcDate);
  const fecha = clDateShort(m.utcDate);
  const venue = m.venue || "";
  const anal = getAnal(home && home.name, away && away.name);

  // Goles
  var golesLocal = [];
  var golesVisita = [];
  if (m.goals && m.goals.length > 0) {
    m.goals.forEach(function(g) {
      var gs = g.scorer && g.scorer.name ? g.scorer.name : "Desconocido";
      var gm = g.minute ? g.minute + "min" : "";
      var gt = g.type === "OWN_GOAL" ? " (OG)" : g.type === "PENALTY" ? " (p)" : "";
      var badge = '<span class="badge">⚽ ' + gs + " " + gm + gt + "</span>";
      // Asignar al equipo correcto
      if (g.team && g.team.name === (home && home.name)) {
        golesLocal.push(badge);
      } else {
        golesVisita.push(badge);
      }
    });
  }

  // Tarjetas amarillas y rojas separadas por equipo
  var tarjLocal = [];
  var tarjVisita = [];
  if (m.bookings && m.bookings.length > 0) {
    m.bookings.forEach(function(b) {
      var isRed = b.card === "RED_CARD" || b.card === "YELLOW_RED_CARD";
      var emoji = isRed ? "🟥" : "🟨";
      var color = isRed ? "#f87171" : "#fbbf24";
      var bg = isRed ? "#1a0808" : "#1a1500";
      var border = isRed ? "#3a1010" : "#3a3000";
      var pn = b.player && b.player.name ? b.player.name : "";
      var pm = b.minute ? b.minute + "min" : "";
      var badge = '<span style="font-size:10px;background:' + bg + ';color:' + color + ';border:1px solid ' + border + ';border-radius:4px;padding:1px 6px;">' + emoji + " " + pn + " " + pm + "</span>";
      if (b.team && b.team.name === (home && home.name)) {
        tarjLocal.push(badge);
      } else {
        tarjVisita.push(badge);
      }
    });
  }

  // Lesionados/sustituciones
  var subsHTML = "";
  if (m.substitutions && m.substitutions.length > 0) {
    var subs = m.substitutions.map(function(s) {
      var pout = s.playerOut && s.playerOut.name ? s.playerOut.name : "";
      var pin  = s.playerIn  && s.playerIn.name  ? s.playerIn.name  : "";
      var sm   = s.minute ? s.minute + "min" : "";
      return '<span style="font-size:10px;background:#0f1f3a;color:#94a3b8;border:1px solid #1e3a6a;border-radius:4px;padding:1px 6px;">🔄 ' + pout + " → " + pin + " " + sm + "</span>";
    }).join("");
    subsHTML = '<div style="margin-bottom:6px;"><div style="font-size:10px;color:#94a3b8;margin-bottom:3px;">🔄 Cambios</div><div style="display:flex;flex-wrap:wrap;gap:3px;">' + subs + "</div></div>";
  }

  // Construir bloque de stats del partido (goles + tarjetas por equipo)
  var statsHTML = "";
  if ((done || live) && (golesLocal.length || golesVisita.length || tarjLocal.length || tarjVisita.length)) {
    var localCol = '<div style="flex:1;">'
      + (golesLocal.length ? '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:4px;">' + golesLocal.join("") + "</div>" : "")
      + (tarjLocal.length ? '<div style="display:flex;flex-wrap:wrap;gap:3px;">' + tarjLocal.join("") + "</div>" : "")
      + "</div>";
    var visitaCol = '<div style="flex:1;text-align:right;">'
      + (golesVisita.length ? '<div style="display:flex;flex-wrap:wrap;gap:3px;justify-content:flex-end;margin-bottom:4px;">' + golesVisita.join("") + "</div>" : "")
      + (tarjVisita.length ? '<div style="display:flex;flex-wrap:wrap;gap:3px;justify-content:flex-end;">' + tarjVisita.join("") + "</div>" : "")
      + "</div>";
    statsHTML = '<div style="display:flex;gap:8px;margin-bottom:8px;">' + localCol + visitaCol + "</div>";
  }
  var golesHTML = statsHTML; // compatibilidad

  // Score o hora
  let scoreHTML = "";
  if (done || live) {
    if (hG !== null && aG !== null) {
      const cls = sc(hG, aG);
      scoreHTML = '<span class="score ' + cls + '">' + hG + " \u2013 " + aG + "</span>";
    } else {
      scoreHTML = '<span style="font-size:11px;color:#4ade80;font-weight:700;">Final</span>';
    }
  } else {
    scoreHTML = '<span style="font-size:12px;color:#4ade80;font-weight:700;">' + hora + "</span>";
  }

  // Análisis HTML
  let analHTML = "";
  if (anal) {
    var predBadge = anal.pred ? '<div style="background:linear-gradient(135deg,#1a3a1a,#0a1f0a);border:1px solid #4ade80;border-radius:8px;padding:8px 12px;margin-bottom:6px;text-align:center;"><span style="font-size:13px;font-weight:800;color:#4ade80;">' + anal.pred + '</span></div>' : "";
    analHTML = '<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">' + predBadge
      + '<div style="border-left:3px solid #4ade80;border-radius:7px;padding:8px 11px;background:rgba(0,0,0,.2);"><div style="font-size:10px;color:#4ade80;font-weight:700;margin-bottom:3px;">🏆 ¿Quién debería ganar?</div><div style="font-size:11px;color:#cbd5e1;line-height:1.6;">' + anal.ganador + '</div></div>'
      + '<div style="border-left:3px solid #fbbf24;border-radius:7px;padding:8px 11px;background:rgba(0,0,0,.2);"><div style="font-size:10px;color:#fbbf24;font-weight:700;margin-bottom:3px;">⚽ ¿Quién debería anotar?</div><div style="font-size:11px;color:#cbd5e1;line-height:1.6;">' + anal.goleadores + '</div></div>'
      + '<div style="border-left:3px solid #60a5fa;border-radius:7px;padding:8px 11px;background:rgba(0,0,0,.2);"><div style="font-size:10px;color:#60a5fa;font-weight:700;margin-bottom:3px;">⭐ Figura esperada</div><div style="font-size:11px;color:#cbd5e1;line-height:1.6;">' + anal.figura + '</div></div>'
      + '<div style="border-left:3px solid #c084fc;border-radius:7px;padding:8px 11px;background:rgba(0,0,0,.2);"><div style="font-size:10px;color:#c084fc;font-weight:700;margin-bottom:3px;">💰 Apuesta recomendada</div><div style="font-size:11px;color:#cbd5e1;line-height:1.6;">' + anal.apuesta + '</div></div>'
      + '<a style="display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#1a6b1a,#0f4a0f);border:2px solid #4ade80;border-radius:10px;padding:10px;color:#fff;font-weight:800;font-size:13px;text-decoration:none;" href="https://www.jugabet.cl" target="_blank">🎰 Apostar en Jugabet Chile</a>'
      + '</div>';
  }

  return '<div class="card" onclick="toggleCard(\'' + cid + '\')">'
    + '<div style="display:flex;align-items:center;gap:7px;">'
    + (grp ? '<span class="badge">' + grp + '</span>' : '')
    + '<span style="font-size:10px;color:' + sColor + ';font-weight:700;min-width:58px;">' + sLabel + (live && m.minute ? " " + m.minute + "'" : "") + '</span>'
    + '<div style="flex:1;display:flex;align-items:center;gap:4px;">'
    + '<span style="flex:1;font-size:12px;font-weight:600;">' + hF + ' ' + hN + '</span>'
    + scoreHTML
    + '<span style="flex:1;font-size:12px;font-weight:600;text-align:right;">' + aN + ' ' + aF + '</span>'
    + '</div>'
    + '<span style="font-size:9px;color:#4ade80;">▼</span>'
    + '</div>'
    + '<div id="' + cid + '" style="display:none;margin-top:10px;border-top:1px solid #1e2d45;padding-top:9px;">'
    + (golesHTML || subsHTML ? golesHTML + subsHTML : '')
    + '<div style="font-size:10px;color:#64748b;">' + '📅 ' + fecha + ' · 🕐 ' + hora + ' Chile' + (venue ? ' · 🏟 ' + venue : '') + '</div>'
    + analHTML
    + '</div>'
    + '</div>';
}

function tableHTML(s) {
  const grp = s.group ? s.group.replace("GROUP_","Grupo ") : "";
  const rows = (s.table || []).map(function(row, i) {
    const dg = row.goalDifference;
    const dgColor = dg > 0 ? "#4ade80" : dg < 0 ? "#f87171" : "#94a3b8";
    return '<tr class="' + (i < 2 ? "row-top" : "") + '">'
      + '<td style="text-align:center;color:' + (i < 2 ? "#4ade80" : "#64748b") + ';font-weight:700;">' + (i < 2 ? "✓" : i+1) + '</td>'
      + '<td>' + f(row.team && row.team.name) + ' <span style="font-weight:600;color:' + (i < 2 ? "#e2e8f0" : "#94a3b8") + '">' + n(row.team && row.team.name) + '</span></td>'
      + '<td>' + row.playedGames + '</td><td>' + row.won + '</td><td>' + row.draw + '</td><td>' + row.lost + '</td>'
      + '<td>' + row.goalsFor + '</td><td>' + row.goalsAgainst + '</td>'
      + '<td style="color:' + dgColor + '">' + (dg > 0 ? "+" : "") + dg + '</td>'
      + '<td class="pts">' + row.points + '</td>'
      + '</tr>';
  }).join("");
  return '<div style="background:#121c30;border-radius:10px;border:1px solid #1e2d45;overflow:hidden;margin-bottom:10px;">'
    + '<div style="padding:10px 13px;border-bottom:1px solid #1e2d45;font-size:13px;font-weight:700;">' + grp + '</div>'
    + '<div style="overflow-x:auto;"><table><thead><tr>'
    + '<th>#</th><th style="text-align:left;">Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th>'
    + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
    + '<div style="padding:7px 13px;border-top:1px solid #1e2d45;font-size:10px;color:#4ade80;">✓ Clasifican los 2 primeros + 8 mejores terceros a 16avos</div>'
    + '</div>';
}

async function main() {
  console.log("Fetching data...");
  const [mData, sData] = await Promise.all([
    get("competitions/WC/matches"),
    get("competitions/WC/standings"),
  ]);

  const matches   = mData.matches || [];
  const standings = (sData.standings || []).filter(function(s){ return s.type === "TOTAL"; });

  const finished = matches.filter(function(m){ return m.status === "FINISHED"; }).sort(function(a,b){ return new Date(b.utcDate)-new Date(a.utcDate); });
  const live     = matches.filter(function(m){ return m.status === "IN_PLAY" || m.status === "PAUSED"; });
  const upcoming = matches.filter(function(m){ return m.status === "SCHEDULED" || m.status === "TIMED"; }).sort(function(a,b){ return new Date(a.utcDate)-new Date(b.utcDate); });
  const todayAll = matches.filter(function(m){ return isToday(m.utcDate); }).sort(function(a,b){ return new Date(a.utcDate)-new Date(b.utcDate); });

  const totalGoals = finished.reduce(function(s,m){ return s + ((m.score && m.score.fullTime && m.score.fullTime.home) || 0) + ((m.score && m.score.fullTime && m.score.fullTime.away) || 0); }, 0);
  const promedio   = finished.length ? (totalGoals / finished.length).toFixed(2) : "0.00";
  const nowCL      = new Date().toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"America/Santiago"});
  const todayCL    = clDateLong(new Date().toISOString());
  const dateCL     = clDateShort(new Date().toISOString());

  // ── HOY ──
  cardId = 0;
  const hoyHTML = todayAll.length
    ? todayAll.map(function(m){ return makeCard(m); }).join("")
    : '<div class="empty">No hay partidos hoy.</div>';

  // ── PRÓXIMOS (sin hoy) ──
  cardId = 1000;
  const proxFuturos = upcoming.filter(function(m){ return !isToday(m.utcDate); }).slice(0,20);
  const byDate = {};
  proxFuturos.forEach(function(m){
    const d = clDateShort(m.utcDate);
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(m);
  });
  const proximosHTML = Object.keys(byDate).map(function(fecha){
    const ms = byDate[fecha];
    return '<div style="font-size:11px;color:#4ade80;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:16px 0 8px;">'
      + '<span style="background:#0d2a18;border-radius:4px;padding:2px 8px;border:1px solid #166534;">' + fecha + '</span></div>'
      + ms.map(function(m){ return makeCard(m); }).join("");
  }).join("");

  // ── RESULTADOS ──
  cardId = 2000;
  const jornadas = [];
  finished.forEach(function(m){ if (m.matchday && !jornadas.includes(m.matchday)) jornadas.push(m.matchday); });
  jornadas.sort(function(a,b){ return a-b; });
  const grupos = ["GROUP_A","GROUP_B","GROUP_C","GROUP_D","GROUP_E","GROUP_F","GROUP_G","GROUP_H","GROUP_I","GROUP_J","GROUP_K","GROUP_L"];
  const jornadaBtns = jornadas.map(function(j,i){
    return '<button class="jbtn' + (i===jornadas.length-1?" active":"") + '" onclick="showJornada(' + j + ',this)">J' + j + '</button>';
  }).join("");
  const jornadaBlocks = jornadas.map(function(j, ji){
    const pj = finished.filter(function(m){ return m.matchday === j; });
    const grpsConP = grupos.filter(function(g){ return pj.some(function(m){ return m.group === g; }); });
    return '<div id="j' + j + '" style="display:' + (ji===jornadas.length-1?"block":"none") + ';">'
      + grpsConP.map(function(g){
          return '<div class="grp-block">'
            + '<div class="grp-hdr">' + g.replace("GROUP_","Grupo ") + ' · J' + j + '</div>'
            + pj.filter(function(m){ return m.group === g; }).map(function(m){ return makeCard(m); }).join("")
            + '</div>';
        }).join("")
      + '</div>';
  }).join("");

  // ── TABLAS ──
  const grpBtns = standings.map(function(s,i){
    return '<button class="gbtn' + (i===0?" active":"") + '" onclick="showGrp(\'t' + s.group.replace("GROUP_","") + '\',this)">' + s.group.replace("GROUP_","G ") + '</button>';
  }).join("");
  const tablaBlocks = standings.map(function(s,i){
    return '<div id="t' + s.group.replace("GROUP_","") + '" style="display:' + (i===0?"block":"none") + ';">' + tableHTML(s) + '</div>';
  }).join("");

  // ── APUESTAS — dinámico según jornada completada ──
  const jornadaMax = jornadas.length > 0 ? jornadas[jornadas.length-1] : 0;

  // Tips dinámicos por jornada
  var tipsLines = [];
  if (jornadaMax >= 1) {
    tipsLines = tipsLines.concat([
      "🇦🇷 <b>Argentina</b> — Messi hat-trick vs Argelia. Candidato al titulo.",
      "🇩🇪 <b>Alemania</b> — 7-1 a Curazao. La maquina del torneo.",
      "🇳🇴 <b>Noruega sorpresa</b> — Haaland doblete en debut. Atencion al Grupo I.",
      "🇵🇹 <b>Portugal en aprietos</b> — 1-1 con RD Congo. Cristiano sin tiros al arco.",
      "🇪🇸 <b>Espana decepciono</b> — 0-0 vs Cabo Verde. El campeon Euro sin aparecer."
    ]);
  }
  if (jornadaMax >= 2) {
    tipsLines = tipsLines.concat([
      "🇲🇽 <b>Mexico clasificado</b> — 6 pts en 2 partidos. Lider Grupo A.",
      "🇺🇸 <b>EE.UU. clasificado</b> — 6 pts. Efecto local brutal.",
      "🇨🇦 <b>Canada goleador</b> — 6-0 a Qatar. La sorpresa positiva de J2.",
      "🇨🇭 <b>Suiza reacciono</b> — 4-1 a Bosnia tras el empate con Qatar.",
      "🇹🇷 <b>Turquia eliminada</b> — Paraguay heroico con 10 jugadores."
    ]);
  }
  if (jornadaMax >= 3) {
    tipsLines = tipsLines.concat([
      "🏆 <b>J3 completa</b> — Fase de grupos terminada. 16avos de final se vienen.",
      "Revisa la tabla de posiciones para ver los 32 clasificados."
    ]);
  }
  const tipsHTML = '<div style="background:linear-gradient(135deg,#0d2a1a,#0a1f2f);border:1px solid #1a4a2a;border-radius:12px;padding:13px 15px;margin-bottom:12px;">'
    + '<div style="font-size:12px;color:#4ade80;font-weight:700;margin-bottom:7px;">💡 Tips del analista · J' + jornadaMax + ' completada</div>'
    + '<div style="font-size:12px;color:#cbd5e1;line-height:2.0;">' + tipsLines.join("<br/>") + '</div>'
    + '</div>';

  // Análisis por continente — dinámico
  var continentes = [
    {
      color:"rgba(96,165,250,0.06)", border:"rgba(96,165,250,0.15)", titleColor:"#93c5fd",
      titulo:"EUROPA",
      j1:"Brillando: Alemania (7-1), Noruega (4-1), Suecia (5-1). Flojos: Portugal (1-1), Espana (0-0), Belgica (1-1). Veredicto: Norte europeo domina. Sur decepciona.",
      j2:"Suiza 4-1 Bosnia, Canada 6-0 Qatar confirman nivel. Portugal sigue en crisis. Francia y Noruega son los favoritos del Grupo I.",
      j3:"Fase de grupos terminada. Se definieron los clasificados europeos."
    },
    {
      color:"rgba(74,222,128,0.06)", border:"rgba(74,222,128,0.15)", titleColor:"#86efac",
      titulo:"SUDAMERICA",
      j1:"Brillando: Argentina (3-0 Messi x3), Colombia (3-1). Flojos: Brasil (1-1), Ecuador (0-1). Veredicto: Argentina candidato. Colombia sorprendio.",
      j2:"Brasil reacciono con 3-0 a Haiti. Mexico y EE.UU. clasificados. Paraguay heroico. Ecuador en peligro.",
      j3:"Clasificados definidos. Argentina lider indiscutible de Sudamerica."
    },
    {
      color:"rgba(251,191,36,0.06)", border:"rgba(251,191,36,0.15)", titleColor:"#fcd34d",
      titulo:"AFRICA",
      j1:"Brillando: Marruecos (1-1 Brasil), C. Marfil (gana 90'), Ghana (1-0 agonica), RD Congo (1-1 Portugal). Veredicto: Marruecos el mejor africano.",
      j2:"Marruecos 1-0 Escocia confirma su nivel. Africa en buena posicion para los 16avos.",
      j3:"Marruecos avanza. Se confirman los clasificados africanos."
    },
    {
      color:"rgba(167,139,250,0.06)", border:"rgba(167,139,250,0.15)", titleColor:"#c4b5fd",
      titulo:"ASIA Y OCEANIA",
      j1:"Brillando: Japon (2-2 Paises Bajos al 89min), Corea del Sur (2-1 remontada). Flojos: Qatar (1-1), Arabia Saudita (1-1). Veredicto: Asia del Este revela nivel.",
      j2:"Japon y Corea bien posicionados. Qatar goleado 0-6 por Canada. Arabia Saudita sigue irregular.",
      j3:"Japon y Corea clasificados. Qatar eliminado."
    },
    {
      color:"rgba(248,113,113,0.06)", border:"rgba(248,113,113,0.15)", titleColor:"#fca5a5",
      titulo:"CONCACAF",
      j1:"Brillando: EE.UU. (4-1), Mexico (2-0). Canada empezo con 1-1. Veredicto: Los 3 anfitriones fuertes.",
      j2:"Mexico y EE.UU. clasificados con 6 pts. Canada goleo 6-0 a Qatar. CONCACAF nunca habia tenido 3 tan solidos.",
      j3:"Los 3 anfitriones clasificados. CONCACAF historico."
    }
  ];

  const continenteHTML = '<div style="background:linear-gradient(135deg,#0a1f2f,#0d1a3a);border:1px solid #1a3a5a;border-radius:12px;padding:13px 15px;margin-bottom:20px;">'
    + '<div style="font-size:12px;color:#60a5fa;font-weight:700;margin-bottom:10px;">Analisis por continente · J' + jornadaMax + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:10px;">'
    + continentes.map(function(ct) {
        var texto = jornadaMax >= 3 ? ct.j3 : jornadaMax >= 2 ? ct.j2 : ct.j1;
        return '<div style="background:' + ct.color + ';border-radius:8px;padding:10px 12px;border:1px solid ' + ct.border + ';">'
          + '<div style="font-size:11px;font-weight:700;color:' + ct.titleColor + ';margin-bottom:5px;">' + ct.titulo + '</div>'
          + '<div style="font-size:11px;color:#cbd5e1;line-height:1.8;">' + texto + '</div>'
          + '</div>';
      }).join("")
    + '</div></div>';

  // ── GENERAR HTML COMPLETO ──

  const html = '<!DOCTYPE html>\n<html lang="es">\n<head>\n'
    + '<meta charset="UTF-8"/>\n<meta name="viewport" content="width=device-width, initial-scale=1.0"/>\n'
    + '<title>⚽ Mundial 2026 · En Vivo</title>\n'
    + '<style>\n'
    + '*{box-sizing:border-box;margin:0;padding:0;}\n'
    + 'body{background:#0b1120;font-family:system-ui,-apple-system,sans-serif;color:#e8eaf0;min-height:100vh;}\n'
    + '.header{background:linear-gradient(135deg,#1a2744,#0d1b35 50%,#1a3a1a);border-bottom:1px solid #2a3a5a;padding:16px 16px 0;}\n'
    + '.inner{max-width:860px;margin:0 auto;}\n'
    + '.tabs{display:flex;overflow-x:auto;margin-top:14px;}\n'
    + '.tab{background:none;border:none;cursor:pointer;padding:9px 14px;font-size:13px;font-weight:600;white-space:nowrap;color:#8899aa;border-bottom:2px solid transparent;font-family:inherit;}\n'
    + '.tab.active{color:#4ade80;border-bottom-color:#4ade80;}\n'
    + '.content{max-width:860px;margin:0 auto;padding:16px;}\n'
    + '.pane{display:none;}.pane.active{display:block;}\n'
    + '.card{background:#121c30;border:1px solid #1e2d45;border-radius:10px;padding:11px 13px;margin-bottom:7px;cursor:pointer;}\n'
    + '.card.open{background:#1a2744;border-color:#3b5a9a;}\n'
    + '.badge{font-size:10px;background:#0f2a18;color:#4ade80;border:1px solid #166534;border-radius:4px;padding:1px 6px;display:inline-block;margin:2px;}\n'
    + '.score{font-size:17px;font-weight:800;letter-spacing:2px;background:#0b1120;border-radius:6px;padding:2px 9px;border:1px solid #2a3a5a;}\n'
    + '.w{color:#4ade80;}.l{color:#f87171;}.d{color:#fbbf24;}\n'
    + '.stat-box{background:rgba(255,255,255,.06);border-radius:8px;padding:6px 12px;border:1px solid rgba(255,255,255,.08);}\n'
    + '.grp-hdr{background:#0f2a18;border:1px solid #166534;border-radius:6px;padding:3px 10px;font-size:11px;font-weight:700;color:#4ade80;display:inline-block;margin-bottom:8px;}\n'
    + '.grp-block{margin-bottom:20px;}\n'
    + '.jbtn{background:#1a2744;color:#94a3b8;border:1px solid #2a3a5a;border-radius:6px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;margin-right:4px;}\n'
    + '.jbtn.active{background:#4ade80;color:#0b1120;border-color:#4ade80;}\n'
    + '.gbtn{background:#1a2744;color:#94a3b8;border:1px solid #2a3a5a;border-radius:6px;padding:3px 9px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;margin:0 3px 3px 0;}\n'
    + '.gbtn.active{background:#4ade80;color:#0b1120;border-color:#4ade80;}\n'
    + 'table{width:100%;border-collapse:collapse;font-size:12px;min-width:420px;}\n'
    + 'th{padding:7px 6px;color:#64748b;font-weight:600;font-size:10px;text-transform:uppercase;background:#0b1120;text-align:center;}\n'
    + 'td{padding:9px 6px;border-top:1px solid #1e2d45;color:#cbd5e1;text-align:center;}\n'
    + '.row-top{background:rgba(74,222,128,.04);}\n'
    + '.pts{color:#fbbf24;font-weight:700;}\n'
    + '.jugabet{display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#1a6b1a,#0f4a0f);border:2px solid #4ade80;border-radius:12px;padding:13px;color:#fff;font-weight:800;font-size:14px;text-decoration:none;margin-top:12px;box-shadow:0 4px 20px rgba(74,222,128,.25);}\n'
    + '.empty{text-align:center;padding:40px;color:#64748b;font-size:13px;}\n'
    + '::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:#0b1120;}::-webkit-scrollbar-thumb{background:#2a3a5a;border-radius:2px;}\n'
    + '</style>\n</head>\n<body>\n'

    + '<div class="header"><div class="inner">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">'
    + '<div style="display:flex;align-items:center;gap:10px;"><span style="font-size:24px;">⚽</span>'
    + '<div><h1 style="font-size:19px;font-weight:800;color:#fff;letter-spacing:-.5px;">MUNDIAL 2026 <span style="color:#4ade80;font-weight:400;font-size:12px;">· TIEMPO REAL</span></h1>'
    + '<p style="font-size:10px;color:#8899aa;">USA · CANADÁ · MÉXICO · 11 Jun – 19 Jul</p></div></div>'
    + '<div style="text-align:right;font-size:9px;"><div style="color:#4ade80;">✅ Actualizado</div><div style="color:#64748b;">' + nowCL + ' Chile</div></div>'
    + '</div>'
    + '<div style="display:flex;gap:10px;margin:12px 0 0;flex-wrap:wrap;">'
    + '<div class="stat-box"><div style="font-size:16px;font-weight:700;color:#4ade80;">' + finished.length + '</div><div style="font-size:9px;color:#8899aa;text-transform:uppercase;letter-spacing:.5px;">Jugados</div></div>'
    + '<div class="stat-box" style="' + (live.length > 0 ? "background:rgba(248,113,113,.15);border-color:rgba(248,113,113,.4)" : "") + '">'
    + '<div style="font-size:16px;font-weight:700;color:' + (live.length > 0 ? "#f87171" : "#4ade80") + ';">' + live.length + (live.length > 0 ? " 🔴" : "") + '</div>'
    + '<div style="font-size:9px;color:#8899aa;text-transform:uppercase;letter-spacing:.5px;">En Vivo</div></div>'
    + '<div class="stat-box"><div style="font-size:16px;font-weight:700;color:#4ade80;">' + todayAll.length + '</div><div style="font-size:9px;color:#8899aa;text-transform:uppercase;letter-spacing:.5px;">Hoy</div></div>'
    + '<div class="stat-box"><div style="font-size:16px;font-weight:700;color:#4ade80;">' + totalGoals + '</div><div style="font-size:9px;color:#8899aa;text-transform:uppercase;letter-spacing:.5px;">Goles</div></div>'
    + '</div>'
    + '<div class="tabs">'
    + '<button class="tab active" onclick="showTab(\'hoy\',this)">📅 Hoy</button>'
    + '<button class="tab" onclick="showTab(\'proximos\',this)">🗓 Próximos</button>'
    + '<button class="tab" onclick="showTab(\'resultados\',this)">📋 Resultados</button>'
    + '<button class="tab" onclick="showTab(\'tablas\',this)">📊 Tablas</button>'
    + '<button class="tab" onclick="showTab(\'apuestas\',this)">💰 Apuestas</button>'
    + '</div>'
    + '</div></div>\n'

    + '<div class="content">\n'

    // HOY
    + '<div id="hoy" class="pane active">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'
    + '<h2 style="font-size:14px;color:#cbd5e1;">Partidos de hoy · ' + todayCL + ' 🇨🇱</h2>'
    + '<span style="font-size:10px;background:#16a34a22;color:#4ade80;border:1px solid #16a34a44;border-radius:20px;padding:3px 8px;">Hora Chile</span>'
    + '</div>' + hoyHTML + '</div>\n'

    // PRÓXIMOS
    + '<div id="proximos" class="pane">'
    + '<h2 style="font-size:14px;color:#cbd5e1;margin-bottom:14px;">🗓 Próximos partidos · Hora Chile</h2>'
    + (proximosHTML || '<div class="empty">No hay próximos partidos disponibles.</div>')
    + '<div style="margin-top:22px;background:#121c30;border:1px solid #1e2d45;border-radius:12px;padding:14px;">'
    + '<h3 style="font-size:12px;color:#94a3b8;margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">🗺 Estructura del torneo</h3>'
    + '<div style="display:flex;flex-direction:column;gap:5px;font-size:12px;">'
    + '<div style="display:flex;justify-content:space-between;padding:8px 10px;background:#0d2a18;border:1px solid #166534;border-radius:7px;"><span style="font-weight:700;">Fase de Grupos</span><span style="color:#4ade80;">🔴 EN CURSO · hasta 27 Jun</span></div>'
    + '<div style="display:flex;justify-content:space-between;padding:8px 10px;background:#121c30;border:1px solid #1e2d45;border-radius:7px;"><span>16avos de Final</span><span style="color:#64748b;">29 Jun – 3 Jul</span></div>'
    + '<div style="display:flex;justify-content:space-between;padding:8px 10px;background:#121c30;border:1px solid #1e2d45;border-radius:7px;"><span>8vos de Final</span><span style="color:#64748b;">5 Jul – 8 Jul</span></div>'
    + '<div style="display:flex;justify-content:space-between;padding:8px 10px;background:#121c30;border:1px solid #1e2d45;border-radius:7px;"><span>Cuartos de Final</span><span style="color:#64748b;">11–12 Jul</span></div>'
    + '<div style="display:flex;justify-content:space-between;padding:8px 10px;background:#121c30;border:1px solid #1e2d45;border-radius:7px;"><span>Semifinales</span><span style="color:#64748b;">15–16 Jul</span></div>'
    + '<div style="display:flex;justify-content:space-between;padding:8px 10px;background:#121c30;border:1px solid #1e2d45;border-radius:7px;"><span style="font-weight:700;color:#fbbf24;">🏆 Final</span><span style="color:#fbbf24;">19 Jul · MetLife, NJ</span></div>'
    + '</div></div></div>\n'

    // RESULTADOS
    + '<div id="resultados" class="pane">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">'
    + '<h2 style="font-size:14px;color:#cbd5e1;">Resultados por Grupo</h2>'
    + '<div>' + jornadaBtns + '</div></div>'
    + jornadaBlocks
    + '</div>\n'

    // TABLAS
    + '<div id="tablas" class="pane">'
    + '<div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:14px;">' + grpBtns + '</div>'
    + tablaBlocks
    + '</div>\n'

    // APUESTAS
    + '<div id="apuestas" class="pane">'
    + '<div style="background:#1a2200;border:1px solid #3a5a00;border-radius:10px;padding:11px 13px;margin-bottom:14px;">'
    + '<div style="font-size:12px;color:#86efac;font-weight:700;margin-bottom:3px;">⚠️ Análisis al ' + dateCL + ' · ' + finished.length + ' partidos jugados</div>'
    + '</div>'
    + '<h3 style="font-size:12px;color:#4ade80;margin-bottom:9px;text-transform:uppercase;letter-spacing:1px;">🏆 Favoritos al título</h3>'
    + '<div style="display:flex;flex-direction:column;gap:7px;margin-bottom:18px;">'
    + [["🇦🇷","Argentina","Messi hat-trick vs Argelia. Iguala récord Klose 16 goles mundiales.","4.0x"],
       ["🇫🇷","Francia","3-1 a Senegal. Mbappé máximo goleador histórico de Francia.","4.5x"],
       ["🇩🇪","Alemania","7-1 a Curazao. Musiala+Havertz letales. Mejor arranque del torneo.","5.5x"],
       ["🏴󠁧󠁢󠁥󠁮󠁧󠁿","Inglaterra","4-2 a Croacia. Kane doblete. Sólido aunque frágil en defensa.","8.0x"],
       ["🇳🇴","Noruega","4-1 a Iraq. Haaland doblete en su debut mundialista. La gran sorpresa.","12x"]
      ].map(function(x){
        return '<div class="card" style="cursor:default;display:flex;align-items:center;gap:11px;">'
          + '<span style="font-size:22px;">' + x[0] + '</span>'
          + '<div style="flex:1;"><div style="font-weight:700;font-size:13px;">' + x[1] + '</div>'
          + '<div style="font-size:11px;color:#94a3b8;margin-top:2px;">' + x[2] + '</div></div>'
          + '<div style="font-size:17px;font-weight:800;color:#fbbf24;">' + x[3] + '</div></div>';
      }).join("")
    + '</div>'
    + '<h3 style="font-size:12px;color:#f87171;margin:0 0 9px;text-transform:uppercase;letter-spacing:1px;">⚠️ Cuidado al apostar</h3>'
    + '<div style="display:flex;flex-direction:column;gap:7px;margin-bottom:20px;">'
    + [["🇵🇹","Portugal","1-1 vs RD Congo. Cristiano sin tiros al arco. Debut muy pobre."],
       ["🇪🇸","España","0-0 vs Cabo Verde. El campeón Euro no apareció."],
       ["🇳🇱","Países Bajos","2-2 vs Japón: regalaron empate al 89'. Defensa frágil."]
      ].map(function(x){
        return '<div class="card" style="cursor:default;background:#1a0808;border-color:#3a1010;">'
          + '<div style="font-weight:700;font-size:12px;color:#fca5a5;">' + x[0] + ' ' + x[1] + '</div>'
          + '<div style="font-size:11px;color:#8a7070;margin-top:2px;">' + x[2] + '</div></div>';
      }).join("")
    + '</div>'
    + tipsHTML
    + continenteHTML
    + '<a class="jugabet" href="https://www.jugabet.cl" target="_blank">🎰 Apostar ahora en Jugabet Chile →</a>'
    + '<p style="font-size:10px;color:#334155;text-align:center;margin-top:8px;">Juega con responsabilidad. +18 años. Solo para residentes en Chile.</p>'
    + '</div>\n'

    + '</div>\n'
    + '<div style="text-align:center;padding:14px;font-size:10px;color:#334155;border-top:1px solid #1e2d45;">'
    + 'Datos al ' + dateCL + ' · ' + finished.length + ' partidos · Mundial 2026 · 🇨🇱 Hora Chile'
    + '</div>\n'

    + '<script>\n'
    + 'function showTab(id,btn){document.querySelectorAll(".pane").forEach(function(p){p.classList.remove("active");});document.querySelectorAll(".tab").forEach(function(t){t.classList.remove("active");});document.getElementById(id).classList.add("active");btn.classList.add("active");}\n'
    + 'function toggleCard(id){var d=document.getElementById(id);if(!d)return;var c=d.parentElement;var open=c.classList.contains("open");c.classList.toggle("open",!open);d.style.display=open?"none":"block";var a=c.querySelector("span:last-child");if(a)a.textContent=open?"▼":"▲";}\n'
    + 'function showJornada(j,btn){document.querySelectorAll(".jbtn").forEach(function(b){b.classList.remove("active");});btn.classList.add("active");document.querySelectorAll("[id^=j]").forEach(function(d){if(/^j\\d+$/.test(d.id))d.style.display="none";});var el=document.getElementById("j"+j);if(el)el.style.display="block";}\n'
    + 'function showGrp(id,btn){document.querySelectorAll(".gbtn").forEach(function(b){b.classList.remove("active");});btn.classList.add("active");document.querySelectorAll("[id^=t]").forEach(function(d){if(/^t[A-L]$/.test(d.id))d.style.display="none";});var el=document.getElementById(id);if(el)el.style.display="block";}\n'
    + '</script>\n</body>\n</html>';

  fs.writeFileSync("index.html", html);
  console.log("OK — " + finished.length + " partidos, " + totalGoals + " goles");
}

main().catch(function(e){ console.error("ERROR:", e.message); process.exit(1); });

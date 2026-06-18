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
      res.on("end", () => resolve(JSON.parse(data)));
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
  "Iraq":"Iraq","Uruguay":"Uruguay","Egypt":"Egipto","Ghana":"Ghana","Tunisia":"Túnez",
  "Argentina":"Argentina","Austria":"Austria","Colombia":"Colombia","Panama":"Panamá",
  "Cabo Verde":"Cabo Verde","Cameroon":"Camerún",
};
const n = t => NAMES[t] || t;
const f = t => FLAGS[t] || "🏳";
const sc = (h,a) => h > a ? "w" : h < a ? "l" : "d";

function clHour(utc) {
  return new Date(utc).toLocaleTimeString("es-CL", {hour:"2-digit", minute:"2-digit", timeZone:"America/Santiago"});
}
function clDateShort(utc) {
  return new Date(utc).toLocaleDateString("es-CL", {day:"numeric", month:"short", timeZone:"America/Santiago"});
}
function clDateLong(utc) {
  return new Date(utc).toLocaleDateString("es-CL", {weekday:"long", day:"numeric", month:"long", timeZone:"America/Santiago"});
}
function isToday(utc) {
  const today = new Date().toLocaleDateString("es-CL", {timeZone:"America/Santiago"});
  return new Date(utc).toLocaleDateString("es-CL", {timeZone:"America/Santiago"}) === today;
}

function goalBadge(g) {
  const flag = f(g.team?.name);
  const name = g.scorer?.name || "";
  const min = g.minute || "";
  return `<span class="badge">${flag} ${name} ${min}'</span>`;
}

function matchCard(m, open = false) {
  const home = m.homeTeam, away = m.awayTeam;
  const hG = m.score?.fullTime?.home, aG = m.score?.fullTime?.away;
  const done = m.status === "FINISHED";
  const live = m.status === "IN_PLAY" || m.status === "PAUSED";
  const grp = m.group?.replace("GROUP_", "Grupo ") || "";
  const statusLabel = done ? "✅ Final" : live ? "🔴 EN VIVO" : "⏰ Próximo";
  const statusColor = done ? "#4ade80" : live ? "#f87171" : "#60a5fa";
  const goals = m.goals?.length ? m.goals.map(goalBadge).join("") : "";
  const detailContent = `
    ${goals ? `<div style="font-size:10px;color:#94a3b8;margin-bottom:4px;">⚽ Goles</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">${goals}</div>` : ""}
    <div style="font-size:10px;color:#64748b;">📅 ${clDateShort(m.utcDate)} · 🕐 ${clHour(m.utcDate)} Chile${m.venue ? ` · 🏟 ${m.venue}` : ""}</div>`;

  return `<div class="card${open ? " open" : ""}" onclick="toggle(this)">
    <div style="display:flex;align-items:center;gap:7px;">
      ${grp ? `<span class="badge">${grp}</span>` : ""}
      <span style="font-size:10px;color:${statusColor};font-weight:700;min-width:55px;">${statusLabel}${live && m.minute ? ` ${m.minute}'` : ""}</span>
      <div style="flex:1;display:flex;align-items:center;justify-content:space-between;gap:4px;">
        <span style="font-size:12px;font-weight:600;">${f(home?.name)} ${n(home?.name)}</span>
        ${done || live
          ? `<span class="score ${sc(hG,aG)}">${hG ?? "-"} – ${aG ?? "-"}</span>`
          : `<span style="font-size:12px;color:#4ade80;font-weight:700;">${clHour(m.utcDate)}</span>`}
        <span style="font-size:12px;font-weight:600;text-align:right;">${n(away?.name)} ${f(away?.name)}</span>
      </div>
      <span style="font-size:9px;color:#4ade80;">${open ? "▲" : "▼"}</span>
    </div>
    <div style="display:${open ? "block" : "none"};margin-top:10px;border-top:1px solid #1e2d45;padding-top:9px;">${detailContent}</div>
  </div>`;
}

function tableHTML(standing) {
  const grpName = standing.group?.replace("GROUP_", "Grupo ") || "";
  const rows = standing.table?.map((row, i) => `
    <tr class="${i < 2 ? "row-top" : ""}">
      <td style="text-align:center;color:${i < 2 ? "#4ade80" : "#64748b"};font-weight:700;">${i < 2 ? "✓" : i + 1}</td>
      <td>${f(row.team?.name)} <span style="font-weight:600;color:${i < 2 ? "#e2e8f0" : "#94a3b8"}">${n(row.team?.name)}</span></td>
      <td>${row.playedGames}</td><td>${row.won}</td><td>${row.draw}</td><td>${row.lost}</td>
      <td>${row.goalsFor}</td><td>${row.goalsAgainst}</td>
      <td class="${row.goalDifference > 0 ? "dg+" : row.goalDifference < 0 ? "dg-" : "dg0"}">${row.goalDifference > 0 ? "+" : ""}${row.goalDifference}</td>
      <td class="pts">${row.points}</td>
    </tr>`).join("") || "";
  return `<div style="background:#121c30;border-radius:10px;border:1px solid #1e2d45;overflow:hidden;">
    <div style="padding:10px 13px;border-bottom:1px solid #1e2d45;font-size:13px;font-weight:700;">${grpName}</div>
    <div style="overflow-x:auto;"><table><thead><tr>
      <th>#</th><th style="text-align:left;">Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th>
    </tr></thead><tbody>${rows}</tbody></table></div>
    <div style="padding:7px 13px;border-top:1px solid #1e2d45;font-size:10px;color:#4ade80;">✓ Clasifican los 2 primeros + 8 mejores terceros</div>
  </div>`;
}

async function main() {
  console.log("Fetching data from football-data.org...");
  const [matchData, standData] = await Promise.all([
    get("competitions/WC/matches"),
    get("competitions/WC/standings"),
  ]);

  const matches = matchData.matches || [];
  const standings = (standData.standings || []).filter(s => s.type === "TOTAL");

  const finished = matches.filter(m => m.status === "FINISHED").sort((a,b) => new Date(b.utcDate) - new Date(a.utcDate));
  const live     = matches.filter(m => m.status === "IN_PLAY" || m.status === "PAUSED");
  const upcoming = matches.filter(m => m.status === "SCHEDULED" || m.status === "TIMED").sort((a,b) => new Date(a.utcDate) - new Date(b.utcDate));
  const todayAll = matches.filter(m => isToday(m.utcDate)).sort((a,b) => new Date(a.utcDate) - new Date(b.utcDate));

  const totalGoals = finished.reduce((s,m) => s + (m.score?.fullTime?.home||0) + (m.score?.fullTime?.away||0), 0);
  const promedio   = finished.length ? (totalGoals / finished.length).toFixed(2) : "0.00";
  const nowCL      = new Date().toLocaleTimeString("es-CL", {hour:"2-digit", minute:"2-digit", timeZone:"America/Santiago"});
  const todayCL    = new Date().toLocaleDateString("es-CL", {weekday:"long", day:"numeric", month:"long", timeZone:"America/Santiago"});

  // HOY
  const hoyHTML = todayAll.length
    ? todayAll.map(m => matchCard(m, m.status==="IN_PLAY"||m.status==="PAUSED")).join("")
    : `<div class="empty">No hay partidos programados para hoy.</div>`;

  // RESULTADOS por grupo y jornada
  const jornadas = [...new Set(finished.map(m => m.matchday))].sort((a,b) => a-b);
  const jornadaBtns = jornadas.map((j,i) =>
    `<button class="jbtn${i===jornadas.length-1?" active":""}" onclick="showJornada(${j},this)">J${j}</button>`
  ).join("");
  const grupos = ["GROUP_A","GROUP_B","GROUP_C","GROUP_D","GROUP_E","GROUP_F","GROUP_G","GROUP_H","GROUP_I","GROUP_J","GROUP_K","GROUP_L"];
  const jornadaBlocks = jornadas.map((j,ji) => {
    const pj = finished.filter(m => m.matchday === j);
    const grpsConPartidos = grupos.filter(g => pj.some(m => m.group === g));
    return `<div id="j${j}" style="display:${ji===jornadas.length-1?"block":"none"};">
      ${grpsConPartidos.map(g => `
        <div class="grp-block">
          <div class="grp-hdr">${g.replace("GROUP_","Grupo ")} · J${j}</div>
          ${pj.filter(m => m.group === g).map(m => matchCard(m)).join("")}
        </div>`).join("")}
    </div>`;
  }).join("");

  // TABLAS — botones y contenido
  const grpIds = standings.map(s => s.group);
  const grpBtns = standings.map((s,i) =>
    `<button class="gbtn${i===0?" active":""}" onclick="showGrp('t${s.group?.replace("GROUP_","")}',this)">${s.group?.replace("GROUP_","G ")}</button>`
  ).join("");
  const tablaBlocks = standings.map((s,i) =>
    `<div id="t${s.group?.replace("GROUP_","")}" style="display:${i===0?"block":"none"};">${tableHTML(s)}</div>`
  ).join("");

  // PRÓXIMOS — agrupados por fecha
  const byDate = {};
  upcoming.slice(0, 24).forEach(m => {
    const d = clDateShort(m.utcDate);
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(m);
  });
  const proximosHTML = Object.entries(byDate).map(([fecha, ms]) => `
    <div style="font-size:11px;color:#4ade80;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:16px 0 8px;">
      <span style="background:#0d2a18;border-radius:4px;padding:2px 8px;border:1px solid #166534;">${fecha}</span>
    </div>
    ${ms.map(m => matchCard(m)).join("")}`).join("");

  // Leer index.html actual y reemplazar secciones dinámicas
  let html = fs.readFileSync("index.html", "utf8");

  // Actualizar stats
  html = html.replace(/(<div[^>]*id="stat-jugados"[^>]*>)[\s\S]*?(<\/div>)/, `$1${finished.length}$2`);
  html = html.replace(/(<div[^>]*id="stat-hoy"[^>]*>)[\s\S]*?(<\/div>)/, `$1${todayAll.length}$2`);
  html = html.replace(/(<div[^>]*id="stat-goles"[^>]*>)[\s\S]*?(<\/div>)/, `$1${totalGoals}$2`);
  html = html.replace(/(<div[^>]*id="stat-prom"[^>]*>)[\s\S]*?(<\/div>)/, `$1${promedio}$2`);
  html = html.replace(/(<div[^>]*id="update-time"[^>]*>)[\s\S]*?(<\/div>)/, `$1Actualizado ${nowCL} Chile$2`);
  html = html.replace(/(<div[^>]*id="today-date"[^>]*>)[\s\S]*?(<\/div>)/, `$1${todayCL}$2`);

  // Reemplazar secciones dinámicas
  html = html.replace(/<!--HOY_START-->[\s\S]*?<!--HOY_END-->/, `<!--HOY_START-->${hoyHTML}<!--HOY_END-->`);
  html = html.replace(/<!--JORNADA_BTNS_START-->[\s\S]*?<!--JORNADA_BTNS_END-->/, `<!--JORNADA_BTNS_START-->${jornadaBtns}<!--JORNADA_BTNS_END-->`);
  html = html.replace(/<!--RESULTADOS_START-->[\s\S]*?<!--RESULTADOS_END-->/, `<!--RESULTADOS_START-->${jornadaBlocks}<!--RESULTADOS_END-->`);
  html = html.replace(/<!--GRP_BTNS_START-->[\s\S]*?<!--GRP_BTNS_END-->/, `<!--GRP_BTNS_START-->${grpBtns}<!--GRP_BTNS_END-->`);
  html = html.replace(/<!--TABLAS_START-->[\s\S]*?<!--TABLAS_END-->/, `<!--TABLAS_START-->${tablaBlocks}<!--TABLAS_END-->`);
  html = html.replace(/<!--PROXIMOS_START-->[\s\S]*?<!--PROXIMOS_END-->/, `<!--PROXIMOS_START-->${proximosHTML}<!--PROXIMOS_END-->`);

  fs.writeFileSync("index.html", html);
  console.log(`✅ index.html actualizado — ${finished.length} partidos, ${totalGoals} goles`);
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });

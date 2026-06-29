const https = require("https");
const fs = require("fs");
const API_KEY    = "8245823280194f62b10dfbbdb08216d5";
const CACHE_FILE = "stats_cache.json";

// Carga cache de estadísticas (se actualiza cada vez que hay partidos nuevos)
var statsCache = {};
try { statsCache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")); } catch(e) {}

function get(path) {
  return new Promise((resolve, reject) => {
    https.get({
      hostname: "api.football-data.org",
      path: "/v4/" + path,
      headers: { "X-Auth-Token": API_KEY },
    }, (res) => {
      let raw = "";
      res.on("data", c => raw += c);
      res.on("end", () => { try { resolve(JSON.parse(raw)); } catch(e) { reject(e); } });
    }).on("error", reject);
  });
}

function getESPN(path) {
  return new Promise(function(resolve) {
    https.get({
      hostname: "site.api.espn.com",
      path: "/apis/site/v2/sports/soccer/fifa.world/" + path,
      headers: { "User-Agent": "Mozilla/5.0 (compatible)" }
    }, function(res) {
      var raw = "";
      res.on("data", function(c) { raw += c; });
      res.on("end", function() { try { resolve(JSON.parse(raw)); } catch(e) { resolve({}); } });
    }).on("error", function() { resolve({}); });
  });
}

// Mapea estadísticas ESPN → formato cache
function mapESPNStats(summary, homeTeam, awayTeam) {
  var teams = (summary.boxscore && summary.boxscore.teams) || [];
  if (teams.length < 2) return [];
  return teams.map(function(t) {
    var sm = {};
    (t.statistics || []).forEach(function(s) { sm[s.name] = s.displayValue !== undefined ? s.displayValue : String(s.value || 0); });
    // possessionPct viene como "54.6", lo convertimos a "54.6%"
    var poss = sm.possessionPct ? sm.possessionPct + "%" : "0%";
    // passPct viene como "0.9" (fracción), lo convertimos a "90%"
    var passPctVal = sm.passPct ? Math.round(parseFloat(sm.passPct) * 100) + "%" : "0%";
    return {
      team: { name: t.team && t.team.displayName || "" },
      statistics: [
        { type: "Total Shots",     value: sm.totalShots || "0" },
        { type: "Shots on Goal",   value: sm.shotsOnTarget || "0" },
        { type: "Ball Possession", value: poss },
        { type: "Total passes",    value: sm.totalPasses || "0" },
        { type: "Passes %",        value: passPctVal },
        { type: "Fouls",           value: sm.foulsCommitted || "0" },
        { type: "Yellow Cards",    value: sm.yellowCards || "0" },
        { type: "Red Cards",       value: sm.redCards || "0" },
        { type: "Offsides",        value: sm.offsides || "0" },
        { type: "Corner Kicks",    value: sm.wonCorners || "0" }
      ]
    };
  });
}

// Mapea eventos ESPN → formato cache (goles + tarjetas)
function mapESPNEvents(summary) {
  var events = [];
  // Goles desde scoringPlays
  (summary.scoringPlays || []).forEach(function(p) {
    var min = p.clock && p.clock.displayValue ? parseInt(p.clock.displayValue) : 0;
    events.push({
      time:   { elapsed: min },
      type:   { detail: "Normal Goal" },
      player: { name: (p.participants && p.participants[0] && p.participants[0].athlete && p.participants[0].athlete.displayName) || "" },
      team:   { name: (p.team && p.team.displayName) || "" }
    });
  });
  // Tarjetas desde plays (type.id 57=amarilla, 58=roja)
  (summary.plays || []).forEach(function(p) {
    var tid = p.type && p.type.id;
    if (tid == 57 || tid == 58) {
      var min = p.clock && p.clock.displayValue ? parseInt(p.clock.displayValue) : 0;
      events.push({
        time:   { elapsed: min },
        type:   { detail: tid == 57 ? "Yellow Card" : "Red Card" },
        player: { name: (p.participants && p.participants[0] && p.participants[0].athlete && p.participants[0].athlete.displayName) || "" },
        team:   { name: (p.team && p.team.displayName) || "" }
      });
    }
  });
  return events;
}

// Nombres y banderas — clave: nombre exacto que devuelve la API
const FLAGS = {
  "Mexico":"🇲🇽","South Africa":"🇿🇦","Korea Republic":"🇰🇷","Czechia":"🇨🇿",
  "Canada":"🇨🇦","Bosnia and Herzegovina":"🇧🇦","Qatar":"🇶🇦","Switzerland":"🇨🇭",
  "Brazil":"🇧🇷","Morocco":"🇲🇦","Haiti":"🇭🇹","Scotland":"🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "USA":"🇺🇸","United States":"🇺🇸","Paraguay":"🇵🇾","Australia":"🇦🇺","Turkey":"🇹🇷",
  "Germany":"🇩🇪","Curaçao":"🇨🇼","Curacao":"🇨🇼","Côte d'Ivoire":"🇨🇮","Ecuador":"🇪🇨",
  "Netherlands":"🇳🇱","Japan":"🇯🇵","Sweden":"🇸🇪","Tunisia":"🇹🇳",
  "IR Iran":"🇮🇷","New Zealand":"🇳🇿","Belgium":"🇧🇪","Egypt":"🇪🇬",
  "Spain":"🇪🇸","Cabo Verde":"🇨🇻","Cape Verde":"🇨🇻","Cape Verde Islands":"🇨🇻","Saudi Arabia":"🇸🇦","Uruguay":"🇺🇾",
  "France":"🇫🇷","Senegal":"🇸🇳","Norway":"🇳🇴","Iraq":"🇮🇶",
  "Argentina":"🇦🇷","Algeria":"🇩🇿","Austria":"🇦🇹","Jordan":"🇯🇴",
  "Portugal":"🇵🇹","DR Congo":"🇨🇩","Uzbekistan":"🇺🇿","Colombia":"🇨🇴",
  "England":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Croatia":"🇭🇷","Ghana":"🇬🇭","Panama":"🇵🇦","South Korea":"🇰🇷","Korea DPR":"🇰🇵","Bosnia-Herzegovina":"🇧🇦",
};
const NAMES = {
  "Mexico":"México","South Africa":"Sudáfrica","Korea Republic":"Corea del Sur","Czechia":"Rep. Checa",
  "Canada":"Canadá","Bosnia and Herzegovina":"Bosnia-Herz.","Switzerland":"Suiza","Brazil":"Brasil",
  "Morocco":"Marruecos","Haiti":"Haití","Scotland":"Escocia","USA":"EE.UU.","United States":"EE.UU.",
  "Turkey":"Turquía","Germany":"Alemania","Côte d'Ivoire":"Costa de Marfil","Netherlands":"Países Bajos",
  "Japan":"Japón","Sweden":"Suecia","Tunisia":"Túnez","IR Iran":"Irán","New Zealand":"Nueva Zelanda",
  "Belgium":"Bélgica","Spain":"España","Saudi Arabia":"Arabia Saudita","France":"Francia",
  "Norway":"Noruega","Algeria":"Argelia","Jordan":"Jordania","DR Congo":"RD Congo",
  "Uzbekistan":"Uzbekistán","England":"Inglaterra","Croatia":"Croacia","Ecuador":"Ecuador",
  "Curaçao":"Curazao","Curacao":"Curazao","Paraguay":"Paraguay","Australia":"Australia",
  "Senegal":"Senegal","Iraq":"Iraq","Uruguay":"Uruguay","Egypt":"Egipto","Ghana":"Ghana",
  "Argentina":"Argentina","Austria":"Austria","Colombia":"Colombia","Panama":"Panamá",
  "Cabo Verde":"Cabo Verde","Cape Verde":"Cabo Verde","Cape Verde Islands":"Cabo Verde",
  "Portugal":"Portugal","Qatar":"Qatar","South Korea":"Corea del Sur","Korea DPR":"Corea del Norte","Bosnia-Herzegovina":"Bosnia-Herz.",
};
const n = t => (t && NAMES[t]) || t || "?";
const f = t => (t && FLAGS[t]) || "🏳";

function clHour(utc) {
  var h = new Date(utc).toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"America/Santiago"});
  return h === "24:00" ? "00:00" : h;
}
function clDateShort(utc) {
  return new Date(utc).toLocaleDateString("es-CL",{day:"numeric",month:"short",timeZone:"America/Santiago"});
}
function clDateLong(utc) {
  return new Date(utc).toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"long",timeZone:"America/Santiago"});
}
function isToday(utc) {
  var today = new Date().toLocaleDateString("es-CL",{timeZone:"America/Santiago"});
  return new Date(utc).toLocaleDateString("es-CL",{timeZone:"America/Santiago"}) === today;
}
function sc(h,a) { return h>a?"w":h<a?"l":"d"; }

// ── ANÁLISIS — clave: "NombreAPI_NombreAPI" exacto ──
var ANAL = {};

// J1
ANAL["Mexico_South Africa"]          = {g:"México ganó 2-0 a Sudáfrica. Quiñones y Jiménez marcaron.",go:"Raúl Jiménez (México) con gol y buen partido.",fi:"Quiñones (México) — gol tempranero y mucha presión.",ap:"Partido terminado · México lidera con 3 pts",pr:"✅ México 2-0"};
ANAL["Korea Republic_Czechia"]       = {g:"Corea del Sur remontó 2-1 a Rep. Checa. Hwang In-beom y Oh Hyeon-gyu.",go:"Oh Hyeon-gyu (Corea) marcó el gol decisive al 80min.",fi:"Hwang In-beom (Corea) — el mejor del partido.",ap:"Partido terminado · Corea del Sur con 3 pts",pr:"✅ Corea 2-1"};
ANAL["Canada_Bosnia and Herzegovina"]= {g:"Canadá empató 1-1 con Bosnia. Lukic adelantó a Bosnia, Larin igualó.",go:"Cyle Larin (Canadá) rescató el punto al 78min.",fi:"Larin (Canadá) — el goleador más en forma del equipo.",ap:"Partido terminado · Empate 1-1",pr:"✅ Empate 1-1"};
ANAL["USA_Paraguay"]                 = {g:"EE.UU. goleó 4-1 a Paraguay. Balogun doblete + Reyna.",go:"Folarin Balogun (EE.UU.) con doblete devastador.",fi:"Balogun (EE.UU.) — el máximo goleador del torneo hasta J1.",ap:"Partido terminado · EE.UU. lidera con 3 pts",pr:"✅ EE.UU. 4-1"};
ANAL["Qatar_Switzerland"]            = {g:"Qatar igualó 1-1 con Suiza. Embolo de penal, autogol de Muheim.",go:"Breel Embolo (Suiza) de penal. Autogol de Muheim para Qatar.",fi:"Embolo (Suiza) — el más incisivo del partido.",ap:"Partido terminado · Empate 1-1",pr:"✅ Empate 1-1"};
ANAL["Brazil_Morocco"]               = {g:"Brasil empató 1-1 con Marruecos. Saibari adelantó, Vinícius igualó.",go:"Vinícius Jr (Brasil) igualó al 32min. Saibari (Marruecos) marcó primero.",fi:"Vinícius Jr (Brasil) — el gol que rescató el punto.",ap:"Partido terminado · Empate 1-1",pr:"✅ Empate 1-1"};
ANAL["Haiti_Scotland"]               = {g:"Escocia ganó 1-0 a Haití con gol de McGinn al 28min.",go:"John McGinn (Escocia) — el único gol del partido.",fi:"McGinn (Escocia) — gol y liderazgo en el mediocampo.",ap:"Partido terminado · Escocia con 3 pts",pr:"✅ Escocia 1-0"};
ANAL["Australia_Turkey"]             = {g:"Australia ganó 2-0 a Turquía. Irankunda y Metcalfe.",go:"Irankunda (Australia) al 27min. Metcalfe al 75min.",fi:"Nestory Irankunda (Australia) — joven y explosivo.",ap:"Partido terminado · Australia con 3 pts",pr:"✅ Australia 2-0"};
ANAL["Germany_Curaçao"]              = {g:"Alemania goleó 7-1 a Curazao. Havertz doblete, Musiala, Schlotterbeck y más.",go:"Kai Havertz (Alemania) con doblete. Comenencia marcó para Curazao.",fi:"Jamal Musiala (Alemania) — el más creativo del torneo.",ap:"Partido terminado · Alemania aplasta",pr:"✅ Alemania 7-1"};
ANAL["Germany_Ivory Coast"]           = {g:"Alemania ganó 2-1 a Costa de Marfil en partido más ajustado de lo esperado.",go:"Alemania marcó dos goles. Costa de Marfil descontó.",fi:"Jamal Musiala (Alemania) — el más creativo.",ap:"Partido terminado · Alemania 6 pts",pr:"✅ Alemania 2-1"};
ANAL["Côte d'Ivoire_Ecuador"]        = {g:"Costa de Marfil ganó 1-0 a Ecuador con gol de Amad Diallo al 90min.",go:"Amad Diallo (Costa de Marfil) — gol agónico al 90min.",fi:"Amad Diallo (Costa de Marfil) — el héroe de la jornada.",ap:"Partido terminado · Costa de Marfil con 3 pts",pr:"✅ C. Marfil 1-0"};
ANAL["Netherlands_Japan"]            = {g:"Japón empató 2-2 con Países Bajos con gol de Kamada al 89min.",go:"Daichi Kamada (Japón) empató al 89min. Van Dijk y Summerville por Países Bajos.",fi:"Daichi Kamada (Japón) — el gol más dramático de J1.",ap:"Partido terminado · Empate 2-2",pr:"✅ Empate 2-2"};
ANAL["Sweden_Tunisia"]               = {g:"Suecia goleó 5-1 a Túnez. Gyökeres, Isak, Svanberg.",go:"Viktor Gyökeres (Suecia) marcó y fue el mejor del partido.",fi:"Viktor Gyökeres (Suecia) — imparable. El goleador del torneo.",ap:"Partido terminado · Suecia lidera con 3 pts",pr:"✅ Suecia 5-1"};
ANAL["Spain_Cabo Verde"]             = {g:"España empató 0-0 con Cabo Verde. Gran decepción del campeón Euro.",go:"Nadie anotó. España sin ideas ofensivas.",fi:"Nadie destacó. España muy por debajo de su nivel.",ap:"Partido terminado · Empate decepcionante",pr:"✅ Empate 0-0"};
ANAL["Saudi Arabia_Uruguay"]         = {g:"Arabia Saudita igualó 1-1 con Uruguay. Al Amri y Araújo.",go:"Araújo (Uruguay) igualó al 80min de cabeza.",fi:"Araúl Araújo (Uruguay) — el gol que rescató el punto.",ap:"Partido terminado · Empate 1-1",pr:"✅ Empate 1-1"};
ANAL["Belgium_Egypt"]                = {g:"Bélgica empató 1-1 con Egipto. Autogol y gol de Emam Ashour.",go:"Emam Ashour (Egipto) marcó primero. Autogol de M.Hany empató.",fi:"Emam Ashour (Egipto) — la sorpresa de la jornada.",ap:"Partido terminado · Empate frustrante para Bélgica",pr:"✅ Empate 1-1"};
ANAL["IR Iran_New Zealand"]          = {g:"Irán empató 2-2 con Nueva Zelanda. E. Just marcó dos veces.",go:"E. Just (Nueva Zelanda) doblete. Rezaeian y Mohebbi (Irán).",fi:"E. Just (Nueva Zelanda) — la revelación de la jornada.",ap:"Partido terminado · Empate 2-2",pr:"✅ Empate 2-2"};
ANAL["France_Senegal"]               = {g:"Francia ganó 3-1 a Senegal. Mbappé doblete.",go:"Kylian Mbappé (Francia) con dos goles. Barcola también.",fi:"Kylian Mbappé (Francia) — máximo goleador histórico de Francia.",ap:"Partido terminado · Francia lidera con 3 pts",pr:"✅ Francia 3-1"};
ANAL["Iraq_Norway"]                  = {g:"Noruega goleó 4-1 a Iraq. Haaland doblete en debut mundialista.",go:"Erling Haaland (Noruega) con doblete. Østigård también anotó.",fi:"Erling Haaland (Noruega) — debut histórico en Mundiales.",ap:"Partido terminado · Noruega lidera con 3 pts",pr:"✅ Noruega 4-1"};
ANAL["Argentina_Algeria"]            = {g:"Argentina goleó 3-0 a Argelia. Messi hat-trick histórico.",go:"Lionel Messi (Argentina) con hat-trick. Iguala récord de Klose.",fi:"Lionel Messi (Argentina) — el mejor del torneo hasta ahora.",ap:"Partido terminado · Argentina lidera con 3 pts",pr:"✅ Argentina 3-0"};
ANAL["Austria_Jordan"]               = {g:"Austria ganó 3-1 a Jordania. Schmid y Arnautovic de penal.",go:"Arnautovic (Austria) de penal. Ali Olwan marcó el primero histórico de Jordania.",fi:"R. Schmid (Austria) — gol y muy activo en todo el partido.",ap:"Partido terminado · Austria con 3 pts",pr:"✅ Austria 3-1"};
ANAL["Portugal_DR Congo"]            = {g:"Portugal empató 1-1 con RD Congo. Debut muy pobre de Cristiano.",go:"J. Neves (Portugal) al 6min. Wissa (RD Congo) igualó al 38min.",fi:"Wissa (RD Congo) — el héroe africano. Cristiano sin tiros.",ap:"Partido terminado · Empate decepcionante",pr:"✅ Empate 1-1"};
ANAL["Uzbekistan_Colombia"]          = {g:"Colombia goleó 3-1 a Uzbekistán. Luis Díaz y Campaz.",go:"Luis Díaz (Colombia) al 65min. D. Muñoz al 40min. Campaz al 90+9min.",fi:"Luis Díaz (Colombia) — extremo del Liverpool en estado de gracia.",ap:"Partido terminado · Colombia lidera el Grupo K",pr:"✅ Colombia 3-1"};
ANAL["England_Croatia"]              = {g:"Inglaterra goleó 4-2 a Croacia. Kane doblete. Bellingham y Rashford.",go:"Harry Kane (Inglaterra) con doblete. Baturina y Musa (Croacia).",fi:"Jude Bellingham (Inglaterra) — determinante en el 3er gol.",ap:"Partido terminado · Inglaterra lidera con 3 pts",pr:"✅ Inglaterra 4-2"};
ANAL["Ghana_Panama"]                 = {g:"Ghana ganó 1-0 a Panamá con gol agónico de Yirenkyi al 94min.",go:"Yirenkyi (Ghana) — el gol más tardío del torneo hasta ahora.",fi:"Yirenkyi (Ghana) — el héroe de la jornada africana.",ap:"Partido terminado · Ghana con 3 pts",pr:"✅ Ghana 1-0"};

// J2
ANAL["Czechia_South Africa"]         = {g:"Rep. Checa empató 1-1 con Sudáfrica. Krejčí y Mokoena de penal.",go:"Krejčí (Rep. Checa) al 22min. Mokoena (Sudáfrica) de penal al 82min.",fi:"Mokoena (Sudáfrica) — el penal que rescató el punto.",ap:"Partido terminado · Empate 1-1",pr:"✅ Empate 1-1"};
ANAL["Mexico_Korea Republic"]        = {g:"México ganó 1-0 a Corea del Sur con gol de Luis Romo al 50min. México clasificado.",go:"Luis Romo (México) — el gol decisive que clasifica al Tri.",fi:"Guillermo Ochoa (México) — valla invicta en 2 partidos.",ap:"Partido terminado · México clasificado 6 pts",pr:"✅ México 1-0"};
ANAL["Switzerland_Bosnia and Herzegovina"] = {g:"Suiza goleó 4-1 a Bosnia. Manzambi doblete desde el banco.",go:"Manzambi (Suiza) doblete al 74min y 90+5min. Xhaka de penal.",fi:"Manzambi (Suiza) — entró desde el banco y decidió el partido.",ap:"Partido terminado · Suiza con 4 pts lidera",pr:"✅ Suiza 4-1"};
ANAL["Switzerland_Bosnia"] = ANAL["Switzerland_Bosnia and Herzegovina"];
ANAL["Switzerland_Bosnia-Herzegovina"]  = ANAL["Switzerland_Bosnia and Herzegovina"];
ANAL["Switzerland_Bosnia"]              = ANAL["Switzerland_Bosnia and Herzegovina"];
ANAL["Canada_Qatar"]                 = {g:"Canadá goleó 6-0 a Qatar. La mayor goleada del torneo. David, Buchanan, Larin doblete, Osorio, Davies.",go:"Jonathan David (Canadá) abrió el marcador. Larin con doblete.",fi:"Alphonso Davies (Canadá) — gol y asistencia. El más rápido del torneo.",ap:"Partido terminado · Canadá con 4 pts",pr:"✅ Canadá 6-0"};
ANAL["Morocco_Scotland"]             = {g:"Marruecos ganó 1-0 a Escocia con gol de Saibari al 67min.",go:"Saibari (Marruecos) — el gol que da el liderato del Grupo C.",fi:"Achraf Hakimi (Marruecos) — el más activo por banda.",ap:"Partido terminado · Marruecos lidera Grupo C",pr:"✅ Marruecos 1-0"};
ANAL["Brazil_Haiti"]                 = {g:"Brasil goleó 3-0 a Haití. Cunha doblete y Vinícius Jr.",go:"Matheus Cunha (Brasil) doblete al 23min y 36min. Vinícius al 45+3min.",fi:"Matheus Cunha (Brasil) — el despertar del scratch.",ap:"Partido terminado · Brasil con 4 pts",pr:"✅ Brasil 3-0"};
ANAL["USA_Australia"]                = {g:"EE.UU. ganó 2-0 a Australia y se clasificó a 16avos. Autogol + Freeman.",go:"Autogol de Burgess al 11min. A. Freeman al 38min.",fi:"A. Freeman (EE.UU.) — gol y rendimiento destacado.",ap:"Partido terminado · EE.UU. clasificado 6 pts",pr:"✅ EE.UU. 2-0"};
ANAL["Turkey_Paraguay"]              = {g:"Paraguay ganó 1-0 a Turquía con Almirón expulsado al inicio. Galarza al 2min.",go:"M. Galarza (Paraguay) al 2min. Turquía con 10 hombres todo el partido.",fi:"Galarza (Paraguay) — el gol héroe al minuto 2.",ap:"Partido terminado · Turquía eliminada",pr:"✅ Paraguay 1-0"};
ANAL["Germany_Côte d'Ivoire"]        = {g:"Alemania ganó 2-1 a Costa de Marfil en partido más ajustado de lo esperado.",go:"Alemania marcó dos goles. Costa de Marfil descontó.",fi:"Jamal Musiala (Alemania) — el más creativo.",ap:"Partido terminado · Alemania 6 pts",pr:"✅ Alemania 2-1"};
ANAL["Germany_Cote d'Ivoire"]         = ANAL["Germany_Côte d'Ivoire"];
ANAL["Germany_Ivory Coast"]           = ANAL["Germany_Côte d'Ivoire"];
ANAL["Germany_Côte d\'Ivoire"]       = ANAL["Germany_Côte d'Ivoire"];
ANAL["Ecuador_Curaçao"]              = {g:"Ecuador empató 0-0 con Curazao. Decepción total. Ecuador casi eliminado.",go:"Nadie anotó. Ecuador sin ideas ofensivas durante 90min.",fi:"Moisés Caicedo (Ecuador) — el único que intentó.",ap:"Partido terminado · Ecuador en serios problemas",pr:"✅ Empate 0-0"};
ANAL["Netherlands_Sweden"]           = {g:"Países Bajos goleó 5-1 a Suecia. Xavi Simons doblete. Gyökeres marcó el descuento.",go:"Xavi Simons (Países Bajos) doblete espectacular. Gyökeres (Suecia) marcó.",fi:"Xavi Simons (Países Bajos) — figura del partido con 2 goles.",ap:"Partido terminado · Países Bajos con 4 pts",pr:"✅ Países Bajos 5-1"};

// J2 pendientes / próximos con análisis
ANAL["Tunisia_Japan"]                = {g:"Japón parte como claro favorito. Túnez fue goleado 1-5 por Suecia.",go:"Daichi Kamada (Japón) — marcó el 2-2 al 89min vs Países Bajos. Ritsu Doan peligroso.",fi:"Takumi Minamino (Japón) — motor junto a Kamada.",ap:"Japón gana · Más de 1.5 goles · Kamada anota. Cuota est: 2.2x",pr:"Pred: Japón 2-0"};
ANAL["Spain_Saudi Arabia"]           = {g:"España obligada a reaccionar tras el 0-0 vs Cabo Verde. Arabia Saudita igualó con Uruguay.",go:"Pedri y Morata (España). Al-Dawsari (Arabia Saudita) en contraataque.",fi:"Pedri (España) — el creativo que España necesita despertar.",ap:"España gana · Pedri con asistencia. Cuota est: 1.9x",pr:"Pred: España 2-0"};
ANAL["Belgium_Iran"]                  = {g:"Bélgica igualó 1-1 con Egipto en J1. Irán cedió 2-2 con Nueva Zelanda. Partido parejo entre dos equipos irregulares.",go:"Romelu Lukaku (Bélgica) — si está en forma es letal. Mehdi Taremi (Irán) referente ofensivo.",fi:"Kevin De Bruyne (Bélgica) — si aparece cambia el partido.",ap:"Bélgica gana por la mínima · Menos de 3 goles. Cuota est: 2.3x",pr:"Pred: Bélgica 1-0"};
ANAL["Belgium_IR Iran"]               = ANAL["Belgium_Iran"];
ANAL["Belgium_Islamic Republic of Iran"] = ANAL["Belgium_Iran"];
ANAL["Uruguay_Cape Verde Islands"]    = {g:"Uruguay igualó 1-1 con Arabia Saudita (Araújo 80min). Cabo Verde sorprendió empate 0-0 con España. Uruguay tiene más historia y calidad.",go:"Darwin Núñez (Uruguay) — el más peligroso en ataque.",fi:"Federico Valverde (Uruguay) — motor del equipo celeste.",ap:"Uruguay gana · Darwin Núñez anota. Cuota est: 2.1x",pr:"Pred: Uruguay 2-0"};
ANAL["Uruguay_Cabo Verde"]            = ANAL["Uruguay_Cape Verde Islands"];
ANAL["Uruguay_Cape Verde"]            = ANAL["Uruguay_Cape Verde Islands"];
ANAL["Uruguay_Cabo Verde Islands"]    = ANAL["Uruguay_Cape Verde Islands"];
ANAL["New Zealand_Egypt"]            = {g:"Nueva Zelanda cedió 2-2 con Irán. Egipto empató 1-1 con Bélgica. Partido parejo.",go:"Chris Wood (Nueva Zelanda). Omar Marmoush (Egipto) viene de gran temporada.",fi:"Chris Wood (Nueva Zelanda) — delantero referente.",ap:"Empate o Egipto gana · Menos de 2.5 goles. Cuota est: 2.0x",pr:"Pred: Egipto 1-0"};
ANAL["Argentina_Austria"]            = {g:"Argentina viene de 3-0 a Argelia con hat-trick de Messi. Austria ganó 3-1 a Jordania.",go:"Messi (Argentina) — 16 goles mundiales. Arnautovic (Austria) peligroso.",fi:"Lionel Messi (Argentina) — el mejor de todos los tiempos.",ap:"Argentina gana · Messi anota · Más de 2.5 goles. Cuota est: 2.0x",pr:"Pred: Argentina 2-0"};
ANAL["France_Iraq"]                  = {g:"Francia viene de 3-1 a Senegal. Iraq perdió 1-4 con Noruega. Francia debe golear.",go:"Mbappé (Francia) — más en forma del torneo. Barcola también marcó.",fi:"Kylian Mbappé (Francia) — goleador histórico de Francia.",ap:"Francia gana +2 goles · Mbappé anota. Cuota est: 1.8x",pr:"Pred: Francia 3-0"};
ANAL["Norway_Senegal"]               = {g:"Noruega goleó 4-1 a Iraq. Senegal perdió 1-3 con Francia. Noruega favorita.",go:"Erling Haaland (Noruega) — doblete J1, imparable. Sadio Mané (Senegal).",fi:"Erling Haaland (Noruega) — el más letal del torneo.",ap:"Noruega gana · Haaland anota · Más de 2.5 goles. Cuota est: 1.9x",pr:"Pred: Noruega 2-1"};
ANAL["Jordan_Algeria"]               = {g:"Ambas perdieron J1. Partido entre los dos casi eliminados del Grupo J.",go:"Ali Olwan (Jordania) — marcó primer gol histórico de Jordania en un Mundial.",fi:"Ali Olwan (Jordania) — el autor del gol histórico.",ap:"Empate o Jordania gana · Menos de 2.5 goles. Cuota est: 2.5x",pr:"Pred: Empate 1-1"};
ANAL["Portugal_Uzbekistan"]          = {g:"Portugal decepcionó 1-1 con RD Congo. Uzbekistán perdió 1-3 con Colombia. Portugal obligado.",go:"Cristiano Ronaldo (Portugal) — necesita despertar. Bruno Fernandes creativo.",fi:"Bruno Fernandes (Portugal) — el más dinámico. Si aparece, Portugal gana.",ap:"Portugal gana · Bruno Fernandes anota o asiste. Cuota est: 1.7x",pr:"Pred: Portugal 3-0"};
ANAL["England_Ghana"]                = {g:"Inglaterra goleó 4-2 a Croacia. Ghana ganó 1-0 a Panamá al 94min. Inglaterra favorita.",go:"Harry Kane (Inglaterra) — doblete J1. Mohammed Kudus (Ghana) peligro africano.",fi:"Jude Bellingham (Inglaterra) — puede marcar la diferencia.",ap:"Inglaterra gana · Kane anota · Más de 2.5 goles. Cuota est: 1.8x",pr:"Pred: Inglaterra 2-0"};
ANAL["Panama_Croatia"]               = {g:"Panamá perdió 0-1. Croacia perdió 2-4. Ambos de vida o muerte.",go:"Ismael Díaz (Panamá). Ivan Perisic (Croacia) si juega.",fi:"Luka Modric (Croacia) — su último Mundial. Puede liderar la reacción.",ap:"Croacia gana · Modric con asistencia. Cuota est: 2.2x",pr:"Pred: Croacia 2-0"};
ANAL["Colombia_DR Congo"]            = {g:"Colombia goleó 3-1 a Uzbekistán. RD Congo empató 1-1 con Portugal sorprendiendo a todos. El Congo tiene a Wissa (Brentford) y Aaron Wan-Bissaka como figuras. Colombia favorita pero debe cuidarse del contragolpe congoleño.",go:"Luis Díaz (Colombia) — el más desequilibrante. James Rodríguez como cerebro creativo. Yoane Wissa (RD Congo) ya demostró su nivel vs Portugal.",fi:"Luis Díaz (Colombia) — extremo del Liverpool en estado de gracia. Si aparece, Colombia gana cómodo.",ap:"Colombia gana · Luis Díaz anota · Más de 1.5 goles. Cuota est: 1.9x",pr:"Pred: Colombia 2-0"};
ANAL["Colombia_Congo DR"]            = ANAL["Colombia_DR Congo"];
ANAL["Colombia_Republic of Congo"]   = ANAL["Colombia_DR Congo"];
ANAL["Colombia_Democratic Republic of Congo"] = ANAL["Colombia_DR Congo"];
ANAL["Colombia_Congo"]               = ANAL["Colombia_DR Congo"];


// ── J3 ──
ANAL["Switzerland_Canada"]           = {g:"Suiza lidera Grupo B con 4 pts. Canadá también con 4 pts. Partido decisivo por el primer lugar. Suiza viene de 4-1 a Bosnia, Canadá de 6-0 a Qatar.",go:"Breel Embolo y Granit Xhaka (Suiza). Jonathan David y Alphonso Davies (Canadá).",fi:"Alphonso Davies (Canadá) — el más explosivo. Si tiene espacio, Suiza no lo para.",ap:"Partido muy parejo · Ambos clasificados · En juego el 1er lugar. Cuota empate: 3.2x",pr:"Pred: Empate 1-1"};
ANAL["Canada_Switzerland"]           = ANAL["Switzerland_Canada"];
ANAL["Bosnia and Herzegovina_Qatar"] = {g:"Bosnia-Herz. y Qatar ambos en el fondo del Grupo B. Bosnia con 1 pt, Qatar con 1 pt. Partido entre eliminados casi seguros.",go:"Edin Džeko (Bosnia) — último chance. Almoez Ali (Qatar) el más peligroso.",fi:"Džeko (Bosnia) — leyenda histórica del equipo. Su último Mundial.",ap:"Bosnia gana · Džeko anota. Cuota est: 2.0x",pr:"Pred: Bosnia 2-1"};
ANAL["Bosnia-Herzegovina_Qatar"] = ANAL["Bosnia and Herzegovina_Qatar"];
ANAL["Bosnia_Qatar"]                 = ANAL["Bosnia and Herzegovina_Qatar"];
ANAL["Qatar_Bosnia and Herzegovina"] = ANAL["Bosnia and Herzegovina_Qatar"];
ANAL["Qatar_Bosnia"]                 = ANAL["Bosnia and Herzegovina_Qatar"];
ANAL["Morocco_Haiti"]                = {g:"Marruecos lidera Grupo C con 4 pts. Haití sin puntos y ya eliminada. Marruecos debe golear para mejorar diferencia de goles.",go:"Hakimi, Ziyech, Saibari (Marruecos). Haití sin nivel para competir.",fi:"Hakim Ziyech (Marruecos) — regresa como titular. Letal en ataque.",ap:"Marruecos gana amplio · Más de 3.5 goles. Cuota est: 1.7x",pr:"Pred: Marruecos 4-0"};
ANAL["Haiti_Morocco"]                = ANAL["Morocco_Haiti"];
ANAL["Scotland_Brazil"]              = {g:"Brasil con 4 pts busca 1er lugar del Grupo C. Escocia con 3 pts también quiere liderar. El partido más atractivo del 24 Jun.",go:"Vinícius Jr y Cunha (Brasil). McGinn y Adams (Escocia).",fi:"Vinícius Jr (Brasil) — el más desequilibrante. Si aparece, Brasil gana.",ap:"Brasil gana · Vinícius Jr anota · Más de 2.5 goles. Cuota est: 1.9x",pr:"Pred: Brasil 2-1"};
ANAL["Brazil_Scotland"]              = ANAL["Scotland_Brazil"];
ANAL["Czechia_Mexico"]               = {g:"Rep. Checa con 1 pt necesita ganar sí o sí. México con 6 pts ya clasificado, puede rotar. Rep. Checa tiene chance si México descansa titulares.",go:"Krejčí y Souček (Rep. Checa). Jiménez si juega por México.",fi:"Tomáš Souček (Rep. Checa) — el motor. Puede liderar la remontada.",ap:"Rep. Checa gana · México rotado. Cuota est: 2.8x",pr:"Pred: Rep. Checa 2-1"};
ANAL["Mexico_Czechia"]               = ANAL["Czechia_Mexico"];
ANAL["South Africa_Korea Republic"]  = {g:"Sudáfrica y Corea del Sur ambos con 1 pt. Partido de vida o muerte. Quien gane se mete en la pelea del 2do lugar.",go:"Oh Hyeon-gyu y Hwang In-beom (Corea). Mokoena (Sudáfrica).",fi:"Hwang In-beom (Corea del Sur) — el mejor de Corea en este Mundial.",ap:"Corea del Sur gana · Hwang anota. Cuota est: 2.2x",pr:"Pred: Corea del Sur 2-0"};
ANAL["Korea Republic_South Africa"]  = ANAL["South Africa_Korea Republic"];
ANAL["Ecuador_Germany"]              = {g:"Ecuador sin puntos, casi eliminado. Alemania con 6 pts ya clasificada y puede rotar. Ecuador necesita ganar y esperar resultados.",go:"Enner Valencia y Caicedo (Ecuador). Musiala y Havertz si juegan (Alemania).",fi:"Moisés Caicedo (Ecuador) — el único que puede cambiar el partido.",ap:"Alemania gana aunque rote · Ecuador pelea por el honor. Cuota est: 2.1x",pr:"Pred: Alemania 2-1"};
ANAL["Germany_Ecuador"]              = ANAL["Ecuador_Germany"];
ANAL["Ivory Coast_Curacao"]          = {g:"Costa de Marfil con 3 pts quiere el 2do lugar. Curazao sin puntos y goleado 1-7 por Alemania. Costa de Marfil debe golear.",go:"Amad Diallo (Costa de Marfil) — el héroe de J1. Seko Fofana también.",fi:"Amad Diallo (Costa de Marfil) — el más talentoso del equipo.",ap:"Costa de Marfil gana amplio · Amad Diallo anota. Cuota est: 1.6x",pr:"Pred: Costa de Marfil 3-0"};
ANAL["Curaçao_Côte d'Ivoire"]        = ANAL["Ivory Coast_Curacao"];
ANAL["Curacao_Ivory Coast"]          = ANAL["Ivory Coast_Curacao"];
ANAL["Côte d'Ivoire_Curaçao"]        = ANAL["Ivory Coast_Curacao"];




// ── J3 HOY 25 Jun ──
ANAL["Ecuador_Germany"]              = {g:"Ecuador sin puntos y eliminada. Alemania con 6 pts ya clasificada puede rotar. Pero Alemania nunca afloja.",go:"Musiala y Havertz (Alemania). Enner Valencia y Caicedo (Ecuador) buscan el honor.",fi:"Jamal Musiala (Alemania) — incluso rotando es el mejor del grupo.",ap:"Alemania gana · Más de 2.5 goles. Cuota est: 1.8x",pr:"Pred: Alemania 3-1"};
ANAL["Germany_Ecuador"]              = ANAL["Ecuador_Germany"];
ANAL["Curaçao_Ivory Coast"]          = {g:"Curazao sin puntos, goleada 1-7 por Alemania. Costa de Marfil con 3 pts quiere asegurar 2do lugar. Costa de Marfil debe golear.",go:"Amad Diallo (Costa de Marfil) — el héroe de J1 al 90min. Seko Fofana también.",fi:"Amad Diallo (Costa de Marfil) — el más talentoso. Puede hacer hat-trick.",ap:"Costa de Marfil gana amplio · Más de 3.5 goles. Cuota est: 1.6x",pr:"Pred: Costa de Marfil 4-0"};
ANAL["Curacao_Ivory Coast"]          = ANAL["Curaçao_Ivory Coast"];
ANAL["Ivory Coast_Curaçao"]          = ANAL["Curaçao_Ivory Coast"];
ANAL["Ivory Coast_Curacao"]          = ANAL["Curaçao_Ivory Coast"];
ANAL["Tunisia_Netherlands"]          = {g:"Países Bajos con 4 pts lidera Grupo F. Túnez con 0 pts y eliminada. Países Bajos debe ganar para mantener el liderato sobre Suecia.",go:"Cody Gakpo y Memphis Depay (Países Bajos) letales. Túnez sin nivel para competir.",fi:"Cody Gakpo (Países Bajos) — en gran forma, peligroso por banda.",ap:"Países Bajos gana · Más de 2.5 goles · Gakpo anota. Cuota est: 1.7x",pr:"Pred: Países Bajos 3-0"};
ANAL["Netherlands_Tunisia"]          = ANAL["Tunisia_Netherlands"];
ANAL["Japan_Sweden"]                 = {g:"Japón con 4 pts vs Suecia con 3 pts. Quien gane lidera o asegura clasificación cómoda. Partido muy parejo.",go:"Daichi Kamada y Minamino (Japón). Viktor Gyökeres (Suecia) — el goleador del torneo.",fi:"Viktor Gyökeres (Suecia) — si aparece puede decidir solo el partido.",ap:"Ambos anotan · Más de 2.5 goles · Gyökeres anota. Cuota est: 2.0x",pr:"Pred: Empate 1-1"};
ANAL["Sweden_Japan"]                 = ANAL["Japan_Sweden"];
ANAL["Turkey_United States"]         = {g:"EE.UU. con 6 pts ya clasificado. Turquía con 0 pts y eliminada. Pero EE.UU. quiere el 1er lugar del Grupo D con pleno de victorias.",go:"Folarin Balogun (EE.UU.) — goleador del torneo. Kerem Aktürkoğlu (Turquía) único peligro.",fi:"Folarin Balogun (EE.UU.) — viene con un doblete en J1. El más letal del grupo.",ap:"EE.UU. gana · Balogun anota · Más de 2.5 goles. Cuota est: 1.8x",pr:"Pred: EE.UU. 3-0"};
ANAL["United States_Turkey"]         = ANAL["Turkey_United States"];
ANAL["USA_Turkey"]                   = ANAL["Turkey_United States"];
ANAL["Paraguay_Australia"]           = {g:"Australia con 3 pts vs Paraguay con 3 pts. Ambos necesitan ganar para asegurar clasificación. El partido más parejo del día.",go:"Martin Ojeda y Alvarado (Paraguay). Nestory Irankunda y Ryan (Australia).",fi:"Irankunda (Australia) — el joven más explosivo. Puede decidir con su velocidad.",ap:"Partido muy parejo · Ambos se juegan la clasificación. Cuota empate: 3.0x",pr:"Pred: Australia 1-0"};
ANAL["Australia_Paraguay"]           = ANAL["Paraguay_Australia"];

// ── J3 RESULTADOS ──
ANAL["Switzerland_Canada"]    = {g:"Suiza venció 2-1 a Canadá y se lleva el 1er lugar del Grupo B. Manzambi abrió, Simons amplió. Promise David descontó al 76min.",go:"Johan Manzambi (Suiza) al 57min fue el goleador decisivo.",fi:"Xavi Simons (Suiza) — el más creativo del partido.",ap:"Partido terminado · Suiza 1era del Grupo B",pr:"✅ Suiza 2-1"};
ANAL["Canada_Switzerland"]    = ANAL["Switzerland_Canada"];
ANAL["Bosnia-Herzegovina_Qatar"] = {g:"Bosnia goleó 3-1 a Qatar y clasificó como uno de los mejores terceros. Mahmic con doblete.",go:"Mahmic (Bosnia) doblete decisivo. Qatar no tuvo nivel.",fi:"Mahmic (Bosnia) — el héroe de la clasificación.",ap:"Partido terminado · Bosnia clasifica",pr:"✅ Bosnia 3-1"};
ANAL["Qatar_Bosnia-Herzegovina"] = ANAL["Bosnia-Herzegovina_Qatar"];
ANAL["Scotland_Brazil"]       = {g:"Brasil goleó 3-0 a Escocia con doblete de Vinícius Jr. Brasil campeón del Grupo C. Neymar entró desde el banco.",go:"Vinícius Jr (Brasil) doblete. Matheus Cunha marcó el 3ro.",fi:"Vinícius Jr (Brasil) — figura indiscutida del Grupo C.",ap:"Partido terminado · Brasil 1ero del Grupo C",pr:"✅ Brasil 3-0"};
ANAL["Brazil_Scotland"]       = ANAL["Scotland_Brazil"];
ANAL["Morocco_Haiti"]         = {g:"Marruecos sufrió pero venció 4-2 a Haití. Hakimi, Saibari, Rahimi y Yassine para los africanos. Haití marcó 2 goles de honor.",go:"Achraf Hakimi (Marruecos) abrió el marcador. Saibari sumó el 2do.",fi:"Achraf Hakimi (Marruecos) — el mejor africano del torneo.",ap:"Partido terminado · Marruecos 2do del Grupo C",pr:"✅ Marruecos 4-2"};
ANAL["Haiti_Morocco"]         = ANAL["Morocco_Haiti"];
ANAL["Czechia_Mexico"]        = {g:"México venció 2-0 a Rep. Checa y lidera el Grupo A con 9 puntos. Mateo Chávez al 55min en su debut, Quiñones al 61min.",go:"Mateo Chávez (México) primer gol en su debut mundialista. Quiñones su 2do del torneo.",fi:"Mateo Chávez (México) — el gol del debut más emotivo del torneo.",ap:"Partido terminado · México 1ero del Grupo A con 9 pts",pr:"✅ México 2-0"};
ANAL["Mexico_Czechia"]        = ANAL["Czechia_Mexico"];
ANAL["South Africa_South Korea"] = {g:"Sudáfrica sorprendió y venció 1-0 a Corea del Sur. Maseko al 63min. Corea queda fuera o debe esperar como mejor tercero.",go:"Thapelo Maseko (Sudáfrica) — el gol que cambió todo al 63min.",fi:"Maseko (Sudáfrica) — figura sorpresa del día.",ap:"Partido terminado · Sudáfrica 2da del Grupo A",pr:"✅ Sudáfrica 1-0"};
ANAL["Korea Republic_South Africa"] = ANAL["South Africa_South Korea"];

// Alias de nombres alternativos (sin sobreescribir resultados)
ANAL["Curaçao_Ivory Coast"]          = {g:"Curazao sin puntos, goleado 1-7 por Alemania. Costa de Marfil con 3 pts quiere asegurar clasificación.",go:"Amad Diallo (Costa de Marfil) — el héroe de J1. Fofana también.",fi:"Amad Diallo (Costa de Marfil) — el más talentoso del equipo.",ap:"Costa de Marfil gana amplio · Amad Diallo anota. Cuota est: 1.6x",pr:"Pred: Costa de Marfil 3-0"};


// Claves exactas 25-27 Jun según log API
ANAL["Tunisia_Netherlands"]          = {g:"Países Bajos con 4 pts lidera Grupo F. Túnez con 0 pts eliminada. Países Bajos debe ganar para mantener liderato.",go:"Cody Gakpo y Memphis Depay (Países Bajos) letales. Túnez sin nivel.",fi:"Cody Gakpo (Países Bajos) — en gran forma, peligroso por banda.",ap:"Países Bajos gana · Más de 2.5 goles · Gakpo anota. Cuota est: 1.7x",pr:"Pred: Países Bajos 3-0"};
ANAL["Netherlands_Tunisia"]          = ANAL["Tunisia_Netherlands"];
ANAL["Japan_Sweden"]                 = {g:"Japón con 4 pts vs Suecia con 3 pts. Quien gane lidera o asegura clasificación. Partido muy parejo y abierto.",go:"Daichi Kamada (Japón). Viktor Gyökeres (Suecia) — el goleador del torneo.",fi:"Viktor Gyökeres (Suecia) — si aparece puede decidir él solo el partido.",ap:"Ambos anotan · Gyökeres anota. Cuota est: 2.0x",pr:"Pred: Empate 1-1"};
ANAL["Sweden_Japan"]                 = ANAL["Japan_Sweden"];
ANAL["Turkey_United States"]         = {g:"EE.UU. con 6 pts clasificado. Turquía con 0 pts eliminada. EE.UU. quiere el 1er lugar con pleno de victorias.",go:"Folarin Balogun (EE.UU.) — goleador del torneo. Çalhanoğlu (Turquía) único peligro.",fi:"Folarin Balogun (EE.UU.) — doblete en J1, el más letal del grupo.",ap:"EE.UU. gana · Balogun anota · Más de 2.5 goles. Cuota est: 1.8x",pr:"Pred: EE.UU. 3-0"};
ANAL["United States_Turkey"]         = ANAL["Turkey_United States"];
ANAL["Paraguay_Australia"]           = {g:"Australia con 3 pts vs Paraguay con 3 pts. Ambos necesitan ganar. El partido más parejo del día. Clasificación en juego.",go:"Irankunda (Australia) veloz y peligroso. Ojeda y Alvarado (Paraguay) buscan el gol.",fi:"Nestory Irankunda (Australia) — el joven más explosivo, puede decidir.",ap:"Partido muy parejo · Ambos se juegan la clasificación. Cuota empate: 3.0x",pr:"Pred: Australia 1-0"};
ANAL["Australia_Paraguay"]           = ANAL["Paraguay_Australia"];
// 26 Jun
ANAL["Norway_France"]                = {g:"Francia con 6 pts lidera Grupo I. Noruega con 6 pts también. El partido más atractivo del torneo hasta ahora. Mbappé vs Haaland.",go:"Kylian Mbappé (Francia) — goleador histórico. Erling Haaland (Noruega) — 4 goles en 2 partidos.",fi:"Erling Haaland (Noruega) — si marca doblete puede ser figura del Mundial.",ap:"Ambos anotan · Más de 3 goles · Partido del año. Cuota empate: 3.0x",pr:"Pred: Francia 2-1"};
ANAL["France_Norway"]                = ANAL["Norway_France"];
ANAL["Senegal_Iraq"]                 = {g:"Francia lidera Grupo I. Senegal con 0 pts y Irak con 0 pts. Partido entre los dos eliminados del grupo.",go:"Sadio Mané (Senegal) — el más peligroso. Mohanad Ali (Iraq) busca el gol del honor.",fi:"Sadio Mané (Senegal) — necesita reivindicarse tras un torneo pobre.",ap:"Senegal gana · Mané anota. Cuota est: 2.0x",pr:"Pred: Senegal 2-0"};
ANAL["Iraq_Senegal"]                 = ANAL["Senegal_Iraq"];
ANAL["Uruguay_Spain"]                = {g:"España con 4 pts busca el 1er lugar del Grupo H. Uruguay con 4 pts también. Partido muy parejo. De Bruyne vs Valverde.",go:"Pedri y Morata (España). Darwin Núñez y Valverde (Uruguay).",fi:"Federico Valverde (Uruguay) — el jugador más completo de su equipo.",ap:"España gana por la mínima · Pedri con asistencia. Cuota est: 2.2x",pr:"Pred: España 1-0"};
ANAL["Spain_Uruguay"]                = ANAL["Uruguay_Spain"];
ANAL["Cape Verde Islands_Saudi Arabia"] = {g:"Arabia Saudita con 1 pt vs Cabo Verde con 1 pt. España lidera el grupo. Partido entre los dos que pelean el 2do lugar.",go:"Al-Dawsari (Arabia Saudita) — el más peligroso. Garry Rodrigues (Cabo Verde).",fi:"Al-Dawsari (Arabia Saudita) — extremo rápido, puede desequilibrar.",ap:"Arabia Saudita gana · Al-Dawsari anota. Cuota est: 2.1x",pr:"Pred: Arabia Saudita 2-1"};
ANAL["Saudi Arabia_Cape Verde Islands"] = ANAL["Cape Verde Islands_Saudi Arabia"];
ANAL["New Zealand_Belgium"]          = {g:"Bélgica con 1 pt vs Nueva Zelanda con 1 pt. Partido parejo entre dos equipos irregulares.",go:"Lukaku y De Bruyne (Bélgica). Chris Wood (Nueva Zelanda).",fi:"Kevin De Bruyne (Bélgica) — si aparece cambia el partido completamente.",ap:"Bélgica gana · De Bruyne con asistencia. Cuota est: 2.0x",pr:"Pred: Bélgica 2-0"};
ANAL["Belgium_New Zealand"]          = ANAL["New Zealand_Belgium"];
ANAL["Egypt_Iran"]                   = {g:"Irán con 1 pt vs Egipto con 1 pt. Ambos buscan el 2do lugar del Grupo G. Partido determinante.",go:"Mohamed Salah si juega (Egipto). Mehdi Taremi (Irán) — el goleador histórico.",fi:"Mohamed Salah (Egipto) — si está al 100% es el mejor del partido.",ap:"Empate o Egipto gana · Salah anota. Cuota est: 2.3x",pr:"Pred: Egipto 1-0"};
ANAL["Iran_Egypt"]                   = ANAL["Egypt_Iran"];
// 27-28 Jun
ANAL["Panama_England"]               = {g:"Inglaterra con 6 pts clasificada. Panamá con 0 pts eliminada. Inglaterra puede rotar pero siempre gana.",go:"Harry Kane (Inglaterra) — doblete en J1. Bellingham también peligroso.",fi:"Jude Bellingham (Inglaterra) — puede ser figura incluso con rotaciones.",ap:"Inglaterra gana · Kane anota. Cuota est: 1.7x",pr:"Pred: Inglaterra 3-0"};
ANAL["England_Panama"]               = ANAL["Panama_England"];
ANAL["Croatia_Ghana"]                = {g:"Croacia con 0 pts vs Ghana con 3 pts. Ghana ya casi clasificada. Croacia necesita ganar sí o sí para seguir viva.",go:"Mohammed Kudus (Ghana) — el más desequilibrante. Modric (Croacia) última chance.",fi:"Luka Modric (Croacia) — 40 años, su último Mundial. Todo o nada.",ap:"Ghana gana · Kudus anota. Cuota est: 2.0x",pr:"Pred: Ghana 1-0"};
ANAL["Ghana_Croatia"]                = ANAL["Croatia_Ghana"];
ANAL["Colombia_Portugal"]            = {g:"Colombia con 3 pts vs Portugal con 1 pt. El partido más atractivo del Grupo K. Luis Díaz vs Cristiano.",go:"Luis Díaz (Colombia) — extremo del Liverpool en estado de gracia. Cristiano (Portugal) necesita despertar.",fi:"Luis Díaz (Colombia) — el más desequilibrante. Si aparece Colombia gana cómodo.",ap:"Colombia gana · Luis Díaz anota. Cuota est: 2.0x",pr:"Pred: Colombia 2-1"};
ANAL["Portugal_Colombia"]            = ANAL["Colombia_Portugal"];
ANAL["Jordan_Argentina"]             = {g:"Argentina con 6 pts ya clasificada. Jordania con 0 pts eliminada. Argentina quiere los 9 pts con Messi.",go:"Lionel Messi (Argentina) — ya con 6 goles en el torneo. Busca el récord.",fi:"Lionel Messi (Argentina) — el mejor jugador de la historia en su última Copa.",ap:"Argentina gana · Messi anota · Más de 3 goles. Cuota est: 1.6x",pr:"Pred: Argentina 3-0"};
ANAL["Argentina_Jordan"]             = ANAL["Jordan_Argentina"];
ANAL["Algeria_Austria"]              = {g:"Austria con 3 pts vs Argelia con 0 pts. Argentina lidera. Austria quiere asegurar clasificación.",go:"Marko Arnautovic (Austria) — de penal es muy peligroso. Belaïli (Argelia).",fi:"Marko Arnautovic (Austria) — el delantero referente del equipo.",ap:"Austria gana · Arnautovic anota. Cuota est: 1.9x",pr:"Pred: Austria 2-0"};
ANAL["Austria_Algeria"]              = ANAL["Algeria_Austria"];
ANAL["Uzbekistan_DR Congo"]          = {g:"RD Congo con 1 pt vs Uzbekistán con 0 pts. Colombia lidera. Partido entre los dos de abajo del Grupo K.",go:"Yoane Wissa (RD Congo) — ya demostró nivel vs Portugal. Shomurodov (Uzbekistán).",fi:"Yoane Wissa (RD Congo) — el héroe de J1 contra Portugal.",ap:"RD Congo gana · Wissa anota. Cuota est: 2.1x",pr:"Pred: RD Congo 2-0"};
ANAL["DR Congo_Uzbekistan"]          = ANAL["Uzbekistan_DR Congo"];

// ── FASE ELIMINATORIA (Round of 32) ──
ANAL["South Africa_Canada"]  = {g:"Sudáfrica llega como la gran sorpresa del Grupo A (2da), venció a Corea del Sur 1-0 en J3. Canadá clasificó 2da del Grupo B tras perder 1-2 con Suiza. Primer eliminatorio de la historia para ambas selecciones en WC 2026.",go:"Alphonso Davies (Canadá) — el más explosivo del torneo. Jonathan David busca el gol. Thapelo Maseko (Sudáfrica) — el héroe de J3.",fi:"Alphonso Davies (Canadá) — el más peligroso. Si tiene espacio, nadie lo para.",ap:"Canadá favorita · Davies anota · Más de 1.5 goles. Cuota Canadá: 2.0x",pr:"Pred: Canadá 2-1"};
ANAL["Canada_South Africa"]  = ANAL["South Africa_Canada"];

// 29 Jun
ANAL["Brazil_Japan"]         = {g:"Brasil arrasó en el Grupo C con 9 pts y 8 goles a favor. Japón fue sorprendente, clasificó con 6 pts venciendo a Túnez y empatando vs Países Bajos. El choque más atractivo del día.",go:"Vinícius Jr (Brasil) — 3 goles en la fase de grupos, imparable. Daichi Kamada (Japón) — el motor del mediocampo.",fi:"Vinícius Jr (Brasil) — si está en el día, el partido se acaba en el primer tiempo.",ap:"Brasil gana · Vinícius Jr anota · Más de 2.5 goles. Cuota Brasil: 1.7x",pr:"Pred: Brasil 3-1"};
ANAL["Japan_Brazil"]         = ANAL["Brazil_Japan"];
ANAL["Germany_Paraguay"]     = {g:"Alemania dominó el Grupo E con 9 pts (7-1 a Curazao, 2-1 a Costa de Marfil, 2-1 a Ecuador). Paraguay clasificó como mejor tercero con batallas épicas. Alemania es amplio favorita.",go:"Jamal Musiala (Alemania) — el jugador del torneo hasta ahora. Havertz peligroso. Adalberto Pereira (Paraguay) — el único que puede generar peligro.",fi:"Jamal Musiala (Alemania) — el más creativo e imparable. Figura del torneo.",ap:"Alemania gana · Musiala da asistencia · Havertz anota. Cuota Alemania: 1.5x",pr:"Pred: Alemania 3-0"};
ANAL["Paraguay_Germany"]     = ANAL["Germany_Paraguay"];
ANAL["Netherlands_Morocco"]  = {g:"Países Bajos goleó 5-1 a Suecia en J2 y lidera el Grupo F. Marruecos fue 2do del Grupo C (detrás de Brasil). Duelo muy competitivo — Marruecos siempre difícil de vencer.",go:"Cody Gakpo (Países Bajos) — extremo en gran nivel. Xavi Simons con doblete en J2. Achraf Hakimi (Marruecos) — el mejor africano del torneo.",fi:"Achraf Hakimi (Marruecos) — si aparece por la banda, Países Bajos tiene problemas.",ap:"Países Bajos favorita · Gakpo anota. Cuota PB: 2.0x",pr:"Pred: Países Bajos 2-1"};
ANAL["Morocco_Netherlands"]  = ANAL["Netherlands_Morocco"];

// 30 Jun
ANAL["Ivory Coast_Norway"]   = {g:"Costa de Marfil clasificó del Grupo E con 4 pts. Noruega lideró el Grupo I con 9 pts — Haaland anotó 4 veces y fue dominante. Noruega parte como gran favorita con el mejor delantero del torneo.",go:"Erling Haaland (Noruega) — 4 goles, el máximo goleador del torneo. Amad Diallo (Costa de Marfil) — la única amenaza real.",fi:"Erling Haaland (Noruega) — si recibe bien la pelota, anota. Es inevitable.",ap:"Noruega gana · Haaland anota · Más de 2 goles. Cuota Noruega: 1.6x",pr:"Pred: Noruega 3-1"};
ANAL["Norway_Ivory Coast"]   = ANAL["Ivory Coast_Norway"];
ANAL["Côte d'Ivoire_Norway"] = ANAL["Ivory Coast_Norway"];
ANAL["Norway_Côte d'Ivoire"] = ANAL["Ivory Coast_Norway"];
ANAL["France_Sweden"]        = {g:"Francia ganó el Grupo I (9 pts, Mbappé 4 goles). Suecia clasificó 2da del Grupo F con 6 pts — Gyökeres fue letal. El duelo de goleadores: Mbappé vs Gyökeres.",go:"Kylian Mbappé (Francia) — 4 goles, el más peligroso de Europa. Viktor Gyökeres (Suecia) — 3 goles, el rival más duro de afrontar.",fi:"Kylian Mbappé (Francia) — si está sano y en ritmo, es el mejor jugador del torneo.",ap:"Francia favorita · Mbappé anota · Partido con goles. Cuota Francia: 1.8x",pr:"Pred: Francia 2-1"};
ANAL["Sweden_France"]        = ANAL["France_Sweden"];
ANAL["Mexico_Ecuador"]       = {g:"México fue primero del Grupo A con 9 pts perfectos. Ecuador clasificó del Grupo E como mejor tercero. México llega en su mejor nivel en décadas, Ecuador en riesgo desde el inicio.",go:"Alexis Vega y Quiñones (México) — dupla de ataque. Rodrigo Bentancur... error, Moisés Caicedo (Ecuador) el único que puede sacudir.",fi:"Alexis Vega (México) — el más desequilibrante del equipo. Peligroso por velocidad.",ap:"México gana · Quiñones anota · Sin empate. Cuota México: 1.8x",pr:"Pred: México 2-0"};
ANAL["Ecuador_Mexico"]       = ANAL["Mexico_Ecuador"];

// 1 Jul
ANAL["England_DR Congo"]     = {g:"Inglaterra fue primera del Grupo J con 9 pts. Kane doblete en J1, Bellingham decisivo. RD Congo llegó 2da de su grupo (empató con Portugal en J1 con gol de Wissa). Partido sin sorpresas esperadas.",go:"Harry Kane (Inglaterra) — el delantero más letal de Europa. Yoane Wissa (RD Congo) — el único con nivel para marcar.",fi:"Jude Bellingham (Inglaterra) — el jugador más completo. Si aparece, Inglaterra arrasa.",ap:"Inglaterra gana · Kane anota · Más de 2.5 goles. Cuota Inglaterra: 1.5x",pr:"Pred: Inglaterra 3-0"};
ANAL["DR Congo_England"]     = ANAL["England_DR Congo"];
ANAL["England_Congo DR"]     = ANAL["England_DR Congo"];
ANAL["Congo DR_England"]     = ANAL["England_DR Congo"];
ANAL["Argentina_Bosnia-Herzegovina"] = {g:"Argentina fue primera del Grupo L con 9 pts — Messi hat-trick en J1, 6 goles en la fase de grupos. Bosnia clasificó 2da. El partido más desequilibrado del día en papel.",go:"Lionel Messi (Argentina) — 6 goles, máximo goleador del torneo. Edin Džeko (Bosnia) — su último Mundial.",fi:"Lionel Messi (Argentina) — si anota el 7mo gol, iguala a Ronaldo como goleador histórico de Mundiales.",ap:"Argentina gana amplio · Messi anota · Más de 3 goles. Cuota Argentina: 1.4x",pr:"Pred: Argentina 4-0"};
ANAL["Bosnia-Herzegovina_Argentina"] = ANAL["Argentina_Bosnia-Herzegovina"];
ANAL["Spain_Korea Republic"] = {g:"España se recuperó tras el 0-0 vs Cabo Verde, ganó J2 y J3 para liderar el Grupo H. Corea del Sur clasificó como mejor tercero del Grupo A. España favorita con Pedri y Morata en forma.",go:"Pedri (España) — el creativo del equipo, en su mejor versión. Hwang In-beom (Corea) — el motor coreano.",fi:"Pedri (España) — si está libre, España controla el partido con facilidad.",ap:"España gana · Pedri con asistencia · Morata anota. Cuota España: 1.7x",pr:"Pred: España 2-0"};
ANAL["Korea Republic_Spain"] = ANAL["Spain_Korea Republic"];
ANAL["USA_Australia"]        = {g:"EE.UU. fue primero del Grupo G con 9 pts — Balogun con doblete en J1 es el goleador revelación. Australia clasificó 2da del Grupo H. Partido de alta intensidad en terreno favorito para EE.UU.",go:"Folarin Balogun (EE.UU.) — el goleador sorpresa del torneo. Nestory Irankunda (Australia) — el joven más explosivo.",fi:"Folarin Balogun (EE.UU.) — si sigue el ritmo, puede ser el goleador del torneo.",ap:"EE.UU. gana · Balogun anota · Más de 2 goles. Cuota EE.UU.: 1.8x",pr:"Pred: EE.UU. 3-1"};
ANAL["Australia_USA"]        = ANAL["USA_Australia"];
ANAL["Australia_United States"] = ANAL["USA_Australia"];
ANAL["United States_Australia"] = ANAL["USA_Australia"];
ANAL["Portugal_Colombia"]    = {g:"Portugal fue 2da del Grupo K (1-1 vs RD Congo). Colombia lideró el Grupo K con 7 pts. El partido más apasionante del Round of 32 — Luis Díaz vs Cristiano.",go:"Cristiano Ronaldo (Portugal) — necesita despertar, sin goles en la fase de grupos. Luis Díaz (Colombia) — el mejor latinoamericano del torneo.",fi:"Luis Díaz (Colombia) — extremo del Liverpool en estado de gracia. Si aparece, Colombia gana.",ap:"Colombia favorita leve · Luis Díaz anota. Cuota Colombia: 2.2x",pr:"Pred: Colombia 2-1"};
ANAL["Colombia_Portugal"]    = ANAL["Portugal_Colombia"];
ANAL["Switzerland_Morocco"]  = {g:"Suiza lideró el Grupo B con 7 pts (4-1 a Bosnia, 2-1 a Canadá). Marruecos fue 2do del Grupo C con 4 pts. Partido competitivo — Marruecos demostró ser la mejor selección africana.",go:"Breel Embolo (Suiza) — el delantero referente. Achraf Hakimi (Marruecos) — banda derecha imparable.",fi:"Granit Xhaka (Suiza) — el motor del mediocampo. Si controla el partido, Suiza gana.",ap:"Suiza favorita por juego · Empate posible · Embolo anota. Cuota Suiza: 2.1x",pr:"Pred: Suiza 1-0"};
ANAL["Morocco_Switzerland"]  = ANAL["Switzerland_Morocco"];

// 1 Jul
ANAL["Belgium_Senegal"]      = {g:"Bélgica clasificó del Grupo G con 7 pts tras remontar una campaña irregular. Senegal terminó con 3 pts en el Grupo I — perdió 1-3 con Francia y Noruega, pero ganó a Iraq para clasificar como mejor tercero. Bélgica es favorita, pero Mané y el bloque africano pueden complicar.",go:"Romelu Lukaku (Bélgica) — si está en forma, es el delantero más letal del equipo. Kevin De Bruyne como creativo. Sadio Mané (Senegal) — el líder y la única gran estrella africana del partido.",fi:"Kevin De Bruyne (Bélgica) — si aparece con su mejor versión, Bélgica controla el partido y gana cómodo.",ap:"Bélgica gana · De Bruyne con asistencia · Lukaku anota. Cuota Bélgica: 1.8x",pr:"Pred: Bélgica 2-0"};
ANAL["Senegal_Belgium"]      = ANAL["Belgium_Senegal"];
ANAL["USA_Bosnia and Herzegovina"] = {g:"EE.UU. fue primero del Grupo G con 9 pts perfectos — Balogun doblete en J1 fue sensación del torneo. Bosnia clasificó como mejor tercero del Grupo B, con la épica victoria 3-1 sobre Qatar. En casa, EE.UU. es intocable.",go:"Folarin Balogun (EE.UU.) — el goleador revelación del torneo. Christian Pulisic también peligroso. Edin Džeko (Bosnia) — leyenda, su último Mundial.",fi:"Folarin Balogun (EE.UU.) — si mantiene el ritmo de J1, puede ser el goleador del torneo. En casa es imparable.",ap:"EE.UU. gana · Balogun anota · Más de 2 goles. Cuota EE.UU.: 1.6x",pr:"Pred: EE.UU. 3-0"};
ANAL["Bosnia and Herzegovina_USA"] = ANAL["USA_Bosnia and Herzegovina"];
ANAL["Bosnia-Herzegovina_USA"] = ANAL["USA_Bosnia and Herzegovina"];
ANAL["USA_Bosnia"]           = ANAL["USA_Bosnia and Herzegovina"];
ANAL["Bosnia_USA"]           = ANAL["USA_Bosnia and Herzegovina"];

// 2 Jul
ANAL["Spain_Austria"]        = {g:"España lideró el Grupo H con 7 pts tras remontar el decepcionante 0-0 inicial vs Cabo Verde. Austria fue 2da del Grupo J con 7 pts — 3-1 a Jordania en J1 y muy sólida. El partido más parejo de la jornada del 2 de julio.",go:"Pedri (España) — el creativo que España necesita. Morata como referente. Marko Arnautovic (Austria) — letal de penal y en juego aéreo.",fi:"Pedri (España) — si está libre de presión, España controla el partido. La clave es él.",ap:"España favorita · Pedri con asistencia · Partido con 2+ goles. Cuota España: 1.9x",pr:"Pred: España 2-1"};
ANAL["Austria_Spain"]        = ANAL["Spain_Austria"];
ANAL["Portugal_Croatia"]     = {g:"Portugal fue 2do del Grupo K (1-1 vs RD Congo en J1, sufrido paso de grupos). Croacia se recuperó en J2 y J3 para clasificar del Grupo J. El duelo europeo más equilibrado del Round of 32. Modric contra Cristiano en posiblemente su último Mundial.",go:"Cristiano Ronaldo (Portugal) — necesita despertar, sin goles en la fase de grupos. Luka Modric (Croacia) — el veterano más elegante del torneo. Bruno Fernandes (Portugal) el más dinámico.",fi:"Bruno Fernandes (Portugal) — si controla el mediocampo, Portugal gana. Más determinante que Cristiano.",ap:"Partido muy parejo · Ambos anotan · Menos de 3 goles. Cuota Portugal: 2.1x",pr:"Pred: Portugal 1-0"};
ANAL["Croatia_Portugal"]     = ANAL["Portugal_Croatia"];
ANAL["Switzerland_Algeria"]  = {g:"Suiza lideró el Grupo B con 7 pts — 4-1 Bosnia, 2-1 Canadá. Argelia clasificó del Grupo J como mejor tercero tras 9 pts perfectos en grupo facilitado. Suiza es favorita pero Argelia llegó invicta.",go:"Breel Embolo (Suiza) — el delantero referente en zona de peligro. Granit Xhaka motor del mediocampo. Islam Slimani o Belaïli (Argelia) como referente ofensivo.",fi:"Granit Xhaka (Suiza) — el motor que hace funcionar todo. Si está bien, Suiza gana.",ap:"Suiza gana · Embolo anota · Sin empate. Cuota Suiza: 1.7x",pr:"Pred: Suiza 2-0"};
ANAL["Algeria_Switzerland"]  = ANAL["Switzerland_Algeria"];

// 3 Jul
ANAL["Australia_Egypt"]      = {g:"Australia fue 2da del Grupo D con 7 pts — venció a Turquía 2-0 en J1 y clasificó temprano. Egipto llegó al Round of 32 desde el Grupo G con 4 pts. Australia tiene más jerarquía y clasifica por primera vez a 8vos.",go:"Nestory Irankunda (Australia) — el joven más explosivo del torneo. Mathew Ryan (arq) fue clave. Omar Marmoush (Egipto) — delantero de Premier League, el único con nivel para marcar.",fi:"Nestory Irankunda (Australia) — si tiene espacio, nadie lo para. Puede decidir el partido.",ap:"Australia gana · Irankunda anota. Cuota Australia: 1.9x",pr:"Pred: Australia 2-0"};
ANAL["Egypt_Australia"]      = ANAL["Australia_Egypt"];
ANAL["Argentina_Cape Verde"] = {g:"Argentina fue primera del Grupo L con 9 pts — Messi hat-trick en J1 (iguala a Klose), 6 goles en 3 partidos. Cabo Verde sorprendió al llegar al Round of 32 clasificando del Grupo H con 5 pts. El partido más desigual de la fase eliminatoria.",go:"Lionel Messi (Argentina) — 6 goles, máximo goleador del torneo. Si anota hoy supera el récord de Klose (16). Lautaro Martínez también letal. Garry Rodrigues (Cabo Verde) — el único peligro.",fi:"Lionel Messi (Argentina) — el mejor jugador de la historia en su último Mundial. Este es su partido histórico.",ap:"Argentina gana amplio · Messi marca el récord · Más de 3 goles. Cuota Argentina: 1.3x",pr:"Pred: Argentina 4-0"};
ANAL["Argentina_Cabo Verde"] = ANAL["Argentina_Cape Verde"];
ANAL["Cape Verde_Argentina"] = ANAL["Argentina_Cape Verde"];
ANAL["Cabo Verde_Argentina"] = ANAL["Argentina_Cape Verde"];
ANAL["Colombia_Ghana"]       = {g:"Colombia lideró el Grupo K con 7 pts — Luis Díaz letal, James Rodríguez creativo. Ghana fue 1ero del Grupo J con 7 pts — Mohammed Kudus fue la revelación africana. El partido más parejo del 3 de julio.",go:"Luis Díaz (Colombia) — extremo del Liverpool en estado de gracia. James Rodríguez el creador. Mohammed Kudus (Ghana) — el más desequilibrante de África en este torneo.",fi:"Luis Díaz (Colombia) — si aparece, Colombia gana cómodo. La diferencia individual más clara.",ap:"Colombia favorita leve · Luis Díaz anota · Partido abierto. Cuota Colombia: 2.0x",pr:"Pred: Colombia 2-1"};
ANAL["Ghana_Colombia"]       = ANAL["Colombia_Ghana"];

function getAnal(home, away) {
  if (!home || !away) return null;
  // Normalizar apostrofes y caracteres especiales
  function norm(s) {
    return s.replace(/’/g,"'").replace(/‘/g,"'").replace(/é/g,"e")
            .replace(/ô/g,"o").replace(/è/g,"e").replace(/ü/g,"u")
            .replace(/ä/g,"a").replace(/ö/g,"o").replace(/é/g,"e");
  }
  var h = norm(home); var a = norm(away);
  // Buscar exacto (con y sin normalizar)
  var combos = [[home,away],[away,home],[h,a],[a,h]];
  for (var ci=0; ci<combos.length; ci++) {
    var k = combos[ci][0]+"_"+combos[ci][1];
    if (ANAL[k]) return ANAL[k];
  }
  // Buscar con fixes de nombres
  var fixes = {
    "IR Iran":"Iran","Curaçao":"Curacao","Côte d'Ivoire":"Ivory Coast",
    "Bosnia and Herzegovina":"Bosnia","Cape Verde Islands":"Cabo Verde",
    "Cape Verde":"Cabo Verde","South Korea":"Korea Republic","United States":"USA",
    "Cote d'Ivoire":"Ivory Coast","Côte d\'Ivoire":"Ivory Coast"
  };
  var h2 = fixes[home] || fixes[h] || home;
  var a2 = fixes[away] || fixes[a] || away;
  var combos2 = [[h2,a2],[a2,h2],[home,a2],[a2,home],[h2,away],[away,h2]];
  for (var ci=0; ci<combos2.length; ci++) {
    var k = combos2[ci][0]+"_"+combos2[ci][1];
    if (ANAL[k]) return ANAL[k];
  }
  // Búsqueda flexible por palabras clave
  var keys = Object.keys(ANAL);
  // Primera palabra
  for (var i = 0; i < keys.length; i++) {
    var parts = keys[i].split("_");
    if (parts.length < 2) continue;
    var a1p = parts[0].split(" ")[0].toLowerCase();
    var a2p = parts[1].split(" ")[0].toLowerCase();
    var hp = home.split(" ")[0].toLowerCase();
    var ap = away.split(" ")[0].toLowerCase();
    if ((hp === a1p && ap === a2p) || (hp === a2p && ap === a1p)) return ANAL[keys[i]];
  }
  // Contiene
  for (var i = 0; i < keys.length; i++) {
    var parts = keys[i].split("_");
    if (parts.length < 2) continue;
    var k_h = parts[0].toLowerCase();
    var k_a = parts[1].toLowerCase();
    var s_h = home.toLowerCase();
    var s_a = away.toLowerCase();
    var hInK = k_h.indexOf(s_h) >= 0 || s_h.indexOf(k_h) >= 0;
    var aInK = k_a.indexOf(s_a) >= 0 || s_a.indexOf(k_a) >= 0;
    if (hInK && aInK) return ANAL[keys[i]];
    var hInK2 = k_a.indexOf(s_h) >= 0 || s_h.indexOf(k_a) >= 0;
    var aInK2 = k_h.indexOf(s_a) >= 0 || s_a.indexOf(k_h) >= 0;
    if (hInK2 && aInK2) return ANAL[keys[i]];
  }
  return null;
}

var cardId = 0;
function makeCard(m) {
  cardId++;
  var cid = "cd" + cardId;
  var home = m.homeTeam || {};
  var away = m.awayTeam || {};
  var hName = home.name || "";
  var aName = away.name || "";
  var hN = n(hName);
  var aN = n(aName);
  var hF = f(hName);
  var aF = f(aName);
  var done = m.status === "FINISHED";
  var live = m.status === "IN_PLAY" || m.status === "PAUSED";
  var grp = m.group ? m.group.replace("GROUP_","Grupo ") : "";
  var sLabel = done ? "✅ Final" : live ? "🔴 EN VIVO" : "⏰ Próximo";
  var sColor = done ? "#4ade80" : live ? "#f87171" : "#60a5fa";
  var hora = clHour(m.utcDate);
  var fecha = clDateShort(m.utcDate);
  var venue = m.venue || "";
  var anal = getAnal(hName, aName);

  // Score
  var hG = m.score && m.score.fullTime ? m.score.fullTime.home : null;
  var aG = m.score && m.score.fullTime ? m.score.fullTime.away : null;
  if (hG === null && m.score && m.score.regularTime) { hG = m.score.regularTime.home; aG = m.score.regularTime.away; }
  if (hG === null && done && m.score) {
    if (m.score.winner === "HOME_TEAM") { hG = 1; aG = 0; }
    else if (m.score.winner === "AWAY_TEAM") { hG = 0; aG = 1; }
    else if (m.score.winner === "DRAW") { hG = 0; aG = 0; }
  }
  var penH = m.score && m.score.penalties ? m.score.penalties.home : null;
  var penA = m.score && m.score.penalties ? m.score.penalties.away : null;
  var hasPen = penH !== null && penA !== null;
  var scoreHTML = "";
  if (done || live) {
    if (hG !== null && aG !== null) {
      var cls = sc(hG, aG);
      var penTag = hasPen ? '<div style="font-size:9px;color:#fbbf24;font-weight:800;margin-top:1px;">Pen: ' + penH + ' \u2013 ' + penA + '</div>' : '';
      scoreHTML = '<div style="text-align:center;"><span class="score ' + cls + '">' + hG + " \u2013 " + aG + "</span>" + penTag + "</div>";
    } else {
      scoreHTML = '<span style="font-size:11px;color:#4ade80;font-weight:700;">Final</span>';
    }
  } else {
    scoreHTML = '<span style="font-size:12px;color:#4ade80;font-weight:700;">' + hora + "</span>";
  }

  // ── HT / FT scores ──
  var htH = m.score && m.score.halfTime ? m.score.halfTime.home : null;
  var htA = m.score && m.score.halfTime ? m.score.halfTime.away : null;

  // ── Datos de API-Football (cache) ──
  var afCache   = statsCache[String(m.id)] || {};
  var afEvents  = afCache.events  || [];
  var afStats   = afCache.stats   || [];

  // Goles y tarjetas desde eventos
  var goalItemsL = [], goalItemsA = [];
  var cardItems  = [];
  afEvents.forEach(function(ev) {
    var elapsed = ev.time && ev.time.elapsed != null ? ev.time.elapsed : "";
    var extra   = ev.time && ev.time.extra ? "+" + ev.time.extra : "";
    var minStr  = elapsed + extra + "'";
    var isHome  = ev.team && ev.team.name && hName &&
                  ev.team.name.toLowerCase() === hName.toLowerCase();
    var pName   = ev.player && ev.player.name ? ev.player.name : "?";

    if (ev.type === "Goal") {
      var typeTag = ev.detail === "Own Goal" ? " <span style='color:#f87171;font-size:9px;'>(AG)</span>"
                 : ev.detail === "Penalty"   ? " <span style='color:#fbbf24;font-size:9px;'>(P)</span>" : "";
      var row = '<div style="display:flex;align-items:center;gap:5px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);">'
        + '<span style="color:#fbbf24;font-weight:700;font-size:10px;min-width:28px;">' + minStr + '</span>'
        + '<span style="font-size:11px;">⚽</span>'
        + '<span style="font-size:11px;color:#e2e8f0;">' + pName + '</span>' + typeTag
        + '</div>';
      if (isHome) goalItemsL.push(row); else goalItemsA.push(row);
    } else if (ev.type === "Card") {
      var isRed = ev.detail === "Red Card" || ev.detail === "Red Card (Second Yellow)";
      var em = isRed ? "🟥" : "🟨";
      var teamLabel = isHome ? hN : aN;
      cardItems.push('<div style="display:flex;align-items:center;gap:5px;padding:2px 0;">'
        + '<span>' + em + '</span>'
        + '<span style="font-size:10px;color:#94a3b8;min-width:26px;">' + minStr + '</span>'
        + '<span style="font-size:11px;color:#e2e8f0;">' + pName + '</span>'
        + '<span style="font-size:9px;color:#64748b;margin-left:2px;">(' + teamLabel + ')</span>'
        + '</div>');
    }
  });

  // Estadísticas
  var hStMap = {}, aStMap = {};
  if (afStats.length >= 2) {
    (afStats[0].statistics || []).forEach(function(s){ hStMap[s.type] = s.value; });
    (afStats[1].statistics || []).forEach(function(s){ aStMap[s.type] = s.value; });
  }
  var ST_DEFS = [
    {k:"Total Shots",       lb:"Remates"},
    {k:"Shots on Goal",     lb:"Remates al arco"},
    {k:"Ball Possession",   lb:"Posesión",       pct:true},
    {k:"Total passes",      lb:"Pases"},
    {k:"Passes %",          lb:"Precisión pases", pct:true},
    {k:"Fouls",             lb:"Faltas",          inv:true},
    {k:"Yellow Cards",      lb:"Tarjetas Amarillas", inv:true},
    {k:"Red Cards",         lb:"Tarjetas Rojas",  inv:true},
    {k:"Offsides",          lb:"Fuera de juego",  inv:true},
    {k:"Corner Kicks",      lb:"Córners"}
  ];
  var hasStatsData = ST_DEFS.some(function(d){ return hStMap[d.k] != null || aStMap[d.k] != null; });

  function secBox(color, title, inner) {
    return '<div style="margin-bottom:7px;background:rgba(0,0,0,0.18);border-radius:8px;overflow:hidden;">'
      + '<div style="padding:4px 9px;background:rgba(0,0,0,0.25);font-size:9px;font-weight:800;color:' + color + ';text-transform:uppercase;letter-spacing:0.5px;">' + title + '</div>'
      + '<div style="padding:6px 9px;">' + inner + '</div>'
      + '</div>';
  }

  var statsHTML = "";
  var hasEvents = goalItemsL.length || goalItemsA.length || cardItems.length;

  if (done) {
    var marcHTML = "";
    if (htH !== null && htA !== null && hG !== null) {
      var marcInner = '<div style="display:flex;align-items:center;justify-content:center;gap:20px;">'
        + '<div style="text-align:center;"><div style="font-size:9px;color:#64748b;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.5px;">1er Tiempo</div>'
        + '<div style="font-size:20px;font-weight:900;color:#60a5fa;">' + htH + ' – ' + htA + '</div></div>'
        + '<div style="width:1px;height:30px;background:rgba(255,255,255,0.1);"></div>'
        + '<div style="text-align:center;"><div style="font-size:9px;color:#64748b;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.5px;">' + (hasPen ? '90 min' : 'Final') + '</div>'
        + '<div style="font-size:20px;font-weight:900;color:#4ade80;">' + hG + ' – ' + aG + '</div></div>'
        + (hasPen ? '<div style="width:1px;height:30px;background:rgba(255,255,255,0.1);"></div>'
          + '<div style="text-align:center;"><div style="font-size:9px;color:#fbbf24;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.5px;font-weight:700;">Penales</div>'
          + '<div style="font-size:20px;font-weight:900;color:#fbbf24;">' + penH + ' – ' + penA + '</div></div>' : '')
        + '</div>';
      marcHTML = secBox("#60a5fa", "📊 Marcador", marcInner);
    }
    var golesHTML = "";
    if (hasEvents) {
      var gRowsHTML = '<div style="display:flex;gap:4px;">'
        + '<div style="flex:1;border-right:1px solid rgba(255,255,255,0.06);padding-right:6px;">'
        + '<div style="font-size:9px;color:#94a3b8;font-weight:700;margin-bottom:3px;">' + hF + ' ' + hN + '</div>'
        + (goalItemsL.length ? goalItemsL.join("") : '<div style="font-size:10px;color:#475569;padding:2px 0;">–</div>')
        + '</div><div style="flex:1;padding-left:6px;">'
        + '<div style="font-size:9px;color:#94a3b8;font-weight:700;margin-bottom:3px;">' + aF + ' ' + aN + '</div>'
        + (goalItemsA.length ? goalItemsA.join("") : '<div style="font-size:10px;color:#475569;padding:2px 0;">–</div>')
        + '</div></div>';
      golesHTML = secBox("#4ade80", "⚽ Goles", gRowsHTML);
    } else if (anal && anal.go) {
      golesHTML = secBox("#fbbf24", "⚽ Goleadores", '<span style="font-size:11px;color:#cbd5e1;line-height:1.7;">' + anal.go + '</span>');
    }
    var tarjHTML = cardItems.length ? secBox("#fbbf24", "🟨 Tarjetas", cardItems.join("")) : "";
    var statTableHTML = "";
    if (hasStatsData) {
      var PILL = "background:#c026d3;color:#fff;padding:1px 9px;border-radius:20px;font-weight:800;font-size:12px;display:inline-block;min-width:28px;text-align:center;";
      var PLAIN = "font-size:12px;color:#cbd5e1;padding:1px 9px;display:inline-block;min-width:28px;text-align:center;";
      var stHeader = '<div style="display:flex;gap:6px;padding-bottom:5px;margin-bottom:4px;border-bottom:1px solid rgba(255,255,255,0.08);">'
        + '<div style="flex:1;text-align:right;font-size:10px;font-weight:700;color:#e2e8f0;">' + hF + ' ' + hN + '</div>'
        + '<div style="flex:2;"></div>'
        + '<div style="flex:1;text-align:left;font-size:10px;font-weight:700;color:#e2e8f0;">' + aF + ' ' + aN + '</div></div>';
      var stRows = ST_DEFS.filter(function(d){ return hStMap[d.k] != null || aStMap[d.k] != null; }).map(function(d) {
        var hRaw = hStMap[d.k] != null ? hStMap[d.k] : 0;
        var aRaw = aStMap[d.k] != null ? aStMap[d.k] : 0;
        var hv = parseFloat(String(hRaw).replace("%","")) || 0;
        var av = parseFloat(String(aRaw).replace("%","")) || 0;
        var hvStr = d.pct ? hv + "%" : String(hRaw || 0);
        var avStr = d.pct ? av + "%" : String(aRaw || 0);
        var hBetter = d.inv ? hv < av : hv > av;
        var aBetter = d.inv ? av < hv : av > hv;
        var total = hv + av;
        var hPct = total > 0 ? Math.round(hv / total * 100) : 50;
        return '<div style="padding:3px 0;">'
          + '<div style="display:flex;align-items:center;gap:6px;">'
          + '<div style="flex:1;text-align:right;"><span style="' + (hBetter ? PILL : PLAIN) + '">' + hvStr + '</span></div>'
          + '<div style="flex:2;text-align:center;font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.3px;">' + d.lb + '</div>'
          + '<div style="flex:1;text-align:left;"><span style="' + (aBetter ? PILL : PLAIN) + '">' + avStr + '</span></div></div>'
          + '<div style="height:3px;background:rgba(255,255,255,0.06);border-radius:2px;margin:3px 0;">'
          + '<div style="height:3px;width:' + hPct + '%;background:#7c3aed;border-radius:2px;"></div></div></div>';
      }).join('<div style="height:1px;background:rgba(255,255,255,0.04);"></div>');
      statTableHTML = secBox("#c084fc", "📈 Estadísticas", stHeader + stRows);
    }
    statsHTML = marcHTML + golesHTML + tarjHTML + statTableHTML;
  }

  var betLink = '<a style="display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#1a6b1a,#0f4a0f);border:2px solid #4ade80;border-radius:10px;padding:10px;color:#fff;font-weight:800;font-size:13px;text-decoration:none;margin-top:6px;" href="https://www.jugabet.cl" target="_blank">🎰 Apostar en Jugabet Chile</a>';
  var analHTML = "";
  if (anal) {
    if (done) {
      analHTML = '<div style="display:flex;flex-direction:column;gap:5px;margin-top:4px;">'
        + (anal.pr ? '<div style="background:linear-gradient(135deg,#1a3a1a,#0a1f0a);border:1px solid #4ade80;border-radius:8px;padding:6px 12px;text-align:center;font-size:13px;font-weight:800;color:#4ade80;">' + anal.pr + "</div>" : "")
        + secBox("#4ade80","🎬 Resumen del partido",'<span style="font-size:11px;color:#cbd5e1;line-height:1.6;">' + anal.g + '</span>')
        + secBox("#60a5fa","⭐ Figura del partido",'<span style="font-size:11px;color:#cbd5e1;line-height:1.6;">' + anal.fi + '</span>')
        + betLink + "</div>";
    } else {
      var predHTML = anal.pr ? '<div style="background:linear-gradient(135deg,#1a3a1a,#0a1f0a);border:1px solid #4ade80;border-radius:8px;padding:6px 12px;margin-bottom:6px;text-align:center;font-size:13px;font-weight:800;color:#4ade80;">' + anal.pr + "</div>" : "";
      analHTML = '<div style="display:flex;flex-direction:column;gap:5px;margin-top:8px;">'
        + predHTML
        + '<div style="border-left:3px solid #4ade80;border-radius:7px;padding:7px 10px;background:rgba(0,0,0,.25);"><div style="font-size:10px;color:#4ade80;font-weight:700;margin-bottom:2px;">🏆 Análisis</div><div style="font-size:11px;color:#cbd5e1;line-height:1.6;">' + anal.g + "</div></div>"
        + '<div style="border-left:3px solid #fbbf24;border-radius:7px;padding:7px 10px;background:rgba(0,0,0,.25);"><div style="font-size:10px;color:#fbbf24;font-weight:700;margin-bottom:2px;">⚽ Goleadores a seguir</div><div style="font-size:11px;color:#cbd5e1;line-height:1.6;">' + anal.go + "</div></div>"
        + '<div style="border-left:3px solid #60a5fa;border-radius:7px;padding:7px 10px;background:rgba(0,0,0,.25);"><div style="font-size:10px;color:#60a5fa;font-weight:700;margin-bottom:2px;">⭐ Figura clave</div><div style="font-size:11px;color:#cbd5e1;line-height:1.6;">' + anal.fi + "</div></div>"
        + '<div style="border-left:3px solid #c084fc;border-radius:7px;padding:7px 10px;background:rgba(0,0,0,.25);"><div style="font-size:10px;color:#c084fc;font-weight:700;margin-bottom:2px;">💰 Apuesta / Info</div><div style="font-size:11px;color:#cbd5e1;line-height:1.6;">' + anal.ap + "</div></div>"
        + betLink + "</div>";
    }
  }

  var detailHTML = '<div id="' + cid + '" style="display:none;margin-top:10px;border-top:1px solid #1e2d45;padding-top:9px;">'
    + statsHTML
    + '<div style="font-size:10px;color:#64748b;margin-bottom:' + (analHTML ? "8px" : "0") + ';">📅 ' + fecha + " · 🕐 " + hora + " Chile" + (venue ? " · 🏟 " + venue : "") + "</div>"
    + analHTML
    + "</div>";

  return '<div class="card" id="wrap' + cid + '" onclick="toggleCard(\'' + cid + '\')">'
    + '<div style="display:flex;align-items:center;gap:7px;">'
    + (grp ? '<span class="badge">' + grp + "</span>" : "")
    + '<span style="font-size:10px;color:' + sColor + ';font-weight:700;min-width:58px;">' + sLabel + (live && m.minute ? " " + m.minute + "'" : "") + "</span>"
    + '<div style="flex:1;display:flex;align-items:center;gap:6px;">'
    + '<span style="flex:1;font-size:12px;font-weight:600;">' + hF + " " + hN + "</span>"
    + '<span style="min-width:72px;text-align:center;flex-shrink:0;">' + scoreHTML + "</span>"
    + '<span style="flex:1;font-size:12px;font-weight:600;text-align:right;">' + aN + " " + aF + "</span>"
    + "</div>"
    + '<span class="arr" style="font-size:9px;color:#4ade80;flex-shrink:0;">▼</span>'
    + "</div>"
    + detailHTML
    + "</div>";
}

function tableHTML(s) {
  var grp = s.group ? s.group.replace("GROUP_","Grupo ") : "";
  var rows = (s.table || []).map(function(row, i) {
    var dg = row.goalDifference;
    var dgC = dg > 0 ? "#4ade80" : dg < 0 ? "#f87171" : "#94a3b8";
    return '<tr class="' + (i < 2 ? "row-top" : "") + '">'
      + '<td style="text-align:center;color:' + (i<2?"#4ade80":"#64748b") + ';font-weight:700;">' + (i<2?"✓":i+1) + "</td>"
      + "<td>" + f(row.team && row.team.name) + ' <span style="font-weight:600;color:' + (i<2?"#e2e8f0":"#94a3b8") + '">' + n(row.team && row.team.name) + "</span></td>"
      + "<td>" + row.playedGames + "</td><td>" + row.won + "</td><td>" + row.draw + "</td><td>" + row.lost + "</td>"
      + "<td>" + row.goalsFor + "</td><td>" + row.goalsAgainst + "</td>"
      + '<td style="color:' + dgC + '">' + (dg>0?"+":"") + dg + "</td>"
      + '<td class="pts">' + row.points + "</td>"
      + "</tr>";
  }).join("");
  return '<div style="background:#121c30;border-radius:10px;border:1px solid #1e2d45;overflow:hidden;margin-bottom:10px;">'
    + '<div style="padding:10px 13px;border-bottom:1px solid #1e2d45;font-size:13px;font-weight:700;">' + grp + "</div>"
    + '<div style="overflow-x:auto;"><table><thead><tr>'
    + "<th>#</th><th style=\"text-align:left;\">Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th>"
    + "</tr></thead><tbody>" + rows + "</tbody></table></div>"
    + '<div style="padding:7px 13px;border-top:1px solid #1e2d45;font-size:10px;color:#4ade80;">✓ Clasifican los 2 primeros + 8 mejores terceros</div>'
    + "</div>";
}

async function main() {
  console.log("Fetching...");
  var mData, sData;
  [mData, sData] = await Promise.all([get("competitions/WC/matches"), get("competitions/WC/standings")]);

  var matches   = mData.matches || [];
  var standings = (sData.standings || []).filter(function(s){ return s.type === "TOTAL"; });
  var finished  = matches.filter(function(m){ return m.status === "FINISHED"; }).sort(function(a,b){ return new Date(b.utcDate)-new Date(a.utcDate); });
  var live      = matches.filter(function(m){ return m.status === "IN_PLAY" || m.status === "PAUSED"; });
  var upcoming  = matches.filter(function(m){ return m.status === "SCHEDULED" || m.status === "TIMED"; }).sort(function(a,b){ return new Date(a.utcDate)-new Date(b.utcDate); });
  var todayAll  = matches.filter(function(m){ return isToday(m.utcDate); }).sort(function(a,b){ return new Date(a.utcDate)-new Date(b.utcDate); });

  // ── API-Football: fetch events + stats para partidos sin cache ──
  var toFetch = finished.filter(function(m) {
    var c = statsCache[String(m.id)];
    return !c || c.notFound || !c.events; // incluye todos los partidos sin cache
  });

  // Siempre escribir debug (se commitea via git add af_debug.json)
  var afDebug = {
    ts: new Date().toISOString(),
    finishedCount: finished.length,
    toFetchCount: toFetch.length,
    cacheSize: Object.keys(statsCache).length,
    firstFinishedIds: finished.slice(0, 5).map(function(m){ return m.id; }),
    toFetchCount2: toFetch.length,
    toFetchSample: toFetch.slice(0, 5).map(function(m){ return m.id; })
  };
  try { fs.writeFileSync("af_debug.json", JSON.stringify(afDebug, null, 2)); } catch(e) {}

  if (toFetch.length > 0) {
    // Agrupar por fecha UTC
    var dateGroups = {};
    toFetch.forEach(function(m) {
      var d = m.utcDate.substring(0, 10);
      if (!dateGroups[d]) dateGroups[d] = [];
      dateGroups[d].push(m);
    });

    afDebug.espnDates = [];
    var rawSampleSaved = false;

    // Precarga ESPN para cada fecha ± 2 días (diferencia UTC vs hora local USA/Canadá/México)
    var espnByDate = {};
    var espnFetchedDates = {};  // evitar duplicar fetch de misma fecha
    for (var espnDate of Object.keys(dateGroups)) {
      var combined = [];
      for (var delta = -2; delta <= 1; delta++) {
        var d = new Date(espnDate); d.setDate(d.getDate() + delta);
        var dd = d.toISOString().substring(0, 10);
        if (espnFetchedDates[dd]) { combined = combined.concat(espnFetchedDates[dd]); continue; }
        try {
          var sbRes = await getESPN("scoreboard?dates=" + dd.replace(/-/g, ""));
          var evs = sbRes.events || [];
          espnFetchedDates[dd] = evs;
          combined = combined.concat(evs);
        } catch(e) {}
      }
      espnByDate[espnDate] = combined;
      console.log("ESPN pool " + espnDate + ": " + combined.length + " partidos");
      afDebug.espnDates.push({ date: espnDate, count: combined.length });
    }

    for (var espnDate of Object.keys(dateGroups)) {
      try {
        // Pool mutable: cada partido ESPN se usa una sola vez (evita duplicados por mismo marcador)
        var espnPool = espnByDate[espnDate].slice();

        for (var fdm of dateGroups[espnDate]) {
          var hScore = fdm.score && fdm.score.fullTime ? fdm.score.fullTime.home : null;
          var aScore = fdm.score && fdm.score.fullTime ? fdm.score.fullTime.away : null;

          // Buscar partido ESPN por marcador, intentando también con nombres de equipo
          var fdmHome = (fdm.homeTeam && fdm.homeTeam.shortName || fdm.homeTeam && fdm.homeTeam.name || "").toLowerCase();
          var fdmAway = (fdm.awayTeam && fdm.awayTeam.shortName || fdm.awayTeam && fdm.awayTeam.name || "").toLowerCase();

          var espnIdx = -1;
          espnPool.forEach(function(e, i) {
            if (espnIdx >= 0) return;
            var comp = e.competitions && e.competitions[0];
            if (!comp || !comp.status || !comp.status.type || !comp.status.type.completed) return;
            var home = (comp.competitors || []).find(function(c){ return c.homeAway === "home"; });
            var away = (comp.competitors || []).find(function(c){ return c.homeAway === "away"; });
            if (!home || !away) return;
            if (parseInt(home.score) !== hScore || parseInt(away.score) !== aScore) return;
            // Si hay más de un partido con el mismo marcador, intentar confirmar por nombre de equipo
            var eName = (e.name || "").toLowerCase();
            var eHome = (home.team && home.team.displayName || "").toLowerCase();
            var eAway = (away.team && away.team.displayName || "").toLowerCase();
            var nameMatch = eName.includes(fdmHome) || eName.includes(fdmAway) ||
                            eHome.includes(fdmHome) || fdmHome.includes(eHome.split(" ")[0]) ||
                            eAway.includes(fdmAway) || fdmAway.includes(eAway.split(" ")[0]);
            // Aceptar si el marcador coincide (y nombres si hay duda)
            var scoreMatchOnly = espnPool.filter(function(e2) {
              var c2 = e2.competitions && e2.competitions[0];
              if (!c2 || !c2.status || !c2.status.type || !c2.status.type.completed) return false;
              var h2 = (c2.competitors||[]).find(function(c){ return c.homeAway==="home"; });
              var a2 = (c2.competitors||[]).find(function(c){ return c.homeAway==="away"; });
              return h2 && a2 && parseInt(h2.score)===hScore && parseInt(a2.score)===aScore;
            }).length;
            if (scoreMatchOnly === 1 || nameMatch) espnIdx = i;
          });

          var espnMatch = espnIdx >= 0 ? espnPool.splice(espnIdx, 1)[0] : null;

          if (!espnMatch) {
            console.log("ESPN: no match for " + (fdm.homeTeam&&fdm.homeTeam.name) + " vs " + (fdm.awayTeam&&fdm.awayTeam.name) + " (" + hScore + "-" + aScore + ")");
            statsCache[String(fdm.id)] = { notFound: true };
            continue;
          }

          console.log("ESPN: match found: " + espnMatch.name + " id=" + espnMatch.id);
          var summary = await getESPN("summary?event=" + espnMatch.id);

          // Guardar un sample del response ESPN la primera vez (para debug)
          if (!rawSampleSaved) {
            afDebug.espnSampleStats = (summary.boxscore && summary.boxscore.teams || []).map(function(t){
              return { team: t.team && t.team.displayName, stats: (t.statistics||[]).map(function(s){ return s.name + "=" + s.displayValue; }) };
            });
            afDebug.espnSamplePlays = (summary.scoringPlays || []).slice(0, 3).map(function(p){
              return { type: p.type && p.type.text, clock: p.clock && p.clock.displayValue, text: p.text };
            });
            rawSampleSaved = true;
          }

          statsCache[String(fdm.id)] = {
            espnId: espnMatch.id,
            events: mapESPNEvents(summary),
            stats:  mapESPNStats(summary)
          };
        }
      } catch(e) {
        console.log("ESPN error for " + espnDate + ": " + e.message);
        afDebug.espnError = e.message;
      }
    }

    try { fs.writeFileSync("af_debug.json", JSON.stringify(afDebug, null, 2)); } catch(e) {}
    try { fs.writeFileSync(CACHE_FILE, JSON.stringify(statsCache)); } catch(e) { console.log("Cache write error: " + e.message); }
    console.log("Cache guardado. Partidos cacheados: " + Object.keys(statsCache).length);
  } else {
    console.log("ESPN: todos los partidos recientes ya están en cache (" + Object.keys(statsCache).length + " entradas)");
  }

  // DEBUG
  console.log("=== NOMBRES API ===");
  todayAll.forEach(function(m){ 
    var anal = getAnal(m.homeTeam && m.homeTeam.name, m.awayTeam && m.awayTeam.name);
    console.log("HOY: " + (m.homeTeam&&m.homeTeam.name) + " vs " + (m.awayTeam&&m.awayTeam.name) + " => anal:" + (anal?"SI":"NO")); 
  });
  upcoming.slice(0,10).forEach(function(m){ 
    var hn = m.homeTeam && m.homeTeam.name;
    var an = m.awayTeam && m.awayTeam.name;
    var anal = getAnal(hn, an);
    var k1 = hn+"_"+an;
    var k2 = an+"_"+hn;
    var directK1 = ANAL[k1] ? "direct" : "no";
    var directK2 = ANAL[k2] ? "direct" : "no";
    console.log("PROX: " + hn + " vs " + an + " => k1(" + directK1 + ") k2(" + directK2 + ") anal:" + (anal?"SI":"NO")); 
  });

  var totalGoals = finished.reduce(function(s,m){ var sc=m.score&&m.score.fullTime; return s+(sc&&sc.home||0)+(sc&&sc.away||0); },0);
  var nowCL  = new Date().toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"America/Santiago"});
  var todayCL = clDateLong(new Date().toISOString());
  var dateCL  = clDateShort(new Date().toISOString());

  // HOY
  cardId = 0;
  var hoyHTML = todayAll.length ? todayAll.map(function(m){return makeCard(m);}).join("") : '<div class="empty">No hay partidos hoy.</div>';

  // PRÓXIMOS
  cardId = 1000;
  var byDate = {};
  upcoming.filter(function(m){return !isToday(m.utcDate);}).slice(0,20).forEach(function(m){
    var d = clDateShort(m.utcDate);
    if(!byDate[d]) byDate[d]=[];
    byDate[d].push(m);
  });
  var proximosHTML = Object.keys(byDate).map(function(fecha){
    return '<div style="font-size:11px;color:#4ade80;font-weight:700;text-transform:uppercase;margin:16px 0 8px;">'
      + '<span style="background:#0d2a18;border-radius:4px;padding:2px 8px;border:1px solid #166534;">' + fecha + "</span></div>"
      + byDate[fecha].map(function(m){return makeCard(m);}).join("");
  }).join("");

  // RESULTADOS
  cardId = 2000;
  var jornadas = [];
  finished.forEach(function(m){ if(m.matchday && !jornadas.includes(m.matchday)) jornadas.push(m.matchday); });
  jornadas.sort(function(a,b){return a-b;});
  var grupos = ["GROUP_A","GROUP_B","GROUP_C","GROUP_D","GROUP_E","GROUP_F","GROUP_G","GROUP_H","GROUP_I","GROUP_J","GROUP_K","GROUP_L"];
  var jorBtns = jornadas.map(function(j){
    return '<button class="jbtn" onclick="showJornada(' + j + ',this)">J' + j + "</button>";
  }).join("");
  var resAllBtns = '<span style="font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.6px;margin-right:3px;align-self:center;">Fase de Grupos</span>'
    + jorBtns
    + '<span style="color:#2a3a5a;margin:0 6px;align-self:center;font-size:16px;line-height:1;">│</span>'
    + '<button class="jbtn active" onclick="showR16(this)">🏆 16avos</button>';
  var jorBlocks = jornadas.map(function(j){
    var pj = finished.filter(function(m){return m.matchday===j;});
    var grpsP = grupos.filter(function(g){return pj.some(function(m){return m.group===g;});});
    return '<div id="j' + j + '" style="display:none;">'
      + grpsP.map(function(g){
          return '<div class="grp-block"><div class="grp-hdr">' + g.replace("GROUP_","Grupo ") + " · J" + j + "</div>"
            + pj.filter(function(m){return m.group===g;}).map(function(m){return makeCard(m);}).join("")
            + "</div>";
        }).join("")
      + "</div>";
  }).join("");

  // RESULTADOS 16AVOS — usar makeCard si la API ya los tiene, si no mostrar tabla estática
  var finishedKO = finished.filter(function(m){ return !m.group; });
  var resultados16HTML;
  if(finishedKO.length > 0){
    resultados16HTML = '<div style="background:#121c30;border-radius:10px;border:1px solid #1e2d45;overflow:hidden;margin-bottom:10px;">'
      + '<div style="padding:12px 13px;border-bottom:1px solid #1e2d45;display:flex;align-items:center;justify-content:space-between;">'
      + '<div style="font-size:14px;font-weight:800;color:#fff;">🏆 Resultados 16avos</div>'
      + '<div style="font-size:10px;color:#4ade80;">' + finishedKO.length + ' jugados</div></div>'
      + '<div style="padding:10px;">'
      + finishedKO.map(function(m){return makeCard(m);}).join("")
      + '</div></div>';
  } else {
    var r16Row = function(fecha,flag1,eq1,g1,g2,flag2,eq2,pen,estadio){
      var score = (g1!==null&&g2!==null) ? ('<span style="font-size:16px;font-weight:900;color:#4ade80;letter-spacing:2px;padding:0 8px;">' + g1 + ' - ' + g2 + (pen?'<span style="font-size:9px;color:#fbbf24;margin-left:4px;">'+pen+'</span>':'') + '</span>') : '<span style="font-size:10px;color:#fbbf24;background:#1a2000;border:1px solid #3a4000;border-radius:4px;padding:2px 7px;">Pendiente</span>';
      return '<tr style="border-top:1px solid #1e2d45;"><td style="padding:9px 8px 2px;font-size:10px;color:#4ade80;font-weight:700;" colspan="3">' + fecha + '</td></tr>'
        + '<tr><td style="padding:2px 8px 9px;font-size:12px;font-weight:700;text-align:right;width:38%;">' + flag1 + ' ' + eq1 + '</td>'
        + '<td style="padding:2px 8px 9px;text-align:center;white-space:nowrap;">' + score + '</td>'
        + '<td style="padding:2px 8px 9px;font-size:12px;font-weight:700;width:38%;">' + flag2 + ' ' + eq2 + '</td></tr>'
        + '<tr><td colspan="3" style="padding:0 8px 9px;font-size:10px;color:#475569;">🏟 ' + estadio + '</td></tr>';
    };
    resultados16HTML = '<div style="background:#121c30;border-radius:10px;border:1px solid #1e2d45;overflow:hidden;margin-bottom:10px;">'
      + '<div style="padding:12px 13px;border-bottom:1px solid #1e2d45;display:flex;align-items:center;justify-content:space-between;">'
      + '<div style="font-size:14px;font-weight:800;color:#fff;">🏆 Resultados 16avos</div>'
      + '<div style="font-size:10px;color:#4ade80;">28 Jun – 3 Jul</div></div>'
      + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:300px;"><tbody>'
      + r16Row('📅 28 jun · 16:00','🇿🇦','Sudáfrica',0,1,'🇨🇦','Canadá',null,'SoFi Stadium, Los Ángeles')
      + r16Row('📅 29 jun · 13:00','🇧🇷','Brasil',null,null,'🇯🇵','Japón',null,'NRG Stadium, Houston')
      + r16Row('📅 29 jun · 16:30','🇩🇪','Alemania',null,null,'🇵🇾','Paraguay',null,'AT&T Stadium, Dallas')
      + r16Row('📅 29 jun · 21:00','🇳🇱','Países Bajos',null,null,'🇲🇦','Marruecos',null,'Levi\'s Stadium, San José')
      + r16Row('📅 30 jun · 13:00','🇨🇮','C. Marfil',null,null,'🇳🇴','Noruega',null,'Rose Bowl, Los Ángeles')
      + r16Row('📅 30 jun · 17:00','🇫🇷','Francia',null,null,'🇸🇪','Suecia',null,'MetLife Stadium, Nueva York')
      + r16Row('📅 30 jun · 21:00','🇲🇽','México',null,null,'🇪🇨','Ecuador',null,'Arrowhead Stadium, Kansas City')
      + r16Row('📅 1 jul · 12:00','🏴󠁧󠁢󠁥󠁮󠁧󠁿','Inglaterra',null,null,'🇨🇩','Congo DR',null,'Mercedes-Benz Stadium, Atlanta')
      + r16Row('📅 1 jul · 16:00','🇧🇪','Bélgica',null,null,'🇸🇳','Senegal',null,'Lumen Field, Seattle')
      + r16Row('📅 1 jul · 20:00','🇺🇸','EE.UU.',null,null,'🇧🇦','Bosnia',null,'SoFi Stadium, Los Ángeles')
      + r16Row('📅 2 jul · 15:00','🇪🇸','España',null,null,'🇦🇹','Austria',null,'Hard Rock Stadium, Miami')
      + r16Row('📅 2 jul · 19:00','🇵🇹','Portugal',null,null,'🇭🇷','Croacia',null,'SoFi Stadium, Los Ángeles')
      + r16Row('📅 2 jul · 23:00','🇨🇭','Suiza',null,null,'🇩🇿','Argelia',null,'MetLife Stadium, Nueva York')
      + r16Row('📅 3 jul · 14:00','🇦🇺','Australia',null,null,'🇪🇬','Egipto',null,'NRG Stadium, Houston')
      + r16Row('📅 3 jul · 18:00','🇦🇷','Argentina',null,null,'🇨🇻','Cabo Verde',null,'Hard Rock Stadium, Miami')
      + r16Row('📅 3 jul · 21:30','🇨🇴','Colombia',null,null,'🇬🇭','Ghana',null,'AT&T Stadium, Dallas')
      + '</tbody></table></div></div>';
  }

  // TABLAS
  // ── FIXTURE 16AVOS ──
  var fixture16HTML = '<div id="t16avos" style="display:none;">   <div style="background:#121c30;border-radius:10px;border:1px solid #1e2d45;overflow:hidden;margin-bottom:10px;">     <div style="padding:12px 13px;border-bottom:1px solid #1e2d45;display:flex;align-items:center;justify-content:space-between;">       <div style="font-size:14px;font-weight:800;color:#fff;">🏆 16avos de Final</div>       <div style="font-size:10px;color:#4ade80;">28 Jun – 3 Jul · Hora Chile</div>     </div>     <div style="overflow-x:auto;">       <table style="width:100%;border-collapse:collapse;font-size:12px;">         <thead><tr>           <th style="padding:7px 8px;color:#64748b;font-size:10px;text-transform:uppercase;background:#0b1120;text-align:left;">Hora</th>           <th style="padding:7px 8px;color:#64748b;font-size:10px;text-transform:uppercase;background:#0b1120;text-align:right;">Local</th>           <th style="padding:7px 8px;color:#64748b;font-size:10px;text-transform:uppercase;background:#0b1120;text-align:center;"></th>           <th style="padding:7px 8px;color:#64748b;font-size:10px;text-transform:uppercase;background:#0b1120;text-align:left;">Visitante</th>         </tr></thead>         <tbody><tr style="background:#0d2a18;">   <td colspan="4" style="padding:8px 10px;font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:1px;">📅 28 jun</td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">16:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇿🇦 Sudáfrica</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇨🇦 Canadá</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 SoFi Stadium, Los Ángeles &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr>   <td colspan="4" style="padding:9px 8px;font-size:10px;color:#4ade80;">Solo 1 partido hoy · Resto desde el 29 jun</td> </tr><tr style="background:#0d2a18;">   <td colspan="4" style="padding:8px 10px;font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:1px;">📅 29 jun</td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">13:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇧🇷 Brasil</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇯🇵 Japón</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 NRG Stadium, Houston &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">16:30</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇩🇪 Alemania</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇵🇾 Paraguay</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 AT&T Stadium, Dallas &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">21:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇳🇱 Países Bajos</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇲🇦 Marruecos</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 Levi\'s Stadium, San José &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr style="background:#0d2a18;">   <td colspan="4" style="padding:8px 10px;font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:1px;">📅 30 jun</td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">13:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇨🇮 Costa de Marfil</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇳🇴 Noruega</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 Rose Bowl, Los Ángeles &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">17:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇫🇷 Francia</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇸🇪 Suecia</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 MetLife Stadium, Nueva York &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">21:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇲🇽 México</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇪🇨 Ecuador</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 Arrowhead Stadium, Kansas City &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr style="background:#0d2a18;">   <td colspan="4" style="padding:8px 10px;font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:1px;">📅 1 jul</td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">12:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🏴󠁧󠁢󠁥󠁮󠁧󠁿 Inglaterra</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇨🇩 Congo DR</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 Mercedes-Benz Stadium, Atlanta &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">16:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇧🇪 Bélgica</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇸🇳 Senegal</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 Lumen Field, Seattle &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">20:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇺🇸 EE.UU.</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇧🇦 Bosnia-Herz.</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 SoFi Stadium, Los Ángeles &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr style="background:#0d2a18;">   <td colspan="4" style="padding:8px 10px;font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:1px;">📅 2 jul</td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">15:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇪🇸 España</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇦🇹 Austria</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 Hard Rock Stadium, Miami &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">19:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇵🇹 Portugal</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇭🇷 Croacia</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 SoFi Stadium, Los Ángeles &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">23:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇨🇭 Suiza</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇩🇿 Argelia</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 MetLife Stadium, Nueva York &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr style="background:#0d2a18;">   <td colspan="4" style="padding:8px 10px;font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:1px;">📅 3 jul</td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">14:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇦🇺 Australia</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇪🇬 Egipto</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 NRG Stadium, Houston &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">18:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇦🇷 Argentina</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇨🇻 Cabo Verde</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 Hard Rock Stadium, Miami &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">21:30</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇨🇴 Colombia</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇬🇭 Ghana</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 AT&T Stadium, Dallas &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr></tbody>       </table>     </div>     <div style="padding:10px 13px;border-top:1px solid #1e2d45;font-size:10px;color:#64748b;">       ✓ 24 equipos clasificados directamente (12 primeros + 12 segundos) + 8 mejores terceros     </div>   </div> </div>';

  var grpBtns = standings.map(function(s,i){
    return '<button class="gbtn' + (i===0?" active":"") + '" onclick="showGrp(\'t' + s.group.replace("GROUP_","") + '\',this)">' + s.group.replace("GROUP_","G ") + "</button>";
  }).join("");
  var tablaBlocks = standings.map(function(s,i){
    return '<div id="t' + s.group.replace("GROUP_","") + '" style="display:' + (i===0?"block":"none") + ';">' + tableHTML(s) + "</div>";
  }).join("");

  // APUESTAS
  var jornadaMax = jornadas.length > 0 ? jornadas[jornadas.length-1] : 0;
  var tipsLines = [];
  if(jornadaMax>=1) tipsLines = tipsLines.concat(["🇦🇷 <b>Argentina</b> — Messi hat-trick vs Argelia. Candidato al titulo.","🇩🇪 <b>Alemania</b> — 7-1 a Curazao. La maquina del torneo.","🇳🇴 <b>Noruega sorpresa</b> — Haaland doblete en debut.","🇵🇹 <b>Portugal en aprietos</b> — 1-1 con RD Congo.","🇪🇸 <b>Espana decepciono</b> — 0-0 vs Cabo Verde."]);
  if(jornadaMax>=2) tipsLines = tipsLines.concat(["🇲🇽 <b>Mexico clasificado</b> — 6 pts. Lider Grupo A.","🇺🇸 <b>EE.UU. clasificado</b> — 6 pts. Efecto local brutal.","🇨🇦 <b>Canada</b> — 6-0 a Qatar. Sorpresa positiva de J2.","🇨🇭 <b>Suiza reacciono</b> — 4-1 a Bosnia.","🇹🇷 <b>Turquia eliminada</b> — Paraguay heroico con 10 jugadores."]);
  if(jornadaMax>=3) tipsLines = tipsLines.concat([
    "🇲🇽 <b>México histórico</b> — 9 pts, 3 victorias en 3. El Tri nunca había hecho esto.",
    "🇧🇷 <b>Brasil despertó</b> — 3-0 a Escocia. Vinícius Jr + Neymar disponible. Peligroso.",
    "🇦🇷 <b>Argentina pleno</b> — 3 victorias, 9 pts. Messi en modo histórico. Favoritísimo.",
    "🇿🇦 <b>Sudáfrica sorpresa</b> — Eliminó a Corea del Sur. Los Bafana Bafana clasificaron.",
    "🇰🇷 <b>Corea del Sur fuera</b> — Perdió ante Sudáfrica. Eliminada en la fase de grupos.",
    "🏆 Fase de grupos terminada · 16avos de final arrancan el 29 Jun."
  ]);
  var tipsHTML = '<div style="background:linear-gradient(135deg,#0d2a1a,#0a1f2f);border:1px solid #1a4a2a;border-radius:12px;padding:13px 15px;margin-bottom:12px;">'
    + '<div style="font-size:12px;color:#4ade80;font-weight:700;margin-bottom:7px;">💡 Tips del analista · J' + jornadaMax + " completada</div>"
    + '<div style="font-size:12px;color:#cbd5e1;line-height:2.0;">' + tipsLines.join("<br>") + "</div></div>";

  var continentes = [
    {c:"rgba(96,165,250,0.06)",b:"rgba(96,165,250,0.15)",t:"#93c5fd",ti:"EUROPA",j1:"Brillando: Alemania (7-1), Noruega (4-1), Suecia (5-1). Flojos: Portugal (1-1), Espana (0-0). Norte europeo domina.",j2:"Suiza 4-1 Bosnia, Canada 6-0 Qatar. Portugal sigue en crisis. Francia y Noruega favoritos Grupo I.",j3:"Fase de grupos terminada. Clasificados europeos definidos."},
    {c:"rgba(74,222,128,0.06)",b:"rgba(74,222,128,0.15)",t:"#86efac",ti:"SUDAMERICA",j1:"Brillando: Argentina (3-0 Messi x3), Colombia (3-1). Flojos: Brasil (1-1), Ecuador (0-1).",j2:"Brasil reacciono 3-0 a Haiti. Mexico y EE.UU. clasificados. Ecuador casi eliminado.",j3:"Argentina lider indiscutible. Clasificados sudamericanos definidos."},
    {c:"rgba(251,191,36,0.06)",b:"rgba(251,191,36,0.15)",t:"#fcd34d",ti:"AFRICA",j1:"Brillando: Marruecos (1-1 Brasil), C. Marfil (gana 90'), Ghana (1-0 agonica), RD Congo (empato Portugal).",j2:"Marruecos 1-0 Escocia confirma liderato Grupo C.",j3:"Marruecos avanza. Clasificados africanos definidos."},
    {c:"rgba(167,139,250,0.06)",b:"rgba(167,139,250,0.15)",t:"#c4b5fd",ti:"ASIA Y OCEANIA",j1:"Brillando: Japon (2-2 Paises Bajos al 89min), Corea del Sur (2-1 remontada). Flojos: Qatar (1-1).",j2:"Japon y Corea bien posicionados. Qatar goleado 0-6 por Canada.",j3:"Japon y Corea clasificados. Qatar eliminado."},
    {c:"rgba(248,113,113,0.06)",b:"rgba(248,113,113,0.15)",t:"#fca5a5",ti:"CONCACAF",j1:"Brillando: EE.UU. (4-1), Mexico (2-0). Canada empezo 1-1.",j2:"Mexico y EE.UU. clasificados 6 pts. Canada goleo 6-0. CONCACAF historico.",j3:"Los 3 anfitriones clasificados. Historico para CONCACAF."}
  ];
  var contHTML = '<div style="background:linear-gradient(135deg,#0a1f2f,#0d1a3a);border:1px solid #1a3a5a;border-radius:12px;padding:13px 15px;margin-bottom:20px;">'
    + '<div style="font-size:12px;color:#60a5fa;font-weight:700;margin-bottom:10px;">Analisis por continente · J' + jornadaMax + "</div>"
    + '<div style="display:flex;flex-direction:column;gap:10px;">'
    + continentes.map(function(ct){
        var tx = jornadaMax>=3?ct.j3:jornadaMax>=2?ct.j2:ct.j1;
        return '<div style="background:' + ct.c + ';border-radius:8px;padding:10px 12px;border:1px solid ' + ct.b + ';">'
          + '<div style="font-size:11px;font-weight:700;color:' + ct.t + ';margin-bottom:5px;">' + ct.ti + "</div>"
          + '<div style="font-size:11px;color:#cbd5e1;line-height:1.8;">' + tx + "</div></div>";
      }).join("")
    + "</div></div>";

  // CSS
  var css = '*{box-sizing:border-box;margin:0;padding:0;}'
    + 'body{background:#0b1120;font-family:system-ui,-apple-system,sans-serif;color:#e8eaf0;min-height:100vh;}'
    + '.header{background:linear-gradient(135deg,#1a2744,#0d1b35 50%,#1a3a1a);border-bottom:1px solid #2a3a5a;padding:16px 16px 0;}'
    + '.inner{max-width:860px;margin:0 auto;}'
    + '.tabs{display:flex;overflow-x:auto;margin-top:14px;}'
    + '.tab{background:none;border:none;cursor:pointer;padding:9px 14px;font-size:13px;font-weight:600;white-space:nowrap;color:#8899aa;border-bottom:2px solid transparent;font-family:inherit;}'
    + '.tab.active{color:#4ade80;border-bottom-color:#4ade80;}'
    + '.content{max-width:860px;margin:0 auto;padding:16px;}'
    + '.pane{display:none;}.pane.active{display:block;}'
    + '.card{background:#121c30;border:1px solid #1e2d45;border-radius:10px;padding:11px 13px;margin-bottom:7px;cursor:pointer;}'
    + '.card.open{background:#1a2744;border-color:#3b5a9a;}'
    + '.badge{font-size:10px;background:#0f2a18;color:#4ade80;border:1px solid #166534;border-radius:4px;padding:1px 6px;display:inline-block;margin:2px;}'
    + '.score{font-size:17px;font-weight:800;letter-spacing:2px;background:#0b1120;border-radius:6px;padding:2px 9px;border:1px solid #2a3a5a;}'
    + '.w{color:#4ade80;}.l{color:#f87171;}.d{color:#fbbf24;}'
    + '.stat-box{background:rgba(255,255,255,.06);border-radius:8px;padding:6px 12px;border:1px solid rgba(255,255,255,.08);}'
    + '.grp-hdr{background:#0f2a18;border:1px solid #166534;border-radius:6px;padding:3px 10px;font-size:11px;font-weight:700;color:#4ade80;display:inline-block;margin-bottom:8px;}'
    + '.grp-block{margin-bottom:20px;}'
    + '.jbtn{background:#1a2744;color:#94a3b8;border:1px solid #2a3a5a;border-radius:6px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;margin-right:4px;}'
    + '.jbtn.active{background:#4ade80;color:#0b1120;border-color:#4ade80;}'
    + '.gbtn{background:#1a2744;color:#94a3b8;border:1px solid #2a3a5a;border-radius:6px;padding:3px 9px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;margin:0 3px 3px 0;}'
    + '.gbtn.active{background:#4ade80;color:#0b1120;border-color:#4ade80;}'
    + 'table{width:100%;border-collapse:collapse;font-size:12px;min-width:420px;}'
    + 'th{padding:7px 6px;color:#64748b;font-weight:600;font-size:10px;text-transform:uppercase;background:#0b1120;text-align:center;}'
    + 'td{padding:9px 6px;border-top:1px solid #1e2d45;color:#cbd5e1;text-align:center;}'
    + '.row-top{background:rgba(74,222,128,.04);}'
    + '.pts{color:#fbbf24;font-weight:700;}'
    + '.jugabet{display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#1a6b1a,#0f4a0f);border:2px solid #4ade80;border-radius:12px;padding:13px;color:#fff;font-weight:800;font-size:14px;text-decoration:none;margin-top:12px;box-shadow:0 4px 20px rgba(74,222,128,.25);}'
    + '.empty{text-align:center;padding:40px;color:#64748b;font-size:13px;}'
    + '::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:#0b1120;}::-webkit-scrollbar-thumb{background:#2a3a5a;border-radius:2px;}';

  // JS — toggleCard usa id del wrapper
  var js = 'function showTab(id,btn){document.querySelectorAll(".pane").forEach(function(p){p.classList.remove("active");});document.querySelectorAll(".tab").forEach(function(t){t.classList.remove("active");});document.getElementById(id).classList.add("active");btn.classList.add("active");}'
    + 'function toggleCard(cid){var det=document.getElementById(cid);var wrap=document.getElementById("wrap"+cid);if(!det||!wrap)return;var isOpen=det.style.display!=="none";det.style.display=isOpen?"none":"block";wrap.classList.toggle("open",!isOpen);var arr=wrap.querySelector(".arr");if(arr)arr.textContent=isOpen?"▼":"▲";}'
    + 'function showJornada(j,btn){document.querySelectorAll(".jbtn").forEach(function(b){b.classList.remove("active");});btn.classList.add("active");var r16=document.getElementById("r16");if(r16)r16.style.display="none";document.querySelectorAll("[id^=j]").forEach(function(d){if(/^j\\d+$/.test(d.id))d.style.display="none";});var el=document.getElementById("j"+j);if(el)el.style.display="block";}'
    + 'function showR16(btn){document.querySelectorAll(".jbtn").forEach(function(b){b.classList.remove("active");});btn.classList.add("active");document.querySelectorAll("[id^=j]").forEach(function(d){if(/^j\\d+$/.test(d.id))d.style.display="none";});var r16=document.getElementById("r16");if(r16)r16.style.display="block";}'
    + 'function showGrp(id,btn){document.querySelectorAll(".gbtn").forEach(function(b){b.classList.remove("active");});btn.classList.add("active");document.querySelectorAll("[id^=t]").forEach(function(d){if(/^t[A-L]$/.test(d.id))d.style.display="none";});var el=document.getElementById(id);if(el)el.style.display="block";}';

  var favs = [["🇦🇷","Argentina","Messi hat-trick vs Argelia. Iguala récord Klose.","4.0x"],["🇫🇷","Francia","3-1 a Senegal. Mbappé goleador histórico.","4.5x"],["🇩🇪","Alemania","7-1 a Curazao. Mejor arranque del torneo.","5.5x"],["🏴󠁧󠁢󠁥󠁮󠁧󠁿","Inglaterra","4-2 a Croacia. Kane doblete.","8.0x"],["🇳🇴","Noruega","4-1 a Iraq. Haaland debut histórico.","12x"]];
  var bads = [["🇵🇹","Portugal","1-1 vs RD Congo. Cristiano sin tiros."],["🇪🇸","España","0-0 vs Cabo Verde. El campeón sin aparecer."],["🇳🇱","Países Bajos","2-2 vs Japón al 89min. Defensa frágil."]];

  // ── BRACKET SVG 16AVOS — dinámico desde API ──
  // Mapa: nombre API → {flag, nombre en español}
  var TM = {
    "South Africa":{f:"🇿🇦",n:"Sudáfrica"},"Canada":{f:"🇨🇦",n:"Canadá"},
    "Germany":{f:"🇩🇪",n:"Alemania"},"Paraguay":{f:"🇵🇾",n:"Paraguay"},
    "Côte d'Ivoire":{f:"🇨🇮",n:"C. Marfil"},"Ivory Coast":{f:"🇨🇮",n:"C. Marfil"},
    "Norway":{f:"🇳🇴",n:"Noruega"},"Mexico":{f:"🇲🇽",n:"México"},
    "Ecuador":{f:"🇪🇨",n:"Ecuador"},"England":{f:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",n:"Inglaterra"},
    "DR Congo":{f:"🇨🇩",n:"Congo DR"},"Democratic Republic of Congo":{f:"🇨🇩",n:"Congo DR"},
    "Congo DR":{f:"🇨🇩",n:"Congo DR"},
    "United States":{f:"🇺🇸",n:"EE.UU."},"USA":{f:"🇺🇸",n:"EE.UU."},
    "Bosnia and Herzegovina":{f:"🇧🇦",n:"Bosnia"},"Bosnia-Herzegovina":{f:"🇧🇦",n:"Bosnia"},
    "Switzerland":{f:"🇨🇭",n:"Suiza"},"Algeria":{f:"🇩🇿",n:"Argelia"},
    "Argentina":{f:"🇦🇷",n:"Argentina"},"Cape Verde":{f:"🇨🇻",n:"Cabo Verde"},
    "Brazil":{f:"🇧🇷",n:"Brasil"},"Japan":{f:"🇯🇵",n:"Japón"},
    "Netherlands":{f:"🇳🇱",n:"Países Bajos"},"Morocco":{f:"🇲🇦",n:"Marruecos"},
    "France":{f:"🇫🇷",n:"Francia"},"Sweden":{f:"🇸🇪",n:"Suecia"},
    "Belgium":{f:"🇧🇪",n:"Bélgica"},"Senegal":{f:"🇸🇳",n:"Senegal"},
    "Spain":{f:"🇪🇸",n:"España"},"Austria":{f:"🇦🇹",n:"Austria"},
    "Portugal":{f:"🇵🇹",n:"Portugal"},"Croatia":{f:"🇭🇷",n:"Croacia"},
    "Australia":{f:"🇦🇺",n:"Australia"},"Egypt":{f:"🇪🇬",n:"Egipto"},
    "Colombia":{f:"🇨🇴",n:"Colombia"},"Ghana":{f:"🇬🇭",n:"Ghana"}
  };
  function td(apiName){ var t=TM[apiName]; return t ? t.f+" "+t.n : apiName; }
  function tn(apiName){ var t=TM[apiName]; return t ? t.n : apiName; }

  // Emparejamientos de 16avos: orden = posición en BL/BR bracket
  var BLpairs=[
    {h:"South Africa",a:"Canada",t:"28/6 16:00"},
    {h:"Germany",a:"Paraguay",t:"29/6 16:30"},
    {h:"Côte d'Ivoire",a:"Norway",t:"30/6 13:00"},
    {h:"Mexico",a:"Ecuador",t:"30/6 21:00"},
    {h:"England",a:"DR Congo",t:"1/7 12:00"},
    {h:"United States",a:"Bosnia and Herzegovina",t:"1/7 20:00"},
    {h:"Switzerland",a:"Algeria",t:"2/7 23:00"},
    {h:"Argentina",a:"Cape Verde",t:"3/7 18:00"}
  ];
  var BRpairs=[
    {h:"Brazil",a:"Japan",t:"29/6 13:00"},
    {h:"Netherlands",a:"Morocco",t:"29/6 21:00"},
    {h:"France",a:"Sweden",t:"30/6 17:00"},
    {h:"Belgium",a:"Senegal",t:"1/7 16:00"},
    {h:"Spain",a:"Austria",t:"2/7 15:00"},
    {h:"Portugal",a:"Croatia",t:"2/7 19:00"},
    {h:"Australia",a:"Egypt",t:"3/7 14:00"},
    {h:"Colombia",a:"Ghana",t:"3/7 21:30"}
  ];

  // Busca el partido KO en el array de la API
  function findKO(p){
    return finishedKO.find(function(m){
      var hn=m.homeTeam&&m.homeTeam.name||""; var an=m.awayTeam&&m.awayTeam.name||"";
      var ph=Object.keys(TM).filter(function(k){return TM[k].n===tn(p.h)||k===p.h;});
      var pa=Object.keys(TM).filter(function(k){return TM[k].n===tn(p.a)||k===p.a;});
      return (ph.indexOf(hn)>=0&&pa.indexOf(an)>=0)||(ph.indexOf(an)>=0&&pa.indexOf(hn)>=0);
    });
  }
  // Obtiene ganador de un partido KO (devuelve nombre API)
  function koWinner(m,p){
    if(!m||m.status!=="FINISHED") return null;
    var hg=m.score&&m.score.fullTime?m.score.fullTime.home:null;
    var ag=m.score&&m.score.fullTime?m.score.fullTime.away:null;
    var w=m.score&&m.score.winner;
    var hn=m.homeTeam&&m.homeTeam.name||""; var an=m.awayTeam&&m.awayTeam.name||"";
    // Detecta si home/away está invertido respecto al bracket
    var flipped=(Object.keys(TM).filter(function(k){return k===p.a;}).indexOf(hn)>=0);
    if(w==="HOME_TEAM") return flipped?p.a:p.h;
    if(w==="AWAY_TEAM") return flipped?p.h:p.a;
    if(hg!==null&&ag!==null){ if(hg>ag) return flipped?p.a:p.h; if(ag>hg) return flipped?p.h:p.a; }
    return null;
  }
  // Construye entrada de bracket para 16avos
  function buildSlot(p){
    var m=findKO(p);
    if(m&&m.status==="FINISHED"){
      var hg=m.score&&m.score.fullTime?m.score.fullTime.home:null;
      var ag=m.score&&m.score.fullTime?m.score.fullTime.away:null;
      var ph=m.score&&m.score.penalties?m.score.penalties.home:null;
      var pa=m.score&&m.score.penalties?m.score.penalties.away:null;
      var w=koWinner(m,p);
      var flipped=(m.homeTeam&&m.homeTeam.name||"")!==p.h&&Object.keys(TM).filter(function(k){return k===p.a;}).indexOf(m.homeTeam&&m.homeTeam.name||"")>=0;
      var ga=flipped?ag:hg, gb=flipped?hg:ag;
      var gpa=flipped?pa:ph, gpb=flipped?ph:pa;
      var scoreStr=(ga!==null?ga:"?")+"-"+(gb!==null?gb:"?");
      var penStr=(gpa!==null&&gpb!==null)?" pen "+gpa+"-"+gpb:"";
      return {
        a:td(p.h)+(w===p.h?" ✅":""),
        b:td(p.a)+(w===p.a?" ✅":""),
        t:"FT "+scoreStr+penStr
      };
    }
    return {a:td(p.h),b:td(p.a),t:p.t};
  }
  // Construye entrada de 8vos (par de 16avos)
  function build8Slot(pairs,i,j){
    var w1=koWinner(findKO(pairs[i]),pairs[i]);
    var w2=koWinner(findKO(pairs[j]),pairs[j]);
    if(!w1&&!w2) return {a:null,b:null};
    return {
      a: w1 ? td(w1) : "Gana "+tn(pairs[i].h)+"/"+tn(pairs[i].a),
      b: w2 ? td(w2) : "Gana "+tn(pairs[j].h)+"/"+tn(pairs[j].a)
    };
  }

  var BL=BLpairs.map(buildSlot);
  var BR=BRpairs.map(buildSlot);
  var BL8=[[0,1],[2,3],[4,5],[6,7]].map(function(p){return build8Slot(BLpairs,p[0],p[1]);});
  var BR8=[[0,1],[2,3],[4,5],[6,7]].map(function(p){return build8Slot(BRpairs,p[0],p[1]);});

  // Constantes de layout
  var CH=26, CG=2, MG=10;
  var SLOT=CH+CG+CH+MG; // 64px por partido
  var W16=128,W8=108,W4=95,WSF=88,WFIN=76,CN=14;
  var TW=W16+CN+W8+CN+W4+CN+WSF+CN+WFIN+CN+WSF+CN+W4+CN+W8+CN+W16;
  var TH=8*SLOT+CH+30;

  function svgEl(tag,attrs){
    var s="<"+tag;
    for(var k in attrs) s+=" "+k+'="'+attrs[k]+'"';
    return s+">";
  }
  function svgClose(tag){return "</"+tag+">";}

  function matchCY(i){return i*SLOT+CH+CG/2;}
  function groupCY(a,b){return (matchCY(a)+matchCY(b))/2;}

  // Rect SVG
  function rect(x,y,w,h,fill,stroke,r){
    return svgEl("rect",{x:x,y:y,width:w,height:h,rx:r||4,fill:fill||"#0d1525","stroke-width":"0.5",stroke:stroke||"#1e2d45"})+svgClose("rect");
  }
  // Text SVG
  function txt(x,y,s,fill,size,anchor){
    return svgEl("text",{x:x,y:y,fill:fill||"#e2e8f0","font-size":size||11,"font-family":"system-ui,sans-serif","text-anchor":anchor||"start"})+s+svgClose("text");
  }
  // Line SVG
  function line(x1,y1,x2,y2){
    return svgEl("line",{x1:x1,y1:y1,x2:x2,y2:y2,stroke:"#2a3a5a","stroke-width":"0.5"})+svgClose("line");
  }
  // Team card
  function card16(x,y,name,time){
    var r=rect(x,y,W16,CH,"#0b1120","#2a3a5a");
    var t=txt(x+5,y+17,name,"#e2e8f0",11);
    var tm=time?txt(x+W16-4,y+17,time,"#60a5fa",9,"end"):"";
    return r+t+tm;
  }
  // Empty slot
  function emptySlot(x,y,w){return rect(x,y,w,CH*2+CG,"#0d1525","#1e2d45");}
  // Bracket connector rightward: from right edge of matches i,j → output
  function bConnR(x,i,j){
    var ya=matchCY(i),yb=matchCY(j),ym=(ya+yb)/2;
    return line(x,ya,x,yb)+line(x,ya,x+CN,ya)+line(x,yb,x+CN,yb)+line(x,ym,x+CN,ym);
  }
  // Bracket connector leftward
  function bConnL(x,i,j){
    var ya=matchCY(i),yb=matchCY(j),ym=(ya+yb)/2,xr=x+CN;
    return line(xr,ya,xr,yb)+line(x,ya,xr,ya)+line(x,yb,xr,yb)+line(x,ym,xr,ym);
  }
  // Column header
  function colHdr(x,w,lbl,bg,tc){
    return rect(x,0,w,18,bg||"#0d2a18","#166534",3)+txt(x+w/2,12,lbl,tc||"#4ade80",8,"middle");
  }

  // Build SVG string
  var s="";

  // Calc X positions
  var xL16=0,xL8=W16+CN,xL4=xL8+W8+CN,xSFL=xL4+W4+CN;
  var xFIN=xSFL+WSF+CN,xSFR=xFIN+WFIN+CN,xR4=xSFR+WSF+CN;
  var xR8=xR4+W4+CN,xR16=xR8+W8+CN;

  // Headers
  s+=colHdr(xL16,W16,"16AVOS");
  s+=colHdr(xL8,W8,"8VOS");
  s+=colHdr(xL4,W4,"4TOS");
  s+=colHdr(xSFL,WSF,"SEMIS");
  s+=colHdr(xFIN,WFIN,"FINAL","#1a2200","#fbbf24");
  s+=colHdr(xSFR,WSF,"SEMIS");
  s+=colHdr(xR4,W4,"4TOS");
  s+=colHdr(xR8,W8,"8VOS");
  s+=colHdr(xR16,W16,"16AVOS");

  // Left 16avos
  BL.forEach(function(m,i){
    var y=22+i*SLOT;
    s+=card16(xL16,y,m.a,m.t);
    s+=card16(xL16,y+CH+CG,m.b,null);
  });
  // Right 16avos
  BR.forEach(function(m,i){
    var y=22+i*SLOT;
    s+=card16(xR16,y,m.a,m.t);
    s+=card16(xR16,y+CH+CG,m.b,null);
  });

  // Helper: matchCY with header offset
  function mcy(i){return 22+i*SLOT+CH+CG/2;}
  function gcy(a,b){return (mcy(a)+mcy(b))/2;}

  // Left 8vos
  var l8p=[[0,1],[2,3],[4,5],[6,7]];
  l8p.forEach(function(p,si){
    var ya=mcy(p[0]),yb=mcy(p[1]),ym=(ya+yb)/2;
    // connector
    s+=line(xL16+W16,ya,xL16+W16,yb);
    s+=line(xL16+W16,ya,xL16+W16+CN,ya);
    s+=line(xL16+W16,yb,xL16+W16+CN,yb);
    s+=line(xL16+W16+CN/2,ya,xL16+W16+CN/2,yb);
    // slot: show team names if known, else empty
    var sl8=BL8[si];
    if(sl8&&sl8.a){
      s+=rect(xL8,ym-CH-CG/2,W8,CH*2+CG,"#0b1120","#4ade80");
      s+=txt(xL8+5,ym-CG/2-4,sl8.a,"#4ade80",10);
      s+=txt(xL8+5,ym+CH+CG/2-4,sl8.b,"#94a3b8",9);
    } else {
      s+=emptySlot(xL8,ym-CH-CG/2,W8);
    }
    // out line
    s+=line(xL8+W8,ym,xL8+W8+CN,ym);
  });

  // Left 4tos
  var l8cy=[gcy(0,1),gcy(2,3),gcy(4,5),gcy(6,7)];
  var l4p=[[0,1],[2,3]];
  l4p.forEach(function(p){
    var ya=l8cy[p[0]],yb=l8cy[p[1]],ym=(ya+yb)/2;
    s+=line(xL8+W8+CN/2,ya,xL8+W8+CN/2,yb);
    s+=emptySlot(xL4,ym-CH-CG/2,W4);
    s+=line(xL4+W4,ym,xL4+W4+CN,ym);
  });

  // Left Semis
  var l4cy=[(l8cy[0]+l8cy[1])/2,(l8cy[2]+l8cy[3])/2];
  var ySFL=(l4cy[0]+l4cy[1])/2;
  s+=line(xL4+W4+CN/2,l4cy[0],xL4+W4+CN/2,l4cy[1]);
  s+=emptySlot(xSFL,ySFL-CH-CG/2,WSF);
  s+=line(xSFL+WSF,ySFL,xSFL+WSF+CN,ySFL);

  // Final box
  var yFIN=TH/2-40;
  s+=rect(xFIN,yFIN,WFIN,70,"#1a2200","#fbbf24",6);
  s+=txt(xFIN+WFIN/2,yFIN+14,"🏆 FINAL","#fbbf24",9,"middle");
  s+=txt(xFIN+WFIN/2,yFIN+26,"19 Jul · MetLife","#64748b",8,"middle");
  s+=txt(xFIN+WFIN/2,yFIN+44,"🏆","#fbbf24",18,"middle");
  s+=txt(xFIN+WFIN/2,yFIN+62,"Campeón","#fbbf24",9,"middle");

  // Connect SF-L to Final
  s+=line(xSFL+WSF+CN,ySFL,xFIN,ySFL);
  s+=line(xFIN,ySFL,xFIN,yFIN+35);

  // Right 8vos (mirror)
  var r8p=[[0,1],[2,3],[4,5],[6,7]];
  r8p.forEach(function(p,si){
    var ya=mcy(p[0]),yb=mcy(p[1]),ym=(ya+yb)/2;
    s+=line(xR16,ya,xR16,yb);
    s+=line(xR8+W8,ya,xR16,ya);
    s+=line(xR8+W8,yb,xR16,yb);
    s+=line(xR8+W8+CN/2,ya,xR8+W8+CN/2,yb);
    var sr8=BR8[si];
    if(sr8&&sr8.a){
      s+=rect(xR8,ym-CH-CG/2,W8,CH*2+CG,"#0b1120","#4ade80");
      s+=txt(xR8+5,ym-CG/2-4,sr8.a,"#4ade80",10);
      s+=txt(xR8+5,ym+CH+CG/2-4,sr8.b,"#94a3b8",9);
    } else {
      s+=emptySlot(xR8,ym-CH-CG/2,W8);
    }
    s+=line(xR8,ym,xR8-CN,ym);
  });

  // Right 4tos
  var r8cy=[gcy(0,1),gcy(2,3),gcy(4,5),gcy(6,7)];
  var r4p=[[0,1],[2,3]];
  r4p.forEach(function(p){
    var ya=r8cy[p[0]],yb=r8cy[p[1]],ym=(ya+yb)/2;
    s+=line(xR8-CN/2,ya,xR8-CN/2,yb);
    s+=emptySlot(xR4,ym-CH-CG/2,W4);
    s+=line(xR4,ym,xR4-CN,ym);
  });

  // Right Semis
  var r4cy=[(r8cy[0]+r8cy[1])/2,(r8cy[2]+r8cy[3])/2];
  var ySFR=(r4cy[0]+r4cy[1])/2;
  s+=line(xR4-CN/2,r4cy[0],xR4-CN/2,r4cy[1]);
  s+=emptySlot(xSFR,ySFR-CH-CG/2,WSF);
  s+=line(xSFR,ySFR,xSFR-CN,ySFR);

  // Connect SF-R to Final
  s+=line(xSFR-CN,ySFR,xFIN+WFIN,ySFR);
  s+=line(xFIN+WFIN,ySFR,xFIN+WFIN,yFIN+35);

  var bracketSVG="<svg xmlns='http://www.w3.org/2000/svg' width='"+TW+"' height='"+TH+"' viewBox='0 0 "+TW+" "+TH+"'>"
    +s
    +"</svg>";

  var fix16="<div style='background:#121c30;border-radius:10px;border:2px solid #4ade80;overflow:hidden;margin-top:20px'>"
    +"<div style='padding:12px 13px;border-bottom:1px solid #1e2d45;display:flex;align-items:center;justify-content:space-between'>"
    +"<div style='font-size:15px;font-weight:800;color:#4ade80'>🏆 Bracket 16avos → Final</div>"
    +"<div style='font-size:10px;color:#94a3b8'>28 Jun – 19 Jul · Hora Chile</div></div>"
    +"<div style='overflow-x:auto;padding:12px'>"+bracketSVG+"</div>"
    +"<div style='padding:8px 13px;border-top:1px solid #1e2d45;font-size:10px;color:#64748b'>Slots vacíos se completan a medida que avanza el torneo · Empate: tiempo extra + penales</div>"
    +"</div>";











  var html = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>'
    + '<title>⚽ Mundial 2026 · En Vivo</title><style>' + css + '</style></head><body>'
    + '<div class="header"><div class="inner">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">'
    + '<div style="display:flex;align-items:center;gap:10px;"><span style="font-size:24px;">⚽</span>'
    + '<div><h1 style="font-size:19px;font-weight:800;color:#fff;letter-spacing:-.5px;">MUNDIAL 2026 <span style="color:#4ade80;font-weight:400;font-size:12px;">· TIEMPO REAL</span></h1>'
    + '<p style="font-size:10px;color:#8899aa;">USA · CANADÁ · MÉXICO · 11 Jun – 19 Jul</p></div></div>'
    + '<div style="text-align:right;font-size:9px;"><div style="color:#4ade80;">✅ Actualizado</div><div style="color:#64748b;">' + nowCL + ' Chile</div></div></div>'
    + '<div style="display:flex;gap:10px;margin:12px 0 0;flex-wrap:wrap;">'
    + '<div class="stat-box"><div style="font-size:16px;font-weight:700;color:#4ade80;">' + finished.length + '</div><div style="font-size:9px;color:#8899aa;text-transform:uppercase;">Jugados</div></div>'
    + '<div class="stat-box" style="' + (live.length>0?"background:rgba(248,113,113,.15);border-color:rgba(248,113,113,.4)":"") + '"><div style="font-size:16px;font-weight:700;color:' + (live.length>0?"#f87171":"#4ade80") + ';">' + live.length + (live.length>0?" 🔴":"") + '</div><div style="font-size:9px;color:#8899aa;text-transform:uppercase;">En Vivo</div></div>'
    + '<div class="stat-box"><div style="font-size:16px;font-weight:700;color:#4ade80;">' + todayAll.length + '</div><div style="font-size:9px;color:#8899aa;text-transform:uppercase;">Hoy</div></div>'
    + '<div class="stat-box"><div style="font-size:16px;font-weight:700;color:#4ade80;">' + totalGoals + '</div><div style="font-size:9px;color:#8899aa;text-transform:uppercase;">Goles</div></div>'
    + '</div>'
    + '<div class="tabs">'
    + '<button class="tab active" onclick="showTab(\'hoy\',this)">📅 Hoy</button>'
    + '<button class="tab" onclick="showTab(\'proximos\',this)">🗓 Próximos</button>'
    + '<button class="tab" onclick="showTab(\'resultados\',this)">📋 Resultados</button>'
    + '<button class="tab" onclick="showTab(\'tablas\',this)">📊 Tablas</button>'
    + '<button class="tab" onclick="showTab(\'apuestas\',this)">💰 Apuestas</button>'
    + '</div></div></div>'
    + '<div class="content">'
    // HOY
    + '<div id="hoy" class="pane active">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'
    + '<h2 style="font-size:14px;color:#cbd5e1;">Partidos de hoy · ' + todayCL + ' 🇨🇱</h2>'
    + '<span style="font-size:10px;background:#16a34a22;color:#4ade80;border:1px solid #16a34a44;border-radius:20px;padding:3px 8px;">Hora Chile</span>'
    + '</div>' + hoyHTML + '</div>'
    // PRÓXIMOS
    + '<div id="proximos" class="pane"><h2 style="font-size:14px;color:#cbd5e1;margin-bottom:14px;">🗓 Próximos · Hora Chile</h2>'
    + (proximosHTML || '<div class="empty">No hay próximos disponibles.</div>')
    + '<div style="margin-top:22px;background:#121c30;border:1px solid #1e2d45;border-radius:12px;padding:14px;">'
    + '<h3 style="font-size:12px;color:#94a3b8;margin-bottom:10px;text-transform:uppercase;">🗺 Estructura del torneo</h3>'
    + '<div style="display:flex;flex-direction:column;gap:5px;font-size:12px;">'
    + '<div style="display:flex;justify-content:space-between;padding:8px 10px;background:#0d2a18;border:1px solid #166534;border-radius:7px;"><span style="font-weight:700;">Fase de Grupos</span><span style="color:#4ade80;">🔴 EN CURSO · hasta 27 Jun</span></div>'
    + '<div style="display:flex;justify-content:space-between;padding:8px 10px;background:#121c30;border:1px solid #1e2d45;border-radius:7px;"><span>16avos de Final</span><span style="color:#64748b;">29 Jun – 3 Jul</span></div>'
    + '<div style="display:flex;justify-content:space-between;padding:8px 10px;background:#121c30;border:1px solid #1e2d45;border-radius:7px;"><span>8vos de Final</span><span style="color:#64748b;">5 Jul – 8 Jul</span></div>'
    + '<div style="display:flex;justify-content:space-between;padding:8px 10px;background:#121c30;border:1px solid #1e2d45;border-radius:7px;"><span>Cuartos de Final</span><span style="color:#64748b;">11–12 Jul</span></div>'
    + '<div style="display:flex;justify-content:space-between;padding:8px 10px;background:#121c30;border:1px solid #1e2d45;border-radius:7px;"><span>Semifinales</span><span style="color:#64748b;">15–16 Jul</span></div>'
    + '<div style="display:flex;justify-content:space-between;padding:8px 10px;background:#121c30;border:1px solid #1e2d45;border-radius:7px;"><span style="font-weight:700;color:#fbbf24;">🏆 Final</span><span style="color:#fbbf24;">19 Jul · MetLife, NJ</span></div>'
    + '</div></div></div>'
    // RESULTADOS
    + '<div id="resultados" class="pane"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">'
    + '<h2 style="font-size:14px;color:#cbd5e1;">Resultados</h2><div style="display:flex;align-items:center;flex-wrap:wrap;gap:3px;">' + resAllBtns + '</div></div>'
    + '<div id="r16" style="display:block;">' + resultados16HTML + '</div>'
    + jorBlocks + '</div>'
    // TABLAS
    + '<div id="tablas" class="pane"><div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:14px;">' + grpBtns + '</div>' + tablaBlocks + fix16 + '</div>'
    // APUESTAS
    + '<div id="apuestas" class="pane">'
    + '<div style="background:#1a2200;border:1px solid #3a5a00;border-radius:10px;padding:11px 13px;margin-bottom:14px;"><div style="font-size:12px;color:#86efac;font-weight:700;">⚠️ Análisis al ' + dateCL + ' · ' + finished.length + ' partidos jugados</div></div>'
    + '<h3 style="font-size:12px;color:#4ade80;margin-bottom:9px;text-transform:uppercase;">🏆 Favoritos al título</h3>'
    + '<div style="display:flex;flex-direction:column;gap:7px;margin-bottom:18px;">'
    + favs.map(function(x){return '<div class="card" style="cursor:default;display:flex;align-items:center;gap:11px;"><span style="font-size:22px;">' + x[0] + '</span><div style="flex:1;"><div style="font-weight:700;font-size:13px;">' + x[1] + '</div><div style="font-size:11px;color:#94a3b8;margin-top:2px;">' + x[2] + '</div></div><div style="font-size:17px;font-weight:800;color:#fbbf24;">' + x[3] + '</div></div>';}).join("")
    + '</div><h3 style="font-size:12px;color:#f87171;margin:0 0 9px;text-transform:uppercase;">⚠️ Cuidado al apostar</h3>'
    + '<div style="display:flex;flex-direction:column;gap:7px;margin-bottom:20px;">'
    + bads.map(function(x){return '<div class="card" style="cursor:default;background:#1a0808;border-color:#3a1010;"><div style="font-weight:700;font-size:12px;color:#fca5a5;">' + x[0] + ' ' + x[1] + '</div><div style="font-size:11px;color:#8a7070;margin-top:2px;">' + x[2] + '</div></div>';}).join("")
    + '</div>' + tipsHTML + contHTML
    + '<a class="jugabet" href="https://www.jugabet.cl" target="_blank">🎰 Apostar ahora en Jugabet Chile →</a>'
    + '<p style="font-size:10px;color:#334155;text-align:center;margin-top:8px;">Juega con responsabilidad. +18 años. Solo para residentes en Chile.</p>'
    + '</div>'
    + '</div>'
    + '<div style="text-align:center;padding:14px;font-size:10px;color:#334155;border-top:1px solid #1e2d45;">Datos al ' + dateCL + ' · ' + finished.length + ' partidos · Mundial 2026 · 🇨🇱 Hora Chile</div>'
    + '<script>' + js + '<\/script>'
    + '</body></html>';

  fs.writeFileSync("index.html", html);
  console.log("OK — " + finished.length + " partidos, " + totalGoals + " goles");
}

main().catch(function(e){ console.error("ERROR:", e.message); process.exit(1); });

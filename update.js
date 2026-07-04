const https = require("https");
const fs = require("fs");
const API_KEY    = "8245823280194f62b10dfbbdb08216d5";
const CACHE_FILE = "stats_cache.json";

// Carga cache de estadÃ­sticas (se actualiza cada vez que hay partidos nuevos)
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

// Mapea estadÃ­sticas ESPN â†’ formato cache
function mapESPNStats(summary, homeTeam, awayTeam) {
  var teams = (summary.boxscore && summary.boxscore.teams) || [];
  if (teams.length < 2) return [];
  return teams.map(function(t) {
    var sm = {};
    (t.statistics || []).forEach(function(s) { sm[s.name] = s.displayValue !== undefined ? s.displayValue : String(s.value || 0); });
    // possessionPct viene como "54.6", lo convertimos a "54.6%"
    var poss = sm.possessionPct ? sm.possessionPct + "%" : "0%";
    // passPct viene como "0.9" (fracciÃ³n), lo convertimos a "90%"
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

// Mapea eventos ESPN â†’ formato cache (goles + tarjetas)
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

// Nombres y banderas â€” clave: nombre exacto que devuelve la API
const FLAGS = {
  "Mexico":"ðŸ‡²ðŸ‡½","South Africa":"ðŸ‡¿ðŸ‡¦","Korea Republic":"ðŸ‡°ðŸ‡·","Czechia":"ðŸ‡¨ðŸ‡¿",
  "Canada":"ðŸ‡¨ðŸ‡¦","Bosnia and Herzegovina":"ðŸ‡§ðŸ‡¦","Qatar":"ðŸ‡¶ðŸ‡¦","Switzerland":"ðŸ‡¨ðŸ‡­",
  "Brazil":"ðŸ‡§ðŸ‡·","Morocco":"ðŸ‡²ðŸ‡¦","Haiti":"ðŸ‡­ðŸ‡¹","Scotland":"ðŸ´ó §ó ¢ó ³ó £ó ´ó ¿",
  "USA":"ðŸ‡ºðŸ‡¸","United States":"ðŸ‡ºðŸ‡¸","Paraguay":"ðŸ‡µðŸ‡¾","Australia":"ðŸ‡¦ðŸ‡º","Turkey":"ðŸ‡¹ðŸ‡·",
  "Germany":"ðŸ‡©ðŸ‡ª","CuraÃ§ao":"ðŸ‡¨ðŸ‡¼","Curacao":"ðŸ‡¨ðŸ‡¼","CÃ´te d'Ivoire":"ðŸ‡¨ðŸ‡®","Ecuador":"ðŸ‡ªðŸ‡¨",
  "Netherlands":"ðŸ‡³ðŸ‡±","Japan":"ðŸ‡¯ðŸ‡µ","Sweden":"ðŸ‡¸ðŸ‡ª","Tunisia":"ðŸ‡¹ðŸ‡³",
  "IR Iran":"ðŸ‡®ðŸ‡·","New Zealand":"ðŸ‡³ðŸ‡¿","Belgium":"ðŸ‡§ðŸ‡ª","Egypt":"ðŸ‡ªðŸ‡¬",
  "Spain":"ðŸ‡ªðŸ‡¸","Cabo Verde":"ðŸ‡¨ðŸ‡»","Cape Verde":"ðŸ‡¨ðŸ‡»","Cape Verde Islands":"ðŸ‡¨ðŸ‡»","Saudi Arabia":"ðŸ‡¸ðŸ‡¦","Uruguay":"ðŸ‡ºðŸ‡¾",
  "France":"ðŸ‡«ðŸ‡·","Senegal":"ðŸ‡¸ðŸ‡³","Norway":"ðŸ‡³ðŸ‡´","Iraq":"ðŸ‡®ðŸ‡¶",
  "Argentina":"ðŸ‡¦ðŸ‡·","Algeria":"ðŸ‡©ðŸ‡¿","Austria":"ðŸ‡¦ðŸ‡¹","Jordan":"ðŸ‡¯ðŸ‡´",
  "Portugal":"ðŸ‡µðŸ‡¹","DR Congo":"ðŸ‡¨ðŸ‡©","Uzbekistan":"ðŸ‡ºðŸ‡¿","Colombia":"ðŸ‡¨ðŸ‡´",
  "England":"ðŸ´ó §ó ¢ó ¥ó ®ó §ó ¿","Croatia":"ðŸ‡­ðŸ‡·","Ghana":"ðŸ‡¬ðŸ‡­","Panama":"ðŸ‡µðŸ‡¦","South Korea":"ðŸ‡°ðŸ‡·","Korea DPR":"ðŸ‡°ðŸ‡µ","Bosnia-Herzegovina":"ðŸ‡§ðŸ‡¦",
};
const NAMES = {
  "Mexico":"MÃ©xico","South Africa":"SudÃ¡frica","Korea Republic":"Corea del Sur","Czechia":"Rep. Checa",
  "Canada":"CanadÃ¡","Bosnia and Herzegovina":"Bosnia-Herz.","Switzerland":"Suiza","Brazil":"Brasil",
  "Morocco":"Marruecos","Haiti":"HaitÃ­","Scotland":"Escocia","USA":"EE.UU.","United States":"EE.UU.",
  "Turkey":"TurquÃ­a","Germany":"Alemania","CÃ´te d'Ivoire":"Costa de Marfil","Netherlands":"PaÃ­ses Bajos",
  "Japan":"JapÃ³n","Sweden":"Suecia","Tunisia":"TÃºnez","IR Iran":"IrÃ¡n","New Zealand":"Nueva Zelanda",
  "Belgium":"BÃ©lgica","Spain":"EspaÃ±a","Saudi Arabia":"Arabia Saudita","France":"Francia",
  "Norway":"Noruega","Algeria":"Argelia","Jordan":"Jordania","DR Congo":"RD Congo",
  "Uzbekistan":"UzbekistÃ¡n","England":"Inglaterra","Croatia":"Croacia","Ecuador":"Ecuador",
  "CuraÃ§ao":"Curazao","Curacao":"Curazao","Paraguay":"Paraguay","Australia":"Australia",
  "Senegal":"Senegal","Iraq":"Iraq","Uruguay":"Uruguay","Egypt":"Egipto","Ghana":"Ghana",
  "Argentina":"Argentina","Austria":"Austria","Colombia":"Colombia","Panama":"PanamÃ¡",
  "Cabo Verde":"Cabo Verde","Cape Verde":"Cabo Verde","Cape Verde Islands":"Cabo Verde",
  "Portugal":"Portugal","Qatar":"Qatar","South Korea":"Corea del Sur","Korea DPR":"Corea del Norte","Bosnia-Herzegovina":"Bosnia-Herz.",
};
const n = t => (t && NAMES[t]) || t || "?";
const f = t => (t && FLAGS[t]) || "ðŸ³";

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

// â”€â”€ ANÃLISIS â€” clave: "NombreAPI_NombreAPI" exacto â”€â”€
var ANAL = {};

// J1
ANAL["Mexico_South Africa"]          = {g:"MÃ©xico ganÃ³ 2-0 a SudÃ¡frica. QuiÃ±ones y JimÃ©nez marcaron.",go:"RaÃºl JimÃ©nez (MÃ©xico) con gol y buen partido.",fi:"QuiÃ±ones (MÃ©xico) â€” gol tempranero y mucha presiÃ³n.",ap:"Partido terminado Â· MÃ©xico lidera con 3 pts",pr:"âœ… MÃ©xico 2-0"};
ANAL["Korea Republic_Czechia"]       = {g:"Corea del Sur remontÃ³ 2-1 a Rep. Checa. Hwang In-beom y Oh Hyeon-gyu.",go:"Oh Hyeon-gyu (Corea) marcÃ³ el gol decisive al 80min.",fi:"Hwang In-beom (Corea) â€” el mejor del partido.",ap:"Partido terminado Â· Corea del Sur con 3 pts",pr:"âœ… Corea 2-1"};
ANAL["Canada_Bosnia and Herzegovina"]= {g:"CanadÃ¡ empatÃ³ 1-1 con Bosnia. Lukic adelantÃ³ a Bosnia, Larin igualÃ³.",go:"Cyle Larin (CanadÃ¡) rescatÃ³ el punto al 78min.",fi:"Larin (CanadÃ¡) â€” el goleador mÃ¡s en forma del equipo.",ap:"Partido terminado Â· Empate 1-1",pr:"âœ… Empate 1-1"};
ANAL["USA_Paraguay"]                 = {g:"EE.UU. goleÃ³ 4-1 a Paraguay. Balogun doblete + Reyna.",go:"Folarin Balogun (EE.UU.) con doblete devastador.",fi:"Balogun (EE.UU.) â€” el mÃ¡ximo goleador del torneo hasta J1.",ap:"Partido terminado Â· EE.UU. lidera con 3 pts",pr:"âœ… EE.UU. 4-1"};
ANAL["Qatar_Switzerland"]            = {g:"Qatar igualÃ³ 1-1 con Suiza. Embolo de penal, autogol de Muheim.",go:"Breel Embolo (Suiza) de penal. Autogol de Muheim para Qatar.",fi:"Embolo (Suiza) â€” el mÃ¡s incisivo del partido.",ap:"Partido terminado Â· Empate 1-1",pr:"âœ… Empate 1-1"};
ANAL["Brazil_Morocco"]               = {g:"Brasil empatÃ³ 1-1 con Marruecos. Saibari adelantÃ³, VinÃ­cius igualÃ³.",go:"VinÃ­cius Jr (Brasil) igualÃ³ al 32min. Saibari (Marruecos) marcÃ³ primero.",fi:"VinÃ­cius Jr (Brasil) â€” el gol que rescatÃ³ el punto.",ap:"Partido terminado Â· Empate 1-1",pr:"âœ… Empate 1-1"};
ANAL["Haiti_Scotland"]               = {g:"Escocia ganÃ³ 1-0 a HaitÃ­ con gol de McGinn al 28min.",go:"John McGinn (Escocia) â€” el Ãºnico gol del partido.",fi:"McGinn (Escocia) â€” gol y liderazgo en el mediocampo.",ap:"Partido terminado Â· Escocia con 3 pts",pr:"âœ… Escocia 1-0"};
ANAL["Australia_Turkey"]             = {g:"Australia ganÃ³ 2-0 a TurquÃ­a. Irankunda y Metcalfe.",go:"Irankunda (Australia) al 27min. Metcalfe al 75min.",fi:"Nestory Irankunda (Australia) â€” joven y explosivo.",ap:"Partido terminado Â· Australia con 3 pts",pr:"âœ… Australia 2-0"};
ANAL["Germany_CuraÃ§ao"]              = {g:"Alemania goleÃ³ 7-1 a Curazao. Havertz doblete, Musiala, Schlotterbeck y mÃ¡s.",go:"Kai Havertz (Alemania) con doblete. Comenencia marcÃ³ para Curazao.",fi:"Jamal Musiala (Alemania) â€” el mÃ¡s creativo del torneo.",ap:"Partido terminado Â· Alemania aplasta",pr:"âœ… Alemania 7-1"};
ANAL["Germany_Ivory Coast"]           = {g:"Alemania ganÃ³ 2-1 a Costa de Marfil en partido mÃ¡s ajustado de lo esperado.",go:"Alemania marcÃ³ dos goles. Costa de Marfil descontÃ³.",fi:"Jamal Musiala (Alemania) â€” el mÃ¡s creativo.",ap:"Partido terminado Â· Alemania 6 pts",pr:"âœ… Alemania 2-1"};
ANAL["CÃ´te d'Ivoire_Ecuador"]        = {g:"Costa de Marfil ganÃ³ 1-0 a Ecuador con gol de Amad Diallo al 90min.",go:"Amad Diallo (Costa de Marfil) â€” gol agÃ³nico al 90min.",fi:"Amad Diallo (Costa de Marfil) â€” el hÃ©roe de la jornada.",ap:"Partido terminado Â· Costa de Marfil con 3 pts",pr:"âœ… C. Marfil 1-0"};
ANAL["Netherlands_Japan"]            = {g:"JapÃ³n empatÃ³ 2-2 con PaÃ­ses Bajos con gol de Kamada al 89min.",go:"Daichi Kamada (JapÃ³n) empatÃ³ al 89min. Van Dijk y Summerville por PaÃ­ses Bajos.",fi:"Daichi Kamada (JapÃ³n) â€” el gol mÃ¡s dramÃ¡tico de J1.",ap:"Partido terminado Â· Empate 2-2",pr:"âœ… Empate 2-2"};
ANAL["Sweden_Tunisia"]               = {g:"Suecia goleÃ³ 5-1 a TÃºnez. GyÃ¶keres, Isak, Svanberg.",go:"Viktor GyÃ¶keres (Suecia) marcÃ³ y fue el mejor del partido.",fi:"Viktor GyÃ¶keres (Suecia) â€” imparable. El goleador del torneo.",ap:"Partido terminado Â· Suecia lidera con 3 pts",pr:"âœ… Suecia 5-1"};
ANAL["Spain_Cabo Verde"]             = {g:"EspaÃ±a empatÃ³ 0-0 con Cabo Verde. Gran decepciÃ³n del campeÃ³n Euro.",go:"Nadie anotÃ³. EspaÃ±a sin ideas ofensivas.",fi:"Nadie destacÃ³. EspaÃ±a muy por debajo de su nivel.",ap:"Partido terminado Â· Empate decepcionante",pr:"âœ… Empate 0-0"};
ANAL["Saudi Arabia_Uruguay"]         = {g:"Arabia Saudita igualÃ³ 1-1 con Uruguay. Al Amri y AraÃºjo.",go:"AraÃºjo (Uruguay) igualÃ³ al 80min de cabeza.",fi:"AraÃºl AraÃºjo (Uruguay) â€” el gol que rescatÃ³ el punto.",ap:"Partido terminado Â· Empate 1-1",pr:"âœ… Empate 1-1"};
ANAL["Belgium_Egypt"]                = {g:"BÃ©lgica empatÃ³ 1-1 con Egipto. Autogol y gol de Emam Ashour.",go:"Emam Ashour (Egipto) marcÃ³ primero. Autogol de M.Hany empatÃ³.",fi:"Emam Ashour (Egipto) â€” la sorpresa de la jornada.",ap:"Partido terminado Â· Empate frustrante para BÃ©lgica",pr:"âœ… Empate 1-1"};
ANAL["IR Iran_New Zealand"]          = {g:"IrÃ¡n empatÃ³ 2-2 con Nueva Zelanda. E. Just marcÃ³ dos veces.",go:"E. Just (Nueva Zelanda) doblete. Rezaeian y Mohebbi (IrÃ¡n).",fi:"E. Just (Nueva Zelanda) â€” la revelaciÃ³n de la jornada.",ap:"Partido terminado Â· Empate 2-2",pr:"âœ… Empate 2-2"};
ANAL["France_Senegal"]               = {g:"Francia ganÃ³ 3-1 a Senegal. MbappÃ© doblete.",go:"Kylian MbappÃ© (Francia) con dos goles. Barcola tambiÃ©n.",fi:"Kylian MbappÃ© (Francia) â€” mÃ¡ximo goleador histÃ³rico de Francia.",ap:"Partido terminado Â· Francia lidera con 3 pts",pr:"âœ… Francia 3-1"};
ANAL["Iraq_Norway"]                  = {g:"Noruega goleÃ³ 4-1 a Iraq. Haaland doblete en debut mundialista.",go:"Erling Haaland (Noruega) con doblete. Ã˜stigÃ¥rd tambiÃ©n anotÃ³.",fi:"Erling Haaland (Noruega) â€” debut histÃ³rico en Mundiales.",ap:"Partido terminado Â· Noruega lidera con 3 pts",pr:"âœ… Noruega 4-1"};
ANAL["Argentina_Algeria"]            = {g:"Argentina goleÃ³ 3-0 a Argelia. Messi hat-trick histÃ³rico.",go:"Lionel Messi (Argentina) con hat-trick. Iguala rÃ©cord de Klose.",fi:"Lionel Messi (Argentina) â€” el mejor del torneo hasta ahora.",ap:"Partido terminado Â· Argentina lidera con 3 pts",pr:"âœ… Argentina 3-0"};
ANAL["Austria_Jordan"]               = {g:"Austria ganÃ³ 3-1 a Jordania. Schmid y Arnautovic de penal.",go:"Arnautovic (Austria) de penal. Ali Olwan marcÃ³ el primero histÃ³rico de Jordania.",fi:"R. Schmid (Austria) â€” gol y muy activo en todo el partido.",ap:"Partido terminado Â· Austria con 3 pts",pr:"âœ… Austria 3-1"};
ANAL["Portugal_DR Congo"]            = {g:"Portugal empatÃ³ 1-1 con RD Congo. Debut muy pobre de Cristiano.",go:"J. Neves (Portugal) al 6min. Wissa (RD Congo) igualÃ³ al 38min.",fi:"Wissa (RD Congo) â€” el hÃ©roe africano. Cristiano sin tiros.",ap:"Partido terminado Â· Empate decepcionante",pr:"âœ… Empate 1-1"};
ANAL["Uzbekistan_Colombia"]          = {g:"Colombia goleÃ³ 3-1 a UzbekistÃ¡n. Luis DÃ­az y Campaz.",go:"Luis DÃ­az (Colombia) al 65min. D. MuÃ±oz al 40min. Campaz al 90+9min.",fi:"Luis DÃ­az (Colombia) â€” extremo del Liverpool en estado de gracia.",ap:"Partido terminado Â· Colombia lidera el Grupo K",pr:"âœ… Colombia 3-1"};
ANAL["England_Croatia"]              = {g:"Inglaterra goleÃ³ 4-2 a Croacia. Kane doblete. Bellingham y Rashford.",go:"Harry Kane (Inglaterra) con doblete. Baturina y Musa (Croacia).",fi:"Jude Bellingham (Inglaterra) â€” determinante en el 3er gol.",ap:"Partido terminado Â· Inglaterra lidera con 3 pts",pr:"âœ… Inglaterra 4-2"};
ANAL["Ghana_Panama"]                 = {g:"Ghana ganÃ³ 1-0 a PanamÃ¡ con gol agÃ³nico de Yirenkyi al 94min.",go:"Yirenkyi (Ghana) â€” el gol mÃ¡s tardÃ­o del torneo hasta ahora.",fi:"Yirenkyi (Ghana) â€” el hÃ©roe de la jornada africana.",ap:"Partido terminado Â· Ghana con 3 pts",pr:"âœ… Ghana 1-0"};

// J2
ANAL["Czechia_South Africa"]         = {g:"Rep. Checa empatÃ³ 1-1 con SudÃ¡frica. KrejÄÃ­ y Mokoena de penal.",go:"KrejÄÃ­ (Rep. Checa) al 22min. Mokoena (SudÃ¡frica) de penal al 82min.",fi:"Mokoena (SudÃ¡frica) â€” el penal que rescatÃ³ el punto.",ap:"Partido terminado Â· Empate 1-1",pr:"âœ… Empate 1-1"};
ANAL["Mexico_Korea Republic"]        = {g:"MÃ©xico ganÃ³ 1-0 a Corea del Sur con gol de Luis Romo al 50min. MÃ©xico clasificado.",go:"Luis Romo (MÃ©xico) â€” el gol decisive que clasifica al Tri.",fi:"Guillermo Ochoa (MÃ©xico) â€” valla invicta en 2 partidos.",ap:"Partido terminado Â· MÃ©xico clasificado 6 pts",pr:"âœ… MÃ©xico 1-0"};
ANAL["Switzerland_Bosnia and Herzegovina"] = {g:"Suiza goleÃ³ 4-1 a Bosnia. Manzambi doblete desde el banco.",go:"Manzambi (Suiza) doblete al 74min y 90+5min. Xhaka de penal.",fi:"Manzambi (Suiza) â€” entrÃ³ desde el banco y decidiÃ³ el partido.",ap:"Partido terminado Â· Suiza con 4 pts lidera",pr:"âœ… Suiza 4-1"};
ANAL["Switzerland_Bosnia"] = ANAL["Switzerland_Bosnia and Herzegovina"];
ANAL["Switzerland_Bosnia-Herzegovina"]  = ANAL["Switzerland_Bosnia and Herzegovina"];
ANAL["Switzerland_Bosnia"]              = ANAL["Switzerland_Bosnia and Herzegovina"];
ANAL["Canada_Qatar"]                 = {g:"CanadÃ¡ goleÃ³ 6-0 a Qatar. La mayor goleada del torneo. David, Buchanan, Larin doblete, Osorio, Davies.",go:"Jonathan David (CanadÃ¡) abriÃ³ el marcador. Larin con doblete.",fi:"Alphonso Davies (CanadÃ¡) â€” gol y asistencia. El mÃ¡s rÃ¡pido del torneo.",ap:"Partido terminado Â· CanadÃ¡ con 4 pts",pr:"âœ… CanadÃ¡ 6-0"};
ANAL["Morocco_Scotland"]             = {g:"Marruecos ganÃ³ 1-0 a Escocia con gol de Saibari al 67min.",go:"Saibari (Marruecos) â€” el gol que da el liderato del Grupo C.",fi:"Achraf Hakimi (Marruecos) â€” el mÃ¡s activo por banda.",ap:"Partido terminado Â· Marruecos lidera Grupo C",pr:"âœ… Marruecos 1-0"};
ANAL["Brazil_Haiti"]                 = {g:"Brasil goleÃ³ 3-0 a HaitÃ­. Cunha doblete y VinÃ­cius Jr.",go:"Matheus Cunha (Brasil) doblete al 23min y 36min. VinÃ­cius al 45+3min.",fi:"Matheus Cunha (Brasil) â€” el despertar del scratch.",ap:"Partido terminado Â· Brasil con 4 pts",pr:"âœ… Brasil 3-0"};
ANAL["USA_Australia"]                = {g:"EE.UU. ganÃ³ 2-0 a Australia y se clasificÃ³ a 16avos. Autogol + Freeman.",go:"Autogol de Burgess al 11min. A. Freeman al 38min.",fi:"A. Freeman (EE.UU.) â€” gol y rendimiento destacado.",ap:"Partido terminado Â· EE.UU. clasificado 6 pts",pr:"âœ… EE.UU. 2-0"};
ANAL["Turkey_Paraguay"]              = {g:"Paraguay ganÃ³ 1-0 a TurquÃ­a con AlmirÃ³n expulsado al inicio. Galarza al 2min.",go:"M. Galarza (Paraguay) al 2min. TurquÃ­a con 10 hombres todo el partido.",fi:"Galarza (Paraguay) â€” el gol hÃ©roe al minuto 2.",ap:"Partido terminado Â· TurquÃ­a eliminada",pr:"âœ… Paraguay 1-0"};
ANAL["Germany_CÃ´te d'Ivoire"]        = {g:"Alemania ganÃ³ 2-1 a Costa de Marfil en partido mÃ¡s ajustado de lo esperado.",go:"Alemania marcÃ³ dos goles. Costa de Marfil descontÃ³.",fi:"Jamal Musiala (Alemania) â€” el mÃ¡s creativo.",ap:"Partido terminado Â· Alemania 6 pts",pr:"âœ… Alemania 2-1"};
ANAL["Germany_CÃ´te d'Ivoire"]         = ANAL["Germany_CÃ´te d'Ivoire"];
ANAL["Germany_Ivory Coast"]           = ANAL["Germany_CÃ´te d'Ivoire"];
ANAL["Germany_CÃ´te d\'Ivoire"]       = ANAL["Germany_CÃ´te d'Ivoire"];
ANAL["Ecuador_CuraÃ§ao"]              = {g:"Ecuador empatÃ³ 0-0 con Curazao. DecepciÃ³n total. Ecuador casi eliminado.",go:"Nadie anotÃ³. Ecuador sin ideas ofensivas durante 90min.",fi:"MoisÃ©s Caicedo (Ecuador) â€” el Ãºnico que intentÃ³.",ap:"Partido terminado Â· Ecuador en serios problemas",pr:"âœ… Empate 0-0"};
ANAL["Netherlands_Sweden"]           = {g:"PaÃ­ses Bajos goleÃ³ 5-1 a Suecia. Xavi Simons doblete. GyÃ¶keres marcÃ³ el descuento.",go:"Xavi Simons (PaÃ­ses Bajos) doblete espectacular. GyÃ¶keres (Suecia) marcÃ³.",fi:"Xavi Simons (PaÃ­ses Bajos) â€” figura del partido con 2 goles.",ap:"Partido terminado Â· PaÃ­ses Bajos con 4 pts",pr:"âœ… PaÃ­ses Bajos 5-1"};

// J2 pendientes / prÃ³ximos con anÃ¡lisis
ANAL["Tunisia_Japan"]                = {g:"JapÃ³n parte como claro favorito. TÃºnez fue goleado 1-5 por Suecia.",go:"Daichi Kamada (JapÃ³n) â€” marcÃ³ el 2-2 al 89min vs PaÃ­ses Bajos. Ritsu Doan peligroso.",fi:"Takumi Minamino (JapÃ³n) â€” motor junto a Kamada.",ap:"JapÃ³n gana Â· MÃ¡s de 1.5 goles Â· Kamada anota. Cuota est: 2.2x",pr:"Pred: JapÃ³n 2-0"};
ANAL["Spain_Saudi Arabia"]           = {g:"EspaÃ±a obligada a reaccionar tras el 0-0 vs Cabo Verde. Arabia Saudita igualÃ³ con Uruguay.",go:"Pedri y Morata (EspaÃ±a). Al-Dawsari (Arabia Saudita) en contraataque.",fi:"Pedri (EspaÃ±a) â€” el creativo que EspaÃ±a necesita despertar.",ap:"EspaÃ±a gana Â· Pedri con asistencia. Cuota est: 1.9x",pr:"Pred: EspaÃ±a 2-0"};
ANAL["Belgium_Iran"]                  = {g:"BÃ©lgica igualÃ³ 1-1 con Egipto en J1. IrÃ¡n cediÃ³ 2-2 con Nueva Zelanda. Partido parejo entre dos equipos irregulares.",go:"Romelu Lukaku (BÃ©lgica) â€” si estÃ¡ en forma es letal. Mehdi Taremi (IrÃ¡n) referente ofensivo.",fi:"Kevin De Bruyne (BÃ©lgica) â€” si aparece cambia el partido.",ap:"BÃ©lgica gana por la mÃ­nima Â· Menos de 3 goles. Cuota est: 2.3x",pr:"Pred: BÃ©lgica 1-0"};
ANAL["Belgium_IR Iran"]               = ANAL["Belgium_Iran"];
ANAL["Belgium_Islamic Republic of Iran"] = ANAL["Belgium_Iran"];
ANAL["Uruguay_Cape Verde Islands"]    = {g:"Uruguay igualÃ³ 1-1 con Arabia Saudita (AraÃºjo 80min). Cabo Verde sorprendiÃ³ empate 0-0 con EspaÃ±a. Uruguay tiene mÃ¡s historia y calidad.",go:"Darwin NÃºÃ±ez (Uruguay) â€” el mÃ¡s peligroso en ataque.",fi:"Federico Valverde (Uruguay) â€” motor del equipo celeste.",ap:"Uruguay gana Â· Darwin NÃºÃ±ez anota. Cuota est: 2.1x",pr:"Pred: Uruguay 2-0"};
ANAL["Uruguay_Cabo Verde"]            = ANAL["Uruguay_Cape Verde Islands"];
ANAL["Uruguay_Cape Verde"]            = ANAL["Uruguay_Cape Verde Islands"];
ANAL["Uruguay_Cabo Verde Islands"]    = ANAL["Uruguay_Cape Verde Islands"];
ANAL["New Zealand_Egypt"]            = {g:"Nueva Zelanda cediÃ³ 2-2 con IrÃ¡n. Egipto empatÃ³ 1-1 con BÃ©lgica. Partido parejo.",go:"Chris Wood (Nueva Zelanda). Omar Marmoush (Egipto) viene de gran temporada.",fi:"Chris Wood (Nueva Zelanda) â€” delantero referente.",ap:"Empate o Egipto gana Â· Menos de 2.5 goles. Cuota est: 2.0x",pr:"Pred: Egipto 1-0"};
ANAL["Argentina_Austria"]            = {g:"Argentina viene de 3-0 a Argelia con hat-trick de Messi. Austria ganÃ³ 3-1 a Jordania.",go:"Messi (Argentina) â€” 16 goles mundiales. Arnautovic (Austria) peligroso.",fi:"Lionel Messi (Argentina) â€” el mejor de todos los tiempos.",ap:"Argentina gana Â· Messi anota Â· MÃ¡s de 2.5 goles. Cuota est: 2.0x",pr:"Pred: Argentina 2-0"};
ANAL["France_Iraq"]                  = {g:"Francia viene de 3-1 a Senegal. Iraq perdiÃ³ 1-4 con Noruega. Francia debe golear.",go:"MbappÃ© (Francia) â€” mÃ¡s en forma del torneo. Barcola tambiÃ©n marcÃ³.",fi:"Kylian MbappÃ© (Francia) â€” goleador histÃ³rico de Francia.",ap:"Francia gana +2 goles Â· MbappÃ© anota. Cuota est: 1.8x",pr:"Pred: Francia 3-0"};
ANAL["Norway_Senegal"]               = {g:"Noruega goleÃ³ 4-1 a Iraq. Senegal perdiÃ³ 1-3 con Francia. Noruega favorita.",go:"Erling Haaland (Noruega) â€” doblete J1, imparable. Sadio ManÃ© (Senegal).",fi:"Erling Haaland (Noruega) â€” el mÃ¡s letal del torneo.",ap:"Noruega gana Â· Haaland anota Â· MÃ¡s de 2.5 goles. Cuota est: 1.9x",pr:"Pred: Noruega 2-1"};
ANAL["Jordan_Algeria"]               = {g:"Ambas perdieron J1. Partido entre los dos casi eliminados del Grupo J.",go:"Ali Olwan (Jordania) â€” marcÃ³ primer gol histÃ³rico de Jordania en un Mundial.",fi:"Ali Olwan (Jordania) â€” el autor del gol histÃ³rico.",ap:"Empate o Jordania gana Â· Menos de 2.5 goles. Cuota est: 2.5x",pr:"Pred: Empate 1-1"};
ANAL["Portugal_Uzbekistan"]          = {g:"Portugal decepcionÃ³ 1-1 con RD Congo. UzbekistÃ¡n perdiÃ³ 1-3 con Colombia. Portugal obligado.",go:"Cristiano Ronaldo (Portugal) â€” necesita despertar. Bruno Fernandes creativo.",fi:"Bruno Fernandes (Portugal) â€” el mÃ¡s dinÃ¡mico. Si aparece, Portugal gana.",ap:"Portugal gana Â· Bruno Fernandes anota o asiste. Cuota est: 1.7x",pr:"Pred: Portugal 3-0"};
ANAL["England_Ghana"]                = {g:"Inglaterra goleÃ³ 4-2 a Croacia. Ghana ganÃ³ 1-0 a PanamÃ¡ al 94min. Inglaterra favorita.",go:"Harry Kane (Inglaterra) â€” doblete J1. Mohammed Kudus (Ghana) peligro africano.",fi:"Jude Bellingham (Inglaterra) â€” puede marcar la diferencia.",ap:"Inglaterra gana Â· Kane anota Â· MÃ¡s de 2.5 goles. Cuota est: 1.8x",pr:"Pred: Inglaterra 2-0"};
ANAL["Panama_Croatia"]               = {g:"PanamÃ¡ perdiÃ³ 0-1. Croacia perdiÃ³ 2-4. Ambos de vida o muerte.",go:"Ismael DÃ­az (PanamÃ¡). Ivan Perisic (Croacia) si juega.",fi:"Luka Modric (Croacia) â€” su Ãºltimo Mundial. Puede liderar la reacciÃ³n.",ap:"Croacia gana Â· Modric con asistencia. Cuota est: 2.2x",pr:"Pred: Croacia 2-0"};
ANAL["Colombia_DR Congo"]            = {g:"Colombia goleÃ³ 3-1 a UzbekistÃ¡n. RD Congo empatÃ³ 1-1 con Portugal sorprendiendo a todos. El Congo tiene a Wissa (Brentford) y Aaron Wan-Bissaka como figuras. Colombia favorita pero debe cuidarse del contragolpe congoleÃ±o.",go:"Luis DÃ­az (Colombia) â€” el mÃ¡s desequilibrante. James RodrÃ­guez como cerebro creativo. Yoane Wissa (RD Congo) ya demostrÃ³ su nivel vs Portugal.",fi:"Luis DÃ­az (Colombia) â€” extremo del Liverpool en estado de gracia. Si aparece, Colombia gana cÃ³modo.",ap:"Colombia gana Â· Luis DÃ­az anota Â· MÃ¡s de 1.5 goles. Cuota est: 1.9x",pr:"Pred: Colombia 2-0"};
ANAL["Colombia_Congo DR"]            = ANAL["Colombia_DR Congo"];
ANAL["Colombia_Republic of Congo"]   = ANAL["Colombia_DR Congo"];
ANAL["Colombia_Democratic Republic of Congo"] = ANAL["Colombia_DR Congo"];
ANAL["Colombia_Congo"]               = ANAL["Colombia_DR Congo"];


// â”€â”€ J3 â”€â”€
ANAL["Switzerland_Canada"]           = {g:"Suiza lidera Grupo B con 4 pts. CanadÃ¡ tambiÃ©n con 4 pts. Partido decisivo por el primer lugar. Suiza viene de 4-1 a Bosnia, CanadÃ¡ de 6-0 a Qatar.",go:"Breel Embolo y Granit Xhaka (Suiza). Jonathan David y Alphonso Davies (CanadÃ¡).",fi:"Alphonso Davies (CanadÃ¡) â€” el mÃ¡s explosivo. Si tiene espacio, Suiza no lo para.",ap:"Partido muy parejo Â· Ambos clasificados Â· En juego el 1er lugar. Cuota empate: 3.2x",pr:"Pred: Empate 1-1"};
ANAL["Canada_Switzerland"]           = ANAL["Switzerland_Canada"];
ANAL["Bosnia and Herzegovina_Qatar"] = {g:"Bosnia-Herz. y Qatar ambos en el fondo del Grupo B. Bosnia con 1 pt, Qatar con 1 pt. Partido entre eliminados casi seguros.",go:"Edin DÅ¾eko (Bosnia) â€” Ãºltimo chance. Almoez Ali (Qatar) el mÃ¡s peligroso.",fi:"DÅ¾eko (Bosnia) â€” leyenda histÃ³rica del equipo. Su Ãºltimo Mundial.",ap:"Bosnia gana Â· DÅ¾eko anota. Cuota est: 2.0x",pr:"Pred: Bosnia 2-1"};
ANAL["Bosnia-Herzegovina_Qatar"] = ANAL["Bosnia and Herzegovina_Qatar"];
ANAL["Bosnia_Qatar"]                 = ANAL["Bosnia and Herzegovina_Qatar"];
ANAL["Qatar_Bosnia and Herzegovina"] = ANAL["Bosnia and Herzegovina_Qatar"];
ANAL["Qatar_Bosnia"]                 = ANAL["Bosnia and Herzegovina_Qatar"];
ANAL["Morocco_Haiti"]                = {g:"Marruecos lidera Grupo C con 4 pts. HaitÃ­ sin puntos y ya eliminada. Marruecos debe golear para mejorar diferencia de goles.",go:"Hakimi, Ziyech, Saibari (Marruecos). HaitÃ­ sin nivel para competir.",fi:"Hakim Ziyech (Marruecos) â€” regresa como titular. Letal en ataque.",ap:"Marruecos gana amplio Â· MÃ¡s de 3.5 goles. Cuota est: 1.7x",pr:"Pred: Marruecos 4-0"};
ANAL["Haiti_Morocco"]                = ANAL["Morocco_Haiti"];
ANAL["Scotland_Brazil"]              = {g:"Brasil con 4 pts busca 1er lugar del Grupo C. Escocia con 3 pts tambiÃ©n quiere liderar. El partido mÃ¡s atractivo del 24 Jun.",go:"VinÃ­cius Jr y Cunha (Brasil). McGinn y Adams (Escocia).",fi:"VinÃ­cius Jr (Brasil) â€” el mÃ¡s desequilibrante. Si aparece, Brasil gana.",ap:"Brasil gana Â· VinÃ­cius Jr anota Â· MÃ¡s de 2.5 goles. Cuota est: 1.9x",pr:"Pred: Brasil 2-1"};
ANAL["Brazil_Scotland"]              = ANAL["Scotland_Brazil"];
ANAL["Czechia_Mexico"]               = {g:"Rep. Checa con 1 pt necesita ganar sÃ­ o sÃ­. MÃ©xico con 6 pts ya clasificado, puede rotar. Rep. Checa tiene chance si MÃ©xico descansa titulares.",go:"KrejÄÃ­ y SouÄek (Rep. Checa). JimÃ©nez si juega por MÃ©xico.",fi:"TomÃ¡Å¡ SouÄek (Rep. Checa) â€” el motor. Puede liderar la remontada.",ap:"Rep. Checa gana Â· MÃ©xico rotado. Cuota est: 2.8x",pr:"Pred: Rep. Checa 2-1"};
ANAL["Mexico_Czechia"]               = ANAL["Czechia_Mexico"];
ANAL["South Africa_Korea Republic"]  = {g:"SudÃ¡frica y Corea del Sur ambos con 1 pt. Partido de vida o muerte. Quien gane se mete en la pelea del 2do lugar.",go:"Oh Hyeon-gyu y Hwang In-beom (Corea). Mokoena (SudÃ¡frica).",fi:"Hwang In-beom (Corea del Sur) â€” el mejor de Corea en este Mundial.",ap:"Corea del Sur gana Â· Hwang anota. Cuota est: 2.2x",pr:"Pred: Corea del Sur 2-0"};
ANAL["Korea Republic_South Africa"]  = ANAL["South Africa_Korea Republic"];
ANAL["Ecuador_Germany"]              = {g:"Ecuador sin puntos, casi eliminado. Alemania con 6 pts ya clasificada y puede rotar. Ecuador necesita ganar y esperar resultados.",go:"Enner Valencia y Caicedo (Ecuador). Musiala y Havertz si juegan (Alemania).",fi:"MoisÃ©s Caicedo (Ecuador) â€” el Ãºnico que puede cambiar el partido.",ap:"Alemania gana aunque rote Â· Ecuador pelea por el honor. Cuota est: 2.1x",pr:"Pred: Alemania 2-1"};
ANAL["Germany_Ecuador"]              = ANAL["Ecuador_Germany"];
ANAL["Ivory Coast_Curacao"]          = {g:"Costa de Marfil con 3 pts quiere el 2do lugar. Curazao sin puntos y goleado 1-7 por Alemania. Costa de Marfil debe golear.",go:"Amad Diallo (Costa de Marfil) â€” el hÃ©roe de J1. Seko Fofana tambiÃ©n.",fi:"Amad Diallo (Costa de Marfil) â€” el mÃ¡s talentoso del equipo.",ap:"Costa de Marfil gana amplio Â· Amad Diallo anota. Cuota est: 1.6x",pr:"Pred: Costa de Marfil 3-0"};
ANAL["CuraÃ§ao_CÃ´te d'Ivoire"]        = ANAL["Ivory Coast_Curacao"];
ANAL["Curacao_Ivory Coast"]          = ANAL["Ivory Coast_Curacao"];
ANAL["CÃ´te d'Ivoire_CuraÃ§ao"]        = ANAL["Ivory Coast_Curacao"];




// â”€â”€ J3 HOY 25 Jun â”€â”€
ANAL["Ecuador_Germany"]              = {g:"Ecuador sin puntos y eliminada. Alemania con 6 pts ya clasificada puede rotar. Pero Alemania nunca afloja.",go:"Musiala y Havertz (Alemania). Enner Valencia y Caicedo (Ecuador) buscan el honor.",fi:"Jamal Musiala (Alemania) â€” incluso rotando es el mejor del grupo.",ap:"Alemania gana Â· MÃ¡s de 2.5 goles. Cuota est: 1.8x",pr:"Pred: Alemania 3-1"};
ANAL["Germany_Ecuador"]              = ANAL["Ecuador_Germany"];
ANAL["CuraÃ§ao_Ivory Coast"]          = {g:"Curazao sin puntos, goleada 1-7 por Alemania. Costa de Marfil con 3 pts quiere asegurar 2do lugar. Costa de Marfil debe golear.",go:"Amad Diallo (Costa de Marfil) â€” el hÃ©roe de J1 al 90min. Seko Fofana tambiÃ©n.",fi:"Amad Diallo (Costa de Marfil) â€” el mÃ¡s talentoso. Puede hacer hat-trick.",ap:"Costa de Marfil gana amplio Â· MÃ¡s de 3.5 goles. Cuota est: 1.6x",pr:"Pred: Costa de Marfil 4-0"};
ANAL["Curacao_Ivory Coast"]          = ANAL["CuraÃ§ao_Ivory Coast"];
ANAL["Ivory Coast_CuraÃ§ao"]          = ANAL["CuraÃ§ao_Ivory Coast"];
ANAL["Ivory Coast_Curacao"]          = ANAL["CuraÃ§ao_Ivory Coast"];
ANAL["Tunisia_Netherlands"]          = {g:"PaÃ­ses Bajos con 4 pts lidera Grupo F. TÃºnez con 0 pts y eliminada. PaÃ­ses Bajos debe ganar para mantener el liderato sobre Suecia.",go:"Cody Gakpo y Memphis Depay (PaÃ­ses Bajos) letales. TÃºnez sin nivel para competir.",fi:"Cody Gakpo (PaÃ­ses Bajos) â€” en gran forma, peligroso por banda.",ap:"PaÃ­ses Bajos gana Â· MÃ¡s de 2.5 goles Â· Gakpo anota. Cuota est: 1.7x",pr:"Pred: PaÃ­ses Bajos 3-0"};
ANAL["Netherlands_Tunisia"]          = ANAL["Tunisia_Netherlands"];
ANAL["Japan_Sweden"]                 = {g:"JapÃ³n con 4 pts vs Suecia con 3 pts. Quien gane lidera o asegura clasificaciÃ³n cÃ³moda. Partido muy parejo.",go:"Daichi Kamada y Minamino (JapÃ³n). Viktor GyÃ¶keres (Suecia) â€” el goleador del torneo.",fi:"Viktor GyÃ¶keres (Suecia) â€” si aparece puede decidir solo el partido.",ap:"Ambos anotan Â· MÃ¡s de 2.5 goles Â· GyÃ¶keres anota. Cuota est: 2.0x",pr:"Pred: Empate 1-1"};
ANAL["Sweden_Japan"]                 = ANAL["Japan_Sweden"];
ANAL["Turkey_United States"]         = {g:"EE.UU. con 6 pts ya clasificado. TurquÃ­a con 0 pts y eliminada. Pero EE.UU. quiere el 1er lugar del Grupo D con pleno de victorias.",go:"Folarin Balogun (EE.UU.) â€” goleador del torneo. Kerem AktÃ¼rkoÄŸlu (TurquÃ­a) Ãºnico peligro.",fi:"Folarin Balogun (EE.UU.) â€” viene con un doblete en J1. El mÃ¡s letal del grupo.",ap:"EE.UU. gana Â· Balogun anota Â· MÃ¡s de 2.5 goles. Cuota est: 1.8x",pr:"Pred: EE.UU. 3-0"};
ANAL["United States_Turkey"]         = ANAL["Turkey_United States"];
ANAL["USA_Turkey"]                   = ANAL["Turkey_United States"];
ANAL["Paraguay_Australia"]           = {g:"Australia con 3 pts vs Paraguay con 3 pts. Ambos necesitan ganar para asegurar clasificaciÃ³n. El partido mÃ¡s parejo del dÃ­a.",go:"Martin Ojeda y Alvarado (Paraguay). Nestory Irankunda y Ryan (Australia).",fi:"Irankunda (Australia) â€” el joven mÃ¡s explosivo. Puede decidir con su velocidad.",ap:"Partido muy parejo Â· Ambos se juegan la clasificaciÃ³n. Cuota empate: 3.0x",pr:"Pred: Australia 1-0"};
ANAL["Australia_Paraguay"]           = ANAL["Paraguay_Australia"];

// â”€â”€ J3 RESULTADOS â”€â”€
ANAL["Switzerland_Canada"]    = {g:"Suiza venciÃ³ 2-1 a CanadÃ¡ y se lleva el 1er lugar del Grupo B. Manzambi abriÃ³, Simons ampliÃ³. Promise David descontÃ³ al 76min.",go:"Johan Manzambi (Suiza) al 57min fue el goleador decisivo.",fi:"Xavi Simons (Suiza) â€” el mÃ¡s creativo del partido.",ap:"Partido terminado Â· Suiza 1era del Grupo B",pr:"âœ… Suiza 2-1"};
ANAL["Canada_Switzerland"]    = ANAL["Switzerland_Canada"];
ANAL["Bosnia-Herzegovina_Qatar"] = {g:"Bosnia goleÃ³ 3-1 a Qatar y clasificÃ³ como uno de los mejores terceros. Mahmic con doblete.",go:"Mahmic (Bosnia) doblete decisivo. Qatar no tuvo nivel.",fi:"Mahmic (Bosnia) â€” el hÃ©roe de la clasificaciÃ³n.",ap:"Partido terminado Â· Bosnia clasifica",pr:"âœ… Bosnia 3-1"};
ANAL["Qatar_Bosnia-Herzegovina"] = ANAL["Bosnia-Herzegovina_Qatar"];
ANAL["Scotland_Brazil"]       = {g:"Brasil goleÃ³ 3-0 a Escocia con doblete de VinÃ­cius Jr. Brasil campeÃ³n del Grupo C. Neymar entrÃ³ desde el banco.",go:"VinÃ­cius Jr (Brasil) doblete. Matheus Cunha marcÃ³ el 3ro.",fi:"VinÃ­cius Jr (Brasil) â€” figura indiscutida del Grupo C.",ap:"Partido terminado Â· Brasil 1ero del Grupo C",pr:"âœ… Brasil 3-0"};
ANAL["Brazil_Scotland"]       = ANAL["Scotland_Brazil"];
ANAL["Morocco_Haiti"]         = {g:"Marruecos sufriÃ³ pero venciÃ³ 4-2 a HaitÃ­. Hakimi, Saibari, Rahimi y Yassine para los africanos. HaitÃ­ marcÃ³ 2 goles de honor.",go:"Achraf Hakimi (Marruecos) abriÃ³ el marcador. Saibari sumÃ³ el 2do.",fi:"Achraf Hakimi (Marruecos) â€” el mejor africano del torneo.",ap:"Partido terminado Â· Marruecos 2do del Grupo C",pr:"âœ… Marruecos 4-2"};
ANAL["Haiti_Morocco"]         = ANAL["Morocco_Haiti"];
ANAL["Czechia_Mexico"]        = {g:"MÃ©xico venciÃ³ 2-0 a Rep. Checa y lidera el Grupo A con 9 puntos. Mateo ChÃ¡vez al 55min en su debut, QuiÃ±ones al 61min.",go:"Mateo ChÃ¡vez (MÃ©xico) primer gol en su debut mundialista. QuiÃ±ones su 2do del torneo.",fi:"Mateo ChÃ¡vez (MÃ©xico) â€” el gol del debut mÃ¡s emotivo del torneo.",ap:"Partido terminado Â· MÃ©xico 1ero del Grupo A con 9 pts",pr:"âœ… MÃ©xico 2-0"};
ANAL["Mexico_Czechia"]        = ANAL["Czechia_Mexico"];
ANAL["South Africa_South Korea"] = {g:"SudÃ¡frica sorprendiÃ³ y venciÃ³ 1-0 a Corea del Sur. Maseko al 63min. Corea queda fuera o debe esperar como mejor tercero.",go:"Thapelo Maseko (SudÃ¡frica) â€” el gol que cambiÃ³ todo al 63min.",fi:"Maseko (SudÃ¡frica) â€” figura sorpresa del dÃ­a.",ap:"Partido terminado Â· SudÃ¡frica 2da del Grupo A",pr:"âœ… SudÃ¡frica 1-0"};
ANAL["Korea Republic_South Africa"] = ANAL["South Africa_South Korea"];

// Alias de nombres alternativos (sin sobreescribir resultados)
ANAL["CuraÃ§ao_Ivory Coast"]          = {g:"Curazao sin puntos, goleado 1-7 por Alemania. Costa de Marfil con 3 pts quiere asegurar clasificaciÃ³n.",go:"Amad Diallo (Costa de Marfil) â€” el hÃ©roe de J1. Fofana tambiÃ©n.",fi:"Amad Diallo (Costa de Marfil) â€” el mÃ¡s talentoso del equipo.",ap:"Costa de Marfil gana amplio Â· Amad Diallo anota. Cuota est: 1.6x",pr:"Pred: Costa de Marfil 3-0"};


// Claves exactas 25-27 Jun segÃºn log API
ANAL["Tunisia_Netherlands"]          = {g:"PaÃ­ses Bajos con 4 pts lidera Grupo F. TÃºnez con 0 pts eliminada. PaÃ­ses Bajos debe ganar para mantener liderato.",go:"Cody Gakpo y Memphis Depay (PaÃ­ses Bajos) letales. TÃºnez sin nivel.",fi:"Cody Gakpo (PaÃ­ses Bajos) â€” en gran forma, peligroso por banda.",ap:"PaÃ­ses Bajos gana Â· MÃ¡s de 2.5 goles Â· Gakpo anota. Cuota est: 1.7x",pr:"Pred: PaÃ­ses Bajos 3-0"};
ANAL["Netherlands_Tunisia"]          = ANAL["Tunisia_Netherlands"];
ANAL["Japan_Sweden"]                 = {g:"JapÃ³n con 4 pts vs Suecia con 3 pts. Quien gane lidera o asegura clasificaciÃ³n. Partido muy parejo y abierto.",go:"Daichi Kamada (JapÃ³n). Viktor GyÃ¶keres (Suecia) â€” el goleador del torneo.",fi:"Viktor GyÃ¶keres (Suecia) â€” si aparece puede decidir Ã©l solo el partido.",ap:"Ambos anotan Â· GyÃ¶keres anota. Cuota est: 2.0x",pr:"Pred: Empate 1-1"};
ANAL["Sweden_Japan"]                 = ANAL["Japan_Sweden"];
ANAL["Turkey_United States"]         = {g:"EE.UU. con 6 pts clasificado. TurquÃ­a con 0 pts eliminada. EE.UU. quiere el 1er lugar con pleno de victorias.",go:"Folarin Balogun (EE.UU.) â€” goleador del torneo. Ã‡alhanoÄŸlu (TurquÃ­a) Ãºnico peligro.",fi:"Folarin Balogun (EE.UU.) â€” doblete en J1, el mÃ¡s letal del grupo.",ap:"EE.UU. gana Â· Balogun anota Â· MÃ¡s de 2.5 goles. Cuota est: 1.8x",pr:"Pred: EE.UU. 3-0"};
ANAL["United States_Turkey"]         = ANAL["Turkey_United States"];
ANAL["Paraguay_Australia"]           = {g:"Australia con 3 pts vs Paraguay con 3 pts. Ambos necesitan ganar. El partido mÃ¡s parejo del dÃ­a. ClasificaciÃ³n en juego.",go:"Irankunda (Australia) veloz y peligroso. Ojeda y Alvarado (Paraguay) buscan el gol.",fi:"Nestory Irankunda (Australia) â€” el joven mÃ¡s explosivo, puede decidir.",ap:"Partido muy parejo Â· Ambos se juegan la clasificaciÃ³n. Cuota empate: 3.0x",pr:"Pred: Australia 1-0"};
ANAL["Australia_Paraguay"]           = ANAL["Paraguay_Australia"];
// 26 Jun
ANAL["Norway_France"]                = {g:"Francia con 6 pts lidera Grupo I. Noruega con 6 pts tambiÃ©n. El partido mÃ¡s atractivo del torneo hasta ahora. MbappÃ© vs Haaland.",go:"Kylian MbappÃ© (Francia) â€” goleador histÃ³rico. Erling Haaland (Noruega) â€” 4 goles en 2 partidos.",fi:"Erling Haaland (Noruega) â€” si marca doblete puede ser figura del Mundial.",ap:"Ambos anotan Â· MÃ¡s de 3 goles Â· Partido del aÃ±o. Cuota empate: 3.0x",pr:"Pred: Francia 2-1"};
ANAL["France_Norway"]                = ANAL["Norway_France"];
ANAL["Senegal_Iraq"]                 = {g:"Francia lidera Grupo I. Senegal con 0 pts y Irak con 0 pts. Partido entre los dos eliminados del grupo.",go:"Sadio ManÃ© (Senegal) â€” el mÃ¡s peligroso. Mohanad Ali (Iraq) busca el gol del honor.",fi:"Sadio ManÃ© (Senegal) â€” necesita reivindicarse tras un torneo pobre.",ap:"Senegal gana Â· ManÃ© anota. Cuota est: 2.0x",pr:"Pred: Senegal 2-0"};
ANAL["Iraq_Senegal"]                 = ANAL["Senegal_Iraq"];
ANAL["Uruguay_Spain"]                = {g:"EspaÃ±a con 4 pts busca el 1er lugar del Grupo H. Uruguay con 4 pts tambiÃ©n. Partido muy parejo. De Bruyne vs Valverde.",go:"Pedri y Morata (EspaÃ±a). Darwin NÃºÃ±ez y Valverde (Uruguay).",fi:"Federico Valverde (Uruguay) â€” el jugador mÃ¡s completo de su equipo.",ap:"EspaÃ±a gana por la mÃ­nima Â· Pedri con asistencia. Cuota est: 2.2x",pr:"Pred: EspaÃ±a 1-0"};
ANAL["Spain_Uruguay"]                = ANAL["Uruguay_Spain"];
ANAL["Cape Verde Islands_Saudi Arabia"] = {g:"Arabia Saudita con 1 pt vs Cabo Verde con 1 pt. EspaÃ±a lidera el grupo. Partido entre los dos que pelean el 2do lugar.",go:"Al-Dawsari (Arabia Saudita) â€” el mÃ¡s peligroso. Garry Rodrigues (Cabo Verde).",fi:"Al-Dawsari (Arabia Saudita) â€” extremo rÃ¡pido, puede desequilibrar.",ap:"Arabia Saudita gana Â· Al-Dawsari anota. Cuota est: 2.1x",pr:"Pred: Arabia Saudita 2-1"};
ANAL["Saudi Arabia_Cape Verde Islands"] = ANAL["Cape Verde Islands_Saudi Arabia"];
ANAL["New Zealand_Belgium"]          = {g:"BÃ©lgica con 1 pt vs Nueva Zelanda con 1 pt. Partido parejo entre dos equipos irregulares.",go:"Lukaku y De Bruyne (BÃ©lgica). Chris Wood (Nueva Zelanda).",fi:"Kevin De Bruyne (BÃ©lgica) â€” si aparece cambia el partido completamente.",ap:"BÃ©lgica gana Â· De Bruyne con asistencia. Cuota est: 2.0x",pr:"Pred: BÃ©lgica 2-0"};
ANAL["Belgium_New Zealand"]          = ANAL["New Zealand_Belgium"];
ANAL["Egypt_Iran"]                   = {g:"IrÃ¡n con 1 pt vs Egipto con 1 pt. Ambos buscan el 2do lugar del Grupo G. Partido determinante.",go:"Mohamed Salah si juega (Egipto). Mehdi Taremi (IrÃ¡n) â€” el goleador histÃ³rico.",fi:"Mohamed Salah (Egipto) â€” si estÃ¡ al 100% es el mejor del partido.",ap:"Empate o Egipto gana Â· Salah anota. Cuota est: 2.3x",pr:"Pred: Egipto 1-0"};
ANAL["Iran_Egypt"]                   = ANAL["Egypt_Iran"];
// 27-28 Jun
ANAL["Panama_England"]               = {g:"Inglaterra con 6 pts clasificada. PanamÃ¡ con 0 pts eliminada. Inglaterra puede rotar pero siempre gana.",go:"Harry Kane (Inglaterra) â€” doblete en J1. Bellingham tambiÃ©n peligroso.",fi:"Jude Bellingham (Inglaterra) â€” puede ser figura incluso con rotaciones.",ap:"Inglaterra gana Â· Kane anota. Cuota est: 1.7x",pr:"Pred: Inglaterra 3-0"};
ANAL["England_Panama"]               = ANAL["Panama_England"];
ANAL["Croatia_Ghana"]                = {g:"Croacia con 0 pts vs Ghana con 3 pts. Ghana ya casi clasificada. Croacia necesita ganar sÃ­ o sÃ­ para seguir viva.",go:"Mohammed Kudus (Ghana) â€” el mÃ¡s desequilibrante. Modric (Croacia) Ãºltima chance.",fi:"Luka Modric (Croacia) â€” 40 aÃ±os, su Ãºltimo Mundial. Todo o nada.",ap:"Ghana gana Â· Kudus anota. Cuota est: 2.0x",pr:"Pred: Ghana 1-0"};
ANAL["Ghana_Croatia"]                = ANAL["Croatia_Ghana"];
ANAL["Colombia_Portugal"]            = {g:"Colombia con 3 pts vs Portugal con 1 pt. El partido mÃ¡s atractivo del Grupo K. Luis DÃ­az vs Cristiano.",go:"Luis DÃ­az (Colombia) â€” extremo del Liverpool en estado de gracia. Cristiano (Portugal) necesita despertar.",fi:"Luis DÃ­az (Colombia) â€” el mÃ¡s desequilibrante. Si aparece Colombia gana cÃ³modo.",ap:"Colombia gana Â· Luis DÃ­az anota. Cuota est: 2.0x",pr:"Pred: Colombia 2-1"};
ANAL["Portugal_Colombia"]            = ANAL["Colombia_Portugal"];
ANAL["Jordan_Argentina"]             = {g:"Argentina con 6 pts ya clasificada. Jordania con 0 pts eliminada. Argentina quiere los 9 pts con Messi.",go:"Lionel Messi (Argentina) â€” ya con 6 goles en el torneo. Busca el rÃ©cord.",fi:"Lionel Messi (Argentina) â€” el mejor jugador de la historia en su Ãºltima Copa.",ap:"Argentina gana Â· Messi anota Â· MÃ¡s de 3 goles. Cuota est: 1.6x",pr:"Pred: Argentina 3-0"};
ANAL["Argentina_Jordan"]             = ANAL["Jordan_Argentina"];
ANAL["Algeria_Austria"]              = {g:"Austria con 3 pts vs Argelia con 0 pts. Argentina lidera. Austria quiere asegurar clasificaciÃ³n.",go:"Marko Arnautovic (Austria) â€” de penal es muy peligroso. BelaÃ¯li (Argelia).",fi:"Marko Arnautovic (Austria) â€” el delantero referente del equipo.",ap:"Austria gana Â· Arnautovic anota. Cuota est: 1.9x",pr:"Pred: Austria 2-0"};
ANAL["Austria_Algeria"]              = ANAL["Algeria_Austria"];
ANAL["Uzbekistan_DR Congo"]          = {g:"RD Congo con 1 pt vs UzbekistÃ¡n con 0 pts. Colombia lidera. Partido entre los dos de abajo del Grupo K.",go:"Yoane Wissa (RD Congo) â€” ya demostrÃ³ nivel vs Portugal. Shomurodov (UzbekistÃ¡n).",fi:"Yoane Wissa (RD Congo) â€” el hÃ©roe de J1 contra Portugal.",ap:"RD Congo gana Â· Wissa anota. Cuota est: 2.1x",pr:"Pred: RD Congo 2-0"};
ANAL["DR Congo_Uzbekistan"]          = ANAL["Uzbekistan_DR Congo"];

// â”€â”€ FASE ELIMINATORIA (Round of 32) â”€â”€
ANAL["South Africa_Canada"]  = {g:"SudÃ¡frica llega como la gran sorpresa del Grupo A (2da), venciÃ³ a Corea del Sur 1-0 en J3. CanadÃ¡ clasificÃ³ 2da del Grupo B tras perder 1-2 con Suiza. Primer eliminatorio de la historia para ambas selecciones en WC 2026.",go:"Alphonso Davies (CanadÃ¡) â€” el mÃ¡s explosivo del torneo. Jonathan David busca el gol. Thapelo Maseko (SudÃ¡frica) â€” el hÃ©roe de J3.",fi:"Alphonso Davies (CanadÃ¡) â€” el mÃ¡s peligroso. Si tiene espacio, nadie lo para.",ap:"CanadÃ¡ favorita Â· Davies anota Â· MÃ¡s de 1.5 goles. Cuota CanadÃ¡: 2.0x",pr:"Pred: CanadÃ¡ 2-1"};
ANAL["Canada_South Africa"]  = ANAL["South Africa_Canada"];

// 29 Jun
ANAL["Brazil_Japan"]         = {g:"Brasil arrasÃ³ en el Grupo C con 9 pts y 8 goles a favor. JapÃ³n fue sorprendente, clasificÃ³ con 6 pts venciendo a TÃºnez y empatando vs PaÃ­ses Bajos. El choque mÃ¡s atractivo del dÃ­a.",go:"VinÃ­cius Jr (Brasil) â€” 3 goles en la fase de grupos, imparable. Daichi Kamada (JapÃ³n) â€” el motor del mediocampo.",fi:"VinÃ­cius Jr (Brasil) â€” si estÃ¡ en el dÃ­a, el partido se acaba en el primer tiempo.",ap:"Brasil gana Â· VinÃ­cius Jr anota Â· MÃ¡s de 2.5 goles. Cuota Brasil: 1.7x",pr:"Pred: Brasil 3-1"};
ANAL["Japan_Brazil"]         = ANAL["Brazil_Japan"];
ANAL["Germany_Paraguay"]     = {g:"Alemania dominÃ³ el Grupo E con 9 pts (7-1 a Curazao, 2-1 a Costa de Marfil, 2-1 a Ecuador). Paraguay clasificÃ³ como mejor tercero con batallas Ã©picas. Alemania es amplio favorita.",go:"Jamal Musiala (Alemania) â€” el jugador del torneo hasta ahora. Havertz peligroso. Adalberto Pereira (Paraguay) â€” el Ãºnico que puede generar peligro.",fi:"Jamal Musiala (Alemania) â€” el mÃ¡s creativo e imparable. Figura del torneo.",ap:"Alemania gana Â· Musiala da asistencia Â· Havertz anota. Cuota Alemania: 1.5x",pr:"Pred: Alemania 3-0"};
ANAL["Paraguay_Germany"]     = ANAL["Germany_Paraguay"];
ANAL["Netherlands_Morocco"]  = {g:"PaÃ­ses Bajos goleÃ³ 5-1 a Suecia en J2 y lidera el Grupo F. Marruecos fue 2do del Grupo C (detrÃ¡s de Brasil). Duelo muy competitivo â€” Marruecos siempre difÃ­cil de vencer.",go:"Cody Gakpo (PaÃ­ses Bajos) â€” extremo en gran nivel. Xavi Simons con doblete en J2. Achraf Hakimi (Marruecos) â€” el mejor africano del torneo.",fi:"Achraf Hakimi (Marruecos) â€” si aparece por la banda, PaÃ­ses Bajos tiene problemas.",ap:"PaÃ­ses Bajos favorita Â· Gakpo anota. Cuota PB: 2.0x",pr:"Pred: PaÃ­ses Bajos 2-1"};
ANAL["Morocco_Netherlands"]  = ANAL["Netherlands_Morocco"];

// 30 Jun
ANAL["Ivory Coast_Norway"]   = {g:"Costa de Marfil clasificÃ³ del Grupo E con 4 pts. Noruega liderÃ³ el Grupo I con 9 pts â€” Haaland anotÃ³ 4 veces y fue dominante. Noruega parte como gran favorita con el mejor delantero del torneo.",go:"Erling Haaland (Noruega) â€” 4 goles, el mÃ¡ximo goleador del torneo. Amad Diallo (Costa de Marfil) â€” la Ãºnica amenaza real.",fi:"Erling Haaland (Noruega) â€” si recibe bien la pelota, anota. Es inevitable.",ap:"Noruega gana Â· Haaland anota Â· MÃ¡s de 2 goles. Cuota Noruega: 1.6x",pr:"Pred: Noruega 3-1"};
ANAL["Norway_Ivory Coast"]   = ANAL["Ivory Coast_Norway"];
ANAL["CÃ´te d'Ivoire_Norway"] = ANAL["Ivory Coast_Norway"];
ANAL["Norway_CÃ´te d'Ivoire"] = ANAL["Ivory Coast_Norway"];
ANAL["France_Sweden"]        = {g:"Francia ganÃ³ el Grupo I (9 pts, MbappÃ© 4 goles). Suecia clasificÃ³ 2da del Grupo F con 6 pts â€” GyÃ¶keres fue letal. El duelo de goleadores: MbappÃ© vs GyÃ¶keres.",go:"Kylian MbappÃ© (Francia) â€” 4 goles, el mÃ¡s peligroso de Europa. Viktor GyÃ¶keres (Suecia) â€” 3 goles, el rival mÃ¡s duro de afrontar.",fi:"Kylian MbappÃ© (Francia) â€” si estÃ¡ sano y en ritmo, es el mejor jugador del torneo.",ap:"Francia favorita Â· MbappÃ© anota Â· Partido con goles. Cuota Francia: 1.8x",pr:"Pred: Francia 2-1"};
ANAL["Sweden_France"]        = ANAL["France_Sweden"];
ANAL["Mexico_Ecuador"]       = {g:"MÃ©xico fue primero del Grupo A con 9 pts perfectos. Ecuador clasificÃ³ del Grupo E como mejor tercero. MÃ©xico llega en su mejor nivel en dÃ©cadas, Ecuador en riesgo desde el inicio.",go:"Alexis Vega y QuiÃ±ones (MÃ©xico) â€” dupla de ataque. Rodrigo Bentancur... error, MoisÃ©s Caicedo (Ecuador) el Ãºnico que puede sacudir.",fi:"Alexis Vega (MÃ©xico) â€” el mÃ¡s desequilibrante del equipo. Peligroso por velocidad.",ap:"MÃ©xico gana Â· QuiÃ±ones anota Â· Sin empate. Cuota MÃ©xico: 1.8x",pr:"Pred: MÃ©xico 2-0"};
ANAL["Ecuador_Mexico"]       = ANAL["Mexico_Ecuador"];

// 1 Jul
ANAL["England_DR Congo"]     = {g:"Inglaterra fue primera del Grupo J con 9 pts. Kane doblete en J1, Bellingham decisivo. RD Congo llegÃ³ 2da de su grupo (empatÃ³ con Portugal en J1 con gol de Wissa). Partido sin sorpresas esperadas.",go:"Harry Kane (Inglaterra) â€” el delantero mÃ¡s letal de Europa. Yoane Wissa (RD Congo) â€” el Ãºnico con nivel para marcar.",fi:"Jude Bellingham (Inglaterra) â€” el jugador mÃ¡s completo. Si aparece, Inglaterra arrasa.",ap:"Inglaterra gana Â· Kane anota Â· MÃ¡s de 2.5 goles. Cuota Inglaterra: 1.5x",pr:"Pred: Inglaterra 3-0"};
ANAL["DR Congo_England"]     = ANAL["England_DR Congo"];
ANAL["England_Congo DR"]     = ANAL["England_DR Congo"];
ANAL["Congo DR_England"]     = ANAL["England_DR Congo"];
ANAL["Argentina_Bosnia-Herzegovina"] = {g:"Argentina fue primera del Grupo L con 9 pts â€” Messi hat-trick en J1, 6 goles en la fase de grupos. Bosnia clasificÃ³ 2da. El partido mÃ¡s desequilibrado del dÃ­a en papel.",go:"Lionel Messi (Argentina) â€” 6 goles, mÃ¡ximo goleador del torneo. Edin DÅ¾eko (Bosnia) â€” su Ãºltimo Mundial.",fi:"Lionel Messi (Argentina) â€” si anota el 7mo gol, iguala a Ronaldo como goleador histÃ³rico de Mundiales.",ap:"Argentina gana amplio Â· Messi anota Â· MÃ¡s de 3 goles. Cuota Argentina: 1.4x",pr:"Pred: Argentina 4-0"};
ANAL["Bosnia-Herzegovina_Argentina"] = ANAL["Argentina_Bosnia-Herzegovina"];
ANAL["Spain_Korea Republic"] = {g:"EspaÃ±a se recuperÃ³ tras el 0-0 vs Cabo Verde, ganÃ³ J2 y J3 para liderar el Grupo H. Corea del Sur clasificÃ³ como mejor tercero del Grupo A. EspaÃ±a favorita con Pedri y Morata en forma.",go:"Pedri (EspaÃ±a) â€” el creativo del equipo, en su mejor versiÃ³n. Hwang In-beom (Corea) â€” el motor coreano.",fi:"Pedri (EspaÃ±a) â€” si estÃ¡ libre, EspaÃ±a controla el partido con facilidad.",ap:"EspaÃ±a gana Â· Pedri con asistencia Â· Morata anota. Cuota EspaÃ±a: 1.7x",pr:"Pred: EspaÃ±a 2-0"};
ANAL["Korea Republic_Spain"] = ANAL["Spain_Korea Republic"];
ANAL["USA_Australia"]        = {g:"EE.UU. fue primero del Grupo G con 9 pts â€” Balogun con doblete en J1 es el goleador revelaciÃ³n. Australia clasificÃ³ 2da del Grupo H. Partido de alta intensidad en terreno favorito para EE.UU.",go:"Folarin Balogun (EE.UU.) â€” el goleador sorpresa del torneo. Nestory Irankunda (Australia) â€” el joven mÃ¡s explosivo.",fi:"Folarin Balogun (EE.UU.) â€” si sigue el ritmo, puede ser el goleador del torneo.",ap:"EE.UU. gana Â· Balogun anota Â· MÃ¡s de 2 goles. Cuota EE.UU.: 1.8x",pr:"Pred: EE.UU. 3-1"};
ANAL["Australia_USA"]        = ANAL["USA_Australia"];
ANAL["Australia_United States"] = ANAL["USA_Australia"];
ANAL["United States_Australia"] = ANAL["USA_Australia"];
ANAL["Portugal_Colombia"]    = {g:"Portugal fue 2da del Grupo K (1-1 vs RD Congo). Colombia liderÃ³ el Grupo K con 7 pts. El partido mÃ¡s apasionante del Round of 32 â€” Luis DÃ­az vs Cristiano.",go:"Cristiano Ronaldo (Portugal) â€” necesita despertar, sin goles en la fase de grupos. Luis DÃ­az (Colombia) â€” el mejor latinoamericano del torneo.",fi:"Luis DÃ­az (Colombia) â€” extremo del Liverpool en estado de gracia. Si aparece, Colombia gana.",ap:"Colombia favorita leve Â· Luis DÃ­az anota. Cuota Colombia: 2.2x",pr:"Pred: Colombia 2-1"};
ANAL["Colombia_Portugal"]    = ANAL["Portugal_Colombia"];
ANAL["Switzerland_Morocco"]  = {g:"Suiza liderÃ³ el Grupo B con 7 pts (4-1 a Bosnia, 2-1 a CanadÃ¡). Marruecos fue 2do del Grupo C con 4 pts. Partido competitivo â€” Marruecos demostrÃ³ ser la mejor selecciÃ³n africana.",go:"Breel Embolo (Suiza) â€” el delantero referente. Achraf Hakimi (Marruecos) â€” banda derecha imparable.",fi:"Granit Xhaka (Suiza) â€” el motor del mediocampo. Si controla el partido, Suiza gana.",ap:"Suiza favorita por juego Â· Empate posible Â· Embolo anota. Cuota Suiza: 2.1x",pr:"Pred: Suiza 1-0"};
ANAL["Morocco_Switzerland"]  = ANAL["Switzerland_Morocco"];

// 1 Jul
ANAL["Belgium_Senegal"]      = {g:"BÃ©lgica clasificÃ³ del Grupo G con 7 pts tras remontar una campaÃ±a irregular. Senegal terminÃ³ con 3 pts en el Grupo I â€” perdiÃ³ 1-3 con Francia y Noruega, pero ganÃ³ a Iraq para clasificar como mejor tercero. BÃ©lgica es favorita, pero ManÃ© y el bloque africano pueden complicar.",go:"Romelu Lukaku (BÃ©lgica) â€” si estÃ¡ en forma, es el delantero mÃ¡s letal del equipo. Kevin De Bruyne como creativo. Sadio ManÃ© (Senegal) â€” el lÃ­der y la Ãºnica gran estrella africana del partido.",fi:"Kevin De Bruyne (BÃ©lgica) â€” si aparece con su mejor versiÃ³n, BÃ©lgica controla el partido y gana cÃ³modo.",ap:"BÃ©lgica gana Â· De Bruyne con asistencia Â· Lukaku anota. Cuota BÃ©lgica: 1.8x",pr:"Pred: BÃ©lgica 2-0"};
ANAL["Senegal_Belgium"]      = ANAL["Belgium_Senegal"];
ANAL["USA_Bosnia and Herzegovina"] = {g:"EE.UU. fue primero del Grupo G con 9 pts perfectos â€” Balogun doblete en J1 fue sensaciÃ³n del torneo. Bosnia clasificÃ³ como mejor tercero del Grupo B, con la Ã©pica victoria 3-1 sobre Qatar. En casa, EE.UU. es intocable.",go:"Folarin Balogun (EE.UU.) â€” el goleador revelaciÃ³n del torneo. Christian Pulisic tambiÃ©n peligroso. Edin DÅ¾eko (Bosnia) â€” leyenda, su Ãºltimo Mundial.",fi:"Folarin Balogun (EE.UU.) â€” si mantiene el ritmo de J1, puede ser el goleador del torneo. En casa es imparable.",ap:"EE.UU. gana Â· Balogun anota Â· MÃ¡s de 2 goles. Cuota EE.UU.: 1.6x",pr:"Pred: EE.UU. 3-0"};
ANAL["Bosnia and Herzegovina_USA"] = ANAL["USA_Bosnia and Herzegovina"];
ANAL["Bosnia-Herzegovina_USA"] = ANAL["USA_Bosnia and Herzegovina"];
ANAL["USA_Bosnia"]           = ANAL["USA_Bosnia and Herzegovina"];
ANAL["Bosnia_USA"]           = ANAL["USA_Bosnia and Herzegovina"];

// 2 Jul
ANAL["Spain_Austria"]        = {g:"EspaÃ±a liderÃ³ el Grupo H con 7 pts tras remontar el decepcionante 0-0 inicial vs Cabo Verde. Austria fue 2da del Grupo J con 7 pts â€” 3-1 a Jordania en J1 y muy sÃ³lida. El partido mÃ¡s parejo de la jornada del 2 de julio.",go:"Pedri (EspaÃ±a) â€” el creativo que EspaÃ±a necesita. Morata como referente. Marko Arnautovic (Austria) â€” letal de penal y en juego aÃ©reo.",fi:"Pedri (EspaÃ±a) â€” si estÃ¡ libre de presiÃ³n, EspaÃ±a controla el partido. La clave es Ã©l.",ap:"EspaÃ±a favorita Â· Pedri con asistencia Â· Partido con 2+ goles. Cuota EspaÃ±a: 1.9x",pr:"Pred: EspaÃ±a 2-1"};
ANAL["Austria_Spain"]        = ANAL["Spain_Austria"];
ANAL["Portugal_Croatia"]     = {g:"Portugal fue 2do del Grupo K (1-1 vs RD Congo en J1, sufrido paso de grupos). Croacia se recuperÃ³ en J2 y J3 para clasificar del Grupo J. El duelo europeo mÃ¡s equilibrado del Round of 32. Modric contra Cristiano en posiblemente su Ãºltimo Mundial.",go:"Cristiano Ronaldo (Portugal) â€” necesita despertar, sin goles en la fase de grupos. Luka Modric (Croacia) â€” el veterano mÃ¡s elegante del torneo. Bruno Fernandes (Portugal) el mÃ¡s dinÃ¡mico.",fi:"Bruno Fernandes (Portugal) â€” si controla el mediocampo, Portugal gana. MÃ¡s determinante que Cristiano.",ap:"Partido muy parejo Â· Ambos anotan Â· Menos de 3 goles. Cuota Portugal: 2.1x",pr:"Pred: Portugal 1-0"};
ANAL["Croatia_Portugal"]     = ANAL["Portugal_Croatia"];
ANAL["Switzerland_Algeria"]  = {g:"Suiza liderÃ³ el Grupo B con 7 pts â€” 4-1 Bosnia, 2-1 CanadÃ¡. Argelia clasificÃ³ del Grupo J como mejor tercero tras 9 pts perfectos en grupo facilitado. Suiza es favorita pero Argelia llegÃ³ invicta.",go:"Breel Embolo (Suiza) â€” el delantero referente en zona de peligro. Granit Xhaka motor del mediocampo. Islam Slimani o BelaÃ¯li (Argelia) como referente ofensivo.",fi:"Granit Xhaka (Suiza) â€” el motor que hace funcionar todo. Si estÃ¡ bien, Suiza gana.",ap:"Suiza gana Â· Embolo anota Â· Sin empate. Cuota Suiza: 1.7x",pr:"Pred: Suiza 2-0"};
ANAL["Algeria_Switzerland"]  = ANAL["Switzerland_Algeria"];

// 3 Jul â€” RESULTADOS
ANAL["Australia_Egypt"]      = {g:"Egipto eliminÃ³ a Australia en penales (4-2) tras empate 1-1. Emam Ashour abriÃ³ el marcador al 13'. Mohamed Hany anotÃ³ en propia meta para Australia. En la tanda, Salah marcÃ³ un Panenka y Hossam Abdelmaguid cerrÃ³ la clasificaciÃ³n histÃ³rica.",go:"Emam Ashour (Egipto) al 13'. Mohamed Hany (OG, Australia) al ~55'. Salah marcÃ³ con Panenka en la tanda.",fi:"Mohamed Salah (Egipto) â€” Panenka audaz en la tanda y figura total. Primera clasificaciÃ³n a 8vos en la historia de Egipto.",ap:"Partido terminado Â· Egipto clasifica a 8vos vs Argentina (7 jul)",pr:"âœ… Egipto clasifica (1-1, pen 4-2)"};
ANAL["Egypt_Australia"]      = ANAL["Australia_Egypt"];
ANAL["Argentina_Cape Verde"] = {g:"Argentina sufriÃ³ para ganar 3-2 a Cabo Verde en tiempo extra. Messi abriÃ³ al 29', Duarte igualÃ³ al 59'. Lis. MartÃ­nez puso el 2-1 al 92' (AET), Cabral igualÃ³ al 103' con un golazo. Diney Borges anotÃ³ en propia meta al 111' para sellar el pase.",go:"Messi (ARG) al 29'. Duarte (CV) al 59'. Lis. MartÃ­nez (ARG) al 92'. S. Cabral (CV) golazo al 103'. Diney OG (CV) al 111'.",fi:"Lionel Messi (Argentina) â€” asistencia en el gol decisivo. 10 goles en fases eliminatorias histÃ³ricas.",ap:"Partido terminado Â· Argentina clasifica a 8vos vs Egipto (7 jul)",pr:"âœ… Argentina 3-2 Cabo Verde (AET)"};
ANAL["Argentina_Cabo Verde"] = ANAL["Argentina_Cape Verde"];
ANAL["Cape Verde_Argentina"] = ANAL["Argentina_Cape Verde"];
ANAL["Cabo Verde_Argentina"] = ANAL["Argentina_Cape Verde"];
ANAL["Colombia_Ghana"]       = {g:"Colombia ganÃ³ 1-0 a Ghana con un gol tempranero de Jhon Arias al 14', asistido por Luis SuÃ¡rez. James RodrÃ­guez saliÃ³ lesionado al descanso. Colombia fue sÃ³lida y controlÃ³ el partido sin mayores problemas.",go:"Jhon Arias (Colombia) al 14'. Asistencia de Luis SuÃ¡rez. James RodrÃ­guez saliÃ³ por lesiÃ³n al 45'.",fi:"Jhon Arias (Colombia) â€” gol decisivo al 14' para sellar la clasificaciÃ³n de Colombia.",ap:"Partido terminado Â· Colombia clasifica a 8vos vs Suiza (8 jul). âš ï¸ James RodrÃ­guez en duda por lesiÃ³n.",pr:"âœ… Colombia 1-0 Ghana"};
ANAL["Ghana_Colombia"]       = ANAL["Colombia_Ghana"];

// â”€â”€ R16 RESULTADOS (sobreescriben el anÃ¡lisis previo) â”€â”€
ANAL["South Africa_Canada"]  = {g:"CanadÃ¡ hizo historia: primera victoria en fase eliminatoria de un Mundial. Stephen EustÃ¡quio apareciÃ³ al 90+2' con un remate de volea para el 1-0 agÃ³nico. SudÃ¡frica lo intentÃ³ pero no pudo ante la solidez canadiense.",go:"Stephen EustÃ¡quio (CanadÃ¡) â€” el gol histÃ³rico al 90+2' de volea. Alphonso Davies fue un dolor de cabeza constante.",fi:"Stephen EustÃ¡quio (CanadÃ¡) â€” el gol mÃ¡s importante de la historia del fÃºtbol canadiense.",ap:"Partido terminado Â· CanadÃ¡ clasifica a 8vos",pr:"âœ… CanadÃ¡ 1-0 SudÃ¡frica"};
ANAL["Canada_South Africa"]  = ANAL["South Africa_Canada"];
ANAL["Brazil_Japan"]         = {g:"Brasil remontÃ³ de manera agÃ³nica a JapÃ³n con gol de Martinelli al 90+5'. JapÃ³n sorprendiÃ³ con el gol de Sano al 29', pero Casemiro igualÃ³ al 55'. Un final de pelÃ­cula para el Scratch.",go:"Kaishu Sano (JapÃ³n) al 29'. Casemiro (Brasil) al 55'. Gabriel Martinelli (Brasil) el hÃ©roe al 90+5'.",fi:"Gabriel Martinelli (Brasil) â€” el gol mÃ¡s dramÃ¡tico del torneo hasta ahora. EntrÃ³ desde el banco y decidiÃ³.",ap:"Partido terminado Â· Brasil clasifica a 8vos",pr:"âœ… Brasil 2-1 JapÃ³n"};
ANAL["Japan_Brazil"]         = ANAL["Brazil_Japan"];
ANAL["Germany_Paraguay"]     = {g:"Paraguay dio el gran batacazo eliminando a Alemania en penales. El partido terminÃ³ 1-1 tras 90 minutos (0-1 al descanso). Alemania dominÃ³ pero no pudo resolver. Paraguay ganÃ³ 4-3 en la tanda.",go:"Jamal Musiala (Alemania) marcÃ³ el empate. Paraguay igualÃ³ y aguantÃ³ hasta los penales.",fi:"El portero de Paraguay fue la figura absoluta, deteniendo los penales clave de la tanda.",ap:"Partido terminado Â· Paraguay clasifica a 8vos",pr:"âœ… Paraguay clasifica (1-1, pen 4-3)"};
ANAL["Paraguay_Germany"]     = ANAL["Germany_Paraguay"];
ANAL["Netherlands_Morocco"]  = {g:"Marruecos repitiÃ³ la hazaÃ±a de 2022 y eliminÃ³ a PaÃ­ses Bajos en penales. El partido terminÃ³ 1-1 en tiempo reglamentario. Los Leones del Atlas fueron muy sÃ³lidos y ganaron 3-2 en la tanda.",go:"Cody Gakpo (PaÃ­ses Bajos) marcÃ³ el gol holandÃ©s. Marruecos igualÃ³ y aguantÃ³ hasta los penales.",fi:"El portero de Marruecos fue el hÃ©roe absoluto, deteniendo los penales decisivos.",ap:"Partido terminado Â· Marruecos clasifica a 8vos",pr:"âœ… Marruecos clasifica (1-1, pen 3-2)"};
ANAL["Morocco_Netherlands"]  = ANAL["Netherlands_Morocco"];
ANAL["Ivory Coast_Norway"]   = {g:"Noruega venciÃ³ 2-1 a Costa de Marfil en la primera victoria eliminatoria de su historia en un Mundial. Nusa abriÃ³ el marcador, Amad Diallo igualÃ³ al 74', pero Haaland apareciÃ³ en los Ãºltimos minutos para dar el pase a 8vos.",go:"Antonio Nusa (Noruega) abriÃ³ el marcador. Amad Diallo (Costa de Marfil) empatÃ³ al 74'. Erling Haaland (Noruega) marcÃ³ el gol decisivo.",fi:"Erling Haaland (Noruega) â€” el gol cuando mÃ¡s se necesitaba. Decisivo en el momento clave.",ap:"Partido terminado Â· Noruega clasifica a 8vos (primera vez en su historia)",pr:"âœ… Noruega 2-1 Costa de Marfil"};
ANAL["Norway_Ivory Coast"]   = ANAL["Ivory Coast_Norway"];
ANAL["CÃ´te d'Ivoire_Norway"] = ANAL["Ivory Coast_Norway"];
ANAL["Norway_CÃ´te d'Ivoire"] = ANAL["Ivory Coast_Norway"];
ANAL["France_Sweden"]        = {g:"Francia goleÃ³ 3-0 a Suecia y sigue dominante en el torneo. MbappÃ© marcÃ³ dos veces y Barcola sumÃ³ el tercero. MbappÃ© se convirtiÃ³ en el mÃ¡ximo goleador histÃ³rico en fases eliminatorias de Mundiales con 9 goles.",go:"Kylian MbappÃ© (Francia) doblete al 45' y 74'. Bradley Barcola (Francia) al 53'. Suecia no pudo hacer nada.",fi:"Kylian MbappÃ© (Francia) â€” rÃ©cord histÃ³rico de goles en eliminatorias mundialistas. Inalcanzable.",ap:"Partido terminado Â· Francia clasifica a 8vos",pr:"âœ… Francia 3-0 Suecia"};
ANAL["Sweden_France"]        = ANAL["France_Sweden"];
ANAL["Mexico_Ecuador"]       = {g:"MÃ©xico liquidÃ³ a Ecuador con una primera media hora perfecta. QuiÃ±ones al 22' y JimÃ©nez al 31' dieron el 2-0 que el Tri administrÃ³ hasta el final. El anfitriÃ³n sigue invicto en el torneo.",go:"Roberto QuiÃ±ones (MÃ©xico) al 22'. RaÃºl JimÃ©nez (MÃ©xico) al 31'. Ecuador nunca pudo responder.",fi:"RaÃºl JimÃ©nez (MÃ©xico) â€” gol y liderazgo total. El Tri en su mejor nivel en dÃ©cadas.",ap:"Partido terminado Â· MÃ©xico clasifica a 8vos",pr:"âœ… MÃ©xico 2-0 Ecuador"};
ANAL["Ecuador_Mexico"]       = ANAL["Mexico_Ecuador"];
ANAL["England_DR Congo"]     = {g:"Inglaterra remontÃ³ 2-1 a Congo DR tras ir perdiendo. Brian Cipenga sorprendiÃ³ al minuto 7, pero Harry Kane apareciÃ³ dos veces en el segundo tiempo para clasificar a los Tres Leones.",go:"Brian Cipenga (Congo DR) al 7'. Harry Kane (Inglaterra) doblete en el 2do tiempo â€” el capitÃ¡n cuando mÃ¡s se necesita.",fi:"Harry Kane (Inglaterra) â€” dos goles de pura frialdad para remontar el partido.",ap:"Partido terminado Â· Inglaterra clasifica a 8vos vs MÃ©xico",pr:"âœ… Inglaterra 2-1 Congo DR"};
ANAL["England_Congo DR"]     = ANAL["England_DR Congo"];
ANAL["DR Congo_England"]     = ANAL["England_DR Congo"];
ANAL["Congo DR_England"]     = ANAL["England_DR Congo"];
ANAL["Belgium_Senegal"]      = {g:"BÃ©lgica sufriÃ³ enormemente para eliminar a Senegal 3-2 en la prÃ³rroga. Los africanos dominaron 2-0 hasta el 86', pero dos goles en 3 minutos forzaron el alargue. Tielemans marcÃ³ el penal decisivo en el tiempo extra.",go:"Habib Diarra (Senegal) al 24'. Ismaila Sarr (Senegal) al 51'. BÃ©lgica empatÃ³ en el 86' y 89'. Tielemans (BÃ©lgica) penal en prÃ³rroga.",fi:"Tielemans (BÃ©lgica) â€” el penal de la clasificaciÃ³n. La remontada mÃ¡s Ã©pica del torneo.",ap:"Partido terminado Â· BÃ©lgica clasifica a 8vos vs EE.UU.",pr:"âœ… BÃ©lgica 3-2 Senegal (ET)"};
ANAL["Senegal_Belgium"]      = ANAL["Belgium_Senegal"];
ANAL["United States_Bosnia and Herzegovina"] = {g:"EE.UU. venciÃ³ 2-0 a Bosnia con 10 hombres. Balogun abriÃ³ el marcador pero fue expulsado por roja. Tillman sellÃ³ el 2-0 de tiro libre en el descanso. Ã‰pica remontada defensiva.",go:"Folarin Balogun (EE.UU.) gol y roja. Malik Tillman (EE.UU.) golazo de tiro libre para el 2-0.",fi:"Malik Tillman (EE.UU.) â€” su golazo de tiro libre con 10 hombres fue el mÃ¡s importante del partido.",ap:"Partido terminado Â· EE.UU. clasifica a 8vos vs BÃ©lgica (6 jul). âš ï¸ Balogun SUSPENDIDO.",pr:"âœ… EE.UU. 2-0 Bosnia"};
ANAL["Bosnia and Herzegovina_USA"]       = ANAL["United States_Bosnia and Herzegovina"];
ANAL["USA_Bosnia and Herzegovina"]       = ANAL["United States_Bosnia and Herzegovina"];
ANAL["USA_Bosnia"]                       = ANAL["United States_Bosnia and Herzegovina"];
ANAL["United States_Bosnia"]             = ANAL["United States_Bosnia and Herzegovina"];
ANAL["Bosnia_United States"]             = ANAL["United States_Bosnia and Herzegovina"];
ANAL["Bosnia and Herzegovina_United States"] = ANAL["United States_Bosnia and Herzegovina"];
ANAL["United States_Bosnia-Herzegovina"]  = ANAL["United States_Bosnia and Herzegovina"];
ANAL["Bosnia-Herzegovina_United States"]  = ANAL["United States_Bosnia and Herzegovina"];
ANAL["Bosnia-Herzegovina_USA"]            = ANAL["United States_Bosnia and Herzegovina"];

// â”€â”€ 8VOS DE FINAL â€” anÃ¡lisis previo para partidos confirmados â”€â”€
ANAL["Canada_Morocco"]       = {g:"El choque mÃ¡s sorprendente del torneo: los dos equipos revelaciÃ³n. CanadÃ¡ hizo historia con su primera victoria eliminatoria. Marruecos eliminÃ³ a PaÃ­ses Bajos en penales repitiendo la Ã©pica de 2022.",go:"Alphonso Davies (CanadÃ¡) â€” la mayor amenaza. Jonathan David busca mÃ¡s goles. Achraf Hakimi (Marruecos) â€” imparable por banda.",fi:"Achraf Hakimi (Marruecos) â€” el mÃ¡s desequilibrante. Si estÃ¡ libre, Marruecos pasa.",ap:"Partido muy parejo Â· Marruecos leve favorita. Cuota empate: 3.0x",pr:"✅ Marruecos 3-0 Canadá"};
ANAL["Morocco_Canada"]       = ANAL["Canada_Morocco"];
ANAL["Paraguay_France"]      = {g:"Paraguay eliminÃ³ a Alemania en penales â€” el batacazo del torneo. Ahora enfrenta a Francia, la selecciÃ³n mÃ¡s en forma. MbappÃ© viene de hacer historia con 9 goles en eliminatorias mundialistas. Paraguay tendrÃ¡ que hacer el partido perfecto.",go:"Kylian MbappÃ© (Francia) â€” 4 goles en el torneo, en estado de gracia. Barcola tambiÃ©n amenaza.",fi:"Kylian MbappÃ© (Francia) â€” si estÃ¡ en el dÃ­a, el partido se termina en el primer tiempo.",ap:"Francia amplia favorita Â· MbappÃ© anota Â· MÃ¡s de 2 goles. Cuota Francia: 1.5x",pr:"Pred: Francia 3-0"};
ANAL["France_Paraguay"]      = ANAL["Paraguay_France"];
ANAL["Brazil_Norway"]        = {g:"El duelo de goleadores del torneo: VinÃ­cius Jr vs Erling Haaland. Brasil remontÃ³ agÃ³nicamente a JapÃ³n con Martinelli al 90+5'. Noruega venciÃ³ 2-1 a Costa de Marfil con Haaland decisivo. El partido mÃ¡s atractivo de los 8vos.",go:"VinÃ­cius Jr (Brasil) â€” 3 goles en grupos, amenaza constante. Erling Haaland (Noruega) â€” 5 goles, imparable en Ã¡rea.",fi:"Erling Haaland (Noruega) â€” si recibe bien frente al arco, anota. El mÃ¡s letal del torneo.",ap:"Brasil leve favorita Â· Ambos anotan Â· MÃ¡s de 2.5 goles. Cuota Brasil: 1.9x",pr:"Pred: Brasil 2-1"};
ANAL["Norway_Brazil"]        = ANAL["Brazil_Norway"];
ANAL["England_Mexico"]       = {g:"El duelo mÃ¡s esperado de los 8vos: Inglaterra eliminÃ³ a Congo DR remontando 2-1, MÃ©xico arrasÃ³ en grupos con 9 pts y goleÃ³ 2-0 a Ecuador. Dos anfitriones potentes que se miden en un choque histÃ³rico.",go:"Harry Kane (Inglaterra) â€” dos goles de remontada ante Congo. Alexis Vega y QuiÃ±ones (MÃ©xico) en gran nivel.",fi:"Jude Bellingham (Inglaterra) â€” el jugador mÃ¡s completo del torneo. Si aparece, Inglaterra gana.",ap:"Partido muy parejo Â· Ambos anotan Â· Sin empate. Cuota empate: 3.2x",pr:"Pred: Inglaterra 2-1"};
ANAL["Mexico_England"]       = ANAL["England_Mexico"];
ANAL["United States_Belgium"] = {g:"EE.UU. venciÃ³ 2-0 a Bosnia aunque terminÃ³ con 10 hombres (roja de Balogun). BÃ©lgica sufriÃ³ la remontada mÃ¡s Ã©pica del torneo: de 0-2 a 3-2 en la prÃ³rroga ante Senegal. Dos equipos golpeados que van a todo. âš ï¸ Balogun SUSPENDIDO para EE.UU.",go:"Balogun suspendido â€” Pulisic liderarÃ¡ el ataque de EE.UU. Tielemans y De Bruyne (BÃ©lgica) como cerebros.",fi:"Kevin De Bruyne (BÃ©lgica) â€” si aparece en su mejor versiÃ³n, BÃ©lgica gana cÃ³modo.",ap:"BÃ©lgica favorita leve Â· De Bruyne decisivo. Cuota BÃ©lgica: 1.9x",pr:"Pred: BÃ©lgica 2-1"};
ANAL["Belgium_United States"] = ANAL["United States_Belgium"];
ANAL["Belgium_USA"]           = ANAL["United States_Belgium"];
ANAL["USA_Belgium"]           = ANAL["United States_Belgium"];
ANAL["Spain_Portugal"]        = {g:"El Derby IbÃ©rico mÃ¡s importante de la historia: el primer EspaÃ±a vs Portugal en un Mundial. EspaÃ±a arrasÃ³ 3-0 a Austria con Oyarzabal magistral. Portugal remontÃ³ agÃ³nicamente a Croacia con Ramos al 90+4'. Duelo de sistemas perfectos contra jerarquÃ­a histÃ³rica.",go:"Lamine Yamal (EspaÃ±a) â€” el niÃ±o prodigio que desborda a cualquier marcador. Cristiano Ronaldo (Portugal) â€” penal y liderazgo. Rodri el metrÃ³nomo espaÃ±ol.",fi:"Lamine Yamal (EspaÃ±a) â€” 17 aÃ±os haciendo historia. Si estÃ¡ libre, EspaÃ±a gana cÃ³modo.",ap:"EspaÃ±a favorita leve Â· Ambos anotan Â· Gol de Ronaldo. Cuota EspaÃ±a: 1.8x",pr:"Pred: EspaÃ±a 2-1"};
ANAL["Portugal_Spain"]        = ANAL["Spain_Portugal"];
ANAL["Argentina_Switzerland"] = {g:"Argentina llegÃ³ sufriendo tras el Ã©pico 3-2 (AET) ante Cabo Verde con Messi en modo histÃ³rico (7 goles). Suiza fue sÃ³lida y contundente: 2-0 a Argelia sin complicaciones. La Albiceleste tiene mÃ¡s jerarquÃ­a pero viene desgastada de la prÃ³rroga.",go:"Lionel Messi (Argentina) â€” 7 goles en el torneo, imparable. Xherdan Shaqiri (Suiza) â€” creativo y peligroso. Embolo amenaza el Ã¡rea.",fi:"Lionel Messi (Argentina) â€” el mejor del mundo cuando el torneo lo necesita. Si aparece, Argentina gana.",ap:"Argentina favorita Â· Messi anota Â· 1+ goles Suiza. Cuota Argentina: 1.6x",pr:"Pred: Argentina 2-1"};
ANAL["Switzerland_Argentina"] = ANAL["Argentina_Switzerland"];
ANAL["Egypt_Colombia"]        = {g:"Egipto es el equipo revelaciÃ³n del torneo: primera vez en 8vos, Salah con panenka Ã©pico en penales. Colombia venciÃ³ 1-0 a Ghana con Arias, pero James RodrÃ­guez saliÃ³ lesionado. El partido del corazÃ³n vs la tÃ¡ctica.",go:"Mohamed Salah (Egipto) â€” el capitÃ¡n histÃ³rico que inspirÃ³ la clasificaciÃ³n. Jhon Arias (Colombia) â€” autor del gol vs Ghana. âš ï¸ James RodrÃ­guez en duda.",fi:"Mohamed Salah (Egipto) â€” si estÃ¡ en el dÃ­a, el partido es otro. Su panenka fue icÃ³nica.",ap:"Colombia favorita leve Â· Salah anota Â· Sin empate. âš ï¸ Confirmar estado de James. Cuota Colombia: 1.8x",pr:"Pred: Colombia 2-1"};
ANAL["Colombia_Egypt"]        = ANAL["Egypt_Colombia"];

function getAnal(home, away) {
  if (!home || !away) return null;
  // Normalizar apostrofes y caracteres especiales
  function norm(s) {
    return s.replace(/â€™/g,"'").replace(/â€˜/g,"'").replace(/Ã©/g,"e")
            .replace(/Ã´/g,"o").replace(/Ã¨/g,"e").replace(/Ã¼/g,"u")
            .replace(/Ã¤/g,"a").replace(/Ã¶/g,"o").replace(/Ã©/g,"e");
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
    "IR Iran":"Iran","CuraÃ§ao":"Curacao","CÃ´te d'Ivoire":"Ivory Coast",
    "Bosnia and Herzegovina":"Bosnia","Bosnia-Herzegovina":"Bosnia","Cape Verde Islands":"Cabo Verde",
    "Cape Verde":"Cabo Verde","South Korea":"Korea Republic","United States":"USA",
    "CÃ´te d'Ivoire":"Ivory Coast","CÃ´te d\'Ivoire":"Ivory Coast"
  };
  var h2 = fixes[home] || fixes[h] || home;
  var a2 = fixes[away] || fixes[a] || away;
  var combos2 = [[h2,a2],[a2,h2],[home,a2],[a2,home],[h2,away],[away,h2]];
  for (var ci=0; ci<combos2.length; ci++) {
    var k = combos2[ci][0]+"_"+combos2[ci][1];
    if (ANAL[k]) return ANAL[k];
  }
  // BÃºsqueda flexible por palabras clave
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

// â”€â”€ ALINEACIONES PROBABLES â”€â”€
var ALIN = {};
ALIN["England_DR Congo"] = {
  fH:"4-2-3-1", h:["Pickford","O'Reilly","Stones","Konsa","R. James","Rice","E. Anderson","Gordon","Bellingham","Madueke","Kane"],
  fA:"3-4-1-2", a:["Mpasi","Kapuadi","Mbemba","Tuanzebe","Wan-Bissaka","Moutoussamy","Sadiki","Masuaku","Mukau","Bakambu","Wissa"],
  tarH:[], tarA:[], tarNote:"Amarillas de fase de grupos borradas. Pizarra limpia en 16avos."
};
ALIN["England_Congo DR"]       = ALIN["England_DR Congo"];
ALIN["Belgium_Senegal"] = {
  fH:"4-2-3-1", h:["Courtois","Castagne","Mechele","Ngoy","De Cuyper","Vanaken","Tielemans","Doku","De Bruyne","Trossard","De Ketelaere"],
  fA:"4-3-3",   a:["M. Diaw","Diatta","Seck","NiakhatÃ©","Diouf","I. Gueye","Camara","P. Gueye","ManÃ©","Sarr","I. Ndiaye"],
  tarH:[], tarA:[], tarNote:"Amarillas de fase de grupos borradas. âš ï¸ Mendy (Senegal) lesionado â€” juega Mory Diaw."
};
ALIN["United States_Bosnia and Herzegovina"] = {
  fH:"4-2-3-1", h:["Freese","Freeman","Richards","Ream","Robinson","Adams","Tillman","Dest","McKennie","Pulisic","Balogun"],
  fA:"4-4-2",   a:["Vasilj","MemiÄ‡","KatiÄ‡","MuharemoviÄ‡","KolaÅ¡inac","AlajbegoviÄ‡","BaÅ¡iÄ‡","Å unjiÄ‡","BajraktareviÄ‡","DemiroviÄ‡","DÅ¾eko"],
  tarH:[], tarA:[], tarNote:"Amarillas de fase de grupos borradas. Pizarra limpia en 16avos."
};
ALIN["USA_Bosnia and Herzegovina"] = ALIN["United States_Bosnia and Herzegovina"];
ALIN["USA_Bosnia"]                 = ALIN["United States_Bosnia and Herzegovina"];
ALIN["Spain_Austria"] = {
  fH:"4-3-3",   h:["Unai SimÃ³n","Llorente","CubarsÃ­","Laporte","Cucurella","Pedri","Rodri","Dani Olmo","L. Yamal","Oyarzabal","Ãlex Baena"],
  fA:"4-2-3-1", a:["Schlager","Posch","Alaba","Lienhart","Mwene","X. Schlager","Seiwald","Sabitzer","Schmid","Laimer","Arnautovic"],
  tarH:[], tarA:[], tarNote:"Pizarra limpia. EspaÃ±a llega como favorita con todo su once titular."
};
ALIN["Austria_Spain"] = ALIN["Spain_Austria"];
ALIN["Portugal_Croatia"] = {
  fH:"4-2-3-1", h:["D. Costa","Dalot","R. Dias","G. InÃ¡cio","Nuno Mendes","J. Neves","Vitinha","F. ConceiÃ§Ã£o","B. Fernandes","R. LeÃ£o","Cristiano Ronaldo"],
  fA:"4-2-3-1", a:["LivakoviÄ‡","StaniÅ¡iÄ‡","Caleta-Car","Gvardiol","ErliÄ‡","KovaÄiÄ‡","ModriÄ‡","P. SuÄiÄ‡","PaÅ¡aliÄ‡","VlaÅ¡iÄ‡","KramariÄ‡"],
  tarH:[], tarA:[], tarNote:"âš ï¸ ModriÄ‡ (Croacia) en duda por molestias. El duelo mÃ¡s parejo del dÃ­a."
};
ALIN["Croatia_Portugal"] = ALIN["Portugal_Croatia"];
ALIN["Switzerland_Algeria"] = {
  fH:"4-2-3-1", h:["Kobel","R. RodrÃ­guez","Akanji","Elvedi","Jacquet","Xhaka","Freuler","Vargas","Manzambi","Sow","Embolo"],
  fA:"4-2-3-1", a:["L. Zidane","Belghali","Mandi","Bensebaini","AÃ¯t-Nouri","Bentaleb","ChaÃ¯bi","Mahrez","Maza","Aouar","Gouiri"],
  tarH:[], tarA:[], tarNote:"âš ï¸ Manzambi (Suiza) lleva 3 goles en el torneo â€” su mejor versiÃ³n. Mahrez (Argelia) capitÃ¡n y referente."
};
ALIN["Algeria_Switzerland"] = ALIN["Switzerland_Algeria"];

// --- 3 julio ---
ALIN["Australia_Egypt"] = {
  fH:"3-4-2-1", h:["Beach","Circati","Souttar","Herrington","Bos","Irvine","O'Neill","Behich","Volpato","Metcalfe","Irankunda"],
  fA:"4-2-3-1", a:["Shobeir","M. Hany","Y. Ibrahim","Rabia","Hafez","Ateya","Fathy","Ziko","Salah","Ashour","Marmoush"],
  tarH:[], tarA:[], tarNote:"Australia sale con sistema de 3 centrales. Irankunda (19 aÃ±os) como punta. Egipto con Salah+Marmoush como dupla letal."
};
ALIN["Egypt_Australia"] = ALIN["Australia_Egypt"];

ALIN["Argentina_Cape Verde"] = {
  fH:"4-2-3-1", h:["E. MartÃ­nez","Molina","C. Romero","Lis. MartÃ­nez","Medina","Mac Allister","E. FernÃ¡ndez","De Paul","Almada","Messi","Lautaro"],
  fA:"4-1-4-1", a:["Vozinha","Moreira","Pico","Diney","S. Cabral","Lenini","R. Mendes","Duarte","Monteiro","J. Cabral","Livramento"],
  tarH:[], tarA:[], tarNote:"Messi busca su primer 16avos a los 38 aÃ±os. Cabo Verde sorpresa del torneo â€” Vozinha figura bajo palos."
};
ALIN["Cape Verde_Argentina"]  = ALIN["Argentina_Cape Verde"];
ALIN["Argentina_Cabo Verde"]  = ALIN["Argentina_Cape Verde"];
ALIN["Cabo Verde_Argentina"]  = ALIN["Argentina_Cape Verde"];

ALIN["Colombia_Ghana"] = {
  fH:"4-3-3", h:["Vargas","MuÃ±oz","LucumÃ­","SÃ¡nchez","Mojica","Lerma","Puerta","Arias","J. RodrÃ­guez","SuÃ¡rez","L. DÃ­az"],
  fA:"4-5-1", a:["Asare","Senaya","Adjetey","Luckassen","Mensah","Sulemana","Partey","Owusu","Sibo","Semenyo","Ayew"],
  tarH:[], tarA:[], tarNote:"James RodrÃ­guez y Luis DÃ­az lideran a Colombia. Thomas Partey ancla el mediocampo ghanÃ©s. âš ï¸ Zigi (portero titular Ghana) lesionado, juega Asare."
};
ALIN["Ghana_Colombia"] = ALIN["Colombia_Ghana"];

// --- 4 julio â€” 8vos de Final ---
ALIN["Canada_Morocco"] = {
  fH:"4-3-3", h:["Crepeau","Johnston","Miller","Bombito","Davies","Eustaquio","Piette","Kone","David","Larin","Buchanan"],
  fA:"4-3-3", a:["Bounou","Hakimi","El Yamiq","Aguerd","Mazraoui","Ounahi","Amrabat","Bennacer","Ziyech","En-Nesyri","Brahim Diaz"],
  tarH:[], tarA:[], tarNote:"Duelo de sorpresas del torneo. Davies y David vs la muralla de Amrabat. Hakimi desequilibrante por derecha. Marruecos leve favorita."
};
ALIN["Morocco_Canada"] = ALIN["Canada_Morocco"];
ALIN["Paraguay_France"] = {
  fH:"5-4-1", h:["Gatito Fernandez","Alderete","Balbuena","Alonso","Villasanti","Sanabria","Enciso","Camacho","Cubas","Almada","Bareiro"],
  fA:"4-3-3", a:["Maignan","Kounde","Upamecano","Saliba","Hernandez","Tchouameni","Camavinga","Rabiot","Dembele","Mbappe","Barcola"],
  tarH:[], tarA:[], tarNote:"Paraguay eliminÃ³ a Alemania en penales â€” el batacazo del torneo. Francia sin conceder en 8vos histÃ³ricos. MbappÃ© en estado de gracia con 4 goles. Francia amplÃ­sima favorita."
};
ALIN["France_Paraguay"] = ALIN["Paraguay_France"];

// --- 8vos restantes ---
ALIN["Brazil_Norway"] = {
  fH:"4-2-3-1", h:["Ederson","Militao","Marquinhos","Gabriel","Guilherme","Casemiro","Gomes","Raphinha","Rodrygo","Vinicius Jr","Endrick"],
  fA:"4-3-3", a:["Nyland","Ryerson","Ostigard","Skjelvik","Meling","Aursnes","Amdouni","Odegaard","Nusa","Haaland","Sorloth"],
  tarH:[], tarA:[], tarNote:"El duelo mÃ¡s atractivo de los 8vos: VinÃ­cius Jr vs Haaland. Brasil con potencia ofensiva brutal. Haaland (5 goles) es el mÃ¡s letal del torneo. Ã˜degaard el cerebro noruego."
};
ALIN["Norway_Brazil"] = ALIN["Brazil_Norway"];
ALIN["England_Mexico"] = {
  fH:"4-3-3", h:["Flaherty","Alexander-Arnold","Guehi","Stones","Shaw","Bellingham","Rice","Gallagher","Saka","Kane","Foden"],
  fA:"4-3-3", a:["Ochoa","Sanchez","Montes","Vasquez","Gallardo","Herrera","Alvarez","Romo","QuiÃ±ones","Jimenez","Vega"],
  tarH:[], tarA:[], tarNote:"Harry Kane (doblete vs Congo) lidera a Inglaterra. MÃ©xico invicto con 9 pts en grupos. Bellingham el jugador mÃ¡s completo del torneo. Un choque Ã©pico entre dos anfitriones."
};
ALIN["Mexico_England"] = ALIN["England_Mexico"];
ALIN["United States_Belgium"] = {
  fH:"4-3-3", h:["Turner","Dest","Richards","Long","Robinson","Adams","Musah","Tillman","Pulisic","Mckennie","Freeman"],
  fA:"4-2-3-1", a:["Mignolet","Castagne","Faes","Debast","Theate","Onana","Mangala","Tielemans","De Bruyne","Doku","Lukaku"],
  tarH:[], tarA:[], tarNote:"âš ï¸ Balogun SUSPENDIDO por roja vs Bosnia. Pulisic lidera el ataque americano. Kevin De Bruyne el gran favorito individual del partido. EE.UU. con hambre de historia."
};
ALIN["Belgium_United States"] = ALIN["United States_Belgium"];
ALIN["Belgium_USA"] = ALIN["United States_Belgium"];
ALIN["USA_Belgium"] = ALIN["United States_Belgium"];
ALIN["Spain_Portugal"] = {
  fH:"4-2-3-1", h:["SimÃ³n","Porro","Laporte","Cubarsi","Cucurella","Rodri","Pedri","Yamal","Olmo","Baena","Oyarzabal"],
  fA:"4-2-3-1", a:["Costa","Dalot","Dias","InÃ¡cio","Mendes","Neves","Vitinha","B. Fernandes","LeÃ£o","Ronaldo","G. Ramos"],
  tarH:[], tarA:[], tarNote:"El Derby IbÃ©rico mÃ¡s grande de la historia. EspaÃ±a con Yamal (17 aÃ±os) imbatible. Ronaldo y Ramos la dupla de ataque portuguesa. Rodri vs Vitinha el duelo de mediocentros del torneo."
};
ALIN["Portugal_Spain"] = ALIN["Spain_Portugal"];
ALIN["Argentina_Switzerland"] = {
  fH:"4-4-2", h:["E. MartÃ­nez","Molina","Romero","Lis. MartÃ­nez","Medina","Mac Allister","E. FernÃ¡ndez","De Paul","Almada","Messi","J. Ãlvarez"],
  fA:"4-2-3-1", a:["Kobel","Widmer","Akanji","Elvedi","Rodriguez","Freuler","Xhaka","Ndoye","Shaqiri","Embolo","Vargas"],
  tarH:[], tarA:[], tarNote:"Messi viene de 7 goles â€” rÃ©cord histÃ³rico en un Mundial. Argentina desgastada tras AET vs Cabo Verde. Suiza eficiente y descansada. Xhaka el motor suizo. Argentina favorita pero alerta."
};
ALIN["Switzerland_Argentina"] = ALIN["Argentina_Switzerland"];
ALIN["Egypt_Colombia"] = {
  fH:"4-4-2", h:["Shobeir","M. Hany","Y. Ibrahim","Rabia","Hafez","Ateya","Fathy","Ashour","Salah","Marmoush","Ziko"],
  fA:"4-3-3", a:["Vargas","MuÃ±oz","LucumÃ­","SÃ¡nchez","Mojica","Lerma","Puerta","Arias","J. RodrÃ­guez","SuÃ¡rez","L. DÃ­az"],
  tarH:[], tarA:[], tarNote:"Mohamed Salah (Panenka icÃ³nico en penales) lidera la sorpresa de Egipto. Colombia con duda de James RodrÃ­guez (lesiÃ³n). Jhon Arias y Luis DÃ­az los diferenciadores colombianos."
};
ALIN["Colombia_Egypt"] = ALIN["Egypt_Colombia"];

function getAlin(home, away) {
  if (!home || !away) return null;
  var tries = [home+"_"+away, away+"_"+home];
  for (var i=0;i<tries.length;i++) { if(ALIN[tries[i]]) return ALIN[tries[i]]; }
  var keys = Object.keys(ALIN);
  for (var i=0;i<keys.length;i++) {
    var p = keys[i].split("_"); if(p.length<2) continue;
    var kh=p[0].toLowerCase(), ka=p[1].toLowerCase(), sh=home.toLowerCase(), sa=away.toLowerCase();
    if((sh.indexOf(kh)>=0||kh.indexOf(sh)>=0)&&(sa.indexOf(ka)>=0||ka.indexOf(sa)>=0)) return ALIN[keys[i]];
    if((sh.indexOf(ka)>=0||ka.indexOf(sh)>=0)&&(sa.indexOf(kh)>=0||kh.indexOf(sa)>=0)) return ALIN[keys[i]];
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
  var sLabel = done ? "âœ… Final" : live ? "ðŸ”´ EN VIVO" : "â° PrÃ³ximo";
  var sColor = done ? "#4ade80" : live ? "#f87171" : "#60a5fa";
  var hora = clHour(m.utcDate);
  var fecha = clDateShort(m.utcDate);
  var venue = m.venue || "";
  var anal = getAnal(hName, aName);
  var alin = getAlin(hName, aName);
  // isPostMatch: true cuando ANAL tiene datos del partido real (pr empieza con âœ…), false cuando es anÃ¡lisis previo
  var isPostMatch = anal && anal.pr && anal.pr.indexOf("Pred") !== 0;

  // Score â€” para partidos con penales usar regularTime (90 min real)
  var penH = m.score && m.score.penalties ? m.score.penalties.home : null;
  var penA = m.score && m.score.penalties ? m.score.penalties.away : null;
  var hasPen = penH !== null && penA !== null;
  var hG, aG;
  if (hasPen && m.score.regularTime) {
    hG = m.score.regularTime.home; aG = m.score.regularTime.away;
  } else {
    hG = m.score && m.score.fullTime ? m.score.fullTime.home : null;
    aG = m.score && m.score.fullTime ? m.score.fullTime.away : null;
    if (hG === null && m.score && m.score.regularTime) { hG = m.score.regularTime.home; aG = m.score.regularTime.away; }
  }
  if (hG === null && done && m.score) {
    if (m.score.winner === "HOME_TEAM") { hG = 1; aG = 0; }
    else if (m.score.winner === "AWAY_TEAM") { hG = 0; aG = 1; }
    else if (m.score.winner === "DRAW") { hG = 0; aG = 0; }
  }
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

  // â”€â”€ HT / FT scores â”€â”€
  var htH = m.score && m.score.halfTime ? m.score.halfTime.home : null;
  var htA = m.score && m.score.halfTime ? m.score.halfTime.away : null;

  // â”€â”€ Datos de API-Football (cache) â”€â”€
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
        + '<span style="font-size:11px;">âš½</span>'
        + '<span style="font-size:11px;color:#e2e8f0;">' + pName + '</span>' + typeTag
        + '</div>';
      if (isHome) goalItemsL.push(row); else goalItemsA.push(row);
    } else if (ev.type === "Card") {
      var isRed = ev.detail === "Red Card" || ev.detail === "Red Card (Second Yellow)";
      var em = isRed ? "ðŸŸ¥" : "ðŸŸ¨";
      var teamLabel = isHome ? hN : aN;
      cardItems.push('<div style="display:flex;align-items:center;gap:5px;padding:2px 0;">'
        + '<span>' + em + '</span>'
        + '<span style="font-size:10px;color:#94a3b8;min-width:26px;">' + minStr + '</span>'
        + '<span style="font-size:11px;color:#e2e8f0;">' + pName + '</span>'
        + '<span style="font-size:9px;color:#64748b;margin-left:2px;">(' + teamLabel + ')</span>'
        + '</div>');
    }
  });

  // EstadÃ­sticas
  var hStMap = {}, aStMap = {};
  if (afStats.length >= 2) {
    (afStats[0].statistics || []).forEach(function(s){ hStMap[s.type] = s.value; });
    (afStats[1].statistics || []).forEach(function(s){ aStMap[s.type] = s.value; });
  }
  var ST_DEFS = [
    {k:"Total Shots",       lb:"Remates"},
    {k:"Shots on Goal",     lb:"Remates al arco"},
    {k:"Ball Possession",   lb:"PosesiÃ³n",       pct:true},
    {k:"Total passes",      lb:"Pases"},
    {k:"Passes %",          lb:"PrecisiÃ³n pases", pct:true},
    {k:"Fouls",             lb:"Faltas",          inv:true},
    {k:"Yellow Cards",      lb:"Tarjetas Amarillas", inv:true},
    {k:"Red Cards",         lb:"Tarjetas Rojas",  inv:true},
    {k:"Offsides",          lb:"Fuera de juego",  inv:true},
    {k:"Corner Kicks",      lb:"CÃ³rners"}
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
        + '<div style="font-size:20px;font-weight:900;color:#60a5fa;">' + htH + ' â€“ ' + htA + '</div></div>'
        + '<div style="width:1px;height:30px;background:rgba(255,255,255,0.1);"></div>'
        + '<div style="text-align:center;"><div style="font-size:9px;color:#64748b;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.5px;">' + (hasPen ? '90 min' : 'Final') + '</div>'
        + '<div style="font-size:20px;font-weight:900;color:#4ade80;">' + hG + ' â€“ ' + aG + '</div></div>'
        + (hasPen ? '<div style="width:1px;height:30px;background:rgba(255,255,255,0.1);"></div>'
          + '<div style="text-align:center;"><div style="font-size:9px;color:#fbbf24;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.5px;font-weight:700;">Penales</div>'
          + '<div style="font-size:20px;font-weight:900;color:#fbbf24;">' + penH + ' â€“ ' + penA + '</div></div>' : '')
        + '</div>';
      marcHTML = secBox("#60a5fa", "ðŸ“Š Marcador", marcInner);
    }
    var golesHTML = "";
    if (hasEvents) {
      var gRowsHTML = '<div style="display:flex;gap:4px;">'
        + '<div style="flex:1;border-right:1px solid rgba(255,255,255,0.06);padding-right:6px;">'
        + '<div style="font-size:9px;color:#94a3b8;font-weight:700;margin-bottom:3px;">' + hF + ' ' + hN + '</div>'
        + (goalItemsL.length ? goalItemsL.join("") : '<div style="font-size:10px;color:#475569;padding:2px 0;">â€“</div>')
        + '</div><div style="flex:1;padding-left:6px;">'
        + '<div style="font-size:9px;color:#94a3b8;font-weight:700;margin-bottom:3px;">' + aF + ' ' + aN + '</div>'
        + (goalItemsA.length ? goalItemsA.join("") : '<div style="font-size:10px;color:#475569;padding:2px 0;">â€“</div>')
        + '</div></div>';
      golesHTML = secBox("#4ade80", "âš½ Goles", gRowsHTML);
    } else if (anal && anal.go && isPostMatch) {
      golesHTML = secBox("#fbbf24", "âš½ Goleadores", '<span style="font-size:11px;color:#cbd5e1;line-height:1.7;">' + anal.go + '</span>');
    }
    var tarjHTML = cardItems.length ? secBox("#fbbf24", "ðŸŸ¨ Tarjetas", cardItems.join("")) : "";
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
      statTableHTML = secBox("#c084fc", "ðŸ“ˆ EstadÃ­sticas", stHeader + stRows);
    }
    statsHTML = marcHTML + golesHTML + tarjHTML + statTableHTML;
  }

  var betLink = '<a style="display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#1a6b1a,#0f4a0f);border:2px solid #4ade80;border-radius:10px;padding:10px;color:#fff;font-weight:800;font-size:13px;text-decoration:none;margin-top:6px;" href="https://www.jugabet.cl" target="_blank">ðŸŽ° Apostar en Jugabet Chile</a>';
  var analHTML = "";
  if (anal) {
    if (done) {
      if (isPostMatch) {
        // Tenemos datos reales del partido â†’ mostrar resumen y figura
        analHTML = '<div style="display:flex;flex-direction:column;gap:5px;margin-top:4px;">'
          + (anal.pr ? '<div style="background:linear-gradient(135deg,#1a3a1a,#0a1f0a);border:1px solid #4ade80;border-radius:8px;padding:6px 12px;text-align:center;font-size:13px;font-weight:800;color:#4ade80;">' + anal.pr + "</div>" : "")
          + secBox("#4ade80","ðŸŽ¬ Resumen del partido",'<span style="font-size:11px;color:#cbd5e1;line-height:1.6;">' + anal.g + '</span>')
          + secBox("#60a5fa","â­ Figura del partido",'<span style="font-size:11px;color:#cbd5e1;line-height:1.6;">' + anal.fi + '</span>')
          + betLink + "</div>";
      } else {
        // Solo anÃ¡lisis previo disponible â†’ no mostrar predicciones como datos reales
        analHTML = '<div style="margin-top:6px;">' + betLink + '</div>';
      }
    } else {
      var predHTML = anal.pr ? '<div style="background:linear-gradient(135deg,#1a3a1a,#0a1f0a);border:1px solid #4ade80;border-radius:8px;padding:6px 12px;margin-bottom:6px;text-align:center;font-size:13px;font-weight:800;color:#4ade80;">' + anal.pr + "</div>" : "";
      analHTML = '<div style="display:flex;flex-direction:column;gap:5px;margin-top:8px;">'
        + predHTML
        + '<div style="border-left:3px solid #4ade80;border-radius:7px;padding:7px 10px;background:rgba(0,0,0,.25);"><div style="font-size:10px;color:#4ade80;font-weight:700;margin-bottom:2px;">ðŸ† AnÃ¡lisis</div><div style="font-size:11px;color:#cbd5e1;line-height:1.6;">' + anal.g + "</div></div>"
        + '<div style="border-left:3px solid #fbbf24;border-radius:7px;padding:7px 10px;background:rgba(0,0,0,.25);"><div style="font-size:10px;color:#fbbf24;font-weight:700;margin-bottom:2px;">âš½ Goleadores a seguir</div><div style="font-size:11px;color:#cbd5e1;line-height:1.6;">' + anal.go + "</div></div>"
        + '<div style="border-left:3px solid #60a5fa;border-radius:7px;padding:7px 10px;background:rgba(0,0,0,.25);"><div style="font-size:10px;color:#60a5fa;font-weight:700;margin-bottom:2px;">â­ Figura clave</div><div style="font-size:11px;color:#cbd5e1;line-height:1.6;">' + anal.fi + "</div></div>"
        + '<div style="border-left:3px solid #c084fc;border-radius:7px;padding:7px 10px;background:rgba(0,0,0,.25);"><div style="font-size:10px;color:#c084fc;font-weight:700;margin-bottom:2px;">ðŸ’° Apuesta / Info</div><div style="font-size:11px;color:#cbd5e1;line-height:1.6;">' + anal.ap + "</div></div>"
        + betLink + "</div>";
    }
  }

  // â”€â”€ AlineaciÃ³n probable (solo para prÃ³ximos) â”€â”€
  var lineupHTML = "";
  if (!done && !live && alin) {
    var playerRow = function(players, flipped) {
      return players.map(function(p, i) {
        return '<div style="display:flex;align-items:center;gap:4px;padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.04);">'
          + (flipped
            ? '<span style="flex:1;font-size:11px;color:#e2e8f0;text-align:right;">' + p + '</span><span style="font-size:10px;color:#4ade80;min-width:16px;text-align:right;">' + (i+1) + '</span>'
            : '<span style="font-size:10px;color:#4ade80;min-width:16px;">' + (i+1) + '</span><span style="flex:1;font-size:11px;color:#e2e8f0;">' + p + '</span>')
          + '</div>';
      }).join("");
    };
    var lineupInner = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0;">'
      + '<div style="padding-right:8px;border-right:1px solid rgba(255,255,255,0.06);">'
      + '<div style="font-size:9px;color:#94a3b8;font-weight:700;margin-bottom:4px;">' + hF + ' ' + hN + '<span style="color:#64748b;margin-left:4px;">(' + alin.fH + ')</span></div>'
      + playerRow(alin.h, false)
      + '</div>'
      + '<div style="padding-left:8px;">'
      + '<div style="font-size:9px;color:#94a3b8;font-weight:700;margin-bottom:4px;">' + aF + ' ' + aN + '<span style="color:#64748b;margin-left:4px;">(' + alin.fA + ')</span></div>'
      + playerRow(alin.a, false)
      + '</div>'
      + '</div>'
      + (alin.tarNote ? '<div style="margin-top:7px;padding:5px 8px;background:rgba(251,191,36,0.08);border-left:3px solid #fbbf24;border-radius:4px;font-size:10px;color:#fbbf24;">' + alin.tarNote + '</div>' : '')
      + (alin.tarH && alin.tarH.length ? '<div style="margin-top:4px;font-size:10px;color:#f87171;">ðŸŸ¨ ' + hN + ': ' + alin.tarH.join(", ") + '</div>' : '')
      + (alin.tarA && alin.tarA.length ? '<div style="margin-top:2px;font-size:10px;color:#f87171;">ðŸŸ¨ ' + aN + ': ' + alin.tarA.join(", ") + '</div>' : '');
    lineupHTML = '<div style="margin-bottom:8px;background:rgba(0,0,0,0.18);border-radius:8px;overflow:hidden;">'
      + '<div style="padding:4px 9px;background:rgba(0,0,0,0.25);font-size:9px;font-weight:800;color:#60a5fa;text-transform:uppercase;letter-spacing:0.5px;">ðŸ‘¥ Alineaciones probables</div>'
      + '<div style="padding:8px 9px;">' + lineupInner + '</div>'
      + '</div>';
  }

  var detailHTML = '<div id="' + cid + '" style="display:none;margin-top:10px;border-top:1px solid #1e2d45;padding-top:9px;">'
    + statsHTML
    + lineupHTML
    + '<div style="font-size:10px;color:#64748b;margin-bottom:' + (analHTML ? "8px" : "0") + ';">ðŸ“… ' + fecha + " Â· ðŸ• " + hora + " Chile" + (venue ? " Â· ðŸŸ " + venue : "") + "</div>"
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
    + '<span class="arr" style="font-size:9px;color:#4ade80;flex-shrink:0;">â–¼</span>'
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
      + '<td style="text-align:center;color:' + (i<2?"#4ade80":"#64748b") + ';font-weight:700;">' + (i<2?"âœ“":i+1) + "</td>"
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
    + '<div style="padding:7px 13px;border-top:1px solid #1e2d45;font-size:10px;color:#4ade80;">âœ“ Clasifican los 2 primeros + 8 mejores terceros</div>'
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

  // â”€â”€ API-Football: fetch events + stats para partidos sin cache â”€â”€
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

  // Mapeo manual fd match ID â†’ ESPN event ID (para partidos R32 con nombres genÃ©ricos en scoreboard)
  var MANUAL_ESPN_IDS = { "537421": "760494" };

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

    // Precarga ESPN para cada fecha Â± 2 dÃ­as (diferencia UTC vs hora local USA/CanadÃ¡/MÃ©xico)
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
          // Para partidos de penales, fullTime de football-data puede ser incorrecto â†’ usar regularTime
          var hasPensMatch = fdm.score && fdm.score.penalties && fdm.score.penalties.home !== null;
          var hScore = (hasPensMatch && fdm.score.regularTime) ? fdm.score.regularTime.home
                     : (fdm.score && fdm.score.fullTime ? fdm.score.fullTime.home : null);
          var aScore = (hasPensMatch && fdm.score.regularTime) ? fdm.score.regularTime.away
                     : (fdm.score && fdm.score.fullTime ? fdm.score.fullTime.away : null);

          // Buscar partido ESPN por marcador, intentando tambiÃ©n con nombres de equipo
          var fdmHome = (fdm.homeTeam && fdm.homeTeam.shortName || fdm.homeTeam && fdm.homeTeam.name || "").toLowerCase();
          var fdmAway = (fdm.awayTeam && fdm.awayTeam.shortName || fdm.awayTeam && fdm.awayTeam.name || "").toLowerCase();

          // Bypass: si hay ID manual, saltar bÃºsqueda por score y fetchear directo
          var manualEspnId = MANUAL_ESPN_IDS[String(fdm.id)];
          if (manualEspnId) {
            console.log("ESPN: ID manual " + manualEspnId + " para " + (fdm.homeTeam&&fdm.homeTeam.name) + " vs " + (fdm.awayTeam&&fdm.awayTeam.name));
            try {
              var summary = await getESPN("summary?event=" + manualEspnId);
              statsCache[String(fdm.id)] = {
                espnId: String(manualEspnId),
                events: mapESPNEvents(summary),
                stats:  mapESPNStats(summary)
              };
            } catch(e) {
              console.log("ESPN manual error: " + e.message);
              statsCache[String(fdm.id)] = { notFound: true };
            }
            continue;
          }

          var espnIdx = -1;
          espnPool.forEach(function(e, i) {
            if (espnIdx >= 0) return;
            var comp = e.competitions && e.competitions[0];
            if (!comp || !comp.status || !comp.status.type || !comp.status.type.completed) return;
            var home = (comp.competitors || []).find(function(c){ return c.homeAway === "home"; });
            var away = (comp.competitors || []).find(function(c){ return c.homeAway === "away"; });
            if (!home || !away) return;
            if (parseInt(home.score) !== hScore || parseInt(away.score) !== aScore) return;
            // Si hay mÃ¡s de un partido con el mismo marcador, intentar confirmar por nombre de equipo
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
    console.log("ESPN: todos los partidos recientes ya estÃ¡n en cache (" + Object.keys(statsCache).length + " entradas)");
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

  // PRÃ“XIMOS
  cardId = 1000;
  var byDate = {};
  upcoming.filter(function(m){return !isToday(m.utcDate);}).slice(0,35).forEach(function(m){
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
    + '<span style="color:#2a3a5a;margin:0 6px;align-self:center;font-size:16px;line-height:1;">â”‚</span>'
    + '<button class="jbtn active" onclick="showR16(this)">ðŸ† 16avos</button>';
  var jorBlocks = jornadas.map(function(j){
    var pj = finished.filter(function(m){return m.matchday===j;});
    var grpsP = grupos.filter(function(g){return pj.some(function(m){return m.group===g;});});
    return '<div id="j' + j + '" style="display:none;">'
      + grpsP.map(function(g){
          return '<div class="grp-block"><div class="grp-hdr">' + g.replace("GROUP_","Grupo ") + " Â· J" + j + "</div>"
            + pj.filter(function(m){return m.group===g;}).map(function(m){return makeCard(m);}).join("")
            + "</div>";
        }).join("")
      + "</div>";
  }).join("");

  // RESULTADOS 16AVOS â€” usar makeCard si la API ya los tiene, si no mostrar tabla estÃ¡tica
  var finishedKO = finished.filter(function(m){ return !m.group; });
  // Ordenar ascendente por fecha para mostrar cronolÃ³gicamente
  var finishedKOAsc = finishedKO.slice().sort(function(a,b){ return new Date(a.utcDate)-new Date(b.utcDate); });
  var resultados16HTML;
  if(finishedKOAsc.length > 0){
    // Agrupar por fecha (primeros 10 chars del utcDate)
    var koByDate = {};
    var koDateOrder = [];
    finishedKOAsc.forEach(function(m){
      var dk = m.utcDate.substring(0,10);
      if(!koByDate[dk]){ koByDate[dk]=[]; koDateOrder.push(dk); }
      koByDate[dk].push(m);
    });
    var koDateBlocks = koDateOrder.slice().reverse().map(function(dk){
      var label = clDateShort(dk + "T12:00:00Z");
      return '<div style="margin-bottom:10px;">'
        + '<div style="font-size:11px;color:#4ade80;font-weight:700;margin:4px 0 6px;">'
        + '<span style="background:#0d2a18;border-radius:4px;padding:2px 8px;border:1px solid #166534;">ðŸ“… ' + label + '</span></div>'
        + koByDate[dk].map(function(m){return makeCard(m);}).join("")
        + '</div>';
    }).join("");
    resultados16HTML = '<div style="background:#121c30;border-radius:10px;border:1px solid #1e2d45;overflow:hidden;margin-bottom:10px;">'
      + '<div style="padding:12px 13px;border-bottom:1px solid #1e2d45;display:flex;align-items:center;justify-content:space-between;">'
      + '<div style="font-size:14px;font-weight:800;color:#fff;">ðŸ† Resultados 16avos</div>'
      + '<div style="font-size:10px;color:#4ade80;">' + finishedKOAsc.length + ' jugados</div></div>'
      + '<div style="padding:10px;">' + koDateBlocks + '</div></div>';
  } else {
    var r16Row = function(fecha,flag1,eq1,g1,g2,flag2,eq2,pen,estadio){
      var score = (g1!==null&&g2!==null) ? ('<span style="font-size:16px;font-weight:900;color:#4ade80;letter-spacing:2px;padding:0 8px;">' + g1 + ' - ' + g2 + (pen?'<span style="font-size:9px;color:#fbbf24;margin-left:4px;">'+pen+'</span>':'') + '</span>') : '<span style="font-size:10px;color:#fbbf24;background:#1a2000;border:1px solid #3a4000;border-radius:4px;padding:2px 7px;">Pendiente</span>';
      return '<tr style="border-top:1px solid #1e2d45;"><td style="padding:9px 8px 2px;font-size:10px;color:#4ade80;font-weight:700;" colspan="3">' + fecha + '</td></tr>'
        + '<tr><td style="padding:2px 8px 9px;font-size:12px;font-weight:700;text-align:right;width:38%;">' + flag1 + ' ' + eq1 + '</td>'
        + '<td style="padding:2px 8px 9px;text-align:center;white-space:nowrap;">' + score + '</td>'
        + '<td style="padding:2px 8px 9px;font-size:12px;font-weight:700;width:38%;">' + flag2 + ' ' + eq2 + '</td></tr>'
        + '<tr><td colspan="3" style="padding:0 8px 9px;font-size:10px;color:#475569;">ðŸŸ ' + estadio + '</td></tr>';
    };
    resultados16HTML = '<div style="background:#121c30;border-radius:10px;border:1px solid #1e2d45;overflow:hidden;margin-bottom:10px;">'
      + '<div style="padding:12px 13px;border-bottom:1px solid #1e2d45;display:flex;align-items:center;justify-content:space-between;">'
      + '<div style="font-size:14px;font-weight:800;color:#fff;">ðŸ† Resultados 16avos</div>'
      + '<div style="font-size:10px;color:#4ade80;">28 Jun â€“ 3 Jul</div></div>'
      + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:300px;"><tbody>'
      + r16Row('ðŸ“… 28 jun Â· 16:00','ðŸ‡¿ðŸ‡¦','SudÃ¡frica',0,1,'ðŸ‡¨ðŸ‡¦','CanadÃ¡',null,'SoFi Stadium, Los Ãngeles')
      + r16Row('ðŸ“… 29 jun Â· 13:00','ðŸ‡§ðŸ‡·','Brasil',null,null,'ðŸ‡¯ðŸ‡µ','JapÃ³n',null,'NRG Stadium, Houston')
      + r16Row('ðŸ“… 29 jun Â· 16:30','ðŸ‡©ðŸ‡ª','Alemania',null,null,'ðŸ‡µðŸ‡¾','Paraguay',null,'AT&T Stadium, Dallas')
      + r16Row('ðŸ“… 29 jun Â· 21:00','ðŸ‡³ðŸ‡±','PaÃ­ses Bajos',null,null,'ðŸ‡²ðŸ‡¦','Marruecos',null,'Levi\'s Stadium, San JosÃ©')
      + r16Row('ðŸ“… 30 jun Â· 13:00','ðŸ‡¨ðŸ‡®','C. Marfil',null,null,'ðŸ‡³ðŸ‡´','Noruega',null,'Rose Bowl, Los Ãngeles')
      + r16Row('ðŸ“… 30 jun Â· 17:00','ðŸ‡«ðŸ‡·','Francia',null,null,'ðŸ‡¸ðŸ‡ª','Suecia',null,'MetLife Stadium, Nueva York')
      + r16Row('ðŸ“… 30 jun Â· 21:00','ðŸ‡²ðŸ‡½','MÃ©xico',null,null,'ðŸ‡ªðŸ‡¨','Ecuador',null,'Arrowhead Stadium, Kansas City')
      + r16Row('ðŸ“… 1 jul Â· 12:00','ðŸ´ó §ó ¢ó ¥ó ®ó §ó ¿','Inglaterra',null,null,'ðŸ‡¨ðŸ‡©','Congo DR',null,'Mercedes-Benz Stadium, Atlanta')
      + r16Row('ðŸ“… 1 jul Â· 16:00','ðŸ‡§ðŸ‡ª','BÃ©lgica',null,null,'ðŸ‡¸ðŸ‡³','Senegal',null,'Lumen Field, Seattle')
      + r16Row('ðŸ“… 1 jul Â· 20:00','ðŸ‡ºðŸ‡¸','EE.UU.',null,null,'ðŸ‡§ðŸ‡¦','Bosnia',null,'SoFi Stadium, Los Ãngeles')
      + r16Row('ðŸ“… 2 jul Â· 15:00','ðŸ‡ªðŸ‡¸','EspaÃ±a',null,null,'ðŸ‡¦ðŸ‡¹','Austria',null,'Hard Rock Stadium, Miami')
      + r16Row('ðŸ“… 2 jul Â· 19:00','ðŸ‡µðŸ‡¹','Portugal',null,null,'ðŸ‡­ðŸ‡·','Croacia',null,'SoFi Stadium, Los Ãngeles')
      + r16Row('ðŸ“… 2 jul Â· 23:00','ðŸ‡¨ðŸ‡­','Suiza',null,null,'ðŸ‡©ðŸ‡¿','Argelia',null,'MetLife Stadium, Nueva York')
      + r16Row('ðŸ“… 3 jul Â· 14:00','ðŸ‡¦ðŸ‡º','Australia',null,null,'ðŸ‡ªðŸ‡¬','Egipto',null,'NRG Stadium, Houston')
      + r16Row('ðŸ“… 3 jul Â· 18:00','ðŸ‡¦ðŸ‡·','Argentina',null,null,'ðŸ‡¨ðŸ‡»','Cabo Verde',null,'Hard Rock Stadium, Miami')
      + r16Row('ðŸ“… 3 jul Â· 21:30','ðŸ‡¨ðŸ‡´','Colombia',null,null,'ðŸ‡¬ðŸ‡­','Ghana',null,'AT&T Stadium, Dallas')
      + '</tbody></table></div></div>';
  }

  // TABLAS
  // â”€â”€ FIXTURE 16AVOS â”€â”€
  var fixture16HTML = '<div id="t16avos" style="display:none;">   <div style="background:#121c30;border-radius:10px;border:1px solid #1e2d45;overflow:hidden;margin-bottom:10px;">     <div style="padding:12px 13px;border-bottom:1px solid #1e2d45;display:flex;align-items:center;justify-content:space-between;">       <div style="font-size:14px;font-weight:800;color:#fff;">ðŸ† 16avos de Final</div>       <div style="font-size:10px;color:#4ade80;">28 Jun â€“ 3 Jul Â· Hora Chile</div>     </div>     <div style="overflow-x:auto;">       <table style="width:100%;border-collapse:collapse;font-size:12px;">         <thead><tr>           <th style="padding:7px 8px;color:#64748b;font-size:10px;text-transform:uppercase;background:#0b1120;text-align:left;">Hora</th>           <th style="padding:7px 8px;color:#64748b;font-size:10px;text-transform:uppercase;background:#0b1120;text-align:right;">Local</th>           <th style="padding:7px 8px;color:#64748b;font-size:10px;text-transform:uppercase;background:#0b1120;text-align:center;"></th>           <th style="padding:7px 8px;color:#64748b;font-size:10px;text-transform:uppercase;background:#0b1120;text-align:left;">Visitante</th>         </tr></thead>         <tbody><tr style="background:#0d2a18;">   <td colspan="4" style="padding:8px 10px;font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:1px;">ðŸ“… 28 jun</td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">16:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">ðŸ‡¿ðŸ‡¦ SudÃ¡frica</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">ðŸ‡¨ðŸ‡¦ CanadÃ¡</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">ðŸŸ SoFi Stadium, Los Ãngeles &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">âœ… Confirmado</span></td> </tr><tr>   <td colspan="4" style="padding:9px 8px;font-size:10px;color:#4ade80;">Solo 1 partido hoy Â· Resto desde el 29 jun</td> </tr><tr style="background:#0d2a18;">   <td colspan="4" style="padding:8px 10px;font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:1px;">ðŸ“… 29 jun</td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">13:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">ðŸ‡§ðŸ‡· Brasil</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">ðŸ‡¯ðŸ‡µ JapÃ³n</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">ðŸŸ NRG Stadium, Houston &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">âœ… Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">16:30</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">ðŸ‡©ðŸ‡ª Alemania</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">ðŸ‡µðŸ‡¾ Paraguay</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">ðŸŸ AT&T Stadium, Dallas &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">âœ… Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">21:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">ðŸ‡³ðŸ‡± PaÃ­ses Bajos</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">ðŸ‡²ðŸ‡¦ Marruecos</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">ðŸŸ Levi\'s Stadium, San JosÃ© &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">âœ… Confirmado</span></td> </tr><tr style="background:#0d2a18;">   <td colspan="4" style="padding:8px 10px;font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:1px;">ðŸ“… 30 jun</td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">13:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">ðŸ‡¨ðŸ‡® Costa de Marfil</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">ðŸ‡³ðŸ‡´ Noruega</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">ðŸŸ Rose Bowl, Los Ãngeles &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">âœ… Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">17:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">ðŸ‡«ðŸ‡· Francia</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">ðŸ‡¸ðŸ‡ª Suecia</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">ðŸŸ MetLife Stadium, Nueva York &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">âœ… Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">21:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">ðŸ‡²ðŸ‡½ MÃ©xico</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">ðŸ‡ªðŸ‡¨ Ecuador</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">ðŸŸ Arrowhead Stadium, Kansas City &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">âœ… Confirmado</span></td> </tr><tr style="background:#0d2a18;">   <td colspan="4" style="padding:8px 10px;font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:1px;">ðŸ“… 1 jul</td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">12:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">ðŸ´ó §ó ¢ó ¥ó ®ó §ó ¿ Inglaterra</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">ðŸ‡¨ðŸ‡© Congo DR</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">ðŸŸ Mercedes-Benz Stadium, Atlanta &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">âœ… Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">16:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">ðŸ‡§ðŸ‡ª BÃ©lgica</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">ðŸ‡¸ðŸ‡³ Senegal</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">ðŸŸ Lumen Field, Seattle &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">âœ… Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">20:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">ðŸ‡ºðŸ‡¸ EE.UU.</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">ðŸ‡§ðŸ‡¦ Bosnia-Herz.</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">ðŸŸ SoFi Stadium, Los Ãngeles &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">âœ… Confirmado</span></td> </tr><tr style="background:#0d2a18;">   <td colspan="4" style="padding:8px 10px;font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:1px;">ðŸ“… 2 jul</td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">15:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">ðŸ‡ªðŸ‡¸ EspaÃ±a</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">ðŸ‡¦ðŸ‡¹ Austria</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">ðŸŸ Hard Rock Stadium, Miami &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">âœ… Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">19:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">ðŸ‡µðŸ‡¹ Portugal</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">ðŸ‡­ðŸ‡· Croacia</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">ðŸŸ SoFi Stadium, Los Ãngeles &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">âœ… Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">23:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">ðŸ‡¨ðŸ‡­ Suiza</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">ðŸ‡©ðŸ‡¿ Argelia</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">ðŸŸ MetLife Stadium, Nueva York &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">âœ… Confirmado</span></td> </tr><tr style="background:#0d2a18;">   <td colspan="4" style="padding:8px 10px;font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:1px;">ðŸ“… 3 jul</td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">14:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">ðŸ‡¦ðŸ‡º Australia</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">ðŸ‡ªðŸ‡¬ Egipto</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">ðŸŸ NRG Stadium, Houston &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">âœ… Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">18:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">ðŸ‡¦ðŸ‡· Argentina</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">ðŸ‡¨ðŸ‡» Cabo Verde</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">ðŸŸ Hard Rock Stadium, Miami &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">âœ… Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">21:30</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">ðŸ‡¨ðŸ‡´ Colombia</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">ðŸ‡¬ðŸ‡­ Ghana</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">ðŸŸ AT&T Stadium, Dallas &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">âœ… Confirmado</span></td> </tr></tbody>       </table>     </div>     <div style="padding:10px 13px;border-top:1px solid #1e2d45;font-size:10px;color:#64748b;">       âœ“ 24 equipos clasificados directamente (12 primeros + 12 segundos) + 8 mejores terceros     </div>   </div> </div>';

  var grpBtns = standings.map(function(s,i){
    return '<button class="gbtn' + (i===0?" active":"") + '" onclick="showGrp(\'t' + s.group.replace("GROUP_","") + '\',this)">' + s.group.replace("GROUP_","G ") + "</button>";
  }).join("");
  var tablaBlocks = standings.map(function(s,i){
    return '<div id="t' + s.group.replace("GROUP_","") + '" style="display:' + (i===0?"block":"none") + ';">' + tableHTML(s) + "</div>";
  }).join("");

  // APUESTAS
  var jornadaMax = jornadas.length > 0 ? jornadas[jornadas.length-1] : 0;
  var tipsLines = [];
  if(jornadaMax>=1) tipsLines = tipsLines.concat(["ðŸ‡¦ðŸ‡· <b>Argentina</b> â€” Messi hat-trick vs Argelia. Candidato al titulo.","ðŸ‡©ðŸ‡ª <b>Alemania</b> â€” 7-1 a Curazao. La maquina del torneo.","ðŸ‡³ðŸ‡´ <b>Noruega sorpresa</b> â€” Haaland doblete en debut.","ðŸ‡µðŸ‡¹ <b>Portugal en aprietos</b> â€” 1-1 con RD Congo.","ðŸ‡ªðŸ‡¸ <b>Espana decepciono</b> â€” 0-0 vs Cabo Verde."]);
  if(jornadaMax>=2) tipsLines = tipsLines.concat(["ðŸ‡²ðŸ‡½ <b>Mexico clasificado</b> â€” 6 pts. Lider Grupo A.","ðŸ‡ºðŸ‡¸ <b>EE.UU. clasificado</b> â€” 6 pts. Efecto local brutal.","ðŸ‡¨ðŸ‡¦ <b>Canada</b> â€” 6-0 a Qatar. Sorpresa positiva de J2.","ðŸ‡¨ðŸ‡­ <b>Suiza reacciono</b> â€” 4-1 a Bosnia.","ðŸ‡¹ðŸ‡· <b>Turquia eliminada</b> â€” Paraguay heroico con 10 jugadores."]);
  if(jornadaMax>=3) tipsLines = tipsLines.concat([
    "ðŸ‡²ðŸ‡½ <b>MÃ©xico histÃ³rico</b> â€” 9 pts, 3 victorias en 3. El Tri nunca habÃ­a hecho esto.",
    "ðŸ‡§ðŸ‡· <b>Brasil despertÃ³</b> â€” 3-0 a Escocia. VinÃ­cius Jr + Neymar disponible. Peligroso.",
    "ðŸ‡¦ðŸ‡· <b>Argentina pleno</b> â€” 3 victorias, 9 pts. Messi en modo histÃ³rico. FavoritÃ­simo.",
    "ðŸ‡¿ðŸ‡¦ <b>SudÃ¡frica sorpresa</b> â€” EliminÃ³ a Corea del Sur. Los Bafana Bafana clasificaron.",
    "ðŸ‡°ðŸ‡· <b>Corea del Sur fuera</b> â€” PerdiÃ³ ante SudÃ¡frica. Eliminada en la fase de grupos.",
    "ðŸ† Fase de grupos terminada Â· 16avos de final arrancaron el 29 Jun."
  ]);
  if(jornadaMax>=4) tipsLines = tipsLines.concat([
    "ðŸ‡µðŸ‡¾ <b>Â¡Paraguay elimina a Alemania!</b> â€” Batacazo histÃ³rico en penales (4-3). La sorpresa del torneo.",
    "ðŸ‡²ðŸ‡¦ <b>Â¡Marruecos elimina a PaÃ­ses Bajos!</b> â€” Penales (3-2). Los Leones del Atlas repiten 2022.",
    "ðŸ‡¦ðŸ‡· <b>Argentina sufriÃ³ vs Cabo Verde</b> â€” Messi 7 goles en el torneo. Nuevo rÃ©cord histÃ³rico.",
    "ðŸ‡ªðŸ‡¬ <b>Egipto histÃ³rico</b> â€” Primera vez en 8vos. Salah Panenka. EliminÃ³ a Australia.",
    "ðŸ‡¨ðŸ‡´ <b>Colombia sÃ³lida</b> â€” 1-0 a Ghana. âš ï¸ James RodrÃ­guez en duda por lesiÃ³n.",
    "ðŸ‡ªðŸ‡¸ <b>EspaÃ±a brutal</b> â€” 3-0 a Austria. Oyarzabal doblete, Yamal imparable. El mejor equipo del torneo.",
    "ðŸ‡µðŸ‡¹ <b>Portugal de milagro</b> â€” Ramos al 90+4' eliminÃ³ a Croacia. Ronaldo penal al 68'. DramÃ¡tico.",
    "ðŸ‡¨ðŸ‡­ <b>Suiza sÃ³lida</b> â€” 2-0 a Argelia. Embolo y Ndoye. La Nati en 8vos sin sudar.",
    "ðŸ† 16avos terminados Â· 8vos de Final arrancan el 4 Jul. EspaÃ±a-Portugal el partido del siglo."
  ]);
  var tipsHTML = '<div style="background:linear-gradient(135deg,#0d2a1a,#0a1f2f);border:1px solid #1a4a2a;border-radius:12px;padding:13px 15px;margin-bottom:12px;">'
    + '<div style="font-size:12px;color:#4ade80;font-weight:700;margin-bottom:7px;">ðŸ’¡ Tips del analista Â· J' + jornadaMax + " completada</div>"
    + '<div style="font-size:12px;color:#cbd5e1;line-height:2.0;">' + tipsLines.join("<br>") + "</div></div>";

  var continentes = [
    {c:"rgba(96,165,250,0.06)",b:"rgba(96,165,250,0.15)",t:"#93c5fd",ti:"EUROPA",j1:"Brillando: Alemania (7-1), Noruega (4-1), Suecia (5-1). Flojos: Portugal (1-1), Espana (0-0). Norte europeo domina.",j2:"Suiza 4-1 Bosnia, Canada 6-0 Qatar. Portugal sigue en crisis. Francia y Noruega favoritos Grupo I.",j3:"8vos: Francia vs Paraguay, Brasil vs Noruega, Inglaterra vs Mexico, Belgica vs EE.UU. Europa bien representada. âš ï¸ Alemania eliminada por Paraguay."},
    {c:"rgba(74,222,128,0.06)",b:"rgba(74,222,128,0.15)",t:"#86efac",ti:"SUDAMERICA",j1:"Brillando: Argentina (3-0 Messi x3), Colombia (3-1). Flojos: Brasil (1-1), Ecuador (0-1).",j2:"Brasil reacciono 3-0 a Haiti. Mexico y EE.UU. clasificados. Ecuador casi eliminado.",j3:"8vos: Argentina 3-2 Cabo Verde (AET), Colombia 1-0 Ghana. Paraguay en 8vos tras batacazo vs Alemania. Messi 7 goles â€” imparable."},
    {c:"rgba(251,191,36,0.06)",b:"rgba(251,191,36,0.15)",t:"#fcd34d",ti:"AFRICA",j1:"Brillando: Marruecos (1-1 Brasil), C. Marfil (gana 90'), Ghana (1-0 agonica), RD Congo (empato Portugal).",j2:"Marruecos 1-0 Escocia confirma liderato Grupo C.",j3:"8vos: Marruecos elimino a Paises Bajos en penales Â· Egipto elimino a Australia Â· Colombia elimino a Ghana. 3 africanos en 8vos â€” epico."},
    {c:"rgba(167,139,250,0.06)",b:"rgba(167,139,250,0.15)",t:"#c4b5fd",ti:"ASIA Y OCEANIA",j1:"Brillando: Japon (2-2 Paises Bajos al 89min), Corea del Sur (2-1 remontada). Flojos: Qatar (1-1).",j2:"Japon y Corea bien posicionados. Qatar goleado 0-6 por Canada.",j3:"Australia eliminada por Egipto en penales. Japon y Corea pendientes de sus 8vos. Qatar y Corea del Sur fuera."},
    {c:"rgba(248,113,113,0.06)",b:"rgba(248,113,113,0.15)",t:"#fca5a5",ti:"CONCACAF",j1:"Brillando: EE.UU. (4-1), Mexico (2-0). Canada empezo 1-1.",j2:"Mexico y EE.UU. clasificados 6 pts. Canada goleo 6-0. CONCACAF historico.",j3:"8vos: Canada, EE.UU. y Mexico todos clasificados. EE.UU. 2-0 Bosnia con 10 hombres. Canada busca cuartos vs Marruecos â€” historico."}
  ];
  var contHTML = '<div style="background:linear-gradient(135deg,#0a1f2f,#0d1a3a);border:1px solid #1a3a5a;border-radius:12px;padding:13px 15px;margin-bottom:20px;">'
    + '<div style="font-size:12px;color:#60a5fa;font-weight:700;margin-bottom:10px;">Analisis por continente Â· J' + jornadaMax + "</div>"
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

  // JS â€” toggleCard usa id del wrapper
  var js = 'function showTab(id,btn){document.querySelectorAll(".pane").forEach(function(p){p.classList.remove("active");});document.querySelectorAll(".tab").forEach(function(t){t.classList.remove("active");});document.getElementById(id).classList.add("active");btn.classList.add("active");}'
    + 'function toggleCard(cid){var det=document.getElementById(cid);var wrap=document.getElementById("wrap"+cid);if(!det||!wrap)return;var isOpen=det.style.display!=="none";det.style.display=isOpen?"none":"block";wrap.classList.toggle("open",!isOpen);var arr=wrap.querySelector(".arr");if(arr)arr.textContent=isOpen?"â–¼":"â–²";}'
    + 'function showJornada(j,btn){document.querySelectorAll(".jbtn").forEach(function(b){b.classList.remove("active");});btn.classList.add("active");var r16=document.getElementById("r16");if(r16)r16.style.display="none";document.querySelectorAll("[id^=j]").forEach(function(d){if(/^j\\d+$/.test(d.id))d.style.display="none";});var el=document.getElementById("j"+j);if(el)el.style.display="block";}'
    + 'function showR16(btn){document.querySelectorAll(".jbtn").forEach(function(b){b.classList.remove("active");});btn.classList.add("active");document.querySelectorAll("[id^=j]").forEach(function(d){if(/^j\\d+$/.test(d.id))d.style.display="none";});var r16=document.getElementById("r16");if(r16)r16.style.display="block";}'
    + 'function showGrp(id,btn){document.querySelectorAll(".gbtn").forEach(function(b){b.classList.remove("active");});btn.classList.add("active");document.querySelectorAll("[id^=t]").forEach(function(d){if(/^t[A-L]$/.test(d.id))d.style.display="none";});var el=document.getElementById(id);if(el)el.style.display="block";}';

  var favs = [["ðŸ‡«ðŸ‡·","Francia","MbappÃ© 4 goles, 8vos sin recibir. El equipo mÃ¡s sÃ³lido del torneo.","3.5x"],["ðŸ‡¦ðŸ‡·","Argentina","Messi 7 goles â€” rÃ©cord histÃ³rico. 3-2 a Cabo Verde en AET. MÃ¡quina.","4.0x"],["ðŸ‡§ðŸ‡·","Brasil","RemontÃ³ a JapÃ³n al 90+5'. VinÃ­cius Jr imparable. Enfrenta a Noruega.","5.0x"],["ðŸ´ó §ó ¢ó ¥ó ®ó §ó ¿","Inglaterra","SÃ³lida en grupos. Kane + Bellingham. Choque con MÃ©xico.","7.0x"],["ðŸ‡¨ðŸ‡´","Colombia","1-0 a Ghana. Luis DÃ­az brillante. Enfrenta a Suiza.","15x"]];
  var bads = [["ðŸ‡µðŸ‡¾","Paraguay","EliminÃ³ a Alemania â€” el batacazo. Pero vs Francia es otro planeta. Cuidado apostar a Paraguay."],["ðŸ‡¨ðŸ‡¦","CanadÃ¡","Primera eliminatoria histÃ³rica. Sin experiencia en K.O. Marruecos tiene mÃ¡s oficio."],["ðŸ‡ªðŸ‡¬","Egipto","Primera vez en 8vos. Todo depende de Salah. Si Ã©l no aparece vs Argentina, caen cÃ³modo."]];

  // â”€â”€ BRACKET SVG 16AVOS â€” dinÃ¡mico desde API â”€â”€
  // Mapa: nombre API â†’ {flag, nombre en espaÃ±ol}
  var TM = {
    "South Africa":{f:"ðŸ‡¿ðŸ‡¦",n:"SudÃ¡frica"},"Canada":{f:"ðŸ‡¨ðŸ‡¦",n:"CanadÃ¡"},
    "Germany":{f:"ðŸ‡©ðŸ‡ª",n:"Alemania"},"Paraguay":{f:"ðŸ‡µðŸ‡¾",n:"Paraguay"},
    "CÃ´te d'Ivoire":{f:"ðŸ‡¨ðŸ‡®",n:"C. Marfil"},"Ivory Coast":{f:"ðŸ‡¨ðŸ‡®",n:"C. Marfil"},
    "Norway":{f:"ðŸ‡³ðŸ‡´",n:"Noruega"},"Mexico":{f:"ðŸ‡²ðŸ‡½",n:"MÃ©xico"},
    "Ecuador":{f:"ðŸ‡ªðŸ‡¨",n:"Ecuador"},"England":{f:"ðŸ´ó §ó ¢ó ¥ó ®ó §ó ¿",n:"Inglaterra"},
    "DR Congo":{f:"ðŸ‡¨ðŸ‡©",n:"Congo DR"},"Democratic Republic of Congo":{f:"ðŸ‡¨ðŸ‡©",n:"Congo DR"},
    "Congo DR":{f:"ðŸ‡¨ðŸ‡©",n:"Congo DR"},
    "United States":{f:"ðŸ‡ºðŸ‡¸",n:"EE.UU."},"USA":{f:"ðŸ‡ºðŸ‡¸",n:"EE.UU."},
    "Bosnia and Herzegovina":{f:"ðŸ‡§ðŸ‡¦",n:"Bosnia"},"Bosnia-Herzegovina":{f:"ðŸ‡§ðŸ‡¦",n:"Bosnia"},
    "Switzerland":{f:"ðŸ‡¨ðŸ‡­",n:"Suiza"},"Algeria":{f:"ðŸ‡©ðŸ‡¿",n:"Argelia"},
    "Argentina":{f:"ðŸ‡¦ðŸ‡·",n:"Argentina"},"Cape Verde":{f:"ðŸ‡¨ðŸ‡»",n:"Cabo Verde"},"Cabo Verde":{f:"🇨🇻",n:"Cabo Verde"},
    "Brazil":{f:"ðŸ‡§ðŸ‡·",n:"Brasil"},"Japan":{f:"ðŸ‡¯ðŸ‡µ",n:"JapÃ³n"},
    "Netherlands":{f:"ðŸ‡³ðŸ‡±",n:"PaÃ­ses Bajos"},"Morocco":{f:"ðŸ‡²ðŸ‡¦",n:"Marruecos"},
    "France":{f:"ðŸ‡«ðŸ‡·",n:"Francia"},"Sweden":{f:"ðŸ‡¸ðŸ‡ª",n:"Suecia"},
    "Belgium":{f:"ðŸ‡§ðŸ‡ª",n:"BÃ©lgica"},"Senegal":{f:"ðŸ‡¸ðŸ‡³",n:"Senegal"},
    "Spain":{f:"ðŸ‡ªðŸ‡¸",n:"EspaÃ±a"},"Austria":{f:"ðŸ‡¦ðŸ‡¹",n:"Austria"},
    "Portugal":{f:"ðŸ‡µðŸ‡¹",n:"Portugal"},"Croatia":{f:"ðŸ‡­ðŸ‡·",n:"Croacia"},
    "Australia":{f:"ðŸ‡¦ðŸ‡º",n:"Australia"},"Egypt":{f:"ðŸ‡ªðŸ‡¬",n:"Egipto"},
    "Colombia":{f:"ðŸ‡¨ðŸ‡´",n:"Colombia"},"Ghana":{f:"ðŸ‡¬ðŸ‡­",n:"Ghana"}
  };
  function td(apiName){ var t=TM[apiName]; return t ? t.f+" "+t.n : apiName; }
  function tn(apiName){ var t=TM[apiName]; return t ? t.n : apiName; }

    // Orden de pares: cada dos consecutivos forman un 8vo real
  // BL8: [Canada-Marruecos, Francia-Paraguay, Brasil-Noruega, Inglaterra-México]
  var BLpairs=[
    {h:"South Africa",a:"Canada",t:"28/6 16:00"},
    {h:"Netherlands",a:"Morocco",t:"29/6 21:00"},
    {h:"France",a:"Sweden",t:"30/6 17:00"},
    {h:"Germany",a:"Paraguay",t:"29/6 16:30"},
    {h:"Brazil",a:"Japan",t:"29/6 13:00"},
    {h:"CÃ´te d'Ivoire",a:"Norway",t:"30/6 13:00"},
    {h:"England",a:"DR Congo",t:"1/7 12:00"},
    {h:"Mexico",a:"Ecuador",t:"30/6 21:00"}
  ];
  // BR8: [EE.UU.-Belgica, Espana-Portugal, Argentina-Suiza, Egipto-Colombia]
  var BRpairs=[
    {h:"United States",a:"Bosnia and Herzegovina",t:"1/7 20:00"},
    {h:"Belgium",a:"Senegal",t:"1/7 16:00"},
    {h:"Spain",a:"Austria",t:"2/7 15:00"},
    {h:"Portugal",a:"Croatia",t:"2/7 19:00"},
    {h:"Argentina",a:"Cape Verde",t:"3/7 18:00"},
    {h:"Switzerland",a:"Algeria",t:"2/7 23:00"},
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
    // Detecta si home/away estÃ¡ invertido respecto al bracket
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
      // Usar regularTime para marcador de 90 min cuando hay penales
      var ph=m.score&&m.score.penalties?m.score.penalties.home:null;
      var pa=m.score&&m.score.penalties?m.score.penalties.away:null;
      var hasPenSlot=ph!==null&&pa!==null;
      var hg, ag;
      if(hasPenSlot&&m.score.regularTime){ hg=m.score.regularTime.home; ag=m.score.regularTime.away; }
      else { hg=m.score&&m.score.fullTime?m.score.fullTime.home:null; ag=m.score&&m.score.fullTime?m.score.fullTime.away:null; }
      var w=koWinner(m,p);
      var flipped=(m.homeTeam&&m.homeTeam.name||"")!==p.h&&Object.keys(TM).filter(function(k){return k===p.a;}).indexOf(m.homeTeam&&m.homeTeam.name||"")>=0;
      var ga=flipped?ag:hg, gb=flipped?hg:ag;
      var gpa=flipped?pa:ph, gpb=flipped?ph:pa;
      var scoreStr=(ga!==null?ga:"?")+"-"+(gb!==null?gb:"?");
      var penStr=(gpa!==null&&gpb!==null)?" pen "+gpa+"-"+gpb:"";
      return {
        a:td(p.h)+(w===p.h?" âœ…":""),
        b:td(p.a)+(w===p.a?" âœ…":""),
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
  // Bracket connector rightward: from right edge of matches i,j â†’ output
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
  s+=txt(xFIN+WFIN/2,yFIN+14,"ðŸ† FINAL","#fbbf24",9,"middle");
  s+=txt(xFIN+WFIN/2,yFIN+26,"19 Jul Â· MetLife","#64748b",8,"middle");
  s+=txt(xFIN+WFIN/2,yFIN+44,"ðŸ†","#fbbf24",18,"middle");
  s+=txt(xFIN+WFIN/2,yFIN+62,"CampeÃ³n","#fbbf24",9,"middle");

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
    +"<div style='font-size:15px;font-weight:800;color:#4ade80'>ðŸ† Bracket 16avos â†’ Final</div>"
    +"<div style='font-size:10px;color:#94a3b8'>28 Jun â€“ 19 Jul Â· Hora Chile</div></div>"
    +"<div style='overflow-x:auto;padding:12px'>"+bracketSVG+"</div>"
    +"<div style='padding:8px 13px;border-top:1px solid #1e2d45;font-size:10px;color:#64748b'>Slots vacÃ­os se completan a medida que avanza el torneo Â· Empate: tiempo extra + penales</div>"
    +"</div>";











  var html = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>'
    + '<title>âš½ Mundial 2026 Â· En Vivo</title><style>' + css + '</style></head><body>'
    + '<div class="header"><div class="inner">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">'
    + '<div style="display:flex;align-items:center;gap:10px;"><span style="font-size:24px;">âš½</span>'
    + '<div><h1 style="font-size:19px;font-weight:800;color:#fff;letter-spacing:-.5px;">MUNDIAL 2026 <span style="color:#4ade80;font-weight:400;font-size:12px;">Â· TIEMPO REAL</span></h1>'
    + '<p style="font-size:10px;color:#8899aa;">USA Â· CANADÃ Â· MÃ‰XICO Â· 11 Jun â€“ 19 Jul</p></div></div>'
    + '<div style="text-align:right;font-size:9px;"><div style="color:#4ade80;">âœ… Actualizado</div><div style="color:#64748b;">' + nowCL + ' Chile</div></div></div>'
    + '<div style="display:flex;gap:10px;margin:12px 0 0;flex-wrap:wrap;">'
    + '<div class="stat-box"><div style="font-size:16px;font-weight:700;color:#4ade80;">' + finished.length + '</div><div style="font-size:9px;color:#8899aa;text-transform:uppercase;">Jugados</div></div>'
    + '<div class="stat-box" style="' + (live.length>0?"background:rgba(248,113,113,.15);border-color:rgba(248,113,113,.4)":"") + '"><div style="font-size:16px;font-weight:700;color:' + (live.length>0?"#f87171":"#4ade80") + ';">' + live.length + (live.length>0?" ðŸ”´":"") + '</div><div style="font-size:9px;color:#8899aa;text-transform:uppercase;">En Vivo</div></div>'
    + '<div class="stat-box"><div style="font-size:16px;font-weight:700;color:#4ade80;">' + todayAll.length + '</div><div style="font-size:9px;color:#8899aa;text-transform:uppercase;">Hoy</div></div>'
    + '<div class="stat-box"><div style="font-size:16px;font-weight:700;color:#4ade80;">' + totalGoals + '</div><div style="font-size:9px;color:#8899aa;text-transform:uppercase;">Goles</div></div>'
    + '</div>'
    + '<div class="tabs">'
    + '<button class="tab active" onclick="showTab(\'hoy\',this)">ðŸ“… Hoy</button>'
    + '<button class="tab" onclick="showTab(\'proximos\',this)">ðŸ—“ PrÃ³ximos</button>'
    + '<button class="tab" onclick="showTab(\'resultados\',this)">ðŸ“‹ Resultados</button>'
    + '<button class="tab" onclick="showTab(\'tablas\',this)">ðŸ“Š Tablas</button>'
    + '<button class="tab" onclick="showTab(\'apuestas\',this)">ðŸ’° Apuestas</button>'
    + '</div></div></div>'
    + '<div class="content">'
    // HOY
    + '<div id="hoy" class="pane active">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">'
    + '<h2 style="font-size:14px;color:#cbd5e1;">Partidos de hoy Â· ' + todayCL + ' ðŸ‡¨ðŸ‡±</h2>'
    + '<span style="font-size:10px;background:#16a34a22;color:#4ade80;border:1px solid #16a34a44;border-radius:20px;padding:3px 8px;">Hora Chile</span>'
    + '</div>' + hoyHTML + '</div>'
    // PRÃ“XIMOS
    + '<div id="proximos" class="pane"><h2 style="font-size:14px;color:#cbd5e1;margin-bottom:14px;">ðŸ—“ PrÃ³ximos Â· Hora Chile</h2>'
    + (proximosHTML || '<div class="empty">No hay prÃ³ximos disponibles.</div>')
    + '<div style="margin-top:22px;background:#121c30;border:1px solid #1e2d45;border-radius:12px;padding:14px;">'
    + '<h3 style="font-size:12px;color:#94a3b8;margin-bottom:10px;text-transform:uppercase;">ðŸ—º Estructura del torneo</h3>'
    + '<div style="display:flex;flex-direction:column;gap:5px;font-size:12px;">'
    + (function(){
        var nd = new Date();
        var phases = [
          {name:"Fase de Grupos",  dates:"15 Jun â€“ 27 Jun", s:new Date("2026-06-15"), e:new Date("2026-06-28")},
          {name:"16avos de Final", dates:"28 Jun â€“ 3 Jul",  s:new Date("2026-06-28"), e:new Date("2026-07-04")},
          {name:"8vos de Final",   dates:"4 Jul â€“ 7 Jul",   s:new Date("2026-07-04"), e:new Date("2026-07-08")},
          {name:"Cuartos de Final",dates:"9 Jul â€“ 12 Jul",  s:new Date("2026-07-09"), e:new Date("2026-07-13")},
          {name:"Semifinales",     dates:"14 Jul â€“ 15 Jul", s:new Date("2026-07-14"), e:new Date("2026-07-16")},
          {name:"ðŸ† Final",        dates:"19 Jul Â· MetLife, NJ", s:new Date("2026-07-19"), e:new Date("2026-07-20"), fin:true}
        ];
        return phases.map(function(p){
          var cur = nd >= p.s && nd < p.e;
          var bg = cur ? "background:#0d2a18;border:1px solid #166534;" : "background:#121c30;border:1px solid #1e2d45;";
          var nStyle = (cur || p.fin) ? "font-weight:700;" + (p.fin ? "color:#fbbf24;" : "") : "";
          var dStyle = cur ? "color:#4ade80;" : (p.fin ? "color:#fbbf24;" : "color:#64748b;");
          var dLabel = cur ? "ðŸ”´ EN CURSO Â· " + p.dates : p.dates;
          return '<div style="display:flex;justify-content:space-between;padding:8px 10px;' + bg + 'border-radius:7px;">'
            + '<span style="' + nStyle + '">' + p.name + '</span>'
            + '<span style="' + dStyle + '">' + dLabel + '</span></div>';
        }).join("");
      })()
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
    + '<div style="background:#1a2200;border:1px solid #3a5a00;border-radius:10px;padding:11px 13px;margin-bottom:14px;"><div style="font-size:12px;color:#86efac;font-weight:700;">âš ï¸ AnÃ¡lisis al ' + dateCL + ' Â· ' + finished.length + ' partidos jugados</div></div>'
    + '<h3 style="font-size:12px;color:#4ade80;margin-bottom:9px;text-transform:uppercase;">ðŸ† Favoritos al tÃ­tulo</h3>'
    + '<div style="display:flex;flex-direction:column;gap:7px;margin-bottom:18px;">'
    + favs.map(function(x){return '<div class="card" style="cursor:default;display:flex;align-items:center;gap:11px;"><span style="font-size:22px;">' + x[0] + '</span><div style="flex:1;"><div style="font-weight:700;font-size:13px;">' + x[1] + '</div><div style="font-size:11px;color:#94a3b8;margin-top:2px;">' + x[2] + '</div></div><div style="font-size:17px;font-weight:800;color:#fbbf24;">' + x[3] + '</div></div>';}).join("")
    + '</div><h3 style="font-size:12px;color:#f87171;margin:0 0 9px;text-transform:uppercase;">âš ï¸ Cuidado al apostar</h3>'
    + '<div style="display:flex;flex-direction:column;gap:7px;margin-bottom:20px;">'
    + bads.map(function(x){return '<div class="card" style="cursor:default;background:#1a0808;border-color:#3a1010;"><div style="font-weight:700;font-size:12px;color:#fca5a5;">' + x[0] + ' ' + x[1] + '</div><div style="font-size:11px;color:#8a7070;margin-top:2px;">' + x[2] + '</div></div>';}).join("")
    + '</div>' + tipsHTML + contHTML
    + '<a class="jugabet" href="https://www.jugabet.cl" target="_blank">ðŸŽ° Apostar ahora en Jugabet Chile â†’</a>'
    + '<p style="font-size:10px;color:#334155;text-align:center;margin-top:8px;">Juega con responsabilidad. +18 aÃ±os. Solo para residentes en Chile.</p>'
    + '</div>'
    + '</div>'
    + '<div style="text-align:center;padding:14px;font-size:10px;color:#334155;border-top:1px solid #1e2d45;">Datos al ' + dateCL + ' Â· ' + finished.length + ' partidos Â· Mundial 2026 Â· ðŸ‡¨ðŸ‡± Hora Chile</div>'
    + '<script>' + js + '<\/script>'
    + '</body></html>';

  fs.writeFileSync("index.html", html);
  console.log("OK â€” " + finished.length + " partidos, " + totalGoals + " goles");
}

main().catch(function(e){ console.error("ERROR:", e.message); process.exit(1); });

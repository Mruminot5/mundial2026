const https = require("https");
const fs = require("fs");
const API_KEY = "8245823280194f62b10dfbbdb08216d5";

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

// Claves exactas según log de la API (nombres reales)
ANAL["Bosnia-Herzegovina_Qatar"]     = {g:"Bosnia-Herz. y Qatar ambos eliminados casi. Bosnia con 1 pt, Qatar con 1 pt. Partido de honor.",go:"Edin Džeko (Bosnia) — leyenda histórica. Almoez Ali (Qatar) el más peligroso.",fi:"Džeko (Bosnia) — su último Mundial a los 40 años.",ap:"Bosnia gana · Džeko anota. Cuota est: 2.0x",pr:"Pred: Bosnia 2-1"};
ANAL["South Africa_South Korea"]     = {g:"Sudáfrica y Corea del Sur ambos con 1 pt. Partido de vida o muerte. Quien gane sigue vivo.",go:"Oh Hyeon-gyu y Hwang In-beom (Corea). Mokoena (Sudáfrica) mostró nivel en J2.",fi:"Hwang In-beom (Corea del Sur) — el mejor de Corea en este Mundial.",ap:"Corea del Sur gana · Hwang anota. Cuota est: 2.2x",pr:"Pred: Corea del Sur 2-0"};
ANAL["Curaçao_Ivory Coast"]          = {g:"Curazao sin puntos, goleado 1-7 por Alemania. Costa de Marfil con 3 pts quiere asegurar clasificación.",go:"Amad Diallo (Costa de Marfil) — el héroe de J1. Fofana también.",fi:"Amad Diallo (Costa de Marfil) — el más talentoso del equipo.",ap:"Costa de Marfil gana amplio · Amad Diallo anota. Cuota est: 1.6x",pr:"Pred: Costa de Marfil 3-0"};
ANAL["Switzerland_Canada"]           = {g:"Suiza lidera Grupo B con 4 pts. Canadá también con 4 pts. Decisivo por el 1er lugar. Suiza 4-1 Bosnia, Canadá 6-0 Qatar.",go:"Breel Embolo y Xhaka (Suiza). Jonathan David y Davies (Canadá).",fi:"Alphonso Davies (Canadá) — el más explosivo del torneo. Si tiene espacio, Suiza no lo para.",ap:"Partido muy parejo · Ambos clasificados · En juego el 1er lugar. Cuota empate: 3.2x",pr:"Pred: Empate 1-1"};
ANAL["Morocco_Haiti"]                = {g:"Marruecos lidera Grupo C con 4 pts. Haití sin puntos y ya eliminada. Marruecos debe golear.",go:"Hakimi, Ziyech, Saibari (Marruecos). Haití sin nivel para competir.",fi:"Hakim Ziyech (Marruecos) — regresa como titular. Letal en ataque.",ap:"Marruecos gana amplio · Más de 3.5 goles. Cuota est: 1.7x",pr:"Pred: Marruecos 4-0"};
ANAL["Scotland_Brazil"]              = {g:"Brasil con 4 pts busca liderar Grupo C. Escocia con 3 pts también quiere el 1er lugar. El partido más atractivo del 24 Jun.",go:"Vinícius Jr y Cunha (Brasil). McGinn y Adams (Escocia).",fi:"Vinícius Jr (Brasil) — el más desequilibrante. Si aparece, Brasil gana.",ap:"Brasil gana · Vinícius Jr anota · Más de 2.5 goles. Cuota est: 1.9x",pr:"Pred: Brasil 2-1"};
ANAL["Czechia_Mexico"]               = {g:"Rep. Checa con 1 pt necesita ganar sí o sí. México con 6 pts ya clasificado, puede rotar titulares.",go:"Krejčí y Souček (Rep. Checa). Jiménez si juega por México.",fi:"Tomáš Souček (Rep. Checa) — el motor. Puede liderar la remontada.",ap:"Rep. Checa gana · México rotado. Cuota est: 2.8x",pr:"Pred: Rep. Checa 2-1"};
ANAL["Ecuador_Germany"]              = {g:"Ecuador sin puntos, casi eliminado. Alemania con 6 pts ya clasificada y puede rotar. Ecuador necesita ganar y esperar.",go:"Enner Valencia y Caicedo (Ecuador). Musiala y Havertz si juegan (Alemania).",fi:"Moisés Caicedo (Ecuador) — el único que puede cambiar el partido.",ap:"Alemania gana aunque rote. Cuota est: 2.1x",pr:"Pred: Alemania 2-1"};


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
  var scoreHTML = "";
  if (done || live) {
    if (hG !== null && aG !== null) {
      var cls = sc(hG, aG);
      scoreHTML = '<span class="score ' + cls + '">' + hG + " \u2013 " + aG + "</span>";
    } else {
      scoreHTML = '<span style="font-size:11px;color:#4ade80;font-weight:700;">Final</span>';
    }
  } else {
    scoreHTML = '<span style="font-size:12px;color:#4ade80;font-weight:700;">' + hora + "</span>";
  }

  // Goles
  var golesL = [], golesA = [];
  (m.goals || []).forEach(function(g) {
    var gs = (g.scorer && g.scorer.name) || "";
    var gm = g.minute ? g.minute + "min" : "";
    var gt = g.type === "OWN_GOAL" ? " (OG)" : g.type === "PENALTY" ? " (p)" : "";
    var b = '<span class="badge">⚽ ' + gs + " " + gm + gt + "</span>";
    if (g.team && g.team.name === hName) golesL.push(b); else golesA.push(b);
  });

  // Tarjetas
  var tarjL = [], tarjA = [];
  (m.bookings || []).forEach(function(b) {
    var isR = b.card === "RED_CARD" || b.card === "YELLOW_RED_CARD";
    var em = isR ? "🟥" : "🟨";
    var co = isR ? "#f87171" : "#fbbf24";
    var bg = isR ? "#1a0808" : "#1a1500";
    var bo = isR ? "#3a1010" : "#3a3000";
    var pn = (b.player && b.player.name) || "";
    var pm = b.minute ? b.minute + "min" : "";
    var badge = '<span style="font-size:10px;background:' + bg + ';color:' + co + ';border:1px solid ' + bo + ';border-radius:4px;padding:1px 6px;">' + em + " " + pn + " " + pm + "</span>";
    if (b.team && b.team.name === hName) tarjL.push(badge); else tarjA.push(badge);
  });

  // Stats HTML
  var statsHTML = "";
  if (done && !golesL.length && !golesA.length && !tarjL.length && !tarjA.length) {
    statsHTML = '<div style="font-size:10px;color:#64748b;margin-bottom:6px;">ℹ️ Detalles de goles disponibles en la pestaña de Resultados del partido</div>';
  } else if ((done || live) && (golesL.length || golesA.length || tarjL.length || tarjA.length)) {
    var lCol = '<div style="flex:1;">'
      + (golesL.length ? '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:4px;">' + golesL.join("") + "</div>" : "")
      + (tarjL.length ? '<div style="display:flex;flex-wrap:wrap;gap:3px;">' + tarjL.join("") + "</div>" : "")
      + "</div>";
    var rCol = '<div style="flex:1;text-align:right;">'
      + (golesA.length ? '<div style="display:flex;flex-wrap:wrap;gap:3px;justify-content:flex-end;margin-bottom:4px;">' + golesA.join("") + "</div>" : "")
      + (tarjA.length ? '<div style="display:flex;flex-wrap:wrap;gap:3px;justify-content:flex-end;">' + tarjA.join("") + "</div>" : "")
      + "</div>";
    statsHTML = '<div style="display:flex;gap:8px;margin-bottom:8px;padding:8px;background:rgba(0,0,0,0.2);border-radius:7px;">' + lCol + rCol + "</div>";
  }

  // Análisis HTML
  var analHTML = "";
  if (anal) {
    var predHTML = anal.pr ? '<div style="background:linear-gradient(135deg,#1a3a1a,#0a1f0a);border:1px solid #4ade80;border-radius:8px;padding:6px 12px;margin-bottom:6px;text-align:center;font-size:13px;font-weight:800;color:#4ade80;">' + anal.pr + "</div>" : "";
    analHTML = '<div style="display:flex;flex-direction:column;gap:5px;margin-top:8px;">'
      + predHTML
      + '<div style="border-left:3px solid #4ade80;border-radius:7px;padding:7px 10px;background:rgba(0,0,0,.25);"><div style="font-size:10px;color:#4ade80;font-weight:700;margin-bottom:2px;">🏆 Análisis del partido</div><div style="font-size:11px;color:#cbd5e1;line-height:1.6;">' + anal.g + "</div></div>"
      + '<div style="border-left:3px solid #fbbf24;border-radius:7px;padding:7px 10px;background:rgba(0,0,0,.25);"><div style="font-size:10px;color:#fbbf24;font-weight:700;margin-bottom:2px;">⚽ Goleadores destacados</div><div style="font-size:11px;color:#cbd5e1;line-height:1.6;">' + anal.go + "</div></div>"
      + '<div style="border-left:3px solid #60a5fa;border-radius:7px;padding:7px 10px;background:rgba(0,0,0,.25);"><div style="font-size:10px;color:#60a5fa;font-weight:700;margin-bottom:2px;">⭐ Figura del partido</div><div style="font-size:11px;color:#cbd5e1;line-height:1.6;">' + anal.fi + "</div></div>"
      + '<div style="border-left:3px solid #c084fc;border-radius:7px;padding:7px 10px;background:rgba(0,0,0,.25);"><div style="font-size:10px;color:#c084fc;font-weight:700;margin-bottom:2px;">💰 Apuesta / Info</div><div style="font-size:11px;color:#cbd5e1;line-height:1.6;">' + anal.ap + "</div></div>"
      + '<a style="display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#1a6b1a,#0f4a0f);border:2px solid #4ade80;border-radius:10px;padding:10px;color:#fff;font-weight:800;font-size:13px;text-decoration:none;margin-top:2px;" href="https://www.jugabet.cl" target="_blank">🎰 Apostar en Jugabet Chile</a>'
      + "</div>";
  }

  // HTML de la tarjeta — estructura simple y robusta
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
  var jorBtns = jornadas.map(function(j,i){
    return '<button class="jbtn' + (i===jornadas.length-1?" active":"") + '" onclick="showJornada(' + j + ',this)">J' + j + "</button>";
  }).join("");
  var jorBlocks = jornadas.map(function(j,ji){
    var pj = finished.filter(function(m){return m.matchday===j;});
    var grpsP = grupos.filter(function(g){return pj.some(function(m){return m.group===g;});});
    return '<div id="j' + j + '" style="display:' + (ji===jornadas.length-1?"block":"none") + ';">'
      + grpsP.map(function(g){
          return '<div class="grp-block"><div class="grp-hdr">' + g.replace("GROUP_","Grupo ") + " · J" + j + "</div>"
            + pj.filter(function(m){return m.group===g;}).map(function(m){return makeCard(m);}).join("")
            + "</div>";
        }).join("")
      + "</div>";
  }).join("");

  // TABLAS
  // ── FIXTURE 16AVOS ──
  var fixture16HTML = '<div id="t16avos" style="display:none;">   <div style="background:#121c30;border-radius:10px;border:1px solid #1e2d45;overflow:hidden;margin-bottom:10px;">     <div style="padding:12px 13px;border-bottom:1px solid #1e2d45;display:flex;align-items:center;justify-content:space-between;">       <div style="font-size:14px;font-weight:800;color:#fff;">🏆 16avos de Final</div>       <div style="font-size:10px;color:#4ade80;">28 Jun – 3 Jul · Hora Chile</div>     </div>     <div style="overflow-x:auto;">       <table style="width:100%;border-collapse:collapse;font-size:12px;">         <thead><tr>           <th style="padding:7px 8px;color:#64748b;font-size:10px;text-transform:uppercase;background:#0b1120;text-align:left;">Hora</th>           <th style="padding:7px 8px;color:#64748b;font-size:10px;text-transform:uppercase;background:#0b1120;text-align:right;">Local</th>           <th style="padding:7px 8px;color:#64748b;font-size:10px;text-transform:uppercase;background:#0b1120;text-align:center;"></th>           <th style="padding:7px 8px;color:#64748b;font-size:10px;text-transform:uppercase;background:#0b1120;text-align:left;">Visitante</th>         </tr></thead>         <tbody><tr style="background:#0d2a18;">   <td colspan="4" style="padding:8px 10px;font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:1px;">📅 28 jun</td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">16:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇿🇦 Sudáfrica</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇨🇦 Canadá</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 SoFi Stadium, Los Ángeles &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">20:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇧🇷 Brasil</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇯🇵 Japón</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 NRG Stadium, Houston &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr style="background:#0d2a18;">   <td colspan="4" style="padding:8px 10px;font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:1px;">📅 29 jun</td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">13:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇩🇪 Alemania</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇵🇾 Paraguay</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 AT&T Stadium, Dallas &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">17:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇳🇱 Países Bajos</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇲🇦 Marruecos</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 Levi\'s Stadium, San José &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">20:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇨🇮 Costa de Marfil</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇳🇴 Noruega</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 Rose Bowl, Los Ángeles &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr style="background:#0d2a18;">   <td colspan="4" style="padding:8px 10px;font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:1px;">📅 30 jun</td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">13:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇫🇷 Francia</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇸🇪 Suecia</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 MetLife Stadium, Nueva York &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">17:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇲🇽 México</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🏴󠁧󠁢󠁳󠁣󠁴󠁿 Escocia</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 Arrowhead Stadium, Kansas City &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">20:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🏴󠁧󠁢󠁥󠁮󠁧󠁿 Inglaterra</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇨🇻 Cabo Verde</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 AT&T Stadium, Dallas &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr style="background:#0d2a18;">   <td colspan="4" style="padding:8px 10px;font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:1px;">📅 1 jul</td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">13:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇪🇬 Egipto</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇰🇷 Corea del Sur</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 Estadio BBVA, Monterrey &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">17:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇪🇸 España</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇦🇹 Austria</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 Hard Rock Stadium, Miami &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">20:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇺🇸 EE.UU.</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇧🇦 Bosnia-Herz.</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 SoFi Stadium, Los Ángeles &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr style="background:#0d2a18;">   <td colspan="4" style="padding:8px 10px;font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:1px;">📅 2 jul</td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">13:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇦🇺 Australia</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇮🇷 Irán</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 NRG Stadium, Houston &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">17:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇨🇭 Suiza</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇩🇿 Argelia</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 MetLife Stadium, Nueva York &nbsp; <span style="font-size:9px;background:#1a2744;color:#94a3b8;border-radius:3px;padding:1px 5px;">⏳ Pendiente</span></td> </tr><tr style="background:#0d2a18;">   <td colspan="4" style="padding:8px 10px;font-size:11px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:1px;">📅 3 jul</td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">13:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇦🇷 Argentina</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇺🇾 Uruguay</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 Hard Rock Stadium, Miami &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">17:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇵🇹 Portugal</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇬🇭 Ghana</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 SoFi Stadium, Los Ángeles &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr><tr>   <td style="padding:9px 8px;font-size:11px;color:#60a5fa;font-weight:700;">20:00</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;text-align:right;">🇨🇴 Colombia</td>   <td style="padding:9px 8px;font-size:11px;color:#fbbf24;font-weight:800;text-align:center;">VS</td>   <td style="padding:9px 8px;font-size:12px;font-weight:600;">🇭🇷 Croacia</td> </tr> <tr style="background:rgba(0,0,0,0.2);">   <td colspan="4" style="padding:2px 8px 8px;font-size:10px;color:#64748b;">🏟 AT&T Stadium, Dallas &nbsp; <span style="font-size:9px;background:#166534;color:#4ade80;border-radius:3px;padding:1px 5px;">✅ Confirmado</span></td> </tr></tbody>       </table>     </div>     <div style="padding:10px 13px;border-top:1px solid #1e2d45;font-size:10px;color:#64748b;">       ✓ 24 equipos clasificados directamente (12 primeros + 12 segundos) + 8 mejores terceros     </div>   </div> </div>';

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
    + 'function showJornada(j,btn){document.querySelectorAll(".jbtn").forEach(function(b){b.classList.remove("active");});btn.classList.add("active");document.querySelectorAll("[id^=j]").forEach(function(d){if(/^j\\d+$/.test(d.id))d.style.display="none";});var el=document.getElementById("j"+j);if(el)el.style.display="block";}'
    + 'function showGrp(id,btn){document.querySelectorAll(".gbtn").forEach(function(b){b.classList.remove("active");});btn.classList.add("active");document.querySelectorAll("[id^=t]").forEach(function(d){if(/^t[A-L]$/.test(d.id))d.style.display="none";});var el=document.getElementById(id);if(el)el.style.display="block";}';

  var favs = [["🇦🇷","Argentina","Messi hat-trick vs Argelia. Iguala récord Klose.","4.0x"],["🇫🇷","Francia","3-1 a Senegal. Mbappé goleador histórico.","4.5x"],["🇩🇪","Alemania","7-1 a Curazao. Mejor arranque del torneo.","5.5x"],["🏴󠁧󠁢󠁥󠁮󠁧󠁿","Inglaterra","4-2 a Croacia. Kane doblete.","8.0x"],["🇳🇴","Noruega","4-1 a Iraq. Haaland debut histórico.","12x"]];
  var bads = [["🇵🇹","Portugal","1-1 vs RD Congo. Cristiano sin tiros."],["🇪🇸","España","0-0 vs Cabo Verde. El campeón sin aparecer."],["🇳🇱","Países Bajos","2-2 vs Japón al 89min. Defensa frágil."]];

  // ── BRACKET 16AVOS V5 ── slots espaciados individualmente
  var BL=[
    {L:"🇿🇦 Sudáfrica",  V:"🇨🇦 Canadá",       h:"28/6 16:00"},
    {L:"🇩🇪 Alemania",   V:"🇵🇾 Paraguay",      h:"29/6 13:00"},
    {L:"🇨🇮 C. Marfil",  V:"🇳🇴 Noruega",       h:"29/6 20:00"},
    {L:"🇲🇽 México",     V:"🏴󠁧󠁢󠁳󠁣󠁴󠁿 Escocia",     h:"30/6 17:00"},
    {L:"🇪🇬 Egipto",     V:"🇰🇷 Corea Sur",     h:"1/7 13:00"},
    {L:"🇺🇸 EE.UU.",     V:"🇧🇦 Bosnia",        h:"1/7 20:00"},
    {L:"🇨🇭 Suiza",      V:"🇩🇿 Argelia",       h:"2/7 17:00"},
    {L:"🇦🇷 Argentina",  V:"🇺🇾 Uruguay",       h:"3/7 13:00"}
  ];
  var BR=[
    {L:"🇧🇷 Brasil",         V:"🇯🇵 Japón",        h:"28/6 20:00"},
    {L:"🇳🇱 Países Bajos",   V:"🇲🇦 Marruecos",    h:"29/6 17:00"},
    {L:"🇫🇷 Francia",        V:"🇸🇪 Suecia",       h:"30/6 13:00"},
    {L:"🏴󠁧󠁢󠁥󠁮󠁧󠁿 Inglaterra",   V:"🇨🇻 Cabo Verde",   h:"30/6 20:00"},
    {L:"🇪🇸 España",         V:"🇦🇹 Austria",      h:"1/7 17:00"},
    {L:"🇦🇺 Australia",      V:"🇮🇷 Irán",         h:"2/7 13:00"},
    {L:"🇵🇹 Portugal",       V:"🇬🇭 Ghana",        h:"3/7 17:00"},
    {L:"🇨🇴 Colombia",       V:"🇭🇷 Croacia",      h:"3/7 20:00"}
  ];

  // Altura fija de cada tarjeta de equipo
  var CH = 28; // card height px
  var GAP = 2; // gap entre tarjetas del mismo partido
  var MGAP = 8; // margen entre partidos
  // Altura de un partido completo: 2 tarjetas + gap + margin = 28+28+2+8 = 66px
  var PH = CH*2 + GAP + MGAP; // 66px por partido

  function bCard(name, time) {
    return "<div style='display:flex;align-items:center;justify-content:space-between;"
      +"background:#0b1120;border:1px solid #2a3a5a;border-radius:4px;"
      +"padding:3px 8px;height:"+CH+"px;min-width:115px'>"
      +"<span style='font-size:11px;font-weight:600;color:#e2e8f0;white-space:nowrap'>"+(name||"&nbsp;")+"</span>"
      +(time?"<span style='font-size:9px;color:#60a5fa;margin-left:4px;flex-shrink:0'>"+time+"</span>":"")
      +"</div>";
  }

  function bMatch(m) {
    return "<div style='margin-bottom:"+MGAP+"px'>"
      +"<div style='margin-bottom:"+GAP+"px'>"+bCard(m.L, m.h)+"</div>"
      +bCard(m.V, "")
      +"</div>";
  }

  function bEmptySlot(padTop) {
    return "<div style='padding-top:"+padTop+"px;margin-bottom:"+MGAP+"px'>"
      +"<div style='background:#0d1525;border:1px solid #1e2d45;border-radius:4px;height:"+CH+"px;min-width:98px;margin-bottom:"+GAP+"px'></div>"
      +"<div style='background:#0d1525;border:1px solid #1e2d45;border-radius:4px;height:"+CH+"px;min-width:98px'></div>"
      +"</div>";
  }

  // Columna 16avos (8 partidos)
  var b16L = "<div style='min-width:112px'>"
    +"<div style='font-size:9px;color:#4ade80;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:1px;background:#0d2a18;border-radius:4px;padding:3px;margin-bottom:4px'>16avos</div>"
    +BL.map(function(m){return bMatch(m);}).join("")
    +"</div>";

  var b16R = "<div style='min-width:112px'>"
    +"<div style='font-size:9px;color:#4ade80;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:1px;background:#0d2a18;border-radius:4px;padding:3px;margin-bottom:4px'>16avos</div>"
    +BR.map(function(m){return bMatch(m);}).join("")
    +"</div>";

  // 8vos: 4 slots, cada uno centrado entre 2 partidos de 16avos
  // 1er slot: paddingTop = PH/2 - CH (para centrar entre partido 1 y 2)
  // Los siguientes slots tienen paddingTop = PH (espacio de 1 partido)
  var pt8 = Math.floor(PH/2 - CH); // 66/2-28 = 5px
  var b8L = "<div style='min-width:100px'>"
    +"<div style='font-size:9px;color:#4ade80;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:1px;background:#0d2a18;border-radius:4px;padding:3px;margin-bottom:4px'>8vos</div>"
    +[0,1,2,3].map(function(i){ return bEmptySlot(i===0 ? pt8 : PH-CH*2-GAP); }).join("")
    +"</div>";

  var b8R = "<div style='min-width:100px'>"
    +"<div style='font-size:9px;color:#4ade80;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:1px;background:#0d2a18;border-radius:4px;padding:3px;margin-bottom:4px'>8vos</div>"
    +[0,1,2,3].map(function(i){ return bEmptySlot(i===0 ? pt8 : PH-CH*2-GAP); }).join("")
    +"</div>";

  // 4tos: 2 slots, centrados entre cada par de 8vos
  var PH8 = CH*2+GAP+MGAP + PH; // altura de 2 partidos de 16avos = 2*PH = 132px, pero el slot de 8vos ocupa menos
  // El slot de 8vos ocupa: padTop + CH*2 + GAP + MGAP = pt8 + 28+28+2+8 = 5+66 = 71px
  // Para 4tos: paddingTop = altura de 2 slots de 8vos / 2 - CH = (2*(pt8+CH*2+GAP+MGAP))/2 - CH
  var slot8H = pt8 + CH*2 + GAP + MGAP; // 71px
  var pt4 = Math.floor(slot8H - CH); // 71-28 = 43px
  var b4L = "<div style='min-width:95px'>"
    +"<div style='font-size:9px;color:#4ade80;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:1px;background:#0d2a18;border-radius:4px;padding:3px;margin-bottom:4px'>4tos</div>"
    +[0,1].map(function(i){ return bEmptySlot(i===0 ? pt4 : slot8H*2-CH*2-GAP); }).join("")
    +"</div>";

  var b4R = "<div style='min-width:95px'>"
    +"<div style='font-size:9px;color:#4ade80;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:1px;background:#0d2a18;border-radius:4px;padding:3px;margin-bottom:4px'>4tos</div>"
    +[0,1].map(function(i){ return bEmptySlot(i===0 ? pt4 : slot8H*2-CH*2-GAP); }).join("")
    +"</div>";

  // Semis: 1 slot, centrado entre los 2 slots de 4tos
  var slot4H = pt4 + CH*2 + GAP + MGAP; // 43+66 = 109px
  var ptSF = Math.floor(slot4H - CH); // 109-28 = 81px
  var bSFL = "<div style='min-width:90px'>"
    +"<div style='font-size:9px;color:#4ade80;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:1px;background:#0d2a18;border-radius:4px;padding:3px;margin-bottom:4px'>Semis</div>"
    +bEmptySlot(ptSF)
    +"</div>";

  var bSFR = "<div style='min-width:90px'>"
    +"<div style='font-size:9px;color:#4ade80;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:1px;background:#0d2a18;border-radius:4px;padding:3px;margin-bottom:4px'>Semis</div>"
    +bEmptySlot(ptSF)
    +"</div>";

  // Final: centrado entre los 2 slots de semis
  var slotSFH = ptSF + CH*2 + GAP + MGAP;
  var ptFin = Math.floor(slotSFH - 50); // centrar el trofeo
  var bFin = "<div style='min-width:75px;padding-top:"+ptFin+"px'>"
    +"<div style='background:linear-gradient(135deg,#1a2200,#0d2a18);border:2px solid #fbbf24;border-radius:10px;padding:10px 8px;text-align:center'>"
    +"<div style='font-size:9px;color:#fbbf24;font-weight:700;letter-spacing:1px;margin-bottom:4px'>🏆 FINAL</div>"
    +"<div style='font-size:8px;color:#64748b;margin-bottom:6px'>19 Jul · MetLife</div>"
    +"<div style='font-size:22px'>🏆</div>"
    +"<div style='font-size:9px;color:#fbbf24;font-weight:700;margin-top:4px'>Campeón</div>"
    +"</div></div>";

  var bSep = "<div style='width:6px;flex-shrink:0'></div>";
  var bArr = "<div style='display:flex;align-items:center;width:8px;flex-shrink:0;padding-top:"+Math.floor(pt8+CH)+"px;color:#334155;font-size:10px'>›</div>";
  var bArrL = "<div style='display:flex;align-items:center;width:8px;flex-shrink:0;padding-top:"+Math.floor(pt8+CH)+"px;color:#334155;font-size:10px'>‹</div>";

  var fix16 = "<div style='background:#121c30;border-radius:10px;border:2px solid #4ade80;overflow:hidden;margin-top:20px'>"
    +"<div style='padding:12px 13px;border-bottom:1px solid #1e2d45;display:flex;align-items:center;justify-content:space-between'>"
    +"<div style='font-size:15px;font-weight:800;color:#4ade80'>🏆 Bracket 16avos → Final</div>"
    +"<div style='font-size:10px;color:#94a3b8'>28 Jun – 19 Jul · Hora Chile</div></div>"
    +"<div style='overflow-x:auto;padding:14px'>"
    +"<div style='display:flex;align-items:flex-start;gap:0;min-width:1100px'>"
    +b16L+bSep+bArr+bSep+b8L+bSep+bArr+bSep+b4L+bSep+bArr+bSep+bSFL+bSep+bArr+bSep
    +bFin
    +bSep+bArrL+bSep+bSFR+bSep+bArrL+bSep+b4R+bSep+bArrL+bSep+b8R+bSep+bArrL+bSep+b16R
    +"</div></div>"
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
    + '<h2 style="font-size:14px;color:#cbd5e1;">Resultados por Grupo</h2><div>' + jorBtns + '</div></div>'
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

/**
 * Authoritative Spanish street-type ("tipo de vía") table.
 *
 * Source: **Agencia Estatal de Administración Tributaria (AEAT)** —
 * "Tabla de Tipos de Vías" (tablas auxiliares de la Sede Electrónica),
 * `https://sede.agenciatributaria.gob.es/static_files/Sede/tablas_auxiliares/tipo_via/Tabla_Tipos_de_Vias.zip`
 * (snapshot 11/09/2026). Public-sector information re-used under Ley 37/2007;
 * attribution: © Agencia Estatal de Administración Tributaria.
 *
 * The table is pipe-delimited below as `ABBREVIATION|CODE|NAME`, exactly as it
 * ships (Latin-1 decoded). One row per (abbreviation, name) pair; a CODE groups
 * the multilingual synonyms of one type (Castilian / Catalan / Basque /
 * Galician), e.g. `CL` = CALLE | CARRER | KALEA | KARRIKA.
 *
 * `via-tipos.ts` expands this into the runtime abbreviation/name → canonical
 * dictionary and applies the curated overrides below.
 */

export const AEAT_VIA_TIPOS_RAW = `ACCE|AC|ACCES
ACCES|AC|ACCESO
ACEQ|AE|ACEQUIA
ACERA|AA|ACERA
ALAM|AL|ALAMEDA
ALDAP|CT|ALDAPA
ALDEA|AD|ALDEA
ALQUE|AQ|ALQUERIA
ALTO|AT|ALTO
ANDAD|AN|ANDADOR
ANGTA|AG|ANGOSTA
APDRO|AO|APEADEIRO
APDRO|AO|APEADERO
APTES|AP|APARTAMENTS
APTOS|AP|APARTAMENTOS
ARB|AB|ARBOLEDA
ARRAL|AR|ARRABAL
ARREK|AY|ERREKA
ARRY|AY|ARROYO
ASSEG|AS|ASSEGADOR
ATAJO|AJ|ATAJO
ATAL|AJ|ATALL
ATALL|AJ|ATALLO
ATZUC|AZ|ATZUCAT
AUTO|AU|AUTOPISTA
AUTOV|AI|AUTOVIA
AUZO|BO|AUZO
AUZOT|BA|AUZOTEGI
AUZUN|BO|AUZUNEA
AV|AV|AV
AVDA|AV|AVENIDA
AVGDA|AV|AVINGUDA
AVIA|AI|AUTOVIA
BALNR|BN|BALNEARIO
BARDA|BA|BARRIADA
BARRI|BO|BARRI
BARRO|BO|BARRIO
BDA|BJ|BAIXADA
BELNA|BE|BELENA
BIDE|VI|BIDE
BIDEB|GL|BIDEBIETA
BJADA|BJ|BAJADA
BLOC|BL|BLOC
BLQUE|BL|BLOQUE
BQLLO|BQ|BARRANQUIL
BRANC|BR|BARRANCO
BRDLA|BD|BARREDUELA
BRZAL|BZ|BRAZAL
BSRIA|BS|BASERRIA
BULEV|BV|BULEVAR
BV|BV|BULEVAR
C|C|C
C.H.|KH|CMNO HONDO
C.N.|KN|CMNO NUEVO
C.V.|KV|CMNO VIEJO
C/|C/|C/
CALLE|CL|CALLE
CAMI|CM|CAMI
CAMIN|CM|CAMIN
CAMPA|CP|CAMPA
CAMPG|CG|CAMPING
CAMPO|CP|CAMPO
CANAL|CA|CANAL
CANT|CQ|CANTON
CANTI|QT|CANTINA
CANTO|CQ|CANTO
CANTR|QA|CANTERA
CANÑO|KÑ|CANTIÑO
CARRA|QD|CARRERADA
CARRE|CL|CARRER
CARRY|VR|CARRERANY
CASA|CS|CASA
CBTIZ|CB|COBERTIZO
CCVCN|CV|CIRCUNVALACION
CELLA|QN|CANELLA
CERRO|CE|CERRO
CHLET|CH|CHALET
CINT|CI|CINTURON
CINT|CI|CINTURO
CINY|CI|CINYELL
CIRCU|CV|CIRCUNVALACION
CJLA|CU|CALLEJUELA
CJTO|CN|CONJUNTO
CLEYA|CY|CALEYA
CLLJA|CJ|CALLEJA
CLLON|CK|CALLEJON
CLLZO|KZ|CALLIZO
CLYON|KY|CALEYON
CMNET|CM|CAMINET
CMNO|CM|CAMINO
CMÑO|CM|CAMIÑO
CNLLA|QN|CANELLA
CNVT|CW|CONVENT
CNVTO|CW|CONVENTO
COL|CO|COLONIA
COMPJ|QJ|COMPLEJO
COOP|KP|COOPERATIVA
COSTA|KO|COSTA
COSTE|KR|COSTERA
CRA|KA|CARRERA
CRCRO|CC|CRUCEIRO
CRLLO|RL|CORRILLO
CRO|QR|CARRERO
CRRAL|QL|CORRALO
CRRAL|QL|CORRAL
CRRCI|KD|CORREDORCILLO
CRRDA|KD|CORREDOIRA
CRRDE|KD|CORREDERA
CRRDO|KD|CORREDOR
CRRIL|KL|CARRIL
CRRLO|QO|CORRALILLO
CRROL|RR|CORRIOL
CRROL|SD|CORRIOL
CRTIL|QI|CARRETIL
CRTJO|KT|CORTIJO
CSRIO|CS|CASERIO
CSTAN|KS|COSTANILLA
CTRA|CR|CARRETERA
CTRIN|QE|CARRETERIN
CUADR|CD|CUADRA
CUEVA|QV|CUEVA/S
CUSTA|CT|CUESTA
CXON|CX|CALEXON
CZADA|CZ|CALZADA
CZADS|CÇ|CALZADAS
CÑADA|CÑ|CAÑADA
DEMAR|DM|DEMARCACION
DEMAR|DM|DEMARCAÇIO
DHSA|DH|DEHESA
DISEM|DS|DISEMINADO
DISSE|DS|DISSEMINAT
DRERA|DR|DREÇERA
EDIFC|ED|EDIFICIO/S
EIRAD|EI|EIRADO
EMPR|ER|EMPRESA
ENTD|EP|ENTRADA
EPTZA|PZ|ENPARANTZA
ERREB|AR|ERREBAL
ERREP|CR|ERREPIDE
ERRIB|VG|ERRIBERA
ESC|EC|ESCALA/S
ESCA|EC|ESCALERA/S
ESCAL|EW|ESCALINATA
ESLDA|ES|ESPALDA
ESPIG|EG|ESPIGO
ESTAC|EN|ESTACIO
ESTCN|EN|ESTACION
ESTDA|EX|ESTRADA
ETDEA|AV|ETORBIDEA
ETXAD|GR|ETXADI
ETXAR|CK|ETXARTE
EXPLA|EZ|EXPLANADA
EXTRM|EM|EXTRAMUROS
EXTRR|ET|EXTRARRADIO
FALDA|FD|FALDA
FBRCA|FC|FABRICA
FINCA|FN|FINCA
G.V.|GV|GRAN VIA
GAIN|AT|GAIN
GALE|GA|GALERIA
GLLZO|GZ|GALLIZO
GORAB|SB|GORABIDE
GRANJ|GJ|GRANJA
GRUP|GR|GRUP
GRUPO|GR|GRUPO/S
GTA|GL|GLORIETA
HEGI|HG|HEGI
HIPOD|HP|HIPODROMO
HIRIB|AV|HIRIBIDEA
HONDA|PY|HONDARTZA
HOYA|HY|HOYA
ILLA|IL|ILLA
INDA|IN|INDA
JARD|JR|JARDI
JDIN|JR|JARDINS
JDIN|JR|JARDIN
JDINS|JR|JARDINES
KAI|ML|KAI
KALE|CL|KALEA
KARIK|CJ|KARRIK
KARRE|KA|KARRERA
KARRI|CL|KARRIKA
KOSTA|KO|KOSTA
KRRIL|KL|KARRIL
LAGO|LA|LAGO
LASTE|AJ|LASTERBIDE
LDERA|LD|LADERA
LEKU|LG|LEKU
LLNRA|LL|LLANURA
LLOC|LG|LLOC
LOMA|LM|LOMA
LOMO|LO|LOMO
LORAK|JR|LORATEGIAK
LORAT|JR|LORATEGI
LUGAR|LG|LUGAR
MALEC|MA|MALECON
MASIA|MS|MASIA/S
MAZO|MZ|MAZO
MENDI|MT|MENDI
MERC|MC|MERCADO
MERCT|MC|MERCAT
MIRAD|MD|MIRADOR
MOLL|ML|MOLL
MONTE|MT|MONTE
MRDOR|MD|MIRADOR
MTRIO|MO|MONASTERIO
MUELL|ML|MUELLE
NAVE|NV|NAVE/S
NCLEO|UN|NUCLEO
NUDO|ND|NUDO
ONDA|PY|ONDARTZA
PAGO|PP|PAGO
PALAC|PC|PALACIO
PANT|P|PANTANO
PARC|PQ|PARC
PARKE|PQ|PARKE
PARTI|PF|PARTICULAR
PAS|PA|PAS
PASAI|PJ|PASAIA
PASEA|PS|PASEALEKUA
PASEA|PS|PASEABIDE
PASEO|PS|PASEO
PASEO|PS|PASEO
PASSE|PS|PASSEIG
PATIO|PK|PATIO
PBDO|PB|POBLADO
PBLO|PB|PUEBLO
PDA|PV|PUJADA
PDIS|PÇ|PASSADIS
PG|PG|PG
PGIND|PG|POLIGONO INDUST
PINAR|PN|PINAR
PISTA|PI|PISTA
PJDA|SU|PUJADA, SUBIDA
PL|PL|PL
PLA|PW|PLA
PLAYA|PY|PLAYA
PLAZA|PZ|PLAZA
PLAÇA|PZ|PLAÇA
PLCET|PL|PLACETA
PLLOP|PX|PASILLO
PLZLA|PL|PLAZUELA
PNTE|PT|PUENTE
POLIG|PG|POLIGONO
PONT|PT|PONT
PONTE|PT|PONTE
PORT|PO|PORT
PQUE|PQ|PARQUE
PRAGE|PE|PARATGE
PRAIA|PY|PRAIA
PRAJE|PE|PARAJE
PRAXE|PE|PARAXE
PRAZA|PZ|PRAZA
PRAÑA|PÑ|PRACIÑA
PROL|PR|PROLONGACIO
PROL|PR|PROLONGACION
PRTAL|PH|PORTAL
PRTCO|PH|PORTICO
PRZLA|PL|PRAZUELA
PSAJE|PJ|PASAJE
PSAXE|PJ|PASAXE
PSLLO|PX|PASILLO
PSMAR|PM|PASEO MARITIMO
PTA|PU|PUERTA
PTDA|PD|PARTIDA
PTGE|PJ|PASSATGE
PTILO|PO|PORTILLO
PTLLO|PO|PUERILO
PTO|PO|PUERTO
PZO|PÇ|PASADIZO
PZTA|PL|PLAZOLETA
RABAL|AR|RABAL
RACDA|RA|RACONADA
RACO|RC|RACO
RAMAL|RM|RAMAL
RAMPA|RP|RAMPLA
RAMPA|RP|RAMPA
RAVAL|AR|RAVAL
RBLA|RB|RAMBLA
RBRA|RI|RIBERA
RCDA|RN|RINCONADA
RCON|RC|RINCON
RENTO|RT|RENTO
RESID|RS|RESIDENCIAL
RIERA|AY|RIERA
RONDA|RD|RONDA
RTDA|RO|ROTONDA
RUA|RU|RUA
RUELA|CU|RUELA
RUERO|RE|RUEIRO
SANAT|SA|SANATORIO
SANTU|ST|SANTUARIO
SARBI|AC|SARBIDE
SBIDA|SB|SUBIDA
SECT|SC|SECTOR
SEDER|SD|SENDER
SEDRA|SR|SENDERA
SEKT|SC|SEKTORE
SEND|SN|SENDERO
SENDA|SD|SENDA
SVTIA|CM|SERVENTIA
TALDE|GR|TALDE
TOKI|PE|TOKI
TRANS|TS|TRANSITO
TRAS|TA|TRASERA
TRAS|TA|TRASEIRA
TRAV|TR|TRAVESSERA
TRRNT|TO|TORRENTE
TRSSI|TR|TRAVESSIA
TRVA|TR|TRAVESIA
TRVAL|TV|TRANSVERSAL
URB|UR|URBANIZACION
URBAT|UR|URBANITZACIO
URBAZ|UR|URBANIZAZIO
VALLE|VA|VALLE
VCTE|VD|VIADUCTE
VCTO|VD|VIADUCTO
VECIN|VC|VECINDARIO
VEGA|VG|VEGA
VENAT|VE|VEINAT
VENLA|VN|VENELA
VIA|VI|VIA
VIAL|VL|VIAL
VIANY|SN|VIARANY
VILLA|V|VILLA
VREDA|VR|VEREDA
VVDAS|VV|VIVIENDAS
XDIN|JR|XARDIN
ZEHAR|ZE|ZEARKALETA
ZONA|ZO|ZONA
ZUBI|PT|ZUBI
ZUHAI|AB|ZUHAIZTI
ZUMAR|AL|ZUMARDI`

/**
 * Per-code canonical label overrides.
 *
 * Needed only where the code's first name is not the Castilian/standard label
 * (e.g. `AY` lists ERREKA first) or where the "name" is just the code (`C`).
 * Codes whose group contains an INE-canonical Castilian name need no override —
 * `via-tipos.ts` picks the INE label automatically.
 */
export const CODE_CANONICAL_OVERRIDES: Readonly<Record<string, string>> = {
  C: 'Calle',
  'C/': 'Calle',
  AO: 'Apeadero',
  AP: 'Apartamentos',
  AY: 'Arroyo',
  BA: 'Barriada',
  BJ: 'Bajada',
  VR: 'Vereda',
  CW: 'Convento',
  QL: 'Corral',
  GR: 'Grupo',
  SB: 'Subida',
  SU: 'Subida',
  'PÇ': 'Pasadizo',
  PL: 'Placeta',
  EC: 'Escalera',
  MS: 'Masía',
  CQ: 'Cantón',
  PA: 'Paso',
  KH: 'Camino Hondo',
  KN: 'Camino Nuevo',
  KV: 'Camino Viejo',
}

/**
 * Aliases not present in the AEAT table: the conventional Spanish abbreviations
 * and the common OCR/typing variants of the Castilian types. Applied last, so
 * they win over the table (e.g. `pl` → Plaza, the everyday meaning, over AEAT's
 * `PL` = Placeta).
 */
export const EXTRA_VIA_TIPO_ALIASES: Readonly<Record<string, string>> = {
  // Calle
  c: 'Calle',
  'c/': 'Calle',
  cl: 'Calle',
  cll: 'Calle',
  cal: 'Calle',
  // Avenida
  av: 'Avenida',
  avnda: 'Avenida',
  avnida: 'Avenida',
  aven: 'Avenida',
  // Plaza
  pl: 'Plaza',
  pza: 'Plaza',
  pz: 'Plaza',
  plz: 'Plaza',
  plza: 'Plaza',
  pzla: 'Plaza',
  // Paseo
  ps: 'Paseo',
  pso: 'Paseo',
  'pº': 'Paseo',
  'p.o': 'Paseo',
  'p.º': 'Paseo',
  // Ronda
  rda: 'Ronda',
  rnd: 'Ronda',
  // Travesía
  trv: 'Travesía',
  // Carretera
  crta: 'Carretera',
  cra: 'Carretera',
  carr: 'Carretera',
  carre: 'Carretera',
  carretra: 'Carretera',
  carrete: 'Carretera',
  cter: 'Carretera',
  // Camino
  cno: 'Camino',
  cmno: 'Camino',
  cmn: 'Camino',
  cam: 'Camino',
  camnio: 'Camino',
  // Gran Vía
  gv: 'Gran Vía',
  granvia: 'Gran Vía',
  'gran via': 'Gran Vía',
  // Paseo Marítimo
  pmar: 'Paseo Marítimo',
  // Avenida de la Constitución
  'avenida de la constitucion': 'Avenida de la Constitución',
  // Bloque
  blq: 'Bloque',
  bl: 'Bloque',
  bloq: 'Bloque',
  // Glorieta
  glta: 'Glorieta',
  glor: 'Glorieta',
  // Urbanización
  urbn: 'Urbanización',
  // Acceso
  acc: 'Acceso',
  // Aeropuerto
  aero: 'Aeropuerto',
  aerop: 'Aeropuerto',
  // Alameda
  alm: 'Alameda',
  // Arrabal
  arr: 'Arrabal',
  // Autopista
  aut: 'Autopista',
  autop: 'Autopista',
  ap: 'Autopista',
  // Barrio
  baro: 'Barrio',
  brrio: 'Barrio',
  // Edificio
  edif: 'Edificio',
  edf: 'Edificio',
  // Jardín
  jdn: 'Jardín',
  // Lugar
  lug: 'Lugar',
  // Parque
  pq: 'Parque',
  parq: 'Parque',
  // Pasaje
  psje: 'Pasaje',
  pje: 'Pasaje',
  // Polígono
  pg: 'Polígono',
  pol: 'Polígono',
  polig: 'Polígono',
  // Prolongación
  prol: 'Prolongación',
  // Puente
  pte: 'Puente',
  // Puerto
  pto: 'Puerto',
  // Rambla
  rmb: 'Rambla',
  // Residencial
  resid: 'Residencial',
  res: 'Residencial',
  // Rincón
  rinc: 'Rincón',
  // Salida
  sal: 'Salida',
  // Sector
  sect: 'Sector',
  // Senda
  snd: 'Senda',
  // Valle
  vll: 'Valle',
  // Vía Pública
  vp: 'Vía Pública',
  'via publica': 'Vía Pública',
  // Zona
  zn: 'Zona',
  // Playa
  ply: 'Playa',
  // Cruz
  crz: 'Cruz',
  // Llano
  lln: 'Llano',
  // Parada
  pda: 'Parada',
  // Km
  km: 'Km',
  kilometro: 'Km',
}

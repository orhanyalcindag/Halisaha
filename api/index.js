const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Helpers
function generateActivationCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `SAHA-${suffix}`;
}

function getDefaultMatchDate() {
  const now = new Date();
  const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
  const nextDate = new Date(now.getTime() + daysUntilFriday * 24 * 60 * 60 * 1000);
  return nextDate.toISOString().split('T')[0];
}

function createInitialState() {
  return {
    adminUsername: 'Orhan',
    adminPassword: '1905',
    currentMatch: {
      id: crypto.randomUUID(),
      weekTitle: 'Haftalık Halısaha Maçı',
      matchDate: getDefaultMatchDate(),
      matchTime: '21:00 - 22:00',
      venue: 'Merkez Olimpik Halısaha',
      code: generateActivationCode(),
      maxPlayers: 14,
      createdAt: new Date().toISOString(),
      players: [],
      teams: null
    },
    history: []
  };
}

// Data persistence: Vercel KV / Upstash REST or /tmp/db.json
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const TMP_FILE = path.join(process.platform === 'win32' ? process.cwd() : '/tmp', 'halisaha_db.json');

let memoryCache = null;

async function loadDB() {
  if (KV_URL && KV_TOKEN) {
    try {
      const res = await fetch(`${KV_URL}/get/halisaha_match_db`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });
      const data = await res.json();
      if (data && data.result) {
        const parsed = JSON.parse(data.result);
        parsed.adminUsername = 'Orhan';
        parsed.adminPassword = '1905';
        return parsed;
      }
    } catch (e) {
      console.error('KV okuma hatası:', e);
    }
  }

  if (memoryCache) return memoryCache;

  try {
    if (fs.existsSync(TMP_FILE)) {
      const raw = fs.readFileSync(TMP_FILE, 'utf8');
      memoryCache = JSON.parse(raw);
      memoryCache.adminUsername = 'Orhan';
      memoryCache.adminPassword = '1905';
      return memoryCache;
    }
  } catch (e) {}

  memoryCache = createInitialState();
  await saveDB(memoryCache);
  return memoryCache;
}

async function saveDB(data) {
  memoryCache = data;
  if (KV_URL && KV_TOKEN) {
    try {
      await fetch(`${KV_URL}/set/halisaha_match_db`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${KV_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(JSON.stringify(data))
      });
      return;
    } catch (e) {
      console.error('KV kayıt hatası:', e);
    }
  }

  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

function isAuthorizedAdmin(body, db) {
  if (!body) return false;
  const username = String(body.username || '').trim();
  const password = String(body.password || body.pin || '').trim();
  const expectedUser = (db.adminUsername || 'Orhan').toLowerCase();
  const expectedPass = String(db.adminPassword || '1905');
  return Boolean(username && password && username.toLowerCase() === expectedUser && password === expectedPass);
}

const POSITION_LABELS = {
  GK: 'Kaleci',
  DEF: 'Defans',
  MID: 'Orta Saha',
  FWD: 'Forvet'
};

function getPositionsLabel(positions) {
  if (!positions || positions.length === 0) return 'Belirtilmedi';
  if (positions.includes('GK')) return 'Kaleci';
  if (positions.length === 3) return 'Defans • Orta Saha • Forvet (Joker)';
  return positions.map(p => POSITION_LABELS[p] || p).join(' • ');
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const SUBPOSITION_SIDE_ORDER = { Sol: 0, Merkez: 1, Sağ: 2 };

function buildTeamTacticalLayout(teamPlayers, teamKey) {
  if (!teamPlayers || teamPlayers.length === 0) return [];

  let gkIndex = teamPlayers.findIndex(p => (p.positions || [p.position]).includes('GK'));
  if (gkIndex === -1) gkIndex = 0;

  const gkPlayer = teamPlayers[gkIndex];
  const outfield = teamPlayers.filter((_, idx) => idx !== gkIndex);

  const assigned = [];
  let defCount = 0;
  let midCount = 0;
  let fwdCount = 0;

  const unassigned = [];
  for (const player of outfield) {
    const poses = player.positions && player.positions.length > 0 ? player.positions : [player.position || 'MID'];
    if (poses.length === 1 && poses[0] !== 'GK') {
      const pos = poses[0];
      if (pos === 'DEF') defCount++;
      else if (pos === 'MID') midCount++;
      else if (pos === 'FWD') fwdCount++;
      assigned.push({ player, assignedPos: pos });
    } else {
      unassigned.push(player);
    }
  }

  const shuffledFlex = shuffleArray(unassigned);
  for (const player of shuffledFlex) {
    const poses = player.positions || [player.position || 'MID'];
    const candidates = poses.filter(p => p !== 'GK');
    if (candidates.length === 0) candidates.push('MID');

    let bestPos = candidates[0];
    let bestScore = -999;

    for (const c of candidates) {
      let score = 0;
      if (c === 'DEF') {
        if (defCount < 2) score = 10 - defCount;
        else if (defCount === 2) score = 2;
        else score = -5;
      } else if (c === 'MID') {
        if (midCount < 2) score = 10 - midCount;
        else if (midCount === 2) score = 5;
        else if (midCount === 3) score = 1;
        else score = -5;
      } else if (c === 'FWD') {
        if (fwdCount < 1) score = 10 - fwdCount;
        else if (fwdCount === 1) score = 4;
        else score = -5;
      }

      if (score > bestScore) {
        bestScore = score;
        bestPos = c;
      }
    }

    if (bestPos === 'DEF') defCount++;
    else if (bestPos === 'MID') midCount++;
    else if (bestPos === 'FWD') fwdCount++;

    assigned.push({ player, assignedPos: bestPos });
  }

  let defLine = assigned.filter(a => a.assignedPos === 'DEF').map(a => a.player);
  let midLine = assigned.filter(a => a.assignedPos === 'MID').map(a => a.player);
  let fwdLine = assigned.filter(a => a.assignedPos === 'FWD').map(a => a.player);

  while (defLine.length === 0 && (midLine.length > 1 || fwdLine.length > 1)) {
    if (midLine.length >= fwdLine.length) defLine.push(midLine.shift());
    else defLine.push(fwdLine.shift());
  }
  while (fwdLine.length === 0 && (midLine.length > 1 || defLine.length > 1)) {
    if (midLine.length >= defLine.length) fwdLine.push(midLine.pop());
    else fwdLine.push(defLine.pop());
  }
  while (midLine.length === 0 && (defLine.length > 1 || fwdLine.length > 1)) {
    if (defLine.length >= fwdLine.length) midLine.push(defLine.pop());
    else midLine.push(fwdLine.shift());
  }

  while (defLine.length > 3) midLine.unshift(defLine.pop());
  while (fwdLine.length > 3) midLine.push(fwdLine.shift());
  while (midLine.length > 3) {
    if (defLine.length <= fwdLine.length && defLine.length < 3) defLine.push(midLine.shift());
    else if (fwdLine.length < 3) fwdLine.unshift(midLine.pop());
    else break;
  }

  function getLateralPositions(count, lineIndex) {
    if (count === 1) return [50];
    if (count === 2) return lineIndex === 1 ? [30, 70] : [32, 68];
    if (count === 3) return [20, 50, 80];
    if (count === 4) return [14, 38, 62, 86];
    return Array.from({ length: count }, (_, idx) => Math.round(((idx + 1) / (count + 1)) * 100));
  }

  const lineDepthsFull = { GK: 7, DEF: 20, MID: 33, FWD: 44 };
  const lineDepthsSingle = { GK: 87, DEF: 66, MID: 43, FWD: 20 };
  const jerseyPool = [1, 2, 3, 4, 6, 8, 10, 7, 11, 9, 5, 14, 15, 16];
  let jerseyIdx = 0;

  const result = [];
  const isTeamA = teamKey === 'A';

  const isDedicatedGK = (gkPlayer.positions || [gkPlayer.position]).includes('GK');
  result.push({
    ...gkPlayer,
    team: teamKey,
    jerseyNumber: 1,
    tacticalLine: 'GK',
    tacticalRoleLabel: isDedicatedGK ? 'Kaleci' : `Kaleci (${getPositionsLabel(gkPlayer.positions || [gkPlayer.position])})`,
    pitchX: isTeamA ? lineDepthsFull.GK : 100 - lineDepthsFull.GK,
    pitchY: 50,
    tacticalX: 50,
    tacticalY: lineDepthsSingle.GK
  });
  jerseyIdx = 1;

  const lines = [
    { key: 'DEF', label: 'Defans', players: defLine, depthFull: lineDepthsFull.DEF, depthSingle: lineDepthsSingle.DEF, defaultNumbers: [2, 3, 4, 5] },
    { key: 'MID', label: 'Orta Saha', players: midLine, depthFull: lineDepthsFull.MID, depthSingle: lineDepthsSingle.MID, defaultNumbers: [6, 8, 10, 7] },
    { key: 'FWD', label: 'Forvet', players: fwdLine, depthFull: lineDepthsFull.FWD, depthSingle: lineDepthsSingle.FWD, defaultNumbers: [9, 11, 14, 17] }
  ];

  const usedNumbers = new Set([1]);

  for (let lIdx = 0; lIdx < lines.length; lIdx++) {
    const line = lines[lIdx];
    const count = line.players.length;
    const laterals = getLateralPositions(count, lIdx + 1);

    const lineSorted = [...line.players].sort(
      (a, b) => (SUBPOSITION_SIDE_ORDER[a.subPosition] ?? 1) - (SUBPOSITION_SIDE_ORDER[b.subPosition] ?? 1)
    );

    lineSorted.forEach((player, idx) => {
      let lateral = laterals[idx];
      let staggerFull = 0;
      let staggerSingle = 0;
      if (count === 3 && idx === 1) {
        staggerFull = line.key === 'MID' ? -2.5 : 1.5;
        staggerSingle = line.key === 'MID' ? 4 : -3;
      }

      const depthF = line.depthFull + staggerFull;
      const pitchX = isTeamA ? depthF : 100 - depthF;
      const pitchY = isTeamA ? lateral : 100 - lateral;

      let jerseyNumber = line.defaultNumbers[idx] || jerseyPool[jerseyIdx++] || (result.length + 1);
      while (usedNumbers.has(jerseyNumber)) {
        jerseyNumber++;
      }
      usedNumbers.add(jerseyNumber);

      const poses = player.positions || [player.position];
      const otherPoses = poses.filter(p => p !== line.key && p !== 'GK');
      let roleDesc = line.label;
      if (player.subPosition && player.subPosition !== 'Merkez') {
        roleDesc = `${player.subPosition} ${line.label}`;
      }
      if (otherPoses.length > 0) {
        const extraNames = otherPoses.map(p => POSITION_LABELS[p] || p).join('/');
        roleDesc += ` (${extraNames} da oynar)`;
      }

      result.push({
        ...player,
        team: teamKey,
        jerseyNumber,
        tacticalLine: line.key,
        tacticalRoleLabel: roleDesc,
        pitchX: Number(pitchX.toFixed(1)),
        pitchY: Number(pitchY.toFixed(1)),
        tacticalX: Number(lateral.toFixed(1)),
        tacticalY: Number((line.depthSingle + staggerSingle).toFixed(1))
      });
    });
  }

  return result;
}

function distributeTeamsBalanced(players) {
  const mainPlayers = players.slice(0, 14);

  const gks = [];
  const pureDef = [];
  const pureMid = [];
  const pureFwd = [];
  const flexible = [];

  for (const p of mainPlayers) {
    const poses = p.positions && p.positions.length > 0 ? p.positions : [p.position || 'MID'];
    if (poses.includes('GK')) {
      gks.push(p);
    } else if (poses.length === 1) {
      if (poses[0] === 'DEF') pureDef.push(p);
      else if (poses[0] === 'MID') pureMid.push(p);
      else if (poses[0] === 'FWD') pureFwd.push(p);
      else pureMid.push(p);
    } else {
      flexible.push(p);
    }
  }

  const orderedPool = [
    ...shuffleArray(gks),
    ...shuffleArray(pureDef),
    ...shuffleArray(pureMid),
    ...shuffleArray(pureFwd),
    ...shuffleArray(flexible)
  ];

  const rawTeamA = [];
  const rawTeamB = [];

  for (let i = 0; i < orderedPool.length; i += 2) {
    const first = orderedPool[i];
    const second = orderedPool[i + 1];
    if (!second) {
      if (rawTeamA.length <= rawTeamB.length) rawTeamA.push(first);
      else rawTeamB.push(first);
      break;
    }
    if (Math.random() < 0.5) {
      rawTeamA.push(first);
      rawTeamB.push(second);
    } else {
      rawTeamB.push(first);
      rawTeamA.push(second);
    }
  }

  const teamA = buildTeamTacticalLayout(rawTeamA, 'A');
  const teamB = buildTeamTacticalLayout(rawTeamB, 'B');

  return {
    teamAName: 'A Takımı (Kırmızı)',
    teamBName: 'B Takımı (Yeşil)',
    teamAColor: '#e11d48',
    teamBColor: '#16a34a',
    teamA,
    teamB,
    drawnAt: new Date().toISOString()
  };
}

function sanitizeMatch(match) {
  return {
    id: match.id,
    weekTitle: match.weekTitle,
    matchDate: match.matchDate,
    matchTime: match.matchTime,
    venue: match.venue,
    code: match.code,
    maxPlayers: match.maxPlayers,
    createdAt: match.createdAt,
    players: match.players,
    teams: match.teams
  };
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString('utf8');
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// Vercel Serverless Function Handler
module.exports = async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname.replace(/^\/api/, '');

  const db = await loadDB();

  // GET /match
  if (req.method === 'GET' && (pathname === '/match' || pathname === '')) {
    const inputCode = (parsedUrl.searchParams.get('code') || '').trim().toUpperCase();
    const activeCode = (db.currentMatch.code || '').trim().toUpperCase();

    if (!inputCode) {
      return sendJSON(res, 200, {
        requiresCode: true,
        weekTitle: db.currentMatch.weekTitle,
        matchDate: db.currentMatch.matchDate,
        matchTime: db.currentMatch.matchTime,
        venue: db.currentMatch.venue,
        playerCount: db.currentMatch.players.length,
        maxPlayers: db.currentMatch.maxPlayers
      });
    }

    if (inputCode !== activeCode) {
      return sendJSON(res, 403, {
        valid: false,
        message: 'Girdiğiniz haftalık aktivasyon kodu geçersiz veya güncel değil!'
      });
    }

    return sendJSON(res, 200, {
      valid: true,
      match: sanitizeMatch(db.currentMatch)
    });
  }

  // POST /match/join
  if (req.method === 'POST' && pathname === '/match/join') {
    const body = await parseBody(req);
    const inputCode = (body.code || '').trim().toUpperCase();
    const activeCode = (db.currentMatch.code || '').trim().toUpperCase();

    if (inputCode !== activeCode) {
      return sendJSON(res, 403, { ok: false, message: 'Aktivasyon kodu geçersiz!' });
    }

    const name = (body.name || '').trim().replace(/\s+/g, ' ');
    const subPosition = (body.subPosition || 'Merkez').trim();

    if (!name || name.length < 2 || name.length > 28) {
      return sendJSON(res, 400, { ok: false, message: 'Lütfen geçerli bir isim girin (2 - 28 karakter).' });
    }

    let rawPositions = body.positions || (body.position ? [body.position] : []);
    if (!Array.isArray(rawPositions)) rawPositions = [String(rawPositions)];
    rawPositions = rawPositions.map(p => String(p).trim().toUpperCase());

    let positions = [];
    if (rawPositions.includes('GK')) positions = ['GK'];
    else positions = ['DEF', 'MID', 'FWD'].filter(p => rawPositions.includes(p));

    if (positions.length === 0) {
      return sendJSON(res, 400, { ok: false, message: 'Lütfen en az bir mevki seçin.' });
    }

    if (db.currentMatch.players.length >= db.currentMatch.maxPlayers) {
      return sendJSON(res, 400, { ok: false, message: '14 kişilik kadro tamamlandı!' });
    }

    const duplicate = db.currentMatch.players.some(
      p => p.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR')
    );
    if (duplicate) {
      return sendJSON(res, 400, { ok: false, message: `"${name}" ismiyle zaten kayıt var!` });
    }

    const newPlayer = {
      id: crypto.randomUUID(),
      name,
      positions,
      position: positions[0],
      subPosition: positions.includes('GK') ? 'Merkez' : subPosition,
      positionLabel: getPositionsLabel(positions),
      joinedAt: new Date().toISOString()
    };

    db.currentMatch.players.push(newPlayer);

    let teamsJustDrawn = false;
    if (db.currentMatch.players.length === db.currentMatch.maxPlayers) {
      db.currentMatch.teams = distributeTeamsBalanced(db.currentMatch.players);
      teamsJustDrawn = true;
    }

    await saveDB(db);

    return sendJSON(res, 200, {
      ok: true,
      player: newPlayer,
      teamsJustDrawn,
      match: sanitizeMatch(db.currentMatch)
    });
  }

  // POST /admin/login
  if (req.method === 'POST' && pathname === '/admin/login') {
    const body = await parseBody(req);
    const username = String(body.username || '').trim();
    const password = String(body.password || body.pin || '').trim();
    const expectedUser = (db.adminUsername || 'Orhan').toLowerCase();
    const expectedPass = String(db.adminPassword || '1905');

    if (username.toLowerCase() !== expectedUser || password !== expectedPass) {
      return sendJSON(res, 401, { ok: false, message: 'Kullanıcı adı veya şifre hatalı!' });
    }
    return sendJSON(res, 200, { ok: true, match: sanitizeMatch(db.currentMatch) });
  }

  // POST /admin/fill-demo
  if (req.method === 'POST' && pathname === '/admin/fill-demo') {
    const body = await parseBody(req);
    if (!isAuthorizedAdmin(body, db)) {
      return sendJSON(res, 401, { ok: false, message: 'Yetkisiz işlem.' });
    }

    const samplePool = [
      { name: 'Ahmet Yılmaz', positions: ['GK'], subPosition: 'Merkez' },
      { name: 'Mert Günok', positions: ['GK'], subPosition: 'Merkez' },
      { name: 'Abdülkerim B.', positions: ['DEF'], subPosition: 'Merkez' },
      { name: 'Burak Kaya', positions: ['DEF'], subPosition: 'Merkez' },
      { name: 'Emre Demir', positions: ['DEF', 'MID'], subPosition: 'Sol' },
      { name: 'Ferdi Kadıoğlu', positions: ['DEF', 'MID'], subPosition: 'Sol' },
      { name: 'Kaan Ayhan', positions: ['DEF', 'MID'], subPosition: 'Sağ' },
      { name: 'Hakan Çalhanoğlu', positions: ['MID'], subPosition: 'Merkez' },
      { name: 'Orkun Kökçü', positions: ['MID'], subPosition: 'Merkez' },
      { name: 'Arda Güler', positions: ['MID', 'FWD'], subPosition: 'Sağ' },
      { name: 'İrfan Can', positions: ['MID', 'FWD'], subPosition: 'Sol' },
      { name: 'Barış Alper', positions: ['DEF', 'MID', 'FWD'], subPosition: 'Sağ' },
      { name: 'Semih Kılıçsoy', positions: ['FWD'], subPosition: 'Merkez' },
      { name: 'Cenk Tosun', positions: ['FWD'], subPosition: 'Merkez' }
    ];

    const existing = new Set(db.currentMatch.players.map(p => p.name.toLocaleLowerCase('tr-TR')));
    for (const c of samplePool) {
      if (db.currentMatch.players.length >= db.currentMatch.maxPlayers) break;
      if (existing.has(c.name.toLocaleLowerCase('tr-TR'))) continue;
      db.currentMatch.players.push({
        id: crypto.randomUUID(),
        name: c.name,
        positions: c.positions,
        position: c.positions[0],
        subPosition: c.subPosition,
        positionLabel: getPositionsLabel(c.positions),
        joinedAt: new Date().toISOString()
      });
      existing.add(c.name.toLocaleLowerCase('tr-TR'));
    }

    if (db.currentMatch.players.length === db.currentMatch.maxPlayers) {
      db.currentMatch.teams = distributeTeamsBalanced(db.currentMatch.players);
    }

    await saveDB(db);
    return sendJSON(res, 200, { ok: true, match: sanitizeMatch(db.currentMatch) });
  }

  // POST /admin/reshuffle
  if (req.method === 'POST' && pathname === '/admin/reshuffle') {
    const body = await parseBody(req);
    if (!isAuthorizedAdmin(body, db)) {
      return sendJSON(res, 401, { ok: false, message: 'Yetkisiz işlem.' });
    }
    db.currentMatch.teams = distributeTeamsBalanced(db.currentMatch.players);
    await saveDB(db);
    return sendJSON(res, 200, { ok: true, match: sanitizeMatch(db.currentMatch) });
  }

  // POST /admin/clear-players
  if (req.method === 'POST' && pathname === '/admin/clear-players') {
    const body = await parseBody(req);
    if (!isAuthorizedAdmin(body, db)) {
      return sendJSON(res, 401, { ok: false, message: 'Yetkisiz işlem.' });
    }
    db.currentMatch.players = [];
    db.currentMatch.teams = null;
    await saveDB(db);
    return sendJSON(res, 200, { ok: true, match: sanitizeMatch(db.currentMatch) });
  }

  // POST /admin/new-week
  if (req.method === 'POST' && pathname === '/admin/new-week') {
    const body = await parseBody(req);
    if (!isAuthorizedAdmin(body, db)) {
      return sendJSON(res, 401, { ok: false, message: 'Yetkisiz işlem.' });
    }

    const customCode = (body.customCode || '').trim().toUpperCase().replace(/[^A-Z0-9-_]/g, '');
    const newCode = customCode.length >= 3 ? customCode : generateActivationCode();

    db.currentMatch = {
      id: crypto.randomUUID(),
      weekTitle: (body.weekTitle || 'Haftalık Halısaha Maçı').trim(),
      matchDate: body.matchDate || getDefaultMatchDate(),
      matchTime: (body.matchTime || '21:00 - 22:00').trim(),
      venue: (body.venue || 'Merkez Olimpik Halısaha').trim(),
      code: newCode,
      maxPlayers: 14,
      createdAt: new Date().toISOString(),
      players: [],
      teams: null
    };

    await saveDB(db);
    return sendJSON(res, 200, { ok: true, match: sanitizeMatch(db.currentMatch) });
  }

  // POST /admin/remove-player
  if (req.method === 'POST' && pathname === '/admin/remove-player') {
    const body = await parseBody(req);
    if (!isAuthorizedAdmin(body, db)) {
      return sendJSON(res, 401, { ok: false, message: 'Yetkisiz işlem.' });
    }
    db.currentMatch.players = db.currentMatch.players.filter(p => p.id !== body.playerId);
    if (db.currentMatch.players.length < db.currentMatch.maxPlayers) db.currentMatch.teams = null;
    await saveDB(db);
    return sendJSON(res, 200, { ok: true, match: sanitizeMatch(db.currentMatch) });
  }

  // Fallback for SSE stream or unsupported methods
  if (pathname === '/stream') {
    return sendJSON(res, 200, { type: 'connected', match: sanitizeMatch(db.currentMatch) });
  }

  return sendJSON(res, 404, { error: 'Endpoint bulunamadı' });
};

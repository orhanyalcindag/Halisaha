const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper: Generate random activation code (e.g., SAHA-4829)
function generateActivationCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `SAHA-${suffix}`;
}

// Helper: Get formatted next match date string
function getDefaultMatchDate() {
  const now = new Date();
  const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
  const nextDate = new Date(now.getTime() + daysUntilFriday * 24 * 60 * 60 * 1000);
  return nextDate.toISOString().split('T')[0];
}

// Initial database state
function createInitialState() {
  return {
    adminPin: '1234',
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

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Veritabanı okuma hatası, varsayılan oluşturuluyor:', err);
  }
  const initial = createInitialState();
  saveDB(initial);
  return initial;
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

let db = loadDB();

// SSE (Server-Sent Events) clients for real-time updates
const sseClients = new Set();

function broadcastUpdate(eventType = 'match_updated') {
  const payload = JSON.stringify({
    type: eventType,
    match: sanitizeMatchForPublic(db.currentMatch),
    timestamp: new Date().toISOString()
  });
  for (const client of sseClients) {
    try {
      client.res.write(`data: ${payload}\n\n`);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

function sanitizeMatchForPublic(match) {
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

// Fisher-Yates random shuffle
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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

const SUBPOSITION_SIDE_ORDER = { Sol: 0, Merkez: 1, Sağ: 2 };

/**
 * Assigns tactical 7v7 coordinates and jersey numbers for a 7-player team.
 * Takes multi-position preferences into account to slot players realistically.
 */
function buildTeamTacticalLayout(teamPlayers, teamKey) {
  if (!teamPlayers || teamPlayers.length === 0) return [];

  // Identify Goalkeeper (or player who selected GK, or deepest player)
  let gkIndex = teamPlayers.findIndex(p => (p.positions || [p.position]).includes('GK'));
  if (gkIndex === -1) {
    // If no one explicitly chose GK, pick the first player
    gkIndex = 0;
  }

  const gkPlayer = teamPlayers[gkIndex];
  const outfield = teamPlayers.filter((_, idx) => idx !== gkIndex); // 6 outfield players

  // Target formation sizes for 6 outfield players: ideally 2 DEF, 2-3 MID, 1-2 FWD
  // Determine each outfield player's assigned role on the pitch
  const assigned = [];
  let defCount = 0;
  let midCount = 0;
  let fwdCount = 0;

  // Step 1: Assign single-position specialists first
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

  // Step 2: Flexibly assign multi-position players where the team needs them most
  // Shuffle unassigned so assignment is unbiased
  const shuffledFlex = shuffleArray(unassigned);
  for (const player of shuffledFlex) {
    const poses = player.positions || [player.position || 'MID'];
    const candidates = poses.filter(p => p !== 'GK');
    if (candidates.length === 0) candidates.push('MID');

    // Score candidates based on ideal halısaha 7v7 line targets (DEF: 2, MID: 2-3, FWD: 1-2)
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

  // Separate assigned outfield players into 3 lines
  let defLine = assigned.filter(a => a.assignedPos === 'DEF').map(a => a.player);
  let midLine = assigned.filter(a => a.assignedPos === 'MID').map(a => a.player);
  let fwdLine = assigned.filter(a => a.assignedPos === 'FWD').map(a => a.player);

  // Safeguard: Ensure no line is completely empty if we have 6 players
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

  // Cap any line with > 3 players
  while (defLine.length > 3) midLine.unshift(defLine.pop());
  while (fwdLine.length > 3) midLine.push(fwdLine.shift());
  while (midLine.length > 3) {
    if (defLine.length <= fwdLine.length && defLine.length < 3) defLine.push(midLine.shift());
    else if (fwdLine.length < 3) fwdLine.unshift(midLine.pop());
    else break;
  }

  // Lateral coordinates helper
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

  // Add GK
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

  // Add Outfield Lines
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

      // Create rich tactical role label reflecting multi-position selections
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

/**
 * Distributes 14 players randomly into Team A (Red) and Team B (Green)
 * while balancing positions (GK, and single vs multi-position outfielders).
 */
function distributeTeamsBalanced(players) {
  const mainPlayers = players.slice(0, 14);

  // Categorize players by their flexibility profile
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

  // Combine shuffled groups into balanced distribution queue
  const orderedPool = [
    ...shuffleArray(gks),
    ...shuffleArray(pureDef),
    ...shuffleArray(pureMid),
    ...shuffleArray(pureFwd),
    ...shuffleArray(flexible)
  ];

  const rawTeamA = [];
  const rawTeamB = [];

  // Pairwise random assignment guarantees both teams get equal proportions of each category
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
    drawnAt: new Date().toISOString(),
    drawCount: (db.currentMatch?.teams?.drawCount || 0) + 1
  };
}

// Helper: Parse JSON request body
function parseBody(req) {
  return new Promise((resolve, reject) => {
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
        reject(new Error('Geçersiz JSON formatı'));
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

// Mime types for static files
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // 1. SSE Real-Time Stream Endpoint
  if (req.method === 'GET' && pathname === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(`data: ${JSON.stringify({ type: 'connected', match: sanitizeMatchForPublic(db.currentMatch) })}\n\n`);

    const client = { res };
    sseClients.add(client);

    req.on('close', () => {
      sseClients.delete(client);
    });
    return;
  }

  // 2. Public Match Info (minimal preview + code verification)
  if (req.method === 'GET' && pathname === '/api/match') {
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
        message: 'Girdiğiniz haftalık aktivasyon kodu geçersiz veya güncel değil! Lütfen WhatsApp grubundaki güncel davet linkini kullanın.'
      });
    }

    return sendJSON(res, 200, {
      valid: true,
      match: sanitizeMatchForPublic(db.currentMatch)
    });
  }

  // 3. Player Join Endpoint (supports multiple outfield positions!)
  if (req.method === 'POST' && pathname === '/api/match/join') {
    try {
      const body = await parseBody(req);
      const inputCode = (body.code || '').trim().toUpperCase();
      const activeCode = (db.currentMatch.code || '').trim().toUpperCase();

      if (inputCode !== activeCode) {
        return sendJSON(res, 403, {
          ok: false,
          message: 'Aktivasyon kodu geçersiz! Lütfen güncel hafta kodunu girin.'
        });
      }

      const name = (body.name || '').trim().replace(/\s+/g, ' ');
      const subPosition = (body.subPosition || 'Merkez').trim();

      if (!name || name.length < 2 || name.length > 28) {
        return sendJSON(res, 400, {
          ok: false,
          message: 'Lütfen geçerli bir isim/soyisim girin (2 - 28 karakter).'
        });
      }

      // Parse and normalize selected positions
      let rawPositions = body.positions;
      if (!rawPositions && body.position) {
        rawPositions = [body.position];
      }
      if (!Array.isArray(rawPositions)) {
        rawPositions = [String(rawPositions)];
      }
      rawPositions = rawPositions.map(p => String(p).trim().toUpperCase());

      let positions = [];
      if (rawPositions.includes('GK')) {
        // Kaleci is exclusive (cannot be combined with outfield)
        positions = ['GK'];
      } else {
        // Can select 1, 2, or all 3 outfield positions (DEF, MID, FWD)
        positions = ['DEF', 'MID', 'FWD'].filter(p => rawPositions.includes(p));
      }

      if (positions.length === 0) {
        return sendJSON(res, 400, {
          ok: false,
          message: 'Lütfen sahada oynamak istediğiniz en az bir mevki seçin (Kaleci veya Defans / Orta Saha / Forvet).'
        });
      }

      if (db.currentMatch.players.length >= db.currentMatch.maxPlayers) {
        return sendJSON(res, 400, {
          ok: false,
          message: '14 kişilik kadro tamamlandı ve takımlar dağıtıldı!'
        });
      }

      const duplicate = db.currentMatch.players.some(
        p => p.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR')
      );
      if (duplicate) {
        return sendJSON(res, 400, {
          ok: false,
          message: `"${name}" ismiyle kadroda zaten bir oyuncu kayıtlı! Aynı isimdeyseniz sonuna lakap veya soyisim baş harfi ekleyebilirsiniz.`
        });
      }

      const primaryPosition = positions[0];
      const positionLabel = getPositionsLabel(positions);

      const newPlayer = {
        id: crypto.randomUUID(),
        name,
        positions,
        position: primaryPosition,
        subPosition: positions.includes('GK') ? 'Merkez' : subPosition,
        positionLabel,
        joinedAt: new Date().toISOString()
      };

      db.currentMatch.players.push(newPlayer);

      // Check if 14 players reached -> Automatically distribute into Team A (Red) & Team B (Green)!
      let teamsJustDrawn = false;
      if (db.currentMatch.players.length === db.currentMatch.maxPlayers) {
        db.currentMatch.teams = distributeTeamsBalanced(db.currentMatch.players);
        teamsJustDrawn = true;
      }

      saveDB(db);
      broadcastUpdate(teamsJustDrawn ? 'teams_drawn' : 'player_joined');

      return sendJSON(res, 200, {
        ok: true,
        player: newPlayer,
        teamsJustDrawn,
        match: sanitizeMatchForPublic(db.currentMatch)
      });
    } catch (err) {
      return sendJSON(res, 500, { ok: false, message: err.message });
    }
  }

  // 4. Admin Login / Status Check
  if (req.method === 'POST' && pathname === '/api/admin/login') {
    try {
      const body = await parseBody(req);
      const pin = (body.pin || '').trim();
      if (pin !== db.adminPin) {
        return sendJSON(res, 401, { ok: false, message: 'Yönetici PIN kodu hatalı! (Varsayılan PIN: 1234)' });
      }
      return sendJSON(res, 200, {
        ok: true,
        match: sanitizeMatchForPublic(db.currentMatch),
        historyCount: db.history.length
      });
    } catch (err) {
      return sendJSON(res, 500, { ok: false, message: err.message });
    }
  }

  // 5. Admin: Create New Week & New Activation Code
  if (req.method === 'POST' && pathname === '/api/admin/new-week') {
    try {
      const body = await parseBody(req);
      if ((body.pin || '').trim() !== db.adminPin) {
        return sendJSON(res, 401, { ok: false, message: 'Yetkisiz işlem (PIN hatalı).' });
      }

      // Archive old match if it had players
      if (db.currentMatch && db.currentMatch.players.length > 0) {
        db.history.unshift({
          ...db.currentMatch,
          archivedAt: new Date().toISOString()
        });
        if (db.history.length > 20) db.history = db.history.slice(0, 20);
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

      saveDB(db);
      broadcastUpdate('new_week_started');

      return sendJSON(res, 200, {
        ok: true,
        message: `Yeni hafta oluşturuldu! Yeni Aktivasyon Kodu: ${newCode}`,
        match: sanitizeMatchForPublic(db.currentMatch)
      });
    } catch (err) {
      return sendJSON(res, 500, { ok: false, message: err.message });
    }
  }

  // 6. Admin: Update Match Details / Code without clearing players
  if (req.method === 'POST' && pathname === '/api/admin/update-info') {
    try {
      const body = await parseBody(req);
      if ((body.pin || '').trim() !== db.adminPin) {
        return sendJSON(res, 401, { ok: false, message: 'Yetkisiz işlem.' });
      }

      if (body.weekTitle) db.currentMatch.weekTitle = body.weekTitle.trim();
      if (body.matchDate) db.currentMatch.matchDate = body.matchDate.trim();
      if (body.matchTime) db.currentMatch.matchTime = body.matchTime.trim();
      if (body.venue) db.currentMatch.venue = body.venue.trim();
      if (body.code) {
        const cleanCode = body.code.trim().toUpperCase().replace(/[^A-Z0-9-_]/g, '');
        if (cleanCode.length >= 3) db.currentMatch.code = cleanCode;
      }

      saveDB(db);
      broadcastUpdate('match_info_updated');

      return sendJSON(res, 200, {
        ok: true,
        match: sanitizeMatchForPublic(db.currentMatch)
      });
    } catch (err) {
      return sendJSON(res, 500, { ok: false, message: err.message });
    }
  }

  // 7. Admin: Remove a Player
  if (req.method === 'POST' && pathname === '/api/admin/remove-player') {
    try {
      const body = await parseBody(req);
      if ((body.pin || '').trim() !== db.adminPin) {
        return sendJSON(res, 401, { ok: false, message: 'Yetkisiz işlem.' });
      }

      const playerId = body.playerId;
      db.currentMatch.players = db.currentMatch.players.filter(p => p.id !== playerId);

      // If player count drops below 14, reset drawn teams so new player can complete the 14
      if (db.currentMatch.players.length < db.currentMatch.maxPlayers) {
        db.currentMatch.teams = null;
      }

      saveDB(db);
      broadcastUpdate('player_removed');

      return sendJSON(res, 200, {
        ok: true,
        match: sanitizeMatchForPublic(db.currentMatch)
      });
    } catch (err) {
      return sendJSON(res, 500, { ok: false, message: err.message });
    }
  }

  // 8. Admin: Re-shuffle / Re-distribute Teams
  if (req.method === 'POST' && pathname === '/api/admin/reshuffle') {
    try {
      const body = await parseBody(req);
      if ((body.pin || '').trim() !== db.adminPin) {
        return sendJSON(res, 401, { ok: false, message: 'Yetkisiz işlem.' });
      }

      if (db.currentMatch.players.length < 2) {
        return sendJSON(res, 400, {
          ok: false,
          message: 'Kadro dağıtımı için en az 2 oyuncu gereklidir (Tam kadro: 14 kişi).'
        });
      }

      db.currentMatch.teams = distributeTeamsBalanced(db.currentMatch.players);
      saveDB(db);
      broadcastUpdate('teams_drawn');

      return sendJSON(res, 200, {
        ok: true,
        match: sanitizeMatchForPublic(db.currentMatch)
      });
    } catch (err) {
      return sendJSON(res, 500, { ok: false, message: err.message });
    }
  }

  // 9. Admin: Swap two players between Team A and Team B
  if (req.method === 'POST' && pathname === '/api/admin/swap-players') {
    try {
      const body = await parseBody(req);
      if ((body.pin || '').trim() !== db.adminPin) {
        return sendJSON(res, 401, { ok: false, message: 'Yetkisiz işlem.' });
      }
      if (!db.currentMatch.teams) {
        return sendJSON(res, 400, { ok: false, message: 'Henüz takımlar oluşturulmadı.' });
      }

      const { playerAId, playerBId } = body;
      const idxA = db.currentMatch.teams.teamA.findIndex(p => p.id === playerAId);
      const idxB = db.currentMatch.teams.teamB.findIndex(p => p.id === playerBId);

      if (idxA === -1 || idxB === -1) {
        return sendJSON(res, 400, { ok: false, message: 'Değiştirilecek oyuncular bulunamadı.' });
      }

      const rawA = db.currentMatch.teams.teamA.map(p => ({
        id: p.id,
        name: p.name,
        positions: p.positions || [p.position],
        position: p.position,
        subPosition: p.subPosition,
        positionLabel: p.positionLabel,
        joinedAt: p.joinedAt
      }));
      const rawB = db.currentMatch.teams.teamB.map(p => ({
        id: p.id,
        name: p.name,
        positions: p.positions || [p.position],
        position: p.position,
        subPosition: p.subPosition,
        positionLabel: p.positionLabel,
        joinedAt: p.joinedAt
      }));

      const temp = rawA[idxA];
      rawA[idxA] = rawB[idxB];
      rawB[idxB] = temp;

      db.currentMatch.teams.teamA = buildTeamTacticalLayout(rawA, 'A');
      db.currentMatch.teams.teamB = buildTeamTacticalLayout(rawB, 'B');
      db.currentMatch.teams.drawnAt = new Date().toISOString();

      saveDB(db);
      broadcastUpdate('teams_swapped');

      return sendJSON(res, 200, {
        ok: true,
        match: sanitizeMatchForPublic(db.currentMatch)
      });
    } catch (err) {
      return sendJSON(res, 500, { ok: false, message: err.message });
    }
  }

  // 10. Admin: Quick Demo Fill up to 14 Players (with realistic multi-position combinations)
  if (req.method === 'POST' && pathname === '/api/admin/fill-demo') {
    try {
      const body = await parseBody(req);
      if ((body.pin || '').trim() !== db.adminPin) {
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
        { name: 'Cenk Tosun', positions: ['FWD'], subPosition: 'Merkez' },
        { name: 'Kerem Aktürk', positions: ['MID', 'FWD'], subPosition: 'Sol' },
        { name: 'Yusuf Yazıcı', positions: ['MID', 'FWD'], subPosition: 'Merkez' }
      ];

      const existingNames = new Set(
        db.currentMatch.players.map(p => p.name.toLocaleLowerCase('tr-TR'))
      );

      for (const candidate of samplePool) {
        if (db.currentMatch.players.length >= db.currentMatch.maxPlayers) break;
        if (existingNames.has(candidate.name.toLocaleLowerCase('tr-TR'))) continue;

        db.currentMatch.players.push({
          id: crypto.randomUUID(),
          name: candidate.name,
          positions: candidate.positions,
          position: candidate.positions[0],
          subPosition: candidate.subPosition,
          positionLabel: getPositionsLabel(candidate.positions),
          joinedAt: new Date().toISOString()
        });
        existingNames.add(candidate.name.toLocaleLowerCase('tr-TR'));
      }

      if (db.currentMatch.players.length === db.currentMatch.maxPlayers) {
        db.currentMatch.teams = distributeTeamsBalanced(db.currentMatch.players);
      }

      saveDB(db);
      broadcastUpdate('teams_drawn');

      return sendJSON(res, 200, {
        ok: true,
        match: sanitizeMatchForPublic(db.currentMatch)
      });
    } catch (err) {
      return sendJSON(res, 500, { ok: false, message: err.message });
    }
  }

  // 11. Admin: Clear all players in current match
  if (req.method === 'POST' && pathname === '/api/admin/clear-players') {
    try {
      const body = await parseBody(req);
      if ((body.pin || '').trim() !== db.adminPin) {
        return sendJSON(res, 401, { ok: false, message: 'Yetkisiz işlem.' });
      }
      db.currentMatch.players = [];
      db.currentMatch.teams = null;
      saveDB(db);
      broadcastUpdate('players_cleared');

      return sendJSON(res, 200, {
        ok: true,
        match: sanitizeMatchForPublic(db.currentMatch)
      });
    } catch (err) {
      return sendJSON(res, 500, { ok: false, message: err.message });
    }
  }

  // Serve Static Files from /public
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, safePath);
  if (filePath.startsWith(PUBLIC_DIR) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    // Fallback to index.html for SPA routes
    const indexFile = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexFile)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexFile).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Sayfa bulunamadı.');
    }
  }
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`⚽ Halısaha Kadro & Saha Diziliş Sistemi Çalışıyor!`);
  console.log(`🌐 Adres: http://localhost:${PORT}`);
  console.log(`🔑 Bu Haftanın Aktivasyon Kodu: ${db.currentMatch.code}`);
  console.log(`🔗 WhatsApp Davet Linki: http://localhost:${PORT}/?kod=${db.currentMatch.code}`);
  console.log(`🛡️  Organizatör PIN Kodu: ${db.adminPin}`);
  console.log(`====================================================`);
});

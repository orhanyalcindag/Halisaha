(() => {
  // Application State
  let currentMatch = null;
  let validatedCode = '';
  let adminUsername = localStorage.getItem('halisaha_admin_user') || '';
  let adminPassword = localStorage.getItem('halisaha_admin_pass') || '';
  let isAdminAuthenticated = localStorage.getItem('halisaha_is_admin') === 'true' && Boolean(adminUsername && adminPassword);
  let selectedForSwap = null; // { id, name, team }
  let pitchViewMode = 'full'; // 'full' | 'split'

  function getAdminAuthPayload(extra = {}) {
    return { username: adminUsername, password: adminPassword, ...extra };
  }

  // DOM Elements
  const codeGateSection = document.getElementById('codeGateSection');
  const matchRoomSection = document.getElementById('matchRoomSection');
  const activeCodeBadge = document.getElementById('activeCodeBadge');
  const headerCodeText = document.getElementById('headerCodeText');

  // Gate Elements
  const gateMatchTitle = document.getElementById('gateMatchTitle');
  const gateMatchDate = document.getElementById('gateMatchDate');
  const gateMatchTime = document.getElementById('gateMatchTime');
  const gateMatchVenue = document.getElementById('gateMatchVenue');
  const gatePlayerCount = document.getElementById('gatePlayerCount');
  const codeGateForm = document.getElementById('codeGateForm');
  const activationCodeInput = document.getElementById('activationCodeInput');
  const codeGateError = document.getElementById('codeGateError');
  const gateOpenAdminBtn = document.getElementById('gateOpenAdminBtn');

  // Room Banner & Progress Elements
  const roomMatchTitle = document.getElementById('roomMatchTitle');
  const roomMatchDate = document.getElementById('roomMatchDate');
  const roomMatchTime = document.getElementById('roomMatchTime');
  const roomMatchVenue = document.getElementById('roomMatchVenue');
  const inviteCodeDisplay = document.getElementById('inviteCodeDisplay');
  const copyInviteLinkBtn = document.getElementById('copyInviteLinkBtn');
  const shareWhatsappInviteBtn = document.getElementById('shareWhatsappInviteBtn');

  const progressStatusTitle = document.getElementById('progressStatusTitle');
  const progressStatusSubtitle = document.getElementById('progressStatusSubtitle');
  const currentCountNum = document.getElementById('currentCountNum');
  const progressBarFill = document.getElementById('progressBarFill');
  const countGK = document.getElementById('countGK');
  const countDEF = document.getElementById('countDEF');
  const countMID = document.getElementById('countMID');
  const countFWD = document.getElementById('countFWD');

  // Join Form & Slots
  const playerJoinForm = document.getElementById('playerJoinForm');
  const playerNameInput = document.getElementById('playerNameInput');
  const subPositionGroup = document.getElementById('subPositionGroup');
  const joinFormError = document.getElementById('joinFormError');
  const registrationFullNotice = document.getElementById('registrationFullNotice');
  const listCountText = document.getElementById('listCountText');
  const playersSlotList = document.getElementById('playersSlotList');
  const demoFillQuickBtn = document.getElementById('demoFillQuickBtn');

  // Tactical Pitch & Squads
  const teamsTacticalSection = document.getElementById('teamsTacticalSection');
  const viewModeFullBtn = document.getElementById('viewModeFullBtn');
  const viewModeSplitBtn = document.getElementById('viewModeSplitBtn');
  const fullPitchContainer = document.getElementById('fullPitchContainer');
  const splitPitchContainer = document.getElementById('splitPitchContainer');
  const fullPitchPlayersLayer = document.getElementById('fullPitchPlayersLayer');
  const singlePitchTeamALayer = document.getElementById('singlePitchTeamALayer');
  const singlePitchTeamBLayer = document.getElementById('singlePitchTeamBLayer');
  const teamARosterList = document.getElementById('teamARosterList');
  const teamBRosterList = document.getElementById('teamBRosterList');
  const teamAKitPreview = document.getElementById('teamAKitPreview');
  const teamBKitPreview = document.getElementById('teamBKitPreview');
  const copySquadsWhatsappBtn = document.getElementById('copySquadsWhatsappBtn');
  const quickReshuffleBtn = document.getElementById('quickReshuffleBtn');
  const tacticalHelperBar = document.getElementById('tacticalHelperBar');
  const swapSelectionBanner = document.getElementById('swapSelectionBanner');
  const swapSelectionText = document.getElementById('swapSelectionText');
  const cancelSwapBtn = document.getElementById('cancelSwapBtn');

  // Admin Modal Elements
  const openAdminBtn = document.getElementById('openAdminBtn');
  const adminModal = document.getElementById('adminModal');
  const closeAdminModalBtn = document.getElementById('closeAdminModalBtn');
  const adminLogoutBtn = document.getElementById('adminLogoutBtn');
  const adminLoginView = document.getElementById('adminLoginView');
  const adminDashboardView = document.getElementById('adminDashboardView');
  const adminLoginForm = document.getElementById('adminLoginForm');
  const adminUsernameInput = document.getElementById('adminUsernameInput');
  const adminPasswordInput = document.getElementById('adminPasswordInput');
  const adminLoginError = document.getElementById('adminLoginError');
  const adminCurrentCode = document.getElementById('adminCurrentCode');
  const adminInviteUrlInput = document.getElementById('adminInviteUrlInput');
  const adminCopyLinkBtn = document.getElementById('adminCopyLinkBtn');
  const adminCopyMessageBtn = document.getElementById('adminCopyMessageBtn');
  const adminFillDemoBtn = document.getElementById('adminFillDemoBtn');
  const adminReshuffleBtn = document.getElementById('adminReshuffleBtn');
  const adminClearPlayersBtn = document.getElementById('adminClearPlayersBtn');
  const adminPlayersManageList = document.getElementById('adminPlayersManageList');
  const adminPlayersCountText = document.getElementById('adminPlayersCountText');
  const adminNewWeekForm = document.getElementById('adminNewWeekForm');
  const adminWeekTitle = document.getElementById('adminWeekTitle');
  const adminVenue = document.getElementById('adminVenue');
  const adminMatchDate = document.getElementById('adminMatchDate');
  const adminMatchTime = document.getElementById('adminMatchTime');
  const adminCustomCode = document.getElementById('adminCustomCode');
  const adminUpdateOnlyBtn = document.getElementById('adminUpdateOnlyBtn');

  // ==========================================
  // SVG JERSEY GENERATOR (KIRMIZI & YEŞİL FORMA)
  // ==========================================
  function createJerseySVG(team, number = '', isGK = false) {
    const isRed = team === 'A';
    const uid = `kit-${team}-${number}-${Math.random().toString(36).slice(2, 7)}`;

    // Team A: Red Kit (#e11d48 / #9f1239) | Team B: Green Kit (#16a34a / #14532d)
    const primaryStart = isRed ? '#fb7185' : '#4ade80';
    const primaryMid = isRed ? '#e11d48' : '#16a34a';
    const primaryEnd = isRed ? '#881337' : '#14532d';
    const trimColor = isGK ? '#fbbf24' : '#ffffff';
    const stripeColor = isRed ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.12)';

    return `
      <svg class="jersey-svg" viewBox="0 0 64 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${uid}" x1="12" y1="4" x2="52" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="${primaryStart}" />
            <stop offset="35%" stop-color="${primaryMid}" />
            <stop offset="100%" stop-color="${primaryEnd}" />
          </linearGradient>
        </defs>
        <!-- Main Jersey Silhouette -->
        <path
          d="M21 6 L12 10 L4 22 L12 28 L17 21 L17 53 C17 54.6 18.3 56 20 56 L44 56 C45.7 56 47 54.6 47 53 L47 21 L52 28 L60 22 L52 10 L43 6 C40 10.5 36.2 12 32 12 C27.8 12 24 10.5 21 6 Z"
          fill="url(#${uid})"
          stroke="${trimColor}"
          stroke-width="2"
          stroke-linejoin="round"
        />
        <!-- Subtle Vertical Sport Stripes -->
        <line x1="25" y1="12" x2="25" y2="55" stroke="${stripeColor}" stroke-width="2.5" />
        <line x1="32" y1="13" x2="32" y2="55" stroke="${stripeColor}" stroke-width="2.5" />
        <line x1="39" y1="12" x2="39" y2="55" stroke="${stripeColor}" stroke-width="2.5" />
        <!-- Sleeve Cuffs -->
        <path d="M6 20 L13.5 25.5" stroke="${trimColor}" stroke-width="2.5" stroke-linecap="round" />
        <path d="M58 20 L50.5 25.5" stroke="${trimColor}" stroke-width="2.5" stroke-linecap="round" />
        <!-- Collar Accent -->
        <path d="M21 6 C24.5 11.5 39.5 11.5 43 6" stroke="${trimColor}" stroke-width="2.6" stroke-linecap="round" fill="none" />
        <!-- Jersey Number -->
        <text
          x="32"
          y="39"
          text-anchor="middle"
          fill="#ffffff"
          font-family="Outfit, sans-serif"
          font-weight="900"
          font-size="18"
          style="paint-order: stroke; stroke: rgba(0,0,0,0.45); stroke-width: 3px;"
        >${number}</text>
      </svg>
    `;
  }

  // Render static kit previews in roster headers
  if (teamAKitPreview) teamAKitPreview.innerHTML = createJerseySVG('A', 'A');
  if (teamBKitPreview) teamBKitPreview.innerHTML = createJerseySVG('B', 'B');

  // ==========================================
  // TOAST HELPER
  // ==========================================
  function showToast(message, isError = false) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'toast-error' : ''}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.25s ease';
      setTimeout(() => toast.remove(), 260);
    }, 3600);
  }

  // Format date nicely in Turkish
  function formatDateTR(dateStr) {
    if (!dateStr) return '--';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      if (!y || !m || !d) return dateStr;
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        weekday: 'long'
      });
    } catch {
      return dateStr;
    }
  }

  function getInviteLink(code) {
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    return `${baseUrl}?kod=${encodeURIComponent(code)}`;
  }

  function getWhatsappInviteMessage(match) {
    const link = getInviteLink(match.code);
    const remaining = Math.max(0, match.maxPlayers - (match.players?.length || 0));
    return (
      `⚽ *${match.weekTitle}*\n` +
      `📅 *Tarih:* ${formatDateTR(match.matchDate)}\n` +
      `⏰ *Saat:* ${match.matchTime}\n` +
      `📍 *Saha:* ${match.venue}\n` +
      `👥 *Kadro Durumu:* ${match.players?.length || 0}/${match.maxPlayers} (${remaining} kişilik yer kaldı)\n\n` +
      `🔑 *Bu Haftanın Aktivasyon Kodu:* ${match.code}\n\n` +
      `👇 Aşağıdaki davet linkine tıklayarak isminizi yazdırın ve oynayacağınız mevkiyi seçin (14 kişi tamamlanınca Kırmızı ve Yeşil takımlar otomatik kurulup sahaya dizilecektir):\n` +
      `${link}`
    );
  }

  function getWhatsappSquadsMessage(match) {
    if (!match || !match.teams) return '';
    const listA = match.teams.teamA
      .map(p => `${p.jerseyNumber}. ${p.name} (${p.tacticalRoleLabel})`)
      .join('\n');
    const listB = match.teams.teamB
      .map(p => `${p.jerseyNumber}. ${p.name} (${p.tacticalRoleLabel})`)
      .join('\n');

    return (
      `🏟️ *${match.weekTitle} - KADROLAR BELLİ OLDU!*\n` +
      `📅 ${formatDateTR(match.matchDate)} | ⏰ ${match.matchTime}\n` +
      `📍 ${match.venue}\n\n` +
      `🔴 *A TAKIMI (KIRMIZI FORMA)*\n${listA}\n\n` +
      `🟢 *B TAKIMI (YEŞİL FORMA)*\n${listB}\n\n` +
      `🔗 Saha Dizilişini Gör: ${getInviteLink(match.code)}`
    );
  }

  async function copyToClipboard(text, successMsg) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMsg);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast(successMsg);
    }
  }

  // ==========================================
  // INITIALIZE & CHECK ACTIVATION CODE
  // ==========================================
  async function initApp() {
    const params = new URLSearchParams(window.location.search);
    const urlCode = (params.get('kod') || params.get('code') || '').trim().toUpperCase();
    const savedCode = (localStorage.getItem('halisaha_active_code') || '').trim().toUpperCase();

    // First fetch public match info
    try {
      const res = await fetch('/api/match');
      const info = await res.json();
      renderGatePreview(info);
    } catch (err) {
      console.error('Sunucu bağlantı hatası:', err);
    }

    // Try URL code first, then saved localStorage code
    if (urlCode) {
      activationCodeInput.value = urlCode;
      const unlocked = await verifyAndUnlockCode(urlCode, true);
      if (!unlocked && savedCode && savedCode !== urlCode) {
        await verifyAndUnlockCode(savedCode, false);
      }
    } else if (savedCode) {
      const unlocked = await verifyAndUnlockCode(savedCode, false);
      if (!unlocked) {
        localStorage.removeItem('halisaha_active_code');
      }
    }

    // Connect to live SSE updates
    connectSSE();
  }

  function renderGatePreview(info) {
    if (!info) return;
    gateMatchTitle.textContent = info.weekTitle || 'Haftalık Halısaha Maçı';
    gateMatchDate.textContent = formatDateTR(info.matchDate);
    gateMatchTime.textContent = info.matchTime || '--:--';
    gateMatchVenue.textContent = info.venue || '--';
    gatePlayerCount.textContent = `${info.playerCount || 0} / ${info.maxPlayers || 14}`;
  }

  async function verifyAndUnlockCode(code, showFeedback = true) {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) return false;

    try {
      const res = await fetch(`/api/match?code=${encodeURIComponent(cleanCode)}`);
      const data = await res.json();

      if (!res.ok || !data.valid) {
        if (showFeedback) {
          codeGateError.textContent = data.message || 'Geçersiz aktivasyon kodu!';
          codeGateError.classList.remove('hidden');
        }
        return false;
      }

      // Code verified!
      validatedCode = data.match.code;
      currentMatch = data.match;
      localStorage.setItem('halisaha_active_code', validatedCode);

      // Update URL parameter cleanly without reloading
      const newUrl = `${window.location.pathname}?kod=${encodeURIComponent(validatedCode)}`;
      window.history.replaceState({ path: newUrl }, '', newUrl);

      codeGateError.classList.add('hidden');
      unlockMatchRoomUI(data.match);

      if (showFeedback) {
        showToast(`✅ Haftalık aktivasyon kodu (${validatedCode}) doğrulandı!`);
      }
      return true;
    } catch (err) {
      if (showFeedback) {
        codeGateError.textContent = 'Sunucu ile bağlantı kurulamadı.';
        codeGateError.classList.remove('hidden');
      }
      return false;
    }
  }

  function unlockMatchRoomUI(match) {
    codeGateSection.classList.add('hidden');
    matchRoomSection.classList.remove('hidden');
    activeCodeBadge.classList.remove('hidden');
    headerCodeText.textContent = match.code;
    renderMatchRoom(match);
  }

  // ==========================================
  // RENDER FULL MATCH ROOM & VISUAL PITCH
  // ==========================================
  function renderMatchRoom(match) {
    if (!match) return;
    currentMatch = match;

    // Update Gate preview too in case needed
    renderGatePreview({
      weekTitle: match.weekTitle,
      matchDate: match.matchDate,
      matchTime: match.matchTime,
      venue: match.venue,
      playerCount: match.players.length,
      maxPlayers: match.maxPlayers
    });

    // Header & Invite Details
    roomMatchTitle.textContent = match.weekTitle;
    roomMatchDate.textContent = formatDateTR(match.matchDate);
    roomMatchTime.textContent = match.matchTime;
    roomMatchVenue.textContent = match.venue;
    inviteCodeDisplay.textContent = match.code;
    headerCodeText.textContent = match.code;

    // Progress Bar & Counts
    const count = match.players.length;
    const max = match.maxPlayers || 14;
    const pct = Math.min(100, Math.round((count / max) * 100));

    currentCountNum.textContent = count;
    progressBarFill.style.width = `${pct}%`;
    listCountText.textContent = `${count}/${max}`;

    const remaining = Math.max(0, max - count);
    if (count >= max) {
      progressStatusTitle.textContent = '🎉 14 Kişilik Kadro Tamamlandı! Takımlar Sahaya Dizildi!';
      progressStatusSubtitle.innerHTML =
        'Oyuncular mevkilerine göre dengeli olarak <strong>🔴 A Takımı (Kırmızı Forma)</strong> ve <strong>🟢 B Takımı (Yeşil Forma)</strong> şeklinde ikiye ayrıldı.';
      playerJoinForm.classList.add('hidden');
      registrationFullNotice.classList.remove('hidden');
      if (demoFillQuickBtn) demoFillQuickBtn.classList.add('hidden');
    } else {
      progressStatusTitle.textContent = `Kadro Toplanıyor (${remaining} Kişi Kaldı)`;
      progressStatusSubtitle.innerHTML =
        `14 kişi tamamlandığında sistem otomatik olarak rastgele <strong>A Takımı (Kırmızı)</strong> ve <strong>B Takımı (Yeşil)</strong> kadrolarını kurup sahaya yerleştirecek.`;
      playerJoinForm.classList.remove('hidden');
      registrationFullNotice.classList.add('hidden');
      if (demoFillQuickBtn) {
        if (isAdminAuthenticated) {
          demoFillQuickBtn.classList.remove('hidden');
        } else {
          demoFillQuickBtn.classList.add('hidden');
        }
      }
    }

    // Position counts (supporting multi-positions)
    const posCounts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    match.players.forEach(p => {
      const poses = p.positions && p.positions.length > 0 ? p.positions : [p.position || 'MID'];
      poses.forEach(pos => {
        if (posCounts[pos] !== undefined) posCounts[pos]++;
      });
    });
    countGK.textContent = posCounts.GK;
    countDEF.textContent = posCounts.DEF;
    countMID.textContent = posCounts.MID;
    countFWD.textContent = posCounts.FWD;

    // Render 14 Player Slots (Only admin sees ✕ delete button)
    renderPlayerSlots(match.players, max);

    // Render Tactical Pitch & Squad Cards if teams are drawn
    if (match.teams && match.teams.teamA && match.teams.teamB) {
      teamsTacticalSection.classList.remove('hidden');
      renderTacticalPitchAndRosters(match.teams);
      if (tacticalHelperBar) {
        if (isAdminAuthenticated) {
          tacticalHelperBar.classList.remove('hidden');
        } else {
          tacticalHelperBar.classList.add('hidden');
        }
      }
    } else {
      teamsTacticalSection.classList.add('hidden');
      if (tacticalHelperBar) tacticalHelperBar.classList.add('hidden');
      selectedForSwap = null;
      swapSelectionBanner.classList.add('hidden');
    }

    // Keep Admin Modal in sync if open
    syncAdminModalFields(match);
  }

  function renderPlayerSlots(players, maxSlots = 14) {
    playersSlotList.innerHTML = '';

    for (let i = 0; i < maxSlots; i++) {
      const player = players[i];
      const slotEl = document.createElement('div');

      if (player) {
        slotEl.className = 'player-slot-item slot-filled';
        const poses = player.positions && player.positions.length > 0 ? player.positions : [player.position || 'MID'];
        const subText = poses.includes('GK') ? 'Kale Koruyucu' : `${player.positionLabel} • ${player.subPosition || 'Merkez'}`;
        const tagsHtml = poses.map(p => `<span class="pos-tag pos-tag-${p}">${p}</span>`).join('');
        const removeBtnHtml = isAdminAuthenticated
          ? `<button type="button" class="slot-remove-btn" data-remove-id="${player.id}" title="Oyuncuyu Listeden Çıkar (Organizatör)">✕</button>`
          : '';

        slotEl.innerHTML = `
          <div class="slot-left">
            <div class="slot-num">${i + 1}</div>
            <div class="slot-player-info">
              <div class="slot-player-name" title="${escapeHtml(player.name)}">${escapeHtml(player.name)}</div>
              <div class="slot-player-pos" title="${escapeHtml(subText)}">${escapeHtml(subText)}</div>
            </div>
          </div>
          <div class="slot-right">
            <div class="pos-tags-wrap">${tagsHtml}</div>
            ${removeBtnHtml}
          </div>
        `;
      } else {
        slotEl.className = 'player-slot-item slot-empty';
        slotEl.innerHTML = `
          <div class="slot-left">
            <div class="slot-num">${i + 1}</div>
            <div class="slot-player-info">
              <div class="slot-player-name">Boş Kontenjan</div>
              <div class="slot-player-pos">Katılım bekleniyor...</div>
            </div>
          </div>
          <div class="slot-right">
            <span class="pos-tag" style="background:rgba(255,255,255,0.05);color:#64748b;">BEKLİYOR</span>
          </div>
        `;
      }

      playersSlotList.appendChild(slotEl);
    }

    // Attach remove player handlers ONLY if authenticated as admin
    if (isAdminAuthenticated) {
      playersSlotList.querySelectorAll('[data-remove-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const playerId = btn.getAttribute('data-remove-id');
          await handleRemovePlayer(playerId);
        });
      });
    }
  }

  // ==========================================
  // RENDER TACTICAL PITCH (FULL & SPLIT) + ROSTERS
  // ==========================================
  function renderTacticalPitchAndRosters(teams) {
    const isMobileVertical = window.innerWidth <= 768;

    // 1. Full Pitch (A Takımı Red on Left/Top vs B Takımı Green on Right/Bottom)
    fullPitchPlayersLayer.innerHTML = '';
    const allPlayers = [...teams.teamA, ...teams.teamB];

    allPlayers.forEach((player, idx) => {
      const token = document.createElement('div');
      const isSelected = selectedForSwap && selectedForSwap.id === player.id;
      token.className = `pitch-player-token token-team-${player.team} ${isSelected ? 'selected-for-swap' : ''}`;
      token.style.animationDelay = `${idx * 35}ms`;

      // On desktop (>768px): horizontal pitch (left = pitchX%, top = pitchY%)
      // On mobile (<=768px): vertical pitch (left = pitchY%, top = pitchX%)
      const leftPct = isMobileVertical ? player.pitchY : player.pitchX;
      const topPct = isMobileVertical ? player.pitchX : player.pitchY;

      token.style.left = `${leftPct}%`;
      token.style.top = `${topPct}%`;

      const isGK = player.tacticalLine === 'GK';
      token.innerHTML = `
        <div class="jersey-svg-wrap">
          ${createJerseySVG(player.team, player.jerseyNumber, isGK)}
          ${isGK ? '<span class="jersey-gk-glove" title="Kaleci">🧤</span>' : ''}
        </div>
        <div class="player-token-name" title="${escapeHtml(player.name)}">${escapeHtml(player.name)}</div>
        <div class="player-token-pos">${escapeHtml(player.tacticalRoleLabel)}</div>
      `;

      token.addEventListener('click', () => handlePlayerTokenClick(player));
      fullPitchPlayersLayer.appendChild(token);
    });

    // 2. Split Tactical Boards (Single Half Pitches Side-by-Side)
    renderSingleTeamBoard(singlePitchTeamALayer, teams.teamA);
    renderSingleTeamBoard(singlePitchTeamBLayer, teams.teamB);

    // 3. Roster Cards (A Takımı Red & B Takımı Green)
    renderSquadRosterList(teamARosterList, teams.teamA, 'A');
    renderSquadRosterList(teamBRosterList, teams.teamB, 'B');
  }

  function renderSingleTeamBoard(containerEl, teamPlayers) {
    containerEl.innerHTML = '';
    teamPlayers.forEach((player, idx) => {
      const token = document.createElement('div');
      const isSelected = selectedForSwap && selectedForSwap.id === player.id;
      token.className = `pitch-player-token token-team-${player.team} ${isSelected ? 'selected-for-swap' : ''}`;
      token.style.animationDelay = `${idx * 45}ms`;
      token.style.left = `${player.tacticalX}%`;
      token.style.top = `${player.tacticalY}%`;

      const isGK = player.tacticalLine === 'GK';
      token.innerHTML = `
        <div class="jersey-svg-wrap">
          ${createJerseySVG(player.team, player.jerseyNumber, isGK)}
          ${isGK ? '<span class="jersey-gk-glove" title="Kaleci">🧤</span>' : ''}
        </div>
        <div class="player-token-name">${escapeHtml(player.name)}</div>
        <div class="player-token-pos">${escapeHtml(player.tacticalRoleLabel)}</div>
      `;

      token.addEventListener('click', () => handlePlayerTokenClick(player));
      containerEl.appendChild(token);
    });
  }

  function renderSquadRosterList(listEl, teamPlayers, teamKey) {
    listEl.innerHTML = '';
    const isRed = teamKey === 'A';

    teamPlayers.forEach(player => {
      const li = document.createElement('li');
      li.className = 'squad-roster-item';
      const poses = player.positions && player.positions.length > 0 ? player.positions : [player.position || 'MID'];
      const tagsHtml = poses.map(p => `<span class="pos-tag pos-tag-${p}">${p}</span>`).join('');

      li.innerHTML = `
        <div class="roster-item-left">
          <div class="roster-jersey-num ${isRed ? 'num-red' : 'num-green'}">${player.jerseyNumber}</div>
          <div>
            <div class="roster-player-name">${escapeHtml(player.name)}</div>
            <div class="roster-player-role">${escapeHtml(player.tacticalRoleLabel)}</div>
          </div>
        </div>
        <div class="pos-tags-wrap">${tagsHtml}</div>
      `;
      listEl.appendChild(li);
    });
  }

  // ==========================================
  // INTERACTIVE SWAP BETWEEN TEAM A & TEAM B
  // ==========================================
  async function handlePlayerTokenClick(player) {
    if (!isAdminAuthenticated) return;

    if (!selectedForSwap) {
      selectedForSwap = player;
      swapSelectionBanner.classList.remove('hidden');
      swapSelectionText.textContent = `"${player.name}" seçildi — Takas için ${player.team === 'A' ? 'B Takımından (Yeşil)' : 'A Takımından (Kırmızı)'} bir oyuncu seçin.`;
      if (currentMatch?.teams) renderTacticalPitchAndRosters(currentMatch.teams);
      return;
    }

    if (selectedForSwap.id === player.id) {
      selectedForSwap = null;
      swapSelectionBanner.classList.add('hidden');
      if (currentMatch?.teams) renderTacticalPitchAndRosters(currentMatch.teams);
      return;
    }

    if (selectedForSwap.team === player.team) {
      selectedForSwap = player;
      swapSelectionText.textContent = `"${player.name}" seçildi — Takas için karşı takımdan bir oyuncu seçin.`;
      if (currentMatch?.teams) renderTacticalPitchAndRosters(currentMatch.teams);
      return;
    }

    // Swap between Team A and Team B
    const playerAId = selectedForSwap.team === 'A' ? selectedForSwap.id : player.id;
    const playerBId = selectedForSwap.team === 'B' ? selectedForSwap.id : player.id;

    selectedForSwap = null;
    swapSelectionBanner.classList.add('hidden');

    try {
      const res = await fetch('/api/admin/swap-players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getAdminAuthPayload({ playerAId, playerBId }))
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        renderMatchRoom(data.match);
        showToast('🔄 Oyuncular takımlar arasında yer değiştirdi!');
      } else {
        showToast(data.message || 'Takas yapılamadı.', true);
      }
    } catch {
      showToast('Sunucu hatası oluştu.', true);
    }
  }

  cancelSwapBtn.addEventListener('click', () => {
    selectedForSwap = null;
    swapSelectionBanner.classList.add('hidden');
    if (currentMatch?.teams) renderTacticalPitchAndRosters(currentMatch.teams);
  });

  // ==========================================
  // EVENT LISTENERS: FORMS & ACTIONS
  // ==========================================

  // 1. Activation Code Form Submit
  codeGateForm.addEventListener('submit', async e => {
    e.preventDefault();
    const code = activationCodeInput.value.trim();
    await verifyAndUnlockCode(code, true);
  });

  // Multi-position selection rules:
  // - If GK is checked, uncheck all outfield positions (DEF, MID, FWD) and hide subPosition
  // - If any outfield position is checked, uncheck GK and show subPosition
  const posCheckboxes = document.querySelectorAll('input[name="position"]');
  posCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.value === 'GK' && cb.checked) {
        posCheckboxes.forEach(other => {
          if (other.value !== 'GK') other.checked = false;
        });
        subPositionGroup.classList.add('hidden');
      } else if (cb.checked && cb.value !== 'GK') {
        const gk = document.querySelector('input[name="position"][value="GK"]');
        if (gk) gk.checked = false;
        subPositionGroup.classList.remove('hidden');
      }

      const anyOutfield = Array.from(posCheckboxes).some(c => c.checked && c.value !== 'GK');
      if (anyOutfield) {
        subPositionGroup.classList.remove('hidden');
      } else {
        subPositionGroup.classList.add('hidden');
      }
    });
  });

  // 2. Player Join Form Submit
  playerJoinForm.addEventListener('submit', async e => {
    e.preventDefault();
    joinFormError.classList.add('hidden');

    const name = playerNameInput.value.trim();
    const checkedCheckboxes = Array.from(document.querySelectorAll('input[name="position"]:checked'));
    const selectedPositions = checkedCheckboxes.map(cb => cb.value);

    if (selectedPositions.length === 0) {
      joinFormError.textContent = 'Lütfen sahada oynayabileceğiniz en az bir mevki seçin (Kaleci hariç birden fazla seçebilirsiniz).';
      joinFormError.classList.remove('hidden');
      return;
    }

    const subPosRadio = document.querySelector('input[name="subPosition"]:checked');
    const subPosition = selectedPositions.includes('GK') ? 'Merkez' : (subPosRadio ? subPosRadio.value : 'Merkez');

    try {
      const res = await fetch('/api/match/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: validatedCode,
          name,
          positions: selectedPositions,
          subPosition
        })
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        joinFormError.textContent = data.message || 'Kayıt sırasında hata oluştu.';
        joinFormError.classList.remove('hidden');
        return;
      }

      playerNameInput.value = '';
      renderMatchRoom(data.match);

      if (data.teamsJustDrawn) {
        showToast('🎉 14 Kişi Tamamlandı! A Takımı (Kırmızı) ve B Takımı (Yeşil) sahaya yerleştirildi!');
        setTimeout(() => {
          teamsTacticalSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 250);
      } else {
        showToast(`⚽ ${data.player.name} (${data.player.positionLabel}) kadroya eklendi!`);
      }
    } catch (err) {
      joinFormError.textContent = 'Sunucu ile bağlantı kurulamadı.';
      joinFormError.classList.remove('hidden');
    }
  });

  // 3. View Mode Toggle (Full Pitch vs Split Half Pitches)
  viewModeFullBtn.addEventListener('click', () => {
    pitchViewMode = 'full';
    viewModeFullBtn.classList.add('active');
    viewModeSplitBtn.classList.remove('active');
    fullPitchContainer.classList.remove('hidden');
    splitPitchContainer.classList.add('hidden');
  });

  viewModeSplitBtn.addEventListener('click', () => {
    pitchViewMode = 'split';
    viewModeSplitBtn.classList.add('active');
    viewModeFullBtn.classList.remove('active');
    splitPitchContainer.classList.remove('hidden');
    fullPitchContainer.classList.add('hidden');
  });

  // Re-calculate mobile vs desktop coordinates on resize
  window.addEventListener('resize', () => {
    if (currentMatch?.teams) {
      renderTacticalPitchAndRosters(currentMatch.teams);
    }
  });

  // 4. WhatsApp Share & Copy Buttons
  copyInviteLinkBtn.addEventListener('click', () => {
    if (!currentMatch) return;
    const link = getInviteLink(currentMatch.code);
    copyToClipboard(link, '🔗 Kodlu davet linki panoya kopyalandı!');
  });

  shareWhatsappInviteBtn.addEventListener('click', () => {
    if (!currentMatch) return;
    const msg = getWhatsappInviteMessage(currentMatch);
    copyToClipboard(msg, '💬 WhatsApp davet mesajı kopyalandı! WhatsApp açılıyor...');
    const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank', 'noopener');
  });

  copySquadsWhatsappBtn.addEventListener('click', () => {
    if (!currentMatch?.teams) return;
    const msg = getWhatsappSquadsMessage(currentMatch);
    copyToClipboard(msg, '📲 A Takımı (Kırmızı) ve B Takımı (Yeşil) kadroları WhatsApp için kopyalandı!');
  });

  // 5. Quick Demo Fill & Reshuffle
  demoFillQuickBtn.addEventListener('click', async () => {
    await triggerFillDemo();
  });

  quickReshuffleBtn.addEventListener('click', async () => {
    await triggerReshuffle();
  });

  async function triggerFillDemo() {
    try {
      const res = await fetch('/api/admin/fill-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getAdminAuthPayload())
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        validatedCode = data.match.code;
        unlockMatchRoomUI(data.match);
        showToast('⚡ 14 kişilik kadro tamamlandı ve Kırmızı / Yeşil takımlar sahaya dizildi!');
        setTimeout(() => {
          teamsTacticalSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);
      } else {
        showToast(data.message || 'İşlem başarısız.', true);
      }
    } catch {
      showToast('Sunucu hatası.', true);
    }
  }

  async function triggerReshuffle() {
    try {
      const res = await fetch('/api/admin/reshuffle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getAdminAuthPayload())
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        renderMatchRoom(data.match);
        showToast('🎲 Kadrolar mevkilere göre dengeli şekilde yeniden dağıtıldı!');
      } else {
        showToast(data.message || 'Yeniden dağıtım yapılamadı.', true);
      }
    } catch {
      showToast('Sunucu hatası.', true);
    }
  }

  async function handleRemovePlayer(playerId) {
    if (!isAdminAuthenticated) {
      showToast('⚠️ Oyuncu silme yetkisi sadece organizatördedir!', true);
      return;
    }

    try {
      const res = await fetch('/api/admin/remove-player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getAdminAuthPayload({ playerId }))
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        renderMatchRoom(data.match);
        showToast('🗑️ Oyuncu listeden çıkarıldı.');
      } else {
        showToast(data.message || 'Oyuncu silinemedi.', true);
      }
    } catch {
      showToast('Oyuncu silinemedi.', true);
    }
  }

  // ==========================================
  // ORGANIZER / ADMIN PANEL LOGIC
  // ==========================================
  function openAdminModal() {
    adminModal.classList.remove('hidden');
    if (isAdminAuthenticated) {
      adminLoginView.classList.add('hidden');
      adminDashboardView.classList.remove('hidden');
      if (adminLogoutBtn) adminLogoutBtn.classList.remove('hidden');
      if (currentMatch) syncAdminModalFields(currentMatch);
    } else {
      adminDashboardView.classList.add('hidden');
      adminLoginView.classList.remove('hidden');
      if (adminLogoutBtn) adminLogoutBtn.classList.add('hidden');
    }
  }

  function closeAdminModal() {
    adminModal.classList.add('hidden');
  }

  openAdminBtn.addEventListener('click', openAdminModal);
  gateOpenAdminBtn.addEventListener('click', openAdminModal);
  closeAdminModalBtn.addEventListener('click', closeAdminModal);
  adminModal.addEventListener('click', e => {
    if (e.target === adminModal) closeAdminModal();
  });

  adminLoginForm.addEventListener('submit', async e => {
    e.preventDefault();
    adminLoginError.classList.add('hidden');
    const username = adminUsernameInput.value.trim();
    const password = adminPasswordInput.value.trim();

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        adminLoginError.textContent = data.message || 'Kullanıcı adı veya şifre hatalı!';
        adminLoginError.classList.remove('hidden');
        return;
      }

      adminUsername = username;
      adminPassword = password;
      isAdminAuthenticated = true;
      localStorage.setItem('halisaha_admin_user', username);
      localStorage.setItem('halisaha_admin_pass', password);
      localStorage.setItem('halisaha_is_admin', 'true');

      // Automatically unlock the match room for the organizer too!
      validatedCode = data.match.code;
      localStorage.setItem('halisaha_active_code', validatedCode);
      const newUrl = `${window.location.pathname}?kod=${encodeURIComponent(validatedCode)}`;
      window.history.replaceState({ path: newUrl }, '', newUrl);
      unlockMatchRoomUI(data.match);

      adminLoginView.classList.add('hidden');
      adminDashboardView.classList.remove('hidden');
      if (adminLogoutBtn) adminLogoutBtn.classList.remove('hidden');
      syncAdminModalFields(data.match);
      renderMatchRoom(data.match);
      showToast('🛡️ Organizatör paneline giriş yapıldı.');
    } catch {
      adminLoginError.textContent = 'Sunucu bağlantı hatası.';
      adminLoginError.classList.remove('hidden');
    }
  });

  if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener('click', () => {
      isAdminAuthenticated = false;
      adminUsername = '';
      adminPassword = '';
      localStorage.removeItem('halisaha_admin_user');
      localStorage.removeItem('halisaha_admin_pass');
      localStorage.removeItem('halisaha_is_admin');
      adminLogoutBtn.classList.add('hidden');
      adminDashboardView.classList.add('hidden');
      adminLoginView.classList.remove('hidden');
      if (currentMatch) renderMatchRoom(currentMatch);
      showToast('🛡️ Organizatör oturumu kapatıldı.');
    });
  }

  function syncAdminModalFields(match) {
    if (!match) return;
    adminCurrentCode.textContent = match.code;
    adminInviteUrlInput.value = getInviteLink(match.code);
    adminWeekTitle.value = match.weekTitle || '';
    adminVenue.value = match.venue || '';
    adminMatchDate.value = match.matchDate || '';
    adminMatchTime.value = match.matchTime || '';

    // Render registered players management list inside admin panel
    if (adminPlayersCountText) {
      adminPlayersCountText.textContent = `${match.players?.length || 0}/${match.maxPlayers || 14}`;
    }

    if (adminPlayersManageList) {
      adminPlayersManageList.innerHTML = '';
      const players = match.players || [];
      if (players.length === 0) {
        adminPlayersManageList.innerHTML = '<div class="admin-empty-players-notice">Henüz kadroya yazılan oyuncu bulunmuyor.</div>';
      } else {
        players.forEach((p, idx) => {
          const item = document.createElement('div');
          item.className = 'admin-player-item';
          const poses = p.positions && p.positions.length > 0 ? p.positions : [p.position || 'MID'];
          const tagsHtml = poses.map(tag => `<span class="pos-tag pos-tag-${tag}">${tag}</span>`).join('');

          item.innerHTML = `
            <div class="admin-player-item-left">
              <span class="admin-player-item-num">${idx + 1}</span>
              <div class="admin-player-item-info">
                <div class="admin-player-item-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>
                <div class="admin-player-item-pos">${escapeHtml(p.positionLabel)} • ${escapeHtml(p.subPosition || 'Merkez')}</div>
              </div>
            </div>
            <div class="admin-player-item-right">
              <div class="pos-tags-wrap">${tagsHtml}</div>
              <button type="button" class="admin-player-remove-btn" data-admin-del="${p.id}" title="Oyuncuyu Çıkar">
                🗑️ Çıkar
              </button>
            </div>
          `;

          const delBtn = item.querySelector('[data-admin-del]');
          if (delBtn) {
            delBtn.addEventListener('click', async () => {
              await handleRemovePlayer(p.id);
            });
          }

          adminPlayersManageList.appendChild(item);
        });
      }
    }
  }

  adminCopyLinkBtn.addEventListener('click', () => {
    if (!currentMatch) return;
    copyToClipboard(getInviteLink(currentMatch.code), '🔗 Haftalık davet linki kopyalandı!');
  });

  adminCopyMessageBtn.addEventListener('click', () => {
    if (!currentMatch) return;
    copyToClipboard(
      getWhatsappInviteMessage(currentMatch),
      '💬 WhatsApp grup davet mesajı kopyalandı!'
    );
  });

  adminFillDemoBtn.addEventListener('click', async () => {
    await triggerFillDemo();
    closeAdminModal();
  });

  adminReshuffleBtn.addEventListener('click', async () => {
    await triggerReshuffle();
    closeAdminModal();
  });

  adminClearPlayersBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/admin/clear-players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getAdminAuthPayload())
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        renderMatchRoom(data.match);
        showToast('🗑️ Mevcut oyuncu listesi temizlendi.');
      }
    } catch {
      showToast('Hata oluştu.', true);
    }
  });

  // Start New Week & Generate New Activation Code
  adminNewWeekForm.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/new-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getAdminAuthPayload({
          weekTitle: adminWeekTitle.value,
          venue: adminVenue.value,
          matchDate: adminMatchDate.value,
          matchTime: adminMatchTime.value,
          customCode: adminCustomCode.value
        }))
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        adminCustomCode.value = '';
        validatedCode = data.match.code;
        localStorage.setItem('halisaha_active_code', validatedCode);
        const newUrl = `${window.location.pathname}?kod=${encodeURIComponent(validatedCode)}`;
        window.history.replaceState({ path: newUrl }, '', newUrl);
        unlockMatchRoomUI(data.match);
        showToast(`🚀 Yeni hafta başlatıldı! Yeni Aktivasyon Kodu: ${data.match.code}`);
      } else {
        showToast(data.message || 'Yeni hafta oluşturulamadı.', true);
      }
    } catch {
      showToast('Sunucu hatası.', true);
    }
  });

  // Update match details without resetting players
  adminUpdateOnlyBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/admin/update-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getAdminAuthPayload({
          weekTitle: adminWeekTitle.value,
          venue: adminVenue.value,
          matchDate: adminMatchDate.value,
          matchTime: adminMatchTime.value,
          code: adminCustomCode.value || undefined
        }))
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        adminCustomCode.value = '';
        validatedCode = data.match.code;
        localStorage.setItem('halisaha_active_code', validatedCode);
        const newUrl = `${window.location.pathname}?kod=${encodeURIComponent(validatedCode)}`;
        window.history.replaceState({ path: newUrl }, '', newUrl);
        renderMatchRoom(data.match);
        showToast('✅ Maç bilgileri güncellendi.');
      }
    } catch {
      showToast('Güncelleme başarısız.', true);
    }
  });

  // ==========================================
  // LIVE SERVER-SENT EVENTS (SSE)
  // ==========================================
  function connectSSE() {
    const liveStatusText = document.getElementById('liveStatusText');
    const liveBadge = document.getElementById('liveConnectionBadge');

    const evtSource = new EventSource('/api/stream');

    evtSource.onopen = () => {
      if (liveStatusText) liveStatusText.textContent = 'Canlı Senkron';
      if (liveBadge) liveBadge.style.opacity = '1';
    };

    evtSource.onmessage = event => {
      try {
        const payload = JSON.parse(event.data);
        if (!payload.match) return;

        // Update gate preview if user is still on gate screen
        renderGatePreview({
          weekTitle: payload.match.weekTitle,
          matchDate: payload.match.matchDate,
          matchTime: payload.match.matchTime,
          venue: payload.match.venue,
          playerCount: payload.match.players.length,
          maxPlayers: payload.match.maxPlayers
        });

        // If user has unlocked the active match (or admin is logged in)
        if (validatedCode && payload.match.code === validatedCode) {
          renderMatchRoom(payload.match);
        } else if (payload.type === 'new_week_started' && !isAdminAuthenticated) {
          // If organizer started a new week with a new code, require the new code from regular clients
          validatedCode = '';
          localStorage.removeItem('halisaha_active_code');
          matchRoomSection.classList.add('hidden');
          codeGateSection.classList.remove('hidden');
          activeCodeBadge.classList.add('hidden');
          showToast('🔄 Organizatör yeni hafta başlattı! Lütfen yeni aktivasyon kodunu girin.');
        }
      } catch (e) {
        console.error('SSE veri hatası:', e);
      }
    };

    evtSource.onerror = () => {
      if (liveStatusText) liveStatusText.textContent = 'Yeniden Bağlanıyor...';
    };
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Start App
  initApp();
})();

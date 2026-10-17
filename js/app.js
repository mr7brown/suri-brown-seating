const nameInput = document.getElementById("name-input");
const searchForm = document.getElementById("search-form");
const searchStatus = document.getElementById("search-status");
const matchPicker = document.getElementById("match-picker");
const resultCard = document.getElementById("result-card");
const resultTitle = document.getElementById("result-title");
const resultMeta = document.getElementById("result-meta");
const resultMetaSub = document.getElementById("result-meta-sub");
const resultDirections = document.getElementById("result-directions");
const emptyHint = document.getElementById("empty-hint");
const guestList = document.getElementById("guest-list");
const guestsHeading = document.getElementById("guests-heading");
const guestsLede = document.getElementById("guests-lede");
const tableList = document.getElementById("table-list");
const tablesListView = document.getElementById("tables-list-view");
const tablesDetailView = document.getElementById("tables-detail-view");
const tablesHeading = document.getElementById("tables-heading");
const tablesLede = document.getElementById("tables-lede");
const tableGuests = document.getElementById("table-guests");
const tablesBack = document.getElementById("tables-back");
const mapMobile = document.getElementById("map-mobile");
const mapDesktop = document.getElementById("map-desktop");
const mapCaption = document.getElementById("map-caption");

/** @type {{ event: object, tables: Record<string, {name: string, guests: string[]}>, positions: Record<string, {x: number, y: number}> }} */
let data = null;
let activeTableId = null;
/** Roster open inside the Tables tab. Null shows every table. */
let tableDetailId = null;
/** @type {string | null} */
let matchedGuestName = null;
let activeTab = "find";

/** Dance floor center in the same % space as guests.json positions */
const DANCE = { x: 50, y: 36.5 };
/** Lounge door midpoint (entry) for path drawing */
const LOUNGE_ENTRY = { x: 50, y: 74 };

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function foundStatusHtml({ guest, tableName, isTable }) {
  const table = `<strong>${escapeHtml(tableName)}</strong>`;
  if (isTable) return `Found table ${table}.`;
  return `Found <strong>${escapeHtml(guest)}</strong> at ${table}.`;
}

function visibleTableIds() {
  return Object.keys(data.tables)
    .filter((id) => id !== "16" && data.positions[id])
    .sort((a, b) => Number(a) - Number(b));
}

/**
 * Short directions: lounge = FRONT (map bottom), Mr & Mrs. Brown = BACK (map top).
 * Left/right from a guest entering the lounge looking toward the back.
 */
function directionForTable(tableId) {
  const pos = data.positions[tableId];
  if (!pos) return "Enter through the lounge.";

  const side = pos.x < 50 ? "left" : "right";
  const depth = pos.y < 45 ? "back" : "front";
  return `Enter through the lounge, then the ${side} side, toward the ${depth}.`;
}

function seatmateLine(tableId, matchedGuest) {
  const table = data.tables[tableId];
  if (!table?.guests?.length) return { meta: `Table ${tableId}`, sub: "" };

  const others = table.guests.filter(
    (g) => !matchedGuest || normalize(g) !== normalize(matchedGuest)
  );
  const shown = others.slice(0, 3);
  const more = others.length - shown.length;
  const guestCount = `${table.guests.length} guest${table.guests.length === 1 ? "" : "s"}`;

  let meta;
  if (!shown.length) {
    meta = guestCount;
  } else if (more > 0) {
    meta = `With ${shown.join(", ")}, and ${more} more`;
  } else if (shown.length === 1) {
    meta = `With ${shown[0]}`;
  } else if (shown.length === 2) {
    meta = `With ${shown[0]} and ${shown[1]}`;
  } else {
    meta = `With ${shown[0]}, ${shown[1]}, and ${shown[2]}`;
  }

  return {
    meta,
    sub: guestCount,
  };
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i;
    for (let j = 1; j <= b.length; j += 1) {
      const next =
        a[i - 1] === b[j - 1] ? row[j - 1] : 1 + Math.min(row[j - 1], row[j], prev);
      row[j - 1] = prev;
      prev = next;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

function isFuzzyHit(qCompact, nameCompact) {
  if (qCompact.length < 4) return false;
  if (levenshtein(qCompact, nameCompact) <= 1) return true;
  if (nameCompact.length < qCompact.length) {
    return levenshtein(qCompact, nameCompact) <= 1;
  }
  const len = qCompact.length;
  for (let i = 0; i <= nameCompact.length - len; i += 1) {
    if (levenshtein(qCompact, nameCompact.slice(i, i + len)) <= 1) return true;
  }
  return false;
}

function renderMap(container, { activeId = null, showPath = false } = {}) {
  if (!container || !data) return;

  const dots = visibleTableIds()
    .map((id) => {
      const pos = data.positions[id];
      if (id === activeId) {
        const edge =
          pos.y < 18 ? " is-near-top" : pos.x < 14 ? " is-near-left" : pos.x > 86 ? " is-near-right" : "";
        return `<div class="wf-map__you${edge}" style="left:${pos.x}%;top:${pos.y}%">
          <span class="wf-map__you-name">${escapeHtml(data.tables[id].name)}</span>
          <span class="wf-map__you-dot"></span>
          <span class="wf-map__you-label">YOU</span>
        </div>`;
      }
      return `<span class="wf-map__dot" style="left:${pos.x}%;top:${pos.y}%" title="${escapeHtml(
        data.tables[id].name
      )}"></span>`;
    })
    .join("");

  let path = "";
  if (showPath && activeId && data.positions[activeId]) {
    const p = data.positions[activeId];
    const midY = (LOUNGE_ENTRY.y + p.y) / 2;
    const d = `M ${LOUNGE_ENTRY.x} ${LOUNGE_ENTRY.y} C ${LOUNGE_ENTRY.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`;
    const maskId = `wf-route-${container.id || "map"}`;
    path = `<svg class="wf-map__path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <mask id="${maskId}" maskUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="120">
          <rect x="-10" y="-10" width="120" height="120" fill="#000" />
          <path class="wf-map__path-reveal" pathLength="1" d="${d}"
            fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-dasharray="1 1" stroke-dashoffset="1" />
        </mask>
      </defs>
      <path d="${d}"
        fill="none" stroke="rgba(26,102,64,0.45)" stroke-width="1.1" stroke-dasharray="2.2 1.6" stroke-linecap="round"
        mask="url(#${maskId})" />
    </svg>`;
  }

  container.innerHTML = `
    <div class="wf-map__room"></div>
    <div class="wf-map__doors" aria-hidden="true"></div>
    <div class="wf-map__dance" aria-hidden="true">
      <span class="wf-map__dance-label">Dance Floor</span>
    </div>
    <span class="wf-map__landmark wf-map__landmark--dj">DJ</span>
    <span class="wf-map__landmark wf-map__landmark--brown">Mr &amp; Mrs. Brown</span>
    <span class="wf-map__landmark wf-map__landmark--buffet">Buffet</span>
    <div class="wf-map__lounge">Lounge</div>
    ${path}
    ${dots}
  `;
}

function refreshMaps() {
  renderMap(mapMobile, { activeId: activeTableId, showPath: Boolean(activeTableId) });
  renderMap(mapDesktop, { activeId: activeTableId, showPath: Boolean(activeTableId) });
}

function setTab(tab) {
  if (tab === "tables") tableDetailId = null;
  activeTab = tab;
  document.querySelectorAll(".wf-panel").forEach((panel) => {
    const on = panel.dataset.panel === tab;
    panel.hidden = !on;
    panel.classList.toggle("is-active", on);
  });
  document.querySelectorAll("[data-tab]").forEach((btn) => {
    const on = btn.dataset.tab === tab;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  if (tab === "guests") renderGuestPanel({ scrollToMatch: true });
  if (tab === "tables") renderTablesPanel();
}

function sameGuest(a, b) {
  return Boolean(a && b) && normalize(a) === normalize(b);
}

function listGuests() {
  const rows = [];
  for (const id of visibleTableIds()) {
    const table = data.tables[id];
    for (const guest of table.guests) {
      rows.push({ guest, tableId: id, tableName: table.name });
    }
  }
  rows.sort((a, b) => {
    const byName = normalize(a.guest).localeCompare(normalize(b.guest));
    if (byName) return byName;
    return Number(a.tableId) - Number(b.tableId);
  });
  return rows;
}

function renderGuestPanel({ scrollToMatch = false } = {}) {
  if (!data) return;

  const guests = listGuests();
  guestsHeading.textContent = "Guest list";
  guestsLede.textContent = guests.length
    ? "Tap a name to highlight their table."
    : "No guests listed yet.";

  const previousScroll = guestList.scrollTop;
  guestList.innerHTML = guests
    .map(({ guest, tableId, tableName }) => {
      const isMatch = sameGuest(guest, matchedGuestName) && activeTableId === tableId;
      return `<li${isMatch ? ' class="is-match"' : ""}>
        <button type="button" data-guest-pick="${escapeHtml(guest)}" data-table="${tableId}"${
          isMatch ? ' aria-current="true"' : ""
        }>
          <strong>${escapeHtml(guest)}</strong>
          <span class="wf-guest-list__sub">${escapeHtml(tableName)} · Table ${tableId}</span>
        </button>
      </li>`;
    })
    .join("");

  if (scrollToMatch) {
    guestList.querySelector(".is-match")?.scrollIntoView({ block: "nearest" });
  } else {
    guestList.scrollTop = previousScroll;
  }
}

function renderTablesPanel() {
  if (!data) return;

  const showingDetail =
    tableDetailId && data.tables[tableDetailId] && tableDetailId !== "16";
  tablesListView.hidden = Boolean(showingDetail);
  tablesDetailView.hidden = !showingDetail;

  if (showingDetail) {
    const table = data.tables[tableDetailId];
    tablesHeading.textContent = table.name;
    const count = table.guests.length;
    tablesLede.textContent = `Table ${tableDetailId} · ${count} guest${count === 1 ? "" : "s"}`;
    const guests = count ? table.guests : ["No guests listed yet"];
    tableGuests.innerHTML = guests
      .map((guest) => {
        const isMatch = sameGuest(guest, matchedGuestName);
        return `<li${isMatch ? ' class="is-match"' : ""}>${escapeHtml(guest)}</li>`;
      })
      .join("");
    return;
  }

  tableDetailId = null;
  tableList.innerHTML = visibleTableIds()
    .map((id) => {
      const table = data.tables[id];
      const selected = id === activeTableId;
      const count = table.guests.length;
      return `<li${selected ? ' class="is-match"' : ""}>
        <button type="button" data-browse-table="${id}"${selected ? ' aria-current="true"' : ""}>
          <strong>${escapeHtml(table.name)}</strong>
          <span class="wf-guest-list__sub">Table ${id} · ${count} guest${count === 1 ? "" : "s"}</span>
        </button>
      </li>`;
    })
    .join("");
}

function openTable(tableId) {
  const table = data.tables[tableId];
  if (!table || tableId === "16") return;
  const matchedGuest = tableId === activeTableId && matchedGuestName ? matchedGuestName : null;
  tableDetailId = tableId;
  if (matchedGuest) nameInput.value = matchedGuest;
  else nameInput.value = table.name;
  showResult(tableId, { matchedGuest });
}

function showResult(tableId, { matchedGuest = null } = {}) {
  const table = data.tables[tableId];
  if (!table || tableId === "16") return;

  activeTableId = tableId;
  matchedGuestName = matchedGuest;

  resultTitle.textContent = table.name;
  const seat = seatmateLine(tableId, matchedGuest);
  resultMeta.textContent = seat.meta;
  resultMetaSub.textContent = seat.sub;
  resultDirections.textContent = directionForTable(tableId);

  resultCard.hidden = false;
  emptyHint.hidden = true;
  matchPicker.hidden = true;
  matchPicker.innerHTML = "";
  refreshMaps();

  searchStatus.classList.remove("is-error");
  searchStatus.innerHTML = foundStatusHtml({
    guest: matchedGuest || table.name,
    tableName: table.name,
    isTable: !matchedGuest,
  });

  if (mapCaption) {
    mapCaption.textContent = `${table.name} — ${directionForTable(tableId)}`;
  }

  if (activeTab === "guests") renderGuestPanel();
  if (activeTab === "tables") renderTablesPanel();
}

function clearSelection({ keepStatus = false } = {}) {
  activeTableId = null;
  matchedGuestName = null;
  resultCard.hidden = true;
  emptyHint.hidden = false;
  matchPicker.hidden = true;
  matchPicker.innerHTML = "";
  refreshMaps();
  if (mapCaption) {
    mapCaption.textContent =
      "Enter through the lounge at the bottom. Search a name to highlight your table.";
  }
  if (!keepStatus) {
    searchStatus.textContent = "";
    searchStatus.classList.remove("is-error");
  }
  if (activeTab === "guests") renderGuestPanel();
  if (activeTab === "tables") renderTablesPanel();
}

function findMatches(query) {
  const q = normalize(query);
  if (q.length < 2) return [];

  const qCompact = q.replace(/\s+/g, "");
  const parts = q.split(" ").filter(Boolean);
  const exact = [];
  const fuzzy = [];

  for (const [id, table] of Object.entries(data.tables)) {
    if (id === "16") continue;

    // Guest name matches
    for (const guest of table.guests) {
      const n = normalize(guest);
      const nCompact = n.replace(/\s+/g, "");
      const row = { tableId: id, guest, tableName: table.name };

      if (n.includes(q) || parts.every((part) => part && n.includes(part))) {
        exact.push(row);
        continue;
      }
      // Space-forgiving: "christmas kindle" → christmaskindle
      if (qCompact.length >= 4 && nCompact.includes(qCompact)) {
        exact.push(row);
        continue;
      }
      if (isFuzzyHit(qCompact, nCompact)) {
        fuzzy.push(row);
      }
    }

    // Table name matches (same forgiving rules)
    const tn = normalize(table.name);
    const tnCompact = tn.replace(/\s+/g, "");
    const tableRow = {
      tableId: id,
      guest: table.name,
      tableName: table.name,
      isTable: true,
    };
    if (tn.includes(q) || parts.every((part) => part && tn.includes(part))) {
      exact.push(tableRow);
    } else if (qCompact.length >= 4 && (tnCompact.includes(qCompact) || qCompact.includes(tnCompact))) {
      exact.push(tableRow);
    } else if (isFuzzyHit(qCompact, tnCompact)) {
      fuzzy.push(tableRow);
    }
  }

  const sortMatches = (list) =>
    list.sort((a, b) => {
      const an = normalize(a.guest);
      const bn = normalize(b.guest);
      const aExact = an === q ? 0 : an.startsWith(q) ? 1 : 2;
      const bExact = bn === q ? 0 : bn.startsWith(q) ? 1 : 2;
      if (aExact !== bExact) return aExact - bExact;
      return an.localeCompare(bn);
    });

  if (exact.length) return sortMatches(exact);
  return sortMatches(fuzzy).slice(0, 5);
}

function uniqueMatches(matches) {
  const unique = [];
  const seen = new Set();
  for (const m of matches) {
    const key = `${m.guest}|${m.tableId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(m);
  }
  return unique;
}

function showMatchPicker(matches) {
  const unique = uniqueMatches(matches);

  matchPicker.hidden = false;
  matchPicker.innerHTML = unique
    .slice(0, 8)
    .map(
      (m) => `<button type="button" class="wf-matches__btn" data-guest="${escapeHtml(
        m.guest
      )}" data-table="${m.tableId}">
        <strong>${escapeHtml(m.guest)} — ${escapeHtml(m.tableName)}</strong>
        <span>Table ${m.tableId}</span>
      </button>`
    )
    .join("");
}

function runSearch(rawQuery, { fromSubmit = false } = {}) {
  const query = rawQuery.trim();
  const normalized = normalize(query);

  if (!normalized) {
    clearSelection();
    return;
  }

  if (normalized.length < 2) {
    if (fromSubmit) {
      searchStatus.textContent = "Type at least 2 letters to search.";
      searchStatus.classList.add("is-error");
    }
    return;
  }

  const matches = uniqueMatches(findMatches(query));

  if (!matches.length) {
    clearSelection({ keepStatus: true });
    searchStatus.textContent = `No guest found for “${query}”. Try another spelling.`;
    searchStatus.classList.add("is-error");
    return;
  }

  searchStatus.classList.remove("is-error");

  // Multiple distinct guests → always disambiguate; never auto-jump
  if (matches.length > 1) {
    searchStatus.textContent = `${matches.length} matches — tap your name.`;
    resultCard.hidden = true;
    emptyHint.hidden = true;
    showMatchPicker(matches);
    return;
  }

  matchPicker.hidden = true;
  matchPicker.innerHTML = "";
  const best = matches[0];
  showResult(best.tableId, {
    matchedGuest: best.isTable ? null : best.guest,
  });
}

function resetToDefault() {
  nameInput.value = "";
  tableDetailId = null;
  clearSelection();
  setTab("find");
}

function bindEvents() {
  document.querySelector(".wf-brand__title")?.addEventListener("click", resetToDefault);

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch(nameInput.value, { fromSubmit: true });
  });

  nameInput.addEventListener("input", () => {
    const value = nameInput.value.trim();
    if (normalize(value).length >= 2) {
      runSearch(value, { fromSubmit: false });
    } else if (!value) {
      clearSelection();
    } else {
      searchStatus.textContent = "";
      searchStatus.classList.remove("is-error");
      matchPicker.hidden = true;
    }
  });

  matchPicker.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-guest][data-table]");
    if (!btn) return;
    matchPicker.hidden = true;
    matchPicker.innerHTML = "";
    const tableName = data.tables[btn.dataset.table].name;
    const isTable = btn.dataset.guest === tableName;
    showResult(btn.dataset.table, {
      matchedGuest: isTable ? null : btn.dataset.guest,
    });
  });

  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab));
  });

  guestList.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-guest-pick]");
    if (!btn) return;
    nameInput.value = btn.dataset.guestPick;
    showResult(btn.dataset.table, { matchedGuest: btn.dataset.guestPick });
    setTab("find");
  });

  tableList.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-browse-table]");
    if (!btn) return;
    const tableId = btn.dataset.browseTable;
    const table = data.tables[tableId];
    if (table) nameInput.value = table.name;
    showResult(tableId);
    setTab("find");
  });

  tablesBack.addEventListener("click", () => {
    tableDetailId = null;
    renderTablesPanel();
  });
}

async function init() {
  try {
    const response = await fetch("data/guests.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`Failed to load guest data (${response.status})`);
    data = await response.json();
    refreshMaps();
    bindEvents();
    renderGuestPanel();
    renderTablesPanel();
  } catch (error) {
    searchStatus.textContent =
      "Could not load seating data. Serve this folder over HTTP (see README).";
    searchStatus.classList.add("is-error");
    console.error(error);
  }
}

init();

// Activity Suggester — talks to the Bored API (App Brewery mirror) directly
// from the browser, so it works wherever the user opens the page.

const API_BASE = "https://bored-api.appbrewery.com";

const TYPE_EMOJI = {
  education: "📚",
  recreational: "🏕️",
  social: "🎉",
  diy: "🔨",
  charity: "❤️",
  cooking: "🍳",
  relaxation: "🧘",
  music: "🎵",
  busywork: "🧹",
};

const els = {
  type: document.getElementById("type"),
  participants: document.getElementById("participants"),
  price: document.getElementById("price"),
  accessibility: document.getElementById("accessibility"),
  priceLabel: document.getElementById("priceLabel"),
  accLabel: document.getElementById("accLabel"),
  suggestBtn: document.getElementById("suggestBtn"),
  randomBtn: document.getElementById("randomBtn"),
  result: document.getElementById("result"),
};

// --- Slider labels -----------------------------------------------------------
function syncSliderLabels() {
  const p = Number(els.price.value);
  els.priceLabel.textContent = p === 100 ? "any" : p === 0 ? "free" : `$ ${p}%`;
  const a = Number(els.accessibility.value);
  els.accLabel.textContent = a === 100 ? "any" : `${a}%`;
}
els.price.addEventListener("input", syncSliderLabels);
els.accessibility.addEventListener("input", syncSliderLabels);
syncSliderLabels();

// --- UI state helpers --------------------------------------------------------
function showLoading() {
  els.result.innerHTML = `<div class="state"><div class="spinner"></div>Finding something to do…</div>`;
}

function showError(message) {
  els.result.innerHTML = `<div class="state error">😕 ${escapeHtml(message)}</div>`;
}

function showEmpty() {
  els.result.innerHTML = `<div class="state">No activities match those filters. Try loosening them.</div>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// --- Rendering ---------------------------------------------------------------
function renderActivity(a) {
  const emoji = TYPE_EMOJI[a.type] || "✨";
  const pricePct = Math.round((a.price ?? 0) * 100);
  const accPct = Math.round((a.accessibility ?? 0) * 100);
  const priceText = pricePct === 0 ? "Free" : pricePct < 40 ? "Cheap" : pricePct < 70 ? "Moderate" : "Pricey";
  const accText = accPct < 30 ? "Very easy" : accPct < 60 ? "Doable" : "Takes effort";

  const linkHtml =
    a.link && a.link.trim()
      ? `<a class="link" href="${escapeHtml(a.link)}" target="_blank" rel="noopener">Learn more →</a>`
      : "";

  els.result.innerHTML = `
    <article class="card">
      <h2>${emoji} ${escapeHtml(a.activity)}</h2>
      <div class="tags">
        <span class="tag">${escapeHtml(a.type || "activity")}</span>
        <span class="tag alt">${a.participants} ${a.participants === 1 ? "person" : "people"}</span>
        ${a.kidFriendly ? '<span class="tag alt">kid friendly</span>' : ""}
        ${a.duration ? `<span class="tag">${escapeHtml(a.duration)}</span>` : ""}
      </div>
      <div class="meta">
        <div>
          <div class="label">Cost — ${priceText}</div>
          <div class="bar"><span style="width:${pricePct}%"></span></div>
        </div>
        <div>
          <div class="label">Effort — ${accText}</div>
          <div class="bar"><span style="width:${accPct}%"></span></div>
        </div>
      </div>
      ${linkHtml}
    </article>
  `;
}

// --- API calls ---------------------------------------------------------------
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`The activity service responded with ${res.status}. Please try again.`);
  }
  return res.json();
}

async function getRandomActivity() {
  return fetchJson(`${API_BASE}/random`);
}

async function getFilteredActivity() {
  const params = new URLSearchParams();
  if (els.type.value) params.set("type", els.type.value);
  if (els.participants.value) params.set("participants", els.participants.value);

  const price = Number(els.price.value);
  if (price < 100) params.set("maxprice", (price / 100).toFixed(2));

  const acc = Number(els.accessibility.value);
  if (acc < 100) params.set("maxaccessibility", (acc / 100).toFixed(2));

  // No filters set → just grab a random one.
  if ([...params.keys()].length === 0) {
    return getRandomActivity();
  }

  const data = await fetchJson(`${API_BASE}/filter?${params.toString()}`);
  const list = Array.isArray(data) ? data : [data];
  if (!list.length) return null;
  // Pick a random match so repeated clicks feel fresh.
  return list[Math.floor(Math.random() * list.length)];
}

// --- Event wiring ------------------------------------------------------------
async function run(fetcher) {
  setBusy(true);
  showLoading();
  try {
    const activity = await fetcher();
    if (!activity || activity.error) {
      showEmpty();
      return;
    }
    renderActivity(activity);
  } catch (err) {
    showError(err.message || "Something went wrong. Check your connection and try again.");
  } finally {
    setBusy(false);
  }
}

function setBusy(busy) {
  els.suggestBtn.disabled = busy;
  els.randomBtn.disabled = busy;
}

els.suggestBtn.addEventListener("click", () => run(getFilteredActivity));
els.randomBtn.addEventListener("click", () => run(getRandomActivity));

// Suggest one on first load so the page isn't empty.
run(getRandomActivity);
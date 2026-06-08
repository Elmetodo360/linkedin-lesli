// ============================================================
//  App de revisión de posts LinkedIn — vanilla JS
//  Guarda en Google Sheets (Apps Script) + copia local de respaldo
// ============================================================
"use strict";

const LS_KEY = "linkedin_cdt_reviews_v1";
const STATUS = { ok: "Aprobado", changes: "Con cambios", no: "Descartado", pending: "Pendiente" };

let POSTS = [];
let reviews = loadLocal();      // { [postId]: {decision, notes, ts} }
let currentFilter = "all";

// ---------- arranque ----------
init();

async function init() {
  document.getElementById("projectTitle").textContent = CONFIG.projectTitle || "Calendario LinkedIn";
  const name = (CONFIG.reviewerName && !CONFIG.reviewerName.includes("{")) ? CONFIG.reviewerName : "";
  document.getElementById("greeting").textContent = name ? `Hola, ${name}` : "Hola";

  try {
    const res = await fetch("posts.json?v=" + Date.now());
    POSTS = await res.json();
  } catch (e) {
    document.getElementById("list").innerHTML = "<p>No pude cargar los posts. Avísame.</p>";
    return;
  }

  // Si hay backend, intenta hidratar decisiones ya guardadas (resume en cualquier dispositivo)
  if (CONFIG.appsScriptUrl) {
    hydrateFromSheet();
    setSync("Conectado. Tus respuestas se guardan automáticamente.", "ok");
  } else {
    setSync("Modo local: tus respuestas se guardan en este navegador.", "warn");
  }

  render();
  wireFilters();
}

// ---------- render ----------
function render() {
  const list = document.getElementById("list");
  list.innerHTML = "";
  const items = POSTS.filter(p => {
    const s = decisionOf(p.id);
    if (currentFilter === "all") return true;
    if (currentFilter === "pending") return !s;
    return s === currentFilter;
  });

  if (!items.length) {
    list.innerHTML = `<p class="muted" style="text-align:center;padding:30px 0">No hay posts en este filtro.</p>`;
  }

  for (const p of items) list.appendChild(card(p));
  updateProgress();
}

function card(p) {
  const s = decisionOf(p.id);
  const r = reviews[p.id] || {};
  const el = document.createElement("article");
  el.className = "card";
  el.dataset.status = s || "pending";
  el.dataset.id = p.id;

  el.innerHTML = `
    <div class="card-head">
      <div class="head-left">
        <span class="week">Semana ${p.week} · Pilar ${p.pillar}</span>
        <span class="label">${escapeHtml(p.label)}</span>
        <span class="date">${escapeHtml(p.date_label)}</span>
      </div>
      <div class="head-right">
        <span class="status-pill ${s || "pending"}">${STATUS[s || "pending"]}</span>
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 9l6 6 6-6"/></svg>
      </div>
    </div>
    <div class="card-body">
      <div class="post-meta">
        <span>${p.char_count} caracteres</span>
        <span>Límite LinkedIn: 3.000</span>
      </div>
      <pre class="post-text">${escapeHtml(p.body)}</pre>
      <div class="hashtags">${escapeHtml(p.hashtags || "")}</div>
      <div class="text-actions">
        <button class="btn-ghost" data-act="copy">Copiar texto</button>
        <button class="btn-ghost" data-act="copyall">Copiar con hashtags</button>
      </div>

      <div class="decision">
        <div class="decision-title">Tu decisión</div>
        <div class="decision-btns">
          <button class="dbtn d-ok ${s==="ok"?"sel-ok":""}" data-dec="ok"><span class="ic">✓</span> Lo apruebo</button>
          <button class="dbtn d-changes ${s==="changes"?"sel-changes":""}" data-dec="changes"><span class="ic">✎</span> Con cambios</button>
          <button class="dbtn d-no ${s==="no"?"sel-no":""}" data-dec="no"><span class="ic">✕</span> No lo quiero</button>
        </div>
        <div class="notes">
          <label>Notas, cambios o ideas (opcional)</label>
          <textarea placeholder="Ej: cambia el ejemplo del aceite por uno de café; suaviza el cierre; me encanta tal cual...">${escapeHtml(r.notes || "")}</textarea>
          <div class="saved-tag">Guardado ✓</div>
        </div>
      </div>
    </div>`;

  // head toggle
  el.querySelector(".card-head").addEventListener("click", () => el.classList.toggle("open"));

  // copy buttons
  el.querySelector('[data-act="copy"]').addEventListener("click", () => copy(p.body, "Texto copiado"));
  el.querySelector('[data-act="copyall"]').addEventListener("click", () =>
    copy(p.body + "\n\n" + (p.hashtags || ""), "Texto + hashtags copiados"));

  // decision buttons
  el.querySelectorAll(".dbtn").forEach(b =>
    b.addEventListener("click", () => setDecision(p.id, b.dataset.dec, el)));

  // notes autosave (debounced)
  const ta = el.querySelector("textarea");
  let t;
  ta.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => saveNotes(p.id, ta.value, el), 700);
  });

  return el;
}

// ---------- estado ----------
function decisionOf(id){ return reviews[id] && reviews[id].decision; }

function setDecision(id, dec, el) {
  const prev = reviews[id] || {};
  reviews[id] = { decision: dec, notes: prev.notes || "", ts: nowIso() };
  saveLocal();
  // refresca UI de esta tarjeta
  el.dataset.status = dec;
  el.querySelectorAll(".dbtn").forEach(b => b.className = "dbtn d-" + b.dataset.dec);
  el.querySelector(".d-"+dec).classList.add("sel-"+dec);
  const pill = el.querySelector(".status-pill");
  pill.className = "status-pill " + dec; pill.textContent = STATUS[dec];
  updateProgress();
  push(id);
  flashSaved(el);
  toast(dec === "ok" ? "Aprobado" : dec === "no" ? "Descartado" : "Marcado con cambios");
}

function saveNotes(id, val, el) {
  const prev = reviews[id] || { decision: "", notes: "" };
  reviews[id] = { decision: prev.decision || "", notes: val, ts: nowIso() };
  saveLocal();
  push(id);
  flashSaved(el);
}

function updateProgress() {
  const done = POSTS.filter(p => decisionOf(p.id)).length;
  document.getElementById("progressText").textContent = `${done} / ${POSTS.length} revisados`;
  document.getElementById("progressFill").style.width = (POSTS.length ? (done/POSTS.length*100) : 0) + "%";
}

// ---------- persistencia local ----------
function loadLocal(){ try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; } }
function saveLocal(){ localStorage.setItem(LS_KEY, JSON.stringify(reviews)); }

// ---------- backend (Apps Script) ----------
// Escritura: POST text/plain (evita preflight CORS). Fire-and-forget.
function push(id) {
  if (!CONFIG.appsScriptUrl) return;
  const r = reviews[id] || {};
  const payload = {
    action: "save",
    reviewer: (CONFIG.reviewerName||"").replace(/[{}]/g,""),
    postId: id,
    week: (POSTS.find(p=>p.id===id)||{}).week || "",
    decision: r.decision || "",
    notes: r.notes || "",
    ts: r.ts || nowIso()
  };
  fetch(CONFIG.appsScriptUrl, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  }).catch(()=>{ /* respaldo local ya guardado */ });
}

// Lectura: JSONP (Apps Script no envía cabeceras CORS para GET).
function hydrateFromSheet() {
  const cb = "cdt_cb_" + Math.floor(Date.now()/1000);
  window[cb] = (rows) => {
    try {
      let changed = false;
      (rows || []).forEach(row => {
        const id = Number(row.postId);
        if (!id) return;
        const local = reviews[id];
        // el servidor manda si es más reciente o si no hay local
        if (!local || (row.ts && row.ts > (local.ts||""))) {
          reviews[id] = { decision: row.decision||"", notes: row.notes||"", ts: row.ts||nowIso() };
          changed = true;
        }
      });
      if (changed) { saveLocal(); render(); }
    } catch(e){}
    delete window[cb];
    document.body.removeChild(s);
  };
  const s = document.createElement("script");
  s.src = CONFIG.appsScriptUrl + "?action=list&callback=" + cb + "&v=" + Date.now();
  s.onerror = () => { try{document.body.removeChild(s);}catch{} };
  document.body.appendChild(s);
}

// ---------- util ----------
function wireFilters() {
  document.querySelectorAll(".chip").forEach(c =>
    c.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach(x => x.classList.remove("is-active"));
      c.classList.add("is-active");
      currentFilter = c.dataset.filter;
      render();
    }));
}
function flashSaved(el){ const t=el.querySelector(".saved-tag"); if(!t)return; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),1500); }
function setSync(msg, cls){ const n=document.getElementById("syncNote"); n.textContent=msg; n.className="sync-note "+(cls||""); }
function copy(text, msg){ navigator.clipboard.writeText(text).then(()=>toast(msg)).catch(()=>toast("No se pudo copiar")); }
let toastT;
function toast(msg){ const t=document.getElementById("toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),1800); }
function nowIso(){ return new Date().toISOString(); }
function escapeHtml(s){ return (s||"").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }

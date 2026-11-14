/* Les courses de Laurent — un dossard par course, une fiche par course, un onglet Données. */
(function () {
  "use strict";

  const CATS = [
    { key: "all", label: "Toutes" },
    { key: "xxl", label: "Ironman & Embrunman" },
    { key: "tri", label: "Triathlons" },
    { key: "course", label: "Course à pied" },
  ];
  const CAT_LABEL = { xxl: "Ironman / Embrunman", tri: "Triathlon", course: "Course à pied" };

  let courses = [];
  let cat = "all";
  let openId = null;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toSec = (t) => { if (!t) return null; const p = t.split(":").map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]; };
  const dmy = (d) => d.slice(8, 10) + "/" + d.slice(5, 7) + "/" + d.slice(0, 4);
  const fmtInt = (n) => Math.round(n).toLocaleString("fr-FR");
  const ord = (n) => n === 1 ? "1er" : n + "e";

  // ---------- En-tête ----------
  function renderHero() {
    const xxl = courses.filter((c) => c.categorie === "xxl");
    const emb = xxl.filter((c) => c.nom === "Embrunman");
    const tri = courses.filter((c) => c.categorie === "tri");
    const run = courses.filter((c) => c.categorie === "course");
    const bestEmb = emb.slice().sort((a, b) => toSec(a.chrono) - toSec(b.chrono))[0];
    const longest = run.slice().sort((a, b) => (b.distance_km || 0) - (a.distance_km || 0))[0];
    const years = courses.map((c) => c.date.slice(0, 4)).sort();
    document.getElementById("eyebrow").textContent = "Courses de Laurent · " + years[0] + " – " + years[years.length - 1];
    document.getElementById("hero").innerHTML = [
      [String(courses.length), "courses depuis " + years[0]],
      [String(xxl.length), `Ironman et Embrunman, dont ${emb.length} Embrunman · meilleur ${bestEmb.chrono} (${bestEmb.date.slice(0, 4)})`],
      [String(tri.length), "autres triathlons et duathlons (distances M et L)"],
      [String(run.length), `courses à pied, dont la ${longest.nom} en ${longest.chrono}`],
    ].map(([b, s], i) => `<div class="stat s${i}"><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join("");
  }

  function renderFilters() {
    document.getElementById("cats").innerHTML = CATS.map((c) =>
      `<button type="button" data-cat="${c.key}" aria-pressed="${c.key === cat}">${esc(c.label)}</button>`).join("");
  }

  // ---------- Liste : dossards groupés par année ----------
  const TILTS = [-0.8, 0.6, -0.3, 0.9, -0.6, 0.4];
  const shownList = () => courses.filter((c) => cat === "all" || c.categorie === cat);

  function renderList() {
    const list = document.getElementById("list");
    const shown = shownList();
    const byYear = new Map();
    shown.forEach((c) => { const y = c.date.slice(0, 4); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(c); });
    let k = 0, html = "";
    for (const [y, items] of byYear) {
      html += `<section class="yr"><h2><span>${y}</span><small>${items.length} course${items.length > 1 ? "s" : ""}</small></h2>
        <div class="bibs">${items.map((c) => bibHtml(c, k++)).join("")}</div></section>`;
    }
    list.innerHTML = shown.length ? html : `<p class="loading">Aucune course dans cette catégorie.</p>`;
    list.setAttribute("aria-busy", "false");
  }

  function placeTxt(c) {
    if (!c.place) return "";
    return ord(c.place) + (c.partants ? " / " + fmtInt(c.partants) : "");
  }

  function bibHtml(c, i) {
    return `<button type="button" class="bib ${c.categorie}" id="${c.id}" data-id="${c.id}" style="--tilt:${TILTS[i % TILTS.length]}deg" aria-label="${esc(c.nom)} ${c.date.slice(0, 4)}, ${c.chrono} : ouvrir la fiche">
      <span class="band"><span class="bn">${esc(c.nom)}</span><span>${c.date.slice(0, 4)}</span></span>
      <span class="num">${c.chrono}</span>
      <span class="cap">${esc(c.format)}${c.dist.startsWith("distance") ? "" : " · " + esc(c.dist)}</span>
      <span class="foot"><span>${dmy(c.date)} · ${esc(c.lieu)}</span>${c.place ? `<span class="pl">${placeTxt(c)}</span>` : ""}</span>
      <span class="pin p1" aria-hidden="true"></span><span class="pin p2" aria-hidden="true"></span><span class="pin p3" aria-hidden="true"></span><span class="pin p4" aria-hidden="true"></span>
    </button>`;
  }

  // ---------- Fiche d'une course ----------
  function splitsHtml(c) {
    const parts = [["Natation", c.natation], ["Vélo", c.velo], [c.format.startsWith("Duathlon") ? "Course à pied (2 parties)" : "Course à pied", c.cap]];
    if (!c.natation && !c.velo && !c.cap) return "";
    const tot = toSec(c.chrono);
    const known = parts.filter(([, t]) => t);
    const bar = parts.every(([, t]) => t)
      ? `<div class="split-bar" role="img" aria-label="Répartition du temps entre natation, vélo et course à pied">${parts.map(([l, t], i) =>
          `<span class="sb${i}" style="flex:${toSec(t)}"></span>`).join("")}</div>`
      : "";
    return `<section class="splits" aria-label="Temps intermédiaires">
      <h3>Temps par discipline</h3>
      ${bar}
      <dl class="stats">${known.map(([l, t]) => { const i = parts.findIndex((p) => p[0] === l);
        return `<div><dt><i class="key sb${i}"></i>${l}</dt><dd>${t} <small>${Math.round(toSec(t) / tot * 100)} %</small></dd></div>`; }).join("")}</dl>
      <p class="fine">Les transitions sont comprises dans le temps total mais pas dans les temps par discipline.</p>
    </section>`;
  }

  function modalHtml(c) {
    const shown = shownList(), k = shown.findIndex((x) => x.id === c.id);
    const newer = shown[k - 1], older = shown[k + 1];
    const sameRace = courses.filter((x) => x.nom === c.nom && x.format === c.format).sort((a, b) => a.date.localeCompare(b.date));
    const editions = sameRace.length > 1
      ? `<section class="editions"><h3>Ses ${sameRace.length} participations · ${esc(c.nom)}</h3><ol>${sameRace.map((x) =>
          `<li${x.id === c.id ? ' class="cur"' : ""}><button type="button" data-m="go" data-to="${x.id}" ${x.id === c.id ? "disabled" : ""}><span>${x.date.slice(0, 4)}</span><b>${x.chrono}</b></button></li>`).join("")}</ol></section>`
      : "";
    return `<div class="sheet-bar">
        <div class="nav">
          <button type="button" data-m="go" data-to="${newer ? newer.id : ""}" ${newer ? "" : "disabled"}>← Plus récente</button>
          <button type="button" data-m="go" data-to="${older ? older.id : ""}" ${older ? "" : "disabled"}>Plus ancienne →</button>
        </div>
        <button type="button" class="x" data-m="close" aria-label="Fermer">×</button>
      </div>
      <div class="sheet-body">
        <div class="col-l">
          <div class="bib big ${c.categorie}">
            <span class="band"><span class="bn" id="m-title">${esc(c.nom)}</span><span>${c.date.slice(0, 4)}</span></span>
            <span class="num">${c.chrono}</span>
            <span class="cap">${esc(c.format)}</span>
            <span class="foot"><span>${dmy(c.date)} · ${esc(c.lieu)}</span></span>
          </div>
          <dl class="stats">
            <div><dt>Chrono officiel</dt><dd>${c.chrono}</dd></div>
            <div><dt>Classement</dt><dd>${c.place ? placeTxt(c) : "—"}</dd></div>
            <div><dt>Format</dt><dd>${esc(c.format)}</dd></div>
            <div><dt>Distances</dt><dd>${esc(c.dist)}</dd></div>
          </dl>
          ${c.notes ? `<p class="notes">${esc(c.notes)}</p>` : ""}
          ${c.source ? `<a class="strava" href="${esc(c.source)}" target="_blank" rel="noopener">Voir le classement officiel →</a>` : ""}
        </div>
        <div class="col-r">
          ${splitsHtml(c) || `<section class="splits"><h3>Temps par discipline</h3><p class="fine">Pas de temps intermédiaires publiés pour cette course.</p></section>`}
          ${editions}
        </div>
      </div>`;
  }

  let lastFocus = null;
  function openModal(id) {
    const c = courses.find((x) => x.id === id);
    if (!c) return;
    if (cat !== "all" && c.categorie !== cat) { cat = "all"; renderFilters(); renderList(); }
    if (!openId) lastFocus = document.activeElement;
    openId = id;
    try { history.replaceState(null, "", "#" + id); } catch (e) { /* cadre restreint */ }
    const modal = document.getElementById("modal"), sheet = document.getElementById("sheet");
    sheet.innerHTML = modalHtml(c);
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    sheet.querySelector(".x").focus();
  }
  function closeModal() {
    if (!openId) return;
    const id = openId;
    openId = null;
    document.getElementById("modal").hidden = true;
    document.body.style.overflow = "";
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* cadre restreint */ }
    (document.getElementById(id) || lastFocus)?.focus();
  }

  // ---------- Interactions ----------
  document.addEventListener("click", (e) => {
    const f = e.target.closest("[data-cat]");
    if (f) { cat = f.dataset.cat; renderFilters(); renderList(); return; }
    const m = e.target.closest("[data-m]");
    if (m) { if (m.dataset.m === "close") closeModal(); else if (m.dataset.to) openModal(m.dataset.to); return; }
    if (e.target.id === "modal") { closeModal(); return; }
    const r = e.target.closest(".bib[data-id]");
    if (r && !r.closest(".sheet")) openModal(r.dataset.id);
  });
  document.addEventListener("keydown", (e) => {
    if (!openId) return;
    if (e.key === "Escape") closeModal();
    else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const shown = shownList(), k = shown.findIndex((x) => x.id === openId);
      const t = shown[k + (e.key === "ArrowLeft" ? -1 : 1)];
      if (t) openModal(t.id);
    }
  });

  // ---------- Vues : courses / données ----------
  let view = "list", dataMaps = null;
  function setView(v) {
    view = v;
    document.getElementById("list").hidden = v !== "list";
    document.getElementById("filters").hidden = v !== "list";
    const d = document.getElementById("data"); d.hidden = v !== "data";
    document.querySelectorAll(".tabs [data-view]").forEach((a) => {
      if (a.dataset.view === v) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    if (v === "data") {
      if (!dataMaps) dataMaps = window.renderDataView(courses, d);
      dataMaps.forEach((m) => m && m.invalidateSize());
    }
  }
  function route() {
    const id = location.hash.slice(1);
    if (id === "donnees") { closeModal(); setView("data"); return; }
    if (view !== "list") setView("list");
    if (id && id !== openId && courses.some((c) => c.id === id)) openModal(id);
    else if (!id) closeModal();
  }
  window.addEventListener("hashchange", route);

  fetch("data/courses.json")
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((data) => {
      courses = data.sort((a, b) => b.date.localeCompare(a.date));
      renderHero();
      renderFilters();
      renderList();
      const h = location.hash.slice(1);
      if (courses.some((c) => c.id === h)) openModal(h);
      if (h === "donnees") setView("data");
    })
    .catch(() => {
      document.getElementById("list").innerHTML = `<p class="error">Impossible de charger la liste des courses.</p>`;
    });
})();

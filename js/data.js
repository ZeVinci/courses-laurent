/* Onglet « Données » : graphiques dessinés en SVG, sans dépendance (la carte utilise Leaflet). */
window.renderDataView = function (courses, root) {
  "use strict";
  const toSec = t => { if (!t) return null; const p = t.split(":").map(Number); return p.length === 3 ? p[0]*3600 + p[1]*60 + p[2] : p[0]*60 + p[1]; };
  const DATA = courses.map(c => Object.assign({}, c, {t: toSec(c.chrono), ll: c.depart || null}));
  const LATE = [];
const COL = {xxl:"#B4232A", tri:"#1F4FE0", course:"#0B7A54"};
const CATL = {xxl:"Ironman / Embrunman", tri:"Autres triathlons", course:"Course à pied"};
const BORN = 1971;
const NS = "http://www.w3.org/2000/svg";
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const hms = s => { s = Math.round(s); const h = Math.floor(s/3600), m = Math.floor(s%3600/60), x = s%60; return (h? h+":"+String(m).padStart(2,"0") : m) + ":" + String(x).padStart(2,"0"); };
const hmm = s => { const h = Math.floor(s/3600), m = Math.round(s%3600/60); return h+"h"+String(m).padStart(2,"0"); };
const pace = s => { s = Math.round(s); return Math.floor(s/60)+":"+String(s%60).padStart(2,"0"); };
const hmin = m => Math.floor(m/60)+"h"+String(m%60).padStart(2,"0");
const dmy = d => d.slice(8,10)+"/"+d.slice(5,7)+"/"+d.slice(0,4);
const yr = c => c.date.slice(0,4);
const EMB = DATA.filter(c => c.nom === "Embrunman").sort((a,b) => a.date.localeCompare(b.date));
const best = EMB.slice().sort((a,b) => a.t - b.t)[0];

// ---------- helpers ----------
function el(tag, attrs = {}, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
function txt(parent, x, y, s, attrs = {}) { const t = el("text", Object.assign({x, y}, attrs), parent); t.textContent = s; return t; }
function linear(d0, d1, r0, r1) { const f = v => r0 + (v - d0) / (d1 - d0) * (r1 - r0); f.inv = p => d0 + (p - r0) / (r1 - r0) * (d1 - d0); return f; }
function niceTicks(a, b, n = 5) { const span = b - a, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0))); const err = step0 / mag; const step = (err >= 7 ? 10 : err >= 3 ? 5 : err >= 1.5 ? 2 : 1) * mag; const out = []; for (let v = Math.ceil(a/step)*step; v <= b + 1e-9; v += step) out.push(+v.toFixed(10)); return out; }
function frame(W, H, m) { const svg = el("svg", {viewBox:`0 0 ${W} ${H}`, role:"img", class:"ch"}); return {svg, x0:m.l, x1:W-m.r, y0:H-m.b, y1:m.t, W, H}; }
function yAxis(f, y, ticks, fmt, title) { ticks.forEach(v => { const p = y(v); el("line", {x1:f.x0, x2:f.x1, y1:p, y2:p, class:"gr"}, f.svg); txt(f.svg, f.x0-8, p+4, fmt(v), {"text-anchor":"end"}); }); if (title) txt(f.svg, f.x0-8, f.y1-10, title, {"text-anchor":"end"}); }
function xAxis(f, x, ticks, fmt, title) { el("line", {x1:f.x0, x2:f.x1, y1:f.y0, y2:f.y0, class:"ax"}, f.svg); ticks.forEach(v => { const p = x(v); el("line", {x1:p, x2:p, y1:f.y0, y2:f.y0+4, class:"ax"}, f.svg); txt(f.svg, p, f.y0+17, fmt(v), {"text-anchor":"middle"}); }); if (title) txt(f.svg, f.x1, f.y0+34, title, {"text-anchor":"end"}); }
function dot(f, cx, cy, r, color, tip, opts = {}) {
  const g = el("g", {}, f.svg);
  el("circle", {cx, cy, r: r + 2, fill: "#fff"}, g);
  el("circle", {cx, cy, r, fill: opts.hollow ? "#fff" : color, stroke: color, "stroke-width": opts.hollow ? 2 : 0}, g);
  const h = el("circle", {cx, cy, r: Math.max(r + 6, 11), class: "hit"}, g); h.dataset.tip = tip; if (opts.id) h.dataset.go = opts.id; return g;
}
function legend(items) { return `<div class="leg">${items.map(([c,l,cls]) => `<span><i class="${cls||""}" style="background:${c}"></i>${esc(l)}</span>`).join("")}</div>`; }
const tipC = c => `<b>${esc(c.nom)}</b><br>${dmy(c.date)} · ${esc(c.lieu || "")}<br>${esc(c.format)} · ${c.chrono}${c.place ? `<br>${c.place}e${c.partants ? " / " + c.partants : ""}` : ""}`;

// ---------- cards ----------

const CARDS = [];
let currentGroup = null;
function group(name) { const h = document.createElement("h2"); h.className = "viz-group"; h.textContent = name; root.appendChild(h); currentGroup = document.createElement("div"); currentGroup.className = "viz-grid"; root.appendChild(currentGroup); }
function card(no, title, desc, build, wide) {
  const c = document.createElement("section"); c.className = "viz-card" + (wide ? " wide" : ""); c.id = "g" + no;
  c.innerHTML = `<h3>${esc(title)}</h3><p class="d">${desc}</p><div class="body"></div>`;
  currentGroup.appendChild(c); build(c.querySelector(".body")); CARDS.push({no, title});
}

// 1. Courses par année
group("Vue d'ensemble");
card(1, "Courses par année", "Nombre de courses chaque année, réparties par catégorie.", body => {
  const years = []; for (let y = +yr(DATA.reduce((a,b)=>a.date<b.date?a:b)); y <= +yr(DATA.reduce((a,b)=>a.date>b.date?a:b)); y++) years.push(String(y));
  const cats = ["xxl","tri","course"];
  const cnt = years.map(y => cats.map(k => DATA.filter(c => yr(c) === y && c.categorie === k)));
  const max = Math.max(...cnt.map(a => a.reduce((s,x)=>s+x.length,0)));
  body.innerHTML = legend(cats.map(k => [COL[k], CATL[k], "sq"]));
  const f = frame(520, 250, {l:30, r:6, t:16, b:30}); body.appendChild(f.svg);
  const y = linear(0, max, f.y0, f.y1); yAxis(f, y, niceTicks(0, max, 4).filter(v=>Number.isInteger(v)), v => v);
  const bw = (f.x1 - f.x0) / years.length;
  years.forEach((Y, i) => {
    let acc = 0; const x = f.x0 + i*bw + bw*0.18, w = bw*0.64;
    cats.forEach((k, j) => { const n = cnt[i][j].length; if (!n) return;
      const yTop = y(acc + n), yBot = y(acc); const r = el("rect", {x, y: yTop + 1, width: w, height: Math.max(1, yBot - yTop - 2), rx: 2, fill: COL[k]}, f.svg);
      r.dataset.tip = `<b>${Y} · ${CATL[k]}${n>1?"s":""} : ${n}</b><br>${cnt[i][j].map(c=>esc(c.nom)).join("<br>")}`; r.style.cursor = "pointer"; acc += n; });
    if (i % 2 === 0 || years.length < 14) txt(f.svg, x + w/2, f.y0 + 16, "’" + Y.slice(2), {"text-anchor":"middle"});
  });
  el("line", {x1:f.x0, x2:f.x1, y1:f.y0, y2:f.y0, class:"ax"}, f.svg);
});

// 2. Saisonnalité
card(2, "Saisonnalité", "Une pastille par course, placée par année et par mois.", body => {
  const years = [...new Set(DATA.map(yr))].sort();
  body.innerHTML = legend(["xxl","tri","course"].map(k => [COL[k], CATL[k]]));
  const f = frame(520, 26 + years.length*17 + 10, {l:40, r:6, t:22, b:10}); body.appendChild(f.svg);
  const M = ["J","F","M","A","M","J","J","A","S","O","N","D"]; const cw = (f.x1 - f.x0) / 12;
  M.forEach((m,i) => { txt(f.svg, f.x0 + cw*i + cw/2, 12, m, {"text-anchor":"middle"}); if (i%2===0) el("rect", {x: f.x0 + cw*i, y: 18, width: cw, height: years.length*17 + 4, fill:"#F7F8FA"}, f.svg); });
  years.forEach((Y, j) => { const yy = 28 + j*17; txt(f.svg, f.x0 - 8, yy + 4, Y, {"text-anchor":"end"});
    const items = DATA.filter(c => yr(c) === Y).sort((a,b)=>a.date.localeCompare(b.date));
    const perM = {}; items.forEach(c => { const m = +c.date.slice(5,7) - 1; perM[m] = (perM[m]||0) + 1; const k = perM[m] - 1;
      dot(f, f.x0 + cw*m + cw/2 + (k ? (k%2 ? 9 : -9) : 0) * Math.ceil(k/2), yy, 5, COL[c.categorie], tipC(c), {id: c.id}); }); });
});

// 3. Carte
card(3, "Carte des courses", "Chaque course placée à son lieu d'arrivée ; la taille du point suit le nombre de participations au même endroit. Clique sur un point pour ouvrir la course.", body => {
  const m = document.createElement("div"); m.className = "viz-map"; body.appendChild(m);
  const far = DATA.filter(c => c.ll && Math.abs(c.ll[1]) > 20);
  body.insertAdjacentHTML("beforeend", `<p class="note">Lieux placés à la commune, pas au départ exact.${far.length ? ` ${far.map(c => esc(c.nom) + " (" + esc(c.lieu) + ")").join(", ")} : hors du cadre, dézoome pour la voir.` : ""}</p>`);
  LATE.push(() => {
    const map = L.map(m, {scrollWheelZoom: false});
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom: 18, attribution: "© OpenStreetMap"}).addTo(map);
    const places = new Map();
    DATA.filter(c => c.ll).forEach(c => { const k = c.ll.join(","); if (!places.has(k)) places.set(k, []); places.get(k).push(c); });
    for (const list of places.values()) {
      const c0 = list[0], n = list.length;
      const tip = `<b>${esc(c0.lieu)}</b> · ${n} course${n > 1 ? "s" : ""}<br>` + list.slice().sort((a,b) => a.date.localeCompare(b.date)).map(c => `${yr(c)} · ${esc(c.nom)} · ${c.chrono}`).join("<br>");
      const cat = list.some(c => c.categorie === "xxl") ? "xxl" : list[0].categorie;
      L.circleMarker(c0.ll, {radius: 6 + Math.sqrt(n) * 4, color: "#fff", weight: 1.5, fillColor: COL[cat], fillOpacity: 0.75})
        .bindTooltip(tip).on("click", () => { location.hash = list[list.length - 1].id; }).addTo(map);
    }
    const near = DATA.filter(c => c.ll && Math.abs(c.ll[1]) <= 20);
    map.fitBounds(L.latLngBounds(near.map(c => c.ll)).pad(0.1));
    return map;
  });
}, true);

// 5. Les Embrunman dans le temps
group("Embrunman");
function timeY(f, list, pad = 1200, step = 3600) {
  const lo = Math.floor((Math.min(...list.map(c=>c.t)) - pad/2)/1800)*1800, hi = Math.ceil((Math.max(...list.map(c=>c.t)) + pad/4)/1800)*1800;
  const y = linear(lo, hi, f.y0, f.y1); const t = []; for (let v = Math.ceil(lo/step)*step; v <= hi; v += step) t.push(v); yAxis(f, y, t, hmm); return y;
}
const splitTip = c => c.natation || c.velo || c.cap ? `<br>natation ${c.natation || "—"} · vélo ${c.velo || "—"} · course ${c.cap || "—"}` : "";
card(5, "Ses Embrunman dans le temps", "Le chrono de chacune de ses participations, de 2002 à 2019. Le meilleur est mis en avant.", body => {
  const f = frame(520, 280, {l:44, r:14, t:22, b:34}); body.appendChild(f.svg);
  const y0 = +yr(EMB[0]), y1 = +yr(EMB[EMB.length-1]);
  const x = linear(y0 - 0.6, y1 + 0.6, f.x0, f.x1);
  const y = timeY(f, EMB);
  xAxis(f, x, niceTicks(y0, y1, 6).filter(Number.isInteger), v => v);
  el("line", {x1:f.x0, x2:f.x1, y1:y(best.t), y2:y(best.t), stroke:COL.xxl, "stroke-dasharray":"3 4", "stroke-width":1}, f.svg);
  txt(f.svg, f.x1, y(best.t) + 14, "meilleur " + best.chrono, {"text-anchor":"end", class:"lbl"});
  el("polyline", {points: EMB.map(c => x(+yr(c))+","+y(c.t)).join(" "), fill:"none", stroke:"#E3A6A9", "stroke-width":2}, f.svg);
  EMB.forEach(c => dot(f, x(+yr(c)), y(c.t), c === best ? 7 : 5, COL.xxl, tipC(c) + splitTip(c), {id: c.id}));
});

// 7. Chrono selon l'âge
card(7, "Chrono selon l'âge", "Les mêmes Embrunman, placés selon son âge le jour de la course (né en 1971, âge à l'année près).", body => {
  const f = frame(520, 280, {l:44, r:30, t:22, b:40}); body.appendChild(f.svg);
  const age = c => +yr(c) - BORN;
  const a0 = Math.min(...EMB.map(age)), a1 = Math.max(...EMB.map(age));
  const x = linear(a0 - 1, a1 + 1, f.x0, f.x1); const y = timeY(f, EMB);
  xAxis(f, x, niceTicks(a0, a1, 5).filter(Number.isInteger), v => v + " ans", "âge");
  EMB.forEach(c => dot(f, x(age(c)), y(c.t), 5, COL.xxl, tipC(c) + `<br>${age(c)} ans environ`, {id: c.id}));
});

// 6. Même course, plusieurs éditions
group("Ses courses fétiches");
card(6, "Même course, plusieurs éditions", "Les triathlons qu'il a courus plusieurs fois (hors Embrunman) : même parcours, donc la comparaison la plus juste. Chaque petit graphique a sa propre échelle.", body => {
  const groups = new Map();
  DATA.filter(c => c.categorie === "tri").forEach(c => { const k = c.nom + " · " + c.format.replace("Triathlon ", "distance "); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); });
  const multi = [...groups.entries()].filter(([, l]) => l.length > 1).sort((a, b) => b[1].length - a[1].length);
  const box = document.createElement("div"); box.className = "viz-multi wide-multi"; body.appendChild(box);
  multi.forEach(([k, list]) => {
    list.sort((a, b) => a.date.localeCompare(b.date));
    const d = document.createElement("div"); d.className = "sm";
    const bestC = list.slice().sort((a, b) => a.t - b.t)[0];
    d.innerHTML = `<b>${esc(k)}</b>${list.length} éditions · meilleur ${bestC.chrono}`; box.appendChild(d);
    const f = frame(240, 130, {l:40, r:12, t:12, b:24}); d.appendChild(f.svg);
    const ys = list.map(c => +yr(c)); const x = linear(Math.min(...ys) - 0.5, Math.max(...ys) + 0.5, f.x0, f.x1);
    const tl = Math.min(...list.map(c => c.t)), th = Math.max(...list.map(c => c.t)), pad = Math.max(300, (th - tl) * 0.25);
    const y = linear(tl - pad, th + pad, f.y0, f.y1);
    (th - tl < 400 ? [tl] : [tl, th]).forEach(v => { el("line", {x1:f.x0, x2:f.x1, y1:y(v), y2:y(v), class:"gr"}, f.svg); txt(f.svg, f.x0 - 6, y(v) + 4, hmm(v), {"text-anchor":"end"}); });
    xAxis(f, x, ys, v => "’" + String(v).slice(2));
    el("polyline", {points: list.map(c => x(+yr(c)) + "," + y(c.t)).join(" "), fill:"none", stroke:"#A9B9EF", "stroke-width":2}, f.svg);
    list.forEach(c => dot(f, x(+yr(c)), y(c.t), 4.5, COL.tri, tipC(c) + splitTip(c), {id: c.id}));
  });
}, true);

  // ---------- infobulle ----------
  let tip = document.getElementById("viz-tip");
  if (!tip) { tip = document.createElement("div"); tip.id = "viz-tip"; tip.setAttribute("role", "tooltip"); document.body.appendChild(tip); }
  root.addEventListener("mousemove", e => { const t = e.target.closest && e.target.closest("[data-tip]"); if (!t) { tip.style.opacity = 0; return; }
    tip.innerHTML = t.dataset.tip; tip.style.opacity = 1; const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(innerWidth - w - 8, e.clientX + 14) + "px"; tip.style.top = (e.clientY + 16 + h > innerHeight ? e.clientY - h - 12 : e.clientY + 16) + "px"; });
  root.addEventListener("mouseleave", () => { tip.style.opacity = 0; });
  root.addEventListener("click", e => { const t = e.target.closest("[data-go]"); if (t) { tip.style.opacity = 0; location.hash = t.dataset.go; } });
  return LATE.map(f => f());
};

(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const C = { ink: "#1b1d20", ink2: "#525a64", ink3: "#5f6872", bench: "#8d99a6", grid: "#eceae4", rule: "#dedbd3", live: "#c22f7a" };
  const SANS = "IBM Plex Sans, system-ui, sans-serif", MONO = "IBM Plex Mono, monospace";
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const t = (s) => Date.parse(s + "T00:00:00Z");
  const fmtDate = (s) => { const [y, m, d] = s.split("-"); return `${+d} ${MON[+m - 1]} ${y}`; };
  const el = (tag, a, p) => { const n = document.createElementNS(NS, tag); for (const k in a) n.setAttribute(k, a[k]); if (p) p.appendChild(n); return n; };
  const txt = (p, s, a) => { const n = el("text", Object.assign({ "font-family": SANS, "font-size": 12, fill: C.ink3 }, a), p); n.textContent = s; return n; };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; // no motion is used either way
  void reduce;

  function logTicks(lo, hi) {
    const c = [10, 20, 30, 50, 70, 100, 150, 200, 300, 500, 700, 1000, 1500, 2000, 3000];
    const r = c.filter((v) => v >= lo * 0.98 && v <= hi * 1.02);
    return r.length > 5 ? r.filter((v, i) => v === 100 || i % 2 === 0) : r;
  }
  function linTicks(lo, hi) {
    const raw = (hi - lo) / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / p;
    const step = (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * p, out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(Math.round(v));
    return out;
  }

  // ---------- home: small multiples on one shared time axis ----------
  const grid = document.getElementById("multiples-data");
  if (grid) {
    const G = JSON.parse(grid.textContent);
    const draw = () => document.querySelectorAll(".mini[data-i]").forEach((box) => {
      box.querySelectorAll("svg").forEach((s) => s.remove());
      const d = G.designs[+box.dataset.i], m = d.mini;
      const x0 = t(m.dates[0]), x1 = t(G.x1) + (t(G.x1) - t(m.dates[0])) * (d.live ? 0.03 : 0);  // own history (+ room for live)
      const y0s = +m.dates[0].slice(0, 4), y1s = +G.x1.slice(0, 4), stepY = y1s - y0s >= 6 ? 3 : 1;
      const years = []; for (let y = y0s + 1; y <= y1s; y += stepY) years.push(y);
      const W = Math.max(240, box.clientWidth), H = Math.round(W * 0.56), mg = { l: 0, r: 42, t: 8, b: 20 };
      const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `${d.name}: value of 100 against ${d.benchmark} since ${m.dates[0].slice(0, 4)}` }, box);
      const vals = m.total.concat(m.bench).filter((v) => v != null);
      const lo = Math.min(...vals), hi = Math.max(...vals);
      const f = Math.log, y0 = f(lo) - 0.05 * (f(hi) - f(lo)), y1 = f(hi) + 0.05 * (f(hi) - f(lo));
      const X = (s) => mg.l + ((t(s) - x0) / (x1 - x0)) * (W - mg.l - mg.r);
      const Y = (v) => mg.t + (1 - (f(v) - y0) / (y1 - y0)) * (H - mg.t - mg.b);
      // baseline 100 and year ticks shared by every panel
      el("line", { x1: X(m.dates[0]), x2: W - mg.r, y1: Y(100), y2: Y(100), stroke: C.rule, "stroke-dasharray": "2 3" }, svg);
      years.forEach((y) => { const x = X(`${y}-01-01`); el("line", { x1: x, x2: x, y1: H - mg.b, y2: H - mg.b + 4, stroke: C.ink3 }, svg); txt(svg, `’${String(y).slice(2)}`, { x: x + 2, y: H - 4, "font-size": 12 }); });
      el("line", { x1: mg.l, x2: W - mg.r, y1: H - mg.b, y2: H - mg.b, stroke: C.rule }, svg);
      const path = (arr, attrs) => { let p = ""; arr.forEach((v, i) => { if (v != null) p += (p ? "L" : "M") + X(m.dates[i]).toFixed(1) + "," + Y(v).toFixed(1); }); el("path", Object.assign({ d: p, fill: "none", "stroke-linejoin": "round" }, attrs), svg); };
      path(m.bench, { stroke: C.bench, "stroke-width": 1.2 });
      path(m.total, { stroke: C.ink, "stroke-width": 1.8 });
      if (d.live) {  // live record starts here: a short tick and a dot on the last point
        const lx = X(G.x1), ly = Y(m.total[m.total.length - 1]);
        el("line", { x1: lx, x2: lx, y1: ly - 12, y2: ly + 12, stroke: C.live, "stroke-width": 1.5 }, svg);
        el("circle", { cx: lx, cy: ly, r: 3, fill: C.live }, svg);
      }
      // direct labels at the line ends
      const a = { v: m.total[m.total.length - 1], c: C.ink, w: 600 }, b = { v: m.bench[m.bench.length - 1], c: C.bench, w: 500 };
      let ya = Y(a.v), yb = Y(b.v);
      if (Math.abs(ya - yb) < 13) { if (ya < yb) { ya -= (13 - (yb - ya)) / 2; yb = ya + 13; } else { yb -= (13 - (ya - yb)) / 2; ya = yb + 13; } }
      txt(svg, Math.round(a.v), { x: W - mg.r + 6, y: ya + 4, fill: a.c, "font-weight": a.w });
      txt(svg, Math.round(b.v), { x: W - mg.r + 6, y: yb + 4, fill: b.c, "font-weight": b.w });
    });
    draw();
    let r; window.addEventListener("resize", () => { clearTimeout(r); r = setTimeout(draw, 120); });
  }

  // ---------- design page: one large chart ----------
  const box = document.getElementById("nav-chart"), dataEl = document.getElementById("design-data");
  if (!box || !dataEl) return;
  const D = JSON.parse(dataEl.textContent), dates = D.series.dates, n = dates.length, lines = D.lines;
  let range = "ALL";
  const startIndex = () => {
    const last = new Date(dates[n - 1]); let from = null;
    if (range === "1Y") from = new Date(last.getFullYear() - 1, last.getMonth(), last.getDate());
    if (range === "3Y") from = new Date(last.getFullYear() - 3, last.getMonth(), last.getDate());
    if (range === "YTD") from = new Date(last.getFullYear(), 0, 1);
    return from ? Math.max(0, dates.findIndex((s) => new Date(s) >= from)) : 0;
  };

  function draw() {
    box.querySelectorAll("svg").forEach((s) => s.remove());
    const W = Math.max(320, box.clientWidth), narrow = W < 640, H = narrow ? Math.round(W * 0.78) : Math.round(Math.min(520, W * 0.42));
    const m = { l: 0, r: narrow ? 84 : 112, t: 26, b: 28 }, i0 = startIndex();
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": D.chartLabel }, box);
    const ser = lines.map((L) => { const v = D.series[L.key], b = v[i0]; return v.map((x) => (x == null ? null : (x / b) * 100)); });
    let lo = Infinity, hi = -Infinity;
    ser.forEach((s) => { for (let i = i0; i < n; i++) if (s[i] != null) { lo = Math.min(lo, s[i]); hi = Math.max(hi, s[i]); } });
    const logScale = hi / lo > 2.2, f = logScale ? Math.log : (v) => v, pad = (f(hi) - f(lo)) * 0.06;
    const y0 = f(lo) - pad, y1 = f(hi) + pad;
    const pending = D.live_start && D.live_start > dates[n - 1];
    const xa = t(dates[i0]), xb = t(dates[n - 1]) + (pending ? (t(dates[n - 1]) - xa) * 0.012 : 0);
    const X = (i) => m.l + ((t(dates[i]) - xa) / (xb - xa)) * (W - m.l - m.r);
    const Y = (v) => m.t + (1 - (f(v) - y0) / (y1 - y0)) * (H - m.t - m.b);
    const ends = ser.map((s, k) => ({ k, v: s[n - 1], y: Y(s[n - 1]) })).filter((e) => e.v != null).sort((a, b) => a.y - b.y);
    for (let j = 1; j < ends.length; j++) if (ends[j].y - ends[j - 1].y < 16) ends[j].y = ends[j - 1].y + 16;
    const ticks = logScale ? logTicks(lo, hi) : linTicks(lo, hi);
    if (lo < 100 && hi > 100 && !ticks.includes(100)) ticks.push(100);  // the value-of-100 reference is always drawn
    ticks.forEach((v) => {
      el("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), stroke: v === 100 ? C.rule : C.grid, "stroke-dasharray": v === 100 ? "3 3" : "" }, svg);
      if (!ends.some((e) => Math.abs(e.y - Y(v)) < 24)) txt(svg, v, { x: W - m.r + 8, y: Y(v) + 4 });
    });
    el("line", { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, stroke: C.ink3 }, svg);
    const span = n - 1 - i0; let last = "";
    for (let i = i0 + 1; i < n; i++) {
      const [y, mo] = dates[i].split("-"), yearly = span > 500;
      const lbl = yearly ? y : `${MON[+mo - 1]} ${y.slice(2)}`;
      const every = narrow ? (span > 260 ? 6 : 3) : (span > 260 ? 3 : 2);
      if (lbl !== last && (yearly ? (!narrow || +y % 2 === 0) : (+mo - 1) % every === 0)) {
        el("line", { x1: X(i), x2: X(i), y1: H - m.b, y2: H - m.b + 5, stroke: C.ink3 }, svg);
        txt(svg, lbl, { x: X(i) + 3, y: H - 8 });
      }
      last = lbl;
    }
    (D.segments || []).forEach((s, k) => {
      const i = dates.indexOf(s.start);
      if (k > 0 && i > i0) el("line", { x1: X(i), x2: X(i), y1: m.t - 8, y2: H - m.b, stroke: C.bench, "stroke-dasharray": "2 4" }, svg);
      if ((i >= i0 || k === 0) && !(narrow && k > 0)) txt(svg, s.short.toUpperCase(), { x: (k === 0 ? Math.max(m.l, X(Math.max(i, i0))) : X(i) + 6), y: 14, "font-family": MONO, "font-size": 11, "letter-spacing": "0.5" });
    });
    if (D.live_start) {
      const li = dates.indexOf(D.live_start), x = li >= 0 ? X(li) : X(n - 1) + 3;
      el("line", { x1: x, x2: x, y1: m.t - 8, y2: H - m.b, stroke: C.live, "stroke-width": 1.5 }, svg);
      txt(svg, `LIVE FROM ${fmtDate(D.live_start).toUpperCase()}`, { x: x - 6, y: narrow ? 30 : 14, "text-anchor": "end", fill: C.live, "font-family": MONO, "font-size": 11, "font-weight": 600 });
    }
    ser.forEach((s, k) => {
      const L = lines[k]; let p = "";
      for (let i = i0; i < n; i++) if (s[i] != null) p += (p ? "L" : "M") + X(i).toFixed(1) + "," + Y(s[i]).toFixed(1);
      el("path", { d: p, fill: "none", stroke: L.color, "stroke-width": L.width, "stroke-dasharray": L.dash || "", "stroke-linejoin": "round" }, svg);
    });
    ends.forEach((e) => {
      el("line", { x1: W - m.r + 1, y1: Y(e.v), x2: W - m.r + 5, y2: e.y, stroke: lines[e.k].color }, svg);
      const nm = narrow && lines[e.k].key === "price" ? "Price" : lines[e.k].short;
      txt(svg, `${nm} ${Math.round(e.v)}`, { x: W - m.r + 8, y: e.y + 4, fill: lines[e.k].color, "font-weight": 600, "font-size": 13 });
    });
    const ro = box.querySelector(".readout"), cross = el("line", { y1: m.t - 8, y2: H - m.b, stroke: C.ink, "stroke-opacity": 0.3, visibility: "hidden" }, svg);
    const move = (ev) => {
      const r = svg.getBoundingClientRect(), px = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) * (W / r.width);
      const tt = xa + ((px - m.l) / (W - m.l - m.r)) * (xb - xa);
      let i = dates.findIndex((s) => t(s) >= tt); if (i < 0) i = n - 1; i = Math.max(i0, i);
      cross.setAttribute("x1", X(i)); cross.setAttribute("x2", X(i)); cross.setAttribute("visibility", "visible");
      ro.innerHTML = `<i>${fmtDate(dates[i])}</i><br>` + lines.map((L, k) => `${L.label}: <b>${ser[k][i] == null ? "–" : ser[k][i].toFixed(1)}</b>`).join("<br>");
      ro.style.display = "block";
    };
    svg.addEventListener("mousemove", move); svg.addEventListener("touchmove", move, { passive: true });
    svg.addEventListener("mouseleave", () => { ro.style.display = "none"; cross.setAttribute("visibility", "hidden"); });
  }
  document.querySelectorAll(".ranges button").forEach((b) => b.addEventListener("click", () => {
    range = b.dataset.r; document.querySelectorAll(".ranges button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); draw();
  }));
  draw();
  let r; window.addEventListener("resize", () => { clearTimeout(r); r = setTimeout(() => { draw(); bars(); }, 120); });

  // monthly cash bars
  const cb = document.getElementById("cash-chart");
  function bars() {
    if (!cb || !D.monthly_cash) return;
    cb.querySelectorAll("svg").forEach((s) => s.remove());
    const keys = Object.keys(D.monthly_cash), vals = keys.map((k) => D.monthly_cash[k]);
    const W = Math.max(320, cb.clientWidth), narrow = W < 640, H = narrow ? 130 : 150, m = { l: 0, r: narrow ? 58 : 112, t: 10, b: 28 };
    const mx = Math.max(...vals) * 1.08, bw = (W - m.l - m.r) / keys.length;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Cash distributions received per month per $100,000" }, cb);
    const bt = linTicks(0, mx).filter((v) => v > 0);
    bt.filter((v, i) => bt.length <= 3 || i % 2 === 1).forEach((v) => {
      const y = m.t + (1 - v / mx) * (H - m.t - m.b);
      el("line", { x1: m.l, x2: W - m.r, y1: y, y2: y, stroke: C.grid }, svg);
      txt(svg, "$" + v.toLocaleString("en-US"), { x: W - m.r + 8, y: y + 4 });
    });
    el("line", { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, stroke: C.ink3 }, svg);
    let lastY = "";
    keys.forEach((k, i) => {
      const h = (vals[i] / mx) * (H - m.t - m.b), isLast = i === keys.length - 1;
      el("rect", isLast  // the current month is partial: outlined, not filled
        ? { x: m.l + i * bw + bw * 0.3 + 0.5, y: H - m.b - h + 0.5, width: Math.max(1, bw * 0.4 - 1), height: Math.max(0, h - 1), fill: "none", stroke: C.ink, "stroke-width": 1 }
        : { x: m.l + i * bw + bw * 0.3, y: H - m.b - h, width: Math.max(1, bw * 0.4), height: h, fill: C.ink, "fill-opacity": 0.7 }, svg);
      const [yy, mm] = k.split("-"), many = keys.length > 60;
      const take = many ? yy !== lastY : (+mm - 1) % (narrow ? 6 : 3) === 0;
      if (take && i > 0) txt(svg, many ? yy : `${MON[+mm - 1]} ${yy.slice(2)}`, { x: m.l + i * bw + 2, y: H - 8 });
      lastY = yy;
    });
  }
  bars();
})();

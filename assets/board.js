(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const C = { amber: "#ffb000", white: "#eceae4", steel: "#9db0c1", dim: "#8b96a0", rule: "#2b2f33", live: "#ef5aae", grid: "#23272b" };
  const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const fmtDate = (s) => { const [y, m, d] = s.split("-"); return `${+d} ${MON[+m - 1]} ${y}`; };
  const el = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };

  // home rows are links
  document.querySelectorAll("tr.row[data-href]").forEach((tr) => tr.addEventListener("click", (e) => {
    if (e.target.closest("a")) return; location.href = tr.dataset.href;
  }));

  const box = document.getElementById("nav-chart");
  const dataEl = document.getElementById("design-data");
  if (!box || !dataEl) return;
  const D = JSON.parse(dataEl.textContent);
  const dates = D.series.dates;
  const lines = D.lines; // [{key,label,color,width,dash}]
  let range = "ALL";

  function startIndex() {
    const last = new Date(dates[dates.length - 1]);
    let from = null;
    if (range === "1Y") from = new Date(last.getFullYear() - 1, last.getMonth(), last.getDate());
    if (range === "3Y") from = new Date(last.getFullYear() - 3, last.getMonth(), last.getDate());
    if (range === "YTD") from = new Date(last.getFullYear(), 0, 1);
    if (!from) return 0;
    const i = dates.findIndex((d) => new Date(d) >= from);
    return Math.max(0, i);
  }

  function draw() {
    box.querySelectorAll("svg").forEach((s) => s.remove());
    const W = Math.max(320, box.clientWidth), H = W < 600 ? 300 : 420;
    const narrow = W < 600;
    const m = { l: 12, r: narrow ? 52 : 92, t: 34, b: 30 };
    const i0 = startIndex(), n = dates.length;
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": D.chartLabel });
    box.appendChild(svg);
    // values rebased to 100 at the window start
    const ser = lines.map((L) => { const v = D.series[L.key]; const b = v[i0]; return v.map((x) => (x == null ? null : (x / b) * 100)); });
    let lo = Infinity, hi = -Infinity;
    ser.forEach((s) => { for (let i = i0; i < n; i++) if (s[i] != null) { lo = Math.min(lo, s[i]); hi = Math.max(hi, s[i]); } });
    const logScale = hi / lo > 2.2;
    const f = logScale ? Math.log : (x) => x;
    const pad = (f(hi) - f(lo)) * 0.06;
    const y0 = f(lo) - pad, y1 = f(hi) + pad;
    // before the first live close, leave a short empty zone after the last backtest day for the live record
    const pending = D.live_start && D.live_start > dates[n - 1];
    const fut = pending ? Math.max(3, Math.round(0.015 * (n - 1 - i0))) : 0;
    const X = (i) => m.l + ((i - i0) / Math.max(1, n - 1 - i0 + fut)) * (W - m.l - m.r);
    const Y = (v) => m.t + (1 - (f(v) - y0) / (y1 - y0)) * (H - m.t - m.b);
    // grid + y ticks
    const ticks = [];
    if (logScale) { [50, 70, 100, 150, 200, 300, 500, 700, 1000, 1500, 2000].forEach((t) => { if (t >= lo * 0.95 && t <= hi * 1.05) ticks.push(t); }); }
    else { const step = niceStep((hi - lo) / 4); for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t); }
    // end-of-line values (nudged apart); axis numbers that would collide with them are skipped
    const ends = ser.map((s, k) => ({ k, v: s[n - 1], y: Y(s[n - 1]) })).filter((e) => e.v != null).sort((a, b) => a.y - b.y);
    for (let j = 1; j < ends.length; j++) if (ends[j].y - ends[j - 1].y < 15) ends[j].y = ends[j - 1].y + 15;
    ticks.forEach((t) => {
      el("line", { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), stroke: t === 100 ? C.dim : C.grid, "stroke-width": 1, "stroke-dasharray": t === 100 ? "3 4" : "" }, svg);
      if (ends.some((e) => Math.abs(e.y - Y(t)) < 18)) return;
      const tx = el("text", { x: W - m.r + 10, y: Y(t) + 4, fill: C.dim, "font-size": 12, "font-family": "B612, sans-serif" }, svg); tx.textContent = Math.round(t);
    });
    // x ticks: years (or months for short windows)
    const span = n - 1 - i0;
    let lastLbl = "";
    for (let i = i0; i < n; i++) {
      const [y, mo] = dates[i].split("-");
      const lbl = span > 500 ? y : `${MON[+mo - 1]} ${y.slice(2)}`;
      const take = span > 500 ? lbl !== lastLbl && i > i0 : lbl !== lastLbl && (+mo - 1) % (span > 260 ? 3 : 2) === 0 && i > i0;
      if (take) {
        el("line", { x1: X(i), x2: X(i), y1: H - m.b, y2: H - m.b + 5, stroke: C.dim }, svg);
        const t = el("text", { x: X(i) + 3, y: H - 8, fill: C.dim, "font-size": 12, "font-family": "B612, sans-serif" }, svg); t.textContent = lbl;
      }
      lastLbl = lbl;
    }
    // segment boundaries + labels
    (D.segments || []).forEach((s, k) => {
      const i = dates.indexOf(s.start);
      if (k > 0 && i > i0) { el("line", { x1: X(i), x2: X(i), y1: m.t - 10, y2: H - m.b, stroke: C.steel, "stroke-dasharray": "2 4" }, svg); }
      const x = k === 0 ? Math.max(m.l + 6, X(Math.max(i, i0)) + 6) : X(i) + 6;
      if ((i >= i0 || k === 0) && !(narrow && D.live_start)) { const t = el("text", { x, y: m.t - 14, fill: C.steel, "font-size": 12, "font-family": "B612 Mono, monospace", "letter-spacing": "1" }, svg); t.textContent = s.short.toUpperCase(); }
    });
    // live marker
    if (D.live_start) {
      const li = dates.indexOf(D.live_start);
      const x = li >= 0 ? X(li) : X(n - 1) + 3;
      el("line", { x1: x, x2: x, y1: m.t - 10, y2: H - m.b, stroke: C.live, "stroke-width": 2 }, svg);
      // small label at the foot of the live line
      const t = el("text", { x: x - 6, y: narrow ? m.t - 14 : H - m.b - 8, fill: C.live, "font-size": 12, "font-family": "B612 Mono, monospace", "text-anchor": "end", "font-weight": 700 }, svg);
      t.textContent = `LIVE FROM ${fmtDate(D.live_start)}`;
    }
    // lines
    ser.forEach((s, k) => {
      const L = lines[k]; let d = "";
      for (let i = i0; i < n; i++) if (s[i] != null) d += (d ? "L" : "M") + X(i).toFixed(1) + "," + Y(s[i]).toFixed(1);
      el("path", { d, fill: "none", stroke: L.color, "stroke-width": L.width || 1.5, "stroke-dasharray": L.dash || "", "stroke-linejoin": "round" }, svg);
    });
    ends.forEach((e) => {
      const y = Y(e.v);
      el("line", { x1: W - m.r + 1, y1: y, x2: W - m.r + 7, y2: e.y, stroke: lines[e.k].color, "stroke-width": 1 }, svg);  // leader tick
      const t = el("text", { x: W - m.r + 10, y: e.y + 4, fill: lines[e.k].color, "font-size": 12, "font-weight": 700, "font-family": "B612, sans-serif" }, svg); t.textContent = e.v.toFixed(0);
    });
    // hover
    const ro = box.querySelector(".readout");
    const cross = el("line", { y1: m.t - 10, y2: H - m.b, stroke: C.white, "stroke-opacity": 0.35, visibility: "hidden" }, svg);
    const move = (ev) => {
      const r = svg.getBoundingClientRect(); const px = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) * (W / r.width);
      const i = Math.min(n - 1, Math.max(i0, Math.round(i0 + ((px - m.l) / (W - m.l - m.r)) * (n - 1 - i0 + fut))));
      cross.setAttribute("x1", X(i)); cross.setAttribute("x2", X(i)); cross.setAttribute("visibility", "visible");
      ro.innerHTML = `<i>${fmtDate(dates[i])}</i><br>` + lines.map((L, k) => `<span style="color:${L.color}">${L.label}</span> <b>${ser[k][i] == null ? "–" : ser[k][i].toFixed(1)}</b>`).join("<br>");
      ro.style.display = "block";
    };
    svg.addEventListener("mousemove", move); svg.addEventListener("touchmove", move, { passive: true });
    svg.addEventListener("mouseleave", () => { ro.style.display = "none"; cross.setAttribute("visibility", "hidden"); });
  }

  function niceStep(x) { const p = Math.pow(10, Math.floor(Math.log10(x))); const r = x / p; return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * p; }

  document.querySelectorAll(".ranges button").forEach((b) => b.addEventListener("click", () => {
    range = b.dataset.r; document.querySelectorAll(".ranges button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); draw();
  }));
  draw();
  let t; window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(draw, 120); });

  // monthly cash bars
  const cb = document.getElementById("cash-chart");
  if (cb && D.monthly_cash) {
    const drawBars = () => {
      cb.querySelectorAll("svg").forEach((s) => s.remove());
      const keys = Object.keys(D.monthly_cash), vals = keys.map((k) => D.monthly_cash[k]);
      const W = Math.max(320, cb.clientWidth), H = W < 600 ? 190 : 230, m = { l: 12, r: W < 600 ? 64 : 92, t: 16, b: 28 };
      const mx = Math.max(...vals) * 1.08;
      const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Cash distributions received per month per $100,000" }, cb);
      const bw = (W - m.l - m.r) / keys.length;
      const step = niceStep(mx / 3);
      for (let v = step; v < mx; v += step) {
        const y = m.t + (1 - v / mx) * (H - m.t - m.b);
        el("line", { x1: m.l, x2: W - m.r, y1: y, y2: y, stroke: C.grid }, svg);
        const tx = el("text", { x: W - m.r + 10, y: y + 4, fill: C.dim, "font-size": 12, "font-family": "B612, sans-serif" }, svg); tx.textContent = "$" + v.toLocaleString("en-US");
      }
      let last = "";
      keys.forEach((k, i) => {
        const h = (vals[i] / mx) * (H - m.t - m.b);
        el("rect", { x: m.l + i * bw + bw * 0.22, y: H - m.b - h, width: Math.max(1, bw * 0.56), height: h, fill: i === keys.length - 1 ? C.amber : C.steel, "fill-opacity": i === keys.length - 1 ? 1 : 0.75 }, svg);
        const [yy, mm] = k.split("-");
        const lbl = keys.length > 60 ? yy : `${MON[+mm - 1]} ${yy.slice(2)}`;
        const take = keys.length > 60 ? yy !== last : (+mm - 1) % (W < 600 ? 6 : 3) === 0;
        if (take && i > 0) {
          el("line", { x1: m.l + i * bw, x2: m.l + i * bw, y1: H - m.b, y2: H - m.b + 5, stroke: C.dim }, svg);
          const t = el("text", { x: m.l + i * bw + 3, y: H - 8, fill: C.dim, "font-size": 12, "font-family": "B612, sans-serif" }, svg); t.textContent = lbl;
        }
        last = yy;
      });
    };
    drawBars();
    window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(drawBars, 140); });
  }
})();

/* ═══════════════════════════════════════════
   SMART WASTE ROUTE OPTIMIZER — SCRIPT.JS
   TSP with Lambda-Weighted Cost Function
═══════════════════════════════════════════ */

'use strict';

/* ────────────────────────────────────────
   DATA DEFINITIONS
──────────────────────────────────────── */

// Zone labels
const ZONES = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6'];
const ZONE_NAMES = ['Depot / Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5', 'Zone 6'];

// Distance matrix (0-indexed, symmetric)
const DIST = [
  [0, 5, 6, 8, 9, 7],
  [5, 0, 9, 4, 8, 6],
  [6, 9, 0, 7, 8, 7],
  [8, 4, 7, 0, 6, 9],
  [9, 8, 8, 6, 0, 5],
  [7, 6, 7, 9, 5, 0]
];

// Delay matrix (0-indexed, symmetric)
const DELAY = [
  [0, 2, 2, 3, 4, 3],
  [2, 0, 4, 3, 3, 2],
  [2, 4, 0, 3, 3, 3],
  [3, 3, 3, 0, 2, 4],
  [4, 3, 3, 2, 0, 4],
  [3, 2, 3, 4, 4, 0]
];

// Optimal result for lambda=1
const HARDCODED_ROUTE = [0, 1, 3, 4, 5, 2, 0]; // 1-indexed: 1→2→4→5→6→3→1
const HARDCODED_COST  = 49;

// Optimal route edges (0-indexed pairs)
const OPTIMAL_EDGES = [
  [0, 1], [1, 3], [3, 4], [4, 5], [5, 2], [2, 0]
];

/* ────────────────────────────────────────
   NODE POSITIONS for SVG (620 × 500)
──────────────────────────────────────── */
const NODE_POS = [
  { x: 310, y:  70 },  // Zone 1 — top center (depot)
  { x: 520, y: 180 },  // Zone 2 — right
  { x: 460, y: 400 },  // Zone 3 — right-bottom
  { x: 310, y: 440 },  // Zone 4 — bottom center
  { x: 150, y: 390 },  // Zone 5 — left-bottom
  { x:  90, y: 185 },  // Zone 6 — left
];

/* ────────────────────────────────────────
   TSP BRUTE FORCE (n=6, (n-1)! = 120)
──────────────────────────────────────── */
function computeCostMatrix(lambda) {
  return DIST.map((row, i) =>
    row.map((d, j) => (i === j ? Infinity : d + lambda * DELAY[i][j]))
  );
}

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const perm of permutations(rest)) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}

function tspBruteForce(lambda) {
  const cost = computeCostMatrix(lambda);
  const nodes = [1, 2, 3, 4, 5]; // nodes to permute (0-indexed, excluding depot 0)
  const perms  = permutations(nodes);

  let bestCost  = Infinity;
  let bestRoute = null;

  for (const perm of perms) {
    const route = [0, ...perm, 0];
    let totalCost = 0;
    for (let k = 0; k < route.length - 1; k++) {
      totalCost += cost[route[k]][route[k + 1]];
    }
    if (totalCost < bestCost) {
      bestCost  = totalCost;
      bestRoute = route;
    }
  }

  return { route: bestRoute, cost: Math.round(bestCost * 100) / 100 };
}

/* ────────────────────────────────────────
   EDGE LABEL POSITION helper
──────────────────────────────────────── */
function edgeLabelPos(p1, p2) {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2
  };
}

/* ────────────────────────────────────────
   SVG GRAPH RENDERER
──────────────────────────────────────── */
function isOptimalEdge(i, j, optEdges) {
  return optEdges.some(([a, b]) =>
    (a === i && b === j) || (a === j && b === i)
  );
}

function renderGraph(optEdges) {
  const svg = document.getElementById('graphSVG');
  // Clear previous dynamic content (preserve defs)
  [...svg.children].forEach(c => {
    if (c.tagName !== 'defs') c.remove();
  });

  const NS = 'http://www.w3.org/2000/svg';
  const n  = NODE_POS.length;

  /* ── Draw all background edges ── */
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const p1 = NODE_POS[i], p2 = NODE_POS[j];
      const optimal = isOptimalEdge(i, j, optEdges);

      if (!optimal) {
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', p1.x);
        line.setAttribute('y1', p1.y);
        line.setAttribute('x2', p2.x);
        line.setAttribute('y2', p2.y);
        line.setAttribute('class', 'svg-edge');
        svg.appendChild(line);

        // label
        const lp = edgeLabelPos(p1, p2);
        const labelText = `${DIST[i][j]}/${DELAY[i][j]}`;
        addEdgeLabel(svg, NS, lp.x, lp.y, labelText, false);
      }
    }
  }

  /* ── Draw optimal edges on top (animated) ── */
  optEdges.forEach(([i, j], idx) => {
    const p1 = NODE_POS[i], p2 = NODE_POS[j];

    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', p1.x);
    line.setAttribute('y1', p1.y);
    line.setAttribute('x2', p2.x);
    line.setAttribute('y2', p2.y);
    line.setAttribute('class', 'svg-edge-optimal');
    // staggered delay per edge
    line.style.animationDelay = `${idx * 0.18 + 0.3}s`;
    svg.appendChild(line);

    const lp = edgeLabelPos(p1, p2);
    const labelText = `${DIST[i][j]}/${DELAY[i][j]}`;
    addEdgeLabel(svg, NS, lp.x, lp.y, labelText, true, idx);
  });

  /* ── Draw nodes ── */
  NODE_POS.forEach((pos, idx) => {
    const inOptimal = optEdges.some(([a, b]) => a === idx || b === idx);

    // circle
    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('cx', pos.x);
    circle.setAttribute('cy', pos.y);
    circle.setAttribute('r', 22);
    circle.setAttribute('class', `svg-node-circle${inOptimal ? ' optimal' : ''}`);
    circle.style.animationDelay = `${idx * 0.1}s`;
    svg.appendChild(circle);

    // zone number
    const label = document.createElementNS(NS, 'text');
    label.setAttribute('x', pos.x);
    label.setAttribute('y', pos.y);
    label.setAttribute('class', `svg-node-label${inOptimal ? ' optimal' : ''}`);
    label.textContent = idx + 1;
    svg.appendChild(label);

    // zone tag below node
    const tag = document.createElementNS(NS, 'text');
    tag.setAttribute('x', pos.x);
    tag.setAttribute('y', pos.y + 35);
    tag.setAttribute('class', 'svg-zone-tag');
    tag.textContent = idx === 0 ? 'DEPOT' : `Zone ${idx + 1}`;
    svg.appendChild(tag);
  });
}

function addEdgeLabel(svg, NS, x, y, text, isOpt, delay = 0) {
  const g = document.createElementNS(NS, 'g');

  const bg = document.createElementNS(NS, 'rect');
  const pad = 3;
  const w = text.length * 5.8 + pad * 2;
  const h = 14;
  bg.setAttribute('x', x - w / 2);
  bg.setAttribute('y', y - h / 2);
  bg.setAttribute('width', w);
  bg.setAttribute('height', h);
  bg.setAttribute('rx', 3);
  bg.setAttribute('fill', isOpt ? '#0d2a1a' : '#0d1220');
  bg.setAttribute('stroke', isOpt ? '#00ff8840' : '#1e2d4a');
  bg.setAttribute('stroke-width', '0.5');
  g.appendChild(bg);

  const lbl = document.createElementNS(NS, 'text');
  lbl.setAttribute('x', x);
  lbl.setAttribute('y', y + 0.5);
  lbl.setAttribute('class', 'svg-edge-label');
  lbl.setAttribute('fill', isOpt ? '#00ff88' : '#5a7090');
  lbl.textContent = text;
  if (isOpt) {
    lbl.style.animationDelay = `${delay * 0.18 + 0.6}s`;
  }
  g.appendChild(lbl);

  svg.appendChild(g);
}

/* ────────────────────────────────────────
   COST MATRIX TABLE RENDERER
──────────────────────────────────────── */
function renderMatrix(lambda, optEdges) {
  const costMatrix = computeCostMatrix(lambda);
  const wrap = document.getElementById('matrixWrap');

  let html = '<table class="matrix-table"><thead><tr><th>→</th>';
  for (let j = 0; j < 6; j++) html += `<th>Z${j + 1}</th>`;
  html += '</tr></thead><tbody>';

  for (let i = 0; i < 6; i++) {
    html += `<tr><th>Z${i + 1}</th>`;
    for (let j = 0; j < 6; j++) {
      if (i === j) {
        html += '<td class="diagonal">—</td>';
      } else {
        const opt = isOptimalEdge(i, j, optEdges);
        const val  = costMatrix[i][j].toFixed(1).replace('.0', '');
        html += `<td class="${opt ? 'optimal-cell' : ''}">${val}</td>`;
      }
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  wrap.innerHTML = html;

  document.getElementById('matrixLambda').textContent = lambda;
}

/* ────────────────────────────────────────
   RESULT BREAKDOWN RENDERER
──────────────────────────────────────── */
function renderBreakdown(route, lambda) {
  const grid = document.getElementById('breakdownGrid');
  let html   = '';
  let total  = 0;

  for (let k = 0; k < route.length - 1; k++) {
    const i = route[k], j = route[k + 1];
    const d = DIST[i][j], t = DELAY[i][j];
    const c = d + lambda * t;
    total   += c;
    html    += `
      <div class="breakdown-item" style="animation-delay:${k * 0.07}s">
        <span class="b-edge">Z${i+1} → Z${j+1} · ${d}d + ${lambda}×${t}</span>
        <span class="b-cost">= ${c.toFixed(1).replace('.0','')}</span>
      </div>`;
  }

  grid.innerHTML = html;
  document.getElementById('lambdaNote').textContent =
    `λ = ${lambda} · Total Cost = ${total.toFixed(2).replace('.00','').replace(/\.0$/,'')} units`;
}

/* ────────────────────────────────────────
   CALCULATE BUTTON HANDLER
──────────────────────────────────────── */
function runCalculation() {
  const lambdaRaw = parseFloat(document.getElementById('lambda').value);
  const lambda    = isNaN(lambdaRaw) || lambdaRaw < 0 ? 1 : lambdaRaw;

  // Show loading state
  document.getElementById('outputLoading').style.display = 'flex';
  document.getElementById('outputResult').style.display  = 'none';

  setTimeout(() => {
    const { route, cost } = tspBruteForce(lambda);

    // Build optimal edge pairs from result route
    const edges = [];
    for (let k = 0; k < route.length - 1; k++) {
      edges.push([route[k], route[k + 1]]);
    }

    // Update result UI
    const routeDiv = document.getElementById('resultRoute');
    routeDiv.innerHTML = '';
    route.forEach((z, idx) => {
      const span = document.createElement('span');
      span.className = `zone-node${idx === route.length - 1 ? ' return' : ''}`;
      span.style.animationDelay = `${idx * 0.08}s`;
      span.textContent = z + 1;
      routeDiv.appendChild(span);
      if (idx < route.length - 1) {
        const arrow = document.createElement('span');
        arrow.className = 'route-arrow';
        arrow.style.animationDelay = `${idx * 0.08 + 0.04}s`;
        arrow.textContent = '→';
        routeDiv.appendChild(arrow);
      }
    });

    document.getElementById('resultCost').innerHTML =
      `<span class="cost-num">${cost}</span><span class="cost-unit">units</span>`;

    renderBreakdown(route, lambda);
    renderGraph(edges);
    renderMatrix(lambda, edges);

    document.getElementById('outputLoading').style.display = 'none';
    document.getElementById('outputResult').style.display  = 'flex';

    // Scroll to graph
    setTimeout(() => {
      document.getElementById('graph').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 600);
  }, 900);
}

/* ────────────────────────────────────────
   LAMBDA INPUT SYNC
──────────────────────────────────────── */
function syncLambda() {
  const input  = document.getElementById('lambda');
  const slider = document.getElementById('lambdaSlider');

  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    if (!isNaN(v) && v >= 0 && v <= 5) slider.value = v;
  });

  slider.addEventListener('input', () => {
    input.value = slider.value;
  });
}

/* ────────────────────────────────────────
   NAV — scroll effect + hamburger
──────────────────────────────────────── */
function initNav() {
  const navbar    = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.querySelector('.nav-links');

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  });

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navLinks.classList.toggle('open');
  });

  // close menu on link click
  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      hamburger.classList.remove('open');
      navLinks.classList.remove('open');
    });
  });
}

/* ────────────────────────────────────────
   SCROLL REVEAL
──────────────────────────────────────── */
function initScrollReveal() {
  const cards = document.querySelectorAll('.theory-card, .calc-card, .output-panel');
  cards.forEach(c => c.classList.add('reveal'));

  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  cards.forEach(c => observer.observe(c));
}

/* ────────────────────────────────────────
   INITIAL RENDER (default λ=1)
──────────────────────────────────────── */
function initDefault() {
  const lambda = 1;
  const edges  = OPTIMAL_EDGES;

  // Pre-fill output with default hardcoded result
  const routeDiv = document.getElementById('resultRoute');
  routeDiv.innerHTML = '';
  HARDCODED_ROUTE.forEach((z, idx) => {
    const span = document.createElement('span');
    span.className = `zone-node${idx === HARDCODED_ROUTE.length - 1 ? ' return' : ''}`;
    span.style.animationDelay = `${idx * 0.1}s`;
    span.textContent = z + 1;
    routeDiv.appendChild(span);
    if (idx < HARDCODED_ROUTE.length - 1) {
      const arrow = document.createElement('span');
      arrow.className = 'route-arrow';
      arrow.textContent = '→';
      routeDiv.appendChild(arrow);
    }
  });

  document.getElementById('resultCost').innerHTML =
    `<span class="cost-num">${HARDCODED_COST}</span><span class="cost-unit">units</span>`;

  renderBreakdown(HARDCODED_ROUTE, lambda);
  renderGraph(edges);
  renderMatrix(lambda, edges);

  // Show result immediately on page load
  document.getElementById('outputLoading').style.display = 'none';
  document.getElementById('outputResult').style.display  = 'flex';
}

/* ────────────────────────────────────────
   BOOT
──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  syncLambda();
  initDefault();
  initScrollReveal();

  document.getElementById('calcBtn').addEventListener('click', runCalculation);

  // also allow Enter key in input
  document.getElementById('lambda').addEventListener('keydown', e => {
    if (e.key === 'Enter') runCalculation();
  });
});

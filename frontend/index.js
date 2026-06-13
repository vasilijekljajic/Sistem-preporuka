const API = "http://localhost:8000";
let cart = [];
let maxScore = 1;

function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById(`page-${id}`).classList.add('active');
  btn.classList.add('active');
  if (id === 'graph') loadGraph();
}

let searchTimer = null;
const searchInput = document.getElementById('search-input');
const dropdown = document.getElementById('search-dropdown');

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = searchInput.value.trim();
  if (q.length < 2) {
    dropdown.classList.remove('open');
    return;
  }
  searchTimer = setTimeout(() => searchProducts(q), 300);
});

searchInput.addEventListener('blur', () => {
  setTimeout(() => dropdown.classList.remove('open'), 150);
});

async function searchProducts(q) {
  try {
    const r = await fetch(`${API}/products/search?q=${encodeURIComponent(q)}&limit=10`);
    const data = await r.json();
    renderDropdown(data.products);
  } catch (e) {
    dropdown.classList.remove('open');
  }
}

function renderDropdown(items) {
  if (!items.length) {
    dropdown.classList.remove('open');
    return;
  }
  dropdown.innerHTML = '';
  items.forEach(({ product_id, product_name }) => {
    const div = document.createElement('div');
    div.className = 'dropdown-item';
    div.innerHTML = `<span>${product_name}</span><span class="pid">#${product_id}</span>`;
    div.onclick = () => addToCart(product_id, product_name);
    dropdown.appendChild(div);
  });
  dropdown.classList.add('open');
}

function addToCart(pid, name) {
  if (cart.some(p => p.product_id === pid)) return;
  cart.push({ product_id: pid, product_name: name });
  searchInput.value = '';
  dropdown.classList.remove('open');
  renderCart();
  document.getElementById('empty-state').style.display = 'none';
}

function removeFromCart(pid) {
  cart = cart.filter(p => p.product_id !== pid);
  renderCart();
  if (!cart.length) document.getElementById('empty-state').style.display = 'block';
}

function renderCart() {
  const el = document.getElementById('cart-area');
  if (!cart.length) {
    el.innerHTML = '<span class="cart-empty">Korpa je prazna</span>';
    return;
  }
  el.innerHTML = '';
  cart.forEach(({ product_id, product_name }) => {
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `<span>${product_name}</span>`;
    
    const btn = document.createElement('button');
    btn.textContent = 'x';
    btn.title = 'Ukloni';
    btn.onclick = () => removeFromCart(product_id);
    
    div.appendChild(btn);
    el.appendChild(div);
  });
}

async function getRecommendations() {
  if (!cart.length) {
    showError('Dodajte barem jedan proizvod u korpu.');
    return;
  }

  setLoading(true);
  hideError();

  const body = {
    cart: cart.map(p => p.product_id),
    top_n: parseInt(document.getElementById('opt-topn').value),
    lift_threshold: parseFloat(document.getElementById('opt-lift').value),
    mmr_lambda: parseFloat(document.getElementById('opt-mmr').value),
  };

  try {
    const r = await fetch(`${API}/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    renderRecommendations(data.recommendations);
  } catch (e) {
    showError(`Greška: ${e.message}. Provjeri da li je server pokrenut.`);
  } finally {
    setLoading(false);
  }
}

function renderRecommendations(recs) {
  const section = document.getElementById('results-section');
  const label = document.getElementById('results-label');
  const grid = document.getElementById('rec-grid');

  if (!recs.length) {
    showError('Nema preporuka. Pokušaj smanjiti lift threshold.');
    section.style.display = 'none';
    return;
  }

  maxScore = Math.max(...recs.map(r => r.score));
  label.textContent = `${recs.length} preporuka za korpu s ${cart.length} proizvoda`;
  section.style.display = 'block';
  grid.innerHTML = '';

  recs.forEach((rec, i) => {
    const pct = (rec.score / maxScore * 100).toFixed(0);
    const sourceLabel = rec.source === 'fpgrowth' ? 'FP-Growth' : rec.source === 'als' ? 'ALS' : 'Hybrid';

    const card = document.createElement('div');
    card.className = 'rec-card';

    let metrics = '';
    if (rec.confidence != null) metrics += `<span>conf: ${(rec.confidence * 100).toFixed(0)}%</span>`;
    if (rec.lift != null)       metrics += `<span>lift: ${rec.lift.toFixed(2)}</span>`;
    if (rec.support != null)    metrics += `<span>sup: ${(rec.support * 100).toFixed(1)}%</span>`;
    metrics += `<span>score: ${rec.score.toFixed(3)}</span>`;

    card.innerHTML = `
      <div class="rec-header">
        <span class="rec-rank">#${i + 1}</span>
        <span class="rec-source source-${rec.source}">${sourceLabel}</span>
      </div>
      <div class="rec-name">${rec.product_name}</div>
      <div class="rec-explanation">"${rec.explanation}"</div>
      <div class="rec-metrics">${metrics}</div>
      <div class="score-bar"><div class="score-fill" style="width:${pct}%"></div></div>
    `;

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-add-cart';
    addBtn.textContent = '+ Dodaj u korpu';
    addBtn.onclick = () => addToCart(rec.product_id, rec.product_name);
    card.appendChild(addBtn);

    grid.appendChild(card);
  });
}

function setLoading(on) {
  const btn = document.getElementById('btn-rec');
  btn.disabled = on;
  btn.textContent = on ? 'Računam...' : 'Generiši preporuke';
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.style.display = 'block';
}

function hideError() {
  document.getElementById('error-msg').style.display = 'none';
}

async function loadGraph() {
  const minLift = parseFloat(document.getElementById('graph-lift').value);
  const limit = parseInt(document.getElementById('graph-limit').value);

  try {
    const r = await fetch(`${API}/rules?min_lift=${minLift}&limit=${limit}`);
    const data = await r.json();
    drawGraph(data.rules);
  } catch (e) {
    document.getElementById('graph-container').innerHTML =
      '<div class="empty-state"><p>Server nije dostupan.</p></div>';
  }
}

function drawGraph(rules) {
  const container = document.getElementById('graph-container');
  const svg = d3.select('#graph-svg');
  svg.selectAll('*').remove();

  const W = container.clientWidth;
  const H = 560;

  const nodesMap = new Map();
  const links = [];

  rules.forEach(rule => {
    rule.antecedents.forEach((pid, i) => {
      if (!nodesMap.has(pid)) {
        nodesMap.set(pid, { id: pid, name: rule.antecedent_names[i], type: 'ant', connections: 0 });
      }
      nodesMap.get(pid).connections++;
    });
    rule.consequents.forEach((pid, i) => {
      if (!nodesMap.has(pid)) {
        nodesMap.set(pid, { id: pid, name: rule.consequent_names[i], type: 'con', connections: 0 });
      }
    });
    links.push({
      source: rule.antecedents[0],
      target: rule.consequents[0],
      lift: rule.lift,
      confidence: rule.confidence,
      support: rule.support
    });
  });

  const nodes = Array.from(nodesMap.values());
  const liftExtent = d3.extent(links, d => d.lift);
  const liftScale = d3.scaleLinear().domain(liftExtent).range([1, 6]);
  const nodeScale = d3.scaleSqrt().domain([0, d3.max(nodes, d => d.connections)]).range([6, 20]);

  const tooltip = document.getElementById('tooltip');
  const ttTitle = document.getElementById('tt-title');
  const ttBody = document.getElementById('tt-body');

  const defs = svg.append('defs');
  defs.append('marker')
    .attr('id', 'arrow')
    .attr('viewBox', '0 -4 8 8')
    .attr('refX', 16)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-4L8,0L0,4')
    .attr('fill', '#aaa');

  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(120))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collision', d3.forceCollide(28));

  const positionTooltip = event => {
    tooltip.style.left = `${event.clientX + 14}px`;
    tooltip.style.top = `${event.clientY - 10}px`;
  };

  const link = svg.append('g').selectAll('line').data(links).join('line')
    .attr('stroke', '#ccc')
    .attr('stroke-width', d => liftScale(d.lift))
    .attr('marker-end', 'url(#arrow)')
    .on('mousemove', (event, d) => {
      tooltip.classList.add('visible');
      ttTitle.textContent = 'Pravilo';
      ttBody.innerHTML = `Lift: <b>${d.lift.toFixed(2)}</b><br>Confidence: <b>${(d.confidence * 100).toFixed(0)}%</b><br>Support: <b>${(d.support * 100).toFixed(1)}%</b>`;
      positionTooltip(event);
    })
    .on('mouseleave', () => tooltip.classList.remove('visible'));

  const node = svg.append('g').selectAll('g').data(nodes).join('g')
    .call(d3.drag()
      .on('start', (event, d) => {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      })
    );

  node.append('circle')
    .attr('r', d => nodeScale(d.connections))
    .attr('fill', d => d.type === 'ant' ? '#93c5fd' : '#86efac')
    .attr('stroke', d => d.type === 'ant' ? '#2c7be5' : '#16a34a')
    .attr('stroke-width', 2)
    .on('mousemove', (event, d) => {
      tooltip.classList.add('visible');
      ttTitle.textContent = d.name;
      ttBody.innerHTML = `ID: <b>${d.id}</b><br>Tip: <b>${d.type === 'ant' ? 'Antecedent' : 'Consequent'}</b><br>Veze: <b>${d.connections}</b>`;
      positionTooltip(event);
    })
    .on('mouseleave', () => tooltip.classList.remove('visible'));

  node.append('text')
    .text(d => d.name.length > 18 ? `${d.name.slice(0, 16)}…` : d.name)
    .attr('dy', d => nodeScale(d.connections) + 12)
    .attr('text-anchor', 'middle')
    .attr('fill', '#555')
    .attr('font-size', '10px')
    .attr('pointer-events', 'none');

  sim.on('tick', () => {
    link.attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
    node.attr('transform', d => `translate(${d.x},${d.y})`);
  });
}
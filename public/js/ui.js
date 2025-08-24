/* UI del visualizador: carga de datos, formularios y pintado con vis-network */

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

async function cargarGrafo() {
  // Intento 1: nodos con relaciones
  try {
    const g1 = await api("/api/cypher", {
      method: "POST",
      body: JSON.stringify({ query: "MATCH (n)-[r]->(m) RETURN n,r,m LIMIT 500" }),
    });
    if (g1.nodes?.length || g1.edges?.length) {
      pintar(g1.nodes, g1.edges);
      return;
    }
  } catch (e) {
    console.error("Error en cypher n-r-m:", e.message);
  }

  // Intento 2: solo nodos sueltos
  try {
    const g2 = await api("/api/cypher", {
      method: "POST",
      body: JSON.stringify({ query: "MATCH (n) RETURN n LIMIT 300" }),
    });
    pintar(g2.nodes || [], []);
  } catch (e) {
    console.error("Error en cypher solo nodos:", e.message);
    mostrarMensaje("No se pudo cargar el grafo. Revisa la consola.");
  }
}

let network = null;
let physicsOn = true;

function pintar(nodes, edges) {
  const container = document.getElementById("viz");
  if (!nodes.length && !edges.length) {
    mostrarMensaje("No hay datos que pintar por ahora.");
    return;
  }

  const visNodes = nodes.map(n => ({
    id: n.id,
    label: n.label,
    shape: n.avatar_url ? "circularImage" : "dot",
    image: n.avatar_url || undefined,
    size: 30,
    title: n.labels ? `Labels: ${n.labels.join(", ")}<br>${escapeHtml(JSON.stringify(n.props))}` : undefined
  }));

    const visEdges = decorarAristas(
    edges.map(e => ({
        id: e.id,
        from: e.from,
        to: e.to,
        arrows: "to",
        label: e.type,
        font: { align: "horizontal" }
    }))
    );


  const data = {
    nodes: new vis.DataSet(visNodes),
    edges: new vis.DataSet(visEdges),
  };

    const options = {
        interaction: { hover: true, tooltipDelay: 120 },
        physics: { enabled: physicsOn, stabilization: true },
        nodes: { borderWidth: 1 },
        edges: { smooth: { type: "dynamic" } }
    };

    network = new vis.Network(container, data, options);
    }

document.getElementById("btn-physics").addEventListener("click", () => {
  physicsOn = !physicsOn;
  if (network) network.setOptions({ physics: { enabled: physicsOn } });
  document.getElementById("btn-physics").textContent =
    physicsOn ? "Desactivar físicas" : "Activar físicas";
});

function decorarAristas(edges) {
  // Agrupa por par de nodos (sin dirección) para detectar paralelas/opuestas
  const buckets = new Map(); // key: "minId-maxId" -> { all:[], byDir: {AtoB:[], BtoA:[]} }
  for (const e of edges) {
    const a = Math.min(e.from, e.to);
    const b = Math.max(e.from, e.to);
    const key = `${a}-${b}`;
    if (!buckets.has(key)) buckets.set(key, { all: [], byDir: { AtoB: [], BtoA: [] } });
    const bucket = buckets.get(key);
    bucket.all.push(e);
    if (e.from === a && e.to === b) bucket.byDir.AtoB.push(e);
    else bucket.byDir.BtoA.push(e);
  }

  // Asigna curvaturas
  const out = [];
  for (const { byDir } of buckets.values()) {
    // mismas direcciones múltiples
    const roundnessStep = 0.15;
    byDir.AtoB.forEach((e, i) => {
      out.push({
        ...e,
        smooth: { enabled: true, type: "curvedCW", roundness: (i + 1) * roundnessStep }
      });
    });
    byDir.BtoA.forEach((e, i) => {
      out.push({
        ...e,
        smooth: { enabled: true, type: "curvedCCW", roundness: (i + 1) * roundnessStep }
      });
    });
  }

  return out;
}


function mostrarMensaje(txt) {
  const el = document.getElementById("viz");
  el.innerHTML = `<div class="msg">${txt}</div>`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/* ---- Selects para crear relaciones ---- */
async function cargarSelects() {
  try {
    const { nodes = [] } = await api("/api/nodes");
    const opts = nodes
      .map(n => ({ value: n.id, text: `${n.label} [${n.id}]` }))
      .sort((a, b) => a.text.localeCompare(b.text));

    const fromSel = document.getElementById("rel-from");
    const toSel   = document.getElementById("rel-to");
    fromSel.innerHTML = "";
    toSel.innerHTML = "";
    for (const o of opts) {
      fromSel.add(new Option(o.text, o.value));
      toSel.add(new Option(o.text, o.value));
    }
  } catch (e) {
    console.error("Error cargando selects:", e.message);
  }
}

/* ---- Formularios ---- */
document.getElementById("form-node").addEventListener("submit", async (e) => {
  e.preventDefault();
  const label = document.getElementById("node-label").value.trim() || "Person";
  const name  = document.getElementById("node-name").value.trim();
  let avatar_url = document.getElementById("node-avatar").value.trim() || null;

  if (!name) { alert("El nombre es obligatorio."); return; }

  // Si hay archivo, súbelo primero
  const fileInput = document.getElementById("node-file");
  if (fileInput.files && fileInput.files[0]) {
    const fd = new FormData();
    fd.append("file", fileInput.files[0]);
    const res = await fetch("/api/upload-avatar", { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) { alert("Error subiendo imagen: " + (json.error || res.status)); return; }
    avatar_url = json.url; // p.ej. /uploads/avatar_...png
  }

  try {
    await api("/api/create-node", {
      method: "POST",
      body: JSON.stringify({ label, name, avatar_url })
    });
    fileInput.value = "";
    document.getElementById("node-name").value = "";
    document.getElementById("node-avatar").value = "";
    await cargarSelects();
    await cargarGrafo();
  } catch (e) {
    alert("Error creando nodo: " + e.message);
  }
});


document.getElementById("form-rel").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fromId = Number(document.getElementById("rel-from").value);
  const toId   = Number(document.getElementById("rel-to").value);
  const type   = document.getElementById("rel-type").value.trim() || "FRIEND_OF";

  if (Number.isNaN(fromId) || Number.isNaN(toId)) {
    alert("Selecciona nodos válidos.");
    return;
  }
  try {
    await api("/api/create-rel", {
      method: "POST",
      body: JSON.stringify({ fromId, toId, type })
    });
    await cargarGrafo();
  } catch (e) {
    alert("Error creando relación: " + e.message);
  }
});

document.getElementById("btn-refrescar").addEventListener("click", async () => {
  await cargarSelects();
  await cargarGrafo();
});

/* ---- Init ---- */
(async () => {
  await cargarSelects();
  await cargarGrafo();
})();

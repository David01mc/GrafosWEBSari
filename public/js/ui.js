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
  try {
    console.log("Cargando grafo...");
    
    const g1 = await api("/api/cypher", {
      method: "POST",
      body: JSON.stringify({ 
        query: `MATCH (n) 
                OPTIONAL MATCH (n)-[r]->(m) 
                RETURN n, r, m 
                LIMIT 500` 
      }),
    });
    
    console.log("Datos cargados:", g1);
    
    // Validar que los datos sean correctos
    const nodes = g1.nodes || [];
    const edges = g1.edges || [];
    
    console.log("Procesando:", nodes.length, "nodos y", edges.length, "relaciones");
    
    pintar(nodes, edges);
    await cargarSelects();
    
  } catch (e) {
    console.error("Error cargando grafo:", e);
    mostrarMensaje("Error cargando el grafo: " + e.message);
    
    // Intentar cargar solo los nodos como fallback
    try {
      console.log("Intentando fallback solo con nodos...");
      const g2 = await api("/api/cypher", {
        method: "POST",
        body: JSON.stringify({ query: "MATCH (n) RETURN n LIMIT 300" }),
      });
      pintar(g2.nodes || [], []);
      await cargarSelects();
    } catch (e2) {
      console.error("Error en fallback:", e2);
      mostrarMensaje("No se pudo conectar con la base de datos.");
    }
  }
}

let network = null;
let physicsOn = true;

function pintar(nodes, edges) {
  const container = document.getElementById("viz");
  
  console.log("Pintando - Nodos:", nodes.length, "Aristas:", edges.length);
  
  if (!nodes.length) {
    mostrarMensaje("No hay nodos que mostrar.");
    return;
  }

  // Eliminar duplicados de nodos por ID
  const uniqueNodes = [];
  const seenNodeIds = new Set();
  for (const n of nodes) {
    if (!seenNodeIds.has(n.id)) {
      seenNodeIds.add(n.id);
      uniqueNodes.push(n);
    }
  }

  // Eliminar duplicados de aristas por ID
  const uniqueEdges = [];
  const seenEdgeIds = new Set();
  for (const e of edges) {
    if (!seenEdgeIds.has(e.id)) {
      seenEdgeIds.add(e.id);
      uniqueEdges.push(e);
    }
  }

  console.log("Después de filtrar duplicados - Nodos:", uniqueNodes.length, "Aristas:", uniqueEdges.length);

  const visNodes = uniqueNodes.map(n => ({
    id: n.id,
    label: n.label,
    shape: n.avatar_url ? "circularImage" : "dot",
    image: n.avatar_url ? (n.avatar_url.startsWith('http') ? n.avatar_url : window.location.origin + n.avatar_url) : undefined,
    size: 30,
    borderWidth: 2,
    color: { border: '#2e7d32', background: n.avatar_url ? 'transparent' : '#e8f5e8' },
    title: n.labels ? `Labels: ${n.labels.join(", ")}<br>${escapeHtml(JSON.stringify(n.props))}` : undefined
  }));

  const visEdges = uniqueEdges.length > 0 ? decorarAristas(
    uniqueEdges.map(e => ({
      id: e.id,
      from: e.from,
      to: e.to,
      arrows: { to: { enabled: true, scaleFactor: 1.2 } },
      label: e.type,
      font: { 
        align: "horizontal", 
        size: 11, 
        color: '#444',
        background: 'rgba(255,255,255,0.8)',
        strokeWidth: 2,
        strokeColor: '#fff'
      },
      color: { 
        color: '#666', 
        highlight: '#2e7d32',
        opacity: 0.8
      },
      width: 2,
      selectionWidth: 4
    }))
  ) : [];

  console.log("Nodos vis:", visNodes.length, "Aristas vis:", visEdges.length);

  try {
    const data = {
      nodes: new vis.DataSet(visNodes),
      edges: new vis.DataSet(visEdges),
    };

    const options = {
      interaction: { 
        hover: true, 
        tooltipDelay: 120,
        selectConnectedEdges: false,
        dragNodes: true,
        dragView: true,
        zoomView: true
      },
      physics: { 
        enabled: physicsOn, 
        stabilization: { iterations: 150 },
        solver: 'barnesHut',
        barnesHut: {
          gravitationalConstant: -2000,
          centralGravity: 0.3,
          springLength: 120,
          springConstant: 0.04,
          damping: 0.09,
          avoidOverlap: 0.1
        }
      },
      nodes: { 
        borderWidth: 2,
        font: { size: 14, color: '#333' },
        margin: 10,
        chosen: {
          node: function(values, id, selected, hovering) {
            values.borderColor = '#2e7d32';
            values.borderWidth = 3;
          }
        }
      },
      edges: { 
        smooth: { 
          type: "dynamic",
          forceDirection: "none",
          roundness: 0.1
        },
        width: 2,
        chosen: {
          edge: function(values, id, selected, hovering) {
            values.color = '#2e7d32';
            values.width = 3;
          }
        }
      },
      layout: {
        improvedLayout: true,
        clusterThreshold: 150
      }
    };

    network = new vis.Network(container, data, options);

    // Eventos para edición
    network.on("doubleClick", function(params) {
      if (params.nodes.length > 0) {
        editarNodo(params.nodes[0]);
      }
    });

    // Eliminación rápida con tecla Delete
    network.on("selectNode", function(params) {
      const handleDelete = (e) => {
        if (e.key === 'Delete' && params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          const node = network.body.data.nodes.get(nodeId);
          
          const confirmDelete = confirm(`¿Eliminar el nodo "${node.label}"?\n\nPresiona OK para confirmar.`);
          if (confirmDelete) {
            api("/api/delete-node", {
              method: "POST", // Changed from DELETE to POST
              body: JSON.stringify({ nodeId })
            }).then(async () => {
              await cargarGrafo();
              alert("Nodo eliminado!");
            }).catch(e => {
              alert("Error eliminando nodo: " + e.message);
            });
          }
          
          document.removeEventListener('keydown', handleDelete);
        }
      };
      
      document.addEventListener('keydown', handleDelete);
      
      // Limpiar listener cuando se deselecciona
      network.once("deselectNode", () => {
        document.removeEventListener('keydown', handleDelete);
      });
    });
    
  } catch (error) {
    console.error("Error creando la red:", error);
    mostrarMensaje("Error visualizando el grafo: " + error.message);
  }
}

// Nueva función para editar nodos con foto y eliminación
function editarNodo(nodeId) {
  const node = network.body.data.nodes.get(nodeId);
  
  // Crear modal simple para edición
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,0,0,0.5); display: flex; align-items: center; 
    justify-content: center; z-index: 1000;
  `;
  
  modal.innerHTML = `
    <div style="background: white; padding: 20px; border-radius: 8px; min-width: 350px;">
      <h3 style="margin: 0 0 15px 0;">Editar Nodo</h3>
      <div style="margin-bottom: 10px;">
        <label>Nombre:</label><br>
        <input id="edit-name" value="${node.label}" style="width: 100%; padding: 8px; margin-top: 4px; box-sizing: border-box;">
      </div>
      <div style="margin-bottom: 10px;">
        <label>Avatar URL:</label><br>
        <input id="edit-avatar-url" value="${node.image || ''}" style="width: 100%; padding: 8px; margin-top: 4px; box-sizing: border-box;">
      </div>
      <div style="margin-bottom: 15px;">
        <label>Nueva foto:</label><br>
        <input id="edit-avatar-file" type="file" accept="image/*" style="margin-top: 4px; width: 100%;">
      </div>
      <div style="display: flex; gap: 10px; justify-content: space-between;">
        <button id="edit-delete" style="padding: 8px 16px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer;">Eliminar</button>
        <div style="display: flex; gap: 10px;">
          <button id="edit-cancel" style="padding: 8px 16px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer;">Cancelar</button>
          <button id="edit-save" style="padding: 8px 16px; background: #111827; color: white; border: none; border-radius: 4px; cursor: pointer;">Guardar</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById('edit-cancel').onclick = () => modal.remove();
  
  document.getElementById('edit-delete').onclick = async () => {
    const confirmDelete = confirm(`¿Estás seguro de que quieres eliminar el nodo "${node.label}"?\n\nEsto eliminará también todas sus relaciones.`);
    if (!confirmDelete) return;
    
    try {
      await api("/api/delete-node", {
        method: "POST", // Changed from DELETE to POST
        body: JSON.stringify({ nodeId })
      });
      
      modal.remove();
      await cargarGrafo();
      alert("Nodo eliminado exitosamente!");
    } catch (e) {
      alert("Error eliminando nodo: " + e.message);
    }
  };
  
  document.getElementById('edit-save').onclick = async () => {
    const nuevoNombre = document.getElementById('edit-name').value.trim();
    let nuevaAvatar = document.getElementById('edit-avatar-url').value.trim();
    const archivoAvatar = document.getElementById('edit-avatar-file').files[0];
    
    if (!nuevoNombre) {
      alert('El nombre es obligatorio');
      return;
    }
    
    try {
      // Si hay nuevo archivo, subirlo primero
      if (archivoAvatar) {
        const fd = new FormData();
        fd.append("file", archivoAvatar);
        const res = await fetch("/api/upload-avatar", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || res.status);
        nuevaAvatar = json.url;
      }
      
      await api("/api/update-node", {
        method: "PUT",
        body: JSON.stringify({ 
          nodeId, 
          name: nuevoNombre, 
          avatar_url: nuevaAvatar || null 
        })
      });
      
      modal.remove();
      await cargarGrafo();
      alert("Nodo actualizado exitosamente!");
    } catch (e) {
      alert("Error actualizando nodo: " + e.message);
    }
  };
  
  // Cerrar al hacer clic fuera
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
  
  // Cerrar con Escape
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

document.getElementById("btn-physics").addEventListener("click", () => {
  physicsOn = !physicsOn;
  if (network) network.setOptions({ physics: { enabled: physicsOn } });
  document.getElementById("btn-physics").textContent =
    physicsOn ? "Desactivar físicas" : "Activar físicas";
});

function decorarAristas(edges) {
  const buckets = new Map();
  
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

  const out = [];
  for (const [key, { byDir }] of buckets.entries()) {
    const totalAtoB = byDir.AtoB.length;
    const totalBtoA = byDir.BtoA.length;
    const hasBidirectional = totalAtoB > 0 && totalBtoA > 0;
    
    // Para relaciones bidireccionales, usar mayor separación
    const roundnessStep = hasBidirectional ? 0.4 : 0.25;
    const baseRoundness = hasBidirectional ? 0.35 : 0.15;
    
    byDir.AtoB.forEach((e, i) => {
      if (hasBidirectional) {
        // Si hay bidireccional, usar curva más pronunciada hacia un lado
        out.push({
          ...e,
          smooth: { 
            enabled: true, 
            type: "curvedCW", 
            roundness: baseRoundness + (i * roundnessStep)
          }
        });
      } else {
        // Si solo hay una dirección, usar curva suave
        out.push({
          ...e,
          smooth: { 
            enabled: true, 
            type: "dynamic", 
            roundness: 0.1 + (i * 0.15)
          }
        });
      }
    });
    
    byDir.BtoA.forEach((e, i) => {
      if (hasBidirectional) {
        // Dirección opuesta con curva más pronunciada al otro lado
        out.push({
          ...e,
          smooth: { 
            enabled: true, 
            type: "curvedCCW", 
            roundness: baseRoundness + (i * roundnessStep)
          }
        });
      } else {
        // Si solo hay una dirección, usar curva suave
        out.push({
          ...e,
          smooth: { 
            enabled: true, 
            type: "dynamic", 
            roundness: 0.1 + (i * 0.15)
          }
        });
      }
    });
  }

  console.log(`Aristas decoradas: ${out.length} de ${edges.length} originales`);
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
    
    if (opts.length === 0) {
      fromSel.add(new Option("No hay nodos", ""));
      toSel.add(new Option("No hay nodos", ""));
      return;
    }
    
    for (const o of opts) {
      fromSel.add(new Option(o.text, o.value));
      toSel.add(new Option(o.text, o.value));
    }
  } catch (e) {
    console.error("Error cargando selects:", e.message);
  }
}

document.getElementById("form-node").addEventListener("submit", async (e) => {
  e.preventDefault();
  const label = document.getElementById("node-label").value.trim() || "Person";
  const name  = document.getElementById("node-name").value.trim();
  let avatar_url = document.getElementById("node-avatar").value.trim() || null;

  if (!name) { alert("El nombre es obligatorio."); return; }

  const fileInput = document.getElementById("node-file");
  if (fileInput.files && fileInput.files[0]) {
    try {
      const fd = new FormData();
      fd.append("file", fileInput.files[0]);
      const res = await fetch("/api/upload-avatar", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || res.status);
      avatar_url = json.url;
    } catch (e) {
      alert("Error subiendo imagen: " + e.message);
      return;
    }
  }

  try {
    await api("/api/create-node", {
      method: "POST",
      body: JSON.stringify({ label, name, avatar_url })
    });
    
    // Limpiar formulario
    document.getElementById("node-name").value = "";
    document.getElementById("node-avatar").value = "";
    fileInput.value = "";
    
    await cargarGrafo();
    alert("Nodo creado exitosamente!");
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
  if (fromId === toId) {
    alert("No puedes crear una relación de un nodo consigo mismo.");
    return;
  }
  
  try {
    await api("/api/create-rel", {
      method: "POST",
      body: JSON.stringify({ fromId, toId, type })
    });
    await cargarGrafo();
    alert("Relación creada exitosamente!");
  } catch (e) {
    alert("Error creando relación: " + e.message);
  }
});

document.getElementById("btn-refrescar").addEventListener("click", async () => {
  await cargarGrafo();
});

(async () => {
  await cargarGrafo();
})();
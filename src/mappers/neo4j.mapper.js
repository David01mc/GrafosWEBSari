function toNumber(id) {
  if (typeof id?.toNumber === "function") {
    return id.toNumber();
  }
  return Number(id);
}

function recordsToGraph(records) {
  const nodeMap = new Map();
  const edgeMap = new Map(); // Para evitar duplicados
  const edges = [];

  for (const rec of records) {
    for (const key of rec.keys) {
      const v = rec.get(key);
      if (!v) continue;

      if (v.identity !== undefined && v.labels !== undefined) { // Es un nodo
        const id = toNumber(v.identity);
        if (!nodeMap.has(id)) {
          nodeMap.set(id, {
            id,
            label: v.properties.name || `Node ${id}`,
            avatar_url: v.properties.avatar_url || null,
            props: v.properties,
            labels: v.labels
          });
        }
      } else if (v.identity !== undefined && v.type !== undefined && v.start !== undefined && v.end !== undefined) { // Es una relación
        const edgeId = toNumber(v.identity);
        const fromId = toNumber(v.start);
        const toId = toNumber(v.end);
        
        // Usar un key único para evitar duplicados
        const edgeKey = `${edgeId}-${fromId}-${toId}`;
        if (!edgeMap.has(edgeKey)) {
          edgeMap.set(edgeKey, true);
          edges.push({
            id: edgeId,
            from: fromId,
            to: toId,
            type: v.type,
            props: v.properties || {}
          });
        }
      }
    }
  }

  const result = { 
    nodes: Array.from(nodeMap.values()), 
    edges: edges 
  };
  
  console.log(`Mapper procesó: ${result.nodes.length} nodos, ${result.edges.length} relaciones`);
  
  // Debug: mostrar IDs para verificar duplicados
  console.log('IDs de nodos:', result.nodes.map(n => n.id));
  console.log('IDs de aristas:', result.edges.map(e => e.id));
  
  return result;
}

module.exports = { recordsToGraph };
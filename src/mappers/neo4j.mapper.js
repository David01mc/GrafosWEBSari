function toNumber(id) {
  return typeof id?.toNumber === "function" ? id.toNumber() : Number(id);
}

function recordsToGraph(records) {
  const nodeMap = new Map();
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
        
        // Verificar que no exista ya esta relación
        const existingEdge = edges.find(e => e.id === edgeId);
        if (!existingEdge) {
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
  return result;
}

module.exports = { recordsToGraph };
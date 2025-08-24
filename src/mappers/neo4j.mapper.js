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

      if (v.identity && v.labels) { // Nodo
        const id = toNumber(v.identity);
        if (!nodeMap.has(id)) {
          nodeMap.set(id, {
            id,
            label: v.properties.name || key || String(id),
            avatar_url: v.properties.avatar_url || null,
            props: v.properties,
            labels: v.labels
          });
        }
      } else if (v.identity && v.type && v.start && v.end) { // Relación
        edges.push({
          id: toNumber(v.identity),
          from: toNumber(v.start),
          to: toNumber(v.end),
          type: v.type
        });
      }
    }
  }

  return { nodes: Array.from(nodeMap.values()), edges };
}

module.exports = { recordsToGraph };

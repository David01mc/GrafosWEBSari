const { getSession } = require("../config/neo4j");
const { recordsToGraph } = require("../mappers/neo4j.mapper");

// GET /api/nodes
exports.listNodes = async (req, res) => {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (n)
      RETURN n
      ORDER BY coalesce(n.name, toString(id(n))) ASC
      LIMIT 1000
    `);
    const { nodes } = recordsToGraph(result.records);
    res.json({ nodes });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    await session.close();
  }
};

// POST /api/create-node
exports.createNode = async (req, res) => {
  const { label = "Person", name, avatar_url } = req.body || {};
  if (!name) return res.status(400).json({ error: "Falta 'name'" });

  const session = getSession();
  try {
    const result = await session.run(
      `CREATE (n:\`${label}\` {name: $name, avatar_url: $avatar}) RETURN n`,
      { name, avatar: avatar_url || null }
    );
    const { nodes } = recordsToGraph(result.records);
    res.json({ created: nodes[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    await session.close();
  }
};

// PUT /api/update-node
exports.updateNode = async (req, res) => {
  const { nodeId, name, avatar_url } = req.body || {};
  if (!nodeId || !name) return res.status(400).json({ error: "Faltan 'nodeId' o 'name'" });

  const session = getSession();
  try {
    const params = { id: Number(nodeId), name };
    let query = `MATCH (n) WHERE id(n) = $id SET n.name = $name`;
    
    if (avatar_url !== undefined) {
      query += `, n.avatar_url = $avatar`;
      params.avatar = avatar_url;
    }
    
    query += ` RETURN n`;
    
    const result = await session.run(query, params);
    const { nodes } = recordsToGraph(result.records);
    res.json({ updated: nodes[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    await session.close();
  }
};

// POST /api/delete-node - Changed from DELETE to POST
exports.deleteNode = async (req, res) => {
  console.log('DELETE endpoint called with body:', req.body);
  
  const { nodeId } = req.body || {};
  if (!nodeId) {
    console.log('Missing nodeId in request body');
    return res.status(400).json({ error: "Falta 'nodeId'" });
  }

  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (n) WHERE id(n) = $id
       DETACH DELETE n
       RETURN count(n) as deleted`,
      { id: Number(nodeId) }
    );
    
    const deletedCount = result.records[0].get('deleted').toNumber();
    console.log(`Node ${nodeId} deletion result:`, deletedCount);
    res.json({ deleted: deletedCount > 0, nodeId: Number(nodeId) });
  } catch (e) {
    console.error('Error deleting node:', e);
    res.status(500).json({ error: e.message });
  } finally {
    await session.close();
  }
};

// POST /api/create-rel
exports.createRel = async (req, res) => {
  const { fromId, toId, type = "FRIEND_OF" } = req.body || {};
  if (fromId == null || toId == null) {
    return res.status(400).json({ error: "Faltan 'fromId' o 'toId'" });
  }

  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (a), (b)
       WHERE id(a) = $from AND id(b) = $to
       MERGE (a)-[r:\`${type}\`]->(b)
       RETURN a, r, b`,
      { from: Number(fromId), to: Number(toId) }
    );
    const graph = recordsToGraph(result.records);
    res.json({ ok: true, ...graph });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    await session.close();
  }
};

// GET /api/debug - Para ver qué hay en la BD
exports.debugGraph = async (req, res) => {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (n)-[r]->(m) 
      RETURN n.name as from_name, type(r) as rel_type, m.name as to_name,
             id(n) as from_id, id(r) as rel_id, id(m) as to_id
      UNION ALL
      MATCH (n) WHERE NOT (n)-[]-()
      RETURN n.name as from_name, null as rel_type, null as to_name,
             id(n) as from_id, null as rel_id, null as to_id
    `);
    
    const data = result.records.map(r => ({
      from_name: r.get('from_name'),
      rel_type: r.get('rel_type'),
      to_name: r.get('to_name'),
      from_id: r.get('from_id')?.toNumber?.() || r.get('from_id'),
      rel_id: r.get('rel_id')?.toNumber?.() || r.get('rel_id'),
      to_id: r.get('to_id')?.toNumber?.() || r.get('to_id')
    }));
    
    res.json({ debug: data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    await session.close();
  }
};
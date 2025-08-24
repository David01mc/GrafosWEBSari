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
    const result = await session.run(
      `MATCH (n) WHERE id(n) = $id 
       SET n.name = $name
       ${avatar_url !== undefined ? ', n.avatar_url = $avatar' : ''}
       RETURN n`,
      { 
        id: Number(nodeId), 
        name, 
        ...(avatar_url !== undefined && { avatar: avatar_url })
      }
    );
    const { nodes } = recordsToGraph(result.records);
    res.json({ updated: nodes[0] });
  } catch (e) {
    console.error(e);
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
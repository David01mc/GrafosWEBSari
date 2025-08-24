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
    // Si no tienes APOC en Aura, usa etiqueta fija: CREATE (n:Person {...}) RETURN n
    const result = await session.run(
      `
      CREATE (n:\`${label}\` {name:$name, avatar_url:$avatar})
      RETURN n
      `,
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

// POST /api/create-rel
exports.createRel = async (req, res) => {
  const { fromId, toId, type = "FRIEND_OF" } = req.body || {};
  if (fromId == null || toId == null) {
    return res.status(400).json({ error: "Faltan 'fromId' o 'toId'" });
  }

  const session = getSession();
  try {
    const result = await session.run(
      `
      MATCH (a),(b)
      WHERE id(a) = $from AND id(b) = $to
      MERGE (a)-[r:\`${type}\`]->(b)
      RETURN a, r, b
      `,
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

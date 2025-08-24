const { getSession } = require("../config/neo4j");
const { recordsToGraph } = require("../mappers/neo4j.mapper");

exports.runCypher = async (req, res) => {
  const { query, params = {} } = req.body || {};
  if (!query) return res.status(400).json({ error: "Falta 'query'" });

  const session = getSession();
  try {
    const result = await session.run(query, params);
    const graph = recordsToGraph(result.records);
    res.json(graph);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    await session.close();
  }
};

const router = require("express").Router();
const { listNodes, createNode, createRel, updateNode } = require("../controllers/graph.controller");

router.get("/nodes", listNodes);
router.post("/create-node", createNode);
router.put("/update-node", updateNode);
router.post("/create-rel", createRel);

module.exports = router;
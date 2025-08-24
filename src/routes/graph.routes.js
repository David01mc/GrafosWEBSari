const router = require("express").Router();
const { listNodes, createNode, createRel } = require("../controllers/graph.controller");

router.get("/nodes", listNodes);
router.post("/create-node", createNode);
router.post("/create-rel", createRel);

module.exports = router;

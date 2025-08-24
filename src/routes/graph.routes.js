const router = require("express").Router();
const { listNodes, createNode, createRel, updateNode, debugGraph, deleteNode } = require("../controllers/graph.controller");

router.get("/nodes", listNodes);
router.post("/create-node", createNode);
router.put("/update-node", updateNode);
router.delete("/delete-node", deleteNode);
router.post("/create-rel", createRel);
router.get("/debug", debugGraph);

module.exports = router;
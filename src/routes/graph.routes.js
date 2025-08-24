const router = require("express").Router();
const { listNodes, createNode, createRel, updateNode, debugGraph, deleteNode } = require("../controllers/graph.controller");

router.get("/nodes", listNodes);
router.post("/create-node", createNode);
router.put("/update-node", updateNode);
router.post("/delete-node", deleteNode); // Changed from DELETE to POST
router.post("/create-rel", createRel);
router.get("/debug", debugGraph);

module.exports = router;
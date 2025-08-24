const router = require("express").Router();
const { runCypher } = require("../controllers/cypher.controller");

router.post("/cypher", runCypher);

module.exports = router;

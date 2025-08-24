const neo4j = require("neo4j-driver");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);
const DB = process.env.NEO4J_DATABASE || "neo4j";

const getSession = () => driver.session({ database: DB });

module.exports = { driver, getSession };

const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = (file.originalname.split(".").pop() || "png").toLowerCase();
    cb(null, `avatar_${Date.now()}.${ext}`);
  }
});
const upload = multer({ storage });


const cypherRoutes = require("./routes/cypher.routes");
const graphRoutes = require("./routes/graph.routes");

const app = express();
app.use(cors());
app.use(express.json());

// API
app.use("/api", cypherRoutes);
app.use("/api", graphRoutes);

// Estáticos
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use(express.static(path.join(__dirname, "..", "public")));

// Upload avatar
app.post("/api/upload-avatar", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Falta archivo" });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url }); // esta URL la guardarás en avatar_url
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor listo: http://localhost:${PORT}`));

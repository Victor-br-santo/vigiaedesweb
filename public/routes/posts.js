// posts.js (em: ./public/routes/posts.js ou similar)
const express = require("express");
const router = express.Router();
const pool = require("../../db");
const upload = require("../../middlewares/upload");

// POST - Criar novo post   
router.post("/posts", upload.single("imagem"), async (req, res) => {
  console.log("Arquivo recebido pelo multer:", req.file);
  const { titulo, conteudo } = req.body;
  const imagem = req.file ? "/uploads/" + req.file.filename : null;

  if (!titulo || !conteudo) {
    return res.status(400).json({ erro: "Título e conteúdo são obrigatórios" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO posts (titulo, conteudo, imagem) VALUES ($1, $2, $3) RETURNING *",
      [titulo, conteudo, imagem]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Erro ao criar post:", err);
    res.status(500).json({ erro: "Erro ao criar post" });
  }
});

// GET - Listar todos os posts
router.get("/posts", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM posts ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("Erro ao buscar posts:", err);
    res.status(500).json({ erro: "Erro interno do servidor" });
  }
});

// DELETE - Excluir post
router.delete("/posts/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM posts WHERE id = $1", [id]);
    res.status(204).send();
  } catch (err) {
    console.error("Erro ao excluir post:", err);
    res.status(500).json({ erro: "Erro ao excluir post" });
  }
});

module.exports = router;

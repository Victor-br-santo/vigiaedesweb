const express = require("express");
const router = express.Router();
const pool = require("../db"); // ajuste conforme seu caminho real

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

// DELETE - Excluir post por ID
router.delete("/posts/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM posts WHERE id = $1", [id]);
    res.status(204).send(); // sucesso, sem conteúdo
  } catch (err) {
    console.error("Erro ao excluir post:", err);
    res.status(500).json({ erro: "Erro ao excluir post" });
  }
});

module.exports = router;

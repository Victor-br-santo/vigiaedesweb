const express = require("express");
const router = express.Router();
const pool = require("../../db"); // ajuste conforme seu caminho real


router.post("/posts", upload.single("imagem"), async (req, res) => {
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

const form = document.getElementById("form-novo-post");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const formData = new FormData();
  formData.append("titulo", document.getElementById("titulo").value.trim());
  formData.append("conteudo", document.getElementById("conteudo").value.trim());
  const imagemInput = document.getElementById("imagem");
  if (imagemInput.files[0]) {
    formData.append("imagem", imagemInput.files[0]);
  }

  try {
    const resposta = await fetch("/posts", {
      method: "POST",
      body: formData
    });

    if (resposta.ok) {
      form.reset();
      carregarPosts();
    } else {
      const erro = await resposta.json();
      alert("Erro ao criar post: " + (erro.erro || "Erro desconhecido"));
    }
  } catch (err) {
    console.error("Erro ao enviar post:", err);
    alert("Erro na conexão com o servidor.");
  }
});


const multer = require("multer");
const path = require("path");

// Configurar destino e nome do arquivo
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });


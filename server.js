const express = require("express");
const cors = require("cors");
const path = require("path");
const app = express();
const conexao = require("./db"); // Agora o db.js é configurado para PostgreSQL
require('dotenv').config();


app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

// Rota GET para buscar usuários no banco
app.get("/usuarios", (req, res) => {
  const query = "SELECT * FROM usuarios";  // Query para pegar todos os usuários

  conexao.query(query, (err, results) => {  // Usando pool.query() do pg
    if (err) {
      console.error("Erro ao buscar usuários:", err);
      return res.status(500).json({ mensagem: "Erro ao buscar usuários" });
    }
    res.json(results.rows);  // No PostgreSQL, o resultado da consulta é em 'results.rows'
  });
});

// Rota POST para adicionar usuário ao banco
app.post("/usuarios", (req, res) => {
  const { nome, email } = req.body;

  const query = "INSERT INTO usuarios (nome, email) VALUES ($1, $2) RETURNING *";  // Usando placeholders do PostgreSQL
  conexao.query(query, [nome, email], (err, results) => {
    if (err) {
      console.error("Erro ao inserir usuário:", err);
      return res.status(500).json({ mensagem: "Erro ao adicionar usuário" });
    }

    res.status(201).json({ mensagem: "Usuário adicionado com sucesso!", usuario: results.rows[0] });
  });
});

// Inicializa o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

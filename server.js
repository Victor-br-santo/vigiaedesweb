const express = require("express");
const cors = require("cors");
const path = require("path");
const app = express();
const conexao = require("./db"); // Conexão com o banco de dados

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

// Rota raiz (evita o "Cannot GET /")
app.get("/", (req, res) => {
  res.send("API está no ar! 🌐");
});

// Rota GET para buscar usuários no banco
app.get("/usuarios", (req, res) => {
  const query = "SELECT * FROM usuarios";

  conexao.query(query, (err, results) => {
    if (err) {
      console.error("Erro ao buscar usuários:", err);
      return res.status(500).json({ mensagem: "Erro ao buscar usuários" });
    }
    res.json(results); // Retorna os usuários do banco
  });
});

// Rota POST para adicionar usuário ao banco
app.post("/usuarios", (req, res) => {
  const { nome, email } = req.body;

  const query = "INSERT INTO usuarios (nome, email) VALUES (?, ?)";
  conexao.query(query, [nome, email], (err, results) => {
    if (err) {
      console.error("Erro ao inserir usuário:", err);
      return res.status(500).json({ mensagem: "Erro ao adicionar usuário" });
    }

    res.status(201).json({ mensagem: "Usuário adicionado com sucesso!" });
  });
});

// Inicializa o servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

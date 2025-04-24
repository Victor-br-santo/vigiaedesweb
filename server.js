const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

const usuarios = [];

app.get("/usuarios", (req, res) => {
  res.json(usuarios);
});

app.post("/usuarios", (req, res) => {
  const { nome, email } = req.body;
  usuarios.push({ nome, email });
  res.status(201).json({ mensagem: "Usuário adicionado!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

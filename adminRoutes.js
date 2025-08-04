const bcrypt = require("bcrypt");
const conexao = require("./db"); // já tá usando, tudo certo!

// Cadastro de administrador
app.post("/admin/cadastrar", async (req, res) => {
  const { nome, email, senha } = req.body;

  const senhaCriptografada = await bcrypt.hash(senha, 10);

  const query = "INSERT INTO administradores (nome, email, senha) VALUES (?, ?, ?)";
  conexao.query(query, [nome, email, senhaCriptografada], (err, results) => {
    if (err) {
      console.error("Erro ao cadastrar administrador:", err);
      return res.status(500).json({ mensagem: "Erro ao cadastrar administrador" });
    }

    res.status(201).json({ mensagem: "Administrador cadastrado com sucesso!" });
  });
});

// Login do administrador
app.post("/admin/login", (req, res) => {
  const { email, senha } = req.body;

  const query = "SELECT * FROM administradores WHERE email = ?";
  conexao.query(query, [email], async (err, results) => {
    if (err) {
      console.error("Erro ao buscar administrador:", err);
      return res.status(500).json({ mensagem: "Erro no login" });
    }

    if (results.length === 0) {
      return res.status(401).json({ mensagem: "Administrador não encontrado" });
    }

    const admin = results[0];

    const senhaCorreta = await bcrypt.compare(senha, admin.senha);

    if (!senhaCorreta) {
      return res.status(401).json({ mensagem: "Senha incorreta" });
    }

   // ✅ Gerar o token JWT
    const token = jwt.sign({ id: admin.id, email: admin.email }, segredoJWT, { expiresIn: "2h" });

    res.status(200).json({
      mensagem: "Login bem-sucedido!",
      admin: { id: admin.id, nome: admin.nome },
      token, // ⬅️ Retornando o token para o front-end salvar
  });
});
});

require('dotenv').config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const pool = require("./db"); // sua pool do PostgreSQL
const inscricaoRoutes = require('./routes/inscricao');
const postRoutes = require("./routes/posts");

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const JWT_SECRET = process.env.JWT_SECRET || "seusegredoaqui"; // usar constante

// Middlewares globais de parse do corpo e cors - sempre antes das rotas
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware JWT para verificar token
function verificarToken(req, res, next) {
  console.log("Headers recebidos:", req.headers);
  const authHeader = req.headers["authorization"];
  console.log("Authorization header:", authHeader);  // <<< log para debug
  const token = authHeader && authHeader.split(" ")[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ erro: "Token não fornecido" });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ erro: "Token inválido" });
    }

    req.admin = decoded; // salvar dados do admin no req
    next();
  });
}

// Cria pasta uploads se não existir
const uploadDir = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Variáveis de ambiente para email
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;
const emailTo = process.env.EMAIL_TO;

// Rotas

// Usar o middleware verificarToken corretamente
app.get('/painel/inscricoes', verificarToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM inscricoes ORDER BY id DESC');
    res.render('admin/partials/inscricoes', { inscricoes: rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao buscar inscrições');
  }
});

// Rotas para inscrição e posts
app.use('/inscricao', inscricaoRoutes);
app.use(postRoutes);

// Rota para arquivos estáticos e uploads
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Página de login admin
app.get('/painel/login', (req, res) => {
  res.render('admin/login');
});

// Testar conexão ao banco
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.log("Erro ao conectar ao banco:", err);
  } else {
    console.log("Conexão bem-sucedida:", res.rows);
  }
});

// Rota para validar token (frontend)
app.post("/admin/verificar", verificarToken, (req, res) => {
  res.status(200).json({ mensagem: "Token válido", nome: req.admin.email });
});

// Rota para obter dados do admin a partir do token
app.get("/api/admin-info", verificarToken, (req, res) => {
  res.json({ id: req.admin.id, email: req.admin.email });
});

// Dashboard protegido
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public/dashboard/index.html"));
});


// Rota para buscar usuários
app.get("/usuarios", (req, res) => {
  const query = "SELECT * FROM usuarios";

  pool.query(query, (err, results) => {
    if (err) {
      console.error("Erro ao buscar usuários:", err);
      return res.status(500).json({ mensagem: "Erro ao buscar usuários" });
    }
    res.json(results.rows);
  });
});

// Rota para adicionar usuário
app.post("/usuarios", (req, res) => {
  const { nome, email } = req.body;
  console.log("📩 Dados recebidos do formulário:", { nome, email });

  const query = "INSERT INTO usuarios (nome, email) VALUES ($1, $2) RETURNING *";
  pool.query(query, [nome, email], (err, results) => {
    if (err) {
      console.error("Erro ao inserir usuário:", err);
      return res.status(500).json({ mensagem: "Erro ao adicionar usuário" });
    }

    res.status(201).json({ mensagem: "Usuário adicionado com sucesso!", usuario: results.rows[0] });
  });
});

// Rota para contato
app.post("/contato", async (req, res) => {
  const { name, email, message } = req.body;

  const query = "INSERT INTO contatos (nome, email, mensagem) VALUES ($1, $2, $3) RETURNING *";

  try {
    const result = await pool.query(query, [name, email, message]);

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    await transporter.sendMail({
      from: emailUser,
      to: emailTo,
      subject: "Nova mensagem de contato",
      text: `Nome: ${name}\nEmail: ${email}\nMensagem:\n${message}`,
    });

    res.status(201).json({
      mensagem: "Mensagem enviada com sucesso!",
      contato: result.rows[0],
    });
  } catch (err) {
    console.error("Erro no envio de contato:", err);
    res.status(500).json({ mensagem: "Erro ao enviar mensagem de contato" });
  }
});

// Rota para registrar novo admin
app.post("/admin/registro", async (req, res) => {
  const { nome, email, senha } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(senha, 10);
    const query = "INSERT INTO admins (nome, email, senha) VALUES ($1, $2, $3) RETURNING *";
    const result = await pool.query(query, [nome, email, hashedPassword]);

    res.status(201).json({ mensagem: "Administrador registrado com sucesso!", admin: result.rows[0] });
  } catch (err) {
    console.error("Erro ao registrar admin:", err);
    res.status(500).json({ mensagem: "Erro ao registrar administrador" });
  }
});

// Rota para login admin
app.post("/admin/login", async (req, res) => {
  const { email, senha } = req.body;

  try {
    const query = "SELECT * FROM admins WHERE email = $1";
    const result = await pool.query(query, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ mensagem: "Administrador não encontrado" });
    }

    const admin = result.rows[0];
    const senhaValida = await bcrypt.compare(senha, admin.senha);

    if (!senhaValida) {
      return res.status(401).json({ mensagem: "Senha incorreta" });
    }

    const token = jwt.sign({ id: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: "1h" });

    res.json({ mensagem: "Login bem-sucedido", token });
  } catch (err) {
    console.error("Erro no login de admin:", err);
    res.status(500).json({ mensagem: "Erro no login" });
  }
});

// Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

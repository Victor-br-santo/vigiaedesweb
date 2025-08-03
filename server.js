const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const inscricaoRoutes = require('./routes/inscricao');

const app = express();
const router = express.Router();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("./db");
require('dotenv').config();

const postRoutes = require("./routes/posts");
const nodemailer = require("nodemailer");

const uploadDir = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;
const emailTo = process.env.EMAIL_TO;


// server.js ou routes/admin.js
app.get('/painel/inscricoes', verificarLogin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM inscricoes ORDER BY id DESC');
    res.render('admin/partials/inscricoes', { inscricoes: rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao buscar inscrições');
  }
});

app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.json());
app.use('/inscricao', inscricaoRoutes);

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, 'public')));

app.use(postRoutes);

app.get('/painel/login', (req, res) => {
  res.render('admin/login'); // vai procurar em /views/admin/login.ejs
});

// Testar a conexão com o banco logo após configurar o pool
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.log("Erro ao conectar ao banco:", err); // Caso haja erro
  } else {
    console.log("Conexão bem-sucedida:", res.rows); // Se a conexão for bem-sucedida, exibe a data e hora do banco
  }
});

// Rota GET para buscar usuários no banco
app.get("/usuarios", (req, res) => {
  const query = "SELECT * FROM usuarios";  // Query para pegar todos os usuários

  pool.query(query, (err, results) => {  // Usando pool.query() do pg
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
  console.log("📩 Dados recebidos do formulário:", { nome, email }); // ADICIONE ISSO PARA VER SE ESTÁ CHEGANDO NO BACKEND
  const query = "INSERT INTO usuarios (nome, email) VALUES ($1, $2) RETURNING *";  // Usando placeholders do PostgreSQL
  pool.query(query, [nome, email ], (err, results) => {
    if (err) {
      console.error("Erro ao inserir usuário:", err);
      return res.status(500).json({ mensagem: "Erro ao adicionar usuário" });
    }

    res.status(201).json({ mensagem: "Usuário adicionado com sucesso!", usuario: results.rows[0] });
  });
});

app.post("/contato", async (req, res) => {
  const { name, email, message } = req.body;

  const query = "INSERT INTO contatos (nome, email, mensagem) VALUES ($1, $2, $3) RETURNING *";

  try {
    const result = await pool.query(query, [name, email, message]);

    // Envio de e-mail
    const transporter = nodemailer.createTransport({
      service: "gmail", // ou outro como outlook, yahoo, etc
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_TO,
      subject: "Nova mensagem de contato",
      text: `Nome: ${name}\nEmail: ${email}\nMensagem:\n${message}`
    });

    res.status(201).json({
      mensagem: "Mensagem enviada com sucesso!",
      contato: result.rows[0]
    });

  } catch (err) {
    console.error("Erro no envio de contato:", err);
    res.status(500).json({ mensagem: "Erro ao enviar mensagem de contato" });
  }
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});


// Rota para registrar novo administrador
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

// Rota para login de administrador
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

    const token = jwt.sign({ id: admin.id, email: admin.email }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.json({ mensagem: "Login bem-sucedido", token });
  } catch (err) {
    console.error("Erro no login de admin:", err);
    res.status(500).json({ mensagem: "Erro no login" });
  }
});
// Middleware simples para verificar token JWT
function autenticarToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]; // Espera: Authorization: Bearer <token>

  if (!token) return res.status(401).send('Token não fornecido');

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).send('Token inválido');

    req.admin = decoded; // Aqui você pode acessar req.admin.id, etc
    next();
  });
}

// Rota protegida para o dashboard
app.get("/dashboard", autenticarToken, (req, res) => {
  res.render("dashboard", { admin: req.admin });
});




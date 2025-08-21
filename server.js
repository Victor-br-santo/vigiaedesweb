require('dotenv').config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken"); // pode deixar caso queira usar no futuro
const nodemailer = require("nodemailer");
const pool = require("./db"); // sua pool do PostgreSQL
const inscricaoRoutes = require('./routes/inscricao');
const postRoutes = require("./routes/posts");

const app = express();
const cookieParser = require('cookie-parser');
app.use(cookieParser());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares globais
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cria pasta uploads se não existir
const uploadDir = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Variáveis de ambiente para email
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;
const emailTo = process.env.EMAIL_TO;

// Rotas de inscrição e posts
app.use('/inscricao', inscricaoRoutes);
app.use(postRoutes);

// Rotas de arquivos estáticos e uploads
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Página de login admin
app.get('/painel/login', (req, res) => {
  res.render('admin/login');
});

// Dashboard sem necessidade de token
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public/dashboard.html")); // ou .ejs se preferir
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

// Rota para login admin simplificado
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

    // Login bem-sucedido: apenas envia mensagem
    res.json({ mensagem: "Login bem-sucedido" });
  } catch (err) {
    console.error("Erro no login de admin:", err);
    res.status(500).json({ mensagem: "Erro no login" });
  }
});

// Rota para listar inscrições (admin)
app.get('/painel/inscricoes', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM inscricoes ORDER BY id DESC');
    res.render('admin/partials/inscricoes', { inscricoes: rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao buscar inscrições');
  }
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

const crypto = require("crypto");

app.post("/inscricao/:id/marcar-pago", async (req, res) => {
  try {
    const { id } = req.params;

    // gerar código único (6 dígitos aleatórios)
    const codigoVerificacao = crypto.randomBytes(3).toString("hex").toUpperCase();

    // atualizar status e salvar código
    await pool.query(
      "UPDATE inscricoes SET status_pagamento = 'pago', codigo_verificacao = $1 WHERE id = $2",
      [codigoVerificacao, id]
    );

    // buscar dados do inscrito (nome e e-mail)
    const { rows } = await pool.query("SELECT nome, email FROM inscricoes WHERE id = $1", [id]);
    const inscrito = rows[0];

    if (inscrito) {
      // enviar e-mail
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: inscrito.email,
        subject: "Confirmação de Inscrição - Capacitação",
        html: `
          <h2>Olá, ${inscrito.nome}!</h2>
          <p>Parabéns 🎉 Sua inscrição foi confirmada com sucesso!</p>
          <p><b>Seu código de verificação é:</b></p>
          <h1 style="color:#2c3e50;">${codigoVerificacao}</h1>
          <p>Guarde este código e apresente no dia do evento.</p>
          <p>Atenciosamente,<br>Equipe da Capacitação</p>
        `
      });
    }

    res.redirect("/painel/inscricoes");
  } catch (err) {
    console.error("Erro ao marcar como pago:", err);
    res.status(500).send("Erro ao marcar como pago: " + err.message);
  }
});




// Rota de contato
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

// Testar conexão ao banco
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.log("Erro ao conectar ao banco:", err);
  } else {
    console.log("Conexão bem-sucedida:", res.rows);
  }
});

// Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

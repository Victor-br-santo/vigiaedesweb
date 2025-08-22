require('dotenv').config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("./db");
const inscricaoRoutes = require('./routes/inscricao');
const postRoutes = require("./routes/posts");
const { sendMail } = require("./mailer");
const crypto = require("crypto");

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
const emailTo = process.env.EMAIL_TO;

// ----------------------
// Funções de validação
// ----------------------
function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function validarCPF(cpf) {
  const regex = /^\d{3}\.\d{3}\.\d{3}\-\d{2}$/; // formato 000.000.000-00
  return regex.test(cpf);
}

function validarCPFReal(cpf) {
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  let soma = 0;
  let resto;

  for (let i = 1; i <= 9; i++) {
    soma += parseInt(cpf[i - 1]) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf[9])) return false;

  soma = 0;
  for (let i = 1; i <= 10; i++) {
    soma += parseInt(cpf[i - 1]) * (12 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf[10])) return false;

  return true;
}

function validarCampo(valor) {
  return valor && valor.trim() !== "";
}

// ----------------------
// Rotas de inscrição e posts
// ----------------------
app.use('/inscricao', inscricaoRoutes);
app.use(postRoutes);

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Página de login admin
app.get('/painel/login', (req, res) => {
  res.render('admin/login');
});

// Dashboard sem necessidade de token
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public/dashboard.html"));
});

// Rota para registrar novo admin
app.post("/admin/registro", async (req, res) => {
  const { nome, email, senha } = req.body;

  if (!validarCampo(nome) || !validarCampo(email) || !validarCampo(senha)) {
    return res.status(400).json({ mensagem: "Todos os campos são obrigatórios" });
  }
  if (!validarEmail(email)) return res.status(400).json({ mensagem: "Email inválido" });

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

  if (!validarCampo(email) || !validarCampo(senha)) {
    return res.status(400).json({ mensagem: "Email e senha são obrigatórios" });
  }

  try {
    const query = "SELECT * FROM admins WHERE email = $1";
    const result = await pool.query(query, [email]);

    if (result.rows.length === 0) return res.status(401).json({ mensagem: "Administrador não encontrado" });

    const admin = result.rows[0];
    const senhaValida = await bcrypt.compare(senha, admin.senha);

    if (!senhaValida) return res.status(401).json({ mensagem: "Senha incorreta" });

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

  if (!validarCampo(nome) || !validarCampo(email)) return res.status(400).json({ mensagem: "Nome e email são obrigatórios" });
  if (!validarEmail(email)) return res.status(400).json({ mensagem: "Email inválido" });

  const query = "INSERT INTO usuarios (nome, email) VALUES ($1, $2) RETURNING *";
  pool.query(query, [nome, email], (err, results) => {
    if (err) return res.status(500).json({ mensagem: "Erro ao adicionar usuário" });
    res.status(201).json({ mensagem: "Usuário adicionado com sucesso!", usuario: results.rows[0] });
  });
});

// Rota para marcar inscrição como paga e enviar e-mail
app.post("/inscricao/:id/marcar-pago", async (req, res) => {
  try {
    const { id } = req.params;
    const codigoVerificacao = crypto.randomBytes(3).toString("hex").toUpperCase();

    await pool.query(
      "UPDATE inscricoes SET status_pagamento = 'pago', codigo_verificacao = $1 WHERE id = $2",
      [codigoVerificacao, id]
    );

    const { rows } = await pool.query("SELECT nome, email FROM inscricoes WHERE id = $1", [id]);
    const inscrito = rows[0];

    if (inscrito) {
      await sendMail({
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

    res.json({ success: true, message: "E-mail enviado com sucesso com o código do inscrito!" });
  } catch (err) {
    console.error("Erro ao marcar como pago:", err);
    res.status(500).json({ error: "Erro ao marcar como pago: " + err.message });
  }
});

// Rota de contato
app.post("/contato", async (req, res) => {
  const { name, email, message } = req.body;

  if (!validarCampo(name) || !validarCampo(email) || !validarCampo(message)) {
    return res.status(400).json({ mensagem: "Todos os campos são obrigatórios" });
  }
  if (!validarEmail(email)) return res.status(400).json({ mensagem: "Email inválido" });

  const query = "INSERT INTO contatos (nome, email, mensagem) VALUES ($1, $2, $3) RETURNING *";
  try {
    const result = await pool.query(query, [name, email, message]);
    await sendMail({
      to: emailTo,
      subject: "Nova mensagem de contato",
      text: `Nome: ${name}\nEmail: ${email}\nMensagem:\n${message}`,
    });
    res.status(201).json({ mensagem: "Mensagem enviada com sucesso!", contato: result.rows[0] });
  } catch (err) {
    console.error("Erro no envio de contato:", err);
    res.status(500).json({ mensagem: "Erro ao enviar mensagem de contato" });
  }
});

// Testar conexão ao banco
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.log("Erro ao conectar ao banco:", err);
  else console.log("Conexão bem-sucedida:", res.rows);
});

// Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

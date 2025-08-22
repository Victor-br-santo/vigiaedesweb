require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { Pool } = require("pg");
const multer = require("multer");
const crypto = require("crypto");
const cloudinary = require("cloudinary").v2;

const app = express();
const cookieParser = require("cookie-parser");
app.use(cookieParser());

// Configuração do PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Configuração do Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer para uploads temporários
const upload = multer({ dest: "uploads/" });

// Configuração do transporte de e-mail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Cria pasta uploads se não existir (temporário)
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Serve arquivos estáticos
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "public")));

// ================= ROTAS ================= //

// Login / registro admin
app.post("/admin/registro", async (req, res) => {
  const { nome, email, senha } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(senha, 10);
    const result = await pool.query(
      "INSERT INTO admins (nome, email, senha) VALUES ($1, $2, $3) RETURNING *",
      [nome, email, hashedPassword]
    );
    res.status(201).json({ mensagem: "Administrador registrado com sucesso!", admin: result.rows[0] });
  } catch (err) {
    console.error("Erro ao registrar admin:", err);
    res.status(500).json({ mensagem: "Erro ao registrar administrador" });
  }
});

app.post("/admin/login", async (req, res) => {
  const { email, senha } = req.body;
  try {
    const result = await pool.query("SELECT * FROM admins WHERE email = $1", [email]);
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

// Página de login admin
app.get("/painel/login", (req, res) => res.render("admin/login"));

// Dashboard
app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "public/dashboard.html")));

// Listar inscrições (admin)
app.get("/painel/inscricoes", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM inscricoes ORDER BY id DESC");
    res.render("admin/partials/inscricoes", { inscricoes: rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao buscar inscrições");
  }
});

// Marcar inscrição como paga e enviar código
app.post("/inscricao/:id/marcar-pago", async (req, res) => {
  try {
    const { id } = req.params;
    const codigoVerificacao = crypto.randomBytes(3).toString("hex").toUpperCase();
    await pool.query(
      "UPDATE inscricoes SET status_pagamento='pago', codigo_verificacao=$1 WHERE id=$2",
      [codigoVerificacao, id]
    );
    const { rows } = await pool.query("SELECT nome, email FROM inscricoes WHERE id=$1", [id]);
    const inscrito = rows[0];
    if (inscrito) {
      await transporter.sendMail({
        from: `"Equipe Capacitação" <${process.env.EMAIL_USER}>`,
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

// Contato
app.post("/contato", async (req, res) => {
  const { name, email, message } = req.body;
  try {
    await transporter.sendMail({
      from: `"Equipe Capacitação" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      subject: "Nova mensagem de contato",
      text: `Nome: ${name}\nEmail: ${email}\nMensagem:\n${message}`,
    });
    await pool.query(
      "INSERT INTO contatos (nome, email, mensagem) VALUES ($1,$2,$3)",
      [name, email, message]
    );
    res.status(201).json({ mensagem: "Mensagem enviada com sucesso!" });
  } catch (err) {
    console.error("Erro no envio de contato:", err);
    res.status(500).json({ mensagem: "Erro ao enviar mensagem de contato" });
  }
});

// Inscrição com upload de comprovante
app.post("/inscricao", upload.single("comprovante"), async (req, res) => {
  const { nome, email, cpf, tipo } = req.body;
  let comprovanteUrl = null;
  try {
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "vigiaedes/comprovantes",
      });
      comprovanteUrl = result.secure_url;
      fs.unlinkSync(req.file.path);
    }
    await pool.query(
      "INSERT INTO inscricoes (nome,email,cpf,tipo,comprovante_url) VALUES ($1,$2,$3,$4,$5)",
      [nome, email, cpf, tipo, comprovanteUrl]
    );
    res.status(200).json({ mensagem: "Inscrição realizada com sucesso!", url: comprovanteUrl });
  } catch (err) {
    console.error("Erro na inscrição:", err);
    res.status(500).json({ mensagem: "Erro ao processar inscrição." });
  }
});

// Posts com upload de imagem
app.post("/posts", upload.single("imagem"), async (req, res) => {
  const { titulo, conteudo } = req.body;
  let imageUrl = null;
  try {
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "vigiaedes/posts",
      });
      imageUrl = result.secure_url;
      fs.unlinkSync(req.file.path);
    }
    await pool.query(
      "INSERT INTO posts (titulo, conteudo, imagem_url) VALUES ($1,$2,$3)",
      [titulo, conteudo, imageUrl]
    );
    res.status(200).json({ mensagem: "Post criado com sucesso!", url: imageUrl });
  } catch (err) {
    console.error("Erro ao criar post:", err);
    res.status(500).json({ mensagem: "Erro ao criar post." });
  }
});

// Buscar usuários
app.get("/usuarios", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM usuarios");
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar usuários:", err);
    res.status(500).json({ mensagem: "Erro ao buscar usuários" });
  }
});

// Adicionar usuário
app.post("/usuarios", async (req, res) => {
  const { nome, email } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO usuarios (nome,email) VALUES ($1,$2) RETURNING *",
      [nome, email]
    );
    res.status(201).json({ mensagem: "Usuário adicionado com sucesso!", usuario: result.rows[0] });
  } catch (err) {
    console.error("Erro ao inserir usuário:", err);
    res.status(500).json({ mensagem: "Erro ao adicionar usuário" });
  }
});

// Testa conexão ao banco
pool.query("SELECT NOW()", (err, resDb) => {
  if (err) console.log("Erro ao conectar ao banco:", err);
  else console.log("Conexão bem-sucedida:", resDb.rows);
});

// ================= INICIALIZA SERVIDOR ================= //
app.listen(process.env.PORT || 3000, () => console.log("Servidor rodando na porta 3000"));

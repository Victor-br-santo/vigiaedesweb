const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const pool = require('../db');
const QRCode = require('qrcode');

// Configuração do upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const nomeUnico = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, nomeUnico);
  }
});
const upload = multer({ storage });

// --- Rota para enviar inscrição ---
router.post('/enviar', upload.single('comprovante'), async (req, res) => {
  try {
    const { nome, email, cpf, tipo } = req.body;
    const comprovante = req.file ? req.file.filename : null;

    await pool.query(
      'INSERT INTO inscricoes (nome, email, cpf, tipo, comprovante) VALUES ($1, $2, $3, $4, $5)',
      [nome, email, cpf, tipo, comprovante]
    );

    // Gerar QR Code Pix (substitua pelo payload real)
    const pixPayload = "000201..."; 
    const qrCodeDataURL = await QRCode.toDataURL(pixPayload);

    res.send(`
      <div style="padding:2rem;font-family:sans-serif;">
        <h2>Inscrição recebida!</h2>
        <p>Em breve você receberá um e-mail com os dados de pagamento via Pix.</p>
        <p>Ou pague agora escaneando o QR Code abaixo:</p>
        <img src="${qrCodeDataURL}" alt="QR Code Pix" />
        <a href="/" style="display:inline-block;margin-top:1rem;">Voltar ao site</a>
      </div>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao processar a inscrição.');
  }
});

// --- Rota para listar inscrições (admin) ---
router.get('/admin-inscricoes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inscricoes ORDER BY data_envio DESC');
    const inscricoes = result.rows;

    let html = `
      <h1>Lista de Inscrições</h1>
      <table border="1" cellpadding="8" cellspacing="0">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nome</th>
            <th>Email</th>
            <th>CPF</th>
            <th>Tipo</th>
            <th>Comprovante</th>
            <th>Status</th>
            <th>Código</th>
            <th>Data</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
    `;

    inscricoes.forEach(inscricao => {
      html += `
        <tr>
          <td>${inscricao.id}</td>
          <td>${inscricao.nome}</td>
          <td>${inscricao.email}</td>
          <td>${inscricao.cpf}</td>
          <td>${inscricao.tipo}</td>
          <td>${inscricao.comprovante ? `<a href="/uploads/${inscricao.comprovante}" target="_blank">Ver arquivo</a>` : '—'}</td>
          <td>${inscricao.status_pagamento || '—'}</td>
          <td>${inscricao.codigo || '—'}</td>
          <td>${new Date(inscricao.data_envio).toLocaleString()}</td>
          <td>
            ${inscricao.status_pagamento === 'pago' ? '✔ Pago' : `<form method="POST" action="/inscricao/${inscricao.id}/marcar-pago">
              <button type="submit">Marcar como pago</button>
            </form>`}
          </td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
      <a href="/" style="display:block;margin-top:20px;">Voltar ao site</a>
    `;

    res.send(html);
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao listar inscrições.');
  }
});

// --- Rota para marcar inscrição como paga (admin) ---
router.post('/:id/marcar-pago', async (req, res) => {
  const { id } = req.params;
  try {
    const codigo = Math.random().toString(36).substring(2, 8).toUpperCase(); // gera código aleatório
    await pool.query(
      'UPDATE inscricoes SET status_pagamento=$1, codigo=$2 WHERE id=$3',
      ['pago', codigo, id]
    );

    // Aqui você pode enviar email ou WhatsApp com o código

    res.redirect('/inscricao/admin-inscricoes');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao marcar inscrição como paga.');
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const pool = require('../db');
const QRCode = require('qrcode');

// Configuração do upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const nomeUnico = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, nomeUnico);
  }
});
const upload = multer({ storage });

// Códigos Pix diferentes
const PIX_COMUM = "00020126580014BR.GOV.BCB.PIX013674d33624-a4d2-4179-9691-d7ddf7dbd2d0520400005303986540530.005802BR5925Victor Bruno Sa dos Santo6009SAO PAULO62140510e359lO0TKe63040B55"; // substitua com o Pix real
const PIX_ESTUDANTE = "00020126580014BR.GOV.BCB.PIX013674d33624-a4d2-4179-9691-d7ddf7dbd2d0520400005303986540520.005802BR5925Victor Bruno Sa dos Santo6009SAO PAULO62140510rQvsWaLPmF630491B5"; // substitua com o Pix real
const WHATSAPP_NUMBER = "5598982344089";

// --- Rota para enviar inscrição ---
router.post('/', upload.single('comprovante'), async (req, res) => {
  try {
    const { nome, email, cpf, tipo } = req.body;
    const comprovante = req.file ? req.file.filename : null;

    // Inserir no banco
    await pool.query(
      'INSERT INTO inscricoes (nome, email, cpf, tipo, comprovante) VALUES ($1, $2, $3, $4, $5)',
      [nome, email, cpf, tipo, comprovante]
    );

    // Escolher Pix correto
    const PIX_CODE = tipo === 'estudante' ? PIX_ESTUDANTE : PIX_COMUM;
    const qrCodeDataURL = await QRCode.toDataURL(PIX_CODE);

    // Resposta HTML
    res.send(`
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
      <div class="container py-5" style="max-width: 500px;">
        <div class="card shadow-sm p-4">
          <h2 class="mb-3 text-center">Inscrição recebida!</h2>
          <p class="text-center">Em breve você receberá um e-mail com os dados de pagamento via Pix.</p>

          <!-- Código Pix -->
          <div class="mb-3">
            <label class="form-label fw-bold">Código Pix (copia e cola)</label>
            <div class="input-group">
              <input type="text" id="pixCode" class="form-control" value="${PIX_CODE}" readonly>
              <button class="btn btn-outline-secondary" type="button" onclick="copiarPix()">Copiar</button>
            </div>
          </div>

          <!-- QR Code -->
          <div class="mb-3 text-center">
            <img src="${qrCodeDataURL}" alt="QR Code Pix" class="img-fluid" style="max-width: 250px;">
            <p class="small mt-2">Leia o QR Code com seu app de pagamento</p>
          </div>

          <!-- Botão WhatsApp -->
          <div class="mb-3 text-center">
            <a href="https://wa.me/${WHATSAPP_NUMBER}" target="_blank" class="btn btn-success w-100">
              Enviar comprovante pelo WhatsApp
            </a>
          </div>

          <div class="text-center">
            <a href="/" class="btn btn-primary w-100">Voltar ao site</a>
          </div>
        </div>
      </div>

      <script>
        function copiarPix() {
          const copyText = document.getElementById("pixCode");
          copyText.select();
          copyText.setSelectionRange(0, 99999);
          document.execCommand("copy");
          alert("Código Pix copiado!");
        }
      </script>
    `);

  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao processar a inscrição.');
  }
});

module.exports = router;

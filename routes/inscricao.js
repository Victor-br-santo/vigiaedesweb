const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../db');
const QRCode = require('qrcode');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// Configuração do Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

if (!process.env.CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.warn('⚠️ Variáveis do Cloudinary não estão configuradas corretamente no .env');
}

// Configuração do multer (sem salvar em pasta local)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Códigos Pix diferentes
const PIX_COMUM = "00020101021126360014br.gov.bcb.pix011460808286000168520400005303986540530.005802BR5921VIGIAEDES S I I S I S6007SANTANA62070503***6304EEB8";
const PIX_ESTUDANTE = "00020101021126360014br.gov.bcb.pix011460808286000168520400005303986540520.005802BR5921VIGIAEDES S I I S I S6007SANTANA62070503***63049564";
const WHATSAPP_NUMBER = "559698102-9439";

// Função utilitária para subir buffer para Cloudinary usando Promise
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "vigiaedes/comprovantes" },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

// --- Rota para enviar inscrição ---
router.post('/', upload.single('comprovante'), async (req, res) => {
  try {
    const { nome, email, cpf, tipo } = req.body;
    let comprovanteUrl = null;

    // Subir para Cloudinary se houver arquivo, mas sem quebrar a inscrição
    if (req.file) {
      try {
        const result = await uploadToCloudinary(req.file.buffer);
        comprovanteUrl = result.secure_url;
      } catch (uploadError) {
        console.warn("⚠️ Falha ao subir comprovante para Cloudinary, prosseguindo sem ele:", uploadError.message);
        comprovanteUrl = null; // a inscrição continua mesmo se o upload falhar
      }
    }

    // Inserir no banco
    await pool.query(
      'INSERT INTO inscricoes (nome, email, cpf, tipo, comprovante_url) VALUES ($1, $2, $3, $4, $5)',
      [nome, email, cpf, tipo, comprovanteUrl]
    );

    // Escolher Pix correto
    const PIX_CODE = tipo === 'estudante' ? PIX_ESTUDANTE : PIX_COMUM;
    const qrCodeDataURL = await QRCode.toDataURL(PIX_CODE);

    res.send(`
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
      <div class="container py-5" style="max-width: 500px;">
        <div class="card shadow-sm p-4">
          <h2 class="mb-3 text-center">Inscrição recebida!</h2>
          <p class="text-center fw-bold" style="font-size:1rem; color:#333;">
            Após a confirmação do pagamento, você receberá um e-mail com seu código de verificação.
          </p>
          <div class="alert alert-warning text-center fw-bold" role="alert" style="font-size:0.95rem; margin-top:0.5rem;">
            ⚠️ Não se esqueça de efetuar o pagamento!
          </div>
          <div class="mb-3 mt-3">
            <label class="form-label fw-bold">Código Pix (copie e cole)</label>
            <div class="input-group">
              <input type="text" id="pixCode" class="form-control" value="${PIX_CODE}" readonly>
              <button class="btn btn-outline-secondary" type="button" onclick="copiarPix()">Copiar</button>
            </div>
          </div>
          <div class="mb-3 text-center">
            <img src="${qrCodeDataURL}" alt="QR Code Pix" class="img-fluid" style="max-width: 250px;">
            <p class="small mt-2">Leia o QR Code com seu app de pagamento</p>
          </div>
          <div class="mb-3 text-center">
            <a href="https://wa.me/${WHATSAPP_NUMBER}" target="_blank" class="btn btn-success w-100">
              Enviar comprovante pelo WhatsApp
            </a>
          </div>
          <div class="text-center mt-3">
            <a href="/" class="btn btn-primary w-100" style="padding:0.75rem; font-size:1.1rem; border-radius:10px;">
              Voltar ao site
            </a>
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
    console.error("Erro na inscrição:", err);
    res.status(500).send('Erro ao processar a inscrição.');
  }
});

module.exports = router;

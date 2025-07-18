const multer = require("multer");
const path = require("path");

// Define o destino e o nome dos arquivos de imagem enviados
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads"); // pasta onde as imagens ficarão salvas
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname); // extensão .jpg, .png etc.
    cb(null, `${timestamp}${ext}`); // exemplo: 1721394812342.jpg
  }
});

// Exporta o middleware para ser usado nas rotas
const upload = multer({ storage });

module.exports = upload;

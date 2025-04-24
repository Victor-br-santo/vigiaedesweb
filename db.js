const mysql = require('mysql2');

const conexao = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',           // coloca a senha do seu MySQL se tiver
  database: 'db_princesa',   // troca pelo nome do seu banco
  port: 3306              // troca pela porta que você configurou
});

conexao.connect((err) => {
  if (err) {
    console.error('Erro ao conectar com o MySQL:', err);
  } else {
    console.log('✅ Conectado ao MySQL com sucesso!');
  }
});

module.exports = conexao;

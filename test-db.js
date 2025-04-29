const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:0411051320@db.asbsmbjmvvdehmjqztbz.supabase.co:5432/postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect()
  .then(() => {
    console.log('✅ Conectado ao PostgreSQL com sucesso!');
    pool.end();
  })
  .catch(err => {
    console.error('Erro ao conectar com o PostgreSQL:', err);
  });

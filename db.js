require("dotenv").config();
const { Pool } = require('pg');
console.log('📦 DATABASE_URL:', process.env.DATABASE_URL);


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

console.log('✅ Pool PostgreSQL configurado com sucesso!');
module.exports = pool;

const express = require('express');
const usuariosController = require('./controllers/usuarios.controller');
const usuariosRoutes = require('./routes/usuarios.routes');

const app = express();

app.use(express.json());

// Endpoint de verificação de integridade (Health Check)
app.get('/health', usuariosController.healthCheck);

// Rotas do recurso de Usuários
app.use('/usuarios', usuariosRoutes);

// Middleware central de tratamento de erros
// Garante respostas padronizadas no formato {"erro":"mensagem"}
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  const mensagem = err.message || 'Erro interno do servidor';

  // Loga erros internos no console
  if (status >= 500) {
    console.error('Erro interno:', err);
  }

  res.status(status).json({ erro: mensagem });
});

module.exports = app;

const app = require('./app');
const env = require('./config/env');
const publisher = require('./events/publisher');

async function start() {
  try {
    // Conecta ao RabbitMQ com política de retry antes de aceitar tráfego
    await publisher.conectar();
  } catch (err) {
    console.error('[RabbitMQ] Aviso: Não foi possível estabelecer conexão com o RabbitMQ no startup:', err.message);
  }

  app.listen(env.PORT, () => {
    console.log(`[usuarios-service] Servidor rodando na porta ${env.PORT}`);
  });
}

start();

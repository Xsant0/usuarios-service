const amqp = require('amqplib');
const env = require('../config/env');

const EXCHANGE_NAME = 'usuarios.events';
const EXCHANGE_TYPE = 'topic';
const ROUTING_KEY_CRIADO = 'usuario.criado';

let connection = null;
let channel = null;

/**
 * Conecta ao RabbitMQ com política de retry (até 10 tentativas com intervalo de 3s)
 * e garante a declaração da exchange durável usuarios.events do tipo topic.
 */
async function conectar(tentativasMaximas = 10, intervaloMs = 3000) {
  for (let tentativa = 1; tentativa <= tentativasMaximas; tentativa++) {
    try {
      console.log(`[RabbitMQ] Tentando conectar (${tentativa}/${tentativasMaximas})...`);
      connection = await amqp.connect(env.RABBITMQ_URL);
      channel = await connection.createChannel();

      // Declara a exchange do tipo topic e durável
      await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, { durable: true });

      connection.on('error', (err) => {
        console.error('[RabbitMQ] Erro na conexão:', err.message);
      });

      connection.on('close', () => {
        console.warn('[RabbitMQ] Conexão encerrada. Tentando reconectar...');
        channel = null;
        connection = null;
        setTimeout(() => conectar(tentativasMaximas, intervaloMs), intervaloMs);
      });

      console.log(`[RabbitMQ] Conectado com sucesso e exchange "${EXCHANGE_NAME}" declarada.`);
      return;
    } catch (err) {
      console.error(`[RabbitMQ] Falha na tentativa ${tentativa}: ${err.message}`);
      if (tentativa === tentativasMaximas) {
        throw new Error(`Não foi possível conectar ao RabbitMQ após ${tentativasMaximas} tentativas.`);
      }
      await new Promise((resolve) => setTimeout(resolve, intervaloMs));
    }
  }
}

/**
 * Publica o evento usuario.criado de forma persistente na exchange usuarios.events.
 */
async function publicarUsuarioCriado(usuario) {
  if (!channel) {
    throw new Error('Canal com RabbitMQ não está disponível para publicação');
  }

  const payload = {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    criadoEm: usuario.criadoEm instanceof Date ? usuario.criadoEm.toISOString() : new Date(usuario.criadoEm).toISOString()
  };

  const buffer = Buffer.from(JSON.stringify(payload));

  // Publica a mensagem de forma persistente (deliveryMode: 2)
  channel.publish(EXCHANGE_NAME, ROUTING_KEY_CRIADO, buffer, {
    persistent: true
  });

  console.log(`[RabbitMQ] Evento "${ROUTING_KEY_CRIADO}" publicado com sucesso:`, payload);
}

module.exports = {
  conectar,
  publicarUsuarioCriado
};

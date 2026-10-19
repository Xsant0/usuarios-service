const prisma = require('../config/prisma');
const publisher = require('../events/publisher');

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

function isEmailValido(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

async function checkDatabaseHealth() {
  await prisma.$queryRaw`SELECT 1`;
  return { status: 'ok' };
}

async function criarUsuario({ nome, email }) {
  if (!nome || typeof nome !== 'string' || nome.trim() === '' || !email || typeof email !== 'string' || email.trim() === '') {
    throw new AppError('Nome e email são obrigatórios', 400);
  }

  const emailNormalizado = email.trim().toLowerCase();
  if (!isEmailValido(emailNormalizado)) {
    throw new AppError('Formato de email inválido', 400);
  }

  const usuarioExistente = await prisma.usuario.findUnique({
    where: { email: emailNormalizado }
  });

  if (usuarioExistente) {
    throw new AppError('Email já cadastrado', 409);
  }

  // 1. Gravação local no banco de dados com garantia de integridade ACID
  const usuario = await prisma.usuario.create({
    data: {
      nome: nome.trim(),
      email: emailNormalizado
    }
  });

  // 2. Publicação do evento no RabbitMQ APÓS persistência com sucesso no banco.
  // DECISÃO DE DESIGN (Consistência Eventual):
  // Caso a publicação do evento falhe por indisponibilidade transitória do broker RabbitMQ,
  // registramos o erro no log e prosseguimos com o retorno 201 de sucesso do usuário criado.
  // Isso prioriza a disponibilidade do microsserviço de Usuários em relação à dependência externa,
  // permitindo que os consumidores alcancem consistência eventual posteriormente.
  try {
    await publisher.publicarUsuarioCriado(usuario);
  } catch (error) {
    console.error('[RabbitMQ] Erro ao publicar evento usuario.criado:', error.message || error);
  }

  return usuario;
}

async function listarUsuarios() {
  return prisma.usuario.findMany({
    orderBy: { id: 'asc' }
  });
}

async function buscarUsuarioPorId(idParam) {
  const id = parseInt(idParam, 10);
  if (isNaN(id)) {
    throw new AppError('Usuário não encontrado', 404);
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id }
  });

  if (!usuario) {
    throw new AppError('Usuário não encontrado', 404);
  }

  return usuario;
}

async function atualizarUsuario(idParam, { nome, email }) {
  const id = parseInt(idParam, 10);
  if (isNaN(id)) {
    throw new AppError('Usuário não encontrado', 404);
  }

  const usuarioExistente = await prisma.usuario.findUnique({
    where: { id }
  });

  if (!usuarioExistente) {
    throw new AppError('Usuário não encontrado', 404);
  }

  if ((nome === undefined || nome === null) && (email === undefined || email === null)) {
    throw new AppError('Informe nome e/ou email para atualização', 400);
  }

  const dadosAtualizacao = {};

  if (nome !== undefined) {
    if (typeof nome !== 'string' || nome.trim() === '') {
      throw new AppError('Nome inválido', 400);
    }
    dadosAtualizacao.nome = nome.trim();
  }

  if (email !== undefined) {
    if (typeof email !== 'string' || email.trim() === '') {
      throw new AppError('Email inválido', 400);
    }
    const emailNormalizado = email.trim().toLowerCase();
    if (!isEmailValido(emailNormalizado)) {
      throw new AppError('Formato de email inválido', 400);
    }

    if (emailNormalizado !== usuarioExistente.email) {
      const emailEmUso = await prisma.usuario.findUnique({
        where: { email: emailNormalizado }
      });
      if (emailEmUso) {
        throw new AppError('Email já cadastrado', 409);
      }
    }
    dadosAtualizacao.email = emailNormalizado;
  }

  return prisma.usuario.update({
    where: { id },
    data: dadosAtualizacao
  });
}

async function removerUsuario(idParam) {
  const id = parseInt(idParam, 10);
  if (isNaN(id)) {
    throw new AppError('Usuário não encontrado', 404);
  }

  const usuarioExistente = await prisma.usuario.findUnique({
    where: { id }
  });

  if (!usuarioExistente) {
    throw new AppError('Usuário não encontrado', 404);
  }

  await prisma.usuario.delete({
    where: { id }
  });
}

module.exports = {
  AppError,
  checkDatabaseHealth,
  criarUsuario,
  listarUsuarios,
  buscarUsuarioPorId,
  atualizarUsuario,
  removerUsuario
};

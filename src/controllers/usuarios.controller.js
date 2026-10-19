const usuariosService = require('../services/usuarios.service');

/**
 * Controller responsável estritamente pela camada HTTP.
 * Não contém regras de negócio e não acessa o banco diretamente.
 */
async function healthCheck(req, res, next) {
  try {
    const health = await usuariosService.checkDatabaseHealth();
    return res.status(200).json(health);
  } catch (error) {
    return next(error);
  }
}

async function criar(req, res, next) {
  try {
    const { nome, email } = req.body;
    const usuario = await usuariosService.criarUsuario({ nome, email });
    return res.status(201).json(usuario);
  } catch (error) {
    return next(error);
  }
}

async function listar(req, res, next) {
  try {
    const usuarios = await usuariosService.listarUsuarios();
    return res.status(200).json(usuarios);
  } catch (error) {
    return next(error);
  }
}

async function buscarPorId(req, res, next) {
  try {
    const { id } = req.params;
    const usuario = await usuariosService.buscarUsuarioPorId(id);
    return res.status(200).json(usuario);
  } catch (error) {
    return next(error);
  }
}

async function atualizar(req, res, next) {
  try {
    const { id } = req.params;
    const { nome, email } = req.body;
    const usuario = await usuariosService.atualizarUsuario(id, { nome, email });
    return res.status(200).json(usuario);
  } catch (error) {
    return next(error);
  }
}

async function remover(req, res, next) {
  try {
    const { id } = req.params;
    await usuariosService.removerUsuario(id);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  healthCheck,
  criar,
  listar,
  buscarPorId,
  atualizar,
  remover
};

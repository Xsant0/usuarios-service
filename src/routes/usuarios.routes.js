const { Router } = require('express');
const usuariosController = require('../controllers/usuarios.controller');

const router = Router();

// Mapeamento das rotas para as funções do controller
// A camada de rotas nunca importa o Prisma nem contém regras de negócio
router.post('/', usuariosController.criar);
router.get('/', usuariosController.listar);
router.get('/:id', usuariosController.buscarPorId);
router.put('/:id', usuariosController.atualizar);
router.delete('/:id', usuariosController.remover);

module.exports = router;

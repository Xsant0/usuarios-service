const { PrismaClient } = require('@prisma/client');

// Instância única (Singleton) do Prisma Client para o serviço de Usuários
const prisma = new PrismaClient();

module.exports = prisma;

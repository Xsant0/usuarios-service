# Microsserviço de Usuários

> **PoC de Arquitetura de Microsserviços**  
> Disciplina: Análise e Projeto de Software — Universidade Católica de Brasília (UCB)  
> Responsável: Marcelo Henrique (P2 — Serviço de Usuários)

---

## 1. Visão Geral e Regras do Padrão

Este microsserviço é o componente responsável pelo gerenciamento de usuários e publicação de eventos de domínio na Prova de Conceito (PoC). O projeto segue rigorosamente os princípios de microsserviços estabelecidos na literatura (Newman, Richardson):

1. **Database per Service**: O serviço possui e gerencia seu próprio banco de dados relacional (`usuarios-db`), garantindo que nenhum outro serviço (como o de Pedidos) tenha acesso direto às suas tabelas.
2. **Autonomia e Desacoplamento**: O serviço pode ser compilado, iniciado, testado e evoluído de forma 100% independente.
3. **Comunicação Assíncrona Orientada a Eventos**: Mudanças de estado relevantes (ex.: criação de um usuário) são propagadas via mensagens duráveis e persistentes através do RabbitMQ na exchange `usuarios.events` com a routing key `usuario.criado`.
4. **Separação Rígida em Camadas**:
   $$\text{Routes} \longrightarrow \text{Controllers} \longrightarrow \text{Services} \longrightarrow \begin{cases} \text{Prisma ORM (PostgreSQL)} \\ \text{Publisher (RabbitMQ)} \end{cases}$$
   - A camada de rotas nunca acessa banco nem conhece o Prisma.
   - O controller apenas manipula requisições/respostas HTTP (status code, headers, payload).
   - O service concentra todas as regras de negócio e orquestra a persistência e eventos.

---

## 2. Componentes do Serviço (Mapeamento para Diagrama)

Para fins de modelagem arquitetural (diagrama de componentes), os elementos mapeiam diretamente os módulos do código-fonte:

| Componente | Arquivo / Recurso | Função |
|---|---|---|
| **HTTP Entrypoint** | `src/index.js` & `src/app.js` | Inicialização do servidor Express (porta 3001) e middleware central de erros. |
| **Routes** | `src/routes/usuarios.routes.js` | Definição dos endpoints REST e encaminhamento ao controller. |
| **Controller** | `src/controllers/usuarios.controller.js` | Extração de parâmetros HTTP e despacho para a camada de serviço. |
| **Service (Negócio)** | `src/services/usuarios.service.js` | Validações de integridade, regras de negócio e decisões de consistência eventual. |
| **Data Access (ORM)** | `src/config/prisma.js` & `prisma/` | Mapeamento objeto-relacional (Prisma 6) e migrações para PostgreSQL. |
| **Event Publisher** | `src/events/publisher.js` | Gerenciamento de canal AMQP e publicação resiliente no RabbitMQ. |
| **Config / Env** | `src/config/env.js` | Leitura centralizada de variáveis de ambiente. |
| **Database** | Container `usuarios-db` | Instância isolada do PostgreSQL 16. |
| **Message Broker** | Container `rabbitmq` | Broker RabbitMQ 3 com interface de gerenciamento. |

---

## 3. Stack Tecnológica

- **Runtime**: Node.js 20+ (CommonJS)
- **Framework Web**: Express 4
- **ORM**: Prisma ORM 6 (`prisma` e `@prisma/client`)
- **Banco de Dados**: PostgreSQL 16
- **Mensageria**: RabbitMQ 3 (`amqplib`)
- **Orquestração**: Docker e Docker Compose

---

## 4. Variáveis de Ambiente

As configurações são definidas via variáveis de ambiente. Veja o exemplo em `.env.example`:

| Variável | Descrição | Exemplo no Docker Compose | Exemplo Local (Host) |
|---|---|---|---|
| `PORT` | Porta HTTP da aplicação | `3001` | `3001` |
| `DATABASE_URL` | String de conexão PostgreSQL | `postgresql://usuarios:usuarios@usuarios-db:5432/usuarios` | `postgresql://usuarios:usuarios@localhost:5433/usuarios` |
| `RABBITMQ_URL` | URL de conexão AMQP | `amqp://guest:guest@rabbitmq:5672` | `amqp://guest:guest@localhost:5672` |

> **Nota:** Para desenvolvimento local direto na máquina host, a porta do banco PostgreSQL é mapeada para `5433` no host para evitar conflito com instâncias locais do Postgres na porta padrão 5432.

---

## 5. Como Subir o Ambiente

Execute na raiz da pasta `usuarios-service/`:

```bash
docker compose up --build
```

### O que o Docker Compose executa automaticamente:
1. Sobe o container `usuarios-db` (PostgreSQL 16) e aguarda seu healthcheck (`pg_isready`).
2. Sobe o container `rabbitmq` (RabbitMQ 3 Management) e aguarda sua inicialização.
3. Sobe o container `usuarios-service`:
   - Executa automaticamente as migrações: `npx prisma migrate deploy`.
   - Conecta ao RabbitMQ com política de até 10 retries a cada 3 segundos.
   - Declara a exchange durável `usuarios.events` (tipo `topic`).
   - Inicia o servidor HTTP na porta `3001`.

Para parar e remover os containers:
```bash
docker compose down
```
*(Caso queira limpar os volumes e dados do banco: `docker compose down -v`)*

---

## 6. Exemplos de Chamadas (`curl`)

### 6.1. Health Check
Verifica o status da API e a conectividade real com o banco de dados PostgreSQL:
```bash
curl -i -X GET http://localhost:3001/health
```
**Resposta (200 OK):**
```json
{
  "status": "ok"
}
```

---

### 6.2. Criar Usuário (`POST /usuarios`)
Persiste o usuário no banco e publica o evento `usuario.criado` no RabbitMQ:
```bash
curl -i -X POST http://localhost:3001/usuarios \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Marcelo Henrique",
    "email": "marcelo@email.com"
  }'
```
**Resposta (201 Created):**
```json
{
  "id": 1,
  "nome": "Marcelo Henrique",
  "email": "marcelo@email.com",
  "criadoEm": "2026-10-19T10:10:00.000Z"
}
```

#### Teste de Erro de Validação (400 Bad Request):
```bash
curl -i -X POST http://localhost:3001/usuarios \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "",
    "email": "invalido"
  }'
```
**Resposta (400 Bad Request):**
```json
{
  "erro": "Nome e email são obrigatórios"
}
```

#### Teste de Email Duplicado (409 Conflict):
```bash
curl -i -X POST http://localhost:3001/usuarios \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Outro Marcelo",
    "email": "marcelo@email.com"
  }'
```
**Resposta (409 Conflict):**
```json
{
  "erro": "Email já cadastrado"
}
```

---

### 6.3. Listar Todos os Usuários (`GET /usuarios`)
```bash
curl -i -X GET http://localhost:3001/usuarios
```
**Resposta (200 OK):**
```json
[
  {
    "id": 1,
    "nome": "Marcelo Henrique",
    "email": "marcelo@email.com",
    "criadoEm": "2026-10-19T10:10:00.000Z"
  }
]
```

---

### 6.4. Buscar Usuário por ID (`GET /usuarios/:id`)
```bash
curl -i -X GET http://localhost:3001/usuarios/1
```
**Resposta (200 OK):**
```json
{
  "id": 1,
  "nome": "Marcelo Henrique",
  "email": "marcelo@email.com",
  "criadoEm": "2026-10-19T10:10:00.000Z"
}
```

#### Teste de ID Inexistente (404 Not Found):
```bash
curl -i -X GET http://localhost:3001/usuarios/999
```
**Resposta (404 Not Found):**
```json
{
  "erro": "Usuário não encontrado"
}
```

---

### 6.5. Atualizar Usuário (`PUT /usuarios/:id`)
Permite atualizar `nome` e/ou `email`:
```bash
curl -i -X PUT http://localhost:3001/usuarios/1 \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Marcelo Henrique da Silva"
  }'
```
**Resposta (200 OK):**
```json
{
  "id": 1,
  "nome": "Marcelo Henrique da Silva",
  "email": "marcelo@email.com",
  "criadoEm": "2026-10-19T10:10:00.000Z"
}
```

---

### 6.6. Remover Usuário (`DELETE /usuarios/:id`)
```bash
curl -i -X DELETE http://localhost:3001/usuarios/1
```
**Resposta (204 No Content):** (corpo vazio)

---

## 7. Como Inspecionar o Evento no Painel do RabbitMQ

Ao criar um usuário via `POST /usuarios`, a mensagem é publicada na exchange `usuarios.events` com routing key `usuario.criado`. Para auditar visualmente a mensagem no painel:

1. Acesse no navegador: **[http://localhost:15672](http://localhost:15672)**
2. Faça login com as credenciais padrão:
   - **Username**: `guest`
   - **Password**: `guest`
3. Vá na aba **Queues** e crie uma fila de teste para escutar os eventos:
   - No formulário **Add a new queue**:
     - **Name**: `fila-teste-pedidos`
     - Clique em **Add queue**.
4. Clique na fila recém-criada (`fila-teste-pedidos`) e expanda a seção **Bindings**:
   - No campo **From exchange**: digite `usuarios.events`
   - No campo **Routing key**: digite `usuario.criado`
   - Clique em **Bind**.
5. Dispare uma requisição de criação de usuário pelo terminal:
   ```bash
   curl -X POST http://localhost:3001/usuarios \
     -H "Content-Type: application/json" \
     -d '{"nome":"Novo Aluno","email":"aluno@ucb.br"}'
   ```
6. Volte à página da fila no RabbitMQ, expanda a seção **Get messages**:
   - Defina o campo **Messages**: `1`
   - Clique no botão **Get Message(s)**.
7. Você verá o payload JSON e os headers da mensagem:
   ```json
   {
     "id": 2,
     "nome": "Novo Aluno",
     "email": "aluno@ucb.br",
     "criadoEm": "2026-10-19T10:15:30.123Z"
   }
   ```
   - Propriedade: `delivery_mode: 2` (mensagem persistente).

---

## 8. Justificativas de Decisões de Design (Para Apresentação e Relatório)

- **Consistência Eventual no Evento**: O registro é persistido localmente primeiro com garantia ACID. Se a conexão com o broker RabbitMQ falhar pontualmente na publicação do evento, o serviço loga a ocorrência e responde `201 Created` normalmente. Em sistemas distribuídos, prioriza-se a disponibilidade local (teorema CAP) sobre o acoplamento síncrono.
- **Isolamento de Banco (Database per Service)**: Garante baixo acoplamento. Caso o serviço de Pedidos mude seu esquema ou tecnologia de banco de dados, o serviço de Usuários não sofre impacto.
- **Topologia de Mensageria (Topic Exchange)**: Permite que novos consumidores no ecossistema (como serviços de notificação, auditoria ou BI) vinculem suas próprias filas usando padrões como `usuario.*` sem necessidade de alterar o código do serviço publicador.

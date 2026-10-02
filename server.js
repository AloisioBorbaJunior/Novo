const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const express = require('express');

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));


// ===== Produtos =====
const PRODUCTS_DATA_FILE = process.env.PRODUCTS_DATA_FILE
  ? path.resolve(process.env.PRODUCTS_DATA_FILE)
  : path.join(__dirname, '.data', 'products.json');
let products = [];
let productWriteQueue = Promise.resolve();

async function loadProducts() {
  await fs.promises.mkdir(path.dirname(PRODUCTS_DATA_FILE), { recursive: true });
  try {
    const data = await fs.promises.readFile(PRODUCTS_DATA_FILE, 'utf8');
    const storedProducts = JSON.parse(data);
    if (!Array.isArray(storedProducts)) throw new Error('Arquivo de produtos inválido.');

    const nextIds = new Map();
    products = storedProducts.map((product) => {
      if (!product || typeof product.userId !== 'string' || typeof product.nome !== 'string') {
        throw new Error('O arquivo de produtos contém registros inválidos.');
      }

      if (typeof product.id === 'number' && Number.isSafeInteger(product.id)) return product;

      const id = (nextIds.get(product.userId) || 0) + 1;
      nextIds.set(product.userId, id);
      return {
        id,
        userId: product.userId,
        nome: product.nome,
        custo: Number(product.custo) || 0,
        venda: Number(product.venda ?? product.preco) || 0,
        quantidade: Number.isSafeInteger(product.quantidade) ? product.quantidade : 0
      };
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      products = [];
    } else {
      throw error;
    }
  }
}

function saveProducts() {
  const temporaryFile = `${PRODUCTS_DATA_FILE}.${crypto.randomUUID()}.tmp`;
  return fs.promises.writeFile(temporaryFile, JSON.stringify(products, null, 2), { mode: 0o600 })
    .then(() => fs.promises.rename(temporaryFile, PRODUCTS_DATA_FILE));
}

function serializeProductWrite(operation) {
  const result = productWriteQueue.then(operation);
  productWriteQueue = result.catch(() => {});
  return result;
}

function normalizeProductInput(input) {
  if (!input || typeof input !== 'object') return null;
  const nome = typeof input.nome === 'string' ? input.nome.trim() : '';
  const custo = input.custo;
  const venda = input.venda;
  const quantidade = input.quantidade;

  if (
    nome.length < 1 ||
    nome.length > 120 ||
    typeof custo !== 'number' || !Number.isFinite(custo) || custo < 0 ||
    typeof venda !== 'number' || !Number.isFinite(venda) || venda < 0 ||
    !Number.isSafeInteger(quantidade) || quantidade < 0
  ) {
    return null;
  }
  return { nome, custo, venda, quantidade };
}

app.get('/api/produtos', requireAuth, (req, res) => {
  const authenticatedSession = getSession(req);
  const userProducts = products.filter((product) => product.userId === authenticatedSession.session.userId);
  return res.json({ produtos: userProducts });
});

app.post('/api/produtos/import', requireAuth, async (req, res, next) => {
  const legacyProducts = req.body?.produtos;
  if (!Array.isArray(legacyProducts) || legacyProducts.length > 500) {
    return res.status(400).json({ error: 'A lista de produtos para importar é inválida.' });
  }

  const normalizedProducts = legacyProducts.map(normalizeProductInput);
  if (normalizedProducts.some((product) => product === null)) {
    return res.status(400).json({ error: 'A lista contém produtos inválidos.' });
  }

  try {
    const result = await serializeProductWrite(async () => {
      const authenticatedSession = getSession(req);
      const userId = authenticatedSession.session.userId;
      if (products.some((product) => product.userId === userId)) return null;

      const nextId = products
        .filter((product) => product.userId === userId)
        .reduce((highest, product) => Math.max(highest, product.id), 0) + 1;
      const importedProducts = normalizedProducts.map((product, index) => ({
        id: nextId + index,
        userId,
        ...product
      }));
      const previousProducts = products;
      products = [...products, ...importedProducts];

      try {
        await saveProducts();
      } catch (error) {
        products = previousProducts;
        throw error;
      }
      return importedProducts;
    });

    if (!result) {
      return res.status(409).json({ error: 'Esta conta já possui produtos cadastrados.' });
    }
    return res.status(201).json({ produtos: result });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/produtos', requireAuth, async (req, res, next) => {
  const productInput = normalizeProductInput(req.body);
  if (!productInput) {
    return res.status(400).json({ error: 'Informe nome, custo, venda e quantidade válidos.' });
  }

  try {
    const product = await serializeProductWrite(async () => {
      const authenticatedSession = getSession(req);
      const userId = authenticatedSession.session.userId;
      const id = products
        .filter((existingProduct) => existingProduct.userId === userId)
        .reduce((highest, existingProduct) => Math.max(highest, existingProduct.id), 0) + 1;
      const newProduct = { id, userId, ...productInput };
      products.push(newProduct);
      try {
        await saveProducts();
      } catch (error) {
        products.pop();
        throw error;
      }
      return newProduct;
    });

    return res.status(201).json({ produto: product });
  } catch (error) {
    return next(error);
  }
});

app.put('/api/produtos/:id', requireAuth, async (req, res, next) => {
  const id = Number(req.params.id);
  const productInput = normalizeProductInput(req.body);
  if (!Number.isSafeInteger(id) || id < 1 || !productInput) {
    return res.status(400).json({ error: 'Produto inválido.' });
  }

  try {
    const updatedProduct = await serializeProductWrite(async () => {
      const authenticatedSession = getSession(req);
      const index = products.findIndex((product) =>
        product.id === id && product.userId === authenticatedSession.session.userId
      );
      if (index === -1) return null;

      const previousProduct = products[index];
      const nextProduct = { ...previousProduct, ...productInput };
      products[index] = nextProduct;
      try {
        await saveProducts();
      } catch (error) {
        products[index] = previousProduct;
        throw error;
      }
      return nextProduct;
    });

    if (!updatedProduct) return res.status(404).json({ error: 'Produto não encontrado.' });
    return res.json({ produto: updatedProduct });
  } catch (error) {
    return next(error);
  }
});

app.delete('/api/produtos/:id', requireAuth, async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Produto inválido.' });
  }

  try {
    const deleted = await serializeProductWrite(async () => {
      const authenticatedSession = getSession(req);
      const index = products.findIndex((product) =>
        product.id === id && product.userId === authenticatedSession.session.userId
      );
      if (index === -1) return false;

      const [deletedProduct] = products.splice(index, 1);
      try {
        await saveProducts();
      } catch (error) {
        products.splice(index, 0, deletedProduct);
        throw error;
      }
      return true;
    });

    if (!deleted) return res.status(404).json({ error: 'Produto não encontrado.' });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

const HOSTNAME = '0.0.0.0';
const requestedPort = Number(process.argv[2]) || Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const AUTH_DATA_FILE = process.env.AUTH_USERS_FILE
  ? path.resolve(process.env.AUTH_USERS_FILE)
  : path.join(__dirname, '.data', 'users.json');
const SESSION_COOKIE = 'sid';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const sessions = new Map();
const scrypt = (password, salt) => new Promise((resolve, reject) => {
  crypto.scrypt(password, salt, 64, (error, derivedKey) => {
    if (error) reject(error);
    else resolve(derivedKey);
  });
});

let users = [];
let userStoreQueue = Promise.resolve();

function mostrarMensagem(msg) {
  console.log(`[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`);
}

async function loadUsers() {
  await fs.promises.mkdir(path.dirname(AUTH_DATA_FILE), { recursive: true });

  try {
    const data = await fs.promises.readFile(AUTH_DATA_FILE, 'utf8');
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      throw new Error('O arquivo de usuários precisa conter uma lista.');
    }
    users = parsed;
  } catch (error) {
    if (error.code === 'ENOENT') {
      users = [];
      return;
    }
    throw error;
  }
}

function saveUsers() {
  const temporaryFile = `${AUTH_DATA_FILE}.${crypto.randomUUID()}.tmp`;
  return fs.promises.writeFile(temporaryFile, JSON.stringify(users, null, 2), { mode: 0o600 })
    .then(() => fs.promises.rename(temporaryFile, AUTH_DATA_FILE));
}

function serializeUserWrite(operation) {
  const result = userStoreQueue.then(operation);
  userStoreQueue = result.catch(() => {});
  return result;
}

function getSession(req) {
  const cookie = req.headers.cookie || '';
  const sessionId = cookie.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);

  if (!sessionId) return null;

  const session = sessions.get(sessionId);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return { sessionId, session };
}

function setSessionCookie(res, sessionId) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DURATION_MS / 1000}${secure}`
  );
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
}

function requireAuth(req, res, next) {
  const authenticatedSession = getSession(req);
  if (!authenticatedSession) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Faça login para continuar.' });
    }
    return res.redirect('/login');
  }

  authenticatedSession.session.expiresAt = Date.now() + SESSION_DURATION_MS;
  res.setHeader('Cache-Control', 'no-store');
  next();
}

app.post('/api/auth/register', async (req, res, next) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (username.length < 3 || username.length > 40) {
    return res.status(400).json({ error: 'O usuário deve ter entre 3 e 40 caracteres.' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'A senha deve ter entre 8 e 128 caracteres.' });
  }

  try {
    const user = await serializeUserWrite(async () => {
      const normalizedUsername = username.toLocaleLowerCase('pt-BR');
      if (users.some((existingUser) => existingUser.username.toLocaleLowerCase('pt-BR') === normalizedUsername)) {
        return null;
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = (await scrypt(password, salt)).toString('hex');
      const newUser = {
        id: crypto.randomUUID(),
        username,
        salt,
        passwordHash
      };

      users.push(newUser);
      try {
        await saveUsers();
      } catch (error) {
        users.pop();
        throw error;
      }
      return newUser;
    });

    if (!user) {
      return res.status(409).json({ error: 'Este usuário já está cadastrado.' });
    }
    return res.status(201).json({ message: 'Usuário cadastrado com sucesso.' });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const normalizedUsername = username.toLocaleLowerCase('pt-BR');
  const user = users.find((candidate) => candidate.username.toLocaleLowerCase('pt-BR') === normalizedUsername);

  if (!user || !password || password.length > 128) {
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  }

  try {
    const submittedHash = await scrypt(password, user.salt);
    const storedHash = Buffer.from(user.passwordHash, 'hex');
    if (storedHash.length !== submittedHash.length || !crypto.timingSafeEqual(submittedHash, storedHash)) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    const sessionId = crypto.randomBytes(32).toString('hex');
    sessions.set(sessionId, {
      userId: user.id,
      username: user.username,
      expiresAt: Date.now() + SESSION_DURATION_MS
    });
    setSessionCookie(res, sessionId);
    return res.json({ message: 'Login realizado com sucesso.', redirect: '/sistema' });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const authenticatedSession = getSession(req);
  return res.json({ user: { username: authenticatedSession.session.username } });
});

app.post('/api/auth/logout', (req, res) => {
  const authenticatedSession = getSession(req);
  if (authenticatedSession) sessions.delete(authenticatedSession.sessionId);
  clearSessionCookie(res);
  return res.status(204).end();
});

app.get('/', (req, res) => res.redirect('/login'));
app.get(['/login', '/cadastro', '/index-principal'], (req, res, next) => {
  if (req.path === '/index-principal') return next();
  const page = req.path === '/cadastro' ? 'cadastro.html' : 'Login.html';
  return res.sendFile(path.join(PUBLIC_DIR, page));
});

app.get(['/index-principal.html', '/index-principal', '/sistema'], requireAuth, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index-principal.html'));
});
app.use('/sistema', requireAuth);

app.get(['/Logo-Transparente.png', '/logo-nova.png', '/icone.ico'], (req, res, next) => {
  const asset = {
    '/logo-transparent.png': 'Logo-Transparente.png',
    '/logo-nova.png': 'Logo-nova.png',
    '/icone.ico': 'icone.ico'
  }[req.path.toLowerCase()];
  if (!asset) return next();
  return res.sendFile(path.join(__dirname, asset));
});

app.use(express.static(PUBLIC_DIR, { index: false }));
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint não encontrado.' });
  }
  return res.status(404).send('<h1>Página não encontrada (404)</h1>');
});

app.use((error, req, res, next) => {
  console.error(`Erro ao processar ${req.method} ${req.path}:`, error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ error: 'Erro interno do servidor.' });
});

let currentPort = requestedPort;
const server = http.createServer(app);

function startServer(port) {
  server.listen(port, HOSTNAME, () => {
    currentPort = port;
    mostrarMensagem(`Servidor iniciado em http://${HOSTNAME}:${currentPort}`);
    mostrarMensagem('Pressione Ctrl+C para parar o servidor');
  });
}

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE' && currentPort < 65535) {
    const nextPort = currentPort + 1;
    console.warn(`Porta ${currentPort} ocupada. Tentando ${nextPort}...`);
    currentPort = nextPort;
    startServer(currentPort);
    return;
  }
  console.error(`Erro no servidor: ${error.message}`);
  process.exitCode = 1;
});

Promise.all([loadUsers(), loadProducts()])
  .then(() => startServer(currentPort))
  .catch((error) => {
    console.error('Erro ao carregar dados:', error);
    process.exitCode = 1;
  });

process.on('SIGINT', () => {
  mostrarMensagem('Servidor interrompido pelo usuário');
  server.close(() => process.exit(0));
});

// ===== Servidor Node.js Básico =====

const http = require('http');
const fs = require('fs');
const path = require('path');

const HOSTNAME = '0.0.0.0';
const requestedPort = Number(process.argv[2]) || Number(process.env.PORT) || 3000;
let PORT = requestedPort;
const PUBLIC_DIR = path.join(__dirname, 'public');

// ===== Funções Auxiliares =====
function mostrarMensagem(msg) {
    console.log(`[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`);
}

function lerArquivo(caminhoArquivo) {
    try {
        return fs.readFileSync(caminhoArquivo, 'utf-8');
    } catch (erro) {
        return null;
    }
}

// ===== Servidor HTTP =====
const server = http.createServer((req, res) => {
    mostrarMensagem(`Requisição recebida: ${req.method} ${req.url}`);

    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let urlPath = requestUrl.pathname;

    if (urlPath === '/') {
        urlPath = '/login.html';
    }

    const filePath = path.join(PUBLIC_DIR, urlPath);

    fs.readFile(filePath, (erro, dados) => {
        if (erro) {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>❌ Página não encontrada (404)</h1>');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentTypes = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.svg': 'image/svg+xml'
        };

        res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
        res.end(dados);
    });
});

// ===== Iniciar Servidor =====
function startServer(port) {
    server.listen(port, HOSTNAME, () => {
        PORT = port;
        mostrarMensagem(`🚀 Servidor iniciado em http://${HOSTNAME}:${PORT}`);
        mostrarMensagem('Pressione Ctrl+C para parar o servidor');
    });
}

server.on('error', (erro) => {
    if (erro.code === 'EADDRINUSE' && PORT < 65535) {
        const nextPort = PORT + 1;
        console.warn(`Porta ${PORT} ocupada. Tentando ${nextPort}...`);
        PORT = nextPort;
        startServer(PORT);
    } else {
        console.error(`Erro no servidor: ${erro.message}`);
    }
});

startServer(PORT);

process.on('SIGINT', () => {
    mostrarMensagem('Servidor interrompido pelo usuário');
    process.exit(0);
});
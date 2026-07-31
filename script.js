// ==========================================
// Armazenamento local (os dados ficam salvos no navegador)
// ==========================================

const STORAGE_PRODUTOS = 'balanco_produtos';
const STORAGE_VENDAS = 'balanco_vendas';

function carregarProdutos() {
  const dados = localStorage.getItem(STORAGE_PRODUTOS);
  if (dados) return JSON.parse(dados);
  // Dados de exemplo na primeira vez que a página é aberta
  return [
    { id: 1, nome: 'Fone Bluetooth X1', custo: 45.00, venda: 89.90, quantidade: 40 },
    { id: 2, nome: 'Camiseta Básica', custo: 18.00, venda: 39.90, quantidade: 60 },
    { id: 3, nome: 'Panela Antiaderente', custo: 60.00, venda: 129.90, quantidade: 15 }
  ];
}

function carregarVendas() {
  const dados = localStorage.getItem(STORAGE_VENDAS);
  if (dados) return JSON.parse(dados);
  return [];
}

function salvarProdutos() {
  localStorage.setItem(STORAGE_PRODUTOS, JSON.stringify(produtos));
}

function salvarVendas() {
  localStorage.setItem(STORAGE_VENDAS, JSON.stringify(vendas));
}

let produtos = carregarProdutos();
let vendas = carregarVendas();
let proximoIdProduto = produtos.length ? Math.max(...produtos.map(p => p.id)) + 1 : 1;
let proximoIdVenda = vendas.length ? Math.max(...vendas.map(v => v.id)) + 1 : 1;

let receitaProdutoChart = null;

// ==========================================
// Utilitários
// ==========================================

function formatarMoeda(valor) {
  const numero = Number(valor);
  if (Number.isNaN(numero)) return 'R$ 0,00';
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function definirTexto(id, valor) {
  const elemento = document.getElementById(id);
  if (elemento) {
    elemento.textContent = valor;
  }
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function horaAgora() {
  const d = new Date();
  return d.toTimeString().slice(0, 5);
}

function formatarDataBR(dataISO) {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

function mostrarMsg(elId, texto, tipo) {
  const el = document.getElementById(elId);
  el.textContent = texto;
  el.className = 'form-msg ' + tipo;
  setTimeout(() => { el.textContent = ''; el.className = 'form-msg'; }, 3500);
}

// ==========================================
// Navegação por abas
// ==========================================

function inicializarAbas() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });
}

// ==========================================
// PRODUTOS
// ==========================================

function renderProdutos() {
  const tbody = document.getElementById('produtosBody');
  const vazio = document.getElementById('produtosVazio');

  if (produtos.length === 0) {
    tbody.innerHTML = '';
    vazio.style.display = 'block';
    return;
  }
  vazio.style.display = 'none';

  tbody.innerHTML = produtos.map(p => `
    <tr>
      <td>${p.nome}</td>
      <td class="right">${formatarMoeda(p.custo)}</td>
      <td class="right">${formatarMoeda(p.venda)}</td>
      <td class="right ${p.quantidade <= 5 ? 'qtd-baixa' : ''}">${p.quantidade}</td>
      <td class="right">${formatarMoeda(p.venda - p.custo)}</td>
      <td class="right">
        <button class="btn-icon" onclick="removerProduto(${p.id})" aria-label="Remover produto">
          <i class="ti ti-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function removerProduto(id) {
  if (!confirm) return;
  produtos = produtos.filter(p => p.id !== id);
  salvarProdutos();
  renderProdutos();
  renderSelectVendaProduto();
}

function inicializarFormProduto() {
  const form = document.getElementById('formProduto');
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const nome = document.getElementById('prodNome').value.trim();
    const custo = parseFloat(document.getElementById('prodCusto').value);
    const venda = parseFloat(document.getElementById('prodVenda').value);
    const quantidade = parseInt(document.getElementById('prodQtd').value, 10);

    if (!nome || isNaN(custo) || isNaN(venda) || isNaN(quantidade)) {
      mostrarMsg('produtoMsg', 'Preencha todos os campos corretamente.', 'error');
      return;
    }

    produtos.push({ id: proximoIdProduto++, nome, custo, venda, quantidade });
    salvarProdutos();

    form.reset();
    renderProdutos();
    renderSelectVendaProduto();
    mostrarMsg('produtoMsg', 'Produto cadastrado com sucesso.', 'success');
  });
}

// ==========================================
// VENDAS
// ==========================================

function renderSelectVendaProduto() {
  const select = document.getElementById('vendaProduto');
  const atual = select.value;

  select.innerHTML = produtos
    .filter(p => p.quantidade > 0)
    .map(p => `<option value="${p.id}">${p.nome} (${p.quantidade} em estoque)</option>`)
    .join('');

  if (produtos.length === 0 || select.innerHTML === '') {
    select.innerHTML = '<option value="">Cadastre um produto com estoque disponível</option>';
  }

  if (atual) select.value = atual;
}

function renderVendas() {
  const tbody = document.getElementById('vendasBody');
  const vazio = document.getElementById('vendasVazio');

  if (vendas.length === 0) {
    tbody.innerHTML = '';
    vazio.style.display = 'block';
    return;
  }
  vazio.style.display = 'none';

  const ordenadas = [...vendas].sort((a, b) =>
    (b.data + b.hora).localeCompare(a.data + a.hora)
  );

  tbody.innerHTML = ordenadas.map(v => `
    <tr>
      <td>${formatarDataBR(v.data)}</td>
      <td>${v.hora}</td>
      <td>${v.produtoNome}</td>
      <td>${v.quantidade}</td>
      <td class="right">${formatarMoeda(v.precoUnitario)}</td>
      <td class="right">${formatarMoeda(v.total)}</td>
      <td class="right">
        <button class="btn-icon" onclick="removerVenda(${v.id})" aria-label="Remover venda">
          <i class="ti ti-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function removerVenda(id) {
  if (!confirm) return;
  const venda = vendas.find(v => v.id === id);
  if (venda) {
    const produto = produtos.find(p => p.id === venda.produtoId);
    if (produto) produto.quantidade += venda.quantidade;
  }
  vendas = vendas.filter(v => v.id !== id);
  salvarProdutos();
  salvarVendas();
  renderProdutos();
  renderSelectVendaProduto();
  renderVendas();
  renderBalanco();
}

function hojeISO() {
  const d = new Date();
  // Ajusta para o fuso local
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function inicializarFormVenda() {
  document.getElementById('vendaData').value = hojeISO();
  document.getElementById('vendaHora').value = horaAgora();

  const form = document.getElementById('formVenda');
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const produtoId = parseInt(document.getElementById('vendaProduto').value, 10);
    const quantidade = parseInt(document.getElementById('vendaQtd').value, 10);
    const data = document.getElementById('vendaData').value;
    const hora = document.getElementById('vendaHora').value;

    const produto = produtos.find(p => p.id === produtoId);

    if (!produto) {
      mostrarMsg('vendaMsg', 'Selecione um produto válido.', 'error');
      return;
    }
    if (!quantidade || quantidade <= 0) {
      mostrarMsg('vendaMsg', 'Informe uma quantidade válida.', 'error');
      return;
    }
    if (quantidade > produto.quantidade) {
      mostrarMsg('vendaMsg', `Estoque insuficiente. Disponível: ${produto.quantidade}.`, 'error');
      return;
    }

    produto.quantidade -= quantidade;

    const lucroVenda = (produto.venda - produto.custo) * quantidade;

    vendas.push({
      id: proximoIdVenda++,
      produtoId: produto.id,
      produtoNome: produto.nome,
      quantidade,
      precoUnitario: produto.venda,
      precoCusto: produto.custo,
      total: produto.venda * quantidade,
      lucro: lucroVenda,
      data,
      hora
    });

    salvarProdutos();
    salvarVendas();

    form.reset();
    document.getElementById('vendaData').value = hojeISO();
    document.getElementById('vendaHora').value = horaAgora();

    renderProdutos();
    renderSelectVendaProduto();
    renderVendas();
    renderBalanco();
    mostrarMsg('vendaMsg', 'Venda registrada com sucesso.', 'success');
  });
}

// ==========================================
// BALANÇO DO DIA
// ==========================================

function vendasDoDia(dataISO) {
  return vendas.filter(v => v.data === dataISO);
}

function renderBalanco() {
  const dataISO = document.getElementById('dataFiltro').value || hojeISO();
  const doDia = vendasDoDia(dataISO);

  const receita = Number(doDia.reduce((acc, v) => acc + (Number(v.total) || 0), 0)) || 0;
  const custo = Number(doDia.reduce((acc, v) => acc + (Number(v.precoCusto) || 0) * (Number(v.quantidade) || 0), 0)) || 0;
  const lucro = Number(doDia.reduce((acc, v) => acc + (Number(v.lucro) || 0), 0)) || 0;
  const itens = Number(doDia.reduce((acc, v) => acc + (Number(v.quantidade) || 0), 0)) || 0;

  definirTexto('dReceita', formatarMoeda(receita));
  definirTexto('dCusto', formatarMoeda(custo));
  definirTexto('dLucro', formatarMoeda(lucro));
  definirTexto('dItens', itens);

  const lucroElemento = document.getElementById('dLucro');
  if (lucroElemento) {
    lucroElemento.innerHTML = formatarMoeda(lucro);
    
  }

  // Tabela de vendas do dia
  const tbody = document.getElementById('vendasDiaBody');
  const vazio = document.getElementById('vendasDiaVazio');

  if (doDia.length === 0) {
    tbody.innerHTML = '';
    vazio.style.display = 'block';
  } else {
    vazio.style.display = 'none';
    const ordenadas = [...doDia].sort((a, b) => a.hora.localeCompare(b.hora));
    const lucroTotal = ordenadas.reduce((soma, v) => soma + (Number(v.lucro) || 0), 0);
    tbody.innerHTML = ordenadas.map(v => `
      <tr>
        <td>${v.hora}</td>
        <td>${v.produtoNome}</td>
        <td>${v.quantidade}</td>
        <td class="right">${formatarMoeda(v.total)}</td>
        <td class="right">${formatarMoeda(v.lucro)}</td>
      </tr>
    `).join('');

     // 👉 Adiciona a linha final com o total de lucros
  tbody.innerHTML += `
    <tr class="total">
      <td colspan="4" class="right"><strong>Lucro Total do Dia:</strong></td>
      <td class="right"><strong>${formatarMoeda(lucroTotal)}</strong></td>
    </tr>
  `;
  }

  renderGraficoReceitaProduto(doDia);
}

function renderGraficoReceitaProduto(doDia) {
  const receitaPorProduto = {};
  doDia.forEach(v => {
    receitaPorProduto[v.produtoNome] = (receitaPorProduto[v.produtoNome] || 0) + v.total;
  });

  const labels = Object.keys(receitaPorProduto);
  const valores = Object.values(receitaPorProduto);

  if (receitaProdutoChart) {
    receitaProdutoChart.data.labels = labels;
    receitaProdutoChart.data.datasets[0].data = valores;
    receitaProdutoChart.update();
    return;
  }

  const ctx = document.getElementById('receitaProdutoChart');
  receitaProdutoChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Receita',
        data: valores,
        backgroundColor: '#2a78d6',
        borderRadius: 4,
        maxBarThickness: 40
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: {
            callback: (v) => 'R$ ' + v,
            color: '#898781'
          },
          grid: { color: '#e1e0d9' }
        },
        y: {
          ticks: { color: '#898781' },
          grid: { display: false }
        }
      }
    }
  });
}

function inicializarFiltroData() {
  document.getElementById('dataFiltro').value = hojeISO();
  document.getElementById('dataFiltro').addEventListener('change', renderBalanco);
}

// ==========================================
// Inicialização geral
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  inicializarAbas();
  inicializarFormProduto();
  inicializarFormVenda();
  inicializarFiltroData();

  renderProdutos();
  renderSelectVendaProduto();
  renderVendas();
  renderBalanco();
});

 document.getElementById("downloadBtn").addEventListener("click", function() {
    // Captura os dados da tabela
    const linhas = document.querySelectorAll("#vendasDiaBody tr");
    let conteudo = "Relatório de Vendas do Dia\n\n";

    let somaLucro = 0;

    linhas.forEach(linha => {
      const colunas = linha.querySelectorAll("td");
      if (colunas.length === 5) {
        const hora = colunas[0].innerText;
        const produto = colunas[1].innerText;
        const quantidade = colunas[2].innerText;
        const receita = colunas[3].innerText;
        const lucro = colunas[4].innerText;

        conteudo += `Horário: ${hora} | Produto: ${produto} | Quantidade: ${quantidade} | Receita: ${receita} | Lucro: ${lucro}\n`;

        // Converte lucro para número e soma
        const valorNumerico = Number(lucro.replace(/[^\d,-]/g, "").replace(",", "."));
        somaLucro += isNaN(valorNumerico) ? 0 : valorNumerico;
      }
    });

    // 👉 Adiciona o total de lucros ao final
    conteudo += `\n=============================\nLucro Total do Dia: ${somaLucro.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}\n`;

    // Cria um arquivo blob (texto simples)
    const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    // Cria link temporário
    const link = document.createElement("a");
    link.href = url;
    link.download = "relatorio_vendas.txt"; 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Libera o objeto da memória
    URL.revokeObjectURL(url);
  });





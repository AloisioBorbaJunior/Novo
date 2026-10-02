// ==========================================
// Produtos são carregados pela API; vendas e despesas continuam no navegador.
// ==========================================

const STORAGE_PRODUTOS = 'balanco_produtos';
const STORAGE_VENDAS = 'balanco_vendas';
const STORAGE_DESPESAS = 'balanco_despesas';












async function requisitarProdutos(caminho, options = {}) {
  const response = await fetch(caminho, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
  const result = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    if (response.status === 401) window.location.assign('/login');
    throw new Error(result?.error || 'Não foi possível salvar os produtos no servidor.');
  }
  return result;
}

async function carregarProdutosDoServidor() {
  let result = await requisitarProdutos('/api/produtos');
  if (result.produtos.length > 0) return result.produtos;

  const dadosLocais = localStorage.getItem(STORAGE_PRODUTOS);
  if (!dadosLocais) return [];

  let produtosLocais;
  try {
    produtosLocais = JSON.parse(dadosLocais);
  } catch {
    throw new Error('Os produtos salvos neste navegador estão inválidos; não foi feita nenhuma alteração.');
  }

  if (!Array.isArray(produtosLocais) || produtosLocais.length === 0) return [];
  if (!window.confirm(`Encontrei ${produtosLocais.length} produto(s) salvos neste navegador. Deseja importá-los para esta conta?`)) {
    return [];
  }

  result = await requisitarProdutos('/api/produtos/import', {
    method: 'POST',
    body: JSON.stringify({ produtos: produtosLocais })
  });
  localStorage.removeItem(STORAGE_PRODUTOS);
  return result.produtos;
}

async function criarProdutoNoServidor(produto) {
  const result = await requisitarProdutos('/api/produtos', {
    method: 'POST',
    body: JSON.stringify(produto)
  });
  return result.produto;
}

async function atualizarProdutoNoServidor(produto) {
  const result = await requisitarProdutos(`/api/produtos/${produto.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      nome: produto.nome,
      custo: produto.custo,
      venda: produto.venda,
      quantidade: produto.quantidade
    })
  });
  return result.produto;
}

async function excluirProdutoNoServidor(id) {
  await requisitarProdutos(`/api/produtos/${id}`, { method: 'DELETE' });
}

function carregarVendas() {
  const dados = localStorage.getItem(STORAGE_VENDAS);
  if (dados) return JSON.parse(dados);
  return [];
}

function salvarVendas() {
  localStorage.setItem(STORAGE_VENDAS, JSON.stringify(vendas));
}

// Carregar despesas do localStorage
function carregarDespesas() {
  const dados = localStorage.getItem(STORAGE_DESPESAS);
  if (dados) return JSON.parse(dados);
  return []; // retorna lista vazia se não houver nada salvo
}

// Salvar despesas no localStorage
function salvarDespesas() {
  localStorage.setItem(STORAGE_DESPESAS, JSON.stringify(despesas));
}

let produtos = [];
let vendas = carregarVendas();
let despesas = carregarDespesas();
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

async function removerProduto(id) {
  if (!window.confirm('Deseja remover este produto?')) return;

  try {
    await excluirProdutoNoServidor(id);
    produtos = produtos.filter(p => p.id !== id);
    renderProdutos();
    renderSelectVendaProduto();
  } catch (error) {
    mostrarMsg('produtoMsg', error.message, 'error');
  }
}

function inicializarFormProduto() {
  const form = document.getElementById('formProduto');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nome = document.getElementById('prodNome').value.trim();
    const custo = parseFloat(document.getElementById('prodCusto').value);
    const venda = parseFloat(document.getElementById('prodVenda').value);
    const quantidade = parseInt(document.getElementById('prodQtd').value, 10);

    if (!nome || isNaN(custo) || isNaN(venda) || isNaN(quantidade)) {
      mostrarMsg('produtoMsg', 'Preencha todos os campos corretamente.', 'error');
      return;
    }

    try {
      const produto = await criarProdutoNoServidor({ nome, custo, venda, quantidade });
      produtos.push(produto);
      form.reset();
      renderProdutos();
      renderSelectVendaProduto();
      mostrarMsg('produtoMsg', 'Produto salvo na sua conta.', 'success');
    } catch (error) {
      mostrarMsg('produtoMsg', error.message, 'error');
    }
  });
}

// ==========================================
// Despesas
// ==========================================
function renderDespesas() {
  const tbody = document.getElementById("despesasBody");
  const vazio = document.getElementById("despesasVazio");

    
  if (despesas.length === 0) {
    tbody.innerHTML = "";
    vazio.style.display = "block";
    return;
  }
  vazio.style.display = "none";

  tbody.innerHTML = despesas.map((d, index) => `
    <tr>
        <td class="right">${formatarHora(d.hora)}</td>
      <td class="right">${formatarDataBR(d.data)}</td>
      <td class="right">${d.nome}</td>
      <td class="right">${formatarMoeda(d.valor)}</td>
      <td>
        <button class="btn-icon" onclick="removerDespesa(${index})" aria-label="Remover despesa">
          <i class="ti ti-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

  
atualizarTotalDespesas();
}

function formatarHora(hora) {
  if (!hora) return "--:--"; // mostra vazio ou traço se não tiver hora
  return hora; // já vem no formato HH:MM
}
function atualizarTotalDespesas() {
  const total = despesas.reduce((acc, d) => acc + (Number(d.valor) || 0), 0);
  const el = document.getElementById("mDespesas");
  if (el) el.textContent = formatarMoeda(total);
}

function removerDespesa(index) {
  despesas.splice(index, 1);
  salvarDespesas();
  renderDespesas();
  renderBalanco(); // 👉 atualiza o lucro líquido
  atualizarTotalDespesas();
}

function hojeISO() {
  const d = new Date();
  // Ajusta para o fuso local
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function inicializarFormDespesa() {
  document.getElementById("despesaData").value = hojeISO();
  const form = document.getElementById("formDespesa");
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const nome = document.getElementById("despesaNome").value.trim();
    const valor = parseFloat(document.getElementById("despesaValor").value);
    const data = document.getElementById("despesaData").value || hojeISO();

    if (!nome || isNaN(valor) || !data) {
      mostrarMsg("despesaMsg", "Preencha todos os campos corretamente.", "error");
      return;
    }

    despesas.push({ nome, valor, data, hora: horaAgora() });
    salvarDespesas();

    form.reset();
    document.getElementById("despesaData").value = hojeISO();
    renderDespesas();
    renderBalanco();
    atualizarTotalDespesas();
    mostrarMsg("despesaMsg", "Despesa registrada com sucesso.", "success");
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

async function removerVenda(id) {
  if (!window.confirm('Deseja remover esta venda?')) return;

  const venda = vendas.find(v => v.id === id);
  if (venda) {
    const produto = produtos.find(p => p.id === venda.produtoId);
    if (produto) {
      try {
        const produtoAtualizado = await atualizarProdutoNoServidor({
          ...produto,
          quantidade: produto.quantidade + venda.quantidade
        });
        Object.assign(produto, produtoAtualizado);
      } catch (error) {
        mostrarMsg('vendaMsg', error.message, 'error');
        return;
      }
    }
  }
  vendas = vendas.filter(v => v.id !== id);
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
  form.addEventListener('submit', async (e) => {
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

    const lucroVenda = (produto.venda - produto.custo) * quantidade;
    try {
      const produtoAtualizado = await atualizarProdutoNoServidor({
        ...produto,
        quantidade: produto.quantidade - quantidade
      });
      Object.assign(produto, produtoAtualizado);
    } catch (error) {
      mostrarMsg('vendaMsg', error.message, 'error');
      return;
    }

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

  const lucroElemento2 = document.getElementById('dLucroDespesa');
  const lucroElemento = document.getElementById('dLucro');
  if (lucroElemento) {
    lucroElemento.innerHTML = formatarMoeda(lucro);
    if (lucroElemento2) lucroElemento2.innerHTML = formatarMoeda(lucro);
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

document.addEventListener('DOMContentLoaded', async () => {
  inicializarAbas();
  inicializarFormProduto();
  inicializarFormVenda();
  inicializarFiltroData();
  inicializarFormDespesa();

  try {
    produtos = await carregarProdutosDoServidor();
  } catch (error) {
    mostrarMsg('produtoMsg', error.message, 'error');
  }

  renderProdutos();
  renderSelectVendaProduto();
  renderVendas();
  renderBalanco();
  renderDespesas();
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

// --- Despesas ---
let somaDespesas = 0;
despesas.forEach(d => {
  somaDespesas += Number(d.valor) || 0;
});

conteudo += `\n=============================\nTotal de Despesas: ${somaDespesas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}\n`;

    
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


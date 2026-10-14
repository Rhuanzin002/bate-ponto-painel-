const API_URL = 'https://bate-ponto-server.onrender.com/api';

// ---------- Utilidades ----------
function escapeHtml(texto) {
    return String(texto ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function lerSenhaSalva() {
    try { return sessionStorage.getItem('painel_senha') || ''; } catch (e) { return ''; }
}

function salvarSenha(senha) {
    try { sessionStorage.setItem('painel_senha', senha); } catch (e) { /* ignora */ }
}

function apagarSenha() {
    try { sessionStorage.removeItem('painel_senha'); } catch (e) { /* ignora */ }
}

let senhaAtual = lerSenhaSalva();

async function chamarApi(caminho, opcoes = {}) {
    const resposta = await fetch(`${API_URL}${caminho}`, {
        ...opcoes,
        headers: {
            ...(opcoes.headers || {}),
            'x-painel-senha': senhaAtual
        }
    });

    if (resposta.status === 401) {
        sair('Sessão expirada ou senha incorreta.');
        throw new Error('Não autorizado');
    }
    return resposta;
}

// ---------- Login / Logout ----------
const telaLogin = document.getElementById('tela-login');
const painel = document.getElementById('painel');
const campoSenha = document.getElementById('campo-senha');
const erroLogin = document.getElementById('erro-login');
const btnEntrar = document.getElementById('btn-entrar');

function mostrarPainel() {
    telaLogin.hidden = true;
    painel.hidden = false;
}

function sair(mensagem = '') {
    apagarSenha();
    senhaAtual = '';
    painel.hidden = true;
    telaLogin.hidden = false;
    campoSenha.value = '';
    erroLogin.textContent = mensagem;
}

async function entrar() {
    const senha = campoSenha.value;
    if (!senha) {
        erroLogin.textContent = 'Digite a senha.';
        return;
    }

    btnEntrar.disabled = true;
    erroLogin.textContent = 'Verificando... (o servidor pode demorar até 50s para acordar)';

    try {
        const resposta = await fetch(`${API_URL}/login`, {
            headers: { 'x-painel-senha': senha }
        });

        if (resposta.ok) {
            senhaAtual = senha;
            salvarSenha(senha);
            erroLogin.textContent = '';
            mostrarPainel();
            carregarPainel();
        } else {
            erroLogin.textContent = 'Senha incorreta.';
        }
    } catch (error) {
        erroLogin.textContent = 'Erro de conexão com o servidor.';
    } finally {
        btnEntrar.disabled = false;
    }
}

btnEntrar.addEventListener('click', entrar);
campoSenha.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') entrar();
});
document.getElementById('btn-sair').addEventListener('click', () => sair());

// ---------- Painel ----------
async function carregarPainel() {
    try {
        const resposta = await chamarApi('/painel');
        const dados = await resposta.json();

        renderizarResumo(dados.resumo || []);
        renderizarHistorico(dados.historico || []);
    } catch (error) {
        console.error('Erro ao carregar dados do painel:', error);
    }
}

function renderizarResumo(resumo) {
    const tbody = document.querySelector('#tabela-resumo tbody');
    tbody.innerHTML = '';

    if (resumo.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Nenhum ponto pendente no momento.</td></tr>`;
        return;
    }

    resumo.forEach(item => {
        const tr = document.createElement('tr');
        const valorDiaria = item.valorDiaria || 50.00;

        tr.innerHTML = `
            <td>${escapeHtml(item.nome)}</td>
            <td>${item.pontosPendentes}</td>
            <td><input type="number" id="diaria-${item.id}" value="${valorDiaria}" step="5.00" oninput="atualizarTotal(${item.id}, ${item.pontosPendentes})"></td>
            <td id="total-${item.id}">R$ ${(item.pontosPendentes * valorDiaria).toFixed(2)}</td>
            <td><button class="btn-pagar">Marcar como Pago</button></td>
        `;

        tr.querySelector('.btn-pagar').addEventListener('click', () => marcarComoPago(item.nome));
        tbody.appendChild(tr);
    });
}

function atualizarTotal(id, quantidadePontos) {
    const valorDiaria = parseFloat(document.getElementById(`diaria-${id}`).value) || 0;
    const totalTd = document.getElementById(`total-${id}`);
    const total = quantidadePontos * valorDiaria;
    totalTd.innerText = `R$ ${total.toFixed(2)}`;
}

function renderizarHistorico(historico) {
    const tbody = document.querySelector('#tabela-historico tbody');
    tbody.innerHTML = '';

    if (historico.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Nenhum registro de ponto encontrado.</td></tr>`;
        return;
    }

    historico.forEach(item => {
        const tr = document.createElement('tr');

        let statusClass = 'status-valido';
        let statusText = 'Válido';

        if (item.desconsiderado) {
            statusClass = 'status-desconsiderado';
            statusText = 'Desconsiderado';
        } else if (item.pago) {
            statusClass = 'status-pago';
            statusText = 'Pago';
        }

        // Renderiza a miniatura da selfie se existir
        const selfieHtml = item.selfie 
            ? `<img src="${item.selfie}" width="40" height="40" style="border-radius: 50%; object-fit: cover; cursor: pointer; border: 2px solid #38bdf8;" onclick="abrirFotoMaior('${item.selfie}')" title="Clique para ampliar"/>` 
            : 'Sem foto';

        tr.innerHTML = `
            <td>${escapeHtml(item.nome)}</td>
            <td>${selfieHtml}</td>
            <td>${new Date(item.dataHora).toLocaleString('pt-BR')}</td>
            <td><span class="${statusClass}">${statusText}</span></td>
            <td>
                ${!item.desconsiderado && !item.pago ? `<button class="btn-desconsiderar" onclick="desconsiderarPonto(${Number(item.id)})">Desconsiderar</button>` : '-'}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Função para abrir a selfie em tamanho maior num modal simples ou aba nova
function abrirFotoMaior(base64Img) {
    const win = window.open();
    win.document.write(`<iframe src="${base64Img}" frameborder="0" style="border:0; top:0; left:0; bottom:0; right:0; width:100%; height:100%;" allowfullscreen></iframe>`);
}

async function marcarComoPago(nomeFuncionario) {
    if (!confirm(`Deseja quitar todas as diárias pendentes de ${nomeFuncionario} e zerar a contagem atual?`)) return;

    try {
        const resposta = await chamarApi('/pagar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: nomeFuncionario })
        });

        if (resposta.ok) {
            alert('Pagamento registrado com sucesso!');
            carregarPainel();
        } else {
            alert('Erro ao registrar pagamento.');
        }
    } catch (error) {
        if (error.message !== 'Não autorizado') alert('Erro de conexão com o servidor.');
    }
}

async function desconsiderarPonto(pontoId) {
    if (!confirm('Tem certeza que deseja desconsiderar este ponto? Ele sairá do cálculo final.')) return;

    try {
        const resposta = await chamarApi(`/ponto/${pontoId}/desconsiderar`, {
            method: 'PATCH'
        });

        if (resposta.ok) {
            alert('Ponto desconsiderado com sucesso!');
            carregarPainel();
        } else {
            alert('Erro ao desconsiderar ponto.');
        }
    } catch (error) {
        if (error.message !== 'Não autorizado') alert('Erro de conexão com o servidor.');
    }
}

// ---------- Início ----------
if (senhaAtual) {
    mostrarPainel();
    carregarPainel();
}
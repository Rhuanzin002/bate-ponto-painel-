const API_URL = 'https://bate-ponto-server.onrender.com/api'; // Atualizado para o Render

async function carregarPainel() {
    try {
        const resposta = await fetch(`${API_URL}/painel`);
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
        
        tr.innerHTML = `
            <td>${item.nome}</td>
            <td>${item.pontosPendentes}</td>
            <td><input type="number" id="diaria-${item.id}" value="${item.valorDiaria || 50.00}" step="5.00" oninput="atualizarTotal(${item.id}, ${item.pontosPendentes})"></td>
            <td id="total-${item.id}">R$ ${(item.pontosPendentes * (item.valorDiaria || 50.00)).toFixed(2)}</td>
            <td><button class="btn-pagar" onclick="marcarComoPago('${item.nome}')">Marcar como Pago</button></td>
        `;
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
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #94a3b8;">Nenhum registro de ponto encontrado.</td></tr>`;
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

        tr.innerHTML = `
            <td>${item.nome}</td>
            <td>${new Date(item.dataHora).toLocaleString('pt-BR')}</td>
            <td><span class="${statusClass}">${statusText}</span></td>
            <td>
                ${!item.desconsiderado && !item.pago ? `<button class="btn-desconsiderar" onclick="desconsiderarPonto(${item.id})">Desconsiderar</button>` : '-'}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function marcarComoPago(nomeFuncionario) {
    if (!confirm(`Deseja quitar todas as diárias pendentes de ${nomeFuncionario} e zerar a contagem atual?`)) return;

    try {
        const resposta = await fetch(`${API_URL}/pagar`, {
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
        alert('Erro de conexão com o servidor.');
    }
}

async function desconsiderarPonto(pontoId) {
    if (!confirm('Tem certeza que deseja desconsiderar este ponto? Ele sairá do cálculo final.')) return;

    try {
        const resposta = await fetch(`${API_URL}/ponto/${pontoId}/desconsiderar`, {
            method: 'PATCH'
        });

        if (resposta.ok) {
            alert('Ponto desconsiderado com sucesso!');
            carregarPainel();
        } else {
            alert('Erro ao desconsiderar ponto.');
        }
    } catch (error) {
        alert('Erro de conexão com o servidor.');
    }
}

// Carrega o painel assim que a página abre
carregarPainel();
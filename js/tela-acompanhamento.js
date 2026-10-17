/* Coltelli — Painel de senhas: a tela que fica virada para o salão.
   O cliente olha aqui, ou acompanha no celular pelo QR Code do cupom. */

/* Quem acabou de ficar pronto é "chamado": o cartão se destaca, pulsa uma vez e
   toca um aviso, para o salão perceber sem ninguém gritar a senha. */
let painelVistos = null;          // ids prontos que o painel já conhece
const chamadas = new Map();       // id -> até quando fica em destaque
let anunciar = [];                // ids chamados neste redesenho
let timerChamada = null;
const DESTAQUE_MS = 12000;

function painelSair(){ painelVistos = null; anunciar = []; }

function telaPainel(){
  const preparo = [...Dados.porStatus('novo'), ...Dados.porStatus('preparo')]
    .sort((a,b) => a.numero - b.numero);
  const prontos = Dados.porStatus('pronto').sort((a,b) => (b.prontoEm || 0) - (a.prontoEm || 0));
  const loja = Dados.loja();
  const agora = Date.now();

  // quem entrou em "pronto" desde o último desenho vira chamada
  const ids = new Set(prontos.map(p => p.id));
  anunciar = painelVistos === null ? [] : prontos.filter(p => !painelVistos.has(p.id)).map(p => p.id);
  painelVistos = ids;
  anunciar.forEach(id => chamadas.set(id, agora + DESTAQUE_MS));
  chamadas.forEach((ate, id) => { if (ate < agora || !ids.has(id)) chamadas.delete(id); });
  const chamado = prontos.find(p => chamadas.has(p.id));

  const cheia = App.cozinha;
  const botaoCheia = `<button class="btn btn-ghost painel-cheia nao-imprime" data-act="modo-cozinha">
      ${ic(cheia ? 'reduzir' : 'expandir','sm')} ${cheia ? 'Sair da tela cheia' : 'Tela cheia'}</button>`;

  if (!preparo.length && !prontos.length){
    return `<div class="tela-centro painel-vazio">${vazio('sino', 'Nenhuma senha na fila',
      'As senhas aparecem aqui assim que um pedido é lançado. Deixe esta tela virada para o salão.', botaoCheia)}</div>`;
  }

  const senha = (p, pronto) => `
    <div class="senha-cartao ${pronto ? 'pronta' : ''} ${chamadas.has(p.id) ? 'chamando' : ''}" data-anima="senha-${p.id}" data-senha="${p.id}">
      <span class="senha-num">${p.numero}</span>
      ${p.cliente && p.cliente !== 'Totem' ? `<span class="senha-cli">${esc(p.cliente)}</span>` : ''}
    </div>`;

  return `
  <div class="painel ${chamado ? 'com-chamada' : ''}">
    <section class="painel-col">
      <header class="painel-topo">
        <span class="painel-tit">${ic('relogio','sm')} Em preparo</span>
        <span class="painel-n">${preparo.length}</span>
      </header>
      <div class="senha-grade rolagem">
        ${preparo.length ? preparo.map(p => senha(p, false)).join('')
          : '<p class="col-vazia">Nada em preparo</p>'}
      </div>
    </section>

    <section class="painel-col painel-destaque">
      <header class="painel-topo">
        <span class="painel-tit">${ic('check','sm')} Pode retirar</span>
        <span class="painel-n">${prontos.length}</span>
      </header>
      ${chamado ? `
        <div class="painel-chamada" role="status" aria-live="assertive" data-anima="chamada-${chamado.id}">
          <span class="rotulo">Senha</span>
          <span class="chamada-num">${chamado.numero}</span>
          <span class="chamada-txt">pode retirar no balcão</span>
        </div>` : ''}
      <div class="senha-grade rolagem">
        ${prontos.length ? prontos.map(p => senha(p, true)).join('')
          : '<p class="col-vazia">Nenhuma senha pronta</p>'}
      </div>
    </section>
  </div>
  <div class="painel-pe">
    <span>${esc(loja ? loja.nome : '')}${Agente.ligado ? ' · acompanhe também pelo QR Code do seu cupom' : ''}</span>
    ${botaoCheia}
  </div>`;
}

/* Depois do desenho: pulsa o cartão chamado e toca o aviso */
function painelDepois(){
  if (!anunciar.length) return;
  anunciar.forEach(id => {
    const el = document.querySelector(`[data-senha="${id}"]`);
    if (el) Anima.chamou(el);
  });
  Anima.chamou(document.querySelector('.painel-chamada'));
  if (Aparelho.som()){ Som.bip(880, .16); setTimeout(() => Som.bip(1175, .22), 190); }
  anunciar = [];
  // o destaque some sozinho
  clearTimeout(timerChamada);
  timerChamada = setTimeout(() => { if (App.tela === 'painel') App.render(); }, DESTAQUE_MS + 50);
}

/* Mostra ao cliente, no balcão, o QR de um pedido que já saiu */
function abrirQrPedido(codigo, numero){
  const url = Agente.urlPedido(codigo);
  Modal.abrir(`
    ${Modal.cabecalho('qr', `Pedido nº ${numero}`, url ? 'O cliente aponta a câmera' : 'Acompanhamento pelo celular')}
    ${url ? `
      <div class="qr-caixa grande">
        ${qrSvg(url, 200)}
        <span class="qr-txt">${esc(url)}</span>
      </div>`
      : `<p class="nota">${ic('info','sm')} O QR Code funciona com o agente da loja ligado — é ele que publica a
         página de acompanhamento na rede da sorveteria. Sem o agente, informe a senha <b>${numero}</b> ao cliente.</p>`}
    <div class="modal-acoes"><button class="btn btn-primario" data-act="modal-fechar">Fechar</button></div>`);
}

const acoesPainel = {
  'qr-pedido': (d) => abrirQrPedido(d.codigo, d.numero),
};

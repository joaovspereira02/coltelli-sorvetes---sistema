/* Coltelli — Produção: a tela do fundo, feita para ser lida a três metros */

const ESTADOS = {
  '':         { rotulo:'no prazo', selo:'selo-ok' },
  atencao:    { rotulo:'atenção',  selo:'selo-aviso' },
  atrasado:   { rotulo:'atrasado', selo:'selo-erro' },
};

function metaDoPedido(p){
  return p.itens.reduce((m,i) => Math.max(m, Number(i.preparo) || 3), 3);
}

function cartaoPedido(p){
  const meta = metaDoPedido(p);
  const base = p.status === 'pronto' ? (p.prontoEm || p.criadoEm) : p.criadoEm;
  const u = urgencia(base, meta);
  const e = ESTADOS[u];
  const rotulo = { novo:'Iniciar preparo', preparo:'Marcar pronto', pronto:'Entregue' }[p.status];
  const estilo = p.status === 'pronto' ? 'btn-ok' : 'btn-primario';
  return `
  <article class="ped ${u}" data-anima="ped-${p.id}">
    <header class="ped-topo">
      <span class="ped-num">${p.numero}</span>
      <span class="ped-meta">
        <span class="ped-canal">${esc(p.canal)}${p.pago === false ? ' <span class="selo selo-aviso">a pagar</span>' : ''}</span>
        ${p.cliente && p.cliente !== 'Totem' && !/^Mesa /.test(p.cliente) ? `<span class="ped-cli">${esc(p.cliente)}</span>` : ''}
      </span>
      <span class="ped-rel">
        <span class="ped-tempo" data-tempo="${base}" data-meta="${meta}">${decorrido(base)}</span>
        <span class="selo ${e.selo}" data-estado>${e.rotulo}</span>
      </span>
    </header>
    <ul class="ped-itens">
      ${p.itens.map(i => `
        <li>
          <span class="pi-q">${i.pesoG ? kgTexto(i.pesoG) + ' kg' : i.qtd + '×'}</span>
          <span class="pi-n">${esc(i.nome)}${i.obs ? `<span class="pi-obs">${ic('alerta','sm')} ${esc(i.obs)}</span>` : ''}</span>
        </li>`).join('')}
    </ul>
    <footer class="ped-pe">
      <button class="icon-btn" data-act="cancelar-pedido" data-id="${p.id}" aria-label="Cancelar pedido ${p.numero}">${ic('x')}</button>
      ${Agente.temImpressora() ? `<button class="icon-btn" data-act="imprimir-comanda" data-id="${p.id}"
        aria-label="Imprimir comanda do pedido ${p.numero}">${ic('impressora')}</button>` : ''}
      ${p.codigo ? `<button class="icon-btn" data-act="qr-pedido" data-codigo="${p.codigo}" data-numero="${p.numero}"
        aria-label="Mostrar QR do pedido ${p.numero}">${ic('qr')}</button>` : ''}
      <button class="btn ${estilo}" data-toque data-act="avancar" data-id="${p.id}">${rotulo}</button>
    </footer>
  </article>`;
}

function colunaProducao(titulo, tom, lista, textoVazio){
  return `
  <section class="col" aria-label="${titulo}">
    <header class="col-topo tom-${tom}">
      <span class="col-tit">${titulo}</span>
      <span class="col-n">${lista.length}</span>
    </header>
    <div class="col-lista rolagem">
      ${lista.length ? lista.map(cartaoPedido).join('')
        : `<p class="col-vazia">${esc(textoVazio)}</p>`}
    </div>
  </section>`;
}

function telaProducao(){
  const novos = Dados.porStatus('novo');
  const preparo = Dados.porStatus('preparo');
  const prontos = Dados.porStatus('pronto');
  const r = Dados.resumo();
  const atrasados = Dados.fila().filter(p => urgencia(p.criadoEm, metaDoPedido(p)) === 'atrasado').length;

  if (!novos.length && !preparo.length && !prontos.length){
    return `<div class="tela-centro">${vazio('producao', 'Nenhum pedido na fila',
      r.pedidos ? `${r.pedidos} ${r.pedidos === 1 ? 'pedido concluído' : 'pedidos concluídos'} hoje. Quando entrar um novo, ele aparece aqui na hora.`
                : 'Assim que o balcão ou o totem lançar um pedido, ele aparece aqui na hora.',
      `<button class="btn btn-ghost" data-act="ir" data-tela="balcao">${ic('comanda')} Ir para o balcão</button>`)}</div>`;
  }

  return `
  <div class="producao">
    <div class="prod-barra">
      <span class="marcador">${ic('relogio','sm')} ${novos.length + preparo.length} na fila</span>
      ${atrasados ? `<span class="marcador marcador-alerta">${ic('alerta','sm')} ${atrasados} atrasado${atrasados > 1 ? 's' : ''}</span>` : ''}
      ${r.tempo !== null ? `<span class="marcador">${ic('check','sm')} ${numero(r.tempo)} min de média hoje</span>` : ''}
      <button class="icon-btn" data-act="alternar-som"
        aria-label="${Aparelho.som() ? 'Desligar aviso sonoro' : 'Ligar aviso sonoro'}"
        aria-pressed="${Aparelho.som()}">${ic(Aparelho.som() ? 'sino' : 'sino-off')}</button>
      <button class="btn btn-ghost" data-act="modo-cozinha">
        ${ic(App.cozinha ? 'reduzir' : 'expandir','sm')} ${App.cozinha ? 'Sair do modo cozinha' : 'Modo cozinha'}
      </button>
    </div>
    <div class="colunas">
      ${colunaProducao('Chegou agora', 'novo', novos, 'Fila limpa')}
      ${colunaProducao('Em preparo', 'preparo', preparo, 'Nada em preparo')}
      ${colunaProducao('Pronto para entregar', 'pronto', prontos, 'Tudo entregue')}
    </div>
  </div>`;
}

async function avancarPedido(id){
  try { await Dados.avancar(id); }
  catch(e){ Aviso.erro('Não consegui atualizar o pedido: ' + e.message); return; }
  if (Aparelho.som()) Som.bip(760, .06);
}

const acoesProducao = {
  avancar: (d) => {
    const p = Dados.estado.pedidos.find(x => x.id === d.id);
    if (!p) return;
    // pedido do totem ou da mesa que ninguém cobrou ainda: avisa antes de entregar
    if (p.status === 'pronto' && p.pago === false){
      Confirmar.pedir({
        titulo: `O pedido nº ${p.numero} ainda não foi pago`,
        texto: `${brl(p.valor)} a receber — o caixa registra pelo botão “a receber” do balcão. Entregar mesmo assim?`,
        botao: 'Entregar sem receber', perigo: true,
        aoConfirmar: () => avancarPedido(p.id),
      });
      return;
    }
    return avancarPedido(p.id);
  },
  'imprimir-comanda': async (d) => {
    const p = Dados.estado.pedidos.find(x => x.id === d.id);
    if (!p) return;
    try { await Agente.imprimir('comanda', p); Aviso.mostrar(`Comanda nº ${p.numero} enviada`); }
    catch(e){ Aviso.erro('Impressora não respondeu'); }
  },
  'alternar-som': () => { Aparelho.setSom(!Aparelho.som()); App.render(); },
  'cancelar-pedido': (d) => {
    const p = Dados.estado.pedidos.find(x => x.id === d.id);
    if (!p) return;
    Confirmar.pedir({
      titulo: `Cancelar o pedido nº ${p.numero}?`,
      texto: 'Ele sai da fila e entra no fechamento do dia como cancelado.',
      botao: 'Cancelar pedido', perigo: true,
      async aoConfirmar(){
        await Dados.cancelar(d.id);
        Aviso.mostrar(`Pedido nº ${p.numero} cancelado`);
      },
    });
  },
};

/* Os cronômetros andam sozinhos, sem redesenhar a tela inteira */
function atualizarTempos(){
  document.querySelectorAll('[data-tempo]').forEach(el => {
    const ts = Number(el.dataset.tempo);
    el.textContent = decorrido(ts);
    const cartao = el.closest('.ped');
    if (!cartao) return;
    const u = urgencia(ts, Number(el.dataset.meta) || 3);
    cartao.classList.toggle('atencao', u === 'atencao');
    cartao.classList.toggle('atrasado', u === 'atrasado');
    const selo = cartao.querySelector('[data-estado]');
    if (selo){
      const e = ESTADOS[u];
      selo.textContent = e.rotulo;
      selo.className = 'selo ' + e.selo;
      selo.setAttribute('data-estado', '');
    }
  });
}

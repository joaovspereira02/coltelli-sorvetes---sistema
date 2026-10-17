/* Coltelli — Totem: o cliente monta o pedido e retira a senha.
   O pagamento é feito no caixa: sem maquininha conectada, o sistema não diz que cobrou. */

const Totem = {
  etapa: 'inicio',      // inicio | menu | revisao | pagando | pronto
  estadoPag: null,
  cobrancaId: null,
  erro: null,
  pago: false,
  total_: 0,
  cat: null,
  itens: [],
  numero: null,
  codigo: null,
  total(){ return centavos(this.itens.reduce((s,i) => s + i.valor, 0)); },
  limpar(){
    this.etapa = 'inicio'; this.itens = []; this.numero = null; this.codigo = null;
    this.estadoPag = null; this.cobrancaId = null; this.erro = null; this.pago = false; this.total_ = 0;
  },
};

function telaTotem(){
  const produtos = Dados.produtosAtivos().filter(p => !p.porPeso);
  if (!produtos.length){
    return `<div class="tela-centro">${vazio('totem', 'Sem produtos para o autoatendimento',
      'O totem mostra os itens de preço fixo. Cadastre produtos por unidade para liberar esta tela.',
      `<button class="btn btn-primario btn-grande" data-act="ir" data-tela="cardapio">${ic('mais')} Ir ao cardápio</button>`)}</div>`;
  }

  return `<div class="totem-palco"><div class="totem">${conteudoTotem(produtos)}</div></div>`;
}

function conteudoTotem(produtos){
  const loja = Dados.loja();
  const t = Totem;
  const cats = [...new Set(produtos.map(p => p.categoria))];
  if (!t.cat || !cats.includes(t.cat)) t.cat = cats[0];

  if (t.etapa === 'inicio'){
    return `
    <div class="tt-inicio" data-act="tt-comecar">
      <span class="tt-luz a" aria-hidden="true"></span><span class="tt-luz b" aria-hidden="true"></span>
      ${marcaCompleta()}
      <h1>Faça seu pedido aqui</h1>
      <p>${Agente.temTerminal() ? 'Escolha, pague no cartão e retire a senha.' : 'Escolha, retire a senha e pague no caixa.'}</p>
      <button class="btn btn-primario btn-enorme" data-act="tt-comecar" data-toque>Começar ${ic('seta')}</button>
      <span class="tt-toque">toque em qualquer lugar da tela</span>
      <span class="tt-rodape">${esc(loja ? loja.nome : '')}</span>
    </div>`;
  }

  if (t.etapa === 'pagando'){
    const cenas = {
      enviando:   'Enviando para a maquininha…',
      aguardando: 'Aproxime, insira ou passe o cartão',
      processando:'Autorizando o pagamento…',
    };
    return `
    <div class="tt-fim">
      <div class="girando" style="width:54px;height:54px"></div>
      <h1 style="font-size:clamp(1.4rem,3.4vw,2rem)">${cenas[t.estadoPag] || cenas.aguardando}</h1>
      <span class="tt-total" style="font-size:2.4rem">${brl(t.total_)}</span>
      <p>Não retire o cartão até a maquininha avisar.</p>
      <button class="btn btn-ghost btn-grande" data-act="tt-cancelar-pag">Cancelar</button>
    </div>`;
  }

  if (t.etapa === 'pronto'){
    const url = Agente.urlPedido(t.codigo);
    return `
    <div class="tt-fim">
      <span class="tt-ok">${ic('check','lg')}</span>
      <span class="rotulo">${t.pago ? 'Pagamento aprovado · sua senha' : 'Sua senha'}</span>
      <span class="tt-senha" data-anima="tt-senha-${t.numero}">${t.numero}</span>
      <p>${t.pago
        ? 'Retire o recibo e entregue no balcão para confirmar.'
        : 'Pague no caixa e acompanhe pelo painel' + (url ? ' ou pelo celular' : '') + '.'}</p>
      ${url ? `<div class="qr-caixa grande">${qrSvg(url, 160)}
        <span class="qr-txt">Aponte a câmera para acompanhar<br>cada passo até a retirada</span></div>` : ''}
      <div class="tt-fim-acoes">
        ${Agente.temImpressora() ? `<button class="btn btn-ghost btn-grande" data-act="tt-imprimir">${ic('impressora')} Imprimir de novo</button>` : ''}
        <button class="btn btn-primario btn-grande" data-act="tt-novo">Novo pedido</button>
      </div>
    </div>`;
  }

  if (t.etapa === 'revisao'){
    return `
    <header class="tt-topo"><h2>Confira seu pedido</h2></header>
    ${t.erro ? `<p class="tt-erro">${ic('alerta','sm')} ${esc(t.erro)}</p>` : ''}
    <div class="tt-lista rolagem">
      ${t.itens.map(i => `
        <div class="tt-linha" data-anima="tt-${i.linha}">
          <span class="tt-q">${i.qtd}×</span>
          <span class="tt-n">${esc(i.nome)}</span>
          <span class="tt-v">${brl(i.valor)}</span>
          <button class="icon-btn" data-act="tt-remover" data-linha="${i.linha}" aria-label="Remover ${esc(i.nome)}">${ic('x')}</button>
        </div>`).join('')}
    </div>
    <footer class="tt-pe">
      <button class="btn btn-ghost btn-grande" data-act="tt-voltar">Adicionar mais</button>
      <span class="tt-total">${brl(t.total())}</span>
      <button class="btn btn-primario btn-enorme" data-act="tt-enviar">
        ${Agente.temTerminal() ? 'Pagar no cartão' : 'Retirar senha'}
      </button>
    </footer>`;
  }

  return `
  <header class="tt-topo">
    <button class="icon-btn" data-act="tt-novo" aria-label="Recomeçar">${ic('x')}</button>
    <div class="abas abas-grande">
      ${cats.map(c => `<button class="aba" data-act="tt-cat" data-cat="${esc(c)}" aria-pressed="${c === t.cat}">${esc(c)}</button>`).join('')}
    </div>
  </header>
  <div class="tt-grade rolagem">
    ${produtos.filter(p => p.categoria === t.cat).map(p => {
      const qtd = t.itens.filter(i => i.produtoId === p.id).reduce((s,i) => s + i.qtd, 0);
      return `
      <button class="tt-card ${p.foto ? 'com-foto' : ''}" data-toque data-act="tt-add" data-id="${p.id}">
        ${qtd ? `<span class="tt-card-qtd" data-anima="tt-qtd-${p.id}">${qtd}</span>` : ''}
        ${foto(p, 'tt-foto')}
        <span class="tt-card-corpo">
          <span class="tt-card-n">${esc(p.nome)}</span>
          <span class="tt-card-p">${brl(p.preco)}</span>
        </span>
      </button>`; }).join('')}
  </div>
  <footer class="tt-pe">
    <span class="tt-total" data-num="tt-total" data-fmt="dinheiro" data-valor="${t.total()}">${brl(t.total())}</span>
    <span class="tt-qtd">${unidadesTotem()} ${unidadesTotem() === 1 ? 'item' : 'itens'}</span>
    <button class="btn btn-primario btn-enorme" data-act="tt-revisar" ${t.itens.length ? '' : 'disabled'}>Revisar pedido</button>
  </footer>`;
}

/* Cobrança do totem: o valor vai para a maquininha acoplada e o pedido só nasce
   depois da aprovação voltar do terminal. */
function totemCobrar(){
  Totem.total_ = Totem.total();
  Totem.etapa = 'pagando';
  Totem.estadoPag = 'enviando';
  App.render();

  Totem.pararCobranca = Agente.aoCobrar(async (c) => {
    if (!Totem.cobrancaId || c.id !== Totem.cobrancaId) return;
    if (c.estado === 'aprovado'){
      Totem.pararCobranca();
      Totem.cobrancaId = null;
      await totemFecharPedido({ pagamento:'Cartão (maquininha)', pago:true });
    } else if (['recusado','cancelado'].includes(c.estado)){
      Totem.pararCobranca();
      Totem.cobrancaId = null;
      Totem.erro = c.estado === 'recusado' ? 'Pagamento recusado. Tente outro cartão.' : 'Cobrança cancelada.';
      Totem.etapa = 'revisao';
      App.render();
    } else {
      Totem.estadoPag = c.estado;
      App.render();
    }
  });

  Agente.cobrar({ valor: Totem.total_, forma:'Cartão', ref:'totem-' + Date.now() })
    .then(c => { Totem.cobrancaId = c.id; Totem.estadoPag = c.estado; App.render(); })
    .catch(e => {
      if (Totem.pararCobranca) Totem.pararCobranca();
      Totem.erro = 'Não consegui falar com a maquininha: ' + e.message;
      Totem.etapa = 'revisao';
      App.render();
    });
}

const unidadesTotem = () => Totem.itens.reduce((s,i) => s + i.qtd, 0);

async function totemFecharPedido({ pagamento, pago }){
  const pedido = await Dados.criarPedido({
    canal: 'totem', tipo: 'balcão', itens: Totem.itens,
    pagamento, pago, cliente: 'Totem',
  });
  Totem.numero = pedido.numero;
  Totem.codigo = pedido.codigo;
  Totem.pago = pago;
  Totem.reciboPedido = pedido;
  Totem.itens = [];
  Totem.etapa = 'pronto';
  Som.bip(1180, .12);
  App.render();
  if (Agente.temImpressora()){
    Agente.imprimir('recibo', pedido).catch(() => Aviso.erro('Impressora não respondeu'));
  }
}

const acoesTotem = {
  'tt-comecar': () => { Totem.etapa = 'menu'; App.render(); },
  'tt-cat': (d) => {
    Totem.cat = d.cat;
    App.render();
    Anima.cascata(document.querySelectorAll('.tt-grade > *'));
  },
  'tt-add': (d) => {
    const p = Dados.produto(d.id);
    const igual = Totem.itens.find(i => i.produtoId === p.id);
    if (igual){ igual.qtd++; igual.valor = centavos(igual.valor + Number(p.preco)); }
    else Totem.itens.push({ linha: novoId(), produtoId:p.id, nome:p.nome, qtd:1,
      pesoG:0, obs:'', valor:centavos(p.preco), precoUn:Number(p.preco), precoKg:null,
      preparo:Number(p.preparo) || 3 });
    Som.bip(700, .04);
    App.render();
    Anima.pulsar(document.querySelector('.tt-total'), 1.1);
  },
  'tt-remover': (d) => { Totem.itens = Totem.itens.filter(i => i.linha !== d.linha); App.render(); },
  'tt-revisar': () => { Totem.etapa = 'revisao'; App.render(); },
  'tt-voltar': () => { Totem.etapa = 'menu'; App.render(); },
  'tt-enviar': (d, e) => {
    if (!Totem.itens.length) return;
    travarBotao(e);
    Totem.erro = null;
    if (Agente.temTerminal()) totemCobrar();
    else totemFecharPedido({ pagamento:'A pagar no caixa', pago:false });
  },
  'tt-cancelar-pag': async () => {
    if (Totem.cobrancaId) await Agente.cancelarCobranca(Totem.cobrancaId).catch(() => {});
    if (Totem.pararCobranca) Totem.pararCobranca();
    Totem.cobrancaId = null;
    Totem.etapa = 'revisao';
    App.render();
  },
  'tt-imprimir': async () => {
    if (!Totem.reciboPedido) return;
    try { await Agente.imprimir('recibo', Totem.reciboPedido); Aviso.mostrar('Recibo enviado à impressora'); }
    catch(e){ Aviso.erro('Impressora não respondeu'); }
  },
  'tt-novo': () => { Totem.limpar(); App.render(); },
};

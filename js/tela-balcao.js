/* Coltelli — Balcão: lançamento, pesagem, troco e fechamento do pedido */

const FORMAS = ['Dinheiro', 'Pix', 'Débito', 'Crédito', 'Vale'];

const Comanda = {
  itens: [],
  pagamento: '',
  cliente: '',
  recebido: 0,
  catAtiva: null,
  busca: '',
  editando: null,
  confirmado: null,   // { numero, total, troco, pagamento }

  limpar(){
    this.itens = []; this.pagamento = ''; this.cliente = '';
    this.recebido = 0; this.editando = null;
  },
  total(){ return centavos(this.itens.reduce((s,i) => s + i.valor, 0)); },
  /* Conta unidades, não linhas: três casquinhas numa linha são três itens */
  unidades(){ return this.itens.reduce((s,i) => s + (i.pesoG ? 1 : i.qtd), 0); },
  troco(){ return centavos(Math.max(0, this.recebido - this.total())); },

  adicionar(prod, { pesoG = 0, qtd = 1, obs = '' } = {}){
    const valor = centavos(prod.porPeso ? (pesoG / 1000) * Number(prod.precoKg) : Number(prod.preco) * qtd);
    const igual = !prod.porPeso && !obs && this.itens.find(i => i.produtoId === prod.id && !i.obs && !i.pesoG);
    if (igual){ igual.qtd += qtd; igual.valor = centavos(igual.valor + valor); }
    else this.itens.push({
      linha: novoId(), produtoId: prod.id, nome: prod.nome, qtd,
      pesoG, obs, valor,
      precoUn: prod.porPeso ? null : Number(prod.preco),
      precoKg: prod.porPeso ? Number(prod.precoKg) : null,
      preparo: Number(prod.preparo) || 3,
    });
  },
  remover(linha){ this.itens = this.itens.filter(i => i.linha !== linha); },
  item(linha){ return this.itens.find(i => i.linha === linha); },

  /* Filtro do catálogo: a busca vale em todas as categorias */
  visiveis(){
    const termo = this.busca.trim().toLowerCase();
    const ativos = Dados.produtosAtivos();
    if (termo) return ativos.filter(p => p.nome.toLowerCase().includes(termo));
    return ativos.filter(p => !this.catAtiva || p.categoria === this.catAtiva);
  },
};

/* ---------------- Catálogo ---------------- */

function tileProduto(p){
  return `
  <button class="tile ${p.foto ? 'tile-com-foto' : ''}" data-toque data-act="add-produto" data-id="${p.id}">
    ${p.foto ? foto(p, 'tile-foto') : ''}
    ${p.porPeso ? `<span class="tile-tag">${ic('balanca','sm')} por peso</span>` : ''}
    <span class="tile-nome">${esc(p.nome)}</span>
    <span class="tile-preco">${brl(p.porPeso ? p.precoKg : p.preco)}${p.porPeso ? '<small>por kg</small>' : ''}</span>
  </button>`;
}

function gradeProdutos(){
  const lista = Comanda.visiveis();
  if (!lista.length){
    return `<p class="nota-vazia">Nenhum produto com “${esc(Comanda.busca)}”.</p>`;
  }
  return lista.map(tileProduto).join('');
}

function abasCatalogo(cats){
  return cats.map(c => {
    const ativa = !Comanda.busca && c === Comanda.catAtiva;
    return `<button class="aba" data-act="cat" data-cat="${esc(c)}" aria-pressed="${ativa}">
      ${ativa ? '<span class="aba-ativa" data-anima="aba-ativa" data-flip="tam" aria-hidden="true"></span>' : ''}${esc(c)}</button>`;
  }).join('');
}

/* Só a grade e as abas mudam enquanto a pessoa digita, para o campo não perder o foco */
function pintarCatalogo({ cascata = false } = {}){
  Anima.antes();
  const grade = document.getElementById('grade-produtos');
  if (grade) grade.innerHTML = gradeProdutos();
  const abas = document.getElementById('abas-catalogo');
  if (abas) abas.innerHTML = abasCatalogo(Dados.categorias());
  Anima.depois();
  Anima.toque();
  if (grade && cascata) Anima.cascata(grade.children);
}

function telaBalcao(){
  const produtos = Dados.produtosAtivos();
  const cats = Dados.categorias();

  if (!produtos.length) return `<div class="tela-centro">${primeirosPassos()}</div>`;

  if (Comanda.catAtiva === null || (Comanda.catAtiva && !cats.includes(Comanda.catAtiva))){
    Comanda.catAtiva = cats[0] || '';
  }

  return `
  <div class="balcao">
    <div class="balcao-catalogo">
      <div class="barra-busca">
        <label class="busca">
          ${ic('busca','sm')}
          <input id="busca-produto" type="search" placeholder="Buscar produto" aria-label="Buscar produto"
                 value="${esc(Comanda.busca)}" autocomplete="off">
        </label>
      </div>
      ${cats.length > 1 ? `<div class="abas" id="abas-catalogo" role="group" aria-label="Categorias">${abasCatalogo(cats)}</div>`
        : '<div class="abas-vazio"></div>'}
      <div class="tiles rolagem" id="grade-produtos">${gradeProdutos()}</div>
    </div>
    ${Comanda.confirmado ? painelConfirmado() : comanda()}
  </div>`;
}

/* ---------------- Primeiros passos ---------------- */

function primeirosPassos(){
  const temProduto = Dados.estado.produtos.length > 0;
  const temVenda = Dados.resumo().pedidos > 0 || Dados.estado.pedidos.length > 0;
  const passo = (n, feito, texto) => `
    <div class="passo ${feito ? 'feito' : ''}">
      <span class="passo-n">${feito ? '✓' : n}</span><span>${texto}</span>
    </div>`;
  return `
  <div class="vazio">
    <span class="vazio-ic">${ic('cardapio','lg')}</span>
    <h3>Falta cadastrar o cardápio</h3>
    <p>O sistema não vem com produto nenhum: os preços e os nomes são os da sua loja.</p>
    <div class="passos">
      ${passo(1, true, 'Loja criada')}
      ${passo(2, temProduto, 'Cadastrar os produtos e os preços')}
      ${passo(3, temVenda, 'Lançar o primeiro pedido no balcão')}
    </div>
    <div class="vazio-acoes">
      <button class="btn btn-primario btn-grande" data-act="ir" data-tela="cardapio">${ic('mais')} Cadastrar produtos</button>
    </div>
  </div>`;
}

/* ---------------- Comanda ---------------- */

function linhaComanda(i){
  const detalhe = [];
  if (i.pesoG) detalhe.push(`${kgTexto(i.pesoG)} kg × ${brl(i.precoKg)}`);
  else if (i.qtd > 1) detalhe.push(`${i.qtd} × ${brl(i.precoUn)}`);
  if (i.obs) detalhe.push(i.obs);
  return `
  <button class="cl" data-anima="cl-${i.linha}" data-toque data-act="editar-item" data-linha="${i.linha}">
    <span class="cl-q">${i.pesoG ? kgTexto(i.pesoG) + 'kg' : i.qtd + '×'}</span>
    <span class="cl-txt">
      <span class="cl-nome">${esc(i.nome)}</span>
      ${detalhe.length ? `<span class="cl-det">${esc(detalhe.join(' · '))}</span>` : ''}
    </span>
    <span class="cl-v">${brl(i.valor)}</span>
  </button>`;
}

function comanda(){
  const itens = Comanda.itens;
  const total = Comanda.total();
  return `
  <aside class="comanda" aria-label="Comanda">
    <header class="comanda-topo">
      <div>
        <span class="rotulo">Pedido</span>
        <h2 class="comanda-num">nº ${Dados.proximoNumero()}</h2>
      </div>
      ${botaoAReceber()}
    </header>

    <div class="comanda-itens rolagem">
      ${itens.length ? itens.map(linhaComanda).join('')
        : `<div class="vazio vazio-min">
             <span class="vazio-ic">${ic('comanda','lg')}</span>
             <p>Toque em um produto<br>para lançar o pedido</p>
           </div>`}
    </div>

    <div class="comanda-pe">
      <div class="total-linha">
        <span class="total-rot">${Comanda.unidades()} ${Comanda.unidades() === 1 ? 'item' : 'itens'}</span>
        <span class="total-v" data-num="comanda-total" data-fmt="dinheiro" data-valor="${total}">${brl(total)}</span>
      </div>
      <div class="formas" role="group" aria-label="Forma de pagamento">
        ${FORMAS.map(f => `<button class="forma" data-act="forma" data-f="${f}"
          aria-pressed="${Comanda.pagamento === f}">${f}</button>`).join('')}
      </div>
      <div class="comanda-botoes">
        ${itens.length ? `<button class="btn btn-ghost" data-act="cancelar-comanda" aria-label="Limpar comanda">${ic('lixo')}</button>` : ''}
        <button class="btn btn-primario btn-grande" data-toque data-act="fechar-pedido" ${itens.length ? '' : 'disabled'}>
          ${ic('seta')} Fechar pedido
        </button>
      </div>
    </div>
  </aside>`;
}

/* O que o atendente lê em voz alta depois de cobrar */
function painelConfirmado(){
  const c = Comanda.confirmado;
  return `
  <aside class="comanda" aria-label="Pedido fechado">
    <div class="confirma">
      <span class="confirma-ic">${ic('check','lg')}</span>
      <span class="rotulo">Pedido fechado</span>
      <span class="confirma-num" data-anima="confirma-${c.numero}">nº ${c.numero}</span>
      <div style="width:100%;max-width:280px">
        <div class="confirma-linha"><span>Total</span><b>${brl(c.total)}</b></div>
        <div class="confirma-linha"><span>Pagamento</span><b>${esc(c.pagamento)}</b></div>
        ${c.troco > 0 ? `<div class="confirma-linha"><span>Recebido</span><b>${brl(c.recebido)}</b></div>` : ''}
      </div>
      ${c.troco > 0 ? `<div><span class="rotulo">Troco</span><div class="confirma-troco">${brl(c.troco)}</div></div>` : ''}
      ${c.url ? `
        <div class="qr-caixa">
          ${qrSvg(c.url, 132)}
          <span class="qr-txt">O cliente aponta a câmera e acompanha<br>o pedido até a retirada</span>
        </div>` : ''}
      <div class="confirma-acoes">
        ${Agente.temImpressora() ? `<button class="btn btn-ghost btn-grande" data-act="imprimir-recibo">${ic('impressora')} Recibo</button>` : ''}
        <button class="btn btn-primario btn-grande" data-act="novo-pedido">${ic('mais')} Novo pedido</button>
      </div>
    </div>
  </aside>`;
}

/* ---------------- Pesagem ---------------- */

let pesando = null;
let balancaArmada = true;     // só dispara de novo depois que o pote sai da balança
let timerAuto = null;

/* Qual produto o peso vira quando alguém põe o pote na balança */
function produtoDaBalanca(){
  const loja = Dados.loja();
  if (loja && loja.produtoBalanca){
    const p = Dados.produto(loja.produtoBalanca);
    if (p && p.ativo !== false) return p;
  }
  const porPeso = Dados.produtosAtivos().filter(p => p.porPeso);
  return porPeso.length === 1 ? porPeso[0] : null;
}

/* Pote na balança abre a pesagem sozinho, sem ninguém tocar na tela */
function autoAbrirBalanca(){
  const l = Agente.peso;
  if (!l) return;
  if (l.liquido < 50){ balancaArmada = true; return; }
  if (!balancaArmada || !l.estavel) return;
  if (!Aparelho.autoPeso()) return;
  const prod = produtoDaBalanca();
  if (!prod) return;
  balancaArmada = false;
  abrirPesagem(prod);
}

function abrirPesagem(prod){
  pesando = prod;
  if (Agente.temBalanca()) pesagemAoVivo(prod);
  else pesagemDigitada(prod);
}

/* Balança ligada no agente: o peso aparece sozinho e o atendente só confirma */
function pesagemAoVivo(prod){
  const shell = `
    ${Modal.cabecalho('balanca', prod.nome, `${brl(prod.precoKg)} por quilo · balança conectada`)}
    <div class="visor">
      <span class="visor-v" id="peso-v">0,000</span>
      <span class="visor-u">kg</span>
    </div>
    <div class="visor-calc" id="peso-calc" aria-live="polite"></div>
    <p class="dica" id="peso-dica">aguardando leitura</p>
    <div class="chips">
      <button class="chip" data-act="tarar">Tarar com o pote</button>
      <button class="chip" data-act="destarar">Limpar tara</button>
      <button class="chip" data-act="pesar-digitado">Digitar o peso</button>
    </div>
    <button class="btn btn-primario btn-grande btn-cheio" id="btn-peso" data-act="confirmar-peso" disabled>
      Aguardando peso estável
    </button>`;
  Modal.abrir(shell);
  const parar = Agente.ouvir(pintarPeso);
  Modal.aoFechar = () => { parar(); clearTimeout(timerAuto); timerAuto = null; pesando = null; };
  pintarPeso();
}

function pintarPeso(){
  if (!pesando) return;
  const v = document.getElementById('peso-v');
  if (!v) return;
  const l = Agente.peso;
  const g = l ? Math.max(0, l.liquido) : 0;
  const estavel = !!(l && l.estavel);
  const valor = (g / 1000) * pesando.precoKg;
  const tara = Agente.estado && Agente.estado.balanca ? Agente.estado.balanca.tara : 0;

  v.textContent = kgTexto(g);
  document.getElementById('peso-calc').textContent = g > 0 ? brl(valor) : '';
  document.getElementById('peso-dica').textContent = !l ? 'aguardando leitura da balança'
    : (estavel ? 'peso estável' : 'estabilizando…') + (tara ? ` · tara ${Math.round(tara)} g` : '');

  const b = document.getElementById('btn-peso');
  const pronto = estavel && g > 0;
  b.disabled = !pronto;
  b.innerHTML = pronto ? `${ic('check')} Adicionar ${brl(valor)}` : 'Aguardando peso estável';

  // Peso estável lança sozinho: quem tira o pote ou toca na tela interrompe.
  if (pronto && Aparelho.autoPeso() && g > 50){
    if (!timerAuto){
      document.getElementById('peso-dica').textContent = 'lançando no pedido…';
      timerAuto = setTimeout(() => {
        timerAuto = null;
        if (pesando && Agente.peso && Agente.peso.estavel) ACOES['confirmar-peso']({});
      }, 1500);
    }
  } else if (timerAuto){
    clearTimeout(timerAuto);
    timerAuto = null;
  }
}

/* Sem agente: o peso é digitado, que é como a loja trabalha hoje */
function pesagemDigitada(prod){
  const leitura = Balanca.conectada() && Balanca.ultimo ? Balanca.ultimo.gramas : '';
  Teclado.abrir({
    titulo: prod.nome,
    sub: `${brl(prod.precoKg)} por quilo`,
    unidade: 'g',
    decimais: 0,
    valor: leitura,
    calcular: (g) => g > 0 ? `${kgTexto(g)} kg · ${brl((g / 1000) * prod.precoKg)}` : '',
    dica: Balanca.conectada()
      ? 'Peso lido da balança pelo navegador. Confira e confirme.'
      : 'Digite o peso em gramas lido na balança.',
    aoConfirmar(gramas){
      pesando = null;
      if (gramas <= 0){ Aviso.erro('Peso precisa ser maior que zero'); return; }
      Comanda.adicionar(prod, { pesoG: Math.round(gramas) });
      App.render();
      Aviso.mostrar(`${kgTexto(gramas)} kg · ${brl((gramas / 1000) * prod.precoKg)}`);
    },
  });
}

/* ---------------- Edição de item ---------------- */

function abrirItem(linha){
  const i = Comanda.item(linha);
  if (!i) return;
  Comanda.editando = linha;
  Modal.abrir(`
    ${Modal.cabecalho('comanda', i.nome, i.pesoG ? `${kgTexto(i.pesoG)} kg · ${brl(i.valor)}` : brl(i.valor))}
    ${i.pesoG ? '' : `
      <div class="contador">
        <button class="contador-b" data-act="qtd" data-d="-1" aria-label="Diminuir quantidade">${ic('menos')}</button>
        <span class="contador-v" aria-live="polite">${i.qtd}</span>
        <button class="contador-b" data-act="qtd" data-d="1" aria-label="Aumentar quantidade">${ic('mais')}</button>
      </div>`}
    ${campo({ id:'obs-item', rotulo:'Observação para a produção', valor:i.obs, dica:'Ex.: sem cobertura, embalar separado' })}
    <div class="modal-acoes">
      <button class="btn btn-perigo-ghost" data-act="remover-item">${ic('lixo')} Remover</button>
      <button class="btn btn-primario" data-act="salvar-item">Salvar</button>
    </div>`);
}

/* ---------------- Fechamento ---------------- */

function abrirFechamento(){
  Modal.abrir(htmlFechamento());
}

function htmlFechamento(){
  const total = Comanda.total();
  const dinheiro = Comanda.pagamento === 'Dinheiro';
  // Dinheiro e Pix não passam pelo terminal; cartão sim, quando o agente está ligado.
  const terminalAtivo = Agente.temTerminal() && (Comanda.pagamento === 'Débito' || Comanda.pagamento === 'Crédito');
  const troco = Comanda.troco();
  const faltando = dinheiro && Comanda.recebido > 0 && Comanda.recebido < total;
  return `
    ${Modal.cabecalho('cartao', 'Fechar pedido', `${Comanda.unidades()} ${Comanda.unidades() === 1 ? 'item' : 'itens'} · nº ${Dados.proximoNumero()}`)}
    <div class="fechar-total">
      <span class="rotulo">Total a cobrar</span>
      <span class="fechar-v">${brl(total)}</span>
    </div>

    <div class="campo">
      <span class="campo-rot">Forma de pagamento <b>*</b></span>
      <div class="formas" role="group" aria-label="Forma de pagamento">
        ${FORMAS.map(f => `<button class="forma" data-act="forma" data-f="${f}"
          aria-pressed="${Comanda.pagamento === f}">${f}</button>`).join('')}
      </div>
    </div>

    ${dinheiro ? `
      <div class="campo">
        <span class="campo-rot">Dinheiro recebido</span>
        <button class="btn btn-cheio btn-grande" data-act="informar-recebido">
          ${ic('teclado')} ${Comanda.recebido ? brl(Comanda.recebido) : 'Informar valor recebido'}
        </button>
        ${Comanda.recebido ? `
          <div class="kv kv-troco">
            <span>${faltando ? 'Ainda falta' : 'Troco'}</span>
            <span class="${faltando ? 'falta' : 'confirma-troco'}">
              ${brl(faltando ? total - Comanda.recebido : troco)}
            </span>
          </div>` : ''}
      </div>` : ''}

    ${campo({ id:'cliente', rotulo:'Nome ou referência (opcional)', valor:Comanda.cliente, dica:'Aparece na tela da produção' })}

    ${terminalAtivo
      ? `<p class="nota">${ic('cartao','sm')} Maquininha conectada pelo agente da loja. O valor vai para o terminal — ninguém digita.</p>`
      : `<p class="nota">${ic('info','sm')} A cobrança é feita na maquininha pelo atendente. O sistema registra a forma escolhida.</p>`}

    <div class="modal-acoes">
      <button class="btn btn-ghost" data-act="modal-fechar">Voltar</button>
      ${terminalAtivo
        ? `<button class="btn btn-primario btn-grande" data-act="cobrar-terminal" ${faltando ? 'disabled' : ''}>
             ${ic('cartao')} Cobrar ${brl(total)} na maquininha
           </button>`
        : `<button class="btn btn-primario btn-grande" data-act="confirmar-pedido" ${faltando ? 'disabled' : ''}>
             ${ic('check')} Enviar à produção
           </button>`}
    </div>`;
}

async function confirmarPedido(){
  if (!Comanda.pagamento){ Aviso.erro('Escolha a forma de pagamento'); return; }
  const cli = document.getElementById('cliente');
  if (cli) Comanda.cliente = cli.value.trim();
  await registrarPedido();
}

/* A maquininha é quem cobra: o agente manda o valor e devolve o resultado.
   Nada é registrado como pago antes da aprovação voltar do terminal.
   Serve ao balcão e ao recebimento de pedido do totem e da mesa. */
let ultimaCobranca = null;

function cobrancaDoBalcao(){
  const cli = document.getElementById('cliente');
  if (cli) Comanda.cliente = cli.value.trim();
  return {
    total: Comanda.total(), forma: Comanda.pagamento, ref: Dados.proximoNumero(),
    aoAprovar: () => registrarPedido({ viaTerminal:true }),
  };
}

function cobrarNoTerminal(op){
  ultimaCobranca = op;
  const { total, forma } = op;
  let idCobranca = null;
  let pararEventos = null;

  const cena = (estado, detalhe = '') => {
    const mapas = {
      enviando:   { ic:'cartao', tit:'Enviando para a maquininha…', sub:'aguarde', spin:true },
      aguardando: { ic:'cartao', tit:'Aproxime, insira ou passe o cartão', sub:detalhe || 'a maquininha está esperando', spin:true },
      processando:{ ic:'wifi',   tit:'Autorizando com a adquirente…', sub:'não retire o cartão', spin:true },
      aprovado:   { ic:'check',  tit:'Pagamento aprovado', sub:'registrando o pedido', spin:false },
      recusado:   { ic:'alerta', tit:'Pagamento recusado', sub:detalhe || 'tente outro cartão ou outra forma', spin:false },
      cancelado:  { ic:'alerta', tit:'Cobrança cancelada', sub:detalhe || 'nada foi cobrado', spin:false },
      erro:       { ic:'alerta', tit:'Não consegui falar com a maquininha', sub:detalhe, spin:false },
    };
    const c = mapas[estado] || mapas.aguardando;
    const fim = ['recusado','cancelado','erro'].includes(estado);
    return `
      ${Modal.cabecalho(c.ic, c.tit, c.sub)}
      <div class="terminal-cena ${estado === 'aprovado' ? 'aprovado' : ''}">
        ${c.spin ? '<div class="girando"></div>' : ''}
        <span class="terminal-valor">${brl(total)}</span>
        <span class="rotulo">${esc(forma)}</span>
      </div>
      ${fim ? `<div class="modal-acoes">
        <button class="btn btn-ghost" data-act="modal-fechar">Voltar</button>
        <button class="btn btn-primario" data-act="cobrar-de-novo">Tentar de novo</button>
      </div>` : `<div class="modal-acoes">
        <button class="btn btn-ghost" data-act="modal-fechar">Cancelar cobrança</button>
      </div>`}`;
  };

  Modal.abrir(cena('enviando'));
  Modal.aoFechar = () => {
    if (pararEventos) pararEventos();
    if (idCobranca) Agente.cancelarCobranca(idCobranca).catch(() => {});
    idCobranca = null;
  };

  pararEventos = Agente.aoCobrar(async (c) => {
    if (!idCobranca || c.id !== idCobranca) return;
    if (c.estado === 'aprovado'){
      Modal.aoFechar = null;
      pararEventos();
      idCobranca = null;
      Modal.trocar(cena('aprovado'));
      await op.aoAprovar();
    } else if (['recusado','cancelado'].includes(c.estado)){
      idCobranca = null;
      Modal.trocar(cena(c.estado, c.detalhe));
    } else {
      Modal.trocar(cena(c.estado, c.detalhe));
    }
  });

  Agente.cobrar({ valor: total, forma, ref: op.ref })
    .then(c => {
      idCobranca = c.id;
      Modal.trocar(cena(c.estado === 'manual' ? 'aguardando' : c.estado, c.detalhe));
    })
    .catch(e => {
      if (pararEventos) pararEventos();
      Modal.aoFechar = null;
      Modal.trocar(cena('erro', e.message));
    });
}

/* Tablet lento + dedo ansioso mandavam o mesmo pedido duas vezes, com a mesma senha. */
let enviandoPedido = false;

async function registrarPedido({ viaTerminal = false } = {}){
  if (enviandoPedido) return;
  if (!Comanda.itens.length) return;
  enviandoPedido = true;
  try {
    return await registrarPedidoAgora({ viaTerminal });
  } catch(e){
    // A comanda continua na tela: nada se perde, é só tentar de novo.
    Aviso.erro('O pedido não foi salvo: ' + (e && e.message ? e.message : 'tente de novo'));
  } finally {
    enviandoPedido = false;
  }
}

async function registrarPedidoAgora({ viaTerminal }){
  const total = Comanda.total();
  const pedido = await Dados.criarPedido({
    canal: 'balcão',
    cliente: Comanda.cliente,
    tipo: 'balcão',
    itens: Comanda.itens,
    pagamento: Comanda.pagamento + (viaTerminal ? ' (maquininha)' : ''),
    pago: true,
    operador: Aparelho.operador(),
  });
  Comanda.confirmado = {
    numero: pedido.numero, total,
    pagamento: Comanda.pagamento,
    recebido: Comanda.recebido,
    troco: Comanda.pagamento === 'Dinheiro' ? Comanda.troco() : 0,
    codigo: pedido.codigo,
    url: Agente.urlPedido(pedido.codigo),
    pedido,
  };
  Comanda.limpar();
  Modal.aoFechar = null;
  Modal.fechar();
  Som.bip(980, .1);
  App.render();
  clearTimeout(registrarPedido.timer);
  registrarPedido.timer = setTimeout(() => {
    if (Comanda.confirmado){ Comanda.confirmado = null; App.render(); }
  }, 20000);
}

/* ---------------- Ações desta tela ---------------- */

const acoesBalcao = {
  cat: (d) => {
    Comanda.catAtiva = d.cat;
    Comanda.busca = '';
    const b = document.getElementById('busca-produto');
    if (b) b.value = '';
    pintarCatalogo({ cascata: true });
  },
  'add-produto': (d, e) => {
    const p = Dados.produto(d.id);
    if (!p) return;
    const vinhaDaConfirmacao = !!Comanda.confirmado;
    if (Comanda.confirmado) Comanda.confirmado = null;
    if (p.porPeso) abrirPesagem(p);
    else {
      Comanda.adicionar(p);
      Som.bip(660, .04);
      App.render();
      // o preço sai do ladrilho e pousa no total da comanda
      const tile = document.querySelector(`.tile[data-id="${CSS.escape(d.id)}"]`);
      if (!vinhaDaConfirmacao) Anima.voar(tile, document.querySelector('.total-v'), '+ ' + brl(Number(p.preco)));
    }
  },
  forma: (d) => {
    Comanda.pagamento = d.f;
    if (d.f !== 'Dinheiro') Comanda.recebido = 0;
    if (Modal.aberto) Modal.trocar(htmlFechamento());
    else App.render();
  },
  'informar-recebido': () => {
    const total = Comanda.total();
    Teclado.abrir({
      titulo: 'Dinheiro recebido',
      sub: `Total do pedido: ${brl(total)}`,
      unidade: 'R$', decimais: 2,
      valor: Comanda.recebido ? String(Comanda.recebido) : '',
      calcular: (v) => v >= total ? `Troco: ${brl(v - total)}` : (v > 0 ? `Falta ${brl(total - v)}` : ''),
      atalhos: sugestoesCedulas(total).map(v => ({ rotulo: brlCurto(v), valor: v })),
      aoConfirmar(v){
        Comanda.recebido = v;
        Modal.abrir(htmlFechamento());
      },
    });
  },
  'editar-item': (d) => abrirItem(d.linha),
  qtd: (d) => {
    const i = Comanda.item(Comanda.editando);
    if (!i) return;
    const novo = Math.max(1, i.qtd + Number(d.d));
    i.valor = centavos(i.precoUn * novo);
    i.qtd = novo;
    abrirItem(i.linha);
  },
  'salvar-item': () => {
    const i = Comanda.item(Comanda.editando);
    const obs = document.getElementById('obs-item');
    if (i && obs) i.obs = obs.value.trim();
    Modal.fechar(); App.render();
  },
  'remover-item': () => {
    Comanda.remover(Comanda.editando);
    Modal.fechar(); App.render();
  },
  'cancelar-comanda': () => Confirmar.pedir({
    titulo:'Limpar a comanda?', texto:'Os itens lançados serão descartados.',
    botao:'Limpar', perigo:true,
    aoConfirmar(){ Comanda.limpar(); App.render(); },
  }),
  'fechar-pedido': () => abrirFechamento(),
  'confirmar-pedido': (d, e) => { travarBotao(e); return confirmarPedido(); },
  'cobrar-terminal': (d, e) => { travarBotao(e); return cobrarNoTerminal(cobrancaDoBalcao()); },
  'cobrar-de-novo': (d, e) => { travarBotao(e); if (ultimaCobranca) cobrarNoTerminal(ultimaCobranca); },
  'imprimir-recibo': async () => {
    const c = Comanda.confirmado;
    if (!c || !c.pedido) return;
    try { await Agente.imprimir('recibo', c.pedido); Aviso.mostrar('Recibo enviado à impressora'); }
    catch(e){ Aviso.erro('Impressora não respondeu'); }
  },
  'a-receber': () => abrirAReceber(),
  'receber-pedido': (d) => { Recebe.id = d.id; Recebe.pagamento = ''; Recebe.recebido = 0; Modal.trocar(htmlRecebimento()); },
  'receber-voltar': () => abrirAReceber(),
  'receber-forma': (d) => {
    Recebe.pagamento = d.f;
    if (d.f !== 'Dinheiro') Recebe.recebido = 0;
    Modal.trocar(htmlRecebimento());
  },
  'receber-informado': () => {
    const p = pedidoRecebendo();
    if (!p) return;
    Teclado.abrir({
      titulo: 'Dinheiro recebido',
      sub: `Pedido nº ${p.numero} · ${brl(p.valor)}`,
      unidade: 'R$', decimais: 2,
      valor: Recebe.recebido ? String(Recebe.recebido) : '',
      calcular: (v) => v >= p.valor ? `Troco: ${brl(v - p.valor)}` : (v > 0 ? `Falta ${brl(p.valor - v)}` : ''),
      atalhos: sugestoesCedulas(p.valor).map(v => ({ rotulo: brlCurto(v), valor: v })),
      aoConfirmar(v){ Recebe.recebido = v; Modal.abrir(htmlRecebimento()); },
    });
  },
  'confirmar-recebimento': (d, e) => { travarBotao(e); return confirmarRecebimento(); },
  'receber-terminal': (d, e) => {
    travarBotao(e);
    const p = pedidoRecebendo();
    if (!p) return;
    cobrarNoTerminal({
      total: p.valor, forma: Recebe.pagamento, ref: p.numero,
      aoAprovar: () => confirmarRecebimento({ viaTerminal:true }),
    });
  },
  tarar: async () => {
    const l = Agente.peso;
    await Agente.tarar(l ? l.gramas : 0);
    Aviso.mostrar('Tara registrada');
  },
  destarar: async () => { await Agente.tarar(0); Aviso.mostrar('Tara zerada'); },
  'pesar-digitado': () => {
    const prod = pesando;
    Modal.aoFechar = null;
    Modal.fechar();
    if (prod) pesagemDigitada(prod);
  },
  'confirmar-peso': () => {
    const l = Agente.peso;
    const prod = pesando;
    if (!prod || !l) return;
    const g = Math.max(0, Math.round(l.liquido));
    if (g <= 0){ Aviso.erro('Peso precisa ser maior que zero'); return; }
    Comanda.adicionar(prod, { pesoG: g });
    pesando = null;
    Modal.aoFechar = null;
    Modal.fechar();
    App.render();
    Aviso.mostrar(`${kgTexto(g)} kg · ${brl((g / 1000) * prod.precoKg)}`);
  },
  'novo-pedido': () => { Comanda.confirmado = null; App.render(); },
};

/* ---------------- A receber: pedidos do totem e das mesas ----------------
   O cliente pediu sozinho e vem pagar no caixa. O pedido já está na produção;
   aqui o atendente só registra como foi pago. */

const Recebe = { id: null, pagamento: '', recebido: 0 };

function botaoAReceber(){
  const lista = Dados.aReceber();
  if (!lista.length){
    return Aparelho.operador() ? `<span class="selo selo-neutro">${esc(Aparelho.operador())}</span>` : '';
  }
  const total = centavos(lista.reduce((s,p) => s + p.valor, 0));
  return `
    <button class="receber-chip" data-toque data-act="a-receber" data-anima="receber-chip"
      aria-label="${lista.length} ${lista.length === 1 ? 'pedido' : 'pedidos'} a receber, ${brl(total)}">
      <span class="receber-n">${lista.length}</span>
      <span class="receber-txt"><b>a receber</b><span>${brl(total)}</span></span>
    </button>`;
}

const resumoItens = (p) => (p.itens || [])
  .map(i => (i.pesoG ? kgTexto(i.pesoG) + ' kg ' : i.qtd + '× ') + i.nome).join(', ');

function pedidoRecebendo(){ return Dados.estado.pedidos.find(x => x.id === Recebe.id) || null; }

function abrirAReceber(){
  const lista = Dados.aReceber();
  const html = !lista.length
    ? `${Modal.cabecalho('check', 'Nada a receber', 'Todos os pedidos do totem e das mesas já foram pagos.')}
       <div class="modal-acoes"><button class="btn btn-primario" data-act="modal-fechar">Fechar</button></div>`
    : `${Modal.cabecalho('cartao', 'A receber', 'Pedidos do totem e das mesas esperando pagamento no caixa')}
       <div class="lista cartao lista-receber">
         ${lista.map(p => `
           <button class="li" data-act="receber-pedido" data-id="${p.id}">
             <span class="li-senha">${p.numero}</span>
             <span class="li-txt">
               <span class="li-nome">${esc(p.cliente && p.cliente !== 'Totem' ? p.cliente : 'Totem')}
                 <span class="selo ${p.status === 'pronto' ? 'selo-ok' : 'selo-neutro'}">${{ novo:'na fila', preparo:'em preparo', pronto:'pronto' }[p.status] || p.status}</span></span>
               <span class="li-sub">${esc(resumoItens(p))}</span>
             </span>
             <span class="li-v">${brl(p.valor)}</span>
             ${ic('seta','sm')}
           </button>`).join('')}
       </div>
       <div class="modal-acoes"><button class="btn btn-ghost" data-act="modal-fechar">Fechar</button></div>`;
  if (Modal.aberto) Modal.trocar(html); else Modal.abrir(html);
}

function htmlRecebimento(){
  const p = pedidoRecebendo();
  if (!p){
    return `${Modal.cabecalho('check', 'Pedido já recebido', 'Outro caixa registrou o pagamento deste pedido.')}
      <div class="modal-acoes"><button class="btn btn-primario" data-act="receber-voltar">Voltar à lista</button></div>`;
  }
  const total = p.valor;
  const dinheiro = Recebe.pagamento === 'Dinheiro';
  const terminalAtivo = Agente.temTerminal() && (Recebe.pagamento === 'Débito' || Recebe.pagamento === 'Crédito');
  const faltando = dinheiro && Recebe.recebido > 0 && Recebe.recebido < total;
  const troco = centavos(Math.max(0, Recebe.recebido - total));
  return `
    ${Modal.cabecalho('cartao', `Receber pedido nº ${p.numero}`, `${esc(p.canal)} · ${esc(resumoItens(p))}`)}
    <div class="fechar-total">
      <span class="rotulo">Total a cobrar</span>
      <span class="fechar-v">${brl(total)}</span>
    </div>
    <div class="campo">
      <span class="campo-rot">Forma de pagamento <b>*</b></span>
      <div class="formas" role="group" aria-label="Forma de pagamento">
        ${FORMAS.map(f => `<button class="forma" data-act="receber-forma" data-f="${f}"
          aria-pressed="${Recebe.pagamento === f}">${f}</button>`).join('')}
      </div>
    </div>
    ${dinheiro ? `
      <div class="campo">
        <span class="campo-rot">Dinheiro recebido</span>
        <button class="btn btn-cheio btn-grande" data-act="receber-informado">
          ${ic('teclado')} ${Recebe.recebido ? brl(Recebe.recebido) : 'Informar valor recebido'}
        </button>
        ${Recebe.recebido ? `
          <div class="kv kv-troco">
            <span>${faltando ? 'Ainda falta' : 'Troco'}</span>
            <span class="${faltando ? 'falta' : 'confirma-troco'}">${brl(faltando ? total - Recebe.recebido : troco)}</span>
          </div>` : ''}
      </div>` : ''}
    <div class="modal-acoes">
      <button class="btn btn-ghost" data-act="receber-voltar">Voltar</button>
      ${terminalAtivo
        ? `<button class="btn btn-primario btn-grande" data-act="receber-terminal">${ic('cartao')} Cobrar ${brl(total)} na maquininha</button>`
        : `<button class="btn btn-primario btn-grande" data-act="confirmar-recebimento" ${!Recebe.pagamento || faltando ? 'disabled' : ''}>
             ${ic('check')} Registrar pagamento</button>`}
    </div>`;
}

let recebendo = false;
async function confirmarRecebimento({ viaTerminal = false } = {}){
  const p = pedidoRecebendo();
  if (!p || recebendo) return;
  if (!Recebe.pagamento){ Aviso.erro('Escolha a forma de pagamento'); return; }
  recebendo = true;
  try {
    const troco = Recebe.pagamento === 'Dinheiro' ? centavos(Math.max(0, Recebe.recebido - p.valor)) : 0;
    const pago = await Dados.receber(p.id, {
      pagamento: Recebe.pagamento + (viaTerminal ? ' (maquininha)' : ''),
      operador: Aparelho.operador(),
    });
    Modal.aoFechar = null;
    Modal.fechar();
    Som.bip(980, .1);
    Aviso.mostrar(`Pedido nº ${p.numero} pago${troco > 0 ? ` · troco ${brl(troco)}` : ''}`);
    if (pago && Agente.temImpressora()) Agente.imprimir('recibo', pago).catch(() => Aviso.erro('Impressora não respondeu'));
    Recebe.id = null; Recebe.pagamento = ''; Recebe.recebido = 0;
  } catch(e){
    Aviso.erro('Não consegui registrar: ' + (e && e.message ? e.message : 'tente de novo'));
  } finally {
    recebendo = false;
  }
}

/* Desabilita o botão tocado por um instante: a trava lógica já impede o pedido
   repetido, isto evita o segundo toque parecer que não fez nada. */
function travarBotao(e){
  const b = e && e.target && e.target.closest ? e.target.closest('button') : null;
  if (!b || b.disabled) return;
  b.disabled = true;
  setTimeout(() => { if (b.isConnected) b.disabled = false; }, 1200);
}

/* Cédulas que o cliente costuma entregar para aquele total */
function sugestoesCedulas(total){
  const cedulas = [5, 10, 20, 50, 100, 200];
  const saida = [];
  if (total > 0 && Math.round(total * 100) % 100 !== 0) saida.push(Math.ceil(total));
  cedulas.forEach(c => { if (c > total && saida.length < 4) saida.push(c); });
  const arred = Math.ceil(total / 10) * 10;
  if (arred > total && !saida.includes(arred) && saida.length < 4) saida.unshift(arred);
  return saida.slice(0, 4);
}

/* Coltelli — casca do sistema: tema, navegação, modo cozinha e relógios */

const Tema = {
  atual(){
    const marcado = document.documentElement.getAttribute('data-theme');
    if (marcado) return marcado;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  },
  aplicar(t){
    document.documentElement.setAttribute('data-theme', t);
    Aparelho.setTema(t);
    App.render();
  },
  iniciar(){
    const salvo = Aparelho.tema();
    if (salvo) document.documentElement.setAttribute('data-theme', salvo);
  },
};

const TELA_CHEIA = ['producao', 'painel'];

const TELAS = {
  balcao:   { nome:'Balcão',    icone:'comanda',  titulo:'Balcão',   sub:'Lance o pedido e cobre no caixa',        render: telaBalcao },
  producao: { nome:'Produção',  icone:'producao', titulo:'Produção', sub:'Fila da cozinha, em ordem de chegada',   render: telaProducao },
  totem:    { nome:'Totem',     icone:'totem',    titulo:'Totem',    sub:'Autoatendimento com senha',              render: telaTotem },
  painel:   { nome:'Painel',    icone:'sino',     titulo:'Painel de senhas', sub:'Tela virada para o salão',        render: telaPainel },
  mesas:    { nome:'Mesas',     icone:'qr',       titulo:'QR das mesas',     sub:'Cliente pede pelo próprio celular', render: telaMesas },
  cardapio: { nome:'Cardápio',  icone:'cardapio', titulo:'Cardápio', sub:'Produtos e preços da sua loja',          render: telaCardapio },
  gestao:   { nome:'Gestão',    icone:'grafico',  titulo:'Gestão',   sub:'Números reais do movimento',             render: telaGestao },
  ajustes:  { nome:'Ajustes',   icone:'ajustes',  titulo:'Ajustes',  sub:'Lojas, aparelho, balança e integrações', render: telaAjustes },
};

/* O menu separa o que roda o dia inteiro do que se mexe de vez em quando */
const GRUPOS = [
  { rotulo:'Operação', telas:['balcao','producao','painel','totem'] },
  { rotulo:'Loja',     telas:['cardapio','mesas','gestao','ajustes'] },
];

const App = {
  tela: 'balcao',
  cozinha: false,

  ir(t){
    if (!TELAS[t]) return;
    if (!TELA_CHEIA.includes(t)) this.sairDaTelaCheia();
    if (t !== 'painel') painelSair();
    this.tela = t;
    try { history.replaceState(null, '', '#' + t); } catch(e){ location.hash = t; }
    this.render();
  },

  render(){
    const casca = document.getElementById('casca');
    Anima.antes();

    if (!Dados.carregado){
      casca.innerHTML = `<div class="carregando">${marcaCompleta('mini')}<span>Abrindo o sistema…</span></div>`;
      return;
    }
    if (!Dados.configurado()){
      casca.innerHTML = telaSetup();
      return;
    }

    const t = TELAS[this.tela];
    const loja = Dados.loja();
    const fila = Dados.fila().length;
    const modoCozinha = this.cozinha && TELA_CHEIA.includes(this.tela);

    casca.innerHTML = `
      <div class="app ${modoCozinha ? 'cozinha' : ''}">
        <aside class="trilha">
          <div class="marca">
            ${marcaIcone()}
            <span class="marca-txt">
              <b class="marca-nome">Coltelli</b>
              <span>${esc(loja ? loja.nome : Dados.config().rede || 'sorveteria')}</span>
            </span>
          </div>

          <nav aria-label="Telas do sistema">
            ${GRUPOS.map(g => `
              <div class="menu-grupo">
                <span class="rotulo menu-rot">${g.rotulo}</span>
                ${g.telas.map(id => {
                  const x = TELAS[id];
                  return `
                  <button class="menu-item" data-toque data-act="ir" data-tela="${id}" ${id === this.tela ? 'aria-current="page"' : ''}>
                    ${id === this.tela ? '<span class="menu-ativo" data-anima="menu-ativo" data-flip="tam" aria-hidden="true"></span>' : ''}
                    ${ic(x.icone)}<span>${x.nome}</span>
                    ${id === 'producao' && fila ? `<span class="conta" aria-label="${fila} na fila">${fila}</span>` : ''}
                  </button>`;
                }).join('')}
              </div>`).join('')}
          </nav>

          <div class="trilha-pe">
            <span class="sinal ${Dados.online ? 'sinal-ok' : ''}">
              ${ic(Dados.fonte === 'agente' ? 'agente' : Dados.fonte === 'nuvem' ? 'nuvem' : 'aparelho','sm')}
              ${Dados.fonte === 'agente' ? 'Agente da loja' : Dados.fonte === 'nuvem' ? 'Sincronizado' : 'Só neste aparelho'}
            </span>
            ${Agente.ligado ? `<span class="sinal ${Agente.temBalanca() ? 'sinal-ok' : ''}">
              ${ic('balanca','sm')} ${Agente.temBalanca() ? 'Balança lendo' : 'Balança off'}
            </span>
            <span class="sinal ${Agente.temTerminal() ? 'sinal-ok' : ''}">
              ${ic('cartao','sm')} ${Agente.temTerminal() ? 'Maquininha pronta' : 'Maquininha manual'}
            </span>
            <span class="sinal ${Agente.temImpressora() ? 'sinal-ok' : ''}">
              ${ic('impressora','sm')} ${Agente.temImpressora() ? 'Impressora pronta' : 'Sem impressora'}
            </span>` : ''}
          </div>
        </aside>

        <header class="topo">
          <div class="topo-tit">
            <h1>${t.titulo}</h1>
            <p>${t.sub}</p>
          </div>
          <div class="topo-dir">
            ${Aparelho.operador() ? `<span class="selo selo-neutro">${ic('pessoa','sm')} ${esc(Aparelho.operador())}</span>` : ''}
            <span class="relogio" id="relogio">--:--</span>
            <button class="icon-btn" data-act="alternar-tema" aria-label="Alternar tema claro e escuro">
              ${ic(Tema.atual() === 'dark' ? 'sol' : 'lua')}
            </button>
          </div>
        </header>

        <main class="palco">${t.render()}</main>
      </div>`;

    this.relogio();
    const busca = document.getElementById('busca-produto');
    if (busca && Comanda.busca){ busca.value = Comanda.busca; }

    const novaTela = this.telaAnterior !== this.tela;
    this.telaAnterior = this.tela;
    Anima.depois({ novaTela });
    Anima.numeros();
    Anima.toque();
    if (this.tela === 'painel') painelDepois();
    if (novaTela){
      Anima.tela(document.querySelector('.palco'));
      Anima.crescer(document.querySelector('.palco'));
    }
  },

  /* Modo cozinha (produção) e tela cheia (painel): some o menu e, quando o
     navegador deixa, a tela inteira vira a fila. */
  alternarTelaCheia(){
    this.cozinha = !this.cozinha;
    if (this.cozinha){
      const el = document.documentElement;
      if (el.requestFullscreen && !document.fullscreenElement){
        el.requestFullscreen().then(() => { this.cheia = true; }).catch(() => {});
      }
    } else this.sairDaTelaCheia();
    this.render();
  },
  sairDaTelaCheia(){
    this.cozinha = false;
    if (this.cheia && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    this.cheia = false;
  },

  relogio(){
    const el = document.getElementById('relogio');
    if (!el) return;
    const d = new Date();
    el.textContent = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  },
};

/* ------------------------------ Ações ------------------------------ */

const ACOES = Object.assign({
  ir: (d) => App.ir(d.tela),
  'alternar-tema': () => Tema.aplicar(Tema.atual() === 'dark' ? 'light' : 'dark'),
  'modo-cozinha': () => App.alternarTelaCheia(),
  'modal-fechar': () => { Teclado.ativo = null; Modal.fechar(); },
  'modal-fundo': (d, e) => { if (e.target.classList.contains('backdrop')) ACOES['modal-fechar'](); },
  'confirmar-sim': () => Confirmar.sim(),
  tecla: (d) => Teclado.digitar(d.k),
  'tecla-atalho': (d) => Teclado.definir(d.valor),
  'tecla-ok': () => Teclado.confirmar(),
}, acoesBalcao, acoesProducao, acoesCardapio, acoesGestao, acoesConfig, acoesTotem, acoesPainel, acoesMesas);

document.addEventListener('click', (e) => {
  const alvo = e.target.closest('[data-act]');
  if (!alvo || alvo.disabled) return;
  const fn = ACOES[alvo.dataset.act];
  if (fn) fn(alvo.dataset, e);
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'busca-produto'){
    Comanda.busca = e.target.value;
    pintarCatalogo();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape'){
    if (Modal.aberto) ACOES['modal-fechar']();
    else if (App.cozinha) ACOES['modo-cozinha']();
  }
  if (e.key === 'Enter' && Modal.aberto && Teclado.ativo) Teclado.confirmar();
});

window.addEventListener('hashchange', () => {
  const h = (location.hash || '').replace('#','');
  if (TELAS[h] && h !== App.tela) App.ir(h);
});

/* Esc do próprio navegador tira a tela cheia: o menu volta junto */
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && App.cheia){
    App.cheia = false;
    App.cozinha = false;
    App.render();
  }
});

/* ------------------------------ Início ------------------------------ */

(async function iniciar(){
  Modal.raiz = document.getElementById('modal');
  Aviso.raiz = document.getElementById('avisos');
  Tema.iniciar();

  const inicial = (location.hash || '').replace('#','');
  if (TELAS[inicial]) App.tela = inicial;

  /* Redesenhar por cima de quem está digitando apagaria o que foi escrito,
     então a atualização espera o campo perder o foco. */
  const digitando = () => {
    const a = document.activeElement;
    return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA');
  };
  let pendente = false, adiado = false;
  const agendar = () => {
    if (pendente) return;
    pendente = true;
    requestAnimationFrame(() => { pendente = false; App.render(); });
  };
  Dados.sub(() => {
    if (Modal.aberto && Teclado.ativo) return;   // não redesenhar por baixo do teclado
    if (digitando()){ adiado = true; return; }
    agendar();
  });
  document.addEventListener('focusout', () => {
    setTimeout(() => { if (adiado && !digitando()){ adiado = false; agendar(); } }, 60);
  });

  /* A balança manda leitura várias vezes por segundo: nada de redesenhar a tela
     inteira a cada uma. Cada tela pega só o pedaço que lhe interessa. */
  Agente.ouvir(() => {
    if (Modal.aberto){ if (pesando) pintarPeso(); return; }
    if (App.tela === 'balcao') autoAbrirBalanca();
    else if (App.tela === 'ajustes'){
      const el = document.getElementById('peso-ajustes');
      if (el) el.textContent = Agente.peso ? kgTexto(Agente.peso.liquido) : '0,000';
    }
  });

  Balanca.ouvir(() => {
    if (App.tela === 'ajustes' && !Modal.aberto) App.render();
    if (Teclado.ativo && pesando && Balanca.ultimo) Teclado.definir(Balanca.ultimo.gramas);
  });

  App.render();
  await Dados.iniciar();

  setInterval(() => App.relogio(), 20000);
  setInterval(() => { if (App.tela === 'producao') atualizarTempos(); }, 1000);
})();

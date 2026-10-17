/* Coltelli — sistema de movimento.

   Usa o Motion (o pacote atual do Framer Motion; `motion/react` é a camada React,
   e a raiz é a API para DOM puro, que é o caso aqui — o sistema não tem build).

   Três regras que valem para tudo:
   1. Movimento serve para explicar o que mudou, nunca para enfeitar. Pedido que
      pula de coluna, item que entra na comanda, número que sobe.
   2. Nada anima na tela da cozinha a ponto de atrapalhar quem lê a 3 metros.
   3. Se a biblioteca não carregar ou a pessoa pedir menos movimento no sistema,
      tudo continua funcionando — só para de animar. A biblioteca fica em vendor/,
      dentro do projeto, então a loja sem internet continua animando. */

const Anima = {
  lib: null,
  medidas: new Map(),      // chave -> DOMRect da renderização anterior
  vistos: new Set(),       // chaves que já entraram alguma vez
  ligada: true,

  /* A biblioteca é lida na hora do uso: ela pode chegar depois do primeiro render */
  motion(){
    if (this.lib) return this.lib;
    if (typeof window !== 'undefined' && window.Motion && window.Motion.animate){
      this.lib = window.Motion;
      return this.lib;
    }
    return null;
  },

  reduzido(){
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch(e){ return false; }
  },

  pronta(){
    if (!this.ligada || this.reduzido() || !this.motion()) return false;
    // aba escondida não desenha: começar animação ali só deixa lixo pela frente
    return !document.hidden;
  },

  /* ---------- primitivos ---------- */

  anima(el, para, opcoes){
    const m = this.motion();
    if (!m || !el) return { finished: Promise.resolve() };
    try { return m.animate(el, para, opcoes); }
    catch(e){ return { finished: Promise.resolve() }; }
  },

  entrada(el, { atraso = 0, de = 8 } = {}){
    if (!this.pronta()) return;
    this.anima(el, { opacity: [0, 1], transform: [`translateY(${de}px)`, 'translateY(0px)'] },
      { duration: 0.28, delay: atraso, ease: [0.22, 1, 0.36, 1] });
  },

  /* Saída precisa de um fantasma: o elemento real já saiu do DOM no redesenho */
  saida(rect, html, raiz = document.body){
    if (!this.pronta() || !rect || rect.width === 0) return;
    const fantasma = document.createElement('div');
    fantasma.className = 'anima-fantasma';
    fantasma.style.cssText =
      `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;` +
      `height:${rect.height}px;pointer-events:none;z-index:40;`;
    fantasma.innerHTML = html;
    raiz.appendChild(fantasma);
    const a = this.anima(fantasma,
      { opacity: [1, 0], transform: ['scale(1)', 'scale(0.94)'] },
      { duration: 0.22, ease: 'easeOut' });
    (a.finished || Promise.resolve()).then(() => fantasma.remove(), () => fantasma.remove());
  },

  /* FLIP: o elemento é recriado a cada redesenho, então a gente o faz sair
     da posição antiga e caminhar até a nova. É isso que dá o pulo de coluna. */
  mover(el, antes){
    if (!this.pronta()) return;
    const agora = el.getBoundingClientRect();
    const dx = antes.left - agora.left;
    const dy = antes.top - agora.top;
    // data-flip="tam": a peça também muda de tamanho no caminho (fundo do item
    // ativo do menu e das abas, que desliza de um item para o outro)
    const tam = el.dataset.flip === 'tam' && agora.width > 0 && agora.height > 0;
    const sx = tam ? antes.width / agora.width : 1;
    const sy = tam ? antes.height / agora.height : 1;
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2 && Math.abs(sx - 1) < .02 && Math.abs(sy - 1) < .02) return;
    const m = this.motion();
    const de = tam ? `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` : `translate(${dx}px, ${dy}px)`;
    const para = tam ? 'translate(0px, 0px) scale(1, 1)' : 'translate(0px, 0px)';
    const a = this.anima(el,
      { transform: [de, para] },
      { type: m && m.spring ? 'spring' : undefined, stiffness: 420, damping: 38, mass: 0.9, duration: 0.42 });

    /* Animação interrompida no meio (aba escondida, novo redesenho) não pode
       deixar o cartão parado fora do lugar. */
    const limpar = () => { if (el.isConnected) el.style.transform = ''; };
    (a.finished || Promise.resolve()).then(limpar, limpar);
    setTimeout(limpar, 900);
  },

  /* ---------- ciclo de redesenho ---------- */

  antes(){
    this.medidas.clear();
    if (!this.pronta()) return;
    document.querySelectorAll('[data-anima]').forEach(el => {
      this.medidas.set(el.dataset.anima, {
        rect: el.getBoundingClientRect(),
        html: el.outerHTML,
      });
    });
  },

  /* `novaTela`: a tela acabou de abrir, então tudo entra em cascata. Fora isso,
     só o que é novo de verdade entra — e pedido novo na produção brilha uma vez. */
  depois({ novaTela = false } = {}){
    if (!this.pronta()){ this.medidas.clear(); return; }
    const presentes = new Set();
    let novos = 0;

    document.querySelectorAll('[data-anima]').forEach(el => {
      const chave = el.dataset.anima;
      presentes.add(chave);
      const antes = this.medidas.get(chave);
      if (antes){
        this.mover(el, antes.rect);
      } else if (this.vistos.has(chave)){
        // existia antes, sumiu e voltou: trata como novo, sem exagero
        this.entrada(el, { de: 6 });
      } else {
        this.entrada(el, { atraso: Math.min(novos * (novaTela ? 0.045 : 0.035), novaTela ? 0.4 : 0.18), de: novaTela ? 14 : 8 });
        if (!novaTela && el.classList.contains('ped')) el.classList.add('recem');
        novos++;
      }
      this.vistos.add(chave);
    });

    // o que desapareceu sai com fantasma, na posição em que estava
    this.medidas.forEach((info, chave) => {
      if (!presentes.has(chave)){
        this.saida(info.rect, info.html);
        this.vistos.delete(chave);
      }
    });

    this.medidas.clear();
    if (this.vistos.size > 400) this.vistos.clear();
  },

  /* ---------- peças avulsas ---------- */

  /* Número que sobe. O valor anterior fica guardado por chave, porque o
     elemento é recriado a cada redesenho e perderia o ponto de partida. */
  valores: new Map(),
  formatos: {
    dinheiro: v => brl(v),
    curto: v => brlCurto(v),
    inteiro: v => String(Math.round(v)),
    minutos: v => numero(v) + ' min',
  },

  numeros(raiz = document){
    raiz.querySelectorAll('[data-num]').forEach(el => {
      const chave = el.dataset.num;
      const para = Number(el.dataset.valor || 0);
      const formata = this.formatos[el.dataset.fmt] || this.formatos.inteiro;
      const de = this.valores.has(chave) ? this.valores.get(chave) : para;
      this.valores.set(chave, para);
      if (!this.pronta() || Math.abs(para - de) < 0.005){
        el.textContent = formata(para);
        return;
      }
      const m = this.motion();
      try {
        m.animate(de, para, {
          duration: 0.5, ease: [0.22, 1, 0.36, 1],
          onUpdate: v => { el.textContent = formata(v); },
        });
      } catch(e){ el.textContent = formata(para); }
    });
  },

  /* Grade que acabou de trocar (categoria do balcão, do totem): os ladrilhos
     entram um atrás do outro, rápido, para o olho seguir a troca */
  cascata(els, { de = 10, passo = 0.025, teto = 0.3 } = {}){
    if (!this.pronta()) return;
    Array.from(els).forEach((el, i) => {
      this.anima(el, { opacity: [0, 1], transform: [`translateY(${de}px) scale(.98)`, 'translateY(0px) scale(1)'] },
        { duration: 0.32, delay: Math.min(i * passo, teto), ease: [0.22, 1, 0.36, 1] });
    });
  },

  /* O item tocado "voa" até o total da comanda: o atendente vê onde foi parar */
  voar(origem, destino, texto){
    if (!this.pronta() || !origem || !destino) return;
    const a = origem.getBoundingClientRect();
    const b = destino.getBoundingClientRect();
    if (!a.width || !b.width) return;
    const bola = document.createElement('div');
    bola.className = 'voo';
    bola.textContent = texto;
    document.body.appendChild(bola);
    const w = bola.offsetWidth, h = bola.offsetHeight;
    const x0 = a.left + a.width / 2 - w / 2, y0 = a.top + a.height / 2 - h / 2;
    const x1 = b.left + b.width / 2 - w / 2, y1 = b.top + b.height / 2 - h / 2;
    const meioY = Math.min(y0, y1) - 60;
    const voo = this.anima(bola, {
      transform: [
        `translate(${x0}px, ${y0}px) scale(.6)`,
        `translate(${(x0 + x1) / 2}px, ${meioY}px) scale(1.05)`,
        `translate(${x1}px, ${y1}px) scale(.5)`,
      ],
      opacity: [0, 1, 0.2],
    }, { duration: 0.62, ease: [0.4, 0, 0.2, 1] });
    (voo.finished || Promise.resolve()).then(() => { bola.remove(); this.pulsar(destino); }, () => bola.remove());
  },

  /* Batida curta em quem recebeu algo: total que mudou, contador do carrinho */
  pulsar(el, escala = 1.08){
    if (!this.pronta() || !el) return;
    this.anima(el, { transform: ['scale(1)', `scale(${escala})`, 'scale(1)'] }, { duration: 0.42, ease: 'easeOut' });
  },

  /* Barras da gestão crescem a partir do zero quando a tela abre */
  crescer(raiz = document){
    if (!this.pronta()) return;
    raiz.querySelectorAll('.barra-f, .meta-barra').forEach((el, i) => {
      this.anima(el, { transform: ['scaleX(0)', 'scaleX(1)'] },
        { duration: 0.7, delay: 0.12 + Math.min(i * 0.04, 0.4), ease: [0.22, 1, 0.36, 1] });
    });
    raiz.querySelectorAll('.grafico-barra').forEach((el, i) => {
      this.anima(el, { transform: ['scaleY(0)', 'scaleY(1)'] },
        { duration: 0.6, delay: 0.1 + Math.min(i * 0.03, 0.5), ease: [0.22, 1, 0.36, 1] });
    });
  },

  /* Troca de tela: um deslize curto, só o suficiente para o olho acompanhar */
  tela(el){
    if (!this.pronta() || !el) return;
    this.anima(el, { opacity: [0, 1], transform: ['translateY(6px)', 'translateY(0px)'] },
      { duration: 0.22, ease: [0.22, 1, 0.36, 1] });
  },

  /* Modal e aviso */
  modal(caixa, fundo){
    if (!this.pronta()) return;
    this.anima(fundo, { opacity: [0, 1] }, { duration: 0.16 });
    const m = this.motion();
    this.anima(caixa, { opacity: [0, 1], transform: ['scale(0.96) translateY(10px)', 'scale(1) translateY(0px)'] },
      { type: m && m.spring ? 'spring' : undefined, stiffness: 520, damping: 34, duration: 0.3 });
  },

  aviso(el){
    if (!this.pronta()) return;
    const m = this.motion();
    this.anima(el, { opacity: [0, 1], transform: ['translateX(24px)', 'translateX(0px)'] },
      { type: m && m.spring ? 'spring' : undefined, stiffness: 480, damping: 36, duration: 0.3 });
  },

  /* Chamou a senha: o cartão pulsa, para o salão perceber */
  chamou(el){
    if (!this.pronta() || !el) return;
    this.anima(el, { transform: ['scale(.9)', 'scale(1.06)', 'scale(.98)', 'scale(1.03)', 'scale(1)'] },
      { duration: 1.1, ease: 'easeInOut' });
  },

  /* Resposta ao toque: o dedo precisa de retorno imediato no balcão */
  toque(raiz = document){
    const m = this.motion();
    if (!m || !m.press || !this.pronta()) return;
    raiz.querySelectorAll('[data-toque]:not([data-toque-ligado])').forEach(el => {
      el.dataset.toqueLigado = '1';
      try {
        m.press(el, (alvo) => {
          this.anima(alvo, { transform: 'scale(0.97)' }, { duration: 0.1 });
          return () => this.anima(alvo, { transform: 'scale(1)' }, { duration: 0.18, ease: 'easeOut' });
        });
      } catch(e){ /* sem press nesta versão: segue sem o efeito */ }
    });
  },
};

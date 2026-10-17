/* Coltelli — peças de interface reaproveitadas pelas telas */

/* Marca da loja: arquivos do próprio logotipo, não desenho aproximado */
const marcaIcone = () => `<span class="marca-ic"><img src="img/marca.png" alt=""></span>`;
const marcaCompleta = (cls = '') => `
  <span class="placa-marca ${cls}">
    <img class="marca-img" src="img/marca.png" alt="">
    <img class="logotipo" src="img/logotipo.png" alt="Coltelli Sorvetes">
  </span>`;

const ic = (nome, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${nome}"></use></svg>`;

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

/* Tempo decorrido em m:ss e a faixa de urgência para a cozinha */
function decorrido(ts){
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  const m = Math.floor(s / 60);
  return m > 99 ? '99+' : `${m}:${String(s % 60).padStart(2,'0')}`;
}
function urgencia(ts, metaMin){
  const min = (Date.now() - ts) / 60000;
  if (min > metaMin * 2) return 'atrasado';
  if (min > metaMin) return 'atencao';
  return '';
}

/* ---------- Modal ---------- */
const Modal = {
  raiz: null,
  aberto: false,
  abrir(html, { largo = false } = {}){
    this.raiz.innerHTML = `
      <div class="backdrop" data-act="modal-fundo">
        <div class="modal ${largo ? 'modal-largo' : ''}" role="dialog" aria-modal="true">${html}</div>
      </div>`;
    this.aberto = true;
    Anima.modal(this.raiz.querySelector('.modal'), this.raiz.querySelector('.backdrop'));
    Anima.toque(this.raiz);
    const foco = this.raiz.querySelector('[data-foco]');
    if (foco) setTimeout(() => { foco.focus(); if (foco.select) foco.select(); }, 30);
  },
  trocar(html){
    const m = this.raiz.querySelector('.modal');
    if (m){
      m.innerHTML = html;
      Anima.toque(m);
      const f = m.querySelector('[data-foco]');
      if (f) setTimeout(() => f.focus(), 20);
    }
    else this.abrir(html);
  },
  fechar(){
    if (this.aoFechar){ const f = this.aoFechar; this.aoFechar = null; f(); }
    this.raiz.innerHTML = '';
    this.aberto = false;
  },
  cabecalho(icone, titulo, sub){
    return `
    <div class="modal-head">
      <span class="modal-ic">${ic(icone, 'lg')}</span>
      <div><h2>${esc(titulo)}</h2>${sub ? `<p class="modal-sub">${esc(sub)}</p>` : ''}</div>
      <button class="icon-btn" data-act="modal-fechar" aria-label="Fechar">${ic('x')}</button>
    </div>`;
  },
};

/* ---------- Aviso rápido ---------- */
const Aviso = {
  raiz: null,
  mostrar(msg, tipo = 'ok'){
    const el = document.createElement('div');
    el.className = 'toast toast-' + tipo;
    el.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
    el.innerHTML = `${ic(tipo === 'erro' ? 'alerta' : 'check')}<span>${esc(msg)}</span>`;
    this.raiz.appendChild(el);
    Anima.aviso(el);
    setTimeout(() => { el.classList.add('saindo'); }, 2800);
    setTimeout(() => el.remove(), 3200);
  },
  erro(msg){ this.mostrar(msg, 'erro'); },
};

/* ---------- Confirmação (o navegador não mostra confirm() aqui) ---------- */
const Confirmar = {
  acao: null,
  pedir({ titulo, texto, botao = 'Confirmar', perigo = false, aoConfirmar }){
    this.acao = aoConfirmar;
    Modal.abrir(`
      ${Modal.cabecalho(perigo ? 'alerta' : 'check', titulo, texto)}
      <div class="modal-acoes">
        <button class="btn btn-ghost" data-act="modal-fechar">Voltar</button>
        <button class="btn ${perigo ? 'btn-perigo' : 'btn-primario'}" data-act="confirmar-sim" data-foco>${esc(botao)}</button>
      </div>`);
  },
  sim(){
    const fn = this.acao;
    this.acao = null;
    Modal.fechar();
    if (fn) fn();
  },
};

/* ---------- Teclado numérico (peso, dinheiro, quantidade) ---------- */
const Teclado = {
  ativo: null,
  abrir({ titulo, sub, unidade = '', valor = '', decimais = 3, aoConfirmar, dica = '', atalhos = [], calcular = null }){
    this.ativo = { titulo, sub, unidade, valor: String(valor || ''), decimais, aoConfirmar, dica, atalhos, calcular };
    Modal.abrir(this.html());
  },
  conta(){
    const t = this.ativo;
    if (!t || !t.calcular) return '';
    return t.calcular(parseFloat(t.valor || '0') || 0) || '';
  },
  html(){
    const t = this.ativo;
    const teclas = ['7','8','9','4','5','6','1','2','3'];
    return `
      ${Modal.cabecalho('teclado', t.titulo, t.sub)}
      <div class="visor">
        <span class="visor-v">${esc(t.valor || '0')}</span>
        <span class="visor-u">${esc(t.unidade)}</span>
      </div>
      <div class="visor-calc" id="visor-calc" aria-live="polite">${esc(this.conta())}</div>
      ${t.dica ? `<p class="dica">${esc(t.dica)}</p>` : ''}
      ${t.atalhos.length ? `<div class="chips">${t.atalhos.map(a =>
        `<button class="chip" data-act="tecla-atalho" data-valor="${a.valor}">${esc(a.rotulo)}</button>`).join('')}</div>` : ''}
      <div class="teclado">
        ${teclas.map(k => `<button class="tecla" data-act="tecla" data-k="${k}">${k}</button>`).join('')}
        ${t.decimais
          ? `<button class="tecla" data-act="tecla" data-k=".">,</button>`
          : `<button class="tecla" data-act="tecla" data-k="00">00</button>`}
        <button class="tecla" data-act="tecla" data-k="0">0</button>
        <button class="tecla tecla-apagar" data-act="tecla" data-k="apagar" aria-label="Apagar">${ic('apagar')}</button>
      </div>
      <button class="btn btn-primario btn-grande btn-cheio" data-act="tecla-ok">${ic('check')} Confirmar</button>`;
  },
  digitar(k){
    const t = this.ativo;
    if (!t) return;
    if (k === 'apagar') t.valor = t.valor.slice(0, -1);
    else if (k === '.'){ if (!t.valor.includes('.') && t.decimais) t.valor = (t.valor || '0') + '.'; }
    else {
      const proximo = t.valor + k;
      const [, dec] = proximo.split('.');
      if (dec && dec.length > t.decimais) return;
      if (proximo.replace('.','').length > 9) return;
      t.valor = proximo.replace(/^0+(?=\d)/, '');
    }
    this.pintar();
  },
  /* Só o visor muda a cada tecla — redesenhar o teclado inteiro atrapalharia o toque */
  pintar(){
    const v = Modal.raiz.querySelector('.visor-v');
    if (!v){ Modal.trocar(this.html()); return; }
    v.textContent = this.ativo.valor || '0';
    const c = document.getElementById('visor-calc');
    if (c) c.textContent = this.conta();
  },
  definir(v){ if (this.ativo){ this.ativo.valor = String(v); this.pintar(); } },
  confirmar(){
    const t = this.ativo;
    if (!t) return;
    const n = parseFloat(t.valor || '0') || 0;
    this.ativo = null;
    Modal.fechar();
    t.aoConfirmar(n);
  },
};

/* ---------- Campos de formulário ---------- */
const campo = ({ id, rotulo, valor = '', tipo = 'text', dica = '', sufixo = '', obrigatorio = false, foco = false }) => `
  <label class="campo" for="${id}">
    <span class="campo-rot">${esc(rotulo)}${obrigatorio ? ' <b>*</b>' : ''}</span>
    <span class="campo-caixa">
      <input id="${id}" type="${tipo}" value="${esc(valor)}" ${foco ? 'data-foco' : ''}
             ${tipo === 'number' ? 'inputmode="decimal" step="0.01"' : ''} autocomplete="off">
      ${sufixo ? `<span class="campo-sufixo">${esc(sufixo)}</span>` : ''}
    </span>
    ${dica ? `<span class="campo-dica">${esc(dica)}</span>` : ''}
  </label>`;

const vazio = (icone, titulo, texto, acao = '') => `
  <div class="vazio">
    <span class="vazio-ic">${ic(icone, 'lg')}</span>
    <h3>${esc(titulo)}</h3>
    <p>${esc(texto)}</p>
    ${acao}
  </div>`;

/* ---------- Aviso sonoro da cozinha ---------- */
const Som = {
  ctx: null,
  bip(freq = 880, dur = 0.14){
    try{
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18, this.ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(); o.stop(this.ctx.currentTime + dur + 0.02);
    }catch(e){ /* sem áudio: o alerta visual já cobre */ }
  },
};

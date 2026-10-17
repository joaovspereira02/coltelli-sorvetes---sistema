/* Coltelli — conversa com o agente local da loja.

   O agente roda no computador do balcão (`node agente/servidor.js`) e é quem fala
   com a balança pela serial, com a maquininha e com o celular do cliente.
   Sem agente, o sistema segue funcionando: peso digitado e cobrança manual. */

const Agente = {
  base: null,
  ligado: false,
  estado: null,        // { versao, balanca, terminal, base }
  peso: null,          // última leitura { gramas, liquido, estavel }
  fonteEventos: null,
  ouvintes: new Set(),
  ouvintesCobranca: new Set(),

  ouvir(fn){ this.ouvintes.add(fn); return () => this.ouvintes.delete(fn); },
  avisar(){ this.ouvintes.forEach(fn => fn()); },
  aoCobrar(fn){ this.ouvintesCobranca.add(fn); return () => this.ouvintesCobranca.delete(fn); },

  temBalanca(){ return !!(this.ligado && this.estado && this.estado.balanca.conectada); },
  temTerminal(){
    return !!(this.ligado && this.estado && this.estado.terminal.pronto && this.estado.terminal.provedor !== 'manual');
  },
  temImpressora(){
    return !!(this.ligado && this.estado && this.estado.impressora && this.estado.impressora.pronta);
  },
  async imprimir(tipo, pedido){
    if (!this.temImpressora()) return null;
    return this.api('/api/imprimir', { method:'POST', body: JSON.stringify({ tipo, pedido }) });
  },
  /* o endereço da mesa só vale com o código; a tela de mesas pega a lista em /api/mesas */
  urlMesa(n, token){
    if (!this.ligado || !token) return null;
    const base = (this.estado && this.estado.base) || this.base;
    return `${base}/mesa/${n}?t=${encodeURIComponent(token)}`;
  },
  urlPedido(codigo){
    if (!this.ligado || !codigo) return null;
    const base = (this.estado && this.estado.base) || this.base;
    return `${base}/p/${encodeURIComponent(codigo)}`;
  },

  /* Procura o agente: primeiro a própria origem (quando o sistema é servido por ele),
     depois o endereço padrão na máquina do caixa. */
  async iniciar(){
    // Página em https não alcança http://localhost (o navegador bloqueia conteúdo
    // misto), então o agente só é procurado quando o sistema é aberto por ele.
    if (location.protocol !== 'http:') return false;
    const alvos = [location.origin];
    if (!alvos.includes('http://localhost:8899')) alvos.push('http://localhost:8899');

    for (const base of alvos){
      try {
        const r = await fetch(base + '/api/estado', { cache:'no-store' });
        if (!r.ok) continue;
        this.estado = await r.json();
        this.base = base;
        this.ligado = true;
        this.assinar();
        this.avisar();
        return true;
      } catch(e){ /* não está lá: segue para o próximo */ }
    }
    return false;
  },

  assinar(){
    try { this.fonteEventos = new EventSource(this.base + '/eventos'); }
    catch(e){ return; }

    this.fonteEventos.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch(e){ return; }
      if (m.tipo === 'peso'){ this.peso = m.dados; this.avisar(); }
      else if (m.tipo === 'balanca'){ this.estado.balanca = m.dados; this.avisar(); }
      else if (m.tipo === 'terminal'){ this.estado.terminal = m.dados; this.avisar(); }
      else if (m.tipo === 'cobranca'){ this.ouvintesCobranca.forEach(fn => fn(m.dados)); }
      else if (m.tipo === 'dados'){
        const antes = Dados.estado.pedidos.length;
        if (Dados.adaptador && Dados.adaptador.invalidar) Dados.adaptador.invalidar();
        Dados.recarregar().then(() => {
          // pedido que chegou de outro aparelho (mesa, totem, outro caixa) avisa a cozinha
          if (Dados.estado.pedidos.length > antes && Aparelho.som()) Som.bip(1040, .12);
          Dados.emit();
        });
      }
    };
    this.fonteEventos.onerror = () => {
      // o navegador reconecta sozinho; só marcamos que a leitura envelheceu
      this.peso = null;
      this.avisar();
    };
  },

  async api(caminho, opcoes){
    const r = await fetch(this.base + caminho, {
      headers: { 'Content-Type':'application/json' },
      ...opcoes,
    });
    const corpo = await r.json().catch(() => null);
    if (!r.ok) throw new Error((corpo && corpo.erro) || ('erro ' + r.status));
    return corpo;
  },

  async tarar(gramas){
    if (!this.ligado) return null;
    return this.api('/api/balanca/tarar', { method:'POST', body: JSON.stringify({ gramas }) });
  },

  async cobrar({ valor, forma, ref }){
    return this.api('/api/cobranca', { method:'POST', body: JSON.stringify({ valor, forma, ref }) });
  },
  async cancelarCobranca(id){
    return this.api('/api/cobranca/' + encodeURIComponent(id), { method:'DELETE' });
  },
};

/* ---------- QR Code do cupom ----------
   A biblioteca vem do CDN; sem internet na loja, o sistema mostra o código escrito. */
function qrSvg(texto, px = 150){
  if (typeof qrcode !== 'function') return '';
  try {
    const q = qrcode(0, 'M');
    q.addData(texto);
    q.make();
    const n = q.getModuleCount();
    const c = px / n;
    let d = '';
    for (let l = 0; l < n; l++){
      for (let col = 0; col < n; col++){
        if (q.isDark(l, col)){
          d += `M${(col*c).toFixed(2)} ${(l*c).toFixed(2)}h${c.toFixed(2)}v${c.toFixed(2)}h-${c.toFixed(2)}z`;
        }
      }
    }
    return `<svg class="qr" viewBox="0 0 ${px} ${px}" width="${px}" height="${px}" role="img" aria-label="QR Code para acompanhar o pedido">
      <rect width="${px}" height="${px}" fill="#FFFFFF"></rect><path d="${d}" fill="#0F3571"></path></svg>`;
  } catch(e){ return ''; }
}

/* Agente Coltelli — cobrança na maquininha.

   O navegador não fala com pinpad. Quem fala é este agente, que roda no computador
   da loja e guarda o token — o token nunca chega ao navegador.

   Hoje há um provedor implementado por API (Mercado Pago Point) e o modo manual,
   que é o que a loja faz hoje: cobra na maquininha e registra a forma no sistema.

   Stone, Cielo LIO e PagSeguro integram por SDK dentro da própria maquininha
   (aplicativo Android no terminal), não por API a partir do PC. Para esses,
   o caminho é outro: um app no terminal que chama este agente. */

const BASE_MP = 'https://api.mercadopago.com';

/* ---------------- Manual: sem terminal integrado ---------------- */
class Manual {
  constructor(){ this.nome = 'manual'; this.pronto = true; }
  estado(){ return { provedor:'manual', pronto:true, detalhe:'cobrança digitada na maquininha pelo atendente' }; }
  async cobrar({ valor, forma, ref }){
    return { id: 'manual-' + ref, estado: 'manual', valor, forma,
             detalhe: 'Cobre na maquininha e confirme na tela' };
  }
  async consultar(id){ return { id, estado: 'manual' }; }
  async cancelar(id){ return { id, estado: 'cancelado' }; }
}

/* ---------------- Mercado Pago Point (terminal inteligente) ----------------
   Endpoints usados (confira na conta da loja antes de operar com dinheiro real):
     GET    /point/integration-api/devices
     POST   /point/integration-api/devices/{device}/payment-intents
     GET    /point/integration-api/payment-intents/{intent}
     DELETE /point/integration-api/devices/{device}/payment-intents/{intent}
   O token é de produção da própria loja e fica só no config.json deste agente. */
class MercadoPagoPoint {
  constructor(cfg){
    this.nome = 'mercadopago';
    this.token = cfg.token;
    this.device = cfg.deviceId || null;
    this.pronto = !!this.token;
    this.detalhe = this.token ? 'token configurado' : 'sem token no config.json';
    this.intencoes = new Map();
  }

  estado(){
    return { provedor:'mercadopago', pronto:this.pronto && !!this.device,
             device:this.device, detalhe:this.detalhe };
  }

  async chamar(caminho, opcoes = {}){
    const r = await fetch(BASE_MP + caminho, {
      ...opcoes,
      headers: {
        'Authorization': 'Bearer ' + this.token,
        'Content-Type': 'application/json',
        ...(opcoes.headers || {}),
      },
    });
    const texto = await r.text();
    let corpo = null;
    try { corpo = texto ? JSON.parse(texto) : null; } catch(e){ corpo = { bruto: texto }; }
    if (!r.ok){
      const msg = (corpo && (corpo.message || corpo.error)) || ('HTTP ' + r.status);
      const erro = new Error(msg);
      erro.status = r.status;
      erro.corpo = corpo;
      throw erro;
    }
    return corpo;
  }

  /* Descobre o terminal pareado quando o config não traz o id */
  async descobrir(){
    if (!this.pronto) return null;
    try {
      const r = await this.chamar('/point/integration-api/devices');
      const lista = (r && r.devices) || [];
      if (!this.device && lista.length) this.device = lista[0].id;
      this.detalhe = lista.length
        ? `${lista.length} terminal(is) pareado(s)`
        : 'nenhum terminal pareado na conta';
      return lista;
    } catch(e){
      this.detalhe = 'falha ao listar terminais: ' + e.message;
      return null;
    }
  }

  async cobrar({ valor, ref, imprimir = true }){
    if (!this.device) throw new Error('nenhum terminal Point pareado');
    const corpo = {
      amount: Math.round(valor * 100),               // a API trabalha em centavos
      additional_info: { external_reference: String(ref), print_on_terminal: imprimir },
    };
    const r = await this.chamar(
      `/point/integration-api/devices/${encodeURIComponent(this.device)}/payment-intents`,
      { method:'POST', body: JSON.stringify(corpo) },
    );
    this.intencoes.set(r.id, r);
    return { id: r.id, estado: 'aguardando', valor, detalhe: 'aproxime o cartão na maquininha' };
  }

  async consultar(id){
    const r = await this.chamar(`/point/integration-api/payment-intents/${encodeURIComponent(id)}`);
    return { id, estado: this.traduzir(r.state), bruto: r, detalhe: r.state };
  }

  async cancelar(id){
    if (!this.device) return { id, estado:'cancelado' };
    try {
      await this.chamar(
        `/point/integration-api/devices/${encodeURIComponent(this.device)}/payment-intents/${encodeURIComponent(id)}`,
        { method:'DELETE' },
      );
    } catch(e){ /* já terminou ou já foi cancelada */ }
    return { id, estado:'cancelado' };
  }

  traduzir(estado){
    const mapa = {
      OPEN:'aguardando', ON_TERMINAL:'aguardando', PROCESSING:'processando',
      FINISHED:'aprovado', CANCELED:'cancelado', ERROR:'recusado', ABANDONED:'cancelado',
    };
    return mapa[estado] || 'aguardando';
  }
}

function criar(cfg = {}){
  if (cfg.provedor === 'mercadopago' && cfg.token) return new MercadoPagoPoint(cfg);
  return new Manual();
}

module.exports = { criar, Manual, MercadoPagoPoint };

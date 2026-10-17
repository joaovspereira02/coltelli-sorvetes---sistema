/* Coltelli — camada de dados.

   Nada aqui é inventado: o sistema começa vazio e só mostra o que a loja cadastrar
   e vender. Duas formas de guardar, na ordem de preferência:

   1. Banco compartilhado da plataforma (quando a página roda publicada). Os aparelhos
      — caixa, tela da cozinha, totem — enxergam os mesmos pedidos ao vivo.
   2. Armazenamento do próprio navegador, quando o banco não está disponível
      (arquivo aberto direto do computador). Os dados ficam só naquele aparelho.

   `Dados.online` diz em qual dos dois está rodando, e a interface avisa o usuário. */

const COLECOES = ['config', 'lojas', 'produtos', 'pedidos', 'dias'];

const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* Dinheiro é sempre múltiplo de centavo. Sem isso, 437 g a R$ 59,90/kg viram
   R$ 26,1763 no caixa, e a fração contamina pedido, troco e faturamento do dia. */
const centavos = (v) => Math.round((Number(v) || 0) * 100) / 100;

const hoje = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

/* ---------- Armazenamento local (um aparelho só) ---------- */
const Local = {
  nome: 'local',
  chave(c){ return 'cotteli:' + c; },
  ler(c){
    try { return JSON.parse(localStorage.getItem(this.chave(c)) || '[]'); }
    catch(e){ return []; }
  },
  escrever(c, arr){
    try { localStorage.setItem(this.chave(c), JSON.stringify(arr)); }
    catch(e){ /* navegação privada ou armazenamento cheio */ }
  },
  async listar(c){ return this.ler(c); },
  async salvar(c, id, corpo){
    const arr = this.ler(c);
    const i = arr.findIndex(x => x.id === id);
    const doc = { ...corpo, id };
    if (i >= 0) arr[i] = doc; else arr.push(doc);
    this.escrever(c, arr);
    return doc;
  },
  async remover(c, id){ this.escrever(c, this.ler(c).filter(x => x.id !== id)); },
  observar(){ return () => {}; },
};

/* ---------- Banco compartilhado da plataforma ---------- */
function Nuvem(db){
  return {
    nome: 'nuvem',
    async listar(c){
      const s = await db.collection(c).get();
      return s.docs.map(d => ({ ...d.data(), id: d.id }));
    },
    async salvar(c, id, corpo){
      await db.collection(c).doc(id).set({ ...corpo });
      return { ...corpo, id };
    },
    async remover(c, id){ await db.collection(c).doc(id).delete(); },
    observar(c, cb){
      return db.collection(c).onSnapshot(
        s => cb(s.docs.map(d => ({ ...d.data(), id: d.id }))),
        () => { /* assinatura encerrada: a tela segue com o que já tem */ },
      );
    },
  };
}

/* ---------- Agente local da loja (balança, maquininha e acompanhamento) ---------- */
function ViaAgente(base){
  // `recarregar` pede cinco coleções de uma vez; uma busca só atende todas.
  let emVoo = null, quando = 0;
  const tudo = () => {
    const agora = Date.now();
    if (!emVoo || agora - quando > 250){
      quando = agora;
      emVoo = fetch(base + '/api/dados', { cache:'no-store' }).then(r => r.json());
    }
    return emVoo;
  };
  const esquecer = () => { emVoo = null; };

  return {
    nome: 'agente',
    invalidar: esquecer,
    async listar(c){
      const d = await tudo();
      return d[c] || [];
    },
    /* O agente devolve o documento como ficou gravado: é ele quem garante que dois
       caixas fechando no mesmo segundo não saiam com o mesmo número de pedido. */
    async salvar(c, id, corpo){
      const r = await fetch(`${base}/api/dados/${c}/${id}`, {
        method:'PUT', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ ...corpo, id }),
      });
      esquecer();
      const gravado = await r.json().catch(() => null);
      if (!r.ok) throw new Error((gravado && gravado.erro) || 'o agente não gravou (erro ' + r.status + ')');
      return gravado && gravado.id ? gravado : { ...corpo, id };
    },
    async remover(c, id){
      const r = await fetch(`${base}/api/dados/${c}/${id}`, { method:'DELETE' });
      esquecer();
      if (!r.ok) throw new Error('o agente não apagou (erro ' + r.status + ')');
    },
    observar(){ return () => {}; },   // as mudanças chegam pelos eventos do agente
  };
}

/* ------------------------------------------------------------------ */

const Dados = {
  adaptador: Local,
  fonte: 'local',            // local | agente | nuvem
  online: false,
  carregado: false,
  erro: null,
  estado: { config: null, lojas: [], produtos: [], pedidos: [], dias: [] },

  subs: new Set(),
  sub(fn){ this.subs.add(fn); return () => this.subs.delete(fn); },
  emit(){ this.subs.forEach(fn => fn()); },

  /* ---------- Ciclo de vida ---------- */
  async iniciar(){
    await this.recarregar();          // desenha na hora com o que houver neste aparelho
    this.carregado = true;
    this.emit();

    // 1º o agente da loja (funciona sem internet e serve a página do cliente),
    // 2º o banco compartilhado da plataforma, 3º só este aparelho.
    if (await Agente.iniciar()) await this.usarAgente();
    else this.conectarNuvem();
  },

  async usarAgente(){
    const fonte = ViaAgente(Agente.base);
    let doAgente;
    try { doAgente = await fonte.listar('lojas'); }
    catch(e){ return this.conectarNuvem(); }

    const local = Local.ler('lojas');
    if (!doAgente.length && local.length){
      try {
        for (const c of COLECOES){
          for (const doc of Local.ler(c)) await fonte.salvar(c, doc.id, doc);
        }
      } catch(e){ /* segue com o que o agente já tem */ }
    }
    this.adaptador = fonte;
    this.fonte = 'agente';
    this.online = true;
    await this.recarregar();
    this.emit();
  },

  async conectarNuvem(){
    let db = null;
    try { db = window.claude ? await window.claude.use('db') : null; }
    catch(e){ db = null; }
    if (!db) return;

    const nuvem = Nuvem(db);
    let daNuvem;
    try { daNuvem = await nuvem.listar('lojas'); }
    catch(e){ return; }               // sem permissão de escrita: segue local

    // Primeiro uso com banco disponível: sobe o que já existe neste aparelho.
    const local = Local.ler('lojas');
    if (!daNuvem.length && local.length){
      try {
        for (const c of COLECOES){
          for (const doc of Local.ler(c)) await nuvem.salvar(c, doc.id, doc);
        }
      } catch(e){ return; }
    }

    this.adaptador = nuvem;
    this.fonte = 'nuvem';
    this.online = true;
    await this.recarregar();
    COLECOES.forEach(c => nuvem.observar(c, lista => {
      if (c === 'config') this.estado.config = lista.find(x => x.id === 'app') || null;
      else this.estado[c] = lista;
      this.emit();
    }));
    this.emit();
  },

  async recarregar(){
    const [config, lojas, produtos, pedidos, dias] = await Promise.all(
      COLECOES.map(c => this.adaptador.listar(c)),
    );
    this.estado = {
      config: config.find(x => x.id === 'app') || null,
      lojas, produtos, pedidos, dias,
    };
  },

  async gravar(colecao, corpo){
    const id = corpo.id || novoId();
    const doc = await this.adaptador.salvar(colecao, id, { ...corpo, id });
    if (colecao === 'config') this.estado.config = doc;
    else {
      const lista = this.estado[colecao];
      const i = lista.findIndex(x => x.id === id);
      if (i >= 0) lista[i] = doc; else lista.push(doc);
    }
    this.emit();
    return doc;
  },

  async apagar(colecao, id){
    await this.adaptador.remover(colecao, id);
    this.estado[colecao] = this.estado[colecao].filter(x => x.id !== id);
    this.emit();
  },

  /* ---------- Configuração ---------- */
  configurado(){ return !!(this.estado.config && this.estado.lojas.length); },
  config(){ return this.estado.config || { rede: '', id: 'app' }; },
  async salvarConfig(patch){ return this.gravar('config', { ...this.config(), ...patch, id: 'app' }); },

  /* ---------- Lojas ---------- */
  lojas(){ return this.estado.lojas.slice().sort((a,b) => a.nome.localeCompare(b.nome)); },
  loja(id = Aparelho.lojaId()){ return this.estado.lojas.find(l => l.id === id) || this.lojas()[0] || null; },

  /* ---------- Cardápio ---------- */
  produtos(){ return this.estado.produtos.slice().sort((a,b) => (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome)); },
  produtosAtivos(){ return this.produtos().filter(p => p.ativo !== false); },
  categorias(){
    const vistas = [];
    this.produtos().forEach(p => { if (p.categoria && !vistas.includes(p.categoria)) vistas.push(p.categoria); });
    return vistas;
  },
  produto(id){ return this.estado.produtos.find(p => p.id === id) || null; },

  /* ---------- Pedidos ao vivo ---------- */
  pedidos(lojaId = Aparelho.lojaId()){
    return this.estado.pedidos
      .filter(p => p.lojaId === lojaId)
      .sort((a,b) => a.criadoEm - b.criadoEm);
  },
  porStatus(status, lojaId){ return this.pedidos(lojaId).filter(p => p.status === status); },
  fila(lojaId){ return this.pedidos(lojaId).filter(p => p.status === 'novo' || p.status === 'preparo'); },
  /* Totem sem maquininha e mesa pelo QR geram pedido "a pagar no caixa" */
  aReceber(lojaId){ return this.pedidos(lojaId).filter(p => p.pago === false); },

  async receber(id, { pagamento, operador = '' }){
    const p = this.estado.pedidos.find(x => x.id === id);
    if (!p) return null;
    return this.gravar('pedidos', {
      ...p, pago: true, pagamento, recebidoEm: Date.now(),
      operador: p.operador || operador,
    });
  },

  proximoNumero(lojaId = Aparelho.lojaId()){
    const data = hoje();
    const vivos = this.estado.pedidos.filter(p => p.lojaId === lojaId && p.data === data);
    const dia = this.dia(lojaId, data);
    const arquivados = dia ? dia.pedidos : [];
    const maior = [...vivos, ...arquivados].reduce((m, p) => Math.max(m, p.numero || 0), 0);
    return maior + 1;
  },

  async criarPedido({ lojaId = Aparelho.lojaId(), canal = 'balcão', cliente = '', tipo = 'balcão',
                      itens, pagamento = '', pago = false, operador = '' }){
    const pedido = {
      numero: this.proximoNumero(lojaId),
      codigo: novoId().slice(0, 8),     // vai no QR do cupom, não expõe nada da loja
      lojaId, data: hoje(), canal, cliente, tipo, pagamento, pago, operador,
      itens: itens.map(i => ({ ...i, valor: centavos(i.valor) })),
      valor: centavos(itens.reduce((s,i) => s + centavos(i.valor), 0)),
      status: 'novo',
      criadoEm: Date.now(),
    };
    return this.gravar('pedidos', pedido);
  },

  async avancar(id){
    const p = this.estado.pedidos.find(x => x.id === id);
    if (!p) return;
    const fluxo = { novo:'preparo', preparo:'pronto', pronto:'entregue' };
    const proximo = fluxo[p.status];
    if (!proximo) return;
    const marcos = { preparo:'iniciadoEm', pronto:'prontoEm', entregue:'entregueEm' };
    const atualizado = { ...p, status: proximo, [marcos[proximo]]: Date.now() };
    if (proximo === 'entregue') return this.arquivar(atualizado);
    return this.gravar('pedidos', atualizado);
  },

  async cancelar(id, motivo = ''){
    const p = this.estado.pedidos.find(x => x.id === id);
    if (!p) return;
    return this.arquivar({ ...p, status:'cancelado', motivo, entregueEm: Date.now() });
  },

  /* Pedido concluído sai da fila e vira uma linha no fechamento do dia.
     Assim a coleção ao vivo fica pequena e o histórico continua inteiro. */
  async arquivar(pedido){
    const chave = `${pedido.lojaId}__${pedido.data}`;
    const dia = this.dia(pedido.lojaId, pedido.data) || { id: chave, lojaId: pedido.lojaId, data: pedido.data, pedidos: [] };
    const linha = {
      numero: pedido.numero, codigo: pedido.codigo || '', lojaId: pedido.lojaId,
      canal: pedido.canal, tipo: pedido.tipo,
      pagamento: pedido.pagamento, pago: pedido.pago !== false, valor: pedido.valor, status: pedido.status,
      cliente: pedido.cliente || '', motivo: pedido.motivo || '',
      criadoEm: pedido.criadoEm, prontoEm: pedido.prontoEm || null, entregueEm: pedido.entregueEm,
      operador: pedido.operador || '',
      itens: pedido.itens.map(i => ({ nome:i.nome, qtd:i.qtd, pesoG:i.pesoG || 0, valor:i.valor })),
    };
    await this.gravar('dias', { ...dia, pedidos: [...dia.pedidos, linha] });
    await this.apagar('pedidos', pedido.id);
  },

  dia(lojaId, data = hoje()){ return this.estado.dias.find(d => d.id === `${lojaId}__${data}`) || null; },

  /* Todos os pedidos de um dia, os da fila e os já fechados, do mais novo ao mais antigo */
  pedidosDoDia(lojaId = Aparelho.lojaId(), data = hoje()){
    const dia = this.dia(lojaId, data);
    const vivos = this.estado.pedidos.filter(p => p.lojaId === lojaId && p.data === data);
    return [...vivos, ...(dia ? dia.pedidos : [])].sort((a,b) => b.criadoEm - a.criadoEm);
  },

  /* ---------- Números reais do dia ---------- */
  resumo(lojaId = Aparelho.lojaId(), data = hoje()){
    const dia = this.dia(lojaId, data);
    const fechados = dia ? dia.pedidos.filter(p => p.status !== 'cancelado') : [];
    const vivos = this.estado.pedidos.filter(p => p.lojaId === lojaId && p.data === data);
    const faturado = centavos(fechados.reduce((s,p) => s + p.valor, 0));
    const emAberto = centavos(vivos.reduce((s,p) => s + p.valor, 0));
    const tempos = fechados
      .filter(p => p.prontoEm && p.criadoEm)
      .map(p => (p.prontoEm - p.criadoEm) / 60000);
    const loja = this.loja(lojaId);
    return {
      loja, data,
      faturado, emAberto,
      pedidos: fechados.length,
      abertos: vivos.length,
      ticket: fechados.length ? faturado / fechados.length : 0,
      tempo: tempos.length ? tempos.reduce((a,b) => a+b, 0) / tempos.length : null,
      meta: loja && loja.metaDia ? Number(loja.metaDia) : 0,
      cancelados: dia ? dia.pedidos.filter(p => p.status === 'cancelado').length : 0,
      itens: fechados.flatMap(p => p.itens || []),
      porHora: this.porHora(fechados),
      porCanal: this.agrupar(fechados, p => p.canal || 'balcão'),
      porPagamento: this.agrupar(fechados, p => p.pagamento || 'não informado'),
    };
  },

  porHora(pedidos){
    const mapa = {};
    pedidos.forEach(p => {
      const h = new Date(p.criadoEm).getHours();
      mapa[h] = (mapa[h] || 0) + p.valor;
    });
    return Object.entries(mapa)
      .map(([h, v]) => [Number(h), v])
      .sort((a,b) => a[0] - b[0]);
  },

  agrupar(pedidos, chave){
    const mapa = {};
    pedidos.forEach(p => {
      const k = chave(p);
      mapa[k] = mapa[k] || { nome:k, valor:0, qtd:0 };
      mapa[k].valor += p.valor;
      mapa[k].qtd++;
    });
    return Object.values(mapa).sort((a,b) => b.valor - a.valor);
  },

  maisVendidos(lojaId, data){
    const r = this.resumo(lojaId, data);
    const mapa = {};
    r.itens.forEach(i => {
      mapa[i.nome] = mapa[i.nome] || { nome:i.nome, qtd:0, pesoG:0, valor:0 };
      mapa[i.nome].qtd += i.qtd || 1;
      mapa[i.nome].pesoG += i.pesoG || 0;
      mapa[i.nome].valor += i.valor;
    });
    return Object.values(mapa).sort((a,b) => b.valor - a.valor);
  },

  /* Restaura um backup exportado. Grava por cima dos registros com o mesmo código e
     não apaga nada que já exista: importar duas vezes o mesmo arquivo não duplica. */
  async importar(dump){
    if (!dump || typeof dump !== 'object') throw new Error('arquivo sem dados do sistema');
    const config = Array.isArray(dump.config) ? dump.config.find(c => c && c.id === 'app') : dump.config;
    const listas = ['lojas', 'produtos', 'pedidos', 'dias'];
    if (!listas.some(c => Array.isArray(dump[c]))) throw new Error('este arquivo não é um backup do Coltelli');
    let total = 0;
    if (config && config.id === 'app'){ await this.gravar('config', config); total++; }
    for (const c of listas){
      for (const doc of (dump[c] || [])){
        if (!doc || !doc.id) continue;
        await this.gravar(c, doc);
        total++;
      }
    }
    return total;
  },

  /* Últimos dias com movimento, para a tela de gestão */
  historico(lojaId, n = 7){
    return this.estado.dias
      .filter(d => d.lojaId === lojaId)
      .sort((a,b) => b.data.localeCompare(a.data))
      .slice(0, n)
      .map(d => ({
        data: d.data,
        valor: d.pedidos.filter(p => p.status !== 'cancelado').reduce((s,p) => s + p.valor, 0),
        pedidos: d.pedidos.filter(p => p.status !== 'cancelado').length,
      }));
  },
};

/* ---------- Preferências deste aparelho (ficam só nele) ---------- */
const Aparelho = {
  ler(k, padrao){
    try { return localStorage.getItem('cotteli:ap:' + k) || padrao; }
    catch(e){ return padrao; }
  },
  escrever(k, v){
    try { localStorage.setItem('cotteli:ap:' + k, v); } catch(e){ /* sem storage */ }
  },
  lojaId(){
    const salvo = this.ler('loja', '');
    const existe = Dados.estado.lojas.some(l => l.id === salvo);
    return existe ? salvo : (Dados.estado.lojas[0] ? Dados.estado.lojas[0].id : '');
  },
  setLoja(id){ this.escrever('loja', id); },
  operador(){ return this.ler('operador', ''); },
  setOperador(n){ this.escrever('operador', n); },
  tema(){ return this.ler('tema', ''); },
  setTema(t){ this.escrever('tema', t); },
  som(){ return this.ler('som', '1') === '1'; },
  setSom(v){ this.escrever('som', v ? '1' : '0'); },
  autoPeso(){ return this.ler('autopeso', '1') === '1'; },
  setAutoPeso(v){ this.escrever('autopeso', v ? '1' : '0'); },
};

/* ---------- Formatação ---------- */
const brl = (v) => (v || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
const brlCurto = (v) => 'R$ ' + Math.round(v || 0).toLocaleString('pt-BR');
const kgTexto = (g) => (g / 1000).toLocaleString('pt-BR', { minimumFractionDigits:3, maximumFractionDigits:3 });
const dataBR = (iso) => iso.split('-').reverse().slice(0,2).join('/');
const numero = (v, casas = 1) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits:casas, maximumFractionDigits:casas });

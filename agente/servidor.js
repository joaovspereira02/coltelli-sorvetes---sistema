/* Agente Coltelli — roda no computador da loja e faz o que o navegador não faz:
   lê a balança pela serial, cobra na maquininha e publica a página de
   acompanhamento que o QR Code do cupom abre no celular do cliente.

   Também serve o próprio sistema, então caixa, cozinha e totem abrem o mesmo
   endereço na rede da loja e enxergam os mesmos pedidos, sem depender de internet.

   Subir:  node agente/servidor.js
   Config: agente/config.json (copie de config.exemplo.json) */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const { Balanca } = require('./balanca');
const pagamentos  = require('./pagamento');
const { Impressora } = require('./impressora');
const { paginaMesa, paginaRecusada } = require('./paginas');

const VERSAO = '1.1.0';   // o sistema avisa quando a tela é mais nova que o agente rodando
const RAIZ   = path.join(__dirname, '..');
const ARQUIVO_DADOS = path.join(__dirname, 'dados.json');
const PASTA_FOTOS   = path.join(__dirname, 'fotos');
const COLECOES = ['config', 'lojas', 'produtos', 'pedidos', 'dias'];

/* ---------------- Configuração ---------------- */
function lerConfig(){
  const alvo = path.join(__dirname, 'config.json');
  const exemplo = path.join(__dirname, 'config.exemplo.json');
  const arquivo = fs.existsSync(alvo) ? alvo : exemplo;
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); }
  catch(e){
    console.error('config inválido:', e.message);
    return {};
  }
}
const cfg = lerConfig();
const PORTA = Number(cfg.porta) || 8899;

/* ---------------- Dados da loja ---------------- */
const dados = carregarDados();

function carregarDados(){
  try {
    const d = JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8'));
    COLECOES.forEach(c => { if (!Array.isArray(d[c])) d[c] = []; });
    return d;
  } catch(e){
    const vazio = {};
    COLECOES.forEach(c => vazio[c] = []);
    return vazio;
  }
}

let gravando = null;
function salvarDados(){
  clearTimeout(gravando);
  gravando = setTimeout(() => {
    fs.writeFile(ARQUIVO_DADOS, JSON.stringify(dados, null, 2), err => {
      if (err) console.error('não consegui gravar dados.json:', err.message);
    });
  }, 150);
}

/* ---------------- Balança ---------------- */
const balanca = new Balanca(cfg.balanca || {});
balanca.on('peso', p => transmitir('peso', p));
balanca.on('estado', e => transmitir('balanca', e));
balanca.iniciar();

/* ---------------- Impressora ---------------- */
const impressora = new Impressora(cfg.impressora || {});

/* ---------------- Maquininha ---------------- */
const terminal = pagamentos.criar(cfg.pagamento || {});
if (terminal.descobrir) terminal.descobrir().then(() => transmitir('terminal', terminal.estado()));

const cobrancas = new Map();   // id -> { id, estado, valor, ref, em }

function acompanharCobranca(id){
  const tick = async () => {
    const c = cobrancas.get(id);
    if (!c || ['aprovado','cancelado','recusado'].includes(c.estado)) return;
    if (Date.now() - c.em > 5 * 60000){          // a maquininha desiste sozinha
      c.estado = 'cancelado'; c.detalhe = 'tempo esgotado';
      transmitir('cobranca', c);
      return;
    }
    try {
      const r = await terminal.consultar(id);
      if (r.estado !== c.estado){
        c.estado = r.estado;
        c.detalhe = r.detalhe || '';
        transmitir('cobranca', c);
      }
    } catch(e){ /* rede oscilou: tenta de novo no próximo ciclo */ }
    setTimeout(tick, 2000);
  };
  setTimeout(tick, 1500);
}

/* ---------------- Eventos para as telas (SSE) ---------------- */
const ouvintes = new Set();

function transmitir(tipo, dados_){
  const linha = `data: ${JSON.stringify({ tipo, dados: dados_ })}\n\n`;
  ouvintes.forEach(res => { try { res.write(linha); } catch(e){ ouvintes.delete(res); } });
}

/* ---------------- Utilidades HTTP ---------------- */
function cabecalhos(res, extra = {}){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  Object.entries(extra).forEach(([k,v]) => res.setHeader(k, v));
}

function json(res, corpo, status = 200){
  cabecalhos(res, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' });
  res.writeHead(status);
  res.end(JSON.stringify(corpo));
}

function corpoDaRequisicao(req){
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', d => {
      b += d;
      if (b.length > 2e6) reject(new Error('corpo grande demais'));
    });
    req.on('end', () => {
      try { resolve(b ? JSON.parse(b) : {}); }
      catch(e){
        const erro = new Error('corpo não é JSON válido');
        erro.status = 400;
        reject(erro);
      }
    });
  });
}

function corpoBinario(req){
  return new Promise((resolve, reject) => {
    const partes = [];
    let total = 0;
    req.on('data', d => {
      total += d.length;
      if (total > 3e6){ reject(new Error('arquivo grande demais')); req.destroy(); return; }
      partes.push(d);
    });
    req.on('end', () => resolve(Buffer.concat(partes)));
    req.on('error', reject);
  });
}

const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* Dinheiro é sempre múltiplo de centavo: nada de 26,1763 entrando no caixa */
const centavos = (v) => Math.round((Number(v) || 0) * 100) / 100;

function hoje(d = new Date()){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* Mesma regra do sistema: maior número do dia mais um, por loja */
function proximoNumero(lojaId){
  const data = hoje();
  const vivos = dados.pedidos.filter(p => p.lojaId === lojaId && p.data === data);
  const dia = dados.dias.find(d => d.id === `${lojaId}__${data}`);
  const arquivados = dia ? dia.pedidos : [];
  return [...vivos, ...arquivados].reduce((m,p) => Math.max(m, p.numero || 0), 0) + 1;
}

function numeroOcupado(pedido){
  if (!pedido.numero) return true;
  const data = pedido.data || hoje();
  const dia = dados.dias.find(d => d.id === `${pedido.lojaId}__${data}`);
  return [...dados.pedidos.filter(p => p.lojaId === pedido.lojaId && p.data === data), ...(dia ? dia.pedidos : [])]
    .some(p => p.numero === pedido.numero && p.id !== pedido.id);
}

const TIPOS = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg',
  '.svg':'image/svg+xml', '.json':'application/json; charset=utf-8', '.ico':'image/x-icon',
};

/* Só o que o navegador precisa sai daqui. Tudo que está em agente/ — config.json com o
   token da maquininha, dados.json com o histórico, o próprio código — fica fora da rede. */
const PASTAS_PUBLICAS = ['css/', 'js/', 'img/', 'vendor/'];

function publico(caminhoRel){
  if (caminhoRel === 'index.html') return true;
  return PASTAS_PUBLICAS.some(pasta => caminhoRel.startsWith(pasta));
}

function servirArquivo(res, caminhoRel){
  if (!publico(caminhoRel)){ cabecalhos(res); res.writeHead(404); res.end('não encontrado'); return; }
  const destino = path.join(RAIZ, caminhoRel);
  if (!destino.startsWith(RAIZ)){ res.writeHead(403); res.end('não'); return; }
  fs.readFile(destino, (err, buf) => {
    if (err){ res.writeHead(404); res.end('não encontrado'); return; }
    const ext = path.extname(destino);
    // Código e estilo não podem ficar presos no cache do tablet depois de uma
    // atualização; imagem pode, porque o nome do arquivo muda quando ela muda.
    const imagem = ['.png','.jpg','.svg','.ico'].includes(ext);
    cabecalhos(res, {
      'Content-Type': TIPOS[ext] || 'application/octet-stream',
      'Cache-Control': imagem ? 'public, max-age=604800' : 'no-cache',
    });
    res.writeHead(200);
    res.end(buf);
  });
}

/* O index.html do projeto não tem <head>: ele é montado aqui, igual ao que a
   plataforma faz quando o sistema roda publicado. */
function servirSistema(res){
  fs.readFile(path.join(RAIZ, 'index.html'), 'utf8', (err, corpo) => {
    if (err){ res.writeHead(404); res.end('index.html não encontrado'); return; }
    const pagina = `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{color-scheme:light}html,body{margin:0;height:100%}img{max-width:100%}[hidden]{display:none!important}</style>
</head><body>${corpo}</body></html>`;
    cabecalhos(res, { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store' });
    res.writeHead(200);
    res.end(pagina);
  });
}

/* ---------------- Mesas: cada uma tem o próprio código ----------------
   Sem isso, trocar /mesa/1 por /mesa/7 no navegador já bastava para mandar pedido
   em nome da mesa dos outros. O código vai dentro do QR e não é adivinhável. */
function codigoMesa(){
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
}

function docMesas(){
  let doc = dados.config.find(c => c.id === 'mesas');
  if (!doc){
    doc = { id: 'mesas', tokens: {} };
    dados.config.push(doc);
  }
  if (!doc.tokens) doc.tokens = {};
  return doc;
}

function mesasPublicadas({ regerar = false } = {}){
  const loja = dados.lojas[0];
  const total = Number(loja && loja.mesas) || 0;
  const doc = docMesas();
  if (regerar) doc.tokens = {};
  let mudou = regerar;
  const lista = [];
  for (let n = 1; n <= total; n++){
    if (!doc.tokens[n]){ doc.tokens[n] = codigoMesa(); mudou = true; }
    lista.push({ n, token: doc.tokens[n], url: `${baseDaRede()}/mesa/${n}?t=${doc.tokens[n]}` });
  }
  // some com código de mesa que não existe mais
  Object.keys(doc.tokens).forEach(k => {
    if (Number(k) > total){ delete doc.tokens[k]; mudou = true; }
  });
  if (mudou) salvarDados();
  return lista;
}

function mesaValida(n, token){
  const doc = docMesas();
  const esperado = doc.tokens[String(n)];
  return !!esperado && esperado === token;
}

/* Limite simples: uma mesa não manda mais que 4 pedidos por minuto, e um
   aparelho não manda mais que 8. Segura brincadeira sem atrapalhar a loja. */
const batidas = new Map();
function dentroDoLimite(chave, maximo){
  const agora = Date.now();
  const lista = (batidas.get(chave) || []).filter(t => agora - t < 60000);
  if (lista.length >= maximo){ batidas.set(chave, lista); return false; }
  lista.push(agora);
  batidas.set(chave, lista);
  if (batidas.size > 500) batidas.clear();
  return true;
}

/* ---------------- Acompanhamento do pedido ---------------- */
function acharPedido(codigo){
  const vivo = dados.pedidos.find(p => p.codigo === codigo);
  if (vivo) return vivo;
  for (const dia of dados.dias){
    const achado = (dia.pedidos || []).find(p => p.codigo === codigo);
    if (achado) return { ...achado, arquivado:true };
  }
  return null;
}

const PASSOS = [
  { id:'novo',     titulo:'Pedido recebido',   texto:'Seu pedido entrou na fila da produção.' },
  { id:'preparo',  titulo:'Em preparo',        texto:'Estamos montando o seu pedido agora.' },
  { id:'pronto',   titulo:'Pronto para retirar', texto:'Pode vir buscar no balcão de retirada.' },
  { id:'entregue', titulo:'Entregue',          texto:'Bom apetite!' },
];

function paginaAcompanhamento(codigo){
  const p = acharPedido(codigo);
  const loja = p ? (dados.lojas.find(l => l.id === p.lojaId) || {}) : {};
  const atual = p ? Math.max(0, PASSOS.findIndex(x => x.id === (p.status === 'cancelado' ? 'novo' : p.status))) : 0;
  const cancelado = p && p.status === 'cancelado';
  const pronto = p && p.status === 'pronto';

  const itens = p ? (p.itens || []).map(i =>
    `<li><b>${i.pesoG ? (i.pesoG/1000).toFixed(3).replace('.', ',') + ' kg' : i.qtd + '×'}</b> ${escapar(i.nome)}</li>`).join('') : '';

  const passos = PASSOS.map((s, i) => `
    <li class="passo ${i < atual || (i === atual && p && p.status === 'entregue') ? 'feito' : ''} ${i === atual && !cancelado && p && p.status !== 'entregue' ? 'agora' : ''}">
      <span class="bolinha">${i < atual || (p && p.status === 'entregue' && i === atual) ? '✓' : i + 1}</span>
      <span class="txt"><b>${s.titulo}</b><span>${s.texto}</span></span>
    </li>`).join('');

  const progresso = p ? Math.round((atual / (PASSOS.length - 1)) * 100) : 0;

  return `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0F3571">
<title>${pronto ? 'Pronto! ' : ''}Pedido ${p ? p.numero : ''} · Coltelli</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=Instrument+Sans:wght@400;600&display=swap">
<style>
  :root{ --azul:#0F3571; --azul2:#1B4E9B; --claro:#F2F5FA; --fio:#DCE3F0; --txt:#0E1A31; --txt2:#41506E; --ok:#0A7455; --ok2:#DCF2EA;
         --ease:cubic-bezier(.22,1,.36,1); }
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;color:var(--txt);font:16px/1.5 'Instrument Sans',system-ui,sans-serif;
       background:radial-gradient(700px 380px at 50% -80px, rgba(27,78,155,.16), transparent 70%), var(--claro);
       padding:24px 16px calc(24px + env(safe-area-inset-bottom,0px));display:flex;justify-content:center}
  .folha{width:min(100%,460px);display:flex;flex-direction:column;gap:16px}
  .cartao{background:#fff;border:1px solid var(--fio);border-radius:22px;padding:22px;
          box-shadow:0 1px 2px rgba(8,18,40,.05), 0 14px 30px -18px rgba(8,18,40,.25)}
  .marca{display:flex;align-items:center;justify-content:center;gap:10px;font-family:Archivo,sans-serif;font-weight:800;
         letter-spacing:-.03em;color:var(--azul)}
  .marca img{width:34px;height:34px;object-fit:contain;background:#fff;border-radius:10px;padding:3px;box-shadow:0 2px 8px -3px rgba(8,18,40,.3)}
  .senha{text-align:center;position:relative;overflow:hidden}
  .senha span{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--txt2)}
  .senha b{display:block;font-family:Archivo,sans-serif;font-size:5rem;line-height:1;letter-spacing:-.07em;color:var(--azul)}
  .senha.pronto{background:var(--ok);border-color:var(--ok);color:#fff}
  .senha.pronto span{color:rgba(255,255,255,.85)} .senha.pronto b{color:#fff}
  .senha.pronto::after{content:'';position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 0 rgba(255,255,255,.6);
       animation:anel 1.8s var(--ease) infinite}
  @keyframes anel{0%{box-shadow:inset 0 0 0 0 rgba(255,255,255,.5)}100%{box-shadow:inset 0 0 0 26px rgba(255,255,255,0)}}
  .trilho{height:6px;border-radius:3px;background:var(--claro);overflow:hidden;margin:4px 0 14px}
  .trilho i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,var(--azul2),var(--ok));
            width:${progresso}%;transition:width .8s var(--ease)}
  ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
  .passo{display:flex;gap:14px;align-items:flex-start;padding:12px;border-radius:16px;transition:background .3s}
  .passo .bolinha{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;flex:none;
       background:var(--claro);color:var(--txt2);font-weight:700;font-size:.9rem;transition:background .3s,color .3s}
  .passo .txt{display:flex;flex-direction:column}
  .passo .txt span{color:var(--txt2);font-size:.9rem}
  .passo.feito .bolinha{background:var(--ok);color:#fff}
  .passo.agora{background:#E6EDFA}
  .passo.agora .bolinha{background:var(--azul);color:#fff;box-shadow:0 0 0 0 rgba(15,53,113,.4);animation:vivo 1.8s ease-in-out infinite}
  @keyframes vivo{50%{box-shadow:0 0 0 8px rgba(15,53,113,0)}}
  .passo.agora .txt b{color:var(--azul)}
  ul{margin:8px 0 0;padding-left:18px;color:var(--txt2)}
  ul li{margin:4px 0}
  .rodape{text-align:center;color:var(--txt2);font-size:.85rem;display:flex;align-items:center;justify-content:center;gap:8px}
  .rodape i{width:8px;height:8px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 3px var(--ok2)}
  .aviso{background:#FBE4E8;color:#B7263D;border-radius:16px;padding:14px;text-align:center;font-weight:600}
  @media (prefers-reduced-motion: reduce){ *{animation:none!important;transition:none!important} }
</style>
</head><body>
<div class="folha" id="folha">
  <div class="marca"><img src="/img/marca.png" alt="">Coltelli${loja.nome ? ' · ' + escapar(loja.nome) : ''}</div>
  ${p ? `
    <div class="cartao senha ${pronto ? 'pronto' : ''}" id="senha">
      <span>${pronto ? 'Pode retirar · sua senha' : 'Sua senha'}</span><b>${p.numero}</b>
    </div>
    ${cancelado ? '<div class="aviso">Este pedido foi cancelado. Procure o balcão.</div>' : ''}
    <div class="cartao"><div class="trilho"><i></i></div><ol>${passos}</ol></div>
    <div class="cartao">
      <b>O que você pediu</b>
      <ul>${itens}</ul>
    </div>
  ` : '<div class="cartao"><b>Pedido não encontrado</b><p>Confira o código do cupom ou procure o balcão.</p></div>'}
  <p class="rodape"><i></i> A página se atualiza sozinha.</p>
</div>
<script src="/vendor/motion.js"></script>
<script>
  // Pergunta o estado a cada 4 segundos. Quando muda, troca só o conteúdo —
  // sem piscar a página — e avisa: vibra o celular quando fica pronto.
  const codigo = ${JSON.stringify(codigo)};
  let ultimo = ${JSON.stringify(p ? p.status : null)};
  const M = window.Motion && !matchMedia('(prefers-reduced-motion: reduce)').matches ? window.Motion : null;
  if (M) M.animate('#folha > *', { opacity:[0,1], transform:['translateY(12px)','translateY(0)'] },
                   { delay: M.stagger(0.06), duration: 0.45, ease: [0.22,1,0.36,1] });
  setInterval(async () => {
    try{
      const r = await fetch('/api/p/' + encodeURIComponent(codigo), { cache:'no-store' });
      const d = await r.json();
      if (!d || d.status === ultimo) return;
      ultimo = d.status;
      const html = await (await fetch(location.href, { cache:'no-store' })).text();
      const novo = new DOMParser().parseFromString(html, 'text/html');
      document.getElementById('folha').innerHTML = novo.getElementById('folha').innerHTML;
      document.title = novo.title;
      if (M){
        M.animate('.passo.agora', { transform:['scale(.96)','scale(1)'] }, { duration:.5, ease:[0.22,1,0.36,1] });
        M.animate('#senha', { transform:['scale(.94)','scale(1.03)','scale(1)'] }, { duration:.7 });
      }
      if (d.status === 'pronto' && navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }catch(e){}
  }, 4000);
</script>
</body></html>`;
}

function escapar(s){
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
}

/* ---------------- Rotas ---------------- */
const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const rota = url.pathname;

  if (req.method === 'OPTIONS'){ cabecalhos(res); res.writeHead(204); res.end(); return; }

  try {
    /* --- estado do agente --- */
    if (rota === '/api/estado'){
      return json(res, {
        versao: VERSAO,
        balanca: balanca.estado(),
        terminal: terminal.estado(),
        impressora: impressora.estado(),
        mesas: Number(cfg.mesas) || 0,
        base: baseDaRede(),
      });
    }

    /* --- dados da loja --- */
    if (rota === '/api/dados' && req.method === 'GET') return json(res, dados);

    const mDados = rota.match(/^\/api\/dados\/([\w-]+)\/([\w.~:@+-]+)$/);
    if (mDados){
      const [, colecao, id] = mDados;
      if (!COLECOES.includes(colecao)) return json(res, { erro:'coleção desconhecida' }, 400);
      if (req.method === 'PUT'){
        const corpo = await corpoDaRequisicao(req);
        const doc = { ...corpo, id };
        const i = dados[colecao].findIndex(x => x.id === id);
        // Dois caixas fechando no mesmo segundo calculam o mesmo número. Quem chega
        // depois ganha o próximo livre, e o caixa mostra o número que voltou daqui.
        if (colecao === 'pedidos' && i < 0 && numeroOcupado(doc)) doc.numero = proximoNumero(doc.lojaId);
        if (i >= 0) dados[colecao][i] = doc; else dados[colecao].push(doc);
        salvarDados();
        transmitir('dados', { colecao, id });
        return json(res, doc);
      }
      if (req.method === 'DELETE'){
        dados[colecao] = dados[colecao].filter(x => x.id !== id);
        salvarDados();
        transmitir('dados', { colecao, id });
        return json(res, { ok:true });
      }
    }

    /* --- balança --- */
    if (rota === '/api/balanca/tarar' && req.method === 'POST'){
      const corpo = await corpoDaRequisicao(req);
      const t = balanca.tarar(corpo.gramas);
      return json(res, { tara: t });
    }

    /* --- cobrança na maquininha --- */
    if (rota === '/api/cobranca' && req.method === 'POST'){
      const corpo = await corpoDaRequisicao(req);
      try {
        const r = await terminal.cobrar({ valor: Number(corpo.valor), forma: corpo.forma, ref: corpo.ref || Date.now() });
        const c = { ...r, valor: Number(corpo.valor), ref: corpo.ref, em: Date.now() };
        cobrancas.set(c.id, c);
        if (c.estado !== 'manual') acompanharCobranca(c.id);
        transmitir('cobranca', c);
        return json(res, c);
      } catch(e){
        return json(res, { erro: e.message }, 502);
      }
    }

    const mCobranca = rota.match(/^\/api\/cobranca\/(.+)$/);
    if (mCobranca){
      const id = decodeURIComponent(mCobranca[1]);
      if (req.method === 'GET'){
        const c = cobrancas.get(id);
        return c ? json(res, c) : json(res, { erro:'cobrança desconhecida' }, 404);
      }
      if (req.method === 'DELETE'){
        const c = cobrancas.get(id);
        await terminal.cancelar(id);
        if (c){ c.estado = 'cancelado'; transmitir('cobranca', c); }
        return json(res, { id, estado:'cancelado' });
      }
    }

    /* --- acompanhamento do cliente --- */
    const mPagina = rota.match(/^\/p\/([\w-]+)$/);
    if (mPagina){
      cabecalhos(res, { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store' });
      res.writeHead(200);
      return res.end(paginaAcompanhamento(mPagina[1]));
    }
    const mApiPagina = rota.match(/^\/api\/p\/([\w-]+)$/);
    if (mApiPagina){
      const p = acharPedido(mApiPagina[1]);
      return json(res, p ? { numero:p.numero, status:p.status } : { erro:'não encontrado' }, p ? 200 : 404);
    }

    /* --- eventos ao vivo --- */
    if (rota === '/eventos'){
      cabecalhos(res, {
        'Content-Type':'text/event-stream; charset=utf-8',
        'Cache-Control':'no-store',
        'Connection':'keep-alive',
      });
      res.writeHead(200);
      res.write(': conectado\n\n');
      ouvintes.add(res);
      const pulso = setInterval(() => { try { res.write(': pulso\n\n'); } catch(e){} }, 25000);
      req.on('close', () => { clearInterval(pulso); ouvintes.delete(res); });
      return;
    }

    /* --- códigos das mesas (só a tela de gestão usa) --- */
    if (rota === '/api/mesas'){
      const regerar = req.method === 'POST' && url.searchParams.get('regerar') === '1';
      return json(res, { base: baseDaRede(), mesas: mesasPublicadas({ regerar }) });
    }

    /* --- cardápio para a página da mesa --- */
    if (rota === '/api/cardapio'){
      const lojaId = url.searchParams.get('loja') || (dados.lojas[0] ? dados.lojas[0].id : '');
      const produtos = dados.produtos
        .filter(p => p.ativo !== false && !p.porPeso)
        .sort((a,b) => (a.ordem || 0) - (b.ordem || 0))
        .map(p => ({ id:p.id, nome:p.nome, categoria:p.categoria || 'Geral', preco:Number(p.preco) || 0, foto:p.foto || null }));
      return json(res, { loja: dados.lojas.find(l => l.id === lojaId) || dados.lojas[0] || null, produtos });
    }

    /* --- pedido feito na mesa pelo celular do cliente ---
       O preço vem do cardápio do agente, nunca do que o celular mandou. */
    if (rota === '/api/pedido-mesa' && req.method === 'POST'){
      const corpo = await corpoDaRequisicao(req);
      const loja = dados.lojas[0];
      if (!loja) return json(res, { erro:'loja não configurada' }, 409);

      const mesaPedida = String(corpo.mesa || '').slice(0, 8);
      if (!mesaValida(mesaPedida, String(corpo.token || ''))){
        return json(res, { erro:'use o QR Code da sua mesa' }, 403);
      }
      const ip = (req.socket && req.socket.remoteAddress) || 'desconhecido';
      if (!dentroDoLimite('mesa:' + mesaPedida, 4) || !dentroDoLimite('ip:' + ip, 8)){
        return json(res, { erro:'muitos pedidos seguidos; chame o atendente' }, 429);
      }

      const itens = [];
      for (const pedido of (corpo.itens || [])){
        const prod = dados.produtos.find(x => x.id === pedido.produtoId && x.ativo !== false && !x.porPeso);
        if (!prod) continue;
        const qtd = Math.max(1, Math.min(20, Math.floor(Number(pedido.qtd) || 1)));
        itens.push({
          linha: novoId(), produtoId: prod.id, nome: prod.nome, qtd,
          pesoG: 0, obs: String(pedido.obs || '').slice(0, 120),
          valor: centavos(Number(prod.preco) * qtd),
          precoUn: Number(prod.preco), precoKg: null,
          preparo: Number(prod.preparo) || 3,
        });
      }
      if (!itens.length) return json(res, { erro:'nenhum item válido' }, 400);

      const mesa = mesaPedida;
      const novo = {
        id: novoId(),
        numero: proximoNumero(loja.id),
        codigo: novoId().slice(0, 8),
        lojaId: loja.id, data: hoje(),
        canal: 'mesa ' + mesa, cliente: 'Mesa ' + mesa, tipo: 'mesa',
        pagamento: 'A pagar no caixa', pago: false, operador: '',
        itens, valor: centavos(itens.reduce((t,i) => t + i.valor, 0)),
        status: 'novo', criadoEm: Date.now(),
      };
      dados.pedidos.unshift(novo);
      salvarDados();
      transmitir('dados', { colecao:'pedidos', id:novo.id });
      if (impressora.estado().pronta){
        impressora.comanda(novo, loja).catch(e => console.error('impressora:', e.message));
      }
      return json(res, { codigo: novo.codigo, numero: novo.numero });
    }

    const mMesa = rota.match(/^\/mesa\/([\w-]{1,12})$/);
    if (mMesa){
      const n = mMesa[1];
      const token = url.searchParams.get('t') || '';
      cabecalhos(res, { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store' });
      if (!mesaValida(n, token)){
        res.writeHead(403);
        return res.end(paginaRecusada());
      }
      res.writeHead(200);
      return res.end(paginaMesa(n, dados.lojas[0], token));
    }

    /* --- fotos dos produtos --- */
    if (rota === '/api/fotos' && req.method === 'POST'){
      const bin = await corpoBinario(req);
      if (!bin.length) return json(res, { erro:'arquivo vazio' }, 400);
      if (bin.length > 2e6) return json(res, { erro:'imagem grande demais' }, 413);
      fs.mkdirSync(PASTA_FOTOS, { recursive:true });
      const nome = novoId() + '.jpg';
      fs.writeFileSync(path.join(PASTA_FOTOS, nome), bin);
      return json(res, { url: '/fotos/' + nome });
    }
    const mFoto = rota.match(/^\/fotos\/([\w.-]+)$/);
    if (mFoto){
      const destino = path.join(PASTA_FOTOS, mFoto[1]);
      if (!destino.startsWith(PASTA_FOTOS)){ res.writeHead(403); res.end('não'); return; }
      return fs.readFile(destino, (err, buf) => {
        if (err){ res.writeHead(404); res.end('não encontrada'); return; }
        cabecalhos(res, { 'Content-Type':'image/jpeg', 'Cache-Control':'public, max-age=604800' });
        res.writeHead(200);
        res.end(buf);
      });
    }

    /* --- impressão --- */
    if (rota === '/api/imprimir' && req.method === 'POST'){
      const corpo = await corpoDaRequisicao(req);
      const pedido = corpo.pedido;
      if (!pedido) return json(res, { erro:'pedido ausente' }, 400);
      const loja = dados.lojas.find(l => l.id === pedido.lojaId) || dados.lojas[0];
      try {
        if (corpo.tipo === 'comanda') await impressora.comanda(pedido, loja);
        else await impressora.recibo(pedido, loja, pedido.codigo ? `${baseDaRede()}/p/${pedido.codigo}` : null);
        return json(res, { ok:true });
      } catch(e){
        return json(res, { erro: e.message }, 502);
      }
    }

    /* --- o sistema --- */
    if (rota === '/' || rota === '/index.html') return servirSistema(res);
    return servirArquivo(res, rota.replace(/^\/+/, ''));

  } catch(e){
    if (e.status !== 400) console.error(e);
    return json(res, { erro: e.message }, e.status || 500);
  }
});

function enderecosDaRede(){
  const saida = [];
  Object.values(os.networkInterfaces()).forEach(lista => {
    (lista || []).forEach(i => {
      if (i.family === 'IPv4' && !i.internal) saida.push(i.address);
    });
  });
  return saida;
}
function baseDaRede(){
  const ip = enderecosDaRede()[0];
  return ip ? `http://${ip}:${PORTA}` : `http://localhost:${PORTA}`;
}

/* Porta ocupada quase sempre quer dizer "o agente já está de pé".
   Um rastro de pilha não ajuda ninguém no balcão. */
servidor.on('error', (e) => {
  if (e.code === 'EADDRINUSE'){
    console.error(`
  A porta ${PORTA} já está em uso.

  Quase sempre é o próprio agente, já rodando. Então:

    · para usar o sistema, abra   http://localhost:${PORTA}
    · para reiniciar com o código novo:

        pkill -f "agente/servidor.js" && npm run dev

    · para rodar em outra porta, mude "porta" no agente/config.json
`);
  } else if (e.code === 'EACCES'){
    console.error(`\n  Sem permissão para abrir a porta ${PORTA}. Escolha uma acima de 1024 no agente/config.json.\n`);
  } else {
    console.error('\n  Não consegui subir o agente:', e.message, '\n');
  }
  process.exit(1);
});

servidor.listen(PORTA, () => {
  console.log(`\n  Agente Coltelli ${VERSAO}`);
  console.log(`  Sistema:        http://localhost:${PORTA}`);
  enderecosDaRede().forEach(ip => console.log(`  Na rede da loja: http://${ip}:${PORTA}`));
  console.log(`  Balança:        ${balanca.estado().conectada ? 'lendo' : balanca.estado().motivo}`);
  console.log(`  Maquininha:     ${terminal.estado().provedor} · ${terminal.estado().detalhe}`);
  console.log(`  Impressora:     ${impressora.estado().pronta ? impressora.estado().destino : 'nenhuma'}`);
  if (Number(cfg.mesas) > 0) console.log(`  Mesas:          ${cfg.mesas} (QR em ${baseDaRede()}/mesa/1)`);
  console.log('');
});

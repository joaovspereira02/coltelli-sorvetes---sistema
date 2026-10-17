/* Agente Coltelli — cardápio da mesa.

   O cliente aponta a câmera para o QR colado na mesa, escolhe no próprio celular
   e o pedido cai direto na produção, com o número da mesa.

   A página manda só o id do produto e a quantidade: quem calcula o preço é o
   agente, com o cardápio da loja. Preço nunca vem do celular do cliente. */

function escapar(s){
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
}

function paginaMesa(mesa, loja, token){
  return `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Mesa ${escapar(mesa)} · Coltelli</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=Instrument+Sans:wght@400;500;600&display=swap">
<style>
  :root{ --azul:#0F3571; --azul2:#17478F; --claro:#F2F5FA; --sup:#fff; --fio:#DCE3F0;
         --txt:#0E1A31; --txt2:#41506E; --txt3:#64718D; --ok:#0A7455;
         --grad:linear-gradient(180deg,#1B4E9B,#0F3571); --ease:cubic-bezier(.22,1,.36,1);
         --sombra:0 1px 2px rgba(8,18,40,.05), 0 12px 26px -16px rgba(8,18,40,.28); }
  *{box-sizing:border-box}
  body{margin:0;background:radial-gradient(700px 360px at 50% -120px, rgba(27,78,155,.12), transparent 70%), var(--claro);color:var(--txt);
       font:16px/1.45 'Instrument Sans',system-ui,sans-serif;
       padding-bottom:calc(96px + env(safe-area-inset-bottom,0px))}
  header{background:rgba(255,255,255,.82);backdrop-filter:blur(14px) saturate(1.5);-webkit-backdrop-filter:blur(14px) saturate(1.5);
         border-bottom:1px solid var(--fio);padding:14px 16px;
         position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:12px}
  header img{width:40px;height:40px;object-fit:contain;background:#fff;border-radius:12px;padding:4px;box-shadow:var(--sombra)}
  header b{font-family:Archivo,sans-serif;font-size:1.05rem;letter-spacing:-.03em;display:block}
  header span{font-size:.8rem;color:var(--txt3)}
  .mesa{margin-left:auto;background:#E6EDFA;color:var(--azul);border-radius:999px;
        padding:6px 14px;font-weight:700;font-size:.85rem}
  .abas{display:flex;gap:8px;padding:14px 16px;overflow-x:auto;scrollbar-width:none}
  .abas::-webkit-scrollbar{display:none}
  .aba{flex:none;padding:10px 16px;border-radius:999px;border:1.5px solid #BECCE3;
       background:var(--sup);color:var(--txt2);font-weight:600;font-size:.9rem;cursor:pointer;transition:all .2s var(--ease)}
  .aba[aria-pressed="true"]{background:var(--grad);border-color:transparent;color:#fff;box-shadow:0 6px 16px -8px rgba(15,53,113,.7)}
  .grade{display:grid;gap:12px;padding:0 16px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
  .item{position:relative;background:var(--sup);border:1px solid var(--fio);border-radius:20px;overflow:hidden;
        display:flex;flex-direction:column;text-align:left;padding:0;cursor:pointer;color:inherit;font:inherit;
        box-shadow:var(--sombra);transition:transform .15s var(--ease)}
  .item:active{transform:scale(.97)}
  .item::after{content:'+';position:absolute;right:10px;bottom:10px;width:32px;height:32px;border-radius:50%;
        display:grid;place-items:center;background:var(--grad);color:#fff;font-weight:700;font-size:1.2rem;
        box-shadow:0 6px 14px -6px rgba(15,53,113,.7)}
  .foto{aspect-ratio:4/3;width:100%;object-fit:cover;display:block;background:#E6EDFA}
  .sem-foto{aspect-ratio:16/9;display:grid;place-items:center;color:var(--azul);
            background:radial-gradient(circle at 30% 20%, #F4F7FD, #DCE6F7);
            font-family:Archivo,sans-serif;font-weight:800;font-size:1.5rem;letter-spacing:-.04em}
  .corpo{padding:12px;display:flex;flex-direction:column;gap:6px;flex:1}
  .nome{font-weight:600;line-height:1.25}
  .preco{margin-top:auto;font-family:ui-monospace,monospace;font-size:1.05rem;font-weight:600}
  .qtd{position:absolute;top:10px;left:10px;background:var(--grad);color:#fff;border-radius:999px;
       padding:3px 10px;font-size:.78rem;font-weight:700;box-shadow:0 4px 10px -4px rgba(15,53,113,.6)}
  .preco{padding-right:40px}
  .barra{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));
         background:rgba(255,255,255,.9);backdrop-filter:blur(16px) saturate(1.5);-webkit-backdrop-filter:blur(16px) saturate(1.5);
         border:1px solid var(--fio);border-radius:22px;box-shadow:0 20px 44px -18px rgba(8,18,40,.45);
         padding:12px 12px 12px 18px;display:flex;align-items:center;gap:14px;z-index:6}
  .total{font-family:Archivo,sans-serif;font-size:1.5rem;font-weight:800;letter-spacing:-.04em}
  .total small{display:block;font-family:inherit;font-size:.75rem;font-weight:400;color:var(--txt3);letter-spacing:0}
  button.enviar{margin-left:auto;background:var(--grad);color:#fff;border:0;border-radius:16px;
                padding:16px 24px;font-size:1.05rem;font-weight:700;cursor:pointer;
                box-shadow:inset 0 1px 0 rgba(255,255,255,.18), 0 8px 18px -8px rgba(15,53,113,.75)}
  button.enviar:disabled{opacity:.4;box-shadow:none}
  dialog{border:0;border-radius:26px;padding:0;width:min(92vw,420px);box-shadow:0 30px 70px -30px rgba(8,18,40,.5)}
  dialog::backdrop{background:rgba(8,18,40,.5);backdrop-filter:blur(4px)}
  .toast{position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:20;max-width:calc(100vw - 32px);
         background:#B7263D;color:#fff;font-weight:600;padding:12px 18px;border-radius:14px;
         box-shadow:0 16px 36px -16px rgba(8,18,40,.6)}
  @media (prefers-reduced-motion: reduce){ *{transition:none!important} }
  .dlg{padding:22px;display:flex;flex-direction:column;gap:14px}
  .dlg h2{margin:0;font-family:Archivo,sans-serif;letter-spacing:-.03em}
  .contador{display:flex;align-items:center;justify-content:center;gap:20px}
  .contador button{width:54px;height:54px;border-radius:14px;border:1.5px solid #BECCE3;
                   background:var(--sup);font-size:1.6rem;cursor:pointer}
  .contador span{font-family:ui-monospace,monospace;font-size:1.8rem;font-weight:700;min-width:50px;text-align:center}
  textarea{border:1.5px solid #BECCE3;border-radius:14px;padding:12px;font:inherit;resize:vertical}
  .dlg .linha{display:flex;gap:10px}
  .dlg .linha button{flex:1;padding:14px;border-radius:14px;border:1.5px solid #BECCE3;background:var(--sup);
                     font-weight:600;cursor:pointer;font-size:1rem}
  .dlg .linha button.ok{background:var(--azul);border-color:var(--azul);color:#fff}
  .aviso{padding:30px 16px;text-align:center;color:var(--txt2)}
</style>
</head><body>

<header>
  <img src="/img/marca.png" alt="">
  <span><b>Coltelli</b><span>${escapar(loja && loja.nome ? loja.nome : 'Sorvetes')}</span></span>
  <span class="mesa">Mesa ${escapar(mesa)}</span>
</header>

<div id="conteudo"><p class="aviso">Carregando o cardápio…</p></div>

<div class="barra" hidden id="barra">
  <span class="total" id="total">R$ 0,00<small id="resumo">nenhum item</small></span>
  <button class="enviar" id="enviar" disabled>Enviar pedido</button>
</div>

<dialog id="dlg"><div class="dlg">
  <h2 id="dlg-nome"></h2>
  <div class="contador">
    <button id="menos" aria-label="Menos">−</button><span id="n">1</span><button id="mais" aria-label="Mais">+</button>
  </div>
  <textarea id="obs" rows="2" placeholder="Alguma observação? Ex.: sem cobertura"></textarea>
  <div class="linha">
    <button id="cancelar">Voltar</button>
    <button id="confirmar" class="ok">Adicionar</button>
  </div>
</div></dialog>

<script src="/vendor/motion.js"></script>
<script>
const M = window.Motion && !matchMedia('(prefers-reduced-motion: reduce)').matches ? window.Motion : null;
const MESA = ${JSON.stringify(String(mesa))};
const TOKEN = ${JSON.stringify(String(token || ''))};
let cardapio = [], categoria = null, carrinho = [], escolhido = null;

const brl = v => 'R$ ' + Number(v||0).toFixed(2).replace('.', ',');

async function carregar(){
  try{
    const r = await fetch('/api/cardapio', { cache:'no-store' });
    const d = await r.json();
    cardapio = d.produtos || [];
  }catch(e){ cardapio = []; }
  if (!cardapio.length){
    document.getElementById('conteudo').innerHTML =
      '<p class="aviso">O cardápio ainda não está disponível. Chame o atendente.</p>';
    return;
  }
  categoria = cardapio[0].categoria;
  desenhar({ cascata: true });
}

function desenhar({ cascata = false } = {}){
  const cats = [...new Set(cardapio.map(p => p.categoria))];
  const lista = cardapio.filter(p => p.categoria === categoria);
  document.getElementById('conteudo').innerHTML =
    '<div class="abas">' + cats.map(c =>
      '<button class="aba" data-cat="' + enc(c) + '" aria-pressed="' + (c === categoria) + '">' + enc(c) + '</button>').join('') +
    '</div><div class="grade">' + lista.map(cartao).join('') + '</div>';

  document.querySelectorAll('.aba').forEach(b => b.onclick = () => { categoria = b.dataset.cat; desenhar({ cascata: true }); });
  document.querySelectorAll('.item').forEach(b => b.onclick = () => abrir(b.dataset.id));
  pintarBarra();
  if (M && cascata) M.animate('.item', { opacity:[0,1], transform:['translateY(14px) scale(.98)','translateY(0) scale(1)'] },
                              { delay: M.stagger(0.035), duration: 0.4, ease: [0.22,1,0.36,1] });
}

function cartao(p){
  const noCarrinho = carrinho.filter(i => i.produtoId === p.id).reduce((s,i) => s + i.qtd, 0);
  const foto = p.foto
    ? '<img class="foto" src="' + enc(p.foto) + '" alt="" loading="lazy">'
    : '<span class="sem-foto">' + enc(p.nome.slice(0,1).toUpperCase()) + '</span>';
  return '<button class="item" data-id="' + enc(p.id) + '">' + foto +
    '<span class="corpo">' + (noCarrinho ? '<span class="qtd">' + noCarrinho + ' no pedido</span>' : '') +
    '<span class="nome">' + enc(p.nome) + '</span>' +
    '<span class="preco">' + brl(p.preco) + '</span></span></button>';
}

function abrir(id){
  escolhido = cardapio.find(p => p.id === id);
  if (!escolhido) return;
  document.getElementById('dlg-nome').textContent = escolhido.nome;
  document.getElementById('n').textContent = '1';
  document.getElementById('obs').value = '';
  document.getElementById('dlg').showModal();
  if (M) M.animate('.dlg', { opacity:[0,1], transform:['translateY(18px) scale(.97)','translateY(0) scale(1)'] },
                   { type:'spring', stiffness:480, damping:34 });
}

function avisar(texto){
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'alert'); t.textContent = texto;
  document.body.appendChild(t);
  if (M) M.animate(t, { opacity:[0,1], transform:['translate(-50%,-12px)','translate(-50%,0)'] }, { duration:.3 });
  setTimeout(() => t.remove(), 3600);
}

document.getElementById('mais').onclick = () => {
  const n = document.getElementById('n');
  n.textContent = Math.min(20, Number(n.textContent) + 1);
};
document.getElementById('menos').onclick = () => {
  const n = document.getElementById('n');
  n.textContent = Math.max(1, Number(n.textContent) - 1);
};
document.getElementById('cancelar').onclick = () => document.getElementById('dlg').close();
document.getElementById('confirmar').onclick = () => {
  carrinho.push({
    produtoId: escolhido.id, nome: escolhido.nome, preco: escolhido.preco,
    qtd: Number(document.getElementById('n').textContent),
    obs: document.getElementById('obs').value.trim(),
  });
  document.getElementById('dlg').close();
  desenhar();
  if (M) M.animate('#total', { transform:['scale(1)','scale(1.12)','scale(1)'] }, { duration:.45 });
};

function pintarBarra(){
  const n = carrinho.reduce((s,i) => s + i.qtd, 0);
  const t = carrinho.reduce((s,i) => s + i.qtd * i.preco, 0);
  const barra = document.getElementById('barra');
  if (barra.hidden && M) M.animate(barra, { transform:['translateY(120%)','translateY(0)'] }, { type:'spring', stiffness:380, damping:34 });
  barra.hidden = false;
  document.getElementById('total').firstChild.nodeValue = brl(t);
  document.getElementById('resumo').textContent = n ? n + (n === 1 ? ' item' : ' itens') : 'nenhum item';
  document.getElementById('enviar').disabled = !n;
}

document.getElementById('enviar').onclick = async () => {
  const b = document.getElementById('enviar');
  b.disabled = true; b.textContent = 'Enviando…';
  try{
    const r = await fetch('/api/pedido-mesa', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ mesa: MESA, token: TOKEN, itens: carrinho.map(i => ({ produtoId:i.produtoId, qtd:i.qtd, obs:i.obs })) }),
    });
    const d = await r.json();
    if (!r.ok || !d.codigo) throw new Error(d.erro || 'falhou');
    location.href = '/p/' + d.codigo;
  }catch(e){
    b.disabled = false; b.textContent = 'Enviar pedido';
    avisar(e.message && e.message !== 'falhou' ? e.message : 'Não consegui enviar. Chame o atendente.');
  }
};

function enc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
carregar();
</script>
</body></html>`;
}

/* Mesa sem código válido: não existe para o sistema */
function paginaRecusada(){
  return `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Coltelli</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@700;800&family=Instrument+Sans:wght@400;600&display=swap">
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F2F5FA;color:#0E1A31;
       font:16px/1.5 'Instrument Sans',system-ui,sans-serif;padding:24px;text-align:center}
  .caixa{background:#fff;border:1px solid #DCE3F0;border-radius:20px;padding:32px;max-width:380px}
  h1{font-family:Archivo,sans-serif;font-size:1.4rem;letter-spacing:-.03em;margin:0 0 10px;color:#0F3571}
  p{color:#41506E;margin:0}
</style>
</head><body>
  <div class="caixa">
    <h1>Aponte a câmera para o QR da sua mesa</h1>
    <p>Este endereço não vale sem o código impresso no cartão da mesa. Se o QR não estiver legível, é só chamar o atendente.</p>
  </div>
</body></html>`;
}

module.exports = { paginaMesa, paginaRecusada };

/* Coltelli — QR das mesas.

   Cada mesa tem um código próprio dentro do QR. Sem ele o endereço não abre, então
   não adianta trocar o número da mesa na barra do navegador. */

let mesasPublicadas = null;      // [{ n, token, url }]
let buscandoMesas = false;
let erroMesas = null;
let mesasPedidasPara = null;     // quantidade de mesas da última busca

function carregarMesas(total){
  if (buscandoMesas || !Agente.ligado) return;
  buscandoMesas = true;
  erroMesas = null;
  mesasPedidasPara = total;
  Agente.api('/api/mesas')
    .then(r => { mesasPublicadas = r.mesas || []; })
    .catch(e => { erroMesas = e.message || 'sem resposta'; })
    .finally(() => { buscandoMesas = false; if (App.tela === 'mesas') App.render(); });
}

function telaMesas(){
  const loja = Dados.loja();
  const total = Number(loja && loja.mesas) || 0;

  if (!Agente.ligado){
    return `<div class="tela-centro">${vazio('qr', 'O QR das mesas precisa do agente',
      'O endereço do cardápio da mesa é publicado pelo agente, na rede da sorveteria. Ligue o agente no computador do balcão e abra o sistema por ele.',
      `<button class="btn btn-ghost" data-act="ir" data-tela="ajustes">${ic('ajustes')} Ver em Ajustes</button>`)}</div>`;
  }

  if (!total){
    return `<div class="tela-centro">${vazio('qr', 'Nenhuma mesa configurada',
      'Diga quantas mesas a loja tem e o sistema gera um QR para cada uma, pronto para imprimir e colar.',
      `<button class="btn btn-primario btn-grande" data-act="definir-mesas">${ic('mais')} Definir as mesas</button>`)}</div>`;
  }

  if (erroMesas){
    return `<div class="tela-centro">${vazio('alerta', 'Não consegui gerar os códigos das mesas',
      `O agente não respondeu (${erroMesas}). Confira se ele está ligado no computador do balcão.`,
      `<button class="btn btn-primario" data-act="recarregar-mesas">Tentar de novo</button>`)}</div>`;
  }

  // busca de novo quando a quantidade muda; o agente é quem diz quais códigos valem
  if (!mesasPublicadas || mesasPedidasPara !== total){
    carregarMesas(total);
    return `<div class="tela-centro"><div class="carregando">${ic('qr','lg')}<span>Gerando os códigos das mesas…</span></div></div>`;
  }

  const cartoes = mesasPublicadas.map(m => `
    <div class="mesa-cartao">
      <span class="mesa-marca"><img src="img/marca.png" alt=""></span>
      <span class="mesa-n">Mesa ${m.n}</span>
      ${qrSvg(m.url, 164)}
      <span class="mesa-txt">Aponte a câmera<br>e peça pelo celular</span>
    </div>`).join('');

  return `
  <div class="pagina rolagem">
    <header class="pagina-topo nao-imprime">
      <div>
        <h2>${total} ${total === 1 ? 'mesa' : 'mesas'}</h2>
        <p class="pagina-sub">Imprima, recorte e cole na mesa. O pedido cai direto na produção.</p>
      </div>
      <div class="pagina-acoes">
        <button class="btn btn-ghost" data-act="definir-mesas">${ic('ajustes')} Mudar quantidade</button>
        <button class="btn btn-ghost" data-act="regerar-mesas">${ic('qr')} Gerar novos códigos</button>
        <button class="btn btn-primario" data-act="imprimir-mesas">${ic('impressora')} Imprimir folha</button>
      </div>
    </header>

    <div class="mesas-grade">${cartoes}</div>

    <div class="cartao cartao-pad nao-imprime">
      <span class="rotulo">Como isso fica seguro</span>
      <p class="cartao-txt">Cada QR carrega um código secreto da mesa. Quem digitar o endereço na mão,
      trocando o número, não consegue pedir — o sistema recusa. O cardápio também só abre para quem
      está na Wi-Fi da sorveteria: o agente não fica exposto na internet.</p>
      <p class="cartao-txt">Se um cartão for fotografado e virar brincadeira, use <b>Gerar novos códigos</b>:
      os QR antigos param de funcionar na hora e você reimprime a folha. Cada mesa também tem limite de
      quatro pedidos por minuto.</p>
      <p class="nota">${ic('info','sm')} O preço cobrado é sempre o do cardápio no agente — o celular do cliente nunca manda valor.</p>
    </div>
  </div>`;
}

const acoesMesas = {
  'recarregar-mesas': () => { erroMesas = null; mesasPublicadas = null; App.render(); },
  'definir-mesas': () => {
    const loja = Dados.loja();
    Teclado.abrir({
      titulo: 'Quantas mesas?',
      sub: loja ? loja.nome : '',
      unidade: 'mesas', decimais: 0,
      valor: loja && loja.mesas ? String(loja.mesas) : '',
      dica: 'O sistema gera um QR para cada mesa, numerado.',
      async aoConfirmar(n){
        const q = Math.max(0, Math.min(99, Math.round(n)));
        await Dados.gravar('lojas', { ...loja, mesas: q });
        mesasPublicadas = null;
        Aviso.mostrar(q ? `${q} mesas` : 'Mesas removidas');
      },
    });
  },

  'regerar-mesas': () => Confirmar.pedir({
    titulo: 'Gerar novos códigos?',
    texto: 'Os QR já colados nas mesas param de funcionar e você precisa reimprimir a folha.',
    botao: 'Gerar novos', perigo: true,
    async aoConfirmar(){
      try {
        const r = await Agente.api('/api/mesas?regerar=1', { method: 'POST' });
        mesasPublicadas = r.mesas || [];
        App.render();
        Aviso.mostrar('Códigos novos. Reimprima a folha.');
      } catch(e){
        Aviso.erro('Não consegui falar com o agente');
      }
    },
  }),

  'imprimir-mesas': () => {
    // Só funciona no sistema servido pelo agente; no link publicado o navegador bloqueia.
    try { window.print(); }
    catch(e){ Aviso.erro('A impressão abre pelo sistema do agente da loja'); }
  },
};

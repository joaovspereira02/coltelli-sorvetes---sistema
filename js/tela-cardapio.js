/* Coltelli — Cardápio: os produtos e os preços da loja, cadastrados por quem vende */

function telaCardapio(){
  const produtos = Dados.produtos();
  const cats = Dados.categorias();

  if (!produtos.length){
    return `<div class="tela-centro">${vazio('cardapio', 'Nenhum produto cadastrado',
      'Cadastre o que a sorveteria vende, com os preços de hoje. Nada aqui vem preenchido.',
      `<div class="vazio-acoes">
         <button class="btn btn-primario btn-grande" data-act="novo-produto">${ic('mais')} Adicionar produto</button>
         <button class="btn btn-ghost" data-act="importar-produtos">${ic('lista')} Colar lista pronta</button>
       </div>`)}</div>`;
  }

  return `
  <div class="pagina rolagem">
    <header class="pagina-topo">
      <div>
        <h2>${produtos.length} ${produtos.length === 1 ? 'produto' : 'produtos'}</h2>
        <p class="pagina-sub">Preço alterado aqui vale na hora no balcão e no totem.</p>
      </div>
      <div class="pagina-acoes">
        <button class="btn btn-ghost" data-act="importar-produtos">${ic('lista')} Colar lista</button>
        <button class="btn btn-primario" data-act="novo-produto">${ic('mais')} Novo produto</button>
      </div>
    </header>

    ${cats.map(c => `
      <section class="grupo">
        <h3 class="grupo-tit">${esc(c)}</h3>
        <div class="cartao lista">
          ${produtos.filter(p => p.categoria === c).map(p => `
            <button class="li" data-act="editar-produto" data-id="${p.id}">
              ${foto(p, 'foto-li')}
              <span class="li-txt">
                <span class="li-nome">${esc(p.nome)}${p.ativo === false ? ' <span class="selo selo-neutro">pausado</span>' : ''}</span>
                <span class="li-sub">${p.porPeso ? 'vendido por peso' : 'por unidade'} · ${Number(p.preparo) || 3} min de preparo</span>
              </span>
              <span class="li-v">${p.porPeso ? brl(p.precoKg) + '<small>/kg</small>' : brl(p.preco)}</span>
              ${ic('lapis','sm')}
            </button>`).join('')}
        </div>
      </section>`).join('')}
  </div>`;
}

/* ---------------- Formulário ---------------- */

let editandoProduto = null;
let fotoEditando = null;

function abrirProduto(id){
  const p = id ? Dados.produto(id) : null;
  editandoProduto = p ? p.id : null;
  fotoEditando = p ? (p.foto || null) : null;
  const porPeso = p ? !!p.porPeso : false;
  const cats = Dados.categorias();

  Modal.abrir(`
    ${Modal.cabecalho('cardapio', p ? 'Editar produto' : 'Novo produto', p ? p.nome : 'Os dados são seus — nada vem preenchido')}
    <div class="campo">
      <span class="campo-rot">Foto</span>
      <div class="foto-campo" id="foto-campo">${htmlFotoCampo()}</div>
      <span class="campo-dica">Aparece no balcão, no totem e no cardápio da mesa. A imagem é reduzida antes de ser guardada.</span>
    </div>
    ${campo({ id:'p-nome', rotulo:'Nome', valor:p ? p.nome : '', obrigatorio:true })}
    <label class="campo" for="p-cat">
      <span class="campo-rot">Categoria <b>*</b></span>
      <span class="campo-caixa">
        <input id="p-cat" list="p-cats" value="${esc(p ? p.categoria : '')}" autocomplete="off" placeholder="Ex.: Picolés">
      </span>
      <datalist id="p-cats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <span class="campo-dica">Agrupa os produtos no balcão. Digite uma nova ou escolha uma já usada.</span>
    </label>

    <div class="campo">
      <span class="campo-rot">Como é vendido</span>
      <div class="segmento">
        <button class="seg" data-act="tipo-venda" data-v="un" aria-pressed="${!porPeso}">Por unidade</button>
        <button class="seg" data-act="tipo-venda" data-v="kg" aria-pressed="${porPeso}">Por peso</button>
      </div>
    </div>

    <div id="bloco-preco">${blocoPreco(porPeso, p)}</div>

    ${campo({ id:'p-prep', rotulo:'Tempo de preparo', valor:p ? (p.preparo || 3) : 3, tipo:'number', sufixo:'min',
              dica:'Usado para o cronômetro da produção ficar amarelo e vermelho' })}

    <label class="troca">
      <input type="checkbox" id="p-ativo" ${!p || p.ativo !== false ? 'checked' : ''}>
      <span>Disponível para venda</span>
    </label>

    <div class="modal-acoes">
      ${p ? `<button class="btn btn-perigo-ghost" data-act="apagar-produto">${ic('lixo')} Excluir</button>` : ''}
      <button class="btn btn-ghost" data-act="modal-fechar">Cancelar</button>
      <button class="btn btn-primario" data-act="salvar-produto">Salvar</button>
    </div>`);
}

function htmlFotoCampo(){
  return fotoEditando
    ? `<img class="foto foto-previa" src="${esc(fotoEditando)}" alt="">
       <div class="foto-acoes">
         <button class="btn btn-ghost" data-act="trocar-foto">${ic('camera','sm')} Trocar</button>
         <button class="btn btn-perigo-ghost" data-act="tirar-foto">${ic('lixo','sm')} Remover</button>
       </div>`
    : `<button class="foto-vazia" data-act="trocar-foto">
         ${ic('camera','lg')}<span>Adicionar foto</span>
       </button>`;
}

function blocoPreco(porPeso, p){
  return porPeso
    ? campo({ id:'p-preco', rotulo:'Preço por quilo', valor:p && p.precoKg ? p.precoKg : '', tipo:'number', sufixo:'R$ / kg', obrigatorio:true })
    : campo({ id:'p-preco', rotulo:'Preço', valor:p && p.preco ? p.preco : '', tipo:'number', sufixo:'R$', obrigatorio:true });
}

async function salvarProduto(){
  const nome = document.getElementById('p-nome').value.trim();
  const categoria = document.getElementById('p-cat').value.trim();
  const preco = parseFloat(String(document.getElementById('p-preco').value).replace(',', '.'));
  const preparo = parseInt(document.getElementById('p-prep').value, 10) || 3;
  const ativo = document.getElementById('p-ativo').checked;
  const porPeso = document.querySelector('[data-act="tipo-venda"][data-v="kg"]').getAttribute('aria-pressed') === 'true';

  if (!nome){ Aviso.erro('Dê um nome ao produto'); return; }
  if (!categoria){ Aviso.erro('Informe a categoria'); return; }
  if (!preco || preco <= 0){ Aviso.erro('Informe um preço maior que zero'); return; }

  const antigo = editandoProduto ? Dados.produto(editandoProduto) : null;
  await Dados.gravar('produtos', {
    ...(antigo || {}),
    id: editandoProduto || undefined,
    nome, categoria, porPeso, preparo, ativo,
    foto: fotoEditando || null,
    preco: porPeso ? null : preco,
    precoKg: porPeso ? preco : null,
    ordem: antigo ? antigo.ordem : Dados.estado.produtos.length,
  });
  Modal.fechar();
  Aviso.mostrar(antigo ? 'Produto atualizado' : 'Produto cadastrado');
}

/* ---------------- Importar lista ---------------- */

function abrirImportacao(){
  Modal.abrir(`
    ${Modal.cabecalho('lista', 'Colar lista de produtos', 'Um produto por linha')}
    <p class="nota">${ic('info','sm')} Formato: <b>nome ; preço ; categoria</b>. Para venda por peso, termine a linha com <b>; kg</b>.</p>
    <label class="campo" for="imp">
      <span class="campo-rot">Cole aqui</span>
      <textarea id="imp" rows="8" class="area" data-foco placeholder="Casquinha 2 bolas ; 13,90 ; Casquinhas&#10;Sorvete a granel ; 54,90 ; Por peso ; kg"></textarea>
    </label>
    <div class="modal-acoes">
      <button class="btn btn-ghost" data-act="modal-fechar">Cancelar</button>
      <button class="btn btn-primario" data-act="confirmar-import">Importar</button>
    </div>`);
}

async function importarProdutos(){
  const texto = document.getElementById('imp').value;
  const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);
  let contados = 0;
  for (const linha of linhas){
    const partes = linha.split(/[;\t]/).map(x => x.trim());
    const nome = partes[0];
    const preco = parseFloat(String(partes[1] || '').replace(/[^\d,.-]/g, '').replace(',', '.'));
    const categoria = partes[2] || 'Geral';
    const porPeso = /^kg$/i.test(partes[3] || '');
    if (!nome || !preco || preco <= 0) continue;
    await Dados.gravar('produtos', {
      nome, categoria, porPeso, preparo: 3, ativo: true,
      preco: porPeso ? null : preco,
      precoKg: porPeso ? preco : null,
      ordem: Dados.estado.produtos.length + contados,
    });
    contados++;
  }
  Modal.fechar();
  if (contados) Aviso.mostrar(`${contados} ${contados === 1 ? 'produto importado' : 'produtos importados'}`);
  else Aviso.erro('Nenhuma linha reconhecida. Confira o formato.');
}

const acoesCardapio = {
  'trocar-foto': async () => {
    const arquivo = await Fotos.escolher();
    if (!arquivo) return;
    const alvo = document.getElementById('foto-campo');
    if (alvo) alvo.innerHTML = `<span class="foto-carregando">${ic('camera')} preparando a foto…</span>`;
    try {
      fotoEditando = await Fotos.guardar(arquivo);
    } catch(e){
      Aviso.erro(e.message);
    }
    if (alvo) alvo.innerHTML = htmlFotoCampo();
  },
  'tirar-foto': () => {
    fotoEditando = null;
    const alvo = document.getElementById('foto-campo');
    if (alvo) alvo.innerHTML = htmlFotoCampo();
  },
  'novo-produto': () => abrirProduto(null),
  'editar-produto': (d) => abrirProduto(d.id),
  'tipo-venda': (d) => {
    document.querySelectorAll('[data-act="tipo-venda"]').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.v === d.v)));
    const atual = document.getElementById('p-preco');
    const valor = atual ? atual.value : '';
    document.getElementById('bloco-preco').innerHTML = blocoPreco(d.v === 'kg', null);
    document.getElementById('p-preco').value = valor;
  },
  'salvar-produto': () => salvarProduto(),
  'apagar-produto': () => {
    const p = Dados.produto(editandoProduto);
    if (!p) return;
    Confirmar.pedir({
      titulo:`Excluir ${p.nome}?`, texto:'Os pedidos já registrados não mudam.',
      botao:'Excluir', perigo:true,
      async aoConfirmar(){ await Dados.apagar('produtos', p.id); Aviso.mostrar('Produto excluído'); },
    });
  },
  'importar-produtos': () => abrirImportacao(),
  'confirmar-import': () => importarProdutos(),
};

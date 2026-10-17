/* Coltelli — Ajustes: lojas, este aparelho, balança e o estado real das integrações */

/* ---------------- Primeiro uso ---------------- */

function telaSetup(){
  return `
  <div class="setup">
    <div class="setup-caixa">
      ${marcaCompleta('mini')}
      <h1>Vamos configurar a sua sorveteria</h1>
      <p class="setup-sub">Três campos e o sistema já está pronto para receber pedidos de verdade.
      Nada vem preenchido: os dados são os seus.</p>

      ${campo({ id:'s-loja', rotulo:'Nome da loja', obrigatorio:true, foco:true, dica:'Aparece no cabeçalho e nos relatórios' })}
      ${campo({ id:'s-end', rotulo:'Endereço', dica:'Opcional' })}
      <div class="dois-campos">
        ${campo({ id:'s-hor', rotulo:'Horário', dica:'Opcional. Ex.: 12h às 23h' })}
        ${campo({ id:'s-meta', rotulo:'Meta por dia', tipo:'number', sufixo:'R$', dica:'Opcional. Faturamento que a loja quer atingir' })}
      </div>

      <button class="btn btn-primario btn-grande btn-cheio" data-act="salvar-setup">
        ${ic('seta')} Criar a loja
      </button>
      <p class="nota">${ic('info','sm')} Depois você cadastra o cardápio com os seus preços. Dá para adicionar mais lojas a qualquer momento.</p>
    </div>
  </div>`;
}

async function salvarSetup(){
  const nome = document.getElementById('s-loja').value.trim();
  if (!nome){ Aviso.erro('Informe o nome da loja'); return; }
  const loja = await Dados.gravar('lojas', {
    nome,
    endereco: document.getElementById('s-end').value.trim(),
    horario: document.getElementById('s-hor').value.trim(),
    metaDia: parseFloat(String(document.getElementById('s-meta').value).replace(',', '.')) || 0,
    criadoEm: Date.now(),
  });
  await Dados.salvarConfig({ rede: nome, criadoEm: Date.now() });
  Aparelho.setLoja(loja.id);
  App.ir('cardapio');
  Aviso.mostrar('Loja criada. Agora cadastre o cardápio.');
}

/* ---------------- Ajustes ---------------- */

function telaAjustes(){
  const loja = Dados.loja();
  const lojas = Dados.lojas();
  const serial = Balanca.suportada();
  const conectada = Balanca.conectada();
  const leitura = Balanca.ultimo;

  return `
  <div class="pagina rolagem">
    <div class="duas">
      <div class="coluna-cartoes">

        <div class="cartao cartao-pad">
          <span class="rotulo">Este aparelho</span>
          <h3 class="cartao-tit">${esc(loja ? loja.nome : 'Sem loja')}</h3>
          <p class="cartao-txt">Cada tablet ou computador escolhe em qual loja está e quem está no caixa.
          Essa escolha fica salva só neste aparelho.</p>
          ${lojas.length > 1 ? `
            <div class="campo">
              <span class="campo-rot">Loja deste aparelho</span>
              <div class="segmento segmento-col">
                ${lojas.map(l => `<button class="seg" data-act="usar-loja" data-id="${l.id}" aria-pressed="${l.id === Aparelho.lojaId()}">${esc(l.nome)}</button>`).join('')}
              </div>
            </div>` : ''}
          ${campo({ id:'a-operador', rotulo:'Quem está no caixa', valor:Aparelho.operador(),
                    dica:'Fica gravado em cada pedido lançado por este aparelho' })}
          <button class="btn btn-ghost" data-act="salvar-operador">Salvar</button>
        </div>

        <div class="cartao cartao-pad">
          <span class="rotulo">Balança</span>
          <h3 class="cartao-tit">${Agente.temBalanca() ? 'Lendo pelo agente da loja'
            : conectada ? 'Conectada pelo navegador' : 'Peso digitado na tela'}</h3>
          ${Agente.temBalanca() ? `
            <div class="visor visor-embutido">
              <span class="visor-v" id="peso-ajustes">${Agente.peso ? kgTexto(Agente.peso.liquido) : '0,000'}</span>
              <span class="visor-u">kg</span>
            </div>
            <label class="troca">
              <input type="checkbox" id="a-autopeso" ${Aparelho.autoPeso() ? 'checked' : ''} data-act="alternar-autopeso">
              <span>Pote na balança lança sozinho no pedido</span>
            </label>
            <div class="campo">
              <span class="campo-rot">Produto da balança</span>
              <div class="segmento segmento-col">
                ${Dados.produtosAtivos().filter(p => p.porPeso).map(p => `
                  <button class="seg" data-act="produto-balanca" data-id="${p.id}"
                    aria-pressed="${(Dados.loja() || {}).produtoBalanca === p.id}">${esc(p.nome)}</button>`).join('')
                  || '<p class="cartao-txt">Cadastre um produto vendido por peso para usar isso.</p>'}
              </div>
              <span class="campo-dica">É este que entra quando alguém põe o pote na balança sem tocar na tela.</span>
            </div>
          ` : ''}
          ${conectada ? `
            <div class="visor visor-embutido">
              <span class="visor-v">${leitura ? kgTexto(leitura.gramas) : '0,000'}</span>
              <span class="visor-u">kg ${leitura && leitura.estavel ? '· estável' : ''}</span>
            </div>
            <button class="btn btn-ghost" data-act="desconectar-balanca">Desconectar</button>
          ` : `
            <p class="cartao-txt">Hoje o atendente digita o peso lido na balança — funciona em qualquer aparelho.
            ${serial ? 'Neste navegador também dá para ligar a balança direto na porta serial.' :
                       'Para ler o peso automaticamente, abra o sistema no Chrome do computador da loja.'}</p>
            ${serial ? `<button class="btn btn-primario" data-act="conectar-balanca">${ic('balanca')} Conectar balança</button>` : ''}
          `}
          <p class="nota">${ic('info','sm')} Modelos com saída serial contínua (Toledo, Filizola, Urano, Balmak) são lidos direto. Modelos só com visor exigem digitar.</p>
        </div>

        <div class="cartao cartao-pad">
          <span class="rotulo">Aparência</span>
          <h3 class="cartao-tit">Tema da tela</h3>
          <div class="segmento">
            <button class="seg" data-act="tema" data-v="light" aria-pressed="${Tema.atual() === 'light'}">Claro</button>
            <button class="seg" data-act="tema" data-v="dark" aria-pressed="${Tema.atual() === 'dark'}">Escuro</button>
          </div>
          <p class="cartao-txt">A cozinha costuma preferir o escuro; o balcão, o claro. A escolha vale só neste aparelho.</p>
          <label class="troca">
            <input type="checkbox" id="a-som" ${Aparelho.som() ? 'checked' : ''} data-act="alternar-som-ajuste">
            <span>Aviso sonoro quando muda o estado de um pedido</span>
          </label>
        </div>
      </div>

      <div class="coluna-cartoes">
        <div class="cartao cartao-pad">
          <span class="rotulo">Lojas</span>
          <h3 class="cartao-tit">${lojas.length} ${lojas.length === 1 ? 'loja cadastrada' : 'lojas cadastradas'}</h3>
          <div class="lista lista-nua">
            ${lojas.map(l => `
              <button class="li" data-act="editar-loja" data-id="${l.id}">
                <span class="li-txt">
                  <span class="li-nome">${esc(l.nome)}</span>
                  <span class="li-sub">${esc(l.endereco || 'sem endereço')}${l.metaDia ? ' · meta ' + brlCurto(l.metaDia) : ''}</span>
                </span>
                ${ic('lapis','sm')}
              </button>`).join('')}
          </div>
          <button class="btn btn-ghost" data-act="nova-loja">${ic('mais')} Adicionar loja</button>
        </div>

        <div class="cartao cartao-pad">
          <span class="rotulo">Agente da loja</span>
          <h3 class="cartao-tit">${Agente.ligado ? 'Conectado' : 'Não encontrado'}</h3>
          ${Agente.ligado ? `
            <div class="kv"><span>Endereço</span><span class="num">${esc(Agente.estado.base || Agente.base)}</span></div>
            <div class="kv"><span>Balança</span><span style="color:${Agente.temBalanca() ? 'var(--ok)' : 'var(--txt-3)'}">
              ${Agente.temBalanca() ? 'lendo na ' + esc(Agente.estado.balanca.porta) : esc(Agente.estado.balanca.motivo)}</span></div>
            <div class="kv"><span>Maquininha</span><span style="color:${Agente.temTerminal() ? 'var(--ok)' : 'var(--txt-3)'}">
              ${esc(Agente.estado.terminal.provedor)} · ${esc(Agente.estado.terminal.detalhe || '')}</span></div>
            <div class="kv"><span>Impressora</span><span style="color:${Agente.temImpressora() ? 'var(--ok)' : 'var(--txt-3)'}">
              ${Agente.temImpressora() ? esc(Agente.estado.impressora.destino) : 'nenhuma configurada'}</span></div>
            <div class="kv"><span>Acompanhamento do cliente</span><span style="color:var(--ok)">publicado na rede da loja</span></div>
            <div class="kv"><span>Cardápio das mesas</span><span style="color:var(--ok)">publicado com código por mesa</span></div>
            <p class="nota">${ic('info','sm')} Os pedidos ficam no agente: caixa, cozinha, painel e totem enxergam a
            mesma fila abrindo <b>${esc(Agente.estado.base || Agente.base)}</b> na rede da sorveteria, sem depender de internet.</p>
          ` : `
            <p class="cartao-txt">O agente é um programa pequeno que roda no computador do balcão. É ele que lê a balança
            pela porta serial, manda o valor para a maquininha e publica a página que o QR Code do cupom abre no celular do cliente.</p>
            <p class="nota">${ic('info','sm')} Para ligar: <b>node agente/servidor.js</b> na pasta do sistema, e abra
            <b>http://localhost:8899</b>. As instruções estão em <b>agente/LEIAME.md</b>.</p>
          `}
        </div>

        <div class="cartao cartao-pad">
          <span class="rotulo">Dados</span>
          <h3 class="cartao-tit">${Dados.online ? 'Compartilhados entre os aparelhos' : 'Guardados neste aparelho'}</h3>
          <p class="cartao-txt">
            ${Dados.online
              ? 'Os pedidos aparecem ao vivo em todos os aparelhos que abrirem este mesmo link — o caixa lança e a cozinha recebe.'
              : 'Sem o armazenamento compartilhado, cada aparelho guarda os próprios pedidos no navegador. Abra o link publicado do sistema para sincronizar caixa e cozinha.'}
          </p>
          <div class="kv"><span>Produtos</span><span>${Dados.estado.produtos.length}</span></div>
          <div class="kv"><span>Pedidos em aberto</span><span>${Dados.estado.pedidos.length}</span></div>
          <div class="kv"><span>Dias com movimento</span><span>${Dados.estado.dias.length}</span></div>
          <div class="botoes-linha">
            <button class="btn btn-ghost" data-act="exportar">${ic('lista')} Fazer backup</button>
            <button class="btn btn-ghost" data-act="importar">${ic('seta')} Restaurar backup</button>
          </div>
          <p class="nota">${ic('info','sm')} O backup é um arquivo com lojas, cardápio, pedidos e o histórico de todos os dias.
          Restaurar grava por cima dos registros iguais e não apaga nada.</p>
        </div>

        <div class="cartao cartao-pad">
          <span class="rotulo">Integrações</span>
          <h3 class="cartao-tit">O que ainda depende de servidor</h3>
          <p class="cartao-txt">Estas peças não funcionam só no navegador. Elas são o próximo passo do projeto,
          e o sistema não finge que já existem.</p>
          <div class="kv"><span>Maquininha</span>${Agente.temTerminal()
            ? '<span class="selo selo-ok">conectada pelo agente</span>'
            : '<span class="selo selo-neutro">cobrança manual</span>'}</div>
          <div class="kv"><span>iFood / Rappi</span><span class="selo selo-neutro">não conectada</span></div>
          <div class="kv"><span>Impressora</span>${Agente.temImpressora()
            ? '<span class="selo selo-ok">conectada pelo agente</span>'
            : '<span class="selo selo-neutro">não conectada</span>'}</div>
          <div class="kv"><span>Pedido na mesa por QR</span>${Agente.ligado
            ? '<span class="selo selo-ok">publicado pelo agente</span>'
            : '<span class="selo selo-neutro">precisa do agente</span>'}</div>
          <div class="kv"><span>Acompanhamento por QR</span>${Agente.ligado
            ? '<span class="selo selo-ok">publicado pelo agente</span>'
            : '<span class="selo selo-neutro">precisa do agente</span>'}</div>
          <div class="kv"><span>Nota fiscal (NFC-e)</span><span class="selo selo-neutro">não conectada</span></div>
        </div>
      </div>
    </div>
  </div>`;
}

/* ---------------- Loja ---------------- */

let editandoLoja = null;

function abrirLoja(id){
  const l = id ? Dados.loja(id) : null;
  editandoLoja = l ? l.id : null;
  Modal.abrir(`
    ${Modal.cabecalho('loja', l ? 'Editar loja' : 'Nova loja', l ? l.nome : '')}
    ${campo({ id:'l-nome', rotulo:'Nome', valor:l ? l.nome : '', obrigatorio:true, foco:true })}
    ${campo({ id:'l-end', rotulo:'Endereço', valor:l ? l.endereco : '' })}
    <div class="dois-campos">
      ${campo({ id:'l-hor', rotulo:'Horário', valor:l ? l.horario : '' })}
      ${campo({ id:'l-meta', rotulo:'Meta por dia', valor:l && l.metaDia ? l.metaDia : '', tipo:'number', sufixo:'R$' })}
    </div>
    ${campo({ id:'l-mesas', rotulo:'Mesas do salão', valor:l && l.mesas ? l.mesas : '', tipo:'number',
              dica:'O sistema gera um QR para cada mesa. Deixe vazio se não tiver mesas.' })}
    <div class="modal-acoes">
      ${l && Dados.lojas().length > 1 ? `<button class="btn btn-perigo-ghost" data-act="apagar-loja">${ic('lixo')} Excluir</button>` : ''}
      <button class="btn btn-ghost" data-act="modal-fechar">Cancelar</button>
      <button class="btn btn-primario" data-act="salvar-loja">Salvar</button>
    </div>`);
}

async function salvarLoja(){
  const nome = document.getElementById('l-nome').value.trim();
  if (!nome){ Aviso.erro('Informe o nome da loja'); return; }
  const antiga = editandoLoja ? Dados.loja(editandoLoja) : null;
  const nova = await Dados.gravar('lojas', {
    ...(antiga || {}),
    id: editandoLoja || undefined,
    nome,
    endereco: document.getElementById('l-end').value.trim(),
    horario: document.getElementById('l-hor').value.trim(),
    metaDia: parseFloat(String(document.getElementById('l-meta').value).replace(',', '.')) || 0,
    mesas: parseInt(document.getElementById('l-mesas').value, 10) || 0,
    criadoEm: antiga ? antiga.criadoEm : Date.now(),
  });
  if (!antiga) Aparelho.setLoja(nova.id);
  Modal.fechar();
  Aviso.mostrar(antiga ? 'Loja atualizada' : 'Loja criada');
}

/* Arquivo de texto que o navegador baixa: serve de backup e de relatório */
function baixarArquivo(nome, conteudo, tipo = 'application/json'){
  try {
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo + ';charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch(e){ return false; }
}

function exportar(){
  const dump = JSON.stringify({ ...Dados.estado, exportadoEm: new Date().toISOString(), versao: 1 }, null, 2);
  const nome = `coltelli-backup-${hoje()}.json`;
  const baixou = baixarArquivo(nome, dump);
  Modal.abrir(`
    ${Modal.cabecalho('lista', 'Backup dos dados', baixou ? `O arquivo ${nome} foi baixado` : 'Copie e guarde onde quiser')}
    <textarea class="area area-mono" rows="10" readonly data-foco>${esc(dump)}</textarea>
    <div class="modal-acoes">
      <button class="btn btn-ghost" data-act="modal-fechar">Fechar</button>
      <button class="btn btn-ghost" data-act="baixar-backup">${ic('seta')} Baixar de novo</button>
      <button class="btn btn-primario" data-act="copiar-dados">${ic('lista')} Copiar</button>
    </div>`);
}

async function importar(){
  const arquivo = await new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => resolve(input.files && input.files[0] ? input.files[0] : null);
    input.click();
  });
  if (!arquivo) return;
  let dump;
  try { dump = JSON.parse(await arquivo.text()); }
  catch(e){ Aviso.erro('Este arquivo não é um backup válido'); return; }

  const conta = (c) => Array.isArray(dump[c]) ? dump[c].length : 0;
  Confirmar.pedir({
    titulo: 'Restaurar este backup?',
    texto: `${conta('lojas')} loja(s), ${conta('produtos')} produto(s), ${conta('pedidos')} pedido(s) em aberto e ${conta('dias')} dia(s) de histórico. Registros iguais são substituídos; nada é apagado.`,
    botao: 'Restaurar',
    async aoConfirmar(){
      try {
        const n = await Dados.importar(dump);
        Aviso.mostrar(`${n} registros restaurados`);
        App.render();
      } catch(e){
        Aviso.erro('Não consegui restaurar: ' + e.message);
      }
    },
  });
}

const acoesConfig = {
  'salvar-setup': () => salvarSetup(),
  'nova-loja': () => abrirLoja(null),
  'editar-loja': (d) => abrirLoja(d.id),
  'salvar-loja': () => salvarLoja(),
  'apagar-loja': () => {
    const l = Dados.loja(editandoLoja);
    Confirmar.pedir({
      titulo:`Excluir ${l.nome}?`, texto:'O histórico dessa loja deixa de aparecer na gestão.',
      botao:'Excluir', perigo:true,
      async aoConfirmar(){ await Dados.apagar('lojas', l.id); Aviso.mostrar('Loja excluída'); },
    });
  },
  'salvar-operador': () => {
    const c = document.getElementById('a-operador');
    Aparelho.setOperador(c.value.trim());
    Aviso.mostrar(c.value.trim() ? `Caixa: ${c.value.trim()}` : 'Nome do caixa removido');
  },
  tema: (d) => Tema.aplicar(d.v),
  'alternar-autopeso': () => {
    const c = document.getElementById('a-autopeso');
    Aparelho.setAutoPeso(c.checked);
    Aviso.mostrar(c.checked ? 'A balança lança sozinha' : 'A balança espera confirmação');
  },
  'produto-balanca': async (d) => {
    const loja = Dados.loja();
    const mesmo = loja.produtoBalanca === d.id;
    await Dados.gravar('lojas', { ...loja, produtoBalanca: mesmo ? null : d.id });
    Aviso.mostrar(mesmo ? 'Produto da balança removido' : 'Produto da balança definido');
  },
  'alternar-som-ajuste': () => {
    const c = document.getElementById('a-som');
    Aparelho.setSom(c.checked);
    Aviso.mostrar(c.checked ? 'Aviso sonoro ligado' : 'Aviso sonoro desligado');
  },
  'conectar-balanca': async () => {
    try {
      await Balanca.conectar();
      Aviso.mostrar('Balança conectada');
      App.render();
    } catch(e){
      Aviso.erro(e && e.message ? e.message : 'Não foi possível abrir a porta');
    }
  },
  'desconectar-balanca': async () => { await Balanca.desconectar(); App.render(); },
  exportar: () => exportar(),
  importar: () => importar(),
  'baixar-backup': () => {
    const area = document.querySelector('.area-mono');
    if (area) baixarArquivo(`coltelli-backup-${hoje()}.json`, area.value);
  },
  'copiar-dados': async () => {
    const area = document.querySelector('.area-mono');
    try { await navigator.clipboard.writeText(area.value); Aviso.mostrar('Copiado'); }
    catch(e){ area.select(); Aviso.erro('Copie com Ctrl+C'); }
  },
};

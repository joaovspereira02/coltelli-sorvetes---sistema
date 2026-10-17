/* Coltelli — Gestão: só o que a loja realmente vendeu */

let diaVisto = null;   // null = hoje

function graficoHoras(porHora){
  const w = 640, h = 190, pl = 58, pb = 28, pt = 16;
  const max = Math.max(...porHora.map(d => d[1]));
  const teto = Math.max(10, Math.ceil(max * 1.15));
  const horas = porHora.map(d => d[0]);
  const de = Math.min(...horas), ate = Math.max(...horas);
  const faixa = [];
  for (let h = de; h <= ate; h++) faixa.push([h, (porHora.find(x => x[0] === h) || [h, 0])[1]]);
  const bw = (w - pl - 12) / faixa.length;

  const larg = Math.min(bw * 0.6, 54);
  const barras = faixa.map(([hora, v], i) => {
    const bh = (v / teto) * (h - pt - pb);
    const x = pl + i * bw + (bw - larg) / 2;
    return `<rect class="grafico-barra" x="${x.toFixed(1)}" y="${(h - pb - bh).toFixed(1)}" width="${larg.toFixed(1)}"
              height="${Math.max(v > 0 ? 3 : 0, bh).toFixed(1)}" rx="3"
              fill="${v === max ? 'var(--acao)' : 'color-mix(in srgb, var(--acao) 28%, transparent)'}"></rect>
            <text x="${(x + larg/2).toFixed(1)}" y="${h - pb + 16}" fill="var(--txt-3)" font-size="10"
              text-anchor="middle" font-family="var(--mono)">${hora}h</text>`;
  }).join('');

  const grade = [0, .5, 1].map(f => {
    const v = teto * f;
    const y = h - pb - f * (h - pt - pb);
    return `<line x1="${pl}" x2="${w-8}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--borda)"></line>
            <text x="${pl-10}" y="${(y+3.5).toFixed(1)}" fill="var(--txt-3)" font-size="10" text-anchor="end"
              font-family="var(--mono)">${brlCurto(v)}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto" role="img"
    aria-label="Faturamento por hora, maior valor ${brl(max)}">${grade}${barras}</svg>`;
}

function barras(lista, campo = 'valor'){
  const max = Math.max(...lista.map(x => x[campo]));
  return lista.map(x => `
    <div class="barra">
      <span class="barra-n">${esc(x.nome)}</span>
      <span class="barra-t"><span class="barra-f" style="width:${(x[campo]/max*100).toFixed(0)}%"></span></span>
      <span class="barra-v">${campo === 'valor' ? brlCurto(x.valor) : x.qtd}</span>
    </div>`).join('');
}

function telaGestao(){
  const data = diaVisto || hoje();
  const r = Dados.resumo(Aparelho.lojaId(), data);
  const lojas = Dados.lojas();
  const vendidos = Dados.maisVendidos(Aparelho.lojaId(), data).slice(0, 8);
  const historico = Dados.historico(Aparelho.lojaId());
  const semNada = !r.pedidos && !r.abertos;
  const pedidosDia = Dados.pedidosDoDia(Aparelho.lojaId(), data);

  return `
  <div class="pagina rolagem">
    <header class="pagina-topo">
      <div>
        <h2>${data === hoje() ? 'Hoje' : dataBR(data)}</h2>
        <p class="pagina-sub">${esc(r.loja ? r.loja.nome : '')}${r.loja && r.loja.horario ? ' · ' + esc(r.loja.horario) : ''}</p>
      </div>
      ${historico.length ? `<div class="pagina-acoes">
        <button class="btn btn-ghost" data-act="ver-dia" data-data="">Hoje</button>
        ${historico.filter(d => d.data !== hoje()).slice(0,4).map(d =>
          `<button class="btn btn-ghost" data-act="ver-dia" data-data="${d.data}" ${d.data === data ? 'aria-current="true"' : ''}>${dataBR(d.data)}</button>`).join('')}
      </div>` : ''}
    </header>

    ${semNada ? vazio('grafico', 'Nenhuma venda registrada neste dia',
        'Os números aparecem sozinhos conforme os pedidos forem fechados no balcão.') : `

      <div class="metricas">
        <div class="cartao metrica metrica-forte">
          <span class="metrica-ic">${ic('grafico','sm')}</span>
          <span class="rotulo">Faturado</span>
          <span class="metrica-v" data-num="g-faturado" data-fmt="dinheiro" data-valor="${r.faturado}">${brl(r.faturado)}</span>
          <span class="metrica-d">${r.meta ? `${((r.faturado / r.meta) * 100).toFixed(0)}% da meta de ${brlCurto(r.meta)}` : 'sem meta definida'}</span>
          ${r.meta ? `<span class="meta-trilho" role="progressbar" aria-valuemin="0" aria-valuemax="100"
            aria-valuenow="${Math.min(100, Math.round(r.faturado / r.meta * 100))}" aria-label="Meta do dia">
            <span class="meta-barra" style="width:${Math.min(100, r.faturado / r.meta * 100).toFixed(1)}%"></span></span>` : ''}
        </div>
        <div class="cartao metrica">
          <span class="metrica-ic">${ic('comanda','sm')}</span>
          <span class="rotulo">Pedidos concluídos</span>
          <span class="metrica-v" data-num="g-pedidos" data-fmt="inteiro" data-valor="${r.pedidos}">${r.pedidos}</span>
          <span class="metrica-d">${r.abertos ? `${r.abertos} em aberto · ${brl(r.emAberto)}` : 'nenhum em aberto'}</span>
        </div>
        <div class="cartao metrica">
          <span class="metrica-ic">${ic('cartao','sm')}</span>
          <span class="rotulo">Ticket médio</span>
          <span class="metrica-v" ${r.pedidos ? `data-num="g-ticket" data-fmt="dinheiro" data-valor="${r.ticket}"` : ''}>${r.pedidos ? brl(r.ticket) : '—'}</span>
          <span class="metrica-d">${r.cancelados ? `${r.cancelados} cancelado(s)` : 'nenhum cancelamento'}</span>
        </div>
        <div class="cartao metrica">
          <span class="metrica-ic">${ic('relogio','sm')}</span>
          <span class="rotulo">Tempo de produção</span>
          <span class="metrica-v">${r.tempo !== null ? numero(r.tempo) + ' min' : '—'}</span>
          <span class="metrica-d">${r.tempo !== null ? 'do lançamento até ficar pronto' : 'ainda sem pedidos concluídos'}</span>
        </div>
      </div>

      <div class="duas">
        <div class="cartao cartao-pad">
          <span class="rotulo">Faturamento por hora</span>
          <h3 class="cartao-tit">${r.porHora.length ? `Pico às ${r.porHora.reduce((a,b) => b[1] > a[1] ? b : a)[0]}h` : 'Sem movimento ainda'}</h3>
          ${r.porHora.length ? graficoHoras(r.porHora) : `<p class="nota-vazia">O gráfico aparece a partir do primeiro pedido do dia.</p>`}
        </div>

        <div class="coluna-cartoes">
          ${vendidos.length ? `<div class="cartao cartao-pad">
            <span class="rotulo">Mais vendidos</span>
            <h3 class="cartao-tit">O que saiu do balcão</h3>
            ${barras(vendidos)}
            ${vendidos.some(v => v.pesoG) ? `<p class="nota">${ic('balanca','sm')} ${kgTexto(vendidos.reduce((s,v) => s + v.pesoG, 0))} kg pesados no dia</p>` : ''}
          </div>` : ''}

          ${r.porPagamento.length ? `<div class="cartao cartao-pad">
            <span class="rotulo">Formas de pagamento</span>
            <h3 class="cartao-tit">Como o cliente pagou</h3>
            ${barras(r.porPagamento)}
          </div>` : ''}

          ${r.porCanal.length > 1 ? `<div class="cartao cartao-pad">
            <span class="rotulo">Origem</span>
            <h3 class="cartao-tit">De onde veio o pedido</h3>
            ${barras(r.porCanal)}
          </div>` : ''}
        </div>
      </div>
    `}

    ${pedidosDia.length ? `
      <section class="grupo">
        <div class="grupo-cab">
          <h3 class="grupo-tit">Pedidos ${data === hoje() ? 'de hoje' : 'de ' + dataBR(data)} · ${pedidosDia.length}</h3>
          <button class="btn btn-ghost btn-mini" data-act="baixar-csv" data-data="${data}">${ic('lista','sm')} Baixar planilha (CSV)</button>
        </div>
        <div class="cartao tabela-caixa rolagem-x">
          <table class="tabela">
            <thead><tr><th>Nº</th><th>Hora</th><th>Origem</th><th>Itens</th><th>Pagamento</th><th>Situação</th><th class="dir">Valor</th></tr></thead>
            <tbody>
              ${pedidosDia.slice(0, verTodos ? pedidosDia.length : 12).map(p => `
                <tr class="${p.status === 'cancelado' ? 'cancelado' : ''}">
                  <td class="num">${p.numero}</td>
                  <td class="num">${hora(p.criadoEm)}</td>
                  <td>${esc(p.canal || 'balcão')}</td>
                  <td class="tabela-itens">${esc(resumoItens(p))}</td>
                  <td>${esc(p.pago === false ? 'a receber' : (p.pagamento || '—'))}</td>
                  <td>${situacao(p)}</td>
                  <td class="num dir">${brl(p.valor)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        ${pedidosDia.length > 12 ? `<button class="btn btn-ghost" data-act="ver-todos">${verTodos ? 'Mostrar menos' : `Ver todos os ${pedidosDia.length}`}</button>` : ''}
      </section>` : ''}

    ${lojas.length > 1 ? `
      <section class="grupo">
        <h3 class="grupo-tit">Rede · ${data === hoje() ? 'hoje' : dataBR(data)}</h3>
        <div class="rede-grid">
          ${lojas.map(l => {
            const rl = Dados.resumo(l.id, data);
            const ativa = l.id === Aparelho.lojaId();
            return `
            <div class="cartao loja-cartao ${ativa ? 'ativa' : ''}">
              <div class="loja-topo">
                <span class="loja-nome">${esc(l.nome)}</span>
                ${ativa ? '<span class="selo selo-acao">neste aparelho</span>' : ''}
              </div>
              <div class="loja-nums">
                <div><span class="rotulo">Faturado</span><span class="loja-v">${brlCurto(rl.faturado)}</span></div>
                <div><span class="rotulo">Pedidos</span><span class="loja-v">${rl.pedidos}</span></div>
                <div><span class="rotulo">Na fila</span><span class="loja-v">${rl.abertos}</span></div>
                <div><span class="rotulo">Ticket</span><span class="loja-v">${rl.pedidos ? brl(rl.ticket) : '—'}</span></div>
              </div>
              ${ativa ? '' : `<button class="btn btn-ghost btn-cheio" data-act="usar-loja" data-id="${l.id}">Operar nesta loja</button>`}
            </div>`;
          }).join('')}
        </div>
      </section>` : ''}

    ${historico.length > 1 ? `
      <section class="grupo">
        <h3 class="grupo-tit">Últimos dias</h3>
        <div class="cartao lista">
          ${historico.map(d => `
            <button class="li" data-act="ver-dia" data-data="${d.data}">
              <span class="li-txt">
                <span class="li-nome">${dataBR(d.data)}</span>
                <span class="li-sub">${d.pedidos} ${d.pedidos === 1 ? 'pedido' : 'pedidos'}</span>
              </span>
              <span class="li-v">${brl(d.valor)}</span>
              ${ic('seta','sm')}
            </button>`).join('')}
        </div>
      </section>` : ''}
  </div>`;
}

let verTodos = false;

const hora = (ts) => { const d = new Date(ts); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };

function situacao(p){
  const mapa = {
    novo:      ['selo-acao', 'na fila'],
    preparo:   ['selo-aviso', 'em preparo'],
    pronto:    ['selo-ok', 'pronto'],
    entregue:  ['selo-neutro', 'entregue'],
    cancelado: ['selo-erro', 'cancelado'],
  };
  const [cls, txt] = mapa[p.status] || ['selo-neutro', p.status];
  return `<span class="selo ${cls}">${txt}</span>`;
}

/* Planilha do dia: abre no Excel e no Google Planilhas (separador ; e vírgula decimal) */
function csvDoDia(data){
  const loja = Dados.loja();
  const cel = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const dinheiro = (v) => (Number(v) || 0).toFixed(2).replace('.', ',');
  const linhas = [['Loja','Data','Número','Hora','Origem','Cliente','Itens','Pagamento','Situação','Valor','Operador']];
  Dados.pedidosDoDia(Aparelho.lojaId(), data).slice().reverse().forEach(p => {
    linhas.push([
      loja ? loja.nome : '', dataBR(data) + '/' + data.slice(0,4), p.numero, hora(p.criadoEm),
      p.canal || 'balcão', p.cliente || '', resumoItens(p),
      p.pago === false ? 'a receber' : (p.pagamento || ''), p.status, dinheiro(p.valor), p.operador || '',
    ]);
  });
  return '\ufeff' + linhas.map(l => l.map(cel).join(';')).join('\r\n');
}

const acoesGestao = {
  'ver-dia': (d) => { diaVisto = d.data || null; verTodos = false; App.render(); },
  'ver-todos': () => { verTodos = !verTodos; App.render(); },
  'baixar-csv': (d) => {
    const data = d.data || hoje();
    if (baixarArquivo(`coltelli-pedidos-${data}.csv`, csvDoDia(data), 'text/csv')) Aviso.mostrar('Planilha baixada');
    else Aviso.erro('O navegador bloqueou o download');
  },
  'usar-loja': (d) => {
    Aparelho.setLoja(d.id);
    Aviso.mostrar(`Operando em ${Dados.loja(d.id).nome}`);
    App.render();
  },
};

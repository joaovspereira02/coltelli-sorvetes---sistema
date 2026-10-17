/* Agente Coltelli — recibo e comanda em impressora térmica (ESC/POS).

   Dois caminhos:
   - rede: a maioria das térmicas de balcão escuta em TCP 9100 (Epson TM-T20,
     Elgin i9, Bematech MP-4200 com placa de rede);
   - arquivo: em Linux e macOS dá para escrever direto no dispositivo USB,
     por exemplo /dev/usb/lp0.

   Sem impressora configurada, o sistema mostra o recibo na tela e segue. */

const net = require('net');
const fs = require('fs');

const ESC = 0x1B, GS = 0x1D;

/* ---------- montagem do cupom ---------- */
class Cupom {
  constructor(colunas = 42){
    this.colunas = colunas;
    this.partes = [Buffer.from([ESC, 0x40])];   // inicializa
  }
  cmd(...bytes){ this.partes.push(Buffer.from(bytes)); return this; }
  texto(s = ''){ this.partes.push(Buffer.from(String(s) + '\n', 'latin1')); return this; }
  centro(){ return this.cmd(ESC, 0x61, 1); }
  esquerda(){ return this.cmd(ESC, 0x61, 0); }
  grande(l = 1, a = 1){ return this.cmd(GS, 0x21, (l << 4) | a); }
  normal(){ return this.cmd(GS, 0x21, 0x00); }
  negrito(on){ return this.cmd(ESC, 0x45, on ? 1 : 0); }
  linha(){ return this.texto('-'.repeat(this.colunas)); }
  pular(n = 1){ return this.cmd(ESC, 0x64, n); }
  cortar(){ return this.cmd(GS, 0x56, 0x00); }

  /* duas colunas: descrição à esquerda, valor à direita */
  par(esq, dir){
    const e = String(esq);
    const d = String(dir);
    const espaco = Math.max(1, this.colunas - e.length - d.length);
    return this.texto(e + ' '.repeat(espaco) + d);
  }

  qr(conteudo, tamanho = 6){
    const dados = Buffer.from(conteudo, 'latin1');
    const n = dados.length + 3;
    this.cmd(GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);          // modelo 2
    this.cmd(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, tamanho);             // tamanho do módulo
    this.cmd(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31);                // correção M
    this.partes.push(Buffer.concat([
      Buffer.from([GS, 0x28, 0x6B, n & 0xFF, (n >> 8) & 0xFF, 0x31, 0x50, 0x30]),
      dados,
    ]));
    this.cmd(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30);                // imprime
    return this;
  }

  buffer(){ return Buffer.concat(this.partes); }
}

/* ---------- envio ---------- */
class Impressora {
  constructor(cfg = {}){
    this.cfg = cfg;
    this.modo = cfg.modo || 'nenhuma';          // rede | arquivo | nenhuma
    this.colunas = Number(cfg.colunas) || 42;
  }

  estado(){
    return {
      modo: this.modo,
      destino: this.modo === 'rede' ? `${this.cfg.host}:${this.cfg.porta || 9100}` : (this.cfg.caminho || null),
      pronta: this.modo !== 'nenhuma',
    };
  }

  async enviar(buf){
    if (this.modo === 'rede') return this.porRede(buf);
    if (this.modo === 'arquivo') return this.porArquivo(buf);
    throw new Error('nenhuma impressora configurada');
  }

  porRede(buf){
    return new Promise((resolve, reject) => {
      const s = net.connect({ host: this.cfg.host, port: Number(this.cfg.porta) || 9100 }, () => {
        s.write(buf, () => s.end());
      });
      s.setTimeout(6000, () => { s.destroy(); reject(new Error('impressora não respondeu')); });
      s.on('error', reject);
      s.on('close', () => resolve(true));
    });
  }

  porArquivo(buf){
    return new Promise((resolve, reject) => {
      fs.writeFile(this.cfg.caminho, buf, err => err ? reject(err) : resolve(true));
    });
  }

  /* Recibo do cliente: é o papel que ele entrega para confirmar que pagou */
  async recibo(pedido, loja, url){
    const c = new Cupom(this.colunas);
    c.centro().grande(1,1).texto(loja && loja.nome ? loja.nome : 'Coltelli').normal();
    c.texto('COLTELLI SORVETES');
    if (loja && loja.endereco) c.texto(loja.endereco);
    c.linha();

    c.texto('SENHA').grande(2,2).texto(String(pedido.numero)).normal();
    c.linha();

    c.esquerda();
    (pedido.itens || []).forEach(i => {
      const q = i.pesoG ? (i.pesoG/1000).toFixed(3).replace('.', ',') + 'kg' : i.qtd + 'x';
      c.par(`${q} ${i.nome}`.slice(0, this.colunas - 10), moeda(i.valor));
      if (i.obs) c.texto('   obs: ' + i.obs);
    });
    c.linha();
    c.negrito(true).par('TOTAL', moeda(pedido.valor)).negrito(false);
    c.par('Pagamento', pedido.pagamento || '-');
    if (pedido.nsu) c.par('NSU', pedido.nsu);
    c.par('Pedido', '#' + pedido.numero);
    c.par(new Date(pedido.criadoEm).toLocaleString('pt-BR'), '');
    c.linha();

    if (url){
      c.centro().texto('Acompanhe seu pedido').qr(url, 6).texto('').esquerda();
    }
    c.centro().texto('Obrigado pela preferencia!').pular(1);
    c.cortar();
    return this.enviar(c.buffer());
  }

  /* Comanda da cozinha: sem preço, letra grande */
  async comanda(pedido, loja){
    const c = new Cupom(this.colunas);
    c.centro().grande(1,1).texto('PRODUCAO').normal();
    c.texto(loja && loja.nome ? loja.nome : '');
    c.linha();
    c.grande(2,2).texto('#' + pedido.numero).normal();
    c.texto(pedido.canal || 'balcao');
    if (pedido.cliente) c.texto(pedido.cliente);
    c.linha().esquerda();
    (pedido.itens || []).forEach(i => {
      const q = i.pesoG ? (i.pesoG/1000).toFixed(3).replace('.', ',') + 'kg' : i.qtd + 'x';
      c.grande(0,1).texto(`${q} ${i.nome}`).normal();
      if (i.obs) c.texto('   ** ' + i.obs);
    });
    c.linha().pular(1).cortar();
    return this.enviar(c.buffer());
  }
}

function moeda(v){
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
}

module.exports = { Impressora, Cupom };

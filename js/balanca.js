/* Coltelli — leitura da balança.

   Duas formas, ambas reais:
   1. Porta serial, quando o navegador expõe a Web Serial API (Chrome e Edge no
      computador da loja). O peso chega da balança e entra no pedido sozinho.
   2. Digitação do peso no teclado da tela, que é como a loja trabalha hoje.

   Não há leitura simulada: se a porta não estiver conectada, o sistema pede o
   número digitado e diz por quê. */

const Balanca = {
  porta: null,
  leitor: null,
  lendo: false,
  ultimo: null,          // { gramas, estavel, em }
  ouvintes: new Set(),

  suportada(){ return typeof navigator !== 'undefined' && 'serial' in navigator; },
  conectada(){ return !!this.porta; },
  ouvir(fn){ this.ouvintes.add(fn); return () => this.ouvintes.delete(fn); },
  avisar(){ this.ouvintes.forEach(fn => fn(this.ultimo)); },

  async conectar({ baud = 9600 } = {}){
    if (!this.suportada()) throw new Error('Este navegador não abre porta serial. Use o Chrome no computador da loja, ou digite o peso.');
    this.porta = await navigator.serial.requestPort();
    await this.porta.open({ baudRate: baud, dataBits: 8, stopBits: 1, parity: 'none' });
    this.lendo = true;
    this.laco();
    return true;
  },

  async desconectar(){
    this.lendo = false;
    try { if (this.leitor) await this.leitor.cancel(); } catch(e){ /* já encerrado */ }
    try { if (this.porta) await this.porta.close(); } catch(e){ /* já fechada */ }
    this.porta = null; this.leitor = null; this.ultimo = null;
    this.avisar();
  },

  /* As balanças de balcão despejam o peso em texto, uma leitura por linha.
     O formato muda de marca para marca, então extraímos o primeiro número da linha. */
  async laco(){
    const decoder = new TextDecoderStream();
    this.porta.readable.pipeTo(decoder.writable).catch(() => {});
    this.leitor = decoder.readable.getReader();
    let buffer = '';
    while (this.lendo){
      let pedaco;
      try { pedaco = await this.leitor.read(); }
      catch(e){ break; }
      if (pedaco.done) break;
      buffer += pedaco.value;
      const linhas = buffer.split(/[\r\n]+/);
      buffer = linhas.pop();
      linhas.forEach(l => this.interpretar(l));
    }
    this.lendo = false;
  },

  interpretar(linha){
    const bruto = linha.replace(',', '.');
    const achado = bruto.match(/-?\d+(\.\d+)?/);
    if (!achado) return;
    const n = parseFloat(achado[0]);
    if (isNaN(n)) return;
    // Menor que 30 costuma vir em quilos (0.640); acima disso, em gramas.
    const gramas = Math.abs(n) < 30 ? Math.round(n * 1000) : Math.round(n);
    const anterior = this.ultimo;
    const estavel = !!(anterior && Math.abs(anterior.gramas - gramas) <= 2);
    this.ultimo = { gramas, estavel, em: Date.now() };
    this.avisar();
  },
};

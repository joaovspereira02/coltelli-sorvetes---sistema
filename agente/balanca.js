/* Agente Coltelli — leitura da balança pela porta serial.

   A dependência `serialport` é opcional: sem ela, o agente sobe do mesmo jeito e
   o sistema pede o peso digitado. Nada aqui inventa leitura. */

const { EventEmitter } = require('events');

/* Como cada marca despeja o peso na linha. O padrão pega o primeiro número
   que aparecer, o que cobre a maioria das balanças de balcão. */
const PROTOCOLOS = {
  generico: {
    nome: 'Genérico (primeiro número da linha)',
    ler(linha){
      const m = linha.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
      return m ? parseFloat(m[0]) : null;
    },
  },
  toledo: {
    // Toledo Prix: quadro contínuo, peso em 5 ou 6 dígitos, em gramas ou quilos
    nome: 'Toledo P03 (contínuo)',
    ler(linha){
      const m = linha.replace(',', '.').match(/(-?\d{4,7}(?:\.\d+)?)/);
      return m ? parseFloat(m[1]) : null;
    },
  },
  filizola: {
    nome: 'Filizola',
    ler(linha){
      const m = linha.replace(',', '.').match(/(-?\d+(?:\.\d{1,3})?)\s*(kg|g)?/i);
      if (!m) return null;
      const v = parseFloat(m[1]);
      return m[2] && m[2].toLowerCase() === 'kg' ? v * 1000 : v;
    },
  },
};

class Balanca extends EventEmitter {
  constructor(cfg = {}){
    super();
    this.cfg = cfg;
    this.porta = null;
    this.conectada = false;
    this.ultimo = null;       // { gramas, estavel, em }
    this.tara = Number(cfg.taraG) || 0;
    this.motivo = 'não iniciada';
    this.buffer = '';
    this.historico = [];
  }

  estado(){
    return {
      conectada: this.conectada,
      motivo: this.motivo,
      porta: this.cfg.porta || null,
      protocolo: this.cfg.protocolo || 'generico',
      tara: this.tara,
      leitura: this.ultimo,
    };
  }

  iniciar(){
    if (!this.cfg.porta){
      this.motivo = 'nenhuma porta configurada';
      return;
    }
    let SerialPort;
    try { ({ SerialPort } = require('serialport')); }
    catch(e){
      this.motivo = 'pacote serialport não instalado (npm install serialport)';
      return;
    }
    try {
      this.porta = new SerialPort({
        path: this.cfg.porta,
        baudRate: Number(this.cfg.baud) || 9600,
        dataBits: Number(this.cfg.dataBits) || 8,
        stopBits: Number(this.cfg.stopBits) || 1,
        parity: this.cfg.parity || 'none',
        autoOpen: false,
      });
    } catch(e){
      this.motivo = 'não foi possível abrir ' + this.cfg.porta + ': ' + e.message;
      return;
    }

    this.porta.open(err => {
      if (err){
        this.conectada = false;
        this.motivo = err.message;
        this.emit('estado', this.estado());
        setTimeout(() => this.iniciar(), 5000);   // a balança pode ter sido desligada
        return;
      }
      this.conectada = true;
      this.motivo = 'lendo';
      this.emit('estado', this.estado());
    });

    this.porta.on('data', d => this.receber(d.toString('latin1')));
    this.porta.on('close', () => {
      this.conectada = false;
      this.motivo = 'porta fechada';
      this.emit('estado', this.estado());
      setTimeout(() => this.iniciar(), 5000);
    });
    this.porta.on('error', e => {
      this.motivo = e.message;
      this.emit('estado', this.estado());
    });
  }

  receber(texto){
    this.buffer += texto;
    const linhas = this.buffer.split(/[\r\n]+/);
    this.buffer = linhas.pop();
    linhas.forEach(l => this.interpretar(l.trim()));
  }

  interpretar(linha){
    if (!linha) return;
    const proto = PROTOCOLOS[this.cfg.protocolo] || PROTOCOLOS.generico;
    const n = proto.ler(linha);
    if (n === null || isNaN(n)) return;

    // Abaixo de 30 a leitura veio em quilos; acima disso já está em gramas.
    const gramas = Math.round(Math.abs(n) < 30 ? n * 1000 : n);

    this.historico.push(gramas);
    if (this.historico.length > 5) this.historico.shift();
    const estavel = this.historico.length >= 3 &&
      Math.max(...this.historico) - Math.min(...this.historico) <= 2;

    this.ultimo = { gramas, liquido: Math.max(0, gramas - this.tara), estavel, em: Date.now() };
    this.emit('peso', this.ultimo);
  }

  tarar(g){
    this.tara = g === undefined || g === null
      ? (this.ultimo ? this.ultimo.gramas : 0)
      : Number(g) || 0;
    this.emit('estado', this.estado());
    return this.tara;
  }

  zerar(){ return this.tarar(0); }
}

module.exports = { Balanca, PROTOCOLOS };

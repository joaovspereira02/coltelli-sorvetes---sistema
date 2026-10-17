/* Coltelli — fotos dos produtos.

   A foto é reduzida no próprio navegador antes de sair do aparelho: ninguém
   precisa mandar um arquivo de 4 MB do celular para a loja inteira carregar.

   Com o agente ligado, o arquivo fica no computador do balcão e o produto guarda
   só o endereço. Sem agente, a foto já reduzida vai junto do produto. */

const Fotos = {
  LADO: 720,          // maior lado da foto guardada
  QUALIDADE: 0.72,
  LIMITE_SEM_AGENTE: 150 * 1024,

  /* Abre o seletor do aparelho (no celular, a câmera também) */
  escolher(){
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => resolve(input.files && input.files[0] ? input.files[0] : null);
      input.click();
    });
  },

  async reduzir(arquivo, qualidade = this.QUALIDADE){
    const url = URL.createObjectURL(arquivo);
    try {
      const img = await new Promise((ok, falha) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = () => falha(new Error('não consegui abrir a imagem'));
        i.src = url;
      });
      const escala = Math.min(1, this.LADO / Math.max(img.width, img.height));
      const l = Math.round(img.width * escala);
      const a = Math.round(img.height * escala);
      const tela = document.createElement('canvas');
      tela.width = l; tela.height = a;
      const ctx = tela.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, l, a);
      ctx.drawImage(img, 0, 0, l, a);
      return await new Promise(ok => tela.toBlob(ok, 'image/jpeg', qualidade));
    } finally {
      URL.revokeObjectURL(url);
    }
  },

  async guardar(arquivo){
    let blob = await this.reduzir(arquivo);
    if (!blob) throw new Error('não consegui preparar a imagem');

    if (Agente.ligado){
      const r = await fetch(Agente.base + '/api/fotos', {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob,
      });
      const d = await r.json();
      if (!r.ok || !d.url) throw new Error(d.erro || 'o agente não guardou a foto');
      return Agente.base === location.origin ? d.url : Agente.base + d.url;
    }

    // Sem agente a foto viaja junto do produto, então precisa ser pequena.
    let tentativa = 0;
    while (blob.size > this.LIMITE_SEM_AGENTE && tentativa < 3){
      blob = await this.reduzir(arquivo, this.QUALIDADE - 0.18 * (tentativa + 1));
      tentativa++;
    }
    if (blob.size > this.LIMITE_SEM_AGENTE){
      throw new Error('foto muito pesada. Ligue o agente da loja para guardar fotos grandes.');
    }
    return await new Promise((ok, falha) => {
      const fr = new FileReader();
      fr.onload = () => ok(fr.result);
      fr.onerror = () => falha(new Error('não consegui ler a imagem'));
      fr.readAsDataURL(blob);
    });
  },
};

/* Miniatura usada no cardápio, no balcão e no totem */
function foto(p, cls = ''){
  if (p.foto) return `<img class="foto ${cls}" src="${esc(p.foto)}" alt="" loading="lazy">`;
  return `<span class="foto sem-foto ${cls}" aria-hidden="true">${esc((p.nome || '?').slice(0,1).toUpperCase())}</span>`;
}

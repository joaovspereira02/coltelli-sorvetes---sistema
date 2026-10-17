# Bibliotecas de terceiros

Ficam dentro do projeto para o sistema funcionar sem internet na loja — o QR Code
do cupom e as animações não dependem de CDN.

| arquivo | origem | versão | licença |
|---|---|---|---|
| `motion.js` | [Motion](https://motion.dev) (o Framer Motion para DOM puro), `motion/dist/motion.js` | 12.23.12 | MIT |
| `qrcode.js` | [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator), de Kazuhiko Arase | 1.4.4 | MIT |

Para atualizar: `npm pack motion@<versão>` / `npm pack qrcode-generator@<versão>` e copie
o mesmo arquivo de `dist/` por cima.

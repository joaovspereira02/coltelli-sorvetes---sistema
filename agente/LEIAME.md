# Agente Coltelli

Programa pequeno que roda no computador do balcão e faz o que o navegador não faz:

- **Lê a balança** pela porta serial e joga o peso direto no pedido — o pote na balança
  lança sozinho, sem ninguém tocar na tela.
- **Cobra na maquininha**, guardando o token fora do navegador.
- **Publica a página de acompanhamento** que o QR Code do cupom abre no celular do cliente.
- **Imprime o recibo e a comanda** em impressora térmica.
- **Publica o cardápio das mesas**: o cliente aponta a câmera para o QR colado na mesa,
  pede pelo próprio celular e o pedido cai na produção.
- **Guarda as fotos dos produtos.**
- **Serve o próprio sistema** e guarda os pedidos, então caixa, cozinha, painel e totem
  enxergam a mesma fila pela rede da loja, sem depender de internet.

## Ligar

Precisa do [Node.js 18 ou mais novo](https://nodejs.org).

```
cd "cotteli - sistema"
npm run dev
```

`npm run dev` e `npm start` fazem a mesma coisa: `node agente/servidor.js`. Não há build
nem `npm install` no sistema — só a balança precisa de um pacote (`npm run balanca`).

O terminal mostra os endereços:

```
  Sistema:         http://localhost:8899
  Na rede da loja: http://192.168.0.4:8899
```

Abra o primeiro no computador do caixa. Nos tablets da cozinha, do painel e do totem,
abra o segundo — todos ficam na mesma fila, ao vivo.

Deixe o agente rodando o dia inteiro. Para subir junto com o computador, use
`pm2 start agente/servidor.js --name coltelli` ou um atalho na inicialização do sistema.

## Configurar

Copie `config.exemplo.json` para `config.json` e edite. O `config.json` não vai para o
controle de versão, porque guarda o token da maquininha.

```json
{
  "porta": 8899,
  "balanca": { "porta": "/dev/tty.usbserial-1420", "baud": 9600, "protocolo": "generico" },
  "pagamento": { "provedor": "manual", "token": "", "deviceId": "" }
}
```

### Balança

Instale o driver da porta serial uma única vez:

```
npm install serialport --prefix agente
```

Descubra o nome da porta:

- **Windows**: Gerenciador de Dispositivos → Portas (COM e LPT) → algo como `COM3`.
- **macOS/Linux**: `ls /dev/tty.usb*` ou `ls /dev/ttyUSB*`.

Protocolos disponíveis em `protocolo`:

| valor | serve para |
|---|---|
| `generico` | pega o primeiro número da linha — funciona na maioria das balanças de balcão |
| `toledo` | Toledo Prix, quadro contínuo |
| `filizola` | Filizola, com ou sem sufixo de unidade |

Leitura abaixo de 30 é entendida como quilo e convertida para grama. A tara pode ser fixa
(`taraG`) ou tirada na hora, pelo botão **Tarar com o pote** na tela de pesagem.

Sem balança configurada o sistema continua funcionando: o peso é digitado.

### Maquininha

Hoje há um provedor integrado por API: **Mercado Pago Point**. Terminais inteligentes da
Stone, Cielo LIO e PagSeguro integram por SDK dentro do próprio aparelho (aplicativo Android
no terminal), não por API a partir do PC — para esses, o caminho é um app no terminal
chamando este agente.

```json
"pagamento": {
  "provedor": "mercadopago",
  "token": "APP_USR-...",
  "deviceId": ""
}
```

O token é o *access token* de produção da conta da loja. Deixe `deviceId` vazio: o agente
lista os terminais pareados e usa o primeiro. Endpoints usados:

```
GET    /point/integration-api/devices
POST   /point/integration-api/devices/{device}/payment-intents
GET    /point/integration-api/payment-intents/{intent}
DELETE /point/integration-api/devices/{device}/payment-intents/{intent}
```

**Antes de operar com dinheiro real**, confira esses endereços e os nomes dos campos na
documentação da sua conta e faça uma cobrança de R$ 1,00 com o terminal na mão. Esta parte
foi escrita a partir da documentação pública e **não foi testada contra um terminal real**,
porque isso depende da conta e do aparelho da loja.

Com `provedor: "manual"` (padrão) nada muda: o atendente cobra na maquininha e escolhe a
forma no sistema.

### Impressora

Térmica de balcão, por rede ou por arquivo de dispositivo:

```json
"impressora": { "modo": "rede", "host": "192.168.0.50", "porta": 9100, "colunas": 42 }
```

`modo` aceita `rede` (a maioria das térmicas escuta em TCP 9100), `arquivo`
(`"caminho": "/dev/usb/lp0"`, em Linux e macOS) ou `nenhuma`.

Imprime dois papéis em ESC/POS: o **recibo do cliente**, com a senha em corpo grande, os
itens, o total, a forma de pagamento e o QR de acompanhamento; e a **comanda da produção**,
sem preço e com letra maior. O recibo sai sozinho quando o totem aprova um pagamento e quando
o caixa recebe um pedido do totem ou da mesa; a comanda sai sozinha quando entra um pedido de
mesa. Com impressora configurada, o balcão ganha o botão **Recibo** na confirmação do pedido e
cada cartão da produção ganha o botão de imprimir a comanda.

**Não testei contra uma impressora real** — os comandos seguem o padrão ESC/POS, mas marca e
modelo mudam detalhes. Faça um teste antes de depender disso no movimento.

### Mesas

Diga quantas mesas a loja tem em **Ajustes → Lojas**. O sistema gera uma folha de QR em
**Mesas**, pronta para imprimir e colar.

Como isso fica seguro:

- **Cada mesa tem um código secreto** dentro do QR (`/mesa/3?t=xxxxxxxxxx`). Digitar o
  endereço na mão trocando o número **não funciona**: o agente devolve 403 e uma página
  pedindo para usar o QR da própria mesa. Sem isso, qualquer um pediria em nome da mesa dos outros.
- **Limite de quatro pedidos por minuto por mesa** e oito por aparelho, para brincadeira não
  virar fila na cozinha.
- **Gerar novos códigos** (botão na tela Mesas) invalida todos os QR antigos de uma vez,
  caso um cartão vire piada. Depois é só reimprimir a folha.
- O endereço com o código **não é impresso** no cartão: só o QR carrega.
- O celular do cliente manda só o id do produto e a quantidade. **Quem calcula o preço é o
  agente**, com o cardápio da loja — preço nunca vem do aparelho do cliente.
- O agente só existe dentro da Wi-Fi da sorveteria. Divulgar o endereço fora da loja não
  dá acesso a nada, porque ele não está na internet.

## O que o agente expõe

| rota | para quê |
|---|---|
| `GET /` | o sistema |
| `GET /api/estado` | estado da balança e da maquininha |
| `GET /api/dados` · `PUT/DELETE /api/dados/:colecao/:id` | os dados da loja |
| `GET /eventos` | peso, cobrança e mudanças, ao vivo (SSE) |
| `POST /api/balanca/tarar` | tara |
| `POST /api/cobranca` · `GET/DELETE /api/cobranca/:id` | cobrança na maquininha |
| `GET /p/:codigo` | acompanhamento do cliente (o QR aponta para cá) |
| `GET /mesa/:n` | cardápio da mesa, no celular do cliente |
| `GET /api/cardapio` · `POST /api/pedido-mesa` | cardápio e pedido da mesa |
| `POST /api/fotos` · `GET /fotos/:nome` | fotos dos produtos |
| `POST /api/imprimir` | recibo ou comanda |
| `GET /api/mesas` · `POST /api/mesas?regerar=1` | códigos das mesas |

Os pedidos ficam em `agente/dados.json` e as fotos em `agente/fotos/`. Faça cópia desse arquivo junto com o backup da loja
(ou use *Ajustes → Dados → Fazer backup*, que baixa tudo num arquivo só).

O agente também garante que **não haja número de pedido repetido**: um pedido novo que chega
com um número já usado naquele dia ganha o próximo número livre.

## Segurança

O agente serve a rede local da loja sem senha. Isso é adequado para a Wi-Fi da sorveteria e
**não deve ser exposto à internet**: não faça encaminhamento de porta no roteador. Quem
estiver na rede consegue abrir o sistema e a página de acompanhamento.

O agente **não serve os próprios arquivos**: `config.json` (com o token da maquininha),
`dados.json` (com o histórico de vendas) e o código do servidor devolvem 404. Para o
navegador saem apenas `index.html`, `css/`, `js/`, `img/`, `vendor/`, as fotos dos produtos e as páginas
do cliente. Pedido de mesa exige o código da mesa e respeita limite por minuto.

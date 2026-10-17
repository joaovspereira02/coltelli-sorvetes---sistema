# Coltelli — sistema da sorveteria

Sistema de operação de sorveteria: balcão, produção, totem, cardápio e gestão.
**Não há dados de demonstração.** O sistema abre vazio, você cadastra a loja e o cardápio
com os seus preços, e todo número na tela vem dos pedidos que você realmente fechou.

## Como começar

1. Abra o sistema. Na primeira vez ele pede o nome da loja (e, se quiser, endereço,
   horário e meta de faturamento do dia).
2. Vá em **Cardápio** e cadastre os produtos. Dá para adicionar um a um ou colar uma lista:
   `nome ; preço ; categoria`, uma por linha, terminando com `; kg` quando for venda por peso.
3. **Fotos**: no Cardápio, cada produto aceita uma foto. Ela aparece no balcão, no totem e
   no cardápio da mesa, e é reduzida no próprio aparelho antes de ser guardada.
4. **Balcão**: toque nos produtos, escolha a forma de pagamento e feche o pedido.
5. **Produção**: o pedido aparece na fila, com cronômetro. *Iniciar* → *Pronto* → *Entregue*.
6. **Painel**: a TV do salão mostra as senhas em preparo e as prontas. Quando uma senha fica
   pronta, ela é *chamada*: aparece em destaque, pulsa e toca um aviso. O botão *Tela cheia*
   esconde o menu.
7. **Gestão**: faturado, ticket médio, tempo de produção, mais vendidos e formas de
   pagamento — tudo calculado dos pedidos do dia. Embaixo, a lista dos pedidos do dia, com
   *Baixar planilha (CSV)* para abrir no Excel ou no Google Planilhas.

### Pedido do totem e da mesa: "a receber"

O cliente que pede sozinho (totem sem maquininha ou QR da mesa) paga no caixa. O pedido já
vai para a produção, e no balcão aparece o atalho **a receber** com a quantidade e o valor.
Toque nele, escolha o pedido, a forma de pagamento (com troco, se for dinheiro) e registre.
Na produção, esses pedidos têm o selo *a pagar*; entregar um deles sem receber pede confirmação.

### Backup

Em *Ajustes → Dados*, **Fazer backup** baixa um arquivo com lojas, cardápio, pedidos e o
histórico de todos os dias. **Restaurar backup** lê esse arquivo de volta: grava por cima dos
registros iguais e não apaga nada, então restaurar duas vezes o mesmo arquivo não duplica.

## Agente da loja (balança, maquininha e QR do cliente)

Há um programa pequeno que roda no computador do balcão e resolve o que o navegador sozinho
não faz. Ele está em [`agente/`](agente/LEIAME.md):

```bash
npm run dev
```

(é o mesmo que `node agente/servidor.js` — não há build nem dependência para instalar)

Com ele ligado:

- a **balança** é lida pela porta serial e **o pote na balança lança sozinho no pedido**,
  sem ninguém tocar na tela (dá para desligar em Ajustes);
- a **maquininha** recebe o valor do sistema (Mercado Pago Point por API; o token fica no
  agente, nunca no navegador);
- o **QR Code do cupom** abre no celular do cliente uma página que espelha cada passo —
  recebido, em preparo, pronto para retirar, entregue — e se atualiza sozinha;
- o **totem cobra no cartão** e **imprime o recibo** que o cliente entrega no balcão; o
  balcão também reimprime o recibo, e a produção imprime a comanda de qualquer pedido;
- o **QR da mesa** deixa o cliente pedir do próprio celular, caindo direto na produção —
  cada mesa com código próprio, então trocar o número no navegador não funciona;
- as **fotos dos produtos** ficam guardadas no computador do balcão;
- **todos os aparelhos compartilham a mesma fila** pela rede da loja, sem internet.

O menu mostra três sinais: origem dos dados, balança e maquininha. Cada um diz a verdade
sobre o que está conectado naquele momento.

## Onde os dados ficam

| Situação | Onde fica | O que isso significa |
|---|---|---|
| Sistema aberto pelo agente da loja | `agente/dados.json` | Caixa, cozinha, painel e totem na mesma fila, sem depender de internet |
| Sistema aberto pelo link publicado | Banco compartilhado da conta | Mesmos pedidos ao vivo entre aparelhos, pela internet |
| Arquivo aberto direto do computador | Navegador daquele aparelho | Funciona, mas cada aparelho tem a própria lista |

O rodapé do menu mostra em qual dos três o aparelho está.
Se você já cadastrou coisas no modo local e depois abrir o link publicado, o sistema sobe
esses dados na primeira conexão.

Pedido entregue sai da fila e vira uma linha no fechamento daquele dia, então a lista de
pedidos ao vivo fica pequena e o histórico continua inteiro.

## Balança

Duas formas, as duas reais:

- **Digitar o peso** em gramas num teclado grande, que é como a loja trabalha hoje.
  Funciona em qualquer aparelho.
- **Ler pela porta serial**, em *Ajustes → Balança*, no Chrome ou Edge do computador da loja.
  O peso entra no pedido sozinho. Serve para balanças com saída serial contínua
  (Toledo, Filizola, Urano, Balmak). O navegador pede a permissão da porta uma vez por sessão.

O preço por quilo vem do cadastro do produto, e o valor é calculado na hora.

## O que ainda depende de servidor

O sistema não finge que isso já existe — em *Ajustes* tudo aparece como **não conectado**:

- **Maquininha**: integrada pelo agente no Mercado Pago Point, por API. A parte escrita
  segue a documentação pública e **ainda não foi testada contra um terminal real** — isso
  depende da conta e do aparelho da loja. Stone, Cielo LIO e PagSeguro integram por SDK
  dentro do próprio terminal, o que pede um app Android no aparelho chamando o agente.
- **iFood e Rappi**: exigem servidor com credencial do lojista fazendo o polling dos eventos.
- **Impressora de comanda**: ESC/POS pela rede ou USB, pelo agente local.
- **NFC-e / SAT**: certificado digital e comunicação com a SEFAZ.
- **Login por pessoa e permissão por papel**: hoje cada aparelho escolhe a loja e o nome de
  quem está no caixa, e isso fica gravado em cada pedido. Permissão de verdade se valida no
  servidor, não na tela.
- **Acompanhamento fora da loja**: a página do QR é publicada pelo agente na rede da
  sorveteria. Para o cliente acompanhar de casa, o agente precisa de um endereço público.

## Design

As decisões de interface estão escritas em [`docs/brief-design.md`](docs/brief-design.md) —
é o brief que guiou o desenho e serve de referência para qualquer mudança futura.

A marca vem do logotipo da loja: azul-marinho `#0F3571`, que é a única cor de ação do
sistema. No tema escuro ele clareia para `#7DA8EC`. O símbolo e o nome ficam em `img/`, e
aparecem sempre sobre placa clara, como no material impresso.

Em resumo: escala de 4 px e escala tipográfica fechada; uma única cor de ação; verde, âmbar e
vermelho só para estado, sempre acompanhados de texto; alvo de toque de 48 px no geral e
60 px na ação principal; contraste conferido nos dois temas.

Três coisas nasceram desse brief e mudam o dia a dia:

- **Troco calculado.** Ao escolher dinheiro, um teclado grande recebe o valor entregue,
  sugere as cédulas prováveis e mostra o troco enquanto você digita.
- **Confirmação forte.** Depois de fechar, a coluna da comanda vira um painel com o número
  do pedido em tamanho grande, o total e o troco — é o que o atendente fala em voz alta.
- **Modo cozinha.** Na Produção, um botão esconde o menu e aumenta tudo, para a TV do fundo.
  O estado do pedido tinge o cartão inteiro e vem escrito: *no prazo*, *atenção*, *atrasado*.

## Estrutura

```
index.html              casca, ícones e carregamento
css/tokens.css          cores (claro e escuro), tipografia e peças básicas
css/app.css             layout de cada tela
js/dados.js             armazenamento, pedidos, fechamento do dia e números
js/balanca.js           leitura serial da balança
js/ui.js                modal, avisos, teclado numérico e campos
js/tela-*.js            balcão, produção, cardápio, gestão, ajustes e totem
js/agente.js            conversa com o agente local e desenha o QR
js/fotos.js             reduz e guarda a foto do produto
js/app.js               tema, navegação e ações
js/motion.js            animações (Motion, o Framer Motion para DOM puro)
vendor/                 Motion e gerador de QR guardados no projeto — nada de CDN

agente/servidor.js      serve o sistema, os dados e a página do cliente
agente/balanca.js       leitura serial, por marca
agente/pagamento.js     cobrança na maquininha
agente/impressora.js    recibo e comanda em ESC/POS
agente/paginas.js       cardápio da mesa
agente/LEIAME.md        como ligar e configurar
```

Sem build e sem dependência: abra `index.html` ou sirva a pasta com `python3 -m http.server`.
As duas bibliotecas de terceiros (animação e QR Code) ficam em `vendor/`, então o QR do cupom
e as animações funcionam mesmo com a loja sem internet.

## Movimento

As animações usam o [Motion](https://motion.dev), o Framer Motion na versão para DOM puro
(o sistema não tem React nem build). A regra é explicar o que mudou, nunca enfeitar:

- o fundo do item ativo do menu e da categoria **desliza** de um para o outro;
- o pedido **pula de coluna** na produção, e o pedido novo brilha uma vez para a cozinha ver;
- o preço do produto tocado **voa até o total** da comanda, e os números contam até o valor novo;
- a senha chamada pulsa no painel; o pedido fechado abre com o check sendo desenhado;
- as barras da gestão crescem a partir do zero quando a tela abre.

Quem pede menos movimento no sistema operacional não vê nenhuma animação, e tudo funciona igual.

## Numeração dos pedidos

A numeração é o maior número do dia mais um, por loja. Com o **agente da loja**, quem grava o
pedido é o agente, e ele não aceita número repetido: se dois caixas fecharem no mesmo segundo,
o segundo recebe o próximo número livre e a tela mostra o número que voltou do agente.

Sem o agente (link publicado ou arquivo aberto direto), dois caixas fechando no mesmo segundo
ainda podem repetir um número.

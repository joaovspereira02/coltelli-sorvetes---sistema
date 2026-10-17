# Prompt de design — Coltelli

## Marca

O logotipo da loja é a referência: marca circular azul-marinho com a colher de sorvete em
negativo, e o nome **Coltelli** em script, com SORVETES em caixa alta espaçada.

- Azul da marca: `#0F3571`. É a única cor de ação do sistema.
- No tema escuro ele clareia para `#7DA8EC`, com texto escuro por cima, porque o marinho
  original some no fundo preto.
- Os neutros puxam para o azul, nunca para o cinza puro nem para o roxo.
- O logotipo é azul sobre claro, então ele sempre aparece sobre uma placa clara — inclusive
  no tema escuro, como acontece no material impresso da loja.
- Os arquivos ficam em `img/marca.png` (só o símbolo) e `img/logotipo.png` (nome completo).

Use este texto como instrução para um redesign profissional do sistema.
Ele não é um pedido de "deixar bonito": é uma lista de decisões de produto.

---

## Contexto

Sistema de operação de uma sorveteria. Três públicos, três posturas de corpo diferentes:

| Tela | Quem usa | Como usa | O que não pode acontecer |
|---|---|---|---|
| Balcão | atendente | em pé, tablet, uma mão, fila esperando, mão úmida | errar o item, errar o troco, ter que procurar o produto |
| Produção | quem monta o pedido | no fundo da loja, lendo a 2–3 metros, mãos ocupadas | não perceber que entrou pedido; não saber qual está atrasado |
| Totem | cliente | sozinho, sem ninguém para explicar | travar sem saber o que fazer |
| Cardápio / Gestão / Ajustes | dono | sentado, com calma, no computador | mudar preço sem perceber o que mudou |

A mesma interface serve as quatro. O design tem que mudar de escala e de densidade
conforme a postura, não aplicar o mesmo cartão em tudo.

## Diagnóstico do que está errado hoje

1. **Hierarquia chapada.** Todo cartão tem a mesma borda, o mesmo raio, a mesma sombra.
   O olho não sabe onde pousar primeiro em nenhuma tela.
2. **Menu sem prioridade.** Seis itens com o mesmo peso, sendo que dois são usados o dia
   inteiro e quatro são ocasionais.
3. **O balcão não foi feito para pressa.** Sem busca de produto (cardápio grande vira
   rolagem), sem cálculo de troco no dinheiro, sem confirmação forte depois de fechar —
   só um aviso pequeno que some.
4. **A produção não é legível a distância.** Cartão branco com um fio colorido em cima.
   A três metros, o estado do pedido deveria ser a primeira coisa visível.
5. **Estado codificado só por cor.** Quem tem daltonismo, ou uma tela com brilho baixo no
   sol, perde a informação.
6. **Escala tipográfica improvisada.** Tamanhos soltos em vez de uma escala; espaçamentos
   sem ritmo fixo.
7. **Alvo de toque no mínimo aceitável.** 44–46 px serve para app de celular, não para
   balcão com fila e mão molhada.
8. **Contraste do texto terciário abaixo do exigido** para leitura confortável.

## O que o redesign deve entregar

### Sistema, não enfeite
- Escala de espaçamento de 4 px e escala tipográfica fechada. Nada de tamanho avulso.
- Elevação com intenção: superfície plana para conteúdo, borda para agrupar,
  sombra só para o que flutua (modal, aviso).
- Papéis semânticos de cor separados da cor da marca. Verde, âmbar e vermelho só
  comunicam estado, nunca decoram.
- Contraste mínimo de 4,5:1 para texto e 3:1 para elemento de interface, nos dois temas.

### Arquitetura da informação
- Separar o menu em **Operação** (o que roda o dia todo) e **Loja** (o que se mexe de vez
  em quando). Rótulo de grupo pequeno, em caixa alta.
- Uma ação primária por tela, visualmente inconfundível. O resto é secundário.

### Balcão
- Busca de produto no topo do catálogo, filtrando todas as categorias.
- Ladrilhos maiores, com o preço em destaque e o nome legível de relance.
- Rodapé da comanda com o total dominante e o botão de fechar com no mínimo 60 px.
- **Dinheiro pede troco**: ao escolher dinheiro, teclado para o valor recebido e o troco
  calculado grande na tela. É o erro mais caro do balcão.
- **Confirmação forte**: depois de fechar, uma tela com o número do pedido em tamanho
  grande, o total e o troco — é isso que o atendente fala em voz alta para o cliente.
  Sai com um toque ou sozinha em alguns segundos.

### Produção
- O cartão inteiro carrega o estado: fundo levemente tingido e faixa lateral forte.
- Número do pedido e cronômetro em tamanho de leitura a distância.
- Estado também por escrito — "no prazo", "atenção", "atrasado" — nunca só pela cor.
- **Modo cozinha**: esconde o menu e aumenta tudo, para a TV do fundo.
- Aviso sonoro com liga/desliga guardado no aparelho.

### Totem
- Escala de cliente: nada abaixo de 1 rem, botão principal com 68 px.
- Sempre um caminho de volta visível.

### Primeiros passos
- Enquanto a loja não vendeu nada, mostrar uma trilha curta do que falta fazer,
  com o que já está feito marcado. Some sozinha depois da primeira venda.

### Acessibilidade
- Foco visível em tudo que recebe teclado.
- Avisos anunciados por leitor de tela.
- Estado nunca só por cor.
- Animação respeitando quem pediu menos movimento.

## Como avaliar se funcionou

- Um atendente novo fecha o primeiro pedido sem ninguém explicar.
- Dá para ler o estado da fila da produção a três metros, de relance.
- O troco nunca é calculado de cabeça.
- Nenhuma tela mostra número que não veio de venda real.
- Em cada tela, a pergunta "o que eu faço aqui?" tem uma resposta óbvia.

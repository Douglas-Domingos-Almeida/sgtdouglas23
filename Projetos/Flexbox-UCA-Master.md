# Registro de módulos Flexbox – UCA Master

Este documento registra os principais contentores em que a abordagem Flexbox foi decisiva para o alinhamento, espaçamento e organização interna dos elementos da interface.

## 1. `site-header`
**Objetivo:** estruturar o cabeçalho principal da página.

**Propriedades aplicadas:**
- `display: flex;`
- `align-items: center;`
- `justify-content: space-between;`
- `gap: 30px;`
- `padding: 18px 7%;`
- `flex-wrap: wrap;` (em breakpoints menores)

**Função:** mantém o logo, navegação e botão principal alinhados horizontalmente, com resposta adequada em telas menores.

## 2. `header-actions`
**Objetivo:** agrupar os elementos do topo em um conjunto de navegação e ação.

**Propriedades aplicadas:**
- `display: flex;`
- `align-items: center;`
- `gap: 28px;`
- `justify-content: center;`
- `flex-wrap: wrap;`

**Função:** controla o alinhamento da navegação, botão de menu e CTA do cabeçalho, mantendo boa distribuição espacial.

## 3. `main-nav`
**Objetivo:** organizar os links principais da navegação.

**Propriedades aplicadas:**
- `display: flex;`
- `align-items: center;`
- `gap: 30px;`
- `flex-wrap: wrap;`

**Função:** distribui os itens de menu de forma uniforme, com boa leitura em desktop e adaptação em telas médias.

## 4. `nav-link`
**Objetivo:** estilizar cada item do menu como elemento de navegação.

**Propriedades aplicadas:**
- `display: inline-flex;` (quando necessário em contexto de interação)
- `padding: 8px 0;`
- `transition: all 0.3s ease;`

**Função:** embora seja um item individual, o comportamento visual do link é reforçado pelo alinhamento do container pai em Flexbox.

## 5. `hero-actions`
**Objetivo:** organizar os botões de ação do componente principal da landing page.

**Propriedades aplicadas:**
- `display: flex;`
- `gap: 14px;`
- `align-items: center;`
- `flex-wrap: wrap;`

**Função:** mantém o CTA e ações complementares alinhados e responsivos.

## 6. `hero-stats`
**Objetivo:** dispor indicadores visuais ligados à paixão pelo atletismo Master.

**Propriedades aplicadas:**
- `display: flex;`
- `align-items: center;`
- `gap: 14px;`
- `flex-wrap: wrap;`
- `margin-top: 30px;`

**Função:** permite que os cartões de estatística preencham o espaço de forma uniforme, sem quebrar o layout em telas menores.

## 7. `intro-feature-list`
**Objetivo:** alinhar os destaques de missão e valores da UCA Master.

**Propriedades aplicadas:**
- `display: flex;`
- `gap: 12px;`
- `flex-wrap: wrap;`
- `margin-top: 26px;`

**Função:** distribui os itens de destaque com encaixe automático, mantendo a leitura visual limpa mesmo quando há mais elementos.

## 8. `feature-item`
**Objetivo:** compor cada item da lista de atributos da organização.

**Propriedades aplicadas:**
- `display: flex;`
- `align-items: center;`
- `gap: 8px;`
- `padding: 10px 16px;`

**Função:** alinha ícone e texto em uma linha horizontal, preservando consistência visual.

## 9. `contact-grid`
**Objetivo:** distribuir os blocos de contato em uma linha de cartões informativos.

**Propriedades aplicadas:**
- `display: grid;`  
- `grid-template-columns: repeat(3, minmax(180px, 1fr));`
- `gap: 20px;`

**Função:** embora o `Grid` tenha sido usado na organização geral, a estrutura interna dos cartões também pode se comportar de maneira flexível em breakpoints menores, com перераçamento em linha e `flex-wrap`.

## 10. `contact-card`
**Objetivo:** compor cada cartão de informação de contato.

**Propriedades aplicadas:**
- `display: flex;`
- `align-items: center;`
- `gap: 16px;`
- `min-height: 170px;`

**Função:** alinha visualmente o ícone e o texto, criando uma composição estável e de fácil leitura.

## 11. `cadastro-article`
**Objetivo:** organizar o bloco de chamada para cadastro.

**Propriedades aplicadas:**
- `display: grid;`
- `grid-template-columns: 1fr 280px;`
- `align-items: center;`
- `gap: 40px;`

**Função:** apesar do uso do Grid, a composição interna também se apoia em alinhamentos horizontais e verticais para manter textos e cartão secundário em equilíbrio.

## 12. `floating-card`
**Objetivo:** destacar um valor esportivo da UCA no bloco de cadastro.

**Propriedades aplicadas:**
- `display: flex;`
- `flex-direction: column;`
- `align-items: center;`
- `justify-content: center;`

**Função:** centraliza o conteúdo em coluna, garantindo descrição visual clara e organizada do numero/label do item destaque.

## 13. `site-footer`
**Objetivo:** alinhar o texto final do rodapé.

**Propriedades aplicadas:**
- `display: block;`
- `text-align: center;`

**Função:** apesar de não ser um container Flexbox principal, sua composição visual fica consistente com o restante do sistema de alinhamento do template.

## Conclusão

O uso do Flexbox foi essencial em pontos estratégicos da interface para garantir alinhamento visual, distribuição homogênea de itens, adaptação responsiva e melhor usabilidade. Containers como cabeçalho, navegação, botões de ação, listas de destaques e cards de contato foram os principais módulos em que a técnica foi aplicada com maior impacto.

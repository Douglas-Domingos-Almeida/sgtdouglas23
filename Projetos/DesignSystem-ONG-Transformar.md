# Design System – ONG Transformar

## 1. Visão geral

O Design System da ONG Transformar foi estruturado para garantir consistência visual, manutenção simplificada e reutilização entre telas. Ele centraliza as decisões de design em variáveis CSS, facilitando ajustes em toda a interface sem perder coerência estética.

A identidade visual prioriza confiança, acolhimento, educação e solidariedade, com uma linguagem moderna, clara e acessível.

## 2. Princípios do sistema

- Consistência visual em todas as páginas
- Reuso de componentes e estilos
- Legibilidade e acessibilidade
- Tom institucional voltado à educação e ao impacto social
- Flexibilidade para adaptação em diferentes dispositivos

## 3. Paleta cromática

A paleta utiliza cores primárias, secundárias e neutras para sustentar a experiência visual.

### 3.1 Cores principais

- Verde profundo: `#173f37`
  - Uso: cabeçalhos, fundos de destaque, elementos institucionais
- Verde principal: `#1d6b52`
  - Uso: botões principais, destaques de CTA, elementos interativos
- Verde escuro: `#114e3f`
  - Uso: hover, variações de profundidade e contraste
- Verde suave: `#eef8f3`
  - Uso: fundos leves, blocos de apoio, áreas de destaque

### 3.2 Cores secundárias

- Azul institucional: `#0878d1`
  - Uso: labels, destaques e indicadores de categoria
- Azul claro: `#eaf6fb`
  - Uso: fundos suaves para elementos informativos
- Azul brilhante: `#b4dffd`
  - Uso: detalhes e realces de suporte visual

### 3.3 Tons neutros

- Branco: `#ffffff`
  - Uso: base visual, cartões, fundo de conteúdo
- Cinza claro: `#f8fafb`
  - Uso: superfícies secundárias e fundos gerais
- Texto principal: `#26332f`
  - Uso: textos de corpo e títulos
- Texto secundário: `#53615c`
  - Uso: textos complementares e legendas
- Borda: `#b5c9e8`
  - Uso: contornos e separadores
- Laranja de destaque: `#f2b544`
  - Uso: foco visual, destaques e acentos de atenção

### 3.4 Tokens CSS da paleta

```css
:root {
  --navy: #173f37;
  --green: #1d6b52;
  --green-dark: #114e3f;
  --green-soft: #eef8f3;
  --blue: #0878d1;
  --blue-soft: #eaf6fb;
  --blue-bright: #b4dffd;
  --border: #b5c9e8;
  --text: #26332f;
  --paper: #ffffff;
  --paper-soft: #f8fafb;
  --muted: #53615c;
  --orange: #f2b544;
}
```

## 4. Tipografia

A tipografia define a linguagem textual do sistema e foi organizada em níveis hierárquicos para leitura clara e impacto visual.

### 4.1 Escala tipográfica

- XS: `0.75rem` — micro labels e legendas
- SM: `0.875rem` — detalhes, meta informações
- Base: `1rem` — texto principal
- LG: `1.125rem` — subtítulos e blocos de destaque
- XL: `1.5rem` — textos médios
- 2XL: `2rem` — títulos menores
- 3XL: `clamp(2.5rem, 3vw, 3rem)` — subtítulos principais
- 4XL: `clamp(3.2rem, 5vw, 4.375rem)` — títulos de destaque
- 5XL: `clamp(3.125rem, 5.2vw, 4.375rem)` — hero headings

### 4.2 Atributos tipográficos

- Família tipográfica: Arial, Helvetica, sans-serif
- Altura de linha base: `1.6`
- Altura de linha condensada: `1.15`
- Peso principal: 700 a 800
- Espaçamento de letras em labels: `0.14em`

### 4.3 Tokens CSS de tipografia

```css
:root {
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.5rem;
  --font-size-2xl: 2rem;
  --font-size-3xl: clamp(2.5rem, 3vw, 3rem);
  --font-size-4xl: clamp(3.2rem, 5vw, 4.375rem);
  --font-size-5xl: clamp(3.125rem, 5.2vw, 4.375rem);
}
```

## 5. Escala de espaçamento

O sistema utiliza uma escala modular baseada em múltiplos de 4, garantindo consistência entre componentes, grids e espaços internos.

### 5.1 Tokens de espaçamento

- `--space-1`: `0.25rem`
- `--space-2`: `0.5rem`
- `--space-3`: `0.75rem`
- `--space-4`: `1rem`
- `--space-5`: `1.25rem`
- `--space-6`: `1.5rem`
- `--space-7`: `1.75rem`
- `--space-8`: `2rem`
- `--space-10`: `2.5rem`
- `--space-12`: `3rem`
- `--space-16`: `4rem`
- `--space-20`: `5rem`

### 5.2 Uso recomendado

- Espaços pequenos: `--space-2` a `--space-6`
- Espaços de componentes: `--space-8` a `--space-12`
- Seções e blocos principais: `--space-16` a `--space-20`

## 6. Bordas e raio

- `--radius-xs`: `0.5rem`
- `--radius-sm`: `0.75rem`
- `--radius-md`: `1rem`
- `--radius-lg`: `1.25rem`
- `--radius-xl`: `1.75rem`
- `--radius-pill`: `999px`

Esses valores garantem consistência em botões, cards, imagens e blocos de conteúdo.

## 7. Componentes principais

### 7.1 Header / navegação

- Fundo escuro institucional
- Logo à esquerda
- Menu de navegação em destaque
- Botão primário em amarelo para ação de conversão

### 7.2 Hero section

- Layout com imagem + texto
- Título principal forte e de alto impacto
- CTA centralizado para conversão
- Fundo escuro para reforçar a identidade institucional

### 7.3 Cards e blocos informativos

- Superfícies brancas com bordas suaves
- Sombra leve para profundidade
- Cor principal em títulos e destaques
- Uso equilibrado de texto e espaço

### 7.4 Botões

- Primário: verde com texto claro
- Secundário: outline com verde
- CTA: amarelo para excelência de conversão

## 8. Diretrizes de acessibilidade

- Contraste adequado entre textos e fundos
- Foco visível em links e botões
- Uso de texto claro em áreas escuras
- Espaçamento suficiente para leitura e toque
- Elementos interativos com hover e estados visíveis

## 9. Observações de implementação

A implementação atual já segue o conceito deste Design System, com as variáveis concentradas em `:root` e aplicação consistente em toda a interface. Isso facilita manutenção, evolução visual e reaproveitamento em páginas futuras.

## 10. Conclusão

O Design System da ONG Transformar foi pensado para transmitir segurança, acolhimento e propósito social por meio de uma linguagem visual coesa. Sua abordagem em tokens CSS garante escala, padronização e eficiência de manutenção ao longo do projeto.

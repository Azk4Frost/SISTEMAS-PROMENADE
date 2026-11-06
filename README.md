# SISTEMAS-PROMENADE
Todas as minhas criações de sistemas da portaria e outros serviços pro clube promenade

## Desenvolvimento — Uniformes (páginas 01 a 05)

HTML5, CSS3, JavaScript em módulos ES6 e Tailwind CSS **compilado**, sem CDN.
O painel está em `PROMENADEHUB/sistemas/gestao_de_uniforme/index.html` e o formulário em `PROMENADEHUB/sistemas/gestao_de_uniforme/novo-emprestimo.html`.
As páginas anteriores e os outros módulos mantêm seus próprios estilos.

### Instalação, compilação e execução

Pré-requisitos: Node.js com npm (validados com Node 24.19.0 e npm 11.9.0) e Python 3 para servir arquivos por HTTP.
Na raiz do repositório, execute:

```sh
npm ci
npm run build:css
npm start
```

Abra `http://127.0.0.1:8000/sistemas/gestao_de_uniforme/` no computador local,
ou navegue pelo catálogo existente em `/sistemas.html` → **Gestão de Uniformes**.
Módulos JavaScript precisam de HTTP: não use `file://`.
Para recompilar o Tailwind durante edições, use `npm run watch:css` em outro terminal.
O CSS compilado também é versionado: a página entregue pode ser servida sem Node/npm no computador da portaria.
Após alterar HTML, JS ou `input.css`, recompile e inclua `styles.css` na entrega.

### Escopo e dados

- Painel com quatro cards de uniformes, indicadores, tabela, pesquisa por nome/matrícula e filtros combináveis de status, uniforme e período do empréstimo.
- **Novo Empréstimo**, **Enviar p/ Lavanderia** e **Receber da Lavanderia** abrem, respectivamente, as páginas 02, 03 e 04. Cada página tem seu próprio HTML.
- Os traços **—** representam valores indisponíveis; não significam zero. A tabela não contém dados de demonstração.
- Sem backend, autenticação, banco, `localStorage`, atualização em tempo real ou cálculos de estoque/ciclo nesta etapa. A página não afirma conexão com dados reais.
- `PROMENADEHUB/js/services/uniformes-service.js` centraliza o acesso a dados e documenta o contrato de apresentação para integração futura. Endpoints, permissões e regras operacionais ainda precisam ser definidos com o responsável.
- O ícone no canto superior direito retorna ao início; não realiza logout, pois não há autenticação.
- O logotipo existente é reutilizado. Os ícones são SVG locais. Nenhuma fonte adicional foi fornecida para esta referência; é usada a fonte de sistema Arial, sem dependência externa. Os outros módulos mantêm suas fontes atuais.

### Verificação

```sh
npm test
```

Os testes usam apenas o runner nativo do Node; as fixtures são exclusivas de teste e não entram na aplicação.
Cobrem pesquisa por nome/matrícula, acentos, combinação de filtros, datas inclusivas,
período inválido, resultados vazios e serviço sem backend.

Para aceitação da página:

1. Confirme aparência, nomes e proporções com a referência 01. Contadores devem mostrar **—** e a tabela deve informar a integração pendente.
2. Abra **Ver Filtros**, combine campos, informe uma data final anterior à inicial e confira a validação. **Limpar filtros** deve limpar também pesquisa e status.
3. Abra **Receber da Lavanderia** e confira o retorno ao painel. Nos diálogos das páginas 02 a 04, teste Tab, Shift+Tab, Escape e retorno do foco ao elemento de origem.
4. Confira o acesso pelo catálogo, a navegação para **Novo Empréstimo** e o retorno ao início. As páginas de envio e recebimento estão ligadas ao painel.
5. Confira desktop, tablet e celular. Com registros, a tabela deve permitir rolagem horizontal própria, sem expandir a página.

Operações reais, persistência e indicadores só poderão ser validados após a integração com o backend.

### Página 02 — Novo Empréstimo

No painel, clique em **Novo Empréstimo**, ou abra o caminho
`/sistemas/gestao_de_uniforme/novo-emprestimo.html` no servidor local.
A mesma compilação (`npm run build:css`) atende às duas páginas. Os estilos personalizados
da página 02 estão isolados em `novo-emprestimo.css`, sem alterar a aparência do painel aprovado.

O formulário reúne data, funcionário, setor, responsável, tipo/cor/tamanho da peça,
quantidade, condição e observação. A data inicial usa o fuso `America/Sao_Paulo`;
não há restrições de negócio sobre datas. Cadastros, variações, condições e saldos
devem vir do serviço; não são preenchidos com nomes ou estoque fictícios.
O serviço documenta o contrato para a integração futura.

Com cadastros disponíveis, é possível adicionar, editar e remover itens **somente do
formulário ainda não registrado**. O resumo conta as linhas e quantidades digitadas,
sem reservar peças, descontar estoque, definir limites por funcionário, mesclar itens
ou alterar o ciclo. Cores e tamanhos são filtrados pelas variações cadastradas.
Remover um item e sair com alterações exigem confirmação. Escape cancela a confirmação.

**Não há persistência nesta etapa.** A página não usa `localStorage`, `sessionStorage`
ou banco temporário. Fechar/recarregar a página descarta o preenchimento após o aviso
de saída do navegador. **Salvar rascunho** e **Registrar Empréstimo** recusam a operação
com uma mensagem explícita de integração pendente; nunca informam sucesso. Preenchimento
e itens permanecem intactos ao fechar esse aviso. As regras de autorização, disponibilidade,
rascunhos, códigos e registro efetivo precisam ser alinhadas antes da integração.

Validação manual da página 02:

1. Confirme formulário e coluna de resumo com a referência 02, nos tamanhos desktop e celular.
2. Sem backend, confirme seletores indisponíveis, tabela vazia e ausência de saldos presumidos.
3. Teste os avisos de **Adicionar Item**, **Salvar rascunho** e **Registrar Empréstimo**.
4. Digite uma observação, tente cancelar e escolha **Continuar editando**. O texto deve permanecer.
5. Confirme o descarte para retornar ao painel. O link **Novo Empréstimo** deve abrir o formulário novamente.

`npm test` inclui testes do modelo da página 02 e regressão dos filtros da página 01.
As validações de itens com cadastros são exercitadas com fixtures exclusivas de teste,
sem torná-las disponíveis na aplicação. O registro de um empréstimo real permanece não testável
até a integração com o backend.

Arquivos adicionados na página 02:

```text
PROMENADEHUB/sistemas/gestao_de_uniforme/novo-emprestimo.html
PROMENADEHUB/sistemas/gestao_de_uniforme/novo-emprestimo.css
PROMENADEHUB/sistemas/gestao_de_uniforme/novo-emprestimo.js
PROMENADEHUB/js/modules/novo-emprestimo-model.js
tests/novo-emprestimo.test.js
```

Arquivos atualizados nesta etapa: `README.md`, `tailwind.config.cjs`,
`PROMENADEHUB/assets/icons/ui.svg`, `PROMENADEHUB/js/components/dialog.js`,
`PROMENADEHUB/js/services/uniformes-service.js`,
`PROMENADEHUB/sistemas/gestao_de_uniforme/index.html` (link para a nova página),
`PROMENADEHUB/sistemas/gestao_de_uniforme/app.js` (texto dos destinos pendentes) e
`PROMENADEHUB/sistemas/gestao_de_uniforme/styles.css` (recompilação).


### Página 03 — Enviar para a Lavanderia

No painel, clique em **Enviar p/ Lavanderia**. O caminho no servidor local é
`/sistemas/gestao_de_uniforme/enviar-lavanderia.html`. A instalação e a execução
continuam iguais: `npm ci`, `npm run build:css` e `npm start`, na raiz.
A página reutiliza os componentes visuais existentes e o diálogo acessível;
seus ajustes próprios estão em `enviar-lavanderia.css`.

A tabela permite seleção individual e de todos os itens **elegíveis**. O checkbox
principal indica seleção parcial. O resumo conta as linhas selecionadas e os tipos
e funcionários distintos por ID. Esses valores representam somente a seleção,
não saldos operacionais. Cor, tamanho ou status não determinam elegibilidade:
ela deve ser explicitamente fornecida pelo backend para cada item. Peças não
elegíveis permanecem visíveis e não selecionáveis, com explicação em texto.

Não há registros fictícios na página. Sem backend, há estado vazio com integração
pendente e a confirmação fica desabilitada. Com dados disponíveis, a seleção
habilita **Confirmar Envio**, mas o serviço atual recusa a gravação com aviso
explícito de integração pendente. Nenhum estoque ou status é alterado, e a seleção
é preservada. Não há persistência, armazenamento no navegador ou atualização em
tempo real. Permissões, elegibilidade atual e a operação efetiva deverão ser
revalidadas pelo servidor na etapa de integração; nenhuma regra de transição do
ciclo foi criada. Sair com itens selecionados exige confirmação de descarte.

Verificação manual:

1. Confira a aparência com a referência 03 e o link do painel para a nova página.
2. Sem backend, confira a mensagem de integração pendente, tabela vazia, resumo
   zerado e confirmação desabilitada. Cancelar deve retornar ao painel.
3. Com dados reais integrados futuramente, confira seleção individual/todos,
   estado parcial, linhas inelegíveis, resumo e rolagem horizontal no celular.
4. Teste os diálogos com Tab, Shift+Tab e Escape, e a confirmação de descarte.
5. Confirme que as páginas 01 e 02 continuam acessíveis.

`npm test` inclui a validação do contexto, elegibilidade explícita, resumo e
payload da seleção, além da recusa de envio sem backend. A validação no Chromium
usou fixtures exclusivas de teste para exercitar seleção, itens inelegíveis,
conteúdo externo seguro e erro de consulta com nova tentativa. Envio real,
movimentação de estoque e persistência continuam não testáveis sem backend.

Arquivos criados nesta etapa:

```text
PROMENADEHUB/sistemas/gestao_de_uniforme/enviar-lavanderia.html
PROMENADEHUB/sistemas/gestao_de_uniforme/enviar-lavanderia.css
PROMENADEHUB/sistemas/gestao_de_uniforme/enviar-lavanderia.js
PROMENADEHUB/js/modules/lavanderia-envio-model.js
tests/lavanderia-envio.test.js
```

Arquivos modificados: `README.md`,
`PROMENADEHUB/js/services/uniformes-service.js` (novos pontos de integração),
`PROMENADEHUB/sistemas/gestao_de_uniforme/index.html` (link para a página 03),
`PROMENADEHUB/sistemas/gestao_de_uniforme/app.js` (texto do único destino pendente) e
`PROMENADEHUB/sistemas/gestao_de_uniforme/styles.css` (recompilação do Tailwind).


### Página 04 — Receber da Lavanderia

No painel, clique em **Receber da Lavanderia**, ou abra o caminho
`/sistemas/gestao_de_uniforme/receber-lavanderia.html` pelo servidor HTTP local.
Os comandos permanecem `npm ci`, `npm run build:css` e `npm start`, na raiz.

A página segue a referência 04: acentos verdes, itens em retorno, data de envio,
status atual, resumo do recebimento e bloco de conferência. A lógica de seleção,
resumo, carregamento e diálogos é compartilhada com o envio, mantendo arquivos
HTML independentes. O painel agora possui links para as três páginas de operação;
os avisos antigos de página pendente foram removidos.

A consulta usa `loadLaundryReceiptItems`; a gravação futura fica centralizada em
`receiveUniformesFromLaundry`. O contrato de cada item inclui `sentDate` e a
**elegibilidade explícita para recebimento**, que deve vir do backend. Ela não é
inferida do status, da existência de um envio ou da seleção feita na página 03.
O servidor deverá validar novamente permissões e elegibilidade ao receber.

O resumo mostra itens selecionados e itens selecionados em retorno. O rótulo
**Após o recebimento** só apresenta o valor informado pelo backend no campo
`afterReceiptStatus.label`. Sem essa informação, mostra **Não informado**;
a tela não determina uma regra de limpeza ou transição de status.

**Sem backend, não há recebimento efetivo.** A página exibe integração pendente,
tabela vazia e botão desabilitado. Com itens disponíveis, selecionar habilita a
confirmação, mas o serviço atual recusa a gravação com mensagem explícita, sem
sucesso simulado. A seleção e os status apresentados são preservados. Nenhum saldo
é incrementado, nenhuma peça é marcada como limpa e nenhum registro é persistido.
Não há sincronização via `localStorage` ou armazenamento temporário entre páginas.
Sair com seleção exige confirmação de descarte.

Verificação manual:

1. Confirme visual, navegação e estado vazio com a referência 04.
2. Com dados reais integrados futuramente, selecione um item e depois todos;
   confira resumo, estado parcial e bloqueio das linhas inelegíveis.
3. Confira **Enviado em** e o status posterior fornecido pelo backend, sem presumir
   valores quando essas informações estiverem ausentes.
4. Confira o aviso de integração pendente ao confirmar, preservação da seleção,
   descarte ao cancelar, foco, Escape e rolagem horizontal no celular.
5. Confira a navegação das páginas 01 a 03, especialmente o envio após a extração
   do controlador comum de seleção.

Validação executada nesta etapa: compilação do Tailwind; 23 testes unitários;
Chromium nas páginas 03/04 com seleção individual/todos, seleção parcial, linhas
inelegíveis, resumo, conteúdo externo seguro, recusa de gravação, descarte,
falha de consulta com nova tentativa, sete larguras entre 320 e 1600 px e navegação
das páginas anteriores. Os dados usados nesses cenários são fixtures exclusivas
de teste, não registros adicionados à aplicação. Recebimento real e persistência
não foram testados porque ainda dependem do backend e das regras operacionais.

Arquivos criados na etapa 04:

```text
PROMENADEHUB/sistemas/gestao_de_uniforme/receber-lavanderia.html
PROMENADEHUB/sistemas/gestao_de_uniforme/receber-lavanderia.css
PROMENADEHUB/sistemas/gestao_de_uniforme/receber-lavanderia.js
PROMENADEHUB/js/components/laundry-selection.js
PROMENADEHUB/js/modules/lavanderia-selecao-model.js
tests/lavanderia-recebimento.test.js
```

Arquivos modificados nesta etapa:

```text
README.md
PROMENADEHUB/js/services/uniformes-service.js
PROMENADEHUB/js/modules/lavanderia-envio-model.js
PROMENADEHUB/sistemas/gestao_de_uniforme/enviar-lavanderia.js
PROMENADEHUB/sistemas/gestao_de_uniforme/index.html
PROMENADEHUB/sistemas/gestao_de_uniforme/app.js
PROMENADEHUB/sistemas/gestao_de_uniforme/styles.css
```


### Página 05 — Ver tudo

Na página 01, o botão azul **Ver tudo**, à direita dos controles da tabela, abre
`/sistemas/gestao_de_uniforme/todos-emprestimos.html`. Esse HTML independente
reproduz a composição do painel da referência 05: cabeçalho, quatro cards,
indicadores, pesquisa, filtros e listagem extensa. O botão **Voltar**, na mesma
posição, retorna à prévia da página 01.

A página 01 mostra uma prévia de até **seis registros**, na ordem recebida do
serviço. A página 05 mostra todos os resultados carregados, sem esse limite.
Pesquisa e filtros são aplicados **antes** do limite da prévia: registros após
a sexta posição também podem ser encontrados. O rodapé distingue resultados
exibidos, resultados dos filtros e total de registros carregados. Indicadores e
saldos continuam vindos do serviço, sem serem recalculados a partir dessa prévia.

Ao navegar entre **Ver tudo** e **Voltar**, pesquisa, status, tipo de uniforme e
período são preservados por parâmetros da URL (`q`, `status`, `uniform`, `start`,
`end`). O painel de filtros abre quando há filtros adicionais recebidos na URL.
Não há `localStorage`, dados fictícios ou persistência operacional. **Ver Filtros**
continua disponível nas duas páginas.

As páginas compartilham `app.js` e o CSS compilado; cada uma mantém seu próprio
HTML. O atributo `data-loan-view` distingue a prévia da listagem completa.
As operações rápidas de empréstimo/estoque permanecem pendentes das regras e do
backend. **Ver tudo** se refere aos registros carregados pelo contrato atual de
`loadUniformesDashboard`; não é uma garantia sobre registros remotos não consultados.
Se a integração futura paginar a API, o serviço deverá obter o conjunto completo
ou implementar a navegação real do backend, sem apresentar uma página parcial como
se fosse a listagem completa.

Execução e verificação:

```sh
npm ci
npm run build:css
npm test
npm start
```

1. Abra a página 01 e clique em **Ver tudo**. Sem backend, confira a mensagem de
   integração pendente e os contadores indisponíveis, sem registros inventados.
2. Clique em **Voltar** e confira a navegação. A pesquisa e os filtros preenchidos
   devem acompanhar a ida e a volta; **Limpar filtros** limpa todos os campos.
3. Na integração futura com dados reais, confira até seis resultados na prévia e
   todos os resultados carregados na página 05. A pesquisa deve encontrar registros
   que estavam além da sexta posição.
4. Confira desktop e celular: a tabela preenchida tem rolagem horizontal própria
   e o botão permanece acessível.

Verificações executadas: Tailwind compilado, 23 testes existentes aprovados e
Chromium nas páginas 01/05 em sete larguras entre 320 e 1600 px. Os cenários com
13 registros, busca após a sexta posição, filtros combinados, preservação de
parâmetros, datas inválidas, ausência de resultados, falha de consulta com nova
tentativa e navegação às páginas 02/03/04 usaram apenas fixtures exclusivas de
teste. Não foram adicionadas à aplicação.

Arquivo criado:

```text
PROMENADEHUB/sistemas/gestao_de_uniforme/todos-emprestimos.html
```

Arquivos modificados nesta etapa:

```text
README.md
PROMENADEHUB/sistemas/gestao_de_uniforme/index.html
PROMENADEHUB/sistemas/gestao_de_uniforme/app.js
PROMENADEHUB/sistemas/gestao_de_uniforme/input.css
PROMENADEHUB/sistemas/gestao_de_uniforme/styles.css
```

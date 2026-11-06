# SISTEMAS-PROMENADE

PROMENADE HUB — sistemas internos do clube. O módulo de **Uniformes** possui as cinco
páginas operacionais e uma tela de cadastros integradas a um backend local em **JavaScript/Node.js e SQLite**.
Os demais módulos mantêm o código anterior.

## Instalação e execução

Requer **Node.js 24 ou superior**; versão validada: 24.19.0, com npm 11.9.0.
Na raiz do repositório:

```sh
npm ci
npm run build:css
npm test
npm start
```

O servidor atende somente o computador local, na porta **8000**, com frontend e
API na mesma origem. Abra o endereço local no navegador e acesse **Sistemas →
Gestão de Uniformes**. Não use `file://` ou o servidor estático Python para as
operações: elas precisam do backend Node. Se houver outro servidor na porta,
encerre-o ou escolha outra porta com a variável `PORT`.

Nesta versão, conforme solicitado, **não há login**. O campo Responsável identifica
o nome escolhido no empréstimo, mas não é autenticação. O modo é para um computador,
sem acesso pela rede. O ícone superior direito retorna ao início.

O banco é criado automaticamente em `.data/promenade.sqlite`, fora da pasta pública
e ignorado pelo Git. Bancos e backups são recusados dentro da pasta pública,
inclusive quando o caminho passa por links simbólicos. Não há funcionários, uniformes ou saldos fictícios. No primeiro
uso, cadastre os dados reais pelo procedimento abaixo. O CSS compilado é versionado;
para apenas executar uma entrega já compilada, basta Node.js, sem Python ou serviços
externos. Durante a edição de estilos, use `npm run watch:css`.

### Uso no Windows 10 ou 11

Instale o Node.js 24 ou superior pelo site oficial, extraia a pasta completa do
projeto e abra **`Iniciar-Promenade.cmd`** na raiz. O arquivo verifica o Node e
inicia o servidor; abra no navegador o endereço exibido e mantenha a janela aberta.
Não é preciso instalar dependências para executar a entrega com CSS já compilado.
Se a porta estiver ocupada, encerre a outra instância antes de iniciar novamente.

Em atualizações, preserve `.data` e faça backup antes de trocar o código. Pare e
reinicie o servidor para carregar a nova versão. A migração 2 adiciona cadastros
versionados e saldos iniciais, preservando o estoque e os empréstimos anteriores.
O iniciador foi revisado neste ambiente Linux; a execução nativa no Windows ainda
precisa ser validada no computador da portaria.

Variáveis opcionais do processo:

| Variável | Uso |
| --- | --- |
| `PORT` | Porta local, padrão 8000 |
| `PROMENADE_DB_PATH` | Caminho do SQLite, padrão `.data/promenade.sqlite` na raiz do projeto |

Não é necessário fornecer credenciais ou serviços externos. Essas variáveis são
lidas do processo; o servidor não carrega arquivos `.env` automaticamente.

## Cadastros e estoque inicial

No painel de Uniformes, clique em **Cadastros**. A tela permite criar e editar
funcionários (quem recebe), responsáveis (quem entrega) e setores. Uma pessoa pode
ser cadastrada nas duas funções; isso não cria uma conta de acesso. Matrículas de
funcionários são únicas. Edições não reescrevem saldos e não há exclusão de registros.

Em **Uniformes e estoque**, selecione um modelo existente ou cadastre um novo,
informe cor e tamanho e distribua a contagem inicial entre:

- **Limpas disponíveis**: podem ser emprestadas imediatamente.
- **Com funcionários**: adicione quem recebeu e a quantidade de cada pessoa.
- **Sujas na portaria**: aguardam envio para a lavanderia.
- **Na lavanderia**: aguardam recebimento limpo.

O **total** é calculado pela soma das quatro situações. Para peças com funcionários,
quem entregou, setor e data original são opcionais quando desconhecidos. Não são
inventados nomes nem datas antigas. Sujas e peças já na lavanderia podem entrar
sem vínculo com um funcionário. Revise a contagem e confirme antes da gravação.
Uma combinação de modelo, cor e tamanho já existente não pode ser cadastrada de
novo para substituir o saldo; use **Repor limpas** para entradas adicionais.

Saldos anteriores aparecem como **Saldo inicial**, com código `INICIAL-`, e seguem
as mesmas devoluções e operações parciais da lavanderia. Não recriam empréstimos
históricos nem aumentam o indicador de empréstimos ativos: o painel informa
separadamente a quantidade inicial ainda com funcionários. Cadastros e saldos são
salvos no SQLite; campos ainda não confirmados não são gravados automaticamente.

### Alternativa por arquivo JSON

O comando local continua disponível para importar catálogos e saldo inicial
**somente limpo**. Para uma contagem com peças em outras situações, use a tela.
Crie um modelo vazio:


```sh
npm run manage -- template .data/cadastros.json
```

O comando gera um `operationId` único e listas vazias. Ele não sobrescreve um arquivo
existente. Preencha somente com dados reais; não coloque esse arquivo em `PROMENADEHUB`
ou no Git. O conteúdo de `.data` permanece ignorado.

Estrutura a preencher:

| Lista | Campos de cada registro |
| --- | --- |
| `sectors` | `id`, `label` (nome do setor) |
| `employees` | `id`, `name`, `registration` (matrícula única) |
| `responsibles` | `id`, `label` (nome do responsável) |
| `uniforms` | `id`, `label`, `icon`, `variants` |
| `uniforms[].variants` | `id`, `color`, `size`, `quantity` |

IDs são textos estáveis e únicos. Ícones aceitos: `apron`, `shirt-yellow`,
`shirt-white`, `pants`. Os quatro cards aprovados utilizam os IDs `avental`,
`camisa-amarela`, `camisa-branca` e `calca-azul`. Cores e tamanhos são cadastrados
explicitamente; não são presumidos a partir da imagem. Outros modelos podem ser
usados nos empréstimos e filtros, mas não geram novos cards de desenho automaticamente.

**`quantity` é a quantidade inicial de peças limpas disponíveis dessa variação.**
Não inclua peças já com funcionários, sujas ou na lavanderia como se estivessem
limpas disponíveis. Para cadastrar peças nessas situações, use a divisão de saldos na tela de
Cadastros. A importação JSON não cria empréstimos históricos.

Após preencher:

```sh
npm run manage -- import .data/cadastros.json
```

A operação é transacional: um erro impede a importação inteira. Repetir o mesmo
arquivo com o mesmo `operationId` não duplica estoque. Alterar o arquivo mantendo
esse identificador é recusado. Para uma nova importação, use um novo identificador.
IDs já cadastrados podem atualizar nomes e matrículas, mas não a identidade de
uma variação. Nessas variações existentes, informe `quantity: 0`: importação de
catálogo não é reposição e não deve substituir saldos operacionais.

### Reposição de peças limpas

Na tela de Cadastros, use **Repor limpas** na variação correspondente. Informe a
quantidade adicional e confirme; total e disponibilidade aumentam juntos.

Como alternativa pelo comando local, use outro arquivo JSON com `operationId` novo, `variantId` existente e `quantity`
inteiro positivo. Execute:

```sh
npm run manage -- stock-add .data/reposicao.json
```

O saldo total e o disponível aumentam juntos, com movimento de reposição registrado.
Repetir o mesmo arquivo e identificador não adiciona as peças duas vezes.
O navegador utiliza os endpoints locais de cadastro e reposição, com as mesmas
validações de origem e idempotência das demais operações.

## Regras de Uniformes aprovadas

O estoque é por **modelo, cor e tamanho**, não por etiqueta de peça individual:

1. Peça limpa disponível → empréstimo: diminui o saldo limpo e fica com o funcionário.
2. **Devolver sujo**: transfere a quantidade informada para peças sujas na portaria.
   Ainda não aumenta o saldo limpo disponível.
3. **Enviar p/ Lavanderia**: transfere somente a quantidade suja selecionada para a lavanderia.
4. **Receber da Lavanderia**: transfere a quantidade selecionada para concluída/limpa
   e aumenta o saldo disponível exatamente nessa quantidade.

Devoluções, envios e recebimentos podem ser **parciais**. A quantidade precisa ser
inteira, positiva e não ultrapassar o saldo da etapa. Não há limite por funcionário
presumido; o limite aplicado é o estoque disponível. Peças limpas são a única condição
permitida ao registrar empréstimo neste ciclo. Perdas, danos, devolução direta limpa,
cancelamento de empréstimo confirmado e ajustes negativos não fazem parte das regras
aprovadas e não foram criados silenciosamente.

Rascunhos podem estar incompletos, ficam no SQLite e **não reservam estoque**. São
reabertos em **Rascunhos salvos**, na página Novo Empréstimo. Depois de registrados,
saem da lista de rascunhos e recebem um código `EMP-` sequencial. Se faltar estoque ou
houver conflito entre janelas, o registro falha sem consumir o rascunho.

O backend valida cadastros, saldos e versões dentro de transações. Lotes inválidos
são revertidos por inteiro. Requisições repetidas com a mesma chave são idempotentes;
o cliente reutiliza a chave quando perde a resposta da operação. Versões impedem que
uma aba antiga processe novamente saldos já alterados por outra janela. Em caso de
resultado não confirmado, consulte o painel e use a repetição da mesma operação;
não presuma falha ou sucesso só por uma mensagem de conexão.

### Indicadores e histórico

- **Total** do card: total de peças cadastradas, incluindo as que estão fora da portaria.
- **Disponível**: peças limpas que podem ser emprestadas agora.
- **Em estoque**: peças limpas disponíveis mais as devolvidas sujas na portaria.
- **Empréstimos ativos**: empréstimos registrados no sistema com alguma quantidade
  ainda com funcionário; saldos iniciais são informados separadamente.
- **Devoluções (Hoje)**: quantidade de peças devolvidas sujas no dia de São Paulo.
- **Na lavanderia**: quantidade ainda não recebida de volta.
- **Estoque (Total Peças)**: soma das peças cadastradas, incluindo todos os modelos.

A tabela representa parcelas do ciclo: uma linha de empréstimo parcialmente
processada pode aparecer com saldos em mais de um status. As linhas limpas concluídas
ficam no histórico; não são uma segunda contagem do estoque disponível e não geram
novas peças. A data de envio da tabela é a do último envio daquele item; o histórico
de movimentos preserva os timestamps de todas as parcelas. Os registros guardam
quantidades e horários, sem atribuir autenticação a um operador nesta versão sem login.

## Páginas e operação

| Página | Caminho em `PROMENADEHUB/sistemas/gestao_de_uniforme/` |
| --- | --- |
| 01 — Painel | `index.html` |
| 02 — Novo Empréstimo | `novo-emprestimo.html` |
| 03 — Enviar para a Lavanderia | `enviar-lavanderia.html` |
| 04 — Receber da Lavanderia | `receber-lavanderia.html` |
| 05 — Ver tudo | `todos-emprestimos.html` |
| Cadastros | `cadastros.html` |

No painel, registre devoluções pelo botão **Devolver sujo** e informe a quantidade.
Os links rápidos de lavanderia levam à página correspondente com o item selecionado.
Nessas páginas, marque os itens e ajuste a quantidade de cada um antes de confirmar.
As mensagens de sucesso só aparecem após confirmação da gravação pelo servidor.
Após registrar, os saldos e a lista são consultados novamente.

O painel mostra até seis resultados; **Ver tudo** abre um HTML independente com todos
os resultados carregados. Pesquisa e filtros são aplicados antes desse limite e
acompanham ida/volta pela URL. Não há dados operacionais em `localStorage` ou
`sessionStorage`. Tabelas extensas têm rolagem horizontal própria.

## Backup e restauração

O GitHub armazena o código; **não é backup do SQLite**. Para gerar uma cópia consistente,
mesmo com o servidor em funcionamento, escolha um nome novo fora da pasta pública:

```sh
npm run manage -- backup .data/backups/copia-001.sqlite
```

O comando não sobrescreve destinos existentes. Copie também backups para outro
local/dispositivo para não depender do mesmo disco. Não faça backup copiando apenas
o arquivo de um banco aberto: SQLite pode ter alterações nos arquivos WAL/SHM.

Para restaurar, pare o servidor e preserve primeiro a pasta de dados atual. Use uma
cópia validada do backup em outro caminho e configure `PROMENADE_DB_PATH` para essa
cópia, mantendo os arquivos anteriores intactos. O servidor verifica o histórico de
migrações ao abrir. Não misture arquivos WAL/SHM antigos com o backup restaurado.
O teste automatizado de gestão faz backup, reabre a cópia e verifica a integridade e
os saldos preservados. Não há comando destrutivo de reset ou de sobrescrita do banco.

## API e organização

`GET /api/health` verifica o servidor e o SQLite. Operações principais:

| Método | Caminho |
| --- | --- |
| GET | `/api/uniformes/dashboard` |
| GET | `/api/uniformes/context` |
| GET | `/api/uniformes/catalog` |
| POST | `/api/uniformes/catalog/employees` |
| POST | `/api/uniformes/catalog/responsibles` |
| POST | `/api/uniformes/catalog/sectors` |
| POST | `/api/uniformes/stock/open` |
| POST | `/api/uniformes/stock/add` |
| GET / POST | `/api/uniformes/drafts` |
| GET | `/api/uniformes/drafts/:id` |
| POST | `/api/uniformes/loans` |
| POST | `/api/uniformes/returns` |
| GET / POST | `/api/uniformes/laundry/dispatch` |
| GET / POST | `/api/uniformes/laundry/receive` |

As escritas aceitam JSON com `X-Promenade-Request: 1` e `Idempotency-Key`; Host e
Origin são verificados para o servidor local. O corpo tem limite técnico de 128 KiB;
um lote tem até 500 linhas. Transições recebem `items: [{id, quantity, version}]`.
Esses contratos são consumidos por `PROMENADEHUB/js/services/uniformes-service.js`.

Código do servidor:

```text
server/index.js        # inicialização local
server/application.js  # HTTP, arquivos estáticos e erros
server/api.js          # rotas e validação de requisições
server/database.js     # abertura SQLite e migrações transacionais
server/schema.js       # esquema operacional versionado
server/uniformes.js    # regras, consultas, transações e idempotência
server/manage.js       # cadastro inicial, reposição e backup
server/private-path.js # proteção dos caminhos privados
```

Foram atualizados o serviço de dados, o controlador compartilhado de lavanderia,
o modelo de seleção e os módulos das páginas 01/02/04. Adaptações necessárias nas
telas: devolução por quantidade, quantidades parciais na lavanderia, lista de
rascunhos e mensagens reais de gravação. HTML, CSS e JavaScript permanecem separados;
Tailwind continua compilado, sem Play CDN, React ou outros frameworks.

## Testes e validação

```sh
npm test
```

**50 testes** validados no ambiente Linux com Node 24.19.0. Cobrem migrações,
persistência, restrição de arquivos, API, saldo insuficiente, ciclo parcial, lotes
atômicos, versões desatualizadas, idempotência, duas conexões ao SQLite, rascunhos,
cadastro, reposição, backup/restauração, filtros e cliente HTTP. A cobertura inclui
migração do banco anterior, edição concorrente, matrícula duplicada, saldo inicial
nas quatro situações, conservação de estoque e rejeição de corpo acima do limite.

Também foi executado o fluxo pelas cinco telas no Chromium contra a API e SQLite
reais de uma instância isolada: rascunho reaberto, perda de resposta após gravação,
retry sem duplicar empréstimo, devolução de 2/5 peças, envio de 1/2, recebimento de 1
e conclusão das parcelas restantes. O saldo voltou às 10 peças iniciais, sem criar
ou perder estoque. Quantidades inválidas, conteúdo externo e responsividade foram
verificados. Os dados eram exclusivamente de teste, em banco temporário; **não foram
importados no banco operacional**. Windows, dados reais e a rotina da portaria ainda
precisam de validação no computador de destino.

A tela de Cadastros também foi exercitada no Chromium: criação e edição de pessoas,
setor, saldo inicial de 10 peças distribuídas entre as quatro situações, retorno e
lavanderia até voltar a 10 limpas e reposição de mais 2. Foram conferidos navegação
por teclado, confirmações, recarga e cinco larguras de tela entre 320 e 1440 pixels.
Esses registros também ficaram exclusivamente em um banco temporário de teste.

Para aceitação com os dados reais, cadastre a contagem inicial por situação e
acompanhe um empréstimo, uma devolução e a lavanderia parciais, verificando o saldo
em cada etapa. Confirme também abertura de rascunho depois de reiniciar o servidor
e a cópia de backup. O sistema inicia vazio até esses cadastros serem fornecidos.

## Arquivos da tela de Cadastros e preparação para Windows

Caminhos relativos à raiz do repositório.

Novos:

```text
.gitattributes
Iniciar-Promenade.cmd
PROMENADEHUB/sistemas/gestao_de_uniforme/cadastros.html
PROMENADEHUB/sistemas/gestao_de_uniforme/cadastros.css
PROMENADEHUB/sistemas/gestao_de_uniforme/cadastros.js
tests/uniformes-catalog.test.js
```

Modificados:

```text
PROMENADEHUB/js/modules/lavanderia-selecao-model.js
PROMENADEHUB/js/services/uniformes-service.js
PROMENADEHUB/sistemas/gestao_de_uniforme/app.js
PROMENADEHUB/sistemas/gestao_de_uniforme/index.html
PROMENADEHUB/sistemas/gestao_de_uniforme/todos-emprestimos.html
server/api.js
server/index.js
server/schema.js
server/uniformes.js
README.md
```

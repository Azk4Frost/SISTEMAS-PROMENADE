# SISTEMAS-PROMENADE
Todas as minhas criações de sistemas da portaria e outros serviços pro clube promenade

## Desenvolvimento — Uniformes (páginas 01 e 02)

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
- **Novo Empréstimo** abre a página 02. **Enviar p/ Lavanderia** e **Receber da Lavanderia** continuam com avisos de página pendente, sem apontar para arquivos inexistentes.
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
3. Abra os dois avisos das páginas de lavanderia pendentes; feche por **Entendi**, botão de fechar e **Escape**. Confira que o foco volta ao botão de origem e que Tab permanece no diálogo aberto.
4. Confira o acesso pelo catálogo, a navegação para **Novo Empréstimo** e o retorno ao início. Nenhuma página de lavanderia foi criada.
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

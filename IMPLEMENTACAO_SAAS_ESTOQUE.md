# Financeiro SaaS + Estoque — Implementação preparada para IA Studio

Este pacote parte do ZIP `sistema-de-contas-a-pagar (28)` e foi alterado de forma **aditiva e compatível com os dados atuais**. A empresa que já utiliza o Financeiro não deve ter documentos antigos apagados, renomeados ou recriados.

## 1. Compatibilidade com a empresa atual

- O modelo antigo usa `userId` para separar os dados.
- O novo modelo acrescenta `companyId` sem remover `userId`.
- No primeiro login da conta existente, o usuário é tratado como empresa **legacy**:
  - `companyId = uid` do proprietário atual;
  - `role = owner`;
  - `plan = legacy`;
  - acesso sem expiração.
- Um processo de migração aditiva acrescenta `companyId` aos documentos antigos de `entries`, `suppliers`, `employees` e `incomes`.
- Os IDs antigos do Firestore são preservados.
- Novos documentos usam IDs automáticos do Firestore; `firestoreId` é mantido no estado do app para permitir que usuários diferentes editem o mesmo documento.

## 2. SaaS / acesso

### Novos usuários

- Conta nova: teste grátis de 7 dias.
- Documento `companyAccess/{companyId}` controla o acesso.
- Estados previstos: `legacy`, `trial`, `active`, `expired`, `suspended`.
- Planos previstos: `legacy`, `trial`, `monthly`, `annual`.
- Após o vencimento, o login continua possível, mas o Financeiro fica bloqueado e os dados permanecem preservados.

### Pagamento

O pagamento será manual via PIX. O segundo aplicativo administrativo (a ser criado separadamente) deverá atualizar `companyAccess` para liberar mensal/anual.

Exemplo de liberação mensal/anual pelo Admin:

```text
companyId: <id da empresa>
status: active
plan: monthly | annual
accessUntil: <Firestore Timestamp>
updatedAt: <timestamp>
updatedBy: <uid admin>
```

### Multiusuário

- Cada usuário possui `users/{uid}.companyId` e `role`.
- Usuários com o mesmo `companyId` veem os mesmos dados.
- Papéis preparados: `owner`, `finance`, `viewer`.
- O segundo aplicativo Admin será responsável por associar outros usuários à empresa e administrar acessos.

## 3. Auditoria

Coleção: `auditLogs`.

Registra ações do Financeiro e do Estoque/NF-e com:

- empresa (`companyId`);
- usuário (`actorUid`, `actorEmail`);
- data/hora;
- ação;
- entidade;
- descrição;
- alterações relevantes.

`auditLogs` é append-only nas regras: o cliente pode criar, mas não editar/apagar histórico.

## 4. Controle de estoque

Menu novo: **Estoque**.

Cadastro do produto:

- Código interno da empresa (único por empresa);
- Descrição;
- Local;
- Unidade;
- PT — Ponto de Transferência;
- LT — Lote de Transferência;
- Saldo atual;
- Situação.

### Regra oficial de compra

```text
Quantidade ideal = PT + LT
```

A compra é sinalizada **somente** quando:

```text
Saldo atual < PT
```

Quando a compra é necessária:

```text
Quantidade sugerida = (PT + LT) - Saldo atual
```

Se `Saldo atual >= PT`, o item fica **Dentro do parâmetro**, mesmo que esteja abaixo de `PT + LT`.

### Saldo

O saldo não é digitado diretamente. Ele é consequência das movimentações:

- `ENTRY` — entrada;
- `OUT` — saída;
- `ADJUSTMENT` — ajuste positivo/negativo;
- `REVERSAL` — estorno.

A atualização de saldo e a criação do movimento são feitas em transação Firestore.

### PDF para Compras

O botão **PDF para Compras** inclui somente produtos com `Saldo atual < PT` e mostra:

- código;
- descrição;
- local;
- unidade;
- PT;
- LT;
- ideal (`PT + LT`);
- saldo atual;
- quantidade sugerida para compra.

## 5. Importação manual de NF-e

Fluxo:

1. Usuário faz upload manual do XML.
2. XML é lido no navegador.
3. O arquivo XML **não é armazenado** no Firebase.
4. O usuário confere os dados.
5. Seleciona o fornecedor já cadastrado.
6. Parcelas do XML geram lançamentos no Financeiro.
7. Usuário marca manualmente quais itens movimentam estoque e associa cada item marcado a um produto interno.
8. Confirma a importação.

### Dados extraídos

- Chave da NF-e;
- Número/série;
- Emitente/CNPJ;
- Data de emissão;
- Valor total;
- duplicatas/parcelas: número, vencimento e valor;
- itens: código do fornecedor, descrição, unidade, quantidade e valores.

Não são necessários linha digitável, código de barras ou número bancário do boleto.

### Financeiro

Cada parcela criada em `entries` recebe referência à NF:

- `source: nfe`;
- `nfeId`;
- `nfeKey`;
- `installmentNumber`;
- `nfNumber`.

Se o XML não possuir duplicatas com vencimento, nenhuma conta é inventada; a NF ainda pode movimentar estoque.

### Duplicidade

A NF recebe ID determinístico baseado em empresa + chave da NF (ou fallback de dados principais). Uma NF já importada não pode ser importada novamente.

## 6. Cancelamento manual de NF

O cancelamento **não usa XML de cancelamento**.

Fluxo:

1. Usuário escolhe o fornecedor;
2. informa o número da NF;
3. informa motivo/observação opcional;
4. confirma o cancelamento.

A NF nunca é apagada. O status vira `CANCELLED` e `reviewRequired = true`.

O sistema mostra os impactos:

- parcelas financeiras vinculadas;
- entradas de estoque vinculadas;
- quantidade de parcelas já pagas.

### Parcelas

- Parcelas abertas podem ser marcadas como canceladas, sem exclusão.
- Parcelas já pagas permanecem para revisão.

### Estoque

- A entrada original nunca é apagada.
- O estorno cria movimento inverso `REVERSAL`.
- Se o saldo atual for menor que a quantidade original daquela entrada, o estorno automático é bloqueado e exige revisão manual.

## 7. Coleções adicionadas

- `products`
- `stockMovements`
- `nfe`
- `nfeItems`
- `auditLogs`
- `companyAccess`
- `admins` (controle administrativo futuro)
- `companies` (reservada para evolução do SaaS)

Coleções existentes permanecem:

- `entries`
- `suppliers`
- `employees`
- `incomes`
- `users`

## 8. Regras do Firestore

O arquivo `firestore.rules` deste pacote já contém as novas regras.

Uma cópia idêntica para colar manualmente no console está em:

`FIRESTORE_RULES_PARA_COLAR.txt`

### Transição segura

As regras possuem compatibilidade temporária com a empresa existente baseada em `userId`. Isso permite que os documentos antigos continuem acessíveis enquanto o primeiro login na versão nova cria `companyId` e `companyAccess`.

**Importante:** após publicar estas regras, novos cadastros devem ser feitos pela versão nova do aplicativo. O cadastro legado do app antigo não cria a estrutura de trial necessária.

## 9. Admin futuro

O painel de gestão de acessos NÃO está incluído neste ZIP. Ele será um segundo aplicativo.

Ele deverá:

- listar empresas/clientes;
- visualizar trial/plano/vencimento;
- liberar mensal/anual após PIX;
- suspender/reativar;
- registrar pagamentos;
- associar usuários à mesma empresa;
- manter histórico de ações administrativas.

Para autorizar o Admin, deverá existir manualmente um documento:

`admins/{UID_DO_ADMIN}`

As regras não permitem que o próprio cliente se torne admin.

## 10. Validação ao importar na IA Studio

Executar:

```bash
npm install --no-package-lock
npm run lint
npm run build
```

Checklist funcional recomendado:

1. Login da empresa atual e conferência de todos os dados existentes.
2. Confirmar que `companyAccess/{uid}` foi criado como `legacy`.
3. Confirmar backfill de `companyId` sem alteração dos IDs antigos.
4. Criar produto e fazer entrada/saída/ajuste.
5. Testar regra `Saldo < PT` e quantidade sugerida até `PT + LT`.
6. Gerar PDF para Compras.
7. Importar XML de NF-e de teste.
8. Confirmar parcelas no Financeiro.
9. Selecionar itens para estoque e conferir saldo/movimentos.
10. Tentar importar a mesma NF novamente (deve bloquear).
11. Cancelar manualmente a NF e revisar parcelas/estoque.
12. Conferir Auditoria.
13. Criar uma conta nova e validar trial de 7 dias.

## 11. Observação de validação deste pacote

Foi realizada validação sintática e semântica TypeScript usando o compilador disponível no ambiente e os arquivos do projeto não apresentaram erros nessa checagem. O ambiente de edição não conseguiu concluir o download das dependências npm, portanto o build Vite final deve ser executado pela IA Studio conforme o checklist acima.

# Projeto UCA

## Banco de dados MySQL

O conteúdo do site (notícias, competições e depoimentos) é persistido em um banco MySQL local.
A autenticação consulta `ABRAM_SC.Associados`. Antes do primeiro uso,
crie o banco e um usuário dedicado no MySQL (como root):

```sql
CREATE DATABASE uca CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'uca_app'@'localhost' IDENTIFIED BY 'uma-senha-forte-local';
GRANT ALL PRIVILEGES ON uca.* TO 'uca_app'@'localhost';
FLUSH PRIVILEGES;
```

Depois, informe a senha ao backend com o assistente interativo (testa a conexão e salva a
configuração fora do repositório):

```powershell
npm run mysql:setup
```

Como alternativa manual, crie o arquivo `mysql.json` ao lado da configuração
administrativa (no Windows, `%LOCALAPPDATA%\Projeto UCA\mysql.json`):

```json
{ "password": "uma-senha-forte-local" }
```

Os demais campos (`host`, `port`, `database`, `user`, `tablePrefix`) são opcionais no mesmo
arquivo; os padrões são `127.0.0.1`, `3306`, `uca` e `uca_app`. As variáveis de ambiente
`MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` e
`MYSQL_TABLE_PREFIX` têm precedência sobre o arquivo, e `UCA_MYSQL_CONFIG_FILE` permite
apontar para outro caminho de configuração. Não versione esse arquivo nem compartilhe a senha.

Na primeira inicialização, a API cria as tabelas e importa uma única vez os dados legados de
`BackEnd/db.json` (marcador `legacy-json-import-v1`). Como alternativa, importe manualmente o
script gerado `BackEnd/uca-export.sql` com:

```powershell
mysql -u uca_app -p uca < BackEnd/uca-export.sql
```

Após a migração, o MySQL é a fonte de verdade do conteúdo; o `db.json` permanece apenas como
fonte da migração inicial.

## Importação de associados

Instale Python 3 e mantenha `imagens/Associados_ABRAM_SC.ods` fora de publicações e backups
públicos. O arquivo está ignorado pelo Git e bloqueado pelo servidor de desenvolvimento Vite;
outros servidores devem bloquear seu acesso separadamente. A planilha contém dados pessoais.

Com o MySQL configurado, use um usuário que possa criar o banco `ABRAM_SC` e criar e consultar
suas tabelas, além de acessar `uca`:

```powershell
npm --prefix BackEnd run associados:import
```

O importador lê a aba original com Python, preserva os quatro campos como texto e adiciona
`linha_planilha` para preservar a ordem. Linhas vazias dentro dos dados são preservadas;
as células vazias ilimitadas ao final da grade não são importadas. Se a tabela já existir,
o comando interrompe sem sobrescrevê-la. A API precisa de permissão de leitura nessa tabela.
Se a importação falhar após criar a tabela, ela permanecerá vazia; examine-a antes de tentar
novamente. Para outro arquivo, acrescente seu caminho após `--`.

## Resultados históricos de atletismo

O banco `atletismo_masters` é separado do banco `ABRAM_SC` usado no login do site.
Para um banco novo, crie o schema com `01_criar_banco_relacionado.sql` e confira
as FKs com `02_validar_relacionamentos.sql` pelo cliente MySQL. O script de criação
não atualiza tabelas já existentes; bancos antigos exigem migração revisada.

Para atualizar um banco existente, aplique `05_migrar_ajustes_3fn.sql` após revisar
o conteúdo e confirmar um backup. `tipo_medida` fica `NULL` até que uma regra confiável
classifique cada prova como tempo, distância ou pontos. O cruzamento de resultados
considera atletas ativos e inativos; o importador valida nomes normalizados repetidos
entre atletas inativos antes de continuar.

Os importadores usam a configuração local de MySQL descrita acima, mas conectam
exclusivamente ao banco `atletismo_masters` no servidor local. A conta deve ter
permissão de leitura e gravação nesse banco. Em PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-atletismo.txt
.\.venv\Scripts\python.exe 03_importar_associados.py
.\.venv\Scripts\python.exe 04_importar_resultados.py
.\.venv\Scripts\python.exe -m unittest test_importar_associados test_importar_resultados
```

O importador de associados informa separadamente quantos códigos BRA foram inseridos
e quantos já existiam e foram atualizados.

O primeiro script lê `Downloads\Associados_ABRAM_SC.ods`; datas ausentes, inválidas
ou fora de 1915–2005 são registradas como `NULL` com aviso. O segundo consulta a
API pública, subdividindo consultas que atinjam seu limite de 1.000 linhas; se
não for possível subdividir um grupo, ele interrompe antes de gravar os resultados.
A API não informa um total geral, portanto a completude depende dos filtros que
ela disponibiliza. Nenhum cadastro é criado automaticamente para nomes sem
correspondência.

Resultados ambíguos, datas incompletas e integrantes não identificados são enviados
para `stg_resultados_pendentes`. A coluna `ocorrencias` conserva repetições
indistinguíveis da fonte. Para pendências de correspondência individual e de
integrantes identificáveis, decisões `RESOLVIDO` com `codigo_bra_resolvido` e
`IGNORADO` são respeitadas nas execuções seguintes. Conflitos de resultados e
composições inválidas exigem tratamento manual. Equipes com composição incompleta
não aparecem para integrantes não identificados na
`vw_resultados_completos`. Revise as pendências antes de interpretar os totais.

## Iniciar o ambiente local

Após importar a planilha, inicie frontend e API juntos:

```powershell
npm run dev
```

Em **Acesso UCA**, informe `D. NASC` e `BRA` exatamente como estão na planilha. Apenas o
registro cujo BRA é `ADMBRA 0460` recebe o perfil de administrador; os demais são membros.
As contas SQLite anteriores não autenticam mais, e as funções de troca de senha e gerenciamento
de usuários foram desativadas. A autenticação usa a cópia importada no MySQL: alterações
posteriores na planilha não são sincronizadas automaticamente.

**Risco:** data de nascimento e BRA não são senhas secretas e podem permitir que terceiros
assumam contas, inclusive a administrativa. Não exponha essa autenticação à internet; substitua-a
por senhas individuais fortes antes de disponibilizar o sistema publicamente.

## Configuração de implantação

### Site público somente para consulta

Execute `npm run build:public` e publique somente a pasta `dist` no Vercel. Esse build
lê o conteúdo do banco MySQL local e gera `dados/depoimentos.json`, `dados/competicoes.json`
e `dados/noticias.json` com campos públicos permitidos. Notícias em rascunho ou agendadas
para uma data futura, fontes editoriais de notícias e o banco completo não são incluídos.

O site lê essa cópia sem conectar à API local. Login e cadastros ficam desabilitados;
alterações locais só aparecem online após executar o build novamente e republicar.
Uma notícia agendada requer novo build depois da data de publicação.
Revise os registros públicos antes de publicar: eles poderão ser lidos por qualquer visitante.
Use `npm run build` para a versão que continua conectada à API, e `npm run dev`
para editar localmente. Valide o exportador com `npm run test:public`.

### Implantação com API e administração online

- `APP_ORIGIN`: origem exata do site no navegador, sem caminho (por exemplo, `https://uca.example.org`).
- `AUTH_COOKIE_SECURE=true`: obrigatório com `NODE_ENV=production`; a implantação deve usar HTTPS.
- `PORT`: opcional, porta local da API (padrão `3000`).
- `DB_PATH`: opcional, caminho do arquivo JSON legado usado apenas na migração inicial para o MySQL; o padrão é `BackEnd/db.json`.
- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`: conexão com o banco MySQL de conteúdo (padrões: `127.0.0.1`, `3306`, `uca`, `uca_app`; a senha é obrigatória por variável ou pelo arquivo `mysql.json`).
- `UCA_MYSQL_CONFIG_FILE`: opcional, caminho para o arquivo local de configuração do MySQL.
- `MYSQL_TABLE_PREFIX`: opcional, prefixo dos nomes das tabelas (usado pelos testes para isolar dados).

Configure `uca-api-base` nos dois documentos HTML para a origem HTTPS da API, e configure o proxy reverso para encaminhar essa origem à API local na porta definida. A origem da API deve ser same-site com o site para que os cookies `SameSite=Strict` funcionem. Mantenha a API não exposta diretamente à Internet; use HTTPS, proxy reverso, limites de requisição e controles operacionais apropriados.

Guarde as configurações fora do repositório, em variáveis protegidas pelo ambiente de execução ou em um gerenciador de segredos. Não compartilhe nem versione credenciais ou arquivos de configuração locais.

As sessões são mantidas em memória e expiram em oito horas; reiniciar a API encerra as sessões. Esta implementação é para uma única instância. Ambientes com múltiplas instâncias precisam de armazenamento de sessão compartilhado e limitação de tentativas no proxy antes da implantação.

## Datas das competições

Em **Cadastrar Competição**, a data prevista aceita um intervalo de data inicial a data final. Preencha ambas ou deixe ambas em branco; a data final não pode ser anterior à inicial. Na API, `expectedDate` representa o início e `expectedEndDate` o fim, em formato `AAAA-MM-DD`. Registros antigos com apenas `expectedDate` continuam compatíveis e, ao editar, usam essa data nos dois campos.

A área **Imagem da Competição**, incluindo **Selecionar imagem**, usa o seletor nativo de arquivos do navegador e também aceita arrastar e soltar. Selecione um JPG ou PNG de até 2 MB; a prévia confirma a seleção, e a imagem só é gravada ao salvar a competição. Após atualizar o site, use `Ctrl+F5` se o navegador ainda exibir a versão anterior.

Não abra o HTML diretamente por `file://`: o Chrome bloqueia os módulos JavaScript nessa origem, impedindo tanto a prévia quanto o tratamento de arrastar e soltar. Use `npm run dev` e acesse `http://127.0.0.1:5173` nos dois navegadores; mantenha o terminal aberto. O seletor nativo pode abrir mesmo quando os módulos estão bloqueados, mas isso não significa que a imagem foi processada.

## Testes e build

```powershell
npm test
npm run build
```

Os testes existentes da API exigem o MySQL local e ainda precisam ser atualizados para a
autenticação por associados. Os testes focados da integração podem ser executados sem MySQL:

```powershell
node --test BackEnd\test\associados-auth.test.js
python BackEnd\test\read-associados-ods.test.py
```

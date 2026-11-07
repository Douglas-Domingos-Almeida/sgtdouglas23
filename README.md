# Projeto UCA

## Iniciar o ambiente local

No primeiro uso, a tarefa oficial `npm run dev` abre a configuração da conta administrativa no terminal: informe um usuário e uma senha forte de pelo menos 16 caracteres duas vezes. A senha não é exibida. Seu hash scrypt é salvo fora do repositório e copiado para o banco local de autenticação na primeira inicialização. Para configurar a conta sem iniciar o site:

```powershell
npm run admin:setup
```

Para adicionar a conta inicial `BRA0460` como Administrador UCA sem substituir a conta administrativa local existente, use o bootstrap do banco de autenticação:

```powershell
npm --prefix BackEnd run auth:bootstrap-admin
```

O comando solicita e confirma uma senha de pelo menos 16 caracteres sem exibi-la. A senha é armazenada somente como hash scrypt no banco SQLite de autenticação, fora do repositório. A senha curta divulgada anteriormente não é aceita por esse bootstrap.

Depois, inicie frontend e API juntos:

```powershell
npm run dev
```

`npm run dev` configura a conta local uma única vez quando necessário, depois inicia a API e o Vite. A mesma configuração deve permanecer disponível ao iniciar apenas a API com `npm --prefix BackEnd start`; ela semeia a conta inicial quando o banco de usuários está vazio. A inicialização falha fechada se não houver uma conta configurada; não existe senha padrão. A senha curta informada durante o pedido de implementação não é usada como credencial inicial: configure uma senha forte e privada no terminal interativo.

O botão **Acesso UCA** abre o login de Administrador UCA ou Membro UCA. Ambos podem acessar as páginas e operações de cadastro; somente administradores podem criar/excluir contas. A página `#cadastro` e as demais rotas de cadastro exigem sessão autenticada. O usuário pode alterar sua senha em **Minha conta**; senhas precisam ter pelo menos 16 caracteres. Para HTTP local, `AUTH_COOKIE_SECURE=false` é necessário; não use essa configuração fora do desenvolvimento local.

Administradores criam e excluem contas em **Gerenciar usuários**, na página `#cadastro`. O banco SQLite de autenticação fica fora do repositório, por padrão em `%LOCALAPPDATA%\Projeto UCA\users.sqlite` no Windows (ou na pasta de configuração correspondente em outros sistemas). Senhas são armazenadas com scrypt e nunca são incluídas nas respostas da API. Preserve esse banco em backups protegidos.

## Configuração de implantação

### Site público somente para consulta

Execute `npm run build:public` e publique somente a pasta `dist` no Vercel. Esse build
gera `dados/depoimentos.json`, `dados/competicoes.json` e `dados/noticias.json` com
campos públicos permitidos. Notícias em rascunho ou agendadas para uma data futura,
fontes editoriais de notícias e o banco completo não são incluídos.

O site lê essa cópia sem conectar à API local. Login e cadastros ficam desabilitados;
alterações locais só aparecem online após executar o build novamente e republicar.
Uma notícia agendada requer novo build depois da data de publicação.
Revise os registros públicos antes de publicar: eles poderão ser lidos por qualquer visitante.
Use `npm run build` para a versão que continua conectada à API, e `npm run dev`
para editar localmente. Valide o exportador com `npm run test:public`.

### Implantação com API e administração online

- `ADMIN_USERNAME`: usuário administrativo inicial (até 100 caracteres).
- `ADMIN_PASSWORD_HASH`: saída de `npm --prefix BackEnd run auth:hash`; contém salt aleatório e derivação scrypt, não a senha em texto claro.
- `UCA_ADMIN_CONFIG_FILE`: opcional, caminho para um arquivo local de configuração administrativa, caso não use variáveis de ambiente ou o local padrão.
- `UCA_AUTH_DB_PATH`: opcional, caminho absoluto para o banco SQLite de usuários e hashes de senha; o padrão é `users.sqlite` ao lado da configuração administrativa.
- `APP_ORIGIN`: origem exata do site no navegador, sem caminho (por exemplo, `https://uca.example.org`).
- `AUTH_COOKIE_SECURE=true`: obrigatório com `NODE_ENV=production`; a implantação deve usar HTTPS.
- `PORT`: opcional, porta local da API (padrão `3000`).
- `DB_PATH`: opcional, caminho absoluto para o arquivo JSON de persistência; o padrão é `BackEnd/db.json`.

Configure `uca-api-base` nos dois documentos HTML para a origem HTTPS da API, e configure o proxy reverso para encaminhar essa origem à API local na porta definida. A origem da API deve ser same-site com o site para que os cookies `SameSite=Strict` funcionem. Mantenha a API não exposta diretamente à Internet; use HTTPS, proxy reverso, limites de requisição e controles operacionais apropriados.

Guarde `ADMIN_PASSWORD_HASH` e demais configurações fora do repositório, em variáveis protegidas pelo ambiente de execução ou em um gerenciador de segredos. Não compartilhe nem versione credenciais ou arquivos de configuração locais.

As sessões são mantidas em memória e expiram em oito horas; reiniciar a API encerra as sessões. Esta implementação é para uma única instância. Ambientes com múltiplas instâncias precisam de armazenamento de sessão compartilhado e limitação de tentativas no proxy antes da implantação. A conta administrativa configurada é usada apenas para semear o banco quando ele ainda não contém usuários; depois disso, o SQLite é a fonte de verdade.

## Datas das competições

Em **Cadastrar Competição**, a data prevista aceita um intervalo de data inicial a data final. Preencha ambas ou deixe ambas em branco; a data final não pode ser anterior à inicial. Na API, `expectedDate` representa o início e `expectedEndDate` o fim, em formato `AAAA-MM-DD`. Registros antigos com apenas `expectedDate` continuam compatíveis e, ao editar, usam essa data nos dois campos.

A área **Imagem da Competição**, incluindo **Selecionar imagem**, usa o seletor nativo de arquivos do navegador e também aceita arrastar e soltar. Selecione um JPG ou PNG de até 2 MB; a prévia confirma a seleção, e a imagem só é gravada ao salvar a competição. Após atualizar o site, use `Ctrl+F5` se o navegador ainda exibir a versão anterior.

Não abra o HTML diretamente por `file://`: o Chrome bloqueia os módulos JavaScript nessa origem, impedindo tanto a prévia quanto o tratamento de arrastar e soltar. Nesse caso, o site mostra um aviso com o endereço correto. Use `npm run dev` e acesse `http://127.0.0.1:5173` nos dois navegadores; mantenha o terminal aberto. O seletor nativo pode abrir mesmo quando os módulos estão bloqueados, mas isso não significa que a imagem foi processada.

## Testes e build

```powershell
npm test
npm run build
```

Os testes da API inicializam instâncias isoladas e usam bancos temporários, sem modificar `BackEnd/db.json` ou a configuração administrativa local.

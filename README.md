# Projeto UCA

## Iniciar o ambiente local

No primeiro uso, a tarefa oficial `npm run dev` abre a configuração da conta administrativa no terminal: informe um usuário e uma senha de pelo menos 16 caracteres duas vezes. A senha não é exibida, e somente seu hash scrypt é salvo em `%LOCALAPPDATA%\Projeto UCA\admin-auth.json`, fora do repositório. Para configurar a conta sem iniciar o site:

```powershell
npm run admin:setup
```

Depois, inicie frontend e API juntos:

```powershell
npm run dev
```

`npm run dev` configura a conta local uma única vez quando necessário, depois inicia a API e o Vite. A mesma configuração local é lida ao iniciar apenas a API com `npm --prefix BackEnd start`. A inicialização falha fechada se a configuração estiver ausente ou inválida; não existe conta nem senha padrão.

O botão **Entrar** no cabeçalho abre o acesso administrativo. As rotas de cadastro e todas as operações de escrita da API exigem a função `admin`. Para HTTP local, `AUTH_COOKIE_SECURE=false` é necessário; não use essa configuração fora do desenvolvimento local.

## Configuração de implantação

- `ADMIN_USERNAME`: usuário administrativo inicial (até 100 caracteres).
- `ADMIN_PASSWORD_HASH`: saída de `npm --prefix BackEnd run auth:hash`; contém salt aleatório e derivação scrypt, não a senha em texto claro.
- `UCA_ADMIN_CONFIG_FILE`: opcional, caminho para um arquivo local de configuração administrativa, caso não use variáveis de ambiente ou o local padrão.
- `APP_ORIGIN`: origem exata do site no navegador, sem caminho (por exemplo, `https://uca.example.org`).
- `AUTH_COOKIE_SECURE=true`: obrigatório com `NODE_ENV=production`; a implantação deve usar HTTPS.
- `PORT`: opcional, porta local da API (padrão `3000`).
- `DB_PATH`: opcional, caminho absoluto para o arquivo JSON de persistência; o padrão é `BackEnd/db.json`.

Configure `uca-api-base` nos dois documentos HTML para a origem HTTPS da API, e configure o proxy reverso para encaminhar essa origem à API local na porta definida. A origem da API deve ser same-site com o site para que os cookies `SameSite=Strict` funcionem. Mantenha a API não exposta diretamente à Internet; use HTTPS, proxy reverso, limites de requisição e controles operacionais apropriados.

Guarde `ADMIN_PASSWORD_HASH` e demais configurações fora do repositório, em variáveis protegidas pelo ambiente de execução ou em um gerenciador de segredos. Não compartilhe nem versione credenciais ou arquivos de configuração locais.

As sessões são mantidas em memória e expiram em oito horas; reiniciar a API encerra as sessões. Esta implementação é para uma única instância. Ambientes com múltiplas instâncias precisam de armazenamento de sessão compartilhado e limitação de tentativas no proxy antes da implantação.

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

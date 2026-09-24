# Registros de commits e releases

| Mensagem de commit ou tag da release | Descrição e justificativa da alteração |
| --- | --- |
| `feat(site): cria estrutura inicial da plataforma ONG Transformar` | Registra a entrega inicial do site, incluindo a estrutura das páginas, estilos e scripts. O tipo `feat` indica a inclusão de uma funcionalidade relevante e facilita a leitura do histórico. |
| `v1.0.0` | Primeira versão estável do projeto. O número maior indica a versão inicial da aplicação, o zero menor representa a primeira entrega e o último zero indica que não houve correções posteriores nessa série. A tag permite identificar exatamente o estado do código entregue. |

## Estratégia de versionamento

Foi adotado o versionamento semântico `MAJOR.MINOR.PATCH`. O número `MAJOR` será incrementado quando houver mudanças incompatíveis, `MINOR` quando forem adicionadas funcionalidades compatíveis e `PATCH` para correções sem alteração da API ou do comportamento esperado. As releases serão identificadas por tags no formato `vMAJOR.MINOR.PATCH`.

Neste momento, o repositório ainda não possui tags e mantém apenas o commit inicial. Os registros acima definem a padronização adotada para as próximas entregas e associam a primeira versão estável à tag `v1.0.0`.
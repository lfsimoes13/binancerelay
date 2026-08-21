# Guia de Deploy no Fly.io

Este guia documenta o deploy, configuração e manutenção do relay da Binance no Fly.io.

## 1. Requisitos
- Conta no Fly.io com faturamento ativo (necessário cartão de crédito).
- Flyctl CLI instalado no computador local.
- Repositório Git configurado no GitHub com ações ativas.

## 2. Estrutura de Arquivos
O diretório contém os seguintes arquivos essenciais para o deploy:
- `fly.toml`: Arquivo de configuração de máquina e serviço.
- `Dockerfile`: Especificação do ambiente Docker da aplicação (Node 20-slim).
- `.dockerignore`: Exclusão de logs, `.git` e arquivos desnecessários do build.

## 3. Configuração Local
O app roda na porta `8080` (padrão do container). O Fly.io faz o proxy reverso automático da porta HTTP externa para a interna.

## 4. Variáveis de Ambiente e Secrets
As variáveis confidenciais não devem ser salvas no `fly.toml`. Configure-as no Fly.io usando o comando:
```bash
fly secrets set FIXIE_URL="..." RELAY_SECRET="..."
```

## 5. Criação do Aplicativo
Caso necessite recriar o aplicativo de forma limpa, utilize:
```bash
fly apps create <nome-do-app> --org personal
```

## 6. Automação de CI/CD (GitHub Actions)
O deploy é realizado de forma automática a cada `git push` para a branch `main`.
Para isso, certifique-se de que a secret `FLY_API_TOKEN` está configurada nas configurações de Actions do repositório no GitHub.

## 7. Verificação de Saúde
Após o deploy, a rota `/health` responde `{"ok":true}` caso a inicialização ocorra sem erros.
A rota `/ip` pode ser consultada para testar o IP de saída atual da aplicação.

## 8. Mover a saída para uma região aceita com IP fixo (Sem Proxy / `DIRECT_ONLY=1`)

Se a Binance estiver bloqueando as requisições com o erro "Service unavailable from a restricted location" devido às restrições geográficas da Fixie (IPs dos EUA) ou do datacenter no Brasil (`gru`), siga este procedimento para rodar o relay de forma direta a partir de uma região autorizada pela Binance (como Alemanha `fra`, Finlândia `hel`, etc.) usando um IP de saída estático da própria Fly.io.

### Passo 8.1: Desativar o Proxy da Fixie
Defina o segredo `DIRECT_ONLY` no Fly.io para `1`. Isso fará o relay ignorar a Fixie e disparar as requisições diretamente a partir da máquina virtual do Fly.io:
```bash
fly secrets set DIRECT_ONLY=1
```

### Passo 8.2: Mover a Região no `fly.toml`
Altere a propriedade `primary_region` no arquivo `fly.toml` para uma região permitida pela Binance na Europa (por exemplo, `fra` em Frankfurt, Alemanha, ou `hel` em Helsinki, Finlândia):
```toml
primary_region = 'fra'
```
Depois, execute o deploy para migrar as instâncias para a nova região:
```bash
fly deploy
```

### Passo 8.3: Alocar IP de Saída Fixo (Egress IP) no Fly.io
Por padrão, os IPs de saída das máquinas virtuais do Fly.io mudam com frequência. Para obter um IP fixo persistente que você possa colocar na allowlist de IPs da Binance:
1. Aloque um IP de saída fixo para a região escolhida (ex: `fra`):
   ```bash
   fly ips allocate-egress -r fra
   ```
2. Para listar o IP de saída fixo alocado, consulte a rota de diagnóstico `/ip` da sua aplicação ou use:
   ```bash
   fly ips list
   ```
3. Copie o IP de saída alocado e adicione-o na **allowlist de restrição de IP** (API Key Management) dentro do painel da Binance.

# Relay de IP fixo para a Binance

O backend do app roda em runtime edge, que não suporta proxy HTTP (CONNECT) — por
isso não é possível usar a Fixie diretamente de lá. Este relay resolve isso:

```
App (edge)  --HTTPS + x-relay-secret-->  Relay (Node)  --proxy Fixie (IP fixo)-->  Binance
```

A chave secreta da API nunca sai do backend: ele assina a requisição (HMAC) e o
relay só repassa URL, método e o header `X-MBX-APIKEY`.

## 1. Deploy

Qualquer host Node serve (Render, Railway, Fly, VPS, Heroku):

```bash
cd relay/binance-relay
npm install
npm start
```

Variáveis de ambiente no host:

| Variável       | Valor                                                        |
| -------------- | ------------------------------------------------------------ |
| `FIXIE_URL`    | a Proxy URL do painel da Fixie (`http://fixie:TOKEN@criterium.usefixie.com:80`) |
| `RELAY_SECRET` | um valor aleatório forte (`openssl rand -hex 32`)            |
| `PORT`         | opcional, padrão `8080`                                      |

Teste: `curl https://SEU-RELAY/health` deve responder `{"ok":true}`.

## 2. Allowlist na Binance

Na sua API key, escolha **Restringir o acesso apenas a IPs confiáveis** e
adicione os **Outbound IPs** que aparecem no painel da Fixie (são dois).
Aí você pode marcar "Ativar trading Spot" e, se quiser, "Habilitar Saques".

## 3. Ligar no app

No app, salve dois segredos:

- `BINANCE_RELAY_URL` = a URL pública do relay (ex.: `https://meu-relay.onrender.com/`)
- `BINANCE_RELAY_SECRET` = o mesmo valor de `RELAY_SECRET`

Com eles presentes, todas as chamadas da corretora passam pelo relay
automaticamente. Sem eles, o app volta a chamar a Binance direto (só leitura).

## Limites

O plano gratuito da Fixie (tricycle) dá 500 requisições/mês — suficiente para
testes, mas suba de plano antes de deixar agendamentos consultando saldo com
frequência.

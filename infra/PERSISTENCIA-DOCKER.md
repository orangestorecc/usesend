# Persistência do container Madmail — caminhos a montar como volume

Levantado direto no container em 12/08/2026, depois da recriação que derrubou
a produção (todos os domínios em 502).

---

## Resumo

O que sobreviveu à recriação foi exatamente o que já é volume. O que não era,
desapareceu — inclusive as definições dos processos do app e o arquivo com
todos os segredos.

**Já persistente** (confirmado em `/proc/mounts`, tudo em `/dev/md0`):

```
/var/lib/postgresql
/var/lib/redis
/var/lib/ssh-host-keys
```

**Falta persistir** — foi o que se perdeu:

```
/opt/madmail
/etc/supervisor/conf.d
/home/deploy/.ssh
```

---

## O que tem em cada caminho

### `/opt/madmail` — crítico

É a raiz de toda a stack da aplicação.

| Caminho | Conteúdo | Se perder |
|---|---|---|
| `app/` | checkout do repositório, já buildado | recuperável com novo deploy (~15 min) |
| `app/apps/web/.env` | **todos os segredos** | **não recuperável** — ver aviso abaixo |
| `app/apps/smtp-server/.env` | config do relay SMTP | recuperável |
| `certs/` | certificado TLS do SMTP | recuperável |
| `backups/` | dumps locais do Postgres | há cópia no S3 |
| `logs/` | logs dos serviços | descartável |
| `deploy.sh`, `backup.sh`, `backup-loop.sh` | scripts de operação | versionados no repositório |

### `/etc/supervisor/conf.d` — crítico

Define os processos da aplicação: `madmail-web`, `madmail-site`,
`madmail-docs`, `madmail-mcp`, `madmail-backup` e `madmail-smtp`.

O `services.conf` (postgres, redis, sshd) faz parte da imagem e sobrevive. Os
demais não — por isso, depois da recriação, o container subiu apenas com banco,
Redis e SSH, e todos os domínios responderam 502.

### `/home/deploy/.ssh` — importante

Contém o `authorized_keys` usado pelo GitHub Actions para publicar. Sem ele o
deploy automático para de funcionar e é preciso recadastrar a chave à mão.

---

## O ponto que não é óbvio: banco e segredo precisam sobreviver juntos

O `NEXTAUTH_SECRET`, que vive no `.env`, não serve só para sessão de login. É
dele que se deriva a chave que **criptografa credenciais de terceiros dentro do
banco**:

- credenciais da Rede e do Inter (gateways de pagamento);
- chave de API das integrações de plataforma (OrangeStore).

Essas linhas ficam no Postgres em formato cifrado (AES-256-GCM). Se o banco
sobrevive mas o `.env` não, os registros continuam lá e **ninguém mais consegue
abri-los** — seria necessário recadastrar tudo manualmente.

Ou seja: persistir só `/var/lib/postgresql` protege metade do problema.

---

## Sugestão de montagem

```yaml
volumes:
  - /dados/madmail/postgresql:/var/lib/postgresql
  - /dados/madmail/redis:/var/lib/redis
  - /dados/madmail/ssh-host-keys:/var/lib/ssh-host-keys
  - /dados/madmail/stack:/opt/madmail
  - /dados/madmail/supervisor:/etc/supervisor/conf.d
  - /dados/madmail/deploy-ssh:/home/deploy/.ssh
```

Ajustar o caminho do host conforme a convenção da máquina — o que importa é
que os seis fiquem fora da camada gravável do container.

Atenção às permissões ao criar os diretórios vazios no host:

- `/opt/madmail` e `/home/deploy/.ssh` pertencem ao usuário `deploy`;
- `/home/deploy/.ssh` precisa de modo `700`, e o `authorized_keys` de `600`,
  senão o SSH recusa a chave em silêncio;
- `/var/lib/postgresql` pertence ao usuário `postgres`.

---

## Duas perguntas

**1. Dá para recuperar o `/opt/madmail` anterior?** Se o container antigo ainda
existir parado, ou se houver snapshot do host, o `.env` volta e a restauração
é limpa, sem perda de credencial nenhuma. Se não houver, subimos com segredos
novos e as credenciais de pagamento e da OrangeStore terão de ser recadastradas.

**2. O container vai ser recriado de novo depois de configurar os volumes?** Se
sim, aguardamos: não faz sentido restaurar agora e perder tudo outra vez em
seguida. Preferimos subir uma única vez, com os volumes já no lugar.

---

## Do nosso lado

As definições do supervisord para os processos da aplicação estavam sendo
instaladas manualmente em `/etc/supervisor/conf.d/`, e foi por isso que
morreram com o container. Vão passar a ser versionadas no repositório e
aplicadas pelo deploy — assim, mesmo sem volume, um `deploy` reconstrói o
estado.

O `.env` continua sendo o único item sem cópia. Vamos incluí-lo, cifrado, no
backup que já sobe para o S3.

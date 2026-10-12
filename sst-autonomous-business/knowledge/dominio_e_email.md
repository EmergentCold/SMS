# Domínio e e-mail profissional — passo a passo

> **Agora:** operando no plano gratuito com Gmail (`knowledge/plano_gratuito.md`). Este guia é para quando
> houver orçamento: domínio escolhido **tavarezsst.com.br**.

Para: Luan Souza Tavarez · Tavarez Segurança do Trabalho, Saúde e Meio Ambiente.
Tempo total: ~1 h (mais até 24 h de propagação do DNS). Custos de referência no fim.

## 1. Escolher o nome (5 min)

Curto, fácil de ditar por telefone, sem acento e sem hífen. Sugestões, em ordem:

| Domínio | E-mail principal | Observação |
|---|---|---|
| **tavarezsst.com.br** | contato@tavarezsst.com.br | curto; "SST" é o termo do mercado |
| tavarezseguranca.com.br | contato@tavarezseguranca.com.br | mais claro para leigos, mais longo |
| tavarezsso.com.br | contato@tavarezsso.com.br | SSO = Saúde e Segurança Ocupacional |
| tavarez.com.br | luan@tavarez.com.br | o melhor se estiver livre (provavelmente não) |

Crie também `luan@` (pessoal profissional) como **alias** do mesmo usuário — sem custo extra.

## 2. Registrar no Registro.br (10 min)

1. Acesse **registro.br**, digite o nome e veja se está disponível.
2. Crie a conta com seu **CPF** (pessoa física pode registrar `.com.br`; não precisa de CNPJ).
3. Registre por **1 ano** (pode ser mais) e pague (Pix, boleto ou cartão). Ative a renovação/aviso por e-mail.
4. Em *DNS*, mantenha **"Utilizar os servidores DNS do Registro.br"** e entre em **modo avançado** — é lá
   que você vai colar os registros do passo 4.

## 3. Criar o e-mail no Microsoft 365 (15 min)

**Use uma assinatura sua**, separada de qualquer conta do seu empregador: o negócio, os clientes e os fluxos do
Power Automate precisam ficar no **seu** ambiente.

1. Assine o **Microsoft 365 Business Basic** (1 usuário) em microsoft.com/pt-br/microsoft-365/business.
   Inclui e-mail com domínio, Teams, OneDrive e Power Automate com conectores padrão (confira a lista de
   recursos na página do plano antes de assinar).
2. No **Centro de administração → Configurações → Domínios → Adicionar domínio**, informe o domínio.
3. A Microsoft mostra um registro **TXT de verificação** (`MS=ms12345678`). Cole no modo avançado do Registro.br.
4. Crie o usuário `contato@seudominio.com.br` e o alias `luan@`.

## 4. Registros DNS (copiar os valores exatos que a Microsoft mostrar)

| Tipo | Nome | Valor (exemplo para tavarezsst.com.br) | Para quê |
|---|---|---|---|
| TXT | @ | `MS=ms...` (o seu) | verificar o domínio |
| MX | @ | `tavarezsst-com-br.mail.protection.outlook.com` (prioridade 0) | receber e-mail |
| CNAME | autodiscover | `autodiscover.outlook.com` | configurar Outlook/celular |
| TXT | @ | `v=spf1 include:spf.protection.outlook.com -all` | **SPF**: autoriza a Microsoft a enviar por você |
| CNAME | selector1._domainkey | valor do portal *Microsoft Defender → Políticas → DKIM* | **DKIM**: assinatura das mensagens |
| CNAME | selector2._domainkey | idem | **DKIM** |
| TXT | _dmarc | `v=DMARC1; p=none; rua=mailto:contato@tavarezsst.com.br; fo=1` | **DMARC**: relatórios; após 2 semanas sem problemas, mude para `p=quarantine` |

Depois de colar os CNAMEs, **ative o DKIM** no portal do Defender. Sem SPF + DKIM + DMARC, Gmail e Outlook
tendem a mandar mensagens de domínio novo para o spam.

## 5. Ligar no agente (5 min, na sessão do seu PC)

```powershell
python instalar\configurar_identidade.py --email contato@SEUDOMINIO.com.br
```
No `.env`: `EMAIL_CHANNEL=power_automate` e crie o **Fluxo 9** (`powerplatform/power-automate/FLUXOS.md`)
conectado com a caixa `contato@`. Teste mandando 1 mensagem para o seu e-mail pessoal antes de ligar
`EXTERNAL_SENDING_ENABLED=true`.

## 6. Aquecimento do domínio (automático)

Domínio novo que dispara muitos e-mails perde reputação. O agente limita sozinho os **primeiros contatos**:

| Dias desde o 1º envio | Máximo por dia |
|---|---|
| 1–14 | 5 |
| 15–28 | 10 |
| depois | 15 (`max_first_contacts_per_day`) |

Follow-ups e respostas não entram nessa conta. Ajuste em `config/outreach.json → limits.warmup`.
Nas duas primeiras semanas, troque também alguns e-mails normais (clientes, fornecedores) pela caixa nova.

## Custos de referência (conferir na hora da compra)

| Item | Valor | Fonte |
|---|---|---|
| Domínio .com.br (Registro.br) | ~R$ 40/ano | [guia 2026](https://guiaferramentasdigitais.com.br/guias/como-registrar-dominio-brasil/), [Nuvemshop](https://www.nuvemshop.com.br/blog/registro-br) |
| Microsoft 365 Business Basic | R$ 33,40/usuário/mês no plano anual (sem impostos), sujeito ao reajuste anunciado para 2026 | [Microsoft](https://www.microsoft.com/pt-br/microsoft-365/business/microsoft-365-business-basic), [TecMundo](https://www.tecmundo.com.br/software/409113-microsoft-vai-aumentar-precos-de-assinaturas-comerciais-do-office-em-2026.htm) |

Registre esses custos no agente para a margem ficar correta:
```powershell
python -m src.main finance DESPESA 40 --status REALIZADO --category ferramenta --description "domínio .com.br" --paid-at AAAA-MM-DD
```

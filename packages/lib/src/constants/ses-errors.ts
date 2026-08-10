export const DELIVERY_DELAY_ERRORS = {
  InternalFailure: "Um problema interno do useSend causou o atraso da mensagem.",
  General: "Ocorreu uma falha genérica durante a conversa SMTP.",
  MailboxFull:
    "A caixa de entrada do destinatário está cheia e não consegue receber novas mensagens.",
  SpamDetected:
    "O servidor de e-mail do destinatário detectou um grande volume de e-mails não solicitados vindos da sua conta.",
  RecipientServerError:
    "Um problema temporário no servidor de e-mail do destinatário está impedindo a entrega da mensagem.",
  IPFailure:
    "O endereço IP que está enviando a mensagem está sendo bloqueado ou limitado pelo provedor de e-mail do destinatário.",
  TransientCommunicationFailure:
    "Houve uma falha temporária de comunicação durante a conversa SMTP com o provedor de e-mail do destinatário.",
  BYOIPHostNameLookupUnavailable:
    "O useSend não conseguiu resolver o hostname DNS dos seus endereços IP. Esse tipo de atraso só ocorre quando você usa Bring Your Own IP.",
  Undetermined:
    "O useSend não conseguiu determinar o motivo do atraso na entrega.",
  SendingDeferral:
    "O useSend considerou apropriado adiar a mensagem internamente.",
};

export const BOUNCE_ERROR_MESSAGES = {
  Undetermined: "O useSend não conseguiu determinar um motivo específico para o retorno.",
  Permanent: {
    General:
      "O useSend recebeu um hard bounce geral. Se você receber esse tipo de retorno, remova o endereço de e-mail do destinatário da sua lista de envio.",
    NoEmail:
      "O useSend recebeu um hard bounce permanente porque o endereço de e-mail de destino não existe. Se você receber esse tipo de retorno, remova o endereço de e-mail do destinatário da sua lista de envio.",
    Suppressed:
      "O useSend suprimiu o envio para este endereço porque ele tem um histórico recente de retornos como endereço inválido. Para ignorar a lista de supressão global, consulte o uso da lista de supressão em nível de conta do useSend.",
    OnAccountSuppressionList:
      "O useSend suprimiu o envio para este endereço porque ele está na lista de supressão em nível de conta. Isso não conta para a sua métrica de taxa de retorno.",
  },
  Transient: {
    General:
      "O useSend recebeu um retorno geral. Talvez você consiga enviar para este destinatário com sucesso no futuro.",
    MailboxFull:
      "O useSend recebeu um retorno de caixa de entrada cheia. Talvez você consiga enviar para este destinatário com sucesso no futuro.",
    MessageTooLarge:
      "O useSend recebeu um retorno de mensagem muito grande. Talvez você consiga enviar para este destinatário se reduzir o tamanho da mensagem.",
    ContentRejected:
      "O useSend recebeu um retorno de conteúdo rejeitado. Talvez você consiga enviar para este destinatário se alterar o conteúdo da mensagem.",
    AttachmentRejected:
      "O useSend recebeu um retorno de anexo rejeitado. Talvez você consiga enviar para este destinatário se remover ou alterar o anexo.",
  },
};

export const COMPLAINT_ERROR_MESSAGES = {
  abuse: "Indica e-mail não solicitado ou algum outro tipo de abuso de e-mail.",
  "auth-failure": "Relatório de falha de autenticação de e-mail.",
  fraud: "Indica algum tipo de fraude ou atividade de phishing.",
  "not-spam":
    "Indica que a entidade que fornece o relatório não considera a mensagem como spam. Isso pode ser usado para corrigir uma mensagem que foi incorretamente marcada ou categorizada como spam.",
  other:
    "Indica qualquer outro feedback que não se enquadra nos demais tipos registrados.",
  virus: "Relata que um vírus foi encontrado na mensagem de origem.",
};

-- Traduz o texto padrão do e-mail de double opt-in nas listas já existentes.
--
-- Os defaults são gravados na linha da ContactBook no momento da criação, e
-- não lidos do código a cada envio. Por isso a tradução das constantes só
-- valeu para listas novas: as antigas continuaram com o texto em inglês
-- congelado no banco.
--
-- A troca é feita frase a frase, e não substituindo o JSON inteiro, para não
-- apagar personalização de quem já mexeu no template (cores, botão, blocos
-- extras). Quem alterou as frases não é afetado: o replace não encontra o
-- texto em inglês e a linha fica como está.

UPDATE "ContactBook"
SET "doubleOptInSubject" = 'Confirme sua inscrição'
WHERE "doubleOptInSubject" = 'Please confirm your subscription';

UPDATE "ContactBook"
SET "doubleOptInContent" = replace(
  replace(
    replace(
      replace(
        replace(
          "doubleOptInContent",
          'Hello, Thank you for signing up. Please confirm that you want to receive emails from us.',
          'Olá! Obrigado por se inscrever. Confirme que você quer receber nossos e-mails.'
        ),
        'If you did not request this, you can ignore this email.',
        'Se você não fez essa solicitação, é só ignorar este e-mail.'
      ),
      '"text":"Confirm"',
      '"text":"Confirmar inscrição"'
    ),
    '"text": "Confirm"',
    '"text": "Confirmar inscrição"'
  ),
  'You are receiving this email because you opted in via our site.',
  'Você recebeu este e-mail porque se inscreveu em nosso site.'
)
WHERE "doubleOptInContent" IS NOT NULL
  AND (
    "doubleOptInContent" LIKE '%Please confirm that you want to receive emails from us.%'
    OR "doubleOptInContent" LIKE '%If you did not request this%'
    OR "doubleOptInContent" LIKE '%opted in via our site%'
  );

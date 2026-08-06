-- Resumo diário da agenda do médico via WhatsApp (perfil do médico).
-- O número é separado de users.phone: o telefone de cadastro nem sempre é o WhatsApp.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "daily_agenda_enabled"  boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "daily_agenda_whatsapp" varchar(30);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "daily_agenda_hour"     varchar(5) DEFAULT '08:00' NOT NULL;
-- Data (YYYY-MM-DD no fuso da clínica) do último envio: deduplica o cron horário.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "daily_agenda_last_sent" varchar(10);

-- Novo tipo de mensagem para o log em whatsapp_messages.
ALTER TYPE "whatsapp_message_type" ADD VALUE IF NOT EXISTS 'daily_agenda';

-- O cron varre de hora em hora só quem está habilitado.
CREATE INDEX IF NOT EXISTS "users_daily_agenda_idx"
  ON "users" ("daily_agenda_enabled", "daily_agenda_hour");

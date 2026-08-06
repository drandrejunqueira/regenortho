-- Vocabulário oficial de tags da clínica (Configurações → Tags).
-- `leads.tags` continua guardando os NOMES; esta tabela é o registro do que
-- pode ser escolhido, com cor. Renomear cascateia via UPDATE na rota.
CREATE TABLE IF NOT EXISTS "tags" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name"       varchar(40) NOT NULL UNIQUE,
  "color"      varchar(7) DEFAULT '#00BCE4' NOT NULL,
  "is_active"  boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- A listagem ordena por nome e o seletor do lead só mostra as ativas.
CREATE INDEX IF NOT EXISTS "tags_active_name_idx" ON "tags" ("is_active", "name");

-- O filtro do CRM usa containment (`leads.tags @> '["x"]'`), que só usa índice GIN.
CREATE INDEX IF NOT EXISTS "leads_tags_gin_idx" ON "leads" USING GIN ("tags");

-- Semeia o registro com as tags de texto livre já usadas nos leads, para não
-- perder marcação da equipe. Idempotente: rodar de novo não duplica.
INSERT INTO "tags" ("name")
SELECT DISTINCT LEFT(tag, 40)
FROM "leads", jsonb_array_elements_text(COALESCE("tags", '[]'::jsonb)) AS tag
WHERE LENGTH(TRIM(tag)) > 0
ON CONFLICT ("name") DO NOTHING;

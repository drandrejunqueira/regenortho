-- Central de avisos do sistema (sino do topo direito).
-- Uma linha por evento; cada usuário marca como lida via read_by.
CREATE TABLE IF NOT EXISTS "notifications" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "type"       varchar(40) NOT NULL,
  "title"      varchar(160) NOT NULL,
  "body"       text,
  "link"       varchar(255),
  "entity_id"  uuid,
  "priority"   varchar(10) DEFAULT 'normal' NOT NULL,
  "read_by"    jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- O sino busca sempre as mais recentes primeiro.
CREATE INDEX IF NOT EXISTS "notifications_created_at_idx" ON "notifications" ("created_at" DESC);

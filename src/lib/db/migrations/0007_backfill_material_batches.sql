-- Traz para material_batches os lotes que ficaram presos nas colunas do material.
-- A tela de edição lê os lotes de material_batches, então o número digitado no
-- cadastro não aparecia ao reabrir o material.
-- quantity espelha o estoque atual para o total dos lotes continuar batendo.
-- Idempotente: só insere para materiais que ainda não têm nenhum lote.
INSERT INTO "material_batches" ("material_id", "batch_number", "expires_at", "quantity")
SELECT m."id", m."batch_number", m."expires_at", m."current_stock"
FROM "materials" m
WHERE (m."batch_number" IS NOT NULL OR m."expires_at" IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM "material_batches" b WHERE b."material_id" = m."id"
  );

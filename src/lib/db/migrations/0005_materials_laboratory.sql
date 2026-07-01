-- Adiciona o nome do laboratório fabricante ao cadastro de materiais/produtos
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "laboratory" varchar(255);

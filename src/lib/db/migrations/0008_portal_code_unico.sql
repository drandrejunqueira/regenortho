-- O código de 6 dígitos é a credencial de acesso ao prontuário pelo portal.
-- Sem esta restrição, dois pacientes podiam ter o mesmo código ativo ao mesmo
-- tempo e quem digitasse abriria a ficha de outra pessoa.
-- Índice parcial: só vale para acessos ativos — códigos já revogados podem
-- repetir sem problema.
CREATE UNIQUE INDEX IF NOT EXISTS "patient_access_tokens_code_ativo_uniq"
  ON "patient_access_tokens" ("code")
  WHERE "is_active" AND "code" IS NOT NULL;

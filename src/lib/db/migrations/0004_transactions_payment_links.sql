-- Vincula recebimentos a forma de pagamento e conta bancária (recebimentos de tratamento)
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "payment_method_id" uuid;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "bank_account_id" uuid;

DO $$ BEGIN
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payment_method_id_payment_methods_id_fk"
    FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_bank_account_id_bank_accounts_id_fk"
    FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

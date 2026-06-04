CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" text NOT NULL,
	"path" text NOT NULL,
	"referrer" text,
	"rotulo" text,
	"session_id" text,
	"device" text,
	"pais" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "configuracoes" (
	"chave" text PRIMARY KEY NOT NULL,
	"valor" text,
	"descricao" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "glossario_termos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"termo" text NOT NULL,
	"slug" text NOT NULL,
	"letra" text NOT NULL,
	"nicho" text NOT NULL,
	"conteudo" text,
	"status" text DEFAULT 'pendente' NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "glossario_termos_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(7) DEFAULT '#00BCE4' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treatment_template_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"type" "treatment_item_type" NOT NULL,
	"material_id" uuid,
	"description" varchar(255) NOT NULL,
	"quantity" numeric(8, 3) DEFAULT '1' NOT NULL,
	"unit_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treatment_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" "transaction_category" DEFAULT 'consultation_fee' NOT NULL,
	"default_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"estimated_cost" numeric(10, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "room_id" uuid;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "google_event_id" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "return_deadline" timestamp;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "return_estimated_at" timestamp;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "is_paid_consultation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "consultation_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "payment_method_id" uuid;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "payment_timing" varchar(50);--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "payment_status" varchar(50);--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "payment_receipt_url" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "patient_access_tokens" ADD COLUMN "code" varchar(6);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "treatment_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "installment_number" integer;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "installment_total" integer;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "template_id" uuid;--> statement-breakpoint
ALTER TABLE "treatments" ADD COLUMN "category" "transaction_category" DEFAULT 'consultation_fee' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_calendar_refresh_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_calendar_email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_calendar_connected_at" timestamp;--> statement-breakpoint
ALTER TABLE "treatment_template_items" ADD CONSTRAINT "treatment_template_items_template_id_treatment_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."treatment_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_template_items" ADD CONSTRAINT "treatment_template_items_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_templates" ADD CONSTRAINT "treatment_templates_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_tipo_idx" ON "analytics_events" USING btree ("tipo");--> statement-breakpoint
CREATE INDEX "analytics_path_idx" ON "analytics_events" USING btree ("path");--> statement-breakpoint
CREATE INDEX "analytics_created_idx" ON "analytics_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_glossario_letra" ON "glossario_termos" USING btree ("letra");--> statement-breakpoint
CREATE INDEX "idx_glossario_status" ON "glossario_termos" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_glossario_slug" ON "glossario_termos" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_template_id_treatment_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."treatment_templates"("id") ON DELETE no action ON UPDATE no action;
-- Account preferences. Additive only: one owner-scoped row, no changes to conversations or messages.
-- default_model is the starting mode for a new chat. conversations.selected_model stays authoritative after creation.

CREATE TYPE "public"."preferred_language" AS ENUM('auto', 'en', 'id');--> statement-breakpoint
CREATE TYPE "public"."preference_model" AS ENUM('fast', 'balanced', 'reasoning');--> statement-breakpoint
CREATE TYPE "public"."response_length" AS ENUM('concise', 'balanced', 'detailed');--> statement-breakpoint
CREATE TYPE "public"."response_style" AS ENUM('natural', 'professional', 'direct');--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"preferred_name" text,
	"preferred_language" "preferred_language" DEFAULT 'auto' NOT NULL,
	"default_model" "preference_model" DEFAULT 'balanced' NOT NULL,
	"response_length" "response_length" DEFAULT 'balanced' NOT NULL,
	"response_style" "response_style" DEFAULT 'natural' NOT NULL,
	"about_you" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_preferred_name_length" CHECK ("user_preferences"."preferred_name" is null or (char_length("user_preferences"."preferred_name") between 1 and 80 and "user_preferences"."preferred_name" = btrim("user_preferences"."preferred_name"))),
	CONSTRAINT "user_preferences_about_you_length" CHECK ("user_preferences"."about_you" is null or (char_length("user_preferences"."about_you") between 1 and 1500 and "user_preferences"."about_you" = btrim("user_preferences"."about_you")))
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.user_preferences FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY user_preferences_select_own ON public.user_preferences FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));--> statement-breakpoint
CREATE POLICY user_preferences_insert_own ON public.user_preferences FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));--> statement-breakpoint
CREATE POLICY user_preferences_update_own ON public.user_preferences FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));--> statement-breakpoint
CREATE POLICY user_preferences_delete_own ON public.user_preferences FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;--> statement-breakpoint
GRANT USAGE ON TYPE public.preferred_language, public.preference_model, public.response_length, public.response_style TO authenticated;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.set_user_preferences_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$ BEGIN NEW.updated_at = pg_catalog.clock_timestamp(); RETURN NEW; END; $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.set_user_preferences_updated_at() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.set_user_preferences_updated_at() TO authenticated;--> statement-breakpoint
CREATE TRIGGER user_preferences_set_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.set_user_preferences_updated_at();

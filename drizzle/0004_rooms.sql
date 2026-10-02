-- Rooms V1. A thread may keep a null room_id. Deleting a room detaches its threads; it does not delete them.

CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"instructions" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_id_user_id_key" UNIQUE("id","user_id"),
	CONSTRAINT "rooms_name_length" CHECK (char_length("rooms"."name") between 1 and 80 and "rooms"."name" = btrim("rooms"."name")),
	CONSTRAINT "rooms_description_length" CHECK ("rooms"."description" is null or (char_length("rooms"."description") between 1 and 500 and "rooms"."description" = btrim("rooms"."description"))),
	CONSTRAINT "rooms_instructions_length" CHECK ("rooms"."instructions" is null or (char_length("rooms"."instructions") between 1 and 2000 and "rooms"."instructions" = btrim("rooms"."instructions")))
);
--> statement-breakpoint
CREATE TABLE "room_briefs" (
	"room_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"goal" text,
	"current_focus" text,
	"important_decisions" text,
	"open_questions" text,
	"next_step" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_briefs_goal_length" CHECK ("room_briefs"."goal" is null or (char_length("room_briefs"."goal") between 1 and 500 and "room_briefs"."goal" = btrim("room_briefs"."goal"))),
	CONSTRAINT "room_briefs_current_focus_length" CHECK ("room_briefs"."current_focus" is null or (char_length("room_briefs"."current_focus") between 1 and 500 and "room_briefs"."current_focus" = btrim("room_briefs"."current_focus"))),
	CONSTRAINT "room_briefs_important_decisions_length" CHECK ("room_briefs"."important_decisions" is null or (char_length("room_briefs"."important_decisions") between 1 and 500 and "room_briefs"."important_decisions" = btrim("room_briefs"."important_decisions"))),
	CONSTRAINT "room_briefs_open_questions_length" CHECK ("room_briefs"."open_questions" is null or (char_length("room_briefs"."open_questions") between 1 and 500 and "room_briefs"."open_questions" = btrim("room_briefs"."open_questions"))),
	CONSTRAINT "room_briefs_next_step_length" CHECK ("room_briefs"."next_step" is null or (char_length("room_briefs"."next_step") between 1 and 500 and "room_briefs"."next_step" = btrim("room_briefs"."next_step")))
);
--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_briefs" ADD CONSTRAINT "room_briefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_briefs" ADD CONSTRAINT "room_briefs_room_owner_fk" FOREIGN KEY ("room_id","user_id") REFERENCES "public"."rooms"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "room_id" uuid;--> statement-breakpoint
-- Nulls only room_id. A plain SET NULL on this composite key would also clear user_id.
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_room_owner_fk" FOREIGN KEY ("room_id","user_id") REFERENCES "public"."rooms"("id","user_id") ON DELETE SET NULL ("room_id") ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rooms_user_updated_idx" ON "rooms" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "conversations_user_room_idx" ON "conversations" USING btree ("user_id","room_id");--> statement-breakpoint
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.rooms FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.room_briefs ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.room_briefs FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY rooms_select_own ON public.rooms FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));--> statement-breakpoint
CREATE POLICY rooms_insert_own ON public.rooms FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));--> statement-breakpoint
CREATE POLICY rooms_update_own ON public.rooms FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));--> statement-breakpoint
CREATE POLICY rooms_delete_own ON public.rooms FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));--> statement-breakpoint
CREATE POLICY room_briefs_select_own ON public.room_briefs FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));--> statement-breakpoint
CREATE POLICY room_briefs_insert_own ON public.room_briefs FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));--> statement-breakpoint
CREATE POLICY room_briefs_update_own ON public.room_briefs FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));--> statement-breakpoint
CREATE POLICY room_briefs_delete_own ON public.room_briefs FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_briefs TO authenticated;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.set_rooms_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$ BEGIN NEW.updated_at = pg_catalog.clock_timestamp(); RETURN NEW; END; $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.set_rooms_updated_at() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.set_rooms_updated_at() TO authenticated;--> statement-breakpoint
CREATE TRIGGER rooms_set_updated_at BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.set_rooms_updated_at();--> statement-breakpoint
CREATE TRIGGER room_briefs_set_updated_at BEFORE UPDATE ON public.room_briefs FOR EACH ROW EXECUTE FUNCTION public.set_rooms_updated_at();

CREATE TABLE "attribution_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"slug" varchar(20) NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attribution_links_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "attribution_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attribution_link_id" uuid NOT NULL,
	"order_id" uuid,
	"visited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" varchar(64)
);
--> statement-breakpoint
ALTER TABLE "attribution_links" ADD CONSTRAINT "attribution_links_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribution_visits" ADD CONSTRAINT "attribution_visits_attribution_link_id_attribution_links_id_fk" FOREIGN KEY ("attribution_link_id") REFERENCES "public"."attribution_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribution_visits" ADD CONSTRAINT "attribution_visits_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
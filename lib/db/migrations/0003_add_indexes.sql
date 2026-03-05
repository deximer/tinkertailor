CREATE INDEX IF NOT EXISTS "idx_orders_user_id" ON "orders" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_orders_stripe_pi" ON "orders" ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_attribution_links_creator_id" ON "attribution_links" ("creator_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_attribution_links_product_id" ON "attribution_links" ("product_id");

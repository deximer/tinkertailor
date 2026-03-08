CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name"),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "component_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"category_id" uuid NOT NULL,
	"stage" varchar(20) NOT NULL,
	"is_first_leaf" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "component_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"code" varchar(50) NOT NULL,
	"component_type_id" uuid NOT NULL,
	"model_path" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "components_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "component_compatibility" (
	"component_a_id" uuid NOT NULL,
	"component_b_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "component_compatibility_component_a_id_component_b_id_pk" PRIMARY KEY("component_a_id","component_b_id")
);
--> statement-breakpoint
CREATE TABLE "component_fabric_categories" (
	"component_id" uuid NOT NULL,
	"fabric_skin_category_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "component_fabric_categories_component_id_fabric_skin_category_id_pk" PRIMARY KEY("component_id","fabric_skin_category_id")
);
--> statement-breakpoint
CREATE TABLE "fabric_skin_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"parent_id" uuid,
	"merchandising_order" integer DEFAULT 0 NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fabric_skin_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "fabric_skins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"fabric_code" varchar(50) NOT NULL,
	"category_id" uuid NOT NULL,
	"model_type" varchar(50),
	"price_markup" numeric(10, 2) DEFAULT '0' NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fabric_skins_fabric_code_unique" UNIQUE("fabric_code")
);
--> statement-breakpoint
CREATE TABLE "silhouette_components" (
	"silhouette_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"default_fabric_skin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "silhouette_components_silhouette_id_component_id_pk" PRIMARY KEY("silhouette_id","component_id")
);
--> statement-breakpoint
CREATE TABLE "silhouette_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"pattern_id" varchar(50) NOT NULL,
	"category_id" uuid NOT NULL,
	"base_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"description" varchar(2000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "silhouette_templates_pattern_id_unique" UNIQUE("pattern_id")
);
--> statement-breakpoint
CREATE TABLE "silhouette_tags" (
	"silhouette_id" uuid NOT NULL,
	"tag_value_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "silhouette_tags_silhouette_id_tag_value_id_pk" PRIMARY KEY("silhouette_id","tag_value_id")
);
--> statement-breakpoint
CREATE TABLE "tag_dimensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"selection_type" varchar(20) DEFAULT 'single' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tag_dimensions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "tag_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dimension_id" uuid NOT NULL,
	"label" varchar(200) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"fabric_skin_id" uuid,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"silhouette_template_id" uuid,
	"name" varchar(200) NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"total_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "component_types" ADD CONSTRAINT "component_types_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_component_type_id_component_types_id_fk" FOREIGN KEY ("component_type_id") REFERENCES "public"."component_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_compatibility" ADD CONSTRAINT "component_compatibility_component_a_id_components_id_fk" FOREIGN KEY ("component_a_id") REFERENCES "public"."components"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_compatibility" ADD CONSTRAINT "component_compatibility_component_b_id_components_id_fk" FOREIGN KEY ("component_b_id") REFERENCES "public"."components"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_fabric_categories" ADD CONSTRAINT "component_fabric_categories_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_fabric_categories" ADD CONSTRAINT "component_fabric_categories_fabric_skin_category_id_fabric_skin_categories_id_fk" FOREIGN KEY ("fabric_skin_category_id") REFERENCES "public"."fabric_skin_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fabric_skin_categories" ADD CONSTRAINT "fabric_skin_categories_parent_id_fabric_skin_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."fabric_skin_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fabric_skins" ADD CONSTRAINT "fabric_skins_category_id_fabric_skin_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."fabric_skin_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silhouette_components" ADD CONSTRAINT "silhouette_components_silhouette_id_silhouette_templates_id_fk" FOREIGN KEY ("silhouette_id") REFERENCES "public"."silhouette_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silhouette_components" ADD CONSTRAINT "silhouette_components_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silhouette_components" ADD CONSTRAINT "silhouette_components_default_fabric_skin_id_fabric_skins_id_fk" FOREIGN KEY ("default_fabric_skin_id") REFERENCES "public"."fabric_skins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silhouette_templates" ADD CONSTRAINT "silhouette_templates_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silhouette_tags" ADD CONSTRAINT "silhouette_tags_silhouette_id_silhouette_templates_id_fk" FOREIGN KEY ("silhouette_id") REFERENCES "public"."silhouette_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silhouette_tags" ADD CONSTRAINT "silhouette_tags_tag_value_id_tag_values_id_fk" FOREIGN KEY ("tag_value_id") REFERENCES "public"."tag_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_values" ADD CONSTRAINT "tag_values_dimension_id_tag_dimensions_id_fk" FOREIGN KEY ("dimension_id") REFERENCES "public"."tag_dimensions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_components" ADD CONSTRAINT "product_components_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_components" ADD CONSTRAINT "product_components_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_components" ADD CONSTRAINT "product_components_fabric_skin_id_fabric_skins_id_fk" FOREIGN KEY ("fabric_skin_id") REFERENCES "public"."fabric_skins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_silhouette_template_id_silhouette_templates_id_fk" FOREIGN KEY ("silhouette_template_id") REFERENCES "public"."silhouette_templates"("id") ON DELETE no action ON UPDATE no action;
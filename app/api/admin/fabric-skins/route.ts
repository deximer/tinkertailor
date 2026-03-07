import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import { fabricSkins, silhouetteComponents } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";

const viewerSettingsSchema = z
  .object({
    textureType: z.enum([
      "silk",
      "satin",
      "cotton",
      "linen",
      "chiffon",
      "velvet",
      "denim",
      "wool",
      "solid",
    ]),
    color: z.string(),
    roughness: z.number(),
    metalness: z.number(),
    sheen: z.number().optional(),
    sheenRoughness: z.number().optional(),
    sheenColor: z.string().optional(),
    transmission: z.number().optional(),
    thickness: z.number().optional(),
  })
  .nullable()
  .optional();

const returningFields = {
  id: fabricSkins.id,
  name: fabricSkins.name,
  fabricCode: fabricSkins.fabricCode,
  categoryId: fabricSkins.categoryId,
  modelType: fabricSkins.modelType,
  priceMarkup: fabricSkins.priceMarkup,
  hidden: fabricSkins.hidden,
  viewerSettings: fabricSkins.viewerSettings,
  createdAt: fabricSkins.createdAt,
};

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const rows = await db
      .select(returningFields)
      .from(fabricSkins)
      .orderBy(fabricSkins.name);

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[admin/fabric-skins] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  fabricCode: z.string().min(1).max(50),
  categoryId: z.string().uuid(),
  modelType: z.string().max(50).nullable().optional(),
  priceMarkup: z.string().default("0"),
  hidden: z.boolean().default(false),
  viewerSettings: viewerSettingsSchema,
});

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  fabricCode: z.string().min(1).max(50).optional(),
  categoryId: z.string().uuid().optional(),
  modelType: z.string().max(50).nullable().optional(),
  priceMarkup: z.string().optional(),
  hidden: z.boolean().optional(),
  viewerSettings: viewerSettingsSchema,
});

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = createSchema.parse(await request.json());

    const [existing] = await db
      .select({ id: fabricSkins.id })
      .from(fabricSkins)
      .where(eq(fabricSkins.fabricCode, body.fabricCode))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "Fabric code already exists", fabricCode: body.fabricCode },
        { status: 409 },
      );
    }

    const [row] = await db
      .insert(fabricSkins)
      .values({
        name: body.name,
        fabricCode: body.fabricCode,
        categoryId: body.categoryId,
        modelType: body.modelType ?? null,
        priceMarkup: body.priceMarkup,
        hidden: body.hidden,
        viewerSettings: body.viewerSettings ?? null,
      })
      .returning(returningFields);

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    console.error("[admin/fabric-skins] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = updateSchema.parse(await request.json());

    if (body.fabricCode !== undefined) {
      const [existing] = await db
        .select({ id: fabricSkins.id })
        .from(fabricSkins)
        .where(eq(fabricSkins.fabricCode, body.fabricCode))
        .limit(1);

      if (existing && existing.id !== body.id) {
        return NextResponse.json(
          { error: "Fabric code already exists", fabricCode: body.fabricCode },
          { status: 409 },
        );
      }
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.fabricCode !== undefined) updates.fabricCode = body.fabricCode;
    if (body.categoryId !== undefined) updates.categoryId = body.categoryId;
    if (body.modelType !== undefined) updates.modelType = body.modelType;
    if (body.priceMarkup !== undefined) updates.priceMarkup = body.priceMarkup;
    if (body.hidden !== undefined) updates.hidden = body.hidden;
    if (body.viewerSettings !== undefined)
      updates.viewerSettings = body.viewerSettings;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    const [row] = await db
      .update(fabricSkins)
      .set(updates)
      .where(eq(fabricSkins.id, body.id))
      .returning(returningFields);

    if (!row) {
      return NextResponse.json(
        { error: "Fabric skin not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(row);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: err.issues },
        { status: 400 },
      );
    }
    console.error("[admin/fabric-skins] PUT error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id query param required" },
        { status: 400 },
      );
    }

    const [linked] = await db
      .select({ value: count() })
      .from(silhouetteComponents)
      .where(eq(silhouetteComponents.defaultFabricSkinId, id));

    if (linked.value > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete fabric skin referenced as default in silhouette components",
          linkedCount: linked.value,
        },
        { status: 409 },
      );
    }

    const [row] = await db
      .delete(fabricSkins)
      .where(eq(fabricSkins.id, id))
      .returning({ id: fabricSkins.id });

    if (!row) {
      return NextResponse.json(
        { error: "Fabric skin not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/fabric-skins] DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

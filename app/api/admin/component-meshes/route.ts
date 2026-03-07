import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { componentMeshes, components } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@supabase/supabase-js";

const variantEnum = z.enum(["heavy", "light", "standard"]);

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getPublicUrl(storagePath: string): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${url}/storage/v1/object/public/models/${storagePath}`;
}

export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const componentId = searchParams.get("componentId");

    // Bulk mode: return distinct component IDs that have at least one mesh
    if (!componentId) {
      const rows = await db
        .selectDistinct({ componentId: componentMeshes.componentId })
        .from(componentMeshes);
      return NextResponse.json(rows.map((r) => r.componentId));
    }

    const rows = await db
      .select({
        id: componentMeshes.id,
        componentId: componentMeshes.componentId,
        variant: componentMeshes.variant,
        storagePath: componentMeshes.storagePath,
        createdAt: componentMeshes.createdAt,
      })
      .from(componentMeshes)
      .where(eq(componentMeshes.componentId, componentId))
      .orderBy(componentMeshes.variant);

    const result = rows.map((row) => ({
      ...row,
      publicUrl: getPublicUrl(row.storagePath),
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("[admin/component-meshes] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const formData = await request.formData();
    const componentId = formData.get("componentId") as string | null;
    const variant = formData.get("variant") as string | null;
    const file = formData.get("file") as File | null;

    if (!componentId || !variant || !file) {
      return NextResponse.json(
        { error: "componentId, variant, and file are required" },
        { status: 400 },
      );
    }

    // Validate variant
    const parsedVariant = variantEnum.safeParse(variant);
    if (!parsedVariant.success) {
      return NextResponse.json(
        { error: "Invalid variant. Must be: heavy, light, or standard" },
        { status: 400 },
      );
    }

    // Validate componentId is a UUID
    const uuidSchema = z.string().uuid();
    const parsedId = uuidSchema.safeParse(componentId);
    if (!parsedId.success) {
      return NextResponse.json(
        { error: "Invalid componentId" },
        { status: 400 },
      );
    }

    // Look up the component to get its code for the storage path
    const [component] = await db
      .select({ id: components.id, code: components.code })
      .from(components)
      .where(eq(components.id, componentId))
      .limit(1);

    if (!component) {
      return NextResponse.json(
        { error: "Component not found" },
        { status: 404 },
      );
    }

    const legacyCode = component.code;
    const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '.obj';
    const storagePath = `${legacyCode}/${parsedVariant.data}${ext}`;

    // Upload to Supabase Storage
    const supabase = getServiceClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("models")
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

    if (uploadError) {
      console.error("[admin/component-meshes] Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file", details: uploadError.message },
        { status: 500 },
      );
    }

    // Upsert the component_meshes row
    const [existing] = await db
      .select({ id: componentMeshes.id })
      .from(componentMeshes)
      .where(
        and(
          eq(componentMeshes.componentId, componentId),
          eq(componentMeshes.variant, parsedVariant.data),
        ),
      )
      .limit(1);

    let row;
    if (existing) {
      [row] = await db
        .update(componentMeshes)
        .set({ storagePath })
        .where(eq(componentMeshes.id, existing.id))
        .returning({
          id: componentMeshes.id,
          componentId: componentMeshes.componentId,
          variant: componentMeshes.variant,
          storagePath: componentMeshes.storagePath,
          createdAt: componentMeshes.createdAt,
        });
    } else {
      [row] = await db
        .insert(componentMeshes)
        .values({
          componentId,
          variant: parsedVariant.data,
          storagePath,
        })
        .returning({
          id: componentMeshes.id,
          componentId: componentMeshes.componentId,
          variant: componentMeshes.variant,
          storagePath: componentMeshes.storagePath,
          createdAt: componentMeshes.createdAt,
        });
    }

    return NextResponse.json(
      { ...row, publicUrl: getPublicUrl(row.storagePath) },
      { status: existing ? 200 : 201 },
    );
  } catch (err) {
    console.error("[admin/component-meshes] POST error:", err);
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

    // Find the mesh row to get storagePath
    const [mesh] = await db
      .select({
        id: componentMeshes.id,
        storagePath: componentMeshes.storagePath,
      })
      .from(componentMeshes)
      .where(eq(componentMeshes.id, id))
      .limit(1);

    if (!mesh) {
      return NextResponse.json(
        { error: "Mesh not found" },
        { status: 404 },
      );
    }

    // Delete from Supabase Storage
    const supabase = getServiceClient();
    const { error: storageError } = await supabase.storage
      .from("models")
      .remove([mesh.storagePath]);

    if (storageError) {
      console.error("[admin/component-meshes] Storage delete error:", storageError);
      // Continue with DB deletion even if storage delete fails
    }

    // Delete the DB row
    await db
      .delete(componentMeshes)
      .where(eq(componentMeshes.id, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/component-meshes] DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

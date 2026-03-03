import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";

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

export async function POST(request: Request) {
  const supabaseAuth = await createAuthClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const results: { name: string; ok: boolean; error?: string }[] = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage
      .from("models")
      .upload(file.name, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

    results.push({
      name: file.name,
      ok: !error,
      error: error?.message,
    });
  }

  const hasErrors = results.some((r) => !r.ok);
  return NextResponse.json(results, { status: hasErrors ? 207 : 200 });
}

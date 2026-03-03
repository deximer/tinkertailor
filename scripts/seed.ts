import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SEED_USER_EMAIL;
const password = process.env.SEED_USER_PASSWORD;

if (!url || !serviceRoleKey || !email || !password) {
  console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_USER_EMAIL, SEED_USER_PASSWORD');
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Create seed user
const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (error) {
  if (error.message.includes('already been registered')) {
    console.log(`User ${email} already exists, skipping.`);
  } else {
    console.error('Failed to create user:', error.message);
    process.exit(1);
  }
} else {
  console.log(`Created user ${data.user.email} (${data.user.id})`);
}

// Create models storage bucket (public read, authenticated write)
const { error: bucketError } = await supabase.storage.createBucket('models', {
  public: true,
  fileSizeLimit: 52428800, // 50 MB
  allowedMimeTypes: [
    'application/octet-stream',  // OBJ/MTL files
    'text/plain',                // OBJ/MTL as text
    'model/obj',
  ],
});

if (bucketError) {
  if (bucketError.message.includes('already exists')) {
    console.log('Storage bucket "models" already exists, skipping.');
  } else {
    console.error('Failed to create models bucket:', bucketError.message);
    process.exit(1);
  }
} else {
  console.log('Created storage bucket "models" (public read).');
}

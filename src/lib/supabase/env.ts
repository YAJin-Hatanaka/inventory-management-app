type PublicSupabaseEnv = {
  readonly url: string;
  readonly publishableKey: string;
};

type ServiceRoleSupabaseEnv = PublicSupabaseEnv & {
  readonly serviceRoleKey: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required to connect to Supabase.`);
  }

  return value;
}

export function getPublicSupabaseEnv(): PublicSupabaseEnv {
  return {
    url: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  };
}

export function getServiceRoleSupabaseEnv(): ServiceRoleSupabaseEnv {
  return {
    ...getPublicSupabaseEnv(),
    serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";

const supabaseUrl = requireEnv("VITE_SUPABASE_URL", "http://localhost:54321");
const supabaseAnonKey = requireEnv("VITE_SUPABASE_ANON_KEY", "placeholder");

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

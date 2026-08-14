import { requireEnv } from "./env";

export const PARTYKIT_HOST = requireEnv("VITE_PARTYKIT_HOST", "localhost:1999");

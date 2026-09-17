export function assertCredentials(): void {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new Error("No Anthropic credentials found. Copy .env.example to .env and set ANTHROPIC_API_KEY.");
  }
}

import { runEpochs } from "@/lib/epoch";

export const maxDuration = 60;

// Called hourly by an external cron, and daily by Vercel Cron as a safety net (Hobby cron runs
// once a day; a run catches up to 24 missed epochs, so a daily run alone still settles every hour).
// Vercel Cron sends GET with "authorization: Bearer $CRON_SECRET", so GET and POST behave the same.
// ?dry=1 computes allocations without saving or publishing.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  try {
    return Response.json(await runEpochs({ dry }));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export const GET = POST;

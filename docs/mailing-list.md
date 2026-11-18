# Mailing list: collect signups in Cycle Beast

**Recommended setup:** the website's signup form sends each email address to **Cycle Beast**,
which stores it (with when and where they signed up, and what they agreed to) and links it to
the customer if that email is already on file. You own the list, it sits next to your customers
and sales, and you can export it at any time.

To actually **send** newsletters you still need an email service (Cycle Beast can't send
email): export the list from Cycle Beast and import it into **Brevo** or **MailerLite** (both
have free plans), which handle sending, unsubscribe links and deliverability.

```
cyclecentral.ph signup ──POST──▶ Cycle Beast /api/newsletter/subscribe ──▶ Subscriber table
                                                                              │
                                     Owner downloads /api/newsletter/export ◀─┘ (CSV)
                                                                              │
                                                       import into Brevo / MailerLite ──▶ send
```

The website side is ready. It only needs the Cycle Beast part below, then one setting.

---

## 1. Cycle Beast: add the subscriber table

In `prisma/schema.prisma`:

```prisma
// People who asked for Cycle Central's emails on the website. One row per address;
// unsubscribing keeps the row (with the date) so they're never re-added by mistake.
model Subscriber {
  id             String           @id @default(cuid())
  email          String           @unique
  status         SubscriberStatus @default(SUBSCRIBED)
  source         String?          // the page on cyclecentral.ph where they signed up
  consentText    String           // the wording they agreed to (Data Privacy Act record)
  consentAt      DateTime         @default(now())
  ip             String?
  unsubscribedAt DateTime?
  customerId     String?
  customer       Customer?        @relation(fields: [customerId], references: [id], onDelete: SetNull)
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  @@index([status])
  @@index([ip, createdAt])
}

enum SubscriberStatus {
  SUBSCRIBED
  UNSUBSCRIBED
}
```

and in `model Customer`, add the other side of the link:

```prisma
  subscriptions Subscriber[]
```

Then create the migration: `npx prisma migrate dev --name subscribers` (and deploy as usual).

## 2. Cycle Beast: the signup endpoint (public)

`src/app/api/newsletter/subscribe/route.ts`. `proxy.ts` already skips `/api`, so it's reachable
without signing in. It only accepts requests from cyclecentral.ph, ignores bots that fill in the
form's hidden trap field, and allows at most 5 new signups an hour per network address.

```ts
import { db } from "@/lib/db";

// Mailing list signups from the Cycle Central website (cyclecentral.ph). Public: no sign-in.
const ALLOWED_ORIGINS = ["https://cyclecentral.ph", "https://www.cyclecentral.ph"];
// Must match the sentence next to the website's Subscribe button
const CONSENT = "By subscribing you agree to get emails from Cycle Central. Unsubscribe anytime.";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_NEW_PER_IP_PER_HOUR = 5;

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}
const reply = (body: { ok: boolean; error?: string }, status: number, origin: string | null) =>
  Response.json(body, { status, headers: corsHeaders(origin) });

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return reply({ ok: false, error: "Not allowed." }, 403, origin);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply({ ok: false, error: "Please enter your email address." }, 400, origin);
  }
  // Real people never see the "website" box; bots fill it in. Pretend it worked.
  if (String(form.get("website") ?? "").trim()) return reply({ ok: true }, 200, origin);

  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) {
    return reply({ ok: false, error: "Please enter a valid email address." }, 400, origin);
  }
  const source = String(form.get("source") ?? "").slice(0, 200) || null;
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;

  const existing = await db.subscriber.findUnique({ where: { email }, select: { id: true } });
  if (!existing && ip) {
    const recent = await db.subscriber.count({ where: { ip, createdAt: { gte: new Date(Date.now() - 60 * 60_000) } } });
    if (recent >= MAX_NEW_PER_IP_PER_HOUR) {
      return reply({ ok: false, error: "Too many signups from this network. Please try again later." }, 429, origin);
    }
  }

  const customer = await db.customer.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });

  await db.subscriber.upsert({
    where: { email },
    create: { email, source, ip, consentText: CONSENT, customerId: customer?.id ?? null },
    update: {
      status: "SUBSCRIBED",
      unsubscribedAt: null,
      consentText: CONSENT,
      consentAt: new Date(),
      ...(source ? { source } : {}),
      ...(customer ? { customerId: customer.id } : {}),
    },
  });

  return reply({ ok: true }, 200, origin);
}
```

## 3. Cycle Beast: download the list (owner only)

`src/app/api/newsletter/export/route.ts`. Open
`https://cycle-beast.vercel.app/api/newsletter/export` while signed in as the owner to download a
CSV of everyone subscribed, ready to import into Brevo or MailerLite.

```ts
import { db } from "@/lib/db";
import { requireRole } from "@/lib/require-role";

export async function GET() {
  await requireRole(["OWNER_ADMIN"]);
  const rows = await db.subscriber.findMany({
    where: { status: "SUBSCRIBED" },
    orderBy: { consentAt: "asc" },
    include: { customer: { select: { name: true } } },
  });
  // Quote every value, and stop spreadsheet apps from running a value as a formula
  const cell = (v: unknown) => {
    const s = String(v ?? "");
    return `"${(/^[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`;
  };
  const lines = [
    "email,name,source,subscribed_at",
    ...rows.map((r) => [r.email, r.customer?.name, r.source, r.consentAt.toISOString()].map(cell).join(",")),
  ];
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cycle-central-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
```

When someone unsubscribes through the email service (or asks you directly), set their row to
`UNSUBSCRIBED` with the date, so they're left out of the next export. A small "Subscribers" screen
in Cycle Beast with an Unsubscribe button is a nice next step.

## 4. Website: switch the signup on

In this repo, `js/data.js` → `newsletter`:

```js
action: "https://cycle-beast.vercel.app/api/newsletter/subscribe",
emailField: "email",
cors: true,
```

Push, and the signup appears in the footer, on the home page and on the blog. With `cors: true`
the website reads Cycle Beast's reply, so "already used", "invalid email" or "server down"
messages are shown to the shopper instead of a false "thanks". Each signup also sends which page
it came from (`source`) and a hidden bot trap (`website`).

## Privacy (Data Privacy Act)

- Each row keeps the exact consent sentence, when they agreed and where, which is your record of consent.
- Everyone can unsubscribe at any time (the email service adds the link to every email), and you
  should delete or unsubscribe anyone who asks.
- The website's privacy notice (`/privacy/`) already describes the mailing list.

## Prefer not to touch Cycle Beast?

Use an email service's own signup form instead: create a free Brevo or MailerLite form, copy its
`action="..."` URL and email field name into `newsletter` (with `cors: false`). Signups then live
in that service only.

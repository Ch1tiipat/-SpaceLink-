## สรุปการเปลี่ยนแปลง / Summary

<!-- What changed and why. One or two sentences is enough. -->

Ticket: SCRUM-

## Seam interfaces touched

<!--
A "seam" is an interface with a swappable implementation behind an env
variable. Changing one changes every provider bound to it, including ones
nobody has written yet — so name it here even if you only added a field.

  - SlipVerifier      src/slips/slip-verifier.interface.ts     (SLIP_VERIFIER)
  - ZoneRecommender   src/ai/zone-recommender.interface.ts     (ZONE_RECOMMENDER)

Write "none" if this PR touches neither.
-->

None.

## Definition of Done

Every box is a rule from AGENTS.md. Leave a box unticked and say why rather
than ticking it optimistically — a wrong "done" costs the team more than a
clear failure (§2.6).

**Verification** — paste real output, do not assert (§2.6, §10)

- [ ] `npm run build` exits 0
- [ ] `npm test` exits 0
- [ ] Output pasted below, not summarised

**Scope** (§2.3, §2.4)

- [ ] Builds only what the ticket asked for — no extra endpoints, no
      refactors of untouched files
- [ ] No new package installed without being named and approved first

**Schema** (§2.1, §2.2)

- [ ] `prisma/schema.prisma` is unchanged
- [ ] No `migrate` / `db push` / `db pull` / `DROP` / `TRUNCATE` was run

**Secrets** (§2.5, §14.3)

- [ ] No real key, password or connection string in code, comments,
      `.env.example`, a log line, or this PR's description
- [ ] `SUPABASE_SERVICE_ROLE_KEY` appears nowhere in `apps/web` and in no
      `NEXT_PUBLIC_*` variable

**Multi-tenant isolation** (§14.2) — skip if this PR touches no org-scoped query

- [ ] `organizationId` is derived from `OrgMembership`, never from a path
      param, query string or body field
- [ ] Every org-scoped Prisma query has an explicit `where` filter on the org
- [ ] Role and membership are read from the database, not from a JWT claim (§7)

**Conventions** (§1, §6.1, §11.4)

- [ ] Module layout matches `x.module.ts` / `x.controller.ts` / `x.service.ts` / `dto/`
- [ ] Code and identifiers in English; UI copy in Thai
- [ ] Money is `Decimal(10,2)`, converted with `.toString()` — never `Float`,
      `number`, or `parseFloat`
- [ ] Every request body has a DTO (§14.4)

## Verification output

```
$ cd apps/api && npm run build

```

```
$ cd apps/api && npm test

```

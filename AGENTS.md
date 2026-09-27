# Tomurai development rules

## Read before changing code

- For any Tomurai development task, read `.agents/skills/tomurai-development/SKILL.md` and follow its request-mode routing. Read-only questions do not authorize edits. This is the canonical shared procedure for Codex and Claude Code.
- Read `docs/ssot/product-requirements.md` and the scoped Linear child ticket.
- Implement on `dev`. Never push or merge into `main`; the PO uses it for mocks.
- ADR and SSOT live here. Reader-facing specification/design docs live in `JunichiroAita/tomurai-docs`.
- Record the decision owner as Tech Lead Junichiro Aita (會田純一朗), not an AI. Do not invent legal reviews or release approvals.
- The 2026-09-26 approval adopts R01–R48, except R02 explicitly has NO family member count cap.
- The latest explicit agreement outranks historical proposal wording. G01–G06 remain evidence-based release gates.
- Work on one reviewable deliverable. Do not send an entire E workgroup to an agent.

## Preserve product and privacy boundaries

- One family group represents one deceased person/case. No member cap; third and later members add no fee.
- Solo and family pricing tiers remain distinct. Inviting someone never authorizes a charge.
- AI allowance is per group, never multiplied by membership, rejoining, or plan switches.
- Respondent, payer, record owner, consent giver, and corporate approver are different roles.
- Enforce authorization, consent, and entitlement server-side; blurred content must not be returned by APIs.
- Use only synthetic personal information in fixtures, prompts, logs, screenshots, and tests.
- Do not invent ending-note fields, legal deadlines, age limits, prices, reviewers, or release approval.
- Never publish AI-retrieved procedure changes without human review.

## Scope and safety

- Preserve the existing four public HTML files unless the ticket explicitly changes them.
- Do not open paid resources/accounts, use production data, send real messages, charge cards, or deploy without the applicable G approvals.
- Do not automatically commit, push, create/merge PRs, or change Linear status during a TAKT workflow.
- Avoid broad destructive commands. Preserve unrelated local edits.
- Secrets, invitation tokens, card data, conversation text, and user records do not belong in the repository.
- A workflow COMPLETE result only means ready for human review, never permission to release.

## Verification

- Record scoped changes in `docs/development/changes/TOM-<number>.json` and actual evidence separately; follow `docs/ssot/development-harness.md`. Run `npm run check:development -- --base <starting-HEAD>` before handoff. The check is not a sandbox or release approval.
- Run `npm test`, `npm run check`, and ticket-specific checks. Baseline checks are not app acceptance tests.
- For workflow edits, run `takt workflow doctor .takt/workflows/tomurai-small-change.yaml` with TAKT 0.49.0.
- Record actual commands/results and remaining failures; do not mark unexecuted tests as passing.
- Use `docs/development/task-template.md` and keep the source R/C IDs and applicable G gates traceable.
- Ordinary implementation details may proceed within scope; new pricing, access, external transfer, deletion, age, spending, or scope decisions go back to the PO.

<!-- skillsrepo:detected-stack:start -->
## Detected stack for this project

- Project: `selenium-ai-agent`
- Primary language: `typescript`
- Test framework: `mocha` (user-selected)
- Deploy target: `docker`, `docker-compose`
- Available MCPs: `skillsrepo`
- Primary user: Developers, QA Engineers, and DevOps/SRE teams
- Domain: AI-driven browser automation — MCP server enabling AI agents to control browsers via Selenium

Read `.claude/context.md` for the full project context. This section is maintained by skillsrepo — edits between the markers will be overwritten on the next refinement.
<!-- skillsrepo:detected-stack:end -->

---
name: monitoring
description: Instruments code, defines SLOs, builds dashboards, and writes alerts that fire on user-visible symptoms. Covers Prometheus / Grafana, Datadog, New Relic, OpenTelemetry, Sentry, CloudWatch, Azure Monitor, and Google Cloud Operations. Use when the user says "add metrics", "wire up tracing", "set an SLO", "build a dashboard", "create an alert", "the alerts are noisy", "we have no observability", or "investigate this latency spike".
---

# Skill: monitoring

## When to use this skill
Load this skill when the task is about making the running system **legible** — what it is doing, what is wrong, and what changed:
- Adding logs, metrics, or traces to code that is being shipped
- Defining or revising SLOs / error budgets
- Building a dashboard or alert
- Triaging a production signal
- Reducing alert noise / false-positive sweeps
- Choosing or migrating an observability vendor

Do **not** use this skill for:
- Application deploys → `.claude/skills/deploy/SKILL.md`
- Infrastructure provisioning → `.claude/skills/iac/SKILL.md`
- Diagnosing a bug from a known reproducer → `.claude/skills/debug/SKILL.md` (this skill is upstream — it tells you a bug exists)

## The four signals (Google SRE)
Every user-facing service emits these:

1. **Latency** — how long a request takes. Always a histogram, never an average. Track p50, p95, p99.
2. **Traffic** — request rate. Counter, segmented by endpoint and status class.
3. **Errors** — failure rate. Counter, segmented by reason (not just code).
4. **Saturation** — how full the resource is. Gauge, per resource (CPU, memory, queue depth, connection pool).

If you can answer these four with one query each, you have working observability.

## The three pillars

| Pillar  | What it answers                | Tool examples                                     |
|---------|--------------------------------|---------------------------------------------------|
| Logs    | What happened, in detail       | Loki, ELK, CloudWatch Logs, Datadog Logs          |
| Metrics | What is the trend, in numbers  | Prometheus, Datadog, CloudWatch Metrics           |
| Traces  | Where time was spent, per req  | Tempo, Jaeger, Datadog APM, OpenTelemetry Collector |

Errors get their own special tool: **Sentry / Bugsnag / Rollbar** — exception aggregation with stack traces and release attribution.

## SLOs — the discipline
An SLO is a **promise** about user-visible behaviour, with a budget for failure.

```
SLO: 99.5% of /checkout requests complete in under 400ms over a 30-day window.
Error budget: 0.5% × 30 days × traffic ≈ N requests can be slow before we breach.
```

Rules:
- One SLO per critical user journey, not per service
- Numbers come from the product-owner (what users tolerate), not from current performance
- Track **error budget burn rate** — burning 10% in 1 hour is an emergency; burning 10% in 10 days is fine
- Breach → freeze risky changes until budget is replenished
- Review SLOs quarterly — too easy means they don't catch real problems; too hard means alert fatigue

## Alert hygiene — the iron rules

**1. Alert on symptoms, not causes.**
- Symptom: error rate on /checkout > 1% — page someone
- Cause: CPU on db-1 > 80% — dashboard, not page (it might be fine)

**2. Every page must require human action.**
If a runbook says "wait 5 minutes and see if it self-resolves", it should not page. Auto-remediate or delete it.

**3. Every alert has a runbook entry.**
A one-line "what to check first" in `docs/runbook.md`, keyed by alert name. No runbook → no alert.

**4. Alert on rate, with duration.**
Not "error rate > 1%" — "error rate > 1% for 5 minutes". Single-spike alerts are noise.

**5. Use multi-window burn-rate alerts for SLOs.**
Page on fast-burn (2% of monthly budget in 1 hour) AND slow-burn (10% in 6 hours). The fast one catches outages; the slow one catches grinding regressions.

**6. Suppress alerts during planned events.**
Deploys, migrations, maintenance windows — silence the alerts, not the signals.

## Instrumentation patterns

### Structured logs
```ts
logger.info("checkout.completed", {
  user_id_hash: hash(userId),       // never raw PII
  order_id: orderId,
  amount_cents: amountCents,
  latency_ms: Date.now() - start,
  trace_id: span.traceId,
});
```
- One event = one log line
- Stable event name (`checkout.completed`), structured fields
- Always include `trace_id` so logs ↔ traces join

### Metrics — RED method (request-driven)
- **R**ate of requests
- **E**rror rate
- **D**uration distribution

```
http_request_duration_seconds{route="/checkout", method="POST", status="2xx"}  histogram
http_requests_total{route="/checkout", method="POST", status="2xx"}            counter
checkout_errors_total{reason="payment_declined"}                                counter
```

### Metrics — USE method (resource-driven)
- **U**tilization
- **S**aturation
- **E**rrors

```
db_connections_in_use / db_connections_max     gauge
queue_depth                                    gauge
disk_usage_ratio                               gauge
```

### Traces — OpenTelemetry
```ts
const tracer = trace.getTracer("checkout");
await tracer.startActiveSpan("checkout.process", async (span) => {
  span.setAttribute("user.id_hash", hash(userId));
  span.setAttribute("checkout.amount_cents", amountCents);
  try {
    return await processCheckout(...);
  } catch (err) {
    span.recordException(err as Error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw err;
  } finally {
    span.end();
  }
});
```

## Cardinality — the silent killer
Every label combination becomes a separate time series. Bad labels:
- `user_id` — millions of series
- `request_id` — every request its own series
- `error_message` — free-text explosions

Good labels:
- `route` — bounded set
- `status_class` (`2xx`, `4xx`, `5xx`) — five values
- `error_reason` — enum from your code, not exception text

Rule of thumb: a metric with > ~10k label combinations is a bug.

## PII / secrets — what NEVER goes to telemetry
- Email addresses, phone numbers, full names, addresses
- Authorization headers, cookies, session tokens, API keys
- Full request or response bodies (they will contain the above)
- Stripe / PSP payloads, SSNs, dates of birth, health data

If you need to identify a user: hash the ID with a per-environment salt, or use an opaque internal user pseudonym. Document the choice.

## Dashboard structure
One dashboard answers one question. Common ones:
- **Service health** — RED for the service, plus saturation
- **User journey** — funnel: requests → success → business outcome (e.g. orders placed)
- **SLO burn** — error budget remaining + burn rate over multiple windows
- **Deploy verification** — same metrics as service health, with a deploy-marker overlay

Anti-pattern: the "kitchen sink" dashboard with 40 panels — nobody reads it.

## Pre-ship observability checklist
- [ ] Critical user journey emits structured logs at every boundary
- [ ] RED metrics for every public endpoint
- [ ] USE metrics for every owned resource (db pool, cache, queue)
- [ ] Trace spans across every external call (DB, cache, third-party, queue)
- [ ] No high-cardinality labels (`user_id`, `request_id`, free text)
- [ ] No PII or secrets in logs / metrics / traces — verified by grep + review
- [ ] SLO defined (or explicitly waived by product-owner)
- [ ] Dashboard tile exists; URL in PR description
- [ ] At least one symptom alert; runbook entry written

## Triage workflow (alert fired)
1. **Confirm the signal** — is the dashboard showing the same picture?
2. **Scope** — which endpoints, users, region, version
3. **Correlate** — recent deploy? infra change? upstream incident?
4. **Decide** — burn rate fast enough to need rollback now, or can we patch?
5. **Hand off** — code → developer; deploy → devops; capacity → devops/iac
6. **Verify** — signal returns to within SLO before declaring resolved
7. **Learn** — update runbook; file an ADR if structural

## Vendor cheat-sheet

### Prometheus + Grafana
```yaml
# Recording rule for SLI
- record: sli:checkout:success_ratio_5m
  expr: sum(rate(http_requests_total{route="/checkout",status=~"2.."}[5m]))
      / sum(rate(http_requests_total{route="/checkout"}[5m]))

# Alert (fast burn — 2% budget in 1h)
- alert: CheckoutFastBurn
  expr: (1 - sli:checkout:success_ratio_5m) > (14.4 * 0.005)
  for: 2m
  annotations:
    runbook: https://repo/docs/runbook.md#checkout-errors
```

### OpenTelemetry (vendor-neutral)
- Library: `@opentelemetry/api` + `@opentelemetry/sdk-node`
- Export to Tempo / Jaeger / Datadog / New Relic via OTLP
- Always: `service.name`, `service.version`, `deployment.environment`

### Sentry
```ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.GIT_SHA,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,                  // 10% APM, dial up for low traffic
  beforeSend: scrubPII,                   // redact before send, always
});
```

### Datadog
- Tag everything: `env`, `service`, `version` (the unified service tagging trio)
- DogStatsD for metrics, dd-trace for APM, dd-agent for logs
- Use `@param` log attributes for searchable structure

### CloudWatch / Azure Monitor / Google Cloud Operations
- Native to the cloud, cheaper for cloud-resident workloads
- Embedded Metric Format (EMF, AWS) lets you log + emit metric in one event
- Use the cloud's tracing service (X-Ray / App Insights / Cloud Trace) for first-party services

## Handoffs
- Receive from **developer** for pre-ship instrumentation review
- Receive from **devops** when a deploy fires alerts
- Receive from **product-owner** when an SLO needs setting or revisiting
- Hand to **developer** if a signal traces to a code regression
- Hand to **devops** if a signal traces to deploy or saturation
- Hand to **iac** if a signal traces to under-provisioned infrastructure
- Escalate to user during active SLO breaches affecting paying customers

## What you never do
- Never alert on causes (CPU high) when you can alert on symptoms (users seeing errors)
- Never create an alert without a runbook entry
- Never log or emit PII, secrets, or unbounded user-supplied strings
- Never use unbounded labels (`user_id`, `request_id`, free-text errors)
- Never silence an alert without a follow-up to fix the underlying noise
- Never claim a deploy is healthy from green CI alone — verify the post-deploy signals
- Never silently drop telemetry to "save cost" — flag the trade-off and get a decision

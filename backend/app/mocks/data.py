"""Comprehensive mock data for BookManager (March 2026 baseline)."""
from __future__ import annotations

import random
from datetime import date, datetime, timedelta

from app.models.account import Account, UseCase, PSNote, AccountResource
from app.models.gong import GongCall
from app.models.credit import AccountFeatureUsage, CreditConsumption
from app.models.prediction import (
    CreditForecast,
    SimilarDeployment,
    TMRSuccessPrediction,
    UseCaseCompletionPrediction,
)
from app.models.tmr import TMR

TODAY = date(2026, 3, 30)
TEAM_WEST = "team-west"

# Reference roster for UI / auth context (manager oversees team-west field ACEs).
MOCK_ACE_USERS: list[dict[str, str]] = [
    {
        "user_id": "ace-jane",
        "display_name": "Jane Smith",
        "role": "ACE",
        "team_id": TEAM_WEST,
    },
    {
        "user_id": "ace-carlos",
        "display_name": "Carlos Rodriguez",
        "role": "ACE",
        "team_id": TEAM_WEST,
    },
    {
        "user_id": "acem-mark",
        "display_name": "Mark Johnson",
        "role": "ACEM",
        "team_id": TEAM_WEST,
    },
]


def _d(y: int, m: int, day: int) -> date:
    return date(y, m, day)


def _dt(d: date, hour: int = 15, minute: int = 0) -> datetime:
    return datetime(d.year, d.month, d.day, hour, minute, 0)


def generate_daily_credit_consumption(
    account_id: str,
    *,
    measurement_anchor: date,
    days: int = 90,
    base_daily: float,
    trend_per_day: float,
    noise_std: float,
    credits_allocated: float,
    warehouse_name: str,
    seed: int,
) -> list[CreditConsumption]:
    """Build ``days`` daily rows ending on ``measurement_anchor`` with trend + noise."""
    rng = random.Random(seed)
    out: list[CreditConsumption] = []
    prev_raw: float | None = None
    for i in range(days):
        day = measurement_anchor - timedelta(days=days - 1 - i)
        trend_offset = trend_per_day * i
        raw = max(40.0, base_daily + trend_offset + rng.gauss(0.0, noise_std))
        compute = raw * 0.71
        storage = raw * 0.19
        cloud = raw * 0.10
        daily_trend = ((raw - prev_raw) / prev_raw * 100.0) if prev_raw else 0.0
        monthly_proxy = trend_per_day * 30.0 / max(base_daily, 1.0) * 100.0
        out.append(
            CreditConsumption(
                account_id=account_id,
                measurement_date=day,
                credits_used=round(raw, 2),
                credits_allocated=credits_allocated,
                warehouse_name=warehouse_name,
                compute_credits=round(compute, 2),
                storage_credits=round(storage, 2),
                cloud_services_credits=round(cloud, 2),
                daily_trend=round(daily_trend, 4),
                monthly_trend=round(monthly_proxy + rng.uniform(-0.8, 0.8), 4),
            )
        )
        prev_raw = raw
    return out


MOCK_ACCOUNTS: list[Account] = [
    Account(
        account_id="acc-jane-fs",
        account_name="Summit Trust Bank",
        industry="Financial Services",
        ace_assigned="ace-jane",
        engagement_status="Active",
        status="Active",
        use_case_count=3,
        total_credits_allocated=920_000.0,
        activation_start_date=_d(2025, 9, 8),
        region="US-West",
    ),
    Account(
        account_id="acc-jane-hc",
        account_name="AuroraCare Health Network",
        industry="Healthcare",
        ace_assigned="ace-jane",
        engagement_status="Pre-Activation",
        status="Onboarding",
        use_case_count=2,
        total_credits_allocated=410_000.0,
        activation_start_date=_d(2026, 1, 22),
        region="US-East",
    ),
    Account(
        account_id="acc-jane-ret",
        account_name="Cartograph Retail Group",
        industry="Retail",
        ace_assigned="ace-jane",
        engagement_status="Active",
        status="At Risk",
        use_case_count=2,
        total_credits_allocated=380_000.0,
        activation_start_date=_d(2025, 11, 3),
        region="US-Central",
    ),
    Account(
        account_id="acc-jane-tech",
        account_name="Lattice Analytics",
        industry="Technology",
        ace_assigned="ace-jane",
        engagement_status="Completed",
        status="Go Live",
        use_case_count=2,
        total_credits_allocated=650_000.0,
        activation_start_date=_d(2025, 6, 17),
        region="US-West",
    ),
    Account(
        account_id="acc-carlos-media",
        account_name="Horizon Broadcast Group",
        industry="Media",
        ace_assigned="ace-carlos",
        engagement_status="Active",
        status="Active",
        use_case_count=2,
        total_credits_allocated=540_000.0,
        activation_start_date=_d(2025, 8, 14),
        region="EU-Central",
    ),
    Account(
        account_id="acc-carlos-mfg",
        account_name="Titan Industrial IoT",
        industry="Manufacturing",
        ace_assigned="ace-carlos",
        engagement_status="Pre-Activation",
        status="Onboarding",
        use_case_count=2,
        total_credits_allocated=295_000.0,
        activation_start_date=_d(2026, 2, 10),
        region="US-Central",
    ),
    Account(
        account_id="acc-carlos-ins",
        account_name="Sentinel Mutual Insurance",
        industry="Insurance",
        ace_assigned="ace-carlos",
        engagement_status="Active",
        status="At Risk",
        use_case_count=2,
        total_credits_allocated=470_000.0,
        activation_start_date=_d(2025, 10, 1),
        region="US-East",
    ),
    Account(
        account_id="acc-carlos-tel",
        account_name="Atlas Communications",
        industry="Telecom",
        ace_assigned="ace-carlos",
        engagement_status="Completed",
        status="Go Live",
        use_case_count=3,
        total_credits_allocated=1_050_000.0,
        activation_start_date=_d(2025, 5, 4),
        region="EU-West",
    ),
]

MOCK_USE_CASES: list[UseCase] = [
    UseCase(
        use_case_id="uc-jane-fs-001",
        account_id="acc-jane-fs",
        account_name="Summit Trust Bank",
        use_case_name="Real-time Fraud Detection",
        description=(
            "Detect and flag fraudulent transactions in real-time using streaming data from Kafka "
            "into Snowpipe with ML scoring via Snowpark."
        ),
        status="On Track",
        ps_notes=[
            PSNote(
                note_id="pn-jane-fs-001-1",
                use_case_id="uc-jane-fs-001",
                author="Priya Nandakumar",
                content=(
                    "Kafka topics wired to landing tables; initial Snowpipe auto-ingest smoke tests green. "
                    "Next: wire scoring stub in Snowpark."
                ),
                created_at=_dt(_d(2026, 2, 14), 10, 15),
            ),
            PSNote(
                note_id="pn-jane-fs-001-2",
                use_case_id="uc-jane-fs-001",
                author="Daniel Okonkwo",
                content=(
                    "Reviewed fraud feature set with risk team; agreed on latency SLOs for scoring path. "
                    "Security questionnaire sent to vendor."
                ),
                created_at=_dt(_d(2026, 3, 10), 16, 0),
            ),
            PSNote(
                note_id="pn-jane-fs-001-3",
                use_case_id="uc-jane-fs-001",
                author="Priya Nandakumar",
                content="Kafka → Snowpipe landing; model scoring in Snowpark. Vendor security review scheduled 4/2.",
                created_at=_dt(_d(2026, 3, 28), 11, 20),
            ),
        ],
        ps_notes_summary=(
            "Core pipeline is operational with Kafka ingestion working well. ML scoring in Snowpark showing "
            "promising accuracy. Main risk is the vendor security review on 4/2 which could affect go-live "
            "timeline. Data quality from Kafka has been stable."
        ),
        go_live_date=None,
        target_go_live_date=_d(2026, 5, 15),
        lead_se="Priya Nandakumar",
        ace_assigned="ace-jane",
        created_date=_d(2025, 10, 1),
        last_modified_date=_dt(_d(2026, 3, 28), 11, 20),
        stage="Impl In Progress",
        complexity="High",
    ),
    UseCase(
        use_case_id="uc-jane-fs-002",
        account_id="acc-jane-fs",
        account_name="Summit Trust Bank",
        use_case_name="AML Watchlist & Transaction Monitoring",
        description=(
            "Monitor transaction patterns against global regulatory watchlists for anti-money laundering "
            "compliance using entity resolution and graph analytics."
        ),
        status="In Progress",
        ps_notes=[
            PSNote(
                note_id="pn-jane-fs-002-1",
                use_case_id="uc-jane-fs-002",
                author="Priya Nandakumar",
                content=(
                    "Watchlist ingest pipelines stable; graph schema drafted for party-to-party links. "
                    "Profiling entity resolution batch runtime."
                ),
                created_at=_dt(_d(2026, 2, 13), 9, 30),
            ),
            PSNote(
                note_id="pn-jane-fs-002-2",
                use_case_id="uc-jane-fs-002",
                author="Priya Nandakumar",
                content=(
                    "Entity resolution jobs trending 40% over POC estimates on peak days. "
                    "Considering incremental vs full recompute tradeoffs."
                ),
                created_at=_dt(_d(2026, 3, 6), 14, 45),
            ),
            PSNote(
                note_id="pn-jane-fs-002-3",
                use_case_id="uc-jane-fs-002",
                author="Priya Nandakumar",
                content="Entity resolution slower than planned; evaluating Dynamic Tables vs incremental tasks.",
                created_at=_dt(_d(2026, 3, 27), 9, 5),
            ),
        ],
        ps_notes_summary=(
            "Entity resolution performance is the main bottleneck. The team is evaluating Dynamic Tables "
            "as an alternative to incremental tasks for better throughput. Watchlist matching logic is "
            "solid but needs optimization for production scale."
        ),
        go_live_date=None,
        target_go_live_date=_d(2026, 7, 1),
        lead_se="Priya Nandakumar",
        ace_assigned="ace-jane",
        created_date=_d(2025, 11, 18),
        last_modified_date=_dt(_d(2026, 3, 27), 9, 5),
        stage="Technical Win",
        complexity="Medium",
    ),
    UseCase(
        use_case_id="uc-jane-fs-003",
        account_id="acc-jane-fs",
        account_name="Summit Trust Bank",
        use_case_name="Regulatory Reporting Data Mart",
        description=(
            "Build consolidated data marts for regulatory reporting across Basel III, CCAR, and DFAST requirements."
        ),
        status="On Track",
        ps_notes=[
            PSNote(
                note_id="pn-jane-fs-003-1",
                use_case_id="uc-jane-fs-003",
                author="Daniel Okonkwo",
                content=(
                    "Kicked off mart design workshops with finance; mapped source systems for Basel and CCAR feeds."
                ),
                created_at=_dt(_d(2026, 2, 15), 11, 0),
            ),
            PSNote(
                note_id="pn-jane-fs-003-2",
                use_case_id="uc-jane-fs-003",
                author="Daniel Okonkwo",
                content=(
                    "Core marts built for two workstreams; reconciliation checks passing in lower env. "
                    "Raised backfill window question to finance."
                ),
                created_at=_dt(_d(2026, 3, 8), 15, 20),
            ),
            PSNote(
                note_id="pn-jane-fs-003-3",
                use_case_id="uc-jane-fs-003",
                author="Daniel Okonkwo",
                content="Ahead of schedule on core marts; waiting on finance sign-off for historical backfill window.",
                created_at=_dt(_d(2026, 3, 29), 16, 40),
            ),
        ],
        ps_notes_summary=(
            "Progressing ahead of schedule. Core marts are built and tested. Only blocker is finance "
            "department sign-off on the historical data backfill window, which is administrative rather than technical."
        ),
        go_live_date=None,
        target_go_live_date=_d(2026, 4, 20),
        lead_se="Daniel Okonkwo",
        ace_assigned="ace-jane",
        created_date=_d(2026, 1, 6),
        last_modified_date=_dt(_d(2026, 3, 29), 16, 40),
        stage="Use Case Won",
        complexity="Low",
    ),
    UseCase(
        use_case_id="uc-jane-hc-001",
        account_id="acc-jane-hc",
        account_name="AuroraCare Health Network",
        use_case_name="Patient 360 Clinical Analytics",
        description=(
            "Unify clinical, claims, and patient interaction data into a comprehensive Patient 360 view "
            "for care coordination and outcomes analysis."
        ),
        status="Blocked",
        ps_notes=[
            PSNote(
                note_id="pn-jane-hc-001-1",
                use_case_id="uc-jane-hc-001",
                author="Elena Marquez",
                content=(
                    "PHI boundaries documented; primary region Snowflake objects provisioned. "
                    "Starting Databricks bridge for legacy extracts."
                ),
                created_at=_dt(_d(2026, 2, 11), 13, 0),
            ),
            PSNote(
                note_id="pn-jane-hc-001-2",
                use_case_id="uc-jane-hc-001",
                author="Priya Nandakumar",
                content=(
                    "Secondary region BAA wording under legal review; no blockers yet on dev connectivity tests."
                ),
                created_at=_dt(_d(2026, 2, 25), 10, 30),
            ),
            PSNote(
                note_id="pn-jane-hc-001-3",
                use_case_id="uc-jane-hc-001",
                author="Elena Marquez",
                content=(
                    "Legal flagged amendment needed for secondary PHI region replication. "
                    "Pausing production cutover planning until signed."
                ),
                created_at=_dt(_d(2026, 3, 12), 16, 10),
            ),
            PSNote(
                note_id="pn-jane-hc-001-4",
                use_case_id="uc-jane-hc-001",
                author="Elena Marquez",
                content="Blocked on BAA amendment for secondary PHI region; Databricks bridge paused.",
                created_at=_dt(_d(2026, 3, 25), 13, 10),
            ),
        ],
        ps_notes_summary=(
            "Technical implementation is complete but deployment is blocked on a legal BAA amendment for the "
            "secondary PHI region. The Databricks migration bridge has been paused pending this resolution. "
            "No technical risks once legal clears."
        ),
        go_live_date=None,
        target_go_live_date=_d(2026, 6, 10),
        lead_se="Elena Marquez",
        ace_assigned="ace-jane",
        created_date=_d(2026, 2, 3),
        last_modified_date=_dt(_d(2026, 3, 25), 13, 10),
        stage="Impl In Progress",
        complexity="High",
    ),
    UseCase(
        use_case_id="uc-jane-hc-002",
        account_id="acc-jane-hc",
        account_name="AuroraCare Health Network",
        use_case_name="Claims Adjudication ML Assist",
        description=(
            "Use machine learning to assist claims adjusters with automated scoring, anomaly detection, "
            "and recommended actions on incoming claims."
        ),
        status="In Progress",
        ps_notes=[
            PSNote(
                note_id="pn-jane-hc-002-1",
                use_case_id="uc-jane-hc-002",
                author="Elena Marquez",
                content=(
                    "Defined candidate features with ops; agreed on holdout strategy for adjudication labels."
                ),
                created_at=_dt(_d(2026, 2, 16), 9, 0),
            ),
            PSNote(
                note_id="pn-jane-hc-002-2",
                use_case_id="uc-jane-hc-002",
                author="Elena Marquez",
                content=(
                    "Feature store design workshop scheduled with data eng and clinical informatics leads."
                ),
                created_at=_dt(_d(2026, 3, 9), 14, 15),
            ),
            PSNote(
                note_id="pn-jane-hc-002-3",
                use_case_id="uc-jane-hc-002",
                author="Elena Marquez",
                content="Feature store design workshop completed; moving to Snowpark training pipeline.",
                created_at=_dt(_d(2026, 3, 30), 10, 0),
            ),
        ],
        ps_notes_summary=(
            "Feature store design is finalized after a successful workshop. The team is now building the "
            "Snowpark training pipeline. Early model prototypes show good accuracy on historical claims data. "
            "On track for the POC milestone."
        ),
        go_live_date=None,
        target_go_live_date=_d(2026, 8, 5),
        lead_se="Elena Marquez",
        ace_assigned="ace-jane",
        created_date=_d(2026, 2, 20),
        last_modified_date=_dt(_d(2026, 3, 30), 10, 0),
        stage="Impl Pending",
        complexity="Medium",
    ),
    UseCase(
        use_case_id="uc-jane-ret-001",
        account_id="acc-jane-ret",
        account_name="Cartograph Retail Group",
        use_case_name="Omnichannel Customer 360",
        description=(
            "Build a unified customer profile across online, in-store POS, mobile app, and loyalty program "
            "touchpoints for personalized experiences."
        ),
        status="On Track",
        ps_notes=[
            PSNote(
                note_id="pn-jane-ret-001-1",
                use_case_id="uc-jane-ret-001",
                author="Noah Ibrahim",
                content=(
                    "Online and loyalty identity stitching at target match rates; POS file drops still noisy "
                    "from a subset of stores."
                ),
                created_at=_dt(_d(2026, 2, 14), 8, 0),
            ),
            PSNote(
                note_id="pn-jane-ret-001-2",
                use_case_id="uc-jane-ret-001",
                author="Noah Ibrahim",
                content=(
                    "Graph completeness at 68%; recommended dedupe rules for mobile anonymous sessions."
                ),
                created_at=_dt(_d(2026, 3, 1), 11, 30),
            ),
            PSNote(
                note_id="pn-jane-ret-001-3",
                use_case_id="uc-jane-ret-001",
                author="Noah Ibrahim",
                content=(
                    "Store network issues caused missed POS deltas mid-month; working with IT on sustained fixes."
                ),
                created_at=_dt(_d(2026, 3, 15), 17, 0),
            ),
            PSNote(
                note_id="pn-jane-ret-001-4",
                use_case_id="uc-jane-ret-001",
                author="Noah Ibrahim",
                content="Behind on identity graph completeness; added weekend load for POS deltas.",
                created_at=_dt(_d(2026, 3, 29), 8, 15),
            ),
        ],
        ps_notes_summary=(
            "Identity graph coverage is at 72%, below the 85% target. POS delta loading has been inconsistent "
            "due to store network issues. Weekend batch loads added as a workaround. Online and loyalty data "
            "pipelines are stable. Risk of timeline slip if POS issues persist."
        ),
        go_live_date=None,
        target_go_live_date=_d(2026, 5, 28),
        lead_se="Noah Ibrahim",
        ace_assigned="ace-jane",
        created_date=_d(2025, 12, 8),
        last_modified_date=_dt(_d(2026, 3, 29), 8, 15),
        stage="Impl In Progress",
        complexity="Medium",
    ),
    UseCase(
        use_case_id="uc-jane-ret-002",
        account_id="acc-jane-ret",
        account_name="Cartograph Retail Group",
        use_case_name="Markdown & Promo Effectiveness",
        description=(
            "Analyze markdown timing and promotional campaign effectiveness to optimize pricing strategies "
            "and reduce margin erosion."
        ),
        status="In Progress",
        ps_notes=[
            PSNote(
                note_id="pn-jane-ret-002-1",
                use_case_id="uc-jane-ret-002",
                author="Noah Ibrahim",
                content=(
                    "Initial KPI definitions aligned with merchandising; dashboards drafted for promo lift."
                ),
                created_at=_dt(_d(2026, 2, 8), 12, 0),
            ),
            PSNote(
                note_id="pn-jane-ret-002-2",
                use_case_id="uc-jane-ret-002",
                author="Noah Ibrahim",
                content=(
                    "Merchandising leadership change announced; stakeholders asked to pause requirement lock."
                ),
                created_at=_dt(_d(2026, 3, 5), 15, 40),
            ),
            PSNote(
                note_id="pn-jane-ret-002-3",
                use_case_id="uc-jane-ret-002",
                author="Noah Ibrahim",
                content="Stakeholder churn in merchandising; re-baselining KPIs — risk to original timeline.",
                created_at=_dt(_d(2026, 3, 22), 17, 50),
            ),
        ],
        ps_notes_summary=(
            "Project at risk due to organizational changes in the merchandising team. KPIs are being "
            "re-baselined with new leadership. Technical work on the analytics models is paused until new "
            "requirements are confirmed."
        ),
        go_live_date=None,
        target_go_live_date=_d(2026, 4, 30),
        lead_se="Noah Ibrahim",
        ace_assigned="ace-jane",
        created_date=_d(2026, 1, 15),
        last_modified_date=_dt(_d(2026, 3, 22), 17, 50),
        stage="Impl Pending",
        complexity="Low",
    ),
    UseCase(
        use_case_id="uc-jane-tech-001",
        account_id="acc-jane-tech",
        account_name="Lattice Analytics",
        use_case_name="Product Telemetry Lakehouse",
        description=(
            "Centralize product usage telemetry from multiple SaaS products into a unified lakehouse for "
            "product analytics and customer health scoring."
        ),
        status="Completed",
        ps_notes=[
            PSNote(
                note_id="pn-jane-tech-001-1",
                use_case_id="uc-jane-tech-001",
                author="Amelia Chen",
                content=(
                    "Bronze/silver layers live for two products; streaming ingest validated in staging."
                ),
                created_at=_dt(_d(2026, 2, 7), 10, 0),
            ),
            PSNote(
                note_id="pn-jane-tech-001-2",
                use_case_id="uc-jane-tech-001",
                author="Amelia Chen",
                content=(
                    "Gold marts and customer health score v1 signed off; cutover rehearsal completed."
                ),
                created_at=_dt(_d(2026, 2, 21), 14, 30),
            ),
            PSNote(
                note_id="pn-jane-tech-001-3",
                use_case_id="uc-jane-tech-001",
                author="Amelia Chen",
                content=(
                    "Go-live executed 3/12; observing Streams spend—working with SRE on monitoring dashboards."
                ),
                created_at=_dt(_d(2026, 3, 1), 9, 45),
            ),
            PSNote(
                note_id="pn-jane-tech-001-4",
                use_case_id="uc-jane-tech-001",
                author="Amelia Chen",
                content="Went live 3/12; handover to SRE for guardrails on Streams spend.",
                created_at=_dt(_d(2026, 3, 14), 14, 0),
            ),
        ],
        ps_notes_summary=(
            "Successfully went live on 3/12, ahead of schedule. Handover to SRE is in progress with focus on "
            "setting up cost guardrails for Streams spend which has been higher than projected. Customer health "
            "scoring models are producing actionable insights."
        ),
        go_live_date=_d(2026, 3, 12),
        target_go_live_date=_d(2026, 3, 20),
        lead_se="Amelia Chen",
        ace_assigned="ace-jane",
        created_date=_d(2025, 8, 1),
        last_modified_date=_dt(_d(2026, 3, 14), 14, 0),
        stage="Deployed",
        complexity="Medium",
    ),
    UseCase(
        use_case_id="uc-jane-tech-002",
        account_id="acc-jane-tech",
        account_name="Lattice Analytics",
        use_case_name="Real-time Feature Store for Recommendations",
        description=(
            "Build a low-latency feature store serving ML features for real-time product recommendation "
            "models across web and mobile surfaces."
        ),
        status="On Track",
        ps_notes=[
            PSNote(
                note_id="pn-jane-tech-002-1",
                use_case_id="uc-jane-tech-002",
                author="Amelia Chen",
                content=(
                    "Serving API latency within SLO in load tests; feature freshness monitors wired."
                ),
                created_at=_dt(_d(2026, 2, 16), 11, 20),
            ),
            PSNote(
                note_id="pn-jane-tech-002-2",
                use_case_id="uc-jane-tech-002",
                author="Amelia Chen",
                content=(
                    "Shadow traffic comparison vs legacy cache shows sub-50ms p99 on hot features."
                ),
                created_at=_dt(_d(2026, 3, 10), 15, 0),
            ),
            PSNote(
                note_id="pn-jane-tech-002-3",
                use_case_id="uc-jane-tech-002",
                author="Amelia Chen",
                content="Ahead of schedule on serving path; canary on 5% traffic this week.",
                created_at=_dt(_d(2026, 3, 30), 9, 30),
            ),
        ],
        ps_notes_summary=(
            "Ahead of schedule. Feature serving path is operational and a canary deployment is handling 5% of "
            "production traffic with excellent latency metrics. Full rollout planned for mid-April if canary "
            "metrics hold."
        ),
        go_live_date=None,
        target_go_live_date=_d(2026, 4, 18),
        lead_se="Amelia Chen",
        ace_assigned="ace-jane",
        created_date=_d(2025, 11, 5),
        last_modified_date=_dt(_d(2026, 3, 30), 9, 30),
        stage="Go-Live",
        complexity="High",
    ),
    UseCase(
        use_case_id="uc-carlos-media-001",
        account_id="acc-carlos-media",
        account_name="Horizon Broadcast Group",
        use_case_name="Audience Segmentation & Activation",
        description=(
            "Segment viewing audiences by behavior, demographics, and content preferences for targeted "
            "advertising and content programming decisions."
        ),
        status="In Progress",
        ps_notes=[
            PSNote(
                note_id="pn-carlos-media-001-1",
                use_case_id="uc-carlos-media-001",
                author="Jordan Blake",
                content=(
                    "First-party viewing events modeled; baseline segments exported to activation partner sandbox."
                ),
                created_at=_dt(_d(2026, 2, 14), 13, 0),
            ),
            PSNote(
                note_id="pn-carlos-media-001-2",
                use_case_id="uc-carlos-media-001",
                author="Jordan Blake",
                content=(
                    "Started Cortex trial for automated content tagging on pilot catalog subset."
                ),
                created_at=_dt(_d(2026, 3, 7), 10, 5),
            ),
            PSNote(
                note_id="pn-carlos-media-001-3",
                use_case_id="uc-carlos-media-001",
                author="Jordan Blake",
                content="Cortex trial for content tagging; legal review on third-party clip usage.",
                created_at=_dt(_d(2026, 3, 28), 12, 5),
            ),
        ],
        ps_notes_summary=(
            "Cortex AI is being evaluated for automated content tagging which would significantly accelerate "
            "segmentation. Legal review on third-party content usage rights is pending, which could limit some "
            "audience data sources. Core segmentation logic is working well on first-party data."
        ),
        go_live_date=None,
        target_go_live_date=_d(2026, 6, 1),
        lead_se="Jordan Blake",
        ace_assigned="ace-carlos",
        created_date=_d(2025, 12, 1),
        last_modified_date=_dt(_d(2026, 3, 28), 12, 5),
        stage="Impl Pending",
        complexity="Medium",
    ),
    UseCase(
        use_case_id="uc-carlos-media-002",
        account_id="acc-carlos-media",
        account_name="Horizon Broadcast Group",
        use_case_name="Ad Inventory Yield Optimization",
        description=(
            "Optimize ad slot pricing and placement across linear and digital properties using demand "
            "forecasting and real-time yield management."
        ),
        status="On Track",
        ps_notes=[
            PSNote(
                note_id="pn-carlos-media-002-1",
                use_case_id="uc-carlos-media-002",
                author="Jordan Blake",
                content=(
                    "Demand forecast models trained on historical avails; daily refresh jobs stable."
                ),
                created_at=_dt(_d(2026, 2, 15), 9, 0),
            ),
            PSNote(
                note_id="pn-carlos-media-002-2",
                use_case_id="uc-carlos-media-002",
                author="Ingrid Larsson",
                content=(
                    "Yield UI pilot with revenue ops; feedback incorporated into slot scoring rules."
                ),
                created_at=_dt(_d(2026, 3, 8), 16, 30),
            ),
            PSNote(
                note_id="pn-carlos-media-002-3",
                use_case_id="uc-carlos-media-002",
                author="Jordan Blake",
                content=(
                    "Credit usage trending up with larger warehouse for peak simulations; evaluating sizing."
                ),
                created_at=_dt(_d(2026, 3, 18), 11, 15),
            ),
            PSNote(
                note_id="pn-carlos-media-002-4",
                use_case_id="uc-carlos-media-002",
                author="Jordan Blake",
                content="Stable pipelines; focusing on warehouse right-sizing before peak season.",
                created_at=_dt(_d(2026, 3, 29), 18, 0),
            ),
        ],
        ps_notes_summary=(
            "Pipelines are stable and producing reliable forecasts. Focus has shifted to cost optimization "
            "through warehouse right-sizing ahead of peak advertising season. Yield model accuracy is at 91% "
            "on holdout data."
        ),
        go_live_date=None,
        target_go_live_date=_d(2026, 5, 5),
        lead_se="Jordan Blake",
        ace_assigned="ace-carlos",
        created_date=_d(2026, 1, 8),
        last_modified_date=_dt(_d(2026, 3, 29), 18, 0),
        stage="Impl In Progress",
        complexity="High",
    ),
    UseCase(
        use_case_id="uc-carlos-mfg-001",
        account_id="acc-carlos-mfg",
        account_name="Titan Industrial IoT",
        use_case_name="Predictive Maintenance on Sensor Streams",
        description=(
            "Ingest and analyze real-time sensor data from manufacturing equipment to predict failures "
            "and schedule preventive maintenance."
        ),
        status="In Progress",
        ps_notes=[
            PSNote(
                note_id="pn-carlos-mfg-001-1",
                use_case_id="uc-carlos-mfg-001",
                author="Sofia Petrov",
                content=(
                    "Sensor topic schemas agreed with plant IT; initial stream-to-Snowflake path in lab."
                ),
                created_at=_dt(_d(2026, 2, 12), 8, 30),
            ),
            PSNote(
                note_id="pn-carlos-mfg-001-2",
                use_case_id="uc-carlos-mfg-001",
                author="Sofia Petrov",
                content=(
                    "OT firewall change ticket submitted; expect ingest window after network maintenance weekend."
                ),
                created_at=_dt(_d(2026, 3, 5), 14, 0),
            ),
            PSNote(
                note_id="pn-carlos-mfg-001-3",
                use_case_id="uc-carlos-mfg-001",
                author="Sofia Petrov",
                content="OT network firewall change delayed ingest; POC extended 2 weeks.",
                created_at=_dt(_d(2026, 3, 26), 10, 45),
            ),
        ],
        ps_notes_summary=(
            "OT/IT network segmentation is the main blocker. A firewall change request delayed sensor data "
            "ingestion, pushing the POC out by 2 weeks. When data flows, the ML models show strong predictive "
            "capability on historical failure data."
        ),
        go_live_date=None,
        target_go_live_date=_d(2026, 7, 22),
        lead_se="Sofia Petrov",
        ace_assigned="ace-carlos",
        created_date=_d(2026, 2, 18),
        last_modified_date=_dt(_d(2026, 3, 26), 10, 45),
        stage="Impl Pending",
        complexity="High",
    ),
    UseCase(
        use_case_id="uc-carlos-mfg-002",
        account_id="acc-carlos-mfg",
        account_name="Titan Industrial IoT",
        use_case_name="Supply Chain Control Tower",
        description=(
            "Build a centralized supply chain visibility dashboard integrating supplier, logistics, and "
            "inventory data for real-time decision support."
        ),
        status="On Track",
        ps_notes=[
            PSNote(
                note_id="pn-carlos-mfg-002-1",
                use_case_id="uc-carlos-mfg-002",
                author="Sofia Petrov",
                content=(
                    "Discovery workshops complete; prioritized supplier and inbound logistics feeds for v1."
                ),
                created_at=_dt(_d(2026, 2, 16), 10, 0),
            ),
            PSNote(
                note_id="pn-carlos-mfg-002-2",
                use_case_id="uc-carlos-mfg-002",
                author="Jordan Blake",
                content=(
                    "Drafted target architecture: Snowflake core + Iceberg for plant history per retention policy."
                ),
                created_at=_dt(_d(2026, 3, 10), 15, 45),
            ),
            PSNote(
                note_id="pn-carlos-mfg-002-3",
                use_case_id="uc-carlos-mfg-002",
                author="Sofia Petrov",
                content="Kicking off architecture review; Iceberg for long-retention plant history.",
                created_at=_dt(_d(2026, 3, 30), 11, 10),
            ),
        ],
        ps_notes_summary=(
            "Early stage. Architecture review is underway with Iceberg tables selected for long-retention plant "
            "history data. Supplier data integration requirements are being mapped. No risks at this stage."
        ),
        go_live_date=None,
        target_go_live_date=_d(2026, 9, 12),
        lead_se="Sofia Petrov",
        ace_assigned="ace-carlos",
        created_date=_d(2026, 3, 1),
        last_modified_date=_dt(_d(2026, 3, 30), 11, 10),
        stage="Technical Win",
        complexity="Medium",
    ),
    UseCase(
        use_case_id="uc-carlos-ins-001",
        account_id="acc-carlos-ins",
        account_name="Sentinel Mutual Insurance",
        use_case_name="Underwriting Risk Scoring",
        description=(
            "Develop ML-based risk scoring models for commercial underwriting to improve pricing accuracy "
            "and loss ratio predictions."
        ),
        status="Blocked",
        ps_notes=[
            PSNote(
                note_id="pn-carlos-ins-001-1",
                use_case_id="uc-carlos-ins-001",
                author="Marcus Webb",
                content=(
                    "Training data curated; baseline GLM and gradient boosting models benchmarked."
                ),
                created_at=_dt(_d(2026, 2, 7), 14, 0),
            ),
            PSNote(
                note_id="pn-carlos-ins-001-2",
                use_case_id="uc-carlos-ins-001",
                author="Marcus Webb",
                content=(
                    "Submitted model cards for actuarial review; waiting on governance checklist items."
                ),
                created_at=_dt(_d(2026, 2, 21), 11, 30),
            ),
            PSNote(
                note_id="pn-carlos-ins-001-3",
                use_case_id="uc-carlos-ins-001",
                author="Marcus Webb",
                content=(
                    "External vendor API latency spikes during UAT batch scoring; opened sev-3 with vendor."
                ),
                created_at=_dt(_d(2026, 3, 7), 9, 15),
            ),
            PSNote(
                note_id="pn-carlos-ins-001-4",
                use_case_id="uc-carlos-ins-001",
                author="Marcus Webb",
                content="Blocked on actuarial model governance sign-off; external model vendor latency.",
                created_at=_dt(_d(2026, 3, 21), 15, 30),
            ),
        ],
        ps_notes_summary=(
            "ML models are built and validated but deployment is blocked on actuarial model governance approval. "
            "The external model vendor is also experiencing latency issues that need resolution. Technical "
            "readiness is high but organizational approvals are the bottleneck."
        ),
        go_live_date=None,
        target_go_live_date=_d(2026, 5, 30),
        lead_se="Marcus Webb",
        ace_assigned="ace-carlos",
        created_date=_d(2025, 11, 20),
        last_modified_date=_dt(_d(2026, 3, 21), 15, 30),
        stage="Impl In Progress",
        complexity="High",
    ),
    UseCase(
        use_case_id="uc-carlos-ins-002",
        account_id="acc-carlos-ins",
        account_name="Sentinel Mutual Insurance",
        use_case_name="Fraudulent Claims Detection",
        description=(
            "Detect potentially fraudulent insurance claims using pattern analysis on historical claims data, "
            "provider networks, and behavioral signals."
        ),
        status="In Progress",
        ps_notes=[
            PSNote(
                note_id="pn-carlos-ins-002-1",
                use_case_id="uc-carlos-ins-002",
                author="Marcus Webb",
                content=(
                    "Mainframe extract specs validated; building normalization layer for codes and dates."
                ),
                created_at=_dt(_d(2026, 2, 15), 10, 20),
            ),
            PSNote(
                note_id="pn-carlos-ins-002-2",
                use_case_id="uc-carlos-ins-002",
                author="Marcus Webb",
                content=(
                    "Nulls and duplicate claim lines in legacy feeds impacting feature quality; escalated to source."
                ),
                created_at=_dt(_d(2026, 3, 8), 13, 0),
            ),
            PSNote(
                note_id="pn-carlos-ins-002-3",
                use_case_id="uc-carlos-ins-002",
                author="Marcus Webb",
                content="Data quality issues on legacy mainframe extracts; added Data Engineering TMR.",
                created_at=_dt(_d(2026, 3, 29), 9, 0),
            ),
        ],
        ps_notes_summary=(
            "Legacy mainframe data quality is the primary challenge. A Data Engineering TMR has been added to "
            "help with extract normalization. The fraud detection models perform well on clean data but "
            "production accuracy depends on resolving the data quality pipeline."
        ),
        go_live_date=None,
        target_go_live_date=_d(2026, 6, 18),
        lead_se="Marcus Webb",
        ace_assigned="ace-carlos",
        created_date=_d(2026, 1, 5),
        last_modified_date=_dt(_d(2026, 3, 29), 9, 0),
        stage="Impl In Progress",
        complexity="Medium",
    ),
    UseCase(
        use_case_id="uc-carlos-tel-001",
        account_id="acc-carlos-tel",
        account_name="Atlas Communications",
        use_case_name="Network Capacity Forecasting",
        description=(
            "Forecast network capacity requirements across cell towers and fiber nodes using historical "
            "traffic patterns, growth trends, and planned expansions."
        ),
        status="Completed",
        ps_notes=[
            PSNote(
                note_id="pn-carlos-tel-001-1",
                use_case_id="uc-carlos-tel-001",
                author="Ingrid Larsson",
                content=(
                    "Backtested forecasting models on 24 months of traffic; accuracy within planning tolerances."
                ),
                created_at=_dt(_d(2026, 1, 15), 11, 0),
            ),
            PSNote(
                note_id="pn-carlos-tel-001-2",
                use_case_id="uc-carlos-tel-001",
                author="Ingrid Larsson",
                content=(
                    "Production cutover rehearsal complete; elastic WH auto-resume policies configured."
                ),
                created_at=_dt(_d(2026, 2, 1), 14, 20),
            ),
            PSNote(
                note_id="pn-carlos-tel-001-3",
                use_case_id="uc-carlos-tel-001",
                author="Ingrid Larsson",
                content=(
                    "Launched to production 2/24; initial week shows higher credit burn on peak recompute jobs."
                ),
                created_at=_dt(_d(2026, 2, 15), 9, 30),
            ),
            PSNote(
                note_id="pn-carlos-tel-001-4",
                use_case_id="uc-carlos-tel-001",
                author="Ingrid Larsson",
                content="Production since 2/24; monitoring credit burn on elastic warehouses.",
                created_at=_dt(_d(2026, 2, 26), 13, 0),
            ),
        ],
        ps_notes_summary=(
            "Successfully in production since 2/24. Forecasting accuracy is within target. The only concern is "
            "higher-than-expected credit consumption on elastic warehouses during peak traffic modeling. SRE is "
            "implementing auto-suspend policies."
        ),
        go_live_date=_d(2026, 2, 24),
        target_go_live_date=_d(2026, 3, 1),
        lead_se="Ingrid Larsson",
        ace_assigned="ace-carlos",
        created_date=_d(2025, 7, 12),
        last_modified_date=_dt(_d(2026, 2, 26), 13, 0),
        stage="Deployed",
        complexity="Medium",
    ),
    UseCase(
        use_case_id="uc-carlos-tel-002",
        account_id="acc-carlos-tel",
        account_name="Atlas Communications",
        use_case_name="Customer Churn & Upsell Propensity",
        description=(
            "Predict customer churn risk and upsell propensity scores to guide retention campaigns and "
            "targeted upgrade offers."
        ),
        status="On Track",
        ps_notes=[
            PSNote(
                note_id="pn-carlos-tel-002-1",
                use_case_id="uc-carlos-tel-002",
                author="Ingrid Larsson",
                content=(
                    "Bulk historical migrate from Teradata at ~80% complete; validating row counts and keys."
                ),
                created_at=_dt(_d(2026, 2, 14), 10, 0),
            ),
            PSNote(
                note_id="pn-carlos-tel-002-2",
                use_case_id="uc-carlos-tel-002",
                author="Ingrid Larsson",
                content=(
                    "Complex billing transforms still missing in Snowflake; April sprint scoped for parity work."
                ),
                created_at=_dt(_d(2026, 3, 7), 15, 30),
            ),
            PSNote(
                note_id="pn-carlos-tel-002-3",
                use_case_id="uc-carlos-tel-002",
                author="Ingrid Larsson",
                content="Slightly behind on feature parity vs legacy Teradata; catching up in April sprint.",
                created_at=_dt(_d(2026, 3, 28), 16, 20),
            ),
        ],
        ps_notes_summary=(
            "Migration from Teradata is 85% complete. Feature parity gap is narrowing with the April sprint "
            "focused on the remaining complex transforms. Model accuracy on Snowflake is comparable to legacy, "
            "validating the migration approach."
        ),
        go_live_date=None,
        target_go_live_date=_d(2026, 4, 25),
        lead_se="Ingrid Larsson",
        ace_assigned="ace-carlos",
        created_date=_d(2025, 9, 30),
        last_modified_date=_dt(_d(2026, 3, 28), 16, 20),
        stage="Go-Live",
        complexity="High",
    ),
    UseCase(
        use_case_id="uc-carlos-tel-003",
        account_id="acc-carlos-tel",
        account_name="Atlas Communications",
        use_case_name="Call Center Speech Analytics",
        description=(
            "Analyze call center recordings using Cortex AI for sentiment analysis, topic extraction, "
            "and agent performance scoring."
        ),
        status="In Progress",
        ps_notes=[
            PSNote(
                note_id="pn-carlos-tel-003-1",
                use_case_id="uc-carlos-tel-003",
                author="Ingrid Larsson",
                content=(
                    "Sampled 500 calls for transcription pipeline design; tagged gold set for sentiment eval."
                ),
                created_at=_dt(_d(2026, 2, 16), 8, 45),
            ),
            PSNote(
                note_id="pn-carlos-tel-003-2",
                use_case_id="uc-carlos-tel-003",
                author="Jordan Blake",
                content=(
                    "Draft redaction workflow for PCI/PII spans shared with compliance; awaiting feedback."
                ),
                created_at=_dt(_d(2026, 3, 10), 12, 0),
            ),
            PSNote(
                note_id="pn-carlos-tel-003-3",
                use_case_id="uc-carlos-tel-003",
                author="Ingrid Larsson",
                content="Cortex audio pipeline POC; privacy redaction workflow in review.",
                created_at=_dt(_d(2026, 3, 30), 8, 40),
            ),
        ],
        ps_notes_summary=(
            "Cortex audio pipeline POC is showing promising results on a sample of call recordings. Privacy "
            "redaction workflow is in legal/compliance review, which is a prerequisite for processing production "
            "call data. Sentiment accuracy is at 87% on test data."
        ),
        go_live_date=None,
        target_go_live_date=_d(2026, 7, 8),
        lead_se="Ingrid Larsson",
        ace_assigned="ace-carlos",
        created_date=_d(2026, 2, 8),
        last_modified_date=_dt(_d(2026, 3, 30), 8, 40),
        stage="Impl Pending",
        complexity="Medium",
    ),
]

MOCK_TMRS: list[TMR] = [
    TMR(
        tmr_id="tmr-1001",
        account_id="acc-jane-fs",
        account_name="Summit Trust Bank",
        requestor="Priya Nandakumar",
        request_type="Architecture Review",
        status="In Progress",
        requested_date=_d(2026, 3, 10),
        start_date=_d(2026, 3, 17),
        end_date=None,
        estimated_hours=24.0,
        actual_hours=9.5,
        use_case_id="uc-jane-fs-001",
        priority="P1",
        outcome=None,
    ),
    TMR(
        tmr_id="tmr-1002",
        account_id="acc-jane-fs",
        account_name="Summit Trust Bank",
        requestor="Daniel Okonkwo",
        request_type="ML Engineering",
        status="Completed",
        requested_date=_d(2026, 2, 2),
        start_date=_d(2026, 2, 5),
        end_date=_d(2026, 2, 18),
        estimated_hours=16.0,
        actual_hours=14.0,
        use_case_id="uc-jane-fs-002",
        priority="P2",
        outcome="Delivered baseline feature pipeline and monitoring checklist.",
    ),
    TMR(
        tmr_id="tmr-1003",
        account_id="acc-jane-hc",
        account_name="AuroraCare Health Network",
        requestor="Elena Marquez",
        request_type="Security Review",
        status="Blocked",
        requested_date=_d(2026, 3, 1),
        start_date=_d(2026, 3, 8),
        end_date=None,
        estimated_hours=12.0,
        actual_hours=4.0,
        use_case_id="uc-jane-hc-001",
        priority="P1",
        outcome=None,
    ),
    TMR(
        tmr_id="tmr-1004",
        account_id="acc-jane-ret",
        account_name="Cartograph Retail Group",
        requestor="Noah Ibrahim",
        request_type="Performance Tuning",
        status="In Progress",
        requested_date=_d(2026, 3, 18),
        start_date=_d(2026, 3, 24),
        end_date=None,
        estimated_hours=20.0,
        actual_hours=6.0,
        use_case_id="uc-jane-ret-001",
        priority="P2",
        outcome=None,
    ),
    TMR(
        tmr_id="tmr-1005",
        account_id="acc-jane-tech",
        account_name="Lattice Analytics",
        requestor="Amelia Chen",
        request_type="Data Engineering",
        status="Completed",
        requested_date=_d(2026, 2, 10),
        start_date=_d(2026, 2, 12),
        end_date=_d(2026, 2, 27),
        estimated_hours=30.0,
        actual_hours=28.5,
        use_case_id="uc-jane-tech-001",
        priority="P2",
        outcome="Streams backpressure resolved; autoscale policy documented.",
    ),
    TMR(
        tmr_id="tmr-1006",
        account_id="acc-jane-tech",
        account_name="Lattice Analytics",
        requestor="Amelia Chen",
        request_type="ML Engineering",
        status="Scheduled",
        requested_date=_d(2026, 3, 28),
        start_date=_d(2026, 4, 2),
        end_date=None,
        estimated_hours=18.0,
        actual_hours=None,
        use_case_id="uc-jane-tech-002",
        priority="P3",
        outcome=None,
    ),
    TMR(
        tmr_id="tmr-1007",
        account_id="acc-carlos-media",
        account_name="Horizon Broadcast Group",
        requestor="Jordan Blake",
        request_type="ML Engineering",
        status="In Progress",
        requested_date=_d(2026, 3, 12),
        start_date=_d(2026, 3, 19),
        end_date=None,
        estimated_hours=22.0,
        actual_hours=7.0,
        use_case_id="uc-carlos-media-001",
        priority="P2",
        outcome=None,
    ),
    TMR(
        tmr_id="tmr-1008",
        account_id="acc-carlos-mfg",
        account_name="Titan Industrial IoT",
        requestor="Sofia Petrov",
        request_type="Data Engineering",
        status="In Progress",
        requested_date=_d(2026, 3, 5),
        start_date=_d(2026, 3, 11),
        end_date=None,
        estimated_hours=36.0,
        actual_hours=15.0,
        use_case_id="uc-carlos-mfg-001",
        priority="P1",
        outcome=None,
    ),
    TMR(
        tmr_id="tmr-1009",
        account_id="acc-carlos-mfg",
        account_name="Titan Industrial IoT",
        requestor="Sofia Petrov",
        request_type="Architecture Review",
        status="Open",
        requested_date=_d(2026, 3, 29),
        start_date=None,
        end_date=None,
        estimated_hours=14.0,
        actual_hours=None,
        use_case_id="uc-carlos-mfg-002",
        priority="P3",
        outcome=None,
    ),
    TMR(
        tmr_id="tmr-1010",
        account_id="acc-carlos-ins",
        account_name="Sentinel Mutual Insurance",
        requestor="Marcus Webb",
        request_type="Data Engineering",
        status="In Progress",
        requested_date=_d(2026, 3, 15),
        start_date=_d(2026, 3, 20),
        end_date=None,
        estimated_hours=40.0,
        actual_hours=11.0,
        use_case_id="uc-carlos-ins-002",
        priority="P1",
        outcome=None,
    ),
    TMR(
        tmr_id="tmr-1011",
        account_id="acc-carlos-ins",
        account_name="Sentinel Mutual Insurance",
        requestor="Marcus Webb",
        request_type="Security Review",
        status="Open",
        requested_date=_d(2026, 3, 27),
        start_date=None,
        end_date=None,
        estimated_hours=10.0,
        actual_hours=None,
        use_case_id="uc-carlos-ins-001",
        priority="P2",
        outcome=None,
    ),
    TMR(
        tmr_id="tmr-1012",
        account_id="acc-carlos-tel",
        account_name="Atlas Communications",
        requestor="Ingrid Larsson",
        request_type="Performance Tuning",
        status="Completed",
        requested_date=_d(2026, 1, 8),
        start_date=_d(2026, 1, 10),
        end_date=_d(2026, 1, 22),
        estimated_hours=12.0,
        actual_hours=11.0,
        use_case_id="uc-carlos-tel-001",
        priority="P2",
        outcome="Warehouse clustering and search optimization completed.",
    ),
    TMR(
        tmr_id="tmr-1013",
        account_id="acc-carlos-tel",
        account_name="Atlas Communications",
        requestor="Ingrid Larsson",
        request_type="ML Engineering",
        status="In Progress",
        requested_date=_d(2026, 3, 22),
        start_date=_d(2026, 3, 25),
        end_date=None,
        estimated_hours=26.0,
        actual_hours=5.0,
        use_case_id="uc-carlos-tel-003",
        priority="P2",
        outcome=None,
    ),
]

_CONSUMPTION_SPECS: list[tuple[str, float, float, float, float, str, int]] = [
    ("acc-jane-fs", 1180.0, 4.2, 55.0, 920_000.0, "SUMMIT_ANALYTICS_WH", 501),
    ("acc-jane-hc", 620.0, 2.1, 40.0, 410_000.0, "AURORA_CLINICAL_WH", 502),
    ("acc-jane-ret", 890.0, -1.8, 48.0, 380_000.0, "CARTOGRAPH_RETAIL_WH", 503),
    ("acc-jane-tech", 1420.0, 1.1, 62.0, 650_000.0, "LATTICE_PROD_WH", 504),
    ("acc-carlos-media", 760.0, 3.0, 44.0, 540_000.0, "HORIZON_MEDIA_WH", 601),
    ("acc-carlos-mfg", 540.0, 5.5, 38.0, 295_000.0, "TITAN_IOT_WH", 602),
    ("acc-carlos-ins", 970.0, -0.9, 50.0, 470_000.0, "SENTINEL_RISK_WH", 603),
    ("acc-carlos-tel", 1350.0, 2.4, 58.0, 1_050_000.0, "ATLAS_NETWORK_WH", 604),
]

MOCK_CREDIT_CONSUMPTION: list[CreditConsumption] = []
for aid, base, slope, noise, alloc, wh, seed in _CONSUMPTION_SPECS:
    MOCK_CREDIT_CONSUMPTION.extend(
        generate_daily_credit_consumption(
            aid,
            measurement_anchor=TODAY,
            days=90,
            base_daily=base,
            trend_per_day=slope,
            noise_std=noise,
            credits_allocated=alloc,
            warehouse_name=wh,
            seed=seed,
        )
    )

_PERIOD = "2026-Q1"

MOCK_FEATURE_USAGE: list[AccountFeatureUsage] = [
    AccountFeatureUsage(
        account_id="acc-jane-fs",
        feature_name="Snowpipe",
        usage_count=18420,
        first_used=_d(2025, 9, 12),
        last_used=TODAY,
        measurement_period=_PERIOD,
    ),
    AccountFeatureUsage(
        account_id="acc-jane-fs",
        feature_name="Dynamic Tables",
        usage_count=3120,
        first_used=_d(2025, 11, 2),
        last_used=TODAY,
        measurement_period=_PERIOD,
    ),
    AccountFeatureUsage(
        account_id="acc-jane-fs",
        feature_name="Snowpark",
        usage_count=965,
        first_used=_d(2025, 12, 5),
        last_used=_d(2026, 3, 29),
        measurement_period=_PERIOD,
    ),
    AccountFeatureUsage(
        account_id="acc-jane-fs",
        feature_name="Streams",
        usage_count=4280,
        first_used=_d(2025, 10, 20),
        last_used=TODAY,
        measurement_period=_PERIOD,
    ),
    AccountFeatureUsage(
        account_id="acc-jane-hc",
        feature_name="Tasks",
        usage_count=6210,
        first_used=_d(2026, 1, 25),
        last_used=TODAY,
        measurement_period=_PERIOD,
    ),
    AccountFeatureUsage(
        account_id="acc-jane-hc",
        feature_name="Snowpipe",
        usage_count=8920,
        first_used=_d(2026, 2, 1),
        last_used=TODAY,
        measurement_period=_PERIOD,
    ),
    AccountFeatureUsage(
        account_id="acc-jane-hc",
        feature_name="Cortex",
        usage_count=412,
        first_used=_d(2026, 3, 1),
        last_used=_d(2026, 3, 28),
        measurement_period=_PERIOD,
    ),
    AccountFeatureUsage(
        account_id="acc-jane-ret",
        feature_name="Dynamic Tables",
        usage_count=2890,
        first_used=_d(2025, 12, 15),
        last_used=TODAY,
        measurement_period=_PERIOD,
    ),
    AccountFeatureUsage(
        account_id="acc-jane-ret",
        feature_name="Iceberg Tables",
        usage_count=740,
        first_used=_d(2026, 2, 18),
        last_used=TODAY,
        measurement_period=_PERIOD,
    ),
    AccountFeatureUsage(
        account_id="acc-jane-ret",
        feature_name="Streams",
        usage_count=5100,
        first_used=_d(2026, 1, 4),
        last_used=TODAY,
        measurement_period=_PERIOD,
    ),
    AccountFeatureUsage(
        account_id="acc-jane-tech",
        feature_name="Snowpark",
        usage_count=5420,
        first_used=_d(2025, 7, 22),
        last_used=TODAY,
        measurement_period=_PERIOD,
    ),
    AccountFeatureUsage(
        account_id="acc-jane-tech",
        feature_name="Tasks",
        usage_count=12880,
        first_used=_d(2025, 6, 25),
        last_used=TODAY,
        measurement_period=_PERIOD,
    ),
    AccountFeatureUsage(
        account_id="acc-jane-tech",
        feature_name="Dynamic Tables",
        usage_count=4100,
        first_used=_d(2025, 10, 3),
        last_used=TODAY,
        measurement_period=_PERIOD,
    ),
    AccountFeatureUsage(
        account_id="acc-carlos-media",
        feature_name="Cortex",
        usage_count=1820,
        first_used=_d(2026, 1, 12),
        last_used=TODAY,
        measurement_period=_PERIOD,
    ),
    AccountFeatureUsage(
        account_id="acc-carlos-media",
        feature_name="Snowpipe",
        usage_count=11240,
        first_used=_d(2025, 8, 20),
        last_used=TODAY,
        measurement_period=_PERIOD,
    ),
    AccountFeatureUsage(
        account_id="acc-carlos-media",
        feature_name="Streams",
        usage_count=3650,
        first_used=_d(2025, 11, 8),
        last_used=TODAY,
        measurement_period=_PERIOD,
    ),
    AccountFeatureUsage(
        account_id="acc-carlos-mfg",
        feature_name="Iceberg Tables",
        usage_count=920,
        first_used=_d(2026, 2, 22),
        last_used=TODAY,
        measurement_period=_PERIOD,
    ),
    AccountFeatureUsage(
        account_id="acc-carlos-mfg",
        feature_name="Snowpipe",
        usage_count=5340,
        first_used=_d(2026, 2, 15),
        last_used=TODAY,
        measurement_period=_PERIOD,
    ),
    AccountFeatureUsage(
        account_id="acc-carlos-mfg",
        feature_name="Tasks",
        usage_count=2100,
        first_used=_d(2026, 3, 5),
        last_used=_d(2026, 3, 29),
        measurement_period=_PERIOD,
    ),
    AccountFeatureUsage(
        account_id="acc-carlos-ins",
        feature_name="Snowpipe",
        usage_count=9780,
        first_used=_d(2025, 10, 8),
        last_used=TODAY,
        measurement_period=_PERIOD,
    ),
    AccountFeatureUsage(
        account_id="acc-carlos-ins",
        feature_name="Dynamic Tables",
        usage_count=2555,
        first_used=_d(2025, 12, 1),
        last_used=TODAY,
        measurement_period=_PERIOD,
    ),
    AccountFeatureUsage(
        account_id="acc-carlos-ins",
        feature_name="Snowpark",
        usage_count=1330,
        first_used=_d(2026, 1, 18),
        last_used=TODAY,
        measurement_period=_PERIOD,
    ),
    AccountFeatureUsage(
        account_id="acc-carlos-tel",
        feature_name="Streams",
        usage_count=8940,
        first_used=_d(2025, 5, 30),
        last_used=TODAY,
        measurement_period=_PERIOD,
    ),
    AccountFeatureUsage(
        account_id="acc-carlos-tel",
        feature_name="Tasks",
        usage_count=15220,
        first_used=_d(2025, 6, 10),
        last_used=TODAY,
        measurement_period=_PERIOD,
    ),
    AccountFeatureUsage(
        account_id="acc-carlos-tel",
        feature_name="Cortex",
        usage_count=640,
        first_used=_d(2026, 2, 2),
        last_used=_d(2026, 3, 27),
        measurement_period=_PERIOD,
    ),
    AccountFeatureUsage(
        account_id="acc-carlos-tel",
        feature_name="Snowpark",
        usage_count=4890,
        first_used=_d(2025, 9, 5),
        last_used=TODAY,
        measurement_period=_PERIOD,
    ),
]

MOCK_CREDIT_FORECASTS: list[CreditForecast] = [
    CreditForecast(
        account_id="acc-jane-fs",
        forecast_date=TODAY,
        predicted_credits_30d=38_200.0,
        predicted_credits_60d=79_400.0,
        predicted_credits_90d=124_800.0,
        confidence_interval_lower=34_100.0,
        confidence_interval_upper=43_500.0,
        trend_direction="rising",
        model_version="cf-v2.3.1",
    ),
    CreditForecast(
        account_id="acc-jane-hc",
        forecast_date=TODAY,
        predicted_credits_30d=19_400.0,
        predicted_credits_60d=40_200.0,
        predicted_credits_90d=62_800.0,
        confidence_interval_lower=17_200.0,
        confidence_interval_upper=22_100.0,
        trend_direction="rising",
        model_version="cf-v2.3.1",
    ),
    CreditForecast(
        account_id="acc-jane-ret",
        forecast_date=TODAY,
        predicted_credits_30d=24_800.0,
        predicted_credits_60d=47_900.0,
        predicted_credits_90d=68_200.0,
        confidence_interval_lower=22_400.0,
        confidence_interval_upper=27_600.0,
        trend_direction="declining",
        model_version="cf-v2.3.1",
    ),
    CreditForecast(
        account_id="acc-jane-tech",
        forecast_date=TODAY,
        predicted_credits_30d=44_100.0,
        predicted_credits_60d=90_500.0,
        predicted_credits_90d=138_200.0,
        confidence_interval_lower=40_800.0,
        confidence_interval_upper=48_200.0,
        trend_direction="stable",
        model_version="cf-v2.3.1",
    ),
    CreditForecast(
        account_id="acc-carlos-media",
        forecast_date=TODAY,
        predicted_credits_30d=23_700.0,
        predicted_credits_60d=49_100.0,
        predicted_credits_90d=76_400.0,
        confidence_interval_lower=21_000.0,
        confidence_interval_upper=26_800.0,
        trend_direction="rising",
        model_version="cf-v2.3.1",
    ),
    CreditForecast(
        account_id="acc-carlos-mfg",
        forecast_date=TODAY,
        predicted_credits_30d=17_200.0,
        predicted_credits_60d=36_800.0,
        predicted_credits_90d=58_900.0,
        confidence_interval_lower=15_400.0,
        confidence_interval_upper=19_600.0,
        trend_direction="rising",
        model_version="cf-v2.3.1",
    ),
    CreditForecast(
        account_id="acc-carlos-ins",
        forecast_date=TODAY,
        predicted_credits_30d=28_400.0,
        predicted_credits_60d=54_200.0,
        predicted_credits_90d=76_100.0,
        confidence_interval_lower=25_900.0,
        confidence_interval_upper=31_200.0,
        trend_direction="declining",
        model_version="cf-v2.3.1",
    ),
    CreditForecast(
        account_id="acc-carlos-tel",
        forecast_date=TODAY,
        predicted_credits_30d=41_800.0,
        predicted_credits_60d=86_300.0,
        predicted_credits_90d=132_600.0,
        confidence_interval_lower=38_200.0,
        confidence_interval_upper=46_100.0,
        trend_direction="rising",
        model_version="cf-v2.3.1",
    ),
]

MOCK_USE_CASE_PREDICTIONS: list[UseCaseCompletionPrediction] = [
    UseCaseCompletionPrediction(
        use_case_id="uc-jane-fs-001",
        account_id="acc-jane-fs",
        predicted_go_live_date=_d(2026, 5, 8),
        confidence_score=0.78,
        risk_factors=["Vendor security review queue", "Cross-region latency tuning"],
        predicted_status="On Track",
        days_remaining_estimate=39,
        similar_use_case_refs=["uc-carlos-ins-002", "uc-jane-ret-001"],
        model_version="ucp-v1.4.0",
    ),
    UseCaseCompletionPrediction(
        use_case_id="uc-jane-fs-002",
        account_id="acc-jane-fs",
        predicted_go_live_date=_d(2026, 7, 18),
        confidence_score=0.62,
        risk_factors=["Entity resolution accuracy", "Source system schema drift"],
        predicted_status="At Risk",
        days_remaining_estimate=110,
        similar_use_case_refs=["uc-carlos-ins-001"],
        model_version="ucp-v1.4.0",
    ),
    UseCaseCompletionPrediction(
        use_case_id="uc-jane-fs-003",
        account_id="acc-jane-fs",
        predicted_go_live_date=_d(2026, 4, 5),
        confidence_score=0.88,
        risk_factors=["Finance sign-off on backfill window"],
        predicted_status="Ahead",
        days_remaining_estimate=6,
        similar_use_case_refs=["uc-carlos-mfg-002"],
        model_version="ucp-v1.4.0",
    ),
    UseCaseCompletionPrediction(
        use_case_id="uc-jane-hc-001",
        account_id="acc-jane-hc",
        predicted_go_live_date=_d(2026, 7, 2),
        confidence_score=0.44,
        risk_factors=["BAA / legal", "PHI secondary region"],
        predicted_status="Blocked",
        days_remaining_estimate=94,
        similar_use_case_refs=["uc-jane-hc-002"],
        model_version="ucp-v1.4.0",
    ),
    UseCaseCompletionPrediction(
        use_case_id="uc-jane-hc-002",
        account_id="acc-jane-hc",
        predicted_go_live_date=_d(2026, 8, 1),
        confidence_score=0.71,
        risk_factors=["Training pipeline runtime on XL warehouse"],
        predicted_status="On Track",
        days_remaining_estimate=124,
        similar_use_case_refs=["uc-carlos-tel-003"],
        model_version="ucp-v1.4.0",
    ),
    UseCaseCompletionPrediction(
        use_case_id="uc-jane-ret-001",
        account_id="acc-jane-ret",
        predicted_go_live_date=_d(2026, 6, 12),
        confidence_score=0.55,
        risk_factors=["Identity graph coverage", "POS late arrivals"],
        predicted_status="Behind",
        days_remaining_estimate=74,
        similar_use_case_refs=["uc-carlos-media-001"],
        model_version="ucp-v1.4.0",
    ),
    UseCaseCompletionPrediction(
        use_case_id="uc-jane-ret-002",
        account_id="acc-jane-ret",
        predicted_go_live_date=_d(2026, 5, 10),
        confidence_score=0.58,
        risk_factors=["Merchandising stakeholder churn"],
        predicted_status="At Risk",
        days_remaining_estimate=41,
        similar_use_case_refs=["uc-jane-ret-001"],
        model_version="ucp-v1.4.0",
    ),
    UseCaseCompletionPrediction(
        use_case_id="uc-jane-tech-002",
        account_id="acc-jane-tech",
        predicted_go_live_date=_d(2026, 4, 9),
        confidence_score=0.82,
        risk_factors=["Canary traffic ramp discipline"],
        predicted_status="Ahead",
        days_remaining_estimate=10,
        similar_use_case_refs=["uc-jane-tech-001"],
        model_version="ucp-v1.4.0",
    ),
    UseCaseCompletionPrediction(
        use_case_id="uc-carlos-media-001",
        account_id="acc-carlos-media",
        predicted_go_live_date=_d(2026, 6, 20),
        confidence_score=0.66,
        risk_factors=["Legal review on third-party content"],
        predicted_status="On Track",
        days_remaining_estimate=82,
        similar_use_case_refs=["uc-carlos-media-002"],
        model_version="ucp-v1.4.0",
    ),
    UseCaseCompletionPrediction(
        use_case_id="uc-carlos-media-002",
        account_id="acc-carlos-media",
        predicted_go_live_date=_d(2026, 5, 1),
        confidence_score=0.84,
        risk_factors=["Warehouse resize during peak prep"],
        predicted_status="On Track",
        days_remaining_estimate=32,
        similar_use_case_refs=["uc-jane-ret-001"],
        model_version="ucp-v1.4.0",
    ),
    UseCaseCompletionPrediction(
        use_case_id="uc-carlos-mfg-001",
        account_id="acc-carlos-mfg",
        predicted_go_live_date=_d(2026, 8, 5),
        confidence_score=0.59,
        risk_factors=["OT network change windows", "Sensor ingest gaps"],
        predicted_status="Behind",
        days_remaining_estimate=128,
        similar_use_case_refs=["uc-carlos-tel-001"],
        model_version="ucp-v1.4.0",
    ),
    UseCaseCompletionPrediction(
        use_case_id="uc-carlos-mfg-002",
        account_id="acc-carlos-mfg",
        predicted_go_live_date=_d(2026, 9, 5),
        confidence_score=0.73,
        risk_factors=["Iceberg compaction strategy"],
        predicted_status="On Track",
        days_remaining_estimate=159,
        similar_use_case_refs=["uc-jane-ret-002"],
        model_version="ucp-v1.4.0",
    ),
    UseCaseCompletionPrediction(
        use_case_id="uc-carlos-ins-001",
        account_id="acc-carlos-ins",
        predicted_go_live_date=_d(2026, 7, 14),
        confidence_score=0.41,
        risk_factors=["Actuarial governance", "External model vendor latency"],
        predicted_status="Blocked",
        days_remaining_estimate=106,
        similar_use_case_refs=["uc-jane-fs-002"],
        model_version="ucp-v1.4.0",
    ),
    UseCaseCompletionPrediction(
        use_case_id="uc-carlos-ins-002",
        account_id="acc-carlos-ins",
        predicted_go_live_date=_d(2026, 6, 28),
        confidence_score=0.63,
        risk_factors=["Legacy mainframe extract quality"],
        predicted_status="At Risk",
        days_remaining_estimate=90,
        similar_use_case_refs=["uc-jane-fs-001"],
        model_version="ucp-v1.4.0",
    ),
    UseCaseCompletionPrediction(
        use_case_id="uc-carlos-tel-002",
        account_id="acc-carlos-tel",
        predicted_go_live_date=_d(2026, 5, 6),
        confidence_score=0.69,
        risk_factors=["Feature parity vs Teradata"],
        predicted_status="Behind",
        days_remaining_estimate=37,
        similar_use_case_refs=["uc-jane-tech-002"],
        model_version="ucp-v1.4.0",
    ),
    UseCaseCompletionPrediction(
        use_case_id="uc-carlos-tel-003",
        account_id="acc-carlos-tel",
        predicted_go_live_date=_d(2026, 7, 22),
        confidence_score=0.64,
        risk_factors=["Audio redaction workflow", "Cortex quota planning"],
        predicted_status="On Track",
        days_remaining_estimate=114,
        similar_use_case_refs=["uc-carlos-media-001"],
        model_version="ucp-v1.4.0",
    ),
]

MOCK_TMR_PREDICTIONS: list[TMRSuccessPrediction] = [
    TMRSuccessPrediction(
        tmr_id="tmr-1001",
        predicted_success_probability=0.81,
        predicted_completion_date=_d(2026, 4, 4),
        risk_level="medium",
        recommended_actions=[
            "Lock architecture decision on cross-region replication",
            "Add office hours for app security questionnaire",
        ],
        comparable_tmr_outcomes=["tmr-1005", "tmr-1012"],
        model_version="tmr-v0.9.2",
    ),
    TMRSuccessPrediction(
        tmr_id="tmr-1003",
        predicted_success_probability=0.38,
        predicted_completion_date=_d(2026, 5, 12),
        risk_level="high",
        recommended_actions=[
            "Escalate BAA blocker to account executive",
            "Scope interim read-only UAT slice",
        ],
        comparable_tmr_outcomes=["tmr-1008"],
        model_version="tmr-v0.9.2",
    ),
    TMRSuccessPrediction(
        tmr_id="tmr-1004",
        predicted_success_probability=0.74,
        predicted_completion_date=_d(2026, 4, 11),
        risk_level="medium",
        recommended_actions=[
            "Profile top 10 slow queries post-clustering",
            "Validate autoscale caps before Black Friday dry run",
        ],
        comparable_tmr_outcomes=["tmr-1012", "tmr-1005"],
        model_version="tmr-v0.9.2",
    ),
    TMRSuccessPrediction(
        tmr_id="tmr-1007",
        predicted_success_probability=0.69,
        predicted_completion_date=_d(2026, 4, 18),
        risk_level="medium",
        recommended_actions=[
            "Document Cortex data governance boundaries",
            "Pilot tagging on 1% catalog subset",
        ],
        comparable_tmr_outcomes=["tmr-1013"],
        model_version="tmr-v0.9.2",
    ),
    TMRSuccessPrediction(
        tmr_id="tmr-1008",
        predicted_success_probability=0.72,
        predicted_completion_date=_d(2026, 4, 22),
        risk_level="medium",
        recommended_actions=[
            "Align OT maintenance window with backfill jobs",
            "Add dead-letter stream for malformed payloads",
        ],
        comparable_tmr_outcomes=["tmr-1010"],
        model_version="tmr-v0.9.2",
    ),
    TMRSuccessPrediction(
        tmr_id="tmr-1009",
        predicted_success_probability=0.77,
        predicted_completion_date=_d(2026, 4, 9),
        risk_level="low",
        recommended_actions=[
            "Pre-send architecture packet to customer CTO",
            "Schedule Iceberg storage economics review",
        ],
        comparable_tmr_outcomes=["tmr-1001"],
        model_version="tmr-v0.9.2",
    ),
    TMRSuccessPrediction(
        tmr_id="tmr-1010",
        predicted_success_probability=0.66,
        predicted_completion_date=_d(2026, 4, 28),
        risk_level="medium",
        recommended_actions=[
            "Add data contracts on mainframe extracts",
            "Weekly DQ dashboard for claims attributes",
        ],
        comparable_tmr_outcomes=["tmr-1002", "tmr-1008"],
        model_version="tmr-v0.9.2",
    ),
    TMRSuccessPrediction(
        tmr_id="tmr-1011",
        predicted_success_probability=0.58,
        predicted_completion_date=_d(2026, 4, 20),
        risk_level="high",
        recommended_actions=[
            "Pair with security SME on model governance gaps",
            "Prepare compensating controls narrative",
        ],
        comparable_tmr_outcomes=["tmr-1003"],
        model_version="tmr-v0.9.2",
    ),
    TMRSuccessPrediction(
        tmr_id="tmr-1013",
        predicted_success_probability=0.71,
        predicted_completion_date=_d(2026, 4, 15),
        risk_level="medium",
        recommended_actions=[
            "Prototype redaction before full Cortex scale",
            "Define evaluation set with compliance",
        ],
        comparable_tmr_outcomes=["tmr-1007"],
        model_version="tmr-v0.9.2",
    ),
    TMRSuccessPrediction(
        tmr_id="tmr-1006",
        predicted_success_probability=0.79,
        predicted_completion_date=_d(2026, 4, 25),
        risk_level="low",
        recommended_actions=[
            "Confirm notebook runtime and package pins before kickoff",
            "Align feature store cutover with SRE change window",
        ],
        comparable_tmr_outcomes=["tmr-1002", "tmr-1007"],
        model_version="tmr-v0.9.2",
    ),
]

MOCK_SIMILAR_DEPLOYMENTS: list[SimilarDeployment] = [
    SimilarDeployment(
        deployment_id="dep-fin-77a",
        use_case_type="Real-time Fraud Detection",
        industry="Financial Services",
        account_size="Large",
        days_to_go_live=112,
        credits_consumed=186_400.0,
        features_used=["Snowpipe", "Streams", "Snowpark", "Dynamic Tables"],
        success_rating=4.6,
        blockers_encountered=["Cross-region latency", "Model governance approvals"],
        resources_used=118.0,
    ),
    SimilarDeployment(
        deployment_id="dep-ret-22c",
        use_case_type="Customer 360 Analytics",
        industry="Retail",
        account_size="Mid",
        days_to_go_live=96,
        credits_consumed=92_300.0,
        features_used=["Snowpipe", "Tasks", "Dynamic Tables"],
        success_rating=4.2,
        blockers_encountered=["Identity resolution coverage"],
        resources_used=86.0,
    ),
    SimilarDeployment(
        deployment_id="dep-tel-91f",
        use_case_type="Network Capacity Forecasting",
        industry="Telecom",
        account_size="Large",
        days_to_go_live=134,
        credits_consumed=210_900.0,
        features_used=["Streams", "Tasks", "Snowpark", "Iceberg Tables"],
        success_rating=4.5,
        blockers_encountered=["Legacy warehouse cutover"],
        resources_used=132.0,
    ),
    SimilarDeployment(
        deployment_id="dep-mfg-55b",
        use_case_type="Supply Chain Optimization",
        industry="Manufacturing",
        account_size="Mid",
        days_to_go_live=143,
        credits_consumed=74_800.0,
        features_used=["Snowpipe", "Iceberg Tables", "Tasks"],
        success_rating=4.0,
        blockers_encountered=["OT security segmentation"],
        resources_used=95.0,
    ),
    SimilarDeployment(
        deployment_id="dep-ins-40d",
        use_case_type="Fraudulent Claims Detection",
        industry="Insurance",
        account_size="Large",
        days_to_go_live=121,
        credits_consumed=128_600.0,
        features_used=["Snowpipe", "Snowpark", "Dynamic Tables"],
        success_rating=4.3,
        blockers_encountered=["Mainframe extract quality"],
        resources_used=104.0,
    ),
]

MOCK_GONG_CALLS: list[GongCall] = [
    GongCall(
        call_id='gong-jane-fs-1',
        account_id='acc-jane-fs',
        call_date=_dt(_d(2026, 1, 8), 15, 0),
        duration_minutes=45,
        summary='Kickoff with Summit Trust to align on fraud detection modernization goals and Snowflake footprint. We reviewed current batch scoring latency and agreed on a phased approach starting with streaming ingestion into the lakehouse.',
        topics=[
            'fraud detection pipeline',
            'Kafka integration',
            'vendor security',
        ],
        action_items=[
            '[DONE] Jane to share network diagram for Kafka → Snowflake connectivity options.',
            '[DONE] Priya to send reference architecture for real-time feature enrichment.',
            'Client security team to complete third-party risk questionnaire for Snowflake connectors.',
        ],
        next_steps=[
            'Schedule technical deep dive on Snowpark ML scoring with data science leads.',
        ],
        participants_internal=[
            'Jane Smith',
            'Priya Nandakumar',
        ],
        participants_external=[
            'David Okonkwo — VP Engineering',
            'Rachel Stein — Head of Fraud Operations',
        ],
    ),
    GongCall(
        call_id='gong-jane-fs-2',
        account_id='acc-jane-fs',
        call_date=_dt(_d(2026, 1, 22), 16, 30),
        duration_minutes=52,
        summary='Deep dive on Snowpark ML scoring patterns and how Summit plans to shadow production models before cutover. Kafka topics and consumer groups were mapped; we surfaced a gap on PII tokenization at the edge.',
        topics=[
            'Snowpark ML scoring',
            'Kafka integration',
            'fraud detection pipeline',
        ],
        action_items=[
            '[DONE] Priya to provide sample Snowpark UDF for score calibration.',
            'Summit to provision non-prod Kafka cluster mirroring prod topic schemas.',
            'Jane to coordinate vendor security review of the proposed streaming connector.',
        ],
        next_steps=[
            'Pilot scoring job in QA with historical chargeback labels.',
        ],
        participants_internal=[
            'Jane Smith',
            'Priya Nandakumar',
        ],
        participants_external=[
            'David Okonkwo — VP Engineering',
            'Miguel Santos — Director, Enterprise Data',
        ],
    ),
    GongCall(
        call_id='gong-jane-fs-3',
        account_id='acc-jane-fs',
        call_date=_dt(_d(2026, 2, 14), 14, 0),
        duration_minutes=38,
        summary='Mid-sprint checkpoint: QA pilot showed acceptable latency but drift on high-value wire transfers. We agreed to tighten feature freshness windows and add monitoring hooks before expanding traffic.',
        topics=[
            'fraud detection pipeline',
            'Snowpark ML scoring',
        ],
        action_items=[
            '[DONE] Summit data science to rerun backtest with 15-minute feature windows.',
            'Priya to document rollback criteria for production shadow mode.',
        ],
        next_steps=[
            'Executive readout on vendor security sign-off status.',
        ],
        participants_internal=[
            'Jane Smith',
            'Priya Nandakumar',
        ],
        participants_external=[
            'Miguel Santos — Director, Enterprise Data',
            'Priya Desai — Chief Risk Officer',
        ],
    ),
    GongCall(
        call_id='gong-jane-fs-4',
        account_id='acc-jane-fs',
        call_date=_dt(_d(2026, 3, 5), 17, 0),
        duration_minutes=33,
        summary='Vendor security cleared the streaming path; focus shifted to production shadow deployment windows and RACI for on-call. Minor tension on weekend cutover—agreed on a blue-green strategy with manual approval gates.',
        topics=[
            'vendor security',
            'fraud detection pipeline',
            'Kafka integration',
        ],
        action_items=[
            'Jane to finalize cutover runbook and share with fraud ops.',
            'Summit SRE to validate alerting dashboards for Snowpark job failures.',
        ],
        next_steps=[
            'Go/no-go review the week of March 17 for shadow traffic at 10%.',
        ],
        participants_internal=[
            'Jane Smith',
            'Priya Nandakumar',
        ],
        participants_external=[
            'David Okonkwo — VP Engineering',
            'Rachel Stein — Head of Fraud Operations',
            "James O'Neill — Director, Infrastructure & SRE",
        ],
    ),
    GongCall(
        call_id='gong-jane-hc-1',
        account_id='acc-jane-hc',
        call_date=_dt(_d(2026, 1, 10), 19, 0),
        duration_minutes=40,
        summary='Discovery session on Patient 360 ambitions and regulatory constraints for PHI in the cloud. AuroraCare outlined current siloed clinical and claims views and asked for a pragmatic BAA-aligned roadmap.',
        topics=[
            'BAA compliance',
            'Patient 360',
            'PHI data regions',
        ],
        action_items=[
            '[DONE] Elena to send region residency matrix for healthcare workloads.',
            '[DONE] Jane to schedule follow-up with legal on subprocessors list.',
        ],
        next_steps=[
            'Workshop on claims adjudication data flows and source system inventory.',
        ],
        participants_internal=[
            'Jane Smith',
            'Elena Marquez',
        ],
        participants_external=[
            'Dr. Anita Verma — CMIO',
            'Greg Holloway — VP, Data & Analytics',
        ],
    ),
    GongCall(
        call_id='gong-jane-hc-2',
        account_id='acc-jane-hc',
        call_date=_dt(_d(2026, 2, 4), 15, 30),
        duration_minutes=55,
        summary='Technical workshop mapping EHR feeds into a unified patient timeline while keeping PHI in approved regions. Claims adjudication rules surfaced as a dependency for financial completeness in Patient 360.',
        topics=[
            'Patient 360',
            'claims adjudication',
            'PHI data regions',
        ],
        action_items=[
            '[DONE] AuroraCare to deliver de-identified sample schema for two hospitals.',
            'Elena to prototype secure view pattern for cross-facility providers.',
        ],
        next_steps=[
            'BAA addendum review with compliance before any prod PHI tests.',
        ],
        participants_internal=[
            'Jane Smith',
            'Elena Marquez',
        ],
        participants_external=[
            'Greg Holloway — VP, Data & Analytics',
            'Linda Morales — Director, Revenue Cycle',
        ],
    ),
    GongCall(
        call_id='gong-jane-hc-3',
        account_id='acc-jane-hc',
        call_date=_dt(_d(2026, 3, 12), 16, 0),
        duration_minutes=48,
        summary='Progress review: secure views validated in lower environments; legal signed BAA amendments. Next focus is production cutover for two pilot sites and training analysts on the new Patient 360 workspace.',
        topics=[
            'BAA compliance',
            'Patient 360',
            'claims adjudication',
        ],
        action_items=[
            'Jane to align go-live checklist with AuroraCare security operations.',
            'Elena to run performance tests on peak morning clinical query patterns.',
        ],
        next_steps=[
            'Pilot go-live targeted for late March with daily governance standups.',
        ],
        participants_internal=[
            'Jane Smith',
            'Elena Marquez',
        ],
        participants_external=[
            'Dr. Anita Verma — CMIO',
            'Sandra Cho — Head of Compliance',
        ],
    ),
    GongCall(
        call_id='gong-jane-ret-1',
        account_id='acc-jane-ret',
        call_date=_dt(_d(2026, 1, 15), 18, 0),
        duration_minutes=35,
        summary='Introductory call on building a retail identity graph across e-commerce and stores. Cartograph wants clearer match rates and privacy controls before scaling personalization.',
        topics=[
            'identity graph',
            'omnichannel strategy',
        ],
        action_items=[
            '[DONE] Noah to share identity resolution patterns used at similar retailers.',
            '[DONE] Cartograph to export current match-rate benchmarks (anonymized).',
        ],
        next_steps=[
            'POS integration discovery with store systems vendor.',
        ],
        participants_internal=[
            'Jane Smith',
            'Noah Ibrahim',
        ],
        participants_external=[
            'Tessa Wainwright — VP Digital & Omnichannel',
            'Omar Haddad — Director, Customer Analytics',
        ],
    ),
    GongCall(
        call_id='gong-jane-ret-2',
        account_id='acc-jane-ret',
        call_date=_dt(_d(2026, 2, 11), 14, 30),
        duration_minutes=50,
        summary='POS integration planning: latency and idempotency requirements for in-store events feeding the graph. Marketing asked how promo effectiveness measurement would change with unified IDs.',
        topics=[
            'POS integration',
            'identity graph',
            'promo effectiveness',
        ],
        action_items=[
            '[DONE] Noah to draft event contract for basket-level POS payloads.',
            'Cartograph IT to confirm VPN paths for store gateway connectivity.',
        ],
        next_steps=[
            'Design session on holdout methodology for promo lift tests.',
        ],
        participants_internal=[
            'Jane Smith',
            'Noah Ibrahim',
        ],
        participants_external=[
            'Omar Haddad — Director, Customer Analytics',
            'Helena Brooks — Head of Marketing Science',
        ],
    ),
    GongCall(
        call_id='gong-jane-ret-3',
        account_id='acc-jane-ret',
        call_date=_dt(_d(2026, 3, 20), 15, 0),
        duration_minutes=42,
        summary='Pilot stores are streaming events successfully; omnichannel dashboards show improved cross-channel attribution. Discussion centered on scaling to all regions and tuning promo holdouts for seasonal campaigns.',
        topics=[
            'omnichannel strategy',
            'promo effectiveness',
            'identity graph',
        ],
        action_items=[
            'Noah to support regional rollout playbook and data quality SLAs.',
            'Jane to schedule executive QBR on ROI from unified identity.',
        ],
        next_steps=[
            'Expand pilot to Canada in Q2 pending privacy review.',
        ],
        participants_internal=[
            'Jane Smith',
            'Noah Ibrahim',
        ],
        participants_external=[
            'Tessa Wainwright — VP Digital & Omnichannel',
            'Helena Brooks — Head of Marketing Science',
        ],
    ),
    GongCall(
        call_id='gong-jane-tech-1',
        account_id='acc-jane-tech',
        call_date=_dt(_d(2026, 1, 6), 17, 30),
        duration_minutes=44,
        summary='Lattice described their telemetry lakehouse goals and need for a centralized feature store ahead of several product launches. We scoped ingestion volumes and team ownership between platform and ML engineers.',
        topics=[
            'telemetry lakehouse',
            'feature store',
        ],
        action_items=[
            '[DONE] Amelia to provide sizing worksheet for streaming + batch features.',
            '[DONE] Lattice to nominate service owners for model training vs serving.',
        ],
        next_steps=[
            'Go-live readiness assessment for first internal customer team.',
        ],
        participants_internal=[
            'Jane Smith',
            'Amelia Chen',
        ],
        participants_external=[
            'Nina Park — VP Engineering',
            'Theo Bergstrom — Director, ML Platform',
        ],
    ),
    GongCall(
        call_id='gong-jane-tech-2',
        account_id='acc-jane-tech',
        call_date=_dt(_d(2026, 1, 28), 16, 0),
        duration_minutes=58,
        summary='Detailed design for feature store namespaces and lineage; telemetry pipelines now land in curated bronze/silver layers. Identified risk that on-call for streaming jobs was still with a single engineer.',
        topics=[
            'feature store',
            'telemetry lakehouse',
            'go-live readiness',
        ],
        action_items=[
            '[DONE] Amelia to document runbooks for top five streaming jobs.',
            'Lattice to hire second platform SRE before GA date.',
        ],
        next_steps=[
            'SRE handover session once backup hire starts.',
        ],
        participants_internal=[
            'Jane Smith',
            'Amelia Chen',
        ],
        participants_external=[
            'Theo Bergstrom — Director, ML Platform',
            'Chris Dalton — Head of SRE',
        ],
    ),
    GongCall(
        call_id='gong-jane-tech-3',
        account_id='acc-jane-tech',
        call_date=_dt(_d(2026, 2, 19), 15, 30),
        duration_minutes=36,
        summary='Go-live rehearsal exposed a gap in feature backfill idempotency under load. Team agreed to delay internal GA by one sprint to harden replay logic and observability.',
        topics=[
            'go-live readiness',
            'feature store',
        ],
        action_items=[
            '[DONE] Lattice eng to implement idempotent backfill job with checkpoints.',
            'Amelia to review load test results before sign-off.',
        ],
        next_steps=[
            'Formal SRE handover with paired shadowing week.',
        ],
        participants_internal=[
            'Jane Smith',
            'Amelia Chen',
        ],
        participants_external=[
            'Nina Park — VP Engineering',
            'Chris Dalton — Head of SRE',
        ],
    ),
    GongCall(
        call_id='gong-jane-tech-4',
        account_id='acc-jane-tech',
        call_date=_dt(_d(2026, 3, 25), 14, 0),
        duration_minutes=29,
        summary='SRE handover completed: new engineer shadowed incidents and took primary for a dry-run weekend. Feature store GA is cleared contingent on one remaining dashboard for training-serving skew alerts.',
        topics=[
            'SRE handover',
            'go-live readiness',
            'telemetry lakehouse',
        ],
        action_items=[
            "Amelia to validate skew alert thresholds with Theo's team.",
            'Jane to close engagement documentation and success criteria.',
        ],
        next_steps=[
            "Public launch announcement aligned with Lattice's April product release.",
        ],
        participants_internal=[
            'Jane Smith',
            'Amelia Chen',
        ],
        participants_external=[
            'Nina Park — VP Engineering',
            'Theo Bergstrom — Director, ML Platform',
            'Chris Dalton — Head of SRE',
        ],
    ),
    GongCall(
        call_id='gong-carlos-media-1',
        account_id='acc-carlos-media',
        call_date=_dt(_d(2026, 1, 9), 20, 0),
        duration_minutes=47,
        summary='Horizon wants sharper audience segmentation across linear and digital inventory. We introduced Cortex AI capabilities and discussed content metadata quality as a prerequisite.',
        topics=[
            'audience segmentation',
            'Cortex AI',
            'content tagging',
        ],
        action_items=[
            '[DONE] Jordan to share segmentation blueprint for cross-platform IDs.',
            '[DONE] Horizon to inventory existing taxonomy and tag coverage.',
        ],
        next_steps=[
            'Workshop on ad yield optimization tied to audience clusters.',
        ],
        participants_internal=[
            'Carlos Rodriguez',
            'Jordan Blake',
        ],
        participants_external=[
            'Vanessa Cole — Chief Digital Officer',
            'Ethan Roy — Director, Ad Product',
        ],
    ),
    GongCall(
        call_id='gong-carlos-media-2',
        account_id='acc-carlos-media',
        call_date=_dt(_d(2026, 2, 7), 15, 0),
        duration_minutes=41,
        summary='Content tagging pilot improved consistency for sports vs news assets; Cortex models trained on enriched metadata showed lift in segment match rates. Ad ops raised concerns about latency in real-time bidding.',
        topics=[
            'content tagging',
            'Cortex AI',
            'ad yield',
        ],
        action_items=[
            '[DONE] Jordan to tune Cortex batch scoring window for overnight refreshes.',
            'Carlos to bring ad yield specialist for next session.',
        ],
        next_steps=[
            'Prototype low-latency feature subset for programmatic slots.',
        ],
        participants_internal=[
            'Carlos Rodriguez',
            'Jordan Blake',
        ],
        participants_external=[
            'Ethan Roy — Director, Ad Product',
            'Paige Donovan — VP, Revenue Operations',
        ],
    ),
    GongCall(
        call_id='gong-carlos-media-3',
        account_id='acc-carlos-media',
        call_date=_dt(_d(2026, 3, 18), 16, 30),
        duration_minutes=54,
        summary='Ad yield models linked to refined segments are in shadow mode for two regional markets. Leadership approved scaling if fill-rate and CPM stability hold through March Madness inventory spikes.',
        topics=[
            'ad yield',
            'audience segmentation',
            'Cortex AI',
        ],
        action_items=[
            'Jordan to monitor shadow vs control during high-traffic sports windows.',
            'Horizon finance to validate revenue attribution methodology.',
        ],
        next_steps=[
            'National rollout decision in first week of April.',
        ],
        participants_internal=[
            'Carlos Rodriguez',
            'Jordan Blake',
        ],
        participants_external=[
            'Vanessa Cole — Chief Digital Officer',
            'Paige Donovan — VP, Revenue Operations',
        ],
    ),
    GongCall(
        call_id='gong-carlos-mfg-1',
        account_id='acc-carlos-mfg',
        call_date=_dt(_d(2026, 1, 14), 14, 0),
        duration_minutes=46,
        summary='Titan outlined OT/IT separation and the goal of landing high-frequency sensor data in Snowflake for predictive maintenance. Security stressed no direct cloud egress from plant floors without DMZ brokers.',
        topics=[
            'sensor data',
            'OT/IT networks',
            'predictive maintenance',
        ],
        action_items=[
            '[DONE] Sofia to document reference pattern for edge aggregation brokers.',
            '[DONE] Titan plant IT to approve pilot site network changes.',
        ],
        next_steps=[
            'Define Iceberg table layout for time-series retention tiers.',
        ],
        participants_internal=[
            'Carlos Rodriguez',
            'Sofia Petrov',
        ],
        participants_external=[
            'Henrik Voss — VP Manufacturing Technology',
            'Yuki Tanaka — Director, Plant Digitalization',
        ],
    ),
    GongCall(
        call_id='gong-carlos-mfg-2',
        account_id='acc-carlos-mfg',
        call_date=_dt(_d(2026, 2, 5), 17, 0),
        duration_minutes=39,
        summary='Iceberg tables chosen for long-term vibration archives; pilot line ingesting 10k points/sec successfully. Data science wants labeled failure windows for model training—maintenance logs need standardization.',
        topics=[
            'Iceberg tables',
            'sensor data',
            'predictive maintenance',
        ],
        action_items=[
            '[DONE] Titan reliability team to export six months of CMMS work orders.',
            'Sofia to help map failure codes to sensor anomaly windows.',
        ],
        next_steps=[
            'OT security review of broker certificate rotation.',
        ],
        participants_internal=[
            'Carlos Rodriguez',
            'Sofia Petrov',
        ],
        participants_external=[
            'Yuki Tanaka — Director, Plant Digitalization',
            'Marcus Flint — Head of OT Security',
        ],
    ),
    GongCall(
        call_id='gong-carlos-mfg-3',
        account_id='acc-carlos-mfg',
        call_date=_dt(_d(2026, 3, 14), 15, 30),
        duration_minutes=60,
        summary='Predictive maintenance model achieved acceptable precision on the pilot line; expansion to two additional plants hinges on replicating broker footprint. OT/IT teams aligned on phased rollout and shared monitoring.',
        topics=[
            'predictive maintenance',
            'OT/IT networks',
            'Iceberg tables',
        ],
        action_items=[
            'Carlos to facilitate joint runbook between corporate IT and plant OT.',
            'Sofia to package model monitoring queries for Snowflake alerts.',
        ],
        next_steps=[
            'Second plant cutover targeted for mid-April.',
        ],
        participants_internal=[
            'Carlos Rodriguez',
            'Sofia Petrov',
        ],
        participants_external=[
            'Henrik Voss — VP Manufacturing Technology',
            'Marcus Flint — Head of OT Security',
        ],
    ),
    GongCall(
        call_id='gong-carlos-ins-1',
        account_id='acc-carlos-ins',
        call_date=_dt(_d(2026, 1, 7), 16, 0),
        duration_minutes=51,
        summary='Sentinel described legacy mainframe policy and claims systems and the desire for cloud-based risk scoring with strict actuarial governance. Initial focus is read replicas and governed feature pipelines.',
        topics=[
            'risk scoring',
            'actuarial governance',
            'mainframe migration',
        ],
        action_items=[
            '[DONE] Marcus to draft model governance checklist aligned with NAIC principles.',
            '[DONE] Sentinel actuarial to sign off on dev environment data masking.',
        ],
        next_steps=[
            'Deep dive on claims fraud signals and mainframe offload path.',
        ],
        participants_internal=[
            'Carlos Rodriguez',
            'Marcus Webb',
        ],
        participants_external=[
            'Diane Foster — Chief Actuary',
            'Paul Richter — VP, Claims Transformation',
        ],
    ),
    GongCall(
        call_id='gong-carlos-ins-2',
        account_id='acc-carlos-ins',
        call_date=_dt(_d(2026, 1, 29), 15, 0),
        duration_minutes=43,
        summary='Claims fraud prototypes using Snowflake features showed promise but raised questions about explainability for investigators. Mainframe migration workstream defined three tranches: policy admin, billing, then claims.',
        topics=[
            'claims fraud',
            'mainframe migration',
            'risk scoring',
        ],
        action_items=[
            '[DONE] Marcus to implement SHAP-backed summaries for top fraud alerts.',
            'Sentinel to prioritize tranche-one tables for CDC replication.',
        ],
        next_steps=[
            'Actuarial governance board review of model risk tiering.',
        ],
        participants_internal=[
            'Carlos Rodriguez',
            'Marcus Webb',
        ],
        participants_external=[
            'Paul Richter — VP, Claims Transformation',
            'Diane Foster — Chief Actuary',
        ],
    ),
    GongCall(
        call_id='gong-carlos-ins-3',
        account_id='acc-carlos-ins',
        call_date=_dt(_d(2026, 2, 26), 14, 30),
        duration_minutes=37,
        summary='Governance board approved tier-2 models for pilot; claims fraud alerts now route to a specialist queue with audit trails. Mainframe CDC lag occasionally exceeds SLA—needs operational tuning before scale.',
        topics=[
            'actuarial governance',
            'claims fraud',
            'mainframe migration',
        ],
        action_items=[
            '[DONE] Sentinel ops to tune CDC batch windows and add lag dashboards.',
            'Carlos to align with enterprise architecture on cutover sequencing.',
        ],
        next_steps=[
            'Production pilot for two lines of business in March.',
        ],
        participants_internal=[
            'Carlos Rodriguez',
            'Marcus Webb',
        ],
        participants_external=[
            'Paul Richter — VP, Claims Transformation',
            'Laura Kim — Director, Enterprise Architecture',
        ],
    ),
    GongCall(
        call_id='gong-carlos-ins-4',
        account_id='acc-carlos-ins',
        call_date=_dt(_d(2026, 3, 21), 17, 0),
        duration_minutes=32,
        summary='Pilot live for auto and homeowners: fraud hit rate improved with fewer false positives per SIU feedback. Mainframe tranche-one offload is on track; risk scoring pipeline will absorb new billing feeds next quarter.',
        topics=[
            'claims fraud',
            'risk scoring',
            'mainframe migration',
        ],
        action_items=[
            'Marcus to extend governance packet for billing-sourced features.',
            'Sentinel SIU to finalize investigator training on new alert UX.',
        ],
        next_steps=[
            'Expand pilot to commercial lines pending April readiness review.',
        ],
        participants_internal=[
            'Carlos Rodriguez',
            'Marcus Webb',
        ],
        participants_external=[
            'Diane Foster — Chief Actuary',
            'Paul Richter — VP, Claims Transformation',
        ],
    ),
    GongCall(
        call_id='gong-carlos-tel-1',
        account_id='acc-carlos-tel',
        call_date=_dt(_d(2026, 1, 11), 19, 30),
        duration_minutes=48,
        summary='Atlas is forecasting acute capacity strain in two metro rings and wants unified network capacity models in Snowflake. Churn modeling leadership asked for a single customer feature layer across prepaid and postpaid.',
        topics=[
            'network capacity',
            'churn modeling',
        ],
        action_items=[
            '[DONE] Ingrid to share capacity planning dbt models from a peer telco.',
            '[DONE] Atlas network planning to export tower and backhaul utilization extracts.',
        ],
        next_steps=[
            'Kick off Teradata migration discovery for subscriber analytics marts.',
        ],
        participants_internal=[
            'Carlos Rodriguez',
            'Ingrid Larsson',
        ],
        participants_external=[
            'Brian McAllister — VP Network Planning',
            'Sofia Renard — Head of Customer Intelligence',
        ],
    ),
    GongCall(
        call_id='gong-carlos-tel-2',
        account_id='acc-carlos-tel',
        call_date=_dt(_d(2026, 1, 30), 16, 0),
        duration_minutes=56,
        summary='Teradata migration scoping: twelve marts identified, three classified as complex due to embedded business rules. Parallel run strategy agreed; churn features will be the first workload cut over.',
        topics=[
            'Teradata migration',
            'churn modeling',
            'network capacity',
        ],
        action_items=[
            '[DONE] Ingrid to build migration runbook for mart zero (subscriber base).',
            'Atlas to freeze schema changes on priority marts through February.',
        ],
        next_steps=[
            'Speech analytics use case intake with contact center leadership.',
        ],
        participants_internal=[
            'Carlos Rodriguez',
            'Ingrid Larsson',
        ],
        participants_external=[
            'Sofia Renard — Head of Customer Intelligence',
            'Derek Wu — Director, Data Platforms',
        ],
    ),
    GongCall(
        call_id='gong-carlos-tel-3',
        account_id='acc-carlos-tel',
        call_date=_dt(_d(2026, 2, 18), 15, 0),
        duration_minutes=45,
        summary='Speech analytics workshop: contact center wants transcription and topic models in Snowflake with strict retention policies. Network team reported improved forecast accuracy after ingesting live SNMP feeds.',
        topics=[
            'speech analytics',
            'network capacity',
            'Teradata migration',
        ],
        action_items=[
            '[DONE] Carlos to involve legal on call recording consent flows by state.',
            'Ingrid to prototype secure processing pipeline for audio metadata only.',
        ],
        next_steps=[
            'Validate churn model parity between Teradata and Snowflake for March cutover.',
        ],
        participants_internal=[
            'Carlos Rodriguez',
            'Ingrid Larsson',
        ],
        participants_external=[
            'Melissa Grant — VP, Contact Center Operations',
            'Brian McAllister — VP Network Planning',
        ],
    ),
    GongCall(
        call_id='gong-carlos-tel-4',
        account_id='acc-carlos-tel',
        call_date=_dt(_d(2026, 3, 6), 14, 30),
        duration_minutes=34,
        summary='Churn model parity tests passed within agreed tolerance; first Teradata mart retired in non-prod. Speech analytics pilot flagged GPU cost concerns—evaluating batch vs streaming transcription tradeoffs.',
        topics=[
            'Teradata migration',
            'churn modeling',
            'speech analytics',
        ],
        action_items=[
            '[DONE] Ingrid to optimize batch transcription schedule for off-peak GPU use.',
            'Atlas finance to approve pilot GPU budget through Q2.',
        ],
        next_steps=[
            'Production Teradata cutover for subscriber mart on March 22.',
        ],
        participants_internal=[
            'Carlos Rodriguez',
            'Ingrid Larsson',
        ],
        participants_external=[
            'Derek Wu — Director, Data Platforms',
            'Sofia Renard — Head of Customer Intelligence',
        ],
    ),
    GongCall(
        call_id='gong-carlos-tel-5',
        account_id='acc-carlos-tel',
        call_date=_dt(_d(2026, 3, 27), 16, 30),
        duration_minutes=27,
        summary='Subscriber mart successfully live on Snowflake with no P1 incidents; network capacity dashboards adopted by regional planners. Speech analytics pilot expanded to two languages with positive QA scores.',
        topics=[
            'speech analytics',
            'network capacity',
            'Teradata migration',
        ],
        action_items=[
            'Ingrid to document lessons learned for remaining Teradata marts.',
            'Carlos to schedule Q2 roadmap session covering 5G small-cell forecasting.',
        ],
        next_steps=[
            'Begin mart two migration after Easter change freeze.',
        ],
        participants_internal=[
            'Carlos Rodriguez',
            'Ingrid Larsson',
        ],
        participants_external=[
            'Brian McAllister — VP Network Planning',
            'Melissa Grant — VP, Contact Center Operations',
            'Derek Wu — Director, Data Platforms',
        ],
    ),
]

MOCK_ACCOUNT_RESOURCES: list[AccountResource] = [
    AccountResource(
        resource_id='res-jane-fs-1',
        account_id='acc-jane-fs',
        resource_type='note',
        title='Weekly sync notes 3/15',
        content='Weekly sync notes 3/15 — Discussed Kafka pipeline stability. Priya flagged vendor security review as potential blocker. Action: follow up with procurement by 3/20.',
        link_type=None,
        created_by='Jane Smith',
        created_at=_dt(_d(2026, 3, 15), 16, 30),
    ),
    AccountResource(
        resource_id='res-jane-fs-2',
        account_id='acc-jane-fs',
        resource_type='link',
        title='Summit Trust - Activation Docs',
        content='https://drive.google.com/drive/folders/example-summit-trust',
        link_type='google_drive',
        created_by='Jane Smith',
        created_at=_dt(_d(2026, 2, 4), 10, 0),
    ),
    AccountResource(
        resource_id='res-jane-fs-3',
        account_id='acc-jane-fs',
        resource_type='link',
        title='Summit Trust Architecture Decision Records',
        content='https://confluence.internal/spaces/ACT/pages/summit-trust-adr',
        link_type='confluence',
        created_by='Jane Smith',
        created_at=_dt(_d(2026, 2, 11), 14, 15),
    ),
    AccountResource(
        resource_id='res-jane-hc-1',
        account_id='acc-jane-hc',
        resource_type='note',
        title='BAA amendment tracking',
        content='BAA amendment tracking — Legal team confirmed secondary PHI region requires separate BAA. Expected resolution by mid-April. Contact: Sarah Chen (legal@auroracare.com)',
        link_type=None,
        created_by='Jane Smith',
        created_at=_dt(_d(2026, 3, 22), 9, 45),
    ),
    AccountResource(
        resource_id='res-jane-hc-2',
        account_id='acc-jane-hc',
        resource_type='link',
        title='RE: AuroraCare BAA Amendment Status',
        content='mailto:thread-auroracare-baa@company.com',
        link_type='email',
        created_by='Jane Smith',
        created_at=_dt(_d(2026, 2, 19), 11, 20),
    ),
    AccountResource(
        resource_id='res-jane-ret-1',
        account_id='acc-jane-ret',
        resource_type='note',
        title='Merchandising team reorg',
        content='Merchandising team reorg — VP of Merch (Tom Blake) replaced by Lisa Park effective 3/10. Need to schedule intro call and re-align on KPIs.',
        link_type=None,
        created_by='Jane Smith',
        created_at=_dt(_d(2026, 3, 12), 13, 0),
    ),
    AccountResource(
        resource_id='res-jane-ret-2',
        account_id='acc-jane-ret',
        resource_type='link',
        title='Cartograph Retail - POS Integration Specs',
        content='https://drive.google.com/drive/folders/example-cartograph',
        link_type='google_drive',
        created_by='Jane Smith',
        created_at=_dt(_d(2026, 2, 7), 8, 30),
    ),
    AccountResource(
        resource_id='res-jane-ret-3',
        account_id='acc-jane-ret',
        resource_type='link',
        title='#cartograph-activation',
        content='https://company.slack.com/channels/cartograph-activation',
        link_type='slack',
        created_by='Jane Smith',
        created_at=_dt(_d(2026, 2, 21), 15, 40),
    ),
    AccountResource(
        resource_id='res-jane-tech-1',
        account_id='acc-jane-tech',
        resource_type='note',
        title='Go-live retrospective notes',
        content='Go-live retrospective notes — Went live 3/12. Key learnings: Streams costs 40% higher than projected. Recommend auto-suspend policies for similar future deployments.',
        link_type=None,
        created_by='Jane Smith',
        created_at=_dt(_d(2026, 3, 14), 17, 0),
    ),
    AccountResource(
        resource_id='res-jane-tech-2',
        account_id='acc-jane-tech',
        resource_type='link',
        title='Lattice Analytics - Go Live Runbook',
        content='https://confluence.internal/spaces/ACT/pages/lattice-go-live',
        link_type='confluence',
        created_by='Jane Smith',
        created_at=_dt(_d(2026, 2, 28), 12, 0),
    ),
    AccountResource(
        resource_id='res-carlos-media-1',
        account_id='acc-carlos-media',
        resource_type='note',
        title='Cortex AI evaluation',
        content='Cortex AI evaluation — Content tagging POC showing 78% accuracy on first-party content. Need 85%+ before production. Evaluating fine-tuning options.',
        link_type=None,
        created_by='Carlos Rodriguez',
        created_at=_dt(_d(2026, 3, 25), 10, 15),
    ),
    AccountResource(
        resource_id='res-carlos-media-2',
        account_id='acc-carlos-media',
        resource_type='link',
        title='Horizon Broadcast - Content Taxonomy',
        content='https://drive.google.com/drive/folders/example-horizon',
        link_type='google_drive',
        created_by='Carlos Rodriguez',
        created_at=_dt(_d(2026, 2, 14), 9, 0),
    ),
    AccountResource(
        resource_id='res-carlos-mfg-1',
        account_id='acc-carlos-mfg',
        resource_type='note',
        title='OT network access',
        content='OT network access — IT security team (contact: Dave Mueller, dave.m@titan-iot.com) requires VPN access form + security assessment before opening firewall ports for sensor data ingestion.',
        link_type=None,
        created_by='Carlos Rodriguez',
        created_at=_dt(_d(2026, 3, 18), 14, 22),
    ),
    AccountResource(
        resource_id='res-carlos-mfg-2',
        account_id='acc-carlos-mfg',
        resource_type='link',
        title='RE: Titan IoT Firewall Change Request',
        content='mailto:thread-titan-firewall@company.com',
        link_type='email',
        created_by='Carlos Rodriguez',
        created_at=_dt(_d(2026, 2, 26), 16, 5),
    ),
    AccountResource(
        resource_id='res-carlos-mfg-3',
        account_id='acc-carlos-mfg',
        resource_type='link',
        title='Titan IoT - Sensor Data Schema',
        content='https://confluence.internal/spaces/ACT/pages/titan-sensor-schema',
        link_type='confluence',
        created_by='Carlos Rodriguez',
        created_at=_dt(_d(2026, 3, 2), 11, 30),
    ),
    AccountResource(
        resource_id='res-carlos-ins-1',
        account_id='acc-carlos-ins',
        resource_type='note',
        title='Actuarial governance process',
        content='Actuarial governance process — Model risk committee meets quarterly (next: April 15). Need to submit model documentation package by April 1 for review.',
        link_type=None,
        created_by='Carlos Rodriguez',
        created_at=_dt(_d(2026, 3, 27), 8, 50),
    ),
    AccountResource(
        resource_id='res-carlos-ins-2',
        account_id='acc-carlos-ins',
        resource_type='link',
        title='Sentinel Mutual - Model Documentation',
        content='https://drive.google.com/drive/folders/example-sentinel',
        link_type='google_drive',
        created_by='Carlos Rodriguez',
        created_at=_dt(_d(2026, 2, 18), 13, 45),
    ),
    AccountResource(
        resource_id='res-carlos-tel-1',
        account_id='acc-carlos-tel',
        resource_type='note',
        title='Teradata migration status',
        content='Teradata migration status — 85% feature parity achieved. Remaining 15% involves complex stored procedures for billing reconciliation. April sprint focused on these.',
        link_type=None,
        created_by='Carlos Rodriguez',
        created_at=_dt(_d(2026, 3, 28), 15, 10),
    ),
    AccountResource(
        resource_id='res-carlos-tel-2',
        account_id='acc-carlos-tel',
        resource_type='link',
        title='Atlas Comms - Migration Tracker',
        content='https://confluence.internal/spaces/ACT/pages/atlas-migration',
        link_type='confluence',
        created_by='Carlos Rodriguez',
        created_at=_dt(_d(2026, 2, 9), 10, 0),
    ),
    AccountResource(
        resource_id='res-carlos-tel-3',
        account_id='acc-carlos-tel',
        resource_type='link',
        title='#atlas-activation',
        content='https://company.slack.com/channels/atlas-activation',
        link_type='slack',
        created_by='Carlos Rodriguez',
        created_at=_dt(_d(2026, 3, 5), 9, 25),
    ),
]

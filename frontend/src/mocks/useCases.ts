import type { UseCase, PSNote } from '../types'

/** note_id format: pn-{use_case_id without uc- prefix}-{n} */
function psNotes(
  useCaseId: string,
  entries: readonly { author: string; content: string; created_at: string }[]
): PSNote[] {
  const suffix = useCaseId.replace(/^uc-/, '')
  return entries.map((e, i) => ({
    note_id: `pn-${suffix}-${i + 1}`,
    use_case_id: useCaseId,
    author: e.author,
    content: e.content,
    created_at: e.created_at,
  }))
}

export const MOCK_USE_CASES: UseCase[] = [
  {
    use_case_id: 'uc-jane-fs-001',
    account_id: 'acc-jane-fs',
    account_name: 'Summit Trust Bank',
    use_case_name: 'Real-time Fraud Detection',
    description:
      'Detect and flag fraudulent transactions in real-time using streaming data from Kafka into Snowpipe with ML scoring via Snowpark.',
    status: 'On Track',
    ps_notes: psNotes('uc-jane-fs-001', [
      {
        author: 'Daniel Okonkwo',
        content:
          'Kickoff complete; agreed on Kafka topics and Snowflake landing zone. Awaiting infra for dedicated cluster.',
        created_at: '2026-02-14T10:00:00',
      },
      {
        author: 'Priya Nandakumar',
        content:
          'Snowpipe auto-ingest validated on pilot topic; next is wiring feature inputs for Snowpark scoring job.',
        created_at: '2026-03-07T14:30:00',
      },
      {
        author: 'Priya Nandakumar',
        content:
          'Kafka → Snowpipe landing; model scoring in Snowpark. Vendor security review scheduled 4/2.',
        created_at: '2026-03-28T11:20:00',
      },
    ]),
    ps_notes_summary:
      'Core pipeline is operational with Kafka ingestion working well. ML scoring in Snowpark showing promising accuracy. Main risk is the vendor security review on 4/2 which could affect go-live timeline.',
    go_live_date: null,
    target_go_live_date: '2026-05-15',
    lead_se: 'Priya Nandakumar',
    ace_assigned: 'ace-jane',
    created_date: '2025-10-01',
    last_modified_date: '2026-03-28T11:20:00',
    stage: 'Impl In Progress',
    complexity: 'High',
  },
  {
    use_case_id: 'uc-jane-fs-002',
    account_id: 'acc-jane-fs',
    account_name: 'Summit Trust Bank',
    use_case_name: 'AML Watchlist & Transaction Monitoring',
    description:
      'Monitor transaction patterns against global regulatory watchlists for anti-money laundering compliance using entity resolution and graph analytics.',
    status: 'In Progress',
    ps_notes: psNotes('uc-jane-fs-002', [
      {
        author: 'Priya Nandakumar',
        content:
          'Source systems mapped; initial watchlist joins running in dev. Performance baseline TBD.',
        created_at: '2026-02-18T09:00:00',
      },
      {
        author: 'Daniel Okonkwo',
        content:
          'Graph prototype on sample data looks good; full-volume entity resolution still tuning.',
        created_at: '2026-03-12T16:15:00',
      },
      {
        author: 'Priya Nandakumar',
        content:
          'Entity resolution slower than planned; evaluating Dynamic Tables vs incremental tasks.',
        created_at: '2026-03-27T09:05:00',
      },
    ]),
    ps_notes_summary:
      'Entity resolution performance is the main bottleneck. Evaluating Dynamic Tables as alternative to incremental tasks.',
    go_live_date: null,
    target_go_live_date: '2026-07-01',
    lead_se: 'Priya Nandakumar',
    ace_assigned: 'ace-jane',
    created_date: '2025-11-18',
    last_modified_date: '2026-03-27T09:05:00',
    stage: 'Technical Win',
    complexity: 'Medium',
  },
  {
    use_case_id: 'uc-jane-fs-003',
    account_id: 'acc-jane-fs',
    account_name: 'Summit Trust Bank',
    use_case_name: 'Regulatory Reporting Data Mart',
    description:
      'Build consolidated data marts for regulatory reporting across Basel III, CCAR, and DFAST requirements.',
    status: 'On Track',
    ps_notes: psNotes('uc-jane-fs-003', [
      {
        author: 'Daniel Okonkwo',
        content: 'Requirements workshop with finance; mart scope signed for v1.',
        created_at: '2026-02-10T11:00:00',
      },
      {
        author: 'Priya Nandakumar',
        content: 'Basel mart ETL in test; CCAR dimensions aligned with risk team.',
        created_at: '2026-03-08T13:45:00',
      },
      {
        author: 'Daniel Okonkwo',
        content:
          'Ahead of schedule on core marts; waiting on finance sign-off for historical backfill window.',
        created_at: '2026-03-29T16:40:00',
      },
    ]),
    ps_notes_summary:
      'Progressing ahead of schedule. Core marts built and tested. Only blocker is finance sign-off on backfill window.',
    go_live_date: null,
    target_go_live_date: '2026-04-20',
    lead_se: 'Daniel Okonkwo',
    ace_assigned: 'ace-jane',
    created_date: '2026-01-06',
    last_modified_date: '2026-03-29T16:40:00',
    stage: 'Use Case Won',
    complexity: 'Low',
  },
  {
    use_case_id: 'uc-jane-hc-001',
    account_id: 'acc-jane-hc',
    account_name: 'AuroraCare Health Network',
    use_case_name: 'Patient 360 Clinical Analytics',
    description:
      'Unify clinical, claims, and patient interaction data into a comprehensive Patient 360 view for care coordination and outcomes analysis.',
    status: 'Blocked',
    ps_notes: psNotes('uc-jane-hc-001', [
      {
        author: 'Elena Marquez',
        content: 'UAT environment ready; synthetic patient flows passing smoke tests.',
        created_at: '2026-02-19T10:30:00',
      },
      {
        author: 'Daniel Okonkwo',
        content: 'Databricks bridge code complete pending legal clearance on data residency.',
        created_at: '2026-03-05T15:00:00',
      },
      {
        author: 'Elena Marquez',
        content: 'Legal requested changes to secondary region wording; engineering on standby.',
        created_at: '2026-03-18T09:20:00',
      },
      {
        author: 'Elena Marquez',
        content:
          'Blocked on BAA amendment for secondary PHI region; Databricks bridge paused.',
        created_at: '2026-03-25T13:10:00',
      },
    ]),
    ps_notes_summary:
      'Technical implementation complete but blocked on legal BAA amendment. No technical risks once legal clears.',
    go_live_date: null,
    target_go_live_date: '2026-06-10',
    lead_se: 'Elena Marquez',
    ace_assigned: 'ace-jane',
    created_date: '2026-02-03',
    last_modified_date: '2026-03-25T13:10:00',
    stage: 'Impl In Progress',
    complexity: 'High',
  },
  {
    use_case_id: 'uc-jane-hc-002',
    account_id: 'acc-jane-hc',
    account_name: 'AuroraCare Health Network',
    use_case_name: 'Claims Adjudication ML Assist',
    description:
      'Use machine learning to assist claims adjusters with automated scoring, anomaly detection, and recommended actions.',
    status: 'In Progress',
    ps_notes: psNotes('uc-jane-hc-002', [
      {
        author: 'Elena Marquez',
        content: 'POC scope locked; claims history extract approved for sandbox.',
        created_at: '2026-03-02T11:00:00',
      },
      {
        author: 'Priya Nandakumar',
        content: 'Exploratory models on sample claims; feature candidates documented.',
        created_at: '2026-03-16T14:00:00',
      },
      {
        author: 'Elena Marquez',
        content:
          'Feature store design workshop completed; moving to Snowpark training pipeline.',
        created_at: '2026-03-30T10:00:00',
      },
    ]),
    ps_notes_summary:
      'Feature store design finalized. Building Snowpark training pipeline. Early models show good accuracy.',
    go_live_date: null,
    target_go_live_date: '2026-08-05',
    lead_se: 'Elena Marquez',
    ace_assigned: 'ace-jane',
    created_date: '2026-02-20',
    last_modified_date: '2026-03-30T10:00:00',
    stage: 'Impl Pending',
    complexity: 'Medium',
  },
  {
    use_case_id: 'uc-jane-ret-001',
    account_id: 'acc-jane-ret',
    account_name: 'Cartograph Retail Group',
    use_case_name: 'Omnichannel Customer 360',
    description:
      'Build a unified customer profile across online, in-store POS, mobile app, and loyalty program touchpoints.',
    status: 'On Track',
    ps_notes: psNotes('uc-jane-ret-001', [
      {
        author: 'Noah Ibrahim',
        content: 'Identity resolution rules v1 shipped; online + loyalty stitching stable.',
        created_at: '2026-02-12T09:00:00',
      },
      {
        author: 'Amelia Chen',
        content: 'POS delta pipeline added; seeing duplicate keys on weekend peaks.',
        created_at: '2026-03-01T16:30:00',
      },
      {
        author: 'Noah Ibrahim',
        content: 'Graph completeness at 68%; targeting 85% before UAT.',
        created_at: '2026-03-15T10:15:00',
      },
      {
        author: 'Noah Ibrahim',
        content:
          'Behind on identity graph completeness; added weekend load for POS deltas.',
        created_at: '2026-03-29T08:15:00',
      },
    ]),
    ps_notes_summary:
      'Identity graph at 72%, below 85% target. POS issues causing inconsistencies. Online and loyalty pipelines stable.',
    go_live_date: null,
    target_go_live_date: '2026-05-28',
    lead_se: 'Noah Ibrahim',
    ace_assigned: 'ace-jane',
    created_date: '2025-12-08',
    last_modified_date: '2026-03-29T08:15:00',
    stage: 'Impl In Progress',
    complexity: 'Medium',
  },
  {
    use_case_id: 'uc-jane-ret-002',
    account_id: 'acc-jane-ret',
    account_name: 'Cartograph Retail Group',
    use_case_name: 'Markdown & Promo Effectiveness',
    description:
      'Analyze markdown timing and promotional campaign effectiveness to optimize pricing strategies.',
    status: 'In Progress',
    ps_notes: psNotes('uc-jane-ret-002', [
      {
        author: 'Noah Ibrahim',
        content: 'Discovery sessions with merchandising; initial KPI set agreed.',
        created_at: '2026-02-05T13:00:00',
      },
      {
        author: 'Noah Ibrahim',
        content: 'Data model for promo lift drafted; waiting on campaign taxonomy from business.',
        created_at: '2026-03-01T11:45:00',
      },
      {
        author: 'Noah Ibrahim',
        content:
          'Stakeholder churn in merchandising; re-baselining KPIs — risk to original timeline.',
        created_at: '2026-03-22T17:50:00',
      },
    ]),
    ps_notes_summary:
      'At risk due to organizational changes. KPIs being re-baselined. Technical work paused.',
    go_live_date: null,
    target_go_live_date: '2026-04-30',
    lead_se: 'Noah Ibrahim',
    ace_assigned: 'ace-jane',
    created_date: '2026-01-15',
    last_modified_date: '2026-03-22T17:50:00',
    stage: 'Impl Pending',
    complexity: 'Low',
  },
  {
    use_case_id: 'uc-jane-tech-001',
    account_id: 'acc-jane-tech',
    account_name: 'Lattice Analytics',
    use_case_name: 'Product Telemetry Lakehouse',
    description:
      'Centralize product usage telemetry from multiple SaaS products into a unified lakehouse for analytics and health scoring.',
    status: 'Completed',
    ps_notes: psNotes('uc-jane-tech-001', [
      {
        author: 'Amelia Chen',
        content: 'Multi-product ingest landed in raw layer; standardizing event schema.',
        created_at: '2026-02-10T09:30:00',
      },
      {
        author: 'Noah Ibrahim',
        content: 'Curated lakehouse tables live in QA; dashboard pilot with PM team.',
        created_at: '2026-02-28T15:00:00',
      },
      {
        author: 'Amelia Chen',
        content: 'Go-live rehearsal passed; cutover window approved for 3/12.',
        created_at: '2026-03-10T11:00:00',
      },
      {
        author: 'Amelia Chen',
        content: 'Went live 3/12; handover to SRE for guardrails on Streams spend.',
        created_at: '2026-03-14T14:00:00',
      },
    ]),
    ps_notes_summary:
      'Successfully live since 3/12, ahead of schedule. SRE handover in progress for cost guardrails.',
    go_live_date: '2026-03-12',
    target_go_live_date: '2026-03-20',
    lead_se: 'Amelia Chen',
    ace_assigned: 'ace-jane',
    created_date: '2025-08-01',
    last_modified_date: '2026-03-14T14:00:00',
    stage: 'Deployed',
    complexity: 'Medium',
  },
  {
    use_case_id: 'uc-jane-tech-002',
    account_id: 'acc-jane-tech',
    account_name: 'Lattice Analytics',
    use_case_name: 'Real-time Feature Store for Recommendations',
    description:
      'Build a low-latency feature store serving ML features for real-time product recommendation models.',
    status: 'On Track',
    ps_notes: psNotes('uc-jane-tech-002', [
      {
        author: 'Amelia Chen',
        content: 'Serving API skeleton up; latency budget defined with ML team.',
        created_at: '2026-02-20T10:00:00',
      },
      {
        author: 'Jordan Blake',
        content: 'Online feature backfill job optimized; p99 under target in staging.',
        created_at: '2026-03-12T14:20:00',
      },
      {
        author: 'Amelia Chen',
        content:
          'Ahead of schedule on serving path; canary on 5% traffic this week.',
        created_at: '2026-03-30T09:30:00',
      },
    ]),
    ps_notes_summary:
      'Ahead of schedule. Canary on 5% traffic with excellent latency. Full rollout mid-April.',
    go_live_date: null,
    target_go_live_date: '2026-04-18',
    lead_se: 'Amelia Chen',
    ace_assigned: 'ace-jane',
    created_date: '2025-11-05',
    last_modified_date: '2026-03-30T09:30:00',
    stage: 'Go-Live',
    complexity: 'High',
  },
  {
    use_case_id: 'uc-carlos-media-001',
    account_id: 'acc-carlos-media',
    account_name: 'Horizon Broadcast Group',
    use_case_name: 'Audience Segmentation & Activation',
    description:
      'Segment viewing audiences by behavior, demographics, and content preferences for targeted advertising.',
    status: 'In Progress',
    ps_notes: psNotes('uc-carlos-media-001', [
      {
        author: 'Jordan Blake',
        content: 'POC kickoff; sample viewing logs and ad exposure data in Snowflake.',
        created_at: '2026-02-22T12:00:00',
      },
      {
        author: 'Sofia Petrov',
        content: 'Baseline segments defined; evaluating enrichment from third-party vendors.',
        created_at: '2026-03-14T09:30:00',
      },
      {
        author: 'Jordan Blake',
        content:
          'Cortex trial for content tagging; legal review on third-party clip usage.',
        created_at: '2026-03-28T12:05:00',
      },
    ]),
    ps_notes_summary:
      'Cortex AI evaluation for content tagging underway. Legal review pending on third-party data.',
    go_live_date: null,
    target_go_live_date: '2026-06-01',
    lead_se: 'Jordan Blake',
    ace_assigned: 'ace-carlos',
    created_date: '2025-12-01',
    last_modified_date: '2026-03-28T12:05:00',
    stage: 'Impl Pending',
    complexity: 'Medium',
  },
  {
    use_case_id: 'uc-carlos-media-002',
    account_id: 'acc-carlos-media',
    account_name: 'Horizon Broadcast Group',
    use_case_name: 'Ad Inventory Yield Optimization',
    description:
      'Optimize ad slot pricing and placement across linear and digital properties using demand forecasting.',
    status: 'On Track',
    ps_notes: psNotes('uc-carlos-media-002', [
      {
        author: 'Jordan Blake',
        content: 'Demand signals ingested; initial forecast model training started.',
        created_at: '2026-02-15T10:45:00',
      },
      {
        author: 'Jordan Blake',
        content: 'Forecast accuracy ~88% on holdout; integrating linear + digital blended view.',
        created_at: '2026-03-08T17:00:00',
      },
      {
        author: 'Ingrid Larsson',
        content: 'Warehouse autoscale review scheduled with FinOps before scale test.',
        created_at: '2026-03-22T11:30:00',
      },
      {
        author: 'Jordan Blake',
        content:
          'Stable pipelines; focusing on warehouse right-sizing before peak season.',
        created_at: '2026-03-29T18:00:00',
      },
    ]),
    ps_notes_summary:
      'Stable pipelines with 91% forecast accuracy. Optimizing warehouse costs before peak season.',
    go_live_date: null,
    target_go_live_date: '2026-05-05',
    lead_se: 'Jordan Blake',
    ace_assigned: 'ace-carlos',
    created_date: '2026-01-08',
    last_modified_date: '2026-03-29T18:00:00',
    stage: 'Impl In Progress',
    complexity: 'High',
  },
  {
    use_case_id: 'uc-carlos-mfg-001',
    account_id: 'acc-carlos-mfg',
    account_name: 'Titan Industrial IoT',
    use_case_name: 'Predictive Maintenance on Sensor Streams',
    description:
      'Ingest and analyze real-time sensor data from manufacturing equipment to predict failures.',
    status: 'In Progress',
    ps_notes: psNotes('uc-carlos-mfg-001', [
      {
        author: 'Sofia Petrov',
        content: 'Sensor topic schema agreed with plant IT; POC ingest to raw zone live.',
        created_at: '2026-03-01T09:00:00',
      },
      {
        author: 'Marcus Webb',
        content: 'Feature engineering on vibration windows; labels from maintenance tickets.',
        created_at: '2026-03-14T15:20:00',
      },
      {
        author: 'Sofia Petrov',
        content:
          'OT network firewall change delayed ingest; POC extended 2 weeks.',
        created_at: '2026-03-26T10:45:00',
      },
    ]),
    ps_notes_summary:
      'OT network segmentation is main blocker. ML models show strong capability when data flows.',
    go_live_date: null,
    target_go_live_date: '2026-07-22',
    lead_se: 'Sofia Petrov',
    ace_assigned: 'ace-carlos',
    created_date: '2026-02-18',
    last_modified_date: '2026-03-26T10:45:00',
    stage: 'Impl Pending',
    complexity: 'High',
  },
  {
    use_case_id: 'uc-carlos-mfg-002',
    account_id: 'acc-carlos-mfg',
    account_name: 'Titan Industrial IoT',
    use_case_name: 'Supply Chain Control Tower',
    description:
      'Build centralized supply chain visibility integrating supplier, logistics, and inventory data.',
    status: 'On Track',
    ps_notes: psNotes('uc-carlos-mfg-002', [
      {
        author: 'Sofia Petrov',
        content: 'Stakeholder interviews complete; source system list prioritized.',
        created_at: '2026-03-05T10:00:00',
      },
      {
        author: 'Jordan Blake',
        content: 'Logistics feeds sample loaded; supplier API access in progress.',
        created_at: '2026-03-18T14:10:00',
      },
      {
        author: 'Sofia Petrov',
        content:
          'Kicking off architecture review; Iceberg for long-retention plant history.',
        created_at: '2026-03-30T11:10:00',
      },
    ]),
    ps_notes_summary:
      'Early stage. Architecture review underway. Iceberg selected for historical data. No risks.',
    go_live_date: null,
    target_go_live_date: '2026-09-12',
    lead_se: 'Sofia Petrov',
    ace_assigned: 'ace-carlos',
    created_date: '2026-03-01',
    last_modified_date: '2026-03-30T11:10:00',
    stage: 'Technical Win',
    complexity: 'Medium',
  },
  {
    use_case_id: 'uc-carlos-ins-001',
    account_id: 'acc-carlos-ins',
    account_name: 'Sentinel Mutual Insurance',
    use_case_name: 'Underwriting Risk Scoring',
    description:
      'Develop ML-based risk scoring models for commercial underwriting to improve pricing accuracy.',
    status: 'Blocked',
    ps_notes: psNotes('uc-carlos-ins-001', [
      {
        author: 'Marcus Webb',
        content: 'Model training complete on historical book; shadow scoring in UAT.',
        created_at: '2026-02-11T11:00:00',
      },
      {
        author: 'Marcus Webb',
        content: 'Actuarial review session held; documentation package submitted.',
        created_at: '2026-03-01T16:00:00',
      },
      {
        author: 'Ingrid Larsson',
        content: 'Vendor API latency spikes noted; failover path documented.',
        created_at: '2026-03-12T09:45:00',
      },
      {
        author: 'Marcus Webb',
        content:
          'Blocked on actuarial model governance sign-off; external model vendor latency.',
        created_at: '2026-03-21T15:30:00',
      },
    ]),
    ps_notes_summary:
      'Models built and validated but blocked on governance approval. Vendor latency also an issue.',
    go_live_date: null,
    target_go_live_date: '2026-05-30',
    lead_se: 'Marcus Webb',
    ace_assigned: 'ace-carlos',
    created_date: '2025-11-20',
    last_modified_date: '2026-03-21T15:30:00',
    stage: 'Impl In Progress',
    complexity: 'High',
  },
  {
    use_case_id: 'uc-carlos-ins-002',
    account_id: 'acc-carlos-ins',
    account_name: 'Sentinel Mutual Insurance',
    use_case_name: 'Fraudulent Claims Detection',
    description:
      'Detect potentially fraudulent insurance claims using pattern analysis on historical claims data.',
    status: 'In Progress',
    ps_notes: psNotes('uc-carlos-ins-002', [
      {
        author: 'Marcus Webb',
        content: 'Mainframe extract pipeline live; initial row counts match expectations.',
        created_at: '2026-02-08T10:30:00',
      },
      {
        author: 'Marcus Webb',
        content: 'Anomaly features unstable on legacy codes; cleansing rules added.',
        created_at: '2026-03-10T14:00:00',
      },
      {
        author: 'Marcus Webb',
        content:
          'Data quality issues on legacy mainframe extracts; added Data Engineering TMR.',
        created_at: '2026-03-29T09:00:00',
      },
    ]),
    ps_notes_summary:
      'Mainframe data quality is primary challenge. DE TMR added. Models work well on clean data.',
    go_live_date: null,
    target_go_live_date: '2026-06-18',
    lead_se: 'Marcus Webb',
    ace_assigned: 'ace-carlos',
    created_date: '2026-01-05',
    last_modified_date: '2026-03-29T09:00:00',
    stage: 'Impl In Progress',
    complexity: 'Medium',
  },
  {
    use_case_id: 'uc-carlos-tel-001',
    account_id: 'acc-carlos-tel',
    account_name: 'Atlas Communications',
    use_case_name: 'Network Capacity Forecasting',
    description:
      'Forecast network capacity requirements across cell towers and fiber nodes using traffic patterns.',
    status: 'Completed',
    ps_notes: psNotes('uc-carlos-tel-001', [
      {
        author: 'Ingrid Larsson',
        content: 'Traffic aggregates modeled; backtest vs actuals within tolerance.',
        created_at: '2026-01-28T09:00:00',
      },
      {
        author: 'Sofia Petrov',
        content: 'Production cutover plan signed; elastic WH sizing reviewed.',
        created_at: '2026-02-14T13:30:00',
      },
      {
        author: 'Ingrid Larsson',
        content: 'Go-live 2/24 executed; dashboards wired to NOC.',
        created_at: '2026-02-24T18:00:00',
      },
      {
        author: 'Ingrid Larsson',
        content:
          'Production since 2/24; monitoring credit burn on elastic warehouses.',
        created_at: '2026-02-26T13:00:00',
      },
    ]),
    ps_notes_summary:
      'In production since 2/24. Forecasting accuracy on target. Credit consumption on elastic WHs higher than expected.',
    go_live_date: '2026-02-24',
    target_go_live_date: '2026-03-01',
    lead_se: 'Ingrid Larsson',
    ace_assigned: 'ace-carlos',
    created_date: '2025-07-12',
    last_modified_date: '2026-02-26T13:00:00',
    stage: 'Deployed',
    complexity: 'Medium',
  },
  {
    use_case_id: 'uc-carlos-tel-002',
    account_id: 'acc-carlos-tel',
    account_name: 'Atlas Communications',
    use_case_name: 'Customer Churn & Upsell Propensity',
    description:
      'Predict customer churn risk and upsell propensity to guide retention and upgrade campaigns.',
    status: 'On Track',
    ps_notes: psNotes('uc-carlos-tel-002', [
      {
        author: 'Ingrid Larsson',
        content: 'Teradata export batches running; schema mapping 70% complete.',
        created_at: '2026-02-18T10:15:00',
      },
      {
        author: 'Marcus Webb',
        content: 'Feature parity checklist shared with business; gaps on legacy promo fields.',
        created_at: '2026-03-10T11:00:00',
      },
      {
        author: 'Ingrid Larsson',
        content:
          'Slightly behind on feature parity vs legacy Teradata; catching up in April sprint.',
        created_at: '2026-03-28T16:20:00',
      },
    ]),
    ps_notes_summary:
      'Teradata migration 85% complete. Feature parity gap narrowing. Model accuracy comparable to legacy.',
    go_live_date: null,
    target_go_live_date: '2026-04-25',
    lead_se: 'Ingrid Larsson',
    ace_assigned: 'ace-carlos',
    created_date: '2025-09-30',
    last_modified_date: '2026-03-28T16:20:00',
    stage: 'Go-Live',
    complexity: 'High',
  },
  {
    use_case_id: 'uc-carlos-tel-003',
    account_id: 'acc-carlos-tel',
    account_name: 'Atlas Communications',
    use_case_name: 'Call Center Speech Analytics',
    description:
      'Analyze call center recordings using Cortex AI for sentiment analysis, topic extraction, and agent scoring.',
    status: 'In Progress',
    ps_notes: psNotes('uc-carlos-tel-003', [
      {
        author: 'Ingrid Larsson',
        content: 'POC scope: 10k anonymized calls; storage and access controls approved.',
        created_at: '2026-02-25T09:30:00',
      },
      {
        author: 'Jordan Blake',
        content: 'Initial Cortex pipeline ingests audio; transcription quality acceptable.',
        created_at: '2026-03-12T14:00:00',
      },
      {
        author: 'Ingrid Larsson',
        content:
          'Cortex audio pipeline POC; privacy redaction workflow in review.',
        created_at: '2026-03-30T08:40:00',
      },
    ]),
    ps_notes_summary:
      'Cortex POC promising. Privacy redaction in legal review. Sentiment accuracy at 87%.',
    go_live_date: null,
    target_go_live_date: '2026-07-08',
    lead_se: 'Ingrid Larsson',
    ace_assigned: 'ace-carlos',
    created_date: '2026-02-08',
    last_modified_date: '2026-03-30T08:40:00',
    stage: 'Impl Pending',
    complexity: 'Medium',
  },
]

import type { GongCall } from '../types'

export const MOCK_GONG_CALLS: GongCall[] = [
  // acc-jane-fs — Summit Trust Bank (Jane Smith + Priya Nandakumar)
  {
    call_id: 'gong-jane-fs-1',
    account_id: 'acc-jane-fs',
    call_date: '2026-01-08T15:00:00.000Z',
    duration_minutes: 45,
    summary:
      'Kickoff with Summit Trust to align on fraud detection modernization goals and Snowflake footprint. We reviewed current batch scoring latency and agreed on a phased approach starting with streaming ingestion into the lakehouse.',
    topics: ['fraud detection pipeline', 'Kafka integration', 'vendor security'],
    action_items: [
      '[DONE] Jane to share network diagram for Kafka → Snowflake connectivity options.',
      '[DONE] Priya to send reference architecture for real-time feature enrichment.',
      'Client security team to complete third-party risk questionnaire for Snowflake connectors.',
    ],
    next_steps: [
      'Schedule technical deep dive on Snowpark ML scoring with data science leads.',
    ],
    participants_internal: ['Jane Smith', 'Priya Nandakumar'],
    participants_external: [
      'David Okonkwo — VP Engineering',
      'Rachel Stein — Head of Fraud Operations',
    ],
  },
  {
    call_id: 'gong-jane-fs-2',
    account_id: 'acc-jane-fs',
    call_date: '2026-01-22T16:30:00.000Z',
    duration_minutes: 52,
    summary:
      'Deep dive on Snowpark ML scoring patterns and how Summit plans to shadow production models before cutover. Kafka topics and consumer groups were mapped; we surfaced a gap on PII tokenization at the edge.',
    topics: ['Snowpark ML scoring', 'Kafka integration', 'fraud detection pipeline'],
    action_items: [
      '[DONE] Priya to provide sample Snowpark UDF for score calibration.',
      'Summit to provision non-prod Kafka cluster mirroring prod topic schemas.',
      'Jane to coordinate vendor security review of the proposed streaming connector.',
    ],
    next_steps: [
      'Pilot scoring job in QA with historical chargeback labels.',
    ],
    participants_internal: ['Jane Smith', 'Priya Nandakumar'],
    participants_external: [
      'David Okonkwo — VP Engineering',
      'Miguel Santos — Director, Enterprise Data',
    ],
  },
  {
    call_id: 'gong-jane-fs-3',
    account_id: 'acc-jane-fs',
    call_date: '2026-02-14T14:00:00.000Z',
    duration_minutes: 38,
    summary:
      'Mid-sprint checkpoint: QA pilot showed acceptable latency but drift on high-value wire transfers. We agreed to tighten feature freshness windows and add monitoring hooks before expanding traffic.',
    topics: ['fraud detection pipeline', 'Snowpark ML scoring'],
    action_items: [
      '[DONE] Summit data science to rerun backtest with 15-minute feature windows.',
      'Priya to document rollback criteria for production shadow mode.',
    ],
    next_steps: [
      'Executive readout on vendor security sign-off status.',
    ],
    participants_internal: ['Jane Smith', 'Priya Nandakumar'],
    participants_external: [
      'Miguel Santos — Director, Enterprise Data',
      'Priya Desai — Chief Risk Officer',
    ],
  },
  {
    call_id: 'gong-jane-fs-4',
    account_id: 'acc-jane-fs',
    call_date: '2026-03-05T17:00:00.000Z',
    duration_minutes: 33,
    summary:
      'Vendor security cleared the streaming path; focus shifted to production shadow deployment windows and RACI for on-call. Minor tension on weekend cutover—agreed on a blue-green strategy with manual approval gates.',
    topics: ['vendor security', 'fraud detection pipeline', 'Kafka integration'],
    action_items: [
      'Jane to finalize cutover runbook and share with fraud ops.',
      'Summit SRE to validate alerting dashboards for Snowpark job failures.',
    ],
    next_steps: [
      'Go/no-go review the week of March 17 for shadow traffic at 10%.',
    ],
    participants_internal: ['Jane Smith', 'Priya Nandakumar'],
    participants_external: [
      'David Okonkwo — VP Engineering',
      'Rachel Stein — Head of Fraud Operations',
      "James O'Neill — Director, Infrastructure & SRE",
    ],
  },

  // acc-jane-hc — AuroraCare Health Network (Jane Smith + Elena Marquez)
  {
    call_id: 'gong-jane-hc-1',
    account_id: 'acc-jane-hc',
    call_date: '2026-01-10T19:00:00.000Z',
    duration_minutes: 40,
    summary:
      'Discovery session on Patient 360 ambitions and regulatory constraints for PHI in the cloud. AuroraCare outlined current siloed clinical and claims views and asked for a pragmatic BAA-aligned roadmap.',
    topics: ['BAA compliance', 'Patient 360', 'PHI data regions'],
    action_items: [
      '[DONE] Elena to send region residency matrix for healthcare workloads.',
      '[DONE] Jane to schedule follow-up with legal on subprocessors list.',
    ],
    next_steps: [
      'Workshop on claims adjudication data flows and source system inventory.',
    ],
    participants_internal: ['Jane Smith', 'Elena Marquez'],
    participants_external: [
      'Dr. Anita Verma — CMIO',
      'Greg Holloway — VP, Data & Analytics',
    ],
  },
  {
    call_id: 'gong-jane-hc-2',
    account_id: 'acc-jane-hc',
    call_date: '2026-02-04T15:30:00.000Z',
    duration_minutes: 55,
    summary:
      'Technical workshop mapping EHR feeds into a unified patient timeline while keeping PHI in approved regions. Claims adjudication rules surfaced as a dependency for financial completeness in Patient 360.',
    topics: ['Patient 360', 'claims adjudication', 'PHI data regions'],
    action_items: [
      '[DONE] AuroraCare to deliver de-identified sample schema for two hospitals.',
      'Elena to prototype secure view pattern for cross-facility providers.',
    ],
    next_steps: [
      'BAA addendum review with compliance before any prod PHI tests.',
    ],
    participants_internal: ['Jane Smith', 'Elena Marquez'],
    participants_external: [
      'Greg Holloway — VP, Data & Analytics',
      'Linda Morales — Director, Revenue Cycle',
    ],
  },
  {
    call_id: 'gong-jane-hc-3',
    account_id: 'acc-jane-hc',
    call_date: '2026-03-12T16:00:00.000Z',
    duration_minutes: 48,
    summary:
      'Progress review: secure views validated in lower environments; legal signed BAA amendments. Next focus is production cutover for two pilot sites and training analysts on the new Patient 360 workspace.',
    topics: ['BAA compliance', 'Patient 360', 'claims adjudication'],
    action_items: [
      'Jane to align go-live checklist with AuroraCare security operations.',
      'Elena to run performance tests on peak morning clinical query patterns.',
    ],
    next_steps: [
      'Pilot go-live targeted for late March with daily governance standups.',
    ],
    participants_internal: ['Jane Smith', 'Elena Marquez'],
    participants_external: [
      'Dr. Anita Verma — CMIO',
      'Sandra Cho — Head of Compliance',
    ],
  },

  // acc-jane-ret — Cartograph Retail Group (Jane Smith + Noah Ibrahim)
  {
    call_id: 'gong-jane-ret-1',
    account_id: 'acc-jane-ret',
    call_date: '2026-01-15T18:00:00.000Z',
    duration_minutes: 35,
    summary:
      'Introductory call on building a retail identity graph across e-commerce and stores. Cartograph wants clearer match rates and privacy controls before scaling personalization.',
    topics: ['identity graph', 'omnichannel strategy'],
    action_items: [
      '[DONE] Noah to share identity resolution patterns used at similar retailers.',
      '[DONE] Cartograph to export current match-rate benchmarks (anonymized).',
    ],
    next_steps: [
      'POS integration discovery with store systems vendor.',
    ],
    participants_internal: ['Jane Smith', 'Noah Ibrahim'],
    participants_external: [
      'Tessa Wainwright — VP Digital & Omnichannel',
      'Omar Haddad — Director, Customer Analytics',
    ],
  },
  {
    call_id: 'gong-jane-ret-2',
    account_id: 'acc-jane-ret',
    call_date: '2026-02-11T14:30:00.000Z',
    duration_minutes: 50,
    summary:
      'POS integration planning: latency and idempotency requirements for in-store events feeding the graph. Marketing asked how promo effectiveness measurement would change with unified IDs.',
    topics: ['POS integration', 'identity graph', 'promo effectiveness'],
    action_items: [
      '[DONE] Noah to draft event contract for basket-level POS payloads.',
      'Cartograph IT to confirm VPN paths for store gateway connectivity.',
    ],
    next_steps: [
      'Design session on holdout methodology for promo lift tests.',
    ],
    participants_internal: ['Jane Smith', 'Noah Ibrahim'],
    participants_external: [
      'Omar Haddad — Director, Customer Analytics',
      'Helena Brooks — Head of Marketing Science',
    ],
  },
  {
    call_id: 'gong-jane-ret-3',
    account_id: 'acc-jane-ret',
    call_date: '2026-03-20T15:00:00.000Z',
    duration_minutes: 42,
    summary:
      'Pilot stores are streaming events successfully; omnichannel dashboards show improved cross-channel attribution. Discussion centered on scaling to all regions and tuning promo holdouts for seasonal campaigns.',
    topics: ['omnichannel strategy', 'promo effectiveness', 'identity graph'],
    action_items: [
      'Noah to support regional rollout playbook and data quality SLAs.',
      'Jane to schedule executive QBR on ROI from unified identity.',
    ],
    next_steps: [
      'Expand pilot to Canada in Q2 pending privacy review.',
    ],
    participants_internal: ['Jane Smith', 'Noah Ibrahim'],
    participants_external: [
      'Tessa Wainwright — VP Digital & Omnichannel',
      'Helena Brooks — Head of Marketing Science',
    ],
  },

  // acc-jane-tech — Lattice Analytics (Jane Smith + Amelia Chen)
  {
    call_id: 'gong-jane-tech-1',
    account_id: 'acc-jane-tech',
    call_date: '2026-01-06T17:30:00.000Z',
    duration_minutes: 44,
    summary:
      'Lattice described their telemetry lakehouse goals and need for a centralized feature store ahead of several product launches. We scoped ingestion volumes and team ownership between platform and ML engineers.',
    topics: ['telemetry lakehouse', 'feature store'],
    action_items: [
      '[DONE] Amelia to provide sizing worksheet for streaming + batch features.',
      '[DONE] Lattice to nominate service owners for model training vs serving.',
    ],
    next_steps: [
      'Go-live readiness assessment for first internal customer team.',
    ],
    participants_internal: ['Jane Smith', 'Amelia Chen'],
    participants_external: [
      'Nina Park — VP Engineering',
      'Theo Bergstrom — Director, ML Platform',
    ],
  },
  {
    call_id: 'gong-jane-tech-2',
    account_id: 'acc-jane-tech',
    call_date: '2026-01-28T16:00:00.000Z',
    duration_minutes: 58,
    summary:
      'Detailed design for feature store namespaces and lineage; telemetry pipelines now land in curated bronze/silver layers. Identified risk that on-call for streaming jobs was still with a single engineer.',
    topics: ['feature store', 'telemetry lakehouse', 'go-live readiness'],
    action_items: [
      '[DONE] Amelia to document runbooks for top five streaming jobs.',
      'Lattice to hire second platform SRE before GA date.',
    ],
    next_steps: [
      'SRE handover session once backup hire starts.',
    ],
    participants_internal: ['Jane Smith', 'Amelia Chen'],
    participants_external: [
      'Theo Bergstrom — Director, ML Platform',
      'Chris Dalton — Head of SRE',
    ],
  },
  {
    call_id: 'gong-jane-tech-3',
    account_id: 'acc-jane-tech',
    call_date: '2026-02-19T15:30:00.000Z',
    duration_minutes: 36,
    summary:
      'Go-live rehearsal exposed a gap in feature backfill idempotency under load. Team agreed to delay internal GA by one sprint to harden replay logic and observability.',
    topics: ['go-live readiness', 'feature store'],
    action_items: [
      '[DONE] Lattice eng to implement idempotent backfill job with checkpoints.',
      'Amelia to review load test results before sign-off.',
    ],
    next_steps: [
      'Formal SRE handover with paired shadowing week.',
    ],
    participants_internal: ['Jane Smith', 'Amelia Chen'],
    participants_external: [
      'Nina Park — VP Engineering',
      'Chris Dalton — Head of SRE',
    ],
  },
  {
    call_id: 'gong-jane-tech-4',
    account_id: 'acc-jane-tech',
    call_date: '2026-03-25T14:00:00.000Z',
    duration_minutes: 29,
    summary:
      'SRE handover completed: new engineer shadowed incidents and took primary for a dry-run weekend. Feature store GA is cleared contingent on one remaining dashboard for training-serving skew alerts.',
    topics: ['SRE handover', 'go-live readiness', 'telemetry lakehouse'],
    action_items: [
      "Amelia to validate skew alert thresholds with Theo's team.",
      'Jane to close engagement documentation and success criteria.',
    ],
    next_steps: [
      "Public launch announcement aligned with Lattice's April product release.",
    ],
    participants_internal: ['Jane Smith', 'Amelia Chen'],
    participants_external: [
      'Nina Park — VP Engineering',
      'Theo Bergstrom — Director, ML Platform',
      'Chris Dalton — Head of SRE',
    ],
  },

  // acc-carlos-media — Horizon Broadcast Group (Carlos Rodriguez + Jordan Blake)
  {
    call_id: 'gong-carlos-media-1',
    account_id: 'acc-carlos-media',
    call_date: '2026-01-09T20:00:00.000Z',
    duration_minutes: 47,
    summary:
      'Horizon wants sharper audience segmentation across linear and digital inventory. We introduced Cortex AI capabilities and discussed content metadata quality as a prerequisite.',
    topics: ['audience segmentation', 'Cortex AI', 'content tagging'],
    action_items: [
      '[DONE] Jordan to share segmentation blueprint for cross-platform IDs.',
      '[DONE] Horizon to inventory existing taxonomy and tag coverage.',
    ],
    next_steps: [
      'Workshop on ad yield optimization tied to audience clusters.',
    ],
    participants_internal: ['Carlos Rodriguez', 'Jordan Blake'],
    participants_external: [
      'Vanessa Cole — Chief Digital Officer',
      'Ethan Roy — Director, Ad Product',
    ],
  },
  {
    call_id: 'gong-carlos-media-2',
    account_id: 'acc-carlos-media',
    call_date: '2026-02-07T15:00:00.000Z',
    duration_minutes: 41,
    summary:
      'Content tagging pilot improved consistency for sports vs news assets; Cortex models trained on enriched metadata showed lift in segment match rates. Ad ops raised concerns about latency in real-time bidding.',
    topics: ['content tagging', 'Cortex AI', 'ad yield'],
    action_items: [
      '[DONE] Jordan to tune Cortex batch scoring window for overnight refreshes.',
      'Carlos to bring ad yield specialist for next session.',
    ],
    next_steps: [
      'Prototype low-latency feature subset for programmatic slots.',
    ],
    participants_internal: ['Carlos Rodriguez', 'Jordan Blake'],
    participants_external: [
      'Ethan Roy — Director, Ad Product',
      'Paige Donovan — VP, Revenue Operations',
    ],
  },
  {
    call_id: 'gong-carlos-media-3',
    account_id: 'acc-carlos-media',
    call_date: '2026-03-18T16:30:00.000Z',
    duration_minutes: 54,
    summary:
      'Ad yield models linked to refined segments are in shadow mode for two regional markets. Leadership approved scaling if fill-rate and CPM stability hold through March Madness inventory spikes.',
    topics: ['ad yield', 'audience segmentation', 'Cortex AI'],
    action_items: [
      'Jordan to monitor shadow vs control during high-traffic sports windows.',
      'Horizon finance to validate revenue attribution methodology.',
    ],
    next_steps: [
      'National rollout decision in first week of April.',
    ],
    participants_internal: ['Carlos Rodriguez', 'Jordan Blake'],
    participants_external: [
      'Vanessa Cole — Chief Digital Officer',
      'Paige Donovan — VP, Revenue Operations',
    ],
  },

  // acc-carlos-mfg — Titan Industrial IoT (Carlos Rodriguez + Sofia Petrov)
  {
    call_id: 'gong-carlos-mfg-1',
    account_id: 'acc-carlos-mfg',
    call_date: '2026-01-14T14:00:00.000Z',
    duration_minutes: 46,
    summary:
      'Titan outlined OT/IT separation and the goal of landing high-frequency sensor data in Snowflake for predictive maintenance. Security stressed no direct cloud egress from plant floors without DMZ brokers.',
    topics: ['sensor data', 'OT/IT networks', 'predictive maintenance'],
    action_items: [
      '[DONE] Sofia to document reference pattern for edge aggregation brokers.',
      '[DONE] Titan plant IT to approve pilot site network changes.',
    ],
    next_steps: [
      'Define Iceberg table layout for time-series retention tiers.',
    ],
    participants_internal: ['Carlos Rodriguez', 'Sofia Petrov'],
    participants_external: [
      'Henrik Voss — VP Manufacturing Technology',
      'Yuki Tanaka — Director, Plant Digitalization',
    ],
  },
  {
    call_id: 'gong-carlos-mfg-2',
    account_id: 'acc-carlos-mfg',
    call_date: '2026-02-05T17:00:00.000Z',
    duration_minutes: 39,
    summary:
      'Iceberg tables chosen for long-term vibration archives; pilot line ingesting 10k points/sec successfully. Data science wants labeled failure windows for model training—maintenance logs need standardization.',
    topics: ['Iceberg tables', 'sensor data', 'predictive maintenance'],
    action_items: [
      '[DONE] Titan reliability team to export six months of CMMS work orders.',
      'Sofia to help map failure codes to sensor anomaly windows.',
    ],
    next_steps: [
      'OT security review of broker certificate rotation.',
    ],
    participants_internal: ['Carlos Rodriguez', 'Sofia Petrov'],
    participants_external: [
      'Yuki Tanaka — Director, Plant Digitalization',
      'Marcus Flint — Head of OT Security',
    ],
  },
  {
    call_id: 'gong-carlos-mfg-3',
    account_id: 'acc-carlos-mfg',
    call_date: '2026-03-14T15:30:00.000Z',
    duration_minutes: 60,
    summary:
      'Predictive maintenance model achieved acceptable precision on the pilot line; expansion to two additional plants hinges on replicating broker footprint. OT/IT teams aligned on phased rollout and shared monitoring.',
    topics: ['predictive maintenance', 'OT/IT networks', 'Iceberg tables'],
    action_items: [
      'Carlos to facilitate joint runbook between corporate IT and plant OT.',
      'Sofia to package model monitoring queries for Snowflake alerts.',
    ],
    next_steps: [
      'Second plant cutover targeted for mid-April.',
    ],
    participants_internal: ['Carlos Rodriguez', 'Sofia Petrov'],
    participants_external: [
      'Henrik Voss — VP Manufacturing Technology',
      'Marcus Flint — Head of OT Security',
    ],
  },

  // acc-carlos-ins — Sentinel Mutual Insurance (Carlos Rodriguez + Marcus Webb)
  {
    call_id: 'gong-carlos-ins-1',
    account_id: 'acc-carlos-ins',
    call_date: '2026-01-07T16:00:00.000Z',
    duration_minutes: 51,
    summary:
      'Sentinel described legacy mainframe policy and claims systems and the desire for cloud-based risk scoring with strict actuarial governance. Initial focus is read replicas and governed feature pipelines.',
    topics: ['risk scoring', 'actuarial governance', 'mainframe migration'],
    action_items: [
      '[DONE] Marcus to draft model governance checklist aligned with NAIC principles.',
      '[DONE] Sentinel actuarial to sign off on dev environment data masking.',
    ],
    next_steps: [
      'Deep dive on claims fraud signals and mainframe offload path.',
    ],
    participants_internal: ['Carlos Rodriguez', 'Marcus Webb'],
    participants_external: [
      'Diane Foster — Chief Actuary',
      'Paul Richter — VP, Claims Transformation',
    ],
  },
  {
    call_id: 'gong-carlos-ins-2',
    account_id: 'acc-carlos-ins',
    call_date: '2026-01-29T15:00:00.000Z',
    duration_minutes: 43,
    summary:
      'Claims fraud prototypes using Snowflake features showed promise but raised questions about explainability for investigators. Mainframe migration workstream defined three tranches: policy admin, billing, then claims.',
    topics: ['claims fraud', 'mainframe migration', 'risk scoring'],
    action_items: [
      '[DONE] Marcus to implement SHAP-backed summaries for top fraud alerts.',
      'Sentinel to prioritize tranche-one tables for CDC replication.',
    ],
    next_steps: [
      'Actuarial governance board review of model risk tiering.',
    ],
    participants_internal: ['Carlos Rodriguez', 'Marcus Webb'],
    participants_external: [
      'Paul Richter — VP, Claims Transformation',
      'Diane Foster — Chief Actuary',
    ],
  },
  {
    call_id: 'gong-carlos-ins-3',
    account_id: 'acc-carlos-ins',
    call_date: '2026-02-26T14:30:00.000Z',
    duration_minutes: 37,
    summary:
      'Governance board approved tier-2 models for pilot; claims fraud alerts now route to a specialist queue with audit trails. Mainframe CDC lag occasionally exceeds SLA—needs operational tuning before scale.',
    topics: ['actuarial governance', 'claims fraud', 'mainframe migration'],
    action_items: [
      '[DONE] Sentinel ops to tune CDC batch windows and add lag dashboards.',
      'Carlos to align with enterprise architecture on cutover sequencing.',
    ],
    next_steps: [
      'Production pilot for two lines of business in March.',
    ],
    participants_internal: ['Carlos Rodriguez', 'Marcus Webb'],
    participants_external: [
      'Paul Richter — VP, Claims Transformation',
      'Laura Kim — Director, Enterprise Architecture',
    ],
  },
  {
    call_id: 'gong-carlos-ins-4',
    account_id: 'acc-carlos-ins',
    call_date: '2026-03-21T17:00:00.000Z',
    duration_minutes: 32,
    summary:
      'Pilot live for auto and homeowners: fraud hit rate improved with fewer false positives per SIU feedback. Mainframe tranche-one offload is on track; risk scoring pipeline will absorb new billing feeds next quarter.',
    topics: ['claims fraud', 'risk scoring', 'mainframe migration'],
    action_items: [
      'Marcus to extend governance packet for billing-sourced features.',
      'Sentinel SIU to finalize investigator training on new alert UX.',
    ],
    next_steps: [
      'Expand pilot to commercial lines pending April readiness review.',
    ],
    participants_internal: ['Carlos Rodriguez', 'Marcus Webb'],
    participants_external: [
      'Diane Foster — Chief Actuary',
      'Paul Richter — VP, Claims Transformation',
    ],
  },

  // acc-carlos-tel — Atlas Communications (Carlos Rodriguez + Ingrid Larsson)
  {
    call_id: 'gong-carlos-tel-1',
    account_id: 'acc-carlos-tel',
    call_date: '2026-01-11T19:30:00.000Z',
    duration_minutes: 48,
    summary:
      'Atlas is forecasting acute capacity strain in two metro rings and wants unified network capacity models in Snowflake. Churn modeling leadership asked for a single customer feature layer across prepaid and postpaid.',
    topics: ['network capacity', 'churn modeling'],
    action_items: [
      '[DONE] Ingrid to share capacity planning dbt models from a peer telco.',
      '[DONE] Atlas network planning to export tower and backhaul utilization extracts.',
    ],
    next_steps: [
      'Kick off Teradata migration discovery for subscriber analytics marts.',
    ],
    participants_internal: ['Carlos Rodriguez', 'Ingrid Larsson'],
    participants_external: [
      'Brian McAllister — VP Network Planning',
      'Sofia Renard — Head of Customer Intelligence',
    ],
  },
  {
    call_id: 'gong-carlos-tel-2',
    account_id: 'acc-carlos-tel',
    call_date: '2026-01-30T16:00:00.000Z',
    duration_minutes: 56,
    summary:
      'Teradata migration scoping: twelve marts identified, three classified as complex due to embedded business rules. Parallel run strategy agreed; churn features will be the first workload cut over.',
    topics: ['Teradata migration', 'churn modeling', 'network capacity'],
    action_items: [
      '[DONE] Ingrid to build migration runbook for mart zero (subscriber base).',
      'Atlas to freeze schema changes on priority marts through February.',
    ],
    next_steps: [
      'Speech analytics use case intake with contact center leadership.',
    ],
    participants_internal: ['Carlos Rodriguez', 'Ingrid Larsson'],
    participants_external: [
      'Sofia Renard — Head of Customer Intelligence',
      'Derek Wu — Director, Data Platforms',
    ],
  },
  {
    call_id: 'gong-carlos-tel-3',
    account_id: 'acc-carlos-tel',
    call_date: '2026-02-18T15:00:00.000Z',
    duration_minutes: 45,
    summary:
      'Speech analytics workshop: contact center wants transcription and topic models in Snowflake with strict retention policies. Network team reported improved forecast accuracy after ingesting live SNMP feeds.',
    topics: ['speech analytics', 'network capacity', 'Teradata migration'],
    action_items: [
      '[DONE] Carlos to involve legal on call recording consent flows by state.',
      'Ingrid to prototype secure processing pipeline for audio metadata only.',
    ],
    next_steps: [
      'Validate churn model parity between Teradata and Snowflake for March cutover.',
    ],
    participants_internal: ['Carlos Rodriguez', 'Ingrid Larsson'],
    participants_external: [
      'Melissa Grant — VP, Contact Center Operations',
      'Brian McAllister — VP Network Planning',
    ],
  },
  {
    call_id: 'gong-carlos-tel-4',
    account_id: 'acc-carlos-tel',
    call_date: '2026-03-06T14:30:00.000Z',
    duration_minutes: 34,
    summary:
      'Churn model parity tests passed within agreed tolerance; first Teradata mart retired in non-prod. Speech analytics pilot flagged GPU cost concerns—evaluating batch vs streaming transcription tradeoffs.',
    topics: ['Teradata migration', 'churn modeling', 'speech analytics'],
    action_items: [
      '[DONE] Ingrid to optimize batch transcription schedule for off-peak GPU use.',
      'Atlas finance to approve pilot GPU budget through Q2.',
    ],
    next_steps: [
      'Production Teradata cutover for subscriber mart on March 22.',
    ],
    participants_internal: ['Carlos Rodriguez', 'Ingrid Larsson'],
    participants_external: [
      'Derek Wu — Director, Data Platforms',
      'Sofia Renard — Head of Customer Intelligence',
    ],
  },
  {
    call_id: 'gong-carlos-tel-5',
    account_id: 'acc-carlos-tel',
    call_date: '2026-03-27T16:30:00.000Z',
    duration_minutes: 27,
    summary:
      'Subscriber mart successfully live on Snowflake with no P1 incidents; network capacity dashboards adopted by regional planners. Speech analytics pilot expanded to two languages with positive QA scores.',
    topics: ['speech analytics', 'network capacity', 'Teradata migration'],
    action_items: [
      'Ingrid to document lessons learned for remaining Teradata marts.',
      'Carlos to schedule Q2 roadmap session covering 5G small-cell forecasting.',
    ],
    next_steps: [
      'Begin mart two migration after Easter change freeze.',
    ],
    participants_internal: ['Carlos Rodriguez', 'Ingrid Larsson'],
    participants_external: [
      'Brian McAllister — VP Network Planning',
      'Melissa Grant — VP, Contact Center Operations',
      'Derek Wu — Director, Data Platforms',
    ],
  },
]

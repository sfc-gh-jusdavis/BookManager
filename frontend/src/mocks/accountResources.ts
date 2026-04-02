import type { AccountResource } from '../types'

export const MOCK_ACCOUNT_RESOURCES: AccountResource[] = [
  // acc-jane-fs (Summit Trust Bank)
  {
    resource_id: 'res-jane-fs-1',
    account_id: 'acc-jane-fs',
    resource_type: 'note',
    title: 'Weekly sync notes 3/15',
    content:
      'Weekly sync notes 3/15 — Discussed Kafka pipeline stability. Priya flagged vendor security review as potential blocker. Action: follow up with procurement by 3/20.',
    link_type: null,
    created_by: 'Jane Smith',
    created_at: '2026-03-15T16:30:00.000Z',
  },
  {
    resource_id: 'res-jane-fs-2',
    account_id: 'acc-jane-fs',
    resource_type: 'link',
    title: 'Summit Trust - Activation Docs',
    content: 'https://drive.google.com/drive/folders/example-summit-trust',
    link_type: 'google_drive',
    created_by: 'Jane Smith',
    created_at: '2026-02-04T10:00:00.000Z',
  },
  {
    resource_id: 'res-jane-fs-3',
    account_id: 'acc-jane-fs',
    resource_type: 'link',
    title: 'Summit Trust Architecture Decision Records',
    content: 'https://confluence.internal/spaces/ACT/pages/summit-trust-adr',
    link_type: 'confluence',
    created_by: 'Jane Smith',
    created_at: '2026-02-11T14:15:00.000Z',
  },

  // acc-jane-hc (AuroraCare Health Network)
  {
    resource_id: 'res-jane-hc-1',
    account_id: 'acc-jane-hc',
    resource_type: 'note',
    title: 'BAA amendment tracking',
    content:
      'BAA amendment tracking — Legal team confirmed secondary PHI region requires separate BAA. Expected resolution by mid-April. Contact: Sarah Chen (legal@auroracare.com)',
    link_type: null,
    created_by: 'Jane Smith',
    created_at: '2026-03-22T09:45:00.000Z',
  },
  {
    resource_id: 'res-jane-hc-2',
    account_id: 'acc-jane-hc',
    resource_type: 'link',
    title: 'RE: AuroraCare BAA Amendment Status',
    content: 'mailto:thread-auroracare-baa@company.com',
    link_type: 'email',
    created_by: 'Jane Smith',
    created_at: '2026-02-19T11:20:00.000Z',
  },

  // acc-jane-ret (Cartograph Retail Group)
  {
    resource_id: 'res-jane-ret-1',
    account_id: 'acc-jane-ret',
    resource_type: 'note',
    title: 'Merchandising team reorg',
    content:
      'Merchandising team reorg — VP of Merch (Tom Blake) replaced by Lisa Park effective 3/10. Need to schedule intro call and re-align on KPIs.',
    link_type: null,
    created_by: 'Jane Smith',
    created_at: '2026-03-12T13:00:00.000Z',
  },
  {
    resource_id: 'res-jane-ret-2',
    account_id: 'acc-jane-ret',
    resource_type: 'link',
    title: 'Cartograph Retail - POS Integration Specs',
    content: 'https://drive.google.com/drive/folders/example-cartograph',
    link_type: 'google_drive',
    created_by: 'Jane Smith',
    created_at: '2026-02-07T08:30:00.000Z',
  },
  {
    resource_id: 'res-jane-ret-3',
    account_id: 'acc-jane-ret',
    resource_type: 'link',
    title: '#cartograph-activation',
    content: 'https://company.slack.com/channels/cartograph-activation',
    link_type: 'slack',
    created_by: 'Jane Smith',
    created_at: '2026-02-21T15:40:00.000Z',
  },

  // acc-jane-tech (Lattice Analytics)
  {
    resource_id: 'res-jane-tech-1',
    account_id: 'acc-jane-tech',
    resource_type: 'note',
    title: 'Go-live retrospective notes',
    content:
      'Go-live retrospective notes — Went live 3/12. Key learnings: Streams costs 40% higher than projected. Recommend auto-suspend policies for similar future deployments.',
    link_type: null,
    created_by: 'Jane Smith',
    created_at: '2026-03-14T17:00:00.000Z',
  },
  {
    resource_id: 'res-jane-tech-2',
    account_id: 'acc-jane-tech',
    resource_type: 'link',
    title: 'Lattice Analytics - Go Live Runbook',
    content: 'https://confluence.internal/spaces/ACT/pages/lattice-go-live',
    link_type: 'confluence',
    created_by: 'Jane Smith',
    created_at: '2026-02-28T12:00:00.000Z',
  },

  // acc-carlos-media (Horizon Broadcast Group)
  {
    resource_id: 'res-carlos-media-1',
    account_id: 'acc-carlos-media',
    resource_type: 'note',
    title: 'Cortex AI evaluation',
    content:
      'Cortex AI evaluation — Content tagging POC showing 78% accuracy on first-party content. Need 85%+ before production. Evaluating fine-tuning options.',
    link_type: null,
    created_by: 'Carlos Rodriguez',
    created_at: '2026-03-25T10:15:00.000Z',
  },
  {
    resource_id: 'res-carlos-media-2',
    account_id: 'acc-carlos-media',
    resource_type: 'link',
    title: 'Horizon Broadcast - Content Taxonomy',
    content: 'https://drive.google.com/drive/folders/example-horizon',
    link_type: 'google_drive',
    created_by: 'Carlos Rodriguez',
    created_at: '2026-02-14T09:00:00.000Z',
  },

  // acc-carlos-mfg (Titan Industrial IoT)
  {
    resource_id: 'res-carlos-mfg-1',
    account_id: 'acc-carlos-mfg',
    resource_type: 'note',
    title: 'OT network access',
    content:
      'OT network access — IT security team (contact: Dave Mueller, dave.m@titan-iot.com) requires VPN access form + security assessment before opening firewall ports for sensor data ingestion.',
    link_type: null,
    created_by: 'Carlos Rodriguez',
    created_at: '2026-03-18T14:22:00.000Z',
  },
  {
    resource_id: 'res-carlos-mfg-2',
    account_id: 'acc-carlos-mfg',
    resource_type: 'link',
    title: 'RE: Titan IoT Firewall Change Request',
    content: 'mailto:thread-titan-firewall@company.com',
    link_type: 'email',
    created_by: 'Carlos Rodriguez',
    created_at: '2026-02-26T16:05:00.000Z',
  },
  {
    resource_id: 'res-carlos-mfg-3',
    account_id: 'acc-carlos-mfg',
    resource_type: 'link',
    title: 'Titan IoT - Sensor Data Schema',
    content: 'https://confluence.internal/spaces/ACT/pages/titan-sensor-schema',
    link_type: 'confluence',
    created_by: 'Carlos Rodriguez',
    created_at: '2026-03-02T11:30:00.000Z',
  },

  // acc-carlos-ins (Sentinel Mutual Insurance)
  {
    resource_id: 'res-carlos-ins-1',
    account_id: 'acc-carlos-ins',
    resource_type: 'note',
    title: 'Actuarial governance process',
    content:
      'Actuarial governance process — Model risk committee meets quarterly (next: April 15). Need to submit model documentation package by April 1 for review.',
    link_type: null,
    created_by: 'Carlos Rodriguez',
    created_at: '2026-03-27T08:50:00.000Z',
  },
  {
    resource_id: 'res-carlos-ins-2',
    account_id: 'acc-carlos-ins',
    resource_type: 'link',
    title: 'Sentinel Mutual - Model Documentation',
    content: 'https://drive.google.com/drive/folders/example-sentinel',
    link_type: 'google_drive',
    created_by: 'Carlos Rodriguez',
    created_at: '2026-02-18T13:45:00.000Z',
  },

  // acc-carlos-tel (Atlas Communications)
  {
    resource_id: 'res-carlos-tel-1',
    account_id: 'acc-carlos-tel',
    resource_type: 'note',
    title: 'Teradata migration status',
    content:
      'Teradata migration status — 85% feature parity achieved. Remaining 15% involves complex stored procedures for billing reconciliation. April sprint focused on these.',
    link_type: null,
    created_by: 'Carlos Rodriguez',
    created_at: '2026-03-28T15:10:00.000Z',
  },
  {
    resource_id: 'res-carlos-tel-2',
    account_id: 'acc-carlos-tel',
    resource_type: 'link',
    title: 'Atlas Comms - Migration Tracker',
    content: 'https://confluence.internal/spaces/ACT/pages/atlas-migration',
    link_type: 'confluence',
    created_by: 'Carlos Rodriguez',
    created_at: '2026-02-09T10:00:00.000Z',
  },
  {
    resource_id: 'res-carlos-tel-3',
    account_id: 'acc-carlos-tel',
    resource_type: 'link',
    title: '#atlas-activation',
    content: 'https://company.slack.com/channels/atlas-activation',
    link_type: 'slack',
    created_by: 'Carlos Rodriguez',
    created_at: '2026-03-05T09:25:00.000Z',
  },
]

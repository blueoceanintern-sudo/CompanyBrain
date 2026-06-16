// Realistic mock data for the Equest School Network pilot.
// All pages consume this until the API is running.

export const MOCK_ORG_ID = 'org-equest-001'
export const MOCK_USER_ID = 'user-admin-001'

export const MOCK_USER = {
  id: MOCK_USER_ID,
  email: 'admin@equest.edu.au',
  role: 'org_admin',
  orgId: MOCK_ORG_ID,
}

export const MOCK_COMPARTMENTS = [
  { id: 'comp-001', orgId: MOCK_ORG_ID, name: 'Human Resources', description: 'HR policies and procedures', mode: 'autonomous', createdAt: '2026-01-10T09:00:00Z', updatedAt: '2026-01-10T09:00:00Z' },
  { id: 'comp-002', orgId: MOCK_ORG_ID, name: 'Curriculum & Teaching', description: 'Teaching standards and curriculum guides', mode: 'autonomous', createdAt: '2026-01-10T09:00:00Z', updatedAt: '2026-01-10T09:00:00Z' },
  { id: 'comp-003', orgId: MOCK_ORG_ID, name: 'Compliance & Legal', description: 'Regulatory and compliance documentation', mode: 'schema_driven', createdAt: '2026-01-10T09:00:00Z', updatedAt: '2026-01-10T09:00:00Z' },
  { id: 'comp-004', orgId: MOCK_ORG_ID, name: 'IT & Systems', description: 'Technology policies and system guides', mode: 'autonomous', createdAt: '2026-02-01T09:00:00Z', updatedAt: '2026-02-01T09:00:00Z' },
]

export const MOCK_DOCUMENTS = [
  {
    id: 'doc-001',
    orgId: MOCK_ORG_ID,
    compartmentId: 'comp-001',
    filename: 'Staff Leave Policy 2026.pdf',
    accessTier: 'internal',
    sourceType: 'hr_policy',
    contentHash: 'abc123',
    status: 'complete',
    uploadedBy: MOCK_USER_ID,
    version: 1,
    previousVersionId: null,
    createdAt: '2026-01-15T10:30:00Z',
    updatedAt: '2026-01-15T10:35:00Z',
  },
  {
    id: 'doc-002',
    orgId: MOCK_ORG_ID,
    compartmentId: 'comp-001',
    filename: 'Onboarding SOP v3.docx',
    accessTier: 'internal',
    sourceType: 'sop',
    contentHash: 'def456',
    status: 'complete',
    uploadedBy: MOCK_USER_ID,
    version: 3,
    previousVersionId: 'doc-002-v2',
    createdAt: '2026-02-20T14:00:00Z',
    updatedAt: '2026-02-20T14:10:00Z',
  },
  {
    id: 'doc-003',
    orgId: MOCK_ORG_ID,
    compartmentId: 'comp-003',
    filename: 'Privacy Act Compliance Guide.pdf',
    accessTier: 'internal',
    sourceType: 'compliance',
    contentHash: 'ghi789',
    status: 'complete',
    uploadedBy: MOCK_USER_ID,
    version: 1,
    previousVersionId: null,
    createdAt: '2026-02-28T11:00:00Z',
    updatedAt: '2026-02-28T11:08:00Z',
  },
  {
    id: 'doc-004',
    orgId: MOCK_ORG_ID,
    compartmentId: 'comp-002',
    filename: 'Year 7-10 Curriculum Framework.pdf',
    accessTier: 'internal',
    sourceType: 'product_doc',
    contentHash: 'jkl012',
    status: 'complete',
    uploadedBy: MOCK_USER_ID,
    version: 1,
    previousVersionId: null,
    createdAt: '2026-03-05T09:15:00Z',
    updatedAt: '2026-03-05T09:22:00Z',
  },
  {
    id: 'doc-005',
    orgId: MOCK_ORG_ID,
    compartmentId: 'comp-001',
    filename: 'Performance Review FAQ.pdf',
    accessTier: 'internal',
    sourceType: 'faq',
    contentHash: 'mno345',
    status: 'running',
    uploadedBy: MOCK_USER_ID,
    version: 1,
    previousVersionId: null,
    createdAt: '2026-05-19T08:45:00Z',
    updatedAt: '2026-05-19T08:45:00Z',
  },
  {
    id: 'doc-006',
    orgId: MOCK_ORG_ID,
    compartmentId: 'comp-003',
    filename: 'Working with Children Policy.pdf',
    accessTier: 'external',
    sourceType: 'compliance',
    contentHash: 'pqr678',
    status: 'complete',
    uploadedBy: MOCK_USER_ID,
    version: 2,
    previousVersionId: 'doc-006-v1',
    createdAt: '2026-03-18T13:30:00Z',
    updatedAt: '2026-03-18T13:38:00Z',
  },
  {
    id: 'doc-007',
    orgId: MOCK_ORG_ID,
    compartmentId: 'comp-004',
    filename: 'BYOD Acceptable Use Policy.pdf',
    accessTier: 'internal',
    sourceType: 'hr_policy',
    contentHash: 'stu901',
    status: 'failed',
    uploadedBy: MOCK_USER_ID,
    version: 1,
    previousVersionId: null,
    createdAt: '2026-04-02T16:00:00Z',
    updatedAt: '2026-04-02T16:01:00Z',
  },
]

export const MOCK_QUERIES = [
  {
    id: 'q-001',
    orgId: MOCK_ORG_ID,
    userId: MOCK_USER_ID,
    queryText: 'How many days of personal leave are staff entitled to per year?',
    answer: 'According to the Staff Leave Policy 2026 [1], all permanent staff are entitled to 10 days of personal/carer\'s leave per year. Casual staff accrue personal leave at a rate of 1/26th of ordinary hours worked [1].',
    citations: [{ index: 1, chunkId: 'chunk-001', documentId: 'doc-001', filename: 'Staff Leave Policy 2026.pdf', compartment: 'Human Resources', excerpt: 'Permanent employees are entitled to 10 days personal/carer\'s leave per calendar year...' }],
    confidence: 0.89,
    missing: [],
    accessTier: 'internal',
    createdAt: '2026-05-18T09:12:00Z',
  },
  {
    id: 'q-002',
    orgId: MOCK_ORG_ID,
    userId: MOCK_USER_ID,
    queryText: 'What is the process for reporting a child safety concern?',
    answer: 'The Working with Children Policy [1] outlines the mandatory reporting process. All staff must immediately report any reasonable belief of child abuse or neglect to the designated Child Safety Officer and, where the child is in immediate danger, contact emergency services (000) first [1].',
    citations: [{ index: 1, chunkId: 'chunk-002', documentId: 'doc-006', filename: 'Working with Children Policy.pdf', compartment: 'Compliance & Legal', excerpt: 'Mandatory reporting obligations apply to all registered teachers and support staff...' }],
    confidence: 0.92,
    missing: [],
    accessTier: 'internal',
    createdAt: '2026-05-18T10:45:00Z',
  },
  {
    id: 'q-003',
    orgId: MOCK_ORG_ID,
    userId: MOCK_USER_ID,
    queryText: 'What software licenses do we have for student devices?',
    answer: "I don't know — this question is not in the knowledge base.",
    citations: [],
    confidence: 0.31,
    missing: ['Software license inventory for student devices'],
    accessTier: 'internal',
    createdAt: '2026-05-18T14:20:00Z',
  },
  {
    id: 'q-004',
    orgId: MOCK_ORG_ID,
    userId: MOCK_USER_ID,
    queryText: 'What are the steps in the new staff onboarding process?',
    answer: 'The Onboarding SOP v3 [1] outlines a 5-step process: (1) Pre-start documentation collection, (2) IT access provisioning on Day 1, (3) Induction session with HR on Day 1, (4) Department orientation with line manager during Week 1, and (5) 30-day check-in with HR Business Partner [1].',
    citations: [{ index: 1, chunkId: 'chunk-003', documentId: 'doc-002', filename: 'Onboarding SOP v3.docx', compartment: 'Human Resources', excerpt: 'The onboarding process consists of five distinct phases designed to integrate new staff effectively...' }],
    confidence: 0.85,
    missing: [],
    accessTier: 'internal',
    createdAt: '2026-05-19T08:05:00Z',
  },
]

export const MOCK_USERS = [
  { id: MOCK_USER_ID, orgId: MOCK_ORG_ID, email: 'admin@equest.edu.au', role: 'org_admin', createdAt: '2026-01-08T09:00:00Z' },
  { id: 'user-002', orgId: MOCK_ORG_ID, email: 'principal@equest.edu.au', role: 'org_admin', createdAt: '2026-01-08T09:00:00Z' },
  { id: 'user-003', orgId: MOCK_ORG_ID, email: 'hr.manager@equest.edu.au', role: 'dept_admin', createdAt: '2026-01-10T10:00:00Z' },
  { id: 'user-004', orgId: MOCK_ORG_ID, email: 'j.smith@equest.edu.au', role: 'staff', createdAt: '2026-02-01T08:30:00Z' },
  { id: 'user-005', orgId: MOCK_ORG_ID, email: 'm.chen@equest.edu.au', role: 'staff', createdAt: '2026-02-01T08:30:00Z' },
  { id: 'user-006', orgId: MOCK_ORG_ID, email: 'compliance@dept.edu.au', role: 'external_client', createdAt: '2026-03-15T11:00:00Z' },
]

export const MOCK_AUDIT_LOGS = [
  { id: 'al-001', orgId: MOCK_ORG_ID, userId: MOCK_USER_ID, action: 'document.upload', resourceType: 'document', resourceId: 'doc-001', metadata: { filename: 'Staff Leave Policy 2026.pdf' }, createdAt: '2026-01-15T10:35:00Z' },
  { id: 'al-002', orgId: MOCK_ORG_ID, userId: MOCK_USER_ID, action: 'user.invite', resourceType: 'user', resourceId: 'user-003', metadata: { email: 'hr.manager@equest.edu.au', role: 'dept_admin' }, createdAt: '2026-01-10T10:05:00Z' },
  { id: 'al-003', orgId: MOCK_ORG_ID, userId: MOCK_USER_ID, action: 'document.upload', resourceType: 'document', resourceId: 'doc-002', metadata: { filename: 'Onboarding SOP v3.docx' }, createdAt: '2026-02-20T14:10:00Z' },
  { id: 'al-004', orgId: MOCK_ORG_ID, userId: MOCK_USER_ID, action: 'compartment.create', resourceType: 'compartment', resourceId: 'comp-004', metadata: { name: 'IT & Systems' }, createdAt: '2026-02-01T09:02:00Z' },
  { id: 'al-005', orgId: MOCK_ORG_ID, userId: 'user-003', action: 'document.upload', resourceType: 'document', resourceId: 'doc-003', metadata: { filename: 'Privacy Act Compliance Guide.pdf' }, createdAt: '2026-02-28T11:08:00Z' },
  { id: 'al-006', orgId: MOCK_ORG_ID, userId: MOCK_USER_ID, action: 'user.role_update', resourceType: 'user', resourceId: 'user-004', metadata: { newRole: 'staff' }, createdAt: '2026-02-01T09:15:00Z' },
  { id: 'al-007', orgId: MOCK_ORG_ID, userId: MOCK_USER_ID, action: 'document.upload', resourceType: 'document', resourceId: 'doc-006', metadata: { filename: 'Working with Children Policy.pdf' }, createdAt: '2026-03-18T13:38:00Z' },
  { id: 'al-008', orgId: MOCK_ORG_ID, userId: MOCK_USER_ID, action: 'document.archive', resourceType: 'document', resourceId: 'doc-007', metadata: { filename: 'BYOD Acceptable Use Policy.pdf' }, createdAt: '2026-04-02T16:01:00Z' },
]

export const MOCK_ANALYTICS_OVERVIEW = {
  kbCoverage: 74,
  queryVolume: 48,
  citationHitRate: 88,
  iDontKnowRate: 26,
}

export const MOCK_TOP_UNANSWERED = [
  { queryText: 'What software licenses do we have for student devices?', count: 7, lastAsked: '2026-05-18T14:20:00Z' },
  { queryText: 'How do I apply for parental leave?', count: 5, lastAsked: '2026-05-17T11:30:00Z' },
  { queryText: 'What is the process for booking relief teachers?', count: 4, lastAsked: '2026-05-16T09:45:00Z' },
  { queryText: 'Can students use personal phones in class?', count: 3, lastAsked: '2026-05-15T14:00:00Z' },
  { queryText: 'What are the CPD hour requirements per year?', count: 3, lastAsked: '2026-05-14T10:20:00Z' },
]

export const MOCK_SUBSCRIPTION = {
  plan: 'paid' as const,
  subscriptionId: 'sub_mock_equest_001',
  status: 'active',
}

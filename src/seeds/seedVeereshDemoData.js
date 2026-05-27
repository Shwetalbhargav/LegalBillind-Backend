import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import {
  Activity,
  Admin,
  AssociateProfile,
  Billable,
  Case,
  CaseAssignment,
  Client,
  EmailEntry,
  Firm,
  InternProfile,
  Invoice,
  InvoiceLine,
  KpiSnapshot,
  LawyerProfile,
  PartnerProfile,
  Payment,
  RateCard,
  TimeEntry,
  User,
} from '../models/index.js';

dotenv.config();

const DEMO_PASSWORD = 'test@123';
const DEMO_FIRM_NAME = 'Harmon & Associates';
const DEMO_SOURCE_PREFIX = 'veeresh-demo';

const d = (value) => new Date(`${value}T00:00:00.000Z`);
const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;
const hoursFor = (minutes) => Number(minutes || 0) / 60;
const sourceRef = (...parts) => [DEMO_SOURCE_PREFIX, ...parts].join(':');

const firmPayload = {
  name: DEMO_FIRM_NAME,
  currency: 'INR',
  taxSettings: {
    taxName: 'GST',
    taxRatePct: 18,
    inclusive: false,
  },
  address: {
    line1: '14 Barakhamba Road',
    line2: 'Connaught Place',
    city: 'New Delhi',
    state: 'Delhi',
    postalCode: '110001',
    country: 'IN',
  },
  billingPreferences: {
    defaultRate: 2500,
    autoSync: false,
  },
};

const userDefinitions = [
  {
    key: 'rekha',
    name: 'Rekha Nair',
    email: 'rekha@harmonassociates.in',
    mobile: '9810000001',
    role: 'admin',
    address: 'New Delhi',
  },
  {
    key: 'arvind',
    name: 'Arvind Harmon',
    email: 'arvind@harmonassociates.in',
    mobile: '9810000002',
    role: 'partner',
    billingRate: 4000,
    profile: {
      title: 'Managing Partner',
      specialization: ['Corporate', 'M&A'],
      experienceYears: 22,
    },
  },
  {
    key: 'priya',
    name: 'Priya Mehta',
    email: 'priya@harmonassociates.in',
    mobile: '9810000003',
    role: 'partner',
    billingRate: 3800,
    profile: {
      title: 'Senior Partner',
      specialization: ['Intellectual Property', 'Technology Law'],
      experienceYears: 18,
    },
  },
  {
    key: 'karan',
    name: 'Karan Sethi',
    email: 'karan@harmonassociates.in',
    mobile: '9810000004',
    role: 'lawyer',
    billingRate: 2500,
    profile: {
      specialization: ['Litigation', 'Arbitration'],
      experienceYears: 6,
    },
  },
  {
    key: 'ananya',
    name: 'Ananya Rao',
    email: 'ananya@harmonassociates.in',
    mobile: '9810000005',
    role: 'lawyer',
    billingRate: 2500,
    profile: {
      specialization: ['Corporate', 'Contracts'],
      experienceYears: 5,
    },
  },
  {
    key: 'rohit',
    name: 'Rohit Bhatt',
    email: 'rohit@harmonassociates.in',
    mobile: '9810000006',
    role: 'associate',
    billingRate: 1500,
    profile: {
      specialization: ['Research', 'Drafting'],
      experienceYears: 2,
    },
  },
  {
    key: 'sneha',
    name: 'Sneha Pillai',
    email: 'sneha@harmonassociates.in',
    mobile: '9810000007',
    role: 'intern',
    billingRate: 750,
    profile: {
      lawSchool: 'National Law School of India University',
      graduationYear: 2026,
      internshipFocus: 'Research and drafting',
      mentorKey: 'ananya',
    },
  },
];

const clientDefinitions = [
  {
    key: 'greenfield',
    displayName: 'Greenfield Developers Pvt. Ltd.',
    email: 'accounts@greenfielddevelopers.in',
    phone: '+91-11-41234567',
    status: 'active',
    paymentTerms: 'NET30',
    ownerKey: 'arvind',
    contacts: [
      {
        name: 'Mahesh Iyer',
        email: 'mahesh.iyer@greenfielddevelopers.in',
        phone: '+91-9810000101',
        role: 'CFO',
      },
    ],
  },
  {
    key: 'tata',
    displayName: 'Tata Logistics Solutions',
    email: 'legal@tatalogistics.example',
    phone: '+91-22-61234567',
    status: 'active',
    paymentTerms: 'NET15',
    ownerKey: 'karan',
    contacts: [
      {
        name: 'Sameer Deshmukh',
        email: 'sameer.deshmukh@tatalogistics.example',
        phone: '+91-9820000102',
        role: 'Legal Manager',
      },
    ],
  },
  {
    key: 'novatech',
    displayName: 'NovaTech Innovations',
    email: 'finance@novatech.example',
    phone: '+91-80-71234567',
    status: 'active',
    paymentTerms: 'NET30',
    ownerKey: 'ananya',
    contacts: [
      {
        name: 'Isha Menon',
        email: 'isha.menon@novatech.example',
        phone: '+91-9830000103',
        role: 'Finance Lead',
      },
    ],
  },
  {
    key: 'rajan',
    displayName: 'Rajan Kapoor (Individual)',
    email: 'rajan.kapoor@example.com',
    phone: '+91-9820000001',
    status: 'active',
    paymentTerms: 'NET30',
    ownerKey: 'priya',
    contacts: [
      {
        name: 'Rajan Kapoor',
        email: 'rajan.kapoor@example.com',
        phone: '+91-9820000001',
        role: 'Client',
      },
    ],
  },
  {
    key: 'atlas',
    displayName: 'Atlas Finserve Pvt. Ltd.',
    email: 'compliance@atlasfinserve.example',
    phone: '+91-22-49876543',
    status: 'active',
    paymentTerms: 'NET30',
    ownerKey: 'priya',
    contacts: [
      {
        name: 'Devika Shah',
        email: 'devika.shah@atlasfinserve.example',
        phone: '+91-9820000104',
        role: 'Chief Compliance Officer',
      },
    ],
  },
  {
    key: 'mednova',
    displayName: 'MedNova Diagnostics LLP',
    email: 'legal@mednova.example',
    phone: '+91-80-67676767',
    status: 'active',
    paymentTerms: 'NET45',
    ownerKey: 'ananya',
    contacts: [
      {
        name: 'Rhea Kulkarni',
        email: 'rhea.kulkarni@mednova.example',
        phone: '+91-9840000105',
        role: 'Operations Head',
      },
    ],
  },
  {
    key: 'sunrise',
    displayName: 'Sunrise Hospitality Group',
    email: 'contracts@sunrisehospitality.example',
    phone: '+91-11-45551212',
    status: 'prospect',
    paymentTerms: 'NET30',
    ownerKey: 'arvind',
    contacts: [
      {
        name: 'Kabir Arora',
        email: 'kabir.arora@sunrisehospitality.example',
        phone: '+91-9810000106',
        role: 'Director',
      },
    ],
  },
  {
    key: 'bluepeak',
    displayName: 'BluePeak Energy Pvt. Ltd.',
    email: 'projects@bluepeakenergy.example',
    phone: '+91-40-71230000',
    status: 'active',
    paymentTerms: 'NET60',
    ownerKey: 'karan',
    contacts: [
      {
        name: 'Mehul Reddy',
        email: 'mehul.reddy@bluepeakenergy.example',
        phone: '+91-9850000107',
        role: 'Project Lead',
      },
    ],
  },
  {
    key: 'urbanleaf',
    displayName: 'UrbanLeaf Retail LLP',
    email: 'founders@urbanleaf.example',
    phone: '+91-79-66554433',
    status: 'inactive',
    paymentTerms: 'NET15',
    ownerKey: 'priya',
    contacts: [
      {
        name: 'Nikhil Shah',
        email: 'nikhil.shah@urbanleaf.example',
        phone: '+91-9860000108',
        role: 'Co-founder',
      },
    ],
  },
];

const caseDefinitions = [
  {
    key: 'greenfield-property',
    clientKey: 'greenfield',
    title: 'Greenfield - DLF Phase V Commercial Plot Acquisition',
    description: 'Due diligence, title verification, and sale deed drafting for 2.4-acre commercial plot.',
    status: 'open',
    billingType: 'hourly',
    case_type: 'Real Estate',
    leadPartnerKey: 'arvind',
    managingLawyerKey: 'ananya',
    assignedUserKeys: ['arvind', 'ananya', 'rohit'],
    openedAt: '2025-03-01',
  },
  {
    key: 'tata-arbitration',
    clientKey: 'tata',
    title: 'Tata Logistics vs. Freight Masters - Arbitration Dispute',
    description: 'Breach of logistics services agreement; arbitration under ICADR rules.',
    status: 'open',
    billingType: 'hourly',
    case_type: 'Litigation / Arbitration',
    leadPartnerKey: 'arvind',
    managingLawyerKey: 'karan',
    assignedUserKeys: ['arvind', 'karan', 'sneha'],
    openedAt: '2025-06-01',
  },
  {
    key: 'novatech-ip',
    clientKey: 'novatech',
    title: 'NovaTech - Patent & Trademark Portfolio Registration',
    description: 'Filing and prosecution of 3 utility patents and 2 trademarks for AI-powered logistics platform.',
    status: 'open',
    billingType: 'fixed_fee',
    case_type: 'Intellectual Property',
    leadPartnerKey: 'priya',
    managingLawyerKey: 'ananya',
    assignedUserKeys: ['priya', 'ananya', 'rohit'],
    openedAt: '2025-09-01',
  },
  {
    key: 'novatech-saas',
    clientKey: 'novatech',
    title: 'NovaTech - Enterprise SaaS Master Services Agreement',
    description: 'Drafting and negotiating MSA and DPA with three enterprise clients.',
    status: 'open',
    billingType: 'hourly',
    case_type: 'Corporate / Contracts',
    leadPartnerKey: 'priya',
    managingLawyerKey: 'ananya',
    assignedUserKeys: ['priya', 'ananya'],
    openedAt: '2025-11-01',
  },
  {
    key: 'kapoor-divorce',
    clientKey: 'rajan',
    title: 'Kapoor v. Kapoor - Contested Divorce Proceedings',
    description: 'Contested divorce petition under Hindu Marriage Act 1955; child custody dispute.',
    status: 'closed',
    billingType: 'retainer',
    case_type: 'Family Law',
    leadPartnerKey: 'priya',
    managingLawyerKey: 'karan',
    assignedUserKeys: ['priya', 'karan'],
    openedAt: '2024-08-01',
    closedAt: '2025-07-31',
  },
  {
    key: 'greenfield-rera',
    clientKey: 'greenfield',
    title: 'Greenfield - RERA Registration & Compliance Advisory',
    description: 'RERA project registration, compliance review, and builder-buyer agreement templates.',
    status: 'open',
    billingType: 'hourly',
    case_type: 'Real Estate / Regulatory',
    leadPartnerKey: 'arvind',
    managingLawyerKey: 'karan',
    assignedUserKeys: ['arvind', 'karan'],
    openedAt: '2025-10-01',
  },
  {
    key: 'atlas-compliance',
    clientKey: 'atlas',
    title: 'Atlas Finserve - RBI Digital Lending Compliance Audit',
    description: 'Compliance review of digital lending flows, partner onboarding, and customer disclosure templates.',
    status: 'open',
    billingType: 'hourly',
    case_type: 'Banking / Compliance',
    leadPartnerKey: 'priya',
    managingLawyerKey: 'ananya',
    assignedUserKeys: ['priya', 'ananya', 'rohit'],
    openedAt: '2025-02-10',
  },
  {
    key: 'atlas-debt-recovery',
    clientKey: 'atlas',
    title: 'Atlas Finserve - SME Portfolio Debt Recovery Notices',
    description: 'Demand notices and negotiated settlements for delinquent SME loan accounts.',
    status: 'closed',
    billingType: 'hourly',
    case_type: 'Debt Recovery',
    leadPartnerKey: 'priya',
    managingLawyerKey: 'karan',
    assignedUserKeys: ['priya', 'karan', 'sneha'],
    openedAt: '2024-11-01',
    closedAt: '2025-03-20',
  },
  {
    key: 'mednova-employment',
    clientKey: 'mednova',
    title: 'MedNova - Senior Scientist Employment Separation',
    description: 'Advisory on exit terms, confidentiality obligations, and non-solicit restrictions.',
    status: 'pending',
    billingType: 'hourly',
    case_type: 'Employment',
    leadPartnerKey: 'priya',
    managingLawyerKey: 'ananya',
    assignedUserKeys: ['priya', 'ananya'],
    openedAt: '2026-01-05',
  },
  {
    key: 'mednova-dpa',
    clientKey: 'mednova',
    title: 'MedNova - Hospital Network Data Processing Agreement',
    description: 'Drafting DPA, data security schedule, and health data transfer addendum.',
    status: 'open',
    billingType: 'hourly',
    case_type: 'Healthcare / Data Privacy',
    leadPartnerKey: 'priya',
    managingLawyerKey: 'ananya',
    assignedUserKeys: ['priya', 'ananya', 'rohit'],
    openedAt: '2025-08-01',
  },
  {
    key: 'sunrise-hotel-lease',
    clientKey: 'sunrise',
    title: 'Sunrise Hospitality - Goa Resort Lease Negotiation',
    description: 'Lease term sheet, risk allocation, and stamp duty advisory for proposed resort property.',
    status: 'pending',
    billingType: 'hourly',
    case_type: 'Real Estate / Hospitality',
    leadPartnerKey: 'arvind',
    managingLawyerKey: 'ananya',
    assignedUserKeys: ['arvind', 'ananya'],
    openedAt: '2026-02-15',
  },
  {
    key: 'sunrise-food-license',
    clientKey: 'sunrise',
    title: 'Sunrise Hospitality - FSSAI License Renewal Advisory',
    description: 'Food safety license renewal advisory for three hotel kitchens.',
    status: 'archived',
    billingType: 'fixed_fee',
    case_type: 'Regulatory',
    leadPartnerKey: 'arvind',
    managingLawyerKey: 'karan',
    assignedUserKeys: ['arvind', 'karan'],
    openedAt: '2024-05-01',
    closedAt: '2024-06-20',
  },
  {
    key: 'bluepeak-land',
    clientKey: 'bluepeak',
    title: 'BluePeak Energy - Solar Park Land Acquisition',
    description: 'Land aggregation, title review, and lease documentation for 120 MW solar park.',
    status: 'open',
    billingType: 'hourly',
    case_type: 'Energy / Land',
    leadPartnerKey: 'arvind',
    managingLawyerKey: 'karan',
    assignedUserKeys: ['arvind', 'karan', 'rohit'],
    openedAt: '2025-12-01',
  },
  {
    key: 'bluepeak-showcause',
    clientKey: 'bluepeak',
    title: 'BluePeak Energy - Environmental Show Cause Response',
    description: 'Response to state pollution control board notice and corrective action plan.',
    status: 'pending',
    billingType: 'hourly',
    case_type: 'Environmental Regulatory',
    leadPartnerKey: 'arvind',
    managingLawyerKey: 'karan',
    assignedUserKeys: ['arvind', 'karan', 'sneha'],
    openedAt: '2026-03-10',
  },
  {
    key: 'urbanleaf-dispute',
    clientKey: 'urbanleaf',
    title: 'UrbanLeaf Retail - Founder Shareholder Dispute',
    description: 'Settlement discussions and board process advice for founder exit dispute.',
    status: 'closed',
    billingType: 'hourly',
    case_type: 'Corporate Dispute',
    leadPartnerKey: 'priya',
    managingLawyerKey: 'karan',
    assignedUserKeys: ['priya', 'karan'],
    openedAt: '2024-09-01',
    closedAt: '2025-01-31',
  },
  {
    key: 'urbanleaf-vendor-contracts',
    clientKey: 'urbanleaf',
    title: 'UrbanLeaf Retail - Vendor Contract Refresh',
    description: 'Template refresh for supplier master terms and logistics vendor addendum.',
    status: 'archived',
    billingType: 'hourly',
    case_type: 'Commercial Contracts',
    leadPartnerKey: 'priya',
    managingLawyerKey: 'ananya',
    assignedUserKeys: ['priya', 'ananya', 'rohit'],
    openedAt: '2024-03-01',
    closedAt: '2024-08-15',
  },
  {
    key: 'rajan-estate',
    clientKey: 'rajan',
    title: 'Rajan Kapoor - Estate Planning and Will Drafting',
    description: 'Will, family settlement note, and succession planning for personal assets.',
    status: 'open',
    billingType: 'retainer',
    case_type: 'Estate Planning',
    leadPartnerKey: 'priya',
    managingLawyerKey: 'ananya',
    assignedUserKeys: ['priya', 'ananya'],
    openedAt: '2026-04-01',
  },
  {
    key: 'tata-labour-notice',
    clientKey: 'tata',
    title: 'Tata Logistics - Warehouse Labour Notice Response',
    description: 'Response to labour department notice regarding contractor wage compliance.',
    status: 'closed',
    billingType: 'hourly',
    case_type: 'Employment / Compliance',
    leadPartnerKey: 'arvind',
    managingLawyerKey: 'karan',
    assignedUserKeys: ['arvind', 'karan', 'sneha'],
    openedAt: '2025-04-10',
    closedAt: '2025-05-25',
  },
];

const rateCardDefinitions = [
  { userKey: 'arvind', ratePerHour: 4000, effectiveFrom: '2025-01-01' },
  { userKey: 'priya', ratePerHour: 3800, effectiveFrom: '2025-01-01' },
  { userKey: 'karan', ratePerHour: 2500, effectiveFrom: '2025-01-01' },
  { userKey: 'ananya', ratePerHour: 2500, effectiveFrom: '2025-01-01' },
  { userKey: 'rohit', ratePerHour: 1500, effectiveFrom: '2025-01-01' },
  { userKey: 'sneha', ratePerHour: 750, effectiveFrom: '2025-01-01' },
  {
    userKey: 'karan',
    caseKey: 'tata-arbitration',
    activityCode: 'RESEARCH',
    ratePerHour: 3000,
    effectiveFrom: '2025-06-01',
  },
  {
    userKey: 'ananya',
    caseKey: 'novatech-ip',
    ratePerHour: 3200,
    effectiveFrom: '2025-09-01',
  },
  {
    userKey: 'priya',
    caseKey: 'atlas-compliance',
    ratePerHour: 4200,
    effectiveFrom: '2025-02-10',
  },
  {
    userKey: 'ananya',
    caseKey: 'mednova-dpa',
    ratePerHour: 3000,
    effectiveFrom: '2025-08-01',
  },
  {
    userKey: 'arvind',
    caseKey: 'bluepeak-land',
    ratePerHour: 4500,
    effectiveFrom: '2025-12-01',
  },
  {
    userKey: 'karan',
    caseKey: 'bluepeak-showcause',
    activityCode: 'RESEARCH',
    ratePerHour: 3100,
    effectiveFrom: '2026-03-10',
  },
];

const activityCodeByType = {
  email: 'EMAIL',
  drafting: 'DOC_REVIEW',
  hearing: 'MEETING',
  meeting: 'MEETING',
  research: 'RESEARCH',
  review: 'DOC_REVIEW',
};

const categoryByType = {
  email: 'Email drafting/review',
  drafting: 'Contract drafting/review',
  hearing: 'Court appearance or hearing attendance',
  meeting: 'Client consultation (calls/meetings)',
  research: 'Legal research',
  review: 'Case preparation/documentation',
};

const workItemDefinitions = [
  {
    key: 'c1-title-search',
    invoiceKey: 'greenfield-property-paid',
    caseKey: 'greenfield-property',
    activityType: 'research',
    userKey: 'rohit',
    durationMinutes: 180,
    narrative: 'Title search and encumbrance certificate review for survey no. 114/2B',
    date: '2025-03-05',
    status: 'approved',
  },
  {
    key: 'c1-agreement-draft',
    invoiceKey: 'greenfield-property-paid',
    caseKey: 'greenfield-property',
    activityType: 'drafting',
    userKey: 'ananya',
    durationMinutes: 240,
    narrative: 'Drafting of agreement to sell and power of attorney',
    date: '2025-03-10',
    status: 'approved',
  },
  {
    key: 'c1-title-report-meeting',
    invoiceKey: 'greenfield-property-paid',
    caseKey: 'greenfield-property',
    activityType: 'meeting',
    userKey: 'arvind',
    durationMinutes: 90,
    narrative: 'Client meeting: review of title report and risk assessment',
    date: '2025-03-12',
    status: 'approved',
  },
  {
    key: 'c1-municipal-review',
    invoiceKey: 'greenfield-property-paid',
    caseKey: 'greenfield-property',
    activityType: 'review',
    userKey: 'ananya',
    durationMinutes: 120,
    narrative: 'Review of municipal approvals and zoning certificates',
    date: '2025-03-18',
    status: 'approved',
  },
  {
    key: 'c1-sale-deed',
    invoiceKey: 'greenfield-property-paid',
    caseKey: 'greenfield-property',
    activityType: 'drafting',
    userKey: 'ananya',
    durationMinutes: 180,
    narrative: 'Drafting of final sale deed and annexures',
    date: '2025-04-02',
    status: 'approved',
  },
  {
    key: 'c1-stamp-duty-email',
    invoiceKey: 'greenfield-property-paid',
    caseKey: 'greenfield-property',
    activityType: 'email',
    userKey: 'rohit',
    durationMinutes: 30,
    narrative: 'Correspondence with sub-registrar office re: stamp duty calculation',
    date: '2025-04-04',
    status: 'approved',
  },
  {
    key: 'c2-icadr-research',
    invoiceKey: 'tata-arbitration-partial',
    caseKey: 'tata-arbitration',
    activityType: 'research',
    userKey: 'sneha',
    durationMinutes: 150,
    narrative: 'Research on ICADR rules and precedents on freight contract breaches',
    date: '2025-06-05',
    status: 'approved',
  },
  {
    key: 'c2-statement-of-claim',
    invoiceKey: 'tata-arbitration-partial',
    caseKey: 'tata-arbitration',
    activityType: 'drafting',
    userKey: 'karan',
    durationMinutes: 300,
    narrative: 'Drafting statement of claim and supporting submissions',
    date: '2025-06-12',
    status: 'approved',
  },
  {
    key: 'c2-strategy-call',
    invoiceKey: 'tata-arbitration-partial',
    caseKey: 'tata-arbitration',
    activityType: 'meeting',
    userKey: 'arvind',
    durationMinutes: 60,
    narrative: 'Strategy call with client re: settlement position',
    date: '2025-06-15',
    status: 'approved',
  },
  {
    key: 'c2-preliminary-hearing',
    invoiceKey: 'tata-arbitration-partial',
    caseKey: 'tata-arbitration',
    activityType: 'hearing',
    userKey: 'karan',
    durationMinutes: 240,
    narrative: 'Preliminary arbitration hearing - first session',
    date: '2025-07-01',
    status: 'approved',
  },
  {
    key: 'c2-damages-research',
    caseKey: 'tata-arbitration',
    activityType: 'research',
    userKey: 'sneha',
    durationMinutes: 120,
    narrative: 'Research on damages calculation methodology',
    date: '2025-07-10',
    status: 'submitted',
  },
  {
    key: 'c2-reply-defence',
    caseKey: 'tata-arbitration',
    activityType: 'drafting',
    userKey: 'karan',
    durationMinutes: 180,
    narrative: "Reply to respondent's statement of defence",
    date: '2025-07-20',
    status: 'submitted',
  },
  {
    key: 'c2-disclosure-email',
    caseKey: 'tata-arbitration',
    activityType: 'email',
    userKey: 'karan',
    durationMinutes: 45,
    narrative: 'Email exchange with opposing counsel re: document disclosure',
    date: '2025-07-22',
    status: 'draft',
  },
  {
    key: 'c3-prior-art-search',
    invoiceKey: 'novatech-ip-paid',
    caseKey: 'novatech-ip',
    activityType: 'research',
    userKey: 'rohit',
    durationMinutes: 120,
    narrative: 'Prior art search for patent application 1 (logistics route optimisation)',
    date: '2025-09-05',
    status: 'approved',
  },
  {
    key: 'c3-patent-claims',
    invoiceKey: 'novatech-ip-paid',
    caseKey: 'novatech-ip',
    activityType: 'drafting',
    userKey: 'priya',
    durationMinutes: 180,
    narrative: 'Drafting patent claims and specification for application 1',
    date: '2025-09-12',
    status: 'approved',
  },
  {
    key: 'c3-trademark-search',
    invoiceKey: 'novatech-ip-paid',
    caseKey: 'novatech-ip',
    activityType: 'research',
    userKey: 'rohit',
    durationMinutes: 90,
    narrative: 'Trademark availability search for "NovaTech" and "NovaRoute"',
    date: '2025-09-15',
    status: 'approved',
  },
  {
    key: 'c3-trademark-forms',
    invoiceKey: 'novatech-ip-paid',
    caseKey: 'novatech-ip',
    activityType: 'drafting',
    userKey: 'ananya',
    durationMinutes: 120,
    narrative: 'Drafting trademark application forms TM-A and TM-C',
    date: '2025-09-20',
    status: 'approved',
  },
  {
    key: 'c3-ipo-correspondence',
    invoiceKey: 'novatech-ip-paid',
    caseKey: 'novatech-ip',
    activityType: 'email',
    userKey: 'ananya',
    durationMinutes: 60,
    narrative: 'Filing correspondence with IPO and acknowledgement tracking',
    date: '2025-10-01',
    status: 'approved',
  },
  {
    key: 'c4-msa-first-draft',
    invoiceKey: 'novatech-saas-draft',
    caseKey: 'novatech-saas',
    activityType: 'drafting',
    userKey: 'ananya',
    durationMinutes: 240,
    narrative: 'First draft of Master Services Agreement - scope, SLA, liability clauses',
    date: '2025-11-05',
    status: 'approved',
  },
  {
    key: 'c4-partner-review',
    invoiceKey: 'novatech-saas-draft',
    caseKey: 'novatech-saas',
    activityType: 'review',
    userKey: 'priya',
    durationMinutes: 90,
    narrative: 'Partner review of MSA draft and redlines',
    date: '2025-11-08',
    status: 'approved',
  },
  {
    key: 'c4-negotiation-call',
    caseKey: 'novatech-saas',
    activityType: 'meeting',
    userKey: 'priya',
    durationMinutes: 60,
    narrative: "Negotiation call with client's enterprise customer legal team",
    date: '2025-11-15',
    status: 'submitted',
  },
  {
    key: 'c4-msa-redlines-v2',
    caseKey: 'novatech-saas',
    activityType: 'drafting',
    userKey: 'ananya',
    durationMinutes: 120,
    narrative: 'Redline revisions to MSA v2 following negotiation',
    date: '2025-11-20',
    status: 'submitted',
  },
  {
    key: 'c6-rera-rules',
    invoiceKey: 'greenfield-rera-overdue',
    caseKey: 'greenfield-rera',
    activityType: 'research',
    userKey: 'karan',
    durationMinutes: 180,
    narrative: 'Review of RERA Maharashtra rules and project registration checklist',
    date: '2025-10-05',
    status: 'approved',
  },
  {
    key: 'c6-form-a',
    invoiceKey: 'greenfield-rera-overdue',
    caseKey: 'greenfield-rera',
    activityType: 'drafting',
    userKey: 'karan',
    durationMinutes: 240,
    narrative: 'Drafting RERA project registration application Form A',
    date: '2025-10-12',
    status: 'approved',
  },
  {
    key: 'c6-compliance-meeting',
    invoiceKey: 'greenfield-rera-overdue',
    caseKey: 'greenfield-rera',
    activityType: 'meeting',
    userKey: 'arvind',
    durationMinutes: 90,
    narrative: 'Meeting with client: RERA compliance timeline and obligations',
    date: '2025-10-18',
    status: 'approved',
  },
  {
    key: 'c6-builder-buyer-template',
    invoiceKey: 'greenfield-rera-overdue',
    caseKey: 'greenfield-rera',
    activityType: 'drafting',
    userKey: 'karan',
    durationMinutes: 120,
    narrative: 'Drafting builder-buyer agreement template per RERA requirements',
    date: '2025-10-25',
    status: 'approved',
  },
  {
    key: 'c6-portal-email',
    invoiceKey: 'greenfield-rera-overdue',
    caseKey: 'greenfield-rera',
    activityType: 'email',
    userKey: 'karan',
    durationMinutes: 60,
    narrative: 'Correspondence with MahaRERA portal re: technical rejection of filing',
    date: '2025-11-02',
    status: 'approved',
  },
  {
    key: 'c7-platform-review',
    invoiceKey: 'atlas-compliance-sent',
    caseKey: 'atlas-compliance',
    activityType: 'review',
    userKey: 'ananya',
    durationMinutes: 210,
    narrative: 'Review of digital lending journey, consent screens, and disclosure artifacts',
    date: '2025-02-18',
    status: 'approved',
  },
  {
    key: 'c7-rbi-gap-memo',
    invoiceKey: 'atlas-compliance-sent',
    caseKey: 'atlas-compliance',
    activityType: 'drafting',
    userKey: 'priya',
    durationMinutes: 180,
    narrative: 'Drafting RBI digital lending compliance gap memorandum',
    date: '2025-02-25',
    status: 'approved',
  },
  {
    key: 'c7-partner-onboarding',
    invoiceKey: 'atlas-compliance-sent',
    caseKey: 'atlas-compliance',
    activityType: 'research',
    userKey: 'rohit',
    durationMinutes: 150,
    narrative: 'Research on lending service provider onboarding and escrow restrictions',
    date: '2025-03-03',
    status: 'approved',
  },
  {
    key: 'c7-board-meeting',
    invoiceKey: 'atlas-compliance-sent',
    caseKey: 'atlas-compliance',
    activityType: 'meeting',
    userKey: 'priya',
    durationMinutes: 75,
    narrative: 'Board compliance committee walkthrough of audit findings',
    date: '2025-03-08',
    status: 'approved',
  },
  {
    key: 'c7-policy-refresh',
    caseKey: 'atlas-compliance',
    activityType: 'drafting',
    userKey: 'ananya',
    durationMinutes: 120,
    narrative: 'Drafting revised customer grievance escalation policy',
    date: '2025-03-15',
    status: 'submitted',
  },
  {
    key: 'c8-demand-notices',
    invoiceKey: 'atlas-debt-paid',
    caseKey: 'atlas-debt-recovery',
    activityType: 'drafting',
    userKey: 'karan',
    durationMinutes: 240,
    narrative: 'Drafting batch demand notices for twenty delinquent SME loan accounts',
    date: '2024-11-12',
    status: 'approved',
  },
  {
    key: 'c8-settlement-call',
    invoiceKey: 'atlas-debt-paid',
    caseKey: 'atlas-debt-recovery',
    activityType: 'meeting',
    userKey: 'priya',
    durationMinutes: 90,
    narrative: 'Settlement strategy call with recovery team and regional credit head',
    date: '2024-12-03',
    status: 'approved',
  },
  {
    key: 'c8-consent-terms',
    invoiceKey: 'atlas-debt-paid',
    caseKey: 'atlas-debt-recovery',
    activityType: 'drafting',
    userKey: 'sneha',
    durationMinutes: 180,
    narrative: 'Preparing consent terms and payment schedule annexures',
    date: '2025-01-18',
    status: 'approved',
  },
  {
    key: 'c9-exit-terms',
    caseKey: 'mednova-employment',
    activityType: 'review',
    userKey: 'ananya',
    durationMinutes: 90,
    narrative: 'Initial review of proposed senior scientist exit terms and confidentiality clauses',
    date: '2026-01-08',
    status: 'submitted',
  },
  {
    key: 'c9-nonsolicit-note',
    caseKey: 'mednova-employment',
    activityType: 'research',
    userKey: 'priya',
    durationMinutes: 60,
    narrative: 'Research note on enforceability of employee non-solicit restrictions',
    date: '2026-01-10',
    status: 'draft',
  },
  {
    key: 'c10-dpa-first-draft',
    invoiceKey: 'mednova-dpa-partial',
    caseKey: 'mednova-dpa',
    activityType: 'drafting',
    userKey: 'ananya',
    durationMinutes: 240,
    narrative: 'Drafting hospital network data processing agreement and security schedule',
    date: '2025-08-08',
    status: 'approved',
  },
  {
    key: 'c10-health-data-research',
    invoiceKey: 'mednova-dpa-partial',
    caseKey: 'mednova-dpa',
    activityType: 'research',
    userKey: 'rohit',
    durationMinutes: 180,
    narrative: 'Research on health data transfer restrictions and consent architecture',
    date: '2025-08-12',
    status: 'approved',
  },
  {
    key: 'c10-negotiation-call',
    invoiceKey: 'mednova-dpa-partial',
    caseKey: 'mednova-dpa',
    activityType: 'meeting',
    userKey: 'priya',
    durationMinutes: 75,
    narrative: 'Negotiation call with hospital network counsel on audit rights',
    date: '2025-08-20',
    status: 'approved',
  },
  {
    key: 'c10-redline-turn',
    invoiceKey: 'mednova-dpa-partial',
    caseKey: 'mednova-dpa',
    activityType: 'review',
    userKey: 'ananya',
    durationMinutes: 120,
    narrative: 'Review and turnaround of hospital redlines to DPA v2',
    date: '2025-08-28',
    status: 'approved',
  },
  {
    key: 'c10-duplicate-review',
    caseKey: 'mednova-dpa',
    activityType: 'review',
    userKey: 'rohit',
    durationMinutes: 45,
    narrative: 'Duplicate document review later rejected during quality control',
    date: '2025-08-30',
    status: 'rejected',
  },
  {
    key: 'c11-resort-term-sheet',
    caseKey: 'sunrise-hotel-lease',
    activityType: 'review',
    userKey: 'ananya',
    durationMinutes: 120,
    narrative: 'Review of Goa resort lease term sheet and title annexures',
    date: '2026-02-20',
    status: 'submitted',
  },
  {
    key: 'c11-stamp-duty-note',
    caseKey: 'sunrise-hotel-lease',
    activityType: 'research',
    userKey: 'arvind',
    durationMinutes: 60,
    narrative: 'Stamp duty and registration risk note for long-term hospitality lease',
    date: '2026-02-22',
    status: 'submitted',
  },
  {
    key: 'c12-fssai-checklist',
    caseKey: 'sunrise-food-license',
    activityType: 'research',
    userKey: 'karan',
    durationMinutes: 90,
    narrative: 'FSSAI renewal checklist and inspection readiness note',
    date: '2024-05-08',
    status: 'approved',
  },
  {
    key: 'c12-renewal-email',
    caseKey: 'sunrise-food-license',
    activityType: 'email',
    userKey: 'arvind',
    durationMinutes: 30,
    narrative: 'Email advisory on renewal filing deadlines and kitchen documents',
    date: '2024-05-18',
    status: 'approved',
  },
  {
    key: 'c13-title-diligence',
    invoiceKey: 'bluepeak-land-sent',
    caseKey: 'bluepeak-land',
    activityType: 'research',
    userKey: 'rohit',
    durationMinutes: 240,
    narrative: 'Title diligence for first tranche of solar park land parcels',
    date: '2025-12-06',
    status: 'approved',
  },
  {
    key: 'c13-landowner-meeting',
    invoiceKey: 'bluepeak-land-sent',
    caseKey: 'bluepeak-land',
    activityType: 'meeting',
    userKey: 'arvind',
    durationMinutes: 120,
    narrative: 'Landowner negotiation meeting and risk allocation discussion',
    date: '2025-12-12',
    status: 'approved',
  },
  {
    key: 'c13-lease-draft',
    invoiceKey: 'bluepeak-land-sent',
    caseKey: 'bluepeak-land',
    activityType: 'drafting',
    userKey: 'karan',
    durationMinutes: 300,
    narrative: 'Drafting long-form lease deed for solar park parcels',
    date: '2025-12-18',
    status: 'approved',
  },
  {
    key: 'c13-grid-easement',
    invoiceKey: 'bluepeak-land-sent',
    caseKey: 'bluepeak-land',
    activityType: 'drafting',
    userKey: 'arvind',
    durationMinutes: 150,
    narrative: 'Drafting grid evacuation easement and access rights schedule',
    date: '2026-01-05',
    status: 'approved',
  },
  {
    key: 'c13-mutation-followup',
    caseKey: 'bluepeak-land',
    activityType: 'email',
    userKey: 'karan',
    durationMinutes: 45,
    narrative: 'Follow-up with local counsel on mutation record discrepancies',
    date: '2026-01-12',
    status: 'submitted',
  },
  {
    key: 'c14-notice-research',
    caseKey: 'bluepeak-showcause',
    activityType: 'research',
    userKey: 'karan',
    durationMinutes: 150,
    narrative: 'Research on pollution control board show cause procedure',
    date: '2026-03-12',
    status: 'submitted',
  },
  {
    key: 'c14-cap-draft',
    caseKey: 'bluepeak-showcause',
    activityType: 'drafting',
    userKey: 'sneha',
    durationMinutes: 120,
    narrative: 'First draft corrective action plan later rejected for missing site facts',
    date: '2026-03-14',
    status: 'rejected',
  },
  {
    key: 'c14-client-call',
    caseKey: 'bluepeak-showcause',
    activityType: 'meeting',
    userKey: 'arvind',
    durationMinutes: 60,
    narrative: 'Client call to gather inspection facts and compliance documents',
    date: '2026-03-16',
    status: 'draft',
  },
  {
    key: 'c15-founder-settlement',
    invoiceKey: 'urbanleaf-dispute-void',
    caseKey: 'urbanleaf-dispute',
    activityType: 'meeting',
    userKey: 'priya',
    durationMinutes: 180,
    narrative: 'Founder settlement conference and board process advice',
    date: '2024-10-10',
    status: 'approved',
  },
  {
    key: 'c15-board-note',
    invoiceKey: 'urbanleaf-dispute-void',
    caseKey: 'urbanleaf-dispute',
    activityType: 'drafting',
    userKey: 'karan',
    durationMinutes: 210,
    narrative: 'Drafting board note and founder exit settlement framework',
    date: '2024-11-05',
    status: 'approved',
  },
  {
    key: 'c15-shareholder-review',
    invoiceKey: 'urbanleaf-dispute-void',
    caseKey: 'urbanleaf-dispute',
    activityType: 'review',
    userKey: 'priya',
    durationMinutes: 120,
    narrative: 'Review of shareholders agreement reserved matters and transfer restrictions',
    date: '2024-11-20',
    status: 'approved',
  },
  {
    key: 'c16-vendor-template',
    caseKey: 'urbanleaf-vendor-contracts',
    activityType: 'drafting',
    userKey: 'ananya',
    durationMinutes: 180,
    narrative: 'Drafting refreshed supplier master terms for retail vendors',
    date: '2024-04-12',
    status: 'approved',
  },
  {
    key: 'c16-logistics-addendum',
    caseKey: 'urbanleaf-vendor-contracts',
    activityType: 'review',
    userKey: 'rohit',
    durationMinutes: 90,
    narrative: 'Review of logistics vendor addendum and SLA credits',
    date: '2024-05-03',
    status: 'approved',
  },
  {
    key: 'c17-will-draft',
    caseKey: 'rajan-estate',
    activityType: 'drafting',
    userKey: 'ananya',
    durationMinutes: 150,
    narrative: 'Drafting first version of will and asset schedule',
    date: '2026-04-08',
    status: 'approved',
  },
  {
    key: 'c17-family-settlement',
    caseKey: 'rajan-estate',
    activityType: 'meeting',
    userKey: 'priya',
    durationMinutes: 90,
    narrative: 'Family settlement planning call and succession options discussion',
    date: '2026-04-14',
    status: 'approved',
  },
  {
    key: 'c18-labour-notice-review',
    invoiceKey: 'tata-labour-paid',
    caseKey: 'tata-labour-notice',
    activityType: 'review',
    userKey: 'karan',
    durationMinutes: 150,
    narrative: 'Review of labour department notice and contractor wage records',
    date: '2025-04-14',
    status: 'approved',
  },
  {
    key: 'c18-response-draft',
    invoiceKey: 'tata-labour-paid',
    caseKey: 'tata-labour-notice',
    activityType: 'drafting',
    userKey: 'sneha',
    durationMinutes: 180,
    narrative: 'Drafting response to labour department notice with compliance annexures',
    date: '2025-04-20',
    status: 'approved',
  },
];

const invoiceDefinitions = [
  {
    key: 'greenfield-property-paid',
    clientKey: 'greenfield',
    caseKey: 'greenfield-property',
    periodStart: '2025-03-01',
    periodEnd: '2025-04-30',
    issueDate: '2025-05-01',
    dueDate: '2025-05-31',
    status: 'paid',
    subtotalTarget: 102500,
    taxRate: 0.18,
    createdByKey: 'rekha',
    payments: [
      {
        amount: 'invoice-total',
        method: 'bank_transfer',
        receivedDate: '2025-05-28',
        reference: 'UTR2025052800142',
        receivedByKey: 'rekha',
      },
    ],
  },
  {
    key: 'tata-arbitration-partial',
    clientKey: 'tata',
    caseKey: 'tata-arbitration',
    periodStart: '2025-06-01',
    periodEnd: '2025-07-31',
    issueDate: '2025-08-01',
    dueDate: '2025-08-16',
    status: 'partial',
    subtotalTarget: 88500,
    taxRate: 0.18,
    createdByKey: 'rekha',
    payments: [
      {
        amount: 50000,
        method: 'bank_transfer',
        receivedDate: '2025-08-14',
        reference: 'UTR2025081400287',
        receivedByKey: 'rekha',
      },
    ],
  },
  {
    key: 'novatech-ip-paid',
    clientKey: 'novatech',
    caseKey: 'novatech-ip',
    periodStart: '2025-09-01',
    periodEnd: '2025-10-31',
    issueDate: '2025-11-01',
    dueDate: '2025-12-01',
    status: 'paid',
    subtotalTarget: 150000,
    taxRate: 0,
    createdByKey: 'rekha',
    payments: [
      {
        amount: 'invoice-total',
        method: 'upi',
        receivedDate: '2025-11-25',
        reference: 'NOVATECH-PAY-001',
        receivedByKey: 'rekha',
      },
    ],
  },
  {
    key: 'greenfield-rera-overdue',
    clientKey: 'greenfield',
    caseKey: 'greenfield-rera',
    periodStart: '2025-10-01',
    periodEnd: '2025-11-30',
    issueDate: '2025-12-01',
    dueDate: '2025-12-31',
    status: 'overdue',
    subtotalTarget: 72000,
    taxRate: 0.18,
    createdByKey: 'rekha',
    payments: [],
  },
  {
    key: 'novatech-saas-draft',
    clientKey: 'novatech',
    caseKey: 'novatech-saas',
    periodStart: '2025-11-01',
    periodEnd: '2025-11-30',
    issueDate: '2025-11-30',
    dueDate: '2025-12-30',
    status: 'draft',
    subtotalTarget: 61500,
    taxRate: 0.18,
    createdByKey: 'rekha',
    payments: [],
  },
  {
    key: 'atlas-compliance-sent',
    clientKey: 'atlas',
    caseKey: 'atlas-compliance',
    periodStart: '2025-02-01',
    periodEnd: '2025-03-31',
    issueDate: '2025-04-01',
    dueDate: '2025-05-01',
    status: 'sent',
    subtotalTarget: 96500,
    taxRate: 0.18,
    createdByKey: 'rekha',
    payments: [],
  },
  {
    key: 'atlas-debt-paid',
    clientKey: 'atlas',
    caseKey: 'atlas-debt-recovery',
    periodStart: '2024-11-01',
    periodEnd: '2025-01-31',
    issueDate: '2025-02-01',
    dueDate: '2025-03-03',
    status: 'paid',
    subtotalTarget: 64500,
    taxRate: 0.18,
    createdByKey: 'rekha',
    payments: [
      {
        amount: 'invoice-total',
        method: 'bank_transfer',
        receivedDate: '2025-03-01',
        reference: 'UTR2025030100199',
        receivedByKey: 'rekha',
      },
    ],
  },
  {
    key: 'mednova-dpa-partial',
    clientKey: 'mednova',
    caseKey: 'mednova-dpa',
    periodStart: '2025-08-01',
    periodEnd: '2025-08-31',
    issueDate: '2025-09-05',
    dueDate: '2025-10-20',
    status: 'partial',
    subtotalTarget: 78000,
    taxRate: 0.18,
    createdByKey: 'rekha',
    payments: [
      {
        amount: 40000,
        method: 'upi',
        receivedDate: '2025-10-05',
        reference: 'MEDNOVA-UPI-20251005',
        receivedByKey: 'rekha',
      },
    ],
  },
  {
    key: 'bluepeak-land-sent',
    clientKey: 'bluepeak',
    caseKey: 'bluepeak-land',
    periodStart: '2025-12-01',
    periodEnd: '2026-01-31',
    issueDate: '2026-02-01',
    dueDate: '2026-06-15',
    status: 'sent',
    subtotalTarget: 112000,
    taxRate: 0.18,
    createdByKey: 'rekha',
    payments: [],
  },
  {
    key: 'urbanleaf-dispute-void',
    clientKey: 'urbanleaf',
    caseKey: 'urbanleaf-dispute',
    periodStart: '2024-10-01',
    periodEnd: '2024-11-30',
    issueDate: '2024-12-01',
    dueDate: '2024-12-16',
    status: 'void',
    subtotalTarget: 52000,
    taxRate: 0.18,
    createdByKey: 'rekha',
    payments: [],
  },
  {
    key: 'tata-labour-paid',
    clientKey: 'tata',
    caseKey: 'tata-labour-notice',
    periodStart: '2025-04-01',
    periodEnd: '2025-04-30',
    issueDate: '2025-05-01',
    dueDate: '2025-05-16',
    status: 'paid',
    subtotalTarget: 37500,
    taxRate: 0.18,
    createdByKey: 'rekha',
    payments: [
      {
        amount: 'invoice-total',
        method: 'bank_transfer',
        receivedDate: '2025-05-12',
        reference: 'UTR2025051200118',
        receivedByKey: 'rekha',
      },
    ],
  },
];

const emailEntryDefinitions = [
  {
    key: 'tata-document-production',
    userKey: 'karan',
    clientKey: 'tata',
    caseKey: 'tata-arbitration',
    recipient: 'legal@tatalogistics.example',
    subject: 'Re: Freight Masters - document production schedule',
    body: [
      'Dear Sameer,',
      '',
      'I have reviewed the proposed document production schedule for the Freight Masters arbitration. The current timetable is workable, provided the respondent serves the missing trip sheets and invoice annexures before the next procedural conference.',
      '',
      'Please keep the originals available for inspection and circulate the warehouse movement register by Friday. I will incorporate the updated disclosure dates into our procedural note and flag the damages documents that still need finance team confirmation.',
      '',
      'Regards,',
      'Karan',
    ].join('\n'),
    source: 'gmail',
    typingTimeMinutes: 12,
    workDate: '2025-07-22',
    status: 'converted',
  },
  {
    key: 'novatech-msa-v2',
    userKey: 'ananya',
    clientKey: 'novatech',
    caseKey: 'novatech-saas',
    recipient: 'finance@novatech.example',
    subject: 'Re: NovaTech MSA v2 - revised liability cap',
    body: [
      'Hi Isha,',
      '',
      'Attached is the revised position on the liability cap and indemnity wording for the enterprise MSA. I have retained the product-specific carve-outs but narrowed the uncapped exposure to confidentiality, IP infringement, and payment obligations.',
      '',
      'Please confirm whether the commercial team is comfortable with the twelve-month fees cap for general claims. Once confirmed, I can prepare the clean execution draft and the comparison against the customer mark-up.',
      '',
      'Best,',
      'Ananya',
    ].join('\n'),
    source: 'extension',
    typingTimeMinutes: 8,
    workDate: '2025-11-20',
    status: 'mapped',
  },
];

const kpiDefinitions = [
  { month: '2025-01', utilization: 61, realization: 84, WIP: 64500, AR: 0, revenue: 76110 },
  { month: '2025-02', utilization: 74, realization: 90, WIP: 96500, AR: 113870, revenue: 0 },
  { month: '2025-03', utilization: 79, realization: 94, WIP: 102500, AR: 113870, revenue: 76110 },
  { month: '2025-04', utilization: 67, realization: 87, WIP: 37500, AR: 158120, revenue: 44250 },
  { month: '2025-05', utilization: 73, realization: 91, WIP: 88500, AR: 113870, revenue: 120950 },
  { month: '2025-06', utilization: 70, realization: 86, WIP: 88500, AR: 104430, revenue: 0 },
  { month: '2025-07', utilization: 68, realization: 82, WIP: 126000, AR: 104430, revenue: 0 },
  { month: '2025-08', utilization: 77, realization: 89, WIP: 78000, AR: 156470, revenue: 90000 },
  { month: '2025-09', utilization: 83, realization: 96, WIP: 30000, AR: 54430, revenue: 150000 },
  { month: '2025-10', utilization: 71, realization: 80, WIP: 84960, AR: 139390, revenue: 40000 },
  { month: '2025-11', utilization: 64, realization: 73, WIP: 61500, AR: 224350, revenue: 0 },
  { month: '2026-01', utilization: 58, realization: 76, WIP: 112000, AR: 356510, revenue: 0 },
  { month: '2026-03', utilization: 62, realization: 70, WIP: 148000, AR: 356510, revenue: 0 },
  { month: '2026-05', utilization: 69, realization: 78, WIP: 184000, AR: 356510, revenue: 0 },
];

const clientKpiDefinitions = [
  { clientKey: 'greenfield', month: '2025-05', utilization: 76, realization: 92, WIP: 0, AR: 0, revenue: 120950 },
  { clientKey: 'greenfield', month: '2025-11', utilization: 66, realization: 68, WIP: 0, AR: 84960, revenue: 0 },
  { clientKey: 'tata', month: '2025-08', utilization: 71, realization: 78, WIP: 72000, AR: 54430, revenue: 50000 },
  { clientKey: 'novatech', month: '2025-11', utilization: 82, realization: 96, WIP: 61500, AR: 0, revenue: 150000 },
  { clientKey: 'atlas', month: '2025-03', utilization: 88, realization: 93, WIP: 96500, AR: 113870, revenue: 76110 },
  { clientKey: 'mednova', month: '2025-10', utilization: 74, realization: 79, WIP: 35000, AR: 52040, revenue: 40000 },
  { clientKey: 'bluepeak', month: '2026-01', utilization: 81, realization: 83, WIP: 112000, AR: 132160, revenue: 0 },
  { clientKey: 'urbanleaf', month: '2024-12', utilization: 43, realization: 0, WIP: 0, AR: 0, revenue: 0 },
];

const caseKpiDefinitions = [
  { caseKey: 'greenfield-property', month: '2025-05', utilization: 78, realization: 94, WIP: 0, AR: 0, revenue: 120950 },
  { caseKey: 'greenfield-rera', month: '2025-11', utilization: 64, realization: 62, WIP: 0, AR: 84960, revenue: 0 },
  { caseKey: 'tata-arbitration', month: '2025-08', utilization: 73, realization: 76, WIP: 72000, AR: 54430, revenue: 50000 },
  { caseKey: 'novatech-saas', month: '2025-11', utilization: 55, realization: 72, WIP: 61500, AR: 0, revenue: 0 },
  { caseKey: 'atlas-compliance', month: '2025-03', utilization: 88, realization: 91, WIP: 96500, AR: 113870, revenue: 0 },
  { caseKey: 'mednova-dpa', month: '2025-10', utilization: 79, realization: 81, WIP: 0, AR: 52040, revenue: 40000 },
  { caseKey: 'bluepeak-land', month: '2026-01', utilization: 84, realization: 83, WIP: 112000, AR: 132160, revenue: 0 },
  { caseKey: 'bluepeak-showcause', month: '2026-03', utilization: 44, realization: 55, WIP: 18000, AR: 0, revenue: 0 },
];

function userDefinitionByKey(key) {
  return userDefinitions.find((entry) => entry.key === key);
}

function activityCodeFor(activityType) {
  return activityCodeByType[activityType] || 'OTHER';
}

function categoryFor(activityType) {
  return categoryByType[activityType] || 'Miscellaneous administrative legal work';
}

function baseRateFor(workItem) {
  const activityCode = activityCodeFor(workItem.activityType);
  const override = rateCardDefinitions.find((rateCard) => (
    rateCard.userKey === workItem.userKey &&
    rateCard.caseKey === workItem.caseKey &&
    (!rateCard.activityCode || rateCard.activityCode === activityCode) &&
    d(rateCard.effectiveFrom) <= d(workItem.date)
  ));
  if (override) return override.ratePerHour;
  return userDefinitionByKey(workItem.userKey)?.billingRate || firmPayload.billingPreferences.defaultRate;
}

function applyInvoiceAmountTargets() {
  for (const invoice of invoiceDefinitions) {
    const items = workItemDefinitions.filter((item) => item.invoiceKey === invoice.key);
    if (!items.length) continue;

    const baseAmounts = items.map((item) => roundMoney(baseRateFor(item) * hoursFor(item.durationMinutes)));
    const baseTotal = baseAmounts.reduce((sum, amount) => sum + amount, 0);
    let allocatedTotal = 0;

    items.forEach((item, index) => {
      const isLast = index === items.length - 1;
      const amount = isLast
        ? roundMoney(invoice.subtotalTarget - allocatedTotal)
        : roundMoney((baseAmounts[index] / baseTotal) * invoice.subtotalTarget);
      allocatedTotal = roundMoney(allocatedTotal + amount);
      item.amount = amount;
      item.rateApplied = roundMoney(amount / hoursFor(item.durationMinutes));
    });
  }

  for (const item of workItemDefinitions) {
    if (item.amount != null && item.rateApplied != null) continue;
    item.rateApplied = baseRateFor(item);
    item.amount = roundMoney(item.rateApplied * hoursFor(item.durationMinutes));
  }
}

async function upsertRoleProfile(user, definition, userByKey) {
  if (definition.role === 'admin') {
    await Admin.findOneAndUpdate(
      { userId: user._id },
      { $set: { firmId: user.firmId, role: 'firm_admin' } },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );
    return;
  }

  const sharedOptions = { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true };
  if (definition.role === 'partner') {
    await PartnerProfile.findOneAndUpdate(
      { userId: user._id },
      { $set: { ...definition.profile, billingRate: definition.billingRate } },
      sharedOptions
    );
    return;
  }
  if (definition.role === 'lawyer') {
    await LawyerProfile.findOneAndUpdate(
      { userId: user._id },
      { $set: { ...definition.profile, billingRate: definition.billingRate } },
      sharedOptions
    );
    return;
  }
  if (definition.role === 'associate') {
    await AssociateProfile.findOneAndUpdate(
      { userId: user._id },
      { $set: { ...definition.profile, billingRate: definition.billingRate } },
      sharedOptions
    );
    return;
  }
  if (definition.role === 'intern') {
    const { mentorKey, ...profile } = definition.profile || {};
    await InternProfile.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          ...profile,
          mentor: userByKey[mentorKey]?._id,
          billingRate: definition.billingRate,
        },
      },
      sharedOptions
    );
  }
}

function assignmentRoleFor(userKey, caseDefinition) {
  const user = userDefinitionByKey(userKey);
  if (userKey === caseDefinition.managingLawyerKey || userKey === caseDefinition.primaryLawyerKey) return 'primary';
  if (user?.role === 'partner') return 'partner';
  if (user?.role === 'admin') return 'admin';
  return 'associate';
}

async function seedFirm() {
  return Firm.findOneAndUpdate(
    { name: firmPayload.name },
    { $set: firmPayload },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );
}

async function seedUsers(firm) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userByKey = {};

  for (const definition of userDefinitions) {
    const user = await User.findOneAndUpdate(
      { mobile: definition.mobile },
      {
        $set: {
          name: definition.name,
          email: definition.email,
          mobile: definition.mobile,
          role: definition.role,
          firmId: firm._id,
          passwordHash,
          address: definition.address,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );
    userByKey[definition.key] = user;
  }

  for (const definition of userDefinitions) {
    await upsertRoleProfile(userByKey[definition.key], definition, userByKey);
  }

  return userByKey;
}

async function seedClients(firm, userByKey) {
  const clientByKey = {};

  for (const definition of clientDefinitions) {
    const client = await Client.findOneAndUpdate(
      { displayName: definition.displayName, firmId: firm._id },
      {
        $set: {
          displayName: definition.displayName,
          name: definition.displayName,
          email: definition.email,
          phone: definition.phone,
          firmId: firm._id,
          ownerUserId: userByKey[definition.ownerKey]?._id,
          status: definition.status,
          paymentTerms: definition.paymentTerms,
          contacts: definition.contacts,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );
    clientByKey[definition.key] = client;
  }

  return clientByKey;
}

async function seedCases(firm, clientByKey, userByKey) {
  const caseByKey = {};

  for (const definition of caseDefinitions) {
    const client = clientByKey[definition.clientKey];
    const matter = await Case.findOneAndUpdate(
      { clientId: client._id, title: definition.title },
      {
        $set: {
          clientId: client._id,
          title: definition.title,
          name: definition.title,
          description: definition.description,
          status: definition.status,
          openedAt: d(definition.openedAt),
          closedAt: definition.closedAt ? d(definition.closedAt) : undefined,
          leadPartnerId: userByKey[definition.leadPartnerKey]?._id,
          managingLawyerId: userByKey[definition.managingLawyerKey]?._id,
          primaryLawyerId: userByKey[definition.managingLawyerKey]?._id,
          assignedUsers: definition.assignedUserKeys.map((key) => userByKey[key]?._id).filter(Boolean),
          billingType: definition.billingType,
          case_type: definition.case_type,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );
    caseByKey[definition.key] = matter;

    const assignmentStatus = ['closed', 'archived'].includes(definition.status) ? 'inactive' : 'active';
    for (const userKey of definition.assignedUserKeys) {
      await CaseAssignment.findOneAndUpdate(
        { caseId: matter._id, userId: userByKey[userKey]._id },
        {
          $set: {
            caseId: matter._id,
            userId: userByKey[userKey]._id,
            role: assignmentRoleFor(userKey, definition),
            startAt: d(definition.openedAt),
            endAt: definition.closedAt ? d(definition.closedAt) : undefined,
            assignedBy: userByKey.rekha._id,
            assignedAt: d(definition.openedAt),
            status: assignmentStatus,
            firmId: firm._id,
            clientId: client._id,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
      );
    }
  }

  return caseByKey;
}

async function seedRateCards(caseByKey, userByKey) {
  for (const definition of rateCardDefinitions) {
    const caseId = definition.caseKey ? caseByKey[definition.caseKey]._id : null;
    const activityCode = definition.activityCode || null;
    await RateCard.findOneAndUpdate(
      {
        userId: userByKey[definition.userKey]._id,
        caseId,
        activityCode,
        effectiveFrom: d(definition.effectiveFrom),
      },
      {
        $set: {
          userId: userByKey[definition.userKey]._id,
          caseId,
          activityCode,
          ratePerHour: definition.ratePerHour,
          effectiveFrom: d(definition.effectiveFrom),
          effectiveTo: definition.effectiveTo ? d(definition.effectiveTo) : undefined,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );
  }
}

async function seedWorkItems(clientByKey, caseByKey, userByKey) {
  const activityByKey = {};
  const timeEntryByKey = {};
  const billableByKey = {};

  for (const definition of workItemDefinitions) {
    const matter = caseByKey[definition.caseKey];
    const client = clientByKey[caseDefinitions.find((entry) => entry.key === definition.caseKey).clientKey];
    const activityCode = activityCodeFor(definition.activityType);
    const workDate = d(definition.date);
    const ref = sourceRef('activity', definition.key);
    const isApproved = definition.status === 'approved';
    const isRejected = definition.status === 'rejected';
    const isSubmitted = ['submitted', 'approved', 'rejected'].includes(definition.status);
    const isReviewed = ['approved', 'rejected'].includes(definition.status);

    const activity = await Activity.findOneAndUpdate(
      { userId: userByKey[definition.userKey]._id, source: 'manual', sourceRef: ref },
      {
        $set: {
          caseId: matter._id,
          clientId: client._id,
          userId: userByKey[definition.userKey]._id,
          activityType: definition.activityType,
          startedAt: workDate,
          endedAt: workDate,
          durationMinutes: definition.durationMinutes,
          roundedDurationMinutes: definition.durationMinutes,
          workDate,
          roundingPolicy: 'exact',
          billable: true,
          source: 'manual',
          sourceRef: ref,
          narrative: definition.narrative,
          activityCode,
          timezone: 'Asia/Kolkata',
          status: isApproved ? 'converted' : isRejected ? 'ignored' : isSubmitted ? 'reviewed' : 'captured',
          conversionStatus: isApproved ? 'converted' : 'unconverted',
          createdBy: userByKey[definition.userKey]._id,
          updatedBy: userByKey.rekha._id,
          reviewedAt: isReviewed ? workDate : undefined,
          reviewedBy: isReviewed ? userByKey.rekha._id : undefined,
          ignoredAt: isRejected ? workDate : undefined,
          ignoredBy: isRejected ? userByKey.rekha._id : undefined,
          voidReason: isRejected ? 'Rejected during demo quality control' : undefined,
          auditTrail: [
            {
              action: 'seeded',
              actorId: userByKey.rekha._id,
              at: workDate,
              reason: 'Veeresh demo data',
            },
          ],
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );
    activityByKey[definition.key] = activity;

    const timeEntry = await TimeEntry.findOneAndUpdate(
      { activityId: activity._id },
      {
        $set: {
          caseId: matter._id,
          clientId: client._id,
          userId: userByKey[definition.userKey]._id,
          activityId: activity._id,
          activityCode,
          narrative: definition.narrative,
          billableMinutes: definition.durationMinutes,
          nonbillableMinutes: 0,
          rateApplied: definition.rateApplied,
          amount: definition.amount,
          date: workDate,
          status: definition.status,
          submittedAt: isSubmitted ? workDate : undefined,
          submittedBy: isSubmitted ? userByKey[definition.userKey]._id : undefined,
          reviewedAt: isReviewed ? workDate : undefined,
          reviewedBy: isReviewed ? userByKey.rekha._id : undefined,
          rejectionReason: isRejected ? 'Duplicate or incomplete demo work item' : undefined,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );
    timeEntryByKey[definition.key] = timeEntry;

    if (isApproved) {
      await Activity.findByIdAndUpdate(activity._id, {
        $set: {
          convertedTimeEntryId: timeEntry._id,
          convertedAt: workDate,
        },
      });

      const invoiceStatus = invoiceDefinitions.find((invoice) => invoice.key === definition.invoiceKey)?.status;
      const billableStatus = invoiceStatus && !['draft', 'void'].includes(invoiceStatus)
        ? 'billed'
        : 'approved';
      const billable = await Billable.findOneAndUpdate(
        { activityId: activity._id },
        {
          $set: {
            caseId: matter._id,
            clientId: client._id,
            userId: userByKey[definition.userKey]._id,
            activityId: activity._id,
            subject: definition.narrative.slice(0, 120),
            status: billableStatus,
            activityCode,
            category: categoryFor(definition.activityType),
            description: definition.narrative,
            durationMinutes: definition.durationMinutes,
            rate: definition.rateApplied,
            amount: definition.amount,
            date: workDate,
            approvedAt: workDate,
            approvedBy: userByKey.rekha._id,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
      );
      billableByKey[definition.key] = billable;
    }
  }

  return { activityByKey, billableByKey, timeEntryByKey };
}

async function seedEmailEntries(clientByKey, caseByKey, userByKey, workArtifacts) {
  const entryByKey = {};

  for (const definition of emailEntryDefinitions) {
    const client = clientByKey[definition.clientKey];
    const matter = caseByKey[definition.caseKey];
    const user = userByKey[definition.userKey];
    const minutes = Number(definition.typingTimeMinutes);
    const seconds = Math.round(minutes * 60);

    const meta = {
      capturedFrom: 'seed',
      demoKey: definition.key,
      schemaVersion: 1,
    };
    if (definition.key === 'tata-document-production') {
      const linkedActivity = workArtifacts.activityByKey['c2-disclosure-email'];
      const linkedTimeEntry = workArtifacts.timeEntryByKey['c2-disclosure-email'];
      if (linkedActivity) meta.activityId = linkedActivity._id;
      if (linkedTimeEntry) meta.timeEntryId = linkedTimeEntry._id;
    }

    const entry = await EmailEntry.findOneAndUpdate(
      { userId: user._id, source: definition.source, sourceRef: sourceRef('email', definition.key) },
      {
        $set: {
          userId: user._id,
          userEmail: user.email,
          recipient: definition.recipient,
          subject: definition.subject,
          body: definition.body,
          typingTimeSeconds: seconds,
          typingTimeMinutes: minutes,
          typingTimeMinSec: `${Math.floor(seconds / 60)}.${String(seconds % 60).padStart(2, '0')}`,
          mappedClientId: client._id,
          mappedCaseId: matter._id,
          clientId: client._id,
          caseId: matter._id,
          billableSummary: `Email work: ${definition.subject}`,
          workDate: d(definition.workDate),
          rate: baseRateFor({
            userKey: definition.userKey,
            caseKey: definition.caseKey,
            activityType: 'email',
            date: definition.workDate,
          }),
          source: definition.source,
          sourceRef: sourceRef('email', definition.key),
          messageId: sourceRef('message', definition.key),
          threadId: sourceRef('thread', definition.key),
          url: `https://mail.google.com/mail/u/0/#inbox/${definition.key}`,
          domain: 'mail.google.com',
          status: definition.status,
          mappedAt: d(definition.workDate),
          convertedAt: definition.status === 'converted' ? d(definition.workDate) : undefined,
          schemaVersion: 1,
          meta,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );
    entryByKey[definition.key] = entry;
  }

  return entryByKey;
}

async function seedInvoices(clientByKey, caseByKey, userByKey, billableByKey, timeEntryByKey) {
  const invoiceByKey = {};

  for (const definition of invoiceDefinitions) {
    const billableItems = workItemDefinitions
      .filter((workItem) => workItem.invoiceKey === definition.key)
      .map((workItem) => ({
        workItem,
        billable: billableByKey[workItem.key],
        timeEntry: timeEntryByKey[workItem.key],
      }))
      .filter((entry) => entry.billable && entry.timeEntry);

    const items = billableItems.map(({ workItem, billable }) => ({
      billableId: billable._id,
      description: workItem.narrative,
      durationMinutes: workItem.durationMinutes,
      rate: workItem.rateApplied,
      amount: workItem.amount,
    }));
    const subtotal = roundMoney(items.reduce((sum, item) => sum + item.amount, 0));
    const tax = roundMoney(subtotal * definition.taxRate);

    const invoice = await Invoice.findOneAndUpdate(
      {
        clientId: clientByKey[definition.clientKey]._id,
        caseId: caseByKey[definition.caseKey]._id,
        issueDate: d(definition.issueDate),
      },
      {
        $set: {
          clientId: clientByKey[definition.clientKey]._id,
          caseId: caseByKey[definition.caseKey]._id,
          periodStart: d(definition.periodStart),
          periodEnd: d(definition.periodEnd),
          issueDate: d(definition.issueDate),
          dueDate: d(definition.dueDate),
          currency: 'INR',
          subtotal,
          tax,
          total: roundMoney(subtotal + tax),
          status: definition.status,
          createdBy: userByKey[definition.createdByKey]._id,
          items,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );
    invoiceByKey[definition.key] = invoice;

    const validTimeEntryIds = [];
    for (const { workItem, timeEntry } of billableItems) {
      validTimeEntryIds.push(timeEntry._id);
      await InvoiceLine.findOneAndUpdate(
        { invoiceId: invoice._id, timeEntryId: timeEntry._id },
        {
          $set: {
            invoiceId: invoice._id,
            timeEntryId: timeEntry._id,
            description: workItem.narrative,
            qtyHours: hoursFor(workItem.durationMinutes),
            rate: workItem.rateApplied,
            amount: workItem.amount,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
      );
      const timeEntryStatus = definition.status === 'paid'
        ? 'paid'
        : ['sent', 'partial', 'overdue'].includes(definition.status)
          ? 'billed'
          : 'approved';
      await TimeEntry.findByIdAndUpdate(timeEntry._id, {
        $set: {
          status: timeEntryStatus,
        },
      });
    }

    await InvoiceLine.deleteMany({
      invoiceId: invoice._id,
      timeEntryId: { $nin: validTimeEntryIds },
    });

    for (const item of billableItems) {
      await Billable.findByIdAndUpdate(item.billable._id, {
        $set: {
          invoiceId: invoice._id,
        },
      });
    }

    for (const paymentDefinition of definition.payments || []) {
      const amount = paymentDefinition.amount === 'invoice-total'
        ? invoice.total
        : paymentDefinition.amount;
      await Payment.findOneAndUpdate(
        { invoiceId: invoice._id, reference: paymentDefinition.reference },
        {
          $set: {
            invoiceId: invoice._id,
            amount: roundMoney(amount),
            method: paymentDefinition.method,
            receivedDate: d(paymentDefinition.receivedDate),
            reference: paymentDefinition.reference,
            status: paymentDefinition.status || 'cleared',
            receivedBy: userByKey[paymentDefinition.receivedByKey]?._id,
            notes: paymentDefinition.notes || 'Seeded demo payment',
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
      );
    }
  }

  return invoiceByKey;
}

async function upsertKpiSnapshot({ scope, scopeId, month, utilization, realization, WIP, AR, revenue }) {
  await KpiSnapshot.findOneAndUpdate(
    { scope, scopeId, month },
    {
      $set: {
        scope,
        scopeId,
        month,
        utilization,
        realization,
        WIP,
        AR,
        revenue,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );
}

async function seedKpis(firm, userByKey, clientByKey, caseByKey) {
  for (const definition of kpiDefinitions) {
    await upsertKpiSnapshot({ scope: 'firm', scopeId: firm._id, ...definition });
    await upsertKpiSnapshot({
      scope: 'user',
      scopeId: userByKey.karan._id,
      month: definition.month,
      utilization: Math.max(45, definition.utilization - 8),
      realization: Math.max(60, definition.realization - 6),
      WIP: roundMoney(definition.WIP * 0.32),
      AR: roundMoney(definition.AR * 0.45),
      revenue: roundMoney(definition.revenue * 0.28),
    });
    await upsertKpiSnapshot({
      scope: 'user',
      scopeId: userByKey.ananya._id,
      month: definition.month,
      utilization: Math.min(95, definition.utilization + 4),
      realization: Math.min(100, definition.realization + 2),
      WIP: roundMoney(definition.WIP * 0.38),
      AR: roundMoney(definition.AR * 0.25),
      revenue: roundMoney(definition.revenue * 0.34),
    });
    await upsertKpiSnapshot({
      scope: 'user',
      scopeId: userByKey.priya._id,
      month: definition.month,
      utilization: Math.min(95, definition.utilization + 9),
      realization: Math.min(100, definition.realization + 4),
      WIP: roundMoney(definition.WIP * 0.26),
      AR: roundMoney(definition.AR * 0.2),
      revenue: roundMoney(definition.revenue * 0.3),
    });
  }

  for (const definition of clientKpiDefinitions) {
    await upsertKpiSnapshot({
      scope: 'client',
      scopeId: clientByKey[definition.clientKey]._id,
      month: definition.month,
      utilization: definition.utilization,
      realization: definition.realization,
      WIP: definition.WIP,
      AR: definition.AR,
      revenue: definition.revenue,
    });
  }

  for (const definition of caseKpiDefinitions) {
    await upsertKpiSnapshot({
      scope: 'case',
      scopeId: caseByKey[definition.caseKey]._id,
      month: definition.month,
      utilization: definition.utilization,
      realization: definition.realization,
      WIP: definition.WIP,
      AR: definition.AR,
      revenue: definition.revenue,
    });
  }
}

async function seed() {
  applyInvoiceAmountTargets();
  await connectDB();

  const firm = await seedFirm();
  const userByKey = await seedUsers(firm);
  const clientByKey = await seedClients(firm, userByKey);
  const caseByKey = await seedCases(firm, clientByKey, userByKey);
  await seedRateCards(caseByKey, userByKey);
  const workArtifacts = await seedWorkItems(clientByKey, caseByKey, userByKey);
  await seedEmailEntries(clientByKey, caseByKey, userByKey, workArtifacts);
  const invoiceByKey = await seedInvoices(
    clientByKey,
    caseByKey,
    userByKey,
    workArtifacts.billableByKey,
    workArtifacts.timeEntryByKey
  );
  await seedKpis(firm, userByKey, clientByKey, caseByKey);

  console.log('Veeresh demo seed complete');
  console.table(
    userDefinitions.map((user) => ({
      name: user.name,
      role: user.role,
      mobile: user.mobile,
      password: DEMO_PASSWORD,
    }))
  );
  console.log('Seeded summary:', {
    firm: firm.name,
    users: Object.keys(userByKey).length,
    clients: Object.keys(clientByKey).length,
    cases: Object.keys(caseByKey).length,
    invoices: Object.keys(invoiceByKey).length,
  });
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

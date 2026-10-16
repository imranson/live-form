// Wigan's hardest-to-fill job sectors. Order = priority (used to break ties).
// Evidence is summarised from Wigan Council and Greater Manchester Chamber (LSIP) sources;
// review against the latest local labour-market data before any live use.

export const SECTOR_IDS = [
  'health-social-care',
  'construction',
  'engineering-manufacturing',
  'logistics',
  'education-childcare',
  'digital',
  'hospitality',
] as const;

export type SectorId = (typeof SECTOR_IDS)[number];

export interface Role {
  title: string;
  entry: string;
}

export interface Sector {
  id: SectorId;
  name: string;
  shortName: string;
  emoji: string;
  color: string;
  blurb: string;
  roles: Role[];
  evidence: string;
  evidenceUrl: string;
}

export const SECTORS: readonly Sector[] = [
  {
    id: 'health-social-care',
    name: 'Health & Social Care',
    shortName: 'Care',
    emoji: '🩺',
    color: '#c2185b',
    blurb: 'Help people live well – at home, in the community or in hospital.',
    roles: [
      { title: 'Care worker / support worker', entry: 'No qualifications needed – full training on the job' },
      { title: 'Healthcare assistant', entry: 'On-the-job training, Care Certificate' },
      { title: 'Mental health nurse', entry: 'Degree or nursing degree apprenticeship' },
    ],
    evidence: 'Greater Manchester employers report an urgent need for nurses and a chronic shortage of care workers.',
    evidenceUrl: 'https://www.wigan.gov.uk/Resident/Jobs-Careers/Care-to-join-us/index.aspx',
  },
  {
    id: 'construction',
    name: 'Construction & Green Trades',
    shortName: 'Construction',
    emoji: '🏗️',
    color: '#e65100',
    blurb: 'Build, fix and retrofit the homes and places Wigan needs.',
    roles: [
      { title: 'Electrician', entry: 'Apprenticeship or college course' },
      { title: 'Joiner / carpenter', entry: 'Apprenticeship or college course' },
      { title: 'Retrofit installer (heat pumps, insulation)', entry: 'Short courses and Skills Bootcamps' },
    ],
    evidence: 'Construction vacancies in Wigan rose by 40% in two years; the North West needs an extra 25,400 workers.',
    evidenceUrl: 'https://www.wigan.gov.uk/Resident/Jobs-Careers/Believe-in-your-Future/Construction.aspx',
  },
  {
    id: 'engineering-manufacturing',
    name: 'Engineering & Manufacturing',
    shortName: 'Engineering',
    emoji: '⚙️',
    color: '#455a64',
    blurb: 'Make, maintain and improve the products Wigan sends round the world.',
    roles: [
      { title: 'Maintenance engineer', entry: 'Engineering apprenticeship' },
      { title: 'Welder / fabricator', entry: 'College course or apprenticeship' },
      { title: 'Production operative', entry: 'Entry level – training provided' },
    ],
    evidence: 'Engineers are among the roles Wigan employers find hardest to fill; engineering is a named growth sector.',
    evidenceUrl: 'https://www.wigan.gov.uk/Docs/PDF/Resident/Jobs-Careers/Employability-and-skills-strategy.pdf',
  },
  {
    id: 'logistics',
    name: 'Logistics & Transport',
    shortName: 'Logistics',
    emoji: '🚚',
    color: '#1565c0',
    blurb: 'Keep goods moving along the M6 corridor – warehouses, depots and the open road.',
    roles: [
      { title: 'HGV / LGV driver', entry: 'Licence training (Skills Bootcamps can help)' },
      { title: 'Warehouse operative / forklift driver', entry: 'Entry level – licences trained on the job' },
      { title: 'Supply chain coordinator', entry: 'Experience or apprenticeship' },
    ],
    evidence: 'Logistics is a named growth sector for Wigan, and delivery drivers are in high demand across Greater Manchester.',
    evidenceUrl: 'https://www.wigan.gov.uk/Docs/PDF/Resident/Jobs-Careers/Employability-and-skills-strategy.pdf',
  },
  {
    id: 'education-childcare',
    name: 'Education & Childcare',
    shortName: 'Childcare',
    emoji: '🧸',
    color: '#6a1b9a',
    blurb: 'Give Wigan’s children the best start – nurseries, schools and SEND support.',
    roles: [
      { title: 'Early years practitioner', entry: 'Level 2/3 childcare qualification or apprenticeship' },
      { title: 'Teaching assistant (incl. SEND)', entry: 'Adult learning course or apprenticeship' },
      { title: 'Teacher', entry: 'Degree plus teacher training' },
    ],
    evidence: 'Teachers and childcare staff are on Greater Manchester’s high-demand list; the council is actively recruiting childcare workers.',
    evidenceUrl: 'https://www.wigan.gov.uk/Resident/Jobs-Careers/Childcare-careers.aspx',
  },
  {
    id: 'digital',
    name: 'Digital & Tech',
    shortName: 'Digital',
    emoji: '💻',
    color: '#00838f',
    blurb: 'Fix, build and protect the tech every business now runs on.',
    roles: [
      { title: 'IT support technician', entry: 'Short course or apprenticeship' },
      { title: 'Junior software developer', entry: 'Skills Bootcamp, apprenticeship or degree' },
      { title: 'Data / cyber security analyst', entry: 'Skills Bootcamp or apprenticeship' },
    ],
    evidence: 'Digital is expected to grow in both output and jobs in Wigan.',
    evidenceUrl: 'https://www.wigan.gov.uk/Docs/PDF/Resident/Jobs-Careers/Employability-and-skills-strategy.pdf',
  },
  {
    id: 'hospitality',
    name: 'Hospitality & Food',
    shortName: 'Hospitality',
    emoji: '🍽️',
    color: '#2e7d32',
    blurb: 'Feed and welcome people – kitchens, cafés, venues and events.',
    roles: [
      { title: 'Chef / cook', entry: 'Learn on the job or a college course' },
      { title: 'Kitchen assistant', entry: 'Entry level – no experience needed' },
      { title: 'Front-of-house / events', entry: 'Entry level – customer skills matter most' },
    ],
    evidence: 'Hospitality is one of the sectors with occupations classed as “in high demand” in Greater Manchester.',
    evidenceUrl: 'https://www.gmchamber.co.uk/posts/greater-manchester-skills-plan-launched-to-train-people-for-work',
  },
];

const byId = new Map(SECTORS.map((s) => [s.id, s]));

export function getSector(id: SectorId): Sector {
  const sector = byId.get(id);
  if (!sector) throw new Error(`Unknown sector: ${id}`);
  return sector;
}

export function isSectorId(value: unknown): value is SectorId {
  return typeof value === 'string' && byId.has(value as SectorId);
}

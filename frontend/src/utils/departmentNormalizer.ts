export interface CanonicalDepartment {
  id: string;
  code: string;
  name: string;
  fullName: string;
}

export const CANONICAL_DEPARTMENTS: Record<string, CanonicalDepartment> = {
  '1': { id: '1', code: 'PWD', name: 'Public Works Department', fullName: 'Public Works Department (PWD)' },
  '2': { id: '2', code: 'SAN', name: 'Sanitation & Waste', fullName: 'Sanitation & Waste Management' },
  '3': { id: '3', code: 'WTR', name: 'Water Supply', fullName: 'Water Supply & Sewerage Board' },
  '4': { id: '4', code: 'DRN', name: 'Drainage & Sewage', fullName: 'Drainage & Sewage Department' },
  '5': { id: '5', code: 'ELE', name: 'Electrical & Lighting', fullName: 'Electrical & Street Lighting' },
  '6': { id: '6', code: 'TRF', name: 'Traffic Management', fullName: 'Traffic Management Department' },
  '7': { id: '7', code: 'MNT', name: 'Maintenance', fullName: 'Maintenance Department' }
};

export function normalizeDepartment(identifier?: string | number | null): CanonicalDepartment {
  if (!identifier) {
    return { id: '0', code: 'UNASSIGNED', name: 'Unassigned', fullName: 'Unassigned Department' };
  }

  const str = String(identifier).trim();
  const lower = str.toLowerCase();

  // 1. Direct ID match ('1' through '7')
  if (CANONICAL_DEPARTMENTS[str]) {
    return CANONICAL_DEPARTMENTS[str];
  }

  // 2. Search by code or keyword match
  if (lower.includes('pwd') || lower.includes('public works') || lower.includes('road') || lower.includes('pothole') || lower.includes('dept-1')) {
    return CANONICAL_DEPARTMENTS['1'];
  }
  if (lower.includes('san') || lower.includes('sanitation') || lower.includes('waste') || lower.includes('garbage') || lower.includes('dept-2')) {
    return CANONICAL_DEPARTMENTS['2'];
  }
  if (lower.includes('wtr') || lower.includes('water') || lower.includes('sewer') || lower.includes('pipeline') || lower.includes('dept-3')) {
    return CANONICAL_DEPARTMENTS['3'];
  }
  if (lower.includes('drn') || lower.includes('drain') || lower.includes('sewage') || lower.includes('monsoon') || lower.includes('dept-4')) {
    return CANONICAL_DEPARTMENTS['4'];
  }
  if (lower.includes('ele') || lower.includes('electric') || lower.includes('light') || lower.includes('pole') || lower.includes('dept-5')) {
    return CANONICAL_DEPARTMENTS['5'];
  }
  if (lower.includes('trf') || lower.includes('traffic') || lower.includes('signal') || lower.includes('signage') || lower.includes('dept-6')) {
    return CANONICAL_DEPARTMENTS['6'];
  }
  if (lower.includes('mnt') || lower.includes('maintenance') || lower.includes('repair') || lower.includes('dept-7')) {
    return CANONICAL_DEPARTMENTS['7'];
  }

  return { id: '0', code: 'UNASSIGNED', name: str, fullName: str };
}

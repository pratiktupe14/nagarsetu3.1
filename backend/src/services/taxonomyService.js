/**
 * NAGARSETU 3.1 — Controlled Civic Issue Taxonomy & Department Routing Engine
 */

const CONTROLLED_TAXONOMY = {
  ROADS: {
    code: 'PWD',
    departmentName: 'Public Works Department (PWD)',
    canonicalCategory: 'Road Damage / Pothole',
    issues: [
      'pothole',
      'road_damage',
      'broken_road',
      'damaged_footpath',
      'road_crack',
      'missing_road_sign',
      'asphalt_crater',
      'pavement_failure'
    ]
  },
  WASTE: {
    code: 'SAN',
    departmentName: 'Sanitation & Waste Management',
    canonicalCategory: 'Garbage / Waste',
    issues: [
      'garbage',
      'garbage_accumulation',
      'overflowing_bin',
      'illegal_dumping',
      'waste_collection_issue',
      'solid_waste',
      'uncollected_trash'
    ]
  },
  ELECTRICAL: {
    code: 'ELE',
    departmentName: 'Electrical & Street Lighting',
    canonicalCategory: 'Streetlight / Electrical',
    issues: [
      'broken_streetlight',
      'streetlight_not_working',
      'electrical_issue',
      'exposed_wire',
      'damaged_lamp_post',
      'power_line_defect'
    ]
  },
  WATER: {
    code: 'WTR',
    departmentName: 'Water Supply & Sewerage Board',
    canonicalCategory: 'Water Leakage / Pipeline',
    issues: [
      'water_leak',
      'pipe_leak',
      'water_supply_issue',
      'water_wastage',
      'pipeline_burst',
      'broken_water_line'
    ]
  },
  DRAINAGE: {
    code: 'DRN',
    departmentName: 'Drainage & Sewage Department',
    canonicalCategory: 'Drainage / Sewage',
    issues: [
      'blocked_drain',
      'overflowing_drain',
      'sewer_issue',
      'drainage_issue',
      'choked_gutter',
      'open_manhole',
      'stagnant_sewage'
    ]
  },
  TRAFFIC: {
    code: 'TRF',
    departmentName: 'Traffic Management Department',
    canonicalCategory: 'Traffic Infrastructure',
    issues: [
      'damaged_traffic_signal',
      'broken_sign',
      'traffic_infrastructure',
      'signal_malfunction'
    ]
  },
  MAINTENANCE: {
    code: 'MNT',
    departmentName: 'Maintenance Department',
    canonicalCategory: 'Public Infrastructure Damage',
    issues: [
      'public_facility_damage',
      'footpath_paver_damage',
      'railing_damage',
      'other_civic_issue'
    ]
  }
};

/**
 * Normalizes raw AI responses or user input strings into a controlled canonical category.
 */
function normalizeCategory(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return 'Other Civic Issue';
  }

  const str = rawInput.trim().toLowerCase();

  // Check exact canonical category matches
  for (const key of Object.keys(CONTROLLED_TAXONOMY)) {
    const tax = CONTROLLED_TAXONOMY[key];
    if (tax.canonicalCategory.toLowerCase() === str) {
      return tax.canonicalCategory;
    }
  }

  // Keyword matching against taxonomy issues and strings
  if (
    str.includes('pothole') ||
    str.includes('road') ||
    str.includes('asphalt') ||
    str.includes('footpath') ||
    str.includes('crater') ||
    str.includes('pavement')
  ) {
    return CONTROLLED_TAXONOMY.ROADS.canonicalCategory;
  }

  if (
    str.includes('garbage') ||
    str.includes('waste') ||
    str.includes('trash') ||
    str.includes('dumping') ||
    str.includes('bin') ||
    str.includes('refuse') ||
    str.includes('litter')
  ) {
    return CONTROLLED_TAXONOMY.WASTE.canonicalCategory;
  }

  if (
    str.includes('water') ||
    str.includes('pipeline') ||
    str.includes('pipe') ||
    str.includes('leak')
  ) {
    // Distinguish water leak vs drainage overflow
    if (str.includes('sew') || str.includes('drain') || str.includes('gutter') || str.includes('manhole')) {
      return CONTROLLED_TAXONOMY.DRAINAGE.canonicalCategory;
    }
    return CONTROLLED_TAXONOMY.WATER.canonicalCategory;
  }

  if (
    str.includes('drain') ||
    str.includes('sew') ||
    str.includes('gutter') ||
    str.includes('manhole') ||
    str.includes('culvert')
  ) {
    return CONTROLLED_TAXONOMY.DRAINAGE.canonicalCategory;
  }

  if (
    str.includes('street') ||
    str.includes('light') ||
    str.includes('elec') ||
    str.includes('wire') ||
    str.includes('lamp')
  ) {
    return CONTROLLED_TAXONOMY.ELECTRICAL.canonicalCategory;
  }

  if (str.includes('traffic') || str.includes('signal') || str.includes('sign')) {
    return CONTROLLED_TAXONOMY.TRAFFIC.canonicalCategory;
  }

  if (str.includes('railing') || str.includes('infra') || str.includes('building') || str.includes('paver')) {
    return CONTROLLED_TAXONOMY.MAINTENANCE.canonicalCategory;
  }

  return 'Other Civic Issue';
}

/**
 * Returns department details (code and department name) for a normalized canonical category.
 */
function getDepartmentForCategory(canonicalCategory) {
  const norm = normalizeCategory(canonicalCategory);

  for (const key of Object.keys(CONTROLLED_TAXONOMY)) {
    const tax = CONTROLLED_TAXONOMY[key];
    if (tax.canonicalCategory === norm) {
      return {
        code: tax.code,
        name: tax.departmentName,
        category: tax.canonicalCategory
      };
    }
  }

  return {
    code: CONTROLLED_TAXONOMY.MAINTENANCE.code,
    name: CONTROLLED_TAXONOMY.MAINTENANCE.departmentName,
    category: 'Other Civic Issue'
  };
}

/**
 * Maps raw specific issue string to standardized specific issue tag.
 */
function normalizeSpecificIssue(rawSpecificIssue, category) {
  if (!rawSpecificIssue || typeof rawSpecificIssue !== 'string') {
    const deptInfo = getDepartmentForCategory(category);
    return deptInfo.category.toLowerCase().replace(/[\s\/]+/g, '_');
  }

  const clean = rawSpecificIssue.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return clean || 'civic_defect';
}

module.exports = {
  CONTROLLED_TAXONOMY,
  normalizeCategory,
  getDepartmentForCategory,
  normalizeSpecificIssue
};

/**
 * 4-Quadrant Risk Matrix Service for NagarSetu
 *
 * Quadrants (0 to 3 each):
 * 1. safety_score: Immediate Threat to Human Safety & Life
 * 2. disruption_score: Scale of Public Disruption
 * 3. health_environment_score: Public Health & Environmental Hazard
 * 4. defect_severity_score: Defect Severity / Physical Depth
 */

function clampScore(score) {
  const num = Number(score);
  if (isNaN(num)) return 0;
  return Math.max(0, Math.min(3, Math.round(num)));
}

/**
 * Infer safe default 4-quadrant scores if not explicitly provided
 */
function inferRiskScores(data = {}) {
  // If scores already provided, clamp them
  if (
    data.safety_score !== undefined ||
    data.disruption_score !== undefined ||
    data.health_environment_score !== undefined ||
    data.defect_severity_score !== undefined
  ) {
    return {
      safety_score: clampScore(data.safety_score || 0),
      disruption_score: clampScore(data.disruption_score || 0),
      health_environment_score: clampScore(data.health_environment_score || 0),
      defect_severity_score: clampScore(data.defect_severity_score || 0)
    };
  }

  // Infer from category, priority, and AI vision
  const category = (data.category || '').toLowerCase();
  const priority = (data.priority || '').toLowerCase();
  const evidence = (data.ai_evidence || data.description || '').toLowerCase();

  let safety = 1;
  let disruption = 1;
  let health = 0;
  let defect = 1;

  if (category.includes('electric') || category.includes('wire') || evidence.includes('live wire') || evidence.includes('shock')) {
    safety = 3;
    disruption = 1;
    defect = 2;
  } else if (category.includes('road') || category.includes('pothole') || category.includes('bridge')) {
    safety = priority === 'critical' ? 3 : (priority === 'high' ? 2 : 1);
    disruption = priority === 'critical' ? 3 : (priority === 'high' ? 2 : 1);
    defect = priority === 'critical' ? 3 : (priority === 'high' ? 2 : 1);
  } else if (category.includes('water') || category.includes('pipeline') || category.includes('leak')) {
    disruption = priority === 'critical' ? 3 : 2;
    health = priority === 'critical' ? 2 : 1;
    defect = 2;
  } else if (category.includes('drain') || category.includes('sewag') || category.includes('gutter')) {
    health = 3;
    safety = priority === 'critical' ? 2 : 1;
    disruption = 2;
    defect = 2;
  } else if (category.includes('garbage') || category.includes('waste') || category.includes('sanitat')) {
    health = priority === 'critical' ? 3 : (priority === 'high' ? 2 : 1);
    disruption = 1;
    defect = 1;
  } else if (category.includes('traffic') || category.includes('signal')) {
    safety = 2;
    disruption = 3;
    defect = 1;
  }

  if (priority === 'critical') {
    safety = Math.max(safety, 2);
    defect = Math.max(defect, 2);
  }

  return {
    safety_score: clampScore(safety),
    disruption_score: clampScore(disruption),
    health_environment_score: clampScore(health),
    defect_severity_score: clampScore(defect)
  };
}

/**
 * Calculate 4-quadrant risk matrix, total score, severity, and priority rank
 *
 * @param {Object} input
 * @returns {Object} { safety_score, disruption_score, health_environment_score, defect_severity_score, risk_score, severity, priority_rank, support_weight, overdue_weight }
 */
function calculateRiskAssessment(input = {}) {
  const scores = inferRiskScores(input);

  const safety = clampScore(scores.safety_score);
  const disruption = clampScore(scores.disruption_score);
  const health = clampScore(scores.health_environment_score);
  const defect = clampScore(scores.defect_severity_score);

  // Total Risk Score: 0 to 12
  const risk_score = safety + disruption + health + defect;

  // Base Severity Mapping
  let severity = 'LOW';
  if (risk_score >= 9) {
    severity = 'CRITICAL';
  } else if (risk_score >= 6) {
    severity = 'HIGH';
  } else if (risk_score >= 3) {
    severity = 'MEDIUM';
  } else {
    severity = 'LOW';
  }

  // Safety Override Rules:
  // 1. If safety_score === 3, minimum final severity must be HIGH
  if (safety === 3) {
    if (severity === 'LOW' || severity === 'MEDIUM') {
      severity = 'HIGH';
    }

    // 2. If safety_score === 3 AND any other quadrant >= 2, severity is CRITICAL
    if (disruption >= 2 || health >= 2 || defect >= 2) {
      severity = 'CRITICAL';
    }
  }

  // Priority Rank: (risk_score * 10) + support_weight + overdue_weight
  const rawSupport = Number(input.support_count !== undefined ? input.support_count : 1);
  const support_count = isNaN(rawSupport) || rawSupport < 1 ? 1 : rawSupport;
  const support_weight = Math.min(Math.max(support_count, 1), 10);

  const isOverdue = Boolean(input.is_overdue || (input.sla_deadline && new Date(input.sla_deadline).getTime() < Date.now()));
  const overdue_weight = isOverdue ? 10 : 0;

  const priority_rank = (risk_score * 10) + support_weight + overdue_weight;

  return {
    safety_score: safety,
    disruption_score: disruption,
    health_environment_score: health,
    defect_severity_score: defect,
    risk_score,
    severity, // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    priority_rank,
    support_weight,
    overdue_weight
  };
}

module.exports = {
  clampScore,
  inferRiskScores,
  calculateRiskAssessment
};

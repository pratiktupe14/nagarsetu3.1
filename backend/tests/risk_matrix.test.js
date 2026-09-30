const test = require('node:test');
const assert = require('node:assert');
const {
  clampScore,
  calculateRiskScore,
  determineSeverity,
  calculatePriorityRank,
  calculateRiskAssessment,
  inferRiskScores
} = require('../src/services/riskMatrixService');

test('1. 0,0,1,1 -> risk = 2 -> LOW', () => {
  const result = calculateRiskAssessment({
    safety_score: 0,
    disruption_score: 0,
    health_environment_score: 1,
    defect_severity_score: 1
  });
  assert.strictEqual(result.risk_score, 2);
  assert.strictEqual(result.severity, 'LOW');
});

test('2. 1,1,1,1 -> risk = 4 -> MEDIUM', () => {
  const result = calculateRiskAssessment({
    safety_score: 1,
    disruption_score: 1,
    health_environment_score: 1,
    defect_severity_score: 1
  });
  assert.strictEqual(result.risk_score, 4);
  assert.strictEqual(result.severity, 'MEDIUM');
});

test('3. 2,2,1,2 -> risk = 7 -> HIGH', () => {
  const result = calculateRiskAssessment({
    safety_score: 2,
    disruption_score: 2,
    health_environment_score: 1,
    defect_severity_score: 2
  });
  assert.strictEqual(result.risk_score, 7);
  assert.strictEqual(result.severity, 'HIGH');
});

test('4. 3,2,2,2 -> risk = 9 -> CRITICAL', () => {
  const result = calculateRiskAssessment({
    safety_score: 3,
    disruption_score: 2,
    health_environment_score: 2,
    defect_severity_score: 2
  });
  assert.strictEqual(result.risk_score, 9);
  assert.strictEqual(result.severity, 'CRITICAL');
});

test('5. safety = 3, others = 0 -> minimum HIGH', () => {
  const result = calculateRiskAssessment({
    safety_score: 3,
    disruption_score: 0,
    health_environment_score: 0,
    defect_severity_score: 0
  });
  assert.strictEqual(result.risk_score, 3);
  assert.strictEqual(result.severity, 'HIGH');
});

test('6. safety = 3, one other >= 2 -> CRITICAL', () => {
  const result = calculateRiskAssessment({
    safety_score: 3,
    disruption_score: 2,
    health_environment_score: 0,
    defect_severity_score: 0
  });
  assert.strictEqual(result.risk_score, 5);
  assert.strictEqual(result.severity, 'CRITICAL');
});

test('7. same severity but higher support_count -> higher priority_rank', () => {
  const compA = calculateRiskAssessment({
    safety_score: 2,
    disruption_score: 2,
    health_environment_score: 1,
    defect_severity_score: 2,
    support_count: 1
  });
  const compB = calculateRiskAssessment({
    safety_score: 2,
    disruption_score: 2,
    health_environment_score: 1,
    defect_severity_score: 2,
    support_count: 5
  });

  assert.strictEqual(compA.severity, compB.severity);
  assert.strictEqual(compA.risk_score, compB.risk_score);
  assert.ok(compB.priority_rank > compA.priority_rank, `Expected ${compB.priority_rank} > ${compA.priority_rank}`);
});

test('8. overdue complaint -> priority rank increases', () => {
  const onTime = calculateRiskAssessment({
    safety_score: 1,
    disruption_score: 1,
    health_environment_score: 1,
    defect_severity_score: 1,
    support_count: 2,
    is_overdue: false
  });
  const overdue = calculateRiskAssessment({
    safety_score: 1,
    disruption_score: 1,
    health_environment_score: 1,
    defect_severity_score: 1,
    support_count: 2,
    is_overdue: true
  });

  assert.strictEqual(overdue.risk_score, onTime.risk_score);
  assert.strictEqual(overdue.priority_rank, onTime.priority_rank + 10);
});

test('9. invalid AI score above 3/below 0 -> clamp safely', () => {
  assert.strictEqual(clampScore(99), 3);
  assert.strictEqual(clampScore(-5), 0);
  assert.strictEqual(clampScore('invalid'), 0);

  const clamped = calculateRiskAssessment({
    safety_score: 10,
    disruption_score: -3,
    health_environment_score: 5,
    defect_severity_score: -1
  });
  assert.strictEqual(clamped.safety_score, 3);
  assert.strictEqual(clamped.disruption_score, 0);
  assert.strictEqual(clamped.health_environment_score, 3);
  assert.strictEqual(clamped.defect_severity_score, 0);
  assert.strictEqual(clamped.risk_score, 6);
});

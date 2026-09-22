const { query } = require('../config/db');

/**
 * Calculates the SLA deadline and escalation details based on the priority policy.
 * @param {string} priority - The priority level (e.g. Critical, High, Medium, Low)
 * @param {Date} [baseDate] - The base date to calculate from (defaults to now)
 * @returns {Promise<{resolveHours: number, escalationHours: number, slaDeadline: Date}>}
 */
async function calculateSla(priority, baseDate = new Date()) {
  const normPriority = (priority || 'Medium').trim();
  
  const res = await query(
    `SELECT resolve_hours, escalation_hours FROM sla_policies WHERE UPPER(priority) = UPPER($1)`,
    [normPriority]
  );
  
  if (!res.rows || res.rows.length === 0) {
    throw new Error(`SLA policy not found for priority: ${normPriority}`);
  }

  const policy = res.rows[0];

  const resolveHours = parseInt(policy.resolve_hours);
  const escalationHours = parseInt(policy.escalation_hours);

  if (isNaN(resolveHours) || isNaN(escalationHours)) {
    throw new Error(`Malformed SLA policy data for priority: ${normPriority}`);
  }

  const slaDeadline = new Date(baseDate.getTime() + resolveHours * 3600000);

  return {
    resolveHours,
    escalationHours,
    slaDeadline
  };
}

module.exports = {
  calculateSla
};

const cleanAndSyncDepartmentHeads = require('./cleanAndSyncDepartmentHeads');

async function seed7DemoDepartmentHeads() {
  return await cleanAndSyncDepartmentHeads();
}

module.exports = seed7DemoDepartmentHeads;

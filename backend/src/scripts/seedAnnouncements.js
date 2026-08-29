const { query } = require('../config/db');

async function seedAnnouncements() {
  console.log('Seeding initial demo announcements into NAGARSETU database...');
  try {
    const existing = await query('SELECT COUNT(*) as count FROM announcements');
    const count = parseInt(existing.rows[0].count, 10);
    if (count > 0) {
      console.log(`Announcements table already contains ${count} announcements. Skipping seed.`);
      return;
    }

    const items = [
      {
        title: 'Municipal Monsoon Preparedness & High Alert Protocol',
        description: 'All municipal departments must ensure 24/7 emergency response teams, de-watering pumps, and rapid deployment vehicles are fully operational across Nashik city.',
        type: 'Emergency',
        priority: 'Critical',
        target_type: 'all',
        department_id: null,
        department_name: 'All Departments',
        posted_by: 'City Admin'
      },
      {
        title: 'NAGARSETU 3.1 Portal Real-Time GIS Tracking Upgrade',
        description: 'The municipal software platform has been updated with automatic task routing, live staff location tracking, and instant citizen status notifications.',
        type: 'System Update',
        priority: 'General',
        target_type: 'all',
        department_id: null,
        department_name: 'All Departments',
        posted_by: 'City Admin'
      },
      {
        title: 'Ward 5 Road Resurfacing & Heavy Pothole Patching Schedule',
        description: 'PWD asphalt machinery and road maintenance crews will execute asphalt resurfacing along Ward 5 arterial roads starting Monday 08:00 AM.',
        type: 'Maintenance',
        priority: 'Important',
        target_type: 'department',
        department_id: 1,
        department_name: 'Public Works Department (PWD)',
        posted_by: 'City Admin'
      },
      {
        title: 'Commercial Waste Segregation & Illegal Dumping Audit',
        description: 'Sanitation supervisors must conduct strict zero-tolerance inspections at commercial market centers and enforce segregation norms.',
        type: 'Urgent',
        priority: 'High',
        target_type: 'department',
        department_id: 2,
        department_name: 'Sanitation & Waste Management',
        posted_by: 'City Admin'
      },
      {
        title: 'Gangapur Feeder Pipeline Valve Servicing & Pressure Test',
        description: 'Scheduled maintenance on primary water feeder line. Water supply pressure optimization and leak detection checks underway.',
        type: 'Maintenance',
        priority: 'Important',
        target_type: 'department',
        department_id: 3,
        department_name: 'Water Supply & Sewerage Board',
        posted_by: 'City Admin'
      },
      {
        title: 'High-Volume Storm Drain Desilting & Culvert Clearing',
        description: 'Drainage field staff are deployed to clear major storm drains and culverts in low-lying zones prior to heavy rainfall forecast.',
        type: 'Urgent',
        priority: 'High',
        target_type: 'department',
        department_id: 4,
        department_name: 'Drainage & Sewage Department',
        posted_by: 'City Admin'
      },
      {
        title: 'Smart LED Streetlight Automation & Controller Upgrade Phase II',
        description: 'Deployment of automated photocell streetlight controllers and replacement of failed fixtures on major highway stretches.',
        type: 'System Update',
        priority: 'Medium',
        target_type: 'department',
        department_id: 5,
        department_name: 'Electrical & Street Lighting',
        posted_by: 'City Admin'
      },
      {
        title: 'Central Junction Smart Signal Sensor & Camera Calibration',
        description: 'Traffic engineering team to coordinate with Nashik Traffic Police for dynamic signal timing adjustments at key congested intersections.',
        type: 'General',
        priority: 'Medium',
        target_type: 'department',
        department_id: 6,
        department_name: 'Traffic Management Department',
        posted_by: 'City Admin'
      },
      {
        title: 'Municipal Building Facility & HVAC Quarterly Audit',
        description: 'Maintenance supervisors are requested to complete structural, electrical, and HVAC equipment safety reviews for all municipal ward offices.',
        type: 'Maintenance',
        priority: 'Medium',
        target_type: 'department',
        department_id: 7,
        department_name: 'Maintenance Department',
        posted_by: 'City Admin'
      }
    ];

    for (const item of items) {
      await query(
        `INSERT INTO announcements (title, description, type, priority, target_type, department_id, department_name, posted_by, is_published)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)`,
        [item.title, item.description, item.type, item.priority, item.target_type, item.department_id, item.department_name, item.posted_by]
      );
    }
    console.log(`Successfully seeded ${items.length} initial announcements!`);
  } catch (err) {
    console.error('Error seeding announcements:', err);
  }
}

if (require.main === module) {
  const { initDatabase } = require('../config/db');
  initDatabase().then(() => seedAnnouncements()).then(() => process.exit(0));
}

module.exports = seedAnnouncements;

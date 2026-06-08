const knex = require('knex');
const path = require('path');
const os = require('os');

let db = null;

async function getDb() {
  if (db) return db;
  
  const databaseUrl = process.env.DATABASE_URL;
  let isPostgres = databaseUrl && databaseUrl.includes('postgresql');

  if (isPostgres) {
    try {
      console.log('Attempting connection to PostgreSQL...');
      const pgDb = knex({
        client: 'pg',
        connection: databaseUrl,
        acquireConnectionTimeout: 3000
      });
      // Test the connection
      await pgDb.raw('SELECT 1+1 AS result');
      console.log('Connected to PostgreSQL database successfully.');
      db = pgDb;
    } catch (err) {
      console.warn('Failed to connect to PostgreSQL. Error:', err.message);
      console.warn('Falling back to local SQLite database.');
      isPostgres = false;
    }
  }

  if (!isPostgres) {
    const dbPath = path.join(os.tmpdir(), 'hr_automation.db');
    console.log(`Using SQLite fallback database at: ${dbPath}`);
    db = knex({
      client: 'sqlite3',
      connection: {
        filename: dbPath
      },
      useNullAsDefault: true
    });
  }

  // Initialize schemas
  await initializeSchema(db);
  return db;
}

async function initializeSchema(knexInstance) {
  // dashboard_jds table
  const hasJdsTable = await knexInstance.schema.hasTable('dashboard_jds');
  if (!hasJdsTable) {
    console.log('Creating table dashboard_jds...');
    await knexInstance.schema.createTable('dashboard_jds', table => {
      table.increments('id').primary();
      table.string('title').index();
      table.text('description_text');
      table.timestamp('timestamp').defaultTo(knexInstance.fn.now());
    });
  }

  // dashboard_candidates table
  const hasCandidatesTable = await knexInstance.schema.hasTable('dashboard_candidates');
  if (!hasCandidatesTable) {
    console.log('Creating table dashboard_candidates...');
    await knexInstance.schema.createTable('dashboard_candidates', table => {
      table.increments('id').primary();
      table.string('name').index();
      table.string('email').index();
      table.string('phone').nullable();
      table.string('job_role').index();
      table.integer('job_description_id').nullable();
      table.text('resume_text');
      table.integer('score');
      table.text('reason');
      table.text('skills_matched'); // Stored as JSON string
      table.text('missing_skills'); // Stored as JSON string
      table.string('status').defaultTo('Pending');
      table.string('meeting_link').nullable();
      table.string('meet_link').nullable();
      table.timestamp('timestamp').defaultTo(knexInstance.fn.now());
    });
  }
}

module.exports = { getDb };

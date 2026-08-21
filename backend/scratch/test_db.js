const { Client } = require('pg');

const passwords = [
  'postgres',
  'admin',
  'root',
  'password',
  '123456',
  'manoj',
  'Manoj',
  'manojs018',
  'Manojs018',
  '1234',
  '5432',
  '',
];

async function findPassword() {
  for (const pwd of passwords) {
    const client = new Client({
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: pwd,
      database: 'postgres',
    });

    try {
      await client.connect();
      console.log(`>>> SUCCESS! Correct password is: "${pwd}"`);
      await client.end();
      process.exit(0);
    } catch (err) {
      console.log(`Failed for password "${pwd}": ${err.message}`);
    }
  }
  console.log('>>> None of the common passwords worked.');
  process.exit(1);
}

findPassword();

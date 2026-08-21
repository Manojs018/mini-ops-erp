const { execSync } = require('child_process');

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
  'postgres123',
  'Postgres123',
  '12345678',
  'password123',
  'minerp',
  'min_erp',
];

for (const pwd of passwords) {
  const url = `postgresql://postgres:${encodeURIComponent(pwd)}@localhost:5432/postgres`;
  try {
    console.log(`Testing password "${pwd}"...`);
    execSync(`npx prisma db execute --url="${url}" --stdin`, {
      input: 'SELECT 1;',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    console.log(`\n==============================================`);
    console.log(`>>> SUCCESS! Correct password is: "${pwd}"`);
    console.log(`==============================================\n`);
    process.exit(0);
  } catch (err) {
    // Password failed
  }
}

console.log('>>> None of the tested passwords worked.');
process.exit(1);

import dotenv from 'dotenv';
dotenv.config();

console.log('=== Environment Variable Validation ===');
console.log('ZOHO_CLIENT_ID:', process.env.ZOHO_CLIENT_ID);
console.log('ZOHO_CLIENT_SECRET:', process.env.ZOHO_CLIENT_SECRET);
console.log('ZOHO_REDIRECT_URI:', process.env.ZOHO_REDIRECT_URI);
console.log('ZOHO_ACCOUNTS_SERVER:', process.env.ZOHO_ACCOUNTS_SERVER);

const requiredVars = [
  'ZOHO_CLIENT_ID',
  'ZOHO_CLIENT_SECRET',
  'ZOHO_REDIRECT_URI',
  'ZOHO_ACCOUNTS_SERVER',
];

let allValid = true;

for (const varName of requiredVars) {
  if (!process.env[varName]) {
    console.error(`Missing required environment variable: ${varName}`);
    allValid = false;
  } else if (process.env[varName].trim() === '') {
    console.error(`Empty value for required environment variable: ${varName}`);
    allValid = false;
  } else {
    console.log(`${varName}: OK`);
  }
}

if (allValid) {
  console.log('\nAll required environment variables are present and valid');
} else {
  console.log('\nSome required environment variables are missing or invalid');
}

if (process.env.ZOHO_REDIRECT_URI) {
  try {
    new URL(process.env.ZOHO_REDIRECT_URI);
    console.log('ZOHO_REDIRECT_URI is a valid URL');
  } catch (err) {
    console.error('ZOHO_REDIRECT_URI is not a valid URL:', err.message);
  }
}

if (process.env.ZOHO_ACCOUNTS_SERVER) {
  try {
    new URL(process.env.ZOHO_ACCOUNTS_SERVER);
    console.log('ZOHO_ACCOUNTS_SERVER is a valid URL');
  } catch (err) {
    console.error('ZOHO_ACCOUNTS_SERVER is not a valid URL:', err.message);
  }
}

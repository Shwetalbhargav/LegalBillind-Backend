import dotenv from 'dotenv';
dotenv.config();

console.log('=== Environment Variable Validation ===');
console.log('CLIO_CLIENT_ID:', process.env.CLIO_CLIENT_ID);
console.log('CLIO_CLIENT_SECRET:', process.env.CLIO_CLIENT_SECRET);
console.log('CLIO_REDIRECT_URI:', process.env.CLIO_REDIRECT_URI);
console.log('CLIO_API_BASE_URL:', process.env.CLIO_API_BASE_URL);

// Validate that the variables are not empty
const requiredVars = ['CLIO_CLIENT_ID', 'CLIO_CLIENT_SECRET', 'CLIO_REDIRECT_URI', 'CLIO_API_BASE_URL'];
let allValid = true;

for (const varName of requiredVars) {
  if (!process.env[varName]) {
    console.error(`❌ Missing required environment variable: ${varName}`);
    allValid = false;
  } else if (process.env[varName].trim() === '') {
    console.error(`❌ Empty value for required environment variable: ${varName}`);
    allValid = false;
  } else {
    console.log(`✅ ${varName}: OK`);
  }
}

if (allValid) {
  console.log('\n✅ All required environment variables are present and valid');
} else {
  console.log('\n❌ Some required environment variables are missing or invalid');
}

// Check redirect URI format
if (process.env.CLIO_REDIRECT_URI) {
  try {
    new URL(process.env.CLIO_REDIRECT_URI);
    console.log('✅ CLIO_REDIRECT_URI is a valid URL');
  } catch (err) {
    console.error('❌ CLIO_REDIRECT_URI is not a valid URL:', err.message);
  }
}

// Check API base URL format
if (process.env.CLIO_API_BASE_URL) {
  try {
    new URL(process.env.CLIO_API_BASE_URL);
    console.log('✅ CLIO_API_BASE_URL is a valid URL');
  } catch (err) {
    console.error('❌ CLIO_API_BASE_URL is not a valid URL:', err.message);
  }
}

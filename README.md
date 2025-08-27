# Legal Billing Application

This application integrates with Clio Legal software to automate legal billing processes.

## Setup Instructions

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file based on `.env.example`:
   ```
   cp .env.example .env
   ```

4. Update the `.env` file with your actual credentials:
   - CLIO_CLIENT_ID: Your Clio API Client ID
   - CLIO_CLIENT_SECRET: Your Clio API Client Secret
   - CLIO_REDIRECT_URI: Your redirect URI (must match what's registered in Clio)
   - CLIO_API_BASE_URL: Usually https://api.clio.com
   - MONGO_URI: Your MongoDB connection string
   - OPENAI_API_KEY: Your OpenAI API key (if using AI features)

## Running the Application

```
npm start
```

The application will start on http://localhost:5000

## Clio API Integration

This application integrates with Clio's API to:
- Authenticate users via OAuth
- Create communications in Clio
- Create billable activities in Clio

## Troubleshooting

If you're getting 403 errors:

1. Check that your CLIO_CLIENT_ID and CLIO_CLIENT_SECRET are correct
2. Ensure your redirect URI in the .env file matches what's registered in your Clio app
3. Verify that your Clio app has the correct permissions
4. Check that you're using the correct API endpoints:
   - Auth: https://app.clio.com/oauth/authorize and https://app.clio.com/oauth/token
   - API: https://api.clio.com

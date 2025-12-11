# Modal.com Setup Instructions

This guide explains how to set up Modal.com API for secure code execution in the interview platform.

## What is Modal.com?

Modal.com is a serverless compute platform that provides secure, isolated code execution environments. It's used in this project to safely execute candidate code submissions (Python and JavaScript) in sandboxed containers.

**Benefits**:
- Secure sandboxing prevents code from accessing the host system
- Isolated execution environments for each code run
- Scalable infrastructure that handles concurrent executions
- Built-in timeout and resource limits

## Prerequisites

- An email address for account creation
- Access to the backend `.env` file

## Step 1: Sign Up for Modal.com

1. Visit the Modal.com website: https://modal.com
2. Click **"Sign Up"** or **"Get Started"** button
3. Enter your email address and create a password
4. Verify your email address if required
5. Complete the account setup process

## Step 2: Get Your API Key

1. After logging in, navigate to your **Dashboard** or **Account Settings**
2. Look for **"API Keys"** or **"Credentials"** section
3. Click **"Create API Key"** or **"Generate New Key"**
4. Give your API key a descriptive name (e.g., "Interview Platform Production")
5. **Copy the API key immediately** - you won't be able to see it again after closing the dialog
6. Store it securely (you'll need it in the next step)

**Note**: If you can't find the API key section, check the Modal.com documentation or contact their support. The exact location may vary based on their interface.

## Step 3: Configure Backend Environment

1. Open the `backend/.env` file (create it if it doesn't exist, using `.env.example` as a template)
2. Add the following line:
   ```
   MODAL_API_KEY=your_actual_api_key_here
   ```
3. Replace `your_actual_api_key_here` with the API key you copied from Modal.com
4. Save the file

**Important**: 
- Never commit the `.env` file to version control
- Keep your API key secure and don't share it publicly
- The `.env` file should already be in `.gitignore`

## Step 4: Restart Backend Server

After adding the API key:

1. Stop the backend server (if it's running)
2. Restart it with:
   ```bash
   npm run dev
   ```
3. The backend will load the `MODAL_API_KEY` from the environment variables

## Step 5: Verify Configuration

To verify that the API key is loaded correctly:

1. Check the backend console logs when starting the server
2. Look for any errors related to Modal.com configuration
3. Test code execution through the interview platform

## Current Implementation Status

**Note**: The current implementation uses a **mock/stub** execution function. Even if you set up the API key, code execution will still use mock responses until the real Modal.com API integration is completed.

The mock implementation:
- Returns simulated output based on the code language
- Simulates execution delays
- Always returns success: true

Real API integration will be implemented in a future step.

## Next Steps

Once the real Modal.com API integration is complete:
- Code will be executed in secure sandboxed containers
- Execution results will include real output and errors
- Timeouts and resource limits will be enforced
- Multiple languages will be fully supported

## Troubleshooting

### API Key Not Working

- Verify the API key is copied correctly (no extra spaces)
- Check that `.env` file is in the `backend/` directory
- Ensure the backend server was restarted after adding the key
- Check Modal.com dashboard to ensure the API key is active

### Can't Find API Key Section

- Check Modal.com documentation for current interface
- Look for "Settings", "API", "Credentials", or "Developer Tools" sections
- Contact Modal.com support if needed

### Other Issues

- Review Modal.com API documentation: https://modal.com/docs
- Check backend logs for detailed error messages
- Ensure your Modal.com account has appropriate permissions

## Security Best Practices

1. **Never commit API keys** to version control
2. **Rotate API keys** periodically
3. **Use different API keys** for development and production
4. **Monitor API usage** in Modal.com dashboard
5. **Set up rate limiting** if needed

## Additional Resources

- [Modal.com Documentation](https://modal.com/docs)
- [Modal.com API Reference](https://modal.com/docs/api)
- Contact Modal.com support for account-specific questions


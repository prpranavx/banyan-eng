# Database Setup Instructions

This guide explains how to set up PostgreSQL database for the backend using Railway Postgres.

## Prerequisites

- Railway account (sign up at https://railway.app)
- Backend project repository

## Steps

### 1. Add Postgres Service in Railway

1. Log in to your Railway dashboard
2. Create a new project or select an existing project
3. Click **"New"** button and select **"Database"**
4. Choose **"Add PostgreSQL"** from the database options
5. Railway will automatically create a PostgreSQL service for you

### 2. Get Database URL

1. In your Railway project, click on the PostgreSQL service you just created
2. Navigate to the **"Variables"** tab
3. Find the `DATABASE_URL` variable (Railway automatically creates this)
4. Click on the value or use the copy button to copy the full connection string
   - It should look like: `postgresql://postgres:password@host:port/railway`

### 3. Add DATABASE_URL to Backend Environment

1. Open your backend directory: `cd backend`
2. Create a `.env` file if it doesn't exist (copy from `.env.example` if needed)
3. Add the `DATABASE_URL` variable:
   ```
   DATABASE_URL=postgresql://postgres:password@host:port/railway
   ```
4. Replace the placeholder with the actual `DATABASE_URL` you copied from Railway

### 4. Test the Connection

1. Make sure all dependencies are installed:
   ```bash
   npm install
   ```

2. Start the backend server:
   ```bash
   npm run dev
   ```

3. Check the console output:
   - ✅ **Success**: You should see `✅ Database connection successful` followed by the server startup message
   - ❌ **Failure**: You'll see an error message with details about what went wrong

## Troubleshooting

### Connection Refused

**Error**: `ECONNREFUSED` or `Connection refused`

**Solutions**:
- Verify the `DATABASE_URL` is correct (check host, port, username, password)
- Ensure the Railway PostgreSQL service is running
- Check if your IP needs to be whitelisted (Railway typically allows all IPs by default)

### Authentication Failed

**Error**: `password authentication failed`

**Solutions**:
- Double-check the password in the `DATABASE_URL`
- Make sure you copied the entire connection string correctly
- Try regenerating the database password in Railway (Variables tab → Regenerate)

### SSL/TLS Errors

**Error**: `SSL connection` or `self-signed certificate`

**Solutions**:
- The backend is already configured to handle SSL with `rejectUnauthorized: false`
- If issues persist, verify the `DATABASE_URL` includes SSL parameters or Railway requires specific SSL settings

### Environment Variable Not Found

**Error**: `DATABASE_URL environment variable is not set`

**Solutions**:
- Ensure `.env` file exists in the `backend/` directory
- Verify the variable name is exactly `DATABASE_URL` (case-sensitive)
- Restart your development server after adding the variable
- For production deployments on Railway, add `DATABASE_URL` to the service environment variables

## Railway Production Setup

When deploying the backend to Railway:

1. Link the backend service to the PostgreSQL service:
   - In your backend service settings, go to **"Variables"**
   - Railway should automatically detect the PostgreSQL service and suggest linking
   - Or manually add `DATABASE_URL` using the value from the PostgreSQL service

2. Railway automatically injects the `DATABASE_URL` when services are linked, so you may not need to manually set it

3. The connection will be tested automatically when the backend service starts

## Local Development vs Production

- **Local Development**: Use `.env` file with `DATABASE_URL` from Railway
- **Production (Railway)**: Railway automatically provides `DATABASE_URL` when services are linked

## Additional Resources

- [Railway PostgreSQL Documentation](https://docs.railway.app/databases/postgresql)
- [pg (node-postgres) Documentation](https://node-postgres.com/)


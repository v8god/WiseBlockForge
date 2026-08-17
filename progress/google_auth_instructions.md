# How to Obtain a Google Client ID for Authentication

To enable Google Account Sign-In for WiseBlockForge, you need to create a project in the Google Cloud Console and generate OAuth 2.0 Credentials. Follow these exact steps:

---

## Step 1: Go to Google Cloud Console
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Log in with your Google account.

## Step 2: Create a New Project
1. In the top navigation bar, click the project dropdown (next to the logo) and select **New Project**.
2. Enter a name for the project (e.g., `WiseBlockForge`).
3. Click **Create** and wait for the project initialization to complete.

## Step 3: Configure the OAuth Consent Screen
Before creating client keys, you must configure how the login consent screen appears to users:
1. In the left-hand navigation menu, click **APIs & Services** > **OAuth consent screen**.
2. Select **External** (available to any Google account user) and click **Create**.
3. Fill in the required fields:
   - **App name**: `WiseBlockForge`
   - **User support email**: (Your Gmail address)
   - **Developer contact information**: (Your email address)
4. Click **Save and Continue** through the Scopes and Test Users screens (you do not need to add custom scopes or test users for basic login).
5. Click **Back to Dashboard** to complete the setup.

## Step 4: Create OAuth 2.0 Client Credentials
1. In the left navigation menu, click **Credentials**.
2. Click **+ Create Credentials** at the top of the screen and choose **OAuth client ID**.
3. In the **Application type** dropdown, select **Web application**.
4. Set a name for the client configuration (e.g., `WiseBlockForge Local Client`).
5. Under **Authorized JavaScript origins**, click **+ ADD URI** and add:
   - `http://localhost:5173` (Frontend dev server URL)
6. Under **Authorized redirect URIs**, click **+ ADD URI** and add:
   - `http://localhost:5173` (Frontend landing redirect)
7. Click **Create**.

## Step 5: Copy Your Client ID
1. A popup window will display your **Client ID** and **Client Secret**.
2. Copy the **Client ID** string (it ends with `.apps.googleusercontent.com`).
3. Save it to your `.env` file in the root directory:
   ```env
   GOOGLE_CLIENT_ID=your_copied_client_id.apps.googleusercontent.com
   ```
4. If you have any login issues, make sure `http://localhost:5173` is listed exactly in JavaScript Origins and matches your local server port.

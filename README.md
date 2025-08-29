# Patient Care System Sample

## Overview

This is a Patient Care System sample application that demonstrates secure communication between patients, doctors, administrators, and quality assurance personnel using the `@azure/communication-react` package. 
Learn more about the [Azure Communication Services UI Library](https://azure.github.io/communication-ui-library/). 

The system features:
- **Role-based access control** with four user types: Patient, Doctor, Admin, and Quality Assurance
- **Secure messaging** between patients and healthcare providers
- **File attachments** for medical documents and images
- **Analytics and reporting** for quality assurance and administrators
- **Real-time notifications** and status indicators

The client-side application is a React based user interface. Alongside this front-end is a NodeJS web application powered by ExpressJS that handles authentication, user management, and secure communication channels.

Additional documentation for this sample can be found on [Microsoft Docs](https://docs.microsoft.com/en-us/azure/communication-services/samples/chat-hero-sample).

<img width="1225" height="386" alt="CleanShot 2025-08-20 at 11 00 13" src="https://github.com/user-attachments/assets/f7b6ef77-85a0-401a-af60-a15e1f4cb99b" />

## Prerequisites

- [Visual Studio Code (Stable Build)](https://code.visualstudio.com/download)
- [Node.js (LTS version)](https://nodejs.org/)
- Create an Azure account with an active subscription. For details, see [Create an account for free](https://azure.microsoft.com/free/?WT.mc_id=A261C142F).
- Create an Azure Communication Services resource. For details, see [Create an Azure Communication Resource](https://docs.microsoft.com/azure/communication-services/quickstarts/create-communication-resource). You'll need to record your resource **connection string** for this quickstart.
- Create an Azure Storage Account for file attachments. For details, see [Create a storage account](https://docs.microsoft.com/azure/storage/common/storage-account-create).

## User Roles

The Patient Care System supports four distinct user roles:

- **Patient**: End users who can create conversations, send messages, and upload medical documents
- **Doctor**: Healthcare providers who can respond to patient conversations, access medical history, and provide care
- **Admin**: System administrators with full access to user management, system settings, and all conversations
- **Quality**: Quality assurance personnel with access to analytics, reporting, and system metrics (no access to individual conversations)
## Code structure

- ./Chat/src/app: Where the client code lives
- ./Chat/src/app/App.tsx: Entry point into the patient care system
- ./Chat/src/app/HomeScreen.tsx: The first screen in the application
- ./Chat/src/app/LoginScreen.tsx: User authentication and registration
- ./Chat/src/app/ConfigurationScreen.tsx: Where to set your name and avatar for conversations
- ./Chat/src/app/ChatScreen.tsx: The main conversation screen for patients and doctors
- ./Chat/src/app/EndScreen.tsx: The screen users see when they leave a conversation
- ./Chat/src/app/ErrorScreen.tsx: The screen when an error occurs in conversations
- ./Server: server code for authentication, user management, and communication services
- ./Server/appsettings.json: Where to put your Azure Communication Services connection string and storage configuration

## Azure Resource Setup

### 1. Azure Communication Services
1. In the Azure portal, create a new Azure Communication Services resource
2. Navigate to your Communication Services resource
3. Go to **Keys** and copy the **Connection String**
4. Go to **Identities & User Access Tokens** 
5. Generate a user identity with **Chat** scope
6. Copy the **identity string** for the admin user

### 2. Azure Storage Account (for file attachments)
1. Create a new Storage Account in the Azure portal
2. Go to **Access Keys** and copy the **Connection String**
3. Create a blob container named `attachments` (or your preferred name)
4. Set the container's public access level to **Blob** if you want direct file access

## Before running the sample for the first time

1. Open an instance of PowerShell, Windows Terminal, Command Prompt or equivalent and navigate to the directory that you'd like to clone the sample to.
2. `git clone https://github.com/Azure-Samples/communication-services-web-chat-hero.git`
3. Get the `Connection String` from your Azure Communication Services resource (see Azure Resource Setup above)
4. Get the `Endpoint` from your Azure Communication Services resource 
5. Generate a user identity with **Chat** scope and copy the **identity string** for the admin user

### Configuration Options (Choose One)

**Option A: Environment Variables (Recommended for Security)**

**For Linux/macOS (Bash):**
```bash
export ResourceConnectionString="your_connection_string_here"
export EndpointUrl="your_endpoint_url_here" 
export AdminUserId="your_admin_user_id_here"
# Optional: for file attachment support
export AzureBlobStorageConnectionString="your_storage_connection_string_here"
```

**For Windows (PowerShell):**
```powershell
$env:ResourceConnectionString="your_connection_string_here"
$env:EndpointUrl="your_endpoint_url_here"
$env:AdminUserId="your_admin_user_id_here"
# Optional: for file attachment support
$env:AzureBlobStorageConnectionString="your_storage_connection_string_here"
```

**For Windows (Command Prompt):**
```cmd
set ResourceConnectionString=your_connection_string_here
set EndpointUrl=your_endpoint_url_here
set AdminUserId=your_admin_user_id_here
rem Optional: for file attachment support
set AzureBlobStorageConnectionString=your_storage_connection_string_here
```

**Option B: Configuration File (Not Recommended for Production)**
If you prefer using a configuration file:
1. Copy `Server/appsettings.json.sample` to `Server/appsettings.json`
2. Update the values in `Server/appsettings.json`:
   - `ResourceConnectionString`: Your ACS connection string
   - `EndpointUrl`: Your ACS endpoint URL  
   - `AdminUserId`: Your admin user identity string
   - `AzureBlobStorageConnectionString`: (Optional) Your Azure Storage connection string

⚠️ **Security Note**: Never commit `appsettings.json` with real credentials to version control. The file is ignored by git to prevent accidental credential exposure.

## Local run

### Option 1: Run everything together (recommended for development)
1. Configure your credentials using environment variables or configuration file (see above)
2. `npm run setup` from the root directory
3. `npm run start` from the root directory

### Option 2: Run Server and Client separately
1. Configure your credentials using environment variables or configuration file (see above)
2. `npm run setup` from the root directory

**Start the Server:**
```bash
cd Server
npm run start
```

**In a new terminal, start the Client:**
```bash
cd Chat
npm start
```

The server will run on `http://localhost:8080` and the client will run on `http://localhost:3000`.

### Demo Accounts
The system automatically creates demo accounts for testing:
- **Admin**: admin@example.com / admin123
- **Doctor**: doctor@example.com / doctor123  
- **Patient**: patient@example.com / patient123
- **Quality**: quality@example.com / quality123

## Security and Credentials

### Environment Variables (Recommended)
This application prioritizes environment variables for credential management to enhance security:

- `ResourceConnectionString`: Azure Communication Services connection string
- `EndpointUrl`: Azure Communication Services endpoint URL
- `AdminUserId`: Admin user identity for the application
- `AzureBlobStorageConnectionString`: (Optional) Azure Storage connection string for file attachments

### Configuration File Fallback
If environment variables are not set, the application will attempt to load credentials from `Server/appsettings.json`. However:

⚠️ **Important Security Notes:**
- Never commit real credentials to version control
- Use `appsettings.json.sample` as a template
- The `appsettings.json` file is git-ignored to prevent accidental commits
- Always prefer environment variables in production environments
- Review your commit history if you've accidentally committed credentials

## Using the Patient Care System

### As a Patient
- Create an account with the "Patient" role or use the demo account (patient@example.com / patient123)
- Start new conversations with healthcare providers
- Send messages and upload medical documents or images
- View conversation history and medical records

### As a Doctor  
- Create an account with the "Doctor" role or use the demo account (doctor@example.com / doctor123)
- Respond to patient conversations and provide medical advice
- Access patient medical history and uploaded documents
- Create new conversations with patients when needed

### As an Administrator
- Use the admin demo account (admin@example.com / admin123)
- Manage user accounts and system settings
- Access all conversations for moderation purposes
- View system-wide analytics and reports
- Configure system parameters and security settings

### As Quality Assurance
- Use the quality demo account (quality@example.com / quality123)
- Access analytics dashboard and reporting features
- Export data to Elasticsearch for advanced analysis
- Monitor system performance and user interactions
- No access to individual patient conversations (privacy protection)

## Publish to Azure

1. `npm run setup`
1. `npm run build`
1. `npm run package`
1. Use the [Azure extension](https://code.visualstudio.com/docs/azure/extensions) and deploy the `Chat/dist` directory to your app service

## Data Collection
 
The software may collect information about you and your use of the software and send it to Microsoft. Microsoft may use this information to provide services and improve our products and services. This hero sample collects information about users and their use of the software that cannot be opted out of. Do not use this sample if you wish to avoid telemetry. You can learn more about data collection and use in the help documentation and Microsoft’s [privacy statement](https://go.microsoft.com/fwlink/?LinkID=824704). For more information on the data collected by the Azure SDK, please visit the [Telemetry Policy](https://learn.microsoft.com/azure/communication-services/concepts/privacy) page.


## Additional Reading

- [Analytics and Quality Features](./ANALYTICS.md) - Learn about the analytics dashboard and quality assurance features
- [Azure Communication Services - UI Library](https://azure.github.io/communication-ui-library/) - To learn more about what the `@azure/communication-react` package offers.
- [Azure Communication Chat SDK](https://docs.microsoft.com/en-us/azure/communication-services/concepts/chat/sdk-features) - To learn more about the chat web sdk.
- [Teams Interop Meeting Chat Quickstart](https://github.com/Azure-Samples/communication-services-javascript-quickstarts/tree/main/ui-library-quickstart-teams-interop-meeting-chat) - To try out new beta features such as Rich Text Editor.
- [FluentUI](https://developer.microsoft.com/en-us/fluentui#/) - Microsoft powered UI library
- [React](https://reactjs.org/) - Library for building user interfaces

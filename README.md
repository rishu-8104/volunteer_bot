# CommuBot - Slack Volunteer Matching Bot

A Node.js server using Express and Slack Bolt framework that handles slash commands and responds with interactive messages. Deployed on Vercel for easy Slack integration.

## Features

- `/volunteer` slash command for finding volunteer opportunities
- Interactive buttons for booking opportunities
- Mock data for demonstration (easily replaceable with real database)
- Vercel-ready deployment configuration

## Prerequisites

1. **Slack App**: Create a Slack app at [https://api.slack.com/apps](https://api.slack.com/apps)
2. **Vercel Account**: Sign up at [https://vercel.com](https://vercel.com)
3. **Node.js**: Version 18+ (for local development)

## Slack App Setup

### 1. Create a Slack App
1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name your app (e.g., "CommuBot") and select your workspace

### 2. Configure OAuth & Permissions
1. Go to "OAuth & Permissions" in your app settings
2. Add these Bot Token Scopes:
   - `app_mentions:read`
   - `channels:history`
   - `chat:write`
   - `commands`
   - `im:history`
   - `im:read`
   - `im:write`

### 3. Create Slash Command
1. Go to "Slash Commands" in your app settings
2. Click "Create New Command"
3. Fill in:
   - **Command**: `/volunteer`
   - **Request URL**: `https://your-vercel-app.vercel.app/slack/commands`
   - **Short Description**: `Find volunteer opportunities`
   - **Usage Hint**: `5 people, environmental cleanup, next Friday`

### 4. Enable Interactive Components
1. Go to "Interactivity & Shortcuts"
2. Turn on "Interactivity"
3. Set **Request URL**: `https://your-vercel-app.vercel.app/slack/interactive`

### 5. Install App to Workspace
1. Go to "Install App" in your app settings
2. Click "Install to Workspace"
3. Copy the **Bot User OAuth Token** (starts with `xoxb-`)
4. Copy the **Signing Secret** from "Basic Information"

## Local Development

### 1. Clone and Install
```bash
git clone <your-repo-url>
cd mvp_commubot
npm install
```

### 2. Environment Setup
```bash
cp env.example .env
```

Edit `.env` with your Slack app credentials:
```env
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
PORT=3000
```

### 3. Run Locally
```bash
npm run dev
```

The server will start on `http://localhost:3000`

### 4. Test with ngrok (for local Slack integration)
```bash
# Install ngrok if you haven't
npm install -g ngrok

# In another terminal
ngrok http 3000
```

Use the ngrok URL (e.g., `https://abc123.ngrok.io`) in your Slack app settings instead of localhost.

## Vercel Deployment

### 1. Deploy to Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Follow the prompts:
# - Link to existing project? N
# - Project name: mvp-commubot (or your preferred name)
# - Directory: ./
# - Override settings? N
```

### 2. Set Environment Variables
In your Vercel dashboard:
1. Go to your project → Settings → Environment Variables
2. Add:
   - `SLACK_BOT_TOKEN`: Your bot token (xoxb-...)
   - `SLACK_SIGNING_SECRET`: Your signing secret

### 3. Update Slack App URLs
Update your Slack app settings with the Vercel URLs:
- **Slash Command URL**: `https://your-app-name.vercel.app/slack/commands`
- **Interactive Components URL**: `https://your-app-name.vercel.app/slack/interactive`

## Usage

### Slash Command
In any Slack channel, type:
```
/volunteer 5 people, environmental cleanup, next Friday
```

The bot will:
1. Parse your request
2. Show a summary with interactive buttons
3. Find matching opportunities when you click "Find Matches"
4. Allow booking with confirmation

### Example Interactions
- `/volunteer 3 people, food bank, weekend`
- `/volunteer 1 person, animal shelter, flexible`
- `/volunteer 10 people, community garden, next Saturday`

## Project Structure

```
mvp_commubot/
├── app.js              # Main application file
├── package.json        # Dependencies and scripts
├── vercel.json         # Vercel deployment config
├── env.example         # Environment variables template
└── README.md          # This file
```

## Customization

### Adding Real Database
Replace the mock functions in `app.js`:
- `parseVolunteerRequest()` - Add NLP or more sophisticated parsing
- `findMatches()` - Connect to your database
- `saveRequest()` - Implement actual data persistence

### Adding More Commands
Add new slash commands by creating additional `app.command()` handlers:

```javascript
app.command('/help', async ({ command, ack, respond }) => {
  await ack();
  await respond({
    text: "Available commands: /volunteer, /help"
  });
});
```

### Adding More Interactive Elements
Extend the interactive components with more action handlers:

```javascript
app.action('new_action_id', async ({ body, ack, respond }) => {
  await ack();
  // Your action logic here
});
```

## Troubleshooting

### Common Issues

1. **"Invalid signature" error**: Check your `SLACK_SIGNING_SECRET`
2. **"Missing token" error**: Verify your `SLACK_BOT_TOKEN`
3. **Command not working**: Ensure the slash command URL is correct
4. **Buttons not responding**: Check the interactive components URL

### Debug Mode
Add this to see detailed logs:
```javascript
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  processBeforeResponse: true,
  logLevel: 'DEBUG'  // Add this line
});
```

## Support

For issues with:
- **Slack API**: Check [Slack API documentation](https://api.slack.com/)
- **Vercel**: See [Vercel documentation](https://vercel.com/docs)
- **Slack Bolt**: Visit [Bolt documentation](https://slack.dev/bolt/)

## License

MIT License - feel free to use and modify as needed!

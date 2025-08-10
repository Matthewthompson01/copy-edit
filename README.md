# Copy Edit App

An intelligent copy editing application powered by GPT-4o with decision-making capabilities and real-time text comparison.

## Features

- **AI-Powered Copy Editing**: Uses GPT-4o with customizable meta prompts for intelligent text editing
- **Decision Making System**: AI analyzes text and decides the appropriate editing approach (Light, Medium, Heavy, Creative)
- **Real-time Diff Visualization**: Shows changes with highlighted additions, deletions, and modifications
- **Configurable Meta Prompts**: Easily customize AI behavior through external prompt files
- **Responsive Design**: Clean, modern interface that works on all devices

## Prerequisites

- Node.js 20+ 
- OpenAI API key
- Docker (optional, for containerized deployment)

## Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Matthewthompson01/copy-edit.git
   cd copy-edit
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   echo "OPENAI_API_KEY=your-openai-api-key-here" > .env.local
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Production Deployment

### Option 1: Docker Compose (Recommended)

1. **Clone and configure**
   ```bash
   git clone https://github.com/Matthewthompson01/copy-edit.git
   cd copy-edit
   echo "OPENAI_API_KEY=your-openai-api-key-here" > .env.local
   ```

2. **Deploy with Docker Compose**
   ```bash
   docker-compose up --build -d
   ```

### Option 2: Docker Only

```bash
docker build -t copyedit-app .
docker run -d -p 3000:3000 -e OPENAI_API_KEY="your-api-key" copyedit-app
```

### Option 3: Node.js Production

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Start the production server**
   ```bash
   npm start
   ```

## Configuration

### Meta Prompts

Customize AI behavior by editing `prompts/meta-prompt.txt`. The AI uses this prompt to decide how to approach text editing:

- **LIGHT**: Fix obvious errors, maintain original voice
- **MEDIUM**: Restructure sentences, improve flow
- **HEAVY**: Significant rewriting and restructuring
- **CREATIVE**: Add engagement, improve storytelling

### Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (development/production)

## API Endpoints

- `POST /api/gpt5-suggest`: Submit text for AI editing
  - Body: `{ "original": "text to edit", "effort": "minimal" }`
  - Response: `{ "edited": "...", "analysis": "...", "decision": "...", "recommendations": [...] }`

## Architecture

- **Frontend**: Next.js 14 with React 18
- **Backend**: Next.js API routes
- **AI Integration**: OpenAI GPT-4o with structured outputs
- **Diff Algorithm**: Longest Common Subsequence (LCS) for change visualization
- **Styling**: Tailwind CSS with custom components

## File Structure

```
├── app/
│   ├── api/gpt5-suggest/route.js    # OpenAI API integration
│   ├── layout.js                    # Root layout
│   └── page.jsx                     # Main application
├── prompts/
│   └── meta-prompt.txt              # AI decision-making prompts
├── public/                          # Static assets
├── docker-compose.yml               # Docker Compose configuration
├── Dockerfile                       # Docker build configuration
└── next.config.js                   # Next.js configuration
```

## Troubleshooting

### Common Issues

1. **API not working**: Verify your OpenAI API key is correct and has sufficient credits
2. **Build failures**: Ensure Node.js 20+ is installed
3. **Docker issues**: Make sure Docker daemon is running

### Development

- Check browser console for client-side errors
- Check server logs: `docker-compose logs` or `npm run dev` output
- Verify `.env.local` file exists and contains valid API key

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions, please use the GitHub Issues page.

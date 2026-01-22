<<<<<<< HEAD
# Trivia Bots Admin Backend

Express.js API server for the Trivia Bots Admin Dashboard.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```env
# Database Configuration
DB_USER=your_db_user
DB_HOST=your_db_host
DB_NAME=your_db_name
DB_PASSWORD=your_db_password
DB_PORT=5432

# Server Configuration
PORT=3001
NODE_ENV=development

# OpenAI API Key (for GPT analysis)
OPENAI_API_KEY=your_openai_api_key
```

3. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Deployment to Render.com

1. **Create a Web Service** in Render Dashboard
2. **Build Command**: `npm install`
3. **Start Command**: `npm start`
4. **Environment Variables**: Set all required environment variables in Render Dashboard
   - `DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, `DB_PORT`
   - `OPENAI_API_KEY`
   - `PORT` (automatically provided by Render, don't set manually)
   - `NODE_ENV=production`

## API Endpoints

See `API.md` for detailed API documentation.

## Project Structure

```
admin/backend/
├── db/              # Database connection and schema
├── routes/          # API route handlers
├── services/        # Business logic services
├── utils/           # Utility functions (logger, etc.)
├── logs/            # Application logs
├── server.js        # Main server file
└── package.json     # Dependencies and scripts
```

## Dependencies

- **express**: Web framework
- **pg**: PostgreSQL client
- **openai**: OpenAI API client
- **winston**: Logging
- **xlsx**: Excel file processing
- **cors**: CORS middleware
- **dotenv**: Environment variable management
=======
# trivia-bots-admin-backend
>>>>>>> 435d5fc8d09db4e80f9e911ad9a40e68ab38b889

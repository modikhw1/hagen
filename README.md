# Hagen

A modern full-stack web application built with Next.js, React, TypeScript, Supabase, and OpenAI.

## Tech Stack

### Frontend
- **React 18** - UI library
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework

### Backend
- **Next.js API Routes** - Serverless backend endpoints
- **Supabase** - PostgreSQL database, authentication, and storage
- **OpenAI GPT-4** - AI-powered text analysis
- **Zod** - Schema validation

### Development & Deployment
- **ESLint** - Code linting
- **GitHub Codespaces** - Cloud development environment
- **Vercel** - Deployment platform

## Project Structure

```
hagen/
├── src/
│   ├── app/                    # Next.js 14 App Router
│   │   ├── api/               # API routes
│   │   │   ├── analyze/       # Text analysis endpoint
│   │   │   ├── chat/          # Chat completion endpoint
│   │   │   └── profile/       # User profile endpoints
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Home page
│   │   └── globals.css        # Global styles
│   ├── components/
│   │   ├── features/          # Feature components
│   │   │   └── TextAnalyzer.tsx
│   │   └── ui/                # Reusable UI components
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Card.tsx
│   │       └── LoadingSpinner.tsx
│   ├── lib/
│   │   ├── openai/            # OpenAI integration
│   │   │   └── client.ts
│   │   └── supabase/          # Supabase integration
│   │       ├── client.ts
│   │       └── auth.ts
│   └── types/
│       └── database.ts        # Database type definitions
├── supabase/
│   └── migrations/            # Database migrations
│       └── 001_initial_schema.sql
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
└── .env.example
```

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier available)
- An OpenAI API key

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your credentials:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Set Up Supabase Database

1. Create a new project on [Supabase](https://supabase.com)
2. Run the migration script in the SQL editor:
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Copy and paste the contents of `supabase/migrations/001_initial_schema.sql`
   - Execute the script

3. Get your API keys:
   - Go to Settings → API
   - Copy the `Project URL` and `anon public` key
   - Copy the `service_role` key (keep this secret!)

### 4. Get OpenAI API Key

1. Sign up at [OpenAI](https://platform.openai.com)
2. Navigate to API keys section
3. Create a new API key
4. Add credits to your account to use GPT-4

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## API Endpoints

### POST `/api/analyze`
Analyze text using GPT-4

**Request:**
```json
{
  "text": "Your text to analyze",
  "prompt": "Optional custom prompt"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": "Analysis summary",
    "insights": ["Insight 1", "Insight 2"],
    "sentiment": "positive"
  }
}
```

### POST `/api/chat`
Generate chat completions

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "Hello!" }
  ]
}
```

### GET `/api/profile?userId={id}`
Get user profile

### PUT `/api/profile`
Update user profile

## Deploying to Vercel

### Option 1: Deploy via Vercel Dashboard

1. Push your code to GitHub
2. Visit [Vercel](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Add environment variables in the project settings
6. Deploy!

### Option 2: Deploy via CLI

```bash
npm install -g vercel
vercel login
vercel
```

### Environment Variables on Vercel

Make sure to add all environment variables from `.env.local` to your Vercel project:

1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add each variable with appropriate values
4. Redeploy if already deployed

## Features

### ✅ Implemented

- Text analysis using GPT-4
- API routes with TypeScript
- Supabase integration with typed client
- Reusable React components
- Tailwind CSS styling
- Type-safe development with TypeScript
- User authentication helpers

### 🚧 To Add

- User authentication flow (login/signup pages)
- Protected routes
- User dashboard
- File upload to Supabase Storage
- Real-time subscriptions
- More AI features (embeddings, chat interface)

## Development Tips

### TypeScript

This project uses strict TypeScript. All components and functions are fully typed. The Supabase types are generated from your database schema.

### Generating Supabase Types

To update database types after schema changes:

```bash
npx supabase gen types typescript --project-id "your-project-ref" > src/types/database.ts
```

### Styling with Tailwind

Tailwind CSS is configured with a custom color palette. See `tailwind.config.js` for customization.

### Code Organization

- Keep API logic in `/api` routes
- Put reusable UI components in `/components/ui`
- Put feature-specific components in `/components/features`
- Put shared utilities in `/lib`

## Troubleshooting

### "Missing environment variables" error

Make sure `.env.local` exists and contains all required variables.

### Supabase connection errors

Verify your Supabase URL and keys are correct. Check that your Supabase project is active.

### OpenAI API errors

- Check that your API key is valid
- Ensure you have credits in your OpenAI account
- Verify you have access to GPT-4 (may require payment)

### Build errors

Run `npm run type-check` to see TypeScript errors before building.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - feel free to use this project for learning or as a starter template.

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Supabase Documentation](https://supabase.com/docs)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Vercel Documentation](https://vercel.com/docs)

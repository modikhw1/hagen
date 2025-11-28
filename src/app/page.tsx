import { TextAnalyzer } from '@/components/features/TextAnalyzer'
import { TikTokFetcher } from '@/components/features/TikTokFetcher'

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Welcome to Hagen
        </h1>
        <p className="text-lg text-gray-600">
          A modern web app built with Next.js, React, TypeScript, Supabase, and OpenAI
        </p>
      </div>

      <div className="grid gap-8">
        <section>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            TikTok Video Data Extractor
          </h2>
          <TikTokFetcher />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            AI-Powered Text Analysis
          </h2>
          <TextAnalyzer />
        </section>

        <section className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Tech Stack
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-primary-600 mb-2">Frontend</h3>
              <ul className="space-y-1 text-gray-600">
                <li>• React 18</li>
                <li>• Next.js 14</li>
                <li>• TypeScript</li>
                <li>• Tailwind CSS</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-primary-600 mb-2">Backend</h3>
              <ul className="space-y-1 text-gray-600">
                <li>• Next.js API Routes</li>
                <li>• Supabase (PostgreSQL)</li>
                <li>• OpenAI GPT-4</li>
                <li>• Zod Validation</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Features
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 bg-primary-50 rounded-lg">
              <h3 className="font-semibold text-primary-700 mb-2">
                🤖 AI Analysis
              </h3>
              <p className="text-sm text-gray-600">
                Powered by OpenAI GPT-4 for intelligent text analysis and insights
              </p>
            </div>
            <div className="p-4 bg-primary-50 rounded-lg">
              <h3 className="font-semibold text-primary-700 mb-2">
                🗄️ Database
              </h3>
              <p className="text-sm text-gray-600">
                Supabase for real-time data, auth, and storage
              </p>
            </div>
            <div className="p-4 bg-primary-50 rounded-lg">
              <h3 className="font-semibold text-primary-700 mb-2">
                ⚡ Fast Deploy
              </h3>
              <p className="text-sm text-gray-600">
                One-click deployment to Vercel from GitHub
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

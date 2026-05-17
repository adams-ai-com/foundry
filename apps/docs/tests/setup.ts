import { vi } from 'vitest'
import 'dotenv/config'

// Mock Next.js navigation — redirect() throws in server action tests otherwise
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
}))

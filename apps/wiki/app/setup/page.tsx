import { redirect } from "next/navigation"
import { getHomePage } from "@/lib/actions"
import sql from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function SetupPage() {
  const home = await getHomePage()
  if (home) {
    redirect(`/page/${home.id}`)
  }

  // Seed home page if somehow missing
  const rows = await sql<{ id: string }[]>`
    INSERT INTO pages (title, content, is_home, position)
    VALUES ('Home', '{}', TRUE, 0)
    ON CONFLICT DO NOTHING
    RETURNING id
  `
  const id = rows[0]?.id ?? (await sql<{ id: string }[]>`SELECT id FROM pages WHERE is_home = TRUE LIMIT 1`)[0]?.id
  redirect(`/page/${id}`)
}

import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, { max: 5 })

export default sql

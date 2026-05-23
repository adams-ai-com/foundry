import postgres from 'postgres'

const db = postgres(process.env.CHANNELS_DATABASE_URL!, { max: 5 })

export default db

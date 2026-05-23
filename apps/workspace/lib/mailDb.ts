import postgres from 'postgres'

const mailDb = postgres(process.env.MAIL_DATABASE_URL!, { max: 3 })

export default mailDb

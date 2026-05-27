# Basics
HONO + CF Workers + Supabase/Neon + CF R2 + CF Queues

# Workflow 
FLOW = User request -> CF Workers (Hono) -> Save to CF R2 -> Push to CF Queues -> BG workers updates DB/timelines


# Stack
`Frontend`: 'Rect + Vite'
`Deployment`: 'Cloudflare Pages'

`Backend`: 'Hono + CF Workers'
`Pkg manager`: 'Bun'
`DB`: 'Supabase'
`ORM`: 'Drizzle + pgvector'
`Storage`: 'CF R2/CF CDN'
`Storage`: 'Cloudflare R2'
`Auth`: 'Better auth'
`Messaging`: 'CF Queues'
`Real time`: 'Supabase realtime/CF Durable Objects + SSE'
`Async/Queues`: 'CF Queues'


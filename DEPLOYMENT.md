# 🚀 GUÍA DE DEPLOYMENT

## Vercel (Recomendado)

```bash
# 1. Instalar Vercel CLI
npm i -g vercel

# 2. Deploy
vercel

# Nota: El archivo vercel.json ya está configurado para manejar las rutas (SPA routing).
# Si tienes problemas con el 404 al recargar páginas, asegúrate de que vercel.json esté en la raíz.

# 3. En dashboard Vercel, agregar variables:
# Settings → Environment Variables
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY

```

## Netlify

```bash
npm i -g netlify-cli
netlify deploy --prod
```

## Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

## Variables de Entorno Requeridas

- `VITE_SUPABASE_URL` - URL de tu proyecto Supabase
- `VITE_SUPABASE_ANON_KEY` - Anon key de Supabase

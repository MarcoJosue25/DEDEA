# DEDEA

Plataforma web para aprender y practicar mecanografía en español: noticias reales resumidas
por nivel, ejercicios generados a partir de tus propios errores, un curso por niveles y
estadísticas tecla por tecla.

## Stack

- **Backend:** Java 21, Spring Boot 4, MySQL 8
- **Frontend:** React 19, TypeScript, Vite, Tailwind 4

## Estructura

```
backend/    API REST (Spring Boot)
frontend/   aplicación web (React)
```

## Cómo se levanta

**Backend** (puerto 8080). Necesita MySQL con una base `db_dedea` y estas variables de entorno:
`JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`,
`FACEBOOK_CLIENT_SECRET`, `NEWS_API_KEY`, `GEMINI_API_KEY`, `ADMIN_SYNC_KEY`.

```bash
cd backend
./mvnw spring-boot:run
```

**Frontend** (puerto 5173):

```bash
cd frontend
npm install
npm run dev
```

## Tests

```bash
cd backend && ./mvnw test
cd frontend && npm test
```

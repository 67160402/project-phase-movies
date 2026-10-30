# Movie API Project

ระบบ REST API สำหรับจัดการข้อมูลภาพยนตร์ พร้อมระบบสมาชิก การกำหนดสิทธิ์ และการเชื่อมต่อ External Movie API

## Features

- จัดการข้อมูลภาพยนตร์ (CRUD)
- ค้นหา, Sort และ Pagination
- จัดการประเภทภาพยนตร์ (Genres)
- รองรับ Movie ↔ Genre แบบ Many-to-Many
- Register / Login / Auth Me
- JWT Authentication และ RBAC
- Rate Limiting
- เชื่อมต่อ OMDb API
- Retry, Timeout และ Fallback
- Swagger / OpenAPI
- Postman / Newman
- Jest / Supertest สำหรับทดสอบ API

## Technologies

- Node.js
- Express.js
- MySQL
- JWT
- bcrypt
- Axios
- Swagger / OpenAPI
- Jest / Supertest
- Postman / Newman

## Project Structure

```text
project-phase3/
├── src/
│   ├── index.js
│   ├── auth-helpers.js
│   ├── middleware/
│   └── services/
│       └── external-api.js
├── frontend/
├── tests/
├── openapi.yaml
├── postman_collection.json
├── environment.json
├── coverage-report.md
├── failure-scenario-results.md
├── microservices-design.md
├── requirement.md
├── erd.png
├── schema.sql
├── seed.sql
├── db.js
└── package.json
```

## Installation

ติดตั้ง Dependencies

```bash
npm install
```

ตั้งค่าไฟล์ `.env` สำหรับ Port, MySQL และ OMDb API Key

สร้างฐานข้อมูลโดยใช้:

```text
schema.sql
seed.sql
```

## Run

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

API:

```text
http://localhost:3000
```

Swagger:

```text
http://localhost:3000/api-docs
```

## Main API

### Authentication

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

### Movies

```text
GET    /api/v1/movies
GET    /api/v1/movies/:id
POST   /api/v1/movies
PUT    /api/v1/movies/:id
DELETE /api/v1/movies/:id
```

### Genres

```text
GET /api/v1/genres
POST /api/v1/genres
GET /api/v1/movies/:id/genres
PUT /api/v1/movies/:id/genres
```

### External API

```text
GET /api/v1/external/movies?title=Inception
```

ระบบใช้ OMDb API พร้อม Retry, Timeout และ Fallback เมื่อ External API ไม่สามารถใช้งานได้

## Authentication

API ใช้ JWT สำหรับ Authentication และกำหนดสิทธิ์ด้วย Role

- `user` — สามารถเรียก API ที่ต้องเข้าสู่ระบบ
- `admin` — สามารถเพิ่ม แก้ไข และลบข้อมูลภาพยนตร์/ประเภทภาพยนตร์

## Testing

รัน Unit / API Tests:

```bash
npm test
```

รันพร้อม Coverage:

```bash
npm test -- --coverage
```

ผลการทดสอบล่าสุด:

```text
Test Suites: 2 passed
Tests:       32 passed
Coverage:    81.96%
```

ทดสอบ API เพิ่มเติมด้วย Postman และ Newman

```bash
npx newman run "postman_collection.json" -e "environment.json"
```

## Architecture

โปรเจกต์ใช้แนวทาง **Modular Monolith** โดยแบ่งความรับผิดชอบเป็นส่วน Authentication, Movie/Genre และ External API ภายใน Express Application เดียว

Frontend ติดต่อผ่าน REST API และ API ติดต่อ MySQL สำหรับจัดเก็บข้อมูล

## Documentation

เอกสารเพิ่มเติม:

- `openapi.yaml` — API Documentation
- `coverage-report.md` — Test Coverage
- `failure-scenario-results.md` — External API Failure Test
- `microservices-design.md` — Architecture Design
- `requirement.md` — Project Requirements

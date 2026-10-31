# Movie API Project

ระบบ REST API สำหรับจัดการข้อมูลภาพยนตร์และประเภทภาพยนตร์ พร้อมหน้าเว็บ และการเชื่อมต่อ External Movie API (ไม่มีระบบสมาชิก ทุก Endpoint เรียกใช้ได้ทันที)

## Features

- จัดการข้อมูลภาพยนตร์ (CRUD)
- ค้นหา, Sort และ Pagination
- จัดการประเภทภาพยนตร์ (Genres)
- รองรับ Movie ↔ Genre แบบ Many-to-Many
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
- Axios
- Swagger / OpenAPI
- Jest / Supertest
- Postman / Newman

## Project Structure

```text
project-phase3/
├── src/
│   ├── index.js
│   ├── middleware/
│   │   ├── query-parser.js
│   │   └── rateLimiter.js
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

## Run with Docker

ไม่ต้องติดตั้ง Node.js หรือ MySQL ในเครื่อง ใช้แค่ Docker

```bash
cp .env.example .env   # ใส่ OMDB_API_KEY ถ้าต้องการใช้ External API (ไม่ใส่ก็รันได้)
docker compose up -d --build
```

- Web + API: `http://localhost:3000`
- Swagger: `http://localhost:3000/api-docs`
- MySQL จากเครื่อง Host: `localhost:3307` (user `root`)

ฐานข้อมูลจะถูกสร้างจาก `schema.sql` และ `seed.sql` อัตโนมัติในครั้งแรก

```bash
docker compose logs -f api      # ดู log ของ API
docker compose down             # หยุดการทำงาน
docker compose down -v          # หยุดและล้างฐานข้อมูลกลับเป็นข้อมูลตั้งต้น
```

หลังแก้โค้ด ต้องรัน `docker compose up -d --build` ใหม่เพื่อ build image อีกครั้ง

## API Endpoints

Base URL: `http://localhost:3000/api/v1`

ทุก Endpoint ไม่ต้องเข้าสู่ระบบ และจำกัดไว้ที่ 100 Request ต่อนาทีต่อ IP (เกินจะได้ `429`)

| Method | Path | ทำอะไร |
| --- | --- | --- |
| GET | `/movies` | รายการภาพยนตร์ (แบ่งหน้า / ค้นหา / เรียง) |
| GET | `/movies/:id` | ภาพยนตร์ 1 เรื่อง |
| POST | `/movies` | เพิ่มภาพยนตร์ |
| PUT | `/movies/:id` | แก้ไขภาพยนตร์ |
| DELETE | `/movies/:id` | ลบภาพยนตร์ |
| GET | `/genres` | ประเภทภาพยนตร์ทั้งหมด |
| POST | `/genres` | เพิ่มประเภทภาพยนตร์ |
| GET | `/movies/:id/genres` | ประเภทของภาพยนตร์เรื่องนั้น |
| PUT | `/movies/:id/genres` | กำหนดประเภทให้ภาพยนตร์ |
| GET | `/external/movies?title=` | ค้นหาข้อมูลจาก OMDb |

### รูปแบบ Response

สำเร็จจะได้ `{ "message": "...", "data": ... }`

ผิดพลาดจะได้รูปแบบเดียวกันทุก Endpoint:

```json
{ "error": { "code": "NOT_FOUND", "message": "ไม่พบข้อมูลภาพยนตร์" } }
```

| Status | code | เกิดเมื่อ |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR`, `INVALID_GENRE_IDS` | ข้อมูลที่ส่งมาไม่ถูกต้อง |
| 404 | `NOT_FOUND`, `ROUTE_NOT_FOUND` | ไม่พบข้อมูล หรือไม่มี path นี้ |
| 409 | `DUPLICATE_GENRE` | ชื่อประเภทซ้ำ |
| 429 | `TOO_MANY_REQUESTS` | เรียก API เกิน 100 ครั้ง/นาที |
| 500 | `INTERNAL_SERVER_ERROR` | ระบบผิดพลาด เช่น ต่อฐานข้อมูลไม่ได้ |

### GET /movies

ดึงรายการภาพยนตร์ทีละหน้า

| Query | ค่าเริ่มต้น | คำอธิบาย |
| --- | --- | --- |
| `page` | `1` | หน้าที่ต้องการ |
| `limit` | `8` | จำนวนต่อหน้า (สูงสุด 100) |
| `q` | – | ค้นหาจากชื่อหนัง **หรือ** ชื่อผู้กำกับ (ค้นบางส่วนของคำได้) |
| `sort` | `id` | `id`, `title`, `director`, `release_year` |
| `order` | `asc` | `asc` หรือ `desc` |

ขั้นตอนการทำงาน:

1. Middleware ใน `query-parser.js` แปลงค่า query ให้ปลอดภัย ถ้า `page`/`limit` ผิดจะใช้ค่าเริ่มต้น ถ้า `sort` ไม่อยู่ในรายการที่อนุญาตจะใช้ `id` (ป้องกัน SQL Injection ผ่านชื่อคอลัมน์)
2. ถ้ามี `q` จะเพิ่ม `WHERE title LIKE %q% OR director LIKE %q%`
3. ดึงข้อมูลด้วย `LIMIT` / `OFFSET` แล้วนับจำนวนทั้งหมดอีกครั้งเพื่อคำนวณ `totalPages`

```bash
curl "http://localhost:3000/api/v1/movies?q=nolan&sort=release_year&order=desc"
```

```json
{
  "message": "สำเร็จ",
  "data": [{ "id": 2, "title": "Interstellar", "director": "Christopher Nolan", "release_year": 2014 }],
  "pagination": { "page": 1, "limit": 8, "total": 2, "totalPages": 1 }
}
```

### GET /movies/:id

ดึงภาพยนตร์ตาม ID ถ้าไม่พบจะตอบ `404`

### POST /movies และ PUT /movies/:id

ใช้ Body แบบเดียวกัน และต้องส่งครบทุก field:

```json
{ "title": "Dune", "director": "Denis Villeneuve", "release_year": 2021 }
```

- `title`, `director` ต้องเป็นข้อความที่ไม่ว่าง (ระบบตัดช่องว่างหน้า/หลังให้)
- `release_year` ต้องเป็นจำนวนเต็มมากกว่า 0 (ส่ง `"2021"` แบบข้อความจะไม่ผ่าน)
- ข้อมูลไม่ถูกต้องจะได้ `400`
- POST ตอบ `201` พร้อมภาพยนตร์ที่สร้าง (มี `id`)
- PUT ตอบ `200` พร้อมข้อมูลหลังแก้ไข ถ้าไม่พบ ID จะได้ `404`

```bash
curl -X POST http://localhost:3000/api/v1/movies \
  -H "Content-Type: application/json" \
  -d '{"title":"Dune","director":"Denis Villeneuve","release_year":2021}'
```

### DELETE /movies/:id

ลบภาพยนตร์ ความสัมพันธ์กับประเภทใน `movie_genres` จะถูกลบตามอัตโนมัติ (`ON DELETE CASCADE`) ถ้าไม่พบ ID จะได้ `404`

### GET /genres

คืนประเภทภาพยนตร์ทั้งหมด เรียงตาม `id`

### POST /genres

Body: `{ "name": "Documentary" }`

- ไม่ส่ง `name` หรือส่งค่าว่างจะได้ `400`
- ชื่อซ้ำกับที่มีอยู่จะได้ `409` (คอลัมน์ `name` เป็น `UNIQUE`)
- สำเร็จจะได้ `201` และ `{ id, name }`

### GET /movies/:id/genres

คืนประเภทของภาพยนตร์เรื่องนั้น โดย JOIN ตาราง `genres` กับ `movie_genres` ถ้าไม่พบภาพยนตร์จะได้ `404`

### PUT /movies/:id/genres

Body: `{ "genre_ids": [1, 3] }`

**แทนที่** ประเภทเดิมทั้งหมดด้วยรายการที่ส่งมา (ส่ง `[]` = ลบประเภทออกทั้งหมด)

1. ตรวจว่า `genre_ids` เป็น array ของจำนวนเต็มบวกที่ไม่ซ้ำกัน ถ้าไม่ใช่จะได้ `400 VALIDATION_ERROR`
2. ตรวจว่ามีภาพยนตร์เรื่องนี้ ถ้าไม่มีจะได้ `404`
3. ตรวจว่าทุก genre id มีอยู่จริง ถ้าไม่ครบจะได้ `400 INVALID_GENRE_IDS`
4. ลบความสัมพันธ์เดิมแล้วเพิ่มใหม่ภายใน **Transaction** ถ้าล้มกลางทางจะ rollback ข้อมูลเลยไม่ค้างครึ่งๆ กลางๆ

```json
{ "message": "กำหนดประเภทภาพยนตร์สำเร็จ", "movie_id": 1, "genre_ids": [1, 3] }
```

### GET /external/movies?title=Inception

ค้นหาข้อมูลภาพยนตร์จาก [OMDb](https://www.omdbapi.com/) (ต้องใส่ `OMDB_API_KEY` ใน `.env`)

- ไม่ส่ง `title` จะได้ `400`
- เรียก OMDb โดยใช้ Timeout 5 วินาที
- ถ้าล้มเหลวเพราะ Network / Timeout / OMDb ตอบ 5xx จะลองใหม่สูงสุด 3 ครั้ง (รอ 500ms แล้ว 1000ms)
- ถ้ายังไม่สำเร็จจะตอบ `200` พร้อม `"source": "fallback"` และข้อมูลสำรอง แทนการส่ง Error
- ถ้า OMDb หาไม่เจอจะได้ `"source": "omdb"` และ `"data": null`

ตั้ง `OMDB_FORCE_FAILURE=true` หรือ `OMDB_FORCE_TIMEOUT=true` เพื่อจำลองกรณีล้มเหลวได้

## Testing

รัน Unit / API Tests (ต้องเปิด MySQL ไว้ก่อน เช่น `docker compose up -d`):

```bash
DB_HOST=127.0.0.1 DB_PORT=3307 DB_USER=root DB_PASSWORD=1234 DB_NAME=movie_api npm test
```

รันพร้อม Coverage:

```bash
npm test -- --coverage
```

ผลการทดสอบล่าสุด:

```text
Test Suites: 2 passed
Tests:       30 passed
Coverage:    92.09% Statements
```

ทดสอบ API เพิ่มเติมด้วย Postman และ Newman

```bash
npx newman run "postman_collection.json" -e "environment.json"
```

## Architecture

โปรเจกต์ใช้แนวทาง **Modular Monolith** โดยแบ่งความรับผิดชอบเป็นส่วน Movie/Genre และ External API ภายใน Express Application เดียว

Frontend ติดต่อผ่าน REST API และ API ติดต่อ MySQL สำหรับจัดเก็บข้อมูล

## Documentation

เอกสารเพิ่มเติม:

- `openapi.yaml` — API Documentation
- `coverage-report.md` — Test Coverage
- `failure-scenario-results.md` — External API Failure Test
- `microservices-design.md` — Architecture Design
- `requirement.md` — Project Requirements
